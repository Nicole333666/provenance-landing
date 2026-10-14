import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { LINK } from './link-geometry';
import { blendPoses, CHAIN_PITCH, chainSlot, formPoses, LINK_COUNT, makePoses } from './poses';

describe('chainSlot', () => {
  it('keeps the pair adjacent and fills outward without collisions', () => {
    const slots = Array.from({ length: LINK_COUNT }, (_, i) => chainSlot(i));
    expect(slots.slice(0, 6)).toEqual([0, 1, -1, 2, -2, 3]);
    expect(new Set(slots).size).toBe(LINK_COUNT);
  });
});

describe('formPoses', () => {
  it('pair: first link passes over at the top and under at the bottom', () => {
    const [ink, accent] = formPoses('pair', 0, makePoses());
    const top = new Vector3(0, LINK.height / 2, 0);
    const bottom = new Vector3(0, -LINK.height / 2, 0);
    const inkTop = top.clone().applyQuaternion(ink!.quaternion);
    const accentTop = top.clone().applyQuaternion(accent!.quaternion);
    const inkBottom = bottom.clone().applyQuaternion(ink!.quaternion);
    const accentBottom = bottom.clone().applyQuaternion(accent!.quaternion);
    expect(inkTop.z).toBeGreaterThan(accentTop.z);
    expect(inkBottom.z).toBeLessThan(accentBottom.z);
    // The flat, extruded links clear each other at the crossings.
    expect(inkTop.z - accentTop.z).toBeGreaterThan(2 * LINK.flatHalfDepth + 0.04);
  });

  it('pair shows only two links', () => {
    const poses = formPoses('pair', 1, makePoses());
    expect(poses.filter((p) => p.scale > 0)).toHaveLength(2);
  });

  it('chain interlocks: neighbouring strands clear by at least two tube radii', () => {
    expect(LINK.width - CHAIN_PITCH).toBeGreaterThanOrEqual(2 * LINK.tube);
    expect(CHAIN_PITCH).toBeLessThan(LINK.width - 2 * LINK.tube + 1e-9);
  });

  it('chain grows from the pair outward', () => {
    const none = formPoses('chain', 0, makePoses());
    const all = formPoses('chain', 1, makePoses());
    expect(none.filter((p) => p.scale > 0.5)).toHaveLength(2);
    expect(all.every((p) => p.scale > 0.99)).toBe(true);
  });

  it('single shows one link, untilted', () => {
    const poses = formPoses('single', 0, makePoses());
    expect(poses[0]!.scale).toBe(1);
    expect(poses.slice(1).every((p) => p.scale === 0)).toBe(true);
  });
});

describe('chain <-> pair', () => {
  it('the pair never passes through itself on the way to or from the chain', () => {
    // The second link's top edge stays on the far side of the first link's plane.
    const chain = formPoses('chain', 0, makePoses());
    const pair = formPoses('pair', 0, makePoses());
    const out = makePoses();
    const up = new Vector3(0, 1, 0);
    for (let t = 0; t <= 1.0001; t += 0.05) {
      blendPoses(chain, pair, t, out);
      const relative = out[0]!.quaternion.clone().invert().multiply(out[1]!.quaternion);
      const edge = up.clone().applyQuaternion(relative);
      expect(edge.z).toBeLessThan(-Math.sin((20 * Math.PI) / 180));
    }
  });
});

describe('blendPoses', () => {
  it('interpolates position and scale', () => {
    const a = formPoses('pair', 0, makePoses());
    const b = formPoses('single', 0, makePoses());
    const mid = blendPoses(a, b, 0.5, makePoses());
    expect(mid[0]!.position.x).toBeCloseTo(-LINK.offset / 4);
    expect(mid[1]!.scale).toBeCloseTo(0.5);
  });
});
