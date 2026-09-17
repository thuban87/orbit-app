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
