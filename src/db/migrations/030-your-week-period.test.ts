import { describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";

describe("migration 030 — Your Week period", () => {
  it("advances an explicit v1 fixture through the full chain to the rolling default", async () => {
    let uid = 0;
    const deps = {
      now: "2026-09-19 00:00:00",
      newUid: () => `seed-uid-${++uid}`,
    };
    const exec = nodeSqliteExecutor(openTestDb());
    await runMigrations(exec, MIGRATIONS, 1, deps);
    expect(await exec.getFirstAsync("PRAGMA user_version")).toEqual({
      user_version: 1,
    });

    await runMigrations(exec, MIGRATIONS, TARGET_VERSION, deps);

    expect(await exec.getFirstAsync("PRAGMA user_version")).toEqual({
      user_version: 30,
    });
    expect(
      await exec.getFirstAsync(
        "SELECT your_week_period FROM app_settings WHERE id = 1",
      ),
    ).toEqual({ your_week_period: "rolling7" });
  });
});
