import {
  RESERVED_CATEGORY_UIDS,
  RESERVED_PROFILE_UID,
} from "@/db/migrations/007-tombstones";
import type { ReconciliationRow, ReconciliationTombstone } from "@/backup/types";

/** Every UID-bearing table that a Merge caller may reconcile. */
export type MergeableEntityType =
  | "contacts"
  | "contact_methods"
  | "external_contact_links"
  | "contact_method_provenance"
  | "interactions"
  | "events"
  | "fuel"
  | "contact_links"
  | "custom_field_defs"
  | "custom_field_values"
  | "custom_field_value_history"
  | "memories"
  | "relationships"
  | "current_state_entries"
  | "categories"
  | "profile";

type WriteMode = "lww" | "insert-if-missing";

interface ParentFieldPolicy {
  field: string;
  entityType: MergeableEntityType;
  optional?: boolean;
}

export interface EntityPolicy {
  writeMode: WriteMode;
  parentFields?: readonly ParentFieldPolicy[];
  /** Fixed migration-007 singleton identities, where the schema provides them. */
  reservedUids?: readonly string[];
}

/**
 * Complete reconciliation policy registry. Tables remain listed even when no
 * hard-delete writer exists yet, so backup restore and future sync share one
 * exhaustive contract rather than a tombstone-writer subset.
 */
export const ENTITY_POLICIES: Readonly<Record<MergeableEntityType, EntityPolicy>> = {
  contacts: { writeMode: "lww" },
  contact_methods: {
    writeMode: "lww",
    parentFields: [{ field: "contact_id", entityType: "contacts" }],
  },
  external_contact_links: {
    writeMode: "lww",
    parentFields: [{ field: "contact_id", entityType: "contacts" }],
  },
  contact_method_provenance: {
    writeMode: "lww",
    parentFields: [
      { field: "method_id", entityType: "contact_methods" },
      { field: "external_contact_link_id", entityType: "external_contact_links", optional: true },
    ],
  },
  interactions: {
    writeMode: "lww",
    parentFields: [{ field: "contact_id", entityType: "contacts" }],
  },
  events: {
    writeMode: "insert-if-missing",
    parentFields: [{ field: "contact_id", entityType: "contacts" }],
  },
  fuel: {
    writeMode: "lww",
    parentFields: [{ field: "contact_id", entityType: "contacts" }],
  },
  contact_links: {
    writeMode: "lww",
    parentFields: [{ field: "contact_id", entityType: "contacts" }],
  },
  custom_field_defs: { writeMode: "lww" },
  custom_field_values: {
    writeMode: "lww",
    parentFields: [
      { field: "contact_id", entityType: "contacts" },
      { field: "field_def_id", entityType: "custom_field_defs" },
    ],
  },
  // Append-only, immutable value timeline — mirrors `events`: insert-if-missing,
  // scoped to BOTH its contact and its field definition parent.
  custom_field_value_history: {
    writeMode: "insert-if-missing",
    parentFields: [
      { field: "contact_id", entityType: "contacts" },
      { field: "field_def_id", entityType: "custom_field_defs" },
    ],
  },
  memories: { writeMode: "lww", parentFields: [{ field: "contact_id", entityType: "contacts" }] },
  relationships: { writeMode: "lww", parentFields: [{ field: "contact_id", entityType: "contacts" }] },
  current_state_entries: { writeMode: "lww", parentFields: [{ field: "contact_id", entityType: "contacts" }] },
  categories: {
    writeMode: "lww",
    reservedUids: Object.values(RESERVED_CATEGORY_UIDS),
  },
  profile: { writeMode: "lww", reservedUids: [RESERVED_PROFILE_UID] },
};

export interface ReconciliationAction {
  kind: "insert" | "update" | "retain" | "delete" | "blocked";
  uid: string;
  row?: ReconciliationRow;
  reason?: string;
}

export interface ReconciliationIncompatibility {
  kind: "pair-key-collision" | "col-name-collision";
  entityType: "custom_field_values" | "custom_field_defs";
  key: string;
  localUid: string;
  incomingUid: string;
}

export interface ReconciliationResult {
  actions: ReconciliationAction[];
  /** Any item here rejects the ENTIRE restore; callers must never apply partial actions. */
  incompatibilities: ReconciliationIncompatibility[];
  totals: Record<ReconciliationAction["kind"], number>;
  survivors: ReadonlySet<string>;
}

export interface ReconcileEntityInput {
  entityType: MergeableEntityType;
  localRows: readonly ReconciliationRow[];
  incomingRows: readonly ReconciliationRow[];
  localTombstones?: readonly ReconciliationTombstone[];
  incomingTombstones?: readonly ReconciliationTombstone[];
  /** Parent results computed before their dependent child entity is reconciled. */
  parentSurvivors?: Partial<Record<MergeableEntityType, ReadonlySet<string>>>;
}

