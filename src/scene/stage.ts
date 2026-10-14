import {
  Color,
  DirectionalLight,
  DynamicDrawUsage,
  InstancedMesh,
  MathUtils,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  NeutralToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  ShaderChunk,
  Vector2,
  Vector3,
  VSMShadowMap,
  WebGLRenderer,
  Euler,
  Fog,
} from 'three';
import { Studio } from './environment';
import { KEYFRAMES, KF, type Keyframe } from './keyframes';
import { createLinkGeometry, LINK, LINK_OUTER } from './link-geometry';
import { blendPoses, chainSlot, formPoses, LINK_COUNT, makePoses, type Pose } from './poses';
import type { SceneState } from './state';

// Neutral tone mapping blends anything bright 15% toward white. California Gold's red
// channel is always bright, so it washed to cream; keep a trace of the roll-off for highlights.
ShaderChunk.tonemapping_pars_fragment = ShaderChunk.tonemapping_pars_fragment.replace(
  'const float Desaturation = 0.15;',
  'const float Desaturation = 0.03;',
);

const COLORS = {
  porcelain: new Color('#f2f2ef'),
  // California Gold, a touch more yellow at night: the softbox lights it less than the sun,
  // and the lit face should still read bright gold, not amber.
  accent: new Color('#ffc21f'),
  accentDay: new Color('#fdb515'),
  // Berkeley Blue.
  ink: new Color('#002676'),
  // Broken links go dark into the navy, not to grey steel.
  ash: new Color('#17223c'),
  hot: new Color('#ffc31b'),
};

const FOV = 22;
/** Direction a tampered link is pulled, in link heights. */
const PULL = new Vector3(0.16, 0.42, 0.3);
/** How the signed checkpoint sits once it no longer fits. */
const UNSEATED = new Vector3(0.05, -0.16, 0.22);
const CAMERA_Z = 16;
const DEG = Math.PI / 180;

interface Placement {
  position: Vector3;
  quaternion: Quaternion;
  scale: number;
  visible: boolean;
}

export interface TamperEvent {
  /** chain slot of the link that was pulled */
  slot: number;
}

