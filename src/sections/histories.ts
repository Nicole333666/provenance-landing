import { sha256Hex } from '../record/chain-hash';
import { clockAt, Replay, type Session } from '../record/session';

const fmt = new Intl.NumberFormat('en-US');

/** How long the playhead takes to cross the evening, in ms. */
const SWEEP = 6500;

interface Note {
  /** where it sits on the shared clock, 0..1 (a span runs from `at` to `to`) */
  at: number;
  to?: number;
  label: string;
  /** the label on a phone */
  short: string;
  accent?: boolean;
}

interface Row {
  el: HTMLElement;
  track: HTMLElement;
  session: Session;
  notes: { el: HTMLElement; at: number }[];
  stats: { el: HTMLElement; one: string; many: string; times: number[] }[];
  shown: number[];
}

function duration(ms: number): string {
  const m = Math.round(ms / 60_000);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} m` : `${m} m`;
}

/** Number of entries in a sorted array at or before t. */
function countAt(times: number[], t: number): number {
  let lo = 0;
  let hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid]! <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Same file, two histories, as a reviewer sees them: two records on one wall clock.
 * One is an evening of edits and test runs; the other is a flat line, then a single
 * paste. A playhead crosses both once when the figure comes into view, the counts
 * climb behind it, and both end on the same SHA-256.
 */
export function mountHistories(
  root: HTMLElement,
  written: Session,
  pasted: Session,
  opts: { reduced: boolean },
): { dispose(): void } {
  const figure = root.querySelector<HTMLElement>('[data-records]')!;
  const clock = figure.querySelector<HTMLElement>('[data-clock]')!;
  const replay = figure.querySelector<HTMLButtonElement>('[data-replay]')!;
  const span = Math.max(written.duration, pasted.duration);
  const at = (t: number) => t / span;

  const { stuck, rewrite, pass } = written.marks;
  const away = pasted.marks.away;
  const paste = pasted.marks.paste!;
  const NOTES: Record<string, Note[]> = {
    written: [
      {
        at: at(stuck.from),
        to: at(stuck.to),
        label: `stuck: ${stuck.runs} failing runs`,
        short: 'stuck',
      },
      { at: at(rewrite.at), label: `rewrote ${rewrite.fn}`, short: 'rewrite' },
      {
        at: at(pass.at),
        label: `tests pass ${clockAt(pass.at)}`,
        short: `pass ${clockAt(pass.at)}`,
        accent: true,
      },
    ],
    pasted: [
      {
        at: at(away.from),
        to: at(away.to),
        label: `editor in the background, ${duration(away.to - away.from)}`,
        short: `away ${duration(away.to - away.from)}`,
      },
      {
        at: at(paste.at),
        label: `one paste, ${paste.lines} lines`,
        short: `paste, ${paste.lines} lines`,
        accent: true,
      },
    ],
  };

  const times = (s: Session, kind: string) =>
    s.events.filter((e) => e.kind === kind).map((e) => e.t);

  const rows: Row[] = [written, pasted].map((session, i) => {
    const el = figure.querySelectorAll<HTMLElement>('[data-record]')[i]!;
    const key = el.dataset.record!;
    const list = el.querySelector<HTMLElement>('[data-notes]')!;
    list.innerHTML = NOTES[key]!.map((n) => {
      const style =
        n.to === undefined
          ? `--x:${n.at.toFixed(4)}`
          : `--x:${n.at.toFixed(4)};--w:${(n.to - n.at).toFixed(4)}`;
      const cls = `note${n.to === undefined ? '' : ' note--span'}${n.accent ? ' note--accent' : ''}`;
      return `<li class="${cls}" style="${style}"><span><span class="note__long">${n.label}</span><span class="note__short">${n.short}</span></span></li>`;
    }).join('');
    const notes = [...list.children].map((li, k) => ({
      el: li as HTMLElement,
      at: NOTES[key]![k]!.at,
    }));
    const stats = [
      { kind: 'doc.change', one: 'edit', many: 'edits' },
      { kind: 'terminal.command', one: 'test run', many: 'test runs' },
      { kind: 'paste', one: 'paste', many: 'pastes' },
    ].map((s, k) => ({
      el: el.querySelectorAll<HTMLElement>('[data-stat]')[k]!,
      one: s.one,
      many: s.many,
      times: times(session, s.kind),
    }));
    return {
      el,
      track: el.querySelector<HTMLElement>('[data-track]')!,
      session,
      notes,
      stats,
      shown: stats.map(() => -1),
    };
  });

  // Axis: start, whole hours, end (Berkeley time).
  const axis = figure.querySelector<HTMLElement>('[data-axis]')!;
  const ticks: [number, string][] = [[0, clockAt(0)]];
  for (const hh of [21, 22, 23]) {
    const t = Date.UTC(2026, 8, 30, hh - 17, 0, 0) - written.start;
    if (t > span * 0.08 && t < span * 0.9) ticks.push([t, `${hh}:00`]);
  }
  ticks.push([span, clockAt(span)]);
  axis.innerHTML = ticks
    .map(([t, label]) => `<span style="--x:${at(t).toFixed(4)}">${label}</span>`)
    .join('');

  // Tracks are drawn at their real pixel width, so bars stay crisp at any size.
  let drawnWidth = 0;
  const draw = () => {
    const w = Math.round(rows[0]!.track.clientWidth);
    if (!w || w === drawnWidth) return;
    drawnWidth = w;
    for (const row of rows) row.track.innerHTML = drawTrack(row.session, span, w);
  };
  draw();
  const ro = new ResizeObserver(draw);
  ro.observe(rows[0]!.track);

  let digest = '';
  void sha256Hex(new Replay(written).textAfter(written.events.length - 1)).then((d) => {
    digest = `sha-256 ${d.slice(0, 8)}…${d.slice(-4)}`;
    figure.querySelectorAll('[data-digest]').forEach((e) => (e.textContent = digest));
  });

  let shownClock = '';
  const paint = (p: number) => {
    const t = p * span;
    figure.style.setProperty('--p', p.toFixed(4));
    const c = clockAt(t);
    if (c !== shownClock) clock.textContent = shownClock = c;
    for (const row of rows) {
      for (const n of row.notes) n.el.classList.toggle('is-on', p >= n.at);
      row.stats.forEach((s, k) => {
        const v = countAt(s.times, t);
        if (v === row.shown[k]) return;
        row.shown[k] = v;
        s.el.textContent = `${fmt.format(v)} ${v === 1 ? s.one : s.many}`;
      });
    }
    figure.classList.toggle('is-done', p >= 1);
  };

  let raf = 0;
  const play = () => {
    cancelAnimationFrame(raf);
    figure.classList.add('is-playing');
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / SWEEP);
      // Ease in and out a little at the ends; wall-clock steady in between.
      const p = k < 0.06 ? (k * k) / 0.12 : k > 0.94 ? 1 - ((1 - k) * (1 - k)) / 0.12 : k;
      paint(Math.min(1, p));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };

  let io: IntersectionObserver | null = null;
  if (opts.reduced) {
    paint(1);
  } else {
    paint(0);
    io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io?.disconnect();
          play();
        }
      },
      { rootMargin: '0px 0px -30% 0px' },
    );
    io.observe(figure);
  }
  replay.addEventListener('click', () => (opts.reduced ? paint(1) : play()));

  return {
    dispose() {
      io?.disconnect();
      ro.disconnect();
      cancelAnimationFrame(raf);
    },
  };
}

/**
 * One record on the shared clock: typing as hairlines, a solid baseline while the
 * editor has focus and a dotted one while it sits in the background, test runs as
 * ticks under the line, a paste as one tall orange bar.
 */
function drawTrack(session: Session, span: number, w: number): string {
  const H = 64;
  const base = 46;
  const x = (t: number) => ((t / span) * w).toFixed(1);
  const bins = Math.max(60, Math.round(w / 6));
  const counts = new Array<number>(bins).fill(0);
  for (const e of session.events) {
    if (e.kind === 'doc.change') counts[Math.min(bins - 1, Math.floor((e.t / span) * bins))]! += 1;
  }
  const max = Math.max(...counts, 1);
  let ink = '';
  counts.forEach((c, i) => {
    if (!c) return;
    const px = (((i + 0.5) / bins) * w).toFixed(1);
    const h = 9 + Math.sqrt(c / max) * (base - 13);
    ink += `<line x1="${px}" x2="${px}" y1="${base}" y2="${(base - h).toFixed(1)}" class="t-edit"/>`;
  });

  // The baseline: solid while focused, dotted while away.
  let focused = true;
  let from = 0;
  let line = '';
  const seg = (a: number, b: number, on: boolean) =>
    `<line x1="${x(a)}" x2="${x(b)}" y1="${base}" y2="${base}" class="${on ? 't-on' : 't-off'}"/>`;
  for (const e of session.events) {
    if (e.kind !== 'focus.change') continue;
    const on = Boolean(e.data.focused);
    if (on === focused) continue;
    line += seg(from, e.t, focused);
    from = e.t;
    focused = on;
  }
  line += seg(from, span, focused);

  for (const e of session.events) {
    if (e.kind === 'terminal.command')
      ink += `<line x1="${x(e.t)}" x2="${x(e.t)}" y1="${base + 5}" y2="${base + 12}" class="t-run"/>`;
    if (e.kind === 'paste')
      ink += `<rect x="${(+x(e.t) - 2).toFixed(1)}" y="4" width="4" height="${base - 4}" class="t-paste"/>`;
  }

  return `<svg viewBox="0 0 ${w} ${H}" width="${w}" height="${H}" aria-hidden="true">
    <line x1="0" x2="${w}" y1="${base}" y2="${base}" class="t-rest"/>
    <g class="t-ink">${line}${ink}</g>
  </svg>`;
}
