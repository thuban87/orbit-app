import { parseBackupManifest, UPDATE_FIRST_MESSAGE } from "@/backup/backup-schema";
import { buildExportManifest } from "@/backup/export-manifest";
import type { BackupEncryptionProfile, BackupManifest } from "@/backup/types";
import { BackupEnvelopeError, type BackupEnvelopeCrypto } from "@/services/backup/encryption";
import { automaticBackupFilename, isExpiredAutomaticBackup, isOwnedAutomaticBackup } from "@/backup/auto-backup-policy";
import type { SqlExecutor } from "@/db/types";
import type { SafReadableStorage, SafStorage } from "@/services/backup/saf-storage";
import { SafWriteError } from "@/services/backup/saf-write-error";
import type {
  BackupPassphraseChangeStore,
  BackupPassphraseStore,
  PassphraseReadResult,
  PendingBackupPassphraseChange,
} from "@/services/backup/passphrase-store";
import { Logger } from "@/utils/logger";

export type BackupPreview = {
  exportedAt: string;
  backupFormatVersion: number;
  encrypted: boolean;
  rowCount: number;
  photoCount: number;
};

export type BackupPreviewResult =
  | { status: "ready"; preview: BackupPreview }
  | { status: "failed"; reason: "wrong-passphrase" | "damaged-or-incomplete" | "newer-app" };

export type RestorePreviewAggregate = BackupPreview & {
  contactCount: number;
  relatedRowCount: number;
  tombstoneCount: number;
};

/** A validated restore candidate remains private to the apply owner, never navigation. */
export type ValidatedRestoreCandidate =
  | { status: "ready"; preview: RestorePreviewAggregate; manifest: BackupManifest }
  | { status: "failed"; reason: "wrong-passphrase" | "damaged-or-incomplete" | "newer-app" };

/**
 * The write-free restore boundary. It deliberately returns aggregate data only:
 * callers retain the validated manifest privately until a later explicit apply.
 */
export function loadBackupForRestore(input: {
  contents: string;
  passphrase?: string;
  crypto?: BackupEnvelopeCrypto;
}): ValidatedRestoreCandidate {
  try {
    let raw: unknown = JSON.parse(input.contents);
    let encrypted = false;
    if (raw && typeof raw === "object" && (raw as Record<string, unknown>).encrypted === true) {
      if (!input.crypto || !input.passphrase) return { status: "failed", reason: "wrong-passphrase" };
      const decrypted = input.crypto.decrypt({ passphrase: input.passphrase, envelope: raw });
      raw = JSON.parse(new TextDecoder().decode(decrypted));
      encrypted = true;
    }
    const manifest = parseBackupManifest(raw);
    const rows = [manifest.categories, manifest.contacts, manifest.interactions, manifest.events,
      manifest.fuel, manifest.contactLinks, manifest.customFieldDefs, manifest.customFieldValues, manifest.tombstones];
    const photoRows = [manifest.profile, ...manifest.contacts, ...manifest.customFieldValues];
    return {
      status: "ready",
      manifest,
      preview: {
        exportedAt: manifest.metadata.exportedAt,
        backupFormatVersion: manifest.backupFormatVersion,
        encrypted,
        rowCount: rows.reduce((count, value) => count + value.length, manifest.profile ? 1 : 0),
        photoCount: photoRows.filter((row) => row?.photoBase64 !== null && row?.photoBase64 !== undefined).length,
        contactCount: manifest.contacts.length,
        relatedRowCount: manifest.interactions.length + manifest.events.length + manifest.fuel.length + manifest.contactLinks.length + manifest.customFieldDefs.length + manifest.customFieldValues.length,
        tombstoneCount: manifest.tombstones.length,
      },
    };
  } catch (error) {
    if (error instanceof BackupEnvelopeError && error.code === "authentication-failed") {
      return { status: "failed", reason: "wrong-passphrase" };
    }
    if (error instanceof Error && error.message === UPDATE_FIRST_MESSAGE) {
      return { status: "failed", reason: "newer-app" };
    }
    return { status: "failed", reason: "damaged-or-incomplete" };
  }
}

