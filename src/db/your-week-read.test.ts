import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import {
  readYourWeekDateCounts,
  readYourWeekDay,
  readYourWeekMetrics,
  YOUR_WEEK_DATE_COUNTS_SQL,
  YOUR_WEEK_DAY_SQL,
  YOUR_WEEK_METRICS_SQL,
} from "@/db/your-week-read";

const NOW = "2026-09-19 12:00:00";
let exec: SqlExecutor;

async function contact(
  uid: string,
  name: string,
  archived = false,
  photo: string | null = null,
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts(uid,name,interval_days,archived_at,photo,created_at,modified_at)
     VALUES(?,?,?,?,?,?,?)`,
    [uid, name, 7, archived ? NOW : null, photo, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function interaction(
  uid: string,
  contactId: number,
  occurredAt: string,
  groupEventId: number | null = null,
): Promise<void> {
  await exec.runAsync(
    `INSERT INTO interactions
       (uid,contact_id,occurred_at,recorded_at,channel,connected,source,modified_at,group_event_id)
     VALUES(?,?,?,?,?,1,'manual',?,?)`,
    [
      uid,
      contactId,
      occurredAt,
      occurredAt,
      "In Person",
      occurredAt,
      groupEventId,
    ],
  );
}

async function interactionId(
  uid: string,
  contactId: number,
  occurredAt: string,
  groupEventId: number | null = null,
): Promise<number> {
  await interaction(uid, contactId, occurredAt, groupEventId);
  const row = await exec.getFirstAsync<{ id: number }>(
    "SELECT id FROM interactions WHERE uid = ?",
    [uid],
  );
  return row?.id ?? -1;
}

async function groupEvent(
  uid: string,
  title: string,
  occurredAt: string,
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO group_events(uid,title,occurred_at,created_at,modified_at)
     VALUES(?,?,?,?,?)`,
    [uid, title, occurredAt, occurredAt, occurredAt],
  );
  return result.lastInsertRowId;
}

beforeEach(async () => {
  let uid = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: () => `seed-${++uid}`,
  });
});

describe("Your Week app-wide reads", () => {
  it("separates child-inclusive headline metrics from deduplicated activity units", async () => {
    const ada = await contact("ada", "Ada");
    const bea = await contact("bea", "Bea");
    const archived = await contact("cal", "Cal", true);
    const dinner = await groupEvent("dinner", "Dinner", "2026-09-16 19:00:00");
    await interaction("dinner-ada", ada, "2026-09-16 19:00:00", dinner);
    await interaction("dinner-bea", bea, "2026-09-16 19:00:00", dinner);
    await interaction("coffee", ada, "2026-09-16 08:00:00");
    await interaction("archived", archived, "2026-09-17 08:00:00");
    await interaction("outside", bea, "2026-09-08 08:00:00");

    expect(await readYourWeekMetrics(exec, "2026-09-14", "2026-09-20")).toEqual(
      {
        peopleReached: 2,
        interactions: 3,
        events: 1,
      },
    );
    expect(
      await readYourWeekDateCounts(exec, "2026-09-14", "2026-09-20"),
    ).toEqual([{ d: "2026-09-16", n: 2 }]);
    expect(await readYourWeekDay(exec, "2026-09-16")).toEqual([
      expect.objectContaining({ kind: "group_event", title: "Dinner" }),
      expect.objectContaining({ kind: "interaction", contactName: "Ada" }),
    ]);
  });

  it("retains a group event whose participants are all archived as one activity", async () => {
    const archivedA = await contact("arch-a", "Archived A", true);
    const archivedB = await contact("arch-b", "Archived B", true);
    const event = await groupEvent("reunion", "Reunion", "2026-09-18 20:00:00");
    await interaction("reunion-a", archivedA, "2026-09-18 20:00:00", event);
    await interaction("reunion-b", archivedB, "2026-09-18 20:00:00", event);

    expect(await readYourWeekMetrics(exec, "2026-09-14", "2026-09-20")).toEqual(
      {
        peopleReached: 0,
        interactions: 0,
        events: 1,
      },
    );
    expect(
      await readYourWeekDateCounts(exec, "2026-09-14", "2026-09-20"),
    ).toEqual([{ d: "2026-09-18", n: 1 }]);
    expect(await readYourWeekDay(exec, "2026-09-18")).toEqual([
      expect.objectContaining({ kind: "group_event", title: "Reunion" }),
    ]);
  });

  it("day rows carry the contact's stored photo path; null without a photo and for group events (38.6 D-02/D-14)", async () => {
    const ada = await contact("ph-ada", "Ada");
    const withPhoto = await contact("ph-grace", "Grace");
    await exec.runAsync("UPDATE contacts SET photo = ? WHERE id = ?", [
      `avatars/contact-${withPhoto}.jpg`,
      withPhoto,
    ]);
    const lunch = await groupEvent("ph-lunch", "Lunch", "2026-09-16 13:00:00");
    await interaction("ph-lunch-ada", ada, "2026-09-16 13:00:00", lunch);
    await interaction("ph-coffee-grace", withPhoto, "2026-09-16 09:00:00");
    await interaction("ph-walk-ada", ada, "2026-09-16 08:00:00");

    const rows = await readYourWeekDay(exec, "2026-09-16");
    expect(
      rows.map((row) => [row.kind, row.contactName, row.contactPhoto]),
    ).toEqual([
      ["group_event", null, null],
      ["interaction", "Grace", `avatars/contact-${withPhoto}.jpg`],
      ["interaction", "Ada", null],
    ]);
  });
});

