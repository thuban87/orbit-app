import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";
import type { BackupHealth } from "./backup-health-logic";

/**
 * 38.12-17 render test for the Backup page (Settings → Data & Backup). The
 * screen is called as a function with its hooks mocked, so its element tree
 * and handlers can be read and pressed directly.
 *
 * `useState` is answered in call order; `STATE` names the slots this test
 * reads or seeds. Every other slot gets its initial value.
 */
const STATE = {
  health: 0,
  encryptionEnabled: 2,
  restoreStage: 5,
  passphraseVisible: 8,
} as const;

const mocks = vi.hoisted(() => ({
  overrides: new Map<number, unknown>(),
  setters: [] as ReturnType<typeof vi.fn>[],
  cursor: 0,
  backUpNow: vi.fn(),
  chooseFolder: vi.fn(),
  getAppSettings: vi.fn(),
  snackbar: vi.fn(),
  choose: vi.fn(),
  confirm: vi.fn(),
  manualExport: vi.fn(),
  focusEffects: [] as (() => unknown)[],
  folderListing: [] as string[],
}));

vi.mock("react", () => ({
  useCallback: (fn: unknown) => fn,
  useRef: (initial: unknown) => ({ current: initial }),
  useState: (initial: unknown) => {
    const index = mocks.cursor;
    mocks.cursor += 1;
    const setter = vi.fn();
    mocks.setters[index] = setter;
    const value = mocks.overrides.has(index)
      ? mocks.overrides.get(index)
      : typeof initial === "function"
        ? (initial as () => unknown)()
        : initial;
    return [value, setter];
  },
}));
vi.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => unknown) => {
    mocks.focusEffects.push(effect);
  },
}));
vi.mock("react-native", () => ({
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/components/ShellAppBar", () => ({ ShellAppBar: "ShellAppBar" }));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/ui", () => ({
  AppText: "AppText",
  SettingsRow: "SettingsRow",
  SettingsSectionCard: "SettingsSectionCard",
}));
vi.mock("@/navigation/use-bottom-clearance", () => ({
  useBottomClearance: () => 0,
}));
vi.mock("@/db/database", () => ({
  getExecutor: () => ({ id: "exec" }),
  localDateTime: () => "2026-10-17 12:00:00",
}));
vi.mock("@/db/app-settings-dao", () => ({
  getAppSettings: mocks.getAppSettings,
  recordAutomaticBackupHealthCore: vi.fn(),
}));
vi.mock("@/db/backup-meaningful-read", () => ({
  hasMeaningfulBackupData: async () => true,
}));
vi.mock("@/db/transaction", () => ({
  inWriteTransaction: async (_exec: unknown, fn: () => Promise<unknown>) =>
    fn(),
}));
vi.mock("@/services/backup/backup-now", () => ({
  runAutomaticBackupNow: mocks.backUpNow,
  chooseAutomaticBackupFolder: mocks.chooseFolder,
}));
vi.mock("@/services/backup/backup-service", () => ({
  AUTOMATIC_BACKUP_TOO_LARGE_DIAGNOSTIC: "too-large-diagnostic",
  createManualExportService: () => ({ shareExport: mocks.manualExport }),
  loadBackupForRestorePreview: vi.fn(),
}));
vi.mock("@/services/backup/saf-storage", () => ({
  createSafStorage: () => ({ list: async () => mocks.folderListing }),
  ownedAutomaticEntries: (entries: unknown[]) => entries,
}));
vi.mock("@/services/backup/encryption", () => ({
  APPROVED_BACKUP_ENCRYPTION_PROFILE: "test",
  createBackupEnvelopeCrypto: vi.fn(),
}));
vi.mock("@/services/backup/passphrase-store", () => ({
  backupPassphraseStore: { getPassphrase: async () => ({ status: "absent" }) },
}));
vi.mock("@/services/backup/share-export", () => ({
  createExpoShareAdapter: vi.fn(),
  createLocalExportFiles: vi.fn(),
  readStoredPhotoBase64: vi.fn(),
}));
vi.mock("@/services/backup/skipped-photos", () => ({
  automaticSkippedPhotosLine: () => null,
  readAutomaticSkippedPhotos: async () => null,
  skippedPhotosCopy: (count: number) =>
    count > 0 ? `${count} photos couldn't be included.` : null,
}));
vi.mock("@/stores/confirm-store", () => ({
  choose: mocks.choose,
  confirm: mocks.confirm,
  notice: vi.fn(),
}));
vi.mock("@/stores/snackbar-store", () => ({ showSnackbar: mocks.snackbar }));
vi.mock("@/utils/logger", () => ({
  Logger: { error: vi.fn(), warn: vi.fn() },
}));
vi.mock("../../modules/orbit-backup-document-picker", () => ({
  consumeSharedBackup: vi.fn(),
  pickBackupDocument: vi.fn(),
  readBackupFolderDisplayName: async () => "Orbit backups",
}));
vi.mock("./backup-restore-document", () => ({
  readRestoreDocument: vi.fn(),
}));
vi.mock("./backup-restore-logic", () => ({
  isEncryptedBackupEnvelope: () => false,
  restorePreviewCache: { store: vi.fn() },
  restorePreviewFailure: vi.fn(),
}));

const { BackupScreen } = await import("./BackupScreen");

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

function render(overrides: Record<number, unknown> = {}): TestElement[] {
  mocks.overrides = new Map(
    Object.entries(overrides).map(([key, value]) => [Number(key), value]),
  );
  mocks.setters = [];
  mocks.focusEffects = [];
  mocks.cursor = 0;
  const navigation = { navigate: vi.fn() };
  return nodes(
    BackupScreen({
      navigation,
      route: { key: "Backup", name: "Backup", params: undefined },
    } as never),
  );
}

function byTestID(tree: TestElement[], testID: string): TestElement {
  const found = tree.find((n) => n.props.testID === testID);
  if (!found) throw new Error(`Missing testID "${testID}"`);
  return found;
}

function maybeByTestID(
  tree: TestElement[],
  testID: string,
): TestElement | undefined {
  return tree.find((n) => n.props.testID === testID);
}

const STALE: BackupHealth = {
  kind: "stale",
  headline: "Your backup needs attention",
  reason: "changed-data",
  body: "Your data has changed since the last automatic backup.",
  lastAutomaticBackupAt: "2026-10-01 09:00:00",
};

const NOT_CONFIGURED: BackupHealth = {
  kind: "not-configured",
  headline: "Backups aren't set up",
  body: "Choose a folder to start protecting your data.",
};

const HEALTHY: BackupHealth = {
  kind: "healthy",
  headline: "Your data is protected",
  folderName: "Orbit",
  lastAutomaticBackupAt: "2026-10-17 12:00:00",
  automaticFileCount: 3,
};

/** Settings that resolve to a healthy card once re-read after the backup. */
const SETTINGS_AFTER_BACKUP = {
  backupFolderUri:
    "content://com.android.externalstorage.documents/tree/primary%3AOrbit",
  backupFolderName: "Orbit",
  backupFolderAccessible: 1,
  backupFolderDiagnostic: null,
  lastAutomaticBackupAt: "2026-10-17 12:00:00",
  dataRevision: 9,
  lastBackupDataRevision: 9,
  backupIntervalDays: 7,
  backupNudgeDismissed: 0,
  encryptionEnabled: 0,
};

beforeEach(() => {
  mocks.backUpNow.mockReset();
  mocks.chooseFolder.mockReset();
  mocks.snackbar.mockReset();
  mocks.choose.mockReset();
  mocks.confirm.mockReset();
  mocks.manualExport.mockReset();
  mocks.getAppSettings.mockReset().mockResolvedValue(SETTINGS_AFTER_BACKUP);
});

describe("warning card action (38.12 D-115)", () => {
  it("offers Back up now when a folder is set and the backup needs attention", () => {
    const button = byTestID(
      render({ [STATE.health]: STALE }),
      "backup-warning-action",
    );
    expect(button.props.accessibilityLabel).toBe("Back up now");
  });

  it("offers Choose a folder when no folder is chosen", () => {
    const button = byTestID(
      render({ [STATE.health]: NOT_CONFIGURED }),
      "backup-warning-action",
    );
    expect(button.props.accessibilityLabel).toBe("Choose a folder");
  });

  it("a healthy card has no warning action", () => {
    expect(
      maybeByTestID(
        render({ [STATE.health]: HEALTHY }),
        "backup-warning-action",
      ),
    ).toBeUndefined();
  });

  it("Back up now runs the automatic backup, confirms with a snackbar and reloads health, which clears the warning", async () => {
    mocks.backUpNow.mockResolvedValue({ status: "written", skippedPhotos: 0 });
    const tree = render({ [STATE.health]: STALE });
    const setHealth = mocks.setters[STATE.health];
    const onPress = byTestID(tree, "backup-warning-action").props
      .onPress as () => void;
    onPress();
    await vi.waitFor(() =>
      expect(setHealth).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "healthy" }),
      ),
    );
    expect(mocks.backUpNow).toHaveBeenCalledExactlyOnceWith({
      exec: { id: "exec" },
    });
    expect(mocks.snackbar).toHaveBeenCalledWith({
      kind: "success",
      label: "Backed up",
    });
    // The re-rendered card (health now healthy) shows no warning action.
    expect(
      maybeByTestID(
        render({ [STATE.health]: setHealth.mock.calls.at(-1)?.[0] }),
        "backup-warning-action",
      ),
    ).toBeUndefined();
  });

  it("a failed Back up now says to reconnect the folder", async () => {
    mocks.backUpNow.mockResolvedValue({ status: "failed" });
    const tree = render({ [STATE.health]: STALE });
    (byTestID(tree, "backup-warning-action").props.onPress as () => void)();
    await vi.waitFor(() =>
      expect(mocks.snackbar).toHaveBeenCalledWith({
        kind: "error",
        label: "Couldn't back up. Reconnect your backup folder.",
      }),
    );
  });

  it("a double tap starts one backup (single-flight, T-38.12-39)", async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.backUpNow.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const tree = render({ [STATE.health]: STALE });
    const onPress = byTestID(tree, "backup-warning-action").props
      .onPress as () => void;
    onPress();
    onPress();
    await vi.waitFor(() => expect(mocks.backUpNow).toHaveBeenCalledOnce());
    finish({ status: "written", skippedPhotos: 0 });
    await vi.waitFor(() => expect(mocks.snackbar).toHaveBeenCalledOnce());
    expect(mocks.backUpNow).toHaveBeenCalledOnce();
  });

  it("Choose a folder opens the shared folder chooser, then reloads", async () => {
    mocks.chooseFolder.mockResolvedValue(true);
    const tree = render({ [STATE.health]: NOT_CONFIGURED });
    (byTestID(tree, "backup-warning-action").props.onPress as () => void)();
    await vi.waitFor(() => expect(mocks.getAppSettings).toHaveBeenCalled());
    expect(mocks.chooseFolder).toHaveBeenCalledOnce();
    expect(mocks.backUpNow).not.toHaveBeenCalled();
  });
});

