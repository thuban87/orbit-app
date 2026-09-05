import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { listDashboardPopulation } from "@/db/dashboard-read";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
import { buildPopulationWhere } from "@/logic/dashboard-query-logic";
import { useDashboardQueryStore } from "@/stores/dashboard-query-store";

const NOW = "2026-09-04 12:00:00";
let exec: SqlExecutor;

beforeEach(async () => {
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, { now: NOW, newUid });
  useDashboardQueryStore.setState({
    viewMode: "list",
    populations: [],
    filters: {},
    sort: "default",
  });
});

describe("dashboard query store", () => {
  it("persists sort through app_settings, rehydrates it, and feeds the Active read", async () => {
    for (const [uid, name] of [
      ["zeta", "Zeta"],
      ["alpha", "Alpha"],
    ]) {
      await exec.runAsync(
        `INSERT INTO contacts (uid, name, interval_days, last_contact, rarely_responds, reminders_off, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [uid, name, 30, "2026-09-02", 0, 0, NOW, NOW],
      );
    }
    await useDashboardQueryStore.getState().setSort(exec, "name-asc");
    await useDashboardQueryStore.getState().hydrate(exec);
    expect(useDashboardQueryStore.getState().sort).toBe("name-asc");
    expect(
      (
        await listDashboardPopulation(exec, useDashboardQueryStore.getState(), NOW)
      ).map((row) => row.name),
    ).toEqual(["Alpha", "Zeta"]);
  });

  it("resets population, filters, and sort but preserves the durable view mode", async () => {
    useDashboardQueryStore.setState({
      viewMode: "card",
      populations: ["favourites"],
      filters: { category: ["family"] },
      sort: "name-desc",
    });
    await useDashboardQueryStore.getState().resetDashboardView(exec);
    expect(useDashboardQueryStore.getState()).toMatchObject({
      viewMode: "card",
      populations: [],
      filters: {},
      sort: "default",
    });
  });

  it("persists the population axis into the OR-union read and rehydrates an empty selection as Active", async () => {
    const favourite = await exec.runAsync(
      `INSERT INTO contacts (uid, name, interval_days, last_contact, favourite_rank, rarely_responds, reminders_off, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["favourite", "Favourite", 30, "2026-09-02", 1, 0, 0, NOW, NOW],
    );
    const never = await exec.runAsync(
      `INSERT INTO contacts (uid, name, interval_days, last_contact, rarely_responds, reminders_off, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["never", "Never", 30, null, 0, 0, NOW, NOW],
    );

    await useDashboardQueryStore
      .getState()
      .setPopulations(exec, ["favourites", "not-contacted"]);
    await useDashboardQueryStore.getState().hydrate(exec);
    const unionQuery = useDashboardQueryStore.getState();
    expect(unionQuery.populations).toEqual(["favourites", "not-contacted"]);
    expect(buildPopulationWhere(unionQuery.populations).sql).toContain(" OR ");
    expect(
      (await listDashboardPopulation(exec, unionQuery, NOW)).map((row) => row.id).sort(),
    ).toEqual([favourite.lastInsertRowId, never.lastInsertRowId].sort());

    await useDashboardQueryStore.getState().setPopulations(exec, []);
    await useDashboardQueryStore.getState().hydrate(exec);
    const activeQuery = useDashboardQueryStore.getState();
    expect(activeQuery.populations).toEqual([]);
    expect(buildPopulationWhere(activeQuery.populations).sql).toContain(
      "c.last_contact IS NOT NULL",
    );
    expect(
      (await listDashboardPopulation(exec, activeQuery, NOW)).map((row) => row.id),
    ).toEqual([favourite.lastInsertRowId]);
  });
});
