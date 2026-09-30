/**
 * Restore application owns the write boundary. Reconciliation and durable photo
 * staging happens before its single transaction. Photo journal rows and an
 * exact pending path committed into each background row own crash recovery.
 */
import {
  findVisibleNameCollisions,
  type MergeableEntityType,
  type ReconciliationAction,
  reconcileEntity,
  suppressCategoryTombstoneDependents,
} from "@/backup/reconciliation";
import {
  backgroundsNeedingConsent,
  restoreWritesBackupSettings,
  withDefaultBackgrounds,
} from "@/backup/restore-backgrounds";
import type {
  BackupManifest,
  ReconciliationRow,
  ReconciliationTombstone,
} from "@/backup/types";
import {
  type AppSettingsPatch,
  getPortableSettingsSnapshot,
  updateAppSettingsCore,
} from "@/db/app-settings-dao";
import {
  applyCategoryDeletionFalloutCore,
  readCategoryDeletionPreviewCore,
} from "@/db/categories-dao";
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import {
  remapLegacyChannel,
  remapLegacyQuality,
} from "@/db/interaction-vocabulary";
import { completeGlobalPairsCore } from "@/db/pair-matrix";
import { SAFE_RELATIVE } from "@/db/photo-relative-path";
import { recomputeLastContactCore } from "@/db/recency-dao";
import {
  enqueueDeleteIntentCore,
  insertFinalizeEntryCore,
  type RestorePhotoJournalEntry,
} from "@/db/restore-photo-journal-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
import { reconcileDigestSchedule } from "@/services/notifications/digest-schedule";
import {
  type ReconcileOutcome,
  reconcileSchedule,
} from "@/services/notifications/notification-schedule";
import { finalizeBackgroundRestoreCandidate } from "@/services/photos/background-finalization";
import {
  backgroundDerivativeRelPath,
  deleteBackgroundRestorePending,
  stageBackgroundRestorePendingBase64,
} from "@/services/photos/background-storage";
import { stageLocalPhotoForRestore } from "@/services/photos/merge-photo-rehome";
import {
  executeDeleteIntentOwned,
  finalizeJournalEntryOwned,
  notifyPhotoBytesChanged,
  withCanonicalPathLock,
} from "@/services/photos/owned-master";
import {
  contactPhotoRelPath,
  customFieldPhotoRelPath,
  deletePhoto,
  deleteRestorePending,
  photoFileExists,
  profilePhotoRelPath,
  type RestorePendingTarget,
  restorePendingRelPath,
  stageRestorePendingBase64,
} from "@/services/photos/photo-storage";
import {
  beginStagingSession,
  endStagingSession,
} from "@/services/photos/staging-sessions";

export type RestoreMode = "merge" | "replace-all";
export type PreRestoreSnapshotResult =
  /** `skippedPhotos`: photos the safety backup left out (38.6 D-24). */
  | { status: "written"; skippedPhotos?: number }
  | { status: "failed" | "busy" | "blocked"; reason?: string };
export interface RestoreApplyDependencies {
  /** Required when the destination is configured: failure blocks Replace-all. */
  createVerifiedPreRestoreSnapshot?: () => Promise<PreRestoreSnapshotResult>;
  stagePhoto?: (base64: string, relative: string) => Promise<void>;
  /**
   * Replace-all only (38.6 D-26): stage this phone's current bytes for a row
   * whose backup photo was skipped. Resolves false when there is nothing to
   * stage (the local file is gone). A rejection (the file exists but could not
   * be copied) aborts the whole restore before any write (review CR2-01).
   */
  stageLocalPhoto?: (
    canonicalRelativePath: string,
    pendingRelativePath: string,
  ) => Promise<boolean>;
  persistPhoto?: (
    sourceUri: string,
    canonicalRelativePath: string,
  ) => Promise<unknown>;
  stageBackground?: (
    base64: string,
    templateUid: string,
    sessionToken: string,
  ) => Promise<unknown>;
  persistBackground?: (
    sourceUri: string,
    canonicalRelativePath: string,
  ) => Promise<unknown>;
  deleteStagedBackground?: (relativePath: string) => void;
  deleteCanonicalPhoto?: (canonicalRelativePath: string) => void;
  canonicalPhotoExists?: (canonicalRelativePath: string) => boolean;
  reconcileNotificationSchedule?: () => Promise<ReconcileOutcome | undefined>;
  reconcileDigestSchedule?: () => Promise<void>;
  sessionToken?: string;
  /**
   * What to do with a backup background id the DAO would reject (neither active
   * nor retired; 38.5 D-47). `"reject"` (the default) returns
   * `unavailable-background` before anything is written, but only when the
   * backup's settings will be written (RA-a / D-49): a Merge whose backup
   * settings are not newer than this phone's skips them, so it proceeds and the
   * unavailable id is irrelevant. `"use-default"` is the user's answer to the
   * restore flow's confirmation: the settings mapping writes that package's
   * default slot instead. Retired ids always restore unchanged.
   */
  unavailableBackgrounds?: "reject" | "use-default";
}
export type RestoreApplyResult =
  | {
      status: "applied";
      mode: RestoreMode;
      inserted: number;
      updated: number;
      retained: number;
      deleted: number;
      blocked: number;
      photosNeedingAttention: number;
      photoCleanupPending: number;
      scheduleResyncPending: boolean;
      preRestoreSnapshotCreated: boolean;
      /** Photos the Replace-all safety backup left out (38.6 D-24). */
      preRestoreSnapshotSkippedPhotos: number;
      /**
       * Rows whose backup photo was skipped (D-26 marker) and for which this
       * phone had no photo to keep either, so they end with no photo.
       */
      restoredPhotosMissing: number;
    }
  | { status: "incompatible-destination"; incompatibilities: number }
  | { status: "pre-restore-snapshot-failed" }
  /**
   * An unavailable background id in settings this restore would write, and no
   * consent to the default (D-47, RA-a / D-49).
   */
  | { status: "unavailable-background"; unavailable: number };

type Row = Record<string, unknown> & ReconciliationRow;
type Plan = Record<MergeableEntityType, ReconciliationAction[]>;
type PhotoTarget = RestorePendingTarget & {
  valueUid?: string;
  fieldDefUid?: string;
};
type FinalizeCandidate = { target: PhotoTarget; relativePath: string };
type DeleteCandidate = {
  target: PhotoTarget;
  canonicalRelativePath: string;
  clearReference: boolean;
};
/** Merge (D-26): a skipped-photo row's local reference, written back after the upserts. */
type KeepCandidate = {
  target: PhotoTarget;
  reference: string;
  canonicalBefore: string | null;
};
type BackgroundFinalizeCandidate = {
  uid: string;
  pendingRelativePath: string;
};
type IncomingDef = { colName: string; type: string };
function incomingPhotoDefs(manifest: BackupManifest): Map<string, IncomingDef> {
  const defs = new Map<string, IncomingDef>();
  for (const row of manifest.customFieldDefs)
    if (
      typeof row.uid === "string" &&
      typeof row.colName === "string" &&
      typeof row.type === "string"
    )
      defs.set(row.uid, { colName: row.colName, type: row.type });
  return defs;
}

const entities: readonly MergeableEntityType[] = [
  "categories",
  "profile",
  "contacts",
  "custom_field_defs",
  "systems",
  "profile_layout_templates",
  "profile_background_templates",
  "ai_connections",
  "personalization_sections",
  "group_events",
  "system_rules",
  "system_overrides",
  "system_prefs",
  "contact_methods",
  "external_contact_links",
  "contact_method_provenance",
  "interactions",
  "events",
  "fuel",
  "contact_links",
  "custom_field_values",
  "custom_field_value_history",
  "memories",
  "relationships",
  "current_state_entries",
  "profile_contact_presentation",
  "profile_category_presentation",
];
const tableOf: Record<MergeableEntityType, string> = Object.fromEntries(
  entities.map((entity) => [entity, entity]),
) as Record<MergeableEntityType, string>;
tableOf.profile = "profile";
const tombstoneEntity: Record<MergeableEntityType, string | null> = {
  contacts: "contact",
  contact_methods: "contact_method",
  external_contact_links: "external_contact_link",
  contact_method_provenance: "contact_method_provenance",
  interactions: "interaction",
  events: "event",
  fuel: "fuel",
  contact_links: "contact_link",
  custom_field_defs: "custom_field_def",
  custom_field_values: "custom_field_value",
  custom_field_value_history: "custom_field_value_history",
  categories: "category",
  profile: null,
  memories: "memory",
  relationships: "relationship",
  current_state_entries: "current_state_entry",
  systems: null,
  system_rules: null,
  system_overrides: null,
  system_prefs: null,
  profile_layout_templates: null,
  profile_background_templates: null,
  ai_connections: null,
  personalization_sections: null,
  group_events: "group_event",
  profile_contact_presentation: null,
  profile_category_presentation: null,
};

