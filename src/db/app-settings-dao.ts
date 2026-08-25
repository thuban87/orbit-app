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
import { validateCustomEndpoint } from "@/ai/custom-endpoint";
import { inWriteTransaction } from "@/db/transaction";
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import type { SqlExecutor } from "@/db/types";
import {
  AI_PROVIDER_IDS,
  type AiCloudProviderId,
  type AiProviderId,
} from "@/services/ai-types";

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
  /**
   * Weekly-digest master toggle (DGST-01). Defaults ON (1); a durable OFF the
   * launch sweep cannot re-enable. Gated by the notifications master switch and
   * backup-exportable as a settings row (migration 005, owner-ruled).
   */
  digestEnabled: 0 | 1;
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

  // --- Optional-AI non-secret settings (Phase 14, AI-01) --------------------
  // NO API KEY LIVES HERE — provider credentials are SecureStore-only
  // (ai-key-store.ts). These fields are export-safe by construction.

  /** Active AI provider; `'none'` (default) disables generation entirely. */
  aiProvider: AiProviderId;
  /** Selected model id for the active cloud provider. Empty = unset. */
  aiModel: string;
  /** Custom-endpoint URL. Empty = unconfigured (C3-M5); validated on write. */
  aiCustomEndpoint: string;
  /** Model id sent to the custom endpoint. Empty = unset. */
  aiCustomModel: string;
  /** User prompt-template override. Empty = use the built-in default. */
  aiPromptTemplate: string;
  /**
   * Per-provider egress acknowledgement flags. READABLE here but NOT writable
   * through the generic patch (they are absent from `COLUMN_OF`): only Plan 05's
   * dedicated `acknowledgeProvider` writer may set them to 1 (C3-H3a), and
   * changing the Custom endpoint resets `aiAckCustom` to 0 (C3-H3b).
   */
  aiAckOpenai: 0 | 1;
  aiAckAnthropic: 0 | 1;
  aiAckGoogle: 0 | 1;
  aiAckCustom: 0 | 1;

  // --- Backup settings and device-local bookkeeping (Phase 17) ------------
  /** Portable user choice: run one eligible automatic backup every N days. */
  backupIntervalDays: number;
  /** Portable user choice: retain automatic backups for N days. */
  backupRetentionDays: number;
  /** Device-local SAF destination; never serialized into a portable backup. */
  backupFolderUri: string | null;
  backupFolderName: string | null;
  backupFolderAccessible: 0 | 1;
  backupFolderDiagnostic: string | null;
  /** Verified automatic backup only — manual exports never change this. */
  lastAutomaticBackupAt: string | null;
  /** Monotonic local change signal; never portable. */
  dataRevision: number;
  /** Local snapshot of dataRevision at the last verified automatic backup. */
  lastBackupDataRevision: number;
  /** Local flag coupled to this device's SecureStore-cached passphrase. */
  encryptionEnabled: 0 | 1;
  /** Local Dashboard nudge dismissal. */
  backupNudgeDismissed: 0 | 1;
  /** SQLite LWW timestamp, exposed for portable settings reconciliation. */
  modifiedAt: string;
}

/**
 * The portable wire projection. This allowlist deliberately contains ordinary
 * user preferences only; it cannot represent device-local backup mechanism
 * state or a secret. `sunContactId` is intentionally local at this DAO layer:
 * export/restore translate it to/from a contact UID at their wire boundary.
 */
export interface PortableSettingsSnapshot {
  notificationsEnabled: 0 | 1;
  decayEnabled: 0 | 1;
  birthdayEnabled: 0 | 1;
  digestEnabled: 0 | 1;
  lockscreenPublic: 0 | 1;
  deliveryHour: number;
  quietStartHour: number;
  quietEndHour: number;
  sunContactId: number | null;
  selfSunColour: string | null;
  aiProvider: AiProviderId;
  aiModel: string;
  aiCustomEndpoint: string;
  aiCustomModel: string;
  aiPromptTemplate: string;
  backupIntervalDays: number;
  backupRetentionDays: number;
  modifiedAt: string;
}

