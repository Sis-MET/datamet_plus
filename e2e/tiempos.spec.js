import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';

// Tiempos de servicio del personal (KPI) en Soporte técnico y Calibración.
// La API se simula con servicios generados: 3 técnicos y uno sin identificar,
// enero a octubre de 2026, y dos servicios con las horas mal registradas.

test.setTimeout(60000);

const token = payload => `header.${Buffer.from(JSON.stringify({ exp: 4102444800, ...payload })).toString('base64url')}.signature`;
const pad = n => String(n).padStart(2, '0');
const hhmm = minutos => `${pad(Math.floor(minutos / 60))}:${pad(minutos % 60)}`;

const GRUPOS = {
  soporte: [
    { id: 'MPR', nombre: 'Mantenimiento preventivo regular' },
    { id: 'MCR', nombre: 'Mantenimiento correctivo' },
    { id: 'RVD', nombre: 'Relevamiento de datos' },
  ],
  calibracion: [
    { id: 'HASTA_1KG', nombre: 'Hasta 1 kg' },
    { id: 'HASTA_60KG', nombre: 'Más de 1 kg hasta 60 kg' },
    { id: 'MAS_1500KG', nombre: 'Más de 1 500 kg' },
    { id: 'SIN_CAPACIDAD', nombre: 'Sin capacidad registrada' },
  ],
};

function generar(area) {
  const grupos = GRUPOS[area];
  const tecnicos = ['Ana Rojas', 'Bruno Paz', 'Carla Vega', null];
  const servicios = [];
  let n = 0;
  // 2025 (para comparar), con menos servicios, y 2026 hasta octubre.
  for (const [anio, meses, extra] of [[2025, 12, 0], [2026, 10, 3]]) {
    for (let mes = 1; mes <= meses; mes += 1) {
      for (let i = 0; i < 4 + (mes % 4) * 2 + extra; i += 1) {
        n += 1;
        const tecnico = tecnicos[n % 4];
        const inicio = 8 * 60 + ((n * 37) % 420);
        const duracion = 12 + ((n * 7) % 45) + (tecnico === 'Bruno Paz' ? 18 : 0) + (anio === 2025 ? 4 : 0);
        servicios.push({
          codigo: `S-${n}`, grupo: grupos[n % (grupos.length - (area === 'calibracion' ? 1 : 0))].id,
          orden: `${String(anio).slice(2)}-0${100 + mes}-11-${area === 'soporte' ? 'S' : 'C'}0${(i % 3) + 1}`,
          fecha: `${anio}-${pad(mes)}-${pad(3 + (i % 24))}`,
          inicio: hhmm(inicio), fin: hhmm(inicio + duracion), tecnico, cliente: `Cliente ${String.fromCharCode(65 + (n % 6))}`,
          planta: 'Planta central', codMetrica: `0${100 + mes}-11-${pad(i + 1)}`, equipo: 'BALANZA',
        });
      }
    }
  }
  const de2026 = servicios.filter(s => s.fecha >= '2026');
  servicios.push({ ...de2026[3], codigo: 'S-X1', inicio: '16:39', fin: '08:11' });
  servicios.push({ ...de2026[5], codigo: 'S-X2', fin: null });
  return { grupos, servicios };
}

const USUARIOS = {
  soporte: { id: 8, usuario: 'jefe.st', nombre: 'Jefe', apellido: 'Soporte', cargo: 'Jefe de Area', area: 'Soporte Técnico', acceso_cron: 2 },
  calibracion: { id: 7, usuario: 'jefe.cal', nombre: 'Jefa', apellido: 'Calibración', cargo: 'Jefe de Area', area: 'Calibración', acceso_cron: 2 },
  // Un jefe de otra área: ve los tiempos de las dos por su permiso, nada más de esos apartados.
  administracion: { id: 11, usuario: 'jefe.adm', nombre: 'Jefe', apellido: 'Administración', cargo: 'Jefe de Area', area: 'Administración', acceso_cron: 2 },
};

// Lo que da Gestión de permisos (migración 029) a los jefes de área de todas las áreas.
const PERMISOS_JEFES = { permisos: ['tiempos.soporte.ver', 'tiempos.calibracion.ver'], gestionar: false };

