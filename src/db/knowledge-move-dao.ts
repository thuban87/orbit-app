/**
 * Move one knowledge entry between Memories, Thought of Them, Gift Ideas,
 * Last Talked About and Off Limits, with Undo (Phase 38.10 D-84, D-85, D-93,
 * D-102, D-103, D-108, D-118).
 *
 * - Within memories a move is a type change that keeps allow_ai (D-57).
 * - Across tables the source leaves through its own delete core (tombstone +
 *   snapshot) and the destination is a new row with a new uid, all in one
 *   transaction (D-84). It keeps the source's `created_at`, its D-102 Group
 *   Note copy marker and its D-108 share origin.
 * - Only Last Talked About is movable among current-state fields (D-84).
 *   Imported memories and custom fields are never a source or a target.
 * - Moves never widen AI (D-13, D-31). Moving a `note`-linked entry into Off
 *   Limits turns the interaction's Allow AI off and sets its durable lock in
 *   the same transaction, through the single interaction writer
 *   `editTouchpointFullCore` (D-93, D-103, ADR-010). No SQL in this module
 *   writes the interactions table.
 * - Undo (D-118) changes a type back, or deletes the moved copy (with a
 *   tombstone) and restores the original from its snapshot through the plan
 *   02 / 03 undo cores. Undo never writes an interaction, so a move into Off
 *   Limits stays AI-off after Undo.
 *
 * Revision bumps (PLAN-MAP §5): every inner tombstone write passes
 * `bumpRevision: false`; the move core bumps once at its end unless told not
 * to, and the Undo wrapper bumps once.
 */

import {
  addCurrentStateEntryCore,
  type CurrentStateSnapshot,
  deleteCurrentStateEntryCore,
  entryDateTimeOf,
  undoCurrentStateEntryDeleteCore,
} from "@/db/current-state-history-dao";
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { firstNonBlank } from "@/db/legacy-fuel-mapping";
import {
  addMemoryCore,
  deleteMemoryNowCore,
  editMemoryCore,
  type MemorySnapshot,
  undoMemoryDeleteCore,
} from "@/db/memories-dao";
import {
  addOffLimitsCore,
  deleteOffLimitsCore,
  type OffLimitsSnapshot,
  undoDeleteOffLimitsCore,
} from "@/db/off-limits-dao";
import { editTouchpointFullCore } from "@/db/recency-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
import type { LinkSource } from "@/db/undo-restore";

// --- Types -------------------------------------------------------------------

/** Where an entry can be moved to (D-84). */
export type KnowledgeSection =
  | "memory"
  | "thought_of_them"
  | "gift_idea"
  | "last_talked_about"
  | "off_limits";

export type KnowledgeTable =
  | "memories"
  | "current_state_entries"
  | "off_limits";

export interface KnowledgeEntryRef {
  table: KnowledgeTable;
  id: number;
  contactId: number;
}

/** The memory types a move may land on or leave (imported never does). */
type MovableMemoryType = "general" | "thought_of_them" | "gift_idea";

const SECTION_MEMORY_TYPE: Partial<
  Record<KnowledgeSection, MovableMemoryType>
> = {
  memory: "general",
  thought_of_them: "thought_of_them",
  gift_idea: "gift_idea",
};

const MOVABLE_MEMORY_TYPES: readonly string[] = [
  "general",
  "thought_of_them",
  "gift_idea",
];

/** The source cannot be moved (Current Location, imported, unknown table). */
export class KnowledgeMoveSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnowledgeMoveSourceError";
  }
}

/** The target is not a movable section, or is the section the entry is in. */
export class KnowledgeMoveTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnowledgeMoveTargetError";
  }
}

/** Undo cannot run: the moved entry no longer exists (this plan only). */
export class KnowledgeMoveUndoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnowledgeMoveUndoError";
  }
}

