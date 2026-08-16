/**
 * Conversational-fuel editor read — behavioural proof (FUEL-01/FUEL-02).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture
 * and the REAL fuel-read module, asserting the choke-point read contract:
 *   - listFuelForEditor returns ALL of a contact's fuel — every kind INCLUDING
 *     off_limits, every source INCLUDING 'ai' — newest-first (created_at DESC,
 *     id DESC), because this is the ONE read you edit off_limits through;
 *   - a second contact's rows are excluded (contact_id bound);
 *   - a contact with no fuel returns [] (never throws).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import type { FuelKind } from "@/db/fuel-dao";
import { addFuel } from "@/db/fuel-dao";
import { getRankedFuel, listFuelForEditor, searchFuel } from "@/db/fuel-read";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import { compareFuel } from "@/services/fuel-ranking";

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

async function seedContact(name = "Alex"): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [uid(), name, 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

/** Seed an ARCHIVED contact (archived_at set) — for the exclusion sweep. */
async function seedArchivedContact(name = "Archie"): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, archived_at, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [uid(), name, 30, NOW, NOW, NOW],
  );
  return result.lastInsertRowId;
}

describe("listFuelForEditor — all kinds incl off_limits, newest-first, isolated", () => {
  it("returns all 5 kinds (off_limits present) newest-first by created_at then id", async () => {
    const c = await seedContact();
    // Two rows share a created_at → the id DESC tiebreak decides their order.
    await addFuel(exec, {
      uid: uid(),
      contactId: c,
      kind: "recent",
      text: "oldest",
      createdAt: "2026-08-10 09:00:00",
      source: "user",
      now: NOW,
    });
    await addFuel(exec, {
      uid: uid(),
      contactId: c,
      kind: "topic",
      text: "same-day A",
      createdAt: "2026-08-12 09:00:00",
      source: "user",
      now: NOW,
    });
    await addFuel(exec, {
      uid: uid(),
      contactId: c,
      kind: "fact",
      text: "same-day B",
      createdAt: "2026-08-12 09:00:00",
      source: "ai",
      now: NOW,
    });
    await addFuel(exec, {
      uid: uid(),
      contactId: c,
      kind: "gift",
      text: "newer",
      createdAt: "2026-08-14 09:00:00",
      source: "user",
      now: NOW,
    });
    await addFuel(exec, {
      uid: uid(),
      contactId: c,
      kind: "off_limits",
      text: "private",
      createdAt: "2026-08-15 09:00:00",
      source: "user",
      now: NOW,
    });

    const rows = await listFuelForEditor(exec, c);

    // off_limits is surfaced here (the ONLY read that includes it).
    expect(rows.map((r) => r.kind)).toContain("off_limits");
    expect(rows.length).toBe(5);
    // Newest-first by created_at, then id DESC for the same-day tie
    // (fact was inserted after topic → higher id → comes first).
    expect(rows.map((r) => r.text)).toEqual([
      "private",
      "newer",
      "same-day B",
      "same-day A",
      "oldest",
    ]);
    // 'ai'-sourced rows are included in the editor read.
    expect(rows.some((r) => r.source === "ai")).toBe(true);
  });

  it("excludes another contact's rows (contact_id bound)", async () => {
    const c1 = await seedContact("Alex");
    const c2 = await seedContact("Blair");
    await addFuel(exec, {
      uid: uid(),
      contactId: c1,
      kind: "topic",
      text: "mine",
      createdAt: NOW,
      source: "user",
      now: NOW,
    });
    await addFuel(exec, {
      uid: uid(),
      contactId: c2,
      kind: "topic",
      text: "theirs",
      createdAt: NOW,
      source: "user",
      now: NOW,
    });

    const rows = await listFuelForEditor(exec, c1);
    expect(rows.length).toBe(1);
    expect(rows[0]?.text).toBe("mine");
  });

  it("returns [] for a contact with no fuel (never throws)", async () => {
    const c = await seedContact();
    const rows = await listFuelForEditor(exec, c);
    expect(rows).toEqual([]);
  });
});

