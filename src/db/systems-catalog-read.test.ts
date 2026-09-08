import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import {
  countBuiltinAndCategorySystemMembers,
  countSystemMembers,
  readSystemsCatalog,
} from "@/db/systems-catalog-read";
import {
  createCustomSystem,
  setSystemHidden,
  setSystemOverride,
  setSystemRules,
} from "@/db/systems-dao";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-08 12:00:00";
let exec: SqlExecutor;
let sequence = 0;

async function addContact(name: string): Promise<number> {
  const result = await exec.runAsync(
    "INSERT INTO contacts (uid, name, interval_days, last_contact, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?)",
    [`catalog-contact-${++sequence}`, name, 14, "2026-09-01", NOW, NOW],
  );
  return result.lastInsertRowId;
}

beforeEach(async () => {
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: () => `catalog-${++sequence}`,
  });
});

describe("Systems catalog read", () => {
  it("returns custom Systems with persisted visibility/order and override presence without resolving members", async () => {
    const custom = await createCustomSystem(exec, {
      name: "Close Friends",
      now: NOW,
    });
    const contactId = await addContact("Alex");
    await setSystemHidden(exec, {
      systemRef: "builtin:favorites",
      hidden: true,
      now: NOW,
    });
    await exec.runAsync(
      "UPDATE system_prefs SET display_order = 7 WHERE system_ref = ?",
      ["builtin:favorites"],
    );
    await setSystemOverride(exec, {
      systemRef: `custom:${custom.uid}`,
      contactId,
      mode: "include",
      now: NOW,
    });

    const catalog = await readSystemsCatalog(exec);
    expect(catalog.find((row) => row.id === "builtin:favorites")).toMatchObject(
      {
        hidden: true,
        displayOrder: 7,
      },
    );
    expect(
      catalog.find((row) => row.id === `custom:${custom.uid}`),
    ).toMatchObject({
      name: "Close Friends",
      hasOverrides: true,
      createdAt: custom.createdAt,
    });
  });

  it("counts builtin/category refs in one bound batch and always resolves a custom ref", async () => {
    const contactId = await addContact("Alex");
    const custom = await createCustomSystem(exec, { name: "Manual", now: NOW });
    await setSystemOverride(exec, {
      systemRef: `custom:${custom.uid}`,
      contactId,
      mode: "include",
      now: NOW,
    });
    await setSystemRules(exec, {
      systemRef: `custom:${custom.uid}`,
      rules: [{ family: "gravity", value: "not-a-tier" }],
      now: NOW,
    });

    const batch = await countBuiltinAndCategorySystemMembers(exec, [
      { kind: "builtin", id: "all-contacts" },
      { kind: "builtin", id: "favorites" },
    ]);
    expect(batch.get("builtin:all-contacts")).toBe(1);
    expect(batch.get("builtin:favorites")).toBe(0);

    await expect(
      countSystemMembers(exec, { kind: "custom", uid: custom.uid }),
    ).resolves.toMatchObject({
      count: 1,
      brokenRules: [{ family: "gravity" }],
    });
  });
});
