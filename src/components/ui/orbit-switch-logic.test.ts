/**
 * Orbit switch logic + per-palette contrast gate (38.9 D-25, D-26, D-47;
 * review L3, C5-M2, C8-M4).
 *
 * The palette loop follows `src/theme/accents.test.ts`. AA thresholds are
 * never weakened here; a failing pair is an owner decision (the glyph colour
 * and the switch look are D-47 visual calls), never an allowlist entry.
 */
import { describe, expect, it } from "vitest";
import { ACCENTS } from "@/theme/accents";
import { AA_LARGE, contrastRatio } from "@/theme/contrast";
import { STANDARD_LIGHT_GLASS_ACCENT_TEXT } from "@/theme/glass-foregrounds";
import { ACCENT_IDS } from "@/theme/theme-option-ids";
import { resolvePalette } from "@/theme/theme-presets";
import type { ResolvedMode, ThemePackage } from "@/theme/theme-types";
import {
  resolveSwitchA11yState,
  resolveSwitchVisual,
  SWITCH_DISABLED_OPACITY,
  SWITCH_THUMB_OFF,
  SWITCH_THUMB_OFF_OFFSET,
  SWITCH_THUMB_ON,
  SWITCH_THUMB_ON_LEFT,
  SWITCH_THUMB_ON_TOP,
  SWITCH_TRACK_BORDER,
  SWITCH_TRACK_HEIGHT,
  SWITCH_TRACK_WIDTH,
} from "./orbit-switch-logic";

const PACKAGES: ThemePackage[] = ["galaxy", "standard"];
const MODES: ResolvedMode[] = ["dark", "light"];

describe("resolveSwitchVisual (D-26: disabled is dimmed and shows Off)", () => {
  it("enabled switches draw their stored value at full opacity", () => {
    expect(resolveSwitchVisual({ value: true, disabled: false })).toEqual({
      on: true,
      opacity: 1,
    });
    expect(resolveSwitchVisual({ value: false })).toEqual({
      on: false,
      opacity: 1,
    });
  });

  it("a disabled switch shows Off at the Button disabled opacity, whatever it stores", () => {
    expect(resolveSwitchVisual({ value: true, disabled: true })).toEqual({
      on: false,
      opacity: 0.5,
    });
    expect(resolveSwitchVisual({ value: false, disabled: true })).toEqual({
      on: false,
      opacity: 0.5,
    });
    expect(SWITCH_DISABLED_OPACITY).toBe(0.5);
  });
});

describe("resolveSwitchA11yState (review L3, C5-M2)", () => {
  it("checked follows the STORED value even when the disabled switch draws Off", () => {
    expect(resolveSwitchA11yState({ value: true, disabled: true })).toEqual({
      checked: true,
      disabled: true,
    });
    expect(resolveSwitchA11yState({ value: false, disabled: true })).toEqual({
      checked: false,
      disabled: true,
    });
    expect(resolveSwitchA11yState({ value: true })).toEqual({
      checked: true,
      disabled: false,
    });
  });

  it("carries busy only when busy is true", () => {
    expect(
      resolveSwitchA11yState({ value: false, disabled: true, busy: true }),
    ).toEqual({ checked: false, disabled: true, busy: true });
    const idle = resolveSwitchA11yState({ value: true, busy: false });
    expect("busy" in idle).toBe(false);
    expect("busy" in resolveSwitchA11yState({ value: true })).toBe(false);
  });
});

describe("SW-C geometry (mockup frame)", () => {
  it("the off thumb is inset 7 and the on thumb inset 3 from the track's outer edge", () => {
    expect(SWITCH_TRACK_WIDTH).toBe(48);
    expect(SWITCH_TRACK_HEIGHT).toBe(28);
    expect(SWITCH_THUMB_OFF_OFFSET + SWITCH_TRACK_BORDER).toBe(7);
    expect(SWITCH_THUMB_ON_TOP + SWITCH_TRACK_BORDER).toBe(3);
    expect(
      SWITCH_TRACK_WIDTH -
        (SWITCH_THUMB_ON_LEFT + SWITCH_TRACK_BORDER + SWITCH_THUMB_ON),
    ).toBe(3);
    expect(SWITCH_THUMB_ON).toBeGreaterThan(SWITCH_THUMB_OFF);
  });
});

describe("thumb contrast >= AA_LARGE in every package x mode (D-25, D-47)", () => {
  for (const pkg of PACKAGES) {
    for (const mode of MODES) {
      const p = resolvePalette(pkg, mode);

      it(`${pkg}/${mode}: off thumb (textSecondary) vs surface and background`, () => {
        // The off track is outlined only, so the thumb sits on whatever is
        // behind it. Glass scopes remap textSecondary -> textPrimary, which
        // only raises this ratio.
        expect(
          contrastRatio(p.textSecondary, p.surface),
        ).toBeGreaterThanOrEqual(AA_LARGE);
        expect(
          contrastRatio(p.textSecondary, p.background),
        ).toBeGreaterThanOrEqual(AA_LARGE);
      });

      it(`${pkg}/${mode}: on thumb (onAccent) vs the accent track`, () => {
        expect(contrastRatio(p.onAccent, p.accent)).toBeGreaterThanOrEqual(
          AA_LARGE,
        );
      });

      it(`${pkg}/${mode}: check glyph (accentText) vs the onAccent thumb (C8-M4)`, () => {
        expect(contrastRatio(p.accentText, p.onAccent)).toBeGreaterThanOrEqual(
          AA_LARGE,
        );
      });
    }
  }
});

describe("check glyph vs thumb for every curated accent (C8-M4)", () => {
  for (const id of ACCENT_IDS) {
    for (const mode of MODES) {
      const tone = ACCENTS[id][mode];
      it(`${id}/${mode}: accentText vs onAccent, and onAccent vs the fill`, () => {
        expect(contrastRatio(tone.text, tone.onAccent)).toBeGreaterThanOrEqual(
          AA_LARGE,
        );
        expect(contrastRatio(tone.onAccent, tone.fill)).toBeGreaterThanOrEqual(
          AA_LARGE,
        );
      });
    }

    it(`${id}: Standard-Light glass accentText vs the light onAccent thumb`, () => {
      // What `Icon tone="accentText"` resolves to inside a Standard Light glass
      // card (D-24/D-26 variant).
      expect(
        contrastRatio(
          STANDARD_LIGHT_GLASS_ACCENT_TEXT[id],
          ACCENTS[id].light.onAccent,
        ),
      ).toBeGreaterThanOrEqual(AA_LARGE);
    });
  }
});
