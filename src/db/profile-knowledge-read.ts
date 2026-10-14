import { currentStateOrderSql } from "@/db/current-state-history-read";
import {
  isValueInOptions,
  type ParseResult,
  parsers,
} from "@/db/field-parsers";
import type { CustomFieldDef } from "@/db/field-types";
import {
  listMemoriesForContact,
  type MemoryRow,
  resolveVisibility,
} from "@/db/memories-read";
import {
  CURRENT_STATE_FIELD_KEYS,
  type CurrentStateFieldKey,
} from "@/db/memory-registry";
import {
  listOffLimitsForContact,
  type OffLimitsRow,
} from "@/db/off-limits-read";
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
  /** Local `YYYY-MM-DD` the entry is about (D-41); optional for fixtures. */
  entry_date?: string;
  /** `HH:MM:SS` for a linked entry, NULL for a direct one (D-48). */
  entry_time?: string | null;
  url?: string | null;
  /** The linked interaction, so a linked entry can open it (D-37, D-107). */
  interaction_id?: number | null;
  link_source?: string | null;
  /**
   * How many entries the field holds in all (D-52, D-53). Set only on the
   * top-level Most Recent entry, never on the nested `previous` rows.
   */
  total?: number;
  /**
   * Up to five earlier entries for the same field, in the current-state
   * order (D-50, D-51). The Most Recent row is never repeated here.
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
  /** Memories (`general`, and any other non-imported type without a section). */
  memories: ProfileCollection<MemoryRow>;
  /** Thought of Them, its own section (D-34, D-44). */
  thoughtOfThem: ProfileCollection<MemoryRow>;
  /** Gift Ideas, its own section (D-34, D-44). */
  giftIdeas: ProfileCollection<MemoryRow>;
  importedNotes: ProfileCollection<MemoryRow>;
  customFields: ProfileCustomFieldGroup[];
  offLimits: OffLimitsRow[];
}

