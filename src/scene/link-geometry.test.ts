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
