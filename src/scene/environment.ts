import {
  BackSide,
  BoxGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  type Texture,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from 'three';

/**
 * A tiny procedural photo studio, baked into a PMREM environment map. Reflections
 * on the glaze come from these panels, so they agree with the key light: one large
 * softbox overhead, a thin strip for the rim, and a room that changes from a black
 * studio (night) to a sunlit paper room (day).
 */
export class Studio {
  private readonly scene = new Scene();
  private readonly room: MeshBasicMaterial;
  private readonly softbox: MeshBasicMaterial;
  private readonly strip: MeshBasicMaterial;
  private readonly floor: MeshBasicMaterial;
  private readonly sun: MeshBasicMaterial;
  private readonly front: MeshBasicMaterial;
  private readonly pmrem: PMREMGenerator;
  private target: WebGLRenderTarget | null = null;
  private lastMix = -1;

  constructor(private readonly renderer: WebGLRenderer) {
    this.pmrem = new PMREMGenerator(renderer);

    this.room = new MeshBasicMaterial({ side: BackSide });
    const room = new Mesh(new BoxGeometry(30, 30, 30), this.room);
    this.scene.add(room);

    // Softbox: large, overhead and slightly in front, angled at the subject.
    this.softbox = new MeshBasicMaterial();
    const softbox = new Mesh(new PlaneGeometry(10, 4.5), this.softbox);
    softbox.position.set(0, 9, 4);
    softbox.lookAt(0, 0, 0);
    this.scene.add(softbox);

    // Rim strip: tall and narrow, behind-left. Draws the edge highlight.
    this.strip = new MeshBasicMaterial();
    const strip = new Mesh(new PlaneGeometry(1.2, 12), this.strip);
    strip.position.set(-9, 2, -5);
    strip.lookAt(0, 0, 0);
    this.scene.add(strip);

    // Floor bounce.
    this.floor = new MeshBasicMaterial();
    const floor = new Mesh(new PlaneGeometry(30, 30), this.floor);
    floor.position.set(0, -10, 0);
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    // A broad, soft panel in front and a little above: lights flat faces evenly,
    // with a gentle falloff toward the bottom.
    this.front = new MeshBasicMaterial();
    const front = new Mesh(new PlaneGeometry(16, 7), this.front);
    front.position.set(0, 10, 10);
    front.lookAt(0, 0, 0);
    this.scene.add(front);

    // The sun, low from the upper left: a small hot disc for day reflections.
    this.sun = new MeshBasicMaterial();
    const sun = new Mesh(new PlaneGeometry(2.2, 2.2), this.sun);
    sun.position.set(-11, 7, 6);
    sun.lookAt(0, 0, 0);
    this.scene.add(sun);
  }

  /** Re-bakes only when the mix has moved enough to be visible. */
  update(dayMix: number, force = false): Texture | null {
    const m = Math.round(dayMix * 24) / 24;
    if (!force && m === this.lastMix && this.target) return null;
    this.lastMix = m;

    const lerp = (a: Color, b: Color) => a.clone().lerp(b, m);
    this.room.color.copy(lerp(new Color(0.003, 0.004, 0.007), new Color(0.29, 0.29, 0.29)));
    this.softbox.color.copy(lerp(new Color(13.4, 13.5, 13.8), new Color(2.4, 2.45, 2.6)));
    this.strip.color.copy(lerp(new Color(4.2, 4.3, 4.5), new Color(0.8, 0.8, 0.82)));
    this.floor.color.copy(lerp(new Color(0.008, 0.014, 0.03), new Color(0.85, 0.85, 0.83)));
    this.sun.color.copy(lerp(new Color(0, 0, 0), new Color(30, 27, 22)));
    this.front.color.copy(lerp(new Color(2.5, 2.52, 2.6), new Color(0.88, 0.89, 0.9)));

    const next = this.pmrem.fromScene(this.scene, 0, 0.1, 60);
    this.target?.dispose();
    this.target = next;
    return next.texture;
  }

  dispose(): void {
    this.target?.dispose();
    this.pmrem.dispose();
    this.scene.traverse((o) => {
      if (o instanceof Mesh) {
        o.geometry.dispose();
        (o.material as MeshBasicMaterial).dispose();
      }
    });
  }
}
