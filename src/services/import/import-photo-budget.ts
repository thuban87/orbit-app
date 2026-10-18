/**
 * Import photo budget (38.12 D-133; ADR-181 D-39).
 *
 * Full-size import photos (D-118) can push the encrypted backup past its cap
 * (`APPROVED_BACKUP_ENCRYPTION_PROFILE.maxCiphertextBytes`), after which every
 * automatic backup fails. Before an import that takes photos, Orbit estimates
 * the backup's size and, when the photos may not fit, asks the user through the
 * four-choice PhotoBudgetSheet. It never goes over silently.
 *
 * The cap exists only on the encrypted path (`encryption.ts` raises "too-large"
 * only while encrypting), so with backup encryption off there is no estimate and
 * no prompt (convergence c5 F-5).
 */

import { File, Paths } from "expo-file-system";
import type * as ExpoImageManipulator from "expo-image-manipulator";
import { buildExportManifest } from "@/backup/export-manifest";
import { getAppSettings } from "@/db/app-settings-dao";
import type { SqlExecutor } from "@/db/types";
import { APPROVED_BACKUP_ENCRYPTION_PROFILE } from "@/services/backup/encryption";
import { renderPreviewDownscale } from "@/services/photos/manipulator-derivatives";
import { Logger } from "@/utils/logger";
import type { PickedContact } from "../../../modules/orbit-contact-picker";

/** Backup bytes one incoming photo contact adds (D-133; ADR-181). */
export const PHOTO_CONTACT_BACKUP_BYTES = 62_000;
/**
 * Width "Import with smaller photos" downscales a full-size-only photo to
 * (convergence c1 C-3): the upper end of Android's contact-thumbnail size, so a
 * smaller import is never larger than a thumbnail import.
 */
export const SMALLER_IMPORT_PHOTO_EDGE = 256;
/**
 * What the estimate's stub photo reader returns for a photo file it found. It
 * is never "": the exporter fails on an empty background read and skips an
 * empty contact photo (`export-manifest.ts`). Its length is subtracted back out.
 */
export const ESTIMATE_PHOTO_PLACEHOLDER = "AAAA";
/** A fixed, valid export timestamp; only its length reaches the estimate. */
const ESTIMATE_EXPORTED_AT = "2000-01-01 00:00:00";

const LOG_SCOPE = "import-photo-budget";

export type PhotoBudgetChoice = "smaller" | "without" | "continue" | "back";

/** The size the sheet shows; null means the estimate could not be made. */
export type PhotoBudgetEstimate = { projectedBytes: number } | null;

export type DecidePhotoBudget = (
  estimate: PhotoBudgetEstimate,
) => Promise<PhotoBudgetChoice>;

export interface PhotoBudgetDeps {
  /** Byte size of a stored photo (document-relative path); null when unreadable. */
  fileSize: (relativePath: string) => number | null;
  /** Whether backup encryption is on (the only path with a size cap). */
  encryptionEnabled: (exec: SqlExecutor) => Promise<boolean>;
  /** The current backup's size in bytes; null when it cannot be estimated. */
  currentBackupBytes: (
    exec: SqlExecutor,
    fileSize: (relativePath: string) => number | null,
  ) => Promise<number | null>;
}

function productionFileSize(relativePath: string): number | null {
  try {
    const file = new File(Paths.document, relativePath);
    if (!file.exists) return null;
    const size = file.size;
    return typeof size === "number" && size >= 0 ? size : null;
  } catch {
    return null;
  }
}

/**
 * The current backup's size: the export manifest's UTF-8 JSON length built with
 * a stub photo reader (no photo bytes are read), minus the placeholders, plus
 * each recorded photo file's base64 size. Returns null (logged) when the
 * exporter itself fails, e.g. a saved Profile background whose file is missing
 * (the real backup fails the same way); the exporter's policy is untouched.
 */
export async function estimateCurrentBackupBytes(
  exec: SqlExecutor,
  fileSize: (relativePath: string) => number | null = productionFileSize,
): Promise<number | null> {
  let placeholders = 0;
  let photoBase64Bytes = 0;
  try {
    const manifest = await buildExportManifest(exec, {
      exportedAt: ESTIMATE_EXPORTED_AT,
      readPhotoBase64: async (relativePath) => {
        const size = fileSize(relativePath);
        // A missing file is skipped exactly as the real exporter skips it.
        if (size === null) return "";
        placeholders += 1;
        photoBase64Bytes += Math.ceil((size * 4) / 3);
        return ESTIMATE_PHOTO_PLACEHOLDER;
      },
    });
    const jsonBytes = new TextEncoder().encode(JSON.stringify(manifest)).length;
    return (
      jsonBytes -
      placeholders * ESTIMATE_PHOTO_PLACEHOLDER.length +
      photoBase64Bytes
    );
  } catch (error) {
    Logger.warn(LOG_SCOPE, "could not estimate the backup size", error);
    return null;
  }
}

/** Production deps; a caller's partial deps are merged over these (F-3). */
export const DEFAULT_PHOTO_BUDGET_DEPS: PhotoBudgetDeps = {
  fileSize: productionFileSize,
  encryptionEnabled: async (exec) =>
    (await getAppSettings(exec)).encryptionEnabled === 1,
  currentBackupBytes: estimateCurrentBackupBytes,
};

/**
 * Read the encryption setting; a failed read counts as ON so the D-133 sheet
 * still asks (never goes over silently).
 */
