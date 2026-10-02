/**
 * ORRERY LAB C — imperative three.js (WebGPURenderer) scene for the true-3D
 * Orrery. Owned by `OrreryWorld3D`; lives exactly as long as that component is
 * mounted. Never driven by React state: the UI thread pushes a small packet
 * per changed frame (`OrreryPacket`), and this controller applies the newest
 * packet inside its own requestAnimationFrame loop.
 *
 * Coordinates: orrery (x, y) → three (X = x, Y = up, Z = y). The camera comes
 * from `orreryCameraRig`: a REAL perspective camera (fixed ~50° FOV, dolly
 * distance F/zoom, default tilt ~62°; see LAB_FOCAL_PX in orrery-camera-logic).
 * The UI thread projects with the same pinhole math, so the published frame
 * (hits, labels, focus card, reorder) lands on what is drawn here.
 *
 * Depth cues: sun = point light (lit side / terminator on spheres AND on the
 * photo billboards via a per-instance view-space sun vector), range fog to the
 * background token (far side hazier), a star SPHERE around the camera (parallax
 * under yaw/tilt), additive sun glow, rings as thin strips lying in the plane.
 *
 * Layers:
 *   1. starfield    — 2k instanced sprites in a slab under the plane (additive)
 *   2. rings        — ONE instanced strip draw; screen-px width + dashes in TSL
 *   3. bodies       — one InstancedMesh of lit spheres (+ unlit sun sphere)
 *   4. faces        — one instanced Sprite: photo/initials atlas discs facing camera
 *   5. sun glow, Polaris, focus rings (sprites)
 *   6. labels       — screen-space overlay pass (ortho camera) placed exactly at
 *                     the UI-thread `allocateLabels` rects
 *
 * Colours: every colour comes from ThemePalette tokens (materials/uniforms).
 * Mask textures are white alpha ramps tinted by token colours.
 */
