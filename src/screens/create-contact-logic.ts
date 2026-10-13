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
  emptyMethodDraft,
  type MethodGroups,
  toMethodDrafts,
} from "@/components/contact-methods-editor-model";
import type { LastSpokeValue } from "@/components/tri-state-last-spoke-logic";
import {
  isSavableEntry,
  normalizeEntryText,
} from "@/components/ui/entry-text-logic";
import type {
  CreateContactFullInput,
  CreateCurrentStateInput,
  CreateMemoryInput,
  CreateOffLimitsInput,
  CreateRelationshipInput,
} from "@/db/contacts-dao";
import { newUid } from "@/db/uid";

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
  /**
   * Show-More enrichment drafts (CAPT-01) — all OPTIONAL; omitting them preserves
   * the lean name-only create path. Assembled by `buildCreateInput` into the
   * atomic `createContactFull` transaction (ADR-016). Elements carry the SEMANTIC
   * fields only — the DAO injects the framework set post-insert.
   */
  memories?: CreateMemoryInput[];
  relationships?: CreateRelationshipInput[];
  /** "Last Talked About" entry text (blank → omitted). */
  lastTalkedAbout?: string;
  /** The local `YYYY-MM-DD` picked for that entry; omitted means today (D-65). */
  lastTalkedAboutDate?: string;
  /** "Current Location" entry text (blank → omitted). */
  currentLocation?: string;
  /** The local `YYYY-MM-DD` picked for that entry; omitted means today (D-65). */
  currentLocationDate?: string;
  /** Off Limits drafts — always written as Off Limits (D-11; NEW-1). */
  offLimits?: CreateOffLimitsInput[];
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

// =============================================================================
// VALIDATION REVEAL-AND-FOCUS (CAPT-14, dossier §AD).
//
// A blocking validation error must REVEAL + FOCUS the AccordionSection that
// contains it rather than leaving the user hunting collapsed drawers. The
// error→section resolution is a PURE, node-tested mapping so the contract is
// proven at the node level (not only device UAT); the screen then drives the
// AccordionSection validation interface (expand via onExpandedChange + scroll to
// the registered container ref). The SAME resolver shape is reused by 34-08.
// =============================================================================

/** One blocking validation error, keyed by a stable field id. */
export interface ValidationError {
  field: string;
  message?: string;
}

/** Maps a field id to the AccordionSection `sectionId` that contains it. */
export type SectionFieldMap = Record<string, string>;

/**
 * The Add-Contact field→section map. Field ids are stable across the form; the
 * values are the `AccordionSection` sectionIds rendered by CreateContactScreen.
 */
export const CREATE_SECTION_FIELD_MAP: SectionFieldMap = {
  name: "identity",
  frequency: "relationship",
  phone: "methods",
  email: "methods",
};

/**
 * Add Contact's top-to-bottom reveal order for the inline field errors (38.9
 * D-19): Save scrolls to and focuses the first of these with an error.
 */
export const CREATE_FIELD_REVEAL_ORDER: readonly string[] = [
  "name",
  "frequency",
];

/**
 * The `sectionId` owning the FIRST blocking validation error in the array's
 * deterministic order, or `null` when there are no (mapped) blocking errors. An
 * error whose field is not in the map is skipped (resolve the next mapped one).
 * Pure — react-native-free — so error→section resolution is unit-tested.
 */
export function resolveErrorSection(
  errors: ValidationError[],
  sectionFieldMap: SectionFieldMap,
): string | null {
  for (const error of errors) {
    const sectionId = sectionFieldMap[error.field];
    if (sectionId) return sectionId;
  }
  return null;
}

/**
 * The blocking validation errors for the Add-Contact form, in reveal order:
 * name first (Identity), then an invalid cadence WHILE Bound (Relationship
 * Basics). Mirrors `canSave` — Unbound never blocks on cadence — but yields the
 * per-field detail `resolveErrorSection` routes to a section. Empty = savable.
 */
