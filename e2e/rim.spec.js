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
  etapa: 'recibido',
  anulacion: null,
  ...overrides,
});

const CAMPOS_EJECUCION = ['recepcionSt', 'fechaIngreso', 'tecnicoAsignado', 'fechaInicio', 'fechaInforme', 'fechaConclusion', 'nroCotizacion', 'nroInforme', 'nroFactura'];
const CAMPOS_ENTREGA = ['recibeNombre', 'entregaPor', 'fechaEntrega', 'lugarEntrega', 'observaciones'];
const TIPOS = { registro: 'Registro', avance: 'Avance', correccion: 'Corrección', anulacion: 'Anulación' };

/**
 * Ejecución y entrega simuladas: cada envío agrega una versión, como el
 * servidor (las anteriores no cambian).
 */
function seguimientoSimulado({ puedeCorregir = true } = {}) {
  const ejecucion = [];
  const entregas = [];
  const version = (tipo, body, campos, anterior) => ({
    id: ejecucion.length + entregas.length + 1,
    tipo,
    tipoLabel: TIPOS[tipo],
    motivo: body.motivo || null,
    usuario: 'qa',
    usuarioNombre: 'Usuario QA',
    registradoEn: '2026-10-19T10:00:00-04:00',
    datos: tipo === 'anulacion' ? null : Object.fromEntries(campos.map(campo => [campo, body[campo] ?? null])),
    cambios: campos
      // Como el servidor: la entrega solo detalla los cambios de una corrección.
      .filter(campo => (campos === CAMPOS_EJECUCION || tipo === 'correccion') && (anterior?.datos?.[campo] ?? null) !== (body[campo] ?? null))
      .map(campo => ({ campo, antes: anterior?.datos?.[campo] ?? null, despues: body[campo] ?? null })),
  });
  return {
    registrarEjecucion(body) {
      const anterior = ejecucion.at(-1);
      let tipo = 'registro';
      if (anterior) tipo = body.motivo ? 'correccion' : 'avance';
      ejecucion.push(version(tipo, body, CAMPOS_EJECUCION, anterior));
    },
    registrarEntrega(body) {
      const anterior = entregas.at(-1);
      entregas.push({
        ...version(body.accion, body, CAMPOS_ENTREGA, anterior),
        firmas: body.accion === 'registro'
          ? { cliente: body.firmaCliente, representante: body.firmaRepresentante }
          : anterior?.firmas,
      });
    },
    get etapa() {
      const entrega = entregas.at(-1);
      if (entrega && entrega.tipo !== 'anulacion') return 'entregado';
      const vigente = ejecucion.at(-1);
      if (vigente?.datos.fechaConclusion) return 'concluido';
      return vigente ? 'en_ejecucion' : 'recibido';
    },
    get detalle() {
      const vigente = ejecucion.at(-1) || null;
      const ultima = entregas.at(-1) || null;
      const entregaVigente = ultima && ultima.tipo !== 'anulacion' ? ultima : null;
      return {
        disponible: true,
        mensaje: null,
        etapa: this.etapa,
        ejecucion: { vigente, historial: [...ejecucion].reverse() },
        entrega: { vigente: entregaVigente, ultimaId: ultima?.id ?? null, historial: [...entregas].reverse() },
        acciones: {
          registrarEjecucion: !vigente,
          completarEjecucion: Boolean(vigente),
          corregirEjecucion: Boolean(vigente) && puedeCorregir,
          registrarEntrega: !entregaVigente,
          corregirEntrega: Boolean(entregaVigente) && puedeCorregir,
          anularEntrega: Boolean(entregaVigente) && puedeCorregir,
        },
      };
    },
  };
}

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
async function mockRimApi(page, { puedeCorregir = true } = {}) {
  const requests = [];
  let anulado = false;
  const seguimiento = seguimientoSimulado({ puedeCorregir });
  const ficha = () => detalle({
    etapa: seguimiento.etapa,
    seguimiento: seguimiento.detalle,
    ...(anulado ? { estado: 'anulado', anulacion, acciones: { anular: false } } : {}),
  });
  // Solo la API: los módulos de Vite (…/rim/api/rim.js) pasan sin tocar.
  const esApi = (url) => url.pathname.startsWith('/api/rim/') || url.pathname === '/api/calendar/tecnicos';
  await page.route(esApi, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push({ method: request.method(), path: url.pathname, params: Object.fromEntries(url.searchParams), body: request.postDataJSON?.() ?? null });
    const json = (data) => route.fulfill({ json: { success: true, data } });

    if (url.pathname.endsWith('/rim/registros/filtros')) {
      return json({
        clientes: [{ codigo: '0103', nombre: 'EMBOL' }, { codigo: '0205', nombre: 'SOBOCE' }],
        plantas: [{ codigo: '0103-11', nombre: 'Planta Río Seco', cliente: '0103' }],
      });
    }
    if (url.pathname.endsWith('/rim/registros/15/anulacion') && request.method() === 'POST') {
      anulado = true;
      return json(ficha());
    }
    if (url.pathname.endsWith('/rim/registros/15/ejecucion') && request.method() === 'POST') {
      seguimiento.registrarEjecucion(request.postDataJSON());
      return json(ficha());
    }
    if (url.pathname.endsWith('/rim/registros/15/entrega') && request.method() === 'POST') {
      seguimiento.registrarEntrega(request.postDataJSON());
      return json(ficha());
    }
    if (url.pathname.endsWith('/rim/registros/15')) return json(ficha());
    if (url.pathname.endsWith('/rim/registros')) {
      const params = url.searchParams;
      const todos = [
        fila({ etapa: seguimiento.etapa, ...(anulado ? { estado: 'anulado', anulacion } : {}) }),
        fila({
          n: 3, codigo: 'RIM-0103-11-26', formatoAnterior: true, gestion: null, numero: null, area: 'calibracion',
          areaLabel: 'Calibración', etapa: 'concluido', cliente: { codigo: '0205', nombre: 'SOBOCE' },
        }),
      ].filter(item => !params.get('cliente') || item.cliente.codigo === params.get('cliente'));
      const items = todos
        .filter(item => !params.get('estado') || item.estado === params.get('estado'))
        .filter(item => !params.get('etapa') || item.etapa === params.get('etapa'));
      // Como el servidor: los conteos de los chips ignoran la situación elegida.
      const vigentes = todos.filter(item => item.estado === 'vigente');
      return json({
        items, total: items.length, page: 1, pageSize: 25,
        resumen: {
          total: todos.length,
          vigentes: vigentes.length,
          anulados: todos.length - vigentes.length,
          etapas: Object.fromEntries(['recibido', 'en_ejecucion', 'concluido', 'entregado']
            .map(etapa => [etapa, vigentes.filter(item => item.etapa === etapa).length])),
        },
      });
    }
    if (url.pathname.endsWith('/rim/talonarios')) return json(talonarios);
    if (url.pathname.endsWith('/calendar/tecnicos')) return json([]);
    return route.fulfill({ status: 404, json: { success: false, message: 'Sin simular' } });
  });
  return requests;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ token }) => {
    if (sessionStorage.getItem('rim-spec-ready')) return;
    sessionStorage.setItem('rim-spec-ready', '1');
    localStorage.clear();
    localStorage.setItem('datamet_token', token);
    localStorage.setItem('datamet_user', JSON.stringify({ id: 1, usuario: 'qa', nombre: 'Usuario', apellido: 'QA', cargo: 'Jefe de Área', acceso_cron: 1 }));
    localStorage.setItem('datamet_last_view', 'rim');
    localStorage.setItem('datamet_rim_tab', 'registros');
  }, { token: `header.${tokenPayload}.signature` });
});

