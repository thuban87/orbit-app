/**
 * Migration 1 — the irreversible initial schema (DATA-02 / DATA-03).
 *
 * This is the single most consequential change in the project: there is no
 * remote DB access, so any structural mistake here is PERMANENT on devices we
 * cannot reach. Every un-backfillable column (a distinct `uid` + `created_at` +
 * `modified_at` on each mergeable table, `contacts.ring_seq`,
 * `interactions.recorded_at`/`source`, `custom_field_defs.display_order`/
 * `share_with_ai`) MUST exist from day one — adding a column later cannot
 * back-fill history. The DDL below is transcribed VERBATIM from
 * RESEARCH §Code Example 1b (the authoritative source).
 *
 * Two carve-ins are OWNER DECISIONS, not to be re-opened:
 *   - The custom-fields TABLES (`custom_field_defs`, `contact_custom_values`,
 *     `field_history`) ship here; the custom-fields LOGIC is Phase 3
 *     (HANDOFF §15 #3 / §14.10).
 *   - The `fuel` table ships here EMPTY with FUEL-01's columns; the fuel
 *     FEATURE is Phase 7 (owner decision 2026-08-14, RESEARCH Q1/A1).
 *
 * Custom-fields storage is the TWO-TABLE model (HANDOFF §14.1): a field is a
 * ROW in `custom_field_defs` and (from Phase 3) a COLUMN in
 * `contact_custom_values`. Value columns are declared TEXT forever and are
 * added in Phase 3 — this migration creates `contact_custom_values` with ONLY
 * its `contact_id` PK, the merge-key `uid`, and `modified_at`. The
 * index/UNIQUE ban on `contact_custom_values` is VALUE-COLUMN-SCOPED
 * (HANDOFF §14.11): `DROP COLUMN` fails on an indexed/UNIQUE column and only
 * VALUE columns are dropped at Phase-3 quarantine expiry, so the merge-key
 * `uid TEXT UNIQUE` autoindex is EXEMPT and CORRECT — never add an index or
 * UNIQUE to a value column. Phase 3 (DROP COLUMN) inherits this scoping.
 *
 * Seeds run in the SAME migration-1 transaction (the runner wraps each step):
 * four categories (Family/Friends/Work/Community, display_order 0..3) and the
 * single profile/self row (id=1). Every seed value is bound with `?`; only the
 * runner's integer `user_version` bump is interpolated. This module imports no
 * expo-sqlite — it operates on the injected `SqlExecutor`.
 */
import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

// --- Table DDL (verbatim from RESEARCH §Code Example 1b) ---------------------

export const CREATE_CATEGORIES = `
CREATE TABLE categories (
  id            INTEGER PRIMARY KEY,
  uid           TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  created_at    TEXT NOT NULL,
  modified_at   TEXT NOT NULL
);`;

export const CREATE_PROFILE = `
CREATE TABLE profile (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  uid         TEXT NOT NULL UNIQUE,
  name        TEXT,
  photo       TEXT,
  created_at  TEXT NOT NULL,
  modified_at TEXT NOT NULL
);`;

export const CREATE_CONTACTS = `
CREATE TABLE contacts (
  id             INTEGER PRIMARY KEY,
  uid            TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  category_id    INTEGER REFERENCES categories(id),
  interval_days  INTEGER NOT NULL,
  social_battery TEXT,
  birthday       TEXT,
  phone          TEXT,
  email          TEXT,
  photo          TEXT,
  last_contact   TEXT,
  favourite_rank INTEGER,
  ring_seq       INTEGER,
  archived_at    TEXT,
  snooze_until   TEXT,
  rarely_responds INTEGER NOT NULL DEFAULT 0,
  reminders_off   INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  modified_at    TEXT NOT NULL
);`;

export const CREATE_CONTACT_LINKS = `
CREATE TABLE contact_links (
  id            INTEGER PRIMARY KEY,
  uid           TEXT NOT NULL UNIQUE,
  contact_id    INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  label         TEXT,
  display_order INTEGER NOT NULL,
  created_at    TEXT NOT NULL,
  modified_at   TEXT NOT NULL
);`;

export const CREATE_INTERACTIONS = `
CREATE TABLE interactions (
  id          INTEGER PRIMARY KEY,
  uid         TEXT NOT NULL UNIQUE,
  contact_id  INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  occurred_at TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  channel     TEXT NOT NULL DEFAULT 'unspecified',
  direction   TEXT,
  connected   INTEGER NOT NULL DEFAULT 1,
  quality     TEXT,
  note        TEXT,
  source      TEXT NOT NULL,
  modified_at TEXT NOT NULL
);`;

