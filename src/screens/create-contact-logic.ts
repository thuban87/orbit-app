/**
 * Pure form → DAO-input model for CreateContactScreen (CRUD-01 / CRUD-02).
 *
 * Extracted from the RN screen so the correctness-critical rules are unit-tested
 * in the node Vitest env (`CreateContactScreen.tsx` imports react-native and the
 * native pickers, and cannot load there — the same split as FrequencyPicker /
 * TriStateLastSpoke). This module owns:
 *
 *   • the Save gate (non-empty name AND a valid custom-frequency entry) so a
 *     non-positive interval NEVER reaches `createContactFull` (which hard-rejects
 *     it — contacts-dao GUARD 1); and
 *   • assembling the `CreateContactFullInput` — splitting form state into the
 *     `contacts` columns (INCLUDING `phone`, the CRUD-01 fix) + the `show_on_new`
 *     custom values + the tri-state `firstInteraction`.
 *
 * The tri-state → firstInteraction mapping is the CRUD-02 rule: "not yet" omits
 * the interaction (NULL last_contact); "today" pins occurredAt to `now`; "Pick
 * date" pins it to `${date} 00:00:00` — local midnight, matching the DAO's
 * `YYYY-MM-DD HH:MM:SS` contract, so a bare 10-char date never lands in
 * occurred_at. Dates already arrive local-formatted from the tri-state
 * (formatLocalDate, never toISOString).
 */
import type { LastSpokeValue } from "@/components/tri-state-last-spoke-logic";
import type { CreateContactFullInput } from "@/db/contacts-dao";

/** The create form's controlled state (the screen owns the React state). */
export interface CreateFormState {
  name: string;
  categoryId: number | null;
  /** The FrequencyPicker's emitted interval_days (defaults to Monthly = 30). */
  intervalDays: number;
  /** The FrequencyPicker's validity — false blocks Save. */
  intervalValid: boolean;
  lastSpoke: LastSpokeValue;
  phone: string;
  /** Custom-field values keyed by `col_name` (from FieldValueInput). */
  values: Record<string, string | null>;
}

/** Caller-supplied non-deterministic inputs, so the builder stays pure/testable. */
export interface BuildCreateInputDeps {
  /** Local wall-clock now — `localDateTime()`. */
  now: string;
  /** The new contact row uid — `newUid()`. */
  contactUid: string;
  /** The per-contact custom-values row uid — `newUid()`. */
  rowUid: string;
  /** The first-interaction uid — `newUid()` (unused on the "not yet" path). */
  interactionUid: string;
  /** `defsForCreateForm(defs).map(d => d.col_name)` — the show_on_new columns. */
  createColNames: string[];
}

/**
 * Can the form be saved? Name is the ONLY required field; an invalid custom
 * interval blocks Save so a non-positive interval never reaches the DAO.
 */
export function canSave(state: CreateFormState): boolean {
  return state.name.trim().length > 0 && state.intervalValid;
}

/**
 * The occurred_at a tri-state selection contributes, or `null` for "not yet".
 * "today" → `now`; "date" → `${date} 00:00:00` (local midnight for the DAO's
 * `YYYY-MM-DD HH:MM:SS` contract).
 */
export function firstInteractionOccurredAt(
  lastSpoke: LastSpokeValue,
  now: string,
): string | null {
  switch (lastSpoke.kind) {
    case "today":
      return now;
    case "date":
      return `${lastSpoke.date} 00:00:00`;
    default:
      return null;
  }
}

/**
 * Build the atomic-create input for `createContactFull`. `phone` is trimmed and
 * empty→null; `name` is trimmed. The custom block is the `createColNames` mapped
 * to the current values (a missing key → null). The `firstInteraction` follows
 * the tri-state: "not yet" omits it entirely.
 */
export function buildCreateInput(
  state: CreateFormState,
  deps: BuildCreateInputDeps,
): CreateContactFullInput {
  const occurredAt = firstInteractionOccurredAt(state.lastSpoke, deps.now);
  const input: CreateContactFullInput = {
    uid: deps.contactUid,
    name: state.name.trim(),
    intervalDays: state.intervalDays,
    now: deps.now,
    phone: state.phone.trim() || null,
    categoryId: state.categoryId,
    rarelyResponds: 0,
    rowUid: deps.rowUid,
    customValues: deps.createColNames.map((col) => ({
      col,
      value: state.values[col] ?? null,
    })),
  };
  if (occurredAt !== null) {
    input.firstInteraction = {
      uid: deps.interactionUid,
      occurredAt,
      source: "manual",
      direction: null,
    };
  }
  return input;
}
