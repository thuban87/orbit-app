/**
 * Share confirmation card logic (38.10 D-77, D-78, D-79, D-83, D-87, D-99,
 * D-100, D-110, D-120; convergence c1 F-U4, c2 G-U1, c3, c4, c5, c10).
 * Behavioural: the reducer, the timer controller with a fake clock, the share
 * sequence and the stale-completion predicate are driven directly.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShareRowRef } from "@/db/capture-dao";
import {
  advanceShareSequence,
  autoCloseHeld,
  buildAutoCloseCallback,
  captureViewPayload,
  confirmationLabel,
  createAutoCloseTimer,
  createdLabel,
  initialShareCardState,
  isLiveShareIntent,
  runShareWrite,
  SHARE_CARD_AUTO_CLOSE_MS,
  SHARE_CHIP_ORDER,
  SHARE_SECTION_LABELS,
  type ShareCardAction,
  type ShareCardState,
  shareCardReducer,
  shareListLocked,
  shareScreenAfterUndo,
  shouldPublishShareResult,
  takeShareSnapshot,
  undoResultSnackbar,
  undoTarget,
} from "./share-card-logic";

const ROWS: ShareRowRef[] = [{ table: "memories", id: 1, contactId: 10 }];
const MOVED: ShareRowRef[] = [
  { table: "current_state_entries", id: 7, contactId: 10 },
];

function run(
  state: ShareCardState,
  ...actions: ShareCardAction[]
): ShareCardState {
  return actions.reduce(shareCardReducer, state);
}

const fresh = () => initialShareCardState(ROWS, null);

/** The library's default object after `resetShareIntent()` (not live). */
const DEFAULT_INTENT = { files: null, text: null, webUrl: null, type: null };

describe("SHARE_CARD_AUTO_CLOSE_MS (D-77)", () => {
  it("is longer than the old 1500 ms toast", () => {
    expect(SHARE_CARD_AUTO_CLOSE_MS).toBeGreaterThan(1500);
  });
});

describe("copy (D-83, D-87, D-89)", () => {
  it("names the chips in D-77 order from the registries", () => {
    expect(SHARE_CHIP_ORDER.map((s) => SHARE_SECTION_LABELS[s])).toEqual([
      "Thought of Them",
      "Gift Ideas",
      "Last Talked About",
      "Memories",
    ]);
  });

  it("'Saved to <name> · <section>' follows the chip and is multi-name aware", () => {
    expect(confirmationLabel(["Alex"], "gift_idea")).toBe(
      "Saved to Alex · Gift Ideas",
    );
    expect(confirmationLabel(["Alex", "Blair"], "thought_of_them")).toBe(
      "Saved to Alex and Blair · Thought of Them",
    );
    expect(confirmationLabel(["A", "B", "C"], "memory")).toBe(
      "Saved to 3 contacts · Memories",
    );
  });

  it("'Created <name> · checking in monthly' (D-83)", () => {
    expect(createdLabel("Robin")).toBe("Created Robin · checking in monthly");
  });

  it("confirms every Undo with a success snackbar (D-110, D-120)", () => {
    expect(undoResultSnackbar({ kind: "share" }, "Alex")).toEqual({
      kind: "success",
      label: "Share removed",
    });
    expect(
      undoResultSnackbar(
        { kind: "create-and-share", contactRemoved: true },
        "Robin",
      ),
    ).toEqual({ kind: "success", label: "Removed share and Robin" });
    expect(
      undoResultSnackbar(
        { kind: "create-and-share", contactRemoved: false },
        "Robin",
      ),
    ).toEqual({
      kind: "success",
      label: "Kept Robin because they have other details.",
    });
  });
});

