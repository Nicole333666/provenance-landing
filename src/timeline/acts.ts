import type { SceneState } from '../scene/state';
import { KF } from '../scene/keyframes';

export interface ActsSnapshot {
  /** pinned "how" chapter progress, 0..1 */
  how: number;
  growth: number;
  tamperPhase: boolean;
  day: number;
}

type Listener = (snap: ActsSnapshot) => void;

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x: number) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};

/**
 * Maps the document's scroll position onto the story: where the object is
 * (state.s), how much chain exists, how light the ground is, which theme the nav
 * wears. Reads layout once per scroll update; never writes layout.
 */
export class Acts {
  private readonly el: {
    hero: HTMLElement;
    thesis: HTMLElement;
    how: HTMLElement;
    relight: HTMLElement;
    students: HTMLElement;
    close: HTMLElement;
    nav: HTMLElement;
    chainCopy: HTMLElement;
    tamperCopy: HTMLElement;
    beats: HTMLElement[];
  };
  private readonly root = document.documentElement;
  private readonly listeners: Listener[] = [];
  private navTheme = '';
  private phase = '';

  constructor(
    private readonly state: SceneState,
    private readonly opts: { reduced: boolean },
  ) {
    const q = <T extends HTMLElement>(s: string) => {
      const e = document.querySelector<T>(s);
      if (!e) throw new Error(`missing ${s}`);
      return e;
    };
    this.el = {
      hero: q('.hero'),
      thesis: q('.thesis'),
      how: q('.how'),
      relight: q('.relight'),
      students: q('.students'),
      close: q('.close'),
      nav: q('.nav'),
      chainCopy: q('.how__copy--chain'),
      tamperCopy: q('.how__copy--tamper'),
      beats: [...document.querySelectorAll<HTMLElement>('[data-beat]')],
    };
  }

  onChange(fn: Listener): void {
    this.listeners.push(fn);
  }

  update(): void {
    const vh = window.innerHeight;
    const r = (e: HTMLElement) => e.getBoundingClientRect();
    const { reduced } = this.opts;

    const thesis = r(this.el.thesis);
    const how = r(this.el.how);
    const relight = r(this.el.relight);
    const students = r(this.el.students);
    const close = r(this.el.close);
    const hero = r(this.el.hero);

    // Progress of an element's top edge travelling from viewport y=a to y=b.
    const travel = (top: number, a: number, b: number) => clamp((a - top) / (a - b));

    // On narrow screens the copy spans the full width, so the object must not
    // travel across it: cut from hero to thesis while both are off-screen.
    const narrow = window.innerWidth < 900;
    const p01 = narrow
      ? thesis.top < vh * 0.15
        ? 1
        : 0
      : travel(thesis.top, vh, vh / 2 - thesis.height / 2);
    const p12 = travel(how.top, vh * 0.9, 0);
    const howP = travel(how.top, 0, -(how.height - vh));
    const p23 = travel(relight.top, vh, -relight.height);
    const pastStudents = students.top + students.height / 2 < vh / 2;

    let s = KF.hero + smooth(p01) + smooth(p12) + p23 + (pastStudents ? 1 : 0);
    // Between thesis and chain the two segments add; keep them ordered.
    s = Math.min(s, pastStudents ? KF.close : KF.day);
    if (reduced) s = Math.round(s);
    this.state.s = s;

    const growth = reduced ? (howP > 0.02 ? 1 : 0) : clamp(howP / 0.42);
    this.state.growth = growth;

    // Ground.
    const day = reduced ? (p23 > 0.5 ? 1 : 0) : smooth((p23 - 0.12) / 0.6);
    this.root.style.setProperty('--day', day.toFixed(4));
    const signalTop = clamp(close.top, 0, vh);
    this.root.style.setProperty('--signal-top', `${signalTop.toFixed(1)}px`);
    this.root.classList.toggle('past-hero', hero.bottom < vh * 0.55);

    // Nav theme: whatever ground sits under it.
    const navTheme = close.top < 38 ? 'signal' : day > 0.5 ? 'day' : 'night';
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

    // The pinned chapter's two phases.
    const toTamper = reduced ? (howP > 0.5 ? 1 : 0) : smooth((howP - 0.46) / 0.08);
    this.el.chainCopy.style.opacity = String(1 - toTamper);
    this.el.chainCopy.style.transform = `translateY(${(-toTamper * 24).toFixed(1)}px)`;
    this.el.chainCopy.style.visibility = toTamper > 0.99 ? 'hidden' : 'visible';
    this.el.tamperCopy.style.opacity = String(toTamper);
    this.el.tamperCopy.style.transform = `translateY(${((1 - toTamper) * 24).toFixed(1)}px)`;
    this.el.tamperCopy.style.visibility = toTamper < 0.01 ? 'hidden' : 'visible';
    const phase = toTamper > 0.5 ? 'tamper' : 'chain';
    if (phase !== this.phase) this.phase = phase;

    this.el.beats.forEach((b, i) => b.classList.toggle('is-on', growth > 0.12 + i * 0.3));

    const snap: ActsSnapshot = { how: howP, growth, tamperPhase: phase === 'tamper', day };
    for (const fn of this.listeners) fn(snap);
  }
}
