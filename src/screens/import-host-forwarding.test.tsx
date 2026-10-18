import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 38.12 D-110 (convergence c1 A-1): the flow host travels through every
 * onward navigation in the bulk import flow, so a non-Settings host reaches
 * ImportComplete's params. Renders the REAL BulkImportSetup, ImportProgress
 * and DuplicateReview screens with mocked reads and writes through a
 * STATEFUL hook store (state and refs persist across renders, an effect runs
 * once on first render, `render()` re-runs the screen), with
 * route.params.host = { kind: "digest" }, and asserts the navigate/replace
 * params carry it:
 *
 *  - BulkImportSetup Import → ImportProgress (startBatch), the stopped view's
 *    Continue → ImportProgress, and Combine → ImportComplete;
 *  - ImportProgress's auto-replace after the pass and its View summary;
 *  - DuplicateReview's load-complete replace.
 *
 * Every site is reached by a render; none needed a source-contract fallback.
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
vi.mock("@react-navigation/native", () => ({
  useFocusEffect: () => {},
  useIsFocused: () => true,
}));
vi.mock("react-native", () => ({
  AccessibilityInfo: { announceForAccessibility: vi.fn() },
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  Text: "Text",
  View: "View",
}));
vi.mock("@/components/ConsolidationPrompt", () => ({
  ConsolidationPrompt: "ConsolidationPrompt",
}));
vi.mock("@/components/category/CategoryChoiceSheet", () => ({
  CategoryChoiceSheet: "CategoryChoiceSheet",
}));
vi.mock("@/components/FrequencyPicker", () => ({
  FrequencyPicker: "FrequencyPicker",
}));
vi.mock("@/components/MatchChoiceSheet", () => ({
  MatchChoiceSheet: "MatchChoiceSheet",
}));
vi.mock("@/components/ReviewMatchesList", () => ({
  ReviewMatchesList: "ReviewMatchesList",
}));
vi.mock("@/components/ShellAppBar", () => ({ ShellAppBar: "ShellAppBar" }));
vi.mock("@/components/ui", () => ({ OptionSelectRow: "OptionSelectRow" }));

const mocks = vi.hoisted(() => ({
  sessionRowCounts: vi.fn(),
  listSessionRows: vi.fn(async () => [] as unknown[]),
  setSessionBatchDefaults: vi.fn(async (..._args: unknown[]) => {}),
  detectSourceClusters: vi.fn(() => ({ clusters: [] as unknown[][] })),
  combineCluster: vi.fn(),
  runImportBatch: vi.fn(),
  followImportRun: vi.fn((..._args: unknown[]) => null),
}));

vi.mock("@/db/contact-read", () => ({
  getContactHeader: async () => null,
  listCategories: async () => [],
}));
vi.mock("@/db/database", () => ({
  getExecutor: () => "exec",
  localDateTime: () => "2026-10-17 12:00:00",
}));
vi.mock("@/db/import-session-dao", () => ({
  finalizeSessionIfTerminal: vi.fn(async () => {}),
  markRowStatus: vi.fn(async () => {}),
  skipNeedsReviewRow: vi.fn(async () => {}),
  setSessionBatchDefaults: mocks.setSessionBatchDefaults,
  UNBOUND_IMPORT: { trackingEnabled: false, intervalDays: null },
}));
vi.mock("@/db/import-session-read", () => ({
  getSessionById: async () => ({
    id: 1,
    batchCategoryId: null,
    batchTrackingEnabled: false,
    batchIntervalDays: null,
    phoneRegion: "US",
  }),
  listSessionRows: mocks.listSessionRows,
  sessionBatchLifecycle: () => ({ trackingEnabled: false, intervalDays: null }),
  sessionRowCounts: mocks.sessionRowCounts,
}));
vi.mock("@/db/imported-contact-dao", () => ({
  linkExistingContactToRow: vi.fn(async () => {}),
}));
vi.mock("@/services/import/import-driver", () => ({
  importRowAsNew: vi.fn(async () => ({ contactId: 1 })),
  runImportBatch: mocks.runImportBatch,
}));
vi.mock("@/services/import/import-lifecycle-effects", () => ({
  applyImportLifecycleEffects: vi.fn(async () => {}),
}));
vi.mock("@/services/import/import-photo", () => ({ importedPhotoFs: {} }));
vi.mock("@/services/import/import-run-guard", () => ({
  followImportRun: mocks.followImportRun,
  isImportRunActive: () => false,
}));
vi.mock("@/services/import/source-consolidation", () => ({
  combineCluster: mocks.combineCluster,
  detectSourceClusters: mocks.detectSourceClusters,
}));
vi.mock("@/services/photos/photo-storage", () => ({
  resolveImportStagingUri: (path: string) => `file:///${path}`,
}));
vi.mock("@/stores/confirm-store", () => ({ notice: vi.fn(async () => {}) }));
vi.mock("@/stores/snackbar-store", () => ({ showSnackbar: vi.fn() }));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock("@/theme/danger-scrim", () => ({ persistentDangerScrim: () => ({}) }));
vi.mock("@/utils/logger", () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));
vi.mock("./existing-contact-choices", () => ({
  REVIEW_MATCH_CHOICES: {},
  resolveExistingContactChoices: async () => [],
}));
vi.mock("./use-import-leave-guard", () => ({
  discardUnresolvedSession: vi.fn(async () => {}),
  useImportLeaveGuard: () => () => {},
}));
vi.mock("./use-open-import-session", () => ({
  bulkSetupHoldActive: () => true,
  importProgressHoldActive: () => true,
  useOpenImportSession: () => {},
}));

