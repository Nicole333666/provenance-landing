/**
 * The editor that takes over the screen: it grows from its place in the layout to
 * fill the viewport, holds there while you use it, then settles back a little as
 * the page moves on. Its real box is animated (not a transform), so text stays
 * crisp while you type.
 */
export function mountTryit(section: HTMLElement): {
  update(progress: number): void;
  measure(): void;
} {
  const slot = section.querySelector<HTMLElement>('[data-slot]')!;
  const box = section.querySelector<HTMLElement>('[data-playground]')!;
  const copy = section.querySelector<HTMLElement>('.tryit__copy')!;
  const sticky = section.querySelector<HTMLElement>('.tryit__sticky')!;
  let rest = { x: 0, y: 0, w: 0, h: 0 };
  let full = rest;
  let settled = rest;
  let last = -1;

  const measure = () => {
    const s = sticky.getBoundingClientRect();
    const r = slot.getBoundingClientRect();
    rest = { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height };
    const navH =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 76;
    const pad = window.innerWidth < 640 ? 10 : 16;
    full = { x: pad, y: navH, w: s.width - pad * 2, h: s.height - navH - pad };
    const k = 0.88;
    settled = {
      x: full.x + (full.w * (1 - k)) / 2,
      y: full.y + (full.h * (1 - k)) / 2,
      w: full.w * k,
      h: full.h * k,
    };
    const p = last;
    last = -1;
    update(p < 0 ? 0 : p);
  };

  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const mix = (a: typeof rest, b: typeof rest, t: number) => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    w: a.w + (b.w - a.w) * t,
    h: a.h + (b.h - a.h) * t,
  });

  const animated = document.documentElement.classList.contains('motion');
  const update = (progress: number) => {
    if (!animated) return;
    if (Math.abs(progress - last) < 0.0005) return;
    last = progress;
    // 0 to 0.24: grow to fill. Hold. 0.78 to 0.94: settle back a little.
    const grow = ease(Math.min(1, Math.max(0, progress / 0.24)));
    const settle = ease(Math.min(1, Math.max(0, (progress - 0.78) / 0.16)));
    const r = settle > 0 ? mix(full, settled, settle) : mix(rest, full, grow);
    box.style.left = `${r.x.toFixed(1)}px`;
    box.style.top = `${r.y.toFixed(1)}px`;
    box.style.width = `${r.w.toFixed(1)}px`;
    box.style.height = `${r.h.toFixed(1)}px`;
    copy.style.opacity = String(1 - Math.min(1, grow * 1.6));
    section.classList.toggle('is-full', grow > 0.98 && settle < 0.02);
  };

  measure();
  return { update, measure };
}
