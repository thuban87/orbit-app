/**
 * 38.7-09 (D-07/D-08/D-36/D-37, H9): the painted sky — the bottom picture
 * layer, drawn from the sky spec, the baked nebula densities and the frame.
 *
 * Bottom to top:
 * 1. the SKY SHADER (38.7-09 rework: Lab B's distant nebula, shaders.ts
 *    SKY_NEBULA_SKSL), one full-canvas pass: the neutral horizon → base
 *    gradient, the baked densities coloured from the `orreryNebula` tokens
 *    (lobe B leant toward the System hue at draw time — H9: a System change
 *    edits a SharedValue only; nothing bakes), dust lanes, the FAR star layer
 *    shining through the clouds, the corner vignette. Lab B's far-depth
 *    parallax: the nebula moves 6 % and the far stars 3 % of the world's
 *    on-screen motion, scale gently with zoom, turn with yaw and shift with
 *    tilt; the texture tiles, so no offset ever reveals an edge. Without the
 *    image or the effect: the plain analytic gradient;
 * 2. a faint whole-sky wash of the System tint;
 * 3. the mid/near stars, batched (one `drawPoints` per tone × size × twinkle
 *    phase), offset by the bounded parallax and the ambient drift (the sky
 *    covers the canvas plus a margin that contains them).
 * Under reduced motion the ambient value is −1: the drift is zero, the
 * nebula's breathing holds a fixed composition and every star holds its mid
 * alpha, so the picture stops re-recording at idle.
 *
 * 38.7-13 (D-24/D-08): during a System switch the switch signal adds Lab B's
 * star warp — every layer pushes about the centre and the mid/near stars draw
 * their own streaks (draw-switch.ts) — and the System tint crossfades from
 * the outgoing to the incoming hue at draw time (`skyHueMix`, H9: a uniform
 * blend over the one neutral baked image; nothing bakes). At rest (no signal,
 * or a settled one) the sky is exactly the 38.7-09 sky.
 *
 * D-51 blend rule, keyed from the resolved theme MODE (`spec.additive`): dark
 * themes wash and tint additively (screen); light themes use src-over with ink
 * tokens. Never keyed from luminance. No colour literal: every ink is a token
 * resolved to RGBA in scene-specs.
 *
 * Worklet helpers are defined above their callers (Hermes forward-ref rule).
 */
import {
  BlendMode,
  FilterMode,
  MipmapMode,
  PaintStyle,
  PointMode,
  type SkCanvas,
  type SkImage,
  Skia,
  type SkRuntimeEffect,
  StrokeCap,
  TileMode,
} from "@shopify/react-native-skia";
import type { CameraPose } from "@/logic/orrery-camera-logic";
import { skyDriftOffset, skyParallaxOffset } from "@/logic/orrery-sky-logic";
import type { SwitchFxSignal } from "@/logic/orrery-switch-fx-logic";
import {
  drawWarpStreaks,
  skyHueMix,
  warpLayerFactor,
  warpPushScale,
} from "./draw-switch";
import type { OrreryInk, SkyImageSpec, SkySpec } from "./scene-specs";
import {
  SKY_BREATH_DP,
  SKY_BREATH_S,
  SKY_DRIFT_DP_PER_MIN,
  SKY_DRIFT_MAX_DP,
  SKY_FAR_STAR_DEPTH,
  SKY_NEBULA_DEPTH,
  SKY_NEBULA_TEXELS_PER_DP,
  SKY_PARALLAX_MAX_DP,
  SKY_PARALLAX_STARS,
  SKY_STILL_S,
  SKY_TILT_BASE,
  SKY_TILT_SHIFT,
  SKY_TWINKLE_SPEED,
  SKY_ZOOM_DEPTH,
  WARP_STRENGTH,
} from "./visual-tunables";

/**
 * A star batch's alpha at ambient time `ambientMs`: it swings by `depth` of
 * its alpha around the band's middle; held at the middle under reduced motion
 * (ambient −1) or with no twinkle (light themes).
 */
