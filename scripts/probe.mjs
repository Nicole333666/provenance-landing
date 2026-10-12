// Probe at a MacBook-like viewport, DPR 2: stage state, perf fallback, tamper phase copy.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({
  viewport: { width: 1512, height: 860 },
  deviceScaleFactor: 2,
});
const logs = [];
page.on('console', (m) => logs.push(m.text()));
await page.addInitScript(() => {
  const orig = window.requestAnimationFrame;
  let last = 0;
  window.__ft = [];
  window.requestAnimationFrame = (cb) =>
    orig((t) => {
      if (last) window.__ft.push(t - last);
      last = t;
      cb(t);
    });
});
await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
await page.waitForTimeout(4500);
const st = await page.evaluate(() => ({
  cls: document.documentElement.className,
  median: (() => {
    const a = window.__ft.slice(10).sort((x, y) => x - y);
    return a[Math.floor(a.length / 2)];
  })(),
}));
console.log('classes:', st.cls, '| median rAF ms:', st.median?.toFixed(1));
for (const p of [0.3, 1.0, 1.7, 1.95, 2.2, 2.6, 3.0]) {
  await page.evaluate((v) => {
    const el = document.querySelector('.how');
    window.scrollTo(0, el.getBoundingClientRect().top + scrollY + v * innerHeight);
  }, p);
  await page.waitForTimeout(1200);
  const s = await page.evaluate(() => {
    const c = document.querySelector('.how__copy--chain'),
      t = document.querySelector('.how__copy--tamper');
    const h2 = t.querySelector('h2');
    return {
      chainOp: getComputedStyle(c).opacity,
      tamperOp: getComputedStyle(t).opacity,
      tamperVis: getComputedStyle(t).visibility,
      h2Vis: getComputedStyle(h2).visibility,
      live: document.querySelector('[data-tamper]').classList.contains('is-live'),
    };
  });
  console.log(`how +${p}vh`, JSON.stringify(s));
  if (p === 2.6) await page.screenshot({ path: 'shots/probe-tamper.png' });
}
console.log(logs.filter((l) => /warn|error|3D/i.test(l)).join('\n') || 'no warnings');
await browser.close();
