import type { BackupManifest } from "@/backup/types";
import type { BackupPreview } from "@/services/backup/backup-service";

export type RestorePreviewRoute = {
  readonly token: string;
  readonly preview: BackupPreview;
};

type RestoreCacheEntry = {
  readonly manifest: BackupManifest;
  readonly preview: BackupPreview;
};

export type RestorePreviewFailureReason =
  | "wrong-passphrase"
  | "damaged-or-incomplete"
  | "newer-app";

export type RestorePreviewFailure = {
  readonly step: "passphrase" | "selection";
  readonly message: string;
  readonly action: "Try passphrase again" | "Choose another file";
};

export function createRestorePreviewCache() {
  const entries = new Map<string, RestoreCacheEntry>();
  let nextToken = 0;

  return {
    store(entry: RestoreCacheEntry): RestorePreviewRoute {
      nextToken += 1;
      const token = `restore-preview-${Date.now()}-${nextToken}`;
      entries.set(token, entry);
      return { token, preview: entry.preview };
    },
    read(token: string): RestoreCacheEntry | null {
      return entries.get(token) ?? null;
    },
    discard(token: string): void {
      entries.delete(token);
    },
  };
}

/** Deliberately process-local: a cold launch must re-select and re-validate. */
export const restorePreviewCache = createRestorePreviewCache();

export function isEncryptedBackupEnvelope(contents: string): boolean {
  try {
    const value: unknown = JSON.parse(contents);
    return Boolean(
      value
      && typeof value === "object"
      && (value as Record<string, unknown>).encrypted === true,
    );
  } catch {
    return false;
  }
}

export function restorePreviewFailure(reason: RestorePreviewFailureReason): RestorePreviewFailure {
  if (reason === "wrong-passphrase") {
    return {
      step: "passphrase",
      message: "That passphrase doesn't unlock this backup. Your local data hasn't changed.",
      action: "Try passphrase again",
    };
  }
  if (reason === "newer-app") {
    return {
      step: "selection",
      message: "This backup was made by a newer version of Orbit. Update Orbit, then try again. Your local data hasn't changed.",
      action: "Choose another file",
    };
  }
  return {
    step: "selection",
    message: "This backup is damaged or incomplete. Your local data hasn't changed.",
    action: "Choose another file",
  };
}
