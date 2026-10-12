// node scripts/sheet.mjs out.png a.png b.png ... : side-by-side contact sheet (dev aid)
import sharp from 'sharp';
const [out, ...files] = process.argv.slice(2);
const imgs = await Promise.all(files.map(async (f) => ({ f, m: await sharp(f).metadata() })));
const h = Math.max(...imgs.map((i) => i.m.height));
const gap = 12;
const w = imgs.reduce((a, i) => a + i.m.width + gap, -gap);
await sharp({ create: { width: w, height: h, channels: 3, background: '#777' } })
  .composite(
    imgs.reduce(
      (acc, i) => {
        acc.list.push({ input: i.f, left: acc.x, top: 0 });
        acc.x += i.m.width + gap;
        return acc;
      },
      { list: [], x: 0 },
    ).list,
  )
  .png()
  .toFile(out);
console.log('sheet', out, w, h);
