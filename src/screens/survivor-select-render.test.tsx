import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";

/**
 * Survivor select (38.12 D-43, D-99, D-110; convergence c1 L-5).
 *
 * A function-call render with a mocked React: `useState` slots are seeded by
 * call order and every setter is a spy; `useEffect` runs its body once so the
 * picker read can be observed. Covers the shared picker (no Bin contacts, the
 * first person excluded and shown first), loading and error apart from the
 * empty list, the host passing to MergeConflicts, and the step-two entry that
 * never mounts the picker.
 */

/** SurvivorSelectScreen's `useState` call order. Pinned by the slot check. */
const SLOT = {
  rows: 0,
  loadFailed: 1,
  loadAttempt: 2,
  firstPerson: 3,
  selected: 4,
  pair: 5,
  enteredAtStepTwo: 6,
} as const;

const hooks = vi.hoisted(() => ({
  index: 0,
  runEffects: false,
  seed: new Map<number, unknown>(),
  initial: [] as unknown[],
  setters: [] as ReturnType<typeof vi.fn>[],
}));
const reads = vi.hoisted(() => ({
  listPickerContacts: vi.fn(),
  getMergeCandidate: vi.fn(),
}));

vi.mock("react", async (original) => {
  return {
    ...(await original<typeof import("react")>()),
    useCallback: <T,>(callback: T) => callback,
    useEffect: (effect: () => unknown) => {
      if (hooks.runEffects) effect();
    },
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
  ActivityIndicator: "ActivityIndicator",
  Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Text: "Text",
  View: "View",
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/components/Avatar", () => ({ Avatar: "Avatar" }));
vi.mock("@/components/ContactPicker", () => ({
  ContactPickerList: "ContactPickerList",
}));
vi.mock("@/components/ShellAppBar", () => ({ ShellAppBar: "ShellAppBar" }));
vi.mock("@/components/ui", () => ({ EmptyState: "EmptyState" }));
vi.mock("@/db/database", () => ({ getExecutor: () => "exec" }));
vi.mock("@/db/picker-read", () => ({
  listPickerContacts: reads.listPickerContacts,
}));
vi.mock("@/db/merge-candidate-read", () => ({
  getMergeCandidate: reads.getMergeCandidate,
}));
vi.mock("@/navigation/discard-keep-guard", () => ({
  useDiscardKeepGuard: () => {},
}));

const { SurvivorSelectScreen } = await import("./SurvivorSelectScreen");

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}
function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("expected node not rendered");
  return value;
}
function textOf(element: TestElement): string {
  const children = element.props.children;
  const parts = Array.isArray(children) ? children : [children];
  return parts
    .map((part) =>
      typeof part === "string" || typeof part === "number" ? String(part) : "",
    )
    .join("");
}

const FIRST = 1;
const OTHER = 2;
const BINNED = 3;
const row = (id: number, name: string, archived_at: string | null = null) => ({
  id,
  name,
  photo: null,
  modified_at: "2026-10-01 00:00:00",
  favourite_rank: null,
  last_contact: null,
  snooze_until: null,
  archived_at,
});
const candidate = (id: number, name: string) => ({
  id,
  name,
  photo: null,
  createdAt: "2026-01-01 00:00:00",
  interactionCount: 0,
  activeExternalLinkCount: 0,
  completeDataCount: 1,
});

function render(
  params: Record<string, unknown>,
  seed: Partial<Record<keyof typeof SLOT, unknown>> = {},
) {
  hooks.index = 0;
  hooks.seed = new Map(
    Object.entries(seed).map(([key, value]) => [
      SLOT[key as keyof typeof SLOT],
      value,
    ]),
  );
  const navigation = { navigate: vi.fn(), setParams: vi.fn() };
  const tree = nodes(
    SurvivorSelectScreen({
      navigation,
      route: { params },
    } as never),
  );
  return { tree, navigation };
}

beforeEach(() => {
  hooks.runEffects = false;
  hooks.setters = [];
  hooks.initial = [];
  reads.listPickerContacts.mockReset();
  reads.getMergeCandidate.mockReset();
});

describe("SurvivorSelect hook slots", () => {
  it("pins the useState call order the seeds rely on", () => {
    render({ firstContactId: FIRST });
    expect(hooks.initial[SLOT.rows]).toBeNull();
    expect(hooks.initial[SLOT.loadFailed]).toBe(false);
    expect(hooks.initial[SLOT.loadAttempt]).toBe(0);
    expect(hooks.initial[SLOT.firstPerson]).toBeNull();
    expect(hooks.initial[SLOT.selected]).toBeNull();
    expect(hooks.initial[SLOT.pair]).toBeNull();
    expect(hooks.initial[SLOT.enteredAtStepTwo]).toBe(false);
  });
});

describe("merge picker (D-43)", () => {
  it("reads only live contacts for the picker", () => {
    hooks.runEffects = true;
    reads.listPickerContacts.mockResolvedValue([]);
    reads.getMergeCandidate.mockResolvedValue(null);
    render({ firstContactId: FIRST });
    expect(reads.listPickerContacts).toHaveBeenCalledWith("exec", {
      includeArchived: false,
    });
    expect(reads.getMergeCandidate).toHaveBeenCalledWith("exec", FIRST);
  });

  it("is the shared picker without the first person or Bin contacts, and the first person shows first", () => {
    const { tree } = render(
      { firstContactId: FIRST },
      {
        rows: [row(FIRST, "Ana"), row(OTHER, "Bo"), row(BINNED, "Cy", "x")],
        firstPerson: candidate(FIRST, "Ana"),
      },
    );
    const picker = must(tree.find((n) => n.type === "ContactPickerList"));
    expect(picker.props.excludeContactId).toBe(FIRST);
    expect(picker.props.allowArchivedSearch).toBe(false);
    expect(
      (picker.props.rows as Array<{ id: number }>).map((r) => r.id),
    ).toEqual([OTHER]);
    const firstParty = must(
      tree.find((n) => n.props.testID === "merge-first-party"),
    );
    expect(
      nodes(firstParty)
        .filter((n) => n.type === "Text")
        .map(textOf),
    ).toContain("Ana");
    // The first party renders above the picker.
    expect(tree.indexOf(firstParty)).toBeLessThan(tree.indexOf(picker));
  });

  it("has search and the ✕ Cancel: the shared list plus a cancel header", () => {
    const { tree } = render(
      { firstContactId: FIRST },
      { rows: [row(OTHER, "Bo")] },
    );
    expect(tree.find((n) => n.type === "ShellAppBar")?.props.backKind).toBe(
      "cancel",
    );
    // Search lives in ContactPickerList (always-visible TextInput).
    expect(tree.some((n) => n.type === "ContactPickerList")).toBe(true);
  });

  it("a pick opens step two for that pair", () => {
    const { tree, navigation } = render(
      { firstContactId: FIRST },
      { rows: [row(OTHER, "Bo")] },
    );
    const picker = must(tree.find((n) => n.type === "ContactPickerList"));
    (picker.props.onPick as (r: { id: number }) => void)({ id: OTHER });
    expect(navigation.setParams).toHaveBeenCalledWith({
      secondContactId: OTHER,
    });
  });

  it("shows loading, not an empty list, while the read is in flight", () => {
    const { tree } = render({ firstContactId: FIRST });
    expect(tree.some((n) => n.props.testID === "merge-picker-loading")).toBe(
      true,
    );
    expect(tree.some((n) => n.type === "ContactPickerList")).toBe(false);
    expect(tree.some((n) => n.type === "EmptyState")).toBe(false);
  });

  it("shows an error with Try again, not an empty list, when the read fails", () => {
    const { tree } = render(
      { firstContactId: FIRST },
      { rows: null, loadFailed: true },
    );
    const failed = must(tree.find((n) => n.type === "EmptyState"));
    expect(failed.props.testID).toBe("merge-picker-failed");
    expect(tree.some((n) => n.type === "ContactPickerList")).toBe(false);
    expect(tree.some((n) => n.props.testID === "merge-picker-loading")).toBe(
      false,
    );
    const action = failed.props.action as { label: string; onPress(): void };
    expect(action.label).toBe("Try again");
    action.onPress();
    expect(hooks.setters[SLOT.rows]).toHaveBeenCalledWith(null);
    expect(hooks.setters[SLOT.loadAttempt]).toHaveBeenCalled();
  });

  it("an empty result is the picker's own empty list, not the error or loading state", () => {
    const { tree } = render({ firstContactId: FIRST }, { rows: [] });
    const picker = must(tree.find((n) => n.type === "ContactPickerList"));
    expect(picker.props.rows).toEqual([]);
    expect(tree.some((n) => n.type === "EmptyState")).toBe(false);
  });
});

describe("step-two entry (convergence c1 L-5)", () => {
  it("opened with both ids renders step two with no picker and no picker read", () => {
    hooks.runEffects = true;
    reads.getMergeCandidate.mockResolvedValue(null);
    const { tree } = render(
      { firstContactId: FIRST, secondContactId: OTHER },
      {
        enteredAtStepTwo: true,
        pair: [candidate(FIRST, "Ana"), candidate(OTHER, "Bo")],
        selected: OTHER,
      },
    );
    expect(tree.find((n) => n.type === "ShellAppBar")?.props.title).toBe(
      "Which contact survives?",
    );
    expect(tree.find((n) => n.type === "ShellAppBar")?.props.backKind).toBe(
      "back",
    );
    expect(tree.some((n) => n.type === "ContactPickerList")).toBe(false);
    expect(reads.listPickerContacts).not.toHaveBeenCalled();
  });

  it("Continue opens MergeConflicts for that pair with the host", () => {
    const host = { kind: "profile", profileKey: "Profile-abc" };
    const { tree, navigation } = render(
      { firstContactId: FIRST, secondContactId: OTHER, host },
      {
        enteredAtStepTwo: true,
        pair: [candidate(FIRST, "Ana"), candidate(OTHER, "Bo")],
        selected: OTHER,
      },
    );
    const cta = tree.find(
      (n) =>
        n.type === "Pressable" &&
        nodes(n).some((c) => c.type === "Text" && textOf(c) === "Continue"),
    );
    (must(cta).props.onPress as () => void)();
    expect(navigation.navigate).toHaveBeenCalledWith("MergeConflicts", {
      survivorId: OTHER,
      absorbedId: FIRST,
      host,
    });
  });

  it("an absent host passes the default settings host on (D-110)", () => {
    const { tree, navigation } = render(
      { firstContactId: FIRST, secondContactId: OTHER },
      {
        enteredAtStepTwo: true,
        pair: [candidate(FIRST, "Ana"), candidate(OTHER, "Bo")],
        selected: FIRST,
      },
    );
    const cta = tree.find(
      (n) =>
        n.type === "Pressable" &&
        nodes(n).some((c) => c.type === "Text" && textOf(c) === "Continue"),
    );
    (must(cta).props.onPress as () => void)();
    expect(navigation.navigate).toHaveBeenCalledWith("MergeConflicts", {
      survivorId: FIRST,
      absorbedId: OTHER,
      host: { kind: "settings" },
    });
  });
});
