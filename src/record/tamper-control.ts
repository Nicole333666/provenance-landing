import type { Stage } from '../scene/stage';
import { chainSlot, LINK_COUNT } from '../scene/slots';
import type { HowPhase } from '../timeline/acts';
import type { ChainedEvent } from './chain-hash';
import type { Ticker } from './ticker';
import { tamper, verifyChain } from './verify';

const SLOTS = Array.from({ length: LINK_COUNT }, (_, i) => chainSlot(i));
const MIN_SLOT = Math.min(...SLOTS);
const MAX_SLOT = Math.max(...SLOTS);

/** The link the demo pulls by itself: a little right of centre, always in view. */
const AUTO_LINK = SLOTS.indexOf(3);

/** The event a chain slot stands for: slots run in time order along the chain. */
export function slotToEvent(slot: number, count: number): number {
  const t = (slot - MIN_SLOT) / (MAX_SLOT - MIN_SLOT);
  return Math.round(t * (count - 1));
}

/**
 * The tamper demo. In the "tamper" phase it plays itself with scroll: one link is
 * pulled out and the real chain is edited and re-verified. In the "try" phase the
 * chain is whole again and the visitor can break it (drag, tap, or Enter).
 */
export class TamperControl {
  private phase: HowPhase = 'chain';
  private broken: 'auto' | 'user' | null = null;
  private down: { id: number; x: number; y: number; link: number | null } | null = null;
  private moved = false;
  private readonly abort = new AbortController();

  constructor(
    private readonly surface: HTMLElement,
    private readonly keyButton: HTMLButtonElement,
    private readonly resetButton: HTMLButtonElement,
    private readonly stage: Stage | null,
    private readonly ticker: Ticker,
    private readonly getChain: () => ChainedEvent[] | null,
  ) {
    const opts = { signal: this.abort.signal };
    surface.addEventListener('pointerdown', (e) => this.onDown(e), opts);
    surface.addEventListener('pointermove', (e) => this.onMove(e), opts);
    surface.addEventListener('pointerup', (e) => this.onUp(e), opts);
    surface.addEventListener('pointercancel', () => this.cancel(), opts);
    keyButton.addEventListener(
      'click',
      () => {
        if (this.broken) return;
        // Without the 3D there is no link to pull; tamper with an event mid-session.
        this.commit(this.stage ? this.stage.breakAt(this.stage.centreLink()) : 0, 'user');
      },
      opts,
    );
    resetButton.addEventListener('click', () => this.reset(), opts);
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape' && this.broken === 'user') this.reset();
      },
      opts,
    );
  }

  setPhase(phase: HowPhase): void {
    if (phase === this.phase) return;
    const prev = this.phase;
    this.phase = phase;
    const live = phase === 'try';
    this.surface.classList.toggle('is-live', live && Boolean(this.stage));
    if (this.stage) this.keyButton.tabIndex = live ? 0 : -1;
    if (!live) this.cancel();
    // The visitor gets a whole chain to break; the demo's break is repaired.
    if (live && this.broken === 'auto') this.reset();
    // Scrolling back above the demo leaves it ready to play again.
    if (phase === 'chain' && prev !== 'chain' && this.broken) this.reset();
    this.syncReset();
  }

  /** The self-playing demo, driven by scroll: 0 nothing, 1 fully pulled. */
  setAuto(k: number): void {
    if (this.phase !== 'tamper' || this.broken === 'user') return;
    if (k >= 0.7) {
      if (!this.broken) this.commit(this.stage ? this.stage.breakAt(AUTO_LINK) : 0, 'auto');
      return;
    }
    if (this.broken === 'auto') this.reset();
    this.stage?.setPull(AUTO_LINK, k / 0.7);
  }

  private syncReset(): void {
    this.resetButton.hidden = !(this.broken && this.phase === 'try');
  }

  private onDown(e: PointerEvent): void {
    if (this.phase !== 'try' || this.broken || !this.stage) return;
    const link = this.stage.pick(e.clientX, e.clientY);
    this.down = { id: e.pointerId, x: e.clientX, y: e.clientY, link };
    this.moved = false;
    if (link !== null && e.pointerType === 'mouse') {
      this.surface.setPointerCapture(e.pointerId);
      this.stage.beginDrag(link);
      this.surface.classList.add('is-dragging');
      e.preventDefault();
    }
  }

  private onMove(e: PointerEvent): void {
    if (this.phase !== 'try' || this.broken || !this.stage) return;
    if (!this.down) {
      if (e.pointerType === 'mouse') {
        this.surface.classList.toggle(
          'is-hovering',
          this.stage.pick(e.clientX, e.clientY) !== null,
        );
      }
      return;
    }
    if (e.pointerId !== this.down.id) return;
    const dx = e.clientX - this.down.x;
    const dy = e.clientY - this.down.y;
    if (Math.hypot(dx, dy) > 6) this.moved = true;
    if (this.down.link === null || e.pointerType !== 'mouse') return;
    if (this.stage.drag(dx, dy) > 0.5) {
      const slot = this.stage.endDrag(true);
      this.endPointer();
      if (slot !== null) this.commit(slot, 'user');
    }
  }

  private onUp(e: PointerEvent): void {
    if (!this.down || e.pointerId !== this.down.id || !this.stage) return;
    const { link } = this.down;
    const tap = !this.moved;
    if (e.pointerType === 'mouse') {
      if (link !== null) {
        const slot = this.stage.endDrag(tap);
        if (slot !== null) this.commit(slot, 'user');
      }
    } else if (tap && link !== null && !this.broken) {
      this.commit(this.stage.breakAt(link), 'user');
    }
    this.endPointer();
  }

  private cancel(): void {
    if (this.down) this.stage?.endDrag(false);
    this.endPointer();
  }

  private endPointer(): void {
    if (this.down && this.surface.hasPointerCapture(this.down.id)) {
      this.surface.releasePointerCapture(this.down.id);
    }
    this.down = null;
    this.surface.classList.remove('is-dragging');
  }

  private async commit(slot: number, by: 'auto' | 'user'): Promise<void> {
    const chain = this.getChain();
    this.broken = by;
    this.syncReset();
    this.surface.classList.remove('is-hovering');
    if (!chain) return;
    const verdict = await verifyChain(tamper(chain, slotToEvent(slot, chain.length)));
    if (this.broken === by) this.ticker.showVerdict(verdict);
  }

  private reset(): void {
    this.broken = null;
    this.syncReset();
    this.stage?.repair();
    this.ticker.showVerdict(null);
  }

  dispose(): void {
    this.abort.abort();
  }
}
