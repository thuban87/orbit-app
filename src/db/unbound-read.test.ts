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
import { listUnbound } from "@/db/unbound-read";

const NOW = "2026-08-28 12:00:00";

let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;
let exec: SqlExecutor;

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
    { now: NOW, newUid: uid, defaultPhoneRegion: "US" },
  );
});

async function seedContact(
  name: string,
  trackingEnabled: number,
  archivedAt: string | null = null,
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts
       (uid, name, interval_days, tracking_enabled, archived_at, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uid(), name, 30, trackingEnabled, archivedAt, NOW, NOW],
  );
  return result.lastInsertRowId;
}

describe("listUnbound", () => {
  it("returns only live Unbound contacts alphabetically with neutral lifecycle metadata", async () => {
    const zed = await seedContact("Zed", 0);
    const amy = await seedContact("amy", 0);
    await seedContact("Bound", 1);
    await seedContact("Archived Unbound", 0, NOW);

    const rows = await listUnbound(exec);

    expect(rows.map((row) => row.id)).toEqual([amy, zed]);
    expect(rows.map((row) => row.trackingEnabled)).toEqual([0, 0]);
    expect(rows.every((row) => row.status === null)).toBe(true);
    expect(rows.every((row) => row.progress === null)).toBe(true);
    expect(rows.every((row) => row.favourite_rank === null)).toBe(true);
  });
});