describe("export choice with Cancel (38.12 D-63)", () => {
  async function exportWith(choice: "confirm" | "secondary" | "cancel") {
    mocks.choose.mockResolvedValue(choice);
    mocks.manualExport.mockResolvedValue({
      status: "shared",
      skippedPhotos: 0,
    });
    const tree = render({ [STATE.encryptionEnabled]: true });
    await (
      byTestID(tree, "backup-export").props.onPress as () => Promise<void>
    )();
  }

  it("offers both exports and a Cancel in one themed choice; encrypted is the primary (D-149)", async () => {
    await exportWith("cancel");
    expect(mocks.choose).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        title: "Export your data?",
        confirmLabel: "Export encrypted",
        secondaryLabel: "Export readable JSON",
        cancelLabel: "Cancel",
      }),
    );
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it("Cancel exports nothing", async () => {
    await exportWith("cancel");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.manualExport).not.toHaveBeenCalled();
  });

  it("the primary choice exports encrypted; only the secondary exports readable JSON (D-149)", async () => {
    await exportWith("confirm");
    await vi.waitFor(() =>
      expect(mocks.manualExport).toHaveBeenCalledWith({
        readableOverride: false,
      }),
    );
    mocks.manualExport.mockClear();
    await exportWith("secondary");
    await vi.waitFor(() =>
      expect(mocks.manualExport).toHaveBeenCalledWith({
        readableOverride: true,
      }),
    );
  });
});

