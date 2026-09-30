/**
 * useOrreryPhoto (D-11) — the orrery's photo loader for the Skia bodies
 * (`OrbitBody`, `SunBody`), replacing Skia's `useImage`.
 *
 * WHY: expo-image surfaces decode at display size, but Skia decodes a photo at
 * FULL size into a GPU texture. New masters are up to 1024 px (D-10), so a plain
 * `useImage` would quadruple each planet's texture. This hook keeps the orrery at
 * today's level: a master ≤ `ORRERY_TEXTURE_MAX` (every legacy 512 JPEG master and
 * every imported thumbnail) is passed through exactly as before; a larger master
 * is downsampled once to 512 by the manipulator and only the small image is
 * drawn. The large image is created only to read its header (deferred decode) and
 * is disposed undrawn.
 *
 * MEMORY BOUNDS (D-11):
 *   - Only the small ENCODED bytes (base64 strings) are cached across mounts, per
 *     path + display revision, in an LRU bounded by BYTES
 *     (`ORRERY_DERIVATIVE_CACHE_BYTES`). SkImage objects are never cached.
 *   - At most `ORRERY_DOWNSAMPLE_CONCURRENCY` downsamples run at once (a
 *     module-level FIFO queue), so a first Orrery mount never decodes N large
 *     masters in parallel.
 *
 * SkImage OWNERSHIP: the hook owns exactly the image it published. Skia re-reads
 * the image prop on every Canvas re-record (`sksg/Recorder/commands/Drawing.ts`
 * calls `image.width()`), and a disposed host object throws — so an image is
 * never disposed while it may still be the rendered prop:
 *   1. the load effect's cleanup only cancels; it never disposes;
 *   2. the load callback publishes with `setState` and never disposes beside it;
 *   3. a separate effect keyed on the published image disposes it in its cleanup,
 *      which React runs only after the commit that replaced it (or on unmount);
 *   4. a load that resolves after cancellation is disposed and never published.
 * (Dev-only caveat: Fast Refresh re-runs every effect of an edited component,
 * which retires the live image until the reload publishes a fresh one.)
 *
 * Skia and the manipulator always receive the PLAIN file URI (no `?v=`
 * display query); the revision only keys the derivative cache and the effect.
 * All native access sits behind injectable `OrreryImageDeps`, so the loader and
 * the lifecycle helper are node-testable with fakes.
 */
import { type SkData, type SkImage, Skia } from "@shopify/react-native-skia";
import type * as ExpoImageManipulator from "expo-image-manipulator";
import { useEffect, useRef, useState } from "react";
import { isStoredPhotoPath } from "@/db/photo-relative-path";
import { discardDerivative } from "@/services/photos/derivative-cache";
import { resolvePhotoUri } from "@/services/photos/photo-storage";
import { usePhotoCacheBust } from "@/stores/photo-cache-bust-store";
import { Logger } from "@/utils/logger";

// --- Tunable constants (top-of-file per project convention) ------------------

/**
 * D-11: the largest photo texture the orrery uploads, in px on the long edge.
 * Today's master edge; a planet (PLANET_RADIUS 16) at MAX_ZOOM 4 on a ~3.5×
 * density phone needs ~448 px, so 512 loses nothing visible.
 */
export const ORRERY_TEXTURE_MAX = 512;

/** JPEG quality of the cached 512 derivative (encoded bytes only, never shown larger). */
export const ORRERY_DERIVATIVE_QUALITY = 0.9;

/**
 * D-11: at most this many 1024→512 downsamples run at once. Each 1024² decode is
 * ≈4 MB RGBA; unbounded, a 50-planet first mount would spike ≈200 MB.
 */
export const ORRERY_DOWNSAMPLE_CONCURRENCY = 1;

/**
 * D-11: a byte budget on the cached base64 derivatives (≈4 MB of JS heap) — not
 * an entry count, which would not bound memory.
 */
export const ORRERY_DERIVATIVE_CACHE_BYTES = 4 * 1024 * 1024;

const LOG_SCOPE = "orrery-photo";

// --- Injectable native boundary ----------------------------------------------

export interface OrreryImageDeps {
  /** Plain `file://` URI of a canonical relative photo path (no `?v=`). */
  fileUri: (relative: string) => string;
  readData: (uri: string) => Promise<SkData>;
  /** Deferred decode: `width()`/`height()` read the header only. */
  decode: (data: SkData) => SkImage | null;
  fromBase64: (base64: string) => SkData;
  /** Downsample a large master to `ORRERY_TEXTURE_MAX`, returning base64 + the derivative file. */
  downsample: (uri: string) => Promise<{ base64: string; uri: string }>;
  /** Retire the manipulator's derivative file. */
  discard: (uri: string) => void;
}

