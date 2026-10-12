/**
 * Illustrative recording sessions for a fictional assignment, `trails.py`.
 *
 * The envelope (`seq`, `t`, `wall`, `kind`, `data`) and the event kinds follow the
 * recorder PRD (section 4.2). Two histories end in the same file, byte for byte:
 * an evening of real work, and a long tab-away followed by one paste. Nothing here
 * is a real student's work or a real course's solution.
 */

export type EventKind =
  | 'session.start'
  | 'session.heartbeat'
  | 'session.end'
  | 'doc.open'
  | 'doc.change'
  | 'doc.save'
  | 'doc.close'
  | 'paste'
  | 'selection.change'
  | 'focus.change'
  | 'terminal.open'
  | 'terminal.command';

export interface SessionEvent {
  seq: number;
  /** ms since session start (monotonic) */
  t: number;
  /** ISO 8601 UTC */
  wall: string;
  kind: EventKind;
  data: Record<string, unknown>;
}

/** Moments a reviewer (or a teacher) would look at. Times are ms since start. */
export interface SessionMarks {
  /** a long stretch of failing test runs on one function */
  stuck: { from: number; to: number; runs: number };
  /** the body of a function deleted and written again */
  rewrite: { at: number; fn: string };
  /** the longest time the editor was in the background */
  away: { from: number; to: number };
  /** the run where every test passed */
  pass: { at: number; seq: number };
  /** the single paste, when there is one */
  paste?: { at: number; seq: number; lines: number };
}

export interface Session {
  events: SessionEvent[];
  marks: SessionMarks;
  /** wall-clock start, ms since epoch */
  start: number;
  /** ms since start of the last event */
  duration: number;
}

export const FILE = 'trails.py';

const STARTER = `"""Trails: summaries of a day's hike."""


def total_climb(elevations):
    """Sum of every uphill step, in metres."""


def longest_flat(elevations, tolerance):
    """Length of the longest run that stays within tolerance."""


def pace(distance_km, minutes):
    """Minutes per kilometre, rounded to one decimal."""
`;

const BODIES = {
  total_climb: `    climb = 0
    for before, after in zip(elevations, elevations[1:]):
        if after > before:
            climb += after - before
    return climb
`,
  longest_flat: `    best, start = 0, 0
    for i in range(1, len(elevations) + 1):
        if i == len(elevations) or abs(elevations[i] - elevations[start]) > tolerance:
            best = max(best, i - start)
            start = i
    return best
`,
  pace: `    assert distance_km > 0, "distance must be positive"
    return round(minutes / distance_km, 1)
`,
} as const;

/** The first, wrong attempt at longest_flat, later deleted and rewritten. */
const FIRST_ATTEMPT = `    run = 0
    for a, b in zip(elevations, elevations[1:]):
        if abs(b - a) <= tolerance:
            run += 1
    return run
`;

const DOCSTRINGS = {
  total_climb: '    """Sum of every uphill step, in metres."""\n',
  longest_flat: '    """Length of the longest run that stays within tolerance."""\n',
  pace: '    """Minutes per kilometre, rounded to one decimal."""\n',
} as const;

/** The finished file both histories arrive at. */
export const FINAL = (Object.keys(BODIES) as (keyof typeof BODIES)[]).reduce(
  (text, fn) => text.replace(DOCSTRINGS[fn], DOCSTRINGS[fn] + BODIES[fn]),
  STARTER,
);

export const STARTER_TEXT = STARTER;

// 20:55:12 in Berkeley (PDT, UTC-7) on a Tuesday in the semester.
export const SESSION_START = Date.UTC(2026, 8, 30, 3, 55, 12);

/** mulberry32: small, fast, deterministic. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A Berkeley time of day (on the session's evening) as ms since session start. */
const at = (hh: number, mm: number, ss = 0) =>
  Date.UTC(2026, 8, 30, hh - 17, mm, ss) - SESSION_START;

