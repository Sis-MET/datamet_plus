import { expect, test } from '@playwright/test';

const tokenPayload = Buffer.from(JSON.stringify({
  exp: 4102444800,
  id: 1,
  nombre: 'Usuario QA',
  acceso_cron: 3,
})).toString('base64url');

const technicians = [
  { user_id: 1, id: 'Usuario_QA', nombre: 'Usuario QA', cargo: 'Técnico', area: 'Soporte Técnico', hora_ingreso: '08:30:00', hora_salida: '18:30:00' },
  { user_id: 2, id: 'Ana_Rojas', nombre: 'Ana Rojas', cargo: 'Técnico', area: 'Calibración', hora_ingreso: '08:30:00', hora_salida: '18:30:00' },
  { user_id: 3, id: 'Luis_Vera', nombre: 'Luis Vera', cargo: 'Asesor', area: 'Comercial', hora_ingreso: '08:30:00', hora_salida: '18:30:00' },
  { user_id: 99, id: 'CAMIONETA_LPZ', nombre: 'CAMIONETA LPZ', cargo: 'VEHICULO', area: 'VEHÍCULOS' },
];

const DIRECCION = 'AV. ELIAS MENESES S/N ZONA PIÑAMI - COCHABAMBA';
const taskDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz' }).format(new Date());

const task = {
  id: 71,
  id_usuario: 1,
  usuario: 'Usuario QA',
  fecha: taskDate,
  tipo_tarea: 'Servicio',
  descripcion: 'COT 0032-C07-26 2 CAL 17 BLZ',
  cliente: 'EMBOL',
  cod_cliente: '0032',
  planta: '0032-21',
  planta_dir: DIRECCION,
  planta_localidad: '',
  color: '#ce1515ff',
  estado: 'Pendiente',
  hora_inicio: '08:30:00',
  hora_fin: '17:30:00',
};

test.beforeEach(async ({ page, isMobile }) => {
  await page.addInitScript(({ token }) => {
    localStorage.setItem('datamet_token', token);
    localStorage.setItem('datamet_user', JSON.stringify({ id: 1, nombre: 'Usuario QA', acceso_cron: 3, area: 'Soporte Técnico' }));
    localStorage.setItem('datamet_last_view', 'calendar');
  }, { token: `header.${tokenPayload}.signature` });

  await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ status: 503, json: { success: false, message: 'Sin simular en la prueba' } }));
  await page.route('**/api/calendar/tecnicos', route => route.fulfill({ json: { success: true, data: technicians } }));
  await page.route('**/api/calendar/cronograma**', route => route.fulfill({ json: { success: true, data: [task] } }));
  await page.route('**/api/clientes/0032/plantas', route => route.fulfill({
    json: { success: true, data: [{ codigo_planta: '0032-21', dir: DIRECCION, localidad: '', dep: '' }] },
  }));
  if (!isMobile) await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  // La primera carga puede esperar a que Vite compile los módulos.
  await expect(page.locator('[data-task-id="task_71"]')).toBeVisible({ timeout: 30000 });
});

test('el filtro admite varias áreas a la vez', async ({ page }) => {
  const chip = name => page.locator('.gantt-area-chip').filter({ hasText: name });
  const rows = page.locator('[data-resource-row]');
  await expect(rows).toHaveCount(4);

  await chip('Calibración').click();
  await expect(chip('Calibración')).toHaveAttribute('aria-pressed', 'true');
  await expect(chip('Vehículos')).toHaveAttribute('aria-pressed', 'true');
  await expect(rows).toHaveCount(2);

  await chip('Comercial').click();
  await expect(rows).toHaveCount(3);

  await chip('Vehículos').click();
  await expect(rows).toHaveCount(2);
  await expect(page.locator('[data-resource-row="CAMIONETA_LPZ"]')).toHaveCount(0);

  await chip('Todas').click();
  await expect(chip('Todas')).toHaveAttribute('aria-pressed', 'true');
  await expect(rows).toHaveCount(4);
});

test('la ficha muestra el departamento abreviado de la planta', async ({ page }) => {
  const card = page.locator('[data-task-id="task_71"]');
  await expect(card.getByText('CBB - EMBOL', { exact: true })).toBeVisible();
  await expect(card.getByText('0032-21', { exact: true })).toBeVisible();
});

test('el calendario se recorre al llevar el cursor a un borde', async ({ page }) => {
  const scroller = page.locator('.gantt-scroll-container');
  const viewport = await page.locator('.gantt-scroll-viewport').boundingBox();
  const scrollLeft = () => scroller.evaluate(element => element.scrollLeft);
  const y = viewport.y + 150;

  await page.mouse.move(viewport.x + viewport.width / 2, y);
  await page.waitForTimeout(350);
  const start = await scrollLeft();
  await page.waitForTimeout(350);
  expect(await scrollLeft()).toBe(start);

  await page.mouse.move(viewport.x + viewport.width - 6, y);
  await expect(page.locator('.gantt-edge-cue-right')).toHaveClass(/is-active/);
  await expect.poll(scrollLeft, { timeout: 2500 }).toBeGreaterThan(start + 80);

  await page.mouse.move(viewport.x + viewport.width / 2, y);
  await expect(page.locator('.gantt-edge-cue-right')).not.toHaveClass(/is-active/);
  const stopped = await scrollLeft();
  await page.waitForTimeout(250);
  expect(await scrollLeft()).toBe(stopped);

  await page.mouse.move(viewport.x + 172 + 6, y);
  await expect.poll(scrollLeft, { timeout: 2500 }).toBeLessThan(stopped - 80);
});

