/**
 * Migration-1 schema + seed + FK-cascade proof (DATA-02 / DATA-03).
 *
 * This is the deterministic proof of the IRREVERSIBLE schema (RESEARCH
 * Validation Architecture Tier A): a fresh in-memory `node:sqlite` DB is driven
 * through the REAL runner, then every table, every un-backfillable column, the
 * seeds, the empty fuel table, the value-column-scoped index ban on
 * `contact_custom_values`, and the FK cascade are asserted. On unreachable
 * devices there is no second chance — this test is exhaustive on purpose.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";

const NOW = "2026-08-14 12:00:00";

let exec: SqlExecutor;

beforeEach(async () => {
  const db = openTestDb();
  exec = nodeSqliteExecutor(db);
  await runMigrations(exec, [migration001], 1, { now: NOW, newUid });
});

const ALL_TABLES = [
  "categories",
  "profile",
  "contacts",
  "contact_links",
  "interactions",
  "events",
  "custom_field_defs",
  "contact_custom_values",
  "field_history",
  "fuel",
];

async function columnsOf(table: string): Promise<Set<string>> {
  const rows = await exec.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${table})`,
  );
  return new Set(rows.map((r) => r.name));
}

describe("migration 1 — irreversible schema", () => {
  it("creates all ten tables", async () => {
    const rows = await exec.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    );
    const names = new Set(rows.map((r) => r.name));
    for (const t of ALL_TABLES) {
      expect(names.has(t), `table ${t} exists`).toBe(true);
    }
    expect(names.size).toBe(ALL_TABLES.length);
  });

  it("sets user_version to 1", async () => {
    const row = await exec.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version",
    );
    expect(row?.user_version).toBe(1);
  });

  it("contacts has every un-backfillable column", async () => {
    const cols = await columnsOf("contacts");
    for (const c of [
      "id",
      "uid",
      "name",
      "category_id",
      "interval_days",
      "social_battery",
      "birthday",
      "phone",
      "email",
      "photo",
      "last_contact",
      "favourite_rank",
      "ring_seq",
      "archived_at",
      "snooze_until",
      "rarely_responds",
      "reminders_off",
      "created_at",
      "modified_at",
    ]) {
      expect(cols.has(c), `contacts.${c}`).toBe(true);
    }
  });

  it("interactions has recorded_at and source", async () => {
    const cols = await columnsOf("interactions");
    expect(cols.has("recorded_at")).toBe(true);
    expect(cols.has("source")).toBe(true);
  });

  it("custom_field_defs has display_order and share_with_ai", async () => {
    const cols = await columnsOf("custom_field_defs");
    expect(cols.has("display_order")).toBe(true);
    expect(cols.has("share_with_ai")).toBe(true);
  });

  it("every mergeable table has a distinct uid + modified_at", async () => {
    const mergeable = [
      "categories",
      "profile",
      "contacts",
      "contact_links",
      "interactions",
      "events",
      "custom_field_defs",
      "contact_custom_values",
      "fuel",
    ];
    for (const t of mergeable) {
      const cols = await columnsOf(t);
      expect(cols.has("uid"), `${t}.uid`).toBe(true);
      expect(cols.has("modified_at"), `${t}.modified_at`).toBe(true);
    }
    // field_history is EXCLUDED from export (RESEARCH A3): no uid needed.
    const fh = await columnsOf("field_history");
    expect(fh.has("uid")).toBe(false);
  });

  it("seeds exactly four categories Family/Friends/Work/Community in order", async () => {
    const rows = await exec.getAllAsync<{
      name: string;
      display_order: number;
    }>("SELECT name, display_order FROM categories ORDER BY display_order");
    expect(rows).toEqual([
      { name: "Family", display_order: 0 },
      { name: "Friends", display_order: 1 },
      { name: "Work", display_order: 2 },
      { name: "Community", display_order: 3 },
    ]);
  });

  it("seeds exactly one profile row with id=1", async () => {
    const rows = await exec.getAllAsync<{ id: number }>(
      "SELECT id FROM profile",
    );
    expect(rows).toEqual([{ id: 1 }]);
  });

  it("creates the fuel table empty", async () => {
    const row = await exec.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM fuel",
    );
    expect(row?.n).toBe(0);
  });

  it("has no index/UNIQUE on any VALUE column of contact_custom_values", async () => {
    // The merge-key `uid TEXT UNIQUE` autoindex is EXPECTED and correct; the
    // ban is VALUE-column-scoped (HANDOFF §14.11). `contact_id INTEGER PRIMARY
    // KEY` is a rowid alias — it produces NO index_list entry. There are no
    // value columns this phase, so no index may reference one. This assertion
    // is the guard Phase 3 (DROP COLUMN) inherits.
    const indexes = await exec.getAllAsync<{ name: string }>(
      "PRAGMA index_list(contact_custom_values)",
    );
    // Only the uid UNIQUE autoindex is permitted.
    const valueColumns = new Set(["modified_at"]); // non-key, non-merge columns
    for (const idx of indexes) {
      const info = await exec.getAllAsync<{ name: string }>(
        `PRAGMA index_info(${idx.name})`,
      );
      for (const col of info) {
        expect(
          valueColumns.has(col.name),
          `index ${idx.name} must not cover value column ${col.name}`,
        ).toBe(false);
      }
    }
    // Positive: the uid autoindex exists (do NOT assert it is absent).
    const coversUid = await Promise.all(
      indexes.map(async (idx) => {
        const info = await exec.getAllAsync<{ name: string }>(
          `PRAGMA index_info(${idx.name})`,
        );
        return info.some((c) => c.name === "uid");
      }),
    );
    expect(coversUid.some(Boolean)).toBe(true);
  });

  it("cascades a contact delete to its interactions, links, events and custom values", async () => {
    // node:sqlite fixture already has foreign_keys=ON.
    const contact = await exec.runAsync(
      `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?)`,
      [newUid(), "Casey", 30, NOW, NOW],
    );
    const cid = contact.lastInsertRowId;

    await exec.runAsync(
      `INSERT INTO interactions (uid, contact_id, occurred_at, recorded_at, source, modified_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [newUid(), cid, NOW, NOW, "manual", NOW],
    );
    await exec.runAsync(
      `INSERT INTO contact_links (uid, contact_id, url, display_order, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [newUid(), cid, "https://example.com", 0, NOW, NOW],
    );
    await exec.runAsync(
      `INSERT INTO events (uid, contact_id, type, occurred_at, recorded_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [newUid(), cid, "archive", NOW, NOW, NOW],
    );
    await exec.runAsync(
      `INSERT INTO contact_custom_values (contact_id, uid, modified_at)
       VALUES (?, ?, ?)`,
      [cid, newUid(), NOW],
    );

    await exec.runAsync("DELETE FROM contacts WHERE id = ?", [cid]);

    for (const child of [
      "interactions",
      "contact_links",
      "events",
      "contact_custom_values",
    ]) {
      const row = await exec.getFirstAsync<{ n: number }>(
        `SELECT COUNT(*) AS n FROM ${child} WHERE contact_id = ?`,
        [cid],
      );
      expect(row?.n, `${child} rows cascade-deleted`).toBe(0);
    }
  });
});
