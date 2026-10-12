// Screenshots every chapter at a viewport. Dev aid for visual review.
// node scripts/shots.mjs [baseUrl] [width] [height] [prefix] [--reduced]
import { chromium } from '@playwright/test';
const args = process.argv.slice(2);
const reduced = args.includes('--reduced');
const noWebgl = args.includes('--nowebgl');
const [base = 'http://localhost:5199/', w = '1440', h = '900', prefix = 'd'] = args.filter(
  (a) => !a.startsWith('--'),
);
const only = process.env.ONLY?.split(',');

const stops = [
  ['hero', '.hero', 0],
  ['proof', '.proof', 0.05],
  ['thesis', '.thesis', 0.2],
  ['hist0', '.histories', 0.1],
  ['hist1', '.histories', 1.2],
  ['hist2', '.histories', 2.6],
  ['hist3', '.histories', 4.0],
  ['hist4', '.histories', 5.6],
  ['hist5', '.histories', 5.98],
  ['mark', '.how', 0.1],
  ['morph', '.how', 0.75],
  ['chain', '.how', 1.6],
  ['tamper0', '.how', 2.1],
  ['tamper1', '.how', 2.9],
  ['cover', '.how', 3.9],
  ['relight', '.relight', 0.35],
  ['fair', '.fair', 0],
  ['principles', '.principles', -0.2],
  ['insight', '.evening', -0.45],
  ['insight0', '.insight', 0.02],
  ['suite', '.suite__map', -0.3],
  ['privacy', '.privacy', 0.05],
  ['field', '.field', -0.3],
  ['pledges', '.sees', -0.1],
  ['tryit0', '.tryit', 0.05],
  ['tryit1', '.tryit', 1.1],
  ['tryit2', '.tryit', 2.0],
  ['limits', '.limits', 0.05],
  ['close', '.close', 0],
];

const browser = await chromium.launch({
  args: noWebgl
    ? ['--disable-webgl', '--disable-3d-apis']
    : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({
  viewport: { width: +w, height: +h },
  deviceScaleFactor: 1,
  reducedMotion: reduced ? 'reduce' : 'no-preference',
});
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => {
  if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(3600);
for (const [name, sel, vh] of stops) {
  if (only && !only.includes(name)) continue;
  await page.evaluate(
    ([s, v]) => {
      const el = document.querySelector(s);
      const y = el.getBoundingClientRect().top + window.scrollY + v * window.innerHeight;
      window.scrollTo(0, Math.max(0, y));
    },
    [sel, vh],
  );
  await page.waitForTimeout(name === 'tamper' ? 1800 : 1500);
  await page.screenshot({ path: `shots/${prefix}-${name}.png` });
}
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - window.innerWidth,
);
console.log('horizontal overflow px:', overflow);
console.log(logs.slice(0, 20).join('\n') || 'no console errors');
await browser.close();
