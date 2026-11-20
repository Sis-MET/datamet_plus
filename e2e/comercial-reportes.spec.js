import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';

// Comercial, fase 4: Reportes. La respuesta de /api/comercial/reportes se arma
// con el mismo código del backend (armarReporte) a partir de facturas
// ficticias, y el Excel con su mismo generador. Se comprueba lo que la
// pantalla pide al cambiar los filtros, el detalle de cada mes, la tabla, la
// descarga y que no se desborda.

const require = createRequire(import.meta.url);
const { armarReporte } = require('../backend/src/services/comercial.reportes.domain.js');
const { crearLibro } = require('../backend/src/utils/xlsx-escribir.js');

test.setTimeout(60000);

const token = (id) => `header.${Buffer.from(JSON.stringify({ exp: 4102444800, id, acceso_cron: 2 })).toString('base64url')}.signature`;
const COMERCIAL = { id: 4, usuario: 'comercial', nombre: 'Ana', apellido: 'Comercial', cargo: 'Auxiliar Comercial', area: 'Comercial', acceso_cron: 2 };
const ADMINISTRACION = { id: 5, usuario: 'contable', nombre: 'Rosa', apellido: 'Contable', cargo: 'Contadora', area: 'Administración', acceso_cron: 2 };

const CATEGORIAS = [
  { id: 3, codigo: 'ST-STIL-MPR', nombre: 'Mantenimiento preventivo (STIL)', area: 'ST', regla: 'NETO' },
  { id: 7, codigo: 'ST-STAC-DIAG', nombre: 'Diagnóstico (STAC)', area: 'ST', regla: 'NETO' },
  { id: 19, codigo: 'CAL-BLZ', nombre: 'Calibración de balanzas', area: 'CAL', regla: 'NETO' },
  { id: 20, codigo: 'CAL-PSP', nombre: 'Calibración de pesas', area: 'CAL', regla: 'NETO' },
  { id: 25, codigo: 'VENT-PESAS-M', nombre: 'Pesas clase M', area: 'VENT', regla: 'PRODUCTO' },
  { id: 27, codigo: 'VENT-BLZ', nombre: 'Balanzas', area: 'VENT', regla: 'PRODUCTO' },
];
const CLIENTES = [
  ['0999', 'CLIENTE DE EJEMPLO S.R.L.', '2023-04-01'], ['0888', 'OTRA EMPRESA S.A.', '2026-02-10'], ['0777', 'INDUSTRIAS FICTICIAS LTDA.', '2023-08-15'],
  ['0666', 'ALIMENTOS DE PRUEBA S.A.', '2024-01-20'], ['0555', 'MINERA IMAGINARIA S.A.', '2026-06-01'], [null, 'Persona Natural', null],
];
const PERSONAS = [{ usuarioId: 7, nombre: 'Ana Comercial' }, { usuarioId: 8, nombre: 'Luis Rojas' }, { usuarioId: 9, nombre: 'Marta Vaca' }];

