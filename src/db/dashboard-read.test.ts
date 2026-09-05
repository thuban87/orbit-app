/**
 * Dashboard read chokepoint — behavioural proof (DASH-01/02/04/07).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture
 * and the REAL dashboard-read module. Because status/progress derive from
 * `date('now','localtime')` (the real clock), contacts are seeded with
 * last_contact/snooze/birthday dates computed RELATIVE to today via
 * `localDateOffset`, so progress buckets are deterministic regardless of run date.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  type BirthdayCandidate,
  countAllContacts,
  countArchived,
  countBirthdayPopulation,
  countFavourites,
  countLiveContacts,
  countNeverContacted,
  countSnoozed,
  DASHBOARD_BOUND_WHERE,
  FAVOURITES_BOUND_WHERE,
  type FavouriteRow,
  LIVE_CONTACTS_BOUND_WHERE,
  listBirthdayCandidates,
  listDashboardPopulation,
  listDashboardSearch,
  listFavourites,
} from "@/db/dashboard-read";
import type { FuelKind } from "@/db/fuel-dao";
import { addFuel } from "@/db/fuel-dao";
import { getRankedFuel } from "@/db/fuel-read";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { migration006 } from "@/db/migrations/006-normalize-custom-field-values";
import { migration007 } from "@/db/migrations/007-tombstones";
import { migration009 } from "@/db/migrations/009-contact-method-normalization";
import { migration010 } from "@/db/migrations/010-contact-method-label";
import { migration011 } from "@/db/migrations/011-contact-lifecycle-schema";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import type { DashboardQueryState } from "@/logic/dashboard-query-logic";

const NOW = "2026-08-15 12:00:00";

let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;
let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  const db = openTestDb();
  exec = nodeSqliteExecutor(db);
  await runMigrations(
    exec,
    [
      migration001,
      migration002,
      migration003,
      migration004,
      migration005,
      migration006,
      migration007,
      migration009,
      migration010,
      migration011,
    ],
    11,
    { now: NOW, newUid: uid, defaultPhoneRegion: "US" },
  );
});

/** A local `YYYY-MM-DD` string offset `days` from today (matches localtime). */
function localDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface SeedOpts {
  name?: string;
  intervalDays?: number;
  lastContact?: string | null;
  categoryId?: number | null;
  socialBattery?: string | null;
  favouriteRank?: number | null;
  snoozeUntil?: string | null;
  birthday?: string | null;
  rarelyResponds?: number;
  archivedAt?: string | null;
  createdAt?: string;
  trackingEnabled?: number;
}

async function seedContact(o: SeedOpts = {}): Promise<number> {
  const created = o.createdAt ?? NOW;
  const result = await exec.runAsync(
    `INSERT INTO contacts
       (uid, name, interval_days, last_contact, category_id, social_battery,
        favourite_rank, snooze_until, birthday, tracking_enabled, rarely_responds, archived_at,
        created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid(),
      o.name ?? "Alex",
      o.intervalDays ?? 30,
      o.lastContact ?? null,
      o.categoryId ?? null,
      o.socialBattery ?? null,
      o.favouriteRank ?? null,
      o.snoozeUntil ?? null,
      o.birthday ?? null,
      o.trackingEnabled ?? 1,
      o.rarelyResponds ?? 0,
      o.archivedAt ?? null,
      created,
      created,
    ],
  );
  return result.lastInsertRowId;
}

async function addFuelRow(
  c: number,
  opts: { kind?: FuelKind; text: string | null; source?: string },
): Promise<void> {
  await addFuel(exec, {
    uid: uid(),
    contactId: c,
    kind: opts.kind ?? "topic",
    text: opts.text,
    createdAt: NOW,
    source: opts.source ?? "user",
    now: NOW,
  });
}

async function addInteractionRows(
  contactId: number,
  count: number,
): Promise<void> {
  for (let index = 0; index < count; index++) {
    await exec.runAsync(
      `INSERT INTO interactions
         (uid, contact_id, occurred_at, recorded_at, channel, direction, connected, source, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uid(), contactId, NOW, NOW, "unspecified", "outgoing", 1, "user", NOW],
    );
  }
}

