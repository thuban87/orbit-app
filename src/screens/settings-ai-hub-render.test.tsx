import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";

/**
 * 38.12-15 render test for Settings → AI (D-85, D-126, D-130, D-88, D-119).
 *
 * The screen is called as a function with its hooks mocked: `useState` slots
 * are seeded by call order and every setter is a spy; `useFocusEffect` hands
 * its callback to the test. The hub's real logic runs over mocked readers —
 * the OpenRouter catalog is the local cache thunk and the key store a mock —
 * so no provider or network call is made.
 */

/** SettingsAIScreen's `useState` call order. Pinned below. */
const SLOT = { error: 0, snapshot: 1 } as const;
const SLOT_COUNT = 2;

const hooks = vi.hoisted(() => ({
  index: 0,
  seed: new Map<number, unknown>(),
  setters: [] as ReturnType<typeof vi.fn>[],
  focus: [] as (() => void)[],
}));
const nav = vi.hoisted(() => ({ navigate: vi.fn() }));
const store = vi.hoisted(() => ({
  state: {
    aiEnabled: true,
    activeConnection: "openrouter" as string | null,
    hydrated: true,
    hydrate: vi.fn(async () => undefined),
  },
}));
const reads = vi.hoisted(() => ({
  resolveActiveAiConnection: vi.fn(),
  loadCachedOpenRouterCatalog: vi.fn(),
  getKey: vi.fn(async (): Promise<string | null> => "SYNTHETIC-KEY"),
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useCallback: <T,>(callback: T) => callback,
  useState: (value: unknown) => {
    const slot = hooks.index++;
    if (!hooks.setters[slot]) hooks.setters[slot] = vi.fn();
    return [
      hooks.seed.has(slot) ? hooks.seed.get(slot) : value,
      hooks.setters[slot],
    ];
  },
}));
vi.mock("@react-navigation/native", () => ({
  useFocusEffect: (callback: () => void) => {
    hooks.focus.push(callback);
  },
  useNavigation: () => nav,
}));
vi.mock("expo-file-system", () => ({
  File: vi.fn(),
  Paths: { document: "document" },
}));
vi.mock("react-native", () => ({
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  Text: "Text",
  View: "View",
}));
vi.mock("@/ai/openrouter-catalog", () => ({
  loadCachedOpenRouterCatalog: reads.loadCachedOpenRouterCatalog,
}));
vi.mock("@/components/AIFirstUseDisclosure", () => ({
  AIFirstUseDisclosure: "AIFirstUseDisclosure",
}));
vi.mock("@/components/ShellAppBar", () => ({ ShellAppBar: "ShellAppBar" }));
vi.mock("@/components/ui", () => ({
  AppText: "AppText",
  OrbitSwitch: "OrbitSwitch",
  SettingsRow: "SettingsRow",
  SettingsSectionCard: "SettingsSectionCard",
}));
vi.mock("@/db/ai-connections-dao", () => ({
  resolveActiveAiConnection: reads.resolveActiveAiConnection,
}));
vi.mock("@/db/app-settings-dao", () => ({ updateAppSettings: vi.fn() }));
vi.mock("@/db/database", () => ({
  getExecutor: () => ({ id: "exec" }),
  localDateTime: () => "2026-10-17 12:00:00",
}));
vi.mock("@/navigation/use-bottom-clearance", () => ({
  useBottomClearance: () => 96,
}));
vi.mock("@/services/ai-key-store", () => ({
  aiKeyStore: { getKey: reads.getKey },
}));
vi.mock("@/stores/ai-config-store", () => {
  const useAiConfigStore = (select: (s: typeof store.state) => unknown) =>
    select(store.state);
  useAiConfigStore.getState = () => store.state;
  return { useAiConfigStore };
});
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/utils/logger", () => ({ Logger: { error: vi.fn() } }));

const { SettingsAIScreen } = await import("./SettingsAIScreen");

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

function render(seed: Partial<Record<keyof typeof SLOT, unknown>> = {}) {
  hooks.index = 0;
  hooks.focus = [];
  hooks.seed = new Map(
    Object.entries(seed).map(([key, value]) => [
      SLOT[key as keyof typeof SLOT],
      value,
    ]),
  );
  const tree = nodes(SettingsAIScreen() as ReactNode);
  expect(hooks.index).toBe(SLOT_COUNT);
  return tree;
}

const SNAPSHOT = {
  availability: "ready",
  connection: { lane: "openrouter", model: "vendor/model", customEndpoint: "" },
  modelName: "Vendor Model",
};
const row = (tree: TestElement[], testID: string) =>
  tree.find((node) => node.props.testID === testID);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const fetchSpy = vi.fn(async () => {
  throw new Error("network is not allowed in this test");
});

