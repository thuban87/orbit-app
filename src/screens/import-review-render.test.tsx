import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Import review form (38.12 D-108, D-54, D-58, D-110; convergence c1 C-6,
 * c2 B-1). Renders the REAL ImportReviewScreen with mocked reads and writes
 * through a STATEFUL hook store (state persists across renders, a setter
 * updates its slot, an effect runs once on first render, `render()` re-runs
 * the screen). Child components are host elements, so the test drives the
 * screen through their props:
 *
 *  - participation reads Bound then Unbound, Unbound selected (D-108);
 *  - the birthday is Edit Contact's BirthdayField, not a text field (D-54);
 *  - Import is a button (D-54);
 *  - method warnings use the effective region, override ?? device (D-54);
 *  - a commitSingleImport that resolved with an id takes the success ending,
 *    even when its finalize failed inside it (D-58, C-6); a creation failure
 *    keeps "Couldn't import";
 *  - the already-linked race fallback and Skip forward the flow host to
 *    ImportComplete (D-110, B-1).
 */

const hooks = vi.hoisted(() => ({
  stateIndex: 0,
  effectIndex: 0,
  states: [] as unknown[],
  setters: [] as ((value: unknown) => void)[],
  effectsRun: new Set<number>(),
}));

vi.mock("@/navigation/use-focused-bottom-inset", () => ({
  useFocusedBottomInset: () => 0,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useCallback: <T,>(callback: T) => callback,
  useEffect: (effect: () => unknown) => {
    const slot = hooks.effectIndex++;
    if (hooks.effectsRun.has(slot)) return;
    hooks.effectsRun.add(slot);
    effect();
  },
  useMemo: <T,>(factory: () => T) => factory(),
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
vi.mock("react-native", () => ({
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("@/components/Avatar", () => ({ Avatar: "Avatar" }));
vi.mock("@/components/BirthdayField", () => ({
  BirthdayField: "BirthdayField",
}));
vi.mock("@/components/ContactMethodsEditor", () => ({
  ContactMethodsEditor: "ContactMethodsEditor",
}));
vi.mock("@/components/category/CategoryChoiceSheet", () => ({
  CategoryChoiceSheet: "CategoryChoiceSheet",
}));
vi.mock("@/components/ExistingContactChoice", () => ({
  LinkExistingChoiceButton: "LinkExistingChoiceButton",
}));
vi.mock("@/components/FrequencyPicker", () => ({
  FrequencyPicker: "FrequencyPicker",
}));
vi.mock("@/components/ShellAppBar", () => ({ ShellAppBar: "ShellAppBar" }));
vi.mock("@/components/ui", () => ({ OptionSelectRow: "OptionSelectRow" }));
vi.mock("@/components/ui/RegisteredModal", () => ({
  RegisteredModal: "RegisteredModal",
}));

const mocks = vi.hoisted(() => ({
  updateMethodDraft: vi.fn(),
  getAppSettings: vi.fn(),
  getDeviceRegion: vi.fn(() => "US"),
  listSessionRows: vi.fn(),
  scoreImportCandidate: vi.fn(),
  commitSingleImport: vi.fn(),
  resolveAlreadyLinked: vi.fn(async (..._args: unknown[]) => {}),
  finalizeSessionIfTerminal: vi.fn(async (..._args: unknown[]) => {}),
  markRowStatus: vi.fn(async (..._args: unknown[]) => {}),
  finishFlow: vi.fn(),
  showSnackbar: vi.fn(),
}));

vi.mock("@/components/contact-methods-editor-model", async (original) => {
  const actual =
    await original<
      typeof import("@/components/contact-methods-editor-model")
    >();
  mocks.updateMethodDraft.mockImplementation(actual.updateMethodDraft);
  return { ...actual, updateMethodDraft: mocks.updateMethodDraft };
});
vi.mock("@/db/app-settings-dao", () => ({
  getAppSettings: mocks.getAppSettings,
}));
vi.mock("@/db/contact-read", () => ({
  getContactHeader: async (_exec: unknown, id: number) => ({
    name: `Orbit ${id}`,
    photo: null,
  }),
  listCategories: async () => [],
}));
vi.mock("@/db/database", () => ({
  getExecutor: () => "exec",
  localDateTime: () => "2026-10-17 12:00:00",
}));
vi.mock("@/db/import-session-dao", () => ({
  finalizeSessionIfTerminal: mocks.finalizeSessionIfTerminal,
  markRowStatus: mocks.markRowStatus,
  resolveAlreadyLinked: mocks.resolveAlreadyLinked,
  UNBOUND_IMPORT: { trackingEnabled: false, intervalDays: null },
}));
vi.mock("@/db/import-session-read", () => ({
  getSessionById: async () => ({ id: 1, phoneRegion: "US" }),
  listSessionRows: mocks.listSessionRows,
}));
vi.mock("@/db/imported-contact-dao", () => ({
  linkExistingContactToRow: vi.fn(async () => {}),
}));
vi.mock("@/hooks/use-category-catalog-refresh", () => ({
  useCategoryCatalogRefresh: () => async () => {},
}));
vi.mock("@/navigation/back-acts-as-done", () => ({
  useBackActsAsDone: () => {},
}));
vi.mock("@/navigation/flow-host", () => ({
  DEFAULT_FLOW_HOST: { kind: "settings" },
  finishFlow: mocks.finishFlow,
  openBinFromFlow: vi.fn(),
  openContactFromFlow: vi.fn(),
}));
vi.mock("@/services/device-region", () => ({
  getDeviceRegion: mocks.getDeviceRegion,
}));
vi.mock("@/services/import/duplicate-evidence", () => ({
  scoreImportCandidate: mocks.scoreImportCandidate,
  candidateEvidenceStrength: () => "strong",
}));
vi.mock("@/services/import/import-acquire", () => ({
  commitSingleImport: mocks.commitSingleImport,
}));
vi.mock("@/services/photos/photo-storage", () => ({
  resolveImportStagingUri: (path: string) => `file:///${path}`,
}));
vi.mock("@/stores/confirm-store", () => ({ notice: vi.fn(async () => {}) }));
vi.mock("@/stores/snackbar-store", () => ({
  showSnackbar: mocks.showSnackbar,
}));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock("@/utils/logger", () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));
vi.mock("./existing-contact-choices", () => ({
  resolveExistingContactChoices: async (candidates: { contactId: number }[]) =>
    candidates.map((candidate) => ({
      ...candidate,
      name: `Orbit ${candidate.contactId}`,
      photo: null,
    })),
}));
vi.mock("./ImportReviewAlreadyLinked", () => ({
  ImportReviewAlreadyLinked: "ImportReviewAlreadyLinked",
  resolveAlreadyLinkedReview: async () => null,
}));
vi.mock("./use-import-leave-guard", () => ({
  useImportLeaveGuard: () => () => {},
}));
vi.mock("./use-open-import-session", () => ({
  useOpenImportSession: () => {},
}));

const { ImportReviewScreen } = await import("./ImportReviewScreen");

type TestElement = ReactElement<Record<string, unknown>>;

function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

const DIGEST = { kind: "digest" } as const;
const navigation = { replace: vi.fn(), goBack: vi.fn() };
let host: { kind: string } | undefined = DIGEST;

function render(): TestElement[] {
  hooks.stateIndex = 0;
  hooks.effectIndex = 0;
  return nodes(
    ImportReviewScreen({
      navigation,
      route: { params: { sessionId: 1, host } },
    } as never),
  );
}

async function flush() {
  for (let i = 0; i < 8; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function loaded(): Promise<TestElement[]> {
  render();
  await flush();
  return render();
}

function byTestID(tree: TestElement[], testID: string) {
  return tree.find((node) => node.props.testID === testID);
}

function ofType(tree: TestElement[], type: string): TestElement {
  const found = tree.find((node) => node.type === type);
  if (!found) throw new Error(`no ${type}`);
  return found;
}

function withTestID(tree: TestElement[], testID: string): TestElement {
  const found = byTestID(tree, testID);
  if (!found) throw new Error(`no ${testID}`);
  return found;
}

function text(node: TestElement): string {
  return nodes(node.props.children as ReactNode)
    .concat([node])
    .map((n) => n.props.children)
    .filter((child): child is string => typeof child === "string")
    .join("");
}

function snackbarLabels(): string[] {
  return mocks.showSnackbar.mock.calls.map(
    ([message]) => (message as { label: string }).label,
  );
}

function row(birthday: string | null) {
  return {
    id: 11,
    contactId: null,
    externalContactId: "ext-1",
    photoRelPath: null,
    sourcePayload: JSON.stringify({
      displayName: "Ada Byron",
      methods: [{ type: "phone", value: "020 7946 0018" }],
      birthday,
    }),
  };
}

async function pressImport() {
  const tree = await loaded();
  const importButton = byTestID(tree, "import-review-import");
  if (!importButton) throw new Error("no Import button");
  expect(importButton.props.disabled).toBe(false);
  (importButton.props.onPress as () => void)();
  await flush();
}

beforeEach(() => {
  hooks.states = [];
  hooks.setters = [];
  hooks.effectsRun = new Set();
  vi.clearAllMocks();
  host = DIGEST;
  mocks.getAppSettings.mockResolvedValue({ phoneRegionOverride: "GB" });
  mocks.getDeviceRegion.mockReturnValue("US");
  mocks.listSessionRows.mockResolvedValue([row("1990-07-04")]);
  mocks.scoreImportCandidate.mockResolvedValue({
    outcome: "new",
    candidates: [],
  });
  mocks.commitSingleImport.mockResolvedValue(55);
});

describe("Import review participation (D-108)", () => {
  it("reads Bound then Unbound, with Unbound selected by default", async () => {
    const tree = await loaded();
    const group = tree.find(
      (node) => node.props.accessibilityRole === "radiogroup",
    );
    if (!group) throw new Error("no participation radiogroup");
    const radios = nodes(group.props.children as ReactNode).filter(
      (node) => node.props.accessibilityRole === "radio",
    );
    expect(radios.map((radio) => radio.props.accessibilityLabel)).toEqual([
      "Bound",
      "Unbound",
    ]);
    expect(
      radios.map(
        (radio) =>
          (radio.props.accessibilityState as { selected: boolean }).selected,
      ),
    ).toEqual([false, true]);
  });
});

describe("Import review form controls (D-54)", () => {
  it("uses Edit Contact's Birthday control seeded from the phone, with no free text birthday", async () => {
    const tree = await loaded();
    const field = tree.find((node) => node.type === "BirthdayField");
    expect(field?.props.testID).toBe("import-review-birthday");
    expect(field?.props.value).toEqual({
      input: "1990-07-04",
      yearUnknown: false,
      yearIsPlaceholder: false,
    });
    const inputs = tree.filter((node) => node.type === "TextInput");
    // Only the name is typed; nothing asks for "YYYY-MM-DD".
    expect(inputs.map((input) => input.props.placeholder)).toEqual([
      "Their name",
    ]);
  });

  it("imports the birthday the control holds, in storage shape", async () => {
    let tree = await loaded();
    const field = ofType(tree, "BirthdayField");
    (field.props.onChange as (next: unknown) => void)({
      input: "2000-02-29",
      yearUnknown: true,
      yearIsPlaceholder: true,
    });
    tree = render();
    (withTestID(tree, "import-review-import").props.onPress as () => void)();
    await flush();
    expect(mocks.commitSingleImport).toHaveBeenCalledWith(
      "exec",
      expect.objectContaining({ birthday: "02-29" }),
    );
  });

  it("says when the phone's birthday couldn't be read, instead of dropping it silently", async () => {
    mocks.listSessionRows.mockResolvedValue([row("2021-02-29")]);
    const tree = await loaded();
    const field = ofType(tree, "BirthdayField");
    expect((field.props.value as { input: string | null }).input).toBeNull();
    const hint = byTestID(tree, "import-review-birthday-unreadable");
    expect(hint && text(hint)).toContain("2021-02-29");
  });

  it("gives Import a button role", async () => {
    const tree = await loaded();
    const importButton = byTestID(tree, "import-review-import");
    expect(importButton?.type).toBe("Pressable");
    expect(importButton?.props.accessibilityRole).toBe("button");
    expect(importButton && text(importButton)).toBe("Import");
  });

  it.each([
    ["GB", "US", "GB"],
    [null, "US", "US"],
  ] as const)(
    "method warnings use the effective region (override %s, device %s → %s)",
    async (override, device, expected) => {
      mocks.getAppSettings.mockResolvedValue({ phoneRegionOverride: override });
      mocks.getDeviceRegion.mockReturnValue(device);
      const tree = await loaded();
      const editor = ofType(tree, "ContactMethodsEditor");
      const groups = editor.props.methods as {
        phone: { uid: string }[];
      };
      const uid = groups.phone[0]?.uid;
      expect(uid).toBeDefined();
      (editor.props.onUpdate as (uid: string, patch: unknown) => void)(
        uid as string,
        { value: "07700 900123" },
      );
      expect(mocks.updateMethodDraft).toHaveBeenLastCalledWith(
        expect.anything(),
        uid,
        { value: "07700 900123" },
        expected,
      );
    },
  );
});

describe("Import review endings (D-58, C-6)", () => {
  it("a commitSingleImport that resolved with an id takes the success ending, even after a finalize failure inside it", async () => {
    // commitSingleImport absorbs a completeSession rejection after create and
    // still returns the id (import-acquire.test.ts, C-6): the screen only
    // ever sees the resolved id.
    await pressImport();
    expect(mocks.commitSingleImport).toHaveBeenCalledTimes(1);
    expect(mocks.finishFlow).toHaveBeenCalledWith(navigation, DIGEST);
    expect(snackbarLabels()).toEqual(["Imported Ada Byron"]);
  });

  it("a creation failure keeps the 'Couldn't import' message and does not finish", async () => {
    mocks.commitSingleImport.mockRejectedValue(new Error("create failed"));
    await pressImport();
    expect(mocks.finishFlow).not.toHaveBeenCalled();
    expect(snackbarLabels()).toEqual([
      "Couldn't import contact. Please check the name and try again.",
    ]);
  });
});

describe("Import review forwards the flow host to ImportComplete (D-110, B-1)", () => {
  it("(a) the already-linked race fallback replaces to ImportComplete with the host", async () => {
    mocks.scoreImportCandidate.mockResolvedValue({
      outcome: "already_linked",
      deterministicContactId: 9,
      inBin: false,
      candidates: [],
    });
    await pressImport();
    expect(mocks.resolveAlreadyLinked).toHaveBeenCalledWith(
      "exec",
      11,
      9,
      "2026-10-17 12:00:00",
      false,
    );
    expect(navigation.replace).toHaveBeenCalledWith("ImportComplete", {
      sessionId: 1,
      host: DIGEST,
    });
  });

  it("(b) Skip on the duplicate choice replaces to ImportComplete with the host", async () => {
    mocks.scoreImportCandidate.mockResolvedValue({
      outcome: "possible",
      candidates: [{ contactId: 4 }, { contactId: 5 }],
    });
    await pressImport();
    const tree = render();
    const modal = tree.find((node) => node.type === "RegisteredModal");
    expect(modal?.props.visible).toBe(true);
    const skip = nodes(modal?.props.children as ReactNode).find(
      (node) => node.type === "Pressable" && text(node) === "Skip",
    );
    if (!skip) throw new Error("no Skip choice");
    (skip.props.onPress as () => void)();
    await flush();
    expect(mocks.markRowStatus).toHaveBeenCalledWith(
      "exec",
      11,
      "skipped",
      null,
      "2026-10-17 12:00:00",
    );
    expect(navigation.replace).toHaveBeenCalledWith("ImportComplete", {
      sessionId: 1,
      host: DIGEST,
    });
  });

  it("an absent host stays absent (ImportComplete falls back to the default)", async () => {
    host = undefined;
    mocks.scoreImportCandidate.mockResolvedValue({
      outcome: "already_linked",
      deterministicContactId: 9,
      candidates: [],
    });
    await pressImport();
    expect(navigation.replace).toHaveBeenCalledWith("ImportComplete", {
      sessionId: 1,
      host: undefined,
    });
  });
});
