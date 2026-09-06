/**
 * SQL eligibility read for the bounded TypeScript knowledge search scorer.
 *
 * This module never searches by term in SQL: it returns raw, user-facing source
 * entries only, then `knowledge-search.ts` applies the shared typo-tolerant
 * tokenizer and scorer. Fuel is deliberately not read here; it is not a
 * KNOW-10 source and remains owned by dashboard-read.ts.
 */
import { listDefs } from "@/db/field-defs-dao";
import type { CustomFieldDef } from "@/db/field-types";
import {
  MEMORY_TYPE_REGISTRY,
  type MemoryTypeKey,
} from "@/db/memory-registry";
import { resolveVisibility } from "@/db/memories-read";
import { resolveRelationshipVisibility } from "@/db/relationships-read";
import type { SqlExecutor } from "@/db/types";

export type KnowledgeSearchSource =
  | "name"
  | "phone"
  | "email"
  | "category"
  | "memory"
  | "relationship"
  | "customField";

export type KnowledgeSearchPart =
  | "identity"
  | "relationship"
  | "memory-or-custom-field"
  | "note-or-body";

export interface KnowledgeSearchEntry {
  readonly source: KnowledgeSearchSource;
  readonly text: string;
  /** User-facing semantic label, never an internal storage identifier. */
  readonly label: string;
  /** Closed presentation provenance used to construct Dashboard descriptors. */
  readonly part: KnowledgeSearchPart;
  /** Stable custom-field key, present only for `source: "customField"`. */
  readonly fieldKey?: string;
  /** Memory registry key, present only for `source: "memory"`. */
  readonly memoryType?: MemoryTypeKey;
  /** User-facing relationship type, when the relationship has one. */
  readonly relationType?: string | null;
}

/**
 * One complete, structured candidate for later Dashboard search consumption.
 * `entries` deliberately contains no storage identifiers or metadata: the
 * contact id is the result key, while each entry exposes just user-facing text
 * and its provenance kind.
 */
export interface KnowledgeSearchCandidate {
  readonly contactId: number;
  readonly entries: ReadonlyArray<KnowledgeSearchEntry>;
}

interface ContactRow {
  contactId: number;
  name: string;
  categoryLabel: string | null;
}

interface MemoryRow {
  contactId: number;
  type: MemoryTypeKey;
  customLabel: string | null;
  value: string | null;
  note: string | null;
  hidden: number | null;
  outdated: number;
}

interface RelationshipRow {
  contactId: number;
  personName: string;
  relationType: string | null;
  note: string | null;
  hidden: number | null;
}

interface CustomValueRow {
  contactId: number;
  colName: string;
  value: string | null;
}

interface ContactMethodRow {
  contactId: number;
  methodType: "phone" | "email";
  displayValue: string;
}

function placeholders(values: readonly unknown[]): string {
  return values.map(() => "?").join(", ");
}

function contactsSql(eligibleIds: readonly number[]): string {
  return `
SELECT c.id AS contactId, c.name, cat.name AS categoryLabel
  FROM contacts c
  LEFT JOIN categories cat ON cat.id = c.category_id
 WHERE c.id IN (${placeholders(eligibleIds)})
 ORDER BY c.id`;
}

function relationshipsSql(eligibleIds: readonly number[]): string {
  return `
SELECT contact_id AS contactId, person_name AS personName
       , relation_type AS relationType, note, hidden
  FROM relationships
 WHERE deleted_at IS NULL
   AND contact_id IN (${placeholders(eligibleIds)})
 ORDER BY contact_id, id`;
}

function contactMethodsSql(eligibleIds: readonly number[]): string {
  return `
SELECT contact_id AS contactId, method_type AS methodType, display_value AS displayValue
  FROM contact_methods
 WHERE contact_id IN (${placeholders(eligibleIds)})
   AND method_type IN (?, ?)
 ORDER BY contact_id, method_type, display_order, id`;
}

function searchableMemoryTypes(): string[] {
  return Object.entries(MEMORY_TYPE_REGISTRY)
    .filter(([, metadata]) => metadata.searchable)
    .map(([type]) => type);
}

function memorySql(
  types: readonly string[],
  eligibleIds: readonly number[],
): string {
  return `
SELECT contact_id AS contactId,
       type,
       custom_label AS customLabel,
       value,
       note,
       hidden,
       outdated
  FROM memories
 WHERE deleted_at IS NULL
   AND type IN (${types.map(() => "?").join(", ")})
   AND contact_id IN (${placeholders(eligibleIds)})
 ORDER BY contact_id, id`;
}

/**
 * Batch counterpart to `getValuesForContact`. The literal definitions join is
 * deliberate: it preserves that DAO's quarantine/non-shared-definition
 * boundary in this shared visible-search corpus.
 */
function customValuesSql(
  eligibleIds: readonly number[],
  definitionIds: readonly number[],
): string {
  return `
SELECT values_table.contact_id AS contactId, defs.col_name AS colName, values_table.value
  FROM custom_field_values AS values_table
  JOIN custom_field_defs AS defs ON defs.id = values_table.field_def_id
 WHERE values_table.contact_id IN (${placeholders(eligibleIds)})
   AND values_table.field_def_id IN (${placeholders(definitionIds)})
 ORDER BY values_table.contact_id, values_table.field_def_id`;
}

/**
 * The one searchable-custom-field predicate. A definition must still be live
 * and its normalized value must contain user-facing content. Custom values are
 * fetched only through `getValuesForContact`, whose definition ids are bound.
 */
