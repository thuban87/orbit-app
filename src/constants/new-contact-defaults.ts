/**
 * Shared defaults for a newly created contact.
 *
 * `NEW_CONTACT_DEFAULT_INTERVAL_DAYS` is the check-in cadence a new contact
 * lands with when the user has not chosen one: monthly (Phase 39 D-51). Phase
 * 38.10 introduces it because it lands first (D-32); the share screen's
 * name-only create reads it (D-83), and 38.11 adopts it for Create / Update.
 * A single-number tunable (CLAUDE.md).
 */
export const NEW_CONTACT_DEFAULT_INTERVAL_DAYS = 30;
