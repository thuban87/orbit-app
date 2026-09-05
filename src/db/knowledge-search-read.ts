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
import { getValuesForContact } from "@/db/field-values-dao";
import {
  MEMORY_TYPE_REGISTRY,
  type MemoryTypeKey,
} from "@/db/memory-registry";
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
}

interface RelationshipRow {
  contactId: number;
  personName: string;
  relationType: string | null;
  note: string | null;
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
       , relation_type AS relationType, note
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
       note
  FROM memories
 WHERE deleted_at IS NULL
   AND type IN (${types.map(() => "?").join(", ")})
   AND contact_id IN (${placeholders(eligibleIds)})
 ORDER BY contact_id, id`;
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
 * names, live registry-searchable Memories, live relationship names, and live
 * non-blank custom values. There is no transaction, no identifier interpolation,
 * and every runtime SQL value (the closed registry type list) is `?`-bound.
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

  return Promise.all(
    contacts.map(async (contact): Promise<KnowledgeSearchCandidate> => {
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
        appendMemoryEntries(entries, memory);
      }
      for (const relationship of relationshipsByContact.get(
        contact.contactId,
      ) ?? []) {
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

      const values = await getValuesForContact(exec, contact.contactId, defs);
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
    }),
  );
}
