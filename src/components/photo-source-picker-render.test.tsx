import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";

/**
 * Shallow render of the photo editor (38.6 D-23): a kept reference whose file
 * will not load shows "Photo unavailable" at the top of the actions column,
 * and Change photo / Remove photo stay available.
 *
 * 38.9 D-27 / D-30 / D-40: Remove photo is a themed destructive confirm, URL
 * validation errors render inline under the URL field, and the other photo
 * failures are error snackbars. `useState` slots can be seeded by call order
 * (`SLOT`) and their setters are spies.
 */

const h = vi.hoisted(() => ({
  failed: false,
  setFailed: vi.fn(),
  index: 0,
  seed: new Map<number, unknown>(),
  setters: [] as ReturnType<typeof vi.fn>[],
}));

/** PhotoSourcePicker's `useState` call order. */
const SLOT = { urlEntryOpen: 0, urlText: 1, submittingUrl: 2, urlError: 3 };

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useCallback: (fn: unknown) => fn,
  useEffect: () => {},
  useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => {
    const slot = h.index++;
    if (!h.setters[slot]) h.setters[slot] = vi.fn();
    return [
      h.seed.has(slot)
        ? h.seed.get(slot)
        : typeof value === "function"
          ? (value as () => unknown)()
          : value,
      h.setters[slot],
    ];
  },
}));
vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles },
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
}));
const nav = vi.hoisted(() => ({
  navigate: vi.fn(),
  focusEffects: [] as Array<() => unknown>,
}));
vi.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => unknown) => {
    nav.focusEffects.push(effect);
  },
  useNavigation: () => ({ navigate: nav.navigate }),
}));
const { launchImageLibraryAsync } = vi.hoisted(() => ({
  launchImageLibraryAsync: vi.fn(),
}));
vi.mock("expo-image-picker", () => ({ launchImageLibraryAsync }));
vi.mock("expo-image", () => ({ Image: "Image" }));
vi.mock("@/components/Avatar", () => ({ Avatar: "Avatar" }));
vi.mock("@/components/PhotoUnavailableNotice", () => ({
  PhotoUnavailableNotice: "PhotoUnavailableNotice",
  usePhotoLoadFailure: () => [h.failed, h.setFailed] as const,
}));
const { runUrlSubmit } = vi.hoisted(() => ({ runUrlSubmit: vi.fn() }));
vi.mock("@/components/photo-url-submit", () => ({ runUrlSubmit }));
vi.mock("@/components/ui/FieldError", () => ({ FieldError: "FieldError" }));
const { confirm } = vi.hoisted(() => ({ confirm: vi.fn() }));
vi.mock("@/stores/confirm-store", () => ({ confirm }));
const { showSnackbar } = vi.hoisted(() => ({ showSnackbar: vi.fn() }));
vi.mock("@/stores/snackbar-store", () => ({ showSnackbar }));
const { getContactPhotoIdentity } = vi.hoisted(() => ({
  getContactPhotoIdentity: vi.fn(),
}));
vi.mock("@/db/contacts-dao", () => ({
  clearContactPhotoCore: vi.fn(),
  getContactPhotoIdentity,
}));
vi.mock("@/db/database", () => ({
  getExecutor: vi.fn(),
  localDateTime: vi.fn(),
}));
vi.mock("@/db/profile-dao", () => ({ clearProfilePhotoCore: vi.fn() }));
const { removeOwnedMaster } = vi.hoisted(() => ({
  removeOwnedMaster: vi.fn(),
}));
vi.mock("@/services/photos/owned-master", () => ({
  enqueueRemovalIntentOwned: vi.fn(),
  removeOwnedMaster,
}));
const { deleteCreateStaging } = vi.hoisted(() => ({
  deleteCreateStaging: vi.fn(),
}));
vi.mock("@/services/photos/photo-storage", () => ({
  contactPhotoRelPath: (id: number) => `avatars/contact-${id}.jpg`,
  createStagingRelPath: (session: string, pick: string) =>
    `create-staging/create-${session}-${pick}.jpg`,
  customFieldPhotoRelPath: (id: number, col: string) =>
    `avatars/cv-${id}-${col}.jpg`,
  deleteCreateStaging,
  profilePhotoRelPath: () => "avatars/profile.jpg",
  resolveCreateStagingUri: (relative: string) => `file:///resolved/${relative}`,
}));
vi.mock("@/services/photos/create-photo", () => ({
  newCreateStagingToken: () => "pick1",
}));
const url = vi.hoisted(() => ({ valid: true }));
vi.mock("@/services/photos/url-image", () => ({
  isImageUrl: () => url.valid,
}));
vi.mock("@/services/widget/widget-refresh", () => ({
  notifyWidgetDataChanged: vi.fn(),
}));
const { consumeCropResult } = vi.hoisted(() => ({
  consumeCropResult: vi.fn(),
}));
vi.mock("@/stores/photo-result-store", () => ({
  consumeCropResult,
  markPhotoStaged: vi.fn(),
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/theme/danger-scrim", () => ({ persistentDangerScrim: () => null }));
vi.mock("@/utils/logger", () => ({ Logger: { error: vi.fn() } }));

import { type PhotoHold, PhotoSourcePicker } from "./PhotoSourcePicker";

/** The stored-photo target branch of the props (not Add Contact's hold). */
type PickerTarget = Extract<
  Parameters<typeof PhotoSourcePicker>[0],
  { target: unknown }
>["target"];

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
  target: PickerTarget = {
    kind: "contact",
    contactId: 7,
  },
  onValueChange?: (value: string | null) => void,
  seed: Partial<Record<keyof typeof SLOT, unknown>> = {},
) {
  h.index = 0;
  h.seed = new Map(
    Object.entries(seed).map(([key, value]) => [
      SLOT[key as keyof typeof SLOT],
      value,
    ]),
  );
  const [root] = resolve(
    PhotoSourcePicker({ target, photo, name: "Ada", onValueChange }),
  );
  return root;
}

const actionsOf = (root: Node | undefined) => root?.children[1];
const testIds = (node: Node | undefined) =>
  (node?.children ?? []).map((child) => child.props.testID ?? child.type);

beforeEach(() => {
  nav.focusEffects = [];
  nav.navigate.mockReset();
  launchImageLibraryAsync.mockReset();
  deleteCreateStaging.mockReset();
  consumeCropResult.mockReset();
  h.failed = false;
  h.setFailed.mockReset();
  for (const spy of h.setters) spy?.mockClear();
  url.valid = true;
  confirm.mockReset();
  showSnackbar.mockReset();
  removeOwnedMaster.mockReset();
  runUrlSubmit.mockReset();
  getContactPhotoIdentity.mockReset();
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

function all(nodes: readonly Node[]): Node[] {
  return nodes.flatMap((node) => [node, ...all(node.children)]);
}

const byTestId = (root: Node | undefined, id: string) =>
  all(root ? [root] : []).find((node) => node.props.testID === id);

async function flush() {
  await new Promise((done) => setTimeout(done, 0));
}

function prop<T>(root: Node | undefined, id: string, name: string): T {
  const node = byTestId(root, id);
  expect(node, id).toBeDefined();
  return (node as Node).props[name] as T;
}

describe("PhotoSourcePicker feedback (38.9 D-27, D-30, D-40)", () => {
  it("Remove photo asks a themed destructive confirm and removes nothing on Cancel", async () => {
    confirm.mockResolvedValueOnce(false);
    const root = render("avatars/contact-7.jpg");
    prop<() => void>(root, "photo-source-remove", "onPress")();
    await flush();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0]).toMatchObject({
      title: "Remove photo?",
      confirmLabel: "Remove",
      destructive: true,
    });
    // Destructive = non-dismissable; nothing may opt it back in.
    expect(confirm.mock.calls[0][0]).not.toHaveProperty("dismissable", true);
    expect(removeOwnedMaster).not.toHaveBeenCalled();
  });

  it("Remove photo removes after the confirm; a failure is an error snackbar", async () => {
    confirm.mockResolvedValueOnce(true);
    removeOwnedMaster.mockRejectedValueOnce(new Error("io"));
    const root = render("avatars/contact-7.jpg");
    prop<() => void>(root, "photo-source-remove", "onPress")();
    await flush();
    expect(removeOwnedMaster).toHaveBeenCalledTimes(1);
    expect(showSnackbar).toHaveBeenCalledWith({
      kind: "error",
      label: "Couldn't remove the photo. Please try again.",
    });
  });

  it("an invalid URL sets the inline error and shows no snackbar", async () => {
    url.valid = false;
    const root = render(null, undefined, undefined, {
      urlEntryOpen: true,
      urlText: "not a url",
    });
    prop<() => void>(root, "photo-source-url-submit", "onPress")();
    await flush();
    expect(h.setters[SLOT.urlError]).toHaveBeenCalledWith(
      "That doesn't look like an image URL. Check the link and try again.",
    );
    expect(showSnackbar).not.toHaveBeenCalled();
    expect(runUrlSubmit).not.toHaveBeenCalled();
  });

  it("renders the URL error under the URL field and clears it on change", () => {
    const root = render(null, undefined, undefined, {
      urlEntryOpen: true,
      urlError: "Bad link",
    });
    const entry = byTestId(root, "photo-source-url-input");
    const fieldError = byTestId(root, "photo-source-url-error");
    expect(fieldError?.type).toBe("FieldError");
    expect(fieldError?.props.message).toBe("Bad link");
    const column = all(root ? [root] : []).find((node) =>
      node.children.includes(entry as Node),
    );
    const order = column?.children.map((child) => child.props.testID);
    expect(order).toEqual([
      "photo-source-url-input",
      "photo-source-url-error",
      "photo-source-url-submit",
    ]);
    prop<(text: string) => void>(
      root,
      "photo-source-url-input",
      "onChangeText",
    )("h");
    expect(h.setters[SLOT.urlText]).toHaveBeenCalledWith("h");
    expect(h.setters[SLOT.urlError]).toHaveBeenCalledWith(null);
  });

  it("a fetch failure is an error snackbar with the existing words", async () => {
    getContactPhotoIdentity.mockResolvedValueOnce("contact-uid");
    runUrlSubmit.mockResolvedValueOnce({
      status: "error",
      cause: { kind: "network" },
    });
    const root = render(null, undefined, undefined, {
      urlEntryOpen: true,
      urlText: "https://example.com/a.jpg",
    });
    prop<() => void>(root, "photo-source-url-submit", "onPress")();
    await flush();
    expect(showSnackbar).toHaveBeenCalledWith({
      kind: "error",
      label:
        "Couldn't fetch that image. Check your connection or try a different link.",
    });
  });
});

describe("PhotoSourcePicker hold mode on Add Contact (38.11 D-77)", () => {
  const HELD = "create-staging/create-form1-pickA.jpg";

  function renderHold(
    heldRelative: string | null,
    onHeldChange: (relative: string | null) => void = vi.fn(),
  ) {
    h.index = 0;
    h.seed = new Map();
    nav.focusEffects = [];
    const hold: PhotoHold = {
      sessionToken: "form1",
      heldRelative,
      onHeldChange,
    };
    const [root] = resolve(PhotoSourcePicker({ hold, name: "Ada" }));
    return root;
  }

  it("previews the held file as an Image from resolveCreateStagingUri, with Change and Remove and no notice", () => {
    h.failed = true;
    const root = renderHold(HELD);
    const preview = root?.children[0];
    expect(preview?.type).toBe("Image");
    expect(preview?.props.source).toEqual({
      uri: `file:///resolved/${HELD}`,
    });
    expect(preview?.props.cachePolicy).toBe("none");
    expect(all(root ? [root] : []).some((n) => n.type === "Avatar")).toBe(
      false,
    );
    expect(testIds(actionsOf(root))).toEqual([
      "photo-source-add-change",
      "photo-source-remove",
    ]);
    expect(actionsOf(root)?.children[0]?.props.accessibilityLabel).toBe(
      "Change photo",
    );
  });

  it("with nothing held shows the initials preview, Add photo, no Remove, and needs no contact", async () => {
    const root = renderHold(null);
    expect(root?.children[0]?.type).toBe("Avatar");
    expect(root?.children[0]?.props.photo).toBeNull();
    expect(testIds(actionsOf(root))).toEqual([
      "photo-source-add-change",
      "photo-source-paste-url",
    ]);
    launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///cache/picked.jpg" }],
    });
    prop<() => void>(root, "photo-source-add-change", "onPress")();
    await flush();
    expect(getContactPhotoIdentity).not.toHaveBeenCalled();
    expect(showSnackbar).not.toHaveBeenCalled();
    expect(nav.navigate).toHaveBeenCalledWith("CropPhoto", {
      rawUri: "file:///cache/picked.jpg",
      hold: { stagingRel: "create-staging/create-form1-pick1.jpg" },
    });
  });

  it("Remove confirms with the same themed destructive gate, then deletes the held file and reports null", async () => {
    const onHeldChange = vi.fn();
    confirm.mockResolvedValueOnce(true);
    const root = renderHold(HELD, onHeldChange);
    prop<() => void>(root, "photo-source-remove", "onPress")();
    await flush();
    expect(confirm.mock.calls[0][0]).toMatchObject({
      title: "Remove photo?",
      confirmLabel: "Remove",
      destructive: true,
    });
    expect(deleteCreateStaging).toHaveBeenCalledWith(HELD);
    expect(onHeldChange).toHaveBeenCalledWith(null);
    expect(removeOwnedMaster).not.toHaveBeenCalled();
  });

  it("Remove cancelled keeps the held file", async () => {
    const onHeldChange = vi.fn();
    confirm.mockResolvedValueOnce(false);
    const root = renderHold(HELD, onHeldChange);
    prop<() => void>(root, "photo-source-remove", "onPress")();
    await flush();
    expect(deleteCreateStaging).not.toHaveBeenCalled();
    expect(onHeldChange).not.toHaveBeenCalled();
  });

  it("on focus consumes the crop for the pending path once, reports it and deletes the replaced file", async () => {
    const onHeldChange = vi.fn();
    const root = renderHold(HELD, onHeldChange);
    launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///cache/picked.jpg" }],
    });
    prop<() => void>(root, "photo-source-add-change", "onPress")();
    await flush();
    const next = "create-staging/create-form1-pick1.jpg";
    consumeCropResult.mockReturnValueOnce({ requestId: next, success: true });
    for (const effect of nav.focusEffects) effect();
    expect(consumeCropResult).toHaveBeenCalledWith(next);
    expect(onHeldChange).toHaveBeenCalledWith(next);
    expect(deleteCreateStaging).toHaveBeenCalledWith(HELD);
    // A second focus consumes nothing more.
    for (const effect of nav.focusEffects) effect();
    expect(consumeCropResult).toHaveBeenCalledTimes(1);
  });

  it("a cancelled crop changes nothing on focus", async () => {
    const onHeldChange = vi.fn();
    const root = renderHold(HELD, onHeldChange);
    launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///cache/picked.jpg" }],
    });
    prop<() => void>(root, "photo-source-add-change", "onPress")();
    await flush();
    consumeCropResult.mockReturnValueOnce(null);
    for (const effect of nav.focusEffects) effect();
    expect(onHeldChange).not.toHaveBeenCalled();
    expect(deleteCreateStaging).not.toHaveBeenCalled();
  });

  // Review IN-03: Back during "Use photo" refocuses the form before the crop
  // publishes. The pending path must survive that empty focus so the late
  // result is still consumed (and never orphaned) on the next one.
  it("keeps the pending path through a focus with no result yet, then consumes the late crop", async () => {
    const onHeldChange = vi.fn();
    const root = renderHold(HELD, onHeldChange);
    launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///cache/picked.jpg" }],
    });
    prop<() => void>(root, "photo-source-add-change", "onPress")();
    await flush();
    const next = "create-staging/create-form1-pick1.jpg";
    consumeCropResult.mockReturnValueOnce(null);
    for (const effect of nav.focusEffects) effect();
    expect(onHeldChange).not.toHaveBeenCalled();
    consumeCropResult.mockReturnValueOnce({ requestId: next, success: true });
    for (const effect of nav.focusEffects) effect();
    expect(consumeCropResult).toHaveBeenNthCalledWith(2, next);
    expect(onHeldChange).toHaveBeenCalledWith(next);
    expect(deleteCreateStaging).toHaveBeenCalledWith(HELD);
  });

  it("the paste-URL path also crops into a fresh held path", async () => {
    runUrlSubmit.mockImplementationOnce(
      async ({ navigate }: { navigate: (uri: string) => void }) => {
        navigate("file:///cache/photo-dl/x.jpg");
        return { status: "ok" };
      },
    );
    h.index = 0;
    h.seed = new Map<number, unknown>([
      [SLOT.urlEntryOpen, true],
      [SLOT.urlText, "https://example.com/a.jpg"],
    ]);
    const [root] = resolve(
      PhotoSourcePicker({
        hold: {
          sessionToken: "form1",
          heldRelative: null,
          onHeldChange: vi.fn(),
        },
        name: "Ada",
      }),
    );
    prop<() => void>(root, "photo-source-url-submit", "onPress")();
    await flush();
    expect(getContactPhotoIdentity).not.toHaveBeenCalled();
    expect(nav.navigate).toHaveBeenCalledWith("CropPhoto", {
      rawUri: "file:///cache/photo-dl/x.jpg",
      hold: { stagingRel: "create-staging/create-form1-pick1.jpg" },
    });
  });
});
