/**
 * OrreryPhotoCache (38.7-07, D-53/D-52/H4/C-M1/M5): the single path every
 * Orrery photo SkImage takes — contact bodies and the sun.
 *
 * WHY: before V2 each body owned a `useOrreryPhoto` hook. A photo arriving
 * set React state and re-rendered the renderer (Lab B's post-switch jank
 * train, DEAD-ENDS), the same photo was decoded once per body, nothing bounded
 * the decoded total, and an image was disposed from an unmount effect with no
 * UI round trip.
 *
 * WHAT IT GUARANTEES
 *   - One decode per photo key, shared by every body (and owner) that shows it,
 *     through the unchanged 38.6 loader (`loadOrreryImage`: on-disk ≤ 512
 *     derivatives, `ORRERY_TEXTURE_MAX`), at most `ORRERY_PHOTO_CACHE_CONCURRENCY`
 *     decodes at once, highest priority first (focused, then visible by size).
 *   - HARD caps: pinned + warm + in-flight + retired-awaiting-ack images are
 *     counted against `ORRERY_PHOTO_CACHE_MAX_IMAGES` / `_MAX_BYTES` BEFORE a
 *     decode starts (an in-flight decode at the worst-case texture size). A
 *     request that cannot be admitted is not decoded and its body draws the
 *     fallback (swatch + initials, else the plain swatch).
 *   - Progress at a saturated cap (C-M1): a reserve inside the caps is usable
 *     only by the focused photo and same-key revision replacements. Past that,
 *     a FALLBACK GENERATION drops the lowest-priority drawn photos (not
 *     focused; off-screen first, then smallest) to `photo: null`, and the
 *     dropped images are freed only after every recording layer acked under
 *     the ledger contract; the queued request is then admitted. Queued
 *     requests hold no decode memory and vanish when superseded.
 *   - Photo invalidation (M5): a display-revision bump (owned-master's
 *     `notifyPhotoBytesChanged`) cancels the old revision's in-flight decode,
 *     keeps the drawn image until its replacement is published (or publishes
 *     null on deletion), and retires the old image through the ledger. A
 *     decode that completes for a superseded revision is disposed unpublished.
 *   - No React state: a change is published to the owner's `onReady`
 *     callback, which rewrites the body specs (SharedValues) synchronously.
 *
 * IMAGE STATES (all counted against the caps)
 *   - pinned: an owner's currently published generation draws it (render pin);
 *   - retired: an owner stopped drawing it and its layers have not yet all
 *     acked a newer generation (H3 ledger, `confirmRetired`);
 *   - warm: neither — evictable (LRU), disposed on eviction or `clearUnheld`.
 *     An image of a superseded revision is never warm: it is disposed as soon
 *     as nothing holds it.
 *
 * 38.7-15 (D-58): the bounded WARM CACHE across a tab blur. When the Orrery
 * world unmounts, `handOffWarm(owner, epoch)` turns its released images into
 * warm entries marked for the warm owner (`orrery-warm-cache.ts`) instead of
 * disposing them — only CPU-backed images (M15: decoded photo bytes; the
 * loader decodes encoded files with `MakeImageFromEncoded`, a lazy raster
 * image), anything else is disposed. A warm-marked entry is still just warm:
 * evictable at admission (C-M1), trimmed to the warm byte budget
 * (`trimWarm`), cleared by `clearUnheld`. The mark only stops ANOTHER owner's
 * teardown (`dispose` on `confirmRetired` / `confirmReleased`, the System
 * Preview) from disposing it. A display-revision bump drops every unheld
 * image of an older revision at once (M5), so a warm return never shows stale
 * bytes.
 *
 * JS thread only. Nothing in this module is a worklet.
 */
import type { SkImage } from "@shopify/react-native-skia";
import {
  getPhotoCacheBust,
  subscribePhotoCacheBust,
} from "@/stores/photo-cache-bust-store";
import { Logger } from "@/utils/logger";
import {
  defaultOrreryImageDeps,
  loadOrreryImage,
  ORRERY_TEXTURE_MAX,
  type OrreryLoadToken,
} from "../use-orrery-photo";