/** EXPLAIN QUERY PLAN detail rows for `sql` on the real migrated schema. */
async function planDetails(sql: string, params: unknown[]): Promise<string[]> {
  const rows = await exec.getAllAsync<{ detail: string }>(
    `EXPLAIN QUERY PLAN ${sql}`,
    params,
  );
  return rows.map((row) => row.detail);
}

/** True when some plan row is an unindexed full scan of alias `alias`. */
function fullScanOf(details: readonly string[], alias: string): boolean {
  const table = alias === "ge" ? "group_events" : "interactions";
  return details.some((detail) =>
    new RegExp(`^SCAN (${alias}|${table})( |$)`).test(detail),
  );
}

describe("Your Week query plans (RG-028, performance/AUD-PERF-004)", () => {
  it("metrics SEARCH the migration-031 occurred_at indexes instead of scanning history", async () => {
    const details = await planDetails(YOUR_WEEK_METRICS_SQL, [
      ...Array.from({ length: 3 }, () => [
        "2026-09-14",
        "2026-09-20",
        "2026-09-14",
        "2026-09-20",
      ]).flat(),
    ]);
    const joined = details.join("\n");
    expect(joined).toContain("idx_interactions_occurred_at");
    expect(joined).toContain("idx_group_events_occurred_at");
    expect(fullScanOf(details, "i"), joined).toBe(false);
    expect(fullScanOf(details, "ge"), joined).toBe(false);
  });

  it("both date-count UNION ALL arms SEARCH their new index", async () => {
    const details = await planDetails(YOUR_WEEK_DATE_COUNTS_SQL, [
      ...Array.from({ length: 2 }, () => [
        "2026-09-14",
        "2026-09-20",
        "2026-09-14",
        "2026-09-20",
      ]).flat(),
    ]);
    const joined = details.join("\n");
    expect(joined).toMatch(/SEARCH i USING INDEX idx_interactions_occurred_at/);
    expect(joined).toMatch(
      /SEARCH ge USING (COVERING )?INDEX idx_group_events_occurred_at/,
    );
    expect(fullScanOf(details, "i"), joined).toBe(false);
    expect(fullScanOf(details, "ge"), joined).toBe(false);
  });

  it("both day-list UNION ALL arms SEARCH their new index", async () => {
    const details = await planDetails(
      YOUR_WEEK_DAY_SQL,
      Array.from({ length: 6 }, () => "2026-09-16"),
    );
    const joined = details.join("\n");
    expect(joined).toMatch(/SEARCH i USING INDEX idx_interactions_occurred_at/);
    expect(joined).toMatch(
      /SEARCH ge USING (COVERING )?INDEX idx_group_events_occurred_at/,
    );
    expect(fullScanOf(details, "i"), joined).toBe(false);
    expect(fullScanOf(details, "ge"), joined).toBe(false);
  });
});

