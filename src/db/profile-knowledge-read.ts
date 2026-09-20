import {
  isValueInOptions,
  type ParseResult,
  parsers,
} from "@/db/field-parsers";
import type { CustomFieldDef } from "@/db/field-types";
import type { FuelItem } from "@/db/fuel-read";
import {
  listMemoriesForContact,
  type MemoryRow,
  resolveVisibility,
} from "@/db/memories-read";
import {
  type CurrentStateFieldKey,
  isCurrentStateFieldKey,
} from "@/db/memory-registry";
import {
  listRelationshipsForContact,
  type RelationshipRow,
  resolveRelationshipVisibility,
} from "@/db/relationships-read";
import type { ReadOnlyExecutor } from "@/db/transaction";

const PROFILE_REPEATABLE_LIMIT = 3;

export interface ProfileCollection<T> {
  items: T[];
  total: number;
  remainingCount: number;
  hiddenCount: number;
  showHiddenAvailable: boolean;
}

export interface ProfileCurrentStateEntry {
  id: number;
  uid: string;
  contact_id: number;
  field_key: CurrentStateFieldKey;
  value: string;
  created_at: string;
  modified_at: string;
  /**
   * Bounded retained entries for the same field, newest first. The current row
   * is structurally absent: this query accepts only `is_current = 0` rows.
   */
  previous: ProfileCurrentStateEntry[];
}

export type ProfileFeaturedReference =
  | { owner: "relationship"; id: number; row: RelationshipRow }
  | { owner: "memory"; id: number; row: MemoryRow };

export interface ProfileCustomFieldValue {
  fieldDefId: number;
  valueUid: string | null;
  label: string;
  type: CustomFieldDef["type"];
  options: string | null;
  rawValue: string | null;
  parsed: ParseResult;
  shareWithAi: 0 | 1;
  historyRetained: 0 | 1;
  historyKey: { contactId: number; fieldDefId: number } | null;
}

export interface ProfileCustomFieldGroup {
  name: string | null;
  items: ProfileCustomFieldValue[];
}

export interface ProfileKnowledge {
  currentState: Partial<Record<CurrentStateFieldKey, ProfileCurrentStateEntry>>;
  featured: ProfileCollection<ProfileFeaturedReference>;
  relationships: ProfileCollection<RelationshipRow>;
  memories: ProfileCollection<MemoryRow>;
  importedNotes: ProfileCollection<MemoryRow>;
  customFields: ProfileCustomFieldGroup[];
  offLimits: FuelItem[];
}

interface CurrentStateDbRow
  extends Omit<ProfileCurrentStateEntry, "field_key"> {
  field_key: string;
}

interface CustomFieldDbRow {
  field_def_id: number;
  value_uid: string | null;
  label: string;
  type: CustomFieldDef["type"];
  options: string | null;
  raw_value: string | null;
  share_with_ai: 0 | 1;
  history_retained: 0 | 1;
  field_group: string | null;
}

function collection<T>(
  visible: T[],
  hiddenCount: number,
  limit = PROFILE_REPEATABLE_LIMIT,
): ProfileCollection<T> {
  const items = visible.slice(0, limit);
  return {
    items,
    total: visible.length,
    remainingCount: visible.length - items.length,
    hiddenCount,
    showHiddenAvailable: hiddenCount > 0,
  };
}

