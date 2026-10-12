/**
 * A deterministic, illustrative recording session.
 *
 * The envelope (`seq`, `t`, `wall`, `kind`, `data`) and the event kinds follow the
 * recorder PRD (section 4.2). Payloads are short and only show fragments of code;
 * this is a picture of what a log looks like, not a real student's work.
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
  | 'terminal.command'
  | 'fs.external_change';

export interface SessionEvent {
  seq: number;
  /** ms since session start (monotonic) */
  t: number;
  /** ISO 8601 UTC */
  wall: string;
  kind: EventKind;
  data: Record<string, unknown>;
}

/** Notable moments, used by the replay strip. Indices are `seq` values. */
export interface SessionMarks {
  paste: { seq: number; lines: number };
  external: { seq: number };
  testPass: { seq: number };
}

export interface Session {
  events: SessionEvent[];
  marks: SessionMarks;
  /** wall-clock start, ms since epoch */
  start: number;
}

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

// 20:55:12 in Berkeley (PDT, UTC-7) on a Tuesday in the semester.
const SESSION_START = Date.UTC(2026, 8, 30, 3, 55, 12);

const FRAGMENTS = [
  'def accuracy(typed, source):',
  '    typed_words = split(typed)',
  '    source_words = split(source)',
  '    if not typed_words:',
  '        return 0.0',
  '    correct = 0',
  '    for a, b in zip(typed_words, source_words):',
  '        if a == b:',
  '            correct += 1',
  'def wpm(typed, elapsed):',
  '    assert elapsed > 0',
  '    return len(typed) / 5 * 60 / elapsed',
  'def autocorrect(typed_word, word_list, diff_function, limit):',
  '    if typed_word in word_list:',
  '        return typed_word',
  '    best = min(word_list, key=lambda w: diff_function(typed_word, w, limit))',
  '    # TODO: handle the tie-breaking rule',
  'def furry_fixes(typed, source, limit):',
  '    if limit < 0:',
  '        return 1',
];

const TESTS = ['01', '02', '03', '04', '05', '06', '07', '08'];

