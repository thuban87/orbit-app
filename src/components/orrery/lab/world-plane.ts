/**
 * ORRERY LAB A — the world plane ("astrolabe") drawn as ONE imperative Skia
 * picture per frame.
 *
 * PASS 2 — geometry is authored in WORLD coordinates and projected to SCREEN
 * space on the CPU with the camera's exact planar homography
 * (`planeHomography`, SUBSYSTEM-BRIEF §2.5); the picture itself is recorded
 * with an identity canvas matrix. Device profiling on the Pixel 6 Pro
 * (production-mode JS, idle ambient frames replay this picture) found:
 *   - pass 1's `canvas.concat(H)` strokes/dashes under perspective have no
 *     GPU path in Ganesh → CPU path masks + texture uploads every frame;
 *   - ellipse ops (`drawOval`) draw bounding QUADS → ~80 near-screen-sized
 *     quads per frame made the plane fragment-bound;
 *   - 4-stop sweep gradients per ring and dash path effects were the rest.
 * So every stroke here is a CLOSED CONVEX POLYGON (a projected circle) with
 * no path effect — Ganesh's convex-stroke renderer, tight geometry — and all
 * ring styling (far→near depth ramp, status segment ramp, dash channel,
 * ink-in reveal) is one analytic runtime shader (`RING_SKSL`). Lines are
 * `drawLine` (AA rect op); fills (pool, shadows, haze) are convex.
 *
 *   - The frame's own `ringPath` (128 projected points per contact ring) IS
 *     the ring polygon — no extra projection for rings.
 *   - Widths are screen px (the canonical 2/3/4 width channel × scale).
 *
 * CAMERA PERF PASS (supersedes the CPU projection above where the world
 * resources exist — `PlaneShapes` + RING_WORLD_SKSL/GRID_SKSL): the plane's
 * static geometry is cached ONCE in world/unit coordinates and drawn under
 * the exact homography (canvas.concat(H·T·S)); a camera move costs a matrix
 * per element instead of re-projecting polygons in JS and re-tessellating
 * strokes in Ganesh every frame. Pass 1's dead end (strokes under a
 * perspective CTM fall to CPU path masks) is avoided because nothing is
 * STROKED in world space: rings are cached unit annulus strips and the grid
 * is one unit disc (`drawVertices` → plain GPU triangles under perspective),
 * and the stroke itself is analytic in the shader — screen-dp width from the
 * Jacobian of H, 1-device-px AA. Pool and haze are gradients on the same
 * disc. The screen-space path below remains the fallback (no Skia vertices /
 * shader compile failure) and is what the unit tests' mocks exercise.
 *
 * Draw order (bottom → top): sun-lit pool · reference grid + bezel · contact
 * shadows (tilt-gated) · ring hairlines + status segments · moon orbit
 * hairlines · depth haze · switch FX (motion trails, ink-in glints, capture
 * ripples). Bodies, labels and HUD draw above this layer elsewhere.
 *
 * Status language preserved exactly from `orreryRingStyle`: colour, the
 * 2/3/4 px width channel, solid/dashed/faded/faint-trace, and the
 * faded 0.7 / faint-trace 0.3 / neutral 0.5 alpha factors.
 *
 * READ-ONLY: consumes `frame` and `SwitchFx`; never writes to either. The
 * optional `trails` object is this layer's OWN UI-thread scratch state (the
 * motion-blur history), mutated in place.
 */
import type {
  SkCanvas,
  SkPaint,
  SkPath,
  SkPoint,
  SkRuntimeEffect,
  SkVertices,
} from "@shopify/react-native-skia";
import { Skia } from "@shopify/react-native-skia";
import { MAX_TILT, RING_SEGMENTS } from "@/logic/orrery-camera-logic";
import { type AnimatedFrame, bodyKey } from "@/logic/orrery-frame";
import type { StrokeStyle } from "@/logic/orrery-ring-logic";
import {
  BEZEL_SPIN,
  FOCUS_RING_ALPHA,
  FOCUS_RING_DIM,
  FOCUS_RING_WIDTH,
  GHOST_BODY_TINT,
  GHOST_FILL_ALPHA,
  GHOST_LINE_ALPHA,
  GHOST_LINE_DP,
  GHOST_LINE_TINT,
  GHOST_RING_ALPHA,
  GRID_ALPHA_INNER_DARK,
  GRID_ALPHA_INNER_LIGHT,
  GRID_ALPHA_OUTER_DARK,
  GRID_ALPHA_OUTER_LIGHT,
  GRID_BEZEL_ALPHA_DARK,
  GRID_BEZEL_ALPHA_LIGHT,
  GRID_DENSITY_FLOOR,
  GRID_DENSITY_REF,
  GRID_FX_GAIN,
  GRID_REACH,
  GRID_RING_STEP,
  GRID_SPOKE_DEGREES,
  GRID_STROKE_PX,
  GRID_TICK_DEGREES,
  GRID_TICK_MAJOR,
  GRID_TICK_MINOR,
  HAZE_ALPHA_DARK,
  HAZE_ALPHA_LIGHT,
  INK_GLINT_ALPHA,
  INK_GLINT_R,
  INK_IN_SPREAD,
  LIT_POOL_ALPHA_DARK,
  LIT_POOL_ALPHA_LIGHT,
  LIT_POOL_REACH,
  MOON_ORBIT_ALPHA,
  PLANE_CIRCLE_SEGMENTS,
  PULSE_ALPHA,
  PULSE_REACH,
  PULSE_START,
  RING_DASH,
  RING_FAR_ALPHA,
  RING_HAIR_ALPHA_DARK,
  RING_HAIR_ALPHA_LIGHT,
  RING_HAIR_SCALE,
  RING_NEAR_TINT,
  RING_SPARSE_BOOST,
  RING_SPARSE_COUNT,
  RING_TINT_DARK,
  RING_TINT_LIGHT,
  SEGMENT_ALPHA_DARK,
  SEGMENT_ALPHA_LIGHT,
  SEGMENT_LEAD,
  SEGMENT_SCALE,
  SEGMENT_TRAIL,
  SETTLE_PULSE_START,
  SHADOW_ALPHA_DARK,
  SHADOW_ALPHA_LIGHT,
  SHADOW_LENGTH,
  SHADOW_OFFSET,
  SHADOW_TILT_FULL,
  SHADOW_WIDTH,
  TRAIL_ALPHA_DARK,
  TRAIL_ALPHA_LIGHT,
  TRAIL_INNER_FLOOR,
  TRAIL_INNER_REF,
  TRAIL_LEAVING_MS,
  TRAIL_MAX_ARC,
  TRAIL_MS,
  TRAIL_WIDTH,
} from "./deep-field-config";
import { type DeepFieldInk, type Rgba, withAlpha } from "./deep-field-ink";
import {
  bodyVisualScale,
  FX_ROLE_ANCHOR,
  FX_ROLE_ENTERING,
  FX_ROLE_LEAVING,
  invertHomography,
  mapHomography,
  planeHomography,
  type SwitchFx,
} from "./deep-field-math";

