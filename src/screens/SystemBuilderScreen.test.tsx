import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const saveSystemDefinition = vi.fn();
const saveMembershipOverrides = vi.fn();
const prefsSave = vi.fn();
const prefsHydrate = vi.fn();
let hydrated = false;

/**
 * The React mock renders the screen as a plain function call (38.9 Plan 04,
 * review C8-L1; Plan 10 reuses it). `useState` slots are seeded by call order
 * (`SLOT` below, pinned by a test) and every setter is a spy; effects run only
 * when a test sets `hooks.runEffects`.
 */
const hooks = vi.hoisted(() => ({
  index: 0,
  seed: new Map<number, unknown>(),
  initial: [] as unknown[],
  setters: [] as ReturnType<typeof vi.fn>[],
  runEffects: false,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useCallback: <T,>(callback: T) => callback,
  useEffect: (effect: () => void) => {
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
}));
vi.mock("react-native", () => ({
  Alert: { alert: vi.fn() },
  AppState: { addEventListener: () => ({ remove: () => {} }) },
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {} },
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("@react-navigation/native", () => ({ useIsFocused: () => true }));
vi.mock("@shopify/react-native-skia", () => ({
  Canvas: "Canvas",
  Circle: "Circle",
  Fill: "Fill",
}));
// 38.7-14: the V2 Preview canvas (Skia pictures, the shared caches) is not
// rendered here; its pure logic is tested in system-preview-logic.test.ts.
vi.mock("@/components/orrery/SystemPreviewCanvas", () => ({
  SystemPreviewCanvas: "SystemPreviewCanvas",
}));
vi.mock("react-native-gesture-handler", () => {
  const chain = new Proxy({}, { get: () => () => chain });
  return {
    Gesture: {
      Pan: () => chain,
      Pinch: () => chain,
      Tap: () => chain,
      Race: () => chain,
      Simultaneous: () => chain,
    },
    GestureDetector: "GestureDetector",
  };
});
vi.mock("react-native-reanimated", () => ({
  runOnJS: (callback: unknown) => callback,
  useDerivedValue: (factory: () => unknown) => ({ value: factory() }),
  useSharedValue: (value: unknown) => ({ value }),
}));
vi.mock("@/components/orrery/ManageMembersGrid", () => ({
  ManageMembersGrid: "ManageMembersGrid",
}));
vi.mock("@/components/orrery/OrreryObstacle", () => ({
  OrreryObstacle: "OrreryObstacle",
}));
vi.mock("@/components/orrery/SystemRuleAccordion", () => ({
  SystemRuleAccordion: "SystemRuleAccordion",
}));
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));
vi.mock("@/components/ui/Button", () => ({ Button: "Button" }));
vi.mock("@/components/ui/FieldError", () => ({ FieldError: "FieldError" }));
const { reveal } = vi.hoisted(() => ({ reveal: vi.fn() }));
vi.mock("@/components/ui/use-first-error-reveal", () => ({
  useFirstErrorReveal: () => ({
    scrollRef: { current: null },
    contentRef: { current: null },
    reveal,
  }),
}));
vi.mock("@/components/ui/GlassSurface", () => ({
  GlassSurface: "GlassSurface",
}));
vi.mock("@/db/database", () => ({
  getExecutor: () => "exec",
  localDateTime: () => "now",
}));
vi.mock("@/db/orrery-system-read", () => ({
  listOrrerySystemCategories: vi.fn(),
  readOrrerySystemBaseMemberIds: vi.fn(),
  resolveDraftMembership: vi.fn(),
}));
vi.mock("@/db/systems-members-read", () => ({
  listActiveMemberRows: vi.fn(),
  readMemberRowsByIds: vi.fn(),
}));
vi.mock("@/db/systems-dao", () => ({
  getSystem: vi.fn(),
  listSystemOverrides: vi.fn(),
  listSystemRules: vi.fn(),
  mapBuiltinPredicateToRules: vi.fn(() => []),
  resetSystemOverrides: vi.fn(),
  saveMembershipOverrides,
  saveSystemDefinition,
}));
vi.mock("@/logic/system-rule-resolver", () => ({
  FAVORITE_RULE_VALUE: "on",
  NOT_CONTACTED_RULE_VALUE: "on",
  SNOOZED_RULE_VALUE: "on",
  applyMembershipOverrides: vi.fn(),
}));
vi.mock("@/logic/orrery-system-logic", () => ({
  BUILTIN_SYSTEM_LABELS: {},
  parseSystemRef: vi.fn(),
}));
vi.mock("@/navigation/discard-keep-guard", () => ({
  useDiscardKeepGuard: vi.fn(),
}));
vi.mock("@/stores/orrery-preferences-store", () => ({
  useOrreryPreferencesStore: {
    getState: () => ({ hydrated, hydrate: prefsHydrate, save: prefsSave }),
  },
}));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));

