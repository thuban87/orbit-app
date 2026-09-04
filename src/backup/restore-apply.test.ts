import { beforeEach, describe, expect, it, vi } from "vitest";

// Restore application injects the native photo operations. Keep its SQLite graph
// tests node-only while exercising the production defaults in photo-storage.test.
const photoMocks = vi.hoisted(() => ({
  staged: [] as Array<[string, string]>,
  persisted: [] as Array<[string, string]>,
  deleted: [] as string[],
  persistFails: false,
  deleteLeavesFile: false,
}));
vi.mock("@/services/photos/photo-storage", () => ({
  contactPhotoRelPath: (id: number) => `avatars/contact-${id}.jpg`,
  customFieldPhotoRelPath: (id: number, colName: string) => `avatars/cv-${id}-${colName}.jpg`,
  profilePhotoRelPath: () => "avatars/profile.jpg",
  deletePhoto: (path: string) => { photoMocks.deleted.push(path); },
  deleteRestorePending: () => {},
  persistMaster: async (source: string, destination: string) => {
    photoMocks.persisted.push([source, destination]);
    if (photoMocks.persistFails) throw new Error("disk unavailable");
  },
  photoFileExists: () => photoMocks.deleteLeavesFile,
  resolveRestorePendingUri: (relative: string) => `file:///doc/${relative}`,
  restorePendingRelPath: (target: { kind: string; uid?: string }, session: string) => `avatars/_restore_pending/${target.kind}-${target.uid ?? "profile"}-${session}.jpg`,
  stageRestorePendingBase64: async (base64: string, relative: string) => { photoMocks.staged.push([base64, relative]); },
}));
vi.mock("@/services/notifications/notification-schedule", () => ({ reconcileSchedule: async () => {} }));
vi.mock("@/services/notifications/digest-schedule", () => ({ reconcileDigestSchedule: async () => {} }));
import { buildExportManifest } from "@/backup/export-manifest";
import { applyRestore } from "@/backup/restore-apply";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { migration006 } from "@/db/migrations/006-normalize-custom-field-values";
import { migration007 } from "@/db/migrations/007-tombstones";
import { migration008 } from "@/db/migrations/008-restore-photo-journal";
import { migration009 } from "@/db/migrations/009-contact-method-normalization";
import { migration010 } from "@/db/migrations/010-contact-method-label";
import { migration011 } from "@/db/migrations/011-contact-lifecycle-schema";
import { migration012 } from "@/db/migrations/012-import-sessions";
import { migration013 } from "@/db/migrations/013-reconciliation-and-merge";
import { migration014 } from "@/db/migrations/014-interaction-assists";
import { migration015 } from "@/db/migrations/015-theme-settings";
import { migration016 } from "@/db/migrations/016-contact-knowledge";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-25 12:00:00";
let uid = 0;
const newUid = () => `uid-${++uid}`;
const migrations = [migration001, migration002, migration003, migration004, migration005, migration006, migration007, migration008, migration009, migration010, migration011, migration012, migration013, migration014, migration015, migration016];

async function db(): Promise<SqlExecutor> {
  const exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, migrations, 16, { now: NOW, newUid });
  return exec;
}

beforeEach(() => {
  uid = 0;
  photoMocks.staged = [];
  photoMocks.persisted = [];
  photoMocks.deleted = [];
  photoMocks.persistFails = false;
  photoMocks.deleteLeavesFile = false;
});