test('el historial lista los RIM y los filtros quedan en un panel aparte', async ({ page }) => {
  const requests = await mockRimApi(page);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/');

  const tabla = page.getByRole('table', { name: /RIM registrados/ });
  await expect(tabla.getByText('RIM-26-0042')).toBeVisible();
  await expect(tabla.getByText('RIM-0103-11-26')).toBeVisible();
  await expect(tabla.getByText('N.º 3 · formato anterior')).toBeVisible();

  // Cliente, planta, área y fechas no están a la vista hasta abrir «Filtros».
  await expect(page.getByRole('combobox', { name: 'Cliente' })).toHaveCount(0);
  await page.getByRole('button', { name: /^Filtros/ }).click();
  await page.getByRole('combobox', { name: 'Cliente' }).click();
  await page.getByRole('option', { name: 'SOBOCE' }).click();
  await expect.poll(() => requests.some(request => request.path.endsWith('/rim/registros') && request.params.cliente === '0205')).toBe(true);
  await expect(tabla.getByText('RIM-26-0042')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Filtros/ })).toContainText('1');

  // Con el panel cerrado, el filtro aplicado se ve y se quita con un clic.
  await page.getByRole('button', { name: /^Filtros/ }).click();
  await page.getByRole('button', { name: 'Quitar el filtro SOBOCE' }).click();
  await expect(tabla.getByText('RIM-26-0042')).toBeVisible();

  // La búsqueda libre viaja al dejar de escribir.
  await page.getByRole('searchbox', { name: 'Buscar RIM' }).fill('B123');
  await expect.poll(() => requests.some(request => request.path.endsWith('/rim/registros') && request.params.q === 'B123')).toBe(true);
  await page.getByRole('button', { name: 'Quitar filtros' }).click();
  await expect(page.getByRole('searchbox', { name: 'Buscar RIM' })).toHaveValue('');
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

  await anular.getByRole('combobox', { name: 'Motivo' }).click();
  await page.getByRole('option', { name: 'Se registró el instrumento equivocado' }).click();
  await anular.getByLabel(/^Detalle/).fill('Era la balanza de despacho 2');
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

  await page.getByRole('navigation', { name: 'Módulos' }).getByRole('link', { name: 'Numeración' }).click();
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

