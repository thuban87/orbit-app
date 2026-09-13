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

import {
  type MethodGroups,
  seedMethodGroups,
  toMethodDrafts,
} from "@/components/contact-methods-editor-model";
import type { LastSpokeValue } from "@/components/tri-state-last-spoke-logic";
import type { ContactForEdit } from "@/db/contact-read";
import type {
  CreateCurrentStateInput,
  CreateFuelInput,
  CreateMemoryInput,
  CreateRelationshipInput,
  EditFuelPatch,
  EditMemoryPatch,
  EditRelationshipPatch,
  KnowledgeCollectionDiff,
  KnowledgeDeleteRef,
  UpdateContactFullInput,
} from "@/db/contacts-dao";
import {
  firstInteractionOccurredAt,
  resolveErrorSection,
  type SectionFieldMap,
  type ValidationError,
} from "./create-contact-logic";

export type { SectionFieldMap, ValidationError };
// Re-export the shared pure resolver + its types so 34-08 (and its tests) can
// import the reveal-and-focus contract from the edit surface directly.
export { resolveErrorSection };

// =============================================================================
// KNOWLEDGE-SUBDOMAIN DRAFT ROWS (CAPT-04, dossier §E).
//
// A collection draft row is the create-path semantic shape PLUS an optional row
// `id`: an EXISTING seeded row carries its `id`, a NEW row omits it. `buildEditInput`
// diffs the current draft against the seeded baseline (same shape) into the pinned
// `{ add, edit, delete }` contract `updateContactFull` applies — the DAO never
// re-diffs (Review cycle-3 LOW).
// =============================================================================

/** A Memory draft row (existing rows carry `id`; new rows omit it). */
export type MemoryDraftRow = CreateMemoryInput & { id?: number };
/** A relationship draft row (existing rows carry `id`; new rows omit it). */
export type RelationshipDraftRow = CreateRelationshipInput & { id?: number };
/** An off-limits fuel draft row (existing rows carry `id`; new rows omit it). */
export type FuelDraftRow = CreateFuelInput & { id?: number };

/** The two current-state fields, keyed for the seeded baseline comparison. */
export type CurrentStateSeed = Partial<
  Record<"last_talked_about" | "current_location", string>
>;

/** The edit form's controlled state (the screen owns the React state). */
export interface EditFormState {
  name: string;
  categoryId: number | null;
  /** The FrequencyPicker's emitted interval_days. */
  intervalDays: number | null;
  /** The FrequencyPicker's validity — false blocks Save. */
  intervalValid: boolean;
  trackingEnabled?: boolean;
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
  /** Ordered local method drafts, seeded from the normalized read boundary. */
  methods: MethodGroups;
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
  /**
   * Knowledge-subdomain drafts (CAPT-04, dossier §E) — all OPTIONAL; omitting them
   * preserves the lean metadata+custom-values edit. `buildEditInput` diffs each
   * against its seeded baseline (deps.seeded*) into the `{ add, edit, delete }`
   * contract. `offLimits` rows are off_limits fuel only (kind forced by the diff).
   */
  memories?: MemoryDraftRow[];
  relationships?: RelationshipDraftRow[];
  offLimits?: FuelDraftRow[];
  /** Single current value for "Last talked about" (blank → no write). */
  lastTalkedAbout?: string;
  /** Single current value for "Current location" (blank → no write). */
  currentLocation?: string;
}