type RowCandidate = { row: ReconciliationRow; source: "local" | "incoming" };
type TombstoneCandidate = {
  tombstone: ReconciliationTombstone;
  source: "local" | "incoming";
};

function assertUniqueRows(rows: readonly ReconciliationRow[], label: string): void {
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.uid)) throw new Error(`duplicate live UID in ${label}: ${row.uid}`);
    seen.add(row.uid);
  }
}

function assertUniqueTombstones(
  tombstones: readonly ReconciliationTombstone[],
  label: string,
): void {
  const seen = new Set<string>();
  for (const tombstone of tombstones) {
    if (seen.has(tombstone.entity_uid)) {
      throw new Error(`duplicate tombstone UID in ${label}: ${tombstone.entity_uid}`);
    }
    seen.add(tombstone.entity_uid);
  }
}

/** Equal-second ties deliberately favour durable deletion evidence. */
export function compareRowAndTombstone(
  row: Pick<ReconciliationRow, "modified_at">,
  tombstone: Pick<ReconciliationTombstone, "deleted_at">,
): "row" | "tombstone" {
  return row.modified_at > tombstone.deleted_at ? "row" : "tombstone";
}

function newestRow(candidates: readonly RowCandidate[]): RowCandidate | undefined {
  return candidates.reduce<RowCandidate | undefined>(
    (winner, candidate) =>
      winner === undefined || candidate.row.modified_at > winner.row.modified_at
        ? candidate
        : winner,
    undefined,
  );
}

function newestTombstone(
  candidates: readonly TombstoneCandidate[],
): TombstoneCandidate | undefined {
  return candidates.reduce<TombstoneCandidate | undefined>(
    (winner, candidate) =>
      winner === undefined || candidate.tombstone.deleted_at > winner.tombstone.deleted_at
        ? candidate
        : winner,
    undefined,
  );
}

/** Same-file primitive for structural validation before local state is considered. */
export function sameFileSurvivorUids(
  liveRows: readonly ReconciliationRow[],
  tombstones: readonly ReconciliationTombstone[],
): ReadonlySet<string> {
  assertUniqueRows(liveRows, "same-file rows");
  assertUniqueTombstones(tombstones, "same-file tombstones");
  const rows = new Map(liveRows.map((row) => [row.uid, row]));
  const deleted = new Map(tombstones.map((tombstone) => [tombstone.entity_uid, tombstone]));
  const allUids = new Set([...rows.keys(), ...deleted.keys()]);
  const survivors = new Set<string>();
  for (const uid of allUids) {
    const row = rows.get(uid);
    const tombstone = deleted.get(uid);
    if (row && (!tombstone || compareRowAndTombstone(row, tombstone) === "row")) {
      survivors.add(uid);
    }
  }
  return survivors;
}

/** Resolve a nullable UID reference without allowing a dangling parent UID. */
export function referenceOrFallback<T>(
  referenceUid: string | null,
  survivingParentUids: ReadonlySet<string>,
  fallback: T,
): string | null | T {
  if (referenceUid === null || survivingParentUids.has(referenceUid)) return referenceUid;
  return fallback;
}

function readParentUid(row: ReconciliationRow, field: string): string | undefined {
  const aliases: Record<string, string> = {
    contact_id: "contactUid",
    field_def_id: "fieldDefUid",
    method_id: "methodUid",
    external_contact_link_id: "externalContactLinkUid",
  };
  const value = row[field] ?? row[aliases[field] ?? field];
  return typeof value === "string" ? value : undefined;
}

function rowHasLostParent(
  row: ReconciliationRow,
  policy: EntityPolicy,
  parentSurvivors: ReconcileEntityInput["parentSurvivors"],
): string | undefined {
  for (const parent of policy.parentFields ?? []) {
    const survivors = parentSurvivors?.[parent.entityType];
    const uid = readParentUid(row, parent.field);
    if (survivors && ((!uid && !parent.optional) || (uid && !survivors.has(uid)))) return parent.field;
  }
  return undefined;
}

function withoutDerivedFields(
  entityType: MergeableEntityType,
  row: ReconciliationRow,
): ReconciliationRow {
  if (entityType !== "contacts") return row;
  const { last_contact: _derived, ...mergeable } = row;
  return mergeable;
}

function pairKey(row: ReconciliationRow): string | undefined {
  const contactUid = readParentUid(row, "contact_id");
  const fieldDefUid = readParentUid(row, "field_def_id");
  return contactUid && fieldDefUid ? `${contactUid}\u0000${fieldDefUid}` : undefined;
}

