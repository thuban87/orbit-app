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
import { migration010 } from "@/db/migrations/010-contact-method-label";
import { migration011 } from "@/db/migrations/011-contact-lifecycle-schema";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-28 12:00:00";
const V10 = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
  migration008,
  migration009,
  migration010,
];

const DIRECT_CONTACT_CHILDREN = [
  "app_settings",
  "contact_links",
  "custom_field_values",
  "events",
  "fuel",
  "interactions",
  "contact_methods",
  "external_contact_links",
] as const;

interface TableInfo {
  cid: number;
  name: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
  type: string;
}

let exec: SqlExecutor;
let nextUid = 0;
const newUid = () => `uid-${++nextUid}`;

beforeEach(async () => {
  nextUid = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, V10, 10, {
    now: NOW,
    newUid,
    defaultPhoneRegion: "US",
  });
});

async function tableSql(table: string): Promise<string> {
  const row = await exec.getFirstAsync<{ sql: string }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
    [table],
  );
  if (!row) throw new Error(`missing ${table} schema`);
  return row.sql;
}

async function indexes(
  table: string,
): Promise<Array<{ name: string; sql: string | null }>> {
  return exec.getAllAsync(
    "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ? ORDER BY name",
    [table],
  );
}

async function triggers(
  table: string,
): Promise<Array<{ name: string; sql: string }>> {
  return exec.getAllAsync(
    "SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND tbl_name = ? ORDER BY name",
    [table],
  );
}

