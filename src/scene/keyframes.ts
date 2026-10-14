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
  /** cross-section: 0 the flat, extruded mark; 1 a round chain link */
  round: number;
  /** the plain link: Berkeley Blue wherever the object is the logo, porcelain as a chain */
  ink: 'blue' | 'porcelain';
  /** the accent link: California Gold (default), or Berkeley Blue where the ground is gold
   *  and the mark goes one colour, the brand's Blue on Gold */
  accent?: 'gold' | 'blue';
  /** lighting: 0 night studio, 1 day sun */
  day: number;
  /** in daylight, how low the sun sits: 1 (default) a low late sun and a long, crisp
   *  shadow; 0 a high, soft light and a short shadow tucked behind the object */
  sun?: number;
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

const NIGHT_SHADOW = [0, 0, 0] as const;
const DAY_SHADOW = [0.05, 0.07, 0.11] as const;

export const KEYFRAMES: readonly Keyframe[] = [
  {
    // The logo, face on, in daylight: the extruded mark, exactly the 2D mark from the front.
    form: 'pair',
    anchor: '[data-anchor="hero"]',
    rotation: [0, 0, 0],
    round: 0,
    ink: 'blue',
    day: 1,
    sun: 0,
    shadow: 0.2,
    shadowDepth: 0.18,
    shadowTint: DAY_SHADOW,
    parallax: 1,
  },
  {
    // An extreme close-up of the crossing.
    form: 'pair',
    anchor: '[data-anchor="thesis"]',
    rotation: [24, 34, -32],
    round: 0,
    ink: 'blue',
    day: 0,
    shadow: 0,
    shadowDepth: 1,
    shadowTint: NIGHT_SHADOW,
    parallax: 0.35,
  },
  {
    // The logo again, centred, before it becomes a chain.
    form: 'pair',
    anchor: '[data-anchor="mark"]',
    rotation: [0, 0, 0],
    round: 0,
    ink: 'blue',
    day: 0,
    shadow: 0.2,
    shadowDepth: 0.5,
    shadowTint: NIGHT_SHADOW,
    parallax: 0.6,
  },
  {
    form: 'chain',
    anchor: '[data-anchor="chain"]',
    rotation: [-32, 6, 13],
    round: 1,
    ink: 'porcelain',
    day: 0,
    shadow: 0.42,
    shadowDepth: 0.9,
    shadowTint: NIGHT_SHADOW,
    parallax: 0.25,
  },
  {
    // Daylight: the mark lying on paper under a low sun.
    form: 'pair',
    anchor: '[data-anchor="day"]',
    rotation: [0, 0, 0],
    round: 0,
    ink: 'blue',
    day: 1,
    shadow: 0.34,
    shadowDepth: 0.3,
    shadowTint: DAY_SHADOW,
    parallax: 0.15,
    stream: true,
  },
  {
    // The whole mark, one colour on the gold ground.
    form: 'pair',
    anchor: '[data-anchor="close"]',
    rotation: [0, 0, -8],
    round: 0,
    ink: 'blue',
    accent: 'blue',
    day: 0.85,
    shadow: 0.42,
    shadowDepth: 0.3,
    shadowTint: [0.42, 0.24, 0.0],
    parallax: 0.2,
  },
];

export const KF = { hero: 0, thesis: 1, mark: 2, chain: 3, day: 4, close: 5 } as const;
