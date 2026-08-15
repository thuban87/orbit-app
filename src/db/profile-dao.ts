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
import { assertSafeRelative } from "@/db/photo-relative-path";
import { inWriteTransaction } from "@/db/transaction";
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
  });
}

/**
 * Clear the self photo (`photo = NULL`) + bump `modified_at`. Asserts exactly one
 * row changed.
 */
export function clearProfilePhoto(
  exec: SqlExecutor,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      "UPDATE profile SET photo = NULL, modified_at = ? WHERE id = 1",
      [now],
    );
    if (result.changes !== 1) {
      throw new Error(
        `clearProfilePhoto: profile row id=1 not updated (changed ${result.changes})`,
      );
    }
  });
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
  exec: SqlExecutor,
): Promise<ProfileRecord | null> {
  return exec.getFirstAsync<ProfileRecord>(
    "SELECT name, photo, modified_at FROM profile WHERE id = 1",
  );
}
