import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SETTINGS_REGISTERED_ROUTES } from "./settings-routes";
import {
  PROFILE_REACHABLE_ROUTES,
  SETTINGS_HOST_EXCLUDED_PROFILE_ROUTES,
} from "./shell-contract";

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

/**
 * Settings hosts Profile (Settings → Archived → Profile, and a participant
 * Profile reached through a group event). Every route that Profile can offer
 * must therefore resolve here, or the action is a silent no-op in release
 * (RG-021, react-native/AUD-RN-004, D-24). The exception is messaging: Compose
 * and ComposeResearch stay unregistered under Settings (D-09, D-25) and the
 * Profile hero disables Message there instead.
 */
describe("Settings-hosted Profile route family", () => {
  const excluded: readonly string[] = SETTINGS_HOST_EXCLUDED_PROFILE_ROUTES;
  const hosted = PROFILE_REACHABLE_ROUTES.filter(
    (routeName) => !excluded.includes(routeName),
  );

  it.each(hosted)("registers Profile-reachable route %s", (routeName) => {
    expect(
      isRegistered(routeName),
      `expected <Stack.Screen name="${routeName}"> in SettingsStack.tsx`,
    ).toBe(true);
  });

  it("excludes exactly the messaging routes", () => {
    expect([...SETTINGS_HOST_EXCLUDED_PROFILE_ROUTES]).toEqual([
      "Compose",
      "ComposeResearch",
    ]);
  });

  it.each(SETTINGS_HOST_EXCLUDED_PROFILE_ROUTES)(
    "never registers messaging route %s under Settings",
    (routeName) => {
      expect(
        isRegistered(routeName),
        `<Stack.Screen name="${routeName}"> must not be registered in SettingsStack.tsx (D-09, D-25)`,
      ).toBe(false);
    },
  );
});

/**
 * 38.11 D-84 (owner, "One control"; amends 37 D-05 in part): Settings →
 * Appearance's existing "Default profile background" row opens the Profile
 * Backgrounds page instead of its own picker, no second row is added, and the
 * shared picker now serves the layout default only.
 */
describe("Appearance opens Profile Backgrounds (D-84)", () => {
  const appearance = readFileSync(
    join(process.cwd(), "src", "screens", "SettingsAppearanceScreen.tsx"),
    "utf8",
  ).replace(/\s+/g, " ");

  it("registers the page in Settings", () => {
    expect(SETTINGS_REGISTERED_ROUTES).toContain("ProfileBackgrounds");
    expect(isRegistered("ProfileBackgrounds")).toBe(true);
  });

  it("the existing background row navigates to the page", () => {
    const row = appearance.slice(
      appearance.indexOf('testID="settings-profile-default-background-row"'),
    );
    // 38.12 D-119: the row is a self-closing shared SettingsRow.
    const rowEnd = row.indexOf("/>");
    expect(rowEnd).toBeGreaterThan(0);
    const rowSource = row.slice(0, rowEnd);
    expect(rowSource).toContain('navigation.navigate("ProfileBackgrounds")');
    expect(rowSource).toContain("Default profile background");
    // 38.11-14 E4: unset reads "None", like the page it opens.
    expect(rowSource).toContain('?.name ?? "None"');
    expect(rowSource).not.toContain("Default / None");
  });

  it("adds no second Profile Backgrounds entry and the picker serves layout only", () => {
    expect(appearance.match(/navigate\("ProfileBackgrounds"\)/g)).toHaveLength(
      1,
    );
    expect(appearance).not.toContain('setOpenTemplatePicker("background")');
    expect(appearance).toContain('useState<"layout" | null>');
    expect(appearance).toContain(
      'testID="settings-profile-default-layout-row"',
    );
  });
});

/**
 * 38.12 D-97 (owner, Q-05): Settings → Contacts & Relationships → Contact
 * Management lists "Unbound contacts" beside "Bin", so the Unbound list is
 * registered in the Settings stack too (it was Contacts-stack only); the
 * Contacts ⋯ entry stays.
 */
describe("Unbound contacts in Settings (D-97)", () => {
  it("registers UnboundContacts in the Settings stack", () => {
    expect(isRegistered("UnboundContacts")).toBe(true);
  });

  it("keeps the Contacts-stack registration", () => {
    const dashboard = readFileSync(
      join(process.cwd(), "src", "navigation", "tabs", "DashboardStack.tsx"),
      "utf8",
    ).replace(/\s+/g, " ");
    expect(dashboard).toContain('<Stack.Screen name="UnboundContacts"');
  });
});
