/**
 * Per-combination art treatment table: the v3 sync guard (38.5-08; D-08, D-13,
 * D-27, D-28, D-36, D-37, D-42..D-44).
 *
 * The production table and the see-through opacities are the owner's signed
 * re-sign-off v3 answers (`38.5-scrim-signoff-v3.json`, the assembled answer
 * with his chat amendments). Every cell and every signed level is compared with
 * that file, so the newer answer governs mechanically: an edit to either side
 * that the other does not mirror fails here (T-38.5-08-01). The file's
 * `transparent` is the table's `seeThrough` (the literal `transparent` lives
 * only in this test's mapping; `check:colors` flags it outside `/theme/`).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ART_COMBINATION_KEYS,
  ART_COMPONENTS,
  ART_TREATMENTS,
  type ArtBacking,
  type ArtComponent,
  type ArtForeground,
  applyArtDevOverrides,
  artBackgroundKey,
  artCombinationKey,
  artDevCombo,
  artOpacityGroup,
  artScrimBacking,
  controlTriggerBacking,
  currentArtCell,
  listRowBacking,
  resolveArtCell,
  resolveArtTreatment,
  TABLE_DRIVEN_COMPONENTS,
} from "./art-treatments";
import { BACKGROUND_ORDER, resolveBackground } from "./backgrounds";
import type { ResolvedMode, ThemePackage } from "./theme-types";
import {
  ART_SEE_THROUGH_OPACITY,
  type ArtOpacityGroup,
  artBackingOpacity,
  CARD_GLASS_OPACITY,
  cardTintOpacity,
  chromeScrimOpacity,
  SURFACE,
} from "./tokens/surface";

const REPO = join(__dirname, "..", "..");
const PHASE = ".planning/phases/38.5-background-art-text-contrast";
const PACKAGES: ThemePackage[] = ["galaxy", "standard"];
const MODES: ResolvedMode[] = ["light", "dark"];
const GROUPS: ArtOpacityGroup[] = ["listEntry", "cardEntry", "artChrome"];

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

/** The shape of the signed v3 file this guard reads (only what it checks). */
interface SignoffV3 {
  combos: Record<
    string,
    Record<string, unknown> & {
      theme: string;
      mode: string;
      bg: string;
      reviewed: boolean;
      /** Optional per-component foreground flag (none in the signed file). */
      foreground?: Partial<Record<ArtComponent, string>>;
    }
  >;
  treatmentValues: Record<string, Partial<Record<ArtOpacityGroup, number>>>;
  questions: {
    contactsHeaderOverflowBacking: string;
    seeThroughEntryForeground: Record<string, string>;
  };
  _meta: { unanswered: unknown[] };
}

const V3 = JSON.parse(
  readFileSync(join(REPO, PHASE, "38.5-scrim-signoff-v3.json"), "utf8"),
) as SignoffV3;

/** The sheet's vocabulary mapped to the table's (38.5-08: transparent -> seeThrough). */
const V3_BACKING: Record<string, ArtBacking> = {
  full: "full",
  transparent: "seeThrough",
  none: "none",
};

/** A foreground answer mapped to the table's: `flip` / `inverse` -> inverse. */
function mappedForeground(answer: string | undefined): ArtForeground {
  return answer === "flip" || answer === "inverse" ? "inverse" : "mode";
}

/** The signed foreground of one cell: its own flag, else the Q6 answer for a see-through entry, else the mode. */
function expectedForeground(
  comboKey: string,
  component: ArtComponent,
): ArtForeground {
  const combo = V3.combos[comboKey];
  const own = combo.foreground?.[component];
  if (own !== undefined) return mappedForeground(own);
  const entry =
    component === "contactsListEntries" || component === "contactsCardEntries";
  if (entry && V3_BACKING[String(combo[component])] === "seeThrough") {
    return mappedForeground(
      V3.questions.seeThroughEntryForeground[`${combo.theme}-${combo.mode}`],
    );
  }
  return "mode";
}

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

