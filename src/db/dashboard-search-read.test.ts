import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { listDashboardPopulation } from "@/db/dashboard-read";
import { composeDashboardSearch } from "@/db/dashboard-search-read";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { addMemory } from "@/db/memories-dao";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import type {
  DashboardPopulation,
  DashboardQueryState,
} from "@/logic/dashboard-query-logic";

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

/** Inserts a contact with explicit lifecycle columns (Unbound = tracking 0). */
async function lifecycleContact(
  name: string,
  opts: {
    tracking: 0 | 1;
    lastContact: string | null;
    intervalDays?: number | null;
    archivedAt?: string | null;
  },
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts
       (uid, name, interval_days, last_contact, tracking_enabled, archived_at, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `contact-${++counter}`,
      name,
      opts.intervalDays === undefined ? 30 : opts.intervalDays,
      opts.lastContact,
      opts.tracking,
      opts.archivedAt ?? null,
      NOW,
      NOW,
    ],
  );
  return result.lastInsertRowId;
}

async function setUnboundNeverContactedOptIn(on: 0 | 1): Promise<void> {
  await exec.runAsync(
    "UPDATE app_settings SET include_unbound_never_contacted = ? WHERE id = 1",
    [on],
  );
}

function on(
  populations: DashboardPopulation[],
  filters: DashboardQueryState["filters"] = {},
): DashboardQueryState {
  return { ...active, populations, filters };
}

async function foundIds(
  query: DashboardQueryState,
  term: string,
): Promise<number[]> {
  const rows = await composeDashboardSearch(exec, query, term, NOW);
  return rows.map((entry) => entry.row.id);
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

describe("composeDashboardSearch Unbound scope (D-59, D-79)", () => {
  it("finds a contacted Unbound person only on a search of exactly All Contacts", async () => {
    const zed = await lifecycleContact("Zed Unbound", {
      tracking: 0,
      lastContact: "2026-09-01",
    });

    expect(await foundIds(on(["all-contacts"]), "zed")).toEqual([zed]);
    for (const populations of [
      [],
      ["favourites"],
      ["not-contacted"],
      ["all-contacts", "favourites"],
    ] as DashboardPopulation[][]) {
      expect(await foundIds(on(populations), "zed")).not.toContain(zed);
    }
  });

  it("keeps a never-contacted Unbound person out of a Never Contacted search while the opt-in is off", async () => {
    await setUnboundNeverContactedOptIn(0);
    const nia = await lifecycleContact("Nia Unbound", {
      tracking: 0,
      lastContact: null,
    });

    expect(await foundIds(on(["not-contacted"]), "nia")).not.toContain(nia);
    // D-59: All Contacts finds her regardless of the opt-in.
    expect(await foundIds(on(["all-contacts"]), "nia")).toEqual([nia]);
  });

  it("finds a never-contacted Unbound person on Never Contacted and All Contacts while the opt-in is on, and nowhere else", async () => {
    await setUnboundNeverContactedOptIn(1);
    const nia = await lifecycleContact("Nia Unbound", {
      tracking: 0,
      lastContact: null,
    });

    expect(await foundIds(on(["not-contacted"]), "nia")).toEqual([nia]);
    expect(await foundIds(on(["all-contacts"]), "nia")).toEqual([nia]);
    for (const populations of [
      [],
      ["favourites"],
      ["snoozed"],
      ["not-contacted", "favourites"],
    ] as DashboardPopulation[][]) {
      expect(await foundIds(on(populations), "nia")).not.toContain(nia);
    }
  });

  it("lists the opted-in never-contacted Unbound person on the unsearched Never Contacted population too", async () => {
    await setUnboundNeverContactedOptIn(1);
    const nia = await lifecycleContact("Nia Unbound", {
      tracking: 0,
      lastContact: null,
    });

    const rows = await listDashboardPopulation(
      exec,
      on(["not-contacted"]),
      NOW,
    );

    expect(rows.map((row) => row.id)).toContain(nia);
  });

  it("finds an Unbound person by a memory word on All Contacts through the corpus", async () => {
    const quill = await lifecycleContact("Quill Unbound", {
      tracking: 0,
      lastContact: "2026-09-01",
    });
    await memory(quill, "loves origami cranes");

    const rows = await composeDashboardSearch(
      exec,
      on(["all-contacts"]),
      "origami",
      NOW,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      row: { id: quill, trackingEnabled: 0, status: null, progress: null },
      match: { contactId: quill },
    });
  });

  it("never finds an Unbound person in the Bin", async () => {
    await setUnboundNeverContactedOptIn(1);
    const binnedContacted = await lifecycleContact("Bina Unbound", {
      tracking: 0,
      lastContact: "2026-09-01",
      archivedAt: NOW,
    });
    const binnedNever = await lifecycleContact("Bina Never", {
      tracking: 0,
      lastContact: null,
      archivedAt: NOW,
    });

    for (const populations of [
      [],
      ["all-contacts"],
      ["not-contacted"],
    ] as DashboardPopulation[][]) {
      const ids = await foundIds(on(populations), "bina");
      expect(ids).not.toContain(binnedContacted);
      expect(ids).not.toContain(binnedNever);
    }
  });

  it("keeps the unsearched All Contacts population Bound-only", async () => {
    await setUnboundNeverContactedOptIn(1);
    const bound = await contact("Bound Person");
    const unboundContacted = await lifecycleContact("Zed Unbound", {
      tracking: 0,
      lastContact: "2026-09-01",
    });
    const unboundNever = await lifecycleContact("Nia Unbound", {
      tracking: 0,
      lastContact: null,
    });

    const rows = await listDashboardPopulation(exec, on(["all-contacts"]), NOW);
    const ids = rows.map((row) => row.id);

    expect(ids).toContain(bound);
    expect(ids).not.toContain(unboundContacted);
    expect(ids).not.toContain(unboundNever);
  });

  it("never admits an Unbound person through needs-attention, even on an All Contacts search", async () => {
    const overdueUnbound = await lifecycleContact("Olive Unbound", {
      tracking: 0,
      lastContact: "2020-01-01",
      intervalDays: 30,
    });
    const overdueBound = await lifecycleContact("Olive Bound", {
      tracking: 1,
      lastContact: "2020-01-01",
      intervalDays: 30,
    });
    const freshBound = await lifecycleContact("Olive Fresh", {
      tracking: 1,
      lastContact: "2020-01-01",
      intervalDays: 1_000_000,
    });

    const needsAttention = on(["all-contacts"], { "needs-attention": ["on"] });
    const ids = await foundIds(needsAttention, "olive");

    expect(ids).toContain(overdueBound);
    expect(ids).not.toContain(overdueUnbound);
    expect(ids).not.toContain(freshBound);
    // Without the filter the same search does find the Unbound person (D-59).
    expect(await foundIds(on(["all-contacts"]), "olive")).toContain(
      overdueUnbound,
    );
  });
});
