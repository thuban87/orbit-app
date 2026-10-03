-- Minimal subset of the real schema (src/db/migrations) that fixture_manifest.py reads.
CREATE TABLE contacts (id INTEGER PRIMARY KEY, uid TEXT, name TEXT, interval_days INTEGER,
  tracking_enabled INTEGER NOT NULL DEFAULT 1, rarely_responds INTEGER NOT NULL DEFAULT 0,
  last_contact TEXT, archived_at TEXT, photo TEXT, ring_seq INTEGER, created_at TEXT NOT NULL);
CREATE TABLE systems (id INTEGER PRIMARY KEY, uid TEXT UNIQUE, name TEXT);
CREATE TABLE system_rules (id INTEGER PRIMARY KEY, system_id INTEGER, family TEXT, value TEXT);
CREATE TABLE system_overrides (id INTEGER PRIMARY KEY, system_ref TEXT, contact_id INTEGER, mode TEXT);
CREATE TABLE app_settings (id INTEGER PRIMARY KEY, orrery_density TEXT, orrery_satellites_enabled INTEGER,
  orrery_last_system TEXT, sun_contact_id INTEGER);
