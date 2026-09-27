import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ exec: {}, showSnackbar: vi.fn() }));
vi.mock("react-native", () => ({
  ScrollView: "ScrollView",
  StyleSheet: { create: (styles: unknown) => styles },
  View: "View",
}));
vi.mock("@react-navigation/native", () => ({
  useFocusEffect: vi.fn(),
  useIsFocused: () => true,
}));
vi.mock("@/stores/shell-refresh-store", () => ({
  useShellRefresh: vi.fn(),
  useForegroundRefresh: vi.fn(),
}));
vi.mock("@/components/digest/UpNextSection", () => ({
  UpNextSection: "UpNextSection",
}));
vi.mock("@/components/digest/HorizonSection", () => ({
  HorizonSection: "HorizonSection",
}));
vi.mock("@/components/digest/YourWeekSection", () => ({
  YourWeekSection: "YourWeekSection",
}));
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));
vi.mock("@/components/ui/ChromeScrim", () => ({ ChromeScrim: "ChromeScrim" }));
vi.mock("@/components/ui/Button", () => ({ Button: "Button" }));
// ShellAppBar reads navigation hooks, so this renderless harness cannot expand
// it; it stays a leaf whose props (variant, title) are asserted directly.
vi.mock("@/components/ShellAppBar", () => ({ ShellAppBar: "ShellAppBar" }));
vi.mock("@/db/database", () => ({
  getExecutor: () => mocks.exec,
  localDateTime: () => "2026-09-19 12:00:00",
}));
vi.mock("@/stores/snackbar-store", () => ({
  showSnackbar: mocks.showSnackbar,
}));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));
// The loaded body reads the shell FAB clearance (38.4 D-52); this renderless
// harness has no React dispatcher for the tab-bar store hook.
vi.mock("@/navigation/use-bottom-clearance", () => ({
  useBottomClearance: () => 0,
  FAB_SIZE: 56,
  FAB_EDGE_GAP: 16,
}));

const { DigestContent, DigestLoadedBody, runDigestDrillThrough } = await import(
  "./DigestScreen"
);
const {
  createDigestRefreshController,
  digestLoadStateOnFail,
  digestLoadStateOnPublish,
} = await import("./digest-refresh");
type DigestLoadState = import("./DigestScreen").DigestLoadState;

interface Node {
  type: unknown;
  props: Record<string, unknown>;
  text: string;
  children: Node[];
}
function resolve(node: ReactNode): Node[] {
  if (node == null || typeof node === "boolean") return [];
  if (typeof node === "string" || typeof node === "number")
    return [{ type: "text", props: {}, text: String(node), children: [] }];
  if (Array.isArray(node)) return node.flatMap(resolve);
  const element = node as ReactElement<{ children?: ReactNode }>;
  // Expand local function components (DigestLoadedBody inside DigestContent);
  // mocked modules are strings and stay leaves.
  if (typeof element.type === "function")
    return resolve(
      (element.type as (props: unknown) => ReactNode)(element.props),
    );
  const children = resolve(element.props.children);
  return [
    {
      type: element.type,
      props: element.props as Record<string, unknown>,
      text: children.map((child) => child.text).join(""),
      children,
    },
  ];
}
function all(nodes: Node[]): Node[] {
  return nodes.flatMap((node) => [node, ...all(node.children)]);
}

const upNext = (id: number) => ({
  id,
  name: `Person ${id}`,
  photo: null,
  progress: 2,
  status: "decay" as const,
  reason: null,
});
const data = {
  upNextCandidates: [upNext(1), upNext(2), upNext(3), upNext(4)],
  overlooked: [
    { ...upNext(1), rarely_responds: 0 },
    { ...upNext(5), rarely_responds: 0 },
  ],
  birthdayCandidates: [],
  neverContactedCount: 0,
  neverContactedRows: [],
};