const { saveCustomBuilderDraft, saveOverrideBuilderDraft } = await import(
  "./SystemBuilderScreen"
);
const { previewSaveAction, SystemBuilderScreen } = await import(
  "./SystemBuilderScreen"
);
const { emptyRuleDraft } = await import(
  "@/components/orrery/system-builder-logic"
);
const { focusPreviewBody } = await import(
  "@/components/orrery/system-preview-logic"
);
const { buildCategoryRuleView } = await vi.importActual<
  typeof import("@/components/orrery/SystemRuleAccordion")
>("@/components/orrery/SystemRuleAccordion");

beforeEach(() => {
  hydrated = false;
  saveSystemDefinition.mockReset().mockResolvedValue({ uid: "new-system" });
  saveMembershipOverrides.mockReset();
  prefsSave.mockReset().mockResolvedValue(undefined);
  prefsHydrate.mockReset().mockImplementation(async () => {
    hydrated = true;
  });
});

describe("SystemBuilder save selection channel", () => {
  it("keeps a Preview body tap inside the unsaved workflow", () => {
    const focus = vi.fn();
    const navigateToProfile = vi.fn();

    focusPreviewBody(42, focus);

    expect(focus).toHaveBeenCalledExactlyOnceWith(42);
    expect(navigateToProfile).not.toHaveBeenCalled();
  });

  it("uses the HUD save routing from the Preview/Edit bar", async () => {
    const save = vi.fn().mockResolvedValue(undefined);

    await previewSaveAction(save);

    expect(save).toHaveBeenCalledExactlyOnceWith();
  });

  it("commits once, hydrates a cold preferences store, then publishes lastSystem", async () => {
    await saveCustomBuilderDraft({
      systemRef: null,
      name: "Friends",
      rules: [],
      overrideIntent: [],
      prunableExclusionContactIds: [],
      now: "now",
    });
    expect(saveSystemDefinition).toHaveBeenCalledTimes(1);
    expect(prefsHydrate.mock.invocationCallOrder[0]).toBeLessThan(
      prefsSave.mock.invocationCallOrder[0],
    );
    expect(prefsSave).toHaveBeenCalledWith("exec", {
      lastSystem: "custom:new-system",
    });
  });

  it("does not select after a failed atomic save", async () => {
    saveSystemDefinition.mockRejectedValueOnce(new Error("write failed"));
    await expect(
      saveCustomBuilderDraft({
        systemRef: null,
        name: "Friends",
        rules: [],
        overrideIntent: [],
        prunableExclusionContactIds: [],
        now: "now",
      }),
    ).rejects.toThrow("write failed");
    expect(prefsSave).not.toHaveBeenCalled();
  });

  it("keeps edit saves on the data-revision path without writing lastSystem", async () => {
    hydrated = true;
    await saveCustomBuilderDraft({
      systemRef: "custom:existing",
      name: "Friends",
      rules: [],
      overrideIntent: [],
      prunableExclusionContactIds: [],
      now: "now",
    });
    expect(saveSystemDefinition).toHaveBeenCalledTimes(1);
    expect(prefsHydrate).not.toHaveBeenCalled();
    expect(prefsSave).not.toHaveBeenCalled();
  });

  it("uses the immutable-base override composite without selecting a System", async () => {
    await saveOverrideBuilderDraft({
      systemRef: "builtin:favorites",
      overrideIntent: [{ contactId: 5, mode: "exclude" }],
      prunableExclusionContactIds: [],
      now: "now",
    });
    expect(saveMembershipOverrides).toHaveBeenCalledWith("exec", {
      systemRef: "builtin:favorites",
      overrideIntent: [{ contactId: 5, mode: "exclude" }],
      prunableExclusionContactIds: [],
      now: "now",
    });
    expect(saveSystemDefinition).not.toHaveBeenCalled();
    expect(prefsSave).not.toHaveBeenCalled();
  });
});

