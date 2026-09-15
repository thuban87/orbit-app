import type { SettingsRegisteredRoute } from "@/navigation/settings-routes";

/**
 * Canonical §A top-level category order (dossier §A). Later plans fill in the
 * currently-absent categories (Appearance, Contacts & Relationships,
 * Notifications, Orrery, Data & Backup, AI, About) at their correct index. This
 * is the anchor `settings-hub-model.test.ts` reads to assert §A ordering of the
 * present category rows. `SettingsMore` is a transitional migration scaffold,
 * NOT a §A category, and is intentionally absent from this order.
 */
export const SETTINGS_CATEGORY_ORDER = [
  "appearance",
  "contacts",
  "interactions",
  "notifications",
  "orrery",
  "data-backup",
  "ai",
  "about",
] as const;

export type SettingsCategoryKey = (typeof SETTINGS_CATEGORY_ORDER)[number];

/**
 * A hub directory entry. A DISCRIMINATED UNION from the outset (§L): a
 * `kind:"route"` row navigates to a registered Settings sub-route; a
 * `kind:"action"` row invokes an in-place handler (e.g. the Plan 08 "Add Orbit
 * widget" utility row) rather than navigating. Modelling the action row as a
 * route would mis-type it as a navigation target it is not.
 */
export type SettingsHubRouteEntry = {
  readonly kind: "route";
  readonly key: string;
  readonly title: string;
  readonly subtitle: string;
  readonly icon: string;
  /** Typed against the runtime registration contract — an unregistered or
   *  reserved (D-03) name fails to type-check. */
  readonly route: SettingsRegisteredRoute;
};

export type SettingsHubActionEntry = {
  readonly kind: "action";
  readonly key: string;
  readonly title: string;
  readonly subtitle: string;
  readonly icon: string;
  /** Stable action identifier the hub screen switches on (no route exists). */
  readonly action: string;
};

export type SettingsHubRow = SettingsHubRouteEntry | SettingsHubActionEntry;

/**
 * The hub directory rows, authored in §A order. Per §A the rows carry NO live
 * setting values — title + subtitle only. Per §K, ONLY rows whose destination
 * screen exists after THIS plan are present: the real Interactions category and
 * the transitional "More settings" row that fronts the untouched monolith.
 * Later plans insert their category rows at the correct §A index and append the
 * bottom utility (`kind:"action"`) row.
 *
 * The transitional `SettingsMore` row is the last non-utility row (a regression
 * anchor — Plan 08 removes it once every group has migrated).
 */
export const SETTINGS_HUB_ROWS: ReadonlyArray<SettingsHubRow> = Object.freeze([
  {
    kind: "route",
    key: "appearance",
    title: "Appearance",
    subtitle: "Theme, mode, accent, and background",
    icon: "palette",
    route: "SettingsAppearance",
  },
  {
    kind: "route",
    key: "contacts",
    title: "Contacts & Relationships",
    subtitle: "Contact sources, custom fields, and archived people",
    icon: "contacts",
    route: "SettingsContacts",
  },
  {
    kind: "route",
    key: "interactions",
    title: "Interactions",
    subtitle: "Message defaults, dashboard swipe, and Interaction Assist",
    icon: "chat",
    route: "SettingsInteractions",
  },
  {
    kind: "route",
    key: "more",
    title: "More settings",
    subtitle: "Everything not yet reorganised into a category",
    icon: "dots",
    route: "SettingsMore",
  },
]);
