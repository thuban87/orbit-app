import { describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS } from "@/db/database";
import {
  allocateLegacyUids,
  firstNonBlank,
  LEGACY_FUEL_KIND_HOMES,
  LEGACY_FUEL_TOMBSTONE_TYPES,
  LEGACY_UNKNOWN_KIND_MEMORY_TYPE,
  type LegacyFuelRowInput,
  type LegacyUidAllocation,
  legacyEntryDate,
  legacyLastTalkedAboutValue,
  mapLegacyFuelRow,
  remintLegacyUid,
} from "@/db/legacy-fuel-mapping";
import {
  applyMigration033,
  MIGRATION033_KIND_HOMES,
  MIGRATION033_TOMBSTONE_TYPES,
  MIGRATION033_UNKNOWN_KIND_MEMORY_TYPE,
} from "@/db/migrations/033-knowledge-homes";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-10-13 12:00:00";
const OPTS = { now: NOW, contentlessRule: "skip" } as const;
const EMPTY_DESTINATIONS = {
  off_limits: [],
  memories: [],
  current_state_entries: [],
};

function row(overrides: Partial<LegacyFuelRowInput>): LegacyFuelRowInput {
  return {
    uid: "u-1",
    kind: "fact",
    label: null,
    text: "Some text",
    url: null,
    source: "user",
    createdAt: "2026-08-01 09:00:00",
    modifiedAt: "2026-08-02 10:00:00",
    ...overrides,
  };
}

function plain(allocation: LegacyUidAllocation) {
  return {
    off_limits: Object.fromEntries(allocation.off_limits),
    memories: Object.fromEntries(allocation.memories),
    current_state_entries: Object.fromEntries(allocation.current_state_entries),
  };
}

