import { expect, test } from '@playwright/test';

// Apartado Comercial (fase 1): facturas, cuentas por cobrar y pagos. La API
// se simula como la responde el backend; se comprueba lo que la pantalla
// envía al registrar una factura y un pago, y que quien solo consulta no
// escribe nada.

test.setTimeout(60000);

const token = (id, accesoCron = 2) => `header.${Buffer.from(JSON.stringify({ exp: 4102444800, id, acceso_cron: accesoCron })).toString('base64url')}.signature`;
const COMERCIAL = { id: 4, usuario: 'comercial', nombre: 'Ana', apellido: 'Comercial', cargo: 'Auxiliar Comercial', area: 'Comercial', acceso_cron: 2 };
const ADMINISTRACION = { id: 5, usuario: 'contable', nombre: 'Rosa', apellido: 'Contable', cargo: 'Contadora', area: 'Administración', acceso_cron: 2 };
const SISTEMAS = { id: 6, usuario: 'sistemas', nombre: 'Leo', apellido: 'Sistemas', cargo: 'Auxiliar de Sistemas', area: 'Administración', acceso_cron: 3 };

const CATEGORIAS = [
  { id: 3, codigo: 'ST-STIL-MPR', nombre: 'Mantenimiento preventivo (STIL)', area: 'ST', subarea: 'STIL', regla: 'NETO', comisiona: true, vigente: true, orden: 3 },
  { id: 14, codigo: 'ST-LOG', nombre: 'Logística (ST)', area: 'ST', subarea: 'LOGISTICA', regla: 'LOGISTICA', comisiona: false, vigente: true, orden: 14 },
  { id: 19, codigo: 'CAL-BLZ', nombre: 'Calibración de balanzas', area: 'CAL', subarea: 'BALANZAS', regla: 'NETO', comisiona: false, vigente: true, orden: 19 },
  { id: 25, codigo: 'VENT-PESAS-M', nombre: 'Pesas clase M', area: 'VENT', subarea: 'PESAS', regla: 'PRODUCTO', comisiona: true, vigente: true, orden: 25 },
];

const fila = (overrides) => ({
  gestion: 2026, tipo: 'SERVICIO', clienteCodigo: '0999', nit: '1234567', areas: ['ST'], origen: 'EXCEL',
  cotizaciones: [], responsables: ['Ana Comercial'], pagado: 0, vence: overrides.fechaEmision, diasEmision: 0, diasMora: 0, tramo: null, ...overrides,
});

const FACTURAS = [
  fila({ id: 101, numero: 594, fechaEmision: '2026-08-03', razonSocial: 'Cliente de Ejemplo S.R.L.', monto: 207120, saldo: 207120, estado: 'pendiente',
    areas: ['ST', 'VENT'], cotizaciones: ['0999-S03-1-26'], diasEmision: 107, diasMora: 107, tramo: 'mas90', vence: '2026-08-03' }),
  fila({ id: 100, numero: 593, fechaEmision: '2026-11-14', razonSocial: 'Otra Empresa S.A.', clienteCodigo: '0888', monto: 4100, pagado: 4100, saldo: 0, estado: 'pagada', areas: ['CAL'] }),
  fila({ id: 99, numero: 592, fechaEmision: '2026-11-13', razonSocial: '(anulada en el Excel)', clienteCodigo: null, nit: null, monto: 0, saldo: 0, estado: 'anulada', areas: [], responsables: [] }),
];

const detalle = (factura) => ({
  ...factura, origenRef: 'FACTURAS 2026, fila 348', observacion: null, plazoDias: null,
  cliente: { codigo: '0999', razonSocial: 'CLIENTE DE EJEMPLO S.R.L.', nombre: 'Cliente de Ejemplo', rubro: 'ALIMENTOS' },
  anulacion: null, creado: { usuario: 'comercial', nombre: 'Ana Comercial', fecha: '2026-11-18T14:00:00' },
  lineas: [
    { id: 1, orden: 1, monto: 200000, cantidad: null, regional: 'SCZ', costo: null, notaSalida: null, categoria: CATEGORIAS[3], neto: 168000, margen: null, margenPorcentaje: null },
    { id: 2, orden: 2, monto: 7120, cantidad: 2, regional: 'SCZ', costo: null, notaSalida: null, categoria: CATEGORIAS[0], neto: 5980.8, margen: 5980.8, margenPorcentaje: 84 },
  ],
  referencias: [{ id: 1, tipo: 'COTIZACION', valor: '0999-S03-1-26' }],
  personas: [{ id: 1, rol: 'RESPONSABLE', usuarioId: 7, nombre: 'Ana Comercial', porcentaje: null }],
  pagos: [],
  historial: [{ id: 1, accion: 'IMPORTACION', detalle: { origen: 'FACTURAS 2026, fila 348' }, motivo: null, usuario: 'comercial', nombre: 'Ana Comercial', fecha: '2026-11-18T14:00:00' }],
});