describe("SystemBuilder category rule catalog", () => {
  const categories = Array.from({ length: 13 }, (_, index) => ({
    value: `category-${index}`,
    label: index === 12 ? "Renamed Family" : `Category ${index}`,
  }));

  it("adds search at 13 categories without clearing hidden selections", () => {
    const view = buildCategoryRuleView(
      categories,
      ["category-0", "category-12"],
      "renamed",
    );

    expect(view.searchable).toBe(true);
    expect(view.selectedCount).toBe(2);
    expect(view.visibleOptions).toEqual([categories[12]]);
    expect(view.selectedValues).toEqual(["category-0", "category-12"]);
  });

  it("keeps UID identity through rename and drops only deleted UIDs", () => {
    expect(
      buildCategoryRuleView(
        [{ value: "family", label: "Family renamed" }],
        ["family", "deleted"],
        "",
      ),
    ).toMatchObject({
      selectedValues: ["family"],
      selectedCount: 1,
      visibleOptions: [{ value: "family", label: "Family renamed" }],
    });
  });

  it("exposes the exact neutral empty state", () => {
    expect(buildCategoryRuleView([], [], "")).toMatchObject({
      searchable: false,
      selectedCount: 0,
      visibleOptions: [],
      emptyCopy: "No categories available",
    });
  });
});

/** SystemBuilderScreen's `useState` call order. Pinned by the slot test. */
const SLOT = {
  page: 0,
  previewing: 1,
  previewScene: 2,
  previewFocusedId: 3,
  ready: 4,
  saving: 5,
  error: 6,
  nameError: 7,
  nameRevealRequest: 8,
  categories: 9,
  baseOverrides: 10,
  overrideIntent: 11,
  baseCandidateIds: 12,
  passthroughRules: 13,
  activeRows: 14,
  rows: 15,
  membership: 16,
  draft: 17,
} as const;
type SlotName = keyof typeof SLOT;

type TestElement = ReactElement<Record<string, unknown>>;
const SCOPED = { danger: "scoped-danger", textSecondary: "scoped-secondary" };

/** Every element in the tree; render-prop children get a scoped palette. */
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  const children = element.props.children;
  const resolved =
    typeof children === "function"
      ? (children as (scoped: typeof SCOPED) => ReactNode)(SCOPED)
      : (children as ReactNode);
  return [element, ...nodes(resolved)];
}

const navigation = { goBack: vi.fn() };

function renderBuilder(seed: Partial<Record<SlotName, unknown>> = {}) {
  hooks.index = 0;
  hooks.seed = new Map(
    Object.entries(seed).map(([key, value]) => [SLOT[key as SlotName], value]),
  );
  const tree = SystemBuilderScreen({
    navigation,
    route: { params: {} },
  } as unknown as Parameters<typeof SystemBuilderScreen>[0]);
  return nodes(tree as ReactNode);
}

function setter(slot: SlotName) {
  return hooks.setters[SLOT[slot]];
}

function byTestId(tree: TestElement[], testID: string) {
  return tree.find((element) => element.props.testID === testID);
}

function saveButton(tree: TestElement[]): TestElement {
  const found = tree.filter(
    (element) =>
      element.type === "Button" && element.props.label === "Save System",
  );
  expect(found).toHaveLength(1);
  return found[0];
}

/** The children array that holds `target`, flattened. */
function siblingsOf(tree: TestElement[], target: TestElement): unknown[] {
  for (const element of tree) {
    const children = element.props.children;
    if (Array.isArray(children)) {
      const flat = children.flat(Number.POSITIVE_INFINITY);
      if (flat.includes(target)) return flat;
    }
  }
  return [];
}

