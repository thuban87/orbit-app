import { describe, expect, it } from "vitest";
import type { MemoryRow } from "@/db/memories-read";
import type {
  ProfileCollection,
  ProfileCurrentStateEntry,
  ProfileKnowledge,
} from "@/db/profile-knowledge-read";
import type { RelationshipRow } from "@/db/relationships-read";
import { formatDisplayDateOrFallback, formatMonthDay } from "@/utils/dates";
import {
  buildKnowledgePresentation,
  childHasEntries,
  customValueDisplayText,
  formatCustomFieldValue,
  headingActionFor,
  type KnowledgeChildId,
  type KnowledgePresentationInput,
} from "./knowledge-presentation";
import { PROFILE_THINGS_TO_REMEMBER_MODULE_IDS } from "./persisted-contract";

const THIS_YEAR = new Date().getFullYear();

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
        previous: [],
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
            interaction_id: null,
            link_source: null,
            group_note_copy: 0,
            linked_note_ai_locked: 0,
          },
        },
      ],
      total: 4,
      remainingCount: 3,
      hiddenCount: 1,
      showHiddenAvailable: true,
    },
    relationships: {
      items: [],
      total: 0,
      remainingCount: 0,
      hiddenCount: 0,
      showHiddenAvailable: false,
    },
    memories: {
      items: [],
      total: 0,
      remainingCount: 0,
      hiddenCount: 0,
      showHiddenAvailable: false,
    },
    thoughtOfThem: {
      items: [],
      total: 0,
      remainingCount: 0,
      hiddenCount: 0,
      showHiddenAvailable: false,
    },
    giftIdeas: {
      items: [],
      total: 0,
      remainingCount: 0,
      hiddenCount: 0,
      showHiddenAvailable: false,
    },
    importedNotes: {
      items: [],
      total: 0,
      remainingCount: 0,
      hiddenCount: 0,
      showHiddenAvailable: false,
    },
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
        uid: "off-limits-90",
        contact_id: 7,
        label: "Politics",
        text: "Avoid election news",
        url: null,
        group_note_copy: 0,
        from_share: 0,
        created_at: "2026-09-01 12:00:00",
        modified_at: "2026-09-01 12:00:00",
      },
    ],
  },
};

