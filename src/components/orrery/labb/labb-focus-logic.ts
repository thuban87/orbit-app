/**
 * ORRERY LAB B — WP-2.2 focus state and interaction feedback (L7), pure maths.
 *
 * Everything here is a worklet (or a plain helper) with NO Skia import, so it
 * is node-testable. `LabFocusFx.tsx` executes it into UI-thread pictures.
 *
 * Model (research 03 §1.3 L7, M1-CRITIQUE):
 * - `mix` (0..1): how strongly the world responds to the current focus —
 *   non-focused bodies / rings / labels defocus, the focused world's
 *   atmosphere intensifies, the vignette deepens. It changes ONLY in an effect
 *   keyed on focus identity (a `withTiming`), never per frame from React.
 * - `lock` (0..1): the target-lock reticle. 0 while the camera is still flying
 *   in ("seeking": a larger, rotated, faint reticle whose spin and spread are a
 *   pure function of how far the body still is from the view centre, so it
 *   converges WITH the camera); it animates to 1 once the camera settles (the
 *   brackets snap in, a lock flash ring expands once). Static afterwards.
 * - feedback timers (`t` 0..1 of one `withTiming`): tap pings, empty-space
 *   ripples, the Polaris flare and the reorder slot flash are pure functions of
 *   their timer — nothing reads the ambient clock, so idle frames never
 *   re-record these layers.
 * - Reduced motion: no seek, no ripple growth, no spin — the reticle appears
 *   locked, feedback is a ≤150 ms opacity highlight.
 *
 * Hermes rule: helpers are declared ABOVE their worklet callers (guarded by
 * `orrery-worklet-order.test.ts`). No default parameters in worklets.
 */

import { bodyKey } from "@/logic/orrery-frame";
import type { FrameBody } from "./labb-frame-index";

// --- Tunables -----------------------------------------------------------------
/** World response fade in / out (ms). */
export const FOCUS_MIX_MS = 340;
export const FOCUS_RELEASE_MS = 260;
/** Reticle lock-on (ms) and the grace before locking when no fly-in starts. */
export const LOCK_MS = 380;
export const LOCK_DELAY_MS = 160;
/** Tap ping / ripple / north flare duration (ms); reduced-motion highlight. */
export const PING_MS = 620;
export const RM_FLASH_MS = 150;
/** Reorder slot flash (ms). */
export const SLOT_FLASH_MS = 340;
/** Reticle radius: max(r × reach + pad, min). */
export const BRACKET_REACH = 1.22;
export const BRACKET_PAD = 6;
export const BRACKET_MIN_R = 12;
/** Corner arm length as a fraction of the reticle half-size. */
export const BRACKET_ARM = 0.4;
/** Inner cardinal ticks (dp). */
export const BRACKET_TICK = 4.5;
/** Seeking reticle: extra spread and spin at full seek. */
export const SEEK_SPREAD = 0.55;
export const SEEK_SPIN = 1.1;
/** Seek floor: even an on-centre body shows a brief "acquiring" spread. */
export const SEEK_FLOOR = 0.3;
/** Seeking alpha (the reticle brightens as it locks). */
export const SEEK_ALPHA = 0.55;
/** Lock flash: ring grows from R to R × (1 + FLASH_GROW) over the lock tail. */
export const FLASH_GROW = 0.9;
export const FLASH_ALPHA = 0.55;
/** Ping: rings grow from the body edge by PING_GROW dp. */
export const PING_GROW = 34;
export const PING_ALPHA = 0.8;
/** Second ping ring delay (fraction of the timer). */
export const PING_ECHO = 0.22;
/** Empty-space ripple: radius on the plane in screen dp at zoom 1. */
export const RIPPLE_DP = 78;
export const RIPPLE_ALPHA = 0.5;
/** Reduced-motion static ripple / ping size (dp). */
export const RM_RING_DP = 18;
/** Non-focused label tags while something is focused. */
export const LABEL_DEFOCUS = 0.38;
/** Vignette deepening at full focus (fraction). */
export const VIGNETTE_FOCUS = 0.16;

// --- Easing -------------------------------------------------------------------

