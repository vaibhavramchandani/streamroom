import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';

// The vertical slice: sign in → create room → invite link → second person joins → call.
// With MEDIA=1 (a LiveKit server running) it also goes live at 1080p60 and checks the
// viewer really receives 1080p video. Without it, joining the call must fail politely.
const SHOTS = '../replica/clone-screens';
const withMedia = process.env.MEDIA === '1';
const run = Date.now().toString(36).slice(-4); // the dev API keeps data between runs

function consoleErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    // Expected without a media server: the WebSocket to LiveKit is refused.
    if (!withMedia && /(7880|websocket|could not establish|signal connection|Failed to load resource)/i.test(t)) return;
    errors.push(t);
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

async function signIn(browser: Browser, name: string, plan: 'free' | 'hd', path = '/') {
  const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  const errors = consoleErrors(page);
  await page.goto(path);
  await expect(page).toHaveURL(/\/signin/);
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('radio', { name: plan === 'hd' ? /HD/ : /Free/ }).click();
  await page.getByLabel('Your name').press('Enter'); // keyboard submit
  return { page, errors };
}

test('host creates a room, guest joins by link, both reach the call', async ({ browser }) => {
  const host = await signIn(browser, `Vaibhav ${run}`, 'hd');
  await expect(host.page.getByRole('heading', { name: 'Start a room' })).toBeVisible();
  await expect(host.page.getByText('No rooms yet')).toBeVisible();
  await host.page.screenshot({ path: `${SHOTS}/home-empty.png` });

  // validation
  await host.page.getByRole('button', { name: 'Create room' }).click();
  await expect(host.page.getByText('Give the room a name')).toBeVisible();

  await host.page.getByLabel('Room name').fill('Friday game night');
  await host.page.getByRole('button', { name: 'Create room' }).click();
  await expect(host.page).toHaveURL(/\/r\/[0-9a-f-]+$/);
  await expect(host.page.getByRole('heading', { name: 'Friday game night' })).toBeVisible();
  await expect(host.page.getByRole('button', { name: 'Join the call' })).toBeVisible();
  await host.page.screenshot({ path: `${SHOTS}/S01-lobby.png` });

  await host.page.getByRole('button', { name: 'Copy invite link' }).click();
  await expect(host.page.getByText('Link copied')).toBeVisible();
  const invite = await host.page.evaluate(() => navigator.clipboard.readText());
  expect(invite).toMatch(/\/join\/[0-9a-f]{12}$/);

  // Guest opens the invite while signed out → sign in → lands in the room.
  const guest = await signIn(browser, `Priya ${run}`, 'free', new URL(invite).pathname);
  await expect(guest.page.getByRole('heading', { name: 'Friday game night' })).toBeVisible();
  await expect(guest.page.getByText('2 members')).toBeVisible();

  // Room settings: host blocks guest from sharing, then allows again.
  await host.page.getByRole('link', { name: 'Room settings' }).click();
  const priyaRow = host.page.getByRole('listitem').filter({ hasText: 'Priya' });
  const toggle = priyaRow.getByRole('checkbox', { name: 'Can share screen' });
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(toggle).not.toBeChecked();
  await host.page.screenshot({ path: `${SHOTS}/S08-settings.png` });
  await toggle.check();
  await host.page.getByRole('link', { name: 'Back to the room' }).click();

  // Guest can't open settings controls
  await expect(guest.page.getByRole('link', { name: 'Room settings' })).toHaveCount(0);

  // Mobile width
  await guest.page.setViewportSize({ width: 390, height: 844 });
  await guest.page.screenshot({ path: `${SHOTS}/S01-lobby-390.png` });
  await guest.page.setViewportSize({ width: 1440, height: 900 });

  if (!withMedia) {
    await guest.page.getByRole('button', { name: 'Join the call' }).click();
    await expect(guest.page.getByText('Couldn’t connect to the media server')).toBeVisible();
    await expect(guest.page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await guest.page.screenshot({ path: `${SHOTS}/S01-media-error.png` });
  } else {
    // Real media: host goes live at 1080p60, guest watches and must receive 1080p.
    await host.page.getByRole('button', { name: 'Join the call' }).click();
    await guest.page.getByRole('button', { name: 'Join the call' }).click();
    await expect(host.page.getByText('2 in the call')).toBeVisible({ timeout: 15_000 });

    await host.page.getByRole('button', { name: 'Share your screen' }).click();
    await expect(host.page.getByRole('dialog', { name: 'Share your screen' })).toBeVisible();
    await host.page.screenshot({ path: `${SHOTS}/S02-S03-share-setup.png` });
    await host.page.getByRole('button', { name: /Go live · 1080p60/ }).click();
    await expect(host.page.getByText('You · sharing')).toBeVisible({ timeout: 15_000 });

    // Free guest sees 1080p locked
    await guest.page.getByRole('button', { name: /Watch Vaibhav/ }).click();
    const stage = guest.page.getByRole('figure', { name: /Vaibhav/ });
    await expect(stage).toBeVisible();
    await expect(stage.getByText(/1920×1080/)).toBeVisible({ timeout: 20_000 });
    await host.page.screenshot({ path: `${SHOTS}/S04-streaming.png` });
    await guest.page.screenshot({ path: `${SHOTS}/S05-watching.png` });

    await host.page.getByRole('button', { name: 'Stop sharing' }).click();
    await expect(stage.getByText(/Vaibhav \w+ stopped streaming/)).toBeVisible({ timeout: 10_000 });
  }

  expect(host.errors, host.errors.join('\n')).toEqual([]);
  expect(guest.errors, guest.errors.join('\n')).toEqual([]);
});

test('unknown room and bad invite show friendly errors', async ({ browser }) => {
  const { page, errors } = await signIn(browser, 'Stranger', 'free', '/r/00000000-0000-0000-0000-000000000000');
  await expect(page.getByText('Room not found')).toBeVisible();
  await page.goto('/join/deadbeef0000');
  await expect(page.getByText('That invite link doesn’t work any more')).toBeVisible();
  expect(errors.filter((e) => !/404|Not Found/.test(e))).toEqual([]);
});
