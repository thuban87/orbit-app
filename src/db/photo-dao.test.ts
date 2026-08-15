/**
 * Photo DAO writers — behavioural proof against the REAL migration-1 schema
 * (PHOTO-03 / PHOTO-05 write half).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the real `migration001`
 * fixture (the same `openTestDb` / `nodeSqliteExecutor` / `runMigrations` harness
 * as `purge-dao.test.ts`) and asserts the dedicated single-column writers:
 *   - `setContactPhoto` / `clearContactPhoto` store the RELATIVE filename (or
 *     NULL) on `contacts.photo` + bump `modified_at`, asserting exactly one row
 *     changed; a bad id throws (loud-failure guard, rollback);
 *   - `setProfilePhoto` / `clearProfilePhoto` target the single `profile` row
 *     (id=1) with the same one-row guard;
 *   - `getProfilePhoto` reads the stored relative string or null;
 *   - `getProfile` exposes `{ name, photo, modified_at }` for the id=1 seed row
 *     (name is null until a future self-name editor lands).
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearContactPhoto,
  setContactPhoto,
} from "@/db/contacts-dao";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import {
  clearProfilePhoto,
  getProfile,
  getProfilePhoto,
  setProfilePhoto,
} from "@/db/profile-dao";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-15 12:00:00";
const LATER = "2026-08-15 13:00:00";

let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;

let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  const db = openTestDb();
  exec = nodeSqliteExecutor(db);
  await runMigrations(exec, [migration001], 1, { now: NOW, newUid: uid });
});

async function seedContact(name: string): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [uid(), name, 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function readContact(
  id: number,
): Promise<{ photo: string | null; modified_at: string } | null> {
  return exec.getFirstAsync<{ photo: string | null; modified_at: string }>(
    "SELECT photo, modified_at FROM contacts WHERE id = ?",
    [id],
  );
}

describe("setContactPhoto / clearContactPhoto (PHOTO-03/05)", () => {
  it("stores the relative filename + bumps modified_at", async () => {
    const id = await seedContact("Chris");

    await setContactPhoto(exec, id, "avatars/contact-1.jpg", LATER);

    const row = await readContact(id);
    expect(row?.photo).toBe("avatars/contact-1.jpg");
    expect(row?.modified_at).toBe(LATER);
  });

  it("clears the photo to NULL", async () => {
    const id = await seedContact("Dana");
    await setContactPhoto(exec, id, "avatars/contact-1.jpg", NOW);

    await clearContactPhoto(exec, id, LATER);

    const row = await readContact(id);
    expect(row?.photo).toBeNull();
    expect(row?.modified_at).toBe(LATER);
  });

  it("throws on a bad id (set) and writes nothing", async () => {
    await expect(
      setContactPhoto(exec, 9999, "avatars/contact-9999.jpg", NOW),
    ).rejects.toThrow();
  });

  it("throws on a bad id (clear)", async () => {
    await expect(clearContactPhoto(exec, 9999, NOW)).rejects.toThrow();
  });
});

describe("profile-dao — self record writers/readers (PHOTO-03/05)", () => {
  it("getProfile returns the seed row with a null name + null photo", async () => {
    const profile = await getProfile(exec);
    expect(profile).toEqual({
      name: null,
      photo: null,
      modified_at: NOW,
    });
  });

  it("setProfilePhoto updates the id=1 row + bumps modified_at", async () => {
    await setProfilePhoto(exec, "avatars/profile.jpg", LATER);

    expect(await getProfilePhoto(exec)).toBe("avatars/profile.jpg");
    const profile = await getProfile(exec);
    expect(profile?.photo).toBe("avatars/profile.jpg");
    expect(profile?.modified_at).toBe(LATER);
    expect(profile?.name).toBeNull();
  });

  it("clearProfilePhoto nulls the photo", async () => {
    await setProfilePhoto(exec, "avatars/profile.jpg", NOW);

    await clearProfilePhoto(exec, LATER);

    expect(await getProfilePhoto(exec)).toBeNull();
    const profile = await getProfile(exec);
    expect(profile?.photo).toBeNull();
    expect(profile?.modified_at).toBe(LATER);
  });

  it("getProfilePhoto returns null when unset", async () => {
    expect(await getProfilePhoto(exec)).toBeNull();
  });
});
