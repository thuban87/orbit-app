/**
 * Central AI permission manager data boundary (AICFG-10).
 *
 * Type defaults live on the singleton settings row and affect creation only.
 * Existing permission flags are changed solely by explicit per-item selections.
 * Review reads are deliberately limited to the three eligible stores represented
 * by `AiPermissionCategory`; adding another category requires widening this
 * closed union and every exhaustive switch below.
 */
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { isMemoryTypeKey, MEMORY_TYPE_REGISTRY } from "@/db/memory-registry";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

export type AiPermissionCategory =
  | "memory"
  | "interaction-note"
  | "custom-field";

export type AiPermissionValue = 0 | 1;

export interface AiPermissionDefaults {
  memory: AiPermissionValue;
  interactionNote: AiPermissionValue;
  customField: AiPermissionValue;
}

export interface AiPermissionRef {
  category: AiPermissionCategory;
  /** The permission-owning row id (a definition id for custom fields). */
  id: number;
}

export interface AiPermissionItem extends AiPermissionRef {
  /** Stable identity of this displayed contact/item pair. */
  itemKey: string;
  contactId: number;
  contactUid: string;
  contactName: string;
  label: string;
  value: string;
  enabled: AiPermissionValue;
}

export interface AiPermissionReviewFilter {
  category?: AiPermissionCategory;
  enabledOnly?: boolean;
  contactQuery?: string;
}

export interface AiPermissionImpact {
  contacts: number;
  items: number;
}

const DEFAULT_COLUMN: Record<AiPermissionCategory, string> = {
  memory: "ai_default_memory_allow",
  "interaction-note": "ai_default_interaction_note_allow",
  "custom-field": "ai_default_custom_field_share",
};

function assertPermissionValue(
  value: number,
): asserts value is AiPermissionValue {
  if (value !== 0 && value !== 1) {
    throw new Error("AI permission must be 0 or 1");
  }
}

function assertRef(ref: AiPermissionRef): void {
  if (!Object.hasOwn(DEFAULT_COLUMN, ref.category)) {
    throw new Error("AI permission selection has an unknown category");
  }
  if (!Number.isInteger(ref.id) || ref.id <= 0) {
    throw new Error("AI permission selection has an invalid id");
  }
}

function explicitSelection(
  refs: readonly AiPermissionRef[],
): AiPermissionRef[] {
  if (!Array.isArray(refs) || refs.length === 0) {
    throw new Error("AI permission bulk action requires an explicit selection");
  }
  const unique = new Map<string, AiPermissionRef>();
  for (const ref of refs) {
    assertRef(ref);
    unique.set(`${ref.category}:${ref.id}`, ref);
  }
  return [...unique.values()];
}

export async function getAiPermissionDefaults(
  exec: SqlExecutor,
): Promise<AiPermissionDefaults> {
  const row = await exec.getFirstAsync<{
    memory: number;
    interactionNote: number;
    customField: number;
  }>(
    `SELECT ai_default_memory_allow AS memory,
            ai_default_interaction_note_allow AS interactionNote,
            ai_default_custom_field_share AS customField
       FROM app_settings
      WHERE id = 1`,
  );
  if (!row) throw new Error("AI permission defaults row is missing");
  assertPermissionValue(row.memory);
  assertPermissionValue(row.interactionNote);
  assertPermissionValue(row.customField);
  return {
    memory: row.memory,
    interactionNote: row.interactionNote,
    customField: row.customField,
  };
}

/** Resolve the durable creation-time default for one eligible information type. */
export async function resolveNewItemAiDefault(
  exec: SqlExecutor,
  category: AiPermissionCategory,
): Promise<AiPermissionValue> {
  const column = DEFAULT_COLUMN[category];
  if (!column) throw new Error("Unknown AI permission category");
  const row = await exec.getFirstAsync<{ value: number }>(
    `SELECT ${column} AS value FROM app_settings WHERE id = 1`,
  );
  const value = row?.value ?? 0;
  assertPermissionValue(value);
  return value;
}

