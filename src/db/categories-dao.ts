/** Canonical category catalog reads and serialized writers. */

import { updateAppSettingsCore } from "@/db/app-settings-dao";
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { reassignImportSessionsCategoryCore } from "@/db/import-session-dao";
import { removeCategoryRulesCore } from "@/db/systems-dao";
import { insertTombstoneCore } from "@/db/tombstones-dao";
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

export interface CategoryDeletionCounts {
  contacts: number;
  importPending: number;
  importComplete: number;
  importDiscarded: number;
  rules: number;
  systems: number;
  categoryOverrides: number;
  categoryPrefs: number;
  profilePresentations: number;
  dashboardFilters: number;
  activeSelection: number;
}

export interface CategoryDeletionPreview {
  category: CategoryManagementRow;
  targets: Array<
    Pick<
      CategoryManagementRow,
      "id" | "uid" | "name" | "displayOrder" | "modifiedAt"
    >
  >;
  counts: CategoryDeletionCounts;
  fingerprint: string;
}

export type CategoryDeletionStage =
  | "contacts"
  | "imports"
  | "rules"
  | "overrides"
  | "prefs"
  | "active-selection"
  | "dashboard-filter"
  | "profile"
  | "order"
  | "tombstone"
  | "category";

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

function countValue(row: { count: number } | null): number {
  return row?.count ?? 0;
}

function parseDashboardFilters(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

export async function readCategoryDeletionPreviewCore(
  exec: ReadOnlyExecutor,
  categoryId: number,
): Promise<CategoryDeletionPreview | null> {
  const category = await categoryById(exec, categoryId);
  if (!category) return null;
  const targets = (await listCategoriesForManagement(exec))
    .filter((row) => row.id !== categoryId)
    .map(({ id, uid, name, displayOrder, modifiedAt }) => ({
      id,
      uid,
      name,
      displayOrder,
      modifiedAt,
    }));
  const ref = `category:${category.uid}`;
  const [imports, ruleRows, overrides, prefs, profile, settings] =
    await Promise.all([
      exec.getAllAsync<{ status: string; count: number }>(
        "SELECT status, COUNT(*) AS count FROM import_sessions WHERE batch_category_id=? GROUP BY status ORDER BY status",
        [categoryId],
      ),
      exec.getFirstAsync<{ count: number; systems: number }>(
        "SELECT COUNT(*) AS count, COUNT(DISTINCT system_id) AS systems FROM system_rules WHERE family='category' AND value=?",
        [category.uid],
      ),
      exec.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM system_overrides WHERE system_ref=?",
        [ref],
      ),
      exec.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM system_prefs WHERE system_ref=?",
        [ref],
      ),
      exec.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM profile_category_presentation WHERE category_id=?",
        [categoryId],
      ),
      exec.getFirstAsync<{
        orrery_last_system: string;
        dashboard_filters: string;
      }>(
        "SELECT orrery_last_system,dashboard_filters FROM app_settings WHERE id=1",
      ),
    ]);
  if (!settings)
    throw new Error("Category deletion requires app_settings id=1");
  const importCounts = new Map(imports.map((row) => [row.status, row.count]));
  const filters = parseDashboardFilters(settings.dashboard_filters);
  const selected = Array.isArray(filters.category)
    ? filters.category.filter((value) => value === String(categoryId)).length
    : 0;
  const counts: CategoryDeletionCounts = {
    contacts: category.contactCount,
    importPending: importCounts.get("pending") ?? 0,
    importComplete: importCounts.get("complete") ?? 0,
    importDiscarded: importCounts.get("discarded") ?? 0,
    rules: ruleRows?.count ?? 0,
    systems: ruleRows?.systems ?? 0,
    categoryOverrides: countValue(overrides),
    categoryPrefs: countValue(prefs),
    profilePresentations: countValue(profile),
    dashboardFilters: selected,
    activeSelection: settings.orrery_last_system === ref ? 1 : 0,
  };
  const fingerprint = JSON.stringify({
    id: category.id,
    uid: category.uid,
    name: category.name,
    displayOrder: category.displayOrder,
    modifiedAt: category.modifiedAt,
    counts,
    targets,
  });
  return { category, targets, counts, fingerprint };
}

export function readCategoryDeletionPreview(
  exec: ReadOnlyExecutor,
  categoryId: number,
): Promise<CategoryDeletionPreview | null> {
  return readCategoryDeletionPreviewCore(exec, categoryId);
}

function assertChanges(stage: string, actual: number, expected: number): void {
  if (actual !== expected)
    throw new Error(
      `${stage}: expected ${expected} changed rows, got ${actual}`,
    );
}

