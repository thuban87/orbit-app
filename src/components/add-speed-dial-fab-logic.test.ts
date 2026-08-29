import { describe, expect, it } from "vitest";
import { speedDialScrimPointerEvents } from "./add-speed-dial-fab-logic";

describe("speedDialScrimPointerEvents", () => {
  it("is inert when the speed dial is collapsed so dashboard touches pass through", () => {
    // GAP D regression guard: a collapsed full-screen scrim must NOT capture
    // touches (opacity 0 alone does not disable touch in React Native).
    expect(speedDialScrimPointerEvents(false)).toBe("none");
  });

  it("intercepts touches when the speed dial is expanded (outside tap collapses it)", () => {
    expect(speedDialScrimPointerEvents(true)).toBe("auto");
  });
});
