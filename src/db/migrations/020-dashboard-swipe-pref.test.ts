import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";

const NOW = "2026-09-05 12:00:00";
let exec: SqlExecutor;

beforeEach(() => {
  exec = nodeSqliteExecutor(openTestDb());
});

describe("migration 020 — dashboard right-swipe preference", () => {
  it("adds the constrained column and seeds its default on an early forward jump", async () => {
    // Build exactly through the era where app_settings was first created, then
    // exercise the long-dormant-device path from that populated singleton row.
    await runMigrations(exec, MIGRATIONS, 2, { now: NOW, newUid });
    await exec.runAsync(
      "UPDATE app_settings SET modified_at = ? WHERE id = 1",
      ["2026-09-05 12:01:00"],
    );

    await runMigrations(exec, MIGRATIONS, 20, { now: NOW, newUid });

    const columns = await exec.getAllAsync<{ name: string }>(
      "PRAGMA table_info(app_settings)",
    );
    expect(columns.map((column) => column.name)).toContain(
      "dashboard_right_swipe_action",
    );
    expect(
      await exec.getFirstAsync<{ dashboard_right_swipe_action: string }>(
        "SELECT dashboard_right_swipe_action FROM app_settings WHERE id = 1",
      ),
    ).toEqual({ dashboard_right_swipe_action: "quick-log" });

    expect(() =>
      exec.runAsync(
        "UPDATE app_settings SET dashboard_right_swipe_action = ? WHERE id = 1",
        ["not-an-action"],
      ),
    ).toThrow();
  });
});