const TRAMOS = [
  { id: 'al_dia', label: 'Sin vencer', facturas: 0, saldo: 0 },
  { id: 'd30', label: '1 a 30 días', facturas: 0, saldo: 0 },
  { id: 'd60', label: '31 a 60 días', facturas: 0, saldo: 0 },
  { id: 'd90', label: '61 a 90 días', facturas: 0, saldo: 0 },
  { id: 'mas90', label: 'Más de 90 días', facturas: 1, saldo: 207120 },
];

// `enPruebas`: lo que dice el backend de los apartados en pruebas (vacío: Comercial abierto).
async function preparar(page, { usuario = COMERCIAL, enPruebas = [] } = {}) {
  await page.addInitScript(({ token, usuario }) => {
    if (sessionStorage.getItem('comercial-facturas-qa')) return;
    sessionStorage.setItem('comercial-facturas-qa', '1');
    localStorage.clear();
    localStorage.setItem('datamet_token', token);
    localStorage.setItem('datamet_user', JSON.stringify(usuario));
    localStorage.setItem('datamet_last_view', 'comercial');
  }, { token: token(usuario.id, usuario.acceso_cron), usuario });
  const pedidas = [];
  const enviados = {};
  await page.route(url => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, '');
    pedidas.push(`${request.method()} ${path}`);
    const json = (data, status = 200) => route.fulfill({ status, json: { success: true, data } });
    if (request.method() === 'POST' && path === '/comercial/facturas') {
      enviados.factura = request.postDataJSON();
      enviados.creada = detalle(fila({ ...FACTURAS[0], id: 102, numero: enviados.factura.numero, monto: enviados.factura.monto, saldo: enviados.factura.monto }));
      return json(enviados.creada, 201);
    }
    if (request.method() === 'POST' && path === '/comercial/pagos') {
      enviados.pago = request.postDataJSON();
      return json({ id: 50, fecha: enviados.pago.fecha, monto: enviados.pago.monto, medio: enviados.pago.medio, estado: 'vigente', aplicado: enviados.pago.monto, sinAplicar: 0, aplicaciones: [], historial: [] }, 201);
    }
    if (path === '/sistema/permisos/mios') return json({ permisos: [], gestionar: false, enPruebas });
    if (path === '/comercial/categorias') return json(CATEGORIAS);
    if (path === '/comercial/personal') return json([{ id: 7, nombre: 'Ana Comercial', area: 'Comercial' }, { id: 8, nombre: 'Luis Rojas', area: 'Comercial' }]);
    if (path === '/comercial/facturas/siguiente') return json({ gestion: 2026, numero: 595 });
    if (path === '/comercial/clientes') {
      return json([{ codigo: '0999', razonSocial: 'CLIENTE DE EJEMPLO S.R.L.', nombre: 'Cliente de Ejemplo', nit: '1234567', rubro: null, activo: true, plazoDias: 30, correos: [] }]);
    }
    if (path === '/comercial/facturas') {
      return json({ items: FACTURAS, total: 3, page: 1, pageSize: 25,
        resumen: { estados: { pendiente: 1, parcial: 0, pagada: 1, anulada: 1 }, facturado: 211220, cobrado: 4100, saldo: 207120 } });
    }
    if (path === '/comercial/facturas/102' && enviados.creada) return json(enviados.creada);
    if (/^\/comercial\/facturas\/\d+$/.test(path)) return json(detalle(FACTURAS[0]));
    if (path === '/comercial/cobranza') {
      return json({ hoy: '2026-11-18', facturas: [FACTURAS[0]], anticipos: { pagos: 1, saldo: 500 },
        resumen: { total: 207120, facturas: 1, tramos: TRAMOS, clientes: [{ clienteCodigo: '0999', razonSocial: 'Cliente de Ejemplo S.R.L.', facturas: 1, saldo: 207120, diasMoraMax: 107 }] } });
    }
    if (path === '/comercial/pagos') {
      return json({ items: [{ id: 40, fecha: '2026-11-14', monto: 4100, medio: 'DEPOSITO', clienteCodigo: '0888', referencia: null, verificacion: 'EXTRACTO NOV 2026',
        observacion: null, estado: 'vigente', aplicado: 4100, sinAplicar: 0, origen: 'EXCEL', aplicaciones: [{ facturaId: 100, numero: 593, gestion: 2026, razonSocial: 'Otra Empresa S.A.', monto: 4100 }] }],
      total: 1, page: 1, pageSize: 25, resumen: { cobrado: 4100, sinAplicar: 0 } });
    }
    return route.fulfill({ status: 403, json: { success: false, code: 'AREA_ACCESS_DENIED', message: 'Sin acceso en la prueba.' } });
  });
  return { pedidas, enviados };
}