function incompatibleRows(
  input: ReconcileEntityInput,
  policy: EntityPolicy,
): { incompatibilities: ReconciliationIncompatibility[]; uids: Set<string> } {
  const localRows = input.localRows.filter(
    (row) => !rowHasLostParent(row, policy, input.parentSurvivors),
  );
  const incomingRows = input.incomingRows.filter(
    (row) => !rowHasLostParent(row, policy, input.parentSurvivors),
  );
  const incompatibilities: ReconciliationIncompatibility[] = [];
  const uids = new Set<string>();
  const compare = (
    keyFor: (row: ReconciliationRow) => string | undefined,
    kind: ReconciliationIncompatibility["kind"],
  ) => {
    const local = new Map(localRows.map((row) => [keyFor(row), row]));
    for (const incoming of incomingRows) {
      const key = keyFor(incoming);
      const current = key ? local.get(key) : undefined;
      if (key && current && current.uid !== incoming.uid) {
        incompatibilities.push({
          kind,
          entityType: input.entityType as "custom_field_values" | "custom_field_defs",
          key,
          localUid: current.uid,
          incomingUid: incoming.uid,
        });
        uids.add(current.uid);
        uids.add(incoming.uid);
      }
    }
  };
  if (input.entityType === "custom_field_values") compare(pairKey, "pair-key-collision");
  if (input.entityType === "custom_field_defs") {
    compare((row) => (typeof row.col_name === "string" ? row.col_name : undefined), "col-name-collision");
  }
  return { incompatibilities, uids };
}

/**
 * Pure two-sided UID reconciliation. Parent callers run first, then provide
 * survivor sets for child calls; this function never maps UIDs to local IDs.
 */
export function reconcileEntity(input: ReconcileEntityInput): ReconciliationResult {
  const localTombstones = input.localTombstones ?? [];
  const incomingTombstones = input.incomingTombstones ?? [];
  assertUniqueRows(input.localRows, "local rows");
  assertUniqueRows(input.incomingRows, "incoming rows");
  assertUniqueTombstones(localTombstones, "local tombstones");
  assertUniqueTombstones(incomingTombstones, "incoming tombstones");

  const policy = ENTITY_POLICIES[input.entityType];
  const collision = incompatibleRows(input, policy);
  const localRows = new Map(input.localRows.map((row) => [row.uid, row]));
  const incomingRows = new Map(input.incomingRows.map((row) => [row.uid, row]));
  const localDeleted = new Map(localTombstones.map((tombstone) => [tombstone.entity_uid, tombstone]));
  const incomingDeleted = new Map(
    incomingTombstones.map((tombstone) => [tombstone.entity_uid, tombstone]),
  );
  const uids = new Set([
    ...localRows.keys(),
    ...incomingRows.keys(),
    ...localDeleted.keys(),
    ...incomingDeleted.keys(),
  ]);
  const actions: ReconciliationAction[] = [];

  for (const uid of [...uids].sort()) {
    if (collision.uids.has(uid)) continue;
    const localRow = localRows.get(uid);
    const incomingRow = incomingRows.get(uid);
    const rowWinner = newestRow(
      [
        localRow && { row: localRow, source: "local" as const },
        incomingRow && { row: incomingRow, source: "incoming" as const },
      ].filter((candidate): candidate is RowCandidate => Boolean(candidate)),
    );
    const tombstoneWinner = newestTombstone(
      [
        localDeleted.get(uid) && { tombstone: localDeleted.get(uid)!, source: "local" as const },
        incomingDeleted.get(uid) && {
          tombstone: incomingDeleted.get(uid)!,
          source: "incoming" as const,
        },
      ].filter((candidate): candidate is TombstoneCandidate => Boolean(candidate)),
    );
    if (!rowWinner && !tombstoneWinner) continue;
    const rowSurvives =
      rowWinner !== undefined &&
      (tombstoneWinner === undefined ||
        compareRowAndTombstone(rowWinner.row, tombstoneWinner.tombstone) === "row");
    if (!rowSurvives) {
      if (localRow) actions.push({ kind: "delete", uid });
      else actions.push({ kind: "retain", uid });
      continue;
    }

    const mergeableRow = withoutDerivedFields(input.entityType, rowWinner.row);
    const lostParent = rowHasLostParent(mergeableRow, policy, input.parentSurvivors);
    if (lostParent) {
      actions.push({ kind: "blocked", uid, row: mergeableRow, reason: `missing parent ${lostParent}` });
    } else if (policy.writeMode === "insert-if-missing" && localRow) {
      actions.push({ kind: "retain", uid, row: withoutDerivedFields(input.entityType, localRow) });
    } else if (rowWinner.source === "incoming") {
      actions.push({ kind: localRow ? "update" : "insert", uid, row: mergeableRow });
    } else {
      actions.push({ kind: "retain", uid, row: mergeableRow });
    }
  }

  const survivors = new Set(
    actions
      .filter(
        (action) =>
          ["insert", "update", "retain"].includes(action.kind) && action.row !== undefined,
      )
      .map((action) => action.uid),
  );
  const totals: ReconciliationResult["totals"] = {
    insert: 0,
    update: 0,
    retain: 0,
    delete: 0,
    blocked: 0,
  };
  for (const action of actions) totals[action.kind] += 1;
  return { actions, incompatibilities: collision.incompatibilities, totals, survivors };
}
