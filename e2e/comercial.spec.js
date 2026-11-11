import { expect, test } from '@playwright/test';

// Comercial en Soporte técnico: solo consulta los informes emitidos y los
// próximos servicios. La API se simula como la responde el backend a quien
// solo consulta (solo emitidos, sin acciones).

test.setTimeout(60000);

const token = `header.${Buffer.from(JSON.stringify({ exp: 4102444800, id: 4, acceso_cron: 2 })).toString('base64url')}.signature`;
const USUARIO = { id: 4, usuario: 'comercial', nombre: 'Ana', apellido: 'Comercial', cargo: 'Auxiliar Comercial', area: 'Comercial', acceso_cron: 2 };

const fuente = {
  otst: '26-0015-41-S08', cod_metrica: '0015-41-001', cliente: 'Cliente de prueba', planta: 'Planta Norte', personal: 'Técnico QA',
  fecha_servicio: '2026-10-20', tipo_equipo: 'Balanza de plataforma', marca: 'Métrica', modelo: 'P300', serie: 'QA-123',
  cap_max1: 300, d1: 0.1, unidades: 'kg', comentario_general: 'Se verificó la plataforma.',
};

const fila = {
  tipo: 'MPR', tipoLabel: 'Mantenimiento preventivo regular', codigo: 'ST-001', numero: '26-0015-41-S08-001', otst: fuente.otst,
  fechaServicio: fuente.fecha_servicio, tecnico: fuente.personal, cliente: fuente.cliente, planta: fuente.planta, codMetrica: fuente.cod_metrica,
  instrumento: { tipo: fuente.tipo_equipo, marca: fuente.marca, modelo: fuente.modelo, serie: fuente.serie },
  estado: 'EMITIDO', validacionEstado: 'BORRADOR', revision: 1, actualizadoEn: '2026-10-22T15:00:00Z', emitidoEn: '2026-10-22T15:00:00Z', fotos: 0,
};

const informe = {
  tipo: 'MPR', codigo: 'ST-001', numero: fila.numero, tipoLabel: fila.tipoLabel, otst: fuente.otst, otstOriginal: fuente.otst,
  fuente, datos: {}, estado: 'EMITIDO', revision: 1, version: 4, consulta: true,
  columnas: Object.fromEntries(Object.entries(fuente).map(([k, v]) => [k, { tipo: typeof v === 'number' ? 'decimal' : 'texto', max: 4000 }])),
  acciones: { editar: false, aprobar: false, redaccion: false }, fotos: [], historial: [],
  revisiones: [
    { revision: 0, numero: fila.numero, motivo: null, emitidoPor: { usuario: 'jefe', nombre: 'Jefe QA' }, emitidoEn: '2026-10-21T15:00:00Z' },
    { revision: 1, numero: fila.numero, motivo: 'Corrección pedida por el cliente', emitidoPor: { usuario: 'jefe', nombre: 'Jefe QA' }, emitidoEn: '2026-10-22T15:00:00Z' },
  ],
  trazabilidad: { emitidoPor: { usuario: 'jefe', nombre: 'Jefe QA' }, emitidoEn: '2026-10-22T15:00:00Z' },
  validacion: { estado: 'APROBADO' }, revisionAbierta: null,
};

