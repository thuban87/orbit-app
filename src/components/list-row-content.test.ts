import { describe, expect, it } from "vitest";
import {
  buildRowAccessibilityDescription,
  buildSearchRowAccessibilityDescription,
  buildSearchRowContext,
  formatCardRecency,
  formatLine2,
  formatListRecency,
  formatMatchCategories,
  formatMatchExplanation,
  formatSearchExplanation,
  searchSnippetToShow,
} from "@/components/list-row-content";
import type {
  DashboardSearchMatch,
  DashboardSearchResult,
  DashboardSearchSourceKind,
} from "@/logic/dashboard-search-match";
import { isSnoozed } from "@/utils/dates";

function match(
  sourceKind: DashboardSearchSourceKind,
  fieldLabel: string,
  snippet = "",
): DashboardSearchMatch {
  return { sourceKind, fieldLabel, snippet, highlights: [], priority: 1 };
}

function kinds(...sourceKinds: DashboardSearchSourceKind[]) {
  return sourceKinds.map((sourceKind) => match(sourceKind, "unused"));
}

describe("ListRow content", () => {
  const now = "2026-08-15 12:00:00";

  it("formats local-calendar recency compactly", () => {
    expect(formatListRecency(null, now)).toBe("No interactions yet");
    expect(formatListRecency("2026-08-15 00:00:00", now)).toBe("Today");
    expect(formatListRecency("2026-08-14 23:00:00", now)).toBe("Yesterday");
    expect(formatListRecency("2026-07-28", now)).toBe("18d ago");
  });

  it.each(["2026-08-15 99:00:00", "2026-02-29 12:00:00"])(
    "renders corrupt non-null last-contact %s as neutral recency",
    (lastContact) => {
      expect(formatListRecency(lastContact, now)).toBe("No interactions yet");
    },
  );

  it("composes recency and the one displayed category", () => {
    expect(formatLine2("18d ago", "Friend")).toBe("18d ago · Friend");
    expect(formatLine2("No interactions yet", null)).toBe(
      "No interactions yet",
    );
  });

  it("formats pluralised corpus match explanations with the strongest categories", () => {
    expect(
      formatMatchExplanation(
        3,
        formatMatchCategories(
          kinds(
            "memory-or-custom-field",
            "relationship",
            "memory-or-custom-field",
          ),
        ),
        "+2 more",
      ),
    ).toBe("3 matches · Memory, Relationship · +2 more");
  });

  it("labels the section kinds with their Things to Remember section names", () => {
    expect(
      formatMatchExplanation(1, formatMatchCategories(kinds("off-limits"))),
    ).toBe("1 match · Off Limits");
    expect(
      formatMatchCategories(
        kinds(
          "last-talked-about",
          "current-location",
          "gift-idea",
          "thought-of-them",
        ),
      ),
    ).toEqual([
      "Last Talked About",
      "Current Location",
      "Gift Ideas",
      "Thought of Them",
    ]);
  });

  it("formats singular and name-only match explanations without categories", () => {
    expect(formatMatchExplanation(1, [])).toBe("1 match");
    expect(formatMatchExplanation(1, [], "+1 more")).toBe("1 match · +1 more");
  });

  it.each([
    ["stable", "Stable"],
    ["wobble", "Wobbly"],
    ["decay", "Decaying"],
    ["rogue", "Rogue"],
    ["snoozed", "Snoozed"],
    [null, "Never Contacted"],
  ] as const)(
    "describes %s status without relying on colour",
    (displayState, label) => {
      expect(
        buildRowAccessibilityDescription({
          name: "Ada Lovelace",
          category: "Friend",
          recency: "Yesterday",
          isFavourite: true,
          displayState,
        }),
      ).toBe(`Ada Lovelace. Friend. Yesterday. Favorite. ${label}.`);
    },
  );

  it("describes missing category and non-favourite membership", () => {
    expect(
      buildRowAccessibilityDescription({
        name: "Grace Hopper",
        category: null,
        recency: "No interactions yet",
        isFavourite: false,
        displayState: null,
      }),
    ).toBe(
      "Grace Hopper. No category. No interactions yet. Not favorite. Never Contacted.",
    );
  });

  describe("rendered context (RG-031 ui-accessibility/AUD-UIA-007)", () => {
    const identity = {
      name: "Ada Lovelace",
      category: "Friend",
      recency: "Yesterday",
      isFavourite: true,
      displayState: "stable",
    } as const;
    const summary = "Ada Lovelace. Friend. Yesterday. Favorite. Stable.";

    it("is byte-identical to the identity summary when no context is given", () => {
      expect(buildRowAccessibilityDescription(identity)).toBe(summary);
      expect(
        buildRowAccessibilityDescription({ ...identity, context: undefined }),
      ).toBe(summary);
    });

    it.each([null, "", "   ", "\n\t"])(
      "treats %j context as absent (no trailing empty part)",
      (context) => {
        expect(buildRowAccessibilityDescription({ ...identity, context })).toBe(
          summary,
        );
      },
    );

    it("appends the rendered context as the final period-terminated part", () => {
      expect(
        buildRowAccessibilityDescription({
          ...identity,
          context: 'Matched 2 memories · "coffee in Lisbon"',
        }),
      ).toBe(`${summary} Matched 2 memories · "coffee in Lisbon".`);
    });

    it("trims the context and does not double terminal punctuation", () => {
      expect(
        buildRowAccessibilityDescription({
          ...identity,
          context: "  Birthday in 3 days  ",
        }),
      ).toBe(`${summary} Birthday in 3 days.`);
      expect(
        buildRowAccessibilityDescription({
          ...identity,
          context: "Asked about the move.",
        }),
      ).toBe(`${summary} Asked about the move.`);
      expect(
        buildRowAccessibilityDescription({
          ...identity,
          context: "met at the climbing gym…",
        }),
      ).toBe(`${summary} met at the climbing gym…`);
    });

    it("always places the identity summary before the context", () => {
      const description = buildRowAccessibilityDescription({
        ...identity,
        context: "1 match · Memory",
      });
      expect(description.startsWith(summary)).toBe(true);
      expect(description.indexOf("1 match")).toBeGreaterThan(
        description.indexOf("Stable."),
      );
    });

    it("composes a search-mode context from the explanation and displayed snippet", () => {
      const explanation = formatMatchExplanation(
        2,
        formatMatchCategories(kinds("memory-or-custom-field")),
      );
      const context = buildSearchRowContext(explanation, "coffee in Lisbon");
      expect(context).toBe('2 matches · Memory · "coffee in Lisbon"');
      expect(buildRowAccessibilityDescription({ ...identity, context })).toBe(
        `${summary} 2 matches · Memory · "coffee in Lisbon".`,
      );
    });

    it("omits a snippet that is not displayed", () => {
      expect(buildSearchRowContext("1 match", null)).toBe("1 match");
      expect(buildSearchRowContext("1 match", "  ")).toBe("1 match");
      expect(buildSearchRowContext(null, null)).toBeNull();
      expect(buildSearchRowContext(null, "snippet only")).toBe(
        '"snippet only"',
      );
    });
  });
});

