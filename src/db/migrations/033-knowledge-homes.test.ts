import type { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  applyMigration033,
  isMigration033IntegrityError,
  KNOWLEDGE_HOMES_SCHEMA_VERSION,
} from "@/db/migrations/033-knowledge-homes";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-10-13 12:00:00";

function deps() {
  let counter = 0;
  return { now: NOW, newUid: () => `migration-uid-${++counter}` };
}

interface Harness {
  db: DatabaseSync;
  exec: SqlExecutor;
}

async function at(version: number): Promise<Harness> {
  const db = openTestDb();
  const exec = nodeSqliteExecutor(db);
  await runMigrations(exec, MIGRATIONS, version, deps());
  return { db, exec };
}

async function migrate(exec: SqlExecutor, version = 33): Promise<void> {
  await runMigrations(exec, MIGRATIONS, version, deps());
}

async function userVersion(exec: SqlExecutor): Promise<number> {
  return (
    (await exec.getFirstAsync<{ user_version: number }>("PRAGMA user_version"))
      ?.user_version ?? -1
  );
}

async function seedContact(exec: SqlExecutor, uid = "alex"): Promise<number> {
  return (
    await exec.runAsync(
      `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
       VALUES (?, ?, 30, ?, ?)`,
      [uid, uid, NOW, NOW],
    )
  ).lastInsertRowId;
}

interface FuelSeed {
  uid: string;
  kind: string;
  label?: string | null;
  text?: string | null;
  url?: string | null;
  source?: string;
  createdAt?: string;
  modifiedAt?: string;
}

async function seedFuel(
  exec: SqlExecutor,
  contactId: number,
  seed: FuelSeed,
): Promise<void> {
  await exec.runAsync(
    `INSERT INTO fuel (uid, contact_id, kind, label, text, url, created_at, source, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      seed.uid,
      contactId,
      seed.kind,
      seed.label ?? null,
      seed.text ?? null,
      seed.url ?? null,
      seed.createdAt ?? "2026-08-01 09:00:00",
      seed.source ?? "user",
      seed.modifiedAt ?? "2026-08-02 10:00:00",
    ],
  );
}

/** node:sqlite throws synchronously; lift it into a rejected promise. */
function attempt<T>(fn: () => Promise<T>): Promise<T> {
  return Promise.resolve().then(fn);
}

async function tableExists(exec: SqlExecutor, name: string): Promise<boolean> {
  return (
    (await exec.getFirstAsync(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      [name],
    )) !== null
  );
}

async function fkClean(exec: SqlExecutor): Promise<void> {
  for (const table of ["off_limits", "memories", "current_state_entries"]) {
    expect(
      await exec.getAllAsync(`PRAGMA foreign_key_check(${table})`),
    ).toEqual([]);
  }
}

describe("migration 033 — tracer", () => {
  it("moves one off_limits row to the new table with its uid, drops the legacy table, FK clean", async () => {
    const { exec } = await at(32);
    const contactId = await seedContact(exec);
    await seedFuel(exec, contactId, {
      uid: "ol-1",
      kind: "off_limits",
      text: "Her divorce",
    });

    await migrate(exec);

    expect(await userVersion(exec)).toBe(33);
    expect(
      await exec.getFirstAsync(
        "SELECT uid, contact_id, text FROM off_limits WHERE uid = 'ol-1'",
      ),
    ).toEqual({ uid: "ol-1", contact_id: contactId, text: "Her divorce" });
    expect(await tableExists(exec, "fuel")).toBe(false);
    await fkClean(exec);
  });
});

interface MemoryRow {
  uid: string;
  type: string;
  custom_label: string | null;
  value: string | null;
  url: string | null;
  provenance: string;
  allow_ai: number;
  pinned: number;
  hidden: number | null;
  created_at: string;
  modified_at: string;
  interaction_id: number | null;
  link_source: string | null;
  group_note_copy: number;
}

async function memory(
  exec: SqlExecutor,
  uid: string,
): Promise<MemoryRow | null> {
  return exec.getFirstAsync<MemoryRow>(
    `SELECT uid, type, custom_label, value, url, provenance, allow_ai, pinned, hidden,
            created_at, modified_at, interaction_id, link_source, group_note_copy
       FROM memories WHERE uid = ?`,
    [uid],
  );
}

async function tombstones(
  exec: SqlExecutor,
): Promise<{ entity_type: string; entity_uid: string; deleted_at: string }[]> {
  return exec.getAllAsync(
    "SELECT entity_type, entity_uid, deleted_at FROM tombstones ORDER BY entity_type, entity_uid",
  );
}

async function seedMemory(
  exec: SqlExecutor,
  contactId: number,
  uid: string,
  extra: {
    type?: string;
    label?: string | null;
    deletedAt?: string | null;
  } = {},
): Promise<void> {
  await exec.runAsync(
    `INSERT INTO memories (uid, contact_id, type, custom_label, value, created_at, modified_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid,
      contactId,
      extra.type ?? "general",
      extra.label ?? null,
      `pre-existing ${uid}`,
      "2026-01-01 00:00:00",
      "2026-01-01 00:00:00",
      extra.deletedAt ?? null,
    ],
  );
}

