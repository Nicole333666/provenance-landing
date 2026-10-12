import type { Form } from './poses';

/**
 * The object's acts. Each keyframe is placed by a DOM anchor, so the 3D follows
 * the page layout at every viewport size. `state.s` moves between keyframes.
 */
export interface Keyframe {
  form: Form;
  /** CSS selector of the element whose box places and sizes one link */
  anchor: string;
  /** group orientation, degrees XYZ */
  rotation: readonly [number, number, number];
  colorway: 'night' | 'day';
  /** lighting: 0 night studio, 1 day sun */
  day: number;
  /** shadow-catcher opacity */
  shadow: number;
  /** how far behind the object the shadow catcher sits, in link heights */
  shadowDepth: number;
  /** shadow colour, linear RGB */
  shadowTint: readonly [number, number, number];
  /** pointer influence */
  parallax: number;
  /** when arriving from or leaving for the chain, slide the extra links away along the chain */
  stream?: boolean;
}

export const KEYFRAMES: readonly Keyframe[] = [
  {
    form: 'pair',
    anchor: '[data-anchor="hero"]',
    rotation: [6, -16, -4],
    colorway: 'night',
    day: 0,
    shadow: 0.24,
    shadowDepth: 0.5,
    shadowTint: [0, 0, 0],
    parallax: 1,
  },
  {
    form: 'pair',
    anchor: '[data-anchor="thesis"]',
    rotation: [24, 34, -32],
    colorway: 'night',
    day: 0,
    shadow: 0,
    shadowDepth: 1,
    shadowTint: [0, 0, 0],
    parallax: 0.35,
  },
  {
    form: 'chain',
    anchor: '[data-anchor="chain"]',
    rotation: [-38, 8, 31],
    colorway: 'night',
    day: 0,
    shadow: 0.42,
    shadowDepth: 0.9,
    shadowTint: [0, 0, 0],
    parallax: 0.25,
  },
  {
    form: 'pair',
    anchor: '[data-anchor="day"]',
    rotation: [0, 0, 0],
    colorway: 'day',
    day: 1,
    shadow: 0.34,
    shadowDepth: 0.3,
    shadowTint: [0.05, 0.055, 0.09],
    parallax: 0.15,
    stream: true,
  },
  {
    form: 'single',
    anchor: '[data-anchor="close"]',
    rotation: [0, 0, -8],
    colorway: 'day',
    day: 0.85,
    shadow: 0.42,
    shadowDepth: 0.3,
    shadowTint: [0.32, 0.07, 0.0],
    parallax: 0.2,
  },
];

export const KF = { hero: 0, thesis: 1, chain: 2, day: 3, close: 4 } as const;
