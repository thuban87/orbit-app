import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  type AppSettingsPatch,
  getAppSettings,
  updateAppSettings,
  updateAppSettingsCore,
} from "@/db/app-settings-dao";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { migration021 } from "@/db/migrations/021-orrery-preferences";
import { runMigrations } from "@/db/migrations/runner";
import { newUid } from "@/db/uid";

const NOW = "2026-09-07 12:00:00";
let db: ReturnType<typeof openTestDb>;
let exec: ReturnType<typeof nodeSqliteExecutor>;
const deps = { now: NOW, newUid };
beforeEach(() => {
  db = openTestDb();
  exec = nodeSqliteExecutor(db);
});
afterEach(() => db.close());

describe("Orrery preferences migration and DAO", () => {
  it.each([0, 2, 20])(
    "upgrades from %i with Balanced/Off/All defaults",
    async (version) => {
      await runMigrations(exec, MIGRATIONS, version, deps);
      await runMigrations(exec, MIGRATIONS, TARGET_VERSION, deps);
      expect(migration021.version).toBe(21);
      expect(MIGRATIONS).toContain(migration021);
      expect(await getAppSettings(exec)).toMatchObject({
        orreryDensity: "balanced",
        orrerySatellitesEnabled: 0,
        orreryLastSystem: "builtin:all-contacts",
      });
    },
  );
  it("preserves the existing settings singleton and contact ranks on a head20 upgrade", async () => {
    await runMigrations(exec, MIGRATIONS, 20, deps);
    const { lastInsertRowId } = await exec.runAsync(
      "INSERT INTO contacts (uid,name,interval_days,ring_seq,created_at,modified_at) VALUES (?, ?, 30, 7, ?, ?)",
      [newUid(), "Alex", NOW, NOW],
    );
    await exec.runAsync(
      "UPDATE app_settings SET sun_contact_id=?, delivery_hour=17, dashboard_right_swipe_action='log-contact' WHERE id=1",
      [lastInsertRowId],
    );
    const before = await exec.getFirstAsync<Record<string, unknown>>(
      "SELECT * FROM app_settings",
    );
    await runMigrations(exec, MIGRATIONS, TARGET_VERSION, deps);
    expect(
      await exec.getFirstAsync("SELECT * FROM app_settings"),
    ).toMatchObject(before!);
    expect(
      await exec.getFirstAsync("SELECT ring_seq FROM contacts WHERE id=?", [
        lastInsertRowId,
      ]),
    ).toEqual({ ring_seq: 7 });
    await updateAppSettings(
      exec,
      {
        orreryDensity: "compact",
        orrerySatellitesEnabled: 1,
        orreryLastSystem: "category:stable-uid",
      },
      NOW,
    );
    expect(await getAppSettings(exec)).toMatchObject({
      orreryDensity: "compact",
      orrerySatellitesEnabled: 1,
      orreryLastSystem: "category:stable-uid",
    });
  });
  it("rolls back DDL and user_version when the migration fails after applying", async () => {
    await runMigrations(exec, MIGRATIONS, 20, deps);
    const before = await exec.getFirstAsync("SELECT * FROM app_settings");
    const step = MIGRATIONS.find((migration) => migration.version === 21);
    expect(step).toBeDefined();
    await expect(
      runMigrations(
        exec,
        [
          {
            version: 21,
            apply: async (sql, inputs) => {
              await step!.apply(sql, inputs);
              throw new Error("forced");
            },
          },
        ],
        21,
        deps,
      ),
    ).rejects.toThrow("forced");
    expect(await exec.getFirstAsync("PRAGMA user_version")).toEqual({
      user_version: 20,
    });
    expect(await exec.getFirstAsync("SELECT * FROM app_settings")).toEqual(
      before,
    );
  });
  it.each([
    { orreryDensity: "unknown" },
    { orreryDensity: null },
    { orrerySatellitesEnabled: 2 },
    { orrerySatellitesEnabled: true },
    { orreryLastSystem: "builtin:unknown" },
    { orreryLastSystem: "category:" },
    { orreryLastSystem: `category:${"x".repeat(257)}` },
    { orreryLastSystem: "category:bad\u0000uid" },
    { orreryLastSystem: 42 },
  ])(
    "rejects malformed preferences at public and restore-core boundaries: %j",
    async (patch) => {
      await runMigrations(exec, MIGRATIONS, TARGET_VERSION, deps);
      const before = await getAppSettings(exec);
      const sql = vi.spyOn(exec, "runAsync");
      for (const write of [updateAppSettings, updateAppSettingsCore]) {
        await expect(
          Promise.resolve().then(() =>
            write(exec, patch as AppSettingsPatch, NOW),
          ),
        ).rejects.toThrow();
      }
      expect(sql).not.toHaveBeenCalled();
      expect(await getAppSettings(exec)).toEqual(before);
    },
  );
  it("enforces density and toggle constraints even for direct SQL", async () => {
    await runMigrations(exec, MIGRATIONS, TARGET_VERSION, deps);
    expect(await getAppSettings(exec)).toHaveProperty(
      "orreryDensity",
      "balanced",
    );
    expect(() =>
      db.exec("UPDATE app_settings SET orrery_density='unknown'"),
    ).toThrow();
    expect(() =>
      db.exec("UPDATE app_settings SET orrery_satellites_enabled=2"),
    ).toThrow();
  });
});
