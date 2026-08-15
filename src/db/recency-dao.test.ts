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
  editTouchpointFull,
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

/**
 * Read one interaction's current editable columns — the refine form seeds the
 * full edit from the stored row, so tests that change a single field mirror that
 * by fetching the row and overriding just the field under test.
 */
async function readInteraction(interactionId: number): Promise<{
  occurred_at: string;
  channel: string;
  direction: string | null;
  connected: number;
  quality: string | null;
  note: string | null;
}> {
  const row = await exec.getFirstAsync<{
    occurred_at: string;
    channel: string;
    direction: string | null;
    connected: number;
    quality: string | null;
    note: string | null;
  }>(
    "SELECT occurred_at, channel, direction, connected, quality, note FROM interactions WHERE id = ?",
    [interactionId],
  );
  if (!row) throw new Error(`no interaction ${interactionId}`);
  return row;
}

/**
 * Apply a full edit seeded from the stored row plus the given overrides — the
 * production shape: the refine form always emits every editable column, so a
 * single-field change carries the unchanged siblings verbatim.
 */
async function editFull(
  interactionId: number,
  contactId: number,
  now: string,
  overrides: Partial<{
    occurredAt: string;
    channel: string;
    direction: string | null;
    connected: number;
    quality: string | null;
    note: string | null;
  }> = {},
): Promise<void> {
  const cur = await readInteraction(interactionId);
  await editTouchpointFull(exec, {
    interactionId,
    contactId,
    now,
    occurredAt: overrides.occurredAt ?? cur.occurred_at,
    channel: overrides.channel ?? cur.channel,
    direction:
      overrides.direction !== undefined ? overrides.direction : cur.direction,
    connected: overrides.connected ?? cur.connected,
    quality: overrides.quality !== undefined ? overrides.quality : cur.quality,
    note: overrides.note !== undefined ? overrides.note : cur.note,
  });
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

    await editFull(interactionId, c, NOW, {
      occurredAt: "2026-03-01 10:00:00",
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

describe("recency DAO — (id, contactId) scoping guards recency (WR-04)", () => {
  it("editTouchpointFull rejects a mismatched contactId and leaves the real contact's recency intact", async () => {
    const a = await makeContact();
    const { interactionId } = await recordTouchpoint(exec, {
      contactId: a,
      uid: uid(),
      occurredAt: "2026-07-01 10:00:00",
      now: NOW,
    });
    const b = await makeContact();

    // Edit A's interaction but claim it belongs to B: must fail loudly, not
    // silently leave A's last_contact stale while recomputing B.
    await expect(
      editTouchpointFull(exec, {
        interactionId,
        contactId: b,
        occurredAt: "2026-01-01 10:00:00",
        now: NOW,
        channel: "call",
        direction: "outbound",
        connected: 1,
        quality: null,
        note: null,
      }),
    ).rejects.toThrow(/no interaction matched/);

    // A's row and recency are untouched; B never had an interaction.
    const row = await exec.getFirstAsync<{ occurred_at: string }>(
      "SELECT occurred_at FROM interactions WHERE id = ?",
      [interactionId],
    );
    expect(row?.occurred_at).toBe("2026-07-01 10:00:00");
    expect(await lastContact(a)).toBe("2026-07-01 10:00:00");
    expect(await lastContact(b)).toBeNull();
  });

  it("deleteTouchpoint rejects a mismatched contactId and deletes nothing", async () => {
    const a = await makeContact();
    const { interactionId } = await recordTouchpoint(exec, {
      contactId: a,
      uid: uid(),
      occurredAt: "2026-07-01 10:00:00",
      now: NOW,
    });
    const b = await makeContact();

    await expect(
      deleteTouchpoint(exec, { interactionId, contactId: b, now: NOW }),
    ).rejects.toThrow(/no interaction matched/);

    // A's interaction still exists and its recency is intact.
    expect(await interactionCount(a)).toBe(1);
    expect(await lastContact(a)).toBe("2026-07-01 10:00:00");
  });

  it("editTouchpointFull still works for a correctly-paired (id, contactId)", async () => {
    const a = await makeContact();
    const { interactionId } = await recordTouchpoint(exec, {
      contactId: a,
      uid: uid(),
      occurredAt: "2026-07-01 10:00:00",
      now: NOW,
    });
    await editFull(interactionId, a, NOW, {
      occurredAt: "2026-08-01 10:00:00",
    });
    expect(await lastContact(a)).toBe("2026-08-01 10:00:00");
  });
});

describe("recency DAO — editTouchpointFull (single full edit path, LOG-01/02/04/06)", () => {
  it("updates every editable column for the matched (id, contactId) row", async () => {
    const c = await makeContact();
    const { interactionId } = await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-07-01 10:00:00",
      now: NOW,
      channel: "unspecified",
      direction: "outbound",
      connected: 1,
      quality: null,
      note: null,
    });

    await editTouchpointFull(exec, {
      interactionId,
      contactId: c,
      occurredAt: "2026-06-15 18:45:00",
      now: NOW,
      channel: "call",
      direction: "inbound",
      connected: 0,
      quality: "good",
      note: "caught up over the phone",
    });

    const row = await exec.getFirstAsync<{
      occurred_at: string;
      channel: string;
      direction: string | null;
      connected: number;
      quality: string | null;
      note: string | null;
      modified_at: string;
    }>(
      `SELECT occurred_at, channel, direction, connected, quality, note, modified_at
         FROM interactions WHERE id = ?`,
      [interactionId],
    );
    expect(row?.occurred_at).toBe("2026-06-15 18:45:00");
    expect(row?.channel).toBe("call");
    expect(row?.direction).toBe("inbound");
    expect(row?.connected).toBe(0);
    expect(row?.quality).toBe("good");
    expect(row?.note).toBe("caught up over the phone");
    expect(row?.modified_at).toBe(NOW);
    // Only interaction, connected=0 on a NORMAL contact still counts → recency
    // follows the edited occurred_at.
    expect(await lastContact(c)).toBe("2026-06-15 18:45:00");
  });

  it("a note-only edit (same occurred_at) leaves last_contact unchanged", async () => {
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

    // Change ONLY the note; occurred_at is carried verbatim → recompute is a
    // no-op MAX and recency does not move.
    await editFull(interactionId, c, NOW, { note: "added a detail" });
    expect(await lastContact(c)).toBe("2026-07-01 10:00:00");
    expect((await readInteraction(interactionId)).note).toBe("added a detail");
  });

  it("rejects a FUTURE occurredAt BEFORE the transaction: no row changed, last_contact unchanged", async () => {
    const c = await makeContact();
    const { interactionId } = await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-06-01 10:00:00",
      now: NOW,
    });
    expect(await lastContact(c)).toBe("2026-06-01 10:00:00");

    // A future occurred_at (relative to `now`) must reject at the guard, before
    // the transaction opens — the same LOG-06 invariant as the record path.
    await expect(
      editTouchpointFull(exec, {
        interactionId,
        contactId: c,
        occurredAt: "2026-09-01 10:00:00",
        now: NOW,
        channel: "call",
        direction: "outbound",
        connected: 1,
        quality: null,
        note: null,
      }),
    ).rejects.toThrow(/future/i);

    // Nothing changed — occurred_at and recency are untouched.
    expect((await readInteraction(interactionId)).occurred_at).toBe(
      "2026-06-01 10:00:00",
    );
    expect(await lastContact(c)).toBe("2026-06-01 10:00:00");
  });

  it("does not advance recency when a rarely_responds row is edited to connected=0", async () => {
    const c = await makeContact(1);
    // A connected row anchors recency.
    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-05-01 10:00:00",
      now: NOW,
      connected: 1,
    });
    // A later connected row that we will downgrade to a non-connecting attempt.
    const { interactionId } = await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-08-01 10:00:00",
      now: NOW,
      connected: 1,
    });
    expect(await lastContact(c)).toBe("2026-08-01 10:00:00");

    // Edit the later row to NOT-connected: on a rarely_responds contact the
    // filtered MAX drops it, so recency falls back to the earlier connected row.
    await editFull(interactionId, c, NOW, { connected: 0 });
    expect(await lastContact(c)).toBe("2026-05-01 10:00:00");
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

