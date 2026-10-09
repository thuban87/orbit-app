/**
 * History stream model (38.8 D-14/D-15/D-18, D-33..D-36, D-39, D-62).
 *
 * Pure, DB-free model behind the Profile History stream: the contact's records,
 * newest first, grouped year → month → day. It imports NO DAO, store, component
 * or React — only record TYPES from the canonical read (ADR-119) — so every
 * ordering, grouping, chunking and label rule is node-testable, in the same
 * style as `history-section-logic.ts`.
 *
 *   • Ordering (D-18): timestamp descending, then family rank (interaction,
 *     lifecycle, knowledge), then id descending. Keys are `${family}-${id}`:
 *     interaction, event and knowledge ids are independent sequences.
 *   • Grouping (D-15/D-18/D-36): only years with records get a row, plus the
 *     current year, which is always present (empty when it has no records).
 *   • View state (D-34/D-39/D-62): only the current year is open on a fresh
 *     mount; an older year opens on tap; an open year shows its newest
 *     STREAM_INITIAL_VISIBLE records and Show older adds STREAM_CHUNK more.
 *     A cut never splits a day. Across a re-read while mounted, each open year
 *     is pinned to the oldest record it rendered, so records added above the
 *     user never push it out (D-31; CR-01). The state is transient and never
 *     persisted.
 *   • Rows open the canonical InteractionDetail / MemoryHistory (ADR-122); the
 *     three record families are preserved (D-08).
 *
 * DATE DISCIPLINE (CLAUDE.md, dates.ts): every date is a local `YYYY-MM-DD`
 * string from the read; weekday arithmetic builds a Date from local components
 * (`new Date(y, m - 1, d)`), never from a bare `YYYY-MM-DD` string and never via
 * UTC ISO slicing.
 */
import type {
  ContactHistory,
  HistoryInteractionRecord,
  HistoryKnowledgeRecord,
  HistoryLifecycleRecord,
} from "@/db/history-read";
import { formatLocalDate } from "@/utils/dates";

// --- Tunables (D-39) ---------------------------------------------------------

/** Records an open year shows before Show older (extended to a day's end). */
export const STREAM_INITIAL_VISIBLE = 20;
/** Records each Show older tap adds (extended to a day's end). */
export const STREAM_CHUNK = 20;

/**
 * Jump to date opening month (D-50, RESEARCH Pattern 5): a month header counts
 * as in view when its window y is at most this far below the Profile app bar's
 * bottom edge (the accepted mockup's `offsetTop <= top + 20`).
 */
export const PICKER_IN_VIEW_SLACK_DP = 20;

// --- Records -----------------------------------------------------------------

export type StreamFamily = "interaction" | "lifecycle" | "knowledge";

interface StreamRecordBase<F extends StreamFamily, R> {
  readonly family: F;
  /** Stable React key: `${family}-${id}`. */
  readonly key: string;
  readonly id: number;
  /** Local wall-clock timestamp: `occurredAt`, or `createdAt` for knowledge. */
  readonly at: string;
  /** Local calendar date `YYYY-MM-DD`. */
  readonly date: string;
  readonly record: R;
}

export type StreamRecord =
  | StreamRecordBase<"interaction", HistoryInteractionRecord>
  | StreamRecordBase<"lifecycle", HistoryLifecycleRecord>
  | StreamRecordBase<"knowledge", HistoryKnowledgeRecord>;

/** The three record families the stream needs from the canonical read. */
export type StreamSource = Pick<
  ContactHistory,
  "interactions" | "lifecycleEvents" | "knowledgeChanges"
>;

const FAMILY_RANK: Record<StreamFamily, number> = {
  interaction: 0,
  lifecycle: 1,
  knowledge: 2,
};

/** Sortable form of a stored wall-clock string (a `T` separator sorts as a space). */
function sortableAt(at: string): string {
  return at.trim().replace("T", " ");
}

/**
 * The stream order (D-18): negative when `a` sorts before (is newer than) `b`.
 * Timestamp desc, then interaction / lifecycle / knowledge, then id desc —
 * unique per record, so it also places a record that is no longer present.
 */
function compareStreamRecords(
  a: Pick<StreamRecord, "at" | "family" | "id">,
  b: Pick<StreamRecord, "at" | "family" | "id">,
): number {
  const atA = sortableAt(a.at);
  const atB = sortableAt(b.at);
  if (atA !== atB) return atA < atB ? 1 : -1;
  const rank = FAMILY_RANK[a.family] - FAMILY_RANK[b.family];
  if (rank !== 0) return rank;
  return b.id - a.id;
}

