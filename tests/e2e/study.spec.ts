import { test, expect, type Page, type Route } from '@playwright/test';
import { collectionFixture, emptyCollectionFixture } from '../fixtures/collection';

const collectionPath = '**/api/collection';
const browserErrors = new WeakMap<Page, string[]>();

async function openConnected(page: Page) {
  await page.goto('/');
  await expect(page.locator('#connection-status')).toHaveText('Connected · Test profile');
}

async function navigate(page: Page, route: 'today' | 'library' | 'review') {
  await page.locator(`[data-page="${route}"]`).click();
  await expect(page.locator(`#${route}-screen`)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  // Typography can use its system fallback; tests must not depend on internet access.
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page), 'No browser JavaScript errors').toEqual([]);
});

test('loads synthetic native counts and offers native review only for due decks', async ({ page }) => {
  await openConnected(page);
  await expect(page.locator('#home-deck-rows tr')).toHaveCount(3);
  await expect(page.locator('.due-number')).toHaveText('15');
  await expect(page.locator('.new-number')).toHaveText('8');
  await expect(page.locator('#home-deck-rows .deck-name')).toHaveText(['Medicine', 'Medicine::Cardiology', 'Language']);
  await expect(page.locator('.home-start')).toBeEnabled();
  await expect(page.locator('#connection-detail')).toContainText('review ready');
  await navigate(page, 'review');
  await expect(page.getByText('Review paused.')).toBeVisible();
  await expect(page.locator('#rating-buttons')).not.toBeVisible();
  await page.keyboard.press('3');
  await page.keyboard.press('z');
  await expect(page.locator('#sample-review-body')).not.toBeVisible();
});

test('searches full live deck names and preserves filter, route and focus across themes', async ({ page }) => {
  await openConnected(page);
  await navigate(page, 'library');
  await page.locator('#deck-search').fill('CARDIO');
  await expect(page.locator('#library-deck-rows .deck-name')).toHaveText(['Medicine::Cardiology']);
  await page.locator('[data-theme-choice="dark"]').click();
  await expect(page.locator('#deck-search')).toHaveValue('CARDIO');
  await expect(page.locator('[data-page="library"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-theme-choice="dark"]')).toBeFocused();
  await page.locator('#deck-search').fill('not-a-deck');
  await expect(page.locator('#no-decks')).toHaveText('No decks match this search.');
  await page.locator('#deck-search').fill('');
  await expect(page.locator('#library-deck-rows tr')).toHaveCount(3);
});

test('empty collections and untrusted deck names render as safe text', async ({ page }) => {
  const snapshot = collectionFixture();
  snapshot.decks[2]!.name = '<img src=x onerror=alert(1)>';
  const dialogs: string[] = [];
  page.on('dialog', dialog => { dialogs.push(dialog.message()); void dialog.dismiss(); });
  await page.route(collectionPath, route => route.fulfill({ json: snapshot }));
  await openConnected(page);
  await expect(page.locator('#home-deck-rows .deck-name').last()).toHaveText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#home-deck-rows img')).toHaveCount(0);
  expect(dialogs).toEqual([]);
  await page.unroute(collectionPath);
  await page.route(collectionPath, route => route.fulfill({ json: emptyCollectionFixture() }));
  await page.locator('#refresh-connection').click();
  await expect(page.locator('#home-deck-rows tr')).toHaveCount(0);
  await expect(page.locator('#home-empty')).toContainText('No decks in this Anki profile');
  await expect(page.locator('.due-number')).toHaveText('0');
  await navigate(page, 'library');
  await expect(page.locator('#no-decks')).toContainText('No decks in this Anki profile');
});

for (const scenario of [
  { state: 'offline', status: 'Anki unavailable' },
  { state: 'unsupported', status: 'Connection not supported' },
  { state: 'profile-changed', status: 'Anki profile changed' },
] as const) {
  test(`${scenario.state} clears previously loaded live data without a Demo fallback`, async ({ page }) => {
    await openConnected(page);
    await page.route(collectionPath, route => route.fulfill({ status: 503, json: { state: scenario.state, message: 'Synthetic connection failure.' } }));
    await page.locator('#refresh-connection').click();
    await expect(page.locator('#connection-status')).toHaveText(scenario.status);
    await expect(page.locator('#home-deck-rows tr')).toHaveCount(0);
    await expect(page.locator('.due-number')).toHaveText('—');
    await navigate(page, 'library');
    await expect(page.locator('#deck-search')).toBeDisabled();
    await expect(page.locator('#library-deck-rows tr')).toHaveCount(0);
    await page.unroute(collectionPath);
    await page.locator('#refresh-connection').click();
    await expect(page.locator('#connection-status')).toHaveText('Connected · Test profile');
    await expect(page.locator('#library-deck-rows tr')).toHaveCount(3);
  });
}

test('rejects malformed success payloads through shared runtime validation', async ({ page }) => {
  await openConnected(page);
  const malformed = collectionFixture();
  malformed.totals.new += 100;
  await page.route(collectionPath, route => route.fulfill({ json: malformed }));
  await page.locator('#refresh-connection').click();
  await expect(page.locator('#connection-status')).toHaveText('Connection not supported');
  await expect(page.locator('#home-deck-rows tr')).toHaveCount(0);
  await expect(page.locator('.due-number')).toHaveText('—');
});

