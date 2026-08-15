/**
 * Pure form <-> DAO-input model for EditContactScreen (CRUD-03).
 *
 * Extracted from the RN screen so the correctness-critical rules are unit-tested
 * in the node Vitest env (`EditContactScreen.tsx` imports react-native + the
 * native pickers and cannot load there — the same split as create-contact-logic).
 * This module owns:
 *
 *   • the Save gate (non-empty name AND a valid custom-frequency entry) so a
 *     non-positive interval NEVER reaches `updateContactFull` (contacts-dao
 *     GUARD 1 hard-rejects it);
 *   • seeding the form from `getContactForEdit` (fixed columns + the birthday
 *     year-unknown split + the custom-value map);
 *   • the birthday storage convention (RESEARCH Pitfall 7): `MM-DD` when the year
 *     is unknown, `YYYY-MM-DD` when known — distinguished by string length so the
 *     later single birthday parser stays correct; and
 *   • assembling the `UpdateContactFullInput` — splitting form state into the
 *     `contacts` columns + the custom-values row + (never-contacted only) the
 *     tri-state `firstInteraction`.
 *
 * LAST-SPOKE BOUNDARY (owner ruling 2026-08-14 / CONTEXT Area 3): a
 * `firstInteraction` is emitted ONLY when the seeded contact is never-contacted
 * (`neverContacted`) AND the tri-state is Today/Pick date. `updateContactFull`
 * re-asserts `last_contact IS NULL` inside its transaction and writes it through
 * the single-writer path — the screen never writes `last_contact` directly, and
 * an already-contacted contact has no last-spoke control and no firstInteraction
 * path here (timeline correction stays Phase 6).
 *
 * The tri-state -> occurredAt mapping is REUSED verbatim from create-contact-logic
 * (`firstInteractionOccurredAt`) — one source of truth for the CRUD-02 rule.
 */
import type { LastSpokeValue } from "@/components/tri-state-last-spoke-logic";
import type { UpdateContactFullInput } from "@/db/contacts-dao";
import type { ContactForEdit } from "@/db/contact-read";
import { firstInteractionOccurredAt } from "./create-contact-logic";

/** The edit form's controlled state (the screen owns the React state). */
export interface EditFormState {
  name: string;
  categoryId: number | null;
  /** The FrequencyPicker's emitted interval_days. */
  intervalDays: number;
  /** The FrequencyPicker's validity — false blocks Save. */
  intervalValid: boolean;
  /** Native social-battery picker value (Charger/Neutral/Drain), or null. */
  socialBattery: string | null;
  /**
   * The FULL `YYYY-MM-DD` the birthday picker holds, or null when unset. The
   * year-unknown case still carries a full date here (a placeholder year seeds
   * the picker); `buildBirthdayForStorage` strips the year on save.
   */
  birthdayInput: string | null;
  /** When on, the birthday stores as `MM-DD` (the picker's year is ignored). */
  birthdayYearUnknown: boolean;
  phone: string;
  email: string;
  /** 0/1 — the "Rarely responds" toggle. */
  rarelyResponds: number;
  /** 0/1 — the "Turn off reminders" toggle. */
  remindersOff: number;
  /** Custom-field values keyed by `col_name` (from FieldValueInput). */
  values: Record<string, string | null>;
  /**
   * The tri-state last-spoke selection. Rendered/meaningful ONLY for a
   * never-contacted contact; defaults to "not-yet" so an untouched save logs
   * nothing.
   */
  lastSpoke: LastSpokeValue;
}

/** Caller-supplied non-deterministic inputs, so the builder stays pure/testable. */
export interface BuildEditInputDeps {
  /** Local wall-clock now — `localDateTime()`. */
  now: string;
  /** The contact being edited. */
  contactId: number;
  /** The per-contact custom-values row uid — ALWAYS a fresh `newUid()`. */
  rowUid: string;
  /** The first-interaction uid — `newUid()` (unused unless never-contacted + Today/date). */
  interactionUid: string;
  /** `defsForEditForm(defs).map(d => d.col_name)` — EVERY non-quarantined column. */
  editColNames: string[];
  /** The seeded `contact.last_contact IS NULL` flag — gates the firstInteraction path. */
  neverContacted: boolean;
}