/** What a move needs to be undone (D-118). */
export type KnowledgeMoveUndo =
  | {
      kind: "type_change";
      ref: KnowledgeEntryRef;
      fromType: string;
    }
  | {
      kind: "cross_table";
      source:
        | { table: "memories"; snapshot: MemorySnapshot }
        | { table: "current_state_entries"; snapshot: CurrentStateSnapshot }
        | { table: "off_limits"; snapshot: OffLimitsSnapshot };
      destination: { table: KnowledgeTable; uid: string; contactId: number };
      target: KnowledgeSection;
    };

export interface KnowledgeMoveResult {
  /** The entry where it now lives. */
  ref: KnowledgeEntryRef;
  undo: KnowledgeMoveUndo;
}

export interface KnowledgeMoveOptions {
  /** Default true. False when an outer write bumps the revision once itself. */
  bumpRevision?: boolean;
  /**
   * Default true. Applies only to an unlinked Last Talked About entry moving
   * into a memory type: true copies its entry date into `meaningful_date`;
   * false leaves it NULL (plan 08's share chip moves, where the date was
   * synthesized by the app; convergence c10, D-46, D-77).
   */
  carryEntryDate?: boolean;
  /**
   * Local `YYYY-MM-DD`. Applies only when the target is Last Talked About and
   * the source is unlinked; replaces the meaningful-date / created-at
   * fallback (plan 08 passes today's date, D-46).
   */
  entryDate?: string;
}

export interface MoveKnowledgeEntryInput extends KnowledgeMoveOptions {
  ref: KnowledgeEntryRef;
  target: KnowledgeSection;
  /** Local `localDateTime` stamp. */
  now: string;
}

// --- Pure helpers --------------------------------------------------------------

const ISO_DATE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;

function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim().length === 0;
}

function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

/**
 * Whether a memory's meaningful date can become a Last Talked About entry
 * date: a real `YYYY-MM-DD` that is not after `today` (D-101 caps those
 * pickers at today). Shared by the move's date mapping and
 * `fieldsDroppedByMove`, so the two never disagree (convergence c11).
 */
export function isMappableMeaningfulDate(
  value: string | null | undefined,
  today: string,
): value is string {
  return typeof value === "string" && isValidIsoDate(value) && value <= today;
}

function sectionTable(section: KnowledgeSection): KnowledgeTable {
  if (section === "last_talked_about") return "current_state_entries";
  if (section === "off_limits") return "off_limits";
  return "memories";
}

function isKnowledgeSection(value: unknown): value is KnowledgeSection {
  return (
    value === "memory" ||
    value === "thought_of_them" ||
    value === "gift_idea" ||
    value === "last_talked_about" ||
    value === "off_limits"
  );
}

function dateOf(stamp: string, fallback: string): string {
  const prefix = stamp.trim().slice(0, 10);
  return ISO_DATE.test(prefix) ? prefix : fallback.slice(0, 10);
}

/** The fields of an entry `fieldsDroppedByMove` looks at. */
export type KnowledgeMoveEntry =
  | {
      table: "memories";
      row: {
        type: string;
        custom_label: string | null;
        value: string | null;
        note: string | null;
        meaningful_date: string | null;
        pinned: number;
        outdated: number;
        hidden: number | null;
        interaction_id: number | null;
      };
    }
  | {
      table: "current_state_entries";
      row: { interaction_id: number | null };
    }
  | {
      table: "off_limits";
      row: { label: string | null; text: string | null };
    };

/** A user-facing name in D-85's confirm list. */
export type DroppedFieldName =
  | "note"
  | "meaningful date"
  | "pinned"
  | "outdated"
  | "visibility setting"
  | "label"
  | "linked note"
  | "entry date";

/**
 * D-85's confirm list: the user-set fields on this entry that the destination
 * cannot hold, in a stable order. Pure; `today` is a local `YYYY-MM-DD`
 * (callers pass `formatLocalDate(now)`). Nothing is listed for a move within
 * memories, for Last Talked About into a memory (its date becomes the
 * memory's meaningful date, or stays on the linked interaction), or for Off
 * Limits into a memory. There is no "entry time" item: a direct entry stores
 * a date only (D-48).
 */