async function preparar(page, area, { usuario = USUARIOS[area], rutas = [] } = {}) {
  await page.clock.setFixedTime(new Date('2026-11-11T12:00:00'));
  await page.addInitScript(({ sesion, usuario, area }) => {
    if (sessionStorage.getItem('tiempos-qa')) return;
    sessionStorage.setItem('tiempos-qa', '1');
    localStorage.clear();
    localStorage.setItem('datamet_token', sesion);
    localStorage.setItem('datamet_user', JSON.stringify(usuario));
    localStorage.setItem('datamet_last_view', area === 'soporte' ? 'soporte' : 'calibration');
  }, { sesion: token({ id: usuario.id, acceso_cron: 2 }), usuario, area });
  const datos = { soporte: generar('soporte'), calibracion: generar('calibracion') };
  const pedidos = [];
  await page.route(url => url.pathname.startsWith('/api/'), async (route) => {
    const url = new URL(route.request().url());
    rutas.push(url.pathname);
    const json = data => route.fulfill({ json: { success: true, data } });
    if (url.pathname.endsWith('/sistema/permisos/mios')) return json(PERMISOS_JEFES);
    if (url.pathname.endsWith('/tiempos')) {
      const { grupos, servicios } = datos[url.pathname.includes('/calibracion/') ? 'calibracion' : 'soporte'];
      const desde = url.searchParams.get('desde');
      const hasta = url.searchParams.get('hasta');
      pedidos.push({ desde, hasta });
      const primerServicio = servicios.map(s => s.fecha).sort()[0];
      return json({ desde, hasta, grupos, primerServicio, servicios: servicios.filter(s => s.fecha >= desde && s.fecha <= hasta) });
    }
    if (url.pathname.endsWith('/soporte/permisos')) {
      return json({ editar: true, aprobar: true, configurarAprobadores: true, consulta: false, tiempos: true });
    }
    if (url.pathname.endsWith('/resumen')) return json({ total: 0, vencidas: 0 });
    return route.fulfill({ status: 503, json: { success: false, message: 'Sin simular en la prueba' } });
  });
  return pedidos;
}

