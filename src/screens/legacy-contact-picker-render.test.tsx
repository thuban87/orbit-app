import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The legacy contact picker for phones below SDK 37 (38.12 D-57, D-110).
 * Renders the REAL LegacyContactPickerScreen with mocked permission, contact
 * reads and import routing through a STATEFUL hook store (state and refs
 * persist across renders; an effect or a focus effect runs once on first
 * render; `render()` re-runs the screen). Local helper components are
 * expanded in place; shared primitives are mocked as host strings.
 *
 *  - denied: "Try again" re-asks; "Not now" leaves through exitFlow(host);
 *  - permanently denied: "Open Settings"; "Not now" leaves through exitFlow;
 *  - a failed contact read shows an EmptyState whose action reloads;
 *  - an import failure keeps the list and the selection, with an error
 *    snackbar;
 *  - the import runs inside withImportFlowActive, like the system path;
 *  - routePickedImport receives options.host from route.params.host (A-1).
 */

const hooks = vi.hoisted(() => ({
  stateIndex: 0,
  refIndex: 0,
  effectIndex: 0,
  states: [] as unknown[],
  setters: [] as ((value: unknown) => void)[],
  refs: [] as { current: unknown }[],
  effectsRun: new Set<number>(),
}));

function runOnce(effect: () => unknown): void {
  const slot = hooks.effectIndex++;
  if (hooks.effectsRun.has(slot)) return;
  hooks.effectsRun.add(slot);
  effect();
}

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useCallback: <T,>(callback: T) => callback,
  useEffect: runOnce,
  useMemo: <T,>(factory: () => T) => factory(),
  useRef: <T,>(value: T) => {
    const slot = hooks.refIndex++;
    if (!hooks.refs[slot]) hooks.refs[slot] = { current: value };
    return hooks.refs[slot];
  },
  useState: (value: unknown) => {
    const slot = hooks.stateIndex++;
    if (!(slot in hooks.states)) {
      hooks.states[slot] =
        typeof value === "function" ? (value as () => unknown)() : value;
    }
    if (!hooks.setters[slot]) {
      hooks.setters[slot] = (next: unknown) => {
        hooks.states[slot] =
          typeof next === "function"
            ? (next as (current: unknown) => unknown)(hooks.states[slot])
            : next;
      };
    }
    return [hooks.states[slot], hooks.setters[slot]];
  },
}));
vi.mock("expo-sqlite", () => ({}));
vi.mock("expo-image", () => ({ Image: "Image" }));
vi.mock("@react-navigation/native", () => ({ useFocusEffect: runOnce }));
vi.mock("react-native", () => ({
  AppState: { addEventListener: () => ({ remove: () => {} }) },
  FlatList: "FlatList",
  Pressable: "Pressable",
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }),
}));
vi.mock("@/components/Avatar", () => ({ Avatar: "Avatar" }));
vi.mock("@/components/PhotoBudgetSheet", () => ({
  usePhotoBudgetPrompt: () => ({ sheet: null, ask: mocks.askPhotoBudget }),
}));
vi.mock("@/components/ShellAppBar", () => ({ ShellAppBar: "ShellAppBar" }));
vi.mock("@/components/ui", () => ({
  AppText: "AppText",
  Button: "Button",
  EmptyState: "EmptyState",
}));

const mocks = vi.hoisted(() => ({
  askPhotoBudget: vi.fn(),
  getContactsPermissionState: vi.fn(),
  requestContactsPermission: vi.fn(),
  openContactsSettings: vi.fn(async () => {}),
  listContactsSummary: vi.fn(),
  readAllContacts: vi.fn(),
  routePickedImport: vi.fn(),
  exitFlow: vi.fn(),
  showSnackbar: vi.fn(),
  flowActiveDuringRoute: [] as boolean[],
}));

