import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";

/**
 * 38.12-18 render test for Restore preview (D-60, D-61, D-66). The screen is
 * called as a function with its hooks mocked, so its element tree and
 * handlers can be read directly. `useState` answers each slot with its
 * initial value unless `mocks.overrides` seeds it by initial value.
 */
const mocks = vi.hoisted(() => ({
  setters: [] as ReturnType<typeof vi.fn>[],
  seeds: new Map<unknown, unknown>(),
}));

vi.mock("react", () => ({
  useCallback: (fn: unknown) => fn,
  useEffect: () => {},
  useRef: (initial: unknown) => ({ current: initial }),
  useState: (initial: unknown) => {
    const value =
      typeof initial === "function" ? (initial as () => unknown)() : initial;
    const setter = vi.fn();
    mocks.setters.push(setter);
    return [mocks.seeds.has(value) ? mocks.seeds.get(value) : value, setter];
  },
}));
vi.mock("react-native", () => ({
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Text: "Text",
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/components/ShellAppBar", () => ({ ShellAppBar: "ShellAppBar" }));
vi.mock("@/components/ui", () => ({
  OptionSelectRow: "OptionSelectRow",
  OptionSheet: "OptionSheet",
}));
vi.mock("@/backup/restore-apply", () => ({ applyRestore: vi.fn() }));
vi.mock("@/db/app-settings-dao", () => ({
  assertBackgroundId: vi.fn(),
  getAppSettings: vi.fn(),
}));
vi.mock("@/db/database", () => ({
  getExecutor: () => ({ id: "exec" }),
  localDateTime: () => "2026-10-17 12:00:00",
}));
vi.mock("@/services/backup/backup-service", () => ({
  createVerifiedPreRestoreSnapshot: vi.fn(),
}));
vi.mock("@/services/backup/encryption", () => ({
  APPROVED_BACKUP_ENCRYPTION_PROFILE: "test",
  createBackupEnvelopeCrypto: vi.fn(),
}));
vi.mock("@/services/backup/passphrase-store", () => ({
  backupPassphraseStore: { getPassphrase: vi.fn() },
}));
vi.mock("@/services/backup/restore-completion", () => ({
  publishCommittedRestore: vi.fn(),
}));
vi.mock("@/services/backup/saf-storage", () => ({
  createSafStorage: vi.fn(),
}));
vi.mock("@/services/backup/share-export", () => ({
  readStoredPhotoBase64: vi.fn(),
}));
vi.mock("@/stores/confirm-store", () => ({ confirm: vi.fn() }));
vi.mock("@/stores/theme-store", () => ({
  useThemeStore: { getState: () => ({ hydrate: vi.fn() }) },
}));
vi.mock("@/utils/logger", () => ({
  Logger: { error: vi.fn(), warn: vi.fn() },
}));

const { RestorePreviewScreen } = await import("./RestorePreviewScreen");
const { restorePreviewCache } = await import("./backup-restore-logic");

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}
function textOf(element: TestElement): string {
  const children = element.props.children;
  const parts = Array.isArray(children) ? children : [children];
  return parts
    .map((part) =>
      typeof part === "string" || typeof part === "number" ? String(part) : "",
    )
    .join("");
}

const preview = {
  exportedAt: "2026-10-17T14:30:00.123Z",
  backupFormatVersion: 9,
  encrypted: false,
  rowCount: 60,
  photoCount: 3,
  contactCount: 42,
  backupContacts: 40,
  phoneContacts: 12,
  relatedRowCount: 18,
  tombstoneCount: 2,
};

function render(): TestElement[] {
  mocks.setters = [];
  const route = restorePreviewCache.store({
    manifest: {} as unknown as import("@/backup/types").BackupManifest,
    preview,
  });
  return nodes(
    RestorePreviewScreen({
      navigation: { addListener: vi.fn(), dispatch: vi.fn() },
      route: { key: "RestorePreview", name: "RestorePreview", params: route },
    } as never),
  );
}

function byType(tree: TestElement[], type: string): TestElement {
  const found = tree.find((node) => node.type === type);
  if (!found) throw new Error(`Missing ${type}`);
  return found;
}

describe("Restore preview (38.12 D-60, D-61, D-66)", () => {
  beforeEach(() => {
    mocks.seeds = new Map();
  });

  it("compares this phone's people with the backup's", () => {
    const lines = render()
      .filter((node) => node.type === "Text")
      .map(textOf);
    expect(lines).toContain("This phone: 12 contacts · Backup: 40 contacts");
  });

  it("shows the real source time for a UTC 'Z' stamp, never 'Unknown time'", () => {
    const lines = render()
      .filter((node) => node.type === "Text")
      .map(textOf);
    const source = lines.find((line) => line.startsWith("Source date: "));
    expect(source).toBeDefined();
    expect(source).not.toContain("Unknown time");
  });

  it("chooses the mode through the shared selection row, with Merge preselected", () => {
    const tree = render();
    const row = byType(tree, "OptionSelectRow");
    expect(row.props.currentLabel).toBe("Merge");
    const sheet = byType(tree, "OptionSheet");
    expect(sheet.props.selected).toBe("merge");
    expect(sheet.props.options).toEqual([
      { value: "merge", label: "Merge" },
      { value: "replace-all", label: "Replace all" },
    ]);
    // No hand-drawn radio cards remain.
    expect(
      tree.filter((node) => node.props.accessibilityRole === "radio"),
    ).toEqual([]);
  });

  it("names Replace 'Replace all' on the row and the apply button", () => {
    mocks.seeds = new Map<unknown, unknown>([["merge", "replace-all"]]);
    const tree = render();
    expect(byType(tree, "OptionSelectRow").props.currentLabel).toBe(
      "Replace all",
    );
    const apply = tree.find((node) => node.props.testID === "restore-apply");
    expect(apply?.props.accessibilityLabel).toBe("Replace all");
    const labels = tree.filter((node) => node.type === "Text").map(textOf);
    expect(labels.some((line) => /Replace and /.test(line))).toBe(false);
    expect(labels.some((line) => /Replace all local/.test(line))).toBe(false);
  });
});

describe("Choose file again keeps the host's stack (38.12 D-67, D-68)", () => {
  function renderExpired(host?: { kind: "settings" } | { kind: "digest" }) {
    mocks.seeds = new Map();
    const navigation = {
      addListener: vi.fn(),
      popTo: vi.fn(),
      reset: vi.fn(),
    };
    const tree = nodes(
      RestorePreviewScreen({
        navigation,
        route: {
          key: "RestorePreview",
          name: "RestorePreview",
          params: { token: "expired-token", preview, host },
        },
      } as never),
    );
    return { tree, navigation };
  }

  it.each([
    [undefined, { kind: "settings" }],
    [{ kind: "digest" } as const, { kind: "digest" }],
  ] as const)(
    "pops to the Backup page beneath, keeping host %j",
    (host, expected) => {
      const { tree, navigation } = renderExpired(host);
      const chooseAgain = tree.find(
        (node) => node.props.accessibilityLabel === "Choose file again",
      );
      if (!chooseAgain) throw new Error("Missing Choose file again");
      (chooseAgain.props.onPress as () => void)();
      const appBar = byType(tree, "ShellAppBar");
      (appBar.props.onBack as () => void)();
      expect(navigation.popTo.mock.calls).toEqual([
        ["Backup", { host: expected }],
        ["Backup", { host: expected }],
      ]);
      expect(navigation.reset).not.toHaveBeenCalled();
    },
  );
});
