/**
 * notification-schedule reconcile proof (NOTIF-01 pre-scheduling + NOTIF-04
 * birthday scheduling). Drives the REAL reconcile against a fresh in-memory
 * node:sqlite DB (migrations 001+002) + the dependency-free `expo-notifications`
 * double (11-01), so the full-request diff, horizon/cap bounding, stagger,
 * malformed-birthday guard, gating, and the cycle-3 DEFER-ONE coalescing are all
 * asserted without the native module.
 *
 * Dates are seeded RELATIVE to today (progress derives from the real
 * `date('now','localtime')` clock, like dashboard-read.test), and fire instants
 * are asserted at DAY + HOUR granularity so the per-contact stagger MINUTES never
 * make an assertion brittle.
 */
import {
  cancelScheduledNotificationAsync,
  getAllScheduledNotificationsAsync,
  scheduleNotificationAsync,
} from "expo-notifications";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { updateAppSettings } from "@/db/app-settings-dao";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import { __resetSweepForTest, runLaunchSweep } from "@/services/launch-sweep";
import { formatLocalDate } from "@/utils/dates";
import {
  __reset as __resetExpo,
  __setScheduled,
  type ScheduledRequestDouble,
} from "../../../__mocks__/expo-notifications";
import {
  BIRTHDAY_CHANNEL,
  birthdayBody,
  birthdayIdentifier,
  DECAY_CATEGORY,
  DECAY_PRIVATE_CHANNEL,
  DECAY_PUBLIC_CHANNEL,
  decayBody,
  decayIdentifier,
} from "./notification-ids";
import {
  __resetReconcileForTest,
  HORIZON_DAYS,
  MAX_SCHEDULED_NOTIFICATIONS,
  reconcileSchedule,
  registerNotificationScheduleSweep,
  requestsEqual,
  staggerFor,
} from "./notification-schedule";

vi.mock("expo-notifications");

const scheduleMock = vi.mocked(scheduleNotificationAsync);
const cancelMock = vi.mocked(cancelScheduledNotificationAsync);
const getAllMock = vi.mocked(getAllScheduledNotificationsAsync);

const NOW = "2026-08-16 12:00:00";
let exec: SqlExecutor;
let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;

beforeEach(async () => {
  uidCounter = 0;
  const db = openTestDb();
  exec = nodeSqliteExecutor(db);
  await runMigrations(exec, [migration001, migration002], 2, {
    now: NOW,
    newUid: uid,
  });
  __resetExpo();
  __resetReconcileForTest();
});

afterEach(() => {
  vi.clearAllMocks();
});

// --- date helpers (relative to today, matching the real localtime clock) ------