/** A partial update of the ordinary portable user preferences. */
export type AppSettingsPatch = Partial<
  Omit<PortableSettingsSnapshot, "modifiedAt">
>;

/**
 * Device-local backup mechanism and health values. No key overlaps the portable
 * snapshot or AppSettingsPatch; callers must use this core inside an existing
 * `inWriteTransaction` and it never advances `data_revision` itself.
 */
export interface BackupBookkeepingPatch {
  backupFolderUri?: string | null;
  backupFolderName?: string | null;
  backupFolderAccessible?: 0 | 1;
  backupFolderDiagnostic?: string | null;
  lastAutomaticBackupAt?: string | null;
  lastBackupDataRevision?: number;
  encryptionEnabled?: 0 | 1;
  backupNudgeDismissed?: 0 | 1;
}

/**
 * The settings keys writable through the generic `updateAppSettings` patch. The
 * four `aiAck*` fields are DELIBERATELY excluded (C3-H3a) — they are read via
 * `AppSettings` but set only by Plan 05's `acknowledgeProvider`; an ack key that
 * appears in a generic patch is silently dropped (never reaches SQL).
 */
type WritableSettingsKey =
  | "notificationsEnabled"
  | "decayEnabled"
  | "birthdayEnabled"
  | "digestEnabled"
  | "lockscreenPublic"
  | "deliveryHour"
  | "quietStartHour"
  | "quietEndHour"
  | "sunContactId"
  | "selfSunColour"
  | "aiProvider"
  | "aiModel"
  | "aiCustomEndpoint"
  | "aiCustomModel"
  | "aiPromptTemplate"
  | "backupIntervalDays"
  | "backupRetentionDays";

/** The persisted (snake_case) column shape of the id=1 row. */
interface AppSettingsRow {
  notifications_enabled: number;
  decay_enabled: number;
  birthday_enabled: number;
  digest_enabled: number;
  lockscreen_public: number;
  delivery_hour: number;
  quiet_start_hour: number;
  quiet_end_hour: number;
  sun_contact_id: number | null;
  self_sun_colour: string | null;
  ai_provider: string;
  ai_model: string;
  ai_custom_endpoint: string;
  ai_custom_model: string;
  ai_prompt_template: string;
  ai_ack_openai: number;
  ai_ack_anthropic: number;
  ai_ack_google: number;
  ai_ack_custom: number;
  backup_interval_days: number;
  backup_retention_days: number;
  backup_folder_uri: string | null;
  backup_folder_name: string | null;
  backup_folder_accessible: number;
  backup_folder_diagnostic: string | null;
  last_automatic_backup_at: string | null;
  data_revision: number;
  last_backup_data_revision: number;
  encryption_enabled: number;
  backup_nudge_dismissed: number;
  modified_at: string;
}

/** The hour fields, validated to 0-23 integers on write. */
const HOUR_FIELDS: Array<keyof AppSettingsPatch> = [
  "deliveryHour",
  "quietStartHour",
  "quietEndHour",
];

/** The 0/1 toggle fields, validated to exactly 0 or 1 on write. */
const TOGGLE_FIELDS: Array<keyof AppSettingsPatch> = [
  "notificationsEnabled",
  "decayEnabled",
  "birthdayEnabled",
  "digestEnabled",
  "lockscreenPublic",
];

const BACKUP_DAY_FIELDS: Array<keyof AppSettingsPatch> = [
  "backupIntervalDays",
  "backupRetentionDays",
];

/**
 * Map each WRITABLE settings field to its column name for the `?`-bound partial
 * UPDATE. The four `ai_ack_*` columns are ABSENT here on purpose (C3-H3a): a
 * generic patch cannot set an acknowledgement flag.
 */
