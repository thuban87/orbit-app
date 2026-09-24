/**
 * Self/profile record DAO (PHOTO-03 / PHOTO-05 write half) — NET-NEW.
 *
 * The `profile` table is a SINGLE-ROW self record (`id INTEGER PRIMARY KEY CHECK
 * (id = 1)`, migration 001); the seed row (id=1) always exists after migration 1.
 * No profile DAO existed before this phase (RESEARCH Pitfall 6, VERIFIED), so the
 * self avatar gets its own dedicated writers here.
 *
 * The writers mirror `contacts-dao`'s single-column writers exactly: ONE
 * `inWriteTransaction`, a `?`-bound UPDATE targeting `WHERE id = 1`, and a
 * `changes===1` loud-failure guard. The stored value is the RELATIVE filename
 * (`avatars/profile.jpg`) — never an absolute or cache URI. NO file `delete()`
 * lives here (node-pure DAO; the FS side effect is the pipeline's job).
 *
 * `getProfile` exposes `{ name, photo, modified_at }` so a Settings surface can
 * seed the self avatar with a real name source + a cache-bust token; `name` is
 * nullable — the seed row carries no name until a future self-name editor lands.
 *
 * SECURITY (T-05-03): every value is `?`-bound; no identifier is interpolated.
 * Node-pure: takes `exec: SqlExecutor`; imports the shared `inWriteTransaction`.
 */
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { assertSafeRelative } from "@/db/photo-relative-path";
import { inWriteTransaction, type ReadOnlyExecutor } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

/** The self record as surfaced to Settings — `name` is null until edited. */
export interface ProfileRecord {
  name: string | null;
  photo: string | null;
  modified_at: string;
}

/**
 * Set the self photo to a RELATIVE filename + bump `modified_at`. Asserts exactly
 * one row changed (the id=1 seed row always exists; a mismatch throws → rollback).
 */
export async function setProfilePhoto(
  exec: SqlExecutor,
  relative: string,
  now: string,
): Promise<void> {
  // Defense-in-depth: reject a non-`avatars/<name>.<ext>` value BEFORE the UPDATE
  // (and before opening the transaction) — a bad stored value would throw
  // synchronously in `resolvePhotoUri` during render. Same allowlist as the FS
  // chokepoint, imported (never duplicated). `async` so the fail-fast throw
  // surfaces as a rejection (not a sync throw).
  assertSafeRelative(relative);
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      "UPDATE profile SET photo = ?, modified_at = ? WHERE id = 1",
      [relative, now],
    );
    if (result.changes !== 1) {
      throw new Error(
        `setProfilePhoto: profile row id=1 not updated (changed ${result.changes})`,
      );
    }
    await bumpDataRevisionCore(exec);
  });
}

/** Max stored length of the self name (V5 bound), mirroring assertSafeRelative's fail-fast posture. */
const MAX_PROFILE_NAME_LENGTH = 100;

/** True if the string contains any C0/DEL control character — rejected in a stored self name (V5). */
function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

/**
 * Set (or clear) the owner's self name on the single-row `profile` table (id=1),
 * D-04b. Mirrors `setProfilePhoto` exactly: ONE `inWriteTransaction`, a `?`-bound
 * `UPDATE ... WHERE id = 1`, a `changes===1` loud-failure guard, and
 * `bumpDataRevisionCore`. Targets `profile`, NEVER `contacts` (RESEARCH Pitfall 1).
 *
 * Normalises/validates OUTSIDE the transaction (fail-fast, before the UPDATE
 * opens): the input is trimmed; an empty/whitespace-only value (and an explicit
 * `null`) clears the name to SQL NULL — so the `selfName ?? "You"` display
 * fallback stays correct. A non-empty trimmed name over `MAX_PROFILE_NAME_LENGTH`
 * or containing a control character is rejected (V5, T-37-01) before any write.
 *
 * No schema change: `profile.name` already exists (migration 001, nullable) and
 * already emits in backup format 5 — no new column, no format bump (D-06).
 */
export async function setProfileName(
  exec: SqlExecutor,
  name: string | null,
  now: string,
): Promise<void> {
  // Normalise: trim, then treat empty/whitespace-only (and null) as a clear.
  const trimmed = name === null ? "" : name.trim();
  const value: string | null = trimmed === "" ? null : trimmed;
  // Fail-fast validation on a non-null value (mirrors assertSafeRelative): reject
  // BEFORE opening the transaction so a bad value never reaches the UPDATE.
  if (value !== null) {
    if (value.length > MAX_PROFILE_NAME_LENGTH) {
      throw new Error(
        `setProfileName: name exceeds ${MAX_PROFILE_NAME_LENGTH} characters (got ${value.length})`,
      );
    }
    if (hasControlChar(value)) {
      throw new Error("setProfileName: name contains control characters");
    }
  }
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      "UPDATE profile SET name = ?, modified_at = ? WHERE id = 1",
      [value, now],
    );
    if (result.changes !== 1) {
      throw new Error(
        `setProfileName: profile row id=1 not updated (changed ${result.changes})`,
      );
    }
    await bumpDataRevisionCore(exec);
  });
}

/**
 * Clear the self photo (`photo = NULL`) + bump `modified_at`. Asserts exactly one
 * row changed.
 */
export async function clearProfilePhotoCore(
  exec: SqlExecutor,
  now: string,
): Promise<void> {
  const result = await exec.runAsync(
    "UPDATE profile SET photo = NULL, modified_at = ? WHERE id = 1",
    [now],
  );
  if (result.changes !== 1) {
    throw new Error(
      `clearProfilePhoto: profile row id=1 not updated (changed ${result.changes})`,
    );
  }
  await bumpDataRevisionCore(exec);
}

export function clearProfilePhoto(
  exec: SqlExecutor,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, () => clearProfilePhotoCore(exec, now));
}

/** Read the self photo's stored relative filename, or null when unset. */
export async function getProfilePhoto(
  exec: SqlExecutor,
): Promise<string | null> {
  const row = await exec.getFirstAsync<{ photo: string | null }>(
    "SELECT photo FROM profile WHERE id = 1",
  );
  return row?.photo ?? null;
}

/** Read the self record's `{ name, photo, modified_at }` (id=1 seed row). */
export async function getProfile(
  exec: ReadOnlyExecutor,
): Promise<ProfileRecord | null> {
  return exec.getFirstAsync<ProfileRecord>(
    "SELECT name, photo, modified_at FROM profile WHERE id = 1",
  );
}
