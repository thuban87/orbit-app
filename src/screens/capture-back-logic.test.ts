import { describe, expect, it } from "vitest";
import {
  type CaptureBackState,
  resolveCaptureBack,
} from "./capture-back-logic";

/**
 * Capture's own hardware Back (38.9 D-33, with D-14 enforced inside it): Back
 * first closes the innermost open surface, and prompts only when typed text
 * would be lost. Since 38.10 the search is always visible (D-80), so
 * `searchOpen` means "the search has text" and Back clears it.
 */

const IDLE: CaptureBackState = {
  inlineOpen: false,
  inlineName: "",
  searchOpen: false,
  multiSelect: false,
  noteOpen: false,
  noteText: "",
};

describe("resolveCaptureBack (D-33, D-14)", () => {
  it("closes an open New-contact surface with an empty name at once", () => {
    expect(
      resolveCaptureBack({ ...IDLE, inlineOpen: true, inlineName: "   " }),
    ).toBe("close-inline");
    expect(resolveCaptureBack({ ...IDLE, inlineOpen: true })).toBe(
      "close-inline",
    );
  });

  it("prompts before closing a New-contact surface holding a typed name (D-14)", () => {
    expect(
      resolveCaptureBack({ ...IDLE, inlineOpen: true, inlineName: " Ann " }),
    ).toBe("prompt-discard-inline");
  });

  it("clears a search that has text", () => {
    expect(resolveCaptureBack({ ...IDLE, searchOpen: true })).toBe(
      "close-search",
    );
  });

  it("exits multi-select", () => {
    expect(resolveCaptureBack({ ...IDLE, multiSelect: true })).toBe(
      "exit-multi-select",
    );
  });

  it("prompts with a typed note instead of discarding and leaving (D-33)", () => {
    expect(
      resolveCaptureBack({ ...IDLE, noteOpen: true, noteText: "  hi " }),
    ).toBe("prompt-discard-note");
  });

  it("cancels the capture with an open but blank note", () => {
    expect(
      resolveCaptureBack({ ...IDLE, noteOpen: true, noteText: "   " }),
    ).toBe("cancel-capture");
  });

  it("cancels the capture when nothing is open", () => {
    expect(resolveCaptureBack(IDLE)).toBe("cancel-capture");
  });

  it("ignores a stale note draft while the note field is closed", () => {
    expect(resolveCaptureBack({ ...IDLE, noteText: "left over" })).toBe(
      "cancel-capture",
    );
  });

  it("resolves in order: inline, search text, multi-select, note, cancel", () => {
    const everything: CaptureBackState = {
      inlineOpen: true,
      inlineName: "Ann",
      searchOpen: true,
      multiSelect: true,
      noteOpen: true,
      noteText: "hi",
    };
    expect(resolveCaptureBack(everything)).toBe("prompt-discard-inline");
    expect(resolveCaptureBack({ ...everything, inlineOpen: false })).toBe(
      "close-search",
    );
    expect(
      resolveCaptureBack({
        ...everything,
        inlineOpen: false,
        searchOpen: false,
      }),
    ).toBe("exit-multi-select");
    expect(
      resolveCaptureBack({
        ...everything,
        inlineOpen: false,
        searchOpen: false,
        multiSelect: false,
      }),
    ).toBe("prompt-discard-note");
  });
});
