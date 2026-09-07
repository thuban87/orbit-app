import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));
vi.mock("@/services/notifications/notification-schedule", () => ({
  reconcileSchedule: vi.fn(),
}));
vi.mock("@/services/notifications/digest-schedule", () => ({
  reconcileDigestSchedule: vi.fn(),
}));
vi.mock("@/services/photos/photo-storage", () => ({
  contactPhotoRelPath: vi.fn(),
  customFieldPhotoRelPath: vi.fn(),
  profilePhotoRelPath: vi.fn(),
  deletePhoto: vi.fn(),
  deleteRestorePending: vi.fn(),
  persistMaster: vi.fn(),
  photoFileExists: vi.fn(),
  resolveRestorePendingUri: vi.fn(),
  restorePendingRelPath: vi.fn(),
  stageRestorePendingBase64: vi.fn(),
}));

import { parseBackupManifest } from "@/backup/backup-schema";
import { buildExportManifest } from "@/backup/export-manifest";
import { applyRestore } from "@/backup/restore-apply";
import { BACKUP_FORMAT_VERSION, type BackupManifest } from "@/backup/types";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  getAppSettings,
  getPortableSettingsSnapshot,
  ORRERY_BUILTIN_SYSTEM_IDS,
  updateAppSettings,
} from "@/db/app-settings-dao";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import { newUid } from "@/db/uid";

const NOW = "2026-09-07 12:00:00";
const LATER = "2026-09-08 12:00:00";
let db: ReturnType<typeof openTestDb>;
let exec: ReturnType<typeof nodeSqliteExecutor>;
let manifest: BackupManifest;
beforeEach(async () => {
  db = openTestDb();
  exec = nodeSqliteExecutor(db);
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, { now: NOW, newUid });
  manifest = await buildExportManifest(exec, {
    exportedAt: NOW,
    readPhotoBase64: async () => "AQID",
  });
  manifest.appSettings.modifiedAt = LATER;
});
afterEach(() => db.close());

describe("Orrery preferences portability boundary", () => {
  it.each([
    ...ORRERY_BUILTIN_SYSTEM_IDS,
    "category:stable-uid",
    `category:${"a".repeat(256)}`,
  ])("accepts optional stable System %s", (system) => {
    Object.assign(manifest.appSettings, {
      orreryDensity: "compact",
      orrerySatellitesEnabled: 1,
      orreryLastSystem: system,
    });
    expect(parseBackupManifest(manifest).appSettings).toMatchObject({
      orreryDensity: "compact",
      orrerySatellitesEnabled: 1,
      orreryLastSystem: system,
    });
  });
  it.each(["merge", "replace-all"] as const)(
    "applies valid preferences through the real %s restore core",
    async (mode) => {
      const patch = {
        orreryDensity: "spacious",
        orrerySatellitesEnabled: 1,
        orreryLastSystem: "category:stable-uid",
      };
      Object.assign(manifest.appSettings, patch);
      expect(
        (await applyRestore(exec, parseBackupManifest(manifest), mode)).status,
      ).toBe("applied");
      expect(await getAppSettings(exec)).toMatchObject(patch);
    },
  );
  it.each(["merge", "replace-all"] as const)(
    "preserves existing choices when optional keys are absent in %s",
    async (mode) => {
      const patch = {
        orreryDensity: "compact" as const,
        orrerySatellitesEnabled: 1 as const,
        orreryLastSystem: "category:keep-me" as const,
      };
      await updateAppSettings(exec, patch, NOW);
      expect(
        (await applyRestore(exec, parseBackupManifest(manifest), mode)).status,
      ).toBe("applied");
      expect(await getAppSettings(exec)).toMatchObject(patch);
    },
  );
  it.each([
    { orreryDensity: "unknown" },
    { orreryDensity: null },
    { orrerySatellitesEnabled: 2 },
    { orrerySatellitesEnabled: true },
    { orreryLastSystem: "builtin:unknown" },
    { orreryLastSystem: "category:" },
    { orreryLastSystem: "category:bad\nuid" },
    { orreryLastSystem: `category:${"x".repeat(257)}` },
  ])("rejects invalid preference values: %j", (patch) => {
    Object.assign(manifest.appSettings, patch);
    expect(() => parseBackupManifest(manifest)).toThrow();
  });
  it.each([
    "camera",
    "focus",
    "orreryCamera",
    "orreryFocus",
    "apiKey",
    "backupFolderUri",
  ])("rejects unapproved or secret key %s", (key) => {
    manifest.appSettings[key] = "forbidden";
    expect(() => parseBackupManifest(manifest)).toThrow();
  });
  it("keeps current snapshot/export omission and format4 after preferences are saved", async () => {
    await updateAppSettings(
      exec,
      {
        orreryDensity: "compact",
        orrerySatellitesEnabled: 1,
        orreryLastSystem: "category:private-choice",
      },
      NOW,
    );
    const portable = await getPortableSettingsSnapshot(exec);
    const exported = await buildExportManifest(exec, {
      exportedAt: NOW,
      readPhotoBase64: async () => "AQID",
    });
    expect(BACKUP_FORMAT_VERSION).toBe(4);
    expect(exported.backupFormatVersion).toBe(4);
    for (const key of [
      "orreryDensity",
      "orrerySatellitesEnabled",
      "orreryLastSystem",
      "camera",
      "focus",
      "apiKey",
      "backupFolderUri",
    ]) {
      expect(portable).not.toHaveProperty(key);
      expect(exported.appSettings).not.toHaveProperty(key);
    }
  });
});
