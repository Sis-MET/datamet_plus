import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';

test.setTimeout(60000);
test.use({ actionTimeout: 30000 });

async function preparar(page, { proximos = false, jefe = false } = {}) {
  const token = Buffer.from(JSON.stringify({ exp: 4102444800, id: 1, acceso_cron: 1 })).toString('base64url');
  await page.addInitScript(({ token, proximos }) => {
    // Verifica la descarga en Chromium sin abrir el selector nativo del SO.
    window.showSaveFilePicker = undefined;
    if (sessionStorage.getItem('soporte-qa')) return;
    sessionStorage.setItem('soporte-qa', '1');
    localStorage.clear();
    localStorage.setItem('rimmet_token', `header.${token}.signature`);
    localStorage.setItem('rimmet_user', JSON.stringify({ id: 1, usuario: 'qa', nombre: 'Usuario', apellido: 'QA', area: 'Soporte Técnico', cargo: 'Técnico', acceso_cron: 1 }));
    localStorage.setItem('rimmet_last_view', 'soporte');
    localStorage.setItem('rimmet_soporte_pestana', proximos ? 'proximos' : 'informes');
    if (!proximos) localStorage.setItem('rimmet_soporte_informe', JSON.stringify({ tipo: 'MPR', codigo: 'ST-001' }));
  }, { token, proximos });
  const estado = { jefe, redaccion: null, estado: 'BORRADOR', validacion: 'BORRADOR', version: 1 };
  const fuente = { otst: '26-0001-S01', cod_metrica: '0001-11-001', cliente: 'Cliente de prueba', planta: 'Planta de prueba',
    personal: 'Técnico QA', fecha_servicio: '2026-10-23', tipo_equipo: 'Balanza de plataforma', marca: 'Métrica', modelo: 'P300',
    serie: 'QA-123', cap_max1: 150, cap_max2: 300, d1: 0.05, d2: 0.1, e1: 0.05, e2: 0.1, unidades: 'kg', comentario_general: 'se verifico la plataforma' };
  const informe = () => ({ tipo: 'MPR', codigo: 'ST-001', numero: '26-0001-S01-001', tipoLabel: 'Mantenimiento preventivo regular',
    fuente, datos: {}, estado: estado.estado, version: estado.version, revision: 0,
    columnas: Object.fromEntries(Object.entries(fuente).map(([k, v]) => [k, { tipo: typeof v === 'number' ? 'decimal' : 'texto', max: 4000 }])),
    acciones: { editar: true, aprobar: estado.jefe, redaccion: true }, fotos: [], historial: [], revisiones: [], trazabilidad: {},
    validacion: { estado: estado.validacion, observacion: estado.observacion, resueltaPor: estado.validacion === 'APROBADO' ? { nombre: 'Jefe QA' } : null }, revisionAbierta: null });
  const rangos = [{ numero: 1, capacidad: 150, division: 0.05, verificacion: 0.05 }, { numero: 2, capacidad: 300, division: 0.1, verificacion: 0.1 }];
  const equipo = { id: '0001-11-001', codMetrica: '0001-11-001', cliente: fuente.cliente, planta: fuente.planta, ciudad: 'La Paz',
    instrumento: fuente.tipo_equipo, marca: fuente.marca, modelo: fuente.modelo, serie: fuente.serie,
    unidades: 'kg', rangos, capacidadMaxima: 300, tipoRango: 'Doble rango', servicios: [],
    origen: { tipo: 'MPR', codigo: 'ST-001', numero: '26-0001-S01-001', fecha: '2026-10-23', otst: fuente.otst },
    proximo: { id: 'MPR:ST-001', fecha: '2027-03-15', fechaSugerida: '2027-03-15', situacion: 'PROGRAMADO', tipoSugerido: 'MPR', diasRestantes: 143 } };
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const body = request.headers()['content-type']?.includes('application/json') ? request.postDataJSON() : null;
    const json = data => route.fulfill({ json: { success: true, data } });
    if (path.endsWith('/soporte/informes/filtros')) return json({ tipos: [], clientes: [fuente.cliente], tecnicos: [fuente.personal] });
    if (path.endsWith('/proximos/resumen')) return json({ total: 0, vencidas: 0 });
    if (path.endsWith('/soporte/proximos')) return json({ anio: Number(url.searchParams.get('anio')), hoy: '2026-10-23',
      ajustes: { alertaDias: 30 }, equipos: [equipo], alertas: [],
      eventos: url.searchParams.get('anio') === '2027' ? [{ id: 'P:1', equipoId: equipo.id, clase: 'PROXIMO', ...equipo.proximo }] : [] });
    if (path.includes('/proximos/equipos/')) return json({ equipo, hoy: '2026-10-23', permisos: { editar: true }, seguimiento: [] });
    if (path.endsWith('/soporte/redaccion')) { estado.redaccion = body; return json({ texto: 'Se verificó la plataforma de 300 kg.', modelo: 'simulado' }); }
    if (path.endsWith('/ST-001') && request.method() === 'GET') return json(informe());
    if (path.endsWith('/ST-001/validacion')) estado.validacion = 'PENDIENTE';
    else if (path.endsWith('/validacion/resolver')) { estado.validacion = body.decision === 'APROBAR' ? 'APROBADO' : 'OBSERVADO'; estado.observacion = body.observacion; }
    else if (path.endsWith('/validacion/retirar')) estado.validacion = 'BORRADOR';
    else if (path.endsWith('/ST-001/emision')) estado.estado = 'EMITIDO';
    else if (path.endsWith('/ST-001/cambios')) Object.assign(fuente, body.cambios);
    else return json({ total: 0, items: [] });
    estado.version++;
    return json(informe());
  });
  estado.equipo = equipo;
  return estado;
}

