/**
 * Window-scoped intensity (HIST-06, D-09).
 *
 * The Intensity surface reads the SAME selected window as the Heatmap. This
 * module derives intensity genuinely scoped to that window rather than over the
 * contact's whole history at real wall-clock now.
 *
 * WHY THE naive wrapper is WRONG (review cycle-2 HIGH, codex Plan 03):
 * the whole-history intensity wrapper periods over ALL of a contact's
 * interactions with a FIXED cadence period at REAL now — the pure core bounds
 * its active period to `now - periodDays`, so a PAST selected window would read
 * ~0 there. To honor a past
 * window we must instead:
 *   (1) filter inputs.interactions to occurred_at within the window bounds
 *       [window.start 00:00:00, window.end 23:59:59];
 *   (2) pass `effectiveNow = window.end at local 23:59:59` (NOT real now);
 *   (3) pass `periodDays = the window's day-span` — the count of LOCAL calendar
 *       days from the window's first real date to its last real date INCLUSIVE.
 * With effectiveNow=window-end and periodDays=window-span, computeIntensity's
 * periodStart lands one day before the window start, so currentCount = the
 * qualifying rows inside the window (a fixed value N, not ~0).
 *
 * We call the PURE `computeIntensity` core (impact.ts:141 / intensity-logic.ts),
 * NOT the whole-history contact-intensity wrapper. We keep impact.ts's tagged
 * `{ available: false }` unavailable guard VERBATIM for no-cadence / Unbound
 * contacts (ADR-062).
 *
 * Pure: only `import type` from the DAO (erased at runtime), plus the pure
 * dates + intensity-logic cores. No DB/store/component runtime import, no
 * transaction. Local date math only — never UTC ISO slicing.
 */
import type { ImpactInputs } from "@/db/impact-read";
import { calendarDaysBetween, parseLocalMs } from "@/utils/dates";
import { computeIntensity, type IntensityResult } from "@/services/intensity-logic";
import type { HistoryWindow } from "@/services/history/window";

/** A window-scoped intensity result, or the tagged no-cadence unavailable marker. */
export type IntensityWindowResult = (IntensityResult & { readonly available: true }) | { readonly available: false };

/**
 * Derive intensity scoped to `window` for the contact described by `inputs`.
 *
 * Returns `{ available: false }` for a no-cadence / Unbound contact (interval
 * null OR tracking disabled) before any arithmetic (ADR-062). Otherwise filters
 * interactions to the window bounds and delegates to the pure `computeIntensity`
 * with effectiveNow = window-end-of-day and periodDays = window day-span.
 */
export function intensityWindow(inputs: ImpactInputs, window: HistoryWindow): IntensityWindowResult {
  // VERBATIM impact.ts guard — never touch cadence math for an Unbound contact.
  if (inputs.trackingEnabled !== 1 || inputs.intervalDays === null) {
    return { available: false };
  }

  // (1) Filter to the window bounds [start 00:00:00, end 23:59:59], local.
  const startMs = parseLocalMs(`${window.start} 00:00:00`);
  const endMs = parseLocalMs(`${window.end} 23:59:59`);
  const filtered = inputs.interactions.filter((i) => {
    const ms = parseLocalMs(i.occurredAt);
    return ms >= startMs && ms <= endMs;
  });

  // (2) effectiveNow = the window's last day at local end-of-day (NOT real now).
  const effectiveNow = `${window.end} 23:59:59`;

  // (3) periodDays = local calendar days from first to last real window date,
  // INCLUSIVE. This exact formula is the load-bearing derivation: it puts
  // computeIntensity's periodStart one day before window.start, so every
  // filtered (in-window) qualifying row is counted.
  const periodDays = calendarDaysBetween(startMs, endMs) + 1;

  const result = computeIntensity(filtered, periodDays, inputs.rarelyResponds, effectiveNow);
  return { ...result, available: true };
}
