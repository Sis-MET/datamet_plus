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

const chipDe = (page, name) => page.locator('.gantt-area-chip').filter({ hasText: name });

test('por defecto marca solo el área de la persona y recuerda lo que elige', async ({ page }) => {
  const rows = page.locator('[data-resource-row]');
  await expect(rows).toHaveCount(1);
  await expect(chipDe(page, 'Soporte')).toHaveAttribute('aria-pressed', 'true');
  await expect(chipDe(page, 'Vehículos')).toHaveAttribute('aria-pressed', 'false');
  await expect(chipDe(page, 'Todas')).toHaveAttribute('aria-pressed', 'mixed');

  await chipDe(page, 'Calibración').click();
  await expect(rows).toHaveCount(2);
  await page.reload();
  await expect(rows).toHaveCount(2, { timeout: 30000 });
  await expect(chipDe(page, 'Calibración')).toHaveAttribute('aria-pressed', 'true');
});

test('«Todas» marca todas las casillas para ir quitando las que no aplican', async ({ page }) => {
  const rows = page.locator('[data-resource-row]');
  await chipDe(page, 'Todas').click();
  await expect(rows).toHaveCount(4);
  for (const name of ['Todas', 'Soporte', 'Calibración', 'Comercial', 'Vehículos']) {
    await expect(chipDe(page, name)).toHaveAttribute('aria-pressed', 'true');
  }

  await chipDe(page, 'Comercial').click();
  await expect(rows).toHaveCount(3);
  await expect(chipDe(page, 'Comercial')).toHaveAttribute('aria-pressed', 'false');
  await expect(chipDe(page, 'Todas')).toHaveAttribute('aria-pressed', 'mixed');
  await page.reload();
  await expect(rows).toHaveCount(3, { timeout: 30000 });

  await chipDe(page, 'Todas').click();
  await expect(rows).toHaveCount(4);
  await chipDe(page, 'Todas').click();
  await expect(rows).toHaveCount(0);
  await expect(page.getByText('Ninguna área marcada')).toBeVisible();

  // Sin ninguna marcada no se guarda: al volver abre con su área.
  await page.reload();
  await expect(rows).toHaveCount(1, { timeout: 30000 });
});

test('cada usuario tiene su propia selección de áreas', async ({ page }) => {
  await chipDe(page, 'Todas').click();
  await expect(page.locator('[data-resource-row]')).toHaveCount(4);

  const otroToken = Buffer.from(JSON.stringify({ exp: 4102444800, id: 2, nombre: 'Ana Rojas', acceso_cron: 3 })).toString('base64url');
  await page.addInitScript(({ token }) => {
    localStorage.setItem('datamet_token', token);
    localStorage.setItem('datamet_user', JSON.stringify({ id: 2, nombre: 'Ana Rojas', acceso_cron: 3, area: 'Calibración' }));
  }, { token: `header.${otroToken}.signature` });
  await page.reload();
  await expect(page.locator('[data-resource-row="Ana_Rojas"]')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('[data-resource-row]')).toHaveCount(1);
});

test('el buscador muestra una fila oculta sin cambiar la selección guardada', async ({ page }) => {
  const rows = page.locator('[data-resource-row]');
  await expect(rows).toHaveCount(1);
  await page.keyboard.press('Control+k');
  await page.getByPlaceholder(/Buscar cliente, planta/).fill('Ana Rojas');
  await page.getByRole('option', { name: /Ana Rojas/ }).first().click();
  await expect(page.locator('[data-resource-row="Ana_Rojas"]')).toBeVisible();

  await page.reload();
  await expect(rows).toHaveCount(1, { timeout: 30000 });
  await expect(page.locator('[data-resource-row="Ana_Rojas"]')).toHaveCount(0);
});

test('la ficha muestra el departamento en negrita antes de la dirección', async ({ page }) => {
  const card = page.locator('[data-task-id="task_71"]');
  await expect(card.getByText('EMBOL', { exact: true })).toBeVisible();
  await expect(card.getByText('0032-21', { exact: true })).toBeVisible();

  const departamento = card.locator('strong');
  await expect(departamento).toHaveText('CBB');
  await expect(departamento.locator('..')).toHaveText(`CBB - ${DIRECCION}`);

  const medidas = await departamento.evaluate((element) => {
    const ficha = element.closest('[data-task-id]');
    return {
      peso: Number(getComputedStyle(element).fontWeight),
      visible: element.getBoundingClientRect().right <= ficha.getBoundingClientRect().right,
      desborde: ficha.scrollHeight - ficha.clientHeight,
    };
  });
  expect(medidas.peso).toBeGreaterThanOrEqual(700);
  expect(medidas.visible).toBe(true);
  expect(medidas.desborde).toBeLessThanOrEqual(0);
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

    test('el botón + no tapa el horario y se puede tocar con holgura', async ({ page }) => {
      const card = page.locator('[data-task-id="task_71"]');
      const cell = page.locator('.gantt-cell-filled').filter({ has: card });
      await cell.locator('.gantt-cell-add').scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      const medidas = await cell.evaluate((element) => {
        const boton = element.querySelector('.gantt-cell-add').getBoundingClientRect();
        const horario = element.querySelector('[data-task-id] .tabular-nums').getBoundingClientRect();
        const tipo = element.querySelector('.gantt-card-activity');
        const finTipo = tipo.getBoundingClientRect().right - parseFloat(getComputedStyle(tipo).paddingRight);
        return {
          ancho: boton.width,
          alto: boton.height,
          bajoHorario: boton.top - horario.bottom,
          trasTipo: boton.left - finTipo,
          x: boton.left,
          y: boton.top,
        };
      });
      expect(medidas.ancho).toBe(14);
      expect(medidas.alto).toBe(14);
      expect(medidas.bajoHorario).toBeGreaterThanOrEqual(-0.5);
      expect(medidas.trasTipo).toBeGreaterThanOrEqual(0);

      // Un toque justo fuera del dibujo del botón sigue contando como +.
      await page.touchscreen.tap(medidas.x - 6, medidas.y - 6);
      const nueva = page.getByRole('dialog', { name: /Nueva tarea/i });
      await expect(nueva).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(nueva).toHaveCount(0);

      await card.tap({ position: { x: 16, y: 10 } });
      await expect(page.getByRole('dialog', { name: /Editar tarea/i })).toBeVisible();
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
