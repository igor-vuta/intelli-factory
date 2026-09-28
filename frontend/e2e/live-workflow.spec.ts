import { test, expect, type Page } from '@playwright/test';

test.skip(process.env.INTELLI_LIVE_E2E !== '1', 'Requires an isolated, seeded local backend.');
test.setTimeout(120000);

async function post(page: Page, path: string, data: object) {
  const response = await page.request.post(`/api${path}`, { data });
  const result = await response.json();
  expect(response.ok(), `${path}: ${JSON.stringify(result)}`).toBeTruthy();
  return result;
}
/** Completes factory setup (profile, location, one leaf category) and returns that category. */
async function readyFactory(factory: Page) {
  const call = async (method: string, path: string, data: object) => {
    const response = await factory.request.fetch(`/api${path}`, { method, data });
    expect(response.ok(), `${path}: ${await response.text()}`).toBeTruthy();
  };
  await call('PATCH', '/categories/factory-profile', {
    legal_name: 'Demo Factory',
    contact_name: 'Demo Contact',
    phone: '+7 700 000 0001',
  });
  await call('PUT', '/categories/factory-location', {
    country_code: 'KZ',
    region_name: 'Almaty Region',
    city_name: 'Almaty',
    street: 'Test factory 10',
  });
  const bootstrap = await (await factory.request.get('/api/requests/bootstrap')).json();
  const categories = bootstrap.categories as { id: string; parent_id: string | null }[];
  const leaf = categories.find((c) => !categories.some((child) => child.parent_id === c.id))!;
  await call('PUT', '/categories/factory-selections', { category_ids: [leaf.id] });
  return leaf.id;
}

