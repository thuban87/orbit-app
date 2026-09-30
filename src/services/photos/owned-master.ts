/** Process-local ownership of canonical photo files. Lock order: path, then DB write mutex. */
import { assertSafeRelative } from "@/db/photo-relative-path";
import {
  deleteJournalEntryCore,
  enqueueDeleteIntentCore,
  listJournalForCanonicalCore,
  mayDeleteCanonicalCore,
  type RestorePhotoJournalEntry,
  retireJournalForCanonicalCore,
} from "@/db/restore-photo-journal-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { bumpPhotoCacheBust } from "@/stores/photo-cache-bust-store";
import { Logger } from "@/utils/logger";
import {
  deletePhoto,
  deleteRestorePending,
  listRestorePendingPhotos,
  persistMaster,
  photoFileExists,
  reconcilePhotoWritesForCanonical,
  resolveRestorePendingUri,
} from "./photo-storage";

const tails = new Map<string, Promise<void>>();
const generations = new Map<string, number>();
const invoking = new Set<string>();
type PersistCanonical = (
  sourceUri: string,
  canonical: string,
) => Promise<unknown>;
type DeleteCanonical = (canonical: string) => void;
type CanonicalExists = (canonical: string) => boolean;
export class PhotoRecoveryPendingError extends Error {}
export class PhotoWriteUnauthorizedError extends Error {}

export interface CanonicalLockToken {
  readonly paths: ReadonlySet<string>;
}
function requireLock(token: CanonicalLockToken, canonical: string): void {
  if (!token.paths.has(canonical))
    throw new Error(`canonical path lock not held: ${canonical}`);
}
export function canonicalGeneration(canonical: string): number {
  return generations.get(canonical) ?? 0;
}
function bump(canonical: string): void {
  generations.set(canonical, canonicalGeneration(canonical) + 1);
}

/**
 * DISPLAY-ONLY notification that a canonical photo's bytes changed (38.6 D-19).
 * Bumps the in-process display revision in `photo-cache-bust-store`, which the
 * expo-image display URI carries as `?v=<revision>` (filenames never change,
 * D-21). Deliberately separate from the AUTHORIZATION `generations` map above:
 * retry and merge compare `canonicalGeneration`, so display must never bump or
 * read it. Call wherever canonical bytes change.
 *
 * Never throws for a display failure (review IN-06): the bump runs zustand
 * subscribers synchronously, and a throwing subscriber must not turn a write
 * whose bytes already landed into a failed write (or skip the caller's
 * authorization bump). The revision itself is set before subscribers run. An
 * unsafe path still throws — that is a caller bug, not a display failure.
 */
export function notifyPhotoBytesChanged(canonical: string): void {
  assertSafeRelative(canonical);
  try {
    bumpPhotoCacheBust(canonical);
  } catch (error) {
    Logger.error("owned-master", "display revision subscriber failed", error);
  }
}

export async function withCanonicalPathLocks<T>(
  paths: readonly string[],
  fn: (token: CanonicalLockToken) => Promise<T>,
): Promise<T> {
  const ordered = [...new Set(paths)].sort();
  for (const path of ordered) assertSafeRelative(path);
  for (const path of ordered)
    if (invoking.has(path))
      throw new Error(`reentrant canonical lock: ${path}`);
  const held = new Set<string>();
  const run = async (index: number): Promise<T> => {
    if (index === ordered.length) {
      for (const path of ordered) invoking.add(path);
      let result: Promise<T>;
      try {
        result = fn({ paths: new Set(ordered) });
      } finally {
        for (const path of ordered) invoking.delete(path);
      }
      return result;
    }
    const path = ordered[index];
    if (held.has(path)) throw new Error(`reentrant canonical lock: ${path}`);
    const previous = tails.get(path) ?? Promise.resolve();
    let release!: () => void;
    const tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    tails.set(path, tail);
    await previous;
    held.add(path);
    try {
      return await run(index + 1);
    } finally {
      held.delete(path);
      release();
      if (tails.get(path) === tail) tails.delete(path);
    }
  };
  return run(0);
}
/**
 * Whether an owned operation holds, or waits for, this canonical's path lock
 * right now (process-local). For a caller that cannot take the lock itself,
 * such as code inside a DB transaction (lock order: path, then DB), a busy
 * lock means bytes may be about to land at this path (38.6 review WR3-02).
 */
export function canonicalPathLockBusy(canonical: string): boolean {
  assertSafeRelative(canonical);
  return tails.has(canonical);
}
export function withCanonicalPathLock<T>(
  canonical: string,
  fn: (token: CanonicalLockToken) => Promise<T>,
): Promise<T> {
  return withCanonicalPathLocks([canonical], fn);
}

