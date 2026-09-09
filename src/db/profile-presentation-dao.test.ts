import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import {
  readProfileCollapseOverride,
  setProfileCollapseOverride,
} from "@/db/profile-presentation-dao";
import {
  countProfileTemplateUsage,
  listProfileBackgroundTemplates,
  listProfileLayoutTemplates,
  readProfilePresentationInputs,
} from "@/db/profile-presentation-read";
import type { SqlExecutor } from "@/db/types";
import { FACTORY_PROFILE_LAYOUT } from "@/profile/presentation-schema";
import { resolveProfilePresentation } from "@/profile/resolve-presentation";

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

describe("Profile presentation read model", () => {
  it("reads all hierarchy inputs and preserves independent explicit axes", async () => {
    const categoryId = (
      await exec.runAsync(
        "INSERT INTO categories(uid,name,display_order,created_at,modified_at) VALUES(?,?,?,?,?)",
        ["category", "Friends", 0, NOW, NOW],
      )
    ).lastInsertRowId;
    await exec.runAsync("UPDATE contacts SET category_id=? WHERE id=?", [
      categoryId,
      contactId,
    ]);
    const layoutJson = JSON.stringify(FACTORY_PROFILE_LAYOUT);
    for (const [uid, name] of [
      ["global-layout", "Global layout"],
      ["category-layout", "Category layout"],
      ["contact-layout", "Contact layout"],
    ]) {
      await exec.runAsync(
        "INSERT INTO profile_layout_templates(uid,name,layout_json,created_at,modified_at) VALUES(?,?,?,?,?)",
        [uid, name, layoutJson, NOW, NOW],
      );
    }
    for (const [uid, name] of [
      ["global-bg", "Global background"],
      ["category-bg", "Category background"],
      ["contact-bg", "Contact background"],
    ]) {
      await exec.runAsync(
        "INSERT INTO profile_background_templates(uid,name,image_path,created_at,modified_at) VALUES(?,?,?,?,?)",
        [uid, name, `profile-backgrounds/${uid}.webp`, NOW, NOW],
      );
    }
    await exec.runAsync(
      "UPDATE app_settings SET profile_layout_template_uid=?,profile_background_template_uid=? WHERE id=1",
      ["global-layout", "global-bg"],
    );
    await exec.runAsync(
      "INSERT INTO profile_category_presentation(category_id,layout_template_uid,background_template_uid,created_at,modified_at) VALUES(?,?,?,?,?)",
      [categoryId, "category-layout", "category-bg", NOW, NOW],
    );
    await exec.runAsync(
      "INSERT INTO profile_contact_presentation(contact_id,layout_template_uid,background_template_uid,collapse_json,created_at,modified_at) VALUES(?,?,?,?,?,?)",
      [contactId, "contact-layout", "contact-bg", "{}", NOW, NOW],
    );

    const input = await readProfilePresentationInputs(exec, contactId, {
      factoryLayout: FACTORY_PROFILE_LAYOUT,
      themeBackground: "theme:galaxy",
    });
    expect(input).toMatchObject({
      global: {
        layoutTemplateUid: "global-layout",
        backgroundTemplateUid: "global-bg",
      },
      category: {
        layoutTemplateUid: "category-layout",
        backgroundTemplateUid: "category-bg",
      },
      contact: {
        layoutTemplateUid: "contact-layout",
        backgroundTemplateUid: "contact-bg",
      },
    });
    expect(resolveProfilePresentation(input)).toMatchObject({
      layout: { source: "contact-template" },
      background: { source: "contact" },
    });
    expect(await listProfileLayoutTemplates(exec)).toHaveLength(3);
    expect(await listProfileBackgroundTemplates(exec)).toHaveLength(3);
  });

  it("reports usage by scope and never counts freeform layouts as templates", async () => {
    const categoryId = (
      await exec.runAsync(
        "INSERT INTO categories(uid,name,display_order,created_at,modified_at) VALUES(?,?,?,?,?)",
        ["category", "Friends", 0, NOW, NOW],
      )
    ).lastInsertRowId;
    const layoutJson = JSON.stringify(FACTORY_PROFILE_LAYOUT);
    await exec.runAsync(
      "INSERT INTO profile_layout_templates(uid,name,layout_json,created_at,modified_at) VALUES(?,?,?,?,?)",
      ["layout", "Layout", layoutJson, NOW, NOW],
    );
    await exec.runAsync(
      "UPDATE app_settings SET profile_layout_template_uid=? WHERE id=1",
      ["layout"],
    );
    await exec.runAsync(
      "INSERT INTO profile_category_presentation(category_id,layout_template_uid,created_at,modified_at) VALUES(?,?,?,?)",
      [categoryId, "layout", NOW, NOW],
    );
    await exec.runAsync(
      "INSERT INTO profile_contact_presentation(contact_id,freeform_layout_json,collapse_json,created_at,modified_at) VALUES(?,?,?,?,?)",
      [contactId, layoutJson, "{}", NOW, NOW],
    );
    expect(await countProfileTemplateUsage(exec, "layout", "layout")).toEqual({
      global: 1,
      categories: 1,
      contacts: 0,
      total: 2,
    });
  });
});
