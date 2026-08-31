/**
 * digest-schedule proof (DGST-01 — the Sunday WEEKLY alarm). Drives the REAL
 * `reconcileDigestSchedule` against a fresh in-memory node:sqlite DB (migrations
 * 001-005, v5 — getAppSettings SELECTs digest_enabled) + the dependency-free
 * `expo-notifications` double (11-01, made STATEFUL in 15-03), so the
 * schedule/idempotence/toggle/drift branches AND the H2 defer-one coordinator are
 * asserted without the native module.
 *
 * The digest is its OWN service + OWN sweep hook: this suite proves it schedules
 * exactly ONE `digest:weekly` WEEKLY trigger, converges idempotently across two
 * passes (the stateful mock makes that a real convergence proof, not a stub), and
 * that a stale overlapping pass can never re-arm a just-cancelled digest (H2/M4 —
 * a deterministic deferred-barrier test, NOT the timing-based coalescing analog).
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
import type { SqlExecutor } from "@/db/types";
import { __resetSweepForTest, runLaunchSweep } from "@/services/launch-sweep";
import {
  __reset as __resetExpo,
  __setScheduled,
  type ScheduledRequestDouble,
} from "../../../__mocks__/expo-notifications";
import {
  __resetDigestReconcileForTest,
  DIGEST_WEEKDAY,
  reconcileDigestSchedule,
  registerDigestScheduleSweep,
} from "./digest-schedule";
import {
  DIGEST_BODY,
  DIGEST_CHANNEL,
  DIGEST_IDENTIFIER,
  DIGEST_TITLE,
} from "./notification-ids";

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
  // Current schema: getAppSettings reads interaction-assist state added in v14.
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
    { now: NOW, newUid: uid, defaultPhoneRegion: "US" },
  );
  __resetExpo();
  __resetDigestReconcileForTest();
});

afterEach(() => {
  vi.clearAllMocks();
});

/** Enable the notifications master switch, merging any per-test settings patch. */
async function enable(
  patch: Parameters<typeof updateAppSettings>[1] = {},
): Promise<void> {
  await updateAppSettings(exec, { notificationsEnabled: 1, ...patch }, NOW);
}

/** The narrowed shape of a recorded scheduleNotificationAsync call. */
interface RecordedRequest {
  identifier: string;
  content: {
    title?: string;
    body?: string;
    autoDismiss?: boolean;
    data?: { kind?: string };
  };
  trigger: {
    type?: string;
    channelId?: string;
    weekday?: number;
    hour?: number;
    minute?: number;
  };
}

function recorded(): RecordedRequest[] {
  return scheduleMock.mock.calls.map((c) => c[0] as unknown as RecordedRequest);
}

/** The recorded schedule request for the digest id, if any. */
function scheduledDigest(): RecordedRequest | undefined {
  return recorded().find((r) => r.identifier === DIGEST_IDENTIFIER);
}

/** All identifiers passed to cancelScheduledNotificationAsync. */
function cancelledIds(): string[] {
  return cancelMock.mock.calls.map((c) => c[0] as string);
}

/** A present digest entry seeded into the "currently scheduled" set. */
function digestEntry(
  hour: number,
  weekday = DIGEST_WEEKDAY,
): ScheduledRequestDouble {
  return {
    identifier: DIGEST_IDENTIFIER,
    content: {
      title: DIGEST_TITLE,
      body: DIGEST_BODY,
      data: { kind: "digest" },
    },
    trigger: {
      channelId: DIGEST_CHANNEL,
      weekday,
      hour,
      minute: 0,
    },
  };
}

