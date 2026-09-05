import { sameFileSurvivorUids } from "@/backup/reconciliation";
import {
  BACKUP_FORMAT_VERSION,
  type BackupManifest,
  BackupSchemaError,
} from "@/backup/types";
import {
  isCurrentStateFieldKey,
  isMemoryTypeKey,
} from "@/db/memory-registry";

/** Displayed before any preview or restore work for a file from a newer app. */
export const UPDATE_FIRST_MESSAGE =
  "This backup was made by a newer version of Orbit. Update the app first.";
export const MAX_SUPPORTED_BACKUP_FORMAT_VERSION = BACKUP_FORMAT_VERSION;

type RawManifest = Record<string, unknown>;
type Migration = (manifest: RawManifest) => RawManifest;

/**
 * Closed, one-step forward migration registry. Add exactly one entry whenever
 * the portable wire shape changes; SQLite's user_version is intentionally absent.
 */
const FORWARD_MIGRATIONS: Readonly<Record<number, Migration>> = {
  1: (manifest) => {
    const contacts = Array.isArray(manifest.contacts)
      ? manifest.contacts.map((item) => record(item, "contacts[]"))
      : fail("contacts must be an array");
    const contactMethods: RawManifest[] = [];
    for (const contact of contacts) {
      const uid = contact.uid;
      if (typeof uid !== "string" || uid.length === 0)
        fail("contacts has an invalid uid");
      const { phone, email, ...withoutScalars } = contact;
      for (const [methodType, value] of [
        ["phone", phone],
        ["email", email],
      ] as const) {
        if (typeof value !== "string" || value.trim() === "") continue;
        contactMethods.push({
          uid: `legacy-method:${uid}:${methodType}`,
          contactUid: uid,
          methodType,
          rawValue: value,
          displayValue: value,
          canonicalValue: null,
          canonicalRegion: null,
          label: null,
          extension: null,
          isActionable: 0,
          isPrimary: 1,
          displayOrder: 0,
          createdAt: withoutScalars.createdAt ?? withoutScalars.modifiedAt,
          modifiedAt: withoutScalars.modifiedAt,
        });
      }
      Object.assign(contact, withoutScalars);
      delete contact.phone;
      delete contact.email;
    }
    const settings = record(manifest.appSettings, "appSettings");
    return {
      ...manifest,
      backupFormatVersion: 2,
      appSettings: {
        ...settings,
        phoneRegionOverride: settings.phoneRegionOverride ?? null,
      },
      contacts,
      contactMethods,
      externalContactLinks: [],
      contactMethodProvenance: [],
      tombstones: Array.isArray(manifest.tombstones) ? manifest.tombstones : [],
    };
  },
  2: (manifest) => {
    const contacts = Array.isArray(manifest.contacts)
      ? manifest.contacts.map((item) => {
          const contact = record(item, "contacts[]");
          return { ...contact, trackingEnabled: 1 };
        })
      : fail("contacts must be an array");
    const settings = record(manifest.appSettings, "appSettings");
    return {
      ...manifest,
      backupFormatVersion: 3,
      appSettings: {
        ...settings,
        includeUnboundNeverContacted:
          settings.includeUnboundNeverContacted ?? 0,
        birthdayUnboundEnabled: settings.birthdayUnboundEnabled ?? 1,
      },
      contacts,
    };
  },
  3: (manifest) => ({
    ...manifest,
    backupFormatVersion: 4,
    memories: [],
    relationships: [],
    currentStateEntries: [],
  }),
};

function fail(message: string): never {
  throw new BackupSchemaError(message);
}

function record(value: unknown, label: string): RawManifest {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(`${label} must be an object`);
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
    if (typeof uid !== "string" || uid.length === 0)
      fail(`${label} has an invalid uid`);
    if (seen.has(uid)) fail(`${label} has a duplicate uid`);
    seen.add(uid);
  }
  return seen;
}