describe("applyRestore", () => {
  it("round-trips live and deleted knowledge, linked people, and current/history state", async () => {
    const source = await db();
    const owner = await source.runAsync("INSERT INTO contacts (uid,name,interval_days,rarely_responds,reminders_off,created_at,modified_at) VALUES (?,?,?,?,?,?,?)", ["knowledge-owner", "Owner", 14, 0, 0, NOW, NOW]);
    const linked = await source.runAsync("INSERT INTO contacts (uid,name,interval_days,rarely_responds,reminders_off,created_at,modified_at) VALUES (?,?,?,?,?,?,?)", ["knowledge-linked", "Linked", 14, 0, 0, NOW, NOW]);
    await source.runAsync("INSERT INTO memories (uid,contact_id,type,value,pinned,outdated,provenance,created_at,modified_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?)", ["memory-live", owner.lastInsertRowId, "custom", "Live", 1, 0, "user", NOW, NOW, null]);
    await source.runAsync("INSERT INTO memories (uid,contact_id,type,value,pinned,outdated,provenance,created_at,modified_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?)", ["memory-deleted", owner.lastInsertRowId, "custom", "Deleted", 0, 0, "user", NOW, NOW, "2026-08-26 12:00:00"]);
    await source.runAsync("INSERT INTO relationships (uid,contact_id,person_name,linked_contact_id,pinned,created_at,modified_at,deleted_at) VALUES (?,?,?,?,?,?,?,?)", ["relationship-linked", owner.lastInsertRowId, "Linked", linked.lastInsertRowId, 1, NOW, NOW, null]);
    await source.runAsync("INSERT INTO current_state_entries (uid,contact_id,field_key,value,is_current,created_at,modified_at) VALUES (?,?,?,?,?,?,?)", ["state-history", owner.lastInsertRowId, "current_location", "Chicago", 0, NOW, NOW]);
    await source.runAsync("INSERT INTO current_state_entries (uid,contact_id,field_key,value,is_current,created_at,modified_at) VALUES (?,?,?,?,?,?,?)", ["state-current", owner.lastInsertRowId, "current_location", "Madison", 1, NOW, "2026-08-26 12:00:00"]);
    const manifest = await buildExportManifest(source, { exportedAt: NOW, readPhotoBase64: async () => "" });
    const destination = await db();
    await expect(applyRestore(destination, manifest, "replace-all")).resolves.toMatchObject({ status: "applied" });
    await expect(destination.getAllAsync("SELECT uid,deleted_at FROM memories ORDER BY uid")).resolves.toEqual([{ uid: "memory-deleted", deleted_at: "2026-08-26 12:00:00" }, { uid: "memory-live", deleted_at: null }]);
    await expect(destination.getFirstAsync<{ linked_uid: string }>("SELECT linked.uid AS linked_uid FROM relationships r JOIN contacts linked ON linked.id=r.linked_contact_id WHERE r.uid=?", ["relationship-linked"])).resolves.toEqual({ linked_uid: "knowledge-linked" });
    await expect(destination.getAllAsync("SELECT uid,is_current FROM current_state_entries ORDER BY uid")).resolves.toEqual([{ uid: "state-current", is_current: 1 }, { uid: "state-history", is_current: 0 }]);
  });
  it("reconciles all decisions before one transaction and UID-maps an incoming contact", async () => {
    const source = await db();
    await source.runAsync(
      `INSERT INTO contacts (uid,name,interval_days,rarely_responds,reminders_off,created_at,modified_at)
       VALUES (?,?,?,?,?,?,?)`,
      ["incoming-contact", "Incoming", 14, 0, 0, NOW, "2026-08-25 12:01:00"],
    );
    const manifest = await buildExportManifest(source, { exportedAt: NOW, readPhotoBase64: async () => "" });
    const destination = await db();

    await expect(applyRestore(destination, manifest, "merge")).resolves.toMatchObject({
      status: "applied", inserted: 1,
    });
    await expect(destination.getFirstAsync<{ name: string; interval_days: number }>(
      "SELECT name, interval_days FROM contacts WHERE uid = ?", ["incoming-contact"],
    )).resolves.toEqual({ name: "Incoming", interval_days: 14 });
  });

  it("round-trips an Unbound lifecycle state with its dormant cadence", async () => {
    const source = await db();
    await source.runAsync(
      `INSERT INTO contacts (uid,name,tracking_enabled,interval_days,rarely_responds,reminders_off,created_at,modified_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      ["unbound-contact", "Unbound", 0, 14, 0, 0, NOW, "2026-08-25 12:01:00"],
    );
    const manifest = await buildExportManifest(source, { exportedAt: NOW, readPhotoBase64: async () => "" });
    expect(manifest.contacts).toEqual([
      expect.objectContaining({ uid: "unbound-contact", trackingEnabled: 0, intervalDays: 14 }),
    ]);

    const destination = await db();
    await expect(applyRestore(destination, manifest, "merge")).resolves.toMatchObject({ status: "applied" });
    await expect(destination.getFirstAsync<{ tracking_enabled: number; interval_days: number | null }>(
      "SELECT tracking_enabled,interval_days FROM contacts WHERE uid=?", ["unbound-contact"],
    )).resolves.toEqual({ tracking_enabled: 0, interval_days: 14 });
  });

  it("retains assigned local cadence when a newer valid Unbound merge proposes null cadence", async () => {
    const destination = await db();
    await destination.runAsync(
      `INSERT INTO contacts (uid,name,tracking_enabled,interval_days,rarely_responds,reminders_off,created_at,modified_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      ["shared-contact", "Local", 1, 14, 0, 0, NOW, NOW],
    );
    const manifest = await buildExportManifest(destination, { exportedAt: NOW, readPhotoBase64: async () => "" });
    manifest.contacts = [{
      ...manifest.contacts[0], name: "Incoming", trackingEnabled: 0, intervalDays: null,
      modifiedAt: "2026-08-25 12:01:00",
    }];

    await expect(applyRestore(destination, manifest, "merge")).resolves.toMatchObject({ status: "applied" });
    await expect(destination.getFirstAsync<{ name: string; tracking_enabled: number; interval_days: number | null }>(
      "SELECT name,tracking_enabled,interval_days FROM contacts WHERE uid=?", ["shared-contact"],
    )).resolves.toEqual({ name: "Incoming", tracking_enabled: 0, interval_days: 14 });
  });

  it("uses an FK-safe reset for replace-all before inserting the incoming graph", async () => {
    const source = await db();
    await source.runAsync(
      `INSERT INTO contacts (uid,name,interval_days,rarely_responds,reminders_off,created_at,modified_at)
       VALUES (?,?,?,?,?,?,?)`,
      ["replacement", "Replacement", 21, 0, 0, NOW, "2026-08-25 12:01:00"],
    );
    const manifest = await buildExportManifest(source, { exportedAt: NOW, readPhotoBase64: async () => "" });
    const destination = await db();
    await destination.runAsync(
      `INSERT INTO contacts (uid,name,interval_days,rarely_responds,reminders_off,created_at,modified_at)
       VALUES (?,?,?,?,?,?,?)`,
      ["old-local", "Old", 30, 0, 0, NOW, NOW],
    );

    await expect(applyRestore(destination, manifest, "replace-all")).resolves.toMatchObject({ status: "applied", mode: "replace-all" });
    await expect(destination.getAllAsync<{ uid: string }>("SELECT uid FROM contacts ORDER BY uid")).resolves.toEqual([{ uid: "replacement" }]);
    await expect(destination.getFirstAsync<{ entity_uid: string }>(
      "SELECT entity_uid FROM tombstones WHERE entity_type = 'contact' AND entity_uid = 'old-local'",
    )).resolves.toEqual({ entity_uid: "old-local" });
  });

  it("purges local-only import sessions during Replace-all restore", async () => {
    const source = await db();
    await source.runAsync(
      `INSERT INTO contacts (uid,name,interval_days,rarely_responds,reminders_off,created_at,modified_at)
       VALUES (?,?,?,?,?,?,?)`,
      ["replacement", "Replacement", 21, 0, 0, NOW, "2026-08-25 12:01:00"],
    );
    const manifest = await buildExportManifest(source, {
      exportedAt: NOW,
      readPhotoBase64: async () => "",
    });
    const destination = await db();
    const session = await destination.runAsync(
      `INSERT INTO import_sessions (uid,mode,phone_region,total_rows,created_at,modified_at)
       VALUES (?,?,?,?,?,?)`,
      ["local-session", "bulk", "US", 1, NOW, NOW],
    );
    await destination.runAsync(
      `INSERT INTO import_session_rows
        (uid,session_id,external_contact_id,source_payload,created_at,modified_at)
       VALUES (?,?,?,?,?,?)`,
      ["local-row", session.lastInsertRowId, "lookup", "{}", NOW, NOW],
    );

    await expect(applyRestore(destination, manifest, "replace-all")).resolves.toMatchObject({
      status: "applied",
    });
    await expect(
      destination.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM import_sessions",
      ),
    ).resolves.toEqual({ count: 0 });
    await expect(
      destination.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM import_session_rows",
      ),
    ).resolves.toEqual({ count: 0 });
  });

  it("stages only a winning incoming photo, journals it in the transaction, and reports a retryable finalize failure", async () => {
    const source = await db();
    await source.runAsync(
      `INSERT INTO contacts (uid,name,photo,interval_days,rarely_responds,reminders_off,created_at,modified_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      ["photo-contact", "Photo", "avatars/source.jpg", 14, 0, 0, NOW, "2026-08-25 12:01:00"],
    );
    const manifest = await buildExportManifest(source, { exportedAt: NOW, readPhotoBase64: async () => "YQ==" });
    const destination = await db();
    const result = await applyRestore(destination, manifest, "merge", {
      sessionToken: "session", persistPhoto: async () => { throw new Error("disk unavailable"); },
    });
    expect(result).toMatchObject({ status: "applied", photosNeedingAttention: 1 });
    expect(photoMocks.staged).toEqual([["YQ==", "avatars/_restore_pending/contact-photo-contact-session.jpg"]]);
    await expect(destination.getFirstAsync<{ action: string }>("SELECT action FROM restore_photo_journal")).resolves.toEqual({ action: "finalize" });
    await expect(destination.getFirstAsync<{ photo: string }>("SELECT photo FROM contacts WHERE uid=?", ["photo-contact"])).resolves.toEqual({ photo: "avatars/contact-1.jpg" });
  });

  it("never stages or journals a losing incoming photo over a newer local master", async () => {
    const source = await db();
    await source.runAsync(
      `INSERT INTO contacts (uid,name,photo,interval_days,rarely_responds,reminders_off,created_at,modified_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      ["same", "Older", "avatars/source.jpg", 14, 0, 0, NOW, NOW],
    );
    const manifest = await buildExportManifest(source, { exportedAt: NOW, readPhotoBase64: async () => "YQ==" });
    const destination = await db();
    await destination.runAsync(
      `INSERT INTO contacts (uid,name,photo,interval_days,rarely_responds,reminders_off,created_at,modified_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      ["same", "Newer", "avatars/local.jpg", 14, 0, 0, NOW, "2026-08-25 12:02:00"],
    );
    await expect(applyRestore(destination, manifest, "merge")).resolves.toMatchObject({ status: "applied" });
    expect(photoMocks.staged).toEqual([]);
    await expect(destination.getAllAsync("SELECT * FROM restore_photo_journal")).resolves.toEqual([]);
  });

  it("blocks a configured Replace-all until its forced verified safety snapshot succeeds", async () => {
    const source = await db();
    const manifest = await buildExportManifest(source, { exportedAt: NOW, readPhotoBase64: async () => "" });
    const destination = await db();
    await destination.runAsync("UPDATE app_settings SET backup_folder_uri=? WHERE id=1", ["content://configured"]);
    await expect(applyRestore(destination, manifest, "replace-all")).resolves.toEqual({ status: "pre-restore-snapshot-failed" });
    await expect(destination.getFirstAsync<{ count: number }>("SELECT count(*) AS count FROM contacts")).resolves.toEqual({ count: 0 });
    const snapshot = vi.fn(async () => ({ status: "written" as const }));
    await expect(applyRestore(destination, manifest, "replace-all", { createVerifiedPreRestoreSnapshot: snapshot })).resolves.toMatchObject({ status: "applied", preRestoreSnapshotCreated: true });
    expect(snapshot).toHaveBeenCalledTimes(1);
  });

  it("commits restore while exposing schedule resync failures for the launch sweep to heal", async () => {
    const source = await db();
    await source.runAsync(
      `INSERT INTO contacts (uid,name,interval_days,rarely_responds,reminders_off,created_at,modified_at)
       VALUES (?,?,?,?,?,?,?)`,
      ["schedule-contact", "Schedule", 14, 0, 0, NOW, "2026-08-25 12:01:00"],
    );
    const manifest = await buildExportManifest(source, { exportedAt: NOW, readPhotoBase64: async () => "" });
    const destination = await db();
    const result = await applyRestore(destination, manifest, "merge", {
      reconcileNotificationSchedule: async () => { throw new Error("notification unavailable"); },
      reconcileDigestSchedule: async () => { throw new Error("digest unavailable"); },
    });
    expect(result).toMatchObject({ status: "applied", scheduleResyncPending: true });
    await expect(destination.getFirstAsync<{ uid: string }>("SELECT uid FROM contacts WHERE uid=?", ["schedule-contact"])).resolves.toEqual({ uid: "schedule-contact" });
  });

  it("round-trips normalized method metadata without scalar contact columns", async () => {
    const source = await db();
    await source.runAsync(
      "INSERT INTO contacts (uid,name,interval_days,rarely_responds,reminders_off,created_at,modified_at) VALUES (?,?,?,?,?,?,?)",
      ["method-contact", "Method", 14, 0, 0, NOW, "2026-08-25 12:01:00"],
    );
    const contact = await source.getFirstAsync<{ id: number }>("SELECT id FROM contacts WHERE uid=?", ["method-contact"]);
    await source.runAsync(
      "INSERT INTO contact_methods (uid,contact_id,method_type,raw_value,display_value,canonical_value,canonical_region,label,extension,is_actionable,is_primary,display_order,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      ["method-a", contact!.id, "phone", "+15550100", "+15550100", "+15550100", "US", "Mobile", "42", 1, 1, 0, NOW, "2026-08-25 12:01:00"],
    );
    const manifest = await buildExportManifest(source, { exportedAt: NOW, readPhotoBase64: async () => "" });
    const destination = await db();

    await expect(applyRestore(destination, manifest, "replace-all")).resolves.toMatchObject({ status: "applied" });
    await expect(destination.getFirstAsync<{ canonical_region: string; label: string; extension: string }>(
      "SELECT canonical_region,label,extension FROM contact_methods WHERE uid=?", ["method-a"],
    )).resolves.toEqual({ canonical_region: "US", label: "Mobile", extension: "42" });
  });

  it("demotes a retained primary before inserting a lexically earlier replacement primary", async () => {
    const source = await db();
    const destination = await db();
    for (const exec of [source, destination]) {
      await exec.runAsync("INSERT INTO contacts (uid,name,interval_days,rarely_responds,reminders_off,created_at,modified_at) VALUES (?,?,?,?,?,?,?)", ["shared-contact", "Shared", 14, 0, 0, NOW, "2026-08-25 12:00:00"]);
    }
    const sourceContact = await source.getFirstAsync<{ id: number }>("SELECT id FROM contacts WHERE uid=?", ["shared-contact"]);
    const destinationContact = await destination.getFirstAsync<{ id: number }>("SELECT id FROM contacts WHERE uid=?", ["shared-contact"]);
    await source.runAsync("INSERT INTO contact_methods (uid,contact_id,method_type,raw_value,display_value,is_actionable,is_primary,display_order,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?,?,?)", ["a-promoted", sourceContact!.id, "phone", "new", "new", 1, 1, 0, NOW, "2026-08-25 12:01:00"]);
    await destination.runAsync("INSERT INTO contact_methods (uid,contact_id,method_type,raw_value,display_value,is_actionable,is_primary,display_order,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?,?,?)", ["z-retained", destinationContact!.id, "phone", "old", "old", 1, 1, 0, NOW, NOW]);
    const manifest = await buildExportManifest(source, { exportedAt: NOW, readPhotoBase64: async () => "" });

    await expect(applyRestore(destination, manifest, "merge")).resolves.toMatchObject({ status: "applied" });
    await expect(destination.getAllAsync<{ uid: string; is_primary: number }>("SELECT uid,is_primary FROM contact_methods ORDER BY uid")).resolves.toEqual([
      { uid: "a-promoted", is_primary: 1 }, { uid: "z-retained", is_primary: 0 },
    ]);
  });

  it("removes a normalized method only when an explicit newer tombstone says so", async () => {
    const source = await db();
    const destination = await db();
    for (const exec of [source, destination]) {
      await exec.runAsync("INSERT INTO contacts (uid,name,interval_days,rarely_responds,reminders_off,created_at,modified_at) VALUES (?,?,?,?,?,?,?)", ["tombstone-contact", "Tombstone", 14, 0, 0, NOW, NOW]);
      const contact = await exec.getFirstAsync<{ id: number }>("SELECT id FROM contacts WHERE uid=?", ["tombstone-contact"]);
      await exec.runAsync("INSERT INTO contact_methods (uid,contact_id,method_type,raw_value,display_value,is_actionable,is_primary,display_order,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?,?,?)", ["tombstone-method", contact!.id, "email", "a@example.test", "a@example.test", 1, 1, 0, NOW, NOW]);
    }
    const manifest = await buildExportManifest(source, { exportedAt: NOW, readPhotoBase64: async () => "" });
    manifest.contactMethods = [];
    manifest.tombstones = [{ entityType: "contact_method", entityUid: "tombstone-method", deletedAt: "2026-08-25 12:01:00" }];

    await expect(applyRestore(destination, manifest, "merge")).resolves.toMatchObject({ status: "applied", deleted: 1 });
    await expect(destination.getFirstAsync("SELECT uid FROM contact_methods WHERE uid=?", ["tombstone-method"])).resolves.toBeNull();
  });

  it("round-trips the portable phone region override through export and restore", async () => {
    const source = await db();
    await source.runAsync("UPDATE app_settings SET phone_region_override=?, modified_at=? WHERE id=1", ["GB", "2026-08-25 12:01:00"]);
    const manifest = await buildExportManifest(source, { exportedAt: NOW, readPhotoBase64: async () => "" });
    expect(manifest.appSettings).toMatchObject({ phoneRegionOverride: "GB" });
    const destination = await db();
    await expect(applyRestore(destination, manifest, "merge")).resolves.toMatchObject({ status: "applied" });
    await expect(destination.getFirstAsync<{ phone_region_override: string }>("SELECT phone_region_override FROM app_settings WHERE id=1")).resolves.toEqual({ phone_region_override: "GB" });
  });
});