/**
 * Merge the three families into one deterministic newest-first list (D-18):
 * timestamp desc, then interaction / lifecycle / knowledge, then id desc.
 */
export function orderStreamRecords(history: StreamSource): StreamRecord[] {
  const records: StreamRecord[] = [
    ...history.interactions.map(
      (record): StreamRecord => ({
        family: "interaction",
        key: `interaction-${record.id}`,
        id: record.id,
        at: record.occurredAt,
        date: record.date,
        record,
      }),
    ),
    ...history.lifecycleEvents.map(
      (record): StreamRecord => ({
        family: "lifecycle",
        key: `lifecycle-${record.id}`,
        id: record.id,
        at: record.occurredAt,
        date: record.date,
        record,
      }),
    ),
    ...history.knowledgeChanges.map(
      (record): StreamRecord => ({
        family: "knowledge",
        key: `knowledge-${record.id}`,
        id: record.id,
        at: record.createdAt,
        date: record.date,
        record,
      }),
    ),
  ];
  records.sort(compareStreamRecords);
  return records;
}

// --- Model -------------------------------------------------------------------

export interface StreamYear {
  readonly year: number;
  readonly isCurrent: boolean;
  /** Interaction rows only (D-35); lifecycle and knowledge records never count. */
  readonly interactionCount: number;
  /** The year's records, newest first. */
  readonly records: readonly StreamRecord[];
}

export interface StreamModel {
  readonly today: string;
  readonly currentYear: number;
  /** Newest first; the current year is always present (D-36). */
  readonly years: readonly StreamYear[];
  /** Date → that day's records (all three families), newest first. */
  readonly dayIndex: ReadonlyMap<string, readonly StreamRecord[]>;
  /** Every date holding any record, newest first. */
  readonly days: readonly string[];
  /** Every `YYYY-MM` holding a record of any family (the picker dots, D-52). */
  readonly monthsWithRecords: ReadonlySet<string>;
  /**
   * The earliest record's year (any family), or the current year when there
   * are no records: the picker's first year (D-18, D-48). Never after the
   * current year.
   */
  readonly earliestYear: number;
}

function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}

/** Build the renderable stream model for one contact's history. */
export function buildStreamModel(
  history: StreamSource,
  today: string,
): StreamModel {
  const currentYear = yearOf(today);
  const ordered = orderStreamRecords(history);

  const byYear = new Map<number, StreamRecord[]>();
  const dayIndex = new Map<string, StreamRecord[]>();
  const days: string[] = [];
  const monthsWithRecords = new Set<string>();
  let earliestYear = currentYear;
  for (const record of ordered) {
    const year = yearOf(record.date);
    if (year < earliestYear) earliestYear = year;
    monthsWithRecords.add(record.date.slice(0, 7));
    const yearList = byYear.get(year);
    if (yearList) yearList.push(record);
    else byYear.set(year, [record]);

    const dayList = dayIndex.get(record.date);
    if (dayList) {
      dayList.push(record);
    } else {
      dayIndex.set(record.date, [record]);
      days.push(record.date);
    }
  }
  // Records are ordered by timestamp; dates of equal-day records are adjacent,
  // but sort explicitly so `days` is newest first whatever the clock strings.
  days.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

  if (!byYear.has(currentYear)) byYear.set(currentYear, []);

  const years: StreamYear[] = [...byYear.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, records]) => ({
      year,
      isCurrent: year === currentYear,
      interactionCount: records.filter((r) => r.family === "interaction")
        .length,
      records,
    }));

  return {
    today,
    currentYear,
    years,
    dayIndex,
    days,
    monthsWithRecords,
    earliestYear,
  };
}

// --- View state (transient; never persisted — D-18, D-62) --------------------

export interface StreamViewState {
  /**
   * Older years the user expanded, plus a year that was current when today
   * crossed into a new year while mounted (WR-03). The current year is always
   * open.
   */
  readonly openYears: ReadonlySet<number>;
  /** Year → requested visible record count (before day snapping). */
  readonly shown: ReadonlyMap<number, number>;
}

/** A fresh visit: only the current year open, no extra chunks (D-34, D-62). */
export function initialStreamState(): StreamViewState {
  return { openYears: new Set(), shown: new Map() };
}

export function isYearOpen(
  state: StreamViewState,
  model: StreamModel,
  year: number,
): boolean {
  return year === model.currentYear || state.openYears.has(year);
}

