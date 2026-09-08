import { beforeEach, describe, expect, it, vi } from "vitest";

const saveSystemDefinition = vi.fn();
const saveMembershipOverrides = vi.fn();
const prefsSave = vi.fn();
const prefsHydrate = vi.fn();
let hydrated = false;

vi.mock("react", () => ({
  useCallback: <T,>(callback: T) => callback,
  useEffect: () => {},
  useMemo: <T,>(factory: () => T) => factory(),
  useRef: <T,>(value: T) => ({ current: value }),
  useState: <T,>(value: T) => [value, () => {}],
}));
vi.mock("react-native", () => ({
  Alert: { alert: vi.fn() },
  AppState: { addEventListener: () => ({ remove: () => {} }) },
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
const { previewSaveAction } = await import("./SystemBuilderScreen");
const { focusPreviewBody } = await import(
  "@/components/orrery/SystemPreviewCanvas"
);

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
