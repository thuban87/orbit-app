/**
 * Composed atomic-create DAO (CRUD-01 / CRUD-02) — the phase's central
 * architectural task (RESEARCH Pattern 2).
 *
 * `createContactFull` writes a contact row + (for the Today / Pick-date path) its
 * first interaction through the single-writer recompute + normalized custom
 * values — ALL in ONE `inWriteTransaction`. It COMPOSES the non-mutexed
 * cores extracted from the recency + field-values DAOs; it must NEVER call the
 * wrapped `createContactWithInteraction` / `upsertValue` (each opens its own
 * `inWriteTransaction`, and the shared mutex is NON-REENTRANT — nesting it is a
 * PERMANENT hang; transaction.ts, RESEARCH Pitfall 1 / review HIGH-1).
 *
 * =============================================================================
 * COMPOSITION CONTRACT — READ BEFORE EDITING:
 *   • Enter the mutex EXACTLY ONCE (one `inWriteTransaction`). Inside, call the
 *     `*Core` variants only — `insertInteractionCore`, `recomputeLastContactCore`
 *     (recency-dao), `upsertValueCore` (field-values-dao) — each assumes BEGIN is
 *     already open and takes no mutex.
 *   • `last_contact` is written ONLY via `recomputeLastContactCore` — the
 *     single-writer invariant (DATA-04) stays intact.
 *   • The first interaction is `source='manual'`, `direction=null` (defaults in
 *     `insertInteractionCore`) — never `outbound`, which would pollute intensity
 *     math (T-04-04).
 *   • A throw ANYWHERE in the body (invalid custom-value definition, UNIQUE clash, …)
 *     rolls back the contact + interaction + values TOGETHER — one transaction,
 *     not two (T-04-03; proven by the mid-composition ROLLBACK test).
 * =============================================================================
 *
 * PRE-TRANSACTION GUARDS (return a rejected Promise so no transaction opens and a
 * caller's `.catch()` sees them — mirrors recency-dao.ts):
 *   1. `interval_days` must be a positive integer (WR-02 — a 0/negative interval
 *      makes PROGRESS_SQL NULL and the row buckets 'stable' forever; migration 1
 *      is irreversible so the guard lives in TS).
 *   2. When `firstInteraction` is supplied, its `occurredAt` must be <= `now`
 *      (CRUD-02 — a future `occurred_at`→`last_contact` would pin the contact
 *      permanently 'stable'; enforced at the DAO chokepoint, defence-in-depth
 *      behind the UI). Both are local `YYYY-MM-DD HH:MM:SS` strings, so a lexical
 *      `>` comparison is a correct chronological future-date check.
 *   3. A non-null `birthday` must pass `isValidStoredBirthday` (`MM-DD` or a
 *      real `YYYY-MM-DD`; 38.11 D-48) — the single birthday validator.
 *
 * CREATE COLUMNS: scalar phone/email were retired by migration 009 (methods are
 * normalized rows). `birthday` and `social_battery` ARE written by the create
 * INSERT since 38.11 D-48 (Add Contact offers them behind Show More; this
 * supersedes the old "edit-only per 06-crud Cluster A" exclusion), and the
 * form's links join the SAME create transaction through `addLinksCore`. All are
 * optional, so import / capture / consolidation callers that omit them are
 * unchanged.
 *
 * SECURITY (T-16-04): every runtime value is `?`-bound. Normalized values carry
 * a numeric `fieldDefId`; no custom SQL identifier reaches this composer.
 *
 * Node-pure: takes `exec: SqlExecutor`; imports the shared `inWriteTransaction`.
 */

import { recordLifecycleTransitionCore } from "@/db/contact-lifecycle-dao";
import { addLinksCore } from "@/db/contact-links-dao";
import {
  applyContactMethodDiffCore,
  type ContactMethodDraft,
  type ContactMethodNormalizationContext,
  type ContactMethodRow,
  type ContactMethodSaveResult,
  listContactMethods,
} from "@/db/contact-methods-dao";
import { addCurrentStateEntryCore } from "@/db/current-state-history-dao";
import {
  type CurrentStateEntryRow,
  getCurrentStateValues,
} from "@/db/current-state-history-read";
import { applyUserCustomValueEditCore } from "@/db/custom-value-edit-dao";
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { recordEventCore } from "@/db/events-dao";
import { listDefs } from "@/db/field-defs-dao";
import { upsertValueCore } from "@/db/field-values-dao";
import {
  addMemoryCore,
  deleteMemoryNowCore,
  type EditMemoryInput,
  editMemoryCore,
  type NewMemoryInput,
  setMemoryAllowAiCore,
} from "@/db/memories-dao";
import { listMemoriesForContact, type MemoryRow } from "@/db/memories-read";
import type { CurrentStateFieldKey } from "@/db/memory-registry";
import {
  addOffLimitsCore,
  deleteOffLimitsCore,
  type EditOffLimitsInput,
  editOffLimitsCore,
} from "@/db/off-limits-dao";
import {
  listOffLimitsForContact,
  type OffLimitsRow,
} from "@/db/off-limits-read";
import { assertSafeRelative } from "@/db/photo-relative-path";
import {
  type FirstInteractionInput,
  insertInteractionCore,
  recomputeLastContactCore,
} from "@/db/recency-dao";
import {
  addRelationshipCore,
  deleteRelationshipNowCore,
  type EditRelationshipInput,
  editRelationshipCore,
  type NewRelationshipInput,
} from "@/db/relationships-dao";
import {
  listRelationshipsForContact,
  type RelationshipRow,
} from "@/db/relationships-read";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
import { isValidStoredBirthday } from "@/logic/birthday-logic";

/** One normalized custom-field value to write for a contact-definition pair. */
export interface CustomValueInput {
  /** The stable definition row that identifies this value pair. */
  fieldDefId: number;
  value: string | null;
}