/** Traza una firma en el recuadro indicado. */
async function firmar(page, dialogo, nombre) {
  const canvas = dialogo.getByRole('group', { name: nombre }).locator('canvas');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 30, box.y + 60);
  await page.mouse.down();
  await page.mouse.move(box.x + 140, box.y + 110, { steps: 8 });
  await page.mouse.move(box.x + 220, box.y + 70, { steps: 8 });
  await page.mouse.up();
}

test('la ficha registra la ejecución y la corrige con motivo, sin tocar el RIM', async ({ page }) => {
  const requests = await mockRimApi(page);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/');

  await page.getByRole('table', { name: /RIM registrados/ }).getByText('RIM-26-0042').click();
  const ficha = page.getByRole('dialog', { name: 'RIM-26-0042' });
  const ejecucion = ficha.getByRole('region', { name: 'Ejecución' });
  await expect(ficha.getByText('Recibido', { exact: true })).toBeVisible();
  await expect(ejecucion.getByText('Todavía no se registró la ejecución.')).toBeVisible();

  await ejecucion.getByRole('button', { name: 'Registrar' }).click();
  const registrar = page.getByRole('dialog', { name: 'Registrar ejecución de RIM-26-0042' });
  await registrar.getByRole('button', { name: 'Guardar' }).click();
  await expect(registrar.getByRole('alert')).toContainText('al menos un dato');
  await registrar.getByLabel('Recibió en S.T.').fill('Rosa Mamani');
  await registrar.getByLabel('Fecha de ingreso a S.T.').fill('2026-10-02');
  await registrar.getByLabel('Técnico asignado').fill('Luis Choque');
  await registrar.getByLabel('N.º de cotización').fill('COT-26-118');
  // Completar la primera vez no pide motivo.
  await expect(registrar.getByLabel('Motivo de la corrección')).toHaveCount(0);
  await registrar.getByRole('button', { name: 'Guardar' }).click();
  await expect(registrar).toBeHidden();

  const primera = requests.find(request => request.path.endsWith('/rim/registros/15/ejecucion'));
  expect(primera.body).toEqual({
    anteriorId: null, recepcionSt: 'Rosa Mamani', fechaIngreso: '2026-10-02', tecnicoAsignado: 'Luis Choque',
    fechaInicio: null, fechaInforme: null, fechaConclusion: null, nroCotizacion: 'COT-26-118', nroInforme: null,
    nroFactura: null, motivo: null,
  });
  await expect(ficha.getByText('En ejecución', { exact: true })).toBeVisible();
  await expect(ejecucion.getByText('02/10/2026')).toBeVisible();
  await expect(ejecucion.getByText(/Registrado por Usuario QA \(qa\)/)).toBeVisible();

  // Cambiar un dato ya registrado es una corrección: pide motivo.
  await ejecucion.getByRole('button', { name: 'Completar o corregir' }).click();
  const corregir = page.getByRole('dialog', { name: 'Ejecución de RIM-26-0042' });
  await expect(corregir.getByLabel('Técnico asignado')).toHaveValue('Luis Choque');
  await corregir.getByLabel('Técnico asignado').fill('Mario Flores');
  await corregir.getByLabel('Fecha de inicio').fill('2026-10-03');
  await expect(corregir.getByText(/Estás cambiando datos ya registrados \(Técnico asignado\)/)).toBeVisible();
  await corregir.getByRole('button', { name: 'Guardar' }).click();
  await expect(corregir.getByRole('alert')).toContainText('motivo de la corrección');
  await corregir.getByLabel('Motivo de la corrección').fill('Se reasignó por vacaciones del técnico');
  await corregir.getByRole('button', { name: 'Guardar' }).click();
  await expect(corregir).toBeHidden();

  const segunda = requests.filter(request => request.path.endsWith('/rim/registros/15/ejecucion'))[1];
  expect(segunda.body).toMatchObject({
    anteriorId: 1, tecnicoAsignado: 'Mario Flores', fechaInicio: '2026-10-03', motivo: 'Se reasignó por vacaciones del técnico',
  });

  // La versión anterior sigue en el historial, con el motivo.
  await ejecucion.getByRole('button', { name: /Historial \(2\)/ }).click();
  const historial = ejecucion.getByRole('list', { name: 'Historial de la ejecución' });
  await expect(historial.getByText('Corrección')).toBeVisible();
  await expect(historial.getByText('Motivo: Se reasignó por vacaciones del técnico')).toBeVisible();
  await expect(historial.locator('del', { hasText: 'Luis Choque' })).toBeVisible();

  // El RIM no se modificó: solo se agregaron versiones de la ejecución.
  expect(requests.filter(request => request.method !== 'GET').map(request => request.path))
    .toEqual(['/api/rim/registros/15/ejecucion', '/api/rim/registros/15/ejecucion']);
  await expect(ficha.getByRole('textbox')).toHaveCount(0);
});