/** Expand a collapsed older year (D-15). */
export function streamStateOnExpandYear(
  state: StreamViewState,
  year: number,
): StreamViewState {
  if (state.openYears.has(year)) return state;
  const openYears = new Set(state.openYears);
  openYears.add(year);
  return { openYears, shown: state.shown };
}

// --- Visible slice -----------------------------------------------------------

export interface StreamDay {
  readonly date: string;
  /** "Today", "Yesterday" or "Fri Oct 2" (D-33). */
  readonly label: string;
  /** Full date with the year, e.g. "Friday, October 2, 2026". */
  readonly accessibilityLabel: string;
  readonly records: readonly StreamRecord[];
}

export interface StreamMonth {
  /** `YYYY-MM`. */
  readonly key: string;
  /** "October". */
  readonly label: string;
  /** "October 2026". */
  readonly accessibilityLabel: string;
  readonly days: readonly StreamDay[];
}

function findYear(model: StreamModel, year: number): StreamYear | undefined {
  return model.years.find((y) => y.year === year);
}

/** Group an ordered record slice into months and days (only dates with records). */
function groupMonths(
  records: readonly StreamRecord[],
  today: string,
): StreamMonth[] {
  const months: {
    key: string;
    days: { date: string; records: StreamRecord[] }[];
  }[] = [];
  for (const record of records) {
    const monthKey = record.date.slice(0, 7);
    let month = months[months.length - 1];
    if (!month || month.key !== monthKey) {
      month = { key: monthKey, days: [] };
      months.push(month);
    }
    let day = month.days[month.days.length - 1];
    if (!day || day.date !== record.date) {
      day = { date: record.date, records: [] };
      month.days.push(day);
    }
    day.records.push(record);
  }
  return months.map((month) => {
    const [y, m] = month.key.split("-").map(Number);
    return {
      key: month.key,
      label: MONTH_LONG[m - 1],
      accessibilityLabel: `${MONTH_LONG[m - 1]} ${y}`,
      days: month.days.map((day) => ({
        date: day.date,
        label: dayLabel(day.date, today),
        accessibilityLabel: dayAccessibilityLabel(day.date, today),
        records: day.records,
      })),
    };
  });
}

/**
 * Extend a visible count to the end of the day holding record `count - 1`, so a
 * Show older boundary never splits a day (D-18, D-39). Clamped to the list.
 */
export function snapToDayEnd(
  records: readonly StreamRecord[],
  count: number,
): number {
  let end = Math.max(0, Math.min(count, records.length));
  if (end === 0) return 0;
  const lastDate = records[end - 1].date;
  while (end < records.length && records[end].date === lastDate) end++;
  return end;
}

/** The year's requested count (initial or extended), before day snapping. */
function requestedCount(state: StreamViewState, year: number): number {
  return state.shown.get(year) ?? STREAM_INITIAL_VISIBLE;
}

/** The months/days an open year renders, and whether older records remain. */
export function visibleYear(
  state: StreamViewState,
  model: StreamModel,
  year: number,
): { months: readonly StreamMonth[]; hasOlder: boolean; visibleCount: number } {
  const entry = findYear(model, year);
  if (!entry) return { months: [], hasOlder: false, visibleCount: 0 };
  const visibleCount = snapToDayEnd(entry.records, requestedCount(state, year));
  return {
    months: groupMonths(entry.records.slice(0, visibleCount), model.today),
    hasOlder: visibleCount < entry.records.length,
    visibleCount,
  };
}

/**
 * Show older (D-39): the year's request becomes its current (snapped) visible
 * count + STREAM_CHUNK. It never shrinks and never touches another year.
 */
export function streamStateOnShowOlder(
  state: StreamViewState,
  model: StreamModel,
  year: number,
): StreamViewState {
  const entry = findYear(model, year);
  if (!entry) return state;
  const requested = requestedCount(state, year);
  const visible = snapToDayEnd(entry.records, requested);
  const next = Math.max(requested, visible + STREAM_CHUNK);
  if (next === state.shown.get(year)) return state;
  const shown = new Map(state.shown);
  shown.set(year, next);
  return { openYears: state.openYears, shown };
}

/**
 * Keep each open year's place across a re-read while mounted (D-31, D-62;
 * review CR-01). A year's request is a record COUNT, so records added above the
 * user (a Log from the Profile + button, a MemoryHistory edit, a redate into
 * the year) would otherwise push the last rendered day out of the slice. This
 * pins each open year to the oldest record it rendered under `prev`: in `next`
 * the request becomes the number of records sorting at or before that position
 * (newer or equal), so the same boundary stays rendered. The position is a sort
 * position, not a key, so it holds when the boundary record itself was deleted
 * or redated. It never shrinks a request (a deletion above only grows content
 * below the user) and never touches a collapsed year. When today crosses into
 * a new year, the year that was current stays open (WR-03). Returns `state`
 * itself when nothing changes.
 */
