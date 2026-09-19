import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  countNeverContacted,
  listDashboardPopulation,
} from "@/db/dashboard-read";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { readOverlooked } from "@/db/digest-read";
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
    hydrated: false,
    generation: 0,
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
        await listDashboardPopulation(
          exec,
          useDashboardQueryStore.getState(),
          NOW,
        )
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
      (await listDashboardPopulation(exec, unionQuery, NOW))
        .map((row) => row.id)
        .sort(),
    ).toEqual([favourite.lastInsertRowId, never.lastInsertRowId].sort());

    await useDashboardQueryStore.getState().setPopulations(exec, []);
    await useDashboardQueryStore.getState().hydrate(exec);
    const activeQuery = useDashboardQueryStore.getState();
    expect(activeQuery.populations).toEqual([]);
    expect(buildPopulationWhere(activeQuery.populations).sql).toContain(
      "c.last_contact IS NOT NULL",
    );
    expect(
      (await listDashboardPopulation(exec, activeQuery, NOW)).map(
        (row) => row.id,
      ),
    ).toEqual([favourite.lastInsertRowId]);
  });

  it("no-ops a same-value setViewMode: no app_settings write and no store change", async () => {
    // Track every write so a same-value toggle can be proven to persist nothing.
    const runCalls: string[] = [];
    const spyExec: SqlExecutor = {
      ...exec,
      runAsync: async (sql: string, params?: unknown[]) => {
        runCalls.push(sql);
        return exec.runAsync(sql, params);
      },
    };

    const before = useDashboardQueryStore.getState();
    expect(before.viewMode).toBe("list");

    // Re-selecting the already-active view writes nothing and changes nothing —
    // no updateAppSettings, no set(), no generation bump (CYCLE-4 #3).
    await useDashboardQueryStore.getState().setViewMode(spyExec, "list");
    const afterNoop = useDashboardQueryStore.getState();
    expect(afterNoop.viewMode).toBe("list");
    expect(afterNoop.generation).toBe(before.generation);
    expect(runCalls.some((sql) => sql.includes("app_settings"))).toBe(false);

    // Sanity: a genuine change DOES persist and bump the generation.
    await useDashboardQueryStore.getState().setViewMode(spyExec, "card");
    const afterChange = useDashboardQueryStore.getState();
    expect(afterChange.viewMode).toBe("card");
    expect(afterChange.generation).toBe(before.generation + 1);
    expect(runCalls.some((sql) => sql.includes("app_settings"))).toBe(true);
  });

  it("does not let a late hydration overwrite a persisted population selection", async () => {
    let releaseRead: (() => void) | undefined;
    const readStarted = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const delayedExec: SqlExecutor = {
      ...exec,
      getFirstAsync: async <T>(sql: string, params?: unknown[]) => {
        await readStarted;
        return exec.getFirstAsync<T>(sql, params);
      },
    };

    const hydration = useDashboardQueryStore.getState().hydrate(delayedExec);
    await useDashboardQueryStore
      .getState()
      .setPopulations(exec, ["favourites"]);
    releaseRead?.();
    await hydration;

    expect(useDashboardQueryStore.getState()).toMatchObject({
      populations: ["favourites"],
      hydrated: true,
    });
  });

  it("atomically replaces both drill-through axes and bumps generation once", async () => {
    useDashboardQueryStore.setState({
      populations: ["favourites"],
      filters: { "needs-attention": ["on"] },
      generation: 4,
    });
    const appSettingsWrites: string[] = [];
    const spyExec: SqlExecutor = {
      ...exec,
      runAsync: async (sql: string, params?: unknown[]) => {
        if (
          sql.includes("UPDATE app_settings") &&
          sql.includes("dashboard_populations")
        )
          appSettingsWrites.push(sql);
        return exec.runAsync(sql, params);
      },
    };

    await useDashboardQueryStore
      .getState()
      .setPopulationsAndFilters(spyExec, ["not-contacted"], {});
    expect(useDashboardQueryStore.getState()).toMatchObject({
      populations: ["not-contacted"],
      filters: {},
      generation: 5,
    });
    expect(appSettingsWrites).toHaveLength(1);
    expect(appSettingsWrites[0]).toContain("dashboard_populations");
    expect(appSettingsWrites[0]).toContain("dashboard_filters");

    await useDashboardQueryStore
      .getState()
      .setPopulationsAndFilters(exec, [], { "needs-attention": ["on"] });
    expect(useDashboardQueryStore.getState()).toMatchObject({
      populations: [],
      filters: { "needs-attention": ["on"] },
      generation: 6,
    });
  });

  it("keeps D-10 Never Contacted count, preview, and drilled rows equal including Unbound", async () => {
    await exec.runAsync(
      "UPDATE app_settings SET include_unbound_never_contacted = 1 WHERE id = 1",
    );
    for (const [uid, name, tracking] of [
      ["bound-never", "Bound Never", 1],
      ["unbound-never", "Unbound Never", 0],
    ] as const) {
      await exec.runAsync(
        `INSERT INTO contacts (uid, name, tracking_enabled, interval_days, last_contact, rarely_responds, reminders_off, created_at, modified_at)
         VALUES (?, ?, ?, ?, NULL, 0, 0, ?, ?)`,
        [uid, name, tracking, tracking ? 30 : null, NOW, NOW],
      );
    }
    const query = {
      viewMode: "list" as const,
      populations: ["not-contacted" as const],
      filters: {},
      sort: "default" as const,
    };
    const count = await countNeverContacted(exec);
    const preview = await listDashboardPopulation(exec, query, NOW);
    await useDashboardQueryStore
      .getState()
      .setPopulationsAndFilters(exec, ["not-contacted"], {});
    const drill = await listDashboardPopulation(
      exec,
      useDashboardQueryStore.getState(),
      NOW,
    );
    expect(count).toBe(2);
    expect(preview).toHaveLength(count);
    expect(drill).toHaveLength(count);
    expect(drill.map((row) => row.name)).toContain("Unbound Never");
  });

  it("excludes a snoozed rogue from both Overlooked preview and needs-attention drill", async () => {
    const inserted = await exec.runAsync(
      `INSERT INTO contacts (uid, name, tracking_enabled, interval_days, last_contact, snooze_until, rarely_responds, reminders_off, created_at, modified_at)
       VALUES (?, ?, 1, 1, ?, ?, 0, 0, ?, ?)`,
      ["snoozed-rogue", "Snoozed Rogue", "2026-01-01", "2099-01-01", NOW, NOW],
    );
    const id = Number(inserted.lastInsertRowId);
    const preview = await readOverlooked(exec);
    await useDashboardQueryStore
      .getState()
      .setPopulationsAndFilters(exec, [], { "needs-attention": ["on"] });
    const drill = await listDashboardPopulation(
      exec,
      useDashboardQueryStore.getState(),
      NOW,
    );
    expect(preview.some((row) => row.id === id)).toBe(false);
    expect(drill.some((row) => row.id === id)).toBe(false);
  });
});
