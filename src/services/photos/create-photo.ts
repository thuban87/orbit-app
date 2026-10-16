/**
 * Add Contact's held photo, promoted after the create commits (38.11 D-77).
 *
 * Add Contact has no contact id before Save, so the cropped photo is held in
 * the durable `create-staging/` namespace (`photo-storage.ts`). Once
 * `createContactFull` has committed, `promoteCreatePhoto` stores it through the
 * normal photo path: `persistOwnedMaster` onto the identity-derived
 * `avatars/contact-<id>.jpg` (ADR-021/ADR-158; the ownership layer publishes the
 * display revision, ADR-180), then `setContactPhotoForUid`, then the widget
 * notify. No photo bytes are written inside the create SQL transaction
 * (ADR-112 rejected filesystem work inside the transaction).
 *
 * It catches every error and returns `{ ok: false }`, so the caller keeps the
 * contact and tells the user the photo wasn't added (D-77), the same rule as
 * `persistImportedPhotoPostCommit`. The staging file is deleted in `finally`,
 * success or failure. No resize: CropPhoto's hold mode already encoded the
 * master.
 */
import { contactPhotoRelPath } from "@/db/photo-relative-path";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
import type { OwnedWriteOptions } from "@/services/photos/owned-master";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "create-photo";

/**
 * A staging token from `newUid()` (never `globalThis.crypto` directly, which
 * Hermes lacks), reduced to `[A-Za-z0-9]` so it is safe in a file name.
 */
export function newCreateStagingToken(): string {
  return newUid().replace(/[^A-Za-z0-9]/g, "");
}

/** The injectable boundary, so node tests never load the native file system. */
export interface CreatePhotoFs {
  resolveStagedUri: (relative: string) => string | Promise<string>;
  persistOwnedMaster: (
    exec: SqlExecutor,
    srcUri: string,
    canonical: string,
    opts: OwnedWriteOptions,
  ) => Promise<string>;
  getContactPhotoIdentity: (
    exec: SqlExecutor,
    contactId: number,
  ) => Promise<string | null>;
  setContactPhotoForUid: (
    exec: SqlExecutor,
    contactId: number,
    uid: string,
    relative: string,
    now: string,
  ) => Promise<void>;
  notifyWidgetDataChanged: () => void | Promise<void>;
  deleteCreateStaging: (relative: string) => void | Promise<void>;
}

// Production dependencies load lazily, so a screen that only needs
// `newCreateStagingToken` (the hold-mode picker) pulls in no DAO or native code.
async function getIdentity(
  exec: SqlExecutor,
  contactId: number,
): Promise<string | null> {
  const { getContactPhotoIdentity } = await import("@/db/contacts-dao");
  return getContactPhotoIdentity(exec, contactId);
}

async function setPhotoForUid(
  exec: SqlExecutor,
  contactId: number,
  uid: string,
  relative: string,
  now: string,
): Promise<void> {
  const { setContactPhotoForUid } = await import("@/db/contacts-dao");
  return setContactPhotoForUid(exec, contactId, uid, relative, now);
}

async function resolveStagedUri(relative: string): Promise<string> {
  const { resolveCreateStagingUri } = await import(
    "@/services/photos/photo-storage"
  );
  return resolveCreateStagingUri(relative);
}

async function persistOwned(
  exec: SqlExecutor,
  srcUri: string,
  canonical: string,
  opts: OwnedWriteOptions,
): Promise<string> {
  const { persistOwnedMaster } = await import("@/services/photos/owned-master");
  return persistOwnedMaster(exec, srcUri, canonical, opts);
}

async function notifyWidget(): Promise<void> {
  const { notifyWidgetDataChanged } = await import(
    "@/services/widget/widget-refresh"
  );
  notifyWidgetDataChanged();
}

async function deleteStaged(relative: string): Promise<void> {
  const { deleteCreateStaging } = await import(
    "@/services/photos/photo-storage"
  );
  deleteCreateStaging(relative);
}

/** The production dependencies. */
export const createPhotoFs: CreatePhotoFs = {
  resolveStagedUri,
  persistOwnedMaster: persistOwned,
  getContactPhotoIdentity: getIdentity,
  setContactPhotoForUid: setPhotoForUid,
  notifyWidgetDataChanged: notifyWidget,
  deleteCreateStaging: deleteStaged,
};

export interface PromoteCreatePhotoParams {
  exec: SqlExecutor;
  /** The id `createContactFull` returned. */
  contactId: number;
  /** The uid the create input carried; the write is refused if it changed. */
  contactUid: string;
  /** The held `create-staging/…` path. */
  stagedRelative: string;
  now: string;
}

/**
 * Store a held Add Contact photo as the new contact's photo. Call only after
 * `createContactFull` has resolved. Never throws.
 */
export async function promoteCreatePhoto(
  params: PromoteCreatePhotoParams,
  fs: CreatePhotoFs = createPhotoFs,
): Promise<{ ok: boolean }> {
  const { exec, contactId, contactUid, stagedRelative, now } = params;
  try {
    const canonical = contactPhotoRelPath(contactId);
    const stagedUri = await fs.resolveStagedUri(stagedRelative);
    await fs.persistOwnedMaster(exec, stagedUri, canonical, {
      // The path is identity-derived; refuse to write if the id no longer
      // belongs to the contact this form created (T-38.11-18).
      authorize: async (lockedExec) =>
        (await fs.getContactPhotoIdentity(lockedExec, contactId)) ===
        contactUid,
    });
    await fs.setContactPhotoForUid(exec, contactId, contactUid, canonical, now);
    try {
      await fs.notifyWidgetDataChanged();
    } catch (error) {
      // The photo is stored; a widget refresh failure must not report it lost.
      Logger.error(
        LOG_SCOPE,
        "widget refresh after photo promote failed",
        error,
      );
    }
    return { ok: true };
  } catch (error) {
    Logger.error(
      LOG_SCOPE,
      `post-create photo promote failed for contact ${contactId}`,
      error,
    );
    return { ok: false };
  } finally {
    try {
      await fs.deleteCreateStaging(stagedRelative);
    } catch (error) {
      Logger.error(LOG_SCOPE, "could not delete held create photo", error);
    }
  }
}
