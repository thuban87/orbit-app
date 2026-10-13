import { describe, expect, it } from "vitest";
import type { DroppedFieldName } from "@/db/knowledge-move-dao";
import {
  dropConfirmText,
  MOVE_SECTIONS,
  movedSnackbar,
  moveSectionLabel,
  moveTargetsFor,
  moveUndoneSnackbar,
} from "./move-entry-logic";

describe("move targets (38.10 D-84)", () => {
  it("lists the five D-84 sections, never Imported or custom fields", () => {
    expect([...MOVE_SECTIONS]).toEqual([
      "memory",
      "thought_of_them",
      "gift_idea",
      "last_talked_about",
      "off_limits",
    ]);
  });

  it.each(MOVE_SECTIONS)("from %s offers the other four", (section) => {
    const targets = moveTargetsFor(section);
    expect(targets).toHaveLength(4);
    expect(targets).not.toContain(section);
    for (const target of targets) {
      expect(MOVE_SECTIONS).toContain(target);
    }
  });

  it("names each section as the Profile does", () => {
    expect(MOVE_SECTIONS.map(moveSectionLabel)).toEqual([
      "Memories",
      "Thought of Them",
      "Gift Ideas",
      "Last Talked About",
      "Off Limits",
    ]);
  });
});

describe("dropConfirmText (D-85)", () => {
  it("is null when nothing is dropped", () => {
    expect(dropConfirmText([], "gift_idea")).toBeNull();
  });

  it("names every field fieldsDroppedByMove can return, in plain words", () => {
    const all: DroppedFieldName[] = [
      "note",
      "meaningful date",
      "pinned",
      "outdated",
      "visibility setting",
      "label",
      "linked note",
      "entry date",
    ];
    const text = dropConfirmText(all, "off_limits");
    expect(text).toBe(
      "Moving this to Off Limits removes its note, its meaningful date, " +
        "its pin, its outdated mark, its Hide from Profile setting, its label, " +
        "its link to the interaction note and its date.",
    );
  });

  it("lists one field without a comma", () => {
    expect(dropConfirmText(["label"], "last_talked_about")).toBe(
      "Moving this to Last Talked About removes its label.",
    );
  });

  it("lists two fields with and", () => {
    expect(dropConfirmText(["note", "pinned"], "off_limits")).toBe(
      "Moving this to Off Limits removes its note and its pin.",
    );
  });
});

describe("move snackbars (38.9 D-39/D-46; D-118)", () => {
  it("names the target section and the person", () => {
    expect(movedSnackbar("gift_idea", "Ann")).toBe(
      "Moved to Gift Ideas for Ann",
    );
  });

  it("the Undo confirmation names the original section and the person", () => {
    expect(moveUndoneSnackbar("memory", "Ann")).toBe(
      "Move undone, back in Memories for Ann",
    );
  });

  it("drops the name while the person line has not loaded", () => {
    expect(movedSnackbar("off_limits", null)).toBe("Moved to Off Limits");
    expect(moveUndoneSnackbar("off_limits", null)).toBe(
      "Move undone, back in Off Limits",
    );
  });
});