/** Skia enum values used imperatively (verified against skia/types). */
const STYLE_FILL = 0;
const STYLE_STROKE = 1;
const CAP_BUTT = 0;
const TILE_CLAMP = 0;
const BLEND_SRC_OVER = 3;
const BLEND_PLUS = 12;
const BLEND_MULTIPLY = 24;
/** drawVertices blend (ignored: the bands carry no per-vertex colours). */
const BLEND_DST = 2;
const MODE_TRIANGLE_STRIP = 1;
const MODE_TRIANGLE_FAN = 2;
const TAU = Math.PI * 2;
const DEG = 180 / Math.PI;

/** Plain, shareable per-contact ring spec (built on the JS thread). */
export interface PlaneRing {
  key: string;
  color: Rgba;
  width: number;
  strokeStyle: StrokeStyle;
  /** `orreryRingStyle().opacity` (0.5 for never-contacted). */
  opacity: number;
  /** False for never-contacted (no interval progress → no trail). */
  progress: boolean;
}

/** UI-thread motion-blur history: key → [x, y, t, x, y, t, …] (screen). */
export interface TrailState {
  pts: Record<string, number[]>;
}

/**
 * CAMERA PERF PASS — world-space unit polygons, built ONCE on the JS thread
 * (`makePlaneShapes`). Vertex i of the n-gon is (sin a, −cos a), a = i·τ/n —
 * exactly the vertex set `circlePoly` / the frame's `ringPath` project — so a
 * circle (cx, cy, r) on the plane is `unit(n)` under H·T(cx,cy)·S(r), mapped
 * NATIVELY by `PathBuilder.addPath(unit, M)` (one call) instead of n JS
 * projections + an n-object JSI array conversion per circle per frame.
 */
export interface PlaneShapes {
  circles: Readonly<Record<number, SkPath>>;
  /** Unit annulus strips 1 ± BAND_EPS[k] (ring geometry, see ringBand). */
  bands: readonly SkVertices[] | null;
  /** Unit disc fan (rim pushed out to contain the true circle). */
  disc: SkVertices | null;
}

export interface PlaneInput {
  frame: AnimatedFrame;
  rings: readonly PlaneRing[];
  fx: SwitchFx;
  ink: DeepFieldInk;
  extent: number;
  /** Pass 2: this layer's own mutable trail history (optional). */
  trails?: TrailState;
  /** Pass 2: timestamp (ms) for the trail history. */
  now?: number;
  /** Pass 2: compiled RING_SKSL (null → plain-ink fallback, no ramps). */
  ringEffect?: SkRuntimeEffect | null;
  /** Pass 3: focused body keys + 0..1 emphasis (focused ring lit along its
   *  whole length, other rings dim). Absent → no emphasis. */
  focus?: PlaneFocus;
  /** Camera perf pass: cached world unit polygons (absent → JS projection). */
  shapes?: PlaneShapes | null;
  /** Camera perf pass: compiled RING_WORLD_SKSL (null → screen-space rings). */
  ringWorldEffect?: SkRuntimeEffect | null;
  /** Camera perf pass: compiled GRID_SKSL (null → screen-space grid). */
  gridEffect?: SkRuntimeEffect | null;
  /** Device pixels per dp (the AA feather of the analytic strokes). */
  pixelRatio?: number;
}

export interface PlaneFocus {
  keys: Readonly<Record<string, boolean>>;
  mix: number;
}

/** Canonical status alpha factor (mirrors the pre-Lab ProjectedOrbitRing). */
export function ringStatusAlpha(ring: PlaneRing): number {
  "worklet";
  if (ring.strokeStyle === "faded") return 0.7;
  if (ring.strokeStyle === "faintTrace") return 0.3;
  return ring.opacity;
}

/** Dashed line treatment for wobble + rogue (the CVD-redundant channel). */
export function ringIsDashed(ring: PlaneRing): boolean {
  "worklet";
  return ring.strokeStyle === "dashed" || ring.strokeStyle === "faintTrace";
}

function makePaint(style: number, blend: number): SkPaint {
  "worklet";
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(style);
  paint.setBlendMode(blend);
  return paint;
}

function normalAngle(angle: number): number {
  "worklet";
  const a = angle % TAU;
  return a < 0 ? a + TAU : a;
}

function clamp01(v: number): number {
  "worklet";
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}

/** Linear mix of two token inks (a → b by t), alpha 1. */
function mixInk(a: Rgba, b: Rgba, t: number): Rgba {
  "worklet";
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    1,
  ];
}

/**
 * The local AFFINE approximation of H around world point (px, py), as a 3×3
 * mapping WORLD coordinates near that point to screen (exact at the point,
 * first-order around it). Ganesh draws fills under it on the GPU.
 */
function affineAt(H: readonly number[], px: number, py: number): number[] {
  "worklet";
  const s = mapHomography(H, px, py);
  const w = Math.abs(s.w) < 1e-9 ? 1e-9 : s.w;
  const a = (H[0] - s.x * H[6]) / w;
  const b = (H[1] - s.x * H[7]) / w;
  const c = (H[3] - s.y * H[6]) / w;
  const d = (H[4] - s.y * H[7]) / w;
  return [a, b, s.x - a * px - b * py, c, d, s.y - c * px - d * py, 0, 0, 1];
}

/** Screen-angle (0 = up, clockwise) of (x, y) around (cx, cy). */
function screenAngle(cx: number, cy: number, x: number, y: number): number {
  "worklet";
  return normalAngle(Math.atan2(x - cx, -(y - cy)));
}

/** World circle (cx, cy, r) → its projected closed polygon (screen). */
function circlePoly(
  H: readonly number[],
  cx: number,
  cy: number,
  r: number,
  segments: number,
): SkPoint[] {
  "worklet";
  const out: SkPoint[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i * TAU) / segments;
    const p = mapHomography(H, cx + r * Math.sin(a), cy - r * Math.cos(a));
    out.push({ x: p.x, y: p.y });
  }
  return out;
}

/** Closed polygon path (convex for a projected circle → GPU stroke/fill). */
function polygon(points: readonly SkPoint[]) {
  "worklet";
  const b = Skia.PathBuilder.Make();
  b.addPoly(points as SkPoint[], true);
  b.setIsVolatile(true);
  return b.build();
}

/** Ring band strips: segments, and the geometric ladder of half-widths
 *  (fraction of R; ×1.25 per step → ≤ 25 % fragment waste per ring). */
const BAND_SEGMENTS = 128;
export const BAND_EPS: readonly number[] = Array.from(
  { length: 30 },
  (_, k) => 0.001 * 1.25 ** k,
);
const BAND_MARGIN = 1.1;

/** Segment counts of the cached unit polygons (see PlaneShapes). */
export const PLANE_SHAPE_SEGMENTS = [
  40,
  48,
  64,
  PLANE_CIRCLE_SEGMENTS,
  RING_SEGMENTS,
  PLANE_CIRCLE_SEGMENTS * 2,
] as const;