test('un clic en el borde no se pierde ni desplaza la grilla', async ({ page }) => {
  const scroller = page.locator('.gantt-scroll-container');
  // Al cargar, la grilla se centra en hoy con una animación: se espera a que termine.
  let previous = -1;
  await expect.poll(async () => {
    const current = await scroller.evaluate(element => element.scrollLeft);
    const settled = current === previous;
    previous = current;
    return settled;
  }, { intervals: [200] }).toBe(true);

  const viewport = await page.locator('.gantt-scroll-viewport').boundingBox();
  const x = viewport.x + viewport.width - 40;
  const y = viewport.y + 150;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.getByRole('dialog', { name: /Nueva tarea/i })).toBeVisible();
  await page.waitForTimeout(400);
  expect(await scroller.evaluate(element => element.scrollLeft)).toBe(previous);
});

test('la ficha queda por encima de la barra lateral en cualquier ancho', async ({ page }) => {
  const card = page.locator('[data-task-id="task_71"]');
  const panel = page.locator('.task-dialog-panel');

  for (const width of [1024, 1366, 1600]) {
    await page.setViewportSize({ width, height: 768 });
    await card.click();
    await expect(panel).toBeVisible();
    await page.waitForTimeout(350);
    const visible = await panel.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return [
        [rect.left + 4, rect.top + rect.height / 2],
        [rect.left + 24, rect.top + 24],
        [rect.right - 4, rect.top + rect.height / 2],
      ].every(([x, y]) => element.contains(document.elementFromPoint(x, y)));
    });
    expect(visible, `ficha descubierta a ${width}px`).toBe(true);
    if (width === 1366) await page.screenshot({ path: 'test-results/cronograma-ficha-1366.png' });
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
  }

  // Los menús de la ficha se siguen abriendo por encima de ella.
  await card.click();
  await panel.locator('button[aria-haspopup="listbox"]').filter({ hasText: 'EMBOL - COCHABAMBA' }).click();
  await page.getByRole('option', { name: /0032-21/ }).click();
  await expect(panel.getByText(DIRECCION)).toBeVisible();
});

const resumenDe = page => page.locator('.glass.pointer-events-none').filter({ hasText: 'Cliente' });

for (const [equipo, viewport] of [['celular', { width: 390, height: 844 }], ['tablet', { width: 820, height: 1180 }]]) {
  test.describe(`en ${equipo} con pantalla táctil`, () => {
    test.use({ hasTouch: true, isMobile: true, viewport });

    test('tocar una tarea abre solo la ficha', async ({ page }) => {
      await page.locator('[data-task-id="task_71"]').tap();
      await expect(page.getByRole('dialog', { name: /Editar tarea/i })).toBeVisible();
      await page.waitForTimeout(300);
      await expect(resumenDe(page)).toHaveCount(0);
      await page.screenshot({ path: `test-results/cronograma-toque-${equipo}.png` });
    });

    test('sin permiso de edición, tocar muestra solo el resumen y otro toque lo cierra', async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem('datamet_user', JSON.stringify({ id: 1, nombre: 'Usuario QA', acceso_cron: 1, area: 'Soporte Técnico' }));
      });
      await page.reload();
      const card = page.locator('[data-task-id="task_71"]');
      await expect(card).toBeVisible({ timeout: 30000 });

      await card.tap();
      await expect(resumenDe(page)).toContainText('EMBOL - COCHABAMBA');
      await expect(page.getByRole('dialog', { name: /Editar tarea/i })).toHaveCount(0);

      await page.waitForTimeout(250);
      await page.screenshot({ path: `test-results/cronograma-resumen-${equipo}.png` });
      await page.touchscreen.tap(12, 12);
      await expect(resumenDe(page)).toHaveCount(0);
    });
  });
}

test('con mouse, el resumen sale al pasar y se cierra al abrir la ficha o el menú', async ({ page }) => {
  const card = page.locator('[data-task-id="task_71"]');
  await card.hover();
  await expect(resumenDe(page)).toBeVisible();

  await card.click({ button: 'right' });
  await expect(page.getByRole('menu', { name: /Acciones de la tarea/i })).toBeVisible();
  await expect(resumenDe(page)).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.mouse.click(5, 5);
  await expect(page.getByRole('menu', { name: /Acciones de la tarea/i })).toHaveCount(0);

  await page.mouse.move(700, 120);
  await card.hover();
  await expect(resumenDe(page)).toBeVisible();
  await card.click();
  await expect(page.getByRole('dialog', { name: /Editar tarea/i })).toBeVisible();
  await expect(resumenDe(page)).toHaveCount(0);
});

test('el resumen y la ficha muestran cliente, planta y dirección', async ({ page }) => {
  const card = page.locator('[data-task-id="task_71"]');
  await card.hover();
  const tooltip = page.locator('.glass.pointer-events-none').filter({ hasText: 'Cliente' });
  await expect(tooltip).toContainText('EMBOL - COCHABAMBA');
  await expect(tooltip).toContainText('Dirección');
  await expect(tooltip).toContainText(DIRECCION);
  const box = await tooltip.boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(768);
  await page.screenshot({ path: 'test-results/cronograma-resumen.png' });

  await card.click();
  const dialog = page.getByRole('dialog', { name: /Editar tarea/i });
  await expect(dialog.getByText('Dirección de la planta')).toBeVisible();
  await expect(dialog.getByText(DIRECCION)).toBeVisible();
  await page.screenshot({ path: 'test-results/cronograma-ficha.png' });
});