describe("search labels (38.13 D-37)", () => {
  function result(
    matches: DashboardSearchMatch[],
    extra: Partial<DashboardSearchResult> = {},
  ): DashboardSearchResult {
    return {
      contactId: 1,
      score: 1,
      matches,
      totalMatchCount: matches.length,
      ...extra,
    };
  }

  it("a name-only match (null result) reads Name", () => {
    expect(formatSearchExplanation(null)).toBe("Name");
  });

  it("an identity match reads its own field label, never Identity", () => {
    expect(formatSearchExplanation(result([match("identity", "Phone")]))).toBe(
      "1 match · Phone",
    );
    expect(formatSearchExplanation(result([match("identity", "Email")]))).toBe(
      "1 match · Email",
    );
    expect(
      formatSearchExplanation(result([match("identity", "Category")])),
    ).toBe("1 match · Category");
    expect(formatSearchExplanation(result([match("identity", "Name")]))).toBe(
      "1 match · Name",
    );
  });

  it("memory and note matches read their section labels", () => {
    expect(
      formatSearchExplanation(
        result([
          match("memory-or-custom-field", "Memory"),
          match("note-or-body", "Note"),
        ]),
      ),
    ).toBe("2 matches · Memory, Note");
  });

  it("keeps distinct labels and the more-matches label", () => {
    expect(
      formatSearchExplanation(
        result(
          [
            match("identity", "Name"),
            match("identity", "Phone"),
            match("note-or-body", "Note"),
          ],
          { totalMatchCount: 5, moreMatchesLabel: "+2 more" },
        ),
      ),
    ).toBe("5 matches · Name, Phone, Note · +2 more");
  });

  it("hides a snippet identical to the contact's name (ignoring case and surrounding spaces)", () => {
    expect(searchSnippetToShow("Ann Lee", "ann lee")).toBeNull();
    expect(searchSnippetToShow("  Ann Lee ", "Ann Lee")).toBeNull();
    expect(searchSnippetToShow("likes jazz", "Ann Lee")).toBe("likes jazz");
    expect(searchSnippetToShow(null, "Ann Lee")).toBeNull();
    expect(searchSnippetToShow("   ", "Ann Lee")).toBeNull();
  });
});

