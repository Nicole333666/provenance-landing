// Frames of the opening sequence, for review.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const t0 = Date.now();
await page.goto(process.argv[2] ?? 'http://localhost:5199/', { waitUntil: 'commit' });
for (const at of [500, 1100, 1700, 2400, 3400]) {
  const wait = at - (Date.now() - t0);
  if (wait > 0) await page.waitForTimeout(wait);
  await page.screenshot({ path: `shots/intro-${at}.png` });
}
await browser.close();
