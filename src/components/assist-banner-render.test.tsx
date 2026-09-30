import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { EligiblePendingAssist } from "@/db/interaction-assist-read";
import { THEME_PRESETS } from "@/theme/theme-presets";

/**
 * Shallow render of the Home assist banner (38.6 D-25 F-2): the banner shows
 * the contact's photo (or initials) through `Avatar` beside its question,
 * matching the Pending confirmations sheet it opens (38.6 D-14).
 */

const banner = vi.hoisted(() => ({
  state: {
    newest: null as EligiblePendingAssist | null,
    morePendingCount: 0,
    refresh: () => Promise.resolve(),
  },
}));

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
  Pressable: "Pressable",
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
vi.mock("@/stores/assist-store", () => ({
  useAssistBanner: (select: (state: typeof banner.state) => unknown) =>
    select(banner.state),
}));
vi.mock("@/stores/shell-transient-store", () => ({
  shellTransientStore: (select: (state: unknown) => unknown) => select({}),
}));
vi.mock("@/components/universal-fab-logic", () => ({
  fabDialBackgroundA11y: () => ({}),
  selectFabDialOpen: () => false,
}));
vi.mock("@/components/Avatar", () => ({ Avatar: "Avatar" }));
vi.mock("@/components/AssistConfirmation", () => ({
  AssistConfirmation: "AssistConfirmation",
}));
vi.mock("@/components/PendingConfirmationsSheet", () => ({
  PendingConfirmationsSheet: "PendingConfirmationsSheet",
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
vi.mock("@/utils/logger", () => ({ Logger: { error: vi.fn() } }));

const { AssistBanner } = await import("./AssistBanner");

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

function flatStyle(element: TestElement | undefined): Record<string, unknown> {
  const style = element?.props.style;
  return Array.isArray(style)
    ? Object.assign({}, ...(style as object[]))
    : ((style as Record<string, unknown>) ?? {});
}

const NEWEST: EligiblePendingAssist = {
  id: 2,
  uid: "assist-2",
  contact_id: 12,
  channel: "text",
  endpoint_value: null,
  handoff_at: "2026-09-30 09:00:00",
  created_at: "2026-09-30 09:00:01",
  contact_name: "Grace Hopper",
  contact_photo: "avatars/contact-12.jpg",
};

function render(
  newest: EligiblePendingAssist | null,
  morePendingCount = 0,
): TestElement[] {
  banner.state = { ...banner.state, newest, morePendingCount };
  return nodes(AssistBanner());
}

describe("AssistBanner photo (38.6 D-25 F-2)", () => {
  it("renders the contact's Avatar (40) with its photo, name and id", () => {
    const avatars = render(NEWEST).filter((node) => node.type === "Avatar");
    expect(avatars.map((node) => node.props)).toEqual([
      {
        photo: "avatars/contact-12.jpg",
        name: "Grace Hopper",
        contactId: 12,
        size: 40,
      },
    ]);
  });

  it("sits the Avatar before the one-line question in one row", () => {
    const tree = render(NEWEST);
    const row = tree.find((node) => {
      if (node.type !== "View") return false;
      const kids = node.props.children;
      return (
        Array.isArray(kids) &&
        (kids as TestElement[]).some((kid) => kid?.type === "Avatar")
      );
    });
    const kids = row?.props.children as TestElement[];
    expect(kids.map((kid) => kid.type)).toEqual(["Avatar", "Text"]);
    expect(flatStyle(row)).toMatchObject({
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    });
    const question = kids[1];
    expect(textOf(question)).toBe("Did you text Grace Hopper?");
    expect(question?.props.numberOfLines).toBe(1);
    expect(flatStyle(question)).toMatchObject({ flex: 1 });
  });

  it("gives the Avatar null (initials) when the contact has no photo", () => {
    const avatar = render({ ...NEWEST, contact_photo: null }).find(
      (node) => node.type === "Avatar",
    );
    expect(avatar?.props.photo).toBeNull();
    expect(avatar?.props.name).toBe("Grace Hopper");
  });

  it("still renders the pending count and the confirmation controls", () => {
    const tree = render(NEWEST, 3);
    const count = tree.find(
      (node) =>
        node.type === "Pressable" &&
        node.props.accessibilityLabel === "3 more pending",
    );
    expect(count).toBeDefined();
    expect(tree.some((node) => node.type === "AssistConfirmation")).toBe(true);
  });

  it("renders no Avatar with no newest assist", () => {
    expect(render(null).some((node) => node.type === "Avatar")).toBe(false);
  });
});