async function retire(exec: SqlExecutor, relative: string): Promise<void> {
  await inWriteTransaction(exec, () => deleteJournalEntryCore(exec, relative));
}
async function referenceMatches(
  exec: SqlExecutor,
  entry: RestorePhotoJournalEntry,
): Promise<boolean> {
  const path = entry.canonicalRelativePath;
  if (entry.targetKind === "profile") {
    return (
      (await exec.getFirstAsync(
        "SELECT 1 FROM profile WHERE id = 1 AND photo = ?",
        [path],
      )) !== null
    );
  }
  if (entry.targetKind === "contact") {
    return (
      !!entry.contactUid &&
      (await exec.getFirstAsync(
        "SELECT 1 FROM contacts WHERE uid = ? AND photo = ?",
        [entry.contactUid, path],
      )) !== null
    );
  }
  if (!entry.contactUid || !entry.fieldDefUid || !entry.valueUid) return false;
  return (
    (await exec.getFirstAsync(
      `SELECT 1 FROM custom_field_values v JOIN contacts c ON c.id = v.contact_id
     JOIN custom_field_defs d ON d.id = v.field_def_id
     WHERE v.uid = ? AND c.uid = ? AND d.uid = ? AND v.value = ?`,
      [entry.valueUid, entry.contactUid, entry.fieldDefUid, path],
    )) !== null
  );
}

export async function executeDeleteIntentLocked(
  exec: SqlExecutor,
  token: CanonicalLockToken,
  canonical: string,
  remove: DeleteCanonical = deletePhoto,
  exists: CanonicalExists = photoFileExists,
): Promise<void> {
  requireLock(token, canonical);
  const relative = `delete:${canonical}`;
  if (
    !(await exec.getFirstAsync(
      "SELECT 1 FROM restore_photo_journal WHERE relative_path = ?",
      [relative],
    ))
  )
    return;
  // A reference cleared by Save makes an older finalize superseded. Retire it
  // before evaluating the delete predicate so it cannot strand this intent.
  for (const finalize of await listJournalForCanonicalCore(exec, canonical)) {
    if (
      finalize.action === "finalize" &&
      !(await referenceMatches(exec, finalize))
    ) {
      await retire(exec, finalize.relativePath);
      deleteRestorePending(finalize.relativePath);
    }
  }
  if (await mayDeleteCanonicalCore(exec, canonical)) {
    remove(canonical);
    if (exists(canonical))
      throw new PhotoRecoveryPendingError(
        `photo deletion needs retry: ${canonical}`,
      );
    // Only after the recheck: deletePhoto swallows errors, so the file could
    // still be on disk straight after remove() (38.6 D-01).
    notifyPhotoBytesChanged(canonical);
  }
  await retire(exec, relative);
}
export function executeDeleteIntentOwned(
  exec: SqlExecutor,
  canonical: string,
  remove?: DeleteCanonical,
  exists?: CanonicalExists,
): Promise<void> {
  return withCanonicalPathLock(canonical, (token) =>
    executeDeleteIntentLocked(exec, token, canonical, remove, exists),
  );
}

async function settleRowLocked(
  exec: SqlExecutor,
  token: CanonicalLockToken,
  entry: RestorePhotoJournalEntry & { id: number },
  superseded = false,
  persist: PersistCanonical = persistMaster,
): Promise<void> {
  if (entry.action === "delete")
    return executeDeleteIntentLocked(exec, token, entry.canonicalRelativePath);
  if (superseded || !(await referenceMatches(exec, entry))) {
    await retire(exec, entry.relativePath);
    deleteRestorePending(entry.relativePath);
    return;
  }
  // Missing pending file (review WR-01, owner ruling D-23). `persist` copies the
  // pending file and never moves it, and this function retires the row before
  // deleting the pending file, so a crash here leaves either (row + pending) or
  // (pending, no row). This branch therefore fires only after an external loss
  // of `avatars/_restore_pending/*` or a state left by an older ordering.
  // Retiring is safe: without pending bytes the journal can recover nothing.
  // If the canonical is present the bytes landed. If it is missing, the stored
  // reference is KEPT (never cleared: D-23) as the durable evidence of the lost
  // photo; the Profile / photo editor show it as unavailable and the backup
  // counts it (D-24). Never throw here: `settleCanonicalLocked` runs before
  // every persist (a throw would wedge re-picking the photo), and a failed
  // restore-photo-finalize sweep skips the backup hook (ADR-156 `requires`).
  // No display revision: the bytes did not change.
  if (
    !listRestorePendingPhotos().some(
      (item) => item.relative === entry.relativePath,
    )
  ) {
    const landed = photoFileExists(entry.canonicalRelativePath);
    await retire(exec, entry.relativePath);
    if (!landed)
      Logger.error(
        "owned-master",
        "restore photo bytes lost; reference kept (D-23)",
      );
    return;
  }
  try {
    await persist(
      resolveRestorePendingUri(entry.relativePath),
      entry.canonicalRelativePath,
    );
  } catch (error) {
    throw new PhotoRecoveryPendingError(
      `photo recovery needs retry: ${entry.canonicalRelativePath}`,
      { cause: error },
    );
  }
  // Display only: restore / merge re-homing changed the canonical bytes. The
  // authorization generation is deliberately untouched here (D-19).
  notifyPhotoBytesChanged(entry.canonicalRelativePath);
  await retire(exec, entry.relativePath);
  deleteRestorePending(entry.relativePath);
}

