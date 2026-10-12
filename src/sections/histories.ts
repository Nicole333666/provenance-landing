import { sha256Hex } from '../record/chain-hash';
import { clockAt, offsetOf, Replay, type Session, type SessionEvent } from '../record/session';

const fmt = new Intl.NumberFormat('en-US');
const KEYWORDS =
  /\b(def|return|for|in|if|and|or|not|assert|zip|range|len|abs|max|min|round|while|else|elif|True|False|None)\b/g;

/* ------------------------------------------------------------ the timeline */

/**
 * A replay timeline for two sessions at once. Wall-clock time would race through
 * an evening's typing in a few pixels of scroll, so instead every keystroke gets a
 * beat, idle stretches are compressed, and the moments worth seeing (a selection,
 * a paste, a test run) hold on screen. Both panes stay on the same wall clock.
 */
export interface Timeline {
  /** total replay units */
  total: number;
  /** wall time (ms since start) at a replay position */
  tAt(u: number): number;
}

/** How long the replay holds on an event, in units. */
function dwell(e: SessionEvent): number {
  if (e.kind === 'selection.change') return e.data.was_selection ? 14 : 1.5;
  if (e.kind === 'paste') return 22;
  if (e.kind === 'terminal.command') return 9;
  if (e.kind === 'doc.change' && !e.data.text) {
    const [l0, , l1] = e.data.range as number[];
    return l1! > l0! ? 10 : 0.6;
  }
  if (e.kind === 'focus.change') return 3;
  return 0;
}

/** How many units a gap of wall time takes: typing keeps its rhythm, idle shrinks. */
function gapUnits(ms: number): number {
  if (ms <= 0) return 0;
  if (ms < 1600) return Math.min(2.6, Math.max(0.42, ms / 170));
  return Math.min(18, 3 + 2.4 * Math.log2(1 + ms / 15_000));
}

const VISIBLE = new Set([
  'doc.change',
  'paste',
  'selection.change',
  'terminal.command',
  'focus.change',
  'doc.open',
]);

export function buildTimeline(sessions: Session[]): Timeline {
  const events = sessions
    .flatMap((s) => s.events)
    .filter((e) => VISIBLE.has(e.kind))
    .sort((a, b) => a.t - b.t);
  const us: number[] = [0];
  const ts: number[] = [0];
  let u = 0;
  let t = 0;
  for (const e of events) {
    u += gapUnits(e.t - t);
    t = e.t;
    us.push(u);
    ts.push(t);
    const d = dwell(e);
    if (d) {
      u += d;
      us.push(u);
      ts.push(t);
    }
  }
  const end = Math.max(...sessions.map((s) => s.duration));
  u += gapUnits(end - t);
  us.push(u);
  ts.push(end);

  return {
    total: u,
    tAt(x: number) {
      if (x <= 0) return 0;
      if (x >= u) return end;
      let lo = 0;
      let hi = us.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (us[mid]! <= x) lo = mid;
        else hi = mid;
      }
      const span = us[hi]! - us[lo]!;
      return span > 0 ? ts[lo]! + ((x - us[lo]!) / span) * (ts[hi]! - ts[lo]!) : ts[hi]!;
    },
  };
}

