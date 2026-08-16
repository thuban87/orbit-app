import OrbitShareFinishModule from "./src/OrbitShareFinishModule";

/**
 * Return the user to the app they shared from (CAP-04).
 *
 * Calls Android's plain `Activity.finish()` natively. Because
 * `expo-share-intent` re-launches capture as the task root, a plain `finish()`
 * returns to the sharing app (Android 15 top-of-task finish rule) — never the
 * remove-task/affinity finish variants (they land on the launcher) and never the
 * RN back-handler exit path (RN-version-dependent mapping). Android-only; a
 * no-op on other platforms.
 */
export function finishActivity(): void {
  OrbitShareFinishModule.finish();
}