test('la entrega exige las dos firmas en pantalla y se imprime con la ficha', async ({ page }) => {
  const requests = await mockRimApi(page);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/');

  await page.getByRole('table', { name: /RIM registrados/ }).getByText('RIM-26-0042').click();
  const ficha = page.getByRole('dialog', { name: 'RIM-26-0042' });
  const entrega = ficha.getByRole('region', { name: 'Entrega' });
  await expect(entrega.getByText('El instrumento todavía no se entregó.')).toBeVisible();

  await entrega.getByRole('button', { name: 'Registrar entrega' }).click();
  const registrar = page.getByRole('dialog', { name: 'Registrar entrega de RIM-26-0042' });
  // Propone a quien entregó en la recepción y el mismo lugar.
  await expect(registrar.getByLabel('Recibió (cliente)')).toHaveValue('Juan Pérez');
  await expect(registrar.getByLabel('Lugar de entrega')).toHaveValue('Planta Río Seco');
  await registrar.getByLabel('Entregó (Métrica)').fill('Ing. Ana Quispe');
  await registrar.getByLabel('Fecha de entrega').fill('2026-10-15');
  await registrar.getByRole('button', { name: 'Registrar entrega' }).click();
  await expect(registrar.getByRole('alert')).toContainText('Faltan las firmas');
  await expect(registrar.getByText('Falta la firma de quien recibe.')).toBeVisible();

  await firmar(page, registrar, 'Firma de quien recibe (cliente)');
  await firmar(page, registrar, 'Firma de quien entrega (Métrica)');
  await registrar.getByRole('button', { name: 'Registrar entrega' }).click();
  await expect(registrar).toBeHidden();

  const post = requests.find(request => request.path.endsWith('/rim/registros/15/entrega'));
  expect(post.body).toMatchObject({
    accion: 'registro', anteriorId: null, recibeNombre: 'Juan Pérez', entregaPor: 'Ing. Ana Quispe',
    fechaEntrega: '2026-10-15', lugarEntrega: 'Planta Río Seco', observaciones: null,
  });
  expect(post.body.firmaCliente).toMatch(/^data:image\/png;base64,/);
  expect(post.body.firmaRepresentante).toMatch(/^data:image\/png;base64,/);

  await expect(ficha.getByText('Entregado', { exact: true })).toBeVisible();
  await expect(entrega.getByAltText('Firma de quien recibe de Juan Pérez')).toBeVisible();
  await expect(entrega.getByAltText('Firma de quien entrega por Métrica de Ing. Ana Quispe')).toBeVisible();

  // Corregir la entrega conserva las firmas y pide el motivo.
  await entrega.getByRole('button', { name: 'Corregir' }).click();
  const corregir = page.getByRole('dialog', { name: 'Corregir entrega de RIM-26-0042' });
  await expect(corregir.locator('canvas')).toHaveCount(0);
  await corregir.getByLabel('Lugar de entrega').fill('Laboratorio Métrica');
  await corregir.getByLabel('Motivo de la corrección').fill('Se entregó en el laboratorio, no en planta');
  await corregir.getByRole('button', { name: 'Guardar corrección' }).click();
  await expect(corregir).toBeHidden();
  const correccion = requests.filter(request => request.path.endsWith('/rim/registros/15/entrega'))[1];
  expect(correccion.body).toEqual({
    accion: 'correccion', anteriorId: 1, recibeNombre: 'Juan Pérez', entregaPor: 'Ing. Ana Quispe',
    fechaEntrega: '2026-10-15', lugarEntrega: 'Laboratorio Métrica', observaciones: null,
    motivo: 'Se entregó en el laboratorio, no en planta',
  });
  await expect(entrega.getByAltText('Firma de quien recibe de Juan Pérez')).toBeVisible();

  // Al imprimir salen los datos, las firmas y el historial, sin botones.
  await page.evaluate(() => document.body.classList.add('rim-imprimiendo'));
  await page.emulateMedia({ media: 'print' });
  await expect(entrega.getByRole('list', { name: 'Historial de la entrega' })).toBeVisible();
  await expect(entrega.getByText('Motivo: Se entregó en el laboratorio, no en planta')).toBeVisible();
  await expect(entrega.getByRole('button', { name: 'Corregir' })).toBeHidden();
  await expect(entrega.getByRole('button', { name: /Historial/ })).toBeHidden();
});

