import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (name: string) =>
  readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

describe("shared Profile layout-template library contract", () => {
  it("exposes the canonical library from every layout chooser", () => {
    const editor = source("ProfileLayoutEditor.tsx");
    const profile = readFileSync(
      new URL("../../screens/ContactProfileScreen.tsx", import.meta.url),
      "utf8",
    );

    expect(editor).toContain("onManageTemplates?: () => void");
    expect(editor).toContain('label="Layout templates"');
    expect(profile).toContain(
      'onManageTemplates={() => setOverlay("templates")}',
    );
  });

  it("uses the canonical local picker to assign an explicit non-archived contact override", () => {
    const manager = source("ProfileTemplateManager.tsx");
    const picker = readFileSync(
      new URL("../ContactPicker.tsx", import.meta.url),
      "utf8",
    );

    expect(manager).toContain('label="Choose individual contact"');
    expect(manager).toContain("<ContactPicker");
    expect(manager).toContain("allowArchivedSearch={false}");
    expect(manager).toContain('assign("contact", selectedContactId)');
    expect(manager).toContain("contactId: targetContactId");
    expect(picker).toContain("allowArchivedSearch?: boolean");
  });

  it("offers a truthful retry for a failed template-list read and clears it before retrying", () => {
    const manager = source("ProfileTemplateManager.tsx");

    expect(manager).toContain("beginTemplateManagerListLoad()");
    expect(manager).toContain("finishTemplateManagerListLoad(null)");
    expect(manager).toContain('label="Retry"');
    expect(manager).toContain("onPress={() => void loadList()}");
  });
});

/**
 * 38.11 D-43: the templates sheet header uses the 38.9 header Back, an
 * icon-only chevron labelled "Back" placed before the heading, not a text
 * "Back" button.
 */
describe("Profile layout templates sheet header (D-43)", () => {
  it("uses the icon-only Back chevron before the heading", () => {
    const manager = source("ProfileTemplateManager.tsx");
    expect(manager).not.toContain('label="Back"');
    const back = manager.indexOf('icon="back"');
    expect(back).toBeGreaterThan(-1);
    const button = manager.slice(manager.lastIndexOf("<Button", back), back);
    expect(button).toContain('role="iconOnly"');
    const close = manager.indexOf("/>", back);
    expect(manager.slice(back, close)).toContain('accessibilityLabel="Back"');
    expect(manager.slice(back, close)).toContain("onPress={closeOrBack}");
    expect(back).toBeLessThan(manager.indexOf("Profile layout templates"));
  });
});

/**
 * 38.12 D-90: a successful new-template save returns the manager to its list
 * (or the new template's assignment page) through `finishTemplateCreate`, so
 * the create form is never left empty but open, and shows a success snackbar
 * naming the template. The page logic is unit-tested in
 * `template-manager-model.test.ts`.
 */
describe("saving a new layout template (38.12 D-90)", () => {
  const manager = source("ProfileTemplateManager.tsx");
  const save = manager.slice(
    manager.indexOf("const saveNewTemplate"),
    manager.indexOf("const openUsage"),
  );

  it("returns to the list through finishTemplateCreate after a durable save", () => {
    expect(save).toContain("if (saved) {");
    expect(save).toContain(
      "finishTemplateCreate(current, assignCreatedTemplate ? uid : null)",
    );
    // The old path cleared the draft but left the create page on top.
    expect(save).not.toContain("clearTemplateDraft(current)");
  });

  it("shows a success snackbar naming the template, only after the save", () => {
    const saved = save.indexOf("if (saved) {");
    const snackbar = save.indexOf("showSnackbar({");
    expect(snackbar).toBeGreaterThan(saved);
    expect(save).toContain('kind: "success"');
    expect(save).toContain("label: templateSavedSnackbar(draft.name)");
  });
});