export const CREATE_INTERACTIONS_INDEX = `
CREATE INDEX idx_interactions_recency ON interactions (contact_id, occurred_at DESC);`;

export const CREATE_EVENTS = `
CREATE TABLE events (
  id          INTEGER PRIMARY KEY,
  uid         TEXT NOT NULL UNIQUE,
  contact_id  INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  detail      TEXT,
  recorded_at TEXT NOT NULL,
  modified_at TEXT NOT NULL
);`;

export const CREATE_CUSTOM_FIELD_DEFS = `
CREATE TABLE custom_field_defs (
  id             INTEGER PRIMARY KEY,
  uid            TEXT NOT NULL UNIQUE,
  col_name       TEXT NOT NULL UNIQUE,
  label          TEXT NOT NULL,
  type           TEXT NOT NULL,
  options        TEXT,
  show_on_new    INTEGER NOT NULL DEFAULT 0,
  always_show    INTEGER NOT NULL DEFAULT 0,
  display_order  INTEGER NOT NULL,
  quarantined_at TEXT,
  share_with_ai  INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  modified_at    TEXT NOT NULL
);`;

// contact_custom_values ships with NO value columns (added Phase 3, TEXT forever).
// NEVER add an index or UNIQUE to a value column — it breaks DROP COLUMN at
// Phase-3 quarantine expiry (HANDOFF §14.11). The merge-key `uid UNIQUE` is
// exempt: the ban is value-column-scoped.
export const CREATE_CONTACT_CUSTOM_VALUES = `
CREATE TABLE contact_custom_values (
  contact_id  INTEGER PRIMARY KEY REFERENCES contacts(id) ON DELETE CASCADE,
  uid         TEXT NOT NULL UNIQUE,
  modified_at TEXT NOT NULL
);`;

export const CREATE_FIELD_HISTORY = `
CREATE TABLE field_history (
  id             INTEGER PRIMARY KEY,
  contact_id     INTEGER NOT NULL,
  field_col_name TEXT NOT NULL,
  old_value      TEXT,
  operation      TEXT NOT NULL,
  created_at     TEXT NOT NULL
);`;

// fuel ships EMPTY in migration 1 (owner decision 2026-08-14); FUEL-01 columns.
// The fuel feature is Phase 7 — this migration only creates the table.
export const CREATE_FUEL = `
CREATE TABLE fuel (
  id          INTEGER PRIMARY KEY,
  uid         TEXT NOT NULL UNIQUE,
  contact_id  INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  label       TEXT,
  text        TEXT,
  url         TEXT,
  created_at  TEXT NOT NULL,
  source      TEXT NOT NULL,
  modified_at TEXT NOT NULL
);`;

/** Every CREATE statement, in dependency order (parents before FK children). */
export const CREATE_STATEMENTS: readonly string[] = [
  CREATE_CATEGORIES,
  CREATE_PROFILE,
  CREATE_CONTACTS,
  CREATE_CONTACT_LINKS,
  CREATE_INTERACTIONS,
  CREATE_INTERACTIONS_INDEX,
  CREATE_EVENTS,
  CREATE_CUSTOM_FIELD_DEFS,
  CREATE_CONTACT_CUSTOM_VALUES,
  CREATE_FIELD_HISTORY,
  CREATE_FUEL,
];

/** Seed category names in display order (0..3). */
export const SEED_CATEGORIES: readonly string[] = [
  "Family",
  "Friends",
  "Work",
  "Community",
];

/**
 * Migration 1 — creates every core table + un-backfillable column, then seeds
 * the four categories and the single profile row. Runs inside the runner's
 * per-step transaction; DDL and seeds commit atomically with the
 * `user_version` bump.
 */
export const migration001: Migration = {
  version: 1,
  async apply(exec: SqlExecutor, deps: MigrationDeps): Promise<void> {
    for (const statement of CREATE_STATEMENTS) {
      await exec.execAsync(statement);
    }

    // Seed the four categories (display_order 0..3). Every value bound with `?`.
    for (let i = 0; i < SEED_CATEGORIES.length; i++) {
      await exec.runAsync(
        `INSERT INTO categories (uid, name, display_order, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?)`,
        [deps.newUid(), SEED_CATEGORIES[i], i, deps.now, deps.now],
      );
    }

    // Seed the single profile/self row (id=1).
    await exec.runAsync(
      `INSERT INTO profile (id, uid, created_at, modified_at)
       VALUES (?, ?, ?, ?)`,
      [1, deps.newUid(), deps.now, deps.now],
    );
  },
};
