/**
 * Orrery photo derivatives on disk (38.6 D-41).
 *
 * WHY: a 1024 master (D-10) is too large for the Skia Orrery, so it draws a
 * ≤`ORRERY_TEXTURE_MAX` copy (D-11). Until D-41 that copy lived only in memory,
 * so EVERY cold start ran the manipulator over every 1024 master again. On
 * Android the manipulator decodes through Glide, which (API 29+, no transform)
 * returns a HARDWARE Bitmap — GPU-backed graphics memory — and
 * `Bitmap.createScaledBitmap` on a HARDWARE source returns another one. Nothing
 * recycles them; they are freed only when the Java GC collects the Bitmap
 * objects, tens of seconds later. That is the transient Graphics / GL excess the
 * device pass measured at 20 s (D-37/D-41). Keeping the small copy on disk means
 * each master is downsampled once per byte change; every later Orrery load
 * reads the small JPEG through Skia exactly like a legacy 512 master.
 *
 * LAYOUT (cache dir only — evictable, never backed up, never in a manifest):
 *   `<cache>/orrery-photo/<canonical basename>/<size>-<mtime>.jpg`
 * One sub-directory per canonical master (`avatars/contact-12.jpg` →
 * `orrery-photo/contact-12.jpg/`), so deleting a photo's derivatives is one
 * directory delete with no listing. The file name is the master's durable
 * signature (byte size + modification time in ms), read from the master on
 * every load: the in-process display revision resets on restart, the signature
 * does not, so a changed master can never be paired with a stale derivative.
 *
 * LIFECYCLE / PRIVACY:
 *   - The ownership layer calls `discardOrreryDerivatives` from
 *     `notifyPhotoBytesChanged`, the one funnel every canonical byte change and
 *     delete passes through (persist, delete intents incl. purge / definition
 *     delete / merge cleanup, restore finalize, replace-all cleanup, `.bak`
 *     reconcile). A deleted contact's photo therefore does not linger here.
 *   - `installOrreryDerivative` re-reads the master's signature AFTER the
 *     atomic rename and deletes its own file if the master changed or vanished
 *     meanwhile, so a derivation racing a delete cannot leave a copy behind.
 *     It also compares the in-process display revision captured when the load
 *     started: every byte change bumps it, so a replace whose new master has
 *     the same size + mtime (one timestamp tick) is still caught.
 *   - A launch sweep (once per process) walks the WHOLE namespace in chunks,
 *     yielding between them, off the launch-sweep critical path, and deletes
 *     sub-directories whose master is gone, files whose signature no longer
 *     matches, and anything else in the namespace (crash leftovers).
 *
 * Every path is built from a validated canonical basename and a numeric
 * signature, and every delete is confined to the namespace. Nothing here reads
 * or writes canonical photo bytes (only a read-only stat of the master).
 * The native file system is behind `OrreryDerivativeFs` (loaded lazily, like
 * `derivative-cache.ts`) so node tests run against fakes.
 */
import { isStoredPhotoPath } from "@/db/photo-relative-path";
import { registerSweepHook } from "@/services/launch-sweep";
import { discardDerivative } from "@/services/photos/derivative-cache";
import { photoFileStat } from "@/services/photos/photo-storage";
import { getPhotoCacheBust } from "@/stores/photo-cache-bust-store";
import { Logger } from "@/utils/logger";

// --- Tunable constants (top-of-file per project convention) ------------------

/** The derivative namespace under the app's cache directory. */
export const ORRERY_DERIVATIVE_DIR = "orrery-photo";

/**
 * Namespace entries (photo sub-directories plus stray files) the launch sweep
 * inspects before it yields a macrotask (WR6-01). Each costs a stat of its
 * master and a listing of one or two files on the JS thread, so a chunk stays
 * well under a frame's worth of work. There is NO per-launch cap: the sweep
 * walks the whole namespace, so an orphan is never starved behind live entries.
 */
export const ORRERY_DERIVATIVE_SWEEP_CHUNK = 50;

const LOG_SCOPE = "orrery-derivative-store";

