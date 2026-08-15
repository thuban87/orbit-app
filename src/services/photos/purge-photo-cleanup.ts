/**
 * Post-commit photo purge cleanup (the purge half of PHOTO-05) — the
 * `onPurgeExtensions` adapter that deletes a purged contact's photo files.
 *
 * =============================================================================
 * WHY FILENAMES ARE REBUILT FROM contactId — READ BEFORE EDITING:
 *   Phase 4's `purgeContact` fires `onPurgeExtensions(contactId)` POST-COMMIT:
 *   by the time this adapter runs, the `contacts` and `contact_custom_values`
 *   rows are ALREADY deleted, so the stored photo filename CANNOT be read from
 *   the DB. Every filename is therefore rederived from `contactId` alone via the
 *   `photo-storage` derivable scheme — the main `avatars/contact-<id>.jpg`, plus
 *   one `avatars/cv-<id>-<col>.jpg` per surviving `type='photo'` def.
 *
 * WHY QUARANTINED DEFS ARE INCLUDED (PHOTO-05):
 *   `custom_field_defs` is a GLOBAL table that SURVIVES a purge (it is not owned
 *   by a contact), so the surviving photo defs enumerate the cv- files to delete.
 *   The read is `listDefs(exec, { includeQuarantined: true })`: a contact purged
 *   while a photo custom field is quarantined-but-not-yet-expired still has that
 *   field's physical column AND its cv- file on disk. Excluding quarantined defs
 *   would LEAK that file — "purge really means gone" (PHOTO-05) requires it be
 *   deleted, so the read MUST include quarantined defs.
 *
 * BEST-EFFORT / IDEMPOTENT (T-04-16, T-05-09):
 *   Runs post-commit, never inside the transaction/mutex. Each delete is
 *   idempotent (a missing file is fine — `deletePhoto` swallows its own FS error)
 *   and internally error-resilient: a throw from any single path build or delete
 *   is logged and does not abort the remaining deletes. The outer purge hook
 *   already try/catch-logs, but this stays resilient on its own.
 *
 * SECURITY (T-05-02): every deleted path is built from the integer `contactId`
 *   and a whitelist-constructed `col_name` (via the `photo-storage` builders,
 *   which enforce positive-int id + `isSafeColName`) — no raw user text, no
 *   traversal. Node-pure control flow: takes `exec: SqlExecutor`.
 */
import { listDefs } from "@/db/field-defs-dao";
import type { SqlExecutor } from "@/db/types";
import {
  contactPhotoRelPath,
  customFieldPhotoRelPath,
  deletePhoto,
} from "@/services/photos/photo-storage";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "purge-photo-cleanup";

/** Delete one relative path, logging (never throwing) on any failure. */
function safeDelete(relative: string): void {
  try {
    deletePhoto(relative);
  } catch (err) {
    Logger.error(LOG_SCOPE, `best-effort delete failed for ${relative}`, err);
  }
}

/**
 * Build the `PurgeOptions.onPurgeExtensions` adapter for the photo subsystem.
 * The returned function, given a purged `contactId`, deletes that contact's main
 * photo file and every surviving custom photo-field file, derived from
 * `contactId` alone (post-commit; the rows are already gone). Idempotent and
 * best-effort — a missing file or a single failure never aborts the rest.
 */
export function buildPhotoPurgeCleanup(
  exec: SqlExecutor,
): (contactId: number) => Promise<void> {
  return async (contactId: number): Promise<void> => {
    // (1) The main contact photo — derived from contactId.
    safeDelete(contactPhotoRelPath(contactId));

    // (2) One cv- file per SURVIVING photo def. includeQuarantined:true so a
    //     purge during a photo field's quarantine window never leaks its file.
    let defs;
    try {
      defs = await listDefs(exec, { includeQuarantined: true });
    } catch (err) {
      Logger.error(
        LOG_SCOPE,
        `failed to read custom_field_defs for contact id=${contactId}`,
        err,
      );
      return;
    }

    for (const def of defs) {
      if (def.type !== "photo") {
        continue;
      }
      try {
        safeDelete(customFieldPhotoRelPath(contactId, def.col_name));
      } catch (err) {
        // customFieldPhotoRelPath itself throws only on a malformed col_name —
        // log and keep going so one bad def cannot leak the rest.
        Logger.error(
          LOG_SCOPE,
          `failed to derive cv- path for def col_name=${def.col_name}`,
          err,
        );
      }
    }
  };
}
