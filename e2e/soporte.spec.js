import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';

test.setTimeout(60000);
test.use({ actionTimeout: 30000 });

async function preparar(page, { proximos = false, jefe = false, configuracion = false } = {}) {
  const token = Buffer.from(JSON.stringify({ exp: 4102444800, id: 1, acceso_cron: 1 })).toString('base64url');
  await page.addInitScript(({ token, proximos, configuracion }) => {
    // Verifica la descarga en Chromium sin abrir el selector nativo del SO.
    window.showSaveFilePicker = undefined;
    if (sessionStorage.getItem('soporte-qa')) return;
    sessionStorage.setItem('soporte-qa', '1');
    localStorage.clear();
    localStorage.setItem('rimmet_token', `header.${token}.signature`);
    localStorage.setItem('rimmet_user', JSON.stringify({ id: 1, usuario: 'qa', nombre: 'Usuario', apellido: 'QA', area: 'Soporte Técnico', cargo: 'Técnico', acceso_cron: 1 }));
    localStorage.setItem('rimmet_last_view', 'soporte');
    localStorage.setItem('rimmet_soporte_pestana', configuracion ? 'configuracion' : proximos ? 'proximos' : 'informes');
    if (!proximos && !configuracion) localStorage.setItem('rimmet_soporte_informe', JSON.stringify({ tipo: 'MPR', codigo: 'ST-001' }));
  }, { token, proximos, configuracion });
  const estado = { jefe, redaccion: null, estado: 'BORRADOR', validacion: 'BORRADOR', version: 1, revision: 0,
    documentos: [], fallarGuardado: 0, configVersion: 1, aprobadores: [] };
  const fuente = { otst: '26-0001-S01', cod_metrica: '0001-11-001', cliente: 'Cliente de prueba', planta: 'Planta de prueba',
    personal: 'Técnico QA', fecha_servicio: '2026-10-23', tipo_equipo: 'Balanza de plataforma', marca: 'Métrica', modelo: 'P300',
    serie: 'QA-123', cap_max1: 150, cap_max2: 300, d1: 0.05, d2: 0.1, e1: 0.05, e2: 0.1, unidades: 'kg', comentario_general: 'se verifico la plataforma' };
  const informe = () => ({ tipo: 'MPR', codigo: 'ST-001', numero: '26-0001-S01-001', tipoLabel: 'Mantenimiento preventivo regular',
    fuente, datos: {}, estado: estado.estado, version: estado.version, revision: estado.revision,
    columnas: Object.fromEntries(Object.entries(fuente).map(([k, v]) => [k, { tipo: typeof v === 'number' ? 'decimal' : 'texto', max: 4000 }])),
    acciones: { editar: true, aprobar: estado.jefe, redaccion: true }, fotos: [], historial: [], revisiones: [], trazabilidad: {},
    validacion: { estado: estado.validacion, observacion: estado.observacion, resueltaPor: estado.validacion === 'APROBADO' ? { nombre: 'Jefe QA' } : null },
    revisionAbierta: estado.estado === 'EN_REVISION' ? { revision: estado.revision + 1, motivo: 'Corrección solicitada por el cliente' } : null });
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
    if (path.endsWith('/soporte/permisos')) return json({ editar: true, aprobar: estado.jefe, configurarAprobadores: estado.jefe });
    if (path.endsWith('/configuracion/aprobadores')) {
      if (request.method() === 'PUT') {
        if (estado.errorConfig) return route.fulfill({ status: 409, json: { message: 'La configuración cambió. Recárguela antes de guardar.' } });
        estado.aprobadores = body.aprobadores; estado.configVersion++;
      }
      return json({ version: estado.configVersion, aprobadores: estado.aprobadores, personal: [
        { id: 1, nombre: 'Jefe QA', cargo: 'Jefe de Area', esJefe: true, autorizado: true },
        { id: 2, nombre: 'Ana QA', cargo: 'Técnico', esJefe: false, autorizado: estado.aprobadores.includes(2) },
        { id: 3, nombre: 'Luis QA', cargo: 'Técnico', esJefe: false, autorizado: estado.aprobadores.includes(3) },
      ] });
    }
    if (path.endsWith('/soporte/documentos/carpetas')) {
      if (estado.errorCarpetas) return route.fulfill({ status: 503, json: { message: 'La carpeta del archivo de Soporte no está disponible en el servidor.' } });
      const carpeta = url.searchParams.get('carpeta') || '';
      const arbol = { '': ['Clientes', 'Gestiones'], Clientes: ['Cliente QA'], 'Clientes/Cliente QA': ['2026', '2027'], 'Clientes/Cliente QA/2026': [] };
      return json({ nombreRaiz: 'SOPORTE TECNICO', carpeta, carpetas: (arbol[carpeta] || []).map(nombre => ({ nombre, ruta: carpeta ? `${carpeta}/${nombre}` : nombre })) });
    }
    if (path.endsWith('/ST-001/documentos')) {
      if (request.method() === 'GET') return json({ configurado: true, nombreRaiz: 'SOPORTE TECNICO', documentos: estado.documentos });
      const bytes = request.postDataBuffer();
      expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
      expect(request.headers().authorization).toContain('Bearer ');
      if (estado.fallarGuardado > 0) {
        estado.primerPdf = bytes;
        estado.fallarGuardado--;
        return route.fulfill({ status: 503, json: { message: 'El PDF se escribió, pero no se pudo confirmar su registro. Reintente con la misma carpeta y nombre para completar el guardado.' } });
      }
      if (estado.primerPdf) expect(bytes.equals(estado.primerPdf)).toBe(true);
      estado.pdf = bytes;
      const doc = { id: '11111111-1111-4111-8111-111111111111', nombre: url.searchParams.get('nombre'), carpeta: url.searchParams.get('carpeta'),
        revision: Number(url.searchParams.get('revision')), borrador: url.searchParams.get('borrador') === 'true', version: Number(url.searchParams.get('version')),
        guardadoPor: { usuario: 'qa', nombre: 'Técnico QA' }, guardadoEn: '2026-10-23T15:00:00Z', bytes: bytes.length };
      estado.documentos.push(doc);
      return json(doc);
    }
    if (path.includes('/soporte/documentos/') && path.endsWith('/pdf')) {
      if (estado.errorPdf) return route.fulfill({ status: 404, json: { message: 'La carpeta o el PDF ya no están disponibles en el servidor.' } });
      return route.fulfill({ contentType: 'application/pdf', body: estado.pdf });
    }
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
    else if (path.endsWith('/ST-001/reemision')) { estado.estado = 'EMITIDO'; estado.revision++; }
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
  for (const name of ['Guardar PDF', 'Descargar copia', 'Imprimir']) await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Configuración', exact: true })).toHaveCount(0);
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
  await expect(page.getByRole('button', { name: 'Guardar PDF', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Aprobar informe', exact: true })).toHaveCount(0);
  estado.jefe = true;
  await page.reload();
  await page.getByRole('button', { name: 'Aprobar informe', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Emitir informe/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar PDF', exact: true })).toBeDisabled();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '.impeccable/review/soporte-desktop.png', fullPage: true });
  await page.getByRole('region', { name: 'Validación del informe', exact: true }).screenshot({ path: '.impeccable/review/validacion-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('region', { name: 'Validación del informe', exact: true }).screenshot({ path: '.impeccable/review/validacion-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: /^Emitir informe/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Emitir informe', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Abrir revisión', exact: true })).toBeVisible();
  const selector = page.getByRole('dialog');
  await expect(selector.getByRole('button', { name: 'Abrir carpeta Clientes', exact: true })).toBeVisible();
  await expect(page.getByText('26-0001-S01-001 quedó emitido.', { exact: true })).toHaveCount(0);
  await selector.screenshot({ path: '.impeccable/review/emision-destino-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await selector.screenshot({ path: '.impeccable/review/emision-destino-mobile.png' });
  await selector.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(selector).toBeHidden();
  await expect(page.getByText('PDF pendiente de guardar.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar PDF', exact: true })).toBeEnabled();
  expect(estado.estado).toBe('EMITIDO');
});

test('el técnico elige la carpeta en cada guardado, reintenta y abre el PDF archivado', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const estado = await preparar(page);
  estado.estado = 'EMITIDO';
  estado.validacion = 'APROBADO';
  estado.fallarGuardado = 1;
  await page.goto('/');
  await page.getByRole('button', { name: 'Guardar PDF', exact: true }).click();
  const modal = page.getByRole('dialog');
  await expect(modal.getByRole('button', { name: 'Abrir carpeta Clientes', exact: true })).toBeVisible();
  await modal.getByRole('button', { name: 'Abrir carpeta Clientes', exact: true }).click();
  await modal.getByRole('button', { name: 'Abrir carpeta Cliente QA', exact: true }).click();
  await modal.getByRole('button', { name: 'Abrir carpeta 2026', exact: true }).click();
  await expect(modal).toContainText('Esta carpeta no tiene subcarpetas');
  await modal.getByLabel('Nombre del archivo', { exact: true }).fill('Informe cliente - Rev0.pdf');
  await page.evaluate(() => window.scrollTo(0, 0));
  await modal.screenshot({ path: '.impeccable/review/pdf-selector-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await modal.screenshot({ path: '.impeccable/review/pdf-selector-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await modal.getByRole('button', { name: 'Guardar aquí', exact: true }).click();
  await expect(modal.getByRole('alert')).toContainText('no se pudo confirmar su registro', { timeout: 30000 });
  await modal.getByRole('button', { name: 'Guardar aquí', exact: true }).click();
  await expect(modal).toBeHidden({ timeout: 30000 });
  expect(estado.documentos).toHaveLength(1);
  expect(estado.documentos[0]).toMatchObject({ carpeta: 'Clientes/Cliente QA/2026', nombre: 'Informe cliente - Rev0.pdf', borrador: false, revision: 0 });
  const documentos = page.getByRole('region', { name: 'PDF guardados', exact: true });
  await expect(documentos).toContainText('Informe cliente - Rev0.pdf');
  await documentos.screenshot({ path: '.impeccable/review/pdf-guardados-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await documentos.screenshot({ path: '.impeccable/review/pdf-guardados-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await documentos.getByRole('button', { name: 'Abrir PDF', exact: true }).click();
  const paginaPdf = page.getByRole('img', { name: /^Página 1 de \d+ de Informe cliente - Rev0.pdf$/ });
  await expect(paginaPdf).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
  expect(await paginaPdf.evaluate(canvas => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    return pixels.some((value, i) => i % 4 !== 3 && value < 200);
  })).toBe(true);
  await page.getByRole('dialog').screenshot({ path: '.impeccable/review/pdf-visor-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(paginaPdf).toHaveAttribute('data-ready', 'true');
  await page.getByRole('dialog').screenshot({ path: '.impeccable/review/pdf-visor-mobile.png' });
  await page.getByRole('button', { name: 'Cerrar ficha', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  // Cada guardado vuelve a ofrecer la elección, sin fijar el cliente anterior.
  await page.getByRole('button', { name: 'Guardar PDF', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Abrir carpeta Clientes', exact: true })).toBeVisible();
});

test('el selector permite recuperar una carpeta no disponible y el visor explica un PDF ausente', async ({ page }) => {
  const estado = await preparar(page);
  estado.estado = 'EMITIDO'; estado.validacion = 'APROBADO';
  estado.errorCarpetas = true;
  await page.goto('/');
  await page.getByRole('button', { name: 'Guardar PDF', exact: true }).click();
  const modal = page.getByRole('dialog');
  await expect(modal.getByRole('alert')).toContainText('no está disponible');
  await expect(modal.getByRole('button', { name: 'Guardar aquí', exact: true })).toBeDisabled();
  estado.errorCarpetas = false;
  await modal.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await modal.getByLabel('Buscar carpeta').fill('inexistente');
  await expect(modal).toContainText('No hay carpetas con ese nombre.');
  await modal.getByLabel('Buscar carpeta').fill('');
  await expect(modal.getByRole('button', { name: 'Abrir carpeta Clientes', exact: true })).toBeVisible();
  await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(modal).toBeHidden();
  estado.documentos.push({ id: '11111111-1111-4111-8111-111111111111', nombre: 'Documento anterior.pdf', carpeta: 'Clientes', revision: 0, borrador: true, guardadoPor: { usuario: 'qa' } });
  estado.errorPdf = true;
  await page.reload();
  await page.getByRole('region', { name: 'PDF guardados', exact: true }).getByRole('button', { name: 'Abrir PDF', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('ya no están disponibles');
});

test('el jefe configura varios aprobadores, recarga un conflicto y revoca autorizaciones', async ({ page }) => {
  const estado = await preparar(page, { jefe: true, configuracion: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Aprobadores de informes' })).toBeVisible();
  const jefe = page.getByRole('checkbox', { name: /Jefe QA/ });
  await expect(jefe).toBeChecked(); await expect(jefe).toBeDisabled();
  await page.getByRole('checkbox', { name: /Ana QA/ }).check();
  await page.getByRole('checkbox', { name: /Luis QA/ }).check();
  await page.screenshot({ path: '.impeccable/review/aprobadores-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.impeccable/review/aprobadores-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await page.getByRole('button', { name: 'Guardar aprobadores', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Guardar aprobadores', exact: true })).toBeDisabled();
  expect(estado.aprobadores).toEqual([2, 3]);
  await page.reload();
  await expect(page.getByRole('checkbox', { name: /Ana QA/ })).toBeChecked();
  await page.getByRole('checkbox', { name: /Ana QA/ }).uncheck();
  estado.errorConfig = true;
  await page.getByRole('button', { name: 'Guardar aprobadores', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('La configuración cambió');
  estado.errorConfig = false;
  await page.getByRole('button', { name: 'Recargar configuración', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /Ana QA/ })).toBeChecked();
  await page.getByRole('checkbox', { name: /Ana QA/ }).uncheck();
  await page.getByRole('button', { name: 'Guardar aprobadores', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Guardar aprobadores', exact: true })).toBeDisabled();
  expect(estado.aprobadores).toEqual([3]);
});

test('reemisión abre el destino automáticamente y archiva la nueva revisión sin marca de borrador', async ({ page }) => {
  const estado = await preparar(page);
  estado.estado = 'EN_REVISION'; estado.validacion = 'APROBADO'; estado.version = 8;
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Guardar PDF', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: /^Reemitir · Rev/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reemitir informe', exact: true }).click();
  const modal = page.getByRole('dialog');
  await expect(modal.getByRole('button', { name: 'Abrir carpeta Clientes', exact: true })).toBeVisible();
  await modal.getByRole('button', { name: 'Guardar aquí', exact: true }).click();
  await expect(modal).toBeHidden({ timeout: 30000 });
  expect(estado.documentos).toHaveLength(1);
  expect(estado.documentos[0]).toMatchObject({ borrador: false, revision: 1, version: 9 });
  await expect(page.getByText('PDF pendiente de guardar.', { exact: true })).toHaveCount(0);
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
