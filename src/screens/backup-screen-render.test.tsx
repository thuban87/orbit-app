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
const STATE = { health: 0 } as const;

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
vi.mock("@react-navigation/native", () => ({ useFocusEffect: vi.fn() }));
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
  createSafStorage: () => ({ list: async () => [] }),
  ownedAutomaticUris: (uris: string[]) => uris,
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
  mocks.cursor = 0;
  const navigation = { navigate: vi.fn() };
  return nodes(
    BackupScreen({
      navigation,
      route: { key: "Backup", name: "Backup", params: undefined },
      host: "settings",
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
  backupFolderUri: "content://tree/primary%3AOrbit",
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
