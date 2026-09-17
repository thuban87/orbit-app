import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  createCategory,
  deleteCategory,
  listCategoriesForManagement,
  readCategoryDeletionPreview,
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

describe("atomic category deletion", () => {
  it.each([
    ["malformed JSON", "{"],
    ["null", "null"],
    ["an array", "[]"],
    ["a primitive", '"category"'],
    ["an unknown family", JSON.stringify({ unknown: ["value"] })],
    ["a non-array family", JSON.stringify({ gravity: "Inner" })],
    ["a non-string selection", JSON.stringify({ gravity: [1] })],
    ["an invalid category token", JSON.stringify({ category: ["01"] })],
  ])("rejects %s in durable Dashboard filters", async (_label, stored) => {
    const [source] = await listCategoriesForManagement(exec);
    await exec.runAsync(
      "UPDATE app_settings SET dashboard_filters=? WHERE id=1",
      [stored],
    );

    await expect(readCategoryDeletionPreview(exec, source.id)).rejects.toThrow(
      "Category deletion requires valid dashboard_filters",
    );
    expect(
      await exec.getFirstAsync<{ dashboard_filters: string }>(
        "SELECT dashboard_filters FROM app_settings WHERE id=1",
      ),
    ).toEqual({ dashboard_filters: stored });
  });

  it("accepts canonical filters without narrowing non-category vocabularies", async () => {
    const [source] = await listCategoriesForManagement(exec);
    const stored = JSON.stringify({
      category: [String(source.id), "uncategorized"],
      "social-battery": ["future-battery"],
      "needs-attention": ["future-attention"],
      gravity: ["future-gravity"],
      "contact-frequency": ["future-frequency"],
    });
    await exec.runAsync(
      "UPDATE app_settings SET dashboard_filters=? WHERE id=1",
      [stored],
    );

    const preview = await readCategoryDeletionPreview(exec, source.id);

    expect(preview?.counts.dashboardFilters).toBe(1);
    expect(
      await exec.getFirstAsync<{ dashboard_filters: string }>(
        "SELECT dashboard_filters FROM app_settings WHERE id=1",
      ),
    ).toEqual({ dashboard_filters: stored });
  });

  it("previews all-status fallout and commits one identity-safe aggregate", async () => {
    const [source, target] = await listCategoriesForManagement(exec);
    await exec.runAsync(
      "INSERT INTO contacts(uid,name,category_id,interval_days,tracking_enabled,archived_at,created_at,modified_at) VALUES(?,?,?,?,?,?,?,?)",
      ["archived", "Archived", source.id, 30, 0, NOW, NOW, NOW],
    );
    for (const status of ["pending", "complete", "discarded"]) {
      await exec.runAsync(
        "INSERT INTO import_sessions(uid,mode,batch_category_id,batch_tracking_enabled,status,total_rows,created_at,modified_at) VALUES(?,?,?,?,?,?,?,?)",
        [`session-${status}`, "bulk", source.id, 1, status, 0, NOW, NOW],
      );
    }
    const system = await exec.runAsync(
      "INSERT INTO systems(uid,name,created_at,modified_at) VALUES(?,?,?,?)",
      ["system-delete", "Delete test", NOW, NOW],
    );
    await exec.runAsync(
      "INSERT INTO system_rules(uid,system_id,family,value,created_at) VALUES(?,?,?,?,?)",
      ["category-rule", system.lastInsertRowId, "category", source.uid, NOW],
    );
    await exec.runAsync(
      "UPDATE app_settings SET orrery_last_system=?, dashboard_filters=? WHERE id=1",
      [
        `category:${source.uid}`,
        JSON.stringify({ category: [String(source.id)], gravity: ["Inner"] }),
      ],
    );

    const preview = await readCategoryDeletionPreview(exec, source.id);
    if (!preview) throw new Error("expected source category preview");
    expect(preview.counts).toMatchObject({
      contacts: 1,
      importPending: 1,
      importComplete: 1,
      importDiscarded: 1,
      rules: 1,
      systems: 1,
      dashboardFilters: 1,
    });
    const beforeRevision = await readDataRevision(exec);
    const result = await deleteCategory(exec, {
      categoryId: source.id,
      targetCategoryId: target.id,
      expectedFingerprint: preview.fingerprint,
      now: "2026-09-17 03:00:00",
    });
    expect(result.status).toBe("deleted");
    expect(
      await exec.getFirstAsync("SELECT id FROM categories WHERE id=?", [
        source.id,
      ]),
    ).toBeNull();
    expect(
      await exec.getFirstAsync(
        "SELECT category_id FROM contacts WHERE uid='archived'",
      ),
    ).toEqual({ category_id: target.id });
    expect(
      await exec.getAllAsync(
        "SELECT status,batch_category_id FROM import_sessions ORDER BY status",
      ),
    ).toEqual([
      { status: "complete", batch_category_id: target.id },
      { status: "discarded", batch_category_id: target.id },
      { status: "pending", batch_category_id: target.id },
    ]);
    expect(
      await exec.getFirstAsync(
        "SELECT COUNT(*) AS count FROM system_rules WHERE uid='category-rule'",
      ),
    ).toEqual({ count: 0 });
    expect(
      await exec.getFirstAsync(
        "SELECT orrery_last_system,dashboard_filters FROM app_settings WHERE id=1",
      ),
    ).toEqual({
      orrery_last_system: "builtin:all-contacts",
      dashboard_filters: JSON.stringify({ gravity: ["Inner"] }),
    });
    expect(
      await exec.getFirstAsync(
        "SELECT entity_type,entity_uid FROM tombstones WHERE entity_type='category' AND entity_uid=?",
        [source.uid],
      ),
    ).toEqual({ entity_type: "category", entity_uid: source.uid });
    expect(await readDataRevision(exec)).toBe(beforeRevision + 1);
  });

  it("returns a refreshed stale preview without writes", async () => {
    const [source] = await listCategoriesForManagement(exec);
    const preview = await readCategoryDeletionPreview(exec, source.id);
    if (!preview) throw new Error("expected source category preview");
    await exec.runAsync(
      "INSERT INTO contacts(uid,name,category_id,interval_days,created_at,modified_at) VALUES(?,?,?,?,?,?)",
      ["late", "Late", source.id, 30, NOW, NOW],
    );
    const result = await deleteCategory(exec, {
      categoryId: source.id,
      targetCategoryId: null,
      expectedFingerprint: preview.fingerprint,
      now: NOW,
    });
    expect(result.status).toBe("stale");
    expect(result.preview?.counts.contacts).toBe(1);
    expect(
      await exec.getFirstAsync("SELECT id FROM categories WHERE id=?", [
        source.id,
      ]),
    ).toEqual({ id: source.id });
  });

  it("rolls back every deletion target when filters corrupt after preview", async () => {
    const [source, target] = await listCategoriesForManagement(exec);
    const contact = await exec.runAsync(
      "INSERT INTO contacts(uid,name,category_id,interval_days,created_at,modified_at) VALUES(?,?,?,?,?,?)",
      ["corrupt-filter", "Corrupt filter", source.id, 30, NOW, NOW],
    );
    for (const status of ["pending", "complete", "discarded"]) {
      await exec.runAsync(
        "INSERT INTO import_sessions(uid,mode,batch_category_id,batch_tracking_enabled,status,total_rows,created_at,modified_at) VALUES(?,?,?,?,?,?,?,?)",
        [`corrupt-${status}`, "bulk", source.id, 1, status, 0, NOW, NOW],
      );
    }
    const system = await exec.runAsync(
      "INSERT INTO systems(uid,name,created_at,modified_at) VALUES(?,?,?,?)",
      ["system-corrupt", "Corrupt filter", NOW, NOW],
    );
    await exec.runAsync(
      "INSERT INTO system_rules(uid,system_id,family,value,created_at) VALUES(?,?,?,?,?)",
      ["rule-corrupt", system.lastInsertRowId, "category", source.uid, NOW],
    );
    const ref = `category:${source.uid}`;
    await exec.runAsync(
      "INSERT INTO system_overrides(uid,system_ref,contact_id,mode,created_at) VALUES(?,?,?,?,?)",
      ["override-corrupt", ref, contact.lastInsertRowId, "include", NOW],
    );
    await exec.runAsync(
      "INSERT INTO system_prefs(uid,system_ref,display_order,hidden,created_at,modified_at) VALUES(?,?,?,?,?,?)",
      ["pref-corrupt", ref, 7, 1, NOW, NOW],
    );
    await exec.runAsync(
      "INSERT INTO profile_category_presentation(category_id,created_at,modified_at) VALUES(?,?,?)",
      [source.id, NOW, NOW],
    );
    await exec.runAsync(
      "UPDATE app_settings SET orrery_last_system=?,dashboard_filters=? WHERE id=1",
      [
        ref,
        JSON.stringify({
          category: [String(source.id), "uncategorized"],
          gravity: ["Outer"],
        }),
      ],
    );
    const preview = await readCategoryDeletionPreview(exec, source.id);
    if (!preview) throw new Error("expected source category preview");
    const corruptFilters = "null";
    await exec.runAsync(
      "UPDATE app_settings SET dashboard_filters=? WHERE id=1",
      [corruptFilters],
    );
    const snapshot = async () => ({
      categories: await exec.getAllAsync("SELECT * FROM categories ORDER BY id"),
      contacts: await exec.getAllAsync("SELECT * FROM contacts ORDER BY id"),
      imports: await exec.getAllAsync(
        "SELECT * FROM import_sessions ORDER BY id",
      ),
      rules: await exec.getAllAsync("SELECT * FROM system_rules ORDER BY id"),
      overrides: await exec.getAllAsync(
        "SELECT * FROM system_overrides ORDER BY id",
      ),
      prefs: await exec.getAllAsync("SELECT * FROM system_prefs ORDER BY id"),
      profile: await exec.getAllAsync(
        "SELECT * FROM profile_category_presentation ORDER BY category_id",
      ),
      settings: await exec.getAllAsync("SELECT * FROM app_settings ORDER BY id"),
      tombstones: await exec.getAllAsync(
        "SELECT * FROM tombstones ORDER BY id",
      ),
    });
    const before = await snapshot();
    const beforeRevision = await readDataRevision(exec);

    await expect(
      deleteCategory(exec, {
        categoryId: source.id,
        targetCategoryId: target.id,
        expectedFingerprint: preview.fingerprint,
        now: "2026-09-17 04:00:00",
      }),
    ).rejects.toThrow("Category deletion requires valid dashboard_filters");

    expect(await snapshot()).toEqual(before);
    expect(before.settings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dashboard_filters: corruptFilters }),
      ]),
    );
    expect(await readDataRevision(exec)).toBe(beforeRevision);
  });

  it.each([
    "contacts",
    "imports",
    "rules",
    "overrides",
    "prefs",
    "active-selection",
    "dashboard-filter",
    "profile",
    "order",
    "tombstone",
    "category",
  ] as const)(
    "rolls back the complete aggregate after %s",
    async (faultStage) => {
      const [source, target] = await listCategoriesForManagement(exec);
      await exec.runAsync(
        "INSERT INTO contacts(uid,name,category_id,interval_days,created_at,modified_at) VALUES(?,?,?,?,?,?)",
        [`rollback-${faultStage}`, "Rollback", source.id, 30, NOW, NOW],
      );
      const preview = await readCategoryDeletionPreview(exec, source.id);
      const before = {
        categories: await exec.getAllAsync(
          "SELECT * FROM categories ORDER BY id",
        ),
        contacts: await exec.getAllAsync("SELECT * FROM contacts ORDER BY id"),
        settings: await exec.getAllAsync(
          "SELECT * FROM app_settings ORDER BY id",
        ),
        tombstones: await exec.getAllAsync(
          "SELECT * FROM tombstones ORDER BY id",
        ),
      };
      await expect(
        deleteCategory(exec, {
          categoryId: source.id,
          targetCategoryId: target.id,
          expectedFingerprint: preview?.fingerprint ?? "",
          now: NOW,
          afterStage(stage) {
            if (stage === faultStage) throw new Error(`fault:${stage}`);
          },
        }),
      ).rejects.toThrow(`fault:${faultStage}`);
      expect({
        categories: await exec.getAllAsync(
          "SELECT * FROM categories ORDER BY id",
        ),
        contacts: await exec.getAllAsync("SELECT * FROM contacts ORDER BY id"),
        settings: await exec.getAllAsync(
          "SELECT * FROM app_settings ORDER BY id",
        ),
        tombstones: await exec.getAllAsync(
          "SELECT * FROM tombstones ORDER BY id",
        ),
      }).toEqual(before);
    },
  );
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
      await exec.getFirstAsync(
        "SELECT category_id FROM contacts WHERE id = ?",
        [contact.lastInsertRowId],
      ),
    ).toEqual({ category_id: category.id });
    expect(await readDataRevision(exec)).toBe(beforeRevision + 1);
  });

  it("normalizes reordered positions and bumps revision exactly once", async () => {
    const rows = await listCategoriesForManagement(exec);
    await exec.runAsync(
      "UPDATE categories SET display_order = display_order * 3",
    );
    const orderedIds = rows.map((row) => row.id).reverse();
    const beforeRevision = await readDataRevision(exec);
    await reorderCategories(exec, { orderedIds, now: NOW });
    expect(
      (await listCategoriesForManagement(exec)).map((row) => [
        row.id,
        row.displayOrder,
      ]),
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