async function readCurrentState(
  exec: ReadOnlyExecutor,
  contactId: number,
): Promise<ProfileKnowledge["currentState"]> {
  const rows = await exec.getAllAsync<CurrentStateDbRow>(
    `SELECT id, uid, contact_id, field_key, value, created_at, modified_at
       FROM current_state_entries
      WHERE contact_id = ? AND is_current = 1
      ORDER BY field_key, id DESC`,
    [contactId],
  );
  const result: ProfileKnowledge["currentState"] = {};
  for (const row of rows) {
    if (
      isCurrentStateFieldKey(row.field_key) &&
      result[row.field_key] === undefined
    ) {
      result[row.field_key] = {
        ...row,
        field_key: row.field_key,
        previous: [],
      };
    }
  }
  await Promise.all(
    Object.values(result).map(async (current) => {
      if (!current) return;
      const previousRows = await exec.getAllAsync<CurrentStateDbRow>(
        `SELECT id, uid, contact_id, field_key, value, created_at, modified_at
           FROM current_state_entries
          WHERE contact_id = ? AND field_key = ? AND is_current = 0
          ORDER BY created_at DESC, id DESC
          LIMIT 5`,
        [contactId, current.field_key],
      );
      current.previous = previousRows
        .filter((row) => isCurrentStateFieldKey(row.field_key))
        .map(
          (row): ProfileCurrentStateEntry => ({
            ...row,
            field_key: row.field_key as CurrentStateFieldKey,
            previous: [],
          }),
        );
    }),
  );
  return result;
}

/**
 * Group raw custom-field rows into the renderer-neutral `ProfileCustomFieldGroup[]`
 * shape, preserving `field_group` grouping and query order. Shared by the
 * heavyweight Profile read (`readCustomFields`) and the narrow populated-only
 * Research export (`readPopulatedCustomFields`) so their per-item mapping —
 * option-validated parse, `shareWithAi` truth, history identity — can never drift.
 */
function groupCustomFieldRows(
  rows: CustomFieldDbRow[],
  contactId: number,
): ProfileCustomFieldGroup[] {
  const groups: ProfileCustomFieldGroup[] = [];
  const byName = new Map<string | null, ProfileCustomFieldGroup>();
  for (const row of rows) {
    let group = byName.get(row.field_group);
    if (!group) {
      group = { name: row.field_group, items: [] };
      byName.set(row.field_group, group);
      groups.push(group);
    }
    const parsed = parsers[row.type](row.raw_value);
    const validOption = isValueInOptions(
      { type: row.type, options: row.options },
      row.raw_value,
    );
    group.items.push({
      fieldDefId: row.field_def_id,
      valueUid: row.value_uid,
      label: row.label,
      type: row.type,
      options: row.options,
      rawValue: row.raw_value,
      parsed: validOption ? parsed : { ok: false },
      shareWithAi: row.share_with_ai,
      historyRetained: row.history_retained,
      historyKey:
        row.history_retained === 1
          ? { contactId, fieldDefId: row.field_def_id }
          : null,
    });
  }
  return groups;
}

async function readCustomFields(
  exec: ReadOnlyExecutor,
  contactId: number,
): Promise<ProfileCustomFieldGroup[]> {
  const rows = await exec.getAllAsync<CustomFieldDbRow>(
    `SELECT d.id AS field_def_id, v.uid AS value_uid, d.label, d.type,
            d.options, v.value AS raw_value, d.share_with_ai,
            d.history_retained, d.field_group
       FROM custom_field_defs d
       LEFT JOIN custom_field_values v
         ON v.field_def_id = d.id AND v.contact_id = ?
      WHERE d.quarantined_at IS NULL
        AND (d.scope = 'global' OR v.id IS NOT NULL)
        AND (d.always_show = 1 OR v.value IS NOT NULL)
      ORDER BY d.display_order, d.id`,
    [contactId],
  );
  return groupCustomFieldRows(rows, contactId);
}

/**
 * Narrow, POPULATED-only custom-field projection for the Compose Research read
 * (COMP-08 / A2, plan 35-06). Distinct from the private `readCustomFields` and the
 * heavyweight `readProfileKnowledge` collection, which both admit `always_show`
 * defs with an empty value — Research shows only populated conversation-relevant
 * data, never data-completeness admin scaffolding.
 *
 * Returns only NON-QUARANTINED fields with a POPULATED value (`v.value IS NOT
 * NULL` → `rawValue != null`), each carrying its own `share_with_ai` truth
 * (`shareWithAi`), with NO PROFILE_REPEATABLE_LIMIT cap. `compose-research-read`
 * consumes THIS export for its custom-field source; it never imports the private
 * `readCustomFields` (cross-module-uncallable) nor `readProfileKnowledge`.
 */
