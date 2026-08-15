/**
 * Composed atomic-create DAO — behavioural proof (CRUD-01 / CRUD-02).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture
 * and the REAL `createContactFull`, asserting the load-bearing composition
 * behaviours end to end:
 *   - a Today create writes 1 contact + 1 interaction through the single-writer
 *     recompute (last_contact = the interaction's occurred_at; source='manual',
 *     direction=null — never outbound);
 *   - `phone` round-trips to `contacts.phone` (the CRUD-01 dropped-phone guard);
 *     email/social_battery/birthday stay create-excluded (edit-only);
 *   - the "not yet / don't know" path writes a contact-only row (last_contact
 *     NULL, 0 interactions);
 *   - a create + custom values COMPLETES (does not hang) writing both values
 *     under ONE per-contact uid — the Pitfall-1 non-reentrant-mutex deadlock
 *     guard;
 *   - a non-positive / non-integer intervalDays is rejected before any write;
 *   - a FUTURE firstInteraction.occurredAt is rejected before any transaction
 *     opens (CRUD-02 future-date guard at the DAO chokepoint);
 *   - a failure DURING the custom-value write rolls back the WHOLE composition
 *     (0 rows in contacts, interactions, contact_custom_values) — a sequential
 *     two-transaction impl would leave the contact + interaction committed and
 *     FAIL this assertion.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createContactFull } from "@/db/contacts-dao";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-14 12:00:00";

let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;

let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  const db = openTestDb();
  exec = nodeSqliteExecutor(db);
  await runMigrations(exec, [migration001], 1, { now: NOW, newUid: uid });
});

/** Add a value column directly (independent of Plan 03's createField DDL). */
async function addColumn(col: string): Promise<void> {
  await exec.execAsync(
    `ALTER TABLE contact_custom_values ADD COLUMN "${col}" TEXT`,
  );
}

async function lastContact(contactId: number): Promise<string | null> {
  const row = await exec.getFirstAsync<{ last_contact: string | null }>(
    "SELECT last_contact FROM contacts WHERE id = ?",
    [contactId],
  );
  return row?.last_contact ?? null;
}

async function phone(contactId: number): Promise<string | null> {
  const row = await exec.getFirstAsync<{ phone: string | null }>(
    "SELECT phone FROM contacts WHERE id = ?",
    [contactId],
  );
  return row?.phone ?? null;
}

async function contactCount(): Promise<number> {
  const row = await exec.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM contacts",
  );
  return row?.n ?? 0;
}

async function interactionCount(contactId: number): Promise<number> {
  const row = await exec.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM interactions WHERE contact_id = ?",
    [contactId],
  );
  return row?.n ?? 0;
}

async function totalInteractions(): Promise<number> {
  const row = await exec.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM interactions",
  );
  return row?.n ?? 0;
}

async function totalValueRows(): Promise<number> {
  const row = await exec.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM contact_custom_values",
  );
  return row?.n ?? 0;
}

describe("createContactFull — Today create composes contact + interaction", () => {
  it("writes 1 contact + 1 interaction, last_contact = occurred_at, source=manual, direction=null", async () => {
    const { contactId, interactionId } = await createContactFull(exec, {
      uid: uid(),
      name: "Sam",
      intervalDays: 14,
      now: NOW,
      firstInteraction: { uid: uid(), occurredAt: "2026-08-10 09:00:00" },
    });

    expect(interactionId).not.toBeNull();
    expect(await lastContact(contactId)).toBe("2026-08-10 09:00:00");
    expect(await interactionCount(contactId)).toBe(1);

    const row = await exec.getFirstAsync<{
      source: string;
      direction: string | null;
    }>("SELECT source, direction FROM interactions WHERE contact_id = ?", [
      contactId,
    ]);
    expect(row?.source).toBe("manual");
    expect(row?.direction).toBeNull();
  });
});

describe("createContactFull — phone round-trip (CRUD-01)", () => {
  it("persists a supplied phone to contacts.phone", async () => {
    const { contactId } = await createContactFull(exec, {
      uid: uid(),
      name: "Ravi",
      intervalDays: 30,
      now: NOW,
      phone: "+44 7700 900123",
    });
    expect(await phone(contactId)).toBe("+44 7700 900123");
  });

  it("stores NULL when no phone is supplied", async () => {
    const { contactId } = await createContactFull(exec, {
      uid: uid(),
      name: "Noa",
      intervalDays: 30,
      now: NOW,
    });
    expect(await phone(contactId)).toBeNull();
  });
});

