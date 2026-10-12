// Records the screen through a nav click (fade-through check).
import { chromium } from '@playwright/test';
import { mkdir, writeFile, rm } from 'node:fs/promises';
const [url = 'http://localhost:5199/', link = 'Tools'] = process.argv.slice(2);
await rm('shots/nav', { recursive: true, force: true });
await mkdir('shots/nav', { recursive: true });
const browser = await chromium.launch({
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1512, height: 860 } });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const cdp = await ctx.newCDPSession(page);
const frames = [];
cdp.on('Page.screencastFrame', async (f) => {
  frames.push({ t: f.metadata.timestamp, data: f.data });
  await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId });
});
await cdp.send('Page.startScreencast', {
  format: 'jpeg',
  quality: 60,
  maxWidth: 640,
  maxHeight: 400,
});
const t0 = Date.now() / 1000;
await page.getByRole('link', { name: link, exact: true }).first().click();
await page.waitForTimeout(1600);
await cdp.send('Page.stopScreencast');
for (const [i, f] of frames.entries()) {
  await writeFile(
    `shots/nav/${String(i).padStart(3, '0')}-${Math.round((f.t - t0) * 1000)}ms.jpg`,
    Buffer.from(f.data, 'base64'),
  );
}
console.log('frames', frames.length, 'scrollY', await page.evaluate(() => Math.round(scrollY)));
await browser.close();
