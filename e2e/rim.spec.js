import { expect, test } from '@playwright/test';

const tokenPayload = Buffer.from(JSON.stringify({
  exp: 4102444800,
  id: 1,
  usuario: 'qa',
  cargo: 'Jefe de Área',
  acceso_cron: 1,
})).toString('base64url');

// PNG de 1×1 píxel como firma.
const FIRMA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const fila = (overrides = {}) => ({
  n: 15,
  uuid: '3f2a8c1e-7b4d-4e9a-a1c2-5d6e7f8091ab',
  codigo: 'RIM-26-0042',
  formatoAnterior: false,
  gestion: 2026,
  numero: 42,
  origen: 'servicemet',
  origenLabel: 'ServiceMET',
  area: 'soporte',
  areaLabel: 'Soporte técnico',
  servicio: 'Mantenimiento correctivo',
  secaOtst: '26-0103-S01',
  cliente: { codigo: '0103', nombre: 'EMBOL' },
  planta: { codigo: '0103-11', nombre: 'Planta Río Seco' },
  instrumento: { codMetrica: '0103-11-005', tipo: 'Balanza de plataforma', marca: 'Mettler Toledo', modelo: 'IND570', serie: 'B123' },
  contacto: 'Juan Pérez',
  representanteMetrica: 'Ing. Ana Quispe',
  subidoPor: 'Ana Quispe',
  emitidoEn: '2026-10-01T18:30:00.000Z',
  estado: 'vigente',
  anulacion: null,
  ...overrides,
});

const detalle = (overrides = {}) => ({
  ...fila(),
  servicio: { tipo: 'soporte', nombre: 'Mantenimiento correctivo', secaOtst: '26-0103-S01', sessionId: '0007' },
  cliente: { codigo: '0103', nombre: 'EMBOL', razonSocial: 'EMBOL S.A.', nit: null },
  planta: { codigo: '0103-11', nombre: 'Planta Río Seco', direccion: 'Av. Juan Pablo II', departamento: 'LA PAZ' },
  instrumento: { ...fila().instrumento, capacidad: '600', division: '0.2', unidad: 'kg', ubicacion: 'Despacho', observaciones: null },
  motivo: 'El indicador no enciende; no se pudo concluir el mantenimiento.',
  inventario: { items: { indicator: 'present', powerCable: 'missing' }, cantidades: {}, otros: [], observaciones: null },
  estadoGeneral: 'fair',
  danos: { scratches: ['platform'] },
  descripcionDanos: null,
  nivelSuciedad: 'light',
  pruebas: { realizadas: false, descripcion: null },
  recepcion: {
    contactoNombre: 'Juan Pérez', contactoCargo: 'Jefe de planta', contactoTelefono: '70000000', contactoCorreo: null,
    representanteMetrica: 'Ing. Ana Quispe', lugar: 'Planta Río Seco', tecnicoAsignado: null,
  },
  firmas: { cliente: FIRMA, representante: FIRMA },
  fotos: [],
  trazabilidad: {
    uuid: '3f2a8c1e-7b4d-4e9a-a1c2-5d6e7f8091ab', emitidoEn: '2026-10-01T18:30:00.000Z', emitidoPor: 'aquispe',
    registradoEn: '2026-10-01T15:00:05-04:00', registradoPor: 'aquispe', registradoPorNombre: 'Ana Quispe',
    appVersion: '6.4.0+18', talonarioId: 7, instalacion: '9b2d7c41-5e3a-4f8b-9c6d-1a2b3c4d5e6f',
  },
  acciones: { anular: true },
  ...overrides,
});

const anulacion = {
  motivo: 'Se registró el instrumento equivocado. Era la balanza de despacho 2',
  anuladoEn: '2026-10-19T15:00:00.000Z',
  anuladoPor: 'qa',
  anuladoPorNombre: 'Usuario QA',
  origen: 'datametplus',
  origenLabel: 'DataMET+ (web)',
  reemplazadoPor: null,
};

const talonarios = {
  gestion: 2026,
  talonarios: [{
    id: 7, gestion: 2026, desde: 41, hasta: 50, rango: 'RIM-26-0041 a RIM-26-0050', origen: 'servicemet',
    origenLabel: 'ServiceMET', instalacion: '9b2d7c41-5e3a-4f8b-9c6d-1a2b3c4d5e6f', dispositivo: 'android 14',
    usuario: 'aquispe', usuarioNombre: 'Ana Quispe', appVersion: '6.4.0+18', entregadoEn: '2026-10-01T08:00:00-04:00',
    cierre: null, registrados: [41, 43], pendientes: [42], noUtilizados: [], disponibles: [44, 45, 46, 47, 48, 49, 50],
    estado: 'en_uso', acciones: { cerrar: true },
  }],
};

