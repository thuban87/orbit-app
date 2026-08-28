import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

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

type DirectContactChild = (typeof DIRECT_CONTACT_CHILDREN)[number];

const CREATE_CONTACTS_V11 = `
CREATE TABLE contacts (
  id              INTEGER PRIMARY KEY,
  uid             TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  category_id     INTEGER REFERENCES categories(id),
  interval_days   INTEGER,
  tracking_enabled INTEGER NOT NULL DEFAULT 1,
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
  modified_at     TEXT NOT NULL,
  CHECK (interval_days IS NULL OR (typeof(interval_days) = 'integer' AND interval_days > 0)),
  CHECK (tracking_enabled = 0 OR interval_days IS NOT NULL)
);`;

const CREATE_APP_SETTINGS_V11 = `
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
  created_at TEXT NOT NULL, modified_at TEXT NOT NULL,
  include_unbound_never_contacted INTEGER NOT NULL DEFAULT 0,
  birthday_unbound_enabled INTEGER NOT NULL DEFAULT 1
);`;

const CHILD_DDL: Record<DirectContactChild, string> = {
  app_settings: CREATE_APP_SETTINGS_V11,
  contact_links: `CREATE TABLE contact_links (
    id INTEGER PRIMARY KEY, uid TEXT NOT NULL UNIQUE,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    url TEXT NOT NULL, label TEXT, display_order INTEGER NOT NULL,
    created_at TEXT NOT NULL, modified_at TEXT NOT NULL
  );`,
  custom_field_values: `CREATE TABLE custom_field_values (
    id INTEGER PRIMARY KEY, uid TEXT NOT NULL UNIQUE,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    field_def_id INTEGER NOT NULL REFERENCES custom_field_defs(id) ON DELETE CASCADE,
    value TEXT, created_at TEXT NOT NULL, modified_at TEXT NOT NULL,
    UNIQUE(contact_id, field_def_id)
  );`,
  events: `CREATE TABLE events (
    id INTEGER PRIMARY KEY, uid TEXT NOT NULL UNIQUE,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    type TEXT NOT NULL, occurred_at TEXT NOT NULL, detail TEXT,
    recorded_at TEXT NOT NULL, modified_at TEXT NOT NULL
  );`,
  fuel: `CREATE TABLE fuel (
    id INTEGER PRIMARY KEY, uid TEXT NOT NULL UNIQUE,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    kind TEXT NOT NULL, label TEXT, text TEXT, url TEXT,
    created_at TEXT NOT NULL, source TEXT NOT NULL, modified_at TEXT NOT NULL
  );`,
  interactions: `CREATE TABLE interactions (
    id INTEGER PRIMARY KEY, uid TEXT NOT NULL UNIQUE,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    occurred_at TEXT NOT NULL, recorded_at TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'unspecified', direction TEXT,
    connected INTEGER NOT NULL DEFAULT 1, quality TEXT, note TEXT,
    source TEXT NOT NULL, modified_at TEXT NOT NULL
  );`,
  contact_methods: `CREATE TABLE contact_methods (
    id INTEGER PRIMARY KEY, uid TEXT NOT NULL UNIQUE,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    method_type TEXT NOT NULL CHECK (method_type IN ('phone', 'email')),
    raw_value TEXT NOT NULL, display_value TEXT NOT NULL, canonical_value TEXT,
    canonical_region TEXT, extension TEXT,
    is_actionable INTEGER NOT NULL DEFAULT 0 CHECK (is_actionable IN (0, 1)),
    is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
    display_order INTEGER NOT NULL, created_at TEXT NOT NULL, modified_at TEXT NOT NULL,
    label TEXT
  );`,
  external_contact_links: `CREATE TABLE external_contact_links (
    id INTEGER PRIMARY KEY, uid TEXT NOT NULL UNIQUE,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, external_contact_id TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL, modified_at TEXT NOT NULL
  );`,
};

const CHILD_COPY_COLUMNS: Record<DirectContactChild, string> = {
  app_settings:
    "id, notifications_enabled, decay_enabled, birthday_enabled, lockscreen_public, delivery_hour, quiet_start_hour, quiet_end_hour, sun_contact_id, self_sun_colour, ai_provider, ai_model, ai_custom_endpoint, ai_custom_model, ai_prompt_template, ai_ack_openai, ai_ack_anthropic, ai_ack_google, ai_ack_custom, digest_enabled, data_revision, backup_interval_days, backup_retention_days, backup_folder_uri, backup_folder_name, backup_folder_accessible, backup_folder_diagnostic, last_automatic_backup_at, last_backup_data_revision, encryption_enabled, backup_nudge_dismissed, phone_region_override, created_at, modified_at",
  contact_links:
    "id, uid, contact_id, url, label, display_order, created_at, modified_at",
  custom_field_values:
    "id, uid, contact_id, field_def_id, value, created_at, modified_at",
  events:
    "id, uid, contact_id, type, occurred_at, detail, recorded_at, modified_at",
  fuel: "id, uid, contact_id, kind, label, text, url, created_at, source, modified_at",
  interactions:
    "id, uid, contact_id, occurred_at, recorded_at, channel, direction, connected, quality, note, source, modified_at",
  contact_methods:
    "id, uid, contact_id, method_type, raw_value, display_value, canonical_value, canonical_region, extension, is_actionable, is_primary, display_order, created_at, modified_at, label",
  external_contact_links:
    "id, uid, contact_id, provider, external_contact_id, is_active, created_at, modified_at",
};

