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
 *     A cut never splits a day. The state is transient and never persisted.
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
  records.sort((a, b) => {
    const atA = sortableAt(a.at);
    const atB = sortableAt(b.at);
    if (atA !== atB) return atA < atB ? 1 : -1;
    const rank = FAMILY_RANK[a.family] - FAMILY_RANK[b.family];
    if (rank !== 0) return rank;
    return b.id - a.id;
  });
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
  for (const record of ordered) {
    const year = yearOf(record.date);
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

  return { today, currentYear, years, dayIndex, days };
}

// --- View state (transient; never persisted — D-18, D-62) --------------------

export interface StreamViewState {
  /** Older years the user expanded. The current year is always open. */
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

/** The months/days an open year renders, and whether older records remain. */
export function visibleYear(
  _state: StreamViewState,
  model: StreamModel,
  year: number,
): { months: readonly StreamMonth[]; hasOlder: boolean; visibleCount: number } {
  const entry = findYear(model, year);
  if (!entry) return { months: [], hasOlder: false, visibleCount: 0 };
  return {
    months: groupMonths(entry.records, model.today),
    hasOlder: false,
    visibleCount: entry.records.length,
  };
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