/** A manual-resolve deferred for the deterministic overlap barrier. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

// ============================================================================
// SCHEDULE + IDEMPOTENCE — the singleton WEEKLY trigger.
// ============================================================================

describe("reconcileDigestSchedule — schedule + idempotence", () => {
  it("schedules exactly ONE digest:weekly WEEKLY trigger when enabled & absent", async () => {
    await enable({ deliveryHour: 9 });

    await reconcileDigestSchedule(exec);

    const req = scheduledDigest();
    expect(req).toBeDefined();
    expect(scheduleMock).toHaveBeenCalledTimes(1);
    expect(req?.content.title).toBe(DIGEST_TITLE);
    expect(req?.content.body).toBe(DIGEST_BODY);
    expect(req?.content.data?.kind).toBe("digest");
    expect(req?.content.autoDismiss).toBe(true);
    expect(req?.trigger.channelId).toBe(DIGEST_CHANNEL);
    expect(req?.trigger.weekday).toBe(DIGEST_WEEKDAY);
    expect(req?.trigger.hour).toBe(9);
    expect(req?.trigger.minute).toBe(0);
  });

  it("is idempotent — two passes leave exactly one digest, second pass a no-op (M2)", async () => {
    await enable({ deliveryHour: 9 });

    await reconcileDigestSchedule(exec);
    await reconcileDigestSchedule(exec);

    // The stateful mock: pass 2 sees the digest present+matching and LEAVES it —
    // a real convergence proof, not a stub returning an id.
    expect(scheduleMock).toHaveBeenCalledTimes(1);
    expect(cancelMock).not.toHaveBeenCalled();
    const all = await getAllScheduledNotificationsAsync();
    expect(all.filter((e) => e.identifier === DIGEST_IDENTIFIER)).toHaveLength(
      1,
    );
  });
});

// ============================================================================
// TOGGLE + MASTER GATING — H1's settings transitions (node-testable proofs).
// ============================================================================

describe("reconcileDigestSchedule — toggle + master gating", () => {
  it("digest toggle OFF (master on): cancels a present digest:weekly", async () => {
    await enable({ digestEnabled: 0, deliveryHour: 9 });
    __setScheduled([digestEntry(9)]);

    await reconcileDigestSchedule(exec);

    expect(cancelledIds()).toContain(DIGEST_IDENTIFIER);
    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it("digest toggle ON (master on & absent): arms the default-on digest", async () => {
    await enable({ digestEnabled: 1, deliveryHour: 9 });

    await reconcileDigestSchedule(exec);

    expect(scheduledDigest()).toBeDefined();
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it("master OFF: cancels digest:weekly even with digestEnabled=1", async () => {
    // notificationsEnabled defaults 0; digestEnabled defaults 1. Do NOT enable().
    __setScheduled([digestEntry(9)]);

    await reconcileDigestSchedule(exec);

    expect(cancelledIds()).toContain(DIGEST_IDENTIFIER);
    expect(scheduleMock).not.toHaveBeenCalled();
  });
});

// ============================================================================
// DRIFT — delivery-hour / weekday change reschedules under the SAME id.
// ============================================================================

describe("reconcileDigestSchedule — delivery-hour / weekday drift", () => {
  it("cancels + reschedules under the SAME id when the delivery hour drifts", async () => {
    await enable({ deliveryHour: 10 });
    // Present at hour 9; desired is now hour 10 — same weekday, hour drift only.
    __setScheduled([digestEntry(9)]);

    await reconcileDigestSchedule(exec);

    expect(cancelledIds().filter((x) => x === DIGEST_IDENTIFIER)).toHaveLength(
      1,
    );
    const req = scheduledDigest();
    expect(req).toBeDefined();
    expect(req?.trigger.hour).toBe(10);
    expect(req?.trigger.weekday).toBe(DIGEST_WEEKDAY);
  });

  it("leaves a matching digest untouched (no cancel, no reschedule)", async () => {
    await enable({ deliveryHour: 9 });
    __setScheduled([digestEntry(9)]);

    await reconcileDigestSchedule(exec);

    expect(scheduleMock).not.toHaveBeenCalled();
    expect(cancelMock).not.toHaveBeenCalled();
  });
});

// ============================================================================
// H2 / M4 — defer-one coordinator via a DETERMINISTIC deferred barrier. A stale
// in-flight pass must NOT re-arm a digest that a newer settings write cancelled.
// ============================================================================

describe("reconcileDigestSchedule — defer-one coordinator (H2/M4)", () => {
  it("a stale pass never re-arms a digest the newest settings write cancelled", async () => {
    await enable({ digestEnabled: 1, deliveryHour: 9 }); // master on, digest ON, ABSENT

    // One-shot barrier: hold PASS 1 right AFTER its getAppSettings read (desired
    // ON) at its FIRST getAll, so the settings write below lands DURING pass 1.
    const barrier = deferred();
    getAllMock.mockImplementationOnce(async () => {
      await barrier.promise;
      return [];
    });

    // (1) fire-and-forget pass 1 — reads getAppSettings (desired ON), then BLOCKS.
    const p1 = reconcileDigestSchedule(exec);
    // (2) re-entrant call — the coordinator sees running, sets pending, returns
    //     SYNCHRONOUSLY without reading settings (coalesced trailing pass).
    const p2 = reconcileDigestSchedule(exec);
    // (3) commit the newer settings write: digest now OFF.
    await updateAppSettings(exec, { digestEnabled: 0 }, NOW);
    // (4) release pass 1.
    barrier.resolve();
    // (5) drain both.
    await Promise.all([p1, p2]);

    // The TRAILING pass re-read digestEnabled=0 and cancelled; the stale pass 1
    // never leaves it armed. Exactly one trailing pass ran after pass 1 (getAll
    // called twice total — an uncoordinated 2nd call would run a 3rd pass on
    // stale state and leave the digest ARMED).
    expect(cancelledIds()).toContain(DIGEST_IDENTIFIER);
    // Assert the pass count BEFORE any further getAll read (which would itself
    // increment the mock): exactly pass 1 + one trailing pass = two getAll calls.
    expect(getAllMock).toHaveBeenCalledTimes(2);
    const all = await getAllScheduledNotificationsAsync();
    expect(all.some((e) => e.identifier === DIGEST_IDENTIFIER)).toBe(false);
  });
});

// ============================================================================
// SWEEP REGISTRATION — one hook, import runs nothing.
// ============================================================================

describe("registerDigestScheduleSweep", () => {
  beforeEach(() => {
    __resetSweepForTest();
  });
  afterEach(() => {
    __resetSweepForTest();
  });

  it("pushes one hook that runs the digest reconcile on a launch sweep", async () => {
    await enable({ deliveryHour: 9 });

    registerDigestScheduleSweep(() => exec);
    await runLaunchSweep();

    expect(getAllMock).toHaveBeenCalled();
    expect(scheduledDigest()).toBeDefined();
  });
});
