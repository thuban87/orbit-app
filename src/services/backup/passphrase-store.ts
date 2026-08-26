/** One device-local SecureStore item; passphrases never enter SQLite or backup models. */
export const BACKUP_PASSPHRASE_ITEM = "orbit.backup.passphrase";

export interface BackupPassphraseBackend {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export type PassphraseReadResult =
  | { status: "present"; passphrase: string }
  | { status: "absent" }
  | { status: "unavailable"; reason: "secure-store-read-failed" };

export interface BackupPassphraseStore {
  getPassphrase(): Promise<PassphraseReadResult>;
  setPassphrase(passphrase: string): Promise<void>;
  deletePassphrase(): Promise<void>;
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

export function createBackupPassphraseStore(backend: BackupPassphraseBackend = nativeBackend): BackupPassphraseStore {
  return {
    async getPassphrase() {
      try {
        const passphrase = await backend.getItemAsync(BACKUP_PASSPHRASE_ITEM);
        return passphrase === null ? { status: "absent" } : { status: "present", passphrase };
      } catch {
        // This MUST remain distinct from an intentional delete: enabled writes fail closed.
        return { status: "unavailable", reason: "secure-store-read-failed" };
      }
    },
    setPassphrase: (passphrase) => backend.setItemAsync(BACKUP_PASSPHRASE_ITEM, passphrase),
    deletePassphrase: () => backend.deleteItemAsync(BACKUP_PASSPHRASE_ITEM),
  };
}

export const backupPassphraseStore = createBackupPassphraseStore();
