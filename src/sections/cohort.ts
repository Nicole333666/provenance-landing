import { prng } from '../record/session';

const STUDENTS = 2800;

/**
 * The cohort, one mark per student. The marks light up in a scattered order as
 * the section arrives, and the count climbs with them.
 */
export function mountCohort(
  host: HTMLElement,
  counter: HTMLElement | null,
  opts: { reduced: boolean },
): () => void {
  const canvas = host.querySelector('canvas')!;
  const ctx = canvas.getContext('2d')!;
  const rand = prng(2800);
  // A scattered lighting order, fixed for every visit.
  const order = Array.from({ length: STUDENTS }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const rank = new Int32Array(STUDENTS);
  order.forEach((cell, r) => (rank[cell] = r));

  let progress = opts.reduced ? 1 : 0;
  let cols = 0;
  let rows = 0;
  let cell = 0;
  let mark = 0;
  let dpr = 1;

  const layout = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    // Fit 2,800 square cells into the box.
    cell = Math.sqrt((w * h) / STUDENTS);
    cols = Math.ceil(w / cell);
    rows = Math.ceil(STUDENTS / cols);
    cell = Math.min(w / cols, h / rows);
    mark = Math.max(1.5, cell * 0.42);
    paint();
  };

  const paint = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const lit = Math.round(progress * STUDENTS);
    const r = Math.min(mark / 2, 1.6);
    for (let i = 0; i < STUDENTS; i++) {
      const x = (i % cols) * cell + (cell - mark) / 2;
      const y = Math.floor(i / cols) * cell + (cell - mark) / 2;
      const on = rank[i]! < lit;
      // The newest marks are briefly warm, then settle to porcelain.
      const age = lit - rank[i]!;
      if (on && age < 90 && progress < 1) ctx.fillStyle = 'rgb(249 115 22 / .9)';
      else ctx.fillStyle = on ? 'rgb(244 241 236 / .62)' : 'rgb(244 241 236 / .07)';
      ctx.beginPath();
      ctx.roundRect(x, y, mark, mark, r);
      ctx.fill();
    }
    if (counter) {
      counter.textContent = progress >= 1 ? '2,800+' : new Intl.NumberFormat('en-US').format(lit);
    }
  };

  let raf = 0;
  const play = () => {
    const t0 = performance.now();
    const dur = 2000;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      progress = 1 - Math.pow(1 - t, 2.4);
      paint();
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };

  layout();
  const ro = new ResizeObserver(layout);
  ro.observe(host);
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        if (!opts.reduced) play();
      }
    },
    { threshold: 0.45 },
  );
  io.observe(host);
  return () => {
    ro.disconnect();
    io.disconnect();
    cancelAnimationFrame(raf);
  };
}
