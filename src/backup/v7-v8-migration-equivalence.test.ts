/**
 * Migration 033 and the v7 -> v8 backup converter must produce the same rows
 * from the same data (RESEARCH 1.4; plan 38.10-04 Task 3). One fixture table
 * drives both paths:
 *
 *   Path A: migrate to v32, insert the fixture as raw rows, migrate to v33 with
 *           `now` = the manifest's `metadata.exportedAt`.
 *   Path B: hand-build the same data as a format-7 manifest, parse it (the
 *           converter runs as `FORWARD_MIGRATIONS[7]`), then Replace-all
 *           restore it into a fresh v33 database.
 *
 * Rows are compared by uid (ids excluded, contact ids mapped to contact uids,
 * `from_share` and `group_note_copy` included), collision rows included: both
 * paths take the same final uid from the shared collision-complete allocation.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));
vi.mock("@/services/photos/photo-storage", async () => {
  const paths = await vi.importActual<
    typeof import("@/db/photo-relative-path")
  >("@/db/photo-relative-path");
  return {
    contactPhotoRelPath: (id: number) => `avatars/contact-${id}.jpg`,
    customFieldPhotoRelPath: (id: number, colName: string) =>
      `avatars/cv-${id}-${colName}.jpg`,
    profilePhotoRelPath: () => "avatars/profile.jpg",
    deletePhoto: () => {},
    deleteRestorePending: () => {},
    listRestorePendingPhotos: () => [],
    photoFileExists: () => false,
    photoSwapBackupExists: () => false,
    persistMaster: async (_source: string, canonical: string) => canonical,
    resolveRestorePendingUri: (path: string) => path,
    resolvePhotoUri: (path: string) => `file:///docs/${path}`,
    resolvePhotoDisplayUri: (path: string) => `file:///docs/${path}`,
    restorePendingRelPath: paths.restorePendingRelPath,
    stageRestorePendingBase64: async () => {},
    stageRestorePending: async () => {},
  };
});
vi.mock("@/services/photos/background-storage", () => ({
  backgroundDerivativeRelPath: (uid: string) =>
    `profile-backgrounds/${uid}.jpg`,
  resolveBackgroundRestorePendingUri: (path: string) => path,
  stageBackgroundRestorePendingBase64: async () => {},
  persistBackgroundDerivative: async () => {},
  deleteBackgroundRestorePending: () => {},
}));
vi.mock("@/services/notifications/notification-schedule", () => ({
  reconcileSchedule: async () => {},
}));
vi.mock("@/services/notifications/digest-schedule", () => ({
  reconcileDigestSchedule: async () => {},
}));

import { parseBackupManifest } from "@/backup/backup-schema";
import { applyRestore } from "@/backup/restore-apply";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

/** The conversion time on both paths: the manifest's own exportedAt. */
const EXPORTED = "2026-10-01 07:30:00";
const STAMP = "2026-06-01 10:00:00";

function deps(now: string) {
  let counter = 0;
  return { now, newUid: () => `equivalence-uid-${++counter}` };
}

// --- The one fixture table ---------------------------------------------------

const CONTACTS = ["alex", "bea"] as const;

interface LegacySeed {
  uid: string;
  contact: (typeof CONTACTS)[number];
  kind: string;
  label?: string | null;
  text?: string | null;
  url?: string | null;
  source: string;
  createdAt?: string;
  modifiedAt?: string;
}

