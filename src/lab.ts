// Dev-only harness: renders one keyframe in isolation. Used to tune the look and
// to render the still frames shown when WebGL is unavailable (scripts/stills.mjs).
import { KEYFRAMES } from './scene/keyframes';
import { Stage } from './scene/stage';
import { createSceneState } from './scene/state';

const q = new URLSearchParams(location.search);
const state = createSceneState(q.has('still'));
state.s = Number(q.get('s') ?? 0);
state.growth = Number(q.get('g') ?? 1);
if (state.s < 0.5 || (state.s >= 3.5 && state.s < 4.5)) document.body.classList.add('day');
if (state.s >= 4.5) document.body.classList.add('signal');
if (q.get('bg') === 'none') {
  document.documentElement.style.background = 'transparent';
  document.body.style.background = 'transparent';
}

// Optional: place the active keyframe's anchor explicitly (px), centred at cx, cy (0..1).
const ah = q.get('ah');
if (ah) {
  const k = KEYFRAMES[Math.round(state.s)]!;
  const el = document.querySelector<HTMLElement>(k.anchor)!;
  const cx = Number(q.get('cx') ?? 0.5);
  const cy = Number(q.get('cy') ?? 0.5);
  el.style.height = `${ah}px`;
  el.style.width = '1px';
  el.style.left = `${cx * 100}%`;
  el.style.top = `calc(${cy * 100}% - ${Number(ah) / 2}px)`;
}

const stage = new Stage(document.getElementById('c') as HTMLCanvasElement, state, {
  lowPower: false,
});
stage.start();
if (q.has('break')) setTimeout(() => stage.breakAt(Number(q.get('break'))), 100);
(window as unknown as { __ready: boolean }).__ready = true;
addEventListener('resize', () => stage.resize());
if (!q.has('still')) {
  addEventListener('pointermove', (e) => {
    state.pointer.x = (e.clientX / innerWidth) * 2 - 1;
    state.pointer.y = -((e.clientY / innerHeight) * 2 - 1);
  });
}
