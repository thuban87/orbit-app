/**
 * Pure form <-> DAO-input model for EditInteractionScreen (HIST-12, HIST-14).
 *
 * Extracted from the RN screen so the correctness-critical rules are unit-tested
 * in the node Vitest env (`EditInteractionScreen.tsx` imports react-native + the
 * TouchpointRefineForm and cannot load there — the same split as
 * `edit-contact-logic.ts`). This module owns:
 *
 *   • seeding the extended `TouchpointRefineForm` value from a loaded interaction
 *     (`readInteractionForEdit`) — every editable field, not a partial projection;
 *   • assembling the `editTouchpointFull` input (the SOLE recency writer) —
 *     including the nullable `duration` and the 0/1 `allow_ai` gate;
 *   • a UX-only future-date guard that AGREES with the DAO's `rejectFutureOccurredAt`
 *     (that guard remains the authority — this is inline feedback, not a second
 *     source of truth) and reuses the single shipped `FUTURE_DATETIME_MESSAGE`
 *     copy (re-exported here, never re-authored); and
 *   • the failed-save-preserves-state / never-completes outcome (mirrors the
 *     TouchpointRefineForm / CAPT locked idiom).
 *
 * This module builds NO SQL and performs NO interactions write — it maps values
 * for the DAO, which is the single chokepoint.
 */
import { FUTURE_DATETIME_MESSAGE } from "@/components/touchpoint-refine-logic";
import type { TouchpointRefineValue } from "@/components/TouchpointRefineForm";
import type { InteractionForEdit } from "@/db/interaction-edit-read";
import { rejectFutureOccurredAt } from "@/db/log-guards";
import type { EditTouchpointFullInput } from "@/db/recency-dao";

/** Re-export the ONE shipped future-date copy so the screen imports a single source. */
export { FUTURE_DATETIME_MESSAGE };

/** Generic failed-save copy (mirrors EditContactScreen's save-failure idiom). */
export const SAVE_FAILED_MESSAGE = "Couldn't save changes. Please try again.";

/** The ids + timestamp that scope one interaction edit through the recency spine. */
export interface EditInteractionIds {
  interactionId: number;
  contactId: number;
  /** Local wall-clock now — new `modified_at` + the future-date bound. */
  now: string;
}

/** Seed the controlled refine value from a loaded interaction (every editable field). */
export function seedRefineValue(loaded: InteractionForEdit): TouchpointRefineValue {
  return {
    occurredAt: loaded.occurredAt,
    channel: loaded.channel,
    direction: loaded.direction,
    connected: loaded.connected,
    quality: loaded.quality,
    note: loaded.note,
    duration: loaded.duration,
    allowAi: loaded.allowAi,
  };
}

/**
 * True when the form's `occurredAt` is malformed OR strictly after `now` — i.e.
 * exactly when the DAO's `rejectFutureOccurredAt` would throw. Reuses that single
 * guard so the inline UX flag AGREES with the write authority (never a divergent
 * check). The screen surfaces `FUTURE_DATETIME_MESSAGE` when this is true.
 */
export function isOccurredAtRejected(
  value: TouchpointRefineValue,
  now: string,
): boolean {
  try {
    rejectFutureOccurredAt(value.occurredAt, now);
    return false;
  } catch {
    return true;
  }
}

/**
 * Can the edit be saved? Blocked while a write is in flight and whenever the
 * occurred_at is future/malformed (the DAO would reject it). Every other field is
 * optional/nullable, so occurred_at validity is the only gate.
 */
export function canSave(
  value: TouchpointRefineValue,
  now: string,
  saving: boolean,
): boolean {
  return !saving && !isOccurredAtRejected(value, now);
}

/**
 * Map the controlled refine value + ids into the `editTouchpointFull` input. Sets
 * every editable column unconditionally (the form seeds them all), carrying the
 * nullable `duration` and the 0/1 `allowAi` through. The DAO rejects a future
 * `occurredAt` and recomputes recency inside its one transaction.
 */
export function buildEditInput(
  value: TouchpointRefineValue,
  ids: EditInteractionIds,
): EditTouchpointFullInput {
  return {
    interactionId: ids.interactionId,
    contactId: ids.contactId,
    occurredAt: value.occurredAt,
    now: ids.now,
    channel: value.channel,
    direction: value.direction,
    connected: value.connected,
    quality: value.quality,
    note: value.note,
    duration: value.duration,
    allowAi: value.allowAi,
  };
}

/** The resolved state after attempting to persist an interaction edit. */
export interface EditSaveResult {
  /** The form value to keep rendering — UNCHANGED on failure (never cleared). */
  value: TouchpointRefineValue;
  /** True ONLY after a confirmed successful write — the screen may navigate away. */
  completed: boolean;
  /** Inline error to surface on failure; null on success. */
  error: string | null;
}

/**
 * Model the save outcome: a success completes (the screen returns to the caller);
 * a failure preserves the full form value (same reference — nothing is cleared)
 * and does NOT signal completion, so the user can correct and retry in place.
 */
export function resolveSave(
  value: TouchpointRefineValue,
  succeeded: boolean,
): EditSaveResult {
  return succeeded
    ? { value, completed: true, error: null }
    : { value, completed: false, error: SAVE_FAILED_MESSAGE };
}