export async function settleCanonicalLocked(
  exec: SqlExecutor,
  token: CanonicalLockToken,
  canonical: string,
): Promise<void> {
  requireLock(token, canonical);
  const rows = await listJournalForCanonicalCore(exec, canonical);
  const newestFinalize = rows
    .filter((row) => row.action === "finalize")
    .at(-1)?.id;
  for (const row of rows)
    await settleRowLocked(
      exec,
      token,
      row,
      row.action === "finalize" && row.id !== newestFinalize,
    );
}
export async function finalizeJournalEntryLocked(
  exec: SqlExecutor,
  token: CanonicalLockToken,
  entry: RestorePhotoJournalEntry,
  persist: PersistCanonical = persistMaster,
): Promise<void> {
  requireLock(token, entry.canonicalRelativePath);
  const rows = await listJournalForCanonicalCore(
    exec,
    entry.canonicalRelativePath,
  );
  const target = rows.find((row) => row.relativePath === entry.relativePath);
  if (!target) return;
  const newer = rows.some(
    (row) => row.action === "finalize" && row.id > target.id,
  );
  for (const row of rows) {
    if (row.id >= target.id) break;
    await settleRowLocked(exec, token, row, row.action === "finalize");
  }
  await settleRowLocked(exec, token, target, newer, persist);
}
export function finalizeJournalEntryOwned(
  exec: SqlExecutor,
  entry: RestorePhotoJournalEntry,
  persist?: PersistCanonical,
): Promise<void> {
  return withCanonicalPathLock(entry.canonicalRelativePath, (token) =>
    finalizeJournalEntryLocked(exec, token, entry, persist),
  );
}

export interface OwnedWriteOptions {
  authorize?: (exec: SqlExecutor) => Promise<boolean>;
  /** Test boundary for the native file writer; production uses persistMaster. */
  persist?: (sourceUri: string, canonical: string) => Promise<string>;
}
export async function persistOwnedMasterLocked(
  exec: SqlExecutor,
  token: CanonicalLockToken,
  srcUri: string,
  canonical: string,
  opts: OwnedWriteOptions = {},
): Promise<string> {
  requireLock(token, canonical);
  await settleCanonicalLocked(exec, token, canonical);
  if (opts.authorize && !(await opts.authorize(exec)))
    throw new PhotoWriteUnauthorizedError(`photo target changed: ${canonical}`);
  const result = opts.persist
    ? await opts.persist(srcUri, canonical)
    : await persistMaster(srcUri, canonical);
  // Authorization first: retry and merge rely on it (IN-06).
  bump(canonical);
  notifyPhotoBytesChanged(canonical);
  return result;
}
export function persistOwnedMaster(
  exec: SqlExecutor,
  srcUri: string,
  canonical: string,
  opts?: OwnedWriteOptions,
): Promise<string> {
  return withCanonicalPathLock(canonical, (token) =>
    persistOwnedMasterLocked(exec, token, srcUri, canonical, opts),
  );
}

export async function removeOwnedMasterLocked(
  exec: SqlExecutor,
  token: CanonicalLockToken,
  canonical: string,
  opts: { clearReferenceCore?: (exec: SqlExecutor) => Promise<void> } = {},
): Promise<void> {
  requireLock(token, canonical);
  await inWriteTransaction(exec, async () => {
    await opts.clearReferenceCore?.(exec);
    await retireJournalForCanonicalCore(exec, canonical);
    await enqueueDeleteIntentCore(exec, canonical);
  });
  const existed = photoFileExists(canonical);
  await executeDeleteIntentLocked(exec, token, canonical);
  if (existed && !photoFileExists(canonical)) bump(canonical);
}
export function removeOwnedMaster(
  exec: SqlExecutor,
  canonical: string,
  opts?: { clearReferenceCore?: (exec: SqlExecutor) => Promise<void> },
): Promise<void> {
  return withCanonicalPathLock(canonical, (token) =>
    removeOwnedMasterLocked(exec, token, canonical, opts),
  );
}
export function enqueueRemovalIntentOwned(
  exec: SqlExecutor,
  canonical: string,
): Promise<void> {
  return withCanonicalPathLock(canonical, () =>
    inWriteTransaction(exec, () => enqueueDeleteIntentCore(exec, canonical)),
  );
}
export async function deleteStagedPhotosOwned(
  exec: SqlExecutor,
  paths: readonly string[],
): Promise<void> {
  for (const canonical of new Set(paths)) {
    await withCanonicalPathLock(canonical, async (token) => {
      await inWriteTransaction(exec, () =>
        enqueueDeleteIntentCore(exec, canonical),
      );
      await executeDeleteIntentLocked(exec, token, canonical);
    });
  }
}

export async function reconcilePhotoWritesOwned(): Promise<void> {
  const { listCanonicalSidecarPaths } = await import("./photo-storage");
  for (const canonical of listCanonicalSidecarPaths()) {
    await withCanonicalPathLock(canonical, async () => {
      await reconcilePhotoWritesForCanonical(canonical);
      // A restored interrupted-swap `.bak` changes the displayed bytes; a
      // spurious bump only costs one extra decode (display only, D-19).
      notifyPhotoBytesChanged(canonical);
    });
  }
}