const { BulkImportSetupScreen } = await import("./BulkImportSetupScreen");
const { ImportProgressScreen } = await import("./ImportProgressScreen");
const { DuplicateReviewScreen } = await import("./DuplicateReviewScreen");

type TestElement = ReactElement<Record<string, unknown>>;

function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

function text(node: TestElement): string {
  return nodes(node.props.children as ReactNode)
    .concat([node])
    .map((n) => n.props.children)
    .filter((child): child is string => typeof child === "string")
    .join("");
}

const DIGEST = { kind: "digest" } as const;
const navigation = {
  navigate: vi.fn(),
  replace: vi.fn(),
  goBack: vi.fn(),
  addListener: vi.fn(() => () => {}),
};

type Screen = (props: never) => ReactNode;

function renderer(screen: Screen, params: Record<string, unknown>) {
  return () => {
    hooks.stateIndex = 0;
    hooks.refIndex = 0;
    hooks.effectIndex = 0;
    return nodes(
      screen({
        navigation,
        route: { params: { ...params, host: DIGEST } },
      } as never),
    );
  };
}

async function flush() {
  for (let i = 0; i < 8; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

const COUNTS = {
  pending: 2,
  imported: 0,
  linked: 0,
  needs_review: 0,
  failed: 0,
  skipped: 0,
};

beforeEach(() => {
  hooks.states = [];
  hooks.setters = [];
  hooks.refs = [];
  hooks.effectsRun = new Set();
  vi.clearAllMocks();
  mocks.sessionRowCounts.mockResolvedValue(COUNTS);
  mocks.detectSourceClusters.mockReturnValue({ clusters: [] });
  mocks.followImportRun.mockReturnValue(null);
  mocks.runImportBatch.mockResolvedValue({});
});

describe("BulkImportSetup forwards the flow host (D-110, A-1)", () => {
  const render = renderer(BulkImportSetupScreen as Screen, { sessionId: 1 });

  it("Import → ImportProgress carries the host (startBatch)", async () => {
    render();
    await flush();
    const tree = render();
    const importButton = tree.find(
      (node) => node.type === "Pressable" && text(node) === "Import 2 contacts",
    );
    if (!importButton) throw new Error("no Import button");
    expect(importButton.props.disabled).toBe(false);
    (importButton.props.onPress as () => void)();
    await flush();
    expect(mocks.setSessionBatchDefaults).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).toHaveBeenCalledWith("ImportProgress", {
      sessionId: 1,
      batchCategoryId: null,
      host: DIGEST,
    });
  });

  it("the stopped view's Continue → ImportProgress carries the host", async () => {
    mocks.sessionRowCounts.mockResolvedValue({ ...COUNTS, imported: 1 });
    render();
    await flush();
    const tree = render();
    const continueButton = tree.find(
      (node) => node.props.accessibilityLabel === "Continue import",
    );
    if (!continueButton) throw new Error("no Continue button");
    (continueButton.props.onPress as () => void)();
    expect(navigation.navigate).toHaveBeenCalledWith(
      "ImportProgress",
      expect.objectContaining({
        sessionId: 1,
        batchCategoryId: null,
        host: DIGEST,
      }),
    );
  });

  it("Combine that completes the session → ImportComplete carries the host", async () => {
    const cluster = [{ id: 1 }, { id: 2 }];
    mocks.detectSourceClusters.mockReturnValue({ clusters: [cluster] });
    mocks.combineCluster.mockResolvedValue({
      combined: true,
      contactId: 9,
      sessionComplete: true,
    });
    render();
    await flush();
    let tree = render();
    const importButton = tree.find(
      (node) => node.type === "Pressable" && text(node) === "Import 2 contacts",
    );
    if (!importButton) throw new Error("no Import button");
    (importButton.props.onPress as () => void)();
    await flush();
    tree = render();
    const prompt = tree.find((node) => node.type === "ConsolidationPrompt");
    if (!prompt) throw new Error("no ConsolidationPrompt");
    expect(prompt.props.visible).toBe(true);
    (prompt.props.onCombine as () => void)();
    await flush();
    expect(mocks.combineCluster).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith("ImportComplete", {
      sessionId: 1,
      host: DIGEST,
    });
  });
});

describe("ImportProgress forwards the flow host (D-110, A-1)", () => {
  const render = renderer(ImportProgressScreen as Screen, {
    sessionId: 1,
    batchCategoryId: null,
  });

  it("the auto-replace after the pass carries the host", async () => {
    render();
    await flush();
    expect(mocks.runImportBatch).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith("ImportComplete", {
      sessionId: 1,
      host: DIGEST,
    });
  });

  it("View import summary after a stop carries the host", async () => {
    mocks.runImportBatch.mockRejectedValue(new Error("session read failed"));
    render();
    await flush();
    const tree = render();
    const view = tree.find(
      (node) => node.props.testID === "import-progress-view-summary",
    );
    if (!view) throw new Error("no View import summary");
    expect(navigation.replace).not.toHaveBeenCalled();
    (view.props.onPress as () => void)();
    expect(navigation.replace).toHaveBeenCalledWith("ImportComplete", {
      sessionId: 1,
      host: DIGEST,
    });
  });
});

describe("DuplicateReview forwards the flow host (D-110, A-1)", () => {
  const render = renderer(DuplicateReviewScreen as Screen, { sessionId: 1 });

  it("the load-complete replace carries the host", async () => {
    mocks.sessionRowCounts.mockResolvedValue({
      ...COUNTS,
      pending: 0,
      needs_review: 0,
    });
    render();
    await flush();
    expect(navigation.replace).toHaveBeenCalledWith("ImportComplete", {
      sessionId: 1,
      host: DIGEST,
    });
  });
});
