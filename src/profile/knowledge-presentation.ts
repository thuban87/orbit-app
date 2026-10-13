import {
  ADD_GIFT_IDEA,
  ADD_MEMORY,
  ADD_OFF_LIMITS_ITEM,
  ADD_THOUGHT_OF_THEM,
} from "@/constants/glossary";
import { PHOTO_UNAVAILABLE_LABEL } from "@/constants/photo-copy";
import { parsers } from "@/db/field-parsers";
import type { MemoryRow } from "@/db/memories-read";
import {
  MEMORY_TYPE_REGISTRY,
  PROVISIONAL_MEMORY_LABEL,
} from "@/db/memory-registry";
import { isStoredPhotoPath } from "@/db/photo-relative-path";
import type {
  ProfileCollection,
  ProfileCurrentStateEntry,
  ProfileCustomFieldValue,
  ProfileKnowledge,
} from "@/db/profile-knowledge-read";
import type { RelationshipRow } from "@/db/relationships-read";
import type { FieldType } from "@/schemas/types";
import { formatDisplayDateOrFallback } from "@/utils/dates";
import { plural } from "@/utils/plural";
import { PROFILE_MODULE_REGISTRY } from "./module-registry";
import type { ProfileModuleId } from "./persisted-contract";

export type KnowledgeChildId = Extract<
  ProfileModuleId,
  | "pinned-featured"
  | "last-talked-about"
  | "key-people"
  | "current-location"
  | "memories"
  | "thought-of-them"
  | "gift-ideas"
  | "custom-fields"
  | "off-limits"
  | "imported-contact-notes"
>;

export type KnowledgeOwner =
  | "memory"
  | "relationship"
  | "current-state"
  | "custom-field"
  | "offLimits";

/** An entry's actions: Edit, and Pin / Unpin where its table has a pin (D-22, D-70). */
export type KnowledgeAction = "edit" | "pin" | "unpin";

/** The interaction a linked entry opens on tap (D-37, D-48, D-107). */
export interface KnowledgeEntryLink {
  interactionId: number;
  linkSource: "note" | "group_note";
}

export interface KnowledgeDetailTarget {
  owner: KnowledgeOwner;
  id: number;
  history?: { contactId: number; fieldDefId: number };
  /** Absent for an unlinked entry (D-37, D-48). */
  link?: KnowledgeEntryLink;
  /** A stored link, shown with Open in the entry's sheet (D-24). */
  url?: string;
}

/** The one heading action a section with entries shows (D-72). */
export type KnowledgeHeadingAction = "add" | "edit" | "none";

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
  /** Only temporal current-state rows participate in the Profile hierarchy. */
  temporalPosition?: "most-recent" | "previous";
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
  /** Content state belongs in the rendered section body, never its heading. */
  bodySummary: string;
  helper?: string;
  items: KnowledgePresentationItem[];
  groups: KnowledgePresentationGroup[];
  viewAllLabel: string | null;
  showHiddenAvailable: boolean;
  /** Always `headingActionFor(id)` (D-72). */
  headingAction: KnowledgeHeadingAction;
  /**
   * The empty section's "Add …" label (D-68); null when the section has
   * entries, and always null for Imported (no add form, D-35) and Pinned (no
   * action, D-72, D-112).
   */
  emptyAction: string | null;
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
    offLimits: "Off Limits owner",
  });

/** D-44 order. */
const CHILD_ORDER: readonly KnowledgeChildId[] = [
  "pinned-featured",
  "last-talked-about",
  "key-people",
  "current-location",
  "memories",
  "thought-of-them",
  "gift-ideas",
  "custom-fields",
  "off-limits",
  "imported-contact-notes",
];

/**
 * The heading action of a section once it has entries (D-72): Add for Last
 * Talked About, Thought of Them, Gift Ideas and Memories; a pencil for
 * Current Location, Key People, Off Limits, Custom Fields and Imported; none
 * for Pinned. The presentation and `ProfileModuleHost` both read this one
 * table, so they cannot disagree.
 */
export function headingActionFor(id: KnowledgeChildId): KnowledgeHeadingAction {
  switch (id) {
    case "last-talked-about":
    case "thought-of-them":
    case "gift-ideas":
    case "memories":
      return "add";
    case "current-location":
    case "key-people":
    case "off-limits":
    case "custom-fields":
    case "imported-contact-notes":
      return "edit";
    case "pinned-featured":
      return "none";
  }
}

/**
 * The placeholder target a section-level intent (heading action, empty
 * "Add …") carries: the section's owner with id 0. The destination is chosen
 * per section id by the screen.
 */