// --- Tunable constants (top-of-file per project convention) ------------------

/**
 * Hard cap on decoded + decoding Orrery photos. 38.6 D-11 measured the Orrery
 * at today's level with one ≤512 texture per drawn body; 120 covers a Size 120
 * System fully and bounds All Contacts (~1,000 bodies) to the visible first.
 */
export const ORRERY_PHOTO_CACHE_MAX_IMAGES = 120;
/**
 * Hard cap on their decoded bytes (width × height × 4). At the 512 px
 * derivative edge one photo is 1 MiB, so 96 MiB holds ~96 full-size textures
 * (38.6 D-11's flat-memory gate is judged on Graphics/GL; Plan 08 measures).
 */
export const ORRERY_PHOTO_CACHE_MAX_BYTES = 96 * 1024 * 1024;
/**
 * Images (and their worst-case bytes) inside both caps that only the focused
 * photo and same-key revision replacements may use, so a focus change or a
 * replaced photo is admitted at once even when ordinary photos fill the rest.
 */
export const ORRERY_PHOTO_CACHE_REPLACEMENT_RESERVE_IMAGES = 4;
/** Decodes running at once (each is one ≤512 texture). */
export const ORRERY_PHOTO_CACHE_CONCURRENCY = 2;
/** The worst-case decoded size of one photo, used until the real size is known. */
export const ORRERY_PHOTO_ESTIMATE_BYTES =
  ORRERY_TEXTURE_MAX * ORRERY_TEXTURE_MAX * 4;

const LOG_SCOPE = "orrery-photo-cache";

/**
 * How an image's pixels are held (M15). Only "cpu" images may be kept warm
 * across a blur; a GPU texture belongs to the active render lifecycle.
 */
export type OrreryImageBacking = "cpu" | "texture" | "unknown";

// --- Types ---------------------------------------------------------------------

/** One wanted photo (one per photo key; bodies that share a photo share it). */
export interface OrreryPhotoRequest {
  /** Photo identity: one decode per key (the V2 world uses the relative path). */
  key: string;
  /** Canonical relative photo path (`loadOrreryImage`). */
  relativePath: string;
  /** The display revision the caller saw; the cache also follows the store. */
  revision?: number;
  /** Admission rank: lower is more important (visible, larger bodies first). */
  priority: number;
  /** The focused body's photo: may use the replacement reserve. */
  focused?: boolean;
  /** On screen now (fallback generations drop off-screen photos first). */
  visible?: boolean;
}

/** A photo an owner's published generation draws. */
export interface OrreryDrawnPhoto {
  /** Stable per decoded image (the ledger handle id). */
  id: number;
  image: SkImage;
}

export interface OrreryPhotoCacheDeps {
  /** Decode `relativePath` (≤ ORRERY_TEXTURE_MAX); null on failure / cancel. */
  load: (
    relativePath: string,
    token: OrreryLoadToken,
  ) => Promise<SkImage | null>;
  /** The current display revision of a path (undefined = never bumped). */
  revision: (relativePath: string) => number | undefined;
  /** Read-only revision subscription (`subscribePhotoCacheBust`). */
  subscribe: (
    listener: (relativePath: string, revision: number) => void,
  ) => () => void;
  /**
   * 38.7-15 (M15): how a decoded image is backed. Default "cpu": `load` decodes
   * encoded bytes (`MakeImageFromEncoded`), never a GPU snapshot.
   */
  backing?: (image: SkImage) => OrreryImageBacking;
}

export interface OrreryPhotoCacheOptions {
  maxImages?: number;
  maxBytes?: number;
  reserveImages?: number;
  concurrency?: number;
  deps?: OrreryPhotoCacheDeps;
}

