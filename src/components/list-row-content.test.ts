import { describe, expect, it } from "vitest";
import {
  buildRowAccessibilityDescription,
  buildSearchRowContext,
  formatLine2,
  formatListRecency,
  formatMatchCategories,
  formatMatchExplanation,
} from "@/components/list-row-content";

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
        formatMatchCategories([
          "memory-or-custom-field",
          "relationship",
          "memory-or-custom-field",
        ]),
        "+2 more",
      ),
    ).toBe("3 matches · Memory, Relationship · +2 more");
  });

  it("formats singular and fuel-only match explanations without categories", () => {
    expect(formatMatchExplanation(1, [])).toBe("1 match");
    expect(formatMatchExplanation(1, [], "+1 more")).toBe("1 match · +1 more");
  });

  it.each([
    ["stable", "Stable"],
    ["wobble", "Wobbling"],
    ["decay", "Decaying"],
    ["rogue", "Rogue"],
    ["snoozed", "Snoozed"],
    [null, "Not yet contacted"],
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
      ).toBe(`Ada Lovelace. Friend. Yesterday. Favourite. ${label}.`);
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
      "Grace Hopper. No category. No interactions yet. Not favourite. Not yet contacted.",
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
    const summary = "Ada Lovelace. Friend. Yesterday. Favourite. Stable.";

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
        formatMatchCategories(["memory-or-custom-field"]),
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
