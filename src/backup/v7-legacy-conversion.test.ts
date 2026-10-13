import { describe, expect, it, vi } from "vitest";
import { parseBackupManifest } from "@/backup/backup-schema";
import { BackupSchemaError } from "@/backup/types";
import {
  convertV7ToV8,
  V7_CONVERSION_FALLBACK_NOW,
} from "@/backup/v7-legacy-conversion";

const EXPORTED = "2026-09-01 08:15:00";

type Row = Record<string, unknown>;

function memory(uid: string, extra: Row = {}): Row {
  return {
    uid,
    contactUid: "contact-a",
    type: "general",
    customLabel: null,
    value: `memory ${uid}`,
    note: null,
    url: null,
    meaningfulDate: null,
    pinned: 0,
    outdated: 0,
    hidden: null,
    provenance: "user",
    allowAi: 0,
    createdAt: "2026-06-01 10:00:00",
    modifiedAt: "2026-06-01 10:00:00",
    deletedAt: null,
    ...extra,
  };
}

function legacy(kind: string, uid: string, extra: Row = {}): Row {
  return {
    uid,
    contactUid: "contact-a",
    kind,
    label: null,
    text: `${kind} ${uid}`,
    url: null,
    createdAt: "2026-07-01 09:30:00",
    source: "typed",
    modifiedAt: "2026-07-02 10:00:00",
    ...extra,
  };
}

/** A minimal, otherwise-valid format-7 manifest. */
function v7(patch: Row = {}): Row {
  return {
    backupFormatVersion: 7,
    envelopeVersion: 1,
    metadata: { exportedAt: EXPORTED, sqliteUserVersion: 32 },
    appSettings: { sunContactUid: null, modifiedAt: EXPORTED },
    categories: [],
    profile: null,
    contacts: [
      {
        uid: "contact-a",
        trackingEnabled: 1,
        intervalDays: 7,
        modifiedAt: EXPORTED,
      },
    ],
    contactMethods: [],
    externalContactLinks: [],
    contactMethodProvenance: [],
    interactions: [],
    events: [],
    fuel: [],
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
    ...patch,
  };
}

const rowsOf = (manifest: Row, key: string) => manifest[key] as Row[];
const uids = (manifest: Row, key: string) =>
  rowsOf(manifest, key).map((row) => row.uid);

