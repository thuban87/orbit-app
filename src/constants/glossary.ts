/**
 * The app's glossary: one canonical user-visible label per concept (38.9
 * D-21, D-41). Every label here is decided; none is renamed (D-41).
 * `glossary-contract.test.ts` pins each value and keeps the retired forms
 * ("Not Contacted", "Not yet contacted", "Wobbling", "Favourite(s)",
 * "Dashboard", "Log Contact") out of production copy (D-22, D-42, D-49).
 *
 * These are display labels only. Code identifiers keep their own spelling
 * (D-49): the population id `favourites`, the widget provider
 * `OrbitFavourites` and the deep link `orbit://favourites` are persisted or
 * OS-registered and never change with a label (D-12).
 *
 * The meaning of each term is recorded in `docs/systems/glossary.md`.
 */

export { CONTACTS, DIGEST, EVENTS } from "./product-labels";

// Enforced labels (D-22, D-42, D-49).
/** People with no logged interaction (D-42). */
export const NEVER_CONTACTED = "Never Contacted";
/** American spelling in user-visible text (D-49). */
export const FAVORITES = "Favorites";
export const FAVORITE = "Favorite";
/** The quick-capture action (D-22, ADR-132). */
export const LOG_INTERACTION = "Log Interaction";

// Contact status names (D-41; D-22 for "Wobbly").
export const STABLE = "Stable";
export const WOBBLY = "Wobbly";
export const DECAYING = "Decaying";
export const ROGUE = "Rogue";

// Decided terms that stay as they are (D-41).
export const GROUP_LOG = "Group Log";
export const DISSOLVE = "Dissolve";
export const TRANSMIT = "Transmit";
export const BOUND = "Bound";
export const UNBOUND = "Unbound";
export const ORBIT_PARTICIPATION = "Orbit participation";
export const INTERACTION_ASSIST = "Interaction Assist";
export const QUARANTINE = "Quarantine";
/**
 * The per-person policy where only connected interactions count (38.11-14
 * B11): one Title Case spelling on the Edit Contact toggle and the Profile
 * sheets, as the Status/Gravity sheets and 38.11 D-87 already wrote it.
 */
export const RARELY_RESPONDS = "Rarely Responds";

// The Bin (38.11 D-69, D-70). "Archive" is renamed "Bin" everywhere
// user-facing; internal names (`archived_at`, DAO names, the `Archived`
// route, the `archive` event type) stay.
/** Where people go before permanent deletion; never empties itself (D-69, D-70). */
export const BIN = "Bin";
/** The action that moves people to the Bin (D-69). */
export const MOVE_TO_BIN = "Move to Bin";

// Things to Remember on the Profile (38.10 D-90, D-87).
/** Topics to avoid bringing up with a person, shown in full on the Profile (D-90, D-10). */
export const OFF_LIMITS = "Off Limits";
/** The Profile's remembered-information section and its children (D-90, D-44). */
export const THINGS_TO_REMEMBER = "Things to Remember";
/** The close button of a detail sheet, such as the Profile entry sheet (D-90, D-87). */
export const CLOSE = "Close";
/** An empty always-show custom field on the Profile (D-90, D-87). */
export const NOT_SET = "Not set";

// The share confirmation card's controls (38.10 D-77, D-78). The section chip
// names come from the memory-type and Profile-module registries (D-89 G-23).
/** The per-item AI switch a new share starts with off (D-03, D-78). */
export const ALLOW_AI = "Allow AI";
/** The share card's note action (D-77). */
export const ADD_NOTE = "Add note";

// The solid Add buttons of the inline Things to Remember sections on Add and
// Edit Contact (38.10 D-67, D-87; plan 14). Last Talked About and Current
// Location have no Add button there (D-119).
/** Decided wording (D-87). */
export const ADD_OFF_LIMITS_ITEM = "Add Off Limits Item";
/** Proposed wording, for the plan-19 wording review (convergence c7, C-03). */
export const ADD_MEMORY = "Add Memory";
/** Proposed wording, for the plan-19 wording review (convergence c7, C-03). */
export const ADD_GIFT_IDEA = "Add Gift Idea";
/** Proposed wording, for the plan-19 wording review (convergence c7, C-03). */
export const ADD_THOUGHT_OF_THEM = "Add Thought of Them";

// Settings switch labels (38.12 D-130, owner Q-31). Status names are not
// renamed (D-05).
/** Notifications: reminders to reach out to people you're overdue with. Was "Decay reminders". */
export const CHECK_IN_REMINDERS = "Check-in reminders";
/** Settings → AI master switch. Was "AI Enabled"; Settings → AI reads it in 38.12-15. */
export const USE_AI_SUGGESTIONS = "Use AI suggestions";

// Check linked contacts (38.12 D-49, D-103). Plain words replace developer
// wording; the canonical terms are not renamed (D-05). The unlink action keeps
// its red styling (D-103; amends ADR-179 D-50, label only).
/** The flow's one name, on the grid and the detail screen (D-49). */
export const CHECK_LINKED_CONTACTS = "Check linked contacts";
/** A linked phone contact the provider no longer returns (D-103; the replaced wording is in docs/systems/glossary.md). */
export const NOT_IN_PHONE_CONTACTS = "Not in phone Contacts";
/** A card the person has to decide field by field (D-103). */
export const NEEDS_YOUR_CHOICE = "Needs your choice";
/** Link a person to another phone contact (D-103). */
export const LINK_DIFFERENT_PHONE_CONTACT = "Link to a different phone contact";
/** Remove the phone-contact link only; keeps its red styling (D-103). */
export const UNLINK_FROM_PHONE_CONTACT = "Unlink from phone contact";

// Interaction channel and direction labels (38.14 D-33, D-64). One map each,
// read by the logging forms, the interaction sheet and History. The keys are
// the stored values; no new term (D-64).
/**
 * Stored channel → its label. Message / Call / In Person are the canonical
 * channels (ADR-116); `other` / `unspecified` are legacy values a record may
 * still hold and read "Other" / "Unspecified" (38.14 D-60, D-64).
 */
export const CHANNEL_LABEL: Readonly<Record<string, string>> = {
  Message: "Message",
  Call: "Call",
  "In Person": "In Person",
  other: "Other",
  unspecified: "Unspecified",
};
/** Stored direction → its label (38.14 D-64; was History's local map). */
export const DIRECTION_LABEL: Readonly<Record<string, string>> = {
  outbound: "Outbound",
  inbound: "Inbound",
  mutual: "Mutual",
};
