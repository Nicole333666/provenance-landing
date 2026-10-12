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
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
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

const COLORS = {
  porcelain: new Color('#ece6db'),
  accent: new Color('#f2621a'),
  accentDay: new Color('#ec5a12'),
  ink: new Color('#141416'),
  ash: new Color('#2b2724'),
  hot: new Color('#ff6d1f'),
};

const FOV = 22;
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
  private wave = 0;
  private waveTarget = 0;
  private dragging: number | null = null;

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

  /** Called once, after ~2 s of rendering, with the median frame time in ms. */
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
    this.renderer.shadowMap.type = VSMShadowMap;

    this.studio = new Studio(this.renderer);
    this.scene.environment = this.studio.update(0, true);

    const geometry = opts.lowPower ? createLinkGeometry(180, 24) : createLinkGeometry(260, 40);
    this.material = new MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.44,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.09,
      sheen: 0.12,
      sheenRoughness: 0.55,
      sheenColor: new Color(1, 1, 1),
    });
    this.mesh = new InstancedMesh(geometry, this.material, LINK_COUNT);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    for (let i = 0; i < LINK_COUNT; i++) this.mesh.setColorAt(i, COLORS.porcelain);
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

    this.scene.fog = new Fog(new Color('#0a0705'), 14, 42);
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
    this.width = window.innerWidth;
    this.height = window.innerHeight;
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

  private readonly raycaster = new Raycaster();

  /** Returns the chain slot under the pointer, or null. */
  pick(clientX: number, clientY: number): number | null {
    if (Math.abs(this.state.s - KF.chain) > 0.02) return null;
    const ndc = new Vector2((clientX / this.width) * 2 - 1, -(clientY / this.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.mesh, false)[0];
    if (!hit || hit.instanceId === undefined) return null;
    return hit.instanceId;
  }

  /** Link index nearest the centre of the viewport, for keyboard use. */
  centreLink(): number {
    let best = 0;
    let bestD = Infinity;
    const v = new Vector3();
    const m = new Matrix4();
    for (let i = 0; i < LINK_COUNT; i++) {
      this.mesh.getMatrixAt(i, m);
      v.setFromMatrixPosition(m).project(this.camera);
      const d = v.x * v.x + v.y * v.y;
      if (d < bestD && this.poses[i]!.scale > 0.5) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  beginDrag(link: number): void {
    this.dragging = link;
  }

  /** Pointer delta in CSS px since drag start. */
  drag(dx: number, dy: number): number {
    if (this.dragging === null) return 0;
    const pxToWorld = this.visibleH / this.height;
    const limit = this.placeA.scale * 0.75;
    const v = new Vector3(dx * pxToWorld, -dy * pxToWorld, 0);
    if (v.length() > limit) v.setLength(limit + (v.length() - limit) * 0.15);
    this.offsetTargets[this.dragging]!.copy(v);
    const slot = chainSlot(this.dragging);
    for (let i = 0; i < LINK_COUNT; i++) {
      const ds = Math.abs(chainSlot(i) - slot);
      if (ds === 1) this.offsetTargets[i]!.copy(v).multiplyScalar(0.28);
      if (ds === 2) this.offsetTargets[i]!.copy(v).multiplyScalar(0.08);
    }
    return v.length() / Math.max(1e-6, this.placeA.scale);
  }

  /** Ends a drag. Returns the slot that broke, or null if it sprang back. */
  endDrag(commit: boolean): number | null {
    const link = this.dragging;
    this.dragging = null;
    if (link === null) return null;
    if (!commit) {
      for (const t of this.offsetTargets) t.set(0, 0, 0);
      return null;
    }
    return this.breakAt(link);
  }

  /** Breaks the chain at a link (tap, click or keyboard). */
  breakAt(link: number): number {
    const slot = chainSlot(link);
    const t = this.offsetTargets[link]!;
    if (t.lengthSq() < 1e-6) {
      // A tap: knock it out of line, away from the chain axis.
      t.set(0.18, 0.34, 0.25).multiplyScalar(this.placeA.scale);
    }
    for (let i = 0; i < LINK_COUNT; i++) {
      if (i !== link && Math.abs(chainSlot(i) - slot) <= 2) this.offsetTargets[i]!.set(0, 0, 0);
    }
    this.brokenSlot = slot;
    this.waveTarget = 30;
    if (this.state.reduced) this.wave = this.waveTarget;
    return slot;
  }

  repair(): void {
    for (const t of this.offsetTargets) t.set(0, 0, 0);
    this.waveTarget = 0;
    if (this.state.reduced) this.wave = 0;
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
      }
      return;
    }
    this.drawnEmpty = false;

    // Pointer, damped.
    const damp = 1 - Math.exp(-dt * (state.reduced ? 100 : 3.2));
    this.pointer.x += (state.pointer.x - this.pointer.x) * damp;
    this.pointer.y += (state.pointer.y - this.pointer.y) * damp;

    const t = (now - this.born) / 1000;
    const intro = state.reduced ? 1 : smooth(MathUtils.clamp(t / 2.2, 0, 1));

    // Group placement.
    const pos = new Vector3().lerpVectors(a.position, b.position, f);
    const scale = a.scale + (b.scale - a.scale) * f;
    const quat = new Quaternion().slerpQuaternions(a.quaternion, b.quaternion, f);
    const parallax = k0.parallax + (k1.parallax - k0.parallax) * f;
    const settle = (1 - intro) * 0.35;
    const breathe = state.reduced ? 0 : Math.sin(t * 0.55) * 0.02;
    const pq = new Quaternion().setFromEuler(
      new Euler(
        -this.pointer.y * 0.16 * parallax + breathe,
        this.pointer.x * 0.24 * parallax - settle,
        0,
      ),
    );
    quat.multiply(pq);

    // Per-link poses.
    formPoses(k0.form, state.growth, this.posesA, k0.stream);
    formPoses(k1.form, state.growth, this.posesB, k1.stream);
    blendPoses(this.posesA, this.posesB, f, this.poses);

    // A chain at rest is never quite still: a slow ripple runs along it.
    const chainWeight = (k0.form === 'chain' ? 1 - f : 0) + (k1.form === 'chain' ? f : 0);
    if (chainWeight > 0 && !state.reduced) {
      for (let i = 0; i < LINK_COUNT; i++) {
        const slot = chainSlot(i);
        const p = this.poses[i]!;
        p.position.y += Math.sin(t * 0.85 - slot * 0.42) * 0.045 * chainWeight;
        p.position.z += Math.cos(t * 0.6 - slot * 0.31) * 0.03 * chainWeight;
      }
    }

    // Tamper springs and the break wave.
    const spring = 1 - Math.exp(-dt * (this.dragging !== null ? 18 : 7));
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

    const m = new Matrix4();
    const group = new Matrix4().compose(pos, quat, new Vector3(scale, scale, scale));
    const local = new Matrix4();
    const lp = this.poses;
    const color = new Color();
    const dayColor = new Color();
    const day = k0.day + (k1.day - k0.day) * f;
    const colorDay =
      (k0.colorway === 'day' ? 1 : 0) * (1 - f) + (k1.colorway === 'day' ? 1 : 0) * f;

    for (let i = 0; i < LINK_COUNT; i++) {
      const p = lp[i]!;
      local.compose(p.position, p.quaternion, new Vector3(p.scale, p.scale, p.scale));
      m.multiplyMatrices(group, local);
      const off = this.offsets[i]!;
      if (off.lengthSq() > 0) {
        m.elements[12] += off.x;
        m.elements[13] += off.y;
        m.elements[14] += off.z;
      }
      this.mesh.setMatrixAt(i, m);

      // Colour: base colourway, then the break.
      const isAccent = i === 1;
      color.copy(isAccent ? COLORS.accent : COLORS.porcelain);
      dayColor.copy(isAccent ? COLORS.accentDay : COLORS.ink);
      color.lerp(dayColor, colorDay);
      if (this.brokenSlot !== null) {
        const slot = chainSlot(i);
        const d = slot - this.brokenSlot;
        if (d === 0) color.lerp(COLORS.hot, MathUtils.clamp(this.wave, 0, 1));
        else if (d > 0) color.lerp(COLORS.ash, MathUtils.clamp(this.wave - d, 0, 1) * 0.92);
        // Only the pulled link stays orange; the accent link stands down.
        else if (isAccent) color.lerp(COLORS.porcelain, MathUtils.clamp(this.wave, 0, 1));
      }
      this.mesh.setColorAt(i, color);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    // Light: night softbox above, or the low day sun from the upper left.
    const env = this.studio.update(day);
    if (env) this.scene.environment = env;
    this.scene.environmentIntensity = (0.95 + day * 0.1) * (0.08 + 0.92 * intro);
    const dir = new Vector3(0.18, 1, 0.34)
      .normalize()
      .lerp(new Vector3(-1, 0.62, 0.5).normalize(), day)
      .normalize();
    const breath = state.reduced ? 1 : 1 + Math.sin((t * Math.PI * 2) / 8) * 0.045;
    this.key.intensity = (2.6 + day * 1.6) * intro * breath;
    this.key.color.setRGB(1, 0.94 - day * 0.03, 0.86 - day * 0.06);
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
    this.key.shadow.radius = MathUtils.lerp(14, 5, day);

    // Night fog gives the chain depth; daylight is clear.
    const fog = this.scene.fog as Fog;
    fog.near = 12 + day * 200;
    fog.far = 34 + day * 400;

    // Shadow catcher, behind the object, facing the camera.
    const depth = k0.shadowDepth + (k1.shadowDepth - k0.shadowDepth) * f;
    this.catcher.position.set(pos.x, pos.y, pos.z - depth * scale * LINK_OUTER.height);
    const shadow = (k0.shadow + (k1.shadow - k0.shadow) * f) * intro;
    this.catcher.material.opacity = shadow;
    const tint0 = k0.shadowTint;
    const tint1 = k1.shadowTint;
    this.catcher.material.color.setRGB(
      tint0[0] + (tint1[0] - tint0[0]) * f,
      tint0[1] + (tint1[1] - tint0[1]) * f,
      tint0[2] + (tint1[2] - tint0[2]) * f,
    );
    this.catcher.visible = shadow > 0.01;

    this.renderer.render(this.scene, this.camera);

    if (this.onFirstFrame) {
      this.onFirstFrame();
      this.onFirstFrame = null;
    }
    if (this.onPerf) {
      this.frameTimes.push(dt * 1000);
      if (now - this.born > 2400) {
        const sorted = this.frameTimes.slice(8).sort((x, y) => x - y);
        const median = sorted[Math.floor(sorted.length / 2)] ?? 16;
        this.onPerf(median);
        this.onPerf = null;
        this.frameTimes = [];
      }
    }
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
