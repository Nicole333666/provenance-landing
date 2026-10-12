import { describe, expect, it } from 'vitest';
import { LINK, roundedRectPoint } from './link-geometry';

const { width: w, height: h, corner: r } = LINK;

describe('roundedRectPoint', () => {
  it('starts at the top centre', () => {
    const [x, y] = roundedRectPoint(0, w, h, r);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(h / 2);
  });

  it('is closed: t=1 meets t=0', () => {
    const a = roundedRectPoint(0, w, h, r);
    const b = roundedRectPoint(0.999999, w, h, r);
    expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(1e-4);
  });

  it('is continuous with no jumps between samples', () => {
    const n = 4000;
    const step = (2 * (w - 2 * r) + 2 * (h - 2 * r) + 2 * Math.PI * r) / n;
    let prev = roundedRectPoint(0, w, h, r);
    for (let i = 1; i <= n; i++) {
      const p = roundedRectPoint(i / n, w, h, r);
      expect(Math.hypot(p[0] - prev[0], p[1] - prev[1])).toBeLessThan(step * 1.01);
      prev = p;
    }
  });

  it('stays inside the bounding box and touches each side', () => {
    let maxX = -Infinity;
    let minY = Infinity;
    for (let i = 0; i < 2000; i++) {
      const [x, y] = roundedRectPoint(i / 2000, w, h, r);
      expect(Math.abs(x)).toBeLessThanOrEqual(w / 2 + 1e-9);
      expect(Math.abs(y)).toBeLessThanOrEqual(h / 2 + 1e-9);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
    }
    expect(maxX).toBeCloseTo(w / 2);
    expect(minY).toBeCloseTo(-h / 2);
  });

  it('wraps negative and >1 parameters', () => {
    expect(roundedRectPoint(-0.25, w, h, r)).toEqual(roundedRectPoint(0.75, w, h, r));
    const a = roundedRectPoint(1.25, w, h, r);
    const b = roundedRectPoint(0.25, w, h, r);
    expect(a[0]).toBeCloseTo(b[0]);
    expect(a[1]).toBeCloseTo(b[1]);
  });
});

describe('createLinkGeometry', () => {
  it('has a flat base and a round morph target with the same topology', async () => {
    const { createLinkGeometry, LINK } = await import('./link-geometry');
    const g = createLinkGeometry(64, 16);
    const base = g.getAttribute('position');
    const round = g.morphAttributes.position![0]!;
    expect(round.count).toBe(base.count);
    // The flat mark is no deeper than its 2D stroke is wide; the tube is round.
    let maxZ = 0;
    let maxZr = 0;
    for (let i = 0; i < base.count; i++) {
      maxZ = Math.max(maxZ, Math.abs(base.getZ(i)));
      maxZr = Math.max(maxZr, Math.abs(round.getZ(i)));
    }
    expect(maxZ).toBeCloseTo(LINK.flatHalfDepth, 3);
    expect(maxZr).toBeCloseTo(LINK.tube, 3);
  });

  it('normals point away from the centreline (outer edge faces outward)', async () => {
    const { createLinkGeometry, roundedRectPoint: rp } = await import('./link-geometry');
    const segments = 64;
    const radial = 16;
    const g = createLinkGeometry(segments, radial);
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    for (let i = 0; i < segments; i++) {
      const [cx, cy] = rp(i / segments, w, h, r);
      const v = i * radial; // profile angle 0: the outer edge
      const dx = p.getX(v) - cx;
      const dy = p.getY(v) - cy;
      const len = Math.hypot(dx, dy);
      expect((n.getX(v) * dx + n.getY(v) * dy) / len).toBeGreaterThan(0.9);
    }
  });
});