const ids = (rows: { id: number }[]) => rows.map((r) => r.id);

// interval_days = 30 throughout, so: stable < 24d elapsed (< 0.8), wobble at
// [24,30), decay at [30,90), rogue >= 90d (progress >= 3).
const STABLE = () => localDateOffset(-2); // ~0.07
const WOBBLE = () => localDateOffset(-26); // ~0.87
const ROGUE = () => localDateOffset(-200); // ~6.7

describe("listDashboardPopulation — Phase 25 Active universe", () => {
  const active: DashboardQueryState = {
    viewMode: "list",
    populations: [],
    filters: {},
    sort: "default",
  };

  it("excludes archived, never-contacted, and Unbound but includes a currently-snoozed status-bearing contact", async () => {
    const live = await seedContact({ name: "Live", lastContact: STABLE() });
    const snoozed = await seedContact({
      name: "Snoozed",
      lastContact: STABLE(),
      snoozeUntil: localDateOffset(5),
    });
    await seedContact({ name: "Never", lastContact: null });
    await seedContact({
      name: "Archived",
      lastContact: STABLE(),
      archivedAt: NOW,
    });
    await seedContact({
      name: "Unbound",
      lastContact: STABLE(),
      trackingEnabled: 0,
    });

    expect(
      (await listDashboardPopulation(exec, active, NOW))
        .map((row) => row.id)
        .sort(),
    ).toEqual([live, snoozed].sort());
  });

  it("returns a deduped Favourites and Not Contacted OR-union with match reasons", async () => {
    const both = await seedContact({
      name: "Both",
      lastContact: null,
      favouriteRank: 3,
    });
    const favourite = await seedContact({
      name: "Favourite",
      lastContact: STABLE(),
      favouriteRank: 1,
    });
    const never = await seedContact({ name: "Never", lastContact: null });

    const rows = await listDashboardPopulation(
      exec,
      { ...active, populations: ["favourites", "not-contacted"] },
      NOW,
    );

    expect(ids(rows).sort((a, b) => a - b)).toEqual(
      [both, favourite, never].sort((a, b) => a - b),
    );
    expect(rows.filter((row) => row.id === both)).toHaveLength(1);
    expect(rows.find((row) => row.id === both)).toMatchObject({
      isFavourite: 1,
      isNotContacted: 1,
      status: null,
      progress: null,
    });
  });

  it("keeps snoozed status-bearing contacts in Active and All Contacts", async () => {
    const snoozed = await seedContact({
      name: "Snoozed",
      lastContact: STABLE(),
      snoozeUntil: localDateOffset(6),
    });
    const never = await seedContact({ name: "Never", lastContact: null });
    await seedContact({
      name: "Archived",
      lastContact: STABLE(),
      archivedAt: NOW,
    });
    await seedContact({
      name: "Unbound",
      lastContact: null,
      trackingEnabled: 0,
    });

    const activeRows = await listDashboardPopulation(exec, active, NOW);
    const allRows = await listDashboardPopulation(
      exec,
      { ...active, populations: ["all-contacts"] },
      NOW,
    );
    const snoozedRows = await listDashboardPopulation(
      exec,
      { ...active, populations: ["snoozed", "all-contacts"] },
      NOW,
    );

    expect(activeRows.find((row) => row.id === snoozed)).toMatchObject({
      status: "stable",
    });
    expect(ids(allRows).sort((a, b) => a - b)).toEqual(
      [snoozed, never].sort((a, b) => a - b),
    );
    expect(allRows.find((row) => row.id === never)).toMatchObject({
      status: null,
      progress: null,
    });
    expect(snoozedRows.filter((row) => row.id === snoozed)).toHaveLength(1);
    expect(
      snoozedRows.find((row) => row.id === snoozed)?.status,
    ).not.toBeNull();
  });

  it("uses Default order rather than favourite rank and natural snooze/not-contacted orders", async () => {
    const alphaFavourite = await seedContact({
      name: "Alpha",
      lastContact: STABLE(),
      favouriteRank: 99,
    });
    const zetaFavourite = await seedContact({
      name: "Zeta",
      lastContact: STABLE(),
      favouriteRank: 1,
    });
    const olderNever = await seedContact({
      name: "Older",
      lastContact: null,
      createdAt: "2026-01-01 00:00:00",
    });
    const newerNever = await seedContact({
      name: "Newer",
      lastContact: null,
      createdAt: "2026-02-01 00:00:00",
    });
    const earlierSnooze = await seedContact({
      name: "Earlier",
      lastContact: STABLE(),
      snoozeUntil: localDateOffset(3),
    });
    const laterSnooze = await seedContact({
      name: "Later",
      lastContact: STABLE(),
      snoozeUntil: localDateOffset(7),
    });

    expect(
      (
        await listDashboardPopulation(
          exec,
          { ...active, populations: ["favourites"] },
          NOW,
        )
      ).map((row) => row.id),
    ).toEqual([alphaFavourite, zetaFavourite]);
    expect(
      (
        await listDashboardPopulation(
          exec,
          { ...active, populations: ["not-contacted"] },
          NOW,
        )
      ).map((row) => row.id),
    ).toEqual([olderNever, newerNever]);
    expect(
      (
        await listDashboardPopulation(
          exec,
          { ...active, populations: ["snoozed"] },
          NOW,
        )
      ).map((row) => row.id),
    ).toEqual([earlierSnooze, laterSnooze]);
  });

  it("computes the birthday window from injected local time and sorts soonest first", async () => {
    const tenDays = await seedContact({ name: "Ten", birthday: "08-25" });
    const twentyFiveDays = await seedContact({
      name: "Twenty Five",
      birthday: "09-09",
    });
    await seedContact({ name: "Forty", birthday: "09-24" });

    expect(
      (
        await listDashboardPopulation(
          exec,
          { ...active, populations: ["birthdays"] },
          "2026-08-15 10:00:00",
        )
      ).map((row) => row.id),
    ).toEqual([tenDays, twentyFiveDays]);
  });

  it("returns no rows for an empty birthday id set without an invalid IN clause", async () => {
    await seedContact({ name: "Forty", birthday: "09-24" });

    await expect(
      listDashboardPopulation(
        exec,
        { ...active, populations: ["birthdays"] },
        "2026-08-15 10:00:00",
      ),
    ).resolves.toEqual([]);
  });

  it("ANDs the worked category, battery, and Needs Attention filters while suppressing snoozes", async () => {
    const family = await seedContact({
      name: "Family Charger",
      categoryId: 1,
      socialBattery: "Charger",
      lastContact: ROGUE(),
    });
    const friends = await seedContact({
      name: "Friends Neutral",
      categoryId: 2,
      socialBattery: "Neutral",
      lastContact: WOBBLE(),
    });
    const snoozed = await seedContact({
      name: "Snoozed Match",
      categoryId: 1,
      socialBattery: "Charger",
      lastContact: ROGUE(),
      snoozeUntil: localDateOffset(5),
    });
    await seedContact({
      name: "Wrong Battery",
      categoryId: 1,
      socialBattery: "Drain",
      lastContact: ROGUE(),
    });

    const filters = {
      category: ["1", "2"],
      "social-battery": ["Charger", "Neutral"],
      "needs-attention": ["on"],
    };
    expect(
      ids(
        await listDashboardPopulation(exec, { ...active, filters }, NOW),
      ).sort((a, b) => a - b),
    ).toEqual([family, friends].sort((a, b) => a - b));
    expect(ids(await listDashboardPopulation(exec, active, NOW))).toContain(
      snoozed,
    );
  });

  it("keeps the same filters when the selected population changes", async () => {
    const favourite = await seedContact({
      name: "Favourite Match",
      categoryId: 1,
      socialBattery: "Charger",
      favouriteRank: 1,
      lastContact: ROGUE(),
    });
    await seedContact({
      name: "Non-favourite Match",
      categoryId: 1,
      socialBattery: "Charger",
      lastContact: ROGUE(),
    });
    const filters = {
      category: ["1"],
      "social-battery": ["Charger"],
      "needs-attention": ["on"],
    };

    await expect(
      listDashboardPopulation(
        exec,
        { ...active, populations: ["favourites"], filters },
        NOW,
      ),
    ).resolves.toMatchObject([{ id: favourite }]);
    await expect(
      listDashboardPopulation(
        exec,
        { ...active, populations: ["favourites"], filters },
        NOW,
      ),
    ).resolves.toHaveLength(1);
  });

  it("uses the post-query Gravity survivors as the fully-filtered id scope", async () => {
    const deep = await seedContact({ name: "Deep", lastContact: STABLE() });
    const thin = await seedContact({ name: "Thin", lastContact: STABLE() });
    await addInteractionRows(deep, 20);

    const rows = await listDashboardPopulation(
      exec,
      { ...active, filters: { gravity: ["deep"] } },
      "2026-09-04 10:00:00",
    );

    expect(ids(rows)).toEqual([deep]);
    expect(ids(rows)).not.toContain(thin);
  });

  it("orders every explicit sort while Default remains population-aware", async () => {
    const alpha = await seedContact({
      name: "Alpha",
      lastContact: localDateOffset(-1),
    });
    const bravo = await seedContact({
      name: "Bravo",
      lastContact: localDateOffset(-30),
    });
    const charlie = await seedContact({
      name: "Charlie",
      lastContact: localDateOffset(-200),
    });
    const read = (sort: DashboardQueryState["sort"]) =>
      listDashboardPopulation(exec, { ...active, sort }, NOW).then(ids);

    await expect(read("default")).resolves.toEqual([charlie, bravo, alpha]);
    await expect(read("status")).resolves.toEqual([charlie, bravo, alpha]);
    await expect(read("name-asc")).resolves.toEqual([alpha, bravo, charlie]);
    await expect(read("name-desc")).resolves.toEqual([charlie, bravo, alpha]);
    await expect(read("least-recent")).resolves.toEqual([
      charlie,
      bravo,
      alpha,
    ]);
    await expect(read("most-recent")).resolves.toEqual([alpha, bravo, charlie]);
  });
});