/** Change only the category default; existing item flags are intentionally untouched. */
export function setAiPermissionDefault(
  exec: SqlExecutor,
  category: AiPermissionCategory,
  value: AiPermissionValue,
  now: string,
): Promise<void> {
  assertPermissionValue(value);
  const column = DEFAULT_COLUMN[category];
  if (!column)
    return Promise.reject(new Error("Unknown AI permission category"));
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      `UPDATE app_settings SET ${column} = ?, modified_at = ? WHERE id = 1`,
      [value, now],
    );
    if (result.changes !== 1) {
      throw new Error(`Expected one settings row, changed ${result.changes}`);
    }
    await bumpDataRevisionCore(exec);
  });
}

interface MemoryReviewRow {
  id: number;
  contactId: number;
  contactUid: string;
  contactName: string;
  type: string;
  customLabel: string | null;
  value: string | null;
  note: string | null;
  enabled: number;
}

interface NoteReviewRow {
  id: number;
  contactId: number;
  contactUid: string;
  contactName: string;
  value: string;
  enabled: number;
}

interface FieldReviewRow {
  id: number;
  valueId: number;
  contactId: number;
  contactUid: string;
  contactName: string;
  label: string;
  value: string;
  enabled: number;
}

function memoryLabel(row: MemoryReviewRow): string {
  const custom = row.customLabel?.trim();
  if (custom) return custom;
  return isMemoryTypeKey(row.type)
    ? MEMORY_TYPE_REGISTRY[row.type].displayName
    : "Memory";
}

function memoryValue(row: MemoryReviewRow): string {
  return row.value?.trim() || row.note?.trim() || "Memory";
}

function stableCompare(a: AiPermissionItem, b: AiPermissionItem): number {
  const byName = a.contactName.localeCompare(b.contactName, undefined, {
    sensitivity: "base",
  });
  if (byName !== 0) return byName;
  const byUid = a.contactUid.localeCompare(b.contactUid);
  if (byUid !== 0) return byUid;
  const rank: Record<AiPermissionCategory, number> = {
    memory: 0,
    "interaction-note": 1,
    "custom-field": 2,
  };
  const byCategory = rank[a.category] - rank[b.category];
  if (byCategory !== 0) return byCategory;
  const byLabel = a.label.localeCompare(b.label, undefined, {
    sensitivity: "base",
  });
  return byLabel !== 0 ? byLabel : a.itemKey.localeCompare(b.itemKey);
}

/** Read semantic contact-scoped review rows in a deterministic order. */
export async function listAiPermissionItems(
  exec: SqlExecutor,
  filter: AiPermissionReviewFilter,
): Promise<AiPermissionItem[]> {
  const items: AiPermissionItem[] = [];
  if (filter.category === undefined || filter.category === "memory") {
    const rows = await exec.getAllAsync<MemoryReviewRow>(
      `SELECT m.id, c.id AS contactId, c.uid AS contactUid,
              c.name AS contactName, m.type, m.custom_label AS customLabel,
              m.value, m.note, m.allow_ai AS enabled
         FROM memories m
         JOIN contacts c ON c.id = m.contact_id
        WHERE m.deleted_at IS NULL
          AND (trim(COALESCE(m.value, '')) != '' OR trim(COALESCE(m.note, '')) != '')
        ORDER BY c.name COLLATE NOCASE, c.uid, m.id`,
    );
    for (const row of rows) {
      assertPermissionValue(row.enabled);
      items.push({
        category: "memory",
        id: row.id,
        itemKey: `memory:${row.id}`,
        contactId: row.contactId,
        contactUid: row.contactUid,
        contactName: row.contactName,
        label: memoryLabel(row),
        value: memoryValue(row),
        enabled: row.enabled,
      });
    }
  }
  if (filter.category === undefined || filter.category === "interaction-note") {
    const rows = await exec.getAllAsync<NoteReviewRow>(
      `SELECT i.id, c.id AS contactId, c.uid AS contactUid,
              c.name AS contactName, i.note AS value, i.allow_ai AS enabled
         FROM interactions i
         JOIN contacts c ON c.id = i.contact_id
        WHERE trim(COALESCE(i.note, '')) != ''
        ORDER BY c.name COLLATE NOCASE, c.uid, i.occurred_at DESC, i.id DESC`,
    );
    for (const row of rows) {
      assertPermissionValue(row.enabled);
      items.push({
        category: "interaction-note",
        id: row.id,
        itemKey: `interaction-note:${row.id}`,
        contactId: row.contactId,
        contactUid: row.contactUid,
        contactName: row.contactName,
        label: "Interaction note",
        value: row.value,
        enabled: row.enabled,
      });
    }
  }
  if (filter.category === undefined || filter.category === "custom-field") {
    const rows = await exec.getAllAsync<FieldReviewRow>(
      `SELECT d.id, v.id AS valueId, c.id AS contactId, c.uid AS contactUid,
              c.name AS contactName, d.label, v.value,
              d.share_with_ai AS enabled
         FROM custom_field_values v
         JOIN custom_field_defs d ON d.id = v.field_def_id
         JOIN contacts c ON c.id = v.contact_id
        WHERE d.quarantined_at IS NULL
          AND trim(COALESCE(v.value, '')) != ''
        ORDER BY c.name COLLATE NOCASE, c.uid, d.display_order, d.id, v.id`,
    );
    for (const row of rows) {
      assertPermissionValue(row.enabled);
      items.push({
        category: "custom-field",
        id: row.id,
        itemKey: `custom-field:${row.valueId}`,
        contactId: row.contactId,
        contactUid: row.contactUid,
        contactName: row.contactName,
        label: row.label,
        value: row.value,
        enabled: row.enabled,
      });
    }
  }

  const query = filter.contactQuery?.trim().toLocaleLowerCase() ?? "";
  return items
    .filter((item) => !filter.enabledOnly || item.enabled === 1)
    .filter(
      (item) =>
        query.length === 0 ||
        item.contactName.toLocaleLowerCase().includes(query),
    )
    .sort(stableCompare);
}

