import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { getMergeCandidate } from "@/db/merge-candidate-read";
import { migration001 } from "@/db/migrations/001-initial";
import { migration011 } from "@/db/migrations/011-contact-lifecycle-schema";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-30 12:00:00";
let exec: SqlExecutor;
let n = 0;
const uid = () => `uid-${++n}`;
beforeEach(async () => {
  n = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, [migration001], 1, { now: NOW, newUid: uid });
  await exec.execAsync(`
    ALTER TABLE contacts ADD COLUMN tracking_enabled INTEGER NOT NULL DEFAULT 1;
    CREATE TABLE custom_field_values (contact_id INTEGER NOT NULL, value TEXT);
    CREATE TABLE contact_methods (contact_id INTEGER NOT NULL, display_value TEXT);
    CREATE TABLE external_contact_links (contact_id INTEGER NOT NULL, is_active INTEGER NOT NULL);
  `);
});

describe("getMergeCandidate", () => {
  it("reads a live Unbound contact and refuses one in the Bin", async () => {
    const unbound = await exec.runAsync(
      "INSERT INTO contacts (uid, name, interval_days, tracking_enabled, created_at, modified_at) VALUES (?, 'Unbound', 7, 0, ?, ?)",
      [uid(), NOW, NOW],
    );
    const archived = await exec.runAsync(
      "INSERT INTO contacts (uid, name, interval_days, archived_at, created_at, modified_at) VALUES (?, 'Archived', 7, ?, ?, ?)",
      [uid(), NOW, NOW, NOW],
    );
    await expect(
      getMergeCandidate(exec, unbound.lastInsertRowId),
    ).resolves.toMatchObject({ name: "Unbound", interactionCount: 0 });
    await expect(
      getMergeCandidate(exec, archived.lastInsertRowId),
    ).resolves.toBeNull();
  });
});