describe("search-mode description reads only what is shown (38.13 D-51)", () => {
  it("names the person, then the shown context, with no hidden parts", () => {
    const description = buildSearchRowAccessibilityDescription({
      name: "Ann",
      unbound: false,
      context: '1 match · Note · "jazz"',
    });
    expect(description).toBe('Ann. 1 match · Note · "jazz".');
    for (const hidden of [
      "No category",
      "Friend",
      "Yesterday",
      "No interactions yet",
      "favorite",
      "Favorite",
      "Stable",
      "Never Contacted",
    ]) {
      expect(description).not.toContain(hidden);
    }
  });

  it("adds the Unbound marker when it is shown", () => {
    expect(
      buildSearchRowAccessibilityDescription({
        name: "Ann",
        unbound: true,
        context: "Name",
      }),
    ).toBe("Ann. Unbound. Name.");
  });

  it("drops an empty context and keeps terminal punctuation single", () => {
    expect(
      buildSearchRowAccessibilityDescription({
        name: "Ann",
        unbound: false,
        context: null,
      }),
    ).toBe("Ann.");
    expect(
      buildSearchRowAccessibilityDescription({
        name: "Ann",
        unbound: false,
        context: '1 match · Note · "so it goes…"',
      }),
    ).toBe('Ann. 1 match · Note · "so it goes…".');
  });
});

describe("card recency (38.13 D-33)", () => {
  const now = "2026-08-15 12:00:00";

  it("reads Never Contacted for a person with no interactions", () => {
    expect(formatCardRecency(null, now)).toBe("Never Contacted");
  });

  it("matches the List recency for every other value", () => {
    for (const lastContact of [
      "2026-08-15 00:00:00",
      "2026-08-14 23:00:00",
      "2026-07-28",
    ]) {
      expect(formatCardRecency(lastContact, now)).toBe(
        formatListRecency(lastContact, now),
      );
    }
  });
});

/**
 * 38.13 D-55 F1 (review R1-01): the memoised List row host passes the read's
 * local day (`YYYY-MM-DD`) as ListRow's `now` instead of the seconds-granular
 * timestamp. ListRow's only uses of `now` are calendar-day granular, so the
 * day key renders exactly what the full timestamp did.
 */
describe("the List day key renders what the full timestamp did (38.13 D-55)", () => {
  const day = "2026-08-15";
  const stamps = [`${day} 00:00:00`, `${day} 12:34:56`, `${day} 23:59:59`];

  it.each([
    ["today", "2026-08-15 08:00:00"],
    ["yesterday", "2026-08-14 23:00:00"],
    ["N days ago", "2026-07-28"],
    ["null (no interactions)", null],
  ])("formatListRecency: %s", (_label, lastContact) => {
    for (const now of stamps) {
      expect(formatListRecency(lastContact, day)).toBe(
        formatListRecency(lastContact, now),
      );
    }
  });

  it.each([
    ["snoozed until tomorrow", "2026-08-16", true],
    ["snoozed until today", "2026-08-15", false],
    ["no snooze", null, false],
  ])("isSnoozed: %s", (_label, snoozeUntil, expected) => {
    expect(isSnoozed(snoozeUntil, day)).toBe(expected);
    for (const now of stamps) {
      expect(isSnoozed(snoozeUntil, now)).toBe(expected);
    }
  });
});