describe("knowledge presentation", () => {
  it("presents temporal knowledge as deduped Most Recent and up-to-five Previous rows", () => {
    const temporalInput: KnowledgePresentationInput = {
      ...input,
      knowledge: {
        ...input.knowledge,
        currentState: {
          last_talked_about: {
            ...input.knowledge.currentState.last_talked_about!,
            previous: [1, 2, 3, 4, 5, 6].map((id) => ({
              id: id + 1,
              uid: `previous-${id}`,
              contact_id: 7,
              field_key: "last_talked_about" as const,
              value: `Previous ${id}`,
              created_at: `2026-08-${String(id).padStart(2, "0")} 12:00:00`,
              modified_at: "2026-08-01 12:00:00",
              previous: [],
            })),
          },
        },
      },
    };

    const child = buildKnowledgePresentation(temporalInput).children.find(
      (candidate) => candidate.id === "last-talked-about",
    );
    expect(child?.bodySummary).toBe("");
    expect(child?.items).toHaveLength(6);
    expect(child?.items[0]).toMatchObject({
      title: "Most Recent",
      preview: "The garden",
      temporalPosition: "most-recent",
    });
    expect(child?.items.slice(1).map((item) => item.preview)).toEqual([
      "Previous 1",
      "Previous 2",
      "Previous 3",
      "Previous 4",
      "Previous 5",
    ]);
    expect(
      child?.items
        .slice(1)
        .every((item) => item.temporalPosition === "previous"),
    ).toBe(true);
  });

  it("uses neutral empty and single-record temporal states without empty subsection shells", () => {
    const zeroInput: KnowledgePresentationInput = {
      ...input,
      knowledge: { ...input.knowledge, currentState: {} },
    };
    const empty = buildKnowledgePresentation(zeroInput).children.find(
      (candidate) => candidate.id === "last-talked-about",
    );
    expect(empty).toMatchObject({
      bodySummary: "Nothing added yet",
      items: [],
    });

    const single = buildKnowledgePresentation(input).children.find(
      (candidate) => candidate.id === "last-talked-about",
    );
    expect(single?.items).toHaveLength(1);
    expect(single?.items[0]).toMatchObject({
      title: "Most Recent",
      temporalPosition: "most-recent",
    });
  });

  it("keeps child identity/order, semantic caps, hidden recovery, and detail ownership", () => {
    const result = buildKnowledgePresentation(input);

    // D-44 order.
    expect(result.children.map((child) => child.id)).toEqual([
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
    // One count format (D-89 / audit D-34); Pinned has no View all (D-112);
    // the sheet offers Edit and Pin/Unpin, never Hide (D-70).
    expect(result.children[0]).toMatchObject({
      bodySummary: "4 items",
      viewAllLabel: null,
      showHiddenAvailable: true,
      items: [
        expect.objectContaining({
          detail: expect.objectContaining({ owner: "memory", id: 10 }),
          management: expect.objectContaining({
            longPress: ["edit", "unpin"],
            accessibility: ["edit", "unpin"],
          }),
        }),
      ],
    });
    expect(result.children[0]).not.toHaveProperty("summary");
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
      detail: { owner: "offLimits", id: 90 },
    });
    expect(offLimits?.items[0]?.id).toBe("off-limits:90");
    expect(offLimits?.bodySummary).toBe("1 item");
  });

  it("formats every live custom field type exhaustively", () => {
    expect(formatCustomFieldValue("text", "Apartment 3B")).toBe("Apartment 3B");
    expect(formatCustomFieldValue("textarea", "Long note")).toBe("Long note");
    expect(formatCustomFieldValue("dropdown", "Friend")).toBe("Friend");
    // 38.9 D-48: a date shows in the display form; the year follows the
    // current year, so the case builds a current-year value (C6-L1).
    expect(formatCustomFieldValue("date", `${THIS_YEAR}-09-09`)).toBe("Sep 9");
    expect(formatCustomFieldValue("toggle", "1")).toBe("Yes");
    expect(formatCustomFieldValue("number", "3")).toBe("3");
    expect(formatCustomFieldValue("photo", "avatars/cv-7-pet.jpg")).toBe(
      "Photo added",
    );
    expect(formatCustomFieldValue("url", "orbit.example")).toBe(
      "orbit.example",
    );
    expect(formatCustomFieldValue("email", "me@example.test")).toBe(
      "me@example.test",
    );
    expect(formatCustomFieldValue("phone", "+1 555 0100")).toBe("+1 555 0100");
  });

  describe("memory meaningful date display (D-65, D-48)", () => {
    const withDate = (
      meaningfulDate: string | null,
    ): KnowledgePresentationInput => {
      const featured = input.knowledge.featured;
      const [first] = featured.items;
      if (first?.owner !== "memory") throw new Error("fixture changed");
      return {
        ...input,
        knowledge: {
          ...input.knowledge,
          featured: {
            ...featured,
            items: [
              {
                ...first,
                row: { ...first.row, meaningful_date: meaningfulDate },
              },
            ],
          },
        },
      };
    };
    const metadataOf = (presentation: KnowledgePresentationInput) =>
      buildKnowledgePresentation(presentation)
        .children.flatMap((child) => child.items)
        .find((item) => item.id === "memory:10")?.metadata;

    it("shows a current-year date without the year", () => {
      expect(metadataOf(withDate(`${THIS_YEAR}-09-05`))?.[0]).toBe("Sep 5");
    });

    it("shows another year's date with the year", () => {
      expect(metadataOf(withDate(`${THIS_YEAR - 1}-06-02`))?.[0]).toBe(
        `Jun 2, ${THIS_YEAR - 1}`,
      );
    });

    it("shows a legacy free-text or impossible value raw", () => {
      expect(metadataOf(withDate("next spring"))?.[0]).toBe("next spring");
      expect(metadataOf(withDate("2026-02-31"))?.[0]).toBe("2026-02-31");
    });

    it("omits a missing date", () => {
      expect(metadataOf(withDate(null))?.[0]).toBe("Link");
    });
  });

  it("keeps an impossible date raw so the stored value stays visible", () => {
    expect(formatCustomFieldValue("date", "2026-02-31")).toBe("2026-02-31");
  });

  describe("customValueDisplayText (D-23, D-66; C9-M1, C10-L1)", () => {
    it("formats a valid date in the current year without the year", () => {
      expect(customValueDisplayText("date", `${THIS_YEAR}-10-20`)).toBe(
        formatMonthDay(10, 20),
      );
    });

    it("formats a date in another year with the year", () => {
      expect(customValueDisplayText("date", `${THIS_YEAR - 1}-06-02`)).toBe(
        `Jun 2, ${THIS_YEAR - 1}`,
      );
    });

    it("formats parser-valid padded and trailing-text values as on the Profile", () => {
      expect(customValueDisplayText("date", ` ${THIS_YEAR}-10-20`)).toBe(
        "Oct 20",
      );
      expect(customValueDisplayText("date", `${THIS_YEAR}-10-20 trip`)).toBe(
        "Oct 20",
      );
    });

    it("returns an unparseable date raw", () => {
      expect(customValueDisplayText("date", "next spring")).toBe("next spring");
      expect(customValueDisplayText("date", "2026-02-31")).toBe("2026-02-31");
    });

    it("leaves a date-shaped value of another type unchanged", () => {
      expect(customValueDisplayText("text", `${THIS_YEAR}-10-20`)).toBe(
        `${THIS_YEAR}-10-20`,
      );
      expect(customValueDisplayText("number", "42")).toBe("42");
    });
  });

  it("never claims 'Photo added' for a photo value that is not a stored photo path (38.6 D-34)", () => {
    for (const text of ["Rex", "/photos/pet.jpg", "file:///x.jpg", " "]) {
      expect(formatCustomFieldValue("photo", text)).toBe("Photo unavailable");
    }
    // An empty always-show field reads "Not set" (D-87).
    expect(formatCustomFieldValue("photo", null)).toBe("Not set");
    expect(formatCustomFieldValue("photo", "")).toBe("Not set");

    const withText: KnowledgePresentationInput = {
      ...input,
      knowledge: {
        ...input.knowledge,
        customFields: [
          {
            name: null,
            items: [
              {
                fieldDefId: 30,
                valueUid: "value-30",
                label: "Dog",
                type: "photo",
                options: null,
                rawValue: "Rex",
                parsed: { ok: true, value: "Rex" },
                shareWithAi: 0,
                historyRetained: 0,
                historyKey: null,
              },
            ],
          },
        ],
      },
    };
    const item = buildKnowledgePresentation(withText).children.find(
      (child) => child.id === "custom-fields",
    )?.items[0];
    // Display only: the raw text is carried through unchanged (D-31).
    expect(item).toMatchObject({
      preview: "Photo unavailable",
      rawValue: "Rex",
      invalid: false,
    });
  });

  describe("38.10 Profile sections (D-44, D-52, D-68, D-72, D-112, D-24, D-37)", () => {
    const none = <T>(): ProfileCollection<T> => ({
      items: [],
      total: 0,
      remainingCount: 0,
      hiddenCount: 0,
      showHiddenAvailable: false,
    });
    const some = <T>(items: T[]): ProfileCollection<T> => ({
      items,
      total: items.length,
      remainingCount: 0,
      hiddenCount: 0,
      showHiddenAvailable: false,
    });
    const memory = (id: number, over: Partial<MemoryRow> = {}): MemoryRow => ({
      id,
      uid: `memory-${id}`,
      contact_id: 7,
      type: "general",
      custom_label: null,
      value: `Memory ${id}`,
      note: null,
      url: null,
      meaningful_date: null,
      pinned: 0,
      outdated: 0,
      hidden: 0,
      provenance: "user",
      created_at: "2026-09-01 12:00:00",
      modified_at: "2026-09-01 12:00:00",
      deleted_at: null,
      allow_ai: 0,
      interaction_id: null,
      link_source: null,
      group_note_copy: 0,
      linked_note_ai_locked: 0,
      ...over,
    });
    const person = (
      id: number,
      over: Partial<RelationshipRow> = {},
    ): RelationshipRow => ({
      id,
      uid: `person-${id}`,
      contact_id: 7,
      person_name: `Person ${id}`,
      relation_type: null,
      linked_contact_id: null,
      linked_contact_name: null,
      note: null,
      pinned: 0,
      hidden: 0,
      created_at: "2026-09-01 12:00:00",
      modified_at: "2026-09-01 12:00:00",
      deleted_at: null,
      ...over,
    });
    const entry = (
      id: number,
      fieldKey: ProfileCurrentStateEntry["field_key"],
      over: Partial<ProfileCurrentStateEntry> = {},
    ): ProfileCurrentStateEntry => ({
      id,
      uid: `entry-${id}`,
      contact_id: 7,
      field_key: fieldKey,
      value: `Entry ${id}`,
      created_at: "2026-09-01 12:00:00",
      modified_at: "2026-09-01 12:00:00",
      previous: [],
      ...over,
    });
    const empty: ProfileKnowledge = {
      currentState: {},
      featured: none(),
      relationships: none(),
      memories: none(),
      thoughtOfThem: none(),
      giftIdeas: none(),
      importedNotes: none(),
      customFields: [],
      offLimits: [],
    };
    const full: ProfileKnowledge = {
      currentState: {
        last_talked_about: entry(1, "last_talked_about"),
        current_location: entry(2, "current_location"),
      },
      featured: some([{ owner: "memory", id: 50, row: memory(50) }]),
      relationships: some([person(1)]),
      memories: some([memory(1)]),
      thoughtOfThem: some([memory(2, { type: "thought_of_them" })]),
      giftIdeas: some([memory(3, { type: "gift_idea" })]),
      importedNotes: some([memory(4, { type: "imported" })]),
      customFields: input.knowledge.customFields,
      offLimits: input.knowledge.offLimits,
    };
    const build = (knowledge: ProfileKnowledge) =>
      buildKnowledgePresentation({ contactId: 7, knowledge });
    const child = (knowledge: ProfileKnowledge, id: KnowledgeChildId) => {
      const found = build(knowledge).children.find((c) => c.id === id);
      if (!found) throw new Error(`missing ${id}`);
      return found;
    };

    it("headingActionFor follows D-72, and every built child carries it", () => {
      const expected: Record<KnowledgeChildId, "add" | "edit" | "none"> = {
        "pinned-featured": "none",
        "last-talked-about": "add",
        "key-people": "edit",
        "current-location": "edit",
        memories: "add",
        "thought-of-them": "add",
        "gift-ideas": "add",
        "custom-fields": "edit",
        "off-limits": "edit",
        "imported-contact-notes": "edit",
      };
      for (const id of PROFILE_THINGS_TO_REMEMBER_MODULE_IDS) {
        expect(headingActionFor(id)).toBe(expected[id]);
      }
      for (const built of build(full).children) {
        expect(built.headingAction).toBe(headingActionFor(built.id));
      }
    });

    it("childHasEntries is false for an empty section and true with one entry", () => {
      expect(childHasEntries("current-location", empty)).toBe(false);
      expect(childHasEntries("current-location", full)).toBe(true);
      expect(childHasEntries("gift-ideas", empty)).toBe(false);
      expect(childHasEntries("gift-ideas", full)).toBe(true);
      for (const id of PROFILE_THINGS_TO_REMEMBER_MODULE_IDS) {
        expect(childHasEntries(id, empty)).toBe(false);
        expect(childHasEntries(id, full)).toBe(true);
      }
    });

    it("titles the sections from the registry (D-91)", () => {
      expect(child(full, "thought-of-them").title).toBe("Thought of Them");
      expect(child(full, "gift-ideas").title).toBe("Gift Ideas");
      expect(child(full, "gift-ideas").items[0]?.title).toBe("Gift Ideas");
      expect(child(full, "memories").items[0]?.title).toBe("Memory");
    });

    it("gives every empty section its line and 'Add …', except Imported and Pinned (D-68; c2 G-U3)", () => {
      const labels = Object.fromEntries(
        build(empty).children.map((c) => [c.id, c.emptyAction]),
      );
      expect(labels).toEqual({
        "pinned-featured": null,
        "last-talked-about": "Add Last Talked About",
        "key-people": "Add Key Person",
        "current-location": "Add Current Location",
        memories: "Add Memory",
        "thought-of-them": "Add Thought of Them",
        "gift-ideas": "Add Gift Idea",
        "custom-fields": "Add Custom Field",
        "off-limits": "Add Off Limits Item",
        "imported-contact-notes": null,
      });
      for (const built of build(empty).children) {
        expect(built.bodySummary).toBe("Nothing added yet");
      }
      for (const built of build(full).children) {
        expect(built.emptyAction).toBeNull();
      }
    });

    it("shows Most Recent and Previous by the entry date, date only (D-41, D-48; c6 C-02)", () => {
      const backdated = {
        entry_date: "2026-09-12",
        created_at: "2026-10-05 14:30:00",
      };
      const knowledge: ProfileKnowledge = {
        ...empty,
        currentState: {
          last_talked_about: entry(1, "last_talked_about", {
            ...backdated,
            previous: [
              entry(2, "last_talked_about", backdated),
              entry(3, "last_talked_about", {
                created_at: "2026-08-03 21:15:00",
              }),
            ],
          }),
        },
      };
      const items = child(knowledge, "last-talked-about").items;
      const sep12 = formatDisplayDateOrFallback("2026-09-12");
      expect(items.map((item) => item.metadata[0])).toEqual([
        sep12,
        sep12,
        formatDisplayDateOrFallback("2026-08-03"),
      ]);
      expect(items[0]?.metadata[0]).not.toMatch(/\d:\d/);
    });

    it("labels 'See all (N)' on Last Talked About and Current Location (D-52, D-53; c9)", () => {
      const knowledge: ProfileKnowledge = {
        ...empty,
        currentState: {
          last_talked_about: entry(1, "last_talked_about", { total: 8 }),
          current_location: entry(2, "current_location", { total: 2 }),
        },
      };
      expect(child(knowledge, "last-talked-about").viewAllLabel).toBe(
        "See all (8)",
      );
      expect(child(knowledge, "current-location").viewAllLabel).toBe(
        "See all (2)",
      );
      expect(child(empty, "current-location").viewAllLabel).toBeNull();
    });

    it("keeps a pinned memory and a pinned key person with the same id, and every pinned item (D-112; c1 F-U6)", () => {
      const twin: ProfileKnowledge = {
        ...empty,
        featured: some([
          { owner: "memory", id: 5, row: memory(5, { pinned: 1 }) },
          {
            owner: "relationship",
            id: 5,
            row: person(5, { pinned: 1 }),
          },
        ]),
      };
      expect(child(twin, "pinned-featured").items.map((i) => i.id)).toEqual([
        "memory:5",
        "relationship:5",
      ]);
      const five: ProfileKnowledge = {
        ...empty,
        featured: some(
          [1, 2, 3, 4, 5].map((id) => ({
            owner: "memory" as const,
            id,
            row: memory(id, { pinned: 1 }),
          })),
        ),
      };
      const pinned = child(five, "pinned-featured");
      expect(pinned.items).toHaveLength(5);
      expect(pinned.viewAllLabel).toBeNull();
    });

    it("carries a stored URL in the detail of entries and Off Limits items (D-24; c1 F-U9)", () => {
      const knowledge: ProfileKnowledge = {
        ...empty,
        currentState: {
          last_talked_about: entry(1, "last_talked_about", {
            url: "https://example.test/trip",
          }),
        },
        offLimits: [
          {
            ...input.knowledge.offLimits[0]!,
            url: "https://example.test/news",
          },
        ],
        memories: some([memory(9, { url: "https://example.test/soup" })]),
      };
      expect(child(knowledge, "last-talked-about").items[0]?.detail.url).toBe(
        "https://example.test/trip",
      );
      expect(child(knowledge, "off-limits").items[0]).toMatchObject({
        metadata: ["Link"],
        detail: { url: "https://example.test/news" },
      });
      expect(child(knowledge, "memories").items[0]?.detail.url).toBe(
        "https://example.test/soup",
      );
      expect(child(full, "memories").items[0]?.detail).not.toHaveProperty(
        "url",
      );
    });

    it("carries the interaction link only on a linked entry (D-37, D-107)", () => {
      const knowledge: ProfileKnowledge = {
        ...empty,
        currentState: {
          last_talked_about: entry(1, "last_talked_about", {
            interaction_id: 40,
            link_source: "note",
            previous: [entry(2, "last_talked_about")],
          }),
        },
        memories: some([
          memory(1, { interaction_id: 41, link_source: "group_note" }),
          memory(2),
        ]),
      };
      const [linkedEntry, plainEntry] = child(
        knowledge,
        "last-talked-about",
      ).items;
      expect(linkedEntry?.detail.link).toEqual({
        interactionId: 40,
        linkSource: "note",
      });
      expect(plainEntry?.detail).not.toHaveProperty("link");
      const [linkedMemory, plainMemory] = child(knowledge, "memories").items;
      expect(linkedMemory?.detail.link).toEqual({
        interactionId: 41,
        linkSource: "group_note",
      });
      expect(plainMemory?.detail).not.toHaveProperty("link");
    });

    it("never offers Hide on an entry (D-70)", () => {
      for (const built of build(full).children) {
        for (const item of built.items) {
          expect(item.management.accessibility).not.toContain("hide");
          expect(item.management.longPress).not.toContain("hide");
        }
      }
    });
  });
});
