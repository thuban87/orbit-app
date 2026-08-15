/**
 * Conversational-fuel writer — behavioural proof (FUEL-01/FUEL-02).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture
 * and the REAL fuel DAO, asserting the load-bearing writer contract (mirrors
 * events-dao.test.ts / contact-links-dao's both-keys scoping):
 *   - addFuel inserts EXACTLY ONE row with all 9 columns stored verbatim and
 *     created_at/modified_at = the caller-supplied stamps;
 *   - optional label/text/url store NULL when null/undefined;
 *   - all 5 kinds ('recent'|'topic'|'fact'|'gift'|'off_limits') persist verbatim
 *     (the column has no CHECK);
 *   - editFuel bumps modified_at, leaves created_at untouched, and is scoped by
 *     BOTH id AND contact_id (a wrong-contact edit changes 0 → throws → rollback);
 *   - deleteFuel removes the matching (id, contact_id) and a wrong-contact delete
 *     changes 0 → throws;
 *   - addFuelCore composes inside a caller-opened inWriteTransaction WITHOUT
 *     taking its own mutex (the multi-attach composition primitive Phase 10 uses).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  addFuel,
  addFuelCore,
  deleteFuel,
  editFuel,
  type FuelKind,
} from "@/db/fuel-dao";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-15 12:00:00";
const LATER = "2026-08-16 09:30:00";

let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;

let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  const db = openTestDb();
  exec = nodeSqliteExecutor(db);
  await runMigrations(exec, [migration001], 1, { now: NOW, newUid: uid });
});

/** Insert a bare contact so the fuel FK (contact_id) is satisfiable. */
async function seedContact(name = "Alex"): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [uid(), name, 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

type FuelRow = {
  id: number;
  uid: string;
  contact_id: number;
  kind: string;
  label: string | null;
  text: string | null;
  url: string | null;
  created_at: string;
  source: string;
  modified_at: string;
};

async function allFuel(contactId: number): Promise<FuelRow[]> {
  return exec.getAllAsync<FuelRow>(
    "SELECT * FROM fuel WHERE contact_id = ? ORDER BY id",
    [contactId],
  );
}

describe("addFuel — one row, all 9 columns verbatim, ?-bound", () => {
  it("inserts exactly one row with every column stored verbatim and returns its rowid", async () => {
    const c = await seedContact();

    const id = await addFuel(exec, {
      uid: "fuel-uid-1",
      contactId: c,
      kind: "topic",
      label: "Sailing",
      text: "Ask about the regatta",
      url: "https://example.com/regatta",
      createdAt: NOW,
      source: "user",
      now: NOW,
    });

    const rows = await allFuel(c);
    expect(rows.length).toBe(1);
    expect(id).toBe(rows[0]?.id);
    expect(rows[0]).toMatchObject({
      uid: "fuel-uid-1",
      contact_id: c,
      kind: "topic",
      label: "Sailing",
      text: "Ask about the regatta",
      url: "https://example.com/regatta",
      created_at: NOW,
      source: "user",
      modified_at: NOW,
    });
  });

  it("stores label/text/url NULL when null or undefined", async () => {
    const c = await seedContact();

    await addFuel(exec, {
      uid: uid(),
      contactId: c,
      kind: "fact",
      label: null,
      text: null,
      url: null,
      createdAt: NOW,
      source: "user",
      now: NOW,
    });

    const rows = await allFuel(c);
    expect(rows.length).toBe(1);
    expect(rows[0]?.label).toBeNull();
    expect(rows[0]?.text).toBeNull();
    expect(rows[0]?.url).toBeNull();
  });

  it("accepts all 5 kinds (no CHECK on the column)", async () => {
    const c = await seedContact();
    const kinds: FuelKind[] = ["recent", "topic", "fact", "gift", "off_limits"];

    for (const kind of kinds) {
      await addFuel(exec, {
        uid: uid(),
        contactId: c,
        kind,
        text: `text for ${kind}`,
        createdAt: NOW,
        source: "user",
        now: NOW,
      });
    }

    const rows = await allFuel(c);
    expect(rows.map((r) => r.kind)).toEqual(kinds);
  });
});

describe("editFuel — bumps modified_at, preserves created_at, both-keys scoped", () => {
  it("updates kind/label/text/url and modified_at while leaving created_at untouched", async () => {
    const c = await seedContact();
    const id = await addFuel(exec, {
      uid: uid(),
      contactId: c,
      kind: "topic",
      text: "old",
      createdAt: NOW,
      source: "user",
      now: NOW,
    });

    await editFuel(exec, {
      id,
      contactId: c,
      kind: "gift",
      label: "birthday",
      text: "new text",
      url: null,
      now: LATER,
    });

    const rows = await allFuel(c);
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({
      kind: "gift",
      label: "birthday",
      text: "new text",
      url: null,
      created_at: NOW,
      modified_at: LATER,
    });
  });

  it("throws (rolls back) when the contactId does not match the row's contact", async () => {
    const c1 = await seedContact("Alex");
    const c2 = await seedContact("Blair");
    const id = await addFuel(exec, {
      uid: uid(),
      contactId: c1,
      kind: "topic",
      text: "keep me",
      createdAt: NOW,
      source: "user",
      now: NOW,
    });

    await expect(
      editFuel(exec, {
        id,
        contactId: c2,
        kind: "fact",
        label: null,
        text: "hijacked",
        url: null,
        now: LATER,
      }),
    ).rejects.toThrow();

    // The original row is untouched.
    const rows = await allFuel(c1);
    expect(rows[0]).toMatchObject({ kind: "topic", text: "keep me" });
  });
});

describe("deleteFuel — removes matching (id, contact_id), both-keys scoped", () => {
  it("deletes the matching row", async () => {
    const c = await seedContact();
    const id = await addFuel(exec, {
      uid: uid(),
      contactId: c,
      kind: "recent",
      text: "delete me",
      createdAt: NOW,
      source: "user",
      now: NOW,
    });

    await deleteFuel(exec, { id, contactId: c });

    const rows = await allFuel(c);
    expect(rows.length).toBe(0);
  });

  it("throws when the contactId does not match the row's contact (0 changes)", async () => {
    const c1 = await seedContact("Alex");
    const c2 = await seedContact("Blair");
    const id = await addFuel(exec, {
      uid: uid(),
      contactId: c1,
      kind: "topic",
      text: "keep me",
      createdAt: NOW,
      source: "user",
      now: NOW,
    });

    await expect(
      deleteFuel(exec, { id, contactId: c2 }),
    ).rejects.toThrow();

    const rows = await allFuel(c1);
    expect(rows.length).toBe(1);
  });
});

describe("addFuelCore — composes inside an open transaction, no own mutex", () => {
  it("inserts multiple rows inside ONE caller-opened inWriteTransaction (multi-attach fan-out)", async () => {
    const c = await seedContact();

    await inWriteTransaction(exec, async () => {
      await addFuelCore(exec, {
        uid: uid(),
        contactId: c,
        kind: "topic",
        text: "one",
        createdAt: NOW,
        source: "share",
        now: NOW,
      });
      await addFuelCore(exec, {
        uid: uid(),
        contactId: c,
        kind: "fact",
        text: "two",
        createdAt: NOW,
        source: "share",
        now: NOW,
      });
    });

    const rows = await allFuel(c);
    expect(rows.length).toBe(2);
    expect(rows.map((r) => r.text)).toEqual(["one", "two"]);
  });
});
