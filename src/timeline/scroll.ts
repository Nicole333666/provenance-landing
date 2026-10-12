import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export interface Scroller {
  lenis: Lenis | null;
  /** Called on every scroll position change (smooth or native). */
  onScroll(fn: () => void): void;
  scrollTo(target: string | HTMLElement): void;
  /** Moves there instantly (no smooth travel). */
  jumpTo(target: HTMLElement | number): void;
  dispose(): void;
}

/**
 * One source of scroll truth. Lenis drives smooth scrolling when motion is
 * allowed; ScrollTrigger reads Lenis's position. With reduced motion we keep
 * native scrolling and still notify listeners.
 */
export function createScroller(smooth: boolean): Scroller {
  const listeners: (() => void)[] = [];
  const notify = () => {
    for (const fn of listeners) fn();
  };

  if (!smooth) {
    // ScrollTrigger already listens to native scroll; piggyback on its update cycle.
    ScrollTrigger.addEventListener('refresh', notify);
    const st = ScrollTrigger.create({ start: 0, end: 'max', onUpdate: notify });
    return {
      lenis: null,
      onScroll: (fn) => listeners.push(fn),
      scrollTo: (target) => {
        const el = typeof target === 'string' ? document.querySelector(target) : target;
        el?.scrollIntoView({ behavior: 'auto' });
      },
      jumpTo: (target) => {
        if (typeof target === 'number') window.scrollTo(0, target);
        else target.scrollIntoView({ behavior: 'auto' });
      },
      dispose: () => {
        st.kill();
        ScrollTrigger.removeEventListener('refresh', notify);
      },
    };
  }

  const lenis = new Lenis({
    duration: 1.15,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 0.92,
    touchMultiplier: 1.4,
  });
  lenis.on('scroll', () => {
    ScrollTrigger.update();
    notify();
  });
  const tick = (time: number) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  return {
    lenis,
    onScroll: (fn) => listeners.push(fn),
    scrollTo: (target) => lenis.scrollTo(target, { offset: 0, duration: 1.6 }),
    jumpTo: (target) => lenis.scrollTo(target, { immediate: true, force: true }),
    dispose: () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    },
  };
}
