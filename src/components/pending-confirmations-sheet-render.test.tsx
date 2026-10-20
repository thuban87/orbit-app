import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EligiblePendingAssist } from "@/db/interaction-assist-read";
import { THEME_PRESETS } from "@/theme/theme-presets";

/**
 * Shallow render of Pending confirmations (38.6 D-14): each queued assist shows
 * the contact's photo (or initials) through `Avatar` beside its question and,
 * since 38.14 D-74, a "<channel> to <destination> · <time>" line.
 *
 * 38.14 D-74: the list is a sized bottom `Sheet` (ADR-255) with a Close button,
 * and each answer confirms with a named snackbar.
 *
 * 38.9 D-13 / D-14 (J-07): every close path (Back and the scrim tap via the
 * Sheet's `onRequestClose`, and the Close button) goes through one dirty-aware
 * close that prompts while a queued confirmation note holds typed text. A tiny
 * hook harness keeps `useState` values across "renders" so the close lifecycle
 * is observable.
 */

const QUEUE: EligiblePendingAssist[] = [
  {
    id: 2,
    uid: "assist-2",
    contact_id: 12,
    channel: "text",
    endpoint_value: "+15550101",
    endpoint_display: "555-0101",
    handoff_at: "2026-09-30 09:00:00",
    created_at: "2026-09-30 09:00:01",
    contact_name: "Grace Hopper",
    contact_photo: "avatars/contact-12.jpg",
  },
  {
    id: 1,
    uid: "assist-1",
    contact_id: 11,
    channel: "call",
    endpoint_value: null,
    endpoint_display: null,
    handoff_at: "2026-09-29 20:30:00",
    created_at: "2026-09-30 08:00:01",
    contact_name: "Ada Lovelace",
    contact_photo: null,
  },
];

