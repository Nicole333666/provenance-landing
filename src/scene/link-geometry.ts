import { Curve, TubeGeometry, Vector3 } from 'three';

/**
 * Link proportions, taken from the brand mark (`provenance-mark.svg`):
 * a 96 x 104 rounded rectangle, corner radius 34, stroke 18. Normalised so the
 * centreline height is 1.
 */
export const LINK = {
  width: 96 / 104,
  height: 1,
  corner: 34 / 104,
  tube: 10.4 / 104,
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

export function createLinkGeometry(tubular = 240, radial = 36): TubeGeometry {
  const geo = new TubeGeometry(new RoundedRectCurve(), tubular, LINK.tube, radial, true);
  geo.computeBoundingSphere();
  return geo;
}
