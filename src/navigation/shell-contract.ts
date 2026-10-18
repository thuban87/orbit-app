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
  "GroupEventDetail",
  "EditGroupEvent",
  "EditParticipant",
  "Compose",
  "ComposeResearch",
  "LogContact",
  "Create",
  "GroupLog",
  "Memory",
  "Edit",
  "EditInteraction",
  "MemoryHistory",
  "SectionEditor",
  "OffLimitsEditor",
  "KeyPeopleEditor",
  "CropPhoto",
  "SurvivorSelect",
  "MergeConflicts",
  "MergeImpactSummary",
  // 38.11 D-58.1: the Profile background sheet opens the Settings page.
  "ProfileBackgrounds",
  // 38.12 D-100: the Profile ⋯ "Check with phone Contacts…" entry.
  "ReconcileDetail",
  // 38.12 D-106: a custom field's "View history".
  "ValueHistory",
] as const;

export const EVENTS_STACK_ROUTES = [
  "GroupEvents",
  "GroupEventDetail",
  "Profile",
  "EditGroupEvent",
  "EditParticipant",
  "Compose",
  "ComposeResearch",
  "LogContact",
  "Create",
  "GroupLog",
  "Memory",
  "Edit",
  "EditInteraction",
  "MemoryHistory",
  "SectionEditor",
  "OffLimitsEditor",
  "KeyPeopleEditor",
  "CropPhoto",
  "SurvivorSelect",
  "MergeConflicts",
  "MergeImpactSummary",
  // 38.11 D-58.1: the Profile background sheet opens the Settings page.
  "ProfileBackgrounds",
  // 38.12 D-100: the Profile ⋯ "Check with phone Contacts…" entry.
  "ReconcileDetail",
  // 38.12 D-106: a custom field's "View history".
  "ValueHistory",
] as const;

/**
 * Every route a Contact Profile can navigate to from inside its own stack. Any
 * stack that hosts `Profile` must register these (minus its host exclusions) so
 * a Profile-offered action never targets an unregistered route — in release an
 * unregistered `navigate()` is a silent no-op (RG-021, react-native/AUD-RN-004).
 */
export const PROFILE_REACHABLE_ROUTES = [
  "Profile",
  "GroupEventDetail",
  "EditGroupEvent",
  "EditParticipant",
  "Compose",
  "ComposeResearch",
  "LogContact",
  // 38.11 D-66: Memory left the + but the Profile's add-memory heading actions
  // still open it, so every Profile-hosting stack keeps registering it.
  "Memory",
  "Edit",
  "EditInteraction",
  "MemoryHistory",
  "SectionEditor",
  "OffLimitsEditor",
  "KeyPeopleEditor",
  "CropPhoto",
  "SurvivorSelect",
  "MergeConflicts",
  "MergeImpactSummary",
  // 38.11 D-58.1: the Profile background sheet opens the Settings page.
  "ProfileBackgrounds",
  // 38.12 D-100: the Profile ⋯ "Check with phone Contacts…" entry.
  "ReconcileDetail",
  // 38.12 D-106: a custom field's "View history".
  "ValueHistory",
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

/**
 * The routes the universal + opens (D-38, owner 2026-10-10): + forms open over
 * the tab the user is on, so every tab stack registers all of them (the ADR-166
 * per-stack registration pattern, as with PROFILE_REACHABLE_ROUTES). Back
 * before saving returns to that tab's screen; completion destinations are
 * unchanged (D-08). `shell-contract.test.ts` asserts every stack registers each
 * entry and that this list covers every + navigate target at the type level.
 * 38.11: Update Contact retired (D-62) and Memory moved to
 * PROFILE_REACHABLE_ROUTES (D-66).
 */
export const FAB_ROUTES = ["Create", "GroupLog", "LogContact"] as const;
