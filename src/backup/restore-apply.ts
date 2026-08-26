/**
 * Restore application owns the write boundary. Reconciliation and durable photo
 * staging happen before its single transaction; committed journal rows are the
 * only authority for post-commit filesystem work.
 */
import { reconcileEntity, type MergeableEntityType, type ReconciliationAction } from "@/backup/reconciliation";
import type { BackupManifest, ReconciliationRow, ReconciliationTombstone } from "@/backup/types";
import { getPortableSettingsSnapshot, updateAppSettingsCore, type AppSettingsPatch } from "@/db/app-settings-dao";
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { recomputeLastContactCore } from "@/db/recency-dao";
import { deleteJournalEntryCore, insertJournalEntryCore, type RestorePhotoJournalEntry } from "@/db/restore-photo-journal-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
import { reconcileDigestSchedule } from "@/services/notifications/digest-schedule";
import { reconcileSchedule } from "@/services/notifications/notification-schedule";
import {
  contactPhotoRelPath, customFieldPhotoRelPath, deletePhoto, deleteRestorePending,
  persistMaster, photoFileExists, profilePhotoRelPath, resolveRestorePendingUri,
  restorePendingRelPath, stageRestorePendingBase64, type RestorePendingTarget,
} from "@/services/photos/photo-storage";

export type RestoreMode = "merge" | "replace-all";
export type PreRestoreSnapshotResult =
  | { status: "written" }
  | { status: "failed" | "busy" | "blocked"; reason?: string };
export interface RestoreApplyDependencies {
  /** Required when the destination is configured: failure blocks Replace-all. */
  createVerifiedPreRestoreSnapshot?: () => Promise<PreRestoreSnapshotResult>;
  stagePhoto?: (base64: string, relative: string) => Promise<void>;
  persistPhoto?: (sourceUri: string, canonicalRelativePath: string) => Promise<unknown>;
  deleteCanonicalPhoto?: (canonicalRelativePath: string) => void;
  canonicalPhotoExists?: (canonicalRelativePath: string) => boolean;
  reconcileNotificationSchedule?: () => Promise<void>;
  reconcileDigestSchedule?: () => Promise<void>;
  sessionToken?: string;
}
export type RestoreApplyResult =
  | { status: "applied"; mode: RestoreMode; inserted: number; updated: number; retained: number; deleted: number; blocked: number; photosNeedingAttention: number; photoCleanupPending: number; scheduleResyncPending: boolean; preRestoreSnapshotCreated: boolean }
  | { status: "incompatible-destination"; incompatibilities: number }
  | { status: "pre-restore-snapshot-failed" };

type Row = Record<string, unknown> & ReconciliationRow;
type Plan = Record<MergeableEntityType, ReconciliationAction[]>;
type PhotoTarget = RestorePendingTarget & { valueUid?: string; fieldDefUid?: string };
type FinalizeCandidate = { target: PhotoTarget; relativePath: string };
type DeleteCandidate = { target: PhotoTarget; canonicalRelativePath: string; clearReference: boolean };

const entities: readonly MergeableEntityType[] = ["categories", "profile", "contacts", "custom_field_defs", "interactions", "events", "fuel", "contact_links", "custom_field_values"];
const tableOf: Record<MergeableEntityType, string> = { categories: "categories", profile: "profile", contacts: "contacts", interactions: "interactions", events: "events", fuel: "fuel", contact_links: "contact_links", custom_field_defs: "custom_field_defs", custom_field_values: "custom_field_values" };
const tombstoneEntity: Record<MergeableEntityType, string | null> = { contacts: "contact", interactions: "interaction", events: "event", fuel: "fuel", contact_links: "contact_link", custom_field_defs: "custom_field_def", custom_field_values: "custom_field_value", categories: null, profile: null };

