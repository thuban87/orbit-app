/**
 * Launch-time field sweep — behavioural proof (FLD-05).
 *
 * Drives a fresh in-memory node:sqlite DB through the REAL migration-1 fixture,
 * the REAL field-ddl expiry core, and the REAL launch-sweep registry with an
 * injected clock. Asserts: quarantine expiry past the 30-day window with a
 * snapshot to field_history + history retention pruning; the strict-`<` 30/31-day
 * boundary; the sweep-TOCTOU guard (a field restored after the candidate scan
 * survives); NO-HANG / registry not wedged (HIGH-1); and per-def failure
 * isolation (one failed drop neither aborts the loop nor skips the prune).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { createField } from "@/db/field-ddl";
import { restoreField } from "@/db/field-defs-dao";
import type { NewFieldDef } from "@/db/field-types";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import { registerFieldSweep } from "@/services/field-sweep";
import {
  __resetSweepForTest,
  registerSweepHook,
  runLaunchSweep,
} from "@/services/launch-sweep";

const NOW = "2026-08-14 12:00:00";
const clock = () => NOW;

let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;

let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  __resetSweepForTest();
  const db = openTestDb();
  exec = nodeSqliteExecutor(db);
  await runMigrations(exec, [migration001], 1, { now: NOW, newUid: uid });
});

afterEach(() => {
  __resetSweepForTest();
});

// --- helpers ----------------------------------------------------------------

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

async function valueColumns(): Promise<string[]> {
  const rows = await exec.getAllAsync<{ name: string }>(
    "PRAGMA table_info(contact_custom_values)",
  );
  return rows.map((r) => r.name);
}

async function defCount(colName: string): Promise<number> {
  const row = await exec.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM custom_field_defs WHERE col_name = ?",
    [colName],
  );
  return row?.n ?? 0;
}

async function defId(colName: string): Promise<number> {
  const row = await exec.getFirstAsync<{ id: number }>(
    "SELECT id FROM custom_field_defs WHERE col_name = ?",
    [colName],
  );
  if (!row) throw new Error(`no def for ${colName}`);
  return row.id;
}

async function seedContact(name: string): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [uid(), name, 30, NOW, NOW],
  );
  const contactId = result.lastInsertRowId;
  await exec.runAsync(
    "INSERT INTO contact_custom_values (contact_id, uid, modified_at) VALUES (?, ?, ?)",
    [contactId, uid(), NOW],
  );
  return contactId;
}

/** Create a field, then stamp its quarantined_at to `-{days} days` ago (SQLite clock). */
async function quarantineDaysAgo(colName: string, days: number): Promise<void> {
  await createField(exec, newDef({ col_name: colName, label: colName }));
  await exec.runAsync(
    `UPDATE custom_field_defs
        SET quarantined_at = datetime('now','localtime',?)
      WHERE col_name = ?`,
    [`-${days} days`, colName],
  );
}

/** Insert a field_history row created `-{days} days` ago (SQLite clock). */
async function historyDaysAgo(
  colName: string,
  contactId: number,
  value: string,
  days: number,
): Promise<void> {
  await exec.runAsync(
    `INSERT INTO field_history
       (contact_id, field_col_name, old_value, operation, created_at)
     VALUES (?, ?, ?, 'edit', datetime('now','localtime',?))`,
    [contactId, colName, value, `-${days} days`],
  );
}

