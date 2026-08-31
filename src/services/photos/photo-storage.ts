/**
 * Photo storage chokepoint (PHOTO-03 + the write half of PHOTO-05).
 *
 * This is the SINGLE place the relative <-> `file://` mapping and the
 * `contactId`-derivable filename scheme are observable, and the ONLY
 * `expo-file-system` class-API user in the phase — so a future SDK signature
 * drift is a one-file change (05-RESEARCH Open Question 1). Everything the DB
 * stores is a RELATIVE filename under `Paths.document` (`avatars/<name>.<ext>`),
 * never an absolute/cache URI (Pitfalls 1 & 3): cache is evictable and absolute
 * paths break on restore.
 *
 * =============================================================================
 * CRASH-SAFE REPLACE — READ BEFORE EDITING (review cycle-3 [HIGH atomicity]):
 *   `persistMaster` NEVER pre-deletes the destination. The installed
 *   `expo-file-system@57.0.4` Android `File.move` is delete-then-rename (it calls
 *   `dest.deleteRecursively()` before the rename), NOT an atomic replace — so
 *   overwrite-moving directly ONTO the sole master would reintroduce a window
 *   where a process kill destroys the prior master with no backup and no server
 *   to recover from (the irreversible-write doctrine this project treats as
 *   sacred). The UNCONDITIONAL shipped strategy is the recoverable `.bak` swap:
 *     1. copy the new bytes into `<rel>.tmp` FIRST (dest untouched);
 *     2. move the prior master ASIDE to `<rel>.bak` (it is renamed, never the
 *        thing being deleted);
 *     3. move `<rel>.tmp` into place at `<rel>`;
 *     4. best-effort-delete `<rel>.bak`.
 *   A kill between (2) and (3) leaves dest missing + `.bak` present -> the launch
 *   sweep restores it; a kill between (3) and (4) leaves dest present + a stale
 *   `.bak` -> the sweep deletes it. At no point is the sole copy of the prior
 *   master deleted, so the swap is crash-safe EVEN under delete-then-rename move.
 * =============================================================================
 *
 * SECURITY (T-05-02): filenames are derived from an integer `contactId` and a
 *   whitelist-constructed `col_name` only — never raw user text. The path helpers
 *   enforce that by construction (positive-int `contactId` + `isSafeColName`),
 *   AND the generic string entry points (`resolvePhotoUri`/`persistMaster`/
 *   `deletePhoto`) additionally run `assertSafeRelative` — an allowlist of
 *   `avatars/<name>.<ext>` that rejects `..`, absolute paths, backslashes, and
 *   null bytes — so a raw-string caller cannot traverse even if it bypasses the
 *   builders. Writes are confined to `Paths.document/avatars`.
 */
import { Directory, File, Paths } from "expo-file-system";
import { isSafeColName } from "@/db/col-name";
import {
  assertSafeImportStagingRelative,
  assertSafeReconcileStagingRelative,
  assertSafeRelative,
  assertSafeRestorePendingRelative,
} from "@/db/photo-relative-path";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "photo-storage";

/** The document-dir subdirectory every master + sidecar lives under. */
const AVATARS_DIR = "avatars";
const RESTORE_PENDING_DIR = `${AVATARS_DIR}/_restore_pending`;
const IMPORT_STAGING_DIR = "import-staging";
const RECONCILE_STAGING_DIR = "reconcile-staging";

/**
 * The photo write target. Each maps to a `contactId`-derivable (or fixed, for
 * self) relative filename via the single `relPathForTarget` switch.
 */
export type PhotoTargetDescriptor =
  | { kind: "contact"; contactId: number }
  | { kind: "profile" }
  | { kind: "customField"; contactId: number; colName: string };

export type RestorePendingTarget =
  | { kind: "contact"; uid: string }
  | { kind: "profile" }
  | { kind: "customField"; uid: string; colName: string };

// The `avatars/<name>.<ext>` allowlist guard (`assertSafeRelative`) lives in the
// node-pure `@/db/photo-relative-path` module so the FS chokepoint here and the
// DAO write boundary (`setContactPhoto` / `setProfilePhoto`) assert the identical
// shape from a single source. It is independent of and additive to the
// positive-int/`isSafeColName` builder throws below.