export function isSearchableCustomFieldValue(
  definition: CustomFieldDef,
  value: string | null | undefined,
): value is string {
  return (
    definition.quarantined_at === null &&
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function appendMemoryEntries(
  entries: KnowledgeSearchEntry[],
  memory: MemoryRow,
): void {
  const label = MEMORY_TYPE_REGISTRY[memory.type].displayName;
  for (const text of [memory.customLabel, memory.value]) {
    if (text !== null && text.trim().length > 0) {
      entries.push({
        source: "memory",
        part: "memory-or-custom-field",
        memoryType: memory.type,
        label,
        text,
      });
    }
  }
  if (memory.note !== null && memory.note.trim().length > 0) {
    entries.push({
      source: "memory",
      part: "note-or-body",
      memoryType: memory.type,
      label,
      text: memory.note,
    });
  }
}

/**
 * Read every contact's KNOW-10 corpus. Eligibility is structural and term-free:
 * names, visible non-outdated registry-searchable Memories, visible relationship
 * names, and live non-blank custom values. The visibility contract is shared:
 * hidden/outdated snippets never reach any visible corpus consumer. There is no
 * transaction, no identifier interpolation, and every runtime SQL value (the
 * closed registry type list and every id) is `?`-bound.
 */
export async function listKnowledgeSearchCandidates(
  exec: SqlExecutor,
  options: { readonly eligibleIds: readonly number[] },
): Promise<KnowledgeSearchCandidate[]> {
  const eligibleIds = [...new Set(options.eligibleIds)];
  if (eligibleIds.length === 0) return [];

  const memoryTypes = searchableMemoryTypes();
  const [contacts, relationships, methods, defs, memories] = await Promise.all([
    exec.getAllAsync<ContactRow>(contactsSql(eligibleIds), eligibleIds),
    exec.getAllAsync<RelationshipRow>(relationshipsSql(eligibleIds), eligibleIds),
    exec.getAllAsync<ContactMethodRow>(contactMethodsSql(eligibleIds), [
      ...eligibleIds,
      "phone",
      "email",
    ]),
    listDefs(exec, { includeQuarantined: false }),
    memoryTypes.length === 0
      ? Promise.resolve<MemoryRow[]>([])
      : exec.getAllAsync<MemoryRow>(memorySql(memoryTypes, eligibleIds), [
          ...memoryTypes,
          ...eligibleIds,
        ]),
  ]);
  const definitionIds = defs.map((definition) => definition.id);
  const customValues =
    definitionIds.length === 0
      ? []
      : await exec.getAllAsync<CustomValueRow>(
          customValuesSql(eligibleIds, definitionIds),
          [...eligibleIds, ...definitionIds],
        );

  const memoriesByContact = new Map<number, MemoryRow[]>();
  for (const memory of memories) {
    const rows = memoriesByContact.get(memory.contactId) ?? [];
    rows.push(memory);
    memoriesByContact.set(memory.contactId, rows);
  }
  const relationshipsByContact = new Map<number, RelationshipRow[]>();
  for (const relationship of relationships) {
    const rows = relationshipsByContact.get(relationship.contactId) ?? [];
    rows.push(relationship);
    relationshipsByContact.set(relationship.contactId, rows);
  }
  const methodsByContact = new Map<number, ContactMethodRow[]>();
  for (const method of methods) {
    const rows = methodsByContact.get(method.contactId) ?? [];
    rows.push(method);
    methodsByContact.set(method.contactId, rows);
  }
  const valuesByContact = new Map<number, Record<string, string | null>>();
  for (const value of customValues) {
    const values = valuesByContact.get(value.contactId) ?? {};
    values[value.colName] = value.value;
    valuesByContact.set(value.contactId, values);
  }

  return contacts.map((contact): KnowledgeSearchCandidate => {
      const entries: KnowledgeSearchEntry[] = [
        { source: "name", part: "identity", label: "Name", text: contact.name },
      ];
      if (contact.categoryLabel?.trim()) {
        entries.push({
          source: "category",
          part: "identity",
          label: "Category",
          text: contact.categoryLabel,
        });
      }
      for (const method of methodsByContact.get(contact.contactId) ?? []) {
        entries.push({
          source: method.methodType,
          part: "identity",
          label: method.methodType === "phone" ? "Phone" : "Email",
          text: method.displayValue,
        });
      }

      for (const memory of memoriesByContact.get(contact.contactId) ?? []) {
        if (
          memory.outdated !== 1 &&
          resolveVisibility(memory.type, memory.hidden) === "show"
        ) {
          appendMemoryEntries(entries, memory);
        }
      }
      for (const relationship of relationshipsByContact.get(
        contact.contactId,
      ) ?? []) {
        if (resolveRelationshipVisibility(relationship.hidden) !== "show") {
          continue;
        }
        const label = relationship.relationType?.trim() || "Relationship";
        entries.push({
          source: "relationship",
          part: "relationship",
          relationType: relationship.relationType,
          label,
          text: relationship.personName,
        });
        if (relationship.note?.trim()) {
          entries.push({
            source: "relationship",
            part: "note-or-body",
            relationType: relationship.relationType,
            label,
            text: relationship.note,
          });
        }
      }

      const values = valuesByContact.get(contact.contactId) ?? {};
      for (const definition of defs) {
        const value = values[definition.col_name];
        if (isSearchableCustomFieldValue(definition, value)) {
          entries.push({
            source: "customField",
            fieldKey: definition.col_name,
            part: "memory-or-custom-field",
            label: definition.label,
            text: value,
          });
        }
      }

      return { contactId: contact.contactId, entries };
    });
}
