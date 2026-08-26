/**
 * Restore application boundary.  The parser owns structural validation; this
 * module owns the second boundary: reconcile the complete incoming graph before
 * a single write, then apply every winning action in one transaction.
 */
import { reconcileEntity, type MergeableEntityType, type ReconciliationAction } from "@/backup/reconciliation";
import type { BackupManifest, ReconciliationRow, ReconciliationTombstone } from "@/backup/types";
import { updateAppSettingsCore, type AppSettingsPatch } from "@/db/app-settings-dao";
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { recomputeLastContactCore } from "@/db/recency-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

export type RestoreMode = "merge" | "replace-all";
export type RestoreApplyResult =
  | { status: "applied"; mode: RestoreMode; inserted: number; updated: number; retained: number; deleted: number; blocked: number }
  | { status: "incompatible-destination"; incompatibilities: number };

type Row = Record<string, unknown> & ReconciliationRow;
type Plan = Record<MergeableEntityType, ReconciliationAction[]>;

const entities: readonly MergeableEntityType[] = [
  "categories", "profile", "contacts", "custom_field_defs", "interactions", "events", "fuel", "contact_links", "custom_field_values",
];
const tableOf: Record<MergeableEntityType, string> = {
  categories: "categories", profile: "profile", contacts: "contacts", interactions: "interactions", events: "events", fuel: "fuel", contact_links: "contact_links", custom_field_defs: "custom_field_defs", custom_field_values: "custom_field_values",
};
const tombstoneEntity: Record<MergeableEntityType, string | null> = {
  contacts: "contact", interactions: "interaction", events: "event", fuel: "fuel", contact_links: "contact_link", custom_field_defs: "custom_field_def", custom_field_values: "custom_field_value", categories: null, profile: null,
};

function incomingRows(manifest: BackupManifest, entity: MergeableEntityType): Row[] {
  const raw: Record<string, unknown>[] = entity === "profile"
    ? (manifest.profile ? [manifest.profile] : [])
    : entity === "contact_links" ? manifest.contactLinks
    : entity === "custom_field_defs" ? manifest.customFieldDefs
    : entity === "custom_field_values" ? manifest.customFieldValues
    : manifest[entity] as Record<string, unknown>[];
  return raw.map((row) => ({ ...row, modified_at: row.modifiedAt as string } as Row));
}

async function localRows(exec: SqlExecutor, entity: MergeableEntityType): Promise<Row[]> {
  const sql: Record<MergeableEntityType, string> = {
    categories: "SELECT uid, name, display_order AS displayOrder, created_at AS createdAt, modified_at FROM categories",
    profile: "SELECT uid, name, created_at AS createdAt, modified_at FROM profile",
    contacts: `SELECT c.uid, c.name, cat.uid AS categoryUid, c.interval_days AS intervalDays, c.social_battery AS socialBattery, c.birthday, c.phone, c.email, c.archived_at AS archivedAt, c.snooze_until AS snoozeUntil, c.rarely_responds AS rarelyResponds, c.reminders_off AS remindersOff, c.created_at AS createdAt, c.modified_at FROM contacts c LEFT JOIN categories cat ON cat.id = c.category_id`,
    interactions: "SELECT i.uid, c.uid AS contactUid, i.occurred_at AS occurredAt, i.recorded_at AS recordedAt, i.channel, i.direction, i.connected, i.quality, i.note, i.source, i.modified_at FROM interactions i JOIN contacts c ON c.id=i.contact_id",
    events: "SELECT e.uid, c.uid AS contactUid, e.type, e.occurred_at AS occurredAt, e.detail, e.recorded_at AS recordedAt, e.modified_at FROM events e JOIN contacts c ON c.id=e.contact_id",
    fuel: "SELECT f.uid, c.uid AS contactUid, f.kind, f.label, f.text, f.url, f.created_at AS createdAt, f.source, f.modified_at FROM fuel f JOIN contacts c ON c.id=f.contact_id",
    contact_links: "SELECT l.uid, c.uid AS contactUid, l.url, l.label, l.display_order AS displayOrder, l.created_at AS createdAt, l.modified_at FROM contact_links l JOIN contacts c ON c.id=l.contact_id",
    custom_field_defs: "SELECT uid, col_name AS colName, label, type, options, show_on_new AS showOnNew, always_show AS alwaysShow, display_order AS displayOrder, quarantined_at AS quarantinedAt, share_with_ai AS shareWithAi, created_at AS createdAt, modified_at FROM custom_field_defs",
    custom_field_values: "SELECT v.uid, c.uid AS contactUid, d.uid AS fieldDefUid, d.type AS fieldType, d.col_name AS colName, v.value, v.created_at AS createdAt, v.modified_at FROM custom_field_values v JOIN contacts c ON c.id=v.contact_id JOIN custom_field_defs d ON d.id=v.field_def_id",
  };
  return exec.getAllAsync<Row>(sql[entity]);
}