/** Every kind and source, the D-97 contentless cases and odd timestamps. */
const LEGACY_ROWS: LegacySeed[] = [
  {
    uid: "ol-typed",
    contact: "alex",
    kind: "off_limits",
    text: "Her divorce",
    source: "user",
  },
  {
    uid: "ol-share",
    contact: "alex",
    kind: "off_limits",
    label: "Politics",
    url: "https://p.test",
    source: "share",
  },
  {
    uid: "ol-empty",
    contact: "bea",
    kind: "off_limits",
    label: "  ",
    source: "user",
  },
  {
    uid: "gift-label-url",
    contact: "alex",
    kind: "gift",
    label: "Book",
    url: "https://book.test",
    source: "user",
  },
  { uid: "gift-ai", contact: "bea", kind: "gift", text: "Scarf", source: "ai" },
  {
    uid: "topic-share",
    contact: "alex",
    kind: "topic",
    text: "Shared article",
    url: "https://a.test",
    source: "share",
  },
  {
    uid: "topic-typed",
    contact: "bea",
    kind: "topic",
    text: "Sailing",
    source: "user",
  },
  {
    uid: "fact-1",
    contact: "alex",
    kind: "fact",
    text: "Allergic to cats",
    source: "user",
  },
  {
    uid: "recent-share",
    contact: "alex",
    kind: "recent",
    text: "The move",
    source: "share",
  },
  {
    uid: "recent-label",
    contact: "bea",
    kind: "recent",
    label: "Label only",
    source: "user",
  },
  {
    uid: "recent-url",
    contact: "bea",
    kind: "recent",
    url: "https://r.test",
    source: "ai",
  },
  {
    uid: "unknown-kind",
    contact: "alex",
    kind: "article",
    text: "Something",
    source: "user",
  },
  {
    uid: "label-only-gift",
    contact: "bea",
    kind: "gift",
    label: "Candle",
    source: "user",
  },
  // D-97: contentless non-off_limits rows are skipped on both paths.
  {
    uid: "blank-gift",
    contact: "alex",
    kind: "gift",
    text: " ",
    source: "user",
  },
  { uid: "blank-recent", contact: "bea", kind: "recent", source: "share" },
  // Odd created_at: the entry date falls back to modified_at, then to now.
  {
    uid: "recent-odd-created",
    contact: "alex",
    kind: "recent",
    text: "Odd",
    source: "user",
    createdAt: "yesterday",
    modifiedAt: "2026-07-03 01:02:03",
  },
  {
    uid: "recent-odd-both",
    contact: "alex",
    kind: "recent",
    text: "Odder",
    source: "user",
    createdAt: "?",
    modifiedAt: "??",
  },
  // Collisions (F-D5; convergence c3, c4, c7).
  {
    uid: "x",
    contact: "alex",
    kind: "gift",
    text: "Collides with memory x",
    source: "user",
  },
  {
    uid: "y",
    contact: "alex",
    kind: "gift",
    text: "Second-level collision",
    source: "user",
  },
  {
    uid: "z",
    contact: "alex",
    kind: "gift",
    text: "Soft-deleted collision",
    source: "user",
  },
  {
    uid: "q",
    contact: "bea",
    kind: "topic",
    text: "Tombstone-only collision",
    source: "user",
  },
  {
    uid: "w",
    contact: "bea",
    kind: "recent",
    text: "Current-state collision",
    source: "user",
  },
];

interface MemorySeed {
  uid: string;
  contact: (typeof CONTACTS)[number];
  type: string;
  customLabel?: string | null;
  value?: string | null;
  allowAi?: number;
  deletedAt?: string | null;
}

const MEMORIES: MemorySeed[] = [
  {
    uid: "x",
    contact: "alex",
    type: "general",
    value: "Existing x",
    allowAi: 1,
  },
  { uid: "tx", contact: "alex", type: "general", value: "Existing tx" },
  { uid: "y", contact: "alex", type: "general", value: "Existing y" },
  {
    uid: "legacy-memories-y",
    contact: "alex",
    type: "general",
    value: "Existing legacy y",
  },
  {
    uid: "z",
    contact: "alex",
    type: "general",
    value: "Trashed z",
    deletedAt: "2026-09-01 00:00:00",
  },
  {
    uid: "m-custom",
    contact: "bea",
    type: "custom",
    customLabel: "Allergy",
    value: "Peanuts",
    allowAi: 1,
  },
  {
    uid: "m-custom-trash",
    contact: "bea",
    type: "custom",
    customLabel: "Old",
    value: "Gone",
    deletedAt: "2026-09-02 00:00:00",
  },
  {
    uid: "m-imported",
    contact: "bea",
    type: "imported",
    value: "From the address book",
  },
];

