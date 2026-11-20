import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';

// Comercial, fase 4: Comisiones. Las respuestas se arman con el mismo cálculo
// del backend (calcularComisiones) sobre facturas ficticias. Se comprueba el
// año por mes, la ficha del mes, el cierre con confirmación, su anulación con
// motivo, la versión nueva de las reglas y que quien no tiene el permiso ve
// solo lo suyo y no cierra ni cambia reglas.

const require = createRequire(import.meta.url);
const { TRAMOS_EXCEL, calcularComisiones, soloDe } = require('../backend/src/services/comercial.comisiones.domain.js');
const { crearLibro } = require('../backend/src/utils/xlsx-escribir.js');

test.setTimeout(60000);

const token = (id) => `header.${Buffer.from(JSON.stringify({ exp: 4102444800, id, acceso_cron: 2 })).toString('base64url')}.signature`;
const JEFA = { id: 7, usuario: 'comercial', nombre: 'Ana', apellido: 'Comercial', cargo: 'Jefe de Area', area: 'Comercial', acceso_cron: 2 };
const VENDEDOR = { id: 8, usuario: 'lrojas', nombre: 'Luis', apellido: 'Rojas', cargo: 'Ejecutivo Comercial', area: 'Comercial', acceso_cron: 2 };

const CATEGORIAS = [
  { id: 3, codigo: 'ST-STIL-MPR', nombre: 'Mantenimiento preventivo (STIL)', area: 'ST', regla: 'NETO', vigente: true },
  { id: 14, codigo: 'ST-LOG', nombre: 'Logística (ST)', area: 'ST', regla: 'LOGISTICA', vigente: true },
  { id: 19, codigo: 'CAL-BLZ', nombre: 'Calibración de balanzas', area: 'CAL', regla: 'NETO', vigente: true },
  { id: 25, codigo: 'VENT-PESAS-M', nombre: 'Pesas clase M', area: 'VENT', regla: 'PRODUCTO', vigente: true },
];
const REGLA = {
  id: 1, vigenteDesde: '2020-01-01', base: 'MONTO', tramos: TRAMOS_EXCEL, categorias: [3, 25], ventaSinCosto: false,
  nota: 'Reglas del Excel de facturación 2026.', creado: { usuario: 'migración 037', nombre: 'Migración 037', fecha: '2026-11-20T12:00:00' },
};
const cat = (id) => CATEGORIAS.find(c => c.id === id);

// Facturas ficticias de enero a noviembre de 2026.
const DATOS = (() => {
  const facturas = [];
  const lineas = [];
  const responsables = [];
  let id = 1;
  for (let mes = 1; mes <= 11; mes += 1) {
    for (let k = 0; k < 4; k += 1) {
      facturas.push({ id, gestion: 2026, numero: 500 + id, fecha: `2026-${String(mes).padStart(2, '0')}-${String(3 + k * 6).padStart(2, '0')}`, razonSocial: `Cliente ficticio ${id}` });
      lineas.push({ facturaId: id, monto: 4000 + id * 37, costo: null, categoria: cat(3) });
      if (k === 1) lineas.push({ facturaId: id, monto: 3000, costo: 1800, categoria: cat(25) });
      if (k === 2) lineas.push({ facturaId: id, monto: 2500, costo: null, categoria: cat(19) });
      if (k === 3) lineas.push({ facturaId: id, monto: 5000, costo: null, categoria: cat(25) });
      responsables.push({ facturaId: id, usuarioId: k % 2 ? 8 : 7, nombre: k % 2 ? 'Luis Rojas' : 'Ana Comercial', porcentaje: null });
      id += 1;
    }
  }
  return { facturas, lineas, responsables };
})();

const delMes = (mes) => {
  const facturas = DATOS.facturas.filter(f => Number(f.fecha.slice(5, 7)) === mes);
  const ids = new Set(facturas.map(f => f.id));
  return calcularComisiones({
    facturas, lineas: DATOS.lineas.filter(l => ids.has(l.facturaId)), responsables: DATOS.responsables.filter(r => ids.has(r.facturaId)), reglas: [REGLA],
  });
};

