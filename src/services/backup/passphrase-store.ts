/** One device-local SecureStore item; passphrases never enter SQLite or backup models. */
export const BACKUP_PASSPHRASE_ITEM = "orbit.backup.passphrase";
/** Crash-recovery journal for a local, in-progress automatic-backup re-key. */
export const BACKUP_PASSPHRASE_CHANGE_ITEM = "orbit.backup.passphrase-change";

export interface BackupPassphraseBackend {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export type PassphraseReadResult =
  | { status: "present"; passphrase: string }
  | { status: "absent" }
  | { status: "unavailable"; reason: "secure-store-read-failed" };

export interface PendingBackupPassphraseChange {
  readonly oldPassphrase: string;
  readonly nextPassphrase: string;
  readonly replacements: ReadonlyArray<{
    readonly sourceUri: string;
    readonly replacementUri: string;
  }>;
}

export type PendingPassphraseChangeReadResult =
  | { status: "present"; change: PendingBackupPassphraseChange }
  | { status: "absent" }
  | { status: "unavailable"; reason: "secure-store-read-failed" };

export interface BackupPassphraseStore {
  getPassphrase(): Promise<PassphraseReadResult>;
  setPassphrase(passphrase: string): Promise<void>;
  deletePassphrase(): Promise<void>;
}

/** A secret-backed, resumable journal; it never belongs in SQLite or an export. */
export interface BackupPassphraseChangeStore extends BackupPassphraseStore {
  getPendingPassphraseChange(): Promise<PendingPassphraseChangeReadResult>;
  setPendingPassphraseChange(
    change: PendingBackupPassphraseChange,
  ): Promise<void>;
  clearPendingPassphraseChange(): Promise<void>;
}

const nativeBackend: BackupPassphraseBackend = {
  async getItemAsync(key) {
    const secureStore = await import("expo-secure-store");
    return secureStore.getItemAsync(key);
  },
  async setItemAsync(key, value) {
    const secureStore = await import("expo-secure-store");
    await secureStore.setItemAsync(key, value);
  },
  async deleteItemAsync(key) {
    const secureStore = await import("expo-secure-store");
    await secureStore.deleteItemAsync(key);
  },
};

function isPendingChange(
  value: unknown,
): value is PendingBackupPassphraseChange {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.oldPassphrase === "string" &&
    typeof candidate.nextPassphrase === "string" &&
    Array.isArray(candidate.replacements) &&
    candidate.replacements.every(
      (replacement) =>
        !!replacement &&
        typeof replacement === "object" &&
        typeof (replacement as Record<string, unknown>).sourceUri ===
          "string" &&
        typeof (replacement as Record<string, unknown>).replacementUri ===
          "string",
    )
  );
}

export function createBackupPassphraseStore(
  backend: BackupPassphraseBackend = nativeBackend,
): BackupPassphraseChangeStore {
  return {
    async getPassphrase() {
      try {
        const passphrase = await backend.getItemAsync(BACKUP_PASSPHRASE_ITEM);
        return passphrase === null
          ? { status: "absent" }
          : { status: "present", passphrase };
      } catch {
        // This MUST remain distinct from an intentional delete: enabled writes fail closed.
        return { status: "unavailable", reason: "secure-store-read-failed" };
      }
    },
    setPassphrase: (passphrase) =>
      backend.setItemAsync(BACKUP_PASSPHRASE_ITEM, passphrase),
    deletePassphrase: () => backend.deleteItemAsync(BACKUP_PASSPHRASE_ITEM),
    async getPendingPassphraseChange() {
      try {
        const raw = await backend.getItemAsync(BACKUP_PASSPHRASE_CHANGE_ITEM);
        if (raw === null) return { status: "absent" };
        const parsed: unknown = JSON.parse(raw);
        return isPendingChange(parsed)
          ? { status: "present", change: parsed }
          : { status: "unavailable", reason: "secure-store-read-failed" };
      } catch {
        return { status: "unavailable", reason: "secure-store-read-failed" };
      }
    },
    setPendingPassphraseChange: (change) =>
      backend.setItemAsync(
        BACKUP_PASSPHRASE_CHANGE_ITEM,
        JSON.stringify(change),
      ),
    clearPendingPassphraseChange: () =>
      backend.deleteItemAsync(BACKUP_PASSPHRASE_CHANGE_ITEM),
  };
}

export const backupPassphraseStore = createBackupPassphraseStore();