/** Compatibility-safe aggregate-only preview API for callers that never apply. */
export function loadBackupForPreview(input: {
  contents: string;
  passphrase?: string;
  crypto?: BackupEnvelopeCrypto;
}): BackupPreviewResult {
  const candidate = loadBackupForRestore(input);
  return candidate.status === "ready"
    ? { status: "ready", preview: {
      exportedAt: candidate.preview.exportedAt,
      backupFormatVersion: candidate.preview.backupFormatVersion,
      encrypted: candidate.preview.encrypted,
      rowCount: candidate.preview.rowCount,
      photoCount: candidate.preview.photoCount,
    } }
    : candidate;
}

export type WriteEncryptionMode =
  | { mode: "plaintext" }
  | { mode: "encrypted"; passphrase: string }
  | { mode: "blocked"; reason: "passphrase-absent" | "passphrase-unavailable" };

/** Never infer the durable setting from the SecureStore cache state. */
export function resolveWriteEncryptionMode(enabled: boolean, passphrase: PassphraseReadResult): WriteEncryptionMode {
  if (!enabled) return { mode: "plaintext" };
  if (passphrase.status === "present") return { mode: "encrypted", passphrase: passphrase.passphrase };
  return { mode: "blocked", reason: passphrase.status === "absent" ? "passphrase-absent" : "passphrase-unavailable" };
}

let backupServiceQueue: Promise<void> = Promise.resolve();

/** Serialize destination writes and passphrase lifecycle work within this app process. */
export function withBackupServiceLock<T>(operation: () => Promise<T>): Promise<T> {
  const next = backupServiceQueue.then(operation, operation);
  backupServiceQueue = next.then(() => undefined, () => undefined);
  return next;
}

export interface EncryptionFlagStore {
  getEncryptionEnabled(): Promise<boolean>;
  setEncryptionEnabled(enabled: boolean): Promise<void>;
}

export type EncryptionLifecycleResult =
  | { status: "enabled" }
  | { status: "disabled" }
  | { status: "needs-attention"; reason: "passphrase-absent" | "passphrase-unavailable" | "flag-update-failed" }
  | { status: "failed"; reason: "passphrase-write-failed" | "passphrase-delete-failed" | "flag-update-failed" }
  | { status: "normal" };

/**
 * Explicit cross-store sagas. No operation silently changes the flag in
 * response to a SecureStore failure; contradictory states stay fail-closed.
 */
