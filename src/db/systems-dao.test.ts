import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  addSystemOverride,
  createCustomSystem,
  getSystem,
  listCustomSystems,
  listSystemOverrides,
  listSystemPrefs,
  listSystemRules,
} from "@/db/systems-dao";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-08 12:00:00";
let exec: SqlExecutor;
let sequence = 0;

beforeEach(async () => {
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: () => `migration-${++sequence}`,
  });
});

describe("systems DAO", () => {
  it("creates and reads a custom System plus its manual override", async () => {
    const system = await createCustomSystem(exec, { name: "Close Friends", now: NOW });
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
    expect(await listSystemOverrides(exec, `custom:${system.uid}`)).toMatchObject([
      { contactId: contact.lastInsertRowId, mode: "include" },
    ]);
  });

  it("rejects case-insensitive custom, built-in, and Category name collisions", async () => {
    await createCustomSystem(exec, { name: "Close Friends", now: NOW });
    await expect(createCustomSystem(exec, { name: "close friends", now: NOW })).rejects.toThrow(
      "A System named close friends already exists",
    );
    await expect(createCustomSystem(exec, { name: "all contacts", now: NOW })).rejects.toThrow(
      "A System named all contacts already exists",
    );
    await expect(createCustomSystem(exec, { name: "FAVORITES", now: NOW })).rejects.toThrow(
      "A System named FAVORITES already exists",
    );
    await expect(createCustomSystem(exec, { name: "family", now: NOW })).rejects.toThrow(
      "A System named family already exists",
    );
  });
});