async function historyCount(
  colName: string,
  operation?: string,
): Promise<number> {
  const sql = operation
    ? "SELECT COUNT(*) AS n FROM field_history WHERE field_col_name = ? AND operation = ?"
    : "SELECT COUNT(*) AS n FROM field_history WHERE field_col_name = ?";
  const params = operation ? [colName, operation] : [colName];
  const row = await exec.getFirstAsync<{ n: number }>(sql, params);
  return row?.n ?? 0;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout: ${label}`)), ms),
    ),
  ]);
}

// --- EXPIRY + RETENTION -----------------------------------------------------

describe("field sweep — expiry + history retention (FLD-05)", () => {
  it("expires a >30d field (snapshotting values), retains a <30d field, and prunes old history; a second run is a no-op", async () => {
    // 40-day quarantined field, populated for two contacts.
    await quarantineDaysAgo("nickname", 40);
    const a = await seedContact("Alex");
    const b = await seedContact("Bo");
    await exec.runAsync(
      'UPDATE contact_custom_values SET "nickname" = ? WHERE contact_id = ?',
      ["Al", a],
    );
    await exec.runAsync(
      'UPDATE contact_custom_values SET "nickname" = ? WHERE contact_id = ?',
      ["Bee", b],
    );

    // 5-day quarantined field — inside the window, must be untouched.
    await quarantineDaysAgo("city", 5);

    // field_history: one row older than the window, one recent — for a
    // DIFFERENT col so the expiry snapshot below doesn't confound the prune.
    await historyDaysAgo("legacy", a, "old", 40);
    await historyDaysAgo("legacy", a, "fresh", 5);

    registerFieldSweep(() => exec, clock);
    await withTimeout(runLaunchSweep(), 2000, "first sweep");

    // 40-day field dropped, values snapshotted under 'quarantine_expiry'.
    expect(await defCount("nickname")).toBe(0);
    expect(await valueColumns()).not.toContain("nickname");
    const snaps = await exec.getAllAsync<{
      contact_id: number;
      old_value: string;
    }>(
      "SELECT contact_id, old_value FROM field_history WHERE field_col_name = ? AND operation = 'quarantine_expiry' ORDER BY contact_id",
      ["nickname"],
    );
    expect(snaps).toEqual([
      { contact_id: a, old_value: "Al" },
      { contact_id: b, old_value: "Bee" },
    ]);

    // 5-day field untouched.
    expect(await defCount("city")).toBe(1);
    expect(await valueColumns()).toContain("city");

    // Old legacy history pruned, recent one survives.
    expect(await historyCount("legacy")).toBe(1);
    const remaining = await exec.getFirstAsync<{ old_value: string }>(
      "SELECT old_value FROM field_history WHERE field_col_name = ?",
      ["legacy"],
    );
    expect(remaining?.old_value).toBe("fresh");

    // A second run finds no still-stale defs — idempotent no-op.
    await withTimeout(runLaunchSweep(), 2000, "second sweep");
    expect(await defCount("city")).toBe(1);
    expect(await historyCount("nickname", "quarantine_expiry")).toBe(2);
  });
});

// --- BOUNDARY (strict `<`) --------------------------------------------------

describe("field sweep — 30/31-day boundary (strict `<`)", () => {
  it("expires a field quarantined EXACTLY 31 days ago", async () => {
    await quarantineDaysAgo("nickname", 31);

    registerFieldSweep(() => exec, clock);
    await withTimeout(runLaunchSweep(), 2000, "31-day sweep");

    expect(await defCount("nickname")).toBe(0);
    expect(await valueColumns()).not.toContain("nickname");
  });

  it("does NOT expire a field quarantined EXACTLY 30 days ago (strict `<`, not `<=`)", async () => {
    await quarantineDaysAgo("nickname", 30);

    registerFieldSweep(() => exec, clock);
    await withTimeout(runLaunchSweep(), 2000, "30-day sweep");

    expect(await defCount("nickname")).toBe(1);
    expect(await valueColumns()).toContain("nickname");
  });
});

// --- SWEEP-TOCTOU (restore after scan survives) -----------------------------

describe("field sweep — restore-after-scan survives (cycle-2 sweep-TOCTOU)", () => {
  it("does not drop a field restored between the candidate scan and its drop", async () => {
    await quarantineDaysAgo("nickname", 40);
    const targetId = await defId("nickname");

    // Proxy exec: the candidate SELECT, once it has returned a still-stale def,
    // restores that def BEFORE the per-def expireFieldIfStale runs — the exact
    // scan→drop interleave. expireFieldIfStale re-reads quarantined_at under the
    // lock (now NULL) and MUST leave the field intact.
    const proxy: SqlExecutor = {
      execAsync: (sql) => exec.execAsync(sql),
      runAsync: (sql, params) => exec.runAsync(sql, params),
      getFirstAsync: <T>(sql: string, params?: unknown[]) =>
        exec.getFirstAsync<T>(sql, params),
      async getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]> {
        const rows = await exec.getAllAsync<T>(sql, params);
        if (/FROM custom_field_defs/.test(sql) && /quarantined_at/.test(sql)) {
          // The restore lands after the scan, ordered before the under-lock
          // re-check (both serialize through the shared mutex).
          await restoreField(exec, targetId, NOW);
        }
        return rows;
      },
    };

    registerFieldSweep(() => proxy, clock);
    await withTimeout(runLaunchSweep(), 2000, "toctou sweep");

    // The field SURVIVES and holds NO expiry snapshot — the re-read-under-lock,
    // not the stale scan result, decided the (non-)drop.
    expect(await defCount("nickname")).toBe(1);
    expect(await valueColumns()).toContain("nickname");
    expect(await historyCount("nickname", "quarantine_expiry")).toBe(0);
    const row = await exec.getFirstAsync<{ quarantined_at: string | null }>(
      "SELECT quarantined_at FROM custom_field_defs WHERE id = ?",
      [targetId],
    );
    expect(row?.quarantined_at).toBeNull();
  });
});

// --- NO-HANG / registry not wedged (HIGH-1) ---------------------------------

describe("field sweep — no-hang, registry not wedged (HIGH-1)", () => {
  it("resolves within a short timeout and leaves the registry usable for a second launch", async () => {
    await quarantineDaysAgo("nickname", 40);

    // A probe hook alongside the sweep proves the registry runs hooks again on a
    // second launch (running reset to false — no permanent deadlock).
    let probeRuns = 0;
    registerFieldSweep(() => exec, clock);
    registerSweepHook(async () => {
      probeRuns += 1;
    });

    await withTimeout(runLaunchSweep(), 2000, "first launch");
    expect(await defCount("nickname")).toBe(0);
    expect(probeRuns).toBe(1);

    // Second launch still executes hooks — registry not wedged by a hung sweep.
    await withTimeout(runLaunchSweep(), 2000, "second launch");
    expect(probeRuns).toBe(2);
  });
});

// --- PER-DEF ISOLATION ------------------------------------------------------

describe("field sweep — per-def failure isolation", () => {
  it("continues past a failed drop and still prunes history", async () => {
    // Two stale defs; 'alpha' has the lower id so it is scanned FIRST.
    await quarantineDaysAgo("alpha", 40);
    await quarantineDaysAgo("beta", 40);

    // Old history that the prune must still remove even though alpha's drop fails.
    const a = await seedContact("Alex");
    await historyDaysAgo("legacy", a, "old", 40);

    // Proxy that rejects only on alpha's DROP COLUMN (ROLLBACK/BEGIN/COMMIT and
    // every other statement pass through).
    const failing: SqlExecutor = {
      execAsync: (sql) => {
        if (/DROP COLUMN "alpha"/.test(sql)) {
          return Promise.reject(new Error("forced drop failure"));
        }
        return exec.execAsync(sql);
      },
      runAsync: (sql, params) => exec.runAsync(sql, params),
      getFirstAsync: <T>(sql: string, params?: unknown[]) =>
        exec.getFirstAsync<T>(sql, params),
      getAllAsync: <T>(sql: string, params?: unknown[]) =>
        exec.getAllAsync<T>(sql, params),
    };

    registerFieldSweep(() => failing, clock);
    await withTimeout(runLaunchSweep(), 2000, "isolation sweep");

    // alpha's drop rolled back → it survives; beta was still dropped.
    expect(await defCount("alpha")).toBe(1);
    expect(await valueColumns()).toContain("alpha");
    expect(await defCount("beta")).toBe(0);
    expect(await valueColumns()).not.toContain("beta");

    // The history prune still ran despite the failed drop.
    expect(await historyCount("legacy")).toBe(0);
  });
});
