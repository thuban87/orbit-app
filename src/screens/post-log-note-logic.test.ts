import { describe, expect, it } from "vitest";
import {
  type PostLogSaveResult,
  resolvePostLogSave,
  shouldPromptOnNoteClose,
} from "./post-log-note-logic";

const BASE = {
  text: "Talked about the new job",
  interactionId: 12,
  interactionExists: true,
  alsoSaveTo: null,
} as const;

describe("resolvePostLogSave", () => {
  it("a note with no section seeds only the interaction note", () => {
    expect(resolvePostLogSave(BASE)).toEqual<PostLogSaveResult>({
      target: "note",
      interactionId: 12,
      note: "Talked about the new job",
      alsoSaveTo: null,
    });
  });

  it("a note with a section carries that section (D-42, D-95)", () => {
    expect(
      resolvePostLogSave({ ...BASE, alsoSaveTo: "gift_idea" }),
    ).toEqual<PostLogSaveResult>({
      target: "note",
      interactionId: 12,
      note: "Talked about the new job",
      alsoSaveTo: "gift_idea",
    });
  });

  it("trims the note before it is saved", () => {
    const result = resolvePostLogSave({ ...BASE, text: "  padded  " });
    expect(result.target === "note" && result.note).toBe("padded");
  });

  it("empty / whitespace text is a no-op, whatever section was chosen (c10 C-01)", () => {
    expect(resolvePostLogSave({ ...BASE, text: "   " })).toEqual({
      target: "noop",
    });
    expect(
      resolvePostLogSave({
        ...BASE,
        text: "",
        alsoSaveTo: "last_talked_about",
      }),
    ).toEqual({ target: "noop" });
  });

  it("returns 'missing' when the interaction was undone/deleted", () => {
    // Add-Note-after-Undo race (Review MEDIUM 34-06): no note patch is produced.
    const result = resolvePostLogSave({
      ...BASE,
      interactionExists: false,
      alsoSaveTo: "memory",
    });
    expect(result).toEqual({ target: "missing" });
    expect(result).not.toHaveProperty("note");
    expect(result).not.toHaveProperty("alsoSaveTo");
  });

  it("empty text wins over a missing interaction (nothing to save either way)", () => {
    expect(
      resolvePostLogSave({ ...BASE, text: " ", interactionExists: false }),
    ).toEqual({ target: "noop" });
  });
});

describe("shouldPromptOnNoteClose (38.9 D-14; review CR-02)", () => {
  it("an untouched sheet closes at once", () => {
    expect(shouldPromptOnNoteClose({ text: "", alsoSaveTo: null })).toBe(false);
    expect(shouldPromptOnNoteClose({ text: "  \n ", alsoSaveTo: null })).toBe(
      false,
    );
  });

  it("typed text asks first", () => {
    expect(shouldPromptOnNoteClose({ text: "Coffee", alsoSaveTo: null })).toBe(
      true,
    );
  });

  it("a chosen section counts as work too", () => {
    expect(
      shouldPromptOnNoteClose({
        text: "Coffee",
        alsoSaveTo: "thought_of_them",
      }),
    ).toBe(true);
    expect(shouldPromptOnNoteClose({ text: "", alsoSaveTo: "memory" })).toBe(
      true,
    );
  });
});
