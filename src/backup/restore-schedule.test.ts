import { scheduleNotificationAsync } from "expo-notifications";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));
vi.mock("expo-notifications");
vi.mock("@/services/photos/photo-storage", async () => {
  const paths = await vi.importActual<
    typeof import("@/db/photo-relative-path")
  >("@/db/photo-relative-path");
  return {
    contactPhotoRelPath: (id: number) => `avatars/contact-${id}.jpg`,
    customFieldPhotoRelPath: (id: number, col: string) =>
      `avatars/cv-${id}-${col}.jpg`,
    profilePhotoRelPath: () => "avatars/profile.jpg",
    restorePendingRelPath: paths.restorePendingRelPath,
    stageRestorePendingBase64: async () => {},
    listRestorePendingPhotos: () => [],
    deleteRestorePending: () => {},
    resolveRestorePendingUri: (path: string) => path,
    persistMaster: async () => "",
    deletePhoto: () => {},
    photoFileExists: () => false,
  };
});
vi.mock("@/services/photos/background-storage", () => ({
  backgroundDerivativeRelPath: (uid: string) =>
    `profile-backgrounds/${uid}.jpg`,
  stageBackgroundRestorePendingBase64: async () => {},
  deleteBackgroundRestorePending: () => {},
}));
vi.mock("@/services/notifications/digest-schedule", () => ({
  reconcileDigestSchedule: async () => {},
}));

import { buildExportManifest } from "@/backup/export-manifest";
import { applyRestore } from "@/backup/restore-apply";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { updateAppSettings } from "@/db/app-settings-dao";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import { __resetReconcileForTest } from "@/services/notifications/notification-schedule";
import { __reset as resetExpo } from "../../__mocks__/expo-notifications";

const NOW = "2026-09-24 00:00:00";
async function db() {
  const exec = nodeSqliteExecutor(openTestDb());
  let next = 0;
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: () => `sched-${++next}`,
    defaultPhoneRegion: "US",
  });
  return exec;
}

beforeEach(() => {
  resetExpo();
  __resetReconcileForTest();
  vi.mocked(scheduleNotificationAsync).mockReset();
});

it.each([true, false])(
  "reports native per-item schedule failure as pending=%s",
  async (fail) => {
    const source = await db();
    const destination = await db();
    await updateAppSettings(
      source,
      { notificationsEnabled: 1, birthdayEnabled: 1 },
      NOW,
    );
    const birthday = new Date();
    birthday.setDate(birthday.getDate() + 2);
    const mmdd = `${String(birthday.getMonth() + 1).padStart(2, "0")}-${String(birthday.getDate()).padStart(2, "0")}`;
    await source.runAsync(
      "INSERT INTO contacts(uid,name,birthday,tracking_enabled,interval_days,created_at,modified_at) VALUES('birthday','Birthday',?,1,30,?,?)",
      [`2000-${mmdd}`, NOW, NOW],
    );
    const manifest = await buildExportManifest(source, {
      exportedAt: NOW,
      readPhotoBase64: async () => "",
    });
    if (fail)
      vi.mocked(scheduleNotificationAsync).mockRejectedValueOnce(
        new Error("native failure"),
      );
    const result = await applyRestore(destination, manifest, "replace-all");
    expect(result).toMatchObject({
      status: "applied",
      scheduleResyncPending: fail,
    });
    expect(scheduleNotificationAsync).toHaveBeenCalled();
  },
);