/** JS thread, once: the unit polygons (null when Skia is unavailable). */
export function makePlaneShapes(): PlaneShapes | null {
  const make = Skia?.PathBuilder?.Make;
  if (typeof make !== "function") return null;
  const circles: Record<number, SkPath> = {};
  for (const n of PLANE_SHAPE_SEGMENTS) {
    const points: SkPoint[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i * TAU) / n;
      points.push({ x: Math.sin(a), y: -Math.cos(a) });
    }
    circles[n] = make().addPoly(points, true).build();
  }
  let bands: SkVertices[] | null = null;
  if (typeof Skia.MakeVertices === "function") {
    // Outer edge pushed out by 1/cos(π/n) so the polygonal strip CONTAINS
    // the true circle band (the shader computes exact circle distance).
    const n = BAND_SEGMENTS;
    const grow = 1 / Math.cos(Math.PI / n);
    bands = BAND_EPS.map((eps) => {
      const strip: SkPoint[] = [];
      for (let i = 0; i <= n; i++) {
        const a = (i * TAU) / n;
        const s = Math.sin(a);
        const c = -Math.cos(a);
        const inner = Math.max(0, 1 - eps);
        const outer = (1 + eps) * grow;
        strip.push(
          { x: s * inner, y: c * inner },
          { x: s * outer, y: c * outer },
        );
      }
      return Skia.MakeVertices(MODE_TRIANGLE_STRIP, strip);
    });
  }
  let disc: SkVertices | null = null;
  if (typeof Skia.MakeVertices === "function") {
    const n = BAND_SEGMENTS;
    const grow = 1 / Math.cos(Math.PI / n);
    const fan: SkPoint[] = [{ x: 0, y: 0 }];
    for (let i = 0; i <= n; i++) {
      const a = (i * TAU) / n;
      fan.push({ x: Math.sin(a) * grow, y: -Math.cos(a) * grow });
    }
    disc = Skia.MakeVertices(MODE_TRIANGLE_FAN, fan);
  }
  return { circles, bands, disc };
}

/**
 * Smallest screen-dp-per-world-unit RADIAL scale of the projection around
 * the ring of radius R (sampled; the strip's half-width must cover the
 * widest stroke + AA where the plane is most compressed).
 */
export function minRadialScale(H: readonly number[], R: number): number {
  "worklet";
  // 8 samples: within ~3.5 % of the true minimum on legal poses (pinned in
  // world-plane-camera.test); BAND_MARGIN covers the rest.
  let low = Infinity;
  for (let i = 0; i < 8; i++) {
    const a = (i * TAU) / 8;
    const dx = Math.sin(a);
    const dy = -Math.cos(a);
    const px = R * dx;
    const py = R * dy;
    const w = H[6] * px + H[7] * py + H[8];
    const sx = (H[0] * px + H[1] * py + H[2]) / w;
    const sy = (H[3] * px + H[4] * py + H[5]) / w;
    const hd = H[6] * dx + H[7] * dy;
    const jx = (H[0] * dx + H[1] * dy - sx * hd) / w;
    const jy = (H[3] * dx + H[4] * dy - sy * hd) / w;
    low = Math.min(low, Math.hypot(jx, jy));
  }
  return low;
}

/** Index of the narrowest cached band containing the ring's strokes + AA
 *  (−1 → none wide enough: use the screen-space fallback). */
export function ringBand(
  shapes: PlaneShapes | null | undefined,
  H: readonly number[],
  R: number,
  hairWidth: number,
  statusWidth: number,
): number {
  "worklet";
  if (!shapes?.bands || !(R > 0)) return -1;
  const scale = minRadialScale(H, R);
  if (!(scale > 0)) return -1;
  // Widest stroke (focused hairline or segment) + AA, with sampling margin.
  const half = Math.max(hairWidth, statusWidth * SEGMENT_SCALE) / 2 + 2;
  const eps = (half / scale / R) * BAND_MARGIN;
  for (let k = 0; k < BAND_EPS.length; k++) if (BAND_EPS[k] >= eps) return k;
  return -1;
}

