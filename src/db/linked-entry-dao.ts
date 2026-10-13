/**
 * Linked notes (Phase 38.10 D-37, D-38, D-41, D-48, D-49, D-95, D-96, D-98,
 * D-102, D-103, D-113, D-117; RESEARCH 3.2 option B).
 *
 * A linked entry is a copy whose text the interaction owns. Each entry keeps
 * its own text, date and flag, plus `interaction_id` (FK ON DELETE SET NULL)
 * and `link_source`:
 * - `note`: the interaction's own note. Editing either side updates both
 *   (D-37); one Allow AI switch covers both (D-49). A linked note cannot be
 *   cleared to blank (`LinkedNoteBlankError`, Research Q4).
 * - `group_note`: a copy of a Group Note made for one participant (D-96). It
 *   carries `group_note_copy = 1` for good and is always AI-off (D-98, D-102;
 *   ADR-078, ADR-136). Only the Group Note side propagates; editing a copy, or
 *   clearing the Group Note, detaches copies (D-113, D-117).
 *
 * At most one entry per `(interaction_id, link_source)` across both entry
 * tables (D-95); the per-table partial UNIQUE indexes (migration 033) cannot
 * see across tables, so this module checks both.
 *
 * Import graph (cycle-free, checker W9): this module imports no DAO except the
 * registry and writes its rows with its own `?`-bound SQL that mirrors
 * `addMemoryCore` / `addCurrentStateEntryCore`. It writes only entry rows and
 * the interaction's `allow_ai` flag (precedent: ai-permissions-dao's scoped
 * UPDATE). The interaction note is written only by `editTouchpointFullCore`
 * (ADR-010), and `group_events.group_note` only by `updateGroupEventCore`.
 * No SQLite triggers (RESEARCH 3.2 option C rejected).
 *
 * Cores only: nothing here opens a transaction or bumps the data revision.
 */
import {
  CURRENT_STATE_FIELD_REGISTRY,
  isMemoryTypeKey,
  MEMORY_TYPE_REGISTRY,
  type MemoryTypeKey,
} from "@/db/memory-registry";
import type { ReadOnlyExecutor } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
import type { LinkSource } from "@/db/undo-restore";

// --- Sections ----------------------------------------------------------------

/** Where an interaction note can also be saved (D-38, D-95: at most one). */
export type LinkedSection =
  | "last_talked_about"
  | "memory"
  | "gift_idea"
  | "thought_of_them";

export const LINKED_SECTIONS: readonly LinkedSection[] = [
  "last_talked_about",
  "memory",
  "gift_idea",
  "thought_of_them",
];

type LinkedMemoryType = Extract<
  MemoryTypeKey,
  "general" | "gift_idea" | "thought_of_them"
>;

const SECTION_MEMORY_TYPE: Record<
  Exclude<LinkedSection, "last_talked_about">,
  LinkedMemoryType
> = {
  memory: "general",
  gift_idea: "gift_idea",
  thought_of_them: "thought_of_them",
};

export function isLinkedSection(value: unknown): value is LinkedSection {
  return (
    typeof value === "string" &&
    (LINKED_SECTIONS as readonly string[]).includes(value)
  );
}

/** The section a memory type belongs to, or null for imported/unknown. */
export function linkedSectionOfMemoryType(type: string): LinkedSection | null {
  switch (type) {
    case "general":
      return "memory";
    case "gift_idea":
      return "gift_idea";
    case "thought_of_them":
      return "thought_of_them";
    default:
      return null;
  }
}

/** The section's label from the registry (D-89: one label source). */
export function linkedSectionLabel(section: LinkedSection): string {
  if (section === "last_talked_about") {
    return CURRENT_STATE_FIELD_REGISTRY.last_talked_about.displayName;
  }
  return MEMORY_TYPE_REGISTRY[SECTION_MEMORY_TYPE[section]].displayName;
}

// --- Typed errors --------------------------------------------------------------

