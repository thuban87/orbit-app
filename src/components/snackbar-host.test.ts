import { describe, expect, it } from "vitest";
import { SPACING } from "@/theme/tokens/spacing";
import {
  ROOT_SNACKBAR_HOST,
  resolveSnackbarHostVisible,
  snackbarBottomPadding,
} from "./snackbar-host";

describe("resolveSnackbarHostVisible (D-40)", () => {
  it("renders the root host only when no overlay is open", () => {
    expect(resolveSnackbarHostVisible(ROOT_SNACKBAR_HOST, null)).toBe(true);
    expect(resolveSnackbarHostVisible(ROOT_SNACKBAR_HOST, "x")).toBe(false);
  });

  it("renders an overlay host only when it is the topmost overlay", () => {
    expect(resolveSnackbarHostVisible("x", "x")).toBe(true);
    expect(resolveSnackbarHostVisible("x", "y")).toBe(false);
    expect(resolveSnackbarHostVisible("x", null)).toBe(false);
  });

  it("exactly one host renders for any top", () => {
    const hosts = [ROOT_SNACKBAR_HOST, "a", "b"];
    for (const top of [null, "a", "b"]) {
      expect(
        hosts.filter((host) => resolveSnackbarHostVisible(host, top)),
      ).toHaveLength(1);
    }
  });
});

describe("snackbarBottomPadding (D-51)", () => {
  it("keeps the root host's tab-bar/+ clearance", () => {
    expect(snackbarBottomPadding(ROOT_SNACKBAR_HOST, 0)).toBe(112);
    expect(snackbarBottomPadding(ROOT_SNACKBAR_HOST, 48)).toBe(112);
  });

  it("sits just above the system navigation bar inside an overlay", () => {
    expect(snackbarBottomPadding("x", 48)).toBe(48 + SPACING.base);
    expect(snackbarBottomPadding("x", 0)).toBe(SPACING.base);
  });
});
