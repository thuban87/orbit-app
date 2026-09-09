import type { MemoryRow } from "@/db/memories-read";
import type {
  ProfileCollection,
  ProfileCustomFieldValue,
  ProfileKnowledge,
} from "@/db/profile-knowledge-read";
import type { RelationshipRow } from "@/db/relationships-read";
import type { FieldType } from "@/schemas/types";
import type { ProfileModuleId } from "./persisted-contract";

export type KnowledgeChildId = Extract<
  ProfileModuleId,
  | "pinned-featured"
  | "last-talked-about"
  | "key-people"
  | "current-location"
  | "memories"
  | "custom-fields"
  | "off-limits"
  | "imported-contact-notes"
>;

export type KnowledgeOwner =
  | "memory"
  | "relationship"
  | "current-state"
  | "custom-field"
  | "fuel";

export type KnowledgeAction = "edit" | "pin" | "unpin" | "hide" | "restore";

export interface KnowledgeDetailTarget {
  owner: KnowledgeOwner;
  id: number;
  history?: { contactId: number; fieldDefId: number };
}

export interface KnowledgeManagement {
  longPress: readonly KnowledgeAction[];
  accessibility: readonly KnowledgeAction[];
}

export interface KnowledgePresentationItem {
  id: string;
  title: string;
  /** Source label when it differs from the compact card title contract. */
  label?: string;
  preview: string | null;
  metadata: readonly string[];
  detail: KnowledgeDetailTarget;
  management: KnowledgeManagement;
  sparkle: boolean;
  explicitPermission?: boolean;
  invalid?: boolean;
  rawValue?: string | null;
  history?: { contactId: number; fieldDefId: number };
}

export interface KnowledgePresentationGroup {
  name: string | null;
  /** A null group is deliberately direct-under-section, never given an invented label. */
  heading: string | null;
  items: KnowledgePresentationItem[];
}

export interface KnowledgePresentationChild {
  id: KnowledgeChildId;
  title: string;
  summary: string;
  helper?: string;
  items: KnowledgePresentationItem[];
  groups: KnowledgePresentationGroup[];
  viewAllLabel: string | null;
  showHiddenAvailable: boolean;
}

export interface KnowledgePresentationInput {
  contactId: number;
  knowledge: ProfileKnowledge;
}

export interface KnowledgePresentation {
  children: KnowledgePresentationChild[];
}

/**
 * Profile is a presentation consumer only. These stable owner targets ensure
 * cards route edits/history through their authoritative DAO or editor rather
 * than adding a second writer on the Profile surface.
 */
export const KNOWLEDGE_ACTION_OWNERS: Readonly<Record<KnowledgeOwner, string>> =
  Object.freeze({
    memory: "Memory DAO/history",
    relationship: "relationship owner",
    "current-state": "current-state writer",
    "custom-field": "normalized value/history writer",
    fuel: "fuel owner",
  });

const CHILD_ORDER: readonly KnowledgeChildId[] = [
  "pinned-featured",
  "last-talked-about",
  "key-people",
  "current-location",
  "memories",
  "custom-fields",
  "off-limits",
  "imported-contact-notes",
];

function management(actions: readonly KnowledgeAction[]): KnowledgeManagement {
  // Accessibility actions intentionally mirror long press; neither is sole path.
  return { longPress: actions, accessibility: actions };
}

function summary(total: number, remainingCount = 0): string {
  if (total === 0) return "Nothing added yet";
  const shown = total - remainingCount;
  return remainingCount > 0
    ? `${shown} shown · ${remainingCount} more`
    : `${shown} shown`;
}

function viewAllLabel(total: number, noun: string): string | null {
  return total > 3 ? `View all ${total} ${noun}` : null;
}

function unique<T extends { id: number }>(items: readonly T[]): T[] {
  const ids = new Set<number>();
  return items.filter((item) => {
    if (ids.has(item.id)) return false;
    ids.add(item.id);
    return true;
  });
}

function memoryItem(memory: MemoryRow): KnowledgePresentationItem {
  const title =
    memory.custom_label ??
    (memory.type === "imported" ? "Imported note" : "Memory");
  const metadata = [
    memory.meaningful_date,
    memory.url ? "Link" : null,
    memory.pinned === 1 ? "Pinned" : null,
    memory.outdated === 1 ? "Outdated" : null,
  ].filter((value): value is string => value != null && value !== "");
  return {
    id: `memory:${memory.id}`,
    title,
    preview: memory.value ?? memory.note ?? null,
    metadata,
    detail: { owner: "memory", id: memory.id },
    management: management([
      "edit",
      memory.pinned === 1 ? "unpin" : "pin",
      "hide",
    ]),
    sparkle: memory.allow_ai === 1,
  };
}

function relationshipItem(row: RelationshipRow): KnowledgePresentationItem {
  return {
    id: `relationship:${row.id}`,
    title: row.person_name,
    preview: row.note,
    metadata: [row.relation_type, row.linked_contact_name].filter(
      (value): value is string => value != null && value !== "",
    ),
    detail: { owner: "relationship", id: row.id },
    management: management([
      "edit",
      row.pinned === 1 ? "unpin" : "pin",
      "hide",
    ]),
    sparkle: false,
  };
}