beforeEach(() => {
  hooks.setters = [];
  vi.clearAllMocks();
  store.state.aiEnabled = true;
  store.state.hydrated = true;
  reads.resolveActiveAiConnection.mockResolvedValue(SNAPSHOT.connection);
  reads.loadCachedOpenRouterCatalog.mockResolvedValue({
    source: "local",
    updatedLocalDate: "2026-10-17",
    models: [
      {
        id: "vendor/model",
        name: "Vendor Model",
        contextLength: null,
        pricing: {},
      },
    ],
  });
  vi.stubGlobal("fetch", fetchSpy);
});
afterEach(() => {
  vi.unstubAllGlobals();
  expect(fetchSpy).not.toHaveBeenCalled();
});

describe("the AI master switch reads 'Use AI suggestions' (38.12 D-130)", () => {
  it("the switch row's title and the switch's accessible name use the glossary label", () => {
    const tree = render();
    const master = tree.find(
      (node) =>
        node.type === "SettingsRow" &&
        node.props.title === "Use AI suggestions",
    );
    expect(master).toBeDefined();
    const toggle = master?.props.trailing as TestElement;
    expect(toggle.type).toBe("OrbitSwitch");
    expect(toggle.props.testID).toBe("settings-ai-enabled");
    expect(toggle.props.accessibilityLabel).toBe("Use AI suggestions");
    const copy = JSON.stringify(tree.map((node) => node.props.title ?? null));
    expect(copy).not.toContain("AI Enabled");
  });
});

describe("Settings → AI hub rows (38.12 D-85, D-126, D-119)", () => {
  it("five shared rows inside a shared section card, one 'Style and Context' row", () => {
    const tree = render({ snapshot: SNAPSHOT });
    const hub = row(tree, "settings-ai-expanded");
    expect(hub?.type).toBe("SettingsSectionCard");
    const rows = nodes(hub?.props.children as ReactNode).filter(
      (node) => node.type === "SettingsRow",
    );
    expect(rows.map((node) => [node.props.testID, node.props.title])).toEqual([
      ["settings-ai-entry-connection", "Connection"],
      ["settings-ai-entry-model", "Model"],
      ["settings-ai-entry-style-and-context", "Style and Context"],
      ["settings-ai-entry-ai-data-permissions", "AI Data Permissions"],
      [
        "settings-ai-entry-preview-what-orbit-sends",
        "Preview What Orbit Sends",
      ],
    ]);
    expect(
      tree.some(
        (node) =>
          node.props.title === "Writing Style" ||
          node.props.title === "Personalization Context",
      ),
    ).toBe(false);
  });

  it("Connection and Model show the current values from the loaded snapshot", () => {
    const tree = render({ snapshot: SNAPSHOT });
    const connection = row(tree, "settings-ai-entry-connection");
    expect(connection?.props.value).toBe("OpenRouter · Vendor Model");
    expect(connection?.props.subtitle).toBe("Ready");
    expect(row(tree, "settings-ai-entry-model")?.props.value).toBe(
      "Vendor Model",
    );
  });

  it("Style and Context opens the personalization page with no section target", () => {
    const tree = render({ snapshot: SNAPSHOT });
    (
      row(tree, "settings-ai-entry-style-and-context")?.props
        .onPress as () => void
    )();
    expect(nav.navigate).toHaveBeenCalledTimes(1);
    expect(nav.navigate.mock.calls[0]).toEqual(["AIPersonalization"]);
  });

  it("a focus load fills the snapshot with the model's name, never the key", async () => {
    render();
    hooks.focus[0]();
    await flush();
    const filled = hooks.setters[SLOT.snapshot].mock.calls.at(-1)?.[0];
    expect(filled).toEqual(SNAPSHOT);
    expect(JSON.stringify(filled)).not.toContain("SYNTHETIC-KEY");
  });
});

describe("the hub error clears on a good reload (38.12 D-88)", () => {
  it("a failed load shows the error; the next good reload clears it", async () => {
    reads.resolveActiveAiConnection.mockRejectedValueOnce(
      new Error("db unavailable"),
    );
    render();
    hooks.focus[0]();
    await flush();
    expect(hooks.setters[SLOT.error].mock.calls.at(-1)).toEqual([
      "Couldn't load AI settings. Please try again.",
    ]);

    // The banner is on screen while the error is set…
    expect(
      row(
        render({ error: "Couldn't load AI settings. Please try again." }),
        "settings-ai-error",
      ),
    ).toBeDefined();

    // …and a good reload sets it back to null.
    hooks.focus[0]();
    await flush();
    expect(hooks.setters[SLOT.error].mock.calls.at(-1)).toEqual([null]);
    expect(row(render({ error: null }), "settings-ai-error")).toBeUndefined();
  });
});
