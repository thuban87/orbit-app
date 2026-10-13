/**
 * compose-research-read (COMP-08 / COMP-11 / HIGH-6, plan 35-06) — the normalized
 * READ boundary for the Compose "Things to Remember" Research side.
 *
 * =============================================================================
 * WHY A NORMALIZING PROJECTION (HIGH-6): Add-to-AI eligibility is NOT one common
 * shape across the knowledge sources — memories carry `allow_ai`, custom fields
 * carry `share_with_ai`, and first-class fields / structured relationships /
 * current-state entries carry NO permission column at all. This module composes
 * the existing knowledge READ modules into ONE normalized `ResearchItem` list,
 * deriving an explicit `aiEligible` boolean from each SOURCE-SPECIFIC permission
 * at this boundary. The Research screen and the compose-session store consume
 * `ResearchItem.aiEligible` / `.isOffLimits` — they NEVER re-derive eligibility
 * from raw source rows (T-35-15).
 *
 * READ-PATH RULES (this is a pure, offline, read-only projection):
 *   - It composes read modules only; it opens no transaction and performs no
 *     write, no network, and no native-module import (node-testable).
 *   - Per-source DISPLAY visibility (what may render at all — distinct from
 *     aiEligible) is applied here so hidden / soft-deleted / historical knowledge
 *     can never surface (review LOW #4): memories use `resolveVisibility`;
 *     relationships EXCLUDE hidden via `resolveRelationshipVisibility` (the list
 *     returns hidden rows, so the filter is REQUIRED); current-state uses
 *     `getCurrentStateValues` (each field's Most Recent entry by date, D-45)
 *     ONLY — never the history read; custom fields come from the
 *     populated-only `readPopulatedCustomFields`.
 *   - Memory `aiEligible` comes from the SAME SQL predicate as the AI read
 *     (`listAiEligibleMemories`), so a linked memory whose interaction has AI
 *     off can never be Message Focus (D-49).
 *   - Off Limits is projected as a read-only Off Limits group (D-87):
 *     `isOffLimits = true`, `aiEligible = false` ALWAYS. Off Limits is NEVER
 *     carried to AI in any form and can NEVER be Message Focus (D-09, D-10;
 *     ADR-107, T-35-16).
 *   - Values stay the raw stored text: Message Focus sends `value` to AI, and
 *     display formatting happens at render in `compose-research-logic.ts`
 *     (38.9 D-66/D-70). This module formats nothing.
 *   - Operational / derived status (gravity, intensity) is EXCLUDED — Research
 *     shows conversation-relevant knowledge, not operational metadata (COMP-08).
 * =============================================================================
 */
import { getCurrentStateValues } from "@/db/current-state-history-read";
import {
  type FirstClassFields,
  getFirstClassFields,
} from "@/db/first-class-knowledge-read";
import {
  listAiEligibleMemories,
  listMemoriesForContact,
  type MemoryRow,
  resolveVisibility,
} from "@/db/memories-read";
import {
  CURRENT_STATE_FIELD_KEYS,
  CURRENT_STATE_FIELD_REGISTRY,
  isMemoryTypeKey,
  MEMORY_TYPE_REGISTRY,
  PROVISIONAL_MEMORY_LABEL,
  RELATIONSHIPS_GROUP,
} from "@/db/memory-registry";
import { listOffLimitsForContact } from "@/db/off-limits-read";
import { readPopulatedCustomFields } from "@/db/profile-knowledge-read";
import {
  listRelationshipsForContact,
  resolveRelationshipVisibility,
} from "@/db/relationships-read";
import type { SqlExecutor } from "@/db/types";
import type { FieldType } from "@/schemas/types";
import { plural } from "@/utils/plural";

