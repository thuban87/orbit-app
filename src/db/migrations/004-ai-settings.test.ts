/**
 * Migration 004 — AI non-secret settings columns (Phase 14, AI-01) proof.
 *
 * The single-row `app_settings` table gains the ten disabled-by-default AI
 * config + acknowledgement columns. This suite proves, node-side via the
 * node:sqlite adapter, that migration 004 is forward-only + additive:
 *   - a fresh v0 DB runs 001+002+003+004 in order and reaches v4 with every new
 *     column present and defaulted (provider `none`, empty strings, acks 0);
 *   - a seeded v3 DB (001+002+003 already applied) runs 004 and gains exactly
 *     the ten columns, reaching v4 with no error;
 *   - CRITICAL (T-14-01): the `app_settings` column list contains NO credential
 *     column — asserted via the pragma column list, not a source grep.
 *
 * Migrations 001/002/003 are imported and run UNCHANGED — 004 edits no shipped
 * table (never edit a shipped migration; irreversible on device).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";

const NOW = "2026-08-21 12:00:00";
const LATER = "2026-08-21 13:30:00";

const ALL_MIGRATIONS = [migration001, migration002, migration003, migration004];

/** The ten columns migration 004 adds. */
const AI_COLUMNS = [
  "ai_provider",
  "ai_model",
  "ai_custom_endpoint",
  "ai_custom_model",
  "ai_prompt_template",
  "ai_ack_openai",
  "ai_ack_anthropic",
  "ai_ack_google",
  "ai_ack_custom",
] as const;

let exec: SqlExecutor;

async function migrateToV4(now = NOW): Promise<void> {
  await runMigrations(exec, ALL_MIGRATIONS, 4, { now, newUid });
}

async function columnsOf(table: string): Promise<Set<string>> {
  const rows = await exec.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${table})`,
  );
  return new Set(rows.map((r) => r.name));
}

beforeEach(() => {
  const db = openTestDb();
  exec = nodeSqliteExecutor(db);
});

describe("migration 004 — AI settings columns (forward-only, additive)", () => {
  it("adds every AI column and lands at v4 on a fresh v0->v4 run", async () => {
    await migrateToV4();

    const version = await exec.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version",
    );
    expect(version?.user_version).toBe(4);

    const cols = await columnsOf("app_settings");
    for (const c of AI_COLUMNS) {
      expect(cols.has(c)).toBe(true);
    }
  });

  it("seeds the disabled-by-default AI values on a fresh run", async () => {
    await migrateToV4();
    const row = await exec.getFirstAsync<{
      ai_provider: string;
      ai_model: string;
      ai_custom_endpoint: string;
      ai_custom_model: string;
      ai_prompt_template: string;
      ai_ack_openai: number;
      ai_ack_anthropic: number;
      ai_ack_google: number;
      ai_ack_custom: number;
    }>("SELECT * FROM app_settings WHERE id = 1");
    expect(row).toMatchObject({
      ai_provider: "none",
      ai_model: "",
      ai_custom_endpoint: "",
      ai_custom_model: "",
      ai_prompt_template: "",
      ai_ack_openai: 0,
      ai_ack_anthropic: 0,
      ai_ack_google: 0,
      ai_ack_custom: 0,
    });
  });

  it("upgrades an already-seeded v3 DB to v4 adding exactly the ten columns", async () => {
    await runMigrations(exec, [migration001, migration002, migration003], 3, {
      now: NOW,
      newUid,
    });
    const beforeVersion = await exec.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version",
    );
    expect(beforeVersion?.user_version).toBe(3);
    const before = await columnsOf("app_settings");

    await migrateToV4(LATER);

    const afterVersion = await exec.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version",
    );
    expect(afterVersion?.user_version).toBe(4);
    const after = await columnsOf("app_settings");
    const added = [...after].filter((c) => !before.has(c)).sort();
    expect(added).toEqual([...AI_COLUMNS].sort());
  });

  it("seeds the disabled defaults on a v3->v4 upgrade too", async () => {
    await runMigrations(exec, [migration001, migration002, migration003], 3, {
      now: NOW,
      newUid,
    });
    await migrateToV4(LATER);
    const row = await exec.getFirstAsync<{
      ai_provider: string;
      ai_ack_openai: number;
      ai_ack_anthropic: number;
      ai_ack_google: number;
      ai_ack_custom: number;
    }>("SELECT * FROM app_settings WHERE id = 1");
    expect(row?.ai_provider).toBe("none");
    expect(row?.ai_ack_openai).toBe(0);
    expect(row?.ai_ack_anthropic).toBe(0);
    expect(row?.ai_ack_google).toBe(0);
    expect(row?.ai_ack_custom).toBe(0);
  });

  it("is idempotent — re-running at v4 applies nothing and keeps one row", async () => {
    await migrateToV4();
    await migrateToV4(LATER);
    const rows = await exec.getAllAsync<{ id: number }>(
      "SELECT id FROM app_settings",
    );
    expect(rows).toEqual([{ id: 1 }]);
  });

  it("stores NO credential/secret column (T-14-01, asserted via pragma)", async () => {
    await migrateToV4();
    const cols = await columnsOf("app_settings");
    // No column name may hint at a stored credential — keys are SecureStore-only.
    const forbidden = /key|secret|token|password|credential|apikey|auth/i;
    const offenders = [...cols].filter((c) => forbidden.test(c));
    expect(offenders).toEqual([]);
  });
});
