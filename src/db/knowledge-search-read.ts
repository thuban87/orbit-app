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
import { MEMORY_TYPE_REGISTRY } from "@/db/memory-registry";
import type { SqlExecutor } from "@/db/types";

export type KnowledgeSearchSource =
  | "name"
  | "memory"
  | "relationship"
  | "customField";

export interface KnowledgeSearchEntry {
  readonly source: KnowledgeSearchSource;
  readonly text: string;
  /** Stable custom-field key, present only for `source: "customField"`. */
  readonly fieldKey?: string;
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
}

interface MemoryRow {
  contactId: number;
  customLabel: string | null;
  value: string | null;
  note: string | null;
}

interface RelationshipRow {
  contactId: number;
  personName: string;
}

const LIST_CONTACTS = `
SELECT id AS contactId, name
  FROM contacts
 ORDER BY id`;

const LIST_LIVE_RELATIONSHIPS = `
SELECT contact_id AS contactId, person_name AS personName
  FROM relationships
 WHERE deleted_at IS NULL
 ORDER BY contact_id, id`;

function searchableMemoryTypes(): string[] {
  return Object.entries(MEMORY_TYPE_REGISTRY)
    .filter(([, metadata]) => metadata.searchable)
    .map(([type]) => type);
}

function memorySql(types: readonly string[]): string {
  return `
SELECT contact_id AS contactId,
       custom_label AS customLabel,
       value,
       note
  FROM memories
 WHERE deleted_at IS NULL
   AND type IN (${types.map(() => "?").join(", ")})
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
  for (const text of [memory.customLabel, memory.value, memory.note]) {
    if (text !== null) entries.push({ source: "memory", text });
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
): Promise<KnowledgeSearchCandidate[]> {
  const memoryTypes = searchableMemoryTypes();
  const [contacts, relationships, defs, memories] = await Promise.all([
    exec.getAllAsync<ContactRow>(LIST_CONTACTS),
    exec.getAllAsync<RelationshipRow>(LIST_LIVE_RELATIONSHIPS),
    listDefs(exec, { includeQuarantined: false }),
    memoryTypes.length === 0
      ? Promise.resolve<MemoryRow[]>([])
      : exec.getAllAsync<MemoryRow>(memorySql(memoryTypes), memoryTypes),
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

  return Promise.all(
    contacts.map(async (contact): Promise<KnowledgeSearchCandidate> => {
      const entries: KnowledgeSearchEntry[] = [
        { source: "name", text: contact.name },
      ];

      for (const memory of memoriesByContact.get(contact.contactId) ?? []) {
        appendMemoryEntries(entries, memory);
      }
      for (const relationship of relationshipsByContact.get(
        contact.contactId,
      ) ?? []) {
        entries.push({ source: "relationship", text: relationship.personName });
      }

      const values = await getValuesForContact(exec, contact.contactId, defs);
      for (const definition of defs) {
        const value = values[definition.col_name];
        if (isSearchableCustomFieldValue(definition, value)) {
          entries.push({
            source: "customField",
            fieldKey: definition.col_name,
            text: value,
          });
        }
      }

      return { contactId: contact.contactId, entries };
    }),
  );
}