describe("listDashboardSearch — population-aware search + A3 scope", () => {
  const active: DashboardQueryState = {
    viewMode: "list",
    populations: [],
    filters: {},
    sort: "default",
  };

  it("relaxes the implicit Active default to archived-only while staying Bound-only", async () => {
    const never = await seedContact({ name: "A3 Never", lastContact: null });
    const snoozed = await seedContact({
      name: "A3 Snoozed",
      lastContact: STABLE(),
      snoozeUntil: localDateOffset(5),
    });
    await seedContact({
      name: "A3 Archived",
      lastContact: STABLE(),
      archivedAt: NOW,
    });
    await seedContact({
      name: "A3 Unbound",
      lastContact: STABLE(),
      trackingEnabled: 0,
    });

    const rows = await listDashboardSearch(exec, active, "a3", NOW);

    expect(ids(rows).sort((a, b) => a - b)).toEqual(
      [never, snoozed].sort((a, b) => a - b),
    );
    expect(rows.find((row) => row.id === never)).toMatchObject({
      status: null,
      progress: null,
    });
  });

  it("AND-composes explicit populations and filters with name/fuel matching and preserves snippets", async () => {
    const favourite = await seedContact({
      name: "Sushi Favourite",
      lastContact: STABLE(),
      favouriteRank: 1,
      categoryId: 1,
    });
    const fuelMatch = await seedContact({
      name: "Different Name",
      lastContact: STABLE(),
      favouriteRank: 2,
      categoryId: 1,
    });
    await addFuelRow(fuelMatch, { text: "sushi rolls" });
    await seedContact({
      name: "Sushi Wrong Category",
      lastContact: STABLE(),
      favouriteRank: 3,
      categoryId: 2,
    });
    await seedContact({
      name: "Sushi Not Favourite",
      lastContact: STABLE(),
      categoryId: 1,
    });

    const rows = await listDashboardSearch(
      exec,
      { ...active, populations: ["favourites"], filters: { category: ["1"] } },
      "sushi",
      NOW,
    );
    const byId = new Map(rows.map((row) => [row.id, row]));

    expect(ids(rows).sort((a, b) => a - b)).toEqual(
      [favourite, fuelMatch].sort((a, b) => a - b),
    );
    expect(byId.get(favourite)?.snippet).toBeNull();
    expect(byId.get(fuelMatch)?.snippet).toBe("sushi rolls");
  });

  it("resolves birthday ids for a term and uses the soonest-birthday sort", async () => {
    const tomorrow = await seedContact({
      name: "Birthday Match Tomorrow",
      birthday: "08-16",
    });
    const nextWeek = await seedContact({
      name: "Birthday Match Next Week",
      birthday: "08-22",
    });
    await seedContact({ name: "Birthday Match Outside", birthday: "09-24" });

    const rows = await listDashboardSearch(
      exec,
      { ...active, populations: ["birthdays"] },
      "birthday match",
      NOW,
    );

    expect(ids(rows)).toEqual([tomorrow, nextWeek]);
  });

  it("applies the post-query gravity pass to term results", async () => {
    const deep = await seedContact({
      name: "Gravity Match Deep",
      lastContact: STABLE(),
    });
    const thin = await seedContact({
      name: "Gravity Match Thin",
      lastContact: STABLE(),
    });
    await addInteractionRows(deep, 20);

    const rows = await listDashboardSearch(
      exec,
      { ...active, filters: { gravity: ["deep"] } },
      "gravity match",
      "2026-09-04 10:00:00",
    );

    expect(ids(rows)).toEqual([deep]);
    expect(ids(rows)).not.toContain(thin);
  });

  it("returns [] for empty terms", async () => {
    await seedContact({ name: "Live", lastContact: STABLE() });
    await expect(
      listDashboardSearch(exec, active, "  \n\t", NOW),
    ).resolves.toEqual([]);
  });

  it("keeps fuelText parity with the ranked fuel projection", async () => {
    const contact = await seedContact({
      name: "Fuel Search",
      lastContact: STABLE(),
    });
    await addFuelRow(contact, { kind: "fact", text: "an older fact" });
    await addFuelRow(contact, { kind: "recent", text: "a current fuel line" });

    const ranked = await getRankedFuel(exec, contact);
    const rows = await listDashboardSearch(exec, active, "fuel search", NOW);

    expect(rows[0]?.fuelText).toBe(ranked[0]?.text ?? null);
  });

  it("uses the shared deterministic name/id tiebreak for equal progress rows", async () => {
    const alpha = await seedContact({
      name: "Tie Alpha",
      lastContact: STABLE(),
    });
    const zetaFirst = await seedContact({
      name: "Tie Zeta",
      lastContact: STABLE(),
    });
    const zetaSecond = await seedContact({
      name: "Tie Zeta",
      lastContact: STABLE(),
    });

    expect(ids(await listDashboardSearch(exec, active, "tie", NOW))).toEqual([
      alpha,
      zetaFirst,
      zetaSecond,
    ]);
  });

  it("treats %, _, backslash, and quotes as literal search text", async () => {
    const literal = await seedContact({
      name: "Literal 50%_\\' marker",
      lastContact: STABLE(),
    });
    await seedContact({ name: "Literal 50xx marker", lastContact: STABLE() });

    await expect(
      listDashboardSearch(exec, active, "50%_\\'", NOW).then(ids),
    ).resolves.toEqual([literal]);
  });

  it("AND-composes category and battery filters with the term", async () => {
    const match = await seedContact({
      name: "Filter Term Match",
      lastContact: STABLE(),
      categoryId: 1,
      socialBattery: "Charger",
    });
    await seedContact({
      name: "Filter Term Wrong Battery",
      lastContact: STABLE(),
      categoryId: 1,
      socialBattery: "Drain",
    });

    await expect(
      listDashboardSearch(
        exec,
        {
          ...active,
          filters: { category: ["1"], "social-battery": ["Charger"] },
        },
        "filter term",
        NOW,
      ).then(ids),
    ).resolves.toEqual([match]);
  });

  it("matches the population read's birthday post-sort", async () => {
    await seedContact({ name: "Parity Birthday Eight", birthday: "08-23" });
    await seedContact({ name: "Parity Birthday One", birthday: "08-16" });
    const query: DashboardQueryState = {
      ...active,
      populations: ["birthdays"],
    };

    const populationRows = await listDashboardPopulation(exec, query, NOW);
    const searchRows = await listDashboardSearch(
      exec,
      query,
      "parity birthday",
      NOW,
    );

    expect(ids(searchRows)).toEqual(ids(populationRows));
  });

  it("matches the population read's gravity survivors", async () => {
    const deep = await seedContact({
      name: "Parity Gravity Deep",
      lastContact: STABLE(),
    });
    await seedContact({ name: "Parity Gravity Thin", lastContact: STABLE() });
    await addInteractionRows(deep, 20);
    const query = { ...active, filters: { gravity: ["deep"] } };

    const populationRows = await listDashboardPopulation(
      exec,
      query,
      "2026-09-04 10:00:00",
    );
    const searchRows = await listDashboardSearch(
      exec,
      query,
      "parity gravity",
      "2026-09-04 10:00:00",
    );

    expect(new Set(ids(searchRows))).toEqual(new Set(ids(populationRows)));
  });

  it("counts only bound non-archived birthday population rows", async () => {
    await seedContact({ name: "Bound Birthday", birthday: "08-16" });
    await seedContact({
      name: "Unbound Birthday",
      birthday: "08-16",
      trackingEnabled: 0,
    });
    await seedContact({
      name: "Archived Birthday",
      birthday: "08-16",
      archivedAt: NOW,
    });
    const query: DashboardQueryState = {
      ...active,
      populations: ["birthdays"],
    };

    expect(await countBirthdayPopulation(exec, NOW)).toBe(1);
    expect(await countBirthdayPopulation(exec, NOW)).toBe(
      (await listDashboardPopulation(exec, query, NOW)).length,
    );
  });

  it("returns zero for an empty upcoming-birthday window without throwing", async () => {
    await seedContact({ name: "Outside Window", birthday: "10-31" });
    await expect(countBirthdayPopulation(exec, NOW)).resolves.toBe(0);
  });

  it("counts favourite membership with bound-only population parity", async () => {
    await seedContact({ name: "Bound Favourite", favouriteRank: 1 });
    await seedContact({
      name: "Unbound Favourite",
      favouriteRank: 1,
      trackingEnabled: 0,
    });
    await seedContact({
      name: "Archived Favourite",
      favouriteRank: 1,
      archivedAt: NOW,
    });
    const query: DashboardQueryState = {
      ...active,
      populations: ["favourites"],
    };

    expect(await countFavourites(exec)).toBe(1);
    expect(await countFavourites(exec)).toBe(
      (await listDashboardPopulation(exec, query, NOW)).length,
    );
  });

  it("counts all bound non-archived contacts with population parity", async () => {
    await seedContact({ name: "Bound Contacted", lastContact: STABLE() });
    await seedContact({ name: "Bound Never", lastContact: null });
    await seedContact({
      name: "Unbound",
      lastContact: STABLE(),
      trackingEnabled: 0,
    });
    await seedContact({
      name: "Archived",
      lastContact: STABLE(),
      archivedAt: NOW,
    });
    const query: DashboardQueryState = {
      ...active,
      populations: ["all-contacts"],
    };

    expect(await countAllContacts(exec)).toBe(2);
    expect(await countAllContacts(exec)).toBe(
      (await listDashboardPopulation(exec, query, NOW)).length,
    );
  });
});