describe("restore passphrase show/hide (38.12 D-124)", () => {
  it("starts hidden with a Show passphrase control", () => {
    const tree = render({ [STATE.restoreStage]: "passphrase" });
    expect(
      byTestID(tree, "restore-passphrase-input").props.secureTextEntry,
    ).toBe(true);
    const toggle = byTestID(tree, "restore-passphrase-visibility");
    expect(toggle.props.accessibilityLabel).toBe("Show passphrase");
    (toggle.props.onPress as () => void)();
    const update = mocks.setters[STATE.passphraseVisible].mock
      .calls[0]?.[0] as (visible: boolean) => boolean;
    expect(update(false)).toBe(true);
  });

  it("revealed, the field shows the text and offers Hide passphrase", () => {
    const tree = render({
      [STATE.restoreStage]: "passphrase",
      [STATE.passphraseVisible]: true,
    });
    expect(
      byTestID(tree, "restore-passphrase-input").props.secureTextEntry,
    ).toBe(false);
    expect(
      byTestID(tree, "restore-passphrase-visibility").props.accessibilityLabel,
    ).toBe("Hide passphrase");
  });
});

describe("Backup page chrome (38.12 D-64, D-65)", () => {
  it("is titled with the hub row's label", () => {
    const bar = render().find((n) => n.type === "ShellAppBar");
    expect(bar?.props.title).toBe("Data & Backup");
  });

  it("draws its icons through the registry", () => {
    const names = render({ [STATE.health]: STALE })
      .filter((n) => n.type === "Icon")
      .map((n) => n.props.name);
    expect(names).toEqual(
      expect.arrayContaining(["backup-export", "backup-restore"]),
    );
  });
});