async function preparar(page, { usuario = JEFA, gestionar = true } = {}) {
  await page.addInitScript(({ token, usuario }) => {
    if (sessionStorage.getItem('comercial-comisiones-qa')) return;
    sessionStorage.setItem('comercial-comisiones-qa', '1');
    localStorage.clear();
    localStorage.setItem('datamet_token', token);
    localStorage.setItem('datamet_user', JSON.stringify(usuario));
    localStorage.setItem('datamet_last_view', 'comercial');
  }, { token: token(usuario.id), usuario });
  const enviados = {};
  const escrituras = [];
  const errores = [];
  const cerrados = new Map();
  page.on('pageerror', error => errores.push(error.message));
  const todos = gestionar;
  const visible = (calculo) => (todos ? calculo : soloDe(calculo, usuario.id));
  await page.route(url => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, '');
    const json = (data, status = 200) => route.fulfill({ status, json: { success: true, data } });
    if (request.method() !== 'GET') escrituras.push(`${request.method()} ${path}`);
    const puede = { todos, gestionar };

    let m = /^\/comercial\/comisiones\/2026\/(\d+)\/cierre$/.exec(path);
    if (m && request.method() === 'POST') {
      cerrados.set(Number(m[1]), { id: 90 + Number(m[1]), cerrado: { usuario: 'comercial', nombre: 'Ana Comercial', fecha: '2026-11-20T15:00:00' }, diferencia: 0 });
      enviados.cierre = Number(m[1]);
      return json({}, 201);
    }
    m = /^\/comercial\/comisiones\/cierres\/(\d+)\/anulacion$/.exec(path);
    if (m) {
      enviados.anulacion = { id: Number(m[1]), ...request.postDataJSON() };
      cerrados.clear();
      return json({});
    }
    if (path === '/comercial/comisiones/reglas' && request.method() === 'POST') {
      enviados.regla = request.postDataJSON();
      return json({}, 201);
    }
    if (path === '/comercial/comisiones/reglas') {
      return json({ reglas: [REGLA], vigente: REGLA, categorias: CATEGORIAS, desdeMinimo: cerrados.size ? '2026-04-01' : null, puede: { gestionar } });
    }
    m = /^\/comercial\/comisiones\/2026\/(\d+)\/excel$/.exec(path);
    if (m) {
      const libro = crearLibro([{ nombre: 'Comisiones', columnas: [{ titulo: 'Responsable' }, { titulo: 'Comisión', tipo: 'bs' }], filas: [['Ana Comercial', 10]] }]);
      return route.fulfill({ status: 200, body: libro, headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } });
    }
    m = /^\/comercial\/comisiones\/2026\/(\d+)$/.exec(path);
    if (m) {
      const mes = Number(m[1]);
      const { reglas: _ids, ...calculo } = visible(delMes(mes));
      return json({
        gestion: 2026, mes, estado: cerrados.has(mes) ? 'cerrado' : mes === 11 ? 'en_curso' : 'abierto', todos, puede,
        cierre: cerrados.get(mes) || null, historialCierres: enviados.anulacion ? [{ id: 93, estado: 'ANULADO', comision: 10, cerrado: { nombre: 'Ana Comercial', fecha: '2026-11-20T15:00:00' }, anulado: { nombre: 'Ana Comercial', fecha: '2026-11-20T15:05:00', motivo: enviados.anulacion.motivo } }] : [],
        reglas: [{ id: 1, vigenteDesde: '2020-01-01', nota: REGLA.nota }], ...calculo,
      });
    }
    if (path === '/comercial/comisiones') {
      const meses = Array.from({ length: 12 }, (_, i) => {
        const mes = i + 1;
        if (mes === 12) return { mes, estado: 'futuro', base: 0, comision: 0, personas: 0, cierre: null };
        const c = visible(delMes(mes));
        return { mes, estado: cerrados.has(mes) ? 'cerrado' : mes === 11 ? 'en_curso' : 'abierto', base: c.totales.base, comision: c.totales.comision, personas: c.personas.length, cierre: cerrados.get(mes) || null };
      });
      const personas = new Map();
      for (let mes = 1; mes <= 11; mes += 1) {
        for (const p of visible(delMes(mes)).personas) {
          const x = personas.get(p.usuarioId) || { usuarioId: p.usuarioId, nombre: p.nombre, base: 0, comision: 0 };
          x.comision = Math.round((x.comision + p.comision) * 100) / 100;
          personas.set(p.usuarioId, x);
        }
      }
      const total = Math.round(meses.reduce((s, x) => s + x.comision * 100, 0)) / 100;
      return json({ gestion: 2026, gestiones: [2026], meses, personas: [...personas.values()], total, todos, puede });
    }
    if (path === '/sistema/permisos/mios') return json({ permisos: [], gestionar: false });
    return route.fulfill({ status: 403, json: { success: false, code: 'AREA_ACCESS_DENIED', message: 'Sin acceso en la prueba.' } });
  });
  return { enviados, escrituras, errores };
}

