import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";

const NOW = "2026-09-04 12:00:00";
let exec: SqlExecutor;

beforeEach(() => {
  exec = nodeSqliteExecutor(openTestDb());
});

describe("migration 019 — dashboard preferences", () => {
  it("upgrades a v18 app_settings row with the locked four-column defaults", async () => {
    await runMigrations(exec, MIGRATIONS, 18, { now: NOW, newUid });
    await runMigrations(exec, MIGRATIONS, 19, { now: NOW, newUid });
    expect(
      await exec.getFirstAsync<{
        dashboard_view_mode: string;
        dashboard_populations: string;
        dashboard_filters: string;
        dashboard_sort: string;
      }>(
        `SELECT dashboard_view_mode, dashboard_populations, dashboard_filters, dashboard_sort
           FROM app_settings WHERE id = 1`,
      ),
    ).toEqual({
      dashboard_view_mode: "list",
      dashboard_populations: "[]",
      dashboard_filters: "{}",
      dashboard_sort: "default",
    });
  });

  it("reaches v19 from an empty database", async () => {
    await runMigrations(exec, MIGRATIONS, 19, { now: NOW, newUid });
    expect(
      await exec.getFirstAsync<{ user_version: number }>("PRAGMA user_version"),
    ).toEqual({ user_version: 19 });
  });
});