// =============================================================================
// SHOW-MORE ENRICHMENT (CAPT-01) — create-path element shapes.
//
// Each array element carries ONLY the per-record SEMANTIC fields and OMITS the
// framework fields that do not exist until the contact row is inserted
// (`contactId`, the `createdAt`/`now` stamps, and — for Off Limits — a minted
// `uid`). `createContactFullCore` injects that full normalization set post-
// insert before invoking each `*Core` writer, so the element shape is NOT the raw
// `*Core` writer input on the create path (Review cycle-3/4 MEDIUM). Keeping the
// shapes as `Omit<...>` of the writer inputs guarantees they stay in lockstep
// with the underlying DAO contracts.
//
// Phase 38.10 (D-01, D-05, D-65): every Things to Remember item goes straight
// to its own home — memories (Gift Ideas and Thought of Them included), key
// people, `off_limits` and dated `current_state_entries`. Nothing here writes
// through the retired knowledge-table names.
// =============================================================================

/** A Memory to create with the contact (semantic fields only). */
export type CreateMemoryInput = Omit<
  NewMemoryInput,
  "contactId" | "createdAt" | "now"
>;
/** A relationship to create with the contact (semantic fields only). */
export type CreateRelationshipInput = Omit<
  NewRelationshipInput,
  "contactId" | "createdAt" | "now"
>;
/**
 * A dated Last Talked About / Current Location entry — semantic only. Every
 * one is a new dated entry; earlier entries stay as history (D-26, D-65).
 */
export interface CreateCurrentStateInput {
  fieldKey: CurrentStateFieldKey;
  value: string;
  /** Local `YYYY-MM-DD`; omitted means the local date of `now` (D-65). */
  entryDate?: string;
}
/**
 * An Off Limits entry to create — semantic fields only. The table has no kind
 * and no AI column, so whatever a form sends lands as Off Limits (D-09, D-11).
 */
export interface CreateOffLimitsInput {
  label?: string | null;
  text?: string | null;
  url?: string | null;
}

/**
 * A brand-new contact plus (optionally) its first touchpoint and `show_on_new`
 * custom values, and optional normalized method drafts, created atomically.
 */
export interface CreateContactFullInput {
  /** Contact-row merge-key uid (caller-minted). */
  uid: string;
  name: string;
  intervalDays: number | null;
  /** Bound contacts participate in proactive cadence treatment. */
  trackingEnabled?: boolean;
  /** Local wall-clock now — `created_at` + `modified_at` + interaction stamps. */
  now: string;
  categoryId?: number | null;
  /** 0/1 — scopes recency to connected rows (default 0). */
  rarelyResponds?: number;
  /**
   * The first interaction. OMIT for the "not yet / don't know" path: no
   * interaction row is written and `last_contact` stays NULL (never-contacted).
   */
  firstInteraction?: FirstInteractionInput;
  /** Custom values to UPSERT after the complete definition-pair matrix is seeded. */
  customValues?: CustomValueInput[];
  /** Omitted preserves the lean no-method create path. */
  methodDrafts?: ContactMethodDraft[];
  /** Caller-resolved device/override region; omitted values fail closed. */
  methodNormalization?: ContactMethodNormalizationContext;
  /**
   * Show-More enrichment (CAPT-01) — each is OPTIONAL; omitting all preserves the
   * lean name-only create path. Every supplied record is written INSIDE the single
   * create transaction (ADR-016) via its `*Core` writer, so an interrupted create
   * rolls back the contact AND all enrichment (never a partial contact or orphan).
   */
  memories?: CreateMemoryInput[];
  relationships?: CreateRelationshipInput[];
  /** Dated Last Talked About + Current Location entries. */
  currentStateEntries?: CreateCurrentStateInput[];
  /** Off Limits entries (always Off Limits, D-11). */
  offLimits?: CreateOffLimitsInput[];
  /**
   * 38.11 D-48 — Add Contact's Show More fields, all OPTIONAL (omitted → NULL /
   * no links, so every other create caller is unchanged). `birthday` is the
   * stored shape (`MM-DD` year unknown, `YYYY-MM-DD` known), validated before
   * any transaction opens. `links` are written inside the create transaction,
   * in array order (display_order 0, 1, …), each with a caller-minted uid.
   */
  birthday?: string | null;
  socialBattery?: string | null;
  links?: Array<{ uid: string; url: string; label: string | null }>;
}

/** The local `YYYY-MM-DD` of a local wall-clock `now` (never a UTC slice). */
function localDateOf(now: string): string {
  return now.slice(0, 10);
}

/** Only the Off Limits content fields; extra draft keys never reach SQL. */
function offLimitsContent(input: CreateOffLimitsInput): CreateOffLimitsInput {
  return {
    label: input.label ?? null,
    text: input.text ?? null,
    url: input.url ?? null,
  };
}

/**
 * Create a contact + (optionally) first interaction + custom values atomically.
 * Returns the new contact id and the interaction id (null on the "not yet" path).
 */
export function createContactFull(
  exec: SqlExecutor,
  input: CreateContactFullInput,
): Promise<{
  contactId: number;
  interactionId: number | null;
  methods: ContactMethodRow[];
  methodSaveResult: ContactMethodSaveResult | null;
}> {
  const trackingEnabled = input.trackingEnabled ?? true;
  // A Bound contact requires a cadence; an Unbound contact may be never-assigned
  // (NULL) or retain a dormant positive cadence.
  if (
    (trackingEnabled &&
      (input.intervalDays === null ||
        !Number.isInteger(input.intervalDays) ||
        input.intervalDays <= 0)) ||
    (input.intervalDays !== null &&
      (!Number.isInteger(input.intervalDays) || input.intervalDays <= 0))
  ) {
    return Promise.reject(
      new Error(
        `intervalDays must be a positive integer, got ${input.intervalDays}`,
      ),
    );
  }
  // GUARD 2 (CRUD-02): reject a FUTURE first-interaction occurredAt. Local
  // wall-clock strings sort chronologically, so `> now` is a correct future test.
  if (input.firstInteraction && input.firstInteraction.occurredAt > input.now) {
    return Promise.reject(
      new Error(
        `firstInteraction.occurredAt is in the future (${input.firstInteraction.occurredAt} > ${input.now})`,
      ),
    );
  }
  // GUARD 3 (38.11 D-48): a birthday must be a real stored birthday shape.
  if (input.birthday != null && !isValidStoredBirthday(input.birthday)) {
    return Promise.reject(
      new Error(`birthday is not a valid stored birthday (${input.birthday})`),
    );
  }

  return inWriteTransaction(exec, () => createContactFullCore(exec, input));
}

