import { expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));
vi.mock("@/services/photos/photo-storage", () => ({
  contactPhotoRelPath: (id: number) => `avatars/contact-${id}.jpg`,
  customFieldPhotoRelPath: (id: number, colName: string) =>
    `avatars/cv-${id}-${colName}.jpg`,
  profilePhotoRelPath: () => "avatars/profile.jpg",
  deletePhoto: () => {},
  deleteRestorePending: () => {},
  photoFileExists: () => false,
  persistMaster: async () => {},
  resolveRestorePendingUri: (path: string) => path,
  restorePendingRelPath: () => "avatars/_restore_pending/test.jpg",
  stageRestorePendingBase64: async () => {},
}));
vi.mock("@/services/photos/background-storage", () => ({
  backgroundDerivativeRelPath: (uid: string) =>
    `profile-backgrounds/${uid}.jpg`,
  resolveBackgroundRestorePendingUri: (path: string) => path,
  stageBackgroundRestorePendingBase64: async () => {},
  persistBackgroundDerivative: async () => {},
  deleteBackgroundRestorePending: () => {},
}));
vi.mock("@/services/notifications/notification-schedule", () => ({
  reconcileSchedule: async () => {},
}));
vi.mock("@/services/notifications/digest-schedule", () => ({
  reconcileDigestSchedule: async () => {},
}));

import { parseBackupManifest } from "@/backup/backup-schema";
import { buildExportManifest } from "@/backup/export-manifest";
import { applyRestore } from "@/backup/restore-apply";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import { completeGlobalPairsCore } from "@/db/pair-matrix";

const NOW = "2026-09-01 00:00:00";
let next = 0;
async function db() {
  const exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: () => `test-${++next}`,
  });
  return exec;
}
async function contact(
  exec: Awaited<ReturnType<typeof db>>,
  uid: string,
  archived = false,
) {
  await exec.runAsync(
    "INSERT INTO contacts(uid,name,interval_days,archived_at,created_at,modified_at) VALUES(?,?,30,?,?,?)",
    [uid, uid, archived ? NOW : null, NOW, NOW],
  );
}
async function def(
  exec: Awaited<ReturnType<typeof db>>,
  uid: string,
  scope = "global",
  quarantined = false,
) {
  await exec.runAsync(
    "INSERT INTO custom_field_defs(uid,col_name,label,type,show_on_new,always_show,display_order,share_with_ai,scope,quarantined_at,created_at,modified_at) VALUES(?,?,?,'text',0,0,0,0,?,?,?,?)",
    [uid, uid, uid, scope, quarantined ? NOW : null, NOW, NOW],
  );
}
async function exported(exec: Awaited<ReturnType<typeof db>>) {
  return parseBackupManifest(
    await buildExportManifest(exec, {
      exportedAt: NOW,
      readPhotoBase64: async () => "AQID",
    }),
  );
}

it("Merge with local definitions completes all global pairs and its real export restores", async () => {
  const source = await db();
  const destination = await db();
  await contact(source, "incoming");
  await def(destination, "global");
  await def(destination, "quarantined", "global", true);
  await def(destination, "scoped", "contact");
  expect(
    (await applyRestore(destination, await exported(source), "merge")).status,
  ).toBe("applied");
  const rows = await destination.getAllAsync<{ defUid: string; uid: string }>(
    "SELECT d.uid AS defUid,v.uid FROM custom_field_values v JOIN custom_field_defs d ON d.id=v.field_def_id",
  );
  expect(rows.map((row) => row.defUid).sort()).toEqual([
    "global",
    "quarantined",
  ]);
  expect(rows.every((row) => row.uid.startsWith("pair:"))).toBe(true);
  const copy = await db();
  expect(
    (await applyRestore(copy, await exported(destination), "replace-all"))
      .status,
  ).toBe("applied");
});

it("Merge with incoming definitions completes local archived contacts and independently seeded pairs reconcile", async () => {
  const source = await db();
  const destination = await db();
  await contact(source, "shared");
  await contact(destination, "shared");
  await contact(destination, "local-only", true);
  await def(source, "global");
  await def(destination, "global");
  await completeGlobalPairsCore(source);
  await completeGlobalPairsCore(destination);
  expect(
    (await applyRestore(destination, await exported(source), "merge")).status,
  ).toBe("applied");
  const count = await destination.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM custom_field_values v JOIN contacts c ON c.id=v.contact_id WHERE c.uid='local-only'",
  );
  expect(count?.n).toBe(1);
  expect(
    (await applyRestore(source, await exported(destination), "merge")).status,
  ).toBe("applied");
});
