import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { listDashboardPopulation } from "@/db/dashboard-read";
import { runMigrations } from "@/db/migrations/runner";
import { useDashboardQueryStore } from "@/stores/dashboard-query-store";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";

const NOW = "2026-09-04 12:00:00";
let exec: SqlExecutor;

beforeEach(async () => {
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, { now: NOW, newUid });
  useDashboardQueryStore.setState({ viewMode: "list", populations: [], filters: {}, sort: "default" });
});

describe("dashboard query store", () => {
  it("persists sort through app_settings, rehydrates it, and feeds the Active read", async () => {
    for (const [uid, name] of [["zeta", "Zeta"], ["alpha", "Alpha"]]) {
      await exec.runAsync(
        `INSERT INTO contacts (uid, name, interval_days, last_contact, rarely_responds, reminders_off, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [uid, name, 30, "2026-09-02", 0, 0, NOW, NOW],
      );
    }
    await useDashboardQueryStore.getState().setSort(exec, "name-asc", NOW);
    await useDashboardQueryStore.getState().hydrate(exec);
    expect(useDashboardQueryStore.getState().sort).toBe("name-asc");
    expect((await listDashboardPopulation(exec, useDashboardQueryStore.getState())).map((row) => row.name)).toEqual(["Alpha", "Zeta"]);
  });

  it("resets population, filters, and sort but preserves the durable view mode", async () => {
    useDashboardQueryStore.setState({ viewMode: "card", populations: ["favourites"], filters: { category: ["family"] }, sort: "name-desc" });
    await useDashboardQueryStore.getState().resetDashboardView(exec, NOW);
    expect(useDashboardQueryStore.getState()).toMatchObject({ viewMode: "card", populations: [], filters: {}, sort: "default" });
  });
});