/** A never-contacted contact (`last_contact IS NULL`) may set its first contact here. */
export function isNeverContacted(result: ContactForEdit): boolean {
  return result.contact.last_contact == null;
}

/**
 * Split a STORED birthday into the picker's full-date input + the year-unknown
 * flag (RESEARCH Pitfall 7, distinguished by string length). A `MM-DD` (5-char)
 * value is year-unknown; it seeds the picker with a leap-safe placeholder year
 * (2000) so 02-29 round-trips. A `YYYY-MM-DD` value keeps its year. Null → unset.
 */
export function parseBirthdayForForm(stored: string | null): {
  birthdayInput: string | null;
  birthdayYearUnknown: boolean;
} {
  if (stored == null || stored.length === 0) {
    return { birthdayInput: null, birthdayYearUnknown: false };
  }
  if (stored.length === 5) {
    return { birthdayInput: `2000-${stored}`, birthdayYearUnknown: true };
  }
  return { birthdayInput: stored.slice(0, 10), birthdayYearUnknown: false };
}

/**
 * The value written to `contacts.birthday`: `MM-DD` when the year is unknown,
 * `YYYY-MM-DD` when known (Pitfall 7). Null when unset.
 */
export function buildBirthdayForStorage(
  birthdayInput: string | null,
  yearUnknown: boolean,
): string | null {
  if (birthdayInput == null || birthdayInput.length === 0) {
    return null;
  }
  const full = birthdayInput.slice(0, 10);
  return yearUnknown ? full.slice(5) : full;
}

/**
 * Seed the edit form from `getContactForEdit`: the fixed columns, the toggles
 * (0/1), the birthday split, and the custom-value map. Frequency starts valid
 * (a stored `interval_days` is always a positive integer). Last-spoke defaults to
 * "not-yet" so an untouched save on a never-contacted contact logs nothing.
 */
export function seedEditState(result: ContactForEdit): EditFormState {
  const c = result.contact;
  const { birthdayInput, birthdayYearUnknown } = parseBirthdayForForm(c.birthday);
  return {
    name: c.name,
    categoryId: c.category_id,
    intervalDays: c.interval_days,
    intervalValid: true,
    socialBattery: c.social_battery,
    birthdayInput,
    birthdayYearUnknown,
    phone: c.phone ?? "",
    email: c.email ?? "",
    rarelyResponds: c.rarely_responds,
    remindersOff: c.reminders_off,
    values: { ...result.values },
    lastSpoke: { kind: "not-yet" },
  };
}

/**
 * Can the form be saved? Name is the ONLY required field; an invalid custom
 * interval blocks Save so a non-positive interval never reaches the DAO.
 */
export function canSave(state: EditFormState): boolean {
  return state.name.trim().length > 0 && state.intervalValid;
}

/**
 * Build the atomic-edit input for `updateContactFull`. `phone`/`email` are
 * trimmed and empty->null; `name` is trimmed. The custom block is `editColNames`
 * mapped to the current values (a missing key -> null). A `firstInteraction` is
 * added ONLY when the contact is never-contacted AND the tri-state is Today/Pick
 * date (owner ruling); otherwise it is omitted and no interaction is written.
 */
export function buildEditInput(
  state: EditFormState,
  deps: BuildEditInputDeps,
): UpdateContactFullInput {
  const input: UpdateContactFullInput = {
    id: deps.contactId,
    name: state.name.trim(),
    intervalDays: state.intervalDays,
    now: deps.now,
    rarelyResponds: state.rarelyResponds,
    remindersOff: state.remindersOff,
    categoryId: state.categoryId,
    socialBattery: state.socialBattery,
    birthday: buildBirthdayForStorage(
      state.birthdayInput,
      state.birthdayYearUnknown,
    ),
    phone: state.phone.trim() || null,
    email: state.email.trim() || null,
    rowUid: deps.rowUid,
    customValues: deps.editColNames.map((col) => ({
      col,
      value: state.values[col] ?? null,
    })),
  };

  // LAST-SPOKE (owner ruling): never-contacted-only first-interaction path.
  if (deps.neverContacted) {
    const occurredAt = firstInteractionOccurredAt(state.lastSpoke, deps.now);
    if (occurredAt !== null) {
      input.firstInteraction = {
        uid: deps.interactionUid,
        occurredAt,
        source: "manual",
        direction: null,
      };
    }
  }
  return input;
}