async function seedTombstone(
  exec: SqlExecutor,
  entityType: string,
  uid: string,
  deletedAt = "2026-07-01 08:00:00",
): Promise<void> {
  await exec.runAsync(
    "INSERT INTO tombstones (entity_type, entity_uid, deleted_at) VALUES (?, ?, ?)",
    [entityType, uid, deletedAt],
  );
}

async function seedInteraction(
  exec: SqlExecutor,
  contactId: number,
  uid: string,
): Promise<number> {
  return (
    await exec.runAsync(
      `INSERT INTO interactions (uid, contact_id, occurred_at, recorded_at, source, modified_at)
       VALUES (?, ?, ?, ?, 'manual', ?)`,
      [uid, contactId, NOW, NOW, NOW],
    )
  ).lastInsertRowId;
}

describe("migration 033 — registration", () => {
  it("is the registered schema head", () => {
    expect(KNOWLEDGE_HOMES_SCHEMA_VERSION).toBe(33);
    expect(TARGET_VERSION).toBe(KNOWLEDGE_HOMES_SCHEMA_VERSION);
    expect(MIGRATIONS.filter((m) => m.version === 33)).toHaveLength(1);
  });
});

describe("migration 033 — legacy rows by kind and source (D-56, D-108)", () => {
  it("maps every kind and source to its home with Allow AI off and the uid kept", async () => {
    const { exec } = await at(32);
    const c = await seedContact(exec);
    const seeds: FuelSeed[] = [
      {
        uid: "ol-user",
        kind: "off_limits",
        label: "Topic",
        text: "Her divorce",
        url: "https://x.test/a",
      },
      {
        uid: "ol-share",
        kind: "off_limits",
        text: "Shared sore spot",
        source: "share",
      },
      {
        uid: "gift-user",
        kind: "gift",
        label: "Birthday",
        text: "Climbing shoes",
        url: "https://x.test/g",
      },
      {
        uid: "topic-share",
        kind: "topic",
        text: "Article about tea",
        url: "https://x.test/t",
        source: "share",
      },
      { uid: "topic-ai", kind: "topic", text: "AI proposal", source: "ai" },
      { uid: "fact-user", kind: "fact", text: "Allergic to cats" },
      { uid: "fact-url", kind: "fact", url: "https://x.test/only-url" },
      { uid: "gift-label", kind: "gift", label: "Label only" },
      { uid: "mystery", kind: "hobby", text: "Unknown kind lands general" },
      { uid: "proto", kind: "toString", text: "Prototype key is unknown" },
      {
        uid: "recent-user",
        kind: "recent",
        label: "Lbl",
        text: "Talked about the move",
        createdAt: "2026-07-04 21:30:00",
      },
      {
        uid: "recent-share",
        kind: "recent",
        label: "Label wins over url",
        url: "https://x.test/r",
        source: "share",
      },
      { uid: "recent-url", kind: "recent", url: "https://x.test/url-only" },
      // D-128: label and text both present -> "<label>: <text>", trimmed.
      {
        uid: "recent-labelled",
        kind: "recent",
        label: "  Work ",
        text: " new job  ",
        url: "https://x.test/job",
      },
      {
        uid: "recent-odd",
        kind: "recent",
        text: "Odd created",
        createdAt: "yesterday",
        modifiedAt: "2026-08-05 07:00:00",
      },
      {
        uid: "recent-odder",
        kind: "recent",
        text: "Odd both",
        createdAt: "n/a",
        modifiedAt: "?",
      },
    ];
    for (const seed of seeds) await seedFuel(exec, c, seed);

    await migrate(exec);

    expect(
      await exec.getAllAsync(
        `SELECT uid, contact_id, label, text, url, group_note_copy, from_share, created_at, modified_at
           FROM off_limits ORDER BY uid`,
      ),
    ).toEqual([
      {
        uid: "ol-share",
        contact_id: c,
        label: null,
        text: "Shared sore spot",
        url: null,
        group_note_copy: 0,
        from_share: 1,
        created_at: "2026-08-01 09:00:00",
        modified_at: "2026-08-02 10:00:00",
      },
      {
        uid: "ol-user",
        contact_id: c,
        label: "Topic",
        text: "Her divorce",
        url: "https://x.test/a",
        group_note_copy: 0,
        from_share: 0,
        created_at: "2026-08-01 09:00:00",
        modified_at: "2026-08-02 10:00:00",
      },
    ]);

    const base = {
      allow_ai: 0,
      pinned: 0,
      hidden: null,
      created_at: "2026-08-01 09:00:00",
      modified_at: "2026-08-02 10:00:00",
      interaction_id: null,
      link_source: null,
      group_note_copy: 0,
    };
    expect(await memory(exec, "gift-user")).toEqual({
      ...base,
      uid: "gift-user",
      type: "gift_idea",
      custom_label: "Birthday",
      value: "Climbing shoes",
      url: "https://x.test/g",
      provenance: "user",
    });
    expect(await memory(exec, "topic-share")).toEqual({
      ...base,
      uid: "topic-share",
      type: "thought_of_them",
      custom_label: null,
      value: "Article about tea",
      url: "https://x.test/t",
      provenance: "share",
    });
    expect(await memory(exec, "topic-ai")).toEqual({
      ...base,
      uid: "topic-ai",
      type: "thought_of_them",
      custom_label: null,
      value: "AI proposal",
      url: null,
      provenance: "user",
    });
    expect(await memory(exec, "fact-user")).toEqual({
      ...base,
      uid: "fact-user",
      type: "general",
      custom_label: null,
      value: "Allergic to cats",
      url: null,
      provenance: "user",
    });
    expect(await memory(exec, "fact-url")).toEqual({
      ...base,
      uid: "fact-url",
      type: "general",
      custom_label: null,
      value: "https://x.test/only-url",
      url: "https://x.test/only-url",
      provenance: "user",
    });
    expect(await memory(exec, "gift-label")).toEqual({
      ...base,
      uid: "gift-label",
      type: "gift_idea",
      custom_label: "Label only",
      value: null,
      url: null,
      provenance: "user",
    });
    expect((await memory(exec, "mystery"))?.type).toBe("general");
    expect((await memory(exec, "proto"))?.type).toBe("general");

    expect(
      await exec.getAllAsync(
        `SELECT uid, field_key, value, entry_date, entry_time, url, interaction_id, link_source,
                group_note_copy, from_share, created_at, modified_at
           FROM current_state_entries ORDER BY uid`,
      ),
    ).toEqual([
      {
        uid: "recent-labelled",
        field_key: "last_talked_about",
        value: "Work: new job",
        entry_date: "2026-08-01",
        entry_time: null,
        url: "https://x.test/job",
        interaction_id: null,
        link_source: null,
        group_note_copy: 0,
        from_share: 0,
        created_at: "2026-08-01 09:00:00",
        modified_at: "2026-08-02 10:00:00",
      },
      {
        uid: "recent-odd",
        field_key: "last_talked_about",
        value: "Odd created",
        entry_date: "2026-08-05",
        entry_time: null,
        url: null,
        interaction_id: null,
        link_source: null,
        group_note_copy: 0,
        from_share: 0,
        created_at: "yesterday",
        modified_at: "2026-08-05 07:00:00",
      },
      {
        uid: "recent-odder",
        field_key: "last_talked_about",
        value: "Odd both",
        entry_date: "2026-10-13",
        entry_time: null,
        url: null,
        interaction_id: null,
        link_source: null,
        group_note_copy: 0,
        from_share: 0,
        created_at: "n/a",
        modified_at: "?",
      },
      {
        uid: "recent-share",
        field_key: "last_talked_about",
        value: "Label wins over url",
        entry_date: "2026-08-01",
        entry_time: null,
        url: "https://x.test/r",
        interaction_id: null,
        link_source: null,
        group_note_copy: 0,
        from_share: 1,
        created_at: "2026-08-01 09:00:00",
        modified_at: "2026-08-02 10:00:00",
      },
      {
        uid: "recent-url",
        field_key: "last_talked_about",
        value: "https://x.test/url-only",
        entry_date: "2026-08-01",
        entry_time: null,
        url: "https://x.test/url-only",
        interaction_id: null,
        link_source: null,
        group_note_copy: 0,
        from_share: 0,
        created_at: "2026-08-01 09:00:00",
        modified_at: "2026-08-02 10:00:00",
      },
      {
        uid: "recent-user",
        field_key: "last_talked_about",
        value: "Lbl: Talked about the move",
        entry_date: "2026-07-04",
        entry_time: null,
        url: null,
        interaction_id: null,
        link_source: null,
        group_note_copy: 0,
        from_share: 0,
        created_at: "2026-07-04 21:30:00",
        modified_at: "2026-08-02 10:00:00",
      },
    ]);
    expect(
      await exec.getFirstAsync(
        "SELECT COUNT(*) AS n FROM memories WHERE allow_ai != 0",
      ),
    ).toEqual({ n: 0 });
    expect(await tableExists(exec, "fuel")).toBe(false);
    await fkClean(exec);
  });

  it("D-97: skips and counts contentless non-off_limits rows, copies a contentless off_limits row as-is", async () => {
    const { exec } = await at(32);
    const c = await seedContact(exec);
    await seedFuel(exec, c, { uid: "empty-ol", kind: "off_limits" });
    await seedFuel(exec, c, {
      uid: "empty-gift",
      kind: "gift",
      text: "   ",
      label: "",
      url: null,
    });
    await seedFuel(exec, c, {
      uid: "empty-recent",
      kind: "recent",
      text: null,
      label: " \n",
    });
    await seedFuel(exec, c, { uid: "kept", kind: "fact", text: "Has content" });

    await exec.execAsync("BEGIN");
    const result = await applyMigration033(exec, deps());
    await exec.execAsync("COMMIT");

    expect(result.skippedContentless).toBe(2);
    expect(result.copied).toEqual({
      offLimits: 1,
      memories: 1,
      currentState: 0,
    });
    expect(
      await exec.getFirstAsync("SELECT uid, label, text, url FROM off_limits"),
    ).toEqual({ uid: "empty-ol", label: null, text: null, url: null });
    expect(await memory(exec, "empty-gift")).toBeNull();
    expect(
      await exec.getFirstAsync(
        "SELECT COUNT(*) AS n FROM current_state_entries",
      ),
    ).toEqual({ n: 0 });
    expect(await tableExists(exec, "fuel")).toBe(false);
  });

  it("migrates an empty v32 database (no legacy rows) cleanly", async () => {
    const { exec } = await at(32);
    await migrate(exec);
    expect(await userVersion(exec)).toBe(33);
    expect(await tableExists(exec, "fuel")).toBe(false);
    expect(await tableExists(exec, "off_limits")).toBe(true);
    await fkClean(exec);
  });
});

