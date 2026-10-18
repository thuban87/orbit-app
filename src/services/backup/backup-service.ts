import { isExpiredAutomaticBackup } from "@/backup/auto-backup-policy";
import {
  automaticBackupFileName,
  backupNameTimestampMs,
  isOwnedAutomaticBackupName,
  uniqueBackupFileName,
} from "@/backup/backup-file-names";
import {
  parseBackupManifest,
  UPDATE_FIRST_MESSAGE,
} from "@/backup/backup-schema";
import { buildExportReport } from "@/backup/export-manifest";
import type { BackupEncryptionProfile, BackupManifest } from "@/backup/types";
import { countContactsNotInBin, listBinContactUids } from "@/db/contact-read";
import type { ReadOnlyExecutor } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import {
  type BackupEnvelopeCrypto,
  BackupEnvelopeError,
  isBackupTooLargeError,
} from "@/services/backup/encryption";
import type {
  BackupPassphraseChangeStore,
  BackupPassphraseStore,
  PassphraseReadResult,
  PendingBackupPassphraseChange,
} from "@/services/backup/passphrase-store";
import type {
  SafReadableStorage,
  SafStorage,
} from "@/services/backup/saf-storage";

export type BackupPreview = {
  exportedAt: string;
  /**
   * The version the file was written in (38.10 D-136 O14), read from the raw
   * file before the forward conversion; display only. The manifest handed to
   * restore is the converted one, as before.
   */
  backupFormatVersion: number;
  encrypted: boolean;
  rowCount: number;
  photoCount: number;
};

export type BackupPreviewResult =
  | { status: "ready"; preview: BackupPreview }
  | {
      status: "failed";
      reason: "wrong-passphrase" | "damaged-or-incomplete" | "newer-app";
    };

/** What the file alone says, before this phone's side is read. */
export type RestoreFileAggregate = BackupPreview & {
  /** Every contact row in the file, Bin included. */
  contactCount: number;
  /** D-60: the backup's people: its contacts not in the Bin. */
  backupContacts: number;
  /** D-60: every linked entity the manifest carries (see linkedItemCount). */
  relatedRowCount: number;
  tombstoneCount: number;
};

export type RestorePreviewAggregate = RestoreFileAggregate & {
  /** D-60: this phone's people: its contacts not in the Bin (DAO count). */
  phoneContacts: number;
  /**
   * People in this phone's Bin that the backup does not carry: Replace all
   * deletes them permanently, so its confirm says so when this is above 0
   * (38.12 review A-WR-01; D-59, D-60). Merge never deletes them.
   */
  phoneBinNotInBackup: number;
};

type RestoreLoadFailure = {
  status: "failed";
  reason: "wrong-passphrase" | "damaged-or-incomplete" | "newer-app";
};

/** The file side of a restore candidate (write-free and DB-free). */
export type ValidatedRestoreFile =
  | {
      status: "ready";
      preview: RestoreFileAggregate;
      manifest: BackupManifest;
    }
  | RestoreLoadFailure;

/** A validated restore candidate remains private to the apply owner, never navigation. */
export type ValidatedRestoreCandidate =
  | {
      status: "ready";
      preview: RestorePreviewAggregate;
      manifest: BackupManifest;
    }
  | RestoreLoadFailure;

/**
 * D-60: the linked-items count covers every entity the manifest carries. It is
 * enumerated from the manifest itself (every row array), not a hand list, so
 * a new entity is counted without an edit here. Contacts (people) and
 * tombstones (deleted items) have their own lines. A backup carries one
 * custom-field row per contact and field, most of them empty, so only the
 * custom-field values that hold something are counted (review A-IN-04).
 */
function linkedItemCount(manifest: BackupManifest): number {
  let count = 0;
  for (const [key, value] of Object.entries(manifest) as Array<
    [keyof BackupManifest, unknown]
  >)
    if (key === "customFieldValues" && Array.isArray(value))
      count += (value as Array<Record<string, unknown>>).filter(
        (row) => row.value != null,
      ).length;
    else if (key !== "contacts" && key !== "tombstones" && Array.isArray(value))
      count += value.length;
  return count;
}

