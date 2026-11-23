import { expect, test } from '@playwright/test';

const tokenPayload = Buffer.from(JSON.stringify({
  exp: 4102444800,
  id: 1,
  nombre: 'Usuario QA',
  acceso_cron: 3,
})).toString('base64url');

const technicians = [
  { user_id: 1, id: 'Usuario_QA', nombre: 'Usuario QA', cargo: 'Técnico', area: 'SERVICIO', hora_ingreso: '08:30:00', hora_salida: '18:30:00' },
  ...Array.from({ length: 14 }, (_, index) => ({
    user_id: index + 2,
    id: `Tecnico_${index + 2}`,
    nombre: `Técnico ${index + 2}`,
    cargo: 'Técnico',
    area: index % 2 === 0 ? 'SERVICIO' : 'CALIBRACIÓN',
    hora_ingreso: '08:30:00',
    hora_salida: '18:30:00',
  })),
  { user_id: 99, id: 'CAMIONETA_LPZ', nombre: 'CAMIONETA LPZ', cargo: 'VEHICULO', area: 'VEHÍCULOS' },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ token }) => {
    localStorage.setItem('datamet_token', token);
    localStorage.setItem('datamet_user', JSON.stringify({ id: 1, nombre: 'Usuario QA', acceso_cron: 3, area: 'SERVICIO' }));
    localStorage.setItem('datamet_last_view', 'calendar');
    localStorage.setItem('datamet_cronograma_areas_1', JSON.stringify({ all: true }));
  }, { token: `header.${tokenPayload}.signature` });

  // Sin backend real: lo no simulado responde como servidor no disponible. Va
  // primero porque las rutas registradas después tienen prioridad. (Por ruta:
  // `**/api/**` también atraparía módulos de Vite como /src/shared/api/.)
  await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ status: 503, json: { success: false, message: 'Sin simular en la prueba' } }));
  await page.route('**/api/calendar/tecnicos', route => route.fulfill({
    json: { success: true, data: technicians },
  }));
  await page.route('**/api/calendar/cronograma**', route => route.fulfill({ json: { success: true, data: [] } }));
});

test('el calendario móvil no desborda y abre la agenda contextual', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByRole('button', { name: /Agenda y detalle del día/i })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);

  await page.getByRole('button', { name: /Agenda y detalle del día/i }).click();
  await expect(page.getByRole('dialog', { name: /Agenda y detalle/i })).toBeVisible();
  await page.screenshot({ path: 'test-results/calendar-mobile-current.png' });
});

test('el calendario de escritorio conserva el gutter y un único scroll vertical', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');

  const sidebar = page.locator('.calendar-sidebar');
  const gantt = page.locator('.gantt-scroll-shell');
  await expect(sidebar).toBeVisible();
  await expect(gantt).toBeVisible();

  const [sidebarBox, ganttBox] = await Promise.all([sidebar.boundingBox(), gantt.boundingBox()]);
  expect(ganttBox.x - (sidebarBox.x + sidebarBox.width)).toBeGreaterThanOrEqual(20);

  const hasNestedVerticalScroll = await page.locator('.gantt-scroll-container').evaluate(element => (
    element.scrollHeight > element.clientHeight + 1
  ));
  expect(hasNestedVerticalScroll).toBe(false);

  const viewportMaterial = await page.locator('.gantt-scroll-viewport').evaluate(element => {
    const styles = getComputedStyle(element);
    const surface = getComputedStyle(document.documentElement).getPropertyValue('--c-surface').trim();
    return {
      radius: parseFloat(styles.borderTopLeftRadius),
      overflow: styles.overflow,
      backgroundColor: styles.backgroundColor,
      backgroundImage: styles.backgroundImage,
      surfaceColor: `rgb(${surface.split(/\s+/).join(', ')})`,
    };
  });
  expect(viewportMaterial.radius).toBeGreaterThanOrEqual(14);
  expect(viewportMaterial.overflow).toBe('hidden');
  // Superficie sólida del tema activo: los datos no van sobre vidrio.
  expect(viewportMaterial.backgroundColor).toBe(viewportMaterial.surfaceColor);
  expect(viewportMaterial.backgroundImage).toBe('none');

  await page.locator('.gantt-scroll-container').hover();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 420);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBefore);
  const stickySidebarBox = await sidebar.boundingBox();
  const topbarBox = await page.locator('header').first().boundingBox();
  expect(stickySidebarBox.y).toBeGreaterThanOrEqual(topbarBox.y + topbarBox.height);
  await page.screenshot({ path: 'test-results/calendar-desktop-current.png' });
});

test('la descripción responde sin reconstruir la ficha completa', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');

  await page.locator('.gantt-cell-empty').first().click();
  const dialog = page.getByRole('dialog', { name: /Nueva tarea/i });
  await expect(dialog).toBeVisible();

  const description = dialog.getByLabel(/Descripción/i);
  const inputText = 'Revisión preventiva de equipos y registro de observaciones en planta.';
  const startedAt = Date.now();
  await description.pressSequentially(inputText);
  const typingDuration = Date.now() - startedAt;

  expect(typingDuration).toBeLessThan(1500);
  await dialog.getByRole('button', { name: /Asignaciones/i }).click();
  await expect(description).toHaveValue(inputText);
});

