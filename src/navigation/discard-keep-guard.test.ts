import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmStore } from "@/stores/confirm-store";

type BeforeRemoveEvent = {
  preventDefault: () => void;
  data: { action: unknown };
};
type BeforeRemove = (event: BeforeRemoveEvent) => void;

const nav = vi.hoisted(() => ({
  listener: null as ((event: unknown) => void) | null,
  dispatch: vi.fn(),
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: (effect: () => undefined | (() => void)) => {
    effect();
  },
  useRef: <T>(value: T) => ({ current: value }),
}));
vi.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    addListener: (_name: string, callback: (event: unknown) => void) => {
      nav.listener = callback;
      return () => {};
    },
    dispatch: nav.dispatch,
  }),
}));

const { confirmDiscard, decideGuardOnRemove, useDiscardKeepGuard } =
  await import("./discard-keep-guard");

type SubEditor = { open: boolean; dirty: boolean; close: () => void };

function mountGuard(
  hasUnsavedChanges: boolean,
  bypass = false,
  subEditor?: SubEditor,
) {
  nav.listener = null;
  const bypassRef = { current: bypass };
  // biome-ignore lint/correctness/useHookAtTopLevel: react is mocked; the hook runs as a plain function here.
  const { requestClose } = useDiscardKeepGuard({
    hasUnsavedChanges,
    bypassRef,
    subEditor,
  });
  const fire = (action: unknown = { type: "GO_BACK" }) => {
    const event: BeforeRemoveEvent = {
      preventDefault: vi.fn(),
      data: { action },
    };
    (nav.listener as BeforeRemove | null)?.(event);
    return event;
  };
  return { fire, bypassRef, requestClose };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  confirmStore.setState({ queue: [] });
  nav.dispatch.mockReset();
});

describe("decideGuardOnRemove (D-13, D-14)", () => {
  const back = { actionType: "GO_BACK" };

  it("allows when bypassed or clean, prompts to leave when dirty", () => {
    expect(
      decideGuardOnRemove({ ...back, hasUnsavedChanges: false, bypass: false }),
    ).toBe("allow");
    expect(
      decideGuardOnRemove({ ...back, hasUnsavedChanges: true, bypass: true }),
    ).toBe("allow");
    expect(
      decideGuardOnRemove({ ...back, hasUnsavedChanges: false, bypass: true }),
    ).toBe("allow");
    expect(
      decideGuardOnRemove({ ...back, hasUnsavedChanges: true, bypass: false }),
    ).toBe("prompt-leave");
  });

  it("bypass wins for every action type, even with a dirty open sub-editor", () => {
    for (const actionType of ["GO_BACK", "POP", "RESET", "NAVIGATE"]) {
      expect(
        decideGuardOnRemove({
          actionType,
          bypass: true,
          hasUnsavedChanges: true,
          subEditorOpen: true,
          subEditorDirty: true,
        }),
      ).toBe("allow");
    }
  });

  it("Back (GO_BACK / POP) closes an open sub-editor first (D-14)", () => {
    for (const actionType of ["GO_BACK", "POP"]) {
      expect(
        decideGuardOnRemove({
          actionType,
          bypass: false,
          hasUnsavedChanges: true,
          subEditorOpen: true,
          subEditorDirty: false,
        }),
      ).toBe("close-sub-editor");
      expect(
        decideGuardOnRemove({
          actionType,
          bypass: false,
          hasUnsavedChanges: false,
          subEditorOpen: true,
          subEditorDirty: true,
        }),
      ).toBe("prompt-close-sub-editor");
      expect(
        decideGuardOnRemove({
          actionType,
          bypass: false,
          hasUnsavedChanges: true,
          subEditorOpen: false,
          subEditorDirty: false,
        }),
      ).toBe("prompt-leave");
      expect(
        decideGuardOnRemove({
          actionType,
          bypass: false,
          hasUnsavedChanges: false,
          subEditorOpen: false,
          subEditorDirty: false,
        }),
      ).toBe("allow");
    }
  });

  it("any other removal never closes a sub-editor (review C6-H1)", () => {
    for (const actionType of ["RESET", "NAVIGATE", "POP_TO_TOP", "REPLACE"]) {
      expect(
        decideGuardOnRemove({
          actionType,
          bypass: false,
          hasUnsavedChanges: false,
          subEditorOpen: true,
          subEditorDirty: false,
        }),
      ).toBe("allow");
      expect(
        decideGuardOnRemove({
          actionType,
          bypass: false,
          hasUnsavedChanges: false,
          subEditorOpen: true,
          subEditorDirty: true,
        }),
      ).toBe("prompt-leave");
      expect(
        decideGuardOnRemove({
          actionType,
          bypass: false,
          hasUnsavedChanges: true,
          subEditorOpen: false,
        }),
      ).toBe("prompt-leave");
      expect(
        decideGuardOnRemove({
          actionType,
          bypass: false,
          hasUnsavedChanges: false,
        }),
      ).toBe("allow");
    }
  });
});