/**
 * The format version a backup file was written in, read from the raw (and,
 * if encrypted, decrypted) object before `parseBackupManifest` converts it
 * forward (38.10 D-136 O14). A missing version is 1, the parser's own
 * default. It runs just before that parse, but its value is used only when
 * the parse succeeds: a bad version throws there, before any preview is
 * built (T-38.10-61). Display only.
 */
function sourceFormatVersion(raw: unknown): number {
  const version =
    raw && typeof raw === "object"
      ? (raw as Record<string, unknown>).backupFormatVersion
      : undefined;
  return typeof version === "number" && Number.isInteger(version) ? version : 1;
}

/**
 * The write-free restore boundary. It deliberately returns aggregate data only:
 * callers retain the validated manifest privately until a later explicit apply.
 */
export function loadBackupForRestore(input: {
  contents: string;
  passphrase?: string;
  crypto?: BackupEnvelopeCrypto;
}): ValidatedRestoreFile {
  try {
    let raw: unknown = JSON.parse(input.contents);
    let encrypted = false;
    if (
      raw &&
      typeof raw === "object" &&
      (raw as Record<string, unknown>).encrypted === true
    ) {
      if (!input.crypto || !input.passphrase)
        return { status: "failed", reason: "wrong-passphrase" };
      const decrypted = input.crypto.decrypt({
        passphrase: input.passphrase,
        envelope: raw,
      });
      raw = JSON.parse(new TextDecoder().decode(decrypted));
      encrypted = true;
    }
    // Read before the forward conversion (D-136 O14; display only); used
    // only if the parse below succeeds.
    const fileVersion = sourceFormatVersion(raw);
    const manifest = parseBackupManifest(raw);
    const rows = [
      manifest.categories,
      manifest.contacts,
      manifest.interactions,
      manifest.events,
      manifest.offLimits,
      manifest.contactLinks,
      manifest.customFieldDefs,
      manifest.customFieldValues,
      manifest.tombstones,
    ];
    const photoRows = [
      manifest.profile,
      ...manifest.contacts,
      ...manifest.customFieldValues,
    ];
    return {
      status: "ready",
      manifest,
      preview: {
        exportedAt: manifest.metadata.exportedAt,
        backupFormatVersion: fileVersion,
        encrypted,
        rowCount: rows.reduce(
          (count, value) => count + value.length,
          manifest.profile ? 1 : 0,
        ),
        photoCount: photoRows.filter(
          (row) => row?.photoBase64 !== null && row?.photoBase64 !== undefined,
        ).length,
        contactCount: manifest.contacts.length,
        backupContacts: manifest.contacts.filter(
          (contact) => contact.archivedAt == null,
        ).length,
        relatedRowCount: linkedItemCount(manifest),
        tombstoneCount: manifest.tombstones.length,
      },
    };
  } catch (error) {
    if (
      error instanceof BackupEnvelopeError &&
      error.code === "authentication-failed"
    ) {
      return { status: "failed", reason: "wrong-passphrase" };
    }
    if (error instanceof Error && error.message === UPDATE_FIRST_MESSAGE) {
      return { status: "failed", reason: "newer-app" };
    }
    return { status: "failed", reason: "damaged-or-incomplete" };
  }
}

/**
 * The restore candidate the preview page uses: the file side from
 * `loadBackupForRestore` plus this phone's people, read through the DAO
 * (D-60: "This phone: N contacts · Backup: M contacts", both not in the Bin).
 * Read-only; nothing is written.
 */
export async function loadBackupForRestorePreview(
  exec: ReadOnlyExecutor | SqlExecutor,
  input: Parameters<typeof loadBackupForRestore>[0],
): Promise<ValidatedRestoreCandidate> {
  const file = loadBackupForRestore(input);
  if (file.status !== "ready") return file;
  const backupUids = new Set(file.manifest.contacts.map((row) => row.uid));
  return {
    ...file,
    preview: {
      ...file.preview,
      phoneContacts: await countContactsNotInBin(exec),
      phoneBinNotInBackup: (await listBinContactUids(exec)).filter(
        (uid) => !backupUids.has(uid),
      ).length,
    },
  };
}