const RELATIONSHIPS = [
  { uid: "r-live", contact: "alex", personName: "Sam", deletedAt: null },
  {
    uid: "r-trash",
    contact: "bea",
    personName: "Kim",
    deletedAt: "2026-09-03 00:00:00",
  },
] as const;

const CURRENT_STATE = [
  {
    uid: "w",
    contact: "bea",
    fieldKey: "last_talked_about",
    value: "Existing w",
    isCurrent: 1,
    createdAt: "2026-05-05 05:05:05",
  },
  {
    uid: "cs-history",
    contact: "alex",
    fieldKey: "current_location",
    value: "Chicago",
    isCurrent: 0,
    createdAt: STAMP,
  },
  {
    uid: "cs-odd",
    contact: "alex",
    fieldKey: "current_location",
    value: "Madison",
    isCurrent: 1,
    createdAt: "not a date",
  },
] as const;

/** Pre-existing tombstones, including the legacy kind. */
const TOMBSTONES = [
  { entityType: "fuel", entityUid: "dead-1", deletedAt: "2026-08-01 00:00:00" },
  // A legacy tombstone whose uid a destination already holds (and no legacy
  // row shares it, so no live row ever sits under its re-minted uid).
  { entityType: "fuel", entityUid: "tx", deletedAt: "2026-04-01 00:00:00" },
  { entityType: "memory", entityUid: "q", deletedAt: "2026-08-15 00:00:00" },
  {
    entityType: "relationship",
    entityUid: "r-old",
    deletedAt: "2026-08-16 00:00:00",
  },
] as const;

// --- Path A: raw rows at v32, then migration 033 ----------------------------

async function pathA(): Promise<SqlExecutor> {
  const exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, 32, deps(STAMP));
  const ids = new Map<string, number>();
  for (const uid of CONTACTS)
    ids.set(
      uid,
      (
        await exec.runAsync(
          "INSERT INTO contacts (uid, name, interval_days, created_at, modified_at) VALUES (?, ?, 30, ?, ?)",
          [uid, uid, STAMP, STAMP],
        )
      ).lastInsertRowId,
    );
  for (const row of LEGACY_ROWS)
    await exec.runAsync(
      `INSERT INTO fuel (uid, contact_id, kind, label, text, url, created_at, source, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.uid,
        ids.get(row.contact),
        row.kind,
        row.label ?? null,
        row.text ?? null,
        row.url ?? null,
        row.createdAt ?? "2026-07-01 09:30:00",
        row.source,
        row.modifiedAt ?? "2026-07-02 10:00:00",
      ],
    );
  for (const row of MEMORIES)
    await exec.runAsync(
      `INSERT INTO memories (uid, contact_id, type, custom_label, value, pinned, outdated, provenance, allow_ai, created_at, modified_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, 0, 0, 'user', ?, ?, ?, ?)`,
      [
        row.uid,
        ids.get(row.contact),
        row.type,
        row.customLabel ?? null,
        row.value ?? null,
        row.allowAi ?? 0,
        STAMP,
        STAMP,
        row.deletedAt ?? null,
      ],
    );
  for (const row of RELATIONSHIPS)
    await exec.runAsync(
      `INSERT INTO relationships (uid, contact_id, person_name, pinned, created_at, modified_at, deleted_at)
       VALUES (?, ?, ?, 0, ?, ?, ?)`,
      [
        row.uid,
        ids.get(row.contact),
        row.personName,
        STAMP,
        STAMP,
        row.deletedAt,
      ],
    );
  for (const row of CURRENT_STATE)
    await exec.runAsync(
      `INSERT INTO current_state_entries (uid, contact_id, field_key, value, is_current, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        row.uid,
        ids.get(row.contact),
        row.fieldKey,
        row.value,
        row.isCurrent,
        row.createdAt,
        STAMP,
      ],
    );
  for (const row of TOMBSTONES)
    await exec.runAsync(
      "INSERT INTO tombstones (entity_type, entity_uid, deleted_at) VALUES (?, ?, ?)",
      [row.entityType, row.entityUid, row.deletedAt],
    );
  await runMigrations(exec, MIGRATIONS, 33, deps(EXPORTED));
  return exec;
}