describe("confirmDiscard() (D-13, D-52)", () => {
  it("enqueues the themed Discard changes? prompt", () => {
    void confirmDiscard();
    const [entry] = confirmStore.getState().queue;
    expect(entry.kind).toBe("confirm");
    expect(entry.request).toEqual({
      title: "Discard changes?",
      message: "Your unsaved changes will be lost.",
      cancelLabel: "Keep editing",
      confirmLabel: "Discard changes",
      destructive: true,
      headingGlyph: false,
    });
  });

  it("resolves true on Discard changes and false on Keep editing", async () => {
    const discard = confirmDiscard();
    confirmStore.getState().resolveCurrent(true);
    await expect(discard).resolves.toBe(true);
    const keep = confirmDiscard();
    confirmStore.getState().resolveCurrent(false);
    await expect(keep).resolves.toBe(false);
  });

  it("is non-dismissable: Back on the prompt does nothing", () => {
    void confirmDiscard();
    confirmStore.getState().dismissCurrent();
    expect(confirmStore.getState().queue).toHaveLength(1);
  });

  it("is single-flight: a second call while one is pending resolves false and enqueues nothing", async () => {
    const first = confirmDiscard();
    const second = confirmDiscard();
    await expect(second).resolves.toBe(false);
    expect(confirmStore.getState().queue).toHaveLength(1);
    confirmStore.getState().resolveCurrent(true);
    await expect(first).resolves.toBe(true);
    // Once the first resolves, the next call prompts again.
    void confirmDiscard();
    expect(confirmStore.getState().queue).toHaveLength(1);
  });

  it("is not blocked by an unrelated confirm in the queue", () => {
    confirmStore.getState().enqueue({
      kind: "confirm",
      request: { title: "Other", confirmLabel: "OK" },
      resolve: () => {},
    });
    void confirmDiscard();
    expect(confirmStore.getState().queue).toHaveLength(2);
  });
});

describe("useDiscardKeepGuard (D-13, D-14)", () => {
  it("lets a clean form leave at once", () => {
    const { fire } = mountGuard(false);
    const event = fire();
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(confirmStore.getState().queue).toHaveLength(0);
  });

  it("lets a bypassed save leave without a prompt", () => {
    const { fire } = mountGuard(true, true);
    const event = fire();
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(confirmStore.getState().queue).toHaveLength(0);
  });

  it("prompts on a dirty form and dispatches the removal only on Discard changes", async () => {
    const { fire } = mountGuard(true);
    const action = { type: "GO_BACK" };
    const event = fire(action);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(confirmStore.getState().queue).toHaveLength(1);
    confirmStore.getState().resolveCurrent(true);
    await flush();
    expect(nav.dispatch).toHaveBeenCalledWith(action);
  });

  it("stays on Keep editing", async () => {
    const { fire } = mountGuard(true);
    fire();
    confirmStore.getState().resolveCurrent(false);
    await flush();
    expect(nav.dispatch).not.toHaveBeenCalled();
  });

  it("dedupes a double Back: both are prevented, one prompt; after it resolves Back prompts again", async () => {
    const { fire } = mountGuard(true);
    const first = fire();
    const second = fire();
    expect(first.preventDefault).toHaveBeenCalledOnce();
    expect(second.preventDefault).toHaveBeenCalledOnce();
    expect(confirmStore.getState().queue).toHaveLength(1);
    confirmStore.getState().resolveCurrent(false);
    await flush();
    const third = fire();
    expect(third.preventDefault).toHaveBeenCalledOnce();
    expect(confirmStore.getState().queue).toHaveLength(1);
    confirmStore.getState().resolveCurrent(true);
    await flush();
    expect(nav.dispatch).toHaveBeenCalledOnce();
  });
});

