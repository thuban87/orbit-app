/**
 * notification-schedule — the reconcile ENGINE (NOTIF-01 decay + the scheduling
 * half of NOTIF-04 birthday). Launch/foreground is the single source of truth for
 * the OS's scheduled set: `reconcileSchedule(exec)` computes the DESIRED future
 * set from live data + settings and makes `getAllScheduledNotificationsAsync()`
 * match it EXACTLY — generically-bodied, replace-not-stack (stable identifier),
 * and PRE-SCHEDULED so a decaying/birthday contact fires without the app being
 * reopened.
 *
 * =============================================================================
 * FOUR review findings are baked into this module — do NOT regress any of them:
 *
 *   H5 (pre-scheduling): reads the FULL eligible set (stable/wobble/overdue, via
 *     listDecayEligibleCandidates) and every non-archived birthday, computing each
 *     one's next FUTURE fire — not only currently-overdue / day-of ones — so an
 *     alert fires even if the app is never reopened.
 *
 *   Item A (horizon + cap): the DESIRED set is HARD-BOUNDED. H5 made the eligible
 *     set the whole address book, but Android's pending-notification cap SILENTLY
 *     DROPS schedules past it (un-repairable in a local-only DB). We keep only
 *     fires within HORIZON_DAYS, sort by fire instant, and schedule the soonest
 *     MAX_SCHEDULED_NOTIFICATIONS. WITHIN the cap, within-horizon BIRTHDAYS are
 *     RESERVED first (date-specific, one-shot, cannot be caught up) before decay
 *     fills the remaining slots. The launch/foreground reconcile rolls the horizon
 *     forward each run so far-future contacts arm as they approach.
 *
 *   H3 + items C/F (full-request diff): the reconcile diffs the FULL desired
 *     request (fire instant AT HOUR GRANULARITY + channel + category + data +
 *     content.body + content.title) against each currently-scheduled request and
 *     cancels+reschedules under the SAME identifier on ANY mismatch — so a
 *     delivery-hour / quiet-window / lock-screen-channel change, or a contact
 *     RENAME, actually reaches already-pending notifications. The HOUR-granularity
 *     compare is invariant to the per-contact stagger MINUTES (item C) so the
 *     stagger never churns the diff, but a delivery-hour change IS caught.
 *
 *   Item E (Invalid-Date guard): a malformed stored birthday makes
 *     daysUntilBirthday() return null → `today + null` is an Invalid Date (NOT a
 *     throw), which a bare per-candidate try/catch would not catch — so a null
 *     result SKIPS the candidate explicitly.
 *
 * CYCLE-3 HIGH (reconcile serialization race): `reconcileSchedule` is
 *   SELF-COORDINATING via a module-level DEFER-ONE guard (reconcileRunning /
 *   reconcilePending), mirroring launch-sweep.ts:49-90. Multiple fire-and-forget
 *   callers exist (the launch-sweep hook here + the in-app callers in 11-09 /
 *   11-11). Two invocations must NOT interleave: a stale in-flight reconcile that
 *   read the DB BEFORE a snooze/mute commit could otherwise finish AFTER a newer
 *   one and RE-ARM the cancelled notification (NOTIF-03 violation; T-11-RACE). On
 *   re-entry we coalesce (set pending + return); the in-flight run drains pending
 *   with exactly one trailing pass that RE-READS app_settings + the candidate
 *   reads + getAllScheduledNotificationsAsync via the same stable `exec`, so it
 *   always reflects the NEWEST committed state. Coordination is INTERNAL — every
 *   caller keeps calling `reconcileSchedule(getExecutor())` unchanged.
 *
 * NEVER nest a DAO write mutex inside the reconcile: it is READ-ONLY + expo calls.
 * =============================================================================
 *
 * Node-pure DB side (composes notification-read + fire-instant + birthday-logic +
 * app-settings + notification-ids); the only native coupling is the
 * `expo-notifications` scheduling surface, which the unit suite doubles.
 */

