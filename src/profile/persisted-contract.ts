/**
 * Minimum durable vocabulary for Profile presentation documents.
 *
 * This module is intentionally Node-pure and precedes the forward-only Profile
 * presentation migration. Persisted values use semantic IDs, never component
 * names, so renderer replacement does not require rewriting user data.
 */

export const PROFILE_LAYOUT_DOCUMENT_VERSION = 1 as const;

export const PROFILE_TOP_LEVEL_MODULE_IDS = [
  "relationship-overview",
  "things-to-remember",
  "contact-methods",
  "interaction-history",
] as const;

export const PROFILE_OVERVIEW_MODULE_IDS = [
  "orbit-status",
  "gravity",
  "intensity",
  "last-interaction",
  "contact-frequency",
  "snooze",
] as const;

export const PROFILE_THINGS_TO_REMEMBER_MODULE_IDS = [
  "pinned-featured",
  "last-talked-about",
  "key-people",
  "current-location",
  "memories",
  "custom-fields",
  "off-limits",
  "imported-contact-notes",
] as const;

export const PROFILE_MODULE_IDS = [
  ...PROFILE_TOP_LEVEL_MODULE_IDS,
  ...PROFILE_OVERVIEW_MODULE_IDS,
  ...PROFILE_THINGS_TO_REMEMBER_MODULE_IDS,
] as const;

export type ProfileTopLevelModuleId =
  (typeof PROFILE_TOP_LEVEL_MODULE_IDS)[number];
export type ProfileOverviewModuleId =
  (typeof PROFILE_OVERVIEW_MODULE_IDS)[number];
export type ProfileThingsToRememberModuleId =
  (typeof PROFILE_THINGS_TO_REMEMBER_MODULE_IDS)[number];
export type ProfileModuleId = (typeof PROFILE_MODULE_IDS)[number];
export type ProfileModuleParentId =
  | "profile"
  | "relationship-overview"
  | "things-to-remember";

export const PROFILE_MODULE_PARENT: Readonly<
  Record<ProfileModuleId, ProfileModuleParentId>
> = Object.freeze({
  "relationship-overview": "profile",
  "things-to-remember": "profile",
  "contact-methods": "profile",
  "interaction-history": "profile",
  "orbit-status": "relationship-overview",
  gravity: "relationship-overview",
  intensity: "relationship-overview",
  "last-interaction": "relationship-overview",
  "contact-frequency": "relationship-overview",
  snooze: "relationship-overview",
  "pinned-featured": "things-to-remember",
  "last-talked-about": "things-to-remember",
  "key-people": "things-to-remember",
  "current-location": "things-to-remember",
  memories: "things-to-remember",
  "custom-fields": "things-to-remember",
  "off-limits": "things-to-remember",
  "imported-contact-notes": "things-to-remember",
});

export type ProfileCollapsibleModuleId =
  | ProfileTopLevelModuleId
  | ProfileThingsToRememberModuleId;

export interface PersistedProfileModulePlacement<
  Id extends ProfileModuleId = ProfileModuleId,
> {
  id: Id;
  visible: boolean;
  expanded: boolean;
}

export interface PersistedProfileLayoutDocument {
  version: typeof PROFILE_LAYOUT_DOCUMENT_VERSION;
  topLevel: PersistedProfileModulePlacement<ProfileTopLevelModuleId>[];
  overview: PersistedProfileModulePlacement<ProfileOverviewModuleId>[];
  thingsToRemember: PersistedProfileModulePlacement<ProfileThingsToRememberModuleId>[];
}

export type ProfileCollapseMap = Partial<
  Record<ProfileCollapsibleModuleId, boolean>
>;

