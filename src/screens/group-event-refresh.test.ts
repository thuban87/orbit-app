import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { confirmMultiSelection } from "@/components/contact-picker-multiselect";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { addParticipants, createGroupEvent } from "@/db/group-events-dao";
import {
  type GroupEventDetail,
  type GroupEventParticipant,
  readGroupEventDetail,
} from "@/db/group-events-read";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import {
  createGroupEventRefreshController,
  excludedParticipantIds,
  type GroupEventEditState,
  groupEventEditReducer,
  initialGroupEventEditState,
  runParticipantAdd,
} from "./group-event-refresh";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function participant(
  contactId: number,
  overrides: Partial<GroupEventParticipant> = {},
): GroupEventParticipant {
  return {
    interactionId: contactId * 10,
    contactId,
    contactName: `Contact ${contactId}`,
    contactPhoto: null,
    channel: "In Person",
    quality: null,
    duration: null,
    direction: null,
    connected: 1,
    geFollowChannel: 1,
    geFollowQuality: 1,
    geFollowDuration: 1,
    note: null,
    allowAi: 0,
    ...overrides,
  };
}

function detail(
  participants: GroupEventParticipant[],
  overrides: Partial<GroupEventDetail> = {},
): GroupEventDetail {
  return {
    id: 1,
    uid: "event-uid",
    title: "Supper",
    occurredAt: "2026-09-20 18:00:00",
    channel: "In Person",
    quality: "Positive",
    duration: 3600,
    groupNote: "Saved note",
    participants,
    ...overrides,
  };
}

function reduceAll(
  state: GroupEventEditState,
  actions: Parameters<typeof groupEventEditReducer>[1][],
): GroupEventEditState {
  return actions.reduce(groupEventEditReducer, state);
}

