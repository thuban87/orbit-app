import { describe, expect, it } from "vitest";
import { profileLayoutEditorReducer } from "./layout-editor-reducer";
import { createLayoutTemplateIntent } from "./layout-editor-session";
import { FACTORY_PROFILE_LAYOUT } from "./presentation-schema";
import {
  beginTemplateOperation,
  createTemplateManagerState,
  describeTemplateAssignment,
  managerBackIntent,
  openTemplateManagerPage,
  retainTemplateFailure,
  setTemplateDraft,
  setTemplateUsage,
  settleTemplateOperation,
  templateLayoutForNewTemplate,
} from "./template-manager-model";

describe("Profile template manager model", () => {
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

  it("keeps inherited and contact override assignment states distinct", () => {
    expect(
      describeTemplateAssignment({
        source: "category",
        templateName: "Friends",
      }),
    ).toEqual({
      kind: "inherited",
      text: "Inherited from Category template Friends",
    });
    expect(
      describeTemplateAssignment({
        source: "contact-template",
        templateName: "Weekend",
      }),
    ).toEqual({ kind: "override", text: "Contact override: Weekend" });
    expect(
      describeTemplateAssignment({
        source: "contact-freeform",
        templateName: null,
      }),
    ).toEqual({
      kind: "override",
      text: "Contact override: freeform layout",
    });
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