test('Comercial registra una factura con sus líneas cuadradas', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { enviados } = await preparar(page);
  await page.goto('/comercial/facturas');

  const menu = page.getByRole('navigation', { name: 'Módulos' });
  for (const seccion of ['Facturas', 'Cuentas por cobrar', 'Pagos']) await expect(menu.getByRole('link', { name: seccion, exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('N.º 594').first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('group', { name: 'Filtrar por estado' })).toBeVisible();
  await expect(page.getByText('Bs 207 mil').first()).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/comercial-facturas-desktop.png', fullPage: true });

  // Ficha de una factura importada: la venta sin costo queda «por costear».
  await page.getByText('N.º 594').first().click();
  const ficha = page.getByRole('dialog', { name: 'Factura N.º 594' });
  await expect(ficha).toBeVisible();
  await expect(ficha.getByText('Por costear')).toBeVisible();
  await expect(ficha.getByRole('button', { name: /Registrar pago/ })).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/comercial-factura-ficha.png' });
  await ficha.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(ficha).toHaveCount(0);

  await page.getByRole('button', { name: 'Nueva factura' }).click();
  const alta = page.getByRole('dialog', { name: 'Nueva factura' });
  await expect(alta.getByLabel('N.º de factura')).toHaveValue('595');
  await alta.getByLabel('Monto (Bs)').fill('2.750');
  await alta.getByPlaceholder('Código, nombre o NIT del cliente').fill('ejemplo');
  await alta.getByRole('button', { name: /CLIENTE DE EJEMPLO S\.R\.L\./ }).click();
  await expect(alta.getByLabel('Razón social de la factura')).toHaveValue('CLIENTE DE EJEMPLO S.R.L.');
  await expect(alta.getByLabel('NIT')).toHaveValue('1234567');

  await alta.getByRole('combobox', { name: 'Categoría de la línea 1' }).click();
  await page.getByRole('option', { name: 'Mantenimiento preventivo (STIL)' }).click();
  await alta.getByLabel('Monto de la línea 1').fill('2.400');
  await expect(alta.getByText('Faltan Bs 350,00 por repartir.')).toBeVisible();
  await alta.getByRole('button', { name: 'Agregar línea' }).click();
  await alta.getByRole('combobox', { name: 'Categoría de la línea 2' }).click();
  await page.getByRole('option', { name: 'Logística (ST)' }).click();
  await alta.getByLabel('Monto de la línea 2').fill('350');
  await expect(alta.getByText('Las líneas suman el monto de la factura.')).toBeVisible();
  await alta.getByLabel('Cotización', { exact: true }).fill('0999-s03-1-26');
  await alta.getByRole('combobox', { name: 'Responsable comercial' }).click();
  await page.getByRole('option', { name: 'Ana Comercial' }).click();
  await page.screenshot({ path: '.impeccable/review/comercial-nueva-factura.png' });
  await alta.getByRole('button', { name: 'Registrar factura' }).click();

  await expect.poll(() => enviados.factura).toBeTruthy();
  expect(enviados.factura).toMatchObject({
    numero: 595, clienteCodigo: '0999', razonSocial: 'CLIENTE DE EJEMPLO S.R.L.', nit: '1234567', monto: 2750,
    lineas: [{ categoriaId: 3, monto: 2400 }, { categoriaId: 14, monto: 350 }],
    referencias: [{ tipo: 'COTIZACION', valor: '0999-S03-1-26' }],
    personas: [{ rol: 'RESPONSABLE', usuarioId: 7, nombre: 'Ana Comercial', porcentaje: null }],
  });
  await expect(page.getByRole('dialog', { name: 'Factura N.º 595' })).toBeVisible();
});

test('Cuentas por cobrar: tramos de mora y pago aplicado a la factura', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { enviados } = await preparar(page);
  await page.goto('/comercial/cobranza');
  await expect(page.getByRole('group', { name: 'Filtrar por días de mora' })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('Bs 500,00 cobrados sin aplicar')).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/comercial-cobranza-desktop.png', fullPage: true });

  await page.getByRole('button', { name: 'Pago', exact: true }).click();
  const pago = page.getByRole('dialog', { name: 'Registrar pago' });
  await expect(pago.getByLabel('Monto (Bs)')).toHaveValue('207120');
  await pago.getByLabel('Monto (Bs)').fill('100.000');
  await pago.getByLabel('Monto aplicado a la factura N.º 594').fill('100.000');
  await expect(pago.getByText('Todo el pago queda aplicado.')).toBeVisible();
  await pago.getByLabel('Verificado con').fill('Extracto nov 2026');
  await pago.getByRole('button', { name: 'Registrar pago' }).click();
  await expect.poll(() => enviados.pago).toBeTruthy();
  expect(enviados.pago).toMatchObject({ monto: 100000, medio: 'DEPOSITO', verificacion: 'Extracto nov 2026', aplicaciones: [{ facturaId: 101, monto: 100000 }] });

  await page.getByRole('button', { name: 'Por cliente' }).click();
  await expect(page.getByText('Código 0999 · 1 factura')).toBeVisible();
});

