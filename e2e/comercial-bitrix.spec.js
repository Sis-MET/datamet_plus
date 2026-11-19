import { expect, test } from '@playwright/test';

// Comercial, fase 2: la copia de Bitrix24. La API se simula como la responde
// el backend (con datos ficticios): situación de las negociaciones frente a
// las facturas, la factura que se propone desde una negociación, la
// sincronización y las equivalencias de responsables. Quien solo consulta no
// sincroniza, no factura ni confirma.

test.setTimeout(60000);

const token = (id) => `header.${Buffer.from(JSON.stringify({ exp: 4102444800, id, acceso_cron: 2 })).toString('base64url')}.signature`;
const COMERCIAL = { id: 4, usuario: 'comercial', nombre: 'Ana', apellido: 'Comercial', cargo: 'Auxiliar Comercial', area: 'Comercial', acceso_cron: 2 };
const ADMINISTRACION = { id: 5, usuario: 'contable', nombre: 'Rosa', apellido: 'Contable', cargo: 'Contadora', area: 'Administración', acceso_cron: 2 };
const PORTAL = 'https://b24-ejemplo.bitrix24.es';

const CATEGORIAS = [
  { id: 7, codigo: 'ST-STAC-DIAG', nombre: 'Diagnóstico (STAC)', area: 'ST', subarea: 'STAC', regla: 'NETO', comisiona: true, vigente: true, orden: 7 },
  { id: 9, codigo: 'ST-STAC-MPR', nombre: 'Mantenimiento preventivo regular (STAC)', area: 'ST', subarea: 'STAC', regla: 'NETO', comisiona: true, vigente: true, orden: 9 },
  { id: 19, codigo: 'CAL-BLZ', nombre: 'Calibración de balanzas', area: 'CAL', subarea: 'BALANZAS', regla: 'NETO', comisiona: false, vigente: true, orden: 19 },
];

const negociacion = (overrides) => ({
  embudoId: 21, embudo: 'Calibración', etapa: 'Para Facturar', fase: 'FACTURAR', situacion: 'por_facturar', moneda: 'BOB',
  responsableId: 41, responsable: 'Ana Comercial', empresa: 'CLIENTE DE EJEMPLO S.R.L.', empresaCodigo: '0999-11', cotizacion: null,
  regional: 'SCZ', modificada: '2026-11-18T19:30:00', facturas: [], ...overrides,
});

const NEGOCIACIONES = [
  negociacion({ dealId: 5120, titulo: 'Calibración de 6 balanzas, planta norte', monto: 3900.5, cotizacion: '0999-C02-26 1' }),
  negociacion({ dealId: 5077, titulo: 'Mantenimiento de básculas camioneras', embudoId: 1, embudo: 'Soporte Tecnico', etapa: 'Facturado', fase: 'COBRO',
    situacion: 'sin_registrar', monto: 2750, empresa: 'OTRA EMPRESA S.A.', empresaCodigo: '0888', regional: 'LPZ' }),
  negociacion({ dealId: 4980, titulo: 'Calibración anual de pesas', etapa: 'Para Facturar', situacion: 'etapa_desactualizada', monto: 1200,
    cotizacion: '0777-C01-26 1', facturas: [{ id: 101, numero: 594, gestion: 2026, monto: 1200, fecha: '2026-11-10', por: 'COTIZACION' }] }),
  negociacion({ dealId: 4870, titulo: 'Diagnóstico de indicador', embudoId: 1, embudo: 'Soporte Tecnico', etapa: 'Cerrado Ganado', fase: 'GANADA',
    situacion: 'con_factura', monto: 650, facturas: [{ id: 100, numero: 593, gestion: 2026, monto: 650, fecha: '2026-11-03', por: 'REFERENCIA' }] }),
];

const RESUMEN = {
  por_facturar: { negociaciones: 1, monto: 3900.5 },
  sin_registrar: { negociaciones: 1, monto: 2750 },
  etapa_desactualizada: { negociaciones: 1, monto: 1200 },
  con_factura: { negociaciones: 1, monto: 650 },
  sin_factura: { negociaciones: 0, monto: 0 },
};

