import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";

/**
 * 38.12 review B-WR-10: a failed merge-summary read is not silent, and an
 * irreversible merge is never confirmable before the summary has loaded.
 * Function-call render with a mocked React (the reconcile-host-forwarding
 * pattern): `useState` slots are seeded by call order, setters are spies.
 */

const hooks = vi.hoisted(() => ({
  index: 0,
  runEffects: false,
  seed: new Map<number, unknown>(),
  setters: [] as Array<ReturnType<typeof vi.fn>>,
}));
const mocks = vi.hoisted(() => ({
  readMergeImpactCounts: vi.fn(),
  readMergeDroppedItems: vi.fn(),
  getContactHeader: vi.fn(),
  confirm: vi.fn(),
  merge: vi.fn(),
  effects: vi.fn(),
  finishFlowOnProfile: vi.fn(),
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: (effect: () => unknown) => {
    if (hooks.runEffects) effect();
  },
  useRef: <T,>(value: T) => ({ current: value }),
  useState: (value: unknown) => {
    const slot = hooks.index++;
    const initial =
      typeof value === "function" ? (value as () => unknown)() : value;
    const setter = vi.fn();
    hooks.setters[slot] = setter;
    return [hooks.seed.has(slot) ? hooks.seed.get(slot) : initial, setter];
  },
}));
vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles },
  Text: "Text",
  View: "View",
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/theme/danger-scrim", () => ({ persistentDangerScrim: () => ({}) }));
vi.mock("./ShellAppBar", () => ({ ShellAppBar: "ShellAppBar" }));
vi.mock("@/db/contact-read", () => ({
  getContactHeader: mocks.getContactHeader,
}));
vi.mock("@/db/database", () => ({
  getExecutor: () => "exec",
  localDateTime: () => "2026-10-17 12:00:00",
}));
vi.mock("@/db/merge-dao", () => ({
  GroupMergeCollisionError: class extends Error {},
}));
vi.mock("@/db/merge-impact-read", () => ({
  readMergeImpactCounts: mocks.readMergeImpactCounts,
  readMergeDroppedItems: mocks.readMergeDroppedItems,
}));
vi.mock("@/navigation/flow-host", () => ({
  DEFAULT_FLOW_HOST: { kind: "settings" },
  finishFlowOnProfile: mocks.finishFlowOnProfile,
}));
vi.mock("@/services/photos/merge-photo-rehome", () => ({
  mergeContactsWithPhotoOwnership: mocks.merge,
}));
vi.mock("@/services/contact-lifecycle-effects", () => ({
  applyLifecycleTransitionEffects: mocks.effects,
}));
vi.mock("@/stores/confirm-store", () => ({ confirm: mocks.confirm }));

const { MergeImpactSummary } = await import("./MergeImpactSummary");

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}
function textOf(element: TestElement): string {
  return nodes(element)
    .flatMap((node) => {
      const children = node.props.children;
      const parts = Array.isArray(children) ? children : [children];
      return parts.filter((part) => typeof part === "string");
    })
    .join("");
}
function pressable(tree: ReactNode, pattern: RegExp): TestElement | undefined {
  return nodes(tree).find(
    (node) => node.type === "Pressable" && pattern.test(textOf(node)),
  );
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function render(seed: Array<[number, unknown]> = [], runEffects = false) {
  hooks.index = 0;
  hooks.runEffects = runEffects;
  hooks.setters = [];
  hooks.seed = new Map(seed);
  return MergeImpactSummary({
    navigation: { navigate: vi.fn() },
    route: {
      key: "MergeImpactSummary-1",
      name: "MergeImpactSummary",
      params: { survivorId: 1, absorbedId: 2, resolutions: {} },
    },
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("merge summary load (38.12 review B-WR-10)", () => {
  it("Merge is disabled until the summary has loaded", () => {
    const merge = pressable(render(), /Merge contacts/);
    if (!merge) throw new Error("no Merge button");
    expect(merge.props.disabled).toBe(true);
    (merge.props.onPress as () => void)();
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it("a failed read sets the error state instead of rejecting silently", async () => {
    mocks.getContactHeader.mockResolvedValue({ name: "Ann" });
    mocks.readMergeImpactCounts.mockRejectedValue(new Error("db"));
    mocks.readMergeDroppedItems.mockResolvedValue({
      profilePresentation: false,
      orrerySystemChoices: 0,
    });
    render([], true);
    await flush();
    await flush();
    expect(
      hooks.setters.some((setter) =>
        setter.mock.calls.some((call) => call[0] === true),
      ),
    ).toBe(true);
  });

  it("the error state shows Retry and keeps Merge disabled", () => {
    // Slots: names 0, counts 1, dropped 2, failureMessage 3, loadFailed 4.
    const tree = render([[4, true]]);
    expect(nodes(tree).map(textOf).join("|")).toContain(
      "Couldn't load what this merge moves. Nothing was changed.",
    );
    expect(pressable(tree, /^Retry$/)).toBeDefined();
    expect(pressable(tree, /Merge contacts/)?.props.disabled).toBe(true);
  });

  it("with the summary loaded, Merge is enabled", () => {
    const tree = render([
      [1, { interactions: 1 }],
      [2, { profilePresentation: false, orrerySystemChoices: 0 }],
    ]);
    expect(pressable(tree, /Merge contacts/)?.props.disabled).toBe(false);
  });

  it('the dropped line reads "Not kept from <absorbed>:" with no survivor clause (D-166)', () => {
    const tree = render([
      [0, { survivor: "Juniper Okafor", absorbed: "Wrenna Calloway" }],
      [1, { interactions: 1 }],
      [2, { profilePresentation: true, orrerySystemChoices: 0 }],
    ]);
    const texts = nodes(tree)
      .filter((node) => node.type === "Text")
      .map(textOf);
    expect(texts).toContain("Not kept from Wrenna Calloway:");
    expect(texts.some((text) => text.includes("'s stay"))).toBe(false);
  });

  it("a committed merge refreshes reminders and the widget (38.12 review B-IN-07)", async () => {
    mocks.confirm.mockResolvedValue(true);
    mocks.merge.mockResolvedValue({ recoveryPending: false });
    const tree = render([
      [1, { interactions: 1 }],
      [2, { profilePresentation: false, orrerySystemChoices: 0 }],
    ]);
    const merge = pressable(tree, /Merge contacts/);
    if (!merge) throw new Error("no Merge button");
    (merge.props.onPress as () => void)();
    for (let i = 0; i < 4; i++) await flush();
    expect(mocks.effects).toHaveBeenCalledWith(1, "merge", { exec: "exec" });
    expect(mocks.finishFlowOnProfile).toHaveBeenCalled();
  });
});
