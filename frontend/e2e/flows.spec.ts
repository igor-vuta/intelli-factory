import { experienceTranslations } from '../lib/experienceI18n';
import { guidanceText } from '../lib/guidance';
import { test, expect, type Page } from '@playwright/test';

const roles = ['customer', 'factory', 'logist', 'admin'] as const;
async function mockApi(page: Page, role = 'CUSTOMER', authorized = true, userId = 'test-user') {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const user = { id: userId, email: 'test@example.com', role, is_email_verified: true };
    if (path === '/api/auth/me' || path === '/api/auth/login') {
      await route.fulfill({
        status: authorized ? 200 : 401,
        json: authorized ? { status: 'success', user } : { detail: 'Please log in' },
      });
      return;
    }
    const bootstrap = {
      user,
      categories: [
        { id: 'metal', name: 'Metal', slug: 'metal' },
        { id: 'wood', name: 'Wood', slug: 'wood' },
      ],
      items: [],
      addresses: [],
      currencies: [{ code: 'KZT', name: 'Tenge' }],
      countries: [{ code: 'KZ', name: 'Kazakhstan' }],
    };
    const data =
      path === '/api/requests/bootstrap'
        ? bootstrap
        : path === '/api/auth/countries'
          ? [{ code: 'KZ', label: 'Kazakhstan' }]
          : path === '/api/auth/currencies'
            ? [{ code: 'KZT', name: 'Tenge' }]
            : path === '/api/addresses/bootstrap'
              ? { regions: [], cities: [] }
              : path === '/api/auth/logout'
                ? { status: 'success' }
                : [];
    await route.fulfill({ json: data });
  });
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

async function chooseMode(page: Page, mode: 'system' | 'light' | 'dark') {
  // By value, so the helper works in every language.
  await page.locator(`input[name="color-mode"][value="${mode}"]`).check();
  await expect(page.locator('html')).toHaveAttribute(
    'data-mode',
    mode === 'system' ? /light|dark/ : mode
  );
}

test('colour mode persists across navigation and reload; language is retained', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto('/?lang=ru');
  await page.locator('nav a[href="/login?lang=ru"]').click();
  await expect(page).toHaveURL(/login\?lang=ru/);
  for (const mode of ['light', 'dark', 'system'] as const) {
    await chooseMode(page, mode);
    await noOverflow(page);
  }
  await chooseMode(page, 'light');
  await page.goto('/register?lang=ru');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await noOverflow(page);
});

test('colour mode switcher works from the keyboard', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/login');
  const system = page.locator('input[name="color-mode"][value="system"]');
  await expect(system).toBeChecked();
  await system.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('input[name="color-mode"][value="light"]')).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
});