// --- Path B: the same data as a format-7 file, parsed and restored ----------

function v7Manifest(): Record<string, unknown> {
  return {
    backupFormatVersion: 7,
    envelopeVersion: 1,
    metadata: { exportedAt: EXPORTED, sqliteUserVersion: 32 },
    appSettings: { sunContactUid: null, modifiedAt: STAMP },
    categories: [],
    profile: null,
    contacts: CONTACTS.map((uid) => ({
      uid,
      name: uid,
      categoryUid: null,
      trackingEnabled: 1,
      intervalDays: 30,
      socialBattery: null,
      birthday: null,
      archivedAt: null,
      snoozeUntil: null,
      rarelyResponds: 0,
      remindersOff: 0,
      createdAt: STAMP,
      modifiedAt: STAMP,
      photoBase64: null,
    })),
    contactMethods: [],
    externalContactLinks: [],
    contactMethodProvenance: [],
    interactions: [],
    events: [],
    fuel: LEGACY_ROWS.map((row) => ({
      uid: row.uid,
      contactUid: row.contact,
      kind: row.kind,
      label: row.label ?? null,
      text: row.text ?? null,
      url: row.url ?? null,
      createdAt: row.createdAt ?? "2026-07-01 09:30:00",
      source: row.source,
      modifiedAt: row.modifiedAt ?? "2026-07-02 10:00:00",
    })),
    contactLinks: [],
    customFieldDefs: [],
    customFieldValues: [],
    memories: MEMORIES.map((row) => ({
      uid: row.uid,
      contactUid: row.contact,
      type: row.type,
      customLabel: row.customLabel ?? null,
      value: row.value ?? null,
      note: null,
      url: null,
      meaningfulDate: null,
      pinned: 0,
      outdated: 0,
      hidden: null,
      provenance: "user",
      allowAi: row.allowAi ?? 0,
      createdAt: STAMP,
      modifiedAt: STAMP,
      deletedAt: row.deletedAt ?? null,
    })),
    relationships: RELATIONSHIPS.map((row) => ({
      uid: row.uid,
      contactUid: row.contact,
      personName: row.personName,
      relationType: null,
      linkedContactUid: null,
      note: null,
      pinned: 0,
      hidden: null,
      createdAt: STAMP,
      modifiedAt: STAMP,
      deletedAt: row.deletedAt,
    })),
    currentStateEntries: CURRENT_STATE.map((row) => ({
      uid: row.uid,
      contactUid: row.contact,
      fieldKey: row.fieldKey,
      value: row.value,
      isCurrent: row.isCurrent,
      createdAt: row.createdAt,
      modifiedAt: STAMP,
    })),
    tombstones: TOMBSTONES.map((row) => ({ ...row })),
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
  };
}

async function pathB(): Promise<SqlExecutor> {
  const exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, deps(STAMP));
  const manifest = parseBackupManifest(v7Manifest());
  const result = await applyRestore(exec, manifest, "replace-all");
  expect(result.status).toBe("applied");
  return exec;
}

// --- Normalized reads --------------------------------------------------------

async function snapshot(exec: SqlExecutor) {
  return {
    memories: await exec.getAllAsync(
      `SELECT m.uid, c.uid AS contact, m.type, m.custom_label, m.value, m.note,
              m.url, m.meaningful_date, m.pinned, m.outdated, m.hidden,
              m.provenance, m.allow_ai, m.interaction_id, m.link_source,
              m.group_note_copy, m.created_at, m.modified_at, m.deleted_at
         FROM memories m JOIN contacts c ON c.id = m.contact_id ORDER BY m.uid`,
    ),
    offLimits: await exec.getAllAsync(
      `SELECT o.uid, c.uid AS contact, o.label, o.text, o.url,
              o.group_note_copy, o.from_share, o.created_at, o.modified_at
         FROM off_limits o JOIN contacts c ON c.id = o.contact_id ORDER BY o.uid`,
    ),
    currentState: await exec.getAllAsync(
      `SELECT s.uid, c.uid AS contact, s.field_key, s.value, s.entry_date,
              s.entry_time, s.url, s.interaction_id, s.link_source,
              s.group_note_copy, s.from_share, s.created_at, s.modified_at
         FROM current_state_entries s JOIN contacts c ON c.id = s.contact_id
        ORDER BY s.uid`,
    ),
    relationships: await exec.getAllAsync(
      `SELECT r.uid, c.uid AS contact, r.person_name, r.relation_type,
              r.linked_contact_id, r.note, r.pinned, r.hidden, r.created_at,
              r.modified_at, r.deleted_at
         FROM relationships r JOIN contacts c ON c.id = r.contact_id ORDER BY r.uid`,
    ),
    tombstones: await exec.getAllAsync(
      `SELECT entity_type, entity_uid, deleted_at FROM tombstones
        WHERE entity_type IN ('memory', 'off_limits', 'current_state_entry', 'relationship')
        ORDER BY entity_type, entity_uid`,
    ),
  };
}

