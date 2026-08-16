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
  countArchived,
  countLiveContacts,
  countNeverContacted,
  countSnoozed,
  type DashboardRow,
  type FavouriteRow,
  listBirthdayCandidates,
  listDashboard,
  listFavourites,
  listNeverContacted,
} from "@/db/dashboard-read";
import type { FuelKind } from "@/db/fuel-dao";
import { addFuel } from "@/db/fuel-dao";
import { getRankedFuel } from "@/db/fuel-read";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-15 12:00:00";

let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;
let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  const db = openTestDb();
  exec = nodeSqliteExecutor(db);
  await runMigrations(exec, [migration001], 1, { now: NOW, newUid: uid });
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
}

async function seedContact(o: SeedOpts = {}): Promise<number> {
  const created = o.createdAt ?? NOW;
  const result = await exec.runAsync(
    `INSERT INTO contacts
       (uid, name, interval_days, last_contact, category_id, social_battery,
        favourite_rank, snooze_until, birthday, rarely_responds, archived_at,
        created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

const ids = (rows: { id: number }[]) => rows.map((r) => r.id);

// interval_days = 30 throughout, so: stable < 24d elapsed (< 0.8), wobble at
// [24,30), decay at [30,90), rogue >= 90d (progress >= 3).
const STABLE = () => localDateOffset(-2); // ~0.07
const WOBBLE = () => localDateOffset(-26); // ~0.87
const DECAY = () => localDateOffset(-45); // ~1.5
const ROGUE = () => localDateOffset(-200); // ~6.7

describe("listDashboard — default population + exclusions + snooze", () => {
  it("excludes archived, never-contacted, and currently-snoozed; includes a passed snooze", async () => {
    const live = await seedContact({ name: "Live", lastContact: STABLE() });
    await seedContact({
      name: "Archie",
      lastContact: STABLE(),
      archivedAt: NOW,
    });
    await seedContact({ name: "Never", lastContact: null });
    await seedContact({
      name: "Snoozed",
      lastContact: STABLE(),
      snoozeUntil: localDateOffset(5),
    });
    const passed = await seedContact({
      name: "Woke",
      lastContact: STABLE(),
      snoozeUntil: localDateOffset(-1),
    });

    const rows = await listDashboard(exec, { filter: "all", sort: "status" });
    expect(ids(rows).sort((a, b) => a - b)).toEqual([live, passed]);
  });

  it("status sort orders most-overdue first with a name/id tiebreak", async () => {
    const rogue = await seedContact({ name: "Rogue", lastContact: ROGUE() });
    const decay = await seedContact({ name: "Decay", lastContact: DECAY() });
    const stable = await seedContact({ name: "Stable", lastContact: STABLE() });
    const rows = await listDashboard(exec, { filter: "all", sort: "status" });
    expect(ids(rows)).toEqual([rogue, decay, stable]);
    expect(rows.map((r) => r.status)).toEqual(["rogue", "decay", "stable"]);
  });
});

describe("listDashboard — sorts", () => {
  it("name / least-recent / most-recent order correctly", async () => {
    const cara = await seedContact({
      name: "Cara",
      lastContact: localDateOffset(-5),
    });
    const abe = await seedContact({
      name: "abe",
      lastContact: localDateOffset(-1),
    });
    const bea = await seedContact({
      name: "Bea",
      lastContact: localDateOffset(-9),
    });

    const byName = await listDashboard(exec, { filter: "all", sort: "name" });
    expect(ids(byName)).toEqual([abe, bea, cara]); // NOCASE: abe, Bea, Cara

    const least = await listDashboard(exec, {
      filter: "all",
      sort: "least-recent",
    });
    expect(ids(least)).toEqual([bea, cara, abe]); // oldest last_contact first

    const most = await listDashboard(exec, {
      filter: "all",
      sort: "most-recent",
    });
    expect(ids(most)).toEqual([abe, cara, bea]); // newest last_contact first
  });
});

describe("listDashboard — filters (four mutually-exclusive branches)", () => {
  it("needs-attention narrows WITHIN the base to wobble/decay/rogue", async () => {
    await seedContact({ name: "Stable", lastContact: STABLE() });
    const wobble = await seedContact({ name: "Wobble", lastContact: WOBBLE() });
    const rogue = await seedContact({ name: "Rogue", lastContact: ROGUE() });
    const rows = await listDashboard(exec, {
      filter: "needs-attention",
      sort: "status",
    });
    expect(ids(rows)).toEqual([rogue, wobble]);
  });

  it("category-{id} narrows WITHIN the base", async () => {
    const inCat = await seedContact({ lastContact: STABLE(), categoryId: 2 });
    await seedContact({ lastContact: STABLE(), categoryId: 3 });
    const rows = await listDashboard(exec, {
      filter: "category-2",
      sort: "status",
    });
    expect(ids(rows)).toEqual([inCat]);
  });

  it("battery-{value} narrows WITHIN the base", async () => {
    const low = await seedContact({
      lastContact: STABLE(),
      socialBattery: "low",
    });
    await seedContact({ lastContact: STABLE(), socialBattery: "high" });
    const rows = await listDashboard(exec, {
      filter: "battery-low",
      sort: "status",
    });
    expect(ids(rows)).toEqual([low]);
  });

  it("MEDIUM (a): snoozed branch RETURNS a future-snooze row (a fixed-base+append build would be empty)", async () => {
    const future = await seedContact({
      name: "Future",
      lastContact: STABLE(),
      snoozeUntil: localDateOffset(7),
    });
    await seedContact({ name: "Awake", lastContact: STABLE() }); // no snooze
    const rows = await listDashboard(exec, {
      filter: "snoozed",
      sort: "status",
    });
    expect(ids(rows)).toEqual([future]);
  });

  it("MEDIUM (b): favourites branch INCLUDES a never-contacted favourite (status/progress null)", async () => {
    const ncFav = await seedContact({
      name: "NeverFav",
      lastContact: null,
      favouriteRank: 1,
    });
    const liveFav = await seedContact({
      name: "LiveFav",
      lastContact: STABLE(),
      favouriteRank: 2,
    });
    const snoozedFav = await seedContact({
      name: "SnoozedFav",
      lastContact: STABLE(),
      favouriteRank: 3,
      snoozeUntil: localDateOffset(9),
    });
    await seedContact({ name: "Plain", lastContact: STABLE() });

    const rows = await listDashboard(exec, {
      filter: "favourites",
      sort: "status",
    });
    // Ordered by favourite_rank ASC (NOT the sort map), and a never-contacted +
    // a currently-snoozed favourite are BOTH revealed.
    expect(ids(rows)).toEqual([ncFav, liveFav, snoozedFav]);
    const nc = rows.find((r) => r.id === ncFav) as DashboardRow;
    expect(nc.status).toBeNull();
    expect(nc.progress).toBeNull();
  });

  it("MEDIUM (c): the default branch excludes all three hidden populations for every default filter", async () => {
    await seedContact({
      name: "Archie",
      lastContact: STABLE(),
      archivedAt: NOW,
    });
    await seedContact({ name: "Never", lastContact: null });
    await seedContact({
      name: "Snoozed",
      lastContact: STABLE(),
      snoozeUntil: localDateOffset(5),
      categoryId: 2,
      socialBattery: "low",
    });
    const live = await seedContact({
      name: "Live",
      lastContact: ROGUE(),
      categoryId: 2,
      socialBattery: "low",
    });
    for (const filter of [
      "all",
      "needs-attention",
      "category-2",
      "battery-low",
    ] as const) {
      const rows = await listDashboard(exec, { filter, sort: "status" });
      expect(ids(rows)).toEqual([live]);
    }
  });
});

describe("listDashboard — favourites metadata + LOW-2 precedence", () => {
  it("a live favourite carries its favourite_rank in the default list", async () => {
    const c = await seedContact({ lastContact: STABLE(), favouriteRank: 5 });
    const rows = await listDashboard(exec, { filter: "all", sort: "status" });
    expect(rows.find((r) => r.id === c)?.favourite_rank).toBe(5);
  });

  it("LOW-2: term wins over filter='favourites' — term population, sort-map order, rank still present", async () => {
    const fav = await seedContact({
      name: "Zoe",
      lastContact: STABLE(),
      favouriteRank: 1,
    });
    const nonFav = await seedContact({ name: "Amy", lastContact: STABLE() });
    // Both names contain 'a'/'e'? term 'e' matches Zoe + none? Use a shared token.
    await seedContact({ name: "Nomatch", lastContact: STABLE() });

    const rows = await listDashboard(exec, {
      filter: "favourites",
      sort: "name",
      term: "o", // matches Zoe (o) and Nomatch (o) — NOT the rank order
    });
    // Ordered by the SORT map (name), NOT favourite_rank ASC.
    expect(rows.map((r) => r.name)).toEqual(["Nomatch", "Zoe"]);
    // The matched favourite still carries its rank so its star renders.
    expect(rows.find((r) => r.id === fav)?.favourite_rank).toBe(1);
    expect(nonFav).toBeGreaterThan(0);
  });
});

describe("listDashboard — search", () => {
  it("name-only match → snippet null; fuel match → snippet; BOTH match → snippet still renders (MEDIUM-6)", async () => {
    const nameOnly = await seedContact({
      name: "Sushi",
      lastContact: STABLE(),
    });
    await addFuelRow(nameOnly, { text: "likes climbing" });

    const fuelMatch = await seedContact({
      name: "Blair",
      lastContact: STABLE(),
    });
    await addFuelRow(fuelMatch, { text: "loves sushi rolls" });

    const both = await seedContact({ name: "Sushiko", lastContact: STABLE() });
    await addFuelRow(both, { text: "makes sushi at home" });

    const rows = await listDashboard(exec, {
      filter: "all",
      sort: "name",
      term: "sushi",
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get(nameOnly)?.snippet).toBeNull();
    expect(byId.get(fuelMatch)?.snippet).toBe("loves sushi rolls");
    // MEDIUM-6: a BOTH-name-AND-fuel match STILL shows the snippet.
    expect(byId.get(both)?.snippet).toBe("makes sushi at home");
  });

  it("off_limits and source='ai' fuel never match and never surface as a snippet", async () => {
    const offC = await seedContact({ name: "Xavier", lastContact: STABLE() });
    await addFuelRow(offC, { kind: "off_limits", text: "secret divorce" });
    const aiC = await seedContact({ name: "Yolanda", lastContact: STABLE() });
    await addFuelRow(aiC, { text: "secret divorce", source: "ai" });

    const rows = await listDashboard(exec, {
      filter: "all",
      sort: "name",
      term: "divorce",
    });
    expect(rows).toEqual([]);
  });

  it("even with a name match, an off_limits row is never the snippet", async () => {
    const c = await seedContact({ name: "Divorcia", lastContact: STABLE() });
    await addFuelRow(c, { kind: "off_limits", text: "divorce filing" });
    const rows = await listDashboard(exec, {
      filter: "all",
      sort: "name",
      term: "divorc",
    });
    expect(rows.length).toBe(1);
    expect(rows[0]?.snippet).toBeNull();
  });

  it("%/_ are literal via escapeLike + ESCAPE", async () => {
    const hit = await seedContact({ name: "Percy", lastContact: STABLE() });
    await addFuelRow(hit, { text: "got a 50% raise" });
    const miss = await seedContact({ name: "Fifty", lastContact: STABLE() });
    await addFuelRow(miss, { text: "turned 50 last week" });
    const rows = await listDashboard(exec, {
      filter: "all",
      sort: "name",
      term: "50%",
    });
    expect(ids(rows)).toEqual([hit]);
  });

  it("an empty/whitespace term behaves as no term (full exclusion applies)", async () => {
    await seedContact({ name: "Never", lastContact: null });
    const live = await seedContact({ name: "Live", lastContact: STABLE() });
    const rows = await listDashboard(exec, {
      filter: "all",
      sort: "status",
      term: "   \n\t ",
    });
    expect(ids(rows)).toEqual([live]); // never-contacted still excluded
  });

  it("MEDIUM (d) / HIGH-1: term relaxes to archived-only — a never-contacted name match appears with null status/progress", async () => {
    const nc = await seedContact({ name: "Casey", lastContact: null });
    await seedContact({
      name: "Archie",
      lastContact: STABLE(),
      archivedAt: NOW,
    });
    const rows = await listDashboard(exec, {
      filter: "all",
      sort: "name",
      term: "casey",
    });
    expect(ids(rows)).toEqual([nc]);
    expect(rows[0]?.status).toBeNull();
    expect(rows[0]?.progress).toBeNull();
  });

  it("term never surfaces an archived contact even on a name+fuel match", async () => {
    const archived = await seedContact({
      name: "Archer",
      lastContact: STABLE(),
      archivedAt: NOW,
    });
    await addFuelRow(archived, { text: "mentions archery" });
    const rows = await listDashboard(exec, {
      filter: "all",
      sort: "name",
      term: "arch",
    });
    expect(rows).toEqual([]);
  });
});

describe("listDashboard — fuelText parity + A-1 null-progress ordering", () => {
  it("fuelText equals getRankedFuel[0].text across kinds/blank/off_limits/ai", async () => {
    const c = await seedContact({ name: "Ranked", lastContact: STABLE() });
    await addFuelRow(c, { kind: "fact", text: "a fact" });
    await addFuelRow(c, { kind: "recent", text: "a recent thing" });
    await addFuelRow(c, { kind: "off_limits", text: "private" });
    await addFuelRow(c, { kind: "recent", text: "ai guess", source: "ai" });
    await addFuelRow(c, { kind: "gift", text: "   " });

    const ranked = await getRankedFuel(exec, c);
    const rows = await listDashboard(exec, { filter: "all", sort: "status" });
    const row = rows.find((r) => r.id === c) as DashboardRow;
    expect(row.fuelText).toBe(ranked[0]?.text ?? null);
    expect(row.fuelText).toBe("a recent thing");
  });

  it("fuelText is null for a contact with no eligible fuel", async () => {
    const c = await seedContact({ lastContact: STABLE() });
    await addFuelRow(c, { kind: "off_limits", text: "private only" });
    const rows = await listDashboard(exec, { filter: "all", sort: "status" });
    expect(rows.find((r) => r.id === c)?.fuelText).toBeNull();
  });

  it("A-1: status sort is progress DESC — a relaxation-surfaced null-progress row orders LAST", async () => {
    const rogue = await seedContact({
      name: "Rogue",
      lastContact: ROGUE(),
      favouriteRank: 3,
    });
    const stable = await seedContact({
      name: "Stable",
      lastContact: STABLE(),
      favouriteRank: 2,
    });
    const nc = await seedContact({
      name: "Never",
      lastContact: null,
      favouriteRank: 1,
    });
    // Use a term to force the archived-only relaxation (all three surface).
    const rows = await listDashboard(exec, {
      filter: "all",
      sort: "status",
      term: "e", // matches Rogue, Never, Stable
    });
    expect(ids(rows)).toEqual([rogue, stable, nc]); // null progress last (NULLs-last DESC)
  });
});

describe("listDashboard — LOW-1 tiebreak binds c.name not cat.name", () => {
  it("sorts by the contact name even when a joined category shares that name", async () => {
    // Category id 3 is 'Work'. Seed a contact literally named 'Work' in a
    // DIFFERENT category, plus an earlier-sorting contact — a bare `name` in the
    // tiebreak could bind to cat.name and mis-sort.
    const work = await seedContact({
      name: "Work",
      lastContact: STABLE(),
      categoryId: 1,
    });
    const alpha = await seedContact({
      name: "Aaron",
      lastContact: STABLE(),
      categoryId: 3,
    });
    const rows = await listDashboard(exec, { filter: "all", sort: "name" });
    expect(ids(rows)).toEqual([alpha, work]); // Aaron < Work by CONTACT name
  });
});

describe("listDashboard — full card projection shape", () => {
  it("returns every card field with the category label and favourite rank", async () => {
    const c = await seedContact({
      name: "Full",
      lastContact: WOBBLE(),
      categoryId: 2, // 'Friends'
      favouriteRank: 4,
    });
    await addFuelRow(c, { kind: "recent", text: "top line" });
    const rows = await listDashboard(exec, { filter: "all", sort: "status" });
    const row = rows.find((r) => r.id === c) as DashboardRow;
    expect(row.name).toBe("Full");
    expect(row.categoryLabel).toBe("Friends");
    expect(row.favourite_rank).toBe(4);
    expect(row.status).toBe("wobble");
    expect(typeof row.progress).toBe("number");
    expect(row.fuelText).toBe("top line");
    expect(row.snippet).toBeNull();
  });

  it("categoryLabel is null when the contact has no category", async () => {
    const c = await seedContact({ lastContact: STABLE(), categoryId: null });
    const rows = await listDashboard(exec, { filter: "all", sort: "status" });
    expect(rows.find((r) => r.id === c)?.categoryLabel).toBeNull();
  });
});

describe("listNeverContacted", () => {
  it("returns only archived_at IS NULL AND last_contact IS NULL with literal null status/progress (HIGH-1)", async () => {
    const nc = await seedContact({ name: "Never", lastContact: null });
    await seedContact({ name: "Live", lastContact: STABLE() });
    await seedContact({
      name: "ArchivedNever",
      lastContact: null,
      archivedAt: NOW,
    });
    const rows = await listNeverContacted(exec, { sort: "oldest" });
    expect(ids(rows)).toEqual([nc]);
    expect(rows[0]?.status).toBeNull();
    expect(rows[0]?.progress).toBeNull();
  });

  it("three sorts: oldest (created ASC), newest (created DESC), name", async () => {
    const first = await seedContact({
      name: "Cara",
      lastContact: null,
      createdAt: "2026-01-01 09:00:00",
    });
    const second = await seedContact({
      name: "abe",
      lastContact: null,
      createdAt: "2026-06-01 09:00:00",
    });
    const third = await seedContact({
      name: "Bea",
      lastContact: null,
      createdAt: "2026-08-01 09:00:00",
    });
    expect(ids(await listNeverContacted(exec, { sort: "oldest" }))).toEqual([
      first,
      second,
      third,
    ]);
    expect(ids(await listNeverContacted(exec, { sort: "newest" }))).toEqual([
      third,
      second,
      first,
    ]);
    expect(ids(await listNeverContacted(exec, { sort: "name" }))).toEqual([
      second, // abe
      third, // Bea
      first, // Cara
    ]);
  });

  it("carries the ranked fuel line for a never-contacted contact", async () => {
    const c = await seedContact({ name: "Never", lastContact: null });
    await addFuelRow(c, { kind: "recent", text: "still has fuel" });
    const rows = await listNeverContacted(exec, { sort: "oldest" });
    expect(rows[0]?.fuelText).toBe("still has fuel");
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
