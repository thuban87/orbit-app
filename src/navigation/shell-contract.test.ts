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
    expect([...FAB_ROUTES]).toEqual([
      "Create",
      "GroupLog",
      "LogContact",
      "UpdateContact",
      "Memory",
    ]);
  });

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
