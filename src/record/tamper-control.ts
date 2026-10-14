import type { Stage } from '../scene/stage';
import { chainSlot, LINK_COUNT } from '../scene/slots';
import type { HowPhase } from '../timeline/acts';
import type { ChainedEvent } from './chain-hash';
import type { Ticker } from './ticker';
import { forge, tamper, verifyChain } from './verify';

const SLOTS = Array.from({ length: LINK_COUNT }, (_, i) => chainSlot(i));
const MIN_SLOT = Math.min(...SLOTS);
const MAX_SLOT = Math.max(...SLOTS);

/** The link the demo pulls: left of the signed checkpoint, so the checkpoint is downstream. */
const PULLED = SLOTS.indexOf(-2);
/** The signed checkpoint is the gold link. */
const CHECKPOINT_SLOT = chainSlot(1);

/** The event a chain slot stands for: slots run in time order along the chain. */
export function slotToEvent(slot: number, count: number): number {
  const t = (slot - MIN_SLOT) / (MAX_SLOT - MIN_SLOT);
  return Math.round(t * (count - 1));
}

/**
 * The chain chapter's demonstration, played by scroll. In the "tamper" phase one
 * event is rewritten and the real chain is re-verified: it breaks there, and every
 * event after it stops verifying. In the "cover" phase every hash after the edit is
 * recomputed, which repairs the chain until the signed checkpoint, whose signature
 * no longer matches. Works with or without the 3D (the ledger tells it either way).
 */
export class ChainDemo {
  private phase: HowPhase = 'chain';
  private broken = false;
  private covered = false;
  private token = 0;

  constructor(
    private readonly stage: Stage | null,
    private readonly ticker: Ticker,
    private readonly getChain: () => ChainedEvent[] | null,
  ) {}

  update(phase: HowPhase, pull: number, cover: number): void {
    const prev = this.phase;
    this.phase = phase;
    if (phase === 'chain') {
      if (this.broken) this.reset();
      return;
    }
    if (phase === 'tamper' && prev === 'cover' && this.covered) {
      // Scrolled back from the cover-up: show the plain break again.
      this.covered = false;
      this.stage?.setCover(0);
      void this.showBreak();
    }
    if (!this.broken) {
      if (pull >= 0.7) void this.break();
      else this.stage?.setPull(PULLED, pull / 0.7);
      return;
    }
    if (phase === 'tamper' && pull < 0.6) {
      this.reset();
      this.stage?.setPull(PULLED, pull / 0.7);
      return;
    }
    if (phase === 'cover') {
      this.stage?.setCover(cover);
      if (cover > 0.55 && !this.covered) {
        this.covered = true;
        void this.showCover();
      }
    }
  }

  private async break(): Promise<void> {
    this.broken = true;
    this.stage?.breakAt(PULLED);
    await this.showBreak();
  }

  private async showBreak(): Promise<void> {
    const chain = this.getChain();
    if (!chain) return;
    const token = ++this.token;
    const verdict = await verifyChain(tamper(chain, slotToEvent(chainSlot(PULLED), chain.length)));
    if (token === this.token && this.broken) this.ticker.showVerdict(verdict);
  }

  private async showCover(): Promise<void> {
    const chain = this.getChain();
    if (!chain) return;
    const token = ++this.token;
    const edited = slotToEvent(chainSlot(PULLED), chain.length);
    const checkpoint = slotToEvent(CHECKPOINT_SLOT, chain.length);
    const forged = await forge(chain, edited);
    if (token === this.token && this.covered)
      this.ticker.showForged(forged, edited, checkpoint, chain[checkpoint]!.hash);
  }

  private reset(): void {
    this.broken = false;
    this.covered = false;
    this.token++;
    this.stage?.repair();
    this.ticker.showVerdict(null);
  }
}
