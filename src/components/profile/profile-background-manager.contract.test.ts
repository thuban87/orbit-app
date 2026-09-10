import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ProfileBackgroundManager crop workspace contract", () => {
  it("uses the measured crop workspace for the contained source and full gesture surface", () => {
    const source = readFileSync(
      resolve(__dirname, "ProfileBackgroundManager.tsx"),
      "utf8",
    );

    expect(source).toContain('cropTouchSurface: { flex: 1, width: "100%" }');
    expect(source).toContain("cropSpace.width / source.width");
    expect(source).toContain(
      "(cropSpace.width - source.width * scale) / 2",
    );
    expect(source).not.toContain("viewportWidth / source.width");
  });

  it("keeps global/category clear and contact inheritance reachable without a selected template", () => {
    const source = readFileSync(
      resolve(__dirname, "ProfileBackgroundManager.tsx"),
      "utf8",
    );

    expect(source).toContain('label="Clear global background"');
    expect(source).toContain("Clear ${category.name} background");
    expect(source).toContain(
      "Inherit Category, global, or theme background for ${contactName}",
    );
    expect(source).toContain('scope === "clear-global" ? null : selectedUid');
    expect(source).toContain('scope === "clear-category" ? null : selectedUid');
    expect(source).toContain('scope === "inherit" ? null : selectedUid');
  });

  it("returns a clean reopened manager to the list before exposing assignment controls", () => {
    const source = readFileSync(
      resolve(__dirname, "ProfileBackgroundManager.tsx"),
      "utf8",
    );

    expect(source).toContain("const opening = !wasVisibleRef.current");
    expect(source).toContain("shouldResetBackgroundManagerViewOnOpen(managerState)");
    expect(source).toContain('setPage("list")');
    expect(source).toContain("setSelectedUid(null)");
  });
});