async function tombstones(exec: SqlExecutor, entity: MergeableEntityType): Promise<ReconciliationTombstone[]> {
  const type = tombstoneEntity[entity];
  if (!type) return [];
  const rows = await exec.getAllAsync<{ entity_uid: string; deleted_at: string }>("SELECT entity_uid, deleted_at FROM tombstones WHERE entity_type = ?", [type]);
  return rows;
}

function incomingTombstones(manifest: BackupManifest, entity: MergeableEntityType): ReconciliationTombstone[] {
  const type = tombstoneEntity[entity];
  return type ? manifest.tombstones.filter((row) => row.entityType === type).map((row) => ({ entity_uid: row.entityUid, deleted_at: row.deletedAt })) : [];
}

async function idMap(exec: SqlExecutor, table: "contacts" | "categories" | "custom_field_defs"): Promise<Map<string, number>> {
  const rows = await exec.getAllAsync<{ uid: string; id: number }>(`SELECT uid, id FROM ${table}`);
  return new Map(rows.map((row) => [row.uid, row.id]));
}

function actions(plan: Plan, entity: MergeableEntityType): ReconciliationAction[] {
  return plan[entity].filter((action) => action.kind === "insert" || action.kind === "update");
}

/** A normalized backup cannot leave a live contact/definition pair implicit. */
function assertCompleteIncomingPairs(manifest: BackupManifest): void {
  const pairs = new Set(manifest.customFieldValues.map((row) => `${row.contactUid}\0${row.fieldDefUid}`));
  for (const contact of manifest.contacts) for (const def of manifest.customFieldDefs) {
    if (!pairs.has(`${contact.uid}\0${def.uid}`)) {
      throw new Error("restore manifest is missing a normalized custom-field value pair");
    }
  }
}

async function deleteActions(exec: SqlExecutor, entity: MergeableEntityType, entries: ReconciliationAction[]): Promise<number> {
  let count = 0;
  for (const action of entries.filter((item) => item.kind === "delete")) {
    const result = await exec.runAsync(`DELETE FROM ${tableOf[entity]} WHERE uid = ?`, [action.uid]);
    count += result.changes;
  }
  return count;
}

async function upsertParents(exec: SqlExecutor, plan: Plan): Promise<void> {
  for (const action of actions(plan, "categories")) {
    const row = action.row!;
    await exec.runAsync(`INSERT INTO categories (uid,name,display_order,created_at,modified_at) VALUES (?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET name=excluded.name,display_order=excluded.display_order,modified_at=excluded.modified_at`, [row.uid,row.name,row.displayOrder,row.createdAt,row.modified_at]);
  }
  for (const action of actions(plan, "profile")) {
    const row = action.row!;
    await exec.runAsync("UPDATE profile SET uid=?, name=?, modified_at=? WHERE id=1", [row.uid,row.name ?? null,row.modified_at]);
  }
  for (const action of actions(plan, "custom_field_defs")) {
    const row = action.row!;
    await exec.runAsync(`INSERT INTO custom_field_defs (uid,col_name,label,type,options,show_on_new,always_show,display_order,quarantined_at,share_with_ai,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET col_name=excluded.col_name,label=excluded.label,type=excluded.type,options=excluded.options,show_on_new=excluded.show_on_new,always_show=excluded.always_show,display_order=excluded.display_order,quarantined_at=excluded.quarantined_at,share_with_ai=excluded.share_with_ai,modified_at=excluded.modified_at`, [row.uid,row.colName,row.label,row.type,row.options ?? null,row.showOnNew,row.alwaysShow,row.displayOrder,row.quarantinedAt ?? null,row.shareWithAi,row.createdAt,row.modified_at]);
  }
}

