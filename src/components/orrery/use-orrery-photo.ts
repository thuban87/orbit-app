/**
 * useOrreryPhoto (D-11) — the orrery's photo loader for the Skia bodies
 * (`OrbitBody`, `SunBody`), replacing Skia's `useImage`.
 *
 * WHY: expo-image surfaces decode at display size, but Skia decodes a photo at
 * FULL size into a GPU texture. New masters are up to 1024 px (D-10), so a plain
 * `useImage` would quadruple each planet's texture. This hook keeps the orrery at
 * today's level: a master ≤ `ORRERY_TEXTURE_MAX` (every legacy 512 JPEG master and
 * every imported thumbnail) is passed through exactly as before; a larger master
 * is drawn from a small on-disk derivative instead.
 *
 * ON-DISK DERIVATIVE (38.6 D-41, supersedes D-37's in-memory base64 cache):
 *   - Each >512 master gets ONE ≤512 JPEG derivative in the app's cache dir
 *     (`orrery-derivative-store.ts`), keyed by the master's durable signature
 *     (byte size + mtime), which is re-read on every load. A load first looks
 *     for the derivative of the CURRENT signature and, when it exists and
 *     decodes, never reads or decodes the master at all — the same path a 512
 *     JPEG master takes. A stale (other signature), empty or undecodable
 *     derivative is ignored, deleted and regenerated.
 *   - Why disk: generating the derivative runs the manipulator, whose Android
 *     decode (Glide, no transform, API 29+) yields a HARDWARE Bitmap — GPU
 *     graphics memory — that is freed only when the Java GC gets to it. With
 *     the derivative only in memory, every cold start re-ran that for every
 *     1024 master: the transient Graphics/GL excess measured at 20 s (D-37).
 *     On disk, it runs once per photo per byte change.
 *   - Generation is lazy (first load that needs it), at most
 *     `ORRERY_DOWNSAMPLE_CONCURRENCY` at once (a module-level FIFO), and atomic
 *     (the manipulator's temp file is renamed into place). A queued generation
 *     whose every requester cancelled (unmount, path or revision change) never
 *     runs (IN-02). Two bodies showing one photo share one generation.
 *   - The ownership layer deletes a photo's derivatives whenever its bytes
 *     change or are deleted (`notifyPhotoBytesChanged`), and a launch sweep
 *     removes orphans. SkImage objects are never cached.
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
 * display query); the display revision only re-runs the load effect. All native
 * access sits behind injectable `OrreryImageDeps`, so the loader and the
 * lifecycle helper are node-testable with fakes.
 */
import { type SkData, type SkImage, Skia } from "@shopify/react-native-skia";
import type * as ExpoImageManipulator from "expo-image-manipulator";
import { useEffect, useRef, useState } from "react";
import { isStoredPhotoPath } from "@/db/photo-relative-path";
import {
  dropOrreryDerivative,
  findOrreryDerivative,
  installOrreryDerivative,
  orreryMasterSignature,
} from "@/services/photos/orrery-derivative-store";
import { resolvePhotoUri } from "@/services/photos/photo-storage";
import {
  getPhotoCacheBust,
  usePhotoCacheBust,
} from "@/stores/photo-cache-bust-store";
import { Logger } from "@/utils/logger";

// --- Tunable constants (top-of-file per project convention) ------------------

/**
 * D-11: the largest photo texture the orrery uploads, in px on the long edge,
 * and the edge of the on-disk derivative (D-41). Kept at today's master edge:
 * a planet (PLANET_RADIUS 16, a 32 dp disc) at MAX_ZOOM 4 on a ~3.5× density
 * phone draws ~448 px, and the sun (SUN_RADIUS 30, a 60 dp disc) ~840 px, so
 * anything smaller would soften zoomed-in bodies; 512 also keeps texture memory
 * equal to the 512 JPEG baseline D-11 is measured against.
 */
export const ORRERY_TEXTURE_MAX = 512;

/** JPEG quality of the on-disk derivative (never shown larger than 512). */
export const ORRERY_DERIVATIVE_QUALITY = 0.9;

/**
 * D-11: at most this many 1024→512 derivative generations run at once. Each
 * 1024² decode is ≈4 MB; unbounded, a 50-planet first mount would spike ≈200 MB.
 */
export const ORRERY_DOWNSAMPLE_CONCURRENCY = 1;

const LOG_SCOPE = "orrery-photo";

// --- Injectable native boundary ----------------------------------------------

