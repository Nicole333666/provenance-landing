import './styles/base.css';
import './styles/frame.css';
import './styles/sections.css';
import './styles/motion.css';

import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { detect } from './capabilities';
import { chainSession, type ChainedEvent } from './record/chain-hash';
import { buildSession } from './record/session';
import { TamperControl } from './record/tamper-control';
import { Ticker } from './record/ticker';
import { createSceneState } from './scene/state';
import { mountEmboss, mountSystemLine, signalPattern } from './sections/outline';
import { mountReplay } from './sections/replay';
import { drawOnScroll, setupReveals } from './sections/reveal';
import { Acts } from './timeline/acts';
import { createScroller } from './timeline/scroll';

const $ = <T extends Element>(s: string) => document.querySelector<T>(s);
const root = document.documentElement;

async function boot(): Promise<void> {
  const caps = detect();
  const reduced = caps.reducedMotion;
  const disposers: (() => void)[] = [];

  const state = createSceneState(reduced);
  const scroller = createScroller(!reduced);
  disposers.push(() => scroller.dispose());
  const acts = new Acts(state, { reduced });

  // In-page links go through the scroller so smooth scrolling stays in charge.
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href')!;
      const target = id === '#top' ? document.body : $<HTMLElement>(id);
      if (!target) return;
      e.preventDefault();
      scroller.scrollTo(target);
      if (id !== '#top') history.replaceState(null, '', id);
    });
  });

  // 2D graphics.
  const emboss = $<HTMLElement>('.emboss');
  if (emboss) mountEmboss(emboss);
  const pattern = $<HTMLElement>('[data-pattern]');
  if (pattern) pattern.style.backgroundImage = signalPattern('#b83f06', '#dc520b');
  const line = $<HTMLElement>('[data-outline-chain]');
  if (line) {
    const stations = [...document.querySelectorAll<HTMLElement>('.station')];
    let undraw: (() => void) | null = null;
    const mountLine = () => {
      undraw?.();
      const svg = mountSystemLine(line, stations, 'rgb(24 24 27 / .62)', '#f1ece6');
      undraw = reduced ? null : drawOnScroll(svg, line);
    };
    mountLine();
    let t = 0;
    new ResizeObserver(() => {
      clearTimeout(t);
      t = window.setTimeout(mountLine, 120);
    }).observe(line);
    disposers.push(() => undraw?.());
  }

  // The record: an illustrative session, hash-chained in the browser.
  const session = buildSession();
  const strip = $<HTMLElement>('[data-replay-strip]');
  if (strip) disposers.push(mountReplay(strip, $<HTMLElement>('.replay__axis'), session));

  const ticker = new Ticker(
    $<HTMLOListElement>('[data-ticker]')!,
    $<HTMLElement>('#chain-status')!,
  );
  let chain: ChainedEvent[] | null = null;
  const idle = () =>
    new Promise<void>((r) =>
      'requestIdleCallback' in window
        ? requestIdleCallback(() => r(), { timeout: 60 })
        : setTimeout(r, 0),
    );
  // Hash the session when the reader is heading for the chain, or once the page is idle.
  let hashing = false;
  const startHashing = () => {
    if (hashing) return;
    hashing = true;
    void chainSession(session.events, { batch: 48, yieldFn: idle }).then((c) => {
      chain = c;
      ticker.setChain(c);
      acts.update();
    });
  };
  const near = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        near.disconnect();
        startHashing();
      }
    },
    { rootMargin: '150% 0px' },
  );
  near.observe($('.how')!);
  window.addEventListener('load', () => setTimeout(startHashing, 2500), { once: true });

  let tamper: TamperControl | null = null;
  acts.onChange((snap) => {
    if (chain) ticker.show(snap.growth * (chain.length - 1));
    tamper?.setLive(snap.tamperPhase);
  });

  scroller.onScroll(() => acts.update());
  window.addEventListener('resize', () => acts.update());
  acts.update();

  if (!reduced) disposers.push(setupReveals());

  // Pointer, for the object's slow parallax.
  if (!caps.coarse) {
    window.addEventListener(
      'pointermove',
      (e) => {
        state.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        state.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
      },
      { passive: true },
    );
  }

  // The 3D, loaded once the page has finished loading and the main thread is free.
  const canvas = $<HTMLCanvasElement>('.stage');
  if (caps.webgl && !caps.saveData && canvas) {
    await settled();
    try {
      const { Stage } = await import('./scene/stage');
      const stage = new Stage(canvas, state, { lowPower: caps.lowPower });
      disposers.push(() => stage.dispose());
      stage.onFirstFrame = () => root.classList.add('has-stage');
      stage.onPerf = (median) => {
        if (median > 44) {
          stage.dispose();
          root.classList.remove('has-stage');
          root.classList.add('no-stage');
          tamper?.dispose();
          tamper = new TamperControl(
            $<HTMLElement>('[data-tamper]')!,
            $<HTMLButtonElement>('[data-tamper-still]')!,
            $<HTMLButtonElement>('[data-reset]')!,
            null,
            ticker,
            () => chain,
          );
          acts.update();
        }
      };
      stage.start();
      window.addEventListener('resize', () => {
        stage.resize();
        acts.update();
      });
      tamper = new TamperControl(
        $<HTMLElement>('[data-tamper]')!,
        $<HTMLButtonElement>('[data-tamper-key]')!,
        $<HTMLButtonElement>('[data-reset]')!,
        stage,
        ticker,
        () => chain,
      );
      disposers.push(() => tamper?.dispose());
      acts.update();
    } catch (err) {
      console.warn('3D unavailable, using stills', err);
      root.classList.add('no-stage');
    }
  } else {
    root.classList.add('no-stage');
  }

  // Without the 3D, the demo still edits and re-verifies the real chain.
  if (!tamper) {
    tamper = new TamperControl(
      $<HTMLElement>('[data-tamper]')!,
      $<HTMLButtonElement>('[data-tamper-still]')!,
      $<HTMLButtonElement>('[data-reset]')!,
      null,
      ticker,
      () => chain,
    );
    disposers.push(() => tamper?.dispose());
    acts.update();
  }

  ScrollTrigger.refresh();
  window.addEventListener('pagehide', () => disposers.forEach((d) => d()), { once: true });
}

function settled(): Promise<void> {
  const loaded =
    document.readyState === 'complete'
      ? Promise.resolve()
      : new Promise<void>((r) => window.addEventListener('load', () => r(), { once: true }));
  return loaded.then(
    () =>
      new Promise<void>((r) =>
        'requestIdleCallback' in window
          ? requestIdleCallback(() => r(), { timeout: 500 })
          : setTimeout(r, 60),
      ),
  );
}

void boot();
