/**
 * Application-owned Memory metadata (KNOW-02).
 *
 * The type set is deliberately an in-code constant: a user can label a `custom`
 * Memory item, but cannot mint a new system type (ADR-028). Search and AI
 * metadata are declarative in 24.1; their consumers arrive in Phase 24.2.
 */

/** The durable noun while the owner confirms the final display terminology. */
export const PROVISIONAL_MEMORY_LABEL = "Memory";
/** Human-needed: the final general-type name is intentionally still provisional. */
export const PROVISIONAL_DEFAULT_MEMORY_TYPE_NAME = "General";

export type MemoryTypeKey = "general" | "custom";
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
}

export const MEMORY_TYPE_REGISTRY: Record<MemoryTypeKey, MemoryTypeMeta> = {
  general: {
    displayName: PROVISIONAL_DEFAULT_MEMORY_TYPE_NAME,
    iconSemantic: "memory",
    cardinality: "many",
    historyAware: false,
    searchable: true,
    aiDefault: false,
    visibilityDefault: "show",
    presentationOrder: 20,
  },
  custom: {
    displayName: PROVISIONAL_MEMORY_LABEL,
    iconSemantic: "custom_memory",
    cardinality: "many",
    historyAware: false,
    searchable: true,
    aiDefault: false,
    visibilityDefault: "show",
    presentationOrder: 30,
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

/** The presentation order starts with featured/current information. */
export const KNOWLEDGE_GROUP_ORDER = [
  "current_state",
  "relationships",
  "memories",
] as const;

/** Provisional group name; its visibility default is part of the durable contract. */
export const RELATIONSHIPS_GROUP = {
  displayName: "Key people",
  visibilityDefault: "show",
  presentationOrder: 10,
} as const;
