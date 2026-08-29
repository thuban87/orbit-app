import { BACKUP_ENVELOPE_VERSION, BACKUP_FORMAT_VERSION, type BackupManifest, BackupPhotoUnreadableError } from "@/backup/types";
import { parseBackupManifest } from "@/backup/backup-schema";
import { getPortableSettingsSnapshot } from "@/db/app-settings-dao";
import { inReadSnapshot, type ReadOnlyExecutor } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

export interface ExportManifestDeps {
  exportedAt: string;
  readPhotoBase64: (relativePath: string) => Promise<string>;
}

const FORBIDDEN_KEYS = new Set([
  "sunContactId", "data_revision", "last_backup_data_revision", "backup_folder_uri", "backup_folder_name", "backup_folder_accessible", "backup_folder_diagnostic", "last_automatic_backup_at", "encryption_enabled", "backup_nudge_dismissed", "field_history",
]);

function assertNoLocalOnlyKeys(value: unknown): void {
  if (Array.isArray(value)) { for (const item of value) assertNoLocalOnlyKeys(item); return; }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(key)) throw new Error("backup manifest contains a local-only field");
    assertNoLocalOnlyKeys(child);
  }
}

async function withPhoto<T extends Record<string, unknown>>(row: T, readPhotoBase64: ExportManifestDeps["readPhotoBase64"]): Promise<T & { photoBase64: string | null }> {
  const relative = row.photo;
  const base = { ...row, photo: undefined, photoBase64: null } as T & { photoBase64: string | null };
  delete (base as Record<string, unknown>).photo;
  if (relative === null || relative === undefined) return base;
  if (typeof relative !== "string") throw new BackupPhotoUnreadableError();
  try {
    const bytes = await readPhotoBase64(relative);
    if (!bytes) throw new Error("empty photo");
    return { ...base, photoBase64: bytes };
  } catch {
    throw new BackupPhotoUnreadableError();
  }
}

