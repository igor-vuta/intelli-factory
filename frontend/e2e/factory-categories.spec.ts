import { readFileSync } from 'node:fs';
import { test, expect, type Locator, type Page } from '@playwright/test';
import { categoryCopy } from '../lib/categoryCopy';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('if-preferences-configured', '1'));
});

// Run against the disposable local API with CATEGORY_BROWSER_FIXTURE set.
test.skip(!process.env.CATEGORY_BROWSER_FIXTURE, 'Requires isolated category browser fixture');
const preview = process.env.CATEGORY_PREVIEW_URL ?? 'http://127.0.0.1:3149';
async function choose(page: Page, field: Locator, id: string) {
  await field.click();
  await page.locator(`[role=option]:has([data-choice-id="${id}"])`).click();
}
const fixture = process.env.CATEGORY_BROWSER_FIXTURE
  ? JSON.parse(readFileSync(process.env.CATEGORY_BROWSER_FIXTURE, 'utf8'))
  : {};
for (const locale of ['en', 'ru', 'kk'] as const) {
  test(`factory setup, draft resume and proposal in ${locale}`, async ({ page, context }) => {
    const c = categoryCopy(locale);
    await context.addCookies([{ name: 'if_session', value: fixture.factory, url: preview }]);
    await page.goto(`${preview}/app/factory?lang=${locale}&view=inventory`);
    const setup = page.locator('section.factory-setup[data-section="inventory"]');
    await expect(setup.getByRole('heading', { name: c.setup, exact: true })).toBeVisible();
    await setup.getByRole('searchbox', { name: c.search }).fill(fixture.categoryName);
    const checkbox = setup.getByRole('checkbox', { name: fixture.categoryName, exact: true });
    await checkbox.focus();
    if (!(await checkbox.isChecked())) await page.keyboard.press('Space');
    await setup
      .getByRole('searchbox', { name: c.search })
      .fill(fixture.secondName ?? 'Second production family');
    await setup
      .getByRole('checkbox', {
        name: fixture.secondName ?? 'Second production family',
        exact: true,
      })
      .check();
    await setup.getByRole('button', { name: c.saveCategories, exact: true }).click();
    await expect(setup.getByRole('status').filter({ hasText: c.saved })).toBeVisible();
    await setup.getByRole('button', { name: c.newDraft, exact: true }).click();
    await choose(
      page,
      setup.getByRole('combobox', { name: c.category, exact: true }),
      fixture.category
    );
    await choose(page, setup.getByRole('combobox', { name: c.product, exact: true }), fixture.item);
    await setup.getByRole('button', { name: c.save, exact: true }).click();
    await expect(
      setup.getByRole('button', { name: `${c.resume}: Test product`, exact: true }).last()
    ).toBeVisible();
    await page.reload();
    await setup
      .getByRole('button', { name: `${c.resume}: Test product`, exact: true })
      .first()
      .click();
    await expect(setup.getByRole('combobox', { name: c.product, exact: true })).toHaveValue(
      'Test product'
    );
    // Rejected publication keeps all form data and the server-side draft.
    await setup.getByRole('button', { name: c.publish, exact: true }).click();
    await expect(setup.getByRole('alert').first()).toBeVisible();
    await expect(setup.getByRole('combobox', { name: c.product, exact: true })).toHaveValue(
      'Test product'
    );
    await setup.getByLabel(`${c.quantity} (kg)`, { exact: true }).fill('10');
    await choose(page, setup.getByRole('combobox', { name: c.currency, exact: true }), 'USD');
    await setup.getByLabel(`${c.price} (USD / kg)`, { exact: true }).fill('2');
    await setup.getByRole('button', { name: c.publish, exact: true }).click();
    await expect(setup.getByRole('status').filter({ hasText: c.published })).toBeVisible();
    await expect(setup.getByRole('status').filter({ hasText: c.ready })).toBeVisible();
    const proposalName = `Browser family ${locale} ${Date.now()}`;
    await setup.getByLabel(c.name, { exact: true }).fill(proposalName);
    await setup
      .getByLabel(c.description, { exact: true })
      .fill('A missing product family for the test');
    await setup.getByRole('button', { name: c.submit, exact: true }).click();
    await expect(setup.getByText(`${proposalName} — ${c.pending}`, { exact: true })).toBeVisible();
    await setup.getByRole('combobox', { name: c.category, exact: true }).click();
    await expect(page.getByRole('option').filter({ hasText: proposalName })).toHaveCount(1);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    await page.screenshot({
      path: `/private/tmp/factory-categories-${locale}-${test.info().project.name}.png`,
      fullPage: true,
    });
  });
}

test('administrator reviews a factory proposal against the shared catalogue', async ({
  page,
  context,
}) => {
  const c = categoryCopy('ru');
  await context.addCookies([{ name: 'if_session', value: fixture.factory, url: preview }]);
  const name = `Review browser ${Date.now()}`;
  const proposal = await context.request.post(preview + '/api/categories/proposals', {
    data: { name, description: 'Link to a reviewed existing category' },
  });
  expect(proposal.ok()).toBe(true);
  await context.addCookies([{ name: 'if_session', value: fixture.admin, url: preview }]);
  await page.goto(preview + '/app/admin?lang=ru&view=operations');
  const article = page.locator('article').filter({ hasText: name });
  await choose(
    page,
    article.getByRole('combobox', { name: c.link, exact: true }),
    fixture.category
  );
  await article.getByLabel(c.note, { exact: true }).fill('Связано с существующей категорией');
  await article.getByRole('button', { name: c.approve, exact: true }).click();
  await expect(article.getByText(`${name} — ${c.approved}`, { exact: true })).toBeVisible();
  await page.reload();
  await expect(article.getByText(`${name} — ${c.approved}`, { exact: true })).toBeVisible();
});

