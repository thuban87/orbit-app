import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
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
import { readUpNextCandidates } from "@/db/up-next-read";

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
      input.lastContact === undefined ? localDateOffset(-10) : input.lastContact,
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
    await seedContact({ name: "Approaching", lastContact: localDateOffset(-8) });
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
