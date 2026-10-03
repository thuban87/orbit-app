/**
 * 38.7-06 (D-43/D-49): the sky layers — the background fill (base picture)
 * and today's twinkling starfield (stars picture), drawn from specs.
 *
 * The twinkle is one opacity for the whole field, driven by the canvas's
 * single ambient clock; under reduced motion it holds at the band mid-point,
 * so the stars picture's input stops changing and nothing re-records.
 * Worklet helpers are defined above their callers (Hermes forward-ref rule).
 */
import { type SkCanvas, Skia } from "@shopify/react-native-skia";
import type { OrreryInk, SkySpec, StarFieldSpec } from "./scene-specs";

/** Twinkle: the shared field opacity oscillates within this band. */
export const TWINKLE_MIN = 0.18;
export const TWINKLE_MAX = 0.55;
/** Twinkle angular speed (rad/ms) → ~2.6 s period. */
export const TWINKLE_SPEED = 0.0024;
/**
 * The static opacity under reduced motion — the band mid-point, so the field
 * holds steady (visible, not flickering) rather than animating (THEME-06).
 */
export const TWINKLE_STATIC = (TWINKLE_MIN + TWINKLE_MAX) / 2;

/** The field opacity at ambient clock time `clockMs`. */
export function twinkleOpacity(clockMs: number, reduced: boolean): number {
  "worklet";
  if (reduced || !Number.isFinite(clockMs)) return TWINKLE_STATIC;
  const t = (Math.sin(clockMs * TWINKLE_SPEED) + 1) / 2;
  return TWINKLE_MIN + (TWINKLE_MAX - TWINKLE_MIN) * t;
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

/** The background (today's `<Fill color={colors.background}>`). */
export function drawSky(canvas: SkCanvas, sky: SkySpec): void {
  "worklet";
  const paint = Skia.Paint();
  paint.setColor(inkColor(sky.background, 1));
  canvas.drawPaint(paint);
}

/** Every star at its base opacity × the field twinkle. */
export function drawStars(
  canvas: SkCanvas,
  field: StarFieldSpec,
  twinkle: number,
): void {
  "worklet";
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  for (let i = 0; i < field.stars.length; i++) {
    const star = field.stars[i];
    paint.setColor(inkColor(star.ink, star.base * twinkle));
    canvas.drawCircle(star.x, star.y, star.r, paint);
  }
}
