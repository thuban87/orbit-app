import { beforeEach, describe, expect, it } from "vitest";
import { readPromptContext } from "@/db/ai-context-read";
import { getContactForEdit } from "@/db/contact-read";
import {
  createField,
  deleteOrQuarantineField,
  expireFieldIfStale,
} from "@/db/field-ddl";
import {
  listDefs,
  quarantineField,
  restoreField,
} from "@/db/field-defs-dao";
import { applyTypeChange, preflightTypeChange } from "@/db/field-type-change";
import {
  defsForCreateForm,
  getValuesForContact,
  upsertValue,
  visibleDefsForProfile,
} from "@/db/field-values-dao";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { migration006 } from "@/db/migrations/006-normalize-custom-field-values";
import { migration007 } from "@/db/migrations/007-tombstones";
import { runMigrations } from "@/db/migrations/runner";
import { purgeContact } from "@/db/purge-dao";
import type { SqlExecutor } from "@/db/types";

const LEGACY_NOW = "2026-08-24 12:00:00";
const MIGRATION_NOW = "2026-08-25 09:00:00";
const legacyMigrations = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
];

let uidNumber = 0;
const uid = () => `uid-${++uidNumber}`;
let exec: SqlExecutor;

beforeEach(async () => {
  uidNumber = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, legacyMigrations, 5, {
    now: LEGACY_NOW,
    newUid: uid,
  });
});