describe("recency DAO — one-tap record path (LOG-01 / LOG-06)", () => {
  it("rejects a future occurredAt BEFORE any transaction: no row written, last_contact unchanged", async () => {
    const c = await makeContact();
    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-06-01 10:00:00",
      now: NOW,
    });
    expect(await lastContact(c)).toBe("2026-06-01 10:00:00");
    expect(await interactionCount(c)).toBe(1);

    // A future occurred_at (relative to `now`) must reject at the guard, before
    // the transaction opens — otherwise PROGRESS_SQL goes negative and the
    // contact buckets 'stable' forever.
    await expect(
      recordTouchpoint(exec, {
        contactId: c,
        uid: uid(),
        occurredAt: "2026-09-01 10:00:00",
        now: NOW,
      }),
    ).rejects.toThrow(/future/i);

    // Nothing was written and recency did not move.
    expect(await interactionCount(c)).toBe(1);
    expect(await lastContact(c)).toBe("2026-06-01 10:00:00");
  });

  it("stores the one-tap defaults (outbound / unspecified / connected=1 / manual) verbatim and sets last_contact", async () => {
    const c = await makeContact();
    const occurred = "2026-08-14 09:15:00";
    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: occurred,
      now: NOW,
      channel: "unspecified",
      direction: "outbound",
      connected: 1,
      quality: null,
      source: "manual",
    });

    const row = await exec.getFirstAsync<{
      occurred_at: string;
      channel: string;
      direction: string | null;
      connected: number;
      quality: string | null;
      source: string;
    }>(
      `SELECT occurred_at, channel, direction, connected, quality, source
         FROM interactions WHERE contact_id = ? ORDER BY id DESC LIMIT 1`,
      [c],
    );
    expect(row?.occurred_at).toBe(occurred);
    expect(row?.channel).toBe("unspecified");
    expect(row?.direction).toBe("outbound");
    expect(row?.connected).toBe(1);
    expect(row?.quality).toBeNull();
    expect(row?.source).toBe("manual");
    expect(await lastContact(c)).toBe(occurred);
  });

  it("same-DATE, different-TIME taps make two distinct rows AND advance last_contact to the later time", async () => {
    const c = await makeContact();
    // Both times are BEFORE `now` (12:00) so the future guard allows them; the
    // later of the two (11:30) is what recency must advance to.
    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-08-14 09:00:00",
      now: NOW,
    });
    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-08-14 11:30:00",
      now: NOW,
    });
    expect(await interactionCount(c)).toBe(2);
    // MAX is over the FULL YYYY-MM-DD HH:MM:SS — a later same-day tap DOES move
    // the stored value (only date()-granular status is day-stable).
    expect(await lastContact(c)).toBe("2026-08-14 11:30:00");
  });

  it("identical-timestamp taps make two distinct rows; last_contact equals that timestamp", async () => {
    const c = await makeContact();
    const t = "2026-08-14 09:00:00";
    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: t,
      now: NOW,
    });
    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: t,
      now: NOW,
    });
    expect(await interactionCount(c)).toBe(2);
    // A second identical-timestamp tap does not move the stored MAX.
    expect(await lastContact(c)).toBe(t);
  });

  it("allows an occurredAt exactly equal to now (equal is not future)", async () => {
    const c = await makeContact();
    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: NOW,
      now: NOW,
    });
    expect(await interactionCount(c)).toBe(1);
    expect(await lastContact(c)).toBe(NOW);
  });
});

describe("recency DAO — local wall-clock timestamp contract (DATA-05)", () => {
  it("round-trips occurred_at as the same local string, with no UTC day shift", async () => {
    const c = await makeContact();
    // An evening local time: a toISOString() conversion here would shift the day.
    const local = "2026-08-14 23:30:00";
    // `now` is the NEXT morning so this evening occurred_at is in the PAST — the
    // future-date guard (rejectFutureOccurredAt) allows it, and the round-trip is
    // what we assert.
    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: local,
      now: "2026-08-15 08:00:00",
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