async function readManifest(ro: ReadOnlyExecutor, deps: ExportManifestDeps): Promise<BackupManifest> {
  const [settings, userVersion] = await Promise.all([
    getPortableSettingsSnapshot(ro),
    ro.getFirstAsync<{ user_version: number }>("PRAGMA user_version"),
  ]);
  const [categories, profileRows, contactRows, contactMethods, externalContactLinks, contactMethodProvenance, interactions, events, fuel, contactLinks, customFieldDefs, rawValues, tombstones] = await Promise.all([
    ro.getAllAsync<Record<string, unknown>>("SELECT uid, name, display_order AS displayOrder, created_at AS createdAt, modified_at AS modifiedAt FROM categories ORDER BY uid"),
    ro.getAllAsync<Record<string, unknown>>("SELECT uid, name, photo, created_at AS createdAt, modified_at AS modifiedAt FROM profile ORDER BY uid"),
    ro.getAllAsync<Record<string, unknown>>(`SELECT c.id AS localContactId, c.uid, c.name, category.uid AS categoryUid, c.tracking_enabled AS trackingEnabled, c.interval_days AS intervalDays, c.social_battery AS socialBattery, c.birthday, c.photo, c.archived_at AS archivedAt, c.snooze_until AS snoozeUntil, c.rarely_responds AS rarelyResponds, c.reminders_off AS remindersOff, c.created_at AS createdAt, c.modified_at AS modifiedAt FROM contacts c LEFT JOIN categories category ON category.id = c.category_id ORDER BY c.uid`),
    ro.getAllAsync<Record<string, unknown>>("SELECT m.uid, c.uid AS contactUid, m.method_type AS methodType, m.raw_value AS rawValue, m.display_value AS displayValue, m.canonical_value AS canonicalValue, m.canonical_region AS canonicalRegion, m.label, m.extension, m.is_actionable AS isActionable, m.is_primary AS isPrimary, m.display_order AS displayOrder, m.created_at AS createdAt, m.modified_at AS modifiedAt FROM contact_methods m JOIN contacts c ON c.id = m.contact_id ORDER BY m.uid"),
    ro.getAllAsync<Record<string, unknown>>("SELECT l.uid, c.uid AS contactUid, l.provider, l.external_contact_id AS externalContactId, l.is_active AS isActive, l.created_at AS createdAt, l.modified_at AS modifiedAt FROM external_contact_links l JOIN contacts c ON c.id = l.contact_id ORDER BY l.uid"),
    ro.getAllAsync<Record<string, unknown>>("SELECT p.uid, m.uid AS methodUid, l.uid AS externalContactLinkUid, p.source_method_id AS sourceMethodId, p.created_at AS createdAt, p.modified_at AS modifiedAt FROM contact_method_provenance p JOIN contact_methods m ON m.id = p.method_id LEFT JOIN external_contact_links l ON l.id = p.external_contact_link_id ORDER BY p.uid"),
    ro.getAllAsync<Record<string, unknown>>("SELECT i.uid, c.uid AS contactUid, i.occurred_at AS occurredAt, i.recorded_at AS recordedAt, i.channel, i.direction, i.connected, i.quality, i.note, i.source, i.modified_at AS modifiedAt FROM interactions i JOIN contacts c ON c.id = i.contact_id ORDER BY i.uid"),
    ro.getAllAsync<Record<string, unknown>>("SELECT e.uid, c.uid AS contactUid, e.type, e.occurred_at AS occurredAt, e.detail, e.recorded_at AS recordedAt, e.modified_at AS modifiedAt FROM events e JOIN contacts c ON c.id = e.contact_id ORDER BY e.uid"),
    ro.getAllAsync<Record<string, unknown>>("SELECT f.uid, c.uid AS contactUid, f.kind, f.label, f.text, f.url, f.created_at AS createdAt, f.source, f.modified_at AS modifiedAt FROM fuel f JOIN contacts c ON c.id = f.contact_id ORDER BY f.uid"),
    ro.getAllAsync<Record<string, unknown>>("SELECT l.uid, c.uid AS contactUid, l.url, l.label, l.display_order AS displayOrder, l.created_at AS createdAt, l.modified_at AS modifiedAt FROM contact_links l JOIN contacts c ON c.id = l.contact_id ORDER BY l.uid"),
    ro.getAllAsync<Record<string, unknown>>("SELECT uid, col_name AS colName, label, type, options, show_on_new AS showOnNew, always_show AS alwaysShow, display_order AS displayOrder, quarantined_at AS quarantinedAt, share_with_ai AS shareWithAi, created_at AS createdAt, modified_at AS modifiedAt FROM custom_field_defs ORDER BY uid"),
    ro.getAllAsync<Record<string, unknown>>("SELECT v.uid, c.uid AS contactUid, d.uid AS fieldDefUid, d.type AS fieldType, d.col_name AS colName, c.id AS contactId, v.value, v.created_at AS createdAt, v.modified_at AS modifiedAt FROM custom_field_values v JOIN contacts c ON c.id = v.contact_id JOIN custom_field_defs d ON d.id = v.field_def_id ORDER BY v.uid"),
    ro.getAllAsync<{ entity_type: string; entity_uid: string; deleted_at: string }>("SELECT entity_type, entity_uid, deleted_at FROM tombstones ORDER BY entity_type, entity_uid"),
  ]);
  const contactUid = new Map(contactRows.map((row) => [row.localContactId as number, row.uid as string]));
  const sunContactUid = settings.sunContactId === null ? null : contactUid.get(settings.sunContactId);
  if (settings.sunContactId !== null && !sunContactUid) throw new Error("portable settings refer to an unknown sun contact");
  const { sunContactId: _sunContactId, ...portable } = settings;
  const values = await Promise.all(rawValues.map(async ({ fieldType, colName, contactId, value, ...row }) => {
    if (fieldType !== "photo" || value === null) return { ...row, value, photoBase64: null };
    const relative = typeof value === "string" ? value : null;
    if (!relative) throw new BackupPhotoUnreadableError();
    try { return { ...row, value: null, photoBase64: await deps.readPhotoBase64(relative) }; } catch { throw new BackupPhotoUnreadableError(); }
  }));
  const manifest: BackupManifest = {
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    envelopeVersion: BACKUP_ENVELOPE_VERSION,
    metadata: { exportedAt: deps.exportedAt, sqliteUserVersion: userVersion?.user_version ?? null },
    appSettings: { ...portable, sunContactUid: sunContactUid ?? null },
    categories,
    profile: profileRows[0] ? await withPhoto(profileRows[0], deps.readPhotoBase64) : null,
    contacts: await Promise.all(contactRows.map(async ({ localContactId: _localContactId, ...row }) => withPhoto(row, deps.readPhotoBase64))),
    contactMethods, externalContactLinks, contactMethodProvenance,
    interactions, events, fuel, contactLinks, customFieldDefs, customFieldValues: values,
    tombstones: tombstones.map((row) => ({ entityType: row.entity_type, entityUid: row.entity_uid, deletedAt: row.deleted_at })),
  };
  assertNoLocalOnlyKeys(manifest);
  return parseBackupManifest(manifest);
}

/** Build and validate a complete portable export under one mutex-held snapshot. */
export function buildExportManifest(exec: SqlExecutor, deps: ExportManifestDeps): Promise<BackupManifest> {
  return inReadSnapshot(exec, (ro) => readManifest(ro, deps));
}