export function skyStarAlpha(
  alpha: number,
  depth: number,
  phase: number,
  ambientMs: number,
): number {
  "worklet";
  const mid = 1 - depth / 2;
  if (!(depth > 0) || !(ambientMs >= 0) || !Number.isFinite(ambientMs))
    return alpha * mid;
  return (
    alpha *
    (mid + (depth / 2) * Math.sin(ambientMs * SKY_TWINKLE_SPEED + phase))
  );
}

/**
 * The System tint now: `tintFrom` → `tintTo` by `tintMix` (or `mix`, the
 * draw-time switch crossfade), mixed by strength so an untinted end (alpha 0)
 * fades the hue's strength rather than darkening its colour. Mix 0 = exactly
 * `tintFrom`, 1 = exactly `tintTo`.
 */
export function skyTintNow(sky: SkySpec, mix?: number): OrreryInk {
  "worklet";
  const m = Math.max(0, Math.min(1, mix ?? sky.tintMix));
  if (m >= 1) return sky.tintTo;
  if (m <= 0) return sky.tintFrom;
  const from = sky.tintFrom;
  const to = sky.tintTo;
  const wa = from[3] * (1 - m);
  const wb = to[3] * m;
  const a = wa + wb;
  if (!(a > 0)) return [to[0], to[1], to[2], 0];
  return [
    (from[0] * wa + to[0] * wb) / a,
    (from[1] * wa + to[1] * wb) / a,
    (from[2] * wa + to[2] * wb) / a,
    a,
  ];
}

/** The camera fields the sky reads (the DISPLAYED camera's pose). */
export type SkyPose = Pick<CameraPose, "x" | "y" | "zoom" | "tilt" | "yaw">;

/**
 * One sky depth layer's placement (Lab B `skyLayerPlacement`): the layer
 * moves `depth` × the world's on-screen motion (flat approximation: the
 * camera target's offset × zoom), shifts down with tilt and scales by
 * zoom^(depth × SKY_ZOOM_DEPTH) about the viewport centre.
 */
export function skyLayerPlace(
  pose: SkyPose,
  depth: number,
): { ox: number; oy: number; zs: number } {
  "worklet";
  const zoom = Number.isFinite(pose.zoom) && pose.zoom > 0 ? pose.zoom : 1;
  const x = Number.isFinite(pose.x) ? pose.x : 0;
  const y = Number.isFinite(pose.y) ? pose.y : 0;
  const tilt = Number.isFinite(pose.tilt) ? (pose.tilt as number) : 0;
  return {
    ox: -x * zoom * depth,
    oy:
      -y * zoom * depth +
      Math.sin(tilt) * SKY_TILT_SHIFT * (SKY_TILT_BASE + depth),
    zs: Math.exp(Math.log(zoom) * depth * SKY_ZOOM_DEPTH),
  };
}

/**
 * The sky shader's 64 uniform floats (order mirrors SKY_NEBULA_SKSL). The
 * System tint leans lobe B toward its hue by tintStrength × the tint's own
 * strength (0 → the neutral ink: All Contacts). `switchWarp` (38.7-13) pushes the
 * nebula and far stars about the centre (Lab B WARP_PUSH; 0 = at rest).
 */
