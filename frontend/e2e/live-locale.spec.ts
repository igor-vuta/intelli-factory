import { test, expect } from '@playwright/test';

test.skip(process.env.INTELLI_LIVE_E2E !== '1', 'Requires isolated local backend.');
test('account language persists across sessions and fresh browser storage', async ({
  browser,
  baseURL,
}) => {
  const first = await browser.newContext({ baseURL });
  const second = await browser.newContext({ baseURL });
  try {
    const page = await first.newPage();
    const auth = await first.request.post('/api/auth/login', {
      data: { email: 'customer.demo@intelli.local', password: 'password123' },
    });
    expect(auth.ok()).toBeTruthy();
    await page.goto('/app/customer?lang=en');
    const saved = page.waitForResponse(
      (r) => r.url().endsWith('/api/auth/preferences') && r.request().method() === 'PATCH'
    );
    await page.getByRole('link', { name: 'KK', exact: true }).click();
    expect((await saved).ok()).toBeTruthy();
    expect((await (await first.request.get('/api/auth/me')).json()).user.preferred_locale).toBe(
      'kk'
    );
    expect(
      (
        await second.request.patch('/api/auth/preferences', { data: { preferred_locale: 'ru' } })
      ).status()
    ).toBe(401);
    const fresh = await second.newPage();
    await fresh.goto('/login?lang=en');
    await fresh.getByLabel('Email', { exact: true }).fill('customer.demo@intelli.local');
    await fresh.getByLabel('Password', { exact: true }).fill('password123');
    await fresh.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(fresh).toHaveURL(/app\/customer\?lang=kk/);
    await fresh.evaluate(() => localStorage.clear());
    await fresh.goto('/app/customer');
    await expect(fresh).toHaveURL(/lang=kk/);
    expect(
      (
        await second.request.patch('/api/auth/preferences', {
          data: { preferred_locale: 'invalid' },
        })
      ).status()
    ).toBe(422);
  } finally {
    await first.request.patch('/api/auth/preferences', { data: { preferred_locale: 'en' } });
    await first.close();
    await second.close();
  }
});