const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  index: 0,
  effects: [] as (() => void)[],
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => {
    const slot = hooks.index++;
    if (!(slot in hooks.states)) {
      hooks.states[slot] =
        typeof value === "function" ? (value as () => unknown)() : value;
    }
    return [
      hooks.states[slot],
      (next: unknown) => {
        hooks.states[slot] =
          typeof next === "function"
            ? (next as (previous: unknown) => unknown)(hooks.states[slot])
            : next;
      },
    ];
  },
  useEffect: (effect: () => void) => {
    hooks.effects.push(effect);
  },
}));
vi.mock("@/components/ui/Sheet", () => ({ Sheet: "Sheet" }));
vi.mock("@/components/ui/Button", () => ({ Button: "Button" }));
const fit = vi.hoisted(() => ({
  env: { windowHeight: 2000, windowWidth: 400, fontScale: 1, bottomInset: 0 },
}));
vi.mock("@/components/use-sheet-fit-environment", () => ({
  useSheetFitEnvironment: () => fit.env,
}));
vi.mock("react-native", () => ({
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Text: "Text",
  View: "View",
  StyleSheet: {
    create: (styles: unknown) => styles,
    absoluteFill: {},
    hairlineWidth: 1,
  },
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/components/Avatar", () => ({ Avatar: "Avatar" }));
vi.mock("@/components/AssistConfirmation", () => ({
  AssistConfirmation: "AssistConfirmation",
}));
vi.mock("@/db/database", () => ({
  getExecutor: vi.fn(),
  localDateTime: () => "2026-09-30 10:00:00",
}));
vi.mock("@/db/interaction-assist-dao", () => ({
  markAssistDismissed: vi.fn(),
  markAssistLogged: vi.fn(),
}));
const runner = vi.hoisted(() => ({ runAssistAction: vi.fn() }));
vi.mock("@/services/assist-commit", () => ({
  ASSIST_FAILURE_COPY: {},
  publishAssistCommit: vi.fn(),
  publishAssistDismissal: vi.fn(),
  runAssistAction: runner.runAssistAction,
}));
vi.mock("@/services/widget/widget-refresh", () => ({
  notifyWidgetDataChanged: vi.fn(),
}));
vi.mock("@/stores/confirm-store", () => ({ notice: vi.fn() }));
vi.mock("@/stores/shell-refresh-store", () => ({ bumpShellRefresh: vi.fn() }));
const snackbar = vi.hoisted(() => ({ showSnackbar: vi.fn() }));
vi.mock("@/stores/snackbar-store", () => ({
  showSnackbar: snackbar.showSnackbar,
}));
const live = vi.hoisted(() => ({ queue: [] as unknown[] }));
vi.mock("@/stores/assist-store", () => ({
  useAssistBanner: (
    select: (state: { queue: unknown[]; refresh: () => void }) => unknown,
  ) => select({ queue: live.queue, refresh: () => {} }),
}));
const { confirmDiscard } = vi.hoisted(() => ({ confirmDiscard: vi.fn() }));
vi.mock("@/navigation/discard-keep-guard", () => ({ confirmDiscard }));
vi.mock("@/utils/logger", () => ({ Logger: { error: vi.fn() } }));

const { PendingConfirmationsSheet } = await import(
  "./PendingConfirmationsSheet"
);

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

function textOf(element: TestElement | undefined): string {
  const children = element?.props.children;
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.join("");
  return "";
}

/** One harness "render": hook slots persist, effects run after the render. */
function render(props: { visible: boolean; onClose: () => void }) {
  hooks.index = 0;
  hooks.effects = [];
  const tree = nodes(PendingConfirmationsSheet(props));
  for (const effect of hooks.effects) effect();
  return tree;
}

function resetHarness() {
  hooks.states = [];
  hooks.index = 0;
  hooks.effects = [];
  live.queue = QUEUE;
  confirmDiscard.mockReset();
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

const flush = () => new Promise<void>((settle) => setTimeout(settle, 0));

describe("PendingConfirmationsSheet photos (38.6 D-14)", () => {
  resetHarness();
  const tree = render({ visible: true, onClose: () => {} });

  it("renders one Avatar per queued assist with the contact's photo, name and id", () => {
    const avatars = tree.filter((node) => node.type === "Avatar");
    expect(
      avatars.map((node) => [
        node.props.photo,
        node.props.name,
        node.props.contactId,
        node.props.size,
      ]),
    ).toEqual([
      ["avatars/contact-12.jpg", "Grace Hopper", 12, 40],
      [null, "Ada Lovelace", 11, 40],
    ]);
  });

  it("sits each Avatar beside its question and destination line in one row (38.14 D-74)", () => {
    const rows = tree.filter((node) => {
      const kids = nodes(node.props.children as ReactNode);
      return (
        node.type === "View" &&
        kids.some((kid) => kid.type === "Avatar") &&
        !kids.some((kid) => kid.type === "AssistConfirmation")
      );
    });
    expect(rows).toHaveLength(2);
    const [first, second] = rows.map((row) =>
      (row.props.children as TestElement[]).map((kid) => kid.type),
    );
    expect(first).toEqual(["Avatar", "View"]);
    expect(second).toEqual(["Avatar", "View"]);
    const lines = rows.map((row) =>
      (
        (row.props.children as TestElement[])[1].props.children as TestElement[]
      ).map(textOf),
    );
    expect(lines).toEqual([
      ["Did you text Grace Hopper?", "Text to 555-0101 · 9:00 AM"],
      // No stored destination; a handoff on the previous local day (D-09).
      ["Did you reach Ada Lovelace?", "Call · Yesterday 8:30 PM"],
    ]);
    // One TalkBack stop per row with one label (review WR2-04).
    expect(
      rows.map((row) => [row.props.accessible, row.props.accessibilityLabel]),
    ).toEqual([
      [true, "Did you text Grace Hopper? Text to 555-0101 · 9:00 AM"],
      [true, "Did you reach Ada Lovelace? Call · Yesterday 8:30 PM"],
    ]);
  });
});

describe("PendingConfirmationsSheet close guard (38.9 D-13, D-14; J-07)", () => {
  beforeEach(resetHarness);

  const modalOf = (tree: TestElement[]) =>
    tree.find((node) => node.type === "Sheet") as TestElement;
  // The Close button (38.14 D-74); the Sheet owns the scrim and Back, both of
  // which arrive through its onRequestClose.
  const scrimOf = (tree: TestElement[]) =>
    tree.find(
      (node) =>
        node.type === "Button" &&
        node.props.testID === "pending-confirmations-close",
    ) as TestElement;
  const confirmationFor = (tree: TestElement[], index: number) =>
    tree.filter((node) => node.type === "AssistConfirmation")[index];

  it("routes Back, the scrim and Close through one close that is not the raw onClose", () => {
    const onClose = vi.fn();
    const tree = render({ visible: true, onClose });
    const back = modalOf(tree).props.onRequestClose;
    const close = scrimOf(tree).props.onPress;
    expect(typeof back).toBe("function");
    expect(back).not.toBe(onClose);
    expect(close).not.toBe(onClose);
    expect(close).toBe(back);
  });

  it("gives every queued confirmation a note-dirty reporter", () => {
    const tree = render({ visible: true, onClose: () => {} });
    const confirmations = tree.filter(
      (node) => node.type === "AssistConfirmation",
    );
    expect(confirmations).toHaveLength(2);
    for (const node of confirmations) {
      expect(typeof node.props.onNoteDirtyChange).toBe("function");
    }
  });

  it("closes at once, with no prompt, when no note is typed", () => {
    const onClose = vi.fn();
    const tree = render({ visible: true, onClose });
    (scrimOf(tree).props.onPress as () => void)();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(confirmDiscard).not.toHaveBeenCalled();
  });

  it("prompts with a typed note and closes only on Discard", async () => {
    const onClose = vi.fn();
    let tree = render({ visible: true, onClose });
    (confirmationFor(tree, 0).props.onNoteDirtyChange as (d: boolean) => void)(
      true,
    );
    tree = render({ visible: true, onClose });

    const keep = deferred<boolean>();
    confirmDiscard.mockReturnValueOnce(keep.promise);
    (modalOf(tree).props.onRequestClose as () => void)();
    expect(confirmDiscard).toHaveBeenCalledTimes(1);
    keep.resolve(false);
    await flush();
    expect(onClose).not.toHaveBeenCalled();

    tree = render({ visible: true, onClose });
    const discard = deferred<boolean>();
    confirmDiscard.mockReturnValueOnce(discard.promise);
    (scrimOf(tree).props.onPress as () => void)();
    expect(onClose).not.toHaveBeenCalled();
    discard.resolve(true);
    await flush();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("a note whose item left the queue no longer prompts", () => {
    const onClose = vi.fn();
    let tree = render({ visible: true, onClose });
    (confirmationFor(tree, 0).props.onNoteDirtyChange as (d: boolean) => void)(
      true,
    );
    live.queue = [QUEUE[1]];
    tree = render({ visible: true, onClose });
    (scrimOf(tree).props.onPress as () => void)();
    expect(confirmDiscard).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("starts clean after the sheet closes (Discard, or hidden by its owner)", async () => {
    const onClose = vi.fn();
    let tree = render({ visible: true, onClose });
    (confirmationFor(tree, 1).props.onNoteDirtyChange as (d: boolean) => void)(
      true,
    );
    tree = render({ visible: true, onClose });
    confirmDiscard.mockResolvedValueOnce(true);
    (scrimOf(tree).props.onPress as () => void)();
    await flush();
    expect(onClose).toHaveBeenCalledTimes(1);

    // Reopened: a clean close needs no prompt.
    tree = render({ visible: true, onClose });
    (scrimOf(tree).props.onPress as () => void)();
    expect(confirmDiscard).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(2);

    // Hidden while dirty (visible → false), then reopened: clean again.
    (confirmationFor(tree, 0).props.onNoteDirtyChange as (d: boolean) => void)(
      true,
    );
    render({ visible: false, onClose });
    tree = render({ visible: true, onClose });
    (scrimOf(tree).props.onPress as () => void)();
    expect(confirmDiscard).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe("PendingConfirmationsSheet bottom sheet (38.14 D-74)", () => {
  beforeEach(resetHarness);

  const sheetsOf = (tree: TestElement[]) =>
    tree.filter((node) => node.type === "Sheet");

  it("is a bottom Sheet with a Close button, not a centred modal", () => {
    const tree = render({ visible: true, onClose: () => {} });
    expect(sheetsOf(tree)).toHaveLength(1);
    expect(tree.some((node) => node.type === "Modal")).toBe(false);
    const close = tree.find(
      (node) =>
        node.type === "Button" &&
        node.props.testID === "pending-confirmations-close",
    );
    expect(close?.props.label).toBe("Close");
  });

  it("opens at its sized variant and owns the list scroll (ADR-255, D-32)", () => {
    // Two rows fit a tall window: the smallest size, list scroll owned here.
    let [sheet] = sheetsOf(render({ visible: true, onClose: () => {} }));
    expect(sheet.props.variant).toBe("compact");
    expect(sheet.props.scrollBody).toBe(false);

    // A short window at large text needs the expanded size.
    resetHarness();
    fit.env = { ...fit.env, windowHeight: 600, fontScale: 2 };
    [sheet] = sheetsOf(render({ visible: true, onClose: () => {} }));
    expect(sheet.props.variant).toBe("expanded");
    fit.env = { ...fit.env, windowHeight: 2000, fontScale: 1 };
  });

  it("confirms each answer with a named snackbar", async () => {
    snackbar.showSnackbar.mockClear();
    const tree = render({ visible: true, onClose: () => {} });
    const [grace, ada] = tree.filter(
      (node) => node.type === "AssistConfirmation",
    );
    runner.runAssistAction.mockResolvedValueOnce("done");
    await (grace.props.onConfirm as (c: 0 | 1) => Promise<void>)(1);
    runner.runAssistAction.mockResolvedValueOnce("done");
    await (ada.props.onConfirm as (c: 0 | 1) => Promise<void>)(0);
    runner.runAssistAction.mockResolvedValueOnce("done");
    await (ada.props.onDismiss as () => Promise<void>)();
    expect(snackbar.showSnackbar.mock.calls.map(([arg]) => arg.label)).toEqual([
      "Logged Message with Grace Hopper",
      "Logged Call with Ada Lovelace, no answer",
      "Didn't log Call with Ada Lovelace",
    ]);
  });

  it("shows the empty state without a scroll, and the list inside one", () => {
    live.queue = [];
    let tree = render({ visible: true, onClose: () => {} });
    expect(tree.some((node) => node.type === "ScrollView")).toBe(false);
    expect(tree.some((node) => textOf(node) === "You're all caught up")).toBe(
      true,
    );
    live.queue = QUEUE;
    tree = render({ visible: true, onClose: () => {} });
    const scroll = tree.find((node) => node.type === "ScrollView");
    expect(
      nodes(scroll?.props.children as ReactNode).filter(
        (node) => node.type === "AssistConfirmation",
      ),
    ).toHaveLength(2);
  });

  it("keeps each row's channel so Call still offers No answer (D-09)", () => {
    const tree = render({ visible: true, onClose: () => {} });
    expect(
      tree
        .filter((node) => node.type === "AssistConfirmation")
        .map((node) => node.props.channel),
    ).toEqual(["text", "call"]);
  });
});
