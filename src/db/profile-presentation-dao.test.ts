import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import {
  readProfileCollapseOverride,
  setProfileCollapseOverride,
} from "@/db/profile-presentation-dao";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-09 12:00:00";
let exec: SqlExecutor;
let contactId: number;

beforeEach(async () => {
  exec = nodeSqliteExecutor(openTestDb());
  await exec.execAsync("PRAGMA foreign_keys = ON");
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: () => crypto.randomUUID(),
  });
  contactId = (
    await exec.runAsync(
      "INSERT INTO contacts(uid,name,interval_days,tracking_enabled,created_at,modified_at) VALUES(?,?,?,?,?,?)",
      ["profile-contact", "Profile Contact", 30, 1, NOW, NOW],
    )
  ).lastInsertRowId;
});

describe("Profile collapse persistence", () => {
  it("writes a bound semantic key, bumps one revision, and survives a new read", async () => {
    const before = await exec.getFirstAsync<{ data_revision: number }>(
      "SELECT data_revision FROM app_settings WHERE id=1",
    );
    await setProfileCollapseOverride(exec, {
      contactId,
      moduleId: "relationship-overview",
      expanded: false,
      now: NOW,
    });
    expect(await readProfileCollapseOverride(exec, contactId)).toEqual({
      "relationship-overview": false,
    });
    expect(
      await exec.getFirstAsync<{ data_revision: number }>(
        "SELECT data_revision FROM app_settings WHERE id=1",
      ),
    ).toEqual({ data_revision: (before?.data_revision ?? 0) + 1 });
  });

  it("retains the prior row when the outer transaction fails", async () => {
    await setProfileCollapseOverride(exec, {
      contactId,
      moduleId: "relationship-overview",
      expanded: true,
      now: NOW,
    });
    await exec.runAsync("DELETE FROM app_settings WHERE id=1");
    await expect(
      setProfileCollapseOverride(exec, {
        contactId,
        moduleId: "relationship-overview",
        expanded: false,
        now: NOW,
      }),
    ).rejects.toThrow("app_settings");
    expect(await readProfileCollapseOverride(exec, contactId)).toEqual({
      "relationship-overview": true,
    });
  });

  it("falls back safely when a legacy/corrupt reader returns malformed JSON", async () => {
    const malformed: Pick<SqlExecutor, "getFirstAsync"> = {
      async getFirstAsync<T>() {
        return { collapse_json: "not-json" } as T;
      },
    };
    expect(await readProfileCollapseOverride(malformed, contactId)).toEqual({});
  });
});