/** A positive integer contactId is required before it reaches a filename. */
function assertContactId(contactId: number): void {
  if (!Number.isInteger(contactId) || contactId <= 0) {
    throw new Error(`invalid contactId: ${JSON.stringify(contactId)}`);
  }
}

/** `avatars/contact-<id>.jpg` — the main contact photo master. */
export function contactPhotoRelPath(contactId: number): string {
  assertContactId(contactId);
  return `${AVATARS_DIR}/contact-${contactId}.jpg`;
}

/** `avatars/cv-<id>-<col>.jpg` — a custom photo-field master. */
export function customFieldPhotoRelPath(
  contactId: number,
  colName: string,
): string {
  assertContactId(contactId);
  if (!isSafeColName(colName)) {
    throw new Error(`unsafe custom-field col_name: ${JSON.stringify(colName)}`);
  }
  return `${AVATARS_DIR}/cv-${contactId}-${colName}.jpg`;
}

/**
 * `avatars/profile.jpg` — the self record is single-row and never purged, so a
 * fixed name is correct and intentional.
 */
export function profilePhotoRelPath(): string {
  return `${AVATARS_DIR}/profile.jpg`;
}

/** Map a target descriptor to its relative filename via the single switch. */
export function relPathForTarget(target: PhotoTargetDescriptor): string {
  switch (target.kind) {
    case "contact":
      return contactPhotoRelPath(target.contactId);
    case "profile":
      return profilePhotoRelPath();
    case "customField":
      return customFieldPhotoRelPath(target.contactId, target.colName);
  }
}

/** A session-scoped staging name that can never be mistaken for a canonical DB path. */
export function restorePendingRelPath(
  target: RestorePendingTarget,
  sessionToken: string,
): string {
  if (!/^[A-Za-z0-9_-]+$/.test(sessionToken)) {
    throw new Error("unsafe restore session token");
  }
  let name: string;
  switch (target.kind) {
    case "contact":
      name = `contact-${target.uid}-${sessionToken}`;
      break;
    case "profile":
      name = `profile-${sessionToken}`;
      break;
    case "customField":
      if (!isSafeColName(target.colName))
        throw new Error("unsafe custom-field col_name");
      name = `cv-${target.uid}-${target.colName}-${sessionToken}`;
      break;
  }
  const relative = `${RESTORE_PENDING_DIR}/${name}.jpg`;
  assertSafeRestorePendingRelative(relative);
  return relative;
}

/** A flat, session-scoped staging name for an evictable picker-cache photo. */
export function importStagingRelPath(
  sessionToken: string,
  rowToken: string,
): string {
  if (
    !/^[A-Za-z0-9_-]+$/.test(sessionToken) ||
    !/^[A-Za-z0-9_-]+$/.test(rowToken)
  ) {
    throw new Error("unsafe import staging token");
  }
  const relative = `${IMPORT_STAGING_DIR}/import-${sessionToken}-${rowToken}.jpg`;
  assertSafeImportStagingRelative(relative);
  return relative;
}

/** A flat durable staging name for one evictable reconciliation source photo. */
export function reconcileStagingRelPath(token: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(token)) {
    throw new Error("unsafe reconcile staging token");
  }
  const relative = `${RECONCILE_STAGING_DIR}/reconcile-${token}.jpg`;
  assertSafeReconcileStagingRelative(relative);
  return relative;
}

/** Stage into an unambiguous temporary name, then atomically rename it ready. */
export async function stageRestorePending(
  srcUri: string,
  relative: string,
): Promise<void> {
  assertSafeRestorePendingRelative(relative);
  const tmpRelative = `${relative}.stage-tmp`;
  assertSafeRestorePendingRelative(tmpRelative);
  new Directory(Paths.document, RESTORE_PENDING_DIR).create({
    intermediates: true,
    idempotent: true,
  });
  await new File(srcUri).copy(new File(Paths.document, tmpRelative), {
    overwrite: true,
  });
  await new File(Paths.document, tmpRelative).move(
    new File(Paths.document, relative),
    { overwrite: true },
  );
}

