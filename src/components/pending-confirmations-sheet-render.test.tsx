import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { EligiblePendingAssist } from "@/db/interaction-assist-read";
import { THEME_PRESETS } from "@/theme/theme-presets";

/**
 * Shallow render of Pending confirmations (38.6 D-14): each queued assist shows
 * the contact's photo (or initials) through `Avatar` beside its question.
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

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => [
    typeof value === "function" ? (value as () => unknown)() : value,
    () => {},
  ],
}));
vi.mock("react-native", () => ({
  Alert: { alert: vi.fn() },
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
vi.mock("@/stores/shell-refresh-store", () => ({ bumpShellRefresh: vi.fn() }));
vi.mock("@/stores/assist-store", () => ({
  useAssistBanner: (
    select: (state: {
      queue: EligiblePendingAssist[];
      refresh: () => void;
    }) => unknown,
  ) => select({ queue: QUEUE, refresh: () => {} }),
}));
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

describe("PendingConfirmationsSheet photos (38.6 D-14)", () => {
  const tree = nodes(
    PendingConfirmationsSheet({ visible: true, onClose: () => {} }),
  );

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
  });
});