async function seedV10Fixture(): Promise<number> {
  const contact = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, social_battery, birthday, photo, last_contact,
      favourite_rank, ring_seq, archived_at, snooze_until, rarely_responds, reminders_off, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newUid(),
      "Preserved",
      37,
      "low",
      "1988-02-29",
      "file://photo",
      NOW,
      3,
      2,
      null,
      "2026-09-01 00:00:00",
      1,
      1,
      "2020-01-01 00:00:00",
      NOW,
    ],
  );
  const contactId = contact.lastInsertRowId;
  const field = await exec.runAsync(
    `INSERT INTO custom_field_defs (uid, col_name, label, type, display_order, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [newUid(), "v11_fixture", "V11 fixture", "text", 0, NOW, NOW],
  );
  await exec.runAsync(
    `INSERT INTO contact_links (uid, contact_id, url, label, display_order, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [newUid(), contactId, "https://example.test", "link", 0, NOW, NOW],
  );
  await exec.runAsync(
    `INSERT INTO interactions (uid, contact_id, occurred_at, recorded_at, source, modified_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [newUid(), contactId, NOW, NOW, "manual", NOW],
  );
  await exec.runAsync(
    `INSERT INTO events (uid, contact_id, type, occurred_at, recorded_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [newUid(), contactId, "birthday", NOW, NOW, NOW],
  );
  await exec.runAsync(
    `INSERT INTO fuel (uid, contact_id, kind, created_at, source, modified_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [newUid(), contactId, "note", NOW, "manual", NOW],
  );
  await exec.runAsync(
    `INSERT INTO custom_field_values (uid, contact_id, field_def_id, value, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [newUid(), contactId, field.lastInsertRowId, "value", NOW, NOW],
  );
  const method = await exec.runAsync(
    `INSERT INTO contact_methods (uid, contact_id, method_type, raw_value, display_value, canonical_value,
      canonical_region, extension, is_actionable, is_primary, display_order, label, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newUid(),
      contactId,
      "email",
      "person@example.test",
      "person@example.test",
      "person@example.test",
      null,
      null,
      1,
      1,
      0,
      "Personal",
      NOW,
      NOW,
    ],
  );
  const link = await exec.runAsync(
    `INSERT INTO external_contact_links (uid, contact_id, provider, external_contact_id, is_active, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [newUid(), contactId, "android", "external-1", 1, NOW, NOW],
  );
  await exec.runAsync(
    `INSERT INTO contact_method_provenance (uid, method_id, external_contact_link_id, source_method_id, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      newUid(),
      method.lastInsertRowId,
      link.lastInsertRowId,
      "source-method",
      NOW,
      NOW,
    ],
  );
  await exec.runAsync(
    `UPDATE app_settings SET notifications_enabled = 1, decay_enabled = 0, birthday_enabled = 0,
      lockscreen_public = 1, delivery_hour = 14, quiet_start_hour = 20, quiet_end_hour = 7,
      sun_contact_id = ?, self_sun_colour = '#123456', ai_provider = 'custom', ai_model = 'model',
      ai_custom_endpoint = 'https://example.test', ai_custom_model = 'custom-model', ai_prompt_template = 'template',
      ai_ack_openai = 1, ai_ack_anthropic = 1, ai_ack_google = 1, ai_ack_custom = 1, digest_enabled = 0,
      data_revision = 42, backup_interval_days = 3, backup_retention_days = 9, backup_folder_uri = 'content://folder',
      backup_folder_name = 'Backup', backup_folder_accessible = 1, backup_folder_diagnostic = 'healthy',
      last_automatic_backup_at = ?, last_backup_data_revision = 41, encryption_enabled = 1,
      backup_nudge_dismissed = 1, phone_region_override = 'CA', created_at = ?, modified_at = ? WHERE id = 1`,
    [contactId, NOW, "2020-01-01 00:00:00", NOW],
  );
  return contactId;
}

describe("migration 011 — contact lifecycle schema", () => {
  it("rebuilds v10 contacts as a pure shape change and preserves direct and transitive children", async () => {
    const id = await seedV10Fixture();
    const beforeContact = await exec.getFirstAsync(
      "SELECT * FROM contacts WHERE id = ?",
      [id],
    );
    const beforeSettings = await exec.getFirstAsync(
      "SELECT * FROM app_settings WHERE id = 1",
    );
    const beforeContactInfo = await exec.getAllAsync<TableInfo>(
      "PRAGMA table_info(contacts)",
    );
    const beforeSettingsInfo = await exec.getAllAsync<TableInfo>(
      "PRAGMA table_info(app_settings)",
    );
    const beforeContactSql = await tableSql("contacts");
    const beforeSettingsSql = await tableSql("app_settings");
    const beforeContactIndexes = await indexes("contacts");
    const beforeSettingsIndexes = await indexes("app_settings");
    const beforeChildren = await Promise.all(
      DIRECT_CONTACT_CHILDREN.map(async (table) => ({
        table,
        rows: await exec.getAllAsync(`SELECT * FROM ${table} ORDER BY id`),
        foreignKeys: await exec.getAllAsync(
          `PRAGMA foreign_key_list(${table})`,
        ),
        indexes: await indexes(table),
        triggers: await triggers(table),
      })),
    );
    const beforeProvenance = {
      rows: await exec.getAllAsync(
        "SELECT * FROM contact_method_provenance ORDER BY id",
      ),
      foreignKeys: await exec.getAllAsync(
        "PRAGMA foreign_key_list(contact_method_provenance)",
      ),
      indexes: await indexes("contact_method_provenance"),
      triggers: await triggers("contact_method_provenance"),
    };

    await runMigrations(exec, [...V10, migration011], 11, { now: NOW, newUid });

    expect(
      (
        await exec.getFirstAsync<{ user_version: number }>(
          "PRAGMA user_version",
        )
      )?.user_version,
    ).toBe(11);
    expect(
      await exec.getFirstAsync("SELECT * FROM contacts WHERE id = ?", [id]),
    ).toEqual({
      ...beforeContact,
      tracking_enabled: 1,
    });
    expect(
      await exec.getFirstAsync("SELECT * FROM app_settings WHERE id = 1"),
    ).toEqual({
      ...beforeSettings,
      include_unbound_never_contacted: 0,
      birthday_unbound_enabled: 1,
    });

    const afterContactInfo = await exec.getAllAsync<TableInfo>(
      "PRAGMA table_info(contacts)",
    );
    expect(afterContactInfo).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "interval_days",
          notnull: 0,
          dflt_value: null,
        }),
        expect.objectContaining({
          name: "tracking_enabled",
          notnull: 1,
          dflt_value: "1",
        }),
      ]),
    );
    expect(
      afterContactInfo
        .filter(
          (column) =>
            column.name !== "tracking_enabled" &&
            column.name !== "interval_days",
        )
        .map(({ cid: _cid, ...column }) => column),
    ).toEqual(
      beforeContactInfo
        .filter((column) => column.name !== "interval_days")
        .map(({ cid: _cid, ...column }) => column),
    );
    const afterSettingsInfo = await exec.getAllAsync<{ name: string }>(
      "PRAGMA table_info(app_settings)",
    );
    expect(afterSettingsInfo.slice(0, beforeSettingsInfo.length)).toEqual(
      beforeSettingsInfo,
    );
    expect(afterSettingsInfo.slice(beforeSettingsInfo.length)).toEqual([
      expect.objectContaining({
        name: "include_unbound_never_contacted",
        notnull: 1,
        dflt_value: "0",
      }),
      expect.objectContaining({
        name: "birthday_unbound_enabled",
        notnull: 1,
        dflt_value: "1",
      }),
    ]);
    expect(await tableSql("contacts")).toContain(
      "CHECK (interval_days IS NULL OR (typeof(interval_days) = 'integer' AND interval_days > 0))",
    );
    expect(await tableSql("contacts")).toContain(
      "CHECK (tracking_enabled = 0 OR interval_days IS NOT NULL)",
    );
    expect(await tableSql("contacts")).toMatch(/uid\s+TEXT\s+NOT NULL UNIQUE/);
    expect(beforeContactSql).toMatch(/uid\s+TEXT\s+NOT NULL UNIQUE/);
    expect(await tableSql("app_settings")).toContain(
      "id INTEGER PRIMARY KEY CHECK (id = 1)",
    );
    expect(beforeSettingsSql).toContain(
      "id INTEGER PRIMARY KEY CHECK (id = 1)",
    );
    expect(await indexes("contacts")).toEqual(beforeContactIndexes);
    expect(await indexes("app_settings")).toEqual(beforeSettingsIndexes);

    for (const child of beforeChildren) {
      if (child.table !== "app_settings") {
        expect(
          await exec.getAllAsync(`SELECT * FROM ${child.table} ORDER BY id`),
        ).toEqual(child.rows);
      }
      expect(
        await exec.getAllAsync(`PRAGMA foreign_key_list(${child.table})`),
      ).toEqual(child.foreignKeys);
      expect(await indexes(child.table)).toEqual(child.indexes);
      expect(await triggers(child.table)).toEqual(child.triggers);
    }
    expect(
      await exec.getAllAsync(
        "SELECT * FROM contact_method_provenance ORDER BY id",
      ),
    ).toEqual(beforeProvenance.rows);
    expect(
      await exec.getAllAsync(
        "PRAGMA foreign_key_list(contact_method_provenance)",
      ),
    ).toEqual(beforeProvenance.foreignKeys);
    expect(await indexes("contact_method_provenance")).toEqual(
      beforeProvenance.indexes,
    );
    expect(await triggers("contact_method_provenance")).toEqual(
      beforeProvenance.triggers,
    );
    expect(await exec.getAllAsync("PRAGMA foreign_key_check")).toEqual([]);
  });

  it("enforces lifecycle cadence constraints and rolls back a cadence clear", async () => {
    const id = await seedV10Fixture();
    await runMigrations(exec, [...V10, migration011], 11, { now: NOW, newUid });

    await expect(
      Promise.resolve().then(() =>
        exec.runAsync("UPDATE contacts SET interval_days = NULL WHERE id = ?", [
          id,
        ]),
      ),
    ).rejects.toThrow();
    expect(
      await exec.getFirstAsync(
        "SELECT interval_days FROM contacts WHERE id = ?",
        [id],
      ),
    ).toEqual({ interval_days: 37 });
    await expect(
      Promise.resolve().then(() =>
        exec.runAsync("UPDATE contacts SET interval_days = 0 WHERE id = ?", [
          id,
        ]),
      ),
    ).rejects.toThrow();
    await expect(
      Promise.resolve().then(() =>
        exec.runAsync("UPDATE contacts SET interval_days = -1 WHERE id = ?", [
          id,
        ]),
      ),
    ).rejects.toThrow();
    await expect(
      Promise.resolve().then(() =>
        exec.runAsync("UPDATE contacts SET interval_days = 2.5 WHERE id = ?", [
          id,
        ]),
      ),
    ).rejects.toThrow();
    await expect(
      Promise.resolve().then(() =>
        exec.runAsync(
          "UPDATE contacts SET interval_days = NULL, tracking_enabled = 0 WHERE id = ?",
          [id],
        ),
      ),
    ).rejects.toThrow();

    const unassigned = await exec.runAsync(
      `INSERT INTO contacts (uid, name, interval_days, tracking_enabled, created_at, modified_at)
       VALUES (?, ?, NULL, 0, ?, ?)`,
      [newUid(), "Unassigned", NOW, NOW],
    );
    await expect(
      Promise.resolve().then(() =>
        exec.runAsync("UPDATE contacts SET tracking_enabled = 1 WHERE id = ?", [
          unassigned.lastInsertRowId,
        ]),
      ),
    ).rejects.toThrow();
  });
});