/**
 * NON-mutexed create CORE. Call only inside an already-open
 * `inWriteTransaction`; import composition reuses it so every contact receives
 * the same custom-field definition-pair matrix as a normal create.
 */
export async function createContactFullCore(
  exec: SqlExecutor,
  input: CreateContactFullInput,
): Promise<{
  contactId: number;
  interactionId: number | null;
  methods: ContactMethodRow[];
  methodSaveResult: ContactMethodSaveResult | null;
}> {
  const trackingEnabled = input.trackingEnabled ?? true;
  // Contact row — scalar phone/email were retired by migration 009; birthday
  // and social battery are optional create columns (38.11 D-48).
  const contactResult = await exec.runAsync(
    `INSERT INTO contacts
       (uid, name, category_id, interval_days, tracking_enabled, rarely_responds,
        birthday, social_battery, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.uid,
      input.name,
      input.categoryId ?? null,
      input.intervalDays,
      trackingEnabled ? 1 : 0,
      input.rarelyResponds ?? 0,
      input.birthday ?? null,
      input.socialBattery ?? null,
      input.now,
      input.now,
    ],
  );
  const contactId = contactResult.lastInsertRowId;

  // First interaction (Today / Pick-date path) → recompute last_contact via the
  // single writer. Skipped on the "not yet" path (last_contact stays NULL).
  let interactionId: number | null = null;
  if (input.firstInteraction) {
    interactionId = await insertInteractionCore(
      exec,
      contactId,
      input.now,
      input.firstInteraction,
    );
    await recomputeLastContactCore(exec, contactId, input.now);
  }

  // Seed the durable pair matrix only for GLOBAL definitions, including
  // quarantined globals. Directly-present Phase-31 contact defs must never
  // fan out to a newly-created contact.
  const definitions = await listDefs(exec, { includeQuarantined: true });
  for (const definition of definitions.filter(
    (definition) => definition.scope === "global",
  )) {
    await upsertValueCore(
      exec,
      contactId,
      definition.id,
      newUid(),
      null,
      input.now,
    );
  }

  // Apply submitted values only after every pair exists. The writer's UPDATE
  // branch never rewrites uid or created_at, including when clearing to NULL.
  const customValues = input.customValues ?? [];
  for (const customValue of customValues) {
    await upsertValueCore(
      exec,
      contactId,
      customValue.fieldDefId,
      newUid(),
      customValue.value,
      input.now,
    );
  }

  // Show-More enrichment (CAPT-01) — composed INSIDE this single transaction
  // (ADR-016). Each element carries ONLY semantic fields; inject the framework
  // set that does not exist until the contact row was inserted. A throw in any
  // *Core writer rolls back the whole composition (no partial contact / orphan).
  for (const memory of input.memories ?? []) {
    await addMemoryCore(exec, {
      ...memory,
      contactId,
      createdAt: input.now,
      now: input.now,
    });
  }
  for (const relationship of input.relationships ?? []) {
    await addRelationshipCore(exec, {
      ...relationship,
      contactId,
      createdAt: input.now,
      now: input.now,
    });
  }
  for (const entry of input.currentStateEntries ?? []) {
    // A dated entry: the draft's date, else today's local date (D-65).
    await addCurrentStateEntryCore(exec, {
      contactId,
      fieldKey: entry.fieldKey,
      value: entry.value,
      entryDate: entry.entryDate ?? localDateOf(input.now),
      entryTime: null,
      now: input.now,
    });
  }
  for (const offLimits of input.offLimits ?? []) {
    // NEW-1 (D-11): an Off Limits draft is always Off Limits — the table has no
    // kind, so typed Off Limits text can never land as an AI-eligible memory.
    await addOffLimitsCore(exec, {
      ...offLimitsContent(offLimits),
      uid: newUid(),
      contactId,
      createdAt: input.now,
      now: input.now,
    });
  }

  const methodSaveResult =
    input.methodDrafts === undefined
      ? null
      : await applyContactMethodDiffCore(exec, {
          contactId,
          seeded: [],
          current: input.methodDrafts,
          now: input.now,
          effectivePhoneRegion:
            input.methodNormalization?.effectivePhoneRegion ?? null,
          // The aggregate owns the single bump (below); suppress the sub-bump.
          bumpRevision: false,
        });
  // Links (38.11 D-48) — the non-bumping, non-mutexed core, so they commit or
  // roll back with the contact. NEVER `applyLinkDiff` / `addLink` here: each
  // opens its own transaction (non-reentrant mutex → permanent hang) and bumps.
  if (input.links && input.links.length > 0) {
    await addLinksCore(exec, {
      contactId,
      links: input.links,
      now: input.now,
    });
  }

  // createContactFullCore is the SOLE `data_revision` bumper for the composed
  // create: the contact INSERT is always a change and the method and link cores
  // ran without bumping, so a knowledge-only / unchanged-method create still
  // advances backup-freshness by EXACTLY 1 and no path double-bumps (Review
  // cycle-3 MEDIUM). The composed create calls NO tombstone-writing core, so no
  // inner bump can happen here.
  await bumpDataRevisionCore(exec);
  return {
    contactId,
    interactionId,
    methods: methodSaveResult?.methods ?? [],
    methodSaveResult,
  };
}

// =============================================================================
// EDIT (CRUD-03) — updateContactFull: the metadata-edit writer.
//
// Composes updateContactMetadataCore + upsertValueCore × N + (conditional)
// recomputeLastContactCore + (optional, never-contacted-only) insertInteractionCore
// inside ONE inWriteTransaction — the SAME composition contract as create.
//
//   • The metadata UPDATE SET list OMITS `last_contact` entirely (single-writer
//     invariant DATA-04). last_contact is written ONLY via recomputeLastContactCore.
//   • recomputeLastContactCore fires IF AND ONLY IF the incoming `rarelyResponds`
//     differs from the STORED value (Pitfall 2 — the flag changes which rows count
//     toward recency, so a metadata-only UPDATE silently corrupts status math) OR a
//     first interaction was just inserted. The metadata UPDATE runs FIRST so the
//     recompute reads the NEW flag.
//   • FIRST-INTERACTION-ON-EDIT (owner ruling 2026-08-14, CONTEXT Area 3): a
//     `firstInteraction` is honoured ONLY when the STORED `last_contact IS NULL`
//     (re-checked INSIDE the transaction; throw → rollback for an already-contacted
//     contact — timeline edits stay Phase 6). It is written via insertInteractionCore
//     (source='manual', direction=null — the same single-writer path as create), never
//     as a direct last_contact write. A future occurredAt is rejected pre-transaction.
// =============================================================================

// =============================================================================
// EDIT-PATH KNOWLEDGE DIFF CONTRACT (CAPT-04, dossier §E) — the SINGLE pinned
// shape for the five editable knowledge subdomains.
//
// The LOGIC layer (edit-contact-logic.buildEditInput) computes explicit
// `{ add, edit, delete }` lists keyed by a row-identity `id` from seed-vs-draft;
// `updateContactFull` APPLIES those lists inside its single metadata transaction
// (adds via add*Core, edits via edit*Core, deletes via delete*Core) and NEVER
// re-diffs. There is no "diff shape OR lists" ambiguity across the task boundary
// (Review cycle-3 LOW). Current-state (Last Talked About / Current Location) is a
// per-field value list, not a collection diff.
// =============================================================================

/** A soft-identity reference to one existing knowledge row to delete by row id. */
export interface KnowledgeDeleteRef {
  id: number;
}

/**
 * An add/edit/delete diff for a COLLECTION knowledge subdomain (Memories, Key
 * People/Relationships, Off Limits). `add` elements are the create-path semantic
 * shape (framework fields injected by the DAO); `edit` elements carry the row
 * `id` + the patched fields; `delete` elements carry the row `id`. Every list is
 * optional; an omitted/empty diff writes nothing for that subdomain.
 */
export interface KnowledgeCollectionDiff<TAdd, TEdit> {
  add?: TAdd[];
  /** Synthetic draft ids parallel to `add`, for committed-id remapping only. */
  addTempIds?: number[];
  edit?: TEdit[];
  delete?: KnowledgeDeleteRef[];
}

/**
 * An edit patch to one existing Memory (row `id` + patched fields). `allowAi`
 * is present only when the form's Allow AI choice changed; the aggregate then
 * writes it through `setMemoryAllowAiCore` at Save (D-27).
 */
export type EditMemoryPatch = Omit<EditMemoryInput, "contactId" | "now"> & {
  allowAi?: 0 | 1;
};
/** An edit patch to one existing relationship (row `id` + patched fields). */
export type EditRelationshipPatch = Omit<
  EditRelationshipInput,
  "contactId" | "now"
>;
/** An edit patch to one existing Off Limits entry (row `id` + patched fields). */
export type EditOffLimitsPatch = Omit<EditOffLimitsInput, "contactId" | "now">;

/** The edit payload — the mutable `contacts` columns + custom values + optional first-touch. */
export interface UpdateContactFullInput {
  /** The contact to edit. */
  id: number;
  name: string;
  intervalDays: number | null;
  /** Omitted retains the stored Bound/Unbound state for legacy callers. */
  trackingEnabled?: boolean;
  /** Local wall-clock now — `modified_at` + any interaction stamps. */
  now: string;
  /** 0/1 incoming flag — the DAO reads the STORED value to decide whether to recompute. */
  rarelyResponds: number;
  /** 0/1 — suppress this contact's reminders. */
  remindersOff: number;
  categoryId?: number | null;
  socialBattery?: string | null;
  birthday?: string | null;
  /** Custom values to UPSERT by their normalized definition pair. */
  customValues?: CustomValueInput[];
  /** Omitted leaves durable methods untouched; [] is an explicit local clear. */
  methodDrafts?: ContactMethodDraft[];
  /** Optional editor snapshot; the DAO reads its own seed when omitted. */
  seededMethods?: ContactMethodRow[];
  methodNormalization?: ContactMethodNormalizationContext;
  /**
   * A FIRST interaction to record — honoured ONLY when the STORED `last_contact IS
   * NULL` (never-contacted). For an already-contacted contact it throws (rollback).
   */
  firstInteraction?: FirstInteractionInput;
  /**
   * Knowledge-subdomain edit diffs (CAPT-04, dossier §E) — each OPTIONAL; omitting
   * all preserves the lean metadata+custom-values edit path. Every supplied diff is
   * applied INSIDE the single metadata transaction (ADR-016) via composed exec-scoped
   * `*Core` writers, so an interrupted edit rolls back the contact AND all knowledge
   * rows (never a partial contact or orphan). `updateContactFull` is the SOLE
   * `data_revision` bumper for the composed edit.
   */
  memories?: KnowledgeCollectionDiff<CreateMemoryInput, EditMemoryPatch>;
  relationships?: KnowledgeCollectionDiff<
    CreateRelationshipInput,
    EditRelationshipPatch
  >;
  /**
   * Last Talked About + Current Location — each element is a NEW dated entry
   * (D-26, D-65). The form layer decides when to send one (edit-contact-logic
   * skips a value equal to its seed); the DAO appends every one it receives.
   */
  currentStateEntries?: CreateCurrentStateInput[];
  /**
   * Off Limits diff against the `off_limits` table, which holds nothing else:
   * every add/edit/delete is scoped by `(id, contact_id)` (D-11).
   */
  offLimits?: KnowledgeCollectionDiff<CreateOffLimitsInput, EditOffLimitsPatch>;
}

/**
 * NON-mutexed metadata-edit CORE: ONE `UPDATE contacts` of every mutable column
 * EXCEPT `last_contact` (single-writer DATA-04). Asserts exactly one row changed
 * (a non-matching id throws → rollback, mirroring recency-dao's loud-failure guard).
 * Call ONLY inside an already-open `inWriteTransaction`.
 */
export async function updateContactMetadataCore(
  exec: SqlExecutor,
  input: UpdateContactFullInput,
): Promise<void> {
  const result = await exec.runAsync(
    `UPDATE contacts SET
       name=?, category_id=?, interval_days=?, tracking_enabled=?, social_battery=?, birthday=?,
       rarely_responds=?, reminders_off=?, modified_at=?
     WHERE id=?`,
    [
      input.name,
      input.categoryId ?? null,
      input.intervalDays,
      input.trackingEnabled === false ? 0 : 1,
      input.socialBattery ?? null,
      input.birthday ?? null,
      input.rarelyResponds,
      input.remindersOff,
      input.now,
      input.id,
    ],
  );
  if (result.changes !== 1) {
    throw new Error(
      `updateContactMetadataCore: no contact matched id=${input.id} (changed ${result.changes})`,
    );
  }
}

/** Set one contact category inside a transaction already owned by the caller. */
export async function setContactCategoryCore(
  exec: SqlExecutor,
  id: number,
  categoryId: number | null,
  now: string,
): Promise<void> {
  const result = await exec.runAsync(
    "UPDATE contacts SET category_id = ?, modified_at = ? WHERE id = ?",
    [categoryId, now, id],
  );
  if (result.changes !== 1) {
    throw new Error(
      `setContactCategoryCore: no contact matched id=${id} (changed ${result.changes})`,
    );
  }
}

/** Set one positive contact frequency inside a transaction already owned by the caller. */
export async function setContactFrequencyCore(
  exec: SqlExecutor,
  id: number,
  intervalDays: number,
  now: string,
): Promise<void> {
  if (!Number.isInteger(intervalDays) || intervalDays <= 0) {
    throw new Error(
      `intervalDays must be a positive integer, got ${intervalDays}`,
    );
  }
  const result = await exec.runAsync(
    "UPDATE contacts SET interval_days = ?, modified_at = ? WHERE id = ?",
    [intervalDays, now, id],
  );
  if (result.changes !== 1) {
    throw new Error(
      `setContactFrequencyCore: no contact matched id=${id} (changed ${result.changes})`,
    );
  }
}

/**
 * Apply the knowledge-subdomain edit diffs INSIDE the caller's already-open
 * metadata transaction (ADR-016). Composes ONLY the exec-scoped `*Core` writers —
 * never the mutexed wrappers (non-reentrant mutex). A throw in any writer rolls the
 * whole edit back with the contact metadata. NON-mutexed: call only inside an open
 * `inWriteTransaction`.
 *
 *   • Collections (memories / key people / Off Limits) apply the pre-computed
 *     `{ add, edit, delete }` lists — the DAO never re-diffs.
 *   • Deletes are hard deletes with a tombstone (D-69), held by the form until
 *     Save (D-104). Every tombstone-writing core runs with `bumpRevision: false`,
 *     so the aggregate's own bump stays the only one (PLAN-MAP §5).
 *   • A memory edit carrying `allowAi` writes it through `setMemoryAllowAiCore`
 *     at Save (D-27); the DAO still refuses AI on a Group Note copy (D-102).
 *   • Each current-state element appends a NEW dated entry (D-26, D-65); the
 *     form layer owns the "unchanged from seed" skip.
 *   • Off Limits writes go to `off_limits` only, scoped by `(id, contact_id)`
 *     (D-11).
 *   • NO `data_revision` bump here — `updateContactFull` owns the single bump.
 */
async function applyKnowledgeDiffsCore(
  exec: SqlExecutor,
  contactId: number,
  input: UpdateContactFullInput,
): Promise<{
  memories: number[];
  relationships: number[];
  offLimits: number[];
}> {
  const now = input.now;
  const addedIds = {
    memories: [] as number[],
    relationships: [] as number[],
    offLimits: [] as number[],
  };

  // --- Memories -------------------------------------------------------------
  if (input.memories) {
    for (const add of input.memories.add ?? []) {
      addedIds.memories.push(
        await addMemoryCore(exec, { ...add, contactId, createdAt: now, now }),
      );
    }
    for (const edit of input.memories.edit ?? []) {
      const { allowAi, ...patch } = edit;
      await editMemoryCore(exec, { ...patch, contactId, now });
      if (allowAi === 0 || allowAi === 1) {
        await setMemoryAllowAiCore(exec, {
          id: patch.id,
          contactId,
          allow: allowAi === 1,
          now,
        });
      }
    }
    for (const ref of input.memories.delete ?? []) {
      await deleteMemoryNowCore(exec, {
        id: ref.id,
        contactId,
        now,
        bumpRevision: false,
      });
    }
  }

  // --- Key People / Relationships ------------------------------------------
  if (input.relationships) {
    for (const add of input.relationships.add ?? []) {
      addedIds.relationships.push(
        await addRelationshipCore(exec, {
          ...add,
          contactId,
          createdAt: now,
          now,
        }),
      );
    }
    for (const patch of input.relationships.edit ?? []) {
      await editRelationshipCore(exec, { ...patch, contactId, now });
    }
    for (const ref of input.relationships.delete ?? []) {
      await deleteRelationshipNowCore(exec, {
        id: ref.id,
        contactId,
        now,
        bumpRevision: false,
      });
    }
  }

  // --- Last Talked About / Current Location (dated append) -----------------
  for (const entry of input.currentStateEntries ?? []) {
    await addCurrentStateEntryCore(exec, {
      contactId,
      fieldKey: entry.fieldKey,
      value: entry.value,
      entryDate: entry.entryDate ?? localDateOf(now),
      entryTime: null,
      now,
    });
  }

  // --- Off Limits -----------------------------------------------------------
  if (input.offLimits) {
    for (const add of input.offLimits.add ?? []) {
      addedIds.offLimits.push(
        await addOffLimitsCore(exec, {
          ...offLimitsContent(add),
          uid: newUid(),
          contactId,
          createdAt: now,
          now,
        }),
      );
    }
    for (const patch of input.offLimits.edit ?? []) {
      // Only the fields present are written; scoped by (id, contact_id).
      await editOffLimitsCore(exec, {
        id: patch.id,
        contactId,
        label: patch.label,
        text: patch.text,
        url: patch.url,
        now,
      });
    }
    for (const ref of input.offLimits.delete ?? []) {
      // Suppress the tombstone self-bump so the aggregate bumps exactly once.
      await deleteOffLimitsCore(exec, {
        id: ref.id,
        contactId,
        now,
        bumpRevision: false,
      });
    }
  }
  return addedIds;
}

/**
 * Edit a contact's metadata + custom values atomically, recomputing recency only
 * when the `rarely_responds` flag flips or a first interaction is inserted. See the
 * composition contract above.
 */
export function updateContactFull(
  exec: SqlExecutor,
  input: UpdateContactFullInput,
): Promise<{
  methods: ContactMethodRow[];
  methodSaveResult: ContactMethodSaveResult | null;
  memories: MemoryRow[];
  relationships: RelationshipRow[];
  offLimits: OffLimitsRow[];
  currentState: Partial<
    Record<"last_talked_about" | "current_location", CurrentStateEntryRow>
  >;
  addedIds: {
    memories: number[];
    relationships: number[];
    offLimits: number[];
  };
}> {
  // A requested Bound state needs a positive cadence. Unbound accepts NULL for
  // never-assigned contacts and positive dormant cadence otherwise.
  if (
    (input.trackingEnabled !== false &&
      (input.intervalDays === null ||
        !Number.isInteger(input.intervalDays) ||
        input.intervalDays <= 0)) ||
    (input.intervalDays !== null &&
      (!Number.isInteger(input.intervalDays) || input.intervalDays <= 0))
  ) {
    return Promise.reject(
      new Error(
        `intervalDays must be a positive integer, got ${input.intervalDays}`,
      ),
    );
  }
  // GUARD 2 (CRUD-02): reject a FUTURE first-interaction occurredAt BEFORE any
  // transaction opens. Local wall-clock strings sort chronologically.
  if (input.firstInteraction && input.firstInteraction.occurredAt > input.now) {
    return Promise.reject(
      new Error(
        `firstInteraction.occurredAt is in the future (${input.firstInteraction.occurredAt} > ${input.now})`,
      ),
    );
  }

  return inWriteTransaction(exec, async () => {
    // Read the STORED rarely_responds AND last_contact FIRST — before the metadata
    // UPDATE overwrites the flag — so we can (a) detect a flag flip and (b) enforce
    // the never-contacted-only rule for firstInteraction inside the transaction.
    const stored = await exec.getFirstAsync<{
      rarely_responds: number;
      last_contact: string | null;
      interval_days: number | null;
      tracking_enabled: number;
    }>(
      "SELECT rarely_responds, last_contact, interval_days, tracking_enabled FROM contacts WHERE id = ?",
      [input.id],
    );
    if (!stored) {
      throw new Error(`updateContactFull: no contact with id=${input.id}`);
    }

    const trackingEnabled =
      input.trackingEnabled ?? stored.tracking_enabled === 1;
    // Once cadence has been assigned, unbinding preserves it as dormant. This
    // also avoids the v11 one-way trigger that rejects clearing cadence.
    const intervalDays =
      !trackingEnabled && stored.interval_days !== null
        ? stored.interval_days
        : input.intervalDays;
    const lifecycleInput: UpdateContactFullInput = {
      ...input,
      trackingEnabled,
      intervalDays,
    };

    // Metadata UPDATE (never writes last_contact). Runs FIRST so a later recompute
    // reads the NEW rarely_responds flag.
    await updateContactMetadataCore(exec, lifecycleInput);
    if (
      input.trackingEnabled !== undefined &&
      (input.trackingEnabled ? 1 : 0) !== stored.tracking_enabled
    ) {
      await recordLifecycleTransitionCore(
        exec,
        input.id,
        trackingEnabled ? "bind" : "unbind",
        input.now,
      );
    }

    // UPSERT value pairs instead of deleting/re-keying them. A fresh uid is only
    // relevant to a missing pair's INSERT branch; an existing pair retains it.
    const customValues = input.customValues ?? [];
    for (const customValue of customValues) {
      await applyUserCustomValueEditCore(exec, {
        contactId: input.id,
        fieldDefId: customValue.fieldDefId,
        value: customValue.value,
        now: input.now,
      });
    }

    // FIRST-INTERACTION-ON-EDIT (owner ruling): honoured ONLY when the stored
    // last_contact IS NULL. An already-contacted contact's timeline stays Phase 6.
    let firstInteractionInserted = false;
    if (input.firstInteraction) {
      if (stored.last_contact !== null) {
        throw new Error(
          `updateContactFull: firstInteraction rejected — contact id=${input.id} already has last_contact set (timeline edits are Phase 6)`,
        );
      }
      await insertInteractionCore(
        exec,
        input.id,
        input.now,
        input.firstInteraction,
      );
      firstInteractionInserted = true;
    }

    // Recompute through the single writer IFF the flag flipped OR a first
    // interaction was inserted — inside the SAME transaction (Pitfall 2).
    if (
      input.rarelyResponds !== stored.rarely_responds ||
      firstInteractionInserted
    ) {
      await recomputeLastContactCore(exec, input.id, input.now);
    }
    // Knowledge-subdomain edits (CAPT-04, dossier §E) — composed INSIDE this same
    // metadata transaction so an interrupted edit rolls back the contact AND every
    // knowledge row. No bump here; updateContactFull owns the single bump below.
    const addedIds = await applyKnowledgeDiffsCore(exec, input.id, input);

    const methodSaveResult =
      input.methodDrafts === undefined
        ? null
        : await applyContactMethodDiffCore(exec, {
            contactId: input.id,
            seeded:
              input.seededMethods ?? (await listContactMethods(exec, input.id)),
            current: input.methodDrafts,
            now: input.now,
            effectivePhoneRegion:
              input.methodNormalization?.effectivePhoneRegion ?? null,
            // The aggregate owns the single bump (below); suppress the sub-bump so a
            // knowledge-only / unchanged-method edit still advances data_revision by
            // exactly 1 and no path double-bumps (Review cycle-3 MEDIUM).
            bumpRevision: false,
          });
    // updateContactFull is the SOLE data_revision bumper for the composed edit: the
    // metadata UPDATE is always a change, and the method core ran with its bump
    // suppressed — so a knowledge-only edit and an unchanged-method edit both advance
    // backup-freshness by EXACTLY 1, and no path double-bumps.
    await bumpDataRevisionCore(exec);
    const memories = await listMemoriesForContact(exec, input.id);
    const relationships = await listRelationshipsForContact(exec, input.id);
    const offLimits = await listOffLimitsForContact(exec, input.id);
    const currentState = await getCurrentStateValues(exec, input.id);
    return {
      methods: methodSaveResult?.methods ?? [],
      methodSaveResult,
      memories,
      relationships,
      offLimits,
      currentState,
      addedIds,
    };
  });
}

// =============================================================================
// ARCHIVE / RESTORE (CRUD-05) — the reversible half of the two-stage lifecycle.
//
// Archive is a SOFT visibility flag: `archived_at` is set (hides the contact
// from every LIVE read — STATUS_SCAN and isDuplicateName already filter
// `archived_at IS NULL`, queries.ts / contact-read.ts). Restore nulls it back.
//
// EVENTS (LOG-02, this phase): archive now emits an immutable 'archive' event and
// restore a 'restore' event, each recorded via `recordEventCore` composed INSIDE
// the function's ONE existing `inWriteTransaction` (no nested mutex, no second
// transaction — transaction.ts non-reentrancy; mirrors recency-dao's *Core
// composition). The ONLY addition to each write is that events INSERT — the SET
// list on `contacts` is unchanged (archived_at + modified_at only), so
// `last_contact` is STILL untouched (single-writer DATA-04 intact). The prior
// RESEARCH-A3 "events deferred" default is SUPERSEDED by the owner decision that
// established the events writer (events-dao.ts).
//
// ARCHIVED-STATE GUARD (C2-#1): each UPDATE carries an archived-state predicate —
// archive `... WHERE id=? AND archived_at IS NULL`, restore `... WHERE id=? AND
// archived_at IS NOT NULL`. SQLite counts an identical-value UPDATE as
// changes===1, so an id-only UPDATE would let a no-op/wrong-state transition
// (re-archiving an already-archived contact, restoring a live one) "succeed" and
// emit a FALSE event. The predicate makes a wrong-state transition match 0 rows,
// so the `changes===1` guard throws BEFORE the event INSERT — NO spurious event
// is written and the caller learns the transition didn't apply. This tightens
// Phase-4 semantics (a redundant archive/restore now throws instead of silently
// re-stamping) — an owner-approved structural guard.
//
// listArchived is the SOLE inverse read (`archived_at IS NOT NULL`); every
// live/list surface keeps the `archived_at IS NULL` filter. The by-id
// getContactHeader / getContactForEdit seeks stay archived-reachable by design
// (no Phase-4 surface routes to an archived profile/edit) — see the plan's
// archived-read reconciliation note.
//
// SECURITY (T-04-02 / T-06-11): every value is `?`-bound; no interpolation. The
// events INSERT adds no second `last_contact` writer.
// =============================================================================

/** One archived contact as surfaced by the Archived list. */
export interface ArchivedContactRow {
  id: number;
  name: string;
  /** When it was archived — the list orders by this, most-recent first. */
  archived_at: string;
}

/**
 * Archive a contact: set `archived_at` to `now` (a reversible flag) and emit one
 * immutable 'archive' event, in ONE transaction. The archived-state predicate
 * (`archived_at IS NULL`) means only a REAL live→archived transition matches: a
 * no-op re-archive matches 0 rows and throws before the event INSERT (no spurious
 * event). The contact then fails every `archived_at IS NULL` live read and
 * appears in listArchived. `last_contact` is untouched.
 */
/** Non-mutexed archive primitive for callers that already own a transaction. */
export async function archiveContactCore(
  exec: SqlExecutor,
  id: number,
  now: string,
): Promise<void> {
  const result = await exec.runAsync(
    "UPDATE contacts SET archived_at = ?, modified_at = ? WHERE id = ? AND archived_at IS NULL",
    [now, now, id],
  );
  if (result.changes !== 1) {
    throw new Error(
      `archiveContact: no live contact matched id=${id} (changed ${result.changes})`,
    );
  }
  await recordEventCore(exec, {
    contactId: id,
    uid: newUid(),
    type: "archive",
    occurredAt: now,
    detail: null,
    now,
  });
}

export function archiveContact(
  exec: SqlExecutor,
  id: number,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await archiveContactCore(exec, id, now);
    await bumpDataRevisionCore(exec);
  });
}