/** Line/column of a character offset. */
export function lineCol(text: string, offset: number): [number, number] {
  let line = 0;
  let last = -1;
  for (let i = 0; i < offset; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      last = i;
    }
  }
  return [line, offset - last - 1];
}

/** Character offset of a line/column. */
export function offsetOf(text: string, line: number, col: number): number {
  let l = 0;
  let i = 0;
  while (l < line && i < text.length) {
    if (text.charCodeAt(i) === 10) l++;
    i++;
  }
  return i + col;
}

class Recorder {
  readonly events: SessionEvent[] = [];
  doc = '';
  t = 0;
  focused = true;
  private lastHeartbeat = 0;

  constructor(private readonly rand: () => number) {}

  push(kind: EventKind, data: Record<string, unknown>, dt = 0): number {
    this.t += Math.max(0, Math.round(dt));
    // Heartbeats every 30 s of session time, as the recorder does.
    while (this.t - this.lastHeartbeat >= 30_000) {
      this.lastHeartbeat += 30_000;
      this.events.push({
        seq: this.events.length,
        t: this.lastHeartbeat,
        wall: new Date(SESSION_START + this.lastHeartbeat).toISOString(),
        kind: 'session.heartbeat',
        data: { focused: this.focused, active_file: FILE, idle_ms: Math.round(this.rand() * 4000) },
      });
    }
    this.events.push({
      seq: this.events.length,
      t: this.t,
      wall: new Date(SESSION_START + this.t).toISOString(),
      kind,
      data,
    });
    return this.events.length - 1;
  }

  /** Lets session time pass until an offset; heartbeats fill the gap. */
  until(ms: number): void {
    if (ms <= this.t) return;
    const target = ms;
    while (this.t + 30_000 <= target) this.idle(30_000);
    this.t = target;
  }

  private idle(ms: number): void {
    this.t += ms;
    while (this.t - this.lastHeartbeat >= 30_000) {
      this.lastHeartbeat += 30_000;
      this.events.push({
        seq: this.events.length,
        t: this.lastHeartbeat,
        wall: new Date(SESSION_START + this.lastHeartbeat).toISOString(),
        kind: 'session.heartbeat',
        data: { focused: this.focused, active_file: FILE, idle_ms: Math.round(this.rand() * 4000) },
      });
    }
  }

  insert(offset: number, text: string, dt: number, source = 'typing'): void {
    const [l, c] = lineCol(this.doc, offset);
    this.doc = this.doc.slice(0, offset) + text + this.doc.slice(offset);
    this.push('doc.change', { path: FILE, range: [l, c, l, c], text, source }, dt);
  }

  remove(offset: number, length: number, dt: number): void {
    const [l0, c0] = lineCol(this.doc, offset);
    const [l1, c1] = lineCol(this.doc, offset + length);
    this.doc = this.doc.slice(0, offset) + this.doc.slice(offset + length);
    this.push(
      'doc.change',
      { path: FILE, range: [l0, c0, l1, c1], text: '', source: 'typing' },
      dt,
    );
  }

  focus(on: boolean, dt: number): void {
    this.focused = on;
    this.push('focus.change', { focused: on }, dt);
  }
}

const KEYS = 'qwertyuiopasdfghjklzxcvbnm';

/** Types text one keystroke at a time, with the occasional typo fixed by backspace. */
function type(r: Recorder, rand: () => number, offset: number, text: string, typo = 0.025): number {
  let o = offset;
  for (const ch of text) {
    const pause =
      ch === '\n' ? 500 + rand() * 1400 : ch === ' ' ? 120 + rand() * 260 : 70 + rand() * 190;
    if (/[a-z]/.test(ch) && rand() < typo) {
      r.insert(o, KEYS[Math.floor(rand() * KEYS.length)]!, pause);
      r.remove(o, 1, 260 + rand() * 420);
      r.insert(o, ch, 90 + rand() * 160);
    } else {
      r.insert(o, ch, pause);
    }
    o += ch.length;
  }
  return o;
}