/** Move an accepted picker cache photo into durable document-dir staging. */
export async function stageImportPhoto(
  cacheUri: string,
  relative: string,
): Promise<void> {
  assertSafeImportStagingRelative(relative);
  const tmpRelative = `${relative}.stage-tmp`;
  assertSafeImportStagingRelative(tmpRelative);
  new Directory(Paths.document, IMPORT_STAGING_DIR).create({
    intermediates: true,
    idempotent: true,
  });
  await new File(cacheUri).copy(new File(Paths.document, tmpRelative), {
    overwrite: true,
  });
  await new File(Paths.document, tmpRelative).move(
    new File(Paths.document, relative),
    { overwrite: true },
  );
}

/** Move a picker cache photo into reconciliation's durable document staging. */
export async function stageReconcilePhoto(
  cacheUri: string,
  relative: string,
): Promise<void> {
  assertSafeReconcileStagingRelative(relative);
  const tmpRelative = `${relative}.stage-tmp`;
  assertSafeReconcileStagingRelative(tmpRelative);
  new Directory(Paths.document, RECONCILE_STAGING_DIR).create({
    intermediates: true,
    idempotent: true,
  });
  await new File(cacheUri).copy(new File(Paths.document, tmpRelative), {
    overwrite: true,
  });
  await new File(Paths.document, tmpRelative).move(
    new File(Paths.document, relative),
    { overwrite: true },
  );
}

/**
 * Decode portable backup bytes directly into the durable recovery namespace.
 * This intentionally does not route through an OS cache URI: once this resolves,
 * the bytes survive until the committed restore-photo journal can recover them.
 */
export async function stageRestorePendingBase64(
  base64: string,
  relative: string,
): Promise<void> {
  assertSafeRestorePendingRelative(relative);
  const tmpRelative = `${relative}.stage-tmp`;
  assertSafeRestorePendingRelative(tmpRelative);
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  new Directory(Paths.document, RESTORE_PENDING_DIR).create({
    intermediates: true,
    idempotent: true,
  });
  const tmp = new File(Paths.document, tmpRelative);
  tmp.write(bytes);
  await tmp.move(new File(Paths.document, relative), { overwrite: true });
}

export function listRestorePendingPhotos(): Array<{
  relative: string;
  isStageTmpOrphan: boolean;
}> {
  const directory = new Directory(Paths.document, RESTORE_PENDING_DIR);
  if (!directory.exists) return [];
  return directory.list().map((entry) => {
    const relative = `${RESTORE_PENDING_DIR}/${entry.name}`;
    assertSafeRestorePendingRelative(relative);
    return { relative, isStageTmpOrphan: relative.endsWith(".stage-tmp") };
  });
}

/** List every flat import staging file for launch-time orphan reconciliation. */
export function listImportStagingPhotos(): Array<{
  relative: string;
  isStageTmpOrphan: boolean;
}> {
  const directory = new Directory(Paths.document, IMPORT_STAGING_DIR);
  if (!directory.exists) return [];
  return directory.list().map((entry) => {
    const relative = `${IMPORT_STAGING_DIR}/${entry.name}`;
    assertSafeImportStagingRelative(relative);
    return { relative, isStageTmpOrphan: relative.endsWith(".stage-tmp") };
  });
}

/** List every reconciliation staging file for launch-time orphan cleanup. */
export function listReconcileStagingPhotos(): Array<{
  relative: string;
  isStageTmpOrphan: boolean;
}> {
  const directory = new Directory(Paths.document, RECONCILE_STAGING_DIR);
  if (!directory.exists) return [];
  return directory.list().map((entry) => {
    const relative = `${RECONCILE_STAGING_DIR}/${entry.name}`;
    assertSafeReconcileStagingRelative(relative);
    return { relative, isStageTmpOrphan: relative.endsWith(".stage-tmp") };
  });
}