export function streamStateOnModelChange(
  state: StreamViewState,
  prev: StreamModel,
  next: StreamModel,
): StreamViewState {
  let shown: Map<number, number> | null = null;
  for (const entry of prev.years) {
    if (!isYearOpen(state, prev, entry.year)) continue;
    const requested = requestedCount(state, entry.year);
    const visible = snapToDayEnd(entry.records, requested);
    if (visible === 0) continue;
    const boundary = entry.records[visible - 1];
    const nextEntry = findYear(next, entry.year);
    if (!nextEntry) continue;
    // Newest first: count until the first record older than the boundary.
    let through = 0;
    for (const record of nextEntry.records) {
      if (compareStreamRecords(record, boundary) > 0) break;
      through++;
    }
    if (through > requested) {
      shown = shown ?? new Map(state.shown);
      shown.set(entry.year, through);
    }
  }
  // A New Year rollover while mounted (review WR-03): the year that was
  // current, and so always open, becomes an older year. Carry it into
  // `openYears` so it stays open with its chunks instead of collapsing to a
  // year row under the user.
  let openYears: Set<number> | null = null;
  if (
    next.currentYear > prev.currentYear &&
    !state.openYears.has(prev.currentYear)
  ) {
    openYears = new Set(state.openYears);
    openYears.add(prev.currentYear);
  }
  if (!shown && !openYears) return state;
  return {
    openYears: openYears ?? state.openYears,
    shown: shown ?? state.shown,
  };
}

/**
 * Whether `day` is actually rendered: its year is open and the year's visible
 * (day-snapped) slice reaches the day's oldest record. A day can exist in the
 * model and still not be rendered (a collapsed year, past Show older), so the
 * D-31 keep-place check uses this rather than the day index alone (CR-01).
 */
export function isDayRendered(
  state: StreamViewState,
  model: StreamModel,
  day: string,
): boolean {
  const year = yearOf(day);
  if (!isYearOpen(state, model, year)) return false;
  const entry = findYear(model, year);
  if (!entry) return false;
  let last = -1;
  for (let i = entry.records.length - 1; i >= 0; i--) {
    if (entry.records[i].date === day) {
      last = i;
      break;
    }
  }
  if (last < 0) return false;
  return snapToDayEnd(entry.records, requestedCount(state, year)) >= last + 1;
}

// --- Heatmap → stream navigation (D-19..D-21, D-18, D-56) --------------------

/**
 * The registry key of a rendered day group (the scroll target of a jump). The
 * stream registers each day group's View under it.
 */
export function dayNodeKey(date: string): string {
  return `day:${date}`;
}

/**
 * The registry key of a rendered month group (`YYYY-MM`): the scroll target of
 * a Jump to date month jump, and a header measured for the picker's opening
 * month (38.8 D-17, D-50).
 */
export function monthNodeKey(monthKey: string): string {
  return `month:${monthKey}`;
}

/** A heatmap target the stream can resolve: a day cell or a cycle span. */
export type HeatmapTarget =
  | { readonly kind: "date"; readonly date: string }
  | { readonly kind: "cycle"; readonly start: string; readonly end: string };

/**
 * What a heatmap tap does to the stream (D-19..D-21). `reveal` lists the target
 * days that hold records (newest first): the stream opens and grows to render
 * them, scrolls to `scrollDay` and highlights `highlightDays`. An empty target
 * leaves the stream alone and shows a note instead.
 */
export type HeatmapResolution =
  | {
      readonly kind: "reveal";
      readonly days: readonly string[];
      readonly scrollDay: string;
      readonly highlightDays: readonly string[];
      /** The tapped cycle span (inclusive), for the announcement (D-23). */
      readonly span?: { readonly start: string; readonly end: string };
    }
  | { readonly kind: "empty-day"; readonly date: string }
  | {
      readonly kind: "empty-span";
      readonly start: string;
      readonly end: string;
    };

/**
 * Resolve a heatmap tap against the stream model (D-19..D-21). Emptiness is
 * decided from the all-family day index, never from the heatmap's interaction
 * count: a day or span holding only lifecycle or knowledge records still
 * reveals. A span reveals every day in it with records, newest first, and
 * scrolls to the newest (D-20); its days may sit in two years (Pitfall 4).
 */