export class Stage {
  readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FOV, 1, 0.5, 80);
  private readonly mesh: InstancedMesh;
  private readonly material: MeshPhysicalMaterial;
  private readonly key = new DirectionalLight(0xffffff, 0);
  private readonly catcher: Mesh<PlaneGeometry, ShadowMaterial>;
  private readonly studio: Studio;

  private readonly posesA = makePoses();
  private readonly posesB = makePoses();
  private readonly poses = makePoses();
  private readonly placeA: Placement = placement();
  private readonly placeB: Placement = placement();
  private readonly anchors: (Element | null)[] = [];

  private readonly pointer = new Vector2();
  private readonly offsets = Array.from({ length: LINK_COUNT }, () => new Vector3());
  private readonly offsetTargets = Array.from({ length: LINK_COUNT }, () => new Vector3());
  private brokenSlot: number | null = null;
  private pulled: number | null = null;
  private cover = 0;
  private coverTarget = 0;
  private wave = 0;
  private waveTarget = 0;

  /** carries the flat-to-round morph weight into setMorphAt */
  private readonly morph = Object.assign(new Mesh(), { morphTargetInfluences: [0] });
  private lastRound = -1;

  private raf = 0;
  private last = 0;
  private born = 0;
  private width = 1;
  private height = 1;
  private visibleH = 1;
  private visibleW = 1;
  private disposed = false;
  private drawnEmpty = false;
  private frameTimes: number[] = [];
  private renderedLast = false;
  /** what the last rendered frame showed, for skipping identical frames */
  private readonly lastDrawn: number[] = [];

  /**
   * Called with the median frame time in ms: after ~2 s of rendering, then again
   * after every further 150 rendered frames for as long as it stays set.
   */
  onPerf: ((medianMs: number) => void) | null = null;
  /** Called on every frame that actually rendered, after the first. */
  onFirstFrame: (() => void) | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly state: SceneState,
    private readonly opts: { lowPower: boolean },
  ) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    // VSM's blur passes are the softest shadow and the most expensive; phones get PCF.
    this.renderer.shadowMap.type = opts.lowPower ? PCFShadowMap : VSMShadowMap;

    this.studio = new Studio(this.renderer);
    this.scene.environment = this.studio.update(0, true);

    const geometry = opts.lowPower ? createLinkGeometry(180, 24) : createLinkGeometry(260, 40);
    this.material = new MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.44,
      metalness: 0,
      clearcoat: 0.8,
      // A broad base reflection of the bright studio veiled every colour; the clearcoat
      // keeps the sharp highlights.
      specularIntensity: 0.3,
      clearcoatRoughness: 0.09,
      sheen: opts.lowPower ? 0 : 0.04,
      sheenRoughness: 0.55,
      sheenColor: new Color(1, 1, 1),
    });
    this.mesh = new InstancedMesh(geometry, this.material, LINK_COUNT);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    for (let i = 0; i < LINK_COUNT; i++) {
      this.mesh.setColorAt(i, COLORS.porcelain);
      this.mesh.setMorphAt(i, this.morph);
    }
    this.scene.add(this.mesh);

    this.key.castShadow = true;
    this.key.shadow.mapSize.set(opts.lowPower ? 1024 : 2048, opts.lowPower ? 1024 : 2048);
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.012;
    this.key.shadow.blurSamples = 16;
    this.scene.add(this.key, this.key.target);

    this.catcher = new Mesh(
      new PlaneGeometry(1, 1),
      new ShadowMaterial({ color: new Color('#000000'), opacity: 0.5, transparent: true }),
    );
    this.catcher.receiveShadow = true;
    this.scene.add(this.catcher);

    this.scene.fog = new Fog(new Color('#020a16'), 14, 42);
    this.camera.position.set(0, 0, CAMERA_Z);
    this.resolveAnchors();
    this.resize();
  }

  start(): void {
    this.born = performance.now();
    this.last = this.born;
    const loop = (now: number) => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      if (document.hidden) {
        this.last = now;
        return;
      }
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.frame(now, dt);
    };
    this.raf = requestAnimationFrame(loop);
  }

  resolveAnchors(): void {
    this.anchors.length = 0;
    for (const k of KEYFRAMES) this.anchors.push(document.querySelector(k.anchor));
  }

  resize(): void {
    // The canvas is sized in CSS to the largest viewport, so a phone's toolbar
    // showing and hiding never reallocates it mid-scroll.
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    const dpr = Math.min(window.devicePixelRatio || 1, this.opts.lowPower ? 1.5 : 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.visibleH = 2 * CAMERA_Z * Math.tan((FOV / 2) * DEG);
    this.visibleW = this.visibleH * this.camera.aspect;
    this.catcher.scale.set(this.visibleW * 4, this.visibleH * 4, 1);
  }

  // ---------------------------------------------------------------- tamper

  /**
   * Pulls a link out of line by a fraction of the full pull, before it breaks
   * (the demo plays itself on scroll).
   */
  setPull(link: number, amount: number): void {
    const s = this.placeA.scale;
    const slot = chainSlot(link);
    for (let i = 0; i < LINK_COUNT; i++) {
      const ds = Math.abs(chainSlot(i) - slot);
      const k = ds === 0 ? 1 : ds === 1 ? 0.22 : 0;
      this.offsetTargets[i]!.copy(PULL).multiplyScalar(s * amount * k);
    }
  }

  /** Breaks the chain at a link: it runs hot, and everything after it goes dark. */
  breakAt(link: number): number {
    const slot = chainSlot(link);
    for (let i = 0; i < LINK_COUNT; i++) {
      if (i !== link) this.offsetTargets[i]!.set(0, 0, 0);
    }
    this.offsetTargets[link]!.copy(PULL).multiplyScalar(this.placeA.scale);
    this.pulled = link;
    this.brokenSlot = slot;
    this.waveTarget = 32;
    if (this.state.reduced) this.wave = this.waveTarget;
    return slot;
  }

  /**
   * The cover-up: every hash after the edit recomputed. Links turn back to normal
   * one by one, except the signed checkpoint (the gold link), which no longer fits.
   */
  setCover(k: number): void {
    this.coverTarget = Math.min(1, Math.max(0, k));
    if (this.state.reduced) this.cover = this.coverTarget;
  }

  repair(): void {
    for (const t of this.offsetTargets) t.set(0, 0, 0);
    this.waveTarget = 0;
    this.coverTarget = 0;
    this.pulled = null;
    if (this.state.reduced) {
      this.wave = 0;
      this.cover = 0;
    }
  }

  // ----------------------------------------------------------------- frame

  private frame(now: number, dt: number): void {
    const { state } = this;
    const s = MathUtils.clamp(state.s, 0, KEYFRAMES.length - 1);
    const i0 = Math.floor(s);
    const i1 = Math.min(KEYFRAMES.length - 1, i0 + 1);
    const f = smooth(s - i0);
    const k0 = KEYFRAMES[i0]!;
    const k1 = KEYFRAMES[i1]!;

    const a = this.place(i0, this.placeA);
    const b = this.place(i1, this.placeB);
    const anyVisible = (f < 0.999 && a.visible) || (f > 0.001 && b.visible);
    if (!anyVisible) {
      if (!this.drawnEmpty) {
        this.renderer.clear();
        this.drawnEmpty = true;
        this.lastDrawn.length = 0;
        this.renderedLast = false;
      }
      return;
    }
    this.drawnEmpty = false;

    // Pointer, damped.
    const damp = 1 - Math.exp(-dt * (state.reduced ? 100 : 3.2));
    this.pointer.x += (state.pointer.x - this.pointer.x) * damp;
    this.pointer.y += (state.pointer.y - this.pointer.y) * damp;

    const t = (now - this.born) / 1000;
    // Arrival: the object is lit from its first frame. It turns and rises into
    // place while the canvas fades in, and the key light sweeps across the glaze.
    const intro = state.reduced ? 1 : 1 - Math.pow(1 - MathUtils.clamp(t / 2.8, 0, 1), 4);
    // The slow breathing and the ripple along the chain keep a frame changing even
    // when nothing scrolls. Phones go without them, so a still page draws nothing.
    const idle = !state.reduced && !this.opts.lowPower;

    // Group placement.
    const pos = new Vector3().lerpVectors(a.position, b.position, f);
    const scale = (a.scale + (b.scale - a.scale) * f) * (0.94 + 0.06 * intro);
    pos.y -= (1 - intro) * scale * 0.16;
    const quat = new Quaternion().slerpQuaternions(a.quaternion, b.quaternion, f);
    const parallax = k0.parallax + (k1.parallax - k0.parallax) * f;
    const settle = (1 - intro) * 0.95;
    const breathe = idle ? Math.sin(t * 0.55) * 0.02 : 0;
    const pq = new Quaternion().setFromEuler(
      new Euler(
        -this.pointer.y * 0.16 * parallax + breathe + (1 - intro) * 0.22,
        this.pointer.x * 0.24 * parallax - settle,
        0,
      ),
    );
    quat.multiply(pq);

    // Per-link poses.
    formPoses(k0.form, state.growth, this.posesA, k0.stream);
    formPoses(k1.form, state.growth, this.posesB, k1.stream);
    blendPoses(this.posesA, this.posesB, f, this.poses);

    // Cross-section: the flat mark rounds out into chain links, and back.
    const round = k0.round + (k1.round - k0.round) * f;
    if (Math.abs(round - this.lastRound) > 0.002) {
      this.lastRound = round;
      this.morph.morphTargetInfluences[0] = round;
      for (let i = 0; i < LINK_COUNT; i++) this.mesh.setMorphAt(i, this.morph);
      if (this.mesh.morphTexture) this.mesh.morphTexture.needsUpdate = true;
    }

    // A chain at rest is never quite still: a slow ripple runs along it.
    const chainWeight = (k0.form === 'chain' ? 1 - f : 0) + (k1.form === 'chain' ? f : 0);
    if (chainWeight > 0 && idle) {
      for (let i = 0; i < LINK_COUNT; i++) {
        const slot = chainSlot(i);
        const p = this.poses[i]!;
        p.position.y += Math.sin(t * 0.85 - slot * 0.42) * 0.045 * chainWeight;
        p.position.z += Math.cos(t * 0.6 - slot * 0.31) * 0.03 * chainWeight;
      }
    }

    // Tamper springs and the break wave.
    const spring = 1 - Math.exp(-dt * 7);
    for (let i = 0; i < LINK_COUNT; i++) {
      this.offsets[i]!.lerp(this.offsetTargets[i]!, state.reduced ? 1 : spring);
    }
    const waveSpeed = 36; // links per second
    if (!state.reduced) {
      this.wave +=
        Math.sign(this.waveTarget - this.wave) *
        Math.min(Math.abs(this.waveTarget - this.wave), waveSpeed * dt);
    }
    if (this.wave <= 0 && this.waveTarget === 0) this.brokenSlot = null;
    this.cover += (this.coverTarget - this.cover) * (state.reduced ? 1 : 1 - Math.exp(-dt * 6));

    // The tamper demo belongs to the chain act. Leaving it (the chain closing back
    // into the pair) retracts the displacement and the colours, so the pair is
    // always seated and woven, whatever state the demo was left in.
    const demo = MathUtils.smoothstep(1 - Math.abs(s - KF.chain), 0, 1);

    // The cover-up: the pulled link slides back into line; the checkpoint unseats.
    const coverWave = this.cover * 34;
    if (this.brokenSlot !== null && this.pulled !== null && this.cover > 0.001) {
      this.offsetTargets[this.pulled]!.copy(PULL).multiplyScalar(
        this.placeA.scale * (1 - this.cover),
      );
      const dSeal = chainSlot(1) - this.brokenSlot;
      if (dSeal > 0) {
        const k = MathUtils.clamp(coverWave - dSeal, 0, 1);
        this.offsetTargets[1]!.copy(UNSEATED).multiplyScalar(this.placeA.scale * k);
      }
    }

    const m = new Matrix4();
    const group = new Matrix4().compose(pos, quat, new Vector3(scale, scale, scale));
    const local = new Matrix4();
    const lp = this.poses;
    const color = new Color();
    const scratch = new Color();
    const day = k0.day + (k1.day - k0.day) * f;
    // Blue to porcelain in display space, eased: a linear-light blend sits in a washed grey.
    const blue = MathUtils.smootherstep(
      (k0.ink === 'blue' ? 1 : 0) * (1 - f) + (k1.ink === 'blue' ? 1 : 0) * f,
      0.2,
      0.8,
    );
    const inkColor = new Color()
      .copy(COLORS.porcelain)
      .convertLinearToSRGB()
      .lerp(new Color().copy(COLORS.ink).convertLinearToSRGB(), blue)
      .convertSRGBToLinear();
    const accentColor = new Color().copy(COLORS.accent).lerp(COLORS.accentDay, day);

    for (let i = 0; i < LINK_COUNT; i++) {
      const p = lp[i]!;
      local.compose(p.position, p.quaternion, new Vector3(p.scale, p.scale, p.scale));
      m.multiplyMatrices(group, local);
      const off = this.offsets[i]!;
      if (demo > 0 && off.lengthSq() > 0) {
        m.elements[12] += off.x * demo;
        m.elements[13] += off.y * demo;
        m.elements[14] += off.z * demo;
      }
      this.mesh.setMatrixAt(i, m);

      // Colour: base colourway, then the break.
      const isAccent = i === 1;
      color.copy(isAccent ? accentColor : inkColor);
      if (this.brokenSlot !== null && demo > 0) {
        const base = scratch.copy(color);
        const slot = chainSlot(i);
        const d = slot - this.brokenSlot;
        const healed = MathUtils.clamp(coverWave - d, 0, 1);
        if (d === 0) {
          color.lerp(COLORS.hot, MathUtils.clamp(this.wave, 0, 1));
          color.lerp(COLORS.porcelain, MathUtils.clamp(this.cover * 4, 0, 1));
        } else if (d > 0) {
          const dark = MathUtils.clamp(this.wave - d, 0, 1) * (isAccent ? 1 : 0.92 * (1 - healed));
          color.lerp(COLORS.ash, dark);
          // The signed checkpoint can't be recomputed: once the rest heals, it runs hot.
          if (isAccent) color.lerp(COLORS.hot, healed);
        }
        color.lerp(base, 1 - demo);
      }
      this.mesh.setColorAt(i, color);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    // Light: night softbox above, or the low day sun from the upper left.
    const env = this.studio.update(day);
    if (env) this.scene.environment = env;
    this.scene.environmentIntensity = (0.95 + day * 0.1) * (0.8 + 0.2 * intro);
    const sun = (k0.sun ?? 1) + ((k1.sun ?? 1) - (k0.sun ?? 1)) * f;
    const sunDir = new Vector3(-0.3, 0.95, 0.75)
      .normalize()
      .lerp(new Vector3(-1, 0.62, 0.5).normalize(), sun)
      .normalize();
    const dir = new Vector3(0.22 + (1 - intro) * 0.9, 0.95, 0.72 - (1 - intro) * 0.6)
      .normalize()
      .lerp(sunDir, day)
      .normalize();
    const breath = idle ? 1 + Math.sin((t * Math.PI * 2) / 8) * 0.045 : 1;
    this.key.intensity = (2.6 + day * 1.6) * (0.7 + 0.3 * intro) * breath;
    // The studio is dim: lift the object (only the object: the ground is CSS) so the gold
    // still reads bright at night.
    this.renderer.toneMappingExposure = MathUtils.lerp(1.15, 1, day);
    this.key.color.setRGB(1, 0.97 - day * 0.02, 0.93 - day * 0.05);
    const reach = Math.max(
      scale * 3.2,
      k0.form === 'chain' || k1.form === 'chain' ? this.visibleW * 0.7 : 0,
    );
    this.key.position.copy(pos).addScaledVector(dir, reach * 3);
    this.key.target.position.copy(pos);
    const sc = this.key.shadow.camera;
    sc.left = -reach;
    sc.right = reach;
    sc.top = reach;
    sc.bottom = -reach;
    sc.near = 0.1;
    sc.far = reach * 6;
    sc.updateProjectionMatrix();
    this.key.shadow.radius = MathUtils.lerp(14, 5, day * sun);

    // Night fog gives the chain depth; daylight is clear.
    const fog = this.scene.fog as Fog;
    fog.near = 12 + day * 200;
    fog.far = 34 + day * 400;

    // Shadow catcher, behind the object, facing the camera.
    const depth = k0.shadowDepth + (k1.shadowDepth - k0.shadowDepth) * f;
    this.catcher.position.set(pos.x, pos.y, pos.z - depth * scale * LINK_OUTER.height);
    // Shadows belong to an object at rest: none while it travels between acts.
    const travel = 1 - 4 * f * (1 - f);
    const shadow = (k0.shadow + (k1.shadow - k0.shadow) * f) * intro * travel;
    this.catcher.material.opacity = shadow;
    const tint0 = k0.shadowTint;
    const tint1 = k1.shadowTint;
    this.catcher.material.color.setRGB(
      tint0[0] + (tint1[0] - tint0[0]) * f,
      tint0[1] + (tint1[1] - tint0[1]) * f,
      tint0[2] + (tint1[2] - tint0[2]) * f,
    );
    this.catcher.visible = shadow > 0.01;

    if (!idle && intro >= 1 && this.unchanged(pos, quat, scale, round, day, demo, shadow)) {
      this.renderedLast = false;
      return;
    }
    this.renderer.render(this.scene, this.camera);

    if (this.onFirstFrame) {
      this.onFirstFrame();
      this.onFirstFrame = null;
    }
    // Frame time, counted only between two frames that both rendered.
    if (this.onPerf && this.renderedLast) {
      this.frameTimes.push(dt * 1000);
      if (now - this.born > 2400 && this.frameTimes.length >= 150) {
        const sorted = this.frameTimes.slice(8).sort((x, y) => x - y);
        const median = sorted[Math.floor(sorted.length / 2)] ?? 16;
        this.frameTimes = [];
        this.onPerf(median);
      }
    }
    this.renderedLast = true;
  }

  /**
   * True when this frame would draw exactly what the last one did: the object has
   * not moved, and no spring, wave or cover-up is still in motion.
   */
  private unchanged(
    pos: Vector3,
    quat: Quaternion,
    scale: number,
    round: number,
    day: number,
    demo: number,
    shadow: number,
  ): boolean {
    for (let i = 0; i < LINK_COUNT; i++) {
      if (this.offsets[i]!.distanceToSquared(this.offsetTargets[i]!) > 1e-8) return false;
    }
    if (Math.abs(this.wave - this.waveTarget) > 1e-3) return false;
    if (Math.abs(this.cover - this.coverTarget) > 1e-4) return false;
    const now = [
      pos.x,
      pos.y,
      pos.z,
      quat.x,
      quat.y,
      quat.z,
      quat.w,
      scale,
      round,
      day,
      demo,
      shadow,
      this.state.s,
      this.state.growth,
      this.brokenSlot ?? -1,
      this.width,
      this.height,
    ];
    const same = now.every((v, i) => Math.abs(v - (this.lastDrawn[i] ?? NaN)) < 1e-5);
    if (!same) this.lastDrawn.splice(0, now.length, ...now);
    return same;
  }

  /** Resolves a keyframe's anchor into a world-space placement. */
  private place(index: number, out: Placement): Placement {
    const k: Keyframe = KEYFRAMES[index]!;
    const el = this.anchors[index];
    if (!el) {
      out.visible = false;
      return out;
    }
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    out.position.set(
      (cx / this.width - 0.5) * this.visibleW,
      (0.5 - cy / this.height) * this.visibleH,
      0,
    );
    out.scale = ((r.height / this.height) * this.visibleH) / LINK_OUTER.height;
    out.quaternion.setFromEuler(
      new Euler(k.rotation[0] * DEG, k.rotation[1] * DEG, k.rotation[2] * DEG),
    );
    // Generous margin: a chain or a large pair reaches well beyond its anchor box.
    const reach = k.form === 'chain' ? this.visibleW : out.scale * (LINK.width + LINK.offset) * 1.2;
    out.visible =
      Math.abs(out.position.y) - reach < this.visibleH / 2 &&
      Math.abs(out.position.x) - reach < this.visibleW / 2;
    return out;
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.studio.dispose();
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.catcher.geometry.dispose();
    this.catcher.material.dispose();
    this.key.shadow.map?.dispose();
    this.renderer.dispose();
  }
}

function placement(): Placement {
  return { position: new Vector3(), quaternion: new Quaternion(), scale: 1, visible: false };
}

function smooth(x: number): number {
  const t = MathUtils.clamp(x, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export type { Pose };
