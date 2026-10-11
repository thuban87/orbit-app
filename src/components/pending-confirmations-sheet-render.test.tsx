import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EligiblePendingAssist } from "@/db/interaction-assist-read";
import { THEME_PRESETS } from "@/theme/theme-presets";

/**
 * Shallow render of Pending confirmations (38.6 D-14): each queued assist shows
 * the contact's photo (or initials) through `Avatar` beside its question.
 *
 * 38.9 D-13 / D-14 (J-07): both close paths (Back via `onRequestClose`, the
 * scrim tap) go through one dirty-aware close that prompts while a queued
 * confirmation note holds typed text. A tiny hook harness keeps `useState`
 * values across "renders" so the close lifecycle is observable.
 */

const QUEUE: EligiblePendingAssist[] = [
  {
    id: 2,
    uid: "assist-2",
    contact_id: 12,
    channel: "text",
    endpoint_value: null,
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
    handoff_at: "2026-09-30 08:00:00",
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
// 38.9 D-24: raw RN Modal sites render through RegisteredModal; the window
// itself is unchanged, so the wrapper is the mocked RN Modal here.
vi.mock("@/components/ui/RegisteredModal", () => ({
  RegisteredModal: "Modal",
}));
vi.mock("react-native", () => ({
  Modal: "Modal",
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
  localDateTime: vi.fn(),
}));
vi.mock("@/db/interaction-assist-dao", () => ({
  markAssistDismissed: vi.fn(),
  markAssistLogged: vi.fn(),
}));
vi.mock("@/services/assist-commit", () => ({
  ASSIST_FAILURE_COPY: {},
  publishAssistCommit: vi.fn(),
  publishAssistDismissal: vi.fn(),
  runAssistAction: vi.fn(),
}));
vi.mock("@/services/widget/widget-refresh", () => ({
  notifyWidgetDataChanged: vi.fn(),
}));
vi.mock("@/stores/confirm-store", () => ({ notice: vi.fn() }));
vi.mock("@/stores/shell-refresh-store", () => ({ bumpShellRefresh: vi.fn() }));
vi.mock("@/stores/snackbar-store", () => ({ showSnackbar: vi.fn() }));
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

  it("sits each Avatar beside its question in one row", () => {
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
    expect(first).toEqual(["Avatar", "Text"]);
    expect(second).toEqual(["Avatar", "Text"]);
    const questions = rows.map((row) =>
      textOf((row.props.children as TestElement[])[1]),
    );
    expect(questions).toEqual([
      "Did you text Grace Hopper?",
      "Did you reach Ada Lovelace?",
    ]);
    // One TalkBack stop per row with one label (review WR2-04).
    expect(
      rows.map((row) => [row.props.accessible, row.props.accessibilityLabel]),
    ).toEqual([
      [true, "Did you text Grace Hopper?"],
      [true, "Did you reach Ada Lovelace?"],
    ]);
  });
});

describe("PendingConfirmationsSheet close guard (38.9 D-13, D-14; J-07)", () => {
  beforeEach(resetHarness);

  const modalOf = (tree: TestElement[]) =>
    tree.find((node) => node.type === "Modal") as TestElement;
  const scrimOf = (tree: TestElement[]) =>
    tree.find(
      (node) =>
        node.props.accessibilityLabel === "Dismiss pending confirmations",
    ) as TestElement;
  const confirmationFor = (tree: TestElement[], index: number) =>
    tree.filter((node) => node.type === "AssistConfirmation")[index];

  it("routes Back and the scrim through one close that is not the raw onClose", () => {
    const onClose = vi.fn();
    const tree = render({ visible: true, onClose });
    const back = modalOf(tree).props.onRequestClose;
    const scrim = scrimOf(tree).props.onPress;
    expect(typeof back).toBe("function");
    expect(back).not.toBe(onClose);
    expect(scrim).not.toBe(onClose);
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
