/**
 * 38.7-09 (D-07/D-08/D-36/D-37, H9): the painted sky — the bottom picture
 * layer, drawn from the sky spec, the baked neutral nebula and the frame.
 *
 * Bottom to top:
 * 1. the neutral gradient (horizon at the top → base), analytic;
 * 2. a faint whole-sky wash of the System tint;
 * 3. the baked NEUTRAL nebula image, tinted at draw time by a colour filter
 *    whose numbers come from the spec (H9: a System change edits a
 *    SharedValue only; nothing bakes);
 * 4. the stars, batched (one `drawPoints` per tone × size × twinkle phase).
 * The nebula and stars are offset by the camera parallax and the ambient
 * drift; both are bounded, and the sky covers the canvas plus a margin that
 * contains them. Under reduced motion the ambient value is −1: the drift is
 * zero and every star holds its mid alpha, so the picture stops re-recording.
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
  StrokeCap,
  TileMode,
} from "@shopify/react-native-skia";
import type { CameraPose } from "@/logic/orrery-camera-logic";
import { skyDriftOffset, skyParallaxOffset } from "@/logic/orrery-sky-logic";
import type { OrreryInk, SkyImageSpec, SkySpec } from "./scene-specs";
import {
  SKY_DRIFT_DP_PER_MIN,
  SKY_DRIFT_MAX_DP,
  SKY_PARALLAX_MAX_DP,
  SKY_PARALLAX_NEBULA,
  SKY_PARALLAX_STARS,
  SKY_TWINKLE_SPEED,
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
 * The System tint now: `tintFrom` → `tintTo` by `tintMix`, mixed by
 * strength so an untinted end (alpha 0) fades the hue's strength rather than
 * darkening its colour. tintMix 0 = exactly `tintFrom`, 1 = exactly `tintTo`.
 */
export function skyTintNow(sky: SkySpec): OrreryInk {
  "worklet";
  const m = Math.max(0, Math.min(1, sky.tintMix));
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

/**
 * The nebula's tint colour matrix (row-major 4×5, unpremultiplied, 0..1):
 * additive (dark) adds `tint × k`; src-over (light) lerps toward the tint by
 * k. k = tint strength × the tint's own alpha (0 → identity).
 */
export function skyNebulaTintMatrix(
  tint: OrreryInk,
  strength: number,
  additive: boolean,
): number[] {
  "worklet";
  const k = Math.max(0, Math.min(1, strength * tint[3]));
  const keep = additive ? 1 : 1 - k;
  return [
    keep,
    0,
    0,
    0,
    tint[0] * k,
    0,
    keep,
    0,
    0,
    tint[1] * k,
    0,
    0,
    keep,
    0,
    tint[2] * k,
    0,
    0,
    0,
    1,
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

/** 3: the neutral nebula image, tinted by a colour filter, offset. */
function drawSkyNebula(
  canvas: SkCanvas,
  sky: SkySpec,
  image: SkImage,
  tint: OrreryInk,
  dx: number,
  dy: number,
): void {
  "worklet";
  const paint = Skia.Paint();
  if (tint[3] > 0 && sky.tintStrength > 0) {
    const makeMatrix = Skia.ColorFilter?.MakeMatrix;
    if (typeof makeMatrix === "function")
      paint.setColorFilter(
        makeMatrix(skyNebulaTintMatrix(tint, sky.tintStrength, sky.additive)),
      );
  }
  paint.setBlendMode(sky.additive ? BlendMode.Screen : BlendMode.SrcOver);
  canvas.drawImageRectOptions(
    image,
    Skia.XYWHRect(0, 0, image.width(), image.height()),
    Skia.XYWHRect(
      (sky.width - sky.coverWidth) / 2 + dx,
      (sky.height - sky.coverHeight) / 2 + dy,
      sky.coverWidth,
      sky.coverHeight,
    ),
    FilterMode.Linear,
    MipmapMode.None,
    paint,
  );
}

/** 4: the star batches, offset, each with its twinkle alpha. */
function drawSkyStars(
  canvas: SkCanvas,
  sky: SkySpec,
  ambientMs: number,
  dx: number,
  dy: number,
): void {
  "worklet";
  if (sky.stars.length === 0) return;
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeCap(StrokeCap.Round);
  canvas.save();
  canvas.translate(dx, dy);
  for (let i = 0; i < sky.stars.length; i++) {
    const group = sky.stars[i];
    paint.setStrokeWidth(group.diameter);
    paint.setColor(
      inkColor(
        group.ink,
        skyStarAlpha(group.alpha, sky.twinkleDepth, group.phase, ambientMs),
      ),
    );
    canvas.drawPoints(PointMode.Points, group.points as never, paint);
  }
  canvas.restore();
}

/**
 * The whole sky layer. `pose` is the DISPLAYED camera (the frame's own pose,
 * so the parallax follows a switch camera too); `ambientMs` is the quantised
 * ambient value (−1 = still).
 */
export function drawSky(
  canvas: SkCanvas,
  sky: SkySpec,
  image: SkyImageSpec,
  pose: Pick<CameraPose, "x" | "y" | "zoom">,
  ambientMs: number,
): void {
  "worklet";
  drawSkyGradient(canvas, sky);
  const tint = skyTintNow(sky);
  drawSkyWash(canvas, sky, tint);
  const drift = skyDriftOffset(
    ambientMs,
    SKY_DRIFT_DP_PER_MIN,
    SKY_DRIFT_MAX_DP,
  );
  const viewport = { width: sky.width, height: sky.height };
  if (image.image) {
    const p = skyParallaxOffset(
      pose,
      viewport,
      SKY_PARALLAX_NEBULA,
      SKY_PARALLAX_MAX_DP,
    );
    drawSkyNebula(canvas, sky, image.image, tint, p.x + drift.x, p.y + drift.y);
  }
  const s = skyParallaxOffset(
    pose,
    viewport,
    SKY_PARALLAX_STARS,
    SKY_PARALLAX_MAX_DP,
  );
  drawSkyStars(canvas, sky, ambientMs, s.x + drift.x, s.y + drift.y);
}
