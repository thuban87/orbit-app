/**
 * Single-writer recency DAO — behavioural proof (DATA-04).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture
 * and the REAL DAO, asserting the load-bearing recency invariant end to end:
 * last_contact is always MAX(occurred_at) over the contact's CURRENT rows
 * (never last-write-wins), connected-only for rarely_responds contacts, NULL
 * when no qualifying row exists, atomic on multi-row create, rolled back on
 * failure, serialized under concurrency, and byte-identical local wall-clock on
 * the timestamp round-trip (the DATA-05 status contract).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
import {
  createContactWithInteraction,
  deleteTouchpoint,
  editTouchpoint,
  recordTouchpoint,
} from "@/db/recency-dao";
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

async function lastContact(contactId: number): Promise<string | null> {
  const row = await exec.getFirstAsync<{ last_contact: string | null }>(
    "SELECT last_contact FROM contacts WHERE id = ?",
    [contactId],
  );
  return row?.last_contact ?? null;
}

async function interactionCount(contactId: number): Promise<number> {
  const row = await exec.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM interactions WHERE contact_id = ?",
    [contactId],
  );
  return row?.n ?? 0;
}

async function makeContact(rarelyResponds = 0): Promise<number> {
  const { contactId } = await createContactWithInteraction(exec, {
    uid: uid(),
    name: "Alex",
    intervalDays: 30,
    now: NOW,
    rarelyResponds,
  });
  return contactId;
}

describe("recency DAO — MAX recompute over current rows", () => {
  it("advances last_contact when a newer occurred_at is recorded", async () => {
    const c = await makeContact();
    expect(await lastContact(c)).toBeNull();

    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-06-01 10:00:00",
      now: NOW,
    });
    expect(await lastContact(c)).toBe("2026-06-01 10:00:00");

    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-07-01 10:00:00",
      now: NOW,
    });
    expect(await lastContact(c)).toBe("2026-07-01 10:00:00");
  });

  it("leaves last_contact unchanged when an OLDER occurred_at is recorded", async () => {
    const c = await makeContact();
    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-07-01 10:00:00",
      now: NOW,
    });
    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-05-01 10:00:00",
      now: NOW,
    });
    expect(await lastContact(c)).toBe("2026-07-01 10:00:00");
  });

  it("moves last_contact back to the next-highest row when an edit lowers the newest", async () => {
    const c = await makeContact();
    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-05-01 10:00:00",
      now: NOW,
    });
    const { interactionId } = await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-07-01 10:00:00",
      now: NOW,
    });
    expect(await lastContact(c)).toBe("2026-07-01 10:00:00");

    await editTouchpoint(exec, {
      interactionId,
      contactId: c,
      occurredAt: "2026-03-01 10:00:00",
      now: NOW,
    });
    // Correcting the newest row down must NOT keep its old value — recompute wins.
    expect(await lastContact(c)).toBe("2026-05-01 10:00:00");
  });

  it("recomputes to the remaining max when the newest row is deleted", async () => {
    const c = await makeContact();
    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-05-01 10:00:00",
      now: NOW,
    });
    const { interactionId } = await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-07-01 10:00:00",
      now: NOW,
    });
    await deleteTouchpoint(exec, { interactionId, contactId: c, now: NOW });
    expect(await lastContact(c)).toBe("2026-05-01 10:00:00");
  });

  it("sets last_contact NULL when the only interaction is deleted", async () => {
    const c = await makeContact();
    const { interactionId } = await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-05-01 10:00:00",
      now: NOW,
    });
    await deleteTouchpoint(exec, { interactionId, contactId: c, now: NOW });
    expect(await lastContact(c)).toBeNull();
  });
});

describe("recency DAO — connected-only filter for rarely_responds", () => {
  it("counts only connected rows and ignores a later non-connecting attempt", async () => {
    const c = await makeContact(1);
    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-05-01 10:00:00",
      now: NOW,
      connected: 1,
    });
    expect(await lastContact(c)).toBe("2026-05-01 10:00:00");

    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-08-01 10:00:00",
      now: NOW,
      connected: 0,
    });
    // A newer NON-connecting attempt does not move recency for a rarely_responds contact.
    expect(await lastContact(c)).toBe("2026-05-01 10:00:00");
  });

  it("keeps last_contact NULL for a rarely_responds contact with only non-connecting attempts", async () => {
    const c = await makeContact(1);
    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-05-01 10:00:00",
      now: NOW,
      connected: 0,
    });
    expect(await lastContact(c)).toBeNull();
  });

  it("counts non-connecting rows for a NORMAL (not rarely_responds) contact", async () => {
    const c = await makeContact(0);
    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-08-01 10:00:00",
      now: NOW,
      connected: 0,
    });
    expect(await lastContact(c)).toBe("2026-08-01 10:00:00");
  });
});

describe("recency DAO — createContactWithInteraction atomicity", () => {
  it("creates a contact and its first interaction in one step, setting last_contact", async () => {
    const { contactId, interactionId } = await createContactWithInteraction(
      exec,
      {
        uid: uid(),
        name: "Sam",
        intervalDays: 14,
        now: NOW,
        firstInteraction: { uid: uid(), occurredAt: "2026-08-10 09:00:00" },
      },
    );
    expect(interactionId).not.toBeNull();
    expect(await lastContact(contactId)).toBe("2026-08-10 09:00:00");
    expect(await interactionCount(contactId)).toBe(1);
  });

  it("writes no interaction and leaves last_contact NULL on the 'not yet / don't know' path", async () => {
    const { contactId, interactionId } = await createContactWithInteraction(
      exec,
      { uid: uid(), name: "Jo", intervalDays: 14, now: NOW },
    );
    expect(interactionId).toBeNull();
    expect(await lastContact(contactId)).toBeNull();
    expect(await interactionCount(contactId)).toBe(0);
  });
});

describe("recency DAO — intervalDays write-boundary guard (WR-02)", () => {
  it.each([0, -1, -30, 1.5, Number.NaN])(
    "rejects a non-positive / non-integer intervalDays (%p) and writes nothing",
    async (bad) => {
      await expect(
        createContactWithInteraction(exec, {
          uid: uid(),
          name: "Bad",
          intervalDays: bad,
          now: NOW,
        }),
      ).rejects.toThrow(/positive integer/);

      // The guard fires before the insert — no orphan contact row is created.
      const row = await exec.getFirstAsync<{ n: number }>(
        "SELECT COUNT(*) AS n FROM contacts",
      );
      expect(row?.n ?? 0).toBe(0);
    },
  );

  it("accepts a positive integer intervalDays", async () => {
    const { contactId } = await createContactWithInteraction(exec, {
      uid: uid(),
      name: "Good",
      intervalDays: 1,
      now: NOW,
    });
    expect(contactId).toBeGreaterThan(0);
  });
});

describe("recency DAO — rollback and serialization", () => {
  it("rolls back the whole write when the interaction insert fails", async () => {
    const c = await makeContact();
    const dupUid = uid();
    await recordTouchpoint(exec, {
      contactId: c,
      uid: dupUid,
      occurredAt: "2026-05-01 10:00:00",
      now: NOW,
    });
    expect(await lastContact(c)).toBe("2026-05-01 10:00:00");

    // Reusing the UNIQUE uid forces the INSERT to throw mid-transaction.
    await expect(
      recordTouchpoint(exec, {
        contactId: c,
        uid: dupUid,
        occurredAt: "2026-09-01 10:00:00",
        now: NOW,
      }),
    ).rejects.toThrow();

    // Neither the interaction row nor last_contact advanced.
    expect(await lastContact(c)).toBe("2026-05-01 10:00:00");
    expect(await interactionCount(c)).toBe(1);
  });

  it("serializes concurrent writes so both land and last_contact is the true MAX", async () => {
    const c = await makeContact();
    // Fire two writes without awaiting between them — the mutex must serialize
    // them (otherwise the second BEGIN nests inside the first transaction).
    const p1 = recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-06-01 10:00:00",
      now: NOW,
    });
    const p2 = recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-07-01 10:00:00",
      now: NOW,
    });
    await Promise.all([p1, p2]);

    expect(await interactionCount(c)).toBe(2);
    expect(await lastContact(c)).toBe("2026-07-01 10:00:00");
  });
});

describe("recency DAO — local wall-clock timestamp contract (DATA-05)", () => {
  it("round-trips occurred_at as the same local string, with no UTC day shift", async () => {
    const c = await makeContact();
    // An evening local time: a toISOString() conversion here would shift the day.
    const local = "2026-08-14 23:30:00";
    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: local,
      now: NOW,
    });
    const row = await exec.getFirstAsync<{ occurred_at: string }>(
      "SELECT occurred_at FROM interactions WHERE contact_id = ? ORDER BY id DESC LIMIT 1",
      [c],
    );
    expect(row?.occurred_at).toBe(local);
    // last_contact inherits the identical string — Phase-4 status reads it as-is.
    expect(await lastContact(c)).toBe(local);
  });
});
