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
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  archiveContact,
  createContactFull,
  listArchived,
  restoreContact,
  updateContactFull,
} from "@/db/contacts-dao";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
import { recordTouchpoint } from "@/db/recency-dao";
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

async function name(contactId: number): Promise<string | null> {
  const row = await exec.getFirstAsync<{ name: string }>(
    "SELECT name FROM contacts WHERE id = ?",
    [contactId],
  );
  return row?.name ?? null;
}

/** Read a snapshot of the mutable metadata columns for an edit round-trip. */
async function metadata(contactId: number): Promise<{
  name: string;
  category_id: number | null;
  interval_days: number;
  social_battery: string | null;
  birthday: string | null;
  phone: string | null;
  email: string | null;
  rarely_responds: number;
  reminders_off: number;
} | null> {
  return exec.getFirstAsync(
    `SELECT name, category_id, interval_days, social_battery, birthday, phone,
            email, rarely_responds, reminders_off
       FROM contacts WHERE id = ?`,
    [contactId],
  );
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

// =============================================================================
// Plan 05 — updateContactFull: metadata edit + rarely_responds recompute +
// first-interaction-on-edit + rollback.
// =============================================================================

const EDIT_NOW = "2026-08-15 10:00:00";

describe("updateContactFull — metadata edit (every col except last_contact)", () => {
  it("changes name/category/interval/phone/email/battery/birthday/reminders and leaves last_contact unchanged when rarely_responds is unchanged", async () => {
    const { contactId } = await createContactFull(exec, {
      uid: uid(),
      name: "Old",
      intervalDays: 14,
      now: NOW,
      firstInteraction: { uid: uid(), occurredAt: "2026-08-10 09:00:00" },
    });
    // last_contact is set by the create's first interaction.
    expect(await lastContact(contactId)).toBe("2026-08-10 09:00:00");

    await updateContactFull(exec, {
      id: contactId,
      name: "New Name",
      categoryId: 2,
      intervalDays: 30,
      socialBattery: "high",
      birthday: "03-14",
      phone: "+44 7700 900999",
      email: "new@example.com",
      rarelyResponds: 0, // unchanged (create default is 0)
      remindersOff: 1,
      now: EDIT_NOW,
    });

    const m = await metadata(contactId);
    expect(m?.name).toBe("New Name");
    expect(m?.category_id).toBe(2);
    expect(m?.interval_days).toBe(30);
    expect(m?.social_battery).toBe("high");
    expect(m?.birthday).toBe("03-14");
    expect(m?.phone).toBe("+44 7700 900999");
    expect(m?.email).toBe("new@example.com");
    expect(m?.reminders_off).toBe(1);
    // last_contact is NOT touched by the metadata edit (single-writer DATA-04).
    expect(await lastContact(contactId)).toBe("2026-08-10 09:00:00");
  });

  it("rejects a non-positive intervalDays before any write (guard mirrors create)", async () => {
    const { contactId } = await createContactFull(exec, {
      uid: uid(),
      name: "Guarded",
      intervalDays: 14,
      now: NOW,
    });
    await expect(
      updateContactFull(exec, {
        id: contactId,
        name: "Guarded",
        intervalDays: 0,
        rarelyResponds: 0,
        remindersOff: 0,
        now: EDIT_NOW,
      }),
    ).rejects.toThrow(/positive integer/);
    // Unchanged.
    expect((await metadata(contactId))?.interval_days).toBe(14);
  });
});

describe("updateContactFull — rarely_responds flip recomputes last_contact (Pitfall 2)", () => {
  it("flipping 1→0 recomputes last_contact to MAX over ALL rows", async () => {
    // rarely_responds contact: one connected (older) + one non-connected (newer).
    const { contactId } = await createContactFull(exec, {
      uid: uid(),
      name: "Rarely",
      intervalDays: 14,
      now: NOW,
      rarelyResponds: 1,
      firstInteraction: {
        uid: uid(),
        occurredAt: "2026-08-01 09:00:00",
        connected: 1,
      },
    });
    // A newer, NON-connected attempt — does not advance recency while flag is on.
    await recordTouchpoint(exec, {
      contactId,
      uid: uid(),
      occurredAt: "2026-08-10 09:00:00",
      now: NOW,
      connected: 0,
    });
    // With the flag ON, last_contact is the connected row only.
    expect(await lastContact(contactId)).toBe("2026-08-01 09:00:00");

    // Flip 1→0: now ALL rows count → MAX is the newer non-connected row.
    await updateContactFull(exec, {
      id: contactId,
      name: "Rarely",
      intervalDays: 14,
      rarelyResponds: 0,
      remindersOff: 0,
      now: EDIT_NOW,
    });
    expect(await lastContact(contactId)).toBe("2026-08-10 09:00:00");
  });

  it("flipping 0→1 recomputes last_contact to MAX over connected rows only", async () => {
    // rarely_responds OFF: one connected (older) + one non-connected (newer).
    const { contactId } = await createContactFull(exec, {
      uid: uid(),
      name: "Normal",
      intervalDays: 14,
      now: NOW,
      rarelyResponds: 0,
      firstInteraction: {
        uid: uid(),
        occurredAt: "2026-08-01 09:00:00",
        connected: 1,
      },
    });
    await recordTouchpoint(exec, {
      contactId,
      uid: uid(),
      occurredAt: "2026-08-10 09:00:00",
      now: NOW,
      connected: 0,
    });
    // With the flag OFF, last_contact is the newest row regardless of connected.
    expect(await lastContact(contactId)).toBe("2026-08-10 09:00:00");

    // Flip 0→1: connected-only → MAX falls back to the older connected row.
    await updateContactFull(exec, {
      id: contactId,
      name: "Normal",
      intervalDays: 14,
      rarelyResponds: 1,
      remindersOff: 0,
      now: EDIT_NOW,
    });
    expect(await lastContact(contactId)).toBe("2026-08-01 09:00:00");
  });
});

describe("updateContactFull — first-interaction-on-edit (owner ruling 2026-08-14)", () => {
  it("writes a FIRST interaction (source=manual, direction=null) for a never-contacted contact and sets last_contact via the single writer", async () => {
    // "Not yet" create → last_contact NULL, 0 interactions.
    const { contactId } = await createContactFull(exec, {
      uid: uid(),
      name: "NotYet",
      intervalDays: 14,
      now: NOW,
    });
    expect(await lastContact(contactId)).toBeNull();
    expect(await interactionCount(contactId)).toBe(0);

    await updateContactFull(exec, {
      id: contactId,
      name: "NotYet",
      intervalDays: 14,
      rarelyResponds: 0,
      remindersOff: 0,
      now: EDIT_NOW,
      firstInteraction: { uid: uid(), occurredAt: "2026-08-12 08:00:00" },
    });

    expect(await interactionCount(contactId)).toBe(1);
    expect(await lastContact(contactId)).toBe("2026-08-12 08:00:00");
    const row = await exec.getFirstAsync<{
      source: string;
      direction: string | null;
    }>("SELECT source, direction FROM interactions WHERE contact_id = ?", [
      contactId,
    ]);
    expect(row?.source).toBe("manual");
    expect(row?.direction).toBeNull();
  });

  it("rejects a firstInteraction for an ALREADY-CONTACTED contact and rolls back (no new interaction, metadata unchanged)", async () => {
    const { contactId } = await createContactFull(exec, {
      uid: uid(),
      name: "AlreadyContacted",
      intervalDays: 14,
      now: NOW,
      firstInteraction: { uid: uid(), occurredAt: "2026-08-10 09:00:00" },
    });
    expect(await interactionCount(contactId)).toBe(1);

    await expect(
      updateContactFull(exec, {
        id: contactId,
        name: "Renamed", // would-be metadata change, must roll back
        intervalDays: 14,
        rarelyResponds: 0,
        remindersOff: 0,
        now: EDIT_NOW,
        firstInteraction: { uid: uid(), occurredAt: "2026-08-11 09:00:00" },
      }),
    ).rejects.toThrow();

    // No second interaction, last_contact untouched, name unchanged (rollback).
    expect(await interactionCount(contactId)).toBe(1);
    expect(await lastContact(contactId)).toBe("2026-08-10 09:00:00");
    expect(await name(contactId)).toBe("AlreadyContacted");
  });

  it("rejects a firstInteraction whose occurredAt is in the future before any transaction opens", async () => {
    const { contactId } = await createContactFull(exec, {
      uid: uid(),
      name: "FutureEdit",
      intervalDays: 14,
      now: NOW,
    });
    await expect(
      updateContactFull(exec, {
        id: contactId,
        name: "FutureEdit",
        intervalDays: 14,
        rarelyResponds: 0,
        remindersOff: 0,
        now: EDIT_NOW,
        // occurredAt strictly after `now` (lexical > is chronological here).
        firstInteraction: { uid: uid(), occurredAt: "2026-08-15 10:00:01" },
      }),
    ).rejects.toThrow(/future|occurredAt|occurred_at/i);
    // Nothing written.
    expect(await interactionCount(contactId)).toBe(0);
    expect(await lastContact(contactId)).toBeNull();
  });
});

describe("updateContactFull — mid-composition ROLLBACK (T-04-03 atomicity)", () => {
  it("rolls back the metadata UPDATE when a custom-value write fails after it", async () => {
    const { contactId } = await createContactFull(exec, {
      uid: uid(),
      name: "Original",
      intervalDays: 14,
      now: NOW,
    });

    await expect(
      updateContactFull(exec, {
        id: contactId,
        name: "Changed", // the metadata UPDATE runs BEFORE the failing value write
        intervalDays: 14,
        rarelyResponds: 0,
        remindersOff: 0,
        now: EDIT_NOW,
        customValues: [{ col: "no_such_column", value: "x" }],
      }),
    ).rejects.toThrow();

    // A sequential two-transaction impl would leave name = "Changed".
    expect(await name(contactId)).toBe("Original");
  });
});

describe("updateContactFull — custom values compose without deadlock (Pitfall 1, edit side)", () => {
  it("writes custom values in the same call without hanging", async () => {
    await addColumn("nickname");
    const { contactId } = await createContactFull(exec, {
      uid: uid(),
      name: "WithValues",
      intervalDays: 14,
      now: NOW,
    });

    await updateContactFull(exec, {
      id: contactId,
      name: "WithValues",
      intervalDays: 14,
      rarelyResponds: 0,
      remindersOff: 0,
      now: EDIT_NOW,
      customValues: [{ col: "nickname", value: "Nick" }],
    });

    const row = await exec.getFirstAsync<{ nickname: string | null }>(
      "SELECT nickname FROM contact_custom_values WHERE contact_id = ?",
      [contactId],
    );
    expect(row?.nickname).toBe("Nick");
    expect(await totalValueRows()).toBe(1);
  });
});

// =============================================================================
// Plan 08 — archiveContact / restoreContact / listArchived: the reversible
// half of the two-stage lifecycle (CRUD-05). Archive flips archived_at (hides
// from every live read); restore nulls it; listArchived is the sole inverse
// read (archived_at IS NOT NULL). Neither touches last_contact.
// =============================================================================

const ARCHIVE_NOW = "2026-08-16 09:00:00";

async function archivedAt(contactId: number): Promise<string | null> {
  const row = await exec.getFirstAsync<{ archived_at: string | null }>(
    "SELECT archived_at FROM contacts WHERE id = ?",
    [contactId],
  );
  return row?.archived_at ?? null;
}

/** The live-contact predicate STATUS_SCAN / isDuplicateName share — Pitfall 4. */
async function liveNameMatches(name: string): Promise<number> {
  const row = await exec.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM contacts WHERE name = ? AND archived_at IS NULL",
    [name],
  );
  return row?.n ?? 0;
}

