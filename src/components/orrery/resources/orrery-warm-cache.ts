/**
 * The Orrery warm cache (38.7-15, D-58) — a BOUNDED reusable resource cache
 * that survives an ordinary tab blur, so returning to the Orrery tab reuses
 * the decoded photos, shaped Paragraphs and baked sky instead of rebuilding
 * them. It clarifies, and does not contradict, ADR-170.
 *
 * TWO LIFECYCLES, kept separate:
 *   - the ACTIVE render lifecycle (canvas, the one ambient clock, every GPU
 *     surface including the base bake) still stops and releases on blur and
 *     background exactly as before (ADR-170 / ADR-048 single clock);
 *   - this REUSABLE cache keeps CPU-backed objects only (M15): decoded photo
 *     images (`orreryPhotoCache`), Paragraphs (`orreryTextService`) and the
 *     CPU-baked nebula (`orrerySkyWarmStore`). A GPU texture (a snapshot, the
 *     base bake) is never retained; an image of unknown backing is disposed.
 *
 * THE WARM OWNER NEVER PINS (contract rule 7). It holds keys/marks, never
 * pictures: every retained object is an ordinary warm (unheld) cache entry,
 * counted against the caches' own hard caps and evictable at admission at any
 * time (C-M1: a saturated cap evicts warm entries before it refuses anything).
 * Its own caps are HARD bounds applied before `retainOnBlur` returns:
 *   photos + Paragraphs × ORRERY_WARM_PARAGRAPH_BYTES + sky images
 *   ≤ ORRERY_WARM_MAX_BYTES, Paragraphs ≤ ORRERY_WARM_MAX_PARAGRAPHS, sky
 *   images ≤ ORRERY_WARM_MAX_SKY_IMAGES — for any workload (All Contacts too).
 *
 * WHEN (Plan 07's `<resource_lifetime_contract>` rule 3, consumed, not
 * redefined): the world's unmount stops the clock and detaches the pictures,
 * and only after one UI round trip calls `retainOnBlur` — which TRANSFERS the
 * world's released objects to the warm owner — before the ledger teardown
 * disposes the rest of the epoch in reverse creation order. Late acks and late
 * decodes of the ended epoch stay discarded (the ledger and the photo cache).
 *
 * RELEASE: everything goes on app background (and nothing is retained while
 * the app is not active — background wins in either event order), after
 * ORRERY_WARM_IDLE_TIMEOUT_MS without a return (a foreground JS timer;
 * nothing runs in the background), and on a platform memory warning. React
 * Native's Android runtime emits no `memoryWarning` AppState event (verified
 * 2026-10-02: no emitter in ReactAndroid); the subscription is kept for the
 * platforms that do.
 *
 * JS thread only; no React; every cache is injectable (node-testable with fakes).
 */
import type { SkImage } from "@shopify/react-native-skia";
import { orrerySkyWarmStore } from "../v2/nebula-bake";
import { type OrreryPhotoCache, orreryPhotoCache } from "./orrery-photo-cache";
import {
  type OrreryTextService,
  orreryTextService,
} from "./orrery-text-service";

// --- Tunable constants (top-of-file per project convention) ------------------

/**
 * The warm set's shared byte budget: retained photo bytes + an estimate per
 * Paragraph + the sky images. Conservative start (Plan 16's release G7 run,
 * the 38.6 D-11 method, judges it; tighten here if Graphics/GL grows > 5 %).
 */
export const ORRERY_WARM_MAX_BYTES = 64 * 1024 * 1024;
/**
 * Warm Paragraphs kept across a blur (each also reports 1 MiB of external
 * pressure to Hermes). 38.7-08 measured ≤ 24 warm / 15 pinned at the Size 120
 * and All Contacts overviews, so 128 covers a return with room to spare.
 */
export const ORRERY_WARM_MAX_PARAGRAPHS = 128;
/** The estimated native size of one shaped Paragraph, for the byte budget. */
export const ORRERY_WARM_PARAGRAPH_BYTES = 16 * 1024;
/** Baked sky images kept (one per package × mode × size bucket). */
export const ORRERY_WARM_MAX_SKY_IMAGES = 4;
/** Release everything when the Orrery has not been revisited for this long. */
export const ORRERY_WARM_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

/** The warm owner's id (documentation and stats; it never pins). */
export const ORRERY_WARM_OWNER = "orrery-warm";

export type OrreryWarmReleaseReason = "background" | "idle" | "memory";

/** How an image is backed (M15: only "cpu" may be retained across a blur). */
export type OrreryWarmBacking = "cpu" | "texture" | "unknown";

