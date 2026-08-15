/**
 * Transactional custom-field DDL — behavioural proof (FLD-02 / FLD-05 / FLD-06).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture
 * and the REAL DDL, asserting: atomic create (INSERT def + ADD COLUMN, rolled
 * back together when ADD COLUMN is the failing statement); snapshot-before-drop
 * (field_history holds old values before DELETE def + DROP COLUMN);
 * populated-field DROP SUCCEEDS (the no-index/UNIQUE invariant, FLD-06); the
 * dynamic delete/quarantine action; that deleteOrQuarantineField's check+drop
 * share ONE transaction (single-BEGIN); and expireFieldIfStale's under-the-lock
 * re-verification (a restored-since-scan field survives).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  createField,
  deleteOrQuarantineField,
  dropField,
  expireFieldIfStale,
} from "@/db/field-ddl";
import type { NewFieldDef } from "@/db/field-types";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-14 12:00:00";

let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;

let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  const db = openTestDb();
  exec = nodeSqliteExecutor(db);
  await runMigrations(exec, [migration001], 1, { now: NOW, newUid: uid });
});

/** A minimal valid create payload with a caller-supplied col_name. */
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

/** Live column names of contact_custom_values via PRAGMA table_info. */
async function valueColumns(): Promise<string[]> {
  const rows = await exec.getAllAsync<{ name: string }>(
    "PRAGMA table_info(contact_custom_values)",
  );
  return rows.map((r) => r.name);
}

/** Count of def rows carrying a given col_name. */
async function defCount(colName: string): Promise<number> {
  const row = await exec.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM custom_field_defs WHERE col_name = ?",
    [colName],
  );
  return row?.n ?? 0;
}

/** Insert a contact_custom_values row for a contact (needs a real contact). */
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

describe("createField — atomic INSERT def + ADD COLUMN (FLD-02)", () => {
  it("creates the def row and the physical value column together", async () => {
    await createField(exec, newDef({ col_name: "nickname" }));

    expect(await defCount("nickname")).toBe(1);
    expect(await valueColumns()).toContain("nickname");
  });

  it("rolls BOTH back when ADD COLUMN is the failing statement (T-03-03)", async () => {
    // Pre-seed an UNMANAGED physical column (no def row) so the def INSERT
    // succeeds but the ADD COLUMN throws `duplicate column name`, forcing ADD
    // COLUMN to be the failing statement (a duplicate col_name would instead
    // fail at the UNIQUE def INSERT and never reach ADD COLUMN).
    await exec.execAsync(
      'ALTER TABLE contact_custom_values ADD COLUMN "orphan_x" TEXT',
    );

    await expect(
      createField(exec, newDef({ col_name: "orphan_x", label: "Orphan" })),
    ).rejects.toThrow();

    // The def INSERT was rolled back — no def row survives.
    expect(await defCount("orphan_x")).toBe(0);
  });
});

describe("dropField — snapshot-before-drop (FLD-05 / FLD-06)", () => {
  it("snapshots every value to field_history, then removes def + column", async () => {
    await createField(exec, newDef({ col_name: "nickname" }));
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

    const def = { id: await defId("nickname"), col_name: "nickname" };
    await dropField(exec, def, "delete", NOW);

    const history = await exec.getAllAsync<{
      contact_id: number;
      old_value: string;
      operation: string;
    }>(
      "SELECT contact_id, old_value, operation FROM field_history WHERE field_col_name = ? ORDER BY contact_id",
      ["nickname"],
    );
    expect(history).toEqual([
      { contact_id: a, old_value: "Al", operation: "delete" },
      { contact_id: b, old_value: "Bee", operation: "delete" },
    ]);
    expect(await defCount("nickname")).toBe(0);
    expect(await valueColumns()).not.toContain("nickname");
  });

  it("SUCCEEDS on a populated field — proves no index/UNIQUE on the value column (FLD-06)", async () => {
    await createField(exec, newDef({ col_name: "nickname" }));
    const a = await seedContact("Alex");
    await exec.runAsync(
      'UPDATE contact_custom_values SET "nickname" = ? WHERE contact_id = ?',
      ["Al", a],
    );

    const def = { id: await defId("nickname"), col_name: "nickname" };
    // Would throw `error in index ... after drop column` if an index existed.
    await expect(dropField(exec, def, "delete", NOW)).resolves.toBeUndefined();
    expect(await valueColumns()).not.toContain("nickname");
  });
});