interface CurrentStateDbRow
  extends Omit<ProfileCurrentStateEntry, "field_key" | "previous" | "total"> {
  field_key: string;
  total: number;
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

/** Most Recent plus the earlier entries the Profile shows (D-50, D-52). */
const PROFILE_PREVIOUS_LIMIT = 5;

/**
 * One query per field, in `currentStateOrderSql()` order (D-45, D-51): the
 * first row is Most Recent, the next five are Previous, and `total` counts
 * every entry of the field (D-52, D-53).
 */
async function readCurrentState(
  exec: ReadOnlyExecutor,
  contactId: number,
): Promise<ProfileKnowledge["currentState"]> {
  const result: ProfileKnowledge["currentState"] = {};
  await Promise.all(
    CURRENT_STATE_FIELD_KEYS.map(async (fieldKey) => {
      const rows = await exec.getAllAsync<CurrentStateDbRow>(
        `SELECT id, uid, contact_id, field_key, value, entry_date, entry_time,
                url, interaction_id, link_source, created_at, modified_at,
                COUNT(*) OVER () AS total
           FROM current_state_entries
          WHERE contact_id = ? AND field_key = ?
          ORDER BY ${currentStateOrderSql()}
          LIMIT ?`,
        [contactId, fieldKey, PROFILE_PREVIOUS_LIMIT + 1],
      );
      const [first, ...earlier] = rows;
      if (!first) return;
      const entry = ({
        total: _total,
        ...row
      }: CurrentStateDbRow): ProfileCurrentStateEntry => ({
        ...row,
        field_key: fieldKey,
        previous: [],
      });
      result[fieldKey] = {
        ...entry(first),
        total: first.total,
        previous: earlier.map(entry),
      };
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

type ProfileMemorySection =
  | "memories"
  | "thoughtOfThem"
  | "giftIdeas"
  | "importedNotes";

/**
 * The Profile section a memory type belongs to (D-34, D-44). Any type without
 * a section of its own stays under Memories, as before.
 */
function profileMemorySection(type: string): ProfileMemorySection {
  switch (type) {
    case "imported":
      return "importedNotes";
    case "thought_of_them":
      return "thoughtOfThem";
    case "gift_idea":
      return "giftIdeas";
    default:
      return "memories";
  }
}

/** Descending text order (ISO dates and `YYYY-MM-DD HH:MM:SS` stamps). */
function textDesc(a: string, b: string): number {
  return a < b ? 1 : a > b ? -1 : 0;
}

/**
 * A Profile section body's memory order (38.10 D-148): the newest entries,
 * ignoring pins. This is the shared read's order (`listMemoriesForContact`,
 * docs/systems/contact-knowledge.md) without its leading `pinned DESC` key:
 * dated entries first by `meaningful_date` DESC, then `created_at` DESC, then
 * `id` DESC. Pinned entries stay in Pinned (D-133) and appear in their
 * section only when they are among its newest. Profile section bodies only:
 * the section editors and the other hosts keep the shared read's pin-first
 * order. PURE.
 */
export function profileSectionMemoryOrder(a: MemoryRow, b: MemoryRow): number {
  const aUndated = a.meaningful_date === null ? 1 : 0;
  const bUndated = b.meaningful_date === null ? 1 : 0;
  if (aUndated !== bUndated) return aUndated - bUndated;
  if (a.meaningful_date !== null && b.meaningful_date !== null) {
    const byDate = textDesc(a.meaningful_date, b.meaningful_date);
    if (byDate !== 0) return byDate;
  }
  return textDesc(a.created_at, b.created_at) || b.id - a.id;
}

/**
 * The Profile Key People body's order (38.10 D-148): the newest first,
 * ignoring pins; `listRelationshipsForContact` without `pinned DESC`. PURE.
 */
export function profileSectionRelationshipOrder(
  a: RelationshipRow,
  b: RelationshipRow,
): number {
  return textDesc(a.created_at, b.created_at) || b.id - a.id;
}

/**
 * Read renderer-neutral Profile knowledge without flattening its semantic owners.
 * Hidden rows are counted for administration but never admitted to visible caps
 * (while Hide from Profile is switched off nothing resolves hidden, so every
 * count is 0; D-134). Pinned rows show in Pinned and in their own section
 * (D-133): featured entries are references to rows that also stay in their
 * ordinary child lists, where each section shows its newest entries,
 * ignoring pins (D-148).
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
      // Owner-facing Off Limits (D-36); never reused for AI (D-09).
      listOffLimitsForContact(exec, contactId),
    ]);

  const visibleRelationships = relationshipRows.filter(
    (row) => resolveRelationshipVisibility(row.hidden) === "show",
  );
  const hiddenRelationships =
    relationshipRows.length - visibleRelationships.length;
  const visibleMemories = memoryRows.filter(
    (row) => resolveVisibility(row.type, row.hidden) === "show",
  );
  // One hidden count per section (convergence c6, Claude C-02): a hidden
  // Gift Idea never counts toward Memories. Show hidden is otherwise
  // unchanged (D-71 deferred).
  const hiddenOf = (section: ProfileMemorySection) =>
    memoryRows.filter(
      (row) =>
        profileMemorySection(row.type) === section &&
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
  // Pinned rows show in Pinned and in their own section (D-133), so a
  // section whose only entry is pinned never reads as empty (O6). Each
  // section shows its newest entries, ignoring pins (D-148); Pinned keeps
  // the read's order.
  const relationshipItems = [...visibleRelationships].sort(
    profileSectionRelationshipOrder,
  );
  const sectionItems = (section: ProfileMemorySection) =>
    visibleMemories
      .filter((row) => profileMemorySection(row.type) === section)
      .sort(profileSectionMemoryOrder);

  return {
    currentState,
    // Pinned shows every pinned item, with no cap (D-112).
    featured: collection(featured, 0, featured.length),
    relationships: collection(relationshipItems, hiddenRelationships),
    memories: collection(sectionItems("memories"), hiddenOf("memories")),
    thoughtOfThem: collection(
      sectionItems("thoughtOfThem"),
      hiddenOf("thoughtOfThem"),
    ),
    giftIdeas: collection(sectionItems("giftIdeas"), hiddenOf("giftIdeas")),
    importedNotes: collection(
      sectionItems("importedNotes"),
      hiddenOf("importedNotes"),
    ),
    customFields,
    offLimits,
  };
}