function repeatableChild<T extends { id: number }>(input: {
  id: KnowledgeChildId;
  title: string;
  collection: ProfileCollection<T>;
  noun: string;
  item: (value: T) => KnowledgePresentationItem;
}): KnowledgePresentationChild {
  const values = unique(input.collection.items);
  return {
    id: input.id,
    title: input.title,
    summary: summary(input.collection.total, input.collection.remainingCount),
    items: values.map(input.item),
    groups: [],
    viewAllLabel: viewAllLabel(input.collection.total, input.noun),
    showHiddenAvailable: input.collection.showHiddenAvailable,
  };
}

function formatCurrentState(
  id: KnowledgeChildId,
  input: KnowledgePresentationInput,
): KnowledgePresentationChild {
  const entry =
    id === "last-talked-about"
      ? input.knowledge.currentState.last_talked_about
      : input.knowledge.currentState.current_location;
  const title =
    id === "last-talked-about" ? "Last Talked About" : "Current Location";
  return {
    id,
    title,
    summary: entry?.value ?? "Nothing added yet",
    items: entry
      ? [
          {
            id: `current-state:${entry.id}`,
            title,
            preview: entry.value,
            metadata: [],
            detail: { owner: "current-state", id: entry.id },
            management: management(["edit"]),
            sparkle: false,
          },
        ]
      : [],
    groups: [],
    viewAllLabel: null,
    showHiddenAvailable: false,
  };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled field type: ${value}`);
}

/** Format only successful raw-TEXT projections; invalid values render as an error affordance. */
export function formatCustomFieldValue(
  type: FieldType,
  value: string | null,
): string {
  if (value == null || value === "") return "Not available yet";
  switch (type) {
    case "text":
    case "textarea":
    case "dropdown":
    case "date":
    case "number":
    case "url":
    case "email":
    case "phone":
      return value;
    case "toggle":
      return value === "1" ? "Yes" : "No";
    case "photo":
      return "Photo added";
    default:
      return assertNever(type);
  }
}

function customFieldItem(
  field: ProfileCustomFieldValue,
): KnowledgePresentationItem {
  const invalid = !field.parsed.ok;
  const rawValue = field.rawValue;
  return {
    id: `custom-field:${field.fieldDefId}`,
    title: field.label,
    label: field.label,
    preview: invalid
      ? rawValue
      : formatCustomFieldValue(
          field.type,
          field.parsed.ok ? field.parsed.value : null,
        ),
    metadata: invalid ? ["Needs attention"] : [],
    detail: {
      owner: "custom-field",
      id: field.fieldDefId,
      ...(field.historyKey ? { history: field.historyKey } : {}),
    },
    management: management(["edit"]),
    sparkle: false,
    invalid,
    rawValue,
    ...(field.historyKey ? { history: field.historyKey } : {}),
  };
}

function customFieldsChild(
  input: KnowledgePresentationInput,
): KnowledgePresentationChild {
  const groups = input.knowledge.customFields.map((group) => ({
    name: group.name,
    heading: group.name,
    items: group.items.map(customFieldItem),
  }));
  const items = groups.flatMap((group) => group.items);
  return {
    id: "custom-fields",
    title: "Custom Fields",
    summary:
      items.length === 0 ? "Nothing added yet" : `${items.length} fields`,
    items,
    groups,
    viewAllLabel: null,
    showHiddenAvailable: false,
  };
}

function offLimitsChild(
  input: KnowledgePresentationInput,
): KnowledgePresentationChild {
  const items = unique(input.knowledge.offLimits).map((row) => ({
    id: `fuel:${row.id}`,
    title: row.label ?? "Off Limits",
    preview: row.text,
    metadata: row.url ? ["Link"] : [],
    detail: { owner: "fuel" as const, id: row.id },
    management: management(["edit"]),
    // D-12: an ordinary fuel row has no durable permission and must never imply one.
    sparkle: false,
    explicitPermission: undefined,
  }));
  return {
    id: "off-limits",
    title: "Off Limits",
    summary: items.length === 0 ? "Nothing added yet" : `${items.length} saved`,
    helper: "Avoid bringing these up",
    items,
    groups: [],
    viewAllLabel: viewAllLabel(items.length, "off-limit items"),
    showHiddenAvailable: false,
  };
}

/** Build one compact, source-typed presentation model for the fixed TTR order. */
export function buildKnowledgePresentation(
  input: KnowledgePresentationInput,
): KnowledgePresentation {
  const byId: Record<KnowledgeChildId, KnowledgePresentationChild> = {
    "pinned-featured": repeatableChild({
      id: "pinned-featured",
      title: "Pinned / Featured",
      collection: input.knowledge.featured,
      noun: "featured items",
      item: (reference) =>
        reference.owner === "memory"
          ? memoryItem(reference.row)
          : relationshipItem(reference.row),
    }),
    "last-talked-about": formatCurrentState("last-talked-about", input),
    "key-people": repeatableChild({
      id: "key-people",
      title: "Key People",
      collection: input.knowledge.relationships,
      noun: "people",
      item: relationshipItem,
    }),
    "current-location": formatCurrentState("current-location", input),
    memories: repeatableChild({
      id: "memories",
      title: "Memories",
      collection: input.knowledge.memories,
      noun: "memories",
      item: memoryItem,
    }),
    "custom-fields": customFieldsChild(input),
    "off-limits": offLimitsChild(input),
    "imported-contact-notes": repeatableChild({
      id: "imported-contact-notes",
      title: "Imported from Contacts App",
      collection: input.knowledge.importedNotes,
      noun: "imported notes",
      item: memoryItem,
    }),
  };
  return { children: CHILD_ORDER.map((id) => byId[id]) };
}
