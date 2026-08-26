import { describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration008 } from "@/db/migrations/008-restore-photo-journal";

describe("migration008", () => {
  it("creates durable, uniquely named recovery journal rows", async () => {
    const exec = nodeSqliteExecutor(openTestDb());
    await migration008.apply(exec, { now: "2026-08-25 12:00:00", newUid: () => "unused" });
    await exec.runAsync(
      `INSERT INTO restore_photo_journal
       (relative_path, action, target_kind, canonical_relative_path, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      ["avatars/_restore_pending/profile-s.jpg", "finalize", "profile", "avatars/profile.jpg", "2026-08-25 12:00:00"],
    );
    expect(() => exec.runAsync(
      `INSERT INTO restore_photo_journal
       (relative_path, action, target_kind, canonical_relative_path, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      ["avatars/_restore_pending/profile-s.jpg", "finalize", "profile", "avatars/profile.jpg", "2026-08-25 12:00:00"],
    )).toThrow();
  });
});