export function fieldsDroppedByMove(
  entry: KnowledgeMoveEntry,
  target: KnowledgeSection,
  today: string,
): DroppedFieldName[] {
  const targetTable = sectionTable(target);
  if (targetTable === entry.table || targetTable === "memories") {
    // Within one table, or into a memory (which can hold everything moved).
    return [];
  }
  const dropped: DroppedFieldName[] = [];
  if (entry.table === "memories") {
    const row = entry.row;
    const linked = row.interaction_id !== null;
    if (!isBlank(row.note)) dropped.push("note");
    if (row.meaningful_date !== null) {
      const becomesEntryDate =
        targetTable === "current_state_entries" &&
        !linked &&
        isMappableMeaningfulDate(row.meaningful_date, today);
      if (!becomesEntryDate) dropped.push("meaningful date");
    }
    if (row.pinned === 1) dropped.push("pinned");
    if (row.outdated === 1) dropped.push("outdated");
    if (row.hidden !== null) dropped.push("visibility setting");
    if (
      targetTable === "current_state_entries" &&
      !isBlank(row.value) &&
      !isBlank(row.custom_label)
    ) {
      // firstNonBlank(value, custom_label, url) keeps the value.
      dropped.push("label");
    }
    if (targetTable === "off_limits" && linked) dropped.push("linked note");
    return dropped;
  }
  if (entry.table === "current_state_entries") {
    // Only Off Limits remains as a cross-table target here.
    dropped.push(
      entry.row.interaction_id === null ? "entry date" : "linked note",
    );
    return dropped;
  }
  // Off Limits into Last Talked About: firstNonBlank(text, label, url).
  if (!isBlank(entry.row.text) && !isBlank(entry.row.label)) {
    dropped.push("label");
  }
  return dropped;
}

// --- Source reads ----------------------------------------------------------------

interface MemorySource {
  id: number;
  uid: string;
  contact_id: number;
  type: string;
  custom_label: string | null;
  value: string | null;
  url: string | null;
  meaningful_date: string | null;
  provenance: string;
  created_at: string;
  allow_ai: number;
  interaction_id: number | null;
  link_source: string | null;
  group_note_copy: number;
}

interface CurrentStateSource {
  id: number;
  uid: string;
  contact_id: number;
  field_key: string;
  value: string;
  entry_date: string;
  url: string | null;
  interaction_id: number | null;
  link_source: string | null;
  group_note_copy: number;
  from_share: number;
  created_at: string;
}

interface OffLimitsSource {
  id: number;
  uid: string;
  contact_id: number;
  label: string | null;
  text: string | null;
  url: string | null;
  group_note_copy: number;
  from_share: number;
  created_at: string;
}

type Source =
  | { table: "memories"; row: MemorySource }
  | { table: "current_state_entries"; row: CurrentStateSource }
  | { table: "off_limits"; row: OffLimitsSource };

function noMatch(ref: KnowledgeEntryRef): Error {
  return new Error(
    `moveKnowledgeEntry: no ${ref.table} entry matched id=${ref.id} for contactId=${ref.contactId}`,
  );
}

