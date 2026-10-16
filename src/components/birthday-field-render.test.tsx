/**
 * The shared BirthdayField's Clear (38.11 D-49, D-59; 38.11-14 A7): Clear is
 * offered on Edit Contact and the Profile Birthday sheet once a birthday is
 * set, and never on Add Contact (`showClear={false}`).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (value: unknown) => [value, vi.fn()],
}));
vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: <T,>(styles: T) => styles },
  View: "View",
}));
vi.mock("@react-native-community/datetimepicker", () => ({
  default: "DateTimePicker",
}));
vi.mock("@/components/ui", () => ({
  AppText: "AppText",
  Button: "Button",
  OrbitSwitch: "OrbitSwitch",
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({
    colors: {
      surface: "surface",
      border: "border",
      textPrimary: "textPrimary",
      textSecondary: "textSecondary",
    },
  }),
}));

const { BirthdayField } = await import("./BirthdayField");

interface Node {
  type: string;
  props: Record<string, unknown>;
  children: Node[];
}

function resolve(node: ReactNode): Node[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(resolve);
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (typeof element.type === "function") {
    return resolve(
      (element.type as (props: unknown) => ReactNode)(element.props),
    );
  }
  if (typeof element.type !== "string") return resolve(element.props.children);
  return [
    {
      type: element.type,
      props: element.props,
      children: resolve(element.props.children),
    },
  ];
}

function all(nodes: readonly Node[]): Node[] {
  return nodes.flatMap((node) => [node, ...all(node.children)]);
}

const SET = {
  input: "1990-06-02",
  yearUnknown: false,
  yearIsPlaceholder: false,
};
const EMPTY = { input: null, yearUnknown: false, yearIsPlaceholder: false };

function clearOf(props: {
  value: typeof SET | typeof EMPTY;
  showClear?: boolean;
}) {
  return all(
    resolve(BirthdayField({ testID: "bday", onChange: () => {}, ...props })),
  ).find((node) => node.props.testID === "bday-clear");
}

describe("BirthdayField Clear (38.11 D-49, D-59; 38.11-14 A7)", () => {
  it("offers Clear by default once a birthday is set", () => {
    expect(clearOf({ value: SET })?.props.label).toBe("Clear");
    expect(clearOf({ value: EMPTY })).toBeUndefined();
  });

  it("hides Clear when the host turns it off, even with a birthday set", () => {
    expect(clearOf({ value: SET, showClear: false })).toBeUndefined();
  });

  it("Add Contact turns Clear off; Edit Contact and the Profile sheet keep it", () => {
    const read = (path: string) =>
      readFileSync(join(__dirname, "..", "..", path), "utf8");
    const field = (source: string, testID: string) =>
      source.slice(
        source.indexOf(`testID="${testID}"`) - 40,
        source.indexOf(`testID="${testID}"`) + 120,
      );
    expect(
      field(
        read("src/screens/CreateContactScreen.tsx"),
        "create-contact-birthday",
      ),
    ).toContain("showClear={false}");
    expect(
      field(read("src/screens/EditContactScreen.tsx"), "edit-contact-birthday"),
    ).not.toContain("showClear");
    expect(
      field(
        read("src/components/profile/BirthdaySheet.tsx"),
        "profile-birthday",
      ),
    ).not.toContain("showClear");
  });
});
