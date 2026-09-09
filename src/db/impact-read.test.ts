/**
 * impact-read DAO — behavioural proof (LOG-03 read half).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture
 * and the REAL DAOs, asserting the shared impact-inputs read that feeds BOTH
 * gravity (Plan 05) and intensity (Plan 06): the contact's interval_days +
 * rarely_responds and its interaction rows (occurred_at / connected / direction),
 * ordered occurred_at DESC, id DESC for determinism; other contacts' rows
 * excluded; empty-interactions and missing-contact cases handled without throwing.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { getImpactInputs } from "@/db/impact-read";
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
import {
  createContactWithInteraction,
  recordTouchpoint,
} from "@/db/recency-dao";
import type { SqlExecutor } from "@/db/types";
import type { ReadOnlyExecutor } from "@/db/transaction";

const NOW = "2026-08-14 12:00:00";

let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;

let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
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
      migration009,
      migration010,
      migration011,
    ],
    11,
    { now: NOW, newUid: uid, defaultPhoneRegion: "US" },
  );
});

async function makeContact(
  intervalDays = 30,
  rarelyResponds = 0,
): Promise<number> {
  const { contactId } = await createContactWithInteraction(exec, {
    uid: uid(),
    name: "Alex",
    intervalDays,
    now: NOW,
    rarelyResponds,
  });
  return contactId;
}

describe("getImpactInputs — the shared impact-inputs read", () => {
  it("accepts the structurally read-only snapshot executor", async () => {
    const c = await makeContact();
    const readOnly: ReadOnlyExecutor = {
      getFirstAsync: exec.getFirstAsync.bind(exec),
      getAllAsync: exec.getAllAsync.bind(exec),
    };
    expect(await getImpactInputs(readOnly, c)).toMatchObject({ interactions: [] });
  });
  it("returns Bound lifecycle, intervalDays, and rarelyResponds for the contact", async () => {
    const c = await makeContact(45, 1);
    const inputs = await getImpactInputs(exec, c);
    expect(inputs).not.toBeNull();
    expect(inputs?.trackingEnabled).toBe(1);
    expect(inputs?.intervalDays).toBe(45);
    expect(inputs?.rarelyResponds).toBe(1);
  });

  it("retains a dormant-cadence Unbound contact's gravity/history inputs without a cadence reinterpretation", async () => {
    const c = await makeContact(45, 1);
    await exec.runAsync(
      "UPDATE contacts SET tracking_enabled = 0 WHERE id = ?",
      [c],
    );
    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-06-01 10:00:00",
      now: NOW,
      direction: "outbound",
      connected: 1,
    });

    expect(await getImpactInputs(exec, c)).toMatchObject({
      trackingEnabled: 0,
      intervalDays: 45,
      interactions: [
        {
          occurredAt: "2026-06-01 10:00:00",
          connected: 1,
          direction: "outbound",
        },
      ],
    });
  });

  it("retains a never-assigned Unbound contact's gravity/history inputs with nullable cadence", async () => {
    const inserted = await exec.runAsync(
      `INSERT INTO contacts
         (uid, name, interval_days, tracking_enabled, rarely_responds, created_at, modified_at)
       VALUES (?, 'Never assigned', NULL, 0, 0, ?, ?)`,
      [uid(), NOW, NOW],
    );
    const c = inserted.lastInsertRowId;
    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-06-01 10:00:00",
      now: NOW,
      direction: "mutual",
      connected: 1,
    });

    expect(await getImpactInputs(exec, c)).toMatchObject({
      trackingEnabled: 0,
      intervalDays: null,
      interactions: [
        {
          occurredAt: "2026-06-01 10:00:00",
          direction: "mutual",
        },
      ],
    });
  });

  it("returns the interaction rows with occurredAt / connected / direction", async () => {
    const c = await makeContact();
    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-06-01 10:00:00",
      now: NOW,
      direction: "outbound",
      connected: 1,
    });
    const inputs = await getImpactInputs(exec, c);
    expect(inputs?.interactions).toEqual([
      {
        occurredAt: "2026-06-01 10:00:00",
        connected: 1,
        direction: "outbound",
      },
    ]);
  });

  it("orders interactions occurred_at DESC, id DESC (newest first, deterministic ties)", async () => {
    const c = await makeContact();
    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-05-01 10:00:00",
      now: NOW,
    });
    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-07-01 10:00:00",
      now: NOW,
    });
    // Two identical timestamps — the tiebreak is id DESC (later-inserted first).
    const tie = "2026-06-15 09:00:00";
    const { interactionId: firstTie } = await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: tie,
      now: NOW,
    });
    const { interactionId: secondTie } = await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: tie,
      now: NOW,
    });
    expect(secondTie).toBeGreaterThan(firstTie);

    const inputs = await getImpactInputs(exec, c);
    const stamps = inputs?.interactions.map((r) => r.occurredAt);
    expect(stamps).toEqual([
      "2026-07-01 10:00:00",
      tie,
      tie,
      "2026-05-01 10:00:00",
    ]);
    // The tie is broken by id DESC: the second-inserted row precedes the first.
    expect(inputs?.interactions[1]).toBeDefined();
  });

  it("excludes rows belonging to other contacts (contact_id is ?-bound)", async () => {
    const a = await makeContact();
    const b = await makeContact();
    await recordTouchpoint(exec, {
      contactId: a,
      uid: uid(),
      occurredAt: "2026-06-01 10:00:00",
      now: NOW,
    });
    await recordTouchpoint(exec, {
      contactId: b,
      uid: uid(),
      occurredAt: "2026-06-02 10:00:00",
      now: NOW,
    });
    const inputs = await getImpactInputs(exec, a);
    expect(inputs?.interactions).toHaveLength(1);
    expect(inputs?.interactions[0]?.occurredAt).toBe("2026-06-01 10:00:00");
  });

  it("returns an empty interactions array for a contact with no interactions (never throws)", async () => {
    const c = await makeContact();
    const inputs = await getImpactInputs(exec, c);
    expect(inputs).not.toBeNull();
    expect(inputs?.interactions).toEqual([]);
  });

  it("returns null for a missing contact id", async () => {
    const inputs = await getImpactInputs(exec, 999999);
    expect(inputs).toBeNull();
  });

  it("returns policy + interactions together as one consistent snapshot (MED-2 shape unchanged)", async () => {
    // The single LEFT JOIN must still yield the exact ImpactInputs shape both
    // gravity and intensity consume: policy fields from the contact row, plus the
    // full interaction list, from ONE read.
    const c = await makeContact(45, 1);
    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-05-01 10:00:00",
      now: NOW,
      direction: "outbound",
      connected: 1,
    });
    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-07-01 10:00:00",
      now: NOW,
      direction: "mutual",
      connected: 0,
    });
    const inputs = await getImpactInputs(exec, c);
    expect(inputs).toEqual({
      trackingEnabled: 1,
      intervalDays: 45,
      rarelyResponds: 1,
      interactions: [
        {
          occurredAt: "2026-07-01 10:00:00",
          connected: 0,
          direction: "mutual",
        },
        {
          occurredAt: "2026-05-01 10:00:00",
          connected: 1,
          direction: "outbound",
        },
      ],
    });
  });

  it("preserves a null direction (the DAO does not coerce it)", async () => {
    const c = await makeContact();
    // recordTouchpoint defaults direction to null when not passed.
    await recordTouchpoint(exec, {
      contactId: c,
      uid: uid(),
      occurredAt: "2026-06-01 10:00:00",
      now: NOW,
    });
    const inputs = await getImpactInputs(exec, c);
    expect(inputs?.interactions[0]?.direction).toBeNull();
  });
});