describe("card reducer: chips and the AI switch (D-77, D-78, D-99, G-U1)", () => {
  it("starts in Thought of Them with AI off and enabled (D-03, D-78)", () => {
    const s = fresh();
    expect(s.section).toBe("thought_of_them");
    expect(s.aiOn).toBe(false);
    expect(s.aiDisabled).toBe(false);
    expect(s.undone).toBe(false);
  });

  it("Last Talked About disables the switch and forces it off; another chip re-enables it", () => {
    let s = run(
      fresh(),
      { type: "toggleAi" },
      { type: "writeSucceeded", result: { kind: "ai", aiOn: true } },
    );
    expect(s.aiOn).toBe(true);

    s = run(s, { type: "selectChip", section: "last_talked_about" });
    expect(s.aiOn).toBe(false);
    expect(s.aiDisabled).toBe(true);
    s = run(s, {
      type: "writeSucceeded",
      result: {
        kind: "move",
        rows: MOVED,
        section: "last_talked_about",
        aiOn: false,
      },
    });
    expect(s.aiDisabled).toBe(true);

    // toggleAi is ignored while disabled.
    expect(run(s, { type: "toggleAi" })).toBe(s);

    s = run(s, { type: "selectChip", section: "gift_idea" });
    expect(s.aiDisabled).toBe(false);
    s = run(s, {
      type: "writeSucceeded",
      result: { kind: "move", rows: ROWS, section: "gift_idea", aiOn: false },
    });
    expect(s.aiDisabled).toBe(false);
    expect(s.aiOn).toBe(false);
  });

  it("a move shows the stored permission, whatever the chip (G-U1)", () => {
    const on = run(
      fresh(),
      { type: "selectChip", section: "gift_idea" },
      {
        type: "writeSucceeded",
        result: { kind: "move", rows: ROWS, section: "gift_idea", aiOn: true },
      },
    );
    expect(on.aiOn).toBe(true);
    const off = run(
      fresh(),
      { type: "selectChip", section: "memory" },
      {
        type: "writeSucceeded",
        result: { kind: "move", rows: ROWS, section: "memory", aiOn: false },
      },
    );
    expect(off.aiOn).toBe(false);
  });

  it("tapping the selected chip does nothing", () => {
    const s = fresh();
    expect(run(s, { type: "selectChip", section: "thought_of_them" })).toBe(s);
  });
});

describe("card reducer: single-flight writes and committed refs (F-U4)", () => {
  it("a deferred move followed by Undo uses the moved refs", () => {
    const s = run(
      fresh(),
      { type: "selectChip", section: "last_talked_about" },
      {
        type: "writeSucceeded",
        result: {
          kind: "move",
          rows: MOVED,
          section: "last_talked_about",
          aiOn: false,
        },
      },
      { type: "undo" },
    );
    expect(s.writePending).toBe("undo");
    expect(undoTarget(s)).toEqual({ kind: "share", rows: MOVED });
  });

  it("ignores a second action while a write is pending", () => {
    const pending = run(fresh(), {
      type: "selectChip",
      section: "gift_idea",
    });
    expect(pending.writePending).toBe("move");
    for (const action of [
      { type: "selectChip", section: "memory" },
      { type: "toggleAi" },
      { type: "undo" },
      { type: "saveNote" },
    ] as ShareCardAction[]) {
      expect(run(pending, action)).toBe(pending);
    }
  });

  it("writeFailed keeps the previous refs, section and AI state", () => {
    const committed = run(
      fresh(),
      { type: "toggleAi" },
      { type: "writeSucceeded", result: { kind: "ai", aiOn: true } },
    );
    const failed = run(
      committed,
      { type: "selectChip", section: "last_talked_about" },
      { type: "writeFailed" },
    );
    expect(failed.rows).toBe(ROWS);
    expect(failed.section).toBe("thought_of_them");
    expect(failed.aiOn).toBe(true);
    expect(failed.aiDisabled).toBe(false);
    expect(failed.writePending).toBeNull();
    expect(failed.undone).toBe(false);
  });

  it("a failed AI toggle snaps the switch back", () => {
    const s = run(fresh(), { type: "toggleAi" });
    expect(s.aiOn).toBe(true);
    expect(run(s, { type: "writeFailed" }).aiOn).toBe(false);
  });

  it("a refused Undo is a failed write: the card stays un-undone", () => {
    const s = run(fresh(), { type: "undo" }, { type: "writeFailed" });
    expect(s.undone).toBe(false);
    expect(s.writePending).toBeNull();
  });

  it("a successful Undo marks the card undone; nothing else can start", () => {
    const s = run(
      fresh(),
      { type: "undo" },
      { type: "writeSucceeded", result: { kind: "undo" } },
    );
    expect(s.undone).toBe(true);
    expect(run(s, { type: "selectChip", section: "gift_idea" })).toBe(s);
    expect(run(s, { type: "toggleAi" })).toBe(s);
  });

  it("a saved note closes the editor and clears the draft", () => {
    const s = run(
      fresh(),
      { type: "noteOpened" },
      { type: "setNote", text: "for Dad" },
      { type: "saveNote" },
      { type: "writeSucceeded", result: { kind: "note" } },
    );
    expect(s.noteEditing).toBe(false);
    expect(s.note).toBe("");
  });
});

describe("card reducer: D-100 Undo routing", () => {
  it("routes a share that created its contact to the create-and-share undo", () => {
    expect(undoTarget(initialShareCardState(ROWS, 42))).toEqual({
      kind: "create-and-share",
      contactId: 42,
      rows: ROWS,
    });
    expect(undoTarget(fresh())).toEqual({ kind: "share", rows: ROWS });
  });
});