/** Caller-supplied non-deterministic inputs, so the builder stays pure/testable. */
export interface BuildEditInputDeps {
  /** Local wall-clock now — `localDateTime()`. */
  now: string;
  /** The contact being edited. */
  contactId: number;
  /** The first-interaction uid — `newUid()` (unused unless never-contacted + Today/date). */
  interactionUid: string;
  /** `defsForEditForm(defs)` — EVERY non-quarantined normalized definition pair. */
  editDefs: Array<{ id: number; col_name: string }>;
  /** The seeded `contact.last_contact IS NULL` flag — gates the firstInteraction path. */
  neverContacted: boolean;
  effectivePhoneRegion: string | null;
  /**
   * Seeded knowledge baselines (same draft shape) the current draft is diffed
   * against. Omitted baselines are treated as empty (every draft row is an add).
   * `seededOffLimits` is DEFENSIVELY re-filtered to `kind === "off_limits"` inside
   * `buildEditInput` — see the off-limits kind-scope note (Review cycle-4 MEDIUM #3).
   */
  seededMemories?: MemoryDraftRow[];
  seededRelationships?: RelationshipDraftRow[];
  seededOffLimits?: FuelDraftRow[];
  seededCurrentState?: CurrentStateSeed;
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
  const { birthdayInput, birthdayYearUnknown } = parseBirthdayForForm(
    c.birthday,
  );
  return {
    name: c.name,
    categoryId: c.category_id,
    intervalDays: c.interval_days,
    intervalValid: true,
    trackingEnabled: c.trackingEnabled === 1,
    socialBattery: c.social_battery,
    birthdayInput,
    birthdayYearUnknown,
    methods: seedMethodGroups(result.methods),
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
  return (
    state.name.trim().length > 0 &&
    (state.trackingEnabled === false || state.intervalValid)
  );
}

// =============================================================================
// VALIDATION REVEAL-AND-FOCUS (Edit Contact) — reuses the SAME pure resolver as
// the create surface (34-03). Only blocking-error-producing fields need a map
// entry; the map is the section↔field contract 34-08's AccordionSections drive.
// =============================================================================

/**
 * The Edit-Contact field→section map. Only fields that can raise a BLOCKING save
 * error need an entry (name, cadence). The knowledge subdomains raise no blocking
 * validation today, so they carry no entry — an unmapped error is skipped by the
 * shared `resolveErrorSection` and the next mapped error resolves.
 */
export const EDIT_SECTION_FIELD_MAP: SectionFieldMap = {
  name: "identity",
  frequency: "relationship",
  phone: "methods",
  email: "methods",
};

/**
 * The blocking validation errors for the Edit-Contact form, in reveal order: name
 * first (Identity), then an invalid cadence WHILE Bound (Relationship Basics).
 * Mirrors `canSave`; empty = savable. Yields the per-field detail
 * `resolveErrorSection` routes to a section.
 */
export function collectEditBlockingErrors(
  state: EditFormState,
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (state.name.trim().length === 0) {
    errors.push({ field: "name", message: "Enter a name to save." });
  }
  if (state.trackingEnabled !== false && !state.intervalValid) {
    errors.push({ field: "frequency", message: "Pick a valid frequency." });
  }
  return errors;
}

/** The comparable signature of a draft row (all fields EXCEPT the row `id`). */
function rowSignature(row: Record<string, unknown>): string {
  const { id: _id, ...rest } = row;
  const keys = Object.keys(rest).sort();
  return JSON.stringify(keys.map((key) => [key, rest[key]]));
}

/**
 * Diff a knowledge collection's seeded baseline vs the current draft into the
 * pinned `{ add, edit, delete }` contract, keyed by row-identity `id`:
 *   • a draft row with NO `id` → `add`;
 *   • a draft row whose `id` exists in the seed AND whose signature changed → `edit`
 *     (edited in place — never a duplicate add);
 *   • a seeded `id` absent from the draft → `delete`.
 * Returns `undefined` when nothing changed (the subdomain is then omitted from the
 * edit input — an untouched subdomain writes nothing). The DAO applies these lists
 * and never re-diffs.
 */
function diffKnowledgeCollection<TRow extends { id?: number }, TAdd, TEdit>(
  seed: TRow[],
  draft: TRow[],
  toAdd: (row: TRow) => TAdd,
  toEdit: (row: TRow & { id: number }) => TEdit,
): KnowledgeCollectionDiff<TAdd, TEdit> | undefined {
  const seedById = new Map<number, TRow>();
  for (const row of seed) {
    if (row.id != null) seedById.set(row.id, row);
  }

  const add: TAdd[] = [];
  const edit: TEdit[] = [];
  const draftIds = new Set<number>();
  for (const row of draft) {
    if (row.id == null) {
      add.push(toAdd(row));
      continue;
    }
    draftIds.add(row.id);
    const seeded = seedById.get(row.id);
    if (seeded === undefined) {
      // An id with no seeded match (should not happen) — treat as a new add.
      add.push(toAdd(row));
      continue;
    }
    if (rowSignature(seeded) !== rowSignature(row)) {
      edit.push(toEdit(row as TRow & { id: number }));
    }
  }

  const del: KnowledgeDeleteRef[] = [];
  for (const id of seedById.keys()) {
    if (!draftIds.has(id)) del.push({ id });
  }

  if (add.length === 0 && edit.length === 0 && del.length === 0)
    return undefined;
  const result: KnowledgeCollectionDiff<TAdd, TEdit> = {};
  if (add.length > 0) result.add = add;
  if (edit.length > 0) result.edit = edit;
  if (del.length > 0) result.delete = del;
  return result;
}

/** The current-state entries whose trimmed draft value is non-blank AND changed. */
function currentStateEntriesDiff(
  state: EditFormState,
  seed: CurrentStateSeed,
): CreateCurrentStateInput[] {
  const entries: CreateCurrentStateInput[] = [];
  const consider = (
    fieldKey: "last_talked_about" | "current_location",
    draftValue: string | undefined,
  ): void => {
    const value = draftValue?.trim();
    if (!value) return; // blank → no write (clearing is out of scope, as on create)
    if (value === seed[fieldKey]) return; // unchanged → no history row
    entries.push({ fieldKey, value });
  };
  consider("last_talked_about", state.lastTalkedAbout);
  consider("current_location", state.currentLocation);
  return entries;
}

/**
 * Build the atomic-edit input for `updateContactFull`. Blank controls are
 * discarded while nonblank invalid method drafts remain durable; `name` is trimmed. The custom block is `editDefs`
 * mapped to the current values (a missing key -> null). A `firstInteraction` is
 * added ONLY when the contact is never-contacted AND the tri-state is Today/Pick
 * date (owner ruling); otherwise it is omitted and no interaction is written.
 *
 * Knowledge subdomains (CAPT-04, dossier §E): each draft is diffed against its
 * seeded baseline into the pinned `{ add, edit, delete }` contract; an untouched
 * subdomain is omitted entirely. The `offLimits` diff is KIND-SCOPED — the seed is
 * defensively filtered to `kind === "off_limits"` and every add/edit forces
 * `kind:"off_limits"` so a `recent`/`topic`/`fact`/`gift` row can NEVER appear in
 * the off_limits diff (Review cycle-4 MEDIUM #3, DATA LOSS).
 */
export function buildEditInput(
  state: EditFormState,
  deps: BuildEditInputDeps,
): UpdateContactFullInput {
  const input: UpdateContactFullInput = {
    id: deps.contactId,
    name: state.name.trim(),
    intervalDays: state.intervalDays,
    trackingEnabled: state.trackingEnabled !== false,
    now: deps.now,
    rarelyResponds: state.rarelyResponds,
    remindersOff: state.remindersOff,
    categoryId: state.categoryId,
    socialBattery: state.socialBattery,
    birthday: buildBirthdayForStorage(
      state.birthdayInput,
      state.birthdayYearUnknown,
    ),
    methodDrafts: toMethodDrafts(state.methods),
    methodNormalization: {
      effectivePhoneRegion: deps.effectivePhoneRegion,
    },
    customValues: deps.editDefs.map((definition) => ({
      fieldDefId: definition.id,
      value: state.values[definition.col_name] ?? null,
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

  // KNOWLEDGE SUBDOMAINS (CAPT-04, §E) — diff each draft vs its seeded baseline
  // into the pinned {add,edit,delete} contract; omit an untouched subdomain.
  if (state.memories !== undefined) {
    const diff = diffKnowledgeCollection<
      MemoryDraftRow,
      CreateMemoryInput,
      EditMemoryPatch
    >(
      deps.seededMemories ?? [],
      state.memories,
      ({ id: _id, ...add }) => add,
      (row) => ({ ...row }),
    );
    if (diff) input.memories = diff;
  }

  if (state.relationships !== undefined) {
    const diff = diffKnowledgeCollection<
      RelationshipDraftRow,
      CreateRelationshipInput,
      EditRelationshipPatch
    >(
      deps.seededRelationships ?? [],
      state.relationships,
      ({ id: _id, ...add }) => add,
      (row) => ({ ...row }),
    );
    if (diff) input.relationships = diff;
  }

  if (state.offLimits !== undefined) {
    // KIND-SCOPE both sides to off_limits (DATA LOSS guard, cycle-4 MEDIUM #3):
    // filter the seed defensively and force kind on every add/edit, so no
    // recent/topic/fact/gift row can ever land in the off_limits diff.
    const seededOffLimits = (deps.seededOffLimits ?? []).filter(
      (row) => row.kind === "off_limits",
    );
    const draftOffLimits = state.offLimits.filter(
      (row) => row.kind === "off_limits",
    );
    const diff = diffKnowledgeCollection<
      FuelDraftRow,
      CreateFuelInput,
      EditFuelPatch
    >(
      seededOffLimits,
      draftOffLimits,
      ({ id: _id, ...add }) => ({ ...add, kind: "off_limits" }),
      (row) => ({ ...row, kind: "off_limits" }),
    );
    if (diff) input.offLimits = diff;
  }

  const currentStateEntries = currentStateEntriesDiff(
    state,
    deps.seededCurrentState ?? {},
  );
  if (currentStateEntries.length > 0) {
    input.currentStateEntries = currentStateEntries;
  }

  return input;
}
