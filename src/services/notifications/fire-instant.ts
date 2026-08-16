/**
 * fire-instant — the PURE, node-tested scheduling math that turns a contact's
 * due date plus the user's delivery-hour / quiet-window settings into the exact
 * LOCAL Date a DATE trigger fires on. React-native/expo-free (Vitest runs it in
 * node), mirroring `src/logic/birthday-logic.ts`: tunable/policy numbers live at
 * the call site, every Date is built from LOCAL components (`new Date(y, m, d,
 * h, min)`), and NOTHING uses `toISOString`/UTC — the UTC off-by-one is the bug
 * CLAUDE.md already fixed once and forbids reintroducing.
 *
 * Android has NO time-of-day / quiet-hours trigger, so this is Orbit's own
 * logic. The scheduler composes `nextNudgeDate()` (which day) then
 * `nextAllowedFireInstant()` (which instant on that day) to produce each
 * notification's DATE trigger.
 *
 * Two invariants this module enforces:
 *   - T-11-05 (Tampering/DoS): every hour argument is `clampHour`-coerced to an
 *     integer in [0,23] on read, so a malformed persisted setting can never
 *     reach the trigger as a NaN/out-of-range fire time. Defense-in-depth over
 *     the write-side bounds check in 11-02.
 *   - T-11-COOLDOWN (Availability): a per-contact `staggerMinutes` offset spreads
 *     fire instants across the morning so Android 15's Notification Cooldown does
 *     not silently mute the 2nd+ nudges of a burst.
 *
 * STATELESS by design (11-CONTEXT §Cadence item G, DECIDED — do NOT reverse):
 * `nextNudgeDate` derives the weekly re-nag grid purely from the due date with
 * NO stored last-notified state and NO clamp-to-today. A clamp-to-today "catch
 * up" would re-fire on every reconcile (daily nag), violating the flat-weekly
 * cadence and the anti-nag mandate.
 */

// A hard safety cap on the day-stepping loops. Both loops terminate on real
// inputs (step >= 1 day, finite dates); the cap only guards against a pathologic
// value slipping past the sanitizers, so a never-throw module can never hang.
const MAX_STEPS = 4000;

/**
 * Coerce an hour to an integer in [0,23]. Non-finite (NaN/±Infinity) → 0; a
 * fractional hour is truncated toward zero (9.5 → 9); out-of-range values clamp
 * to the nearest bound. Never returns NaN. This is the single choke point that
 * makes a malformed persisted delivery/quiet hour safe (T-11-05).
 */
export function clampHour(h: number): number {
  if (!Number.isFinite(h)) return 0;
  const i = Math.trunc(h);
  if (i < 0) return 0;
  if (i > 23) return 23;
  return i;
}

/** Non-negative integer minutes; non-finite/negative → 0. */
function clampStagger(minutes: number): number {
  if (!Number.isFinite(minutes)) return 0;
  const i = Math.trunc(minutes);
  return i < 0 ? 0 : i;
}

/**
 * Is local hour `h` inside the quiet window [quietStart, quietEnd)?
 * The window WRAPS midnight when quietStart > quietEnd (e.g. 21→08 covers
 * 21..24 and 00..08). Equal bounds → empty window (never quiet).
 */
function inQuietWindow(
  h: number,
  quietStart: number,
  quietEnd: number,
): boolean {
  if (quietStart === quietEnd) return false;
  if (quietStart > quietEnd) {
    // Wrapping: quiet if in the evening tail OR the early-morning head.
    return h >= quietStart || h < quietEnd;
  }
  // Non-wrapping: a simple half-open interval.
  return h >= quietStart && h < quietEnd;
}

/**
 * The allowed fire instant for a single day's delivery slot, after the
 * quiet-window roll. `y/m/d` are LOCAL calendar components of the candidate day.
 */