import {
  cancelScheduledNotificationAsync,
  getAllScheduledNotificationsAsync,
  SchedulableTriggerInputTypes,
  scheduleNotificationAsync,
} from "expo-notifications";
import { getAppSettings } from "@/db/app-settings-dao";
import {
  type BirthdayNotificationCandidate,
  type DecayEligibleCandidate,
  listBirthdayNotificationCandidates,
  listDecayEligibleCandidates,
} from "@/db/notification-read";
import type { SqlExecutor } from "@/db/types";
import { daysUntilBirthday } from "@/logic/birthday-logic";
import { registerSweepHook } from "@/services/launch-sweep";
import { formatLocalDate } from "@/utils/dates";
import { Logger } from "@/utils/logger";
import { nextAllowedFireInstant, nextNudgeDate } from "./fire-instant";
import {
  BIRTHDAY_CHANNEL,
  birthdayBody,
  birthdayIdentifier,
  DECAY_CATEGORY,
  DECAY_PRIVATE_CHANNEL,
  DECAY_PUBLIC_CHANNEL,
  decayBody,
  decayIdentifier,
  type NotificationData,
} from "./notification-ids";

// ---------------------------------------------------------------------------
// TUNABLES (single-number edits — the tuning surface for the whole engine).
// ---------------------------------------------------------------------------

/** Flat weekly re-nag cadence (DECIDED — never escalate, never daily-nag). */
export const RE_NAG_DAYS = 7;

/**
 * Per-contact minute offset (T-11-COOLDOWN): spreads fire instants across the
 * delivery hour so Android 15's Notification Cooldown does not silently mute the
 * 2nd+ nudges of a same-morning burst. `staggerFor(contactId)` derives a STABLE
 * minute from the contactId (never the array index — item C).
 */
export const STAGGER_MINUTES = 5;
export const STAGGER_SLOTS = 12; // 12 slots × 5 min = a 0–55-minute spread.

/**
 * Item A horizon: only PRE-SCHEDULE a fire within this many days ahead. The
 * launch/foreground reconcile rolls it forward each run so a far-future contact
 * is armed as it approaches. Keeps the pending set small (see the cap below).
 */
export const HORIZON_DAYS = 35;

/**
 * Item A cap: a HARD ceiling on the scheduled count, BELOW Android's per-app
 * pending-notification limit (~50), so the OS can never SILENTLY DROP a schedule
 * (an un-repairable failure class locally). Leaves headroom for decay + birthday.
 */
export const MAX_SCHEDULED_NOTIFICATIONS = 48;

const LOG_SCOPE = "notification-schedule";
const MS_PER_DAY = 86_400_000;

/**
 * A deterministic per-contact minute offset, STABLE across reconciles (item C).
 * NEVER stagger by the array index — that shifts a contact's minute whenever an
 * earlier contact changes and churns the full-request diff.
 */
export function staggerFor(contactId: number): number {
  return (contactId % STAGGER_SLOTS) * STAGGER_MINUTES;
}

/** The desired scheduled request for one contact/occurrence. */
interface DesiredRequest {
  identifier: string;
  fireInstant: Date;
  channelId: string;
  /** Present on decay only (the mark/snooze buttons); birthday has none. */
  categoryIdentifier?: string;
  body: string;
  data: NotificationData;
}

/**
 * The slice of a currently-scheduled request the diff reads. Shaped to match the
 * expo-notifications double (and the real frozen request); accessed via a cast so
 * this module never couples to expo's fragile runtime trigger union.
 */
interface ScheduledEntry {
  identifier: string;
  content?: {
    data?: Partial<NotificationData>;
    body?: string;
    title?: string;
    categoryIdentifier?: string;
  };
  trigger?: {
    channelId?: string;
    date?: number | Date;
  };
}