test('un técnico completa los datos vacíos, pero no corrige ni anula', async ({ page }) => {
  await mockRimApi(page, { puedeCorregir: false });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/');

  await page.getByRole('table', { name: /RIM registrados/ }).getByText('RIM-26-0042').click();
  const ficha = page.getByRole('dialog', { name: 'RIM-26-0042' });
  const ejecucion = ficha.getByRole('region', { name: 'Ejecución' });
  await ejecucion.getByRole('button', { name: 'Registrar' }).click();
  const registrar = page.getByRole('dialog', { name: 'Registrar ejecución de RIM-26-0042' });
  await registrar.getByLabel('Recibió en S.T.').fill('Rosa Mamani');
  await registrar.getByRole('button', { name: 'Guardar' }).click();
  await expect(registrar).toBeHidden();

  await ejecucion.getByRole('button', { name: 'Completar', exact: true }).click();
  const completar = page.getByRole('dialog', { name: 'Ejecución de RIM-26-0042' });
  await expect(completar.getByLabel('Recibió en S.T.')).toBeDisabled();
  await expect(completar.getByLabel('Fecha de inicio')).toBeEnabled();
  await expect(completar.getByText(/solo los corrige un jefe de área/)).toBeVisible();
  await completar.getByRole('button', { name: 'Cancelar' }).click();

  const entrega = ficha.getByRole('region', { name: 'Entrega' });
  await expect(entrega.getByRole('button', { name: 'Registrar entrega' })).toBeVisible();
  await expect(entrega.getByRole('button', { name: 'Anular' })).toHaveCount(0);
});

test('el historial muestra la etapa de cada RIM y la filtra con los chips', async ({ page }) => {
  const requests = await mockRimApi(page);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/');

  const tabla = page.getByRole('table', { name: /RIM registrados/ });
  await expect(tabla.getByRole('row', { name: /RIM-0103-11-26/ }).getByText('Concluido')).toBeVisible();
  await expect(tabla.getByRole('row', { name: /RIM-26-0042/ }).getByText('Recibido')).toBeVisible();

  const situaciones = page.getByRole('group', { name: 'Filtrar por situación' });
  // Cada chip muestra cuántos hay; los vacíos no se pueden elegir.
  await expect(situaciones.getByRole('button', { name: /Concluidos/ })).toContainText('1');
  await expect(situaciones.getByRole('button', { name: /Anulados/ })).toBeDisabled();

  await situaciones.getByRole('button', { name: /Concluidos/ }).click();
  await expect.poll(() => requests.some(request => request.path.endsWith('/rim/registros')
    && request.params.etapa === 'concluido' && request.params.estado === 'vigente')).toBe(true);
  await expect(tabla.getByText('RIM-26-0042')).toHaveCount(0);
  await expect(tabla.getByText('RIM-0103-11-26')).toBeVisible();
  // El chip elegido conserva su conteo y se vuelve a tocar para quitarlo.
  await situaciones.getByRole('button', { name: /Concluidos/ }).click();
  await expect(tabla.getByText('RIM-26-0042')).toBeVisible();
});
