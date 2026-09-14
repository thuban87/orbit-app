import { describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration030 } from "@/db/migrations/030-restore-background-journal";

describe("migration030", () => {
  it("creates unique transaction-owned background restore evidence", async () => {
    const exec = nodeSqliteExecutor(openTestDb());
    await migration030.apply(exec, {
      now: "2026-09-14 00:00:00",
      newUid: () => "unused",
    });
    await exec.runAsync(
      `INSERT INTO restore_background_journal
       (relative_path,template_uid,template_modified_at,canonical_relative_path,created_at)
       VALUES (?,?,?,?,?)`,
      ["pending/session.jpg", "template", "v1", "canonical.jpg", "now"],
    );
    expect(() =>
      exec.runAsync(
        `INSERT INTO restore_background_journal
         (relative_path,template_uid,template_modified_at,canonical_relative_path,created_at)
         VALUES (?,?,?,?,?)`,
        ["pending/session.jpg", "template", "v1", "canonical.jpg", "now"],
      ),
    ).toThrow();
  });
});