export const PORTABLE_SETTINGS_KEYS = new Set([
  "notificationsEnabled",
  "decayEnabled",
  "birthdayEnabled",
  "digestEnabled",
  "interactionAssistEnabled",
  "lockscreenPublic",
  "deliveryHour",
  "quietStartHour",
  "quietEndHour",
  "selfSunColour",
  "aiProvider",
  "aiModel",
  "aiCustomEndpoint",
  "aiCustomModel",
  "aiPromptTemplate",
  "backupIntervalDays",
  "backupRetentionDays",
  "modifiedAt",
  "sunContactUid",
  "phoneRegionOverride",
  "includeUnboundNeverContacted",
  "birthdayUnboundEnabled",
  // Phase 23 theme keys (D-09): allowlisted NOW so a future format-4 backup that
  // CARRIES them is accepted by assertPortableSettings. NOT emitted by
  // getPortableSettingsSnapshot this phase (emission + BACKUP_FORMAT_VERSION bump
  // + FORWARD_MIGRATIONS entry are Phase 36 / owner scope — REVIEWS 23-01 HIGH).
  "themePackage",
  "galaxyMode",
  "standardMode",
  "galaxyAccent",
  "standardAccent",
  "galaxyBackground",
  "standardBackground",
  // Phase 25 dashboard keys: allowlisted NOW so a future format-5 backup can
  // carry them, but getPortableSettingsSnapshot does not emit them yet. Emission,
  // a format bump, and a forward migration remain Phase 36 scope.
  "dashboardViewMode",
  "dashboardPopulations",
  "dashboardFilters",
  "dashboardSort",
]);

const SECRET_SHAPED_KEY =
  /(?:api.?key|secret|passphrase|token|credential|password)/i;
const TOMBSTONE_ENTITY_TYPES = new Set([
  "contact",
  "interaction",
  "event",
  "fuel",
  "contact_link",
  "contact_method",
  "external_contact_link",
  "contact_method_provenance",
  "custom_field_def",
  "custom_field_value",
  "custom_field_value_history",
  "memory",
  "relationship",
  "current_state_entry",
]);

function assertPortableSettings(
  settings: RawManifest,
  contacts: Set<string>,
): void {
  if (typeof settings.modifiedAt !== "string")
    fail("appSettings has an invalid modifiedAt");
  for (const key of Object.keys(settings)) {
    if (SECRET_SHAPED_KEY.test(key) || !PORTABLE_SETTINGS_KEYS.has(key)) {
      fail("appSettings contains a local-only or secret member");
    }
  }
  if (
    settings.sunContactUid !== null &&
    (typeof settings.sunContactUid !== "string" ||
      !contacts.has(settings.sunContactUid))
  ) {
    fail("appSettings has an unknown sun contact UID");
  }
}

function validBase64(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  )
    return false;
  // This intentionally verifies byte shape without relying on a native or Node
  // decoder: padding can only appear at the final quantum under the regex.
  return value.length > 0;
}

function isBinaryFlag(value: unknown): value is 0 | 1 {
  return value === 0 || value === 1;
}

function isNullableBinaryFlag(value: unknown): value is 0 | 1 | null | undefined {
  return value === null || value === undefined || isBinaryFlag(value);
}

function isMemoryProvenance(value: unknown): value is "user" | "import" | "share" {
  return value === "user" || value === "import" || value === "share";
}

function reconciliationRows(
  rows: RawManifest[],
): Array<{ uid: string; modified_at: string }> {
  return rows.map((row) => {
    if (typeof row.uid !== "string" || typeof row.modifiedAt !== "string") {
      fail("backup has an invalid live row");
    }
    return { uid: row.uid, modified_at: row.modifiedAt };
  });
}