export async function applyCategoryDeletionFalloutCore(
  exec: SqlExecutor,
  input: {
    preview: CategoryDeletionPreview;
    targetCategoryId: number | null;
    now: string;
    mode: "interactive" | "merge-null-only";
    afterStage?: (stage: CategoryDeletionStage) => void | Promise<void>;
  },
): Promise<void> {
  if (input.mode === "merge-null-only" && input.targetCategoryId !== null)
    throw new Error(
      "Merge category deletion may only reassign to Uncategorized",
    );
  const { category, counts } = input.preview;
  const stage = async (name: CategoryDeletionStage) => input.afterStage?.(name);
  const contacts = await exec.runAsync(
    "UPDATE contacts SET category_id=?, modified_at=? WHERE category_id=?",
    [input.targetCategoryId, input.now, category.id],
  );
  assertChanges("category contacts", contacts.changes, counts.contacts);
  await stage("contacts");
  const imports = await reassignImportSessionsCategoryCore(
    exec,
    category.id,
    input.targetCategoryId,
    input.now,
  );
  assertChanges(
    "category imports",
    imports,
    counts.importPending + counts.importComplete + counts.importDiscarded,
  );
  await stage("imports");
  assertChanges(
    "category rules",
    await removeCategoryRulesCore(exec, category.uid),
    counts.rules,
  );
  await stage("rules");
  const ref = `category:${category.uid}`;
  const overrides = await exec.runAsync(
    "DELETE FROM system_overrides WHERE system_ref=?",
    [ref],
  );
  assertChanges(
    "category overrides",
    overrides.changes,
    counts.categoryOverrides,
  );
  await stage("overrides");
  const prefs = await exec.runAsync(
    "DELETE FROM system_prefs WHERE system_ref=?",
    [ref],
  );
  assertChanges("category prefs", prefs.changes, counts.categoryPrefs);
  await stage("prefs");
  const settings = await exec.getFirstAsync<{
    orrery_last_system: string;
    dashboard_filters: string;
  }>(
    "SELECT orrery_last_system,dashboard_filters FROM app_settings WHERE id=1",
  );
  if (!settings)
    throw new Error("Category deletion requires app_settings id=1");
  const filters = parseDashboardFilters(settings.dashboard_filters);
  if (Array.isArray(filters.category)) {
    const remaining = filters.category.filter(
      (value) => value !== String(category.id),
    );
    if (remaining.length) filters.category = remaining;
    else delete filters.category;
  }
  if (settings.orrery_last_system === ref)
    await updateAppSettingsCore(
      exec,
      { orreryLastSystem: "builtin:all-contacts" },
      input.now,
    );
  await stage("active-selection");
  await updateAppSettingsCore(
    exec,
    { dashboardFilters: JSON.stringify(filters) },
    input.now,
  );
  await stage("dashboard-filter");
  const profile = await exec.runAsync(
    "DELETE FROM profile_category_presentation WHERE category_id=?",
    [category.id],
  );
  assertChanges(
    "category profile",
    profile.changes,
    counts.profilePresentations,
  );
  await stage("profile");
  const survivors = await exec.getAllAsync<{ id: number }>(
    "SELECT id FROM categories WHERE id<>? ORDER BY display_order,uid",
    [category.id],
  );
  for (let index = 0; index < survivors.length; index += 1)
    await exec.runAsync("UPDATE categories SET display_order=? WHERE id=?", [
      index,
      survivors[index].id,
    ]);
  await stage("order");
  await insertTombstoneCore(
    exec,
    { entityType: "category", entityUid: category.uid, deletedAt: input.now },
    { bumpRevision: false },
  );
  await stage("tombstone");
  const deleted = await exec.runAsync("DELETE FROM categories WHERE id=?", [
    category.id,
  ]);
  assertChanges("category row", deleted.changes, 1);
  await stage("category");
}

export function deleteCategory(
  exec: SqlExecutor,
  input: {
    categoryId: number;
    targetCategoryId: number | null;
    expectedFingerprint: string;
    now: string;
    afterStage?: (stage: CategoryDeletionStage) => void | Promise<void>;
  },
): Promise<
  | { status: "deleted"; preview: CategoryDeletionPreview }
  | { status: "stale"; preview: CategoryDeletionPreview | null }
> {
  return inWriteTransaction(exec, async () => {
    const fresh = await readCategoryDeletionPreviewCore(exec, input.categoryId);
    if (!fresh || fresh.fingerprint !== input.expectedFingerprint)
      return { status: "stale", preview: fresh };
    if (input.targetCategoryId === input.categoryId)
      return { status: "stale", preview: fresh };
    if (
      input.targetCategoryId !== null &&
      !(await exec.getFirstAsync("SELECT id FROM categories WHERE id=?", [
        input.targetCategoryId,
      ]))
    )
      return { status: "stale", preview: fresh };
    await applyCategoryDeletionFalloutCore(exec, {
      preview: fresh,
      targetCategoryId: input.targetCategoryId,
      now: input.now,
      mode: "interactive",
      afterStage: input.afterStage,
    });
    await bumpDataRevisionCore(exec);
    return { status: "deleted", preview: fresh };
  });
}