async function upsertContacts(exec: SqlExecutor, plan: Plan): Promise<void> {
  const categories = await idMap(exec, "categories");
  for (const action of actions(plan, "contacts")) {
    const row = action.row!;
    const categoryId = typeof row.categoryUid === "string" ? categories.get(row.categoryUid) ?? null : null;
    await exec.runAsync(`INSERT INTO contacts (uid,name,category_id,interval_days,social_battery,birthday,phone,email,archived_at,snooze_until,rarely_responds,reminders_off,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET name=excluded.name,category_id=excluded.category_id,interval_days=excluded.interval_days,social_battery=excluded.social_battery,birthday=excluded.birthday,phone=excluded.phone,email=excluded.email,archived_at=excluded.archived_at,snooze_until=excluded.snooze_until,rarely_responds=excluded.rarely_responds,reminders_off=excluded.reminders_off,modified_at=excluded.modified_at`, [row.uid,row.name,categoryId,row.intervalDays,row.socialBattery ?? null,row.birthday ?? null,row.phone ?? null,row.email ?? null,row.archivedAt ?? null,row.snoozeUntil ?? null,row.rarelyResponds,row.remindersOff,row.createdAt,row.modified_at]);
  }
}

async function upsertChildren(exec: SqlExecutor, plan: Plan): Promise<void> {
  const contacts = await idMap(exec, "contacts");
  const defs = await idMap(exec, "custom_field_defs");
  for (const entity of ["interactions", "events", "fuel", "contact_links", "custom_field_values"] as const) for (const action of actions(plan, entity)) {
    const row = action.row!; const contactId = contacts.get(row.contactUid as string); if (!contactId) throw new Error("restore parent disappeared during apply");
    if (entity === "interactions") await exec.runAsync(`INSERT INTO interactions (uid,contact_id,occurred_at,recorded_at,channel,direction,connected,quality,note,source,modified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET contact_id=excluded.contact_id,occurred_at=excluded.occurred_at,recorded_at=excluded.recorded_at,channel=excluded.channel,direction=excluded.direction,connected=excluded.connected,quality=excluded.quality,note=excluded.note,source=excluded.source,modified_at=excluded.modified_at`, [row.uid,contactId,row.occurredAt,row.recordedAt,row.channel,row.direction ?? null,row.connected,row.quality ?? null,row.note ?? null,row.source,row.modified_at]);
    if (entity === "events") await exec.runAsync(`INSERT INTO events (uid,contact_id,type,occurred_at,detail,recorded_at,modified_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET contact_id=excluded.contact_id,type=excluded.type,occurred_at=excluded.occurred_at,detail=excluded.detail,recorded_at=excluded.recorded_at,modified_at=excluded.modified_at`, [row.uid,contactId,row.type,row.occurredAt,row.detail ?? null,row.recordedAt,row.modified_at]);
    if (entity === "fuel") await exec.runAsync(`INSERT INTO fuel (uid,contact_id,kind,label,text,url,created_at,source,modified_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET contact_id=excluded.contact_id,kind=excluded.kind,label=excluded.label,text=excluded.text,url=excluded.url,source=excluded.source,modified_at=excluded.modified_at`, [row.uid,contactId,row.kind,row.label ?? null,row.text ?? null,row.url ?? null,row.createdAt,row.source,row.modified_at]);
    if (entity === "contact_links") await exec.runAsync(`INSERT INTO contact_links (uid,contact_id,url,label,display_order,created_at,modified_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET contact_id=excluded.contact_id,url=excluded.url,label=excluded.label,display_order=excluded.display_order,modified_at=excluded.modified_at`, [row.uid,contactId,row.url,row.label ?? null,row.displayOrder,row.createdAt,row.modified_at]);
    if (entity === "custom_field_values") { const defId = defs.get(row.fieldDefUid as string); if (!defId) throw new Error("restore definition disappeared during apply"); await exec.runAsync(`INSERT INTO custom_field_values (uid,contact_id,field_def_id,value,created_at,modified_at) VALUES (?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET contact_id=excluded.contact_id,field_def_id=excluded.field_def_id,value=excluded.value,modified_at=excluded.modified_at`, [row.uid,contactId,defId,row.value ?? null,row.createdAt,row.modified_at]); }
  }
}