describe("mapLegacyFuelRow — kinds and sources (D-56, D-108)", () => {
  it("maps off_limits as-is, marking a share", () => {
    expect(
      mapLegacyFuelRow(
        row({ kind: "off_limits", label: "L", text: "T", url: "U" }),
        OPTS,
      ),
    ).toEqual({
      home: "off_limits",
      uid: "u-1",
      label: "L",
      text: "T",
      url: "U",
      groupNoteCopy: 0,
      fromShare: 0,
      createdAt: "2026-08-01 09:00:00",
      modifiedAt: "2026-08-02 10:00:00",
    });
    expect(
      mapLegacyFuelRow(row({ kind: "off_limits", source: "share" }), OPTS),
    ).toMatchObject({ home: "off_limits", fromShare: 1 });
  });

  it("maps gift, topic, fact and an unknown kind to memories with Allow AI off", () => {
    const expectations: [string, string][] = [
      ["gift", "gift_idea"],
      ["topic", "thought_of_them"],
      ["fact", "general"],
      ["hobby", "general"],
      ["toString", "general"],
      ["constructor", "general"],
    ];
    for (const [kind, type] of expectations) {
      expect(mapLegacyFuelRow(row({ kind }), OPTS)).toEqual({
        home: "memory",
        uid: "u-1",
        type,
        value: "Some text",
        customLabel: null,
        url: null,
        provenance: "user",
        allowAi: 0,
        pinned: 0,
        hidden: null,
        groupNoteCopy: 0,
        createdAt: "2026-08-01 09:00:00",
        modifiedAt: "2026-08-02 10:00:00",
      });
    }
  });

  it("sets provenance share only for a share; ai and user land as user", () => {
    expect(
      mapLegacyFuelRow(row({ kind: "topic", source: "share" }), OPTS),
    ).toMatchObject({ provenance: "share" });
    expect(
      mapLegacyFuelRow(row({ kind: "topic", source: "ai" }), OPTS),
    ).toMatchObject({ provenance: "user", type: "thought_of_them" });
    expect(
      mapLegacyFuelRow(row({ kind: "topic", source: "user" }), OPTS),
    ).toMatchObject({ provenance: "user" });
  });

  it("memory value is the first non-blank of text, url; the label becomes the custom label", () => {
    expect(
      mapLegacyFuelRow(
        row({ kind: "gift", text: "  ", url: "https://x.test", label: "L" }),
        OPTS,
      ),
    ).toMatchObject({
      value: "https://x.test",
      url: "https://x.test",
      customLabel: "L",
    });
    expect(
      mapLegacyFuelRow(
        row({ kind: "gift", text: null, label: "Label only" }),
        OPTS,
      ),
    ).toMatchObject({ value: null, customLabel: "Label only", url: null });
    expect(
      mapLegacyFuelRow(row({ kind: "gift", label: "   " }), OPTS),
    ).toMatchObject({ customLabel: null });
  });

  it("maps recent to Last Talked About: value from text, label, url; dated by created_at", () => {
    expect(
      mapLegacyFuelRow(
        row({
          kind: "recent",
          text: null,
          label: "Label",
          url: "U",
          source: "share",
          createdAt: "2026-07-04 21:30:00",
        }),
        OPTS,
      ),
    ).toEqual({
      home: "current_state",
      uid: "u-1",
      fieldKey: "last_talked_about",
      value: "Label",
      url: "U",
      entryDate: "2026-07-04",
      entryTime: null,
      groupNoteCopy: 0,
      fromShare: 1,
      createdAt: "2026-07-04 21:30:00",
      modifiedAt: "2026-08-02 10:00:00",
    });
    expect(
      mapLegacyFuelRow(
        row({ kind: "recent", text: "", label: null, url: "only-url" }),
        OPTS,
      ),
    ).toMatchObject({ value: "only-url", fromShare: 0 });
  });

  it("D-128: a recent row with both label and text keeps the label as '<label>: <text>' (trimmed)", () => {
    expect(
      mapLegacyFuelRow(
        row({ kind: "recent", label: "  Work ", text: " new job  ", url: "U" }),
        OPTS,
      ),
    ).toMatchObject({
      home: "current_state",
      value: "Work: new job",
      url: "U",
    });
    // Text alone keeps the text as stored; label alone keeps the label.
    expect(
      mapLegacyFuelRow(row({ kind: "recent", label: " ", text: " Hi " }), OPTS),
    ).toMatchObject({ value: " Hi " });
    expect(
      mapLegacyFuelRow(row({ kind: "recent", label: "Lbl", text: "  " }), OPTS),
    ).toMatchObject({ value: "Lbl" });
    expect(
      legacyLastTalkedAboutValue({ label: "A", text: "B", url: null }),
    ).toBe("A: B");
  });

  it("D-97: a contentless off_limits row is kept; any other contentless kind maps to none", () => {
    const blank = { text: " ", label: "", url: null };
    expect(
      mapLegacyFuelRow(row({ kind: "off_limits", ...blank }), OPTS),
    ).toMatchObject({ home: "off_limits", text: " ", label: "" });
    for (const kind of ["gift", "topic", "fact", "recent", "unknown"]) {
      expect(mapLegacyFuelRow(row({ kind, ...blank }), OPTS)).toEqual({
        home: "none",
        uid: "u-1",
        reason: "contentless",
      });
    }
  });
});

describe("legacyEntryDate and firstNonBlank", () => {
  it("falls back from created_at to modified_at to now", () => {
    expect(legacyEntryDate("2026-01-02 03:04:05", "x", NOW)).toBe("2026-01-02");
    expect(legacyEntryDate("yesterday", "2026-03-04 00:00:00", NOW)).toBe(
      "2026-03-04",
    );
    expect(legacyEntryDate("n/a", "?", NOW)).toBe("2026-10-13");
    expect(legacyEntryDate("2026-1-02", "", NOW)).toBe("2026-10-13");
    expect(legacyEntryDate("2026-01-02", "", NOW)).toBe("2026-01-02");
  });

  it("returns the first non-blank candidate as stored, else null", () => {
    expect(firstNonBlank(null, "  ", " keep ", "later")).toBe(" keep ");
    expect(firstNonBlank(undefined, "", "\n")).toBeNull();
  });
});

