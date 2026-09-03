/**
 * orbit-theme-migration — the one-time legacy → column mapper (THEME-13).
 *
 * The fixture is the REAL zustand persist ENVELOPE the old theme store wrote:
 * `{"state":{"mode":"dark","presetId":"space-dark"},"version":1}` — NOT a flat
 * `{mode, presetId}` object (REVIEWS 23-01 MEDIUM). A flat-only fixture is
 * false-green because it never exercises the real device payload; the guard test
 * below proves the mapper reads `parsed.state`, not the envelope's top level.
 *
 * PURE + RN-free: no native import, the mapper takes the already-parsed value.
 */
import { describe, expect, it } from "vitest";
import { mapLegacyThemeBlob } from "./orbit-theme-migration";

/** The real zustand persist envelope shape (state nested, version alongside). */
function envelope(
  state: Record<string, unknown>,
  version: unknown = 1,
): unknown {
  return { state, version };
}

describe("mapLegacyThemeBlob", () => {
  it("maps the REAL persist envelope space-dark/dark -> galaxy + galaxyMode dark", () => {
    const parsed = envelope({ mode: "dark", presetId: "space-dark" });
    expect(mapLegacyThemeBlob(parsed)).toEqual({
      themePackage: "galaxy",
      galaxyMode: "dark",
    });
  });

  it("reads parsed.state, NOT the envelope top level (the pre-fix defect)", () => {
    // A payload whose TOP LEVEL carries mode/presetId but whose `.state` is empty
    // must NOT map from the top level. Reading the top level (the defect) would
    // wrongly produce a galaxy patch; reading `.state` correctly no-ops.
    const misleading = {
      mode: "dark",
      presetId: "space-dark",
      state: {},
      version: 1,
    };
    expect(mapLegacyThemeBlob(misleading)).toEqual({});
  });

  it("tolerates an UNKNOWN version — still maps from .state", () => {
    const parsed = envelope({ mode: "light", presetId: "space-dark" }, 999);
    expect(mapLegacyThemeBlob(parsed)).toEqual({
      themePackage: "galaxy",
      galaxyMode: "light",
    });
  });

  it("tolerates a missing version field — still maps from .state", () => {
    const parsed = { state: { mode: "system", presetId: "space-dark" } };
    expect(mapLegacyThemeBlob(parsed)).toEqual({
      themePackage: "galaxy",
      galaxyMode: "system",
    });
  });

  it("defensively tolerates a bare flat {mode, presetId} blob (no envelope)", () => {
    expect(
      mapLegacyThemeBlob({ mode: "dark", presetId: "space-dark" }),
    ).toEqual({
      themePackage: "galaxy",
      galaxyMode: "dark",
    });
  });

  it("maps package but omits mode when the mode is unknown (never a bad column value)", () => {
    const parsed = envelope({ mode: "midnight", presetId: "space-dark" });
    expect(mapLegacyThemeBlob(parsed)).toEqual({ themePackage: "galaxy" });
  });

  it("no-ops on an unknown presetId (cannot know which package a mode belongs to)", () => {
    const parsed = envelope({ mode: "dark", presetId: "aurora-light" });
    expect(mapLegacyThemeBlob(parsed)).toEqual({});
  });

  it.each([
    { input: null, label: "null" },
    { input: undefined, label: "undefined" },
    { input: 42, label: "a number" },
    { input: "space-dark", label: "a bare string" },
    { input: {}, label: "an empty object" },
    { input: { state: null }, label: "a null state" },
    { input: { state: "dark" }, label: "a non-object state" },
    { input: { version: 1 }, label: "an envelope with no state" },
  ])("no-ops (empty patch) on $label", ({ input }) => {
    expect(mapLegacyThemeBlob(input)).toEqual({});
  });
});
