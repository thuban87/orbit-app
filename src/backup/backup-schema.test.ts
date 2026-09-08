import { describe, expect, it } from "vitest";
import {
  parseBackupManifest,
  PORTABLE_SETTINGS_KEYS,
} from "@/backup/backup-schema";
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

describe("dashboard preference portable allowlist", () => {
  it("allowlists the future format-5 dashboard keys", () => {
    for (const key of ["dashboardViewMode", "dashboardPopulations", "dashboardFilters", "dashboardSort"]) {
      expect(PORTABLE_SETTINGS_KEYS.has(key)).toBe(true);
    }
  });

  it("accepts the deferred right-swipe key while rejecting unknown siblings", () => {
    const portable = valid();
    portable.appSettings.dashboardRightSwipeAction = "quick-log";
    expect(parseBackupManifest(portable).appSettings).toHaveProperty(
      "dashboardRightSwipeAction",
      "quick-log",
    );

    portable.appSettings.unrecognizedSibling = "nope";
    expect(() => parseBackupManifest(portable)).toThrow(BackupSchemaError);
  });
});

describe("Systems restore acceptance (declare-only)", () => {
  it("accepts a custom System token while rejecting malformed System tokens", () => {
    const custom = valid();
    custom.appSettings.orreryLastSystem = "custom:abc123";
    expect(parseBackupManifest(custom).appSettings).toHaveProperty(
      "orreryLastSystem",
      "custom:abc123",
    );

    const malformed = valid();
    malformed.appSettings.orreryLastSystem = "custom:bad\nuid";
    expect(() => parseBackupManifest(malformed)).toThrow(
      "appSettings has an invalid Orrery preference",
    );
  });
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

  it("accepts Memory and relationship tombstones", () => {
    const manifest = valid();
    manifest.tombstones = [
      { entityType: "memory", entityUid: "memory-a", deletedAt: "2026-08-25 12:00:00" },
      { entityType: "relationship", entityUid: "relationship-a", deletedAt: "2026-08-25 12:00:00" },
      { entityType: "current_state_entry", entityUid: "current-state-a", deletedAt: "2026-08-25 12:00:00" },
    ];

    expect(parseBackupManifest(manifest).tombstones).toEqual(manifest.tombstones);
  });

  it("rejects knowledge rows outside the application-owned registry contracts", () => {
    const knowledgeManifest = () => {
      const manifest = valid();
      manifest.contacts = [
        {
          uid: "contact-a",
          trackingEnabled: 1,
          intervalDays: 7,
          modifiedAt: "2026-08-25 12:00:00",
        },
      ];
      manifest.memories = [
        {
          uid: "memory-a",
          contactUid: "contact-a",
          type: "general",
          customLabel: null,
          value: "Remember this",
          note: null,
          url: null,
          meaningfulDate: null,
          pinned: 0,
          outdated: 0,
          hidden: null,
          provenance: "user",
          createdAt: "2026-08-25 12:00:00",
          modifiedAt: "2026-08-25 12:00:00",
          deletedAt: null,
        },
      ];
      manifest.currentStateEntries = [
        {
          uid: "state-a",
          contactUid: "contact-a",
          fieldKey: "current_location",
          value: "Chicago",
          isCurrent: 1,
          createdAt: "2026-08-25 12:00:00",
          modifiedAt: "2026-08-25 12:00:00",
        },
      ];
      return manifest;
    };

    for (const patch of [
      { type: "future_memory" },
      { type: "custom", customLabel: "  " },
      { value: " \t" },
      { pinned: 2 },
      { outdated: -1 },
      { hidden: 2 },
      { provenance: "remote" },
    ]) {
      const manifest = knowledgeManifest();
      Object.assign(manifest.memories[0], patch);
      expect(() => parseBackupManifest(manifest)).toThrow(BackupSchemaError);
    }

    const unknownField = knowledgeManifest();
    unknownField.currentStateEntries[0].fieldKey = "future_state";
    expect(() => parseBackupManifest(unknownField)).toThrow(BackupSchemaError);

    const blankValue = knowledgeManifest();
    blankValue.currentStateEntries[0].value = " \t\n ";
    expect(() => parseBackupManifest(blankValue)).toThrow(
      "currentStateEntries has a blank value",
    );
  });

  it("rejects non-text relationship optional fields before restore", () => {
    const relationshipManifest = () => {
      const manifest = valid();
      manifest.contacts = [
        {
          uid: "contact-a",
          trackingEnabled: 1,
          intervalDays: 7,
          modifiedAt: "2026-08-25 12:00:00",
        },
      ];
      manifest.relationships = [
        {
          uid: "relationship-a",
          contactUid: "contact-a",
          personName: "Alex",
          relationType: null,
          note: null,
          pinned: 0,
          hidden: null,
          createdAt: "2026-08-25 12:00:00",
          modifiedAt: "2026-08-25 12:00:00",
          deletedAt: null,
        },
      ];
      return manifest;
    };

    for (const patch of [
      { relationType: 12 },
      { note: {} },
      { deletedAt: false },
    ]) {
      const manifest = relationshipManifest();
      Object.assign(manifest.relationships[0], patch);
      expect(() => parseBackupManifest(manifest)).toThrow(BackupSchemaError);
    }
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

  it("normalizes a missing customFieldValueHistory array to [] for pre-existing format-4 backups (P07-MED)", () => {
    // A live format-4 backup that predates this phase carries no
    // customFieldValueHistory key. There is no 4->4 forward migration, so the
    // ONLY thing that keeps validate() from hard-failing is the ?? [] default.
    const older = valid();
    expect(older).not.toHaveProperty("customFieldValueHistory");
    const parsed = parseBackupManifest(older);
    expect(parsed.customFieldValueHistory).toEqual([]);
  });

  it("validates the scope-branching custom_field_defs fields at the parse boundary (WR-01)", () => {
    const withDef = (def: Record<string, unknown>): Record<string, any> => {
      const m = valid();
      m.customFieldDefs = [{ uid: "def-a", modifiedAt: "2026-08-25 12:00:00", ...def }];
      return m;
    };
    // A malformed scope must fail before it can silently bypass the completeness guard.
    expect(() => parseBackupManifest(withDef({ scope: "Global" }))).toThrow(/scope/i);
    expect(() => parseBackupManifest(withDef({ scope: 1 }))).toThrow(/scope/i);
    // Wrong-typed history_retained / field_group fail as a clean parse error, not a bind rollback.
    expect(() => parseBackupManifest(withDef({ historyRetained: 2 }))).toThrow(/history_retained/i);
    expect(() => parseBackupManifest(withDef({ fieldGroup: 5 }))).toThrow(/field_group/i);
    // The legitimate contact scope, and absent/null values from older backups, still pass.
    expect(() => parseBackupManifest(withDef({ scope: "contact", historyRetained: 1, fieldGroup: "Work" }))).not.toThrow();
    expect(() => parseBackupManifest(withDef({}))).not.toThrow();
  });

  it("round-trips and validates custom_field_value_history rows and their tombstone", () => {
    const manifest = valid();
    manifest.contacts = [{ uid: "contact-a", trackingEnabled: 1, intervalDays: 7, modifiedAt: "2026-08-25 12:00:00" }];
    manifest.customFieldDefs = [{ uid: "def-a", modifiedAt: "2026-08-25 12:00:00" }];
    manifest.customFieldValues = [{ uid: "value-a", contactUid: "contact-a", fieldDefUid: "def-a", value: null }];
    manifest.customFieldValueHistory = [
      { uid: "history-a", contactUid: "contact-a", fieldDefUid: "def-a", value: "Old", createdAt: "2026-08-25 12:00:00", modifiedAt: "2026-08-25 12:00:00" },
    ];
    manifest.tombstones = [{ entityType: "custom_field_value_history", entityUid: "history-b", deletedAt: "2026-08-25 12:00:00" }];
    const parsed = parseBackupManifest(manifest);
    expect(parsed.customFieldValueHistory).toEqual([
      expect.objectContaining({ uid: "history-a", contactUid: "contact-a", fieldDefUid: "def-a", value: "Old" }),
    ]);
    expect(parsed.tombstones).toEqual([
      { entityType: "custom_field_value_history", entityUid: "history-b", deletedAt: "2026-08-25 12:00:00" },
    ]);
  });

  it("rejects a value-history row whose fieldDefUid or contactUid is unknown to the manifest", () => {
    const base = () => {
      const manifest = valid();
      manifest.contacts = [{ uid: "contact-a", trackingEnabled: 1, intervalDays: 7, modifiedAt: "2026-08-25 12:00:00" }];
      manifest.customFieldDefs = [{ uid: "def-a" }];
      manifest.customFieldValues = [{ uid: "value-a", contactUid: "contact-a", fieldDefUid: "def-a", value: null }];
      return manifest;
    };
    const badDef = base();
    badDef.customFieldValueHistory = [{ uid: "history-a", contactUid: "contact-a", fieldDefUid: "ghost-def", value: "Old", createdAt: "2026-08-25 12:00:00", modifiedAt: "2026-08-25 12:00:00" }];
    expect(() => parseBackupManifest(badDef)).toThrow(/customFieldValueHistory has an unknown field definition UID/);

    const badContact = base();
    badContact.customFieldValueHistory = [{ uid: "history-a", contactUid: "ghost-contact", fieldDefUid: "def-a", value: "Old", createdAt: "2026-08-25 12:00:00", modifiedAt: "2026-08-25 12:00:00" }];
    expect(() => parseBackupManifest(badContact)).toThrow(/customFieldValueHistory has an unknown contact UID/);
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
