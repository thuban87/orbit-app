import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";

const NOW = "2026-09-08 12:00:00";
let exec: SqlExecutor;

beforeEach(() => {
  exec = nodeSqliteExecutor(openTestDb());
});

async function migrateTo(version: number): Promise<void> {
  await runMigrations(exec, MIGRATIONS, version, { now: NOW, newUid });
}

describe("migration 022 — Orrery Systems", () => {
  it("reaches v22 from a fresh database and from a v21 database", async () => {
    await migrateTo(22);
    expect(
      await exec.getFirstAsync<{ user_version: number }>("PRAGMA user_version"),
    ).toEqual({
      user_version: 22,
    });

    exec = nodeSqliteExecutor(openTestDb());
    await migrateTo(21);
    await migrateTo(22);
    const tables = await exec.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    expect(tables.map((table) => table.name)).toEqual(
      expect.arrayContaining([
        "systems",
        "system_rules",
        "system_overrides",
        "system_prefs",
      ]),
    );
  });

  it("enforces the Systems schema integrity constraints", async () => {
    await migrateTo(22);
    await exec.runAsync(
      "INSERT INTO systems (uid, name, created_at, modified_at) VALUES (?, ?, ?, ?)",
      ["system-1", "Friends", NOW, NOW],
    );
    const system = await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM systems WHERE uid = ?",
      ["system-1"],
    );
    expect(system).not.toBeNull();

    expect(() =>
      exec.runAsync(
        "INSERT INTO systems (uid, name, created_at, modified_at) VALUES (?, ?, ?, ?)",
        ["system-1", "Other", NOW, NOW],
      ),
    ).toThrow();
    expect(() =>
      exec.runAsync(
        "INSERT INTO systems (uid, name, created_at, modified_at) VALUES (?, ?, ?, ?)",
        ["system-2", "friends", NOW, NOW],
      ),
    ).toThrow();

    await exec.runAsync(
      "INSERT INTO system_rules (uid, system_id, family, value, created_at) VALUES (?, ?, ?, ?, ?)",
      ["rule-1", system!.id, "category", "family", NOW],
    );
    expect(() =>
      exec.runAsync(
        "INSERT INTO system_rules (uid, system_id, family, value, created_at) VALUES (?, ?, ?, ?, ?)",
        ["rule-2", system!.id, "category", "family", NOW],
      ),
    ).toThrow();
    expect(() =>
      exec.runAsync(
        "INSERT INTO system_rules (uid, system_id, family, value, created_at) VALUES (?, ?, ?, ?, ?)",
        ["rule-1", system!.id, "frequency", "weekly", NOW],
      ),
    ).toThrow();

    await exec.runAsync(
      "INSERT INTO contacts (uid, name, interval_days, created_at, modified_at) VALUES (?, ?, ?, ?, ?)",
      ["contact-1", "Alex", 14, NOW, NOW],
    );
    const contact = await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM contacts WHERE uid = ?",
      ["contact-1"],
    );
    expect(contact).not.toBeNull();
    await exec.runAsync(
      "INSERT INTO system_overrides (uid, system_ref, contact_id, mode, created_at) VALUES (?, ?, ?, ?, ?)",
      ["override-1", "custom:system-1", contact!.id, "include", NOW],
    );
    expect(() =>
      exec.runAsync(
        "INSERT INTO system_overrides (uid, system_ref, contact_id, mode, created_at) VALUES (?, ?, ?, ?, ?)",
        ["override-2", "custom:system-1", contact!.id, "exclude", NOW],
      ),
    ).toThrow();
    expect(() =>
      exec.runAsync(
        "INSERT INTO system_overrides (uid, system_ref, contact_id, mode, created_at) VALUES (?, ?, ?, ?, ?)",
        ["override-1", "custom:other", contact!.id, "include", NOW],
      ),
    ).toThrow();
    await exec.runAsync(
      "INSERT INTO contacts (uid, name, interval_days, created_at, modified_at) VALUES (?, ?, ?, ?, ?)",
      ["contact-2", "Blair", 14, NOW, NOW],
    );
    const contactTwo = await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM contacts WHERE uid = ?",
      ["contact-2"],
    );
    expect(contactTwo).not.toBeNull();
    expect(() =>
      exec.runAsync(
        "INSERT INTO system_overrides (uid, system_ref, contact_id, mode, created_at) VALUES (?, ?, ?, ?, ?)",
        ["override-1", "custom:other", contactTwo!.id, "include", NOW],
      ),
    ).toThrow();
    await exec.runAsync(
      "INSERT INTO system_prefs (uid, system_ref, created_at, modified_at) VALUES (?, ?, ?, ?)",
      ["pref-1", "custom:system-1", NOW, NOW],
    );
    expect(() =>
      exec.runAsync(
        "INSERT INTO system_prefs (uid, system_ref, created_at, modified_at) VALUES (?, ?, ?, ?)",
        ["pref-1", "custom:other", NOW, NOW],
      ),
    ).toThrow();
    expect(() =>
      exec.runAsync(
        "INSERT INTO system_prefs (uid, system_ref, created_at, modified_at) VALUES (?, ?, ?, ?)",
        ["pref-2", "custom:system-1", NOW, NOW],
      ),
    ).toThrow();

    await exec.runAsync("DELETE FROM contacts WHERE id = ?", [contact!.id]);
    expect(
      await exec.getFirstAsync(
        "SELECT id FROM system_overrides WHERE uid = ?",
        ["override-1"],
      ),
    ).toBeNull();
    await exec.runAsync("DELETE FROM systems WHERE id = ?", [system!.id]);
    expect(
      await exec.getFirstAsync("SELECT id FROM system_rules WHERE uid = ?", [
        "rule-1",
      ]),
    ).toBeNull();
  });
});
