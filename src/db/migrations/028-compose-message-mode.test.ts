import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { assertRememberedMessageMode } from "@/db/app-settings-dao";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { COMPOSE_MESSAGE_MODE_SCHEMA_VERSION } from "@/db/migrations/028-compose-message-mode";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";

const NOW = "2026-09-13 12:00:00";
let exec: SqlExecutor;

beforeEach(() => {
  exec = nodeSqliteExecutor(openTestDb());
});

describe("migration 028 — compose default message mode preference", () => {
  it("bumps the schema head to 28 via the version const", () => {
    expect(COMPOSE_MESSAGE_MODE_SCHEMA_VERSION).toBe(28);
    expect(TARGET_VERSION).toBe(28);
  });

  it("adds both app_settings columns with seeded defaults on a long forward jump (v20 → v28)", async () => {
    // Populate the singleton settings row at an early era, then exercise the
    // long-dormant-device path forward to the new head in one update.
    await runMigrations(exec, MIGRATIONS, 20, { now: NOW, newUid });
    await exec.runAsync(
      "UPDATE app_settings SET modified_at = ? WHERE id = 1",
      ["2026-09-13 12:01:00"],
    );

    await runMigrations(exec, MIGRATIONS, 28, { now: NOW, newUid });

    const columns = await exec.getAllAsync<{ name: string }>(
      "PRAGMA table_info(app_settings)",
    );
    const names = columns.map((column) => column.name);
    expect(names).toContain("default_message_mode");
    expect(names).toContain("remembered_message_mode");

    expect(
      await exec.getFirstAsync<{
        default_message_mode: string;
        remembered_message_mode: string;
      }>(
        "SELECT default_message_mode, remembered_message_mode FROM app_settings WHERE id = 1",
      ),
    ).toEqual({
      default_message_mode: "remember",
      remembered_message_mode: "text",
    });
  });

  it("persists a raw UPDATE of default_message_mode and reads it back", async () => {
    await runMigrations(exec, MIGRATIONS, 28, { now: NOW, newUid });

    await exec.runAsync(
      "UPDATE app_settings SET default_message_mode = ? WHERE id = 1",
      ["email"],
    );

    expect(
      await exec.getFirstAsync<{ default_message_mode: string }>(
        "SELECT default_message_mode FROM app_settings WHERE id = 1",
      ),
    ).toEqual({ default_message_mode: "email" });
  });

  it("enforces the CHECK vocabulary on default_message_mode", async () => {
    await runMigrations(exec, MIGRATIONS, 28, { now: NOW, newUid });

    expect(() =>
      exec.runAsync(
        "UPDATE app_settings SET default_message_mode = ? WHERE id = 1",
        ["sms"],
      ),
    ).toThrow();
  });

  it("accepts every allowed default_message_mode literal", async () => {
    await runMigrations(exec, MIGRATIONS, 28, { now: NOW, newUid });

    for (const value of ["remember", "text", "email"]) {
      await exec.runAsync(
        "UPDATE app_settings SET default_message_mode = ? WHERE id = 1",
        [value],
      );
      expect(
        await exec.getFirstAsync<{ default_message_mode: string }>(
          "SELECT default_message_mode FROM app_settings WHERE id = 1",
        ),
      ).toEqual({ default_message_mode: value });
    }
  });

  it("leaves remembered_message_mode CHECK-free (DAO assertRememberedMessageMode guards writes)", async () => {
    await runMigrations(exec, MIGRATIONS, 28, { now: NOW, newUid });

    // No DB-level CHECK on remembered_message_mode by design — the raw column
    // accepts any TEXT; the DAO's assertRememberedMessageMode is the write-time
    // guard (CR-01: the concrete-only validator, NOT the permissive
    // assertMessageMode, which admits the 'remember' sentinel).
    await exec.runAsync(
      "UPDATE app_settings SET remembered_message_mode = ? WHERE id = 1",
      ["email"],
    );
    expect(
      await exec.getFirstAsync<{ remembered_message_mode: string }>(
        "SELECT remembered_message_mode FROM app_settings WHERE id = 1",
      ),
    ).toEqual({ remembered_message_mode: "email" });
  });

  it("DAO guard rejects the 'remember' sentinel for remembered_message_mode (CR-01/WR-03)", async () => {
    await runMigrations(exec, MIGRATIONS, 28, { now: NOW, newUid });

    // The column has no CHECK, so a raw UPDATE with 'remember' would succeed —
    // proving the missing constraint the DAO validator must backstop.
    await exec.runAsync(
      "UPDATE app_settings SET remembered_message_mode = ? WHERE id = 1",
      ["remember"],
    );
    expect(
      await exec.getFirstAsync<{ remembered_message_mode: string }>(
        "SELECT remembered_message_mode FROM app_settings WHERE id = 1",
      ),
    ).toEqual({ remembered_message_mode: "remember" });

    // The concrete-only DAO validator is what actually keeps the sentinel out on
    // every runtime + restore write path.
    expect(() =>
      assertRememberedMessageMode("rememberedMessageMode", "remember"),
    ).toThrow();
  });

  it("does not touch the interactions table", async () => {
    await runMigrations(exec, MIGRATIONS, 28, { now: NOW, newUid });

    const interactionColumns = await exec.getAllAsync<{ name: string }>(
      "PRAGMA table_info(interactions)",
    );
    const names = interactionColumns.map((column) => column.name);
    expect(names).not.toContain("default_message_mode");
    expect(names).not.toContain("remembered_message_mode");
  });
});