describe("migration 033 — uid collisions (F-D5; convergence c3, c4, c7)", () => {
  it("re-mints a collided uid to legacy-<table>-<uid>; its tombstone follows for that table only", async () => {
    const { exec } = await at(32);
    const c = await seedContact(exec);
    await seedMemory(exec, c, "x");
    await seedFuel(exec, c, { uid: "x", kind: "gift", text: "Gift copy" });
    await seedTombstone(exec, "fuel", "x", "2026-07-09 10:00:00");
    const v32Columns =
      "SELECT id, uid, contact_id, type, custom_label, value, url, provenance, allow_ai, created_at, modified_at, deleted_at FROM memories WHERE uid = 'x'";
    const before = await exec.getFirstAsync(v32Columns);

    await migrate(exec);

    expect(await exec.getFirstAsync(v32Columns)).toEqual(before);
    expect(await memory(exec, "x")).toMatchObject({
      interaction_id: null,
      link_source: null,
      group_note_copy: 0,
    });
    expect(await memory(exec, "legacy-memories-x")).toMatchObject({
      type: "gift_idea",
      value: "Gift copy",
      allow_ai: 0,
    });
    expect(await tombstones(exec)).toEqual([
      {
        entity_type: "current_state_entry",
        entity_uid: "x",
        deleted_at: "2026-07-09 10:00:00",
      },
      {
        entity_type: "memory",
        entity_uid: "legacy-memories-x",
        deleted_at: "2026-07-09 10:00:00",
      },
      {
        entity_type: "off_limits",
        entity_uid: "x",
        deleted_at: "2026-07-09 10:00:00",
      },
    ]);
  });

  it("re-mints against a soft-deleted memory's uid, after D-88 tombstones it (c4)", async () => {
    const { exec } = await at(32);
    const c = await seedContact(exec);
    await seedMemory(exec, c, "x", { deletedAt: "2026-06-30 18:00:00" });
    await seedFuel(exec, c, { uid: "x", kind: "gift", text: "Gift copy" });

    await migrate(exec);

    expect(await memory(exec, "x")).toBeNull();
    expect(await tombstones(exec)).toEqual([
      {
        entity_type: "memory",
        entity_uid: "x",
        deleted_at: "2026-06-30 18:00:00",
      },
    ]);
    expect((await memory(exec, "legacy-memories-x"))?.value).toBe("Gift copy");
  });

  it("takes -2 when legacy-memories-x is already a live memory (c3)", async () => {
    const { exec } = await at(32);
    const c = await seedContact(exec);
    await seedMemory(exec, c, "x");
    await seedMemory(exec, c, "legacy-memories-x");
    await seedFuel(exec, c, { uid: "x", kind: "gift", text: "Gift copy" });
    await seedTombstone(exec, "fuel", "x");

    await migrate(exec);

    expect((await memory(exec, "x"))?.value).toBe("pre-existing x");
    expect((await memory(exec, "legacy-memories-x"))?.value).toBe(
      "pre-existing legacy-memories-x",
    );
    expect((await memory(exec, "legacy-memories-x-2"))?.value).toBe(
      "Gift copy",
    );
    expect(
      (await tombstones(exec)).filter((t) => t.entity_type === "memory"),
    ).toEqual([
      {
        entity_type: "memory",
        entity_uid: "legacy-memories-x-2",
        deleted_at: "2026-07-01 08:00:00",
      },
    ]);
  });

  it("treats a tombstone-only uid as taken (c7)", async () => {
    const one = await at(32);
    const c1 = await seedContact(one.exec);
    await seedTombstone(one.exec, "memory", "x");
    await seedFuel(one.exec, c1, { uid: "x", kind: "gift", text: "Gift copy" });
    await migrate(one.exec);
    expect((await memory(one.exec, "legacy-memories-x"))?.value).toBe(
      "Gift copy",
    );
    expect(await memory(one.exec, "x")).toBeNull();

    const two = await at(32);
    const c2 = await seedContact(two.exec);
    await seedTombstone(two.exec, "memory", "x");
    await seedTombstone(two.exec, "memory", "legacy-memories-x");
    await seedFuel(two.exec, c2, { uid: "x", kind: "gift", text: "Gift copy" });
    await migrate(two.exec);
    expect((await memory(two.exec, "legacy-memories-x-2"))?.value).toBe(
      "Gift copy",
    );
    expect(await memory(two.exec, "legacy-memories-x")).toBeNull();
  });
});