describe("archiveContact — flips archived_at, hides from live reads", () => {
  it("sets archived_at, drops the contact from an archived_at IS NULL read, and surfaces it in listArchived", async () => {
    const { contactId } = await createContactFull(exec, {
      uid: uid(),
      name: "Chris",
      intervalDays: 14,
      now: NOW,
      firstInteraction: { uid: uid(), occurredAt: "2026-08-10 09:00:00" },
    });
    // Live before archive.
    expect(await liveNameMatches("Chris")).toBe(1);

    await archiveContact(exec, contactId, ARCHIVE_NOW);

    expect(await archivedAt(contactId)).toBe(ARCHIVE_NOW);
    // Pitfall 4: an archived row no longer satisfies the live predicate.
    expect(await liveNameMatches("Chris")).toBe(0);
    // It IS the inverse read now.
    const archived = await listArchived(exec);
    expect(archived.map((r) => r.id)).toContain(contactId);
  });

  it("does NOT touch last_contact", async () => {
    const { contactId } = await createContactFull(exec, {
      uid: uid(),
      name: "Keeps",
      intervalDays: 14,
      now: NOW,
      firstInteraction: { uid: uid(), occurredAt: "2026-08-10 09:00:00" },
    });
    expect(await lastContact(contactId)).toBe("2026-08-10 09:00:00");

    await archiveContact(exec, contactId, ARCHIVE_NOW);

    expect(await lastContact(contactId)).toBe("2026-08-10 09:00:00");
  });

  it("throws (→ rollback) for a non-matching id and writes nothing", async () => {
    await expect(archiveContact(exec, 9999, ARCHIVE_NOW)).rejects.toThrow();
    expect((await listArchived(exec)).length).toBe(0);
  });
});

