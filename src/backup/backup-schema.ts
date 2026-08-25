import {
  BACKUP_FORMAT_VERSION,
  type BackupManifest,
  BackupSchemaError,
} from "@/backup/types";

/** Displayed before any preview or restore work for a file from a newer app. */
export const UPDATE_FIRST_MESSAGE = "This backup was made by a newer version of Orbit. Update the app first.";
export const MAX_SUPPORTED_BACKUP_FORMAT_VERSION = BACKUP_FORMAT_VERSION;

type RawManifest = Record<string, unknown>;
type Migration = (manifest: RawManifest) => RawManifest;

/**
 * Closed, one-step forward migration registry. Add exactly one entry whenever
 * the portable wire shape changes; SQLite's user_version is intentionally absent.
 */
const FORWARD_MIGRATIONS: Readonly<Record<number, Migration>> = {};

function fail(message: string): never {
  throw new BackupSchemaError(message);
}

function record(value: unknown, label: string): RawManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value as RawManifest;
}

function array(value: unknown, label: string): RawManifest[] {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value.map((item, index) => record(item, `${label}[${index}]`));
}

function uidSet(rows: RawManifest[], label: string): Set<string> {
  const seen = new Set<string>();
  for (const row of rows) {
    const uid = row.uid;
    if (typeof uid !== "string" || uid.length === 0) fail(`${label} has an invalid uid`);
    if (seen.has(uid)) fail(`${label} has a duplicate uid`);
    seen.add(uid);
  }
  return seen;
}

function validate(manifest: RawManifest): BackupManifest {
  const requiredArrays = [
    "categories", "contacts", "interactions", "events", "fuel", "contactLinks", "customFieldDefs", "customFieldValues", "tombstones",
  ] as const;
  const arrays = Object.fromEntries(requiredArrays.map((key) => [key, array(manifest[key], key)])) as Record<(typeof requiredArrays)[number], RawManifest[]>;
  const contacts = uidSet(arrays.contacts, "contacts");
  const categories = uidSet(arrays.categories, "categories");
  const defs = uidSet(arrays.customFieldDefs, "customFieldDefs");
  for (const key of ["categories", "interactions", "events", "fuel", "contactLinks", "customFieldValues"] as const) uidSet(arrays[key], key);
  const settings = record(manifest.appSettings, "appSettings");
  if (settings.sunContactUid !== null && (typeof settings.sunContactUid !== "string" || !contacts.has(settings.sunContactUid))) {
    fail("appSettings has an unknown sun contact UID");
  }
  const pairs = new Set<string>();
  for (const contact of arrays.contacts) {
    if (contact.categoryUid !== null && contact.categoryUid !== undefined && (typeof contact.categoryUid !== "string" || !categories.has(contact.categoryUid))) {
      fail("contacts has an unknown category UID");
    }
  }
  for (const [label, rows] of Object.entries({ interactions: arrays.interactions, events: arrays.events, fuel: arrays.fuel, contactLinks: arrays.contactLinks })) {
    for (const row of rows) {
      if (typeof row.contactUid !== "string" || !contacts.has(row.contactUid)) fail(`${label} has an unknown contact UID`);
    }
  }
  for (const value of arrays.customFieldValues) {
    if (typeof value.contactUid !== "string" || !contacts.has(value.contactUid)) fail("customFieldValues has an unknown contact UID");
    if (typeof value.fieldDefUid !== "string" || !defs.has(value.fieldDefUid)) fail("customFieldValues has an unknown field definition UID");
    const pair = `${value.contactUid}\u0000${value.fieldDefUid}`;
    if (pairs.has(pair)) fail("customFieldValues has a duplicate custom value pair");
    pairs.add(pair);
  }
  const profile = manifest.profile === null ? null : record(manifest.profile, "profile");
  const metadata = record(manifest.metadata, "metadata");
  if (typeof metadata.exportedAt !== "string") fail("metadata has an invalid exportedAt");
  if (metadata.sqliteUserVersion !== null && !Number.isInteger(metadata.sqliteUserVersion)) fail("metadata has an invalid SQLite version");
  if (!Number.isInteger(manifest.envelopeVersion)) fail("envelopeVersion must be an integer");
  const tombstoneKeys = new Set<string>();
  const tombstones = arrays.tombstones.map((row) => {
    if (typeof row.entityType !== "string" || typeof row.entityUid !== "string" || typeof row.deletedAt !== "string") fail("tombstones has an invalid row");
    const key = `${row.entityType}\u0000${row.entityUid}`;
    if (tombstoneKeys.has(key)) fail("tombstones has a duplicate entity UID");
    tombstoneKeys.add(key);
    return { entityType: row.entityType, entityUid: row.entityUid, deletedAt: row.deletedAt };
  });
  return {
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    envelopeVersion: manifest.envelopeVersion as number,
    metadata: { exportedAt: metadata.exportedAt as string, sqliteUserVersion: metadata.sqliteUserVersion as number | null },
    appSettings: settings as BackupManifest["appSettings"],
    categories: arrays.categories,
    profile,
    contacts: arrays.contacts,
    interactions: arrays.interactions,
    events: arrays.events,
    fuel: arrays.fuel,
    contactLinks: arrays.contactLinks,
    customFieldDefs: arrays.customFieldDefs,
    customFieldValues: arrays.customFieldValues,
    tombstones,
  };
}

/** Parse, migrate forward, then strictly validate a portable plaintext manifest. */
export function parseBackupManifest(input: unknown): BackupManifest {
  let manifest = record(input, "backup");
  const version = manifest.backupFormatVersion ?? 1;
  if (!Number.isInteger(version) || (version as number) < 1) fail("backupFormatVersion must be a positive integer");
  if ((version as number) > MAX_SUPPORTED_BACKUP_FORMAT_VERSION) fail(UPDATE_FIRST_MESSAGE);
  for (let from = version as number; from < MAX_SUPPORTED_BACKUP_FORMAT_VERSION; from += 1) {
    const migrate = FORWARD_MIGRATIONS[from];
    if (!migrate) fail(`missing forward migration from backup format ${from}`);
    manifest = migrate(manifest);
  }
  return validate({ ...manifest, backupFormatVersion: MAX_SUPPORTED_BACKUP_FORMAT_VERSION });
}
