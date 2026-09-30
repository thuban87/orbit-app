import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";

/**
 * Edit Contact's custom photo field holding text (38.6 D-34), deep render:
 * PhotoFieldWidget → the real PhotoSourcePicker → the real Avatar → the real
 * display source (`usePhotoDisplay`) → the real photo-storage resolvers (only
 * the native `expo-file-system` is stubbed). Before D-34, "Rex" reached
 * `resolvePhotoDisplayUri`, whose `assertSafeRelative` threw during render.
 *
 * Hooks are stubbed: `useState` returns its initial value, `useEffect` runs
 * its effect at once, `useMemo` computes inline.
 */

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useCallback: (fn: unknown) => fn,
  useEffect: (effect: () => unknown) => {
    effect();
  },
  useMemo: (factory: () => unknown) => factory(),
  useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => [
    typeof value === "function" ? (value as () => unknown)() : value,
    () => {},
  ],
}));
vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  Alert: { alert: vi.fn() },
  Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles },
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("@react-navigation/native", () => ({
  useFocusEffect: () => {},
  useNavigation: () => ({ navigate: vi.fn() }),
}));
vi.mock("expo-file-system", () => ({
  Directory: class {},
  File: class {},
  Paths: { document: { uri: "file:///doc/" } },
}));
vi.mock("expo-image", () => ({ Image: "Image" }));
vi.mock("expo-image-picker", () => ({ launchImageLibraryAsync: vi.fn() }));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/ui/AppText", () => ({ AppText: "AppText" }));
vi.mock("@/components/photo-url-submit", () => ({ runUrlSubmit: vi.fn() }));
vi.mock("@/db/contacts-dao", () => ({
  clearContactPhotoCore: vi.fn(),
  getContactPhotoIdentity: vi.fn(),
}));
vi.mock("@/db/database", () => ({
  getExecutor: vi.fn(),
  localDateTime: vi.fn(),
}));
vi.mock("@/db/profile-dao", () => ({ clearProfilePhotoCore: vi.fn() }));
vi.mock("@/services/photos/owned-master", () => ({
  enqueueRemovalIntentOwned: vi.fn(),
  removeOwnedMaster: vi.fn(),
}));
vi.mock("@/services/photos/url-image", () => ({ isImageUrl: () => true }));
vi.mock("@/services/widget/widget-refresh", () => ({
  notifyWidgetDataChanged: vi.fn(),
}));
vi.mock("@/stores/photo-cache-bust-store", () => ({
  getPhotoCacheBust: () => undefined,
  usePhotoCacheBust: () => undefined,
}));
vi.mock("@/stores/photo-result-store", () => ({
  consumeCropResult: vi.fn(),
  markPhotoStaged: vi.fn(),
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/theme/danger-scrim", () => ({ persistentDangerScrim: () => null }));
vi.mock("@/utils/logger", () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { Avatar } from "@/components/Avatar";
import { PhotoFieldWidget } from "./PhotoFieldWidget";

interface Node {
  readonly type: string;
  readonly props: Record<string, unknown>;
  readonly children: readonly Node[];
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

const onChange = vi.fn();

function render(value: string | null): Node[] {
  return all(
    resolve(
      PhotoFieldWidget({
        value,
        onChange,
        label: "Dog",
        contactId: 7,
        colName: "dog",
        testID: "field-dog",
      }),
    ),
  );
}

const byTestId = (nodes: Node[], id: string) =>
  nodes.find((node) => node.props.testID === id);

beforeEach(() => {
  onChange.mockReset();
});

describe("Edit Contact photo field with text in it (38.6 D-34)", () => {
  it("renders without throwing: initials, 'Photo unavailable', Change and Remove", () => {
    const nodes = render("Rex");
    expect(byTestId(nodes, "avatar-initials")).toBeDefined();
    expect(nodes.some((node) => node.type === "Image")).toBe(false);
    const notice = byTestId(nodes, "photo-unavailable");
    expect(notice?.props.accessibilityLabel).toBe("Photo unavailable");
    expect(
      byTestId(nodes, "photo-source-add-change")?.props.accessibilityLabel,
    ).toBe("Change photo");
    expect(
      byTestId(nodes, "photo-source-remove")?.props.accessibilityLabel,
    ).toBe("Remove photo");
  });

  it("leaves the text value untouched (no automatic clear or rewrite)", () => {
    render("Rex");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("still renders a stored photo path through the display source, with no notice", () => {
    const nodes = render("avatars/cv-7-dog.jpg");
    const image = nodes.find((node) => node.type === "Image");
    expect(image?.props.source).toEqual({
      uri: "file:///doc/avatars/cv-7-dog.jpg",
    });
    expect(byTestId(nodes, "photo-unavailable")).toBeUndefined();
  });

  it("an Avatar handed text directly shows initials and reports it as a failure", () => {
    const onLoadErrorChange = vi.fn();
    const nodes = all(
      resolve(
        Avatar({ photo: "Rex", name: "Dog", size: 96, onLoadErrorChange }),
      ),
    );
    expect(byTestId(nodes, "avatar-initials")).toBeDefined();
    expect(nodes.some((node) => node.type === "Image")).toBe(false);
    expect(onLoadErrorChange).toHaveBeenLastCalledWith(true);
  });
});
