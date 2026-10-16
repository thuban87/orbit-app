import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TAB_ICON } from "@/components/icons/icon-registry";
import type { FabNavigateIntent } from "@/components/universal-fab-logic";
import { resolveNotificationNav } from "@/services/notifications/notification-nav";
import {
  DIGEST_STACK_ROUTES,
  EVENTS_STACK_ROUTES,
  FAB_ROUTES,
  INITIAL_TAB,
  PROFILE_REACHABLE_ROUTES,
  TAB_ORDER,
} from "./shell-contract";

describe("shell contract", () => {
  it("defines the permanent five-tab order with Digest as the initial tab", () => {
    expect(TAB_ORDER).toEqual([
      "DashboardTab",
      "EventsTab",
      "DigestTab",
      "OrreryTab",
      "SettingsTab",
    ]);
    expect(INITIAL_TAB).toBe("DigestTab");
    expect(TAB_ORDER).not.toContain("BackupTab");
  });

  it("keeps the runtime tab icon registry in parity with the shell", () => {
    expect(Object.keys(TAB_ICON).sort()).toEqual([...TAB_ORDER].sort());
  });

  it("routes Digest notifications to the Digest tab root", () => {
    expect(resolveNotificationNav({ kind: "digest" })).toEqual({
      type: "select-digest",
    });
  });

  it.each(PROFILE_REACHABLE_ROUTES)(
    "registers Profile-reachable route %s in both promoted stacks",
    (routeName) => {
      expect(DIGEST_STACK_ROUTES).toContain(routeName);
      expect(EVENTS_STACK_ROUTES).toContain(routeName);
    },
  );
});

/**
 * D-38: the + opens its forms over the tab the user is on, so every tab stack
 * registers every FAB_ROUTES entry (ADR-166 per-stack registration). Digest and
 * Events register from their route arrays; Dashboard, Orrery and Settings
 * register literal <Stack.Screen> elements, read from disk.
 */
function stackSource(file: string): string {
  return readFileSync(
    join(process.cwd(), "src", "navigation", "tabs", file),
    "utf8",
  ).replace(/\s+/g, " ");
}

const LITERAL_STACKS = [
  "DashboardStack.tsx",
  "OrreryStack.tsx",
  "SettingsStack.tsx",
] as const;

/**
 * Every Profile-reachable route resolves in the two literal Profile-hosting
 * stacks that have no route array (RG-021; 38.11 T-13). Digest and Events are
 * checked by the generic array test above, and Settings by
 * `settings-routes.test.ts` (minus its messaging exclusions), so with this
 * check all five hosts are asserted for every PROFILE_REACHABLE_ROUTES entry.
 */
describe("Profile-reachable routes in Dashboard and Orrery (RG-021)", () => {
  const profileHosts = LITERAL_STACKS.filter(
    (file) => file === "DashboardStack.tsx" || file === "OrreryStack.tsx",
  );

  it("checks both literal non-Settings stacks", () => {
    expect([...profileHosts]).toEqual([
      "DashboardStack.tsx",
      "OrreryStack.tsx",
    ]);
  });

  it.each(
    profileHosts.flatMap((file) =>
      PROFILE_REACHABLE_ROUTES.map((route) => [file, route] as const),
    ),
  )("%s registers Profile-reachable route %s", (file, route) => {
    expect(
      stackSource(file).includes(`<Stack.Screen name="${route}"`),
      `expected <Stack.Screen name="${route}"> in ${file}`,
    ).toBe(true);
  });
});

describe("+ forms over the current tab (D-38)", () => {
  it("lists exactly the + navigate targets", () => {
    // 38.11: Update Contact retired (D-62); Memory moved to
    // PROFILE_REACHABLE_ROUTES (D-66).
    expect([...FAB_ROUTES]).toEqual(["Create", "GroupLog", "LogContact"]);
  });
  // The retired Update Contact route (D-62) has no param-list key in
  // types.ts, so registering it in any stack fails `tsc --noEmit`.

  it.each(FAB_ROUTES)("registers + route %s in Digest and Events", (route) => {
    expect(DIGEST_STACK_ROUTES).toContain(route);
    expect(EVENTS_STACK_ROUTES).toContain(route);
  });

  it.each(
    LITERAL_STACKS.flatMap((file) =>
      FAB_ROUTES.map((route) => [file, route] as const),
    ),
  )("%s registers + route %s", (file, route) => {
    expect(
      stackSource(file).includes(`<Stack.Screen name="${route}"`),
      `expected <Stack.Screen name="${route}"> in ${file}`,
    ).toBe(true);
  });

  it("covers every + navigate target at the type level", () => {
    // A + screen added to the intent type without a FAB_ROUTES entry fails
    // `tsc --noEmit` here, so it cannot ship unregistered in some stack.
    type MissingFabRoute = Exclude<
      FabNavigateIntent["screen"],
      (typeof FAB_ROUTES)[number]
    >;
    const fabRoutesCoverIntents: [MissingFabRoute] extends [never]
      ? true
      : false = true;
    expect(fabRoutesCoverIntents).toBe(true);
  });
});

