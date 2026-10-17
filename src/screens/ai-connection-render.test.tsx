import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";

/**
 * 38.12-15 render test for AI Connection (D-84 / K-36, D-17, D-88, D-119).
 *
 * The screen is called as a function with its hooks mocked: `useState` slots
 * are seeded by call order and every setter is a spy; `useFocusEffect` hands
 * its callback to the test so a focus can be fired. Credential presence comes
 * from a mocked key store — no provider, no OAuth and no network call is made
 * (CONTEXT § Verification; owner memory "No AI API calls without clearing").
 */

/** AIConnectionScreen's `useState` call order. Pinned below. */
const SLOT = {
  connections: 0,
  credentialPresence: 1,
  expanded: 2,
  credentialDraft: 3,
  endpoint: 4,
  customCredential: 5,
  customModel: 6,
  pending: 7,
  removeLane: 8,
  error: 9,
} as const;
const SLOT_COUNT = 10;

const hooks = vi.hoisted(() => ({
  index: 0,
  seed: new Map<number, unknown>(),
  setters: [] as ReturnType<typeof vi.fn>[],
  focus: [] as (() => void)[],
}));
const store = vi.hoisted(() => ({
  state: { activeConnection: null as string | null },
  hydrate: vi.fn(async () => undefined),
}));
const keyStore = vi.hoisted(() => ({
  getKey: vi.fn(async (): Promise<string | null> => null),
  setKey: vi.fn(),
  deleteKey: vi.fn(),
  readRawCustomItem: vi.fn(),
  restoreRawCustomItem: vi.fn(),
}));
const dao = vi.hoisted(() => ({
  activateAiConnection: vi.fn(),
  listAiConnections: vi.fn(async (): Promise<unknown[]> => []),
  upsertAiConnection: vi.fn(),
}));
const provider = vi.hoisted(() => ({ connectOpenRouter: vi.fn() }));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useCallback: <T,>(callback: T) => callback,
  useMemo: <T,>(factory: () => T) => factory(),
  useRef: <T,>(value: T) => ({ current: value }),
  useState: (value: unknown) => {
    const slot = hooks.index++;
    const initial =
      typeof value === "function" ? (value as () => unknown)() : value;
    if (!hooks.setters[slot]) hooks.setters[slot] = vi.fn();
    return [
      hooks.seed.has(slot) ? hooks.seed.get(slot) : initial,
      hooks.setters[slot],
    ];
  },
}));
vi.mock("@react-navigation/native", () => ({
  useFocusEffect: (callback: () => void) => {
    hooks.focus.push(callback);
  },
}));
vi.mock("react-native", () => ({
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("@/ai/openrouter-oauth", () => provider);
vi.mock("@/components/ShellAppBar", () => ({ ShellAppBar: "ShellAppBar" }));
vi.mock("@/components/ui", () => ({
  AppText: "AppText",
  Button: "Button",
  ConfirmDialog: "ConfirmDialog",
  SettingsSectionCard: "SettingsSectionCard",
}));
vi.mock("@/db/ai-connections-dao", () => dao);
vi.mock("@/db/database", () => ({
  getExecutor: () => ({ id: "exec" }),
  localDateTime: () => "2026-10-17 12:00:00",
}));
vi.mock("@/navigation/use-bottom-clearance", () => ({
  useBottomClearance: () => 96,
}));
vi.mock("@/services/ai-key-store", () => ({ aiKeyStore: keyStore }));
vi.mock("@/stores/ai-config-store", () => {
  const useAiConfigStore = (select: (s: typeof store.state) => unknown) =>
    select(store.state);
  useAiConfigStore.getState = () => ({ hydrate: store.hydrate });
  return { useAiConfigStore };
});
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/utils/logger", () => ({ Logger: { error: vi.fn() } }));
vi.mock("./settings-ai-logic", () => ({
  CUSTOM_RETENTION_CAVEAT: "Retention caveat",
}));

const { AIConnectionScreen } = await import("./AIConnectionScreen");

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

const onChooseModel = vi.fn();
function render(seed: Partial<Record<keyof typeof SLOT, unknown>> = {}) {
  hooks.index = 0;
  hooks.focus = [];
  hooks.seed = new Map(
    Object.entries(seed).map(([key, value]) => [
      SLOT[key as keyof typeof SLOT],
      value,
    ]),
  );
  const tree = nodes(AIConnectionScreen({ onChooseModel }) as ReactNode);
  expect(hooks.index).toBe(SLOT_COUNT);
  return tree;
}

/** The card for `lane`, as its own subtree. */
function cardTree(tree: TestElement[], lane: string): TestElement[] {
  const card = tree.find(
    (node) => node.props.testID === `ai-connection-card-${lane}`,
  );
  if (!card) throw new Error(`no ${lane} card`);
  return nodes(card);
}
const buttons = (tree: TestElement[]) =>
  tree.filter((node) => node.type === "Button");
const status = (tree: TestElement[], lane: string) =>
  tree.find((node) => node.props.testID === `ai-connection-status-${lane}`)
    ?.props.children;

const connection = (lane: string, extra: Record<string, unknown> = {}) => ({
  id: 1,
  uid: `uid-${lane}`,
  lane,
  rememberedModel: "vendor/model",
  customEndpoint: "",
  customModel: "",
  configuredAt: "2026-10-17 11:00:00",
  createdAt: "2026-10-17 11:00:00",
  modifiedAt: "2026-10-17 11:00:00",
  ...extra,
});
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const fetchSpy = vi.fn(async () => {
  throw new Error("network is not allowed in this test");
});

beforeEach(() => {
  hooks.setters = [];
  store.state.activeConnection = null;
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchSpy);
});
afterEach(() => {
  vi.unstubAllGlobals();
  // No provider, OAuth or network call anywhere in this file (D-84, N-04).
  expect(provider.connectOpenRouter).not.toHaveBeenCalled();
  expect(fetchSpy).not.toHaveBeenCalled();
});

describe("AI Connection tells the truth about a connected lane (38.12 D-84, K-36)", () => {
  it("the active lane with a key reads Connected with Change model as the primary action", () => {
    store.state.activeConnection = "openrouter";
    const card = cardTree(
      render({
        connections: [connection("openrouter")],
        credentialPresence: { openrouter: true },
      }),
      "openrouter",
    );
    expect(status(card, "openrouter")).toBe("Connected");
    const primary = buttons(card).filter(
      (node) => node.props.role === "primary",
    );
    expect(primary.map((node) => node.props.label)).toEqual(["Change model"]);
    (primary[0].props.onPress as () => void)();
    expect(onChooseModel).toHaveBeenCalledWith("openrouter");
  });

  it("Disconnect is present but demoted — not primary and not the red destructive trigger", () => {
    store.state.activeConnection = "openrouter";
    const card = cardTree(
      render({
        connections: [connection("openrouter")],
        credentialPresence: { openrouter: true },
      }),
      "openrouter",
    );
    const disconnect = buttons(card).find(
      (node) => node.props.label === "Disconnect",
    );
    expect(disconnect).toBeDefined();
    expect(disconnect?.props.role).toBe("tertiary");
    // The connect action steps down too; it no longer says "Connect".
    const reconnect = buttons(card).find(
      (node) => node.props.label === "Reconnect",
    );
    expect(reconnect?.props.role).toBe("secondary");
  });

  it("an active lane without a key keeps the Connect primary and no Change model", () => {
    store.state.activeConnection = "openrouter";
    const card = cardTree(
      render({
        connections: [connection("openrouter")],
        credentialPresence: { openrouter: false },
      }),
      "openrouter",
    );
    expect(status(card, "openrouter")).toBe("Active");
    const labels = buttons(card).map((node) => node.props.label);
    expect(labels).toContain("Connect with OpenRouter");
    expect(labels).not.toContain("Change model");
  });

  it("a connected direct lane offers Change model first and Replace key second", () => {
    store.state.activeConnection = "openai";
    const card = cardTree(
      render({
        connections: [connection("openai", { rememberedModel: "gpt-live" })],
        credentialPresence: { openai: true },
        expanded: "openai",
      }),
      "openai",
    );
    expect(status(card, "openai")).toBe("Connected");
    expect(
      buttons(card).map((node) => [node.props.label, node.props.role]),
    ).toEqual([
      ["Change model", "primary"],
      ["Replace key", "secondary"],
      ["Remove key", "tertiary"],
    ]);
  });
});

describe("Recommended and the default OpenRouter expansion stay (38.12 D-17)", () => {
  it("OpenRouter sits under Recommended and opens expanded", () => {
    const tree = render();
    const cards = tree.filter((node) => node.type === "SettingsSectionCard");
    expect(cards.map((card) => card.props.title)).toEqual([
      "Recommended",
      "Advanced Setup",
    ]);
    expect(
      buttons(cardTree(tree, "openrouter")).map((node) => node.props.label),
    ).toContain("Connect with OpenRouter");
  });

  it("the sections draw on the shared Settings section card, not glass (D-119)", () => {
    const tree = render();
    expect(tree.some((node) => node.type === "GlassSurface")).toBe(false);
  });
});

describe("AI Connection reloads on focus and reads presence locally (38.12 D-84, D-88)", () => {
  it("a focus re-reads the saved connections and each lane's credential presence", async () => {
    dao.listAiConnections.mockResolvedValueOnce([
      connection("openrouter"),
      connection("custom", {
        rememberedModel: "local-model",
        customEndpoint: "https://saved.example.com/v1",
        customModel: "local-model",
      }),
    ]);
    keyStore.getKey.mockImplementation(async (lane?: unknown) =>
      lane === "openrouter" ? "SYNTHETIC-KEY-DO-NOT-USE" : null,
    );
    render();
    expect(hooks.focus).toHaveLength(1);
    hooks.focus[0]();
    await flush();

    expect(dao.listAiConnections).toHaveBeenCalledTimes(1);
    expect(keyStore.getKey).toHaveBeenCalledWith("openrouter", undefined);
    expect(keyStore.getKey).toHaveBeenCalledWith(
      "custom",
      "https://saved.example.com/v1",
    );
    // Presence only: booleans reach UI state, never the key value.
    expect(hooks.setters[SLOT.credentialPresence]).toHaveBeenCalledWith({
      openrouter: true,
      custom: false,
    });
    const presenceCall = JSON.stringify(
      hooks.setters[SLOT.credentialPresence].mock.calls,
    );
    expect(presenceCall).not.toContain("SYNTHETIC-KEY-DO-NOT-USE");
    expect(store.hydrate).toHaveBeenCalledTimes(1);

    // A second focus reloads again.
    hooks.focus[0]();
    await flush();
    expect(dao.listAiConnections).toHaveBeenCalledTimes(2);
  });

  it("the Custom Endpoint fields prefill from the saved connection", async () => {
    dao.listAiConnections.mockResolvedValueOnce([
      connection("custom", {
        rememberedModel: "local-model",
        customEndpoint: "https://saved.example.com/v1",
        customModel: "local-model",
      }),
    ]);
    render();
    hooks.focus[0]();
    await flush();
    expect(hooks.setters[SLOT.endpoint]).toHaveBeenCalledWith(
      "https://saved.example.com/v1",
    );
    expect(hooks.setters[SLOT.customModel]).toHaveBeenCalledWith("local-model");
    // The secret field is never prefilled.
    expect(hooks.setters[SLOT.customCredential]).not.toHaveBeenCalled();
  });

  it("the prefilled values show in the Custom fields", () => {
    const card = cardTree(
      render({
        expanded: "custom",
        endpoint: "https://saved.example.com/v1",
        customModel: "local-model",
      }),
      "custom",
    );
    const field = (label: string) =>
      card.find(
        (node) =>
          node.type === "TextInput" && node.props.accessibilityLabel === label,
      )?.props.value;
    expect(field("Custom endpoint base URL")).toBe(
      "https://saved.example.com/v1",
    );
    expect(field("Custom endpoint model id")).toBe("local-model");
    expect(field("Custom endpoint optional credential")).toBe("");
  });

  it("a load failure shows the load error; a good reload clears it", async () => {
    dao.listAiConnections.mockRejectedValueOnce(new Error("db unavailable"));
    render();
    hooks.focus[0]();
    await flush();
    expect(hooks.setters[SLOT.error]).toHaveBeenCalledWith(
      "Couldn't load saved AI connections.",
    );

    hooks.setters[SLOT.error].mockClear();
    hooks.focus[0]();
    await flush();
    const update = hooks.setters[SLOT.error].mock.calls[0]?.[0] as (
      current: string | null,
    ) => string | null;
    expect(update("Couldn't load saved AI connections.")).toBeNull();
    // An unrelated action error is left alone.
    expect(update("Couldn't save that connection.")).toBe(
      "Couldn't save that connection.",
    );
  });
});