/** D-95: the interaction already has an entry linked from this note. */
export class LinkedSectionTakenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LinkedSectionTakenError";
  }
}

/**
 * Research Q4: a participant's own linked note cannot be cleared to blank
 * while it is linked (one text in two places; the entry's own non-blank
 * rule). Group Notes do not use this (D-113 detaches their copies instead).
 */
export class LinkedNoteBlankError extends Error {
  constructor(message = "A linked note cannot be blank") {
    super(message);
    this.name = "LinkedNoteBlankError";
  }
}

/** D-98 / D-102: a Group Note copy can never be switched on for AI. */
export class GroupNoteAiLockedError extends Error {
  constructor(message = "Group Note copies are never shared with AI") {
    super(message);
    this.name = "GroupNoteAiLockedError";
  }
}

/** D-103: the linked interaction note was moved into Off Limits for good. */
export class InteractionNoteAiLockedError extends Error {
  constructor(message = "This note was moved to Off Limits; AI stays off") {
    super(message);
    this.name = "InteractionNoteAiLockedError";
  }
}

/** D-41: a linked Last Talked About entry takes its date from the interaction. */
export class LinkedEntryDateError extends Error {
  constructor(
    message = "A linked entry's date follows its interaction and cannot be edited",
  ) {
    super(message);
    this.name = "LinkedEntryDateError";
  }
}

// --- Entry date and time -------------------------------------------------------

const ENTRY_TIME = /^[0-9]{2}:[0-9]{2}:[0-9]{2}$/;
const ENTRY_TIME_MINUTE = /^[0-9]{2}:[0-9]{2}$/;
const LOCAL_DATE_TIME =
  /^([0-9]{4}-[0-9]{2}-[0-9]{2})(?:[ T]([0-9]{2}:[0-9]{2}(?::[0-9]{2})?))?/;

/**
 * `entry_time` is always the zero-padded `HH:MM:SS` shape of
 * `substr(created_at,12,8)`, so the order's COALESCE compares like with like
 * (checker cycle 2 I-4). A bare `HH:MM` is padded with `:00`; anything else
 * throws. (Re-exported by current-state-history-dao.)
 */
export function normalizeEntryTime(value: string): string {
  const padded = ENTRY_TIME_MINUTE.test(value) ? `${value}:00` : value;
  if (!ENTRY_TIME.test(padded)) {
    throw new Error(
      `current-state-history-dao: entry time must be HH:MM:SS (got ${value})`,
    );
  }
  return padded;
}

/**
 * The entry date and time a linked entry takes from its interaction's local
 * `occurred_at` (D-37, D-41, D-48): the date part, and the time part in the
 * `HH:MM:SS` shape (NULL when the stamp has no time). Pure string slicing;
 * never a UTC conversion.
 */
export function entryDateTimeOf(occurredAt: string): {
  entryDate: string;
  entryTime: string | null;
} {
  const match = LOCAL_DATE_TIME.exec(occurredAt.trim());
  if (!match) {
    throw new Error(
      `current-state-history-dao: unparseable occurred_at ${occurredAt}`,
    );
  }
  return {
    entryDate: match[1],
    entryTime: match[2] === undefined ? null : normalizeEntryTime(match[2]),
  };
}

// --- Helpers -------------------------------------------------------------------

