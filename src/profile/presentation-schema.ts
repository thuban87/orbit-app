import { PROFILE_MODULE_REGISTRY } from "./module-registry";
import {
  PROFILE_LAYOUT_DOCUMENT_VERSION,
  PROFILE_MODULE_IDS,
  PROFILE_MODULE_PARENT,
  type ProfileModuleId,
  type ProfileModuleParentId,
  type ProfileOverviewModuleId,
} from "./persisted-contract";
import type {
  ProfileLayoutDocument,
  ProfileModulePlacement,
  ProfileModuleSize,
} from "./types";

const MODULE_IDS = new Set<string>(PROFILE_MODULE_IDS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  label: string,
): void {
  const allowed = new Set(keys);
  const extra = Object.keys(value).find((key) => !allowed.has(key));
  if (extra) throw new Error(`${label} has an unknown property: ${extra}`);
}

function bucket(
  value: unknown,
  parent: ProfileModuleParentId,
  seen: Set<ProfileModuleId>,
): ProfileModulePlacement[] {
  if (!Array.isArray(value))
    throw new Error(`${parent} modules must be an array`);
  return value.map((candidate, index) => {
    if (!isRecord(candidate))
      throw new Error(`${parent} module ${index} must be an object`);
    assertKeys(
      candidate,
      parent === "relationship-overview"
        ? ["id", "visible", "expanded", "size"]
        : ["id", "visible", "expanded"],
      `${parent} module`,
    );
    const { id, visible, expanded } = candidate;
    if (typeof id !== "string" || !MODULE_IDS.has(id))
      throw new Error(`unknown Profile module ID: ${String(id)}`);
    const moduleId = id as ProfileModuleId;
    if (PROFILE_MODULE_PARENT[moduleId] !== parent)
      throw new Error(`illegal parent for Profile module ${moduleId}`);
    if (seen.has(moduleId))
      throw new Error(`duplicate Profile module ID: ${moduleId}`);
    if (typeof visible !== "boolean" || typeof expanded !== "boolean")
      throw new Error(`Profile module ${moduleId} flags must be boolean`);
    seen.add(moduleId);
    if (parent !== "relationship-overview")
      return { id: moduleId, visible, expanded };
    const size = candidate.size;
    if (
      typeof size !== "string" ||
      !PROFILE_MODULE_REGISTRY[moduleId].supportedSizes.includes(
        size as ProfileModuleSize,
      )
    ) {
      throw new Error(`illegal size for Profile module ${moduleId}`);
    }
    return { id: moduleId, visible, expanded, size: size as ProfileModuleSize };
  });
}

export function parseAndCanonicalizeProfileLayout(
  value: unknown,
): ProfileLayoutDocument {
  let decoded = value;
  if (typeof value === "string") {
    try {
      decoded = JSON.parse(value);
    } catch {
      throw new Error("Profile layout must be valid JSON");
    }
  }
  if (!isRecord(decoded)) throw new Error("Profile layout must be an object");
  assertKeys(
    decoded,
    ["version", "topLevel", "overview", "thingsToRemember"],
    "Profile layout",
  );
  if (decoded.version !== PROFILE_LAYOUT_DOCUMENT_VERSION)
    throw new Error("invalid Profile layout version");
  const seen = new Set<ProfileModuleId>();
  return {
    version: PROFILE_LAYOUT_DOCUMENT_VERSION,
    topLevel: bucket(decoded.topLevel, "profile", seen),
    overview: bucket(
      decoded.overview,
      "relationship-overview",
      seen,
    ) as ProfileLayoutDocument["overview"],
    thingsToRemember: bucket(
      decoded.thingsToRemember,
      "things-to-remember",
      seen,
    ),
  };
}

const placement = (
  id: ProfileModuleId,
  expanded: boolean,
  size?: ProfileModuleSize,
): ProfileModulePlacement => ({
  id,
  visible: true,
  expanded,
  ...(size ? { size } : {}),
});

export const FACTORY_PROFILE_LAYOUT: ProfileLayoutDocument = {
  version: PROFILE_LAYOUT_DOCUMENT_VERSION,
  topLevel: [
    placement("relationship-overview", true),
    placement("things-to-remember", true),
    placement("contact-methods", true),
    placement("interaction-history", true),
  ],
  overview: [
    placement("orbit-status", false, "2x1"),
    placement("gravity", false, "1x1"),
    placement("intensity", false, "2x1"),
    placement("last-interaction", false, "2x1"),
    placement("contact-frequency", false, "1x1"),
    placement("snooze", false, "1x1"),
  ] as Array<
    ProfileModulePlacement & {
      id: ProfileOverviewModuleId;
      size: ProfileModuleSize;
    }
  >,
  thingsToRemember: [
    placement("pinned-featured", true),
    placement("last-talked-about", true),
    placement("key-people", true),
    placement("current-location", true),
    placement("memories", true),
    placement("custom-fields", true),
    placement("off-limits", true),
    placement("imported-contact-notes", false),
  ],
};

export function serializeProfileLayout(value: unknown): string {
  return JSON.stringify(parseAndCanonicalizeProfileLayout(value));
}