describe("restoreContact — nulls archived_at, returns to live reads", () => {
  it("clears archived_at so the contact reappears in a live read and leaves listArchived", async () => {
    const { contactId } = await createContactFull(exec, {
      uid: uid(),
      name: "Back",
      intervalDays: 14,
      now: NOW,
      firstInteraction: { uid: uid(), occurredAt: "2026-08-10 09:00:00" },
    });
    await archiveContact(exec, contactId, ARCHIVE_NOW);
    expect(await liveNameMatches("Back")).toBe(0);

    await restoreContact(exec, contactId, "2026-08-17 09:00:00");

    expect(await archivedAt(contactId)).toBeNull();
    expect(await liveNameMatches("Back")).toBe(1);
    expect((await listArchived(exec)).map((r) => r.id)).not.toContain(
      contactId,
    );
  });

  it("does NOT touch last_contact", async () => {
    const { contactId } = await createContactFull(exec, {
      uid: uid(),
      name: "RestoreKeeps",
      intervalDays: 14,
      now: NOW,
      firstInteraction: { uid: uid(), occurredAt: "2026-08-10 09:00:00" },
    });
    await archiveContact(exec, contactId, ARCHIVE_NOW);

    await restoreContact(exec, contactId, "2026-08-17 09:00:00");

    expect(await lastContact(contactId)).toBe("2026-08-10 09:00:00");
  });

  it("throws (→ rollback) for a non-matching id", async () => {
    await expect(
      restoreContact(exec, 9999, "2026-08-17 09:00:00"),
    ).rejects.toThrow();
  });
});