async function downsampleWithManipulator(
  uri: string,
): Promise<{ base64: string; uri: string }> {
  const { ImageManipulator, SaveFormat } = (await import(
    "expo-image-manipulator"
  )) as typeof ExpoImageManipulator;
  // WR-02: release the context too — on Android its finished task still holds
  // the downsampled Bitmap after the ImageRef is released (D-11).
  const context = ImageManipulator.manipulate(uri);
  let rendered: Awaited<ReturnType<typeof context.renderAsync>> | null = null;
  try {
    rendered = await context
      .resize({ width: ORRERY_TEXTURE_MAX, height: ORRERY_TEXTURE_MAX })
      .renderAsync();
    const out = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: ORRERY_DERIVATIVE_QUALITY,
      base64: true,
    });
    if (typeof out.base64 !== "string" || out.base64.length === 0) {
      discardDerivative(out.uri);
      throw new Error("orrery downsample produced no base64 payload");
    }
    return { base64: out.base64, uri: out.uri };
  } finally {
    try {
      rendered?.release();
    } catch {
      Logger.warn(LOG_SCOPE, "downsample bitmap release failed");
    }
    try {
      context.release();
    } catch {
      Logger.warn(LOG_SCOPE, "downsample context release failed");
    }
  }
}

export const defaultOrreryImageDeps: OrreryImageDeps = {
  fileUri: (relative) => resolvePhotoUri(relative),
  readData: (uri) => Skia.Data.fromURI(uri),
  decode: (data) => Skia.Image.MakeImageFromEncoded(data),
  fromBase64: (base64) => Skia.Data.fromBase64(base64),
  downsample: downsampleWithManipulator,
  discard: (uri) => {
    discardDerivative(uri);
  },
};

// --- Byte-budgeted LRU of encoded derivatives (strings only) -----------------

/** Insertion order = recency order (oldest first). */
const derivativeCache = new Map<string, string>();
let derivativeCacheBytes = 0;
/** In-flight downsample per key, so two bodies showing one photo derive once. */
const pendingDerivatives = new Map<string, Promise<string>>();

function cacheKey(relative: string, revision: number | undefined): string {
  return `${relative}#${revision ?? 0}`;
}

function cacheDelete(key: string): void {
  const value = derivativeCache.get(key);
  if (value === undefined) return;
  derivativeCache.delete(key);
  derivativeCacheBytes -= value.length;
}

function cacheGet(key: string): string | undefined {
  const value = derivativeCache.get(key);
  if (value === undefined) return undefined;
  // Refresh recency.
  derivativeCache.delete(key);
  derivativeCache.set(key, value);
  return value;
}

function cachePut(relative: string, key: string, value: string): void {
  // A superseded revision of the same path can never be requested again.
  const prefix = `${relative}#`;
  for (const existing of [...derivativeCache.keys()]) {
    if (existing.startsWith(prefix)) cacheDelete(existing);
  }
  if (value.length > ORRERY_DERIVATIVE_CACHE_BYTES) return;
  while (
    derivativeCacheBytes + value.length > ORRERY_DERIVATIVE_CACHE_BYTES &&
    derivativeCache.size > 0
  ) {
    const oldest = derivativeCache.keys().next().value as string;
    cacheDelete(oldest);
  }
  derivativeCache.set(key, value);
  derivativeCacheBytes += value.length;
}

/** Test/diagnostic view of the derivative cache: keys (oldest first) and total bytes. */
export function orreryDerivativeCacheState(): {
  keys: string[];
  bytes: number;
} {
  return { keys: [...derivativeCache.keys()], bytes: derivativeCacheBytes };
}

// --- Downsample queue (at most ORRERY_DOWNSAMPLE_CONCURRENCY in flight) ------

let activeDownsamples = 0;
const downsampleWaiters: Array<() => void> = [];

async function acquireDownsampleSlot(): Promise<void> {
  if (activeDownsamples < ORRERY_DOWNSAMPLE_CONCURRENCY) {
    activeDownsamples += 1;
    return;
  }
  // The releasing holder hands its slot straight to the next waiter (FIFO).
  await new Promise<void>((resolve) => downsampleWaiters.push(resolve));
}

function releaseDownsampleSlot(): void {
  const next = downsampleWaiters.shift();
  if (next) next();
  else activeDownsamples -= 1;
}

async function queuedDownsample(
  uri: string,
  deps: OrreryImageDeps,
): Promise<{ base64: string; uri: string }> {
  await acquireDownsampleSlot();
  try {
    return await deps.downsample(uri);
  } finally {
    releaseDownsampleSlot();
  }
}

async function deriveSmall(
  relative: string,
  key: string,
  uri: string,
  deps: OrreryImageDeps,
): Promise<string> {
  const pending = pendingDerivatives.get(key);
  if (pending) return pending;
  const work = (async () => {
    const out = await queuedDownsample(uri, deps);
    try {
      deps.discard(out.uri);
    } catch {
      Logger.warn(LOG_SCOPE, "orrery derivative cleanup failed");
    }
    cachePut(relative, key, out.base64);
    return out.base64;
  })();
  pendingDerivatives.set(key, work);
  try {
    return await work;
  } finally {
    pendingDerivatives.delete(key);
  }
}