/** A canonical master's basename (`SAFE_RELATIVE` minus `avatars/`). */
const BASENAME = /^[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/;
/** `<size>-<mtime>` — both non-negative integers. */
const SIGNATURE = /^\d+-\d+$/;
const DERIVATIVE_FILE = /^(\d+-\d+)\.jpg$/;

// --- Injectable native boundary ----------------------------------------------

export interface OrreryDerivativeEntry {
  name: string;
  uri: string;
  isDirectory: boolean;
}

export interface OrreryDerivativeFs {
  /** `Paths.cache.uri`. */
  cacheUri: string;
  /** Read-only size + mtime of a canonical master; null when missing. */
  masterStat(
    relative: string,
  ): { size: number; modificationTime: number } | null;
  /** Byte size of a file, or null when it does not exist. */
  fileSize(uri: string): number | null;
  dirExists(uri: string): boolean;
  ensureDir(uri: string): void;
  list(directoryUri: string): OrreryDerivativeEntry[];
  deleteFile(uri: string): void;
  /** Recursive delete of a directory. */
  deleteDir(uri: string): void;
  /** Rename `from` onto `to` (same file system), replacing `to`. */
  move(from: string, to: string): Promise<void>;
}

type ExpoFileSystem = typeof import("expo-file-system");

let productionFsCache: OrreryDerivativeFs | null = null;

function productionFs(): OrreryDerivativeFs {
  if (productionFsCache) return productionFsCache;
  // Lazy: node-pure importers (owned-master and its tests) never load the
  // native module unless they really touch the cache.
  const { Directory, File, Paths } =
    require("expo-file-system") as ExpoFileSystem;
  productionFsCache = {
    cacheUri: Paths.cache.uri,
    masterStat: (relative) => photoFileStat(relative),
    fileSize: (uri) => {
      const info = new File(uri).info();
      return info.exists && typeof info.size === "number" ? info.size : null;
    },
    dirExists: (uri) => new Directory(uri).exists,
    ensureDir: (uri) =>
      new Directory(uri).create({ intermediates: true, idempotent: true }),
    list: (uri) =>
      new Directory(uri).list().map((entry) => ({
        name: entry.name,
        uri: entry.uri,
        isDirectory: entry instanceof Directory,
      })),
    deleteFile: (uri) => new File(uri).delete(),
    deleteDir: (uri) => new Directory(uri).delete(),
    move: (from, to) => new File(from).move(new File(to), { overwrite: true }),
  };
  return productionFsCache;
}

// --- Pure naming -------------------------------------------------------------

/** The canonical's basename, or null for anything that is not a stored photo path. */
function basenameOf(relative: string): string | null {
  if (!isStoredPhotoPath(relative)) return null;
  const name = relative.slice("avatars/".length);
  return BASENAME.test(name) ? name : null;
}

function namespaceUri(fs: OrreryDerivativeFs): string {
  return `${fs.cacheUri.replace(/\/+$/, "")}/${ORRERY_DERIVATIVE_DIR}`;
}

function photoDirUri(fs: OrreryDerivativeFs, basename: string): string {
  return `${namespaceUri(fs)}/${basename}`;
}

/** The durable signature string for a master stat (null when unusable). */
export function formatOrrerySignature(
  stat: { size: number; modificationTime: number } | null,
): string | null {
  if (!stat) return null;
  const { size, modificationTime } = stat;
  if (!Number.isSafeInteger(size) || size <= 0) return null;
  if (!Number.isFinite(modificationTime) || modificationTime < 0) return null;
  return `${size}-${Math.trunc(modificationTime)}`;
}

/** The derivative file URI for a canonical + signature (null when unsafe). */
export function orreryDerivativeUri(
  relative: string,
  signature: string,
  fs: OrreryDerivativeFs = productionFs(),
): string | null {
  const basename = basenameOf(relative);
  if (!basename || !SIGNATURE.test(signature)) return null;
  return `${photoDirUri(fs, basename)}/${signature}.jpg`;
}

/** True when `uri` is a derivative file inside the namespace. */
function isDerivativeFileUri(fs: OrreryDerivativeFs, uri: string): boolean {
  if (uri.includes("%") || uri.includes("?") || uri.includes("#")) return false;
  const prefix = `${namespaceUri(fs)}/`;
  if (!uri.startsWith(prefix)) return false;
  const parts = uri.slice(prefix.length).split("/");
  return (
    parts.length === 2 &&
    BASENAME.test(parts[0]) &&
    DERIVATIVE_FILE.test(parts[1])
  );
}

// --- Read path ---------------------------------------------------------------

/**
 * The master's current durable signature (size + mtime), or null when the
 * master is missing or unreadable. Read on every Orrery load.
 */
export function orreryMasterSignature(
  relative: string,
  fs: OrreryDerivativeFs = productionFs(),
): string | null {
  if (!basenameOf(relative)) return null;
  try {
    return formatOrrerySignature(fs.masterStat(relative));
  } catch {
    Logger.warn(LOG_SCOPE, "master stat failed");
    return null;
  }
}

/**
 * The derivative for this exact signature if it exists and is non-empty.
 * A derivative for any other signature is never returned (stale).
 */
export function findOrreryDerivative(
  relative: string,
  signature: string,
  fs: OrreryDerivativeFs = productionFs(),
): string | null {
  try {
    const uri = orreryDerivativeUri(relative, signature, fs);
    if (!uri) return null;
    const size = fs.fileSize(uri);
    return size !== null && size > 0 ? uri : null;
  } catch {
    Logger.warn(LOG_SCOPE, "derivative lookup failed");
    return null;
  }
}

/** Delete one unusable derivative file (corrupt / undecodable). Never throws. */
export function dropOrreryDerivative(
  uri: string,
  fs: OrreryDerivativeFs = productionFs(),
): boolean {
  try {
    if (!isDerivativeFileUri(fs, uri)) {
      Logger.warn(LOG_SCOPE, "derivative drop refused outside namespace");
      return false;
    }
    if (fs.fileSize(uri) !== null) fs.deleteFile(uri);
    return true;
  } catch {
    Logger.warn(LOG_SCOPE, "derivative drop failed");
    return false;
  }
}

// --- Write path --------------------------------------------------------------

/**
 * Install a freshly encoded derivative (the manipulator's temp file in
 * `cache/ImageManipulator/`) for `relative` at `signature`, atomically: the
 * final name appears only through a rename, so a reader never sees a partial
 * file. Older signatures of the same photo are removed first. Resolves the
 * final URI, or null when the master changed or vanished while the
 * derivative was being made (the new file is deleted again — never a stale or
 * orphaned copy). "Changed" is either signal: the master's signature, or the
 * in-process display revision (`photo-cache-bust-store`) moving on from
 * `startRevision`, the value the load read before it looked at the master.
 * On a failed move the temp file is retired and the error rethrown.
 */
export async function installOrreryDerivative(
  tempUri: string,
  relative: string,
  signature: string,
  startRevision: number | undefined,
  fs: OrreryDerivativeFs = productionFs(),
): Promise<string | null> {
  const basename = basenameOf(relative);
  const finalUri = orreryDerivativeUri(relative, signature, fs);
  if (!basename || !finalUri) {
    discardDerivative(tempUri);
    throw new Error("unsafe orrery derivative target");
  }
  const dir = photoDirUri(fs, basename);
  // The bytes changed since the load began (their derivatives were already
  // discarded): install nothing, and never touch the photo's directory.
  if (getPhotoCacheBust(relative) !== startRevision) {
    discardDerivative(tempUri);
    return null;
  }
  let expectedSize: number | null;
  try {
    expectedSize = fs.fileSize(tempUri);
    if (expectedSize === null || expectedSize <= 0)
      throw new Error("orrery derivative temp file is empty");
    fs.ensureDir(dir);
    for (const entry of fs.list(dir)) {
      // By name: a listing may spell the cache path differently.
      if (!entry.isDirectory && entry.name === `${signature}.jpg`) continue;
      if (entry.isDirectory) fs.deleteDir(entry.uri);
      else fs.deleteFile(entry.uri);
    }
    await fs.move(tempUri, finalUri);
  } catch (error) {
    discardDerivative(tempUri);
    throw error;
  }
  // A short or missing file after the rename is not a derivative.
  if (fs.fileSize(finalUri) !== expectedSize) {
    dropOrreryDerivative(finalUri, fs);
    throw new Error("orrery derivative size mismatch after install");
  }
  // The master may have been replaced or deleted (with its derivatives
  // discarded) while this one was being made: never leave a copy behind. The
  // revision check closes a replace within one mtime tick at the same size.
  if (
    getPhotoCacheBust(relative) !== startRevision ||
    orreryMasterSignature(relative, fs) !== signature
  ) {
    dropOrreryDerivative(finalUri, fs);
    return null;
  }
  return finalUri;
}

/**
 * Delete every derivative of a canonical photo (38.6 D-41 privacy). Called by
 * the ownership layer whenever the canonical's bytes change or are deleted.
 * Never throws: a cache cleanup must not turn a landed write into a failure.
 */
export function discardOrreryDerivatives(
  relative: string,
  fs?: OrreryDerivativeFs,
): boolean {
  try {
    const basename = basenameOf(relative);
    if (!basename) return false;
    const boundary = fs ?? productionFs();
    const dir = photoDirUri(boundary, basename);
    if (boundary.dirExists(dir)) boundary.deleteDir(dir);
    return true;
  } catch {
    Logger.warn(LOG_SCOPE, "derivative discard failed");
    return false;
  }
}

// --- Launch sweep --------------------------------------------------------------

let swept = false;

/** Yield one macrotask (a cooperative pause, not a scheduler or a timer). */
function nextMacrotask(): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

/** Inspect one namespace entry; returns how many things it removed. */
function sweepEntry(
  boundary: OrreryDerivativeFs,
  entry: OrreryDerivativeEntry,
): number {
  const relative = `avatars/${entry.name}`;
  if (!entry.isDirectory || !basenameOf(relative)) {
    if (entry.isDirectory) boundary.deleteDir(entry.uri);
    else boundary.deleteFile(entry.uri);
    return 1;
  }
  // Discarded since the listing (a byte change between chunks): nothing left.
  if (!boundary.dirExists(entry.uri)) return 0;
  const signature = orreryMasterSignature(relative, boundary);
  if (signature === null) {
    boundary.deleteDir(entry.uri);
    return 1;
  }
  let removed = 0;
  for (const file of boundary.list(entry.uri)) {
    if (!file.isDirectory && file.name === `${signature}.jpg`) continue;
    if (file.isDirectory) boundary.deleteDir(file.uri);
    else boundary.deleteFile(file.uri);
    removed += 1;
  }
  return removed;
}

/**
 * Orphan sweep (once per process): remove photo sub-directories whose master
 * is gone, derivative files whose signature no longer matches the master, and
 * anything else in the namespace. WR6-01: walks EVERY entry of the listing (no
 * head-of-list cap, so an orphan listed after any number of live entries is
 * still reached), `ORRERY_DERIVATIVE_SWEEP_CHUNK` at a time, yielding a
 * macrotask between chunks so the JS thread is never held for the whole walk.
 * Each entry is inspected synchronously (no yield inside one entry), so a
 * concurrent install or discard always sees a consistent directory. Never
 * rejects.
 */
export async function sweepOrreryDerivativesOncePerProcess(
  fs?: OrreryDerivativeFs,
  yieldTick: () => Promise<void> = nextMacrotask,
): Promise<{ removed: number; inspected: number }> {
  const summary = { removed: 0, inspected: 0 };
  if (swept) return summary;
  swept = true;
  let boundary: OrreryDerivativeFs;
  let entries: OrreryDerivativeEntry[];
  try {
    boundary = fs ?? productionFs();
    if (!boundary.dirExists(namespaceUri(boundary))) return summary;
  } catch {
    Logger.warn(LOG_SCOPE, "derivative sweep unavailable");
    return summary;
  }
  try {
    entries = boundary.list(namespaceUri(boundary));
  } catch {
    Logger.warn(LOG_SCOPE, "derivative sweep listing failed");
    return summary;
  }
  for (let index = 0; index < entries.length; index++) {
    if (index > 0 && index % ORRERY_DERIVATIVE_SWEEP_CHUNK === 0) {
      try {
        await yieldTick();
      } catch {
        // A failed yield only costs responsiveness; keep walking.
      }
    }
    summary.inspected += 1;
    try {
      summary.removed += sweepEntry(boundary, entries[index]);
    } catch {
      Logger.warn(LOG_SCOPE, "derivative sweep entry failed");
    }
  }
  return summary;
}

/**
 * Register the orphan sweep on the launch-sweep registry (App.tsx, once). The
 * hook STARTS the chunked walk and resolves at once, so later launch hooks
 * (photo finalize, backup) and the settled tick never wait on a cache cleanup
 * (WR6-01). The walk is once per process and never rejects.
 */
export function registerOrreryDerivativeSweep(): void {
  registerSweepHook(
    async () => {
      void sweepOrreryDerivativesOncePerProcess().catch(() => {
        Logger.warn(LOG_SCOPE, "derivative sweep failed");
      });
    },
    { id: "orrery-derivative" },
  );
}

/** Test-only reset; production never resets the once-per-process guard. */
export function __resetOrreryDerivativeSweepForTest(): void {
  swept = false;
}