/** Local midnight `days` ahead of today. */
function dayAhead(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

/** Local `YYYY-MM-DD` `days` from today (negative = past). */
function dateOffset(days: number): string {
  return formatLocalDate(dayAhead(days));
}

/** `MM-DD` of the day `days` ahead — a birthday that recurs on that day. */
function birthdayMMDD(days: number): string {
  const d = dayAhead(days);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}-${day}`;
}

interface SeedOpts {
  name?: string;
  intervalDays?: number;
  lastContact?: string | null;
  snoozeUntil?: string | null;
  birthday?: string | null;
  rarelyResponds?: number;
  remindersOff?: number;
  archivedAt?: string | null;
}

/** Insert one contact, returning its row id. */
async function seedContact(o: SeedOpts = {}): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts
       (uid, name, interval_days, last_contact, snooze_until, birthday,
        rarely_responds, reminders_off, archived_at, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid(),
      o.name ?? "Alex",
      o.intervalDays ?? 30,
      o.lastContact ?? null,
      o.snoozeUntil ?? null,
      o.birthday ?? null,
      o.rarelyResponds ?? 0,
      o.remindersOff ?? 0,
      o.archivedAt ?? null,
      NOW,
      NOW,
    ],
  );
  return result.lastInsertRowId;
}

/** Enable notifications, merging any per-test settings patch. */
async function enable(
  patch: Parameters<typeof updateAppSettings>[1] = {},
): Promise<void> {
  await updateAppSettings(exec, { notificationsEnabled: 1, ...patch }, NOW);
}

/**
 * The narrowed shape of a recorded scheduleNotificationAsync call — the reconcile
 * always mints these facets, so the test reads them without expo's wide/optional
 * NotificationRequestInput union.
 */
interface RecordedRequest {
  identifier: string;
  content: {
    body?: string;
    categoryIdentifier?: string;
    autoDismiss?: boolean;
    data?: { kind?: string; contactId?: number; occurrenceKey?: string };
  };
  trigger: { channelId?: string; date?: number | Date };
}

/** Every recorded schedule request, narrowed. */
function recorded(): RecordedRequest[] {
  return scheduleMock.mock.calls.map((c) => c[0] as unknown as RecordedRequest);
}

/** The recorded schedule request for an identifier, if any. */
function scheduledFor(identifier: string): RecordedRequest | undefined {
  return recorded().find((r) => r.identifier === identifier);
}

/** All identifiers passed to scheduleNotificationAsync. */
function scheduledIds(): string[] {
  return recorded().map((r) => r.identifier);
}

/** All identifiers passed to cancelScheduledNotificationAsync. */
function cancelledIds(): string[] {
  return cancelMock.mock.calls.map((c) => c[0] as string);
}

/** Assert a scheduled request fires on `expected`'s day at `hour`. */
function expectFireDayHour(
  req: RecordedRequest | undefined,
  expected: Date,
  hour: number,
): void {
  const d = new Date(req?.trigger.date ?? Number.NaN);
  expect(d.getFullYear()).toBe(expected.getFullYear());
  expect(d.getMonth()).toBe(expected.getMonth());
  expect(d.getDate()).toBe(expected.getDate());
  expect(d.getHours()).toBe(hour);
}

// ============================================================================
// PRE-SCHEDULING (H5) — future occurrences, not only currently-overdue.
// ============================================================================

describe("reconcileSchedule — future pre-scheduling (H5)", () => {
  it("schedules a STABLE (not-yet-due) contact at its future due-date morning", async () => {
    await enable();
    // interval 30, contacted 10 days ago → due in 20 days (progress 0.33 = stable).
    const id = await seedContact({
      name: "Stable Sam",
      intervalDays: 30,
      lastContact: dateOffset(-10),
    });

    await reconcileSchedule(exec);

    const req = scheduledFor(decayIdentifier(id));
    expect(req).toBeDefined();
    expectFireDayHour(req, dayAhead(20), 9);
    expect(req?.content.body).toBe(decayBody("Stable Sam"));
    expect(req?.content.categoryIdentifier).toBe(DECAY_CATEGORY);
    expect(req?.content.autoDismiss).toBe(true);
    expect(req?.trigger.channelId).toBe(DECAY_PRIVATE_CHANNEL);
    expect(req?.content.data).toMatchObject({
      kind: "decay",
      contactId: id,
      occurrenceKey: formatLocalDate(dayAhead(20)),
    });
  });

  it("schedules a FUTURE-SNOOZED contact at/after the snooze, not during it", async () => {
    await enable();
    // Due in 20 days, but snoozed 25 days out → base = max = snooze (day+25).
    const id = await seedContact({
      name: "Snoozy",
      intervalDays: 30,
      lastContact: dateOffset(-10),
      snoozeUntil: dateOffset(25),
    });

    await reconcileSchedule(exec);

    const req = scheduledFor(decayIdentifier(id));
    expect(req).toBeDefined();
    expectFireDayHour(req, dayAhead(25), 9);
  });

  it("schedules a birthday NEXT WEEK on its day-of morning (no category)", async () => {
    await enable();
    // Never-contacted (excluded from decay) so ONLY the birthday schedules.
    const id = await seedContact({
      name: "Bday Bea",
      lastContact: null,
      birthday: birthdayMMDD(7),
    });

    await reconcileSchedule(exec);

    const req = scheduledFor(birthdayIdentifier(id));
    expect(req).toBeDefined();
    expectFireDayHour(req, dayAhead(7), 9);
    expect(req?.content.body).toBe(birthdayBody("Bday Bea"));
    expect(req?.content.categoryIdentifier).toBeUndefined();
    expect(req?.trigger.channelId).toBe(BIRTHDAY_CHANNEL);
    expect(req?.content.data).toMatchObject({
      kind: "birthday",
      contactId: id,
    });
    expect(scheduledFor(decayIdentifier(id))).toBeUndefined();
  });
});

// ============================================================================
// HORIZON + CAP (item A) + birthday reservation (cycle-3).
// ============================================================================

describe("reconcileSchedule — horizon + soonest-N cap (item A)", () => {
  it("does NOT schedule a contact whose next fire is beyond HORIZON_DAYS", async () => {
    await enable();
    // interval 120, contacted 30 days ago → due in 90 days (> HORIZON_DAYS=35),
    // progress 0.25 (< rogue) so it IS eligible but out of horizon this cycle.
    const id = await seedContact({
      name: "FarFuture",
      intervalDays: 120,
      lastContact: dateOffset(-30),
    });
    expect(HORIZON_DAYS).toBeLessThan(90);

    await reconcileSchedule(exec);

    expect(scheduledFor(decayIdentifier(id))).toBeUndefined();
    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it("schedules exactly MAX_SCHEDULED_NOTIFICATIONS soonest-firing when over the cap", async () => {
    await enable();
    // MAX soonest contacts due in 2 days + one LATER contact due in 30 days.
    const soonIds: number[] = [];
    for (let i = 0; i < MAX_SCHEDULED_NOTIFICATIONS; i++) {
      soonIds.push(
        await seedContact({
          name: `Soon ${i}`,
          intervalDays: 30,
          lastContact: dateOffset(-28), // due in ~2 days
        }),
      );
    }
    const lateId = await seedContact({
      name: "Late",
      intervalDays: 60,
      lastContact: dateOffset(-30), // due in 30 days (within horizon, later)
    });

    await reconcileSchedule(exec);

    expect(scheduleMock).toHaveBeenCalledTimes(MAX_SCHEDULED_NOTIFICATIONS);
    // The later-firing (but within-horizon) contact is dropped THIS cycle.
    expect(scheduledFor(decayIdentifier(lateId))).toBeUndefined();
    // Every soonest contact is armed.
    for (const id of soonIds) {
      expect(scheduledFor(decayIdentifier(id))).toBeDefined();
    }
  });

  it("RESERVES a within-horizon birthday inside the cap against a decay influx (cycle-3)", async () => {
    await enable();
    // MAX decay contacts firing SOONER than the birthday, plus one birthday.
    for (let i = 0; i < MAX_SCHEDULED_NOTIFICATIONS; i++) {
      await seedContact({
        name: `Decay ${i}`,
        intervalDays: 30,
        lastContact: dateOffset(-28), // due in ~2 days (sooner than the birthday)
      });
    }
    const bdayId = await seedContact({
      name: "Reserved Bday",
      lastContact: null,
      birthday: birthdayMMDD(20), // 20 days out — later than the decay influx
    });

    await reconcileSchedule(exec);

    // The birthday is scheduled despite MAX nearer-firing decay candidates.
    expect(scheduledFor(birthdayIdentifier(bdayId))).toBeDefined();
    expect(scheduleMock).toHaveBeenCalledTimes(MAX_SCHEDULED_NOTIFICATIONS);
  });
});

// ============================================================================
// STAGGER (item C) — per-contact minute, id-derived not index-derived.
// ============================================================================

describe("reconcileSchedule — deterministic stagger (item C)", () => {
  it("derives each contact's fire minute from its contactId, not its list position", async () => {
    await enable();
    const a = await seedContact({
      name: "A",
      intervalDays: 30,
      lastContact: dateOffset(-10),
    });
    const b = await seedContact({
      name: "B",
      intervalDays: 30,
      lastContact: dateOffset(-10),
    });

    await reconcileSchedule(exec);

    const reqA = scheduledFor(decayIdentifier(a));
    const reqB = scheduledFor(decayIdentifier(b));
    const minute = (r: RecordedRequest | undefined) =>
      new Date(r?.trigger.date ?? Number.NaN).getMinutes();
    // Minute equals staggerFor(id) — a pure function of the id (stable across
    // reconciles + independent of seed order), never the array index.
    expect(minute(reqA)).toBe(staggerFor(a));
    expect(minute(reqB)).toBe(staggerFor(b));
  });
});

// ============================================================================
// MALFORMED BIRTHDAY (item E) — Invalid-Date skip.
// ============================================================================

describe("reconcileSchedule — malformed birthday guard (item E)", () => {
  it("skips a calendar-invalid birthday but still schedules a valid one", async () => {
    await enable();
    const bad = await seedContact({
      name: "Bad Bday",
      lastContact: null,
      birthday: "2021-02-29", // non-leap year → daysUntilBirthday === null
    });
    const good = await seedContact({
      name: "Good Bday",
      lastContact: null,
      birthday: birthdayMMDD(5),
    });

    await reconcileSchedule(exec);

    expect(scheduledFor(birthdayIdentifier(bad))).toBeUndefined();
    expect(scheduledFor(birthdayIdentifier(good))).toBeDefined();
  });
});

// ============================================================================
// STALE CANCEL + full-request diff (H3 + items C/F).
// ============================================================================

describe("reconcileSchedule — stale cancel + full-request diff", () => {
  it("cancels a stale decay id and schedules the newly-eligible contact", async () => {
    await enable();
    const id = await seedContact({
      name: "Eligible",
      intervalDays: 30,
      lastContact: dateOffset(-10),
    });
    // A previously-scheduled id for a contact no longer eligible/present.
    __setScheduled([
      {
        identifier: decayIdentifier(999),
        content: {},
        trigger: {},
      },
    ]);

    await reconcileSchedule(exec);

    expect(cancelledIds()).toContain(decayIdentifier(999));
    expect(scheduledFor(decayIdentifier(id))).toBeDefined();
  });

  it("does NOT touch a non-owned identifier when master is off", async () => {
    // notifications default OFF — do not enable.
    __setScheduled([
      { identifier: decayIdentifier(1), content: {}, trigger: {} },
      { identifier: birthdayIdentifier(2), content: {}, trigger: {} },
      { identifier: "digest:daily", content: {}, trigger: {} },
    ]);

    await reconcileSchedule(exec);

    expect(cancelledIds()).toContain(decayIdentifier(1));
    expect(cancelledIds()).toContain(birthdayIdentifier(2));
    expect(cancelledIds()).not.toContain("digest:daily");
    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it("reschedules under the SAME id when the delivery hour crosses an HOUR (H3)", async () => {
    await enable({ deliveryHour: 10 });
    const id = await seedContact({
      name: "Timing",
      intervalDays: 30,
      lastContact: dateOffset(-10),
    });
    const day = dayAhead(20);
    // Already scheduled at 9am (matches everything except the hour, which is now
    // 10am) — the occurrenceKey (date-only) is unchanged, isolating the hour facet.
    __setScheduled([
      {
        identifier: decayIdentifier(id),
        content: {
          body: decayBody("Timing"),
          categoryIdentifier: DECAY_CATEGORY,
          data: {
            kind: "decay",
            contactId: id,
            occurrenceKey: formatLocalDate(day),
          },
        },
        trigger: {
          channelId: DECAY_PRIVATE_CHANNEL,
          date: new Date(
            day.getFullYear(),
            day.getMonth(),
            day.getDate(),
            9,
            0,
          ),
        },
      },
    ]);

    await reconcileSchedule(exec);

    expect(
      cancelledIds().filter((x) => x === decayIdentifier(id)),
    ).toHaveLength(1);
    expect(
      scheduledIds().filter((x) => x === decayIdentifier(id)),
    ).toHaveLength(1);
    expectFireDayHour(scheduledFor(decayIdentifier(id)), day, 10);
  });

  it("reschedules on a BODY diff alone when a contact is renamed (item F)", async () => {
    await enable();
    const id = await seedContact({
      name: "Samir", // renamed from "Sam"
      intervalDays: 30,
      lastContact: dateOffset(-10),
    });
    const day = dayAhead(20);
    __setScheduled([
      {
        identifier: decayIdentifier(id),
        content: {
          body: decayBody("Sam"), // stale frozen body
          categoryIdentifier: DECAY_CATEGORY,
          data: {
            kind: "decay",
            contactId: id,
            occurrenceKey: formatLocalDate(day),
          },
        },
        trigger: {
          channelId: DECAY_PRIVATE_CHANNEL,
          date: new Date(
            day.getFullYear(),
            day.getMonth(),
            day.getDate(),
            9,
            staggerFor(id),
          ),
        },
      },
    ]);

    await reconcileSchedule(exec);

    expect(cancelledIds()).toContain(decayIdentifier(id));
    expect(scheduledFor(decayIdentifier(id))?.content.body).toBe(
      decayBody("Samir"),
    );
  });

  it("leaves a differing-MINUTE-but-same-HOUR entry UNTOUCHED (item C invariance)", async () => {
    await enable();
    const id = await seedContact({
      name: "Steady",
      intervalDays: 30,
      lastContact: dateOffset(-10),
    });
    const day = dayAhead(20);
    // Same hour (9), a DIFFERENT stagger minute, everything else identical.
    __setScheduled([
      {
        identifier: decayIdentifier(id),
        content: {
          body: decayBody("Steady"),
          categoryIdentifier: DECAY_CATEGORY,
          data: {
            kind: "decay",
            contactId: id,
            occurrenceKey: formatLocalDate(day),
          },
        },
        trigger: {
          channelId: DECAY_PRIVATE_CHANNEL,
          date: new Date(
            day.getFullYear(),
            day.getMonth(),
            day.getDate(),
            9,
            staggerFor(id) + 3, // off-by-minutes, same hour
          ),
        },
      },
    ]);

    await reconcileSchedule(exec);

    expect(scheduleMock).not.toHaveBeenCalled();
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it("leaves an IDENTICAL request untouched (no cancel, no reschedule)", async () => {
    await enable();
    const id = await seedContact({
      name: "Same",
      intervalDays: 30,
      lastContact: dateOffset(-10),
    });
    const day = dayAhead(20);
    __setScheduled([
      {
        identifier: decayIdentifier(id),
        content: {
          body: decayBody("Same"),
          categoryIdentifier: DECAY_CATEGORY,
          data: {
            kind: "decay",
            contactId: id,
            occurrenceKey: formatLocalDate(day),
          },
        },
        trigger: {
          channelId: DECAY_PRIVATE_CHANNEL,
          date: new Date(
            day.getFullYear(),
            day.getMonth(),
            day.getDate(),
            9,
            staggerFor(id),
          ),
        },
      },
    ]);

    await reconcileSchedule(exec);

    expect(scheduleMock).not.toHaveBeenCalled();
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it("reschedules to the PUBLIC channel when lockscreen_public flips on", async () => {
    await enable({ lockscreenPublic: 1 });
    const id = await seedContact({
      name: "Public",
      intervalDays: 30,
      lastContact: dateOffset(-10),
    });
    const day = dayAhead(20);
    // Currently scheduled on the PRIVATE channel; desired is now PUBLIC.
    __setScheduled([
      {
        identifier: decayIdentifier(id),
        content: {
          body: decayBody("Public"),
          categoryIdentifier: DECAY_CATEGORY,
          data: {
            kind: "decay",
            contactId: id,
            occurrenceKey: formatLocalDate(day),
          },
        },
        trigger: {
          channelId: DECAY_PRIVATE_CHANNEL,
          date: new Date(
            day.getFullYear(),
            day.getMonth(),
            day.getDate(),
            9,
            staggerFor(id),
          ),
        },
      },
    ]);

    await reconcileSchedule(exec);

    expect(cancelledIds()).toContain(decayIdentifier(id));
    expect(scheduledFor(decayIdentifier(id))?.trigger.channelId).toBe(
      DECAY_PUBLIC_CHANNEL,
    );
  });
});

// ============================================================================
// GATING — master + per-type toggles.
// ============================================================================

describe("reconcileSchedule — gating", () => {
  it("cancels all owned ids and schedules nothing when notifications are off", async () => {
    // Default settings: notificationsEnabled = 0.
    await seedContact({
      name: "Eligible",
      intervalDays: 30,
      lastContact: dateOffset(-10),
    });
    __setScheduled([
      { identifier: decayIdentifier(5), content: {}, trigger: {} },
    ]);

    await reconcileSchedule(exec);

    expect(cancelledIds()).toContain(decayIdentifier(5));
    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it("schedules ONLY birthdays when decay is off but birthday is on", async () => {
    await enable({ decayEnabled: 0, birthdayEnabled: 1 });
    const decayId = await seedContact({
      name: "DecayOnly",
      intervalDays: 30,
      lastContact: dateOffset(-10),
    });
    const bdayId = await seedContact({
      name: "BdayOnly",
      lastContact: null,
      birthday: birthdayMMDD(5),
    });

    await reconcileSchedule(exec);

    expect(scheduledFor(decayIdentifier(decayId))).toBeUndefined();
    expect(scheduledFor(birthdayIdentifier(bdayId))).toBeDefined();
  });
});

// ============================================================================
// CYCLE-3 HIGH — self-coordinating DEFER-ONE (T-11-RACE).
// ============================================================================

describe("reconcileSchedule — DEFER-ONE coalescing (cycle-3)", () => {
  it("coalesces overlapping calls to one trailing pass reflecting the newest state", async () => {
    await enable();
    // Eligible + currently scheduled, so a stale reconcile would RE-ARM it.
    const id = await seedContact({
      name: "Racy",
      intervalDays: 30,
      lastContact: dateOffset(-10),
    });
    __setScheduled([
      { identifier: decayIdentifier(id), content: {}, trigger: {} },
    ]);

    // Fire two overlapping reconciles; the second coalesces (DEFER-ONE). Between
    // them, commit a far-future snooze so the contact falls OUT of the horizon.
    const p1 = reconcileSchedule(exec);
    const p2 = reconcileSchedule(exec);
    const mutate = exec.runAsync(
      "UPDATE contacts SET snooze_until = ? WHERE id = ?",
      [dateOffset(HORIZON_DAYS + 60), id],
    );
    await Promise.all([p1, p2, mutate]);

    // The trailing pass RE-READS the snoozed state → the decay id ends CANCELLED,
    // never re-armed. Exactly one trailing pass ran (two full passes total).
    expect(cancelledIds()).toContain(decayIdentifier(id));
    expect(scheduledFor(decayIdentifier(id))).toBeUndefined();
    expect(getAllMock).toHaveBeenCalledTimes(2);
  });
});

// ============================================================================
// SWEEP REGISTRATION — one hook, import runs nothing.
// ============================================================================

describe("registerNotificationScheduleSweep", () => {
  beforeEach(() => {
    __resetSweepForTest();
  });
  afterEach(() => {
    __resetSweepForTest();
  });

  it("pushes one hook that runs the reconcile on a launch sweep", async () => {
    await enable();
    const id = await seedContact({
      name: "Swept",
      intervalDays: 30,
      lastContact: dateOffset(-10),
    });

    registerNotificationScheduleSweep(() => exec);
    await runLaunchSweep();

    expect(getAllMock).toHaveBeenCalled();
    expect(scheduledFor(decayIdentifier(id))).toBeDefined();
  });
});

// ============================================================================
// requestsEqual — the diff helper directly.
// ============================================================================

describe("requestsEqual", () => {
  const day = new Date(2027, 0, 15, 9, 25);
  const base = {
    identifier: decayIdentifier(3),
    fireInstant: day,
    channelId: DECAY_PRIVATE_CHANNEL,
    categoryIdentifier: DECAY_CATEGORY,
    body: decayBody("X"),
    data: { kind: "decay" as const, contactId: 3, occurrenceKey: "2027-01-15" },
  };
  const existing: ScheduledRequestDouble = {
    identifier: decayIdentifier(3),
    content: {
      body: decayBody("X"),
      categoryIdentifier: DECAY_CATEGORY,
      data: { kind: "decay", contactId: 3, occurrenceKey: "2027-01-15" },
    },
    trigger: {
      channelId: DECAY_PRIVATE_CHANNEL,
      date: new Date(2027, 0, 15, 9, 5), // different minute, same hour
    },
  };

  it("is invariant to the stagger minute (same hour)", () => {
    expect(requestsEqual(base, existing)).toBe(true);
  });

  it("catches a delivery-hour change", () => {
    expect(
      requestsEqual(base, {
        ...existing,
        trigger: { ...existing.trigger, date: new Date(2027, 0, 15, 10, 5) },
      }),
    ).toBe(false);
  });

  it("catches a channel change", () => {
    expect(
      requestsEqual(base, {
        ...existing,
        trigger: { ...existing.trigger, channelId: DECAY_PUBLIC_CHANNEL },
      }),
    ).toBe(false);
  });

  it("catches a body change (rename)", () => {
    expect(
      requestsEqual(base, {
        ...existing,
        content: { ...existing.content, body: decayBody("Y") },
      }),
    ).toBe(false);
  });

  it("catches an occurrenceKey change", () => {
    expect(
      requestsEqual(base, {
        ...existing,
        content: {
          ...existing.content,
          data: { kind: "decay", contactId: 3, occurrenceKey: "2027-01-22" },
        },
      }),
    ).toBe(false);
  });

  it("treats a missing trigger date as a mismatch", () => {
    expect(
      requestsEqual(base, {
        ...existing,
        trigger: { channelId: base.channelId },
      }),
    ).toBe(false);
  });
});
