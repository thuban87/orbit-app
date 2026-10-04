/**
 * 38.7-11 (D-18/D-21/D-55): what focus does to the world, as pure worklet
 * maths (no Skia), shared by the body, ring, label and overlay pictures.
 *
 * - `FocusSpec` (JS-built, written to a SharedValue by OrreryWorld on a focus
 *   change only): the emphasised body keys (the focused person, a focused
 *   moon, or the open cluster's members), the parents whose moons stay
 *   undimmed, the one body that carries the reticle (single focus only) and
 *   the resolved mode's ring dim.
 * - `FocusDraw`: that spec plus the two animated values the pictures read —
 *   `mix` (Lab B's world response, 0 → 1 over FOCUS_MIX_MS) and `lock` (Lab
 *   A's reticle lock-on timeline, 0 → RETICLE_LOCK_END). Both are Reanimated
 *   timings, never React state, and instant under reduced motion.
 *
 * Lab B kept the previous keys while `mix` faded back to 0 on a clear, so the
 * release fades instead of snapping; OrreryWorld does the same.
 * Worklet helpers are defined above their callers (Hermes forward-ref rule).
 */
import type { CameraRect } from "@/logic/orrery-camera-logic";
import type { FocusCardRect } from "@/logic/orrery-focus-card-logic";
import type { ResolvedMode } from "@/theme/theme-types";
import {
  FOCUS_DIM,
  LABEL_DIM_FLOOR,
  OCCLUDE_PAD_DP,
  OCCLUDED_BODY_ALPHA,
  RETICLE_LOCK_END,
  RING_FOCUS_DIM,
} from "./visual-tunables";

export interface FocusSpec {
  /** Emphasised (never dimmed) body keys; empty = nothing focused. */
  keys: Readonly<Record<string, true>>;
  /** True when `keys` is non-empty. */
  active: boolean;
  /** Parent ids whose moons stay undimmed (the focused people). */
  parents: Readonly<Record<number, true>>;
  /** The one body key that carries the reticle (single focus), or null. */
  reticle: string | null;
  /** Other orbits keep 1 − ringDim of their alpha at full focus. */
  ringDim: number;
}
export const NO_FOCUS_SPEC: FocusSpec = Object.freeze({
  keys: Object.freeze({}),
  active: false,
  parents: Object.freeze({}),
  reticle: null,
  ringDim: 0,
});

/** What the pictures read (one derived value over the spec and timings). */
export interface FocusDraw {
  spec: FocusSpec;
  /** World response, 0..1. */
  mix: number;
  /** Reticle lock-on timeline, 0..RETICLE_LOCK_END. */
  lock: number;
}
export const NO_FOCUS_DRAW: FocusDraw = Object.freeze({
  spec: NO_FOCUS_SPEC,
  mix: 0,
  lock: RETICLE_LOCK_END,
});

/** A body resource as the spec builder needs it. */
interface FocusResource {
  key: string;
  body: { id: number; kind: string };
}

/**
 * JS only. Single focus: the focused contact/sun (reticle on it). An open
 * cluster: its members (no reticle; the cluster panel is the focus). A
 * focused moon: the moon (reticle on it).
 */
export function buildFocusSpec(
  resources: readonly FocusResource[],
  focusedIds: readonly number[],
  clusterIds: readonly number[],
  satelliteKey: string | null,
  mode: ResolvedMode,
): FocusSpec {
  const ringDim = RING_FOCUS_DIM[mode];
  if (satelliteKey)
    return {
      keys: { [satelliteKey]: true },
      active: true,
      parents: {},
      reticle: satelliteKey,
      ringDim,
    };
  const ids = clusterIds.length > 0 ? clusterIds : focusedIds;
  if (ids.length === 0) return { ...NO_FOCUS_SPEC, ringDim };
  const wanted = new Set(ids);
  const keys: Record<string, true> = {};
  const parents: Record<number, true> = {};
  let reticle: string | null = null;
  for (const resource of resources) {
    if (resource.body.kind === "satellite" || !wanted.has(resource.body.id))
      continue;
    keys[resource.key] = true;
    parents[resource.body.id] = true;
    if (clusterIds.length === 0 && focusedIds.length === 1 && reticle === null)
      reticle = resource.key;
  }
  const active = Object.keys(keys).length > 0;
  return { keys, active, parents, reticle, ringDim };
}

/** True while focus is dimming the world at all. */
function focusLive(focus: FocusDraw | null): boolean {
  "worklet";
  return !!focus && focus.spec.active && focus.mix > 0;
}

