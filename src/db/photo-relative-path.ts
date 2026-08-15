/**
 * Photo relative-path allowlist (T-05-02 / T-05-03) — the SINGLE node-pure
 * definition of what a STORED photo value is allowed to be.
 *
 * The DB only ever stores a RELATIVE filename under `Paths.document`
 * (`avatars/<name>.<ext>`), never an absolute or `file://`/`cache://` URI
 * (05-RESEARCH Pitfalls 1 & 3). This module is the shared, native-free home of
 * that invariant so BOTH the FS chokepoint (`services/photos/photo-storage.ts`)
 * and the node-pure DAO write boundary (`setContactPhoto` / `setProfilePhoto`)
 * assert the exact SAME shape — the regex lives here ONCE and is imported, never
 * duplicated. Kept in `@/db` (no `expo-file-system` import) so the DAOs stay
 * node-pure and import only `@/db/*`.
 */

/**
 * Allowlist for a RAW relative photo string reaching a write/FS boundary.
 * Requires the exact `avatars/<name>.<ext>` shape — `<name>` from the derivable
 * charset `[A-Za-z0-9_-]+` and `<ext>` one of the image extensions — so `..`, a
 * leading `/`, a Windows drive/backslash, a `file://`/absolute prefix, and a
 * null byte are all rejected by construction.
 */
export const SAFE_RELATIVE = /^avatars\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/;

/**
 * Throw unless `relative` is a safe `avatars/<name>.<ext>` relative path. Used at
 * the FS chokepoint AND at the DAO write boundary as defense-in-depth: a stored
 * absolute/`cache://` value would otherwise reach `resolvePhotoUri` and throw
 * SYNCHRONOUSLY during render (uncaught by `Avatar`'s `onError`), crashing the
 * screen. Rejecting at write time keeps the bad value out of the DB entirely.
 */
export function assertSafeRelative(relative: string): void {
  if (
    typeof relative !== "string" ||
    relative.includes("\0") ||
    !SAFE_RELATIVE.test(relative)
  ) {
    throw new Error(`unsafe photo relative path: ${JSON.stringify(relative)}`);
  }
}
