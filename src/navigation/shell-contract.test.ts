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
 * Profile-reachable and every one of the five stacks must register it, or the
 * add-memory buttons become silent no-ops in release (RG-021).
 */
describe("the Memory add route stays registered in all five stacks (D-66)", () => {
  it("is Profile-reachable and not a + route", () => {
    expect(PROFILE_REACHABLE_ROUTES).toContain("Memory");
    expect(FAB_ROUTES as readonly string[]).not.toContain("Memory");
  });

  it("is registered in Digest and Events", () => {
    expect(DIGEST_STACK_ROUTES).toContain("Memory");
    expect(EVENTS_STACK_ROUTES).toContain("Memory");
  });

  it.each(LITERAL_STACKS)("%s registers Memory", (file) => {
    expect(
      stackSource(file).includes(
        '<Stack.Screen name="Memory" component={MemoryAddScreen} />',
      ),
    ).toBe(true);
  });
});