async function replaceAllReset(exec: SqlExecutor, manifest: BackupManifest): Promise<void> {
  const stamp = manifest.metadata.exportedAt;
  await exec.runAsync("UPDATE app_settings SET sun_contact_id = NULL WHERE id = 1");
  const sources: Array<[string, string]> = [
    ["interaction", "interactions"], ["event", "events"], ["fuel", "fuel"],
    ["custom_field_value", "custom_field_values"], ["contact_link", "contact_links"],
    ["contact", "contacts"], ["custom_field_def", "custom_field_defs"],
  ];
  for (const [entityType, table] of sources) {
    const rows = await exec.getAllAsync<{ uid: string }>(`SELECT uid FROM ${table}`);
    for (const row of rows) {
      await exec.runAsync(
        `INSERT INTO tombstones (entity_type, entity_uid, deleted_at) VALUES (?, ?, ?)
         ON CONFLICT(entity_type, entity_uid) DO UPDATE SET deleted_at=CASE WHEN excluded.deleted_at > tombstones.deleted_at THEN excluded.deleted_at ELSE tombstones.deleted_at END`,
        [entityType, row.uid, stamp],
      );
    }
  }
  for (const table of ["interactions", "events", "fuel", "custom_field_values", "contact_links", "field_history", "contacts", "custom_field_defs"]) {
    await exec.runAsync(`DELETE FROM ${table}`);
  }
}

async function importIncomingTombstones(exec: SqlExecutor, manifest: BackupManifest): Promise<void> {
  for (const row of manifest.tombstones) {
    await exec.runAsync(
      `INSERT INTO tombstones (entity_type, entity_uid, deleted_at) VALUES (?, ?, ?)
       ON CONFLICT(entity_type, entity_uid) DO UPDATE SET deleted_at=CASE WHEN excluded.deleted_at > tombstones.deleted_at THEN excluded.deleted_at ELSE tombstones.deleted_at END`,
      [row.entityType, row.entityUid, row.deletedAt],
    );
  }
}

/** Apply the already-parsed manifest. Callers must obtain explicit user confirmation first. */
export async function applyRestore(exec: SqlExecutor, manifest: BackupManifest, mode: RestoreMode): Promise<RestoreApplyResult> {
  assertCompleteIncomingPairs(manifest);
  const local = await Promise.all(entities.map(async (entity) => [entity, await localRows(exec, entity), await tombstones(exec, entity)] as const));
  const plan = {} as Plan; let incompatibilities = 0;
  const survivors: Partial<Record<MergeableEntityType, ReadonlySet<string>>> = {};
  if (mode === "replace-all") {
    for (const entity of entities) {
      plan[entity] = incomingRows(manifest, entity).map((row) => ({ kind: "insert", uid: row.uid, row }));
      survivors[entity] = new Set(plan[entity].map((action) => action.uid));
    }
  } else {
    for (const entity of entities) {
      const [_, localRowsForEntity, localTombstones] = local.find(([candidate]) => candidate === entity)!;
      const result = reconcileEntity({ entityType: entity, localRows: localRowsForEntity, incomingRows: incomingRows(manifest, entity), localTombstones, incomingTombstones: incomingTombstones(manifest, entity), parentSurvivors: survivors });
      plan[entity] = result.actions; survivors[entity] = result.survivors; incompatibilities += result.incompatibilities.length;
    }
  }
  if (incompatibilities) return { status: "incompatible-destination", incompatibilities };
  const totals = entities.reduce((out, entity) => { for (const action of plan[entity]) out[action.kind] += 1; return out; }, { insert: 0, update: 0, retain: 0, delete: 0, blocked: 0 });
  if (totals.insert + totals.update + totals.delete === 0) return { status: "applied", mode, inserted: 0, updated: 0, retained: totals.retain, deleted: 0, blocked: totals.blocked };
  await inWriteTransaction(exec, async () => {
    if (mode === "replace-all") await replaceAllReset(exec, manifest);
    else for (const entity of [...entities].reverse()) await deleteActions(exec, entity, plan[entity]);
    await importIncomingTombstones(exec, manifest);
    await upsertParents(exec, plan); await upsertContacts(exec, plan); await upsertChildren(exec, plan);
    const contacts = await idMap(exec, "contacts");
    for (const action of actions(plan, "contacts")) await recomputeLastContactCore(exec, contacts.get(action.uid)!, action.row!.modified_at);
    const settings = manifest.appSettings;
    const sun = typeof settings.sunContactUid === "string" ? contacts.get(settings.sunContactUid) ?? null : null;
    const patch = Object.fromEntries(Object.entries(settings).filter(([key]) => key !== "modifiedAt" && key !== "sunContactUid").map(([key, value]) => [key, value])) as AppSettingsPatch;
    await updateAppSettingsCore(exec, { ...patch, sunContactId: sun }, settings.modifiedAt as string);
    await bumpDataRevisionCore(exec);
  });
  return { status: "applied", mode, inserted: totals.insert, updated: totals.update, retained: totals.retain, deleted: totals.delete, blocked: totals.blocked };
}