describe("listFavourites", () => {
  it("returns non-archived favourites ordered by favourite_rank ASC", async () => {
    const third = await seedContact({ name: "C", favouriteRank: 3 });
    const first = await seedContact({ name: "A", favouriteRank: 1 });
    const second = await seedContact({ name: "B", favouriteRank: 2 });
    await seedContact({ name: "NotFav" }); // no rank
    await seedContact({
      name: "ArchivedFav",
      favouriteRank: 0,
      archivedAt: NOW,
    });
    const rows: FavouriteRow[] = await listFavourites(exec);
    expect(ids(rows)).toEqual([first, second, third]);
  });

  it("hides a dormant favourite rank while retaining it in storage", async () => {
    await seedContact({
      name: "Dormant",
      favouriteRank: 1,
      trackingEnabled: 0,
    });
    const bound = await seedContact({ name: "Bound", favouriteRank: 2 });
    expect(ids(await listFavourites(exec))).toEqual([bound]);
  });
});

describe("counts", () => {
  it("the four counts read the right populations (HIGH-2 for countLiveContacts)", async () => {
    await seedContact({ name: "Live1", lastContact: STABLE() });
    await seedContact({ name: "Live2", lastContact: ROGUE() });
    await seedContact({ name: "Never1", lastContact: null });
    await seedContact({ name: "Never2", lastContact: null });
    await seedContact({ name: "Never3", lastContact: null });
    await seedContact({
      name: "Archived",
      lastContact: STABLE(),
      archivedAt: NOW,
    });
    await seedContact({
      name: "Snoozed",
      lastContact: STABLE(),
      snoozeUntil: localDateOffset(5),
    });

    expect(await countLiveContacts(exec)).toBe(3); // 2 live + the snoozed live-contacted
    expect(await countNeverContacted(exec)).toBe(3);
    expect(await countArchived(exec)).toBe(1);
    expect(await countSnoozed(exec)).toBe(1);
  });

  it("countSnoozed is 0 with no future snooze written (Phase 11 gap)", async () => {
    await seedContact({ name: "Live", lastContact: STABLE() });
    await seedContact({
      name: "PastSnooze",
      lastContact: STABLE(),
      snoozeUntil: localDateOffset(-3),
    });
    expect(await countSnoozed(exec)).toBe(0);
  });

  it("counts only Bound live and snoozed contacts for dashboard header parity", async () => {
    await seedContact({ name: "Bound live", lastContact: STABLE() });
    await seedContact({
      name: "Dormant live",
      lastContact: STABLE(),
      trackingEnabled: 0,
    });
    await seedContact({
      name: "Bound snoozed",
      lastContact: STABLE(),
      snoozeUntil: localDateOffset(3),
    });
    await seedContact({
      name: "Dormant snoozed",
      lastContact: STABLE(),
      snoozeUntil: localDateOffset(3),
      trackingEnabled: 0,
    });
    expect(await countLiveContacts(exec)).toBe(2);
    expect(await countSnoozed(exec)).toBe(1);
  });

  it("countNeverContacted excludes an Unbound never-contacted contact until the persisted opt-in (D-03 coverage)", async () => {
    // Lifted from the retired `listNeverContacted` block so the D-03-protected
    // include_unbound_never_contacted × countNeverContacted interaction keeps its
    // ONLY coverage — exercising countNeverContacted alone (never listNeverContacted).
    await seedContact({ name: "Bound Never", lastContact: null });
    await seedContact({
      name: "Unbound Never",
      lastContact: null,
      trackingEnabled: 0,
    });

    expect(await countNeverContacted(exec)).toBe(1);

    await exec.runAsync(
      "UPDATE app_settings SET include_unbound_never_contacted = 1 WHERE id = 1",
    );
    expect(await countNeverContacted(exec)).toBe(2);
  });
});

describe("Bound SQL predicate parity", () => {
  it("keeps dashboard population, live count, and favourites reads on the persisted lifecycle predicate", () => {
    expect(DASHBOARD_BOUND_WHERE).toContain("tracking_enabled = 1");
    expect(LIVE_CONTACTS_BOUND_WHERE).toContain("tracking_enabled = 1");
    expect(FAVOURITES_BOUND_WHERE).toContain("tracking_enabled = 1");
  });
});

describe("listBirthdayCandidates", () => {
  it("returns non-archived contacts with a birthday", async () => {
    const withBday = await seedContact({
      name: "Bday",
      birthday: "1990-03-14",
    });
    await seedContact({ name: "NoBday" });
    await seedContact({
      name: "ArchivedBday",
      birthday: "1988-05-02",
      archivedAt: NOW,
    });
    const rows: BirthdayCandidate[] = await listBirthdayCandidates(exec);
    expect(ids(rows)).toEqual([withBday]);
    expect(rows[0]?.birthday).toBe("1990-03-14");
  });
});