/** Parse a stored `YYYY-MM-DD` (or `YYYY-MM-DD HH:MM:SS`) as a LOCAL midnight. */
function parseLocalDate(stored: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(stored);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Local midnight of `now` — the today anchor for date math. */
function localMidnight(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Build the desired decay request for one eligible candidate, or null if its base
 * date cannot be derived. base = max(dueDate, snooze_until): a future snooze
 * pushes the reminder PAST expiry (fires after the snooze, never during it, H5);
 * a null/past snooze leaves base = dueDate.
 */
function buildDecayRequest(
  c: DecayEligibleCandidate,
  settings: {
    deliveryHour: number;
    quietStartHour: number;
    quietEndHour: number;
    lockscreenPublic: 0 | 1;
  },
  now: Date,
): DesiredRequest | null {
  const lastContact = parseLocalDate(c.last_contact);
  if (lastContact === null) return null;

  // dueDate = last_contact + interval_days (LOCAL day arithmetic, never UTC).
  const dueDate = new Date(
    lastContact.getFullYear(),
    lastContact.getMonth(),
    lastContact.getDate() + c.interval_days,
  );

  // base = later of dueDate and the (local-parsed) snooze_until.
  let base = dueDate;
  if (c.snooze_until) {
    const snooze = parseLocalDate(c.snooze_until);
    if (snooze !== null && snooze.getTime() > base.getTime()) {
      base = snooze;
    }
  }

  const fireInstant = nextAllowedFireInstant(
    nextNudgeDate(base, now, RE_NAG_DAYS),
    settings.deliveryHour,
    settings.quietStartHour,
    settings.quietEndHour,
    staggerFor(c.id),
    now,
  );

  const occurrenceKey = formatLocalDate(fireInstant);
  return {
    identifier: decayIdentifier(c.id),
    fireInstant,
    channelId: settings.lockscreenPublic
      ? DECAY_PUBLIC_CHANNEL
      : DECAY_PRIVATE_CHANNEL,
    categoryIdentifier: DECAY_CATEGORY,
    body: decayBody(c.name),
    data: { kind: "decay", contactId: c.id, occurrenceKey },
  };
}

/**
 * Build the desired birthday request for one candidate, or null to SKIP it. A
 * malformed stored birthday makes daysUntilBirthday() return null → `today + null`
 * would be an Invalid Date (item E), so a null result skips the candidate.
 */
function buildBirthdayRequest(
  c: BirthdayNotificationCandidate,
  settings: {
    deliveryHour: number;
    quietStartHour: number;
    quietEndHour: number;
  },
  now: Date,
  today: Date,
): DesiredRequest | null {
  const days = daysUntilBirthday(c.birthday, today);
  if (days === null) return null; // item E — never schedule an Invalid Date.

  // nextBday = today + days (LOCAL day arithmetic; this year or next per parser).
  const nextBday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + days,
  );

  const fireInstant = nextAllowedFireInstant(
    nextBday,
    settings.deliveryHour,
    settings.quietStartHour,
    settings.quietEndHour,
    staggerFor(c.id),
    now,
  );

  const occurrenceKey = formatLocalDate(fireInstant);
  return {
    identifier: birthdayIdentifier(c.id),
    fireInstant,
    channelId: BIRTHDAY_CHANNEL,
    body: birthdayBody(c.name),
    data: { kind: "birthday", contactId: c.id, occurrenceKey },
  };
}

/** True if `identifier` belongs to this engine (a decay: or birthday: id). */
function isOwnedIdentifier(identifier: string): boolean {
  return identifier.startsWith("decay:") || identifier.startsWith("birthday:");
}

/** Truncate a fire instant to its LOCAL hour — the item-C diff granularity. */
function hourKey(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
  ).getTime();
}

/**
 * Full-request equality (H3 + items C/F): fire instant AT HOUR GRANULARITY (item
 * C — invariant to the stagger minutes, but a delivery-hour change IS caught) +
 * channelId + categoryIdentifier + data (contactId + occurrenceKey) + content.body
 * (item F — a renamed contact's frozen body refreshes) + content.title. Any
 * mismatch → cancel + reschedule under the same identifier.
 */
export function requestsEqual(
  desired: DesiredRequest,
  existing: ScheduledEntry,
): boolean {
  const existingDate =
    existing.trigger?.date != null ? new Date(existing.trigger.date) : null;
  if (existingDate === null || Number.isNaN(existingDate.getTime())) {
    return false;
  }
  if (hourKey(desired.fireInstant) !== hourKey(existingDate)) return false;

  if (desired.channelId !== existing.trigger?.channelId) return false;
  if (desired.categoryIdentifier !== existing.content?.categoryIdentifier) {
    return false;
  }
  if (desired.body !== existing.content?.body) return false;
  // title is never set by this engine — compare so a real frozen title still
  // forces a refresh if it ever diverges (both undefined → equal).
  if ((desired as { title?: string }).title !== existing.content?.title) {
    return false;
  }

  const d = existing.content?.data;
  return (
    d?.kind === desired.data.kind &&
    d?.contactId === desired.data.contactId &&
    d?.occurrenceKey === desired.data.occurrenceKey
  );
}