function incomingRows(manifest: BackupManifest, entity: MergeableEntityType): Row[] {
  const raw: Record<string, unknown>[] = entity === "profile" ? (manifest.profile ? [manifest.profile] : []) : entity === "contact_links" ? manifest.contactLinks : entity === "custom_field_defs" ? manifest.customFieldDefs : entity === "custom_field_values" ? manifest.customFieldValues : manifest[entity] as Record<string, unknown>[];
  return raw.map((row) => ({ ...row, modified_at: row.modifiedAt as string } as Row));
}
async function localRows(exec: SqlExecutor, entity: MergeableEntityType): Promise<Row[]> {
  const sql: Record<MergeableEntityType, string> = {
    categories: "SELECT uid,name,display_order AS displayOrder,created_at AS createdAt,modified_at FROM categories",
    profile: "SELECT uid,name,created_at AS createdAt,modified_at FROM profile",
    contacts: "SELECT c.uid,c.name,cat.uid AS categoryUid,c.interval_days AS intervalDays,c.social_battery AS socialBattery,c.birthday,c.phone,c.email,c.archived_at AS archivedAt,c.snooze_until AS snoozeUntil,c.rarely_responds AS rarelyResponds,c.reminders_off AS remindersOff,c.created_at AS createdAt,c.modified_at FROM contacts c LEFT JOIN categories cat ON cat.id=c.category_id",
    interactions: "SELECT i.uid,c.uid AS contactUid,i.occurred_at AS occurredAt,i.recorded_at AS recordedAt,i.channel,i.direction,i.connected,i.quality,i.note,i.source,i.modified_at FROM interactions i JOIN contacts c ON c.id=i.contact_id",
    events: "SELECT e.uid,c.uid AS contactUid,e.type,e.occurred_at AS occurredAt,e.detail,e.recorded_at AS recordedAt,e.modified_at FROM events e JOIN contacts c ON c.id=e.contact_id",
    fuel: "SELECT f.uid,c.uid AS contactUid,f.kind,f.label,f.text,f.url,f.created_at AS createdAt,f.source,f.modified_at FROM fuel f JOIN contacts c ON c.id=f.contact_id",
    contact_links: "SELECT l.uid,c.uid AS contactUid,l.url,l.label,l.display_order AS displayOrder,l.created_at AS createdAt,l.modified_at FROM contact_links l JOIN contacts c ON c.id=l.contact_id",
    custom_field_defs: "SELECT uid,col_name AS colName,label,type,options,show_on_new AS showOnNew,always_show AS alwaysShow,display_order AS displayOrder,quarantined_at AS quarantinedAt,share_with_ai AS shareWithAi,created_at AS createdAt,modified_at FROM custom_field_defs",
    custom_field_values: "SELECT v.uid,c.uid AS contactUid,d.uid AS fieldDefUid,d.type AS fieldType,d.col_name AS colName,v.value,v.created_at AS createdAt,v.modified_at FROM custom_field_values v JOIN contacts c ON c.id=v.contact_id JOIN custom_field_defs d ON d.id=v.field_def_id",
  };
  return exec.getAllAsync<Row>(sql[entity]);
}
async function tombstones(exec: SqlExecutor, entity: MergeableEntityType): Promise<ReconciliationTombstone[]> {
  const type = tombstoneEntity[entity];
  return type ? exec.getAllAsync<{ entity_uid: string; deleted_at: string }>("SELECT entity_uid,deleted_at FROM tombstones WHERE entity_type=?", [type]) : [];
}
function incomingTombstones(manifest: BackupManifest, entity: MergeableEntityType): ReconciliationTombstone[] {
  const type = tombstoneEntity[entity];
  return type ? manifest.tombstones.filter((row) => row.entityType === type).map((row) => ({ entity_uid: row.entityUid, deleted_at: row.deletedAt })) : [];
}
async function idMap(exec: SqlExecutor, table: "contacts" | "categories" | "custom_field_defs"): Promise<Map<string, number>> {
  return new Map((await exec.getAllAsync<{ uid: string; id: number }>(`SELECT uid,id FROM ${table}`)).map((row) => [row.uid, row.id]));
}
function writes(plan: Plan, entity: MergeableEntityType): ReconciliationAction[] { return plan[entity].filter((a) => a.kind === "insert" || a.kind === "update"); }
function assertCompleteIncomingPairs(manifest: BackupManifest): void {
  const pairs = new Set(manifest.customFieldValues.map((row) => `${row.contactUid}\0${row.fieldDefUid}`));
  for (const contact of manifest.contacts) for (const def of manifest.customFieldDefs) if (!pairs.has(`${contact.uid}\0${def.uid}`)) throw new Error("restore manifest is missing a normalized custom-field value pair");
}
async function deleteActions(exec: SqlExecutor, entity: MergeableEntityType, items: ReconciliationAction[]): Promise<void> {
  for (const action of items) if (action.kind === "delete") await exec.runAsync(`DELETE FROM ${tableOf[entity]} WHERE uid=?`, [action.uid]);
}
async function upsertParents(exec: SqlExecutor, plan: Plan): Promise<void> {
  for (const a of writes(plan, "categories")) { const r = a.row!; await exec.runAsync("INSERT INTO categories (uid,name,display_order,created_at,modified_at) VALUES (?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET name=excluded.name,display_order=excluded.display_order,modified_at=excluded.modified_at", [r.uid,r.name,r.displayOrder,r.createdAt,r.modified_at]); }
  for (const a of writes(plan, "profile")) { const r = a.row!; await exec.runAsync("UPDATE profile SET uid=?,name=?,modified_at=? WHERE id=1", [r.uid,r.name ?? null,r.modified_at]); }
  for (const a of writes(plan, "custom_field_defs")) { const r = a.row!; await exec.runAsync("INSERT INTO custom_field_defs (uid,col_name,label,type,options,show_on_new,always_show,display_order,quarantined_at,share_with_ai,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET col_name=excluded.col_name,label=excluded.label,type=excluded.type,options=excluded.options,show_on_new=excluded.show_on_new,always_show=excluded.always_show,display_order=excluded.display_order,quarantined_at=excluded.quarantined_at,share_with_ai=excluded.share_with_ai,modified_at=excluded.modified_at", [r.uid,r.colName,r.label,r.type,r.options ?? null,r.showOnNew,r.alwaysShow,r.displayOrder,r.quarantinedAt ?? null,r.shareWithAi,r.createdAt,r.modified_at]); }
}
async function upsertContacts(exec: SqlExecutor, plan: Plan): Promise<void> {
  const categories = await idMap(exec, "categories");
  for (const a of writes(plan, "contacts")) { const r = a.row!; const category = typeof r.categoryUid === "string" ? categories.get(r.categoryUid) ?? null : null; await exec.runAsync("INSERT INTO contacts (uid,name,category_id,interval_days,social_battery,birthday,phone,email,archived_at,snooze_until,rarely_responds,reminders_off,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET name=excluded.name,category_id=excluded.category_id,interval_days=excluded.interval_days,social_battery=excluded.social_battery,birthday=excluded.birthday,phone=excluded.phone,email=excluded.email,archived_at=excluded.archived_at,snooze_until=excluded.snooze_until,rarely_responds=excluded.rarely_responds,reminders_off=excluded.reminders_off,modified_at=excluded.modified_at", [r.uid,r.name,category,r.intervalDays,r.socialBattery ?? null,r.birthday ?? null,r.phone ?? null,r.email ?? null,r.archivedAt ?? null,r.snoozeUntil ?? null,r.rarelyResponds,r.remindersOff,r.createdAt,r.modified_at]); }
}
async function upsertChildren(exec: SqlExecutor, plan: Plan): Promise<void> {
  const contacts = await idMap(exec, "contacts"); const defs = await idMap(exec, "custom_field_defs");
  for (const entity of ["interactions","events","fuel","contact_links","custom_field_values"] as const) for (const a of writes(plan, entity)) {
    const r = a.row!; const contact = contacts.get(r.contactUid as string); if (!contact) throw new Error("restore parent disappeared during apply");
    if (entity === "interactions") await exec.runAsync("INSERT INTO interactions (uid,contact_id,occurred_at,recorded_at,channel,direction,connected,quality,note,source,modified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET contact_id=excluded.contact_id,occurred_at=excluded.occurred_at,recorded_at=excluded.recorded_at,channel=excluded.channel,direction=excluded.direction,connected=excluded.connected,quality=excluded.quality,note=excluded.note,source=excluded.source,modified_at=excluded.modified_at", [r.uid,contact,r.occurredAt,r.recordedAt,r.channel,r.direction ?? null,r.connected,r.quality ?? null,r.note ?? null,r.source,r.modified_at]);
    if (entity === "events") await exec.runAsync("INSERT INTO events (uid,contact_id,type,occurred_at,detail,recorded_at,modified_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET contact_id=excluded.contact_id,type=excluded.type,occurred_at=excluded.occurred_at,detail=excluded.detail,recorded_at=excluded.recorded_at,modified_at=excluded.modified_at", [r.uid,contact,r.type,r.occurredAt,r.detail ?? null,r.recordedAt,r.modified_at]);
    if (entity === "fuel") await exec.runAsync("INSERT INTO fuel (uid,contact_id,kind,label,text,url,created_at,source,modified_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET contact_id=excluded.contact_id,kind=excluded.kind,label=excluded.label,text=excluded.text,url=excluded.url,created_at=excluded.created_at,source=excluded.source,modified_at=excluded.modified_at", [r.uid,contact,r.kind,r.label ?? null,r.text ?? null,r.url ?? null,r.createdAt,r.source,r.modified_at]);
    if (entity === "contact_links") await exec.runAsync("INSERT INTO contact_links (uid,contact_id,url,label,display_order,created_at,modified_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET contact_id=excluded.contact_id,url=excluded.url,label=excluded.label,display_order=excluded.display_order,created_at=excluded.created_at,modified_at=excluded.modified_at", [r.uid,contact,r.url,r.label ?? null,r.displayOrder,r.createdAt,r.modified_at]);
    if (entity === "custom_field_values") { const def = defs.get(r.fieldDefUid as string); if (!def) throw new Error("restore definition disappeared during apply"); await exec.runAsync("INSERT INTO custom_field_values (uid,contact_id,field_def_id,value,created_at,modified_at) VALUES (?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET contact_id=excluded.contact_id,field_def_id=excluded.field_def_id,value=excluded.value,modified_at=excluded.modified_at", [r.uid,contact,def,r.value ?? null,r.createdAt,r.modified_at]); }
  }
}
function targetFor(entity: MergeableEntityType, row: Row): PhotoTarget | null {
  if (entity === "profile") return { kind: "profile" };
  if (entity === "contacts") return { kind: "contact", uid: row.uid };
  if (entity === "custom_field_values" && row.fieldType === "photo" && typeof row.contactUid === "string" && typeof row.fieldDefUid === "string" && typeof row.colName === "string") return { kind: "customField", uid: row.contactUid, colName: row.colName, valueUid: row.uid, fieldDefUid: row.fieldDefUid };
  return null;
}
async function oldPhoto(exec: SqlExecutor, target: PhotoTarget): Promise<string | null> {
  if (target.kind === "profile") return (await exec.getFirstAsync<{ photo: string | null }>("SELECT photo FROM profile WHERE id=1"))?.photo ?? null;
  if (target.kind === "contact") return (await exec.getFirstAsync<{ photo: string | null }>("SELECT photo FROM contacts WHERE uid=?", [target.uid]))?.photo ?? null;
  return (await exec.getFirstAsync<{ value: string | null }>("SELECT v.value FROM custom_field_values v JOIN contacts c ON c.id=v.contact_id JOIN custom_field_defs d ON d.id=v.field_def_id WHERE v.uid=? AND c.uid=? AND d.uid=? AND d.type='photo'", [target.valueUid,target.uid,target.fieldDefUid]))?.value ?? null;
}
async function canonicalFor(exec: SqlExecutor, target: PhotoTarget): Promise<string | null> {
  if (target.kind === "profile") return profilePhotoRelPath();
  if (target.kind === "contact") { const row = await exec.getFirstAsync<{ id: number }>("SELECT id FROM contacts WHERE uid=?", [target.uid]); return row ? contactPhotoRelPath(row.id) : null; }
  const row = await exec.getFirstAsync<{ id: number; col_name: string }>("SELECT c.id,d.col_name FROM custom_field_values v JOIN contacts c ON c.id=v.contact_id JOIN custom_field_defs d ON d.id=v.field_def_id WHERE v.uid=? AND c.uid=? AND d.uid=? AND d.type='photo'", [target.valueUid,target.uid,target.fieldDefUid]);
  return row ? customFieldPhotoRelPath(row.id, row.col_name) : null;
}
async function stageCandidates(exec: SqlExecutor, plan: Plan, session: string, stage: RestoreApplyDependencies["stagePhoto"]): Promise<{ finalize: FinalizeCandidate[]; deletes: DeleteCandidate[] }> {
  const finalize: FinalizeCandidate[] = []; const deletes: DeleteCandidate[] = [];
  for (const entity of ["profile","contacts","custom_field_values"] as const) for (const a of plan[entity]) {
    if (!a.row) continue; const target = targetFor(entity, a.row as Row); if (!target) continue;
    const photoPresent = Object.prototype.hasOwnProperty.call(a.row, "photoBase64");
    if ((a.kind === "insert" || a.kind === "update") && typeof a.row.photoBase64 === "string") {
      const relativePath = restorePendingRelPath(target, session);
      await stage!(a.row.photoBase64, relativePath);
      finalize.push({ target, relativePath });
    } else if (a.kind === "delete" || ((a.kind === "insert" || a.kind === "update") && photoPresent && a.row.photoBase64 === null)) {
      const existing = await oldPhoto(exec, target); if (existing) deletes.push({ target, canonicalRelativePath: existing, clearReference: a.kind !== "delete" });
    }
  }
  return { finalize, deletes };
}
function entry(action: "finalize" | "delete", relativePath: string, target: PhotoTarget, canonical: string, now: string): RestorePhotoJournalEntry {
  return { relativePath, action, targetKind: target.kind, contactUid: target.kind === "profile" ? null : target.uid, valueUid: target.kind === "customField" ? target.valueUid ?? null : null, fieldDefUid: target.kind === "customField" ? target.fieldDefUid ?? null : null, canonicalRelativePath: canonical, createdAt: now };
}
async function replaceAllReset(exec: SqlExecutor, manifest: BackupManifest, deletes: DeleteCandidate[]): Promise<void> {
  await exec.runAsync("UPDATE app_settings SET sun_contact_id=NULL WHERE id=1");
  for (const r of await exec.getAllAsync<{ uid: string; photo: string | null }>("SELECT uid,photo FROM contacts")) if (r.photo) deletes.push({ target: { kind: "contact", uid: r.uid }, canonicalRelativePath: r.photo, clearReference: false });
  for (const r of await exec.getAllAsync<{ uid: string; contact_uid: string; field_def_uid: string; col_name: string; value: string | null }>("SELECT v.uid,c.uid AS contact_uid,d.uid AS field_def_uid,d.col_name,v.value FROM custom_field_values v JOIN contacts c ON c.id=v.contact_id JOIN custom_field_defs d ON d.id=v.field_def_id WHERE d.type='photo'")) if (r.value) deletes.push({ target: { kind: "customField", uid: r.contact_uid, colName: r.col_name, valueUid: r.uid, fieldDefUid: r.field_def_uid }, canonicalRelativePath: r.value, clearReference: false });
  for (const [type, table] of [["interaction","interactions"],["event","events"],["fuel","fuel"],["custom_field_value","custom_field_values"],["contact_link","contact_links"],["contact","contacts"],["custom_field_def","custom_field_defs"]] as const) for (const r of await exec.getAllAsync<{ uid: string }>(`SELECT uid FROM ${table}`)) await exec.runAsync("INSERT INTO tombstones (entity_type,entity_uid,deleted_at) VALUES (?,?,?) ON CONFLICT(entity_type,entity_uid) DO UPDATE SET deleted_at=CASE WHEN excluded.deleted_at>tombstones.deleted_at THEN excluded.deleted_at ELSE tombstones.deleted_at END", [type,r.uid,manifest.metadata.exportedAt]);
  for (const table of ["interactions","events","fuel","custom_field_values","contact_links","field_history","contacts","custom_field_defs"]) await exec.runAsync(`DELETE FROM ${table}`);
}
async function importTombstones(exec: SqlExecutor, manifest: BackupManifest): Promise<void> { for (const r of manifest.tombstones) await exec.runAsync("INSERT INTO tombstones (entity_type,entity_uid,deleted_at) VALUES (?,?,?) ON CONFLICT(entity_type,entity_uid) DO UPDATE SET deleted_at=CASE WHEN excluded.deleted_at>tombstones.deleted_at THEN excluded.deleted_at ELSE tombstones.deleted_at END", [r.entityType,r.entityUid,r.deletedAt]); }
async function writePhotoReference(exec: SqlExecutor, target: PhotoTarget, relative: string | null): Promise<void> {
  if (target.kind === "profile") { await exec.runAsync("UPDATE profile SET photo=? WHERE id=1", [relative]); return; }
  if (target.kind === "contact") { await exec.runAsync("UPDATE contacts SET photo=? WHERE uid=?", [relative,target.uid]); return; }
  await exec.runAsync("UPDATE custom_field_values SET value=? WHERE uid=?", [relative,target.valueUid]);
}