/** A sky image the world hands over at blur. */
export interface OrreryWarmSky {
  key: string;
  image: SkImage;
  backing: OrreryWarmBacking;
}

/** What one world's unmount hands to the warm owner (after the round trip). */
export interface OrreryWarmHandoff {
  /** The world's photo-cache owner and its released mount epoch. */
  photos?: { owner: string; epoch: number } | null;
  /** The world's text owner and its released epoch. */
  text?: { owner: string; epoch: number } | null;
  /** The world's live baked sky images. */
  skies?: readonly OrreryWarmSky[];
}

/** The sky store surface the warm owner needs (`orrerySkyWarmStore`). */
export interface OrreryWarmSkyStore {
  put(entry: OrreryWarmSky): boolean;
  trim(maxImages: number): number;
  clear(): number;
  size(): number;
  bytes(): number;
}

/** The AppState surface the warm owner subscribes to (react-native's AppState). */
export interface OrreryWarmAppState {
  currentState: string | null | undefined;
  addEventListener(
    type: "change" | "memoryWarning",
    listener: (state?: string) => void,
  ): { remove(): void };
}

export interface OrreryWarmLimits {
  maxBytes: number;
  maxParagraphs: number;
  paragraphBytes: number;
  maxSkyImages: number;
  idleTimeoutMs: number;
}