/** Compatibility-safe aggregate-only preview API for callers that never apply. */
export function loadBackupForPreview(input: {
  contents: string;
  passphrase?: string;
  crypto?: BackupEnvelopeCrypto;
}): BackupPreviewResult {
  const candidate = loadBackupForRestore(input);
  return candidate.status === "ready"
    ? {
        status: "ready",
        preview: {
          exportedAt: candidate.preview.exportedAt,
          backupFormatVersion: candidate.preview.backupFormatVersion,
          encrypted: candidate.preview.encrypted,
          rowCount: candidate.preview.rowCount,
          photoCount: candidate.preview.photoCount,
        },
      }
    : candidate;
}

export type WriteEncryptionMode =
  | { mode: "plaintext" }
  | { mode: "encrypted"; passphrase: string }
  | { mode: "blocked"; reason: "passphrase-absent" | "passphrase-unavailable" };

/** Never infer the durable setting from the SecureStore cache state. */
export function resolveWriteEncryptionMode(
  enabled: boolean,
  passphrase: PassphraseReadResult,
): WriteEncryptionMode {
  if (!enabled) return { mode: "plaintext" };
  if (passphrase.status === "present")
    return { mode: "encrypted", passphrase: passphrase.passphrase };
  return {
    mode: "blocked",
    reason:
      passphrase.status === "absent"
        ? "passphrase-absent"
        : "passphrase-unavailable",
  };
}

let backupServiceQueue: Promise<void> = Promise.resolve();

/** Serialize destination writes and passphrase lifecycle work within this app process. */
export function withBackupServiceLock<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const next = backupServiceQueue.then(operation, operation);
  backupServiceQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export interface EncryptionFlagStore {
  getEncryptionEnabled(): Promise<boolean>;
  setEncryptionEnabled(enabled: boolean): Promise<void>;
}

export type EncryptionLifecycleResult =
  | { status: "enabled" }
  | { status: "disabled" }
  | {
      status: "needs-attention";
      reason:
        | "passphrase-absent"
        | "passphrase-unavailable"
        | "flag-update-failed";
    }
  | {
      status: "failed";
      reason:
        | "passphrase-write-failed"
        | "passphrase-delete-failed"
        | "flag-update-failed";
    }
  | { status: "normal" };

/**
 * Explicit cross-store sagas. No operation silently changes the flag in
 * response to a SecureStore failure; contradictory states stay fail-closed.
 */
export function createBackupEncryptionLifecycle(
  passphrases: BackupPassphraseStore,
  flags: EncryptionFlagStore,
) {
  return {
    enable: (passphrase: string): Promise<EncryptionLifecycleResult> =>
      withBackupServiceLock(async () => {
        try {
          await passphrases.setPassphrase(passphrase);
        } catch {
          return { status: "failed", reason: "passphrase-write-failed" };
        }
        try {
          await flags.setEncryptionEnabled(true);
          return { status: "enabled" };
        } catch {
          // Best-effort compensation does not alter the failure outcome.
          try {
            await passphrases.deletePassphrase();
          } catch {
            /* orphan is swept at launch */
          }
          return { status: "failed", reason: "flag-update-failed" };
        }
      }),
    disable: (confirmed: boolean): Promise<EncryptionLifecycleResult> =>
      withBackupServiceLock(async () => {
        if (!confirmed)
          return { status: "failed", reason: "passphrase-delete-failed" };
        try {
          await passphrases.deletePassphrase();
        } catch {
          return { status: "failed", reason: "passphrase-delete-failed" };
        }
        try {
          await flags.setEncryptionEnabled(false);
          return { status: "disabled" };
        } catch {
          return { status: "needs-attention", reason: "flag-update-failed" };
        }
      }),
    reconcile: async (): Promise<EncryptionLifecycleResult> => {
      const [enabled, passphrase] = await Promise.all([
        flags.getEncryptionEnabled(),
        passphrases.getPassphrase(),
      ]);
      if (!enabled) {
        if (passphrase.status === "present") {
          try {
            await passphrases.deletePassphrase();
          } catch {
            /* plaintext remains safe */
          }
        }
        return { status: "normal" };
      }
      const mode = resolveWriteEncryptionMode(true, passphrase);
      return mode.mode === "blocked"
        ? { status: "needs-attention", reason: mode.reason }
        : { status: "normal" };
    },
  };
}

