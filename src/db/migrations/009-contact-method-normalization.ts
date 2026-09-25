import { normalizeContactMethod } from "@/logic/contact-method-normalization";
import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

/** Monthly is Orbit's canonical fallback cadence for malformed legacy restores. */
export const CLAMP_DEFAULT_INTERVAL_DAYS = 30;

const EXPECTED_CONTACT_CHILDREN = [
  "app_settings",
  "contact_links",
  "custom_field_values",
  "events",
  "fuel",
  "interactions",
] as const;

const CREATE_CONTACTS_V9 = `
CREATE TABLE contacts (
  id              INTEGER PRIMARY KEY,
  uid             TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  category_id     INTEGER REFERENCES categories(id),
  interval_days   INTEGER NOT NULL,
  social_battery  TEXT,
  birthday        TEXT,
  photo           TEXT,
  last_contact    TEXT,
  favourite_rank  INTEGER,
  ring_seq        INTEGER,
  archived_at     TEXT,
  snooze_until    TEXT,
  rarely_responds INTEGER NOT NULL DEFAULT 0,
  reminders_off   INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL,
  modified_at     TEXT NOT NULL
);`;

const CREATE_CONTACT_LINKS_V9 = `
CREATE TABLE contact_links (
  id INTEGER PRIMARY KEY, uid TEXT NOT NULL UNIQUE,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  url TEXT NOT NULL, label TEXT, display_order INTEGER NOT NULL,
  created_at TEXT NOT NULL, modified_at TEXT NOT NULL
);`;

const CREATE_INTERACTIONS_V9 = `
CREATE TABLE interactions (
  id INTEGER PRIMARY KEY, uid TEXT NOT NULL UNIQUE,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  occurred_at TEXT NOT NULL, recorded_at TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'unspecified', direction TEXT,
  connected INTEGER NOT NULL DEFAULT 1, quality TEXT, note TEXT,
  source TEXT NOT NULL, modified_at TEXT NOT NULL
);`;

const CREATE_EVENTS_V9 = `
CREATE TABLE events (
  id INTEGER PRIMARY KEY, uid TEXT NOT NULL UNIQUE,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type TEXT NOT NULL, occurred_at TEXT NOT NULL, detail TEXT,
  recorded_at TEXT NOT NULL, modified_at TEXT NOT NULL
);`;

const CREATE_FUEL_V9 = `
CREATE TABLE fuel (
  id INTEGER PRIMARY KEY, uid TEXT NOT NULL UNIQUE,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, label TEXT, text TEXT, url TEXT,
  created_at TEXT NOT NULL, source TEXT NOT NULL, modified_at TEXT NOT NULL
);`;

const CREATE_CUSTOM_FIELD_VALUES_V9 = `
CREATE TABLE custom_field_values (
  id INTEGER PRIMARY KEY, uid TEXT NOT NULL UNIQUE,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  field_def_id INTEGER NOT NULL REFERENCES custom_field_defs(id) ON DELETE CASCADE,
  value TEXT, created_at TEXT NOT NULL, modified_at TEXT NOT NULL,
  UNIQUE(contact_id, field_def_id)
);`;

// Literal, not a read-projection: `id` and `created_at` are preservation-critical.
const CREATE_APP_SETTINGS_V9 = `
CREATE TABLE app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  notifications_enabled INTEGER NOT NULL DEFAULT 0,
  decay_enabled INTEGER NOT NULL DEFAULT 1,
  birthday_enabled INTEGER NOT NULL DEFAULT 1,
  lockscreen_public INTEGER NOT NULL DEFAULT 0,
  delivery_hour INTEGER NOT NULL DEFAULT 9,
  quiet_start_hour INTEGER NOT NULL DEFAULT 21,
  quiet_end_hour INTEGER NOT NULL DEFAULT 8,
  sun_contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  self_sun_colour TEXT,
  ai_provider TEXT NOT NULL DEFAULT 'none', ai_model TEXT NOT NULL DEFAULT '',
  ai_custom_endpoint TEXT NOT NULL DEFAULT '', ai_custom_model TEXT NOT NULL DEFAULT '',
  ai_prompt_template TEXT NOT NULL DEFAULT '',
  ai_ack_openai INTEGER NOT NULL DEFAULT 0, ai_ack_anthropic INTEGER NOT NULL DEFAULT 0,
  ai_ack_google INTEGER NOT NULL DEFAULT 0, ai_ack_custom INTEGER NOT NULL DEFAULT 0,
  digest_enabled INTEGER NOT NULL DEFAULT 1,
  data_revision INTEGER NOT NULL DEFAULT 0,
  backup_interval_days INTEGER NOT NULL DEFAULT 1,
  backup_retention_days INTEGER NOT NULL DEFAULT 7,
  backup_folder_uri TEXT, backup_folder_name TEXT,
  backup_folder_accessible INTEGER NOT NULL DEFAULT 0, backup_folder_diagnostic TEXT,
  last_automatic_backup_at TEXT, last_backup_data_revision INTEGER NOT NULL DEFAULT 0,
  encryption_enabled INTEGER NOT NULL DEFAULT 0, backup_nudge_dismissed INTEGER NOT NULL DEFAULT 0,
  phone_region_override TEXT,
  created_at TEXT NOT NULL, modified_at TEXT NOT NULL
);`;

