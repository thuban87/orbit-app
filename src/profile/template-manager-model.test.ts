import { describe, expect, it } from "vitest";
import {
  beginTemplateOperation,
  createTemplateManagerState,
  managerBackIntent,
  openTemplateManagerPage,
  retainTemplateFailure,
  setTemplateDraft,
  setTemplateUsage,
  settleTemplateOperation,
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
});