/** Perimeter of a closed polygon (screen px). */
function perimeter(points: readonly SkPoint[]): number {
  "worklet";
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/**
 * Screen perimeter of the projected ring (dash count): the frame's ringPath
 * when it carries one, else a 32-gon projected here (the Lab frame omits
 * ring polygons — camera perf pass; the 32-gon is within 0.2 % of the
 * 128-gon, so the dash count only differs right at a rounding boundary).
 */
export function ringPerimeter(
  H: readonly number[],
  R: number,
  ringPath: readonly SkPoint[],
): number {
  "worklet";
  if (ringPath.length >= 3) return perimeter(ringPath);
  let total = 0;
  let px = 0;
  let py = 0;
  for (let i = 0; i <= 32; i++) {
    const a = (i * TAU) / 32;
    const p = mapHomography(H, R * Math.sin(a), -R * Math.cos(a));
    if (i > 0) total += Math.hypot(p.x - px, p.y - py);
    px = p.x;
    py = p.y;
  }
  return total;
}

/** RING_WORLD_SKSL uniforms, declaration order (36 floats). */
export function ringWorldUniforms(
  H: readonly number[],
  R: number,
  aa: number,
  dashes: number,
  reveal: number,
  nearX: number,
  nearY: number,
  farA: number,
  hairHalf: number,
  hairA: number,
  inkFar: Rgba,
  inkNear: Rgba,
  segHalf: number,
  segA: number,
  start: number,
  body: number,
  span: number,
  directional: boolean,
  segInk: Rgba,
): number[] {
  "worklet";
  return [
    H[0],
    H[1],
    H[2],
    H[3],
    H[4],
    H[5],
    H[6],
    H[7],
    H[8],
    R,
    aa,
    dashes,
    reveal,
    nearX,
    nearY,
    farA,
    hairHalf,
    hairA,
    inkFar[0],
    inkFar[1],
    inkFar[2],
    1,
    inkNear[0],
    inkNear[1],
    inkNear[2],
    1,
    segHalf,
    segA,
    start,
    body,
    span,
    directional ? 1 : 0,
    segInk[0],
    segInk[1],
    segInk[2],
    1,
  ];
}

/** H · T(cx, cy) · S(r): the unit polygon → the projected world circle. */
export function circleMatrix(
  H: readonly number[],
  cx: number,
  cy: number,
  r: number,
): number[] {
  "worklet";
  return [
    H[0] * r,
    H[1] * r,
    H[0] * cx + H[1] * cy + H[2],
    H[3] * r,
    H[4] * r,
    H[3] * cx + H[4] * cy + H[5],
    H[6] * r,
    H[7] * r,
    H[6] * cx + H[7] * cy + H[8],
  ];
}

/**
 * The projected world circle as a closed convex screen polygon: natively
 * mapped from the cached unit n-gon when available, else projected in JS.
 */
function worldCircle(
  H: readonly number[],
  shapes: PlaneShapes | null | undefined,
  cx: number,
  cy: number,
  r: number,
  segments: number,
) {
  "worklet";
  const unit = shapes?.circles[segments];
  if (!unit) return polygon(circlePoly(H, cx, cy, r, segments));
  const b = Skia.PathBuilder.Make();
  b.addPath(unit, circleMatrix(H, cx, cy, r) as never);
  b.setIsVolatile(true);
  return b.build();
}

/** GRID_SKSL uniforms, declaration order (26 floats). */
export function gridUniforms(
  H: readonly number[],
  S: number,
  aa: number,
  reach: number,
  inner: number,
  outer: number,
  bezel: number,
  spin: number,
  ink: Rgba,
): number[] {
  "worklet";
  return [
    H[0],
    H[1],
    H[2],
    H[3],
    H[4],
    H[5],
    H[6],
    H[7],
    H[8],
    S,
    aa,
    GRID_STROKE_PX / 2,
    reach,
    GRID_RING_STEP,
    inner,
    outer,
    bezel,
    GRID_SPOKE_DEGREES / DEG,
    GRID_TICK_DEGREES / DEG,
    spin,
    GRID_TICK_MINOR,
    GRID_TICK_MAJOR,
    ink[0],
    ink[1],
    ink[2],
    1,
  ];
}

/** Draws the unit disc fan under H·T(cx,cy)·S(r) with `paint`. */
function drawWorldDisc(
  canvas: SkCanvas,
  disc: SkVertices,
  H: readonly number[],
  cx: number,
  cy: number,
  r: number,
  paint: SkPaint,
): void {
  "worklet";
  canvas.save();
  canvas.concat(circleMatrix(H, cx, cy, r) as never);
  canvas.drawVertices(disc, BLEND_DST, paint);
  canvas.restore();
}

function drawGrid(
  canvas: SkCanvas,
  H: readonly number[],
  shapes: PlaneShapes | null | undefined,
  ink: DeepFieldInk,
  reach: number,
  density: number,
  bezelSpin: number,
  gridEffect: SkRuntimeEffect | null,
  aa: number,
): void {
  "worklet";
  const chart = ink.chart;
  const inner =
    (chart ? GRID_ALPHA_INNER_LIGHT : GRID_ALPHA_INNER_DARK) * density;
  const outer =
    (chart ? GRID_ALPHA_OUTER_LIGHT : GRID_ALPHA_OUTER_DARK) * density;
  // CAMERA PERF PASS: one analytic world-space draw (no CPU geometry).
  if (gridEffect && shapes?.disc) {
    const rim = reach + GRID_TICK_MAJOR * 1.1;
    const scale = minRadialScale(H, rim);
    const S = rim + (scale > 0 ? ((GRID_STROKE_PX / 2 + 2) / scale) * 1.1 : 0);
    const paint = makePaint(STYLE_FILL, BLEND_SRC_OVER);
    paint.setShader(
      gridEffect.makeShader(
        gridUniforms(
          H,
          S,
          aa,
          reach,
          inner,
          outer,
          chart ? GRID_BEZEL_ALPHA_LIGHT : GRID_BEZEL_ALPHA_DARK,
          bezelSpin,
          ink.grid,
        ),
      ),
    );
    drawWorldDisc(canvas, shapes.disc, H, 0, 0, S, paint);
    return;
  }
  const paint = makePaint(STYLE_STROKE, BLEND_SRC_OVER);
  paint.setStrokeWidth(GRID_STROKE_PX);
  // Reference circles: alpha fades outward (per circle).
  for (let r = GRID_RING_STEP; r < reach; r += GRID_RING_STEP) {
    const k = clamp01((r / reach - 0.1) / 0.9);
    paint.setColor(
      withAlpha(ink.grid, Math.min(1, inner + (outer - inner) * k)),
    );
    canvas.drawPath(
      worldCircle(H, shapes, 0, 0, r, PLANE_CIRCLE_SEGMENTS),
      paint,
    );
  }
  // Spokes: lines stay lines under H; a linear ramp along each one.
  const spoke = makePaint(STYLE_STROKE, BLEND_SRC_OVER);
  spoke.setStrokeWidth(GRID_STROKE_PX);
  spoke.setStrokeCap(CAP_BUTT);
  for (let deg = 0; deg < 360; deg += GRID_SPOKE_DEGREES) {
    const a = deg / DEG;
    const s = Math.sin(a);
    const c = -Math.cos(a);
    const p0 = mapHomography(
      H,
      s * GRID_RING_STEP * 0.6,
      c * GRID_RING_STEP * 0.6,
    );
    const p1 = mapHomography(H, s * reach, c * reach);
    spoke.setShader(
      Skia.Shader.MakeLinearGradient(
        { x: p0.x, y: p0.y },
        { x: p1.x, y: p1.y },
        [
          withAlpha(ink.grid, Math.min(1, inner)),
          withAlpha(ink.grid, Math.min(1, outer)),
        ],
        null,
        TILE_CLAMP,
      ),
    );
    canvas.drawLine(p0.x, p0.y, p1.x, p1.y, spoke);
  }
  // Astrolabe bezel: double ring + graduated ticks (every 5th is major). The
  // tick ring swings like a dial with the switch spin (0 at rest).
  const bezel = makePaint(STYLE_STROKE, BLEND_SRC_OVER);
  bezel.setStrokeWidth(GRID_STROKE_PX);
  bezel.setStrokeCap(CAP_BUTT);
  bezel.setColor(
    withAlpha(ink.grid, chart ? GRID_BEZEL_ALPHA_LIGHT : GRID_BEZEL_ALPHA_DARK),
  );
  canvas.drawPath(
    worldCircle(H, shapes, 0, 0, reach, PLANE_CIRCLE_SEGMENTS * 2),
    bezel,
  );
  canvas.drawPath(
    worldCircle(
      H,
      shapes,
      0,
      0,
      reach + GRID_TICK_MAJOR * 1.1,
      PLANE_CIRCLE_SEGMENTS * 2,
    ),
    bezel,
  );
  let index = 0;
  for (let deg = 0; deg < 360; deg += GRID_TICK_DEGREES) {
    const a = deg / DEG + bezelSpin;
    const len = index % 5 === 0 ? GRID_TICK_MAJOR : GRID_TICK_MINOR;
    const s = Math.sin(a);
    const c = -Math.cos(a);
    const p0 = mapHomography(H, s * reach, c * reach);
    const p1 = mapHomography(H, s * (reach + len), c * (reach + len));
    canvas.drawLine(p0.x, p0.y, p1.x, p1.y, bezel);
    index++;
  }
}

/** Uniform block for RING_SKSL (declaration order). */
function ringUniforms(
  cx: number,
  cy: number,
  mode: number,
  dashes: number,
  north: number,
  reveal: number,
  far: { x: number; y: number },
  near: { x: number; y: number },
  farA: number,
  start: number,
  body: number,
  span: number,
  directional: boolean,
  inkFar: Rgba,
  inkNear: Rgba,
): number[] {
  "worklet";
  return [
    cx,
    cy,
    mode,
    dashes,
    north,
    reveal,
    far.x,
    far.y,
    near.x,
    near.y,
    farA,
    start,
    body,
    span,
    directional ? 1 : 0,
    inkFar[0],
    inkFar[1],
    inkFar[2],
    1,
    inkNear[0],
    inkNear[1],
    inkNear[2],
    1,
  ];
}

/**
 * Records the whole world plane into `canvas` (a picture recorder canvas).
 * A pure function of its input apart from the optional `trails` scratch
 * history — safe to call from a `useDerivedValue`.
 */
export function drawWorldPlane(canvas: SkCanvas, input: PlaneInput): void {
  "worklet";
  const { frame, rings, fx, ink, extent, trails, shapes } = input;
  const effect = input.ringEffect ?? null;
  const worldEffect = input.ringWorldEffect ?? null;
  const pixel = 1 / Math.max(1, input.pixelRatio ?? 1);
  const now = input.now ?? 0;
  const pose = frame.pose;
  const zoom = pose.zoom > 0 ? pose.zoom : 1;
  const tilt = pose.tilt ?? 0;
  const yaw = pose.yaw ?? 0;
  const chart = ink.chart;
  const H = planeHomography(pose, frame.viewport);
  const Hi = invertHomography(H);
  const reach = Math.max(GRID_RING_STEP * 2, extent * GRID_REACH);
  const velocity = fx.active ? fx.velocity : 0;

  // Index the frame once: key → body index (avoids O(N²) finds).
  const index: Record<string, number> = {};
  const keys: string[] = [];
  let sunX = 0;
  let sunY = 0;
  for (let i = 0; i < frame.bodies.length; i++) {
    const b = frame.bodies[i];
    const k = bodyKey(b);
    keys.push(k);
    index[k] = i;
    if (b.kind === "sun" && b.opacity > 0) {
      const w = mapHomography(Hi, b.x, b.y);
      sunX = w.x;
      sunY = w.y;
    }
  }
  const origin = mapHomography(H, 0, 0);
  // Pass 3: bodies whose React components are mounted = the ring specs (built
  // from the same resource commit as the body components). Entering bodies'
  // frame geometry runs ahead of that commit on a large switch; drawing their
  // shadows (or anything else) before their discs read as "shadow first".
  const mounted: Record<string, boolean> = {};
  let focusHit = false;
  for (let r = 0; r < rings.length; r++) {
    mounted[rings[r].key] = true;
    if (input.focus?.keys[rings[r].key]) focusHit = true;
  }
  const focusMix = focusHit ? clamp01(input.focus?.mix ?? 0) : 0;

  // 1 · Sun-lit pool on the plane (additive glow / multiply ink wash): the
  // exact projected circle, gradient in the local affine frame at the sun.
  const pool = makePaint(STYLE_FILL, chart ? BLEND_MULTIPLY : BLEND_PLUS);
  const poolR = Math.max(GRID_RING_STEP, extent * LIT_POOL_REACH);
  const poolColors = chart
    ? [
        withAlpha(ink.starlight, LIT_POOL_ALPHA_LIGHT),
        withAlpha(ink.background, 0),
      ]
    : [
        withAlpha(ink.starlight, LIT_POOL_ALPHA_DARK),
        withAlpha(ink.starlight, LIT_POOL_ALPHA_DARK * 0.3),
        withAlpha(ink.starlight, 0),
      ];
  const poolStops = chart ? [0, 1] : [0, 0.35, 1];
  if (shapes?.disc) {
    // Camera perf pass: the exact world-space radial pool (unit disc under
    // H·T(sun)·S(poolR); the gradient is in unit coordinates → exact under
    // perspective, no per-frame polygon).
    pool.setShader(
      Skia.Shader.MakeRadialGradient(
        { x: 0, y: 0 },
        1,
        poolColors,
        poolStops,
        TILE_CLAMP,
      ),
    );
    drawWorldDisc(canvas, shapes.disc, H, sunX, sunY, poolR, pool);
  } else {
    pool.setShader(
      Skia.Shader.MakeRadialGradient(
        { x: sunX, y: sunY },
        poolR,
        poolColors,
        poolStops,
        TILE_CLAMP,
        Skia.Matrix(affineAt(H, sunX, sunY)),
      ),
    );
    canvas.drawPath(worldCircle(H, shapes, sunX, sunY, poolR, 64), pool);
  }

  // 2 · Reference grid + bezel. The inner rings/spokes fade as the orbit
  // count rises; the bezel stays. Pass 2: brightens with spin velocity.
  const density =
    Math.max(
      GRID_DENSITY_FLOOR,
      Math.min(1, GRID_DENSITY_REF / Math.max(1, rings.length)),
    ) *
    (1 + GRID_FX_GAIN * velocity);
  drawGrid(
    canvas,
    H,
    shapes,
    ink,
    reach,
    density,
    BEZEL_SPIN * velocity,
    input.gridEffect ?? null,
    pixel,
  );

  // 3 · Contact shadows: cast outward along the plane, away from the sun,
  // drawn in the local affine frame at each shadow (GPU oval fill).
  const shadow = makePaint(STYLE_FILL, chart ? BLEND_MULTIPLY : BLEND_SRC_OVER);
  shadow.setShader(
    Skia.Shader.MakeRadialGradient(
      { x: 0, y: 0 },
      1,
      [
        withAlpha(ink.shadow, 1),
        withAlpha(ink.shadow, 0.55),
        withAlpha(ink.shadow, 0),
      ],
      [0, 0.45, 1],
      TILE_CLAMP,
    ),
  );
  // A cast shadow only reads as one once the plane is tilted.
  const tiltGate = clamp01(tilt / SHADOW_TILT_FULL);
  const shadowGate = tiltGate * tiltGate * (3 - 2 * tiltGate);
  const shadowAlpha =
    (chart ? SHADOW_ALPHA_LIGHT : SHADOW_ALPHA_DARK) * shadowGate;
  for (let i = 0; shadowAlpha > 0.004 && i < frame.bodies.length; i++) {
    const b = frame.bodies[i];
    if (b.kind !== "contact" || b.opacity <= 0 || !b.visible) continue;
    if (!mounted[keys[i]]) continue;
    const w = mapHomography(Hi, b.x, b.y);
    const dx = w.x - sunX;
    const dy = w.y - sunY;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-3) continue;
    // World radius from the projected one: projected = world × zoom / w.
    const worldR = (b.radius * Math.abs(w.w)) / zoom;
    const ux = dx / dist;
    const uy = dy / dist;
    const sx = w.x + ux * worldR * SHADOW_OFFSET;
    const sy = w.y + uy * worldR * SHADOW_OFFSET;
    canvas.save();
    canvas.concat(affineAt(H, sx, sy));
    canvas.translate(sx, sy);
    canvas.rotate(Math.atan2(uy, ux) * DEG, 0, 0);
    canvas.scale(worldR * SHADOW_LENGTH * 0.5, worldR * SHADOW_WIDTH);
    shadow.setAlphaf(shadowAlpha * b.opacity);
    canvas.drawCircle(0, 0, 1, shadow);
    canvas.restore();
  }

  // 4 · Rings: instrument hairline + status segment, both strokes of the
  // ring's projected polygon with RING_SKSL. Hierarchy (pass 1): the full
  // ring is a thin, low-alpha hairline mostly in neutral grid ink with a
  // status TINT; full status colour is concentrated in a tapered segment
  // around the body. Line language (width channel 2/3/4, solid vs dashed,
  // faded / faint-trace alpha) applies to BOTH parts.
  const sinTilt = Math.sin(tilt) / Math.sin(MAX_TILT);
  const farAlpha = 1 - (1 - RING_FAR_ALPHA) * clamp01(sinTilt);
  // Unit vector (world) toward the viewer = gradient of camera-plane depth.
  const nearX = Math.sin(yaw);
  const nearY = Math.cos(yaw);
  const hair = makePaint(STYLE_STROKE, BLEND_SRC_OVER);
  const segment = makePaint(STYLE_STROKE, BLEND_SRC_OVER);
  const bandPaint = makePaint(STYLE_FILL, BLEND_SRC_OVER);
  const tint = chart ? RING_TINT_LIGHT : RING_TINT_DARK;
  // Few orbits → bolder hairlines (they are the only structure).
  const sparse = clamp01(
    (RING_SPARSE_COUNT - rings.length) / (RING_SPARSE_COUNT - 2),
  );
  const hairAlpha =
    (chart ? RING_HAIR_ALPHA_LIGHT : RING_HAIR_ALPHA_DARK) *
    (1 + (RING_SPARSE_BOOST - 1) * sparse);
  const segAlpha = chart ? SEGMENT_ALPHA_LIGHT : SEGMENT_ALPHA_DARK;
  // Ink-in from the sun outward: normalise ring radii over this frame.
  let maxRing = 1;
  for (let r = 0; r < rings.length; r++) {
    const bi = index[rings[r].key];
    if (bi !== undefined)
      maxRing = Math.max(maxRing, frame.bodies[bi].ringRadius);
  }
  const glints: number[] = [];

  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    const bi = index[ring.key];
    if (bi === undefined) continue;
    const body = frame.bodies[bi];
    if (body.opacity <= 0) continue;
    const ringR = body.ringRadius / zoom;
    if (!(ringR > 0) || (!shapes && body.ringPath.length < 3)) continue;
    const role = fx.active && bi < fx.roles.length ? fx.roles[bi] : -1;
    let drawOn = 1;
    if (role === FX_ROLE_ENTERING) {
      const lag = INK_IN_SPREAD * (body.ringRadius / maxRing);
      drawOn = clamp01((fx.stages[bi] - lag) / Math.max(0.05, 1 - lag));
    }
    if (drawOn <= 0) continue;
    const alpha = body.opacity * ringStatusAlpha(ring);
    const dashed = ringIsDashed(ring);
    // Pass 3 focus emphasis: the focused ring's hairline moves to its full
    // status ink (whole ring, same dash/width channel); the rest recede.
    const lit = focusMix > 0 && !!input.focus?.keys[ring.key];
    const litMix = lit ? focusMix : 0;
    const dim = lit ? 1 : 1 - FOCUS_RING_DIM * focusMix;
    const hairColor = mixInk(
      mixInk(ink.grid, ring.color, tint),
      ring.color,
      litMix,
    );
    const nearColor = mixInk(hairColor, ring.color, RING_NEAR_TINT);
    const dashes = dashed
      ? Math.max(
          4,
          Math.round(ringPerimeter(H, ringR, body.ringPath) / (RING_DASH * 2)),
        )
      : 0;
    // Ink-in reveal: clockwise from north (where interval progress starts).
    let north = 0;
    let reveal = TAU + 1;
    if (drawOn < 1) {
      const n = mapHomography(H, 0, -ringR);
      const hw = drawOn * TAU;
      const hp = mapHomography(H, ringR * Math.sin(hw), -ringR * Math.cos(hw));
      north = screenAngle(origin.x, origin.y, n.x, n.y);
      reveal = normalAngle(screenAngle(origin.x, origin.y, hp.x, hp.y) - north);
      glints.push(hp.x, hp.y, alpha * (1 - drawOn * drawOn), r);
    }
    const hairW =
      ring.width *
      (RING_HAIR_SCALE + (FOCUS_RING_WIDTH - RING_HAIR_SCALE) * litMix);
    const hairA = Math.min(
      1,
      alpha * (hairAlpha + (FOCUS_RING_ALPHA - hairAlpha) * litMix) * dim,
    );
    // CAMERA PERF PASS: the world-space path (cached unit band under H·S(R),
    // analytic stroke) — no per-frame polygon, no CPU stroke tessellation.
    const band = worldEffect
      ? ringBand(shapes, H, ringR, hairW, ring.width)
      : -1;
    if (worldEffect && shapes?.bands && band >= 0) {
      let segW = 0;
      let segA = 0;
      let start = 0;
      let bodyRel = 0;
      let span = 0;
      if (drawOn >= 1 && body.kind === "contact") {
        const w = mapHomography(Hi, body.x, body.y);
        const theta = normalAngle(Math.atan2(w.x, -w.y));
        const trail = ring.progress
          ? Math.min(SEGMENT_TRAIL, theta)
          : SEGMENT_LEAD * 1.5;
        const lead = ring.progress ? SEGMENT_LEAD : SEGMENT_LEAD * 1.5;
        if (trail + lead > 0.02) {
          const bx = Math.sin(theta);
          const by = -Math.cos(theta);
          const near = (bx * nearX + by * nearY + 1) / 2;
          const depthA = farAlpha + (1 - farAlpha) * near;
          segW = (ring.width * SEGMENT_SCALE) / 2;
          segA = alpha * segAlpha * depthA * (1 - (1 - dim) * 0.6);
          start = normalAngle(theta - trail);
          bodyRel = trail;
          span = trail + lead;
        }
      }
      bandPaint.setShader(
        worldEffect.makeShader(
          ringWorldUniforms(
            H,
            ringR,
            pixel,
            dashes,
            drawOn < 1 ? drawOn * TAU : TAU + 1,
            nearX,
            nearY,
            farAlpha,
            hairW / 2,
            hairA,
            hairColor,
            nearColor,
            segW,
            segA,
            start,
            bodyRel,
            span,
            ring.progress,
            ring.color,
          ),
        ),
      );
      canvas.save();
      canvas.concat(circleMatrix(H, 0, 0, ringR) as never);
      canvas.drawVertices(shapes.bands[band], BLEND_DST, bandPaint);
      canvas.restore();
      continue;
    }
    const far = mapHomography(H, -nearX * ringR, -nearY * ringR);
    const nearP = mapHomography(H, nearX * ringR, nearY * ringR);
    // The ring polygon = the frame's ringPath (same vertices), mapped natively.
    const ringPoly = shapes
      ? worldCircle(H, shapes, 0, 0, ringR, RING_SEGMENTS)
      : polygon(body.ringPath);
    if (effect) {
      hair.setShader(
        effect.makeShader(
          ringUniforms(
            origin.x,
            origin.y,
            0,
            dashes,
            north,
            reveal,
            far,
            nearP,
            farAlpha,
            0,
            0,
            0,
            false,
            hairColor,
            nearColor,
          ),
        ),
      );
    } else hair.setColor(withAlpha(hairColor, 1));
    // Width channel kept proportional (2/3/4 → 1 : 1.5 : 2), screen px.
    hair.setStrokeWidth(hairW);
    hair.setAlphaf(hairA);
    canvas.drawPath(ringPoly, hair);

    // Body world position → its angle (0 = north, clockwise).
    const w = mapHomography(Hi, body.x, body.y);
    const theta = normalAngle(Math.atan2(w.x, -w.y));
    if (effect && drawOn >= 1 && body.kind === "contact") {
      // Contacted: trail = the last SEGMENT_TRAIL of progress (never past
      // north, where interval progress starts). Never contacted: a short
      // symmetric segment (no progress direction is implied).
      const trail = ring.progress
        ? Math.min(SEGMENT_TRAIL, theta)
        : SEGMENT_LEAD * 1.5;
      const lead = ring.progress ? SEGMENT_LEAD : SEGMENT_LEAD * 1.5;
      if (trail + lead > 0.02) {
        // Depth cue for the segment from the body's side of the ring.
        const bx = Math.sin(theta);
        const by = -Math.cos(theta);
        const near = (bx * nearX + by * nearY + 1) / 2;
        const depthA = farAlpha + (1 - farAlpha) * near;
        const a0 = theta - trail;
        const a1 = theta + lead;
        const p0 = mapHomography(
          H,
          ringR * Math.sin(a0),
          -ringR * Math.cos(a0),
        );
        const p1 = mapHomography(
          H,
          ringR * Math.sin(a1),
          -ringR * Math.cos(a1),
        );
        const sA = screenAngle(origin.x, origin.y, p0.x, p0.y);
        const bA = normalAngle(
          screenAngle(origin.x, origin.y, body.x, body.y) - sA,
        );
        const eA = normalAngle(
          screenAngle(origin.x, origin.y, p1.x, p1.y) - sA,
        );
        // Zero outside the segment: stroking the FULL ring polygon with it
        // draws only the segment (tight convex geometry, no arc path).
        segment.setShader(
          effect.makeShader(
            ringUniforms(
              origin.x,
              origin.y,
              1,
              dashes,
              0,
              TAU + 1,
              far,
              nearP,
              farAlpha,
              sA,
              bA,
              Math.max(bA + 1e-4, eA),
              ring.progress,
              ring.color,
              ring.color,
            ),
          ),
        );
        segment.setStrokeWidth(ring.width * SEGMENT_SCALE);
        segment.setAlphaf(alpha * segAlpha * depthA * (1 - (1 - dim) * 0.6));
        canvas.drawPath(ringPoly, segment);
      }
    }
  }
  // 5 · Moon orbit hairlines: each visible satellite's own small orbit
  // around its parent, on the plane (so it foreshortens with the tilt).
  const moonPaint = makePaint(STYLE_STROKE, BLEND_SRC_OVER);
  moonPaint.setStrokeWidth(GRID_STROKE_PX);
  for (let i = 0; i < frame.bodies.length; i++) {
    const m = frame.bodies[i];
    if (m.kind !== "satellite" || !m.satelliteTarget || m.opacity <= 0)
      continue;
    const pi =
      index[`contact:${m.satelliteTarget.parentId}`] ??
      index[`sun:${m.satelliteTarget.parentId}`];
    if (pi === undefined) continue;
    const parent = frame.bodies[pi];
    const pw = mapHomography(Hi, parent.x, parent.y);
    const mw = mapHomography(Hi, m.x, m.y);
    const mr = Math.hypot(mw.x - pw.x, mw.y - pw.y);
    if (!(mr > 0.5)) continue;
    moonPaint.setColor(
      withAlpha(ink.grid, MOON_ORBIT_ALPHA * m.opacity * parent.opacity),
    );
    canvas.drawPath(worldCircle(H, shapes, pw.x, pw.y, mr, 48), moonPaint);
  }

  // 5b · Pass 3 arrival ghosts: a contact already in the frame (an entering
  // body on a large switch) whose React component has not mounted yet gets a
  // neutral "unresolved" disc at its exact drawn size and position, so the
  // arrival is seen on time; the real body fades in over it when it mounts.
  // Presentation only — not hittable (hit testing never reads this layer).
  const ghostFill = makePaint(STYLE_FILL, BLEND_SRC_OVER);
  const ghostLine = makePaint(STYLE_STROKE, BLEND_SRC_OVER);
  const ghostRing = makePaint(STYLE_STROKE, BLEND_SRC_OVER);
  ghostLine.setStrokeWidth(GHOST_LINE_DP);
  ghostRing.setStrokeWidth(GRID_STROKE_PX * 1.4);
  const ghostBody = mixInk(ink.background, ink.grid, GHOST_BODY_TINT);
  const ghostInk = mixInk(ink.grid, ink.starlight, GHOST_LINE_TINT);
  for (let i = 0; i < frame.bodies.length; i++) {
    const b = frame.bodies[i];
    if (b.kind !== "contact" || b.opacity <= 0 || !b.visible) continue;
    if (mounted[keys[i]]) continue;
    // Its orbit as a neutral hairline (status ink arrives with the mount).
    if (shapes ? b.ringRadius > 0 : b.ringPath.length >= 3) {
      ghostRing.setColor(
        withAlpha(ink.grid, GHOST_RING_ALPHA * hairAlpha * b.opacity),
      );
      canvas.drawPath(
        shapes && b.ringRadius > 0
          ? worldCircle(H, shapes, 0, 0, b.ringRadius / zoom, RING_SEGMENTS)
          : polygon(b.ringPath),
        ghostRing,
      );
    }
    const r = b.radius * bodyVisualScale(b.radius);
    ghostFill.setColor(withAlpha(ghostBody, GHOST_FILL_ALPHA * b.opacity));
    canvas.drawCircle(b.x, b.y, r, ghostFill);
    ghostLine.setColor(withAlpha(ghostInk, GHOST_LINE_ALPHA * b.opacity));
    canvas.drawCircle(b.x, b.y, r, ghostLine);
  }

  // 6 · Depth haze: the far side of the plane recedes toward the background
  // (aerial perspective). Confined to the plane's own footprint.
  if (tiltGate > 0.01) {
    const haze = makePaint(STYLE_FILL, BLEND_SRC_OVER);
    const hA = (chart ? HAZE_ALPHA_LIGHT : HAZE_ALPHA_DARK) * shadowGate;
    const hazeColors = [
      withAlpha(ink.background, hA),
      withAlpha(ink.background, hA * 0.35),
      withAlpha(ink.background, 0),
    ];
    const hazeR = reach + GRID_TICK_MAJOR * 1.6;
    if (shapes?.disc) {
      // Camera perf pass: world-space linear ramp (far rim → sun) on the unit
      // disc (world-linear instead of screen-linear: a documented, visually
      // negligible difference under perspective).
      const k = reach / hazeR;
      haze.setShader(
        Skia.Shader.MakeLinearGradient(
          { x: -nearX * k, y: -nearY * k },
          { x: 0, y: 0 },
          hazeColors,
          [0, 0.45, 1],
          TILE_CLAMP,
        ),
      );
      drawWorldDisc(canvas, shapes.disc, H, 0, 0, hazeR, haze);
    } else {
      const farEdge = mapHomography(H, -nearX * reach, -nearY * reach);
      haze.setShader(
        Skia.Shader.MakeLinearGradient(
          { x: farEdge.x, y: farEdge.y },
          { x: origin.x, y: origin.y },
          hazeColors,
          [0, 0.45, 1],
          TILE_CLAMP,
        ),
      );
      canvas.drawPath(
        worldCircle(H, shapes, 0, 0, hazeR, PLANE_CIRCLE_SEGMENTS),
        haze,
      );
    }
  }

  // 7 · Switch FX (all absent under reduced motion: `fx` is idle then).
  if (trails && !fx.active) trails.pts = {};
  if (!fx.active) return;
  const fxBlend = chart ? BLEND_SRC_OVER : BLEND_PLUS;

  // 7a · Motion-blur trails from each moving body's REAL recent path. The
  // history is kept in WORLD space (re-projected every frame, so camera
  // motion never smears it) and resampled in POLAR form about the sun
  // between samples — the choreography is a spin, so a frame-to-frame chord
  // would read as a polygon at device frame rates. One stroked open arc per
  // body (≤ TRAIL_MAX_ARC → convex → GPU), alpha ramping up to the body.
  if (trails) {
    const trailPaint = makePaint(STYLE_STROKE, fxBlend);
    trailPaint.setStrokeCap(CAP_BUTT);
    const peak = chart ? TRAIL_ALPHA_LIGHT : TRAIL_ALPHA_DARK;
    const next: Record<string, number[]> = {};
    for (let r = 0; r < rings.length; r++) {
      const ring = rings[r];
      const bi = index[ring.key];
      if (bi === undefined) continue;
      const body = frame.bodies[bi];
      const role = bi < fx.roles.length ? fx.roles[bi] : -1;
      if (role === FX_ROLE_ANCHOR || body.opacity <= 0) continue;
      const leaving = role === FX_ROLE_LEAVING;
      const span = leaving ? TRAIL_LEAVING_MS : TRAIL_MS;
      const w = mapHomography(Hi, body.x, body.y);
      const prev = trails.pts[ring.key] ?? [];
      const hist: number[] = [];
      for (let k = 0; k + 2 < prev.length; k += 3)
        if (now - prev[k + 2] <= span && now >= prev[k + 2])
          hist.push(prev[k], prev[k + 1], prev[k + 2]);
      hist.push(w.x, w.y, now);
      next[ring.key] = hist;
      const count = hist.length / 3;
      if (count < 2 || velocity < 0.02) continue;
      // Polar resample (forward = clockwise, the spin direction), capped.
      const pts: { x: number; y: number }[] = [];
      let swept = 0;
      for (let k = count - 1; k > 0 && swept < TRAIL_MAX_ARC; k--) {
        const x1 = hist[k * 3];
        const y1 = hist[k * 3 + 1];
        const x0 = hist[k * 3 - 3];
        const y0 = hist[k * 3 - 2];
        const a1 = Math.atan2(x1, -y1);
        const a0 = Math.atan2(x0, -y0);
        const r1 = Math.hypot(x1, y1);
        const r0 = Math.hypot(x0, y0);
        let da = normalAngle(a1 - a0);
        if (da > Math.PI) da -= TAU;
        const take = Math.min(Math.abs(da), TRAIL_MAX_ARC - swept);
        const frac = Math.abs(da) > 1e-6 ? take / Math.abs(da) : 1;
        const steps = Math.max(1, Math.ceil(take / 0.06));
        for (let j = pts.length === 0 ? 0 : 1; j <= steps; j++) {
          const u = (j / steps) * frac;
          const aa = a1 - da * u;
          const rr = r1 + (r0 - r1) * u;
          const p = mapHomography(H, rr * Math.sin(aa), -rr * Math.cos(aa));
          pts.push({ x: p.x, y: p.y });
        }
        swept += take;
      }
      if (pts.length < 2) continue;
      const head = pts[0];
      const tail = pts[pts.length - 1];
      if (Math.hypot(head.x - tail.x, head.y - tail.y) < 2) continue;
      const path = Skia.PathBuilder.Make();
      path.moveTo(tail.x, tail.y);
      for (let k = pts.length - 2; k >= 0; k--) path.lineTo(pts[k].x, pts[k].y);
      path.setIsVolatile(true);
      const drawn = body.radius * bodyVisualScale(body.radius);
      // Pass 3: inner rings are tightly packed around the sun; a full-width
      // trail there smeared into a solid band. Thin + soften by ring size.
      const inner = Math.max(
        TRAIL_INNER_FLOOR,
        Math.min(
          1,
          Math.hypot(body.x - origin.x, body.y - origin.y) /
            Math.max(1, drawn * TRAIL_INNER_REF),
        ),
      );
      const amp =
        peak *
        body.opacity *
        Math.min(1, velocity * 1.4) *
        (leaving ? 1.25 : 1) *
        (0.45 + 0.55 * inner);
      trailPaint.setShader(
        Skia.Shader.MakeLinearGradient(
          { x: tail.x, y: tail.y },
          { x: head.x, y: head.y },
          [
            withAlpha(ring.color, 0),
            withAlpha(ring.color, amp * 0.35),
            withAlpha(ring.color, amp),
          ],
          [0, 0.55, 1],
          TILE_CLAMP,
        ),
      );
      trailPaint.setStrokeWidth(drawn * TRAIL_WIDTH * inner);
      canvas.drawPath(path.build(), trailPaint);
    }
    trails.pts = next;
  }

  // 7b · Ink-in glints: a bright point at the head of each drawing ring.
  if (glints.length) {
    const glint = makePaint(STYLE_FILL, fxBlend);
    for (let g = 0; g < glints.length; g += 4) {
      const ring = rings[glints[g + 3]];
      const a = clamp01(glints[g + 2]) * INK_GLINT_ALPHA;
      glint.setShader(
        Skia.Shader.MakeRadialGradient(
          { x: glints[g], y: glints[g + 1] },
          INK_GLINT_R * 2.2,
          [
            withAlpha(chart ? ring.color : ink.starlight, a),
            withAlpha(ring.color, a * 0.45),
            withAlpha(ring.color, 0),
          ],
          [0, 0.35, 1],
          TILE_CLAMP,
        ),
      );
      canvas.drawCircle(glints[g], glints[g + 1], INK_GLINT_R * 2.2, glint);
    }
  }

  // 7c · Capture ripples on the plane: entering bodies as they lock into
  // orbit, retained bodies once as the system settles.
  const ripple = makePaint(STYLE_STROKE, fxBlend);
  ripple.setStrokeWidth(1.6);
  const settleT = clamp01(
    (fx.progress - SETTLE_PULSE_START) / (1 - SETTLE_PULSE_START),
  );
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    const bi = index[ring.key];
    if (bi === undefined) continue;
    const body = frame.bodies[bi];
    const role = bi < fx.roles.length ? fx.roles[bi] : -1;
    let t = -1;
    if (role === FX_ROLE_ENTERING)
      t = clamp01((fx.stages[bi] - PULSE_START) / (1 - PULSE_START));
    else if (role !== FX_ROLE_LEAVING && role !== FX_ROLE_ANCHOR && settleT > 0)
      t = settleT;
    if (!(t > 0 && t < 1) || body.opacity <= 0) continue;
    const w = mapHomography(Hi, body.x, body.y);
    const worldR = (body.radius * Math.abs(w.w)) / zoom;
    const fade = (1 - t) * (1 - t);
    ripple.setColor(withAlpha(ring.color, PULSE_ALPHA * fade * body.opacity));
    canvas.drawPath(
      worldCircle(H, shapes, w.x, w.y, worldR * (1.15 + PULSE_REACH * t), 40),
      ripple,
    );
  }
}