const CHILD_DDL: Record<(typeof EXPECTED_CONTACT_CHILDREN)[number], string> = {
  contact_links: CREATE_CONTACT_LINKS_V9,
  interactions: CREATE_INTERACTIONS_V9,
  events: CREATE_EVENTS_V9,
  fuel: CREATE_FUEL_V9,
  custom_field_values: CREATE_CUSTOM_FIELD_VALUES_V9,
  app_settings: CREATE_APP_SETTINGS_V9,
};

const CHILD_COPY_COLUMNS: Record<(typeof EXPECTED_CONTACT_CHILDREN)[number], string> = {
  contact_links: "id, uid, contact_id, url, label, display_order, created_at, modified_at",
  interactions: "id, uid, contact_id, occurred_at, recorded_at, channel, direction, connected, quality, note, source, modified_at",
  events: "id, uid, contact_id, type, occurred_at, detail, recorded_at, modified_at",
  fuel: "id, uid, contact_id, kind, label, text, url, created_at, source, modified_at",
  custom_field_values: "id, uid, contact_id, field_def_id, value, created_at, modified_at",
  app_settings: "id, notifications_enabled, decay_enabled, birthday_enabled, lockscreen_public, delivery_hour, quiet_start_hour, quiet_end_hour, sun_contact_id, self_sun_colour, ai_provider, ai_model, ai_custom_endpoint, ai_custom_model, ai_prompt_template, ai_ack_openai, ai_ack_anthropic, ai_ack_google, ai_ack_custom, digest_enabled, data_revision, backup_interval_days, backup_retention_days, backup_folder_uri, backup_folder_name, backup_folder_accessible, backup_folder_diagnostic, last_automatic_backup_at, last_backup_data_revision, encryption_enabled, backup_nudge_dismissed, created_at, modified_at",
};

interface LegacyContact {
  id: number; uid: string; name: string; category_id: number | null; interval_days: unknown;
  social_battery: string | null; birthday: string | null; phone: string | null; email: string | null;
  photo: string | null; last_contact: string | null; favourite_rank: number | null; ring_seq: number | null;
  archived_at: string | null; snooze_until: string | null; rarely_responds: number; reminders_off: number;
  created_at: string; modified_at: string;
}

async function count(exec: SqlExecutor, table: string): Promise<number> {
  const row = await exec.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`);
  return row?.count ?? 0;
}

async function assertExpectedChildren(exec: SqlExecutor): Promise<void> {
  const tables = await exec.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  );
  const actual: string[] = [];
  for (const { name } of tables) {
    const foreignKeys = await exec.getAllAsync<{ table: string }>(`PRAGMA foreign_key_list(${name})`);
    if (foreignKeys.some((foreignKey) => foreignKey.table === "contacts")) actual.push(name);
  }
  const expected = [...EXPECTED_CONTACT_CHILDREN].sort();
  if (actual.sort().join(",") !== expected.join(",")) {
    throw new Error(`migration 009 contact child set changed: ${actual.join(",")}`);
  }
}

function validCadence(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

async function copyContacts(exec: SqlExecutor, deps: MigrationDeps): Promise<LegacyContact[]> {
  const rows = await exec.getAllAsync<LegacyContact>("SELECT * FROM contacts_old ORDER BY id");
  for (const row of rows) {
    const intervalDays = validCadence(row.interval_days) ? row.interval_days : CLAMP_DEFAULT_INTERVAL_DAYS;
    if (!validCadence(row.interval_days)) {
      await exec.runAsync(
        `INSERT INTO field_history (contact_id, field_col_name, old_value, operation, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [row.id, "interval_days", String(row.interval_days), "migration-009:interval-clamp", deps.now],
      );
    }
    await exec.runAsync(
      `INSERT INTO contacts (id, uid, name, category_id, interval_days, social_battery, birthday, photo,
        last_contact, favourite_rank, ring_seq, archived_at, snooze_until, rarely_responds, reminders_off, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.uid, row.name, row.category_id, intervalDays, row.social_battery, row.birthday, row.photo,
        row.last_contact, row.favourite_rank, row.ring_seq, row.archived_at, row.snooze_until,
        row.rarely_responds, row.reminders_off, row.created_at, row.modified_at],
    );
  }
  return rows;
}

async function createMethods(exec: SqlExecutor, rows: LegacyContact[], deps: MigrationDeps): Promise<void> {
  for (const row of rows) {
    for (const [type, value] of [["phone", row.phone], ["email", row.email]] as const) {
      if (!value || value.trim() === "") continue;
      const normalized = normalizeContactMethod({ type, value, defaultPhoneRegion: deps.defaultPhoneRegion });
      await exec.runAsync(
        `INSERT INTO contact_methods (uid, contact_id, method_type, raw_value, display_value, canonical_value,
          canonical_region, extension, is_actionable, is_primary, display_order, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
        [deps.newUid(), row.id, type, normalized.rawValue, normalized.displayValue, normalized.canonicalValue,
          normalized.canonicalRegion, normalized.extension, normalized.isActionable ? 1 : 0,
          row.created_at, row.modified_at],
      );
    }
  }
}