export function createBackupEncryptionLifecycle(passphrases: BackupPassphraseStore, flags: EncryptionFlagStore) {
  return {
    enable: (passphrase: string): Promise<EncryptionLifecycleResult> => withBackupServiceLock(async () => {
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
        try { await passphrases.deletePassphrase(); } catch { /* orphan is swept at launch */ }
        return { status: "failed", reason: "flag-update-failed" };
      }
    }),
    disable: (confirmed: boolean): Promise<EncryptionLifecycleResult> => withBackupServiceLock(async () => {
      if (!confirmed) return { status: "failed", reason: "passphrase-delete-failed" };
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
      const [enabled, passphrase] = await Promise.all([flags.getEncryptionEnabled(), passphrases.getPassphrase()]);
      if (!enabled) {
        if (passphrase.status === "present") {
          try { await passphrases.deletePassphrase(); } catch { /* plaintext remains safe */ }
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
  | { status: "needs-recovery" };

interface AutomaticBackupReencryptionDependencies {
  readonly directoryUri: string;
  readonly now: Date;
  readonly crypto: BackupEnvelopeCrypto;
  readonly profile: BackupEncryptionProfile;
  readonly passphrases: BackupPassphraseChangeStore;
  readonly storage: SafReadableStorage;
}

function ownedName(uri: string): string {
  return decodeURIComponent(uri).split("/").pop() ?? "";
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
    change: (input) => withBackupServiceLock(async () => {
      const active = await deps.passphrases.getPassphrase();
      if (active.status !== "present") return { status: "needs-attention" };
      if (active.passphrase !== input.currentPassphrase) {
        return { status: "wrong-current-passphrase" };
      }

      let pending: PendingBackupPassphraseChange;
      const pendingRead = await deps.passphrases.getPendingPassphraseChange();
      if (pendingRead.status === "unavailable") return { status: "needs-attention" };
      if (pendingRead.status === "present") {
        if (
          pendingRead.change.oldPassphrase !== input.currentPassphrase
          || pendingRead.change.nextPassphrase !== input.nextPassphrase
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
        const uris = (await deps.storage.list(deps.directoryUri))
          .filter((uri) => isOwnedAutomaticBackup(ownedName(uri)));
        const replacementUris = new Set(
          pending.replacements.map((replacement) => replacement.replacementUri),
        );
        const sourceUris = uris.filter((uri) => !replacementUris.has(uri));
        let reencryptedCount = 0;

        for (const [index, sourceUri] of sourceUris.entries()) {
          const prior = pending.replacements.find(
            (replacement) => replacement.sourceUri === sourceUri,
          );
          if (prior) {
            const replacementContents = await deps.storage.read(prior.replacementUri);
            const replacementEnvelope: unknown = JSON.parse(replacementContents);
            const replacementPlaintext = deps.crypto.decrypt({
              passphrase: pending.nextPassphrase,
              envelope: replacementEnvelope,
            });
            parseBackupManifest(JSON.parse(new TextDecoder().decode(replacementPlaintext)));
            await deps.storage.remove(sourceUri);
            continue;
          }

          const sourceContents = await deps.storage.read(sourceUri);
          const sourceEnvelope: unknown = JSON.parse(sourceContents);
          const sourcePlaintext = sourceEnvelope
            && typeof sourceEnvelope === "object"
            && (sourceEnvelope as Record<string, unknown>).encrypted === true
            ? deps.crypto.decrypt({
                passphrase: pending.oldPassphrase,
                envelope: sourceEnvelope,
              })
            : new TextEncoder().encode(sourceContents);
          parseBackupManifest(JSON.parse(new TextDecoder().decode(sourcePlaintext)));

          const replacementContents = JSON.stringify(
            deps.crypto.encrypt({
              passphrase: pending.nextPassphrase,
              plaintext: sourcePlaintext,
              profile: deps.profile,
            }),
          );
          const replacementUri = await deps.storage.writeVerified(
            deps.directoryUri,
            automaticBackupFilename(new Date(deps.now.getTime() + index + 1)),
            replacementContents,
          );
          const verifiedReplacement: unknown = JSON.parse(
            await deps.storage.read(replacementUri),
          );
          const verifiedPlaintext = deps.crypto.decrypt({
            passphrase: pending.nextPassphrase,
            envelope: verifiedReplacement,
          });
          parseBackupManifest(JSON.parse(new TextDecoder().decode(verifiedPlaintext)));

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
      } catch {
        // The journal and old active secret stay intact so the exact operation
        // can be resumed after SAF/keystore recovery; no source is removed
        // until a replacement has independently decrypted and parsed.
        return { status: "needs-recovery" };
      }
    }),
  };
}

export interface LocalExportFile {
  readonly uri: string;
  write(contents: string): Promise<void>;
  read(): Promise<string>;
}

export interface LocalExportFiles {
  create(): Promise<LocalExportFile>;
}

export interface ExportShareAdapter {
  isAvailable(): Promise<boolean>;
  open(uri: string): Promise<void>;
}

export type ManualExportResult =
  | { status: "shared" }
  | { status: "busy" }
  | { status: "sharing-unavailable" }
  | { status: "share-failed" }
  | { status: "export-failed" };

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
  /** Temporary redacted native-log diagnostics for a destructive restore boundary. */
  diagnosticScope?: "pre-restore-snapshot";
}

type PreRestoreSnapshotDiagnosticCode =
  | "snapshot-export"
  | "encryption"
  | "passphrase-absent"
  | "passphrase-unavailable"
  | "saf-create"
  | "saf-write"
  | "saf-read-back"
  | "retention"
  | "unclassified";

class AutomaticSnapshotStageError extends Error {
  constructor(readonly code: PreRestoreSnapshotDiagnosticCode) {
    super("automatic snapshot stage failed");
  }
}

async function atAutomaticSnapshotStage<T>(
  code: PreRestoreSnapshotDiagnosticCode,
  operation: () => Promise<T> | T,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AutomaticSnapshotStageError || error instanceof SafWriteError) throw error;
    throw new AutomaticSnapshotStageError(code);
  }
}

function automaticSnapshotFailureCode(error: unknown): PreRestoreSnapshotDiagnosticCode {
  if (error instanceof AutomaticSnapshotStageError) return error.code;
  if (error instanceof SafWriteError) return `saf-${error.stage}`;
  return "unclassified";
}

function logPreRestoreSnapshotDiagnostic(
  scope: AutomaticBackupDependencies["diagnosticScope"],
  code: PreRestoreSnapshotDiagnosticCode,
): void {
  if (scope) Logger.diagnostic("backup-snapshot", `${scope}:${code}`);
}

/**
 * Creates the manual-only path. It intentionally never reads or writes backup
 * folder/health metadata: opening a share sheet is not automatic protection.
 */
export function createManualExportService(deps: ManualExportDependencies): {
  shareExport(options?: { readableOverride?: boolean }): Promise<ManualExportResult>;
  sharePlaintextExport(): Promise<ManualExportResult>;
} {
  let inFlight = false;
  return {
    async shareExport(options = {}): Promise<ManualExportResult> {
      if (inFlight) return { status: "busy" };
      inFlight = true;
      try {
        const encryption = deps.encryption;
        const mode = resolveWriteEncryptionMode(
          encryption?.enabled === true && !options.readableOverride,
          encryption?.passphrase ?? { status: "absent" },
        );
        if (mode.mode === "blocked") return { status: "export-failed" };
        const manifest = await buildExportManifest(deps.exec, {
          exportedAt: deps.exportedAt,
          readPhotoBase64: deps.readPhotoBase64,
        });
        const plaintext = JSON.stringify(manifest);
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
        const file = await deps.files.create();
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
          return { status: "shared" };
        } catch {
          return { status: "share-failed" };
        }
      } catch {
        return { status: "export-failed" };
      } finally {
        inFlight = false;
      }
    },
    sharePlaintextExport() {
      return this.shareExport({ readableOverride: true });
    },
  };
}

/** One single-flight SAF snapshot. Health persistence deliberately belongs to the caller. */
export function createAutomaticBackupService(deps: AutomaticBackupDependencies): {
  writeVerifiedSnapshot(): Promise<{ status: "written"; filename: string } | { status: "failed" } | { status: "busy" } | { status: "blocked"; reason: "passphrase-absent" | "passphrase-unavailable" }>;
} {
  let inFlight = false;
  return {
    async writeVerifiedSnapshot() {
      if (inFlight) return { status: "busy" } as const;
      inFlight = true;
      try {
        return await withBackupServiceLock(async () => {
        const encryption = deps.encryption;
        const passphrase = encryption?.passphrase ?? { status: "absent" as const };
        const mode = resolveWriteEncryptionMode(encryption?.enabled ?? false, passphrase);
        if (mode.mode === "blocked") {
          logPreRestoreSnapshotDiagnostic(deps.diagnosticScope, mode.reason);
          return { status: "blocked", reason: mode.reason } as const;
        }
        const manifest = await atAutomaticSnapshotStage("snapshot-export", () =>
          buildExportManifest(deps.exec, { exportedAt: deps.exportedAt, readPhotoBase64: deps.readPhotoBase64 }),
        );
        const plaintext = await atAutomaticSnapshotStage("snapshot-export", () => {
          const value = JSON.stringify(manifest);
          parseBackupManifest(JSON.parse(value));
          return value;
        });
        const contents = mode.mode === "encrypted"
          ? await atAutomaticSnapshotStage("encryption", () => encryption?.encrypt(plaintext, mode.passphrase))
          : plaintext;
        if (contents === undefined) {
          logPreRestoreSnapshotDiagnostic(deps.diagnosticScope, "encryption");
          return { status: "failed" } as const;
        }
        const filename = automaticBackupFilename(deps.now);
        await atAutomaticSnapshotStage("saf-write", () =>
          deps.storage.writeVerified(deps.directoryUri, filename, contents),
        );
        // The just-written snapshot is protected by identity, not clock order:
        // a rollback may make its filename look older than retained snapshots.
        try {
          const listed = await deps.storage.list(deps.directoryUri);
          await Promise.all(listed.map(async (uri) => {
            const name = decodeURIComponent(uri).split("/").pop() ?? "";
            if (name !== filename && isOwnedAutomaticBackup(name) && isExpiredAutomaticBackup(name, deps.retentionDays, deps.now)) {
              await deps.storage.remove(uri);
            }
          }));
        } catch {
          // Listing/pruning failure never negates a verified write or health.
          logPreRestoreSnapshotDiagnostic(deps.diagnosticScope, "retention");
        }
        return { status: "written", filename } as const;
        });
      } catch (error) {
        logPreRestoreSnapshotDiagnostic(
          deps.diagnosticScope,
          automaticSnapshotFailureCode(error),
        );
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
  return createAutomaticBackupService({
    ...deps,
    diagnosticScope: "pre-restore-snapshot",
  }).writeVerifiedSnapshot;
}