function incomingRows(
  manifest: BackupManifest,
  entity: MergeableEntityType,
): Row[] {
  const keyOf: Partial<Record<MergeableEntityType, keyof BackupManifest>> = {
    contact_links: "contactLinks",
    contact_methods: "contactMethods",
    external_contact_links: "externalContactLinks",
    contact_method_provenance: "contactMethodProvenance",
    custom_field_defs: "customFieldDefs",
    custom_field_values: "customFieldValues",
    custom_field_value_history: "customFieldValueHistory",
    current_state_entries: "currentStateEntries",
    system_rules: "systemRules",
    system_overrides: "systemOverrides",
    system_prefs: "systemPrefs",
    profile_layout_templates: "profileLayoutTemplates",
    profile_background_templates: "profileBackgroundTemplates",
    ai_connections: "aiConnections",
    personalization_sections: "personalizationSections",
    group_events: "groupEvents",
    profile_contact_presentation: "profileContactPresentation",
    profile_category_presentation: "profileCategoryPresentation",
  };
  const raw: Record<string, unknown>[] =
    entity === "profile"
      ? manifest.profile
        ? [manifest.profile]
        : []
      : ((keyOf[entity]
          ? manifest[keyOf[entity]!]
          : manifest[entity as keyof BackupManifest]) as Record<
          string,
          unknown
        >[]);
  return raw.map(
    (row) =>
      ({
        ...row,
        uid: row.uid ?? row.contactUid ?? row.categoryUid,
        modified_at: row.modifiedAt as string,
      }) as Row,
  );
}
async function localRows(
  exec: SqlExecutor,
  entity: MergeableEntityType,
): Promise<Row[]> {
  const sql: Record<MergeableEntityType, string> = {
    categories:
      "SELECT uid,name,display_order AS displayOrder,created_at AS createdAt,modified_at FROM categories",
    profile: "SELECT uid,name,created_at AS createdAt,modified_at FROM profile",
    contacts:
      "SELECT c.uid,c.name,cat.uid AS categoryUid,c.tracking_enabled AS trackingEnabled,c.interval_days AS intervalDays,c.social_battery AS socialBattery,c.birthday,c.archived_at AS archivedAt,c.snooze_until AS snoozeUntil,c.rarely_responds AS rarelyResponds,c.reminders_off AS remindersOff,c.created_at AS createdAt,c.modified_at FROM contacts c LEFT JOIN categories cat ON cat.id=c.category_id",
    contact_methods:
      "SELECT m.uid,c.uid AS contactUid,m.method_type AS methodType,m.raw_value AS rawValue,m.display_value AS displayValue,m.canonical_value AS canonicalValue,m.canonical_region AS canonicalRegion,m.label,m.extension,m.is_actionable AS isActionable,m.is_primary AS isPrimary,m.display_order AS displayOrder,m.created_at AS createdAt,m.modified_at FROM contact_methods m JOIN contacts c ON c.id=m.contact_id",
    external_contact_links:
      "SELECT l.uid,c.uid AS contactUid,l.provider,l.external_contact_id AS externalContactId,l.is_active AS isActive,l.created_at AS createdAt,l.modified_at FROM external_contact_links l JOIN contacts c ON c.id=l.contact_id",
    contact_method_provenance:
      "SELECT p.uid,m.uid AS methodUid,l.uid AS externalContactLinkUid,p.source_method_id AS sourceMethodId,p.created_at AS createdAt,p.modified_at FROM contact_method_provenance p JOIN contact_methods m ON m.id=p.method_id LEFT JOIN external_contact_links l ON l.id=p.external_contact_link_id",
    interactions:
      "SELECT i.uid,c.uid AS contactUid,ge.uid AS groupEventUid,i.occurred_at AS occurredAt,i.recorded_at AS recordedAt,i.channel,i.direction,i.connected,i.quality,i.note,i.duration,i.allow_ai AS allowAi,i.ge_follow_channel AS geFollowChannel,i.ge_follow_quality AS geFollowQuality,i.ge_follow_duration AS geFollowDuration,i.source,i.modified_at FROM interactions i JOIN contacts c ON c.id=i.contact_id LEFT JOIN group_events ge ON ge.id=i.group_event_id",
    events:
      "SELECT e.uid,c.uid AS contactUid,e.type,e.occurred_at AS occurredAt,e.detail,e.recorded_at AS recordedAt,e.modified_at FROM events e JOIN contacts c ON c.id=e.contact_id",
    fuel: "SELECT f.uid,c.uid AS contactUid,f.kind,f.label,f.text,f.url,f.created_at AS createdAt,f.source,f.modified_at FROM fuel f JOIN contacts c ON c.id=f.contact_id",
    contact_links:
      "SELECT l.uid,c.uid AS contactUid,l.url,l.label,l.display_order AS displayOrder,l.created_at AS createdAt,l.modified_at FROM contact_links l JOIN contacts c ON c.id=l.contact_id",
    custom_field_defs:
      "SELECT uid,col_name AS colName,label,type,options,show_on_new AS showOnNew,always_show AS alwaysShow,display_order AS displayOrder,quarantined_at AS quarantinedAt,share_with_ai AS shareWithAi,scope,history_retained AS historyRetained,field_group AS fieldGroup,created_at AS createdAt,modified_at FROM custom_field_defs",
    custom_field_values:
      "SELECT v.uid,c.uid AS contactUid,d.uid AS fieldDefUid,d.type AS fieldType,d.col_name AS colName,v.value,v.created_at AS createdAt,v.modified_at FROM custom_field_values v JOIN contacts c ON c.id=v.contact_id JOIN custom_field_defs d ON d.id=v.field_def_id",
    custom_field_value_history:
      "SELECT h.uid,c.uid AS contactUid,d.uid AS fieldDefUid,h.value,h.created_at AS createdAt,h.created_at AS modified_at FROM custom_field_value_history h JOIN contacts c ON c.id=h.contact_id JOIN custom_field_defs d ON d.id=h.field_def_id",
    memories:
      "SELECT m.uid,c.uid AS contactUid,m.type,m.custom_label AS customLabel,m.value,m.note,m.url,m.meaningful_date AS meaningfulDate,m.pinned,m.outdated,m.hidden,m.provenance,m.allow_ai AS allowAi,m.created_at AS createdAt,m.modified_at,m.deleted_at AS deletedAt FROM memories m JOIN contacts c ON c.id=m.contact_id",
    relationships:
      "SELECT r.uid,c.uid AS contactUid,r.person_name AS personName,r.relation_type AS relationType,linked.uid AS linkedContactUid,r.note,r.pinned,r.hidden,r.created_at AS createdAt,r.modified_at,r.deleted_at AS deletedAt FROM relationships r JOIN contacts c ON c.id=r.contact_id LEFT JOIN contacts linked ON linked.id=r.linked_contact_id",
    current_state_entries:
      "SELECT s.uid,c.uid AS contactUid,s.field_key AS fieldKey,s.value,s.is_current AS isCurrent,s.created_at AS createdAt,s.modified_at FROM current_state_entries s JOIN contacts c ON c.id=s.contact_id",
    systems: "SELECT uid,name,created_at AS createdAt,modified_at FROM systems",
    system_rules:
      "SELECT r.uid,s.uid AS systemUid,r.family,r.value,r.created_at AS createdAt,r.created_at AS modified_at FROM system_rules r JOIN systems s ON s.id=r.system_id",
    system_overrides:
      "SELECT o.uid,o.system_ref AS systemRef,c.uid AS contactUid,o.mode,o.created_at AS createdAt,o.created_at AS modified_at FROM system_overrides o JOIN contacts c ON c.id=o.contact_id",
    system_prefs:
      "SELECT uid,system_ref AS systemRef,display_order AS displayOrder,hidden,created_at AS createdAt,modified_at FROM system_prefs",
    profile_layout_templates:
      "SELECT uid,name,layout_json AS layoutJson,created_at AS createdAt,modified_at FROM profile_layout_templates",
    profile_background_templates:
      "SELECT uid,name,image_path AS imagePath,created_at AS createdAt,modified_at FROM profile_background_templates",
    ai_connections:
      "SELECT uid,lane,remembered_model AS rememberedModel,custom_endpoint AS customEndpoint,custom_model AS customModel,configured_at AS configuredAt,created_at AS createdAt,modified_at FROM ai_connections",
    personalization_sections:
      "SELECT uid,title,body,enabled,display_order AS displayOrder,created_at AS createdAt,modified_at FROM personalization_sections",
    group_events:
      "SELECT uid,title,occurred_at AS occurredAt,channel,quality,duration,group_note AS groupNote,created_at AS createdAt,modified_at FROM group_events",
    profile_contact_presentation:
      "SELECT c.uid,c.uid AS contactUid,p.layout_template_uid AS layoutTemplateUid,p.freeform_layout_json AS freeformLayoutJson,p.background_template_uid AS backgroundTemplateUid,p.collapse_json AS collapseJson,p.created_at AS createdAt,p.modified_at FROM profile_contact_presentation p JOIN contacts c ON c.id=p.contact_id",
    profile_category_presentation:
      "SELECT c.uid,c.uid AS categoryUid,p.layout_template_uid AS layoutTemplateUid,p.background_template_uid AS backgroundTemplateUid,p.created_at AS createdAt,p.modified_at FROM profile_category_presentation p JOIN categories c ON c.id=p.category_id",
  };
  return exec.getAllAsync<Row>(sql[entity]);
}
async function tombstones(
  exec: SqlExecutor,
  entity: MergeableEntityType,
): Promise<ReconciliationTombstone[]> {
  const type = tombstoneEntity[entity];
  return type
    ? exec.getAllAsync<{ entity_uid: string; deleted_at: string }>(
        "SELECT entity_uid,deleted_at FROM tombstones WHERE entity_type=?",
        [type],
      )
    : [];
}
function incomingTombstones(
  manifest: BackupManifest,
  entity: MergeableEntityType,
): ReconciliationTombstone[] {
  const type = tombstoneEntity[entity];
  return type
    ? manifest.tombstones
        .filter((row) => row.entityType === type)
        .map((row) => ({
          entity_uid: row.entityUid,
          deleted_at: row.deletedAt,
        }))
    : [];
}
async function idMap(
  exec: SqlExecutor,
  table:
    | "contacts"
    | "categories"
    | "custom_field_defs"
    | "contact_methods"
    | "external_contact_links"
    | "systems"
    | "group_events",
): Promise<Map<string, number>> {
  return new Map(
    (
      await exec.getAllAsync<{ uid: string; id: number }>(
        `SELECT uid,id FROM ${table}`,
      )
    ).map((row) => [row.uid, row.id]),
  );
}
function writes(
  plan: Plan,
  entity: MergeableEntityType,
): ReconciliationAction[] {
  return plan[entity].filter((a) => a.kind === "insert" || a.kind === "update");
}
function updateRetained(action: ReconciliationAction): void {
  if (action.kind === "retain") action.kind = "update";
}
function normalizedWinner(
  actions: ReconciliationAction[],
): ReconciliationAction {
  return [...actions].sort((left, right) => {
    const stamp = String(right.row?.modified_at ?? "").localeCompare(
      String(left.row?.modified_at ?? ""),
    );
    return stamp || left.uid.localeCompare(right.uid);
  })[0]!;
}
/** Normalize natural-key collisions after UID reconciliation, before survivors and writes are derived. */
function normalizePlan(plan: Plan): void {
  const redirects = new Map<string, string>();
  const liveMethods = plan.contact_methods.filter(
    (action) =>
      action.row && ["insert", "update", "retain"].includes(action.kind),
  );
  const byCanonical = new Map<string, ReconciliationAction[]>();
  for (const action of liveMethods) {
    const row = action.row!;
    if (
      typeof row.canonicalValue !== "string" ||
      row.canonicalValue.length === 0
    )
      continue;
    const key = `${row.contactUid}\0${row.methodType}\0${row.canonicalValue}`;
    byCanonical.set(key, [...(byCanonical.get(key) ?? []), action]);
  }
  for (const actions of byCanonical.values())
    if (actions.length > 1) {
      const winner = normalizedWinner(actions);
      for (const loser of actions)
        if (loser !== winner) {
          redirects.set(loser.uid, winner.uid);
          loser.kind = "delete";
        }
    }
  for (const action of plan.contact_method_provenance) {
    if (
      action.row &&
      typeof action.row.methodUid === "string" &&
      redirects.has(action.row.methodUid)
    ) {
      action.row.methodUid = redirects.get(action.row.methodUid)!;
      updateRetained(action);
    }
  }
  const livePrimary = plan.contact_methods.filter(
    (action) =>
      action.row &&
      action.kind !== "delete" &&
      action.kind !== "blocked" &&
      action.row.isPrimary === 1,
  );
  const byPrimary = new Map<string, ReconciliationAction[]>();
  for (const action of livePrimary) {
    const row = action.row!;
    const key = `${row.contactUid}\0${row.methodType}`;
    byPrimary.set(key, [...(byPrimary.get(key) ?? []), action]);
  }
  for (const actions of byPrimary.values())
    if (actions.length > 1) {
      const winner = normalizedWinner(actions);
      for (const loser of actions)
        if (loser !== winner) {
          loser.row!.isPrimary = 0;
          updateRetained(loser);
        }
    }
  const liveLinks = plan.external_contact_links.filter(
    (action) =>
      action.row &&
      action.kind !== "delete" &&
      action.kind !== "blocked" &&
      action.row.isActive === 1,
  );
  const byActiveLink = new Map<string, ReconciliationAction[]>();
  for (const action of liveLinks) {
    const row = action.row!;
    const key = `${row.provider}\0${row.externalContactId}`;
    byActiveLink.set(key, [...(byActiveLink.get(key) ?? []), action]);
  }
  for (const actions of byActiveLink.values())
    if (actions.length > 1) {
      const winner = normalizedWinner(actions);
      for (const loser of actions)
        if (loser !== winner) {
          loser.row!.isActive = 0;
          updateRetained(loser);
        }
    }
  const liveCurrent = plan.current_state_entries.filter(
    (action) =>
      action.row &&
      action.kind !== "delete" &&
      action.kind !== "blocked" &&
      action.row.isCurrent === 1,
  );
  const byCurrent = new Map<string, ReconciliationAction[]>();
  for (const action of liveCurrent) {
    const row = action.row!;
    const key = `${row.contactUid}\0${row.fieldKey}`;
    byCurrent.set(key, [...(byCurrent.get(key) ?? []), action]);
  }
  for (const actions of byCurrent.values())
    if (actions.length > 1) {
      const winner = normalizedWinner(actions);
      for (const loser of actions)
        if (loser !== winner) {
          loser.row!.isCurrent = 0;
          updateRetained(loser);
        }
    }
}
/** Resolve the v11 one-way cadence invariant before opening the restore transaction. */
function retainAssignedCadence(
  plan: Plan,
  localContacts: ReadonlyMap<string, Row>,
): void {
  for (const action of writes(plan, "contacts")) {
    const incoming = action.row as Row;
    const localCadence = localContacts.get(action.uid)?.intervalDays;
    if (
      incoming.trackingEnabled === 0 &&
      incoming.intervalDays === null &&
      Number.isInteger(localCadence) &&
      (localCadence as number) > 0
    ) {
      incoming.intervalDays = localCadence;
    }
  }
}
function survivorSet(actions: ReconciliationAction[]): ReadonlySet<string> {
  return new Set(
    actions
      .filter(
        (action) =>
          ["insert", "update", "retain"].includes(action.kind) && action.row,
      )
      .map((action) => action.uid),
  );
}
function assertCompleteIncomingPairs(manifest: BackupManifest): void {
  const pairs = new Set(
    manifest.customFieldValues.map(
      (row) => `${row.contactUid}\0${row.fieldDefUid}`,
    ),
  );
  // Scope-aware: only GLOBAL-scope defs (or scope-absent, older backups) seed a
  // value row for every contact, so only they require the full contact×def pair
  // set. A contact-scoped def (Plan 05) legitimately owns a partial set; its
  // parent membership is still validated by backup-schema before this runs.
  for (const def of manifest.customFieldDefs) {
    const scope = def.scope;
    if (scope !== undefined && scope !== null && scope !== "global") continue;
    for (const contact of manifest.contacts)
      if (!pairs.has(`${contact.uid}\0${def.uid}`))
        throw new Error(
          "restore manifest is missing a normalized custom-field value pair",
        );
  }
}
async function deleteActions(
  exec: SqlExecutor,
  entity: MergeableEntityType,
  items: ReconciliationAction[],
): Promise<void> {
  for (const action of items)
    if (action.kind === "delete") {
      if (entity === "profile_contact_presentation")
        await exec.runAsync(
          "DELETE FROM profile_contact_presentation WHERE contact_id=(SELECT id FROM contacts WHERE uid=?)",
          [action.uid],
        );
      else if (entity === "profile_category_presentation")
        await exec.runAsync(
          "DELETE FROM profile_category_presentation WHERE category_id=(SELECT id FROM categories WHERE uid=?)",
          [action.uid],
        );
      else
        await exec.runAsync(`DELETE FROM ${tableOf[entity]} WHERE uid=?`, [
          action.uid,
        ]);
    }
}
async function upsertParents(
  exec: SqlExecutor,
  plan: Plan,
  backgroundPendingByUid: ReadonlyMap<string, string>,
): Promise<void> {
  for (const a of writes(plan, "categories")) {
    const r = a.row!;
    await exec.runAsync(
      "INSERT INTO categories (uid,name,display_order,created_at,modified_at) VALUES (?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET name=excluded.name,display_order=excluded.display_order,modified_at=excluded.modified_at",
      [r.uid, r.name, r.displayOrder, r.createdAt, r.modified_at],
    );
  }
  for (const a of writes(plan, "profile")) {
    const r = a.row!;
    await exec.runAsync(
      "UPDATE profile SET uid=?,name=?,modified_at=? WHERE id=1",
      [r.uid, r.name ?? null, r.modified_at],
    );
  }
  for (const a of writes(plan, "custom_field_defs")) {
    const r = a.row!;
    await exec.runAsync(
      "INSERT INTO custom_field_defs (uid,col_name,label,type,options,show_on_new,always_show,display_order,quarantined_at,share_with_ai,scope,history_retained,field_group,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET col_name=excluded.col_name,label=excluded.label,type=excluded.type,options=excluded.options,show_on_new=excluded.show_on_new,always_show=excluded.always_show,display_order=excluded.display_order,quarantined_at=excluded.quarantined_at,share_with_ai=excluded.share_with_ai,scope=excluded.scope,history_retained=excluded.history_retained,field_group=excluded.field_group,modified_at=excluded.modified_at",
      [
        r.uid,
        r.colName,
        r.label,
        r.type,
        r.options ?? null,
        r.showOnNew,
        r.alwaysShow,
        r.displayOrder,
        r.quarantinedAt ?? null,
        r.shareWithAi,
        r.scope ?? "global",
        r.historyRetained ?? 0,
        r.fieldGroup ?? null,
        r.createdAt,
        r.modified_at,
      ],
    );
  }
  for (const a of writes(plan, "systems")) {
    const r = a.row!;
    await exec.runAsync(
      "INSERT INTO systems(uid,name,created_at,modified_at) VALUES(?,?,?,?) ON CONFLICT(uid) DO UPDATE SET name=excluded.name,modified_at=excluded.modified_at",
      [r.uid, r.name, r.createdAt, r.modified_at],
    );
  }
  for (const a of writes(plan, "profile_layout_templates")) {
    const r = a.row!;
    await exec.runAsync(
      "INSERT INTO profile_layout_templates(uid,name,layout_json,created_at,modified_at) VALUES(?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET name=excluded.name,layout_json=excluded.layout_json,modified_at=excluded.modified_at",
      [r.uid, r.name, r.layoutJson, r.createdAt, r.modified_at],
    );
  }
  for (const a of writes(plan, "profile_background_templates")) {
    const r = a.row!;
    await exec.runAsync(
      "INSERT INTO profile_background_templates(uid,name,image_path,created_at,modified_at) VALUES(?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET name=excluded.name,image_path=excluded.image_path,modified_at=excluded.modified_at",
      [
        r.uid,
        r.name,
        backgroundPendingByUid.get(r.uid) ?? backgroundDerivativeRelPath(r.uid),
        r.createdAt,
        r.modified_at,
      ],
    );
  }
  for (const a of writes(plan, "ai_connections")) {
    const r = a.row!;
    await exec.runAsync(
      "INSERT INTO ai_connections(uid,lane,remembered_model,custom_endpoint,custom_model,configured_at,created_at,modified_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET lane=excluded.lane,remembered_model=excluded.remembered_model,custom_endpoint=excluded.custom_endpoint,custom_model=excluded.custom_model,configured_at=excluded.configured_at,modified_at=excluded.modified_at",
      [
        r.uid,
        r.lane,
        r.rememberedModel,
        r.customEndpoint,
        r.customModel,
        r.configuredAt ?? null,
        r.createdAt,
        r.modified_at,
      ],
    );
  }
  for (const a of writes(plan, "personalization_sections")) {
    const r = a.row!;
    await exec.runAsync(
      "INSERT INTO personalization_sections(uid,title,body,enabled,display_order,created_at,modified_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET title=excluded.title,body=excluded.body,enabled=excluded.enabled,display_order=excluded.display_order,modified_at=excluded.modified_at",
      [
        r.uid,
        r.title,
        r.body,
        r.enabled,
        r.displayOrder,
        r.createdAt,
        r.modified_at,
      ],
    );
  }
  for (const a of writes(plan, "group_events")) {
    const r = a.row!;
    await exec.runAsync(
      "INSERT INTO group_events(uid,title,occurred_at,channel,quality,duration,group_note,created_at,modified_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET title=excluded.title,occurred_at=excluded.occurred_at,channel=excluded.channel,quality=excluded.quality,duration=excluded.duration,group_note=excluded.group_note,modified_at=excluded.modified_at",
      [
        r.uid,
        r.title,
        r.occurredAt,
        r.channel ?? null,
        r.quality ?? null,
        r.duration ?? null,
        r.groupNote ?? null,
        r.createdAt,
        r.modified_at,
      ],
    );
  }
}
async function upsertContacts(exec: SqlExecutor, plan: Plan): Promise<void> {
  const categories = await idMap(exec, "categories");
  for (const a of writes(plan, "contacts")) {
    const r = a.row!;
    const category =
      typeof r.categoryUid === "string"
        ? (categories.get(r.categoryUid) ?? null)
        : null;
    await exec.runAsync(
      "INSERT INTO contacts (uid,name,category_id,tracking_enabled,interval_days,social_battery,birthday,archived_at,snooze_until,rarely_responds,reminders_off,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET name=excluded.name,category_id=excluded.category_id,tracking_enabled=excluded.tracking_enabled,interval_days=excluded.interval_days,social_battery=excluded.social_battery,birthday=excluded.birthday,archived_at=excluded.archived_at,snooze_until=excluded.snooze_until,rarely_responds=excluded.rarely_responds,reminders_off=excluded.reminders_off,modified_at=excluded.modified_at",
      [
        r.uid,
        r.name,
        category,
        r.trackingEnabled,
        r.intervalDays,
        r.socialBattery ?? null,
        r.birthday ?? null,
        r.archivedAt ?? null,
        r.snoozeUntil ?? null,
        r.rarelyResponds,
        r.remindersOff,
        r.createdAt,
        r.modified_at,
      ],
    );
  }
}
async function upsertChildren(exec: SqlExecutor, plan: Plan): Promise<void> {
  const contacts = await idMap(exec, "contacts");
  const defs = await idMap(exec, "custom_field_defs");
  const systems = await idMap(exec, "systems");
  const groupEvents = await idMap(exec, "group_events");
  for (const a of writes(plan, "system_rules")) {
    const r = a.row!;
    const system = systems.get(r.systemUid as string);
    if (!system) throw new Error("restore System disappeared during apply");
    await exec.runAsync(
      "INSERT INTO system_rules(uid,system_id,family,value,created_at) VALUES(?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET system_id=excluded.system_id,family=excluded.family,value=excluded.value",
      [r.uid, system, r.family, r.value, r.createdAt],
    );
  }
  for (const a of writes(plan, "system_overrides")) {
    const r = a.row!;
    const contact = contacts.get(r.contactUid as string);
    if (!contact)
      throw new Error(
        "restore contact disappeared during System override apply",
      );
    await exec.runAsync(
      "INSERT INTO system_overrides(uid,system_ref,contact_id,mode,created_at) VALUES(?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET system_ref=excluded.system_ref,contact_id=excluded.contact_id,mode=excluded.mode",
      [r.uid, r.systemRef, contact, r.mode, r.createdAt],
    );
  }
  for (const a of writes(plan, "system_prefs")) {
    const r = a.row!;
    await exec.runAsync(
      "INSERT INTO system_prefs(uid,system_ref,display_order,hidden,created_at,modified_at) VALUES(?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET system_ref=excluded.system_ref,display_order=excluded.display_order,hidden=excluded.hidden,modified_at=excluded.modified_at",
      [
        r.uid,
        r.systemRef,
        r.displayOrder ?? null,
        r.hidden,
        r.createdAt,
        r.modified_at,
      ],
    );
  }
  for (const entity of [
    "contact_methods",
    "external_contact_links",
    "interactions",
    "events",
    "fuel",
    "contact_links",
    "custom_field_values",
    "custom_field_value_history",
    "memories",
    "relationships",
    "current_state_entries",
  ] as const)
    for (const a of writes(plan, entity).sort((left, right) => {
      const leftActive =
        entity === "contact_methods"
          ? left.row?.isPrimary
          : entity === "external_contact_links"
            ? left.row?.isActive
            : 0;
      const rightActive =
        entity === "contact_methods"
          ? right.row?.isPrimary
          : entity === "external_contact_links"
            ? right.row?.isActive
            : 0;
      return (
        Number(leftActive) - Number(rightActive) ||
        left.uid.localeCompare(right.uid)
      );
    })) {
      const r = a.row!;
      const contact = contacts.get(r.contactUid as string);
      if (!contact) throw new Error("restore parent disappeared during apply");
      if (entity === "contact_methods")
        await exec.runAsync(
          "INSERT INTO contact_methods (uid,contact_id,method_type,raw_value,display_value,canonical_value,canonical_region,label,extension,is_actionable,is_primary,display_order,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET contact_id=excluded.contact_id,method_type=excluded.method_type,raw_value=excluded.raw_value,display_value=excluded.display_value,canonical_value=excluded.canonical_value,canonical_region=excluded.canonical_region,label=excluded.label,extension=excluded.extension,is_actionable=excluded.is_actionable,is_primary=excluded.is_primary,display_order=excluded.display_order,modified_at=excluded.modified_at",
          [
            r.uid,
            contact,
            r.methodType,
            r.rawValue,
            r.displayValue,
            r.canonicalValue ?? null,
            r.canonicalRegion ?? null,
            r.label ?? null,
            r.extension ?? null,
            r.isActionable,
            r.isPrimary,
            r.displayOrder,
            r.createdAt,
            r.modified_at,
          ],
        );
      if (entity === "external_contact_links")
        await exec.runAsync(
          "INSERT INTO external_contact_links (uid,contact_id,provider,external_contact_id,is_active,created_at,modified_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET contact_id=excluded.contact_id,provider=excluded.provider,external_contact_id=excluded.external_contact_id,is_active=excluded.is_active,modified_at=excluded.modified_at",
          [
            r.uid,
            contact,
            r.provider,
            r.externalContactId,
            r.isActive,
            r.createdAt,
            r.modified_at,
          ],
        );
      // The restore writer of interactions is a SEPARATE writer from migration 025:
      // remap legacy quality/channel on ingest via Plan 01's SHARED map (D-06 single
      // source of truth) so a pre-Phase-32 backup can't reintroduce good/fine/hard/
      // text/email onto a v25 device and re-open the AI-context/digest miscount. Bound
      // as the remapped value so `excluded.quality`/`excluded.channel` carry it on BOTH
      // the INSERT and the ON CONFLICT UPDATE paths. The SET arm also forces allow_ai=0
      // (fail-closed consent, D-04): SQLite's column DEFAULT 0 fires only on fresh
      // INSERT, so without this a merge-mode UPDATE (emitted only when the field-less
      // backup row WINS reconciliation) would silently preserve an existing allow_ai=1.
      // duration/allow_ai stay OUT of the INSERT column list / wire payload — Phase 36
      // owns serialization + the format bump.
      if (entity === "interactions") {
        const groupEvent =
          typeof r.groupEventUid === "string"
            ? (groupEvents.get(r.groupEventUid) ?? null)
            : null;
        await exec.runAsync(
          "INSERT INTO interactions (uid,contact_id,occurred_at,recorded_at,channel,direction,connected,quality,note,duration,allow_ai,group_event_id,ge_follow_channel,ge_follow_quality,ge_follow_duration,source,modified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET contact_id=excluded.contact_id,occurred_at=excluded.occurred_at,recorded_at=excluded.recorded_at,channel=excluded.channel,direction=excluded.direction,connected=excluded.connected,quality=excluded.quality,note=excluded.note,duration=excluded.duration,allow_ai=excluded.allow_ai,group_event_id=excluded.group_event_id,ge_follow_channel=excluded.ge_follow_channel,ge_follow_quality=excluded.ge_follow_quality,ge_follow_duration=excluded.ge_follow_duration,source=excluded.source,modified_at=excluded.modified_at",
          [
            r.uid,
            contact,
            r.occurredAt,
            r.recordedAt,
            remapLegacyChannel(r.channel as string | null | undefined),
            r.direction ?? null,
            r.connected,
            remapLegacyQuality((r.quality ?? null) as string | null),
            r.note ?? null,
            r.duration ?? null,
            r.allowAi ?? 0,
            groupEvent,
            r.geFollowChannel ?? null,
            r.geFollowQuality ?? null,
            r.geFollowDuration ?? null,
            r.source,
            r.modified_at,
          ],
        );
      }
      if (entity === "events")
        await exec.runAsync(
          "INSERT INTO events (uid,contact_id,type,occurred_at,detail,recorded_at,modified_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET contact_id=excluded.contact_id,type=excluded.type,occurred_at=excluded.occurred_at,detail=excluded.detail,recorded_at=excluded.recorded_at,modified_at=excluded.modified_at",
          [
            r.uid,
            contact,
            r.type,
            r.occurredAt,
            r.detail ?? null,
            r.recordedAt,
            r.modified_at,
          ],
        );
      if (entity === "fuel")
        await exec.runAsync(
          "INSERT INTO fuel (uid,contact_id,kind,label,text,url,created_at,source,modified_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET contact_id=excluded.contact_id,kind=excluded.kind,label=excluded.label,text=excluded.text,url=excluded.url,created_at=excluded.created_at,source=excluded.source,modified_at=excluded.modified_at",
          [
            r.uid,
            contact,
            r.kind,
            r.label ?? null,
            r.text ?? null,
            r.url ?? null,
            r.createdAt,
            r.source,
            r.modified_at,
          ],
        );
      if (entity === "contact_links")
        await exec.runAsync(
          "INSERT INTO contact_links (uid,contact_id,url,label,display_order,created_at,modified_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET contact_id=excluded.contact_id,url=excluded.url,label=excluded.label,display_order=excluded.display_order,created_at=excluded.created_at,modified_at=excluded.modified_at",
          [
            r.uid,
            contact,
            r.url,
            r.label ?? null,
            r.displayOrder,
            r.createdAt,
            r.modified_at,
          ],
        );
      if (entity === "custom_field_values") {
        const def = defs.get(r.fieldDefUid as string);
        if (!def)
          throw new Error("restore definition disappeared during apply");
        await exec.runAsync(
          "INSERT INTO custom_field_values (uid,contact_id,field_def_id,value,created_at,modified_at) VALUES (?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET contact_id=excluded.contact_id,field_def_id=excluded.field_def_id,value=excluded.value,modified_at=excluded.modified_at",
          [r.uid, contact, def, r.value ?? null, r.createdAt, r.modified_at],
        );
      }
      if (entity === "custom_field_value_history") {
        const def = defs.get(r.fieldDefUid as string);
        if (!def)
          throw new Error("restore definition disappeared during apply");
        await exec.runAsync(
          "INSERT INTO custom_field_value_history (uid,contact_id,field_def_id,value,created_at) VALUES (?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET contact_id=excluded.contact_id,field_def_id=excluded.field_def_id,value=excluded.value,created_at=excluded.created_at",
          [r.uid, contact, def, r.value ?? null, r.createdAt],
        );
      }
      if (entity === "memories")
        await exec.runAsync(
          "INSERT INTO memories (uid,contact_id,type,custom_label,value,note,url,meaningful_date,pinned,outdated,hidden,provenance,allow_ai,created_at,modified_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET contact_id=excluded.contact_id,type=excluded.type,custom_label=excluded.custom_label,value=excluded.value,note=excluded.note,url=excluded.url,meaningful_date=excluded.meaningful_date,pinned=excluded.pinned,outdated=excluded.outdated,hidden=excluded.hidden,provenance=excluded.provenance,allow_ai=excluded.allow_ai,modified_at=excluded.modified_at,deleted_at=excluded.deleted_at",
          [
            r.uid,
            contact,
            r.type,
            r.customLabel ?? null,
            r.value ?? null,
            r.note ?? null,
            r.url ?? null,
            r.meaningfulDate ?? null,
            r.pinned,
            r.outdated,
            r.hidden ?? null,
            r.provenance,
            r.allowAi ?? 0,
            r.createdAt,
            r.modified_at,
            r.deletedAt ?? null,
          ],
        );
      if (entity === "relationships") {
        const linked =
          typeof r.linkedContactUid === "string"
            ? (contacts.get(r.linkedContactUid) ?? null)
            : null;
        await exec.runAsync(
          "INSERT INTO relationships (uid,contact_id,person_name,relation_type,linked_contact_id,note,pinned,hidden,created_at,modified_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET contact_id=excluded.contact_id,person_name=excluded.person_name,relation_type=excluded.relation_type,linked_contact_id=excluded.linked_contact_id,note=excluded.note,pinned=excluded.pinned,hidden=excluded.hidden,modified_at=excluded.modified_at,deleted_at=excluded.deleted_at",
          [
            r.uid,
            contact,
            r.personName,
            r.relationType ?? null,
            linked,
            r.note ?? null,
            r.pinned,
            r.hidden ?? null,
            r.createdAt,
            r.modified_at,
            r.deletedAt ?? null,
          ],
        );
      }
      if (entity === "current_state_entries")
        await exec.runAsync(
          "INSERT INTO current_state_entries (uid,contact_id,field_key,value,is_current,created_at,modified_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET contact_id=excluded.contact_id,field_key=excluded.field_key,value=excluded.value,is_current=excluded.is_current,modified_at=excluded.modified_at",
          [
            r.uid,
            contact,
            r.fieldKey,
            r.value,
            r.isCurrent,
            r.createdAt,
            r.modified_at,
          ],
        );
    }
  const methods = await idMap(exec, "contact_methods");
  const externalLinks = await idMap(exec, "external_contact_links");
  for (const a of writes(plan, "contact_method_provenance")) {
    const r = a.row!;
    const method = methods.get(r.methodUid as string);
    const link =
      typeof r.externalContactLinkUid === "string"
        ? (externalLinks.get(r.externalContactLinkUid) ?? null)
        : null;
    if (!method) throw new Error("restore method disappeared during apply");
    await exec.runAsync(
      "INSERT INTO contact_method_provenance (uid,method_id,external_contact_link_id,source_method_id,created_at,modified_at) VALUES (?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET method_id=excluded.method_id,external_contact_link_id=excluded.external_contact_link_id,source_method_id=excluded.source_method_id,modified_at=excluded.modified_at",
      [
        r.uid,
        method,
        link,
        r.sourceMethodId ?? null,
        r.createdAt,
        r.modified_at,
      ],
    );
  }
  const categories = await idMap(exec, "categories");
  for (const a of writes(plan, "profile_contact_presentation")) {
    const r = a.row!;
    const contact = contacts.get(r.contactUid as string);
    if (!contact)
      throw new Error("restore presentation contact disappeared during apply");
    await exec.runAsync(
      "INSERT INTO profile_contact_presentation(contact_id,layout_template_uid,freeform_layout_json,background_template_uid,collapse_json,created_at,modified_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(contact_id) DO UPDATE SET layout_template_uid=excluded.layout_template_uid,freeform_layout_json=excluded.freeform_layout_json,background_template_uid=excluded.background_template_uid,collapse_json=excluded.collapse_json,modified_at=excluded.modified_at",
      [
        contact,
        r.layoutTemplateUid ?? null,
        r.freeformLayoutJson ?? null,
        r.backgroundTemplateUid ?? null,
        r.collapseJson ?? "{}",
        r.createdAt,
        r.modified_at,
      ],
    );
  }
  for (const a of writes(plan, "profile_category_presentation")) {
    const r = a.row!;
    const category = categories.get(r.categoryUid as string);
    if (!category)
      throw new Error("restore presentation category disappeared during apply");
    await exec.runAsync(
      "INSERT INTO profile_category_presentation(category_id,layout_template_uid,background_template_uid,created_at,modified_at) VALUES(?,?,?,?,?) ON CONFLICT(category_id) DO UPDATE SET layout_template_uid=excluded.layout_template_uid,background_template_uid=excluded.background_template_uid,modified_at=excluded.modified_at",
      [
        category,
        r.layoutTemplateUid ?? null,
        r.backgroundTemplateUid ?? null,
        r.createdAt,
        r.modified_at,
      ],
    );
  }
}
async function targetFor(
  exec: SqlExecutor,
  entity: MergeableEntityType,
  row: Row,
  incomingDefs: ReadonlyMap<string, IncomingDef>,
): Promise<PhotoTarget | null> {
  if (entity === "profile") return { kind: "profile" };
  if (entity === "contacts") return { kind: "contact", uid: row.uid };
  if (
    entity !== "custom_field_values" ||
    typeof row.contactUid !== "string" ||
    typeof row.fieldDefUid !== "string"
  )
    return null;
  const incoming = incomingDefs.get(row.fieldDefUid);
  const local = incoming
    ? null
    : await exec.getFirstAsync<{ col_name: string; type: string }>(
        "SELECT col_name,type FROM custom_field_defs WHERE uid=?",
        [row.fieldDefUid],
      );
  const colName = incoming?.colName ?? local?.col_name;
  if (
    typeof colName === "string" &&
    (typeof row.photoBase64 === "string" ||
      (incoming?.type ?? local?.type) === "photo")
  )
    return {
      kind: "customField",
      uid: row.contactUid,
      colName,
      valueUid: row.uid,
      fieldDefUid: row.fieldDefUid,
    };
  return null;
}
async function oldPhoto(
  exec: SqlExecutor,
  target: PhotoTarget,
): Promise<string | null> {
  if (target.kind === "profile")
    return (
      (
        await exec.getFirstAsync<{ photo: string | null }>(
          "SELECT photo FROM profile WHERE id=1",
        )
      )?.photo ?? null
    );
  if (target.kind === "contact")
    return (
      (
        await exec.getFirstAsync<{ photo: string | null }>(
          "SELECT photo FROM contacts WHERE uid=?",
          [target.uid],
        )
      )?.photo ?? null
    );
  return (
    (
      await exec.getFirstAsync<{ value: string | null }>(
        "SELECT v.value FROM custom_field_values v JOIN contacts c ON c.id=v.contact_id JOIN custom_field_defs d ON d.id=v.field_def_id WHERE v.uid=? AND c.uid=? AND d.uid=?",
        [target.valueUid, target.uid, target.fieldDefUid],
      )
    )?.value ?? null
  );
}
async function canonicalFor(
  exec: SqlExecutor,
  target: PhotoTarget,
): Promise<string | null> {
  if (target.kind === "profile") return profilePhotoRelPath();
  if (target.kind === "contact") {
    const row = await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM contacts WHERE uid=?",
      [target.uid],
    );
    return row ? contactPhotoRelPath(row.id) : null;
  }
  const row = await exec.getFirstAsync<{ id: number; col_name: string }>(
    "SELECT c.id,d.col_name FROM custom_field_values v JOIN contacts c ON c.id=v.contact_id JOIN custom_field_defs d ON d.id=v.field_def_id WHERE v.uid=? AND c.uid=? AND d.uid=?",
    [target.valueUid, target.uid, target.fieldDefUid],
  );
  return row ? customFieldPhotoRelPath(row.id, row.col_name) : null;
}
/** The D-26 marker: this row's photo was left out of the backup, not removed. */
function photoSkipped(row: Record<string, unknown>): boolean {
  return row.photoSkipped === true && typeof row.photoBase64 !== "string";
}
/** A row's current local photo reference, by its uid alone (review IN2-01). */
async function localReferenceOf(
  exec: SqlExecutor,
  entity: "profile" | "contacts" | "custom_field_values",
  uid: string,
): Promise<string | null> {
  if (entity === "profile")
    return (
      (
        await exec.getFirstAsync<{ photo: string | null }>(
          "SELECT photo FROM profile WHERE id=1",
        )
      )?.photo ?? null
    );
  if (entity === "contacts")
    return (
      (
        await exec.getFirstAsync<{ photo: string | null }>(
          "SELECT photo FROM contacts WHERE uid=?",
          [uid],
        )
      )?.photo ?? null
    );
  return (
    (
      await exec.getFirstAsync<{ value: string | null }>(
        "SELECT value FROM custom_field_values WHERE uid=?",
        [uid],
      )
    )?.value ?? null
  );
}
async function stageCandidates(
  exec: SqlExecutor,
  manifest: BackupManifest,
  session: string,
  stage: RestoreApplyDependencies["stagePhoto"],
  staged: Map<string, FinalizeCandidate>,
  local: {
    mode: RestoreMode;
    stageLocal: NonNullable<RestoreApplyDependencies["stageLocalPhoto"]>;
  },
): Promise<void> {
  const incomingDefs = incomingPhotoDefs(manifest);
  const reservedUids = new Set([
    ...manifest.contacts.map((row) => row.uid),
    ...manifest.customFieldValues.map((row) => row.contactUid),
  ]);
  let slot = 0;
  for (const entity of ["profile", "contacts", "custom_field_values"] as const)
    for (const row of incomingRows(manifest, entity)) {
      const target = await targetFor(exec, entity, row, incomingDefs);
      if (!target) continue;
      const bytes =
        typeof row.photoBase64 === "string" ? row.photoBase64 : null;
      // D-26, Replace-all: a skipped-photo row carries this phone's current
      // bytes instead. Staged here, before the reset and before any finalize
      // can overwrite a canonical that Replace-all's new ids re-assign.
      const localReference =
        bytes === null && local.mode === "replace-all" && photoSkipped(row)
          ? await oldPhoto(exec, target)
          : null;
      if (
        bytes === null &&
        (localReference === null || !SAFE_RELATIVE.test(localReference))
      )
        continue;
      // An arbitrary wire UID may contain punctuation. Keep safe existing
      // staging names; give unsafe ones a collision-free disposable slot.
      // Canonical paths remain ADR-021's contact-ID/field-derived names.
      let stagingTarget: PhotoTarget = target;
      if (target.kind !== "profile" && !/^[A-Za-z0-9_-]+$/.test(target.uid)) {
        let safeUid: string;
        do {
          safeUid = `slot${slot++}`;
        } while (reservedUids.has(safeUid));
        stagingTarget = { ...target, uid: safeUid };
      }
      const relativePath = restorePendingRelPath(stagingTarget, session);
      if (bytes !== null) {
        staged.set(`${entity}\0${row.uid}`, { target, relativePath });
        await stage!(bytes, relativePath);
        continue;
      }
      if (localReference === null) continue;
      // The stager resolves false only when the local file is genuinely gone:
      // that row ends with no photo (counted). A throw means the file is there
      // but could not be copied (full disk, I/O error). Replace-all would then
      // delete bytes this phone still has, so abort before any write, exactly
      // like a failed backup-byte stage above (D-26; review CR2-01). `finally`
      // in applyRestore cleans every pending file staged so far.
      let stagedLocal: boolean;
      try {
        stagedLocal = await local.stageLocal(localReference, relativePath);
      } catch (error) {
        // Both never throw. A copy that failed part-way leaves the stager's
        // half-written `.stage-tmp`, not the pending file (review IN2-03).
        deleteRestorePending(relativePath);
        deleteRestorePending(`${relativePath}.stage-tmp`);
        throw error;
      }
      if (stagedLocal)
        staged.set(`${entity}\0${row.uid}`, { target, relativePath });
    }
}
async function planPhotoCandidates(
  exec: SqlExecutor,
  manifest: BackupManifest,
  plan: Plan,
  staged: ReadonlyMap<string, FinalizeCandidate>,
  mode: RestoreMode,
): Promise<{
  finalize: FinalizeCandidate[];
  deletes: DeleteCandidate[];
  keep: KeepCandidate[];
  /** Merge (D-26): local photo paths of marked winning rows; never deleted. */
  keepPaths: Set<string>;
  missing: number;
}> {
  const incomingDefs = incomingPhotoDefs(manifest);
  const finalize: FinalizeCandidate[] = [];
  const deletes: DeleteCandidate[] = [];
  const keep: KeepCandidate[] = [];
  const keepPaths = new Set<string>();
  let missing = 0;
  for (const entity of ["profile", "contacts", "custom_field_values"] as const)
    for (const a of plan[entity]) {
      if (!a.row) continue;
      const target = await targetFor(exec, entity, a.row as Row, incomingDefs);
      if (!target) continue;
      const photoPresent = Object.hasOwn(a.row, "photoBase64");
      if (
        (a.kind === "insert" || a.kind === "update") &&
        typeof a.row.photoBase64 === "string"
      ) {
        const candidate = staged.get(`${entity}\0${a.uid}`);
        if (!candidate) throw new Error("winning photo was not staged");
        finalize.push(candidate);
      } else if (
        (a.kind === "insert" || a.kind === "update") &&
        photoSkipped(a.row)
      ) {
        // D-26: a skipped photo never removes a photo on restore: no delete
        // intent and no reference clear, in either mode.
        if (mode === "merge")
          // Looked up by row uid alone, so a value that arrives under another
          // contact still protects the file it has here (review IN2-01).
          addStoredPath(keepPaths, await localReferenceOf(exec, entity, a.uid));
        const candidate = staged.get(`${entity}\0${a.uid}`);
        if (candidate) {
          // Replace-all: this phone's bytes land at the row's new canonical.
          finalize.push(candidate);
          continue;
        }
        const existing = mode === "merge" ? await oldPhoto(exec, target) : null;
        if (existing === null) {
          missing += 1;
          continue;
        }
        // Merge: ids stay, so the local reference is written back after the
        // upserts (the custom value upsert writes the wire's null value).
        keep.push({
          target,
          reference: existing,
          canonicalBefore: await canonicalFor(exec, target),
        });
      } else if (
        a.kind === "delete" ||
        ((a.kind === "insert" || a.kind === "update") &&
          photoPresent &&
          a.row.photoBase64 === null)
      ) {
        const existing = await oldPhoto(exec, target);
        if (existing && SAFE_RELATIVE.test(existing))
          deletes.push({
            target,
            canonicalRelativePath: existing,
            clearReference: a.kind !== "delete",
          });
      }
    }
  return { finalize, deletes, keep, keepPaths, missing };
}
async function stageBackgroundCandidates(
  manifest: BackupManifest,
  sessionToken: string,
  stage: NonNullable<RestoreApplyDependencies["stageBackground"]>,
  candidates: BackgroundFinalizeCandidate[],
): Promise<void> {
  for (const row of incomingRows(manifest, "profile_background_templates")) {
    if (typeof row.imageBase64 !== "string") continue;
    candidates.push({
      uid: row.uid,
      pendingRelativePath: `profile-backgrounds/_restore_pending/${row.uid}/${sessionToken}.jpg`,
    });
    await stage(row.imageBase64, row.uid, sessionToken);
  }
}
function entry(
  action: "finalize" | "delete",
  relativePath: string,
  target: PhotoTarget,
  canonical: string,
  now: string,
): RestorePhotoJournalEntry {
  return {
    relativePath,
    action,
    targetKind: target.kind,
    contactUid: target.kind === "profile" ? null : target.uid,
    valueUid: target.kind === "customField" ? (target.valueUid ?? null) : null,
    fieldDefUid:
      target.kind === "customField" ? (target.fieldDefUid ?? null) : null,
    canonicalRelativePath: canonical,
    createdAt: now,
  };
}
async function replaceAllReset(
  exec: SqlExecutor,
  manifest: BackupManifest,
): Promise<void> {
  await exec.runAsync(
    "UPDATE app_settings SET sun_contact_id=NULL,profile_layout_template_uid=NULL,profile_background_template_uid=NULL WHERE id=1",
  );
  const resetSources: Record<
    MergeableEntityType,
    readonly [string, string] | null
  > = {
    categories: ["category", "categories"],
    profile: null,
    contacts: ["contact", "contacts"],
    contact_methods: ["contact_method", "contact_methods"],
    external_contact_links: ["external_contact_link", "external_contact_links"],
    contact_method_provenance: [
      "contact_method_provenance",
      "contact_method_provenance",
    ],
    interactions: ["interaction", "interactions"],
    events: ["event", "events"],
    fuel: ["fuel", "fuel"],
    memories: ["memory", "memories"],
    relationships: ["relationship", "relationships"],
    current_state_entries: ["current_state_entry", "current_state_entries"],
    contact_links: ["contact_link", "contact_links"],
    custom_field_defs: ["custom_field_def", "custom_field_defs"],
    custom_field_values: ["custom_field_value", "custom_field_values"],
    custom_field_value_history: [
      "custom_field_value_history",
      "custom_field_value_history",
    ],
    systems: null,
    system_rules: null,
    system_overrides: null,
    system_prefs: null,
    profile_layout_templates: null,
    profile_background_templates: null,
    ai_connections: null,
    personalization_sections: null,
    group_events: ["group_event", "group_events"],
    profile_contact_presentation: null,
    profile_category_presentation: null,
  };
  for (const source of Object.values(resetSources))
    if (source)
      for (const r of await exec.getAllAsync<{ uid: string }>(
        `SELECT uid FROM ${source[1]}`,
      ))
        await exec.runAsync(
          "INSERT INTO tombstones (entity_type,entity_uid,deleted_at) VALUES (?,?,?) ON CONFLICT(entity_type,entity_uid) DO UPDATE SET deleted_at=CASE WHEN excluded.deleted_at>tombstones.deleted_at THEN excluded.deleted_at ELSE tombstones.deleted_at END",
          [source[0], r.uid, manifest.metadata.exportedAt],
        );
  const ownedResidualTables: Record<MergeableEntityType, readonly string[]> = {
    categories: [],
    profile: [],
    contacts: ["field_history"],
    contact_methods: [],
    external_contact_links: [],
    contact_method_provenance: [],
    interactions: [],
    events: [],
    fuel: [],
    contact_links: [],
    custom_field_defs: [],
    custom_field_values: [],
    custom_field_value_history: [],
    memories: [],
    relationships: [],
    current_state_entries: [],
    systems: [],
    system_rules: [],
    system_overrides: [],
    system_prefs: [],
    profile_layout_templates: [],
    profile_background_templates: [],
    ai_connections: [],
    personalization_sections: [],
    group_events: [],
    profile_contact_presentation: [],
    profile_category_presentation: [],
  };
  for (const table of [
    "import_session_rows",
    "import_sessions",
    "profile_contact_presentation",
    "profile_category_presentation",
    "contact_method_provenance",
    "interactions",
    "group_events",
    "events",
    "fuel",
    "current_state_entries",
    "relationships",
    "memories",
    "custom_field_value_history",
    "custom_field_values",
    "contact_links",
    "external_contact_links",
    "contact_methods",
    "system_overrides",
    "system_rules",
    "system_prefs",
    ...ownedResidualTables.contacts,
    "contacts",
    "categories",
    "custom_field_defs",
    "systems",
    "ai_connections",
    "personalization_sections",
    "profile_layout_templates",
    "profile_background_templates",
  ])
    await exec.runAsync(`DELETE FROM ${table}`);
}

