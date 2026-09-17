import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  createCategory,
  listCategoriesForManagement,
} from "@/db/categories-dao";
import { readDataRevision } from "@/db/data-revision-dao";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-17 01:00:00";
let counter = 0;
let exec: SqlExecutor;

beforeEach(async () => {
  counter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: () => `seed-${++counter}`,
  });
});

describe("category Add tracer", () => {
  it("accepts an empty taxonomy without writing seeds", async () => {
    await exec.runAsync("DELETE FROM categories");
    expect(await listCategoriesForManagement(exec)).toEqual([]);
    expect(
      await exec.getFirstAsync("SELECT COUNT(*) AS count FROM categories"),
    ).toEqual({ count: 0 });
  });

  it("appends a normalized category and advances revision exactly once", async () => {
    const before = await readDataRevision(exec);
    const created = await createCategory(exec, {
      name: "  Cafe\u0301  ",
      now: NOW,
    });
    expect(created).toMatchObject({ name: "Café", displayOrder: 4 });
    expect(await readDataRevision(exec)).toBe(before + 1);
    expect((await listCategoriesForManagement(exec)).at(-1)).toMatchObject({
      id: created.id,
      uid: created.uid,
      name: "Café",
    });
  });

  it("rejects category and visible System collisions without a write", async () => {
    await expect(
      createCategory(exec, { name: " friends ", now: NOW }),
    ).rejects.toThrow("A category with this name already exists.");
    await exec.runAsync(
      "INSERT INTO systems(uid,name,created_at,modified_at) VALUES(?,?,?,?)",
      ["sys", "Café", NOW, NOW],
    );
    await expect(
      createCategory(exec, { name: " CAFE\u0301 ", now: NOW }),
    ).rejects.toThrow("That name is already used by a System.");
  });
});