export async function applyRestore(exec: SqlExecutor, manifest: BackupManifest, mode: RestoreMode, deps: RestoreApplyDependencies = {}): Promise<RestoreApplyResult> {
  assertCompleteIncomingPairs(manifest);
  let preRestoreSnapshotCreated = false;
  const configured = Boolean((await exec.getFirstAsync<{ backup_folder_uri: string | null }>("SELECT backup_folder_uri FROM app_settings WHERE id=1"))?.backup_folder_uri);
  if (mode === "replace-all" && configured) {
    if (!deps.createVerifiedPreRestoreSnapshot || (await deps.createVerifiedPreRestoreSnapshot()).status !== "written") return { status: "pre-restore-snapshot-failed" };
    preRestoreSnapshotCreated = true;
  }
  const [settings, local] = await Promise.all([getPortableSettingsSnapshot(exec), Promise.all(entities.map(async (entity) => [entity,await localRows(exec,entity),await tombstones(exec,entity)] as const))]);
  const plan = {} as Plan; const survivors: Partial<Record<MergeableEntityType, ReadonlySet<string>>> = {}; let incompatibilities = 0;
  if (mode === "replace-all") for (const entity of entities) { plan[entity] = incomingRows(manifest,entity).map((row) => ({ kind: "insert", uid: row.uid, row })); survivors[entity] = new Set(plan[entity].map((a) => a.uid)); }
  else for (const entity of entities) { const [,rows,deleted] = local.find(([candidate]) => candidate === entity)!; const result = reconcileEntity({ entityType: entity, localRows: rows, incomingRows: incomingRows(manifest,entity), localTombstones: deleted, incomingTombstones: incomingTombstones(manifest,entity), parentSurvivors: survivors }); plan[entity] = result.actions; survivors[entity] = result.survivors; incompatibilities += result.incompatibilities.length; }
  if (incompatibilities) return { status: "incompatible-destination", incompatibilities };
  const totals = entities.reduce((out, entity) => { for (const action of plan[entity]) out[action.kind] += 1; return out; }, { insert: 0, update: 0, retain: 0, delete: 0, blocked: 0 });
  const applySettings = mode === "replace-all" || (manifest.appSettings.modifiedAt as string) > settings.modifiedAt;
  if (totals.insert + totals.update + totals.delete === 0 && !applySettings) return { status: "applied", mode, inserted: 0, updated: 0, retained: totals.retain, deleted: 0, blocked: totals.blocked, photosNeedingAttention: 0, photoCleanupPending: 0, scheduleResyncPending: false, preRestoreSnapshotCreated };
  const candidates = await stageCandidates(exec, plan, deps.sessionToken ?? newUid(), deps.stagePhoto ?? stageRestorePendingBase64);
  await inWriteTransaction(exec, async () => {
    if (mode === "replace-all") await replaceAllReset(exec,manifest,candidates.deletes); else for (const entity of [...entities].reverse()) await deleteActions(exec,entity,plan[entity]);
    await importTombstones(exec,manifest); await upsertParents(exec,plan); await upsertContacts(exec,plan); await upsertChildren(exec,plan);
    const contacts = await idMap(exec,"contacts");
    for (const action of writes(plan,"contacts")) await recomputeLastContactCore(exec,contacts.get(action.uid)!,action.row!.modified_at);
    for (const candidate of candidates.finalize) { const canonical = await canonicalFor(exec,candidate.target); if (!canonical) throw new Error("restore photo target disappeared before commit"); await writePhotoReference(exec,candidate.target,canonical); await insertJournalEntryCore(exec,entry("finalize",candidate.relativePath,candidate.target,canonical,manifest.metadata.exportedAt)); }
    for (const candidate of candidates.deletes) if (candidate.clearReference) await writePhotoReference(exec,candidate.target,null);
    for (const candidate of candidates.deletes) await insertJournalEntryCore(exec,entry("delete",`delete:${candidate.canonicalRelativePath}`,candidate.target,candidate.canonicalRelativePath,manifest.metadata.exportedAt));
    if (applySettings) { const uid = manifest.appSettings.sunContactUid; const sun = typeof uid === "string" && survivors.contacts?.has(uid) ? contacts.get(uid) ?? null : null; const patch = Object.fromEntries(Object.entries(manifest.appSettings).filter(([key]) => key !== "modifiedAt" && key !== "sunContactUid")) as AppSettingsPatch; await updateAppSettingsCore(exec,{ ...patch, sunContactId: sun },manifest.appSettings.modifiedAt as string); }
    await bumpDataRevisionCore(exec);
  });
  const persist = deps.persistPhoto ?? persistMaster; const remove = deps.deleteCanonicalPhoto ?? deletePhoto; const exists = deps.canonicalPhotoExists ?? photoFileExists; let photosNeedingAttention = 0; let photoCleanupPending = 0;
  for (const candidate of candidates.finalize) { const canonical = await canonicalFor(exec,candidate.target); if (!canonical) { deleteRestorePending(candidate.relativePath); await deleteJournalEntryCore(exec,candidate.relativePath); continue; } try { await persist(resolveRestorePendingUri(candidate.relativePath),canonical); deleteRestorePending(candidate.relativePath); await deleteJournalEntryCore(exec,candidate.relativePath); } catch { photosNeedingAttention += 1; } }
  for (const candidate of candidates.deletes) { const key = `delete:${candidate.canonicalRelativePath}`; try { remove(candidate.canonicalRelativePath); if (exists(candidate.canonicalRelativePath)) photoCleanupPending += 1; else await deleteJournalEntryCore(exec,key); } catch { photoCleanupPending += 1; } }
  let scheduleResyncPending = false;
  try { await (deps.reconcileNotificationSchedule ?? (() => reconcileSchedule(exec)))(); } catch { scheduleResyncPending = true; }
  try { await (deps.reconcileDigestSchedule ?? (() => reconcileDigestSchedule(exec)))(); } catch { scheduleResyncPending = true; }
  return { status: "applied", mode, inserted: totals.insert, updated: totals.update, retained: totals.retain, deleted: totals.delete, blocked: totals.blocked, photosNeedingAttention, photoCleanupPending, scheduleResyncPending, preRestoreSnapshotCreated };
}