/** Insert one fuel row against `c` and return its rowid + the fields we ranked on. */
async function addRow(
  c: number,
  row: {
    kind: FuelKind;
    created_at: string;
    source?: string;
    text?: string | null;
  },
): Promise<{
  id: number;
  kind: FuelKind;
  created_at: string;
  source: string;
  text: string | null;
}> {
  const source = row.source ?? "user";
  const text = row.text === undefined ? "some text" : row.text;
  const id = await addFuel(exec, {
    uid: uid(),
    contactId: c,
    kind: row.kind,
    text,
    createdAt: row.created_at,
    source,
    now: NOW,
  });
  return { id, kind: row.kind, created_at: row.created_at, source, text };
}

/** Every non-empty subset of the 5 kinds — for the off_limits absence sweep. */
function nonEmptySubsets<T>(items: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let mask = 1; mask < 1 << items.length; mask++) {
    const subset: T[] = [];
    for (let i = 0; i < items.length; i++) {
      if (mask & (1 << i)) subset.push(items[i]);
    }
    out.push(subset);
  }
  return out;
}

describe("getRankedFuel — off_limits / source='ai' / blank excluded in-query, ranked", () => {
  const ALL_KINDS: readonly FuelKind[] = [
    "recent",
    "gift",
    "topic",
    "fact",
    "off_limits",
  ];

  it("NEVER returns an off_limits row, for EVERY kind-population combination", async () => {
    // A separate contact per subset — a clean absence sweep across all 31
    // non-empty combinations of which kinds are populated.
    for (const subset of nonEmptySubsets(ALL_KINDS)) {
      const c = await seedContact();
      for (const kind of subset) {
        await addRow(c, { kind, created_at: "2026-08-12 09:00:00" });
      }
      const rows = await getRankedFuel(exec, c);
      expect(rows.some((r) => r.kind === "off_limits")).toBe(false);
      // Every non-off_limits kind in the subset survives (all non-blank, user).
      const expected = subset.filter((k) => k !== "off_limits").length;
      expect(rows.length).toBe(expected);
    }
  });

  it("excludes an unconfirmed source='ai' row; a confirmed source='manual' row ranks", async () => {
    const c = await seedContact();
    await addRow(c, {
      kind: "recent",
      created_at: "2026-08-14 09:00:00",
      source: "ai",
      text: "AI GUESS",
    });
    const manual = await addRow(c, {
      kind: "topic",
      created_at: "2026-08-10 09:00:00",
      source: "manual",
      text: "confirmed",
    });
    const rows = await getRankedFuel(exec, c);
    expect(rows.some((r) => r.source === "ai")).toBe(false);
    expect(rows.map((r) => r.id)).toEqual([manual.id]);
    expect(rows[0]?.text).toBe("confirmed");
  });

  it("also excludes source='share' never — 'user'/'manual'/'share' all rank", async () => {
    const c = await seedContact();
    const u = await addRow(c, {
      kind: "recent",
      created_at: "2026-08-14 09:00:00",
      source: "user",
    });
    const s = await addRow(c, {
      kind: "gift",
      created_at: "2026-08-13 09:00:00",
      source: "share",
    });
    const m = await addRow(c, {
      kind: "topic",
      created_at: "2026-08-12 09:00:00",
      source: "manual",
    });
    const rows = await getRankedFuel(exec, c);
    // recent > gift > topic by kind priority.
    expect(rows.map((r) => r.id)).toEqual([u.id, s.id, m.id]);
  });

  it("ranks a week-old `recent` ABOVE a day-old `fact` (kind beats recency)", async () => {
    const c = await seedContact();
    const fact = await addRow(c, {
      kind: "fact",
      created_at: "2026-08-14 09:00:00",
    });
    const recent = await addRow(c, {
      kind: "recent",
      created_at: "2026-08-08 09:00:00",
    });
    const rows = await getRankedFuel(exec, c);
    expect(rows.map((r) => r.id)).toEqual([recent.id, fact.id]);
  });

  it("a NULL / blank / whitespace-only top-priority row is NOT rows[0] (MEDIUM-3)", async () => {
    const c = await seedContact();
    // Newest + highest priority BUT blank/NULL/whitespace text → must be skipped.
    await addRow(c, {
      kind: "recent",
      created_at: "2026-08-15 09:00:00",
      text: null,
    });
    await addRow(c, {
      kind: "recent",
      created_at: "2026-08-15 08:00:00",
      text: "   \n\t  ",
    });
    const usable = await addRow(c, {
      kind: "gift",
      created_at: "2026-08-10 09:00:00",
      text: "real gift idea",
    });
    const rows = await getRankedFuel(exec, c);
    expect(rows.map((r) => r.id)).toEqual([usable.id]);
    expect(rows[0]?.text).toBe("real gift idea");
    // But the editor read still surfaces ALL rows, blanks included (unchanged).
    const editor = await listFuelForEditor(exec, c);
    expect(editor.length).toBe(3);
  });

  it("excludes a vertical-tab / form-feed / NBSP-only text row (SQL trim charset, MEDIUM-2)", async () => {
    const c = await seedContact();
    // Newest + highest priority BUT text is only VT (11) / FF (12) / NBSP (160)
    // — chars ASCII TRIM would keep but JS String.trim() strips. Stored verbatim
    // via the DAO (a non-UI write path that never hit blankToNull). The extended
    // SQL trim set must drop it so it can't top the ranking and then render blank.
    await addRow(c, {
      kind: "recent",
      created_at: "2026-08-15 09:00:00",
      text: "\v\f ",
    });
    const usable = await addRow(c, {
      kind: "gift",
      created_at: "2026-08-10 09:00:00",
      text: "real gift idea",
    });
    const rows = await getRankedFuel(exec, c);
    expect(rows.map((r) => r.id)).toEqual([usable.id]);
    expect(rows[0]?.text).toBe("real gift idea");
    // The editor read still surfaces the whitespace-only row (unchanged).
    const editor = await listFuelForEditor(exec, c);
    expect(editor.length).toBe(2);
  });

  it("SQL order == compareFuel order over an ELIGIBLE-only fixture (parity, MEDIUM-5)", async () => {
    const c = await seedContact();
    // A mixed fixture spanning kinds, sources, dates, ties, and excluded rows.
    const inserted = [
      await addRow(c, { kind: "fact", created_at: "2026-08-14 09:00:00" }),
      await addRow(c, { kind: "recent", created_at: "2026-08-08 09:00:00" }),
      await addRow(c, { kind: "recent", created_at: "2026-08-12 09:00:00" }),
      await addRow(c, { kind: "gift", created_at: "2026-08-12 09:00:00" }),
      await addRow(c, { kind: "topic", created_at: "2026-08-12 09:00:00" }),
      // Same kind + same created_at → id DESC tiebreak.
      await addRow(c, { kind: "topic", created_at: "2026-08-12 09:00:00" }),
      // Excluded rows — must be dropped from BOTH sides before comparing.
      await addRow(c, {
        kind: "off_limits",
        created_at: "2026-08-15 09:00:00",
      }),
      await addRow(c, {
        kind: "recent",
        created_at: "2026-08-15 10:00:00",
        source: "ai",
      }),
      await addRow(c, {
        kind: "recent",
        created_at: "2026-08-15 11:00:00",
        text: "  ",
      }),
    ];

    // Derive the eligible set with the SAME predicate getRankedFuel applies.
    const eligible = inserted.filter(
      (r) =>
        r.kind !== "off_limits" &&
        r.source !== "ai" &&
        r.text !== null &&
        r.text.trim() !== "",
    );
    const expectedIds = [...eligible].sort(compareFuel).map((r) => r.id);

    const rows = await getRankedFuel(exec, c);
    // Compare the SAME row set on both sides (never the full mixed fixture).
    expect(rows.map((r) => r.id)).toEqual(expectedIds);
  });
});

