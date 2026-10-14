import { clockAt, type Session } from '../record/session';

/**
 * The first history as a teacher would read it: typing as a field of hairlines,
 * test runs as ticks, and the moments worth a conversation called out.
 */
export function mountEvening(plot: HTMLElement, axis: HTMLElement, session: Session): () => void {
  const { events, marks, duration } = session;

  const draw = () => {
    const W = Math.max(300, plot.clientWidth);
    const H = Math.max(160, plot.clientHeight);
    const base = H - 1;
    const x = (t: number) => (t / duration) * W;
    const narrow = W < 640;

    const bins = Math.round(W / 4);
    const counts = new Array<number>(bins).fill(0);
    for (const e of events) {
      if (e.kind === 'doc.change')
        counts[Math.min(bins - 1, Math.floor((e.t / duration) * bins))]! += 1;
    }
    const max = Math.max(...counts, 1);
    let ink = '';
    counts.forEach((c, i) => {
      if (!c) return;
      const px = ((i + 0.5) / bins) * W;
      const h = 6 + Math.sqrt(c / max) * H * 0.5;
      ink += `<line x1="${px.toFixed(1)}" x2="${px.toFixed(1)}" y1="${base}" y2="${(base - h).toFixed(1)}" stroke="rgb(4 30 66 / .55)" stroke-width="1"/>`;
    });
    // The editor in use: a line while it has focus, nothing while it doesn't.
    let focused = true;
    let from = 0;
    let band = '';
    for (const e of events) {
      if (e.kind !== 'focus.change') continue;
      const on = Boolean(e.data.focused);
      if (focused && !on)
        band += `<line x1="${x(from).toFixed(1)}" x2="${x(e.t).toFixed(1)}" y1="${base}" y2="${base}" stroke="rgb(4 30 66 / .8)" stroke-width="2"/>`;
      if (!focused && on) from = e.t;
      focused = on;
    }
    band += `<line x1="${x(from).toFixed(1)}" x2="${W}" y1="${base}" y2="${base}" stroke="rgb(4 30 66 / .8)" stroke-width="2"/>`;
    ink = band + ink;
    // The stuck stretch, softly shaded.
    ink =
      `<rect x="${x(marks.stuck.from).toFixed(1)}" y="${(H * 0.22).toFixed(1)}" width="${(x(marks.stuck.to) - x(marks.stuck.from)).toFixed(1)}" height="${(base - H * 0.22).toFixed(1)}" fill="rgb(253 181 21 / .16)"/>` +
      ink;

    // Test runs: small ticks below the line of work.
    for (const e of events) {
      if (e.kind === 'terminal.command') {
        const px = x(e.t).toFixed(1);
        ink += `<line x1="${px}" x2="${px}" y1="${base - 3}" y2="${base + 6}" stroke="rgb(4 30 66 / .8)" stroke-width="1.25"/>`;
      }
    }

    const note = (t0: number, t1: number, y: number, label: string, accent = false) => {
      const a = x(t0);
      const b = x(t1);
      const cls = accent ? 'evening__note evening__note--accent' : 'evening__note';
      const color = accent ? '#002676' : 'rgb(4 30 66 / .7)';
      const span = Math.abs(b - a) > 2;
      return `<g class="evening__mark" data-at="${(t0 / duration).toFixed(3)}">
        ${span ? `<line x1="${a}" x2="${b}" y1="${y}" y2="${y}" stroke="${color}" stroke-width="1.25"/>` : ''}
        <line x1="${a}" x2="${a}" y1="${y - 4}" y2="${base}" stroke="${color}" stroke-width="1" stroke-dasharray="2 3"/>
        ${span ? `<line x1="${b}" x2="${b}" y1="${y - 4}" y2="${y + 4}" stroke="${color}" stroke-width="1"/>` : ''}
        <text class="${cls}" x="${a}" y="${y - 10}">${label}</text>
      </g>`;
    };

    const stuckMin = Math.round((marks.stuck.to - marks.stuck.from) / 60_000);
    const awayMin = Math.round((marks.away.to - marks.away.from) / 60_000);
    const notes =
      note(
        marks.stuck.from,
        marks.stuck.to,
        H * 0.2,
        narrow
          ? `stuck ${stuckMin} min`
          : `stuck on longest_flat: ${marks.stuck.runs} failing runs, ${stuckMin} min`,
        true,
      ) +
      note(
        marks.away.from,
        marks.away.to,
        H * 0.38,
        narrow ? `away ${awayMin} min` : `away ${awayMin} min, reading`,
      ) +
      note(
        marks.rewrite.at,
        marks.rewrite.at,
        H * 0.12,
        narrow ? 'rewrote it' : 'deleted it, wrote it again',
      ) +
      note(
        marks.pass.at,
        marks.pass.at,
        H * 0.3,
        `all tests pass, ${clockAt(marks.pass.at)}`,
        true,
      );

    plot.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
      <line x1="0" x2="${W}" y1="${base}" y2="${base}" stroke="rgb(4 30 66 / .25)"/>
      <g class="evening__ink">${ink}${notes}</g>
    </svg>`;

    // The last note sits at the right edge; anchor its label to the end.
    const last = plot.querySelectorAll<SVGTextElement>('.evening__note');
    const passLabel = last[last.length - 1];
    passLabel?.setAttribute('text-anchor', 'end');

    // Axis: start, whole hours, end (Berkeley time).
    const ticks: [number, string][] = [[0, clockAt(0)]];
    for (const hh of [21, 22, 23]) {
      const t = Date.UTC(2026, 8, 30, hh - 17, 0, 0) - session.start;
      if (t > duration * 0.06 && t < duration * 0.92) ticks.push([t, `${hh}:00`]);
    }
    ticks.push([duration, clockAt(duration)]);
    axis.innerHTML = ticks
      .map(([t, label], i) => {
        const align = i === 0 ? '0' : i === ticks.length - 1 ? '-100%' : '-50%';
        return `<span style="position:absolute;left:${((t / duration) * 100).toFixed(2)}%;transform:translateX(${align})">${label}</span>`;
      })
      .join('');
  };

  draw();
  let raf = 0;
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
  });
  ro.observe(plot);
  return () => {
    ro.disconnect();
    cancelAnimationFrame(raf);
  };
}
