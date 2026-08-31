import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { createPendingAssist } from "@/db/interaction-assist-dao";
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
import { interactionAssistSweep } from "@/services/interaction-assist-sweep";
import {
  __resetSweepForTest,
  installSweepTrigger,
  registerSweepHook,
} from "@/services/launch-sweep";
import { subscribeAppState, useAssistBanner } from "@/stores/assist-store";

const mocks = vi.hoisted(() => ({ localDateTime: vi.fn() }));

vi.mock("@/db/database", () => ({
  localDateTime: mocks.localDateTime,
}));

const NOW = "2026-08-31 12:00:00";
const MIGRATIONS = [
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
];

const flush = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

function makeFakeAppState() {
  const listeners = new Set<(state: string) => void>();
  return {
    appState: {
      addEventListener(_type: "change", listener: (state: string) => void) {
        listeners.add(listener);
        return { remove: () => listeners.delete(listener) };
      },
    },
    fire(state: string) {
      for (const listener of listeners) listener(state);
    },
  };
}

async function openAssistDb(): Promise<SqlExecutor> {
  const exec = nodeSqliteExecutor(openTestDb());
  let uid = 0;
  await runMigrations(exec, MIGRATIONS, 14, {
    now: NOW,
    newUid: () => `sweep-${++uid}`,
  });
  return exec;
}

async function createContact(exec: SqlExecutor): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, 30, ?, ?)`,
    ["sweep-contact", "Sweep contact", NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function insertAssist(
  exec: SqlExecutor,
  input: {
    uid: string;
    contactId: number;
    status: string;
    handoffAt: string;
    resolvedAt?: string;
  },
): Promise<void> {
  await exec.runAsync(
    `INSERT INTO interaction_assists
     (uid, contact_id, channel, status, handoff_at, resolved_at, created_at, modified_at)
     VALUES (?, ?, 'call', ?, ?, ?, ?, ?)`,
    [
      input.uid,
      input.contactId,
      input.status,
      input.handoffAt,
      input.resolvedAt ?? null,
      NOW,
      NOW,
    ],
  );
}

beforeEach(() => {
  __resetSweepForTest();
  mocks.localDateTime.mockReturnValue(NOW);
});

afterEach(() => {
  __resetSweepForTest();
});

describe("interactionAssistSweep", () => {
  it("expires pending assists by handoff time and prunes only old terminal rows", async () => {
    const exec = await openAssistDb();
    const contactId = await createContact(exec);
    await insertAssist(exec, {
      uid: "expired-pending",
      contactId,
      status: "pending",
      handoffAt: "2026-08-30 11:59:59",
    });
    await insertAssist(exec, {
      uid: "fresh-pending",
      contactId,
      status: "pending",
      handoffAt: "2026-08-30 12:00:00",
    });
    await insertAssist(exec, {
      uid: "old-dismissed",
      contactId,
      status: "dismissed",
      handoffAt: "2026-07-01 12:00:00",
      resolvedAt: "2026-08-01 11:59:59",
    });
    await insertAssist(exec, {
      uid: "fresh-dismissed",
      contactId,
      status: "dismissed",
      handoffAt: "2026-07-01 12:00:00",
      resolvedAt: "2026-08-01 12:00:00",
    });

    await interactionAssistSweep(() => exec)();

    expect(
      await exec.getAllAsync<{ uid: string; status: string }>(
        "SELECT uid, status FROM interaction_assists ORDER BY uid",
      ),
    ).toEqual([
      { uid: "expired-pending", status: "expired" },
      { uid: "fresh-dismissed", status: "dismissed" },
      { uid: "fresh-pending", status: "pending" },
    ]);
    expect(await exec.getAllAsync("SELECT id FROM interactions")).toEqual([]);
  });

  it("composes cap-five expiry with sweep expiry without interaction writes", async () => {
    const exec = await openAssistDb();
    const contactId = await createContact(exec);
    for (let index = 0; index < 6; index += 1) {
      await createPendingAssist(exec, {
        contactId,
        channel: "call",
        endpointValue: "+15551234567",
        now: `2026-08-30 11:00:0${index}`,
      });
    }
    expect(
      await exec.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM interaction_assists WHERE status = 'pending'",
      ),
    ).toEqual({ count: 5 });

    await interactionAssistSweep(() => exec)();
    const afterFirst = await exec.getAllAsync<{
      status: string;
      resolved_at: string;
    }>("SELECT status, resolved_at FROM interaction_assists ORDER BY id");
    expect(afterFirst).toHaveLength(6);
    expect(afterFirst.every((row) => row.status === "expired")).toBe(true);
    await interactionAssistSweep(() => exec)();
    expect(
      await exec.getAllAsync<{ status: string; resolved_at: string }>(
        "SELECT status, resolved_at FROM interaction_assists ORDER BY id",
      ),
    ).toEqual(afterFirst);
    expect(await exec.getAllAsync("SELECT id FROM interactions")).toEqual([]);
  });

  it("keeps sweep and banner AppState subscriptions independent", async () => {
    const fake = makeFakeAppState();
    let sweepCalls = 0;
    let bannerRefreshes = 0;
    registerSweepHook(async () => {
      sweepCalls += 1;
    });
    useAssistBanner.setState({
      refresh: async () => {
        bannerRefreshes += 1;
      },
    });
    const sweepSubscription = installSweepTrigger(fake.appState);
    const bannerSubscription = subscribeAppState(fake.appState);
    await flush();
    expect(sweepCalls).toBe(1);
    expect(bannerRefreshes).toBe(0);

    fake.fire("inactive");
    fake.fire("active");
    await flush();
    expect(sweepCalls).toBe(1);
    expect(bannerRefreshes).toBe(0);

    fake.fire("background");
    fake.fire("active");
    await flush();
    expect(sweepCalls).toBe(2);
    expect(bannerRefreshes).toBe(1);
    sweepSubscription.remove();
    bannerSubscription.remove();
  });
});
