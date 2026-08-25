import { describe, expect, it } from "vitest";
import { parseBackupManifest } from "@/backup/backup-schema";
import { BACKUP_FORMAT_VERSION, BackupSchemaError } from "@/backup/types";

const valid = (): Record<string, any> => ({
  backupFormatVersion: BACKUP_FORMAT_VERSION,
  envelopeVersion: 1,
  metadata: { exportedAt: "2026-08-25 12:00:00", sqliteUserVersion: 999 },
  appSettings: { sunContactUid: null, modifiedAt: "2026-08-25 12:00:00" },
  categories: [], profile: null, contacts: [], interactions: [], events: [], fuel: [],
  contactLinks: [], customFieldDefs: [], customFieldValues: [], tombstones: [],
});

describe("parseBackupManifest", () => {
  it("accepts a different SQLite schema version because backupFormatVersion alone gates compatibility", () => {
    expect(parseBackupManifest(valid()).metadata.sqliteUserVersion).toBe(999);
  });

  it("rejects only a future portable format with the update-first message", () => {
    const future = valid(); future.backupFormatVersion = BACKUP_FORMAT_VERSION + 1;
    expect(() => parseBackupManifest(future)).toThrow(/update.*app/i);
  });

  it("rejects duplicate UIDs, dangling settings references, and duplicate custom-value pairs", () => {
    const duplicate = valid(); duplicate.contacts = [{ uid: "c" }, { uid: "c" }];
    expect(() => parseBackupManifest(duplicate)).toThrow(BackupSchemaError);
    const dangling = valid(); dangling.appSettings.sunContactUid = "missing";
    expect(() => parseBackupManifest(dangling)).toThrow(/sun/i);
    const pairs = valid(); pairs.contacts = [{ uid: "c" }]; pairs.customFieldDefs = [{ uid: "d" }];
    pairs.customFieldValues = [{ uid: "v1", contactUid: "c", fieldDefUid: "d", value: null }, { uid: "v2", contactUid: "c", fieldDefUid: "d", value: null }];
    expect(() => parseBackupManifest(pairs)).toThrow(/duplicate custom/i);
  });
});
