/**
 * System-contact acquisition orchestration.
 *
 * The picker grant is deliberately consumed once here: its cache photo is
 * copied into document-dir staging before the durable session snapshot is
 * inserted. Screens subsequently read the session and never re-query Android.
 */

import type { CreateContactFullInput } from "@/db/contacts-dao";
import {
  acceptImportSessionWithRows,
  completeSession,
  type ImportSessionMode,
  markRowPhotoFailed,
} from "@/db/import-session-dao";
import { listSessionRows } from "@/db/import-session-read";
import {
  type ExternalContactLinkInput,
  importContactRecord,
} from "@/db/imported-contact-dao";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
import { mapPickedContact } from "@/logic/picked-contact-map";
import {
  importedPhotoFs,
  persistImportedPhotoPostCommit,
} from "@/services/import/import-photo";
import {
  importStagingRelPath,
  stageImportPhoto,
} from "@/services/photos/photo-storage";
import { Logger } from "@/utils/logger";
import type { PickedContact } from "../../../modules/orbit-contact-picker";

export interface AcceptPickedContactsOptions {
  mode: ImportSessionMode;
  batchCategoryId: number | null;
  effectivePhoneRegion: string | null;
  now: string;
}

export interface CommitSingleImportInput {
  sessionId: number;
  rowId: number;
  input: CreateContactFullInput;
  externalLinks: ExternalContactLinkInput[];
  birthday: string | null;
  now: string;
}

export interface PickedImportNavigator {
  navigate: (
    route: "ImportReview" | "BulkImportSetup",
    params: { sessionId: number },
  ) => void;
}

/**
 * Accept the OS snapshot as one durable transaction. A failed cache-photo copy
 * does not block contact import; a successfully staged file is intentionally
 * left for launch reconciliation if the later SQL transaction fails.
 */
export async function acceptPickedContacts(
  exec: SqlExecutor,
  picked: PickedContact[],
  options: AcceptPickedContactsOptions,
): Promise<number> {
  const sessionUid = newUid();
  const rows = await Promise.all(
    picked.map(async (contact) => {
      const mapped = mapPickedContact(contact, {
        categoryId: options.batchCategoryId,
        effectivePhoneRegion: options.effectivePhoneRegion,
      });
      const rowUid = newUid();
      let photoRelPath: string | null = null;
      if (mapped.photoTempUri !== null) {
        try {
          const relative = importStagingRelPath(sessionUid, rowUid);
          await stageImportPhoto(mapped.photoTempUri, relative);
          photoRelPath = relative;
        } catch {
          // A photo is optional. The contact snapshot remains useful without it.
        }
      }
      return {
        uid: rowUid,
        externalContactId: mapped.externalContactId,
        sourcePayload: JSON.stringify({
          displayName: contact.displayName,
          methods: contact.methods,
          birthday: contact.birthday,
        }),
        photoRelPath,
      };
    }),
  );

  const accepted = await acceptImportSessionWithRows(exec, {
    session: {
      uid: sessionUid,
      mode: options.mode,
      batchCategoryId: options.batchCategoryId,
      batchTrackingEnabled: false,
      phoneRegion: options.effectivePhoneRegion,
      now: options.now,
    },
    rows,
  });
  return accepted.sessionId;
}

/**
 * The one single-contact create seam. `importContactRecord` composes contact
 * creation and row resolution in one transaction before the session completes.
 */
export async function commitSingleImport(
  exec: SqlExecutor,
  params: CommitSingleImportInput,
): Promise<number> {
  const { contactId } = await importContactRecord(exec, {
    input: params.input,
    externalLinks: params.externalLinks,
    birthday: params.birthday,
    now: params.now,
    resolveRow: { rowId: params.rowId, matchOutcome: "new" },
  });
  const row = (await listSessionRows(exec, params.sessionId)).find(
    (candidate) => candidate.id === params.rowId,
  );
  const photo = await persistImportedPhotoPostCommit(exec, importedPhotoFs, {
    contactId,
    rowId: params.rowId,
    stagedPhotoPath: row?.photoRelPath ?? null,
    now: params.now,
  });
  if (!photo.ok) {
    try {
      await markRowPhotoFailed(exec, params.rowId, params.now);
    } catch (error) {
      Logger.error(
        "import-acquire",
        `could not mark photo failure for import row ${params.rowId}`,
        error,
      );
    }
  }
  await completeSession(exec, params.sessionId, params.now);
  return contactId;
}

/** Route a picker result by cardinality; a cancelled picker owns no session. */
export async function routePickedImport(
  exec: SqlExecutor,
  picked: PickedContact[],
  options: Omit<AcceptPickedContactsOptions, "mode" | "batchCategoryId"> & {
    batchCategoryId?: number | null;
  },
  navigation: PickedImportNavigator,
): Promise<void> {
  if (picked.length === 0) return;
  const sessionId = await acceptPickedContacts(exec, picked, {
    mode: picked.length === 1 ? "single" : "bulk",
    batchCategoryId: options.batchCategoryId ?? null,
    effectivePhoneRegion: options.effectivePhoneRegion,
    now: options.now,
  });
  if (picked.length === 1) {
    navigation.navigate("ImportReview", { sessionId });
  } else {
    navigation.navigate("BulkImportSetup", { sessionId });
  }
}