export function resolveHeatmapTarget(
  model: StreamModel,
  target: HeatmapTarget,
): HeatmapResolution {
  if (target.kind === "cycle") {
    const { start, end } = target;
    const days = model.days.filter((date) => date >= start && date <= end);
    if (days.length === 0) return { kind: "empty-span", start, end };
    return {
      kind: "reveal",
      days,
      scrollDay: days[0],
      highlightDays: days,
      span: { start, end },
    };
  }
  if (model.dayIndex.has(target.date)) {
    return {
      kind: "reveal",
      days: [target.date],
      scrollDay: target.date,
      highlightDays: [target.date],
    };
  }
  return { kind: "empty-day", date: target.date };
}

/**
 * Open and grow the stream so every target day renders whole (D-18, D-20). For
 * each day: open its year (the current year is always open) and raise that
 * year's requested count in whole STREAM_CHUNK steps until the day-snapped
 * visible slice covers the day's oldest record. It never shrinks a count and
 * never touches another year. Transient view state only — the heatmap window is
 * not part of it (D-56).
 */
export function streamStateOnReveal(
  state: StreamViewState,
  model: StreamModel,
  days: readonly string[],
): StreamViewState {
  let openYears: Set<number> | null = null;
  let shown: Map<number, number> | null = null;
  for (const date of days) {
    const year = yearOf(date);
    const entry = findYear(model, year);
    if (!entry) continue;
    let last = -1;
    for (let i = entry.records.length - 1; i >= 0; i--) {
      if (entry.records[i].date === date) {
        last = i;
        break;
      }
    }
    if (last < 0) continue;
    if (
      year !== model.currentYear &&
      !(openYears ?? state.openYears).has(year)
    ) {
      openYears = openYears ?? new Set(state.openYears);
      openYears.add(year);
    }
    const current = (shown ?? state.shown).get(year) ?? STREAM_INITIAL_VISIBLE;
    let requested = current;
    while (snapToDayEnd(entry.records, requested) < last + 1) {
      requested += STREAM_CHUNK;
    }
    if (requested !== current) {
      shown = shown ?? new Map(state.shown);
      shown.set(year, requested);
    }
  }
  if (!openYears && !shown) return state;
  return {
    openYears: openYears ?? state.openYears,
    shown: shown ?? state.shown,
  };
}

// --- Jump scroll requests (RESEARCH Pattern 3 Timing; C1-01, C2-01..C2-03) ---

/**
 * How a jump's scroll is issued, read at tap time BEFORE the reveal update. A
 * target already rendered (registered) scrolls right after the reveal commits:
 * the reveal only grows content below it. A target not yet rendered waits for
 * its own first layout, when the Profile content has grown to include it.
 */
export function historyScrollMode(
  registry: { has(key: string): boolean },
  key: string,
): "immediate" | "await-layout" {
  return registry.has(key) ? "immediate" : "await-layout";
}

/** The one outstanding jump scroll of a HistorySection mount, if any. */
export type PendingHistoryScroll = {
  readonly key: string;
  readonly gen: number;
  readonly mode: "immediate" | "await-layout";
  /** The single retry after a measure failure has been used. */
  readonly retried: boolean;
} | null;

export type PendingScrollEvent =
  | {
      readonly type: "request";
      readonly key: string;
      readonly gen: number;
      readonly mode: "immediate" | "await-layout";
    }
  | { readonly type: "result"; readonly gen: number; readonly ok: boolean }
  | { readonly type: "stream-action" };

/**
 * The pending-scroll reducer (C2-02, C2-03). A request replaces any older one;
 * a result for any other generation changes nothing; success clears; the first
 * failure arms one retry and a second failure clears; every other stream
 * action (lens, preset, paging, Show older, year expand, note close) clears.
 */
export function pendingScrollOn(
  pending: PendingHistoryScroll,
  event: PendingScrollEvent,
): PendingHistoryScroll {
  switch (event.type) {
    case "request":
      return {
        key: event.key,
        gen: event.gen,
        mode: event.mode,
        retried: false,
      };
    case "result":
      if (!pending || pending.gen !== event.gen) return pending;
      if (event.ok || pending.retried) return null;
      return { ...pending, retried: true };
    case "stream-action":
      return null;
  }
}

/** Whether generation `gen` is still the outstanding request. */
export function isCurrentScroll(
  pending: PendingHistoryScroll,
  gen: number,
): boolean {
  return pending !== null && pending.gen === gen;
}

