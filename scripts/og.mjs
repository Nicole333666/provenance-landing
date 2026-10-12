// Renders the social card from the real hero (1200x630). Requires the dev server.
import { chromium } from '@playwright/test';
import sharp from 'sharp';
const browser = await chromium.launch({
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 2,
});
await page.goto(process.argv[2] ?? 'http://localhost:5199/', { waitUntil: 'networkidle' });
await page.addStyleTag({ content: '.nav__island, .hero__side { display: none !important; }' });
await page.waitForTimeout(4200);
const png = await page.screenshot();
await sharp(png)
  .resize({ width: 1200 })
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile('public/img/og.jpg');
await browser.close();
console.log('wrote public/img/og.jpg');
