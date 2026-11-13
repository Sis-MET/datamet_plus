import { expect, test } from '@playwright/test';

// Sistema › Gestión de permisos con la API simulada: el personal de prueba,
// los dos permisos de los tiempos de servicio concedidos a los jefes de área
// y lo que responde el backend al conceder.

test.setTimeout(60000);

const token = payload => `header.${Buffer.from(JSON.stringify({ exp: 4102444800, ...payload })).toString('base64url')}.signature`;

const CATALOGO = [
  { clave: 'tiempos.soporte.ver', nombre: 'Ver los tiempos de servicio de Soporte técnico', corto: 'Tiempos · Soporte', modulo: 'Soporte técnico',
    descripcion: 'Soporte técnico › Tiempos de servicio: horas, servicios y medias del personal del área.' },
  { clave: 'tiempos.calibracion.ver', nombre: 'Ver los tiempos de servicio de Calibración', corto: 'Tiempos · Calibración', modulo: 'Calibración',
    descripcion: 'Calibración › Tiempos de servicio: horas, servicios y medias del personal del área.' },
];
const TODOS = CATALOGO.map(p => p.clave);
const PERSONAS = [
  ['Ana Rojas', 'Rojas', 'Comercial', 'Auxiliar Comercial', '2'],
  ['Bruno Paz', 'Paz', 'Calibración', 'Técnico', '2'],
  ['Edgar Delgado', 'Delgado', 'Comercial', 'Jefe de Area', '2'],
  ['Gerson Vallejos', 'Vallejos', 'Calibración', 'Jefe de Area', '2'],
  ['Jhonatan Barrau', 'Barrau', 'Administración', 'Auxiliar de Sistemas', '3'],
  ['Jose Velasquez', 'Velasquez', 'Soporte Técnico', 'Jefe de Area', '2'],
  ['Ramiro Telleria', 'Telleria', 'Administración', 'Jefe de Area', '2'],
];

function gestion({ concedidoA = null } = {}) {
  const concesiones = [
    { id: 1, permiso: 'tiempos.soporte.ver', tipo: 'GRUPO', usuarioId: null, area: null, cargo: 'jefe de area', sujeto: 'Jefes de área de todas las áreas',
      motivo: 'Pedido de Sistemas: los jefes de área de todas las áreas ven los tiempos de servicio.', concedidoPor: 'migración 029', concedidoEn: '2026-11-13T19:00:00Z', alcance: 4 },
    { id: 2, permiso: 'tiempos.calibracion.ver', tipo: 'GRUPO', usuarioId: null, area: null, cargo: 'jefe de area', sujeto: 'Jefes de área de todas las áreas',
      motivo: 'Pedido de Sistemas: los jefes de área de todas las áreas ven los tiempos de servicio.', concedidoPor: 'migración 029', concedidoEn: '2026-11-13T19:00:00Z', alcance: 4 },
  ];
  if (concedidoA) {
    concesiones.push({ id: 3, permiso: 'tiempos.soporte.ver', tipo: 'PERSONA', usuarioId: concedidoA, area: null, cargo: null, sujeto: 'Ana Rojas',
      motivo: 'Arma los reportes de servicio para los clientes', concedidoPor: 'Barrau', concedidoEn: '2026-11-13T20:00:00Z', alcance: 1 });
  }
  const personal = PERSONAS.map(([nombre, usuario, area, cargo, nivel], indice) => {
    const id = indice + 1;
    const sistemas = nivel === '3';
    const jefe = cargo === 'Jefe de Area';
    const permisos = sistemas
      ? TODOS.map(clave => ({ clave, sistemas: true, concesiones: [] }))
      : TODOS.map(clave => ({ clave, sistemas: false, concesiones: [
        ...(jefe ? [clave === 'tiempos.soporte.ver' ? 1 : 2] : []),
        ...(concedidoA === id && clave === 'tiempos.soporte.ver' ? [3] : []),
      ] })).filter(p => p.concesiones.length);
    return { id, nombre, usuario, area, cargo, nivel, sistemas, gestiona: sistemas, permisos };
  });
  const etiquetas = campo => [...new Set(personal.map(p => p[campo]))].sort().map(nombre => ({
    clave: nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(), nombre, personas: personal.filter(p => p[campo] === nombre).length,
  }));
  return { catalogo: CATALOGO, gestores: ['Sistemas (nivel 3)'], areas: etiquetas('area'), cargos: etiquetas('cargo'), personal, concesiones };
}