describe("runParticipantAdd — commit vs refresh (D-19, reliability-testing/AUD-REL-008)", () => {
  it("resolves as a picker success when the add commits but the refresh read fails, reporting the refresh failure once", async () => {
    const add = vi.fn(async () => undefined);
    const onCommitted = vi.fn();
    const onRefreshed = vi.fn();
    const onRefreshFailed = vi.fn();
    const read = vi.fn(async (): Promise<GroupEventDetail | null> => {
      throw new Error("read failed");
    });
    const controller = createGroupEventRefreshController({
      read,
      onRefreshed,
      onRefreshFailed,
    });

    await expect(
      runParticipantAdd({ add, onCommitted, refresh: controller.refresh }),
    ).resolves.toBeUndefined();
    await vi.waitFor(() => expect(onRefreshFailed).toHaveBeenCalledTimes(1));

    expect(add).toHaveBeenCalledTimes(1);
    expect(onCommitted).toHaveBeenCalledTimes(1);
    expect(onRefreshed).not.toHaveBeenCalled();
  });

  it("Retry only re-reads: the add is never replayed and a successful read clears the refresh error and pending ids", async () => {
    let state = groupEventEditReducer(initialGroupEventEditState, {
      type: "initialLoaded",
      event: detail([participant(1)]),
    });
    const dispatch = (action: Parameters<typeof groupEventEditReducer>[1]) => {
      state = groupEventEditReducer(state, action);
    };
    const add = vi.fn(async () => undefined);
    let failNext = true;
    const read = vi.fn(async () => {
      if (failNext) {
        failNext = false;
        throw new Error("read failed");
      }
      return detail([participant(1), participant(2)]);
    });
    const controller = createGroupEventRefreshController({
      read,
      onRefreshed: (event) => dispatch({ type: "eventRefreshed", event }),
      onRefreshFailed: () => dispatch({ type: "refreshFailed" }),
    });

    await runParticipantAdd({
      add,
      onCommitted: () =>
        dispatch({ type: "participantsCommitted", contactIds: [2] }),
      refresh: controller.refresh,
    });
    await vi.waitFor(() => expect(state.refreshError).toBe(true));
    expect(state.committedPendingIds).toEqual([2]);

    await controller.refresh();

    expect(add).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(2);
    expect(state.refreshError).toBe(false);
    expect(state.committedPendingIds).toEqual([]);
    expect(state.event?.participants.map((p) => p.contactId)).toEqual([1, 2]);
  });

  it("propagates a genuine add failure so the picker stays open, and never refreshes", async () => {
    const onCommitted = vi.fn();
    const refresh = vi.fn(async () => undefined);

    await expect(
      runParticipantAdd({
        add: async () => {
          throw new Error("write failed");
        },
        onCommitted,
        refresh,
      }),
    ).rejects.toThrow("write failed");
    expect(onCommitted).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();

    await expect(
      confirmMultiSelection(new Set([4]), (contactIds) =>
        runParticipantAdd({
          add: async () => {
            throw new Error(`write failed for ${contactIds.join(",")}`);
          },
          onCommitted,
          refresh,
        }),
      ),
    ).resolves.toEqual({ ok: false, contactIds: [4] });
  });

  it("keeps committed ids excluded from the picker until a successful refresh, even over a stale event", () => {
    const stale = detail([participant(1)]);
    let state = reduceAll(initialGroupEventEditState, [
      { type: "initialLoaded", event: stale },
      { type: "participantsCommitted", contactIds: [2, 3] },
    ]);
    expect(excludedParticipantIds(state.event, state.committedPendingIds)).toEqual(
      [1, 2, 3],
    );

    state = groupEventEditReducer(state, { type: "refreshFailed" });
    expect(excludedParticipantIds(state.event, state.committedPendingIds)).toEqual(
      [1, 2, 3],
    );

    state = groupEventEditReducer(state, {
      type: "eventRefreshed",
      event: detail([participant(1), participant(2), participant(3)]),
    });
    expect(state.committedPendingIds).toEqual([]);
    expect(excludedParticipantIds(state.event, state.committedPendingIds)).toEqual(
      [1, 2, 3],
    );
    expect(excludedParticipantIds(null, [])).toEqual([]);
  });

  it("applies only the latest of two overlapping refreshes, including a stale failure", async () => {
    const first = deferred<GroupEventDetail | null>();
    const second = deferred<GroupEventDetail | null>();
    const reads = [first, second];
    const onRefreshed = vi.fn();
    const onRefreshFailed = vi.fn();
    const controller = createGroupEventRefreshController({
      read: () => {
        const next = reads.shift();
        if (!next) throw new Error("unexpected read");
        return next.promise;
      },
      onRefreshed,
      onRefreshFailed,
    });

    const olderRun = controller.refresh();
    const newerRun = controller.refresh();
    const newer = detail([participant(1), participant(2)]);
    second.resolve(newer);
    await newerRun;
    first.resolve(detail([participant(1)]));
    await olderRun;

    expect(onRefreshed).toHaveBeenCalledTimes(1);
    expect(onRefreshed).toHaveBeenCalledWith(newer);

    const third = deferred<GroupEventDetail | null>();
    const fourth = deferred<GroupEventDetail | null>();
    reads.push(third, fourth);
    const staleFailure = controller.refresh();
    const fresh = controller.refresh();
    fourth.resolve(newer);
    await fresh;
    third.reject(new Error("stale read failed"));
    await staleFailure;

    expect(onRefreshFailed).not.toHaveBeenCalled();
    expect(onRefreshed).toHaveBeenCalledTimes(2);
  });

  it("publishes nothing after invalidate() (unmount)", async () => {
    const pending = deferred<GroupEventDetail | null>();
    const onRefreshed = vi.fn();
    const onRefreshFailed = vi.fn();
    const controller = createGroupEventRefreshController({
      read: () => pending.promise,
      onRefreshed,
      onRefreshFailed,
    });

    const run = controller.refresh();
    controller.invalidate();
    pending.resolve(detail([]));
    await run;

    expect(onRefreshed).not.toHaveBeenCalled();
    expect(onRefreshFailed).not.toHaveBeenCalled();
  });

  it("treats a vanished event (null read) as a refresh failure, not a success", async () => {
    const onRefreshed = vi.fn();
    const onRefreshFailed = vi.fn();
    const controller = createGroupEventRefreshController({
      read: async () => null,
      onRefreshed,
      onRefreshFailed,
    });

    await controller.refresh();

    expect(onRefreshed).not.toHaveBeenCalled();
    expect(onRefreshFailed).toHaveBeenCalledTimes(1);
  });
});