for (const role of roles) {
  test(`${role}: login, workspace, identity and logout`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await mockApi(page, role.toUpperCase());
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill('test@example.com');
    await page.getByLabel('Password', { exact: true }).fill('Password123');
    await page.getByRole('button', { name: /log in|sign in/i }).click();
    await expect(page).toHaveURL(new RegExp(`/app/${role}`));
    await expect(page.locator('h1:visible')).toBeVisible();
    // Every role shares one identity (M2); the page title names the section and role.
    await expect(page.locator('html')).toHaveClass(/\bidentity\b/);
    await expect(page).toHaveTitle(/· Intelli-Factory$/);
    await noOverflow(page);
    await page.screenshot({
      path: `test-results/${role}-${test.info().project.name}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('button', { name: /log out|logout/i }).click();
    await expect(page).toHaveURL(/\/login/);
    expect(errors).toEqual([]);
  });
  test(`${role}: unauthenticated direct route returns to login`, async ({ page }) => {
    await mockApi(page, role.toUpperCase(), false);
    await page.goto(`/app/${role}?lang=kk`);
    await expect(page).toHaveURL(/\/login\?lang=kk/);
  });
}

test('role entry links preselect registration and public routes fit viewport', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await page.locator('a[href="/register?role=FACTORY&lang=en"]').click();
  await expect(page.locator('#role')).toHaveValue('Factory');
  await noOverflow(page);
  await page.goto('/verify-email');
  await expect(page.locator('h1:visible')).toBeVisible();
  await noOverflow(page);
});

test('customer request dialog traps focus, closes with Escape and restores focus', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto('/app/customer');
  const trigger = page.getByRole('button', { name: /new request|create request/i }).first();
  await trigger.click();
  const modal = page.getByRole('dialog', { name: 'New Supply Request' });
  await expect(modal).toBeVisible();
  await expect(modal).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  expect(await modal.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Tab');
  expect(await modal.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('login failures remain actionable', async ({ page }) => {
  await mockApi(page, 'CUSTOMER', false);
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('test@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Password123');
  await page.getByRole('button', { name: /log in|sign in/i }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('Please log in');
  await expect(page.getByRole('button', { name: /log in|sign in/i })).toBeEnabled();
});

test('an authenticated user opening another role goes to their own workspace', async ({ page }) => {
  await mockApi(page, 'FACTORY');
  await page.goto('/app/admin?lang=ru');
  await expect(page).toHaveURL('/app/factory?lang=ru');
});

test('stored colour mode wins over the system setting and invalid values recover', async ({
  page,
}) => {
  await mockApi(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('if-color-mode', 'sepia');
      sessionStorage.setItem('seeded', '1');
    }
  });
  await page.goto('/app/customer');
  // An unknown stored value falls back to the system setting.
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  await chooseMode(page, 'light');
  await page.locator('header a').first().click();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
  await page.goto('/app/customer');
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
});

test('autocomplete supports arrow selection without submitting the request', async ({ page }) => {
  await mockApi(page);
  await page.goto('/app/customer');
  await page
    .getByRole('button', { name: /new request/i })
    .first()
    .click();
  const field = page.getByRole('combobox', { name: /category/i });
  await field.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(field).toHaveValue('Wood');
  await expect(page.getByRole('dialog')).toBeVisible();
  await field.fill('Custom category');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('failed cancellation is visible and the action can be retried', async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/requests/', (route) =>
    route.fulfill({
      json: [
        {
          id: 'request-1',
          item_name: 'Steel',
          category_name: 'Metal',
          quantity: '10',
          quantity_unit: 'kg',
          preferred_currency_code: 'KZT',
          status: 'PENDING',
          created_at: '2026-09-14T00:00:00Z',
        },
      ],
    })
  );
  await page.route('**/api/requests/request-1/status', (route) =>
    route.fulfill({ status: 409, json: { detail: 'This request has already been matched.' } })
  );
  await page.goto('/app/customer');
  await page.getByRole('button', { name: 'My requests', exact: false }).click();
  const cancel = page.getByRole('button', { name: /cancel/i });
  await cancel.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText('This request has already been matched.')).toBeVisible();
  await expect(cancel).toBeEnabled();
});

test('unavailable storage and reduced motion do not break public routes', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('Storage blocked');
      },
    })
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('h1:visible')).toBeVisible();
  // Reduced motion never loads the WebGL stage; the still is the scene.
  await expect(page.locator('.pareto-still')).toBeVisible();
  await expect(page.locator('.pareto-canvas')).toHaveCount(0);
  // The workflow story becomes six still frames with their text, ending on the list.
  await expect(page.locator('.story-canvas')).toHaveCount(0);
  await expect(page.locator('.story-stills > li')).toHaveCount(6);
  await expect(page.locator('.story-proposals .is-balanced')).toHaveCount(1);
  await expect(page.locator('.story-stills img').first()).toHaveAttribute('src', /chapter-1-/);
  await page.getByRole('radio', { name: 'Light' }).check();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
  await noOverflow(page);
  await page.goto('/login');
  await chooseMode(page, 'dark');
  expect(await page.locator('html').evaluate((el) => getComputedStyle(el).scrollBehavior)).toBe(
    'auto'
  );
  await noOverflow(page);
});

for (const [action, title, status] of [
  ['Sign', 'Contract Review & Signature', 'CONTRACT_PENDING'],
  ['Pay', 'Payment Mockup Checkout', 'AWAITING_PAYMENT'],
  ['Rate', 'Rate this delivery', 'COMPLETED'],
]) {
  test(`${action} opens the correct transaction dialog and can be dismissed`, async ({ page }) => {
    await mockApi(page);
    await page.route('**/api/transactions/mine', (route) =>
      route.fulfill({
        json: [
          {
            id: 'transaction-1',
            request_id: 'request-1',
            status,
            my_role: 'CUSTOMER',
            item_name: 'Steel',
            currency_code: 'KZT',
            total_cost: '10000',
            signature_status: { CUSTOMER: 'PENDING', FACTORY: 'SIGNED', LOGIST: 'SIGNED' },
            payment_status: 'PENDING',
            can_sign: action === 'Sign',
            can_pay: action === 'Pay',
            can_accept_completion: false,
            contract_reference: 'TEST-001',
            contract_date: '2026-09-14',
            factory_legal_name: 'Test Factory',
            client_legal_name: 'Test Customer',
            logist_legal_name: 'Test Logistics',
          },
        ],
      })
    );
    await page.goto('/app/customer');
    await page.getByRole('button', { name: /Orders & delivery/ }).click();
    const trigger = page.getByRole('button', { name: action, exact: true });
    await trigger.click();
    const modal = page.getByRole('dialog', { name: title });
    await expect(modal).toBeVisible();
    if (action === 'Sign')
      await expect(modal.getByRole('button', { name: 'Sign Contract' })).toBeDisabled();
    await noOverflow(page);
    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}

test('background refresh failure is reported without an unhandled rejection', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.install();
  await mockApi(page);
  await page.goto('/app/customer');
  await expect(page.getByRole('button', { name: /new request/i }).first()).toBeEnabled();
  await page.route('**/api/transactions/mine', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' })
  );
  await page.clock.fastForward(11000);
  await expect(
    page.getByText('Could not refresh workspace. Please check your connection and try again.')
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('workspace navigation retains sections through reload, language and history', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto('/app/customer?lang=en');
  const nav = page.getByRole('navigation', { name: 'Workspace sections' });
  await nav.getByRole('button', { name: 'My requests' }).click();
  await expect(page.locator('main')).toHaveAttribute('data-view', 'requests');
  await page.reload();
  await expect(page.locator('main')).toHaveAttribute('data-view', 'requests');
  await page.getByRole('link', { name: 'RU', exact: true }).click();
  await expect(page).toHaveURL(/view=requests/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await page
    .getByRole('navigation', { name: 'Разделы рабочего пространства' })
    .getByRole('button', { name: 'Заказы и доставка' })
    .click();
  await expect(page.locator('main')).toHaveAttribute('data-view', 'workflow');
  await page.goBack();
  await expect(page.locator('main')).toHaveAttribute('data-view', 'requests');
  await noOverflow(page);
});

test('pointer and keyboard animate while reduced motion skips feedback', async ({ page }) => {
  await mockApi(page);
  await page.goto('/app/customer');
  const trigger = page.locator('.workspace-menu');
  await expect(trigger).toBeVisible();
  for (const [event, init] of [
    ['pointerdown', { pointerType: 'mouse' }],
    ['keydown', { key: 'Enter' }],
  ] as const) {
    await trigger.evaluate((el) => el.getAnimations().forEach((a) => a.cancel()));
    await trigger.dispatchEvent(event, init);
    expect(
      await trigger.evaluate((el) =>
        el.getAnimations().some((a) => a.effect?.getTiming().duration === 290)
      )
    ).toBe(true);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await trigger.evaluate((el) => el.getAnimations().forEach((a) => a.cancel()));
  await trigger.dispatchEvent('pointerdown', { pointerType: 'mouse' });
  expect(
    await trigger.evaluate((el) =>
      el.getAnimations().some((a) => a.effect?.getTiming().duration === 290)
    )
  ).toBe(false);
});

for (const locale of ['ru', 'kk'] as const) {
  test(`${locale}: redesigned public screens and all role overviews are translated`, async ({
    page,
  }) => {
    await mockApi(page);
    for (const route of ['/', '/login', '/register', '/verify-email']) {
      await page.goto(`${route}?lang=${locale}`);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('h1:visible')).toBeVisible();
      await expect(page.getByText('Different expertise.', { exact: true })).toHaveCount(0);
      await expect(
        page.getByText('THE PLACE WHERE SUPPLY MEETS POSSIBILITY', { exact: true })
      ).toHaveCount(0);
      await noOverflow(page);
    }
    const headings =
      locale === 'ru'
        ? ['Ваши заявки', 'Ваше производство', 'Ваши доставки', 'Полная картина']
        : ['Сіздің өтінімдеріңіз', 'Сіздің өндірісіңіз', 'Сіздің жеткізулеріңіз', 'Толық көрініс'];
    for (const [index, role] of roles.entries()) {
      await mockApi(page, role.toUpperCase());
      await page.goto(`/app/${role}?lang=${locale}`);
      await expect(page.locator('h1:visible')).toContainText(headings[index]);
      await expect(page.locator('.experience-overview')).not.toContainText(
        /New [Rr]equest|Open details|Your next|Ready when|Loading your|Latest activity/
      );
      await noOverflow(page);
      await page.screenshot({
        path: `test-results/${role}-${locale}-${test.info().project.name}.png`,
        fullPage: true,
        animations: 'disabled',
      });
      const nav = page
        .getByRole('navigation', {
          name: locale === 'ru' ? 'Разделы рабочего пространства' : 'Жұмыс кеңістігінің бөлімдері',
        })
        .filter({ visible: true });
      await nav.getByRole('button').nth(1).click();
      await expect(page).toHaveURL(new RegExp(`lang=${locale}`));
      await expect(page.locator('main')).not.toHaveAttribute('data-view', 'home');
      await noOverflow(page);
    }
  });
}

test('landing lifecycle and role features translate every entry when switching languages', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto('/?lang=en');
  const rows = page.locator('.lifecycle-track strong');
  const features = page.locator('.landing-role-grid li');
  await expect(rows).toHaveCount(8);
  await expect(features).toHaveCount(9);
  const englishRows = await rows.allTextContents();
  const englishFeatures = await features.allTextContents();
  for (const locale of ['ru', 'kk', 'en'] as const) {
    await page.getByRole('link', { name: locale.toUpperCase(), exact: true }).click();
    const translate = (source: string) =>
      locale === 'en'
        ? source
        : experienceTranslations[source as keyof typeof experienceTranslations][locale];
    await expect(rows).toHaveText(englishRows.map(translate));
    await expect(features).toHaveText(englishFeatures.map(translate));
    await noOverflow(page);
  }
});

test('language survives bare URLs and reloads while explicit links override it', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto('/?lang=kk');
  await expect(page.locator('html')).toHaveAttribute('lang', 'kk');
  await page.goto('/login');
  await expect(page).toHaveURL(/lang=kk/);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'kk');
  await page.goto('/register?role=FACTORY#details');
  await expect(page).toHaveURL(/role=FACTORY&lang=kk#details/);
  await page.getByRole('link', { name: 'RU', exact: true }).click();
  await expect(page).toHaveURL(/role=FACTORY&lang=ru/);
  await page.goto('/verify-email?token=sample');
  await expect(page).toHaveURL(/token=sample&lang=ru/);
  await page.goto('/?lang=en');
  // <html lang="en"> is also the server default, so wait for the stored choice instead.
  await page.waitForFunction(() => localStorage.getItem('if-locale') === 'en');
  await page.goto('/login');
  await expect(page).toHaveURL(/lang=en/);
});

test('card ordering persists and the left navigation sheet works', async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/requests/', (route) =>
    route.fulfill({
      json: ['Steel', 'Copper', 'Aluminium'].map((name, index) => ({
        id: `request-${index}`,
        item_name: name,
        quantity: '10',
        quantity_unit: 'kg',
        status: 'PENDING',
        created_at: '2026-09-14T00:00:00Z',
      })),
    })
  );
  await page.goto('/app/customer?lang=en');
  const cards = page.locator('.reorder-card');
  await expect(cards).toHaveCount(3);
  await cards
    .first()
    .getByRole('button', { name: /Rearrange/ })
    .press('ArrowRight');
  await expect(cards.first()).toContainText('Copper');
  await page.reload();
  await expect(cards.first()).toContainText('Copper');
  await page.getByRole('button', { name: 'Workspace sections', exact: true }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toHaveAttribute('data-side', 'left');
  await drawer.getByRole('button', { name: /My requests/ }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page).toHaveURL(/view=requests/);
});

test('request sheet is translated and fits the viewport', async ({ page }) => {
  await mockApi(page);
  await page.goto('/app/customer?lang=kk');
  await page.locator('.overview-head .if-button-primary').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Сізге не қажет?');
  await expect(dialog).toContainText('Қайда жеткізу керек?');
  await expect(dialog).not.toContainText('Choose a category');
  await noOverflow(page);
  await dialog.evaluate(async (node) => {
    await Promise.all(
      node
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => undefined))
    );
  });
  await page.screenshot({ path: `/private/tmp/intelli-request-${test.info().project.name}.png` });
});

test('dragging between delivery lanes requires confirmation and a failed update preserves status', async ({
  page,
}) => {
  await mockApi(page, 'LOGIST');
  await page.route('**/api/transactions/mine', (route) =>
    route.fulfill({
      json: [
        {
          id: 'delivery-1',
          request_id: 'request-1',
          item_name: 'Steel',
          status: 'PAYMENT_CONFIRMED',
          can_start_fulfillment: true,
          total_cost: '1000',
          currency_code: 'KZT',
          signature_status: { CUSTOMER: 'SIGNED', FACTORY: 'SIGNED', LOGIST: 'SIGNED' },
        },
      ],
    })
  );
  let mutations = 0;
  await page.route('**/api/transactions/delivery-1/**', (route) => {
    mutations += 1;
    return route.fulfill({ status: 409, json: { detail: 'Delivery cannot start yet.' } });
  });
  await page.goto('/app/logist?lang=en');
  const card = page.locator('.lane-0 .reorder-card');
  await expect(card).toBeVisible();
  const grip = card.getByRole('button', { name: /Rearrange/ });
  const target = page.locator('.lane-1');
  if (test.info().project.name === 'desktop') {
    await grip.scrollIntoViewIfNeeded();
    await page.locator('.experience-overview').evaluate(async (node) => {
      await Promise.all(
        node
          .getAnimations({ subtree: true })
          .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
          .map((animation) => animation.finished.catch(() => undefined))
      );
    });
    const start = await grip.boundingBox();
    const end = await target.boundingBox();
    if (!start || !end) throw new Error('Missing drag geometry');
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(end.x + end.width / 2, end.y + 80, { steps: 12 });
    await page.mouse.up();
  } else {
    await card.getByRole('button', { name: 'Start delivery' }).click();
  }
  const confirmation = page.getByRole('dialog');
  await expect(confirmation).toBeVisible();
  expect(mutations).toBe(0);
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(card).toBeVisible();
  expect(mutations).toBe(0);
  await card.getByRole('button', { name: 'Start delivery' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText('Delivery cannot start yet.')).toBeVisible();
  // A failed update keeps the order where it was (statuses render as translated badges).
  await expect(card.locator('[data-status="PAYMENT_CONFIRMED"]')).toBeVisible();
  expect(mutations).toBe(1);
});

test('custom filters search, select and restore values without native dropdowns', async ({
  page,
}) => {
  await mockApi(page);
  await page.route('**/api/requests/', (route) =>
    route.fulfill({
      json: ['PENDING', 'CANCELLED'].map((status, index) => ({
        id: `choice-${index}`,
        item_name: index ? 'Copper' : 'Steel',
        quantity: '10',
        quantity_unit: 'kg',
        status,
        created_at: '2026-09-14T00:00:00Z',
      })),
    })
  );
  await page.goto('/app/customer?view=requests&lang=en');
  expect(await page.locator('select, datalist').count()).toBe(0);
  const status = page.getByRole('combobox', { name: 'Status', exact: true });
  await status.click();
  await status.fill('cancel');
  await page.getByRole('option', { name: 'CANCELLED', exact: true }).click();
  await expect(status).toHaveValue('CANCELLED');
  await expect(page.locator('tbody')).toContainText('Copper');
  await expect(page.locator('tbody')).not.toContainText('Steel');
  await status.click();
  await status.fill('not a status');
  await expect(page.getByText('No matches found')).toBeVisible();
  await status.press('Escape');
  await expect(status).toHaveValue('CANCELLED');
  await status.click();
  await status.press('Home');
  await status.press('Enter');
  await expect(page.locator('tbody')).toContainText('Steel');
});

test('custom selector stays inside the viewport and Escape keeps its sheet open', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto('/app/customer?lang=en');
  await page.locator('.overview-head .if-button-primary').click();
  const dialog = page.getByRole('dialog');
  const currency = dialog.getByRole('combobox', { name: 'Currency', exact: true });
  await currency.click();
  const list = page.getByRole('listbox');
  await expect(list).toBeVisible();
  const bounds = await list.boundingBox();
  const viewport = page.viewportSize()!;
  expect(bounds).toBeTruthy();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
  await list.evaluate(async (node) => {
    await Promise.all(node.getAnimations().map((a) => a.finished));
  });
  await page.screenshot({ path: `/private/tmp/intelli-popup-${test.info().project.name}.png` });
  await currency.press('Escape');
  await expect(list).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(currency).toBeFocused();
  await currency.click();
  await page.getByRole('option', { name: /KZT/ }).click();
  await expect(currency).toHaveValue(/KZT/);
  await dialog.screenshot({
    path: `/private/tmp/intelli-custom-dropdown-${test.info().project.name}.png`,
  });
});

for (const role of roles) {
  test(`${role}: all workspace filters are custom controls`, async ({ page }) => {
    await mockApi(page, role.toUpperCase());
    await page.goto(`/app/${role}?lang=en`);
    expect(await page.locator('select, datalist').count()).toBe(0);
  });
}

test('registration custom controls submit codes and accept a free-text address', async ({
  page,
}) => {
  await mockApi(page);
  let payload: Record<string, unknown> | undefined;
  await page.route('**/api/auth/register', async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({ json: { status: 'success', message: 'Check your email' } });
  });
  await page.goto('/register?lang=en');
  await page.locator('#email').fill('dropdown@example.test');
  await page.locator('#password').fill('Localtest123!');
  await page.locator('#confirmPassword').fill('Localtest123!');
  await page.locator('#role').click();
  await page.getByRole('option', { name: 'Factory', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('#displayName').fill('Dropdown test');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('#phone')).toBeFocused();
  await page.locator('#phone').fill('invalid');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('form').getByRole('alert')).toContainText('7–15 digits');
  expect(payload).toBeUndefined();
  await page.locator('#phone').fill('+7 700 000 0000');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const country = page.getByRole('combobox', { name: /Country/ });
  await country.click();
  await page.getByRole('option', { name: 'Kazakhstan', exact: true }).click();
  await page.getByRole('combobox', { name: /Region/ }).fill('My region');
  await page.getByRole('combobox', { name: /City/ }).fill('My city');
  await expect(page.getByText('City not listed?', { exact: false }).first()).toBeVisible();
  await page.getByRole('textbox', { name: /Street/ }).fill('Test street 10');
  await page.locator('#currency').click();
  await page.getByRole('option', { name: /KZT/ }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('.registration-review')).toContainText('My city');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('combobox', { name: /City/ })).toHaveValue('My city');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await noOverflow(page);
  await page
    .locator('form')
    .getByRole('button', { name: /Create account/i })
    .click();
  await expect.poll(() => payload?.role).toBe('FACTORY');
  expect(payload).toMatchObject({
    country_code: 'KZ',
    region_name: 'My region',
    city_name: 'My city',
    preferred_currency_code: 'KZT',
    phone: '+7 700 000 0000',
  });
});

for (const role of ['customer', 'factory', 'logist'] as const) {
  for (const locale of ['en', 'ru', 'kk'] as const) {
    test(`${role} ${locale}: onboarding checklist navigates and remembers dismissal per account`, async ({
      page,
    }) => {
      await mockApi(page, role.toUpperCase());
      await page.goto(`/app/${role}?lang=${locale}`);
      const checklist = page.getByRole('region', { name: guidanceText(locale, 'checklist') });
      await expect(checklist).toBeVisible();
      await checklist.locator('summary').first().click();
      await checklist
        .getByRole('button', { name: guidanceText(locale, 'openStep') })
        .first()
        .click();
      await expect(page).toHaveURL(
        new RegExp(
          `view=${role === 'customer' ? 'requests' : role === 'factory' ? 'inventory' : 'offers'}`
        )
      );
      await expect(page).toHaveURL(new RegExp(`lang=${locale}`));
      await noOverflow(page);
      await checklist.getByRole('button', { name: guidanceText(locale, 'hide') }).click();
      await page.reload();
      await expect(
        checklist.getByRole('button', { name: guidanceText(locale, 'show') })
      ).toBeVisible();
      await mockApi(page, role.toUpperCase(), true, 'second-user');
      await page.reload();
      await expect(checklist.locator('summary')).toHaveCount(role === 'customer' ? 5 : 4);
      await checklist.getByRole('button', { name: guidanceText(locale, 'hide') }).click();
      await checklist.getByRole('button', { name: guidanceText(locale, 'show') }).click();
      await expect(checklist.locator('summary').first()).toBeVisible();
    });
  }
}

test('registration keeps entered account details when stepping back', async ({ page }) => {
  await mockApi(page);
  await page.goto('/register?role=FACTORY&lang=en');
  await page.locator('#email').fill('factory@example.test');
  await page.locator('#password').fill('Localtest123!');
  await page.locator('#confirmPassword').fill('different-password');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('form').getByRole('alert')).toContainText('Passwords do not match');
  await page.locator('#confirmPassword').fill('Localtest123!');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('.registration-step-heading')).toBeFocused();
  await page.locator('#displayName').fill('Factory name');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.locator('#email')).toHaveValue('factory@example.test');
  await expect(page.locator('#role')).toHaveValue('Factory');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('#displayName')).toHaveValue('Factory name');
  await noOverflow(page);
  await page.screenshot({
    path: `/private/tmp/intelli-registration-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test('landing colour mode persists and the trade-off explorer works from the keyboard', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto('/?lang=en');
  await page.getByRole('radio', { name: 'Light' }).check();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
  await expect(page.getByRole('radio', { name: 'Light' })).toBeChecked();

  await page.getByRole('button', { name: 'Weighted choice' }).click();
  const chart = page.getByRole('group', { name: /Offers by total cost/ });
  await chart.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.tradeoffs-readout')).toContainText('Offer');
  await expect(page.getByText('engine default', { exact: true })).toBeVisible();
  await page.getByRole('slider', { name: /Cost/ }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('engine default', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset to engine default' }).click();
  await expect(page.getByText('engine default', { exact: true })).toBeVisible();
  await noOverflow(page);
});

function offer(
  id: string,
  factory: string,
  cost: number | null,
  days: number | null,
  reliability: number | null,
  currency = 'EUR'
) {
  return {
    id,
    request_id: 'request-1',
    status: 'PENDING',
    quoted_quantity: '250',
    quantity_unit: 'tons',
    factory_note: null,
    currency_code: currency,
    inventory_entry_id: `inv-${id}`,
    item_name: 'Coal',
    inventory_price_per_unit: '100',
    factory_legal_name: factory,
    factory_avg_rating: 4.5,
    source_address_label: null,
    destination_address_label: null,
    logistic_offer_id: `route-${id}`,
    logistic_title: null,
    logist_legal_name: 'Steppe Freight',
    logist_avg_rating: 4.2,
    delivery_price: '5000',
    delivery_days: days,
    total_cost: cost == null ? null : String(cost),
    reliability_score: reliability,
    fitness_score: null,
    created_at: '2026-09-14T00:00:00Z',
  };
}

test('customer compares proposals by priority and chooses one', async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/requests/', (route) =>
    route.fulfill({
      json: [
        {
          id: 'request-1',
          item_name: 'Coal',
          category_name: 'Energy',
          quantity: '250',
          quantity_unit: 'tons',
          preferred_currency_code: 'EUR',
          status: 'PAIRING_IN_PROGRESS',
          created_at: '2026-09-14T00:00:00Z',
        },
      ],
    })
  );
  await page.route('**/api/pairing/candidates/**', (route) =>
    route.fulfill({
      json: [
        offer('a', 'Balanced Mills', 100000, 2, 0.95),
        offer('b', 'Budget Works', 80000, 6, 0.85),
        offer('c', 'Express Plant', 120000, 1, 0.97),
      ],
    })
  );
  let chosen: string | null = null;
  await page.route('**/api/pairing/select-candidate', async (route) => {
    chosen = route.request().postDataJSON().candidate_id;
    await route.fulfill({ json: { status: 'success', transaction_id: 'tx-1' } });
  });

  await page.goto('/app/customer?view=home&lang=en');
  await page.getByRole('button', { name: /Compare proposals/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Compare proposals' });
  await expect(dialog.locator('.proposal-table tbody tr')).toHaveCount(3);
  const detail = dialog.getByRole('complementary', { name: 'Selected offer' });
  // Engine weights 0.4/0.3/0.3 favour the balanced offer; 0.7/0.2/0.1 the cheapest.
  await expect(detail).toContainText('Balanced Mills');
  await expect(detail).toContainText('Recommended for you');
  await dialog.getByRole('radio', { name: 'Lowest cost' }).check();
  await expect(detail).toContainText('Budget Works');

  const chart = dialog.getByRole('group', { name: /Offers by total cost/ });
  await chart.focus();
  // Arrow keys walk the offers by cost, starting from the selected (cheapest) one.
  await page.keyboard.press('ArrowRight');
  await expect(dialog.locator('.proposal-readout')).toContainText('Balanced Mills');
  await page.keyboard.press('ArrowLeft');
  await expect(dialog.locator('.proposal-readout')).toContainText('Budget Works');

  await dialog.getByRole('radio', { name: /Express Plant/ }).check();
  await expect(detail).toContainText('Express Plant');
  await detail.getByRole('button', { name: 'Choose this proposal' }).click();
  await expect.poll(() => chosen).toBe('c');
  await noOverflow(page);
});

test('proposals compare like with like across currencies and incomplete offers stay choosable', async ({
  page,
}) => {
  await mockApi(page);
  await page.route('**/api/requests/', (route) =>
    route.fulfill({
      json: [
        {
          id: 'request-1',
          item_name: 'Coal',
          category_name: 'Energy',
          quantity: '250',
          quantity_unit: 'tons',
          preferred_currency_code: 'EUR',
          status: 'PAIRING_IN_PROGRESS',
          created_at: '2026-09-14T00:00:00Z',
        },
      ],
    })
  );
  await page.route('**/api/pairing/candidates/**', (route) =>
    route.fulfill({
      json: [
        offer('a', 'Euro Mills', 100000, 2, 0.95),
        offer('b', 'Euro Works', 90000, 4, 0.9),
        offer('k', 'Steppe Plant', 5000000, 1, 0.99, 'KZT'),
        offer('x', 'Pending Quote Co', 70000, null, null),
      ],
    })
  );
  let chosen: string | null = null;
  await page.route('**/api/pairing/select-candidate', async (route) => {
    chosen = route.request().postDataJSON().candidate_id;
    await route.fulfill({ json: { status: 'success', transaction_id: 'tx-1' } });
  });
  await page.goto('/app/customer?view=home&lang=en');
  await page.getByRole('button', { name: /Compare proposals/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Compare proposals' });
  const table = dialog.locator('.proposal-table');
  // The most common currency is compared first; the KZT offer is kept apart, never ranked in EUR.
  await expect(dialog.getByRole('radiogroup', { name: 'Currency' })).toBeVisible();
  await expect(table).not.toContainText('Steppe Plant');
  await expect(dialog.getByText('Recommended for you')).toBeVisible();
  // The incomplete offer is listed and can still be chosen.
  await expect(table.getByRole('row', { name: /Pending Quote Co/ })).toContainText('—');
  await expect(dialog).toContainText('Not scored, figures incomplete: 1');
  await dialog.getByRole('radio', { name: /Pending Quote Co/ }).check();
  await dialog.getByRole('button', { name: 'Choose this proposal' }).click();
  await expect.poll(() => chosen).toBe('x');
});

test('switching proposal currency shows that currency only', async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/requests/', (route) =>
    route.fulfill({
      json: [
        {
          id: 'request-1',
          item_name: 'Coal',
          quantity: '250',
          quantity_unit: 'tons',
          preferred_currency_code: 'EUR',
          status: 'PAIRING_IN_PROGRESS',
          created_at: '2026-09-14T00:00:00Z',
        },
      ],
    })
  );
  await page.route('**/api/pairing/candidates/**', (route) =>
    route.fulfill({
      json: [
        offer('a', 'Euro Mills', 100000, 2, 0.95),
        offer('b', 'Euro Works', 90000, 4, 0.9),
        offer('k', 'Steppe Plant', 5000000, 1, 0.99, 'KZT'),
      ],
    })
  );
  await page.goto('/app/customer?view=home&lang=en');
  await page.getByRole('button', { name: /Compare proposals/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Compare proposals' });
  await dialog.getByRole('radio', { name: 'KZT' }).check();
  const table = dialog.locator('.proposal-table');
  await expect(table).toContainText('Steppe Plant');
  await expect(table).not.toContainText('Euro Mills');
  await expect(table).toContainText('KZT');
  await expect(table).not.toContainText('€');
});

test('workflow story follows scroll, jumps by chapter and can pause', async ({ page }) => {
  await mockApi(page);
  await page.goto('/?lang=en');
  const story = page.locator('.story-live');
  // A slow runner may swap the live scene for the chapter still; the scroll story remains.
  await expect(story.locator('.story-canvas, .story-still')).toHaveCount(1, { timeout: 15000 });
  const chapters = page.getByRole('navigation', { name: 'Story chapters' }).getByRole('button');
  await expect(chapters).toHaveCount(6);
  await chapters.nth(2).click();
  await expect(chapters.nth(2)).toHaveAttribute('aria-current', 'step');
  await expect(story.locator('.story-chapters li.is-active')).toContainText('The factory answers');
  if (await story.locator('.story-still').count()) {
    await expect(story.locator('.story-still')).toHaveAttribute('src', /chapter-3-/);
  } else {
    await story.getByRole('button', { name: 'Pause motion' }).click();
    await expect(story.getByRole('button', { name: 'Play motion' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  }
  // The story ends on a real list of proposals with the balanced pick as one entry.
  await chapters.nth(5).click();
  const list = story.locator('.story-proposals');
  await expect(list.locator('li')).toHaveCount(5);
  await expect(list.locator('li.is-balanced')).toContainText('Balanced pick');
  await noOverflow(page);
});