async function preparar(page, { pestana = 'informes' } = {}) {
  await page.addInitScript(({ token, usuario, pestana }) => {
    if (sessionStorage.getItem('comercial-qa')) return;
    sessionStorage.setItem('comercial-qa', '1');
    localStorage.clear();
    localStorage.setItem('datamet_token', token);
    localStorage.setItem('datamet_user', JSON.stringify(usuario));
    localStorage.setItem('datamet_last_view', 'soporte');
    localStorage.setItem('datamet_soporte_pestana', pestana);
    localStorage.setItem('datamet_soporte_agrupar', 'ninguno');
  }, { token, usuario: USUARIO, pestana });
  const pedidas = [];
  await page.route(url => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    pedidas.push(`${request.method()} ${path}`);
    const json = data => route.fulfill({ json: { success: true, data } });
    if (path.endsWith('/soporte/permisos')) {
      return json({ editar: false, aprobar: false, configurarAprobadores: false, consulta: true, tiempos: false, nombre: 'Ana Comercial' });
    }
    if (path.endsWith('/soporte/informes/filtros')) return json({ tipos: [], clientes: [fuente.cliente], tecnicos: [fuente.personal] });
    if (path.endsWith('/soporte/informes')) {
      return json({ items: [fila], total: 1, page: 1, pageSize: 25, acciones: { editar: false, consulta: true },
        resumen: { tipos: { MPR: 1 }, estados: { PENDIENTE: 0, BORRADOR: 0, EMITIDO: 1, EN_REVISION: 0 }, total: 1 } });
    }
    if (path.endsWith('/ST-001/documentos')) return json({ configurado: true, nombreRaiz: 'SOPORTE TECNICO', documentos: [] });
    if (path.endsWith('/soporte/informes/MPR/ST-001')) return json(informe);
    if (path.endsWith('/proximos/resumen')) return json({ total: 2, vencidas: 0 });
    if (path.endsWith('/soporte/proximos')) {
      return json({ anio: Number(url.searchParams.get('anio')), hoy: '2026-11-11', ajustes: { alertaDias: 30 }, equipos: [], alertas: [], eventos: [],
        permisos: { editar: false, consulta: true } });
    }
    return route.fulfill({ status: 403, json: { success: false, code: 'AREA_ACCESS_DENIED', message: 'Tu área solo consulta este apartado.' } });
  });
  return pedidas;
}

test('Comercial ve solo los informes emitidos y los abre sin poder modificarlos', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const pedidas = await preparar(page);
  await page.goto('/soporte/informes');

  const menu = page.getByRole('navigation', { name: 'Módulos' });
  await expect(menu.getByRole('link', { name: 'Informes emitidos', exact: true })).toBeVisible({ timeout: 30000 });
  await expect(menu.getByRole('link', { name: /^Próximos servicios/ })).toBeVisible();
  for (const oculta of ['Avisos', 'Tiempos de servicio', 'Configuración']) await expect(menu.getByRole('link', { name: oculta, exact: true })).toHaveCount(0);

  await expect(page.getByText('Informes emitidos por Soporte Técnico', { exact: false })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('group', { name: 'Filtrar por estado' })).toHaveCount(0);
  await expect(page.getByText(fila.numero).first()).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/comercial-informes-desktop.png', fullPage: true });

  await page.getByText(fila.numero).first().click();
  await expect(page.getByRole('heading', { name: fila.numero })).toBeVisible();
  await expect(page.getByText('es la versión que tiene el cliente', { exact: false })).toBeVisible();
  for (const accion of ['Guardar PDF', 'Abrir revisión', 'Cambiar OTST']) await expect(page.getByRole('button', { name: accion, exact: true })).toHaveCount(0);
  for (const accion of ['Imprimir', 'Descargar copia']) await expect(page.getByRole('button', { name: accion, exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: /^Revisiones/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Historial/ })).toHaveCount(0);
  await expect(page.getByText('PDF pendiente de guardar.', { exact: true })).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '.impeccable/review/comercial-informe-desktop.png' });

  // Ni escribe ni pide lo que es solo del área.
  expect(pedidas.filter(p => !p.startsWith('GET '))).toEqual([]);
  expect(pedidas.some(p => /avisos|tiempos|configuracion|carpetas/.test(p))).toBe(false);
});

test('Comercial no abre Avisos ni Tiempos aunque llegue con la dirección', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const pedidas = await preparar(page, { pestana: 'avisos' });
  await page.goto('/soporte/avisos');
  await expect(page.getByText('Informes emitidos por Soporte Técnico', { exact: false })).toBeVisible({ timeout: 30000 });
  await page.goto('/soporte/tiempos');
  await expect(page.getByText('Informes emitidos por Soporte Técnico', { exact: false })).toBeVisible({ timeout: 30000 });
  expect(pedidas.some(p => /avisos|tiempos/.test(p))).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await page.screenshot({ path: '.impeccable/review/comercial-informes-mobile.png', fullPage: true });
});