describe("hero kept-backups count and folder name (38.12 D-62, D-143)", () => {
  it("on focus, counts the owned automatic backups in the folder and names the folder from its provider", async () => {
    mocks.folderListing = ["a", "b", "c"];
    render();
    const setHealth = mocks.setters[STATE.health];
    const reload = mocks.focusEffects[0] as () => () => void;
    reload();
    await vi.waitFor(() =>
      expect(setHealth).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "healthy",
          automaticFileCount: 3,
          folderName: "Orbit backups",
        }),
      ),
    );
    // Drawn first without a count and with the URI-derived name, so a slow
    // provider never holds the card back.
    expect(setHealth.mock.calls[0]?.[0]).toMatchObject({
      kind: "healthy",
      folderName: "Orbit",
      automaticFileCount: null,
    });
    mocks.folderListing = [];
  });

  it("the healthy hero says how many backups are kept, zero included", () => {
    const tree = render({
      [STATE.health]: { ...HEALTHY, automaticFileCount: 0 },
    });
    const detail = tree.find(
      (n) =>
        typeof n.props.children === "string" &&
        (n.props.children as string).includes("kept in"),
    );
    expect(detail?.props.children).toContain("0 backups kept in Orbit");
  });
});

describe("Backup page shared row (38.12 D-119)", () => {
  it("the Encryption entry is the shared Settings row, opening the encryption section", () => {
    const navigation = { navigate: vi.fn() };
    mocks.overrides = new Map();
    mocks.setters = [];
    mocks.focusEffects = [];
    mocks.cursor = 0;
    const tree = nodes(
      BackupScreen({
        navigation,
        route: { key: "Backup", name: "Backup", params: undefined },
      } as never),
    );
    const row = byTestID(tree, "backup-encryption");
    expect(row.type).toBe("SettingsRow");
    expect(row.props.title).toBe("Encryption");
    (row.props.onPress as () => void)();
    expect(navigation.navigate).toHaveBeenCalledWith("BackupSettings", {
      section: "encryption",
    });
  });
});