describe("uid re-mint and allocation (F-D5; convergence c3)", () => {
  it("re-mints deterministically to legacy-<table>-<uid>, then -2, -3", () => {
    expect(remintLegacyUid("memories", "x")).toBe("legacy-memories-x");
    expect(remintLegacyUid("memories", "x")).toBe(
      remintLegacyUid("memories", "x"),
    );
    expect(remintLegacyUid("off_limits", "x", 2)).toBe("legacy-off_limits-x-2");
    expect(remintLegacyUid("current_state_entries", "x", 3)).toBe(
      "legacy-current_state_entries-x-3",
    );
  });

  it("a collided row takes its allocated uid in its home table only, the same on every call", () => {
    const input = {
      legacyRows: [row({ uid: "x", kind: "gift" })],
      legacyTombstoneUids: ["x"],
      destinationUids: { ...EMPTY_DESTINATIONS, memories: ["x"] },
    };
    const allocation = allocateLegacyUids(input);
    expect(plain(allocation)).toEqual({
      off_limits: {},
      memories: { x: "legacy-memories-x" },
      current_state_entries: {},
    });
    expect(plain(allocateLegacyUids(input))).toEqual(plain(allocation));
    expect(
      mapLegacyFuelRow(row({ uid: "x", kind: "gift" }), {
        ...OPTS,
        allocation,
      }),
    ).toMatchObject({ uid: "legacy-memories-x" });
    // The tombstone for x lands under the re-mint for memories only.
    expect(
      LEGACY_FUEL_TOMBSTONE_TYPES.map(
        ({ table }) => allocation[table].get("x") ?? "x",
      ),
    ).toEqual(["legacy-memories-x", "x", "x"]);
  });

  it("(a) takes -2 when the destination already holds both x and legacy-memories-x", () => {
    const allocation = allocateLegacyUids({
      legacyRows: [row({ uid: "x", kind: "gift" })],
      legacyTombstoneUids: [],
      destinationUids: {
        ...EMPTY_DESTINATIONS,
        memories: ["x", "legacy-memories-x"],
      },
    });
    expect(allocation.memories.get("x")).toBe("legacy-memories-x-2");
  });

  it("(b) takes -2 when another legacy row keeps legacy-memories-x as its own uid", () => {
    const allocation = allocateLegacyUids({
      legacyRows: [
        row({ uid: "x", kind: "gift" }),
        row({ uid: "legacy-memories-x", kind: "fact" }),
      ],
      legacyTombstoneUids: [],
      destinationUids: { ...EMPTY_DESTINATIONS, memories: ["x"] },
    });
    expect(plain(allocation).memories).toEqual({ x: "legacy-memories-x-2" });
  });

  it("sorted order decides who gets the plain candidate, whatever the input order", () => {
    // "a" and "a-2" both collide; legacy-memories-a-2 is the plain candidate
    // for "a-2" and the second candidate for "a". Sorted, "a" goes first.
    const rows = [
      row({ uid: "a-2", kind: "fact" }),
      row({ uid: "a", kind: "fact" }),
    ];
    const destinations = {
      ...EMPTY_DESTINATIONS,
      memories: ["a", "a-2", "legacy-memories-a"],
    };
    const forward = allocateLegacyUids({
      legacyRows: rows,
      legacyTombstoneUids: [],
      destinationUids: destinations,
    });
    const shuffled = allocateLegacyUids({
      legacyRows: [...rows].reverse(),
      legacyTombstoneUids: [],
      destinationUids: {
        ...destinations,
        memories: [...destinations.memories].reverse(),
      },
    });
    expect(plain(forward).memories).toEqual({
      a: "legacy-memories-a-2",
      "a-2": "legacy-memories-a-2-2",
    });
    expect(plain(shuffled)).toEqual(plain(forward));
  });

  it("does not reserve uids for skipped contentless rows, but does for every tombstone", () => {
    const allocation = allocateLegacyUids({
      legacyRows: [
        row({ uid: "x", kind: "gift", text: null }),
        row({ uid: "legacy-memories-y", kind: "gift", text: null }),
      ],
      legacyTombstoneUids: ["y"],
      destinationUids: { ...EMPTY_DESTINATIONS, memories: ["x", "y"] },
    });
    // x is contentless (skipped), so it neither collides nor reserves.
    expect(plain(allocation).memories).toEqual({ y: "legacy-memories-y" });
  });
});

// --- Pins: migration 033's frozen literals equal this module (Pitfall 9) -----

async function v32(): Promise<SqlExecutor> {
  const exec = nodeSqliteExecutor(openTestDb());
  let n = 0;
  await runMigrations(exec, MIGRATIONS, 32, {
    now: NOW,
    newUid: () => `seed-${++n}`,
  });
  return exec;
}

async function contact(exec: SqlExecutor): Promise<number> {
  return (
    await exec.runAsync(
      `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
       VALUES ('c', 'C', 30, ?, ?)`,
      [NOW, NOW],
    )
  ).lastInsertRowId;
}

