/**
 * Application-owned Memory metadata (KNOW-02).
 *
 * The type set is deliberately an in-code constant: a user can label any
 * Memory item, but cannot mint a new system type (ADR-028). Search and AI
 * metadata are declarative in 24.1; their consumers arrive in Phase 24.2.
 *
 * Phase 38.10: the `custom` type is removed and every memory takes an optional
 * label (D-86); Gift Ideas and Thought of Them are app-defined types, each its
 * own Things to Remember section (D-34, D-36, D-43, D-91); `imported` is not
 * user-pickable (D-35).
 */

/**
 * D-134 (owner, 2026-10-13): Hide from Profile is hidden everywhere in the UI
 * and the stored `hidden` flag is ignored for display until the feature
 * returns; flip to true to bring it back (D-71 is the deferred keep-or-drop
 * decision). The flag itself stays in the schema and every writer keeps it.
 */
export const HIDE_FROM_PROFILE_ENABLED = false;

/**
 * The durable noun for a Memory item, used as the fallback label wherever a
 * specific type/custom label is absent. The owner confirmed "Memory" as the
 * final terminology (D-11, 2026-09-12); the constant name is retained because it
 * is the fallback-noun source consumed across the Memory UI.
 */
export const PROVISIONAL_MEMORY_LABEL = "Memory";

export type MemoryTypeKey =
  | "general"
  | "imported"
  | "gift_idea"
  | "thought_of_them";
export const DEFAULT_MEMORY_TYPE_KEY: MemoryTypeKey = "general";

export interface MemoryTypeMeta {
  displayName: string;
  iconSemantic: string;
  cardinality: "single" | "many";
  historyAware: boolean;
  searchable: boolean;
  aiDefault: boolean;
  visibilityDefault: "show" | "hide";
  presentationOrder: number;
  /** Whether the user may choose this type in a picker (D-35). */
  userPickable: boolean;
}

export const MEMORY_TYPE_REGISTRY: Record<MemoryTypeKey, MemoryTypeMeta> = {
  general: {
    // D-11 (owner-resolved 2026-09-12): the default/general type displays as "Memory".
    displayName: "Memory",
    iconSemantic: "memory",
    cardinality: "many",
    historyAware: false,
    searchable: true,
    aiDefault: false,
    visibilityDefault: "show",
    presentationOrder: 20,
    userPickable: true,
  },
  gift_idea: {
    // D-34, D-43, D-91: its own section; searchable, AI-default off (D-92).
    displayName: "Gift Ideas",
    iconSemantic: "memory",
    cardinality: "many",
    historyAware: false,
    searchable: true,
    aiDefault: false,
    visibilityDefault: "show",
    presentationOrder: 22,
    userPickable: true,
  },
  thought_of_them: {
    // D-43: the share section; searchable, AI-default off (D-91, D-92).
    displayName: "Thought of Them",
    iconSemantic: "memory",
    cardinality: "many",
    historyAware: false,
    searchable: true,
    aiDefault: false,
    visibilityDefault: "show",
    presentationOrder: 23,
    userPickable: true,
  },
  imported: {
    displayName: "Imported from Contacts App",
    iconSemantic: "memory",
    cardinality: "many",
    historyAware: false,
    searchable: true,
    aiDefault: false,
    visibilityDefault: "show",
    presentationOrder: 25,
    // D-35: only the Contacts import writes this type.
    userPickable: false,
  },
};

export function isMemoryTypeKey(value: string): value is MemoryTypeKey {
  return Object.hasOwn(MEMORY_TYPE_REGISTRY, value);
}

export type CurrentStateFieldKey = "last_talked_about" | "current_location";

export const CURRENT_STATE_FIELD_KEYS: readonly CurrentStateFieldKey[] = [
  "last_talked_about",
  "current_location",
];

export interface CurrentStateFieldMeta {
  displayName: string;
  iconSemantic: string;
  presentationOrder: number;
}

export const CURRENT_STATE_FIELD_REGISTRY: Record<
  CurrentStateFieldKey,
  CurrentStateFieldMeta
> = {
  last_talked_about: {
    displayName: "Last talked about",
    iconSemantic: "conversation",
    presentationOrder: 0,
  },
  current_location: {
    displayName: "Current location",
    iconSemantic: "location",
    presentationOrder: 1,
  },
};

export function isCurrentStateFieldKey(
  value: string,
): value is CurrentStateFieldKey {
  return CURRENT_STATE_FIELD_KEYS.includes(value as CurrentStateFieldKey);
}

/** Provisional group name; its visibility default is part of the durable contract. */
export const RELATIONSHIPS_GROUP = {
  displayName: "Key People",
  visibilityDefault: "show",
  presentationOrder: 10,
} as const;