/** Best-effort cleanup for recovery-only files. */
export function deleteRestorePending(relative: string): void {
  assertSafeRestorePendingRelative(relative);
  try {
    new File(Paths.document, relative).delete();
  } catch (error) {
    Logger.error(LOG_SCOPE, "restore pending cleanup failed", error);
  }
}

/** Best-effort cleanup for an accepted-but-discarded import session. */
export function deleteImportStaging(relative: string): void {
  assertSafeImportStagingRelative(relative);
  try {
    new File(Paths.document, relative).delete();
  } catch (error) {
    Logger.error(LOG_SCOPE, "import staging cleanup failed", error);
  }
}

/** Best-effort cleanup for completed/discarded reconciliation reviews. */
export function deleteReconcileStaging(relative: string): void {
  assertSafeReconcileStagingRelative(relative);
  try {
    new File(Paths.document, relative).delete();
  } catch (error) {
    Logger.error(LOG_SCOPE, "reconcile staging cleanup failed", error);
  }
}

/**
 * PURE rel -> `file://` composer (no native import): joins a document dir URI and
 * a validated relative filename. Guards `relative` first, so both this and the
 * `resolvePhotoUri` wrapper reject a traversal string.
 */
export function resolvePhotoUriFromDocumentUri(
  documentUri: string,
  relative: string,
): string {
  assertSafeRelative(relative);
  const base = documentUri.endsWith("/") ? documentUri : `${documentUri}/`;
  return `${base}${relative}`;
}

/**
 * Thin wrapper: resolve a stored relative filename to an absolute `file://` URI
 * against the runtime document dir. Reads `Paths.document.uri` (native) and
 * delegates to the pure composer, so node tests never load the native module.
 */
export function resolvePhotoUri(relative: string): string {
  return resolvePhotoUriFromDocumentUri(Paths.document.uri, relative);
}

/** Resolve a recovery-only staging file without widening canonical-path rules. */
export function resolveRestorePendingUri(relative: string): string {
  assertSafeRestorePendingRelative(relative);
  const base = Paths.document.uri.endsWith("/")
    ? Paths.document.uri
    : `${Paths.document.uri}/`;
  return `${base}${relative}`;
}

/** Preview-only resolver; import staging can never be passed to Avatar. */
export function resolveImportStagingUri(relative: string): string {
  assertSafeImportStagingRelative(relative);
  const base = Paths.document.uri.endsWith("/")
    ? Paths.document.uri
    : `${Paths.document.uri}/`;
  return `${base}${relative}`;
}

/** Preview-only resolver; reconciliation staging is never a canonical photo path. */
export function resolveReconcileStagingUri(relative: string): string {
  assertSafeReconcileStagingRelative(relative);
  const base = Paths.document.uri.endsWith("/")
    ? Paths.document.uri
    : `${Paths.document.uri}/`;
  return `${base}${relative}`;
}

/**
 * Persist a manipulated master into the document dir with the crash-safe `.bak`
 * swap (see the module header). Returns the RELATIVE filename (the value the DB
 * stores) — NEVER the absolute/cache URI. A failed copy OR a failed move leaves
 * the prior master intact/recoverable; orphaned `.tmp`/`.bak` are reconciled at
 * next launch.
 */
