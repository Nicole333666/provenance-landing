// Pins the histories section and lets it play by itself: frames at fixed times.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1512, height: 860 } });
await page.goto(process.argv[2] ?? 'http://localhost:5199/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const el = document.querySelector('.histories');
  window.scrollTo(0, el.getBoundingClientRect().top + scrollY + 10);
});
const t0 = Date.now();
for (const at of [1000, 4000, 9000, 15000, 22000, 30000, 36000, 41000]) {
  await page.waitForTimeout(Math.max(0, at - (Date.now() - t0)));
  await page.screenshot({ path: `shots/auto-${String(at).padStart(5, '0')}.png` });
}
await browser.close();
