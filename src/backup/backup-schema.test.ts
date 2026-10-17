import { describe, expect, it } from "vitest";
import {
  PORTABLE_SETTINGS_KEYS,
  parseBackupManifest,
  UPDATE_FIRST_MESSAGE,
} from "@/backup/backup-schema";
import { BACKUP_FORMAT_VERSION, BackupSchemaError } from "@/backup/types";

const valid = (): Record<string, any> => ({
  backupFormatVersion: BACKUP_FORMAT_VERSION,
  envelopeVersion: 1,
  metadata: { exportedAt: "2026-08-25 12:00:00", sqliteUserVersion: 999 },
  appSettings: { sunContactUid: null, modifiedAt: "2026-08-25 12:00:00" },
  categories: [],
  profile: null,
  contacts: [],
  contactMethods: [],
  externalContactLinks: [],
  contactMethodProvenance: [],
  interactions: [],
  events: [],
  offLimits: [],
  contactLinks: [],
  customFieldDefs: [],
  customFieldValues: [],
  memories: [],
  relationships: [],
  currentStateEntries: [],
  tombstones: [],
  systems: [],
  systemRules: [],
  systemOverrides: [],
  systemPrefs: [],
  profileLayoutTemplates: [],
  profileBackgroundTemplates: [],
  aiConnections: [],
  personalizationSections: [],
  groupEvents: [],
  profileContactPresentation: [],
  profileCategoryPresentation: [],
});

