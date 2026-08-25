import { describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  RESERVED_CATEGORY_UIDS,
  RESERVED_PROFILE_UID,
} from "@/db/migrations/007-tombstones";
import { runMigrations } from "@/db/migrations/runner";

const NOW = "2026-08-25 12:00:00";

describe("registered migration chain", () => {
  it("runs the database-owned migration list from v0 through the current target", async () => {
    let counter = 0;
    const exec = nodeSqliteExecutor(openTestDb());
    await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
      now: NOW,
      newUid: () => `uid-${++counter}`,
    });

    expect(MIGRATIONS.filter((migration) => migration.version === 7)).toHaveLength(1);
    expect(await exec.getFirstAsync<{ user_version: number }>("PRAGMA user_version")).toEqual({
      user_version: TARGET_VERSION,
    });
    expect(
      await exec.getFirstAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tombstones'",
      ),
    ).toEqual({ name: "tombstones" });
    expect(
      await exec.getFirstAsync<{ data_revision: number }>(
        "SELECT data_revision FROM app_settings WHERE id = 1",
      ),
    ).toEqual({ data_revision: 0 });
    expect(await exec.getFirstAsync<{ uid: string }>("SELECT uid FROM profile WHERE id = 1")).toEqual({
      uid: RESERVED_PROFILE_UID,
    });
    expect(
      await exec.getAllAsync<{ display_order: number; uid: string }>(
        "SELECT display_order, uid FROM categories ORDER BY display_order",
      ),
    ).toEqual(
      Object.entries(RESERVED_CATEGORY_UIDS).map(([displayOrder, uid]) => ({
        display_order: Number(displayOrder),
        uid,
      })),
    );
  });
});
