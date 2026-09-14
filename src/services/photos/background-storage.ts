import { Directory, File, Paths } from "expo-file-system";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "background-storage";
const BACKGROUND_DIR = "profile-backgrounds";
const BACKGROUND_RESTORE_PENDING_DIR = `${BACKGROUND_DIR}/_restore_pending`;
const SAFE_BACKGROUND_UID = /^[A-Za-z0-9_-]{1,256}$/;
const SAFE_BACKGROUND_RELATIVE = /^profile-backgrounds\/[A-Za-z0-9_-]+\.jpg$/;
const SAFE_BACKGROUND_SIDECAR =
  /^profile-backgrounds\/[A-Za-z0-9_-]+\.jpg\.(?:tmp|bak)$/;
const SAFE_BACKGROUND_RESTORE_PENDING =
  /^profile-backgrounds\/_restore_pending\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.jpg$/;

const writeTails = new Map<string, Promise<void>>();

export type BackgroundReconcileAction =
  | { kind: "deleteTmp"; relative: string }
  | { kind: "deleteBak"; relative: string }
  | { kind: "restoreBak"; from: string; to: string };

function assertBackgroundRelative(relative: string): void {
  if (
    typeof relative !== "string" ||
    relative.includes("\0") ||
    !SAFE_BACKGROUND_RELATIVE.test(relative)
  ) {
    throw new Error(
      `unsafe profile background relative path: ${JSON.stringify(relative)}`,
    );
  }
}

function assertBackgroundSidecar(relative: string): void {
  if (
    typeof relative !== "string" ||
    relative.includes("\0") ||
    !SAFE_BACKGROUND_SIDECAR.test(relative)
  ) {
    throw new Error(
      `unsafe profile background sidecar: ${JSON.stringify(relative)}`,
    );
  }
}

/** One durable, UID-derived derivative path per background template. */
export function backgroundDerivativeRelPath(templateUid: string): string {
  if (
    typeof templateUid !== "string" ||
    !SAFE_BACKGROUND_UID.test(templateUid)
  ) {
    throw new Error("Profile background UID must be a bounded safe identifier");
  }
  return `${BACKGROUND_DIR}/${templateUid}.jpg`;
}

/** Native-free helper for tests and render callers that already own a document URI. */
export function resolveBackgroundUriFromDocumentUri(
  documentUri: string,
  relative: string,
): string {
  assertBackgroundRelative(relative);
  return `${documentUri.endsWith("/") ? documentUri : `${documentUri}/`}${relative}`;
}

export function resolveBackgroundUri(relative: string): string {
  return resolveBackgroundUriFromDocumentUri(Paths.document.uri, relative);
}

function assertBackgroundRestorePendingRelative(relative: string): void {
  if (
    typeof relative !== "string" ||
    relative.includes("\0") ||
    !SAFE_BACKGROUND_RESTORE_PENDING.test(relative)
  ) {
    throw new Error("unsafe profile background restore-pending path");
  }
}

/** Durable uid-keyed evidence for a post-commit background persist. */
export function backgroundRestorePendingRelPath(
  templateUid: string,
  sessionToken: string,
): string {
  backgroundDerivativeRelPath(templateUid);
  backgroundDerivativeRelPath(sessionToken);
  return `${BACKGROUND_RESTORE_PENDING_DIR}/${templateUid}/${sessionToken}.jpg`;
}

export function resolveBackgroundRestorePendingUri(relative: string): string {
  assertBackgroundRestorePendingRelative(relative);
  return `${Paths.document.uri.endsWith("/") ? Paths.document.uri : `${Paths.document.uri}/`}${relative}`;
}

export async function stageBackgroundRestorePendingBase64(
  base64: string,
  templateUid: string,
  sessionToken: string,
): Promise<string> {
  const relative = backgroundRestorePendingRelPath(templateUid, sessionToken);
  new Directory(
    Paths.document,
    BACKGROUND_RESTORE_PENDING_DIR,
    templateUid,
  ).create({
    intermediates: true,
    idempotent: true,
  });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  new File(Paths.document, relative).write(bytes);
  return relative;
}

export function listBackgroundRestorePendingEntries(): Array<{
  relative: string;
}> {
  const directory = new Directory(
    Paths.document,
    BACKGROUND_RESTORE_PENDING_DIR,
  );
  if (!directory.exists) return [];
  const pending: Array<{ relative: string }> = [];
  for (const templateDirectory of directory.list()) {
    if (
      !(templateDirectory instanceof Directory) ||
      !/^[A-Za-z0-9_-]+$/.test(templateDirectory.name)
    ) {
      continue;
    }
    for (const entry of templateDirectory.list()) {
      if (entry instanceof File && /^[A-Za-z0-9_-]+\.jpg$/.test(entry.name)) {
        pending.push({
          relative: `${BACKGROUND_RESTORE_PENDING_DIR}/${templateDirectory.name}/${entry.name}`,
        });
      }
    }
  }
  return pending.sort((left, right) =>
    left.relative.localeCompare(right.relative),
  );
}