export type AutomaticBackupReencryptionResult =
  | { status: "changed"; reencryptedCount: number }
  | { status: "wrong-current-passphrase" }
  | { status: "needs-attention" }
  | { status: "needs-recovery" }
  /**
   * 38.6 D-39 (review WR5-03): a source re-encrypts to more than the encrypted
   * size cap. The active passphrase is unchanged and retrying the same change
   * can never succeed, so this is not a folder/recovery problem.
   */
  | { status: "too-large" };

interface AutomaticBackupReencryptionDependencies {
  readonly directoryUri: string;
  readonly now: Date;
  readonly crypto: BackupEnvelopeCrypto;
  readonly profile: BackupEncryptionProfile;
  readonly passphrases: BackupPassphraseChangeStore;
  readonly storage: SafReadableStorage;
}

/**
 * Converts one automatic file only after its new encrypted replacement has
 * been read, decrypted, and schema-validated. A SecureStore journal retains
 * both user-supplied secrets and replacement URIs through interruption, so a
 * retry can finish source deletion without losing the active old secret.
 */
export function createAutomaticBackupReencryptionService(
  deps: AutomaticBackupReencryptionDependencies,
): {
  change(input: {
    currentPassphrase: string;
    nextPassphrase: string;
  }): Promise<AutomaticBackupReencryptionResult>;
} {
  return {
    change: (input) =>
      withBackupServiceLock(async () => {
        const active = await deps.passphrases.getPassphrase();
        if (active.status !== "present") return { status: "needs-attention" };
        if (active.passphrase !== input.currentPassphrase) {
          return { status: "wrong-current-passphrase" };
        }

        let pending: PendingBackupPassphraseChange;
        const pendingRead = await deps.passphrases.getPendingPassphraseChange();
        if (pendingRead.status === "unavailable")
          return { status: "needs-attention" };
        if (pendingRead.status === "present") {
          if (
            pendingRead.change.oldPassphrase !== input.currentPassphrase ||
            pendingRead.change.nextPassphrase !== input.nextPassphrase
          ) {
            return { status: "needs-recovery" };
          }
          pending = pendingRead.change;
        } else {
          pending = {
            oldPassphrase: input.currentPassphrase,
            nextPassphrase: input.nextPassphrase,
            replacements: [],
          };
          try {
            await deps.passphrases.setPendingPassphraseChange(pending);
          } catch {
            return { status: "needs-attention" };
          }
        }

        try {
          // Recognised by display name, never by URI (38.12 review A-WR-02):
          // on Google Drive the URI's last segment is an opaque id.
          const listed = await deps.storage.list(deps.directoryUri);
          // Only automatic backups are re-encrypted (38.12 D-136): a manual
          // export saved into this folder is never rewritten or removed.
          const owned = listed.filter((entry) =>
            isOwnedAutomaticBackupName(entry.name),
          );
          const uris = owned.map((entry) => entry.uri);
          const sourceNames = new Map(
            owned.map((entry) => [entry.uri, entry.name]),
          );
          // Every name in the folder plus every name this run writes, so the
          // minute-precision replacements never collide (D-136).
          const taken = new Set(listed.map((entry) => entry.name));
          const replacementUris = new Set(
            pending.replacements.map(
              (replacement) => replacement.replacementUri,
            ),
          );
          const sourceUris = uris.filter((uri) => !replacementUris.has(uri));
          let reencryptedCount = 0;

          for (const sourceUri of sourceUris) {
            const prior = pending.replacements.find(
              (replacement) => replacement.sourceUri === sourceUri,
            );
            if (prior) {
              const replacementContents = await deps.storage.read(
                prior.replacementUri,
              );
              const replacementEnvelope: unknown =
                JSON.parse(replacementContents);
              const replacementPlaintext = deps.crypto.decrypt({
                passphrase: pending.nextPassphrase,
                envelope: replacementEnvelope,
              });
              parseBackupManifest(
                JSON.parse(new TextDecoder().decode(replacementPlaintext)),
              );
              await deps.storage.remove(sourceUri);
              continue;
            }

            const sourceContents = await deps.storage.read(sourceUri);
            const sourceEnvelope: unknown = JSON.parse(sourceContents);
            const sourcePlaintext =
              sourceEnvelope &&
              typeof sourceEnvelope === "object" &&
              (sourceEnvelope as Record<string, unknown>).encrypted === true
                ? deps.crypto.decrypt({
                    passphrase: pending.oldPassphrase,
                    envelope: sourceEnvelope,
                  })
                : new TextEncoder().encode(sourceContents);
            parseBackupManifest(
              JSON.parse(new TextDecoder().decode(sourcePlaintext)),
            );

            const replacementContents = JSON.stringify(
              deps.crypto.encrypt({
                passphrase: pending.nextPassphrase,
                plaintext: sourcePlaintext,
                profile: deps.profile,
              }),
            );
            // DEF-07: the replacement keeps the source's own time in its name,
            // so its date stays readable and retention still prunes it on time.
            const replacementName = uniqueBackupFileName(
              automaticBackupFileName(
                replacementNameTime(sourceNames.get(sourceUri), deps.now),
              ),
              taken,
            );
            taken.add(replacementName);
            const replacementUri = await deps.storage.writeVerified(
              deps.directoryUri,
              replacementName,
              replacementContents,
            );
            const verifiedReplacement: unknown = JSON.parse(
              await deps.storage.read(replacementUri),
            );
            const verifiedPlaintext = deps.crypto.decrypt({
              passphrase: pending.nextPassphrase,
              envelope: verifiedReplacement,
            });
            parseBackupManifest(
              JSON.parse(new TextDecoder().decode(verifiedPlaintext)),
            );

            pending = {
              ...pending,
              replacements: [
                ...pending.replacements,
                { sourceUri, replacementUri },
              ],
            };
            await deps.passphrases.setPendingPassphraseChange(pending);
            await deps.storage.remove(sourceUri);
            reencryptedCount += 1;
          }

          await deps.passphrases.setPassphrase(pending.nextPassphrase);
          await deps.passphrases.clearPendingPassphraseChange();
          return { status: "changed", reencryptedCount };
        } catch (error) {
          if (isBackupTooLargeError(error)) {
            // 38.6 D-39 (review WR5-03): an over-cap source (typically a
            // plaintext automatic backup written while encryption was off) can
            // never be re-encrypted, so a resume would fail the same way. When
            // no replacement exists yet, nothing in the folder has changed and
            // the journal is dropped so another change, or future-only, is not
            // blocked by it. Once a replacement exists the journal is kept: it
            // is the only record of which files already use the new passphrase.
            if (pending.replacements.length === 0) {
              try {
                await deps.passphrases.clearPendingPassphraseChange();
              } catch {
                /* the journal still matches this exact input; a retry is safe */
              }
            }
            return { status: "too-large" };
          }
          // The journal and old active secret stay intact so the exact operation
          // can be resumed after SAF/keystore recovery; no source is removed
          // until a replacement has independently decrypted and parsed.
          return { status: "needs-recovery" };
        }
      }),
  };
}

