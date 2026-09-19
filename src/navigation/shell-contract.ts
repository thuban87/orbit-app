export const TAB_ORDER = [
  "DashboardTab",
  "EventsTab",
  "DigestTab",
  "OrreryTab",
  "SettingsTab",
] as const;

export const INITIAL_TAB = "DigestTab" as const;

export const DIGEST_STACK_ROUTES = ["Digest", "Profile"] as const;

export const EVENTS_STACK_ROUTES = [
  "GroupEvents",
  "GroupEventDetail",
  "Profile",
] as const;
