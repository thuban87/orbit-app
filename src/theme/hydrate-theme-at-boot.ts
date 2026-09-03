import type { AppSettings, AppSettingsPatch } from "@/db/app-settings-dao";
import {
  LEGACY_ORBIT_THEME_KEY,
  mapLegacyThemeBlob,
} from "@/theme/orbit-theme-migration";
import { Logger } from "@/utils/logger";

/**
 * Boot theme hydrate + one-time legacy import coordinator (THEME-03/13).
 *
 * A dependency-INJECTED coordinator owning NO React, so its idempotency +
 * error-isolation behaviour is node-testable WITHOUT react-test-renderer (absent
 * from devDeps — mirrors Plan 04's createReducedMotionController extraction).
 * `App.tsx` awaits `openAndMigrate` (so migration 015 is committed), then awaits
 * this coordinator, then hydrates the theme store from its returned settings and
 * flips `ready` — so the first painted MAIN frame carries the saved palette (no
 * wrong-theme flash) and the store never hydrates pre-import values.
 *
 * The EXACT order (REVIEWS 23-01 MEDIUM/HIGH):
 *   1. [App.tsx] await openAndMigrate before calling this.
 *   2. Read the current committed settings ONCE (the pre-import snapshot — used
 *      both to diff against and, absent an import, to hydrate).
 *   3. getItem the legacy `orbit-theme` blob inside a local try/catch — a
 *      rejected/unavailable read is NON-FATAL ("no import this launch").
 *   4. JSON.parse then map via orbit-theme-migration (which unwraps the persist
 *      envelope's `parsed.state`) inside a local try/catch — a corrupt/
 *      unparseable blob is NON-FATAL (no import).
 *   5. COMPARE-BEFORE-WRITE: compute the DIFF of mapped fields whose value
 *      DIFFERS from the pre-import snapshot; call updateAppSettings ONLY when the
 *      diff is NON-EMPTY. Gating on the mapped patch's emptiness is WRONG:
 *      updateAppSettings ALWAYS bumps modified_at + data_revision (even an empty
 *      patch), and the mapped legacy blob is always non-empty, so writing an
 *      already-matching blob would spuriously advance the settings revision every
 *      boot after a FAILED clear and corrupt backup last-writer-wins. The
 *      empty-diff path performs ZERO writes.
 *   6. removeItem the legacy key AFTER step 5 resolves (local try/catch) — a
 *      clear-failure is non-fatal precisely because the next launch diffs to
 *      empty and writes nothing.
 *   7. Return the post-import settings (re-read when a write happened, else the
 *      pre-import snapshot) so the store hydrates the committed values.
 *
 * A write-failure at step 5 leaves the legacy key INTACT (no clear) and does not
 * partially write; the coordinator returns the pre-import snapshot so boot
 * proceeds. None of getItem/JSON.parse/removeItem can block the ready gate.
 */
export interface HydrateThemeDeps {
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
  getAppSettings: () => Promise<AppSettings>;
  updateAppSettings: (patch: AppSettingsPatch) => Promise<void>;
}

const LOG_SCOPE = "theme-hydrate";

/**
 * The subset of mapped fields whose value differs from the current settings.
 * Only keys present in the mapped patch are considered; a matching value is
 * dropped so the diff is empty when the DB already holds the legacy selection.
 */
function diffPatch(
  patch: AppSettingsPatch,
  current: AppSettings,
): AppSettingsPatch {
  const diff: AppSettingsPatch = {};
  const currentRecord = current as unknown as Record<string, unknown>;
  const diffRecord = diff as Record<string, unknown>;
  for (const key of Object.keys(patch) as Array<keyof AppSettingsPatch>) {
    const next = patch[key];
    if (next !== undefined && next !== currentRecord[key]) {
      // Safe: patch and AppSettings share these key types by construction.
      diffRecord[key] = next;
    }
  }
  return diff;
}

export async function hydrateThemeAtBoot(
  deps: HydrateThemeDeps,
): Promise<AppSettings> {
  // Step 2: the pre-import snapshot. A read failure here is a genuine boot
  // problem — let it reject to App.tsx's themed error branch.
  const current = await deps.getAppSettings();

  // Step 3: read the legacy blob; a rejected/unavailable read is non-fatal.
  let raw: string | null;
  try {
    raw = await deps.getItem(LEGACY_ORBIT_THEME_KEY);
  } catch (err) {
    Logger.warn(
      LOG_SCOPE,
      "legacy orbit-theme getItem failed; skipping import",
      err,
    );
    return current;
  }
  if (raw == null) return current;

  // Step 4: parse + map; a corrupt/unparseable blob is non-fatal. The key is
  // left intact (we could not understand it) — the next launch retries harmlessly.
  let patch: AppSettingsPatch;
  try {
    patch = mapLegacyThemeBlob(JSON.parse(raw));
  } catch (err) {
    Logger.warn(
      LOG_SCOPE,
      "legacy orbit-theme blob unparseable; skipping import",
      err,
    );
    return current;
  }

  // Step 5: compare-before-write. Zero writes when the DB already matches.
  const diff = diffPatch(patch, current);
  let post = current;
  if (Object.keys(diff).length > 0) {
    try {
      await deps.updateAppSettings(diff);
    } catch (err) {
      // Write failure: leave the legacy key INTACT for retry; do not clear, do
      // not partially hydrate. Boot proceeds on the pre-import snapshot.
      Logger.error(
        LOG_SCOPE,
        "theme import write failed; leaving orbit-theme intact",
        err,
      );
      return current;
    }
    // Re-read so the returned settings reflect the committed write (and the
    // revision/modified_at bump), never the stale pre-import values.
    post = await deps.getAppSettings();
  }

  // Step 6: clear the legacy key (non-fatal — next launch diffs to empty).
  try {
    await deps.removeItem(LEGACY_ORBIT_THEME_KEY);
  } catch (err) {
    Logger.warn(
      LOG_SCOPE,
      "clearing legacy orbit-theme key failed; will retry next launch",
      err,
    );
  }

  return post;
}