async function login(page: Page, role: string) {
  await page.goto('/login?lang=en');
  await page.getByLabel('Email', { exact: true }).fill(`${role}.demo@intelli.local`);
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/app/${role}`));
  await expect(page.locator('h1:visible')).toBeVisible();
}

test('real database: request, bid, quote, optimisation, three signatures, mock payment, delivery, acceptance and ratings', async ({
  browser,
  baseURL,
  viewport,
  isMobile,
  hasTouch,
}) => {
  expect(new URL(baseURL!).hostname).toBe('127.0.0.1');
  const contexts = await Promise.all(
    ['customer', 'factory', 'logist', 'admin'].map(() =>
      browser.newContext({ baseURL, viewport, isMobile, hasTouch })
    )
  );
  const [customer, factory, logist, admin] = await Promise.all(
    contexts.map((context) => context.newPage())
  );
  try {
    for (const [page, role] of [
      [customer, 'customer'],
      [factory, 'factory'],
      [logist, 'logist'],
      [admin, 'admin'],
    ] as const)
      await login(page, role);
    const name = `UX steel ${Date.now()}`;
    const categoryId = await readyFactory(factory);
    await post(factory, '/requests/inventory-entries', {
      category_id: categoryId,
      item_name: name,
      unit: 'pcs',
      stock_country_code: 'KZ',
      stock_region_name: 'Almaty Region',
      stock_city_name: 'Almaty',
      stock_street: 'Test factory 10',
      quantity_available: 100,
      price_per_unit: 25,
      currency_code: 'KZT',
    });
    const inventory = await (
      await factory.request.get('/api/requests/inventory-entries/mine')
    ).json();
    const entry = inventory.find((item: { item_name: string }) => item.item_name === name);
    expect(entry).toBeTruthy();
    const request = await post(customer, '/requests/', {
      category_id: entry.category_id,
      item_id: entry.item_id,
      quantity: 10,
      quantity_unit: 'pcs',
      destination_country_code: 'KZ',
      destination_region_name: 'Almaty Region',
      destination_city_name: 'Almaty',
      destination_street: 'Test customer 20',
      preferred_currency_code: 'KZT',
    });
    const bid = await post(factory, '/pairing/factory-bids', {
      request_id: request.request_id,
      inventory_entry_id: entry.id,
      quoted_quantity: 10,
    });
    const quote = await post(logist, '/pairing/logist-quotes', {
      factory_bid_id: bid.candidate_id,
      title: 'Local test delivery',
      base_price: 50,
      delivery_price: 50,
      delivery_days: 2,
      currency_code: 'KZT',
    });
    await post(admin, '/automations/optimize', { request_id: request.request_id, mode: 'fast' });
    const comparison = await post(admin, '/automations/optimize/compare', {
      request_id: request.request_id,
      mode: 'deep',
    });
    for (const strategy of ['greedy', 'fast', 'deep'])
      expect(comparison[strategy].length).toBeGreaterThan(0);
    const selected = await post(customer, '/pairing/select-candidate', {
      candidate_id: quote.candidate_id,
    });
    const tx = selected.transaction_id;
    const txRow = (page: Page) => page.getByRole('row').filter({ hasText: tx.slice(0, 8) });
    for (const [page, role] of [
      [customer, 'customer'],
      [factory, 'factory'],
      [logist, 'logist'],
    ] as const) {
      await page.goto(`/app/${role}?view=workflow&lang=en`);
      await txRow(page).getByRole('button', { name: 'Sign', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Contract Review & Signature' });
      await dialog.getByLabel('Full name', { exact: true }).fill(`Test ${role}`);
      await dialog.getByRole('checkbox').check();
      const response = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/transactions/${tx}/sign`) &&
          response.request().method() === 'POST'
      );
      await dialog.getByRole('button', { name: 'Sign Contract' }).click();
      expect((await response).ok()).toBeTruthy();
      await expect(dialog).toHaveCount(0);
    }
    await customer.goto('/app/customer?view=workflow&lang=en');
    await txRow(customer).getByRole('button', { name: 'Pay', exact: true }).click();
    const payment = customer.getByRole('dialog', { name: 'Payment Mockup Checkout' });
    await payment.getByRole('button', { name: 'Wallet', exact: true }).click();
    await payment.getByPlaceholder('demo.customer@wallet.test').fill('local@example.test');
    await payment.getByRole('checkbox').check();
    await payment.getByRole('button', { name: 'Pay (Mock)' }).click();
    await expect(payment).toHaveCount(0);
    await factory.goto('/app/factory?view=workflow&lang=en');
    await txRow(factory).getByRole('button', { name: 'Given to logist' }).click();
    await factory.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(txRow(factory).locator('[data-status="FULFILLMENT_STARTED"]')).toBeVisible();
    await logist.goto('/app/logist?view=workflow&lang=en');
    await txRow(logist).getByRole('button', { name: 'Delivered', exact: true }).click();
    await logist.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(txRow(logist).locator('[data-status="IN_PROGRESS"]')).toBeVisible();
    await customer.goto('/app/customer?view=workflow&lang=en');
    await txRow(customer).getByRole('button', { name: 'Accept', exact: true }).click();
    await customer
      .getByRole('dialog')
      .getByRole('button', { name: 'Confirm', exact: true })
      .click();
    await expect(txRow(customer).locator('[data-status="COMPLETED"]')).toBeVisible();
    await txRow(customer).getByRole('button', { name: 'Rate', exact: true }).click();
    await customer.getByRole('dialog').getByRole('button', { name: 'Submit rating' }).click();
    await expect(customer.getByText('Rating submitted. Thank you!')).toBeVisible();
    const transactions = await (await customer.request.get('/api/transactions/mine')).json();
    expect(transactions.find((item: { id: string }) => item.id === tx).status).toBe('COMPLETED');
    await test.info().attach('completed-transaction', {
      body: JSON.stringify({ transaction_id: tx, request_id: request.request_id, item: name }),
      contentType: 'application/json',
    });
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test('real registration and verification link complete through the UI', async ({
  page,
  baseURL,
}) => {
  expect(new URL(baseURL!).hostname).toBe('127.0.0.1');
  const email = `ux-${Date.now()}@example.test`;
  const result = await post(page, '/auth/register', {
    email,
    password: 'Localtest123!',
    role: 'CUSTOMER',
    display_name: 'Local UX Customer',
    phone: '+7 700 000 0000',
    country_code: 'KZ',
    region_name: 'Almaty Region',
    city_name: 'Almaty',
    street: 'Local test 30',
    preferred_currency_code: 'KZT',
  });
  const link = result.message.match(/http:\/\/127\.0\.0\.1:3100\/verify-email\?token=\S+/)?.[0];
  expect(link).toBeTruthy();
  await page.goto(link);
  await page
    .locator('form')
    .first()
    .getByRole('button', { name: /verify/i })
    .click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Localtest123!');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/customer/);
});