const MODULE_ID_SET = new Set<string>(PROFILE_MODULE_IDS);
const COLLAPSIBLE_ID_SET = new Set<string>([
  ...PROFILE_TOP_LEVEL_MODULE_IDS,
  ...PROFILE_THINGS_TO_REMEMBER_MODULE_IDS,
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function decodeJsonObject(
  value: unknown,
  label: string,
): Record<string, unknown> {
  let decoded = value;
  if (typeof value === "string") {
    try {
      decoded = JSON.parse(value);
    } catch {
      throw new Error(`${label} must be valid JSON`);
    }
  }
  if (!isRecord(decoded)) throw new Error(`${label} must be an object`);
  return decoded;
}

function parsePlacementBucket<Id extends ProfileModuleId>(
  value: unknown,
  parent: ProfileModuleParentId,
  seen: Set<ProfileModuleId>,
): PersistedProfileModulePlacement<Id>[] {
  if (!Array.isArray(value))
    throw new Error(`${parent} modules must be an array`);

  return value.map((candidate, index) => {
    if (!isRecord(candidate)) {
      throw new Error(`${parent} module at index ${index} must be an object`);
    }
    const { id, visible, expanded } = candidate;
    if (typeof id !== "string" || !MODULE_ID_SET.has(id)) {
      throw new Error(`unknown Profile module ID: ${String(id)}`);
    }
    const moduleId = id as ProfileModuleId;
    if (PROFILE_MODULE_PARENT[moduleId] !== parent) {
      throw new Error(`illegal parent for Profile module ${moduleId}`);
    }
    if (seen.has(moduleId)) {
      throw new Error(`duplicate Profile module ID: ${moduleId}`);
    }
    if (typeof visible !== "boolean" || typeof expanded !== "boolean") {
      throw new Error(`Profile module ${moduleId} flags must be boolean`);
    }
    seen.add(moduleId);
    return { id: moduleId as Id, visible, expanded };
  });
}

export function parseProfileLayoutDocument(
  value: unknown,
): PersistedProfileLayoutDocument {
  const input = decodeJsonObject(value, "Profile layout document");
  if (input.version !== PROFILE_LAYOUT_DOCUMENT_VERSION) {
    throw new Error(
      `invalid Profile layout document version: ${String(input.version)}`,
    );
  }

  const seen = new Set<ProfileModuleId>();
  return {
    version: PROFILE_LAYOUT_DOCUMENT_VERSION,
    topLevel: parsePlacementBucket<ProfileTopLevelModuleId>(
      input.topLevel,
      "profile",
      seen,
    ),
    overview: parsePlacementBucket<ProfileOverviewModuleId>(
      input.overview,
      "relationship-overview",
      seen,
    ),
    thingsToRemember: parsePlacementBucket<ProfileThingsToRememberModuleId>(
      input.thingsToRemember,
      "things-to-remember",
      seen,
    ),
  };
}

export function serializeProfileLayoutDocument(value: unknown): string {
  return JSON.stringify(parseProfileLayoutDocument(value));
}

export function parseProfileCollapseMap(value: unknown): ProfileCollapseMap {
  const input = decodeJsonObject(value, "Profile collapse map");

  for (const [id, expanded] of Object.entries(input)) {
    if (!MODULE_ID_SET.has(id)) {
      throw new Error(`unknown Profile module ID: ${id}`);
    }
    if (!COLLAPSIBLE_ID_SET.has(id)) {
      throw new Error(`Profile module ${id} is not collapsible`);
    }
    if (typeof expanded !== "boolean") {
      throw new Error(`Profile collapse entry ${id} must be boolean`);
    }
  }

  const canonical: ProfileCollapseMap = {};
  for (const id of PROFILE_MODULE_IDS) {
    if (!COLLAPSIBLE_ID_SET.has(id) || !Object.hasOwn(input, id)) continue;
    canonical[id as ProfileCollapsibleModuleId] = input[id] as boolean;
  }
  return canonical;
}

export function serializeProfileCollapseMap(value: unknown): string {
  return JSON.stringify(parseProfileCollapseMap(value));
}