// --- Pre-RG-028 oracle -------------------------------------------------------
// The legacy Your Week predicates exactly as shipped before 38.4 Plan 01 (bare
// `date(column)` only, no range conjunct). Kept ONLY here, as the reference the
// bounded reads must match row-for-row. Never import these into app code.

const LEGACY_METRICS_SQL = `SELECT
       (SELECT COUNT(DISTINCT i.contact_id)
          FROM interactions i
          JOIN contacts c ON c.id = i.contact_id
         WHERE c.archived_at IS NULL
           AND date(i.occurred_at) BETWEEN date(?) AND date(?)) AS peopleReached,
       (SELECT COUNT(*)
          FROM interactions i
          JOIN contacts c ON c.id = i.contact_id
         WHERE c.archived_at IS NULL
           AND date(i.occurred_at) BETWEEN date(?) AND date(?)) AS interactions,
       (SELECT COUNT(*)
          FROM group_events ge
         WHERE date(ge.occurred_at) BETWEEN date(?) AND date(?)) AS events`;

const LEGACY_DATE_COUNTS_SQL = `SELECT activity_date AS d, COUNT(*) AS n
       FROM (
         SELECT date(i.occurred_at) AS activity_date
           FROM interactions i
           JOIN contacts c ON c.id = i.contact_id
          WHERE i.group_event_id IS NULL
            AND c.archived_at IS NULL
            AND date(i.occurred_at) BETWEEN date(?) AND date(?)
         UNION ALL
         SELECT date(ge.occurred_at) AS activity_date
           FROM group_events ge
          WHERE date(ge.occurred_at) BETWEEN date(?) AND date(?)
       ) activity
      GROUP BY activity_date
      ORDER BY activity_date`;

const LEGACY_DAY_SQL = `SELECT 'group_event' AS kind,
            ge.id AS id,
            ge.occurred_at AS occurredAt,
            ge.title AS title,
            NULL AS contactId,
            NULL AS contactName,
            NULL AS contactPhoto
       FROM group_events ge
      WHERE date(ge.occurred_at) = date(?)
      UNION ALL
     SELECT 'interaction' AS kind,
            i.id AS id,
            i.occurred_at AS occurredAt,
            NULL AS title,
            c.id AS contactId,
            c.name AS contactName,
            c.photo AS contactPhoto
       FROM interactions i
       JOIN contacts c ON c.id = i.contact_id
      WHERE i.group_event_id IS NULL
        AND c.archived_at IS NULL
        AND date(i.occurred_at) = date(?)
      ORDER BY occurredAt DESC, kind, id DESC`;

async function legacyMetrics(start: string, end: string) {
  return exec.getFirstAsync(LEGACY_METRICS_SQL, [
    start,
    end,
    start,
    end,
    start,
    end,
  ]);
}

function legacyDateCounts(start: string, end: string) {
  return exec.getAllAsync(LEGACY_DATE_COUNTS_SQL, [start, end, start, end]);
}

function legacyDay(date: string) {
  return exec.getAllAsync(LEGACY_DAY_SQL, [date, date]);
}

