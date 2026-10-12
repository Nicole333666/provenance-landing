import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { detect } from './capabilities';
import { chainSession, type ChainedEvent } from './record/chain-hash';
import { Playground } from './record/playground';
import { buildPastedSession, buildSession } from './record/session';
import { TamperControl } from './record/tamper-control';
import { Ticker } from './record/ticker';
import type { Stage } from './scene/stage';
import { createSceneState } from './scene/state';
import { mountEvening } from './sections/evening';
import { mountField } from './sections/field';
import { mountHistories } from './sections/histories';
import { signalPattern } from './sections/outline';
import { setupReveals } from './sections/reveal';
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
  const pattern = $<HTMLElement>('[data-pattern]');
  if (pattern) pattern.style.backgroundImage = signalPattern('#b83f06', '#dc520b');
  const field = $<HTMLElement>('[data-field]');
  if (field) disposers.push(mountField(field));
  const flag = $<HTMLElement>('[data-flag]');
  if (flag) disposers.push(demoteFlag(flag, reduced));
  const playground = new Playground(
    $<HTMLTextAreaElement>('[data-input]')!,
    $<HTMLOListElement>('[data-log]')!,
    $<HTMLElement>('[data-log-status]')!,
    $<HTMLButtonElement>('[data-replay]')!,
  );
  disposers.push(() => playground.dispose());

  // The record: an illustrative session, hash-chained in the browser.
  const session = buildSession();
  const histories = mountHistories($<HTMLElement>('.histories')!, session, buildPastedSession());
  const evening = $<HTMLElement>('[data-evening-plot]');
  if (evening)
    disposers.push(mountEvening(evening, $<HTMLElement>('[data-evening-axis]')!, session));

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
  const makeTamper = (stage: Stage | null) =>
    new TamperControl(
      $<HTMLElement>('[data-tamper]')!,
      $<HTMLButtonElement>(stage ? '[data-tamper-key]' : '[data-tamper-still]')!,
      $<HTMLButtonElement>('[data-reset]')!,
      stage,
      ticker,
      () => chain,
    );
  acts.onChange((snap) => {
    if (chain) ticker.show(snap.growth * (chain.length - 1));
    histories.update(snap.histories);
    tamper?.setPhase(snap.phase);
    tamper?.setAuto(snap.autoTamper);
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
          tamper = makeTamper(null);
          acts.update();
        }
      };
      stage.start();
      window.addEventListener('resize', () => {
        stage.resize();
        acts.update();
      });
      tamper = makeTamper(stage);
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
    tamper = makeTamper(null);
    disposers.push(() => tamper?.dispose());
    acts.update();
  }

  ScrollTrigger.refresh();
  window.addEventListener('pagehide', () => disposers.forEach((d) => d()), { once: true });
}

/** A paste flag that turns out to be the student's own code, demoted in place. */
function demoteFlag(el: HTMLElement, reduced: boolean): () => void {
  const level = el.querySelector<HTMLElement>('[data-flag-level]')!;
  const text = el.querySelector<HTMLElement>('[data-flag-text]')!;
  let timer = 0;
  const demote = () => {
    text.style.opacity = '0';
    timer = window.setTimeout(
      () => {
        level.textContent = 'info';
        text.textContent = 'Code moved within trails.py';
        text.style.opacity = '1';
        el.classList.add('is-moved');
      },
      reduced ? 0 : 280,
    );
  };
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        timer = window.setTimeout(demote, reduced ? 0 : 1100);
      }
    },
    { threshold: 1 },
  );
  io.observe(el);
  return () => {
    io.disconnect();
    clearTimeout(timer);
  };
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