/**
 * One normalized, display-ready knowledge item for the Research side.
 *
 * `aiEligible` is derived ONCE here from the item's own source-specific permission
 * (the memory AI predicate in SQL / custom-field `share_with_ai`; every other
 * source is false). `isOffLimits` marks the read-only Off Limits group, which
 * is always `aiEligible: false`. `id` is a stable `sourceType:sourceId`
 * identity used by the session store to dedupe / toggle Message Focus by
 * identity.
 */
export interface ResearchItem {
  id: string;
  /**
   * A stable group key (`current`, `basics`, `key_people`, `memory:<type>`,
   * `custom:<group>`, `off_limits`). The screen groups and keys by it, never by
   * the display name, so two groups sharing a name stay distinct (D-29, J-X01).
   */
  groupId: string;
  group: string;
  label: string;
  value: string;
  aiEligible: boolean;
  isOffLimits: boolean;
  /**
   * Custom-field items only: the field's type, so the screen can show a Date
   * value in its display form (38.9 D-66; render only). `value` stays the raw
   * stored text, and Message Focus projects only `label` and `value`.
   */
  fieldType?: FieldType;
  /**
   * Memory items only: the raw stored meaningful date, formatted at render
   * (D-29). Never projected to Message Focus.
   */
  meaningfulDate?: string;
  /**
   * Current-state items only: the raw entry date (D-41), formatted at render
   * (D-29). Never projected to Message Focus.
   */
  entryDate?: string;
}

/** Display group names for sources without a registry group of their own. */
const CURRENT_STATE_GROUP = "Current";
const BASICS_GROUP = "Basics";
const CUSTOM_GROUP = "Custom";
const OFF_LIMITS_GROUP = "Off Limits";

/**
 * A memory's section name: the registry display name of its type, so Gift
 * Ideas and Thought of Them show as their own sections like Memories (D-29,
 * D-91, D-89 one registry), matching the Profile's sections.
 */
function memorySectionName(row: MemoryRow): string {
  return isMemoryTypeKey(row.type)
    ? MEMORY_TYPE_REGISTRY[row.type].displayName
    : PROVISIONAL_MEMORY_LABEL;
}

/**
 * A memory's item label: its own label when it has one (D-86 keeps a converted
 * custom memory's label), else its section name. The screen hides a label that
 * repeats its group heading (J-09).
 */
function memoryItemLabel(row: MemoryRow): string {
  return row.custom_label?.trim() || memorySectionName(row);
}

/**
 * The populated first-class fields, in presentation order. Only the four durable
 * base fields (no permission column → never Add-to-AI). Derived gravity/intensity
 * are deliberately OMITTED as operational metadata (COMP-08). Birthday is emitted
 * as its raw stored text — never re-formatted from a Date (no UTC off-by-one).
 */
function firstClassResearchItems(
  fc: FirstClassFields,
): { key: string; label: string; value: string }[] {
  const out: { key: string; label: string; value: string }[] = [];
  if (fc.birthday != null) {
    out.push({ key: "birthday", label: "Birthday", value: fc.birthday });
  }
  if (fc.socialBattery != null) {
    out.push({
      key: "socialBattery",
      label: "Social battery",
      value: fc.socialBattery,
    });
  }
  if (fc.intervalDays != null) {
    out.push({
      key: "interval",
      label: "Contact frequency",
      value: plural(fc.intervalDays, "day"),
    });
  }
  if (fc.categoryName != null) {
    out.push({ key: "category", label: "Category", value: fc.categoryName });
  }
  return out;
}

/**
 * Read a contact's conversation-relevant knowledge as one normalized, populated-
 * only `ResearchItem[]` for the Compose Research side. Only populated groups are
 * emitted (empty groups are simply absent). Pure read — no transaction, no
 * network, offline-safe.
 */
