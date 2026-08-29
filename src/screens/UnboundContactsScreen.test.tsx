import { describe, expect, it } from "vitest";
import {
  unboundCountLabel,
  unboundRowAccessibilityLabel,
} from "./unbound-list-logic";

describe("UnboundContactsScreen presentation", () => {
  it("uses singular and plural count grammar", () => {
    expect(unboundCountLabel(1)).toBe("1 unbound contact");
    expect(unboundCountLabel(2)).toBe("2 unbound contacts");
  });

  it("describes a neutral Unbound row without status or favourite chrome", () => {
    expect(unboundRowAccessibilityLabel("Avery", "Friends")).toBe(
      "Avery, Friends, Unbound",
    );
    expect(unboundRowAccessibilityLabel("Avery", null)).toBe("Avery, Unbound");
  });
});