test('el jefe de Soporte mide los tiempos del personal, filtra por técnico y exporta', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const pedidos = await preparar(page, 'soporte');
  await page.goto('/soporte/tiempos');

  await expect(page.getByRole('heading', { name: 'Tiempos de servicio', level: 2 })).toBeVisible({ timeout: 30000 });
  // El período y, para comparar, el mismo tramo del año anterior.
  await expect.poll(() => pedidos.slice(0, 2)).toEqual([
    { desde: '2026-01-01', hasta: '2026-11-11' },
    { desde: '2025-01-01', hasta: '2025-11-11' },
  ]);
  await expect(page.getByText('Horas de servicio', { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('vs. mismo período de 2025').first()).toBeVisible();
  const personal = page.getByRole('region', { name: 'Personal' });
  const bruno = personal.getByRole('article', { name: 'Tiempos de Bruno Paz' });
  await expect(bruno).toBeVisible();
  await expect(bruno).toContainText('Horas totales');
  await expect(bruno).toContainText('Por jornada');
  // «Sin identificar» va al final.
  await expect(personal.getByRole('article').last()).toHaveAccessibleName('Tiempos de Sin identificar');
  await expect(page.getByRole('button', { name: /Horas por revisar/ })).toContainText('2');
  await page.screenshot({ path: '.impeccable/review/tiempos-soporte-desktop.png', fullPage: true });

  // Cada mes del gráfico dice su valor al enfocarlo.
  const columnas = page.getByRole('listitem', { name: /de 2026:/ });
  await expect(columnas).toHaveCount(11);
  await columnas.nth(2).focus();
  await expect(page.getByText('marzo de 2026', { exact: false }).first()).toBeVisible();

  // Pulsar un grupo filtra por él; volver a pulsarlo lo quita.
  const grupos = page.getByRole('region', { name: 'Horas por tipo de servicio' });
  await grupos.getByRole('button', { name: /Relevamiento de datos/ }).click();
  await expect(grupos.getByRole('button', { name: /Relevamiento de datos/ })).toHaveAttribute('aria-pressed', 'true');
  await grupos.getByRole('button', { name: /Relevamiento de datos/ }).click();

  // Ver los servicios de un técnico: todo el panel pasa a esa persona.
  await bruno.getByRole('button', { name: 'Ver servicios' }).click();
  await expect(page.getByText('Mostrando solo a', { exact: false })).toContainText('Bruno Paz');
  await expect(personal.getByRole('article')).toHaveCount(1);
  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar CSV', exact: true }).click(),
  ]);
  expect(descarga.suggestedFilename()).toBe('tiempos-soporte-2026-01-01-a-2026-11-11-Bruno-Paz.csv');
  const csv = await fs.readFile(await descarga.path(), 'utf8');
  expect(csv.startsWith('﻿Fecha;OTST;Tipo de servicio;Técnico;')).toBe(true);
  expect(csv.split('\r\n').slice(1, -1).every(linea => linea.includes(';Bruno Paz;'))).toBe(true);

  // Otro período vuelve a pedir los servicios.
  await page.getByRole('button', { name: 'Quitar filtros', exact: true }).click();
  await page.getByRole('button', { name: /^Período/ }).click();
  await page.getByRole('button', { name: /^Mes anterior/ }).click();
  // Octubre, comparado con septiembre.
  await expect.poll(() => pedidos.slice(-2)).toEqual([{ desde: '2026-10-01', hasta: '2026-10-31' }, { desde: '2026-09-01', hasta: '2026-09-30' }]);
  // Septiembre tiene menos de 10 servicios medidos: no se compara.
  await expect(page.getByText('Pocos datos para comparar').first()).toBeVisible();
  await expect(page.getByRole('listitem', { name: /de 2026:/ })).toHaveCount(1);

  // Tema oscuro y teléfono: sin desbordes horizontales.
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.getByRole('button', { name: /^Período/ }).click();
  await page.getByRole('button', { name: /^Este año/ }).click();
  await expect(page.getByRole('listitem', { name: /de 2026:/ })).toHaveCount(11);
  await page.screenshot({ path: '.impeccable/review/tiempos-soporte-oscuro.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Tiempos de servicio', level: 2 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await page.screenshot({ path: '.impeccable/review/tiempos-soporte-movil.png', fullPage: true });
});

test('el jefe de Calibración ve los tiempos por rango de capacidad', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await preparar(page, 'calibracion');
  await page.goto('/calibracion/tiempos');

  await expect(page.getByRole('heading', { name: 'Tiempos de servicio', level: 2 })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('condiciones ambientales finales', { exact: false })).toBeVisible();
  await expect(page.getByText('Horas de servicio', { exact: true })).toBeVisible({ timeout: 30000 });
  const grupos = page.getByRole('region', { name: 'Horas por capacidad máxima' });
  await expect(grupos.getByRole('button', { name: /Hasta 1 kg/ })).toBeVisible();
  await expect(grupos.getByRole('button', { name: /Sin capacidad registrada/ })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Personal' }).getByRole('article')).toHaveCount(4);
  await expect(page.getByRole('button', { name: /Abrir registro/ }).first()).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/tiempos-calibracion-desktop.png', fullPage: true });
});

test('el jefe de otra área ve solo los tiempos de servicio de Soporte y de Calibración', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const rutas = [];
  await preparar(page, 'soporte', { usuario: USUARIOS.administracion, rutas });
  await page.goto('/soporte/informes');

  // Los informes son del área: la dirección pasa a los tiempos, sin el aviso de acceso restringido.
  await expect(page).toHaveURL(/\/soporte\/tiempos$/);
  await expect(page.getByRole('heading', { name: 'Tiempos de servicio', level: 2 })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('Horas de servicio', { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('Acceso restringido')).toHaveCount(0);
  // No se le ofrece abrir los informes, que siguen siendo del área.
  await expect(page.getByRole('button', { name: /Abrir informe/ })).toHaveCount(0);
  // En la barra lateral, de Soporte técnico solo los tiempos.
  const modulos = page.getByRole('navigation', { name: 'Módulos' });
  await expect(modulos.getByRole('list', { name: 'Soporte técnico' }).getByRole('link')).toHaveText(['Tiempos de servicio']);
  await page.screenshot({ path: '.impeccable/review/tiempos-otra-area.png', fullPage: true });

  await page.goto('/calibracion/equipos');
  await expect(page).toHaveURL(/\/calibracion\/tiempos$/);
  await expect(page.getByRole('region', { name: 'Horas por capacidad máxima' })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: /Abrir registro/ })).toHaveCount(0);
  // Solo pidió los tiempos: ni el plan de Calibración ni los permisos del área de Soporte.
  expect(rutas.filter(ruta => /\/(plan|soporte\/permisos|informes)/.test(ruta))).toEqual([]);
});

test('con «reducir movimiento» las columnas y las cifras aparecen ya en su valor', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await preparar(page, 'soporte');
  await page.goto('/soporte/tiempos');
  await expect(page.getByText('Horas de servicio', { exact: true })).toBeVisible({ timeout: 30000 });
  const alturas = () => page.evaluate(() => [...document.querySelectorAll('.tiempos-barra')].map(b => Math.round(b.getBBox().height)));
  const primera = await alturas();
  expect(primera.length).toBeGreaterThan(0);
  await page.waitForTimeout(150);
  expect(await alturas()).toEqual(primera);
});
