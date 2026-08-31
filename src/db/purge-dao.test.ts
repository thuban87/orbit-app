/**
 * Purge fan-out DAO — behavioural proof (CRUD-06).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL v6 migration fixture
 * and the REAL purge DAO, asserting the irreversible whole-contact delete:
 *   - computeImpact returns the correct per-child COUNT + a hasCustomValues
 *     boolean (custom_field_values is a multi-row child, deliberately not rendered).
 *   - impactSummaryLines is a pure omit-zero render helper: interactions / fuel /
 *     links only (never custom values, never events), a 0-count child → no line.
 *   - purgeContact on an ARCHIVED contact deletes every owned child (incl.
 *     field_history, which has no FK) + the contact in ONE transaction, leaving a
 *     second contact untouched.
 *   - purgeContact on a LIVE (non-archived) contact THROWS and deletes NOTHING —
 *     the write-boundary guard (T-04-12), not just UI routing.
 *   - a mid-transaction failure rolls the whole fan-out back (nothing deleted).
 *   - a supplied onPurgeExtensions adapter fires POST-COMMIT (the contact is
 *     already gone when it runs), and a THROWING adapter does NOT undo the commit.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { archiveContact, createContactFull } from "@/db/contacts-dao";
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
import { migration012 } from "@/db/migrations/012-import-sessions";
import { migration013 } from "@/db/migrations/013-reconciliation-and-merge";
import { migration014 } from "@/db/migrations/014-interaction-assists";
import { runMigrations } from "@/db/migrations/runner";
import {
  computeImpact,
  impactSummaryLines,
  purgeContact,
} from "@/db/purge-dao";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-15 12:00:00";

let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;

let exec: SqlExecutor;
let customValueDefIds: readonly number[] | undefined;

beforeEach(async () => {
  uidCounter = 0;
  customValueDefIds = undefined;
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
      migration008,
      migration009,
      migration010,
      migration011,
      migration012,
      migration013,
      migration014,
    ],
    14,
    { now: NOW, newUid: uid },
  );
});

/** Insert a contact (archived by default) and return its id. */
async function seedContact(
  name: string,
  { archived = true }: { archived?: boolean } = {},
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, archived_at, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [uid(), name, 30, archived ? NOW : null, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function seedInteraction(contactId: number): Promise<void> {
  await exec.runAsync(
    `INSERT INTO interactions (uid, contact_id, occurred_at, recorded_at, source, modified_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [uid(), contactId, NOW, NOW, "manual", NOW],
  );
}

async function seedEvent(contactId: number): Promise<void> {
  await exec.runAsync(
    `INSERT INTO events (uid, contact_id, type, occurred_at, recorded_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [uid(), contactId, "birthday", NOW, NOW, NOW],
  );
}

async function seedFuel(contactId: number): Promise<void> {
  await exec.runAsync(
    `INSERT INTO fuel (uid, contact_id, kind, created_at, source, modified_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [uid(), contactId, "note", NOW, "manual", NOW],
  );
}

async function seedLink(contactId: number): Promise<void> {
  await exec.runAsync(
    `INSERT INTO contact_links (uid, contact_id, url, display_order, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [uid(), contactId, "https://example.com", 0, NOW, NOW],
  );
}

async function seedDef(
  colName: string,
  displayOrder: number,
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO custom_field_defs
       (uid, col_name, label, type, options, show_on_new, always_show,
        display_order, quarantined_at, share_with_ai, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid(),
      colName,
      colName,
      "text",
      null,
      0,
      0,
      displayOrder,
      null,
      0,
      NOW,
      NOW,
    ],
  );
  return result.lastInsertRowId;
}

async function seedCustomValues(contactId: number): Promise<void> {
  if (!customValueDefIds) {
    customValueDefIds = [
      await seedDef("nickname", 0),
      await seedDef("note", 1),
    ];
  }
  const [nicknameDefId, noteDefId] = customValueDefIds;
  await exec.runAsync(
    `INSERT INTO custom_field_values
       (uid, contact_id, field_def_id, value, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)`,
    [
      uid(),
      contactId,
      nicknameDefId,
      "Al",
      NOW,
      NOW,
      uid(),
      contactId,
      noteDefId,
      "Friend from school",
      NOW,
      NOW,
    ],
  );
}

async function seedHistory(contactId: number): Promise<void> {
  await exec.runAsync(
    `INSERT INTO field_history (contact_id, field_col_name, old_value, operation, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [contactId, "nickname", "Al", "delete", NOW],
  );
}

/** Total rows owned by a contact across every child table + contacts. */
async function ownedRowCount(contactId: number): Promise<number> {
  const tables: Array<[string, string]> = [
    ["interactions", "contact_id"],
    ["events", "contact_id"],
    ["fuel", "contact_id"],
    ["custom_field_values", "contact_id"],
    ["contact_links", "contact_id"],
    ["field_history", "contact_id"],
    ["contacts", "id"],
  ];
  let total = 0;
  for (const [table, col] of tables) {
    const row = await exec.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${table} WHERE ${col} = ?`,
      [contactId],
    );
    total += row?.n ?? 0;
  }
  return total;
}

/** Seed a contact with N of each child (2 interactions, 3 fuel, 1 link, …). */
async function seedFullContact(
  name: string,
  opts: { archived?: boolean } = {},
): Promise<number> {
  const id = await seedContact(name, opts);
  await seedInteraction(id);
  await seedInteraction(id);
  await seedEvent(id);
  await seedFuel(id);
  await seedFuel(id);
  await seedFuel(id);
  await seedLink(id);
  await seedCustomValues(id);
  await seedHistory(id);
  return id;
}

describe("computeImpact — per-child counts + hasCustomValues (CRUD-06)", () => {
  it("returns multi-row counts and a boolean for normalized custom values", async () => {
    const id = await seedFullContact("Chris");

    const impact = await computeImpact(exec, id);
    expect(impact).toEqual({
      interactions: 2,
      events: 1,
      fuel: 3,
      links: 1,
      methods: 0,
      externalLinks: 0,
      methodProvenance: 0,
      hasCustomValues: true,
    });
  });

  it("reports hasCustomValues=false and zero counts for a bare contact", async () => {
    const id = await seedContact("Dana");

    const impact = await computeImpact(exec, id);
    expect(impact).toEqual({
      interactions: 0,
      events: 0,
      fuel: 0,
      links: 0,
      methods: 0,
      externalLinks: 0,
      methodProvenance: 0,
      hasCustomValues: false,
    });
  });
});

describe("impactSummaryLines — pure omit-zero render helper", () => {
  it("renders interactions / events / fuel / links, in order, pluralised", () => {
    const lines = impactSummaryLines("Chris", {
      interactions: 12,
      events: 5,
      fuel: 4,
      links: 1,
      methods: 0,
      externalLinks: 0,
      methodProvenance: 0,
      hasCustomValues: true,
    });
    // events ARE now surfaced (Phase 6 writer landed); custom values still are not.
    expect(lines).toEqual([
      "12 interactions",
      "5 events",
      "4 fuel items",
      "1 link",
    ]);
  });

  it("omits any child whose count is 0 (incl. events)", () => {
    const lines = impactSummaryLines("Chris", {
      interactions: 1,
      events: 0,
      fuel: 0,
      links: 2,
      methods: 0,
      externalLinks: 0,
      methodProvenance: 0,
      hasCustomValues: false,
    });
    expect(lines).toEqual(["1 interaction", "2 links"]);
  });

  it("renders an events-only blast radius when events is the sole child", () => {
    const lines = impactSummaryLines("Chris", {
      interactions: 0,
      events: 3,
      fuel: 0,
      links: 0,
      methods: 0,
      externalLinks: 0,
      methodProvenance: 0,
      hasCustomValues: true,
    });
    // events now surfaced → one line; custom values never rendered.
    expect(lines).toEqual(["3 events"]);
  });

  it("returns an empty array when there are no rendered children", () => {
    const lines = impactSummaryLines("Chris", {
      interactions: 0,
      events: 0,
      fuel: 0,
      links: 0,
      methods: 0,
      externalLinks: 0,
      methodProvenance: 0,
      hasCustomValues: true,
    });
    expect(lines).toEqual([]);
  });
});

describe("purgeContact — archived-guarded one-transaction fan-out (T-04-12/13)", () => {
  it("deletes every owned row for an archived contact, leaving a second contact intact", async () => {
    const target = await seedFullContact("Chris");
    const other = await seedFullContact("Bo");

    await purgeContact(exec, target, { now: NOW });

    expect(await ownedRowCount(target)).toBe(0);
    // The second contact keeps all 11 owned rows (contact + 10 children).
    expect(await ownedRowCount(other)).toBe(11);
  });

  it("removes a pending assist through the contact foreign-key cascade", async () => {
    const target = await seedContact("Chris");
    await exec.runAsync(
      `INSERT INTO interaction_assists
         (uid, contact_id, channel, endpoint_value, status, handoff_at, created_at, modified_at)
       VALUES (?, ?, 'call', ?, 'pending', ?, ?, ?)`,
      [uid(), target, "+15551234567", NOW, NOW, NOW],
    );

    await purgeContact(exec, target, { now: NOW });

    expect(
      await exec.getFirstAsync<{ id: number }>(
        "SELECT id FROM interaction_assists WHERE contact_id = ?",
        [target],
      ),
    ).toBeNull();
  });

  it("REJECTS a live (non-archived) contact and deletes NOTHING (write-boundary guard)", async () => {
    const id = await seedFullContact("Live", { archived: false });
    const before = await ownedRowCount(id);

    await expect(purgeContact(exec, id, { now: NOW })).rejects.toThrow();

    // Every child + the contact row survives — the guard fired before any delete.
    expect(await ownedRowCount(id)).toBe(before);
  });

  it("throws for a missing contact id and deletes nothing", async () => {
    await expect(purgeContact(exec, 9999, { now: NOW })).rejects.toThrow();
  });

  it("archive→event→purge round-trip: the emitted 'archive' event is gone after purge", async () => {
    // A live contact archived through the REAL retrofit emits an 'archive' event.
    const { contactId } = await createContactFull(exec, {
      uid: uid(),
      name: "RoundTrip",
      intervalDays: 14,
      now: NOW,
    });
    await archiveContact(exec, contactId, NOW);

    const eventsBefore = await exec.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM events WHERE contact_id = ?",
      [contactId],
    );
    expect(eventsBefore?.n).toBe(1);

    await purgeContact(exec, contactId, { now: NOW });

    const eventsAfter = await exec.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM events WHERE contact_id = ?",
      [contactId],
    );
    expect(eventsAfter?.n).toBe(0);
  });

  it("rolls the whole fan-out back when a delete fails mid-transaction", async () => {
    const id = await seedFullContact("Chris");
    const before = await ownedRowCount(id);

    // Fail the contacts delete (the last statement) by making runAsync throw for
    // it, proving the earlier child deletes are rolled back, not committed.
    const boom = new Error("forced mid-transaction failure");
    const guarded: SqlExecutor = {
      ...exec,
      runAsync: (sql, params) => {
        if (/DELETE FROM contacts\b/i.test(sql)) return Promise.reject(boom);
        return exec.runAsync(sql, params);
      },
    };

    await expect(purgeContact(guarded, id, { now: NOW })).rejects.toThrow(boom);
    expect(await ownedRowCount(id)).toBe(before);
  });
});

