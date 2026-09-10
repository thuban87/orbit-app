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
    expect(profile).toContain('onManageTemplates={() => setOverlay("templates")}');
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
    expect(manager).toContain("assign(\"contact\", selectedContactId)");
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
