/**
 * The see-through List row's backing while it is swiped (38.5 review WR-01;
 * owner ruling R1a, D-48). The contrast proof for the 0.5 level, and the
 * recorded icon-over-glyph exemption, are in `theme/tokens/surface.test.ts`
 * ("Swiped see-through List row").
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ART_COMBINATION_KEYS,
  ART_TREATMENTS,
  listRowBacking,
  resolveArtTreatment,
} from "@/theme/art-treatments";
import type { ResolvedMode, ThemePackage } from "@/theme/theme-types";
import { ART_SEE_THROUGH_OPACITY } from "@/theme/tokens/surface";
import {
  SWIPE_ROW_BACKING_OPACITY,
  swipeRowTintOpacity,
} from "./list-row-swipe-backing";

/** Every production combination with the List row's rest backing. */
const LIST_CELLS = ART_COMBINATION_KEYS.map((key) => {
  const [pkg, mode, ...rest] = key.split("-") as [
    ThemePackage,
    ResolvedMode,
    ...string[],
  ];
  const bgKey = rest.join("-");
  const storedId = bgKey === "none" ? "none" : `${pkg}-${bgKey}`;
  const treatment = resolveArtTreatment(
    pkg,
    mode,
    storedId as Parameters<typeof resolveArtTreatment>[2],
    "contactsListEntries",
  );
  return {
    key,
    pkg,
    mode,
    signed: ART_TREATMENTS[key].contactsListEntries.backing,
    backing: listRowBacking(treatment),
  };
});

const SWIPES = [1, -1, 0.25, -0.25, 36, -36, 96, -96];

describe("swipeRowTintOpacity (D-48)", () => {
  it("the swiped level is the owner's 50%", () => {
    expect(SWIPE_ROW_BACKING_OPACITY).toBe(0.5);
  });

  it("covers all 16 combinations: 11 see-through List cells and 5 full", () => {
    // Full: the four None backgrounds and Standard Light · Paper (D-08 (b)).
    expect(LIST_CELLS).toHaveLength(16);
    expect(LIST_CELLS.filter((c) => c.signed === "seeThrough")).toHaveLength(
      11,
    );
    expect(LIST_CELLS.filter((c) => c.signed === "full")).toHaveLength(5);
    // No production List cell is `none`; the mapping still handles it below.
    expect(LIST_CELLS.filter((c) => c.signed === "none")).toHaveLength(0);
  });

  it.each(
    LIST_CELLS.filter((c) => c.signed === "seeThrough").map((c) => [c.key, c]),
  )(
    "%s (see-through): the signed level at rest, 0.5 while swiped",
    (_key, c) => {
      const signed = ART_SEE_THROUGH_OPACITY[c.pkg][c.mode].listEntry;
      expect(c.backing.tintOpacity).toBe(signed);
      expect(swipeRowTintOpacity(c.backing.tintOpacity, 0)).toBe(signed);
      expect(swipeRowTintOpacity(c.backing.tintOpacity, -0)).toBe(signed);
      for (const translation of SWIPES) {
        expect(
          swipeRowTintOpacity(c.backing.tintOpacity, translation),
          `translation ${translation}`,
        ).toBe(SWIPE_ROW_BACKING_OPACITY);
      }
    },
  );

  it.each(LIST_CELLS.filter((c) => c.signed === "full").map((c) => [c.key, c]))(
    "%s (full): no tint layer, unaffected by a swipe",
    (_key, c) => {
      expect(c.backing).toEqual({
        solidFill: true,
        tintOpacity: null,
        scoped: false,
      });
      for (const translation of [0, ...SWIPES]) {
        expect(swipeRowTintOpacity(c.backing.tintOpacity, translation)).toBe(
          null,
        );
      }
    },
  );

  it("a `none` row has no tint layer and is unaffected by a swipe", () => {
    const none = listRowBacking({ backing: "none", opacity: null });
    expect(none).toEqual({
      solidFill: false,
      tintOpacity: null,
      scoped: false,
    });
    for (const translation of [0, ...SWIPES]) {
      expect(swipeRowTintOpacity(none.tintOpacity, translation)).toBe(null);
    }
  });

  it("a swipe never makes a row thinner than its rest level", () => {
    expect(swipeRowTintOpacity(0.7, 0)).toBe(0.7);
    expect(swipeRowTintOpacity(0.7, 40)).toBe(0.7);
    expect(swipeRowTintOpacity(0, 40)).toBe(SWIPE_ROW_BACKING_OPACITY);
  });
});

describe("the swipe tint runs on the UI thread, not from React state (D-48)", () => {
  const helper = readFileSync(
    "src/components/list-row-swipe-backing.ts",
    "utf8",
  );
  const listRow = readFileSync("src/components/ListRow.tsx", "utf8");
  const home = readFileSync("src/screens/HomeScreen.tsx", "utf8");

  it("the mapping is a worklet, and the constant it reads is declared above it (Hermes)", () => {
    const constant = helper.indexOf(
      "export const SWIPE_ROW_BACKING_OPACITY = 0.5;",
    );
    const fn = helper.indexOf("export function swipeRowTintOpacity(");
    expect(constant).toBeGreaterThan(-1);
    expect(fn).toBeGreaterThan(constant);
    expect(helper.slice(fn, fn + 200)).toContain('"worklet";');
  });

  it("the row tint reads the swipe shared value through useAnimatedStyle", () => {
    const tint = listRow.slice(
      listRow.indexOf("function SwipeRowTint("),
      listRow.indexOf("function HighlightedSnippet("),
    );
    expect(tint).toMatch(/useAnimatedStyle\(\(\) => \(\{/);
    expect(tint).toMatch(
      /swipeRowTintOpacity\(restOpacity, translation\.value\)/,
    );
    // Declared above ListRow, which renders it.
    expect(listRow.indexOf("function SwipeRowTint(")).toBeLessThan(
      listRow.indexOf("export function ListRow("),
    );
  });

  it("the list host mirrors the swipeable's translation with useAnimatedReaction, with no React state", () => {
    const mirror = home.slice(
      home.indexOf("function SwipeTranslationMirror("),
      home.indexOf("function SwipeableListRow("),
    );
    expect(mirror).toMatch(/useAnimatedReaction\(/);
    expect(mirror).toMatch(/mirror\.value = value;/);
    const host = home.slice(
      home.indexOf("function SwipeableListRow("),
      home.indexOf("interface ListRowLine3"),
    );
    expect(host).toMatch(/const swipeTranslation = useSharedValue\(0\);/);
    expect(host).toMatch(/swipeTranslation=\{swipeTranslation\}/);
    expect(host).toMatch(/mirror=\{swipeTranslation\}/);
    expect(host).not.toMatch(/useState\(/);
  });
});
