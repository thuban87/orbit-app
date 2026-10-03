import { describe, expect, it, vi } from "vitest";

/** A deterministic stand-in for Skia's token parser: distinct per token. */
const parse = vi.hoisted(() => (token: string) => {
  let hash = 0;
  for (let i = 0; i < token.length; i++)
    hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
  return Float32Array.of(
    (hash % 251) / 250,
    ((hash >> 8) % 251) / 250,
    ((hash >> 16) % 251) / 250,
    1,
  );
});
vi.mock("@shopify/react-native-skia", () => ({ Skia: { Color: parse } }));

import type { ProfileStatus } from "@/db/contact-status-read";
import { orreryRingStyle } from "@/logic/orrery-ring-logic";
import { THEME_PRESETS } from "@/theme/theme-presets";
import type { OrreryBodyResource } from "../use-orrery-switch-runtime";
import {
  buildFocusOutlines,
  buildOverlayInk,
  buildRingSpecs,
  buildSkySpec,
  buildStarField,
  RING_DASH_PERIOD_DP,
  STAR_COUNT,
  seeded,
  tokenInk,
} from "./scene-specs";

const inkOf = (token: string) => [...parse(token)];

function resources(statuses: (ProfileStatus | null)[]): OrreryBodyResource[] {
  const scene = {
    contacts: statuses.map((status, i) => ({ id: i + 1, status })),
  } as never as OrreryBodyResource["scene"];
  return [
    {
      key: "sun:0",
      body: { id: 0, kind: "sun", x: 0, y: 0, radius: 30, ringRadius: 0 },
      scene,
    },
    ...statuses.map((_, i) => ({
      key: `contact:${i + 1}`,
      body: {
        id: i + 1,
        kind: "contact" as const,
        x: 0,
        y: -(60 + i * 34),
        radius: 16,
        ringRadius: 60 + i * 34,
      },
      scene,
    })),
  ];
}

describe("buildRingSpecs (today's status ring look, as numbers)", () => {
  const themes = [
    THEME_PRESETS.galaxy.dark,
    THEME_PRESETS.galaxy.light,
    THEME_PRESETS.standard.dark,
    THEME_PRESETS.standard.light,
  ];
  it.each(themes.map((colors, i) => [i, colors] as const))(
    "theme %i: ink, width, alpha and dash per status; no spec for the sun",
    (_i, colors) => {
      const statuses = ["stable", "wobble", "decay", "rogue", null] as const;
      const specs = buildRingSpecs(resources([...statuses]), colors);
      expect(Object.keys(specs).sort()).toEqual(
        statuses.map((_, i) => `contact:${i + 1}`).sort(),
      );
      const expected = {
        stable: { alpha: 1, dash: 0 },
        wobble: { alpha: 1, dash: RING_DASH_PERIOD_DP },
        decay: { alpha: 0.7, dash: 0 },
        rogue: { alpha: 0.3, dash: RING_DASH_PERIOD_DP },
        null: { alpha: 0.5, dash: 0 },
      } as const;
      statuses.forEach((status, i) => {
        const style = orreryRingStyle(status, colors);
        const spec = specs[`contact:${i + 1}`];
        expect(spec.ink).toEqual(inkOf(style.color));
        expect(spec.widthDp).toBe(style.width);
        expect(spec.alpha).toBe(
          expected[String(status) as keyof typeof expected].alpha,
        );
        expect(spec.dashPeriodDp).toBe(
          expected[String(status) as keyof typeof expected].dash,
        );
      });
      // Status colours come from the theme: the four statuses differ.
      expect(
        new Set(
          statuses
            .slice(0, 4)
            .map((_s, i) => String(specs[`contact:${i + 1}`].ink)),
        ).size,
      ).toBe(4);
    },
  );
  it("a theme change re-keys the inks (specs are rebuilt on theme change, never per frame)", () => {
    const dark = buildRingSpecs(
      resources(["stable"]),
      THEME_PRESETS.galaxy.dark,
    );
    const light = buildRingSpecs(
      resources(["stable"]),
      THEME_PRESETS.standard.light,
    );
    expect(dark["contact:1"].ink).toEqual(
      inkOf(THEME_PRESETS.galaxy.dark.statusStable),
    );
    expect(light["contact:1"].ink).toEqual(
      inkOf(THEME_PRESETS.standard.light.statusStable),
    );
  });
  it("a contact without a row falls back to the neutral ring", () => {
    const [sun, first] = resources(["stable"]);
    const orphan = {
      ...first,
      key: "contact:9",
      body: { ...first.body, id: 9 },
    };
    const specs = buildRingSpecs([sun, orphan], THEME_PRESETS.galaxy.dark);
    expect(specs["contact:9"].ink).toEqual(
      inkOf(THEME_PRESETS.galaxy.dark.border),
    );
    expect(specs["contact:9"].alpha).toBe(0.5);
  });
});

describe("tokenInk / buildSkySpec", () => {
  it("resolves a token to RGBA floats and the background to the sky spec", () => {
    const colors = THEME_PRESETS.galaxy.dark;
    expect(tokenInk(colors.accent)).toEqual(inkOf(colors.accent));
    expect(buildSkySpec(colors).background).toEqual(inkOf(colors.background));
  });
});

describe("buildStarField (today's seeded twinkle field)", () => {
  it("44 stars with the pre-38.7-06 placement, radii, base opacity and colour cycle", () => {
    const colors = THEME_PRESETS.standard.dark;
    const field = buildStarField(400, 800, colors);
    expect(field.stars).toHaveLength(STAR_COUNT);
    const tones = [
      colors.textSecondary,
      colors.textPrimary,
      ...colors.starPalette,
    ];
    field.stars.forEach((star, i) => {
      expect(star.x).toBe(seeded(i + 1) * 400);
      expect(star.y).toBe(seeded(i + 101) * 800);
      expect(star.r).toBe(0.6 + seeded(i + 201) * (1.8 - 0.6));
      expect(star.base).toBe(0.4 + seeded(i + 301) * 0.6);
      expect(star.ink).toEqual(inkOf(tones[i % tones.length]));
    });
    expect(buildStarField(0, 800, colors).stars).toEqual([]);
  });
});

describe("overlay specs", () => {
  it("inks: accent, textPrimary and the first star colour for the Polaris halo", () => {
    const colors = THEME_PRESETS.galaxy.light;
    expect(buildOverlayInk(colors)).toEqual({
      accent: inkOf(colors.accent),
      textPrimary: inkOf(colors.textPrimary),
      polarisHalo: inkOf(colors.starPalette[0] ?? colors.textPrimary),
    });
  });
  it("focus outlines: the focused contacts and sun with today's gaps; none when unfocused", () => {
    const all = resources(["stable", "wobble", "decay"]);
    expect(buildFocusOutlines(all, [])).toEqual([]);
    expect(buildFocusOutlines(all, [2, 0])).toEqual([
      { key: "sun:0", worldRadius: 30, gap: 6 },
      { key: "contact:2", worldRadius: 16, gap: 4 },
    ]);
  });
});
