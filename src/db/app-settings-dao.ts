/**
 * app_settings read/write layer (NOTIF-05 / OQ-1).
 *
 * The single-row `app_settings` table (migration 002) is the backup-native
 * (SQLite, OQ-1) home for the app-level notification controls. The scheduler
 * (Plan 11-05) READS these values; the Settings screen (Plan 11-06/11-11)
 * WRITES them. Per-contact reminder state (`reminders_off` / `snooze_until`)
 * lives on `contacts` and is NOT touched here — this DAO writes ONLY
 * `app_settings`, keeping the recency column's single-writer invariant
 * (DATA-04) intact by construction.
 *
 * WRITE POSTURE mirrors favourites-dao: one `inWriteTransaction`, a `?`-bound
 * partial UPDATE, and a `changes===1` loud-failure guard. Booleans are stored
 * and returned as 0/1 integers (kept consistent end-to-end, no boolean mapping).
 *
 * VALIDATION (T-11-05 tampering/DoS mitigation, RESEARCH §Security V5): every
 * hour field present in a patch MUST be an integer in [0,23] and every toggle
 * MUST be exactly 0 or 1 — validated BEFORE any UPDATE opens, so a malformed
 * value can never reach the stored scheduling inputs. The fire-instant math
 * (Plan 11-05) clamps again as defense-in-depth.
 */
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

/**
 * The app-level notification settings, one row (id=1). Toggles are 0/1
 * integers; hours are 0-23 integers. This is the shape the scheduler reads and
 * the Settings UI edits.
 */
export interface AppSettings {
  /** Master switch — 0 (off) until the user opts in at the value moment. */
  notificationsEnabled: 0 | 1;
  /** Decay (relationship-lapse) reminders, gated by the master switch. */
  decayEnabled: 0 | 1;
  /** Birthday reminders, gated by the master switch. */
  birthdayEnabled: 0 | 1;
  /** Lock-screen preview visibility — 0 (private) by default (OQ-2). */
  lockscreenPublic: 0 | 1;
  /** Hour-of-day (0-23) the daily digest fires. */
  deliveryHour: number;
  /** Quiet-window start hour (0-23). */
  quietStartHour: number;
  /** Quiet-window end hour (0-23). */
  quietEndHour: number;
  /**
   * Orrery sun occupant (ORR-06). A positive `contacts.id`, or NULL = self.
   * The migration-003 FK (`ON DELETE SET NULL`) auto-reverts a hard-purged
   * sun-contact to self.
   */
  sunContactId: number | null;
  /**
   * The user's own star colour (ORR-05) as a 6-hex string, or NULL = unresolved.
   * NULL is resolved to `starPalette[0]` at RENDER time (never in this DAO — the
   * DAO cannot import theme). Only `/^#[0-9A-Fa-f]{6}$/` values are writable.
   */
  selfSunColour: string | null;
}

/** A partial update — only the supplied fields are written. */
export type AppSettingsPatch = Partial<AppSettings>;

/** The persisted (snake_case) column shape of the id=1 row. */
interface AppSettingsRow {
  notifications_enabled: number;
  decay_enabled: number;
  birthday_enabled: number;
  lockscreen_public: number;
  delivery_hour: number;
  quiet_start_hour: number;
  quiet_end_hour: number;
  sun_contact_id: number | null;
  self_sun_colour: string | null;
}

/** The hour fields, validated to 0-23 integers on write. */
const HOUR_FIELDS: Array<keyof AppSettings> = [
  "deliveryHour",
  "quietStartHour",
  "quietEndHour",
];

/** The 0/1 toggle fields, validated to exactly 0 or 1 on write. */
const TOGGLE_FIELDS: Array<keyof AppSettings> = [
  "notificationsEnabled",
  "decayEnabled",
  "birthdayEnabled",
  "lockscreenPublic",
];

/** Map each settings field to its column name for the `?`-bound partial UPDATE. */
const COLUMN_OF: Record<keyof AppSettings, string> = {
  notificationsEnabled: "notifications_enabled",
  decayEnabled: "decay_enabled",
  birthdayEnabled: "birthday_enabled",
  lockscreenPublic: "lockscreen_public",
  deliveryHour: "delivery_hour",
  quietStartHour: "quiet_start_hour",
  quietEndHour: "quiet_end_hour",
  sunContactId: "sun_contact_id",
  selfSunColour: "self_sun_colour",
};

/**
 * Read the single app_settings row (id=1) as a typed `AppSettings`. Pure async
 * read, no transaction. Throws loudly if the row is absent — post-seed it
 * always exists, so a missing row signals a corrupted install rather than a
 * normal empty state.
 */
export async function getAppSettings(exec: SqlExecutor): Promise<AppSettings> {
  const row = await exec.getFirstAsync<AppSettingsRow>(
    `SELECT notifications_enabled, decay_enabled, birthday_enabled,
            lockscreen_public, delivery_hour, quiet_start_hour, quiet_end_hour,
            sun_contact_id, self_sun_colour
       FROM app_settings
      WHERE id = 1`,
  );
  if (!row) {
    throw new Error("getAppSettings: app_settings id=1 row is missing");
  }
  return {
    notificationsEnabled: (row.notifications_enabled ? 1 : 0) as 0 | 1,
    decayEnabled: (row.decay_enabled ? 1 : 0) as 0 | 1,
    birthdayEnabled: (row.birthday_enabled ? 1 : 0) as 0 | 1,
    lockscreenPublic: (row.lockscreen_public ? 1 : 0) as 0 | 1,
    deliveryHour: row.delivery_hour,
    quietStartHour: row.quiet_start_hour,
    quietEndHour: row.quiet_end_hour,
    // Raw NULL passes straight through as null — the DAO NEVER resolves a
    // palette colour (it cannot import theme); resolution happens at render.
    sunContactId: row.sun_contact_id ?? null,
    selfSunColour: row.self_sun_colour ?? null,
  };
}

