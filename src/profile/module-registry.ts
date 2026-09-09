import type {
  ProfileModuleId,
  ProfileModuleParentId,
} from "./persisted-contract";
import { PROFILE_MODULE_IDS } from "./persisted-contract";
import type { ProfileModuleSize } from "./types";

export interface ProfileModuleDefinition {
  id: ProfileModuleId;
  label: string;
  parent: ProfileModuleParentId;
  collapsible: boolean;
  supportedSizes: readonly ProfileModuleSize[];
}

/** Hero is deliberately absent: it is fixed identity structure, not presentation data. */
export const PROFILE_MODULE_REGISTRY: Readonly<
  Record<ProfileModuleId, ProfileModuleDefinition>
> = Object.freeze({
  "relationship-overview": {
    id: "relationship-overview",
    label: "Relationship Overview",
    parent: "profile",
    collapsible: true,
    supportedSizes: [],
  },
  "things-to-remember": {
    id: "things-to-remember",
    label: "Things to Remember",
    parent: "profile",
    collapsible: true,
    supportedSizes: [],
  },
  "contact-methods": {
    id: "contact-methods",
    label: "Contact Methods",
    parent: "profile",
    collapsible: true,
    supportedSizes: [],
  },
  "interaction-history": {
    id: "interaction-history",
    label: "Interaction History",
    parent: "profile",
    collapsible: true,
    supportedSizes: [],
  },
  "orbit-status": {
    id: "orbit-status",
    label: "Orbit Status",
    parent: "relationship-overview",
    collapsible: false,
    supportedSizes: ["2x1", "1x1"],
  },
  gravity: {
    id: "gravity",
    label: "Gravity",
    parent: "relationship-overview",
    collapsible: false,
    supportedSizes: ["1x1"],
  },
  intensity: {
    id: "intensity",
    label: "Intensity",
    parent: "relationship-overview",
    collapsible: false,
    supportedSizes: ["2x1"],
  },
  "last-interaction": {
    id: "last-interaction",
    label: "Last Interaction",
    parent: "relationship-overview",
    collapsible: false,
    supportedSizes: ["2x1", "1x1"],
  },
  "contact-frequency": {
    id: "contact-frequency",
    label: "Contact Frequency",
    parent: "relationship-overview",
    collapsible: false,
    supportedSizes: ["1x1"],
  },
  snooze: {
    id: "snooze",
    label: "Snooze",
    parent: "relationship-overview",
    collapsible: false,
    supportedSizes: ["1x1"],
  },
  "pinned-featured": {
    id: "pinned-featured",
    label: "Pinned / Featured",
    parent: "things-to-remember",
    collapsible: true,
    supportedSizes: [],
  },
  "last-talked-about": {
    id: "last-talked-about",
    label: "Last Talked About",
    parent: "things-to-remember",
    collapsible: true,
    supportedSizes: [],
  },
  "key-people": {
    id: "key-people",
    label: "Key People",
    parent: "things-to-remember",
    collapsible: true,
    supportedSizes: [],
  },
  "current-location": {
    id: "current-location",
    label: "Current Location",
    parent: "things-to-remember",
    collapsible: true,
    supportedSizes: [],
  },
  memories: {
    id: "memories",
    label: "Memories",
    parent: "things-to-remember",
    collapsible: true,
    supportedSizes: [],
  },
  "custom-fields": {
    id: "custom-fields",
    label: "Custom Fields",
    parent: "things-to-remember",
    collapsible: true,
    supportedSizes: [],
  },
  "off-limits": {
    id: "off-limits",
    label: "Off Limits",
    parent: "things-to-remember",
    collapsible: true,
    supportedSizes: [],
  },
  "imported-contact-notes": {
    id: "imported-contact-notes",
    label: "Imported from Contacts App",
    parent: "things-to-remember",
    collapsible: true,
    supportedSizes: [],
  },
});

/**
 * Stable renderer identities. Persisted layouts address these semantic keys,
 * never React component names, so a later phase can replace a renderer without
 * migrating layout JSON.
 */
export const PROFILE_MODULE_RENDERERS = Object.freeze(
  Object.fromEntries(PROFILE_MODULE_IDS.map((id) => [id, id])),
) as Readonly<Record<ProfileModuleId, ProfileModuleId>>;

export function createProfileModuleRendererRegistry<T>(
  renderers: Readonly<Record<ProfileModuleId, T>>,
  replacements: { history?: T } = {},
): Readonly<Record<ProfileModuleId, T>> {
  return Object.freeze({
    ...renderers,
    ...(replacements.history === undefined
      ? {}
      : { "interaction-history": replacements.history }),
  });
}