export function deleteBackgroundRestorePending(relative: string): void {
  assertBackgroundRestorePendingRelative(relative);
  new File(Paths.document, relative).delete();
}

function enqueueWrite<T>(
  relative: string,
  write: () => Promise<T>,
): Promise<T> {
  const previous = writeTails.get(relative) ?? Promise.resolve();
  const queued = previous.catch(() => undefined).then(write);
  const tail = queued.then(
    () => undefined,
    () => undefined,
  );
  writeTails.set(relative, tail);
  void tail.finally(() => {
    if (writeTails.get(relative) === tail) writeTails.delete(relative);
  });
  return queued;
}

/**
 * Persist a prepared derivative using copy-to-tmp → old-to-bak → tmp-to-dest.
 * The previous canonical image is never pre-deleted, and same-template writes
 * serialize so rapid picker confirmations cannot interleave their sidecars.
 */
export function persistBackgroundDerivative(
  sourceUri: string,
  relative: string,
): Promise<string> {
  assertBackgroundRelative(relative);
  return enqueueWrite(relative, async () => {
    new Directory(Paths.document, BACKGROUND_DIR).create({
      intermediates: true,
      idempotent: true,
    });
    const tmp = `${relative}.tmp`;
    const bak = `${relative}.bak`;
    assertBackgroundSidecar(tmp);
    assertBackgroundSidecar(bak);
    try {
      await new File(sourceUri).copy(new File(Paths.document, tmp), {
        overwrite: true,
      });
    } catch (error) {
      try {
        new File(Paths.document, tmp).delete();
      } catch {
        // Launch reconciliation will remove a partial sidecar if it survived.
      }
      throw error;
    }
    if (new File(Paths.document, relative).exists) {
      await new File(Paths.document, relative).move(
        new File(Paths.document, bak),
        { overwrite: true },
      );
    }
    await new File(Paths.document, tmp).move(
      new File(Paths.document, relative),
    );
    try {
      new File(Paths.document, bak).delete();
    } catch {
      // A stale backup remains recoverable and is handled at the next launch.
    }
    return relative;
  });
}

export function deleteBackgroundDerivative(relative: string): void {
  assertBackgroundRelative(relative);
  try {
    new File(Paths.document, relative).delete();
  } catch (error) {
    Logger.error(LOG_SCOPE, `background delete failed for ${relative}`, error);
  }
}

/** Deterministically recovers interrupted tmp/bak replacement states. */
export function reconcileBackgroundDir(
  entries: string[],
): BackgroundReconcileAction[] {
  const present = new Set(entries);
  const actions: BackgroundReconcileAction[] = [];
  for (const entry of entries) {
    if (/^[A-Za-z0-9_-]+\.jpg\.tmp$/.test(entry)) {
      actions.push({
        kind: "deleteTmp",
        relative: `${BACKGROUND_DIR}/${entry}`,
      });
    } else if (/^[A-Za-z0-9_-]+\.jpg\.bak$/.test(entry)) {
      const canonical = entry.slice(0, -".bak".length);
      if (present.has(canonical)) {
        actions.push({
          kind: "deleteBak",
          relative: `${BACKGROUND_DIR}/${entry}`,
        });
      } else {
        actions.push({
          kind: "restoreBak",
          from: `${BACKGROUND_DIR}/${entry}`,
          to: `${BACKGROUND_DIR}/${canonical}`,
        });
      }
    }
  }
  return actions;
}

export function listBackgroundStorageEntries(): string[] {
  const directory = new Directory(Paths.document, BACKGROUND_DIR);
  if (!directory.exists) return [];
  return directory.list().map((entry) => entry.name);
}

export async function applyBackgroundReconcileAction(
  action: BackgroundReconcileAction,
): Promise<void> {
  try {
    if (action.kind === "restoreBak") {
      assertBackgroundSidecar(action.from);
      assertBackgroundRelative(action.to);
      await new File(Paths.document, action.from).move(
        new File(Paths.document, action.to),
      );
    } else {
      assertBackgroundSidecar(action.relative);
      new File(Paths.document, action.relative).delete();
    }
  } catch (error) {
    Logger.error(
      LOG_SCOPE,
      `background reconciliation failed: ${JSON.stringify(action)}`,
      error,
    );
  }
}
