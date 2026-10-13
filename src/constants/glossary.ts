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

// The share confirmation card's controls (38.10 D-77, D-78). The section chip
// names come from the memory-type and Profile-module registries (D-89 G-23).
/** The per-item AI switch a new share starts with off (D-03, D-78). */
export const ALLOW_AI = "Allow AI";
/** The share card's note action (D-77). */
export const ADD_NOTE = "Add note";
