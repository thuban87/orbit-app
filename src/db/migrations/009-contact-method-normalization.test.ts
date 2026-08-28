import { beforeEach, describe, expect, it } from "vitest";
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
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-28 12:00:00";
let nextUid = 0;
const newUid = () => `uid-${++nextUid}`;
let exec: SqlExecutor;

const V8 = [migration001, migration002, migration003, migration004, migration005, migration006, migration007, migration008];

beforeEach(async () => {
  nextUid = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, V8, 8, { now: NOW, newUid });
});

async function seedLegacyContact(intervalDays: unknown = 30): Promise<number> {
  const contact = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, phone, email, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [newUid(), "Legacy", intervalDays, "312 555 1234", "Person@Example.COM", NOW, NOW],
  );
  const id = contact.lastInsertRowId;
  const field = await exec.runAsync(
    `INSERT INTO custom_field_defs (uid, col_name, label, type, display_order, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [newUid(), "legacy_note", "Legacy note", "text", 0, NOW, NOW],
  );
  await exec.runAsync(
    `INSERT INTO contact_links (uid, contact_id, url, display_order, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [newUid(), id, "https://example.test", 0, NOW, NOW],
  );
  await exec.runAsync(
    `INSERT INTO interactions (uid, contact_id, occurred_at, recorded_at, source, modified_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [newUid(), id, NOW, NOW, "manual", NOW],
  );
  await exec.runAsync(
    `INSERT INTO events (uid, contact_id, type, occurred_at, recorded_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [newUid(), id, "birthday", NOW, NOW, NOW],
  );
  await exec.runAsync(
    `INSERT INTO fuel (uid, contact_id, kind, created_at, source, modified_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [newUid(), id, "note", NOW, "manual", NOW],
  );
  await exec.runAsync(
    `INSERT INTO custom_field_values (uid, contact_id, field_def_id, value, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [newUid(), id, field.lastInsertRowId, "preserved", NOW, NOW],
  );
  await exec.runAsync("UPDATE app_settings SET sun_contact_id = ? WHERE id = 1", [id]);
  return id;
}

describe("migration 009 — contact method normalization", () => {
  it("rebuilds v8 contacts, preserves every FK child, and migrates primary methods", async () => {
    const id = await seedLegacyContact();
    await runMigrations(exec, [...V8, migration009], 9, { now: NOW, newUid, defaultPhoneRegion: "US" });

    expect((await exec.getFirstAsync<{ user_version: number }>("PRAGMA user_version"))?.user_version).toBe(9);
    expect((await exec.getAllAsync<{ name: string }>("PRAGMA table_info(contacts)")).map((row) => row.name)).not.toEqual(expect.arrayContaining(["phone", "email"]));
    expect(await exec.getAllAsync("PRAGMA foreign_key_check")).toEqual([]);
    expect(
      await exec.getAllAsync<{ name: string; count: number }>(
        `SELECT 'contact_links' AS name, COUNT(*) AS count FROM contact_links
         UNION ALL SELECT 'interactions', COUNT(*) FROM interactions
         UNION ALL SELECT 'events', COUNT(*) FROM events
         UNION ALL SELECT 'fuel', COUNT(*) FROM fuel
         UNION ALL SELECT 'custom_field_values', COUNT(*) FROM custom_field_values
         UNION ALL SELECT 'app_settings', COUNT(*) FROM app_settings`,
      ),
    ).toEqual([
      { name: "contact_links", count: 1 }, { name: "interactions", count: 1 }, { name: "events", count: 1 },
      { name: "fuel", count: 1 }, { name: "custom_field_values", count: 1 }, { name: "app_settings", count: 1 },
    ]);
    expect(await exec.getAllAsync(
      "SELECT method_type, canonical_value, canonical_region, is_primary FROM contact_methods WHERE contact_id = ? ORDER BY method_type",
      [id],
    )).toEqual([
      { method_type: "email", canonical_value: "person@example.com", canonical_region: null, is_primary: 1 },
      { method_type: "phone", canonical_value: "+13125551234", canonical_region: "US", is_primary: 1 },
    ]);
    expect(await exec.getFirstAsync<{ sun_contact_id: number; phone_region_override: string | null }>(
      "SELECT sun_contact_id, phone_region_override FROM app_settings WHERE id = 1",
    )).toEqual({ sun_contact_id: id, phone_region_override: null });
  });

  it.each([0, -1, 2.5, "broken"])("clamps malformed cadence %p and snapshots its original value", async (intervalDays) => {
    const id = await seedLegacyContact(intervalDays);
    await runMigrations(exec, [...V8, migration009], 9, { now: NOW, newUid, defaultPhoneRegion: null });
    expect(await exec.getFirstAsync<{ interval_days: number }>("SELECT interval_days FROM contacts WHERE id = ?", [id]))
      .toEqual({ interval_days: 30 });
    expect(await exec.getFirstAsync(
      "SELECT contact_id, field_col_name, old_value, operation, created_at FROM field_history WHERE contact_id = ? AND field_col_name = 'interval_days'",
      [id],
    )).toEqual({ contact_id: id, field_col_name: "interval_days", old_value: String(intervalDays), operation: "migration-009:interval-clamp", created_at: NOW });
  });

  it("fails closed without a device region while preserving raw national input", async () => {
    const id = await seedLegacyContact();
    await runMigrations(exec, [...V8, migration009], 9, { now: NOW, newUid });
    expect(await exec.getFirstAsync(
      "SELECT display_value, canonical_value, canonical_region, is_actionable FROM contact_methods WHERE contact_id = ? AND method_type = 'phone'",
      [id],
    )).toEqual({ display_value: "312 555 1234", canonical_value: null, canonical_region: null, is_actionable: 0 });
  });

  it("enforces one primary per type but permits primary phone and email together", async () => {
    const id = await seedLegacyContact();
    await runMigrations(exec, [...V8, migration009], 9, { now: NOW, newUid, defaultPhoneRegion: "US" });
    await expect((async () => exec.runAsync(
      `INSERT INTO contact_methods (uid, contact_id, method_type, raw_value, display_value, is_actionable, is_primary, display_order, created_at, modified_at)
       VALUES (?, ?, 'phone', ?, ?, 0, 1, 2, ?, ?)`,
      [newUid(), id, "another", "another", NOW, NOW],
    ))()).rejects.toThrow();
    await expect((async () => exec.runAsync(
      `INSERT INTO contact_methods (uid, contact_id, method_type, raw_value, display_value, is_actionable, is_primary, display_order, created_at, modified_at)
       VALUES (?, ?, 'email', ?, ?, 0, 0, 2, ?, ?)`,
      [newUid(), id, "secondary", "secondary", NOW, NOW],
    ))()).resolves.toMatchObject({ changes: 1 });
  });

  it("keeps Orbit methods when external source evidence becomes stale or is removed", async () => {
    const id = await seedLegacyContact();
    await runMigrations(exec, [...V8, migration009], 9, {
      now: NOW,
      newUid,
      defaultPhoneRegion: "US",
    });
    const method = await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM contact_methods WHERE contact_id = ? AND method_type = 'phone'",
      [id],
    );
    const link = await exec.runAsync(
      `INSERT INTO external_contact_links (uid, contact_id, provider, external_contact_id, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [newUid(), id, "android", "source-1", NOW, NOW],
    );
    await exec.runAsync(
      `INSERT INTO contact_method_provenance (uid, method_id, external_contact_link_id, source_method_id, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [newUid(), method?.id, link.lastInsertRowId, "phone-1", NOW, NOW],
    );
    await exec.runAsync("UPDATE external_contact_links SET is_active = 0 WHERE id = ?", [link.lastInsertRowId]);
    expect(await exec.getFirstAsync("SELECT id FROM contact_methods WHERE id = ?", [method?.id])).not.toBeNull();
    await exec.runAsync("DELETE FROM external_contact_links WHERE id = ?", [link.lastInsertRowId]);
    expect(await exec.getFirstAsync(
      "SELECT external_contact_link_id FROM contact_method_provenance WHERE method_id = ?",
      [method?.id],
    )).toEqual({ external_contact_link_id: null });
  });
});
