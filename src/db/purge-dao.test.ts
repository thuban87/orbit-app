/**
 * Purge fan-out DAO — behavioural proof (CRUD-06).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture
 * and the REAL purge DAO, asserting the irreversible whole-contact delete:
 *   - computeImpact returns the correct per-child COUNT + a hasCustomValues
 *     boolean (contact_custom_values is ONE row per contact, not a field count).
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
import { migration001 } from "@/db/migrations/001-initial";
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

beforeEach(async () => {
  uidCounter = 0;
  const db = openTestDb();
  exec = nodeSqliteExecutor(db);
  await runMigrations(exec, [migration001], 1, { now: NOW, newUid: uid });
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

async function seedCustomValues(contactId: number): Promise<void> {
  await exec.runAsync(
    "INSERT INTO contact_custom_values (contact_id, uid, modified_at) VALUES (?, ?, ?)",
    [contactId, uid(), NOW],
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
    ["contact_custom_values", "contact_id"],
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
  it("returns multi-row counts and a boolean for the single custom-values row", async () => {
    const id = await seedFullContact("Chris");

    const impact = await computeImpact(exec, id);
    expect(impact).toEqual({
      interactions: 2,
      events: 1,
      fuel: 3,
      links: 1,
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
      hasCustomValues: false,
    });
  });
});

describe("impactSummaryLines — pure omit-zero render helper", () => {
  it("renders interactions / fuel / links only, in order, pluralised", () => {
    const lines = impactSummaryLines("Chris", {
      interactions: 12,
      events: 5,
      fuel: 4,
      links: 1,
      hasCustomValues: true,
    });
    // events + custom values are NOT rendered as blast-radius lines.
    expect(lines).toEqual(["12 interactions", "4 fuel items", "1 link"]);
  });

  it("omits any child whose count is 0", () => {
    const lines = impactSummaryLines("Chris", {
      interactions: 1,
      events: 0,
      fuel: 0,
      links: 2,
      hasCustomValues: false,
    });
    expect(lines).toEqual(["1 interaction", "2 links"]);
  });

  it("returns an empty array when there are no multi-row children", () => {
    const lines = impactSummaryLines("Chris", {
      interactions: 0,
      events: 3,
      fuel: 0,
      links: 0,
      hasCustomValues: true,
    });
    // events present but never rendered → no lines.
    expect(lines).toEqual([]);
  });
});

describe("purgeContact — archived-guarded one-transaction fan-out (T-04-12/13)", () => {
  it("deletes every owned row for an archived contact, leaving a second contact intact", async () => {
    const target = await seedFullContact("Chris");
    const other = await seedFullContact("Bo");

    await purgeContact(exec, target);

    expect(await ownedRowCount(target)).toBe(0);
    // The second contact keeps all 10 of its owned rows (contact + 9 children).
    expect(await ownedRowCount(other)).toBe(10);
  });

  it("REJECTS a live (non-archived) contact and deletes NOTHING (write-boundary guard)", async () => {
    const id = await seedFullContact("Live", { archived: false });
    const before = await ownedRowCount(id);

    await expect(purgeContact(exec, id)).rejects.toThrow();

    // Every child + the contact row survives — the guard fired before any delete.
    expect(await ownedRowCount(id)).toBe(before);
  });

  it("throws for a missing contact id and deletes nothing", async () => {
    await expect(purgeContact(exec, 9999)).rejects.toThrow();
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

    await expect(purgeContact(guarded, id)).rejects.toThrow(boom);
    expect(await ownedRowCount(id)).toBe(before);
  });
});

describe("purgeContact — POST-COMMIT extension adapter (T-04-16)", () => {
  it("invokes onPurgeExtensions AFTER the deletes commit", async () => {
    const id = await seedFullContact("Chris");
    let contactRowsAtCallTime = -1;

    await purgeContact(exec, id, {
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
      purgeContact(exec, id, { onPurgeExtensions: adapter }),
    ).resolves.toBeUndefined();

    expect(adapter).toHaveBeenCalledWith(id);
    expect(await ownedRowCount(id)).toBe(0);
  });
});