export interface OrreryWarmCacheDeps {
  photos: Pick<
    OrreryPhotoCache,
    "handOffWarm" | "trimWarm" | "clearUnheld" | "stats"
  >;
  text: Pick<
    OrreryTextService,
    "handOffWarm" | "trimWarm" | "clearUnheld" | "stats"
  >;
  sky: OrreryWarmSkyStore;
  setTimeout?: (run: () => void, ms: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
  limits?: Partial<OrreryWarmLimits>;
}

export interface OrreryWarmStats {
  /** Retained-and-not-yet-released visits ("warm" while blurred). */
  state: "cold" | "warm" | "resumed";
  appState: string;
  photos: number;
  photoBytes: number;
  paragraphs: number;
  skies: number;
  /** The warm set's budgeted bytes (photos + Paragraph estimate + sky). */
  bytes: number;
  releases: Readonly<Record<OrreryWarmReleaseReason, number>>;
  idleTimer: boolean;
}

export interface OrreryWarmCache {
  readonly limits: Readonly<OrreryWarmLimits>;
  /**
   * The world's unmount, at the contract's hand-off step (clock stopped,
   * pictures detached, one UI round trip done). Transfers the world's
   * released objects to the warm owner and trims to the warm caps before it
   * returns; while the app is not active it releases instead. Arms the idle
   * timer — IN-01: only when no world is mounted any more (each call ends one
   * `resumeOnFocus`; a world that remounted before this world's round trip
   * finished keeps the warm set, with no idle release under it). Returns what
   * it did.
   */
  retainOnBlur(handoff: OrreryWarmHandoff): "retained" | "released";
  /**
   * A world mounted: the idle timer stops; warm entries are reusable. Each
   * call is matched by that world's later `retainOnBlur`.
   */
  resumeOnFocus(): void;
  /** Disposes the whole warm set (every unheld entry in each cache). */
  release(reason: OrreryWarmReleaseReason): void;
  /** True while a retain would keep anything (the app is active). */
  accepting(): boolean;
  /** Feeds the current AppState (the subscription calls it; tests may too). */
  noteAppState(state: string | null | undefined): void;
  /**
   * Subscribes to AppState `change` (background → release) and
   * `memoryWarning` (→ release). Idempotent; returns the unsubscribe.
   */
  attach(appState: OrreryWarmAppState): () => void;
  stats(): OrreryWarmStats;
}

export const DEFAULT_ORRERY_WARM_LIMITS: Readonly<OrreryWarmLimits> =
  Object.freeze({
    maxBytes: ORRERY_WARM_MAX_BYTES,
    maxParagraphs: ORRERY_WARM_MAX_PARAGRAPHS,
    paragraphBytes: ORRERY_WARM_PARAGRAPH_BYTES,
    maxSkyImages: ORRERY_WARM_MAX_SKY_IMAGES,
    idleTimeoutMs: ORRERY_WARM_IDLE_TIMEOUT_MS,
  });

export function createOrreryWarmCache(
  deps: OrreryWarmCacheDeps,
): OrreryWarmCache {
  const limits: OrreryWarmLimits = {
    ...DEFAULT_ORRERY_WARM_LIMITS,
    ...deps.limits,
  };
  const arm =
    deps.setTimeout ?? ((run: () => void, ms: number) => setTimeout(run, ms));
  const disarm =
    deps.clearTimeout ??
    ((handle: unknown) =>
      clearTimeout(handle as ReturnType<typeof setTimeout>));
  let appState = "active";
  let state: OrreryWarmStats["state"] = "cold";
  let idle: unknown = null;
  /** IN-01: worlds mounted (resumeOnFocus) whose hand-off has not run yet. */
  let mountedWorlds = 0;
  let attached: { appState: OrreryWarmAppState; detach: () => void } | null =
    null;
  const releases: Record<OrreryWarmReleaseReason, number> = {
    background: 0,
    idle: 0,
    memory: 0,
  };

  function stopIdle(): void {
    if (idle !== null) disarm(idle);
    idle = null;
  }

  function release(reason: OrreryWarmReleaseReason): void {
    stopIdle();
    releases[reason]++;
    state = "cold";
    // Everything unheld goes: the warm owner's entries and any other unheld
    // entry. Pinned (a mounted world's or the Preview's current generation)
    // and retired-awaiting-ack entries are never touched.
    deps.photos.clearUnheld();
    deps.text.clearUnheld();
    deps.sky.clear();
  }

  /** The caps, in this order: sky count, Paragraph count, then the bytes. */
  function trim(): void {
    deps.sky.trim(limits.maxSkyImages);
    deps.text.trimWarm(limits.maxParagraphs);
    const textBytes = deps.text.stats().warm * limits.paragraphBytes;
    const photoBudget = limits.maxBytes - deps.sky.bytes() - textBytes;
    deps.photos.trimWarm(Math.max(0, photoBudget));
  }

  const cache: OrreryWarmCache = {
    limits,
    retainOnBlur(handoff) {
      const skies = handoff.skies ?? [];
      mountedWorlds = Math.max(0, mountedWorlds - 1);
      if (!cache.accepting()) {
        // Background wins: hand the objects back as unheld, then drop all.
        if (handoff.photos)
          deps.photos.handOffWarm(handoff.photos.owner, handoff.photos.epoch);
        if (handoff.text)
          deps.text.handOffWarm(handoff.text.owner, handoff.text.epoch);
        for (const sky of skies) disposeQuietly(sky.image);
        release("background");
        return "released";
      }
      if (handoff.photos)
        deps.photos.handOffWarm(handoff.photos.owner, handoff.photos.epoch);
      if (handoff.text)
        deps.text.handOffWarm(handoff.text.owner, handoff.text.epoch);
      // M15: `put` disposes anything not CPU-backed.
      for (const sky of skies) deps.sky.put(sky);
      trim();
      stopIdle();
      if (mountedWorlds > 0) {
        // IN-01: another world is already on screen (a fast remount): the
        // warm set is its to reuse, and no idle release may run under it.
        state = "resumed";
        return "retained";
      }
      state = "warm";
      idle = arm(() => {
        idle = null;
        release("idle");
      }, limits.idleTimeoutMs);
      return "retained";
    },
    resumeOnFocus() {
      mountedWorlds++;
      stopIdle();
      if (state === "warm") state = "resumed";
    },
    release,
    accepting: () => appState === "active",
    noteAppState(next) {
      appState = next ?? "active";
      if (appState !== "active") release("background");
    },
    attach(source) {
      if (attached?.appState === source) return attached.detach;
      attached?.detach();
      cache.noteAppState(source.currentState);
      const change = source.addEventListener("change", (next) => {
        cache.noteAppState(next);
      });
      const memory = (() => {
        try {
          return source.addEventListener("memoryWarning", () => {
            release("memory");
          });
        } catch {
          return null;
        }
      })();
      const detach = () => {
        change.remove();
        memory?.remove();
        if (attached?.detach === detach) attached = null;
      };
      attached = { appState: source, detach };
      return detach;
    },
    stats() {
      const photo = deps.photos.stats();
      const text = deps.text.stats();
      return {
        state,
        appState,
        photos: photo.warm,
        photoBytes: photo.warmBytes,
        paragraphs: text.warm,
        skies: deps.sky.size(),
        bytes:
          photo.warmBytes +
          text.warm * limits.paragraphBytes +
          deps.sky.bytes(),
        releases: { ...releases },
        idleTimer: idle !== null,
      };
    },
  };
  return cache;
}

function disposeQuietly(image: SkImage): void {
  try {
    image.dispose?.();
  } catch {
    // Already released by the runtime.
  }
}

/** The app-wide warm owner over the shared caches and the warm sky store. */
export const orreryWarmCache: OrreryWarmCache = createOrreryWarmCache({
  photos: orreryPhotoCache,
  text: orreryTextService,
  sky: orrerySkyWarmStore,
});
