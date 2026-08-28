import { describe, expect, it } from "vitest";
import { parseBackupManifest } from "@/backup/backup-schema";
import { BACKUP_FORMAT_VERSION, BackupSchemaError } from "@/backup/types";

const valid = (): Record<string, any> => ({
  backupFormatVersion: BACKUP_FORMAT_VERSION,
  envelopeVersion: 1,
  metadata: { exportedAt: "2026-08-25 12:00:00", sqliteUserVersion: 999 },
  appSettings: { sunContactUid: null, modifiedAt: "2026-08-25 12:00:00" },
  categories: [], profile: null, contacts: [], contactMethods: [], externalContactLinks: [],
  contactMethodProvenance: [], interactions: [], events: [], fuel: [],
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
    const pairs = valid(); pairs.contacts = [{ uid: "c", intervalDays: 1 }]; pairs.customFieldDefs = [{ uid: "d" }];
    pairs.customFieldValues = [{ uid: "v1", contactUid: "c", fieldDefUid: "d", value: null }, { uid: "v2", contactUid: "c", fieldDefUid: "d", value: null }];
    expect(() => parseBackupManifest(pairs)).toThrow(/duplicate custom/i);
  });

  it("rejects secret-shaped settings and incomplete singleton settings", () => {
    const secret = valid();
    secret.appSettings.apiKey = "must-never-travel";
    expect(() => parseBackupManifest(secret)).toThrow(/settings/i);

    const incomplete = valid();
    delete incomplete.appSettings.modifiedAt;
    expect(() => parseBackupManifest(incomplete)).toThrow(/modified/i);
  });

  it("rejects a child whose same-file parent lost to a tombstone", () => {
    const broken = valid();
    broken.contacts = [{ uid: "contact", intervalDays: 1, modifiedAt: "2026-08-25 12:00:00" }];
    broken.interactions = [{ uid: "interaction", contactUid: "contact", modifiedAt: "2026-08-25 12:00:00" }];
    broken.tombstones = [{ entityType: "contact", entityUid: "contact", deletedAt: "2026-08-25 12:00:00" }];
    expect(() => parseBackupManifest(broken)).toThrow(/surviving contact/i);
  });

  it("rejects a category reference that cannot be resolved within the backup itself", () => {
    const broken = valid();
    broken.contacts = [{ uid: "contact", intervalDays: 1, modifiedAt: "2026-08-25 12:00:00", categoryUid: "missing" }];
    expect(() => parseBackupManifest(broken)).toThrow(/category/i);
  });

  it("rejects malformed photo bytes before an apply can begin", () => {
    const broken = valid();
    broken.contacts = [{ uid: "contact", intervalDays: 1, modifiedAt: "2026-08-25 12:00:00", photoBase64: "%%%" }];
    expect(() => parseBackupManifest(broken)).toThrow(/photo/i);
  });

  it("forward-migrates scalar v1 contact endpoints into deterministic v2 method rows", () => {
    const legacy = valid();
    legacy.backupFormatVersion = 1;
    legacy.contacts = [{
      uid: "contact-a", name: "Ada", intervalDays: 14,
      phone: "+1 555 0100", email: "ada@example.test", modifiedAt: "2026-08-25 12:00:00",
    }];
    const parsed = parseBackupManifest(legacy) as typeof legacy & {
      contactMethods: Array<Record<string, unknown>>;
    };
    expect(parsed.backupFormatVersion).toBe(2);
    expect(parsed.contacts[0]).not.toHaveProperty("phone");
    expect(parsed.contacts[0]).not.toHaveProperty("email");
    expect(parsed.appSettings).toHaveProperty("phoneRegionOverride", null);
    expect(parsed.contactMethods).toEqual([
      expect.objectContaining({ uid: "legacy-method:contact-a:phone", contactUid: "contact-a", methodType: "phone", canonicalRegion: null, label: null }),
      expect.objectContaining({ uid: "legacy-method:contact-a:email", contactUid: "contact-a", methodType: "email", canonicalRegion: null, label: null }),
    ]);
  });
});