export function skyNebulaUniforms(
  sky: SkySpec,
  tint: OrreryInk,
  pose: SkyPose,
  ambientMs: number,
  switchWarp = 0,
): number[] {
  "worklet";
  const n = sky.nebula;
  const k = Math.max(0, Math.min(1, sky.tintStrength * tint[3]));
  const lobeB = [
    n.lobeB[0] + (tint[0] - n.lobeB[0]) * k,
    n.lobeB[1] + (tint[1] - n.lobeB[1]) * k,
    n.lobeB[2] + (tint[2] - n.lobeB[2]) * k,
  ];
  const yaw = Number.isFinite(pose.yaw) ? (pose.yaw as number) : 0;
  const neb = skyLayerPlace(pose, SKY_NEBULA_DEPTH);
  const far = skyLayerPlace(pose, SKY_FAR_STAR_DEPTH);
  const nebPush = warpPushScale(switchWarp, SKY_NEBULA_DEPTH);
  const farPush = warpPushScale(switchWarp, SKY_FAR_STAR_DEPTH);
  const drift = skyDriftOffset(
    ambientMs,
    SKY_DRIFT_DP_PER_MIN,
    SKY_DRIFT_MAX_DP,
  );
  const still = !(ambientMs >= 0) || !Number.isFinite(ambientMs);
  const t = still ? SKY_STILL_S : (ambientMs / 1000) % 1000;
  const warp =
    SKY_BREATH_DP * (0.55 + 0.45 * Math.sin((t * Math.PI * 2) / SKY_BREATH_S));
  const vt = n.vignetteInk;
  const s0 = n.farStars[0];
  const s1 = n.farStars[1];
  const s2 = n.farStars[2];
  return [
    sky.width,
    sky.height,
    sky.horizonStop,
    SKY_NEBULA_TEXELS_PER_DP,
    sky.horizon[0],
    sky.horizon[1],
    sky.horizon[2],
    0,
    sky.base[0],
    sky.base[1],
    sky.base[2],
    0,
    n.lobeA[0],
    n.lobeA[1],
    n.lobeA[2],
    n.lobeAStrength,
    lobeB[0],
    lobeB[1],
    lobeB[2],
    n.lobeBStrength,
    n.ember[0],
    n.ember[1],
    n.ember[2],
    n.emberStrength,
    n.glow,
    n.dust,
    n.vignette,
    n.vignetteShade,
    vt ? vt[0] : 0,
    vt ? vt[1] : 0,
    vt ? vt[2] : 0,
    vt ? 1 : 0,
    sky.width / 2,
    sky.height / 2,
    yaw,
    neb.zs * nebPush,
    neb.ox,
    neb.oy,
    drift.x,
    drift.y,
    warp,
    t,
    far.zs * farPush,
    0,
    far.ox,
    far.oy,
    n.farStarAlpha,
    n.farStarDensity,
    s0[0],
    s0[1],
    s0[2],
    sky.additive ? 1 : 0,
    s1[0],
    s1[1],
    s1[2],
    0,
    s2[0],
    s2[1],
    s2[2],
    0,
  ];
}

function inkColor(ink: OrreryInk, alpha: number): Float32Array {
  "worklet";
  return Float32Array.of(
    ink[0],
    ink[1],
    ink[2],
    Math.max(0, Math.min(1, ink[3] * alpha)),
  );
}

/** 1: the neutral horizon → base gradient (a plain base fill without shaders). */
function drawSkyGradient(canvas: SkCanvas, sky: SkySpec): void {
  "worklet";
  const paint = Skia.Paint();
  const make = Skia.Shader?.MakeLinearGradient;
  if (typeof make === "function" && sky.height > 0) {
    paint.setShader(
      make(
        { x: 0, y: 0 },
        { x: 0, y: Math.max(1, sky.height * sky.horizonStop) },
        [inkColor(sky.horizon, 1), inkColor(sky.base, 1)],
        null,
        TileMode.Clamp,
      ),
    );
  } else {
    paint.setColor(inkColor(sky.base, 1));
  }
  canvas.drawPaint(paint);
}

/** 2: the faint whole-sky wash of the System tint (nothing when untinted). */
function drawSkyWash(canvas: SkCanvas, sky: SkySpec, tint: OrreryInk): void {
  "worklet";
  const alpha = tint[3] * sky.tintWash;
  if (!(alpha > 0)) return;
  const paint = Skia.Paint();
  paint.setColor(
    Float32Array.of(tint[0], tint[1], tint[2], Math.min(1, alpha)),
  );
  paint.setBlendMode(sky.additive ? BlendMode.Screen : BlendMode.SrcOver);
  canvas.drawPaint(paint);
}

