/**
 * Compose's "Did you send it?" panel answers (38.14 D-01 carried, D-23, D-43,
 * D-77, D-78; tests per D-48). Pure: the screen feeds the runner's result in and
 * applies the outcome.
 */
import { describe, expect, it } from "vitest";
import {
  composeLoggedSnackbar,
  composePanelOutcome,
} from "@/logic/compose-assist-panel";

describe("composePanelOutcome — Yes, log it (D-43)", () => {
  it("done: closes the panel, exits as logged, confirms with the logged snackbar", () => {
    expect(composePanelOutcome("yes", "done")).toEqual({
      closePanel: true,
      exit: "logged",
      deferUid: false,
      snackbar: "logged",
    });
  });

  it("closed: closes the panel without an exit and shows the closed snackbar", () => {
    expect(composePanelOutcome("yes", "closed")).toEqual({
      closePanel: true,
      exit: null,
      deferUid: false,
      snackbar: "closed",
    });
  });

  it.each(["failed", "busy"] as const)(
    "%s: the panel stays and nothing exits",
    (result) => {
      expect(composePanelOutcome("yes", result)).toEqual({
        closePanel: false,
        exit: null,
        deferUid: false,
        snackbar: null,
      });
    },
  );
});

describe("composePanelOutcome — No, don't log (D-78)", () => {
  it("done: closes the panel and stays on Compose with the draft (exit dismissed)", () => {
    expect(composePanelOutcome("dismiss", "done")).toEqual({
      closePanel: true,
      exit: "dismissed",
      deferUid: false,
      snackbar: "dismissed",
    });
  });

  it("closed (defensive only): closes the panel with the closed snackbar", () => {
    expect(composePanelOutcome("dismiss", "closed")).toEqual({
      closePanel: true,
      exit: null,
      deferUid: false,
      snackbar: "closed",
    });
  });

  it.each(["failed", "busy"] as const)("%s: the panel stays", (result) => {
    expect(composePanelOutcome("dismiss", result)).toEqual({
      closePanel: false,
      exit: null,
      deferUid: false,
      snackbar: null,
    });
  });
});

describe("composePanelOutcome — Later (D-77)", () => {
  it("defers the record, closes the panel, exits as later; no write, no snackbar", () => {
    expect(composePanelOutcome("later")).toEqual({
      closePanel: true,
      exit: "later",
      deferUid: true,
      snackbar: null,
    });
  });
});

describe("composeLoggedSnackbar (D-43, D-10)", () => {
  it("names text and email as Message, and the person", () => {
    expect(composeLoggedSnackbar("text", "Maya")).toBe(
      "Logged Message with Maya",
    );
    expect(composeLoggedSnackbar("email", "Maya")).toBe(
      "Logged Message with Maya",
    );
  });

  it("drops the name when there is none", () => {
    expect(composeLoggedSnackbar("text", null)).toBe("Logged Message");
  });
});
