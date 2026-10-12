// No-WebGL: the tamper button still edits and re-verifies the chain.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--disable-webgl', '--disable-3d-apis'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(process.argv[2] ?? 'http://localhost:5199/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.evaluate(() => {
  const el = document.querySelector('.how');
  window.scrollTo(0, el.getBoundingClientRect().top + scrollY + 2.55 * innerHeight);
});
await page.waitForTimeout(1500);
console.log(
  'no-stage:',
  await page.evaluate(() => document.documentElement.classList.contains('no-stage')),
);
await page.click('[data-tamper-still]');
await page.waitForTimeout(1200);
console.log('status:', await page.locator('#chain-status').innerText());
await page.screenshot({ path: 'shots/n-tampered.png' });
console.log(errs.join('\n') || 'no page errors');
await browser.close();
