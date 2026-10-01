/**
 * ORRERY LAB A — the world plane ("astrolabe") drawn as ONE imperative Skia
 * picture per frame, entirely in WORLD coordinates under the camera's exact
 * planar homography (`planeHomography`, SUBSYSTEM-BRIEF §2.5).
 *
 * Because everything is a true world-space circle/arc under one 3×3 matrix:
 *   - tilt/yaw foreshorten the grid, rings, trails and shadows for free;
 *   - stroke widths are authored in screen px ÷ zoom, so perspective makes the
 *     far side of every orbit thinner and the near side thicker;
 *   - no per-ring point re-projection is needed (the frame's `ringPath` stays
 *     untouched for the ReorderGhost and any other consumer).
 *
 * Draw order (bottom → top): sun-lit pool · reference grid + bezel · contact
 * shadows (tilt-gated) · ring hairlines · status segments near each body ·
 * switch streaks. Bodies, labels and HUD draw above this layer elsewhere.
 *
 * Status language preserved exactly from `orreryRingStyle`: colour, the
 * 2/3/4 px width channel, solid/dashed/faded/faint-trace, and the
 * faded 0.7 / faint-trace 0.3 / neutral 0.5 alpha factors.
 *
 * READ-ONLY: consumes `frame` and `SwitchFx`; never writes to either.
 */