async function preparar(page) {
  await page.addInitScript(({ sesion }) => {
    if (sessionStorage.getItem('permisos-qa')) return;
    sessionStorage.setItem('permisos-qa', '1');
    localStorage.clear();
    localStorage.setItem('datamet_token', sesion);
    localStorage.setItem('datamet_user', JSON.stringify({
      id: 5, usuario: 'Barrau', nombre: 'Jhonatan', apellido: 'Barrau', cargo: 'Auxiliar de Sistemas', area: 'Administración', acceso_cron: 3,
    }));
  }, { sesion: token({ id: 5, acceso_cron: 3 }) });
  const estado = { concedidoA: null, pedidos: [] };
  await page.route(url => url.pathname.startsWith('/api/'), async (route) => {
    const url = new URL(route.request().url());
    const json = data => route.fulfill({ json: { success: true, data } });
    if (url.pathname.endsWith('/sistema/permisos/mios')) return json({ permisos: TODOS, gestionar: true });
    if (url.pathname.endsWith('/sistema/permisos/historial')) {
      return json(estado.concedidoA ? [{
        id: 3, accion: 'CONCEDER', permiso: 'tiempos.soporte.ver', permisoNombre: CATALOGO[0].nombre, concesionId: 3, sujeto: 'Ana Rojas',
        antes: ['Jefes de área de todas las áreas'], despues: ['Jefes de área de todas las áreas', 'Ana Rojas'],
        motivo: 'Arma los reportes de servicio para los clientes', usuario: 'Barrau', nombre: 'Jhonatan Barrau', fecha: '2026-11-13T20:00:00Z',
      }] : []);
    }
    if (url.pathname.endsWith('/sistema/permisos/concesiones') && route.request().method() === 'POST') {
      estado.pedidos.push(route.request().postDataJSON());
      estado.concedidoA = 1;
      return json(gestion({ concedidoA: estado.concedidoA }));
    }
    if (url.pathname.endsWith('/sistema/permisos')) return json(gestion({ concedidoA: estado.concedidoA }));
    if (url.pathname.endsWith('/resumen')) return json({ total: 0, vencidas: 0, abiertas: 0, enCurso: 0 });
    return route.fulfill({ status: 503, json: { success: false, message: 'Sin simular en la prueba' } });
  });
  return estado;
}

