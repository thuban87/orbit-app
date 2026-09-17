/** Canonical category catalog reads and serialized writers. */
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { inWriteTransaction, type ReadOnlyExecutor } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
import { validateCategoryName } from "@/logic/category-logic";
import { BUILTIN_SYSTEM_LABELS } from "@/logic/orrery-system-logic";

export interface CategoryManagementRow {
  id: number;
  uid: string;
  name: string;
  displayOrder: number;
  contactCount: number;
  createdAt: string;
  modifiedAt: string;
}

type StoredCategoryName = { id: number; name: string };

async function validatedName(
  exec: ReadOnlyExecutor,
  input: string,
  excludeCategoryId?: number,
): Promise<string> {
  const [categories, systems] = await Promise.all([
    exec.getAllAsync<StoredCategoryName>("SELECT id, name FROM categories"),
    exec.getAllAsync<{ name: string }>("SELECT name FROM systems"),
  ]);
  const result = validateCategoryName(input, {
    categoryNames: categories,
    systemNames: [
      ...Object.values(BUILTIN_SYSTEM_LABELS),
      ...systems.map((row) => row.name),
    ],
    excludeCategoryId,
  });
  if (!result.ok) throw new Error(result.message);
  return result.name;
}

export function listCategoriesForManagement(
  exec: ReadOnlyExecutor,
): Promise<CategoryManagementRow[]> {
  return exec.getAllAsync<CategoryManagementRow>(
    `SELECT c.id, c.uid, c.name, c.display_order AS displayOrder,
            COUNT(contact.id) AS contactCount,
            c.created_at AS createdAt, c.modified_at AS modifiedAt
       FROM categories c
       LEFT JOIN contacts contact ON contact.category_id = c.id
      GROUP BY c.id
      ORDER BY c.display_order, c.uid`,
  );
}

export async function createCategoryCore(
  exec: SqlExecutor,
  input: { name: string; now: string },
): Promise<CategoryManagementRow> {
  const name = await validatedName(exec, input.name);
  const order = await exec.getFirstAsync<{ nextOrder: number }>(
    "SELECT COALESCE(MAX(display_order) + 1, 0) AS nextOrder FROM categories",
  );
  if (!order)
    throw new Error("createCategory: failed to determine display order");
  const uid = newUid();
  const inserted = await exec.runAsync(
    "INSERT INTO categories (uid, name, display_order, created_at, modified_at) VALUES (?, ?, ?, ?, ?)",
    [uid, name, order.nextOrder, input.now, input.now],
  );
  return {
    id: inserted.lastInsertRowId,
    uid,
    name,
    displayOrder: order.nextOrder,
    contactCount: 0,
    createdAt: input.now,
    modifiedAt: input.now,
  };
}

export function createCategory(
  exec: SqlExecutor,
  input: { name: string; now: string },
): Promise<CategoryManagementRow> {
  return inWriteTransaction(exec, async () => {
    const row = await createCategoryCore(exec, input);
    await bumpDataRevisionCore(exec);
    return row;
  });
}

async function categoryById(
  exec: ReadOnlyExecutor,
  id: number,
): Promise<CategoryManagementRow | null> {
  return exec.getFirstAsync<CategoryManagementRow>(
    `SELECT c.id, c.uid, c.name, c.display_order AS displayOrder,
            COUNT(contact.id) AS contactCount,
            c.created_at AS createdAt, c.modified_at AS modifiedAt
       FROM categories c
       LEFT JOIN contacts contact ON contact.category_id = c.id
      WHERE c.id = ?
      GROUP BY c.id`,
    [id],
  );
}

export async function renameCategoryCore(
  exec: SqlExecutor,
  input: { id: number; name: string; now: string },
): Promise<CategoryManagementRow> {
  const existing = await categoryById(exec, input.id);
  if (!existing)
    throw new Error(`renameCategory: unknown category id=${input.id}`);
  const name = await validatedName(exec, input.name, input.id);
  const updated = await exec.runAsync(
    "UPDATE categories SET name = ?, modified_at = ? WHERE id = ?",
    [name, input.now, input.id],
  );
  if (updated.changes !== 1) {
    throw new Error(
      `renameCategory: expected one changed row, got ${updated.changes}`,
    );
  }
  return { ...existing, name, modifiedAt: input.now };
}

export function renameCategory(
  exec: SqlExecutor,
  input: { id: number; name: string; now: string },
): Promise<CategoryManagementRow> {
  return inWriteTransaction(exec, async () => {
    const row = await renameCategoryCore(exec, input);
    await bumpDataRevisionCore(exec);
    return row;
  });
}

export async function reorderCategoriesCore(
  exec: SqlExecutor,
  input: { orderedIds: readonly number[]; now: string },
): Promise<void> {
  const stored = await exec.getAllAsync<{ id: number }>(
    "SELECT id FROM categories ORDER BY id",
  );
  const expected = stored.map((row) => row.id);
  const submitted = [...input.orderedIds];
  const submittedSet = new Set(submitted);
  if (
    submitted.length !== expected.length ||
    submittedSet.size !== submitted.length ||
    expected.some((id) => !submittedSet.has(id))
  ) {
    throw new Error(
      "reorderCategories: orderedIds must be the complete current category set",
    );
  }
  for (let index = 0; index < submitted.length; index += 1) {
    const updated = await exec.runAsync(
      "UPDATE categories SET display_order = ?, modified_at = ? WHERE id = ?",
      [index, input.now, submitted[index]],
    );
    if (updated.changes !== 1) {
      throw new Error(
        `reorderCategories: category set changed at id=${submitted[index]}`,
      );
    }
  }
}

export function reorderCategories(
  exec: SqlExecutor,
  input: { orderedIds: readonly number[]; now: string },
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await reorderCategoriesCore(exec, input);
    await bumpDataRevisionCore(exec);
  });
}
