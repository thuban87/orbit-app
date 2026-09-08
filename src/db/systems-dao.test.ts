import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  addSystemOverride,
  createCustomSystem,
  deleteSystem,
  getSystem,
  listCustomSystems,
  listSystemOverrides,
  listSystemPrefs,
  listSystemRules,
  pruneSystemExclusions,
  renameSystem,
  resetSystemOverrides,
  restoreDeletedSystem,
  setSystemOverride,
} from "@/db/systems-dao";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-08 12:00:00";
let exec: SqlExecutor;
let sequence = 0;

async function addContact(name: string): Promise<number> {
  const result = await exec.runAsync(
    "INSERT INTO contacts (uid, name, interval_days, last_contact, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?)",
    [`contact-${++sequence}`, name, 14, "2026-09-01", NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function firstCategoryUid(): Promise<string> {
  const category = await exec.getFirstAsync<{ uid: string }>(
    "SELECT uid FROM categories ORDER BY id LIMIT 1",
  );
  if (!category) throw new Error("expected seeded category");
  return category.uid;
}

beforeEach(async () => {
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: () => `migration-${++sequence}`,
  });
});

describe("systems DAO", () => {
  it("creates and reads a custom System plus its manual override", async () => {
    const system = await createCustomSystem(exec, {
      name: "Close Friends",
      now: NOW,
    });
    expect(system.uid).toBeTruthy();
    expect(await getSystem(exec, system.uid)).toEqual(system);
    expect(await listCustomSystems(exec)).toEqual([system]);
    expect(await listSystemRules(exec, system.id)).toEqual([]);
    expect(await listSystemPrefs(exec)).toEqual([]);

    const contact = await exec.runAsync(
      "INSERT INTO contacts (uid, name, interval_days, last_contact, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?)",
      ["contact-1", "Alex", 14, "2026-09-01", NOW, NOW],
    );
    await addSystemOverride(exec, {
      systemRef: `custom:${system.uid}`,
      contactId: contact.lastInsertRowId,
      mode: "include",
      now: NOW,
    });
    expect(
      await listSystemOverrides(exec, `custom:${system.uid}`),
    ).toMatchObject([{ contactId: contact.lastInsertRowId, mode: "include" }]);
  });

  it("rejects case-insensitive custom, built-in, and Category name collisions", async () => {
    await createCustomSystem(exec, { name: "Close Friends", now: NOW });
    await expect(
      createCustomSystem(exec, { name: "close friends", now: NOW }),
    ).rejects.toThrow("A System named close friends already exists");
    await expect(
      createCustomSystem(exec, { name: "all contacts", now: NOW }),
    ).rejects.toThrow("A System named all contacts already exists");
    await expect(
      createCustomSystem(exec, { name: "FAVORITES", now: NOW }),
    ).rejects.toThrow("A System named FAVORITES already exists");
    await expect(
      createCustomSystem(exec, { name: "family", now: NOW }),
    ).rejects.toThrow("A System named family already exists");
  });

  it("renames only custom Systems with a nonempty cross-catalog-unique name", async () => {
    const system = await createCustomSystem(exec, { name: "Inner Circle", now: NOW });
    await renameSystem(exec, {
      systemRef: `custom:${system.uid}`,
      name: "Study Group",
      now: NOW,
    });
    expect((await getSystem(exec, system.uid))?.name).toBe("Study Group");

    await expect(
      renameSystem(exec, {
        systemRef: `custom:${system.uid}`,
        name: "favorites",
        now: NOW,
      }),
    ).rejects.toThrow("A System named favorites already exists");
    await expect(
      renameSystem(exec, {
        systemRef: `custom:${system.uid}`,
        name: "   ",
        now: NOW,
      }),
    ).rejects.toThrow("Give this System a name.");
    await expect(
      renameSystem(exec, {
        systemRef: "builtin:favorites",
        name: "Nope",
        now: NOW,
      }),
    ).rejects.toThrow("immutable");
  });

  it("deletes only System metadata and restores a uid-stable portable snapshot", async () => {
    const system = await createCustomSystem(exec, { name: "Restore Me", now: NOW });
    const contactId = await addContact("Alex");
    const ref = `custom:${system.uid}` as const;
    await exec.runAsync(
      "INSERT INTO system_rules (uid, system_id, family, value, created_at) VALUES (?, ?, ?, ?, ?)",
      ["rule-restore", system.id, "social-battery", "Charger", NOW],
    );
    await setSystemOverride(exec, { systemRef: ref, contactId, mode: "include", now: NOW });
    await exec.runAsync(
      "INSERT INTO system_prefs (uid, system_ref, display_order, hidden, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?)",
      ["pref-restore", ref, 4, 1, NOW, NOW],
    );
    const beforeContacts = await exec.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM contacts",
    );

    const snapshot = await deleteSystem(exec, { systemRef: ref });
    expect(snapshot).toMatchObject({
      uid: system.uid,
      name: "Restore Me",
      rules: [{ family: "social-battery", value: "Charger" }],
      overrides: [{ contactId, mode: "include" }],
      prefs: { displayOrder: 4, hidden: 1 },
    });
    expect(await getSystem(exec, system.uid)).toBeNull();
    expect(await listSystemOverrides(exec, ref)).toEqual([]);
    expect(await listSystemPrefs(exec)).toEqual([]);
    expect(await exec.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM contacts")).toEqual(beforeContacts);

    // Consume the deleted rowid so the restored rules must use the newly
    // inserted System id rather than accidentally replaying the stale one.
    await createCustomSystem(exec, { name: "Interloper", now: NOW });
    const restored = await restoreDeletedSystem(exec, { snapshot, now: NOW });
    expect(restored.uid).toBe(system.uid);
    expect(restored.id).not.toBe(system.id);
    expect(await listSystemRules(exec, restored.id)).toMatchObject([
      { systemId: restored.id, family: "social-battery", value: "Charger" },
    ]);
    expect(await listSystemOverrides(exec, ref)).toMatchObject([{ contactId, mode: "include" }]);
    expect(await listSystemPrefs(exec)).toMatchObject([
      { systemRef: ref, displayOrder: 4, hidden: 1 },
    ]);
    await expect(deleteSystem(exec, { systemRef: "builtin:favorites" })).rejects.toThrow("immutable");
    await expect(
      deleteSystem(exec, { systemRef: `category:${await firstCategoryUid()}` }),
    ).rejects.toThrow("immutable");
  });

  it("guards every override write with catalog validation and supports valid immutable bases", async () => {
    const system = await createCustomSystem(exec, { name: "Overrides", now: NOW });
    const [first, second, third] = await Promise.all([
      addContact("Alex"),
      addContact("Bea"),
      addContact("Cal"),
    ]);
    const ref = `custom:${system.uid}` as const;
    await setSystemOverride(exec, { systemRef: ref, contactId: first, mode: "include", now: NOW });
    await setSystemOverride(exec, { systemRef: ref, contactId: first, mode: "exclude", now: NOW });
    expect(await listSystemOverrides(exec, ref)).toMatchObject([{ contactId: first, mode: "exclude" }]);
    await setSystemOverride(exec, { systemRef: ref, contactId: first, mode: null, now: NOW });
    expect(await listSystemOverrides(exec, ref)).toEqual([]);

    await setSystemOverride(exec, { systemRef: ref, contactId: first, mode: "exclude", now: NOW });
    await setSystemOverride(exec, { systemRef: ref, contactId: second, mode: "exclude", now: NOW });
    await setSystemOverride(exec, { systemRef: ref, contactId: third, mode: "exclude", now: NOW });
    await pruneSystemExclusions(exec, { systemRef: ref, contactIds: [first, third] });
    expect(await listSystemOverrides(exec, ref)).toMatchObject([{ contactId: second, mode: "exclude" }]);
    await resetSystemOverrides(exec, { systemRef: ref });
    expect(await listSystemOverrides(exec, ref)).toEqual([]);

    const categoryRef = `category:${await firstCategoryUid()}` as const;
    await setSystemOverride(exec, { systemRef: "builtin:favorites", contactId: first, mode: "include", now: NOW });
    await setSystemOverride(exec, { systemRef: categoryRef, contactId: second, mode: "exclude", now: NOW });
    expect(await listSystemOverrides(exec, "builtin:favorites")).toHaveLength(1);
    expect(await listSystemOverrides(exec, categoryRef)).toHaveLength(1);
    await expect(
      setSystemOverride(exec, { systemRef: "custom:missing", contactId: first, mode: "include", now: NOW }),
    ).rejects.toThrow("unknown System");
    await expect(resetSystemOverrides(exec, { systemRef: "custom:missing" })).rejects.toThrow("unknown System");
    await expect(
      pruneSystemExclusions(exec, { systemRef: "custom:missing", contactIds: [first] }),
    ).rejects.toThrow("unknown System");
  });
});