export async function readPopulatedCustomFields(
  exec: ReadOnlyExecutor,
  contactId: number,
): Promise<ProfileCustomFieldGroup[]> {
  const rows = await exec.getAllAsync<CustomFieldDbRow>(
    `SELECT d.id AS field_def_id, v.uid AS value_uid, d.label, d.type,
            d.options, v.value AS raw_value, d.share_with_ai,
            d.history_retained, d.field_group
       FROM custom_field_defs d
       JOIN custom_field_values v
         ON v.field_def_id = d.id AND v.contact_id = ?
      WHERE d.quarantined_at IS NULL
        AND v.value IS NOT NULL
      ORDER BY d.display_order, d.id`,
    [contactId],
  );
  return groupCustomFieldRows(rows, contactId);
}

/** Owner-facing Off Limits projection. It is never reused for ranking or AI. */
export function readProfileOffLimits(
  exec: ReadOnlyExecutor,
  contactId: number,
): Promise<FuelItem[]> {
  return exec.getAllAsync<FuelItem>(
    `SELECT id, contact_id, kind, label, text, url, created_at, source
       FROM fuel
      WHERE contact_id = ? AND kind = 'off_limits'
      ORDER BY created_at DESC, id DESC`,
    [contactId],
  );
}

/**
 * Read renderer-neutral Profile knowledge without flattening its semantic owners.
 * Hidden rows are counted for administration but never admitted to visible caps;
 * featured rows are references and are removed from their ordinary child lists.
 */
export async function readProfileKnowledge(
  exec: ReadOnlyExecutor,
  contactId: number,
): Promise<ProfileKnowledge> {
  const [currentState, relationshipRows, memoryRows, customFields, offLimits] =
    await Promise.all([
      readCurrentState(exec, contactId),
      listRelationshipsForContact(exec, contactId),
      listMemoriesForContact(exec, contactId),
      readCustomFields(exec, contactId),
      readProfileOffLimits(exec, contactId),
    ]);

  const visibleRelationships = relationshipRows.filter(
    (row) => resolveRelationshipVisibility(row.hidden) === "show",
  );
  const hiddenRelationships =
    relationshipRows.length - visibleRelationships.length;
  const visibleMemories = memoryRows.filter(
    (row) => resolveVisibility(row.type, row.hidden) === "show",
  );
  const hiddenGeneral = memoryRows.filter(
    (row) =>
      row.type !== "imported" &&
      resolveVisibility(row.type, row.hidden) === "hide",
  ).length;
  const hiddenImported = memoryRows.filter(
    (row) =>
      row.type === "imported" &&
      resolveVisibility(row.type, row.hidden) === "hide",
  ).length;

  const featuredRelationships = visibleRelationships.filter(
    (row) => row.pinned === 1,
  );
  const featuredMemories = visibleMemories.filter((row) => row.pinned === 1);
  const featured: ProfileFeaturedReference[] = [
    ...featuredRelationships.map(
      (row): ProfileFeaturedReference => ({
        owner: "relationship",
        id: row.id,
        row,
      }),
    ),
    ...featuredMemories.map(
      (row): ProfileFeaturedReference => ({ owner: "memory", id: row.id, row }),
    ),
  ];
  const relationshipItems = visibleRelationships.filter(
    (row) => row.pinned !== 1,
  );
  const generalItems = visibleMemories.filter(
    (row) => row.type !== "imported" && row.pinned !== 1,
  );
  const importedItems = visibleMemories.filter(
    (row) => row.type === "imported" && row.pinned !== 1,
  );

  return {
    currentState,
    featured: collection(featured, 0),
    relationships: collection(relationshipItems, hiddenRelationships),
    memories: collection(generalItems, hiddenGeneral),
    importedNotes: collection(importedItems, hiddenImported),
    customFields,
    offLimits,
  };
}
