import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  PROFILE_PRESENTATION_SCHEMA_VERSION,
  profilePresentationMigration,
} from "@/db/migrations/profile-presentation";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import { PROFILE_LAYOUT_DOCUMENT_VERSION } from "@/profile/persisted-contract";

const NOW = "2026-09-09 12:00:00";
let exec: SqlExecutor;
let uid = 0;

beforeEach(() => {
  exec = nodeSqliteExecutor(openTestDb());
});

async function migrateTo(version: number): Promise<void> {
  await runMigrations(exec, MIGRATIONS, version, {
    now: NOW,
    newUid: () => `migration-${++uid}`,
  });
}

describe("Profile presentation migration", () => {
  it.each([0, PROFILE_PRESENTATION_SCHEMA_VERSION - 1])(
    "upgrades from version %i to the live head+1 schema",
    async (fromVersion) => {
      await exec.execAsync("PRAGMA foreign_keys = ON");
      if (fromVersion > 0) await migrateTo(fromVersion);
      await migrateTo(PROFILE_PRESENTATION_SCHEMA_VERSION);

      expect(TARGET_VERSION).toBe(PROFILE_PRESENTATION_SCHEMA_VERSION);
      expect(profilePresentationMigration.version).toBe(
        PROFILE_PRESENTATION_SCHEMA_VERSION,
      );
      expect(
        await exec.getFirstAsync<{ user_version: number }>(
          "PRAGMA user_version",
        ),
      ).toEqual({ user_version: PROFILE_PRESENTATION_SCHEMA_VERSION });
      const tables = await exec.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      );
      expect(tables.map(({ name }) => name)).toEqual(
        expect.arrayContaining([
          "profile_layout_templates",
          "profile_background_templates",
          "profile_category_presentation",
          "profile_contact_presentation",
        ]),
      );
    },
  );

  it("enforces closed JSON envelopes and case-insensitive template names", async () => {
    await exec.execAsync("PRAGMA foreign_keys = ON");
    await migrateTo(PROFILE_PRESENTATION_SCHEMA_VERSION);
    const layout = JSON.stringify({
      version: PROFILE_LAYOUT_DOCUMENT_VERSION,
      topLevel: [],
      overview: [],
      thingsToRemember: [],
    });
    await exec.runAsync(
      "INSERT INTO profile_layout_templates(uid,name,layout_json,created_at,modified_at) VALUES(?,?,?,?,?)",
      ["layout-1", "Close Friends", layout, NOW, NOW],
    );
    expect(() =>
      exec.runAsync(
        "INSERT INTO profile_layout_templates(uid,name,layout_json,created_at,modified_at) VALUES(?,?,?,?,?)",
        ["layout-2", "close friends", layout, NOW, NOW],
      ),
    ).toThrow();
    expect(() =>
      exec.runAsync(
        "INSERT INTO profile_layout_templates(uid,name,layout_json,created_at,modified_at) VALUES(?,?,?,?,?)",
        ["layout-3", "Broken", "not-json", NOW, NOW],
      ),
    ).toThrow();
    expect(() =>
      exec.runAsync(
        "INSERT INTO profile_layout_templates(uid,name,layout_json,created_at,modified_at) VALUES(?,?,?,?,?)",
        ["layout-4", "Wrong version", '{"version":2}', NOW, NOW],
      ),
    ).toThrow();
    expect(() =>
      exec.runAsync(
        "INSERT INTO profile_contact_presentation(contact_id,collapse_json,created_at,modified_at) VALUES(?,?,?,?)",
        [1, "[]", NOW, NOW],
      ),
    ).toThrow();
    expect(() =>
      exec.runAsync(
        "INSERT INTO profile_background_templates(uid,name,image_path,created_at,modified_at) VALUES(?,?,?,?,?)",
        ["unsafe-bg", "Unsafe", "../outside.webp", NOW, NOW],
      ),
    ).toThrow();
  });

  it("keeps layout/background axes independent and applies contact/Category FK behavior", async () => {
    await exec.execAsync("PRAGMA foreign_keys = ON");
    await migrateTo(PROFILE_PRESENTATION_SCHEMA_VERSION);
    const category = await exec.runAsync(
      "INSERT INTO categories(uid,name,display_order,created_at,modified_at) VALUES(?,?,?,?,?)",
      ["profile-category", "Profile Category", 99, NOW, NOW],
    );
    const contact = await exec.runAsync(
      "INSERT INTO contacts(uid,name,interval_days,tracking_enabled,created_at,modified_at) VALUES(?,?,?,?,?,?)",
      ["profile-contact", "Profile Contact", 30, 1, NOW, NOW],
    );
    const layout = JSON.stringify({
      version: PROFILE_LAYOUT_DOCUMENT_VERSION,
      topLevel: [],
      overview: [],
      thingsToRemember: [],
    });
    await exec.runAsync(
      "INSERT INTO profile_layout_templates(uid,name,layout_json,created_at,modified_at) VALUES(?,?,?,?,?)",
      ["layout", "Layout", layout, NOW, NOW],
    );
    await exec.runAsync(
      "INSERT INTO profile_background_templates(uid,name,image_path,created_at,modified_at) VALUES(?,?,?,?,?)",
      [
        "background",
        "Background",
        "profile-backgrounds/background.webp",
        NOW,
        NOW,
      ],
    );
    await exec.runAsync(
      "INSERT INTO profile_category_presentation(category_id,layout_template_uid,background_template_uid,created_at,modified_at) VALUES(?,?,?,?,?)",
      [category.lastInsertRowId, "layout", null, NOW, NOW],
    );
    await exec.runAsync(
      "INSERT INTO profile_contact_presentation(contact_id,layout_template_uid,background_template_uid,collapse_json,created_at,modified_at) VALUES(?,?,?,?,?,?)",
      [contact.lastInsertRowId, null, "background", "{}", NOW, NOW],
    );

    await exec.runAsync("DELETE FROM categories WHERE id=?", [
      category.lastInsertRowId,
    ]);
    expect(
      await exec.getFirstAsync(
        "SELECT category_id FROM profile_category_presentation WHERE category_id=?",
        [category.lastInsertRowId],
      ),
    ).toBeNull();
    expect(
      await exec.getFirstAsync<{ background_template_uid: string | null }>(
        "SELECT background_template_uid FROM profile_contact_presentation WHERE contact_id=?",
        [contact.lastInsertRowId],
      ),
    ).toEqual({ background_template_uid: "background" });

    await exec.runAsync("DELETE FROM contacts WHERE id=?", [
      contact.lastInsertRowId,
    ]);
    expect(
      await exec.getFirstAsync(
        "SELECT contact_id FROM profile_contact_presentation WHERE contact_id=?",
        [contact.lastInsertRowId],
      ),
    ).toBeNull();
  });
});
