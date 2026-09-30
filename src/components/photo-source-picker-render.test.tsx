import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";

/**
 * Shallow render of the photo editor (38.6 D-23): a kept reference whose file
 * will not load shows "Photo unavailable" at the top of the actions column,
 * and Change photo / Remove photo stay available.
 */

const h = vi.hoisted(() => ({
  failed: false,
  setFailed: vi.fn(),
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useCallback: (fn: unknown) => fn,
  useEffect: () => {},
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
vi.mock("expo-image-picker", () => ({ launchImageLibraryAsync: vi.fn() }));
vi.mock("@/components/Avatar", () => ({ Avatar: "Avatar" }));
vi.mock("@/components/PhotoUnavailableNotice", () => ({
  PhotoUnavailableNotice: "PhotoUnavailableNotice",
  usePhotoLoadFailure: () => [h.failed, h.setFailed] as const,
}));
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
vi.mock("@/services/photos/photo-storage", () => ({
  contactPhotoRelPath: (id: number) => `avatars/contact-${id}.jpg`,
  customFieldPhotoRelPath: (id: number, col: string) =>
    `avatars/cv-${id}-${col}.jpg`,
  profilePhotoRelPath: () => "avatars/profile.jpg",
}));
vi.mock("@/services/photos/url-image", () => ({ isImageUrl: () => true }));
vi.mock("@/services/widget/widget-refresh", () => ({
  notifyWidgetDataChanged: vi.fn(),
}));
vi.mock("@/stores/photo-result-store", () => ({ markPhotoStaged: vi.fn() }));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/theme/danger-scrim", () => ({ persistentDangerScrim: () => null }));
vi.mock("@/utils/logger", () => ({ Logger: { error: vi.fn() } }));

import { PhotoSourcePicker } from "./PhotoSourcePicker";

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

function render(
  photo: string | null,
  target: Parameters<typeof PhotoSourcePicker>[0]["target"] = {
    kind: "contact",
    contactId: 7,
  },
  onValueChange?: (value: string | null) => void,
) {
  const [root] = resolve(
    PhotoSourcePicker({ target, photo, name: "Ada", onValueChange }),
  );
  return root;
}

const actionsOf = (root: Node | undefined) => root?.children[1];
const testIds = (node: Node | undefined) =>
  (node?.children ?? []).map((child) => child.props.testID ?? child.type);

beforeEach(() => {
  h.failed = false;
  h.setFailed.mockReset();
});

describe("PhotoSourcePicker 'Photo unavailable' (38.6 D-23)", () => {
  it("wires the preview Avatar's load error into the failure state", () => {
    const root = render("avatars/contact-7.jpg");
    const avatar = root?.children[0];
    expect(avatar?.type).toBe("Avatar");
    expect(avatar?.props.onLoadErrorChange).toBe(h.setFailed);
  });

  it("shows the notice first while the photo fails, and keeps Change and Remove", () => {
    h.failed = true;
    const actions = actionsOf(render("avatars/contact-7.jpg"));
    expect(testIds(actions)).toEqual([
      "PhotoUnavailableNotice",
      "photo-source-add-change",
      "photo-source-remove",
    ]);
    expect(actions?.children[1]?.props.accessibilityLabel).toBe("Change photo");
    expect(actions?.children[2]?.props.accessibilityLabel).toBe("Remove photo");
  });

  it("shows no notice while the photo loads", () => {
    const actions = actionsOf(render("avatars/contact-7.jpg"));
    expect(testIds(actions)).toEqual([
      "photo-source-add-change",
      "photo-source-remove",
    ]);
  });

  it("shows no notice when there is no photo", () => {
    h.failed = true;
    const actions = actionsOf(render(null));
    expect(testIds(actions)).not.toContain("PhotoUnavailableNotice");
    expect(testIds(actions)[0]).toBe("photo-source-add-change");
  });
});

describe("PhotoSourcePicker with text in a photo field (38.6 D-34)", () => {
  const field = { kind: "customField", contactId: 7, colName: "dog" } as const;

  it("never hands the text to the Avatar, shows the notice at once, keeps Change and Remove", () => {
    const onValueChange = vi.fn();
    const root = render("Rex", field, onValueChange);
    expect(root?.children[0]?.props.photo).toBeNull();
    expect(testIds(actionsOf(root))).toEqual([
      "PhotoUnavailableNotice",
      "photo-source-add-change",
      "photo-source-remove",
    ]);
    expect(actionsOf(root)?.children[1]?.props.accessibilityLabel).toBe(
      "Change photo",
    );
    // Display only: the value is never cleared or rewritten by rendering.
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("treats any non-path value the same way (contact target too)", () => {
    for (const text of [
      "/photos/pet.jpg",
      "file:///x.jpg",
      "avatars/../x.jpg",
    ]) {
      const root = render(text);
      expect(root?.children[0]?.props.photo).toBeNull();
      expect(testIds(actionsOf(root))[0]).toBe("PhotoUnavailableNotice");
    }
  });

  it("a stored photo path still reaches the Avatar with no notice", () => {
    const root = render("avatars/cv-7-dog.jpg", field);
    expect(root?.children[0]?.props.photo).toBe("avatars/cv-7-dog.jpg");
    expect(testIds(actionsOf(root))).not.toContain("PhotoUnavailableNotice");
  });
});
