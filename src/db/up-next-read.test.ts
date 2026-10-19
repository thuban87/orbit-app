import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { listDashboardPopulation } from "@/db/dashboard-read";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
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
import { newUid } from "@/db/uid";
import { readUpNextCandidates } from "@/db/up-next-read";
import { dedupOverlooked, pickUpNext } from "@/logic/digest-composition";

const NOW = "2026-08-15 12:00:00";
let uidCounter = 0;
let exec: SqlExecutor;

function localDateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

beforeEach(async () => {
  uidCounter = 0;
  exec = nodeSqliteExecutor(openTestDb());
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
    {
      now: NOW,
      newUid: () => `uid-${++uidCounter}`,
      defaultPhoneRegion: "US",
    },
  );
});

async function seedContact(input: {
  name: string;
  intervalDays?: number | null;
  lastContact?: string | null;
  trackingEnabled?: number;
  archivedAt?: string | null;
  snoozeUntil?: string | null;
}): Promise<void> {
  await exec.runAsync(
    `INSERT INTO contacts
       (uid, name, interval_days, last_contact, tracking_enabled, archived_at,
        snooze_until, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `uid-${++uidCounter}`,
      input.name,
      input.intervalDays === undefined ? 10 : input.intervalDays,
      input.lastContact === undefined
        ? localDateOffset(-10)
        : input.lastContact,
      input.trackingEnabled ?? 1,
      input.archivedAt ?? null,
      input.snoozeUntil ?? null,
      NOW,
      NOW,
    ],
  );
}

describe("readUpNextCandidates", () => {
  it("returns attention contacts most-overdue first without pre-capping", async () => {
    await seedContact({
      name: "Approaching",
      lastContact: localDateOffset(-8),
    });
    await seedContact({ name: "Due", lastContact: localDateOffset(-10) });
    await seedContact({ name: "Rogue", lastContact: localDateOffset(-40) });
    await seedContact({ name: "Decay", lastContact: localDateOffset(-15) });

    const rows = await readUpNextCandidates(exec);
    expect(rows.map((row) => row.name)).toEqual([
      "Rogue",
      "Decay",
      "Due",
      "Approaching",
    ]);
    expect(rows.map((row) => row.status)).toEqual([
      "rogue",
      "decay",
      "decay",
      "wobble",
    ]);
  });

  it("returns zero rows when every eligible contact is stable", async () => {
    await seedContact({ name: "Stable", lastContact: localDateOffset(-7) });
    expect(await readUpNextCandidates(exec)).toEqual([]);
  });

  it("excludes archived, unbound, cadence-less, never-contacted, and active snoozes", async () => {
    await seedContact({ name: "Included", lastContact: localDateOffset(-8) });
    await seedContact({ name: "Archived", archivedAt: NOW });
    await seedContact({ name: "Unbound", trackingEnabled: 0 });
    await seedContact({
      name: "No cadence",
      intervalDays: null,
      trackingEnabled: 0,
    });
    await seedContact({ name: "Never", lastContact: null });
    await seedContact({
      name: "Snoozed",
      lastContact: localDateOffset(-40),
      snoozeUntil: localDateOffset(2),
    });

    expect((await readUpNextCandidates(exec)).map((row) => row.name)).toEqual([
      "Included",
    ]);
  });
});

describe("Up Next and Overlooked agree with the needs-attention drill (38.13 D-61)", () => {
  beforeEach(async () => {
    // The drill reads the Contacts population machinery, so this block runs on
    // the real, complete migration chain.
    exec = nodeSqliteExecutor(openTestDb());
    await runMigrations(exec, MIGRATIONS, TARGET_VERSION, { now: NOW, newUid });
  });

  async function seedMixedAttention(): Promise<void> {
    await seedContact({ name: "Wobble", lastContact: localDateOffset(-8) });
    await seedContact({ name: "Decay", lastContact: localDateOffset(-15) });
    await seedContact({ name: "Rogue", lastContact: localDateOffset(-40) });
    await seedContact({ name: "Rogue Two", lastContact: localDateOffset(-35) });
    await seedContact({ name: "Decay Two", lastContact: localDateOffset(-12) });
    await seedContact({
      name: "Snoozed Rogue",
      lastContact: localDateOffset(-40),
      snoozeUntil: localDateOffset(5),
    });
    await seedContact({
      name: "Unbound Old",
      intervalDays: 10,
      lastContact: localDateOffset(-60),
      trackingEnabled: 0,
    });
    await seedContact({ name: "Stable", lastContact: localDateOffset(-2) });
  }

  it("Up Next candidates are exactly the set the drill opens; snoozed and Unbound people are in neither", async () => {
    await seedMixedAttention();
    const candidates = await readUpNextCandidates(exec);
    const drill = await listDashboardPopulation(
      exec,
      {
        viewMode: "list",
        populations: [],
        filters: { "needs-attention": ["on"] },
        sort: "default",
      },
      NOW,
    );
    const candidateNames = new Set(candidates.map((row) => row.name));
    const drillNames = new Set(drill.map((row) => row.name));
    expect(candidateNames).toEqual(drillNames);
    expect(candidateNames).toEqual(
      new Set(["Wobble", "Decay", "Rogue", "Rogue Two", "Decay Two"]),
    );
    for (const excluded of ["Snoozed Rogue", "Unbound Old", "Stable"]) {
      expect(candidateNames.has(excluded)).toBe(false);
      expect(drillNames.has(excluded)).toBe(false);
    }
  });

  it("Up Next plus Overlooked covers the drill set with no overlap", async () => {
    await seedMixedAttention();
    const candidates = await readUpNextCandidates(exec);
    const upNext = pickUpNext(candidates);
    const overlooked = dedupOverlooked(
      candidates,
      upNext.map((row) => row.id),
    );
    expect(upNext.map((row) => row.name)).toEqual([
      "Rogue",
      "Rogue Two",
      "Decay",
    ]);
    expect(overlooked.map((row) => row.name)).toEqual(["Decay Two", "Wobble"]);
    const drill = await listDashboardPopulation(
      exec,
      {
        viewMode: "list",
        populations: [],
        filters: { "needs-attention": ["on"] },
        sort: "default",
      },
      NOW,
    );
    expect(new Set([...upNext, ...overlooked].map((row) => row.id))).toEqual(
      new Set(drill.map((row) => row.id)),
    );
  });
});