test('Sistemas busca a una persona, le concede un permiso con motivo y queda en el historial', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const estado = await preparar(page);
  await page.goto('/sistema/permisos');

  await expect(page.getByRole('heading', { name: 'Gestión de permisos', level: 2 })).toBeVisible({ timeout: 30000 });
  await expect(page).toHaveURL(/\/sistema\/permisos\/personal$/);
  await expect(page.getByRole('navigation', { name: 'Sistema' }).getByRole('button', { name: /Gestión de permisos/ })).toBeVisible();
  const personal = page.getByRole('list', { name: 'Personal' });
  await expect(personal.getByRole('listitem')).toHaveCount(7);
  // Los jefes de área tienen los dos tiempos de servicio; Sistemas, todos.
  await expect(personal.getByRole('button', { name: 'Permisos de Jose Velasquez' })).toContainText('Tiempos · Calibración');
  await expect(personal.getByRole('button', { name: 'Permisos de Jhonatan Barrau' })).toContainText('Todos · Sistemas');
  await page.screenshot({ path: '.impeccable/review/permisos-personal.png', fullPage: true });

  // Búsqueda sin tildes y por cargo.
  await page.getByRole('searchbox', { name: 'Buscar personal' }).fill('auxiliar comercial');
  await expect(personal.getByRole('listitem')).toHaveCount(1);
  await personal.getByRole('button', { name: 'Permisos de Ana Rojas' }).click();

  const ficha = page.getByRole('dialog', { name: 'Ana Rojas' });
  await expect(ficha).toContainText('No lo tiene');
  await ficha.getByRole('button', { name: 'Conceder' }).first().click();

  const conceder = page.getByRole('dialog', { name: 'Conceder permiso' });
  await expect(conceder.getByRole('radio', { name: /Ana Rojas/ })).toHaveAttribute('aria-checked', 'true');
  await expect(conceder).toContainText('Lo ganan');
  await conceder.getByRole('button', { name: 'Conceder', exact: true }).click();
  await expect(conceder.getByText('Escribe por qué se concede el permiso.')).toBeVisible();
  await conceder.getByLabel('Motivo').fill('Arma los reportes de servicio para los clientes');
  await page.screenshot({ path: '.impeccable/review/permisos-conceder.png' });
  await conceder.getByRole('button', { name: 'Conceder', exact: true }).click();
  await expect(conceder).toBeHidden();
  expect(estado.pedidos).toEqual([{
    permiso: 'tiempos.soporte.ver', tipo: 'PERSONA', usuarioId: 1, motivo: 'Arma los reportes de servicio para los clientes',
  }]);
  await expect(ficha).toContainText('Concedido a esta persona');
  await page.keyboard.press('Escape');

  // Por permiso: la concesión nueva junto a la de los jefes de área.
  await page.getByRole('button', { name: /Por permiso/ }).click();
  await expect(page).toHaveURL(/\/sistema\/permisos\/permisos$/);
  const soporte = page.getByRole('list', { name: 'Concesiones de Ver los tiempos de servicio de Soporte técnico' });
  await expect(soporte.getByRole('listitem')).toHaveCount(2);
  await expect(soporte).toContainText('Jefes de área de todas las áreas');
  await expect(soporte).toContainText('Ana Rojas');

  // Historial: quién, qué y quiénes lo tenían antes y después.
  await page.getByRole('button', { name: /Historial/ }).click();
  const historial = page.getByRole('list', { name: 'Cambios de permisos' });
  await expect(historial).toContainText('Concedido');
  await expect(historial).toContainText('Jhonatan Barrau');
  await expect(historial).toContainText('Después: Jefes de área de todas las áreas · Ana Rojas');
  await page.screenshot({ path: '.impeccable/review/permisos-historial.png', fullPage: true });

  // Teléfono y tema oscuro: sin desbordes horizontales.
  await page.getByRole('button', { name: /Por persona/ }).click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('list', { name: 'Personal' })).toBeVisible();
  // Con la lista ya quieta (las filas y el aviso entran animados).
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await page.screenshot({ path: '.impeccable/review/permisos-movil-oscuro.png', fullPage: true });
});

test('quien no gestiona los permisos no ve el apartado y vuelve al RIM', async ({ page }) => {
  await page.addInitScript(({ sesion }) => {
    localStorage.setItem('datamet_token', sesion);
    localStorage.setItem('datamet_user', JSON.stringify({ id: 7, usuario: 'Vallejos', cargo: 'Jefe de Area', area: 'Calibración', acceso_cron: 2 }));
  }, { sesion: token({ id: 7, acceso_cron: 2 }) });
  const pedidos = [];
  await page.route(url => url.pathname.startsWith('/api/'), (route) => {
    const url = new URL(route.request().url());
    pedidos.push(url.pathname);
    if (url.pathname.endsWith('/sistema/permisos/mios')) return route.fulfill({ json: { success: true, data: { permisos: TODOS, gestionar: false } } });
    return route.fulfill({ status: 503, json: { success: false, message: 'Sin simular en la prueba' } });
  });
  await page.goto('/sistema/permisos');
  await expect(page).toHaveURL(/\/rim/, { timeout: 30000 });
  await expect(page.getByRole('navigation', { name: 'Sistema' }).getByRole('button', { name: /Gestión de permisos/ })).toHaveCount(0);
  expect(pedidos.filter(ruta => ruta.endsWith('/sistema/permisos'))).toEqual([]);
});