function isNonBlank(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function blankToNull(value: string | null | undefined): string | null {
  return isNonBlank(value) ? value : null;
}

/** SQLite's bound-parameter ceiling is 999 on older builds; stay well below. */
const ID_CHUNK = 500;

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

/** True when either entry table already links `(interactionId, linkSource)`. */
async function linkSlotTaken(
  exec: ReadOnlyExecutor,
  interactionId: number,
  linkSource: LinkSource,
): Promise<boolean> {
  // Soft-deleted memories still hold the slot in the partial UNIQUE index.
  const row = await exec.getFirstAsync<{ one: number }>(
    `SELECT 1 AS one FROM memories WHERE interaction_id = ? AND link_source = ?
     UNION ALL
     SELECT 1 AS one FROM current_state_entries
      WHERE interaction_id = ? AND link_source = ?`,
    [interactionId, linkSource, interactionId, linkSource],
  );
  return row !== null;
}

// --- Insert --------------------------------------------------------------------

export interface InsertLinkedEntryInput {
  interactionId: number;
  /** The interaction's contact; the entry is always on the same contact. */
  contactId: number;
  section: LinkedSection;
  /** The note (or Group Note) text; must be non-blank. */
  text: string;
  url?: string | null;
  linkSource: LinkSource;
  /** The interaction's (or event's) local `occurred_at` (D-41, D-48). */
  occurredAt: string;
  now: string;
}

export interface LinkedEntryRef {
  table: "memories" | "current_state_entries";
  id: number;
}

/**
 * Insert one linked entry while the caller owns the transaction.
 *
 * - D-95: refuses (`LinkedSectionTakenError`) when either table already holds
 *   an entry for `(interactionId, linkSource)`.
 * - Last Talked About: `entry_date` / `entry_time` from `occurredAt` (D-41,
 *   D-48), time in the `HH:MM:SS` shape.
 * - Memory types: provenance `user`; allow_ai follows the interaction for a
 *   `note` link (its stored, clamped value, so 0 under `note_ai_locked`;
 *   D-49, D-103) and is 0 for a `group_note` copy (D-98).
 * - `group_note` rows in either table get `group_note_copy = 1` (D-102).
 *
 * Allow AI is never taken from the caller: it is the interaction's own switch.
 */
export async function insertLinkedEntryCore(
  exec: SqlExecutor,
  input: InsertLinkedEntryInput,
): Promise<LinkedEntryRef> {
  if (!isLinkedSection(input.section)) {
    throw new Error("linked-entry-dao: unknown section");
  }
  if (input.linkSource !== "note" && input.linkSource !== "group_note") {
    throw new Error("linked-entry-dao: unknown link source");
  }
  if (!isNonBlank(input.text)) {
    throw new Error("linked-entry-dao: a linked entry needs non-blank text");
  }
  const interaction = await exec.getFirstAsync<{
    allow_ai: number;
    note_ai_locked: number;
  }>(
    `SELECT allow_ai, note_ai_locked FROM interactions
      WHERE id = ? AND contact_id = ?`,
    [input.interactionId, input.contactId],
  );
  if (!interaction) {
    throw new Error(
      `linked-entry-dao: no interaction matched id=${input.interactionId} for contactId=${input.contactId}`,
    );
  }
  if (await linkSlotTaken(exec, input.interactionId, input.linkSource)) {
    throw new LinkedSectionTakenError(
      `linked-entry-dao: interaction ${input.interactionId} already has a ${input.linkSource} entry`,
    );
  }
  const groupNoteCopy = input.linkSource === "group_note" ? 1 : 0;

  if (input.section === "last_talked_about") {
    const { entryDate, entryTime } = entryDateTimeOf(input.occurredAt);
    const inserted = await exec.runAsync(
      `INSERT INTO current_state_entries
         (uid, contact_id, field_key, value, entry_date, entry_time, url,
          interaction_id, link_source, group_note_copy, from_share,
          created_at, modified_at)
       VALUES (?, ?, 'last_talked_about', ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        newUid(),
        input.contactId,
        input.text,
        entryDate,
        entryTime,
        blankToNull(input.url),
        input.interactionId,
        input.linkSource,
        groupNoteCopy,
        input.now,
        input.now,
      ],
    );
    return { table: "current_state_entries", id: inserted.lastInsertRowId };
  }

  const allowAi =
    groupNoteCopy === 1 ||
    interaction.note_ai_locked === 1 ||
    interaction.allow_ai !== 1
      ? 0
      : 1;
  const inserted = await exec.runAsync(
    `INSERT INTO memories
       (uid, contact_id, type, custom_label, value, note, url, meaningful_date,
        pinned, outdated, hidden, provenance, created_at, modified_at, allow_ai,
        interaction_id, link_source, group_note_copy)
     VALUES (?, ?, ?, NULL, ?, NULL, ?, NULL, 0, 0, NULL, 'user', ?, ?, ?, ?, ?, ?)`,
    [
      newUid(),
      input.contactId,
      SECTION_MEMORY_TYPE[input.section],
      input.text,
      blankToNull(input.url),
      input.now,
      input.now,
      allowAi,
      input.interactionId,
      input.linkSource,
      groupNoteCopy,
    ],
  );
  return { table: "memories", id: inserted.lastInsertRowId };
}

// --- Reads ---------------------------------------------------------------------

export interface LinkedInteractionRef {
  interactionId: number;
  contactId: number;
  groupEventId: number | null;
}

/**
 * Where a linked entry's interaction lives (checker B5), or null when the
 * interaction no longer exists. `linkedEntryRoute` maps it to a route.
 */
export async function getLinkedInteractionRefCore(
  exec: ReadOnlyExecutor,
  interactionId: number,
): Promise<LinkedInteractionRef | null> {
  const row = await exec.getFirstAsync<{
    id: number;
    contact_id: number;
    group_event_id: number | null;
  }>("SELECT id, contact_id, group_event_id FROM interactions WHERE id = ?", [
    interactionId,
  ]);
  if (!row) return null;
  return {
    interactionId: row.id,
    contactId: row.contact_id,
    groupEventId: row.group_event_id,
  };
}

export interface LinkedEntry {
  table: "memories" | "current_state_entries";
  id: number;
  contactId: number;
  interactionId: number;
  linkSource: LinkSource;
  section: LinkedSection;
  label: string;
}

/**
 * The live linked entries of these interactions, both tables, in one UNION
 * lookup per chunk. Soft-deleted memories and memories of a non-linkable type
 * are left out. `linkSource` is part of the contract (plan 12's blank-note
 * pre-check filters on it; checker cycle 5 W-4).
 */
export async function getLinkedEntriesCore(
  exec: ReadOnlyExecutor,
  interactionIds: readonly number[],
): Promise<LinkedEntry[]> {
  const unique = [...new Set(interactionIds)];
  const out: LinkedEntry[] = [];
  for (const ids of chunks(unique, ID_CHUNK)) {
    const marks = placeholders(ids.length);
    const rows = await exec.getAllAsync<{
      tbl: "memories" | "current_state_entries";
      id: number;
      contact_id: number;
      interaction_id: number;
      link_source: string;
      kind: string;
    }>(
      `SELECT 'memories' AS tbl, id, contact_id, interaction_id, link_source,
              type AS kind
         FROM memories
        WHERE interaction_id IN (${marks})
          AND link_source IS NOT NULL
          AND deleted_at IS NULL
       UNION ALL
       SELECT 'current_state_entries' AS tbl, id, contact_id, interaction_id,
              link_source, field_key AS kind
         FROM current_state_entries
        WHERE interaction_id IN (${marks})
          AND link_source IS NOT NULL
        ORDER BY interaction_id, tbl, id`,
      [...ids, ...ids],
    );
    for (const row of rows) {
      if (row.link_source !== "note" && row.link_source !== "group_note") {
        continue;
      }
      const section: LinkedSection | null =
        row.tbl === "current_state_entries"
          ? row.kind === "last_talked_about"
            ? "last_talked_about"
            : null
          : isMemoryTypeKey(row.kind)
            ? linkedSectionOfMemoryType(row.kind)
            : null;
      if (section === null) continue;
      out.push({
        table: row.tbl,
        id: row.id,
        contactId: row.contact_id,
        interactionId: row.interaction_id,
        linkSource: row.link_source,
        section,
        label: linkedSectionLabel(section),
      });
    }
  }
  return out;
}

// --- Propagation from the interaction side ------------------------------------------

export interface PropagateInteractionEditInput {
  interactionId: number;
  /** The interaction's note as now stored. */
  note: string | null;
  /** The interaction's local `occurred_at` as now stored. */
  occurredAt: string;
  /** The interaction's stored (clamped) allow_ai, never the caller's request. */
  allowAi: number;
  now: string;
}

/**
 * Copy an interaction edit onto its `note`-linked entry (D-37, D-41, D-48,
 * D-49). Called by `editTouchpointFullCore` in the same transaction, after its
 * UPDATE. `group_note` copies are never touched here.
 *
 * - A blank note while linked throws `LinkedNoteBlankError` (Q4).
 * - The text goes to the entry; a linked Last Talked About entry takes the
 *   interaction's date and `HH:MM:SS` time; a linked memory takes the
 *   interaction's stored allow_ai (0 on a Group Note copy, D-102).
 * - Rows already equal are not rewritten, so `modified_at` moves only on a
 *   real change.
 */
export async function propagateInteractionEditCore(
  exec: SqlExecutor,
  input: PropagateInteractionEditInput,
): Promise<void> {
  const linked = await exec.getFirstAsync<{ one: number }>(
    `SELECT 1 AS one FROM memories
      WHERE interaction_id = ? AND link_source = 'note'
     UNION ALL
     SELECT 1 AS one FROM current_state_entries
      WHERE interaction_id = ? AND link_source = 'note'`,
    [input.interactionId, input.interactionId],
  );
  if (!linked) return;
  if (!isNonBlank(input.note)) {
    throw new LinkedNoteBlankError(
      "A note saved to a section cannot be blank while it is linked",
    );
  }
  const allowAi = input.allowAi === 1 ? 1 : 0;
  await exec.runAsync(
    `UPDATE memories
        SET value = ?,
            allow_ai = CASE WHEN group_note_copy = 1 THEN 0 ELSE ? END,
            modified_at = ?
      WHERE interaction_id = ? AND link_source = 'note'
        AND (value IS NOT ?
             OR allow_ai IS NOT CASE WHEN group_note_copy = 1 THEN 0 ELSE ? END)`,
    [input.note, allowAi, input.now, input.interactionId, input.note, allowAi],
  );
  const { entryDate, entryTime } = entryDateTimeOf(input.occurredAt);
  await exec.runAsync(
    `UPDATE current_state_entries
        SET value = ?, entry_date = ?, entry_time = ?, modified_at = ?
      WHERE interaction_id = ? AND link_source = 'note'
        AND (value IS NOT ? OR entry_date IS NOT ? OR entry_time IS NOT ?)`,
    [
      input.note,
      entryDate,
      entryTime,
      input.now,
      input.interactionId,
      input.note,
      entryDate,
      entryTime,
    ],
  );
}

/**
 * The single Allow AI switch, interaction side (D-49): a scoped UPDATE of the
 * interaction's flag only, clamped to 0 in SQL while `note_ai_locked = 1`
 * (D-103). Returns the stored value. The caller syncs any memory partner.
 */
export async function setLinkedAllowAiCore(
  exec: SqlExecutor,
  input: { interactionId: number; allowAi: number; now: string },
): Promise<0 | 1> {
  const result = await exec.runAsync(
    `UPDATE interactions
        SET allow_ai = CASE WHEN note_ai_locked = 1 THEN 0 ELSE ? END,
            modified_at = ?
      WHERE id = ?`,
    [input.allowAi === 1 ? 1 : 0, input.now, input.interactionId],
  );
  if (result.changes !== 1) {
    throw new Error(
      `setLinkedAllowAi: no interaction matched id=${input.interactionId} (changed ${result.changes})`,
    );
  }
  const row = await exec.getFirstAsync<{ allow_ai: number }>(
    "SELECT allow_ai FROM interactions WHERE id = ?",
    [input.interactionId],
  );
  return row?.allow_ai === 1 ? 1 : 0;
}
