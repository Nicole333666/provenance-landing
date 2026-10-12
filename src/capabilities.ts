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
    let ok = Boolean(gl);
    // A software renderer would draw the scene at a few frames per second.
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    const renderer = info && gl ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    if (/swiftshader|llvmpipe|software|basic render/i.test(renderer)) ok = false;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return ok;
  } catch {
    return false;
  }
}