describe("archiveContact — same-name archived contact stays hidden from the live predicate (Pitfall 4)", () => {
  it("an archived contact does not collide with a same-name live duplicate check", async () => {
    const { contactId: first } = await createContactFull(exec, {
      uid: uid(),
      name: "Sam Lee",
      intervalDays: 14,
      now: NOW,
    });
    await archiveContact(exec, first, ARCHIVE_NOW);

    // A new live contact reusing the archived one's name: the live predicate
    // sees ONLY the live row, never the archived namesake.
    await createContactFull(exec, {
      uid: uid(),
      name: "Sam Lee",
      intervalDays: 14,
      now: NOW,
    });
    expect(await liveNameMatches("Sam Lee")).toBe(1);
  });
});

describe("listArchived — inverse read, most-recently-archived first", () => {
  it("returns only archived contacts ordered by archived_at DESC", async () => {
    const { contactId: a } = await createContactFull(exec, {
      uid: uid(),
      name: "Ada",
      intervalDays: 14,
      now: NOW,
    });
    const { contactId: b } = await createContactFull(exec, {
      uid: uid(),
      name: "Bo",
      intervalDays: 14,
      now: NOW,
    });
    const { contactId: c } = await createContactFull(exec, {
      uid: uid(),
      name: "Cy",
      intervalDays: 14,
      now: NOW,
    });
    // c never archived → must NOT appear.
    await archiveContact(exec, a, "2026-08-16 09:00:00");
    await archiveContact(exec, b, "2026-08-18 09:00:00"); // newer

    const archived = await listArchived(exec);
    expect(archived.map((r) => r.id)).toEqual([b, a]); // DESC: newer first
    expect(archived.map((r) => r.id)).not.toContain(c);
    // Shape: id + name + archived_at.
    expect(archived[0]).toMatchObject({ id: b, name: "Bo" });
    expect(archived[0]?.archived_at).toBe("2026-08-18 09:00:00");
  });

  it("returns an empty array when nothing is archived", async () => {
    await createContactFull(exec, {
      uid: uid(),
      name: "Live",
      intervalDays: 14,
      now: NOW,
    });
    expect(await listArchived(exec)).toEqual([]);
  });
});