/**
 * D-21: a body's defocus amount (0 = untouched … FOCUS_DIM). The sun, the
 * emphasised bodies and a focused parent's moons are never dimmed.
 */
export function bodyDefocus(
  focus: FocusDraw | null,
  key: string,
  kind: string,
  parentId: number | null,
): number {
  "worklet";
  if (!focus || !focusLive(focus) || kind === "sun") return 0;
  if (focus.spec.keys[key] === true) return 0;
  if (parentId !== null && focus.spec.parents[parentId] === true) return 0;
  return FOCUS_DIM * Math.min(1, focus.mix);
}

/** D-21: an orbit's alpha factor (1 for the emphasised bodies' orbits). */
export function ringFocusFactor(focus: FocusDraw | null, key: string): number {
  "worklet";
  if (!focus || !focusLive(focus) || focus.spec.keys[key] === true) return 1;
  return 1 - focus.spec.ringDim * Math.min(1, focus.mix);
}

/**
 * D-21: a label's TEXT alpha factor — other labels dim toward
 * LABEL_DIM_FLOOR, never below it; emphasised bodies' and the sun's labels
 * are untouched (labels stay readable).
 */
export function labelTextAlpha(focus: FocusDraw | null, key: string): number {
  "worklet";
  if (
    !focus ||
    !focusLive(focus) ||
    focus.spec.keys[key] === true ||
    key.startsWith("sun:")
  )
    return 1;
  return Math.max(
    LABEL_DIM_FLOOR,
    1 - (1 - LABEL_DIM_FLOOR) * Math.min(1, focus.mix),
  );
}

/**
 * The label allocator's exclusions: every visible body's disc box and (C-M2:
 * the card is no viewport obstacle) the docked focus card, so no label is
 * placed under it.
 */
export function labelExclusions(
  bodies: readonly {
    x: number;
    y: number;
    radius: number;
    visible: boolean;
  }[],
  card: FocusCardRect | null,
): CameraRect[] {
  "worklet";
  const out: CameraRect[] = [];
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    if (!b.visible) continue;
    out.push({
      x: b.x - b.radius,
      y: b.y - b.radius,
      width: b.radius * 2,
      height: b.radius * 2,
    });
  }
  if (card?.visible && card.width > 0 && card.height > 0)
    out.push({ x: card.x, y: card.y, width: card.width, height: card.height });
  return out;
}

/**
 * D-55 (H5): the occlusion rects — the static panels (measured obstacle
 * rects, canvas coordinates) plus the focus card's UI-thread rect.
 */
export function collectOcclusion(
  statics: readonly CameraRect[],
  card: FocusCardRect | null,
): CameraRect[] {
  "worklet";
  const out: CameraRect[] = [];
  for (let i = 0; i < statics.length; i++) out.push(statics[i]);
  if (card?.visible && card.width > 0 && card.height > 0)
    out.push({ x: card.x, y: card.y, width: card.width, height: card.height });
  return out;
}

/**
 * 38.7-14 (T-DIM, ORRERY_OCCLUSION_STYLE "lab-b"): true when the box
 * [x0, x1] × [y0, y1] touches any occlusion rect grown by `pad` (Lab B
 * `underCard`). Non-finite or empty rects never occlude.
 */
export function touchesOcclusion(
  rects: readonly CameraRect[] | null,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  pad: number,
): boolean {
  "worklet";
  if (!rects) return false;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (
      !(r.width > 0) ||
      !(r.height > 0) ||
      !Number.isFinite(r.x) ||
      !Number.isFinite(r.y)
    )
      continue;
    if (
      x1 >= r.x - pad &&
      x0 <= r.x + r.width + pad &&
      y1 >= r.y - pad &&
      y0 <= r.y + r.height + pad
    )
      return true;
  }
  return false;
}

/**
 * Lab B R1: the alpha factor for a body at (x, y) whose drawn reach is
 * `reach` dp — OCCLUDED_BODY_ALPHA when it touches an occlusion rect (padded
 * OCCLUDE_PAD_DP), else 1. `rects` is null outside the "lab-b" style.
 */
export function occludedBodyAlpha(
  rects: readonly CameraRect[] | null,
  x: number,
  y: number,
  reach: number,
): number {
  "worklet";
  const r = reach > 0 ? reach : 0;
  return touchesOcclusion(rects, x - r, y - r, x + r, y + r, OCCLUDE_PAD_DP)
    ? OCCLUDED_BODY_ALPHA
    : 1;
}