function survivorsFor(
  rows: RawManifest[],
  tombstones: Array<{
    entityType: string;
    entityUid: string;
    deletedAt: string;
  }>,
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
    "categories",
    "contacts",
    "contactMethods",
    "externalContactLinks",
    "contactMethodProvenance",
    "interactions",
    "events",
    "fuel",
    "contactLinks",
    "customFieldDefs",
    "customFieldValues",
    "memories",
    "relationships",
    "currentStateEntries",
    "tombstones",
  ] as const;
  const arrays = Object.fromEntries(
    requiredArrays.map((key) => [key, array(manifest[key], key)]),
  ) as Record<(typeof requiredArrays)[number], RawManifest[]>;
  // P07-MED: value-history is an OPTIONAL top-level array. A live format-4 backup
  // that predates this phase lacks the key entirely, and there is no 4->4 forward
  // migration, so normalize a missing array to [] at parse rather than adding it
  // to requiredArrays (which would hard-fail every pre-existing format-4 backup).
  const customFieldValueHistory = array(
    manifest.customFieldValueHistory ?? [],
    "customFieldValueHistory",
  );
  const contacts = uidSet(arrays.contacts, "contacts");
  const categories = uidSet(arrays.categories, "categories");
  const defs = uidSet(arrays.customFieldDefs, "customFieldDefs");
  // Validate the fields the scope-aware restore now branches on (WR-01): a
  // malformed `scope` in a hand-edited backup must not silently bypass
  // assertCompleteIncomingPairs, and a non-string/non-flag value must fail as a
  // clean parse error rather than an opaque bind-time rollback. Absent/null is
  // tolerated for pre-scope format-4 backups (restore defaults global/0/null).
  for (const def of arrays.customFieldDefs) {
    if (
      def.scope !== undefined &&
      def.scope !== null &&
      def.scope !== "global" &&
      def.scope !== "contact"
    )
      fail("customFieldDefs has an invalid scope");
    if (!isNullableBinaryFlag(def.historyRetained))
      fail("customFieldDefs has an invalid history_retained flag");
    if (
      def.fieldGroup !== undefined &&
      def.fieldGroup !== null &&
      typeof def.fieldGroup !== "string"
    )
      fail("customFieldDefs has an invalid field_group");
  }
  for (const key of [
    "categories",
    "contactMethods",
    "externalContactLinks",
    "contactMethodProvenance",
    "interactions",
    "events",
    "fuel",
    "contactLinks",
    "customFieldValues",
    "memories",
    "relationships",
    "currentStateEntries",
  ] as const)
    uidSet(arrays[key], key);
  const settings = record(manifest.appSettings, "appSettings");
  assertPortableSettings(settings, contacts);
  const pairs = new Set<string>();
  for (const contact of arrays.contacts) {
    if (
      contact.intervalDays !== null &&
      (!Number.isInteger(contact.intervalDays) ||
        (contact.intervalDays as number) <= 0)
    )
      fail("contacts has an invalid intervalDays");
    if (contact.trackingEnabled !== 0 && contact.trackingEnabled !== 1)
      fail("contacts has an invalid trackingEnabled");
    if (contact.trackingEnabled === 1 && contact.intervalDays === null)
      fail("Bound contacts require an intervalDays");
    if (
      contact.categoryUid !== null &&
      contact.categoryUid !== undefined &&
      (typeof contact.categoryUid !== "string" ||
        !categories.has(contact.categoryUid))
    ) {
      fail("contacts has an unknown category UID");
    }
  }
  for (const method of arrays.contactMethods) {
    if (
      typeof method.contactUid !== "string" ||
      !contacts.has(method.contactUid)
    )
      fail("contactMethods has an unknown contact UID");
    if (method.methodType !== "phone" && method.methodType !== "email")
      fail("contactMethods has an invalid method type");
    for (const key of [
      "rawValue",
      "displayValue",
      "createdAt",
      "modifiedAt",
    ] as const)
      if (typeof method[key] !== "string")
        fail("contactMethods has an invalid row");
    for (const key of [
      "canonicalValue",
      "canonicalRegion",
      "label",
      "extension",
    ] as const)
      if (
        method[key] !== undefined &&
        method[key] !== null &&
        typeof method[key] !== "string"
      )
        fail("contactMethods has an invalid optional value");
    if (method.isActionable !== 0 && method.isActionable !== 1)
      fail("contactMethods has an invalid actionability");
    if (method.isPrimary !== 0 && method.isPrimary !== 1)
      fail("contactMethods has an invalid primary flag");
    if (!Number.isInteger(method.displayOrder))
      fail("contactMethods has an invalid display order");
  }
  for (const link of arrays.externalContactLinks) {
    if (
      typeof link.contactUid !== "string" ||
      !contacts.has(link.contactUid) ||
      typeof link.provider !== "string" ||
      typeof link.externalContactId !== "string" ||
      typeof link.createdAt !== "string" ||
      typeof link.modifiedAt !== "string" ||
      (link.isActive !== 0 && link.isActive !== 1)
    )
      fail("externalContactLinks has an invalid row");
  }
  const methods = uidSet(arrays.contactMethods, "contactMethods");
  const externalLinks = uidSet(
    arrays.externalContactLinks,
    "externalContactLinks",
  );
  for (const provenance of arrays.contactMethodProvenance) {
    if (
      typeof provenance.methodUid !== "string" ||
      !methods.has(provenance.methodUid) ||
      (provenance.externalContactLinkUid !== null &&
        provenance.externalContactLinkUid !== undefined &&
        (typeof provenance.externalContactLinkUid !== "string" ||
          !externalLinks.has(provenance.externalContactLinkUid))) ||
      (provenance.sourceMethodId !== null &&
        provenance.sourceMethodId !== undefined &&
        typeof provenance.sourceMethodId !== "string") ||
      typeof provenance.createdAt !== "string" ||
      typeof provenance.modifiedAt !== "string"
    )
      fail("contactMethodProvenance has an invalid row");
  }
  for (const [label, rows] of Object.entries({
    interactions: arrays.interactions,
    events: arrays.events,
    fuel: arrays.fuel,
    contactLinks: arrays.contactLinks,
  })) {
    for (const row of rows) {
      if (typeof row.contactUid !== "string" || !contacts.has(row.contactUid))
        fail(`${label} has an unknown contact UID`);
    }
  }
  for (const value of arrays.customFieldValues) {
    if (typeof value.contactUid !== "string" || !contacts.has(value.contactUid))
      fail("customFieldValues has an unknown contact UID");
    if (typeof value.fieldDefUid !== "string" || !defs.has(value.fieldDefUid))
      fail("customFieldValues has an unknown field definition UID");
    const pair = `${value.contactUid}\u0000${value.fieldDefUid}`;
    if (pairs.has(pair))
      fail("customFieldValues has a duplicate custom value pair");
    pairs.add(pair);
  }
  uidSet(customFieldValueHistory, "customFieldValueHistory");
  for (const history of customFieldValueHistory) {
    if (typeof history.contactUid !== "string" || !contacts.has(history.contactUid))
      fail("customFieldValueHistory has an unknown contact UID");
    if (typeof history.fieldDefUid !== "string" || !defs.has(history.fieldDefUid))
      fail("customFieldValueHistory has an unknown field definition UID");
  }
  for (const memory of arrays.memories) {
    if (typeof memory.contactUid !== "string" || !contacts.has(memory.contactUid))
      fail("memories has an unknown contact UID");
    for (const key of ["type", "createdAt", "modifiedAt"] as const)
      if (typeof memory[key] !== "string") fail("memories has an invalid row");
    for (const key of ["customLabel", "value", "note", "url", "meaningfulDate", "deletedAt"] as const)
      if (memory[key] !== null && memory[key] !== undefined && typeof memory[key] !== "string")
        fail("memories has an invalid optional value");
    const type = memory.type;
    if (typeof type !== "string" || !isMemoryTypeKey(type))
      fail("memories has an unregistered type");
    const customLabel = memory.customLabel;
    const value = memory.value;
    if (
      type === "custom" &&
      (typeof customLabel !== "string" || customLabel.trim().length === 0)
    ) {
      fail("memories custom type requires a label");
    }
    if (
      (typeof customLabel !== "string" || customLabel.trim().length === 0) &&
      (typeof value !== "string" || value.trim().length === 0)
    ) {
      fail("memories requires a value or custom label");
    }
    if (!isBinaryFlag(memory.pinned) || !isBinaryFlag(memory.outdated) || !isNullableBinaryFlag(memory.hidden))
      fail("memories has an invalid flag");
    if (!isMemoryProvenance(memory.provenance))
      fail("memories has an invalid provenance");
  }
  for (const relationship of arrays.relationships) {
    if (typeof relationship.contactUid !== "string" || !contacts.has(relationship.contactUid) || typeof relationship.personName !== "string" || typeof relationship.createdAt !== "string" || typeof relationship.modifiedAt !== "string")
      fail("relationships has an invalid row");
    if (relationship.personName.trim().length === 0)
      fail("relationships requires a person name");
    for (const key of ["relationType", "note", "deletedAt"] as const)
      if (relationship[key] !== null && relationship[key] !== undefined && typeof relationship[key] !== "string")
        fail("relationships has an invalid optional value");
    if (relationship.linkedContactUid !== null && relationship.linkedContactUid !== undefined && (typeof relationship.linkedContactUid !== "string" || !contacts.has(relationship.linkedContactUid)))
      fail("relationships has an unknown linked contact UID");
    if (relationship.linkedContactUid === relationship.contactUid)
      fail("relationships cannot link a contact to itself");
    if (!isBinaryFlag(relationship.pinned) || !isNullableBinaryFlag(relationship.hidden))
      fail("relationships has an invalid flag");
  }
  const currentPairs = new Set<string>();
  for (const entry of arrays.currentStateEntries) {
    if (typeof entry.contactUid !== "string" || !contacts.has(entry.contactUid) || typeof entry.fieldKey !== "string" || typeof entry.value !== "string" || typeof entry.createdAt !== "string" || typeof entry.modifiedAt !== "string" || (entry.isCurrent !== 0 && entry.isCurrent !== 1))
      fail("currentStateEntries has an invalid row");
    if (!isCurrentStateFieldKey(entry.fieldKey))
      fail("currentStateEntries has an unregistered field key");
    if (entry.value.trim().length === 0)
      fail("currentStateEntries has a blank value");
    if (entry.isCurrent === 1) {
      const pair = `${entry.contactUid}\u0000${entry.fieldKey}`;
      if (currentPairs.has(pair)) fail("currentStateEntries has duplicate current value");
      currentPairs.add(pair);
    }
  }
  const profile =
    manifest.profile === null ? null : record(manifest.profile, "profile");
  const metadata = record(manifest.metadata, "metadata");
  if (typeof metadata.exportedAt !== "string")
    fail("metadata has an invalid exportedAt");
  if (
    metadata.sqliteUserVersion !== null &&
    !Number.isInteger(metadata.sqliteUserVersion)
  )
    fail("metadata has an invalid SQLite version");
  if (!Number.isInteger(manifest.envelopeVersion))
    fail("envelopeVersion must be an integer");
  const tombstoneKeys = new Set<string>();
  const tombstones = arrays.tombstones.map((row) => {
    if (
      typeof row.entityType !== "string" ||
      !TOMBSTONE_ENTITY_TYPES.has(row.entityType) ||
      typeof row.entityUid !== "string" ||
      row.entityUid.length === 0 ||
      typeof row.deletedAt !== "string"
    ) {
      fail("tombstones has an invalid row");
    }
    const key = `${row.entityType}\u0000${row.entityUid}`;
    if (tombstoneKeys.has(key)) fail("tombstones has a duplicate entity UID");
    tombstoneKeys.add(key);
    return {
      entityType: row.entityType,
      entityUid: row.entityUid,
      deletedAt: row.deletedAt,
    };
  });
  const survivingContacts = survivorsFor(
    arrays.contacts,
    tombstones,
    "contact",
  );
  const survivingDefs = survivorsFor(
    arrays.customFieldDefs,
    tombstones,
    "custom_field_def",
  );
  const survivingMethods = survivorsFor(
    arrays.contactMethods,
    tombstones,
    "contact_method",
  );
  const survivingExternalLinks = survivorsFor(
    arrays.externalContactLinks,
    tombstones,
    "external_contact_link",
  );
  for (const method of arrays.contactMethods)
    if (!survivingContacts.has(method.contactUid as string))
      fail("contactMethods has no surviving contact parent");
  for (const link of arrays.externalContactLinks)
    if (!survivingContacts.has(link.contactUid as string))
      fail("externalContactLinks has no surviving contact parent");
  for (const provenance of arrays.contactMethodProvenance) {
    if (!survivingMethods.has(provenance.methodUid as string))
      fail("contactMethodProvenance has no surviving method parent");
    if (
      typeof provenance.externalContactLinkUid === "string" &&
      !survivingExternalLinks.has(provenance.externalContactLinkUid)
    )
      fail("contactMethodProvenance has no surviving external link parent");
  }
  const primaryByContactAndType = new Set<string>();
  for (const method of arrays.contactMethods)
    if (method.isPrimary === 1 && survivingMethods.has(method.uid as string)) {
      const key = `${method.contactUid}\u0000${method.methodType}`;
      if (primaryByContactAndType.has(key))
        fail("contactMethods has duplicate surviving primary methods");
      primaryByContactAndType.add(key);
    }
  for (const [label, rows] of Object.entries({
    interactions: arrays.interactions,
    events: arrays.events,
    fuel: arrays.fuel,
    contactLinks: arrays.contactLinks,
  })) {
    for (const row of rows) {
      if (!survivingContacts.has(row.contactUid as string))
        fail(`${label} has no surviving contact parent`);
    }
  }
  for (const value of arrays.customFieldValues) {
    if (!survivingContacts.has(value.contactUid as string))
      fail("customFieldValues has no surviving contact parent");
    if (!survivingDefs.has(value.fieldDefUid as string))
      fail("customFieldValues has no surviving field definition parent");
  }
  for (const history of customFieldValueHistory) {
    if (!survivingContacts.has(history.contactUid as string))
      fail("customFieldValueHistory has no surviving contact parent");
    if (!survivingDefs.has(history.fieldDefUid as string))
      fail("customFieldValueHistory has no surviving field definition parent");
  }
  for (const memory of arrays.memories)
    if (!survivingContacts.has(memory.contactUid as string))
      fail("memories has no surviving contact parent");
  for (const relationship of arrays.relationships) {
    if (!survivingContacts.has(relationship.contactUid as string))
      fail("relationships has no surviving contact parent");
    if (typeof relationship.linkedContactUid === "string" && !survivingContacts.has(relationship.linkedContactUid))
      fail("relationships has no surviving linked contact parent");
  }
  for (const entry of arrays.currentStateEntries)
    if (!survivingContacts.has(entry.contactUid as string))
      fail("currentStateEntries has no surviving contact parent");
  for (const row of [...arrays.contacts, ...arrays.customFieldValues]) {
    if (
      row.photoBase64 !== null &&
      row.photoBase64 !== undefined &&
      !validBase64(row.photoBase64)
    ) {
      fail("backup has invalid photo bytes");
    }
  }
  if (
    profile &&
    profile.photoBase64 !== null &&
    profile.photoBase64 !== undefined &&
    !validBase64(profile.photoBase64)
  ) {
    fail("backup has invalid photo bytes");
  }
  return {
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    envelopeVersion: manifest.envelopeVersion as number,
    metadata: {
      exportedAt: metadata.exportedAt as string,
      sqliteUserVersion: metadata.sqliteUserVersion as number | null,
    },
    appSettings: settings as BackupManifest["appSettings"],
    categories: arrays.categories,
    profile,
    contacts: arrays.contacts,
    contactMethods: arrays.contactMethods,
    externalContactLinks: arrays.externalContactLinks,
    contactMethodProvenance: arrays.contactMethodProvenance,
    interactions: arrays.interactions,
    events: arrays.events,
    fuel: arrays.fuel,
    contactLinks: arrays.contactLinks,
    customFieldDefs: arrays.customFieldDefs,
    customFieldValues: arrays.customFieldValues,
    memories: arrays.memories,
    relationships: arrays.relationships,
    currentStateEntries: arrays.currentStateEntries,
    customFieldValueHistory,
    tombstones,
  };
}

/** Parse, migrate forward, then strictly validate a portable plaintext manifest. */
export function parseBackupManifest(input: unknown): BackupManifest {
  let manifest = record(input, "backup");
  const version = manifest.backupFormatVersion ?? 1;
  if (!Number.isInteger(version) || (version as number) < 1)
    fail("backupFormatVersion must be a positive integer");
  if ((version as number) > MAX_SUPPORTED_BACKUP_FORMAT_VERSION)
    fail(UPDATE_FIRST_MESSAGE);
  for (
    let from = version as number;
    from < MAX_SUPPORTED_BACKUP_FORMAT_VERSION;
    from += 1
  ) {
    const migrate = FORWARD_MIGRATIONS[from];
    if (!migrate) fail(`missing forward migration from backup format ${from}`);
    manifest = migrate(manifest);
  }
  return validate({
    ...manifest,
    backupFormatVersion: MAX_SUPPORTED_BACKUP_FORMAT_VERSION,
  });
}
