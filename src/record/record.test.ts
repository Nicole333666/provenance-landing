import { describe, expect, it } from 'vitest';
import { buildSession, berkeleyClock, prng } from './session';
import { canonical, chainSession, GENESIS, hashEvent } from './chain-hash';
import { tamper, verifyChain } from './verify';

const fast = { yieldFn: async () => {} };

describe('session', () => {
  it('is deterministic for a seed', () => {
    expect(buildSession(61).events).toEqual(buildSession(61).events);
    expect(buildSession(61).events).not.toEqual(buildSession(62).events);
  });

  it('has monotonic seq and t, and starts and ends the session', () => {
    const { events } = buildSession();
    expect(events.length).toBeGreaterThan(1300);
    events.forEach((e, i) => {
      expect(e.seq).toBe(i);
      if (i > 0) expect(e.t).toBeGreaterThanOrEqual(events[i - 1]!.t);
    });
    expect(events[0]!.kind).toBe('session.start');
    expect(events.at(-1)!.kind).toBe('session.end');
  });

  it('marks the paste, the external change, and the 23:40 test run', () => {
    const { events, marks } = buildSession();
    expect(events[marks.paste.seq]!.kind).toBe('paste');
    expect(events[marks.paste.seq]!.data.lines).toBe(212);
    expect(events[marks.external.seq]!.kind).toBe('fs.external_change');
    expect(berkeleyClock(events[marks.testPass.seq]!.wall).slice(0, 5)).toBe('23:40');
  });

  it('prng stays in [0, 1)', () => {
    const r = prng(1);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('canonical', () => {
  it('sorts keys and drops whitespace', () => {
    expect(canonical({ b: 1, a: [true, null, 'x'], c: { z: 1, y: 2 } })).toBe(
      '{"a":[true,null,"x"],"b":1,"c":{"y":2,"z":1}}',
    );
  });
});

describe('hash chain', () => {
  it('links every event to the one before it', async () => {
    const events = buildSession().events.slice(0, 50);
    const chain = await chainSession(events, fast);
    expect(chain[0]!.prev_hash).toBe(GENESIS);
    for (let i = 1; i < chain.length; i++) expect(chain[i]!.prev_hash).toBe(chain[i - 1]!.hash);
    expect(chain[0]!.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is stable for the same input', async () => {
    const e = buildSession().events[0]!;
    expect(await hashEvent(e, GENESIS)).toBe(await hashEvent(e, GENESIS));
  });

  it('changing one payload changes every hash after it', async () => {
    const events = buildSession().events.slice(0, 40);
    const a = await chainSession(events, fast);
    const edited = events.map((e, i) => (i === 10 ? { ...e, data: { ...e.data, x: 1 } } : e));
    const b = await chainSession(edited, fast);
    for (let i = 0; i < 10; i++) expect(b[i]!.hash).toBe(a[i]!.hash);
    for (let i = 10; i < 40; i++) expect(b[i]!.hash).not.toBe(a[i]!.hash);
  });
});

describe('verify', () => {
  it('accepts an intact chain', async () => {
    const chain = await chainSession(buildSession().events.slice(0, 80), fast);
    expect(await verifyChain(chain)).toEqual({ ok: true, count: 80 });
  });

  it('finds the first broken event and counts the rest as unverified', async () => {
    const chain = await chainSession(buildSession().events.slice(0, 80), fast);
    const v = await verifyChain(tamper(chain, 33));
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.brokenAt).toBe(33);
      expect(v.downstream).toBe(80 - 33 - 1);
      expect(v.expected).toBe(chain[33]!.hash);
      expect(v.actual).not.toBe(v.expected);
    }
  });

  it('catches a forged hash that no longer links to its successor', async () => {
    const chain = await chainSession(buildSession().events.slice(0, 20), fast);
    const forged = chain.map((e, i) => (i === 5 ? { ...e, hash: 'f'.repeat(64) } : e));
    const v = await verifyChain(forged);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.brokenAt).toBe(5);
  });
});
