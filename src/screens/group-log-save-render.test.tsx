import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Group Log Save (38.9 D-19; F-12; review C8-M5, cycle-5 C5-M4).
 *
 * A function-call render with a mocked React: `useState` slots are seeded by
 * call order and every setter is a spy, so the test reads which state a press
 * sets. The title validation error is its own state (`titleError`), shown
 * under Title; a save failure stays in the operation `error`. An empty-title
 * Save requests the Title reveal and focus, and writes nothing.
 *
 * Deliberately not asserted (this plan only, review C8-M5): the message
 * wording and the title's accessibility label. Plan 15 rewrites both.
 */

/** GroupLogScreen's `useState` call order. Pinned by the slot check below. */
const SLOT = {
  title: 0,
  value: 1,
  groupNote: 2,
  participantIds: 3,
  pickerVisible: 4,
  saving: 5,
  error: 6,
  titleError: 7,
} as const;

const hooks = vi.hoisted(() => ({
  index: 0,
  seed: new Map<number, unknown>(),
  initial: [] as unknown[],
  setters: [] as ReturnType<typeof vi.fn>[],
}));

vi.mock("react", async (original) => {
  return {
    ...(await original<typeof import("react")>()),
    useCallback: <T,>(callback: T) => callback,
    useEffect: () => {},
    useMemo: <T,>(factory: () => T) => factory(),
    useRef: <T,>(value: T) => ({ current: value }),
    useState: (value: unknown) => {
      const slot = hooks.index++;
      const initial =
        typeof value === "function" ? (value as () => unknown)() : value;
      hooks.initial[slot] = initial;
      if (!hooks.setters[slot]) hooks.setters[slot] = vi.fn();
      return [
        hooks.seed.has(slot) ? hooks.seed.get(slot) : initial,
        hooks.setters[slot],
      ];
    },
  };
});
vi.mock("react-native", () => ({
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StyleSheet: {
    create: (styles: unknown) => styles,
    hairlineWidth: 1,
  },
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("@/components/ContactPicker", () => ({
  ContactPicker: "ContactPicker",
}));
vi.mock("@/components/TouchpointRefineForm", () => ({
  TouchpointRefineForm: "TouchpointRefineForm",
}));
vi.mock("@/components/ui", () => ({ AppText: "AppText", Button: "Button" }));
vi.mock("@/components/ui/FieldError", () => ({ FieldError: "FieldError" }));
const { reveal } = vi.hoisted(() => ({ reveal: vi.fn() }));
vi.mock("@/components/ui/use-first-error-reveal", () => ({
  useFirstErrorReveal: () => ({
    scrollRef: { current: null },
    contentRef: { current: null },
    reveal,
  }),
}));
vi.mock("@/db/database", () => ({
  getExecutor: () => "exec",
  localDateTime: () => "2026-10-11 12:00:00",
}));
const { createGroupEvent } = vi.hoisted(() => ({ createGroupEvent: vi.fn() }));
vi.mock("@/db/group-events-dao", () => ({ createGroupEvent }));
vi.mock("@/db/uid", () => ({ newUid: () => "uid" }));
vi.mock("@/logic/group-log-participant-inputs", () => ({
  toGroupParticipantInputs: () => [],
}));
vi.mock("@/navigation/discard-keep-guard", () => ({
  useDiscardKeepGuard: vi.fn(),
}));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));

const { GroupLogScreen } = await import("./GroupLogScreen");

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

const navigation = { goBack: vi.fn() };

function render(seed: Partial<Record<keyof typeof SLOT, unknown>> = {}) {
  hooks.index = 0;
  hooks.seed = new Map(
    Object.entries(seed).map(([key, value]) => [
      SLOT[key as keyof typeof SLOT],
      value,
    ]),
  );
  const tree = GroupLogScreen({
    navigation,
    route: { params: {} },
  } as unknown as Parameters<typeof GroupLogScreen>[0]);
  return nodes(tree as ReactNode);
}

function byTestId(tree: TestElement[], testID: string): TestElement {
  const found = tree.find((element) => element.props.testID === testID);
  expect(found, testID).toBeDefined();
  return found as TestElement;
}

function setter(slot: keyof typeof SLOT) {
  return hooks.setters[SLOT[slot]];
}

async function pressSave(tree: TestElement[]) {
  (byTestId(tree, "group-log-save").props.onPress as () => void)();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  for (const spy of hooks.setters) spy?.mockClear();
  reveal.mockReset();
  createGroupEvent.mockReset();
  navigation.goBack.mockReset();
});

