import { describe, expect, it } from "vitest";
import {
  buildKnowledgePresentation,
  formatCustomFieldValue,
  type KnowledgePresentationInput,
} from "./knowledge-presentation";

const input: KnowledgePresentationInput = {
  contactId: 7,
  knowledge: {
    currentState: {
      last_talked_about: {
        id: 1,
        uid: "current-1",
        contact_id: 7,
        field_key: "last_talked_about",
        value: "The garden",
        created_at: "2026-09-01 12:00:00",
        modified_at: "2026-09-01 12:00:00",
      },
    },
    featured: {
      items: [
        {
          owner: "memory",
          id: 10,
          row: {
            id: 10,
            uid: "memory-10",
            contact_id: 7,
            type: "general",
            custom_label: null,
            value: "Bring soup",
            note: "After surgery",
            url: "https://example.test/soup",
            meaningful_date: "2026-09-05",
            pinned: 1,
            outdated: 0,
            hidden: 0,
            provenance: "user",
            created_at: "2026-09-01 12:00:00",
            modified_at: "2026-09-01 12:00:00",
            deleted_at: null,
            allow_ai: 1,
          },
        },
      ],
      total: 4,
      remainingCount: 3,
      hiddenCount: 1,
      showHiddenAvailable: true,
    },
    relationships: { items: [], total: 0, remainingCount: 0, hiddenCount: 0, showHiddenAvailable: false },
    memories: { items: [], total: 0, remainingCount: 0, hiddenCount: 0, showHiddenAvailable: false },
    importedNotes: { items: [], total: 0, remainingCount: 0, hiddenCount: 0, showHiddenAvailable: false },
    customFields: [
      {
        name: null,
        items: [
          {
            fieldDefId: 22,
            valueUid: "value-22",
            label: "Pets",
            type: "number",
            options: null,
            rawValue: "about three",
            parsed: { ok: false },
            shareWithAi: 0,
            historyRetained: 1,
            historyKey: { contactId: 7, fieldDefId: 22 },
          },
        ],
      },
      {
        name: "Home",
        items: [
          {
            fieldDefId: 23,
            valueUid: "value-23",
            label: "Website",
            type: "url",
            options: null,
            rawValue: "orbit.example",
            parsed: { ok: true, value: "orbit.example" },
            shareWithAi: 0,
            historyRetained: 0,
            historyKey: null,
          },
        ],
      },
    ],
    offLimits: [
      {
        id: 90,
        contact_id: 7,
        kind: "off_limits",
        label: "Politics",
        text: "Avoid election news",
        url: null,
        created_at: "2026-09-01 12:00:00",
        source: "user",
      },
    ],
  },
};

describe("knowledge presentation", () => {
  it("keeps child identity/order, semantic caps, hidden recovery, and detail ownership", () => {
    const result = buildKnowledgePresentation(input);

    expect(result.children.map((child) => child.id)).toEqual([
      "pinned-featured",
      "last-talked-about",
      "key-people",
      "current-location",
      "memories",
      "custom-fields",
      "off-limits",
      "imported-contact-notes",
    ]);
    expect(result.children[0]).toMatchObject({
      summary: "1 shown · 3 more",
      viewAllLabel: "View all 4 featured items",
      showHiddenAvailable: true,
      items: [
        expect.objectContaining({
          detail: expect.objectContaining({ owner: "memory", id: 10 }),
          management: expect.objectContaining({
            longPress: ["edit", "unpin", "hide"],
            accessibility: ["edit", "unpin", "hide"],
          }),
        }),
      ],
    });
  });

  it("preserves ungrouped rows without inventing a heading and exposes raw-value history", () => {
    const customFields = buildKnowledgePresentation(input).children.find(
      (child) => child.id === "custom-fields",
    );

    expect(customFields).toMatchObject({
      groups: [
        expect.objectContaining({ name: null, heading: null }),
        expect.objectContaining({ name: "Home", heading: "Home" }),
      ],
    });
    expect(customFields?.groups[0]?.items[0]).toMatchObject({
      label: "Pets",
      invalid: true,
      rawValue: "about three",
      history: { contactId: 7, fieldDefId: 22 },
    });
  });

  it("keeps ordinary Off Limits as caution-only without inferred AI permission", () => {
    const offLimits = buildKnowledgePresentation(input).children.find(
      (child) => child.id === "off-limits",
    );

    expect(offLimits?.helper).toBe("Avoid bringing these up");
    expect(offLimits?.items[0]).toMatchObject({
      sparkle: false,
      explicitPermission: undefined,
      detail: { owner: "fuel", id: 90 },
    });
  });

  it("formats every live custom field type exhaustively", () => {
    expect(formatCustomFieldValue("text", "Apartment 3B")).toBe("Apartment 3B");
    expect(formatCustomFieldValue("textarea", "Long note")).toBe("Long note");
    expect(formatCustomFieldValue("dropdown", "Friend")).toBe("Friend");
    expect(formatCustomFieldValue("date", "2026-09-09")).toBe("2026-09-09");
    expect(formatCustomFieldValue("toggle", "1")).toBe("Yes");
    expect(formatCustomFieldValue("number", "3")).toBe("3");
    expect(formatCustomFieldValue("photo", "/photos/pet.jpg")).toBe("Photo added");
    expect(formatCustomFieldValue("url", "orbit.example")).toBe("orbit.example");
    expect(formatCustomFieldValue("email", "me@example.test")).toBe("me@example.test");
    expect(formatCustomFieldValue("phone", "+1 555 0100")).toBe("+1 555 0100");
  });
});
