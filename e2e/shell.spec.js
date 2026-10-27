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
    localStorage.setItem('datamet_token', token);
    localStorage.setItem('datamet_user', JSON.stringify({ id: 1, usuario: 'qa', nombre: 'Usuario', apellido: 'QA', cargo: 'Técnico', acceso_cron: 3 }));
    localStorage.setItem('datamet_last_view', 'rim');
  }, { token: `header.${tokenPayload}.signature` });

  // Sin backend real: la API responde como servidor no disponible, aunque haya
  // una API levantada en el puerto del proxy (su 401 cerraría la sesión).
  // (Por ruta: `**/api/**` también atraparía módulos de Vite como /src/shared/api/.)
  await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ status: 503, json: { success: false, message: 'Sin simular en la prueba' } }));
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

test('cada apartado tiene su dirección y el botón Atrás vuelve al anterior', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  // En la raíz se abre el último apartado y la dirección se completa con su pestaña.
  await expect(page).toHaveURL(/\/rim\/registros$/);

  const nav = page.getByRole('navigation', { name: 'Módulos' });
  await nav.getByRole('button', { name: 'Cronograma' }).click();
  await expect(page).toHaveURL(/\/cronograma$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Cronograma Métrica' })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/rim\/registros$/);
  // La barra superior nombra el apartado y la sección abierta.
  await expect(page.getByRole('heading', { level: 1, name: /^RIM ?: Registros$/ })).toBeVisible();

  await nav.getByRole('link', { name: 'Numeración' }).click();
  await expect(page).toHaveURL(/\/rim\/numeracion$/);
  await expect(page.getByRole('heading', { level: 1, name: /^RIM ?: Numeración$/ })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/rim\/registros$/);

  // Una dirección se puede abrir directamente (por ejemplo, desde un correo).
  await page.goto('/sistema/fallas');
  await expect(page.getByRole('heading', { level: 1, name: 'Registro de fallas' })).toBeVisible();
});

test('cada área despliega sus secciones y cada una abre su pestaña', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/rim/numeracion');

  const nav = page.getByRole('navigation', { name: 'Módulos' });
  // El apartado actual llega abierto, con su sección marcada.
  const rim = nav.getByRole('button', { name: 'RIM', exact: true });
  await expect(rim).toHaveAttribute('aria-expanded', 'true');
  await expect(nav.getByRole('link', { name: 'Numeración' })).toHaveAttribute('aria-current', 'page');

  // Una sola sub-lista abierta: desplegar Calibración cierra la de RIM.
  const calibracion = nav.getByRole('button', { name: 'Calibración' });
  await calibracion.click();
  await expect(calibracion).toHaveAttribute('aria-expanded', 'true');
  await expect(rim).toHaveAttribute('aria-expanded', 'false');
  await expect(nav.getByRole('link', { name: 'Numeración' })).toBeHidden();

  await nav.getByRole('link', { name: 'Equipos' }).click();
  await expect(page).toHaveURL(/\/calibracion\/equipos$/);
  await expect(nav.getByRole('link', { name: 'Equipos' })).toHaveAttribute('aria-current', 'page');

  await page.goBack();
  await expect(page).toHaveURL(/\/rim\/numeracion$/);
  await expect(rim).toHaveAttribute('aria-expanded', 'true');
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
