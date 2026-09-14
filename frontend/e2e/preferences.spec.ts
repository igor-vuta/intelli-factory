import { test, expect } from '@playwright/test';

test('welcome chooses language and theme once; later changes require profile settings', async ({
  page,
}) => {
  let account = false;
  let fail = false;
  const saved: string[] = [];
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/preferences') {
      if (fail) return route.fulfill({ status: 503, json: { detail: 'Unavailable' } });
      if (!account) return route.fulfill({ status: 401, json: { detail: 'Sign in' } });
      saved.push(route.request().postDataJSON().preferred_locale);
      return route.fulfill({ json: { status: 'success' } });
    }
    if (path === '/api/auth/me')
      return route.fulfill({
        json: { user: { id: 'preferences-user', role: 'CUSTOMER', is_email_verified: true } },
      });
    if (path === '/api/requests/bootstrap')
      return route.fulfill({
        json: {
          user: { id: 'preferences-user', role: 'CUSTOMER', is_email_verified: true },
          categories: [],
          items: [],
          countries: [],
          currencies: [],
          addresses: [],
        },
      });
    return route.fulfill({ json: [] });
  });
  await page.goto('/?lang=en');
  const welcome = page.getByRole('dialog');
  await expect(welcome.getByRole('heading', { name: 'Make yourself at home' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(welcome).toBeVisible();
  await welcome.getByRole('combobox', { name: 'Language', exact: true }).click();
  await page.getByRole('option', { name: 'Русский', exact: true }).click();
  await welcome.getByRole('radio', { name: 'Grove', exact: true }).check();
  await welcome.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('html')).toHaveClass('theme-whatsapp-emerald');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('header').getByRole('combobox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Open theme picker/ })).toHaveCount(0);
  account = true;
  await page.goto('/app/customer?lang=ru');
  await page.getByRole('button', { name: 'Настройки профиля', exact: true }).click();
  await page.getByRole('radio', { name: 'Pearl', exact: true }).check();
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveClass('theme-whatsapp-emerald');
  await page.getByRole('button', { name: 'Настройки профиля', exact: true }).click();
  await page.getByRole('radio', { name: 'Pearl', exact: true }).check();
  await page.getByRole('combobox', { name: 'Язык', exact: true }).click();
  await page.getByRole('option', { name: 'English', exact: true }).click();
  fail = true;
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Could not save');
  await expect(page.locator('html')).toHaveClass('theme-whatsapp-emerald');
  fail = false;
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('html')).toHaveClass('theme-modern-light');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(saved).toEqual(['en']);
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('welcome is keyboard accessible and fits the viewport', async ({ page }) => {
  await page.route('**/api/auth/preferences', (route) =>
    route.fulfill({ status: 401, json: { detail: 'Sign in' } })
  );
  await page.goto('/?lang=kk');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Өзіңізге ыңғайлап алыңыз' })).toBeVisible();
  await dialog.getByRole('radio', { name: 'Grove', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('radio', { name: 'Pearl', exact: true })).toBeChecked();
  const box = await dialog.locator('.preferences-panel').boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({
    path: `/private/tmp/preferences-welcome-${test.info().project.name}.png`,
    animations: 'disabled',
  });
  await dialog.getByRole('button', { name: 'Жалғастыру', exact: true }).click();
  await expect(page.locator('html')).toHaveClass('theme-modern-light');
});

test('a touch can finish selecting a language before the list closes', async ({ page }) => {
  await page.goto('/?lang=en');
  const field = page.getByRole('combobox', { name: 'Language', exact: true });
  await field.click();
  const option = page.getByRole('option', { name: 'Русский', exact: true });
  await option.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 1 });
  // Mobile browsers may blur the search input before delivering the option click.
  await field.evaluate((input: HTMLInputElement) => input.blur());
  await page.waitForTimeout(250);
  await expect(option).toBeVisible();
  await option.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 1 });
  await option.click();
  await expect(page.getByRole('combobox', { name: 'Язык', exact: true })).toHaveValue('Русский');
  await page.getByRole('radio', { name: 'Pearl', exact: true }).check();
  await expect(page.getByRole('radio', { name: 'Pearl', exact: true })).toBeChecked();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('mobile theme cards remain selectable after dismissing language choices', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Exercises touch input');
  await page.route('**/api/auth/preferences', (route) =>
    route.fulfill({ status: 401, json: { detail: 'Sign in' } })
  );
  await page.goto('/?lang=en');
  await page.getByRole('combobox', { name: 'Language', exact: true }).tap();
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.getByRole('heading', { name: 'Make yourself at home' }).tap();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  for (const name of ['Grove', 'Midnight', 'Pearl']) {
    await page.locator('.preference-theme').filter({ hasText: name }).tap();
    await expect(page.getByRole('radio', { name, exact: true })).toBeChecked();
    await expect(page.getByRole('dialog')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Continue', exact: true }).tap();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('html')).toHaveClass('theme-modern-light');
});
