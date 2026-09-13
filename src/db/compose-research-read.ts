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
 *     `getCurrentStateValues` (is_current = 1) ONLY — never the history read;
 *     custom fields come from the populated-only `readPopulatedCustomFields`.
 *   - Off Limits is projected as a read-only "Avoid" group: `isOffLimits = true`,
 *     `aiEligible = false` ALWAYS. Off Limits is NEVER carried to AI in any form
 *     and can NEVER be Message Focus (D-14 / ADR-107, T-35-16).
 *   - Operational / derived status (gravity, intensity) is EXCLUDED — Research
 *     shows conversation-relevant knowledge, not operational metadata (COMP-08).
 * =============================================================================
 */
import {
  getCurrentStateValues,
} from "@/db/current-state-history-read";
import {
  type FirstClassFields,
  getFirstClassFields,
} from "@/db/first-class-knowledge-read";
import {
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
import {
  readPopulatedCustomFields,
  readProfileOffLimits,
} from "@/db/profile-knowledge-read";
import {
  listRelationshipsForContact,
  resolveRelationshipVisibility,
} from "@/db/relationships-read";
import type { SqlExecutor } from "@/db/types";

/**
 * One normalized, display-ready knowledge item for the Research side.
 *
 * `aiEligible` is derived ONCE here from the item's own source-specific permission
 * (memory `allow_ai` / custom-field `share_with_ai`; every other source is false).
 * `isOffLimits` marks the read-only Avoid group, which is always `aiEligible:
 * false`. `id` is a stable `sourceType:sourceId` identity used by the session
 * store to dedupe / toggle Message Focus by identity.
 */
export interface ResearchItem {
  id: string;
  group: string;
  label: string;
  value: string;
  aiEligible: boolean;
  isOffLimits: boolean;
}

/** Display group names for sources without a registry group of their own. */
const CURRENT_STATE_GROUP = "Current";
const BASICS_GROUP = "Basics";
const CUSTOM_GROUP = "Custom";
const AVOID_GROUP = "Avoid";

/** The human-readable group label for a memory (mirrors the Profile surface). */
function memoryGroupLabel(row: MemoryRow): string {
  if (row.type === "custom") {
    return row.custom_label ?? PROVISIONAL_MEMORY_LABEL;
  }
  return isMemoryTypeKey(row.type)
    ? MEMORY_TYPE_REGISTRY[row.type].displayName
    : PROVISIONAL_MEMORY_LABEL;
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
      value: `${fc.intervalDays} days`,
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
    customGroups,
    offLimits,
  ] = await Promise.all([
    getCurrentStateValues(exec, contactId),
    getFirstClassFields(exec, contactId),
    listRelationshipsForContact(exec, contactId),
    listMemoriesForContact(exec, contactId),
    readPopulatedCustomFields(exec, contactId),
    readProfileOffLimits(exec, contactId),
  ]);

  const items: ResearchItem[] = [];

  // 1. Current state — getCurrentStateValues is `is_current = 1` ONLY; a
  //    superseded/historical entry can never leak in (never the retained history read).
  for (const key of CURRENT_STATE_FIELD_KEYS) {
    const entry = currentValues[key];
    if (!entry) continue;
    items.push({
      id: `current:${key}`,
      group: CURRENT_STATE_GROUP,
      label: CURRENT_STATE_FIELD_REGISTRY[key].displayName,
      value: entry.value,
      aiEligible: false,
      isOffLimits: false,
    });
  }

  // 2. Basics (first-class) — populated only; no permission field → aiEligible false.
  if (firstClass) {
    for (const field of firstClassResearchItems(firstClass)) {
      items.push({
        id: `firstclass:${field.key}`,
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
      group: RELATIONSHIPS_GROUP.displayName,
      label: row.person_name,
      value: row.relation_type ?? row.linked_contact_name ?? row.note ?? "",
      aiEligible: false,
      isOffLimits: false,
    });
  }

  // 4. Memories — visible only (soft-deleted already dropped by the read); per-item
  //    allow_ai is the ONLY Add-to-AI eligibility truth.
  for (const row of memories) {
    if (resolveVisibility(row.type, row.hidden) !== "show") continue;
    items.push({
      id: `memory:${row.id}`,
      group: memoryGroupLabel(row),
      label: memoryGroupLabel(row),
      value: row.value ?? row.note ?? "",
      aiEligible: row.allow_ai === 1,
      isOffLimits: false,
    });
  }

  // 5. Custom fields — populated only; per-field share_with_ai drives eligibility.
  for (const group of customGroups) {
    for (const field of group.items) {
      items.push({
        id: `custom:${field.fieldDefId}`,
        group: group.name ?? CUSTOM_GROUP,
        label: field.label,
        value: field.rawValue ?? "",
        aiEligible: field.shareWithAi === 1,
        isOffLimits: false,
      });
    }
  }

  // 6. Off Limits → the read-only Avoid group; never Add-to-AI, never Message Focus.
  for (const row of offLimits) {
    items.push({
      id: `offlimits:${row.id}`,
      group: AVOID_GROUP,
      label: row.label ?? AVOID_GROUP,
      value: row.text ?? "",
      aiEligible: false,
      isOffLimits: true,
    });
  }

  return items;
}
