import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ResearchItem } from "@/db/compose-research-read";
import {
  groupResearchItems,
  researchItemDisplayValue,
  researchItemShowsLabel,
} from "./compose-research-logic";

const THIS_YEAR = new Date().getFullYear();

describe("researchItemDisplayValue (38.9 D-66, D-70; render only)", () => {
  it("formats the first-class birthday with the birthday formatter (D-70)", () => {
    expect(
      researchItemDisplayValue({
        id: "firstclass:birthday",
        value: `${THIS_YEAR}-06-02`,
      }),
    ).toBe(`Jun 2, ${THIS_YEAR}`);
    expect(
      researchItemDisplayValue({ id: "firstclass:birthday", value: "02-29" }),
    ).toBe("Feb 29");
  });

  it("formats a custom Date field value and keeps a rejected one raw", () => {
    expect(
      researchItemDisplayValue({
        id: "custom:4",
        value: `${THIS_YEAR - 1}-06-02`,
        fieldType: "date",
      }),
    ).toBe(`Jun 2, ${THIS_YEAR - 1}`);
    expect(
      researchItemDisplayValue({
        id: "custom:4",
        value: "next spring",
        fieldType: "date",
      }),
    ).toBe("next spring");
  });

  it("leaves other custom text types and free-text values unchanged", () => {
    expect(
      researchItemDisplayValue({
        id: "custom:5",
        value: `${THIS_YEAR}-10-20`,
        fieldType: "text",
      }),
    ).toBe(`${THIS_YEAR}-10-20`);
    // A memory's own text is never date-formatted; only its meaningful date is.
    expect(
      researchItemDisplayValue({
        id: "memory:1",
        value: `${THIS_YEAR}-10-20`,
      }),
    ).toBe(`${THIS_YEAR}-10-20`);
    expect(
      researchItemDisplayValue({ id: "relationship:3", value: "sister" }),
    ).toBe("sister");
  });

  it("shows a custom toggle through the Profile's value formatter (D-29, J-10)", () => {
    expect(
      researchItemDisplayValue({
        id: "custom:6",
        value: "1",
        fieldType: "toggle",
      }),
    ).toBe("Yes");
    expect(
      researchItemDisplayValue({
        id: "custom:6",
        value: "0",
        fieldType: "toggle",
      }),
    ).toBe("No");
  });

  it("adds a memory's meaningful date in display form, raw when not a date (D-29)", () => {
    expect(
      researchItemDisplayValue({
        id: "memory:2",
        value: "Graduation",
        meaningfulDate: `${THIS_YEAR - 1}-06-02`,
      }),
    ).toBe(`Graduation · Jun 2, ${THIS_YEAR - 1}`);
    expect(
      researchItemDisplayValue({
        id: "memory:2",
        value: "Trip",
        meaningfulDate: "next spring",
      }),
    ).toBe("Trip · next spring");
    expect(
      researchItemDisplayValue({
        id: "memory:2",
        value: "",
        meaningfulDate: `${THIS_YEAR - 1}-06-02`,
      }),
    ).toBe(`Jun 2, ${THIS_YEAR - 1}`);
  });

  it("adds a current-state entry's date in display form (D-29, D-41)", () => {
    expect(
      researchItemDisplayValue({
        id: "current:last_talked_about",
        value: "Soccer",
        entryDate: `${THIS_YEAR - 1}-10-20`,
      }),
    ).toBe(`Soccer · Oct 20, ${THIS_YEAR - 1}`);
  });
});

function item(overrides: Partial<ResearchItem>): ResearchItem {
  return {
    id: "memory:1",
    groupId: "memory:general",
    group: "Memory",
    label: "Memory",
    value: "Text",
    aiEligible: false,
    isOffLimits: false,
    ...overrides,
  };
}

describe("groupResearchItems (D-29, J-09, J-X01)", () => {
  it("collects non-adjacent items of one section into one first-seen group", () => {
    const groups = groupResearchItems([
      item({ id: "memory:1", value: "Pinned" }),
      item({
        id: "memory:2",
        groupId: "memory:imported",
        group: "Imported from Contacts App",
      }),
      item({ id: "memory:3", value: "Unpinned" }),
    ]);
    expect(groups.map((group) => group.id)).toEqual([
      "memory:general",
      "memory:imported",
    ]);
    expect(groups[0].items.map((row) => row.value)).toEqual([
      "Pinned",
      "Unpinned",
    ]);
  });

  it("keeps two groups that share a display name apart, with unique keys", () => {
    const groups = groupResearchItems([
      item({ id: "memory:1", groupId: "memory:general", group: "Memory" }),
      item({ id: "custom:9", groupId: "custom:Memory", group: "Memory" }),
    ]);
    expect(groups).toHaveLength(2);
    const keys = groups.map((group) => group.id);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("researchItemShowsLabel (D-111, J-09)", () => {
  it("draws no label line for an unlabeled Off Limits item, so its text shows once", () => {
    const offLimits = item({
      id: "offlimits:1",
      groupId: "off_limits",
      group: "Off Limits",
      label: "",
      value: "Their divorce",
      isOffLimits: true,
    });
    expect(researchItemShowsLabel(offLimits, "Off Limits")).toBe(false);
    expect(researchItemDisplayValue(offLimits)).toBe("Their divorce");
  });

  it("draws no label line that only repeats its group heading", () => {
    expect(researchItemShowsLabel(item({ label: "Memory" }), "Memory")).toBe(
      false,
    );
  });

  it("draws a real label", () => {
    expect(
      researchItemShowsLabel(item({ label: "Coffee order" }), "Memory"),
    ).toBe(true);
  });

  it("the screen gates its label line on the helper and keys groups by id", () => {
    const screen = readFileSync(
      "src/screens/ComposeResearchScreen.tsx",
      "utf8",
    );
    expect(screen).toMatch(
      /researchItemShowsLabel\(item, group\.name\) \? \(\s*<AppText role="label">\{item\.label\}<\/AppText>/,
    );
    expect(screen).toContain("key={group.id}");
    expect(screen).not.toContain("key={group.name}");
  });
});
