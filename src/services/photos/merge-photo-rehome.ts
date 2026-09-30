/** Own photo bytes through a merge while preserving the identity-derived filename policy. */
import {
  type MergePhotoTransfer,
  type MergeResolutions,
  mergeContacts,
  normalizeMergeResolutions,
} from "@/db/merge-dao";
import {
  contactPhotoRelPath,
  customFieldPhotoRelPath,
  restorePendingRelPath,
} from "@/db/photo-relative-path";
import type { RestorePhotoJournalEntry } from "@/db/restore-photo-journal-dao";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
import { Logger } from "@/utils/logger";
import {
  canonicalGeneration,
  executeDeleteIntentLocked,
  executeDeleteIntentOwned,
  finalizeJournalEntryLocked,
  settleCanonicalLocked,
  withCanonicalPathLock,
  withCanonicalPathLocks,
} from "./owned-master";
import {
  photoFileExists,
  resolvePhotoUri,
  stageRestorePending,
} from "./photo-storage";
import { beginStagingSession, endStagingSession } from "./staging-sessions";

type Contact = { id: number; uid: string; photo: string | null };
type Def = { id: number; uid: string; col_name: string; type: string };
type Value = { uid: string; field_def_id: number; value: string | null };
export interface MergePhotoInput {
  survivorId: number;
  absorbedId: number;
  resolutions?: MergeResolutions;
  now: string;
}

