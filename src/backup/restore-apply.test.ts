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
import { parseBackupManifest } from "@/backup/backup-schema";
import { applyRestore } from "@/backup/restore-apply";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { deleteMemory, purgeMemoryPermanently } from "@/db/memories-dao";
import {
  deleteRelationship,
  purgeRelationshipPermanently,
} from "@/db/relationships-dao";
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
import { migration017 } from "@/db/migrations/017-knowledge-egress-datamove";
import { migration018 } from "@/db/migrations/018-custom-field-scope-history";
import { migration019 } from "@/db/migrations/019-dashboard-prefs";
import { migration020 } from "@/db/migrations/020-dashboard-swipe-pref";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-25 12:00:00";
let uid = 0;
const newUid = () => `uid-${++uid}`;
const migrations = [migration001, migration002, migration003, migration004, migration005, migration006, migration007, migration008, migration009, migration010, migration011, migration012, migration013, migration014, migration015, migration016, migration017, migration018, migration019, migration020];

async function db(): Promise<SqlExecutor> {
  const exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, migrations, 20, { now: NOW, newUid });
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
  it("allows a newer merged knowledge row to be permanently deleted after its older tombstone survives", async () => {
    const source = await db();
    const destination = await db();
    for (const exec of [source, destination]) {
      await exec.runAsync(
        "INSERT INTO contacts (uid,name,interval_days,rarely_responds,reminders_off,created_at,modified_at) VALUES (?,?,?,?,?,?,?)",
        ["revived-knowledge-contact", "Knowledge", 14, 0, 0, NOW, NOW],
      );
    }
    const sourceContact = await source.getFirstAsync<{ id: number }>(
      "SELECT id FROM contacts WHERE uid=?",
      ["revived-knowledge-contact"],
    );
    const destinationContact = await destination.getFirstAsync<{ id: number }>(
      "SELECT id FROM contacts WHERE uid=?",
      ["revived-knowledge-contact"],
    );
    await source.runAsync(
      "INSERT INTO memories (uid,contact_id,type,value,pinned,outdated,provenance,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?,?)",
      ["revived-memory", sourceContact!.id, "general", "Revived", 0, 0, "user", NOW, "2026-08-26 12:00:00"],
    );
    await source.runAsync(
      "INSERT INTO relationships (uid,contact_id,person_name,pinned,created_at,modified_at) VALUES (?,?,?,?,?,?)",
      ["revived-relationship", sourceContact!.id, "Revived", 0, NOW, "2026-08-26 12:00:00"],
    );
    for (const [entityType, entityUid] of [
      ["memory", "revived-memory"],
      ["relationship", "revived-relationship"],
    ]) {
      await destination.runAsync(
        "INSERT INTO tombstones (entity_type,entity_uid,deleted_at) VALUES (?,?,?)",
        [entityType, entityUid, NOW],
      );
    }

    const manifest = await buildExportManifest(source, {
      exportedAt: NOW,
      readPhotoBase64: async () => "",
    });
    await expect(applyRestore(destination, manifest, "merge")).resolves.toMatchObject({
      status: "applied",
    });

    const memory = await destination.getFirstAsync<{ id: number }>(
      "SELECT id FROM memories WHERE uid=?",
      ["revived-memory"],
    );
    const relationship = await destination.getFirstAsync<{ id: number }>(
      "SELECT id FROM relationships WHERE uid=?",
      ["revived-relationship"],
    );
    const deletedAt = "2026-08-27 12:00:00";
    await deleteMemory(destination, {
      id: memory!.id,
      contactId: destinationContact!.id,
      now: deletedAt,
    });
    await purgeMemoryPermanently(destination, {
      id: memory!.id,
      contactId: destinationContact!.id,
    });
    await deleteRelationship(destination, {
      id: relationship!.id,
      contactId: destinationContact!.id,
      now: deletedAt,
    });
    await purgeRelationshipPermanently(destination, {
      id: relationship!.id,
      contactId: destinationContact!.id,
    });

    await expect(
      destination.getAllAsync<{ entity_type: string; entity_uid: string; deleted_at: string }>(
        "SELECT entity_type,entity_uid,deleted_at FROM tombstones WHERE entity_uid IN (?,?) ORDER BY entity_type",
        ["revived-memory", "revived-relationship"],
      ),
    ).resolves.toEqual([
      { entity_type: "memory", entity_uid: "revived-memory", deleted_at: deletedAt },
      {
        entity_type: "relationship",
        entity_uid: "revived-relationship",
        deleted_at: deletedAt,
      },
    ]);
  });

  it("round-trips live and deleted knowledge, linked people, and current/history state", async () => {
    const source = await db();
    const owner = await source.runAsync("INSERT INTO contacts (uid,name,interval_days,rarely_responds,reminders_off,created_at,modified_at) VALUES (?,?,?,?,?,?,?)", ["knowledge-owner", "Owner", 14, 0, 0, NOW, NOW]);
    const linked = await source.runAsync("INSERT INTO contacts (uid,name,interval_days,rarely_responds,reminders_off,created_at,modified_at) VALUES (?,?,?,?,?,?,?)", ["knowledge-linked", "Linked", 14, 0, 0, NOW, NOW]);
    await source.runAsync("INSERT INTO memories (uid,contact_id,type,custom_label,value,pinned,outdated,provenance,created_at,modified_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)", ["memory-live", owner.lastInsertRowId, "custom", "Note", "Live", 1, 0, "user", NOW, NOW, null]);
    await source.runAsync("INSERT INTO memories (uid,contact_id,type,custom_label,value,pinned,outdated,provenance,created_at,modified_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)", ["memory-deleted", owner.lastInsertRowId, "custom", "Note", "Deleted", 0, 0, "user", NOW, NOW, "2026-08-26 12:00:00"]);
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
    const oldContact = await destination.runAsync(
      `INSERT INTO contacts (uid,name,interval_days,rarely_responds,reminders_off,created_at,modified_at)
       VALUES (?,?,?,?,?,?,?)`,
      ["old-local", "Old", 30, 0, 0, NOW, NOW],
    );
    await destination.runAsync(
      "INSERT INTO memories (uid,contact_id,type,value,pinned,outdated,provenance,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?,?)",
      ["old-memory", oldContact.lastInsertRowId, "general", "Old memory", 0, 0, "user", NOW, NOW],
    );
    await destination.runAsync(
      "INSERT INTO relationships (uid,contact_id,person_name,pinned,created_at,modified_at) VALUES (?,?,?,?,?,?)",
      ["old-relationship", oldContact.lastInsertRowId, "Old relationship", 0, NOW, NOW],
    );
    await destination.runAsync(
      "INSERT INTO current_state_entries (uid,contact_id,field_key,value,is_current,created_at,modified_at) VALUES (?,?,?,?,?,?,?)",
      ["old-current-state", oldContact.lastInsertRowId, "current_location", "Old location", 1, NOW, NOW],
    );

    await expect(applyRestore(destination, manifest, "replace-all")).resolves.toMatchObject({ status: "applied", mode: "replace-all" });
    await expect(destination.getAllAsync<{ uid: string }>("SELECT uid FROM contacts ORDER BY uid")).resolves.toEqual([{ uid: "replacement" }]);
    await expect(destination.getFirstAsync<{ entity_uid: string }>(
      "SELECT entity_uid FROM tombstones WHERE entity_type = 'contact' AND entity_uid = 'old-local'",
    )).resolves.toEqual({ entity_uid: "old-local" });
    await expect(destination.getAllAsync<{ entity_type: string; entity_uid: string }>(
      "SELECT entity_type,entity_uid FROM tombstones WHERE entity_type IN ('memory','relationship','current_state_entry') ORDER BY entity_type",
    )).resolves.toEqual([
      { entity_type: "current_state_entry", entity_uid: "old-current-state" },
      { entity_type: "memory", entity_uid: "old-memory" },
      { entity_type: "relationship", entity_uid: "old-relationship" },
    ]);
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

  it("removes Memory and relationship rows when a newer tombstone says so", async () => {
    const source = await db();
    const destination = await db();
    for (const exec of [source, destination]) {
      const contact = await exec.runAsync(
        "INSERT INTO contacts (uid,name,interval_days,rarely_responds,reminders_off,created_at,modified_at) VALUES (?,?,?,?,?,?,?)",
        ["knowledge-tombstone-contact", "Knowledge", 14, 0, 0, NOW, NOW],
      );
      if (exec === destination) {
        await exec.runAsync(
          "INSERT INTO memories (uid,contact_id,type,value,pinned,outdated,provenance,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?,?)",
          ["tombstone-memory", contact.lastInsertRowId, "general", "Delete me", 0, 0, "user", NOW, NOW],
        );
        await exec.runAsync(
          "INSERT INTO relationships (uid,contact_id,person_name,pinned,created_at,modified_at) VALUES (?,?,?,?,?,?)",
          ["tombstone-relationship", contact.lastInsertRowId, "Delete me", 0, NOW, NOW],
        );
      }
    }
    const manifest = await buildExportManifest(source, { exportedAt: NOW, readPhotoBase64: async () => "" });
    manifest.tombstones = [
      { entityType: "memory", entityUid: "tombstone-memory", deletedAt: "2026-08-25 12:01:00" },
      { entityType: "relationship", entityUid: "tombstone-relationship", deletedAt: "2026-08-25 12:01:00" },
    ];

    await expect(applyRestore(destination, manifest, "merge")).resolves.toMatchObject({ status: "applied", deleted: 2 });
    await expect(destination.getAllAsync("SELECT uid FROM memories WHERE uid='tombstone-memory'")).resolves.toEqual([]);
    await expect(destination.getAllAsync("SELECT uid FROM relationships WHERE uid='tombstone-relationship'")).resolves.toEqual([]);
  });

  it("requires full contact×def pairs only for global-scope defs, exempting contact-scoped defs", async () => {
    const globalSource = await db();
    for (const name of ["pair-c1", "pair-c2"]) {
      await globalSource.runAsync("INSERT INTO contacts (uid,name,interval_days,rarely_responds,reminders_off,created_at,modified_at) VALUES (?,?,?,?,?,?,?)", [name, name, 14, 0, 0, NOW, NOW]);
    }
    const c1 = await globalSource.getFirstAsync<{ id: number }>("SELECT id FROM contacts WHERE uid=?", ["pair-c1"]);
    await globalSource.runAsync("INSERT INTO custom_field_defs (uid,col_name,label,type,show_on_new,always_show,display_order,share_with_ai,scope,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)", ["global-def", "nickname", "Nickname", "text", 0, 0, 0, 0, "global", NOW, NOW]);
    const gdef = await globalSource.getFirstAsync<{ id: number }>("SELECT id FROM custom_field_defs WHERE uid=?", ["global-def"]);
    await globalSource.runAsync("INSERT INTO custom_field_values (uid,contact_id,field_def_id,value,created_at,modified_at) VALUES (?,?,?,?,?,?)", ["gval-1", c1!.id, gdef!.id, "Ada", NOW, NOW]);
    const globalManifest = await buildExportManifest(globalSource, { exportedAt: NOW, readPhotoBase64: async () => "" });
    // A global def with only one of two contacts' pairs is still rejected.
    await expect(applyRestore(await db(), globalManifest, "merge")).rejects.toThrow(/missing a normalized custom-field value pair/);

    const scopedSource = await db();
    for (const name of ["scoped-c1", "scoped-c2"]) {
      await scopedSource.runAsync("INSERT INTO contacts (uid,name,interval_days,rarely_responds,reminders_off,created_at,modified_at) VALUES (?,?,?,?,?,?,?)", [name, name, 14, 0, 0, NOW, NOW]);
    }
    const s1 = await scopedSource.getFirstAsync<{ id: number }>("SELECT id FROM contacts WHERE uid=?", ["scoped-c1"]);
    await scopedSource.runAsync("INSERT INTO custom_field_defs (uid,col_name,label,type,show_on_new,always_show,display_order,share_with_ai,scope,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)", ["scoped-def", "fav_colour", "Favourite colour", "text", 0, 0, 0, 0, "contact", NOW, NOW]);
    const sdef = await scopedSource.getFirstAsync<{ id: number }>("SELECT id FROM custom_field_defs WHERE uid=?", ["scoped-def"]);
    await scopedSource.runAsync("INSERT INTO custom_field_values (uid,contact_id,field_def_id,value,created_at,modified_at) VALUES (?,?,?,?,?,?)", ["sval-1", s1!.id, sdef!.id, "Choice", NOW, NOW]);
    const scopedManifest = await buildExportManifest(scopedSource, { exportedAt: NOW, readPhotoBase64: async () => "" });
    // A contact-scoped def legitimately owns only its owner's pair and is exempt.
    const scopedDest = await db();
    await expect(applyRestore(scopedDest, scopedManifest, "merge")).resolves.toMatchObject({ status: "applied" });
    await expect(scopedDest.getFirstAsync<{ uid: string; scope: string }>("SELECT uid,scope FROM custom_field_defs WHERE uid=?", ["scoped-def"])).resolves.toEqual({ uid: "scoped-def", scope: "contact" });
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

  it("round-trips allow_ai, scoped/history/group defs, value history, soft-deletes, and a history tombstone in merge", async () => {
    const source = await db();
    const owner = await source.runAsync("INSERT INTO contacts (uid,name,interval_days,rarely_responds,reminders_off,created_at,modified_at) VALUES (?,?,?,?,?,?,?)", ["know-owner", "Owner", 14, 0, 0, NOW, NOW]);
    const ownerId = owner.lastInsertRowId;
    // (a) memories: allow_ai ON; imported-type (allow_ai OFF, KNOW-14 provenance); soft-deleted.
    await source.runAsync("INSERT INTO memories (uid,contact_id,type,value,pinned,outdated,provenance,allow_ai,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?,?,?)", ["mem-allow", ownerId, "general", "Shared fact", 0, 0, "user", 1, NOW, NOW]);
    await source.runAsync("INSERT INTO memories (uid,contact_id,type,value,pinned,outdated,provenance,allow_ai,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?,?,?)", ["mem-imported", ownerId, "imported", "From contacts app", 0, 0, "import", 0, NOW, NOW]);
    await source.runAsync("INSERT INTO memories (uid,contact_id,type,custom_label,value,pinned,outdated,provenance,allow_ai,created_at,modified_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", ["mem-deleted", ownerId, "custom", "Note", "Deleted", 0, 0, "user", 0, NOW, NOW, "2026-08-26 12:00:00"]);
    // (b) a GLOBAL def and a per-contact scoped def with history + group.
    await source.runAsync("INSERT INTO custom_field_defs (uid,col_name,label,type,show_on_new,always_show,display_order,share_with_ai,scope,history_retained,field_group,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", ["g-def", "nickname", "Nickname", "text", 0, 0, 0, 0, "global", 0, null, NOW, NOW]);
    await source.runAsync("INSERT INTO custom_field_defs (uid,col_name,label,type,show_on_new,always_show,display_order,share_with_ai,scope,history_retained,field_group,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", ["s-def", "fav_colour", "Favourite colour", "text", 0, 0, 0, 0, "contact", 1, "Personal", NOW, NOW]);
    const gDef = await source.getFirstAsync<{ id: number }>("SELECT id FROM custom_field_defs WHERE uid=?", ["g-def"]);
    const sDef = await source.getFirstAsync<{ id: number }>("SELECT id FROM custom_field_defs WHERE uid=?", ["s-def"]);
    await source.runAsync("INSERT INTO custom_field_values (uid,contact_id,field_def_id,value,created_at,modified_at) VALUES (?,?,?,?,?,?)", ["g-val", ownerId, gDef!.id, "Ace", NOW, NOW]);
    await source.runAsync("INSERT INTO custom_field_values (uid,contact_id,field_def_id,value,created_at,modified_at) VALUES (?,?,?,?,?,?)", ["s-val", ownerId, sDef!.id, "Current", NOW, NOW]);
    // (c) two value-history rows on the history-retained scoped def.
    await source.runAsync("INSERT INTO custom_field_value_history (uid,contact_id,field_def_id,value,created_at) VALUES (?,?,?,?,?)", ["hist-1", ownerId, sDef!.id, "Older", NOW]);
    await source.runAsync("INSERT INTO custom_field_value_history (uid,contact_id,field_def_id,value,created_at) VALUES (?,?,?,?,?)", ["hist-2", ownerId, sDef!.id, "Oldest", "2026-08-24 12:00:00"]);
    // (d) a value-history tombstone that must survive export→restore.
    await source.runAsync("INSERT INTO tombstones (entity_type,entity_uid,deleted_at) VALUES (?,?,?)", ["custom_field_value_history", "hist-ghost", NOW]);

    const manifest = await buildExportManifest(source, { exportedAt: NOW, readPhotoBase64: async () => "" });
    const destination = await db();
    await expect(applyRestore(destination, manifest, "merge")).resolves.toMatchObject({ status: "applied" });

    await expect(destination.getAllAsync<{ uid: string; allow_ai: number; deleted_at: string | null }>("SELECT uid,allow_ai,deleted_at FROM memories ORDER BY uid")).resolves.toEqual([
      { uid: "mem-allow", allow_ai: 1, deleted_at: null },
      { uid: "mem-deleted", allow_ai: 0, deleted_at: "2026-08-26 12:00:00" },
      { uid: "mem-imported", allow_ai: 0, deleted_at: null },
    ]);
    await expect(destination.getFirstAsync<{ type: string }>("SELECT type FROM memories WHERE uid=?", ["mem-imported"])).resolves.toEqual({ type: "imported" });
    await expect(destination.getAllAsync<{ uid: string; scope: string; history_retained: number; field_group: string | null }>("SELECT uid,scope,history_retained,field_group FROM custom_field_defs ORDER BY uid")).resolves.toEqual([
      { uid: "g-def", scope: "global", history_retained: 0, field_group: null },
      { uid: "s-def", scope: "contact", history_retained: 1, field_group: "Personal" },
    ]);
    await expect(destination.getAllAsync<{ uid: string; value: string }>("SELECT uid,value FROM custom_field_value_history ORDER BY uid")).resolves.toEqual([
      { uid: "hist-1", value: "Older" },
      { uid: "hist-2", value: "Oldest" },
    ]);
    await expect(destination.getFirstAsync<{ entity_uid: string }>("SELECT entity_uid FROM tombstones WHERE entity_type='custom_field_value_history' AND entity_uid='hist-ghost'")).resolves.toEqual({ entity_uid: "hist-ghost" });
  });

  it("clears destination-only value history on replace-all before writing the manifest's rows", async () => {
    const source = await db();
    const owner = await source.runAsync("INSERT INTO contacts (uid,name,interval_days,rarely_responds,reminders_off,created_at,modified_at) VALUES (?,?,?,?,?,?,?)", ["ra-owner", "Owner", 14, 0, 0, NOW, NOW]);
    await source.runAsync("INSERT INTO custom_field_defs (uid,col_name,label,type,show_on_new,always_show,display_order,share_with_ai,scope,history_retained,field_group,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", ["ra-def", "nickname", "Nickname", "text", 0, 0, 0, 0, "contact", 1, "Grp", NOW, NOW]);
    const raDef = await source.getFirstAsync<{ id: number }>("SELECT id FROM custom_field_defs WHERE uid=?", ["ra-def"]);
    await source.runAsync("INSERT INTO custom_field_values (uid,contact_id,field_def_id,value,created_at,modified_at) VALUES (?,?,?,?,?,?)", ["ra-val", owner.lastInsertRowId, raDef!.id, "Now", NOW, NOW]);
    await source.runAsync("INSERT INTO custom_field_value_history (uid,contact_id,field_def_id,value,created_at) VALUES (?,?,?,?,?)", ["ra-hist", owner.lastInsertRowId, raDef!.id, "Then", NOW]);
    const manifest = await buildExportManifest(source, { exportedAt: NOW, readPhotoBase64: async () => "" });

    const destination = await db();
    const destContact = await destination.runAsync("INSERT INTO contacts (uid,name,interval_days,rarely_responds,reminders_off,created_at,modified_at) VALUES (?,?,?,?,?,?,?)", ["dest-owner", "Dest", 14, 0, 0, NOW, NOW]);
    await destination.runAsync("INSERT INTO custom_field_defs (uid,col_name,label,type,show_on_new,always_show,display_order,share_with_ai,scope,history_retained,field_group,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", ["dest-def", "x", "X", "text", 0, 0, 0, 0, "contact", 1, null, NOW, NOW]);
    const destDef = await destination.getFirstAsync<{ id: number }>("SELECT id FROM custom_field_defs WHERE uid=?", ["dest-def"]);
    await destination.runAsync("INSERT INTO custom_field_value_history (uid,contact_id,field_def_id,value,created_at) VALUES (?,?,?,?,?)", ["dest-hist", destContact.lastInsertRowId, destDef!.id, "Stale", NOW]);

    await expect(applyRestore(destination, manifest, "replace-all")).resolves.toMatchObject({ status: "applied", mode: "replace-all" });
    await expect(destination.getAllAsync<{ uid: string }>("SELECT uid FROM custom_field_value_history ORDER BY uid")).resolves.toEqual([{ uid: "ra-hist" }]);
  });

  it("parses a pre-phase format-4 backup end-to-end and restores defaulted knowledge columns (P07-MED)", async () => {
    const source = await db();
    const owner = await source.runAsync("INSERT INTO contacts (uid,name,interval_days,rarely_responds,reminders_off,created_at,modified_at) VALUES (?,?,?,?,?,?,?)", ["old-owner", "Owner", 14, 0, 0, NOW, NOW]);
    await source.runAsync("INSERT INTO memories (uid,contact_id,type,value,pinned,outdated,provenance,allow_ai,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?,?,?)", ["old-mem", owner.lastInsertRowId, "general", "Fact", 0, 0, "user", 1, NOW, NOW]);
    await source.runAsync("INSERT INTO custom_field_defs (uid,col_name,label,type,show_on_new,always_show,display_order,share_with_ai,scope,history_retained,field_group,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", ["old-def", "nickname", "Nickname", "text", 0, 0, 0, 0, "global", 1, "Grp", NOW, NOW]);
    const oldDef = await source.getFirstAsync<{ id: number }>("SELECT id FROM custom_field_defs WHERE uid=?", ["old-def"]);
    await source.runAsync("INSERT INTO custom_field_values (uid,contact_id,field_def_id,value,created_at,modified_at) VALUES (?,?,?,?,?,?)", ["old-val", owner.lastInsertRowId, oldDef!.id, "Ace", NOW, NOW]);
    const manifest = await buildExportManifest(source, { exportedAt: NOW, readPhotoBase64: async () => "" });

    // Simulate a LIVE format-4 backup object written BEFORE this phase: no
    // customFieldValueHistory top-level array, and no new per-row columns.
    const older = JSON.parse(JSON.stringify(manifest)) as Record<string, any>;
    delete older.customFieldValueHistory;
    for (const def of older.customFieldDefs) { delete def.scope; delete def.historyRetained; delete def.fieldGroup; }
    for (const mem of older.memories) delete mem.allowAi;

    const parsed = parseBackupManifest(older);
    expect(parsed.customFieldValueHistory).toEqual([]);

    const destination = await db();
    await expect(applyRestore(destination, parsed, "replace-all")).resolves.toMatchObject({ status: "applied" });
    await expect(destination.getFirstAsync<{ allow_ai: number }>("SELECT allow_ai FROM memories WHERE uid=?", ["old-mem"])).resolves.toEqual({ allow_ai: 0 });
    await expect(destination.getFirstAsync<{ scope: string; history_retained: number; field_group: string | null }>("SELECT scope,history_retained,field_group FROM custom_field_defs WHERE uid=?", ["old-def"])).resolves.toEqual({ scope: "global", history_retained: 0, field_group: null });
    await expect(destination.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM custom_field_value_history")).resolves.toEqual({ n: 0 });
  });
});
