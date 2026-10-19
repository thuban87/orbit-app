/**
 * Contacts Back priority (38.13 D-29): an open shell transient first (the
 * root listener dismisses it), then selection mode (ADR-102), then an open
 * search, otherwise the default Back.
 */
import { describe, expect, it } from "vitest";
import { resolveHomeBack } from "@/logic/home-session-logic";

describe("resolveHomeBack", () => {
  it("defers to an open shell transient before anything else", () => {
    expect(
      resolveHomeBack({
        anyTransientOpen: true,
        selectionMode: true,
        searchExpanded: true,
      }),
    ).toBe("default");
  });

  it("exits selection before closing the search", () => {
    expect(
      resolveHomeBack({
        anyTransientOpen: false,
        selectionMode: true,
        searchExpanded: true,
      }),
    ).toBe("exit-selection");
  });

  it("closes an open search when nothing else is open", () => {
    expect(
      resolveHomeBack({
        anyTransientOpen: false,
        selectionMode: false,
        searchExpanded: true,
      }),
    ).toBe("close-search");
  });

  it("leaves Back to its default otherwise", () => {
    expect(
      resolveHomeBack({
        anyTransientOpen: false,
        selectionMode: false,
        searchExpanded: false,
      }),
    ).toBe("default");
  });
});