/**
 * Restore an archived contact: null `archived_at` and emit one immutable
 * 'restore' event, in ONE transaction. The archived-state predicate
 * (`archived_at IS NOT NULL`) means only a REAL archived→live transition matches:
 * restoring a live contact matches 0 rows and throws before the event INSERT (no
 * spurious event). The contact reappears in live reads and leaves listArchived.
 * `last_contact` is untouched.
 */
export function restoreContact(
  exec: SqlExecutor,
  id: number,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      "UPDATE contacts SET archived_at = NULL, modified_at = ? WHERE id = ? AND archived_at IS NOT NULL",
      [now, id],
    );
    if (result.changes !== 1) {
      throw new Error(
        `restoreContact: no archived contact matched id=${id} (changed ${result.changes})`,
      );
    }
    // Immutable lifecycle event, composed inside THIS transaction (non-mutexed
    // core — never nest inWriteTransaction). Only reached on a real transition.
    await recordEventCore(exec, {
      contactId: id,
      uid: newUid(),
      type: "restore",
      occurredAt: now,
      detail: null,
      now,
    });
    await bumpDataRevisionCore(exec);
  });
}

/**
 * List archived contacts — the SOLE inverse read (`archived_at IS NOT NULL`),
 * most-recently-archived first. A pure read (no transaction).
 */
