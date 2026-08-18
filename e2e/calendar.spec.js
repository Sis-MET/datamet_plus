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
    localStorage.setItem('rimmet_token', token);
    localStorage.setItem('rimmet_user', JSON.stringify({ id: 1, nombre: 'Usuario QA', acceso_cron: 3, area: 'SERVICIO' }));
    localStorage.setItem('rimmet_last_view', 'calendar');
  }, { token: `header.${tokenPayload}.signature` });

  await page.route('**/api/calendar/tecnicos', route => route.fulfill({
    json: { success: true, data: technicians },
  }));
  await page.route('**/api/calendar/cronograma*', route => route.fulfill({ json: { success: true, data: [] } }));
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
    return {
      radius: parseFloat(styles.borderTopLeftRadius),
      overflow: styles.overflow,
      backgroundColor: styles.backgroundColor,
      backgroundImage: styles.backgroundImage,
    };
  });
  expect(viewportMaterial.radius).toBeGreaterThanOrEqual(14);
  expect(viewportMaterial.overflow).toBe('hidden');
  expect(viewportMaterial.backgroundColor).toBe('rgb(21, 22, 27)');
  expect(viewportMaterial.backgroundImage).toBe('none');

  await page.locator('.gantt-scroll-container').hover();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 420);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBefore);
  const stickySidebarBox = await sidebar.boundingBox();
  expect(stickySidebarBox.y).toBeGreaterThanOrEqual(88);
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
  await page.unroute('**/api/calendar/cronograma*');
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
  await page.route('**/api/calendar/cronograma*', route => route.fulfill({
    json: { success: true, data: tasks },
  }));

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');

  const userRow = page.locator('.gantt-row').filter({ hasText: 'Usuario QA' });
  await expect(userRow.locator('[data-task-id]')).toHaveCount(3);
  await expect(userRow.getByRole('button', { name: /tareas adicionales/i })).toHaveCount(0);
  expect((await userRow.boundingBox()).height).toBeGreaterThanOrEqual(170);
});
