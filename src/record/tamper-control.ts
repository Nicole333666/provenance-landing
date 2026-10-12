import type { Stage } from '../scene/stage';
import { chainSlot, LINK_COUNT } from '../scene/poses';
import type { ChainedEvent } from './chain-hash';
import type { Ticker } from './ticker';
import { tamper, verifyChain } from './verify';

const SLOTS = Array.from({ length: LINK_COUNT }, (_, i) => chainSlot(i));
const MIN_SLOT = Math.min(...SLOTS);
const MAX_SLOT = Math.max(...SLOTS);

/** The event a chain slot stands for: slots run in time order along the chain. */
export function slotToEvent(slot: number, count: number): number {
  const t = (slot - MIN_SLOT) / (MAX_SLOT - MIN_SLOT);
  return Math.round(t * (count - 1));
}

/**
 * Pointer and keyboard control of the tamper demo. A drag past a threshold, a tap,
 * or Enter on the hidden button breaks the chain at that link; the real chain is
 * then edited and re-verified, and the ledger shows what the verifier found.
 */
export class TamperControl {
  private live = false;
  private broken = false;
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
        this.commit(this.stage ? this.stage.breakAt(this.stage.centreLink()) : 0);
      },
      opts,
    );
    resetButton.addEventListener('click', () => this.reset(), opts);
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape' && this.broken) this.reset();
      },
      opts,
    );
  }

  setLive(live: boolean): void {
    if (live === this.live) return;
    this.live = live;
    this.surface.classList.toggle('is-live', live);
    if (this.stage) this.keyButton.tabIndex = live ? 0 : -1;
    if (!live) this.cancel();
  }

  private onDown(e: PointerEvent): void {
    if (!this.live || this.broken || !this.stage) return;
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
    if (!this.live || this.broken || !this.stage) return;
    if (!this.down) {
      if (e.pointerType === 'mouse') {
        const hit = this.stage.pick(e.clientX, e.clientY) !== null;
        this.surface.classList.toggle('is-hovering', hit);
      }
      return;
    }
    if (e.pointerId !== this.down.id) return;
    const dx = e.clientX - this.down.x;
    const dy = e.clientY - this.down.y;
    if (Math.hypot(dx, dy) > 6) this.moved = true;
    if (this.down.link === null || e.pointerType !== 'mouse') return;
    const pulled = this.stage.drag(dx, dy);
    if (pulled > 0.5) {
      const slot = this.stage.endDrag(true);
      this.endPointer();
      if (slot !== null) this.commit(slot);
    }
  }

  private onUp(e: PointerEvent): void {
    if (!this.down || e.pointerId !== this.down.id || !this.stage) return;
    const { link } = this.down;
    const tap = !this.moved;
    if (e.pointerType === 'mouse') {
      if (link !== null) {
        const slot = this.stage.endDrag(tap);
        if (slot !== null) this.commit(slot);
      }
    } else if (tap && link !== null && !this.broken) {
      this.commit(this.stage.breakAt(link));
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

  private async commit(slot: number): Promise<void> {
    const chain = this.getChain();
    this.broken = true;
    this.resetButton.hidden = false;
    this.surface.classList.remove('is-hovering');
    if (!chain) return;
    const index = slotToEvent(slot, chain.length);
    const verdict = await verifyChain(tamper(chain, index));
    if (this.broken) this.ticker.showVerdict(verdict);
  }

  private reset(): void {
    this.broken = false;
    this.resetButton.hidden = true;
    this.stage?.repair();
    this.ticker.showVerdict(null);
  }

  dispose(): void {
    this.abort.abort();
  }
}
