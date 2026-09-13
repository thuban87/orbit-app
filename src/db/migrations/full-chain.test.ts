import { describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  RESERVED_CATEGORY_UIDS,
  RESERVED_PROFILE_UID,
} from "@/db/migrations/007-tombstones";
import { runMigrations } from "@/db/migrations/runner";

const NOW = "2026-08-25 12:00:00";

describe("registered migration chain", () => {
  it("runs the database-owned migration list from v0 through the current target", async () => {
    let counter = 0;
    const exec = nodeSqliteExecutor(openTestDb());
    await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
      now: NOW,
      newUid: () => `uid-${++counter}`,
    });

    expect(
      MIGRATIONS.filter((migration) => migration.version === 7),
    ).toHaveLength(1);
    expect(
      MIGRATIONS.filter((migration) => migration.version === 10),
    ).toHaveLength(1);
    expect(
      MIGRATIONS.filter((migration) => migration.version === 11),
    ).toHaveLength(1);
    expect(
      MIGRATIONS.filter((migration) => migration.version === 12),
    ).toHaveLength(1);
    expect(
      MIGRATIONS.filter((migration) => migration.version === 13),
    ).toHaveLength(1);
    expect(
      MIGRATIONS.filter((migration) => migration.version === 14),
    ).toHaveLength(1);
    expect(
      MIGRATIONS.filter((migration) => migration.version === 15),
    ).toHaveLength(1);
    expect(
      MIGRATIONS.filter((migration) => migration.version === 16),
    ).toHaveLength(1);
    expect(
      MIGRATIONS.filter((migration) => migration.version === 17),
    ).toHaveLength(1);
    expect(
      MIGRATIONS.filter((migration) => migration.version === 18),
    ).toHaveLength(1);
    expect(
      MIGRATIONS.filter((migration) => migration.version === 19),
    ).toHaveLength(1);
    expect(
      MIGRATIONS.filter((migration) => migration.version === 20),
    ).toHaveLength(1);
    expect(
      MIGRATIONS.filter((migration) => migration.version === 21),
    ).toHaveLength(1);
    expect(
      MIGRATIONS.filter((migration) => migration.version === 22),
    ).toHaveLength(1);
    expect(
      MIGRATIONS.filter((migration) => migration.version === 23),
    ).toHaveLength(1);
    expect(
      MIGRATIONS.filter((migration) => migration.version === 24),
    ).toHaveLength(1);
    expect(
      MIGRATIONS.filter((migration) => migration.version === 25),
    ).toHaveLength(1);
    expect(
      MIGRATIONS.filter((migration) => migration.version === 26),
    ).toHaveLength(1);
    expect(
      MIGRATIONS.filter((migration) => migration.version === 27),
    ).toHaveLength(1);
    expect(TARGET_VERSION).toBe(27);
    expect(
      await exec.getFirstAsync<{ user_version: number }>("PRAGMA user_version"),
    ).toEqual({
      user_version: TARGET_VERSION,
    });
    // Migration 015's seven theme columns are present after the full chain.
    const appSettingsCols = new Set(
      (
        await exec.getAllAsync<{ name: string }>(
          "PRAGMA table_info(app_settings)",
        )
      ).map((r) => r.name),
    );
    for (const col of [
      "theme_package",
      "galaxy_mode",
      "standard_mode",
      "galaxy_accent",
      "standard_accent",
      "galaxy_background",
      "standard_background",
      "dashboard_right_swipe_action",
      "orrery_density",
      "orrery_satellites_enabled",
      "orrery_last_system",
      "orrery_system_selection_revision",
      "profile_layout_template_uid",
      "profile_background_template_uid",
      "history_lens",
      "history_cycle_count",
      "default_interaction_channel",
      "remembered_interaction_channel",
    ]) {
      expect(appSettingsCols.has(col)).toBe(true);
    }
    // Migration 025's two new interaction columns are present after the full chain.
    const interactionCols = new Set(
      (
        await exec.getAllAsync<{ name: string }>(
          "PRAGMA table_info(interactions)",
        )
      ).map((r) => r.name),
    );
    expect(interactionCols.has("duration")).toBe(true);
    expect(interactionCols.has("allow_ai")).toBe(true);
    expect(
      await exec.getFirstAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tombstones'",
      ),
    ).toEqual({ name: "tombstones" });
    expect(
      await exec.getFirstAsync<{ data_revision: number }>(
        "SELECT data_revision FROM app_settings WHERE id = 1",
      ),
    ).toEqual({ data_revision: 0 });
    expect(
      await exec.getFirstAsync<{ uid: string }>(
        "SELECT uid FROM profile WHERE id = 1",
      ),
    ).toEqual({
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
