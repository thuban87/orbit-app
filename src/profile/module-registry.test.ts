import { describe, expect, it } from "vitest";
import {
  createProfileModuleRendererRegistry,
  PROFILE_MODULE_REGISTRY,
  PROFILE_MODULE_RENDERERS,
} from "./module-registry";
import type { ProfileModuleId } from "./persisted-contract";
import { PROFILE_MODULE_IDS } from "./persisted-contract";

describe("Profile module renderer registry", () => {
  it("has a closed renderer lookup for every semantic module ID", () => {
    expect(Object.keys(PROFILE_MODULE_REGISTRY)).toEqual(PROFILE_MODULE_IDS);
    expect(Object.keys(PROFILE_MODULE_RENDERERS)).toEqual(PROFILE_MODULE_IDS);
    for (const id of PROFILE_MODULE_IDS) {
      expect(PROFILE_MODULE_RENDERERS[id]).toBe(id);
    }
  });

  it("replaces History without changing its persisted semantic identity", () => {
    const replacement = Symbol("Phase 32 History renderer");
    const registry = createProfileModuleRendererRegistry(
      { ...PROFILE_MODULE_RENDERERS } as Record<
        ProfileModuleId,
        ProfileModuleId | symbol
      >,
      { history: replacement },
    );

    expect(registry["interaction-history"]).toBe(replacement);
    expect(PROFILE_MODULE_RENDERERS["interaction-history"]).toBe(
      "interaction-history",
    );
  });
});