function addStoredPath(paths: Set<string>, value: string | null): void {
  if (value && SAFE_RELATIVE.test(value)) paths.add(value);
}

/** Capture file ownership before SQL deletes and cascades erase the evidence. */
async function captureRestoreDeletes(
  exec: SqlExecutor,
  plan: Plan,
  mode: RestoreMode,
): Promise<{ paths: Set<string>; oldOwners: Map<string, Set<string>> }> {
  const paths = new Set<string>();
  const oldOwners = new Map<string, Set<string>>();
  const rememberOwner = (path: string | null, uid: string) => {
    if (!path || !SAFE_RELATIVE.test(path)) return;
    const owners = oldOwners.get(path) ?? new Set<string>();
    owners.add(uid);
    oldOwners.set(path, owners);
  };
  const contacts = await exec.getAllAsync<{
    id: number;
    uid: string;
    photo: string | null;
  }>("SELECT id,uid,photo FROM contacts");
  const defs = await exec.getAllAsync<{
    id: number;
    uid: string;
    col_name: string;
  }>("SELECT id,uid,col_name FROM custom_field_defs");
  const values = await exec.getAllAsync<{
    uid: string;
    contact_id: number;
    field_def_id: number;
    value: string | null;
  }>("SELECT uid,contact_id,field_def_id,value FROM custom_field_values");
  const deletedContacts = new Set(
    plan.contacts.filter((a) => a.kind === "delete").map((a) => a.uid),
  );
  const rewrittenContacts = new Set(
    plan.contacts.filter((a) => a.kind === "update").map((a) => a.uid),
  );
  const deletedValues = new Set(
    plan.custom_field_values
      .filter((a) => a.kind === "delete")
      .map((a) => a.uid),
  );
  const rewrittenValues = new Set(
    plan.custom_field_values
      .filter((a) => a.kind === "update")
      .map((a) => a.uid),
  );
  const deletedDefs = new Set(
    plan.custom_field_defs.filter((a) => a.kind === "delete").map((a) => a.uid),
  );
  const contactById = new Map(contacts.map((row) => [row.id, row]));
  const defById = new Map(defs.map((row) => [row.id, row]));
  for (const contact of contacts) {
    rememberOwner(contact.photo, contact.uid);
    if (rewrittenContacts.has(contact.uid)) addStoredPath(paths, contact.photo);
    if (mode !== "replace-all" && !deletedContacts.has(contact.uid)) continue;
    addStoredPath(paths, contact.photo);
    paths.add(contactPhotoRelPath(contact.id));
    for (const def of defs)
      paths.add(customFieldPhotoRelPath(contact.id, def.col_name));
  }
  for (const value of values) {
    const contact = contactById.get(value.contact_id);
    const def = defById.get(value.field_def_id);
    if (!contact || !def) continue;
    rememberOwner(value.value, contact.uid);
    if (rewrittenValues.has(value.uid)) addStoredPath(paths, value.value);
    if (
      mode === "replace-all" ||
      deletedContacts.has(contact.uid) ||
      deletedValues.has(value.uid) ||
      deletedDefs.has(def.uid)
    ) {
      addStoredPath(paths, value.value);
      paths.add(customFieldPhotoRelPath(contact.id, def.col_name));
    }
  }
  if (mode === "replace-all") {
    const profile = await exec.getFirstAsync<{ photo: string | null }>(
      "SELECT photo FROM profile WHERE id=1",
    );
    addStoredPath(paths, profile?.photo ?? null);
  } else if (plan.profile.some((action) => action.kind === "update")) {
    const profile = await exec.getFirstAsync<{ photo: string | null }>(
      "SELECT photo FROM profile WHERE id=1",
    );
    addStoredPath(paths, profile?.photo ?? null);
  }
  return { paths, oldOwners };
}

