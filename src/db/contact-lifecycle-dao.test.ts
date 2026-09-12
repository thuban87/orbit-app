import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { bindContact, unbindContact } from "@/db/contact-lifecycle-dao";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { migration006 } from "@/db/migrations/006-normalize-custom-field-values";
import { migration007 } from "@/db/migrations/007-tombstones";
import { migration008 } from "@/db/migrations/008-restore-photo-journal";
import { migration009 } from "@/db/migrations/009-contact-method-normalization";
import { migration010 } from "@/db/migrations/010-contact-method-label";
import { migration011 } from "@/db/migrations/011-contact-lifecycle-schema";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-28 12:00:00";
const LATER = "2026-08-28 13:00:00";

let exec: SqlExecutor;
let uidCounter = 0;
const newUid = () => `lifecycle-uid-${++uidCounter}`;

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
      migration008,
      migration009,
      migration010,
      migration011,
    ],
    11,
    { now: NOW, newUid, defaultPhoneRegion: "US" },
  );
});

async function seedContact(input: {
  intervalDays: number | null;
  trackingEnabled: number;
  lastContact?: string | null;
  favouriteRank?: number | null;
}): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts
       (uid, name, interval_days, tracking_enabled, last_contact, favourite_rank,
        created_at, modified_at)
     VALUES (?, 'Lifecycle fixture', ?, ?, ?, ?, ?, ?)`,
    [
      newUid(),
      input.intervalDays,
      input.trackingEnabled,
      input.lastContact ?? null,
      input.favouriteRank ?? null,
      NOW,
      NOW,
    ],
  );
  return result.lastInsertRowId;
}

async function row(id: number) {
  return exec.getFirstAsync<{
    interval_days: number | null;
    tracking_enabled: number;
    last_contact: string | null;
    favourite_rank: number | null;
    modified_at: string;
  }>(
    `SELECT interval_days, tracking_enabled, last_contact, favourite_rank, modified_at
       FROM contacts WHERE id = ?`,
    [id],
  );
}

async function dataRevision(): Promise<number> {
  const setting = await exec.getFirstAsync<{ data_revision: number }>(
    "SELECT data_revision FROM app_settings WHERE id = 1",
  );
  return setting?.data_revision ?? -1;
}

async function events(contactId: number) {
  return exec.getAllAsync<{
    uid: string;
    type: string;
    occurred_at: string;
    detail: string | null;
    recorded_at: string;
    modified_at: string;
  }>(
    `SELECT uid, type, occurred_at, detail, recorded_at, modified_at
       FROM events WHERE contact_id = ? ORDER BY id`,
    [contactId],
  );
}

describe("contact lifecycle DAO", () => {
  it("unbinds without altering cadence, favourite rank, or relationship history", async () => {
    const contactId = await seedContact({
      intervalDays: 30,
      trackingEnabled: 1,
      lastContact: "2026-08-20 09:00:00",
      favouriteRank: 4,
    });
    await exec.runAsync(
      `INSERT INTO interactions (uid, contact_id, occurred_at, recorded_at, source, modified_at)
       VALUES (?, ?, ?, ?, 'manual', ?)`,
      [newUid(), contactId, "2026-08-20 09:00:00", NOW, NOW],
    );

    await unbindContact(exec, contactId, LATER);

    expect(await row(contactId)).toEqual({
      interval_days: 30,
      tracking_enabled: 0,
      last_contact: "2026-08-20 09:00:00",
      favourite_rank: 4,
      modified_at: LATER,
    });
    const interactions = await exec.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM interactions WHERE contact_id = ?",
      [contactId],
    );
    expect(interactions?.n).toBe(1);
    expect(await dataRevision()).toBe(1);
  });

  it("rebinds a dormant positive cadence without rewriting it", async () => {
    const contactId = await seedContact({
      intervalDays: 31,
      trackingEnabled: 0,
    });

    await bindContact(exec, contactId, LATER);

    expect(await row(contactId)).toMatchObject({
      interval_days: 31,
      tracking_enabled: 1,
      modified_at: LATER,
    });
    expect(await dataRevision()).toBe(1);
  });

  it("requires a positive supplied cadence to bind a never-assigned Unbound contact", async () => {
    const contactId = await seedContact({
      intervalDays: null,
      trackingEnabled: 0,
    });

    await expect(bindContact(exec, contactId, LATER)).rejects.toThrow(
      "requires a positive cadence",
    );
    await expect(bindContact(exec, contactId, LATER, 0)).rejects.toThrow(
      "positive integer",
    );
    expect(await row(contactId)).toMatchObject({
      interval_days: null,
      tracking_enabled: 0,
      modified_at: NOW,
    });
    expect(await dataRevision()).toBe(0);

    await bindContact(exec, contactId, LATER, 7);
    expect(await row(contactId)).toMatchObject({
      interval_days: 7,
      tracking_enabled: 1,
      modified_at: LATER,
    });
    expect(await dataRevision()).toBe(1);
  });

  it("writes exactly one immutable 'bind' event at the bind moment, inside the bind transaction", async () => {
    const contactId = await seedContact({
      intervalDays: 31,
      trackingEnabled: 0,
    });

    await bindContact(exec, contactId, LATER);

    const rows = await events(contactId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "bind",
      occurred_at: LATER,
      detail: null,
      recorded_at: LATER,
      modified_at: LATER,
    });
    // The bind event carries a distinct merge-key uid (not a seeded one).
    expect(rows[0]?.uid).toEqual(expect.any(String));
    expect(rows[0]?.uid.length).toBeGreaterThan(0);
  });

  it("writes exactly one immutable 'unbind' event at the unbind moment, inside the unbind transaction", async () => {
    const contactId = await seedContact({
      intervalDays: 30,
      trackingEnabled: 1,
    });

    await unbindContact(exec, contactId, LATER);

    const rows = await events(contactId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "unbind",
      occurred_at: LATER,
      detail: null,
      recorded_at: LATER,
      modified_at: LATER,
    });
  });

  it("appends lifecycle events insert-only — a later unbind never mutates the earlier bind event", async () => {
    const later2 = "2026-08-28 14:00:00";
    const contactId = await seedContact({
      intervalDays: 31,
      trackingEnabled: 0,
    });

    await bindContact(exec, contactId, LATER);
    const afterBind = await events(contactId);
    expect(afterBind).toHaveLength(1);
    const bindEvent = afterBind[0]!;

    await unbindContact(exec, contactId, later2);
    const afterUnbind = await events(contactId);

    // The earlier bind event is untouched (immutable, insert-only — ADR-025):
    // exactly two events, and the bind row is byte-for-byte what it was.
    expect(afterUnbind).toHaveLength(2);
    expect(afterUnbind[0]).toEqual(bindEvent);
    expect(afterUnbind[1]).toMatchObject({ type: "unbind", occurred_at: later2 });
  });

  it("rejects nonexistent or wrong-state transition targets without advancing revision", async () => {
    const bound = await seedContact({ intervalDays: 14, trackingEnabled: 1 });
    await expect(bindContact(exec, bound, LATER)).rejects.toThrow(
      "Unbound contact",
    );
    await expect(unbindContact(exec, 999_999, LATER)).rejects.toThrow(
      "Bound contact",
    );
    expect(await row(bound)).toMatchObject({
      tracking_enabled: 1,
      modified_at: NOW,
    });
    expect(await dataRevision()).toBe(0);
  });

  it("proves the shipped v11 SQL constraints reject forbidden lifecycle cells and roll back", async () => {
    await expect(
      Promise.resolve().then(() =>
        exec.runAsync(
          `INSERT INTO contacts
             (uid, name, interval_days, tracking_enabled, created_at, modified_at)
           VALUES (?, 'Invalid Bound', NULL, 1, ?, ?)`,
          [newUid(), NOW, NOW],
        ),
      ),
    ).rejects.toThrow();

    const contactId = await seedContact({
      intervalDays: 10,
      trackingEnabled: 1,
    });
    await expect(
      Promise.resolve().then(() =>
        exec.runAsync(
          "UPDATE contacts SET interval_days = NULL, tracking_enabled = 0 WHERE id = ?",
          [contactId],
        ),
      ),
    ).rejects.toThrow("assigned interval_days cannot be cleared");
    expect(await row(contactId)).toMatchObject({
      interval_days: 10,
      tracking_enabled: 1,
      modified_at: NOW,
    });
  });
});
