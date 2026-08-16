/**
 * notification-actions — behavioural proof of the exactly-once shared handler
 * (reviews H1 + H2, threat register T-11-BOOT / T-11-DUP / T-11-MUTEX).
 *
 * The handler is driven against a REAL in-memory `node:sqlite` DB through the
 * REAL mutexed DAOs (recordTouchpoint / snoozeContact), with `@/db/database`
 * mocked so `getExecutor()` returns that in-memory executor and `openAndMigrate`
 * is an observable no-op. expo-notifications is the manual double. This proves
 * end to end: the canonical mark/snooze writes, the decay cancel, unknown-action
 * inertness, the category-button `opensAppToForeground:false` flag, and — the H2
 * headline — that a re-delivered/replayed tap writes EXACTLY ONE row via BOTH
 * dedup layers (the in-process handledSet and the durable UNIQUE(uid) backstop).
 */
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

// A hoisted, mutable holder the mocked `@/db/database` reads — beforeEach swaps
// in a fresh in-memory executor per test (and openAndMigrate stays observable).
const h = vi.hoisted(() => ({
  exec: null as SqlExecutor | null,
  now: "2026-08-16 10:00:00",
  openAndMigrate: null as ReturnType<typeof Object> | null,
}));

vi.mock("expo-notifications");
vi.mock("@/db/database", () => {
  const openAndMigrate = vi.fn(async () => null);
  h.openAndMigrate = openAndMigrate;
  return {
    openAndMigrate,
    getExecutor: () => h.exec,
    localDateTime: () => h.now,
  };
});

import {
  ACTION_MARK,
  ACTION_SNOOZE,
  actionUid,
  DECAY_CATEGORY,
  decayIdentifier,
  type NotificationData,
} from "./notification-ids";

const CONTACT_ID = 1;
const DATA: NotificationData = {
  kind: "decay",
  contactId: CONTACT_ID,
  occurrenceKey: "2026-08-16",
};

let db: DatabaseSync;

/** Seed a fresh DB with migration 1 and one contact to act on. */
async function seed(): Promise<void> {
  db = openTestDb();
  const exec = nodeSqliteExecutor(db);
  let seedUidN = 0;
  await runMigrations(exec, [migration001], 1, {
    now: h.now,
    newUid: () => `seed-uid-${++seedUidN}`,
  });
  await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    ["c1", "Ada", 30, h.now, h.now],
  );
  h.exec = exec;
}

function interactionCount(): number {
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM interactions WHERE contact_id = ?")
    .get(CONTACT_ID) as { n: number };
  return row.n;
}

function snoozeEventCount(): number {
  const row = db
    .prepare(
      "SELECT COUNT(*) AS n FROM events WHERE contact_id = ? AND type = 'snooze'",
    )
    .get(CONTACT_ID) as { n: number };
  return row.n;
}

function firstInteraction(): {
  uid: string;
  source: string;
  direction: string | null;
  channel: string;
  connected: number;
  quality: string | null;
} {
  return db
    .prepare(
      "SELECT uid, source, direction, channel, connected, quality FROM interactions WHERE contact_id = ?",
    )
    .get(CONTACT_ID) as never;
}

function snoozeUntil(): string | null {
  const row = db
    .prepare("SELECT snooze_until FROM contacts WHERE id = ?")
    .get(CONTACT_ID) as { snooze_until: string | null };
  return row.snooze_until;
}

/**
 * Fresh module each test → handledSet starts empty (no cross-test bleed).
 * `resetModules` also re-instantiates the expo-notifications double, so the mock
 * refs are re-fetched here to point at the SAME instance the handler bound.
 */
async function freshHandler() {
  vi.resetModules();
  const mod = await import("./notification-actions");
  const notifs = await import("expo-notifications");
  return {
    ...mod,
    cancel: vi.mocked(notifs.cancelScheduledNotificationAsync),
    setCategory: vi.mocked(notifs.setNotificationCategoryAsync),
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  await seed();
});

afterEach(() => {
  db?.close();
});