describe("GroupLogScreen Save (38.9 D-19; F-12)", () => {
  it("pins the useState call order the seeding relies on", () => {
    render();
    expect(hooks.initial[SLOT.title]).toBe("");
    expect(hooks.initial[SLOT.groupNote]).toBe("");
    expect(hooks.initial[SLOT.participantIds]).toEqual([]);
    expect(hooks.initial[SLOT.pickerVisible]).toBe(false);
    expect(hooks.initial[SLOT.saving]).toBe(false);
    expect(hooks.initial[SLOT.error]).toBeNull();
    expect(hooks.initial[SLOT.titleError]).toBeNull();
    expect(hooks.index).toBe(Object.keys(SLOT).length);
  });

  it("an empty title sets titleError, reveals and focuses Title, and saves nothing", async () => {
    const tree = render({ title: "  " });
    await pressSave(tree);

    expect(setter("titleError")).toHaveBeenCalledTimes(1);
    expect(typeof setter("titleError").mock.calls[0][0]).toBe("string");
    expect(setter("error")).not.toHaveBeenCalledWith(expect.any(String));
    expect(createGroupEvent).not.toHaveBeenCalled();

    const titleField = byTestId(tree, "group-log-title-field");
    const titleInput = byTestId(tree, "group-log-title");
    expect(reveal).toHaveBeenCalledTimes(1);
    expect(reveal.mock.calls[0][0]).toBe(titleField.props.ref);
    expect(reveal.mock.calls[0][1]).toBe(titleInput.props.ref);
  });

  it("a failed save sets the operation error, not titleError", async () => {
    createGroupEvent.mockRejectedValueOnce(new Error("disk full"));
    const tree = render({ title: "Dinner" });
    await pressSave(tree);

    expect(createGroupEvent).toHaveBeenCalledTimes(1);
    expect(setter("error")).toHaveBeenCalledWith(expect.any(String));
    for (const [value] of setter("titleError").mock.calls) {
      expect(value).toBeNull();
    }
    expect(reveal).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it("renders titleError under Title and the operation error elsewhere", () => {
    const tree = render({
      title: "",
      titleError: "Title problem",
      error: "Save problem",
    });
    const titleField = byTestId(tree, "group-log-title-field");
    const fieldErrors = nodes(titleField.props.children as ReactNode).filter(
      (element) => element.type === "FieldError",
    );
    expect(fieldErrors).toHaveLength(1);
    expect(fieldErrors[0].props.message).toBe("Title problem");
    // The operation error is never passed to a FieldError.
    expect(
      tree.filter(
        (element) =>
          element.type === "FieldError" &&
          element.props.message === "Save problem",
      ),
    ).toHaveLength(0);
    expect(
      tree.some(
        (element) =>
          element.type === "AppText" &&
          element.props.children === "Save problem",
      ),
    ).toBe(true);
  });

  it("typing in Title clears only titleError", () => {
    const tree = render({ title: "", titleError: "Title problem" });
    (
      byTestId(tree, "group-log-title").props.onChangeText as (
        t: string,
      ) => void
    )("D");
    expect(setter("title")).toHaveBeenCalledWith("D");
    expect(setter("titleError")).toHaveBeenCalledWith(null);
    expect(setter("error")).not.toHaveBeenCalled();
  });
});
