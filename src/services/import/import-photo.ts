/**
 * Best-effort post-commit photo import.
 *
 * A contact and its import row have already committed before this module runs.
 * Keeping image decoding, file persistence, and the later photo-column update
 * here means a corrupt source photo can never roll back the imported contact.
 */
import type * as ExpoImageManipulator from "expo-image-manipulator";
import { setContactPhoto } from "@/db/contacts-dao";
import type { SqlExecutor } from "@/db/types";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "import-photo";
const MASTER_SIZE = 512;
const MASTER_COMPRESS = 0.75;

export interface ImportedPhotoFs {
  resolveStagedPhotoPath: (relative: string) => string | Promise<string>;
  contactPhotoRelPath: (contactId: number) => string | Promise<string>;
  resizeToMaster: (stagedPhotoPath: string) => Promise<string>;
  persistMaster: (sourceUri: string, relative: string) => Promise<string>;
  setContactPhoto: (
    exec: SqlExecutor,
    contactId: number,
    relative: string,
    now: string,
  ) => Promise<void>;
}

async function resizeToMaster(stagedPhotoPath: string): Promise<string> {
  const { ImageManipulator, SaveFormat } = (await import(
    "expo-image-manipulator"
  )) as typeof ExpoImageManipulator;
  const rendered = await ImageManipulator.manipulate(stagedPhotoPath)
    .resize({ width: MASTER_SIZE, height: MASTER_SIZE })
    .renderAsync();
  const saved = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: MASTER_COMPRESS,
  });
  return saved.uri;
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
  const { persistMaster } = await import("@/services/photos/photo-storage");
  return persistMaster(sourceUri, relative);
}

/** The production dependencies; callers may inject this boundary for node tests. */
export const importedPhotoFs: ImportedPhotoFs = {
  resolveStagedPhotoPath,
  contactPhotoRelPath: photoRelativePath,
  resizeToMaster,
  persistMaster: persistPhotoMaster,
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
    await fs.persistMaster(resizedUri, relative);
    await fs.setContactPhoto(exec, params.contactId, relative, params.now);
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
