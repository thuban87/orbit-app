/**
 * The Orrery photo loader (D-11) — decodes a contact or sun photo for the Skia
 * bodies, replacing Skia's `useImage`. Since 38.7-07 its only caller is the
 * shared Orrery photo cache (`resources/orrery-photo-cache.ts`), which owns
 * every SkImage this returns (one decode per photo, hard caps, ledger-gated
 * disposal — the per-body photo hook is gone).
 *
 * WHY: expo-image surfaces decode at display size, but Skia decodes a photo at
 * FULL size into a GPU texture. New masters are up to 1024 px (D-10), so a plain
 * `useImage` would quadruple each planet's texture. This loader keeps the orrery at
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
 *     whose every requester cancelled (released, superseded or dropped) never
 *     runs (IN-02). Two bodies showing one photo share one generation.
 *   - The ownership layer deletes a photo's derivatives whenever its bytes
 *     change or are deleted (`notifyPhotoBytesChanged`), and a launch sweep
 *     removes orphans.
 *   - SkImages (38.7-15, D-58, supersedes "SkImage objects are not cached"):
 *     decoded images are kept only inside the shared photo cache — while a
 *     picture draws them, and across an ordinary tab blur inside the BOUNDED
 *     warm cache (`resources/orrery-warm-cache.ts`: hard byte cap, LRU
 *     eviction that disposes, released on background / idle / memory), under
 *     the same ownership and generation-ledger disposal rules below. Only
 *     these CPU-backed decodes are retained; never a GPU texture.
 *
 * SkImage OWNERSHIP: the caller owns the returned image. A load cancelled
 * through its token makes no image once it notices (or the caller disposes a
 * late result unpublished); the photo cache disposes an image only under the
 * 38.7-07 generation-ledger contract (never while a picture layer may still
 * re-record it).
 *
 * Skia and the manipulator always receive the PLAIN file URI (no `?v=`
 * display query); the display revision only triggers a reload (the photo
 * cache's `subscribePhotoCacheBust`). All native access sits behind injectable
 * `OrreryImageDeps`, so the loader is node-testable with fakes.
 */
import { type SkData, type SkImage, Skia } from "@shopify/react-native-skia";
import type * as ExpoImageManipulator from "expo-image-manipulator";
import { isStoredPhotoPath } from "@/db/photo-relative-path";
import {
  dropOrreryDerivative,
  findOrreryDerivative,
  installOrreryDerivative,
  orreryMasterSignature,
} from "@/services/photos/orrery-derivative-store";
import { resolvePhotoUri } from "@/services/photos/photo-storage";
import { getPhotoCacheBust } from "@/stores/photo-cache-bust-store";
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
 * A cancellation token for one load. The photo cache flips `cancelled` when
 * the load is no longer wanted (released owner, superseded revision, dropped
 * from the admitted set).
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