/**
 * The one-time screen-reader announcement of a jump (D-23): the full date with
 * its year, or both ends of a tapped span. On-screen dates only — no contact
 * content.
 */
export function revealAnnouncement(
  resolution: Extract<HeatmapResolution, { kind: "reveal" }>,
  today: string,
): string {
  if (resolution.span) {
    return `Showing ${dayAccessibilityLabel(resolution.span.start, today)} to ${dayAccessibilityLabel(resolution.span.end, today)}`;
  }
  return `Showing ${dayAccessibilityLabel(resolution.scrollDay, today)}`;
}

// --- The empty-target note (D-21, D-55) --------------------------------------

/**
 * The note under the heatmap for a truly empty target (no record of any
 * family). It replaces the old count card; the stream does not move for it.
 */
export type HistoryNote =
  | { readonly kind: "empty-day"; readonly date: string }
  | {
      readonly kind: "empty-span";
      readonly start: string;
      readonly end: string;
    }
  | null;

export type HistoryNoteEvent =
  | { readonly type: "heatmap"; readonly resolution: HeatmapResolution }
  | {
      readonly type:
        | "close"
        | "lens-change"
        | "preset-change"
        | "page"
        | "month-jump";
    };

/**
 * The note reducer (D-55): an empty heatmap target sets it, a populated one
 * clears it, and the close control, a lens change, a preset change and
 * prev/next paging each clear it — the note never outlives the window it
 * described (the old stale-card bug). Any Jump to date month choice clears it
 * too, so only one empty note shows at a time (D-69).
 */
export function historyNoteOn(
  _note: HistoryNote,
  event: HistoryNoteEvent,
): HistoryNote {
  if (event.type !== "heatmap") return null;
  const { resolution } = event;
  switch (resolution.kind) {
    case "empty-day":
      return { kind: "empty-day", date: resolution.date };
    case "empty-span":
      return {
        kind: "empty-span",
        start: resolution.start,
        end: resolution.end,
      };
    case "reveal":
      return null;
  }
}

// --- Jump to date (D-17, D-18, D-48..D-52) -----------------------------------

/** One month cell of the Jump to date picker. */
export interface PickerMonth {
  /** `YYYY-MM`. */
  readonly monthKey: string;
  /** "Mar". */
  readonly label: string;
  /** Holds a record of any family (D-49, D-52). */
  readonly hasRecords: boolean;
  /** After today's month: cannot be chosen (D-48). */
  readonly disabled: boolean;
  /** The month the picker opened on (cosmetic). */
  readonly selected: boolean;
  /** "March 2026", plus ", has records" when it holds any (D-49: never colour-only). */
  readonly accessibilityLabel: string;
}

/**
 * The picker for one displayed year (D-48): 12 months, future months disabled,
 * and the year stepper's bounds — the earliest record's year (or the current
 * year when there are none) to the current year (D-18). A year outside the
 * bounds is clamped into them.
 */
export function pickerModel({
  model,
  year,
  selectedMonthKey,
}: {
  model: StreamModel;
  year: number;
  selectedMonthKey: string | null;
}): {
  year: number;
  minYear: number;
  maxYear: number;
  canPrev: boolean;
  canNext: boolean;
  months: readonly PickerMonth[];
} {
  const minYear = Math.min(model.earliestYear, model.currentYear);
  const maxYear = model.currentYear;
  const shown = Math.max(minYear, Math.min(maxYear, year));
  const todayMonth = model.today.slice(0, 7);
  const months = MONTH_SHORT.map((label, index): PickerMonth => {
    const monthKey = `${shown}-${String(index + 1).padStart(2, "0")}`;
    const hasRecords = model.monthsWithRecords.has(monthKey);
    return {
      monthKey,
      label,
      hasRecords,
      disabled: monthKey > todayMonth,
      selected: monthKey === selectedMonthKey,
      accessibilityLabel: `${MONTH_LONG[index]} ${shown}${hasRecords ? ", has records" : ""}`,
    };
  });
  return {
    year: shown,
    minYear,
    maxYear,
    canPrev: shown > minYear,
    canNext: shown < maxYear,
    months,
  };
}

/**
 * What choosing a month does (D-17). A month holding a record of any family
 * reveals its newest day (which renders the month header) and scrolls to the
 * header, with no highlight. An empty month shows an explicit state with the
 * nearest record days after and before it (null at the ends of history).
 */