describe("migration 033 and the v7 converter agree (RESEARCH 1.4)", () => {
  it("produce equal rows by uid over the full fixture", async () => {
    const a = await snapshot(await pathA());
    const b = await snapshot(await pathB());
    expect(b.memories).toEqual(a.memories);
    expect(b.offLimits).toEqual(a.offLimits);
    expect(b.currentState).toEqual(a.currentState);
    expect(b.relationships).toEqual(a.relationships);
    expect(b.tombstones).toEqual(a.tombstones);
  });

  it("covers the collision, skip and fallback cases it claims to", async () => {
    const a = await snapshot(await pathA());
    const memoryUids = a.memories.map((row) => (row as { uid: string }).uid);
    // Plain, second-level, soft-deleted and tombstone-only collisions.
    expect(memoryUids).toEqual(
      expect.arrayContaining([
        "x",
        "legacy-memories-x",
        "y",
        "legacy-memories-y",
        "legacy-memories-y-2",
        "legacy-memories-z",
        "legacy-memories-q",
      ]),
    );
    expect(memoryUids).not.toContain("z");
    expect(memoryUids).not.toContain("m-custom-trash");
    expect(memoryUids).not.toContain("blank-gift");
    expect(a.memories).toContainEqual(
      expect.objectContaining({
        uid: "m-custom",
        type: "general",
        custom_label: "Allergy",
        modified_at: EXPORTED,
      }),
    );
    const stateUids = a.currentState.map((row) => (row as { uid: string }).uid);
    expect(stateUids).toEqual(
      expect.arrayContaining(["w", "legacy-current_state_entries-w"]),
    );
    expect(stateUids).not.toContain("blank-recent");
    expect(a.currentState).toContainEqual(
      expect.objectContaining({
        uid: "recent-odd-created",
        entry_date: "2026-07-03",
      }),
    );
    expect(a.currentState).toContainEqual(
      expect.objectContaining({
        uid: "recent-odd-both",
        entry_date: "2026-10-01",
      }),
    );
    expect(a.currentState).toContainEqual(
      expect.objectContaining({ uid: "cs-odd", entry_date: "2026-06-01" }),
    );
    expect(a.offLimits).toContainEqual(
      expect.objectContaining({ uid: "ol-share", from_share: 1 }),
    );
    expect(a.currentState).toContainEqual(
      expect.objectContaining({ uid: "recent-share", from_share: 1 }),
    );
    // The collided legacy tombstone lands under the re-minted memory uid only.
    expect(a.tombstones).toEqual(
      expect.arrayContaining([
        {
          entity_type: "memory",
          entity_uid: "legacy-memories-tx",
          deleted_at: "2026-04-01 00:00:00",
        },
        {
          entity_type: "off_limits",
          entity_uid: "tx",
          deleted_at: "2026-04-01 00:00:00",
        },
        {
          entity_type: "current_state_entry",
          entity_uid: "tx",
          deleted_at: "2026-04-01 00:00:00",
        },
        {
          entity_type: "memory",
          entity_uid: "z",
          deleted_at: "2026-09-01 00:00:00",
        },
        {
          entity_type: "relationship",
          entity_uid: "r-trash",
          deleted_at: "2026-09-03 00:00:00",
        },
      ]),
    );
  });
});
