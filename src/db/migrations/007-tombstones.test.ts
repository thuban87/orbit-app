import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { migration006 } from "@/db/migrations/006-normalize-custom-field-values";
import {
  migration007,
  RESERVED_CATEGORY_UIDS,
  RESERVED_PROFILE_UID,
} from "@/db/migrations/007-tombstones";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-25 12:00:00";
const legacyMigrations = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
];

let counter = 0;
const newUid = () => `uid-${++counter}`;
let exec: SqlExecutor;

beforeEach(async () => {
  counter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, legacyMigrations, 6, { now: NOW, newUid });
});

describe("migration007 — permanent tombstones and reserved singleton UIDs", () => {
  it("upgrades v6 with durable evidence, a revision counter, and reserved seed UIDs", async () => {
    await runMigrations(exec, [...legacyMigrations, migration007], 7, {
      now: NOW,
      newUid,
    });

    expect(await exec.getFirstAsync<{ user_version: number }>("PRAGMA user_version")).toEqual({
      user_version: 7,
    });
    expect(
      await exec.getFirstAsync<{ sql: string }>(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'tombstones'",
      ),
    ).toMatchObject({ sql: expect.stringContaining("UNIQUE(entity_type, entity_uid)") });
    expect(
      await exec.getFirstAsync<{ data_revision: number }>(
        "SELECT data_revision FROM app_settings WHERE id = 1",
      ),
    ).toEqual({ data_revision: 0 });
    expect(
      await exec.getFirstAsync<{
        backup_interval_days: number;
        backup_retention_days: number;
        last_backup_data_revision: number;
        backup_folder_uri: string | null;
        backup_folder_accessible: number;
        backup_folder_diagnostic: string | null;
        last_automatic_backup_at: string | null;
        encryption_enabled: number;
        backup_nudge_dismissed: number;
      }>(
        `SELECT backup_interval_days, backup_retention_days, last_backup_data_revision,
                backup_folder_uri, backup_folder_accessible, backup_folder_diagnostic, last_automatic_backup_at,
                encryption_enabled, backup_nudge_dismissed
           FROM app_settings WHERE id = 1`,
      ),
    ).toEqual({
      backup_interval_days: 1,
      backup_retention_days: 7,
      last_backup_data_revision: 0,
        backup_folder_uri: null,
        backup_folder_accessible: 0,
      backup_folder_diagnostic: null,
      last_automatic_backup_at: null,
      encryption_enabled: 0,
      backup_nudge_dismissed: 0,
    });
    const columns = await exec.getAllAsync<{ name: string }>("PRAGMA table_info(app_settings)");
    expect(columns.map(({ name }) => name)).not.toContain("passphrase");
    expect(columns.map(({ name }) => name)).not.toContain("api_key");
    expect(columns.map(({ name }) => name)).not.toContain("raw_encryption_key");
    expect(columns.map(({ name }) => name)).not.toContain("kdf_secret");
    expect(columns.map(({ name }) => name)).not.toContain("key_material");
    expect(await exec.getFirstAsync<{ uid: string }>("SELECT uid FROM profile WHERE id = 1")).toEqual({
      uid: RESERVED_PROFILE_UID,
    });
    expect(
      await exec.getAllAsync<{ display_order: number; uid: string }>(
        "SELECT display_order, uid FROM categories ORDER BY display_order",
      ),
    ).toEqual(
      Object.entries(RESERVED_CATEGORY_UIDS).map(([displayOrder, uid]) => ({
        display_order: Number(displayOrder),
        uid,
      })),
    );
  });
});
