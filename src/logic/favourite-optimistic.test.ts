import { describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import type { DashboardRow } from "@/db/dashboard-read";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { setFavouriteRank } from "@/db/favourites-dao";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import {
  applyCommittedMembership,
  createFavouriteOptimisticStore,
} from "@/logic/favourite-optimistic";

const NOW = "2026-09-06 12:00:00";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function migratedExecutor(): Promise<SqlExecutor> {
  const exec = nodeSqliteExecutor(openTestDb());
  let uid = 0;
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: () => `favourite-optimistic-${++uid}`,
  });
  return exec;
}

async function seedContact(exec: SqlExecutor): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    ["favourite-optimistic-contact", "Alex", 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

describe("favourite optimistic reconciliation", () => {
  it("keeps a newer overlay when an older mutation settles", () => {
    const store = createFavouriteOptimisticStore();
    const first = store.begin(4, true);
    const second = store.begin(4, false);

    expect(store.resolve(4, first, "failure")).toBe("stale");
    expect(store.overlayFor(4)).toBe(false);
    expect(store.resolve(4, second, "failure")).toBe("applied");
    expect(store.overlayFor(4)).toBeUndefined();
  });

  it("overlays an in-flight choice across a stale base reload", () => {
    const store = createFavouriteOptimisticStore();
    const generation = store.begin(9, true);

    expect(store.overlayFor(9)).toBe(true);
    expect(store.resolve(9, generation, "success", true)).toBe("applied");
    expect(store.overlayFor(9)).toBeUndefined();
  });

  it("notifies subscribers with a new snapshot for begin and latest resolve", () => {
    const store = createFavouriteOptimisticStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const initial = store.getSnapshot();

    const generation = store.begin(2, true);
    const pending = store.getSnapshot();
    store.resolve(2, generation, "success", true);
    const settled = store.getSnapshot();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(pending).not.toBe(initial);
    expect(settled).not.toBe(pending);
    unsubscribe();
  });

  it("patches committed membership immutably so success remains visible without reload", () => {
    const rows = [{ id: 8, favourite_rank: null }] as DashboardRow[];
    const store = createFavouriteOptimisticStore();
    const generation = store.begin(8, true);

    const committed = applyCommittedMembership(rows, 8, true);
    expect(committed).not.toBe(rows);
    expect(committed[0]).not.toBe(rows[0]);
    expect(rows[0].favourite_rank).toBeNull();
    expect(committed[0].favourite_rank).not.toBeNull();
    expect(store.resolve(8, generation, "success")).toBe("applied");
    expect(store.overlayFor(8) ?? (committed[0].favourite_rank !== null)).toBe(true);

    expect(applyCommittedMembership(committed, 8, false)[0].favourite_rank).toBeNull();
  });

  it("keeps an older durable set after the latest clear rejects", async () => {
    const exec = await migratedExecutor();
    const contactId = await seedContact(exec);
    const store = createFavouriteOptimisticStore();
    const setGate = deferred<void>();
    const clearGate = deferred<void>();
    let rows = [{ id: contactId, favourite_rank: null }] as DashboardRow[];

    const setGeneration = store.begin(contactId, true);
    const clearGeneration = store.begin(contactId, false);
    const setWrite = setGate.promise.then(() =>
      setFavouriteRank(exec, contactId, NOW),
    );

    setGate.resolve();
    await setWrite;
    store.resolve(contactId, setGeneration, "success", true);
    rows = applyCommittedMembership(rows, contactId, true);

    expect(store.effectiveMembershipFor(contactId, rows[0].favourite_rank !== null)).toBe(false);
    expect(store.committedMembershipFor(contactId)).toBe(true);

    clearGate.reject(new Error("clear write failed"));
    await expect(clearGate.promise).rejects.toThrow("clear write failed");
    store.resolve(contactId, clearGeneration, "failure");

    expect(store.effectiveMembershipFor(contactId, rows[0].favourite_rank !== null)).toBe(true);
    await expect(
      exec.getFirstAsync<{ favourite_rank: number | null }>(
        "SELECT favourite_rank FROM contacts WHERE id = ?",
        [contactId],
      ),
    ).resolves.toMatchObject({ favourite_rank: expect.any(Number) });
  });

  it("keeps committed and optimistic memberships isolated per contact", () => {
    const store = createFavouriteOptimisticStore();
    const alexSet = store.begin(1, true);
    const alexClear = store.begin(1, false);
    const blairSet = store.begin(2, true);

    expect(store.resolve(1, alexSet, "success", true)).toBe("stale");
    expect(store.effectiveMembershipFor(1, false)).toBe(false);
    expect(store.effectiveMembershipFor(2, false)).toBe(true);

    expect(store.resolve(1, alexClear, "failure")).toBe("applied");
    expect(store.effectiveMembershipFor(1, false)).toBe(true);
    expect(store.effectiveMembershipFor(2, false)).toBe(true);
    expect(store.overlayFor(2)).toBe(true);
    expect(store.committedMembershipFor(2)).toBeUndefined();

    expect(store.resolve(2, blairSet, "success", true)).toBe("applied");
    expect(store.committedMembershipFor(2)).toBe(true);
  });
});
