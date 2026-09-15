import { experienceTranslations } from '../lib/experienceI18n';
import { guidanceText } from '../lib/guidance';
import { test, expect, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('if-preferences-configured', '1'));
});

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
    if (path === '/api/categories/factory-setup') {
      await route.fulfill({
        json: {
          ready: true,
          email_verified: true,
          profile_complete: true,
          eligible_inventory_ids: [],
          selections: [],
          profile: {
            legal_name: 'Factory',
            contact_name: 'User',
            phone: '123',
            primary_address_id: null,
          },
        },
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

async function openSettings(page: Page) {
  await page
    .getByRole('button', { name: /Profile settings|Настройки профиля|Профиль баптаулары/ })
    .click();
}
async function chooseTheme(page: Page, name: string) {
  await openSettings(page);
  await page.getByRole('radio', { name, exact: true }).check();
  await page
    .getByRole('button', { name: /Save preferences|Сохранить настройки|Баптауларды сақтау/ })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function chooseLanguage(page: Page, language: string) {
  await openSettings(page);
  await page.getByRole('combobox', { name: /Language|Язык|Тіл/ }).click();
  await page.getByRole('option', { name: language, exact: true }).click();
  await page
    .getByRole('button', { name: /Save preferences|Сохранить настройки|Баптауларды сақтау/ })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('themes persist across navigation and reload; language is retained', async ({ page }) => {
  await mockApi(page);
  await page.goto('/app/customer?lang=ru');
  for (const [name, css] of [
    ['Pearl', 'modern-light'],
    ['Grove', 'whatsapp-emerald'],
    ['Midnight', 'modern-dark'],
  ]) {
    await chooseTheme(page, name);
    await expect(page.locator('html')).toHaveClass(`theme-${css}`);
    await noOverflow(page);
  }
  await chooseTheme(page, 'Pearl');
  await page.getByRole('button', { name: /Выйти/ }).click();
  await expect(page).toHaveURL(/login\?lang=ru/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass('theme-modern-light');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await noOverflow(page);
});

test('profile preferences support keyboard selection and Escape', async ({ page }) => {
  await mockApi(page);
  await page.goto('/app/customer?lang=en');
  await openSettings(page);
  const radio = page.getByRole('radio', { name: 'Pearl', exact: true });
  await radio.focus();
  await radio.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Midnight', exact: true })).toBeChecked();
  await radio.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('html')).toHaveClass('theme-modern-light');
});

for (const role of roles) {
  test(`${role}: login, workspace, theme default and logout`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await mockApi(page, role.toUpperCase());
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill('test@example.com');
    await page.getByLabel('Password', { exact: true }).fill('Password123');
    await page.getByRole('button', { name: /log in|sign in/i }).click();
    await expect(page).toHaveURL(new RegExp(`/app/${role}`));
    await expect(page.locator('h1:visible')).toBeVisible();
    const theme =
      role === 'customer'
        ? 'modern-light'
        : role === 'admin' || role === 'logist'
          ? 'modern-dark'
          : 'whatsapp-emerald';
    await expect(page.locator('html')).toHaveClass(`theme-${theme}`);
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

test('manual theme wins over role default and legacy preferences recover', async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem('if-theme', 'cyberNeon'));
  await page.goto('/app/customer');
  await expect(page.locator('html')).toHaveClass('theme-modern-dark');
  await chooseTheme(page, 'Grove');
  await page.goto('/app/customer');
  // The init script simulates an old stored preference on each full navigation.
  await expect(page.locator('html')).toHaveClass('theme-modern-dark');
  await chooseTheme(page, 'Grove');
  await page.locator('header a').first().click();
  await expect(page.locator('html')).toHaveClass('theme-whatsapp-emerald');
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
  await page.route('**/api/auth/preferences', (route) =>
    route.fulfill({ status: 401, json: { detail: 'Sign in' } })
  );
  await page.goto('/');
  await page.getByRole('radio', { name: 'Pearl', exact: true }).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('html')).toHaveClass('theme-modern-light');
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
  await chooseLanguage(page, 'Русский');
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
  const trigger = page.getByRole('button', {
    name: /Profile settings|Настройки профиля|Профиль баптаулары/,
  });
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
        ? ['Большие дела', 'От запасов', 'Каждая доставка', 'Полная картина']
        : ['Үлкен істер', 'Қоймадағы тауардан', 'Әр жеткізу', 'Толық көрініс'];
    for (const [index, role] of roles.entries()) {
      await mockApi(page, role.toUpperCase());
      await page.goto(`/app/${role}?lang=${locale}&view=home`);
      await expect(page.locator('h1:visible')).toContainText(headings[index]);
      await expect(page.locator('.experience-overview')).not.toContainText(
        /New Request|Open details|Your next|Ready when|Loading your|Latest activity/
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

test('landing feed and role features translate every entry when switching languages', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto('/?lang=en');
  const rows = page.locator('.landing-hero li');
  const features = page.locator('.landing-role-grid li');
  await expect(rows).toHaveCount(6);
  await expect(features).toHaveCount(9);
  const englishRows = await rows.allTextContents();
  const englishFeatures = await features.allTextContents();
  for (const locale of ['ru', 'kk', 'en'] as const) {
    await page.goto(`/?lang=${locale}`);
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
  await page.goto('/login');
  await expect(page).toHaveURL(/lang=kk/);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'kk');
  await page.goto('/register?role=FACTORY#details');
  await expect(page).toHaveURL(/role=FACTORY&lang=kk#details/);
  await page.goto('/register?role=FACTORY&lang=ru#details');
  await expect(page).toHaveURL(/role=FACTORY&lang=ru/);
  await page.goto('/verify-email?token=sample');
  await expect(page).toHaveURL(/token=sample&lang=ru/);
  await page.goto('/?lang=en');
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
  await page.locator('.customer-hero button').click();
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
  await expect(card).toContainText('payment confirmed');
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
  await page.locator('.customer-hero button').click();
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