/** A fake-clock harness: the reducer plus the card's timer controller. */
function harness(initial = fresh()) {
  let state = initial;
  let finishes = 0;
  const timer = createAutoCloseTimer({
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    ms: SHARE_CARD_AUTO_CLOSE_MS,
    onFire: () => dispatch({ type: "timeout" }),
  });
  function dispatch(action: ShareCardAction) {
    const prev = state;
    state = shareCardReducer(state, action);
    if (state.finished && !prev.finished) finishes += 1;
    timer.sync(state);
  }
  timer.sync(state);
  return {
    dispatch,
    get state() {
      return state;
    },
    get finishes() {
      return finishes;
    },
    timer,
  };
}

describe("auto-close holds (D-77; F-U4; c5 app-inactive)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("finishes after the full duration with no hold", () => {
    const h = harness();
    vi.advanceTimersByTime(SHARE_CARD_AUTO_CLOSE_MS - 1);
    expect(h.finishes).toBe(0);
    vi.advanceTimersByTime(1);
    expect(h.finishes).toBe(1);
  });

  it("pauses while touching and restarts in full on touchEnd", () => {
    const h = harness();
    vi.advanceTimersByTime(SHARE_CARD_AUTO_CLOSE_MS - 100);
    h.dispatch({ type: "touchStart" });
    vi.advanceTimersByTime(SHARE_CARD_AUTO_CLOSE_MS * 3);
    expect(h.finishes).toBe(0);
    h.dispatch({ type: "touchEnd" });
    vi.advanceTimersByTime(SHARE_CARD_AUTO_CLOSE_MS - 1);
    expect(h.finishes).toBe(0);
    vi.advanceTimersByTime(1);
    expect(h.finishes).toBe(1);
  });

  for (const [name, open, close] of [
    [
      "a pending write",
      { type: "selectChip", section: "gift_idea" },
      {
        type: "writeSucceeded",
        result: { kind: "move", rows: ROWS, section: "gift_idea", aiOn: false },
      },
    ],
    ["a failed write", { type: "toggleAi" }, { type: "writeFailed" }],
    ["the note editor", { type: "noteOpened" }, { type: "noteClosed" }],
    ["a discard prompt", { type: "discardOpened" }, { type: "discardClosed" }],
  ] as [string, ShareCardAction, ShareCardAction][]) {
    it(`holds while ${name} and re-arms in full when it clears`, () => {
      const h = harness();
      h.dispatch(open);
      vi.advanceTimersByTime(SHARE_CARD_AUTO_CLOSE_MS * 2);
      expect(h.finishes).toBe(0);
      // A stray timeout while held does not finish.
      h.dispatch({ type: "timeout" });
      expect(h.state.finished).toBe(false);
      h.dispatch(close);
      vi.advanceTimersByTime(SHARE_CARD_AUTO_CLOSE_MS - 1);
      expect(h.finishes).toBe(0);
      vi.advanceTimersByTime(1);
      expect(h.finishes).toBe(1);
    });
  }

  it("backgrounded: an overdue fire does not finish, nor does waiting past the duration", () => {
    const h = harness();
    vi.advanceTimersByTime(SHARE_CARD_AUTO_CLOSE_MS - 10);
    h.dispatch({ type: "backgrounded" });
    expect(autoCloseHeld(h.state)).toBe(true);
    // The overdue fire RN delivers on resume.
    h.dispatch({ type: "timeout" });
    vi.advanceTimersByTime(SHARE_CARD_AUTO_CLOSE_MS * 10);
    expect(h.finishes).toBe(0);
  });

  it("foregrounded re-arms for a further full duration, not at once", () => {
    const h = harness();
    h.dispatch({ type: "backgrounded" });
    vi.advanceTimersByTime(SHARE_CARD_AUTO_CLOSE_MS * 2);
    h.dispatch({ type: "foregrounded" });
    expect(h.finishes).toBe(0);
    vi.advanceTimersByTime(SHARE_CARD_AUTO_CLOSE_MS - 1);
    expect(h.finishes).toBe(0);
    vi.advanceTimersByTime(1);
    expect(h.finishes).toBe(1);
  });

  it("foregrounded while the note is still open does not arm until noteClosed", () => {
    const h = harness();
    h.dispatch({ type: "noteOpened" });
    h.dispatch({ type: "backgrounded" });
    h.dispatch({ type: "foregrounded" });
    vi.advanceTimersByTime(SHARE_CARD_AUTO_CLOSE_MS * 2);
    expect(h.finishes).toBe(0);
    h.dispatch({ type: "noteClosed" });
    vi.advanceTimersByTime(SHARE_CARD_AUTO_CLOSE_MS);
    expect(h.finishes).toBe(1);
  });

  it("a discard prompt then timeout does not finish; discardClosed re-arms", () => {
    const h = harness();
    h.dispatch({ type: "discardOpened" });
    h.dispatch({ type: "timeout" });
    expect(h.finishes).toBe(0);
    h.dispatch({ type: "discardClosed" });
    vi.advanceTimersByTime(SHARE_CARD_AUTO_CLOSE_MS);
    expect(h.finishes).toBe(1);
  });

  it("an auto-close callback does not finish while the app reports background", () => {
    const finish = vi.fn();
    const cb = buildAutoCloseCallback({
      armedSeq: 1,
      currentSeq: () => 1,
      appState: () => "background",
      finish,
    });
    cb();
    expect(finish).not.toHaveBeenCalled();
    buildAutoCloseCallback({
      armedSeq: 1,
      currentSeq: () => 1,
      appState: () => "active",
      finish,
    })();
    expect(finish).toHaveBeenCalledTimes(1);
  });
});

