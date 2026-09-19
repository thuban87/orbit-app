import { describe, expect, it } from "vitest";
import { TAB_ICON } from "@/components/icons/icon-registry";
import { resolveNotificationNav } from "@/services/notifications/notification-nav";
import {
  DIGEST_STACK_ROUTES,
  EVENTS_STACK_ROUTES,
  INITIAL_TAB,
  TAB_ORDER,
} from "./shell-contract";

const PROFILE_REACHABLE_ROUTES = [
  "Profile",
  "RecentlyDeleted",
  "GroupEventDetail",
  "EditGroupEvent",
  "EditParticipant",
  "Compose",
  "ComposeResearch",
  "LogContact",
  "Edit",
  "EditInteraction",
  "ThingsToRemember",
  "MemoryHistory",
  "CropPhoto",
  "SurvivorSelect",
  "MergeConflicts",
  "MergeImpactSummary",
] as const;

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
