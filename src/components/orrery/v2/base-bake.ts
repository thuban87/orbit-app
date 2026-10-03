/**
 * 38.7-08 (D-49, H3/C-H2): the static base baked to a device-pixel texture
 * while the scene is still.
 *
 * WHY: every ambient tick (D-49, ~30 Hz) re-records the stars and sun
 * pictures, and the canvas then replays EVERY layer — including the base:
 * the background plus one runtime-shaded ring per contact (120 at Size 120,
 * ~1,000 at All Contacts). Once nothing the base draws has changed for
 * BAKE_AFTER_STILL_TICKS ambient ticks, the base is drawn once into an
 * offscreen GPU surface and the base layer blits that image instead.
 * Anything that moves the base (a pan, pinch, focus flight, switch, theme or
 * ring change) falls straight back to the live picture; a bake never happens
 * during a switch or while a gesture or camera motion is active.
 *
 * LIFETIME (Plan 07's `<resource_lifetime_contract>`, consumed, not redefined):
 * - every snapshot is a native object of the `base` layer's generation in the
 *   generation ledger (`resources/orrery-generation-ledger.ts`), handle
 *   `baseHandle(mountEpoch, id)`;
 * - the base picture acks `(base, generation, mountEpoch)` like every other
 *   layer (forwarded to JS one UI frame later; no shared recorded generation);
 * - a snapshot is disposed only when the ledger reports it retirable (the
 *   base layer acked a newer generation in the same epoch);
 * - a snapshot whose bake result reaches JS with a stale mount epoch is
 *   disposed at once and never published;
 * - on unmount the remaining snapshots, then the offscreen surface, are
 *   disposed on the UI thread at the contract's teardown step.
 * The native objects live only on the UI runtime (a registry SharedValue);
 * JS holds numeric ids and disposes through `runOnUI`.
 *
 * Worklet helpers are defined above their callers (Hermes forward-ref rule).
 */
import {
  createPicture,
  FilterMode,
  MipmapMode,
  type SkImage,
  Skia,
  type SkPicture,
  type SkSurface,
} from "@shopify/react-native-skia";
import type { OrreryGenerationLedger } from "../resources/orrery-generation-ledger";
import { baseHandle, ORRERY_LAYER } from "./scene-specs";

/**
 * Ambient ticks (at AMBIENT_HZ) the base must stay unchanged before it is
 * baked (~0.5 s at 30 Hz). Tunable.
 */
export const BAKE_AFTER_STILL_TICKS = 15;

// ── Decision (pure) ───────────────────────────────────────────────────────

export interface BakeState {
  /** "live": drawing the live picture; "baked": drawing a snapshot;
   *  "unavailable": a bake failed (no offscreen surface) — retried only
   *  after the scene changes. */
  phase: "live" | "baked" | "unavailable";
  /** Consecutive still ambient ticks since the last change. */
  still: number;
  /** The last ambient tick seen (−1 = none). */
  lastTick: number;
}

export const INITIAL_BAKE_STATE: BakeState = Object.freeze({
  phase: "live",
  still: 0,
  lastTick: -1,
}) as BakeState;

export interface BakeInputs {
  /** The quantised ambient tick (ms), or −1 when no ambient clock runs. */
  tick: number;
  /** Something the base draws changed (frame pose, sky or ring specs). */
  sceneChanged: boolean;
  /** A switch, a gesture or a camera motion is in progress. */
  busy: boolean;
  /** The current ledger mount epoch (0 = none yet: never bake). */
  mountEpoch: number;
}

export type BakeAction = "none" | "bake" | "invalidate";

/**
 * The bake state machine. Change or busy → live (an existing bake is
 * invalidated); each new ambient tick while still and idle counts; at
 * BAKE_AFTER_STILL_TICKS the base is baked once. No ambient clock (reduced
 * motion) → nothing redraws at idle, so nothing is baked.
 */