describe("DigestScreen composition", () => {
  it("renders the fixed Up Next, Horizon, Your Week order and flows claimed ids", () => {
    const nodes = all(
      resolve(
        DigestLoadedBody({
          data,
          refreshSignal: 0,
          onOpenProfile: vi.fn(),
          onDrillThrough: vi.fn(),
        }),
      ),
    );
    expect(
      nodes
        .map((node) => node.type)
        .filter((type) =>
          ["UpNextSection", "HorizonSection", "YourWeekSection"].includes(
            String(type),
          ),
        ),
    ).toEqual(["UpNextSection", "HorizonSection", "YourWeekSection"]);
    const upNextNode = nodes.find((node) => node.type === "UpNextSection");
    const horizon = nodes.find((node) => node.type === "HorizonSection");
    if (!horizon) throw new Error("Missing Horizon module");
    expect(upNextNode?.props.candidates).toHaveLength(3);
    expect(horizon?.props.upNextIds).toEqual([1, 2, 3]);
    expect(
      (horizon.props.overlooked as Array<{ id: number }>).map((row) => row.id),
    ).toEqual([5]);
  });

  it("keeps loading blank and renders the calm Digest error sentinel", () => {
    const loading = all(
      resolve(
        DigestContent({
          state: { phase: "loading" },
          refreshSignal: 0,
          onRetry: vi.fn(),
          onOpenProfile: vi.fn(),
          onDrillThrough: vi.fn(),
        }),
      ),
    );
    expect(loading.some((node) => node.type === "UpNextSection")).toBe(false);

    const error = all(
      resolve(
        DigestContent({
          state: { phase: "error" },
          refreshSignal: 0,
          onRetry: vi.fn(),
          onOpenProfile: vi.fn(),
          onDrillThrough: vi.fn(),
        }),
      ),
    );
    const text = error.map((node) => node.text).join(" ");
    expect(text).toContain("Couldn't load your Digest");
    expect(text).toContain("Try opening it again in a moment.");
  });

  it("keeps the loaded body mounted across a failed refresh and clears the notice on a successful Retry", async () => {
    const onRetry = vi.fn();
    const render = (state: DigestLoadState, refreshSignal: number) =>
      all(
        resolve(
          DigestContent({
            state,
            refreshSignal,
            onRetry,
            onOpenProfile: vi.fn(),
            onDrillThrough: vi.fn(),
          }),
        ),
      );
    const yourWeek = (tree: Node[]) =>
      tree.find((node) => node.type === "YourWeekSection");
    const notice = (tree: Node[]) =>
      tree.find((node) => node.props.testID === "digest-refresh-error");

    const loaded = digestLoadStateOnPublish<typeof data>(
      { phase: "loading" },
      data,
    );
    const before = render(loaded, 3);
    expect(notice(before)).toBeUndefined();
    expect(yourWeek(before)?.props).toEqual({ refreshSignal: 3 });

    const failed = digestLoadStateOnFail(loaded);
    const during = render(failed, 3);
    expect(yourWeek(during)?.props).toEqual({ refreshSignal: 3 });
    const shown = notice(during);
    expect(shown?.text).toContain("Couldn't refresh Up Next and Horizon");
    expect(during.some((node) => node.props.testID === "digest-error")).toBe(
      false,
    );
    const retry = shown?.children.find((node) => node.type === "Button");
    expect(retry?.props.label).toBe("Retry");
    if (!retry) throw new Error("Missing Retry");
    (retry.props.onPress as () => void)();
    expect(onRetry).toHaveBeenCalledTimes(1);

    const retried = digestLoadStateOnPublish(failed, data);
    const after = render(retried, 4);
    expect(notice(after)).toBeUndefined();
    expect(yourWeek(after)?.props).toEqual({ refreshSignal: 4 });
  });

  it("signals Your Week on acceptance, so a failed outer read still refreshes Your Week under the notice", async () => {
    let state: DigestLoadState = { phase: "loading" };
    let signal = 0;
    let fail = false;
    const controller = createDigestRefreshController<typeof data>({
      read: async () => {
        if (fail) throw new Error("outer read failed");
        return data;
      },
      publish: (next) => {
        state = digestLoadStateOnPublish(state, next);
      },
      fail: () => {
        state = digestLoadStateOnFail(state);
      },
      isVisible: () => true,
      onAccepted: () => {
        signal += 1;
      },
    });

    await controller.request("focus");
    expect(state.phase).toBe("loaded");
    expect(signal).toBe(1);

    fail = true;
    await controller.request("shell");
    expect(signal).toBe(2);
    const tree = all(
      resolve(
        DigestContent({
          state,
          refreshSignal: signal,
          onRetry: vi.fn(),
          onOpenProfile: vi.fn(),
          onDrillThrough: vi.fn(),
        }),
      ),
    );
    expect(
      tree.some((node) => node.props.testID === "digest-refresh-error"),
    ).toBe(true);
    expect(tree.some((node) => node.type === "UpNextSection")).toBe(true);
    expect(tree.find((node) => node.type === "YourWeekSection")?.props).toEqual(
      { refreshSignal: 2 },
    );
  });

  it.each([
    ["loading", { phase: "loading" }],
    ["error", { phase: "error" }],
    [
      "loaded",
      digestLoadStateOnPublish<typeof data>({ phase: "loading" }, data),
    ],
    [
      "loaded with a refresh error",
      digestLoadStateOnFail(
        digestLoadStateOnPublish<typeof data>({ phase: "loading" }, data),
      ),
    ],
  ] as const)(
    "renders the shared root header row first while %s (D-23)",
    (_label, state) => {
      const [root, ...rest] = resolve(
        DigestContent({
          state: state as DigestLoadState,
          refreshSignal: 0,
          onRetry: vi.fn(),
          onOpenProfile: vi.fn(),
          onDrillThrough: vi.fn(),
        }),
      );
      expect(rest).toHaveLength(0);
      expect(root.props.testID).toBe("digest-root");
      const [header, body, ...others] = root.children;
      expect(others).toHaveLength(0);
      // The header row is full-bleed: the outer container carries no padding;
      // the body below it does.
      expect(header.type).toBe("ShellAppBar");
      expect(header.props).toEqual({ variant: "root", title: "Digest" });
      expect(body.type).toBe("View");
      expect(body.props.testID).toBe("digest-body");
      expect(root.props.style).not.toHaveProperty("padding");
      expect(body.props.style).toHaveProperty("padding");

      const nodes = all([root]);
      expect(nodes.filter((node) => node.type === "ShellAppBar")).toHaveLength(
        1,
      );
      expect(
        nodes.some(
          (node) => node.type === "AppText" && node.props.role === "display",
        ),
      ).toBe(false);
    },
  );

  it("awaits the complete query write before navigating and never navigates on rejection", async () => {
    const order: string[] = [];
    await runDigestDrillThrough("never-contacted", {
      setPopulationsAndFilters: (async (
        _exec: unknown,
        populations: string[],
        filters: Record<string, string[]>,
      ) => {
        expect(populations).toEqual(["not-contacted"]);
        expect(filters).toEqual({});
        order.push("persisted");
      }) as never,
      navigateToContacts: () => order.push("navigated"),
    });
    expect(order).toEqual(["persisted", "navigated"]);

    const navigate = vi.fn();
    await expect(
      runDigestDrillThrough("overlooked", {
        setPopulationsAndFilters: vi
          .fn()
          .mockRejectedValue(new Error("write failed")),
        navigateToContacts: navigate,
      }),
    ).rejects.toThrow("write failed");
    expect(navigate).not.toHaveBeenCalled();
  });
});
