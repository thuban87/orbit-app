/**
 * Best-effort post-commit photo import.
 *
 * A contact and its import row have already committed before this module runs.
 * Keeping image decoding, file persistence, and the later photo-column update
 * here means a corrupt source photo can never roll back the imported contact.
 *
 * The staged phone photo (usually a small thumbnail) becomes the contact's
 * master through the shared `encodeMaster` (D-10/D-13): centre-squared, stored
 * at its own size up to 1024 px as lossy WebP, never upscaled or distorted
 * (D-22), under the unchanged `avatars/contact-<id>.jpg` name (D-21). Import
 * retry inherits this through `retryPhotoFs`.
 */
import { setContactPhoto } from "@/db/contacts-dao";
import { retireRowStagedPhoto } from "@/db/import-session-dao";
import type { SqlExecutor } from "@/db/types";
import { discardDerivative } from "@/services/photos/derivative-cache";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "import-photo";

export interface ImportedPhotoFs {
  resolveStagedPhotoPath: (relative: string) => string | Promise<string>;
  contactPhotoRelPath: (contactId: number) => string | Promise<string>;
  resizeToMaster: (stagedPhotoPath: string) => Promise<string>;
  persistMaster: (sourceUri: string, relative: string) => Promise<string>;
  deleteImportStaging: (relative: string) => void | Promise<void>;
  discardDerivative: (uri: string) => boolean;
  setContactPhoto: (
    exec: SqlExecutor,
    contactId: number,
    relative: string,
    now: string,
  ) => Promise<void>;
}

async function resizeToMaster(stagedPhotoPath: string): Promise<string> {
  const { encodeMaster } = await import("@/services/photos/master-encode");
  return encodeMaster(stagedPhotoPath);
}

async function resolveStagedPhotoPath(relative: string): Promise<string> {
  const { resolveImportStagingUri } = await import(
    "@/services/photos/photo-storage"
  );
  return resolveImportStagingUri(relative);
}

async function photoRelativePath(contactId: number): Promise<string> {
  const { contactPhotoRelPath } = await import(
    "@/services/photos/photo-storage"
  );
  return contactPhotoRelPath(contactId);
}

async function persistPhotoMaster(
  sourceUri: string,
  relative: string,
): Promise<string> {
  const { persistOwnedMaster } = await import("@/services/photos/owned-master");
  const { getExecutor } = await import("@/db/database");
  return persistOwnedMaster(getExecutor(), sourceUri, relative);
}

async function deleteStagedPhoto(relative: string): Promise<void> {
  const { deleteImportStaging } = await import(
    "@/services/photos/photo-storage"
  );
  deleteImportStaging(relative);
}

/** The production dependencies; callers may inject this boundary for node tests. */
export const importedPhotoFs: ImportedPhotoFs = {
  resolveStagedPhotoPath,
  contactPhotoRelPath: photoRelativePath,
  resizeToMaster,
  persistMaster: persistPhotoMaster,
  deleteImportStaging: deleteStagedPhoto,
  discardDerivative,
  setContactPhoto,
};

export type PersistImportedPhotoResult =
  | { ok: true; skipped?: true }
  | { ok: false };

/**
 * Turn a durable staged import photo into the contact's Orbit-owned master.
 *
 * This function must only be called after `importContactRecord` has resolved
 * the import row. It deliberately catches every image/file/DAO error so its
 * caller can flag `photo_failed` while retaining the imported contact.
 */
export async function persistImportedPhotoPostCommit(
  exec: SqlExecutor,
  fs: ImportedPhotoFs,
  params: {
    contactId: number;
    rowId: number;
    stagedPhotoPath: string | null;
    now: string;
  },
): Promise<PersistImportedPhotoResult> {
  if (params.stagedPhotoPath === null || params.stagedPhotoPath === "") {
    return { ok: true, skipped: true };
  }

  try {
    const relative = await fs.contactPhotoRelPath(params.contactId);
    const stagedUri = await fs.resolveStagedPhotoPath(params.stagedPhotoPath);
    const resizedUri = await fs.resizeToMaster(stagedUri);
    try {
      await fs.persistMaster(resizedUri, relative);
    } finally {
      try {
        fs.discardDerivative(resizedUri);
      } catch {
        Logger.warn(LOG_SCOPE, "import derivative cleanup failed");
      }
    }
    await fs.setContactPhoto(exec, params.contactId, relative, params.now);
    await retireRowStagedPhoto(exec, params.rowId, params.now);
    try {
      await fs.deleteImportStaging(params.stagedPhotoPath);
    } catch (error) {
      Logger.error(
        LOG_SCOPE,
        `could not delete imported staging photo for row ${params.rowId}`,
        error,
      );
    }
    return { ok: true };
  } catch (error) {
    Logger.error(
      LOG_SCOPE,
      `post-commit photo import failed for contact ${params.contactId}`,
      error,
    );
    return { ok: false };
  }
}
