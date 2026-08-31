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
import { migration013 } from "@/db/migrations/013-reconciliation-and-merge";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-30 12:00:00";
const MIGRATIONS = [migration001, migration002, migration003, migration004, migration005, migration006, migration007, migration008, migration009, migration010, migration011, migration012, migration013];
let exec: SqlExecutor;
let n = 0;
const uid = () => `uid-${++n}`;

beforeEach(async () => {
  n = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, 12, { now: NOW, newUid: uid });
  await runMigrations(exec, MIGRATIONS, 13, { now: NOW, newUid: uid });
});

describe("migration 013 — reconciliation and merge", () => {
  it("forwards v12 to the additive reconciliation schema", async () => {
    expect(await exec.getFirstAsync<{ user_version: number }>("PRAGMA user_version")).toEqual({ user_version: 13 });
    for (const table of ["reconciliation_sessions", "reconciliation_session_cards", "reconcile_source_snapshot", "bulk_review_resolutions"]) {
      expect(await exec.getFirstAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [table])).toEqual({ name: table });
    }
    expect(await exec.getFirstAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'contact_redirects'")).toBeNull();
  });

  it("enforces card, snapshot, and durable resolution foreign keys", async () => {
    const contact = await exec.runAsync("INSERT INTO contacts (uid, name, tracking_enabled, created_at, modified_at) VALUES (?, ?, 0, ?, ?)", [uid(), "Live", NOW, NOW]);
    const session = await exec.runAsync("INSERT INTO reconciliation_sessions (uid, created_at, modified_at) VALUES (?, ?, ?)", [uid(), NOW, NOW]);
    await exec.runAsync("INSERT INTO reconciliation_session_cards (uid, session_id, contact_id, diff_json, staged_photo_rel_path, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [uid(), session.lastInsertRowId, contact.lastInsertRowId, "{}", "reconcile-staging/photo.jpg", NOW, NOW]);
    const link = await exec.runAsync("INSERT INTO external_contact_links (uid, contact_id, provider, external_contact_id, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?)", [uid(), contact.lastInsertRowId, "android", "x", NOW, NOW]);
    await exec.runAsync("INSERT INTO reconcile_source_snapshot (uid, external_contact_link_id, field_family, reviewed_at) VALUES (?, ?, ?, ?)", [uid(), link.lastInsertRowId, "photo", NOW]);
    const importSession = await exec.runAsync("INSERT INTO import_sessions (uid, mode, created_at, modified_at) VALUES (?, 'single', ?, ?)", [uid(), NOW, NOW]);
    const importRow = await exec.runAsync("INSERT INTO import_session_rows (uid, session_id, external_contact_id, source_payload, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?)", [uid(), importSession.lastInsertRowId, "source", "{}", NOW, NOW]);
    await exec.runAsync("INSERT INTO bulk_review_resolutions (uid, import_session_row_id, flag_type, resolution, resolved_at) VALUES (?, ?, 'birthday', 'ignored', ?)", [uid(), importRow.lastInsertRowId, NOW]);
    expect(await exec.getAllAsync("PRAGMA foreign_key_check")).toEqual([]);
  });
});
