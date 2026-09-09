import { describe, expect, it } from "vitest";
import {
  PROFILE_LAYOUT_DOCUMENT_VERSION,
  PROFILE_MODULE_IDS,
  PROFILE_MODULE_PARENT,
  parseProfileCollapseMap,
  parseProfileLayoutDocument,
  serializeProfileCollapseMap,
  serializeProfileLayoutDocument,
} from "./persisted-contract";

const validDocument = {
  version: 1,
  topLevel: [
    { id: "interaction-history", visible: true, expanded: false },
    { id: "relationship-overview", visible: true, expanded: true },
  ],
  overview: [
    { id: "snooze", visible: true, expanded: false },
    { id: "orbit-status", visible: true, expanded: true },
  ],
  thingsToRemember: [
    { id: "off-limits", visible: true, expanded: true },
    { id: "pinned-featured", visible: true, expanded: true },
  ],
};

describe("persisted Profile presentation vocabulary", () => {
  it("pins the document version, exact closed IDs, and legal parents", () => {
    expect(PROFILE_LAYOUT_DOCUMENT_VERSION).toBe(1);
    expect(PROFILE_MODULE_IDS).toEqual([
      "relationship-overview",
      "things-to-remember",
      "contact-methods",
      "interaction-history",
      "orbit-status",
      "gravity",
      "intensity",
      "last-interaction",
      "contact-frequency",
      "snooze",
      "pinned-featured",
      "last-talked-about",
      "key-people",
      "current-location",
      "memories",
      "custom-fields",
      "off-limits",
      "imported-contact-notes",
    ]);
    expect(PROFILE_MODULE_PARENT).toEqual({
      "relationship-overview": "profile",
      "things-to-remember": "profile",
      "contact-methods": "profile",
      "interaction-history": "profile",
      "orbit-status": "relationship-overview",
      gravity: "relationship-overview",
      intensity: "relationship-overview",
      "last-interaction": "relationship-overview",
      "contact-frequency": "relationship-overview",
      snooze: "relationship-overview",
      "pinned-featured": "things-to-remember",
      "last-talked-about": "things-to-remember",
      "key-people": "things-to-remember",
      "current-location": "things-to-remember",
      memories: "things-to-remember",
      "custom-fields": "things-to-remember",
      "off-limits": "things-to-remember",
      "imported-contact-notes": "things-to-remember",
    });
  });

  it("canonicalizes JSON property order without changing user module order", () => {
    expect(serializeProfileLayoutDocument(validDocument)).toBe(
      JSON.stringify({
        version: PROFILE_LAYOUT_DOCUMENT_VERSION,
        topLevel: [
          { id: "interaction-history", visible: true, expanded: false },
          { id: "relationship-overview", visible: true, expanded: true },
        ],
        overview: [
          { id: "snooze", visible: true, expanded: false },
          { id: "orbit-status", visible: true, expanded: true },
        ],
        thingsToRemember: [
          { id: "off-limits", visible: true, expanded: true },
          { id: "pinned-featured", visible: true, expanded: true },
        ],
      }),
    );
    expect(parseProfileLayoutDocument(JSON.stringify(validDocument))).toEqual(
      JSON.parse(serializeProfileLayoutDocument(validDocument)),
    );
  });

  it.each([
    [{ ...validDocument, version: 0 }, "version"],
    [{ ...validDocument, version: 2 }, "version"],
    [
      {
        ...validDocument,
        overview: [{ id: "future-module", visible: true, expanded: true }],
      },
      "unknown",
    ],
    [
      {
        ...validDocument,
        topLevel: [{ id: "gravity", visible: true, expanded: true }],
      },
      "parent",
    ],
    [
      {
        ...validDocument,
        topLevel: [
          { id: "contact-methods", visible: true, expanded: true },
          { id: "contact-methods", visible: false, expanded: false },
        ],
      },
      "duplicate",
    ],
  ])("rejects invalid persisted layout documents: %s", (input, reason) => {
    expect(() => parseProfileLayoutDocument(input)).toThrow(reason);
  });
});

describe("persisted Profile collapse map", () => {
  it("accepts only collapsible semantic IDs and emits canonical JSON", () => {
    const input = {
      "off-limits": false,
      "relationship-overview": true,
      "contact-methods": false,
    };
    expect(parseProfileCollapseMap(input)).toEqual({
      "relationship-overview": true,
      "contact-methods": false,
      "off-limits": false,
    });
    expect(serializeProfileCollapseMap(input)).toBe(
      '{"relationship-overview":true,"contact-methods":false,"off-limits":false}',
    );
  });

  it.each([
    [{ "future-module": true }, "unknown"],
    [{ gravity: true }, "not collapsible"],
    [{ "relationship-overview": 1 }, "boolean"],
    [{ "relationship-overview": "false" }, "boolean"],
    [null, "object"],
    [[], "object"],
  ])("rejects invalid collapse maps: %s", (input, reason) => {
    expect(() => parseProfileCollapseMap(input)).toThrow(reason);
  });
});