describe("ensureNotificationCategories", () => {
  it("registers mark + snooze buttons, both opensAppToForeground:false (headless-reachable)", async () => {
    const { ensureNotificationCategories, setCategory } = await freshHandler();
    await ensureNotificationCategories();

    expect(setCategory).toHaveBeenCalledTimes(1);
    const [categoryId, actions] = setCategory.mock.calls[0];
    expect(categoryId).toBe(DECAY_CATEGORY);
    const ids = actions.map((a: { identifier: string }) => a.identifier);
    expect(ids).toEqual([ACTION_MARK, ACTION_SNOOZE]);
    for (const a of actions as {
      options?: { opensAppToForeground?: boolean };
    }[]) {
      expect(a.options?.opensAppToForeground).toBe(false);
    }
  });
});

describe("handleNotificationAction — mark", () => {
  it("bootstraps the DB (openAndMigrate before the write), writes the canonical touchpoint, and cancels the decay notification", async () => {
    const { handleNotificationAction, cancel } = await freshHandler();
    await handleNotificationAction(DATA, ACTION_MARK);

    // H1: the DB was bootstrapped before the write.
    expect(h.openAndMigrate).toHaveBeenCalledTimes(1);

    // Canonical one-tap values + the DETERMINISTIC uid (H2 — not a fresh uid).
    expect(interactionCount()).toBe(1);
    const row = firstInteraction();
    expect(row.uid).toBe(actionUid(ACTION_MARK, DATA));
    expect(row.source).toBe("notification");
    expect(row.direction).toBe("outbound");
    expect(row.channel).toBe("unspecified");
    expect(row.connected).toBe(1);
    expect(row.quality).toBeNull();

    expect(cancel).toHaveBeenCalledWith(decayIdentifier(CONTACT_ID));
  });
});

describe("handleNotificationAction — snooze", () => {
  it("snoozes +1 week via the snooze DAO with the deterministic uid, and cancels the decay notification", async () => {
    const { handleNotificationAction, cancel } = await freshHandler();
    await handleNotificationAction(DATA, ACTION_SNOOZE);

    expect(h.openAndMigrate).toHaveBeenCalledTimes(1);
    expect(snoozeEventCount()).toBe(1);
    // snooze_until is set to a future local date (SQLite-computed +7 days).
    expect(snoozeUntil()).not.toBeNull();
    // No touchpoint is written on a snooze.
    expect(interactionCount()).toBe(0);
    // The snooze event carries the deterministic uid.
    const ev = db
      .prepare(
        "SELECT uid FROM events WHERE contact_id = ? AND type = 'snooze'",
      )
      .get(CONTACT_ID) as { uid: string };
    expect(ev.uid).toBe(actionUid(ACTION_SNOOZE, DATA));

    expect(cancel).toHaveBeenCalledWith(decayIdentifier(CONTACT_ID));
  });
});

describe("handleNotificationAction — unknown action", () => {
  it("does nothing: no write, no cancel, no DB bootstrap", async () => {
    const { handleNotificationAction, cancel } = await freshHandler();
    await handleNotificationAction(DATA, "not-a-real-action");

    expect(interactionCount()).toBe(0);
    expect(snoozeEventCount()).toBe(0);
    expect(cancel).not.toHaveBeenCalled();
    expect(h.openAndMigrate).not.toHaveBeenCalled();
  });
});

describe("exactly-once (H2) — a re-delivered/replayed mark writes ONE row", () => {
  it("short-circuits a warm double-delivery on the in-process handledSet", async () => {
    const { handleNotificationAction } = await freshHandler();
    await handleNotificationAction(DATA, ACTION_MARK);
    await handleNotificationAction(DATA, ACTION_MARK); // same live process

    // Still exactly one interaction row — the second call never reached the DB.
    expect(interactionCount()).toBe(1);
  });

  it("swallows a COLD replay on the durable UNIQUE(uid) backstop (fresh process, empty handledSet)", async () => {
    // First process writes the row.
    const first = await freshHandler();
    await first.handleNotificationAction(DATA, ACTION_MARK);
    expect(interactionCount()).toBe(1);

    // A fresh module = a cold replay: empty handledSet, SAME DB + SAME uid.
    const second = await freshHandler();
    await second.handleNotificationAction(DATA, ACTION_MARK);

    // The DAO's UNIQUE(uid) collision was swallowed as a benign no-op: still ONE
    // row, and the already-acted notification is still cancelled.
    expect(interactionCount()).toBe(1);
    expect(second.cancel).toHaveBeenCalledWith(decayIdentifier(CONTACT_ID));
  });
});
