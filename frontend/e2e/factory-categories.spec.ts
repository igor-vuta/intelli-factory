import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { categoryCopy } from '../lib/categoryCopy';

// Run against the disposable local API with CATEGORY_BROWSER_FIXTURE set.
test.skip(!process.env.CATEGORY_BROWSER_FIXTURE, 'Requires isolated category browser fixture');
const fixture = process.env.CATEGORY_BROWSER_FIXTURE
  ? JSON.parse(readFileSync(process.env.CATEGORY_BROWSER_FIXTURE, 'utf8'))
  : {};
for (const locale of ['en', 'ru', 'kk'] as const) {
  test(`factory setup, draft resume and proposal in ${locale}`, async ({ page, context }) => {
    const c = categoryCopy(locale);
    await context.addCookies([
      { name: 'if_session', value: fixture.factory, url: 'http://127.0.0.1:3149' },
    ]);
    await page.goto(`http://127.0.0.1:3149/app/factory?lang=${locale}&view=inventory`);
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
    await setup
      .getByRole('combobox', { name: c.category, exact: true })
      .selectOption(fixture.category);
    await setup.getByRole('combobox', { name: c.product, exact: true }).selectOption(fixture.item);
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
      fixture.item
    );
    // Rejected publication keeps all form data and the server-side draft.
    await setup.getByRole('button', { name: c.publish, exact: true }).click();
    await expect(setup.getByRole('alert').first()).toBeVisible();
    await expect(setup.getByRole('combobox', { name: c.product, exact: true })).toHaveValue(
      fixture.item
    );
    await setup.getByLabel(`${c.quantity} (kg)`, { exact: true }).fill('10');
    await setup.getByRole('combobox', { name: c.currency, exact: true }).selectOption('USD');
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
    await expect(
      setup
        .getByRole('combobox', { name: c.category, exact: true })
        .locator('option')
        .filter({ hasText: proposalName })
    ).toHaveCount(1);
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
  await context.addCookies([
    { name: 'if_session', value: fixture.factory, url: 'http://127.0.0.1:3149' },
  ]);
  const name = `Review browser ${Date.now()}`;
  const proposal = await context.request.post('http://127.0.0.1:3149/api/categories/proposals', {
    data: { name, description: 'Link to a reviewed existing category' },
  });
  expect(proposal.ok()).toBe(true);
  await context.addCookies([
    { name: 'if_session', value: fixture.admin, url: 'http://127.0.0.1:3149' },
  ]);
  await page.goto('http://127.0.0.1:3149/app/admin?lang=ru&view=operations');
  const article = page.locator('article').filter({ hasText: name });
  await article.getByRole('combobox', { name: c.link, exact: true }).selectOption(fixture.category);
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
  await context.addCookies([
    { name: 'if_session', value: fixture.customer, url: 'http://127.0.0.1:3149' },
  ]);
  await page.goto('http://127.0.0.1:3149/app/customer?lang=en&view=requests');
  const response = await context.request.get(
    'http://127.0.0.1:3149/api/requests/bootstrap?locale=en'
  );
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
  const bad = await context.request.post('http://127.0.0.1:3149/api/requests/', {
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
  await context.addCookies([
    { name: 'if_session', value: fixture.factory, url: 'http://127.0.0.1:3149' },
  ]);
  await page.route(
    '**/api/categories/factory-setup',
    (route) => route.fulfill({ status: 503, json: { detail: 'Test outage' } }),
    { times: 1 }
  );
  await page.goto('http://127.0.0.1:3149/app/factory?lang=en&view=inventory');
  const setup = page.locator('section.factory-setup[data-section="inventory"]');
  await setup.getByRole('button', { name: c.retry, exact: true }).click();
  await expect(setup.getByLabel(c.company, { exact: true })).toBeVisible();
  await setup.getByRole('searchbox', { name: c.search }).fill('no-such-family-xyz');
  await expect(setup.getByText(c.empty, { exact: true })).toBeVisible();
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
});
