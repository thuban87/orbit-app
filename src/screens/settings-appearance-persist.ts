import type { AppSettings, AppSettingsPatch } from "@/db/app-settings-dao";
import type { SqlExecutor } from "@/db/types";
import { themeSelectionFromSettings } from "@/stores/theme-store";
import type { ThemeSelection } from "@/theme/theme-types";

/**
 * Injectable dependencies for the Appearance durable-write path. The caller (the
 * Appearance screen) binds the real DAO writer/reader, the theme-store `hydrate`
 * reconciler, and the local-date clock; the test injects mocks.
 *
 * These deps are a REQUIRED parameter rather than defaulted for the same reason
 * the Interactions assist helper's are (Plan 01): the real `updateAppSettings` /
 * `getAppSettings` bindings transitively import `expo-sqlite`, and `localDateTime`
 * pulls the db layer — whose react-native Flow source vitest-node cannot parse. A
 * top-level default import would make this module (and its required unit test)
 * unloadable in the node test env. Only `themeSelectionFromSettings` (pure, from
 * the node-safe theme-store module) is imported directly; the RN-tethered runtime
 * bindings are pushed to the caller.
 */
export interface PersistAppearanceDeps {
  updateAppSettings: (
    exec: SqlExecutor,
    patch: AppSettingsPatch,
    now: string,
  ) => Promise<void>;
  getAppSettings: (exec: SqlExecutor) => Promise<AppSettings>;
  /** Reconcile the live theme-store back to a durable selection (store `hydrate`). */
  hydrateThemeStore: (selection: ThemeSelection) => void;
  now: () => string;
}

/**
 * The outcome of a durable appearance write. `ok:true` = the write landed. On
 * `ok:false` the live store has already been reconciled back to the durable
 * selection (see `persistAppearanceSetting`), and `error` carries the original
 * failure so the caller can surface an inline, honest save-error notice.
 */
export interface PersistAppearanceResult {
  ok: boolean;
  /** On failure, the durable selection the live store was reconciled to. */
  reconciledSelection?: ThemeSelection;
  error?: unknown;
}

/**
 * Persist an appearance preference (theme package / mode / accent / background)
 * to `app_settings`, reconciling the live theme-store on a failed durable write.
 *
 * The Appearance screen fires the live store setter FIRST (instant restyle is the
 * shipped behaviour — SettingsScreen.tsx), then calls this to write the durable
 * column. The monolith's `persist()` merely logged a caught write error, leaving
 * the Zustand store diverged from what SQLite actually holds (review MEDIUM,
 * cycle-3). This helper closes that: on a failed `updateAppSettings` it re-reads
 * the durable settings, projects them through `themeSelectionFromSettings`, and
 * calls `hydrateThemeStore(...)` to pull the live store back to the persisted
 * value — so the store can never be left diverged from SQLite — then reports the
 * failure to the caller (which renders the inline notice). The failure is neither
 * swallowed nor left silently diverged.
 */
export async function persistAppearanceSetting(
  exec: SqlExecutor,
  patch: AppSettingsPatch,
  deps: PersistAppearanceDeps,
): Promise<PersistAppearanceResult> {
  try {
    await deps.updateAppSettings(exec, patch, deps.now());
    return { ok: true };
  } catch (error) {
    // Failed durable write: the live store was already updated by the setter, so
    // reconcile it back to what SQLite actually holds. Re-read → project → hydrate.
    const durable = await deps.getAppSettings(exec);
    const selection = themeSelectionFromSettings(durable);
    deps.hydrateThemeStore(selection);
    return { ok: false, reconciledSelection: selection, error };
  }
}
