import { GENESIS, hashEvent, type ChainedEvent } from './chain-hash';

export type Verdict =
  | { ok: true; count: number }
  | {
      ok: false;
      count: number;
      /** index of the first event whose hash no longer matches */
      brokenAt: number;
      /** events after the break, which can no longer be traced back to the start */
      downstream: number;
      expected: string;
      actual: string;
    };

/**
 * Walks the chain from the start. The first event whose recomputed hash (or link to
 * its predecessor) does not match is the break; everything after it is unverified,
 * because it no longer connects to an intact chain.
 */
export async function verifyChain(events: readonly ChainedEvent[]): Promise<Verdict> {
  let prev = GENESIS;
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    const actual = await hashEvent(e, prev);
    if (e.prev_hash !== prev || actual !== e.hash) {
      return {
        ok: false,
        count: events.length,
        brokenAt: i,
        downstream: events.length - i - 1,
        expected: e.hash,
        actual,
      };
    }
    prev = e.hash;
  }
  return { ok: true, count: events.length };
}

/**
 * Returns a copy of the chain with one event's payload rewritten, the way a
 * hand-edit of the log file would: the stored hashes are left untouched.
 */
export function tamper(events: readonly ChainedEvent[], index: number): ChainedEvent[] {
  return events.map((e, i) =>
    i === index ? { ...e, data: { ...e.data, edited: true }, t: e.t + 1 } : e,
  );
}
