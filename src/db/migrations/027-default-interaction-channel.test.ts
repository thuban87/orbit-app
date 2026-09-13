import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { DEFAULT_INTERACTION_CHANNEL_SCHEMA_VERSION } from "@/db/migrations/027-default-interaction-channel";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";

const NOW = "2026-09-12 12:00:00";
let exec: SqlExecutor;

beforeEach(() => {
  exec = nodeSqliteExecutor(openTestDb());
});

describe("migration 027 — default interaction channel preference", () => {
  it("bumps the schema head to 27 via the version const", () => {
    expect(DEFAULT_INTERACTION_CHANNEL_SCHEMA_VERSION).toBe(27);
    expect(TARGET_VERSION).toBe(27);
  });

  it("adds both app_settings columns with seeded defaults on a long forward jump (v20 → v27)", async () => {
    // Populate the singleton settings row at an early era, then exercise the
    // long-dormant-device path forward to the new head in one update.
    await runMigrations(exec, MIGRATIONS, 20, { now: NOW, newUid });
    await exec.runAsync(
      "UPDATE app_settings SET modified_at = ? WHERE id = 1",
      ["2026-09-12 12:01:00"],
    );

    await runMigrations(exec, MIGRATIONS, 27, { now: NOW, newUid });

    const columns = await exec.getAllAsync<{ name: string }>(
      "PRAGMA table_info(app_settings)",
    );
    const names = columns.map((column) => column.name);
    expect(names).toContain("default_interaction_channel");
    expect(names).toContain("remembered_interaction_channel");

    expect(
      await exec.getFirstAsync<{
        default_interaction_channel: string;
        remembered_interaction_channel: string;
      }>(
        "SELECT default_interaction_channel, remembered_interaction_channel FROM app_settings WHERE id = 1",
      ),
    ).toEqual({
      default_interaction_channel: "remember",
      remembered_interaction_channel: "Message",
    });
  });

  it("persists a raw UPDATE of default_interaction_channel and reads it back", async () => {
    await runMigrations(exec, MIGRATIONS, 27, { now: NOW, newUid });

    await exec.runAsync(
      "UPDATE app_settings SET default_interaction_channel = ? WHERE id = 1",
      ["Call"],
    );

    expect(
      await exec.getFirstAsync<{ default_interaction_channel: string }>(
        "SELECT default_interaction_channel FROM app_settings WHERE id = 1",
      ),
    ).toEqual({ default_interaction_channel: "Call" });
  });

  it("enforces the CHECK vocabulary on default_interaction_channel", async () => {
    await runMigrations(exec, MIGRATIONS, 27, { now: NOW, newUid });

    expect(() =>
      exec.runAsync(
        "UPDATE app_settings SET default_interaction_channel = ? WHERE id = 1",
        ["bogus"],
      ),
    ).toThrow();
  });

  it("accepts every allowed default_interaction_channel literal", async () => {
    await runMigrations(exec, MIGRATIONS, 27, { now: NOW, newUid });

    for (const value of ["remember", "Message", "Call", "In Person"]) {
      await exec.runAsync(
        "UPDATE app_settings SET default_interaction_channel = ? WHERE id = 1",
        [value],
      );
      expect(
        await exec.getFirstAsync<{ default_interaction_channel: string }>(
          "SELECT default_interaction_channel FROM app_settings WHERE id = 1",
        ),
      ).toEqual({ default_interaction_channel: value });
    }
  });

  it("does not touch the interactions table", async () => {
    await runMigrations(exec, MIGRATIONS, 27, { now: NOW, newUid });

    const interactionColumns = await exec.getAllAsync<{ name: string }>(
      "PRAGMA table_info(interactions)",
    );
    const names = interactionColumns.map((column) => column.name);
    expect(names).not.toContain("default_interaction_channel");
    expect(names).not.toContain("remembered_interaction_channel");
  });
});
