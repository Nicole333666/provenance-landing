/**
 * The single hand-off point between the page (scroll, pointer, interaction) and
 * the 3D stage. The page writes; the stage reads once per frame.
 */
export interface SceneState {
  /** position along the keyframes, e.g. 1.4 = 40% from thesis to chain */
  s: number;
  /** chain reveal, 0..1 */
  growth: number;
  /** pointer in [-1, 1], y up */
  pointer: { x: number; y: number };
  /** true while the scene should render static frames only */
  reduced: boolean;
}

export function createSceneState(reduced: boolean): SceneState {
  return { s: 0, growth: 0, pointer: { x: 0, y: 0 }, reduced };
}