/** API simulada del apartado RIM; guarda las peticiones para revisarlas. */
async function mockRimApi(page) {
  const requests = [];
  let anulado = false;
  await page.route('**/api/rim/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push({ method: request.method(), path: url.pathname, params: Object.fromEntries(url.searchParams), body: request.postDataJSON?.() ?? null });
    const json = (data) => route.fulfill({ json: { success: true, data } });

    if (url.pathname.endsWith('/rim/registros/filtros')) {
      return json({ clientes: [{ codigo: '0103', nombre: 'EMBOL' }], plantas: [{ codigo: '0103-11', nombre: 'Planta Río Seco', cliente: '0103' }] });
    }
    if (url.pathname.endsWith('/rim/registros/15/anulacion') && request.method() === 'POST') {
      anulado = true;
      return json(detalle({ estado: 'anulado', anulacion, acciones: { anular: false } }));
    }
    if (url.pathname.endsWith('/rim/registros/15')) {
      return json(anulado ? detalle({ estado: 'anulado', anulacion, acciones: { anular: false } }) : detalle());
    }
    if (url.pathname.endsWith('/rim/registros')) {
      const items = [
        fila(anulado ? { estado: 'anulado', anulacion } : {}),
        fila({ n: 3, codigo: 'RIM-0103-11-26', formatoAnterior: true, gestion: null, numero: null, area: 'calibracion', areaLabel: 'Calibración' }),
      ].filter(item => !url.searchParams.get('estado') || item.estado === url.searchParams.get('estado'));
      return json({
        items, total: items.length, page: 1, pageSize: 25,
        resumen: { total: 2, vigentes: anulado ? 1 : 2, anulados: anulado ? 1 : 0 },
      });
    }
    if (url.pathname.endsWith('/rim/talonarios')) return json(talonarios);
    return route.fulfill({ status: 404, json: { success: false, message: 'Sin simular' } });
  });
  return requests;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ token }) => {
    if (sessionStorage.getItem('rim-spec-ready')) return;
    sessionStorage.setItem('rim-spec-ready', '1');
    localStorage.clear();
    localStorage.setItem('rimmet_token', token);
    localStorage.setItem('rimmet_user', JSON.stringify({ id: 1, usuario: 'qa', nombre: 'Usuario', apellido: 'QA', cargo: 'Jefe de Área', acceso_cron: 1 }));
    localStorage.setItem('rimmet_last_view', 'rim');
    localStorage.setItem('rimmet_rim_tab', 'registros');
  }, { token: `header.${tokenPayload}.signature` });
});

test('el historial lista los RIM y filtra por estado', async ({ page }) => {
  const requests = await mockRimApi(page);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/');

  const tabla = page.getByRole('table', { name: /RIM registrados/ });
  await expect(tabla.getByText('RIM-26-0042')).toBeVisible();
  await expect(tabla.getByText('RIM-0103-11-26')).toBeVisible();
  await expect(tabla.getByText('N.º 3 · formato anterior')).toBeVisible();

  await page.getByLabel('Estado').selectOption('anulado');
  await expect.poll(() => requests.some(request => request.path.endsWith('/rim/registros') && request.params.estado === 'anulado')).toBe(true);
  await expect(page.getByText('Ningún RIM coincide con los filtros')).toBeVisible();
});

test('la ficha es de solo lectura, muestra las dos firmas y anula con motivo', async ({ page }) => {
  const requests = await mockRimApi(page);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/');

  await page.getByRole('table', { name: /RIM registrados/ }).getByText('RIM-26-0042').click();
  const ficha = page.getByRole('dialog', { name: 'RIM-26-0042' });
  await expect(ficha.getByAltText('Firma del cliente de Juan Pérez')).toBeVisible();
  await expect(ficha.getByAltText('Firma del representante de Métrica de Ing. Ana Quispe')).toBeVisible();
  await expect(ficha.getByText('Cable de poder')).toBeVisible();
  // No hay nada que editar en la ficha.
  await expect(ficha.getByRole('textbox')).toHaveCount(0);

  await ficha.getByRole('button', { name: 'Anular RIM' }).click();
  const anular = page.getByRole('dialog', { name: 'Anular RIM-26-0042' });
  await anular.getByRole('button', { name: 'Anular RIM' }).click();
  await expect(anular.getByRole('alert')).toContainText('Elige un motivo');

  await anular.getByLabel('Motivo', { exact: true }).selectOption('Se registró el instrumento equivocado');
  await anular.getByLabel('Detalle (opcional)').fill('Era la balanza de despacho 2');
  await anular.getByRole('button', { name: 'Anular RIM' }).click();

  await expect(anular).toBeHidden();
  await expect(ficha.getByText('RIM anulado')).toBeVisible();
  await expect(ficha.getByRole('button', { name: 'Anular RIM' })).toHaveCount(0);
  const post = requests.find(request => request.method === 'POST');
  expect(post.path).toMatch(/\/rim\/registros\/15\/anulacion$/);
  expect(post.body).toEqual({
    motivo: 'Se registró el instrumento equivocado. Era la balanza de despacho 2',
    reemplazadoPor: null,
  });
});

test('la numeración explica qué pasó con cada número del talonario', async ({ page }) => {
  await mockRimApi(page);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/');

  await page.getByRole('group', { name: 'Apartado RIM' }).getByRole('button', { name: 'Numeración' }).click();
  await expect(page.getByText('RIM-26-0041 a RIM-26-0050')).toBeVisible();
  await expect(page.getByText('emitidos y por subir')).toBeVisible();
  await expect(page.getByText('0044–0050')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cerrar talonario' })).toBeVisible();
});

test('en el teléfono el historial se ve como lista sin desbordar', async ({ page }) => {
  await mockRimApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByRole('button', { name: /RIM-26-0042/ })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});
