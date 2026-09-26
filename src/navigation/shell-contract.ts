export const TAB_ORDER = [
  "DashboardTab",
  "EventsTab",
  "DigestTab",
  "OrreryTab",
  "SettingsTab",
] as const;

export const INITIAL_TAB = "DigestTab" as const;

export const DIGEST_STACK_ROUTES = [
  "Digest",
  "Profile",
  "RecentlyDeleted",
  "GroupEventDetail",
  "EditGroupEvent",
  "EditParticipant",
  "Compose",
  "ComposeResearch",
  "LogContact",
  "Edit",
  "EditInteraction",
  "ThingsToRemember",
  "MemoryHistory",
  "OffLimitsEditor",
  "CropPhoto",
  "SurvivorSelect",
  "MergeConflicts",
  "MergeImpactSummary",
] as const;

export const EVENTS_STACK_ROUTES = [
  "GroupEvents",
  "GroupEventDetail",
  "Profile",
  "RecentlyDeleted",
  "EditGroupEvent",
  "EditParticipant",
  "Compose",
  "ComposeResearch",
  "LogContact",
  "Edit",
  "EditInteraction",
  "ThingsToRemember",
  "MemoryHistory",
  "OffLimitsEditor",
  "CropPhoto",
  "SurvivorSelect",
  "MergeConflicts",
  "MergeImpactSummary",
] as const;

/**
 * Every route a Contact Profile can navigate to from inside its own stack. Any
 * stack that hosts `Profile` must register these (minus its host exclusions) so
 * a Profile-offered action never targets an unregistered route — in release an
 * unregistered `navigate()` is a silent no-op (RG-021, react-native/AUD-RN-004).
 */
export const PROFILE_REACHABLE_ROUTES = [
  "Profile",
  "RecentlyDeleted",
  "GroupEventDetail",
  "EditGroupEvent",
  "EditParticipant",
  "Compose",
  "ComposeResearch",
  "LogContact",
  "Edit",
  "EditInteraction",
  "ThingsToRemember",
  "MemoryHistory",
  "OffLimitsEditor",
  "CropPhoto",
  "SurvivorSelect",
  "MergeConflicts",
  "MergeImpactSummary",
] as const;

/**
 * Profile-reachable routes the Settings stack deliberately does NOT register.
 * Messaging an archived contact is prohibited (RG-021; owner ruling D-09), and
 * every Settings-hosted Profile renders the hero Message action disabled with a
 * reason instead (owner ruling D-25) — so Compose/ComposeResearch stay
 * unregistered under Settings and there is no cross-tab jump to message.
 * Registering either here reverses those rulings; that is an owner decision.
 */
export const SETTINGS_HOST_EXCLUDED_PROFILE_ROUTES = [
  "Compose",
  "ComposeResearch",
] as const;
