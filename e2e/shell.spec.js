import { expect, test } from '@playwright/test';

const tokenPayload = Buffer.from(JSON.stringify({
  exp: 4102444800,
  id: 1,
  nombre: 'Usuario QA',
  acceso_cron: 3,
})).toString('base64url');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ token }) => {
    if (sessionStorage.getItem('shell-spec-ready')) return;
    sessionStorage.setItem('shell-spec-ready', '1');
    localStorage.clear();
    localStorage.setItem('rimmet_token', token);
    localStorage.setItem('rimmet_user', JSON.stringify({ id: 1, usuario: 'qa', nombre: 'Usuario', apellido: 'QA', cargo: 'Técnico', acceso_cron: 3 }));
    localStorage.setItem('rimmet_last_view', 'rim');
  }, { token: `header.${tokenPayload}.signature` });
});

test('Ctrl+B oculta y muestra la barra lateral y recuerda la preferencia', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');

  const sidebar = page.locator('#app-sidebar');
  const nav = page.getByRole('navigation', { name: 'Módulos' });
  await expect(nav.getByRole('button', { name: 'RIM', exact: true })).toBeVisible();

  await page.keyboard.press('Control+b');
  await expect.poll(async () => (await sidebar.boundingBox())?.width ?? 0).toBeLessThan(2);
  await expect(page.getByRole('button', { name: /Mostrar barra lateral/ })).toBeVisible();

  await page.reload();
  await expect.poll(async () => (await sidebar.boundingBox())?.width ?? 0).toBeLessThan(2);

  await page.keyboard.press('Control+b');
  await expect.poll(async () => (await sidebar.boundingBox())?.width ?? 0).toBeGreaterThan(200);
  await expect(nav.getByRole('button', { name: 'Cronograma' })).toBeVisible();
});

test('en móvil Ctrl+B abre el menú como panel y Escape lo cierra', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const drawer = page.getByRole('dialog', { name: 'Menú de navegación' });
  await expect(drawer).toBeHidden();

  await page.keyboard.press('Control+b');
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Cronograma' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});

test('el cambio de tema se aplica a toda la interfaz y persiste', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');

  const canvas = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const lightCanvas = await canvas();
  await expect(page.locator('html')).not.toHaveClass(/dark/);

  await page.getByRole('button', { name: 'Cambiar a tema oscuro' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect.poll(canvas).not.toBe(lightCanvas);

  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('button', { name: 'Cambiar a tema claro' })).toBeVisible();
});