describe("useDiscardKeepGuard sub-editor variant (D-14)", () => {
  it("Back with a clean open sub-editor closes it and stays", () => {
    const close = vi.fn();
    const { fire } = mountGuard(true, false, {
      open: true,
      dirty: false,
      close,
    });
    const event = fire({ type: "GO_BACK" });
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(confirmStore.getState().queue).toHaveLength(0);
    expect(nav.dispatch).not.toHaveBeenCalled();
  });

  it("Back with a dirty open sub-editor prompts; Discard closes it and stays", async () => {
    const close = vi.fn();
    const { fire } = mountGuard(false, false, {
      open: true,
      dirty: true,
      close,
    });
    const event = fire({ type: "POP" });
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(confirmStore.getState().queue).toHaveLength(1);
    expect(close).not.toHaveBeenCalled();
    confirmStore.getState().resolveCurrent(true);
    await flush();
    expect(close).toHaveBeenCalledOnce();
    expect(nav.dispatch).not.toHaveBeenCalled();
  });

  it("Keep editing leaves the dirty sub-editor open", async () => {
    const close = vi.fn();
    const { fire } = mountGuard(false, false, {
      open: true,
      dirty: true,
      close,
    });
    fire();
    confirmStore.getState().resolveCurrent(false);
    await flush();
    expect(close).not.toHaveBeenCalled();
    expect(nav.dispatch).not.toHaveBeenCalled();
  });
});