const DETALLE_5077 = {
  ...NEGOCIACIONES[1], creada: '2026-10-01T13:00:00', sincronizada: '2026-11-19T13:45:00', empresaNit: '999', ciudad: 'La Paz',
  numBalanzas: 4, numPesas: null, subArea: 'STAC', tiposServicio: 'Diagnostico · Mant. Preventivo Regular', tecnico: 'Mario Peña', apoyo: 'Luisa Roca',
  notaSalida: null, ordenCompra: 'OC-2211', condiciones: null, mesFacturar: 'Noviembre', marcadaFacturada: true, cotizaciones: [],
  enlace: `${PORTAL}/crm/deal/details/5077/`,
  propuesta: {
    dealId: 5077,
    cliente: { codigo: '0888', razonSocial: 'OTRA EMPRESA S.A.', nit: '999' },
    razonSocial: 'OTRA EMPRESA S.A.', nit: '999', monto: 2750,
    lineas: [{ categoriaId: 7, categoria: 'Diagnóstico (STAC)', monto: null, cantidad: 4, regional: 'LPZ' }, { categoriaId: 9, categoria: 'Mantenimiento preventivo regular (STAC)', monto: null, cantidad: null, regional: 'LPZ' }],
    referencias: [{ tipo: 'BITRIX', valor: '5077' }],
    personas: [
      { rol: 'RESPONSABLE', usuarioId: 7, nombre: 'Ana Comercial', porcentaje: null },
      { rol: 'EJECUTO_ST', usuarioId: 30, nombre: 'Mario Peña', porcentaje: null },
      { rol: 'APOYO_ST', usuarioId: null, nombre: 'Luisa Roca', porcentaje: null },
    ],
    avisos: [{ codigo: 'repartir', texto: 'Reparte el monto de la negociación entre las líneas.' }],
  },
};

const USUARIOS = [
  { bitrixId: 41, nombreBitrix: 'Ana Comercial', usuarioId: 7, usuario: 'Ana Comercial', sugeridoId: 7, sugerido: 'Ana Comercial', sugerencia: null,
    confirmado: { usuario: 'comercial', fecha: '2026-11-18T14:00:00' }, negociaciones: 3 },
  { bitrixId: 52, nombreBitrix: 'Luis Rojas', usuarioId: null, usuario: null, sugeridoId: 8, sugerido: 'Luis Rojas',
    sugerencia: 'Responsable en 4 de 5 facturas de sus negociaciones', confirmado: null, negociaciones: 1 },
];

const VACIO = Object.fromEntries(Object.keys(RESUMEN).map(s => [s, { negociaciones: 0, monto: 0 }]));
// Texto visible: la tabla (escritorio) y la lista (teléfono) repiten cada negociación.
const visible = (page, texto) => page.getByText(texto).filter({ visible: true }).first();

const estadoBase = (overrides = {}) => ({
  configurado: true, errorConfiguracion: null, automatica: true, minutos: 15, desde: '2025-01-01', portal: PORTAL, enCurso: false, tablas: true,
  ultima: { id: 12, tipo: 'CAMBIOS', estado: 'OK', negociaciones: 3, empresas: 1, enlaces: 2, error: null, por: 'automática', inicio: '2026-11-19T13:45:00', fin: '2026-11-19T13:45:20' },
  ultimaCorrecta: { id: 12, tipo: 'CAMBIOS', estado: 'OK', negociaciones: 3, empresas: 1, enlaces: 2, error: null, por: 'automática', inicio: '2026-11-19T13:45:00', fin: '2026-11-19T13:45:20' },
  copia: { negociaciones: 4, facturas: 2, responsablesSinConfirmar: 1 },
  ...overrides,
});