// Facturas ficticias de 2025 y 2026, siempre las mismas (sin azar).
const datos = (() => {
  const facturas = [];
  const lineas = [];
  const responsables = [];
  let id = 1;
  for (const gestion of [2025, 2026]) {
    for (let mes = 1; mes <= (gestion === 2026 ? 11 : 12); mes += 1) {
      for (let k = 0; k < 3 + (mes % 4); k += 1) {
        const [codigo, nombre, alta] = CLIENTES[(id + k) % CLIENTES.length];
        const cat = CATEGORIAS[(id * 7 + k) % CATEGORIAS.length];
        const otra = CATEGORIAS[(id * 3 + 1) % CATEGORIAS.length];
        const monto = 800 + ((id * 977) % 9000);
        const extra = id % 5 === 0 ? 1200 : 0;
        facturas.push({
          id, gestion, numero: id, fecha: `${gestion}-${String(mes).padStart(2, '0')}-${String(1 + (k * 7) % 27).padStart(2, '0')}`, estado: id % 29 === 0 ? 'ANULADA' : 'VIGENTE',
          monto: monto + extra, pagado: id % 3 === 0 ? 0 : monto + extra, clienteCodigo: codigo, nit: codigo ? `10${codigo}` : null, razonSocial: nombre,
          clienteNombre: codigo ? nombre : null, rubro: codigo === '0666' ? 'ALIMENTOS' : null, fechaRegistro: alta, primeraGestion: codigo === '0888' || codigo === '0555' ? 2026 : 2025,
        });
        lineas.push({ facturaId: id, monto, cantidad: cat.area === 'CAL' ? 4 : null, regional: id % 4 === 0 ? 'SCZ' : 'LPZ', costo: cat.regla === 'PRODUCTO' && id % 2 ? monto * 0.55 : null, categoria: cat });
        if (extra) lineas.push({ facturaId: id, monto: extra, cantidad: null, regional: 'LPZ', costo: null, categoria: otra });
        const p = PERSONAS[id % PERSONAS.length];
        if (id % 11 !== 0) responsables.push({ facturaId: id, ...p, porcentaje: id % 6 === 0 ? 50 : null });
        if (id % 6 === 0) responsables.push({ facturaId: id, ...PERSONAS[(id + 1) % PERSONAS.length], porcentaje: 50 });
        id += 1;
      }
    }
  }
  return { facturas, lineas, responsables };
})();

const reporteDe = ({ desde, hasta, area, tipo }) => {
  const enRango = datos.facturas.filter(f => f.fecha >= desde && f.fecha <= hasta);
  const ids = new Set(enRango.map(f => f.id));
  return {
    ...armarReporte({
      facturas: enRango,
      lineas: datos.lineas.filter(l => ids.has(l.facturaId)),
      responsables: datos.responsables.filter(r => ids.has(r.facturaId)),
      filtros: { desde, hasta, area: area || null },
    }),
    gestiones: [2026, 2025],
    filtros: { desde, hasta, area: area || null, tipo: tipo || null },
  };
};

async function preparar(page, { usuario = COMERCIAL } = {}) {
  await page.addInitScript(({ token, usuario }) => {
    if (sessionStorage.getItem('comercial-reportes-qa')) return;
    sessionStorage.setItem('comercial-reportes-qa', '1');
    localStorage.clear();
    localStorage.setItem('datamet_token', token);
    localStorage.setItem('datamet_user', JSON.stringify(usuario));
    localStorage.setItem('datamet_last_view', 'comercial');
  }, { token: token(usuario.id), usuario });
  const pedidos = [];
  const errores = [];
  page.on('pageerror', error => errores.push(error.message));
  await page.route(url => url.pathname.startsWith('/api/'), async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api/, '');
    const json = (data, status = 200) => route.fulfill({ status, json: { success: true, data } });
    const filtros = Object.fromEntries(url.searchParams);
    if (path === '/comercial/reportes/excel') {
      pedidos.push({ excel: true, ...filtros });
      const libro = crearLibro([{ nombre: 'Resumen', columnas: [{ titulo: 'Mes' }, { titulo: 'Total', tipo: 'bs' }], filas: [['2026-01', 1000]] }]);
      return route.fulfill({ status: 200, body: libro, headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } });
    }
    if (path === '/comercial/reportes') {
      pedidos.push(filtros);
      return json(reporteDe({ desde: filtros.desde || '2026-01-01', hasta: filtros.hasta || '2026-11-20', area: filtros.area, tipo: filtros.tipo }));
    }
    if (path === '/sistema/permisos/mios') return json({ permisos: [], gestionar: false });
    return route.fulfill({ status: 403, json: { success: false, code: 'AREA_ACCESS_DENIED', message: 'Sin acceso en la prueba.' } });
  });
  return { pedidos, errores };
}