export function clamp01(v: number): number {
  "worklet";
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function easeOutCubic(t: number): number {
  "worklet";
  const u = 1 - clamp01(t);
  return 1 - u * u * u;
}

// --- World response -----------------------------------------------------------

/**
 * Per-body focus value for the body shader (`uK.w`): +mix for a focused body
 * (atmosphere intensifies), −mix for every other body (defocus: dim,
 * desaturate, sink toward the sky), 0 when nothing is (or was) focused.
 * `keys` is retained after a clear so the release can fade out with `mix`.
 */
export function focusBodyValue(
  keys: readonly string[],
  key: string,
  mix: number,
): number {
  "worklet";
  if (keys.length === 0 || !(mix > 0)) return 0;
  for (let i = 0; i < keys.length; i++) if (keys[i] === key) return mix;
  return -mix;
}

/** Ring / label dim multiplier: 1 for focused keys, 1 − (1 − floor) × mix others. */
export function focusDimFactor(
  keys: readonly string[],
  key: string,
  mix: number,
  floor: number,
): number {
  "worklet";
  const v = focusBodyValue(keys, key, mix);
  return v < 0 ? 1 - (1 - floor) * -v : 1;
}

// --- Reticle --------------------------------------------------------------------

export function bracketRadius(radius: number): number {
  "worklet";
  return Math.max(BRACKET_MIN_R, radius * BRACKET_REACH + BRACKET_PAD);
}

/**
 * How far (0..1) a body still is from the centre of the view's usable rect —
 * the fly-in's remaining travel, as seen on screen.
 */
export function seekAmount(
  x: number,
  y: number,
  cx: number,
  cy: number,
  half: number,
): number {
  "worklet";
  if (!(half > 0)) return 0;
  return clamp01(Math.hypot(x - cx, y - cy) / half);
}

export interface ReticleState {
  /** Reticle scale (× bracket radius). */
  scale: number;
  /** Rotation (rad). */
  rot: number;
  alpha: number;
  /** Lock flash ring: radius scale (× bracket radius) and alpha (0 = none). */
  flashScale: number;
  flashAlpha: number;
}

/**
 * The reticle for lock progress `lock` (0 seeking … 1 locked) and the body's
 * remaining on-screen travel `seek`. Reduced motion: always locked.
 */
export function reticleState(
  lock: number,
  seek: number,
  reduced: boolean,
): ReticleState {
  "worklet";
  if (reduced)
    return { scale: 1, rot: 0, alpha: 1, flashScale: 1, flashAlpha: 0 };
  const e = easeOutCubic(lock);
  const s = Math.max(SEEK_FLOOR, clamp01(seek)) * (1 - e);
  // Flash: the last 55 % of the lock; ring expands and fades once.
  const f = clamp01((lock - 0.45) / 0.55);
  return {
    scale: 1 + SEEK_SPREAD * s,
    rot: SEEK_SPIN * s,
    alpha: SEEK_ALPHA + (1 - SEEK_ALPHA) * e,
    flashScale: 1 + FLASH_GROW * easeOutCubic(f),
    flashAlpha: lock > 0.45 && lock < 1 ? FLASH_ALPHA * (1 - f) * (1 - f) : 0,
  };
}

/**
 * Reticle line segments around (cx, cy) with half-size `R`, rotated by `rot`:
 * four corner L-brackets (2 segments each) and four inner cardinal ticks.
 * Flat `[x0, y0, x1, y1, …]` (12 segments).
 */
export function reticleSegments(
  cx: number,
  cy: number,
  R: number,
  rot: number,
): number[] {
  "worklet";
  const out: number[] = [];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const arm = R * BRACKET_ARM;
  const push = (ax: number, ay: number, bx: number, by: number) => {
    "worklet";
    out.push(
      cx + ax * c - ay * s,
      cy + ax * s + ay * c,
      cx + bx * c - by * s,
      cy + bx * s + by * c,
    );
  };
  for (let q = 0; q < 4; q++) {
    const sx = q === 0 || q === 3 ? -1 : 1;
    const sy = q < 2 ? -1 : 1;
    push(sx * R, sy * R, sx * (R - arm), sy * R);
    push(sx * R, sy * R, sx * R, sy * (R - arm));
  }
  const t = Math.min(BRACKET_TICK, R * 0.3);
  push(0, -R, 0, -R + t);
  push(R, 0, R - t, 0);
  push(0, R, 0, R - t);
  push(-R, 0, -R + t, 0);
  return out;
}

/** Smallest-ish circle around several bodies (centroid + farthest edge). */
export function hullCircle(
  points: readonly { x: number; y: number; r: number }[],
): { x: number; y: number; r: number } | null {
  "worklet";
  if (points.length === 0) return null;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < points.length; i++) {
    sx += points[i].x;
    sy += points[i].y;
  }
  const x = sx / points.length;
  const y = sy / points.length;
  let r = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    r = Math.max(r, Math.hypot(p.x - x, p.y - y) + bracketRadius(p.r));
  }
  return { x, y, r };
}