/**
 * The time a re-encrypted backup's new name carries (38.12 DEF-07): the
 * source's own name time (local or old UTC, as `backupNameTimestampMs` reads
 * it), so re-encryption never renames every backup to the current minute.
 * `now` only when the source name has no readable time.
 */
export function replacementNameTime(
  sourceName: string | undefined,
  now: Date,
): Date {
  const ms = sourceName ? backupNameTimestampMs(sourceName) : null;
  return ms === null ? now : new Date(ms);
}

export interface LocalExportFile {
  readonly uri: string;
  write(contents: string): Promise<void>;
  read(): Promise<string>;
  delete(): Promise<void>;
}

export interface LocalExportFiles {
  create(): Promise<LocalExportFile>;
  retireAll(): Promise<void>;
  retireStale(nowMs: number, graceMs: number): Promise<void>;
}

export interface ExportShareAdapter {
  isAvailable(): Promise<boolean>;
  open(uri: string): Promise<void>;
}

export type ManualExportResult =
  /** `skippedPhotos`: missing or empty photos left out of the share (38.6 D-24/D-29). */
  | { status: "shared"; skippedPhotos: number }
  | { status: "busy" }
  | { status: "sharing-unavailable" }
  | { status: "share-failed" }
  | { status: "export-failed" }
  /** 38.6 D-39: the encrypted export is over the size cap; nothing was written. */
  | { status: "too-large" };

