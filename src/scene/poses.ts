import { Euler, Quaternion, Vector3 } from 'three';
import { LINK } from './link-geometry';
import { chainSlot, LINK_COUNT } from './slots';

export { chainSlot, LINK_COUNT };

/** Opposite tilt that makes the pair weave: the first link passes over at the top. */
export const WEAVE_TILT = (11 * Math.PI) / 180;

/** Centre-to-centre spacing of a chain under tension, with a hair of clearance. */
export const CHAIN_PITCH = LINK.width - 2.12 * LINK.tube;

export type Form = 'pair' | 'chain' | 'single';

export interface Pose {
  position: Vector3;
  quaternion: Quaternion;
  scale: number;
}

export function makePoses(n = LINK_COUNT): Pose[] {
  return Array.from({ length: n }, () => ({
    position: new Vector3(),
    quaternion: new Quaternion(),
    scale: 0,
  }));
}

const _e = new Euler();

/** Small deterministic jitter so the chain does not look machined. */
function jitter(i: number): number {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  return s - Math.floor(s) - 0.5;
}

function smoothstep(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/**
 * Local (anchor-space) pose of every link for a form.
 * `growth` in [0, 1] reveals the chain from the pair outward.
 */
export function formPoses(form: Form, growth: number, out: Pose[], stream = false): Pose[] {
  const n = out.length;
  for (let i = 0; i < n; i++) {
    const p = out[i]!;
    if (form === 'pair' && stream && i >= 2) {
      // The rest of the chain, slid far out along its own axis: arriving at or
      // leaving a pair, the chain runs off both ends instead of shrinking.
      chainPose(i, p);
      p.position.x += Math.sign(p.position.x) * 30;
      p.scale = 1;
    } else if (form === 'pair') {
      const side = i === 0 ? -1 : 1;
      p.position.set((side * LINK.offset) / 2, 0, 0);
      p.quaternion.setFromEuler(_e.set(i === 0 ? WEAVE_TILT : -WEAVE_TILT, 0, 0));
      p.scale = i < 2 ? 1 : 0;
    } else if (form === 'single') {
      p.position.set(0, 0, 0);
      p.quaternion.identity();
      p.scale = i === 0 ? 1 : 0;
    } else {
      chainPose(i, p);
      p.scale = i < 2 ? 1 : smoothstep(growth * (n - 2) - (i - 2));
    }
  }
  return out;
}

function chainPose(i: number, p: Pose): void {
  const slot = chainSlot(i);
  // Centre the chain between the pair's two slots.
  const x = (slot - 0.5) * CHAIN_PITCH;
  const sag = -0.012 * x * x;
  // A link looks the same rolled +90 or -90 degrees. The pair's second link rolls the way
  // its weave tilts, so blending chain <-> pair never turns it flat against the first link:
  // two linked rings of one size cannot lie flat together without passing through.
  const turn = i === 1 ? -1 : 1;
  const roll = (((slot % 2) + 2) % 2) * turn * (Math.PI / 2) + jitter(i) * 0.12;
  p.position.set(x, sag, 0);
  p.quaternion.setFromEuler(_e.set(roll, jitter(i + 7) * 0.05, Math.atan(-0.024 * x)));
}

/** out = lerp(a, b, t), per link. */
export function blendPoses(a: Pose[], b: Pose[], t: number, out: Pose[]): Pose[] {
  for (let i = 0; i < out.length; i++) {
    const o = out[i]!;
    const pa = a[i]!;
    const pb = b[i]!;
    o.position.lerpVectors(pa.position, pb.position, t);
    o.quaternion.slerpQuaternions(pa.quaternion, pb.quaternion, t);
    o.scale = pa.scale + (pb.scale - pa.scale) * t;
  }
  return out;
}