test('La jefa de Comercial cierra un mes, lo exporta y anula el cierre con motivo', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { enviados, errores } = await preparar(page);
  await page.goto('/comercial/comisiones');
  await expect(page.getByRole('navigation', { name: 'Módulos' }).getByRole('link', { name: 'Comisiones', exact: true })).toBeVisible({ timeout: 30000 });
  const tabla = page.getByRole('table', { name: 'Comisiones de 2026 por mes' });
  await expect(tabla.getByRole('rowheader', { name: 'marzo' })).toBeVisible({ timeout: 30000 });
  await expect(tabla.getByText('En curso')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Comisiones por responsable' }).getByText('Ana Comercial')).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/comercial-comisiones-desktop.png', fullPage: true });

  await tabla.getByRole('rowheader', { name: 'marzo' }).click();
  const ficha = page.getByRole('dialog', { name: 'Comisiones de marzo 2026' });
  await expect(ficha.getByText('Por responsable')).toBeVisible();
  await expect(ficha.getByText('Mantenimiento preventivo (STIL)').first()).toBeVisible();
  // Lo que no comisiona, con su motivo: Calibración y la venta sin costo.
  const noComisionan = ficha.locator('summary').filter({ hasText: 'Líneas que no comisionan' });
  await expect(noComisionan).toContainText('1 de categorías que no comisionan');
  await expect(noComisionan).toContainText('1 por costear');
  await page.screenshot({ path: '.impeccable/review/comercial-comisiones-mes.png' });

  await ficha.getByRole('button', { name: 'Cerrar el mes' }).click();
  await expect(ficha.getByRole('alertdialog', { name: 'Confirmar el cierre de marzo 2026' })).toBeVisible();
  expect(enviados.cierre).toBeUndefined();
  await ficha.getByRole('button', { name: 'Sí, cerrar marzo' }).click();
  await expect.poll(() => enviados.cierre).toBe(3);
  await expect(ficha.getByText('es lo que se paga', { exact: false })).toBeVisible();

  const descarga = page.waitForEvent('download');
  await ficha.getByRole('button', { name: 'Exportar a Excel' }).click();
  expect((await descarga).suggestedFilename()).toBe('comisiones-2026-03.xlsx');

  await ficha.getByRole('button', { name: 'Anular el cierre' }).click();
  const anular = page.getByRole('dialog', { name: 'Anular el cierre de marzo 2026' });
  await anular.getByRole('textbox').fill('La factura N.º 512 se anuló y se reemplazó después del cierre.');
  await anular.getByRole('button', { name: 'Anular el cierre' }).click();
  await expect.poll(() => enviados.anulacion).toEqual({ id: 93, motivo: 'La factura N.º 512 se anuló y se reemplazó después del cierre.' });
  await expect(ficha.getByText('Cierres anulados')).toBeVisible();
  expect(errores).toEqual([]);
});

