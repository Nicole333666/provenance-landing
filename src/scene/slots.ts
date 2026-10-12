/** Chain bookkeeping with no three.js dependency, so page code can use it eagerly. */

/** Total links in the scene: the woven pair plus the rest of the chain. */
export const LINK_COUNT = 44;

/**
 * Chain slot for each instance. The pair sits in the middle of the chain
 * (instances 0 and 1), and the remaining links fill outward alternately, so a
 * growing chain extends from the pair in both directions.
 */
export function chainSlot(i: number): number {
  if (i === 0) return 0;
  if (i === 1) return 1;
  const k = i - 1; // 1, 2, 3, ...
  return k % 2 === 1 ? -(k + 1) / 2 : k / 2 + 1;
}
