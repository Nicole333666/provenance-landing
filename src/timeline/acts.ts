import type { SceneState } from '../scene/state';
import { KF } from '../scene/keyframes';

export type HowPhase = 'chain' | 'tamper' | 'cover';

export interface ActsSnapshot {
  /** pinned chain chapter progress, 0..1 */
  how: number;
  growth: number;
  phase: HowPhase;
  /** the self-playing tamper: 0 nothing, 1 the link fully pulled */
  autoTamper: number;
  /** the cover-up: 0 nothing recomputed, 1 every hash after the edit recomputed */
  cover: number;
  /** try-it chapter progress, 0..1 */
  tryit: number;
  day: number;
}

type Listener = (snap: ActsSnapshot) => void;

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x: number) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};
/** 0 before a, 1 after b, eased between. */
const ramp = (x: number, a: number, b: number) => smooth((x - a) / (b - a));

/**
 * Maps the document's scroll position onto the story: where the object is
 * (state.s), how much chain exists, which chapter copy shows, how light the
 * ground is, which theme the nav wears. Reads layout; never writes layout.
 */
export class Acts {
  private readonly el: Record<
    | 'thesis'
    | 'histories'
    | 'how'
    | 'relight'
    | 'tryit'
    | 'close'
    | 'nav'
    | 'evening'
    | 'ledger',
    HTMLElement
  >;
  private readonly copies: Record<HowPhase, HTMLElement>;
  private readonly ground = document.querySelector<HTMLElement>('.ground');
  private readonly listeners: Listener[] = [];
  private navTheme = '';
  /** Last value written per element and property: scroll only writes what changed. */
  private readonly written = new WeakMap<HTMLElement, Map<string, string>>();

  constructor(
    private readonly state: SceneState,
    private readonly opts: { reduced: boolean },
  ) {
    const q = (s: string) => {
      const e = document.querySelector<HTMLElement>(s);
      if (!e) throw new Error(`missing ${s}`);
      return e;
    };
    this.el = {
      thesis: q('.thesis'),
      histories: q('.histories'),
      how: q('.how'),
      relight: q('.relight'),
      tryit: q('.tryit'),
      close: q('.close'),
      nav: q('.nav'),
      evening: q('.evening'),
      ledger: q('.ledger'),
    };
    this.copies = {
      chain: q('.how__copy[data-phase="chain"]'),
      tamper: q('.how__copy[data-phase="tamper"]'),
      cover: q('.how__copy[data-phase="cover"]'),
    };
  }

  onChange(fn: Listener): void {
    this.listeners.push(fn);
  }

  private set(el: HTMLElement, prop: string, value: string): void {
    let seen = this.written.get(el);
    if (!seen) this.written.set(el, (seen = new Map()));
    if (seen.get(prop) === value) return;
    seen.set(prop, value);
    el.style.setProperty(prop, value);
  }

  update(): void {
    const vh = window.innerHeight;
    const r = (e: HTMLElement) => e.getBoundingClientRect();
    const { reduced } = this.opts;
    const narrow = window.innerWidth < 900;

    const thesis = r(this.el.thesis);
    const histories = r(this.el.histories);
    const how = r(this.el.how);
    const relight = r(this.el.relight);
    const tryit = r(this.el.tryit);
    const close = r(this.el.close);

    // Progress of an element's top edge travelling from viewport y=a to y=b.
    const travel = (top: number, a: number, b: number) => clamp((a - top) / (a - b));

    // On narrow screens copy spans the full width, so the object must not travel
    // across it: cut from hero to thesis while both are off-screen.
    const p01 = narrow
      ? thesis.top < vh * 0.15
        ? 1
        : 0
      : smooth(travel(thesis.top, vh, vh / 2 - thesis.height / 2));
    const howP = travel(how.top, 0, -(how.height - vh));
    const p23 = travel(relight.top, vh, -relight.height);

    // Object: hero -> thesis, then a cut to the mark while the two histories are on
    // screen, the mark rounds into the chain, the relight, and a cut to the close.
    let s: number;
    // Narrow: the close-up leaves (off-screen) once the histories take the screen.
    if (narrow && how.top >= vh && histories.top < vh * 0.4) s = KF.mark;
    else if (how.top >= vh) s = KF.hero + p01;
    else if (p23 <= 0) s = KF.mark + ramp(howP, 0.05, 0.22);
    else if (tryit.top + tryit.height / 2 > vh / 2) s = KF.chain + p23;
    else s = KF.close;
    if (reduced) s = Math.round(s);
    this.state.s = s;

    const growth = reduced ? (howP > 0.1 ? 1 : 0) : ramp(howP, 0.12, 0.38);
    this.state.growth = growth;

    // Chapter copy inside the pinned chain chapter.
    const show = {
      chain: reduced
        ? howP < 0.44
          ? 1
          : 0
        : ramp(howP, -0.02, 0.02) * (1 - ramp(howP, 0.4, 0.45)),
      tamper: reduced
        ? howP >= 0.44 && howP < 0.72
          ? 1
          : 0
        : ramp(howP, 0.45, 0.5) * (1 - ramp(howP, 0.69, 0.73)),
      cover: reduced ? (howP >= 0.72 ? 1 : 0) : ramp(howP, 0.73, 0.77),
    };
    (Object.keys(show) as HowPhase[]).forEach((k) => {
      const v = show[k];
      const el = this.copies[k];
      this.set(el, 'opacity', v.toFixed(3));
      this.set(el, 'transform', `translateY(${((1 - v) * 18).toFixed(1)}px)`);
      this.set(el, 'visibility', v < 0.01 ? 'hidden' : 'visible');
    });
    const phase: HowPhase = howP >= 0.73 ? 'cover' : howP >= 0.45 ? 'tamper' : 'chain';
    this.set(this.el.ledger, '--ledger', ramp(howP, 0.14, 0.2).toFixed(3));
    const autoTamper = clamp((howP - 0.5) / 0.12);
    const cover = reduced ? (howP >= 0.8 ? 1 : 0) : clamp((howP - 0.77) / 0.15);

    // The annotated evening draws itself left to right as it scrolls up.
    const ev = r(this.el.evening);
    this.set(this.el.evening, '--reveal', reduced ? '1' : travel(ev.top, vh, vh * 0.62).toFixed(4));

    // Ground. Set on the ground itself, not the root: a custom property on the root
    // restyles the whole document on every scroll frame.
    const day = reduced ? (p23 > 0.5 ? 1 : 0) : smooth((p23 - 0.12) / 0.6);
    if (this.ground) {
      this.set(this.ground, '--day-pos', (-10 + 140 * day).toFixed(1));
      this.set(this.ground, '--signal-top', `${clamp(close.top, 0, vh).toFixed(0)}px`);
    }

    // Nav theme: whatever ground sits under it.
    const navTheme = close.top < 38 ? 'signal' : day > 0.28 ? 'day' : 'night';
    if (navTheme !== this.navTheme) {
      this.navTheme = navTheme;
      this.el.nav.dataset.theme = navTheme;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute(
          'content',
          navTheme === 'night' ? '#0c0806' : navTheme === 'day' ? '#f1ece6' : '#dc520b',
        );
    }

    const snap: ActsSnapshot = {
      how: howP,
      growth,
      phase,
      autoTamper,
      cover,
      tryit: travel(tryit.top, 0, -(tryit.height - vh)),
      day,
    };
    for (const fn of this.listeners) fn(snap);
  }
}
