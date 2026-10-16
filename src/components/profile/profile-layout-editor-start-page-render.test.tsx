/**
 * 38.11 D-89: editing a template's layout from the Templates sheet skips the
 * Profile Layout first page and opens the editor directly, so the
 * contact-specific "Editing creates a contact-specific layout…" line never
 * shows for a template. The Profile's own ⋯ → Profile Layout still opens on
 * that first page.
 *
 * The editor is called directly with React's hooks mocked (useState returns
 * its initial value), and its element tree is read shallowly.
 */
import { readFileSync } from "node:fs";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { FACTORY_PROFILE_LAYOUT } from "@/profile/presentation-schema";

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: () => {},
  useRef: <T,>(value: T) => ({ current: value }),
  useState: (value: unknown) => [
    typeof value === "function" ? (value as () => unknown)() : value,
    vi.fn(),
  ],
  useReducer: (
    _reducer: unknown,
    arg: unknown,
    init?: (value: unknown) => unknown,
  ) => [init ? init(arg) : arg, vi.fn()],
}));
vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: <T,>(styles: T) => styles },
  View: "View",
  useWindowDimensions: () => ({ width: 360, fontScale: 1 }),
}));
vi.mock("react-native-reorderable-list", () => ({
  NestedReorderableList: "NestedReorderableList",
  ScrollViewContainer: "ScrollViewContainer",
  useReorderableDrag: () => vi.fn(),
}));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));
vi.mock("@/components/ui/Button", () => ({ Button: "Button" }));
vi.mock("@/components/ui/GlassSurface", () => ({
  GlassSurface: "GlassSurface",
}));
vi.mock("@/components/ui/ScopedPalette", () => ({
  ScopedPalette: "ScopedPalette",
}));
vi.mock("@/components/ui/Sheet", () => ({ Sheet: "Sheet" }));
vi.mock("@/components/ui/OrbitSwitch", () => ({ OrbitSwitch: "OrbitSwitch" }));
vi.mock("@/db/database", () => ({
  getExecutor: vi.fn(),
  localDateTime: vi.fn(),
}));
vi.mock("@/navigation/discard-keep-guard", () => ({
  confirmDiscard: vi.fn(),
}));
vi.mock("@/db/profile-presentation-dao", () => ({
  resetContactLayoutPresentation: vi.fn(),
  setContactFreeformLayout: vi.fn(),
}));
vi.mock("@/stores/confirm-store", () => ({ confirm: vi.fn() }));

const { ProfileLayoutEditor } = await import("./ProfileLayoutEditor");

/** Every string child in the tree, without calling child components. */
function texts(node: ReactNode): string[] {
  if (node === null || node === undefined || typeof node === "boolean")
    return [];
  if (typeof node === "string" || typeof node === "number")
    return [String(node)];
  if (Array.isArray(node)) return node.flatMap(texts);
  const element = node as ReactElement<{ children?: ReactNode }>;
  return texts(element.props?.children);
}

const render = (startInEditor?: boolean) =>
  texts(
    ProfileLayoutEditor({
      visible: true,
      contactId: 1,
      contactName: "Ann",
      currentLayout: "the default layout",
      layout: FACTORY_PROFILE_LAYOUT,
      onRequestClose: vi.fn(),
      startInEditor,
    }),
  ).join(" ");

describe("Profile Layout first page vs template editing (D-89)", () => {
  it("opens a template's layout straight in the editor, with no contact-specific line", () => {
    const shown = render(true);
    expect(shown).toContain("Edit layout");
    expect(shown).toContain("Drag a handle or use Move up and Move down.");
    expect(shown).not.toContain("Editing creates a contact-specific layout");
    expect(shown).not.toContain("currently uses");
  });

  it("keeps the first page for the Profile's own Profile Layout", () => {
    const shown = render();
    expect(shown).toContain("Profile Layout");
    expect(shown).toContain(
      "Editing creates a contact-specific layout only after you save.",
    );
  });

  it("the Templates sheet asks for the editor directly", () => {
    const manager = readFileSync(
      new URL("./ProfileTemplateManager.tsx", import.meta.url),
      "utf8",
    );
    const mount = manager.slice(manager.indexOf("<ProfileLayoutEditor"));
    expect(mount.slice(0, mount.indexOf("/>"))).toContain("startInEditor");
  });
});