async function clearReplacedLiveTombstones(exec: SqlExecutor): Promise<void> {
  // Replace-all resets rows before reinserting the backup graph. Resetting
  // records deletion evidence for old rows, including UIDs that return as live
  // rows. Clear only those collisions after every incoming row is written.
  for (const entity of entities) {
    const type = tombstoneEntity[entity];
    if (!type) continue;
    await exec.runAsync(
      `DELETE FROM tombstones WHERE entity_type=? AND entity_uid IN (SELECT uid FROM ${tableOf[entity]})`,
      [type],
    );
  }
}
async function importTombstones(
  exec: SqlExecutor,
  manifest: BackupManifest,
): Promise<void> {
  for (const r of manifest.tombstones)
    await exec.runAsync(
      "INSERT INTO tombstones (entity_type,entity_uid,deleted_at) VALUES (?,?,?) ON CONFLICT(entity_type,entity_uid) DO UPDATE SET deleted_at=CASE WHEN excluded.deleted_at>tombstones.deleted_at THEN excluded.deleted_at ELSE tombstones.deleted_at END",
      [r.entityType, r.entityUid, r.deletedAt],
    );
}
async function writePhotoReference(
  exec: SqlExecutor,
  target: PhotoTarget,
  relative: string | null,
): Promise<void> {
  if (target.kind === "profile") {
    await exec.runAsync("UPDATE profile SET photo=? WHERE id=1", [relative]);
    return;
  }
  if (target.kind === "contact") {
    await exec.runAsync("UPDATE contacts SET photo=? WHERE uid=?", [
      relative,
      target.uid,
    ]);
    return;
  }
  await exec.runAsync("UPDATE custom_field_values SET value=? WHERE uid=?", [
    relative,
    target.valueUid,
  ]);
}