function bodyOffset(doc: string, fn: keyof typeof DOCSTRINGS): number {
  const i = doc.indexOf(DOCSTRINGS[fn]);
  if (i < 0) throw new Error(`docstring for ${fn} not found`);
  return i + DOCSTRINGS[fn].length;
}

function opening(r: Recorder): void {
  r.push(
    'session.start',
    { assignment_id: 'trails', editor: 'vscode', extension_version: '1.4.0', os: 'darwin' },
    0,
  );
  r.doc = STARTER;
  r.push('doc.open', { path: FILE, lines: STARTER.split('\n').length - 1, content: STARTER }, 900);
  r.push('terminal.open', { terminal: 1, shell: 'zsh' }, 2200);
}

function test(r: Recorder, rand: () => number, dt: number, only?: string): number {
  r.push('doc.save', { path: FILE }, 600 + rand() * 900);
  return r.push(
    'terminal.command',
    { terminal: 1, command: only ? `pytest -q -k ${only}` : 'pytest -q' },
    dt,
  );
}

/** An evening of work: about 2 h 46 m, with a struggle and a rewrite in the middle. */
export function buildSession(seed = 61): Session {
  const rand = prng(seed);
  const r = new Recorder(rand);
  opening(r);

  // total_climb, from 20:57.
  r.until(at(20, 57, 40));
  let o = bodyOffset(r.doc, 'total_climb');
  type(r, rand, o, BODIES.total_climb);
  test(r, rand, 2600, 'climb');

  // longest_flat, first attempt: written, then stuck on failing tests.
  r.until(at(21, 31, 0));
  o = bodyOffset(r.doc, 'longest_flat');
  type(r, rand, o, FIRST_ATTEMPT);
  const stuckFrom = r.t;
  let runs = 0;
  const away = { from: 0, to: 0 };
  for (let k = 0; k < 6; k++) {
    test(r, rand, 2400, 'flat');
    runs++;
    // Read the failure, look something up, nudge the comparison.
    r.focus(false, 4000 + rand() * 6000);
    if (k === 2) away.from = r.t;
    r.focus(true, k === 2 ? 9 * 60_000 + rand() * 60_000 : 4 * 60_000 + rand() * 120_000);
    if (k === 2) away.to = r.t;
    const cmp = r.doc.indexOf(k % 2 ? '< ' : '<=', bodyOffset(r.doc, 'longest_flat'));
    if (cmp > 0) {
      r.remove(cmp, 2, 900);
      r.insert(cmp, k % 2 ? '<=' : '< ', 400);
    }
    const [sl, sc] = lineCol(r.doc, cmp > 0 ? cmp : o);
    r.push(
      'selection.change',
      { path: FILE, range: [sl, sc, sl, sc], was_selection: false },
      3000 + rand() * 9000,
    );
  }
  const stuckTo = r.t;

  // Delete the attempt and write it again, properly.
  r.until(at(22, 24, 30));
  const rewriteAt = r.t;
  o = bodyOffset(r.doc, 'longest_flat');
  const end = r.doc.indexOf('\n\n\ndef pace', o) + 1;
  r.push(
    'selection.change',
    { path: FILE, range: [...lineCol(r.doc, o), ...lineCol(r.doc, end)], was_selection: true },
    2000,
  );
  r.remove(o, end - o, 700);
  type(r, rand, o, BODIES.longest_flat);
  test(r, rand, 2600, 'flat');

  // pace, and a last look over everything.
  r.until(at(23, 2, 0));
  o = bodyOffset(r.doc, 'pace');
  type(r, rand, o, BODIES.pace);
  test(r, rand, 2400, 'pace');
  r.until(at(23, 38, 50));
  const passSeq = test(r, rand, Math.max(1, at(23, 40, 31) - r.t - 1200));
  const passAt = r.events[passSeq]!.t;
  r.push('doc.close', { path: FILE }, 54_000);
  r.push('session.end', { reason: 'window_closed' }, 3000);

  if (r.doc !== FINAL) throw new Error('written history does not reconstruct the final file');
  return {
    events: r.events,
    start: SESSION_START,
    duration: r.t,
    marks: {
      stuck: { from: stuckFrom, to: stuckTo, runs },
      rewrite: { at: rewriteAt, fn: 'longest_flat' },
      away,
      pass: { at: passAt, seq: passSeq },
    },
  };
}

