import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { createField } from "@/db/field-ddl";
import { restoreField } from "@/db/field-defs-dao";
import type { NewFieldDef } from "@/db/field-types";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { migration006 } from "@/db/migrations/006-normalize-custom-field-values";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import { registerFieldSweep } from "@/services/field-sweep";
import {
  __resetSweepForTest,
  registerSweepHook,
  runLaunchSweep,
} from "@/services/launch-sweep";

const NOW = "2026-08-24 12:00:00";
const clock = () => NOW;
let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;
let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  __resetSweepForTest();
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(
    exec,
    [
      migration001,
      migration002,
      migration003,
      migration004,
      migration005,
      migration006,
    ],
    6,
    { now: NOW, newUid: uid },
  );
});

afterEach(() => __resetSweepForTest());

function newDef(overrides: Partial<NewFieldDef> = {}): NewFieldDef {
  return {
    uid: uid(),
    col_name: "nickname",
    label: "Nickname",
    type: "text",
    options: null,
    show_on_new: 0,
    always_show: 0,
    display_order: 0,
    share_with_ai: 0,
    now: NOW,
    ...overrides,
  };
}

async function seedContact(name: string): Promise<number> {
  const result = await exec.runAsync(
    "INSERT INTO contacts (uid, name, interval_days, created_at, modified_at) VALUES (?, ?, ?, ?, ?)",
    [uid(), name, 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function defId(colName: string): Promise<number> {
  const row = await exec.getFirstAsync<{ id: number }>(
    "SELECT id FROM custom_field_defs WHERE col_name = ?",
    [colName],
  );
  if (!row) throw new Error(`no def for ${colName}`);
  return row.id;
}

async function defCount(colName: string): Promise<number> {
  const row = await exec.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM custom_field_defs WHERE col_name = ?",
    [colName],
  );
  return row?.n ?? 0;
}

async function quarantineDaysAgo(
  colName: string,
  days: number,
): Promise<number> {
  await createField(exec, newDef({ col_name: colName, label: colName }));
  const id = await defId(colName);
  await exec.runAsync(
    "UPDATE custom_field_defs SET quarantined_at = datetime('now', 'localtime', ?) WHERE id = ?",
    [`-${days} days`, id],
  );
  return id;
}

async function historyDaysAgo(
  colName: string,
  contactId: number,
  value: string,
  days: number,
): Promise<void> {
  await exec.runAsync(
    "INSERT INTO field_history (contact_id, field_col_name, old_value, operation, created_at) VALUES (?, ?, ?, 'edit', datetime('now', 'localtime', ?))",
    [contactId, colName, value, `-${days} days`],
  );
}

async function historyCount(
  colName: string,
  operation?: string,
): Promise<number> {
  const row = await exec.getFirstAsync<{ n: number }>(
    operation
      ? "SELECT COUNT(*) AS n FROM field_history WHERE field_col_name = ? AND operation = ?"
      : "SELECT COUNT(*) AS n FROM field_history WHERE field_col_name = ?",
    operation ? [colName, operation] : [colName],
  );
  return row?.n ?? 0;
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout: ${label}`)), 2000),
    ),
  ]);
}

describe("field sweep — normalized expiry and history retention", () => {
  it("expires a stale definition with snapshots, retains a recent one, and prunes old history", async () => {
    const alex = await seedContact("Alex");
    const bo = await seedContact("Bo");
    const nicknameId = await quarantineDaysAgo("nickname", 40);
    await exec.runAsync(
      "UPDATE custom_field_values SET value = ? WHERE contact_id = ? AND field_def_id = ?",
      ["Al", alex, nicknameId],
    );
    await exec.runAsync(
      "UPDATE custom_field_values SET value = ? WHERE contact_id = ? AND field_def_id = ?",
      ["Bee", bo, nicknameId],
    );
    await quarantineDaysAgo("city", 5);
    await historyDaysAgo("legacy", alex, "old", 40);
    await historyDaysAgo("legacy", alex, "fresh", 5);

    registerFieldSweep(() => exec, clock);
    await withTimeout(runLaunchSweep(), "first sweep");

    expect(await defCount("nickname")).toBe(0);
    expect(
      await exec.getAllAsync(
        "SELECT contact_id, old_value FROM field_history WHERE field_col_name = ? AND operation = 'quarantine_expiry' ORDER BY contact_id",
        ["nickname"],
      ),
    ).toEqual([
      { contact_id: alex, old_value: "Al" },
      { contact_id: bo, old_value: "Bee" },
    ]);
    expect(await defCount("city")).toBe(1);
    expect(await historyCount("legacy")).toBe(1);
    expect(await historyCount("nickname", "quarantine_expiry")).toBe(2);
  });

  it("keeps the strict older-than-thirty-days boundary", async () => {
    await quarantineDaysAgo("old", 31);
    await quarantineDaysAgo("boundary", 30);
    registerFieldSweep(() => exec, clock);
    await withTimeout(runLaunchSweep(), "boundary sweep");
    expect(await defCount("old")).toBe(0);
    expect(await defCount("boundary")).toBe(1);
  });

  it("does not expire a definition restored after candidate discovery", async () => {
    const targetId = await quarantineDaysAgo("nickname", 40);
    const proxy: SqlExecutor = {
      execAsync: (sql) => exec.execAsync(sql),
      runAsync: (sql, params) => exec.runAsync(sql, params),
      getFirstAsync: <T>(sql: string, params?: unknown[]) =>
        exec.getFirstAsync<T>(sql, params),
      async getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]> {
        const rows = await exec.getAllAsync<T>(sql, params);
        if (/FROM custom_field_defs/.test(sql) && /quarantined_at/.test(sql))
          await restoreField(exec, targetId, NOW);
        return rows;
      },
    };
    registerFieldSweep(() => proxy, clock);
    await withTimeout(runLaunchSweep(), "restore race sweep");
    expect(await defCount("nickname")).toBe(1);
    expect(await historyCount("nickname", "quarantine_expiry")).toBe(0);
  });

  it("does not wedge the launch registry and isolates one failed deletion", async () => {
    const alphaId = await quarantineDaysAgo("alpha", 40);
    await quarantineDaysAgo("beta", 40);
    const contactId = await seedContact("Alex");
    await historyDaysAgo("legacy", contactId, "old", 40);
    let probes = 0;
    const failing: SqlExecutor = {
      execAsync: (sql) => exec.execAsync(sql),
      runAsync: (sql, params) => {
        if (
          /DELETE FROM custom_field_values/.test(sql) &&
          params?.[0] === alphaId
        )
          return Promise.reject(new Error("forced deletion failure"));
        return exec.runAsync(sql, params);
      },
      getFirstAsync: <T>(sql: string, params?: unknown[]) =>
        exec.getFirstAsync<T>(sql, params),
      getAllAsync: <T>(sql: string, params?: unknown[]) =>
        exec.getAllAsync<T>(sql, params),
    };
    registerFieldSweep(() => failing, clock);
    registerSweepHook(async () => {
      probes += 1;
    });
    await withTimeout(runLaunchSweep(), "failure isolation sweep");
    await withTimeout(runLaunchSweep(), "second launch");
    expect(await defCount("alpha")).toBe(1);
    expect(await defCount("beta")).toBe(0);
    expect(await historyCount("legacy")).toBe(0);
    expect(probes).toBe(2);
  });
});
