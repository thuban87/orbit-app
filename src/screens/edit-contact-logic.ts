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
  buildBirthdayForStorage,
  parseBirthdayForForm,
} from "@/components/birthday-field-logic";
import {
  type MethodGroups,
  seedMethodGroups,
  toMethodDrafts,
} from "@/components/contact-methods-editor-model";
import type { LastSpokeValue } from "@/components/tri-state-last-spoke-logic";
import type { ContactForEdit } from "@/db/contact-read";
import type {
  CreateCurrentStateInput,
  CreateMemoryInput,
  CreateOffLimitsInput,
  CreateRelationshipInput,
  EditMemoryPatch,
  EditOffLimitsPatch,
  EditRelationshipPatch,
  KnowledgeCollectionDiff,
  KnowledgeDeleteRef,
  UpdateContactFullInput,
} from "@/db/contacts-dao";
import type { MemoryProvenance } from "@/db/memories-dao";
import type { MemoryRow } from "@/db/memories-read";
import { DEFAULT_MEMORY_TYPE_KEY, isMemoryTypeKey } from "@/db/memory-registry";
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

/**
 * A Memory draft row (existing rows carry `id`; new rows omit it). It carries
 * the row's real `provenance` (D-25) and its Allow AI choice as draft state
 * (`allowAi`, D-27), plus two read-only lock markers copied from the row
 * (D-102, D-103): a form never writes them, and a locked row never asks for
 * Allow AI on. All are optional, so older hosts still compile.
 */
export type MemoryDraftRow = CreateMemoryInput & {
  id?: number;
  /** Read-only D-102 marker: a Group Note copy is AI-off for good. */
  readonly groupNoteCopy?: 0 | 1;
  /** Read-only D-103 marker: the linked note was locked AI-off for good. */
  readonly linkedNoteAiLocked?: 0 | 1;
};
/** A relationship draft row (existing rows carry `id`; new rows omit it). */
export type RelationshipDraftRow = CreateRelationshipInput & { id?: number };
/** An Off Limits draft row (existing rows carry `id`; new rows omit it). */
export interface OffLimitsDraftRow {
  id?: number;
  label?: string | null;
  text?: string | null;
  url?: string | null;
}

// =============================================================================
// MEMORY DRAFT ADAPTERS (D-25, D-27, D-102, D-103; checker cycle 2 W-1;
// convergence c1 F-U5). Pure and React-free: they mirror the memory editor's
// draft mapping field by field instead of importing MemoryEditor.tsx, so the
// node tests stay React-free. The forms seed, render and patch memory drafts
// through these three only, so provenance and both lock markers survive.
// =============================================================================

function flag(value: number | null | undefined): 0 | 1 {
  return value === 1 ? 1 : 0;
}

function provenanceOf(value: string): MemoryProvenance {
  return value === "import" || value === "share" ? value : "user";
}

/**
 * Seed a Memory draft row from a committed row: every editable field, the row
 * id, its real provenance (D-25), its Allow AI value (D-27) and both read-only
 * lock markers (D-102, D-103). The type mapping matches the memory editor's
 * `initialDraft`, so an untouched seeded row diffs equal.
 */
export function memoryRowToDraftRow(row: MemoryRow): MemoryDraftRow {
  return {
    type: isMemoryTypeKey(row.type) ? row.type : DEFAULT_MEMORY_TYPE_KEY,
    customLabel: row.custom_label ?? null,
    value: row.value ?? null,
    note: row.note ?? null,
    url: row.url ?? null,
    meaningfulDate: row.meaningful_date ?? null,
    pinned: row.pinned === 1,
    outdated: row.outdated === 1,
    hidden: row.hidden === 1 ? true : row.hidden === 0 ? false : null,
    id: row.id,
    provenance: provenanceOf(row.provenance),
    allowAi: flag(row.allow_ai),
    groupNoteCopy: flag(row.group_note_copy),
    linkedNoteAiLocked: flag(row.linked_note_ai_locked),
  };
}

/**
 * Render a Memory draft row back to the committed-row shape the memory editor
 * shows. Provenance falls back to `user` only for a draft that never had one
 * (a new row); the markers drive the locked Allow AI switch (W-1).
 */
