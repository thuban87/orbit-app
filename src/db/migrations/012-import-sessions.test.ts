import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { migration006 } from "@/db/migrations/006-normalize-custom-field-values";
import { migration007 } from "@/db/migrations/007-tombstones";
import { migration008 } from "@/db/migrations/008-restore-photo-journal";
import { migration009 } from "@/db/migrations/009-contact-method-normalization";
import { migration010 } from "@/db/migrations/010-contact-method-label";
import { migration011 } from "@/db/migrations/011-contact-lifecycle-schema";
import { migration012 } from "@/db/migrations/012-import-sessions";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-29 12:00:00";
const V11 = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
  migration008,
  migration009,
  migration010,
  migration011,
];

let exec: SqlExecutor;
let uidCount = 0;
const newUid = () => `uid-${++uidCount}`;

beforeEach(async () => {
  uidCount = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, V11, 11, { now: NOW, newUid });
});

async function migrateToV12(): Promise<void> {
  await runMigrations(exec, [...V11, migration012], 12, {
    now: NOW,
    newUid,
  });
}

describe("migration 012 — durable import sessions", () => {
  it("creates the additive v12 schema and preserves existing rows", async () => {
    const contact = await exec.runAsync(
      `INSERT INTO contacts (uid, name, tracking_enabled, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?)`,
      [newUid(), "Existing", 0, NOW, NOW],
    );

    await migrateToV12();

    expect(
      await exec.getFirstAsync<{ user_version: number }>("PRAGMA user_version"),
    ).toEqual({ user_version: 12 });
    expect(
      await exec.getFirstAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        ["import_sessions"],
      ),
    ).toEqual({ name: "import_sessions" });
    expect(
      await exec.getFirstAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        ["import_session_rows"],
      ),
    ).toEqual({ name: "import_session_rows" });
    expect(
      await exec.getFirstAsync<{ name: string }>(
        "SELECT name FROM contacts WHERE id = ?",
        [contact.lastInsertRowId],
      ),
    ).toEqual({ name: "Existing" });
    expect(await exec.getAllAsync("PRAGMA foreign_key_check")).toEqual([]);
  });

  it("enforces import-session foreign keys, uniqueness, and nullable snapshot fields", async () => {
    await migrateToV12();
    const session = await exec.runAsync(
      `INSERT INTO import_sessions
        (uid, mode, batch_category_id, phone_region, total_rows, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [newUid(), "bulk", null, "US", 1, NOW, NOW],
    );
    const payload = JSON.stringify({ name: "Imported", methods: [] });
    const candidates = JSON.stringify([{ contactId: 1, signals: ["email"] }]);
    await exec.runAsync(
      `INSERT INTO import_session_rows
        (uid, session_id, external_contact_id, source_payload, candidates_json, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        newUid(),
        session.lastInsertRowId,
        "lookup-1",
        payload,
        candidates,
        NOW,
        NOW,
      ],
    );

    expect(
      await exec.getFirstAsync<{ batch_category_id: number | null }>(
        "SELECT batch_category_id FROM import_sessions WHERE id = ?",
        [session.lastInsertRowId],
      ),
    ).toEqual({ batch_category_id: null });
    expect(
      await exec.getFirstAsync<{ candidates_json: string | null }>(
        "SELECT candidates_json FROM import_session_rows WHERE session_id = ?",
        [session.lastInsertRowId],
      ),
    ).toEqual({ candidates_json: candidates });
    expect(() =>
      exec.runAsync(
        `INSERT INTO import_session_rows
          (uid, session_id, external_contact_id, source_payload, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [newUid(), 999999, "bad-fk", payload, NOW, NOW],
      ),
    ).toThrow();
    expect(() =>
      exec.runAsync(
        `INSERT INTO import_session_rows
          (uid, session_id, external_contact_id, source_payload, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [newUid(), session.lastInsertRowId, "lookup-1", payload, NOW, NOW],
      ),
    ).toThrow();
  });

  it("keeps foreign_key_check empty after v11→v12", async () => {
    await migrateToV12();
    expect(await exec.getAllAsync("PRAGMA foreign_key_check")).toEqual([]);
  });
});