export interface OrreryImageDeps {
  /** Plain `file://` URI of a canonical relative photo path (no `?v=`). */
  fileUri: (relative: string) => string;
  readData: (uri: string) => Promise<SkData>;
  /** Deferred decode: `width()`/`height()` read the header only. */
  decode: (data: SkData) => SkImage | null;
  /** The in-process display revision (`photo-cache-bust-store`), read first. */
  revision: (relative: string) => number | undefined;
  /** The master's durable signature (size + mtime); null when it is missing. */
  signature: (relative: string) => string | null;
  /** The derivative file for exactly this signature, or null (miss / stale). */
  findDerivative: (relative: string, signature: string) => string | null;
  /** Downsample a large master to `ORRERY_TEXTURE_MAX` into a temp cache file. */
  downsample: (uri: string) => Promise<{ uri: string }>;
  /**
   * Atomically move the temp file into place as the derivative for
   * `signature`; null when the master changed meanwhile — a new signature, or
   * a display revision past `revision` (nothing installed).
   */
  install: (
    tempUri: string,
    relative: string,
    signature: string,
    revision: number | undefined,
  ) => Promise<string | null>;
  /** Delete an unusable (empty / undecodable) derivative file. */
  dropDerivative: (uri: string) => void;
}

async function downsampleWithManipulator(
  uri: string,
): Promise<{ uri: string }> {
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
    // D-41: the encoded file itself is the derivative (renamed into place by
    // the store); no base64 copy is made.
    const out = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: ORRERY_DERIVATIVE_QUALITY,
    });
    if (typeof out.uri !== "string" || out.uri.length === 0)
      throw new Error("orrery downsample produced no file");
    return { uri: out.uri };
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
  revision: (relative) => getPhotoCacheBust(relative),
  signature: (relative) => orreryMasterSignature(relative),
  findDerivative: (relative, signature) =>
    findOrreryDerivative(relative, signature),
  downsample: downsampleWithManipulator,
  install: (tempUri, relative, signature, revision) =>
    installOrreryDerivative(tempUri, relative, signature, revision),
  dropDerivative: (uri) => {
    dropOrreryDerivative(uri);
  },
};

/**
 * A cancellation token for one load. The hook flips `cancelled` in its effect
 * cleanup (unmount, path change, revision change).
 */
export interface OrreryLoadToken {
  cancelled: boolean;
}

/** Loads with no token (tests, callers without a lifecycle) never cancel. */
const NEVER_CANCELLED: OrreryLoadToken = Object.freeze({ cancelled: false });

/**
 * Rejection of a shared generation whose every requester cancelled before it
 * ran. A singleton compared by identity (no Error subclass `instanceof`).
 */
const ORRERY_LOAD_CANCELLED = new Error("orrery downsample cancelled");

interface PendingDerivative {
  requesters: Set<OrreryLoadToken>;
  /** The installed derivative URI, or null when the master changed meanwhile. */
  work: Promise<string | null>;
}

/**
 * In-flight generation per path + signature + display revision, so two bodies
 * derive once. The revision is part of the key: a load that starts after a
 * bump never joins a generation whose install will be discarded for it.
 */
const pendingDerivatives = new Map<string, PendingDerivative>();

// --- Generation queue (at most ORRERY_DOWNSAMPLE_CONCURRENCY in flight) ------

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

function everyRequesterCancelled(requesters: Set<OrreryLoadToken>): boolean {
  for (const token of requesters) if (!token.cancelled) return false;
  return true;
}

function generateDerivative(
  relative: string,
  signature: string,
  revision: number | undefined,
  uri: string,
  deps: OrreryImageDeps,
  token: OrreryLoadToken,
): Promise<string | null> {
  const key = `${relative}#${signature}#${revision ?? 0}`;
  const pending = pendingDerivatives.get(key);
  if (pending) {
    pending.requesters.add(token);
    return pending.work;
  }
  const entry: PendingDerivative = {
    requesters: new Set([token]),
    work: Promise.resolve(null),
  };
  entry.work = (async () => {
    try {
      await acquireDownsampleSlot();
      let out: { uri: string };
      try {
        // IN-02: a queued generation whose every requester has gone never
        // runs. The check, the slot hand-off and the entry removal below all
        // happen in this one synchronous continuation, so no requester can
        // join a generation that has already given up.
        if (everyRequesterCancelled(entry.requesters))
          throw ORRERY_LOAD_CANCELLED;
        out = await deps.downsample(uri);
      } finally {
        releaseDownsampleSlot();
      }
      // Installed even if every requester has since gone: the next mount
      // reads it from disk instead of generating again.
      return await deps.install(out.uri, relative, signature, revision);
    } finally {
      if (pendingDerivatives.get(key) === entry) pendingDerivatives.delete(key);
    }
  })();
  pendingDerivatives.set(key, entry);
  return entry.work;
}