describe("share sequence (c3, c4)", () => {
  const a = { text: "a", webUrl: null, files: null };
  const b = { text: "b", webUrl: null, files: null };

  it("counts live intents by identity", () => {
    const one = advanceShareSequence(null, a, true);
    expect(one.seq).toBe(1);
    expect(advanceShareSequence(one, a, true)).toBe(one);
    const two = advanceShareSequence(one, b, true);
    expect(two.seq).toBe(2);
    expect(advanceShareSequence(two, b, true)).toBe(two);
  });

  it("a background reset never advances and keeps the live intent", () => {
    const one = advanceShareSequence(null, a, isLiveShareIntent(a));
    const reset = advanceShareSequence(
      one,
      DEFAULT_INTENT,
      isLiveShareIntent(DEFAULT_INTENT),
    );
    expect(reset).toBe(one);
    expect(reset.seq).toBe(1);
    expect(reset.intent).toBe(a);
    expect(advanceShareSequence(reset, a, true)).toBe(one);
    expect(advanceShareSequence(reset, b, true).seq).toBe(2);
  });

  it("starts at seq 0 with no live intent", () => {
    expect(advanceShareSequence(null, DEFAULT_INTENT, false)).toEqual({
      intent: null,
      seq: 0,
    });
  });

  it("isLiveShareIntent: false for the default object, true for text, url or files", () => {
    expect(isLiveShareIntent(DEFAULT_INTENT)).toBe(false);
    expect(isLiveShareIntent({ text: "", webUrl: "", files: [] })).toBe(false);
    expect(isLiveShareIntent(null)).toBe(false);
    expect(isLiveShareIntent({ text: "hello" })).toBe(true);
    expect(isLiveShareIntent({ webUrl: "https://x.test" })).toBe(true);
    expect(isLiveShareIntent({ files: [{ path: "/p" }] })).toBe(true);
  });

  it("a remount on the new seq gives a fresh card, unlike the state after a share and Undo", () => {
    const after = run(
      initialShareCardState(ROWS, 9),
      { type: "undo" },
      { type: "writeSucceeded", result: { kind: "undo" } },
    );
    expect(after.undone).toBe(true);
    const remount = initialShareCardState([], null);
    expect(remount.rows).toEqual([]);
    expect(remount.createdContactId).toBeNull();
    expect(remount.undone).toBe(false);
  });
});

describe("render payload (c10)", () => {
  it("keeps the snapshot's payload after a background reset", () => {
    const intent = {
      text: "A great article https://x.test/a",
      webUrl: "https://x.test/a",
    };
    const seq = advanceShareSequence(null, intent, isLiveShareIntent(intent));
    const snapshot = takeShareSnapshot(seq.seq, intent);
    const after = advanceShareSequence(seq, DEFAULT_INTENT, false);
    expect(after.seq).toBe(1);
    expect(captureViewPayload(snapshot)).toEqual(snapshot.payload);
    expect(captureViewPayload(snapshot)?.url).toBe("https://x.test/a");
  });

  it("is null with no snapshot (seq 0) or an empty payload", () => {
    expect(captureViewPayload(null)).toBeNull();
    expect(
      captureViewPayload({ seq: 0, payload: { displayText: "x", url: null } }),
    ).toBeNull();
    expect(
      captureViewPayload({ seq: 1, payload: { displayText: null, url: null } }),
    ).toBeNull();
  });

  it("snapshots the raw share for the note recompose", () => {
    expect(
      takeShareSnapshot(3, {
        text: "hello",
        webUrl: null,
        meta: { title: "T" },
      }).shareText,
    ).toEqual({ text: "hello", webUrl: null, title: "T" });
  });
});