describe("runParticipantAdd against node-sqlite (T-38.3-06-01)", () => {
  const NOW = "2026-09-25 12:00:00";
  let exec: SqlExecutor;
  let counter = 0;
  const uid = () => `group-event-refresh-${++counter}`;

  beforeEach(async () => {
    counter = 0;
    exec = nodeSqliteExecutor(openTestDb());
    await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
      now: NOW,
      newUid: uid,
    });
  });

  async function contact(name: string): Promise<number> {
    const result = await exec.runAsync(
      "INSERT INTO contacts (uid, name, interval_days, created_at, modified_at) VALUES (?, ?, 30, ?, ?)",
      [uid(), name, NOW, NOW],
    );
    return result.lastInsertRowId;
  }

  async function childCount(
    groupEventId: number,
    contactId: number,
  ): Promise<number> {
    const row = await exec.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM interactions WHERE group_event_id = ? AND contact_id = ?",
      [groupEventId, contactId],
    );
    return row?.n ?? 0;
  }

  it("a committed add, a failed refresh and a Retry leave exactly one child per added contact", async () => {
    const alex = await contact("Alex");
    const blair = await contact("Blair");
    const casey = await contact("Casey");
    const { groupEventId } = await createGroupEvent(exec, {
      uid: uid(),
      title: "Supper",
      occurredAt: "2026-09-20 18:00:00",
      now: NOW,
      participants: [{ contactId: alex, uid: uid() }],
    });
    const initial = await readGroupEventDetail(exec, { groupEventId });
    if (!initial) throw new Error("missing event");

    let state = groupEventEditReducer(initialGroupEventEditState, {
      type: "initialLoaded",
      event: initial,
    });
    const dispatch = (action: Parameters<typeof groupEventEditReducer>[1]) => {
      state = groupEventEditReducer(state, action);
    };
    let failReads = 1;
    const addSpy = vi.fn((contactIds: number[]) =>
      addParticipants(exec, {
        groupEventId,
        participants: contactIds.map((contactId) => ({
          contactId,
          uid: uid(),
        })),
        now: NOW,
      }),
    );
    const controller = createGroupEventRefreshController({
      read: async () => {
        if (failReads > 0) {
          failReads -= 1;
          throw new Error("read failed");
        }
        return readGroupEventDetail(exec, { groupEventId });
      },
      onRefreshed: (event) => dispatch({ type: "eventRefreshed", event }),
      onRefreshFailed: () => dispatch({ type: "refreshFailed" }),
    });

    const outcome = await confirmMultiSelection(
      new Set([blair, casey]),
      (contactIds) =>
        runParticipantAdd({
          add: () => addSpy(contactIds),
          onCommitted: () =>
            dispatch({ type: "participantsCommitted", contactIds }),
          refresh: controller.refresh,
        }),
    );

    expect(outcome).toEqual({ ok: true, contactIds: [blair, casey] });
    await vi.waitFor(() => expect(state.refreshError).toBe(true));
    expect(
      excludedParticipantIds(state.event, state.committedPendingIds),
    ).toEqual([alex, blair, casey]);

    // Retry re-reads only.
    await controller.refresh();

    expect(addSpy).toHaveBeenCalledTimes(1);
    expect(state.refreshError).toBe(false);
    expect(state.event?.participants.map((p) => p.contactId)).toEqual([
      alex,
      blair,
      casey,
    ]);
    for (const contactId of [alex, blair, casey]) {
      expect(await childCount(groupEventId, contactId)).toBe(1);
    }

    // The DAO duplicate-participant guard is unchanged: a re-pick still rejects.
    await expect(addSpy([blair])).rejects.toThrow(
      "is already a group participant",
    );
    expect(await childCount(groupEventId, blair)).toBe(1);
  });
});
