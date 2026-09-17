import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  createCategory,
  listCategoriesForManagement,
  renameCategory,
  reorderCategories,
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

describe("category rename and reorder", () => {
  it("renames only display text while preserving durable identity and assignments", async () => {
    const [category] = await listCategoriesForManagement(exec);
    const contact = await exec.runAsync(
      "INSERT INTO contacts(uid,name,category_id,interval_days,created_at,modified_at) VALUES(?,?,?,?,?,?)",
      ["contact", "Alex", category.id, 30, NOW, NOW],
    );
    const beforeRevision = await readDataRevision(exec);
    const renamed = await renameCategory(exec, {
      id: category.id,
      name: category.name.toUpperCase(),
      now: "2026-09-17 02:00:00",
    });
    expect(renamed).toMatchObject({
      id: category.id,
      uid: category.uid,
      name: category.name.toUpperCase(),
      displayOrder: category.displayOrder,
    });
    expect(
      await exec.getFirstAsync("SELECT category_id FROM contacts WHERE id = ?", [
        contact.lastInsertRowId,
      ]),
    ).toEqual({ category_id: category.id });
    expect(await readDataRevision(exec)).toBe(beforeRevision + 1);
  });

  it("normalizes reordered positions and bumps revision exactly once", async () => {
    const rows = await listCategoriesForManagement(exec);
    await exec.runAsync("UPDATE categories SET display_order = display_order * 3");
    const orderedIds = rows.map((row) => row.id).reverse();
    const beforeRevision = await readDataRevision(exec);
    await reorderCategories(exec, { orderedIds, now: NOW });
    expect(
      (await listCategoriesForManagement(exec)).map((row) => [row.id, row.displayOrder]),
    ).toEqual(orderedIds.map((id, index) => [id, index]));
    expect(await readDataRevision(exec)).toBe(beforeRevision + 1);
  });

  it.each([
    ["duplicate", (ids: number[]) => [ids[0], ids[0], ...ids.slice(2)]],
    ["missing", (ids: number[]) => ids.slice(0, -1)],
    ["stale", (ids: number[]) => [...ids.slice(0, -1), 99999]],
  ])("rejects a %s reorder before any writes", async (_label, mutate) => {
    const before = await listCategoriesForManagement(exec);
    const beforeRevision = await readDataRevision(exec);
    await expect(
      reorderCategories(exec, {
        orderedIds: mutate(before.map((row) => row.id)),
        now: NOW,
      }),
    ).rejects.toThrow("complete current category set");
    expect(await listCategoriesForManagement(exec)).toEqual(before);
    expect(await readDataRevision(exec)).toBe(beforeRevision);
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