function allowedSlotForDay(
  y: number,
  m: number,
  d: number,
  deliveryHour: number,
  quietStart: number,
  quietEnd: number,
  staggerMinutes: number,
): Date {
  // Candidate = local midnight of the day at deliveryHour:00 + stagger. JS Date
  // normalizes an overflowing minute into the hour/day locally (wall-clock), so
  // read the NORMALIZED components back before testing the quiet window.
  const candidate = new Date(y, m, d, deliveryHour, staggerMinutes);
  const ch = candidate.getHours();
  const cy = candidate.getFullYear();
  const cm = candidate.getMonth();
  const cd = candidate.getDate();

  if (!inQuietWindow(ch, quietStart, quietEnd)) {
    return candidate;
  }

  // Inside the quiet window → roll to quietEnd, the moment the window opens back
  // up. In a wrapping window the EVENING portion (ch >= quietStart) exits the
  // NEXT morning; the early-morning portion, and any non-wrapping window, exits
  // that SAME morning.
  const wraps = quietStart > quietEnd;
  if (wraps && ch >= quietStart) {
    return new Date(cy, cm, cd + 1, quietEnd, 0);
  }
  return new Date(cy, cm, cd, quietEnd, 0);
}

/**
 * The next LOCAL Date a DATE trigger may fire on for a contact, given the day to
 * aim at and the user's hour/quiet settings.
 *
 * @param baseDate - the day to schedule on (only its LOCAL Y/M/D matter); pass
 *   the output of `nextNudgeDate`.
 * @param deliveryHour - user's preferred hour (clamped to [0,23]).
 * @param quietStartHour - quiet-window start (clamped; window is [start,end)).
 * @param quietEndHour - quiet-window end (clamped). start > end WRAPS midnight.
 * @param staggerMinutes - per-contact minute offset (T-11-COOLDOWN); < 0 / NaN → 0.
 * @param now - the reference instant; a slot at or before `now` rolls to the next
 *   day's delivery slot (still quiet-respecting). A non-Date/invalid `now` is
 *   treated as "no past constraint".
 * @returns a LOCAL Date; never NaN, never throws.
 */
export function nextAllowedFireInstant(
  baseDate: Date,
  deliveryHour: number,
  quietStartHour: number,
  quietEndHour: number,
  staggerMinutes: number,
  now: Date,
): Date {
  const dh = clampHour(deliveryHour);
  const qs = clampHour(quietStartHour);
  const qe = clampHour(quietEndHour);
  const stagger = clampStagger(staggerMinutes);

  const nowMs =
    now instanceof Date && Number.isFinite(now.getTime())
      ? now.getTime()
      : Number.NEGATIVE_INFINITY;

  // Walk day by day from baseDate until the day's allowed slot is strictly after
  // `now`. Component-based day stepping (never ms arithmetic) keeps every cursor
  // at a real local midnight across DST boundaries.
  let cursor = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
  );
  for (let i = 0; i < MAX_STEPS; i++) {
    const slot = allowedSlotForDay(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate(),
      dh,
      qs,
      qe,
      stagger,
    );
    if (slot.getTime() > nowMs) {
      return slot;
    }
    cursor = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() + 1,
    );
  }
  // Unreachable on real inputs; return the last computed slot rather than throw.
  return allowedSlotForDay(
    cursor.getFullYear(),
    cursor.getMonth(),
    cursor.getDate(),
    dh,
    qs,
    qe,
    stagger,
  );
}

/**
 * The stateless weekly re-nag day: the first date in {dueDate, dueDate+cadence,
 * dueDate+2·cadence, …} whose LOCAL date is not before today. An overdue due
 * date therefore advances by WHOLE `cadenceDays` to a today-or-future tick — no
 * stored state, no clamp-to-today (11-CONTEXT §Cadence item G, DECIDED).
 *
 * @param dueDate - the contact's due date (LOCAL Y/M/D used).
 * @param now - reference instant; only its LOCAL date matters for the compare.
 * @param cadenceDays - the caller's cadence policy (this module owns no policy
 *   number). Non-finite or < 1 is floored to 1 purely as a loop-safety guard.
 * @returns a LOCAL-midnight Date (no time-of-day carried from `dueDate`).
 */
export function nextNudgeDate(
  dueDate: Date,
  now: Date,
  cadenceDays: number,
): Date {
  const step =
    Number.isFinite(cadenceDays) && cadenceDays >= 1
      ? Math.trunc(cadenceDays)
      : 1;

  const todayMs = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();

  let cursor = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate(),
  );
  for (let i = 0; i < MAX_STEPS && cursor.getTime() < todayMs; i++) {
    cursor = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() + step,
    );
  }
  return cursor;
}
