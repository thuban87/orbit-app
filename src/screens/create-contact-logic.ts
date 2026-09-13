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

import {
  type MethodGroups,
  toMethodDrafts,
} from "@/components/contact-methods-editor-model";
import type { LastSpokeValue } from "@/components/tri-state-last-spoke-logic";
import type { CreateContactFullInput } from "@/db/contacts-dao";

/** The create form's controlled state (the screen owns the React state). */
export interface CreateFormState {
  name: string;
  categoryId: number | null;
  /**
   * The FrequencyPicker's emitted interval_days. `null` = no cadence assigned
   * (the Unbound resting state); a positive integer once a cadence is picked.
   */
  intervalDays: number | null;
  /** The FrequencyPicker's validity — false blocks Save. */
  intervalValid: boolean;
  trackingEnabled?: boolean;
  lastSpoke: LastSpokeValue;
  methods: MethodGroups;
  /** Custom-field values keyed by `col_name` (from FieldValueInput). */
  values: Record<string, string | null>;
}

/** Caller-supplied non-deterministic inputs, so the builder stays pure/testable. */
export interface BuildCreateInputDeps {
  /** Local wall-clock now — `localDateTime()`. */
  now: string;
  /** The new contact row uid — `newUid()`. */
  contactUid: string;
  /** The first-interaction uid — `newUid()` (unused on the "not yet" path). */
  interactionUid: string;
  /** `defsForCreateForm(defs)` — the show_on_new normalized definition pairs. */
  createDefs: Array<{ id: number; col_name: string }>;
  /** Saved override first, otherwise the platform device region. */
  effectivePhoneRegion: string | null;
}

/**
 * Can the form be saved? Name is the ONLY required field; an invalid custom
 * interval blocks Save so a non-positive interval never reaches the DAO.
 */
export function canSave(state: CreateFormState): boolean {
  return (
    state.name.trim().length > 0 &&
    (state.trackingEnabled === false || state.intervalValid)
  );
}

/** The cadence-related slice of form state coordinated as one unit (CAPT-03). */
export interface CadenceFormFields {
  trackingEnabled: boolean;
  intervalDays: number | null;
  intervalValid: boolean;
}

/**
 * Coordinate the Bound/Unbound toggle with the optional cadence (CAPT-03,
 * dossier §F; ADR-062 re-verified on disk — `tracking_enabled` is the flag and
 * `contacts_prevent_cadence_clear` forbids nulling an assigned cadence).
 *
 *   • Unbound retains any interval as a DORMANT cadence — Unbound is NEVER
 *     modelled as `interval_days = null` — and never blocks Save on cadence.
 *   • Bound requires a positive-integer cadence: a dormant cadence rebinds valid,
 *     but binding with no (or a non-positive) cadence leaves `intervalValid`
 *     false so Save stays gated until the user picks a valid interval.
 */
export function coordinateBoundToggle(
  current: Pick<CreateFormState, "intervalDays">,
  bound: boolean,
): CadenceFormFields {
  if (!bound) {
    return {
      trackingEnabled: false,
      intervalDays: current.intervalDays,
      intervalValid: true,
    };
  }
  const hasCadence =
    current.intervalDays !== null &&
    Number.isInteger(current.intervalDays) &&
    current.intervalDays > 0;
  return {
    trackingEnabled: true,
    intervalDays: current.intervalDays,
    intervalValid: hasCadence,
  };
}

/**
 * Selecting a cadence turns Bound on (CAPT-03). `FrequencyPicker.onChange` only
 * emits a positive-integer interval (never on an invalid entry — its custom-entry
 * validity is reported separately through `onValidityChange`), so a value that
 * reaches here is a valid cadence that binds the contact.
 */
export function coordinateCadenceSelection(
  intervalDays: number,
): CadenceFormFields {
  return {
    trackingEnabled: true,
    intervalDays,
    intervalValid: true,
  };
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
 * Build the atomic-create input for `createContactFull`. Blank method controls
 * are discarded but nonblank invalid drafts stay durable; `name` is trimmed. The custom block is the `createDefs` mapped
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
    trackingEnabled: state.trackingEnabled !== false,
    now: deps.now,
    methodDrafts: toMethodDrafts(state.methods),
    methodNormalization: {
      effectivePhoneRegion: deps.effectivePhoneRegion,
    },
    categoryId: state.categoryId,
    rarelyResponds: 0,
    customValues: deps.createDefs.map((definition) => ({
      fieldDefId: definition.id,
      value: state.values[definition.col_name] ?? null,
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