export const migration009: Migration = {
  version: 9,
  async apply(exec: SqlExecutor, deps: MigrationDeps): Promise<void> {
    // First statement inside the runner-owned transaction. FK actions still fire.
    await exec.execAsync("PRAGMA defer_foreign_keys = ON");
    await assertExpectedChildren(exec);
    const before = new Map<string, number>();
    for (const child of EXPECTED_CONTACT_CHILDREN) before.set(child, await count(exec, child));

    await exec.execAsync("ALTER TABLE contacts RENAME TO contacts_old");
    await exec.execAsync(CREATE_CONTACTS_V9);
    const legacyContacts = await copyContacts(exec, deps);

    for (const child of EXPECTED_CONTACT_CHILDREN) {
      await exec.execAsync(`ALTER TABLE ${child} RENAME TO ${child}_old`);
      await exec.execAsync(CHILD_DDL[child]);
      const columns = CHILD_COPY_COLUMNS[child];
      await exec.execAsync(`INSERT INTO ${child} (${columns}) SELECT ${columns} FROM ${child}_old`);
      await exec.execAsync(`DROP TABLE ${child}_old`);
      if ((await count(exec, child)) !== before.get(child)) {
        throw new Error(`migration 009 failed to preserve ${child} rows`);
      }
    }
    await exec.execAsync("CREATE INDEX idx_interactions_recency ON interactions (contact_id, occurred_at DESC)");

    await exec.execAsync(`
      CREATE TABLE contact_methods (
        id INTEGER PRIMARY KEY, uid TEXT NOT NULL UNIQUE,
        contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        method_type TEXT NOT NULL CHECK (method_type IN ('phone', 'email')),
        raw_value TEXT NOT NULL, display_value TEXT NOT NULL, canonical_value TEXT,
        canonical_region TEXT, extension TEXT, is_actionable INTEGER NOT NULL DEFAULT 0 CHECK (is_actionable IN (0, 1)),
        is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)), display_order INTEGER NOT NULL,
        created_at TEXT NOT NULL, modified_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX idx_contact_methods_primary_type ON contact_methods (contact_id, method_type) WHERE is_primary = 1;
      CREATE INDEX idx_contact_methods_order ON contact_methods (contact_id, method_type, display_order);
      CREATE TABLE external_contact_links (
        id INTEGER PRIMARY KEY, uid TEXT NOT NULL UNIQUE,
        contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        provider TEXT NOT NULL, external_contact_id TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at TEXT NOT NULL, modified_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX idx_external_contact_links_active ON external_contact_links (provider, external_contact_id) WHERE is_active = 1;
      CREATE TABLE contact_method_provenance (
        id INTEGER PRIMARY KEY, uid TEXT NOT NULL UNIQUE,
        method_id INTEGER NOT NULL REFERENCES contact_methods(id) ON DELETE CASCADE,
        external_contact_link_id INTEGER REFERENCES external_contact_links(id) ON DELETE SET NULL,
        source_method_id TEXT, created_at TEXT NOT NULL, modified_at TEXT NOT NULL
      );
    `);
    await createMethods(exec, legacyContacts, deps);
    await exec.execAsync("DROP TABLE contacts_old");

    const foreignKeyFailures = await exec.getAllAsync("PRAGMA foreign_key_check");
    if (foreignKeyFailures.length !== 0) throw new Error("migration 009 foreign-key integrity check failed");
  },
};
