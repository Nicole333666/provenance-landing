import type { ChainedEvent } from './chain-hash';
import { berkeleyClock } from './session';
import type { Verdict } from './verify';

const ROWS = 10;
const fmt = new Intl.NumberFormat('en-US');

/**
 * The ledger beside the chain: the last few events of the session, each with its
 * hash. Rows are reused; only text changes.
 */
export class Ticker {
  private readonly rows: HTMLLIElement[] = [];
  private chain: ChainedEvent[] = [];
  private index = -1;
  private verdict: Verdict | null = null;

  constructor(
    private readonly list: HTMLOListElement,
    private readonly status: HTMLElement,
  ) {
    for (let i = 0; i < ROWS; i++) {
      const li = document.createElement('li');
      li.innerHTML =
        '<span class="c"></span><span class="s"></span><span class="k"></span><span class="h"></span>';
      list.appendChild(li);
      this.rows.push(li);
    }
  }

  setChain(chain: ChainedEvent[]): void {
    this.chain = chain;
    this.status.textContent = `Chain verified. ${fmt.format(chain.length)} events, no breaks.`;
    const i = this.index;
    this.index = -1;
    this.show(Math.max(0, i));
  }

  get length(): number {
    return this.chain.length;
  }

  /** Show the chain up to and including event `index`. */
  show(index: number): void {
    if (!this.chain.length || this.verdict) return;
    const i = Math.max(0, Math.min(this.chain.length - 1, Math.round(index)));
    if (i === this.index) return;
    this.index = i;
    this.paint(i, null);
  }

  /** Show the result of a verification. */
  showVerdict(v: Verdict | null): void {
    this.verdict = v;
    if (!v) {
      this.status.classList.remove('is-broken');
      this.status.textContent = `Chain verified. ${fmt.format(this.chain.length)} events, no breaks.`;
      const i = this.index;
      this.index = -1;
      this.show(i);
      return;
    }
    if (v.ok) return;
    this.status.classList.add('is-broken');
    this.status.textContent = `Broken at event ${fmt.format(v.brokenAt)}. The ${fmt.format(
      v.downstream,
    )} events after it no longer verify.`;
    // Frame the break: a few verified rows, the broken one, then the unverified.
    this.paint(Math.min(this.chain.length - 1, v.brokenAt + 5), v);
  }

  private paint(last: number, v: Verdict | null): void {
    for (let r = 0; r < ROWS; r++) {
      const li = this.rows[r]!;
      const idx = last - (ROWS - 1 - r);
      const e = this.chain[idx];
      const [c, s, k, h] = li.children as unknown as HTMLSpanElement[];
      if (!e) {
        c!.textContent = s!.textContent = k!.textContent = h!.textContent = '';
        li.className = '';
        continue;
      }
      c!.textContent = berkeleyClock(e.wall);
      s!.textContent = String(e.seq).padStart(4, '0');
      k!.innerHTML = '';
      k!.append(e.kind);
      const snip = snippet(e);
      if (snip) {
        const d = document.createElement('i');
        d.textContent = snip;
        k!.append(d);
      }
      let cls = '';
      if (v && !v.ok) {
        if (idx === v.brokenAt) {
          h!.textContent = `${v.actual.slice(0, 8)} ≠ ${e.hash.slice(0, 8)}`;
          cls = 'is-broken';
        } else {
          h!.textContent = e.hash.slice(0, 12);
          if (idx > v.brokenAt) cls = 'is-unverified';
        }
      } else {
        h!.textContent = e.hash.slice(0, 12);
      }
      li.className = cls;
    }
  }
}

/** A few characters of payload, so the log reads like work being done. */
function snippet(e: ChainedEvent): string {
  const d = e.data as Record<string, unknown>;
  switch (e.kind) {
    case 'doc.change':
      return typeof d.text === 'string' && d.text ? ` +${JSON.stringify(d.text)}` : ' (delete)';
    case 'terminal.command':
      return ` ${String(d.command)}`;
    case 'paste':
      return ` ${String(d.lines)} lines`;
    case 'focus.change':
      return d.focused ? ' gained' : ' lost';
    case 'doc.save':
    case 'doc.open':
      return ` ${String(d.path)}`;
    case 'fs.external_change':
      return ` ${String(d.path)}`;
    default:
      return '';
  }
}