export function collectBlockingErrors(
  state: CreateFormState,
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

/** An Off Limits draft's content fields only (label, text, url). */
function offLimitsContent(row: CreateOffLimitsInput): CreateOffLimitsInput {
  const out: CreateOffLimitsInput = {};
  if (row.label !== undefined) out.label = row.label;
  if (row.text !== undefined) out.text = row.text;
  if (row.url !== undefined) out.url = row.url;
  return out;
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

  // Show-More enrichment — only set each array when non-empty so a name-only
  // create stays lean (omitting all enrichment). Every element carries the
  // semantic fields only; the DAO injects the framework set post-insert.
  const memories = state.memories ?? [];
  if (memories.length > 0) input.memories = memories;
  const relationships = state.relationships ?? [];
  if (relationships.length > 0) input.relationships = relationships;
  // Dated entries (D-65): the picked date when there is one, else the DAO
  // dates the entry today.
  const currentStateEntries: CreateCurrentStateInput[] = [];
  const addEntry = (
    fieldKey: CreateCurrentStateInput["fieldKey"],
    text: string | undefined,
    entryDate: string | undefined,
  ): void => {
    const value = text?.trim();
    if (!value) return;
    currentStateEntries.push(
      entryDate === undefined
        ? { fieldKey, value }
        : { fieldKey, value, entryDate },
    );
  };
  addEntry(
    "last_talked_about",
    state.lastTalkedAbout,
    state.lastTalkedAboutDate,
  );
  addEntry(
    "current_location",
    state.currentLocation,
    state.currentLocationDate,
  );
  if (currentStateEntries.length > 0) {
    input.currentStateEntries = currentStateEntries;
  }
  // Only the content fields go through; any extra key a host's draft carries
  // (an old kind or source) never reaches the DAO (D-11; NEW-1).
  const offLimits = (state.offLimits ?? []).map(offLimitsContent);
  if (offLimits.length > 0) input.offLimits = offLimits;

  return input;
}

// =============================================================================
// UNSAVED-WORK GUARD (38.9 D-13, D-15, E-01).
//
// Add Contact is dirty only when the form differs from its SEED values. The
// baseline is built from `createFormSeedState()`, never from live form state,
// so the guard is on from the first render: a name typed before categories or
// the form data load is dirty, a failed load leaves the guard on, and a
// category-catalog refresh (which can only clear a pick that no longer exists,
// moving `categoryId` toward its null seed) never makes the form dirty. A later
// phase that adds an asynchronously resolved default (38.11 D-50/D-51) must
// update this seed and the field together, touching the field only while it is
// untouched.
// =============================================================================

/** The seed form state: what an untouched Add Contact holds. */
export type CreateFormSeedState = CreateFormState &
  Required<
    Pick<
      CreateFormState,
      | "trackingEnabled"
      | "memories"
      | "relationships"
      | "lastTalkedAbout"
      | "currentLocation"
      | "offLimits"
    >
  >;

/**
 * The Add Contact seeds. Unbound with no cadence (CAPT-03), last spoke today,
 * one empty phone row (its uid is generated; the signature ignores it), no
 * email, no custom values, no enrichment drafts.
 */
export function createFormSeedState(): CreateFormSeedState {
  return {
    name: "",
    categoryId: null,
    intervalDays: null,
    intervalValid: true,
    trackingEnabled: false,
    lastSpoke: { kind: "today" },
    methods: { phone: [emptyMethodDraft("phone", newUid())], email: [] },
    values: {},
    memories: [],
    relationships: [],
    lastTalkedAbout: "",
    currentLocation: "",
    offLimits: [],
  };
}

/** JSON with object keys sorted, so key order never reads as a change. */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) => {
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      const record = inner as Record<string, unknown>;
      return Object.fromEntries(
        Object.keys(record)
          .sort()
          .map((key) => [key, record[key]]),
      );
    }
    return inner;
  });
}

/**
 * A stable signature of the form for the dirty check: method-draft uids are
 * stripped (generated row ids are not user changes) and the asynchronously
 * resolved phone region is not part of `CreateFormState`, so it never counts.
 */
export function createFormSeedSignature(state: CreateFormState): string {
  const stripUid = (drafts: MethodGroups["phone"]) =>
    drafts.map(({ uid: _uid, ...rest }) => rest);
  return stableStringify({
    ...state,
    trackingEnabled: state.trackingEnabled ?? true,
    memories: state.memories ?? [],
    relationships: state.relationships ?? [],
    lastTalkedAbout: state.lastTalkedAbout ?? "",
    currentLocation: state.currentLocation ?? "",
    offLimits: state.offLimits ?? [],
    methods: {
      phone: stripUid(state.methods.phone),
      email: stripUid(state.methods.email),
    },
  });
}

/** Add Contact holds unsaved work when its signature differs from the seed's. */
export function isCreateFormDirty(
  seedSignature: string,
  currentSignature: string,
): boolean {
  return seedSignature !== currentSignature;
}

/** An in-section editor's reported draft state (MemoryEditor / RelationshipEditor / the inline Off Limits editor). */
export interface DraftState {
  open: boolean;
  dirty: boolean;
}

export type PickedSubEditor =
  | { open: false; dirty: false; which: null }
  | {
      open: true;
      dirty: true;
      which:
        | "memory"
        | "relationship"
        | "offLimits"
        | "giftIdeas"
        | "thoughtOfThem"
        | "imported";
    };

const CLOSED_DRAFT_STATE: DraftState = { open: false, dirty: false };

/**
 * The open draft that holds Back on Add Contact and Edit Contact (C5-M1;
 * D-13, D-14): only a draft that is both open and typed into counts, so an
 * empty open draft never holds the user. The first such draft in the fixed
 * order memory, relationship, Off Limits, Gift Ideas, Thought of Them,
 * Imported (this plan only) is closed first. Last Talked About and Current
 * Location have no draft (38.10 D-119): their typed text is form dirt.
 * `imported` is Edit Contact only (D-116); Add Contact leaves it closed.
 */