async function readSource(
  exec: SqlExecutor,
  ref: KnowledgeEntryRef,
): Promise<Source> {
  if (ref.table === "memories") {
    const row = await exec.getFirstAsync<MemorySource>(
      `SELECT id, uid, contact_id, type, custom_label, value, url,
              meaningful_date, provenance, created_at, allow_ai,
              interaction_id, link_source, group_note_copy
         FROM memories
        WHERE id = ? AND contact_id = ? AND deleted_at IS NULL`,
      [ref.id, ref.contactId],
    );
    if (!row) throw noMatch(ref);
    if (!MOVABLE_MEMORY_TYPES.includes(row.type)) {
      throw new KnowledgeMoveSourceError(
        `moveKnowledgeEntry: a ${row.type} memory cannot be moved`,
      );
    }
    return { table: "memories", row };
  }
  if (ref.table === "current_state_entries") {
    const row = await exec.getFirstAsync<CurrentStateSource>(
      `SELECT id, uid, contact_id, field_key, value, entry_date, url,
              interaction_id, link_source, group_note_copy, from_share,
              created_at
         FROM current_state_entries
        WHERE id = ? AND contact_id = ?`,
      [ref.id, ref.contactId],
    );
    if (!row) throw noMatch(ref);
    // D-84 makes Last Talked About movable, not Current Location (F-D7).
    if (row.field_key !== "last_talked_about") {
      throw new KnowledgeMoveSourceError(
        `moveKnowledgeEntry: a ${row.field_key} entry cannot be moved`,
      );
    }
    return { table: "current_state_entries", row };
  }
  if (ref.table === "off_limits") {
    const row = await exec.getFirstAsync<OffLimitsSource>(
      `SELECT id, uid, contact_id, label, text, url, group_note_copy,
              from_share, created_at
         FROM off_limits
        WHERE id = ? AND contact_id = ?`,
      [ref.id, ref.contactId],
    );
    if (!row) throw noMatch(ref);
    return { table: "off_limits", row };
  }
  throw new KnowledgeMoveSourceError(
    `moveKnowledgeEntry: ${String((ref as { table: unknown }).table)} entries cannot be moved`,
  );
}

/** The linked source as it is now: its date and the note's Allow AI. */
interface LinkedSource {
  interactionId: number;
  linkSource: LinkSource;
  occurredAt: string;
  allowAi: 0 | 1;
}

async function readLinkedSource(
  exec: SqlExecutor,
  contactId: number,
  interactionId: number | null,
  linkSource: string | null,
): Promise<LinkedSource | null> {
  if (interactionId === null) return null;
  if (linkSource !== "note" && linkSource !== "group_note") return null;
  const interaction = await exec.getFirstAsync<{
    occurred_at: string;
    allow_ai: number;
    group_event_id: number | null;
  }>(
    `SELECT occurred_at, allow_ai, group_event_id
       FROM interactions WHERE id = ? AND contact_id = ?`,
    [interactionId, contactId],
  );
  if (!interaction) return null;
  if (linkSource === "note") {
    return {
      interactionId,
      linkSource,
      occurredAt: interaction.occurred_at,
      allowAi: interaction.allow_ai === 1 ? 1 : 0,
    };
  }
  const event =
    interaction.group_event_id === null
      ? null
      : await exec.getFirstAsync<{ occurred_at: string }>(
          "SELECT occurred_at FROM group_events WHERE id = ?",
          [interaction.group_event_id],
        );
  return {
    interactionId,
    linkSource,
    occurredAt: event?.occurred_at ?? interaction.occurred_at,
    // Group Note copies are always AI-off (D-98, D-102).
    allowAi: 0,
  };
}

/**
 * D-93 / D-103: turn the linked interaction's Allow AI off and set its
 * durable lock, every other field unchanged, through the single interaction
 * writer (ADR-010).
 */
async function lockInteractionNoteAi(
  exec: SqlExecutor,
  contactId: number,
  interactionId: number,
  now: string,
): Promise<void> {
  const row = await exec.getFirstAsync<{
    occurred_at: string;
    channel: string;
    direction: string | null;
    connected: number;
    quality: string | null;
    note: string | null;
    duration: number | null;
  }>(
    `SELECT occurred_at, channel, direction, connected, quality, note, duration
       FROM interactions WHERE id = ? AND contact_id = ?`,
    [interactionId, contactId],
  );
  if (!row) return;
  await editTouchpointFullCore(exec, {
    interactionId,
    contactId,
    now,
    occurredAt: row.occurred_at,
    channel: row.channel,
    direction: row.direction,
    connected: row.connected,
    quality: row.quality,
    note: row.note,
    duration: row.duration,
    allowAi: 0,
    lockNoteAi: true,
  });
}

async function uidOf(
  exec: SqlExecutor,
  table: KnowledgeTable,
  id: number,
): Promise<string> {
  const row = await exec.getFirstAsync<{ uid: string }>(
    `SELECT uid FROM ${table} WHERE id = ?`,
    [id],
  );
  if (!row) throw new Error(`moveKnowledgeEntry: new ${table} row is missing`);
  return row.uid;
}

