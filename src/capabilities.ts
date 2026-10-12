export interface Capabilities {
  webgl: boolean;
  reducedMotion: boolean;
  coarse: boolean;
  lowPower: boolean;
  saveData: boolean;
}

interface NavigatorExtras {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

export function detect(): Capabilities {
  const nav = navigator as Navigator & NavigatorExtras;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const memory = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 8;
  return {
    webgl: hasWebGL2(),
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    coarse,
    lowPower: coarse || memory <= 4 || cores <= 4,
    saveData: Boolean(nav.connection?.saveData),
  };
}

function hasWebGL2(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    const ok = Boolean(gl);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return ok;
  } catch {
    return false;
  }
}