test('el técnico envía, el jefe aprueba y se habilita emitir; la IA incluye cambios locales', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const estado = await preparar(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Enviar a revisión', exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: /^Emitir informe/ })).toHaveCount(0);
  const comentario = page.locator('#seccion-observaciones textarea').first();
  await comentario.fill('se realizo limpieza y verificacion');
  await comentario.locator('xpath=..').getByRole('button', { name: 'Mejorar redacción', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Sugerencia de redacción' })).toContainText('300 kg');
  expect(estado.redaccion.codigo).toBe('ST-001');
  expect(estado.redaccion.cambios.comentario_general).toBe('se realizo limpieza y verificacion');
  await page.getByRole('button', { name: 'Usar sugerencia', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.getByRole('button', { name: 'Enviar a revisión', exact: true }).click();
  await expect(comentario).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Aprobar informe', exact: true })).toHaveCount(0);
  estado.jefe = true;
  await page.reload();
  await page.getByRole('button', { name: 'Aprobar informe', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Emitir informe/ })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '.impeccable/review/soporte-desktop.png', fullPage: true });
  await page.getByRole('region', { name: 'Validación del informe', exact: true }).screenshot({ path: '.impeccable/review/validacion-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('region', { name: 'Validación del informe', exact: true }).screenshot({ path: '.impeccable/review/validacion-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: /^Emitir informe/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Emitir informe', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Abrir revisión', exact: true })).toBeVisible();
});

test('el plan exporta un mes, varios meses y 2027 completo; la ficha muestra doble rango', async ({ page }) => {
  const { equipo } = await preparar(page, { proximos: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Año siguiente', exact: true }).click();
  await page.getByRole('button', { name: 'Exportar PDF', exact: true }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toContainText('Año 2027');
  await modal.getByLabel('Período', { exact: true }).selectOption('mes');
  await modal.getByLabel('Mes', { exact: true }).selectOption('3');
  await expect(modal).toContainText('1 servicio sugerido');
  await modal.getByLabel('Período', { exact: true }).selectOption('rango');
  await modal.getByLabel('Desde', { exact: true }).selectOption('1');
  await modal.getByLabel('Hasta', { exact: true }).selectOption('6');
  await expect(modal).toContainText('1 servicio sugerido');
  await modal.getByLabel('Período', { exact: true }).selectOption('anio');
  await modal.screenshot({ path: '.impeccable/review/exportar-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await modal.screenshot({ path: '.impeccable/review/exportar-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const descargado = page.waitForEvent('download');
  await modal.getByRole('button', { name: 'Guardar PDF', exact: true }).click();
  const descarga = await descargado;
  expect(descarga.suggestedFilename()).toContain('2027-01-12');
  await fs.mkdir('test-results/soporte', { recursive: true });
  await descarga.saveAs('test-results/soporte/plan-2027.pdf');
  expect((await fs.stat('test-results/soporte/plan-2027.pdf')).size).toBeGreaterThan(2000);
  await expect(modal).toBeHidden();
  // Documento de varias páginas con datos largos y tres rangos para QA de
  // saltos de página, encabezados repetidos y numeración del exportador real.
  const multipagina = await page.evaluate(async equipo => {
    const { generarPlanPdf } = await import('/src/features/soporte/components/proximos/PlanServiciosPdf.jsx');
    const eventos = Array.from({ length: 45 }, (_, i) => ({ ...equipo, ...equipo.proximo, id: `P:${i}`,
      codMetrica: `QA-${String(i + 1).padStart(3, '0')}`, clase: 'PROXIMO', tipoRango: 'Triple rango',
      cliente: 'Cliente de prueba con nombre extenso para planificación anual',
      rangos: [...equipo.rangos, { numero: 3, capacidad: 600, division: 0.2, verificacion: 0.2 }],
    }));
    const blob = await generarPlanPdf({ eventos, periodo: 'Año 2027', generado: '23/10/2026', filtros: 'Datos simulados para comprobar paginación' });
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  }, equipo);
  await fs.writeFile('test-results/soporte/plan-multipagina.pdf', Buffer.from(multipagina));
  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  await page.getByText('0001-11-001', { exact: true }).first().click();
  await expect(page.getByRole('dialog')).toContainText('Doble rango');
  await expect(page.getByRole('dialog')).toContainText('Capacidad máxima');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.impeccable/review/soporte-mobile.png', fullPage: true });
  await page.getByRole('dialog').getByText('Capacidad máxima', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.impeccable/review/soporte-mobile-rangos.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});
