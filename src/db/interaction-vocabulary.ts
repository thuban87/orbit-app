/**
 * The SINGLE canonical legacy->new interaction vocabulary map (D-06).
 *
 * Phase 32 renames the interaction `quality` VALUES to a Tone vocabulary
 * (`good`->`Positive`, `fine`->`Neutral`, `hard`->`Negative`) and collapses the
 * six-value `channel` vocabulary to three user-facing labels (`text`/`email`->
 * `Message`, `call`->`Call`, `in-person`->`In Person`), keeping `other` and
 * `unspecified` as legacy-representable pass-through values. The SQL COLUMN names
 * stay `quality` / `channel` (values migrate, names do NOT — a locked invariant so
 * export-manifest / restore-apply keep round-tripping without a backup-format bump).
 *
 * =============================================================================
 * WHY THIS MODULE IS THE ONE SOURCE OF TRUTH (D-06 trip-wire):
 *   A partial vocabulary rename silently corrupts AI context and the weekly digest
 *   on unreachable on-device databases. The remap therefore lives HERE, once, and
 *   is consumed by:
 *     - migration 025's log-time re-map at schema upgrade (via FROZEN CASE literals
 *       pinned equal to these helpers by test — the migration must NOT call these
 *       helpers at runtime, so a later edit here cannot silently alter shipped
 *       migration behavior);
 *     - Plan 02's restore-remap writer of `interactions`;
 *     - the live `markAssistLogged` writer, which routes an assist transport
 *       channel (`call`/`text`/`email`) through `remapLegacyChannel` at log time so
 *       no assist ever persists a retired `email`/`text`/`call` value into a v25
 *       `interactions` row.
 *   There is exactly one map. Never write a divergent second copy.
 * =============================================================================
 *
 * Pure and dependency-free. Any value NOT in a map (including `null`, `undefined`,
 * `other`, `unspecified`, or an already-migrated value) passes through unchanged —
 * the maps only ever REPLACE a known legacy literal, never coerce anything else.
 */

/** Legacy `quality` value -> Tone value. `other`/`unspecified`/NULL are NOT here (pass through). */
export const LEGACY_QUALITY_REMAP: Readonly<Record<string, string>> = Object.freeze({
  good: "Positive",
  fine: "Neutral",
  hard: "Negative",
});

/** Legacy `channel` value -> user-facing label. `other`/`unspecified`/NULL are NOT here (pass through). */
export const LEGACY_CHANNEL_REMAP: Readonly<Record<string, string>> = Object.freeze({
  text: "Message",
  email: "Message",
  call: "Call",
  "in-person": "In Person",
});

/**
 * Map a stored `quality` value to its Tone value, passing through any value not in
 * `LEGACY_QUALITY_REMAP` (including `null`/`undefined`, `other`, `unspecified`, and
 * an already-migrated `Positive`/`Neutral`/`Negative`).
 */
export function remapLegacyQuality<T extends string | null | undefined>(
  value: T,
): T | string {
  if (typeof value === "string" && value in LEGACY_QUALITY_REMAP) {
    return LEGACY_QUALITY_REMAP[value];
  }
  return value;
}

/**
 * Map a stored `channel` value to its user-facing label, passing through any value
 * not in `LEGACY_CHANNEL_REMAP` (including `null`/`undefined`, `other`,
 * `unspecified`, and an already-migrated label).
 */
export function remapLegacyChannel<T extends string | null | undefined>(
  value: T,
): T | string {
  if (typeof value === "string" && value in LEGACY_CHANNEL_REMAP) {
    return LEGACY_CHANNEL_REMAP[value];
  }
  return value;
}