describe("purgeContact — POST-COMMIT extension adapter (T-04-16)", () => {
  it("invokes onPurgeExtensions AFTER the deletes commit", async () => {
    const id = await seedFullContact("Chris");
    let contactRowsAtCallTime = -1;

    await purgeContact(exec, id, {
      now: NOW,
      onPurgeExtensions: async (purgedId) => {
        const row = await exec.getFirstAsync<{ n: number }>(
          "SELECT COUNT(*) AS n FROM contacts WHERE id = ?",
          [purgedId],
        );
        contactRowsAtCallTime = row?.n ?? -1;
      },
    });

    // The adapter saw a committed DB: the contact was already gone when it ran.
    expect(contactRowsAtCallTime).toBe(0);
  });

  it("does NOT roll back the committed deletes when the adapter throws", async () => {
    const id = await seedFullContact("Chris");
    const adapter = vi.fn().mockRejectedValue(new Error("cleanup blew up"));

    // A throwing best-effort adapter must not reject the purge or undo the commit.
    await expect(
      purgeContact(exec, id, { now: NOW, onPurgeExtensions: adapter }),
    ).resolves.toBeUndefined();

    expect(adapter).toHaveBeenCalledWith(id);
    expect(await ownedRowCount(id)).toBe(0);
  });
});