export function listArchived(exec: SqlExecutor): Promise<ArchivedContactRow[]> {
  return exec.getAllAsync<ArchivedContactRow>(
    `SELECT id, name, archived_at
       FROM contacts
      WHERE archived_at IS NOT NULL
      ORDER BY archived_at DESC`,
  );
}

// =============================================================================
// PHOTO (PHOTO-03 / PHOTO-05 write half) — dedicated atomic single-column writers.
//
// These exist because `updateContactMetadataCore` deliberately OMITS `photo` from
// its SET list (RESEARCH Pitfall 6, VERIFIED lines 249-252) — the photo write is
// decoupled from the metadata form so the inline old-file delete can pair with the
// DB update in the pipeline/caller. They mirror `archiveContact` exactly: ONE
// `inWriteTransaction`, a `?`-bound single-column UPDATE, and a `changes===1`
// loud-failure guard (a bad id throws → rollback).
//
// The stored value is the RELATIVE filename (`avatars/<name>.<ext>`) — never an
// absolute or cache URI (RESEARCH Anti-Patterns; Pitfalls 1 & 3). NO file
// `delete()` lives here: the DAO is node-pure (imports only `@/db/*`); the FS side
// effect is the pipeline's job, kept out of the transaction (same reasoning as
// purge's post-commit hook).
// =============================================================================