export function nextBakeState(
  state: BakeState,
  inputs: BakeInputs,
): { state: BakeState; action: BakeAction } {
  "worklet";
  if (inputs.sceneChanged || inputs.busy) {
    return {
      state: { phase: "live", still: 0, lastTick: inputs.tick },
      action: state.phase === "baked" ? "invalidate" : "none",
    };
  }
  if (inputs.tick < 0 || inputs.tick === state.lastTick)
    return { state, action: "none" };
  const still = state.still + 1;
  if (
    state.phase === "live" &&
    still >= BAKE_AFTER_STILL_TICKS &&
    inputs.mountEpoch > 0
  )
    return {
      state: { phase: "baked", still, lastTick: inputs.tick },
      action: "bake",
    };
  return {
    state: { phase: state.phase, still, lastTick: inputs.tick },
    action: "none",
  };
}

/** A failed bake: stay live until the scene changes. */
export function bakeUnavailable(state: BakeState): BakeState {
  "worklet";
  return { phase: "unavailable", still: state.still, lastTick: state.lastTick };
}

// ── What the base layer draws (the spec its picture reads) ────────────────

export interface BakedBase {
  /** Strictly increasing per mount; 0 = nothing published yet. */
  generation: number;
  mountEpoch: number;
  /** The snapshot picture, or null while the base draws live. */
  picture: SkPicture | null;
  /** The live picture the snapshot was baked from. */
  source: SkPicture | null;
  /** The snapshot's registry id, or null while live. */
  id: number | null;
}

export const LIVE_BASE: BakedBase = Object.freeze({
  generation: 0,
  mountEpoch: 0,
  picture: null,
  source: null,
  id: null,
}) as BakedBase;

/**
 * The base layer's picture: the snapshot only while it was baked from the
 * picture that is live NOW (so a stale snapshot is never shown for even one
 * frame after the scene moves), else the live picture. A pure read.
 */
export function selectBasePicture(
  baked: BakedBase,
  live: SkPicture,
): SkPicture {
  "worklet";
  return baked.picture !== null && baked.source === live ? baked.picture : live;
}

// ── UI-thread registry (native objects never leave the UI runtime) ────────

export interface BakeSnapshot {
  image: SkImage;
  picture: SkPicture;
}

export interface BakeRegistry {
  surface: SkSurface | null;
  /** The surface size in device pixels. */
  width: number;
  height: number;
  nextId: number;
  snapshots: Readonly<Record<number, BakeSnapshot>>;
}

export const EMPTY_BAKE_REGISTRY: BakeRegistry = Object.freeze({
  surface: null,
  width: 0,
  height: 0,
  nextId: 1,
  snapshots: Object.freeze({}),
}) as BakeRegistry;

/** A SharedValue-shaped holder (the canvas passes its registry SharedValue). */
export interface RegistryRef {
  value: BakeRegistry;
}

function disposeSnapshot(snapshot: BakeSnapshot | undefined): void {
  "worklet";
  if (!snapshot) return;
  snapshot.picture.dispose?.();
  snapshot.image.dispose?.();
}

/**
 * UI thread: draws `live` into the (reused) device-pixel offscreen surface,
 * snapshots it and records a one-blit picture of the snapshot. Returns the
 * snapshot's id and picture, or null when no offscreen surface can be made
 * (the base then stays live).
 */
