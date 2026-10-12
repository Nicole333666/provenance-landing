/**
 * The suite as a living diagram: wires from each tool to the next, drawn when the
 * map scrolls into view, with packets travelling along them (the record, moving).
 */
const EDGES: [string, string][] = [
  ['code', 'bundle'],
  ['jet', 'bundle'],
  ['nvim', 'bundle'],
  ['bundle', 'gate'],
  ['gate', 'server'],
  ['bundle', 'server'],
  ['server', 'lens'],
];

export function mountSuite(map: HTMLElement, opts: { reduced: boolean }): () => void {
  const svg = map.querySelector<SVGSVGElement>('[data-wires]')!;
  const node = (id: string) => map.querySelector<HTMLElement>(`[data-node="${id}"]`)!;

  const draw = () => {
    const box = map.getBoundingClientRect();
    const vertical = getComputedStyle(map).gridTemplateColumns.split(' ').length === 1;
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    let html = '';
    EDGES.forEach(([a, b], i) => {
      const ra = node(a).getBoundingClientRect();
      const rb = node(b).getBoundingClientRect();
      let d: string;
      // The direct bundle-to-server route (staff upload) is the dashed one.
      const direct = a === 'bundle' && b === 'server';
      if (vertical) {
        const x1 = ra.left - box.left + ra.width / 2 + (direct ? ra.width * 0.32 : 0);
        const y1 = ra.bottom - box.top;
        const x2 = rb.left - box.left + rb.width / 2 + (direct ? rb.width * 0.32 : 0);
        const y2 = rb.top - box.top;
        if (direct || b === 'bundle') {
          const xo = direct ? Math.max(x1, x2) + 28 : x1;
          d = direct
            ? `M${x1},${y1} C${xo},${y1 + 40} ${xo},${y2 - 40} ${x2},${y2}`
            : `M${x1},${y1} L${x2},${y2}`;
        } else d = `M${x1},${y1} L${x2},${y2}`;
        if (b === 'bundle' && a !== 'nvim') return;
      } else {
        const x1 = ra.right - box.left;
        const y1 = ra.top - box.top + ra.height / 2;
        const x2 = rb.left - box.left;
        const y2 = rb.top - box.top + rb.height / 2;
        if (a === 'bundle' && b === 'gate') {
          const xm = ra.left - box.left + ra.width / 2;
          d = `M${xm},${ra.bottom - box.top} L${xm},${rb.top - box.top}`;
        } else if (direct) {
          // Staff can also upload bundles straight to the server.
          const ya = y1 - ra.height * 0.18;
          const yb = rb.top - box.top + rb.height * 0.22;
          const mx = (x1 + x2) / 2;
          d = `M${x1},${ya} C${mx},${ya} ${mx},${yb} ${x2},${yb}`;
        } else {
          const mx = (x1 + x2) / 2;
          d = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
        }
      }
      const id = `wire-${i}`;
      html += `<path id="${id}" d="${d}" pathLength="1"${direct ? ' class="direct"' : ''}/>`;
      if (!opts.reduced && !direct) {
        const dur = 3.2 + (i % 3) * 0.7;
        html += `<circle class="packet" r="3"><animateMotion dur="${dur}s" begin="${(i * 0.45).toFixed(2)}s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear"><mpath href="#${id}"/></animateMotion></circle>`;
      }
    });
    svg.innerHTML = html;
  };

  draw();
  let raf = 0;
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
  });
  ro.observe(map);
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        map.classList.add('is-in');
        io.disconnect();
      }
    },
    { threshold: 0.3 },
  );
  io.observe(map);
  if (opts.reduced) map.classList.add('is-in');
  return () => {
    ro.disconnect();
    io.disconnect();
    cancelAnimationFrame(raf);
  };
}