export type MonthJump =
  | {
      readonly kind: "reveal-month";
      readonly monthKey: string;
      readonly days: readonly string[];
    }
  | {
      readonly kind: "empty-month";
      readonly monthKey: string;
      readonly before: string | null;
      readonly after: string | null;
    };

/** Resolve a picker month against the all-family day index (D-17, D-52). */
export function resolveMonthJump(
  model: StreamModel,
  monthKey: string,
): MonthJump {
  // `days` is newest first, so the first match is the month's newest day.
  const newest = model.days.find((date) => date.slice(0, 7) === monthKey);
  if (newest) return { kind: "reveal-month", monthKey, days: [newest] };
  let before: string | null = null;
  let after: string | null = null;
  for (const date of model.days) {
    const month = date.slice(0, 7);
    if (month > monthKey)
      after = date; // keeps the oldest later day
    else if (month < monthKey) {
      before = date; // the first earlier day is the newest one
      break;
    }
  }
  return { kind: "empty-month", monthKey, before, after };
}

/**
 * The record days nearest `date` (any family): the newest day strictly before
 * it and the oldest strictly after it, null past either end of history.
 */
export function nearestRecordDays(
  model: StreamModel,
  date: string,
): { before: string | null; after: string | null } {
  let before: string | null = null;
  let after: string | null = null;
  for (const day of model.days) {
    if (day > date) after = day;
    else if (day < date) {
      before = day;
      break;
    }
  }
  return { before, after };
}

/** Whole calendar days from `a` to `b` (local components; DST-safe rounding). */
function calendarDaysBetween(a: string, b: string): number {
  const ms = localDateFromParts(b).getTime() - localDateFromParts(a).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Where a kept place lands when its day is gone (D-31): `day` itself while it
 * still holds a record, otherwise the nearer of the closest earlier and later
 * record days by calendar distance (a tie goes to the newer day), or null when
 * the history is empty.
 */
export function nearestRemainingDay(
  model: StreamModel,
  day: string,
): string | null {
  if (model.dayIndex.has(day)) return day;
  const { before, after } = nearestRecordDays(model, day);
  if (before === null) return after;
  if (after === null) return before;
  return calendarDaysBetween(day, after) <= calendarDaysBetween(before, day)
    ? after
    : before;
}

/**
 * The day now holding the record keyed `${family}-${id}` (a redated record
 * reports its new day), or null when the record is gone (D-31).
 */
export function recordDay(
  model: StreamModel,
  recordKey: string,
): string | null {
  for (const year of model.years) {
    const found = year.records.find((record) => record.key === recordKey);
    if (found) return found.date;
  }
  return null;
}

/**
 * The Profile app bar's bottom edge in window coordinates — the stream's
 * visible top (D-50, C3-02): the top safe-area inset, plus the in-flow shell
 * content above the tab navigator (the assist banner, 0 when none), plus the
 * app bar, which sits absolutely at the top of the Profile screen.
 */
export function pickerViewportTop({
  insetTop,
  shellTopOffset,
  appBarHeight,
}: {
  insetTop: number;
  shellTopOffset: number;
  appBarHeight: number;
}): number {
  return insetTop + shellTopOffset + appBarHeight;
}

/**
 * The month the picker opens on (D-50, RESEARCH Pattern 5): the last month
 * header, in stream order (newest first), whose window y is at or above the
 * viewport top plus PICKER_IN_VIEW_SLACK_DP — headers hidden under the overlay
 * bar count as scrolled past. When none qualifies the user has not scrolled
 * into the stream, so it opens on `fallbackMonthKey` (the current month).
 * Entries may arrive in any order. Under D-32's non-sticky Jump button this
 * resolves to the current month in practice (D-68, accepted).
 */
export function pickerInitialMonth(
  entries: readonly { monthKey: string; windowY: number }[],
  viewportTop: number,
  fallbackMonthKey: string,
): string {
  const inStreamOrder = [...entries].sort((a, b) =>
    a.monthKey < b.monthKey ? 1 : a.monthKey > b.monthKey ? -1 : 0,
  );
  let result: string | null = null;
  for (const entry of inStreamOrder) {
    if (entry.windowY <= viewportTop + PICKER_IN_VIEW_SLACK_DP) {
      result = entry.monthKey;
    }
  }
  return result ?? fallbackMonthKey;
}

/** The one-time screen-reader announcement of a month jump: "Showing October 2025". */
export function monthAnnouncement(monthKey: string): string {
  return `Showing ${monthLongLabel(monthKey)}`;
}

/** The empty-month state's heading: "No activity in October 2025." (D-17). */
export function emptyMonthNoteText(monthKey: string): string {
  return `No activity in ${monthLongLabel(monthKey)}.`;
}

/** A nearest-date link: "Nov 3, 2025" (local components only). */
export function nearestDateLabel(date: string): string {
  const local = localDateFromParts(date);
  return `${MONTH_SHORT[local.getMonth()]} ${local.getDate()}, ${local.getFullYear()}`;
}

/** "October 2025" from `YYYY-MM`. */
function monthLongLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return `${MONTH_LONG[m - 1]} ${y}`;
}