async function preparar(page, { usuario = COMERCIAL, estado = estadoBase() } = {}) {
  await page.addInitScript(({ token, usuario }) => {
    if (sessionStorage.getItem('comercial-bitrix-qa')) return;
    sessionStorage.setItem('comercial-bitrix-qa', '1');
    localStorage.clear();
    localStorage.setItem('datamet_token', token);
    localStorage.setItem('datamet_user', JSON.stringify(usuario));
    localStorage.setItem('datamet_last_view', 'comercial');
  }, { token: token(usuario.id), usuario });
  const escrituras = [];
  const enviados = {};
  const errores = [];
  page.on('pageerror', error => errores.push(error.message));
  let sincronizando = 0;
  await page.route(url => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, '');
    const json = (data, status = 200) => route.fulfill({ status, json: { success: true, data } });
    if (request.method() !== 'GET') escrituras.push(`${request.method()} ${path}`);

    if (request.method() === 'POST' && path === '/comercial/bitrix/sincronizar') {
      enviados.sincronizacion = request.postDataJSON();
      sincronizando = 2;
      return json({ iniciada: true, enCurso: true }, 202);
    }
    if (request.method() === 'PUT' && path.startsWith('/comercial/bitrix/usuarios/')) {
      enviados.usuario = { bitrixId: Number(path.split('/').pop()), ...request.postDataJSON() };
      return json({ ...USUARIOS[1], usuarioId: enviados.usuario.usuarioId, usuario: 'Luis Rojas', confirmado: { usuario: 'comercial', fecha: '2026-11-19T14:00:00' } });
    }
    if (request.method() === 'POST' && path === '/comercial/facturas') {
      enviados.factura = request.postDataJSON();
      return json({ id: 102, numero: enviados.factura.numero }, 201);
    }
    if (path === '/comercial/bitrix/estado') {
      if (sincronizando > 1) {
        sincronizando -= 1;
        return json({ ...estado, enCurso: true });
      }
      if (sincronizando === 1) {
        sincronizando = 0;
        const nueva = { ...estado.ultima, id: 13, negociaciones: 9, enlaces: 3, por: 'comercial', inicio: '2026-11-19T13:59:00', fin: '2026-11-19T13:59:30' };
        return json({ ...estado, ultima: nueva, ultimaCorrecta: nueva });
      }
      return json(estado);
    }
    if (path === '/comercial/bitrix/negociaciones') {
      const situacion = url.searchParams.get('situacion');
      const items = estado.copia?.negociaciones ? NEGOCIACIONES.filter(n => !situacion || n.situacion === situacion) : [];
      return json({ items, total: items.length, page: 1, pageSize: 25, resumen: { situaciones: estado.copia?.negociaciones ? RESUMEN : VACIO },
        embudos: [{ id: 21, nombre: 'Calibración', negociaciones: 2 }, { id: 1, nombre: 'Soporte Tecnico', negociaciones: 2 }] });
    }
    if (path === '/comercial/bitrix/negociaciones/5077') return json(DETALLE_5077);
    if (/^\/comercial\/bitrix\/negociaciones\/\d+$/.test(path)) {
      const neg = NEGOCIACIONES.find(n => String(n.dealId) === path.split('/').pop());
      return json({ ...DETALLE_5077, ...neg, cotizaciones: neg.cotizacion ? [neg.cotizacion] : [], enlace: `${PORTAL}/crm/deal/details/${neg.dealId}/` });
    }
    if (path === '/comercial/bitrix/usuarios') return json(USUARIOS);
    if (path === '/sistema/permisos/mios') return json({ permisos: [], gestionar: false });
    if (path === '/comercial/categorias') return json(CATEGORIAS);
    if (path === '/comercial/personal') return json([{ id: 7, nombre: 'Ana Comercial', area: 'Comercial' }, { id: 8, nombre: 'Luis Rojas', area: 'Comercial' }, { id: 30, nombre: 'Mario Peña', area: 'Soporte Técnico' }]);
    if (path === '/comercial/facturas/siguiente') return json({ gestion: 2026, numero: 595 });
    if (path === '/comercial/facturas/102') {
      return json({
        id: 102, numero: 595, gestion: 2026, tipo: 'SERVICIO', fechaEmision: '2026-11-19', razonSocial: 'OTRA EMPRESA S.A.', nit: '999', clienteCodigo: '0888',
        monto: 2750, pagado: 0, saldo: 2750, estado: 'pendiente', vence: '2026-11-19', diasEmision: 0, diasMora: 0, tramo: null, origen: 'MANUAL', origenRef: null,
        observacion: null, plazoDias: null, cliente: { codigo: '0888', razonSocial: 'OTRA EMPRESA S.A.' }, anulacion: null,
        creado: { usuario: 'comercial', nombre: 'Ana Comercial', fecha: '2026-11-19T14:00:00' }, lineas: [], referencias: [{ id: 1, tipo: 'BITRIX', valor: '5077' }],
        personas: [], pagos: [], historial: [], negociaciones: [{ dealId: 5077, titulo: NEGOCIACIONES[1].titulo, embudo: 'Soporte Tecnico', etapa: 'Facturado', fase: 'COBRO', monto: 2750, por: 'REFERENCIA', enlace: `${PORTAL}/crm/deal/details/5077/` }],
      });
    }
    return route.fulfill({ status: 403, json: { success: false, code: 'AREA_ACCESS_DENIED', message: 'Sin acceso en la prueba.' } });
  });
  return { escrituras, enviados, errores };
}

