import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  overviewColumnWidth,
  overviewTileWidth,
  packProfileOverviewPreview,
  profileOverviewWidthBasis,
} from "@/components/profile/overview-geometry";
import { createAllSectionsPreview } from "@/profile/layout-editor-reducer";
import { PROFILE_MODULE_REGISTRY } from "@/profile/module-registry";
import {
  OVERVIEW_MIN_TILE_WIDTH,
  packOverviewModules,
} from "@/profile/pack-overview";
import { FACTORY_PROFILE_LAYOUT } from "@/profile/presentation-schema";
import type { ProfileLayoutDocument, ProfileModuleSize } from "@/profile/types";
import { SPACING } from "@/theme/tokens/spacing";

const WINDOWS = [320, 360, 411] as const;
const FONT_SCALE = 1;

/**
 * The Profile overview's measured width, derived independently from the
 * rendered inset chain: ContactProfileScreen content padding (16/side) only.
 * The top-level section has no card and its body no horizontal padding
 * (38.14 D-51, D-55).
 */
function actualOverviewWidth(windowWidth: number): number {
  return windowWidth - 2 * 16;
}

/**
 * The preview tile container's own width inside the layout editor: Sheet body
 * paddingHorizontal (SPACING.lg/side) + Sheet left/right border (hairline,
 * bounded here at 1/side) + preview GlassSurface border (1/side) + preview
 * card padding (SPACING.base/side).
 */
function previewContentWidth(windowWidth: number): number {
  return windowWidth - 2 * SPACING.lg - 2 * 1 - 2 * 1 - 2 * SPACING.base;
}

function withSizes(
  pick: (supported: readonly ProfileModuleSize[]) => ProfileModuleSize,
): ProfileLayoutDocument {
  return {
    ...FACTORY_PROFILE_LAYOUT,
    overview: FACTORY_PROFILE_LAYOUT.overview.map((placement) => ({
      ...placement,
      size: pick(PROFILE_MODULE_REGISTRY[placement.id].supportedSizes),
    })),
  };
}

/** compact = 1x1 wherever supported; auto = factory sizes; wide = 2x1 wherever supported. */
const LAYOUTS: Record<"compact" | "auto" | "wide", ProfileLayoutDocument> = {
  compact: withSizes((supported) =>
    supported.includes("1x1") ? "1x1" : "2x1",
  ),
  auto: FACTORY_PROFILE_LAYOUT,
  wide: withSizes((supported) => (supported.includes("2x1") ? "2x1" : "1x1")),
};

/** What RelationshipOverview packs: the visible modules at its measured width. */
function actualPack(layout: ProfileLayoutDocument, windowWidth: number) {
  const visible = createAllSectionsPreview(layout).overview.filter(
    (module) => module.visible,
  );
  return packOverviewModules(visible, {
    width: actualOverviewWidth(windowWidth),
    fontScale: FONT_SCALE,
  });
}

function rows(packed: ReturnType<typeof packOverviewModules>) {
  return packed.placements.map(({ id, row, column, columnSpan }) => ({
    id,
    row,
    column,
    columnSpan,
  }));
}

describe("overview geometry helpers (RG-033 ui-accessibility/AUD-UIA-021)", () => {
  it("column width is (width − SPACING.sm·(columns − 1)) / columns", () => {
    expect(overviewColumnWidth(294, 1)).toBe(294);
    expect(overviewColumnWidth(345, 2)).toBe((345 - SPACING.sm) / 2);
    expect(overviewColumnWidth(500, 3)).toBe((500 - 2 * SPACING.sm) / 3);
    expect(overviewColumnWidth(4, 3)).toBe(0);
  });

  it("tile width is span·column + (span − 1)·SPACING.sm", () => {
    expect(overviewTileWidth(1, 140)).toBe(140);
    expect(overviewTileWidth(2, 140)).toBe(2 * 140 + SPACING.sm);
  });

  it("the Profile overview width basis is window − 32dp (38.14 D-55)", () => {
    for (const width of WINDOWS) {
      expect(profileOverviewWidthBasis(width)).toBe(actualOverviewWidth(width));
    }
    expect(profileOverviewWidthBasis(10)).toBe(0);
  });
});