export async function readComposeResearch(
  exec: SqlExecutor,
  contactId: number,
): Promise<ResearchItem[]> {
  const [
    currentValues,
    firstClass,
    relationships,
    memories,
    eligibleMemories,
    customGroups,
    offLimits,
  ] = await Promise.all([
    getCurrentStateValues(exec, contactId),
    getFirstClassFields(exec, contactId),
    listRelationshipsForContact(exec, contactId),
    listMemoriesForContact(exec, contactId),
    listAiEligibleMemories(exec, contactId),
    readPopulatedCustomFields(exec, contactId),
    listOffLimitsForContact(exec, contactId),
  ]);
  const eligibleIds = new Set(eligibleMemories.map((row) => row.id));

  const items: ResearchItem[] = [];

  // 1. Current state — getCurrentStateValues returns each field's Most Recent
  //    entry by date (D-45) ONLY; an earlier entry can never leak in (never the
  //    retained history read).
  for (const key of CURRENT_STATE_FIELD_KEYS) {
    const entry = currentValues[key];
    if (!entry) continue;
    items.push({
      id: `current:${key}`,
      groupId: "current",
      group: CURRENT_STATE_GROUP,
      label: CURRENT_STATE_FIELD_REGISTRY[key].displayName,
      value: entry.value,
      aiEligible: false,
      isOffLimits: false,
      entryDate: entry.entry_date,
    });
  }

  // 2. Basics (first-class) — populated only; no permission field → aiEligible false.
  if (firstClass) {
    for (const field of firstClassResearchItems(firstClass)) {
      items.push({
        id: `firstclass:${field.key}`,
        groupId: "basics",
        group: BASICS_GROUP,
        label: field.label,
        value: field.value,
        aiEligible: false,
        isOffLimits: false,
      });
    }
  }

  // 3. Key people — EXCLUDE hidden (the list returns hidden rows); no permission
  //    field → aiEligible false.
  for (const row of relationships) {
    if (resolveRelationshipVisibility(row.hidden) !== "show") continue;
    items.push({
      id: `relationship:${row.id}`,
      groupId: "key_people",
      group: RELATIONSHIPS_GROUP.displayName,
      label: row.person_name,
      value: row.relation_type ?? row.linked_contact_name ?? row.note ?? "",
      aiEligible: false,
      isOffLimits: false,
    });
  }

  // 4. Memories (every memory-type section) — visible only (soft-deleted
  //    already dropped by the read). Add-to-AI eligibility is membership in the
  //    SQL-gated AI read, never a JS re-derivation (D-13, D-49).
  for (const row of memories) {
    if (resolveVisibility(row.type, row.hidden) !== "show") continue;
    const item: ResearchItem = {
      id: `memory:${row.id}`,
      groupId: `memory:${row.type}`,
      group: memorySectionName(row),
      label: memoryItemLabel(row),
      value: row.value ?? row.note ?? "",
      aiEligible: eligibleIds.has(row.id),
      isOffLimits: false,
    };
    items.push(
      row.meaningful_date
        ? { ...item, meaningfulDate: row.meaningful_date }
        : item,
    );
  }

  // 5. Custom fields — populated only; per-field share_with_ai drives eligibility.
  for (const group of customGroups) {
    for (const field of group.items) {
      items.push({
        id: `custom:${field.fieldDefId}`,
        groupId: `custom:${group.name ?? ""}`,
        group: group.name ?? CUSTOM_GROUP,
        label: field.label,
        value: field.rawValue ?? "",
        aiEligible: field.shareWithAi === 1,
        isOffLimits: false,
        fieldType: field.type,
      });
    }
  }

  // 6. Off Limits → the read-only Off Limits group (D-87); never Add-to-AI,
  //    never Message Focus (D-10). An unlabeled item has an empty label, so its
  //    text shows once with no label line and no fallback wording (D-111).
  for (const row of offLimits) {
    items.push({
      id: `offlimits:${row.id}`,
      groupId: "off_limits",
      group: OFF_LIMITS_GROUP,
      label: row.label?.trim() ? row.label : "",
      value: row.text ?? "",
      aiEligible: false,
      isOffLimits: true,
    });
  }

  return items;
}