describe("migration 033 — D-88, D-86, tombstones", () => {
  it("D-88: tombstones soft-deleted memories and key people with their deleted_at, keeping a newer existing tombstone", async () => {
    const { exec } = await at(32);
    const c = await seedContact(exec);
    await seedMemory(exec, c, "m-live");
    await seedMemory(exec, c, "m-gone", { deletedAt: "2026-05-05 05:05:05" });
    await seedMemory(exec, c, "m-older", { deletedAt: "2026-01-01 00:00:00" });
    await seedTombstone(exec, "memory", "m-older", "2026-09-09 09:09:09");
    for (const [uid, deletedAt] of [
      ["r-live", null],
      ["r-gone", "2026-04-04 04:04:04"],
    ] as const) {
      await exec.runAsync(
        `INSERT INTO relationships (uid, contact_id, person_name, created_at, modified_at, deleted_at)
         VALUES (?, ?, 'Blair', ?, ?, ?)`,
        [uid, c, NOW, NOW, deletedAt],
      );
    }

    await migrate(exec);

    expect(
      await exec.getAllAsync<{ uid: string }>(
        "SELECT uid FROM memories ORDER BY uid",
      ),
    ).toEqual([{ uid: "m-live" }]);
    expect(
      await exec.getAllAsync<{ uid: string }>(
        "SELECT uid FROM relationships ORDER BY uid",
      ),
    ).toEqual([{ uid: "r-live" }]);
    expect(await tombstones(exec)).toEqual([
      {
        entity_type: "memory",
        entity_uid: "m-gone",
        deleted_at: "2026-05-05 05:05:05",
      },
      {
        entity_type: "memory",
        entity_uid: "m-older",
        deleted_at: "2026-09-09 09:09:09",
      },
      {
        entity_type: "relationship",
        entity_uid: "r-gone",
        deleted_at: "2026-04-04 04:04:04",
      },
    ]);
  });

  it("D-86: custom memories become general with the label kept", async () => {
    const { exec } = await at(32);
    const c = await seedContact(exec);
    await seedMemory(exec, c, "custom-1", {
      type: "custom",
      label: "Favourite band",
    });
    await seedMemory(exec, c, "plain", { type: "general" });

    await migrate(exec);

    expect(await memory(exec, "custom-1")).toMatchObject({
      type: "general",
      custom_label: "Favourite band",
      value: "pre-existing custom-1",
      modified_at: NOW,
    });
    expect(await memory(exec, "plain")).toMatchObject({
      type: "general",
      modified_at: "2026-01-01 00:00:00",
    });
  });

  it("triples legacy tombstones and removes them", async () => {
    const { exec } = await at(32);
    await seedTombstone(exec, "fuel", "f-1", "2026-03-03 03:03:03");
    await seedTombstone(
      exec,
      "current_state_entry",
      "f-1",
      "2026-09-01 00:00:00",
    );

    await migrate(exec);

    // Pre-existing current_state_entry tombstone f-1 makes f-1 collide there,
    // so that leg lands under the allocated uid (convergence c7).
    expect(await tombstones(exec)).toEqual([
      {
        entity_type: "current_state_entry",
        entity_uid: "f-1",
        deleted_at: "2026-09-01 00:00:00",
      },
      {
        entity_type: "current_state_entry",
        entity_uid: "legacy-current_state_entries-f-1",
        deleted_at: "2026-03-03 03:03:03",
      },
      {
        entity_type: "memory",
        entity_uid: "f-1",
        deleted_at: "2026-03-03 03:03:03",
      },
      {
        entity_type: "off_limits",
        entity_uid: "f-1",
        deleted_at: "2026-03-03 03:03:03",
      },
    ]);
    expect(
      await exec.getFirstAsync(
        "SELECT COUNT(*) AS n FROM tombstones WHERE entity_type = 'fuel'",
      ),
    ).toEqual({ n: 0 });
  });
});