/** 1: the sky shader — gradient, Lab B's nebula, far stars, vignette. */
function drawSkyNebula(
  canvas: SkCanvas,
  sky: SkySpec,
  image: SkImage,
  effect: SkRuntimeEffect,
  tint: OrreryInk,
  pose: SkyPose,
  ambientMs: number,
  warp: number,
): void {
  "worklet";
  const density = image.makeShaderOptions(
    TileMode.Repeat,
    TileMode.Repeat,
    FilterMode.Linear,
    MipmapMode.None,
  );
  const paint = Skia.Paint();
  paint.setShader(
    effect.makeShaderWithChildren(
      skyNebulaUniforms(sky, tint, pose, ambientMs, warp),
      [density],
    ),
  );
  canvas.drawPaint(paint);
}

/**
 * 3: the mid/near star batches, offset, each with its twinkle alpha. Under
 * a warp (38.7-13) each layer is pushed about the centre (its dots keep
 * Lab B's √push size growth) and the streaks are drawn under the dots.
 */
function drawSkyStars(
  canvas: SkCanvas,
  sky: SkySpec,
  ambientMs: number,
  dx: number,
  dy: number,
  warp: number,
): void {
  "worklet";
  if (sky.stars.length === 0) return;
  if (warp > 0) drawWarpStreaks(canvas, sky, warp, dx, dy);
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeCap(StrokeCap.Round);
  const cx = sky.width / 2;
  const cy = sky.height / 2;
  if (!(warp > 0)) {
    canvas.save();
    canvas.translate(dx, dy);
  }
  for (let i = 0; i < sky.stars.length; i++) {
    const group = sky.stars[i];
    const push =
      warp > 0 ? warpPushScale(warp, warpLayerFactor(group.layer)) : 1;
    if (warp > 0) {
      canvas.save();
      canvas.translate(cx, cy);
      canvas.scale(push, push);
      canvas.translate(dx - cx, dy - cy);
    }
    paint.setStrokeWidth(group.diameter / Math.sqrt(push));
    paint.setColor(
      inkColor(
        group.ink,
        skyStarAlpha(group.alpha, sky.twinkleDepth, group.phase, ambientMs),
      ),
    );
    canvas.drawPoints(PointMode.Points, group.points as never, paint);
    if (warp > 0) canvas.restore();
  }
  if (!(warp > 0)) canvas.restore();
}

/**
 * The whole sky layer. `pose` is the DISPLAYED camera (the frame's own pose,
 * so the parallax follows a switch camera too); `ambientMs` is the quantised
 * ambient value (−1 = still); `effect` the compiled sky shader (null → the
 * plain gradient, as without a baked image); `signal` (38.7-13) the switch
 * signal of the transition being drawn (null = at rest): its warp and the
 * draw-time tint crossfade.
 */
export function drawSky(
  canvas: SkCanvas,
  sky: SkySpec,
  image: SkyImageSpec,
  pose: SkyPose,
  ambientMs: number,
  effect: SkRuntimeEffect | null,
  signal: SwitchFxSignal | null = null,
): void {
  "worklet";
  const tint = skyTintNow(
    sky,
    signal ? skyHueMix(sky.tintGeneration, signal) : undefined,
  );
  const warp = signal ? Math.max(0, signal.warp * WARP_STRENGTH) : 0;
  if (image.image && effect && sky.width > 0 && sky.height > 0)
    drawSkyNebula(
      canvas,
      sky,
      image.image,
      effect,
      tint,
      pose,
      ambientMs,
      warp,
    );
  else drawSkyGradient(canvas, sky);
  drawSkyWash(canvas, sky, tint);
  const drift = skyDriftOffset(
    ambientMs,
    SKY_DRIFT_DP_PER_MIN,
    SKY_DRIFT_MAX_DP,
  );
  const s = skyParallaxOffset(
    pose,
    { width: sky.width, height: sky.height },
    SKY_PARALLAX_STARS,
    SKY_PARALLAX_MAX_DP,
  );
  drawSkyStars(canvas, sky, ambientMs, s.x + drift.x, s.y + drift.y, warp);
}