export async function mergeContactsWithPhotoOwnership(
  exec: SqlExecutor,
  input: MergePhotoInput,
): Promise<{ recoveryPending: boolean }> {
  const resolutions = normalizeMergeResolutions(input.resolutions);
  const [survivor, absorbed, defs] = await Promise.all([
    exec.getFirstAsync<Contact>(
      "SELECT id, uid, photo FROM contacts WHERE id = ? AND archived_at IS NULL",
      [input.survivorId],
    ),
    exec.getFirstAsync<Contact>(
      "SELECT id, uid, photo FROM contacts WHERE id = ? AND archived_at IS NULL",
      [input.absorbedId],
    ),
    exec.getAllAsync<Def>(
      "SELECT id, uid, col_name, type FROM custom_field_defs",
    ),
  ]);
  if (!survivor || !absorbed || survivor.id === absorbed.id)
    throw new Error("merge contacts are unavailable");
  const [ownValues, otherValues] = await Promise.all([
    exec.getAllAsync<Value>(
      "SELECT uid, field_def_id, value FROM custom_field_values WHERE contact_id = ?",
      [survivor.id],
    ),
    exec.getAllAsync<Value>(
      "SELECT uid, field_def_id, value FROM custom_field_values WHERE contact_id = ?",
      [absorbed.id],
    ),
  ]);
  const ownById = new Map(ownValues.map((row) => [row.field_def_id, row]));
  const photoWanted =
    resolutions.photo !== "keep-survivor" &&
    !!absorbed.photo &&
    (resolutions.photo?.choice === "absorbed" || !survivor.photo);
  const selected = defs
    .filter((def) => def.type === "photo")
    .flatMap((def) => {
      const other = otherValues.find((row) => row.field_def_id === def.id);
      const own = ownById.get(def.id);
      const chosen = resolutions.customFields?.[def.id];
      return other?.value &&
        (chosen === "absorbed" || (chosen == null && !own?.value?.trim()))
        ? [{ def, other, source: other.value }]
        : [];
    });
  const absorbedDerived = [
    contactPhotoRelPath(absorbed.id),
    ...defs.map((def) => customFieldPhotoRelPath(absorbed.id, def.col_name)),
  ];
  const paths = [
    ...absorbedDerived,
    contactPhotoRelPath(survivor.id),
    ...(absorbed.photo ? [absorbed.photo] : []),
    ...(survivor.photo ? [survivor.photo] : []),
    ...selected.flatMap(({ def, source }) => [
      source,
      customFieldPhotoRelPath(survivor.id, def.col_name),
    ]),
  ];
  const session = newUid().replace(/[^A-Za-z0-9_-]/g, "_");
  let committed = false;
  let recoveryPending = false;
  const afterRelease: string[] = [];
  await withCanonicalPathLocks(paths, async (token) => {
    beginStagingSession(session);
    try {
      // Settle old restores before reading their canonical bytes. Every path here is held.
      for (const path of new Set(paths))
        await settleCanonicalLocked(exec, token, path);
      const transfers: MergePhotoTransfer[] = [];
      const stage = async (
        source: string,
        destination: string,
        target:
          | { kind: "contact"; contactUid: string }
          | {
              kind: "customField";
              contactUid: string;
              fieldDefUid: string;
              valueUid: string;
              colName: string;
            },
        extra: Partial<MergePhotoTransfer>,
      ) => {
        if (!photoFileExists(source)) return;
        const relativePath = restorePendingRelPath(
          target.kind === "contact"
            ? { kind: "contact", uid: target.contactUid }
            : {
                kind: "customField",
                uid: target.contactUid,
                colName: target.colName,
              },
          session,
        );
        await stageRestorePending(resolvePhotoUri(source), relativePath);
        const journal: RestorePhotoJournalEntry = {
          relativePath,
          action: "finalize",
          targetKind: target.kind,
          contactUid: target.contactUid,
          valueUid: target.kind === "customField" ? target.valueUid : null,
          fieldDefUid:
            target.kind === "customField" ? target.fieldDefUid : null,
          canonicalRelativePath: destination,
          createdAt: input.now,
        };
        transfers.push({
          kind: target.kind,
          source,
          destination,
          absorbedUid: absorbed.uid,
          sourceGeneration: canonicalGeneration(source),
          journal,
          ...extra,
        });
      };
      if (photoWanted && absorbed.photo)
        await stage(
          absorbed.photo,
          contactPhotoRelPath(survivor.id),
          { kind: "contact", contactUid: survivor.uid },
          {
            adoption:
              !survivor.photo &&
              resolutions.photo !== "keep-survivor" &&
              resolutions.photo?.choice !== "absorbed",
          },
        );
      for (const { def, other, source } of selected) {
        const own = ownById.get(def.id);
        await stage(
          source,
          customFieldPhotoRelPath(survivor.id, def.col_name),
          {
            kind: "customField",
            contactUid: survivor.uid,
            fieldDefUid: def.uid,
            valueUid: own?.uid ?? other.uid,
            colName: def.col_name,
          },
          { fieldDefId: def.id, fieldDefUid: def.uid, valueUid: other.uid },
        );
      }
      const result = await mergeContacts(exec, {
        ...input,
        resolutions,
        photoTransfers: transfers,
        generationOf: canonicalGeneration,
        expectedAbsorbedUid: absorbed.uid,
        expectedAbsorbedPhoto: absorbed.photo,
      });
      committed = true;
      for (const entry of result.finalizeEntries) {
        try {
          await finalizeJournalEntryLocked(exec, token, entry);
        } catch {
          recoveryPending = true;
          Logger.error(
            "merge-photo-rehome",
            "post-commit photo finalize pending",
          );
        }
      }
      for (const path of result.deletePaths) {
        if (!token.paths.has(path)) {
          afterRelease.push(path);
          continue;
        }
        try {
          await executeDeleteIntentLocked(exec, token, path);
        } catch {
          recoveryPending = true;
          Logger.error(
            "merge-photo-rehome",
            "post-commit photo deletion pending",
          );
        }
      }
    } finally {
      endStagingSession(session);
    }
  });
  for (const path of afterRelease) {
    try {
      await executeDeleteIntentOwned(exec, path);
    } catch {
      recoveryPending = true;
      Logger.error("merge-photo-rehome", "post-commit photo deletion pending");
    }
  }
  if (!committed) throw new Error("merge did not commit");
  return { recoveryPending };
}

/**
 * Copy a canonical photo's CURRENT local bytes into restore staging (38.6
 * D-26). A Replace-all restore re-assigns contact ids, so a backup row whose
 * photo was skipped (D-24) cannot keep its old id-derived path: its local bytes
 * are staged like backup bytes and land at the row's new canonical through the
 * same journal finalize. Resolves false (nothing staged) only when the file is
 * genuinely gone; a failed copy of a file that exists rejects.
 *
 * Reads the canonical like merge re-homing does (review WR2-02): under its path
 * lock, so an owned write mid-swap (canonical moved aside to `.bak`) finishes
 * first, and after settling its journal, so an unfinished finalize (newer bytes
 * still in `_restore_pending`) lands before the copy instead of being dropped.
 * Called before the restore transaction opens (lock order: path, then DB).
 */
export function stageLocalPhotoForRestore(
  exec: SqlExecutor,
  canonicalRelativePath: string,
  pendingRelativePath: string,
): Promise<boolean> {
  return withCanonicalPathLock(canonicalRelativePath, async (token) => {
    await settleCanonicalLocked(exec, token, canonicalRelativePath);
    if (!photoFileExists(canonicalRelativePath)) return false;
    await stageRestorePending(
      resolvePhotoUri(canonicalRelativePath),
      pendingRelativePath,
    );
    return true;
  });
}
