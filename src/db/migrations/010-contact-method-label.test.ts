import { describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { migration006 } from "@/db/migrations/006-normalize-custom-field-values";
import { migration007 } from "@/db/migrations/007-tombstones";
import { migration008 } from "@/db/migrations/008-restore-photo-journal";
import { migration009 } from "@/db/migrations/009-contact-method-normalization";
import { migration010 } from "@/db/migrations/010-contact-method-label";
import { runMigrations } from "@/db/migrations/runner";

const NOW = "2026-08-28 12:00:00";

describe("migration 010 — contact method labels", () => {
  it("adds a nullable label without changing rows created by migration 009", async () => {
    let nextUid = 0;
    const exec = nodeSqliteExecutor(openTestDb());
    const migrations = [
      migration001,
      migration002,
      migration003,
      migration004,
      migration005,
      migration006,
      migration007,
      migration008,
      migration009,
    ];
    await runMigrations(exec, migrations, 9, {
      now: NOW,
      newUid: () => `uid-${++nextUid}`,
      defaultPhoneRegion: "US",
    });
    const contact = await exec.runAsync(
      "INSERT INTO contacts (uid, name, interval_days, created_at, modified_at) VALUES (?, ?, ?, ?, ?)",
      ["contact-1", "Labelled", 30, NOW, NOW],
    );
    await exec.runAsync(
      "INSERT INTO contact_methods (uid, contact_id, method_type, raw_value, display_value, is_actionable, is_primary, display_order, created_at, modified_at) VALUES (?, ?, 'phone', ?, ?, 0, 1, 0, ?, ?)",
      ["method-1", contact.lastInsertRowId, "not a number", "not a number", NOW, NOW],
    );

    await runMigrations(exec, [...migrations, migration010], 10, {
      now: NOW,
      newUid: () => `uid-${++nextUid}`,
      defaultPhoneRegion: "US",
    });

    expect(
      await exec.getFirstAsync<{ label: string | null }>(
        "SELECT label FROM contact_methods WHERE uid = ?",
        ["method-1"],
      ),
    ).toEqual({ label: null });
    expect(
      await exec.getFirstAsync<{ user_version: number }>("PRAGMA user_version"),
    ).toEqual({ user_version: 10 });
  });
});
