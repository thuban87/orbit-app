import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { composeDashboardSearch } from "@/db/dashboard-search-read";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
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

async function contact(
  name: string,
  favouriteRank: number | null = null,
): Promise<number> {
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
  it("keeps corpus relevance first", async () => {
    const lessRelevant = await contact("Alpha low relevance");
    const moreRelevant = await contact("Zulu high relevance");
    await memory(lessRelevant, "lambda");
    await memory(moreRelevant, "lambda sigma");

    const rows = await composeDashboardSearch(
      exec,
      active,
      "lambda sigma",
      NOW,
    );

    expect(rows.map((entry) => entry.row.id)).toEqual([
      moreRelevant,
      lessRelevant,
    ]);
    expect(rows.every((entry) => entry.match !== null)).toBe(true);
  });

  it("appends a name-LIKE-only row the corpus scorer cannot match, with no descriptor", async () => {
    // Punctuation tokenizes to nothing, so only the name LIKE can match it.
    const hyphenated = await contact("Mary-Kate");
    await contact("Plain Name");

    const rows = await composeDashboardSearch(exec, active, "-", NOW);

    expect(rows).toEqual([
      expect.objectContaining({
        match: null,
        row: expect.objectContaining({ id: hyphenated }),
      }),
    ]);
  });

  it("finds a share kept in Thought of Them through the corpus", async () => {
    const shared = await contact("Shared target");
    await contact("Bystander");
    await addMemory(exec, {
      contactId: shared,
      type: "thought_of_them",
      value: "Article about tide pools",
      provenance: "share",
      createdAt: NOW,
      now: NOW,
    });

    const rows = await composeDashboardSearch(exec, active, "tide pools", NOW);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      row: { id: shared },
      match: {
        matches: [
          expect.objectContaining({
            sourceKind: "thought-of-them",
            snippet: "Article about tide pools",
          }),
        ],
      },
    });
  });

  it("finds an Off Limits word and names the section in the match", async () => {
    const guarded = await contact("Guarded");
    await exec.runAsync(
      `INSERT INTO off_limits (uid, contact_id, label, text, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ["off-limits-1", guarded, null, "Custody hearing", NOW, NOW],
    );

    const rows = await composeDashboardSearch(exec, active, "custody", NOW);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      row: { id: guarded },
      match: {
        totalMatchCount: 1,
        matches: [
          expect.objectContaining({
            sourceKind: "off-limits",
            fieldLabel: "Off Limits",
            snippet: "Custody hearing",
          }),
        ],
      },
    });
  });

  it("finds a previous Last Talked About value, not only the most recent", async () => {
    const talker = await contact("Talker");
    await exec.runAsync(
      `INSERT INTO current_state_entries
         (uid, contact_id, field_key, value, entry_date, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)`,
      [
        "talk-old",
        talker,
        "last_talked_about",
        "Marathon training",
        "2026-08-01",
        NOW,
        NOW,
        "talk-new",
        talker,
        "last_talked_about",
        "New puppy",
        "2026-09-01",
        NOW,
        NOW,
      ],
    );

    const rows = await composeDashboardSearch(exec, active, "marathon", NOW);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      row: { id: talker },
      match: {
        matches: [
          expect.objectContaining({
            sourceKind: "last-talked-about",
            snippet: "Marathon training",
          }),
        ],
      },
    });
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
        matches: [
          expect.objectContaining({ sourceKind: "memory-or-custom-field" }),
        ],
      },
    });
    expect(rows.map((entry) => entry.row.id)).not.toContain(excluded);
  });

  it("returns no results for a blank term", async () => {
    await contact("Anything");
    await expect(
      composeDashboardSearch(exec, active, "  \n", NOW),
    ).resolves.toEqual([]);
  });
});