/**
 * 38.6 D-39: the `backup_folder_diagnostic` value an automatic backup that was
 * over the encrypted size cap records (device-local; never exported). The
 * folder itself is fine, so its accessibility is left as it was; the Backup
 * health card reads this value to say the backup is too large rather than that
 * the folder needs reconnecting. A verified write clears it.
 */
export const AUTOMATIC_BACKUP_TOO_LARGE_DIAGNOSTIC =
  "The latest automatic backup was too large to create.";

export interface ManualExportDependencies {
  exec: SqlExecutor;
  exportedAt: string;
  readPhotoBase64: (relativePath: string) => Promise<string>;
  files: LocalExportFiles;
  share: ExportShareAdapter;
  /** Optional protection for manual shares; plaintext needs an explicit UI override. */
  encryption?: {
    enabled: boolean;
    passphrase: PassphraseReadResult;
    crypto: BackupEnvelopeCrypto;
    profile: BackupEncryptionProfile;
  };
}

export interface AutomaticBackupDependencies {
  exec: SqlExecutor;
  exportedAt: string;
  now: Date;
  readPhotoBase64: (relativePath: string) => Promise<string>;
  directoryUri: string;
  retentionDays: number;
  storage: SafStorage;
  /** Injected by the configuration owner once encryption is enabled. */
  encryption?: {
    enabled: boolean;
    passphrase: PassphraseReadResult;
    encrypt(contents: string, passphrase: string): string;
  };
}

/**
 * Creates the manual-only path. It intentionally never reads or writes backup
 * folder/health metadata: opening a share sheet is not automatic protection.
 */
export function createManualExportService(deps: ManualExportDependencies): {
  shareExport(options?: {
    readableOverride?: boolean;
  }): Promise<ManualExportResult>;
  sharePlaintextExport(): Promise<ManualExportResult>;
} {
  let inFlight = false;
  return {
    async shareExport(options = {}): Promise<ManualExportResult> {
      if (inFlight) return { status: "busy" };
      inFlight = true;
      let file: LocalExportFile | null = null;
      let handedOff = false;
      try {
        await deps.files.retireAll();
        const encryption = deps.encryption;
        const mode = resolveWriteEncryptionMode(
          encryption?.enabled === true && !options.readableOverride,
          encryption?.passphrase ?? { status: "absent" },
        );
        if (mode.mode === "blocked") return { status: "export-failed" };
        const report = await buildExportReport(deps.exec, {
          exportedAt: deps.exportedAt,
          readPhotoBase64: deps.readPhotoBase64,
        });
        const plaintext = JSON.stringify(report.manifest);
        // Validate the portable source before encrypting or writing it.
        parseBackupManifest(JSON.parse(plaintext));
        let contents = plaintext;
        if (mode.mode === "encrypted") {
          if (!encryption) return { status: "export-failed" };
          contents = JSON.stringify(
            encryption.crypto.encrypt({
              passphrase: mode.passphrase,
              plaintext: new TextEncoder().encode(plaintext),
              profile: encryption.profile,
            }),
          );
        }
        file = await deps.files.create();
        await file.write(contents);
        const readBack = await file.read();
        if (mode.mode === "encrypted") {
          if (!encryption) return { status: "export-failed" };
          if (
            loadBackupForPreview({
              contents: readBack,
              passphrase: mode.passphrase,
              crypto: encryption.crypto,
            }).status !== "ready"
          ) {
            return { status: "export-failed" };
          }
        } else {
          parseBackupManifest(JSON.parse(readBack));
        }
        try {
          if (!(await deps.share.isAvailable())) {
            return { status: "sharing-unavailable" };
          }
          await deps.share.open(file.uri);
          handedOff = true;
          return { status: "shared", skippedPhotos: report.skippedPhotos };
        } catch {
          return { status: "share-failed" };
        }
      } catch (error) {
        if (isBackupTooLargeError(error)) return { status: "too-large" };
        return { status: "export-failed" };
      } finally {
        if (file && !handedOff) {
          try {
            await file.delete();
          } catch {
            /* keep the original result */
          }
        }
        inFlight = false;
      }
    },
    sharePlaintextExport() {
      return this.shareExport({ readableOverride: true });
    },
  };
}

