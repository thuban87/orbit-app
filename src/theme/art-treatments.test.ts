/**
 * Per-combination art treatment table (38.5-06; D-08, D-13, D-28).
 *
 * The production table reproduces TODAY's shipped treatment for every
 * combination and marked component (identity proof), so nothing shipped moves
 * before the owner re-signs over the new art (D-13). Unsigned see-through
 * opacities stay null and are never selectable (D-06, D-09).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ART_COMBINATION_KEYS,
  ART_COMPONENTS,
  ART_TREATMENTS,
  type ArtComponent,
  artBackgroundKey,
  artCombinationKey,
  artOpacityGroup,
  artScrimBacking,
  currentArtCell,
  resolveArtCell,
  resolveArtTreatment,
} from "./art-treatments";
import { BACKGROUND_ORDER, resolveBackground } from "./backgrounds";
import type { ResolvedMode, ThemePackage } from "./theme-types";
import {
  ART_SEE_THROUGH_OPACITY,
  artBackingOpacity,
  CARD_GLASS_OPACITY,
  cardMatchesMode,
  cardTintOpacity,
  chromeScrimOpacity,
  SURFACE,
} from "./tokens/surface";

const REPO = join(__dirname, "..", "..");
const PACKAGES: ThemePackage[] = ["galaxy", "standard"];
const MODES: ResolvedMode[] = ["light", "dark"];

/** Every (package, mode, background key) the lineup can render. */
const COMBOS = PACKAGES.flatMap((pkg) =>
  MODES.flatMap((mode) =>
    BACKGROUND_ORDER[pkg].map((slot) => ({
      pkg,
      mode,
      slot,
      key: artBackgroundKey(resolveBackground(pkg, slot, mode)),
    })),
  ),
);

function opacityOf(
  pkg: ThemePackage,
  mode: ResolvedMode,
  key: string,
  component: ArtComponent,
): number | null {
  const cell = resolveArtCell(ART_TREATMENTS, pkg, mode, key, component);
  const group = artOpacityGroup(component);
  if (group === null) throw new Error(`${component} has no opacity group`);
  return artBackingOpacity(pkg, mode, group, cell.backing);
}

describe("ART_COMPONENTS — the v2 sheet's field names (D-08)", () => {
  it("equals the component field set of the signed v2 answers exactly", () => {
    const v2 = JSON.parse(
      readFileSync(
        join(
          REPO,
          ".planning/phases/38.5-background-art-text-contrast/38.5-scrim-signoff-v2.json",
        ),
        "utf8",
      ),
    ) as { combos: Record<string, Record<string, unknown>> };
    const meta = new Set([
      "bg",
      "mode",
      "note",
      "reviewed",
      "theme",
      "updatedAt",
    ]);
    const fields = new Set<string>();
    for (const combo of Object.values(v2.combos)) {
      for (const key of Object.keys(combo)) if (!meta.has(key)) fields.add(key);
    }
    expect([...ART_COMPONENTS].sort()).toEqual([...fields].sort());
    expect(ART_COMPONENTS).toHaveLength(11);
  });
});

describe("combination keys", () => {
  it("has 16 keys: per package its 3 art slots + none, x 2 modes", () => {
    expect(ART_COMBINATION_KEYS).toHaveLength(16);
    expect(new Set(ART_COMBINATION_KEYS).size).toBe(16);
    expect(ART_COMBINATION_KEYS).toContain("galaxy-light-quiet");
    expect(ART_COMBINATION_KEYS).toContain("standard-dark-none");
    expect(ART_COMBINATION_KEYS).toContain("standard-light-paper");
    expect(Object.keys(ART_TREATMENTS).sort()).toEqual(
      [...ART_COMBINATION_KEYS].sort(),
    );
  });

  it("uses the v2 JSON key format <theme>-<mode>-<bg>", () => {
    expect(artCombinationKey("galaxy", "dark", "starfield")).toBe(
      "galaxy-dark-starfield",
    );
  });

  it("strips the package prefix from an asset slot and maps solid to none", () => {
    expect(
      artBackgroundKey(resolveBackground("galaxy", "galaxy-quiet", "dark")),
    ).toBe("quiet");
    expect(
      artBackgroundKey(resolveBackground("standard", "standard-dusk", "light")),
    ).toBe("dusk");
    expect(artBackgroundKey(resolveBackground("galaxy", "none", "light"))).toBe(
      "none",
    );
  });

  it("a retired, unknown or null stored id resolves to the default slot's row (edge)", () => {
    for (const stored of [null, "galaxy-deep-space", "galaxy-nebula", "bogus"]) {
      expect(
        artBackgroundKey(
          resolveBackground(
            "galaxy",
            stored as Parameters<typeof resolveBackground>[1],
            "dark",
          ),
        ),
      ).toBe("quiet");
    }
    expect(
      artBackgroundKey(resolveBackground("standard", "standard-mesh", "dark")),
    ).toBe("dawn");
  });
});

