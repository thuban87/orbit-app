import { describe, expect, it, vi } from "vitest";
import { TAB_ORDER } from "./shell-contract";
import { navigateIntoTab } from "./tab-entry";

function spyNavigator() {
  const navigate = vi.fn();
  return { navigate };
}

describe("navigateIntoTab (RG-021, react-native/AUD-RN-002)", () => {
  it("always passes initial: false so an unmounted tab keeps its semantic root", () => {
    const nav = spyNavigator();
    navigateIntoTab(nav, "DashboardTab", "Create");
    expect(nav.navigate).toHaveBeenCalledTimes(1);
    expect(nav.navigate).toHaveBeenCalledWith("DashboardTab", {
      screen: "Create",
      params: undefined,
      initial: false,
    });
  });

  it("passes params through unchanged", () => {
    const nav = spyNavigator();
    const params = { contactId: 7 };
    navigateIntoTab(nav, "DashboardTab", "LogContact", params);
    const payload = nav.navigate.mock.calls[0][1];
    expect(payload).toEqual({
      screen: "LogContact",
      params: { contactId: 7 },
      initial: false,
    });
    expect(payload.params).toBe(params);
  });

  it("is a no-op when the navigator is not available yet", () => {
    expect(() => navigateIntoTab(null, "SettingsTab", "Backup")).not.toThrow();
    expect(() =>
      navigateIntoTab(undefined, "DashboardTab", "Capture"),
    ).not.toThrow();
  });

  it.each(TAB_ORDER)("works for %s", (tab) => {
    const nav = spyNavigator();
    navigateIntoTab(nav, tab, "Anything" as never);
    expect(nav.navigate).toHaveBeenCalledWith(tab, {
      screen: "Anything",
      params: undefined,
      initial: false,
    });
  });
});