export interface OrreryPhotoCacheStats {
  /** Decoded images held (pinned + warm + retired). */
  images: number;
  pinned: number;
  warm: number;
  retired: number;
  /** Decodes started and not yet settled (including cancelled ones). */
  inflight: number;
  /** Decoded bytes plus the in-flight decodes' worst-case bytes. */
  bytes: number;
  /** 38.7-15: decoded bytes of the unheld (warm) images. */
  warmBytes: number;
  /** Lifetime decodes started. */
  decodes: number;
  /** Lifetime images disposed. */
  disposed: number;
  /** Wanted photos the last reconcile could not admit (drawing the fallback). */
  refused: number;
}

export interface OrreryPhotoCache {
  readonly maxImages: number;
  readonly maxBytes: number;
  readonly reserveImages: number;
  /**
   * Starts a mount epoch for `owner`. `onReady` is called (synchronously, never
   * through React state) whenever the photos the owner should draw change;
   * the owner then republishes its specs from `drawn(owner)`.
   */
  mount(owner: string, onReady: () => void): number;
  /** Replaces the owner's wanted photos (one entry per key; best rank wins). */
  request(owner: string, entries: readonly OrreryPhotoRequest[]): void;
  /** key → the image the owner's next generation draws (absent → fallback). */
  drawn(owner: string): ReadonlyMap<string, OrreryDrawnPhoto>;
  /**
   * H3: every layer that recorded these images acked a newer generation of
   * `epoch`; the owner's retirement marks clear and an image nothing holds is
   * disposed (superseded, or `dispose`) or turns warm. Returns how many freed.
   */
  confirmRetired(
    owner: string,
    ids: Iterable<number>,
    epoch: number,
    options?: { dispose?: boolean },
  ): number;
  /** Unmount: wants dropped, drawn images retire; returns the ended epoch. */
  release(owner: string): number | null;
  /**
   * After the post-release UI round trip: the released images are free.
   * `dispose` (38.7-15, the System Preview's teardown) disposes the ones that
   * become unheld, except warm-owner entries.
   */
  confirmReleased(
    owner: string,
    epoch: number,
    options?: { dispose?: boolean },
  ): number;
  /**
   * 38.7-15 (D-58/H3 rule 3): after the post-release UI round trip, hands
   * `owner`'s released images of `epoch` to the warm owner: each one nothing
   * else holds becomes a warm entry marked for the warm owner when it is the
   * current revision and CPU-backed (M15); otherwise it is disposed. Returns
   * the retained image ids.
   */
  handOffWarm(owner: string, epoch: number): number[];
  /**
   * 38.7-15: disposes least-recently-used unheld images until their decoded
   * bytes are at most `maxBytes`. Returns how many it disposed.
   */
  trimWarm(maxBytes: number): number;
  /** Disposes every image nothing pins or awaits (today's unmount lifecycle). */
  clearUnheld(): number;
  stats(): OrreryPhotoCacheStats;
}

interface ImageEntry {
  id: number;
  key: string;
  relativePath: string;
  revision: number;
  image: SkImage;
  bytes: number;
  /** 38.7-15 (M15): only "cpu" images may be kept warm across a blur. */
  backing: OrreryImageBacking;
  /** 38.7-15: a warm entry the warm owner holds (never a pin). */
  warm: boolean;
  pins: Set<string>;
  /** owner → the epoch whose ledger must confirm the retirement. */
  retired: Map<string, number>;
  lastUse: number;
}
interface Flight {
  key: string;
  relativePath: string;
  revision: number;
  token: OrreryLoadToken;
}
interface OwnerState {
  serial: number;
  epoch: number | null;
  wants: Map<string, OrreryPhotoRequest>;
  /** key → image id the owner's published generation draws. */
  drawn: Map<string, number>;
  onReady: (() => void) | null;
}
interface RankedWant {
  owner: OwnerState;
  ownerId: string;
  want: OrreryPhotoRequest;
  target: number;
}

function disposeQuietly(image: SkImage): void {
  try {
    image.dispose();
  } catch {
    Logger.warn(LOG_SCOPE, "SkImage dispose failed");
  }
}