describe("identity: the production table reproduces today's treatment (D-13)", () => {
  it.each(COMBOS.map((c) => [`${c.pkg}-${c.mode}-${c.key}`, c]))(
    "%s",
    (_label, { pkg, mode, key }) => {
      // Count label and both headers: today's chromeScrimOpacity.
      for (const component of [
        "contactsCountLabel",
        "contactsHeader",
        "digestHeader",
      ] as const) {
        expect(opacityOf(pkg, mode, key, component)).toBe(
          chromeScrimOpacity(pkg, mode),
        );
      }
      // Card entries: today's GridCard dense card tint.
      expect(opacityOf(pkg, mode, key, "contactsCardEntries")).toBe(
        cardTintOpacity(pkg, mode, "dense"),
      );
      // List entries: today's solid fill.
      const list = resolveArtCell(
        ART_TREATMENTS,
        pkg,
        mode,
        key,
        "contactsListEntries",
      );
      expect(list.backing).toBe("full");
      expect(opacityOf(pkg, mode, key, "contactsListEntries")).toBe(1);
      // Top buttons and search stay full; Digest content has no backing.
      for (const component of [
        "contactsTopButtons",
        "contactsSearchAndToggle",
      ] as const) {
        expect(
          resolveArtCell(ART_TREATMENTS, pkg, mode, key, component).backing,
        ).toBe("full");
      }
      for (const component of [
        "digestSectionHeadings",
        "digestUpNextItems",
        "digestHorizonItems",
        "digestYourWeek",
      ] as const) {
        expect(
          resolveArtCell(ART_TREATMENTS, pkg, mode, key, component).backing,
        ).toBe("none");
      }
      // One foreground per combination x component, and it is the mode's.
      for (const component of ART_COMPONENTS) {
        const cell = resolveArtCell(ART_TREATMENTS, pkg, mode, key, component);
        expect(cell.foreground).toBe("mode");
        expect(cell.overflowLocalBacking).toBe(false);
      }
    },
  );

  it("the active Population/Filters/Sort trigger keeps today's border-only look (H-3 gap, recorded)", () => {
    for (const key of ART_COMBINATION_KEYS) {
      const row = ART_TREATMENTS[key];
      expect(row.contactsTopButtons.activeTriggerBacking).toBe("none");
      for (const component of ART_COMPONENTS) {
        if (component === "contactsTopButtons") continue;
        expect(row[component].activeTriggerBacking).toBeNull();
      }
    }
  });

  it("currentArtCell encodes the mode-matched rule (ADR-115)", () => {
    for (const pkg of PACKAGES) {
      for (const mode of MODES) {
        const glassy = cardMatchesMode(pkg, mode);
        expect(currentArtCell(pkg, mode, "contactsCardEntries").backing).toBe(
          glassy ? "seeThrough" : "full",
        );
        expect(currentArtCell(pkg, mode, "contactsListEntries").backing).toBe(
          "full",
        );
      }
    }
  });
});

