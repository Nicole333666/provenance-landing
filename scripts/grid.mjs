// node scripts/grid.mjs out.png cols width files... : labelled grid of frames (dev aid)
import sharp from 'sharp';
import { basename } from 'node:path';
const [out, cols, w, ...files] = process.argv.slice(2);
const W = +w, C = +cols;
const metas = await Promise.all(files.map((f) => sharp(f).metadata()));
const H = Math.round((metas[0].height / metas[0].width) * W);
const rows = Math.ceil(files.length / C);
const pad = 22;
const tiles = await Promise.all(files.map(async (f, i) => {
  const label = basename(f).replace(/\.\w+$/, '');
  const img = await sharp(f).resize(W, H).toBuffer();
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${pad}"><rect width="100%" height="100%" fill="#222"/><text x="6" y="16" font-family="monospace" font-size="13" fill="#ff0">${label}</text></svg>`);
  return [{ input: svg, left: (i % C) * (W + 6), top: Math.floor(i / C) * (H + pad + 6) }, { input: img, left: (i % C) * (W + 6), top: Math.floor(i / C) * (H + pad + 6) + pad }];
}));
await sharp({ create: { width: C * (W + 6), height: rows * (H + pad + 6), channels: 3, background: '#555' } }).composite(tiles.flat()).png().toFile(out);
console.log(out);