/** Schedule one desired request (DATE trigger, stable identifier, generic body). */
async function scheduleOne(req: DesiredRequest): Promise<void> {
  await scheduleNotificationAsync({
    identifier: req.identifier,
    content: {
      body: req.body,
      data: req.data as unknown as Record<string, unknown>,
      ...(req.categoryIdentifier
        ? { categoryIdentifier: req.categoryIdentifier }
        : {}),
      autoDismiss: true,
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DATE,
      channelId: req.channelId,
      date: req.fireInstant,
    },
  } as Parameters<typeof scheduleNotificationAsync>[0]);
}

/** Cancel every owned (decay:/birthday:) identifier currently scheduled. */
async function cancelAllOwned(existing: ScheduledEntry[]): Promise<void> {
  for (const entry of existing) {
    if (!isOwnedIdentifier(entry.identifier)) continue;
    try {
      await cancelScheduledNotificationAsync(entry.identifier);
    } catch (err) {
      Logger.error(LOG_SCOPE, `cancel failed for ${entry.identifier}`, err);
    }
  }
}

/**
 * One full reconcile pass — RE-READS all inputs via the stable `exec` so the
 * DEFER-ONE trailing pass reflects the newest committed state.
 */
async function runReconcilePass(exec: SqlExecutor): Promise<void> {
  const settings = await getAppSettings(exec);
  const existing =
    (await getAllScheduledNotificationsAsync()) as unknown as ScheduledEntry[];

  // (1) Master off → cancel every owned identifier and schedule nothing.
  if (!settings.notificationsEnabled) {
    await cancelAllOwned(existing);
    return;
  }

  const now = new Date();
  const today = localMidnight(now);
  const nowMs = now.getTime();
  const horizonEndMs = nowMs + HORIZON_DAYS * MS_PER_DAY;

  // (2) Read the gated candidate sets (deterministic ORDER BY id — item C).
  const decayCandidates = settings.decayEnabled
    ? await listDecayEligibleCandidates(exec)
    : [];
  const birthdayCandidates = settings.birthdayEnabled
    ? await listBirthdayNotificationCandidates(exec)
    : [];

  // (3) Build desired requests, per-candidate try/catch so one bad row never
  //     aborts the reconcile.
  const decayRequests: DesiredRequest[] = [];
  for (const c of decayCandidates) {
    try {
      const req = buildDecayRequest(c, settings, now);
      if (req) decayRequests.push(req);
    } catch (err) {
      Logger.error(LOG_SCOPE, `decay build failed for contact ${c.id}`, err);
    }
  }
  const birthdayRequests: DesiredRequest[] = [];
  for (const c of birthdayCandidates) {
    try {
      const req = buildBirthdayRequest(c, settings, now, today);
      if (req) birthdayRequests.push(req);
    } catch (err) {
      Logger.error(LOG_SCOPE, `birthday build failed for contact ${c.id}`, err);
    }
  }

  // (3b) HORIZON filter + soonest-N CAP with BIRTHDAYS RESERVED (item A + the
  //      cycle-3 birthday-cap actionable). Keep only fires within
  //      [now, now+HORIZON_DAYS]; sort each set by fire instant (tie-break by
  //      identifier for determinism); take ALL within-horizon birthdays first,
  //      then fill the remaining slots up to MAX with the soonest decay fires.
  const withinHorizon = (r: DesiredRequest): boolean => {
    const t = r.fireInstant.getTime();
    return t >= nowMs && t <= horizonEndMs;
  };
  const bySoonest = (a: DesiredRequest, b: DesiredRequest): number =>
    a.fireInstant.getTime() - b.fireInstant.getTime() ||
    a.identifier.localeCompare(b.identifier);

  const horizonBirthdays = birthdayRequests
    .filter(withinHorizon)
    .sort(bySoonest);
  const horizonDecay = decayRequests.filter(withinHorizon).sort(bySoonest);

  let desiredList: DesiredRequest[];
  if (horizonBirthdays.length >= MAX_SCHEDULED_NOTIFICATIONS) {
    desiredList = horizonBirthdays.slice(0, MAX_SCHEDULED_NOTIFICATIONS);
  } else {
    const remaining = MAX_SCHEDULED_NOTIFICATIONS - horizonBirthdays.length;
    desiredList = [...horizonBirthdays, ...horizonDecay.slice(0, remaining)];
  }

  const desired = new Map<string, DesiredRequest>();
  for (const req of desiredList) desired.set(req.identifier, req);

  // (4) Cancel every owned identifier NOT in the desired set (also drops ids that
  //     fell out of the horizon/cap window since the last reconcile).
  for (const entry of existing) {
    if (!isOwnedIdentifier(entry.identifier)) continue;
    if (desired.has(entry.identifier)) continue;
    try {
      await cancelScheduledNotificationAsync(entry.identifier);
    } catch (err) {
      Logger.error(LOG_SCOPE, `cancel failed for ${entry.identifier}`, err);
    }
  }

  // (5) FULL-REQUEST DIFF: schedule new / leave matching untouched / cancel +
  //     reschedule under the same identifier on any facet mismatch (H3 + C/F).
  const existingById = new Map<string, ScheduledEntry>();
  for (const entry of existing) existingById.set(entry.identifier, entry);

  for (const req of desired.values()) {
    try {
      const current = existingById.get(req.identifier);
      if (!current) {
        await scheduleOne(req);
      } else if (!requestsEqual(req, current)) {
        await cancelScheduledNotificationAsync(req.identifier);
        await scheduleOne(req);
      }
      // else: identical request → leave untouched (occurrenceKey stays constant).
    } catch (err) {
      Logger.error(LOG_SCOPE, `schedule failed for ${req.identifier}`, err);
    }
  }
}

