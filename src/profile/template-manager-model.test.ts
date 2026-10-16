import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { profileLayoutEditorReducer } from "./layout-editor-reducer";
import { createLayoutTemplateIntent } from "./layout-editor-session";
import { FACTORY_PROFILE_LAYOUT } from "./presentation-schema";
import { completeProfileLayoutChildren } from "./resolve-presentation";
import {
  beginTemplateManagerListLoad,
  beginTemplateOperation,
  createTemplateManagerListLoadState,
  createTemplateManagerState,
  describeCurrentLayout,
  effectiveLayoutTemplateUid,
  finishTemplateManagerListLoad,
  managerBackIntent,
  openTemplateManagerPage,
  type ProfileLayoutSource,
  retainTemplateFailure,
  setTemplateDraft,
  setTemplateUsage,
  settleTemplateOperation,
  templateLayoutForDisplay,
  templateLayoutForNewTemplate,
  templatePreviewLines,
} from "./template-manager-model";

describe("Profile template manager model", () => {
  it("clears a failed list read before a successful retry publishes fresh templates", () => {
    const failed = finishTemplateManagerListLoad(
      "Couldn't load layout templates. Try again.",
    );
    expect(failed).toEqual({
      loading: false,
      error: "Couldn't load layout templates. Try again.",
    });
    expect(beginTemplateManagerListLoad()).toEqual({
      loading: true,
      error: null,
    });
    expect(finishTemplateManagerListLoad(null)).toEqual(
      createTemplateManagerListLoadState(),
    );
  });

  it("uses an internal page stack before dirty guarding or dismissing the sheet", () => {
    const initial = createTemplateManagerState();
    const edit = openTemplateManagerPage(initial, {
      kind: "edit",
      templateUid: "weekday",
    });
    expect(managerBackIntent(edit)).toEqual({ kind: "pop-page" });

    const dirty = setTemplateDraft(initial, {
      name: "Weekdays",
      layout: { version: 1 },
    });
    expect(managerBackIntent(dirty)).toEqual({ kind: "confirm-discard" });
    expect(managerBackIntent(initial)).toEqual({ kind: "close-sheet" });
  });

  it("gates concurrent object operations and retains drafts on a recoverable failure", () => {
    const initial = setTemplateDraft(createTemplateManagerState(), {
      name: "Family",
      layout: { version: 1 },
    });
    const pending = beginTemplateOperation(initial, "family");
    expect(pending.accepted).toBe(true);
    expect(beginTemplateOperation(pending.state, "family").accepted).toBe(
      false,
    );

    const failed = retainTemplateFailure(
      pending.state,
      "family",
      "Couldn't save this template. Try again.",
    );
    expect(failed.draft).toEqual(initial.draft);
    expect(failed.error).toBe("Couldn't save this template. Try again.");
    expect(failed.pendingTemplateUids).toEqual([]);
    expect(
      settleTemplateOperation(failed, "family").pendingTemplateUids,
    ).toEqual([]);
  });

  it("marks stale usage explicitly until a refreshed count is published", () => {
    const stale = setTemplateUsage(createTemplateManagerState(), "weekday", {
      global: 1,
      categories: 2,
      contacts: 3,
      total: 6,
    });
    expect(stale.usage.weekday).toMatchObject({ stale: false, total: 6 });
    const pending = beginTemplateOperation(stale, "weekday").state;
    expect(pending.usage.weekday).toMatchObject({ stale: true, total: 6 });
  });

  it("the Assign page names the current layout in plain words, from live props (38.11-14 L4)", () => {
    const manager = readFileSync(
      new URL(
        "../components/profile/ProfileTemplateManager.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    const assignPage = manager.slice(
      manager.indexOf('activePage.kind === "assignment"'),
    );
    expect(assignPage).toContain(
      "{contactName} currently uses {currentLayout}.",
    );
    // The retired two-line wording ("Set for this contact: freeform layout",
    // "This contact currently has its own layout.") is gone.
    expect(manager).not.toContain('freeform layout"');
    expect(manager).not.toContain("currently has its own layout");
    expect(manager).not.toContain("assignmentDescription");
    expect(describeCurrentLayout("contact-freeform", null)).toBe(
      "their own layout",
    );
    expect(describeCurrentLayout("contact-template", "Weekend")).toBe(
      "the Weekend template",
    );
  });

  it("carries an edited unsaved layout into template creation without a freeform fallback", () => {
    const edited = profileLayoutEditorReducer(FACTORY_PROFILE_LAYOUT, {
      type: "move",
      id: "interaction-history",
      direction: "up",
    });
    const pendingTemplateLayout = createLayoutTemplateIntent(edited);
    const layout = templateLayoutForNewTemplate({
      pendingTemplateLayout,
      freeformLayout: null,
    });

    expect(layout).toEqual(edited);
    expect(layout?.topLevel.map((item) => item.id)).toEqual([
      "relationship-overview",
      "things-to-remember",
      "interaction-history",
      "contact-methods",
    ]);
    expect(layout?.topLevel.every((item) => !item.expanded)).toBe(true);
    expect(
      templateLayoutForNewTemplate({
        pendingTemplateLayout: null,
        freeformLayout: null,
      }),
    ).toBeNull();
  });
});

// 38.11-13 Task 4 (38.11-05 deferred item): the "currently uses" line names
// the layout in plain words, never a raw source id like "contact-freeform".
describe("describeCurrentLayout (38.11-13)", () => {
  const SOURCES: readonly ProfileLayoutSource[] = [
    "contact-template",
    "contact-freeform",
    "category",
    "global",
    "factory",
  ];

  it("maps every source to plain words with no internal id", () => {
    for (const source of SOURCES) {
      for (const name of [null, "Work"]) {
        const text = describeCurrentLayout(source, name);
        expect(text.length).toBeGreaterThan(0);
        expect(text).not.toContain(source);
        // No hyphenated internal id (contact-freeform, contact-template …).
        expect(text).not.toMatch(/[a-z]+-[a-z]+/);
      }
    }
  });

  it("uses the words the plan names, and the template name when known", () => {
    expect(describeCurrentLayout("contact-freeform", null)).toBe(
      "their own layout",
    );
    expect(describeCurrentLayout("factory", null)).toBe("the default layout");
    expect(describeCurrentLayout("contact-template", null)).toBe(
      "a layout template",
    );
    expect(describeCurrentLayout("contact-template", "Work")).toBe(
      "the Work template",
    );
    expect(describeCurrentLayout("category", "Family")).toBe(
      "the Family template from their Category",
    );
    expect(describeCurrentLayout("category", null)).toBe(
      "their Category's layout template",
    );
    expect(describeCurrentLayout("global", "Simple")).toBe(
      "the Simple template set for all Profiles",
    );
    expect(describeCurrentLayout("global", null)).toBe(
      "the layout template set for all Profiles",
    );
  });

  it("finds the uid of the template a source resolved from", () => {
    const inputs = {
      contact: {
        layoutTemplateUid: "c",
        backgroundTemplateUid: null,
        freeformLayout: null,
        collapse: {},
      },
      category: { layoutTemplateUid: "k", backgroundTemplateUid: null },
      global: { layoutTemplateUid: "g", backgroundTemplateUid: null },
    } as Parameters<typeof effectiveLayoutTemplateUid>[1];
    expect(effectiveLayoutTemplateUid("contact-template", inputs)).toBe("c");
    expect(effectiveLayoutTemplateUid("category", inputs)).toBe("k");
    expect(effectiveLayoutTemplateUid("global", inputs)).toBe("g");
    expect(effectiveLayoutTemplateUid("contact-freeform", inputs)).toBeNull();
    expect(effectiveLayoutTemplateUid("factory", inputs)).toBeNull();
    expect(
      effectiveLayoutTemplateUid("category", { ...inputs, category: null }),
    ).toBeNull();
  });
});

// 38.11-13 Task 4 (38.11-08 deferred item): a template saved before 38.11
// lacks the Birthday tile; its display completes it at read time only.
describe("templateLayoutForDisplay (38.11-13)", () => {
  const withoutBirthday = {
    ...FACTORY_PROFILE_LAYOUT,
    overview: FACTORY_PROFILE_LAYOUT.overview.filter(
      (placement) => placement.id !== "birthday",
    ),
  };

  it("previews a pre-38.11 template with Birthday in its default position", () => {
    const stored = JSON.stringify(withoutBirthday);
    const layout = templateLayoutForDisplay(stored);
    const ids = layout.overview.map((placement) => placement.id);
    expect(ids).toEqual(
      FACTORY_PROFILE_LAYOUT.overview.map((placement) => placement.id),
    );
    expect(ids.indexOf("birthday")).toBe(ids.indexOf("contact-frequency") + 1);
    expect(layout).toEqual(
      completeProfileLayoutChildren(withoutBirthday as never),
    );
    // Read time only: the stored JSON is not rewritten.
    expect(JSON.parse(stored).overview).toHaveLength(
      withoutBirthday.overview.length,
    );
  });
});

describe("the layout sheets never show a raw source id (38.11-13)", () => {
  const read = (path: string) =>
    readFileSync(new URL(path, import.meta.url), "utf8");

  it("both 'currently uses' lines interpolate the plain-word phrase", () => {
    for (const path of [
      "../components/profile/ProfileLayoutEditor.tsx",
      "../components/profile/ProfileTemplateManager.tsx",
    ]) {
      const source = read(path);
      expect(source).toContain("currently uses {currentLayout}.");
      expect(source).not.toContain("effectiveSource");
    }
  });

  it("the Profile passes plain words to the editor and the raw source only as a discriminator", () => {
    const profile = read("../screens/ContactProfileScreen.tsx");
    expect(profile).toContain("currentLayout={describeCurrentLayout(");
    expect(profile).not.toContain("effectiveSource=");
    const manager = read("../components/profile/ProfileTemplateManager.tsx");
    // The template's name feeds the plain-words line (38.11-14 L4).
    expect(manager).toContain("currentTemplateName,\n  );");
    // Preview and template editing complete the layout; Rename stays raw.
    // The Preview reads labels through templatePreviewLines (review IN-08).
    expect(manager).toMatch(
      /templatePreviewLines\(\s*templateLayoutForDisplay\(template\.layoutJson\)/,
    );
    expect(manager).toContain(
      "layout: templateLayoutForDisplay(activeTemplate.layoutJson),",
    );
  });
});

/**
 * Review IN-08 (38.11-13 deferred item): the template Preview names each
 * visible module by its label, never its raw id, and drops the tile size.
 */
describe("templatePreviewLines (review IN-08)", () => {
  it("lists visible modules by label, in layout order, with no ids or sizes", () => {
    const layout = profileLayoutEditorReducer(FACTORY_PROFILE_LAYOUT, {
      type: "set-visible",
      id: "gravity",
      visible: false,
    });
    const lines = templatePreviewLines(layout);
    expect(lines.topLevel).toEqual([
      "Relationship Overview",
      "Things to Remember",
      "Contact Methods",
      "History",
    ]);
    expect(lines.overview).toEqual([
      "Orbit Status",
      "Intensity",
      "Last Interaction",
      "Contact Frequency",
      "Birthday",
      "Snooze",
    ]);
    expect(lines.thingsToRemember[0]).toBe("Pinned / Featured");
    const all = [
      ...lines.topLevel,
      ...lines.overview,
      ...lines.thingsToRemember,
    ].join(" ");
    expect(all).not.toMatch(/[a-z]+-[a-z]+|1x1|2x1/);
  });
});
