import { readFileSync } from "node:fs";
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
import { resolveDisplay } from "@/logic/group-inheritance";
import {
  addedParticipantNames,
  createGroupEventRefreshController,
  createParticipantAddAnnouncer,
  EVENT_SAVED_SNACKBAR,
  eventDeletedSnackbar,
  eventDissolvedSnackbar,
  eventDraft,
  excludedParticipantIds,
  type GroupEventEditState,
  groupEventEditReducer,
  initialGroupEventEditState,
  isGroupEventDraftDirty,
  participantRemovedSnackbar,
  participantSavedSnackbar,
  participantsAddedSnackbar,
  runParticipantAdd,
  runParticipantRemove,
  visibleParticipants,
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
    expect(
      excludedParticipantIds(state.event, state.committedPendingIds),
    ).toEqual([1, 2, 3]);

    state = groupEventEditReducer(state, { type: "refreshFailed" });
    expect(
      excludedParticipantIds(state.event, state.committedPendingIds),
    ).toEqual([1, 2, 3]);

    state = groupEventEditReducer(state, {
      type: "eventRefreshed",
      event: detail([participant(1), participant(2), participant(3)]),
    });
    expect(state.committedPendingIds).toEqual([]);
    expect(
      excludedParticipantIds(state.event, state.committedPendingIds),
    ).toEqual([1, 2, 3]);
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

describe("groupEventEditReducer — participant work preserves the parent draft (D-17, D-18, reliability-testing/AUD-REL-007)", () => {
  const saved = detail([participant(1)]);

  function editedState(): GroupEventEditState {
    const seeded = groupEventEditReducer(initialGroupEventEditState, {
      type: "initialLoaded",
      event: saved,
    });
    const base = seeded.draft;
    if (!base) throw new Error("expected a seeded draft");
    return groupEventEditReducer(seeded, {
      type: "draftChanged",
      draft: {
        ...base,
        value: { ...base.value, quality: "Negative" },
        groupNote: "Unsaved note",
      },
    });
  }

  it("keeps the unsaved Group Note and Tone, the baseline and the dirty flag across a participant refresh", () => {
    const edited = editedState();
    expect(isGroupEventDraftDirty(edited)).toBe(true);

    const refreshed = groupEventEditReducer(edited, {
      type: "eventRefreshed",
      event: detail([participant(1), participant(2)]),
    });

    expect(refreshed.draft).toBe(edited.draft);
    expect(refreshed.baseline).toBe(edited.baseline);
    expect(refreshed.draft?.groupNote).toBe("Unsaved note");
    expect(refreshed.draft?.value.quality).toBe("Negative");
    expect(isGroupEventDraftDirty(refreshed)).toBe(true);
    expect(refreshed.event?.participants.map((p) => p.contactId)).toEqual([
      1, 2,
    ]);
  });

  it("never moves the baseline, even when the refreshed parent equals the draft (no accidental clean)", () => {
    const edited = editedState();
    const refreshed = groupEventEditReducer(edited, {
      type: "eventRefreshed",
      event: detail([participant(1)], {
        quality: "Negative",
        groupNote: "Unsaved note",
      }),
    });

    expect(refreshed.baseline).toBe(edited.baseline);
    expect(isGroupEventDraftDirty(refreshed)).toBe(true);
  });

  it("ignores a late or duplicate initial load once the draft is seeded", () => {
    const edited = editedState();
    const again = groupEventEditReducer(edited, {
      type: "initialLoaded",
      event: detail([participant(1), participant(2)], { groupNote: "Other" }),
    });

    expect(again).toBe(edited);
    expect(
      groupEventEditReducer(edited, { type: "initialLoadFailed" }).loadError,
    ).toBe(false);
  });

  it("resolves a following participant against the SAVED event, not the unsaved draft (D-18)", () => {
    const edited = groupEventEditReducer(editedState(), {
      type: "eventRefreshed",
      event: detail([participant(1), participant(2)]),
    });
    const event = edited.event;
    if (!event) throw new Error("expected an event");
    const follower = event.participants[1];

    // The same resolution ParticipantOverrideEditor's participantDraft uses.
    const display = resolveDisplay(follower, {
      channel: event.channel ?? "In Person",
      quality: event.quality,
      duration: event.duration,
    });

    expect(display.quality).toMatchObject({
      value: "Positive",
      following: true,
    });
    expect(edited.draft?.value.quality).toBe("Negative");
  });

  it("computes the parent Save patch against the saved event, which participant work never changes", () => {
    const edited = editedState();
    const refreshed = groupEventEditReducer(edited, {
      type: "eventRefreshed",
      event: detail([participant(1), participant(2)]),
    });
    if (!refreshed.event || !refreshed.baseline) {
      throw new Error("expected a seeded state");
    }

    expect(eventDraft(refreshed.event)).toEqual(JSON.parse(refreshed.baseline));
    expect(eventDraft(refreshed.event).groupNote).toBe("Saved note");
  });

  it("seeds the draft title from the saved event (38.14 D-69)", () => {
    expect(eventDraft(saved).title).toBe("Supper");
  });

  it("a title edit makes the draft dirty and a participant refresh keeps it (D-69, D-17)", () => {
    const seeded = groupEventEditReducer(initialGroupEventEditState, {
      type: "initialLoaded",
      event: saved,
    });
    const base = seeded.draft;
    if (!base) throw new Error("expected a seeded draft");
    const renamed = groupEventEditReducer(seeded, {
      type: "draftChanged",
      draft: { ...base, title: "Brunch" },
    });
    expect(isGroupEventDraftDirty(renamed)).toBe(true);

    const refreshed = groupEventEditReducer(renamed, {
      type: "eventRefreshed",
      event: detail([participant(1), participant(2)], { title: "Supper" }),
    });
    expect(refreshed.draft?.title).toBe("Brunch");
    expect(refreshed.baseline).toBe(renamed.baseline);
    expect(isGroupEventDraftDirty(refreshed)).toBe(true);
  });

  it("EditGroupEventScreen has no reseeding reload after participant work", () => {
    const source = readFileSync(
      new URL("./EditGroupEventScreen.tsx", import.meta.url),
      "utf8",
    );

    expect(source).not.toContain("baselineRef");
    expect(source).not.toContain("setDraft(");
    expect(source).not.toMatch(/\bawait load\(/);
    expect(source.match(/type: "initialLoaded"/g)).toHaveLength(1);
    expect(source).toContain('type: "draftChanged"');
    // Participant work re-reads through the controller: direct calls plus the
    // add/remove seams that take it as their detached `refresh` (A-WR-03).
    expect(
      source.match(/refreshEvent\(\)|refresh: refreshEvent\b/g)?.length ?? 0,
    ).toBeGreaterThanOrEqual(3);
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

describe("runParticipantRemove — a committed remove is never 'not saved' (38.3 review A-WR-03, D-04)", () => {
  it("only a rejected FIRST write reports failure", async () => {
    const onCommitted = vi.fn();
    const onWriteFailed = vi.fn();
    const refresh = vi.fn(async () => {});
    const result = await runParticipantRemove({
      latch: { current: false },
      remove: () => Promise.reject(new Error("db")),
      onCommitted,
      onWriteFailed,
      refresh,
    });
    expect(result).toBe("failed");
    expect(onWriteFailed).toHaveBeenCalledTimes(1);
    expect(onCommitted).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("a committed remove whose refresh fails is still committed (the refresh reports its own error)", async () => {
    const onWriteFailed = vi.fn();
    const onCommitted = vi.fn();
    const result = await runParticipantRemove({
      latch: { current: false },
      remove: async () => {},
      onCommitted,
      onWriteFailed,
      refresh: () => Promise.reject(new Error("read")),
    });
    expect(result).toBe("committed");
    expect(onCommitted).toHaveBeenCalledTimes(1);
    expect(onWriteFailed).not.toHaveBeenCalled();
  });

  it("drops a same-tick double tap so the remove runs once and nothing reports 'not saved'", async () => {
    const latch = { current: false };
    const gate = deferred<void>();
    const remove = vi.fn(() => gate.promise);
    const onWriteFailed = vi.fn();
    const opts = {
      latch,
      remove,
      onCommitted: vi.fn(),
      onWriteFailed,
      refresh: async () => {},
    };
    const first = runParticipantRemove(opts);
    const second = runParticipantRemove(opts);
    expect(await second).toBe("busy");
    gate.resolve();
    expect(await first).toBe("committed");
    expect(remove).toHaveBeenCalledTimes(1);
    expect(onWriteFailed).not.toHaveBeenCalled();
    expect(latch.current).toBe(false);
  });
});

describe("committed removals hide stale rows until a successful refresh (38.3 review A-WR-03)", () => {
  it("filters a committed-removed row out of the rendered participants", () => {
    const event = detail([participant(1), participant(2)]);
    expect(
      visibleParticipants(event, [20]).map(({ contactId }) => contactId),
    ).toEqual([1]);
  });

  it("the reducer records a committed removal, keeps it across a failed refresh, and clears it on success", () => {
    const loaded = detail([participant(1), participant(2)]);
    const afterRemove = reduceAll(initialGroupEventEditState, [
      { type: "initialLoaded", event: loaded },
      { type: "participantRemoved", interactionId: 20 },
      { type: "refreshFailed" },
    ]);
    expect(afterRemove.committedRemovedIds).toEqual([20]);
    expect(afterRemove.refreshError).toBe(true);
    // Draft/baseline are untouched by participant work (D-17).
    expect(isGroupEventDraftDirty(afterRemove)).toBe(false);
    const refreshed = groupEventEditReducer(afterRemove, {
      type: "eventRefreshed",
      event: detail([participant(1)]),
    });
    expect(refreshed.committedRemovedIds).toEqual([]);
  });
});

describe("EditGroupEventScreen clears a stale failure when a later write starts (38.3 review A-WR-04, D-04)", () => {
  const source = readFileSync(
    new URL("./EditGroupEventScreen.tsx", import.meta.url),
    "utf8",
  );
  function body(name: string): string {
    const start = source.indexOf(`function ${name}(`);
    expect(start).toBeGreaterThan(-1);
    const next = source.indexOf("\n  }\n", start);
    return source.slice(start, next);
  }

  // 38.14 D-68 removed the inline participant editor and its saveParticipant.
  it.each(["removeParticipant", "saveEvent"])(
    "%s clears the previous error before its write",
    (name) => {
      expect(body(name)).toContain("setError(null)");
    },
  );

  it("a committed participant add clears the previous error", () => {
    const add = body("addSelected");
    const committed = add.slice(add.indexOf("onCommitted"));
    expect(committed).toContain("setError(null)");
  });
});

describe("Edit Event has one participant editor (38.14 D-68, D-07)", () => {
  const source = readFileSync(
    new URL("./EditGroupEventScreen.tsx", import.meta.url),
    "utf8",
  );

  it("opens the EditParticipant screen for a participant", () => {
    expect(source).toContain('navigate("EditParticipant"');
  });

  it("no longer hosts the inline participant editor", () => {
    expect(source).not.toContain("ParticipantOverrideEditor");
    expect(source).not.toContain("function saveParticipant");
    expect(source).not.toContain("participantDraftState");
  });

  it("refreshes on a later focus through the controller, skipping the first", () => {
    expect(source).toContain("useFocusEffect(");
    expect(source).toMatch(/seenFocusRef\.current/);
  });
});

describe("Edit Event participant snackbars (38.14 D-67)", () => {
  it("names one or two added people and counts more", () => {
    expect(participantsAddedSnackbar(["Maya"], 1)).toBe("Added Maya");
    expect(participantsAddedSnackbar(["Maya", "Sam"], 2)).toBe(
      "Added Maya and Sam",
    );
    expect(participantsAddedSnackbar(["Maya", "Sam", "Jo"], 3)).toBe(
      "Added 3 people",
    );
  });

  it("falls back to a count when the names could not be read", () => {
    expect(participantsAddedSnackbar([], 1)).toBe("Added 1 person");
    expect(participantsAddedSnackbar(["Maya"], 2)).toBe("Added 2 people");
  });

  it("reads the added names from the refreshed event in its order", () => {
    const event = detail([
      participant(1, { contactName: "Ada" }),
      participant(2, { contactName: "Maya" }),
      participant(3, { contactName: "Sam" }),
    ]);
    expect(addedParticipantNames(event, [3, 2])).toEqual(["Maya", "Sam"]);
    expect(addedParticipantNames(event, [9])).toEqual([]);
  });

  it("names who was removed, and says when the interaction was deleted", () => {
    expect(participantRemovedSnackbar("Maya", false)).toBe("Removed Maya");
    expect(participantRemovedSnackbar("Maya", true)).toBe(
      "Removed Maya and deleted the interaction",
    );
  });

  it.each([
    "./EditGroupEventScreen.tsx",
    // 38.14 D-84 (owner): event detail confirms adds and removes the same way.
    "./GroupEventDetailScreen.tsx",
  ])("%s shows both snackbars after the commit", (file) => {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    expect(source).toContain("createParticipantAddAnnouncer(");
    expect(source).toMatch(/announcer\.queue\(contactIds\)/);
    expect(source).toMatch(
      /onRefreshed: \(\w+\) => \{[\s\S]*?announcer\.settle\(\w+\);/,
    );
    expect(source).toMatch(
      /onRefreshFailed: \(\) => \{[\s\S]*?announcer\.settle\(null\);/,
    );
    expect(source).toMatch(
      /kind: keep \? "success" : "warning",\s*label: participantRemovedSnackbar\(target\.contactName, !keep\),/,
    );
  });
});

describe("group-event writes confirm (ADR-199 via D-20; review B-WR-03)", () => {
  it("words each confirmation in the phase's named style", () => {
    expect(EVENT_SAVED_SNACKBAR).toBe("Changes saved");
    expect(participantSavedSnackbar("Maya")).toBe("Changes saved for Maya");
    expect(eventDissolvedSnackbar("Dinner")).toBe("Dissolved Dinner");
    expect(eventDeletedSnackbar("Dinner")).toBe(
      "Deleted Dinner and its interactions",
    );
  });

  const source = (file: string) =>
    readFileSync(new URL(file, import.meta.url), "utf8");

  it("Edit Event's save confirms after the commit and before leaving", () => {
    const edit = source("./EditGroupEventScreen.tsx");
    const write = edit.indexOf("await updateGroupEvent(");
    const shown = edit.indexOf(
      'showSnackbar({ kind: "success", label: EVENT_SAVED_SNACKBAR })',
    );
    expect(shown).toBeGreaterThan(write);
    expect(edit.indexOf("navigation.goBack()", write)).toBeGreaterThan(shown);
  });

  it("Edit participant's save confirms by name after the commit", () => {
    const edit = source("./EditParticipantScreen.tsx");
    const write = edit.indexOf("await saveParticipantEdits(");
    const shown = edit.indexOf(
      "participantSavedSnackbar(loaded.participant.contactName)",
    );
    expect(shown).toBeGreaterThan(write);
    expect(edit.indexOf("navigation.goBack()", write)).toBeGreaterThan(shown);
  });

  it("Dissolve confirms as success and Delete Event as a warning, each after its write", () => {
    const detailScreen = source("./GroupEventDetailScreen.tsx");
    const dissolve = detailScreen.indexOf("await dissolveGroupEvent(");
    const dissolved = detailScreen.indexOf("eventDissolvedSnackbar(title)");
    expect(dissolved).toBeGreaterThan(dissolve);
    expect(detailScreen.slice(dissolved - 80, dissolved)).toContain(
      'kind: "success"',
    );
    const remove = detailScreen.indexOf(
      "await deleteGroupEventAndInteractions(",
    );
    const deleted = detailScreen.indexOf("eventDeletedSnackbar(title)");
    expect(deleted).toBeGreaterThan(remove);
    expect(detailScreen.slice(deleted - 80, deleted)).toContain(
      'kind: "warning"',
    );
  });
});

describe("participant add announcer (38.14 D-67, D-84)", () => {
  const event = () =>
    detail([
      participant(1, { contactName: "Ada" }),
      participant(2, { contactName: "Maya" }),
      participant(3, { contactName: "Sam" }),
    ]);

  it("names the queued people from the readback, once", () => {
    const announce = vi.fn();
    const announcer = createParticipantAddAnnouncer(announce);
    announcer.queue([3, 2]);
    announcer.settle(event());
    announcer.settle(event());
    expect(announce.mock.calls).toEqual([["Added Maya and Sam"]]);
  });

  it("merges batches queued before one readback", () => {
    const announce = vi.fn();
    const announcer = createParticipantAddAnnouncer(announce);
    announcer.queue([1]);
    announcer.queue([2, 3]);
    announcer.settle(event());
    expect(announce.mock.calls).toEqual([["Added 3 people"]]);
  });

  it("a failed readback confirms by count", () => {
    const announce = vi.fn();
    const announcer = createParticipantAddAnnouncer(announce);
    announcer.queue([2]);
    announcer.settle(null);
    expect(announce.mock.calls).toEqual([["Added 1 person"]]);
  });

  it("a readback with nothing queued (a focus refresh) announces nothing", () => {
    const announce = vi.fn();
    createParticipantAddAnnouncer(announce).settle(event());
    expect(announce).not.toHaveBeenCalled();
  });

  it("a blur or unmount before the readback confirms the add by count, and the late readback stays silent (review B-WR-07)", () => {
    const announce = vi.fn();
    const announcer = createParticipantAddAnnouncer(announce);
    announcer.queue([2, 3]);
    announcer.flush();
    announcer.settle(event());
    announcer.flush();
    expect(announce.mock.calls).toEqual([["Added 2 people"]]);
  });

  it("flush with nothing queued announces nothing", () => {
    const announce = vi.fn();
    createParticipantAddAnnouncer(announce).flush();
    expect(announce).not.toHaveBeenCalled();
  });

  it.each(["./EditGroupEventScreen.tsx", "./GroupEventDetailScreen.tsx"])(
    "%s flushes then invalidates on blur and on unmount (ADR-162)",
    (file) => {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      const pairs = source.match(
        /announcer\.flush\(\);\s*refreshController\.invalidate\(\);/g,
      );
      expect(pairs).toHaveLength(2);
      const focus = source.slice(source.indexOf("useFocusEffect("));
      expect(focus).toMatch(
        /return \(\) => \{\s*announcer\.flush\(\);\s*refreshController\.invalidate\(\);/,
      );
    },
  );
});

describe("participant seams publish only after a commit (38.14 D-27, D-81)", () => {
  // The call sites put publishInteractionWrite() inside onCommitted; these
  // cases prove the seam contract they rely on. The source scan in
  // group-event-publication-contract.test.ts pins that every site calls it.
  it("runParticipantAdd: a rejected add never publishes", async () => {
    const publish = vi.fn();
    await expect(
      runParticipantAdd({
        add: () => Promise.reject(new Error("write failed")),
        onCommitted: publish,
        refresh: async () => {},
      }),
    ).rejects.toThrow("write failed");
    expect(publish).not.toHaveBeenCalled();
  });

  it("runParticipantAdd: a committed add publishes exactly once", async () => {
    const publish = vi.fn();
    await runParticipantAdd({
      add: async () => {},
      onCommitted: publish,
      refresh: async () => {},
    });
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it("runParticipantRemove: a rejected remove returns failed and never publishes", async () => {
    const publish = vi.fn();
    const result = await runParticipantRemove({
      latch: { current: false },
      remove: () => Promise.reject(new Error("write failed")),
      onCommitted: publish,
      onWriteFailed: vi.fn(),
      refresh: async () => {},
    });
    expect(result).toBe("failed");
    expect(publish).not.toHaveBeenCalled();
  });

  it("runParticipantRemove: a committed remove publishes exactly once", async () => {
    const publish = vi.fn();
    const result = await runParticipantRemove({
      latch: { current: false },
      remove: async () => {},
      onCommitted: publish,
      onWriteFailed: vi.fn(),
      refresh: async () => {},
    });
    expect(result).toBe("committed");
    expect(publish).toHaveBeenCalledTimes(1);
  });
});