describe("purgeContact — deletion evidence and merge-safe sun state", () => {
  it("captures every mergeable UID before fan-out deletion, excluding field history", async () => {
    const contactId = await seedFullContact("Tombstoned");
    const expected = await exec.getAllAsync<{
      entity_type: string;
      entity_uid: string;
    }>(
      `SELECT 'contact' AS entity_type, uid AS entity_uid FROM contacts WHERE id = ?
       UNION ALL SELECT 'interaction', uid FROM interactions WHERE contact_id = ?
       UNION ALL SELECT 'event', uid FROM events WHERE contact_id = ?
       UNION ALL SELECT 'fuel', uid FROM fuel WHERE contact_id = ?
       UNION ALL SELECT 'contact_link', uid FROM contact_links WHERE contact_id = ?
       UNION ALL SELECT 'custom_field_value', uid FROM custom_field_values WHERE contact_id = ?
       ORDER BY entity_type, entity_uid`,
      [contactId, contactId, contactId, contactId, contactId, contactId],
    );

    await purgeContact(exec, contactId, { now: NOW });

    expect(
      await exec.getAllAsync<{ entity_type: string; entity_uid: string }>(
        "SELECT entity_type, entity_uid FROM tombstones ORDER BY entity_type, entity_uid",
      ),
    ).toEqual(expected);
    expect(
      await exec.getFirstAsync<{ n: number }>(
        "SELECT COUNT(*) AS n FROM tombstones WHERE entity_type = 'field_history'",
      ),
    ).toEqual({ n: 0 });
  });

  it("clears the current sun with the caller-supplied modified_at in the purge transaction", async () => {
    const contactId = await seedFullContact("Sun");
    const suppliedNow = "2026-08-25 17:42:01";
    await exec.runAsync("UPDATE app_settings SET sun_contact_id = ?, modified_at = ? WHERE id = 1", [
      contactId,
      NOW,
    ]);

    await purgeContact(exec, contactId, { now: suppliedNow });

    expect(
      await exec.getFirstAsync<{ sun_contact_id: number | null; modified_at: string }>(
        "SELECT sun_contact_id, modified_at FROM app_settings WHERE id = 1",
      ),
    ).toEqual({ sun_contact_id: null, modified_at: suppliedNow });
  });
});
