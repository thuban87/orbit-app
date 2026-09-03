/**
 * App font loading (THEME-07 typography foundation).
 *
 * Exposes the expo-font font map for the RN `<Text>` pipeline (Inter Regular +
 * SemiBold, Space Grotesk SemiBold, bundled locally from `assets/` — no network,
 * local-first) and a `loadAppFonts()` helper the `App.tsx` boot ready gate awaits
 * so first paint carries the real fonts.
 *
 * NON-FATAL by contract (REVIEWS 23-02 MEDIUM): `loadAppFonts()` try/catches the
 * underlying expo-font load, logs on failure, and RESOLVES rather than rejecting.
 * A font error therefore degrades to the system font and can never reach
 * `AppShell`'s boot catch or block the app in its startup-error state — the ready
 * gate still proceeds and hydrates theme + database. Proven by `fonts.test.ts`.
 *
 * Node-testability idiom (mirrors `reconcile-photo.ts` / `encryption.ts`): the
 * `require()` of the bundled `.ttf` assets and of `expo-font` (which pulls in
 * react-native) live INSIDE functions, never at module scope — so importing this
 * module in the node/vitest harness never evaluates a `.ttf` require or loads
 * react-native. Tests inject a fake loader; `getFontMap()` / the default loader
 * run only on device.
 *
 * The Skia Orrery font pipeline (`useFonts` in OrreryScreen/OrbitBody, Pitfall 5)
 * is a SEPARATE font system and is intentionally untouched here.
 */
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "fonts";

/**
 * The expo-font font map: family key -> bundled asset. The keys ARE the
 * `fontFamily` names RN `<Text>` (and `AppText`) reference; a distinct key per
 * weight is required because Android does not reliably synthesize a weight from
 * a single custom-family file. `require()` runs only when this is called (device
 * only), keeping the module import react-native-free for node tests.
 */
export function getFontMap(): Record<string, number> {
  return {
    "Inter-Regular": require("../../assets/Inter-Regular.ttf"),
    "Inter-SemiBold": require("../../assets/Inter-SemiBold.ttf"),
    "SpaceGrotesk-SemiBold": require("../../assets/SpaceGrotesk-SemiBold.ttf"),
  };
}

/** The font-load side effect — swappable for a fake in node tests. */
export type FontLoader = () => Promise<void>;

/**
 * Default device loader: expo-font's `loadAsync` over `getFontMap()`. Both
 * `require`s are lazy (inside this function) so the module stays node-importable.
 */
async function defaultLoad(): Promise<void> {
  const Font = require("expo-font") as {
    loadAsync: (map: Record<string, number>) => Promise<void>;
  };
  await Font.loadAsync(getFontMap());
}

/**
 * Load the app fonts, degrading to the system font on any failure. ALWAYS
 * resolves (never rejects) so the boot ready gate can await it unconditionally.
 */
export async function loadAppFonts(
  load: FontLoader = defaultLoad,
): Promise<void> {
  try {
    await load();
  } catch (err) {
    Logger.error(LOG_SCOPE, "font load failed; degrading to system font", err);
  }
}
