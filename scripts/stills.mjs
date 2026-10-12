// Renders the still frames used when WebGL is unavailable, from the same scene.
// Requires the dev server: npm run dev -- --port 5199, then npm run stills.
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const base = process.env.LAB ?? 'http://localhost:5199/lab.html';
const out = new URL('../public/img/', import.meta.url).pathname;
await mkdir(out, { recursive: true });

// name, query, viewport, output widths
const jobs = [
  ['still-hero', 's=0&ah=300', [1000, 1000], [520, 1040]],
  ['still-chain', 's=3&g=1&ah=146&cy=0.57', [1920, 1080], [960, 1920]],
  ['still-day', 's=4&ah=300', [1400, 1400], [700, 1400]],
  ['still-close', 's=5&ah=300', [1000, 1000], [520, 1040]],
];

const browser = await chromium.launch({
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
for (const [name, query, [w, h], widths] of jobs) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await page.goto(`${base}?${query}&still&bg=none`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const png = await page.screenshot({ omitBackground: true });
  for (const width of widths) {
    const img = sharp(png).resize({ width });
    await img.clone().webp({ quality: 82, alphaQuality: 90 }).toFile(`${out}${name}-${width}.webp`);
    await img.clone().avif({ quality: 56, effort: 6 }).toFile(`${out}${name}-${width}.avif`);
  }
  console.log('rendered', name);
  await page.close();
}
await browser.close();