test('switching sources cancels an in-flight response and clears old live content', async ({ page }) => {
  await openConnected(page);
  let deferred!: Route;
  await page.route(collectionPath, route => { deferred = route; });
  await page.locator('#refresh-connection').click();
  await expect(page.locator('#connection-status')).toHaveText('Connecting to Anki');
  await expect(page.locator('#home-deck-rows tr')).toHaveCount(0);
  await page.locator('[data-source="demo"]').click();
  await expect(page.locator('#connection-status')).toHaveText('Demo collection');
  await deferred.fulfill({ json: { ...collectionFixture(), profile: 'Old response' } }).catch(() => {});
  await expect(page.locator('#connection-status')).toHaveText('Demo collection');
  await expect(page.locator('#home-deck-rows tr')).toHaveCount(3);
  await page.unroute(collectionPath);
  await page.locator('[data-source="anki"]').click();
  await expect(page.locator('#connection-status')).toHaveText('Connected · Test profile');
});

test('Demo review preserves reveal and progress across themes, guards grading and supports undo/completion', async ({ page }) => {
  await openConnected(page);
  const requests: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/')) requests.push(`${request.method()} ${new URL(request.url()).pathname}`); });
  await page.locator('[data-source="demo"]').click();
  await navigate(page, 'library');
  await page.locator('#deck-search').fill('language');
  await expect(page.locator('#library-deck-rows tr')).toHaveCount(1);
  await page.locator('#library-deck-rows [data-start="japanese"]').click();
  await expect(page.locator('#review-deck')).toHaveText('Japanese');
  await expect(page.locator('#card-answer')).not.toBeVisible();
  await page.keyboard.press('3');
  await expect(page.locator('#review-position')).toHaveText('1 / 2');
  await page.locator('#reveal-answer').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#card-answer-text')).toBeFocused();
  const question = await page.locator('#card-question').textContent();
  await page.locator('[data-theme-choice="dark"]').click();
  await expect(page.locator('#card-question')).toHaveText(question!);
  await expect(page.locator('#card-answer')).toBeVisible();
  await page.keyboard.press('3');
  await expect(page.locator('#review-position')).toHaveText('2 / 2');
  await expect(page.locator('#card-question')).toBeFocused();
  await page.keyboard.press('3');
  await expect(page.locator('#review-position')).toHaveText('2 / 2');
  await page.keyboard.press('z');
  await expect(page.locator('#review-position')).toHaveText('1 / 2');
  await expect(page.locator('#card-answer-text')).toBeFocused();
  await expect(page.locator('#undo-review')).toBeDisabled();
  await page.keyboard.press('4');
  await page.locator('#reveal-answer').click();
  await page.keyboard.press('2');
  await expect(page.locator('#session-complete')).toBeVisible();
  await page.locator('#undo-review').click();
  await expect(page.locator('#session-complete')).not.toBeVisible();
  await expect(page.locator('#review-position')).toHaveText('2 / 2');
  await page.keyboard.press('1');
  await expect(page.locator('#session-complete')).toBeVisible();
  await page.locator('#restart-session').click();
  await expect(page.locator('#review-position')).toHaveText('1 / 2');
  expect(requests).toEqual([]);
});

test('appearance and source preferences persist, System follows OS, and reduced motion is respected', async ({ page }) => {
  await openConnected(page);
  await page.locator('[data-source="demo"]').click();
  await page.locator('[data-theme-choice="dark"]').click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#connection-status')).toHaveText('Demo collection');
  await page.locator('[data-theme-choice="light"]').click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('[data-theme-choice="system"]').click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('[data-theme-choice="system"]')).toHaveAttribute('aria-pressed', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('[data-theme-choice="light"]')).toHaveCSS('transition-duration', '0s');
  await page.locator('[data-source="anki"]').click();
  await page.reload();
  await expect(page.locator('#connection-status')).toHaveText('Connected · Test profile');
});

test('focus and visible polling refresh live data; hiding cancels data and Demo removes refresh listeners', async ({ page }) => {
  await page.clock.install();
  let reads = 0;
  await page.route(collectionPath, route => { reads += 1; return route.fulfill({ json: collectionFixture() }); });
  await openConnected(page);
  const beforeFocus = reads;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => reads).toBeGreaterThan(beforeFocus);
  await expect(page.locator('#connection-status')).toHaveText('Connected · Test profile');
  const beforePoll = reads;
  await page.clock.fastForward(60_000);
  await expect.poll(() => reads).toBeGreaterThan(beforePoll);
  await expect(page.locator('#connection-status')).toHaveText('Connected · Test profile');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#home-deck-rows tr')).toHaveCount(0);
  const beforeHiddenPoll = reads;
  await page.clock.fastForward(60_000);
  expect(reads).toBe(beforeHiddenPoll);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#connection-status')).toHaveText('Connected · Test profile');
  await page.locator('[data-source="demo"]').click();
  const beforeDemo = reads;
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(120_000);
  expect(reads).toBe(beforeDemo);
  await expect(page.locator('#connection-status')).toHaveText('Demo collection');
});

for (const source of ['anki', 'demo'] as const) {
  test(`${source} screens fit desktop and narrow viewports in both appearances`, async ({ page }) => {
    await openConnected(page);
    if (source === 'demo') await page.locator('[data-source="demo"]').click();
    for (const width of [1440, 1024, 768, 360]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const theme of ['light', 'dark']) {
        await page.locator(`[data-theme-choice="${theme}"]`).click();
        for (const route of ['today', 'library', 'review'] as const) {
          await navigate(page, route);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${source}/${theme}/${width}/${route}`).toBe(true);
        }
      }
    }
  });
}

test('skip link and hash navigation preserve the selected route', async ({ page }) => {
  await openConnected(page);
  await navigate(page, 'library');
  await page.locator('.skip-link').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#library-title')).toBeFocused();
  await expect(page).toHaveURL(/#library$/);
  await page.goto('/#review');
  await expect(page.locator('#review-screen')).toBeVisible();
  await expect(page.locator('[data-page="review"]')).toHaveAttribute('aria-current', 'page');
});