/** Clear the derivative cache and the downsample queue (tests only). */
export function resetOrreryPhotoCacheForTests(): void {
  derivativeCache.clear();
  derivativeCacheBytes = 0;
  pendingDerivatives.clear();
  activeDownsamples = 0;
  downsampleWaiters.length = 0;
}

// --- Loader --------------------------------------------------------------------

function disposeQuietly(image: SkImage | null): void {
  if (!image) return;
  try {
    image.dispose();
  } catch {
    Logger.warn(LOG_SCOPE, "SkImage dispose failed");
  }
}

/**
 * Load the orrery image for a canonical relative photo path at a display
 * revision. A master ≤ `ORRERY_TEXTURE_MAX` is returned as decoded (today's
 * behaviour); a larger one is replaced by a cached/queued 512 derivative and
 * disposed undrawn. Any read/decode/manipulator failure resolves to `null` (the
 * body shows its initials swatch), after disposing every SkImage this call made.
 * The caller owns the returned image.
 */
export async function loadOrreryImage(
  relative: string,
  revision: number | undefined,
  deps: OrreryImageDeps = defaultOrreryImageDeps,
): Promise<SkImage | null> {
  // 38.6 D-34: a value that is not a stored photo path is never resolved (and
  // never logged — it can be user text); the body shows its initials.
  if (!isStoredPhotoPath(relative)) return null;
  const key = cacheKey(relative, revision);
  try {
    const hit = cacheGet(key);
    if (hit !== undefined) return deps.decode(deps.fromBase64(hit));

    const uri = deps.fileUri(relative);
    const large = deps.decode(await deps.readData(uri));
    if (!large) return null;
    let small: string;
    let keepLarge = false;
    try {
      if (Math.max(large.width(), large.height()) <= ORRERY_TEXTURE_MAX) {
        keepLarge = true;
        return large;
      }
      small = await deriveSmall(relative, key, uri, deps);
    } finally {
      // Never drawn: dispose on the downsample path and on every throw.
      if (!keepLarge) disposeQuietly(large);
    }
    return deps.decode(deps.fromBase64(small));
  } catch (error) {
    Logger.warn(LOG_SCOPE, `orrery photo load failed for ${relative}`, error);
    return null;
  }
}

// --- SkImage lifecycle (pure; the hook drives it) ------------------------------

export interface OrreryImageSlot {
  /** The image currently handed to `setState` (the rendered prop once committed). */
  readonly published: SkImage | null;
  /** Record `image` as the published image (called beside `setState`; never disposes). */
  publish(image: SkImage | null): void;
  /**
   * A load finished. A cancelled result is disposed and never published
   * (returns false); otherwise it is published (returns true → `setState`).
   */
  settle(image: SkImage | null, cancelled: boolean): boolean;
  /**
   * Post-commit retire step: dispose `image`, which the render no longer holds
   * (replaced by a later publish, or the component unmounted). Idempotent.
   */
  retire(image: SkImage | null): void;
  /** An error-path result: dispose it; never publish. */
  discard(image: SkImage | null): void;
}

export function createOrreryImageSlot(): OrreryImageSlot {
  let published: SkImage | null = null;
  const disposed = new WeakSet<SkImage>();
  const disposeOnce = (image: SkImage | null) => {
    if (!image || disposed.has(image)) return;
    disposed.add(image);
    disposeQuietly(image);
  };
  return {
    get published() {
      return published;
    },
    publish(image) {
      published = image;
    },
    settle(image, cancelled) {
      if (cancelled) {
        disposeOnce(image);
        return false;
      }
      published = image;
      return true;
    },
    retire(image) {
      if (!image) return;
      // Unmount: the published image itself is being retired.
      if (image === published) published = null;
      disposeOnce(image);
    },
    discard(image) {
      disposeOnce(image);
    },
  };
}

// --- Hook -------------------------------------------------------------------------

/**
 * The orrery body's photo (C2-1: call unconditionally; a null path → null → the
 * initials swatch). Re-loads when the path or its display revision changes.
 */
export function useOrreryPhoto(relative: string | null): SkImage | null {
  const revision = usePhotoCacheBust(relative);
  const slotRef = useRef<OrreryImageSlot | null>(null);
  if (slotRef.current === null) slotRef.current = createOrreryImageSlot();
  const slot = slotRef.current;
  const [image, setImage] = useState<SkImage | null>(() => null);

  useEffect(() => {
    let cancelled = false;
    if (!relative) {
      slot.publish(null);
      setImage(null);
      return;
    }
    loadOrreryImage(relative, revision).then(
      (next) => {
        if (slot.settle(next, cancelled)) setImage(next);
      },
      () => {
        if (cancelled) return;
        slot.publish(null);
        setImage(null);
      },
    );
    // Cancel only — the published image is retired by the effect below.
    return () => {
      cancelled = true;
    };
  }, [relative, revision, slot]);

  // Runs after the commit that replaced `image` (or on unmount): only then is it
  // safe to dispose, because no re-record can still read it.
  useEffect(() => () => slot.retire(image), [image, slot]);

  return image;
}
