import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  countNeverContacted,
  listDashboardPopulation,
} from "@/db/dashboard-read";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
import { readUpNextCandidates } from "@/db/up-next-read";
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
    committed: { populations: [], filters: {}, sort: "default" },
    pendingAxes: { populations: 0, filters: 0, sort: 0 },
  });
});

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

type WriteStep =
  | "ok"
  | "fail"
  | { gate: Promise<void>; outcome: "ok" | "fail" };

/**
 * Wrap the real executor so each dashboard app_settings write follows the next
 * scripted step (pass, fail, or wait on a gate first). A failed step throws
 * inside updateAppSettings' transaction, so SQLite rolls the write back.
 */
function scriptedExec(steps: WriteStep[]) {
  const landed: string[] = [];
  const attempted: string[] = [];
  const scripted: SqlExecutor = {
    ...exec,
    runAsync: async (sql: string, params?: unknown[]) => {
      if (sql.includes("UPDATE app_settings") && sql.includes("dashboard_")) {
        attempted.push(JSON.stringify(params));
        const step = steps.shift() ?? "ok";
        const outcome = typeof step === "string" ? step : step.outcome;
        if (typeof step !== "string") await step.gate;
        if (outcome === "fail") throw new Error("write failed");
        landed.push(JSON.stringify(params));
      }
      return exec.runAsync(sql, params);
    },
  };
  return { exec: scripted, landed, attempted };
}

async function storedPopulations(): Promise<unknown> {
  const row = await exec.getFirstAsync<{ dashboard_populations: string }>(
    "SELECT dashboard_populations FROM app_settings WHERE id = 1",
  );
  return JSON.parse(row?.dashboard_populations ?? "null");
}

async function storedSort(): Promise<unknown> {
  const row = await exec.getFirstAsync<{ dashboard_sort: string }>(
    "SELECT dashboard_sort FROM app_settings WHERE id = 1",
  );
  return row?.dashboard_sort;
}

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
    // The Overlooked preview is drawn from the Up Next candidates (38.13 D-61).
    const preview = await readUpNextCandidates(exec);
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