/**
 * Set a contact's photo to a RELATIVE filename + bump `modified_at`. Asserts
 * exactly one row changed (a bad id throws → rollback). `last_contact` untouched.
 */
/** Non-mutexed photo writer for callers that already own the write transaction. */
export async function setContactPhotoCore(
  exec: SqlExecutor,
  id: number,
  relative: string,
  now: string,
): Promise<void> {
  // Defense-in-depth: reject a non-`avatars/<name>.<ext>` value BEFORE the UPDATE
  // (and before opening the transaction). A stored absolute/`cache://`/`file://`
  // value would otherwise throw synchronously in `resolvePhotoUri` during render,
  // crashing the screen. Shares the single allowlist with the FS chokepoint.
  // `async` so the fail-fast throw surfaces as a rejection (not a sync throw).
  assertSafeRelative(relative);
  const result = await exec.runAsync(
    "UPDATE contacts SET photo = ?, modified_at = ? WHERE id = ?",
    [relative, now, id],
  );
  if (result.changes !== 1) {
    throw new Error(
      `setContactPhoto: no contact matched id=${id} (changed ${result.changes})`,
    );
  }
  await bumpDataRevisionCore(exec);
}

/** Transaction-owning wrapper for the standalone contact-photo write. */
export function setContactPhoto(
  exec: SqlExecutor,
  id: number,
  relative: string,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, () =>
    setContactPhotoCore(exec, id, relative, now),
  );
}