export function buildSession(seed = 61): Session {
  const rand = prng(seed);
  const events: SessionEvent[] = [];
  let t = 0;
  let line = 12;
  let fragment = 0;
  let focused = true;
  let lastHeartbeat = 0;
  const marks: Partial<SessionMarks> = {};

  const push = (kind: EventKind, data: Record<string, unknown>, dt: number) => {
    t += Math.max(1, Math.round(dt));
    // Heartbeats every 30 s of session time, as the recorder does.
    while (t - lastHeartbeat >= 30_000) {
      lastHeartbeat += 30_000;
      events.push({
        seq: events.length,
        t: lastHeartbeat,
        wall: new Date(SESSION_START + lastHeartbeat).toISOString(),
        kind: 'session.heartbeat',
        data: { focused, active_file: 'cats.py', idle_ms: Math.round(rand() * 4000) },
      });
    }
    events.push({
      seq: events.length,
      t,
      wall: new Date(SESSION_START + t).toISOString(),
      kind,
      data,
    });
    return events.length - 1;
  };

  push(
    'session.start',
    { assignment_id: 'cats', editor: 'vscode', extension_version: '1.4.0', os: 'darwin' },
    1,
  );
  push('doc.open', { path: 'cats.py', lines: 412, sha256: 'b1c9e0…' }, 900);
  push('doc.open', { path: 'utils.py', lines: 96, sha256: '4e07aa…' }, 1400);
  push('terminal.open', { terminal: 1, shell: 'zsh' }, 2200);

  // Typing bursts: characters arrive as small doc.change events.
  const typeLine = (text: string) => {
    let col = 4;
    let i = 0;
    while (i < text.length) {
      const n = 2 + Math.floor(rand() * 5);
      const chunk = text.slice(i, i + n);
      push(
        'doc.change',
        { path: 'cats.py', range: [line, col, line, col], text: chunk, source: 'typing' },
        90 + rand() * 340,
      );
      col += chunk.length;
      i += n;
    }
    // Occasional backspace and retype.
    if (rand() < 0.3) {
      push(
        'doc.change',
        { path: 'cats.py', range: [line, col - 3, line, col], text: '', source: 'typing' },
        400 + rand() * 900,
      );
      push(
        'doc.change',
        {
          path: 'cats.py',
          range: [line, col - 3, line, col - 3],
          text: text.slice(-3),
          source: 'typing',
        },
        300 + rand() * 600,
      );
    }
    line += 1;
  };

  let test = 0;
  const work = (until: number) => {
    while (t < until) {
      const burst = 2 + Math.floor(rand() * 3);
      for (let b = 0; b < burst; b++) {
        typeLine(FRAGMENTS[fragment % FRAGMENTS.length]!);
        fragment += 1;
      }
      push(
        'selection.change',
        { path: 'cats.py', range: [line, 0, line, 0], was_selection: false },
        800 + rand() * 2400,
      );
      push('doc.save', { path: 'cats.py', sha256: hex(rand, 6) + '…' }, 1200 + rand() * 1800);
      if (rand() < 0.55) {
        push(
          'terminal.command',
          { terminal: 1, command: `python3 ok -q ${TESTS[test % TESTS.length]}` },
          2500 + rand() * 4000,
        );
        test += rand() < 0.35 ? 1 : 0;
      }
      if (rand() < 0.22) {
        focused = false;
        push('focus.change', { focused: false }, 3000 + rand() * 9000);
        focused = true;
        push('focus.change', { focused: true }, 30_000 + rand() * 120_000);
      } else {
        // Reading and thinking between bursts.
        t += 12_000 + rand() * 60_000;
      }
    }
  };

  // 20:55 to about 22:43.
  work(Date.UTC(2026, 8, 30, 5, 43, 0) - SESSION_START);

  // One large paste, one change made outside the editor.
  push('focus.change', { focused: false }, 6000);
  focused = false;
  push('focus.change', { focused: true }, 95_000);
  focused = true;
  marks.paste = {
    seq: push(
      'paste',
      {
        path: 'cats.py',
        range: [line, 0, line, 0],
        length: 7310,
        lines: 212,
        sha256: hex(rand, 6) + '…',
      },
      2400,
    ),
    lines: 212,
  };
  line += 212;
  push('doc.save', { path: 'cats.py', sha256: hex(rand, 6) + '…' }, 4100);
  focused = false;
  push('focus.change', { focused: false }, 2200);
  marks.external = {
    seq: push(
      'fs.external_change',
      { path: 'utils.py', old_hash: '4e07aa…', new_hash: hex(rand, 6) + '…' },
      48_000,
    ),
  };
  focused = true;
  push('focus.change', { focused: true }, 30_000);

  // Back to work until the last test passes at 23:40.
  const passAt = Date.UTC(2026, 8, 30, 6, 40, 31) - SESSION_START;
  work(passAt - 70_000);
  push('doc.save', { path: 'cats.py', sha256: hex(rand, 6) + '…' }, 2000);
  marks.testPass = {
    seq: push(
      'terminal.command',
      { terminal: 1, command: 'python3 ok -q 08' },
      Math.max(1, passAt - t),
    ),
  };
  push('doc.close', { path: 'cats.py' }, 54_000);
  push('session.end', { reason: 'window_closed' }, 3000);

  return { events, marks: marks as SessionMarks, start: SESSION_START };
}

function hex(rand: () => number, bytes: number): string {
  let s = '';
  for (let i = 0; i < bytes; i++)
    s += Math.floor(rand() * 256)
      .toString(16)
      .padStart(2, '0');
  return s;
}

/** Wall time rendered in Berkeley local time (PDT during the semester), HH:MM:SS. */
export function berkeleyClock(wall: string): string {
  const d = new Date(new Date(wall).getTime() - 7 * 3600_000);
  return d.toISOString().slice(11, 19);
}