export function memoryDraftRowToItem(
  row: MemoryDraftRow,
  contactId: number,
): MemoryRow {
  return {
    id: row.id ?? 0,
    uid: "",
    contact_id: contactId,
    type: row.type,
    custom_label: row.customLabel ?? null,
    value: row.value ?? null,
    note: row.note ?? null,
    url: row.url ?? null,
    meaningful_date: row.meaningfulDate ?? null,
    pinned: row.pinned ? 1 : 0,
    outdated: row.outdated ? 1 : 0,
    hidden: row.hidden == null ? null : row.hidden ? 1 : 0,
    provenance: row.provenance ?? "user",
    created_at: "",
    modified_at: "",
    deleted_at: null,
    allow_ai: row.allowAi ?? 0,
    interaction_id: null,
    link_source: null,
    group_note_copy: row.groupNoteCopy ?? 0,
    linked_note_ai_locked: row.linkedNoteAiLocked ?? 0,
  };
}

/**
 * Apply an in-form editor patch to a Memory draft row. The patch wins for
 * editable fields; the id, provenance and both lock markers always come from
 * the row, because the editor's patch never carries them (F-U5, Codex C-12).
 */
export function applyMemoryPatch(
  row: MemoryDraftRow,
  patch: MemoryDraftRow,
): MemoryDraftRow {
  const merged: MemoryDraftRow = { ...row, ...patch, id: row.id };
  const keep = {
    provenance: row.provenance,
    groupNoteCopy: row.groupNoteCopy,
    linkedNoteAiLocked: row.linkedNoteAiLocked,
  };
  const out: Record<string, unknown> = { ...merged };
  for (const [key, value] of Object.entries(keep)) {
    if (value === undefined) delete out[key];
    else out[key] = value;
  }
  if (row.id === undefined) delete out.id;
  return out as MemoryDraftRow;
}

/** True when either lock marker says this memory may never turn AI on. */
function isAiLocked(row: MemoryDraftRow | undefined): boolean {
  return row?.groupNoteCopy === 1 || row?.linkedNoteAiLocked === 1;
}

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
  /**
   * Whether `birthdayInput`'s year is only a placeholder (38.11 D-61, review
   * V-10; the shared Birthday control's `yearIsPlaceholder`). Seeded true for a
   * stored `MM-DD`. Display/control state only — never stored.
   */
  birthdayYearIsPlaceholder?: boolean;
  /** Ordered local method drafts, seeded from the normalized read boundary. */
  methods: MethodGroups;
  /** 0/1 — the "Rarely Responds" toggle. */
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
   * contract. A deleted row is simply absent from its draft until Save (D-104).
   */
  memories?: MemoryDraftRow[];
  relationships?: RelationshipDraftRow[];
  offLimits?: OffLimitsDraftRow[];
  /** "Last Talked About" entry text (blank → no write). */
  lastTalkedAbout?: string;
  /**
   * The local `YYYY-MM-DD` the user picked for a new Last Talked About entry.
   * Set only when the user explicitly added a dated entry; omitted means today.
   */
  lastTalkedAboutDate?: string;
  /** "Current Location" entry text (blank → no write). */
  currentLocation?: string;
  /** The picked local date for a new Current Location entry (see above). */
  currentLocationDate?: string;
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
   */
  seededMemories?: MemoryDraftRow[];
  seededRelationships?: RelationshipDraftRow[];
  seededOffLimits?: OffLimitsDraftRow[];
  seededCurrentState?: CurrentStateSeed;
}

/** A never-contacted contact (`last_contact IS NULL`) may set its first contact here. */
export function isNeverContacted(result: ContactForEdit): boolean {
  return result.contact.last_contact == null;
}

// The birthday storage helpers moved to the shared Birthday control's logic
// (38.11 D-61) so Add Contact can use them without an import cycle; they are
// re-exported here unchanged for every existing importer.
export {
  buildBirthdayForStorage,
  parseBirthdayForForm,
} from "@/components/birthday-field-logic";

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
    birthdayYearIsPlaceholder: birthdayYearUnknown,
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
 * Edit Contact's top-to-bottom reveal order for the inline field errors (38.9
 * D-19): Save scrolls to and focuses the first of these with an error.
 */
export const EDIT_FIELD_REVEAL_ORDER: readonly string[] = ["name", "frequency"];

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

/**
 * The comparable signature of a draft row (all fields EXCEPT the row `id`). A
 * key holding `undefined` reads the same as an absent key.
 */
