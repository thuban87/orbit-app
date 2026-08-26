import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));
// The composed database/export/restore regression injects filesystem effects;
// native photo-storage behavior remains covered by its own real-FS adapter suite.
vi.mock("@/services/photos/photo-storage", () => ({
  contactPhotoRelPath: (id: number) => `avatars/contact-${id}.jpg`,
  customFieldPhotoRelPath: (id: number, colName: string) => `avatars/cv-${id}-${colName}.jpg`,
  profilePhotoRelPath: () => "avatars/profile.jpg",
  deletePhoto: () => {}, deleteRestorePending: () => {}, photoFileExists: () => false,
  persistMaster: async () => {}, resolveRestorePendingUri: (path: string) => `file:///doc/${path}`,
  restorePendingRelPath: (target: { kind: string; uid?: string }, session: string) => `avatars/_restore_pending/${target.kind}-${target.uid ?? "profile"}-${session}.jpg`,
  stageRestorePendingBase64: async () => {},
}));
vi.mock("@/services/notifications/notification-schedule", () => ({ reconcileSchedule: async () => {} }));
vi.mock("@/services/notifications/digest-schedule", () => ({ reconcileDigestSchedule: async () => {} }));

import { buildExportManifest } from "@/backup/export-manifest";
import { applyRestore } from "@/backup/restore-apply";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-25 12:00:00";
const PHOTO = Buffer.alloc(180 * 1024, 7).toString("base64");

function uidFactory() {
  let number = 0;
  return () => `phase17-${++number}`;
}

async function migrated(version = TARGET_VERSION): Promise<SqlExecutor> {
  const exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, version, { now: NOW, newUid: uidFactory() });
  return exec;
}

async function populateV6(exec: SqlExecutor): Promise<void> {
  const categories = [
    ["family-category", "Family", 20],
    ["work-category", "Work", 21],
  ] as const;
  for (const [uid, name, displayOrder] of categories) {
    await exec.runAsync(
      "INSERT INTO categories (uid,name,display_order,created_at,modified_at) VALUES (?,?,?,?,?)",
      [uid, name, displayOrder, NOW, NOW],
    );
  }
  const family = await exec.getFirstAsync<{ id: number }>("SELECT id FROM categories WHERE uid=?", ["family-category"]);
  const work = await exec.getFirstAsync<{ id: number }>("SELECT id FROM categories WHERE uid=?", ["work-category"]);
  await exec.runAsync("UPDATE profile SET name=?, photo=?, modified_at=? WHERE id=1", ["Portable Self", "avatars/profile.jpg", NOW]);
  for (const [uid, name, categoryId] of [["ada", "Ada", family!.id], ["bea", "Bea", work!.id]] as const) {
    await exec.runAsync(
      "INSERT INTO contacts (uid,name,category_id,interval_days,photo,created_at,modified_at) VALUES (?,?,?,?,?,?,?)",
      [uid, name, categoryId, 7, `avatars/${uid}.jpg`, NOW, NOW],
    );
  }
  const ada = await exec.getFirstAsync<{ id: number }>("SELECT id FROM contacts WHERE uid=?", ["ada"]);
  await exec.runAsync("UPDATE app_settings SET sun_contact_id=?, notifications_enabled=0, delivery_hour=10, modified_at=? WHERE id=1", [ada!.id, NOW]);
  await exec.runAsync(
    "INSERT INTO custom_field_defs (uid,col_name,label,type,options,show_on_new,always_show,display_order,share_with_ai,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    ["nickname-def", "nickname", "Nickname", "text", null, 0, 0, 30, 0, NOW, NOW],
  );
  await exec.runAsync(
    "INSERT INTO custom_field_defs (uid,col_name,label,type,options,show_on_new,always_show,display_order,share_with_ai,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    ["portrait-def", "portrait", "Portrait", "photo", null, 0, 0, 31, 0, NOW, NOW],
  );
  const contacts = await exec.getAllAsync<{ id: number; uid: string }>("SELECT id,uid FROM contacts WHERE uid IN ('ada','bea')");
  const defs = await exec.getAllAsync<{ id: number; uid: string }>("SELECT id,uid FROM custom_field_defs WHERE uid IN ('nickname-def','portrait-def')");
  for (const contact of contacts) for (const def of defs) {
    const value = def.uid === "nickname-def" ? (contact.uid === "ada" ? "Ace" : null) : `avatars/${contact.uid}-portrait.jpg`;
    await exec.runAsync(
      "INSERT INTO custom_field_values (uid,contact_id,field_def_id,value,created_at,modified_at) VALUES (?,?,?,?,?,?)",
      [`${contact.uid}-${def.uid}-value`, contact.id, def.id, value, NOW, NOW],
    );
  }
  await exec.runAsync("INSERT INTO interactions (uid,contact_id,occurred_at,recorded_at,channel,connected,source,modified_at) VALUES (?,?,?,?,?,?,?,?)", ["interaction-a", ada!.id, NOW, NOW, "in_person", 1, "manual", NOW]);
  await exec.runAsync("INSERT INTO fuel (uid,contact_id,kind,label,created_at,source,modified_at) VALUES (?,?,?,?,?,?,?)", ["fuel-a", ada!.id, "article", "Read", NOW, "manual", NOW]);
  await exec.runAsync("INSERT INTO contact_links (uid,contact_id,url,label,display_order,created_at,modified_at) VALUES (?,?,?,?,?,?,?)", ["link-a", ada!.id, "https://example.test", "Example", 0, NOW, NOW]);
}