import type { SkCanvas, SkPaint } from "@shopify/react-native-skia";
import { Skia } from "@shopify/react-native-skia";
import { MAX_TILT } from "@/logic/orrery-camera-logic";
import { type AnimatedFrame, bodyKey } from "@/logic/orrery-frame";
import type { StrokeStyle } from "@/logic/orrery-ring-logic";
import {
  GRID_ALPHA_INNER_DARK,
  GRID_ALPHA_INNER_LIGHT,
  GRID_ALPHA_OUTER_DARK,
  GRID_ALPHA_OUTER_LIGHT,
  GRID_BEZEL_ALPHA_DARK,
  GRID_BEZEL_ALPHA_LIGHT,
  GRID_DENSITY_FLOOR,
  GRID_DENSITY_REF,
  GRID_REACH,
  GRID_RING_STEP,
  GRID_SPOKE_DEGREES,
  GRID_STROKE_PX,
  GRID_TICK_DEGREES,
  GRID_TICK_MAJOR,
  GRID_TICK_MINOR,
  LIT_POOL_ALPHA_DARK,
  LIT_POOL_ALPHA_LIGHT,
  LIT_POOL_REACH,
  RING_DASH,
  RING_FAR_ALPHA,
  RING_HAIR_ALPHA_DARK,
  RING_HAIR_ALPHA_LIGHT,
  RING_HAIR_SCALE,
  RING_SPARSE_BOOST,
  RING_SPARSE_COUNT,
  RING_TINT_DARK,
  RING_TINT_LIGHT,
  SEGMENT_ALPHA_DARK,
  SEGMENT_ALPHA_LIGHT,
  SEGMENT_LEAD,
  SEGMENT_SCALE,
  SEGMENT_TRAIL,
  SHADOW_ALPHA_DARK,
  SHADOW_ALPHA_LIGHT,
  SHADOW_LENGTH,
  SHADOW_OFFSET,
  SHADOW_TILT_FULL,
  SHADOW_WIDTH,
  STREAK_ALPHA_DARK,
  STREAK_ALPHA_LIGHT,
  STREAK_ARC,
  STREAK_LEAVING_BOOST,
  STREAK_WIDTH,
} from "./deep-field-config";
import { type DeepFieldInk, type Rgba, withAlpha } from "./deep-field-ink";
import {
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

export interface PlaneInput {
  frame: AnimatedFrame;
  rings: readonly PlaneRing[];
  fx: SwitchFx;
  ink: DeepFieldInk;
  extent: number;
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

/** A sweep-gradient (world origin) running 0 → `alpha` over `span` radians
 *  starting at world angle `start` (0 = north, clockwise). */
function sweepRamp(color: Rgba, alpha: number, start: number, span: number) {
  "worklet";
  const local = Skia.Matrix();
  local.rotate(start - Math.PI / 2);
  return Skia.Shader.MakeSweepGradient(
    0,
    0,
    [
      withAlpha(color, 0),
      withAlpha(color, alpha * 0.35),
      withAlpha(color, alpha),
    ],
    [0, Math.min(1, (span / TAU) * 0.6), Math.min(1, span / TAU)],
    TILE_CLAMP,
    local,
  );
}

/** Linear mix of two token inks (a → b by t), alpha from `a`. */
function mixInk(a: Rgba, b: Rgba, t: number): Rgba {
  "worklet";
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    1,
  ];
}

/** Status segment ramp over [start, start+trail+lead] (world angles):
 *  tapered 0 → full at the body (start+trail) → 0 at the lead's end. */
function segmentRamp(
  color: Rgba,
  start: number,
  trail: number,
  lead: number,
  directional: boolean,
) {
  "worklet";
  const local = Skia.Matrix();
  local.rotate(start - Math.PI / 2);
  const t = trail / TAU;
  const end = Math.min(1, (trail + lead) / TAU);
  return Skia.Shader.MakeSweepGradient(
    0,
    0,
    [
      withAlpha(color, 0),
      withAlpha(color, directional ? 0.18 : 0.5),
      withAlpha(color, 1),
      withAlpha(color, 0),
    ],
    [0, t * 0.5, t, end],
    TILE_CLAMP,
    local,
  );
}

function drawGrid(
  canvas: SkCanvas,
  ink: DeepFieldInk,
  reach: number,
  unit: number,
  density: number,
): void {
  "worklet";
  const chart = ink.chart;
  const inner =
    (chart ? GRID_ALPHA_INNER_LIGHT : GRID_ALPHA_INNER_DARK) * density;
  const outer =
    (chart ? GRID_ALPHA_OUTER_LIGHT : GRID_ALPHA_OUTER_DARK) * density;
  const paint = makePaint(STYLE_STROKE, BLEND_SRC_OVER);
  paint.setStrokeWidth(GRID_STROKE_PX * unit);
  paint.setShader(
    Skia.Shader.MakeRadialGradient(
      { x: 0, y: 0 },
      reach,
      [withAlpha(ink.grid, inner), withAlpha(ink.grid, outer)],
      [0.1, 1],
      TILE_CLAMP,
    ),
  );
  const path = Skia.Path.Make();
  for (let r = GRID_RING_STEP; r < reach; r += GRID_RING_STEP)
    path.addCircle(0, 0, r);
  for (let deg = 0; deg < 360; deg += GRID_SPOKE_DEGREES) {
    const a = deg / DEG;
    const s = Math.sin(a);
    const c = -Math.cos(a);
    path.moveTo(s * GRID_RING_STEP * 0.6, c * GRID_RING_STEP * 0.6);
    path.lineTo(s * reach, c * reach);
  }
  canvas.drawPath(path, paint);
  // Astrolabe bezel: double ring + graduated ticks (every 5th is major).
  const bezel = makePaint(STYLE_STROKE, BLEND_SRC_OVER);
  bezel.setStrokeWidth(GRID_STROKE_PX * unit);
  bezel.setColor(
    withAlpha(ink.grid, chart ? GRID_BEZEL_ALPHA_LIGHT : GRID_BEZEL_ALPHA_DARK),
  );
  const ticks = Skia.Path.Make();
  ticks.addCircle(0, 0, reach);
  ticks.addCircle(0, 0, reach + GRID_TICK_MAJOR * 1.1);
  let index = 0;
  for (let deg = 0; deg < 360; deg += GRID_TICK_DEGREES) {
    const a = deg / DEG;
    const len = index % 5 === 0 ? GRID_TICK_MAJOR : GRID_TICK_MINOR;
    const s = Math.sin(a);
    const c = -Math.cos(a);
    ticks.moveTo(s * reach, c * reach);
    ticks.lineTo(s * (reach + len), c * (reach + len));
    index++;
  }
  canvas.drawPath(ticks, bezel);
}

/**
 * Records the whole world plane into `canvas` (a picture recorder canvas).
 * Pure function of its input — safe to call from a `useDerivedValue`.
 */
export function drawWorldPlane(canvas: SkCanvas, input: PlaneInput): void {
  "worklet";
  const { frame, rings, fx, ink, extent } = input;
  const pose = frame.pose;
  const zoom = pose.zoom > 0 ? pose.zoom : 1;
  const unit = 1 / zoom; // world units per screen px at perspective scale 1
  const tilt = pose.tilt ?? 0;
  const yaw = pose.yaw ?? 0;
  const chart = ink.chart;
  const H = planeHomography(pose, frame.viewport);
  const Hi = invertHomography(H);
  const reach = Math.max(GRID_RING_STEP * 2, extent * GRID_REACH);

  // Index the frame once: key → body index (avoids O(N²) finds).
  const index: Record<string, number> = {};
  let sunX = 0;
  let sunY = 0;
  for (let i = 0; i < frame.bodies.length; i++) {
    const b = frame.bodies[i];
    index[bodyKey(b)] = i;
    if (b.kind === "sun" && b.opacity > 0) {
      const w = mapHomography(Hi, b.x, b.y);
      sunX = w.x;
      sunY = w.y;
    }
  }

  canvas.save();
  canvas.concat(H);

  // 1 · Sun-lit pool on the plane (additive glow / multiply ink wash).
  const pool = makePaint(STYLE_FILL, chart ? BLEND_MULTIPLY : BLEND_PLUS);
  const poolR = Math.max(GRID_RING_STEP, extent * LIT_POOL_REACH);
  pool.setShader(
    Skia.Shader.MakeRadialGradient(
      { x: sunX, y: sunY },
      poolR,
      chart
        ? [
            withAlpha(ink.starlight, LIT_POOL_ALPHA_LIGHT),
            withAlpha(ink.background, 0),
          ]
        : [
            withAlpha(ink.starlight, LIT_POOL_ALPHA_DARK),
            withAlpha(ink.starlight, LIT_POOL_ALPHA_DARK * 0.3),
            withAlpha(ink.starlight, 0),
          ],
      chart ? [0, 1] : [0, 0.35, 1],
      TILE_CLAMP,
    ),
  );
  canvas.drawCircle(sunX, sunY, poolR, pool);

  // 2 · Reference grid + bezel. PASS 1: the inner rings/spokes fade as the
  // orbit count rises (they were noise under ~20 rings); the bezel stays.
  const density = Math.max(
    GRID_DENSITY_FLOOR,
    Math.min(1, GRID_DENSITY_REF / Math.max(1, rings.length)),
  );
  drawGrid(canvas, ink, reach, unit, density);

  // 3 · Contact shadows: cast outward along the plane, away from the sun.
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
  // PASS 1: a cast shadow only reads as one once the plane is tilted; at
  // tilt 0 it was a smudge beside the body. Fade in with tilt.
  const tiltGate = Math.max(0, Math.min(1, tilt / SHADOW_TILT_FULL));
  const shadowGate = tiltGate * tiltGate * (3 - 2 * tiltGate);
  const shadowAlpha =
    (chart ? SHADOW_ALPHA_LIGHT : SHADOW_ALPHA_DARK) * shadowGate;
  for (let i = 0; shadowAlpha > 0.004 && i < frame.bodies.length; i++) {
    const b = frame.bodies[i];
    if (b.kind !== "contact" || b.opacity <= 0) continue;
    const w = mapHomography(Hi, b.x, b.y);
    const dx = w.x - sunX;
    const dy = w.y - sunY;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-3) continue;
    // World radius from the projected one: projected = world × zoom / w.
    const worldR = (b.radius * Math.abs(w.w)) / zoom;
    const ux = dx / dist;
    const uy = dy / dist;
    canvas.save();
    canvas.translate(
      w.x + ux * worldR * SHADOW_OFFSET,
      w.y + uy * worldR * SHADOW_OFFSET,
    );
    canvas.rotate(Math.atan2(uy, ux) * DEG, 0, 0);
    canvas.scale(worldR * SHADOW_LENGTH * 0.5, worldR * SHADOW_WIDTH);
    shadow.setAlphaf(shadowAlpha * b.opacity);
    canvas.drawCircle(0, 0, 1, shadow);
    canvas.restore();
  }

  // 4 · Rings (instrument hairlines) + 5 · status segments, 6 · streaks.
  // PASS 1 hierarchy inversion: the full ring is a thin, low-alpha hairline
  // mostly in neutral grid ink with a status TINT (colour-on-ring stays
  // perceivable all the way round); full status colour is concentrated in a
  // tapered segment around the body (its last ~75° of progress plus a short
  // lead). No additive underglow. Line language (width channel 2/3/4, solid
  // vs dashed, faded / faint-trace alpha) is applied to BOTH parts.
  const sinTilt = Math.sin(tilt) / Math.sin(MAX_TILT);
  const farAlpha = 1 - (1 - RING_FAR_ALPHA) * Math.max(0, Math.min(1, sinTilt));
  // Unit vector (world) toward the viewer = gradient of camera-plane depth.
  const nearX = Math.sin(yaw);
  const nearY = Math.cos(yaw);
  const dash = Skia.PathEffect.MakeDash(
    [RING_DASH * unit, RING_DASH * unit],
    0,
  );
  const hair = makePaint(STYLE_STROKE, BLEND_SRC_OVER);
  const hairDash = makePaint(STYLE_STROKE, BLEND_SRC_OVER);
  hairDash.setPathEffect(dash);
  const segment = makePaint(STYLE_STROKE, BLEND_SRC_OVER);
  segment.setStrokeCap(CAP_BUTT);
  const segmentDash = makePaint(STYLE_STROKE, BLEND_SRC_OVER);
  segmentDash.setStrokeCap(CAP_BUTT);
  segmentDash.setPathEffect(dash);
  const streak = makePaint(STYLE_STROKE, chart ? BLEND_SRC_OVER : BLEND_PLUS);
  // Butt caps: a round cap would sample the sweep ramp's wrapped (bright) end.
  streak.setStrokeCap(CAP_BUTT);
  const tint = chart ? RING_TINT_LIGHT : RING_TINT_DARK;
  // Few orbits → the hairlines may be bolder (they are the only structure);
  // many orbits → back off so ~20 concentric lines never dominate bodies.
  const sparse = Math.max(
    0,
    Math.min(1, (RING_SPARSE_COUNT - rings.length) / (RING_SPARSE_COUNT - 2)),
  );
  const hairAlpha =
    (chart ? RING_HAIR_ALPHA_LIGHT : RING_HAIR_ALPHA_DARK) *
    (1 + (RING_SPARSE_BOOST - 1) * sparse);
  const segAlpha = chart ? SEGMENT_ALPHA_LIGHT : SEGMENT_ALPHA_DARK;

  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    const bi = index[ring.key];
    if (bi === undefined) continue;
    const body = frame.bodies[bi];
    if (body.opacity <= 0) continue;
    const ringR = body.ringRadius / zoom;
    if (!(ringR > 0)) continue;
    const role = fx.active && bi < fx.roles.length ? fx.roles[bi] : -1;
    const drawOn =
      role === FX_ROLE_ENTERING ? Math.max(0, Math.min(1, fx.stages[bi])) : 1;
    const alpha = body.opacity * ringStatusAlpha(ring);
    const dashed = ringIsDashed(ring);
    const hairColor = mixInk(ink.grid, ring.color, tint);
    const depthShader = Skia.Shader.MakeLinearGradient(
      { x: -nearX * ringR, y: -nearY * ringR },
      { x: nearX * ringR, y: nearY * ringR },
      [withAlpha(hairColor, farAlpha), withAlpha(hairColor, 1)],
      null,
      TILE_CLAMP,
    );
    const oval = Skia.XYWHRect(-ringR, -ringR, ringR * 2, ringR * 2);
    // Width channel kept proportional (2/3/4 → 1 : 1.5 : 2).
    const hairW = ring.width * RING_HAIR_SCALE * unit;
    const h = dashed ? hairDash : hair;
    h.setShader(depthShader);
    h.setStrokeWidth(hairW);
    h.setAlphaf(alpha * hairAlpha);
    if (drawOn >= 1) canvas.drawCircle(0, 0, ringR, h);
    else if (drawOn > 0) canvas.drawArc(oval, -90, 360 * drawOn, false, h);

    // Body world position → its angle (0 = north, clockwise).
    const w = mapHomography(Hi, body.x, body.y);
    const theta = normalAngle(Math.atan2(w.x, -w.y));
    if (drawOn >= 1 && body.kind === "contact") {
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
        const sg = dashed ? segmentDash : segment;
        sg.setShader(
          segmentRamp(ring.color, theta - trail, trail, lead, ring.progress),
        );
        sg.setStrokeWidth(ring.width * SEGMENT_SCALE * unit);
        sg.setAlphaf(alpha * segAlpha * depthA);
        canvas.drawArc(
          oval,
          (theta - trail) * DEG - 90,
          (trail + lead) * DEG,
          false,
          sg,
        );
      }
    }
    // Switch streak: a world-space arc trailing the body along its spin.
    if (fx.active && fx.velocity > 0.02 && role !== FX_ROLE_ANCHOR) {
      const boost = role === FX_ROLE_LEAVING ? STREAK_LEAVING_BOOST : 1;
      const span = STREAK_ARC * fx.velocity * boost;
      const dist = Math.hypot(w.x, w.y);
      const worldR = (body.radius * Math.abs(w.w)) / zoom;
      if (dist > 1 && span > 0.01) {
        const so = Skia.XYWHRect(-dist, -dist, dist * 2, dist * 2);
        streak.setShader(sweepRamp(ring.color, 1, theta - span, span));
        streak.setStrokeWidth(worldR * STREAK_WIDTH);
        streak.setAlphaf(
          (chart ? STREAK_ALPHA_LIGHT : STREAK_ALPHA_DARK) * body.opacity,
        );
        canvas.drawArc(
          so,
          (theta - span) * DEG - 90,
          span * DEG,
          false,
          streak,
        );
      }
    }
  }
  canvas.restore();
}
