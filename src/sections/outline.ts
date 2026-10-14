/**
 * The record as texture: chains drawn as engineering outlines, two hairlines per
 * strand, with a clean gap wherever one strand passes over another. The gaps are
 * knockouts painted in the ground colour, drawn in weave order.
 */

const NS = 'http://www.w3.org/2000/svg';

export interface OutlineOptions {
  /** number of links */
  count: number;
  /** link height in px (the chain runs horizontally) */
  size: number;
  /** strand stroke colour */
  ink: string;
  /** ground colour, used for the knockouts */
  ground: string;
  /** hairline width */
  line?: number;
  /** extra class on each path, for draw-on animation */
  pathClass?: string;
  /** centre-to-centre spacing as a fraction of link height (the mark uses 60/104) */
  step?: number;
}

/** Path for a rounded rectangle centred on (cx, cy). */
function rrect(cx: number, cy: number, w: number, h: number, r: number): string {
  const x = cx - w / 2;
  const y = cy - h / 2;
  r = Math.min(r, w / 2, h / 2);
  return (
    `M${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}` +
    `V${y + h - r}A${r},${r} 0 0 1 ${x + w - r},${y + h}` +
    `H${x + r}A${r},${r} 0 0 1 ${x},${y + h - r}` +
    `V${y + r}A${r},${r} 0 0 1 ${x + r},${y}Z`
  );
}

let clipSeq = 0;

/**
 * Builds the SVG markup for a row of woven links, the brand mark repeated: each
 * link passes over its right-hand neighbour at the top crossing and under it at
 * the bottom. Returns [markup, width, height].
 */
export function outlineChain(o: OutlineOptions): [string, number, number] {
  const line = o.line ?? 1;
  const h = o.size;
  const w = h * (96 / 104);
  const tube = h * (9 / 104);
  const corner = h * (34 / 104);
  const step = h * (o.step ?? 60 / 104);
  const gap = line * 2.2;
  const pad = tube + line * 4;
  const cy = h / 2 + pad;
  const width = step * (o.count - 1) + w + pad * 2;
  const height = h + pad * 2;
  const cls = o.pathClass ? ` class="${o.pathClass}"` : '';
  const id = `wv${(clipSeq++).toString(36)}`;

  const link = (cx: number) =>
    `<path d="${rrect(cx, cy, w, h, corner)}" fill="none" stroke="${o.ground}" stroke-width="${tube * 2 + gap * 2}"/>` +
    `<path${cls} pathLength="1" d="${rrect(cx, cy, w + tube * 2, h + tube * 2, corner + tube)}" fill="none" stroke="${o.ink}" stroke-width="${line}"/>` +
    `<path${cls} pathLength="1" d="${rrect(cx, cy, w - tube * 2, h - tube * 2, corner - tube)}" fill="none" stroke="${o.ink}" stroke-width="${line}"/>`;

  let defs = '';
  let body = '';
  const centres = Array.from({ length: o.count }, (_, i) => pad + w / 2 + i * step);
  centres.forEach((cx) => (body += link(cx)));
  // Re-draw each link's top-right crossing above its neighbour: the weave.
  for (let i = 0; i < o.count - 1; i++) {
    const a = centres[i]!;
    const b = centres[i + 1]!;
    const x0 = b - w / 2 - tube - gap * 2;
    const x1 = a + w / 2 + tube + gap * 2;
    defs += `<clipPath id="${id}-${i}"><rect x="${x0.toFixed(2)}" y="0" width="${(x1 - x0).toFixed(2)}" height="${cy.toFixed(2)}"/></clipPath>`;
    body += `<g clip-path="url(#${id}-${i})">${link(a)}</g>`;
  }
  return [`<defs>${defs}</defs>${body}`, width, height];
}

/** A seamless tile of chain rows for the signal ground, as a CSS background. */
export function signalPattern(rule: string, ground: string): string {
  const size = 128;
  const w = size * (96 / 104);
  const step = size * (60 / 104);
  const line = 1.5;
  const pad = size * (9 / 104) + line * 4;
  const [row, , height] = outlineChain({ count: 12, size, ink: rule, ground, line });
  // The row repeats every link; the tile is six links wide.
  const tileW = step * 6;
  const gap = height * 0.42;
  const rows = 2;
  const tileH = rows * (height + gap);
  let body = '';
  for (let r = 0; r < rows; r++) {
    const x = -(pad + w / 2) - 3 * step + (r % 2) * (step / 2);
    body += `<g transform="translate(${x.toFixed(2)} ${(r * (height + gap) + gap / 2).toFixed(2)})">${row}</g>`;
  }
  const svg = `<svg xmlns="${NS}" width="${tileW.toFixed(2)}" height="${tileH.toFixed(2)}" viewBox="0 0 ${tileW.toFixed(2)} ${tileH.toFixed(2)}">${body}</svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

/** The mark, set into the paper as a blind emboss: paper on paper, edges only. */
export function mountEmboss(host: HTMLElement): void {
  host.innerHTML = `<svg viewBox="30 54 196 144" aria-hidden="true">
    <defs>
      <clipPath id="emboss-cross"><rect x="96" y="50" width="64" height="78"/></clipPath>
      <filter id="emboss" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
        <feDropShadow dx="-0.7" dy="-0.7" stdDeviation="0.35" flood-color="#ffffff" flood-opacity="0.95"/>
        <feDropShadow dx="0.9" dy="1.1" stdDeviation="0.9" flood-color="#2a3140" flood-opacity="0.2"/>
      </filter>
    </defs>
    <g fill="none" stroke="#f4f4f2" stroke-width="18">
      <rect filter="url(#emboss)" x="50" y="74" width="96" height="104" rx="34"/>
      <rect filter="url(#emboss)" x="110" y="74" width="96" height="104" rx="34"/>
      <g clip-path="url(#emboss-cross)"><rect filter="url(#emboss)" x="50" y="74" width="96" height="104" rx="34"/></g>
    </g>
  </svg>`;
}