/** Every calendar date from `first` to `last` inclusive (UTC math on dates only). */
function datesBetween(first: string, last: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${first}T00:00:00Z`);
  const stop = new Date(`${last}T00:00:00Z`);
  while (cursor <= stop) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

const WINDOWS: ReadonlyArray<readonly [string, string]> = [
  ["2026-09-14", "2026-09-20"],
  ["2026-09-13", "2026-09-19"],
  ["2026-09-15", "2026-09-21"],
  ["2026-09-01", "2026-09-30"],
  ["2026-09-21", "2026-09-27"],
  ["2026-09-17", "2026-09-17"],
];

/** Snapshot every Your Week result over the parity windows and days. */
async function snapshotAll() {
  const out: unknown[] = [];
  for (const [start, end] of WINDOWS) {
    out.push(await readYourWeekMetrics(exec, start, end));
    out.push(await readYourWeekDateCounts(exec, start, end));
  }
  for (const date of datesBetween("2026-09-10", "2026-09-24")) {
    out.push(await readYourWeekDay(exec, date));
  }
  return out;
}

/**
 * The stored forms the parity proof covers: live-writer `YYYY-MM-DD HH:MM:SS`
 * at day edges, plus date-only, `T`-separated, fractional-second and malformed
 * values (the latter only reachable via restore). The timezone-suffixed form is
 * the documented accepted exception (T-38.4-01-04) and is deliberately absent.
 */
async function seedParityFixture() {
  const ada = await contact("p-ada", "Ada", false, "avatars/contact-p-ada.jpg");
  const bea = await contact("p-bea", "Bea");
  const cal = await contact("p-cal", "Cal");
  const arc = await contact("p-arc", "Archived", true);

  await interaction("first-day-start", ada, "2026-09-14 00:00:00");
  await interaction("last-day-end", bea, "2026-09-20 23:59:59");
  await interaction("day-after", cal, "2026-09-21 00:00:00");
  await interaction("day-before", cal, "2026-09-13 23:59:59");
  await interaction("date-only", bea, "2026-09-17");
  await interaction("t-separated", cal, "2026-09-18T10:30:00");
  await interaction("fractional", ada, "2026-09-19 08:15:30.250");
  await interaction("malformed", ada, "2026-09-16garbage");
  await interaction("archived-in", arc, "2026-09-16 12:00:00");
  await interaction("archived-out", arc, "2026-09-22 12:00:00");

  const inRange = await groupEvent("ge-in", "Dinner", "2026-09-16 19:00:00");
  await interaction("ge-in-ada", ada, "2026-09-16 19:00:00", inRange);
  await interaction("ge-in-bea", bea, "2026-09-16 19:00:00", inRange);
  await interaction("ge-in-arc", arc, "2026-09-16 19:00:00", inRange);

  const outRange = await groupEvent("ge-out", "Trip", "2026-09-12 09:00:00");
  // A child whose own occurred_at drifted into range while its parent is out.
  await interaction("ge-out-cal", cal, "2026-09-15 09:00:00", outRange);
  await interaction("ge-out-bea", bea, "2026-09-12 09:00:00", outRange);

  await groupEvent("ge-edge-start", "Breakfast", "2026-09-14 00:00:00");
  await groupEvent("ge-edge-end", "Late", "2026-09-20 23:59:59");
  await groupEvent("ge-next", "Brunch", "2026-09-21 00:00:00");
  await groupEvent("ge-date-only", "Picnic", "2026-09-18");
  await groupEvent("ge-malformed", "Broken", "2026-09-17garbage");
}

/** Hundreds of rows dated years before any parity window. */
async function seedAncientHistory(count: number) {
  const old = await contact("ancient", "Ancient");
  for (let n = 0; n < count; n++) {
    const year = 2019 + (n % 5);
    const month = String((n % 12) + 1).padStart(2, "0");
    const day = String((n % 28) + 1).padStart(2, "0");
    const at = `${year}-${month}-${day} 1${n % 10}:00:00`;
    if (n % 5 === 0) {
      await groupEvent(`ancient-ge-${n}`, `Old ${n}`, at);
    } else {
      await interaction(`ancient-${n}`, old, at);
    }
  }
}

describe("Your Week bounded reads match the pre-RG-028 oracle", () => {
  it("returns identical metrics, date counts and day rows for every live stored form", async () => {
    await seedParityFixture();

    for (const [start, end] of WINDOWS) {
      expect(await readYourWeekMetrics(exec, start, end), start).toEqual(
        await legacyMetrics(start, end),
      );
      expect(await readYourWeekDateCounts(exec, start, end), start).toEqual(
        await legacyDateCounts(start, end),
      );
    }
    for (const date of datesBetween("2026-09-10", "2026-09-24")) {
      expect(await readYourWeekDay(exec, date), date).toEqual(
        await legacyDay(date),
      );
    }
  });

  it("includes both edges of the window, excludes the next day, and counts date-only values", async () => {
    await seedParityFixture();

    // Standalone live rows in 09-14..09-20: first-day-start, last-day-end,
    // date-only, t-separated, fractional (malformed + archived excluded);
    // plus 3 active group children (ge-in-ada, ge-in-bea, ge-out-cal).
    expect(await readYourWeekMetrics(exec, "2026-09-14", "2026-09-20")).toEqual(
      { peopleReached: 3, interactions: 8, events: 4 },
    );
    expect(
      await readYourWeekDateCounts(exec, "2026-09-14", "2026-09-20"),
    ).toEqual([
      { d: "2026-09-14", n: 2 },
      { d: "2026-09-16", n: 1 },
      { d: "2026-09-17", n: 1 },
      { d: "2026-09-18", n: 2 },
      { d: "2026-09-19", n: 1 },
      { d: "2026-09-20", n: 2 },
    ]);
    expect(
      (await readYourWeekDay(exec, "2026-09-21")).map((row) => row.occurredAt),
    ).toEqual(["2026-09-21 00:00:00", "2026-09-21 00:00:00"]);
    expect(
      (await readYourWeekDay(exec, "2026-09-17")).map((row) => row.occurredAt),
    ).toEqual(["2026-09-17"]);
  });

  it("returns nothing for an empty period even with 500 rows years earlier", async () => {
    await seedAncientHistory(500);

    expect(await readYourWeekMetrics(exec, "2026-09-14", "2026-09-20")).toEqual(
      { peopleReached: 0, interactions: 0, events: 0 },
    );
    expect(
      await readYourWeekDateCounts(exec, "2026-09-14", "2026-09-20"),
    ).toEqual([]);
    expect(await readYourWeekDay(exec, "2026-09-16")).toEqual([]);
  });

  it("leaves every result unchanged when hundreds of older rows are added", async () => {
    await seedParityFixture();
    const before = await snapshotAll();

    await seedAncientHistory(500);

    expect(await snapshotAll()).toEqual(before);
  });

  it("keeps day-detail order occurredAt DESC, kind, id DESC", async () => {
    const ada = await contact("o-ada", "Ada");
    const bea = await contact("o-bea", "Bea");
    const early = await interactionId("o-early", ada, "2026-09-16 08:00:00");
    const tieA = await interactionId("o-tie-a", ada, "2026-09-16 19:00:00");
    const tieB = await interactionId("o-tie-b", bea, "2026-09-16 19:00:00");
    const eventA = await groupEvent("o-ge-a", "A", "2026-09-16 19:00:00");
    const eventB = await groupEvent("o-ge-b", "B", "2026-09-16 19:00:00");
    const late = await groupEvent("o-ge-late", "Late", "2026-09-16 22:00:00");

    expect(
      (await readYourWeekDay(exec, "2026-09-16")).map((row) => [
        row.kind,
        row.id,
      ]),
    ).toEqual([
      ["group_event", late],
      ["group_event", eventB],
      ["group_event", eventA],
      ["interaction", tieB],
      ["interaction", tieA],
      ["interaction", early],
    ]);
  });
});
