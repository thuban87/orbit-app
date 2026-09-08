import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import { readOrrerySystemMembersCore } from "@/db/orrery-system-read";
import {
  addSystemOverride,
  createCustomSystem,
  deleteSystemWithActiveFallback,
  duplicateSystem,
  getSystem,
  listCustomSystems,
  listSystemOverrides,
  listSystemPrefs,
  listSystemRules,
  mapBuiltinPredicateToRules,
  nextDuplicateName,
  pruneSystemExclusions,
  renameSystem,
  reorderSystems,
  resetSystemOverrides,
  restoreDeletedSystem,
  restoreDeletedSystemAndActiveSelection,
  saveMembershipOverrides,
  saveSystemDefinition,
  setSystemHidden,
  setSystemOverride,
  setSystemRules,
} from "@/db/systems-dao";
import type { SqlExecutor } from "@/db/types";
import { resolveCustomSystemMembers } from "@/logic/system-rule-resolver";

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
    const system = await createCustomSystem(exec, {
      name: "Inner Circle",
      now: NOW,
    });
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
    const system = await createCustomSystem(exec, {
      name: "Restore Me",
      now: NOW,
    });
    const contactId = await addContact("Alex");
    const ref = `custom:${system.uid}` as const;
    await exec.runAsync(
      "INSERT INTO system_rules (uid, system_id, family, value, created_at) VALUES (?, ?, ?, ?, ?)",
      ["rule-restore", system.id, "social-battery", "Charger", NOW],
    );
    await setSystemOverride(exec, {
      systemRef: ref,
      contactId,
      mode: "include",
      now: NOW,
    });
    await exec.runAsync(
      "INSERT INTO system_prefs (uid, system_ref, display_order, hidden, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?)",
      ["pref-restore", ref, 4, 1, NOW, NOW],
    );
    const beforeContacts = await exec.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM contacts",
    );

    const deletion = await deleteSystemWithActiveFallback(exec, {
      systemRef: ref,
      now: NOW,
    });
    const { snapshot } = deletion;
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
    expect(
      await exec.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM contacts",
      ),
    ).toEqual(beforeContacts);

    // Consume the deleted rowid so the restored rules must use the newly
    // inserted System id rather than accidentally replaying the stale one.
    await createCustomSystem(exec, { name: "Interloper", now: NOW });
    const restored = await restoreDeletedSystem(exec, { snapshot, now: NOW });
    expect(restored.uid).toBe(system.uid);
    expect(restored.id).not.toBe(system.id);
    expect(await listSystemRules(exec, restored.id)).toMatchObject([
      { systemId: restored.id, family: "social-battery", value: "Charger" },
    ]);
    expect(await listSystemOverrides(exec, ref)).toMatchObject([
      { contactId, mode: "include" },
    ]);
    expect(await listSystemPrefs(exec)).toMatchObject([
      { systemRef: ref, displayOrder: 4, hidden: 1 },
    ]);
    await expect(
      deleteSystemWithActiveFallback(exec, {
        systemRef: "builtin:favorites",
        now: NOW,
      }),
    ).rejects.toThrow("immutable");
    await expect(
      deleteSystemWithActiveFallback(exec, {
        systemRef: `category:${await firstCategoryUid()}`,
        now: NOW,
      }),
    ).rejects.toThrow("immutable");
  });

  it("atomically falls back from an active deleted System and bumps revision once", async () => {
    const system = await createCustomSystem(exec, { name: "Active", now: NOW });
    const ref = `custom:${system.uid}` as const;
    await exec.runAsync(
      "UPDATE app_settings SET orrery_last_system = ? WHERE id = 1",
      [ref],
    );
    const before = await exec.getFirstAsync<{ data_revision: number }>(
      "SELECT data_revision FROM app_settings WHERE id = 1",
    );

    const deletion = await deleteSystemWithActiveFallback(exec, {
      systemRef: ref,
      now: NOW,
    });

    expect(deletion.wasActive).toBe(true);
    expect(deletion.snapshot.uid).toBe(system.uid);
    expect(
      await exec.getFirstAsync<{
        orrery_last_system: string;
        data_revision: number;
      }>(
        "SELECT orrery_last_system, data_revision FROM app_settings WHERE id = 1",
      ),
    ).toEqual({
      orrery_last_system: "builtin:all-contacts",
      data_revision: (before?.data_revision ?? 0) + 1,
    });
    expect(await getSystem(exec, system.uid)).toBeNull();
  });

  it("atomically restores the System and its active selection after Undo", async () => {
    const system = await createCustomSystem(exec, {
      name: "Undo Active",
      now: NOW,
    });
    const ref = `custom:${system.uid}` as const;
    await exec.runAsync(
      "UPDATE app_settings SET orrery_last_system = ? WHERE id = 1",
      [ref],
    );
    const deletion = await deleteSystemWithActiveFallback(exec, {
      systemRef: ref,
      now: NOW,
    });
    const beforeRestore = await exec.getFirstAsync<{ data_revision: number }>(
      "SELECT data_revision FROM app_settings WHERE id = 1",
    );

    const restored = await restoreDeletedSystemAndActiveSelection(exec, {
      snapshot: deletion.snapshot,
      restoreActiveSelection: deletion.wasActive,
      now: NOW,
    });

    expect(restored.uid).toBe(system.uid);
    expect(
      await exec.getFirstAsync<{
        orrery_last_system: string;
        data_revision: number;
      }>(
        "SELECT orrery_last_system, data_revision FROM app_settings WHERE id = 1",
      ),
    ).toEqual({
      orrery_last_system: ref,
      data_revision: (beforeRestore?.data_revision ?? 0) + 1,
    });
  });

  it("restores historical broken rules unchanged while keeping them visible for repair", async () => {
    const system = await createCustomSystem(exec, {
      name: "Historical Rules",
      now: NOW,
    });
    const ref = `custom:${system.uid}` as const;
    await exec.runAsync(
      "INSERT INTO system_rules (uid, system_id, family, value, created_at) VALUES (?, ?, ?, ?, ?)",
      ["historical-invalid", system.id, "gravity", "not-a-tier", NOW],
    );
    await exec.runAsync(
      "INSERT INTO system_rules (uid, system_id, family, value, created_at) VALUES (?, ?, ?, ?, ?)",
      ["historical-missing", system.id, "category", "no-longer-exists", NOW],
    );

    const deletion = await deleteSystemWithActiveFallback(exec, {
      systemRef: ref,
      now: NOW,
    });
    const restored = await restoreDeletedSystem(exec, {
      snapshot: deletion.snapshot,
      now: NOW,
    });

    expect(await listSystemRules(exec, restored.id)).toMatchObject([
      { family: "gravity", value: "not-a-tier" },
      { family: "category", value: "no-longer-exists" },
    ]);
    await expect(
      resolveCustomSystemMembers(
        exec,
        { uid: restored.uid },
        NOW,
        async () => null,
      ),
    ).resolves.toMatchObject({
      brokenRules: [
        {
          family: "gravity",
          value: "not-a-tier",
          reason: "invalid-value",
        },
        {
          family: "category",
          value: "no-longer-exists",
          reason: "missing-category",
        },
      ],
    });
  });

  it("guards every override write with catalog validation and supports valid immutable bases", async () => {
    const system = await createCustomSystem(exec, {
      name: "Overrides",
      now: NOW,
    });
    const [first, second, third] = await Promise.all([
      addContact("Alex"),
      addContact("Bea"),
      addContact("Cal"),
    ]);
    const ref = `custom:${system.uid}` as const;
    await setSystemOverride(exec, {
      systemRef: ref,
      contactId: first,
      mode: "include",
      now: NOW,
    });
    await setSystemOverride(exec, {
      systemRef: ref,
      contactId: first,
      mode: "exclude",
      now: NOW,
    });
    expect(await listSystemOverrides(exec, ref)).toMatchObject([
      { contactId: first, mode: "exclude" },
    ]);
    await setSystemOverride(exec, {
      systemRef: ref,
      contactId: first,
      mode: null,
      now: NOW,
    });
    expect(await listSystemOverrides(exec, ref)).toEqual([]);

    await setSystemOverride(exec, {
      systemRef: ref,
      contactId: first,
      mode: "exclude",
      now: NOW,
    });
    await setSystemOverride(exec, {
      systemRef: ref,
      contactId: second,
      mode: "exclude",
      now: NOW,
    });
    await setSystemOverride(exec, {
      systemRef: ref,
      contactId: third,
      mode: "exclude",
      now: NOW,
    });
    await pruneSystemExclusions(exec, {
      systemRef: ref,
      contactIds: [first, third],
    });
    expect(await listSystemOverrides(exec, ref)).toMatchObject([
      { contactId: second, mode: "exclude" },
    ]);
    await resetSystemOverrides(exec, { systemRef: ref });
    expect(await listSystemOverrides(exec, ref)).toEqual([]);

    const categoryRef = `category:${await firstCategoryUid()}` as const;
    await setSystemOverride(exec, {
      systemRef: "builtin:favorites",
      contactId: first,
      mode: "include",
      now: NOW,
    });
    await setSystemOverride(exec, {
      systemRef: categoryRef,
      contactId: second,
      mode: "exclude",
      now: NOW,
    });
    expect(await listSystemOverrides(exec, "builtin:favorites")).toHaveLength(
      1,
    );
    expect(await listSystemOverrides(exec, categoryRef)).toHaveLength(1);
    await expect(
      setSystemOverride(exec, {
        systemRef: "custom:missing",
        contactId: first,
        mode: "include",
        now: NOW,
      }),
    ).rejects.toThrow("unknown System");
    await expect(
      resetSystemOverrides(exec, { systemRef: "custom:missing" }),
    ).rejects.toThrow("unknown System");
    await expect(
      pruneSystemExclusions(exec, {
        systemRef: "custom:missing",
        contactIds: [first],
      }),
    ).rejects.toThrow("unknown System");
  });

  it("uses deterministic case-insensitive Copy names across the complete catalog", () => {
    expect(nextDuplicateName("Inner Circle", new Set())).toBe(
      "Inner Circle Copy",
    );
    expect(
      nextDuplicateName("Inner Circle", new Set(["inner circle copy"])),
    ).toBe("Inner Circle Copy 2");
    expect(
      nextDuplicateName(
        "Inner Circle",
        new Set(
          ["inner circle copy", "INNER CIRCLE COPY 2"].map((name) =>
            name.toLocaleLowerCase(),
          ),
        ),
      ),
    ).toBe("Inner Circle Copy 3");
  });

  it("duplicates custom predicates and overrides, while built-ins and Categories become editable rules", async () => {
    const contactId = await addContact("Alex");
    const source = await createCustomSystem(exec, { name: "Source", now: NOW });
    const sourceRef = `custom:${source.uid}` as const;
    await setSystemRules(exec, {
      systemRef: sourceRef,
      rules: [{ family: "social-battery", value: "Charger" }],
      now: NOW,
    });
    await setSystemOverride(exec, {
      systemRef: sourceRef,
      contactId,
      mode: "include",
      now: NOW,
    });

    const customCopy = await duplicateSystem(exec, {
      systemRef: sourceRef,
      now: NOW,
    });
    expect(customCopy.name).toBe("Source Copy");
    expect(await listSystemRules(exec, customCopy.id)).toMatchObject([
      { family: "social-battery", value: "Charger" },
    ]);
    expect(
      await listSystemOverrides(exec, `custom:${customCopy.uid}`),
    ).toMatchObject([{ contactId, mode: "include" }]);

    const chargers = await duplicateSystem(exec, {
      systemRef: "builtin:chargers",
      now: NOW,
    });
    expect(await listSystemRules(exec, chargers.id)).toMatchObject([
      { family: "social-battery", value: "Charger" },
    ]);
    const categoryUid = await firstCategoryUid();
    const category = await duplicateSystem(exec, {
      systemRef: `category:${categoryUid}`,
      now: NOW,
    });
    expect(await listSystemRules(exec, category.id)).toMatchObject([
      { family: "category", value: categoryUid },
    ]);
  });

  it("duplicates All Contacts with scope:population and resolves the same members", async () => {
    const contacted = await addContact("Contacted");
    const neverContacted = await exec.runAsync(
      "INSERT INTO contacts (uid, name, interval_days, created_at, modified_at) VALUES (?, ?, ?, ?, ?)",
      [`contact-${++sequence}`, "Never contacted", 14, NOW, NOW],
    );
    const copy = await duplicateSystem(exec, {
      systemRef: "builtin:all-contacts",
      now: NOW,
    });
    expect(await listSystemRules(exec, copy.id)).toMatchObject([
      { family: "scope", value: "population" },
    ]);
    const builtin = await readOrrerySystemMembersCore(exec, {
      kind: "builtin",
      id: "all-contacts",
    });
    const custom = await resolveCustomSystemMembers(
      exec,
      copy,
      NOW,
      async () => null,
    );
    expect(custom.memberIds).toEqual(
      builtin.members.map((member) => member.id),
    );
    expect(custom.memberIds).toEqual(
      expect.arrayContaining([contacted, neverContacted.lastInsertRowId]),
    );
  });

  it("preserves a duplicated All Contacts predicate and historical broken rows on an unchanged Builder save", async () => {
    const contacted = await addContact("Contacted");
    const neverContacted = await exec.runAsync(
      "INSERT INTO contacts (uid, name, interval_days, created_at, modified_at) VALUES (?, ?, ?, ?, ?)",
      [`contact-${++sequence}`, "Never contacted", 14, NOW, NOW],
    );
    const copy = await duplicateSystem(exec, {
      systemRef: "builtin:all-contacts",
      now: NOW,
    });
    const copyRef = `custom:${copy.uid}` as const;
    await exec.runAsync(
      "INSERT INTO system_rules (uid, system_id, family, value, created_at) VALUES (?, ?, ?, ?, ?)",
      ["historical-unknown", copy.id, "retired-family", "legacy", NOW],
    );
    await exec.runAsync(
      "INSERT INTO system_rules (uid, system_id, family, value, created_at) VALUES (?, ?, ?, ?, ?)",
      ["historical-invalid-boolean", copy.id, "favorite", "off", NOW],
    );
    const before = await resolveCustomSystemMembers(
      exec,
      copy,
      NOW,
      async () => null,
    );

    // An unchanged Builder draft contains none of the unrepresentable rows.
    // The DAO, rather than caller input, replays those exact stored values.
    await saveSystemDefinition(exec, {
      systemRef: copyRef,
      name: copy.name,
      rules: [],
      overrideIntent: [],
      prunableExclusionContactIds: [],
      now: NOW,
    });

    expect(
      (await listSystemRules(exec, copy.id)).map(({ family, value }) => ({
        family,
        value,
      })),
    ).toEqual([
      { family: "scope", value: "population" },
      { family: "retired-family", value: "legacy" },
      { family: "favorite", value: "off" },
    ]);
    expect(
      (await resolveCustomSystemMembers(exec, copy, NOW, async () => null))
        .memberIds,
    ).toEqual(before.memberIds);
    expect(before.memberIds).toEqual(
      expect.arrayContaining([contacted, neverContacted.lastInsertRowId]),
    );

    await expect(
      saveSystemDefinition(exec, {
        systemRef: copyRef,
        name: copy.name,
        rules: [{ family: "favorite", value: "off" }],
        overrideIntent: [],
        prunableExclusionContactIds: [],
        now: NOW,
      }),
    ).rejects.toThrow("invalid System rule");
    expect(
      (await listSystemRules(exec, copy.id)).map(({ family, value }) => ({
        family,
        value,
      })),
    ).toEqual([
      { family: "scope", value: "population" },
      { family: "retired-family", value: "legacy" },
      { family: "favorite", value: "off" },
    ]);
  });

  it("saves custom definitions atomically and immutable-base overrides without mutating base rows", async () => {
    const contactId = await addContact("Alex");
    const saved = await saveSystemDefinition(exec, {
      systemRef: null,
      name: "Atomic",
      rules: [{ family: "social-battery", value: "Charger" }],
      overrideIntent: [{ contactId, mode: "include" }],
      prunableExclusionContactIds: [],
      now: NOW,
    });
    expect(await listSystemRules(exec, saved.id)).toHaveLength(1);
    expect(
      await listSystemOverrides(exec, `custom:${saved.uid}`),
    ).toMatchObject([{ contactId, mode: "include" }]);
    await expect(
      saveSystemDefinition(exec, {
        systemRef: null,
        name: "Rollback Me",
        rules: [
          { family: "favorite", value: "on" },
          { family: "favorite", value: "on" },
        ],
        overrideIntent: [],
        prunableExclusionContactIds: [],
        now: NOW,
      }),
    ).rejects.toThrow();
    expect(
      (await listCustomSystems(exec)).map((system) => system.name),
    ).not.toContain("Rollback Me");

    const beforeSystems = await exec.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM systems",
    );
    await saveMembershipOverrides(exec, {
      systemRef: "builtin:favorites",
      overrideIntent: [{ contactId, mode: "include" }],
      prunableExclusionContactIds: [],
      now: NOW,
    });
    expect(await listSystemOverrides(exec, "builtin:favorites")).toMatchObject([
      { contactId, mode: "include" },
    ]);
    expect(
      await exec.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM systems",
      ),
    ).toEqual(beforeSystems);
  });

  it("maps each immutable predicate to the stored rule vocabulary", () => {
    expect(
      mapBuiltinPredicateToRules({ kind: "builtin", id: "favorites" }),
    ).toEqual([{ family: "favorite", value: "on" }]);
    expect(
      mapBuiltinPredicateToRules({ kind: "builtin", id: "all-contacts" }),
    ).toEqual([{ family: "scope", value: "population" }]);
  });

  it("rejects immutable rule writes and preserves rules when resetting membership overrides", async () => {
    const system = await createCustomSystem(exec, {
      name: "Rule Reset",
      now: NOW,
    });
    const ref = `custom:${system.uid}` as const;
    const contactId = await addContact("Alex");
    await setSystemRules(exec, {
      systemRef: ref,
      rules: [{ family: "favorite", value: "on" }],
      now: NOW,
    });
    await setSystemOverride(exec, {
      systemRef: ref,
      contactId,
      mode: "include",
      now: NOW,
    });
    await resetSystemOverrides(exec, { systemRef: ref });
    expect(await listSystemRules(exec, system.id)).toMatchObject([
      { family: "favorite", value: "on" },
    ]);
    await expect(
      setSystemRules(exec, {
        systemRef: "builtin:favorites",
        rules: [],
        now: NOW,
      }),
    ).rejects.toThrow("immutable");
  });

  it("rejects malformed System rule vocabulary before replacing durable rules", async () => {
    const system = await createCustomSystem(exec, {
      name: "Validated",
      now: NOW,
    });
    const ref = `custom:${system.uid}` as const;
    await setSystemRules(exec, {
      systemRef: ref,
      rules: [{ family: "favorite", value: "on" }],
      now: NOW,
    });

    await expect(
      setSystemRules(exec, {
        systemRef: ref,
        rules: [{ family: "unknown", value: "on" }],
        now: NOW,
      }),
    ).rejects.toThrow("invalid System rule");
    await expect(
      setSystemRules(exec, {
        systemRef: ref,
        rules: [{ family: "social-battery", value: "Bogus" }],
        now: NOW,
      }),
    ).rejects.toThrow("invalid System rule");
    await expect(
      setSystemRules(exec, {
        systemRef: ref,
        rules: [{ family: "category", value: "bad uid" }],
        now: NOW,
      }),
    ).rejects.toThrow("invalid System rule");

    expect(await listSystemRules(exec, system.id)).toMatchObject([
      { family: "favorite", value: "on" },
    ]);
    await expect(
      saveSystemDefinition(exec, {
        systemRef: null,
        name: "Never persisted",
        rules: [{ family: "not-contacted", value: "off" }],
        overrideIntent: [],
        prunableExclusionContactIds: [],
        now: NOW,
      }),
    ).rejects.toThrow("invalid System rule");
    expect(
      (await listCustomSystems(exec)).map(({ name }) => name),
    ).not.toContain("Never persisted");

    // Direct SQL represents pre-validation historical storage only. New
    // duplicate writes still go through the closed draft vocabulary.
    await exec.runAsync(
      "INSERT INTO system_rules (uid, system_id, family, value, created_at) VALUES (?, ?, ?, ?, ?)",
      ["historical-invalid-copy", system.id, "gravity", "not-a-tier", NOW],
    );
    await expect(
      duplicateSystem(exec, { systemRef: ref, now: NOW }),
    ).rejects.toThrow("invalid System rule");
    expect(
      (await listCustomSystems(exec)).map(({ name }) => name),
    ).not.toContain("Validated Copy");
  });

  it("persists only valid built-in or Category visibility preferences", async () => {
    const categoryRef = `category:${await firstCategoryUid()}` as const;
    const custom = await createCustomSystem(exec, {
      name: "No Hide",
      now: NOW,
    });
    await setSystemHidden(exec, {
      systemRef: categoryRef,
      hidden: true,
      now: NOW,
    });
    expect(await listSystemPrefs(exec)).toMatchObject([
      { systemRef: categoryRef, hidden: 1 },
    ]);
    await expect(
      setSystemHidden(exec, {
        systemRef: "builtin:all-contacts",
        hidden: true,
        now: NOW,
      }),
    ).rejects.toThrow("All Contacts");
    await expect(
      setSystemHidden(exec, {
        systemRef: `custom:${custom.uid}`,
        hidden: true,
        now: NOW,
      }),
    ).rejects.toThrow("deleted, not hidden");
    await expect(
      setSystemHidden(exec, {
        systemRef: "custom:missing",
        hidden: true,
        now: NOW,
      }),
    ).rejects.toThrow("unknown System");
  });

  it("reorders a validated catalog while keeping All Contacts at order zero", async () => {
    const categoryRef = `category:${await firstCategoryUid()}` as const;
    const custom = await createCustomSystem(exec, {
      name: "Ordered",
      now: NOW,
    });
    const customRef = `custom:${custom.uid}` as const;
    await reorderSystems(exec, {
      orderedRefs: [categoryRef, customRef, "builtin:favorites"],
      now: NOW,
    });
    const prefs = await listSystemPrefs(exec);
    expect(prefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          systemRef: "builtin:all-contacts",
          displayOrder: 0,
        }),
        expect.objectContaining({ systemRef: categoryRef, displayOrder: 1 }),
        expect.objectContaining({ systemRef: customRef, displayOrder: 2 }),
        expect.objectContaining({
          systemRef: "builtin:favorites",
          displayOrder: 3,
        }),
      ]),
    );
    await expect(
      reorderSystems(exec, { orderedRefs: [customRef, customRef], now: NOW }),
    ).rejects.toThrow("duplicate");
    await expect(
      reorderSystems(exec, { orderedRefs: ["custom:missing"], now: NOW }),
    ).rejects.toThrow("unknown System");
  });
});
