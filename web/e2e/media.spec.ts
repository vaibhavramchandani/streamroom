import { expect, test, type Browser, type Page } from '@playwright/test';

// Two real browsers against a live LiveKit server. Run with MEDIA=1.
// Covers what slice.spec.ts doesn't: voice, subscribe-on-click, stats, fullscreen, stop watching.
test.skip(process.env.MEDIA !== '1', 'needs a LiveKit server: run with MEDIA=1');

const run = Date.now().toString(36).slice(-4);

async function signIn(browser: Browser, name: string, plan: 'free' | 'hd', path = '/') {
  const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write', 'microphone'] });
  // Keep a handle on every peer connection so the test can read real WebRTC stats.
  await ctx.addInitScript(() => {
    const w = window as unknown as { __pcs: RTCPeerConnection[]; RTCPeerConnection: typeof RTCPeerConnection };
    w.__pcs = [];
    const Orig = w.RTCPeerConnection;
    w.RTCPeerConnection = function (...a: ConstructorParameters<typeof RTCPeerConnection>) {
      const pc = new Orig(...a);
      w.__pcs.push(pc);
      return pc;
    } as unknown as typeof RTCPeerConnection;
    w.RTCPeerConnection.prototype = Orig.prototype;
  });
  const page = await ctx.newPage();
  await page.goto(path);
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('radio', { name: plan === 'hd' ? /HD/ : /Free/ }).click();
  await page.getByLabel('Your name').press('Enter');
  return page;
}

/** Bytes of inbound RTP of a kind, across all peer connections on the page. */
function inboundBytes(page: Page, kind: 'audio' | 'video') {
  return page.evaluate(async (k) => {
    let n = 0;
    for (const pc of (window as unknown as { __pcs: RTCPeerConnection[] }).__pcs) {
      (await pc.getStats()).forEach((s) => {
        if (s.type === 'inbound-rtp' && s.kind === k) n += s.bytesReceived ?? 0;
      });
    }
    return n;
  }, kind);
}

test('voice, subscribe-on-click, stats, fullscreen and stop watching across two browsers', async ({ browser }) => {
  test.setTimeout(120_000);
  const host = await signIn(browser, `Vaibhav ${run}`, 'hd');
  await host.getByLabel('Room name').fill('Media check');
  await host.getByRole('button', { name: 'Create room' }).click();
  await host.getByRole('button', { name: 'Copy invite link' }).click();
  const invite = await host.evaluate(() => navigator.clipboard.readText());
  const guest = await signIn(browser, `Priya ${run}`, 'free', new URL(invite).pathname);

  await host.getByRole('button', { name: 'Join the call' }).click();
  await guest.getByRole('button', { name: 'Join the call' }).click();
  await expect(host.getByText('2 in the call')).toBeVisible({ timeout: 15_000 });

  // Voice: the host unmutes (fake mic tone) and the guest receives audio packets.
  await host.getByRole('button', { name: 'Unmute microphone' }).click();
  await expect(host.getByRole('button', { name: 'Mute microphone' })).toBeVisible();
  const before = await inboundBytes(guest, 'audio');
  await expect.poll(() => inboundBytes(guest, 'audio'), { timeout: 15_000 }).toBeGreaterThan(before + 2000);

  // Go live. Nobody has clicked to watch yet, so the guest must receive no video at all.
  await host.getByRole('button', { name: 'Share your screen' }).click();
  await host.getByRole('button', { name: /Go live · 1080p60/ }).click();
  await expect(host.getByText('You · sharing')).toBeVisible({ timeout: 15_000 });
  await expect(guest.getByRole('button', { name: /Watch Vaibhav/ })).toBeVisible();
  await guest.waitForTimeout(3000);
  expect(await inboundBytes(guest, 'video'), 'video must not flow before the viewer clicks').toBe(0);

  // Watch: video flows and the stats overlay reports real numbers.
  await guest.getByRole('button', { name: /Watch Vaibhav/ }).click();
  const stage = guest.getByRole('figure', { name: /Vaibhav/ });
  await expect(stage.getByText('1920×1080')).toBeVisible({ timeout: 20_000 });
  expect(await inboundBytes(guest, 'video')).toBeGreaterThan(10_000);
  const fps = stage.locator('dt', { hasText: 'Frame rate' }).locator('xpath=following-sibling::dd[1]');
  await expect.poll(async () => parseInt((await fps.textContent()) ?? '0', 10), { timeout: 10_000 }).toBeGreaterThan(5);
  await expect(stage.locator('dt', { hasText: 'Codec' }).locator('xpath=following-sibling::dd[1]')).toHaveText(/VP9|VP8|H264/);
  await expect(stage.locator('dt', { hasText: 'Packet loss' })).toBeVisible();

  // Fullscreen.
  await stage.hover();
  await stage.getByRole('button', { name: 'Full screen' }).click();
  await expect.poll(() => guest.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await guest.evaluate(() => document.exitFullscreen());

  // Stop watching: the stage closes and video stops flowing (viewer-only subscription).
  await stage.hover();
  await stage.getByRole('button', { name: 'Stop watching' }).click();
  await expect(stage).toHaveCount(0);
  const stopped = await inboundBytes(guest, 'video');
  await guest.waitForTimeout(2500);
  expect(await inboundBytes(guest, 'video'), 'video should stop after Stop watching').toBeLessThan(stopped + 20_000);
});