test('real database: record actions keep the lifecycle guards', async ({ browser, baseURL }) => {
  expect(new URL(baseURL!).hostname).toBe('127.0.0.1');
  const contexts = await Promise.all(
    ['customer', 'factory', 'logist'].map(() => browser.newContext({ baseURL }))
  );
  const [customer, factory, logist] = await Promise.all(contexts.map((c) => c.newPage()));
  const call = async (page: Page, method: string, path: string, data?: object) => {
    const response = await page.request.fetch(`/api${path}`, { method, data });
    return { status: response.status(), body: await response.json().catch(() => null) };
  };
  try {
    for (const [page, role] of [
      [customer, 'customer'],
      [factory, 'factory'],
      [logist, 'logist'],
    ] as const)
      await login(page, role);
    const name = `Record steel ${Date.now()}`;
    const categoryId = await readyFactory(factory);
    await post(factory, '/requests/inventory-entries', {
      category_id: categoryId,
      item_name: name,
      unit: 'pcs',
      stock_country_code: 'KZ',
      stock_region_name: 'Almaty Region',
      stock_city_name: 'Almaty',
      stock_street: 'Test factory 11',
      quantity_available: 100,
      price_per_unit: 25,
      currency_code: 'KZT',
    });
    const entry = (
      await (await factory.request.get('/api/requests/inventory-entries/mine')).json()
    ).find((item: { item_name: string }) => item.item_name === name);
    const request = await post(customer, '/requests/', {
      category_id: entry.category_id ?? categoryId,
      item_id: entry.item_id,
      quantity: 10,
      quantity_unit: 'pcs',
      destination_country_code: 'KZ',
      destination_region_name: 'Almaty Region',
      destination_city_name: 'Almaty',
      destination_street: 'Test customer 21',
      preferred_currency_code: 'KZT',
    });
    const id = request.request_id;
    const openIds = async () =>
      (
        (await (await factory.request.get('/api/pairing/open-requests')).json()) as { id: string }[]
      ).map((r) => r.id);

    // Edit before any bid; pausing hides the request from factories until it resumes.
    expect((await call(customer, 'PATCH', `/requests/${id}`, { quantity: 12 })).status).toBe(200);
    expect((await call(customer, 'POST', `/requests/${id}/pause`)).status).toBe(200);
    expect(await openIds()).not.toContain(id);
    expect(
      (
        await call(factory, 'POST', '/pairing/factory-bids', {
          request_id: id,
          inventory_entry_id: entry.id,
          quoted_quantity: 12,
        })
      ).status
    ).toBe(400);
    expect((await call(customer, 'POST', `/requests/${id}/resume`)).status).toBe(200);
    expect(await openIds()).toContain(id);

    // After a bid: no editing, the stock price is locked, and withdrawing reopens both.
    const bid = await post(factory, '/pairing/factory-bids', {
      request_id: id,
      inventory_entry_id: entry.id,
      quoted_quantity: 12,
    });
    expect((await call(customer, 'PATCH', `/requests/${id}`, { quantity: 13 })).status).toBe(409);
    expect(
      (
        await call(factory, 'PATCH', `/requests/inventory-entries/${entry.id}`, {
          price_per_unit: 30,
        })
      ).status
    ).toBe(409);
    const quote = await post(logist, '/pairing/logist-quotes', {
      factory_bid_id: bid.candidate_id,
      title: 'Record test delivery',
      base_price: 40,
      delivery_price: 40,
      delivery_days: 2,
      currency_code: 'KZT',
    });
    expect(
      (await call(logist, 'DELETE', `/pairing/logist-quotes/${quote.candidate_id}`)).status
    ).toBe(200);
    expect(
      (await call(factory, 'DELETE', `/pairing/factory-bids/${bid.candidate_id}`)).status
    ).toBe(200);
    expect(
      (
        await call(factory, 'PATCH', `/requests/inventory-entries/${entry.id}`, {
          price_per_unit: 30,
        })
      ).status
    ).toBe(200);
    const mine = (await (await customer.request.get('/api/requests/')).json()) as {
      id: string;
      status: string;
    }[];
    expect(mine.find((r) => r.id === id)?.status).toBe('PENDING');

    // Cancel, then delete; a deleted request leaves the customer's list.
    expect(
      (await call(customer, 'PATCH', `/requests/${id}/status`, { status: 'CANCELLED' })).status
    ).toBe(200);
    expect((await call(customer, 'DELETE', `/requests/${id}`)).status).toBe(200);
    const after = (await (await customer.request.get('/api/requests/')).json()) as { id: string }[];
    expect(after.map((r) => r.id)).not.toContain(id);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
