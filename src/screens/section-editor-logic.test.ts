import { describe, expect, it } from "vitest";
import type { MemoryRow } from "@/db/memories-read";
import {
  addedSnackbar,
  canAdd,
  canMove,
  deletedSnackbar,
  moveSectionOf,
  openEditTarget,
  restoredSnackbar,
  savedSnackbar,
  sectionAddLabel,
  sectionEmptyText,
  sectionEntries,
  sectionEntryNoun,
  sectionPinSnackbar,
  sectionPinUndoneSnackbar,
  sectionTitle,
  shownOnProfileSnackbar,
} from "./section-editor-logic";

describe("section editor (38.10 D-75, D-35, D-84, D-107)", () => {
  it("titles each section from the registries (D-91)", () => {
    expect(sectionTitle("general")).toBe("Memories");
    expect(sectionTitle("gift_idea")).toBe("Gift Ideas");
    expect(sectionTitle("thought_of_them")).toBe("Thought of Them");
    expect(sectionTitle("imported")).toBe("Imported from Contacts App");
  });

  it("keeps the section's own rows in read order, hidden ones included", () => {
    const rows = [
      { id: 1, type: "gift_idea", hidden: 1 },
      { id: 2, type: "general", hidden: null },
      { id: 3, type: "gift_idea", hidden: null },
    ] as MemoryRow[];
    expect(sectionEntries(rows, "gift_idea").map((row) => row.id)).toEqual([
      1, 3,
    ]);
  });

  it.each([
    ["imported", false],
    ["general", true],
    ["gift_idea", true],
    ["thought_of_them", true],
  ] as const)("canAdd and canMove for %s are %s", (type, expected) => {
    expect(canAdd(type)).toBe(expected);
    expect(canMove(type)).toBe(expected);
  });

  it("maps a section to its move section, none for Imported", () => {
    expect(moveSectionOf("general")).toBe("memory");
    expect(moveSectionOf("gift_idea")).toBe("gift_idea");
    expect(moveSectionOf("thought_of_them")).toBe("thought_of_them");
    expect(moveSectionOf("imported")).toBeNull();
  });

  describe("openEditTarget (convergence c6)", () => {
    const rows = [{ id: 4 }, { id: 9 }];
    it("returns the id when a loaded row has it", () => {
      expect(openEditTarget(9, rows)).toBe(9);
    });
    it("falls back to the list when the id is not among the rows", () => {
      expect(openEditTarget(12, rows)).toBeUndefined();
    });
    it("opens nothing without an id", () => {
      expect(openEditTarget(undefined, rows)).toBeUndefined();
    });
  });

  describe("snackbars (38.9 D-39/D-46; proposals for plan 19)", () => {
    it("delete and restore are verb first and name the person", () => {
      expect(deletedSnackbar("Gift Ideas", "Ann")).toBe(
        "Deleted Gift Ideas entry for Ann",
      );
      expect(restoredSnackbar("Gift Ideas", "Ann")).toBe(
        "Gift Ideas entry restored for Ann",
      );
    });

    it("pin and unpin, and their Undo, name the person", () => {
      expect(sectionPinSnackbar(true, "Ann")).toBe("Pinned for Ann");
      expect(sectionPinSnackbar(false, "Ann")).toBe("Unpinned for Ann");
      expect(sectionPinUndoneSnackbar(true, "Ann")).toBe("Pin undone for Ann");
      expect(sectionPinUndoneSnackbar(false, "Ann")).toBe(
        "Unpin undone for Ann",
      );
    });

    it("Show on Profile names the person", () => {
      expect(shownOnProfileSnackbar("Ann")).toBe("Shown on Profile for Ann");
    });

    it("add and save name the person", () => {
      expect(addedSnackbar("Memories", "Ann")).toBe(
        "Added Memories entry for Ann",
      );
      expect(savedSnackbar("Memories", "Ann")).toBe(
        "Saved Memories entry for Ann",
      );
    });

    it("drops the name while the person line has not loaded", () => {
      expect(deletedSnackbar("Memories", null)).toBe("Deleted Memories entry");
      expect(sectionPinSnackbar(true, null)).toBe("Pinned");
    });
  });

  it("an empty section names itself; Imported says only the import adds", () => {
    expect(sectionEmptyText("gift_idea").heading).toBe(
      "Nothing in Gift Ideas yet",
    );
    expect(sectionEmptyText("imported").body).toBe(
      "Only the Contacts import adds entries here.",
    );
  });

  it("points at the section's own Add above, where D-131 puts it (D-137 W14)", () => {
    expect(sectionEmptyText("gift_idea").body).toBe(
      "Use Add Gift Idea above to add the first one.",
    );
    expect(sectionEmptyText("general").body).toBe(
      "Use Add Memory above to add the first one.",
    );
    expect(sectionEmptyText("thought_of_them").body).toBe(
      "Use Add Thought of Them above to add the first one.",
    );
  });
});

describe("sectionAddLabel (D-130; D-137 W14)", () => {
  it("uses each section's own name, the glossary ADD_* wording", () => {
    expect(sectionAddLabel("general")).toBe("Add Memory");
    expect(sectionAddLabel("gift_idea")).toBe("Add Gift Idea");
    expect(sectionAddLabel("thought_of_them")).toBe("Add Thought of Them");
  });
});

describe("sectionEntryNoun (D-137 W14; D-141)", () => {
  it("names one entry of each section", () => {
    expect(sectionEntryNoun("general")).toBe("Memory");
    expect(sectionEntryNoun("gift_idea")).toBe("Gift Idea");
    expect(sectionEntryNoun("thought_of_them")).toBe("Thought of Them");
    expect(sectionEntryNoun("imported")).toBe("Imported Note");
  });

  it("matches the Add label for every section that has an Add", () => {
    for (const type of ["general", "gift_idea", "thought_of_them"] as const) {
      expect(sectionAddLabel(type)).toBe(`Add ${sectionEntryNoun(type)}`);
    }
  });
});
