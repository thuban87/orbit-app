import { describe, expect, it } from "vitest";
import { usesNeutralUnboundRow } from "./unbound-list-logic";

describe("NeverContactedScreen lifecycle row treatment", () => {
  it("keeps an opted-in Unbound row neutral instead of rendering ContactCard chrome", () => {
    expect(usesNeutralUnboundRow(0)).toBe(true);
    expect(usesNeutralUnboundRow(1)).toBe(false);
  });
});
