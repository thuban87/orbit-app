import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { addFuel } from "@/db/fuel-dao";
import { composeDashboardSearch } from "@/db/dashboard-search-read";
import { addMemory } from "@/db/memories-dao";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import type { DashboardQueryState } from "@/logic/dashboard-query-logic";

const NOW = "2026-09-05 12:00:00";
let exec: SqlExecutor;
let counter = 0;

const active: DashboardQueryState = {
  viewMode: "list",
  populations: [],
  filters: {},
  sort: "default",
};

beforeEach(async () => {
  counter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: () => `migration-${++counter}`,
  });
});

async function contact(name: string, favouriteRank: number | null = null): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts
       (uid, name, interval_days, last_contact, favourite_rank, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [`contact-${++counter}`, name, 30, "2026-09-01", favouriteRank, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function memory(contactId: number, value: string): Promise<void> {
  await addMemory(exec, {
    contactId,
    type: "general",
    value,
    createdAt: NOW,
    now: NOW,
  });
}

describe("composeDashboardSearch", () => {
  it("keeps relevance first, then appends fuel-only rows in Dashboard order", async () => {
    const lessRelevant = await contact("Alpha low relevance");
    const moreRelevant = await contact("Zulu high relevance");
    const fuelOnly = await contact("Beta fuel only");
    await memory(lessRelevant, "lambda");
    await memory(moreRelevant, "lambda sigma");
    await addFuel(exec, {
      uid: `fuel-${++counter}`,
      contactId: fuelOnly,
      kind: "topic",
      text: "lambda sigma",
      source: "user",
      createdAt: NOW,
      now: NOW,
    });

    const rows = await composeDashboardSearch(exec, active, "lambda sigma", NOW);

    expect(rows.map((entry) => entry.row.id)).toEqual([
      moreRelevant,
      lessRelevant,
      fuelOnly,
    ]);
    expect(rows.slice(0, 2).every((entry) => entry.match !== null)).toBe(true);
    expect(rows[2]).toMatchObject({ match: null, row: { snippet: "lambda sigma" } });
  });

  it("surfaces memory-only matches but never lets them bypass the eligible universe", async () => {
    const favourite = await contact("Favourite name", 1);
    const excluded = await contact("Excluded name");
    await memory(favourite, "orchid-only-match");
    await memory(excluded, "orchid-only-match");

    const rows = await composeDashboardSearch(
      exec,
      { ...active, populations: ["favourites"] },
      "orchid-only-match",
      NOW,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      row: { id: favourite },
      match: {
        contactId: favourite,
        totalMatchCount: 1,
        matches: [expect.objectContaining({ sourceKind: "memory-or-custom-field" })],
      },
    });
    expect(rows.map((entry) => entry.row.id)).not.toContain(excluded);
  });

  it("returns no results for a blank term", async () => {
    await contact("Anything");
    await expect(composeDashboardSearch(exec, active, "  \n", NOW)).resolves.toEqual([]);
  });
});