export async function readEncryptionEnabled(
  deps: Pick<PhotoBudgetDeps, "encryptionEnabled">,
  exec: SqlExecutor,
): Promise<boolean> {
  try {
    return await deps.encryptionEnabled(exec);
  } catch (error) {
    Logger.warn(
      LOG_SCOPE,
      "could not read the backup encryption setting; treating it as on",
      error,
    );
    return true;
  }
}

/** Whether the projected backup passes the encrypted cap. Never over when encryption is off. */
export function isOverPhotoBudget(input: {
  currentBytes: number;
  incomingPhotoContacts: number;
  encryptionEnabled: boolean;
}): { over: boolean; projectedBytes: number } {
  const projectedBytes =
    input.currentBytes +
    input.incomingPhotoContacts * PHOTO_CONTACT_BACKUP_BYTES;
  return {
    over:
      input.encryptionEnabled &&
      projectedBytes > APPROVED_BACKUP_ENCRYPTION_PROFILE.maxCiphertextBytes,
    projectedBytes,
  };
}

type Manipulator = typeof ExpoImageManipulator;

/** Pixel width of an image, via the manipulator; null when it cannot be read. */
async function readImageWidth(uri: string): Promise<number | null> {
  const mod = (await import("expo-image-manipulator")) as Manipulator;
  let context: ReturnType<
    Manipulator["ImageManipulator"]["manipulate"]
  > | null = null;
  let rendered: Awaited<
    ReturnType<
      ReturnType<Manipulator["ImageManipulator"]["manipulate"]>["renderAsync"]
    >
  > | null = null;
  try {
    context = mod.ImageManipulator.manipulate(uri);
    rendered = await context.renderAsync();
    return rendered.width;
  } catch {
    return null;
  } finally {
    for (const ref of [rendered, context]) {
      try {
        ref?.release();
      } catch {
        // Never mask the width or its error.
      }
    }
  }
}

export interface ApplyPhotoBudgetDeps {
  downscale: (sourceUri: string, maxEdge: number) => Promise<string>;
  readWidth: (uri: string) => Promise<number | null>;
}

const DEFAULT_APPLY_DEPS: ApplyPhotoBudgetDeps = {
  downscale: renderPreviewDownscale,
  readWidth: readImageWidth,
};

/**
 * Apply the user's choice to the picked contacts. Returns the contacts to
 * import and the cache copies the caller must discard (the copies the result
 * no longer references). "back" is the caller's, never applied here.
 */
export async function applyPhotoBudgetChoice(
  picked: readonly PickedContact[],
  choice: Exclude<PhotoBudgetChoice, "back">,
  deps: ApplyPhotoBudgetDeps = DEFAULT_APPLY_DEPS,
): Promise<{ contacts: PickedContact[]; discard: string[] }> {
  const discard: string[] = [];
  if (choice === "continue") return { contacts: [...picked], discard };
  const contacts: PickedContact[] = [];
  for (const contact of picked) {
    if (choice === "without") {
      if (contact.photoTempUri) discard.push(contact.photoTempUri);
      if (contact.thumbnailTempUri) discard.push(contact.thumbnailTempUri);
      // D-147: a declined phone photo is remembered as reviewed at import.
      const hadPhoto = Boolean(
        contact.photoTempUri || contact.thumbnailTempUri,
      );
      contacts.push({
        ...contact,
        photoTempUri: null,
        thumbnailTempUri: null,
        ...(hadPhoto ? { photoDeclined: true } : {}),
      });
      continue;
    }
    // "smaller"
    if (contact.thumbnailTempUri) {
      if (contact.photoTempUri) discard.push(contact.photoTempUri);
      contacts.push({
        ...contact,
        photoTempUri: contact.thumbnailTempUri,
        thumbnailTempUri: null,
      });
      continue;
    }
    if (!contact.photoTempUri) {
      contacts.push(contact);
      continue;
    }
    // Full-size only, or a thumbnail-only fallback read (B-9).
    const source = contact.photoTempUri;
    const width = await deps.readWidth(source).catch(() => null);
    if (width !== null && width <= SMALLER_IMPORT_PHOTO_EDGE) {
      // Already small: keep it as is (never upscale, D-118); nothing to discard.
      contacts.push(contact);
      continue;
    }
    try {
      const downscaled = await deps.downscale(
        source,
        SMALLER_IMPORT_PHOTO_EDGE,
      );
      discard.push(source);
      contacts.push({ ...contact, photoTempUri: downscaled });
    } catch (error) {
      // Never keep a full-size copy for "smaller" (C-3): drop this photo.
      Logger.warn(
        LOG_SCOPE,
        "could not make a smaller photo; importing without it",
        error,
      );
      discard.push(source);
      contacts.push({ ...contact, photoTempUri: null });
    }
  }
  return { contacts, discard };
}

/** The sheet's body copy (D-133); null estimate = the unknown-size variant (c4 E-1). */
export function photoBudgetBody(estimate: PhotoBudgetEstimate): string {
  const capMb = Math.round(
    APPROVED_BACKUP_ENCRYPTION_PROFILE.maxCiphertextBytes / (1024 * 1024),
  );
  const cap = `Backups can't be bigger than ${capMb} MB.`;
  if (estimate === null)
    return `Orbit couldn't check whether these photos fit in your backups. ${cap}`;
  const mb = (estimate.projectedBytes / (1024 * 1024)).toFixed(1);
  return `Importing these photos would make your backup about ${mb} MB. ${cap}`;
}
