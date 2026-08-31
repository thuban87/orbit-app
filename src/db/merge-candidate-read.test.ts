import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { migration011 } from "@/db/migrations/011-contact-lifecycle-schema";
import { listMergeCandidates } from "@/db/merge-candidate-read";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-30 12:00:00";
let exec: SqlExecutor; let n = 0; const uid = () => `uid-${++n}`;
beforeEach(async () => { n = 0; exec = nodeSqliteExecutor(openTestDb()); await runMigrations(exec, [migration001], 1, { now: NOW, newUid: uid }); });

describe("listMergeCandidates", () => {
  it("includes live Unbound contacts while excluding the current and archived contacts", async () => {
    const current = await exec.runAsync("INSERT INTO contacts (uid, name, interval_days, created_at, modified_at) VALUES (?, 'Current', 7, ?, ?)", [uid(), NOW, NOW]);
    const unbound = await exec.runAsync("INSERT INTO contacts (uid, name, interval_days, created_at, modified_at) VALUES (?, 'Unbound', 7, ?, ?)", [uid(), NOW, NOW]);
    const archived = await exec.runAsync("INSERT INTO contacts (uid, name, interval_days, archived_at, created_at, modified_at) VALUES (?, 'Archived', 7, ?, ?, ?)", [uid(), NOW, NOW, NOW]);
    void unbound; void archived;
    const rows = await listMergeCandidates(exec, current.lastInsertRowId);
    expect(rows.map((row) => row.name)).toEqual(["Unbound"]);
  });
});