/** Insert one fuel row with an explicit text/kind/source against `c`. */
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

describe("searchFuel — name OR fuel text, off_limits/ai/archived excluded, escaped", () => {
  it("returns [] for an empty or whitespace-only term (guarded before querying)", async () => {
    const c = await seedContact("Alex");
    await addFuelRow(c, { text: "likes climbing" });
    expect(await searchFuel(exec, "")).toEqual([]);
    expect(await searchFuel(exec, "   \n\t ")).toEqual([]);
  });

  it("a NAME-only match returns the contact with snippet null", async () => {
    const c = await seedContact("Alex");
    // A fuel row that does NOT contain the term — so the match is name-only.
    await addFuelRow(c, { text: "likes climbing" });
    const rows = await searchFuel(exec, "ale");
    expect(rows).toEqual([{ contactId: c, name: "Alex", snippet: null }]);
  });

  it("a FUEL-TEXT match returns the contact with the matching snippet", async () => {
    const c = await seedContact("Blair");
    await addFuelRow(c, { text: "just got back from Kyoto" });
    const rows = await searchFuel(exec, "kyoto");
    expect(rows).toEqual([
      { contactId: c, name: "Blair", snippet: "just got back from Kyoto" },
    ]);
  });

  it("an off_limits row containing the term NEVER matches and never surfaces as a snippet", async () => {
    const c = await seedContact("Blair");
    await addFuelRow(c, { kind: "off_limits", text: "secret divorce news" });
    const rows = await searchFuel(exec, "divorce");
    expect(rows).toEqual([]);
    // And even when the contact matches by name, off_limits is never the snippet.
    const c2 = await seedContact("Divorcia");
    await addFuelRow(c2, { kind: "off_limits", text: "divorce filing" });
    const byName = await searchFuel(exec, "divorc");
    expect(byName).toEqual([
      { contactId: c2, name: "Divorcia", snippet: null },
    ]);
  });

  it("an unconfirmed source='ai' row NEVER matches; manual/user/share with the same text DO", async () => {
    const aiC = await seedContact("Aiden");
    await addFuelRow(aiC, { text: "loves jazz", source: "ai" });
    // The name 'Aiden' must not be what surfaces it — search a fuel-only term.
    expect(await searchFuel(exec, "jazz")).toEqual([]);

    const manualC = await seedContact("Manny");
    await addFuelRow(manualC, { text: "loves jazz", source: "manual" });
    const userC = await seedContact("Uma");
    await addFuelRow(userC, { text: "loves jazz", source: "user" });
    const shareC = await seedContact("Shanna");
    await addFuelRow(shareC, { text: "loves jazz", source: "share" });

    const rows = await searchFuel(exec, "jazz");
    // Ordered by name: Manny, Shanna, Uma — Aiden's 'ai' row excluded.
    expect(rows).toEqual([
      { contactId: manualC, name: "Manny", snippet: "loves jazz" },
      { contactId: shareC, name: "Shanna", snippet: "loves jazz" },
      { contactId: userC, name: "Uma", snippet: "loves jazz" },
    ]);
  });

  it("an archived contact whose name OR fuel matches is NEVER returned", async () => {
    const archived = await seedArchivedContact("Archie");
    await addFuelRow(archived, { text: "mentions archery" });
    // Matches by name ('Archie') and by fuel text ('archery') — still excluded.
    expect(await searchFuel(exec, "arch")).toEqual([]);
  });

  it("literal-% ESCAPE: '50%' matches only a row literally containing % (not a wildcard)", async () => {
    const hit = await seedContact("Percy");
    await addFuelRow(hit, { text: "got a 50% raise" });
    const miss = await seedContact("Fifty");
    await addFuelRow(miss, { text: "turned 50 last week" });
    const rows = await searchFuel(exec, "50%");
    expect(rows).toEqual([
      { contactId: hit, name: "Percy", snippet: "got a 50% raise" },
    ]);
  });

  it("literal-_ ESCAPE: 'a_b' matches only a row literally containing _ (not a single-char wildcard)", async () => {
    const hit = await seedContact("Uncle");
    await addFuelRow(hit, { text: "handle is a_b online" });
    const miss = await seedContact("Axb");
    await addFuelRow(miss, { text: "handle is axb online" });
    const rows = await searchFuel(exec, "a_b");
    expect(rows).toEqual([
      { contactId: hit, name: "Uncle", snippet: "handle is a_b online" },
    ]);
  });

  it("literal-backslash ESCAPE: 'path\\to' matches a row containing a backslash (\\ treated as data)", async () => {
    const hit = await seedContact("Bakke");
    await addFuelRow(hit, { text: "config lives at path\\to\\file" });
    const rows = await searchFuel(exec, "path\\to");
    expect(rows).toEqual([
      {
        contactId: hit,
        name: "Bakke",
        snippet: "config lives at path\\to\\file",
      },
    ]);
  });

  it("dedups: a contact with TWO matching fuel rows appears exactly once", async () => {
    const c = await seedContact("Dana");
    await addFuelRow(c, { text: "loves sushi" });
    await addFuelRow(c, { text: "sushi every friday" });
    const rows = await searchFuel(exec, "sushi");
    expect(rows.length).toBe(1);
    expect(rows[0]?.contactId).toBe(c);
    expect(rows[0]?.snippet).toContain("sushi");
  });
});
