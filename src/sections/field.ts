import { prng } from '../record/session';

/** Everything else on a student's computer. None of it is ever recorded. */
const ELSEWHERE = [
  '~/Downloads',
  'Messages',
  'Safari history',
  '~/Desktop/notes.txt',
  'Photos',
  'Spotify',
  '~/Documents/essay-draft.docx',
  'Discord',
  'Mail',
  '~/projects/personal-site',
  'Notes',
  '~/Pictures',
  'Calendar',
  'Slack',
  'Chrome tabs',
  '~/cs10/old-labs',
  'Zoom',
  'iCloud Drive',
  '~/Desktop/screenshots',
  'Keychain',
  'Terminal history',
  '~/Music',
  'clipboard',
  'Wi-Fi networks',
  '~/Documents/resume.pdf',
  'other VS Code windows',
  'webcam',
  'microphone',
  '~/math54/hw',
  'Finder',
  'Contacts',
  'browser extensions',
  '~/Documents/taxes',
  'Steam',
  'System Settings',
  'other tabs',
  '~/side-project',
  'Reminders',
  'FaceTime',
  'Preview',
] as const;

/**
 * A dim field of everything on the machine, with the one assignment folder lit.
 * Positions are deterministic and keep clear of the folder in the middle.
 */
export function mountField(host: HTMLElement): () => void {
  let layout = '';
  const draw = () => {
    const narrow = host.clientWidth < 640;
    if ((narrow ? 'n' : 'w') === layout) return;
    layout = narrow ? 'n' : 'w';
    const rand = prng(7);
    // A jittered grid, with the middle left clear for the folder.
    const cols = narrow ? 3 : 6;
    const rows = narrow ? 9 : 8;
    const labels = ELSEWHERE.filter((l) => !narrow || l.length <= 15);
    const cells: [number, number][] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = (c + 0.5) / cols;
        const cy = (r + 0.5) / rows;
        const dx = (cx - 0.5) / (narrow ? 0.42 : 0.3);
        const dy = (cy - 0.5) / (narrow ? 0.16 : 0.22);
        if (dx * dx + dy * dy > 1) cells.push([cx, cy]);
      }
    }
    const items = labels.slice(0, cells.length).map((label, i) => {
      const [cx, cy] = cells[i]!;
      const x = (cx + (rand() - 0.5) * (narrow ? 0.04 : 0.07)) * 100;
      const y = (cy + (rand() - 0.5) * 0.05) * 100;
      return `<span class="field__item" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%">${label}</span>`;
    });
    host.innerHTML =
      items.join('') +
      `<div class="field__folder"><small>recorded</small><span>~/courses/trails/</span></div>`;
  };
  draw();

  const ro = new ResizeObserver(draw);
  ro.observe(host);
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) host.classList.toggle('is-lit', e.intersectionRatio > 0.5);
    },
    { threshold: [0, 0.5, 1] },
  );
  io.observe(host);
  return () => {
    io.disconnect();
    ro.disconnect();
  };
}
