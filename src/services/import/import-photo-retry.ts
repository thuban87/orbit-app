/** Photo-only recovery for contacts whose import already committed (ADR-065). */
import { PHOTO_OUTSTANDING } from "@/db/import-session-dao";
import { enqueueDeleteIntentCore } from "@/db/restore-photo-journal-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import {
  type ImportedPhotoFs,
  importedPhotoFs,
} from "@/services/import/import-photo";
import {
  canonicalGeneration,
  executeDeleteIntentLocked,
  PhotoWriteUnauthorizedError,
  persistOwnedMasterLocked,
  withCanonicalPathLock,
} from "@/services/photos/owned-master";
import {
  deletePhoto,
  listImportStagingPhotos,
  persistMaster,
  photoFileExists,
} from "@/services/photos/photo-storage";

export interface RetryPhotoFs extends ImportedPhotoFs {
  stagingExists?: (relative: string) => boolean;
  deleteCanonical?: (relative: string) => void;
  canonicalExists?: (relative: string) => boolean;
}

interface RetryRow {
  id: number;
  contact_id: number;
  photo_rel_path: string;
  contact_uid: string | null;
  contact_photo: string | null;
}

async function readRetryRow(
  exec: SqlExecutor,
  rowId: number,
): Promise<RetryRow | null> {
  return exec.getFirstAsync<RetryRow>(
    `SELECT r.id, r.contact_id, r.photo_rel_path,
            c.uid AS contact_uid, c.photo AS contact_photo
       FROM import_session_rows r LEFT JOIN contacts c ON c.id = r.contact_id
      WHERE r.id = ? AND ${PHOTO_OUTSTANDING}`,
    [rowId],
  );
}

async function retireMatching(
  exec: SqlExecutor,
  row: RetryRow,
  now: string,
): Promise<boolean> {
  return inWriteTransaction(exec, async () => {
    const retired = await exec.runAsync(
      `UPDATE import_session_rows SET photo_rel_path = NULL, modified_at = ?
        WHERE id = ? AND (contact_id = ? OR contact_id IS NULL)
          AND photo_rel_path = ? AND row_status = 'imported'`,
      [now, row.id, row.contact_id, row.photo_rel_path],
    );
    return retired.changes === 1;
  });
}

async function removeRetiredStaging(
  fs: RetryPhotoFs,
  row: RetryRow,
  retired: boolean,
): Promise<void> {
  if (retired) await fs.deleteImportStaging(row.photo_rel_path);
}

/** Never invokes the contact creator. All canonical work is serialized by path. */
export async function retryImportedPhoto(
  exec: SqlExecutor,
  fs: RetryPhotoFs,
  rowId: number,
  now: string,
): Promise<boolean> {
  const row = await readRetryRow(exec, rowId);
  if (!row) return false;
  const exists =
    fs.stagingExists ??
    ((relative: string) =>
      listImportStagingPhotos().some((item) => item.relative === relative));
  if (
    !row.contact_uid ||
    row.contact_photo !== null ||
    !exists(row.photo_rel_path)
  ) {
    await removeRetiredStaging(fs, row, await retireMatching(exec, row, now));
    return false;
  }

  const canonical = await fs.contactPhotoRelPath(row.contact_id);
  const generation = canonicalGeneration(canonical);
  let resized: string;
  try {
    resized = await fs.resizeToMaster(
      await fs.resolveStagedPhotoPath(row.photo_rel_path),
    );
  } catch {
    return false; // Keep the durable staging reference for a later Retry.
  }

  let published = false;
  await withCanonicalPathLock(canonical, async (token) => {
    const eligible = async () => {
      const current = await readRetryRow(exec, rowId);
      return (
        current?.contact_uid === row.contact_uid &&
        current?.contact_id === row.contact_id &&
        current?.photo_rel_path === row.photo_rel_path &&
        current?.contact_photo === null &&
        canonicalGeneration(canonical) === generation
      );
    };
    try {
      await persistOwnedMasterLocked(exec, token, resized, canonical, {
        authorize: eligible,
        persist: fs.persistMaster,
      });
    } catch (error) {
      if (!(error instanceof PhotoWriteUnauthorizedError)) throw error;
      await removeRetiredStaging(fs, row, await retireMatching(exec, row, now));
      return;
    }

    try {
      await inWriteTransaction(exec, async () => {
        const contact = await exec.runAsync(
          `UPDATE contacts SET photo = ?, modified_at = ?
            WHERE id = ? AND uid = ? AND photo IS NULL`,
          [canonical, now, row.contact_id, row.contact_uid],
        );
        if (contact.changes !== 1)
          throw new PhotoWriteUnauthorizedError("contact changed");
        const retired = await exec.runAsync(
          `UPDATE import_session_rows SET photo_rel_path = NULL, photo_failed = 0, modified_at = ?
            WHERE id = ? AND contact_id = ? AND photo_rel_path = ? AND row_status = 'imported'`,
          [now, row.id, row.contact_id, row.photo_rel_path],
        );
        if (retired.changes !== 1)
          throw new PhotoWriteUnauthorizedError("import row changed");
      });
      published = true;
    } catch (error) {
      // A purge or competing row transition may have committed during the file write.
      await inWriteTransaction(exec, () =>
        enqueueDeleteIntentCore(exec, canonical),
      );
      await executeDeleteIntentLocked(
        exec,
        token,
        canonical,
        fs.deleteCanonical ?? deletePhoto,
        fs.canonicalExists ?? photoFileExists,
      );
      if (!(error instanceof PhotoWriteUnauthorizedError)) throw error;
      await removeRetiredStaging(fs, row, await retireMatching(exec, row, now));
    }
  });
  if (published) await fs.deleteImportStaging(row.photo_rel_path);
  return published;
}

/** An explicit user action retires all remaining imported photo work. */
export async function skipRemainingPhotos(
  exec: SqlExecutor,
  fs: Pick<RetryPhotoFs, "deleteImportStaging">,
  sessionId: number,
  now: string,
): Promise<number> {
  const paths = await inWriteTransaction(exec, async () => {
    const rows = await exec.getAllAsync<{ photo_rel_path: string }>(
      `SELECT r.photo_rel_path FROM import_session_rows r
        WHERE r.session_id = ? AND ${PHOTO_OUTSTANDING}`,
      [sessionId],
    );
    await exec.runAsync(
      `UPDATE import_session_rows AS r SET photo_rel_path = NULL, modified_at = ?
        WHERE r.session_id = ? AND ${PHOTO_OUTSTANDING}`,
      [now, sessionId],
    );
    return rows.map((row) => row.photo_rel_path);
  });
  for (const path of paths) await fs.deleteImportStaging(path);
  return paths.length;
}

/** The lock is already held by retryImportedPhoto; use the raw file primitive. */
export const retryPhotoFs: RetryPhotoFs = { ...importedPhotoFs, persistMaster };