describe("Phase 17 composed backup regressions", () => {
  it("migrates a populated v6 database through the registered current target and round-trips it by Merge and Replace-all", async () => {
    const source = await migrated(6);
    await populateV6(source);
    await runMigrations(source, MIGRATIONS, TARGET_VERSION, { now: NOW, newUid: uidFactory() });
    await source.runAsync("INSERT INTO tombstones (entity_type,entity_uid,deleted_at) VALUES (?,?,?)", ["contact_link", "prior-hard-delete", NOW]);
    const manifest = await buildExportManifest(source, { exportedAt: NOW, readPhotoBase64: async () => PHOTO });
    expect(manifest.backupFormatVersion).toBeGreaterThan(0);
    expect(manifest.tombstones).toContainEqual({ entityType: "contact_link", entityUid: "prior-hard-delete", deletedAt: NOW });
    expect(manifest.customFieldValues).toContainEqual(expect.objectContaining({ contactUid: "bea", fieldDefUid: "nickname-def", value: null }));
    expect(manifest.customFieldValues).toContainEqual(expect.objectContaining({ contactUid: "ada", fieldDefUid: "portrait-def", photoBase64: PHOTO }));

    for (const mode of ["merge", "replace-all"] as const) {
      const destination = await migrated();
      const result = await applyRestore(destination, manifest, mode, {
        sessionToken: `roundtrip-${mode}`,
        stagePhoto: async () => {}, persistPhoto: async () => {}, deleteCanonicalPhoto: () => {}, canonicalPhotoExists: () => false,
      });
      expect(result.status).toBe("applied");
      const restored = await destination.getAllAsync<{ uid: string; category_id: number; categoryUid: string }>(
        "SELECT c.uid,c.category_id,category.uid AS categoryUid FROM contacts c JOIN categories category ON category.id=c.category_id WHERE c.uid IN ('ada','bea') ORDER BY c.uid",
      );
      expect(restored).toEqual([
        { uid: "ada", category_id: expect.any(Number), categoryUid: "family-category" },
        { uid: "bea", category_id: expect.any(Number), categoryUid: "work-category" },
      ]);
      for (const row of restored) {
        await expect(destination.getFirstAsync("SELECT id FROM categories WHERE id=? AND uid=?", [row.category_id, row.categoryUid])).resolves.not.toBeNull();
      }
    }
  });

  it("exports a representative 50-photo library within the mutex-held regression budget", async () => {
    const exec = await migrated();
    for (let index = 0; index < 50; index += 1) {
      await exec.runAsync("INSERT INTO contacts (uid,name,interval_days,photo,created_at,modified_at) VALUES (?,?,?,?,?,?)", [`large-${index}`, `Large ${index}`, 7, `avatars/large-${index}.jpg`, NOW, NOW]);
    }
    const started = performance.now();
    const manifest = await buildExportManifest(exec, { exportedAt: NOW, readPhotoBase64: async () => PHOTO });
    const durationMs = performance.now() - started;
    expect(manifest.contacts).toHaveLength(50);
    // A deliberately generous guard: catches pathological snapshot work, not UX timing.
    expect(durationMs).toBeLessThan(5_000);
  });

  it("keeps the tombstone vocabulary exhaustive for every production hard-delete table", async () => {
    const dbDirectory = join(process.cwd(), "src", "db");
    const files = (await readdir(dbDirectory, { recursive: true }))
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"));
    const writers = new Set<string>();
    for (const file of files) {
      const source = await readFile(join(dbDirectory, file), "utf8");
      for (const match of source.matchAll(/DELETE\s+FROM\s+([a-z_]+)/gi)) writers.add(match[1]);
    }
    const covered = new Map([
      ["contacts", "contact"], ["interactions", "interaction"], ["events", "event"], ["fuel", "fuel"],
      ["contact_links", "contact_link"], ["custom_field_defs", "custom_field_def"], ["custom_field_values", "custom_field_value"],
    ]);
    for (const table of writers) {
      if (["field_history", "restore_photo_journal"].includes(table)) continue;
      expect(covered.has(table), `DELETE FROM ${table} needs a tombstone entity_type or an explicit non-mergeable exemption`).toBe(true);
    }
  });
});
