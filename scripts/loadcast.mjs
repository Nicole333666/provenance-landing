// Records every painted frame of a cold page load (CDP screencast), with timestamps.
// node scripts/loadcast.mjs <url> <prefix> [ms]
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const [url, prefix = 'lc', ms = '4000'] = process.argv.slice(2);
await mkdir('shots/lc', { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const frames = [];
let t0 = 0;
cdp.on('Page.screencastFrame', async (f) => {
  frames.push({ t: f.metadata.timestamp, data: f.data });
  await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId });
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: 720, maxHeight: 450, everyNthFrame: 1 });
const events = [];
page.on('console', (m) => events.push(`${Date.now()} console ${m.text()}`));
const start = Date.now() / 1000;
await page.goto(url, { waitUntil: 'commit' });
await page.waitForTimeout(+ms);
await cdp.send('Page.stopScreencast');
t0 = frames[0]?.t ?? start;
for (const [i, f] of frames.entries()) {
  const dt = Math.round((f.t - start) * 1000);
  await writeFile(`shots/lc/${prefix}-${String(i).padStart(3, '0')}-${dt}ms.jpg`, Buffer.from(f.data, 'base64'));
}
console.log(prefix, 'frames:', frames.length, frames.map((f) => Math.round((f.t - start) * 1000)).join(' '));
await browser.close();