/** This phone's settings LWW stamp (the column `getPortableSettingsSnapshot` reads). */
async function readLocalSettingsModifiedAt(exec: SqlExecutor): Promise<string> {
  const row = await exec.getFirstAsync<{ modified_at: string }>(
    "SELECT modified_at FROM app_settings WHERE id=1",
  );
  if (!row) throw new Error("applyRestore: app_settings row id=1 is missing");
  return row.modified_at;
}

export async function applyRestore(
  exec: SqlExecutor,
  manifest: BackupManifest,
  mode: RestoreMode,
  deps: RestoreApplyDependencies = {},
): Promise<RestoreApplyResult> {
  assertCompleteIncomingPairs(manifest);
  // D-47: an unavailable background id needs the user's consent, which the
  // restore flow asks for before calling this. Without it, stop here: nothing
  // is staged, snapshotted or written. RA-a (D-49): consent is needed only when
  // the backup's settings will be written; the flow's question uses the same
  // helper. The transaction re-checks against its own settings read below.
  const needingConsent = await backgroundsNeedingConsent(
    mode,
    manifest.appSettings,
    () => readLocalSettingsModifiedAt(exec),
  );
  if (
    needingConsent.length > 0 &&
    deps.unavailableBackgrounds !== "use-default"
  )
    return {
      status: "unavailable-background",
      unavailable: needingConsent.length,
    };
  let preRestoreSnapshotCreated = false;
  let preRestoreSnapshotSkippedPhotos = 0;
  const configured = Boolean(
    (
      await exec.getFirstAsync<{ backup_folder_uri: string | null }>(
        "SELECT backup_folder_uri FROM app_settings WHERE id=1",
      )
    )?.backup_folder_uri,
  );
  if (mode === "replace-all" && configured) {
    const snapshot = deps.createVerifiedPreRestoreSnapshot
      ? await deps.createVerifiedPreRestoreSnapshot()
      : null;
    if (snapshot?.status !== "written")
      return { status: "pre-restore-snapshot-failed" };
    preRestoreSnapshotCreated = true;
    preRestoreSnapshotSkippedPhotos = snapshot.skippedPhotos ?? 0;
  }
  const restoreSessionToken = deps.sessionToken ?? newUid();
  beginStagingSession(restoreSessionToken);
  const stagedPhotos = new Map<string, FinalizeCandidate>();
  const stagedBackgrounds: BackgroundFinalizeCandidate[] = [];
  const committedPhotoKeys = new Set<string>();
  const committedBackgroundUids = new Set<string>();
  try {
    await stageCandidates(
      exec,
      manifest,
      restoreSessionToken,
      deps.stagePhoto ?? stageRestorePendingBase64,
      stagedPhotos,
      {
        mode,
        stageLocal:
          deps.stageLocalPhoto ??
          ((canonical, pending) =>
            stageLocalPhotoForRestore(exec, canonical, pending)),
      },
    );
    await stageBackgroundCandidates(
      manifest,
      restoreSessionToken,
      deps.stageBackground ?? stageBackgroundRestorePendingBase64,
      stagedBackgrounds,
    );
    const prepared = await inWriteTransaction(exec, async () => {
      const [settings, local] = await Promise.all([
        getPortableSettingsSnapshot(exec),
        Promise.all(
          entities.map(
            async (entity) =>
              [
                entity,
                await localRows(exec, entity),
                await tombstones(exec, entity),
              ] as const,
          ),
        ),
      ]);
      const plan = {} as Plan;
      const survivors: Partial<
        Record<MergeableEntityType, ReadonlySet<string>>
      > = {};
      let incompatibilities = 0;
      if (mode === "replace-all")
        for (const entity of entities) {
          plan[entity] = incomingRows(manifest, entity).map((row) => ({
            kind: "insert",
            uid: row.uid,
            row,
          }));
          survivors[entity] = new Set(plan[entity].map((a) => a.uid));
        }
      else
        for (const entity of entities) {
          const [, rows, deleted] = local.find(
            ([candidate]) => candidate === entity,
          )!;
          const result = reconcileEntity({
            entityType: entity,
            localRows: rows,
            incomingRows: incomingRows(manifest, entity),
            localTombstones: deleted,
            incomingTombstones: incomingTombstones(manifest, entity),
            parentSurvivors: survivors,
          });
          plan[entity] = result.actions;
          survivors[entity] = result.survivors;
          incompatibilities += result.incompatibilities.length;
        }
      if (incompatibilities)
        return {
          result: {
            status: "incompatible-destination" as const,
            incompatibilities,
          },
        };
      normalizePlan(plan);
      if (mode === "merge") {
        const deletedCategoryUids = new Set(
          plan.categories
            .filter((action) => action.kind === "delete")
            .map((action) => action.uid),
        );
        suppressCategoryTombstoneDependents(plan, deletedCategoryUids);
      }
      if (mode === "merge") {
        const [, contacts] = local.find(([entity]) => entity === "contacts")!;
        retainAssignedCadence(
          plan,
          new Map(contacts.map((row) => [row.uid, row])),
        );
      }
      for (const entity of entities)
        survivors[entity] = survivorSet(plan[entity]);
      const finalCategories = plan.categories
        .filter(
          (action) =>
            action.row && ["insert", "update", "retain"].includes(action.kind),
        )
        .map((action) => action.row!);
      const finalSystems = plan.systems
        .filter(
          (action) =>
            action.row && ["insert", "update", "retain"].includes(action.kind),
        )
        .map((action) => action.row!);
      const visibleNameCollisions = findVisibleNameCollisions(
        finalCategories,
        finalSystems,
      );
      if (visibleNameCollisions.length)
        return {
          result: {
            status: "incompatible-destination" as const,
            incompatibilities: visibleNameCollisions.length,
          },
        };
      const totals = entities.reduce(
        (out, entity) => {
          for (const action of plan[entity]) out[action.kind] += 1;
          return out;
        },
        { insert: 0, update: 0, retain: 0, delete: 0, blocked: 0 },
      );
      const applySettings = restoreWritesBackupSettings(
        mode,
        manifest.appSettings.modifiedAt,
        settings.modifiedAt,
      );
      // RA-a (D-49): the early gate decided consent from a read taken before
      // the transaction. Re-decide it here, from this transaction's settings
      // read and the same helper, before any write: if the settings are now
      // written but carry an unconsented unavailable id, write nothing.
      if (deps.unavailableBackgrounds !== "use-default") {
        const unconsented = await backgroundsNeedingConsent(
          mode,
          manifest.appSettings,
          async () => settings.modifiedAt,
        );
        if (unconsented.length > 0)
          return {
            result: {
              status: "unavailable-background" as const,
              unavailable: unconsented.length,
            },
          };
      }
      const tombstonesByKey = new Map(
        local.flatMap(([entity, , deleted]) =>
          deleted.map(
            (item) =>
              [
                `${tombstoneEntity[entity]}\0${item.entity_uid}`,
                item.deleted_at,
              ] as const,
          ),
        ),
      );
      const novelTombstone = manifest.tombstones.some((item) => {
        const current = tombstonesByKey.get(
          `${item.entityType}\0${item.entityUid}`,
        );
        return current === undefined || item.deletedAt > current;
      });
      if (
        totals.insert + totals.update + totals.delete === 0 &&
        !applySettings &&
        !novelTombstone
      )
        return {
          result: {
            status: "applied" as const,
            mode,
            inserted: 0,
            updated: 0,
            retained: totals.retain,
            deleted: 0,
            blocked: totals.blocked,
            photosNeedingAttention: 0,
            photoCleanupPending: 0,
            scheduleResyncPending: false,
            preRestoreSnapshotCreated,
            preRestoreSnapshotSkippedPhotos,
            restoredPhotosMissing: 0,
          },
        };
      const fileDeletes = await captureRestoreDeletes(exec, plan, mode);
      const candidates = await planPhotoCandidates(
        exec,
        manifest,
        plan,
        stagedPhotos,
        mode,
      );
      const backgroundCandidates = stagedBackgrounds.filter((candidate) =>
        writes(plan, "profile_background_templates").some(
          (action) => action.uid === candidate.uid,
        ),
      );
      const backgroundPendingByUid = new Map(
        backgroundCandidates.map((candidate) => [
          candidate.uid,
          candidate.pendingRelativePath,
        ]),
      );
      // ADR-010/ADR-056: child winners are independent of metadata winners.
      // Include every changed contact (including qualification-flag changes) and
      // capture old interaction parents before deletes/reparenting lose them.
      const recencyUids = new Set(
        writes(plan, "contacts").map((action) => action.uid),
      );
      for (const action of plan.interactions) {
        if (
          action.kind !== "insert" &&
          action.kind !== "update" &&
          action.kind !== "delete"
        )
          continue;
        const oldParent = await exec.getFirstAsync<{ uid: string }>(
          "SELECT c.uid FROM interactions i JOIN contacts c ON c.id=i.contact_id WHERE i.uid=?",
          [action.uid],
        );
        if (oldParent) recencyUids.add(oldParent.uid);
        if (
          action.kind !== "delete" &&
          typeof action.row?.contactUid === "string"
        )
          recencyUids.add(action.row.contactUid);
      }
      if (mode === "replace-all") {
        await replaceAllReset(exec, manifest);
      } else {
        for (const action of plan.categories)
          if (action.kind === "delete") {
            const row = await exec.getFirstAsync<{ id: number }>(
              "SELECT id FROM categories WHERE uid=?",
              [action.uid],
            );
            if (!row) continue;
            const preview = await readCategoryDeletionPreviewCore(exec, row.id);
            if (!preview) continue;
            const timestamps = [
              ...manifest.tombstones
                .filter(
                  (item) =>
                    item.entityType === "category" &&
                    item.entityUid === action.uid,
                )
                .map((item) => item.deletedAt),
              ...(local.find(([entity]) => entity === "categories")?.[2] ?? [])
                .filter((item) => item.entity_uid === action.uid)
                .map((item) => item.deleted_at),
            ].sort();
            await applyCategoryDeletionFalloutCore(exec, {
              preview,
              targetCategoryId: null,
              now: timestamps.at(-1) ?? manifest.metadata.exportedAt,
              mode: "merge-null-only",
            });
          }
        for (const entity of [...entities].reverse()) {
          if (entity === "categories") continue;
          await deleteActions(exec, entity, plan[entity]);
        }
      }
      await importTombstones(exec, manifest);
      await upsertParents(exec, plan, backgroundPendingByUid);
      await upsertContacts(exec, plan);
      await upsertChildren(exec, plan);
      await completeGlobalPairsCore(exec);
      if (mode === "replace-all") await clearReplacedLiveTombstones(exec);
      const contacts = await idMap(exec, "contacts");
      for (const uid of recencyUids) {
        // Read after all writes: only surviving parents are recomputed, and the
        // core must preserve the winning metadata stamp rather than re-date it.
        const contact = await exec.getFirstAsync<{
          id: number;
          modified_at: string;
        }>("SELECT id,modified_at FROM contacts WHERE uid=?", [uid]);
        if (contact)
          await recomputeLastContactCore(exec, contact.id, contact.modified_at);
      }
      // D-26, Merge: restore a skipped-photo row's local reference that an
      // upsert overwrote (the custom value upsert writes the wire's null), but
      // only while the row still derives the same canonical (same contact and
      // field), so a reference never points at another row's photo.
      let restoredPhotosMissing = candidates.missing;
      for (const kept of candidates.keep) {
        if ((await canonicalFor(exec, kept.target)) !== kept.canonicalBefore) {
          restoredPhotosMissing += 1;
          continue;
        }
        await writePhotoReference(exec, kept.target, kept.reference);
      }
      const finalizeEntries: RestorePhotoJournalEntry[] = [];
      for (const candidate of candidates.finalize) {
        const canonical = await canonicalFor(exec, candidate.target);
        if (!canonical)
          throw new Error("restore photo target disappeared before commit");
        await writePhotoReference(exec, candidate.target, canonical);
        const journalEntry = entry(
          "finalize",
          candidate.relativePath,
          candidate.target,
          canonical,
          manifest.metadata.exportedAt,
        );
        await insertFinalizeEntryCore(exec, journalEntry);
        finalizeEntries.push(journalEntry);
      }
      for (const candidate of candidates.deletes)
        if (candidate.clearReference)
          await writePhotoReference(exec, candidate.target, null);
      for (const candidate of candidates.deletes)
        fileDeletes.paths.add(candidate.canonicalRelativePath);
      // D-26, Merge: a marked winning row's local photo gets no delete intent,
      // even when its reference could not be written back (the row now derives
      // another canonical). The bytes stay; nothing relies on the post-commit
      // mayDeleteCanonicalCore recheck to save them (review IN2-01).
      for (const kept of candidates.keepPaths) fileDeletes.paths.delete(kept);
      for (const canonical of fileDeletes.paths)
        await enqueueDeleteIntentCore(exec, canonical);
      if (applySettings) {
        const uid = manifest.appSettings.sunContactUid;
        const sun =
          typeof uid === "string" && survivors.contacts?.has(uid)
            ? (contacts.get(uid) ?? null)
            : null;
        // The restore mapping (D-47): with the user's consent, an unavailable
        // background id becomes its package default here, before the DAO
        // (which still rejects it). Available ids pass through unchanged.
        const patch = Object.fromEntries(
          Object.entries(withDefaultBackgrounds(manifest.appSettings)).filter(
            ([key]) => key !== "modifiedAt" && key !== "sunContactUid",
          ),
        ) as AppSettingsPatch;
        await updateAppSettingsCore(
          exec,
          { ...patch, sunContactId: sun },
          manifest.appSettings.modifiedAt as string,
        );
      }
      await bumpDataRevisionCore(exec);
      return {
        result: null,
        candidates,
        backgroundCandidates,
        totals,
        finalizeEntries,
        fileDeletes,
        restoredPhotosMissing,
      };
    });
    if (prepared.result) return prepared.result;
    const {
      candidates,
      backgroundCandidates,
      totals,
      finalizeEntries,
      fileDeletes,
      restoredPhotosMissing,
    } = prepared;
    const committedPaths = new Set(
      candidates.finalize.map((candidate) => candidate.relativePath),
    );
    for (const [key, candidate] of stagedPhotos)
      if (committedPaths.has(candidate.relativePath))
        committedPhotoKeys.add(key);
    for (const candidate of backgroundCandidates)
      committedBackgroundUids.add(candidate.uid);
    const remove = deps.deleteCanonicalPhoto ?? deletePhoto;
    const exists = deps.canonicalPhotoExists ?? photoFileExists;
    let photosNeedingAttention = 0;
    let photoCleanupPending = 0;
    for (const journalEntry of finalizeEntries) {
      try {
        await finalizeJournalEntryOwned(exec, journalEntry, deps.persistPhoto);
      } catch {
        photosNeedingAttention += 1;
        const oldOwners = fileDeletes.oldOwners.get(
          journalEntry.canonicalRelativePath,
        );
        if (
          mode === "replace-all" &&
          oldOwners &&
          [...oldOwners].some((uid) => uid !== journalEntry.contactUid)
        ) {
          try {
            await withCanonicalPathLock(
              journalEntry.canonicalRelativePath,
              async () => {
                const owner = await exec.getFirstAsync<{ uid: string }>(
                  "SELECT uid FROM contacts WHERE photo=? UNION ALL SELECT c.uid FROM custom_field_values v JOIN contacts c ON c.id=v.contact_id WHERE v.value=? LIMIT 1",
                  [
                    journalEntry.canonicalRelativePath,
                    journalEntry.canonicalRelativePath,
                  ],
                );
                if (owner?.uid === journalEntry.contactUid) {
                  remove(journalEntry.canonicalRelativePath);
                  // deletePhoto swallows errors: publish a display revision
                  // only once the bytes are really gone (38.6 D-01).
                  if (!exists(journalEntry.canonicalRelativePath))
                    notifyPhotoBytesChanged(journalEntry.canonicalRelativePath);
                }
              },
            );
          } catch {
            photoCleanupPending += 1;
          }
        }
      }
    }
    for (const candidate of backgroundCandidates) {
      try {
        await finalizeBackgroundRestoreCandidate(
          exec,
          {
            uid: candidate.uid,
            pendingRelativePath: candidate.pendingRelativePath,
          },
          {
            persist: deps.persistBackground,
            deletePending: deps.deleteStagedBackground,
          },
        );
      } catch {
        photosNeedingAttention += 1;
      }
    }
    for (const canonical of fileDeletes.paths) {
      try {
        // The owned helper rechecks mayDeleteCanonicalCore under the path lock.
        await executeDeleteIntentOwned(exec, canonical, remove, exists);
      } catch {
        photoCleanupPending += 1;
      }
    }
    let scheduleResyncPending = false;
    try {
      const outcome = await (
        deps.reconcileNotificationSchedule ?? (() => reconcileSchedule(exec))
      )();
      if (outcome?.incomplete) scheduleResyncPending = true;
    } catch {
      scheduleResyncPending = true;
    }
    try {
      await (
        deps.reconcileDigestSchedule ?? (() => reconcileDigestSchedule(exec))
      )();
    } catch {
      scheduleResyncPending = true;
    }
    return {
      status: "applied",
      mode,
      inserted: totals.insert,
      updated: totals.update,
      retained: totals.retain,
      deleted: totals.delete,
      blocked: totals.blocked,
      photosNeedingAttention,
      photoCleanupPending,
      scheduleResyncPending,
      preRestoreSnapshotCreated,
      preRestoreSnapshotSkippedPhotos,
      restoredPhotosMissing,
    };
  } finally {
    for (const [key, candidate] of stagedPhotos) {
      // A committed finalize owns its pending file until finalization/drain.
      if (committedPhotoKeys.has(key)) continue;
      try {
        deleteRestorePending(candidate.relativePath);
      } catch {
        /* best effort */
      }
    }
    for (const candidate of stagedBackgrounds) {
      if (committedBackgroundUids.has(candidate.uid)) continue;
      try {
        (deps.deleteStagedBackground ?? deleteBackgroundRestorePending)(
          candidate.pendingRelativePath,
        );
      } catch {
        /* best effort */
      }
    }
    endStagingSession(restoreSessionToken);
  }
}
