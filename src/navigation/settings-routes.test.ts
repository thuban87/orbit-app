import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SETTINGS_REGISTERED_ROUTES } from "./settings-routes";

/**
 * The phase-wide route-registration contract (cross-cutting review MEDIUM). A
 * type-only test over the erased `SettingsStackParamList` proves nothing — a
 * route typed-but-never-registered still type-checks. This reads
 * `SettingsStack.tsx` from disk and asserts every registered route name resolves
 * to a real `<Stack.Screen>`, and that the D-03 typed-but-unregistered
 * `CategoryManagement` reservation is NOT registered. Plans 02–08 extend
 * `SETTINGS_REGISTERED_ROUTES` and this test enforces the stack keeps pace.
 */
const STACK_SOURCE = readFileSync(
  join(process.cwd(), "src", "navigation", "tabs", "SettingsStack.tsx"),
  "utf8",
);

/** Whitespace-collapsed so multi-line `<Stack.Screen name="X" .../>` matches. */
const COLLAPSED = STACK_SOURCE.replace(/\s+/g, " ");

function isRegistered(routeName: string): boolean {
  return COLLAPSED.includes(`<Stack.Screen name="${routeName}"`);
}

describe("Settings route-registration contract", () => {
  it("registers a <Stack.Screen> for every SETTINGS_REGISTERED_ROUTES entry", () => {
    for (const routeName of SETTINGS_REGISTERED_ROUTES) {
      expect(
        isRegistered(routeName),
        `expected <Stack.Screen name="${routeName}"> in SettingsStack.tsx`,
      ).toBe(true);
    }
  });

  it("activates the reserved CategoryManagement destination", () => {
    expect(isRegistered("CategoryManagement")).toBe(true);
    expect(SETTINGS_REGISTERED_ROUTES).toContain("CategoryManagement");
  });
});
