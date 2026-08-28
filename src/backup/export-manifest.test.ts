import { describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));
vi.mock("@/db/app-settings-dao", () => ({
  getPortableSettingsSnapshot: async (exec: { getFirstAsync<T>(sql: string): Promise<T | null> }) => {
    const row = await exec.getFirstAsync<{
      sun_contact_id: number | null;
      modified_at: string;
    }>("SELECT sun_contact_id, modified_at FROM app_settings WHERE id = 1");
    if (!row) throw new Error("missing settings");
    return {
      notificationsEnabled: 0 as const, decayEnabled: 1 as const, birthdayEnabled: 1 as const,
      digestEnabled: 1 as const, lockscreenPublic: 0 as const, deliveryHour: 9,
      quietStartHour: 21, quietEndHour: 8, sunContactId: row.sun_contact_id,
      selfSunColour: null, aiProvider: "none", aiModel: "", aiCustomEndpoint: "",
      aiCustomModel: "", aiPromptTemplate: "", backupIntervalDays: 1,
      backupRetentionDays: 7, phoneRegionOverride: null, modifiedAt: row.modified_at,
    };
  },
}));
import { buildExportManifest } from "@/backup/export-manifest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";

const NOW = "2026-08-25 12:00:00";

describe("buildExportManifest", () => {
  it("exports full portable state with bytes and never local paths or backup bookkeeping", async () => {
    let count = 0;
    const exec = nodeSqliteExecutor(openTestDb());
    await runMigrations(exec, MIGRATIONS, TARGET_VERSION, { now: NOW, newUid: () => `uid-${++count}` });
    await exec.runAsync("UPDATE profile SET name = ?, photo = ? WHERE id = 1", ["Me", "avatars/profile.jpg"]);
    const category = await exec.getFirstAsync<{ id: number; uid: string }>("SELECT id, uid FROM categories ORDER BY id LIMIT 1");
    await exec.runAsync(`INSERT INTO contacts (uid, name, category_id, interval_days, photo, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, ["contact-a", "Ada", category!.id, 7, "avatars/contact-1.jpg", NOW, NOW]);
    const contact = await exec.getFirstAsync<{ id: number }>("SELECT id FROM contacts WHERE uid = ?", ["contact-a"]);
    await exec.runAsync(
      `INSERT INTO contact_methods
        (uid, contact_id, method_type, raw_value, display_value, canonical_value,
         canonical_region, label, extension, is_actionable, is_primary,
         display_order, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "method-a", contact!.id, "phone", "+1 555 0100", "+1 555 0100",
        "+15550100", "US", "Mobile", "42", 1, 1, 0, NOW, NOW,
      ],
    );
    await exec.runAsync("UPDATE app_settings SET sun_contact_id = ?, data_revision = 9, backup_folder_uri = ? WHERE id = 1", [contact!.id, "content://local"]);
    await exec.runAsync(`INSERT INTO custom_field_defs (uid, col_name, label, type, options, show_on_new, always_show, display_order, share_with_ai, created_at, modified_at) VALUES (?, ?, ?, ?, NULL, 0, 0, 0, 0, ?, ?)`, ["def-a", "nickname", "Nickname", "text", NOW, NOW]);
    const def = await exec.getFirstAsync<{ id: number }>("SELECT id FROM custom_field_defs WHERE uid = ?", ["def-a"]);
    await exec.runAsync(`INSERT INTO custom_field_values (uid, contact_id, field_def_id, value, created_at, modified_at) VALUES (?, ?, ?, NULL, ?, ?)`, ["value-a", contact!.id, def!.id, NOW, NOW]);
    const manifest = await buildExportManifest(exec, { exportedAt: NOW, readPhotoBase64: async () => "AQID" });
    expect(manifest.appSettings).toMatchObject({ sunContactUid: "contact-a", modifiedAt: NOW });
    expect(manifest.appSettings).not.toHaveProperty("sunContactId");
    expect(JSON.stringify(manifest)).not.toMatch(/data_revision|backup_folder_uri|avatars\//);
    expect(manifest.profile).toMatchObject({ photoBase64: "AQID" });
    expect(manifest.contacts[0]).toMatchObject({ uid: "contact-a", categoryUid: category!.uid, photoBase64: "AQID" });
    expect(manifest).toMatchObject({
      contactMethods: [{
        uid: "method-a", contactUid: "contact-a", methodType: "phone",
        canonicalValue: "+15550100", canonicalRegion: "US", label: "Mobile",
        extension: "42", isActionable: 1, isPrimary: 1, displayOrder: 0,
      }],
    });
    expect(manifest.customFieldValues).toEqual([expect.objectContaining({ uid: "value-a", value: null })]);
  });

  it("aborts rather than emitting a partial manifest when one referenced photo cannot be read", async () => {
    const exec = nodeSqliteExecutor(openTestDb());
    let count = 0;
    await runMigrations(exec, MIGRATIONS, TARGET_VERSION, { now: NOW, newUid: () => `uid-${++count}` });
    await exec.runAsync(`INSERT INTO contacts (uid, name, interval_days, photo, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?)`, ["contact-a", "Ada", 7, "avatars/contact-1.jpg", NOW, NOW]);
    await expect(buildExportManifest(exec, { exportedAt: NOW, readPhotoBase64: async () => { throw new Error("missing"); } })).rejects.toThrow(/repair/i);
  });
});
