// Drives the tamper demo: drag a link out, check the verifier's verdict, reset, then keyboard.
import { chromium } from '@playwright/test';
const base = process.argv[2] ?? 'http://localhost:5199/';
const browser = await chromium.launch({
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await page.evaluate(() => {
  const el = document.querySelector('.how');
  window.scrollTo(0, el.getBoundingClientRect().top + scrollY + 2.55 * innerHeight);
});
await page.waitForTimeout(2000);
const status = () => page.locator('#chain-status').innerText();
console.log('before:', await status());
// Probe for a link under the pointer near the chain anchor.
const anchor = await page.evaluate(() => {
  const r = document.querySelector('[data-anchor="chain"]').getBoundingClientRect();
  return { x: r.left, y: r.top + r.height / 2, h: r.height };
});
let hit = null;
for (let dx = -400; dx <= 400 && !hit; dx += 20) {
  for (let dy = -120; dy <= 120 && !hit; dy += 12) {
    await page.mouse.move(anchor.x + dx, anchor.y + dy);
    const hovering = await page.evaluate(() =>
      document.querySelector('[data-tamper]').classList.contains('is-hovering'),
    );
    if (hovering) hit = { x: anchor.x + dx, y: anchor.y + dy };
  }
}
console.log('hover hit at', hit);
if (hit) {
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(hit.x + i * 6, hit.y - i * 9);
    await page.waitForTimeout(16);
  }
  await page.screenshot({ path: 'shots/t-drag.png' });
  await page.mouse.up();
  await page.waitForTimeout(1800);
  console.log('after drag:', await status());
  await page.screenshot({ path: 'shots/t-broken.png' });
  await page.click('[data-reset]');
  await page.waitForTimeout(1400);
  console.log(
    'after reset:',
    await status(),
    'reset hidden:',
    await page.locator('[data-reset]').isHidden(),
  );
}
await page.focus('[data-tamper-key]');
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
console.log('after keyboard:', await status());
await page.screenshot({ path: 'shots/t-keyboard.png' });
await page.keyboard.press('Escape');
await page.waitForTimeout(800);
console.log('after escape:', await status());
console.log(errs.length ? errs.join('\n') : 'no page errors');
await browser.close();