// --- Move ----------------------------------------------------------------------

async function deleteSource(
  exec: SqlExecutor,
  source: Source,
  now: string,
): Promise<Extract<KnowledgeMoveUndo, { kind: "cross_table" }>["source"]> {
  const input = {
    id: source.row.id,
    contactId: source.row.contact_id,
    now,
    bumpRevision: false,
  };
  if (source.table === "memories") {
    return {
      table: "memories",
      snapshot: await deleteMemoryNowCore(exec, input),
    };
  }
  if (source.table === "current_state_entries") {
    return {
      table: "current_state_entries",
      snapshot: await deleteCurrentStateEntryCore(exec, input),
    };
  }
  return {
    table: "off_limits",
    snapshot: await deleteOffLimitsCore(exec, input),
  };
}

/**
 * Move one entry while the caller owns the transaction. Returns the entry's
 * new ref and what Undo needs. Bumps the revision once at its end unless
 * `bumpRevision` is false.
 */
export async function moveKnowledgeEntryCore(
  exec: SqlExecutor,
  input: MoveKnowledgeEntryInput,
): Promise<KnowledgeMoveResult> {
  const { ref, target, now } = input;
  if (!isKnowledgeSection(target)) {
    throw new KnowledgeMoveTargetError(
      `moveKnowledgeEntry: ${String(target)} is not a movable section`,
    );
  }
  const source = await readSource(exec, ref);
  const contactId = source.row.contact_id;
  const targetTable = sectionTable(target);
  const targetType = SECTION_MEMORY_TYPE[target];
  const today = now.slice(0, 10);

  let result: KnowledgeMoveResult;
  if (source.table === "memories" && targetType !== undefined) {
    // Within memories: a type change that keeps allow_ai (D-57).
    if (source.row.type === targetType) {
      throw new KnowledgeMoveTargetError(
        "moveKnowledgeEntry: the entry is already in that section",
      );
    }
    await editMemoryCore(exec, {
      id: source.row.id,
      contactId,
      type: targetType,
      now,
    });
    const movedRef: KnowledgeEntryRef = {
      table: "memories",
      id: source.row.id,
      contactId,
    };
    result = {
      ref: movedRef,
      undo: { kind: "type_change", ref: movedRef, fromType: source.row.type },
    };
  } else {
    if (source.table === targetTable) {
      throw new KnowledgeMoveTargetError(
        "moveKnowledgeEntry: the entry is already in that section",
      );
    }
    result = await moveAcrossTables(exec, source, target, now, today, input);
  }

  if (input.bumpRevision !== false) {
    await bumpDataRevisionCore(exec);
  }
  return result;
}