describe("deleteOrQuarantineField — dynamic action (FLD-05)", () => {
  it("returns 'deleted' and drops an empty field", async () => {
    await createField(exec, newDef({ col_name: "nickname" }));
    await seedContact("Alex"); // row exists but value is null

    const def = { id: await defId("nickname"), col_name: "nickname" };
    expect(await deleteOrQuarantineField(exec, def, NOW)).toBe("deleted");
    expect(await defCount("nickname")).toBe(0);
    expect(await valueColumns()).not.toContain("nickname");
  });

  it("returns 'quarantined' and leaves data + column intact for a populated field", async () => {
    await createField(exec, newDef({ col_name: "nickname" }));
    const a = await seedContact("Alex");
    await exec.runAsync(
      'UPDATE contact_custom_values SET "nickname" = ? WHERE contact_id = ?',
      ["Al", a],
    );

    const def = { id: await defId("nickname"), col_name: "nickname" };
    expect(await deleteOrQuarantineField(exec, def, NOW)).toBe("quarantined");

    expect(await defCount("nickname")).toBe(1);
    expect(await valueColumns()).toContain("nickname");
    const row = await exec.getFirstAsync<{
      quarantined_at: string | null;
      nickname: string | null;
    }>(
      'SELECT d.quarantined_at, v."nickname" FROM custom_field_defs d, contact_custom_values v WHERE d.col_name = ? AND v.contact_id = ?',
      ["nickname", a],
    );
    expect(row?.quarantined_at).toBe(NOW);
    expect(row?.nickname).toBe("Al");
  });

  it("issues EXACTLY ONE BEGIN on an empty field — check+drop share one txn (HIGH-2b)", async () => {
    await createField(exec, newDef({ col_name: "nickname" }));
    await seedContact("Alex");
    const def = { id: await defId("nickname"), col_name: "nickname" };

    const { proxy, beginCount } = countingProxy(exec);
    await deleteOrQuarantineField(proxy, def, NOW);
    // One BEGIN — not two — so there is no window for a between-check-and-drop
    // write. (A second inWriteTransaction would show 2.)
    expect(beginCount()).toBe(1);
  });
});

describe("expireFieldIfStale — under-the-lock re-verification (review cycle-2)", () => {
  it("drops a still-stale quarantined field and snapshots its values", async () => {
    await createField(exec, newDef({ col_name: "nickname" }));
    const a = await seedContact("Alex");
    await exec.runAsync(
      'UPDATE contact_custom_values SET "nickname" = ? WHERE contact_id = ?',
      ["Al", a],
    );
    // Quarantined 40 days ago — older than the -30 day window.
    await exec.runAsync(
      "UPDATE custom_field_defs SET quarantined_at = datetime('now','localtime','-40 days') WHERE col_name = ?",
      ["nickname"],
    );

    const def = { id: await defId("nickname"), col_name: "nickname" };
    expect(await expireFieldIfStale(exec, def, "-30 days", NOW)).toBe(true);

    expect(await defCount("nickname")).toBe(0);
    expect(await valueColumns()).not.toContain("nickname");
    const snap = await exec.getFirstAsync<{ old_value: string }>(
      "SELECT old_value FROM field_history WHERE field_col_name = ? AND operation = ?",
      ["nickname", "quarantine_expiry"],
    );
    expect(snap?.old_value).toBe("Al");
  });

  it("does NOT drop a field restored since the sweep's scan (TOCTOU guard)", async () => {
    await createField(exec, newDef({ col_name: "city" }));
    // Simulate a restoreField that landed after the candidate scan: quarantined_at
    // is now NULL even though the sweep still holds this as a stale candidate.
    const def = { id: await defId("city"), col_name: "city" };

    expect(await expireFieldIfStale(exec, def, "-30 days", NOW)).toBe(false);
    expect(await defCount("city")).toBe(1);
    expect(await valueColumns()).toContain("city");
  });

  it("does NOT drop a field quarantined more recently than the window", async () => {
    await createField(exec, newDef({ col_name: "city" }));
    await exec.runAsync(
      "UPDATE custom_field_defs SET quarantined_at = datetime('now','localtime','-5 days') WHERE col_name = ?",
      ["city"],
    );
    const def = { id: await defId("city"), col_name: "city" };

    expect(await expireFieldIfStale(exec, def, "-30 days", NOW)).toBe(false);
    expect(await defCount("city")).toBe(1);
    expect(await valueColumns()).toContain("city");
  });
});

/** Look up the assigned id for a col_name. */
async function defId(colName: string): Promise<number> {
  const row = await exec.getFirstAsync<{ id: number }>(
    "SELECT id FROM custom_field_defs WHERE col_name = ?",
    [colName],
  );
  if (!row) throw new Error(`no def for ${colName}`);
  return row.id;
}

/**
 * Wrap an executor so every `BEGIN` issued via execAsync is counted — proves how
 * many transactions an op opens.
 */
function countingProxy(inner: SqlExecutor): {
  proxy: SqlExecutor;
  beginCount: () => number;
} {
  let begins = 0;
  const proxy: SqlExecutor = {
    execAsync(sql: string) {
      if (/^\s*BEGIN/i.test(sql)) begins++;
      return inner.execAsync(sql);
    },
    runAsync: (sql, params) => inner.runAsync(sql, params),
    getFirstAsync: <T>(sql: string, params?: unknown[]) =>
      inner.getFirstAsync<T>(sql, params),
    getAllAsync: <T>(sql: string, params?: unknown[]) =>
      inner.getAllAsync<T>(sql, params),
  };
  return { proxy, beginCount: () => begins };
}