const CONTACT_COLUMNS =
  "id, uid, name, category_id, interval_days, social_battery, birthday, photo, last_contact, favourite_rank, ring_seq, archived_at, snooze_until, rarely_responds, reminders_off, created_at, modified_at";

async function count(exec: SqlExecutor, table: string): Promise<number> {
  const row = await exec.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM ${table}`,
  );
  return row?.count ?? 0;
}

async function assertDirectChildren(exec: SqlExecutor): Promise<void> {
  const tables = await exec.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  );
  const actual: string[] = [];
  for (const { name } of tables) {
    const foreignKeys = await exec.getAllAsync<{ table: string }>(
      `PRAGMA foreign_key_list(${name})`,
    );
    if (foreignKeys.some((foreignKey) => foreignKey.table === "contacts"))
      actual.push(name);
  }
  if (
    actual.sort().join(",") !== [...DIRECT_CONTACT_CHILDREN].sort().join(",")
  ) {
    throw new Error(
      `migration 011 contact child set changed: ${actual.join(",")}`,
    );
  }
}

async function recreateIndexes(exec: SqlExecutor): Promise<void> {
  await exec.execAsync(`
    CREATE INDEX idx_interactions_recency ON interactions (contact_id, occurred_at DESC);
    CREATE UNIQUE INDEX idx_contact_methods_primary_type ON contact_methods (contact_id, method_type) WHERE is_primary = 1;
    CREATE INDEX idx_contact_methods_order ON contact_methods (contact_id, method_type, display_order);
    CREATE UNIQUE INDEX idx_external_contact_links_active ON external_contact_links (provider, external_contact_id) WHERE is_active = 1;
    CREATE TRIGGER contacts_prevent_cadence_clear
    BEFORE UPDATE OF interval_days ON contacts
    WHEN OLD.interval_days IS NOT NULL AND NEW.interval_days IS NULL
    BEGIN
      SELECT RAISE(ABORT, 'assigned interval_days cannot be cleared');
    END;
  `);
}

export const migration011: Migration = {
  version: 11,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync("PRAGMA defer_foreign_keys = ON");
    await assertDirectChildren(exec);
    const beforeContacts = await count(exec, "contacts");
    const beforeChildren = new Map<DirectContactChild, number>();
    for (const child of DIRECT_CONTACT_CHILDREN)
      beforeChildren.set(child, await count(exec, child));

    await exec.execAsync("ALTER TABLE contacts RENAME TO contacts_old");
    await exec.execAsync(CREATE_CONTACTS_V11);
    await exec.execAsync(
      `INSERT INTO contacts (${CONTACT_COLUMNS}) SELECT ${CONTACT_COLUMNS} FROM contacts_old`,
    );

    // This child targets contact_methods, not contacts. It retains the identical
    // schema and values after the direct child rebuild below retargets SQLite DDL.
    await exec.execAsync(
      "ALTER TABLE contact_method_provenance RENAME TO contact_method_provenance_old",
    );
    for (const child of DIRECT_CONTACT_CHILDREN) {
      await exec.execAsync(`ALTER TABLE ${child} RENAME TO ${child}_old`);
      await exec.execAsync(CHILD_DDL[child]);
      const columns = CHILD_COPY_COLUMNS[child];
      await exec.execAsync(
        `INSERT INTO ${child} (${columns}) SELECT ${columns} FROM ${child}_old`,
      );
      // Keep the two direct parents until their transitive provenance rows have
      // been copied below; dropping either old parent would fire its FK action.
      if (child !== "contact_methods" && child !== "external_contact_links") {
        await exec.execAsync(`DROP TABLE ${child}_old`);
      }
      if ((await count(exec, child)) !== beforeChildren.get(child)) {
        throw new Error(`migration 011 failed to preserve ${child} rows`);
      }
    }
    await exec.execAsync(`
      CREATE TABLE contact_method_provenance (
        id INTEGER PRIMARY KEY, uid TEXT NOT NULL UNIQUE,
        method_id INTEGER NOT NULL REFERENCES contact_methods(id) ON DELETE CASCADE,
        external_contact_link_id INTEGER REFERENCES external_contact_links(id) ON DELETE SET NULL,
        source_method_id TEXT, created_at TEXT NOT NULL, modified_at TEXT NOT NULL
      );
      INSERT INTO contact_method_provenance (id, uid, method_id, external_contact_link_id, source_method_id, created_at, modified_at)
        SELECT id, uid, method_id, external_contact_link_id, source_method_id, created_at, modified_at
        FROM contact_method_provenance_old;
      DROP TABLE contact_method_provenance_old;
      DROP TABLE contact_methods_old;
      DROP TABLE external_contact_links_old;
    `);
    await recreateIndexes(exec);
    await exec.execAsync("DROP TABLE contacts_old");
    if ((await count(exec, "contacts")) !== beforeContacts)
      throw new Error("migration 011 failed to preserve contacts rows");
    await assertDirectChildren(exec);
    const foreignKeyFailures = await exec.getAllAsync(
      "PRAGMA foreign_key_check",
    );
    if (foreignKeyFailures.length !== 0)
      throw new Error("migration 011 foreign-key integrity check failed");
  },
};