function rowSignature(row: Record<string, unknown>): string {
  const { id: _id, ...rest } = row;
  const keys = Object.keys(rest)
    .filter((key) => rest[key] !== undefined)
    .sort();
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
  toEdit: (row: TRow & { id: number }, seeded: TRow) => TEdit,
): KnowledgeCollectionDiff<TAdd, TEdit> | undefined {
  const seedById = new Map<number, TRow>();
  for (const row of seed) {
    if (row.id != null) seedById.set(row.id, row);
  }

  const add: TAdd[] = [];
  const addTempIds: number[] = [];
  const edit: TEdit[] = [];
  const draftIds = new Set<number>();
  for (const row of draft) {
    if (row.id == null) {
      add.push(toAdd(row));
      if (row.id !== undefined) addTempIds.push(row.id);
      continue;
    }
    draftIds.add(row.id);
    const seeded = seedById.get(row.id);
    if (seeded === undefined) {
      // An id with no seeded match (should not happen) — treat as a new add.
      add.push(toAdd(row));
      if (row.id !== undefined) addTempIds.push(row.id);
      continue;
    }
    if (rowSignature(seeded) !== rowSignature(row)) {
      edit.push(toEdit(row as TRow & { id: number }, seeded));
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
  if (addTempIds.length > 0) result.addTempIds = addTempIds;
  if (edit.length > 0) result.edit = edit;
  if (del.length > 0) result.delete = del;
  return result;
}

/**
 * The current-state entries to append. A non-blank trimmed value becomes one
 * new dated entry when it differs from the seed, or when the user explicitly
 * added a dated entry. A value equal to its seed with no picked date writes
 * nothing, so an untouched save never appends a duplicate (checker cycle 5
 * W-5); the DAO appends every entry it receives (D-26, D-65).
 */
function currentStateEntriesDiff(
  state: EditFormState,
  seed: CurrentStateSeed,
): CreateCurrentStateInput[] {
  const entries: CreateCurrentStateInput[] = [];
  const consider = (
    fieldKey: "last_talked_about" | "current_location",
    draftValue: string | undefined,
    entryDate: string | undefined,
  ): void => {
    const value = draftValue?.trim();
    if (!value) return; // blank → no write (clearing is out of scope, as on create)
    if (value === seed[fieldKey] && entryDate === undefined) return; // unchanged
    entries.push(
      entryDate === undefined
        ? { fieldKey, value }
        : { fieldKey, value, entryDate },
    );
  };
  consider(
    "last_talked_about",
    state.lastTalkedAbout,
    state.lastTalkedAboutDate,
  );
  consider(
    "current_location",
    state.currentLocation,
    state.currentLocationDate,
  );
  return entries;
}

/**
 * A locked memory (Group Note copy, D-102; locked linked note, D-103) never
 * asks for Allow AI on: a draft value of 1 falls back to the seed's value (0
 * for a new row), so the diff can never emit `allowAi: 1` for it (W-1).
 */
function clampLockedAllowAi(
  row: MemoryDraftRow,
  seeded: MemoryDraftRow | undefined,
): MemoryDraftRow {
  if (row.allowAi !== 1 || !(isAiLocked(row) || isAiLocked(seeded))) {
    return row;
  }
  const fallback = seeded?.allowAi === 1 ? 1 : 0;
  return { ...row, allowAi: fallback };
}

/**
 * A new memory's add payload: the draft without its id, link fields or lock
 * markers (a form never writes them; D-102, D-103). `allowAi` is the user's
 * explicit choice (D-27), honoured by the DAO for provenance `user` only.
 */
function memoryAddPayload(row: MemoryDraftRow): CreateMemoryInput {
  const {
    id: _id,
    groupNoteCopy: _groupNoteCopy,
    linkedNoteAiLocked: _linkedNoteAiLocked,
    interactionId: _interactionId,
    linkSource: _linkSource,
    ...add
  } = row;
  if (isAiLocked(row) && add.allowAi === 1) add.allowAi = 0;
  return add;
}

/**
 * An existing memory's edit patch: the editable fields plus `allowAi` only
 * when the draft's choice differs from the seed (D-27). Provenance, link
 * fields and lock markers are never sent: a form edit keeps the stored ones
 * (D-25, D-102, D-103).
 */
function memoryEditPatch(
  row: MemoryDraftRow & { id: number },
  seeded: MemoryDraftRow,
): EditMemoryPatch {
  const {
    allowAi,
    groupNoteCopy: _groupNoteCopy,
    linkedNoteAiLocked: _linkedNoteAiLocked,
    provenance: _provenance,
    interactionId: _interactionId,
    linkSource: _linkSource,
    ...patch
  } = row;
  if (allowAi === undefined || allowAi === seeded.allowAi) return patch;
  if (allowAi === 1 && (isAiLocked(row) || isAiLocked(seeded))) return patch;
  return { ...patch, allowAi };
}

/** An Off Limits draft's id and content fields, dropping any extra keys. */
function offLimitsDraftContent(row: OffLimitsDraftRow): OffLimitsDraftRow {
  const out: OffLimitsDraftRow = {};
  if (row.id !== undefined) out.id = row.id;
  if (row.label !== undefined) out.label = row.label;
  if (row.text !== undefined) out.text = row.text;
  if (row.url !== undefined) out.url = row.url;
  return out;
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
 * subdomain is omitted entirely. A deleted row is held in the draft (absent)
 * until Save, which then hard-deletes it with a tombstone (D-104, D-69).
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
    const seededMemories = deps.seededMemories ?? [];
    const seedById = new Map<number, MemoryDraftRow>();
    for (const row of seededMemories) {
      if (row.id != null) seedById.set(row.id, row);
    }
    const diff = diffKnowledgeCollection<
      MemoryDraftRow,
      CreateMemoryInput,
      EditMemoryPatch
    >(
      seededMemories,
      state.memories.map((row) =>
        clampLockedAllowAi(
          row,
          row.id != null ? seedById.get(row.id) : undefined,
        ),
      ),
      memoryAddPayload,
      memoryEditPatch,
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
    // Off Limits rows live in their own table, so every row in this diff is
    // Off Limits whatever extra keys a host's draft carries (D-11; NEW-1).
    // Only the content fields are compared and sent.
    const diff = diffKnowledgeCollection<
      OffLimitsDraftRow,
      CreateOffLimitsInput,
      EditOffLimitsPatch
    >(
      (deps.seededOffLimits ?? []).map(offLimitsDraftContent),
      state.offLimits.map(offLimitsDraftContent),
      ({ id: _id, ...add }) => add,
      (row) => ({ ...row }),
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

// =============================================================================
// SAVE EXIT (38.11 D-26, follows D-13).
// =============================================================================

/** The slice of a stack navigation state the save exit reads. */
export interface EditExitNavState {
  routes: ReadonlyArray<{ name: string; params?: object | undefined }>;
  index: number;
}

/** Where a saved Edit Contact goes. */
export type EditSaveExit =
  | { kind: "go-back" }
  | { kind: "replace"; name: "Profile"; params: { contactId: number } };

/** Routes an Edit can return to when they belong to the edited contact. */
const EDIT_RETURN_ROUTES: ReadonlySet<string> = new Set(["Profile", "Compose"]);

/**
 * Where Edit Contact's Save lands (38.11 D-26, D-13). Go back when the route
 * before Edit is this contact's Profile or Compose (Compose re-reads on
 * focus); otherwise replace the finished Edit with this contact's Profile. No
 * path pushes a second Profile or leaves the Edit form under one, so a later
 * Bin/archive `goBack` from that Profile cannot land on a stale Edit. Never
 * `popTo`: it matches the nearest route by name regardless of params and can
 * land on another contact's Profile (StackRouter, RESEARCH section 8). PURE.
 */
export function resolveEditSaveExit(
  state: EditExitNavState | undefined,
  contactId: number,
): EditSaveExit {
  const previous = state ? state.routes[state.index - 1] : undefined;
  const previousContactId =
    previous?.params && "contactId" in previous.params
      ? (previous.params as { contactId?: unknown }).contactId
      : undefined;
  if (
    previous &&
    EDIT_RETURN_ROUTES.has(previous.name) &&
    previousContactId === contactId
  ) {
    return { kind: "go-back" };
  }
  return { kind: "replace", name: "Profile", params: { contactId } };
}

/**
 * The Bound/Unbound chips on Edit Contact (38.12 D-34, C-7). A person in the
 * Bin cannot change Orbit participation — `updateContactFull` refuses it — so
 * the chips are disabled and dimmed (38.9 D-26 via 38.12 D-06). PURE.
 */
export function participationChoice(archivedAt: string | null): {
  disabled: boolean;
  dimmed: boolean;
} {
  const inBin = archivedAt !== null;
  return { disabled: inBin, dimmed: inBin };
}