/** Clear the generation queue (tests only). */
export function resetOrreryPhotoQueueForTests(): void {
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

/** A derivative must decode to a non-empty image no larger than the cap. */
function isUsableDerivative(image: SkImage): boolean {
  const width = image.width();
  const height = image.height();
  return (
    width > 0 && height > 0 && Math.max(width, height) <= ORRERY_TEXTURE_MAX
  );
}

/**
 * Decode a derivative file. `undefined` = unusable (unreadable, undecodable or
 * oversized): it is deleted so the caller can regenerate. `null` = cancelled.
 */
async function decodeDerivative(
  derivativeUri: string,
  deps: OrreryImageDeps,
  token: OrreryLoadToken,
): Promise<SkImage | null | undefined> {
  let data: SkData;
  try {
    data = await deps.readData(derivativeUri);
  } catch {
    deps.dropDerivative(derivativeUri);
    return undefined;
  }
  if (token.cancelled) return null;
  const image = deps.decode(data);
  if (image && isUsableDerivative(image)) return image;
  disposeQuietly(image);
  deps.dropDerivative(derivativeUri);
  return undefined;
}

/**
 * Load the orrery image for a canonical relative photo path. A valid on-disk
 * derivative for the master's current signature is decoded without touching
 * the master (D-41). Otherwise the master's header is read: ≤
 * `ORRERY_TEXTURE_MAX` is returned as decoded (today's pass-through); larger is
 * replaced by a freshly generated derivative and disposed undrawn. Any
 * read/decode/manipulator failure resolves to `null` (the body shows its
 * initials swatch), after disposing every SkImage this call made. A load
 * cancelled through `token` resolves to `null` without logging and makes no
 * image once it notices; its queued generation is skipped if no other body
 * still wants it. The caller owns the returned image.
 */
export async function loadOrreryImage(
  relative: string,
  deps: OrreryImageDeps = defaultOrreryImageDeps,
  token: OrreryLoadToken = NEVER_CANCELLED,
): Promise<SkImage | null> {
  // 38.6 D-34: a value that is not a stored photo path is never resolved (and
  // never logged — it can be user text); the body shows its initials.
  if (!isStoredPhotoPath(relative)) return null;
  try {
    if (token.cancelled) return null;
    // Read BEFORE the master: a byte change after this point bumps it, so the
    // install can tell this load's derivative is stale (WR6-01 hardening).
    const revision = deps.revision(relative);
    // Missing master (D-23: small surfaces keep plain initials).
    const signature = deps.signature(relative);
    if (signature === null) return null;

    const existing = deps.findDerivative(relative, signature);
    if (existing !== null) {
      const hit = await decodeDerivative(existing, deps, token);
      if (hit !== undefined) return hit;
      // Unusable derivative (deleted above): regenerate from the master.
    }

    const uri = deps.fileUri(relative);
    const data = await deps.readData(uri);
    if (token.cancelled) return null;
    const large = deps.decode(data);
    if (!large) return null;
    let derivative: string | null;
    let keepLarge = false;
    try {
      if (Math.max(large.width(), large.height()) <= ORRERY_TEXTURE_MAX) {
        keepLarge = true;
        return large;
      }
      derivative = await generateDerivative(
        relative,
        signature,
        revision,
        uri,
        deps,
        token,
      );
    } finally {
      // Never drawn: dispose on the generation path and on every throw.
      if (!keepLarge) disposeQuietly(large);
    }
    // Cancelled while queued or generating: the derivative stays on disk for
    // a later mount, but no SkImage is made for a body that is gone. Null
    // derivative: the master changed meanwhile, and its revision bump reloads.
    if (token.cancelled || derivative === null) return null;
    const fresh = await decodeDerivative(derivative, deps, token);
    if (fresh === undefined) {
      Logger.warn(LOG_SCOPE, `orrery derivative unusable for ${relative}`);
      return null;
    }
    return fresh;
  } catch (error) {
    if (error === ORRERY_LOAD_CANCELLED) return null;
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: `revision` is the reload trigger — the ownership layer bumps it when the canonical bytes change (D-19), and the loader re-reads the master's on-disk signature (D-41).
  useEffect(() => {
    const token: OrreryLoadToken = { cancelled: false };
    if (!relative) {
      slot.publish(null);
      setImage(null);
      return;
    }
    loadOrreryImage(relative, defaultOrreryImageDeps, token).then(
      (next) => {
        if (slot.settle(next, token.cancelled)) setImage(next);
      },
      () => {
        if (token.cancelled) return;
        slot.publish(null);
        setImage(null);
      },
    );
    // Cancel only (a queued generation nobody else wants is skipped) — the
    // published image is retired by the effect below.
    return () => {
      token.cancelled = true;
    };
  }, [relative, revision, slot]);

  // Runs after the commit that replaced `image` (or on unmount): only then is it
  // safe to dispose, because no re-record can still read it.
  useEffect(() => () => slot.retire(image), [image, slot]);

  return image;
}