export async function persistMaster(
  srcUri: string,
  relative: string,
): Promise<string> {
  assertSafeRelative(relative);

  // Ensure avatars/ exists (idempotent — no throw if already present).
  new Directory(Paths.document, AVATARS_DIR).create({
    intermediates: true,
    idempotent: true,
  });

  const tmpRel = `${relative}.tmp`;
  const bakRel = `${relative}.bak`;

  // (1) New bytes -> .tmp FIRST. `overwrite:true` clears a stale .tmp from a
  //     prior crash. If this throws, dest is untouched (prior master survives).
  try {
    await new File(srcUri).copy(new File(Paths.document, tmpRel), {
      overwrite: true,
    });
  } catch (error) {
    // Best-effort clean the partial .tmp, then surface the failure.
    try {
      new File(Paths.document, tmpRel).delete();
    } catch {
      // A missing/partial .tmp is fine; the launch sweep also reconciles it.
    }
    throw error;
  }

  // (2) Move the prior master ASIDE to .bak (renamed, never deleted while sole
  //     copy). `overwrite:true` only clears a stale .bak. Skipped on first set.
  if (new File(Paths.document, relative).exists) {
    await new File(Paths.document, relative).move(
      new File(Paths.document, bakRel),
      { overwrite: true },
    );
  }

  // (3) Put the new bytes in place (dest no longer exists after step 2).
  await new File(Paths.document, tmpRel).move(
    new File(Paths.document, relative),
  );

  // (4) Best-effort delete the .bak (a stale one is reconciled at launch).
  try {
    new File(Paths.document, bakRel).delete();
  } catch {
    // Missing .bak (first-ever set) or delete failure is non-fatal.
  }

  return relative;
}

/**
 * Delete a stored master. Idempotent/best-effort — a missing file is fine — but
 * the raw `relative` is still guarded first (a traversal string throws).
 */
export function deletePhoto(relative: string): void {
  assertSafeRelative(relative);
  try {
    new File(Paths.document, relative).delete();
  } catch (error) {
    Logger.error(
      LOG_SCOPE,
      `deletePhoto best-effort failed for ${relative}`,
      error,
    );
  }
}

/** The only reliable completion signal for deletePhoto's best-effort contract. */
export function photoFileExists(relative: string): boolean {
  assertSafeRelative(relative);
  return new File(Paths.document, relative).exists;
}

/** A single reconciliation step over the avatars dir listing. */
export type ReconcileAction =
  | { kind: "deleteTmp"; relative: string }
  | { kind: "deleteBak"; relative: string }
  | { kind: "restoreBak"; from: string; to: string };

/**
 * PURE launch-reconciliation planner: given the `avatars/` dir listing (file
 * names), return the actions that recover from an interrupted replace.
 *   - each `*.tmp` orphan -> delete it (an incomplete write; the canonical dest,
 *     `.tmp` stripped, is authoritative and untouched);
 *   - each `*.bak` whose canonical dest EXISTS -> delete it (swap completed);
 *   - each `*.bak` whose canonical dest is MISSING -> restore it (swap was
 *     interrupted; move `.bak` back to the canonical name).
 */
export function reconcilePhotoDir(entries: string[]): ReconcileAction[] {
  const present = new Set(entries);
  const actions: ReconcileAction[] = [];
  for (const entry of entries) {
    if (entry.endsWith(".tmp")) {
      actions.push({ kind: "deleteTmp", relative: `${AVATARS_DIR}/${entry}` });
    } else if (entry.endsWith(".bak")) {
      const canonical = entry.slice(0, -".bak".length);
      if (present.has(canonical)) {
        actions.push({
          kind: "deleteBak",
          relative: `${AVATARS_DIR}/${entry}`,
        });
      } else {
        actions.push({
          kind: "restoreBak",
          from: `${AVATARS_DIR}/${entry}`,
          to: `${AVATARS_DIR}/${canonical}`,
        });
      }
    }
  }
  return actions;
}

/**
 * FS wrapper for the launch sweep: list `avatars/` (no-op if it does not exist
 * yet), plan via the pure `reconcilePhotoDir`, and apply each action
 * best-effort/idempotent. Keeps every FS call inside this one file.
 */
export async function reconcilePhotoWrites(): Promise<void> {
  const dir = new Directory(Paths.document, AVATARS_DIR);
  if (!dir.exists) return;

  const entries = dir.list().map((entry) => entry.name);
  const actions = reconcilePhotoDir(entries);

  for (const action of actions) {
    try {
      if (action.kind === "restoreBak") {
        await new File(Paths.document, action.from).move(
          new File(Paths.document, action.to),
        );
      } else {
        new File(Paths.document, action.relative).delete();
      }
    } catch (error) {
      Logger.error(
        LOG_SCOPE,
        `reconcile action failed: ${JSON.stringify(action)}`,
        error,
      );
    }
  }
}
