import { describe, expect, it } from "vitest";
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
  });

  it.each(PROFILE_REACHABLE_ROUTES)(
    "registers Profile-reachable route %s in both promoted stacks",
    (routeName) => {
      expect(DIGEST_STACK_ROUTES).toContain(routeName);
      expect(EVENTS_STACK_ROUTES).toContain(routeName);
    },
  );
});