/** The other history: the editor sits in the background, then one paste. */
export function buildPastedSession(seed = 62): Session {
  const rand = prng(seed);
  const r = new Recorder(rand);
  opening(r);
  r.focus(false, 64_000);
  const awayFrom = r.t;
  r.until(at(23, 28, 40));
  r.focus(true, 0);
  const awayTo = r.t;
  const lines = FINAL.split('\n').length - 1;
  const [l1, c1] = lineCol(r.doc, r.doc.length);
  // Select all, delete, paste.
  r.push('selection.change', { path: FILE, range: [0, 0, l1, c1], was_selection: true }, 2600);
  r.remove(0, r.doc.length, 900);
  r.doc = FINAL;
  const pasteSeq = r.push(
    'paste',
    { path: FILE, range: [0, 0, 0, 0], length: FINAL.length, lines, content: FINAL },
    1400,
  );
  const pasteAt = r.t;
  r.until(at(23, 38, 50));
  const passSeq = test(r, rand, Math.max(1, at(23, 40, 31) - r.t - 900));
  r.push('doc.close', { path: FILE }, 54_000);
  r.push('session.end', { reason: 'window_closed' }, 3000);
  return {
    events: r.events,
    start: SESSION_START,
    duration: r.t,
    marks: {
      stuck: { from: 0, to: 0, runs: 0 },
      rewrite: { at: 0, fn: '' },
      away: { from: awayFrom, to: awayTo },
      pass: { at: r.events[passSeq]!.t, seq: passSeq },
      paste: { at: pasteAt, seq: pasteSeq, lines },
    },
  };
}

/**
 * Rebuilds the file at any moment of a session from its events alone, the way a
 * reviewer's replay does. Snapshots keep scrubbing fast.
 */
export class Replay {
  private readonly snaps: { index: number; text: string }[] = [];
  private static readonly EVERY = 96;

  constructor(readonly session: Session) {
    let text = '';
    session.events.forEach((e, i) => {
      text = Replay.apply(text, e);
      if (i % Replay.EVERY === 0) this.snaps.push({ index: i, text });
    });
  }

  static apply(text: string, e: SessionEvent): string {
    if (e.kind === 'doc.open' && typeof e.data.content === 'string') return e.data.content;
    if (e.kind !== 'doc.change' && e.kind !== 'paste') return text;
    const [l0, c0, l1, c1] = e.data.range as [number, number, number, number];
    const insert = e.kind === 'paste' ? String(e.data.content ?? '') : String(e.data.text ?? '');
    const a = offsetOf(text, l0, c0);
    const b = offsetOf(text, l1, c1);
    return text.slice(0, a) + insert + text.slice(b);
  }

  /** Index of the last event at or before time t (ms since start), or -1. */
  indexAt(t: number): number {
    const ev = this.session.events;
    let lo = 0;
    let hi = ev.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (ev[mid]!.t <= t) {
        ans = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return ans;
  }

  /** File content after event `index`. */
  textAfter(index: number): string {
    if (index < 0) return '';
    let s = this.snaps[0]!;
    for (const snap of this.snaps) {
      if (snap.index <= index) s = snap;
      else break;
    }
    let text = s.text;
    for (let i = s.index + 1; i <= index; i++) text = Replay.apply(text, this.session.events[i]!);
    return text;
  }
}

/** Wall time rendered in Berkeley local time (PDT during the semester), HH:MM:SS. */
export function berkeleyClock(wall: string): string {
  const d = new Date(new Date(wall).getTime() - 7 * 3600_000);
  return d.toISOString().slice(11, 19);
}

/** Session offset (ms) as Berkeley clock time, HH:MM. */
export function clockAt(t: number): string {
  return berkeleyClock(new Date(SESSION_START + t).toISOString()).slice(0, 5);
}