test('customer and factory receive the same product identity and definitions', async ({
  page,
  context,
}) => {
  await context.addCookies([{ name: 'if_session', value: fixture.customer, url: preview }]);
  await page.goto(preview + '/app/customer?lang=en&view=requests');
  const response = await context.request.get(preview + '/api/requests/bootstrap?locale=en');
  const catalog = await response.json();
  expect(catalog.categories.find((c: { id: string }) => c.id === fixture.category).name).toBe(
    fixture.categoryName
  );
  expect(catalog.items.find((i: { id: string }) => i.id === fixture.item)).toMatchObject({
    category_id: fixture.category,
    unit: 'kg',
  });
  await expect(
    page.getByRole('heading', { name: 'Request a category', exact: true })
  ).toBeVisible();
  const bad = await context.request.post(preview + '/api/requests/', {
    data: {
      category_id: fixture.second,
      item_id: fixture.item,
      quantity: 10,
      quantity_unit: 'kg',
      destination_address_id: fixture.address,
      preferred_currency_code: 'USD',
    },
  });
  expect(bad.status()).toBe(422);
});

test('setup load retry, empty search and failed save preserve form values', async ({
  page,
  context,
}) => {
  const c = categoryCopy('en');
  await context.addCookies([{ name: 'if_session', value: fixture.factory, url: preview }]);
  await page.route(
    '**/api/categories/factory-setup',
    (route) => route.fulfill({ status: 503, json: { detail: 'Test outage' } }),
    { times: 1 }
  );
  await page.goto(preview + '/app/factory?lang=en&view=inventory');
  const setup = page.locator('section.factory-setup[data-section="inventory"]');
  await setup.getByRole('button', { name: c.retry, exact: true }).click();
  await expect(setup.getByLabel(c.company, { exact: true })).toBeVisible();
  await setup.getByRole('searchbox', { name: c.search }).fill('no-such-family-xyz');
  await expect(setup.getByText(c.empty, { exact: true })).toBeVisible();
  await setup.getByLabel(c.company, { exact: true }).fill('Unsaved company edit');
  await setup.getByRole('button', { name: c.newDraft, exact: true }).click();
  await setup.getByLabel(c.newProduct, { exact: true }).fill('Preserved offline draft');
  await page.route(
    '**/api/categories/drafts/*',
    (route) => route.fulfill({ status: 503, json: { detail: 'Test outage' } }),
    { times: 1 }
  );
  await setup.getByRole('button', { name: c.save, exact: true }).click();
  await expect(setup.getByRole('alert')).toBeVisible();
  await expect(setup.getByLabel(c.newProduct, { exact: true })).toHaveValue(
    'Preserved offline draft'
  );
  await setup.getByRole('button', { name: c.save, exact: true }).click();
  await expect(
    setup.getByRole('button', { name: `${c.resume}: Preserved offline draft`, exact: true }).last()
  ).toBeVisible();
  await expect(setup.getByLabel(c.company, { exact: true })).toHaveValue('Unsaved company edit');
});

test('company actions and location sheet retain edits after a failed save', async ({
  page,
  context,
}) => {
  await context.addCookies([{ name: 'if_session', value: fixture.factory, url: preview }]);
  await page.goto(`${preview}/app/factory?lang=en&view=inventory`);
  const company = page.locator('#setup-company');
  await company
    .getByRole('textbox', { name: 'Company name', exact: true })
    .fill('Factory action check');
  const profileResponse = page.waitForResponse(
    (r) => r.url().endsWith('/categories/factory-profile') && r.request().method() === 'PATCH'
  );
  await company.getByRole('button', { name: 'Save company details', exact: true }).click();
  expect((await profileResponse).ok()).toBeTruthy();
  await expect(page.getByRole('status').filter({ hasText: 'Saved · Company name' })).toBeVisible();
  await company.getByRole('button', { name: 'Company location', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Company location' });
  const bootstrap = await (await page.request.get(`${preview}/api/requests/bootstrap`)).json();
  const country = bootstrap.countries[0];
  await choose(page, sheet.getByRole('combobox', { name: /Country/ }), country.code);
  await sheet.getByRole('combobox', { name: /Region/ }).fill('Test region');
  await sheet.getByRole('combobox', { name: /City/ }).fill('Test city');
  await sheet.getByRole('textbox', { name: /Street/ }).fill('Saved location 12');
  await page.route(
    '**/api/categories/factory-location',
    (route) => route.fulfill({ status: 503, json: { detail: 'Temporary save failure' } }),
    { times: 1 }
  );
  await sheet.getByRole('button', { name: 'Save location', exact: true }).click();
  await expect(sheet.getByRole('alert')).toContainText('Temporary save failure');
  await expect(sheet.getByRole('textbox', { name: /Street/ })).toHaveValue('Saved location 12');
  const locationResponse = page.waitForResponse(
    (r) => r.url().endsWith('/categories/factory-location') && r.request().method() === 'PUT'
  );
  await sheet.getByRole('button', { name: 'Save location', exact: true }).click();
  expect((await locationResponse).ok()).toBeTruthy();
  await expect(sheet).toHaveCount(0);
  await expect(company.locator('.location-launch')).toContainText('Saved location 12');
});
