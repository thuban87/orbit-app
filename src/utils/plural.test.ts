import { describe, expect, it } from "vitest";
import { plural, pluralWord } from "./plural";

describe("plural (38.9 D-21)", () => {
  it("is singular for exactly one", () => {
    expect(plural(1, "contact")).toBe("1 contact");
  });

  it("is plural for more than one and for zero", () => {
    expect(plural(2, "contact")).toBe("2 contacts");
    expect(plural(0, "contact")).toBe("0 contacts");
  });

  it("uses an irregular plural when given", () => {
    expect(plural(2, "person", "people")).toBe("2 people");
    expect(plural(1, "person", "people")).toBe("1 person");
    expect(plural(3, "memory", "memories")).toBe("3 memories");
  });

  it("keeps a multi-word noun whole", () => {
    expect(plural(1, "fuel item")).toBe("1 fuel item");
    expect(plural(4, "fuel item")).toBe("4 fuel items");
  });
});

describe("pluralWord (38.9 D-21)", () => {
  it("returns the word only, for sentences that place the number elsewhere", () => {
    expect(pluralWord(1, "interaction")).toBe("interaction");
    expect(pluralWord(2, "interaction")).toBe("interactions");
    expect(pluralWord(0, "interaction")).toBe("interactions");
    expect(pluralWord(2, "person", "people")).toBe("people");
  });
});