export function pickCreateSubEditor({
  memory,
  relationship,
  offLimits = CLOSED_DRAFT_STATE,
  giftIdeas = CLOSED_DRAFT_STATE,
  thoughtOfThem = CLOSED_DRAFT_STATE,
  imported = CLOSED_DRAFT_STATE,
}: {
  memory: DraftState;
  relationship: DraftState;
  /** The inline Off Limits editor's add or edit draft (38.9 review CR-01). */
  offLimits?: DraftState;
  /** The Gift Ideas section's memory draft (38.10 plan 14). */
  giftIdeas?: DraftState;
  /** The Thought of Them section's memory draft (38.10 plan 14). */
  thoughtOfThem?: DraftState;
  /** Edit Contact's Imported from Contacts App edit draft (D-116). */
  imported?: DraftState;
}): PickedSubEditor {
  const ordered = [
    ["memory", memory],
    ["relationship", relationship],
    ["offLimits", offLimits],
    ["giftIdeas", giftIdeas],
    ["thoughtOfThem", thoughtOfThem],
    ["imported", imported],
  ] as const;
  for (const [which, state] of ordered) {
    if (state.open && state.dirty) return { open: true, dirty: true, which };
  }
  return { open: false, dirty: false, which: null };
}

// =============================================================================
// THINGS TO REMEMBER SECTIONS ON ADD / EDIT CONTACT (38.10 plan 14).
// =============================================================================

/** The memory rows each form section shows (D-65, D-116). */
export interface MemoryRowBuckets<T> {
  memories: T[];
  giftIdeas: T[];
  thoughtOfThem: T[];
  imported: T[];
}

/**
 * Split the form's single memory list into its sections (convergence c3,
 * Claude C-02; D-116): `general` → Memories, `gift_idea` → Gift Ideas,
 * `thought_of_them` → Thought of Them, `imported` → its own bucket, and any
 * other type → Memories (this plan only). Each bucket keeps input order and
 * the rows themselves (ids included). Hosts call it during render, so a row
 * retyped in the Memories section shows in its new section next render.
 * PURE.
 */
export function partitionMemoryRows<T extends { type: string }>(
  rows: readonly T[],
): MemoryRowBuckets<T> {
  const buckets: MemoryRowBuckets<T> = {
    memories: [],
    giftIdeas: [],
    thoughtOfThem: [],
    imported: [],
  };
  for (const row of rows) {
    if (row.type === "gift_idea") buckets.giftIdeas.push(row);
    else if (row.type === "thought_of_them") buckets.thoughtOfThem.push(row);
    else if (row.type === "imported") buckets.imported.push(row);
    else buckets.memories.push(row);
  }
  return buckets;
}

/**
 * An Add Contact draft with a stable id (convergence c7, Claude C-04 /
 * Cursor CU-02). Ids come from a decrementing counter, so they never shift
 * when another draft is removed.
 */
export interface DraftItem<D> {
  id: number;
  draft: D;
}

/** Append a draft under its new id. PURE. */
export function addDraftItem<D>(
  items: readonly DraftItem<D>[],
  draft: D,
  id: number,
): DraftItem<D>[] {
  return [...items, { id, draft }];
}

/** Replace the draft whose id matches; no match leaves the list as it was. PURE. */
export function replaceDraftItem<D>(
  items: readonly DraftItem<D>[],
  id: number,
  draft: D,
): DraftItem<D>[] {
  return items.map((item) => (item.id === id ? { id, draft } : item));
}

/** Remove the draft whose id matches. PURE. */
export function removeDraftItem<D>(
  items: readonly DraftItem<D>[],
  id: number,
): DraftItem<D>[] {
  return items.filter((item) => item.id !== id);
}

/** The inline Off Limits form's typed fields (D-66 text, optional label). */
export interface OffLimitsFormDraft {
  text: string;
  label: string;
}

/** The form as it opens for a row (edit) or blank (add). PURE. */
export function offLimitsFormDraft(row?: {
  text?: string | null;
  label?: string | null;
}): OffLimitsFormDraft {
  return { text: row?.text ?? "", label: row?.label ?? "" };
}

/**
 * Whether the open Off Limits form differs from what it opened with (38.9
 * D-14): text compares after the save-time normalising, so typed-then-erased
 * reads as untouched. PURE.
 */
export function isOffLimitsFormDirty(
  baseline: OffLimitsFormDraft,
  draft: OffLimitsFormDraft,
): boolean {
  return (
    normalizeEntryText(baseline.text) !== normalizeEntryText(draft.text) ||
    baseline.label.trim() !== draft.label.trim()
  );
}

/**
 * Whether the Off Limits form can be saved: text or a label, or an existing
 * row's stored link (the DAO needs one of label, text or url). PURE.
 */
export function canSaveOffLimitsForm(
  draft: OffLimitsFormDraft,
  storedUrl?: string | null,
): boolean {
  return (
    isSavableEntry(draft.text) ||
    draft.label.trim().length > 0 ||
    (storedUrl ?? "").trim().length > 0
  );
}

/** The trimmed fields handed to the host; blank becomes null. PURE. */
export function normalizeOffLimitsForm(draft: OffLimitsFormDraft): {
  text: string | null;
  label: string | null;
} {
  const text = normalizeEntryText(draft.text);
  const label = draft.label.trim();
  return {
    text: text.length > 0 ? text : null,
    label: label.length > 0 ? label : null,
  };
}