export async function getContactPhotoIdentity(
  exec: SqlExecutor,
  id: number,
): Promise<string | null> {
  const row = await exec.getFirstAsync<{ uid: string }>(
    "SELECT uid FROM contacts WHERE id = ?",
    [id],
  );
  return row?.uid ?? null;
}

export function setContactPhotoForUid(
  exec: SqlExecutor,
  id: number,
  uid: string,
  relative: string,
  now: string,
): Promise<void> {
  assertSafeRelative(relative);
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      "UPDATE contacts SET photo = ?, modified_at = ? WHERE id = ? AND uid = ?",
      [relative, now, id, uid],
    );
    if (result.changes !== 1) throw new Error("contact photo target changed");
    await bumpDataRevisionCore(exec);
  });
}

/**
 * Clear a contact's photo (`photo = NULL`) + bump `modified_at`. Asserts exactly
 * one row changed (a bad id throws → rollback). `last_contact` untouched.
 */
export async function clearContactPhotoCore(
  exec: SqlExecutor,
  id: number,
  now: string,
): Promise<void> {
  const result = await exec.runAsync(
    "UPDATE contacts SET photo = NULL, modified_at = ? WHERE id = ?",
    [now, id],
  );
  if (result.changes !== 1) {
    throw new Error(
      `clearContactPhoto: no contact matched id=${id} (changed ${result.changes})`,
    );
  }
  await bumpDataRevisionCore(exec);
}

export function clearContactPhoto(
  exec: SqlExecutor,
  id: number,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, () => clearContactPhotoCore(exec, id, now));
}