describe("createContactFull — 'not yet / don't know' path", () => {
  it("writes a contact-only row with last_contact NULL and 0 interactions", async () => {
    const { contactId, interactionId } = await createContactFull(exec, {
      uid: uid(),
      name: "Jo",
      intervalDays: 14,
      now: NOW,
    });
    expect(interactionId).toBeNull();
    expect(await lastContact(contactId)).toBeNull();
    expect(await interactionCount(contactId)).toBe(0);
  });
});

describe("createContactFull — custom values compose without deadlock (Pitfall 1)", () => {
  it("completes (does not hang) writing both values under one per-contact uid", async () => {
    await addColumn("nickname");
    await addColumn("city");

    const { contactId } = await createContactFull(exec, {
      uid: uid(),
      name: "Mara",
      intervalDays: 21,
      now: NOW,
      firstInteraction: { uid: uid(), occurredAt: "2026-08-01 08:00:00" },
      customValues: [
        { col: "nickname", value: "M" },
        { col: "city", value: "Leeds" },
      ],
    });

    const row = await exec.getFirstAsync<{
      nickname: string | null;
      city: string | null;
      uid: string;
    }>(
      "SELECT nickname, city, uid FROM contact_custom_values WHERE contact_id = ?",
      [contactId],
    );
    expect(row?.nickname).toBe("M");
    expect(row?.city).toBe("Leeds");
    // Exactly ONE values row (one per-contact uid), both values on it.
    expect(await totalValueRows()).toBe(1);
    expect(typeof row?.uid).toBe("string");
  });
});

describe("createContactFull — pre-transaction guards", () => {
  it.each([0, -1, 1.5])(
    "rejects a non-positive / non-integer intervalDays (%p) and writes nothing",
    async (bad) => {
      await expect(
        createContactFull(exec, {
          uid: uid(),
          name: "Bad",
          intervalDays: bad,
          now: NOW,
        }),
      ).rejects.toThrow(/positive integer/);
      expect(await contactCount()).toBe(0);
    },
  );

  it("rejects a firstInteraction whose occurredAt is in the future (CRUD-02) and writes nothing", async () => {
    await expect(
      createContactFull(exec, {
        uid: uid(),
        name: "Future",
        intervalDays: 30,
        now: NOW,
        // occurredAt strictly after `now` (lexical > is chronological here).
        firstInteraction: { uid: uid(), occurredAt: "2026-08-14 12:00:01" },
      }),
    ).rejects.toThrow(/future|occurredAt|occurred_at/i);
    expect(await contactCount()).toBe(0);
  });

  it("accepts an occurredAt equal to now (boundary — not future)", async () => {
    const { contactId } = await createContactFull(exec, {
      uid: uid(),
      name: "Edge",
      intervalDays: 30,
      now: NOW,
      firstInteraction: { uid: uid(), occurredAt: NOW },
    });
    expect(await lastContact(contactId)).toBe(NOW);
  });
});

describe("createContactFull — mid-composition ROLLBACK (T-04-03 atomicity)", () => {
  it("rolls back contact + interaction + values when a custom-value write fails after the inserts", async () => {
    // The customValues col does NOT exist on contact_custom_values, so
    // upsertValueCore's INSERT throws AFTER the contact + interaction inserts.
    // A sequential two-transaction impl would leave the first two committed.
    await expect(
      createContactFull(exec, {
        uid: uid(),
        name: "Doomed",
        intervalDays: 30,
        now: NOW,
        firstInteraction: { uid: uid(), occurredAt: "2026-08-10 09:00:00" },
        customValues: [{ col: "no_such_column", value: "x" }],
      }),
    ).rejects.toThrow();

    // The WHOLE composition rolled back — nothing landed in any table.
    expect(await contactCount()).toBe(0);
    expect(await totalInteractions()).toBe(0);
    expect(await totalValueRows()).toBe(0);
  });
});