test('muestra todas las tareas de una celda sin resumirlas como +N', async ({ page }) => {
  await page.unroute('**/api/calendar/cronograma**');
  const taskDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
  }).format(new Date());
  const tasks = Array.from({ length: 3 }, (_, index) => ({
    id: index + 1,
    id_usuario: 1,
    usuario: 'Usuario QA',
    fecha: taskDate,
    tipo_tarea: 'Servicio',
    descripcion: `Tarea visible ${index + 1}`,
    cliente: `Cliente ${index + 1}`,
    color: ['#37A65F', '#2563EB', '#CA8A04'][index],
    estado: 'Pendiente',
    hora_inicio: `${String(8 + index).padStart(2, '0')}:30:00`,
    hora_fin: `${String(9 + index).padStart(2, '0')}:30:00`,
  }));
  await page.route('**/api/calendar/cronograma**', route => route.fulfill({
    json: { success: true, data: tasks },
  }));

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');

  const userRow = page.locator('.gantt-row').filter({ hasText: 'Usuario QA' });
  await expect(userRow.locator('[data-task-id]')).toHaveCount(3);
  await expect(userRow.getByRole('button', { name: /tareas adicionales/i })).toHaveCount(0);
  expect((await userRow.boundingBox()).height).toBeGreaterThanOrEqual(170);
});

test('confirma un guardado local sin descargar nuevamente todo el cronograma', async ({ page }) => {
  await page.unroute('**/api/calendar/cronograma**');
  const taskDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
  }).format(new Date());
  let scheduleReads = 0;
  let scheduleWrites = 0;

  await page.route('**/api/calendar/cronograma**', async (route) => {
    if (route.request().method() === 'GET') {
      scheduleReads += 1;
      return route.fulfill({ json: { success: true, data: [{
        id: 71,
        id_usuario: 1,
        usuario: 'Usuario QA',
        fecha: taskDate,
        tipo_tarea: 'Otro',
        descripcion: 'Descripción inicial',
        color: '#37A65F',
        estado: 'Pendiente',
        hora_inicio: '08:30:00',
        hora_fin: '09:30:00',
      }] } });
    }

    scheduleWrites += 1;
    return route.fulfill({ json: {
      success: true,
      data: [{
        status: 'upserted',
        resource: 'Usuario_QA',
        id: 71,
        lastModified: `${taskDate} 12:00:00`,
      }],
    } });
  });

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  await page.locator('[data-task-id="task_71"]').click();
  const readsBeforeSave = scheduleReads;

  const dialog = page.getByRole('dialog', { name: /Editar tarea/i });
  await dialog.getByLabel(/Descripción/i).fill('Descripción actualizada localmente');
  await dialog.getByRole('button', { name: /Guardar cambios/i }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('[data-task-id="task_71"]')).toContainText('Descripción actualizada localmente');

  expect(scheduleWrites).toBe(1);
  expect(scheduleReads).toBe(readsBeforeSave);
});

test('un jefe de área edita la reserva de vehículo de otra persona; otro nivel 2 no', async ({ page }) => {
  await page.unroute('**/api/calendar/cronograma**');
  const taskDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz' }).format(new Date());
  await page.route('**/api/calendar/cronograma**', route => route.fulfill({ json: { success: true, data: [{
    id: 81, id_usuario: 99, usuario: 'CAMIONETA LPZ', fecha: taskDate, tipo_tarea: 'Servicio',
    descripcion: 'Reserva de otra persona', color: '#2563EB', estado: 'Pendiente',
    hora_inicio: '08:30:00', hora_fin: '09:30:00', creado_por: 'mlopez', id_creador: 7,
  }] } }));
  const comoUsuario = (cargo) => page.addInitScript(({ cargo }) => {
    localStorage.setItem('datamet_user', JSON.stringify({ id: 1, nombre: 'Usuario QA', acceso_cron: 2, area: 'SERVICIO', cargo }));
  }, { cargo });

  await page.setViewportSize({ width: 1366, height: 768 });
  await comoUsuario('Técnico');
  await page.goto('/');
  await page.locator('[data-resource-row="CAMIONETA_LPZ"]').scrollIntoViewIfNeeded();
  await page.locator('[data-task-id="task_81"]').click();
  await expect(page.getByText(/reservado por mlopez/)).toBeVisible();
  await expect(page.getByRole('dialog', { name: /Editar tarea/i })).toHaveCount(0);

  await comoUsuario('Jefe de Área');
  await page.reload();
  await page.locator('[data-resource-row="CAMIONETA_LPZ"]').scrollIntoViewIfNeeded();
  await page.locator('[data-task-id="task_81"]').click();
  await expect(page.getByRole('dialog', { name: /Editar tarea/i })).toBeVisible();
});
