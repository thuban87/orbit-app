import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { SNOOZE_REVIEW_RESUME_SCHEMA_VERSION } from "@/db/migrations/034-snooze-review-memory-resume";
import { runMigrations } from "@/db/migrations/runner";
import { INDEFINITE_SNOOZE_UNTIL } from "@/db/snooze-dao";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-10-17 12:00:00";
const EARLIER = "2026-10-01 09:00:00";

function deps() {
  let uid = 0;
  return { now: NOW, newUid: () => `seed-uid-${++uid}` };
}

async function columns(exec: SqlExecutor, table: string): Promise<string[]> {
  return (
    await exec.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)
  ).map((row) => row.name);
}

interface Seeded {
  mutedId: number;
  datedId: number;
  linkId: number;
}

/** A v33 database holding every row shape migration 034 touches. */
async function seedV33(exec: SqlExecutor): Promise<Seeded> {
  await runMigrations(exec, MIGRATIONS, 33, deps());
  const muted = await exec.runAsync(
    `INSERT INTO contacts (uid, name, tracking_enabled, reminders_off, snooze_until, created_at, modified_at)
     VALUES ('c-muted', 'Muted', 0, 1, NULL, ?, ?)`,
    [EARLIER, EARLIER],
  );
  const dated = await exec.runAsync(
    `INSERT INTO contacts (uid, name, tracking_enabled, reminders_off, snooze_until, created_at, modified_at)
     VALUES ('c-dated', 'Dated', 0, 0, '2026-11-01', ?, ?)`,
    [EARLIER, EARLIER],
  );
  const link = await exec.runAsync(
    `INSERT INTO external_contact_links (uid, contact_id, provider, external_contact_id, created_at, modified_at)
     VALUES ('l-1', ?, 'android', 'ext-1', ?, ?)`,
    [dated.lastInsertRowId, EARLIER, EARLIER],
  );
  await exec.runAsync(
    `INSERT INTO reconcile_source_snapshot (uid, external_contact_link_id, field_family, reviewed_value, reviewed_at)
     VALUES ('s-name', ?, 'name', 'Dated Person', ?)`,
    [link.lastInsertRowId, EARLIER],
  );
  await exec.runAsync(
    `INSERT INTO reconcile_source_snapshot (uid, external_contact_link_id, field_family, reviewed_value, reviewed_at)
     VALUES ('s-photo', ?, 'photo', NULL, ?)`,
    [link.lastInsertRowId, NOW],
  );
  await exec.runAsync(
    `INSERT INTO import_sessions (uid, mode, created_at, modified_at)
     VALUES ('is-1', 'bulk', ?, ?)`,
    [EARLIER, EARLIER],
  );
  await exec.runAsync(
    `INSERT INTO reconciliation_sessions (uid, created_at, modified_at)
     VALUES ('rs-1', ?, ?)`,
    [EARLIER, EARLIER],
  );
  return {
    mutedId: Number(muted.lastInsertRowId),
    datedId: Number(dated.lastInsertRowId),
    linkId: Number(link.lastInsertRowId),
  };
}

async function snapshots(exec: SqlExecutor) {
  return exec.getAllAsync(
    `SELECT id, uid, external_contact_link_id, field_family, reviewed_value, reviewed_at
       FROM reconcile_source_snapshot ORDER BY uid`,
  );
}

/**
 * 38.12 migration 034: the D-45 review-memory family, the D-105/D-111
 * "asked once" markers and the D-134 mute → indefinite snooze conversion.
 */