export function knowledgeChildTarget(
  id: KnowledgeChildId,
): KnowledgeDetailTarget {
  switch (id) {
    case "last-talked-about":
    case "current-location":
      return { owner: "current-state", id: 0 };
    case "key-people":
      return { owner: "relationship", id: 0 };
    case "custom-fields":
      return { owner: "custom-field", id: 0 };
    case "off-limits":
      return { owner: "offLimits", id: 0 };
    case "pinned-featured":
    case "memories":
    case "thought-of-them":
    case "gift-ideas":
    case "imported-contact-notes":
      return { owner: "memory", id: 0 };
  }
}

/**
 * Whether a section has at least one entry to show (D-72). The empty line and
 * "Add …" and the heading action all follow this one rule, so an empty
 * section never shows both.
 */
export function childHasEntries(
  id: KnowledgeChildId,
  knowledge: ProfileKnowledge,
): boolean {
  switch (id) {
    case "pinned-featured":
      return knowledge.featured.total > 0;
    case "last-talked-about":
      return knowledge.currentState.last_talked_about != null;
    case "current-location":
      return knowledge.currentState.current_location != null;
    case "key-people":
      return knowledge.relationships.total > 0;
    case "memories":
      return knowledge.memories.total > 0;
    case "thought-of-them":
      return knowledge.thoughtOfThem.total > 0;
    case "gift-ideas":
      return knowledge.giftIdeas.total > 0;
    case "custom-fields":
      return knowledge.customFields.some((group) => group.items.length > 0);
    case "off-limits":
      return knowledge.offLimits.length > 0;
    case "imported-contact-notes":
      return knowledge.importedNotes.total > 0;
  }
}

/**
 * The empty section's "Add …" label (D-68). Imported has no add form (D-35)
 * and Pinned no action (D-72, D-112). The four memory-type and Off Limits
 * labels are the glossary's; the other three are proposals for the plan-19
 * wording review.
 */
function emptyActionLabel(id: KnowledgeChildId): string | null {
  switch (id) {
    case "last-talked-about":
      return "Add Last Talked About";
    case "current-location":
      return "Add Current Location";
    case "key-people":
      return "Add Key Person";
    case "memories":
      return ADD_MEMORY;
    case "thought-of-them":
      return ADD_THOUGHT_OF_THEM;
    case "gift-ideas":
      return ADD_GIFT_IDEA;
    case "custom-fields":
      return "Add Custom Field";
    case "off-limits":
      return ADD_OFF_LIMITS_ITEM;
    case "imported-contact-notes":
    case "pinned-featured":
      return null;
  }
}

/** The empty line of a section with no entries (D-68). */
const EMPTY_LINE = "Nothing added yet";

/** Section titles come from the one registry (D-89 G-23, D-91). */
function childTitle(id: KnowledgeChildId): string {
  return PROFILE_MODULE_REGISTRY[id].label;
}

function management(actions: readonly KnowledgeAction[]): KnowledgeManagement {
  // Accessibility actions intentionally mirror long press; neither is sole path.
  return { longPress: actions, accessibility: actions };
}

/** Every count reads "N items" (D-89, audit D-34). */
function countLine(total: number): string {
  return total === 0 ? EMPTY_LINE : plural(total, "item");
}

function viewAllLabel(total: number, noun: string): string | null {
  return total > 3 ? `View all ${total} ${noun}` : null;
}

