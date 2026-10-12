import type { SessionEvent } from './session';

export interface ChainedEvent extends SessionEvent {
  prev_hash: string;
  hash: string;
}

export const GENESIS = '0'.repeat(64);

/** Sorted-key, whitespace-free JSON. Mirrors the shape of JCS for plain data. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(',')}}`;
}

const encoder = new TextEncoder();

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i]!.toString(16).padStart(2, '0');
  return out;
}

/** hash = sha256(prev_hash || canonical(entry without hash)) */
export function hashInput(event: SessionEvent, prevHash: string): string {
  const { seq, t, wall, kind, data } = event;
  return prevHash + canonical({ seq, t, wall, kind, data, prev_hash: prevHash });
}

export async function hashEvent(event: SessionEvent, prevHash: string): Promise<string> {
  return sha256Hex(hashInput(event, prevHash));
}

/**
 * Chains a session. Yields to the event loop between batches so a long chain
 * never blocks a frame.
 */
export async function chainSession(
  events: readonly SessionEvent[],
  opts: { batch?: number; yieldFn?: () => Promise<void> } = {},
): Promise<ChainedEvent[]> {
  const batch = opts.batch ?? 64;
  const yieldFn = opts.yieldFn ?? (() => new Promise<void>((r) => setTimeout(r, 0)));
  const out: ChainedEvent[] = [];
  let prev = GENESIS;
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    const hash = await hashEvent(e, prev);
    out.push({ ...e, prev_hash: prev, hash });
    prev = hash;
    if ((i + 1) % batch === 0) await yieldFn();
  }
  return out;
}
