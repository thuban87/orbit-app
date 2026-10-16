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
    expect(
      FACTORY_PROFILE_LAYOUT.topLevel.every((placement) => !placement.expanded),
    ).toBe(true);
    expect(FACTORY_PROFILE_LAYOUT.overview).toHaveLength(7);
    // 38.11 D-80: Birthday right after Contact Frequency, before Snooze.
    expect(
      FACTORY_PROFILE_LAYOUT.overview.map((p) => [p.id, p.size, p.visible]),
    ).toEqual([
      ["orbit-status", "2x1", true],
      ["gravity", "1x1", true],
      ["intensity", "2x1", true],
      ["last-interaction", "2x1", true],
      ["contact-frequency", "1x1", true],
      ["birthday", "1x1", true],
      ["snooze", "1x1", true],
    ]);
    expect(FACTORY_PROFILE_LAYOUT.thingsToRemember).toHaveLength(10);
    // D-44 order.
    expect(FACTORY_PROFILE_LAYOUT.thingsToRemember.map((p) => p.id)).toEqual([
      "pinned-featured",
      "last-talked-about",
      "key-people",
      "current-location",
      "memories",
      "thought-of-them",
      "gift-ideas",
      "custom-fields",
      "off-limits",
      "imported-contact-notes",
    ]);
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
        overview: [
          { id: "gravity", visible: true, expanded: true, size: "2x2" },
        ],
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
