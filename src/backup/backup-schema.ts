import {
  BACKUP_FORMAT_VERSION,
  type BackupManifest,
  BackupSchemaError,
} from "@/backup/types";
import { sameFileSurvivorUids } from "@/backup/reconciliation";

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

const PORTABLE_SETTINGS_KEYS = new Set([
  "notificationsEnabled", "decayEnabled", "birthdayEnabled", "digestEnabled",
  "lockscreenPublic", "deliveryHour", "quietStartHour", "quietEndHour",
  "selfSunColour", "aiProvider", "aiModel", "aiCustomEndpoint", "aiCustomModel",
  "aiPromptTemplate", "backupIntervalDays", "backupRetentionDays", "modifiedAt",
  "sunContactUid",
]);

const SECRET_SHAPED_KEY = /(?:api.?key|secret|passphrase|token|credential|password)/i;
const TOMBSTONE_ENTITY_TYPES = new Set([
  "contact",
  "interaction",
  "event",
  "fuel",
  "contact_link",
  "custom_field_def",
  "custom_field_value",
]);

function assertPortableSettings(settings: RawManifest, contacts: Set<string>): void {
  if (typeof settings.modifiedAt !== "string") fail("appSettings has an invalid modifiedAt");
  for (const key of Object.keys(settings)) {
    if (SECRET_SHAPED_KEY.test(key) || !PORTABLE_SETTINGS_KEYS.has(key)) {
      fail("appSettings contains a local-only or secret member");
    }
  }
  if (settings.sunContactUid !== null && (typeof settings.sunContactUid !== "string" || !contacts.has(settings.sunContactUid))) {
    fail("appSettings has an unknown sun contact UID");
  }
}

function validBase64(value: unknown): value is string {
  if (typeof value !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return false;
  // This intentionally verifies byte shape without relying on a native or Node
  // decoder: padding can only appear at the final quantum under the regex.
  return value.length > 0;
}

function reconciliationRows(rows: RawManifest[]): Array<{ uid: string; modified_at: string }> {
  return rows.map((row) => {
    if (typeof row.uid !== "string" || typeof row.modifiedAt !== "string") {
      fail("backup has an invalid live row");
    }
    return { uid: row.uid, modified_at: row.modifiedAt };
  });
}

function survivorsFor(
  rows: RawManifest[],
  tombstones: Array<{ entityType: string; entityUid: string; deletedAt: string }>,
  entityType: string,
): ReadonlySet<string> {
  return sameFileSurvivorUids(
    reconciliationRows(rows),
    tombstones
      .filter((row) => row.entityType === entityType)
      .map((row) => ({ entity_uid: row.entityUid, deleted_at: row.deletedAt })),
  );
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
  assertPortableSettings(settings, contacts);
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
    if (
      typeof row.entityType !== "string"
      || !TOMBSTONE_ENTITY_TYPES.has(row.entityType)
      || typeof row.entityUid !== "string"
      || row.entityUid.length === 0
      || typeof row.deletedAt !== "string"
    ) {
      fail("tombstones has an invalid row");
    }
    const key = `${row.entityType}\u0000${row.entityUid}`;
    if (tombstoneKeys.has(key)) fail("tombstones has a duplicate entity UID");
    tombstoneKeys.add(key);
    return { entityType: row.entityType, entityUid: row.entityUid, deletedAt: row.deletedAt };
  });
  const survivingContacts = survivorsFor(arrays.contacts, tombstones, "contact");
  const survivingDefs = survivorsFor(arrays.customFieldDefs, tombstones, "custom_field_def");
  for (const [label, rows] of Object.entries({ interactions: arrays.interactions, events: arrays.events, fuel: arrays.fuel, contactLinks: arrays.contactLinks })) {
    for (const row of rows) {
      if (!survivingContacts.has(row.contactUid as string)) fail(`${label} has no surviving contact parent`);
    }
  }
  for (const value of arrays.customFieldValues) {
    if (!survivingContacts.has(value.contactUid as string)) fail("customFieldValues has no surviving contact parent");
    if (!survivingDefs.has(value.fieldDefUid as string)) fail("customFieldValues has no surviving field definition parent");
  }
  for (const row of [...arrays.contacts, ...arrays.customFieldValues]) {
    if (row.photoBase64 !== null && row.photoBase64 !== undefined && !validBase64(row.photoBase64)) {
      fail("backup has invalid photo bytes");
    }
  }
  if (profile && profile.photoBase64 !== null && profile.photoBase64 !== undefined && !validBase64(profile.photoBase64)) {
    fail("backup has invalid photo bytes");
  }
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
