import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import {
  assignCategoryProfilePresentation,
  assignContactBackgroundTemplate,
  assignContactLayoutTemplate,
  assignGlobalProfilePresentation,
  createProfileBackgroundTemplate,
  createProfileLayoutTemplate,
  deleteProfileBackgroundTemplate,
  deleteProfileLayoutTemplate,
  readProfileCollapseOverride,
  resetProfilePresentation,
  setContactFreeformLayout,
  setProfileCollapseOverride,
  updateProfileLayoutTemplate,
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

describe("Profile presentation mutation API", () => {
  it("creates, edits, and assigns templates atomically with one revision per public write", async () => {
    const before = (
      await exec.getFirstAsync<{ data_revision: number }>(
        "SELECT data_revision FROM app_settings WHERE id=1",
      )
    )!.data_revision;
    await createProfileLayoutTemplate(exec, {
      uid: "layout",
      name: "Close Friends",
      layout: FACTORY_PROFILE_LAYOUT,
      now: NOW,
    });
    expect(
      (
        await exec.getFirstAsync<{ data_revision: number }>(
          "SELECT data_revision FROM app_settings WHERE id=1",
        )
      )!.data_revision,
    ).toBe(before + 1);
    await expect(
      createProfileLayoutTemplate(exec, {
        uid: "layout-2",
        name: "close friends",
        layout: FACTORY_PROFILE_LAYOUT,
        now: NOW,
      }),
    ).rejects.toThrow();
    expect(await listProfileLayoutTemplates(exec)).toHaveLength(1);

    await assignGlobalProfilePresentation(exec, {
      layoutTemplateUid: "layout",
      backgroundTemplateUid: null,
      now: NOW,
    });
    await updateProfileLayoutTemplate(exec, {
      uid: "layout",
      name: "Close Friends",
      layout: {
        ...FACTORY_PROFILE_LAYOUT,
        topLevel: FACTORY_PROFILE_LAYOUT.topLevel.map((item) => ({
          ...item,
          visible: false,
        })),
      },
      now: NOW,
    });
    const input = await readProfilePresentationInputs(exec, contactId, {
      factoryLayout: FACTORY_PROFILE_LAYOUT,
      themeBackground: "theme:galaxy",
    });
    expect(resolveProfilePresentation(input).layout.document.topLevel[0]?.visible).toBe(false);
  });

  it("clears collapse on an explicit layout switch and reset deletes only contact presentation", async () => {
    await createProfileLayoutTemplate(exec, {
      uid: "layout",
      name: "Layout",
      layout: FACTORY_PROFILE_LAYOUT,
      now: NOW,
    });
    await setProfileCollapseOverride(exec, {
      contactId,
      moduleId: "relationship-overview",
      expanded: false,
      now: NOW,
    });
    await assignContactLayoutTemplate(exec, {
      contactId,
      templateUid: "layout",
      now: NOW,
    });
    expect(await readProfileCollapseOverride(exec, contactId)).toEqual({});
    await exec.runAsync(
      "UPDATE contacts SET favourite_rank=1,snooze_until='2026-09-20' WHERE id=?",
      [contactId],
    );
    await resetProfilePresentation(exec, contactId, NOW);
    expect(
      await exec.getFirstAsync(
        "SELECT favourite_rank,snooze_until FROM contacts WHERE id=?",
        [contactId],
      ),
    ).toEqual({ favourite_rank: 1, snooze_until: "2026-09-20" });
    expect(
      await exec.getFirstAsync(
        "SELECT contact_id FROM profile_contact_presentation WHERE contact_id=?",
        [contactId],
      ),
    ).toBeNull();
  });

  it("assigns a selected second contact only a layout-template override", async () => {
    const categoryId = (
      await exec.runAsync(
        "INSERT INTO categories(uid,name,display_order,created_at,modified_at) VALUES(?,?,?,?,?)",
        ["friends", "Friends", 0, NOW, NOW],
      )
    ).lastInsertRowId;
    const selectedContactId = (
      await exec.runAsync(
        "INSERT INTO contacts(uid,name,category_id,interval_days,tracking_enabled,created_at,modified_at) VALUES(?,?,?,?,?,?,?)",
        ["selected", "Selected Contact", categoryId, 14, 1, NOW, NOW],
      )
    ).lastInsertRowId;
    await createProfileLayoutTemplate(exec, {
      uid: "selected-layout",
      name: "Selected layout",
      layout: FACTORY_PROFILE_LAYOUT,
      now: NOW,
    });
    await createProfileBackgroundTemplate(exec, {
      uid: "selected-background",
      name: "Selected background",
      imagePath: "profile-backgrounds/selected.webp",
      now: NOW,
    });
    await assignContactBackgroundTemplate(exec, {
      contactId: selectedContactId,
      templateUid: "selected-background",
      now: NOW,
    });
    await setProfileCollapseOverride(exec, {
      contactId: selectedContactId,
      moduleId: "relationship-overview",
      expanded: false,
      now: NOW,
    });

    await assignContactLayoutTemplate(exec, {
      contactId: selectedContactId,
      templateUid: "selected-layout",
      now: NOW,
    });

    expect(
      await exec.getFirstAsync(
        "SELECT category_id,interval_days,tracking_enabled FROM contacts WHERE id=?",
        [selectedContactId],
      ),
    ).toEqual({
      category_id: categoryId,
      interval_days: 14,
      tracking_enabled: 1,
    });
    expect(
      await exec.getFirstAsync(
        "SELECT layout_template_uid,background_template_uid,collapse_json FROM profile_contact_presentation WHERE contact_id=?",
        [selectedContactId],
      ),
    ).toEqual({
      layout_template_uid: "selected-layout",
      background_template_uid: "selected-background",
      collapse_json: "{}",
    });
  });

  it("clears each background scope through fresh reads without changing its sibling presentation data", async () => {
    const categoryId = (
      await exec.runAsync(
        "INSERT INTO categories(uid,name,display_order,created_at,modified_at) VALUES(?,?,?,?,?)",
        ["clear-category", "Clear Category", 0, NOW, NOW],
      )
    ).lastInsertRowId;
    await exec.runAsync("UPDATE contacts SET category_id=? WHERE id=?", [
      categoryId,
      contactId,
    ]);
    for (const [uid, name] of [
      ["clear-global-layout", "Clear global layout"],
      ["clear-category-layout", "Clear category layout"],
    ]) {
      await createProfileLayoutTemplate(exec, {
        uid,
        name,
        layout: FACTORY_PROFILE_LAYOUT,
        now: NOW,
      });
    }
    for (const [uid, name] of [
      ["clear-global-background", "Clear global background"],
      ["clear-category-background", "Clear category background"],
      ["clear-contact-background", "Clear contact background"],
    ]) {
      await createProfileBackgroundTemplate(exec, {
        uid,
        name,
        imagePath: `profile-backgrounds/${uid}.webp`,
        now: NOW,
      });
    }

    await assignGlobalProfilePresentation(exec, {
      layoutTemplateUid: "clear-global-layout",
      backgroundTemplateUid: "clear-global-background",
      now: NOW,
    });
    await assignCategoryProfilePresentation(exec, {
      categoryId,
      layoutTemplateUid: "clear-category-layout",
      backgroundTemplateUid: "clear-category-background",
      now: NOW,
    });
    await setContactFreeformLayout(exec, {
      contactId,
      layout: FACTORY_PROFILE_LAYOUT,
      now: NOW,
    });
    await setProfileCollapseOverride(exec, {
      contactId,
      moduleId: "relationship-overview",
      expanded: false,
      now: NOW,
    });
    await assignContactBackgroundTemplate(exec, {
      contactId,
      templateUid: "clear-contact-background",
      now: NOW,
    });

    await assignContactBackgroundTemplate(exec, {
      contactId,
      templateUid: null,
      now: NOW,
    });
    let input = await readProfilePresentationInputs(exec, contactId, {
      factoryLayout: FACTORY_PROFILE_LAYOUT,
      themeBackground: "theme:galaxy",
    });
    expect(resolveProfilePresentation(input)).toMatchObject({
      background: { source: "category", templateUid: "clear-category-background" },
      layout: { source: "contact-freeform" },
      collapse: { "relationship-overview": false },
    });

    await assignCategoryProfilePresentation(exec, {
      categoryId,
      layoutTemplateUid: "clear-category-layout",
      backgroundTemplateUid: null,
      now: NOW,
    });
    input = await readProfilePresentationInputs(exec, contactId, {
      factoryLayout: FACTORY_PROFILE_LAYOUT,
      themeBackground: "theme:galaxy",
    });
    expect(input.category).toEqual({
      layoutTemplateUid: "clear-category-layout",
      backgroundTemplateUid: null,
    });
    expect(resolveProfilePresentation(input)).toMatchObject({
      background: { source: "global", templateUid: "clear-global-background" },
      layout: { source: "contact-freeform" },
      collapse: { "relationship-overview": false },
    });

    await assignGlobalProfilePresentation(exec, {
      layoutTemplateUid: "clear-global-layout",
      backgroundTemplateUid: null,
      now: NOW,
    });
    input = await readProfilePresentationInputs(exec, contactId, {
      factoryLayout: FACTORY_PROFILE_LAYOUT,
      themeBackground: "theme:galaxy",
    });
    expect(input.global).toEqual({
      layoutTemplateUid: "clear-global-layout",
      backgroundTemplateUid: null,
    });
    expect(resolveProfilePresentation(input)).toMatchObject({
      background: { source: "theme", imagePath: "theme:galaxy" },
      layout: { source: "contact-freeform" },
      collapse: { "relationship-overview": false },
    });
  });

  it("deletes in-use templates with per-axis fallout while preserving freeform and safe image cleanup", async () => {
    await createProfileLayoutTemplate(exec, {
      uid: "layout",
      name: "Layout",
      layout: FACTORY_PROFILE_LAYOUT,
      now: NOW,
    });
    await assignContactLayoutTemplate(exec, {
      contactId,
      templateUid: "layout",
      now: NOW,
    });
    await deleteProfileLayoutTemplate(exec, "layout", NOW);
    expect(
      await exec.getFirstAsync<{ layout_template_uid: string | null }>(
        "SELECT layout_template_uid FROM profile_contact_presentation WHERE contact_id=?",
        [contactId],
      ),
    ).toEqual({ layout_template_uid: null });

    await setContactFreeformLayout(exec, {
      contactId,
      layout: FACTORY_PROFILE_LAYOUT,
      now: NOW,
    });
    for (const uid of ["background-a", "background-b"]) {
      await createProfileBackgroundTemplate(exec, {
        uid,
        name: uid,
        imagePath: "profile-backgrounds/shared.webp",
        now: NOW,
      });
    }
    await assignContactBackgroundTemplate(exec, {
      contactId,
      templateUid: "background-a",
      now: NOW,
    });
    expect(await deleteProfileBackgroundTemplate(exec, "background-a", NOW)).toBeNull();
    expect(await deleteProfileBackgroundTemplate(exec, "background-b", NOW)).toBe(
      "profile-backgrounds/shared.webp",
    );
    expect(
      await exec.getFirstAsync<{ freeform_layout_json: string | null }>(
        "SELECT freeform_layout_json FROM profile_contact_presentation WHERE contact_id=?",
        [contactId],
      ),
    ).toEqual({ freeform_layout_json: JSON.stringify(FACTORY_PROFILE_LAYOUT) });
  });

  it("removes Category assignments after same-transaction FK-safe Category deletion", async () => {
    const categoryId = (
      await exec.runAsync(
        "INSERT INTO categories(uid,name,display_order,created_at,modified_at) VALUES(?,?,?,?,?)",
        ["category", "Friends", 0, NOW, NOW],
      )
    ).lastInsertRowId;
    await exec.runAsync("UPDATE contacts SET category_id=? WHERE id=?", [categoryId, contactId]);
    await assignCategoryProfilePresentation(exec, {
      categoryId,
      layoutTemplateUid: null,
      backgroundTemplateUid: null,
      now: NOW,
    });
    await exec.execAsync("BEGIN");
    await exec.runAsync("UPDATE contacts SET category_id=NULL WHERE category_id=?", [categoryId]);
    await exec.runAsync("DELETE FROM categories WHERE id=?", [categoryId]);
    await exec.execAsync("COMMIT");
    expect(
      await exec.getFirstAsync(
        "SELECT category_id FROM profile_category_presentation WHERE category_id=?",
        [categoryId],
      ),
    ).toBeNull();
  });
});