describe("useDiscardKeepGuard non-Back removals (review C6-H1)", () => {
  it("a RESET with a clean open sub-editor proceeds at once and closes nothing", () => {
    const close = vi.fn();
    const { fire } = mountGuard(false, false, {
      open: true,
      dirty: false,
      close,
    });
    const event = fire({ type: "RESET" });
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(confirmStore.getState().queue).toHaveLength(0);
  });

  it("a RESET with a dirty open sub-editor shows one prompt; Discard dispatches that RESET", async () => {
    const close = vi.fn();
    const { fire } = mountGuard(false, false, {
      open: true,
      dirty: true,
      close,
    });
    const action = { type: "RESET", payload: { routes: [] } };
    const event = fire(action);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(confirmStore.getState().queue).toHaveLength(1);
    confirmStore.getState().resolveCurrent(true);
    await flush();
    expect(close).not.toHaveBeenCalled();
    expect(nav.dispatch).toHaveBeenCalledOnce();
    expect(nav.dispatch).toHaveBeenCalledWith(action);
  });

  it("a RESET with a dirty open sub-editor and Keep editing dispatches nothing", async () => {
    const close = vi.fn();
    const { fire } = mountGuard(false, false, {
      open: true,
      dirty: true,
      close,
    });
    fire({ type: "RESET" });
    confirmStore.getState().resolveCurrent(false);
    await flush();
    expect(nav.dispatch).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it("a bypassed RESET is not prevented", () => {
    const close = vi.fn();
    const { fire } = mountGuard(true, true, { open: true, dirty: true, close });
    const event = fire({ type: "RESET" });
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(confirmStore.getState().queue).toHaveLength(0);
  });
});

describe("useDiscardKeepGuard requestClose (D-61)", () => {
  it("a clean close runs at once with no prompt", () => {
    const { requestClose } = mountGuard(false);
    const close = vi.fn();
    requestClose(close, false);
    expect(close).toHaveBeenCalledOnce();
    expect(confirmStore.getState().queue).toHaveLength(0);
  });

  it("a dirty close prompts and closes only on Discard changes", async () => {
    const { requestClose } = mountGuard(false);
    const close = vi.fn();
    requestClose(close, true);
    expect(close).not.toHaveBeenCalled();
    expect(confirmStore.getState().queue).toHaveLength(1);
    confirmStore.getState().resolveCurrent(true);
    await flush();
    expect(close).toHaveBeenCalledOnce();
  });

  it("Keep editing does not close", async () => {
    const { requestClose } = mountGuard(false);
    const close = vi.fn();
    requestClose(close, true);
    confirmStore.getState().resolveCurrent(false);
    await flush();
    expect(close).not.toHaveBeenCalled();
  });

  it("while a prompt is pending, a second requestClose or Back queues nothing and closes nothing", async () => {
    const subClose = vi.fn();
    const { requestClose, fire } = mountGuard(true, false, {
      open: true,
      dirty: true,
      close: subClose,
    });
    const first = vi.fn();
    const second = vi.fn();
    requestClose(first, true);
    requestClose(second, true);
    const event = fire({ type: "GO_BACK" });
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(confirmStore.getState().queue).toHaveLength(1);
    confirmStore.getState().resolveCurrent(true);
    await flush();
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
    expect(subClose).not.toHaveBeenCalled();
    expect(nav.dispatch).not.toHaveBeenCalled();
  });
});

describe("+ → Memory Back sequence (G-12; D-14, review C2-M1)", () => {
  // MemoryScreen's options: no route-level dirt, the open draft is the
  // sub-editor, close = memoryEditorRef.current?.closeDraft().
  const memoryGuard = (open: boolean, dirty: boolean, bypass = false) => {
    const closeDraft = vi.fn();
    const mounted = mountGuard(false, bypass, {
      open,
      dirty,
      close: closeDraft,
    });
    return { ...mounted, closeDraft };
  };

  it("a clean open draft closes on Back and the user stays", () => {
    const { fire, closeDraft } = memoryGuard(true, false);
    const event = fire({ type: "GO_BACK" });
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(closeDraft).toHaveBeenCalledOnce();
    expect(confirmStore.getState().queue).toHaveLength(0);
    expect(nav.dispatch).not.toHaveBeenCalled();
  });

  it("a dirty open draft prompts; Discard closes the draft and stays", async () => {
    const { fire, closeDraft } = memoryGuard(true, true);
    fire({ type: "GO_BACK" });
    expect(confirmStore.getState().queue).toHaveLength(1);
    confirmStore.getState().resolveCurrent(true);
    await flush();
    expect(closeDraft).toHaveBeenCalledOnce();
    expect(nav.dispatch).not.toHaveBeenCalled();
  });

  it("Keep editing closes nothing", async () => {
    const { fire, closeDraft } = memoryGuard(true, true);
    fire({ type: "GO_BACK" });
    confirmStore.getState().resolveCurrent(false);
    await flush();
    expect(closeDraft).not.toHaveBeenCalled();
  });

  it("with no draft open, a further Back leaves", () => {
    const { fire, closeDraft } = memoryGuard(false, false);
    const event = fire({ type: "GO_BACK" });
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(closeDraft).not.toHaveBeenCalled();
  });

  it("a save (bypass set) leaves even with the draft still open", () => {
    const { fire, closeDraft } = memoryGuard(true, true, true);
    const event = fire({ type: "GO_BACK" });
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(closeDraft).not.toHaveBeenCalled();
    expect(confirmStore.getState().queue).toHaveLength(0);
  });

  it("the editor's Cancel: dirty prompts and closes on Discard; clean closes at once (D-61)", async () => {
    const { requestClose } = memoryGuard(true, true);
    const close = vi.fn();
    requestClose(close, true);
    expect(close).not.toHaveBeenCalled();
    confirmStore.getState().resolveCurrent(true);
    await flush();
    expect(close).toHaveBeenCalledOnce();
    const clean = vi.fn();
    requestClose(clean, false);
    expect(clean).toHaveBeenCalledOnce();
  });
});

describe("Add Contact / Edit Contact open drafts on Back (C5-M1; D-13, D-14)", () => {
  // The screens pass `subEditor` from pickCreateSubEditor: only an open draft
  // holding typed text is `open`; its close calls that editor's closeDraft().
  const draftGuard = (
    routeDirty: boolean,
    draftOpenAndTyped: boolean,
    bypass = false,
  ) => {
    const closeDraft = vi.fn();
    const mounted = mountGuard(routeDirty, bypass, {
      open: draftOpenAndTyped,
      dirty: draftOpenAndTyped,
      close: closeDraft,
    });
    return { ...mounted, closeDraft };
  };

  for (const screen of ["Add Contact", "Edit Contact"]) {
    describe(screen, () => {
      it("an untouched form with a typed draft prompts; Discard closes the draft and stays", async () => {
        const { fire, closeDraft } = draftGuard(false, true);
        const event = fire({ type: "GO_BACK" });
        expect(event.preventDefault).toHaveBeenCalledOnce();
        expect(confirmStore.getState().queue).toHaveLength(1);
        confirmStore.getState().resolveCurrent(true);
        await flush();
        expect(closeDraft).toHaveBeenCalledOnce();
        expect(nav.dispatch).not.toHaveBeenCalled();
      });

      it("then a further Back on the otherwise untouched form leaves", () => {
        const { fire } = draftGuard(false, false);
        const event = fire({ type: "GO_BACK" });
        expect(event.preventDefault).not.toHaveBeenCalled();
      });

      it("an open but empty draft on an untouched form leaves at once", () => {
        // pickCreateSubEditor reports an empty open draft as not open.
        const { fire, closeDraft } = draftGuard(false, false);
        const event = fire({ type: "GO_BACK" });
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(closeDraft).not.toHaveBeenCalled();
      });

      it("a changed form with a typed draft closes the draft first; the next Back asks to leave", async () => {
        const first = draftGuard(true, true);
        first.fire({ type: "GO_BACK" });
        confirmStore.getState().resolveCurrent(true);
        await flush();
        expect(first.closeDraft).toHaveBeenCalledOnce();
        expect(nav.dispatch).not.toHaveBeenCalled();
        const next = draftGuard(true, false);
        const action = { type: "GO_BACK" };
        const event = next.fire(action);
        expect(event.preventDefault).toHaveBeenCalledOnce();
        expect(confirmStore.getState().queue).toHaveLength(1);
        confirmStore.getState().resolveCurrent(true);
        await flush();
        expect(nav.dispatch).toHaveBeenCalledWith(action);
      });

      it("a save (bypass set) leaves with a draft still open", () => {
        const { fire, closeDraft } = draftGuard(true, true, true);
        const event = fire({ type: "GO_BACK" });
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(closeDraft).not.toHaveBeenCalled();
      });
    });
  }
});

describe("Edit Contact / Add Contact section fold (D-68; D-13 for Add Contact)", () => {
  // The Memories / Key People fold handler: expanding never prompts; folding
  // calls requestClose(foldClose, draft.dirty) where foldClose closes the
  // draft and then folds the section.
  for (const screen of ["Edit Contact", "Add Contact"]) {
    describe(screen, () => {
      const setup = () => {
        const { requestClose } = mountGuard(false);
        const closeDraft = vi.fn();
        const fold = vi.fn();
        const foldClose = () => {
          closeDraft();
          fold();
        };
        return { requestClose, closeDraft, fold, foldClose };
      };

      it("folding with a typed draft prompts; Keep editing leaves it open", async () => {
        const { requestClose, foldClose, closeDraft, fold } = setup();
        requestClose(foldClose, true);
        expect(confirmStore.getState().queue).toHaveLength(1);
        confirmStore.getState().resolveCurrent(false);
        await flush();
        expect(closeDraft).not.toHaveBeenCalled();
        expect(fold).not.toHaveBeenCalled();
      });

      it("fold again, Discard: the draft closes and the section folds", async () => {
        const { requestClose, foldClose, closeDraft, fold } = setup();
        requestClose(foldClose, true);
        confirmStore.getState().resolveCurrent(true);
        await flush();
        expect(closeDraft).toHaveBeenCalledOnce();
        expect(fold).toHaveBeenCalledOnce();
      });

      it("an untouched draft or no draft folds at once", () => {
        const { requestClose, foldClose, fold } = setup();
        requestClose(foldClose, false);
        expect(fold).toHaveBeenCalledOnce();
        expect(confirmStore.getState().queue).toHaveLength(0);
      });

      it("a fold while a discard prompt is pending queues no second prompt", async () => {
        const { requestClose, foldClose, fold } = setup();
        requestClose(foldClose, true);
        requestClose(foldClose, true);
        expect(confirmStore.getState().queue).toHaveLength(1);
        confirmStore.getState().resolveCurrent(true);
        await flush();
        expect(fold).toHaveBeenCalledOnce();
      });
    });
  }
});

describe("Update Contact / Custom fields sub-editor (E-09, G-04; D-14, D-61)", () => {
  it("key-person form with a typed name: Back prompts once; Discard closes the form only", async () => {
    // Options: no route dirt; the sub-editor is the open row, dirty describes
    // the innermost level; close() resolves innermost → "inner".
    const closeInner = vi.fn();
    const { fire } = mountGuard(false, false, {
      open: true,
      dirty: true,
      close: closeInner,
    });
    fire({ type: "GO_BACK" });
    expect(confirmStore.getState().queue).toHaveLength(1);
    confirmStore.getState().resolveCurrent(true);
    await flush();
    expect(closeInner).toHaveBeenCalledOnce();
    expect(nav.dispatch).not.toHaveBeenCalled();
  });

  it("Keep editing keeps the typed draft", async () => {
    const closeInner = vi.fn();
    const { fire } = mountGuard(false, false, {
      open: true,
      dirty: true,
      close: closeInner,
    });
    fire({ type: "GO_BACK" });
    confirmStore.getState().resolveCurrent(false);
    await flush();
    expect(closeInner).not.toHaveBeenCalled();
  });

  it("with no editor open Back leaves as before", () => {
    const { fire } = mountGuard(false, false, {
      open: false,
      dirty: false,
      close: vi.fn(),
    });
    expect(fire({ type: "GO_BACK" }).preventDefault).not.toHaveBeenCalled();
  });
});

describe("Survivor select step two (D-14, C5-M7; review C6-H1)", () => {
  // SurvivorSelectScreen's options: no route dirt, a never-set bypass ref, and
  // step two as a clean sub-editor that is open only when reached from the
  // picker (`second != null && !enteredAtStepTwo`). What the close clears is
  // covered by the makeCloseStepTwo test (survivor-select-logic.test.ts,
  // review C7-L4); here the guard gets its own close and the test asserts only
  // the call.
  const survivorGuard = ({
    secondContactId,
    enteredAtStepTwo,
  }: {
    secondContactId: number | undefined;
    enteredAtStepTwo: boolean;
  }) => {
    const closeStepTwo = vi.fn();
    const mounted = mountGuard(false, false, {
      open: secondContactId != null && !enteredAtStepTwo,
      dirty: false,
      close: closeStepTwo,
    });
    return { ...mounted, closeStepTwo };
  };

  it("entered at step one: Back on step two returns to the picker; a further Back leaves", () => {
    const stepTwo = survivorGuard({
      secondContactId: 2,
      enteredAtStepTwo: false,
    });
    const back = stepTwo.fire({ type: "GO_BACK" });
    expect(back.preventDefault).toHaveBeenCalledOnce();
    expect(stepTwo.closeStepTwo).toHaveBeenCalledOnce();
    expect(confirmStore.getState().queue).toHaveLength(0);
    expect(nav.dispatch).not.toHaveBeenCalled();

    // The close cleared secondContactId: the picker step's next Back leaves.
    const picker = survivorGuard({
      secondContactId: undefined,
      enteredAtStepTwo: false,
    });
    const leave = picker.fire({ type: "GO_BACK" });
    expect(leave.preventDefault).not.toHaveBeenCalled();
    expect(picker.closeStepTwo).not.toHaveBeenCalled();
  });

  it("a RESET during step two (the merge-completion path) is not prevented and closes nothing", () => {
    const { fire, closeStepTwo } = survivorGuard({
      secondContactId: 2,
      enteredAtStepTwo: false,
    });
    const event = fire({ type: "RESET", payload: {} });
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(closeStepTwo).not.toHaveBeenCalled();
    expect(confirmStore.getState().queue).toHaveLength(0);
  });

  it("entered with both ids (from Reconcile): the first Back leaves", () => {
    const { fire, closeStepTwo } = survivorGuard({
      secondContactId: 2,
      enteredAtStepTwo: true,
    });
    const event = fire({ type: "GO_BACK" });
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(closeStepTwo).not.toHaveBeenCalled();
  });
});