test('Una versión nueva de las reglas parte de la vigente y pide su motivo', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { enviados } = await preparar(page);
  await page.goto('/comercial/comisiones');
  await page.getByRole('group', { name: 'Vista de comisiones' }).getByRole('button', { name: 'Reglas' }).click({ timeout: 30000 });
  const vigentes = page.getByRole('region', { name: 'Reglas vigentes' });
  await expect(vigentes.getByRole('cell', { name: 'Desde 30,01 %' })).toBeVisible();
  await expect(vigentes.getByRole('cell', { name: 'No comisiona' })).toBeVisible();
  await expect(vigentes.getByText('Categorías que comisionan (2 de 4)')).toBeVisible();
  await vigentes.getByRole('button', { name: 'Nueva versión' }).click();

  const modal = page.getByRole('dialog', { name: 'Nueva versión de las reglas' });
  await modal.getByLabel('Comisión del tramo 2').fill('0,8');
  await modal.getByRole('checkbox', { name: 'Calibración de balanzas' }).check();
  await expect(modal.getByRole('button', { name: 'Guardar la versión' })).toBeDisabled();
  await modal.getByLabel('Por qué cambian').fill('Gerencia sube el tramo de 20 % a 30 % al 0,8 %.');
  await page.screenshot({ path: '.impeccable/review/comercial-comisiones-reglas.png' });
  await modal.getByRole('button', { name: 'Guardar la versión' }).click();
  await expect.poll(() => enviados.regla).toBeTruthy();
  expect(enviados.regla).toMatchObject({
    base: 'MONTO', ventaSinCosto: false, nota: 'Gerencia sube el tramo de 20 % a 30 % al 0,8 %.',
    tramos: [{ desde: 0, tasa: 0 }, { desde: 20, tasa: 0.8 }, { desde: 30.01, tasa: 1 }],
  });
  expect([...enviados.regla.categorias].sort((a, b) => a - b)).toEqual([3, 19, 25]);
  expect(enviados.regla.vigenteDesde).toMatch(/^\d{4}-\d{2}-01$/);
});

test('Sin el permiso: solo las suyas, sin cerrar ni cambiar reglas; sin desbordes', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 900 });
  const { escrituras, errores } = await preparar(page, { usuario: VENDEDOR, gestionar: false });
  await page.goto('/comercial/comisiones');
  await expect(page.getByText('Ves tus comisiones.', { exact: false })).toBeVisible({ timeout: 30000 });
  const porResponsable = page.getByRole('region', { name: 'Comisiones por responsable' });
  await expect(porResponsable.getByText('Luis Rojas')).toBeVisible();
  await expect(porResponsable.getByText('Ana Comercial')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

  await page.getByRole('table', { name: 'Comisiones de 2026 por mes' }).getByRole('rowheader', { name: 'febrero' }).click();
  const ficha = page.getByRole('dialog', { name: 'Comisiones de febrero 2026' });
  await expect(ficha.getByText('Las tuyas.')).toBeVisible();
  await expect(ficha.getByRole('button', { name: 'Cerrar el mes' })).toHaveCount(0);
  await expect(ficha.getByText('Ana Comercial')).toHaveCount(0);
  await ficha.getByRole('button', { name: 'Cerrar', exact: true }).click();

  await page.getByRole('group', { name: 'Vista de comisiones' }).getByRole('button', { name: 'Reglas' }).click();
  await expect(page.getByRole('region', { name: 'Reglas vigentes' }).getByRole('cell', { name: 'Desde 30,01 %' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nueva versión' })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('group', { name: 'Vista de comisiones' }).getByRole('button', { name: 'Por mes' }).click();
  await expect(page.getByRole('table', { name: 'Comisiones de 2026 por mes' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await page.screenshot({ path: '.impeccable/review/comercial-comisiones-movil.png', fullPage: true });
  expect(escrituras).toEqual([]);
  expect(errores).toEqual([]);
});