test('Las tablas no se desbordan con la barra lateral abierta en una pantalla mediana', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 900 });
  await preparar(page);
  const desborde = () => page.evaluate(() => {
    const tabla = [...document.querySelectorAll('main table')].find(t => getComputedStyle(t).display !== 'none');
    return { tabla: tabla.scrollWidth - tabla.closest('.card').clientWidth, pagina: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  for (const [ruta, texto] of [['/comercial/cobranza', 'N.º 594'], ['/comercial/facturas', 'N.º 594'], ['/comercial/pagos', 'N.º 593']]) {
    await page.goto(ruta);
    await expect(page.getByText(texto, { exact: false }).filter({ visible: true }).first()).toBeVisible({ timeout: 30000 });
    expect(await desborde(), ruta).toEqual({ tabla: 0, pagina: 0 });
  }
  await page.goto('/comercial/cobranza');
  await expect(page.getByRole('button', { name: 'Pago', exact: true })).toBeInViewport();
});

test('En pruebas, el área Comercial ve el apartado con candado y no pide nada de Comercial', async ({ page }) => {
  const { pedidas } = await preparar(page, { enPruebas: ['comercial'] });
  await page.goto('/comercial/facturas');
  await expect(page.getByRole('heading', { name: 'Apartado en pruebas' })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('Mientras tanto solo lo usa el área de Sistemas', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Comercial (sin acceso)' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nueva factura' })).toHaveCount(0);
  expect(pedidas.filter(p => p.includes('/comercial/'))).toEqual([]);
  await page.screenshot({ path: '.impeccable/review/comercial-en-pruebas.png' });
});

test('En pruebas, Sistemas usa Comercial completo y ve el aviso', async ({ page }) => {
  await preparar(page, { usuario: SISTEMAS, enPruebas: ['comercial'] });
  await page.goto('/comercial/facturas');
  await expect(page.getByText('En pruebas: por ahora solo Sistemas usa Comercial', { exact: false })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: 'Nueva factura' })).toBeVisible();
  await expect(page.getByText('Tu área consulta Comercial', { exact: false })).toHaveCount(0);
  await page.screenshot({ path: '.impeccable/review/comercial-en-pruebas-sistemas.png' });
});

test('Administración consulta Comercial sin registrar nada, también en el teléfono', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { pedidas } = await preparar(page, { usuario: ADMINISTRACION });
  await page.goto('/comercial/facturas');
  await expect(page.getByText('Tu área consulta Comercial', { exact: false })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: 'Nueva factura' })).toHaveCount(0);
  await expect(page.getByText('N.º 594').filter({ visible: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await page.screenshot({ path: '.impeccable/review/comercial-facturas-mobile.png', fullPage: true });

  await page.getByText('N.º 594').filter({ visible: true }).first().click();
  const ficha = page.getByRole('dialog', { name: 'Factura N.º 594' });
  await expect(ficha).toBeVisible();
  await expect(ficha.getByRole('button', { name: /Registrar pago/ })).toHaveCount(0);
  await expect(ficha.getByRole('button', { name: /Anular/ })).toHaveCount(0);

  await page.goto('/comercial/pagos');
  await expect(page.getByText('N.º 593', { exact: false }).filter({ visible: true }).first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: 'Registrar pago' })).toHaveCount(0);
  expect(pedidas.filter(p => !p.startsWith('GET '))).toEqual([]);
});
