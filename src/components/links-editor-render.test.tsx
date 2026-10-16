/**
 * LinksEditor's warn-only caption (38.11 D-88, review WR-04). The editor is a
 * stateless function component, so it is called directly and its element
 * tree searched; react-native and the theme are mocked to plain strings.
 */
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Linking: { openURL: vi.fn() },
  Pressable: "Pressable",
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({
    colors: {
      surface: "surface",
      border: "border",
      textPrimary: "textPrimary",
      textSecondary: "textSecondary",
      textPlaceholder: "textPlaceholder",
      accentText: "accentText",
      danger: "danger",
    },
  }),
}));
vi.mock("@/stores/snackbar-store", () => ({ showSnackbar: vi.fn() }));
vi.mock("@/utils/logger", () => ({ Logger: { error: vi.fn() } }));

import { LinksEditor } from "./LinksEditor";

function texts(node: ReactNode): string[] {
  if (node === null || node === undefined || typeof node === "boolean")
    return [];
  if (typeof node === "string" || typeof node === "number")
    return [String(node)];
  if (Array.isArray(node)) return node.flatMap(texts);
  const element = node as ReactElement<{ children?: ReactNode }>;
  return texts(element.props?.children);
}

function findByTestId(node: ReactNode, testID: string): ReactElement | null {
  if (node === null || node === undefined || typeof node !== "object")
    return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findByTestId(child, testID);
      if (hit) return hit;
    }
    return null;
  }
  const element = node as ReactElement<{
    testID?: string;
    children?: ReactNode;
  }>;
  if (element.props?.testID === testID) return element;
  return findByTestId(element.props?.children, testID);
}

const render = (links: { uid: string; url: string; label: string | null }[]) =>
  LinksEditor({
    links,
    onAdd: vi.fn(),
    onUpdate: vi.fn(),
    onRemove: vi.fn(),
  });

describe("LinksEditor missing-URL caption (D-88)", () => {
  it("shows the caption under a row with a label and no URL, in the danger colour", () => {
    const tree = render([{ uid: "a", url: "", label: "Instagram" }]);
    const caption = findByTestId(tree, "links-editor-missing-url-0") as
      | (ReactElement<{ style?: unknown; children?: ReactNode }> & object)
      | null;
    expect(caption).not.toBeNull();
    expect(texts(caption)).toEqual(["Add a link or this row won't be saved."]);
    expect(JSON.stringify(caption?.props.style)).toContain('"danger"');
  });

  it("shows nothing on an untouched row or a row with a URL", () => {
    const tree = render([
      { uid: "a", url: "", label: null },
      { uid: "b", url: "example.com", label: "Site" },
    ]);
    expect(findByTestId(tree, "links-editor-missing-url-0")).toBeNull();
    expect(findByTestId(tree, "links-editor-missing-url-1")).toBeNull();
    expect(texts(tree)).not.toContain("Add a link or this row won't be saved.");
  });
});