vi.mock("@/db/app-settings-dao", () => ({
  getAppSettings: async () => ({ phoneRegionOverride: null }),
}));
vi.mock("@/db/database", () => ({
  getExecutor: () => "exec",
  localDateTime: () => "2026-10-17 12:00:00",
}));
vi.mock("@/navigation/flow-host", () => ({
  DEFAULT_FLOW_HOST: { kind: "settings" },
  exitFlow: mocks.exitFlow,
}));
vi.mock("@/services/contacts/use-read-contacts-permission", () => ({
  getContactsPermissionState: mocks.getContactsPermissionState,
  openContactsSettings: mocks.openContactsSettings,
  requestContactsPermission: mocks.requestContactsPermission,
}));
vi.mock("@/services/device-region", () => ({ getDeviceRegion: () => "US" }));
vi.mock("@/services/import/import-acquire", () => ({
  routePickedImport: mocks.routePickedImport,
}));
vi.mock("@/stores/snackbar-store", () => ({
  showSnackbar: mocks.showSnackbar,
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({
    colors: {
      surface: "surface",
      border: "border",
      borderStrong: "borderStrong",
      textPrimary: "textPrimary",
      textSecondary: "textSecondary",
      textPlaceholder: "textPlaceholder",
      accent: "accent",
      onAccent: "onAccent",
    },
  }),
}));
vi.mock("@/utils/logger", () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));
vi.mock("../../modules/orbit-contact-picker", () => ({
  listContactsSummary: mocks.listContactsSummary,
  readAllContacts: mocks.readAllContacts,
}));

const { isImportFlowActive } = await import(
  "@/services/import/import-flow-guard"
);
const { LegacyContactPickerScreen } = await import(
  "./LegacyContactPickerScreen"
);

type TestElement = ReactElement<Record<string, unknown>>;

/** Flatten the tree, expanding the screen file's own helper components. */
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  if (typeof element.type === "function") {
    return [
      element,
      ...nodes((element.type as (props: unknown) => ReactNode)(element.props)),
    ];
  }
  return [element, ...nodes(element.props.children as ReactNode)];
}

function text(node: TestElement): string {
  return [node, ...nodes(node.props.children as ReactNode)]
    .flatMap((n) => n.props.children)
    .filter(
      (child): child is string | number =>
        typeof child === "string" || typeof child === "number",
    )
    .join("");
}

const DIGEST = { kind: "digest" } as const;
const navigation = {
  navigate: vi.fn(),
  dispatch: vi.fn(),
  goBack: vi.fn(),
  getState: vi.fn(),
  getParent: vi.fn(),
  addListener: vi.fn(() => () => {}),
};

type Params = { host?: unknown } | undefined;

const DIGEST_PARAMS: Params = { host: DIGEST };

function render(params: Params = DIGEST_PARAMS): TestElement[] {
  hooks.stateIndex = 0;
  hooks.refIndex = 0;
  hooks.effectIndex = 0;
  return nodes(
    (LegacyContactPickerScreen as (props: never) => ReactNode)({
      navigation,
      route: { params },
    } as never),
  );
}

