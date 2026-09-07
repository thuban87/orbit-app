import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { getImpactInputs } from "@/db/impact-read";
import { runMigrations } from "@/db/migrations/runner";
import { readOrreryImpactInputsCore } from "@/db/orrery-impact-read";
import { readOrrerySystemSnapshotCore } from "@/db/orrery-system-read";
import { recordTouchpoint } from "@/db/recency-dao";
import {
  inReadSnapshot,
  inWriteTransaction,
  type ReadOnlyExecutor,
} from "@/db/transaction";
import { ALL_CONTACTS_SYSTEM } from "@/logic/orrery-system-logic";
import { computeContactGravity } from "@/services/impact";
import { loadOrreryScene } from "@/services/orrery-scene";
import { createOrrerySystemStore } from "@/stores/orrery-system-store";

vi.mock("expo-sqlite", () => ({}));
let db: ReturnType<typeof openTestDb>;
let exec: ReturnType<typeof nodeSqliteExecutor>;
const now = "2026-09-07 12:00:00";
beforeEach(async () => {
  db = openTestDb();
  exec = nodeSqliteExecutor(db);
  let uid = 0;
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now,
    newUid: () => `seed-${++uid}`,
    defaultPhoneRegion: "US",
  });
});
afterEach(() => db.close());
async function person(id: number, rarely = 0) {
  await exec.runAsync(
    "INSERT INTO contacts(id,uid,name,tracking_enabled,interval_days,rarely_responds,created_at,modified_at) VALUES (?,?,?,1,30,?,?,?)",
    [id, `person-${id}`, `Person ${id}`, rarely, now, now],
  );
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("batched canonical Gravity snapshot", () => {
  it("exactly matches complete single-reader history and Gravity, including ties, ancient/future rows and connected scope", async () => {
    for (const id of [1, 2, 3]) await person(id, id === 2 ? 1 : 0);
    for (const id of [1, 2])
      for (const [index, date] of [
        "1800-01-01",
        now,
        now,
        "2099-01-01",
      ].entries()) {
        await exec.runAsync(
          "INSERT INTO interactions(uid,contact_id,occurred_at,recorded_at,connected,direction,modified_at,source,channel) VALUES (?,?,?,?,?,?,?,'manual','unspecified')",
          [
            `i-${id}-${index}`,
            id,
            date,
            now,
            index % 2,
            ["inbound", "outbound", "mutual", null][index],
            now,
          ],
        );
      }
    const batch = await readOrreryImpactInputsCore(exec, [1, 2, 3, 999]);
    for (const id of [1, 2, 3]) {
      const single = (await getImpactInputs(exec, id))!;
      expect(batch.get(id)).toEqual(single);
      expect(computeContactGravity(batch.get(id)!, now)).toEqual(
        computeContactGravity(single, now),
      );
    }
    expect(batch.get(3)?.interactions).toEqual([]);
    expect(batch.has(999)).toBe(false);
    expect(batch.get(1)?.interactions).toHaveLength(4);
    expect(computeContactGravity(batch.get(1)!, now).raw).toBeGreaterThan(
      computeContactGravity(batch.get(2)!, now).raw,
    );
  });
  it.each([0, 1, 100, 256, 257, 513])(
    "uses exactly ceil(unique valid IDs / 256) bound SELECTs for %i IDs",
    async (count) => {
      const getAllAsync = vi.fn(exec.getAllAsync);
      const ro: ReadOnlyExecutor = {
        getAllAsync,
        getFirstAsync: exec.getFirstAsync,
      };
      const ids = Array.from({ length: count }, (_, i) => i + 1);
      await readOrreryImpactInputsCore(ro, [
        ...ids,
        ...ids,
        0,
        -1,
        1.5,
        Number.NaN,
        Number.POSITIVE_INFINITY,
      ]);
      expect(getAllAsync).toHaveBeenCalledTimes(Math.ceil(count / 256));
      for (const [sql, params] of getAllAsync.mock.calls) {
        expect(sql).toContain("LEFT JOIN interactions");
        expect(sql).not.toMatch(/LIMIT|occurred_at\s*[<>]/i);
        expect((sql.match(/\?/g) ?? []).length).toBe(params!.length);
        expect(params!.length).toBeLessThanOrEqual(256);
      }
    },
  );
  it("assembles members, global nonmember sun and full histories with only read capabilities and one outer transaction", async () => {
    await person(1);
    await person(2);
    await exec.runAsync("UPDATE app_settings SET sun_contact_id=2");
    const commands: string[] = [];
    const tracked = {
      ...exec,
      execAsync: async (sql: string) => {
        commands.push(sql);
        await exec.execAsync(sql);
      },
    };
    const snapshot = await inReadSnapshot(tracked, (ro) =>
      readOrrerySystemSnapshotCore(
        { getAllAsync: ro.getAllAsync, getFirstAsync: ro.getFirstAsync },
        ALL_CONTACTS_SYSTEM,
      ),
    );
    expect(commands).toEqual(["BEGIN", "COMMIT"]);
    expect([...snapshot.impactInputs.keys()]).toEqual([1, 2]);
  });
  it("holds policy/history coherent against a queued writer and rejects a cancelled queued generation before publication/persistence", async () => {
    await person(1);
    const entered = deferred(),
      release = deferred();
    const writer = inWriteTransaction(exec, async () => {
      entered.resolve();
      await release.promise;
      await exec.runAsync("UPDATE contacts SET rarely_responds=1 WHERE id=1");
    });
    await entered.promise;
    const persist = vi.fn(async () => true);
    const store = createOrrerySystemStore({
      load: (system, generation) => loadOrreryScene(exec, generation, system),
      persist,
    });
    const cancelled = store.getState().select(ALL_CONTACTS_SYSTEM);
    store.getState().cancel();
    expect(store.getState().current()).toBeNull();
    release.resolve();
    await writer;
    await cancelled;
    expect(persist).not.toHaveBeenCalled();
    expect(store.getState().snapshot).toBeNull();
    await recordTouchpoint(exec, {
      contactId: 1,
      uid: "connected",
      occurredAt: now,
      now,
      connected: 1,
    });
    await store.getState().reload();
    const live = store.getState().current()!;
    expect(live.systemSnapshot.impactInputs.get(1)?.rarelyResponds).toBe(1);
    expect(live.contacts[0].last_contact).toBe(now);
    expect(live.systemSnapshot.impactInputs.get(1)?.interactions).toHaveLength(
      1,
    );
    expect(persist).toHaveBeenCalledTimes(1);
  });
  it("keeps a queued recency writer outside an in-progress member/history snapshot", async () => {
    await person(1);
    const entered = deferred(),
      release = deferred();
    const pending = inReadSnapshot(exec, async (ro) => {
      const narrow: ReadOnlyExecutor = {
        getFirstAsync: ro.getFirstAsync,
        getAllAsync: async <T>(sql: string, params?: unknown[]) => {
          const result = await ro.getAllAsync<T>(sql, params);
          if (sql.includes("AS progress")) {
            entered.resolve();
            await release.promise;
          }
          return result;
        },
      };
      return readOrrerySystemSnapshotCore(narrow, ALL_CONTACTS_SYSTEM);
    });
    await entered.promise;
    const write = recordTouchpoint(exec, {
      contactId: 1,
      uid: "queued",
      occurredAt: now,
      now,
    });
    release.resolve();
    const before = await pending;
    await write;
    expect(before.members[0].last_contact).toBeNull();
    expect(before.impactInputs.get(1)?.interactions).toEqual([]);
    const after = await loadOrreryScene(exec);
    expect(after.contacts[0].last_contact).toBe(now);
    expect(after.systemSnapshot.impactInputs.get(1)?.interactions).toHaveLength(
      1,
    );
  });
});