// Module-level DEFER-ONE coordinator (cycle-3 HIGH / T-11-RACE), mirroring
// launch-sweep.ts:49-90. A re-entrant call while a reconcile is IN FLIGHT does
// NOT interleave — it requests exactly ONE trailing pass, so a burst of
// fire-and-forget callers coalesces to a single follow-up that reflects the
// newest committed state (never re-arming a just-cancelled notification).
let reconcileRunning = false;
let reconcilePending = false;

/**
 * Reconcile the OS's scheduled set to the desired future set derived from live
 * data + settings. SELF-COORDINATING: safe to fire-and-forget from any caller;
 * overlapping calls coalesce to one trailing pass. Read-only on the DB (never
 * nest a DAO write mutex here).
 */
export async function reconcileSchedule(exec: SqlExecutor): Promise<void> {
  if (reconcileRunning) {
    reconcilePending = true;
    return;
  }
  reconcileRunning = true;
  try {
    do {
      // Reset before the pass so an overlapping call DURING it is captured for
      // exactly one more pass (coalescing a burst into a single trailing pass).
      reconcilePending = false;
      await runReconcilePass(exec);
    } while (reconcilePending);
  } finally {
    reconcileRunning = false;
    reconcilePending = false;
  }
}

/**
 * Register the reconcile as a launch-sweep hook (mirrors registerFieldSweep):
 * pushes ONE idempotent hook that calls `reconcileSchedule(getExec())`. The exec
 * is taken lazily so registration can precede DB materialisation. Importing this
 * module runs NOTHING (P5 / T-11-SWEEP).
 */
export function registerNotificationScheduleSweep(
  getExec: () => SqlExecutor,
): void {
  registerSweepHook(async () => {
    await reconcileSchedule(getExec());
  });
}

/**
 * Test-only reset of the DEFER-ONE coordinator so each test starts isolated.
 * Not part of the runtime surface.
 */
export function __resetReconcileForTest(): void {
  reconcileRunning = false;
  reconcilePending = false;
}
