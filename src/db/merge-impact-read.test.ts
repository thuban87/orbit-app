import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { readMergeImpactCounts } from "@/db/merge-impact-read";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-10-13 12:00:00";
let exec: SqlExecutor;
let n = 0;
const uid = () => `uid-${++n}`;

beforeEach(async () => {
  n = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
  });
});

async function contact(name: string): Promise<number> {
  const row = await exec.runAsync(
    "INSERT INTO contacts (uid, name, tracking_enabled, created_at, modified_at) VALUES (?, ?, 0, ?, ?)",
    [uid(), name, NOW, NOW],
  );
  return row.lastInsertRowId;
}

describe("readMergeImpactCounts", () => {
  it("counts the absorbed contact's interactions, events, methods and external links only", async () => {
    const absorbed = await contact("Absorbed");
    const other = await contact("Other");
    for (const owner of [absorbed, absorbed, other]) {
      await exec.runAsync(
        "INSERT INTO interactions (uid, contact_id, occurred_at, recorded_at, source, modified_at) VALUES (?, ?, ?, ?, 'manual', ?)",
        [uid(), owner, NOW, NOW, NOW],
      );
    }
    await exec.runAsync(
      "INSERT INTO events (uid, contact_id, type, occurred_at, recorded_at, modified_at) VALUES (?, ?, 'birthday', ?, ?, ?)",
      [uid(), absorbed, NOW, NOW, NOW],
    );
    for (const [order, value] of [
      "+15550000001",
      "+15550000002",
      "+15550000003",
    ].entries()) {
      await exec.runAsync(
        `INSERT INTO contact_methods
           (uid, contact_id, method_type, raw_value, display_value, canonical_value,
            is_actionable, is_primary, display_order, created_at, modified_at)
         VALUES (?, ?, 'phone', ?, ?, ?, 1, 0, ?, ?, ?)`,
        [uid(), absorbed, value, value, value, order, NOW, NOW],
      );
    }
    for (const [externalId, active] of [
      ["a-1", 1],
      ["a-2", 0],
    ] as const) {
      await exec.runAsync(
        "INSERT INTO external_contact_links (uid, contact_id, provider, external_contact_id, is_active, created_at, modified_at) VALUES (?, ?, 'android', ?, ?, ?, ?)",
        [uid(), absorbed, externalId, active, NOW, NOW],
      );
    }
    // Off Limits is not a merge review line (D-87 removes lines only).
    await exec.runAsync(
      "INSERT INTO off_limits (uid, contact_id, text, created_at, modified_at) VALUES (?, ?, 'Topic', ?, ?)",
      [uid(), absorbed, NOW, NOW],
    );

    expect(await readMergeImpactCounts(exec, absorbed)).toEqual({
      interactions: 2,
      events: 1,
      methods: 3,
      externalLinks: 2,
    });
  });

  it("returns zeros for a contact that owns nothing", async () => {
    const bare = await contact("Bare");
    expect(await readMergeImpactCounts(exec, bare)).toEqual({
      interactions: 0,
      events: 0,
      methods: 0,
      externalLinks: 0,
    });
  });
});
