import { describe, expect, it } from "vitest";
import {
  FACTORY_PROFILE_LAYOUT,
  parseAndCanonicalizeProfileLayout,
} from "./presentation-schema";

describe("Profile presentation schema", () => {
  it("exposes the complete factory document in stable semantic order", () => {
    expect(parseAndCanonicalizeProfileLayout(FACTORY_PROFILE_LAYOUT)).toEqual(
      FACTORY_PROFILE_LAYOUT,
    );
    expect(FACTORY_PROFILE_LAYOUT.topLevel).toHaveLength(4);
    expect(FACTORY_PROFILE_LAYOUT.overview).toHaveLength(6);
    expect(FACTORY_PROFILE_LAYOUT.thingsToRemember).toHaveLength(8);
  });

  it.each([
    [{ ...FACTORY_PROFILE_LAYOUT, version: 2 }, "version"],
    [
      {
        ...FACTORY_PROFILE_LAYOUT,
        topLevel: [
          ...FACTORY_PROFILE_LAYOUT.topLevel,
          FACTORY_PROFILE_LAYOUT.topLevel[0],
        ],
      },
      "duplicate",
    ],
    [
      {
        ...FACTORY_PROFILE_LAYOUT,
        topLevel: [{ id: "gravity", visible: true, expanded: true }],
      },
      "parent",
    ],
    [
      {
        ...FACTORY_PROFILE_LAYOUT,
        overview: [{ id: "gravity", visible: true, expanded: true, size: "2x2" }],
      },
      "size",
    ],
    [
      {
        ...FACTORY_PROFILE_LAYOUT,
        thingsToRemember: [
          { id: "memories", visible: true, expanded: true, children: [] },
        ],
      },
      "property",
    ],
  ])("rejects a closed-contract violation", (input, reason) => {
    expect(() => parseAndCanonicalizeProfileLayout(input)).toThrow(reason);
  });
});