describe("layout preview parity with the actual Relationship Overview", () => {
  for (const [name, layout] of Object.entries(LAYOUTS)) {
    for (const windowWidth of WINDOWS) {
      it(`${name} at ${windowWidth}dp packs the same rows and spans`, () => {
        const preview = packProfileOverviewPreview(
          createAllSectionsPreview(layout).overview,
          windowWidth,
          FONT_SCALE,
        );
        const actual = actualPack(layout, windowWidth);
        expect(preview.columns).toBe(actual.columns);
        expect(rows(preview)).toEqual(rows(actual));
      });

      it(`${name} at ${windowWidth}dp preview rows fit inside the preview card`, () => {
        const contentWidth = previewContentWidth(windowWidth);
        const preview = packProfileOverviewPreview(
          createAllSectionsPreview(layout).overview,
          windowWidth,
          FONT_SCALE,
        );
        const column = overviewColumnWidth(contentWidth, preview.columns);
        const byRow = new Map<number, number[]>();
        for (const placement of preview.placements) {
          const widths = byRow.get(placement.row) ?? [];
          widths.push(overviewTileWidth(placement.columnSpan, column));
          byRow.set(placement.row, widths);
        }
        for (const widths of byRow.values()) {
          const total =
            widths.reduce((sum, width) => sum + width, 0) +
            (widths.length - 1) * SPACING.sm;
          expect(total).toBeLessThanOrEqual(contentWidth + 1e-9);
        }
      });
    }
  }

  it("pins the column boundary: the real overview packs ONE column at 320dp and TWO at 360dp, so the preview does too (38.14 D-55)", () => {
    // Two columns need 2·144 + 8 = 296: 320 − 32 = 288 < 296 ≤ 360 − 32 = 328.
    expect(2 * OVERVIEW_MIN_TILE_WIDTH + SPACING.sm).toBe(296);
    expect(actualOverviewWidth(320)).toBe(288);
    expect(actualOverviewWidth(360)).toBe(328);
    const at = (windowWidth: number) =>
      packProfileOverviewPreview(
        createAllSectionsPreview(FACTORY_PROFILE_LAYOUT).overview,
        windowWidth,
        FONT_SCALE,
      ).columns;
    expect(at(320)).toBe(1);
    expect(at(360)).toBe(2);
    // The old carded window − 66 basis would wrongly pack one at 360.
    expect(
      packOverviewModules([], { width: 360 - 66, fontScale: FONT_SCALE })
        .columns,
    ).toBe(1);
  });
});

describe("Profile overview inset chain is pinned to its style sites", () => {
  const read = (path: string) =>
    readFileSync(new URL(path, import.meta.url), "utf8");

  it("ContactProfileScreen content padding is SPACING.base", () => {
    const source = read("../../screens/ContactProfileScreen.tsx");
    expect(source).toMatch(
      /\n {2}content: \{\n(?: {4}[^\n]*\n)*? {4}padding: SPACING\.base,\n/,
    );
  });

  it("a top-level ProfileSection body has no card and no horizontal padding (38.14 D-51, D-55)", () => {
    const source = read("./ProfileModuleHost.tsx");
    const pageBody = source.match(/\n {2}pageBody: \{([^}]*)\}/);
    expect(pageBody).not.toBeNull();
    expect(pageBody?.[1]).not.toMatch(
      /\bpadding(Horizontal|Left|Right|Start|End)?:/,
    );
    expect(source).toContain("<View style={styles.pageBody}>{children}</View>");
    // The section level renders a plain View, not a GlassSurface card.
    const section = source.slice(
      source.indexOf("function ProfileSection("),
      source.indexOf("export interface ProfileModuleHostProps"),
    );
    const pageBranch = section.slice(
      section.indexOf('if (level === "subsection")'),
    );
    const afterSubsection = pageBranch.slice(
      pageBranch.indexOf("</GlassSurface>"),
    );
    expect(afterSubsection).not.toContain("<GlassSurface");
  });

  it("the Relationship Overview renders as a top-level section", () => {
    const source = read("./ProfileModuleHost.tsx");
    const overview = source.slice(
      source.indexOf('renderer === "relationship-overview"'),
      source.indexOf("<RelationshipOverview"),
    );
    expect(overview).toContain('level="section"');
  });
});