function operationErrorCaptions(tree: TestElement[], message: string) {
  return tree.filter(
    (element) =>
      element.type === "AppText" &&
      element.props.children === message &&
      (element.props.style as { color?: string } | undefined)?.color ===
        SCOPED.danger,
  );
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const NAME_ERROR = "Give this System a name.";
const SAVE_ERROR = "Couldn't save this System.";

describe("SystemBuilder name error vs operation error (38.9 D-19, K-08)", () => {
  beforeEach(() => {
    hooks.runEffects = false;
    for (const spy of hooks.setters) spy?.mockClear();
    reveal.mockReset();
    navigation.goBack.mockReset();
  });
  afterEach(() => {
    hooks.runEffects = false;
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("pins the useState call order the seeding relies on", () => {
    renderBuilder();
    expect(hooks.index).toBe(Object.keys(SLOT).length);
    expect(hooks.initial[SLOT.page]).toBe("definition");
    expect(hooks.initial[SLOT.previewing]).toBe(false);
    expect(hooks.initial[SLOT.ready]).toBe(false);
    expect(hooks.initial[SLOT.saving]).toBe(false);
    expect(hooks.initial[SLOT.error]).toBeNull();
    expect(hooks.initial[SLOT.nameError]).toBeNull();
    expect(hooks.initial[SLOT.nameRevealRequest]).toBe(0);
    expect(hooks.initial[SLOT.membership]).toMatchObject({ memberIds: [] });
    expect(hooks.initial[SLOT.draft]).toMatchObject({ name: "" });
  });

  it("shows the name error under Name and the save failure in the header; typing clears only the name error", () => {
    const tree = renderBuilder({
      ready: true,
      nameError: NAME_ERROR,
      error: SAVE_ERROR,
    });
    const nameInput = byTestId(tree, "system-builder-name") as TestElement;
    expect(nameInput).toBeDefined();
    const fieldError = byTestId(
      tree,
      "system-builder-name-error",
    ) as TestElement;
    expect(fieldError.type).toBe("FieldError");
    expect(fieldError.props.message).toBe(NAME_ERROR);
    const siblings = siblingsOf(tree, nameInput);
    expect(siblings[siblings.indexOf(nameInput) + 1]).toBe(fieldError);
    // The operation error is never a FieldError; it renders in the header.
    expect(
      tree.filter(
        (element) =>
          element.type === "FieldError" && element.props.message === SAVE_ERROR,
      ),
    ).toHaveLength(0);
    expect(operationErrorCaptions(tree, SAVE_ERROR)).toHaveLength(1);

    (nameInput.props.onChangeText as (name: string) => void)("F");
    expect(setter("nameError")).toHaveBeenCalledWith(null);
    expect(setter("draft")).toHaveBeenCalledTimes(1);
    expect(setter("error")).not.toHaveBeenCalled();
  });

  it("keeps the operation error visible on the Members page and in Preview", () => {
    const members = renderBuilder({
      ready: true,
      page: "members",
      error: SAVE_ERROR,
    });
    expect(operationErrorCaptions(members, SAVE_ERROR)).toHaveLength(1);
    expect(byTestId(members, "system-builder-name")).toBeUndefined();

    const preview = renderBuilder({
      ready: true,
      previewing: true,
      error: SAVE_ERROR,
    });
    expect(operationErrorCaptions(preview, SAVE_ERROR)).toHaveLength(1);
  });

  it("a failed save with a name sets the operation error, not the name error", async () => {
    saveSystemDefinition.mockRejectedValueOnce(new Error(SAVE_ERROR));
    const tree = renderBuilder({
      ready: true,
      draft: { name: "Friends", rules: emptyRuleDraft(), overrideIntent: [] },
    });
    (saveButton(tree).props.onPress as () => void)();
    await flush();
    expect(saveSystemDefinition).toHaveBeenCalledTimes(1);
    expect(setter("error")).toHaveBeenCalledWith(SAVE_ERROR);
    for (const [value] of setter("nameError").mock.calls) {
      expect(value).toBeNull();
    }
  });

  it("Save System in Preview with an empty name returns to Definition, shows the name error and reveals Name; nothing is saved (D-69, C8-M2)", async () => {
    const preview = renderBuilder({
      ready: true,
      previewing: true,
      page: "members",
    });
    // Preview has no name input to reveal.
    expect(byTestId(preview, "system-builder-name")).toBeUndefined();
    (saveButton(preview).props.onPress as () => void)();
    await flush();

    expect(setter("previewing")).toHaveBeenCalledWith(false);
    expect(setter("page")).toHaveBeenCalledWith("definition");
    expect(setter("nameError")).toHaveBeenCalledWith(NAME_ERROR);
    expect(setter("nameRevealRequest")).toHaveBeenCalledTimes(1);
    expect(setter("error")).not.toHaveBeenCalledWith(expect.any(String));
    expect(saveSystemDefinition).not.toHaveBeenCalled();
    expect(saveMembershipOverrides).not.toHaveBeenCalled();
    expect(reveal).not.toHaveBeenCalled();

    // The resulting state: Definition, the error set, one reveal requested.
    vi.useFakeTimers();
    hooks.runEffects = true;
    const definition = renderBuilder({
      ready: true,
      nameError: NAME_ERROR,
      nameRevealRequest: 1,
    });
    const nameInput = byTestId(
      definition,
      "system-builder-name",
    ) as TestElement;
    expect(nameInput).toBeDefined();
    expect(
      (byTestId(definition, "system-builder-name-error") as TestElement).props
        .message,
    ).toBe(NAME_ERROR);
    expect(reveal).toHaveBeenCalledTimes(1);
    expect(reveal.mock.calls[0][0]).toBe(nameInput.props.ref);
    expect(reveal.mock.calls[0][1]).toBe(nameInput.props.ref);
    expect(saveSystemDefinition).not.toHaveBeenCalled();
  });

  it("does not run the name reveal while Preview is still showing", () => {
    vi.useFakeTimers();
    hooks.runEffects = true;
    renderBuilder({
      ready: true,
      previewing: true,
      nameError: NAME_ERROR,
      nameRevealRequest: 1,
    });
    expect(reveal).not.toHaveBeenCalled();
  });
});