async function addContact(name: string, archived = false): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (
       uid, name, interval_days, archived_at, created_at, modified_at
     ) VALUES (?, ?, ?, ?, ?, ?)`,
    [uid(), name, 30, archived ? LEGACY_NOW : null, LEGACY_NOW, LEGACY_NOW],
  );
  return result.lastInsertRowId;
}

async function addDefinition(
  colName: string,
  type: string,
  options: string | null = null,
  quarantinedAt: string | null = null,
  addColumn = true,
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO custom_field_defs (
       uid, col_name, label, type, options, display_order, quarantined_at,
       created_at, modified_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid(),
      colName,
      colName,
      type,
      options,
      uidNumber,
      quarantinedAt,
      LEGACY_NOW,
      LEGACY_NOW,
    ],
  );
  if (addColumn) {
    await exec.execAsync(
      `ALTER TABLE contact_custom_values ADD COLUMN "${colName}" TEXT`,
    );
  }
  return result.lastInsertRowId;
}

async function addLegacyRow(
  contactId: number,
  values: Record<string, string | null>,
  modifiedAt = "2025-11-03 08:15:00",
): Promise<void> {
  const columns = Object.keys(values);
  await exec.runAsync(
    `INSERT INTO contact_custom_values (
       contact_id, uid, modified_at${columns.map((name) => `, "${name}"`).join("")}
     ) VALUES (?, ?, ?${columns.map(() => ", ?").join("")})`,
    [contactId, uid(), modifiedAt, ...columns.map((name) => values[name])],
  );
}

async function migrate(): Promise<void> {
  await runMigrations(exec, [...legacyMigrations, migration006], 6, {
    now: MIGRATION_NOW,
    newUid: uid,
  });
}

async function userVersion(): Promise<number> {
  const row = await exec.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  return row?.user_version ?? 0;
}

async function definitionByColName(colName: string) {
  const definition = await exec.getFirstAsync<{
    id: number;
    uid: string;
    col_name: string;
    label: string;
    type: "text" | "textarea" | "dropdown" | "date" | "toggle" | "number" | "photo";
    options: string | null;
    show_on_new: 0 | 1;
    always_show: 0 | 1;
    display_order: number;
    quarantined_at: string | null;
    share_with_ai: 0 | 1;
    created_at: string;
    modified_at: string;
  }>("SELECT * FROM custom_field_defs WHERE col_name = ?", [colName]);
  if (!definition) throw new Error(`missing definition ${colName}`);
  return definition;
}

describe("migration006 — lossless legacy custom-value normalization", () => {
  it("migrates every contact × definition pair with byte-preserved raw TEXT and documented timestamps", async () => {
    const alex = await addContact("Alex");
    const blair = await addContact("Blair", true);
    const casey = await addContact("Casey");
    const text = await addDefinition("nickname", "text");
    const textarea = await addDefinition("notes", "textarea");
    const dropdown = await addDefinition("relationship", "dropdown", '["friend","work"]');
    const date = await addDefinition("met_on", "date");
    const toggle = await addDefinition("opt_in", "toggle");
    const number = await addDefinition("score", "number");
    const photo = await addDefinition(
      "portrait",
      "photo",
      null,
      "2026-08-01 00:00:00",
    );
    await addLegacyRow(alex, {
      nickname: "Ace",
      notes: "",
      relationship: "work",
      met_on: "2025-03-04",
      opt_in: "maybe",
      score: "0042.50e-1",
      portrait: "custom-fields/1/portrait/photo.jpg",
    });
    await addLegacyRow(blair, {
      nickname: null,
      notes: "archived value",
      relationship: "friend",
      met_on: null,
      opt_in: "0",
      score: "not-a-number",
      portrait: null,
    });

    await migrate();

    expect(await userVersion()).toBe(6);
    expect(
      await exec.getFirstAsync<{ n: number }>(
        "SELECT COUNT(*) AS n FROM custom_field_values",
      ),
    ).toEqual({ n: 21 });
    expect(
      await exec.getFirstAsync<{ n: number }>(
        "SELECT COUNT(DISTINCT uid) AS n FROM custom_field_values",
      ),
    ).toEqual({ n: 21 });
    expect(
      await exec.getFirstAsync<{ n: number }>(
        "SELECT COUNT(*) AS n FROM (SELECT contact_id, field_def_id FROM custom_field_values GROUP BY contact_id, field_def_id)",
      ),
    ).toEqual({ n: 21 });
    expect(
      await exec.getFirstAsync<{ value: string | null; created_at: string; modified_at: string }>(
        "SELECT value, created_at, modified_at FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
        [alex, photo],
      ),
    ).toEqual({
      value: "custom-fields/1/portrait/photo.jpg",
      created_at: "2025-11-03 08:15:00",
      modified_at: "2025-11-03 08:15:00",
    });
    expect(
      await exec.getFirstAsync<{ value: string | null }>(
        "SELECT value FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
        [alex, textarea],
      ),
    ).toEqual({ value: "" });
    expect(
      await exec.getFirstAsync<{ value: string | null }>(
        "SELECT value FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
        [blair, text],
      ),
    ).toEqual({ value: null });
    expect(
      await exec.getFirstAsync<{ value: string | null }>(
        "SELECT value FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
        [alex, number],
      ),
    ).toEqual({ value: "0042.50e-1" });
    expect(
      await exec.getFirstAsync<{ value: string | null }>(
        "SELECT value FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
        [alex, toggle],
      ),
    ).toEqual({ value: "maybe" });
    expect(
      await exec.getFirstAsync<{ value: string | null }>(
        "SELECT value FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
        [alex, dropdown],
      ),
    ).toEqual({ value: "work" });
    expect(
      await exec.getFirstAsync<{ value: string | null }>(
        "SELECT value FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
        [alex, date],
      ),
    ).toEqual({ value: "2025-03-04" });
    expect(
      await exec.getFirstAsync<{ value: string | null; created_at: string; modified_at: string }>(
        "SELECT value, created_at, modified_at FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
        [casey, photo],
      ),
    ).toEqual({
      value: null,
      created_at: MIGRATION_NOW,
      modified_at: MIGRATION_NOW,
    });
    expect(
      await exec.getFirstAsync<{ sql: string }>(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'custom_field_values'",
      ),
    ).toMatchObject({ sql: expect.stringContaining("UNIQUE(contact_id, field_def_id)") });
    expect(
      await exec.getFirstAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'contact_custom_values'",
      ),
    ).toBeNull();
  });

  it("rolls back unchanged for a loss-bearing missing definition column", async () => {
    const alex = await addContact("Alex");
    await addDefinition("missing_value", "text", null, null, false);
    await addLegacyRow(alex, {});
    const before = await exec.getFirstAsync<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'contact_custom_values'",
    );
    const beforeRows = await exec.getAllAsync<Record<string, unknown>>(
      "SELECT * FROM contact_custom_values",
    );

    await expect(migrate()).rejects.toThrow(/migration 006 integrity failure/i);

    expect(await userVersion()).toBe(5);
    expect(
      await exec.getFirstAsync<{ sql: string }>(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'contact_custom_values'",
      ),
    ).toEqual(before);
    expect(await exec.getAllAsync<Record<string, unknown>>("SELECT * FROM contact_custom_values")).toEqual(beforeRows);
    expect(
      await exec.getFirstAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'custom_field_values'",
      ),
    ).toBeNull();
  });

  it("snapshots a non-loss orphan dynamic column and proceeds without inventing a pair", async () => {
    const alex = await addContact("Alex");
    const known = await addDefinition("known", "text");
    await exec.execAsync(
      'ALTER TABLE contact_custom_values ADD COLUMN "orphan_value" TEXT',
    );
    await addLegacyRow(alex, { known: "kept", orphan_value: "audit-only" });

    await migrate();

    expect(await userVersion()).toBe(6);
    expect(
      await exec.getFirstAsync<{ field_col_name: string; old_value: string; operation: string; created_at: string }>(
        "SELECT field_col_name, old_value, operation, created_at FROM field_history WHERE contact_id = ?",
        [alex],
      ),
    ).toEqual({
      field_col_name: "orphan_value",
      old_value: "audit-only",
      operation: "migration-006-orphan-column-drop",
      created_at: MIGRATION_NOW,
    });
    expect(
      await exec.getFirstAsync<{ n: number }>(
        "SELECT COUNT(*) AS n FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
        [alex, known],
      ),
    ).toEqual({ n: 1 });
    expect(
      await exec.getFirstAsync<{ n: number }>(
        "SELECT COUNT(*) AS n FROM custom_field_values",
      ),
    ).toEqual({ n: 1 });
  });

  it("fails before writes when a persisted definition identifier is unsafe", async () => {
    const alex = await addContact("Alex");
    await exec.runAsync(
      `INSERT INTO custom_field_defs (
         uid, col_name, label, type, display_order, created_at, modified_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uid(), "bad-name!", "bad", "text", 0, LEGACY_NOW, LEGACY_NOW],
    );
    await addLegacyRow(alex, {});

    await expect(migrate()).rejects.toThrow(/migration 006 integrity failure/i);
    expect(await userVersion()).toBe(5);
    expect(
      await exec.getFirstAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'custom_field_values'",
      ),
    ).toBeNull();
  });

  it("preserves the populated v5 profile through normalized lifecycle, read, AI, history, and purge paths", async () => {
    const alex = await addContact("Alex");
    const blair = await addContact("Blair", true);
    const casey = await addContact("Casey");
    const nickname = await addDefinition("nickname", "text");
    await addDefinition("notes", "textarea");
    await addDefinition("relationship", "dropdown", '["friend","work"]');
    await addDefinition("met_on", "date");
    await addDefinition("opt_in", "toggle");
    const score = await addDefinition("score", "number");
    const portrait = await addDefinition("portrait", "photo");
    await exec.runAsync(
      "UPDATE custom_field_defs SET share_with_ai = 1, show_on_new = 1, always_show = 1 WHERE id = ?",
      [nickname],
    );
    await addLegacyRow(alex, {
      nickname: "Ace",
      notes: "",
      relationship: "work",
      met_on: "2025-03-04",
      opt_in: "maybe",
      score: "0042.50e-1",
      portrait: "custom-fields/1/portrait/photo.jpg",
    });
    await addLegacyRow(blair, {
      nickname: "Archived",
      notes: null,
      relationship: null,
      met_on: null,
      opt_in: null,
      score: null,
      portrait: null,
    });

    await migrate();
    const liveDefs = await listDefs(exec, { includeQuarantined: false });
    const initial = await getValuesForContact(exec, alex, liveDefs);
    expect(initial).toMatchObject({
      nickname: "Ace",
      notes: "",
      score: "0042.50e-1",
      portrait: "custom-fields/1/portrait/photo.jpg",
    });
    expect(defsForCreateForm(liveDefs).map((definition) => definition.col_name)).toEqual([
      "nickname",
    ]);
    expect(
      visibleDefsForProfile(liveDefs, initial).map((definition) => definition.col_name),
    ).toContain("portrait");
    expect(await getContactForEdit(exec, alex, liveDefs)).toMatchObject({
      values: expect.objectContaining({
        nickname: "Ace",
        portrait: "custom-fields/1/portrait/photo.jpg",
      }),
    });

    const nicknameDef = await definitionByColName("nickname");
    const originalPair = await exec.getFirstAsync<{ uid: string; created_at: string }>(
      "SELECT uid, created_at FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
      [alex, nicknameDef.id],
    );
    await upsertValue(exec, alex, nicknameDef.id, "ignored-new-uid", "Aces", MIGRATION_NOW);
    await upsertValue(exec, alex, nicknameDef.id, "ignored-new-uid", null, MIGRATION_NOW);
    expect(
      await exec.getFirstAsync<{ uid: string; created_at: string; value: string | null }>(
        "SELECT uid, created_at, value FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
        [alex, nicknameDef.id],
      ),
    ).toEqual({ ...originalPair, value: null });

    const optInDef = await definitionByColName("opt_in");
    expect(await preflightTypeChange(exec, optInDef, "number")).toMatchObject({
      total: 1,
      flag: [alex],
    });
    await applyTypeChange(exec, optInDef, "number", MIGRATION_NOW);
    expect(
      await exec.getFirstAsync<{ value: string; uid: string }>(
        "SELECT value, uid FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
        [alex, optInDef.id],
      ),
    ).toEqual(expect.objectContaining({ value: "maybe" }));
    expect(
      await exec.getFirstAsync<{ field_col_name: string; old_value: string; operation: string }>(
        "SELECT field_col_name, old_value, operation FROM field_history WHERE contact_id = ? AND field_col_name = ?",
        [alex, "opt_in"],
      ),
    ).toEqual({
      field_col_name: "opt_in",
      old_value: "maybe",
      operation: "type_change:toggle->number",
    });

    // The HIGH invariant: creating a field while another is quarantined must
    // still make a durable pair for every contact; restoring the old field must
    // not leave either set incomplete.
    await quarantineField(exec, portrait, MIGRATION_NOW);
    await createField(exec, {
      uid: uid(),
      col_name: "after_quarantine",
      label: "After quarantine",
      type: "text",
      options: null,
      show_on_new: 0,
      always_show: 0,
      display_order: 8,
      share_with_ai: 0,
      now: MIGRATION_NOW,
    });
    await restoreField(exec, portrait, MIGRATION_NOW);
    const scoreDef = await definitionByColName("score");
    const allDefs = await listDefs(exec, { includeQuarantined: true });
    expect(
      await exec.getFirstAsync<{ n: number }>(
        "SELECT COUNT(*) AS n FROM custom_field_values",
      ),
    ).toEqual({ n: 3 * allDefs.length });
    expect(
      await exec.getFirstAsync<{ n: number }>(
        "SELECT COUNT(*) AS n FROM (SELECT contact_id, field_def_id FROM custom_field_values GROUP BY contact_id, field_def_id)",
      ),
    ).toEqual({ n: 3 * allDefs.length });

    await exec.runAsync(
      "UPDATE custom_field_defs SET share_with_ai = 1 WHERE col_name = ?",
      ["nickname"],
    );
    await exec.runAsync(
      "UPDATE custom_field_defs SET share_with_ai = 0 WHERE col_name = ?",
      ["score"],
    );
    await upsertValue(exec, alex, nicknameDef.id, uid(), "shared", MIGRATION_NOW);
    await upsertValue(exec, alex, scoreDef.id, uid(), "private", MIGRATION_NOW);
    await quarantineField(exec, portrait, MIGRATION_NOW);
    const prompt = await readPromptContext(exec, alex, MIGRATION_NOW);
    expect(prompt.sharedFields).toEqual([{ label: "nickname", value: "shared" }]);
    expect(JSON.stringify(prompt)).not.toContain("private");
    expect(JSON.stringify(prompt)).not.toContain("custom-fields/1/portrait/photo.jpg");
    await restoreField(exec, portrait, MIGRATION_NOW);

    const emptyDef = await definitionByColName("after_quarantine");
    expect(
      await deleteOrQuarantineField(exec, emptyDef, MIGRATION_NOW),
    ).toBe("deleted");
    await quarantineField(exec, scoreDef.id, MIGRATION_NOW);
    await exec.runAsync(
      "UPDATE custom_field_defs SET quarantined_at = datetime('now', 'localtime', '-31 days') WHERE id = ?",
      [scoreDef.id],
    );
    expect(
      await expireFieldIfStale(exec, scoreDef, "-30 days", MIGRATION_NOW),
    ).toBe(true);
    expect(
      await exec.getFirstAsync<{ old_value: string; field_col_name: string }>(
        "SELECT old_value, field_col_name FROM field_history WHERE contact_id = ? AND operation = ?",
        [alex, "quarantine_expiry"],
      ),
    ).toEqual({ old_value: "private", field_col_name: "score" });

    // purgeContact now writes Phase 17 deletion evidence, so run its required
    // forward migration while retaining this v6 lifecycle regression.
    await runMigrations(exec, [...legacyMigrations, migration006, migration007], 7, {
      now: MIGRATION_NOW,
      newUid: uid,
    });
    await purgeContact(exec, blair, { now: MIGRATION_NOW });
    expect(
      await exec.getFirstAsync<{ n: number }>(
        "SELECT COUNT(*) AS n FROM custom_field_values WHERE contact_id = ?",
        [blair],
      ),
    ).toEqual({ n: 0 });
    expect(await userVersion()).toBe(7);
    // Phase 17 backup/export/restore, tombstones, reconciliation, and sync
    // conflict policy are intentionally out of scope for this migration proof.
    expect(casey).toBeGreaterThan(0);
  });

  it.each([1, 4, 5])(
    "upgrades a representative v%s database to v6 and then bootstraps cleanly",
    async (startingVersion) => {
      exec = nodeSqliteExecutor(openTestDb());
      uidNumber = 0;
      await runMigrations(exec, legacyMigrations, startingVersion, {
        now: LEGACY_NOW,
        newUid: uid,
      });
      const contact = await addContact(`v${startingVersion} contact`);
      const field = await addDefinition("legacy_text", "text");
      await addLegacyRow(contact, { legacy_text: `v${startingVersion}-raw` });

      await migrate();
      expect(await userVersion()).toBe(6);
      expect(
        await exec.getFirstAsync<{ value: string }>(
          "SELECT value FROM custom_field_values WHERE contact_id = ? AND field_def_id = ?",
          [contact, field],
        ),
      ).toEqual({ value: `v${startingVersion}-raw` });
      await migrate();
      expect(await userVersion()).toBe(6);
    },
  );

  it("migrates the 200-contact × 15-definition upper bound and records its wall-clock", async () => {
    const contactIds: number[] = [];
    const definitions: string[] = [];
    for (let definitionIndex = 0; definitionIndex < 15; definitionIndex++) {
      const colName = `field_${definitionIndex}`;
      definitions.push(colName);
      await addDefinition(colName, "text");
    }
    for (let contactIndex = 0; contactIndex < 200; contactIndex++) {
      const contactId = await addContact(`Contact ${contactIndex}`);
      contactIds.push(contactId);
      const values = Object.fromEntries(
        definitions.map((colName, definitionIndex) => [
          colName,
          (contactIndex + definitionIndex) % 3 === 0
            ? `raw-${contactIndex}-${definitionIndex}`
            : null,
        ]),
      );
      await addLegacyRow(contactId, values);
    }

    const startedAt = performance.now();
    await migrate();
    const elapsedMs = performance.now() - startedAt;
    // Kept in test output and mirrored into the owner-facing UAT record so the
    // bare-spinner discussion has a measured Node upper bound, not a guess.
    console.info(`migration006 upper-bound 200x15: ${elapsedMs.toFixed(1)}ms`);
    expect(elapsedMs).toBeGreaterThanOrEqual(0);
    expect(await userVersion()).toBe(6);
    expect(
      await exec.getFirstAsync<{ n: number }>(
        "SELECT COUNT(*) AS n FROM custom_field_values",
      ),
    ).toEqual({ n: contactIds.length * definitions.length });
  });
});
