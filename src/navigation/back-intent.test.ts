import { describe, expect, it } from "vitest";
import { resolveBackIntent } from "./back-intent";

describe("resolveBackIntent", () => {
  it("dismisses a transient before navigation", () => {
    expect(resolveBackIntent({ anyTransientOpen: true })).toBe("dismiss-transient");
  });

  it("falls through to the navigator when no transient is open", () => {
    expect(resolveBackIntent({ anyTransientOpen: false })).toBe("default");
  });
});
