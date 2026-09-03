import type { AppSettingsPatch } from "@/db/app-settings-dao";
import type { ThemeMode } from "@/theme/theme-types";

/**
 * One-time legacy `orbit-theme` → `app_settings` mapper (THEME-13, D-08).
 *
 * PURE and RN-free (node-testable) — it maps the legacy AsyncStorage theme value
 * into a column patch the boot coordinator diffs and (conditionally) writes.
 *
 * The legacy value is a ZUSTAND PERSIST ENVELOPE, NOT a flat object (REVIEWS
 * 23-01 MEDIUM — verified on disk: the old theme-store used
 * `persist`/`partialize -> {mode, presetId}` under name `orbit-theme`, so zustand
 * v5 wrote `{"state":{"mode":"dark","presetId":"space-dark"},"version":1}`).
 * The mapper therefore UNWRAPS `parsed.state` and reads `state.mode` /
 * `state.presetId` — reading the envelope's TOP-LEVEL `.mode`/`.presetId` (the
 * pre-fix defect) yields `undefined` on every real upgraded device and silently
 * no-ops while a flat-shape unit test passes false-green.
 *
 * The payload is UNTRUSTED (T-23-01): the `version` field is tolerated (any
 * value); a bare flat `{mode, presetId}` blob is tolerated defensively; an
 * absent/missing `.state`, a malformed value, or an unknown presetId/mode falls
 * back to a NO-OP (empty patch) so a bad column value is never written. Only the
 * known preset `space-dark` maps (→ package `galaxy`, mode onto `galaxyMode`).
 *
 * NOTE: it takes the ALREADY-PARSED value (the coordinator owns `getItem` +
 * `JSON.parse` in their own try/catch), so `JSON.parse` failure never reaches
 * here.
 */

/** The known appearance modes the legacy `mode` may carry. */
function isThemeMode(v: unknown): v is ThemeMode {
  return v === "light" || v === "dark" || v === "system";
}

/** A plain object with the legacy `{ mode?, presetId? }` shape (unvalidated). */
interface LegacyThemeState {
  mode?: unknown;
  presetId?: unknown;
}

/**
 * Unwrap the persist envelope. Returns the inner `state` object, or the value
 * itself when it is a bare flat `{mode, presetId}` blob (defensive tolerance), or
 * `null` when there is nothing mappable (absent `.state`, non-object, etc.).
 */
function extractLegacyState(parsed: unknown): LegacyThemeState | null {
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  // Preferred: the zustand persist envelope { state: {...}, version }. Tolerate
  // any `version` (present/absent/unknown) — do NOT gate on it.
  if (obj.state && typeof obj.state === "object" && !Array.isArray(obj.state)) {
    return obj.state as LegacyThemeState;
  }
  // Defensive: a bare flat blob that itself carries mode/presetId.
  if ("mode" in obj || "presetId" in obj) {
    return obj as LegacyThemeState;
  }
  return null;
}

/**
 * Map a parsed legacy `orbit-theme` value to a column patch. An unmappable or
 * malformed value maps to an EMPTY patch (`{}`) — a true no-op the coordinator's
 * compare-before-write turns into zero writes.
 */
export function mapLegacyThemeBlob(parsed: unknown): AppSettingsPatch {
  const state = extractLegacyState(parsed);
  if (!state) return {};

  const patch: AppSettingsPatch = {};
  // The only preset the legacy store ever held is `space-dark` → package galaxy.
  // An unknown/absent presetId leaves the patch empty (defaults preserved) — we
  // cannot know which package an orphan mode belongs to, so we never write one.
  if (state.presetId === "space-dark") {
    patch.themePackage = "galaxy";
    // Carry the legacy mode onto the galaxy package's remembered mode, but ONLY
    // when it validates — an unknown mode leaves galaxyMode at its seeded default.
    if (isThemeMode(state.mode)) {
      patch.galaxyMode = state.mode;
    }
  }
  return patch;
}

/** The AsyncStorage key the legacy zustand theme store persisted under. */
export const LEGACY_ORBIT_THEME_KEY = "orbit-theme";