test('Reportes: cifras, facturación por mes con su detalle y tabla, y los filtros', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { pedidos, errores } = await preparar(page);
  await page.goto('/comercial/reportes');

  await expect(page.getByRole('navigation', { name: 'Módulos' }).getByRole('link', { name: 'Reportes', exact: true })).toBeVisible({ timeout: 30000 });
  const grafico = page.getByRole('group', { name: /Facturación por mes/ });
  await expect(grafico).toBeVisible({ timeout: 30000 });
  // Por omisión, la gestión en curso hasta hoy.
  expect(pedidos[0].desde).toMatch(/^\d{4}-01-01$/);
  await expect(page.getByRole('list', { name: 'Áreas', exact: true })).toContainText('Calibración');
  await expect(page.getByRole('region', { name: 'Por responsable comercial' }).getByText('Ana Comercial')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Rubro' }).getByText('de', { exact: false }).first()).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/comercial-reportes-desktop.png', fullPage: true });

  // El detalle de un mes, con el puntero y con el teclado.
  const marzo = page.getByRole('img', { name: /^marzo 2026/ });
  await marzo.hover();
  await expect(page.getByRole('status').filter({ hasText: 'marzo 2026' })).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/comercial-reportes-tooltip.png' });
  await marzo.focus();
  await expect(page.getByRole('status').filter({ hasText: 'facturas' })).toBeVisible();

  // La tabla con los mismos números.
  await page.getByRole('button', { name: 'Ver tabla' }).click();
  const tabla = page.getByRole('table', { name: 'Facturación por mes y área' });
  await expect(tabla.getByRole('rowheader', { name: 'mar' })).toBeVisible();
  await page.getByRole('button', { name: 'Ver gráfico' }).click();

  // Filtros: área y gestión anterior.
  await page.getByRole('combobox', { name: 'Área' }).click();
  await page.getByRole('option', { name: 'Calibración' }).click();
  await expect.poll(() => pedidos.at(-1).area).toBe('CAL');
  await expect(page.getByText('solo Calibración', { exact: false })).toBeVisible();
  await page.getByRole('group', { name: 'Período' }).getByRole('button', { name: 'Gestión anterior' }).click();
  await expect.poll(() => pedidos.at(-1).desde).toMatch(/^\d{4}-01-01$/);
  expect(pedidos.at(-1).hasta).toMatch(/-12-31$/);
  await expect(page.getByRole('img', { name: /^diciembre 2025/ })).toBeVisible();
  expect(errores).toEqual([]);
});

test('Exportar a Excel con los mismos filtros', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { pedidos } = await preparar(page);
  await page.goto('/comercial/reportes');
  await expect(page.getByRole('group', { name: /Facturación por mes/ })).toBeVisible({ timeout: 30000 });
  await page.getByRole('combobox', { name: 'Área' }).click();
  await page.getByRole('option', { name: 'Ventas' }).click();
  await expect.poll(() => pedidos.at(-1).area).toBe('VENT');
  const descarga = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar a Excel' }).click();
  const archivo = await descarga;
  expect(archivo.suggestedFilename()).toMatch(/^comercial-\d{4}-01-01-a-\d{4}-\d{2}-\d{2}-vent\.xlsx$/);
  expect(pedidos.find(p => p.excel)).toMatchObject({ area: 'VENT' });
  await expect(page.getByText('Excel listo: Resumen, Facturas, Líneas y Pagos.')).toBeVisible();
});

test('Administración consulta los reportes; sin desbordes a 1180 px ni en el teléfono', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 900 });
  const { errores } = await preparar(page, { usuario: ADMINISTRACION });
  await page.goto('/comercial/reportes');
  await expect(page.getByRole('group', { name: /Facturación por mes/ })).toBeVisible({ timeout: 30000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await page.screenshot({ path: '.impeccable/review/comercial-reportes-1180.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('group', { name: /Facturación por mes/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await page.screenshot({ path: '.impeccable/review/comercial-reportes-movil.png', fullPage: true });
  expect(errores).toEqual([]);
});