import type { SkTypefaceFontProvider } from "@shopify/react-native-skia";
import {
  abs,
  atan,
  Discard,
  Fn,
  float,
  fract,
  If,
  instancedBufferAttribute,
  instancedDynamicBufferAttribute,
  materialColor,
  normalLocal,
  normalView,
  positionGeometry,
  positionView,
  select,
  smoothstep,
  texture,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import * as THREE from "three/webgpu";
import type { CameraPose, CameraViewport } from "@/logic/orrery-camera-logic";
import type { OrreryRingStyle } from "@/logic/orrery-ring-logic";
import type { ThemePalette } from "@/theme/theme-types";
import type { PreparedOrreryText } from "../OrreryLabel";
import { orreryCameraRig } from "./orrery-camera-rig";
import {
  ATLAS_CAPACITY,
  ATLAS_COLS,
  ATLAS_SIZE,
  annulus,
  BodyAtlas,
  noiseTexture,
  planePattern,
  type RgbaImage,
  radialGlow,
  rasterizeLabel,
  tokenChannels,
} from "./orrery-textures3d";

// --- Tunables -------------------------------------------------------------------
/** Max bodies (contacts + sun + satellites) per frame. */
export const MAX_BODIES = 640;
const STAR_COUNT = 2600;
/** Star sphere radius in dolly distances (camera far plane is 40×). */
const STAR_SPHERE_RADIUS = 20;
/** Fog: starts at this fraction of the dolly distance, ends past the far rim. */
const FOG_NEAR_FRACTION = 0.8;
const FOG_FAR_EXTENTS = 1.9;
const STAR_PX_MIN = 1.6;
const STAR_PX_MAX = 4.6;
const TWINKLE_SPEED = 0.0024;
/** Face disc radius as a fraction of the body radius (rest = lit sphere rim). */
const FACE_FRACTION = 0.62;
/** The sun's occupant billboard is a small medallion in front of the lit core. */
const SUN_FACE_FRACTION = 0.74;
/** Sun medallion rim (fraction of the plate radius where the gold bezel starts). */
const SUN_RIM_INNER = 0.8;
/** Medallion interior opacity (the star core glows through the rest). */
const SUN_PLATE_OPACITY = 0.86;
/** Orbital-plane grid/dust disc, in scene extents; ring lines per extent. */
const PLANE_DISC_EXTENTS = 1.18;
const PLANE_GRID_RINGS = 9;
const PLANE_GRID_SPOKES = 24;
const PLANE_DUST_OPACITY = 0.08;
const PLANE_LINE_OPACITY = 0.07;
/** Baked plane pattern resolution (texels across the disc). */
const PLANE_TEX_SIZE = 768;
/** Wide faint corona sprite around the sun (additive), in sun radii. */
const SUN_CORONA_SCALE = 11;
const SUN_CORONA_OPACITY = 0.22;
/** Rings fade from full opacity at the pivot distance to this floor at the far rim. */
const RING_FAR_OPACITY = 0.18;
const SUN_GLOW_SCALE = 6.5;
const SUN_PULSE_SPEED = 0.002;
/** Dash period in logical px (6 on / 6 off, as the Skia DashPathEffect). */
const RING_DASH_PX = 12;
/** Token stroke widths (2–4 px) read heavier on the GPU path; scale them. */
const RING_STROKE_SCALE = 0.45;
const POLARIS_WORLD = 10;
const FOCUS_RING_GAP_PX = 4;
const KEY_LIGHT_INTENSITY = 3.2;
const AMBIENT_INTENSITY = 0.22;
/** Photo billboard shading: ambient floor + lambert gain toward the sun. */
const FACE_AMBIENT = 0.3;
const FACE_DIFFUSE = 0.95;
/** Upload the atlas at most this often while photos stream in (ms). */
const ATLAS_UPLOAD_INTERVAL = 250;
const LABEL_CACHE_MAX = 96;

/** Per-body stride in `OrreryPacket.bodies`. */
export const BODY_STRIDE = 8; // wx, wy, radius, ringRadius, opacity, kind, lift, flare
/** Capture flare (switch): additive halo size in body radii, ring width/alpha gain. */
const FLARE_HALO_SCALE = 5;
const FLARE_RING_WIDTH_GAIN = 2;
const FLARE_RING_ALPHA_GAIN = 1.4;
const FLARE_POOL = 24;
/** Ring density fade: full strength at ≥ this on-screen orbit spacing (px). */
const RING_MIN_SPACING_PX = 20;
const RING_DENSITY_FLOOR = 0.05;
export const KIND_CONTACT = 0;
export const KIND_SUN = 1;
export const KIND_SATELLITE = 2;

export interface PacketLabel {
  id: string;
  x: number;
  y: number;
  o: number;
  cx?: number;
  cy?: number;
}
export interface OrreryPacket {
  pose: CameraPose;
  viewport: CameraViewport;
  keys: string[];
  bodies: number[];
  labels: PacketLabel[];
  extent: number;
  /** Diagnostics: tappable contacts whose centre is on screen. */
  visibleContacts?: number;
}

export interface BodyInfo {
  key: string;
  kind: "contact" | "sun" | "satellite";
  id: number;
  fill: string;
  ring: OrreryRingStyle | null;
  photo: string | null;
  initials: string;
  swatch: string;
  glow?: string;
  /** Sun medallion: shaded plate with this ink token (glyph when no initials). */
  plateInk?: string;
}

export interface LabelText {
  text: PreparedOrreryText;
  context: PreparedOrreryText | null;
}

export interface SceneStats {
  frames: number;
  renderMs: number[];
  dts: number[];
  calls: number;
  triangles: number;
  /** Accumulated ms inside renderer.clear/render (three CPU + encode/submit). */
  drawMs: number;
  /** Lit body spheres drawn in the last frame (instances). */
  spheres: number;
  /** Lifetime counters (leak diagnosis): label rasters, atlas uploads. */
  labelRasters: number;
  atlasFlushes: number;
  labelsLive: number;
}

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpVec = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const tmpColor = new THREE.Color();
const tmpSun = new THREE.Vector3();

const colorCache = new Map<string, THREE.Color>();
/** Theme token → cached three Color (treat as read-only; copy before mutating). */
function color(token: string): THREE.Color {
  let c = colorCache.get(token);
  if (!c) {
    const [r, g, b] = tokenChannels(token);
    c = new THREE.Color().fromArray([r, g, b]).convertSRGBToLinear();
    colorCache.set(token, c);
  }
  return c;
}

function dataTexture(img: RgbaImage): THREE.DataTexture {
  const tex = new THREE.DataTexture(
    img.data,
    img.width,
    img.height,
    THREE.RGBAFormat,
  );
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Unit ring strip: vertex = (sin a, side, −cos a) with side ∈ {−1, +1}. The
 * vertex shader turns it into an annulus of the instance's radius whose width is
 * a constant number of SCREEN pixels (stroke + 1 px AA fringe), so one geometry
 * and one draw call serve every ring at every zoom.
 */
function ringStripGeometry(segments: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    positions.push(Math.sin(a), -1, -Math.cos(a), Math.sin(a), 1, -Math.cos(a));
    if (i < segments) {
      const k = i * 2;
      index.push(k, k + 1, k + 3, k, k + 3, k + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  return g;
}

interface LabelEntry {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicNodeMaterial;
  tex: THREE.DataTexture;
  w: number;
  h: number;
  lastUsed: number;
}

export class OrreryScene3D {
  readonly renderer: THREE.WebGPURenderer;
  private scene = new THREE.Scene();
  private overlay = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 1, 1000);
  private ortho = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10);
  private colors: ThemePalette;
  private fontProvider: SkTypefaceFontProvider | null;
  private dpr: number;

  // bodies
  private sphereGeo = new THREE.SphereGeometry(1, 20, 14);
  private sphereMat = new THREE.MeshStandardNodeMaterial({
    roughness: 0.38,
    metalness: 0.08,
  });
  private spheres: THREE.InstancedMesh;
  private sunMat = new THREE.MeshBasicNodeMaterial();
  private sunTime = uniform(0);
  private sunRim = uniform(new THREE.Color(1, 1, 1));
  private planeMat = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  private plane: THREE.Mesh;
  private sun: THREE.Mesh;
  private keyLight: THREE.PointLight;
  private ambient: THREE.AmbientLight;

  // faces (atlas discs)
  private atlas = new BodyAtlas();
  private atlasTex: THREE.DataTexture;
  private atlasDirty = false;
  private atlasUploadedAt = 0;
  private slotByKey = new Map<string, number>();
  private photoByKey = new Map<string, string | null>();
  private freeSlots: number[] = [];
  private facePos = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_BODIES * 3),
    3,
  );
  private faceScale = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_BODIES),
    1,
  );
  private faceUv = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_BODIES * 2),
    2,
  );
  private faceOpacity = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_BODIES),
    1,
  );
  /** View-space unit vector body → sun (lit side of the billboard disc). */
  private faceSun = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_BODIES * 3),
    3,
  );
  private fog = new THREE.Fog(0x000000, 1, 1000);
  private faces: THREE.Sprite;

  // stars
  private stars: THREE.Sprite;
  private starScale = uniform(1);
  private starTime = uniform(0);

  // sun glow / polaris / focus
  private glowTex = dataTexture(radialGlow(128));
  private planeTex = dataTexture(
    planePattern(
      PLANE_TEX_SIZE,
      PLANE_GRID_RINGS,
      PLANE_GRID_SPOKES,
      PLANE_DUST_OPACITY,
      PLANE_LINE_OPACITY,
    ),
  );
  private noiseTex = repeatTexture(dataTexture(noiseTexture(128)));
  private starTex = dataTexture(radialGlow(32, 1.2));
  private ringTex = dataTexture(annulus(128, 0.82, 0.98));
  private glowMat = new THREE.SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  private glow: THREE.Sprite;
  private coronaMat = new THREE.SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  private corona: THREE.Sprite;
  private ringFadeNear = uniform(1);
  private ringFadeFar = uniform(2);
  private polarisMat = new THREE.SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
  });
  private polaris: THREE.Sprite;
  private focusMat = new THREE.SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  private focusPool: THREE.Sprite[] = [];
  private flareMat = new THREE.SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  private flarePool: THREE.Sprite[] = [];

  // rings (one instanced draw) + labels
  private ringRadius = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_BODIES),
    1,
  );
  private ringColor = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_BODIES * 4),
    4,
  );
  /** x = dashed (0/1), y = stroke width in logical px. */
  private ringStyle = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_BODIES * 2),
    2,
  );
  private ringWorldPerPx = uniform(1);
  private ringDashWorld = uniform(12);
  private ringMat = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  private ringMesh: THREE.InstancedMesh;
  private infos = new Map<string, BodyInfo>();
  private labelTexts = new Map<string, LabelText>();
  private labels = new Map<string, LabelEntry>();
  private labelGeo = new THREE.PlaneGeometry(1, 1);

  private packet: OrreryPacket | null = null;
  private focused = new Set<number>();
  private disposed = false;
  private frameCount = 0;
  stats: SceneStats = {
    frames: 0,
    renderMs: [],
    drawMs: 0,
    dts: [],
    calls: 0,
    triangles: 0,
    spheres: 0,
    labelRasters: 0,
    atlasFlushes: 0,
    labelsLive: 0,
  };

  constructor(
    renderer: THREE.WebGPURenderer,
    colors: ThemePalette,
    fontProvider: SkTypefaceFontProvider | null,
    dpr: number,
  ) {
    this.renderer = renderer;
    this.colors = colors;
    this.fontProvider = fontProvider;
    this.dpr = dpr;
    renderer.autoClear = false;

    // Bodies -------------------------------------------------------------------
    this.spheres = new THREE.InstancedMesh(
      this.sphereGeo,
      this.sphereMat,
      MAX_BODIES,
    );
    this.spheres.frustumCulled = false;
    this.spheres.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < MAX_BODIES; i++)
      this.spheres.setColorAt(i, tmpColor.setScalar(1));
    this.spheres.count = 0;
    this.scene.add(this.spheres);

    this.sun = new THREE.Mesh(this.sphereGeo, this.sunMat);
    this.sun.visible = false;
    this.scene.add(this.sun);
    this.keyLight = new THREE.PointLight(0xffffff, KEY_LIGHT_INTENSITY, 0, 0);
    this.scene.add(this.keyLight);
    this.ambient = new THREE.AmbientLight(0xffffff, AMBIENT_INTENSITY);
    this.scene.add(this.ambient);

    // Rings ----------------------------------------------------------------------
    for (const a of [this.ringRadius, this.ringColor, this.ringStyle])
      a.setUsage(THREE.DynamicDrawUsage);
    {
      const radiusNode = instancedDynamicBufferAttribute<"float">(
        this.ringRadius,
        "float",
      );
      const colorNode = instancedDynamicBufferAttribute<"vec4">(
        this.ringColor,
        "vec4",
      );
      const styleNode = instancedDynamicBufferAttribute<"vec2">(
        this.ringStyle,
        "vec2",
      );
      const geo = positionGeometry;
      const halfPx = styleNode.y.mul(0.5 * RING_STROKE_SCALE).add(0.75);
      const r = radiusNode.add(geo.y.mul(halfPx).mul(this.ringWorldPerPx));
      this.ringMat.positionNode = vec3(geo.x.mul(r), 0, geo.z.mul(r));
      const side = varying(geo.y);
      const dir = varying(vec2(geo.x, geo.z));
      const halfPxV = varying(halfPx);
      const radiusV = varying(radiusNode);
      const dashedV = varying(styleNode.x);
      const colorV = varying(colorNode);
      const viewDist = varying(positionView.z.negate());
      this.ringMat.colorNode = colorV.xyz;
      this.ringMat.opacityNode = Fn(() => {
        const edge = float(1).sub(abs(side)).mul(halfPxV).clamp(0, 1);
        const arc = atan(dir.x, dir.y.negate()).mul(radiusV);
        const on = fract(arc.div(this.ringDashWorld)).lessThan(0.5);
        const dash = select(dashedV.greaterThan(0.5), select(on, 1, 0), 1);
        // Depth falloff: far rings dimmer (on top of the scene fog).
        const fade = float(1)
          .sub(
            viewDist
              .sub(this.ringFadeNear)
              .div(this.ringFadeFar.sub(this.ringFadeNear))
              .clamp(0, 1),
          )
          .mul(1 - RING_FAR_OPACITY)
          .add(RING_FAR_OPACITY);
        const alpha = edge.mul(colorV.w).mul(dash).mul(fade);
        If(alpha.lessThan(0.004), () => {
          Discard();
        });
        return alpha;
      })();
      this.ringMesh = new THREE.InstancedMesh(
        ringStripGeometry(160),
        this.ringMat,
        MAX_BODIES,
      );
      this.ringMesh.frustumCulled = false;
      this.ringMesh.renderOrder = -1;
      this.ringMesh.count = 0;
      this.scene.add(this.ringMesh);
    }

    // Faces --------------------------------------------------------------------
    this.atlasTex = dataTexture({
      data: this.atlas.pixels,
      width: ATLAS_SIZE,
      height: ATLAS_SIZE,
    });
    for (let s = ATLAS_CAPACITY - 1; s >= 0; s--) this.freeSlots.push(s);
    for (const a of [
      this.facePos,
      this.faceScale,
      this.faceUv,
      this.faceOpacity,
      this.faceSun,
    ])
      a.setUsage(THREE.DynamicDrawUsage);
    this.scene.fog = this.fog;
    const faceMat = new THREE.SpriteNodeMaterial({ transparent: true });
    const tile = 1 / ATLAS_COLS;
    const faceUvNode = instancedDynamicBufferAttribute<"vec2">(
      this.faceUv,
      "vec2",
    );
    const faceOpacityNode = instancedDynamicBufferAttribute<"float">(
      this.faceOpacity,
      "float",
    );
    faceMat.positionNode = instancedDynamicBufferAttribute<"vec3">(
      this.facePos,
      "vec3",
    );
    faceMat.scaleNode = instancedDynamicBufferAttribute<"float">(
      this.faceScale,
      "float",
    );
    const faceSunNode = instancedDynamicBufferAttribute<"vec3">(
      this.faceSun,
      "vec3",
    );
    faceMat.colorNode = Fn(() => {
      const tex = texture(
        this.atlasTex,
        vec2(uv().x, uv().y.oneMinus()).mul(tile).add(faceUvNode),
      );
      // Treat the disc as the camera-facing hemisphere: per-pixel normal from
      // the disc uv, lambert against the view-space sun direction.
      const p = uv().sub(0.5).mul(2);
      const nz = float(1).sub(p.dot(p)).max(0).sqrt();
      const lambert = vec3(p.x, p.y, nz).dot(faceSunNode).max(0);
      const shade = lambert.mul(FACE_DIFFUSE).add(FACE_AMBIENT);
      // Sun occupant (faceSun.z > 1.1 marks it): a framed medallion — face
      // inset to SUN_RIM_INNER, gold bezel in the glow token with a bevel
      // highlight, warm inner vignette so it sits INSIDE the corona.
      const r = p.length();
      const isSun = faceSunNode.z.greaterThan(1.1);
      const inner = uv().sub(0.5).div(SUN_RIM_INNER).add(0.5);
      const sunTex = texture(
        this.atlasTex,
        vec2(inner.x, inner.y.oneMinus()).mul(tile).add(faceUvNode),
      );
      const vignette = float(1).sub(
        smoothstep(SUN_RIM_INNER * 0.55, SUN_RIM_INNER, r).mul(0.45),
      );
      const faceLit = sunTex.rgb
        .mul(vignette)
        .mul(1.05)
        .add(
          this.sunRim.mul(
            smoothstep(SUN_RIM_INNER * 0.3, SUN_RIM_INNER, r).mul(0.42),
          ),
        );
      const bevel = p.y
        .mul(-0.5)
        .add(0.75)
        .add(
          smoothstep(0.86, 0.9, r)
            .mul(smoothstep(1, 0.94, r))
            .mul(0.6),
        );
      const rim = this.sunRim.mul(bevel);
      const sunRgb = select(r.greaterThan(SUN_RIM_INNER), rim, faceLit);
      return select(isSun, vec4(sunRgb, 1), vec4(tex.rgb.mul(shade), tex.a));
    })();
    faceMat.opacityNode = Fn(() => {
      const d = uv().sub(0.5).length();
      If(d.greaterThan(0.5), () => {
        Discard();
      });
      // Sun medallion interior is slightly translucent: the emissive star core
      // behind it glows through the plate (bezel stays opaque).
      const sunInner = faceSunNode.z
        .greaterThan(1.1)
        .and(d.mul(2).lessThan(SUN_RIM_INNER));
      return select(
        sunInner,
        faceOpacityNode.mul(SUN_PLATE_OPACITY),
        faceOpacityNode,
      );
    })();
    this.faces = new THREE.Sprite(faceMat);
    this.faces.count = 0;
    this.faces.frustumCulled = false;
    this.faces.renderOrder = 2;
    this.scene.add(this.faces);

    // Stars --------------------------------------------------------------------
    const starPos = new Float32Array(STAR_COUNT * 3);
    const starSize = new Float32Array(STAR_COUNT);
    const starCol = new Float32Array(STAR_COUNT * 3);
    const starPhase = new Float32Array(STAR_COUNT);
    const starTones = [
      colors.textSecondary,
      colors.textPrimary,
      ...colors.starPalette,
    ].map(tokenChannels);
    // Deep-field slab BELOW the orbital plane (unit disc, scaled to the scene
    // extent each frame). The Orrery camera is a long-focal telephoto (FOV is
    // ~2–8°), so a sky dome at infinity shows almost no stars; a slab under the
    // plane fills the view and parallaxes against the orbits under pan/tilt.
    for (let i = 0; i < STAR_COUNT; i++) {
      // Uniform points on the unit sphere (a sky around the camera).
      const z = seeded(i + 1) * 2 - 1;
      const t = seeded(i + 1001) * Math.PI * 2;
      const rr = Math.sqrt(Math.max(0, 1 - z * z));
      starPos.set([rr * Math.cos(t), z, rr * Math.sin(t)], i * 3);
      starSize[i] =
        STAR_PX_MIN + seeded(i + 2001) ** 3 * (STAR_PX_MAX - STAR_PX_MIN);
      const tone = starTones[i % starTones.length];
      // Linearise the sRGB token for the additive star colour.
      starCol.set(
        tone.map((v) => v ** 2.2),
        i * 3,
      );
      starPhase[i] = seeded(i + 3001) * Math.PI * 2;
    }
    const starMat = new THREE.SpriteNodeMaterial({
      sizeAttenuation: false,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    starMat.fog = false;
    const phase = instancedBufferAttribute<"float">(
      staticAttr(starPhase, 1),
      "float",
    );
    starMat.positionNode = instancedBufferAttribute<"vec3">(
      staticAttr(starPos, 3),
      "vec3",
    );
    starMat.scaleNode = instancedBufferAttribute<"float">(
      staticAttr(starSize, 1),
      "float",
    ).mul(this.starScale);
    const twinkle = this.starTime
      .mul(TWINKLE_SPEED)
      .add(phase)
      .sin()
      .mul(0.35)
      .add(0.65);
    starMat.colorNode = vec4(
      instancedBufferAttribute<"vec3">(staticAttr(starCol, 3), "vec3"),
      texture(this.starTex).a,
    );
    starMat.opacityNode = twinkle;
    this.stars = new THREE.Sprite(starMat);
    this.stars.count = STAR_COUNT;
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -10;
    this.scene.add(this.stars);
    // Pattern baked once into a texture (was atan + fract per fragment).
    this.planeMat.colorNode = materialColor;
    this.planeMat.opacityNode = texture(this.planeTex).a.mul(0.25);
    this.planeMat.blending = THREE.AdditiveBlending;
    this.planeMat.fog = false;
    this.plane = new THREE.Mesh(
      new THREE.CircleGeometry(1, 128),
      this.planeMat,
    );
    this.plane.rotation.x = -Math.PI / 2;
    this.plane.position.y = -0.5;
    this.plane.renderOrder = -2;
    this.plane.frustumCulled = false;
    this.scene.add(this.plane);

    // Sun glow, Polaris, focus rings ------------------------------------------
    this.glowMat.fog = false;
    this.focusMat.fog = false;
    this.glowMat.colorNode = texture(this.glowTex).mul(vec4(materialColor, 1));
    this.glow = new THREE.Sprite(this.glowMat);
    this.glow.renderOrder = 1;
    this.glow.visible = false;
    this.scene.add(this.glow);
    this.coronaMat.fog = false;
    this.coronaMat.colorNode = texture(this.glowTex).mul(
      vec4(materialColor, 1),
    );
    this.corona = new THREE.Sprite(this.coronaMat);
    this.corona.renderOrder = 0;
    this.corona.visible = false;
    this.scene.add(this.corona);
    // Sun core: emissive sphere with a hot centre and darker limb (3D, not a disc).
    // Lit star: limb darkening + slowly drifting fractal granulation (TSL
    // noise on the sphere's local normal) + a hot white-ish core.
    {
      const limb = normalView.z.max(0);
      // Baked tileable value noise (was 2-octave mx_fractal_noise per pixel),
      // mapped by longitude/latitude of the local normal, drifting in u.
      const lon = atan(normalLocal.z, normalLocal.x)
        .div(Math.PI * 2)
        .add(this.sunTime.mul(0.000006));
      const lat = normalLocal.y.mul(0.5).add(0.5);
      const grain = texture(this.noiseTex, vec2(lon.mul(2), lat.mul(1.4)))
        .a.sub(0.5)
        .mul(1.4);
      const surface = materialColor
        .mul(limb.pow(0.9).mul(0.75).add(0.35))
        .mul(grain.mul(0.35).add(1));
      this.sunMat.colorNode = surface.add(
        vec3(1, 0.95, 0.85).mul(limb.pow(6).mul(0.35)),
      );
    }
    this.sunMat.fog = false;
    this.polarisMat.colorNode = texture(this.glowTex).mul(
      vec4(materialColor, 1),
    );
    this.polaris = new THREE.Sprite(this.polarisMat);
    this.polaris.scale.setScalar(POLARIS_WORLD);
    this.scene.add(this.polaris);
    this.focusMat.colorNode = texture(this.ringTex).mul(vec4(materialColor, 1));
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Sprite(this.focusMat);
      s.visible = false;
      s.renderOrder = 3;
      this.focusPool.push(s);
      this.scene.add(s);
    }
    this.flareMat.fog = false;
    this.flareMat.colorNode = texture(this.glowTex).mul(vec4(materialColor, 1));
    for (let i = 0; i < FLARE_POOL; i++) {
      const f = new THREE.Sprite(this.flareMat);
      f.visible = false;
      f.renderOrder = 1;
      this.flarePool.push(f);
      this.scene.add(f);
    }
    this.applyColors(colors);
  }

  applyColors(colors: ThemePalette) {
    // Label rasters bake the surface backplate: re-raster on a theme change.
    if (this.colors && this.colors.surface !== colors.surface)
      for (const [id, entry] of this.labels) this.dropLabel(id, entry);
    this.colors = colors;
    // autoClear is off (two passes), so the background is the clear colour.
    this.renderer.setClearColor(color(colors.background), 1);
    this.fog.color.copy(color(colors.background));
    this.keyLight.color.copy(
      color(colors.starPalette[0] ?? colors.textPrimary),
    );
    this.ambient.color.copy(color(colors.textPrimary));
    this.polarisMat.color.copy(color(colors.textPrimary));
    this.focusMat.color.copy(color(colors.accent));
    this.flareMat.color.copy(color(colors.accent));
    this.planeMat.color.copy(color(colors.accent));
  }

  setFontProvider(fontProvider: SkTypefaceFontProvider | null) {
    this.fontProvider = fontProvider;
  }

  setFocused(ids: readonly number[]) {
    this.focused = new Set(ids);
  }

  /** Resource set changed (scene / switch union / theme): tiles + rings. */
  setBodies(
    infos: BodyInfo[],
    loadPhoto: (key: string, photo: string) => void,
  ) {
    const next = new Map(infos.map((i) => [i.key, i]));
    // Release tiles of keys that left the union.
    for (const [key, slot] of this.slotByKey)
      if (!next.has(key)) {
        this.slotByKey.delete(key);
        this.photoByKey.delete(key);
        this.freeSlots.push(slot);
      }
    for (const info of infos) {
      if (info.kind === "satellite") continue;
      let slot = this.slotByKey.get(info.key);
      const prevInfo = this.infos.get(info.key);
      const needsDraw =
        slot === undefined ||
        prevInfo?.swatch !== info.swatch ||
        prevInfo?.plateInk !== info.plateInk ||
        prevInfo?.initials !== info.initials;
      if (slot === undefined) {
        slot = this.freeSlots.pop();
        if (slot === undefined) continue; // over capacity: sphere only
        this.slotByKey.set(info.key, slot);
      }
      if (needsDraw || this.photoByKey.get(info.key) !== info.photo) {
        this.atlas.drawInitials(
          slot,
          info.swatch,
          this.colors.avatarSwatchText,
          info.initials,
          this.fontProvider,
          info.plateInk ? { ink: info.plateInk } : null,
        );
        this.atlasDirty = true;
        this.photoByKey.set(info.key, info.photo);
        if (info.photo) loadPhoto(info.key, info.photo);
      }
    }
    this.infos = next;
  }

  /** A photo finished decoding: paint it into the body's tile. */
  drawPhoto(
    key: string,
    photo: string,
    image: import("@shopify/react-native-skia").SkImage,
  ) {
    const slot = this.slotByKey.get(key);
    if (
      slot === undefined ||
      this.photoByKey.get(key) !== photo ||
      this.disposed
    )
      return false;
    this.atlas.drawPhoto(slot, image);
    this.atlasDirty = true;
    return true;
  }

  setLabelTexts(texts: Map<string, LabelText>) {
    const previous = this.labelTexts;
    this.labelTexts = texts;
    // Paragraphs are cached upstream (orrery-text-cache): an unchanged label
    // keeps the same PreparedOrreryText object, so keep its raster (D.6 — a
    // focus change used to re-rasterize every label).
    for (const [cacheId, entry] of this.labels) {
      const isContext = cacheId.endsWith("#ctx");
      const id = isContext ? cacheId.slice(0, -4) : cacheId;
      const before = previous.get(id);
      const after = texts.get(id);
      const same = isContext
        ? before?.context != null && before.context === after?.context
        : before?.text != null && before.text === after?.text;
      if (!same) this.dropLabel(cacheId, entry);
    }
  }

  setPacket(packet: OrreryPacket) {
    this.packet = packet;
  }

  /** Apply the newest packet + ambient time, then draw. Returns CPU ms. */
  frame(timeMs: number, reducedMotion: boolean): number {
    const packet = this.packet;
    if (!packet || this.disposed) return 0;
    const t0 = performance.now();
    this.frameCount++;
    const { pose, viewport } = packet;
    const W = viewport.width;
    const H = viewport.height;

    // Camera (true perspective; same pinhole the UI thread projects with) -------
    const rig = orreryCameraRig(pose, viewport);
    this.camera.fov = rig.fovDeg;
    this.camera.aspect = rig.aspect;
    this.camera.near = rig.near;
    this.camera.far = rig.far;
    this.camera.setViewOffset(...rig.viewOffset);
    this.camera.matrixAutoUpdate = false;
    this.camera.matrix.fromArray(rig.world);
    this.camera.matrixWorldNeedsUpdate = true;
    this.camera.updateMatrixWorld(true);
    const camPos = tmpVec.set(...rig.position).clone();
    const zoom = pose.zoom;

    // Star sphere centred on the camera: pure rotation parallax (a skybox) as
    // the camera yaws/tilts. Constant pixel size (sizeAttenuation off:
    // px = modelScale · scaleNode · F).
    const dolly = pose.focalDistance ?? rig.focalPx / zoom;
    const sky = dolly * STAR_SPHERE_RADIUS;
    this.stars.position.copy(camPos);
    this.stars.scale.setScalar(sky);
    this.starScale.value = 1 / (rig.focalPx * sky);
    this.starTime.value = reducedMotion ? 0 : timeMs;
    // Depth haze toward the background token: the far rim reads hazier.
    this.fog.near = dolly * FOG_NEAR_FRACTION;
    this.fog.far = dolly + FOG_FAR_EXTENTS * Math.max(1, packet.extent);
    this.ringFadeNear.value = dolly;
    this.ringFadeFar.value = dolly + 1.2 * Math.max(1, packet.extent);
    this.plane.scale.setScalar(PLANE_DISC_EXTENTS * Math.max(1, packet.extent));
    this.sunTime.value = reducedMotion ? 0 : timeMs;
    const viewInverse = this.camera.matrixWorldInverse;
    // Sun position for billboard shading (pre-pass; it may sit anywhere).
    let sunX = 0;
    let sunZ = 0;
    for (let i = 0; i < Math.min(packet.keys.length, MAX_BODIES); i++)
      if (packet.bodies[i * BODY_STRIDE + 5] === KIND_SUN) {
        sunX = packet.bodies[i * BODY_STRIDE];
        sunZ = packet.bodies[i * BODY_STRIDE + 1];
        break;
      }

    // Bodies ---------------------------------------------------------------------
    const { keys, bodies } = packet;
    const n = Math.min(keys.length, MAX_BODIES);
    let sphereCount = 0;
    let ringCount = 0;
    let faceCount = 0;
    let focusUsed = 0;
    let flareUsed = 0;
    let sunSeen = false;
    const tileUv = 1 / ATLAS_COLS;
    // Ring density fade (C.5): when orbits pack tighter than ~RING_MIN_SPACING_PX
    // on screen (large System dolly-out), thin and dim the rings so the bodies,
    // not a moiré of strokes, carry the overview.
    let ringN = 0;
    for (let i = 0; i < n; i++)
      if (bodies[i * BODY_STRIDE + 5] === KIND_CONTACT) ringN++;
    const spacingPx = (Math.max(1, packet.extent) / Math.max(1, ringN)) * zoom;
    // D.1: squared ramp — packed orbits (3 px apart at Dense Home) drop to a
    // faint texture so the bodies, not the strokes, carry the overview.
    const ringRamp = Math.min(1, spacingPx / RING_MIN_SPACING_PX);
    const ringDensity = Math.max(RING_DENSITY_FLOOR, ringRamp * ringRamp);
    for (let i = 0; i < n; i++) {
      const o = i * BODY_STRIDE;
      const wx = bodies[o];
      const wz = bodies[o + 1];
      const radius = bodies[o + 2];
      const ringRadius = bodies[o + 3];
      const opacity = bodies[o + 4];
      const kind = bodies[o + 5];
      const lift = bodies[o + 6] ?? 0;
      const flare = bodies[o + 7] ?? 0;
      const key = keys[i];
      const info = this.infos.get(key);
      const visibleRadius =
        radius * (0.35 + 0.65 * Math.sqrt(Math.max(0, opacity)));
      if (kind === KIND_SUN) {
        sunSeen = true;
        this.sun.visible = opacity > 0.01;
        this.sun.position.set(wx, 0, wz);
        this.sun.scale.setScalar(visibleRadius);
        const glowToken =
          info?.glow ?? this.colors.starPalette[0] ?? this.colors.accent;
        this.sunMat.color.copy(color(glowToken));
        this.sunRim.value.copy(color(glowToken));
        this.glowMat.color.copy(color(glowToken));
        const pulse = reducedMotion ? 0 : Math.sin(timeMs * SUN_PULSE_SPEED);
        this.glow.visible = opacity > 0.01;
        this.glow.position.set(wx, 0, wz);
        this.glow.scale.setScalar(radius * SUN_GLOW_SCALE * (1 + 0.08 * pulse));
        this.glowMat.opacity = opacity * (0.55 + 0.15 * pulse);
        this.coronaMat.color.copy(color(glowToken));
        this.corona.visible = this.glow.visible;
        this.corona.position.set(wx, 0, wz);
        this.corona.scale.setScalar(radius * SUN_CORONA_SCALE);
        this.coronaMat.opacity = opacity * SUN_CORONA_OPACITY;
        this.keyLight.position.set(wx, radius * 0.4, wz);
        this.keyLight.color
          .copy(color(glowToken))
          .lerp(color(this.colors.textPrimary), 0.5);
      } else if (opacity > 0.01) {
        tmpMatrix.compose(
          tmpVec.set(wx, lift, wz),
          tmpQuat.identity(),
          tmpScale.setScalar(visibleRadius),
        );
        this.spheres.setMatrixAt(sphereCount, tmpMatrix);
        const fill =
          kind === KIND_SATELLITE
            ? this.colors.textSecondary
            : (info?.fill ?? this.colors.border);
        this.spheres.setColorAt(sphereCount, tmpColor.copy(color(fill)));
        sphereCount++;
      }
      // Ring (one instance per contact orbit) -----------------------------------
      if (
        kind === KIND_CONTACT &&
        info?.ring &&
        ringRadius > 0 &&
        opacity > 0.01
      ) {
        const style = info.ring;
        const c = color(style.color);
        const styleOpacity =
          style.opacity *
          (style.strokeStyle === "faded"
            ? 0.7
            : style.strokeStyle === "faintTrace"
              ? 0.3
              : 1);
        this.ringRadius.setX(ringCount, ringRadius);
        this.ringColor.setXYZW(
          ringCount,
          c.r,
          c.g,
          c.b,
          Math.min(
            1,
            styleOpacity *
              opacity *
              ringDensity *
              (1 + FLARE_RING_ALPHA_GAIN * flare),
          ),
        );
        this.ringStyle.setXY(
          ringCount,
          style.strokeStyle === "dashed" || style.strokeStyle === "faintTrace"
            ? 1
            : 0,
          Math.max(1, style.width * ringDensity) *
            (1 + FLARE_RING_WIDTH_GAIN * flare),
        );
        ringCount++;
      }
      // Face disc (sits on the sphere's camera-facing surface) ------------------
      const slot = this.slotByKey.get(key);
      if (slot !== undefined && kind !== KIND_SATELLITE && opacity > 0.01) {
        const dir = tmpScale
          .set(camPos.x - wx, camPos.y - lift, camPos.z - wz)
          .normalize();
        const out = visibleRadius * 1.02;
        this.facePos.setXYZ(
          faceCount,
          wx + dir.x * out,
          lift + dir.y * out,
          wz + dir.z * out,
        );
        this.faceScale.setX(
          faceCount,
          visibleRadius *
            2 *
            (kind === KIND_SUN ? SUN_FACE_FRACTION : FACE_FRACTION),
        );
        this.faceUv.setXY(
          faceCount,
          (slot % ATLAS_COLS) * tileUv,
          Math.floor(slot / ATLAS_COLS) * tileUv,
        );
        this.faceOpacity.setX(faceCount, Math.min(1, opacity));
        if (kind === KIND_SUN) this.faceSun.setXYZ(faceCount, 0, 0, 1.25);
        else {
          const sv = tmpSun
            .set(sunX - wx, 0, sunZ - wz)
            .normalize()
            .transformDirection(viewInverse);
          this.faceSun.setXYZ(faceCount, sv.x, sv.y, sv.z);
        }
        faceCount++;
      }
      // Focus ring ----------------------------------------------------------------
      const bodyId = idFromKey(key);
      if (
        bodyId !== null &&
        this.focused.has(bodyId) &&
        focusUsed < this.focusPool.length
      ) {
        const s = this.focusPool[focusUsed++];
        s.visible = true;
        s.position.set(wx, lift, wz);
        s.scale.setScalar((radius + FOCUS_RING_GAP_PX / zoom) * 2.25);
      }
      // Capture flare: a brief additive accent halo as the body locks into orbit.
      if (flare > 0.02 && flareUsed < this.flarePool.length) {
        const f = this.flarePool[flareUsed++];
        f.visible = true;
        f.position.set(wx, lift, wz);
        f.scale.setScalar(radius * FLARE_HALO_SCALE * (0.6 + 0.4 * flare));
      }
    }
    for (let i = flareUsed; i < this.flarePool.length; i++)
      this.flarePool[i].visible = false;
    this.flareMat.opacity = 0.45;
    if (!sunSeen) {
      this.sun.visible = false;
      this.glow.visible = false;
      this.corona.visible = false;
    }
    for (let i = focusUsed; i < this.focusPool.length; i++)
      this.focusPool[i].visible = false;
    this.spheres.count = sphereCount;
    this.stats.spheres = sphereCount;
    this.spheres.instanceMatrix.needsUpdate = true;
    if (this.spheres.instanceColor)
      this.spheres.instanceColor.needsUpdate = true;
    this.faces.count = faceCount;
    this.ringMesh.count = ringCount;
    for (const a of [this.ringRadius, this.ringColor, this.ringStyle])
      a.needsUpdate = true;
    this.ringWorldPerPx.value = 1 / zoom;
    this.ringDashWorld.value = RING_DASH_PX / zoom;
    for (const a of [
      this.facePos,
      this.faceScale,
      this.faceUv,
      this.faceOpacity,
      this.faceSun,
    ])
      a.needsUpdate = true;
    this.polaris.position.set(0, 0, -Math.max(32, 0.85 * packet.extent));
    this.polaris.scale.setScalar(POLARIS_WORLD / Math.max(0.5, zoom));

    // Atlas upload (coalesced) ----------------------------------------------------
    if (
      this.atlasDirty &&
      timeMs - this.atlasUploadedAt >= ATLAS_UPLOAD_INTERVAL
    ) {
      if (this.atlas.flush()) {
        this.atlasTex.needsUpdate = true;
        this.stats.atlasFlushes++;
      }
      this.atlasDirty = false;
      this.atlasUploadedAt = timeMs;
    }

    // Labels (screen-space, exact allocation rects) -------------------------------
    this.ortho.left = 0;
    this.ortho.right = W;
    this.ortho.top = 0;
    this.ortho.bottom = -H;
    this.ortho.updateProjectionMatrix();
    const live = new Set<string>();
    for (const label of packet.labels) {
      this.placeLabel(label.id, false, label.x, label.y, label.o, live);
      if (label.cx !== undefined && label.cy !== undefined)
        this.placeLabel(label.id, true, label.cx, label.cy, label.o, live);
    }
    for (const [id, entry] of this.labels) {
      if (!live.has(id)) entry.mesh.visible = false;
    }
    this.trimLabels();
    this.stats.labelsLive = this.labels.size;

    // Draw -----------------------------------------------------------------------
    const tDraw = performance.now();
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.render(this.overlay, this.ortho);
    this.stats.drawMs += performance.now() - tDraw;
    const info = this.renderer.info.render;
    this.stats.calls =
      info.drawCalls ?? (info as { calls?: number }).calls ?? 0;
    this.stats.triangles = info.triangles ?? 0;
    return performance.now() - t0;
  }

  private placeLabel(
    id: string,
    context: boolean,
    x: number,
    y: number,
    opacity: number,
    live: Set<string>,
  ) {
    const cacheId = context ? `${id}#ctx` : id;
    let entry = this.labels.get(cacheId);
    if (!entry) {
      const text = this.labelTexts.get(id);
      const prepared = context ? text?.context : text?.text;
      if (!prepared) return;
      const img = rasterizeLabel(prepared, this.colors.surface, this.dpr);
      if (!img) return;
      this.stats.labelRasters++;
      const tex = dataTexture(img);
      const material = new THREE.MeshBasicNodeMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      material.colorNode = texture(tex, vec2(uv().x, uv().y.oneMinus()));
      const mesh = new THREE.Mesh(this.labelGeo, material);
      this.overlay.add(mesh);
      entry = {
        mesh,
        material,
        tex,
        w: prepared.width,
        h: prepared.height,
        lastUsed: 0,
      };
      this.labels.set(cacheId, entry);
    }
    entry.lastUsed = this.frameCount;
    entry.mesh.visible = opacity > 0.01;
    entry.material.opacity = opacity;
    entry.mesh.position.set(x + entry.w / 2, -(y + entry.h / 2), 0);
    entry.mesh.scale.set(entry.w, entry.h, 1);
    live.add(cacheId);
  }

  private trimLabels() {
    if (this.labels.size <= LABEL_CACHE_MAX) return;
    const victims = [...this.labels.entries()]
      .filter(([, e]) => !e.mesh.visible)
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed)
      .slice(0, this.labels.size - LABEL_CACHE_MAX);
    for (const [id, entry] of victims) this.dropLabel(id, entry);
  }

  private dropLabel(id: string, entry: LabelEntry) {
    this.overlay.remove(entry.mesh);
    entry.material.dispose();
    entry.tex.dispose();
    this.labels.delete(id);
  }

  /** Release every GPU/CPU resource this scene created. */
  dispose() {
    this.plane.geometry.dispose();
    this.planeMat.dispose();
    if (this.disposed) return;
    this.disposed = true;
    for (const [id, entry] of this.labels) this.dropLabel(id, entry);
    this.ringMesh.geometry.dispose();
    this.ringMat.dispose();
    this.ringMesh.dispose();
    this.sphereGeo.dispose();
    this.sphereMat.dispose();
    this.sunMat.dispose();
    this.spheres.dispose();
    (this.faces.material as THREE.Material).dispose();
    (this.stars.material as THREE.Material).dispose();
    this.glowMat.dispose();
    this.coronaMat.dispose();
    this.polarisMat.dispose();
    this.focusMat.dispose();
    this.flareMat.dispose();
    this.labelGeo.dispose();
    this.atlasTex.dispose();
    this.glowTex.dispose();
    this.starTex.dispose();
    this.ringTex.dispose();
    this.planeTex.dispose();
    this.noiseTex.dispose();
    this.atlas.dispose();
    // D.6 follow-up: the post-gc() external floor still rose ~70 MB per mount,
    // i.e. something keeps this scene reachable after unmount (retainer not
    // identified in the time box). Drop the large CPU-side buffers so a
    // retained scene costs bytes, not the 26 MB atlas + texture copies.
    for (const tex of [
      this.atlasTex,
      this.glowTex,
      this.starTex,
      this.ringTex,
      this.planeTex,
      this.noiseTex,
    ])
      (tex as { image: unknown }).image = null;
    this.atlas.releasePixels();
    this.labelTexts = new Map();
    this.infos = new Map();
    this.packet = null;
  }
}

function repeatTexture(tex: THREE.DataTexture): THREE.DataTexture {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** Static instanced attribute, flagged once so the backend uploads it. */
function staticAttr(array: Float32Array, size: number) {
  const attr = new THREE.InstancedBufferAttribute(array, size);
  attr.needsUpdate = true;
  return attr;
}

function seeded(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** `contact:12` / `sun:0` → 12 / 0; satellites → null. */
function idFromKey(key: string): number | null {
  const colon = key.indexOf(":");
  if (key.startsWith("satellite")) return null;
  const id = Number(key.slice(colon + 1));
  return Number.isFinite(id) ? id : null;
}