describe("dashboard query store: optimistic serial writes (D-27)", () => {
  it("lands two back-to-back population writes in issue order and shows the second at once", async () => {
    const { exec: scripted, landed } = scriptedExec(["ok", "ok"]);
    const store = useDashboardQueryStore.getState();
    const first = store.setPopulations(scripted, ["favourites"]);
    expect(useDashboardQueryStore.getState().populations).toEqual([
      "favourites",
    ]);
    const second = useDashboardQueryStore
      .getState()
      .setPopulations(scripted, ["favourites", "birthdays"]);
    expect(useDashboardQueryStore.getState().populations).toEqual([
      "favourites",
      "birthdays",
    ]);
    await Promise.all([first, second]);
    expect(landed).toHaveLength(2);
    expect(landed[0]).toContain('[\\"favourites\\"]');
    expect(landed[1]).toContain('[\\"favourites\\",\\"birthdays\\"]');
    expect(await storedPopulations()).toEqual(["favourites", "birthdays"]);
    expect(useDashboardQueryStore.getState().committed.populations).toEqual([
      "favourites",
      "birthdays",
    ]);
  });

  it("keeps the newer optimistic value when a superseded write fails", async () => {
    const gate = deferred();
    const { exec: scripted } = scriptedExec([
      "fail",
      { gate: gate.promise, outcome: "ok" },
    ]);
    const failed = useDashboardQueryStore
      .getState()
      .setPopulations(scripted, ["favourites"]);
    const newer = useDashboardQueryStore
      .getState()
      .setPopulations(scripted, ["snoozed"]);
    await expect(failed).rejects.toThrow("write failed");
    expect(useDashboardQueryStore.getState().populations).toEqual(["snoozed"]);
    gate.resolve();
    await newer;
    expect(useDashboardQueryStore.getState().populations).toEqual(["snoozed"]);
    expect(await storedPopulations()).toEqual(["snoozed"]);
  });

  it("restores the last committed value when the latest write fails", async () => {
    await useDashboardQueryStore
      .getState()
      .setPopulations(exec, ["favourites"]);
    const { exec: scripted } = scriptedExec(["fail"]);
    await expect(
      useDashboardQueryStore.getState().setPopulations(scripted, ["birthdays"]),
    ).rejects.toThrow("write failed");
    expect(useDashboardQueryStore.getState().populations).toEqual([
      "favourites",
    ]);
    expect(await storedPopulations()).toEqual(["favourites"]);
  });

  it("restores durable A after B and C both fail (review R1-07)", async () => {
    await useDashboardQueryStore.getState().setPopulations(exec, ["birthdays"]);
    const { exec: scripted } = scriptedExec(["fail", "fail"]);
    const b = useDashboardQueryStore
      .getState()
      .setPopulations(scripted, ["favourites"]);
    const c = useDashboardQueryStore
      .getState()
      .setPopulations(scripted, ["snoozed"]);
    await expect(b).rejects.toThrow("write failed");
    await expect(c).rejects.toThrow("write failed");
    expect(useDashboardQueryStore.getState().populations).toEqual([
      "birthdays",
    ]);
    expect(await storedPopulations()).toEqual(["birthdays"]);
  });

  it("restores B when durable A, then B succeeds, then C fails", async () => {
    await useDashboardQueryStore.getState().setSort(exec, "name-asc");
    const { exec: scripted } = scriptedExec(["ok", "fail"]);
    const b = useDashboardQueryStore.getState().setSort(scripted, "name-desc");
    const c = useDashboardQueryStore.getState().setSort(scripted, "status");
    await b;
    await expect(c).rejects.toThrow("write failed");
    expect(useDashboardQueryStore.getState().sort).toBe("name-desc");
    expect(await storedSort()).toBe("name-desc");
  });

  it("restores both axes when a combined drill write fails with nothing newer pending", async () => {
    await useDashboardQueryStore
      .getState()
      .setPopulationsAndFilters(exec, ["favourites"], {
        "needs-attention": ["on"],
      });
    const { exec: scripted } = scriptedExec(["fail"]);
    await expect(
      useDashboardQueryStore
        .getState()
        .setPopulationsAndFilters(scripted, ["not-contacted"], {}),
    ).rejects.toThrow("write failed");
    expect(useDashboardQueryStore.getState()).toMatchObject({
      populations: ["favourites"],
      filters: { "needs-attention": ["on"] },
    });
  });

  it("resolves the drill and Reset setters only after their write lands", async () => {
    for (const run of [
      (scripted: SqlExecutor) =>
        useDashboardQueryStore
          .getState()
          .setPopulationsAndFilters(scripted, ["not-contacted"], {}),
      (scripted: SqlExecutor) =>
        useDashboardQueryStore.getState().resetDashboardView(scripted),
    ]) {
      const gate = deferred();
      const { exec: scripted, landed } = scriptedExec([
        { gate: gate.promise, outcome: "ok" },
      ]);
      let settled = false;
      const write = run(scripted).then(() => {
        settled = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(settled).toBe(false);
      expect(landed).toHaveLength(0);
      gate.resolve();
      await write;
      expect(settled).toBe(true);
      expect(landed).toHaveLength(1);
    }
    expect(await storedPopulations()).toEqual([]);
  });

  it("does not let a hydrate overwrite an optimistic value whose write is still pending", async () => {
    await exec.runAsync(
      `UPDATE app_settings SET dashboard_populations = '["favourites"]' WHERE id = 1`,
    );
    const read = deferred();
    const delayedExec: SqlExecutor = {
      ...exec,
      getFirstAsync: async <T>(sql: string, params?: unknown[]) => {
        await read.promise;
        return exec.getFirstAsync<T>(sql, params);
      },
    };
    const writeGate = deferred();
    const { exec: scripted } = scriptedExec([
      { gate: writeGate.promise, outcome: "ok" },
    ]);
    const hydration = useDashboardQueryStore.getState().hydrate(delayedExec);
    const write = useDashboardQueryStore
      .getState()
      .setPopulations(scripted, ["snoozed"]);
    read.resolve();
    await hydration;
    expect(useDashboardQueryStore.getState().populations).toEqual(["snoozed"]);
    writeGate.resolve();
    await write;
    expect(useDashboardQueryStore.getState().populations).toEqual(["snoozed"]);
  });

  it("restores the hydrated stored value, not the initial default, when the first write fails after a dropped hydrate (review R2-05)", async () => {
    await exec.runAsync(
      `UPDATE app_settings SET dashboard_populations = '["favourites"]' WHERE id = 1`,
    );
    const read = deferred();
    const delayedExec: SqlExecutor = {
      ...exec,
      getFirstAsync: async <T>(sql: string, params?: unknown[]) => {
        await read.promise;
        return exec.getFirstAsync<T>(sql, params);
      },
    };
    const writeGate = deferred();
    const { exec: scripted } = scriptedExec([
      { gate: writeGate.promise, outcome: "fail" },
    ]);
    const hydration = useDashboardQueryStore.getState().hydrate(delayedExec);
    const write = useDashboardQueryStore
      .getState()
      .setPopulations(scripted, ["snoozed"]);
    read.resolve();
    await hydration;
    expect(useDashboardQueryStore.getState().populations).toEqual(["snoozed"]);
    writeGate.resolve();
    await expect(write).rejects.toThrow("write failed");
    expect(useDashboardQueryStore.getState().populations).toEqual([
      "favourites",
    ]);
  });

  it("never lets an older hydrate snapshot overwrite the committed value of an axis written since it began", async () => {
    const read = deferred();
    const snapshotTaken = deferred();
    const staleExec: SqlExecutor = {
      ...exec,
      getFirstAsync: async <T>(sql: string, params?: unknown[]) => {
        const row = await exec.getFirstAsync<T>(sql, params);
        snapshotTaken.resolve();
        await read.promise;
        return row;
      },
    };
    const hydration = useDashboardQueryStore.getState().hydrate(staleExec);
    await snapshotTaken.promise;
    await useDashboardQueryStore.getState().setSort(exec, "name-asc");
    read.resolve();
    await hydration;
    expect(useDashboardQueryStore.getState().sort).toBe("name-asc");
    expect(useDashboardQueryStore.getState().committed.sort).toBe("name-asc");

    const { exec: scripted } = scriptedExec(["fail"]);
    await expect(
      useDashboardQueryStore.getState().setSort(scripted, "status"),
    ).rejects.toThrow("write failed");
    expect(useDashboardQueryStore.getState().sort).toBe("name-asc");
  });

  it("counts pending writes per axis while queued and releases them on settle", async () => {
    const gate = deferred();
    const { exec: scripted } = scriptedExec([
      { gate: gate.promise, outcome: "ok" },
      "fail",
      "ok",
    ]);
    const populations = useDashboardQueryStore
      .getState()
      .setPopulations(scripted, ["favourites"]);
    const sort = useDashboardQueryStore.getState().setSort(scripted, "status");
    const combined = useDashboardQueryStore
      .getState()
      .setPopulationsAndFilters(scripted, [], { "needs-attention": ["on"] });
    expect(useDashboardQueryStore.getState().pendingAxes).toEqual({
      populations: 2,
      filters: 1,
      sort: 1,
    });
    gate.resolve();
    await populations;
    await expect(sort).rejects.toThrow("write failed");
    await combined;
    expect(useDashboardQueryStore.getState().pendingAxes).toEqual({
      populations: 0,
      filters: 0,
      sort: 0,
    });
  });
});
