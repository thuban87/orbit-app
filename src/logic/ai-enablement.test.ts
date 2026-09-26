import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AiProviderId } from "@/services/ai-types";
import { isAiMasterEnabled } from "./ai-enablement";

/** A settings read carrying both the master and the stale legacy field. */
function settings(aiEnabled: 0 | 1, aiProvider: AiProviderId) {
  return { aiEnabled, aiProvider };
}

/**
 * RG-008 / architecture/AUD-ARCH-003 / react-native/AUD-RN-005 (D-17): the
 * canonical AI master is `settings.aiEnabled === 1` (ADR-135). The legacy
 * `aiProvider` field is a retained compatibility field and must never decide
 * whether AI is available.
 */
describe("isAiMasterEnabled", () => {
  it("is true when the master is on even though the legacy provider reads none", () => {
    expect(isAiMasterEnabled(settings(1, "none"))).toBe(true);
  });

  it("is false when the master is off even though a legacy provider is set", () => {
    expect(isAiMasterEnabled(settings(0, "openai"))).toBe(false);
  });

  it("is true when the master is on and a legacy provider is set", () => {
    expect(isAiMasterEnabled(settings(1, "openai"))).toBe(true);
  });

  it("is false when the master is off and the legacy provider reads none", () => {
    expect(isAiMasterEnabled(settings(0, "none"))).toBe(false);
  });
});

describe("Memory hosts derive AI availability from the canonical master", () => {
  const HOSTS = [
    "src/screens/MemoryScreen.tsx",
    "src/screens/ThingsToRememberScreen.tsx",
    "src/screens/EditContactScreen.tsx",
    "src/components/PostLogNoteEditor.tsx",
  ] as const;

  for (const host of HOSTS) {
    it(`${host} uses isAiMasterEnabled and not the retired provider comparison`, () => {
      const source = readFileSync(join(process.cwd(), host), "utf8");
      expect(source).not.toMatch(/aiProvider\s*!==\s*["']none["']/);
      expect(source).not.toMatch(/aiProvider\s*===\s*["']none["']/);
      expect(source).toContain("isAiMasterEnabled(");
    });
  }
});
