/**
 * Interaction Detail presentation logic (HIST-11, D-04, D-12).
 *
 * Pure, node-tested projection behind the `InteractionDetail` surface. It owns
 * three rules the UI enforces at the privacy/consistency edge, kept out of the
 * `.tsx` (which imports react-native and cannot load in the node env):
 *
 *   • buildDetailRows() — projects an interaction into the ORDERED set of
 *     present-only detail fields. An absent field produces NO row (no blank
 *     fields — dossier §V / HIST-11): a null/blank note, absent Tone, or absent
 *     duration are omitted entirely rather than rendered empty.
 *   • showSparkle() — the Allow-AI sparkle is shown strictly when `allow_ai === 1`
 *     and NEVER otherwise (default OFF — D-04). This is the only trigger; nothing
 *     else in the module gates the sparkle.
 *   • buildGroupContext() — the group-context shaper is DORMANT SEAM code (D-12).
 *     It shapes context (badge / group title / group note / participant note /
 *     view-group flag) ONLY when the `isGroupLinked` seam predicate is true. In
 *     Phase 32 no interaction carries a group-event id, so the predicate is
 *     hard-false for every real record and no group context is ever produced.
 *     A synthetic in-memory input with the id forced set exercises the shape for
 *     Phase 33 — WITHOUT any group schema (the module references no group-event
 *     column). The group note is kept DISTINCT from the participant note; it is
 *     never concatenated (ADR-078 / D-04).
 *
 * No SQL, no react-native, no network — a pure value transform.
 */
import { formatDurationLabel } from "@/components/touchpoint-refine-logic";
import { isGroupLinked } from "@/db/history-read";

/** The interaction fields this surface projects (mirrors history-read's record). */
export interface InteractionDetailInput {
  readonly channel: string;
  /** Local wall-clock `YYYY-MM-DD HH:MM:SS` (never routed through UTC ISO). */
  readonly occurredAt: string;
  readonly direction: string | null;
  readonly connected: number;
  /** Tone (the migrated `quality` vocabulary). */
  readonly quality: string | null;
  readonly duration: number | null;
  readonly note: string | null;
  readonly allowAi: number;
}

/**
 * A group-linked input variant carrying the (Phase-33) group-event id + group
 * fields. In Phase 32 no real record supplies `groupEventId`, so the predicate is
 * false; a synthetic value forces the dormant shape true for tests.
 */
export interface GroupLinkedDetailInput extends InteractionDetailInput {
  readonly groupEventId?: number | null;
  readonly groupTitle?: string | null;
  readonly groupNote?: string | null;
}

/** One present-only detail row. `value` is never blank (absent fields omitted). */
export interface DetailRow {
  readonly key:
    | "channel"
    | "datetime"
    | "direction"
    | "connected"
    | "tone"
    | "duration"
    | "note";
  readonly label: string;
  readonly value: string;
}

/** The dormant group-context shape (seam — never produced in Phase 32). */
export interface GroupContext {
  readonly badge: string;
  readonly groupTitle: string;
  /** Shared group note — a DISTINCT field, never merged into the participant note. */
  readonly groupNote: string | null;
  /** The participant's own note, kept separate from the group note. */
  readonly participantNote: string | null;
  readonly showViewGroupEvent: true;
}

const hasText = (value: string | null | undefined): value is string =>
  value != null && value.trim().length > 0;

/**
 * Project an interaction into its ordered present-only detail rows. Absent fields
 * (unspecified channel, null direction, null Tone, null/zero duration, blank note)
 * produce NO row — there are never blank fields (HIST-11).
 */
export function buildDetailRows(interaction: InteractionDetailInput): DetailRow[] {
  const rows: DetailRow[] = [];

  if (hasText(interaction.channel) && interaction.channel !== "unspecified") {
    rows.push({ key: "channel", label: "Channel", value: interaction.channel });
  }

  // occurredAt is required — always present. Local wall-clock string as-is.
  rows.push({ key: "datetime", label: "When", value: interaction.occurredAt });

  if (hasText(interaction.direction)) {
    rows.push({
      key: "direction",
      label: "Direction",
      value: interaction.direction,
    });
  }

  // Connected is always a known state — surfaced textually (never colour-only).
  rows.push({
    key: "connected",
    label: "Connected",
    value: interaction.connected === 0 ? "No reply" : "Connected",
  });

  if (hasText(interaction.quality)) {
    rows.push({ key: "tone", label: "Tone", value: interaction.quality });
  }

  if (interaction.duration != null && interaction.duration > 0) {
    rows.push({
      key: "duration",
      label: "Duration",
      value: formatDurationLabel(interaction.duration),
    });
  }

  if (hasText(interaction.note)) {
    rows.push({ key: "note", label: "Note", value: interaction.note.trim() });
  }

  return rows;
}

/**
 * The Allow-AI sparkle visibility (D-04). True STRICTLY when `allow_ai === 1`;
 * false for 0 / undefined / anything else. This is the sole trigger.
 */
export function showSparkle(interaction: { allowAi?: number }): boolean {
  return interaction.allowAi === 1;
}

/**
 * Shape the dormant group context (D-12). Returns null unless the `isGroupLinked`
 * seam predicate is true — which requires a group-event id that no Phase-32 record
 * carries, so this is null for every real interaction this phase. The group note
 * is preserved as its own field, never concatenated into the participant note.
 */
export function buildGroupContext(
  interaction: GroupLinkedDetailInput,
): GroupContext | null {
  if (!isGroupLinked({ groupEventId: interaction.groupEventId })) {
    return null;
  }
  return {
    badge: "Group event",
    groupTitle: interaction.groupTitle ?? "",
    groupNote: hasText(interaction.groupNote) ? interaction.groupNote : null,
    participantNote: hasText(interaction.note) ? interaction.note : null,
    showViewGroupEvent: true,
  };
}
