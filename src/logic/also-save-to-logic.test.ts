import { describe, expect, it } from "vitest";
import { LINKED_SECTIONS } from "@/db/linked-entry-dao";
import {
  ALSO_SAVE_TO_SECTIONS,
  addedNoteSnackbar,
  alsoSaveChoiceAfterNoteChange,
  alsoSavedSuffix,
  alsoSaveToLabel,
  canAlsoSave,
  effectiveAlsoSaveTo,
  loggedInteractionSnackbar,
} from "./also-save-to-logic";

describe("ALSO_SAVE_TO_SECTIONS (D-38, D-95)", () => {
  it("offers the four sections in D-38 order", () => {
    expect(ALSO_SAVE_TO_SECTIONS).toEqual([
      "last_talked_about",
      "gift_idea",
      "thought_of_them",
      "memory",
    ]);
  });

  it("covers exactly the sections the linked-entry DAO accepts", () => {
    expect([...ALSO_SAVE_TO_SECTIONS].sort()).toEqual(
      [...LINKED_SECTIONS].sort(),
    );
  });

  it("names each section as its Profile section is named (D-89)", () => {
    expect(ALSO_SAVE_TO_SECTIONS.map(alsoSaveToLabel)).toEqual([
      "Last Talked About",
      "Gift Ideas",
      "Thought of Them",
      "Memories",
    ]);
  });
});

describe("canAlsoSave", () => {
  it("needs a note with text", () => {
    expect(canAlsoSave("x")).toBe(true);
    expect(canAlsoSave("  coffee  ")).toBe(true);
    expect(canAlsoSave("")).toBe(false);
    expect(canAlsoSave("   \n ")).toBe(false);
    expect(canAlsoSave(null)).toBe(false);
    expect(canAlsoSave(undefined)).toBe(false);
  });
});

describe("one destination rule (convergence c10, Codex C-01 / Cursor CU-04)", () => {
  it("a note with text saves to the chosen section, or none", () => {
    expect(effectiveAlsoSaveTo("x", "gift_idea")).toBe("gift_idea");
    expect(effectiveAlsoSaveTo("x", null)).toBeNull();
  });

  it("a blank note never saves to a section", () => {
    expect(effectiveAlsoSaveTo(null, "gift_idea")).toBeNull();
    expect(effectiveAlsoSaveTo("", "gift_idea")).toBeNull();
    expect(effectiveAlsoSaveTo("   ", "gift_idea")).toBeNull();
  });

  it("type a note, choose Gift Ideas, clear the note: the choice resets and the save is plain", () => {
    let note: string | null = "x";
    let chosen = alsoSaveChoiceAfterNoteChange(note, null);
    expect(chosen).toBeNull();
    chosen = "gift_idea";
    expect(effectiveAlsoSaveTo(note, chosen)).toBe("gift_idea");
    // The form stores a cleared note as null (TouchpointRefineForm).
    note = null;
    chosen = alsoSaveChoiceAfterNoteChange(note, chosen);
    expect(chosen).toBeNull();
    // Even a stale choice resolves to the plain path.
    expect(effectiveAlsoSaveTo(null, "gift_idea")).toBeNull();
    expect(effectiveAlsoSaveTo("   ", "gift_idea")).toBeNull();
  });

  it("editing a note that keeps text keeps the choice", () => {
    expect(alsoSaveChoiceAfterNoteChange("coffee", "memory")).toBe("memory");
    expect(alsoSaveChoiceAfterNoteChange("  ", "memory")).toBeNull();
  });
});

describe("snackbar copy (38.9 D-39, D-46)", () => {
  it("names the section that was also saved", () => {
    expect(alsoSavedSuffix(null)).toBe("");
    expect(alsoSavedSuffix("thought_of_them")).toBe(
      ", also saved to Thought of Them",
    );
  });

  it("Log Interaction: verb, channel, person, section", () => {
    expect(
      loggedInteractionSnackbar({
        channel: "Call",
        personName: "Ann Lee",
        section: "last_talked_about",
      }),
    ).toBe("Logged Call with Ann Lee, also saved to Last Talked About");
    expect(
      loggedInteractionSnackbar({
        channel: "Message",
        personName: "Ann Lee",
        section: null,
      }),
    ).toBe("Logged Message with Ann Lee");
    expect(
      loggedInteractionSnackbar({
        channel: "In Person",
        personName: null,
        section: null,
      }),
    ).toBe("Logged In Person");
  });

  it("Add Note: verb, person, section", () => {
    expect(
      addedNoteSnackbar({ personName: "Ann Lee", section: "gift_idea" }),
    ).toBe("Added note for Ann Lee, also saved to Gift Ideas");
    expect(addedNoteSnackbar({ personName: null, section: null })).toBe(
      "Added note",
    );
  });
});