describe("convertV7ToV8", () => {
  it("takes its time from metadata.exportedAt (a custom memory's modifiedAt)", () => {
    const out = convertV7ToV8(
      v7({
        memories: [memory("m-custom", { type: "custom", customLabel: "X" })],
      }),
    );
    expect(rowsOf(out, "memories")[0]).toMatchObject({
      type: "general",
      customLabel: "X",
      modifiedAt: EXPORTED,
    });
    expect(out.backupFormatVersion).toBe(8);
    expect(out).not.toHaveProperty("fuel");
  });

  it("falls back to the fixed literal for an odd-shaped exportedAt", () => {
    for (const exportedAt of ["2026-09-01T08:15:00Z", "yesterday", ""]) {
      const out = convertV7ToV8(
        v7({
          metadata: { exportedAt, sqliteUserVersion: 32 },
          memories: [memory("m-custom", { type: "custom", customLabel: "X" })],
          fuel: [
            legacy("recent", "f-r", { createdAt: "bad", modifiedAt: "bad" }),
          ],
        }),
      );
      expect(rowsOf(out, "memories")[0].modifiedAt).toBe(
        V7_CONVERSION_FALLBACK_NOW,
      );
      expect(rowsOf(out, "currentStateEntries")[0].entryDate).toBe(
        "1970-01-01",
      );
    }
  });

  it("reads a missing legacy array as empty", () => {
    const manifest = v7();
    delete manifest.fuel;
    const out = convertV7ToV8(manifest);
    expect(out.offLimits).toEqual([]);
    expect(() => parseBackupManifest(manifest)).not.toThrow();
  });

  it("never draws a fresh uid", () => {
    const newUid = vi.fn(() => "fresh");
    convertV7ToV8(
      v7({
        memories: [memory("x")],
        fuel: [legacy("gift", "x"), legacy("off_limits", "o")],
      }),
      { newUid },
    );
    expect(newUid).not.toHaveBeenCalled();
  });

  it("re-mints a collided uid to legacy-<table>-<uid>, deterministically", () => {
    const input = () =>
      v7({
        memories: [memory("x")],
        fuel: [legacy("gift", "x"), legacy("recent", "y")],
        currentStateEntries: [
          {
            uid: "y",
            contactUid: "contact-a",
            fieldKey: "last_talked_about",
            value: "old",
            isCurrent: 1,
            createdAt: "2026-06-01 10:00:00",
            modifiedAt: "2026-06-01 10:00:00",
          },
        ],
        tombstones: [
          {
            entityType: "fuel",
            entityUid: "x",
            deletedAt: "2026-05-01 00:00:00",
          },
        ],
      });
    const first = convertV7ToV8(input());
    const second = convertV7ToV8(input());
    expect(first).toEqual(second);

    // The pre-existing rows keep their uids; the legacy rows move aside.
    expect(uids(first, "memories")).toEqual(["x", "legacy-memories-x"]);
    expect(rowsOf(first, "memories")[0].value).toBe("memory x");
    expect(rowsOf(first, "memories")[1]).toMatchObject({
      type: "gift_idea",
      value: "gift x",
    });
    expect(uids(first, "currentStateEntries")).toEqual([
      "y",
      "legacy-current_state_entries-y",
    ]);

    // The collided uid's legacy tombstone lands under the re-minted uid for
    // the memories table only; the other two homes keep the plain uid.
    expect(first.tombstones).toEqual([
      {
        entityType: "memory",
        entityUid: "legacy-memories-x",
        deletedAt: "2026-05-01 00:00:00",
      },
      {
        entityType: "off_limits",
        entityUid: "x",
        deletedAt: "2026-05-01 00:00:00",
      },
      {
        entityType: "current_state_entry",
        entityUid: "x",
        deletedAt: "2026-05-01 00:00:00",
      },
    ]);
    expect(() => parseBackupManifest(input())).not.toThrow();
  });

  it("re-mints a second-level collision to -2 and passes the duplicate-uid check", () => {
    const manifest = v7({
      memories: [memory("x"), memory("legacy-memories-x")],
      fuel: [legacy("gift", "x")],
    });
    const out = convertV7ToV8(manifest);
    expect(uids(out, "memories")).toEqual([
      "x",
      "legacy-memories-x",
      "legacy-memories-x-2",
    ]);
    expect(parseBackupManifest(manifest).memories).toHaveLength(3);
  });

  it("treats an existing tombstone of the destination type as a collision", () => {
    const one = convertV7ToV8(
      v7({
        tombstones: [
          {
            entityType: "memory",
            entityUid: "x",
            deletedAt: "2026-05-01 00:00:00",
          },
        ],
        fuel: [legacy("gift", "x")],
      }),
    );
    expect(uids(one, "memories")).toEqual(["legacy-memories-x"]);

    const two = convertV7ToV8(
      v7({
        tombstones: [
          {
            entityType: "memory",
            entityUid: "x",
            deletedAt: "2026-05-01 00:00:00",
          },
          {
            entityType: "memory",
            entityUid: "legacy-memories-x",
            deletedAt: "2026-05-01 00:00:00",
          },
        ],
        fuel: [legacy("gift", "x")],
      }),
    );
    expect(uids(two, "memories")).toEqual(["legacy-memories-x-2"]);
  });

  it("marks share-sourced Off Limits and Last Talked About rows fromShare", () => {
    const out = convertV7ToV8(
      v7({
        fuel: [
          legacy("off_limits", "o-share", { source: "share" }),
          legacy("off_limits", "o-typed"),
          legacy("recent", "r-share", { source: "share" }),
          legacy("recent", "r-typed"),
        ],
      }),
    );
    expect(
      rowsOf(out, "offLimits").map((row) => [row.uid, row.fromShare]),
    ).toEqual([
      ["o-share", 1],
      ["o-typed", 0],
    ]);
    expect(
      rowsOf(out, "currentStateEntries").map((row) => [row.uid, row.fromShare]),
    ).toEqual([
      ["r-share", 1],
      ["r-typed", 0],
    ]);
  });

  it("keeps the later deletedAt when a soft-deleted row already has a tombstone", () => {
    const out = convertV7ToV8(
      v7({
        memories: [memory("m", { deletedAt: "2026-08-02 00:00:00" })],
        tombstones: [
          {
            entityType: "memory",
            entityUid: "m",
            deletedAt: "2026-08-01 00:00:00",
          },
        ],
      }),
    );
    expect(out.memories).toEqual([]);
    expect(out.tombstones).toEqual([
      {
        entityType: "memory",
        entityUid: "m",
        deletedAt: "2026-08-02 00:00:00",
      },
    ]);
  });

  it("defaults the D-102 / D-103 markers to 0 and the two new settings to 0", () => {
    const out = convertV7ToV8(
      v7({
        interactions: [
          {
            uid: "i",
            contactUid: "contact-a",
            allowAi: 1,
            modifiedAt: EXPORTED,
          },
        ],
        memories: [memory("m")],
      }),
    );
    expect(rowsOf(out, "interactions")[0]).toMatchObject({ noteAiLocked: 0 });
    expect(rowsOf(out, "memories")[0]).toMatchObject({
      groupNoteCopy: 0,
      interactionUid: null,
      linkSource: null,
    });
    expect(out.appSettings).toMatchObject({
      aiDefaultGiftIdeaAllow: 0,
      aiDefaultThoughtOfThemAllow: 0,
    });
  });

  it("rejects an unreadable or duplicated legacy row", () => {
    expect(() =>
      convertV7ToV8(v7({ fuel: [legacy("gift", "x", { kind: 4 })] })),
    ).toThrow(BackupSchemaError);
    expect(() =>
      convertV7ToV8(v7({ fuel: [legacy("gift", "x"), legacy("fact", "x")] })),
    ).toThrow(/duplicate uid/);
    expect(() => convertV7ToV8(v7({ fuel: {} }))).toThrow(BackupSchemaError);
    expect(() =>
      convertV7ToV8(v7({ memories: [memory("m", { deletedAt: 5 })] })),
    ).toThrow(BackupSchemaError);
  });
});