async function moveAcrossTables(
  exec: SqlExecutor,
  source: Source,
  target: KnowledgeSection,
  now: string,
  today: string,
  options: KnowledgeMoveOptions,
): Promise<KnowledgeMoveResult> {
  const contactId = source.row.contact_id;
  const targetTable = sectionTable(target);
  const groupNoteCopy: 0 | 1 = source.row.group_note_copy === 1 ? 1 : 0;
  // D-108: a share keeps its origin wherever it goes.
  const fromShare: 0 | 1 =
    source.table === "memories"
      ? source.row.provenance === "share"
        ? 1
        : 0
      : source.row.from_share === 1
        ? 1
        : 0;
  const createdAt = source.row.created_at;
  const link =
    source.table === "off_limits"
      ? null
      : await readLinkedSource(
          exec,
          contactId,
          source.row.interaction_id,
          source.row.link_source,
        );

  // D-93 / D-103: a note link into Off Limits locks the interaction's AI.
  // A Group Note copy carries its own marker and touches no interaction.
  if (targetTable === "off_limits" && link?.linkSource === "note") {
    await lockInteractionNoteAi(exec, contactId, link.interactionId, now);
  }

  // Delete first, so a kept link never collides with the unique link index.
  const removed = await deleteSource(exec, source, now);

  let newId: number;
  let newUidValue: string;
  if (targetTable === "memories") {
    const type = SECTION_MEMORY_TYPE[target] as MovableMemoryType;
    if (source.table === "current_state_entries") {
      const carryDate = options.carryEntryDate !== false;
      newId = await addMemoryCore(exec, {
        contactId,
        type,
        value: source.row.value,
        url: source.row.url,
        meaningfulDate:
          link === null && carryDate ? source.row.entry_date : null,
        provenance: fromShare === 1 ? "share" : "user",
        // Never wider than the source (D-13, D-31): a note link follows its
        // interaction (D-49); anything else is AI-off.
        allowAi: link?.linkSource === "note" ? link.allowAi : 0,
        interactionId: link?.interactionId ?? null,
        linkSource: link?.linkSource ?? null,
        groupNoteCopy,
        createdAt,
        now,
      });
    } else {
      const row = source.row as OffLimitsSource;
      newId = await addMemoryCore(exec, {
        contactId,
        type,
        value: firstNonBlank(row.text, row.url),
        customLabel: row.label,
        url: row.url,
        provenance: fromShare === 1 ? "share" : "user",
        // Out of Off Limits: AI-off (D-31).
        allowAi: 0,
        groupNoteCopy,
        createdAt,
        now,
      });
    }
    newUidValue = await uidOf(exec, "memories", newId);
  } else if (targetTable === "current_state_entries") {
    let value: string | null;
    let entryDate: string;
    let entryTime: string | null = null;
    if (source.table === "memories") {
      const row = source.row;
      value = firstNonBlank(row.value, row.custom_label, row.url);
      if (link !== null) {
        const at = entryDateTimeOf(link.occurredAt);
        entryDate = at.entryDate;
        entryTime = at.entryTime;
      } else {
        entryDate =
          options.entryDate ??
          (isMappableMeaningfulDate(row.meaningful_date, today)
            ? row.meaningful_date
            : dateOf(row.created_at, now));
      }
    } else {
      const row = source.row as OffLimitsSource;
      value = firstNonBlank(row.text, row.label, row.url);
      entryDate = options.entryDate ?? dateOf(row.created_at, now);
    }
    if (value === null) {
      throw new KnowledgeMoveSourceError(
        "moveKnowledgeEntry: the entry has nothing to move",
      );
    }
    newId = await addCurrentStateEntryCore(exec, {
      contactId,
      fieldKey: "last_talked_about",
      value,
      entryDate,
      entryTime,
      url: source.row.url,
      interactionId: link?.interactionId ?? null,
      linkSource: link?.linkSource ?? null,
      groupNoteCopy,
      fromShare,
      createdAt,
      now,
    });
    newUidValue = await uidOf(exec, "current_state_entries", newId);
  } else {
    // Into Off Limits: the link is dropped (D-93 handled above).
    newUidValue = newUid();
    const fields =
      source.table === "memories"
        ? { label: source.row.custom_label, text: source.row.value }
        : { label: null, text: (source.row as CurrentStateSource).value };
    newId = await addOffLimitsCore(exec, {
      uid: newUidValue,
      contactId,
      ...fields,
      url: source.row.url,
      groupNoteCopy,
      fromShare,
      createdAt,
      now,
    });
  }

  return {
    ref: { table: targetTable, id: newId, contactId },
    undo: {
      kind: "cross_table",
      source: removed,
      destination: { table: targetTable, uid: newUidValue, contactId },
      target,
    },
  };
}

/** Move one entry in one transaction; advances the revision by exactly 1. */
export function moveKnowledgeEntry(
  exec: SqlExecutor,
  input: Omit<MoveKnowledgeEntryInput, "bumpRevision">,
): Promise<KnowledgeMoveResult> {
  return inWriteTransaction(exec, () => moveKnowledgeEntryCore(exec, input));
}

/**
 * Move several entries (a multi-person share's copies, D-79) inside the
 * caller's transaction. Bumps once unless `opts.bumpRevision` is false.
 * Returns the new refs only (plan 08's `moveShareRows` contract).
 */
