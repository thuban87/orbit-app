import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { AI_CONFIGURATION_SCHEMA_VERSION } from "@/db/migrations/029-ai-configuration";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";

const NOW = "2026-09-13 12:00:00";
let exec: SqlExecutor;

beforeEach(() => {
  exec = nodeSqliteExecutor(openTestDb());
});

describe("migration 029 — AI configuration", () => {
  it("registers and applies the complete schema at user_version 29", async () => {
    expect(AI_CONFIGURATION_SCHEMA_VERSION).toBe(29);
    expect(TARGET_VERSION).toBe(29);

    await runMigrations(exec, MIGRATIONS, TARGET_VERSION, { now: NOW, newUid });

    await expect(
      exec.getFirstAsync<{ user_version: number }>("PRAGMA user_version"),
    ).resolves.toEqual({ user_version: 29 });
    const tables = new Set(
      (
        await exec.getAllAsync<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type='table'",
        )
      ).map((row) => row.name),
    );
    expect(tables.has("ai_connections")).toBe(true);
    expect(tables.has("personalization_sections")).toBe(true);
  });

  it("seeds every app_settings default and omits the retired OpenRouter ack", async () => {
    await runMigrations(exec, MIGRATIONS, 29, { now: NOW, newUid });

    const columns = await exec.getAllAsync<{ name: string }>(
      "PRAGMA table_info(app_settings)",
    );
    expect(columns.map((column) => column.name)).not.toContain(
      "ai_ack_openrouter",
    );
    expect(
      await exec.getFirstAsync(
        `SELECT ai_enabled, ai_active_connection, ai_first_use_disclosed,
                ai_writing_tone, ai_writing_length, ai_writing_directness,
                ai_writing_freeform, ai_default_memory_allow,
                ai_default_interaction_note_allow, ai_default_custom_field_share
           FROM app_settings WHERE id=1`,
      ),
    ).toEqual({
      ai_enabled: 0,
      ai_active_connection: "",
      ai_first_use_disclosed: 0,
      ai_writing_tone: "balanced",
      ai_writing_length: "normal",
      ai_writing_directness: "balanced",
      ai_writing_freeform: "",
      ai_default_memory_allow: 0,
      ai_default_interaction_note_allow: 0,
      ai_default_custom_field_share: 0,
    });
  });

  it("rejects values outside the pinned writing-style vocabulary", async () => {
    await runMigrations(exec, MIGRATIONS, 29, { now: NOW, newUid });

    expect(() =>
      exec.runAsync(
        "UPDATE app_settings SET ai_writing_tone='loud' WHERE id=1",
      ),
    ).toThrow();
  });

  it("enforces unique connection lanes and unique public uids", async () => {
    await runMigrations(exec, MIGRATIONS, 29, { now: NOW, newUid });
    const insert = (uid: string, lane: string) =>
      exec.runAsync(
        `INSERT INTO ai_connections
           (uid,lane,created_at,modified_at) VALUES (?,?,?,?)`,
        [uid, lane, NOW, NOW],
      );

    await insert("connection-1", "openai");
    expect(() => insert("connection-2", "openai")).toThrow();
    expect(() => insert("connection-1", "anthropic")).toThrow();
  });

  it("enforces personalization uid uniqueness and enabled boolean shape", async () => {
    await runMigrations(exec, MIGRATIONS, 29, { now: NOW, newUid });
    await exec.runAsync(
      `INSERT INTO personalization_sections
         (uid,title,body,enabled,created_at,modified_at) VALUES (?,?,?,?,?,?)`,
      ["section-1", "Voice", "Warm", 1, NOW, NOW],
    );
    expect(() =>
      exec.runAsync(
        `INSERT INTO personalization_sections
           (uid,title,body,created_at,modified_at) VALUES (?,?,?,?,?)`,
        ["section-1", "Other", "Body", NOW, NOW],
      ),
    ).toThrow();
    expect(() =>
      exec.runAsync(
        "UPDATE personalization_sections SET enabled=2 WHERE uid='section-1'",
      ),
    ).toThrow();
  });
});