function imageBytes(image: SkImage): number {
  try {
    const bytes = image.width() * image.height() * 4;
    return Number.isFinite(bytes) && bytes > 0
      ? Math.min(bytes, ORRERY_PHOTO_ESTIMATE_BYTES)
      : ORRERY_PHOTO_ESTIMATE_BYTES;
  } catch {
    return ORRERY_PHOTO_ESTIMATE_BYTES;
  }
}

export const defaultOrreryPhotoCacheDeps: OrreryPhotoCacheDeps = {
  load: (relativePath, token) =>
    loadOrreryImage(relativePath, defaultOrreryImageDeps, token),
  revision: (relativePath) => getPhotoCacheBust(relativePath),
  subscribe: (listener) => subscribePhotoCacheBust(listener),
};

export function createOrreryPhotoCache(
  options: OrreryPhotoCacheOptions = {},
): OrreryPhotoCache {
  const maxImages = options.maxImages ?? ORRERY_PHOTO_CACHE_MAX_IMAGES;
  const maxBytes = options.maxBytes ?? ORRERY_PHOTO_CACHE_MAX_BYTES;
  const reserveImages = Math.min(
    maxImages,
    options.reserveImages ?? ORRERY_PHOTO_CACHE_REPLACEMENT_RESERVE_IMAGES,
  );
  const concurrency = Math.max(
    1,
    options.concurrency ?? ORRERY_PHOTO_CACHE_CONCURRENCY,
  );
  const deps = options.deps ?? defaultOrreryPhotoCacheDeps;
  const backingOf = (image: SkImage): OrreryImageBacking => {
    try {
      return deps.backing ? deps.backing(image) : "cpu";
    } catch {
      return "unknown";
    }
  };
  const full = { images: maxImages, bytes: maxBytes };
  const ordinary = {
    images: Math.max(0, maxImages - reserveImages),
    bytes: Math.max(0, maxBytes - reserveImages * ORRERY_PHOTO_ESTIMATE_BYTES),
  };

  const images = new Map<number, ImageEntry>();
  /** key → the image of its newest decoded revision. */
  const currentByKey = new Map<string, number>();
  /** key → the revision whose load resolved null (deleted / unreadable). */
  const failed = new Map<string, number>();
  /** key → the one decode in flight for it. */
  const inflight = new Map<string, Flight>();
  /** Cancelled decodes not yet settled: still counted (they may still decode). */
  const cancelled = new Set<Flight>();
  const owners = new Map<string, OwnerState>();
  let imageSerial = 0;
  let ownerSerial = 0;
  let epochSerial = 0;
  let useClock = 0;
  let unsubscribeStore: (() => void) | null = null;
  const counters = { decodes: 0, disposed: 0, refused: 0 };
  let reconciling = false;
  let again = false;
  const changed = new Set<OwnerState>();

  const unheld = (entry: ImageEntry) =>
    entry.pins.size === 0 && entry.retired.size === 0;
  const isCurrent = (entry: ImageEntry) =>
    currentByKey.get(entry.key) === entry.id;

  function disposeEntry(entry: ImageEntry): void {
    images.delete(entry.id);
    if (currentByKey.get(entry.key) === entry.id)
      currentByKey.delete(entry.key);
    disposeQuietly(entry.image);
    counters.disposed++;
  }

  /** A superseded image nothing holds is disposed at once (never warm). */
  function settleHold(entry: ImageEntry, dispose = false): boolean {
    if (!unheld(entry)) return false;
    if (dispose || !isCurrent(entry)) disposeEntry(entry);
    return true;
  }

  function usage(): { images: number; bytes: number } {
    let bytes = 0;
    for (const entry of images.values()) bytes += entry.bytes;
    const flights = inflight.size + cancelled.size;
    return {
      images: images.size + flights,
      bytes: bytes + flights * ORRERY_PHOTO_ESTIMATE_BYTES,
    };
  }

  /**
   * Admission BEFORE decode: evicts LRU warm images until one more worst-case
   * decode fits `limit`. Never touches a pinned or retired image.
   */
  function admit(limit: { images: number; bytes: number }): boolean {
    let use = usage();
    const fits = () =>
      use.images + 1 <= limit.images &&
      use.bytes + ORRERY_PHOTO_ESTIMATE_BYTES <= limit.bytes;
    if (fits()) return true;
    const warm = [...images.values()]
      .filter((entry) => unheld(entry))
      .sort((a, b) => a.lastUse - b.lastUse);
    for (const entry of warm) {
      if (fits()) break;
      disposeEntry(entry);
      use = usage();
    }
    return fits();
  }

  function targetRevision(want: OrreryPhotoRequest): number {
    return Math.max(want.revision ?? 0, deps.revision(want.relativePath) ?? 0);
  }

  function setDrawn(
    owner: OwnerState,
    ownerId: string,
    next: Map<string, number>,
  ) {
    let differs = next.size !== owner.drawn.size;
    for (const [key, id] of next)
      if (owner.drawn.get(key) !== id) differs = true;
    if (!differs) return;
    const epoch = owner.epoch ?? 0;
    const keep = new Set(next.values());
    for (const id of new Set(owner.drawn.values())) {
      if (keep.has(id)) continue;
      const entry = images.get(id);
      if (!entry) continue;
      entry.pins.delete(ownerId);
      entry.retired.set(ownerId, epoch);
    }
    for (const id of next.values()) {
      const entry = images.get(id);
      if (!entry) continue;
      entry.pins.add(ownerId);
      entry.retired.delete(ownerId);
    }
    owner.drawn = next;
    changed.add(owner);
  }

  function startDecode(key: string, relativePath: string, revision: number) {
    const flight: Flight = {
      key,
      relativePath,
      revision,
      token: { cancelled: false },
    };
    inflight.set(key, flight);
    counters.decodes++;
    let result: Promise<SkImage | null>;
    try {
      result = deps.load(relativePath, flight.token);
    } catch (error) {
      result = Promise.reject(error);
    }
    result.then(
      (image) => settle(flight, image),
      (error) => {
        Logger.warn(LOG_SCOPE, `orrery photo decode failed for ${key}`, error);
        settle(flight, null);
      },
    );
  }

  function settle(flight: Flight, image: SkImage | null): void {
    if (inflight.get(flight.key) === flight) inflight.delete(flight.key);
    cancelled.delete(flight);
    if (flight.token.cancelled) {
      // Superseded revision, released owner or no longer wanted: disposed,
      // never published (H3 rule 4).
      if (image) {
        disposeQuietly(image);
        counters.disposed++;
      }
    } else if (!image) {
      failed.set(flight.key, flight.revision);
      // The previous revision is superseded: its image goes once unheld.
      const previous = currentByKey.get(flight.key);
      if (previous !== undefined) {
        const entry = images.get(previous);
        if (entry && entry.revision < flight.revision) {
          currentByKey.delete(flight.key);
          settleHold(entry);
        }
      }
    } else {
      const entry: ImageEntry = {
        id: ++imageSerial,
        key: flight.key,
        relativePath: flight.relativePath,
        revision: flight.revision,
        image,
        bytes: imageBytes(image),
        backing: backingOf(image),
        warm: false,
        pins: new Set(),
        retired: new Map(),
        lastUse: ++useClock,
      };
      images.set(entry.id, entry);
      const previous = currentByKey.get(flight.key);
      currentByKey.set(flight.key, entry.id);
      failed.delete(flight.key);
      const old = previous === undefined ? undefined : images.get(previous);
      if (old) settleHold(old);
    }
    reconcile();
  }

  function rankedWants(): RankedWant[] {
    const out: RankedWant[] = [];
    for (const [ownerId, owner] of owners) {
      if (owner.epoch === null) continue;
      for (const want of owner.wants.values())
        out.push({ owner, ownerId, want, target: targetRevision(want) });
    }
    out.sort(
      (a, b) =>
        Number(!!b.want.focused) - Number(!!a.want.focused) ||
        a.want.priority - b.want.priority ||
        a.owner.serial - b.owner.serial ||
        (a.want.key < b.want.key ? -1 : a.want.key > b.want.key ? 1 : 0),
    );
    return out;
  }

  function pass(): void {
    const wants = rankedWants();
    // 1. The desired set: the best-ranked wants that fit the caps. Ordinary
    //    photos together stay within cap − reserve; the focused photo may use
    //    the reserve (so focusing someone never blinks another photo).
    const used = { images: 0, bytes: 0 };
    const usedOrdinary = { images: 0, bytes: 0 };
    /** key → best-ranked admitted want (shared by every owner wanting it). */
    const admitted = new Map<string, RankedWant>();
    const refused = new Set<RankedWant>();
    for (const ranked of wants) {
      const { want, target } = ranked;
      if ((failed.get(want.key) ?? -1) >= target) continue;
      if (admitted.has(want.key)) continue;
      const current = currentByKey.get(want.key);
      const bytes =
        current === undefined
          ? ORRERY_PHOTO_ESTIMATE_BYTES
          : (images.get(current)?.bytes ?? ORRERY_PHOTO_ESTIMATE_BYTES);
      const fitsFull =
        used.images + 1 <= full.images && used.bytes + bytes <= full.bytes;
      const fitsOrdinary =
        usedOrdinary.images + 1 <= ordinary.images &&
        usedOrdinary.bytes + bytes <= ordinary.bytes;
      if (fitsFull && (want.focused || fitsOrdinary)) {
        used.images++;
        used.bytes += bytes;
        if (!want.focused) {
          usedOrdinary.images++;
          usedOrdinary.bytes += bytes;
        }
        admitted.set(want.key, ranked);
      } else refused.add(ranked);
    }
    // 2. Same-key revision replacements: the old image stays drawn while the
    //    new one decodes (both counted), using the reserve. When even that
    //    does not fit, a fallback generation drops the lowest-ranked admitted
    //    photos (not focused; off-screen first), else the replaced photo
    //    itself draws the fallback while it reloads.
    const replaceInPlace = new Set<string>();
    for (const [key, ranked] of [...admitted]) {
      if (!admitted.has(key)) continue;
      const current = currentByKey.get(key);
      const entry = current === undefined ? undefined : images.get(current);
      if (!entry || entry.revision >= ranked.target) continue;
      const fits = () =>
        used.images + 1 <= full.images &&
        used.bytes + ORRERY_PHOTO_ESTIMATE_BYTES <= full.bytes;
      if (!fits()) {
        const droppable = [...admitted.values()]
          .filter((r) => r.want.key !== key && !r.want.focused)
          .sort(
            (a, b) =>
              Number(!!a.want.visible) - Number(!!b.want.visible) ||
              b.want.priority - a.want.priority,
          );
        for (const drop of droppable) {
          if (fits()) break;
          admitted.delete(drop.want.key);
          refused.add(drop);
          const dropCurrent = currentByKey.get(drop.want.key);
          const dropBytes =
            dropCurrent === undefined
              ? ORRERY_PHOTO_ESTIMATE_BYTES
              : (images.get(dropCurrent)?.bytes ?? ORRERY_PHOTO_ESTIMATE_BYTES);
          used.images--;
          used.bytes -= dropBytes;
          usedOrdinary.images--;
          usedOrdinary.bytes -= dropBytes;
        }
      }
      if (fits()) {
        used.images++;
        used.bytes += ORRERY_PHOTO_ESTIMATE_BYTES;
      } else {
        replaceInPlace.add(key);
        used.bytes += ORRERY_PHOTO_ESTIMATE_BYTES - entry.bytes;
      }
    }
    counters.refused = refused.size;
    // 3. What each owner draws: the admitted keys' newest decoded image (a
    //    stale revision until its replacement lands); everything else draws
    //    the fallback. Images an owner stops drawing retire (H3).
    for (const [ownerId, owner] of owners) {
      if (owner.epoch === null) continue;
      const next = new Map<string, number>();
      for (const want of owner.wants.values()) {
        if (!admitted.has(want.key) || replaceInPlace.has(want.key)) continue;
        const current = currentByKey.get(want.key);
        if (current === undefined) continue;
        const entry = images.get(current);
        if (!entry) continue;
        entry.lastUse = ++useClock;
        next.set(want.key, current);
      }
      setDrawn(owner, ownerId, next);
    }
    // 4. Cancel decodes nobody admitted, or of a superseded revision.
    for (const flight of [...inflight.values()]) {
      const ranked = admitted.get(flight.key);
      if (ranked && ranked.target <= flight.revision) continue;
      flight.token.cancelled = true;
      inflight.delete(flight.key);
      cancelled.add(flight);
    }
    // 5. Start decodes in rank order, each admitted against the HARD caps
    //    first (the reserve policy is the desired set's; physically every
    //    held, retired and in-flight image counts). A decode that does not fit
    //    yet waits for retired images to be acked, never for a timer.
    for (const [key, ranked] of admitted) {
      if (inflight.size >= concurrency) break;
      if (inflight.has(key)) continue;
      const current = currentByKey.get(key);
      const entry = current === undefined ? undefined : images.get(current);
      if (entry && entry.revision >= ranked.target) continue;
      if (!admit(full)) break;
      startDecode(key, ranked.want.relativePath, ranked.target);
    }
  }

  function reconcile(): void {
    if (reconciling) {
      again = true;
      return;
    }
    reconciling = true;
    try {
      let guard = 0;
      do {
        again = false;
        pass();
      } while (again && ++guard < 8);
    } finally {
      reconciling = false;
    }
    const notify = [...changed];
    changed.clear();
    for (const owner of notify) {
      try {
        owner.onReady?.();
      } catch (error) {
        Logger.warn(LOG_SCOPE, "photo publish listener failed", error);
      }
    }
  }

  function knows(relativePath: string): boolean {
    for (const owner of owners.values())
      for (const want of owner.wants.values())
        if (want.relativePath === relativePath) return true;
    for (const entry of images.values())
      if (entry.relativePath === relativePath) return true;
    for (const flight of inflight.values())
      if (flight.relativePath === relativePath) return true;
    return false;
  }

  function ownerState(owner: string): OwnerState {
    let state = owners.get(owner);
    if (!state) {
      state = {
        serial: ++ownerSerial,
        epoch: null,
        wants: new Map(),
        drawn: new Map(),
        onReady: null,
      };
      owners.set(owner, state);
    }
    return state;
  }

  return {
    maxImages,
    maxBytes,
    reserveImages,
    mount(owner, onReady) {
      if (!unsubscribeStore)
        unsubscribeStore = deps.subscribe((relativePath, revision) => {
          // M5 (38.7-15): an unheld image of an older revision is dropped at
          // once — nothing records it (no pin, no pending ack), so a warm
          // return never draws stale bytes; the return re-requests the path.
          let dropped = 0;
          for (const entry of [...images.values()])
            if (
              entry.relativePath === relativePath &&
              entry.revision < revision &&
              unheld(entry)
            ) {
              disposeEntry(entry);
              dropped++;
            }
          if (dropped > 0 || knows(relativePath)) reconcile();
        });
      // A new visit retries photos whose last load failed (transient errors).
      failed.clear();
      const state = ownerState(owner);
      state.epoch = ++epochSerial;
      state.onReady = onReady;
      return state.epoch;
    },
    request(owner, entries) {
      const state = owners.get(owner);
      if (!state || state.epoch === null) return;
      const wants = new Map<string, OrreryPhotoRequest>();
      for (const entry of entries) {
        const previous = wants.get(entry.key);
        if (
          !previous ||
          Number(!!entry.focused) > Number(!!previous.focused) ||
          (!!entry.focused === !!previous.focused &&
            entry.priority < previous.priority)
        )
          wants.set(entry.key, entry);
      }
      state.wants = wants;
      reconcile();
    },
    drawn(owner) {
      const state = owners.get(owner);
      const out = new Map<string, OrreryDrawnPhoto>();
      if (!state) return out;
      for (const [key, id] of state.drawn) {
        const entry = images.get(id);
        if (entry) out.set(key, { id, image: entry.image });
      }
      return out;
    },
    confirmRetired(owner, ids, epoch, confirmOptions = {}) {
      let freed = 0;
      for (const id of ids) {
        const entry = images.get(id);
        if (!entry || entry.retired.get(owner) !== epoch) continue;
        entry.retired.delete(owner);
        // 38.7-15: another owner's teardown never disposes a warm-owner entry.
        if (settleHold(entry, !!confirmOptions.dispose && !entry.warm)) freed++;
      }
      if (freed > 0) reconcile();
      return freed;
    },
    release(owner) {
      const state = owners.get(owner);
      if (!state || state.epoch === null) return null;
      const epoch = state.epoch;
      for (const id of new Set(state.drawn.values())) {
        const entry = images.get(id);
        if (!entry) continue;
        entry.pins.delete(owner);
        entry.retired.set(owner, epoch);
      }
      state.drawn = new Map();
      state.wants = new Map();
      state.epoch = null;
      state.onReady = null;
      changed.delete(state);
      reconcile();
      return epoch;
    },
    confirmReleased(owner, epoch, releaseOptions = {}) {
      let freed = 0;
      for (const entry of [...images.values()]) {
        if (entry.retired.get(owner) !== epoch) continue;
        entry.retired.delete(owner);
        if (settleHold(entry, !!releaseOptions.dispose && !entry.warm)) freed++;
      }
      const state = owners.get(owner);
      if (state && state.epoch === null && state.drawn.size === 0)
        owners.delete(owner);
      if (freed > 0) reconcile();
      return freed;
    },
    handOffWarm(owner, epoch) {
      const retained: number[] = [];
      let freed = 0;
      for (const entry of [...images.values()]) {
        if (entry.retired.get(owner) !== epoch) continue;
        entry.retired.delete(owner);
        if (!unheld(entry)) continue; // another owner still holds it
        freed++;
        if (isCurrent(entry) && entry.backing === "cpu") {
          entry.warm = true;
          retained.push(entry.id);
        } else disposeEntry(entry);
      }
      const state = owners.get(owner);
      if (state && state.epoch === null && state.drawn.size === 0)
        owners.delete(owner);
      if (freed > 0) reconcile();
      return retained;
    },
    trimWarm(maxBytes) {
      const limit = Math.max(0, maxBytes);
      const warm = [...images.values()]
        .filter((entry) => unheld(entry))
        .sort((a, b) => a.lastUse - b.lastUse);
      let bytes = 0;
      for (const entry of warm) bytes += entry.bytes;
      let disposed = 0;
      for (const entry of warm) {
        if (bytes <= limit) break;
        bytes -= entry.bytes;
        disposeEntry(entry);
        disposed++;
      }
      if (disposed > 0) reconcile();
      return disposed;
    },
    clearUnheld() {
      let disposed = 0;
      for (const entry of [...images.values()])
        if (unheld(entry)) {
          disposeEntry(entry);
          disposed++;
        }
      if (disposed > 0) reconcile();
      return disposed;
    },
    stats() {
      let pinned = 0;
      let warm = 0;
      let retired = 0;
      let warmBytes = 0;
      for (const entry of images.values()) {
        if (entry.pins.size > 0) pinned++;
        else if (entry.retired.size > 0) retired++;
        else {
          warm++;
          warmBytes += entry.bytes;
        }
      }
      return {
        images: images.size,
        pinned,
        warm,
        retired,
        inflight: inflight.size + cancelled.size,
        bytes: usage().bytes,
        warmBytes,
        ...counters,
      };
    },
  };
}

/** The app-wide instance (the V2 renderer; Plan 15's warm owner shares it). */
export const orreryPhotoCache = createOrreryPhotoCache();