describe("see-through opacities (D-06, D-09)", () => {
  it("no see-through cell of the production table has an unsigned (null) opacity", () => {
    for (const key of ART_COMBINATION_KEYS) {
      const [pkg, mode] = key.split("-") as [ThemePackage, ResolvedMode];
      for (const component of ART_COMPONENTS) {
        const cell = ART_TREATMENTS[key][component];
        if (cell.backing !== "seeThrough") continue;
        const group = artOpacityGroup(component);
        expect(group, `${key}.${component}`).not.toBeNull();
        if (group === null) continue;
        expect(
          ART_SEE_THROUGH_OPACITY[pkg][mode][group],
          `${key}.${component}`,
        ).not.toBeNull();
      }
    }
  });

  it("the only seeded values are today's shipped see-through values, by reference", () => {
    expect(ART_SEE_THROUGH_OPACITY.galaxy.dark).toEqual({
      listEntry: null,
      cardEntry: CARD_GLASS_OPACITY.galaxy,
      artChrome: chromeScrimOpacity("galaxy", "dark"),
    });
    expect(ART_SEE_THROUGH_OPACITY.standard.light).toEqual({
      listEntry: null,
      cardEntry: CARD_GLASS_OPACITY.standard,
      artChrome: chromeScrimOpacity("standard", "light"),
    });
    for (const [pkg, mode] of [
      ["galaxy", "light"],
      ["standard", "dark"],
    ] as const) {
      expect(ART_SEE_THROUGH_OPACITY[pkg][mode]).toEqual({
        listEntry: null,
        cardEntry: null,
        artChrome: null,
      });
    }
  });

  it("artBackingOpacity: full is today's opaque value, none draws nothing, an unsigned see-through fails safe to full", () => {
    for (const pkg of PACKAGES) {
      for (const mode of MODES) {
        expect(artBackingOpacity(pkg, mode, "listEntry", "full")).toBe(1);
        for (const group of ["cardEntry", "artChrome"] as const) {
          expect(artBackingOpacity(pkg, mode, group, "full")).toBe(
            SURFACE[pkg].densityOpacity.dense,
          );
        }
        for (const group of ["listEntry", "cardEntry", "artChrome"] as const) {
          expect(artBackingOpacity(pkg, mode, group, "none")).toBeNull();
          const signed = ART_SEE_THROUGH_OPACITY[pkg][mode][group];
          expect(artBackingOpacity(pkg, mode, group, "seeThrough")).toBe(
            signed ?? artBackingOpacity(pkg, mode, group, "full"),
          );
        }
      }
    }
  });

  it("artOpacityGroup maps the five marked components and nothing else", () => {
    expect(artOpacityGroup("contactsListEntries")).toBe("listEntry");
    expect(artOpacityGroup("contactsCardEntries")).toBe("cardEntry");
    expect(artOpacityGroup("contactsCountLabel")).toBe("artChrome");
    expect(artOpacityGroup("contactsHeader")).toBe("artChrome");
    expect(artOpacityGroup("digestHeader")).toBe("artChrome");
    for (const component of ART_COMPONENTS) {
      if (
        [
          "contactsListEntries",
          "contactsCardEntries",
          "contactsCountLabel",
          "contactsHeader",
          "digestHeader",
        ].includes(component)
      )
        continue;
      expect(artOpacityGroup(component)).toBeNull();
    }
  });

  it("the table module carries no opacity number (every opacity lives in surface.ts)", () => {
    const source = readFileSync(join(__dirname, "art-treatments.ts"), "utf8");
    expect(source.match(/0\.[0-9]+/g)).toBeNull();
  });
});

describe("resolveArtTreatment — the hook's pure core", () => {
  it("resolves the stored background through the resolver and returns cell + opacity", () => {
    const t = resolveArtTreatment(
      "galaxy",
      "dark",
      "galaxy-aurora",
      "contactsCountLabel",
    );
    expect(t.backing).toBe("seeThrough");
    expect(t.opacity).toBe(chromeScrimOpacity("galaxy", "dark"));
    expect(t.foreground).toBe("mode");
    expect(t.overflowLocalBacking).toBe(false);
    const light = resolveArtTreatment(
      "galaxy",
      "light",
      null,
      "contactsCardEntries",
    );
    expect(light.backing).toBe("full");
    expect(light.opacity).toBe(cardTintOpacity("galaxy", "light", "dense"));
  });

  it("a component without an opacity group reports opacity 1 when backed and null when bare", () => {
    expect(
      resolveArtTreatment("standard", "light", null, "contactsTopButtons")
        .opacity,
    ).toBe(1);
    expect(
      resolveArtTreatment("standard", "light", null, "digestYourWeek").opacity,
    ).toBeNull();
  });
});

describe("artScrimBacking — ChromeScrim / ShellAppBar backing decision", () => {
  it("a null treatment (no opt-in) is exactly today's scoped scrim at the default opacity", () => {
    expect(artScrimBacking(null, chromeScrimOpacity("standard", "dark"))).toEqual(
      { opacity: chromeScrimOpacity("standard", "dark"), scoped: true },
    );
  });

  it("backing none draws no scrim and leaves the children unscoped (D-10)", () => {
    expect(
      artScrimBacking({ backing: "none", opacity: null }, 1),
    ).toEqual({ opacity: null, scoped: false });
  });

  it("full and see-through draw the treatment's opacity and keep the scope", () => {
    const opacity = chromeScrimOpacity("galaxy", "dark");
    expect(
      artScrimBacking({ backing: "seeThrough", opacity }, 1),
    ).toEqual({ opacity, scoped: true });
  });
});
