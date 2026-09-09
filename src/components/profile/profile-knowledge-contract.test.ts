import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PROFILE_THINGS_TO_REMEMBER_MODULE_IDS } from "@/profile/persisted-contract";

const thingsSource = () =>
  readFileSync(new URL("./ThingsToRemember.tsx", import.meta.url), "utf8");
const hostSource = () =>
  readFileSync(new URL("./ProfileModuleHost.tsx", import.meta.url), "utf8");

describe("Profile knowledge component contracts", () => {
  it("registers every semantic Things to Remember child through one renderer", () => {
    const source = thingsSource();
    for (const id of PROFILE_THINGS_TO_REMEMBER_MODULE_IDS) {
      expect(source).toContain(`case "${id}"`);
    }
    expect(source).toContain("buildKnowledgePresentation");
    expect(source).toContain("View all");
    expect(source).toContain("Show hidden");
  });

  it("keeps card management accessible outside long press and exposes detail/history sheets", () => {
    const source = thingsSource();
    expect(source).toContain("onLongPress");
    expect(source).toContain("accessibilityActions");
    expect(source).toContain("Manage");
    expect(source).toContain("Sheet");
    expect(source).toContain("View history");
    expect(source).not.toContain('role="destructive"');
  });

  it("registers Things to Remember and full contact-method rows in the module host", () => {
    const source = hostSource();
    expect(source).toContain("<ThingsToRemember");
    expect(source).toContain("Call");
    expect(source).toContain("Message");
    expect(source).toContain("Email");
    expect(source).toContain("disabled={method.is_actionable !== 1}");
  });
});