export function summarizeAiPermissionItems(
  items: readonly AiPermissionItem[],
): AiPermissionImpact {
  return {
    contacts: new Set(items.map((item) => item.contactUid)).size,
    items: new Set(items.map((item) => item.itemKey)).size,
  };
}

async function itemsForRefs(
  exec: SqlExecutor,
  refs: readonly AiPermissionRef[],
): Promise<AiPermissionItem[]> {
  const selected = new Set(refs.map((ref) => `${ref.category}:${ref.id}`));
  return (await listAiPermissionItems(exec, {})).filter((item) =>
    selected.has(`${item.category}:${item.id}`),
  );
}

/** Calculate the complete contact/item blast radius before a bulk-enable confirm. */
export async function getBulkPermissionImpact(
  exec: SqlExecutor,
  refs: readonly AiPermissionRef[],
): Promise<AiPermissionImpact> {
  const selection = explicitSelection(refs);
  return summarizeAiPermissionItems(
    (await itemsForRefs(exec, selection)).filter((item) => item.enabled === 0),
  );
}

async function setSelectedPermissions(
  exec: SqlExecutor,
  refs: readonly AiPermissionRef[],
  value: AiPermissionValue,
  now: string,
): Promise<AiPermissionImpact> {
  const selection = explicitSelection(refs);
  const impact = summarizeAiPermissionItems(
    (await itemsForRefs(exec, selection)).filter(
      (item) => item.enabled !== value,
    ),
  );
  return inWriteTransaction(exec, async () => {
    for (const ref of selection) {
      const [sql, params] =
        ref.category === "memory"
          ? [
              "UPDATE memories SET allow_ai=?, modified_at=? WHERE id=?",
              [value, now, ref.id],
            ]
          : ref.category === "interaction-note"
            ? [
                "UPDATE interactions SET allow_ai=?, modified_at=? WHERE id=?",
                [value, now, ref.id],
              ]
            : [
                "UPDATE custom_field_defs SET share_with_ai=?, modified_at=? WHERE id=?",
                [value, now, ref.id],
              ];
      const result = await exec.runAsync(sql, params);
      if (result.changes !== 1) {
        throw new Error(
          `AI permission item ${ref.category}:${ref.id} changed ${result.changes} rows`,
        );
      }
    }
    await bumpDataRevisionCore(exec);
    return impact;
  });
}

export function bulkDisableAiPermissions(
  exec: SqlExecutor,
  refs: readonly AiPermissionRef[],
  now: string,
): Promise<AiPermissionImpact> {
  return setSelectedPermissions(exec, refs, 0, now);
}

/** Explicit selection only; callers must show `getBulkPermissionImpact` first. */
export function bulkEnableAiPermissions(
  exec: SqlExecutor,
  refs: readonly AiPermissionRef[],
  now: string,
): Promise<AiPermissionImpact> {
  return setSelectedPermissions(exec, refs, 1, now);
}
