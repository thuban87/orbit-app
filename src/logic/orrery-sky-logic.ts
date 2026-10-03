/**
 * 38.7-09 (D-07/D-08/D-36/D-50): the Orrery's painted-sky math — pure, no
 * Skia, no React, node-testable.
 *
 * - `systemSkyHueIndex`: the per-System sky tint bucket, derived from the
 *   System's stable `systemRefId` string (no schema change, D-50). JS only (the
 *   index is resolved when the sky spec is built, never in a worklet).
 * - `skyStarField`: a deterministic star field for a seed (no Math.random and
 *   no `crypto`, which Hermes lacks).
 * - `skyParallaxOffset` / `skyDriftOffset`: the sky's barely-there camera
 *   parallax and ambient drift, both BOUNDED (the sky image and star field are
 *   built with a margin that covers the largest offset) and both worklets.
 *
 * Worklet helpers are defined above their callers (Hermes forward-ref rule).
 */
import type { CameraPose, CameraViewport } from "./orrery-camera-logic";

/** The bucket that means "no System tint" (the base sky). */
export const SKY_UNTINTED = -1;
/**
 * The System that keeps the untinted base sky (Lab B's rule; owner item
 * G-ALLSKY at the 38.7-09 checkpoint).
 */
export const ALL_CONTACTS_SKY_SYSTEM = "builtin:all-contacts";

/**
 * The sky tint bucket for a System: FNV-1a (32-bit) over its `systemRefId`
 * string, modulo `bucketCount`. Deterministic and stable across launches; a
 * duplicated System has a new uid and so (usually) a different hue (D-50,
 * accepted). All Contacts and an empty bucket list return SKY_UNTINTED.
 */
export function systemSkyHueIndex(
  systemId: string,
  bucketCount: number,
): number {
  if (!(bucketCount >= 1) || !Number.isFinite(bucketCount)) return SKY_UNTINTED;
  if (systemId === ALL_CONTACTS_SKY_SYSTEM) return SKY_UNTINTED;
  let h = 0x811c9dc5;
  for (let i = 0; i < systemId.length; i++) {
    h ^= systemId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % Math.floor(bucketCount);
}

/**
 * Deterministic 0..1 value for an integer seed (the `seeded()` sin-hash
 * pattern the Orrery's star field has always used).
 */
export function skySeeded(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** One star of the painted sky, in normalised attributes (0..1). */
export interface SkyStar {
  /** Position in the field's own space (0..width, 0..height). */
  x: number;
  y: number;
  /** Size class input (0 = smallest). */
  size: number;
  /** Brightness input (0 = dimmest). */
  bright: number;
  /** Tone pick input (maps onto the theme's star tones). */
  tone: number;
  /** Twinkle phase input. */
  phase: number;
}

/**
 * `count` stars scattered over a `width` × `height` field, deterministic for
 * `seed` (the same seed always yields the same field). Empty for a
 * non-positive size or count.
 */
export function skyStarField(
  seed: number,
  width: number,
  height: number,
  count: number,
): SkyStar[] {
  if (!(width > 0) || !(height > 0) || !(count > 0)) return [];
  const stars: SkyStar[] = [];
  const base = Math.floor(seed) * 7919;
  for (let i = 0; i < Math.floor(count); i++) {
    const k = base + i * 6 + 1;
    stars.push({
      x: skySeeded(k) * width,
      y: skySeeded(k + 1) * height,
      size: skySeeded(k + 2),
      bright: skySeeded(k + 3),
      tone: skySeeded(k + 4),
      phase: skySeeded(k + 5),
    });
  }
  return stars;
}

/** A screen-space offset in dp. */
export interface SkyOffset {
  x: number;
  y: number;
}

/** Soft saturation: ≈ value for small values, never beyond ±limit. */
function saturate(value: number, limit: number): number {
  "worklet";
  if (!(limit > 0) || !Number.isFinite(value) || value === 0) return 0;
  return limit * Math.tanh(value / limit);
}

/**
 * The sky's parallax for the DISPLAYED camera (pass the frame's own pose, not
 * the gesture pose, so it follows a switch camera too): `factor` dp of sky
 * shift per screen-width of pan, in the pan's direction on screen, softly
 * bounded to ±`limit` dp. A few dp per screen of pan — barely there (D-36).
 */
export function skyParallaxOffset(
  pose: Pick<CameraPose, "x" | "y" | "zoom">,
  viewport: Pick<CameraViewport, "width" | "height">,
  factor: number,
  limit: number,
): SkyOffset {
  "worklet";
  const span = Math.max(1, viewport.width);
  const zoom = Number.isFinite(pose.zoom) && pose.zoom > 0 ? pose.zoom : 1;
  const x = Number.isFinite(pose.x) ? pose.x : 0;
  const y = Number.isFinite(pose.y) ? pose.y : 0;
  return {
    x: saturate(((-x * zoom) / span) * factor, limit),
    y: saturate(((-y * zoom) / span) * factor, limit),
  };
}

/**
 * The sky's ambient drift at ambient time `ambientMs`: a slow, bounded
 * Lissajous wander of at most `amplitude` dp whose path speed is about
 * `dpPerMinute`. Zero at time 0 and under reduced motion (ambient −1), so the
 * sky is fully still then (D-36).
 */
export function skyDriftOffset(
  ambientMs: number,
  dpPerMinute: number,
  amplitude: number,
): SkyOffset {
  "worklet";
  if (!(ambientMs > 0) || !(dpPerMinute > 0) || !(amplitude > 0))
    return { x: 0, y: 0 };
  const omega = dpPerMinute / (amplitude * 60000);
  const t = ambientMs * omega;
  return {
    x: amplitude * Math.sin(t),
    y: amplitude * 0.6 * Math.sin(t * 0.73),
  };
}
