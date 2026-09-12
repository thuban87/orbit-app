/**
 * PURE caption/label helpers for IntensityLine (Phase 32 review #1) — RN-free so
 * the intended-cadence phrasing is node-testable WITHOUT loading react-native
 * (mirrors ContactCard's `contact-card-ring` split; the node test env cannot
 * parse RN's Flow-typed source). Re-imported by IntensityLine.tsx for app use.
 *
 * THE CADENCE LABEL DESCRIBES THE CONTACT, NOT THE MEASUREMENT WINDOW. The
 * "…intended" phrasing states the contact's CONFIGURED frequency interval as a
 * neutral FLOOR ("Monthly intended"). On the compact profile tile the intensity
 * period IS the contact's interval, so `periodDays` doubles as the cadence there.
 * On the window-scoped IntensityChart, `periodDays` is the WINDOW day-span, so
 * the contact's real interval must be threaded in separately (via
 * `IntensityWindowResult.cadenceDays`) — otherwise a 7-Days lens over a monthly
 * contact would misreport "Weekly intended". No colour, no react-native import.
 */
import { FREQUENCY_DAYS, type Frequency } from "@/types";

/** Reverse of FREQUENCY_DAYS (days → label) for exact-interval phrasing. */
const DAYS_TO_FREQUENCY: Record<number, Frequency> = Object.fromEntries(
  (Object.entries(FREQUENCY_DAYS) as [Frequency, number][]).map(
    ([label, days]) => [days, label],
  ),
) as Record<number, Frequency>;

/**
 * The contact's cadence as a label: an exact FREQUENCY_DAYS match renders its
 * name ("Monthly"), otherwise "every N days". `cadenceDays` is the CONTACT'S
 * configured interval — never a measurement-window span.
 */
export function intendedLabel(cadenceDays: number): string {
  const named = DAYS_TO_FREQUENCY[cadenceDays];
  return named ? named : `every ${cadenceDays} days`;
}

/**
 * The full neutral intended-cadence caption: the contact's cadence phrased as a
 * FLOOR ("Monthly intended"), plus the trailing-average clause when known
 * (omitted when `trailingAvgGapDays` is null — fewer than 2 qualifying rows).
 * `cadenceDays` is the CONTACT'S interval, decoupled from any window.
 */
export function intendedCaption(
  cadenceDays: number,
  trailingAvgGapDays: number | null,
): string {
  const avgClause =
    trailingAvgGapDays !== null
      ? ` · ${Math.round(trailingAvgGapDays)}-day average`
      : "";
  return `${intendedLabel(cadenceDays)} intended${avgClause}`;
}