describe("migration 033 — current_state_entries rebuild", () => {
  it("drops is_current, dates existing rows, keeps ids and values, and swaps the indexes", async () => {
    const { exec } = await at(32);
    const c = await seedContact(exec);
    const rows = [
      [
        41,
        "cs-1",
        "last_talked_about",
        "Old topic",
        1,
        "2026-02-02 10:00:00",
        "2026-02-03 10:00:00",
      ],
      [
        42,
        "cs-2",
        "current_location",
        "Leeds",
        0,
        "bogus",
        "2026-03-03 11:00:00",
      ],
      [43, "cs-3", "current_location", "York", 1, "bogus", "also bogus"],
    ] as const;
    for (const [
      id,
      uid,
      field,
      value,
      isCurrent,
      createdAt,
      modifiedAt,
    ] of rows) {
      await exec.runAsync(
        `INSERT INTO current_state_entries (id, uid, contact_id, field_key, value, is_current, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, uid, c, field, value, isCurrent, createdAt, modifiedAt],
      );
    }

    await migrate(exec);

    expect(
      await exec.getAllAsync(
        `SELECT id, uid, contact_id, field_key, value, entry_date, entry_time, url,
                interaction_id, link_source, group_note_copy, from_share, created_at, modified_at
           FROM current_state_entries ORDER BY id`,
      ),
    ).toEqual([
      {
        id: 41,
        uid: "cs-1",
        contact_id: c,
        field_key: "last_talked_about",
        value: "Old topic",
        entry_date: "2026-02-02",
        entry_time: null,
        url: null,
        interaction_id: null,
        link_source: null,
        group_note_copy: 0,
        from_share: 0,
        created_at: "2026-02-02 10:00:00",
        modified_at: "2026-02-03 10:00:00",
      },
      {
        id: 42,
        uid: "cs-2",
        contact_id: c,
        field_key: "current_location",
        value: "Leeds",
        entry_date: "2026-03-03",
        entry_time: null,
        url: null,
        interaction_id: null,
        link_source: null,
        group_note_copy: 0,
        from_share: 0,
        created_at: "bogus",
        modified_at: "2026-03-03 11:00:00",
      },
      {
        id: 43,
        uid: "cs-3",
        contact_id: c,
        field_key: "current_location",
        value: "York",
        entry_date: "2026-10-13",
        entry_time: null,
        url: null,
        interaction_id: null,
        link_source: null,
        group_note_copy: 0,
        from_share: 0,
        created_at: "bogus",
        modified_at: "also bogus",
      },
    ]);
    const columns = (
      await exec.getAllAsync<{ name: string; notnull: number }>(
        "PRAGMA table_info(current_state_entries)",
      )
    ).map((r) => r.name);
    expect(columns).not.toContain("is_current");
    expect(
      (
        await exec.getAllAsync<{ name: string; notnull: number }>(
          "PRAGMA table_info(current_state_entries)",
        )
      ).find((r) => r.name === "entry_date")?.notnull,
    ).toBe(1);
    const indexes = (
      await exec.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'current_state_entries' AND name LIKE 'idx_%' ORDER BY name",
      )
    ).map((r) => r.name);
    expect(indexes).toEqual([
      "idx_current_state_interaction_link",
      "idx_current_state_order",
    ]);
    await fkClean(exec);
  });
});

describe("migration 033 — new columns and constraints", () => {
  it("adds both AI defaults at 0 and note_ai_locked at 0 on every interaction", async () => {
    const { exec } = await at(32);
    const c = await seedContact(exec);
    await seedInteraction(exec, c, "i-1");
    await exec.runAsync(
      "UPDATE interactions SET allow_ai = 1 WHERE uid = 'i-1'",
    );
    await seedInteraction(exec, c, "i-2");

    await migrate(exec);

    expect(
      await exec.getFirstAsync(
        "SELECT ai_default_gift_idea_allow, ai_default_thought_of_them_allow FROM app_settings WHERE id = 1",
      ),
    ).toEqual({
      ai_default_gift_idea_allow: 0,
      ai_default_thought_of_them_allow: 0,
    });
    expect(
      await exec.getAllAsync(
        "SELECT uid, allow_ai, note_ai_locked FROM interactions ORDER BY uid",
      ),
    ).toEqual([
      { uid: "i-1", allow_ai: 1, note_ai_locked: 0 },
      { uid: "i-2", allow_ai: 0, note_ai_locked: 0 },
    ]);
    // D-103: a locked note can never be switched back on, by any writer.
    await exec.runAsync(
      "UPDATE interactions SET note_ai_locked = 1 WHERE uid = 'i-2'",
    );
    await expect(
      attempt(() =>
        exec.runAsync("UPDATE interactions SET allow_ai = 1 WHERE uid = 'i-2'"),
      ),
    ).rejects.toThrow(/CHECK/);
    await expect(
      attempt(() =>
        exec.runAsync(
          "UPDATE interactions SET note_ai_locked = 1 WHERE uid = 'i-1'",
        ),
      ),
    ).rejects.toThrow(/CHECK/);
  });

  it("an interaction delete unlinks its entries; a linked row needs a link_source; one link per (interaction, source)", async () => {
    const { exec } = await at(32);
    const c = await seedContact(exec);
    await migrate(exec);
    const i = await seedInteraction(exec, c, "i-1");
    await exec.runAsync(
      `INSERT INTO memories (uid, contact_id, type, value, created_at, modified_at, interaction_id, link_source)
       VALUES ('m-linked', ?, 'general', 'note text', ?, ?, ?, 'note')`,
      [c, NOW, NOW, i],
    );
    await exec.runAsync(
      `INSERT INTO current_state_entries (uid, contact_id, field_key, value, entry_date, entry_time, created_at, modified_at, interaction_id, link_source)
       VALUES ('cs-linked', ?, 'last_talked_about', 'note text', '2026-10-13', '12:00:00', ?, ?, ?, 'group_note')`,
      [c, NOW, NOW, i],
    );
    await expect(
      attempt(() =>
        exec.runAsync(
          `INSERT INTO memories (uid, contact_id, type, value, created_at, modified_at, interaction_id, link_source)
         VALUES ('m-dup', ?, 'general', 'dup', ?, ?, ?, 'note')`,
          [c, NOW, NOW, i],
        ),
      ),
    ).rejects.toThrow(/UNIQUE/);
    // A different link source on the same interaction is a different note (D-96).
    await exec.runAsync(
      `INSERT INTO memories (uid, contact_id, type, value, created_at, modified_at, interaction_id, link_source)
       VALUES ('m-group', ?, 'general', 'group note', ?, ?, ?, 'group_note')`,
      [c, NOW, NOW, i],
    );
    for (const sql of [
      `INSERT INTO memories (uid, contact_id, type, value, created_at, modified_at, interaction_id, link_source)
       VALUES ('m-bad', ?, 'general', 'x', ?, ?, ?, NULL)`,
      `INSERT INTO current_state_entries (uid, contact_id, field_key, value, entry_date, created_at, modified_at, interaction_id, link_source)
       VALUES ('cs-bad', ?, 'last_talked_about', 'x', '2026-10-13', ?, ?, ?, NULL)`,
    ]) {
      await expect(
        attempt(() => exec.runAsync(sql, [c, NOW, NOW, i])),
      ).rejects.toThrow(/CHECK/);
    }
    await expect(
      attempt(() =>
        exec.runAsync(
          `INSERT INTO memories (uid, contact_id, type, value, created_at, modified_at, link_source)
         VALUES ('m-src', ?, 'general', 'x', ?, ?, 'bogus')`,
          [c, NOW, NOW],
        ),
      ),
    ).rejects.toThrow(/CHECK/);

    await exec.runAsync("DELETE FROM interactions WHERE id = ?", [i]);

    expect(
      await exec.getAllAsync(
        "SELECT uid, interaction_id, link_source FROM memories ORDER BY uid",
      ),
    ).toEqual([
      { uid: "m-group", interaction_id: null, link_source: "group_note" },
      { uid: "m-linked", interaction_id: null, link_source: "note" },
    ]);
    expect(
      await exec.getFirstAsync(
        "SELECT interaction_id, link_source FROM current_state_entries WHERE uid = 'cs-linked'",
      ),
    ).toEqual({ interaction_id: null, link_source: "group_note" });
  });

  it("D-102: group_note_copy is 0 on migrated rows and a copy refuses allow_ai 1", async () => {
    const { exec } = await at(32);
    const c = await seedContact(exec);
    await seedMemory(exec, c, "m-1");
    await seedFuel(exec, c, { uid: "g-1", kind: "gift", text: "Gift" });
    await seedFuel(exec, c, { uid: "o-1", kind: "off_limits", text: "No" });
    await seedFuel(exec, c, { uid: "r-1", kind: "recent", text: "Talked" });
    await migrate(exec);

    for (const table of ["memories", "off_limits", "current_state_entries"]) {
      expect(
        await exec.getFirstAsync(
          `SELECT COUNT(*) AS n FROM ${table} WHERE group_note_copy != 0`,
        ),
      ).toEqual({ n: 0 });
    }
    await exec.runAsync(
      "UPDATE memories SET group_note_copy = 1 WHERE uid = 'm-1'",
    );
    await expect(
      attempt(() =>
        exec.runAsync("UPDATE memories SET allow_ai = 1 WHERE uid = 'm-1'"),
      ),
    ).rejects.toThrow(/CHECK/);
    await exec.runAsync("UPDATE memories SET allow_ai = 1 WHERE uid = 'g-1'");
    await expect(
      attempt(() =>
        exec.runAsync(
          "UPDATE memories SET group_note_copy = 1 WHERE uid = 'g-1'",
        ),
      ),
    ).rejects.toThrow(/CHECK/);
  });
});

describe("migration 033 — jumps, rollback, scoped FK check", () => {
  it("migrates a fresh v0 database straight to v33", async () => {
    const { exec } = await at(0);
    await migrate(exec);
    expect(await userVersion(exec)).toBe(33);
    expect(await tableExists(exec, "fuel")).toBe(false);
    expect(await tableExists(exec, "off_limits")).toBe(true);
    await fkClean(exec);
  });

  it("migrates a v16 database with legacy rows straight to v33", async () => {
    const { exec } = await at(16);
    const c = await seedContact(exec);
    await seedFuel(exec, c, {
      uid: "share-topic",
      kind: "topic",
      text: "Shared",
      source: "share",
    });
    await seedFuel(exec, c, {
      uid: "user-topic",
      kind: "topic",
      text: "Typed",
    });
    await seedFuel(exec, c, { uid: "recent", kind: "recent", text: "Weather" });
    await seedFuel(exec, c, { uid: "ol", kind: "off_limits", text: "Ex" });
    await exec.runAsync(
      `INSERT INTO current_state_entries (uid, contact_id, field_key, value, is_current, created_at, modified_at)
       VALUES ('loc', ?, 'current_location', 'Paris', 1, '2026-01-01 00:00:00', '2026-01-01 00:00:00')`,
      [c],
    );

    await migrate(exec);

    expect(await userVersion(exec)).toBe(33);
    // 017 moved the share topic to a general share memory with a new uid.
    expect(
      await exec.getAllAsync(
        "SELECT type, value, provenance, allow_ai FROM memories ORDER BY value",
      ),
    ).toEqual([
      { type: "general", value: "Shared", provenance: "share", allow_ai: 0 },
      {
        type: "thought_of_them",
        value: "Typed",
        provenance: "user",
        allow_ai: 0,
      },
    ]);
    expect(await memory(exec, "user-topic")).not.toBeNull();
    expect(
      await exec.getAllAsync(
        "SELECT uid, field_key, value, entry_date FROM current_state_entries ORDER BY uid",
      ),
    ).toEqual([
      {
        uid: "loc",
        field_key: "current_location",
        value: "Paris",
        entry_date: "2026-01-01",
      },
      {
        uid: "recent",
        field_key: "last_talked_about",
        value: "Weather",
        entry_date: "2026-08-01",
      },
    ]);
    expect(await exec.getFirstAsync("SELECT uid FROM off_limits")).toEqual({
      uid: "ol",
    });
    await fkClean(exec);
  });

  it("a failed copy proof rolls everything back to v32 with the legacy rows unchanged", async () => {
    const { exec } = await at(32);
    const c = await seedContact(exec);
    await seedFuel(exec, c, { uid: "g-1", kind: "gift", text: "Gift" });
    await seedFuel(exec, c, { uid: "o-1", kind: "off_limits", text: "No" });
    await seedMemory(exec, c, "soft", { deletedAt: "2026-05-05 05:05:05" });
    const before = await exec.getAllAsync("SELECT * FROM fuel ORDER BY id");

    const tampering: SqlExecutor = {
      ...exec,
      async getFirstAsync<T>(sql: string, params?: unknown[]) {
        const row = await exec.getFirstAsync<T>(sql, params);
        if (row && /FROM memories WHERE uid = \?/.test(sql)) {
          return { ...row, value: "tampered" } as T;
        }
        return row;
      },
    };
    const error = await runMigrations(tampering, MIGRATIONS, 33, deps()).then(
      () => null,
      (e: unknown) => e,
    );

    expect(isMigration033IntegrityError(error)).toBe(true);
    expect(await userVersion(exec)).toBe(32);
    expect(await exec.getAllAsync("SELECT * FROM fuel ORDER BY id")).toEqual(
      before,
    );
    expect(await tableExists(exec, "off_limits")).toBe(false);
    expect(
      (
        await exec.getAllAsync<{ name: string }>(
          "PRAGMA table_info(current_state_entries)",
        )
      ).map((r) => r.name),
    ).toContain("is_current");
    expect(
      await exec.getFirstAsync("SELECT uid FROM memories WHERE uid = 'soft'"),
    ).toEqual({ uid: "soft" });
    expect(await tombstones(exec)).toEqual([]);
  });

  it("still migrates when an unrelated table holds a foreign-key violation (scoped check)", async () => {
    const { db, exec } = await at(32);
    const c = await seedContact(exec);
    await seedFuel(exec, c, { uid: "o-1", kind: "off_limits", text: "No" });
    db.exec("PRAGMA foreign_keys = OFF;");
    await exec.runAsync(
      `INSERT INTO interactions (uid, contact_id, occurred_at, recorded_at, source, modified_at)
       VALUES ('orphan', 9999, ?, ?, 'manual', ?)`,
      [NOW, NOW, NOW],
    );
    db.exec("PRAGMA foreign_keys = ON;");
    expect(
      await exec.getAllAsync("PRAGMA foreign_key_check(interactions)"),
    ).toHaveLength(1);

    await migrate(exec);

    expect(await userVersion(exec)).toBe(33);
    expect(await exec.getFirstAsync("SELECT uid FROM off_limits")).toEqual({
      uid: "o-1",
    });
    await fkClean(exec);
  });
});