/** One single-flight SAF snapshot. Health persistence deliberately belongs to the caller. */
export function createAutomaticBackupService(
  deps: AutomaticBackupDependencies,
): {
  writeVerifiedSnapshot(): Promise<
    /** `skippedPhotos`: missing or empty photos left out (38.6 D-24/D-29). */
    | { status: "written"; filename: string; skippedPhotos: number }
    | { status: "failed" }
    /** 38.6 D-39: over the encrypted size cap; nothing was written. */
    | { status: "too-large" }
    | { status: "busy" }
    | {
        status: "blocked";
        reason: "passphrase-absent" | "passphrase-unavailable";
      }
  >;
} {
  let inFlight = false;
  return {
    async writeVerifiedSnapshot() {
      if (inFlight) return { status: "busy" } as const;
      inFlight = true;
      try {
        return await withBackupServiceLock(async () => {
          const encryption = deps.encryption;
          const passphrase = encryption?.passphrase ?? {
            status: "absent" as const,
          };
          const mode = resolveWriteEncryptionMode(
            encryption?.enabled ?? false,
            passphrase,
          );
          if (mode.mode === "blocked")
            return { status: "blocked", reason: mode.reason } as const;
          const report = await buildExportReport(deps.exec, {
            exportedAt: deps.exportedAt,
            readPhotoBase64: deps.readPhotoBase64,
          });
          const plaintext = JSON.stringify(report.manifest);
          parseBackupManifest(JSON.parse(plaintext));
          const contents =
            mode.mode === "encrypted"
              ? encryption?.encrypt(plaintext, mode.passphrase)
              : plaintext;
          if (contents === undefined) return { status: "failed" } as const;
          // A readable local name (38.12 D-116), suffixed when this minute's
          // name is already in the folder (D-136). A failed listing only loses
          // the suffix check; it never negates the write.
          let existing: string[] = [];
          try {
            // Display names, never URI segments (38.12 review A-WR-02).
            existing = (await deps.storage.list(deps.directoryUri)).map(
              (entry) => entry.name,
            );
          } catch {
            existing = [];
          }
          const filename = uniqueBackupFileName(
            automaticBackupFileName(deps.now),
            new Set(existing),
          );
          await deps.storage.writeVerified(
            deps.directoryUri,
            filename,
            contents,
          );
          // The just-written snapshot is protected by identity, not clock order:
          // a rollback may make its filename look older than retained snapshots.
          // Only automatic names are pruned; a manual export is never (D-136).
          try {
            const listed = await deps.storage.list(deps.directoryUri);
            await Promise.all(
              listed.map(async ({ uri, name }) => {
                if (
                  name !== filename &&
                  isOwnedAutomaticBackupName(name) &&
                  isExpiredAutomaticBackup(name, deps.retentionDays, deps.now)
                ) {
                  await deps.storage.remove(uri);
                }
              }),
            );
          } catch {
            // Listing/pruning failure never negates a verified write or health.
          }
          return {
            status: "written",
            filename,
            skippedPhotos: report.skippedPhotos,
          } as const;
        });
      } catch (error) {
        if (isBackupTooLargeError(error))
          return { status: "too-large" } as const;
        return { status: "failed" } as const;
      } finally {
        inFlight = false;
      }
    },
  };
}

/**
 * A Replace-all safety snapshot deliberately bypasses the caller's ordinary
 * due/changed policy.  The underlying writer always builds, writes, and reads
 * back a fresh SAF file whenever it is invoked; this named entry point prevents
 * a restore caller from accidentally treating a "not due" decision as safety
 * evidence.
 */
export function createVerifiedPreRestoreSnapshot(
  deps: AutomaticBackupDependencies,
): ReturnType<typeof createAutomaticBackupService>["writeVerifiedSnapshot"] {
  return createAutomaticBackupService(deps).writeVerifiedSnapshot;
}