/** Throw unless `v` is an integer in [0,23] (T-11-05 hour-bounds mitigation). */
function assertHour(field: string, v: unknown): void {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 23) {
    throw new Error(
      `updateAppSettings: ${field} must be an integer in [0,23], got ${String(v)}`,
    );
  }
}

/** Throw unless `v` is exactly 0 or 1. */
function assertToggle(field: string, v: unknown): void {
  if (v !== 0 && v !== 1) {
    throw new Error(
      `updateAppSettings: ${field} must be 0 or 1, got ${String(v)}`,
    );
  }
}

/** The sun-occupant fields validated to null or a positive integer on write. */
const SUN_CONTACT_ID_FIELDS: Array<keyof AppSettings> = ["sunContactId"];

/** The self-sun-colour fields validated to null or a 6-hex string on write. */
const SELF_SUN_COLOUR_FIELDS: Array<keyof AppSettings> = ["selfSunColour"];

/**
 * The SINGLE constraint on what `self_sun_colour` may store: a 6-digit hex
 * (`#RRGGBB`), case-insensitive. EXPORTED (C2-5) so 13-04's starPalette
 * conformance test asserts every palette token against the ACTUAL DAO rule —
 * a duplicated private regex could silently diverge from the palette lock.
 * NOTE (M6): loosening this regex to admit a non-6-hex token (8-digit, 3-digit,
 * or a functional colour form) widens what a `starPalette` swatch write may
 * persist — do not change it without updating the 13-04 conformance test and
 * the 13-06 swatch write.
 */
export const SELF_SUN_COLOUR_RE = /^#[0-9A-Fa-f]{6}$/;

/** Throw unless `v` is null or a positive integer (`sun_contact_id`, ORR-06). */
export function assertSunContactId(field: string, v: unknown): void {
  if (v === null) return;
  if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) {
    throw new Error(
      `updateAppSettings: ${field} must be null or a positive integer, got ${String(v)}`,
    );
  }
}

/**
 * Throw unless `v` is null or matches `SELF_SUN_COLOUR_RE` (`self_sun_colour`,
 * ORR-05). EXPORTED alongside the regex so the write path and the 13-04 palette
 * conformance test consume the SAME symbol (single source of truth). Palette
 * MEMBERSHIP is enforced UI-side; this validator enforces only the hex SHAPE.
 */
export function assertSelfSunColour(field: string, v: unknown): void {
  if (v === null) return;
  if (typeof v !== "string" || !SELF_SUN_COLOUR_RE.test(v)) {
    throw new Error(
      `updateAppSettings: ${field} must be null or a 6-hex colour, got ${String(v)}`,
    );
  }
}

/**
 * Update the supplied settings fields on the id=1 row and bump `modified_at`,
 * inside ONE write transaction with a `changes===1` loud-failure guard
 * (favourites-dao idiom). ALL validation runs BEFORE the UPDATE opens: any hour
 * that is not an integer in [0,23] or any toggle that is not 0/1 throws and no
 * write occurs (T-11-05). An empty patch is an accepted no-op that still bumps
 * `modified_at`. Writes ONLY `app_settings` — never a per-contact column.
 */
export function updateAppSettings(
  exec: SqlExecutor,
  patch: AppSettingsPatch,
  now: string,
): Promise<void> {
  // Validate BEFORE opening the transaction so a bad value never reaches SQL.
  for (const field of HOUR_FIELDS) {
    if (patch[field] !== undefined) {
      assertHour(field, patch[field]);
    }
  }
  for (const field of TOGGLE_FIELDS) {
    if (patch[field] !== undefined) {
      assertToggle(field, patch[field]);
    }
  }
  for (const field of SUN_CONTACT_ID_FIELDS) {
    if (patch[field] !== undefined) {
      assertSunContactId(field, patch[field]);
    }
  }
  for (const field of SELF_SUN_COLOUR_FIELDS) {
    if (patch[field] !== undefined) {
      assertSelfSunColour(field, patch[field]);
    }
  }

  // Build the `?`-bound SET list from the validated patch. `modified_at` is
  // always set, so an empty patch is a well-formed single-column UPDATE.
  const assignments: string[] = [];
  const params: unknown[] = [];
  for (const key of Object.keys(COLUMN_OF) as Array<keyof AppSettings>) {
    const value = patch[key];
    if (value !== undefined) {
      assignments.push(`${COLUMN_OF[key]} = ?`);
      params.push(value);
    }
  }
  assignments.push("modified_at = ?");
  params.push(now);

  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      `UPDATE app_settings SET ${assignments.join(", ")} WHERE id = 1`,
      params,
    );
    if (result.changes !== 1) {
      throw new Error(
        `updateAppSettings: expected to update the id=1 row, changed ${result.changes}`,
      );
    }
  });
}
