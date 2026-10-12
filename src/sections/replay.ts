import { berkeleyClock, type Session } from '../record/session';

/**
 * The replay strip: the illustrative session as a reviewer sees it. Typing is a
 * field of fine hairlines (density per bin), time away from the editor is empty,
 * and the two moments a reviewer would ask about are marked.
 */
export function mountReplay(
  strip: HTMLElement,
  axis: HTMLElement | null,
  session: Session,
): () => void {
  const { events, marks } = session;
  const t0 = events[0]!.t;
  const t1 = events.at(-1)!.t;
  const span = t1 - t0;

  const draw = () => {
    const W = Math.max(280, strip.clientWidth);
    const H = Math.max(100, strip.clientHeight);
    const base = H - 1;
    const x = (t: number) => ((t - t0) / span) * W;

    const binMs = 40_000;
    const bins = new Array<number>(Math.ceil(span / binMs) + 1).fill(0);
    for (const e of events) if (e.kind === 'doc.change') bins[Math.floor((e.t - t0) / binMs)]! += 1;
    const max = Math.max(...bins);

    let lines = '';
    const step = W / bins.length;
    bins.forEach((n, i) => {
      if (!n) return;
      const h = Math.sqrt(n / max) * H * 0.62;
      const px = (i + 0.5) * step;
      lines += `<line class="replay__tick" style="--i:${i}" x1="${px.toFixed(1)}" x2="${px.toFixed(1)}" y1="${base}" y2="${(base - h).toFixed(1)}"/>`;
    });

    const paste = events[marks.paste.seq]!;
    const ext = events[marks.external.seq]!;
    const pass = events[marks.testPass.seq]!;
    const px = x(paste.t);
    const ex = x(ext.t);
    const tx = x(pass.t);
    const markH = H * 0.9;
    const narrow = W < 560;

    strip.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-hidden="true">
      <g class="replay__ticks">${lines}</g>
      <line class="replay__base" x1="0" x2="${W}" y1="${base}" y2="${base}"/>
      <rect class="replay__paste" x="${(px - 3).toFixed(1)}" y="${(base - markH).toFixed(1)}" width="6" height="${markH.toFixed(1)}"/>
      <text class="replay__label replay__label--accent" x="${(px - 12).toFixed(1)}" y="${(base - markH + 10).toFixed(1)}" text-anchor="end">paste, ${marks.paste.lines} lines</text>
      <line class="replay__ext" x1="${ex.toFixed(1)}" x2="${ex.toFixed(1)}" y1="${(base - markH * 0.72).toFixed(1)}" y2="${base}"/>
      <circle class="replay__ext-dot" cx="${ex.toFixed(1)}" cy="${(base - markH * 0.72).toFixed(1)}" r="4"/>
      <text class="replay__label" x="${(ex + 12).toFixed(1)}" y="${(base - markH * 0.72 + 4).toFixed(1)}">${narrow ? 'edited outside' : 'edited outside the editor'}</text>
      <line class="replay__ext" x1="${tx.toFixed(1)}" x2="${tx.toFixed(1)}" y1="${(base - markH * 0.4).toFixed(1)}" y2="${base}"/>
      ${narrow ? '' : `<text class="replay__label" x="${(tx - 8).toFixed(1)}" y="${(base - markH * 0.4 - 8).toFixed(1)}" text-anchor="end">tests pass, ${berkeleyClock(pass.wall).slice(0, 5)}</text>`}
    </svg>`;

    if (axis) {
      const startClock = berkeleyClock(events[0]!.wall);
      const endClock = berkeleyClock(events.at(-1)!.wall);
      const ticks: [number, string][] = [[0, startClock.slice(0, 5)]];
      const start = new Date(session.start).getTime();
      // Whole hours, Berkeley time.
      for (let hh = 21; hh <= 23; hh++) {
        // hh:00 in Berkeley (UTC-7) falls at (hh - 17):00 UTC on the session's UTC day.
        const atMs = Date.UTC(2026, 8, 30, hh - 17, 0, 0) - start;
        if (atMs > t0 + span * 0.06 && atMs < t1 - span * 0.08) ticks.push([atMs, `${hh}:00`]);
      }
      ticks.push([t1, endClock.slice(0, 5)]);
      axis.style.position = 'relative';
      axis.style.height = '1.6em';
      axis.innerHTML = ticks
        .map(([t, label], i) => {
          const left = ((t - t0) / span) * 100;
          const align = i === 0 ? '0' : i === ticks.length - 1 ? '-100%' : '-50%';
          return `<span style="position:absolute;left:${left.toFixed(2)}%;transform:translateX(${align})">${label}</span>`;
        })
        .join('');
    }
  };

  draw();
  let raf = 0;
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
  });
  ro.observe(strip);
  return () => {
    ro.disconnect();
    cancelAnimationFrame(raf);
  };
}