async function flush() {
  for (let i = 0; i < 8; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function settled(params: Params = DIGEST_PARAMS): Promise<TestElement[]> {
  render(params);
  await flush();
  return render(params);
}

/** A control by its visible label or its accessibility label. */
function control(tree: TestElement[], label: string): TestElement {
  const found = tree.find(
    (node) =>
      (node.type === "Button" || node.type === "Pressable") &&
      (node.props.label === label || node.props.accessibilityLabel === label),
  );
  if (!found) throw new Error(`no control "${label}"`);
  return found;
}

function hasControl(tree: TestElement[], label: string): boolean {
  return tree.some(
    (node) =>
      (node.type === "Button" || node.type === "Pressable") &&
      (node.props.label === label || node.props.accessibilityLabel === label),
  );
}

function press(tree: TestElement[], label: string): void {
  (control(tree, label).props.onPress as () => void)();
}

const SUMMARIES = [
  {
    lookupKey: "ann",
    displayName: "Ann Lee",
    methods: ["555 0100"],
    photoThumbUri: null,
  },
  {
    lookupKey: "bob",
    displayName: "Bob Ray",
    methods: [],
    photoThumbUri: null,
  },
];

function granted() {
  mocks.getContactsPermissionState.mockResolvedValue({
    verdict: "granted",
    denialCount: 0,
  });
}

/** Load the list and tick the first contact. */
async function selectAnn(params?: Params): Promise<TestElement[]> {
  granted();
  mocks.listContactsSummary.mockResolvedValue(SUMMARIES);
  let tree = await settled(params);
  const list = tree.find((node) => node.type === "FlatList");
  if (!list) throw new Error("no list");
  const renderItem = list.props.renderItem as (info: {
    item: unknown;
  }) => TestElement;
  const data = list.props.data as { lookupKey: string }[];
  const row = renderItem({ item: data[0] });
  (row.props.onPress as () => void)();
  tree = render(params);
  expect(hasControl(tree, "Import 1 contact")).toBe(true);
  return tree;
}

beforeEach(() => {
  hooks.states = [];
  hooks.setters = [];
  hooks.refs = [];
  hooks.effectsRun = new Set();
  vi.clearAllMocks();
  mocks.flowActiveDuringRoute = [];
  mocks.readAllContacts.mockResolvedValue({
    contacts: [{ lookupKey: "ann" }],
    omittedCount: 0,
  });
  mocks.routePickedImport.mockImplementation(async () => {
    mocks.flowActiveDuringRoute.push(isImportFlowActive());
    return { status: "routed", sessionId: 7 };
  });
});

describe("legacy picker denied states have a way out (D-57)", () => {
  it("denied: Try again asks again; Not now leaves through exitFlow with the host", async () => {
    mocks.getContactsPermissionState.mockResolvedValue({
      verdict: "denied",
      denialCount: 1,
    });
    mocks.requestContactsPermission.mockResolvedValue({
      granted: false,
      verdict: "denied",
      denialCount: 2,
    });
    const tree = await settled();
    press(tree, "Try again");
    expect(mocks.requestContactsPermission).toHaveBeenCalledTimes(1);
    press(tree, "Not now");
    expect(mocks.exitFlow).toHaveBeenCalledWith(navigation, DIGEST);
  });

  it("denied twice still offers Open Settings beside Not now", async () => {
    mocks.getContactsPermissionState.mockResolvedValue({
      verdict: "denied",
      denialCount: 2,
    });
    const tree = await settled();
    press(tree, "Open Settings");
    expect(mocks.openContactsSettings).toHaveBeenCalledTimes(1);
    expect(hasControl(tree, "Not now")).toBe(true);
  });

  it("permanently denied: Open Settings, and Not now leaves through exitFlow", async () => {
    mocks.getContactsPermissionState.mockResolvedValue({
      verdict: "permanent",
      denialCount: 3,
    });
    const tree = await settled();
    press(tree, "Open Settings");
    expect(mocks.openContactsSettings).toHaveBeenCalledTimes(1);
    press(tree, "Not now");
    expect(mocks.exitFlow).toHaveBeenCalledWith(navigation, DIGEST);
  });

  it("with no host, Not now exits to the default (Settings) host", async () => {
    mocks.getContactsPermissionState.mockResolvedValue({
      verdict: "permanent",
      denialCount: 3,
    });
    // A route opened without params (`LegacyContactPicker: … | undefined`).
    const tree = await settled({});
    press(tree, "Not now");
    expect(mocks.exitFlow).toHaveBeenCalledWith(navigation, {
      kind: "settings",
    });
  });
});

describe("legacy picker read error offers a retry (D-57)", () => {
  it("a failed read shows an EmptyState whose action reloads the list", async () => {
    granted();
    mocks.listContactsSummary
      .mockRejectedValueOnce(new Error("provider down"))
      .mockResolvedValueOnce(SUMMARIES);
    let tree = await settled();
    const empty = tree.find((node) => node.type === "EmptyState");
    if (!empty) throw new Error("no EmptyState");
    expect(empty.props.testID).toBe("legacy-picker-read-error");
    expect(empty.props.heading).toBe("Couldn't read contacts");
    const action = empty.props.action as { label: string; onPress: () => void };
    expect(action.label).toBe("Try again");
    action.onPress();
    await flush();
    tree = render();
    expect(mocks.listContactsSummary).toHaveBeenCalledTimes(2);
    expect(tree.some((node) => node.type === "FlatList")).toBe(true);
    expect(tree.some((node) => node.type === "EmptyState")).toBe(false);
  });
});

describe("legacy picker import (D-57, D-110)", () => {
  it("an import failure keeps the list and the selection, with an error snackbar", async () => {
    let tree = await selectAnn();
    mocks.readAllContacts.mockRejectedValueOnce(new Error("read failed"));
    press(tree, "Import 1 contact");
    await flush();
    tree = render();
    expect(tree.some((node) => node.type === "FlatList")).toBe(true);
    expect(hasControl(tree, "Import 1 contact")).toBe(true);
    expect(control(tree, "Import 1 contact").props.disabled).toBe(false);
    expect(mocks.showSnackbar).toHaveBeenCalledTimes(1);
    expect(mocks.showSnackbar.mock.calls[0][0]).toMatchObject({
      kind: "error",
    });
  });

  it("a routing failure also keeps the selection", async () => {
    let tree = await selectAnn();
    mocks.routePickedImport.mockRejectedValueOnce(new Error("db busy"));
    press(tree, "Import 1 contact");
    await flush();
    tree = render();
    expect(hasControl(tree, "Import 1 contact")).toBe(true);
    expect(mocks.showSnackbar).toHaveBeenCalledTimes(1);
  });

  it("runs the import inside the import-flow guard, like the system path", async () => {
    const tree = await selectAnn();
    expect(isImportFlowActive()).toBe(false);
    press(tree, "Import 1 contact");
    await flush();
    expect(mocks.flowActiveDuringRoute).toEqual([true]);
    expect(isImportFlowActive()).toBe(false);
  });

  it("passes the flow host into routePickedImport (A-1)", async () => {
    const tree = await selectAnn();
    press(tree, "Import 1 contact");
    await flush();
    expect(mocks.routePickedImport).toHaveBeenCalledTimes(1);
    const [, contacts, options] = mocks.routePickedImport.mock.calls[0];
    expect(contacts).toEqual([{ lookupKey: "ann" }]);
    expect(options).toMatchObject({
      host: DIGEST,
      decidePhotoBudget: mocks.askPhotoBudget,
    });
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
  });
});

describe("legacy picker polish (D-57)", () => {
  async function loadedList(): Promise<TestElement[]> {
    granted();
    mocks.listContactsSummary.mockResolvedValue(SUMMARIES);
    return settled();
  }

  function list(tree: TestElement[]): TestElement {
    const found = tree.find((node) => node.type === "FlatList");
    if (!found) throw new Error("no list");
    return found;
  }

  it("an empty search shows the EmptyState 'No contacts match', and Clear search restores the list", async () => {
    let tree = await loadedList();
    const search = tree.find((node) => node.type === "TextInput");
    if (!search) throw new Error("no search");
    (search.props.onChangeText as (value: string) => void)("zzz");
    tree = render();
    expect(list(tree).props.data).toEqual([]);
    const empty = list(tree).props.ListEmptyComponent as TestElement;
    expect(empty.type).toBe("EmptyState");
    expect(empty.props).toMatchObject({
      testID: "legacy-picker-no-match",
      heading: "No contacts match",
      term: "zzz",
    });
    const action = empty.props.action as { label: string; onPress: () => void };
    expect(action.label).toBe("Clear search");
    action.onPress();
    tree = render();
    expect(list(tree).props.data).toHaveLength(2);
  });

  it("a device with no contacts still says so, not 'No contacts match'", async () => {
    granted();
    mocks.listContactsSummary.mockResolvedValue([]);
    const tree = await settled();
    const empty = list(tree).props.ListEmptyComponent as TestElement;
    expect(empty.type).not.toBe("EmptyState");
    expect(text(empty)).toBe("No contacts on this device");
  });

  it("keeps the bottom safe-area inset under the Import bar", async () => {
    const tree = await loadedList();
    const body = tree.find(
      (node) => node.props.testID === "legacy-picker-body",
    );
    if (!body) throw new Error("no body");
    const style = (body.props.style as object[]).flat();
    expect(style).toContainEqual({ paddingBottom: 16 + 24 });
    const importAt = tree.findIndex(
      (node) => node.props.testID === "legacy-picker-import",
    );
    expect(importAt).toBeGreaterThan(tree.indexOf(body));
  });

  it("renders its copy through AppText roles, with no raw Text", async () => {
    const tree = await selectAnn();
    expect(tree.some((node) => node.type === "Text")).toBe(false);
    const importLabel = nodes(
      control(tree, "Import 1 contact").props.children as ReactNode,
    ).find((node) => node.type === "AppText");
    expect(importLabel?.props.role).toBe("label");
    const row = (
      list(tree).props.renderItem as (info: { item: unknown }) => TestElement
    )({ item: (list(tree).props.data as unknown[])[0] });
    const rowText = nodes(row).filter((node) => node.type === "AppText");
    expect(rowText.map((node) => node.props.role)).toEqual([
      "body",
      "caption",
      "label",
    ]);
    expect(nodes(row).some((node) => node.type === "Text")).toBe(false);
  });
});
