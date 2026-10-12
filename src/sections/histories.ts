import { sha256Hex } from '../record/chain-hash';
import { clockAt, offsetOf, Replay, type Session } from '../record/session';

const fmt = new Intl.NumberFormat('en-US');
const KEYWORDS =
  /\b(def|return|for|in|if|and|or|not|assert|zip|range|len|abs|max|min|round|while|else|elif|True|False|None)\b/g;

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Minimal highlighting: strings and keywords, nothing else. */
function highlight(line: string): string {
  let out = '';
  let rest = line;
  const str = /("""[^]*?"""|"[^"]*"|'[^']*')/;
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

function duration(ms: number): string {
  const m = Math.round(ms / 60_000);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} m` : `${m} m`;
}

interface Pane {
  el: HTMLElement;
  code: HTMLElement;
  clock: HTMLElement;
  digest: HTMLElement;
  playhead: SVGLineElement;
  replay: Replay;
  session: Session;
  index: number;
}

/**
 * Same file, two histories: each pane rebuilds its file from its own events at the
 * scrubbed moment, the way a reviewer's replay does, and both end in the same bytes.
 */
export function mountHistories(
  root: HTMLElement,
  written: Session,
  pasted: Session,
): { update(progress: number): void } {
  const span = Math.max(written.duration, pasted.duration);
  const verdict = root.querySelector<HTMLElement>('[data-verdict]')!;
  const panes: Pane[] = [written, pasted].map((session, i) => {
    const el = root.querySelectorAll<HTMLElement>('[data-history]')[i]!;
    const track = el.querySelector<HTMLElement>('[data-track]')!;
    const pane: Pane = {
      el,
      code: el.querySelector('[data-code]')!,
      clock: el.querySelector('[data-clock]')!,
      digest: el.querySelector('[data-digest]')!,
      playhead: null as unknown as SVGLineElement,
      replay: new Replay(session),
      session,
      index: -2,
    };
    pane.playhead = drawTrack(track, session, span);
    return pane;
  });

  const awayMs = pasted.marks.away.to - pasted.marks.away.from;
  panes[1]!.el.querySelector('[data-count]')!.textContent =
    `Away ${duration(awayMs)}, then one paste.`;

  let finalDigest: string | null = null;
  void sha256Hex(panes[0]!.replay.textAfter(written.events.length - 1)).then(
    (d) => (finalDigest = d),
  );

  const heartbeats = pasted.events.filter((e) => e.kind === 'session.heartbeat').length;
  const verdictText = () =>
    `Same SHA-256. ${fmt.format(written.events.length)} events of work on one side. On the other, ${fmt.format(
      pasted.events.length,
    )}, and ${fmt.format(heartbeats)} of those are heartbeats from an editor nobody was using.`;

  let lastT = -1;
  return {
    update(progress: number) {
      // Hold the opening frame briefly, play the evening, then hold the end.
      const p = Math.min(1, Math.max(0, (progress - 0.05) / 0.82));
      // Start just after the file opens, so neither pane is ever blank.
      const t = Math.max(1500, p * span);
      if (Math.abs(t - lastT) < 1) return;
      lastT = t;
      let ended = 0;
      for (const pane of panes) {
        const index = pane.replay.indexAt(t);
        pane.clock.textContent = clockAt(Math.min(t, pane.session.duration));
        pane.playhead.setAttribute('x1', String(p * 1000));
        pane.playhead.setAttribute('x2', String(p * 1000));
        const atEnd = index >= pane.session.events.length - 1;
        if (atEnd) ended++;
        if (index !== pane.index) {
          pane.index = index;
          render(pane, index);
        }
        const paste = pane.session.marks.paste;
        const flash =
          paste && t >= paste.at ? Math.max(0, 0.22 * (1 - (t - paste.at) / 150_000)) : 0;
        pane.code.style.setProperty('--flash', flash.toFixed(3));
        if (atEnd && finalDigest) {
          pane.digest.textContent = `sha-256 ${finalDigest.slice(0, 10)}…${finalDigest.slice(-4)}`;
        } else {
          pane.digest.textContent = '';
        }
        pane.digest.classList.toggle('is-match', atEnd && Boolean(finalDigest));
      }
      verdict.textContent = ended === panes.length && finalDigest ? verdictText() : '';
    },
  };
}

function render(pane: Pane, index: number): void {
  const events = pane.session.events;
  const text = pane.replay.textAfter(index);

  // Focus: is the editor in the background at this moment?
  let focused = true;
  let caret = -1;
  let pasted = false;
  for (let i = index; i >= 0; i--) {
    const e = events[i]!;
    if (e.kind === 'focus.change') {
      focused = Boolean(e.data.focused);
      break;
    }
  }
  for (let i = index; i >= 0 && i > index - 400; i--) {
    const e = events[i]!;
    if (e.kind === 'doc.change') {
      const [l0, c0] = e.data.range as number[];
      const before = pane.replay.textAfter(i - 1);
      caret = offsetOf(before, l0!, c0!) + String(e.data.text ?? '').length;
      break;
    }
    if (e.kind === 'paste') {
      pasted = true;
      break;
    }
  }
  pane.el.classList.toggle('is-away', !focused);

  const withCaret =
    caret >= 0 && caret <= text.length ? text.slice(0, caret) + '\u0000' + text.slice(caret) : text;
  const lines = withCaret.split('\n');
  if (lines.at(-1) === '') lines.pop();
  pane.code.innerHTML = lines
    .map(
      (line, n) =>
        `<span class="ln${pasted ? ' pasted' : ''}" data-n="${n + 1}">${highlight(line).replace(
          '\u0000',
          '<span class="caret"></span>',
        )}</span>`,
    )
    .join('');
}

/** Event density along the session, with a playhead. */
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
