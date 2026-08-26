import { describe, expect, it } from "vitest";
import { BACKUP_PASSPHRASE_ITEM, createBackupPassphraseStore } from "@/services/backup/passphrase-store";

describe("backup passphrase store", () => {
  it("uses one namespaced SecureStore item and distinguishes present, absent, and unavailable reads", async () => {
    const values = new Map<string, string>();
    const store = createBackupPassphraseStore({
      getItemAsync: async (key) => values.get(key) ?? null,
      setItemAsync: async (key, value) => { values.set(key, value); },
      deleteItemAsync: async (key) => { values.delete(key); },
    });

    await expect(store.getPassphrase()).resolves.toEqual({ status: "absent" });
    await store.setPassphrase("only-in-secure-store");
    await expect(store.getPassphrase()).resolves.toEqual({ status: "present", passphrase: "only-in-secure-store" });
    expect(values.get(BACKUP_PASSPHRASE_ITEM)).toBe("only-in-secure-store");

    const unavailable = createBackupPassphraseStore({
      getItemAsync: async () => { throw new Error("keystore reset"); },
      setItemAsync: async () => {},
      deleteItemAsync: async () => {},
    });
    await expect(unavailable.getPassphrase()).resolves.toEqual({ status: "unavailable", reason: "secure-store-read-failed" });
  });
});
