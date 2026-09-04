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
  contactLinks: [], customFieldDefs: [], customFieldValues: [], memories: [],
  relationships: [], currentStateEntries: [], tombstones: [],
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
    const pairs = valid(); pairs.contacts = [{ uid: "c", trackingEnabled: 1, intervalDays: 1 }]; pairs.customFieldDefs = [{ uid: "d" }];
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
    broken.contacts = [{ uid: "contact", trackingEnabled: 1, intervalDays: 1, modifiedAt: "2026-08-25 12:00:00" }];
    broken.interactions = [{ uid: "interaction", contactUid: "contact", modifiedAt: "2026-08-25 12:00:00" }];
    broken.tombstones = [{ entityType: "contact", entityUid: "contact", deletedAt: "2026-08-25 12:00:00" }];
    expect(() => parseBackupManifest(broken)).toThrow(/surviving contact/i);
  });

  it("rejects a category reference that cannot be resolved within the backup itself", () => {
    const broken = valid();
    broken.contacts = [{ uid: "contact", trackingEnabled: 1, intervalDays: 1, modifiedAt: "2026-08-25 12:00:00", categoryUid: "missing" }];
    expect(() => parseBackupManifest(broken)).toThrow(/category/i);
  });

  it("rejects malformed photo bytes before an apply can begin", () => {
    const broken = valid();
    broken.contacts = [{ uid: "contact", trackingEnabled: 1, intervalDays: 1, modifiedAt: "2026-08-25 12:00:00", photoBase64: "%%%" }];
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
    expect(parsed.backupFormatVersion).toBe(4);
    expect(parsed.contacts[0]).not.toHaveProperty("phone");
    expect(parsed.contacts[0]).not.toHaveProperty("email");
    expect(parsed.appSettings).toHaveProperty("phoneRegionOverride", null);
    expect(parsed.appSettings).toMatchObject({
      includeUnboundNeverContacted: 0,
      birthdayUnboundEnabled: 1,
    });
    expect(parsed.contacts).toEqual([
      expect.objectContaining({ uid: "contact-a", trackingEnabled: 1, intervalDays: 14 }),
    ]);
    expect(parsed.contactMethods).toEqual([
      expect.objectContaining({ uid: "legacy-method:contact-a:phone", contactUid: "contact-a", methodType: "phone", canonicalRegion: null, label: null }),
      expect.objectContaining({ uid: "legacy-method:contact-a:email", contactUid: "contact-a", methodType: "email", canonicalRegion: null, label: null }),
    ]);
  });

  it("forward-migrates v2 contacts and lifecycle settings to the v3 wire format", () => {
    const legacy = valid();
    legacy.backupFormatVersion = 2;
    legacy.contacts = [{ uid: "contact-a", intervalDays: 7, modifiedAt: "2026-08-25 12:00:00" }];

    const parsed = parseBackupManifest(legacy);

    expect(parsed.backupFormatVersion).toBe(4);
    expect(parsed.contacts).toEqual([
      expect.objectContaining({ uid: "contact-a", trackingEnabled: 1, intervalDays: 7 }),
    ]);
    expect(parsed.appSettings).toMatchObject({
      includeUnboundNeverContacted: 0,
      birthdayUnboundEnabled: 1,
    });
  });

  it("rejects illegal lifecycle and cadence cells before restore planning", () => {
    const invalidContacts = [
      { trackingEnabled: 1, intervalDays: null },
      { trackingEnabled: 1, intervalDays: 0 },
      { trackingEnabled: 1, intervalDays: -1 },
      { trackingEnabled: 1, intervalDays: 1.5 },
      { trackingEnabled: 2, intervalDays: 7 },
    ];

    for (const contact of invalidContacts) {
      const manifest = valid();
      manifest.backupFormatVersion = 3;
      manifest.contacts = [{ uid: "contact-a", modifiedAt: "2026-08-25 12:00:00", ...contact }];
      expect(() => parseBackupManifest(manifest)).toThrow(BackupSchemaError);
    }
  });

  it("rejects malformed cadence and duplicate surviving method primaries before restore", () => {
    const cadence = valid();
    cadence.contacts = [{ uid: "contact-a", trackingEnabled: 1, intervalDays: 0, modifiedAt: "2026-08-25 12:00:00" }];
    expect(() => parseBackupManifest(cadence)).toThrow(BackupSchemaError);

    const primary = valid();
    primary.contacts = [{ uid: "contact-a", trackingEnabled: 1, intervalDays: 7, modifiedAt: "2026-08-25 12:00:00" }];
    primary.contactMethods = [
      { uid: "method-a", contactUid: "contact-a", methodType: "phone", rawValue: "a", displayValue: "a", isActionable: 1, isPrimary: 1, displayOrder: 0, createdAt: "2026-08-25 12:00:00", modifiedAt: "2026-08-25 12:00:00" },
      { uid: "method-b", contactUid: "contact-a", methodType: "phone", rawValue: "b", displayValue: "b", isActionable: 1, isPrimary: 1, displayOrder: 1, createdAt: "2026-08-25 12:00:00", modifiedAt: "2026-08-25 12:00:00" },
    ];
    expect(() => parseBackupManifest(primary)).toThrow(/duplicate surviving primary/i);
  });

  it("rejects malformed normalized tombstone parent combinations before apply", () => {
    const broken = valid();
    broken.contacts = [{ uid: "contact-a", trackingEnabled: 1, intervalDays: 7, modifiedAt: "2026-08-25 12:00:00" }];
    broken.contactMethods = [{ uid: "method-a", contactUid: "contact-a", methodType: "phone", rawValue: "a", displayValue: "a", isActionable: 1, isPrimary: 1, displayOrder: 0, createdAt: "2026-08-25 12:00:00", modifiedAt: "2026-08-25 12:00:00" }];
    broken.contactMethodProvenance = [{ uid: "provenance-a", methodUid: "method-a", externalContactLinkUid: null, sourceMethodId: null, createdAt: "2026-08-25 12:00:00", modifiedAt: "2026-08-25 12:00:00" }];
    broken.tombstones = [{ entityType: "contact_method", entityUid: "method-a", deletedAt: "2026-08-25 12:00:00" }];
    expect(() => parseBackupManifest(broken)).toThrow(/surviving method parent/i);

    broken.tombstones = [{ entityType: "unsupported", entityUid: "method-a", deletedAt: "2026-08-25 12:00:00" }];
    expect(() => parseBackupManifest(broken)).toThrow(BackupSchemaError);
  });
});