test('Comercial factura una negociación de Bitrix24 con sus datos ya puestos', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { enviados } = await preparar(page);
  await page.goto('/comercial/bitrix');

  await expect(page.getByRole('navigation', { name: 'Módulos' }).getByRole('link', { name: 'Bitrix24', exact: true })).toBeVisible({ timeout: 30000 });
  await expect(visible(page, 'Calibración de 6 balanzas, planta norte')).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('status').filter({ hasText: 'Sincronizada' })).toBeVisible();
  const situaciones = page.getByRole('group', { name: 'Filtrar por situación' });
  await expect(situaciones.getByRole('button', { name: /Facturada sin registrar/ })).toBeVisible();
  await expect(situaciones.getByRole('button', { name: /Sin facturar/ })).toBeDisabled();
  await page.screenshot({ path: '.impeccable/review/comercial-bitrix-desktop.png', fullPage: true });

  // Filtra por situación: se pide al servidor.
  const filtrada = page.waitForRequest(req => req.url().includes('/comercial/bitrix/negociaciones?') && req.url().includes('situacion=sin_registrar'));
  await situaciones.getByRole('button', { name: /Facturada sin registrar/ }).click();
  await filtrada;
  await expect(page.getByText('Calibración de 6 balanzas, planta norte')).toHaveCount(0);

  // Ficha de la negociación: datos del CRM, enlace al portal y avisos.
  await visible(page, 'Mantenimiento de básculas camioneras').click();
  const ficha = page.getByRole('dialog', { name: 'Mantenimiento de básculas camioneras' });
  await expect(ficha.getByText('#5077 · Soporte Tecnico › Facturado')).toBeVisible();
  await expect(ficha.getByRole('link', { name: 'Abrir en Bitrix24' })).toHaveAttribute('href', `${PORTAL}/crm/deal/details/5077/`);
  await expect(ficha.getByText('Reparte el monto de la negociación entre las líneas.')).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/comercial-bitrix-negociacion.png' });
  await ficha.getByRole('button', { name: 'Registrar su factura' }).click();

  // La factura nueva llega con cliente, monto, líneas, responsable y técnicos.
  const nueva = page.getByRole('dialog', { name: 'Nueva factura' });
  await expect(nueva.getByText('Desde la negociación #5077 de Bitrix24')).toBeVisible();
  await expect(nueva.getByText('OTRA EMPRESA S.A.').first()).toBeVisible();
  await expect(nueva.getByLabel('Monto (Bs)')).toHaveValue('2750,00');
  await expect(nueva.getByLabel('N.º de factura')).toHaveValue('595');
  await expect(nueva.getByRole('list', { name: 'Técnicos de la negociación' }).getByText('Mario Peña')).toBeVisible();
  await expect(nueva.getByText('Faltan Bs 2.750,00 por repartir.')).toBeVisible();
  await nueva.getByLabel('Monto de la línea 1').fill('1000');
  await nueva.getByLabel('Monto de la línea 2').fill('1750');
  await expect(nueva.getByText('Las líneas suman el monto de la factura.')).toBeVisible();
  // Al cuadrar, el aviso de repartir desaparece.
  await expect(nueva.getByText('Reparte el monto de la negociación entre las líneas.')).toHaveCount(0);
  await page.screenshot({ path: '.impeccable/review/comercial-bitrix-factura.png' });
  await nueva.getByRole('button', { name: 'Registrar factura' }).click();

  await expect.poll(() => enviados.factura).toBeTruthy();
  expect(enviados.factura).toMatchObject({ numero: 595, clienteCodigo: '0888', razonSocial: 'OTRA EMPRESA S.A.', nit: '999', monto: 2750 });
  expect(enviados.factura.lineas).toEqual([
    { categoriaId: 7, monto: 1000, cantidad: 4, regional: 'LPZ' },
    { categoriaId: 9, monto: 1750, cantidad: null, regional: 'LPZ' },
  ]);
  expect(enviados.factura.referencias).toEqual([{ tipo: 'BITRIX', valor: '5077' }]);
  expect(enviados.factura.personas.map(p => [p.rol, p.usuarioId, p.nombre])).toEqual([
    ['RESPONSABLE', 7, 'Ana Comercial'], ['EJECUTO_ST', 30, 'Mario Peña'], ['APOYO_ST', null, 'Luisa Roca'],
  ]);
  // Se abre la factura registrada, con su negociación enlazada.
  const factura = page.getByRole('dialog', { name: 'Factura N.º 595' });
  await expect(factura.getByRole('link', { name: 'Abrir la negociación 5077 en Bitrix24' })).toBeVisible();
});