function unique<T extends { id: number }>(
  items: readonly T[],
  key: (item: T) => string | number = (item) => item.id,
): T[] {
  const seen = new Set<string | number>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

/** The entry's interaction link, absent when it is unlinked (D-37, D-48). */
function entryLink(row: {
  interaction_id?: number | null;
  link_source?: string | null;
}): KnowledgeEntryLink | undefined {
  if (row.interaction_id == null) return undefined;
  return {
    interactionId: row.interaction_id,
    linkSource: row.link_source === "group_note" ? "group_note" : "note",
  };
}

/** Optional detail fields: the stored URL (D-24) and the link (D-37). */
function detailExtras(row: {
  url?: string | null;
  interaction_id?: number | null;
  link_source?: string | null;
}): Pick<KnowledgeDetailTarget, "link" | "url"> {
  const link = entryLink(row);
  return {
    ...(row.url ? { url: row.url } : {}),
    ...(link ? { link } : {}),
  };
}

function memoryItem(memory: MemoryRow): KnowledgePresentationItem {
  // D-86: the label wins; otherwise the type's registry name (D-91).
  const title =
    memory.custom_label ??
    MEMORY_TYPE_REGISTRY[memory.type as keyof typeof MEMORY_TYPE_REGISTRY]
      ?.displayName ??
    PROVISIONAL_MEMORY_LABEL;
  const metadata = [
    // D-48 display, raw when not a date (38.9 D-65); storage unchanged.
    memory.meaningful_date
      ? formatDisplayDateOrFallback(
          memory.meaningful_date,
          memory.meaningful_date,
        )
      : null,
    memory.url ? "Link" : null,
    memory.pinned === 1 ? "Pinned" : null,
    memory.outdated === 1 ? "Outdated" : null,
  ].filter((value): value is string => value != null && value !== "");
  return {
    id: `memory:${memory.id}`,
    title,
    preview: memory.value ?? memory.note ?? null,
    metadata,
    detail: { owner: "memory", id: memory.id, ...detailExtras(memory) },
    management: management(["edit", memory.pinned === 1 ? "unpin" : "pin"]),
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
    management: management(["edit", row.pinned === 1 ? "unpin" : "pin"]),
    sparkle: false,
  };
}

function childChrome(
  id: KnowledgeChildId,
  knowledge: ProfileKnowledge,
): Pick<KnowledgePresentationChild, "headingAction" | "emptyAction"> {
  return {
    headingAction: headingActionFor(id),
    emptyAction: childHasEntries(id, knowledge) ? null : emptyActionLabel(id),
  };
}

function repeatableChild<T extends { id: number }>(input: {
  id: KnowledgeChildId;
  knowledge: ProfileKnowledge;
  collection: ProfileCollection<T>;
  /** Null for no View all (Pinned, D-112). */
  noun: string | null;
  item: (value: T) => KnowledgePresentationItem;
  key?: (value: T) => string | number;
}): KnowledgePresentationChild {
  const values = unique(input.collection.items, input.key);
  const hasEntries = childHasEntries(input.id, input.knowledge);
  return {
    id: input.id,
    title: childTitle(input.id),
    bodySummary: hasEntries ? countLine(input.collection.total) : EMPTY_LINE,
    items: values.map(input.item),
    groups: [],
    viewAllLabel:
      input.noun === null
        ? null
        : viewAllLabel(input.collection.total, input.noun),
    showHiddenAvailable: input.collection.showHiddenAvailable,
    ...childChrome(input.id, input.knowledge),
  };
}

/**
 * Most Recent and Previous show the date the entry is about, never the
 * capture time (D-41, D-48): `entry_date`, else `created_at`'s date part.
 */
function currentStateItem(
  entry: ProfileCurrentStateEntry,
  position: "most-recent" | "previous",
): KnowledgePresentationItem {
  const when = entry.entry_date ?? entry.created_at;
  return {
    id: `current-state:${entry.id}`,
    title: position === "most-recent" ? "Most Recent" : "Previous",
    preview: entry.value,
    metadata: [
      formatDisplayDateOrFallback(when, when),
      ...(entry.url ? ["Link"] : []),
    ],
    detail: {
      owner: "current-state",
      id: entry.id,
      ...detailExtras(entry),
    },
    management: management(["edit"]),
    sparkle: false,
    temporalPosition: position,
  };
}

function formatCurrentState(
  id: "last-talked-about" | "current-location",
  input: KnowledgePresentationInput,
): KnowledgePresentationChild {
  const entry =
    id === "last-talked-about"
      ? input.knowledge.currentState.last_talked_about
      : input.knowledge.currentState.current_location;
  const previousItems = (entry?.previous ?? [])
    .slice(0, 5)
    .map((previous) => currentStateItem(previous, "previous"));
  return {
    id,
    title: childTitle(id),
    bodySummary: entry ? "" : EMPTY_LINE,
    items: entry
      ? [currentStateItem(entry, "most-recent"), ...previousItems]
      : [],
    groups: [],
    // "See all (N)" under Previous whenever the section has entries (D-52,
    // D-53); it opens the full history page.
    viewAllLabel: entry
      ? `See all (${entry.total ?? 1 + entry.previous.length})`
      : null,
    showHiddenAvailable: false,
    ...childChrome(id, input.knowledge),
  };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled field type: ${value}`);
}

/**
 * Display text for a stored custom-field value (38.9 D-23, D-66; reviews
 * C9-M1, C10-L1). A Date value goes through the one date parser
 * (`parsers.date`, the same parse the Profile applies at read time) and then
 * the D-48 display formatter, so " 2026-10-20" and "2026-10-20 trip" read
 * "Oct 20" everywhere. A value the parser rejects, or an impossible date such
 * as "2026-02-31", stays raw so invalid data stays visible as stored. Every
 * other type is returned unchanged. Display only: it never writes and adds no
 * converter (ADR-001, CLAUDE.md custom-field invariants).
 */
export function customValueDisplayText(type: FieldType, value: string): string {
  if (type !== "date") return value;
  const parsed = parsers.date(value);
  if (!parsed.ok || parsed.value == null) return value;
  return formatDisplayDateOrFallback(parsed.value, value);
}

/** Format only successful raw-TEXT projections; invalid values render as an error affordance. */
export function formatCustomFieldValue(
  type: FieldType,
  value: string | null,
): string {
  // An empty always-show field reads "Not set" (D-87).
  if (value == null || value === "") return "Not set";
  switch (type) {
    case "date":
      return customValueDisplayText(type, value);
    case "text":
    case "textarea":
    case "dropdown":
    case "number":
    case "url":
    case "email":
    case "phone":
      return value;
    case "toggle":
      return value === "1" ? "Yes" : "No";
    case "photo":
      // 38.6 D-34: text left in a photo field (e.g. after a Text→Photo type
      // change) is not a photo; it says so, like a lost photo. The text itself
      // is kept in the data and backups (D-31) — this is display only.
      return isStoredPhotoPath(value) ? "Photo added" : PHOTO_UNAVAILABLE_LABEL;
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
    title: childTitle("custom-fields"),
    bodySummary: countLine(items.length),
    items,
    groups,
    viewAllLabel: null,
    showHiddenAvailable: false,
    ...childChrome("custom-fields", input.knowledge),
  };
}

function offLimitsChild(
  input: KnowledgePresentationInput,
): KnowledgePresentationChild {
  // Fully visible, never collapsed, no sparkle (D-10).
  const items = unique(input.knowledge.offLimits).map(
    (row): KnowledgePresentationItem => ({
      id: `off-limits:${row.id}`,
      title: row.label ?? "Off Limits",
      preview: row.text,
      metadata: row.url ? ["Link"] : [],
      detail: { owner: "offLimits", id: row.id, ...detailExtras(row) },
      management: management(["edit"]),
      // D-12: an ordinary Off Limits row has no durable permission and must never imply one.
      sparkle: false,
      explicitPermission: undefined,
    }),
  );
  return {
    id: "off-limits",
    title: childTitle("off-limits"),
    bodySummary: countLine(items.length),
    // D-105: this helper stays.
    helper: "Avoid bringing these up",
    items,
    groups: [],
    viewAllLabel: viewAllLabel(items.length, "off-limit items"),
    showHiddenAvailable: false,
    ...childChrome("off-limits", input.knowledge),
  };
}

/** Build one compact, source-typed presentation model in the D-44 order. */
export function buildKnowledgePresentation(
  input: KnowledgePresentationInput,
): KnowledgePresentation {
  const knowledge = input.knowledge;
  const byId: Record<KnowledgeChildId, KnowledgePresentationChild> = {
    "pinned-featured": repeatableChild({
      id: "pinned-featured",
      knowledge,
      collection: knowledge.featured,
      // Every pinned item shows, with no View all (D-112).
      noun: null,
      item: (reference) =>
        reference.owner === "memory"
          ? memoryItem(reference.row)
          : relationshipItem(reference.row),
      // Memory and key-person ids are independent keys (convergence c1 F-U6).
      key: (reference) => `${reference.owner}:${reference.id}`,
    }),
    "last-talked-about": formatCurrentState("last-talked-about", input),
    "key-people": repeatableChild({
      id: "key-people",
      knowledge,
      collection: knowledge.relationships,
      noun: "people",
      item: relationshipItem,
    }),
    "current-location": formatCurrentState("current-location", input),
    memories: repeatableChild({
      id: "memories",
      knowledge,
      collection: knowledge.memories,
      noun: "memories",
      item: memoryItem,
    }),
    "thought-of-them": repeatableChild({
      id: "thought-of-them",
      knowledge,
      collection: knowledge.thoughtOfThem,
      noun: "Thought of Them entries",
      item: memoryItem,
    }),
    "gift-ideas": repeatableChild({
      id: "gift-ideas",
      knowledge,
      collection: knowledge.giftIdeas,
      noun: "gift ideas",
      item: memoryItem,
    }),
    "custom-fields": customFieldsChild(input),
    "off-limits": offLimitsChild(input),
    "imported-contact-notes": repeatableChild({
      id: "imported-contact-notes",
      knowledge,
      collection: knowledge.importedNotes,
      noun: "imported notes",
      item: memoryItem,
    }),
  };
  return { children: CHILD_ORDER.map((id) => byId[id]) };
}