describe("stale completions (c4)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shouldPublishShareResult only for an unchanged sequence", () => {
    expect(shouldPublishShareResult(1, 1)).toBe(true);
    expect(shouldPublishShareResult(1, 2)).toBe(false);
  });

  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  }

  it("a handler whose sequence moves before the write resolves does not publish", async () => {
    let seq = 1;
    const latch = { current: false };
    const write = deferred<string>();
    const publish = vi.fn();
    const done = runShareWrite({
      latch,
      startSeq: seq,
      currentSeq: () => seq,
      write: () => write.promise,
      onSuccess: publish,
    });
    seq = 2;
    write.resolve("rows");
    await expect(done).resolves.toEqual({ status: "stale" });
    expect(publish).not.toHaveBeenCalled();
    expect(latch.current).toBe(false);
  });

  it("a handler with an unchanged sequence publishes", async () => {
    const seq = 1;
    const latch = { current: false };
    const write = deferred<string>();
    const publish = vi.fn();
    const done = runShareWrite({
      latch,
      startSeq: seq,
      currentSeq: () => seq,
      write: () => write.promise,
      onSuccess: publish,
    });
    write.resolve("rows");
    await expect(done).resolves.toEqual({ status: "ok", value: "rows" });
    expect(publish).toHaveBeenCalledWith("rows");
  });

  it("a second write while the latch is held does not start", async () => {
    const latch = { current: true };
    const write = vi.fn(async () => "x");
    await expect(
      runShareWrite({ latch, startSeq: 1, currentSeq: () => 1, write }),
    ).resolves.toEqual({ status: "busy" });
    expect(write).not.toHaveBeenCalled();
  });

  it("an auto-close armed under seq 1 does not finish after the sequence moves to 2", () => {
    let seq = 1;
    const finish = vi.fn();
    const h = harness();
    const cb = buildAutoCloseCallback({
      armedSeq: 1,
      currentSeq: () => seq,
      appState: () => "active",
      finish,
    });
    seq = 2;
    vi.advanceTimersByTime(SHARE_CARD_AUTO_CLOSE_MS);
    expect(h.state.finished).toBe(true);
    cb();
    expect(finish).not.toHaveBeenCalled();
    seq = 1;
    cb();
    expect(finish).toHaveBeenCalledTimes(1);
  });
});

describe("Undo returns to the list (D-120)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const snapshot = { seq: 4 };
  const base = {
    seq: 4,
    snapshot,
    card: { rows: ROWS, names: ["Alex"] },
    noteOpen: true,
    noteText: "draft",
    searchText: "Al",
  };

  it("unmounts the card (its rows and label) and keeps the sequence, snapshot and search", () => {
    const after = shareScreenAfterUndo(base);
    expect(after.card).toBeNull();
    expect(after.noteOpen).toBe(false);
    expect(after.noteText).toBe("");
    expect(after.seq).toBe(4);
    expect(after.snapshot).toBe(snapshot);
    expect(after.searchText).toBe("Al");
    expect(
      shareListLocked({
        cardMounted: after.card !== null,
        writePending: false,
      }),
    ).toBe(false);
  });

  it("an auto-close whose card Undo unmounted never finishes", () => {
    const finish = vi.fn();
    const h = harness();
    h.dispatch({ type: "undo" });
    h.dispatch({ type: "writeSucceeded", result: { kind: "undo" } });
    // The card unmounts: its timer is disposed.
    h.timer.dispose();
    vi.advanceTimersByTime(SHARE_CARD_AUTO_CLOSE_MS * 3);
    expect(h.finishes).toBe(0);
    expect(finish).not.toHaveBeenCalled();
  });
});

describe("shareListLocked (WR-01; c10)", () => {
  it("is false at the start, true while a pick is pending or the card is up", () => {
    expect(shareListLocked({ cardMounted: false, writePending: false })).toBe(
      false,
    );
    expect(shareListLocked({ cardMounted: false, writePending: true })).toBe(
      true,
    );
    expect(shareListLocked({ cardMounted: true, writePending: false })).toBe(
      true,
    );
  });

  it("is false again on a new share (fresh state)", () => {
    const fresh = { cardMounted: false, writePending: false };
    expect(shareListLocked(fresh)).toBe(false);
  });
});