// --- Feedback -------------------------------------------------------------------

export interface PingRing {
  /** dp added to the start radius. */
  grow: number;
  alpha: number;
}

/**
 * Sonar ping from a body edge for timer `u` (0..1): two rings, the second an
 * echo. Reduced motion: one static ring that only fades (≤150 ms timer).
 */
export function pingRings(u: number, reduced: boolean): PingRing[] {
  "worklet";
  if (!(u >= 0) || u >= 1) return [];
  if (reduced) return [{ grow: 4, alpha: PING_ALPHA * (1 - u) }];
  const out: PingRing[] = [];
  for (let k = 0; k < 2; k++) {
    const v = clamp01((u - k * PING_ECHO) / (1 - PING_ECHO));
    if (v <= 0 || v >= 1) continue;
    const fade = (1 - v) * (1 - v);
    out.push({
      grow: PING_GROW * easeOutCubic(v),
      alpha: PING_ALPHA * fade * (k === 0 ? 1 : 0.55),
    });
  }
  return out;
}

/**
 * Empty-space ripple on the world plane: radius in screen dp at zoom 1 (the
 * caller divides by zoom under the plane homography) and alpha.
 */
export function rippleRings(u: number, reduced: boolean): PingRing[] {
  "worklet";
  if (!(u >= 0) || u >= 1) return [];
  if (reduced) return [{ grow: RM_RING_DP, alpha: RIPPLE_ALPHA * (1 - u) }];
  const out: PingRing[] = [];
  for (let k = 0; k < 2; k++) {
    const v = clamp01((u - k * PING_ECHO) / (1 - PING_ECHO));
    if (v <= 0 || v >= 1) continue;
    out.push({
      grow: RIPPLE_DP * easeOutCubic(v) * (k === 0 ? 1 : 0.62),
      alpha: RIPPLE_ALPHA * (1 - v) * (1 - v),
    });
  }
  return out;
}

/** Polaris flare for timer `u`: spike length (dp), ring radius (dp), alpha. */
export function northFlare(
  u: number,
  reduced: boolean,
): { spike: number; ring: number; alpha: number } | null {
  "worklet";
  if (!(u >= 0) || u >= 1) return null;
  if (reduced) return { spike: 10, ring: 10, alpha: 1 - u };
  const e = easeOutCubic(u);
  return { spike: 10 + 34 * e, ring: 8 + 30 * e, alpha: (1 - u) * (1 - u) };
}

/** The reorder candidate slot of the held body (−1 when unknown). */
export function reorderSlot(
  drag: { id: number; reorderedVisibleIds: readonly number[] } | null,
): number {
  "worklet";
  if (!drag) return -1;
  return drag.reorderedVisibleIds.indexOf(drag.id);
}

/** Slot flash stroke growth and alpha for timer `u`. */
export function slotFlash(
  u: number,
  reduced: boolean,
): { widthDp: number; alpha: number } | null {
  "worklet";
  if (!(u >= 0) || u >= 1) return null;
  if (reduced) return { widthDp: 3, alpha: 0.6 * (1 - u) };
  return { widthDp: 3 + 12 * easeOutCubic(u), alpha: 0.55 * (1 - u) * (1 - u) };
}

/**
 * Which body (key) a tap at (x, y) pinged: the nearest visible interactive body
 * whose hit circle contains the point, or null.
 */
export function pingTarget(
  bodies: readonly FrameBody[],
  x: number,
  y: number,
): string | null {
  "worklet";
  let best: string | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    if (!b.visible || b.interactive === false) continue;
    const d = Math.hypot(x - b.x, y - b.y);
    if (d <= b.hitRadius && d < bestD) {
      bestD = d;
      best = bodyKey(b);
    }
  }
  return best;
}
