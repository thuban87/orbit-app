import { describe, expect, it } from "vitest";
import { applyAccent, resolveAccent } from "./accents";
import { resolveGlassForegroundPalette } from "./glass-foregrounds";
import { resolvePalette } from "./theme-presets";
import type { ResolvedMode, ThemePackage } from "./theme-types";

const PACKAGES: ThemePackage[] = ["galaxy", "standard"];
const MODES: ResolvedMode[] = ["dark", "light"];

function rootPalette(pkg: ThemePackage, mode: ResolvedMode) {
  return applyAccent(resolvePalette(pkg, mode), resolveAccent(null, pkg, mode));
}

describe("resolveGlassForegroundPalette — scope is Standard Light over an asset only (RG-029 / D-12 / D-24)", () => {
  it("returns null for Galaxy in both modes, with or without an asset", () => {
    for (const mode of MODES) {
      for (const backgroundIsAsset of [true, false]) {
        expect(
          resolveGlassForegroundPalette({
            palette: rootPalette("galaxy", mode),
            package: "galaxy",
            mode,
            accentId: null,
            backgroundIsAsset,
          }),
        ).toBeNull();
      }
    }
  });

  it("returns null for Standard Dark, with or without an asset", () => {
    for (const backgroundIsAsset of [true, false]) {
      expect(
        resolveGlassForegroundPalette({
          palette: rootPalette("standard", "dark"),
          package: "standard",
          mode: "dark",
          accentId: null,
          backgroundIsAsset,
        }),
      ).toBeNull();
    }
  });

  it("edge (empty): Standard Light over the solid `none` background is inactive (null)", () => {
    expect(
      resolveGlassForegroundPalette({
        palette: rootPalette("standard", "light"),
        package: "standard",
        mode: "light",
        accentId: null,
        backgroundIsAsset: false,
      }),
    ).toBeNull();
  });

  it("Standard Light over an asset resolves textSecondary to textPrimary", () => {
    const palette = rootPalette("standard", "light");
    const glass = resolveGlassForegroundPalette({
      palette,
      package: "standard",
      mode: "light",
      accentId: null,
      backgroundIsAsset: true,
    });
    expect(glass).not.toBeNull();
    expect(glass?.textSecondary).toBe(palette.textPrimary);
    expect(glass?.textPrimary).toBe(palette.textPrimary);
    // Every other key is carried through unchanged.
    for (const key of Object.keys(palette) as (keyof typeof palette)[]) {
      if (key === "textSecondary") continue;
      expect(glass?.[key], key).toEqual(palette[key]);
    }
  });

  it("is pure: never mutates the input palette and returns a new object", () => {
    const palette = rootPalette("standard", "light");
    const before = { ...palette };
    const glass = resolveGlassForegroundPalette({
      palette,
      package: "standard",
      mode: "light",
      accentId: null,
      backgroundIsAsset: true,
    });
    expect(glass).not.toBe(palette);
    expect(palette).toEqual(before);
  });

  it("every package × mode × asset flag outside Standard Light + asset is null", () => {
    for (const pkg of PACKAGES) {
      for (const mode of MODES) {
        for (const backgroundIsAsset of [true, false]) {
          const active =
            pkg === "standard" && mode === "light" && backgroundIsAsset;
          const out = resolveGlassForegroundPalette({
            palette: rootPalette(pkg, mode),
            package: pkg,
            mode,
            accentId: null,
            backgroundIsAsset,
          });
          expect(out === null, `${pkg}/${mode}/${backgroundIsAsset}`).toBe(
            !active,
          );
        }
      }
    }
  });
});