const COLUMN_OF: Record<WritableSettingsKey, string> = {
  notificationsEnabled: "notifications_enabled",
  decayEnabled: "decay_enabled",
  birthdayEnabled: "birthday_enabled",
  digestEnabled: "digest_enabled",
  lockscreenPublic: "lockscreen_public",
  deliveryHour: "delivery_hour",
  quietStartHour: "quiet_start_hour",
  quietEndHour: "quiet_end_hour",
  sunContactId: "sun_contact_id",
  selfSunColour: "self_sun_colour",
  aiProvider: "ai_provider",
  aiModel: "ai_model",
  aiCustomEndpoint: "ai_custom_endpoint",
  aiCustomModel: "ai_custom_model",
  aiPromptTemplate: "ai_prompt_template",
  backupIntervalDays: "backup_interval_days",
  backupRetentionDays: "backup_retention_days",
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
            digest_enabled, lockscreen_public, delivery_hour, quiet_start_hour,
            quiet_end_hour,
            sun_contact_id, self_sun_colour,
            ai_provider, ai_model, ai_custom_endpoint, ai_custom_model,
            ai_prompt_template, ai_ack_openai, ai_ack_anthropic,
            ai_ack_google, ai_ack_custom,
            backup_interval_days, backup_retention_days,
            backup_folder_uri, backup_folder_name, backup_folder_accessible, backup_folder_diagnostic,
            last_automatic_backup_at, data_revision, last_backup_data_revision,
            encryption_enabled, backup_nudge_dismissed, modified_at
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
    digestEnabled: (row.digest_enabled ? 1 : 0) as 0 | 1,
    lockscreenPublic: (row.lockscreen_public ? 1 : 0) as 0 | 1,
    deliveryHour: row.delivery_hour,
    quietStartHour: row.quiet_start_hour,
    quietEndHour: row.quiet_end_hour,
    // Raw NULL passes straight through as null — the DAO NEVER resolves a
    // palette colour (it cannot import theme); resolution happens at render.
    sunContactId: row.sun_contact_id ?? null,
    selfSunColour: row.self_sun_colour ?? null,
    // AI non-secret settings. The column default is `'none'`; the cast is a
    // read-shape convenience (validation on WRITE guarantees a known id).
    aiProvider: row.ai_provider as AiProviderId,
    aiModel: row.ai_model,
    aiCustomEndpoint: row.ai_custom_endpoint,
    aiCustomModel: row.ai_custom_model,
    aiPromptTemplate: row.ai_prompt_template,
    aiAckOpenai: (row.ai_ack_openai ? 1 : 0) as 0 | 1,
    aiAckAnthropic: (row.ai_ack_anthropic ? 1 : 0) as 0 | 1,
    aiAckGoogle: (row.ai_ack_google ? 1 : 0) as 0 | 1,
    aiAckCustom: (row.ai_ack_custom ? 1 : 0) as 0 | 1,
    backupIntervalDays: row.backup_interval_days,
    backupRetentionDays: row.backup_retention_days,
    backupFolderUri: row.backup_folder_uri ?? null,
    backupFolderName: row.backup_folder_name ?? null,
    backupFolderAccessible: (row.backup_folder_accessible ? 1 : 0) as 0 | 1,
    backupFolderDiagnostic: row.backup_folder_diagnostic ?? null,
    lastAutomaticBackupAt: row.last_automatic_backup_at ?? null,
    dataRevision: row.data_revision,
    lastBackupDataRevision: row.last_backup_data_revision,
    encryptionEnabled: (row.encryption_enabled ? 1 : 0) as 0 | 1,
    backupNudgeDismissed: (row.backup_nudge_dismissed ? 1 : 0) as 0 | 1,
    modifiedAt: row.modified_at,
  };
}

/**
 * Read only the portable settings-wire allowlist. Do not replace this explicit
 * projection with `getAppSettings`: the latter intentionally exposes
 * device-local backup state to UI/policy callers, while this function is the
 * sole export seam and must stay unable to read it.
 */