export function bakeBaseSnapshot(
  registry: RegistryRef,
  live: SkPicture,
  width: number,
  height: number,
  dpr: number,
): { id: number; picture: SkPicture } | null {
  "worklet";
  const pw = Math.ceil(width * dpr);
  const ph = Math.ceil(height * dpr);
  if (!(pw > 0 && ph > 0)) return null;
  const current = registry.value;
  let surface = current.surface;
  if (!surface || current.width !== pw || current.height !== ph) {
    const make = Skia.Surface?.MakeOffscreen;
    const next = typeof make === "function" ? make(pw, ph) : null;
    if (!next) return null;
    // Existing snapshots keep their own reference to their pixels.
    surface?.dispose?.();
    surface = next;
  }
  const target = surface.getCanvas();
  target.clear(Float32Array.of(0, 0, 0, 0));
  target.save();
  target.scale(dpr, dpr);
  target.drawPicture(live);
  target.restore();
  surface.flush();
  const image = surface.makeImageSnapshot();
  const id = current.nextId;
  // One device pixel per texel: an exact 1:1 blit.
  const picture = createPicture(
    (canvas) => {
      canvas.drawImageRectOptions(
        image,
        Skia.XYWHRect(0, 0, pw, ph),
        Skia.XYWHRect(0, 0, pw / dpr, ph / dpr),
        FilterMode.Nearest,
        MipmapMode.None,
      );
    },
    { width, height },
  );
  registry.value = {
    surface,
    width: pw,
    height: ph,
    nextId: id + 1,
    snapshots: { ...current.snapshots, [id]: { image, picture } },
  };
  return { id, picture };
}

/** UI thread: disposes the given snapshots (unknown ids are ignored). */
export function disposeBakedSnapshots(
  registry: RegistryRef,
  ids: readonly number[],
): void {
  "worklet";
  const current = registry.value;
  const snapshots: Record<number, BakeSnapshot> = { ...current.snapshots };
  let changed = false;
  for (let i = 0; i < ids.length; i++) {
    const snapshot = snapshots[ids[i]];
    if (!snapshot) continue;
    disposeSnapshot(snapshot);
    delete snapshots[ids[i]];
    changed = true;
  }
  if (changed) registry.value = { ...current, snapshots };
}

/**
 * UI thread, the contract's teardown step: the ledger's snapshots in the
 * order given (reverse creation), then anything left (newest first), then
 * the offscreen surface (created before every snapshot, so disposed last).
 */
export function teardownBakeRegistry(
  registry: RegistryRef,
  ids: readonly number[],
): number {
  "worklet";
  const current = registry.value;
  const snapshots: Record<number, BakeSnapshot> = { ...current.snapshots };
  let disposed = 0;
  for (let i = 0; i < ids.length; i++) {
    if (!snapshots[ids[i]]) continue;
    disposeSnapshot(snapshots[ids[i]]);
    delete snapshots[ids[i]];
    disposed++;
  }
  const rest = Object.keys(snapshots)
    .map(Number)
    .sort((a, b) => b - a);
  for (let i = 0; i < rest.length; i++) {
    disposeSnapshot(snapshots[rest[i]]);
    disposed++;
  }
  current.surface?.dispose?.();
  registry.value = { ...EMPTY_BAKE_REGISTRY, nextId: current.nextId };
  return disposed;
}

// ── JS side: publication through the generation ledger ────────────────────

export interface BaseBakeOwner {
  /**
   * UI → JS (runOnJS): the base layer's spec is now `generation` of
   * `mountEpoch`, drawing snapshot `id` (or the live picture when null).
   * A snapshot of a stale epoch is disposed at once and never published.
   */
  published(mountEpoch: number, generation: number, id: number | null): boolean;
}

export function createBaseBakeOwner(options: {
  ledger: OrreryGenerationLedger<string>;
  /** Disposes snapshot ids on the UI thread (runOnUI in the app). */
  dispose: (ids: number[]) => void;
}): BaseBakeOwner {
  const { ledger, dispose } = options;
  return {
    published(mountEpoch, generation, id) {
      if (id !== null) {
        if (!ledger.admitResult(mountEpoch, id, (stale) => dispose([stale])))
          return false;
      } else if (!ledger.isCurrent(mountEpoch)) return false;
      // A refused publish (a non-increasing generation) is NOT disposed here:
      // the mounted base picture may already draw it. It stays in the UI
      // registry, which the unmount teardown empties.
      return ledger.publish(
        generation,
        [ORRERY_LAYER.base],
        id === null ? [] : [baseHandle(mountEpoch, id)],
      );
    },
  };
}
