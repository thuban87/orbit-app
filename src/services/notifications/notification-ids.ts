/**
 * notification-ids — the SINGLE source of truth for every notification
 * identifier, channel/category/action id, generic body copy, the occurrence-
 * scoped payload contract, and the deterministic action-idempotency key.
 *
 * This module is PURE and react-native/expo-free (node-loadable), mirroring the
 * string-constant posture of `src/db/status.ts`. Every downstream notification
 * plan imports from here so the scheduler that MINTS these values and the
 * handler/gate that READ them can never drift:
 *   - channels.ts creates channels keyed on the *_CHANNEL constants,
 *   - notification-actions.ts registers DECAY_CATEGORY + ACTION_* buttons,
 *   - notification-schedule.ts mints identifiers + NotificationData at reconcile,
 *   - the response gate derives the interaction/event uid via actionUid().
 *
 * COPY IS FROZEN GENERIC. Body builders substitute ONLY the contact name — no
 * fuel, no PII, no log-derived text is ever eligible to be baked into a scheduled
 * notification body (a body may be glanced on the lock screen; T-11-01). Fuel is
 * shown on the compose screen the tap opens, never in the shade text.
 */

/**
 * Stable per-contact identifiers. Namespaced so a decay reminder and a birthday
 * reminder for the SAME person do NOT replace each other (orchestrator pick 3),
 * while a re-nag for the same contact REUSES its identifier so the OS replaces
 * the prior shade entry instead of stacking (flat-weekly re-nag, not escalating).
 */
export function decayIdentifier(contactId: number): string {
  return `decay:${contactId}`;
}

export function birthdayIdentifier(contactId: number): string {
  return `birthday:${contactId}`;
}

/**
 * Versioned channel ids. Channel importance/visibility is IMMUTABLE at creation
 * in Android, so the version suffix is the ONLY way to change a channel's
 * properties in a later release (create a `-v2` channel, migrate). The two decay
 * channels split lock-screen private/public visibility; birthday has a single
 * channel that does not honour the visibility toggle (OQ-2).
 */
export const DECAY_PRIVATE_CHANNEL = "decay-private-v1";
export const DECAY_PUBLIC_CHANNEL = "decay-public-v1";
export const BIRTHDAY_CHANNEL = "birthday-v1";

/**
 * Action category + action ids for the headless decay buttons. The category id
 * uses an UNDERSCORE (`decay_actions`, never a hyphen): hyphens are risky in
 * Expo category identifiers and this is a PERMANENT id, so it is fixed before it
 * ships (review item 9 / A4).
 */
export const DECAY_CATEGORY = "decay_actions";
export const ACTION_MARK = "mark";
export const ACTION_SNOOZE = "snooze";

/**
 * Generic body builders — the verbatim UI-SPEC / CONTEXT copy, plain text, no
 * emoji. The name is the ONLY substitution (frozen-content invariant above).
 */
export function decayBody(name: string): string {
  return `${name} — time to reach out.`;
}

export function birthdayBody(name: string): string {
  return `It's ${name}'s birthday today.`;
}

/**
 * The occurrence-scoped payload carried on every scheduled notification. The
 * scheduler mints it at schedule time; the handler/gate read it back on tap.
 *
 * `occurrenceKey` is the scheduled fire date (`YYYY-MM-DD`, minted by 11-10) — it
 * is the per-occurrence discriminator that makes a re-delivered tap collide with
 * its original write (via actionUid below) instead of double-writing.
 */
export interface NotificationData {
  kind: "decay" | "birthday";
  contactId: number;
  occurrenceKey: string;
}

/**
 * Deterministic idempotency key (review H2). A PURE function of its inputs — it
 * mints NOTHING random (contrast newUid()): the SAME action + data always yields
 * the SAME uid. 11-07 passes this as the interaction/event `uid`, so a
 * re-delivered or cold-replayed tap collides on the existing UNIQUE(uid)
 * constraint (interactions.uid / events.uid) and cannot create a duplicate row.
 *
 * It carries no secret and no user free-text — contactId + occurrenceKey are
 * app-minted at schedule time (T-11-IDEMP).
 */
export function actionUid(
  actionIdentifier: string,
  data: NotificationData,
): string {
  return `notif:${actionIdentifier}:${data.kind}:${data.contactId}:${data.occurrenceKey}`;
}