export async function getPortableSettingsSnapshot(
  exec: Pick<SqlExecutor, "getFirstAsync">,
): Promise<PortableSettingsSnapshot> {
  const row = await exec.getFirstAsync<Pick<
    AppSettingsRow,
    | "notifications_enabled"
    | "decay_enabled"
    | "birthday_enabled"
    | "digest_enabled"
    | "lockscreen_public"
    | "delivery_hour"
    | "quiet_start_hour"
    | "quiet_end_hour"
    | "sun_contact_id"
    | "self_sun_colour"
    | "ai_provider"
    | "ai_model"
    | "ai_custom_endpoint"
    | "ai_custom_model"
    | "ai_prompt_template"
    | "backup_interval_days"
    | "backup_retention_days"
    | "modified_at"
  >>(
    `SELECT notifications_enabled, decay_enabled, birthday_enabled,
            digest_enabled, lockscreen_public, delivery_hour, quiet_start_hour,
            quiet_end_hour, sun_contact_id, self_sun_colour,
            ai_provider, ai_model, ai_custom_endpoint, ai_custom_model,
            ai_prompt_template, backup_interval_days, backup_retention_days,
            modified_at
       FROM app_settings
      WHERE id = 1`,
  );
  if (!row) {
    throw new Error("getPortableSettingsSnapshot: app_settings id=1 row is missing");
  }
  return {
    notificationsEnabled: (row.notifications_enabled ? 1 : 0) as 0 | 1,
    decayEnabled: (row.decay_enabled ? 1 : 0) as 0 | 1,
    birthdayEnabled: (row.birthday_enabled ? 1 : 0) as 0 | 1,
    digestEnabled: (row.digest_enabled ? 1 : 0) as 0 | 1,
    lockscreenPublic: (row.lockscreen_public ? 1 : 0) as 0 | 1,
    deliveryHour: row.delivery_hour,
    quietStartHour: row.quiet_start_hour,
    quietEndHour: row.quiet_end_hour,
    sunContactId: row.sun_contact_id ?? null,
    selfSunColour: row.self_sun_colour ?? null,
    aiProvider: row.ai_provider as AiProviderId,
    aiModel: row.ai_model,
    aiCustomEndpoint: row.ai_custom_endpoint,
    aiCustomModel: row.ai_custom_model,
    aiPromptTemplate: row.ai_prompt_template,
    backupIntervalDays: row.backup_interval_days,
    backupRetentionDays: row.backup_retention_days,
    modifiedAt: row.modified_at,
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
const SUN_CONTACT_ID_FIELDS: Array<keyof AppSettingsPatch> = ["sunContactId"];

/** The self-sun-colour fields validated to null or a 6-hex string on write. */
const SELF_SUN_COLOUR_FIELDS: Array<keyof AppSettingsPatch> = ["selfSunColour"];

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

/** Throw unless `v` is a known AI provider id (`ai_provider`, AI-01). */
export function assertAiProvider(field: string, v: unknown): void {
  if (
    typeof v !== "string" ||
    !(AI_PROVIDER_IDS as readonly string[]).includes(v)
  ) {
    throw new Error(
      `updateAppSettings: ${field} must be a known AI provider id, got ${String(v)}`,
    );
  }
}

/**
 * Throw unless `v` is a whole automatic-backup day count in [1,3650]. Exported
 * so every backup settings UI validates exactly the DAO's durable boundary.
 */
export function assertBackupDays(field: string, v: unknown): void {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 3650) {
    throw new Error(
      `updateAppSettings: ${field} must be an integer in [1,3650], got ${String(v)}`,
    );
  }
}

function validateAppSettingsPatch(patch: AppSettingsPatch): void {
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
  for (const field of BACKUP_DAY_FIELDS) {
    if (patch[field] !== undefined) {
      assertBackupDays(field, patch[field]);
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
  if (patch.aiProvider !== undefined) {
    assertAiProvider("aiProvider", patch.aiProvider);
  }
  // A NON-empty Custom endpoint must pass the shared URL-literal egress guard.
  if (patch.aiCustomEndpoint !== undefined && patch.aiCustomEndpoint !== "") {
    const verdict = validateCustomEndpoint(patch.aiCustomEndpoint);
    if (!verdict.ok) {
      throw new Error(
        `updateAppSettings: aiCustomEndpoint rejected — ${verdict.reason}`,
      );
    }
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
  // Validate BEFORE opening the transaction so malformed user input leaves the
  // singleton unchanged. The core repeats validation for direct restore calls.
  validateAppSettingsPatch(patch);
  return inWriteTransaction(exec, async () => {
    await updateAppSettingsCore(exec, patch, now);
    await bumpDataRevisionCore(exec);
  });
}

/**
 * Non-mutexed settings SQL core for an already-open outer transaction (restore
 * composes this with other DAO cores). It deliberately never bumps
 * data_revision; the transaction owner owns exactly one bump after its complete
 * logical operation. Keep the endpoint acknowledgement reset identical to the
 * public wrapper so restore and ordinary edits cannot diverge.
 */
export async function updateAppSettingsCore(
  exec: SqlExecutor,
  patch: AppSettingsPatch,
  now: string,
): Promise<void> {
  validateAppSettingsPatch(patch);

  // Build the base `?`-bound SET list from the validated patch. Only writable
  // keys are in COLUMN_OF, so the four ai_ack_* columns can NEVER be set here
  // (C3-H3a) — an ack key in the patch is silently dropped.
  const assignments: string[] = [];
  const params: unknown[] = [];
  for (const key of Object.keys(COLUMN_OF) as WritableSettingsKey[]) {
    const value = patch[key];
    if (value !== undefined) {
      assignments.push(`${COLUMN_OF[key]} = ?`);
      params.push(value);
    }
  }

  const setClauses = [...assignments];
  // C3-H3b: if the Custom endpoint is being changed to a DIFFERENT value,
  // reset ai_ack_custom to 0 in the SAME transaction, so a new recipient
  // requires a fresh acknowledgement. Writing the SAME endpoint leaves it.
  // The `= 0` literal carries no bind param, so param order stays aligned.
  if (patch.aiCustomEndpoint !== undefined) {
    const current = await exec.getFirstAsync<{ ai_custom_endpoint: string }>(
      "SELECT ai_custom_endpoint FROM app_settings WHERE id = 1",
    );
    if (current && current.ai_custom_endpoint !== patch.aiCustomEndpoint) {
      setClauses.push("ai_ack_custom = 0");
    }
  }
  // `modified_at` is always set, so an empty patch is a well-formed UPDATE.
  setClauses.push("modified_at = ?");
  const finalParams = [...params, now];

  const result = await exec.runAsync(
    `UPDATE app_settings SET ${setClauses.join(", ")} WHERE id = 1`,
    finalParams,
  );
  if (result.changes !== 1) {
    throw new Error(
      `updateAppSettingsCore: expected to update the id=1 row, changed ${result.changes}`,
    );
  }
}

type BackupBookkeepingKey = keyof BackupBookkeepingPatch;

const BACKUP_BOOKKEEPING_COLUMN_OF: Record<BackupBookkeepingKey, string> = {
  backupFolderUri: "backup_folder_uri",
  backupFolderName: "backup_folder_name",
  backupFolderAccessible: "backup_folder_accessible",
  backupFolderDiagnostic: "backup_folder_diagnostic",
  lastAutomaticBackupAt: "last_automatic_backup_at",
  lastBackupDataRevision: "last_backup_data_revision",
  encryptionEnabled: "encryption_enabled",
  backupNudgeDismissed: "backup_nudge_dismissed",
};

/**
 * Persist only device-local automatic-backup health/mechanism state inside an
 * already-open `inWriteTransaction`. This core must never call
 * bumpDataRevisionCore or update `modified_at`: bookkeeping is neither an
 * exportable data change nor a portable settings edit.
 */
export async function recordAutomaticBackupHealthCore(
  exec: SqlExecutor,
  patch: BackupBookkeepingPatch,
): Promise<void> {
  if (
    patch.lastBackupDataRevision !== undefined &&
    (!Number.isInteger(patch.lastBackupDataRevision) || patch.lastBackupDataRevision < 0)
  ) {
    throw new Error("recordAutomaticBackupHealthCore: lastBackupDataRevision must be >= 0");
  }
  if (patch.encryptionEnabled !== undefined) {
    assertToggle("encryptionEnabled", patch.encryptionEnabled);
  }
  if (patch.backupFolderAccessible !== undefined) {
    assertToggle("backupFolderAccessible", patch.backupFolderAccessible);
  }
  if (patch.backupNudgeDismissed !== undefined) {
    assertToggle("backupNudgeDismissed", patch.backupNudgeDismissed);
  }
  const assignments: string[] = [];
  const params: unknown[] = [];
  for (const key of Object.keys(BACKUP_BOOKKEEPING_COLUMN_OF) as BackupBookkeepingKey[]) {
    const value = patch[key];
    if (value !== undefined) {
      assignments.push(`${BACKUP_BOOKKEEPING_COLUMN_OF[key]} = ?`);
      params.push(value);
    }
  }
  if (assignments.length === 0) return;
  const result = await exec.runAsync(
    `UPDATE app_settings SET ${assignments.join(", ")} WHERE id = 1`,
    params,
  );
  if (result.changes !== 1) {
    throw new Error(
      `recordAutomaticBackupHealthCore: expected to update the id=1 row, changed ${result.changes}`,
    );
  }
}

/**
 * Persist the FIRST-SEND acknowledgement for ONE provider (H5 / C2-H3). This is
 * the H5 carve-out and the SOLE writer of any `ai_ack_*` column — the four ack
 * flags are DELIBERATELY absent from `COLUMN_OF`, so the generic patch can never
 * reach them (C3-H3a); only this narrow writer sets one to 1.
 *
 * The provider→column mapping is a FIXED allowlist `switch` over the closed
 * `AiCloudProviderId` union: the column name is one of four SOURCE CONSTANTS,
 * never interpolated from runtime data, so no unknown/forged id can select or
 * synthesize a column (the `never` default is a compile-time exhaustiveness lock
 * and a runtime guard). One `inWriteTransaction`, a `?`-bound single-column
 * UPDATE + `modified_at` bump, and a `changes===1` loud-failure guard (a bad row
 * count throws → rollback), mirroring the favourites/field-defs writer idiom.
 *
 * The Compose caller (Plan 05) `await`s this and only AFTER it RESOLVES may it
 * create the AbortController / call `AiService.generate` — egress is ordered
 * strictly after a durable ack (C2-H3). Writes ONLY `app_settings`; never a
 * contact / interaction / fuel / `last_contact` column (DATA-04 intact).
 */
export function acknowledgeProvider(
  exec: SqlExecutor,
  provider: AiCloudProviderId,
  now: string,
): Promise<void> {
  let column: string;
  switch (provider) {
    case "openai":
      column = "ai_ack_openai";
      break;
    case "anthropic":
      column = "ai_ack_anthropic";
      break;
    case "google":
      column = "ai_ack_google";
      break;
    case "custom":
      column = "ai_ack_custom";
      break;
    default: {
      // Exhaustiveness lock: a new provider id must extend this allowlist here,
      // never fall through to a generic/interpolated column write.
      const _exhaustive: never = provider;
      throw new Error(
        `acknowledgeProvider: unknown provider ${String(_exhaustive)}`,
      );
    }
  }

  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      `UPDATE app_settings SET ${column} = 1, modified_at = ? WHERE id = 1`,
      [now],
    );
    if (result.changes !== 1) {
      throw new Error(
        `acknowledgeProvider: expected to update the id=1 row, changed ${result.changes}`,
      );
    }
    await bumpDataRevisionCore(exec);
  });
}