describe("the per-section memory editor route (38.10 D-75)", () => {
  it("is Profile-reachable and registered in Digest and Events", () => {
    expect(PROFILE_REACHABLE_ROUTES).toContain("SectionEditor");
    expect(DIGEST_STACK_ROUTES).toContain("SectionEditor");
    expect(EVENTS_STACK_ROUTES).toContain("SectionEditor");
  });

  it.each(LITERAL_STACKS)("%s registers SectionEditor", (file) => {
    expect(
      stackSource(file).includes(
        '<Stack.Screen name="SectionEditor" component={SectionEditorScreen} />',
      ),
    ).toBe(true);
  });
});

describe("the Key People and Off Limits editor routes (38.10 D-75, D-08, D-107)", () => {
  it("KeyPeopleEditor is Profile-reachable and registered in Digest and Events", () => {
    expect(PROFILE_REACHABLE_ROUTES).toContain("KeyPeopleEditor");
    expect(DIGEST_STACK_ROUTES).toContain("KeyPeopleEditor");
    expect(EVENTS_STACK_ROUTES).toContain("KeyPeopleEditor");
  });

  it.each(LITERAL_STACKS)("%s registers KeyPeopleEditor", (file) => {
    expect(
      stackSource(file).includes(
        '<Stack.Screen name="KeyPeopleEditor" component={KeyPeopleEditorScreen} />',
      ),
    ).toBe(true);
  });

  it("both editors take an optional editId in every param list", () => {
    const types = readFileSync(
      join(process.cwd(), "src", "navigation", "types.ts"),
      "utf8",
    );
    expect(
      types.match(
        /KeyPeopleEditor: \{ contactId: number; editId\?: number \};/g,
      ),
    ).toHaveLength(5);
    expect(
      types.match(
        /OffLimitsEditor: \{ contactId: number; editId\?: number \};/g,
      ),
    ).toHaveLength(5);
  });
});

/**
 * 38.11 D-66: Memory left the + but the Profile's add-memory heading actions
 * still navigate to it (contact-profile-logic `addMemory`), so it is
 * Profile-reachable, and the generic Profile-reachable checks (Digest/Events
 * above, Dashboard/Orrery above, Settings in `settings-routes.test.ts`) keep it
 * registered in all five stacks, or the add-memory buttons become silent
 * no-ops in release (RG-021).
 */
describe("the Memory add route stays registered in all five stacks (D-66)", () => {
  it("is Profile-reachable and not a + route", () => {
    expect(PROFILE_REACHABLE_ROUTES).toContain("Memory");
    expect(FAB_ROUTES as readonly string[]).not.toContain("Memory");
  });
});

/**
 * 38.11 D-58.1: the Profile's background sheet opens the Settings Profile
 * Backgrounds page from whichever tab hosts the Profile, so the page is
 * Profile-reachable (the generic checks then assert all five hosts).
 */
describe("the Profile Backgrounds page is Profile-reachable (D-58.1)", () => {
  it("is in PROFILE_REACHABLE_ROUTES and both route arrays", () => {
    expect(PROFILE_REACHABLE_ROUTES).toContain("ProfileBackgrounds");
    expect(DIGEST_STACK_ROUTES).toContain("ProfileBackgrounds");
    expect(EVENTS_STACK_ROUTES).toContain("ProfileBackgrounds");
  });

  it("has a key in all five stack param lists", () => {
    const types = readFileSync(
      join(process.cwd(), "src", "navigation", "types.ts"),
      "utf8",
    );
    expect(types.match(/ProfileBackgrounds: undefined;/g)).toHaveLength(5);
  });
});