describe("dashboard preference portable allowlist", () => {
  it("allowlists the future format-5 dashboard keys", () => {
    for (const key of [
      "dashboardViewMode",
      "dashboardPopulations",
      "dashboardFilters",
      "dashboardSort",
    ]) {
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

describe("format v6 category deletion evidence", () => {
  it("accepts category tombstones and rejects a category child whose parent is deleted", () => {
    const manifest = valid();
    manifest.categories = [
      { uid: "friends", name: "Friends", modifiedAt: "2026-08-25 11:00:00" },
    ];
    manifest.tombstones = [
      {
        entityType: "category",
        entityUid: "friends",
        deletedAt: "2026-08-25 12:00:00",
      },
    ];
    expect(parseBackupManifest(manifest).tombstones).toEqual(
      manifest.tombstones,
    );

    manifest.contacts = [
      {
        uid: "contact",
        trackingEnabled: 1,
        intervalDays: 7,
        categoryUid: "friends",
        modifiedAt: "2026-08-25 12:00:00",
      },
    ];
    expect(() => parseBackupManifest(manifest)).toThrow(/surviving category/i);
  });

  it("rejects normalized visible-name collisions across categories and Systems", () => {
    const manifest = valid();
    manifest.categories = [
      {
        uid: "friends",
        name: "  Cafe\u0301  ",
        modifiedAt: "2026-08-25 12:00:00",
      },
    ];
    manifest.systems = [
      { uid: "system", name: "CAFÉ", modifiedAt: "2026-08-25 12:00:00" },
    ];
    expect(() => parseBackupManifest(manifest)).toThrow(/visible name/i);
  });
});

describe("default interaction channel portable allowlist (declare-only, CAPT-11)", () => {
  it("allowlists both camelCase MANIFEST keys, NOT the snake_case columns", () => {
    // camelCase MANIFEST keys match COLUMN_OF's key side + the restore cast; the
    // snake_case column names would pass .has() nowhere and drop at restore (HIGH #2).
    for (const key of [
      "defaultInteractionChannel",
      "rememberedInteractionChannel",
    ]) {
      expect(PORTABLE_SETTINGS_KEYS.has(key)).toBe(true);
    }
    for (const key of [
      "default_interaction_channel",
      "remembered_interaction_channel",
    ]) {
      expect(PORTABLE_SETTINGS_KEYS.has(key)).toBe(false);
    }
  });

  it("accepts the deferred camelCase channel keys while rejecting unknown siblings", () => {
    const portable = valid();
    portable.appSettings.defaultInteractionChannel = "Call";
    portable.appSettings.rememberedInteractionChannel = "In Person";
    expect(parseBackupManifest(portable).appSettings).toMatchObject({
      defaultInteractionChannel: "Call",
      rememberedInteractionChannel: "In Person",
    });
    portable.appSettings.unrecognizedSibling = "nope";
    expect(() => parseBackupManifest(portable)).toThrow(BackupSchemaError);
  });

  it("rejects an out-of-vocabulary channel value at the parse boundary", () => {
    const badDefault = valid();
    badDefault.appSettings.defaultInteractionChannel = "bogus";
    expect(() => parseBackupManifest(badDefault)).toThrow(
      /invalid interaction channel/i,
    );
    // 'remember' is a valid DEFAULT sentinel but NOT a valid remembered value.
    const badRemembered = valid();
    badRemembered.appSettings.rememberedInteractionChannel = "remember";
    expect(() => parseBackupManifest(badRemembered)).toThrow(
      /invalid interaction channel/i,
    );
  });

  it("does not inject the channel keys when a manifest omits them (parser adds nothing)", () => {
    const parsed = parseBackupManifest(valid());
    expect(parsed.appSettings).not.toHaveProperty("defaultInteractionChannel");
    expect(parsed.appSettings).not.toHaveProperty(
      "rememberedInteractionChannel",
    );
  });
});

describe("compose message mode portable allowlist (declare-only, COMP-02)", () => {
  it("allowlists both camelCase MANIFEST keys, NOT the snake_case columns", () => {
    for (const key of ["defaultMessageMode", "rememberedMessageMode"]) {
      expect(PORTABLE_SETTINGS_KEYS.has(key)).toBe(true);
    }
    for (const key of ["default_message_mode", "remembered_message_mode"]) {
      expect(PORTABLE_SETTINGS_KEYS.has(key)).toBe(false);
    }
  });

  it("accepts the deferred camelCase message-mode keys while rejecting unknown siblings", () => {
    const portable = valid();
    portable.appSettings.defaultMessageMode = "remember";
    portable.appSettings.rememberedMessageMode = "email";
    expect(parseBackupManifest(portable).appSettings).toMatchObject({
      defaultMessageMode: "remember",
      rememberedMessageMode: "email",
    });
    portable.appSettings.unrecognizedSibling = "nope";
    expect(() => parseBackupManifest(portable)).toThrow(BackupSchemaError);
  });

  it("rejects an out-of-vocabulary message mode value at the parse boundary", () => {
    const badDefault = valid();
    badDefault.appSettings.defaultMessageMode = "sms";
    expect(() => parseBackupManifest(badDefault)).toThrow(
      /invalid message mode/i,
    );
    // CR-01: 'remember' is a valid DEFAULT sentinel but NOT a valid remembered
    // value — the CHECK-free remembered_message_mode column must reject it here.
    const badRemembered = valid();
    badRemembered.appSettings.rememberedMessageMode = "remember";
    expect(() => parseBackupManifest(badRemembered)).toThrow(
      /invalid message mode/i,
    );
  });

  it("does not inject the message-mode keys when a manifest omits them (parser adds nothing)", () => {
    const parsed = parseBackupManifest(valid());
    expect(parsed.appSettings).not.toHaveProperty("defaultMessageMode");
    expect(parsed.appSettings).not.toHaveProperty("rememberedMessageMode");
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

describe("Profile presentation restore acceptance", () => {
  it("accepts dangling global template UIDs alongside the complete template inventory", () => {
    const portable = valid();
    portable.appSettings.profileLayoutTemplateUid = "layout-not-in-format-4";
    portable.appSettings.profileBackgroundTemplateUid =
      "background-not-in-format-4";
    expect(parseBackupManifest(portable).appSettings).toMatchObject({
      profileLayoutTemplateUid: "layout-not-in-format-4",
      profileBackgroundTemplateUid: "background-not-in-format-4",
    });
    expect(portable).toHaveProperty("profileLayoutTemplates", []);
    expect(portable).toHaveProperty("profileBackgroundTemplates", []);
  });

  it("rejects malformed template UIDs", () => {
    const portable = valid();
    portable.appSettings.profileLayoutTemplateUid = "bad\nuid";
    expect(() => parseBackupManifest(portable)).toThrow(/Profile template UID/);
  });
});

describe("parseBackupManifest", () => {
  it("migrates format 6 through 9 with the rolling Your Week default", () => {
    const legacy = valid();
    legacy.backupFormatVersion = 6;
    delete legacy.appSettings.yourWeekPeriod;
    expect(parseBackupManifest(legacy)).toMatchObject({
      backupFormatVersion: 9,
      appSettings: { yourWeekPeriod: "rolling7" },
    });
  });

  it("steps a format-8 file to 9 with nobody a favourite (38.12 D-112)", () => {
    const v8 = valid();
    v8.backupFormatVersion = 8;
    v8.contacts = [
      {
        uid: "a",
        trackingEnabled: 1,
        intervalDays: 7,
        modifiedAt: "2026-08-25 12:00:00",
      },
      {
        uid: "b",
        trackingEnabled: 0,
        intervalDays: null,
        modifiedAt: "2026-08-25 12:00:00",
      },
    ];
    const parsed = parseBackupManifest(v8);
    expect(parsed.backupFormatVersion).toBe(9);
    expect(parsed.contacts.map((c) => [c.uid, c.favourite])).toEqual([
      ["a", 0],
      ["b", 0],
    ]);
  });

  it("keeps a format-9 favourite marker and reads an absent one as not a favourite (D-112)", () => {
    const v9 = valid();
    v9.contacts = [
      {
        uid: "a",
        trackingEnabled: 1,
        intervalDays: 7,
        favourite: 1,
        modifiedAt: "2026-08-25 12:00:00",
      },
      {
        uid: "b",
        trackingEnabled: 1,
        intervalDays: 7,
        favourite: 0,
        modifiedAt: "2026-08-25 12:00:00",
      },
      {
        uid: "c",
        trackingEnabled: 1,
        intervalDays: 7,
        modifiedAt: "2026-08-25 12:00:00",
      },
    ];
    const parsed = parseBackupManifest(v9);
    expect(parsed.contacts.map((c) => c.favourite)).toEqual([1, 0, undefined]);
  });

  it.each([2, -1, "1", true, null])(
    "rejects a favourite marker that is not 0/1 (%s) at the parse boundary (T-38.12-21)",
    (favourite) => {
      const bad = valid();
      bad.contacts = [
        {
          uid: "a",
          trackingEnabled: 1,
          intervalDays: 7,
          favourite,
          modifiedAt: "2026-08-25 12:00:00",
        },
      ];
      expect(() => parseBackupManifest(bad)).toThrow(/invalid favourite/);
    },
  );

  it("refuses a format-10 file with the update-first message (T-38.12-23)", () => {
    const future = valid();
    future.backupFormatVersion = 10;
    expect(() => parseBackupManifest(future)).toThrow(UPDATE_FIRST_MESSAGE);
  });

  it.each([6, 7])(
    "rejects a malformed Your Week period at the format %s parse boundary",
    (backupFormatVersion) => {
      const malformed = valid();
      malformed.backupFormatVersion = backupFormatVersion;
      malformed.appSettings.yourWeekPeriod = "weekly";
      expect(() => parseBackupManifest(malformed)).toThrow(/Your Week period/);
    },
  );

  it("accepts a different SQLite schema version because backupFormatVersion alone gates compatibility", () => {
    expect(parseBackupManifest(valid()).metadata.sqliteUserVersion).toBe(999);
  });

  it("rejects only a future portable format with the update-first message", () => {
    const future = valid();
    future.backupFormatVersion = BACKUP_FORMAT_VERSION + 1;
    expect(() => parseBackupManifest(future)).toThrow(/update.*app/i);
  });

  it("rejects duplicate UIDs, dangling settings references, and duplicate custom-value pairs", () => {
    const duplicate = valid();
    duplicate.contacts = [{ uid: "c" }, { uid: "c" }];
    expect(() => parseBackupManifest(duplicate)).toThrow(BackupSchemaError);
    const dangling = valid();
    dangling.appSettings.sunContactUid = "missing";
    expect(() => parseBackupManifest(dangling)).toThrow(/sun/i);
    const pairs = valid();
    pairs.contacts = [{ uid: "c", trackingEnabled: 1, intervalDays: 1 }];
    pairs.customFieldDefs = [{ uid: "d" }];
    pairs.customFieldValues = [
      { uid: "v1", contactUid: "c", fieldDefUid: "d", value: null },
      { uid: "v2", contactUid: "c", fieldDefUid: "d", value: null },
    ];
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
    broken.contacts = [
      {
        uid: "contact",
        trackingEnabled: 1,
        intervalDays: 1,
        modifiedAt: "2026-08-25 12:00:00",
      },
    ];
    broken.interactions = [
      {
        uid: "interaction",
        contactUid: "contact",
        modifiedAt: "2026-08-25 12:00:00",
      },
    ];
    broken.tombstones = [
      {
        entityType: "contact",
        entityUid: "contact",
        deletedAt: "2026-08-25 12:00:00",
      },
    ];
    expect(() => parseBackupManifest(broken)).toThrow(/surviving contact/i);
  });

  it("accepts Memory and relationship tombstones", () => {
    const manifest = valid();
    manifest.tombstones = [
      {
        entityType: "memory",
        entityUid: "memory-a",
        deletedAt: "2026-08-25 12:00:00",
      },
      {
        entityType: "relationship",
        entityUid: "relationship-a",
        deletedAt: "2026-08-25 12:00:00",
      },
      {
        entityType: "current_state_entry",
        entityUid: "current-state-a",
        deletedAt: "2026-08-25 12:00:00",
      },
    ];

    expect(parseBackupManifest(manifest).tombstones).toEqual(
      manifest.tombstones,
    );
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
          allowAi: 0,
          createdAt: "2026-08-25 12:00:00",
          modifiedAt: "2026-08-25 12:00:00",
          interactionUid: null,
          linkSource: null,
          groupNoteCopy: 0,
        },
      ];
      manifest.currentStateEntries = [
        {
          uid: "state-a",
          contactUid: "contact-a",
          fieldKey: "current_location",
          value: "Chicago",
          entryDate: "2026-08-25",
          entryTime: null,
          url: null,
          interactionUid: null,
          linkSource: null,
          groupNoteCopy: 0,
          fromShare: 0,
          createdAt: "2026-08-25 12:00:00",
          modifiedAt: "2026-08-25 12:00:00",
        },
      ];
      return manifest;
    };

    expect(() => parseBackupManifest(knowledgeManifest())).not.toThrow();

    for (const patch of [
      { type: "future_memory" },
      // D-86: the custom type is retired, even with a label.
      { type: "custom", customLabel: "Label" },
      { value: " \t" },
      { pinned: 2 },
      { outdated: -1 },
      { hidden: 2 },
      { provenance: "remote" },
      // D-69: no soft-deleted rows in format 8.
      { deletedAt: "2026-08-25 12:00:00" },
      // D-102: a Group Note copy can never be allowed to AI.
      { groupNoteCopy: 1, allowAi: 1 },
      { groupNoteCopy: 2 },
      { allowAi: 2 },
      // D-37: a linked row needs a link source of note or group_note.
      { interactionUid: "interaction-a", linkSource: null },
      { interactionUid: "interaction-a", linkSource: "photo" },
      { interactionUid: 7, linkSource: "note" },
    ]) {
      const manifest = knowledgeManifest();
      Object.assign(manifest.memories[0], patch);
      expect(() => parseBackupManifest(manifest)).toThrow(BackupSchemaError);
    }

    for (const patch of [
      { entryDate: undefined },
      { entryDate: "2026-8-25" },
      { entryDate: "2026-08-25 12:00:00" },
      { entryTime: 9 },
      { url: {} },
      { groupNoteCopy: 2 },
      { fromShare: -1 },
      { interactionUid: "interaction-a", linkSource: undefined },
    ]) {
      const manifest = knowledgeManifest();
      Object.assign(manifest.currentStateEntries[0], patch);
      expect(() => parseBackupManifest(manifest)).toThrow(BackupSchemaError);
    }

    // The retired current flag is gone: two entries for one field are history.
    const history = knowledgeManifest();
    history.currentStateEntries.push({
      ...history.currentStateEntries[0],
      uid: "state-b",
      value: "Denver",
      entryDate: "2026-08-26",
    });
    expect(parseBackupManifest(history).currentStateEntries).toHaveLength(2);

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
      // D-69: format 8 carries no soft-deleted key people.
      { deletedAt: "2026-08-25 12:00:00" },
    ]) {
      const manifest = relationshipManifest();
      Object.assign(manifest.relationships[0], patch);
      expect(() => parseBackupManifest(manifest)).toThrow(BackupSchemaError);
    }
  });

  it("rejects a category reference that cannot be resolved within the backup itself", () => {
    const broken = valid();
    broken.contacts = [
      {
        uid: "contact",
        trackingEnabled: 1,
        intervalDays: 1,
        modifiedAt: "2026-08-25 12:00:00",
        categoryUid: "missing",
      },
    ];
    expect(() => parseBackupManifest(broken)).toThrow(/category/i);
  });

  it("rejects malformed photo bytes before an apply can begin", () => {
    const broken = valid();
    broken.contacts = [
      {
        uid: "contact",
        trackingEnabled: 1,
        intervalDays: 1,
        modifiedAt: "2026-08-25 12:00:00",
        photoBase64: "%%%",
      },
    ];
    expect(() => parseBackupManifest(broken)).toThrow(/photo/i);
  });

  it("forward-migrates scalar v1 contact endpoints into deterministic v2 method rows", () => {
    const legacy = valid();
    legacy.backupFormatVersion = 1;
    legacy.contacts = [
      {
        uid: "contact-a",
        name: "Ada",
        intervalDays: 14,
        phone: "+1 555 0100",
        email: "ada@example.test",
        modifiedAt: "2026-08-25 12:00:00",
      },
    ];
    const parsed = parseBackupManifest(legacy) as typeof legacy & {
      contactMethods: Array<Record<string, unknown>>;
    };
    expect(parsed.backupFormatVersion).toBe(9);
    expect(parsed.contacts[0]).not.toHaveProperty("phone");
    expect(parsed.contacts[0]).not.toHaveProperty("email");
    expect(parsed.appSettings).toHaveProperty("phoneRegionOverride", null);
    expect(parsed.appSettings).toMatchObject({
      includeUnboundNeverContacted: 0,
      birthdayUnboundEnabled: 1,
    });
    expect(parsed.contacts).toEqual([
      expect.objectContaining({
        uid: "contact-a",
        trackingEnabled: 1,
        intervalDays: 14,
      }),
    ]);
    expect(parsed.contactMethods).toEqual([
      expect.objectContaining({
        uid: "legacy-method:contact-a:phone",
        contactUid: "contact-a",
        methodType: "phone",
        canonicalRegion: null,
        label: null,
      }),
      expect.objectContaining({
        uid: "legacy-method:contact-a:email",
        contactUid: "contact-a",
        methodType: "email",
        canonicalRegion: null,
        label: null,
      }),
    ]);
  });

  it("forward-migrates v2 contacts and lifecycle settings to the v3 wire format", () => {
    const legacy = valid();
    legacy.backupFormatVersion = 2;
    legacy.contacts = [
      { uid: "contact-a", intervalDays: 7, modifiedAt: "2026-08-25 12:00:00" },
    ];

    const parsed = parseBackupManifest(legacy);

    expect(parsed.backupFormatVersion).toBe(9);
    expect(parsed.contacts).toEqual([
      expect.objectContaining({
        uid: "contact-a",
        trackingEnabled: 1,
        intervalDays: 7,
      }),
    ]);
    expect(parsed.appSettings).toMatchObject({
      includeUnboundNeverContacted: 0,
      birthdayUnboundEnabled: 1,
    });
  });

  it("upgrades v4 through v8 and requires the complete inventory", () => {
    const legacy = valid();
    legacy.backupFormatVersion = 4;
    legacy.appSettings.includeUnboundNeverContacted = 1;
    for (const key of [
      "systems",
      "systemRules",
      "systemOverrides",
      "systemPrefs",
      "profileLayoutTemplates",
      "profileBackgroundTemplates",
      "aiConnections",
      "personalizationSections",
      "groupEvents",
      "profileContactPresentation",
      "profileCategoryPresentation",
    ])
      delete legacy[key];
    const upgraded = parseBackupManifest(legacy);
    expect(upgraded.backupFormatVersion).toBe(9);
    expect(upgraded.systems).toEqual([]);
    expect(upgraded.profileContactPresentation).toEqual([]);
    expect(upgraded.appSettings.includeUnboundNeverContacted).toBe(1);
    expect(parseBackupManifest(upgraded)).toEqual(upgraded);

    const incompleteV5 = valid();
    delete incompleteV5.systems;
    expect(() => parseBackupManifest(incompleteV5)).toThrow(
      /systems must be an array/,
    );

    const retiredManageFavouritesKey = valid();
    retiredManageFavouritesKey.appSettings.manageFavouritesOrder = [
      "contact-a",
    ];
    expect(() => parseBackupManifest(retiredManageFavouritesKey)).toThrow(
      /local-only or secret member/,
    );
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
      manifest.contacts = [
        { uid: "contact-a", modifiedAt: "2026-08-25 12:00:00", ...contact },
      ];
      expect(() => parseBackupManifest(manifest)).toThrow(BackupSchemaError);
    }
  });

  it("rejects malformed cadence and duplicate surviving method primaries before restore", () => {
    const cadence = valid();
    cadence.contacts = [
      {
        uid: "contact-a",
        trackingEnabled: 1,
        intervalDays: 0,
        modifiedAt: "2026-08-25 12:00:00",
      },
    ];
    expect(() => parseBackupManifest(cadence)).toThrow(BackupSchemaError);

    const primary = valid();
    primary.contacts = [
      {
        uid: "contact-a",
        trackingEnabled: 1,
        intervalDays: 7,
        modifiedAt: "2026-08-25 12:00:00",
      },
    ];
    primary.contactMethods = [
      {
        uid: "method-a",
        contactUid: "contact-a",
        methodType: "phone",
        rawValue: "a",
        displayValue: "a",
        isActionable: 1,
        isPrimary: 1,
        displayOrder: 0,
        createdAt: "2026-08-25 12:00:00",
        modifiedAt: "2026-08-25 12:00:00",
      },
      {
        uid: "method-b",
        contactUid: "contact-a",
        methodType: "phone",
        rawValue: "b",
        displayValue: "b",
        isActionable: 1,
        isPrimary: 1,
        displayOrder: 1,
        createdAt: "2026-08-25 12:00:00",
        modifiedAt: "2026-08-25 12:00:00",
      },
    ];
    expect(() => parseBackupManifest(primary)).toThrow(
      /duplicate surviving primary/i,
    );
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
      m.customFieldDefs = [
        { uid: "def-a", modifiedAt: "2026-08-25 12:00:00", ...def },
      ];
      return m;
    };
    // A malformed scope must fail before it can silently bypass the completeness guard.
    expect(() => parseBackupManifest(withDef({ scope: "Global" }))).toThrow(
      /scope/i,
    );
    expect(() => parseBackupManifest(withDef({ scope: 1 }))).toThrow(/scope/i);
    // Wrong-typed history_retained / field_group fail as a clean parse error, not a bind rollback.
    expect(() => parseBackupManifest(withDef({ historyRetained: 2 }))).toThrow(
      /history_retained/i,
    );
    expect(() => parseBackupManifest(withDef({ fieldGroup: 5 }))).toThrow(
      /field_group/i,
    );
    // The legitimate contact scope, and absent/null values from older backups, still pass.
    expect(() =>
      parseBackupManifest(
        withDef({ scope: "contact", historyRetained: 1, fieldGroup: "Work" }),
      ),
    ).not.toThrow();
    expect(() => parseBackupManifest(withDef({}))).not.toThrow();
  });

  it("round-trips and validates custom_field_value_history rows and their tombstone", () => {
    const manifest = valid();
    manifest.contacts = [
      {
        uid: "contact-a",
        trackingEnabled: 1,
        intervalDays: 7,
        modifiedAt: "2026-08-25 12:00:00",
      },
    ];
    manifest.customFieldDefs = [
      { uid: "def-a", modifiedAt: "2026-08-25 12:00:00" },
    ];
    manifest.customFieldValues = [
      {
        uid: "value-a",
        contactUid: "contact-a",
        fieldDefUid: "def-a",
        value: null,
      },
    ];
    manifest.customFieldValueHistory = [
      {
        uid: "history-a",
        contactUid: "contact-a",
        fieldDefUid: "def-a",
        value: "Old",
        createdAt: "2026-08-25 12:00:00",
        modifiedAt: "2026-08-25 12:00:00",
      },
    ];
    manifest.tombstones = [
      {
        entityType: "custom_field_value_history",
        entityUid: "history-b",
        deletedAt: "2026-08-25 12:00:00",
      },
    ];
    const parsed = parseBackupManifest(manifest);
    expect(parsed.customFieldValueHistory).toEqual([
      expect.objectContaining({
        uid: "history-a",
        contactUid: "contact-a",
        fieldDefUid: "def-a",
        value: "Old",
      }),
    ]);
    expect(parsed.tombstones).toEqual([
      {
        entityType: "custom_field_value_history",
        entityUid: "history-b",
        deletedAt: "2026-08-25 12:00:00",
      },
    ]);
  });

  it("rejects a value-history row whose fieldDefUid or contactUid is unknown to the manifest", () => {
    const base = () => {
      const manifest = valid();
      manifest.contacts = [
        {
          uid: "contact-a",
          trackingEnabled: 1,
          intervalDays: 7,
          modifiedAt: "2026-08-25 12:00:00",
        },
      ];
      manifest.customFieldDefs = [{ uid: "def-a" }];
      manifest.customFieldValues = [
        {
          uid: "value-a",
          contactUid: "contact-a",
          fieldDefUid: "def-a",
          value: null,
        },
      ];
      return manifest;
    };
    const badDef = base();
    badDef.customFieldValueHistory = [
      {
        uid: "history-a",
        contactUid: "contact-a",
        fieldDefUid: "ghost-def",
        value: "Old",
        createdAt: "2026-08-25 12:00:00",
        modifiedAt: "2026-08-25 12:00:00",
      },
    ];
    expect(() => parseBackupManifest(badDef)).toThrow(
      /customFieldValueHistory has an unknown field definition UID/,
    );

    const badContact = base();
    badContact.customFieldValueHistory = [
      {
        uid: "history-a",
        contactUid: "ghost-contact",
        fieldDefUid: "def-a",
        value: "Old",
        createdAt: "2026-08-25 12:00:00",
        modifiedAt: "2026-08-25 12:00:00",
      },
    ];
    expect(() => parseBackupManifest(badContact)).toThrow(
      /customFieldValueHistory has an unknown contact UID/,
    );
  });

  it("rejects malformed normalized tombstone parent combinations before apply", () => {
    const broken = valid();
    broken.contacts = [
      {
        uid: "contact-a",
        trackingEnabled: 1,
        intervalDays: 7,
        modifiedAt: "2026-08-25 12:00:00",
      },
    ];
    broken.contactMethods = [
      {
        uid: "method-a",
        contactUid: "contact-a",
        methodType: "phone",
        rawValue: "a",
        displayValue: "a",
        isActionable: 1,
        isPrimary: 1,
        displayOrder: 0,
        createdAt: "2026-08-25 12:00:00",
        modifiedAt: "2026-08-25 12:00:00",
      },
    ];
    broken.contactMethodProvenance = [
      {
        uid: "provenance-a",
        methodUid: "method-a",
        externalContactLinkUid: null,
        sourceMethodId: null,
        createdAt: "2026-08-25 12:00:00",
        modifiedAt: "2026-08-25 12:00:00",
      },
    ];
    broken.tombstones = [
      {
        entityType: "contact_method",
        entityUid: "method-a",
        deletedAt: "2026-08-25 12:00:00",
      },
    ];
    expect(() => parseBackupManifest(broken)).toThrow(
      /surviving method parent/i,
    );

    broken.tombstones = [
      {
        entityType: "unsupported",
        entityUid: "method-a",
        deletedAt: "2026-08-25 12:00:00",
      },
    ];
    expect(() => parseBackupManifest(broken)).toThrow(BackupSchemaError);
  });
});

describe("background ids at the parse boundary (38.5 D-47)", () => {
  it("accepts null, active, retired and well-formed unavailable ids (the restore flow asks about the last)", () => {
    for (const id of [null, "galaxy-aurora", "standard-mesh", "galaxy-comet"]) {
      const portable = valid();
      portable.appSettings.galaxyBackground = id;
      portable.appSettings.standardBackground = id;
      expect(parseBackupManifest(portable).appSettings).toMatchObject({
        galaxyBackground: id,
        standardBackground: id,
      });
    }
  });

  it("rejects a malformed background value as a damaged file", () => {
    for (const bad of [42, {}, "", "has space", "x".repeat(257), "a\u0000b"]) {
      for (const key of ["galaxyBackground", "standardBackground"]) {
        const portable = valid();
        portable.appSettings[key] = bad;
        expect(
          () => parseBackupManifest(portable),
          `${key}=${String(bad)}`,
        ).toThrow(/invalid background id/);
      }
    }
  });
});

describe("format 8 (Phase 38.10)", () => {
  const STAMP = "2026-08-25 12:00:00";
  const withContact = () => {
    const manifest = valid();
    manifest.contacts = [
      {
        uid: "contact-a",
        trackingEnabled: 1,
        intervalDays: 7,
        modifiedAt: STAMP,
      },
    ];
    return manifest;
  };
  const memory = (uid: string, extra: Record<string, unknown> = {}) => ({
    uid,
    contactUid: "contact-a",
    type: "general",
    customLabel: null,
    value: `text ${uid}`,
    note: null,
    url: null,
    meaningfulDate: null,
    pinned: 0,
    outdated: 0,
    hidden: null,
    provenance: "user",
    allowAi: 0,
    createdAt: STAMP,
    modifiedAt: STAMP,
    interactionUid: null,
    linkSource: null,
    groupNoteCopy: 0,
    ...extra,
  });
  const entry = (uid: string, extra: Record<string, unknown> = {}) => ({
    uid,
    contactUid: "contact-a",
    fieldKey: "last_talked_about",
    value: `topic ${uid}`,
    entryDate: "2026-08-25",
    entryTime: null,
    url: null,
    interactionUid: null,
    linkSource: null,
    groupNoteCopy: 0,
    fromShare: 0,
    createdAt: STAMP,
    modifiedAt: STAMP,
    ...extra,
  });

  it("validates Off Limits rows, legacy contentless ones included", () => {
    const manifest = withContact();
    manifest.offLimits = [
      {
        uid: "off-a",
        contactUid: "contact-a",
        label: "Divorce",
        text: null,
        url: null,
        groupNoteCopy: 0,
        fromShare: 1,
        createdAt: STAMP,
        modifiedAt: STAMP,
      },
      {
        uid: "off-b",
        contactUid: "contact-a",
        label: null,
        text: null,
        url: null,
        groupNoteCopy: 0,
        fromShare: 0,
        createdAt: STAMP,
        modifiedAt: STAMP,
      },
    ];
    expect(parseBackupManifest(manifest).offLimits).toHaveLength(2);

    for (const patch of [
      { contactUid: "missing" },
      { label: 4 },
      { fromShare: 2 },
      { groupNoteCopy: "1" },
      { createdAt: null },
    ]) {
      const bad = withContact();
      bad.offLimits = [{ ...manifest.offLimits[0], ...patch }];
      expect(() => parseBackupManifest(bad)).toThrow(BackupSchemaError);
    }

    const duplicate = withContact();
    duplicate.offLimits = [manifest.offLimits[0], manifest.offLimits[0]];
    expect(() => parseBackupManifest(duplicate)).toThrow(/duplicate uid/);

    const orphan = withContact();
    orphan.offLimits = [manifest.offLimits[0]];
    orphan.tombstones = [
      { entityType: "contact", entityUid: "contact-a", deletedAt: STAMP },
    ];
    expect(() => parseBackupManifest(orphan)).toThrow(/surviving contact/);
  });

  it("accepts an off_limits tombstone and rejects the retired legacy type", () => {
    const manifest = valid();
    manifest.tombstones = [
      { entityType: "off_limits", entityUid: "off-a", deletedAt: STAMP },
    ];
    expect(parseBackupManifest(manifest).tombstones).toEqual(
      manifest.tombstones,
    );

    const retired = valid();
    retired.tombstones = [
      { entityType: "fuel", entityUid: "x", deletedAt: STAMP },
    ];
    expect(() => parseBackupManifest(retired)).toThrow(/tombstones/);
  });

  it("ignores an unknown legacy knowledge array in a format-8 file", () => {
    const manifest = withContact();
    manifest.fuel = [{ uid: "ignored" }];
    const parsed = parseBackupManifest(manifest);
    expect(parsed).not.toHaveProperty("fuel");
    expect(parsed.offLimits).toEqual([]);
  });

  it("rejects a duplicate interaction link within a table (D-95), not unlinked leftovers", () => {
    const linked = withContact();
    linked.memories = [
      memory("m-1", { interactionUid: "i-1", linkSource: "note" }),
      memory("m-2", { interactionUid: "i-1", linkSource: "note" }),
    ];
    expect(() => parseBackupManifest(linked)).toThrow(
      /duplicate interaction link/,
    );

    const entries = withContact();
    entries.currentStateEntries = [
      entry("s-1", {
        interactionUid: "i-1",
        linkSource: "group_note",
        groupNoteCopy: 1,
      }),
      entry("s-2", {
        interactionUid: "i-1",
        linkSource: "group_note",
        groupNoteCopy: 1,
      }),
    ];
    expect(() => parseBackupManifest(entries)).toThrow(
      /duplicate interaction link/,
    );

    // One link per source and per table is fine (the cross-table collapse is
    // restore's job).
    const distinct = withContact();
    distinct.memories = [
      memory("m-1", { interactionUid: "i-1", linkSource: "note" }),
      memory("m-2", {
        interactionUid: "i-1",
        linkSource: "group_note",
        groupNoteCopy: 1,
      }),
    ];
    distinct.currentStateEntries = [
      entry("s-1", { interactionUid: "i-1", linkSource: "note" }),
    ];
    expect(() => parseBackupManifest(distinct)).not.toThrow();

    // W-10: ON DELETE SET NULL leaves unlinked rows with a leftover source.
    const leftovers = withContact();
    leftovers.memories = [
      memory("m-1", { linkSource: "note" }),
      memory("m-2", { linkSource: "note" }),
    ];
    leftovers.currentStateEntries = [
      entry("s-1", { linkSource: "note" }),
      entry("s-2", { linkSource: "note" }),
    ];
    expect(parseBackupManifest(leftovers).memories).toHaveLength(2);
  });

  it("rejects a locked interaction note allowed to AI (D-103)", () => {
    const interaction = {
      uid: "i-1",
      contactUid: "contact-a",
      occurredAt: STAMP,
      modifiedAt: STAMP,
    };
    const ok = withContact();
    ok.interactions = [{ ...interaction, allowAi: 0, noteAiLocked: 1 }];
    expect(() => parseBackupManifest(ok)).not.toThrow();
    for (const patch of [
      { allowAi: 1, noteAiLocked: 1 },
      { noteAiLocked: 2 },
      { allowAi: 3 },
    ]) {
      const bad = withContact();
      bad.interactions = [{ ...interaction, ...patch }];
      expect(() => parseBackupManifest(bad)).toThrow(BackupSchemaError);
    }
  });
});

describe("format 7 files convert on parse (D-55, D-56)", () => {
  const STAMP = "2026-08-25 12:00:00";
  const legacy = (
    kind: string,
    uid: string,
    extra: Record<string, unknown> = {},
  ) => ({
    uid,
    contactUid: "contact-a",
    kind,
    label: null,
    text: `${kind} text`,
    url: null,
    createdAt: "2026-07-01 09:30:00",
    source: "typed",
    modifiedAt: "2026-07-02 10:00:00",
    ...extra,
  });
  const v7 = () => {
    const manifest = valid();
    manifest.backupFormatVersion = 7;
    delete manifest.offLimits;
    manifest.contacts = [
      {
        uid: "contact-a",
        trackingEnabled: 1,
        intervalDays: 7,
        modifiedAt: STAMP,
      },
    ];
    manifest.fuel = [
      legacy("off_limits", "f-off", { label: "Politics", text: null }),
      legacy("off_limits", "f-off-empty", { text: null }),
      legacy("gift", "f-gift", {
        label: "Book",
        text: null,
        url: "https://b.test",
      }),
      legacy("topic", "f-topic", { source: "share", text: "Shared article" }),
      legacy("topic", "f-topic-typed"),
      legacy("fact", "f-fact"),
      legacy("recent", "f-recent", { source: "share" }),
      legacy("mystery", "f-unknown"),
      legacy("gift", "f-blank", { text: "  " }),
    ];
    manifest.memories = [
      {
        uid: "m-custom",
        contactUid: "contact-a",
        type: "custom",
        customLabel: "Allergy",
        value: "Peanuts",
        note: null,
        url: null,
        meaningfulDate: null,
        pinned: 0,
        outdated: 0,
        hidden: null,
        provenance: "user",
        allowAi: 1,
        createdAt: STAMP,
        modifiedAt: STAMP,
        deletedAt: null,
      },
      {
        uid: "m-trash",
        contactUid: "contact-a",
        type: "general",
        customLabel: null,
        value: "gone",
        note: null,
        url: null,
        meaningfulDate: null,
        pinned: 0,
        outdated: 0,
        hidden: null,
        provenance: "user",
        allowAi: 0,
        createdAt: STAMP,
        modifiedAt: STAMP,
        deletedAt: "2026-08-20 08:00:00",
      },
    ];
    manifest.relationships = [
      {
        uid: "r-trash",
        contactUid: "contact-a",
        personName: "Sam",
        relationType: null,
        note: null,
        pinned: 0,
        hidden: null,
        createdAt: STAMP,
        modifiedAt: STAMP,
        deletedAt: "2026-08-21 08:00:00",
      },
    ];
    manifest.currentStateEntries = [
      {
        uid: "s-old",
        contactUid: "contact-a",
        fieldKey: "current_location",
        value: "Chicago",
        isCurrent: 1,
        createdAt: "2026-05-05 05:05:05",
        modifiedAt: STAMP,
      },
    ];
    manifest.tombstones = [
      {
        entityType: "fuel",
        entityUid: "f-dead",
        deletedAt: "2026-08-01 00:00:00",
      },
    ];
    return manifest;
  };

  it("moves every legacy kind to its D-56 home with Allow AI off", () => {
    const parsed = parseBackupManifest(v7());
    expect(parsed.backupFormatVersion).toBe(9);
    expect(parsed).not.toHaveProperty("fuel");

    // A v7 off_limits row parses to offLimits with the same uid.
    expect(parsed.offLimits[0]).toMatchObject({
      uid: "f-off",
      contactUid: "contact-a",
      label: "Politics",
      text: null,
      fromShare: 0,
      groupNoteCopy: 0,
    });
    // D-97: a contentless off_limits row is copied; any other kind is skipped.
    expect(parsed.offLimits.map((row) => row.uid)).toEqual([
      "f-off",
      "f-off-empty",
    ]);

    const byUid = new Map(parsed.memories.map((row) => [row.uid, row]));
    expect(byUid.get("f-gift")).toMatchObject({
      type: "gift_idea",
      customLabel: "Book",
      value: "https://b.test",
      url: "https://b.test",
      allowAi: 0,
      provenance: "user",
    });
    expect(byUid.get("f-topic")).toMatchObject({
      type: "thought_of_them",
      value: "Shared article",
      provenance: "share",
      allowAi: 0,
    });
    expect(byUid.get("f-fact")).toMatchObject({ type: "general", allowAi: 0 });
    expect(byUid.get("f-unknown")).toMatchObject({
      type: "general",
      allowAi: 0,
    });
    expect(byUid.has("f-blank")).toBe(false);

    const recent = parsed.currentStateEntries.find(
      (row) => row.uid === "f-recent",
    );
    expect(recent).toMatchObject({
      fieldKey: "last_talked_about",
      value: "recent text",
      entryDate: "2026-07-01",
      entryTime: null,
      fromShare: 1,
    });
    expect(recent).not.toHaveProperty("allowAi");
  });

  it("converts custom memories, trash and current state, and triples legacy tombstones", () => {
    const parsed = parseBackupManifest(v7());
    const custom = parsed.memories.find((row) => row.uid === "m-custom");
    expect(custom).toMatchObject({
      type: "general",
      customLabel: "Allergy",
      modifiedAt: STAMP,
      groupNoteCopy: 0,
    });
    expect(custom).not.toHaveProperty("deletedAt");
    expect(parsed.memories.some((row) => row.uid === "m-trash")).toBe(false);
    expect(parsed.relationships).toEqual([]);

    const location = parsed.currentStateEntries.find(
      (row) => row.uid === "s-old",
    );
    expect(location).toMatchObject({
      entryDate: "2026-05-05",
      entryTime: null,
    });
    expect(location).not.toHaveProperty("isCurrent");

    expect(parsed.tombstones).toEqual(
      expect.arrayContaining([
        {
          entityType: "memory",
          entityUid: "m-trash",
          deletedAt: "2026-08-20 08:00:00",
        },
        {
          entityType: "relationship",
          entityUid: "r-trash",
          deletedAt: "2026-08-21 08:00:00",
        },
        {
          entityType: "memory",
          entityUid: "f-dead",
          deletedAt: "2026-08-01 00:00:00",
        },
        {
          entityType: "off_limits",
          entityUid: "f-dead",
          deletedAt: "2026-08-01 00:00:00",
        },
        {
          entityType: "current_state_entry",
          entityUid: "f-dead",
          deletedAt: "2026-08-01 00:00:00",
        },
      ]),
    );
    expect(parsed.tombstones).toHaveLength(5);
    expect(parsed.appSettings).toMatchObject({
      aiDefaultGiftIdeaAllow: 0,
      aiDefaultThoughtOfThemAllow: 0,
    });
  });
});