export async function moveKnowledgeEntriesCore(
  exec: SqlExecutor,
  refs: readonly KnowledgeEntryRef[],
  target: KnowledgeSection,
  now: string,
  opts: KnowledgeMoveOptions = {},
): Promise<KnowledgeEntryRef[]> {
  const results: KnowledgeMoveResult[] = [];
  for (const ref of refs) {
    results.push(
      await moveKnowledgeEntryCore(exec, {
        ref,
        target,
        now,
        carryEntryDate: opts.carryEntryDate,
        entryDate: opts.entryDate,
        bumpRevision: false,
      }),
    );
  }
  if (opts.bumpRevision !== false) {
    await bumpDataRevisionCore(exec);
  }
  return results.map((r) => r.ref);
}

// --- Undo ----------------------------------------------------------------------

/**
 * Undo one move while the caller owns the transaction (D-118). Never bumps,
 * never writes an interaction. Returns the restored entry's ref. Throws
 * `KnowledgeMoveUndoError` before any write when the moved entry is gone.
 */
export async function undoKnowledgeMoveCore(
  exec: SqlExecutor,
  undo: KnowledgeMoveUndo,
  now: string,
): Promise<KnowledgeEntryRef> {
  if (undo.kind === "type_change") {
    const live = await exec.getFirstAsync<{ one: number }>(
      "SELECT 1 AS one FROM memories WHERE id = ? AND contact_id = ? AND deleted_at IS NULL",
      [undo.ref.id, undo.ref.contactId],
    );
    if (!live) {
      throw new KnowledgeMoveUndoError(
        "undoKnowledgeMove: the moved entry no longer exists",
      );
    }
    await editMemoryCore(exec, {
      id: undo.ref.id,
      contactId: undo.ref.contactId,
      type: undo.fromType,
      now,
    });
    return undo.ref;
  }

  const { destination, source } = undo;
  const liveFilter =
    destination.table === "memories" ? " AND deleted_at IS NULL" : "";
  const copy = await exec.getFirstAsync<{ id: number }>(
    `SELECT id FROM ${destination.table}
      WHERE uid = ? AND contact_id = ?${liveFilter}`,
    [destination.uid, destination.contactId],
  );
  if (!copy) {
    throw new KnowledgeMoveUndoError(
      "undoKnowledgeMove: the moved entry no longer exists",
    );
  }

  // Remove the copy with a tombstone (a backup taken in the Undo window must
  // not bring it back); this also frees any link slot.
  const deleteInput = {
    id: copy.id,
    contactId: destination.contactId,
    now,
    bumpRevision: false,
  };
  if (destination.table === "memories") {
    await deleteMemoryNowCore(exec, deleteInput);
  } else if (destination.table === "current_state_entries") {
    await deleteCurrentStateEntryCore(exec, deleteInput);
  } else {
    await deleteOffLimitsCore(exec, deleteInput);
  }

  let restoredId: number;
  if (source.table === "memories") {
    // A move into Off Limits stays AI-off after Undo (D-118). A restored note
    // link takes the interaction's Allow AI, which the move locked at 0.
    const snapshot =
      undo.target === "off_limits"
        ? { ...source.snapshot, allow_ai: 0 }
        : source.snapshot;
    restoredId = await undoMemoryDeleteCore(exec, snapshot, now);
  } else if (source.table === "current_state_entries") {
    restoredId = await undoCurrentStateEntryDeleteCore(
      exec,
      source.snapshot,
      now,
    );
  } else {
    restoredId = await undoDeleteOffLimitsCore(exec, source.snapshot, now);
  }
  return {
    table: source.table,
    id: restoredId,
    contactId: source.snapshot.contact_id,
  };
}

/** Undo one move in one transaction; advances the revision by exactly 1. */
export function undoKnowledgeMove(
  exec: SqlExecutor,
  undo: KnowledgeMoveUndo,
  now: string,
): Promise<KnowledgeEntryRef> {
  return inWriteTransaction(exec, async () => {
    const ref = await undoKnowledgeMoveCore(exec, undo, now);
    await bumpDataRevisionCore(exec);
    return ref;
  });
}