test('Sincronizar ahora y confirmar el responsable sugerido', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { enviados } = await preparar(page);
  await page.goto('/comercial/bitrix');

  await page.getByRole('button', { name: 'Sincronizar ahora' }).click({ timeout: 30000 });
  await expect(page.getByRole('status').filter({ hasText: 'Sincronizando…' })).toBeVisible();
  await expect(page.getByText('Sincronizado: 9 negociaciones y 3 enlaces con facturas.')).toBeVisible({ timeout: 15000 });
  expect(enviados.sincronizacion).toEqual({ completa: false });

  await page.getByRole('group', { name: 'Vista de Bitrix24' }).getByRole('button', { name: /Responsables/ }).click();
  const responsables = page.getByRole('region', { name: 'Responsables de Bitrix24' });
  await expect(responsables.getByText('Responsable en 4 de 5 facturas de sus negociaciones', { exact: false })).toBeVisible();
  // La persona sugerida ya viene elegida; falta confirmarla.
  await expect(responsables.getByRole('combobox', { name: 'Persona de DataMET+ de Luis Rojas' })).toContainText('Luis Rojas');
  await page.screenshot({ path: '.impeccable/review/comercial-bitrix-responsables.png' });
  await responsables.getByRole('button', { name: 'Confirmar' }).click();
  await expect.poll(() => enviados.usuario).toEqual({ bitrixId: 52, usuarioId: 8 });
});

test('Sin webhook: la guía para conectarlo y nada que sincronizar', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 900 });
  const { escrituras, errores } = await preparar(page, {
    estado: estadoBase({ configurado: false, automatica: false, portal: null, ultima: null, ultimaCorrecta: null, copia: { negociaciones: 0, facturas: 0, responsablesSinConfirmar: 0 } }),
  });
  await page.goto('/comercial/bitrix');
  await expect(page.getByRole('heading', { name: 'Conecta Bitrix24 con un webhook de Comercial' })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('BITRIX_WEBHOOK_URL', { exact: false })).toBeVisible();
  // Sin nada copiado no hay filtros ni cifras en cero, ni nada que sincronizar.
  await expect(page.getByRole('searchbox', { name: 'Buscar negociaciones' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sincronizar ahora' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await page.screenshot({ path: '.impeccable/review/comercial-bitrix-sin-webhook.png', fullPage: true });
  expect(escrituras).toEqual([]);
  expect(errores).toEqual([]);
});

test('Administración consulta Bitrix24 sin sincronizar ni facturar; sin desbordes', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 900 });
  const { escrituras, errores } = await preparar(page, { usuario: ADMINISTRACION });
  await page.goto('/comercial/bitrix');
  await expect(visible(page, 'Calibración de 6 balanzas, planta norte')).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: 'Sincronizar ahora' })).toHaveCount(0);
  const medidas = await page.evaluate(() => {
    const tabla = document.querySelector('table');
    return { tabla: tabla.scrollWidth - tabla.closest('.card').clientWidth, pagina: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  expect(medidas).toEqual({ tabla: 0, pagina: 0 });

  await visible(page, 'Mantenimiento de básculas camioneras').click();
  const ficha = page.getByRole('dialog', { name: 'Mantenimiento de básculas camioneras' });
  await expect(ficha.getByText('OC-2211')).toBeVisible();
  await expect(ficha.getByRole('button', { name: /Registrar/ })).toHaveCount(0);
  await ficha.getByRole('button', { name: 'Cerrar', exact: true }).click();

  await page.getByRole('group', { name: 'Vista de Bitrix24' }).getByRole('button', { name: /Responsables/ }).click();
  const responsables = page.getByRole('region', { name: 'Responsables de Bitrix24' });
  await expect(responsables.getByText('Luis Rojas').first()).toBeVisible();
  await expect(responsables.getByRole('button', { name: 'Confirmar' })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('group', { name: 'Vista de Bitrix24' }).getByRole('button', { name: /Negociaciones/ }).click();
  await expect(visible(page, 'Calibración de 6 balanzas, planta norte')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await page.screenshot({ path: '.impeccable/review/comercial-bitrix-movil.png', fullPage: true });
  expect(escrituras).toEqual([]);
  expect(errores).toEqual([]);
});