// --- Labels (D-33) -----------------------------------------------------------

const WEEKDAY_SHORT = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;
const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** A local Date from a `YYYY-MM-DD` string's components (never UTC parsing). */
function localDateFromParts(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** The local date before `date` (local-component arithmetic). */
function previousLocalDate(date: string): string {
  const shifted = localDateFromParts(date);
  shifted.setDate(shifted.getDate() - 1);
  return formatLocalDate(shifted);
}

function relativeDay(
  date: string,
  today: string,
): "Today" | "Yesterday" | null {
  if (date === today) return "Today";
  if (date === previousLocalDate(today)) return "Yesterday";
  return null;
}

/** "Today", "Yesterday", else weekday + month + day ("Fri Oct 2"). No count (D-47). */
export function dayLabel(date: string, today: string): string {
  const relative = relativeDay(date, today);
  if (relative) return relative;
  const local = localDateFromParts(date);
  return `${WEEKDAY_SHORT[local.getDay()]} ${MONTH_SHORT[local.getMonth()]} ${local.getDate()}`;
}

/** The full date with its year, prefixed "Today, " / "Yesterday, " (D-33). */
export function dayAccessibilityLabel(date: string, today: string): string {
  const local = localDateFromParts(date);
  const full = `${WEEKDAY_LONG[local.getDay()]}, ${MONTH_LONG[local.getMonth()]} ${local.getDate()}, ${local.getFullYear()}`;
  const relative = relativeDay(date, today);
  return relative ? `${relative}, ${full}` : full;
}

/** The current year's empty state (D-36). */
export function emptyYearLabel(year: number): string {
  return `Nothing logged in ${year} yet`;
}

/** "1 interaction" / "34 interactions" — correct singular/plural (D-35). */
export function interactionCountLabel(interactionCount: number): string {
  return `${interactionCount} ${interactionCount === 1 ? "interaction" : "interactions"}`;
}

/** A collapsed older year row: '<year> · <n> interaction(s)' (D-35). */
export function yearRowLabel(year: number, interactionCount: number): string {
  return `${year} · ${interactionCountLabel(interactionCount)}`;
}

/** "Sep 1" from a local `YYYY-MM-DD` (local components only). */
function monthDayLabel(date: string): string {
  const local = localDateFromParts(date);
  return `${MONTH_SHORT[local.getMonth()]} ${local.getDate()}`;
}

/** The empty-day note: "Nothing logged on Tue Oct 5" (D-21). */
export function emptyDayNoteText(date: string): string {
  const local = localDateFromParts(date);
  return `Nothing logged on ${WEEKDAY_SHORT[local.getDay()]} ${monthDayLabel(date)}`;
}

/** "Sep 1, 2025" from a local `YYYY-MM-DD` (local components only). */
function monthDayYearLabel(date: string): string {
  return `${monthDayLabel(date)}, ${yearOf(date)}`;
}

/**
 * A Cycles span's dates (D-70): "Mar 1 – Oct 22" when the span is wholly in
 * the current year (`today`'s, a local `YYYY-MM-DD`), else both ends carry
 * their year: "Mar 1, 2025 – Oct 22, 2025" / "Dec 20, 2025 – Jan 18, 2026".
 * Used by the Cycles page title, the cycle cells' accessible labels and the
 * empty-span note.
 */
export function spanRangeLabel(
  start: string,
  end: string,
  today: string,
): string {
  const currentYear = yearOf(today);
  if (yearOf(start) === currentYear && yearOf(end) === currentYear) {
    return `${monthDayLabel(start)} – ${monthDayLabel(end)}`;
  }
  return `${monthDayYearLabel(start)} – ${monthDayYearLabel(end)}`;
}

/**
 * The empty-span note: "Nothing logged Sep 1 – Sep 7" (D-21), with years when
 * the span is not wholly in the current year (D-70).
 */
export function emptySpanNoteText(
  start: string,
  end: string,
  today: string,
): string {
  return `Nothing logged ${spanRangeLabel(start, end, today)}`;
}