describe("ART_COMPONENTS — the sheet's field names (D-08, D-27)", () => {
  function fieldsOf(file: string): Set<string> {
    const json = JSON.parse(readFileSync(join(REPO, PHASE, file), "utf8")) as {
      combos: Record<string, Record<string, unknown>>;
    };
    const meta = new Set([
      "bg",
      "foreground",
      "mode",
      "note",
      "reviewed",
      "theme",
      "updatedAt",
    ]);
    const fields = new Set<string>();
    for (const combo of Object.values(json.combos)) {
      for (const key of Object.keys(combo)) if (!meta.has(key)) fields.add(key);
    }
    return fields;
  }

  it("equals the component field set of the signed v2 and v3 answers exactly", () => {
    expect([...ART_COMPONENTS].sort()).toEqual(
      [...fieldsOf("38.5-scrim-signoff-v2.json")].sort(),
    );
    expect([...ART_COMPONENTS].sort()).toEqual(
      [...fieldsOf("38.5-scrim-signoff-v3.json")].sort(),
    );
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

  it("uses the sheet's key format <theme>-<mode>-<bg>", () => {
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
    for (const stored of [
      null,
      "galaxy-deep-space",
      "galaxy-nebula",
      "bogus",
    ]) {
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

describe("v3 sync guard: the production table equals the signed answers (D-13, D-36)", () => {
  it("the signed file covers exactly the lineup's 16 combinations, all reviewed, none unanswered", () => {
    expect(Object.keys(V3.combos).sort()).toEqual(
      [...ART_COMBINATION_KEYS].sort(),
    );
    for (const [key, combo] of Object.entries(V3.combos)) {
      expect(
        artCombinationKey(
          combo.theme as ThemePackage,
          combo.mode as ResolvedMode,
          combo.bg,
        ),
      ).toBe(key);
      expect(combo.reviewed, key).toBe(true);
      for (const component of ART_COMPONENTS) {
        expect(Object.keys(V3_BACKING), `${key}.${component}`).toContain(
          combo[component],
        );
      }
    }
    expect(V3._meta.unanswered).toEqual([]);
  });

  it.each(ART_COMBINATION_KEYS.map((key) => [key]))(
    "%s: every cell's backing, foreground and ⋯ backing equal the signed answer",
    (key) => {
      const combo = V3.combos[key];
      const keepLocal =
        V3.questions.contactsHeaderOverflowBacking === "keep-local-backing";
      for (const component of ART_COMPONENTS) {
        const cell = ART_TREATMENTS[key][component];
        const label = `${key}.${component}`;
        expect(cell.backing, label).toBe(V3_BACKING[String(combo[component])]);
        expect(cell.foreground, label).toBe(expectedForeground(key, component));
        expect(cell.overflowLocalBacking, label).toBe(
          keepLocal &&
            component === "contactsHeader" &&
            cell.backing === "none",
        );
      }
    },
  );

  it("the ⋯ follows the header: no cell draws a local ⋯ backing (D-43)", () => {
    expect(V3.questions.contactsHeaderOverflowBacking).toBe("followHeader");
    for (const key of ART_COMBINATION_KEYS) {
      for (const component of ART_COMPONENTS) {
        expect(ART_TREATMENTS[key][component].overflowLocalBacking).toBe(false);
      }
    }
  });

  it("no cell is inverse: text keeps the mode default on the mode-matched art (D-44, D-10)", () => {
    for (const key of ART_COMBINATION_KEYS) {
      for (const component of ART_COMPONENTS) {
        expect(ART_TREATMENTS[key][component].foreground).toBe("mode");
      }
    }
  });

  it("the active Population/Filters/Sort trigger is filled in every combination (I1 ruled after v3: D-46)", () => {
    for (const key of ART_COMBINATION_KEYS) {
      const row = ART_TREATMENTS[key];
      expect(row.contactsTopButtons.activeTriggerBacking).toBe("full");
      for (const component of ART_COMPONENTS) {
        if (component === "contactsTopButtons") continue;
        expect(row[component].activeTriggerBacking).toBeNull();
      }
    }
  });
});

describe("v3 sync guard: the see-through levels equal the signed treatmentValues (D-37, D-42)", () => {
  it("ART_SEE_THROUGH_OPACITY equals treatmentValues for every package × mode × group; an unsigned group is null", () => {
    for (const pkg of PACKAGES) {
      for (const mode of MODES) {
        const signed = V3.treatmentValues[`${pkg}-${mode}`] ?? {};
        for (const group of GROUPS) {
          expect(
            ART_SEE_THROUGH_OPACITY[pkg][mode][group],
            `${pkg}-${mode}.${group}`,
          ).toBe(signed[group] ?? null);
        }
      }
    }
    // Every signed level is carried (no extra key in the file is dropped).
    for (const [pkgMode, groups] of Object.entries(V3.treatmentValues)) {
      const [pkg, mode] = pkgMode.split("-") as [ThemePackage, ResolvedMode];
      for (const [group, value] of Object.entries(groups)) {
        expect(
          ART_SEE_THROUGH_OPACITY[pkg][mode][group as ArtOpacityGroup],
          `${pkgMode}.${group}`,
        ).toBe(value);
      }
    }
  });

  it("the unsigned (null) groups are exactly Galaxy Light artChrome, and no see-through cell uses it", () => {
    const nulls: string[] = [];
    for (const pkg of PACKAGES) {
      for (const mode of MODES) {
        for (const group of GROUPS) {
          if (ART_SEE_THROUGH_OPACITY[pkg][mode][group] === null) {
            nulls.push(`${pkg}-${mode}.${group}`);
          }
        }
      }
    }
    expect(nulls).toEqual(["galaxy-light.artChrome"]);
  });

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

  it("today's values the owner kept stay by reference; other cards and chrome keep today's constants (D-28, D-42)", () => {
    expect(ART_SEE_THROUGH_OPACITY.galaxy.dark.cardEntry).toBe(
      CARD_GLASS_OPACITY.galaxy,
    );
    expect(ART_SEE_THROUGH_OPACITY.galaxy.dark.artChrome).toBe(
      chromeScrimOpacity("galaxy", "dark"),
    );
    expect(ART_SEE_THROUGH_OPACITY.standard.light.artChrome).toBe(
      chromeScrimOpacity("standard", "light"),
    );
    const source = readFileSync(
      join(__dirname, "tokens", "surface.ts"),
      "utf8",
    );
    expect(source).toMatch(/cardEntry: CARD_GLASS_OPACITY\.galaxy,/);
    expect(source).toMatch(
      /artChrome: chromeScrimOpacity\("galaxy", "dark"\),/,
    );
    expect(source).toMatch(
      /artChrome: chromeScrimOpacity\("standard", "light"\),/,
    );
    // The Contacts-card level moved (0.5 -> 0.05); every other card did not.
    expect(CARD_GLASS_OPACITY.standard).toBe(0.5);
    expect(cardTintOpacity("standard", "light", "dense")).toBe(
      CARD_GLASS_OPACITY.standard,
    );
    expect(ART_SEE_THROUGH_OPACITY.standard.light.cardEntry).not.toBe(
      CARD_GLASS_OPACITY.standard,
    );
  });

  it("artBackingOpacity: full is today's opaque value, none draws nothing, see-through is the signed level (fail-safe to full if unsigned)", () => {
    for (const pkg of PACKAGES) {
      for (const mode of MODES) {
        expect(artBackingOpacity(pkg, mode, "listEntry", "full")).toBe(1);
        for (const group of ["cardEntry", "artChrome"] as const) {
          expect(artBackingOpacity(pkg, mode, group, "full")).toBe(
            SURFACE[pkg].densityOpacity.dense,
          );
        }
        for (const group of GROUPS) {
          expect(artBackingOpacity(pkg, mode, group, "none")).toBeNull();
          const signed = ART_SEE_THROUGH_OPACITY[pkg][mode][group];
          expect(artBackingOpacity(pkg, mode, group, "seeThrough")).toBe(
            signed ?? artBackingOpacity(pkg, mode, group, "full"),
          );
        }
      }
    }
    // A signed 0 (Standard Dark count label, Q2g R1) is a real level, not "unsigned".
    expect(
      artBackingOpacity("standard", "dark", "artChrome", "seeThrough"),
    ).toBe(0);
  });

  it("every production cell's opacity is its group's signed level or today's full value", () => {
    for (const { pkg, mode, key } of COMBOS) {
      for (const component of TABLE_DRIVEN_COMPONENTS) {
        const group = artOpacityGroup(component) as ArtOpacityGroup;
        const backing =
          V3_BACKING[String(V3.combos[`${pkg}-${mode}-${key}`][component])];
        const want =
          backing === "none"
            ? null
            : backing === "full"
              ? group === "listEntry"
                ? 1
                : SURFACE[pkg].densityOpacity.dense
              : V3.treatmentValues[`${pkg}-${mode}`][group];
        expect(
          opacityOf(pkg, mode, key, component),
          `${pkg}-${mode}-${key}.${component}`,
        ).toBe(want);
      }
    }
  });

  it("artOpacityGroup maps the five table-driven components and nothing else", () => {
    expect(artOpacityGroup("contactsListEntries")).toBe("listEntry");
    expect(artOpacityGroup("contactsCardEntries")).toBe("cardEntry");
    expect(artOpacityGroup("contactsCountLabel")).toBe("artChrome");
    expect(artOpacityGroup("contactsHeader")).toBe("artChrome");
    expect(artOpacityGroup("digestHeader")).toBe("artChrome");
    for (const component of ART_COMPONENTS) {
      if ((TABLE_DRIVEN_COMPONENTS as readonly string[]).includes(component))
        continue;
      expect(artOpacityGroup(component)).toBeNull();
    }
  });

  it("the table module carries no opacity number (every opacity lives in surface.ts)", () => {
    const source = readFileSync(join(__dirname, "art-treatments.ts"), "utf8");
    expect(source.match(/0\.[0-9]+/g)).toBeNull();
  });
});

/**
 * The pre-38.5 cell with the owner's one post-v3 ruling outside the table-driven
 * set applied: the top buttons' active trigger is filled (D-46; it is read only
 * by `DashboardControlRow`'s active state, never as a component backing).
 */
function expectedUnmarkedCell(
  pkg: ThemePackage,
  mode: ResolvedMode,
  component: ArtComponent,
) {
  const before = currentArtCell(pkg, mode, component);
  return component === "contactsTopButtons"
    ? { ...before, activeTriggerBacking: "full" as const }
    : before;
}

describe("TABLE_DRIVEN_COMPONENTS — only the marked components move (D-28)", () => {
  /** Where each table-driven component opts in (the source-scan contract in art-treatment-scope-contract.test.ts). */
  const OPT_IN: Record<string, { file: string; pattern: RegExp }> = {
    contactsListEntries: {
      file: "src/components/ListRow.tsx",
      pattern: /useArtTreatment\("contactsListEntries"\)/,
    },
    contactsCardEntries: {
      file: "src/components/ui/GlassSurface.tsx",
      pattern: /"contact-entry" \? "contactsCardEntries"/,
    },
    contactsCountLabel: {
      file: "src/screens/HomeScreen.tsx",
      pattern: /artComponent="contactsCountLabel"/,
    },
    contactsHeader: {
      file: "src/screens/HomeScreen.tsx",
      pattern: /artComponent="contactsHeader"/,
    },
    digestHeader: {
      file: "src/screens/DigestScreen.tsx",
      pattern: /artComponent="digestHeader"/,
    },
  };

  it("is the five v2-marked components (v3 changed nothing outside them)", () => {
    expect([...TABLE_DRIVEN_COMPONENTS].sort()).toEqual(
      [
        "contactsCardEntries",
        "contactsCountLabel",
        "contactsHeader",
        "contactsListEntries",
        "digestHeader",
      ].sort(),
    );
  });

  it("every component whose signed column differs from its pre-38.5 behaviour is table-driven", () => {
    const changed = new Set<ArtComponent>();
    for (const { pkg, mode, key } of COMBOS) {
      for (const component of ART_COMPONENTS) {
        const before = expectedUnmarkedCell(pkg, mode, component);
        const now = resolveArtCell(ART_TREATMENTS, pkg, mode, key, component);
        const opacityMoved =
          artOpacityGroup(component) !== null &&
          opacityOf(pkg, mode, key, component) !==
            artBackingOpacity(
              pkg,
              mode,
              artOpacityGroup(component) as ArtOpacityGroup,
              before.backing,
            );
        if (
          now.backing !== before.backing ||
          now.foreground !== before.foreground ||
          now.overflowLocalBacking !== before.overflowLocalBacking ||
          now.activeTriggerBacking !== before.activeTriggerBacking ||
          opacityMoved
        ) {
          changed.add(component);
        }
      }
    }
    for (const component of changed) {
      expect(TABLE_DRIVEN_COMPONENTS, component).toContain(component);
    }
  });

  it("every other component's signed column equals its pre-38.5 behaviour in every combination", () => {
    for (const { pkg, mode, key } of COMBOS) {
      for (const component of ART_COMPONENTS) {
        if ((TABLE_DRIVEN_COMPONENTS as readonly string[]).includes(component))
          continue;
        expect(
          resolveArtCell(ART_TREATMENTS, pkg, mode, key, component),
          `${pkg}-${mode}-${key}.${component}`,
        ).toEqual(expectedUnmarkedCell(pkg, mode, component));
      }
    }
  });

  it("each table-driven component has exactly its opt-in consumer", () => {
    for (const component of TABLE_DRIVEN_COMPONENTS) {
      const optIn = OPT_IN[component];
      expect(optIn, component).toBeDefined();
      expect(
        readFileSync(join(REPO, optIn.file), "utf8"),
        `${component} opt-in in ${optIn.file}`,
      ).toMatch(optIn.pattern);
    }
  });
});

describe("resolveArtTreatment — the hook's pure core", () => {
  it("resolves the stored background through the resolver and returns cell + signed opacity", () => {
    const t = resolveArtTreatment(
      "galaxy",
      "dark",
      "galaxy-aurora",
      "contactsCountLabel",
    );
    expect(t.backing).toBe("seeThrough");
    expect(t.opacity).toBe(ART_SEE_THROUGH_OPACITY.galaxy.dark.artChrome);
    expect(t.foreground).toBe("mode");
    expect(t.overflowLocalBacking).toBe(false);
    // Galaxy Light, the default slot: see-through cards at the signed level.
    const light = resolveArtTreatment(
      "galaxy",
      "light",
      null,
      "contactsCardEntries",
    );
    expect(light.backing).toBe("seeThrough");
    expect(light.opacity).toBe(V3.treatmentValues["galaxy-light"].cardEntry);
    // Standard Dark · Dawn: the Contacts header has no backing (D-36).
    const header = resolveArtTreatment(
      "standard",
      "dark",
      "standard-dawn",
      "contactsHeader",
    );
    expect(header.backing).toBe("none");
    expect(header.opacity).toBeNull();
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
    expect(
      artScrimBacking(null, chromeScrimOpacity("standard", "dark")),
    ).toEqual({
      opacity: chromeScrimOpacity("standard", "dark"),
      scoped: true,
    });
  });

  it("backing none draws no scrim and leaves the children unscoped (D-10)", () => {
    expect(artScrimBacking({ backing: "none", opacity: null }, 1)).toEqual({
      opacity: null,
      scoped: false,
    });
  });

  it("full and see-through draw the treatment's opacity and keep the scope", () => {
    const opacity = chromeScrimOpacity("galaxy", "dark");
    expect(artScrimBacking({ backing: "seeThrough", opacity }, 1)).toEqual({
      opacity,
      scoped: true,
    });
  });
});

describe("listRowBacking — the table-driven List row (38.5-06 Task 2)", () => {
  it("no treatment or full keeps today's solid fill, unscoped", () => {
    const today = { solidFill: true, tintOpacity: null, scoped: false };
    expect(listRowBacking(null)).toEqual(today);
    expect(listRowBacking({ backing: "full", opacity: 1 })).toEqual(today);
  });

  it("see-through draws a tint at the cell opacity and scopes the content", () => {
    const opacity = CARD_GLASS_OPACITY.galaxy;
    expect(listRowBacking({ backing: "seeThrough", opacity })).toEqual({
      solidFill: false,
      tintOpacity: opacity,
      scoped: true,
    });
  });

  it("none draws neither fill nor tint and leaves the content unscoped", () => {
    expect(listRowBacking({ backing: "none", opacity: null })).toEqual({
      solidFill: false,
      tintOpacity: null,
      scoped: false,
    });
  });

  it("the production List row follows the signed cell in every combination (D-36, D-37)", () => {
    for (const { pkg, mode, slot, key } of COMBOS) {
      const signed =
        V3_BACKING[
          String(V3.combos[`${pkg}-${mode}-${key}`].contactsListEntries)
        ];
      const want =
        signed === "full"
          ? { solidFill: true, tintOpacity: null, scoped: false }
          : signed === "none"
            ? { solidFill: false, tintOpacity: null, scoped: false }
            : {
                solidFill: false,
                tintOpacity: V3.treatmentValues[`${pkg}-${mode}`].listEntry,
                scoped: true,
              };
      expect(
        listRowBacking(
          resolveArtTreatment(pkg, mode, slot, "contactsListEntries"),
        ),
        `${pkg}-${mode}-${key}`,
      ).toEqual(want);
    }
  });
});

describe("contact-entry cards — GlassSurface treatment (38.5-06 Task 2)", () => {
  it("the Card-entry backing follows the signed cell, scoped, in every combination (D-36, D-42)", () => {
    for (const { pkg, mode, slot, key } of COMBOS) {
      const signed =
        V3_BACKING[
          String(V3.combos[`${pkg}-${mode}-${key}`].contactsCardEntries)
        ];
      const t = resolveArtTreatment(pkg, mode, slot, "contactsCardEntries");
      expect(
        artScrimBacking(t, cardTintOpacity(pkg, mode, "dense")),
        `${pkg}-${mode}-${key}`,
      ).toEqual(
        signed === "none"
          ? { opacity: null, scoped: false }
          : {
              opacity:
                signed === "full"
                  ? SURFACE[pkg].densityOpacity.dense
                  : V3.treatmentValues[`${pkg}-${mode}`].cardEntry,
              scoped: true,
            },
      );
    }
  });
});

describe("controlTriggerBacking — Population/Filters/Sort (orchestrator addition, H-3)", () => {
  it("an inactive trigger is always full, whatever the cell says (D-04, D-12)", () => {
    expect(controlTriggerBacking(false, null)).toBe("full");
    expect(controlTriggerBacking(false, "none")).toBe("full");
    expect(controlTriggerBacking(false, "full")).toBe("full");
  });

  it("an active trigger takes the table's active backing; no treatment is today's border-only look", () => {
    expect(controlTriggerBacking(true, null)).toBe("none");
    expect(controlTriggerBacking(true, "none")).toBe("none");
    expect(controlTriggerBacking(true, "full")).toBe("full");
  });

  it("production: every combination's active trigger keeps the regular fill (D-46)", () => {
    for (const { pkg, mode, slot } of COMBOS) {
      const t = resolveArtTreatment(pkg, mode, slot, "contactsTopButtons");
      expect(controlTriggerBacking(true, t.activeTriggerBacking)).toBe("full");
      expect(controlTriggerBacking(false, t.activeTriggerBacking)).toBe("full");
    }
  });
  it("D-46 is the only change to the top buttons: their cell differs from pre-38.5 in activeTriggerBacking alone", () => {
    for (const { pkg, mode, key } of COMBOS) {
      const before = currentArtCell(pkg, mode, "contactsTopButtons");
      const now = resolveArtCell(
        ART_TREATMENTS,
        pkg,
        mode,
        key,
        "contactsTopButtons",
      );
      expect(before.activeTriggerBacking).toBe("none");
      expect(now).toEqual({ ...before, activeTriggerBacking: "full" });
    }
  });
});

describe("DEV-only override path (38.5-06 Task 3; T-38.5-06-01)", () => {
  const cell = currentArtCell("galaxy", "dark", "contactsHeader");
  const opacity = chromeScrimOpacity("galaxy", "dark");
  const comboKey = "galaxy-dark-aurora";

  it("the committed override file parses and is disabled", () => {
    const committed = JSON.parse(
      readFileSync(
        join(__dirname, "__dev__", "art-treatment-dev-overrides.json"),
        "utf8",
      ),
    ) as { enabled?: unknown };
    expect(committed.enabled).toBe(false);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    [
      "disabled",
      {
        enabled: false,
        cells: { [comboKey]: { contactsHeader: { backing: "none" } } },
      },
    ],
    ["not an object", "enabled"],
  ])(
    "returns the input unchanged when overrides are %s",
    (_label, overrides) => {
      expect(
        applyArtDevOverrides(
          cell,
          opacity,
          overrides,
          comboKey,
          "contactsHeader",
          "artChrome",
        ),
      ).toEqual({ cell, opacity });
    },
  );

  it("a cell override replaces backing and overflowLocalBacking, and the opacity follows the backing", () => {
    const out = applyArtDevOverrides(
      cell,
      opacity,
      {
        enabled: true,
        cells: {
          [comboKey]: {
            contactsHeader: { backing: "none", overflowLocalBacking: true },
          },
        },
      },
      comboKey,
      "contactsHeader",
      "artChrome",
    );
    expect(out.cell).toEqual({
      ...cell,
      backing: "none",
      overflowLocalBacking: true,
    });
    expect(out.opacity).toBeNull();
  });

  it("a cell override for another combination or component is ignored", () => {
    const overrides = {
      enabled: true,
      cells: {
        "galaxy-dark-quiet": { contactsHeader: { backing: "none" } },
        [comboKey]: { digestHeader: { backing: "none" } },
      },
    };
    expect(
      applyArtDevOverrides(
        cell,
        opacity,
        overrides,
        comboKey,
        "contactsHeader",
        "artChrome",
      ),
    ).toEqual({ cell, opacity });
  });

  it("an opacity override for the <pkg>-<mode> group replaces the see-through opacity (a candidate or card-blend value)", () => {
    const candidate = CARD_GLASS_OPACITY.galaxy / 2;
    const cardCell = currentArtCell("galaxy", "light", "contactsCardEntries");
    const out = applyArtDevOverrides(
      cardCell,
      cardTintOpacity("galaxy", "light", "dense"),
      {
        enabled: true,
        cells: {
          "galaxy-light-quiet": {
            contactsCardEntries: { backing: "seeThrough" },
          },
        },
        opacity: { "galaxy-light": { cardEntry: candidate } },
      },
      "galaxy-light-quiet",
      "contactsCardEntries",
      "cardEntry",
    );
    expect(out.cell.backing).toBe("seeThrough");
    expect(out.opacity).toBe(candidate);
  });

  it("an opacity override never applies to a full or none backing", () => {
    const overrides = {
      enabled: true,
      opacity: { "galaxy-light": { artChrome: 0 } },
    };
    const full = currentArtCell("galaxy", "light", "contactsHeader");
    expect(
      applyArtDevOverrides(
        full,
        chromeScrimOpacity("galaxy", "light"),
        overrides,
        "galaxy-light-quiet",
        "contactsHeader",
        "artChrome",
      ).opacity,
    ).toBe(chromeScrimOpacity("galaxy", "light"));
  });

  it("an unsigned see-through without a candidate fails safe to the full value", () => {
    // Galaxy Light artChrome is the one group the owner left unsigned (null).
    expect(ART_SEE_THROUGH_OPACITY.galaxy.light.artChrome).toBeNull();
    const out = applyArtDevOverrides(
      resolveArtCell(
        ART_TREATMENTS,
        "galaxy",
        "light",
        "aurora",
        "contactsHeader",
      ),
      null,
      {
        enabled: true,
        cells: {
          "galaxy-light-aurora": {
            contactsHeader: { backing: "seeThrough" },
          },
        },
      },
      "galaxy-light-aurora",
      "contactsHeader",
      "artChrome",
    );
    expect(out.cell.backing).toBe("seeThrough");
    expect(out.opacity).toBe(SURFACE.galaxy.densityOpacity.dense);
  });

  it("invalid override values are ignored (backing, flags, out-of-range opacity)", () => {
    const out = applyArtDevOverrides(
      cell,
      opacity,
      {
        enabled: true,
        cells: {
          [comboKey]: {
            contactsHeader: {
              backing: "transparent",
              overflowLocalBacking: "yes",
            },
          },
        },
        opacity: { "galaxy-dark": { artChrome: 2 } },
      },
      comboKey,
      "contactsHeader",
      "artChrome",
    );
    expect(out).toEqual({ cell, opacity });
  });

  it("the active-trigger backing of the top buttons can be overridden (H-3 capture)", () => {
    const top = currentArtCell("standard", "light", "contactsTopButtons");
    const out = applyArtDevOverrides(
      top,
      1,
      {
        enabled: true,
        cells: {
          "standard-light-dawn": {
            contactsTopButtons: { activeTriggerBacking: "full" },
          },
        },
      },
      "standard-light-dawn",
      "contactsTopButtons",
      null,
    );
    expect(out.cell.activeTriggerBacking).toBe("full");
    expect(out.opacity).toBe(1);
  });

  it("resolveArtTreatment passes its result through the overrides", () => {
    const t = resolveArtTreatment(
      "galaxy",
      "dark",
      "galaxy-aurora",
      "contactsHeader",
      {
        enabled: true,
        cells: { [comboKey]: { contactsHeader: { backing: "none" } } },
      },
    );
    expect(t.backing).toBe("none");
    expect(t.opacity).toBeNull();
  });

  it("artDevCombo validates the in-memory combination (slot id or short key)", () => {
    expect(artDevCombo(null)).toBeNull();
    expect(
      artDevCombo({
        enabled: false,
        combo: { package: "galaxy", mode: "dark", background: "aurora" },
      }),
    ).toBeNull();
    expect(
      artDevCombo({
        enabled: true,
        combo: { package: "galaxy", mode: "light", background: "aurora" },
      }),
    ).toEqual({
      package: "galaxy",
      mode: "light",
      background: "galaxy-aurora",
    });
    expect(
      artDevCombo({
        enabled: true,
        combo: {
          package: "standard",
          mode: "dark",
          background: "standard-paper",
        },
      }),
    ).toEqual({
      package: "standard",
      mode: "dark",
      background: "standard-paper",
    });
    expect(
      artDevCombo({
        enabled: true,
        combo: { package: "standard", mode: "dark", background: "none" },
      }),
    ).toEqual({ package: "standard", mode: "dark", background: "none" });
    // Another package's slot, a retired slot, a bad mode: rejected.
    for (const combo of [
      { package: "standard", mode: "dark", background: "galaxy-aurora" },
      { package: "galaxy", mode: "dark", background: "galaxy-nebula" },
      { package: "galaxy", mode: "system", background: "aurora" },
      { package: "orbit", mode: "dark", background: "aurora" },
    ]) {
      expect(artDevCombo({ enabled: true, combo })).toBeNull();
    }
  });
});