describe("migration 034 — snooze, review memory and resume markers", () => {
  it("is the registered schema head", () => {
    expect(SNOOZE_REVIEW_RESUME_SCHEMA_VERSION).toBe(34);
    expect(TARGET_VERSION).toBeGreaterThanOrEqual(
      SNOOZE_REVIEW_RESUME_SCHEMA_VERSION,
    );
    expect(MIGRATIONS.filter((m) => m.version === 34)).toHaveLength(1);
  });

  it("upgrades a seeded v33 database and preserves every review-memory row (D-45)", async () => {
    const exec = nodeSqliteExecutor(openTestDb());
    const seeded = await seedV33(exec);
    const before = await snapshots(exec);
    expect(before).toHaveLength(2);

    await runMigrations(exec, MIGRATIONS, TARGET_VERSION, deps());

    expect(await exec.getFirstAsync("PRAGMA user_version")).toEqual({
      user_version: TARGET_VERSION,
    });
    expect(TARGET_VERSION).toBe(34);
    expect(await snapshots(exec)).toEqual(before);
    expect(await exec.getAllAsync("PRAGMA foreign_key_check")).toEqual([]);
    expect(
      await exec.getFirstAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE name = 'reconcile_source_snapshot_new'",
      ),
    ).toBeNull();

    // The widened CHECK admits 'source' and still rejects an unknown family.
    await exec.runAsync(
      `INSERT INTO reconcile_source_snapshot (uid, external_contact_link_id, field_family, reviewed_value, reviewed_at)
       VALUES ('s-source', ?, 'source', NULL, ?)`,
      [seeded.linkId, NOW],
    );
    await expect(
      (async () =>
        exec.runAsync(
          `INSERT INTO reconcile_source_snapshot (uid, external_contact_link_id, field_family, reviewed_at)
           VALUES ('s-bad', ?, 'nickname', ?)`,
          [seeded.linkId, NOW],
        ))(),
    ).rejects.toThrow(/CHECK/);
    // The per-link family uniqueness survives the rebuild.
    await expect(
      (async () =>
        exec.runAsync(
          `INSERT INTO reconcile_source_snapshot (uid, external_contact_link_id, field_family, reviewed_at)
           VALUES ('s-dup', ?, 'name', ?)`,
          [seeded.linkId, NOW],
        ))(),
    ).rejects.toThrow(/UNIQUE/);
    // The FK cascade survives: deleting the link deletes its memory.
    await exec.runAsync("DELETE FROM external_contact_links WHERE id = ?", [
      seeded.linkId,
    ]);
    expect(await snapshots(exec)).toEqual([]);
    expect(await exec.getAllAsync("PRAGMA foreign_key_check")).toEqual([]);
  });

  it("adds a NULL resume_prompted_at to both session tables (D-105, D-111)", async () => {
    const exec = nodeSqliteExecutor(openTestDb());
    await seedV33(exec);
    expect(await columns(exec, "import_sessions")).not.toContain(
      "resume_prompted_at",
    );

    await runMigrations(exec, MIGRATIONS, TARGET_VERSION, deps());

    expect(await columns(exec, "import_sessions")).toContain(
      "resume_prompted_at",
    );
    expect(await columns(exec, "reconciliation_sessions")).toContain(
      "resume_prompted_at",
    );
    expect(
      await exec.getFirstAsync(
        "SELECT uid, resume_prompted_at, modified_at FROM import_sessions",
      ),
    ).toEqual({ uid: "is-1", resume_prompted_at: null, modified_at: EARLIER });
    expect(
      await exec.getFirstAsync(
        "SELECT uid, resume_prompted_at, modified_at FROM reconciliation_sessions",
      ),
    ).toEqual({ uid: "rs-1", resume_prompted_at: null, modified_at: EARLIER });
  });

  it("converts every per-person mute to an indefinite snooze and leaves others untouched (D-134)", async () => {
    const exec = nodeSqliteExecutor(openTestDb());
    const seeded = await seedV33(exec);

    await runMigrations(exec, MIGRATIONS, TARGET_VERSION, deps());

    const row = (id: number) =>
      exec.getFirstAsync(
        "SELECT snooze_until, reminders_off, modified_at FROM contacts WHERE id = ?",
        [id],
      );
    expect(await row(seeded.mutedId)).toEqual({
      snooze_until: "9999-12-31",
      reminders_off: 0,
      modified_at: EARLIER,
    });
    expect(await row(seeded.datedId)).toEqual({
      snooze_until: "2026-11-01",
      reminders_off: 0,
      modified_at: EARLIER,
    });
    expect(
      await exec.getFirstAsync<{ n: number }>(
        "SELECT COUNT(*) AS n FROM contacts WHERE reminders_off = 1",
      ),
    ).toEqual({ n: 0 });
  });

  it("writes the same literal as the runtime INDEFINITE_SNOOZE_UNTIL", () => {
    const source = readFileSync(
      join(__dirname, "034-snooze-review-memory-resume.ts"),
      "utf8",
    );
    expect(INDEFINITE_SNOOZE_UNTIL).toBe("9999-12-31");
    expect(source).toContain(
      `SET snooze_until = '${INDEFINITE_SNOOZE_UNTIL}', reminders_off = 0 WHERE reminders_off = 1`,
    );
  });
});
