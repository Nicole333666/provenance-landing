import { BufferAttribute, BufferGeometry, Curve, Vector3 } from 'three';

/**
 * Link proportions, taken from the brand mark (`provenance-mark.svg`):
 * a 96 x 104 rounded rectangle, corner radius 34, stroke 18. Normalised so the
 * centreline height is 1.
 */
export const LINK = {
  width: 96 / 104,
  height: 1,
  corner: 34 / 104,
  /** round cross-section (chain links) */
  tube: 10.4 / 104,
  /** flat cross-section (the extruded mark): half the 2D stroke, and half the depth */
  flatHalfWidth: 9 / 104,
  flatHalfDepth: 6.2 / 104,
  /** horizontal offset between the two links of the mark */
  offset: 60 / 104,
} as const;

/** Outer extent of one link, centreline plus tube. */
export const LINK_OUTER = {
  width: LINK.width + LINK.tube * 2,
  height: LINK.height + LINK.tube * 2,
};

/**
 * A point on a rounded rectangle centreline, parameterised by arc length
 * (t in [0, 1)), starting at the top-centre and running clockwise.
 */
export function roundedRectPoint(t: number, w: number, h: number, r: number): [number, number] {
  const sx = w - 2 * r; // straight run, horizontal
  const sy = h - 2 * r; // straight run, vertical
  const arc = (Math.PI / 2) * r;
  const perimeter = 2 * sx + 2 * sy + 4 * arc;
  let d = (((t % 1) + 1) % 1) * perimeter;
  const hw = w / 2;
  const hh = h / 2;

  // Segments in order: top-right half run, TR arc, right run, BR arc,
  // bottom run, BL arc, left run, TL arc, top-left half run.
  if (d < sx / 2) return [d, hh];
  d -= sx / 2;
  if (d < arc) return corner(hw - r, hh - r, r, Math.PI / 2 - d / r);
  d -= arc;
  if (d < sy) return [hw, hh - r - d];
  d -= sy;
  if (d < arc) return corner(hw - r, -(hh - r), r, -d / r);
  d -= arc;
  if (d < sx) return [hw - r - d, -hh];
  d -= sx;
  if (d < arc) return corner(-(hw - r), -(hh - r), r, -Math.PI / 2 - d / r);
  d -= arc;
  if (d < sy) return [-hw, -(hh - r) + d];
  d -= sy;
  if (d < arc) return corner(-(hw - r), hh - r, r, Math.PI - d / r);
  d -= arc;
  return [-hw + r + d, hh];
}

function corner(cx: number, cy: number, r: number, a: number): [number, number] {
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

export class RoundedRectCurve extends Curve<Vector3> {
  constructor(
    private readonly w = LINK.width,
    private readonly h = LINK.height,
    private readonly r = LINK.corner,
  ) {
    super();
  }

  override getPoint(t: number, target = new Vector3()): Vector3 {
    const [x, y] = roundedRectPoint(t, this.w, this.h, this.r);
    return target.set(x, y, 0);
  }
}

/**
 * A point on a superellipse cross-section: n = 2 is an ellipse, larger n is a
 * rectangle with ever softer corners. Returns [radial, depth].
 */
export function profilePoint(theta: number, a: number, b: number, n: number): [number, number] {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const e = 2 / n;
  return [a * Math.sign(c) * Math.abs(c) ** e, b * Math.sign(s) * Math.abs(s) ** e];
}

/** The two cross-sections a link can have. */
export const PROFILES = {
  /** the 2D mark given depth: flat face, softened edges */
  flat: { a: LINK.flatHalfWidth, b: LINK.flatHalfDepth, n: 7 },
  /** a chain link */
  tube: { a: LINK.tube, b: LINK.tube, n: 2 },
} as const;

/**
 * One link, swept along the mark's rounded rectangle. The base shape is the flat,
 * extruded mark; morph target 0 is the round chain link, with the same topology,
 * so a link can round out on screen.
 */
export function createLinkGeometry(segments = 240, radial = 36): BufferGeometry {
  const sweep = (p: { a: number; b: number; n: number }) => {
    const pos = new Float32Array(segments * radial * 3);
    const eps = 1e-4;
    let k = 0;
    for (let i = 0; i < segments; i++) {
      const t = i / segments;
      const [px, py] = roundedRectPoint(t, LINK.width, LINK.height, LINK.corner);
      const [qx, qy] = roundedRectPoint(t + eps, LINK.width, LINK.height, LINK.corner);
      const tl = Math.hypot(qx - px, qy - py) || 1;
      // Outward normal of a clockwise path, in the link's plane.
      const nx = -(qy - py) / tl;
      const ny = (qx - px) / tl;
      for (let j = 0; j < radial; j++) {
        const [r, d] = profilePoint((j / radial) * Math.PI * 2, p.a, p.b, p.n);
        pos[k++] = px + nx * r;
        pos[k++] = py + ny * r;
        pos[k++] = d;
      }
    }
    return pos;
  };

  const index: number[] = [];
  for (let i = 0; i < segments; i++) {
    const i1 = (i + 1) % segments;
    for (let j = 0; j < radial; j++) {
      const j1 = (j + 1) % radial;
      const a = i * radial + j;
      const b = i1 * radial + j;
      const c = i1 * radial + j1;
      const d = i * radial + j1;
      index.push(a, d, b, d, c, b);
    }
  }

  const build = (pos: Float32Array) => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
  };
  const flat = build(sweep(PROFILES.flat));
  const tube = build(sweep(PROFILES.tube));
  flat.morphAttributes.position = [tube.getAttribute('position')];
  flat.morphAttributes.normal = [tube.getAttribute('normal')];
  flat.computeBoundingSphere();
  tube.dispose();
  return flat;
}