async function insertLegacy(
  exec: SqlExecutor,
  contactId: number,
  r: LegacyFuelRowInput,
): Promise<void> {
  await exec.runAsync(
    `INSERT INTO fuel (uid, contact_id, kind, label, text, url, created_at, source, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      r.uid,
      contactId,
      r.kind,
      r.label ?? null,
      r.text ?? null,
      r.url ?? null,
      r.createdAt,
      r.source,
      r.modifiedAt,
    ],
  );
}

async function inTxn<T>(exec: SqlExecutor, fn: () => Promise<T>): Promise<T> {
  await exec.execAsync("BEGIN");
  const result = await fn();
  await exec.execAsync("COMMIT");
  return result;
}

describe("migration 033 pin", () => {
  it("the frozen kind map, unknown-kind type and tombstone types equal the module", () => {
    expect(MIGRATION033_KIND_HOMES).toEqual(LEGACY_FUEL_KIND_HOMES);
    expect(MIGRATION033_UNKNOWN_KIND_MEMORY_TYPE).toBe(
      LEGACY_UNKNOWN_KIND_MEMORY_TYPE,
    );
    expect([...MIGRATION033_TOMBSTONE_TYPES]).toEqual([
      ...LEGACY_FUEL_TOMBSTONE_TYPES,
    ]);
  });

  it("migrating seed rows writes exactly what mapLegacyFuelRow returns", async () => {
    const seeds: LegacyFuelRowInput[] = [
      row({ uid: "ol", kind: "off_limits", label: "L", text: "T", url: "U" }),
      row({ uid: "ol-share", kind: "off_limits", text: null, source: "share" }),
      row({ uid: "gift", kind: "gift", label: "B", text: "Shoes", url: "U" }),
      row({ uid: "topic-share", kind: "topic", source: "share" }),
      row({ uid: "topic-ai", kind: "topic", source: "ai" }),
      row({ uid: "fact-url", kind: "fact", text: " ", url: "https://x" }),
      row({ uid: "gift-label", kind: "gift", text: null, label: "Only" }),
      row({ uid: "odd", kind: "whatever" }),
      row({ uid: "recent", kind: "recent", text: null, label: "Lbl" }),
      row({
        uid: "recent-labelled",
        kind: "recent",
        label: " Work ",
        text: " new job ",
      }),
      row({
        uid: "recent-odd",
        kind: "recent",
        source: "share",
        createdAt: "bogus",
        modifiedAt: "2026-05-06 00:00:00",
      }),
      row({
        uid: "recent-odder",
        kind: "recent",
        createdAt: "x",
        modifiedAt: "y",
      }),
      row({ uid: "empty", kind: "gift", text: null }),
    ];
    const exec = await v32();
    const c = await contact(exec);
    for (const seed of seeds) await insertLegacy(exec, c, seed);
    const result = await inTxn(exec, () =>
      applyMigration033(exec, { now: NOW, newUid: () => "unused" }),
    );

    let skipped = 0;
    for (const seed of seeds) {
      const mapped = mapLegacyFuelRow(seed, OPTS);
      if (mapped.home === "none") {
        skipped += 1;
        expect(
          await exec.getFirstAsync("SELECT uid FROM memories WHERE uid = ?", [
            seed.uid,
          ]),
        ).toBeNull();
      } else if (mapped.home === "off_limits") {
        expect(
          await exec.getFirstAsync(
            `SELECT uid, label, text, url, group_note_copy AS groupNoteCopy,
                    from_share AS fromShare, created_at AS createdAt, modified_at AS modifiedAt
               FROM off_limits WHERE uid = ?`,
            [mapped.uid],
          ),
        ).toEqual({
          uid: mapped.uid,
          label: mapped.label,
          text: mapped.text,
          url: mapped.url,
          groupNoteCopy: mapped.groupNoteCopy,
          fromShare: mapped.fromShare,
          createdAt: mapped.createdAt,
          modifiedAt: mapped.modifiedAt,
        });
      } else if (mapped.home === "memory") {
        expect(
          await exec.getFirstAsync(
            `SELECT uid, type, value, custom_label AS customLabel, url, provenance,
                    allow_ai AS allowAi, pinned, hidden, group_note_copy AS groupNoteCopy,
                    created_at AS createdAt, modified_at AS modifiedAt
               FROM memories WHERE uid = ?`,
            [mapped.uid],
          ),
        ).toEqual({
          uid: mapped.uid,
          type: mapped.type,
          value: mapped.value,
          customLabel: mapped.customLabel,
          url: mapped.url,
          provenance: mapped.provenance,
          allowAi: mapped.allowAi,
          pinned: mapped.pinned,
          hidden: mapped.hidden,
          groupNoteCopy: mapped.groupNoteCopy,
          createdAt: mapped.createdAt,
          modifiedAt: mapped.modifiedAt,
        });
      } else {
        expect(
          await exec.getFirstAsync(
            `SELECT uid, field_key AS fieldKey, value, url, entry_date AS entryDate,
                    entry_time AS entryTime, group_note_copy AS groupNoteCopy,
                    from_share AS fromShare, created_at AS createdAt, modified_at AS modifiedAt
               FROM current_state_entries WHERE uid = ?`,
            [mapped.uid],
          ),
        ).toEqual({
          uid: mapped.uid,
          fieldKey: mapped.fieldKey,
          value: mapped.value,
          url: mapped.url,
          entryDate: mapped.entryDate,
          entryTime: mapped.entryTime,
          groupNoteCopy: mapped.groupNoteCopy,
          fromShare: mapped.fromShare,
          createdAt: mapped.createdAt,
          modifiedAt: mapped.modifiedAt,
        });
      }
    }
    expect(result.skippedContentless).toBe(skipped);
    expect(skipped).toBe(1);
  });

  it("migrating the two collision seeds yields the module's allocation", async () => {
    // Seed (a): the destination already holds x and legacy-memories-x.
    const a = await v32();
    const ca = await contact(a);
    for (const uid of ["x", "legacy-memories-x"]) {
      await a.runAsync(
        `INSERT INTO memories (uid, contact_id, type, value, created_at, modified_at)
         VALUES (?, ?, 'general', 'pre', ?, ?)`,
        [uid, ca, NOW, NOW],
      );
    }
    const seedA = row({ uid: "x", kind: "gift" });
    await insertLegacy(a, ca, seedA);
    await a.runAsync(
      "INSERT INTO tombstones (entity_type, entity_uid, deleted_at) VALUES ('fuel', 'x', ?)",
      [NOW],
    );
    const migratedA = await inTxn(a, () =>
      applyMigration033(a, { now: NOW, newUid: () => "unused" }),
    );
    const expectedA = allocateLegacyUids({
      legacyRows: [seedA],
      legacyTombstoneUids: ["x"],
      destinationUids: {
        ...EMPTY_DESTINATIONS,
        memories: ["x", "legacy-memories-x"],
      },
    });
    expect(migratedA.reminted).toEqual(plain(expectedA));
    expect(migratedA.reminted.memories).toEqual({ x: "legacy-memories-x-2" });

    // Seed (b): another legacy row's own uid is legacy-memories-x.
    const b = await v32();
    const cb = await contact(b);
    await b.runAsync(
      `INSERT INTO memories (uid, contact_id, type, value, created_at, modified_at)
       VALUES ('x', ?, 'general', 'pre', ?, ?)`,
      [cb, NOW, NOW],
    );
    const seedsB = [
      row({ uid: "x", kind: "gift" }),
      row({ uid: "legacy-memories-x", kind: "fact" }),
    ];
    for (const seed of seedsB) await insertLegacy(b, cb, seed);
    const migratedB = await inTxn(b, () =>
      applyMigration033(b, { now: NOW, newUid: () => "unused" }),
    );
    const expectedB = allocateLegacyUids({
      legacyRows: seedsB,
      legacyTombstoneUids: [],
      destinationUids: { ...EMPTY_DESTINATIONS, memories: ["x"] },
    });
    expect(migratedB.reminted).toEqual(plain(expectedB));
    expect(
      await b.getAllAsync<{ uid: string; value: string }>(
        "SELECT uid, value FROM memories ORDER BY uid",
      ),
    ).toEqual([
      { uid: "legacy-memories-x", value: "Some text" },
      { uid: "legacy-memories-x-2", value: "Some text" },
      { uid: "x", value: "pre" },
    ]);
  });
});