/* ------------------------------------------------------------- rendering */

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Minimal highlighting: strings and keywords, nothing else. */
function highlight(text: string): string {
  let out = '';
  let rest = text;
  const str = /("""[^]*?"""|"[^"\n]*"|'[^'\n]*')/;
  while (rest) {
    const m = str.exec(rest);
    if (!m) {
      out += escape(rest).replace(KEYWORDS, '<span class="kw">$1</span>');
      break;
    }
    out += escape(rest.slice(0, m.index)).replace(KEYWORDS, '<span class="kw">$1</span>');
    out += `<span class="str">${escape(m[0])}</span>`;
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

export interface View {
  text: string;
  caret: number | null;
  selection: [number, number] | null;
  focused: boolean;
  command: string | null;
  pasted: number | null;
}

/** What the replay shows after event `index`: text, caret, selection, focus, terminal. */
export function viewAt(replay: Replay, index: number): View {
  const events = replay.session.events;
  const text = replay.textAfter(index);
  const view: View = {
    text,
    caret: null,
    selection: null,
    focused: true,
    command: null,
    pasted: null,
  };
  if (index < 0) return view;
  const now = events[index]!.t;

  for (let i = index; i >= 0; i--) {
    const e = events[i]!;
    if (e.kind === 'focus.change') {
      view.focused = Boolean(e.data.focused);
      break;
    }
  }
  for (let i = index; i >= 0; i--) {
    const e = events[i]!;
    if (e.kind === 'terminal.command') {
      if (now - e.t < 45_000) view.command = String(e.data.command);
      break;
    }
    if (e.kind === 'doc.change' || e.kind === 'paste') break;
  }
  for (let i = index; i >= 0; i--) {
    const e = events[i]!;
    if (e.kind === 'selection.change') {
      const [l0, c0, l1, c1] = e.data.range as number[];
      const a = offsetOf(text, l0!, c0!);
      const b = offsetOf(text, l1!, c1!);
      if (e.data.was_selection && b > a) view.selection = [a, Math.min(b, text.length)];
      else view.caret = Math.min(a, text.length);
      break;
    }
    if (e.kind === 'doc.change') {
      const [l0, c0] = e.data.range as number[];
      const before = replay.textAfter(i - 1);
      view.caret = offsetOf(before, l0!, c0!) + String(e.data.text ?? '').length;
      break;
    }
    if (e.kind === 'paste') {
      view.caret = String(e.data.content ?? '').length;
      view.pasted = e.t;
      break;
    }
  }
  return view;
}

function renderCode(view: View): string {
  const { text } = view;
  const lines = text.split('\n');
  if (lines.length > 1 && lines.at(-1) === '') lines.pop();
  const sel = view.selection;
  let offset = 0;
  return lines
    .map((line, n) => {
      const start = offset;
      const end = start + line.length;
      offset = end + 1;
      // Cut the line at the selection edges and the caret; highlight each piece.
      const cuts = new Set<number>([start, end]);
      if (sel) {
        if (sel[0] > start && sel[0] < end) cuts.add(sel[0]);
        if (sel[1] > start && sel[1] < end) cuts.add(sel[1]);
      }
      if (view.caret !== null && view.caret >= start && view.caret <= end) cuts.add(view.caret);
      const points = [...cuts].sort((a, b) => a - b);
      let html = '';
      for (let i = 0; i < points.length; i++) {
        const p = points[i]!;
        if (view.caret === p) html += '<span class="caret"></span>';
        const q = points[i + 1];
        if (q === undefined) break;
        const piece = highlight(text.slice(p, q));
        html += sel && p >= sel[0] && q <= sel[1] ? `<span class="sel">${piece}</span>` : piece;
      }
      const whole = sel && start >= sel[0] && end < sel[1];
      return `<span class="ln${whole ? ' is-sel' : ''}" data-n="${n + 1}">${html}</span>`;
    })
    .join('');
}

/* ----------------------------------------------------------------- mount */

interface Pane {
  el: HTMLElement;
  code: HTMLElement;
  clock: HTMLElement;
  digest: HTMLElement;
  term: HTMLElement;
  playhead: SVGLineElement;
  replay: Replay;
  session: Session;
  key: string;
}

function duration(ms: number): string {
  const m = Math.round(ms / 60_000);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} m` : `${m} m`;
}

/**
 * Same file, two histories: each pane rebuilds its file from its own events, the
 * way a reviewer's replay does, keystroke by keystroke, and both end in the same
 * bytes. Scroll sets where the replay should be; the playhead chases it, so a fast
 * scroll types faster but never skips.
 */
export function mountHistories(
  root: HTMLElement,
  written: Session,
  pasted: Session,
  opts: { reduced: boolean },
): { update(progress: number): void; dispose(): void } {
  const sessions = [written, pasted];
  const timeline = buildTimeline(sessions);
  const span = Math.max(written.duration, pasted.duration);
  const verdict = root.querySelector<HTMLElement>('[data-verdict]')!;

  const panes: Pane[] = sessions.map((session, i) => {
    const el = root.querySelectorAll<HTMLElement>('[data-history]')[i]!;
    return {
      el,
      code: el.querySelector('[data-code]')!,
      clock: el.querySelector('[data-clock]')!,
      digest: el.querySelector('[data-digest]')!,
      term: el.querySelector('[data-term]')!,
      playhead: drawTrack(el.querySelector<HTMLElement>('[data-track]')!, session, span),
      replay: new Replay(session),
      session,
      key: '',
    };
  });

  const awayMs = pasted.marks.away.to - pasted.marks.away.from;
  panes[1]!.el.querySelector('[data-count]')!.textContent =
    `Away ${duration(awayMs)}, then select all, delete, paste.`;

  let finalDigest: string | null = null;
  const verdictText = () => 'Identical files. Completely different records.';

  let current = 0;
  const paint = (u: number) => {
    const t = Math.max(1500, timeline.tAt(u));
    let ended = 0;
    for (const pane of panes) {
      const index = pane.replay.indexAt(t);
      const atEnd = index >= pane.session.events.length - 1;
      if (atEnd) ended++;
      pane.clock.textContent = clockAt(Math.min(t, pane.session.duration));
      const x = String((t / span) * 1000);
      pane.playhead.setAttribute('x1', x);
      pane.playhead.setAttribute('x2', x);

      const view = viewAt(pane.replay, index);
      const flash = view.pasted !== null ? Math.max(0, 0.13 * (1 - (t - view.pasted) / 90_000)) : 0;
      const key = `${index}|${view.caret}|${view.selection}|${view.focused}|${view.command}|${flash.toFixed(2)}`;
      if (key !== pane.key) {
        pane.key = key;
        pane.el.classList.toggle('is-away', !view.focused);
        pane.code.innerHTML = renderCode(view);
        pane.code.style.setProperty('--flash', flash.toFixed(3));
        pane.code.classList.toggle('is-pasted', view.pasted !== null);
        pane.term.textContent = view.command ? `$ ${view.command}` : '';
        pane.term.classList.toggle('is-on', Boolean(view.command));
        follow(pane.code);
      }
      const done = atEnd && Boolean(finalDigest);
      pane.digest.textContent = done
        ? `sha-256 ${finalDigest!.slice(0, 10)}…${finalDigest!.slice(-4)}`
        : '';
      pane.digest.classList.toggle('is-match', done);
    }
    verdict.textContent = ended === panes.length && finalDigest ? verdictText() : '';
  };

  void sha256Hex(panes[0]!.replay.textAfter(written.events.length - 1)).then((d) => {
    finalDigest = d;
    paint(current);
  });

  // The replay plays itself at a watchable pace once the section is on screen, and
  // scrolling can only push it ahead: the target is whichever is further along.
  const AUTO_RATE = 34; // replay units per second, about 38 s for the whole evening
  let scrollTarget = 0;
  let auto = 0;
  let playing = false;
  let raf = 0;
  let last = 0;
  const step = (now: number) => {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    if (playing) auto = Math.min(timeline.total, auto + AUTO_RATE * dt);
    const target = Math.max(scrollTarget, auto);
    const diff = target - current;
    // Following the autoplay clock: exactly its pace. Chasing a scroll: faster.
    const speed = Math.max(AUTO_RATE, Math.abs(diff) * 3.4);
    current += Math.sign(diff) * Math.min(Math.abs(diff), speed * dt);
    paint(current);
    const busy = Math.abs(target - current) > 0.01 || (playing && auto < timeline.total);
    if (busy) raf = requestAnimationFrame(step);
    else {
      raf = 0;
      last = 0;
    }
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(step);
  };

  paint(0);
  return {
    update(progress: number) {
      // Scroll maps onto the replay, leaving the last stretch to hold the ending.
      const p = Math.min(1, Math.max(0, (progress - 0.02) / 0.8));
      scrollTarget = p * timeline.total;
      if (opts.reduced) {
        current = scrollTarget;
        paint(current);
        return;
      }
      if (progress <= 0) {
        // Above the section: rewind, ready to play again.
        playing = false;
        auto = 0;
      } else if (!playing) {
        playing = true;
        auto = Math.max(auto, current);
      }
      kick();
    },
    dispose() {
      cancelAnimationFrame(raf);
    },
  };
}

/** Keeps the caret (or the selection) in view, like an editor does. */
function follow(code: HTMLElement): void {
  const mark = code.querySelector<HTMLElement>('.caret, .sel');
  const line = mark?.closest<HTMLElement>('.ln');
  if (!line) return;
  const top = line.offsetTop;
  const view = code.clientHeight;
  if (top < code.scrollTop + view * 0.12 || top > code.scrollTop + view * 0.82) {
    code.scrollTop = Math.max(0, top - view * 0.45);
  }
}

/** Event density along the session, with a playhead (wall-clock axis). */
function drawTrack(host: HTMLElement, session: Session, span: number): SVGLineElement {
  const bins = 160;
  const counts = new Array<number>(bins).fill(0);
  for (const e of session.events) {
    if (e.kind === 'doc.change' || e.kind === 'paste') {
      counts[Math.min(bins - 1, Math.floor((e.t / span) * bins))]! += e.kind === 'paste' ? 1000 : 1;
    }
  }
  const max = Math.max(...counts.map((c) => Math.min(c, 60)), 1);
  let marks = '';
  counts.forEach((c, i) => {
    if (!c) return;
    const x = ((i + 0.5) / bins) * 1000;
    const isPaste = c >= 1000;
    const h = isPaste ? 34 : 4 + (Math.min(c, 60) / max) * 26;
    marks += `<line x1="${x}" x2="${x}" y1="${40 - h}" y2="40" stroke="${
      isPaste ? '#f97316' : 'rgb(244 241 236 / .45)'
    }" stroke-width="${isPaste ? 5 : 2}" vector-effect="non-scaling-stroke"/>`;
  });
  host.innerHTML = `<svg viewBox="0 0 1000 44" preserveAspectRatio="none" aria-hidden="true">
    <line x1="0" x2="1000" y1="40" y2="40" stroke="rgb(244 241 236 / .14)" vector-effect="non-scaling-stroke"/>
    ${marks}
    <line class="playhead" x1="0" x2="0" y1="2" y2="44" stroke="#f4f1ec" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
  </svg>`;
  return host.querySelector<SVGLineElement>('.playhead')!;
}
