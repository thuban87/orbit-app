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

import { swatchIndex } from "@/components/avatar-initials";
import type { ProfileStatus } from "@/db/contact-status-read";
import { orreryRingStyle } from "@/logic/orrery-ring-logic";
import { THEME_PRESETS } from "@/theme/theme-presets";
import { createOrreryGenerationLedger } from "../resources/orrery-generation-ledger";
import type { OrreryBodyResource } from "../use-orrery-switch-runtime";
import {
  bodyInitialsLayout,
  buildBodyLooks,
  buildFocusOutlines,
  buildOverlayInk,
  buildPhotoRequests,
  buildPlaneSpec,
  buildRingSpecs,
  buildSatelliteLooks,
  buildSkySpec,
  createOrrerySpecPublisher,
  ORRERY_BODY_LAYERS,
  ORRERY_LAYER,
  type OrreryBodyLook,
  type OrreryBodySpecs,
  type OrreryLabelLayerSpecs,
  parseLedgerHandle,
  photoHandle,
  RING_DASH_PERIOD_DP,
  type SkySpecLook,
  skyHandle,
  skyTintInk,
  textHandle,
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
      const look = { lightGain: 0.6, lightMix: 0.35, farAlpha: 0.55 };
      const specs = buildRingSpecs(resources([...statuses]), colors, look);
      expect(Object.keys(specs).sort()).toEqual(
        statuses.map((_, i) => `contact:${i + 1}`).sort(),
      );
      // 38.7-09 (D-11): Lab B's thin lines — the status ladder stays.
      const expected = {
        stable: { alpha: 1, dash: 0, duty: 1 },
        wobble: { alpha: 1, dash: RING_DASH_PERIOD_DP, duty: 0.58 },
        decay: { alpha: 0.7, dash: 0, duty: 1 },
        rogue: { alpha: 0.42, dash: 6, duty: 0.3 },
        null: { alpha: 0.5, dash: 0, duty: 1 },
      } as const;
      expect(RING_DASH_PERIOD_DP).toBe(11);
      statuses.forEach((status, i) => {
        const style = orreryRingStyle(status, colors);
        const spec = specs[`contact:${i + 1}`];
        const want = expected[String(status) as keyof typeof expected];
        expect(spec.ink).toEqual(inkOf(style.color));
        expect(spec.widthDp).toBeCloseTo(style.width * 0.42 + 0.2, 12);
        expect(spec.alpha).toBe(want.alpha);
        expect(spec.dashPeriodDp).toBe(want.dash);
        expect(spec.dashDuty).toBe(want.duty);
        // The sun-lit look is the theme's, the same for every status.
        expect(spec.lightGain).toBe(0.6);
        expect(spec.lightMix).toBe(0.35);
        expect(spec.farAlpha).toBe(0.55);
        expect(spec.light).toEqual(inkOf(colors.orreryRingLight));
      });
      // Weight still orders status (thin, but stable < wobble < decay).
      expect(specs["contact:1"].widthDp).toBeLessThan(
        specs["contact:2"].widthDp,
      );
      expect(specs["contact:2"].widthDp).toBeLessThan(
        specs["contact:3"].widthDp,
      );
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

describe("buildPlaneSpec (38.7-09: D-09 grid, D-10 pulses)", () => {
  const tunables = {
    gridOpacity: 0.12,
    gridRings: 6,
    gridSpokes: 12,
    gridHalfWidthDp: 0.4,
    gridExtent: 1.12,
    pulseIntensity: 0.25,
    pulseBudget: 8,
  };
  const look = { lightGain: 1.1, lightMix: 0.35, farAlpha: 0.55 };
  it("grid and pulses read only orrery* tokens; the pulse blend follows the mode", () => {
    const dark = buildPlaneSpec(
      THEME_PRESETS.galaxy.dark,
      "dark",
      look,
      tunables,
    );
    expect(dark.grid).toEqual({
      ink: inkOf(THEME_PRESETS.galaxy.dark.orreryGrid),
      opacity: 0.12,
      rings: 6,
      spokes: 12,
      halfWidthDp: 0.4,
      extent: 1.12,
      farAlpha: 0.55,
    });
    expect(dark.pulse).toEqual({
      ink: inkOf(THEME_PRESETS.galaxy.dark.orreryPulse),
      intensity: 0.25,
      budget: 8,
      additive: true,
      farAlpha: 0.55,
    });
    const light = buildPlaneSpec(
      THEME_PRESETS.standard.light,
      "light",
      look,
      tunables,
    );
    expect(light.pulse.additive).toBe(false);
    expect(light.pulse.ink).toEqual(
      inkOf(THEME_PRESETS.standard.light.orreryPulse),
    );
  });
  it("grid off and no pulses are representable (0), never negative", () => {
    const off = buildPlaneSpec(THEME_PRESETS.galaxy.dark, "dark", look, {
      ...tunables,
      gridOpacity: 0,
      pulseBudget: 0,
      pulseIntensity: -1,
    });
    expect(off.grid.opacity).toBe(0);
    expect(off.pulse.budget).toBe(0);
    expect(off.pulse.intensity).toBe(0);
  });
});

describe("tokenInk", () => {
  it("resolves a token to RGBA floats", () => {
    const colors = THEME_PRESETS.galaxy.dark;
    expect(tokenInk(colors.accent)).toEqual(inkOf(colors.accent));
  });
});

describe("buildSkySpec (38.7-09: D-07/D-08/D-50/D-51)", () => {
  const look: SkySpecLook = {
    starCount: 120,
    brightStarCount: 20,
    starRadius: [0.5, 1],
    brightRadius: [1.2, 1.8],
    starAlpha: [0.3, 0.9],
    twinkleDepth: 0.4,
    tintStrength: 0.35,
    tintWash: 0.05,
    horizonStop: 0.6,
  };
  const input = (
    overrides: Partial<Parameters<typeof buildSkySpec>[0]> = {},
  ) => ({
    colors: THEME_PRESETS.galaxy.dark,
    mode: "dark" as const,
    themePackage: "galaxy" as const,
    width: 400,
    height: 800,
    cover: { width: 512, height: 896 },
    hueIndex: 3,
    look,
    seed: 38,
    twinkleGroups: 3,
    ...overrides,
  });

  it("reads only orrery* tokens: base / horizon gradient and the System hue", () => {
    const colors = THEME_PRESETS.galaxy.dark;
    const sky = buildSkySpec(input());
    expect(sky.base).toEqual(inkOf(colors.orrerySkyBase));
    expect(sky.horizon).toEqual(inkOf(colors.orrerySkyHorizon));
    const hue = inkOf(colors.orrerySystemHues[3]);
    expect(sky.tintTo).toEqual([hue[0], hue[1], hue[2], 1]);
    expect(sky.tintFrom).toEqual(sky.tintTo);
    expect(sky.tintMix).toBe(1);
    expect(sky.tintStrength).toBe(0.35);
    expect(sky.horizonStop).toBe(0.6);
  });

  it("the untinted rule (−1, All Contacts) has zero tint strength", () => {
    const sky = buildSkySpec(input({ hueIndex: -1 }));
    expect(sky.tintTo[3]).toBe(0);
    expect(skyTintInk(THEME_PRESETS.galaxy.dark, -1, 1)[3]).toBe(0);
  });

  it("the blend family follows the resolved theme MODE, not luminance", () => {
    expect(buildSkySpec(input({ mode: "dark" })).additive).toBe(true);
    expect(
      buildSkySpec(input({ mode: "light", colors: THEME_PRESETS.galaxy.light }))
        .additive,
    ).toBe(false);
  });

  it("stars: every star placed once, batched by tone × size × phase, deterministic, spread over the cover", () => {
    const a = buildSkySpec(input());
    const b = buildSkySpec(input({ hueIndex: 7 }));
    // The System (hue) does not move a single star.
    expect(b.stars).toEqual(a.stars);
    const total = a.stars.reduce((n, g) => n + g.points.length, 0);
    expect(total).toBe(look.starCount + look.brightStarCount);
    // A handful of batches, not one draw per star.
    expect(a.stars.length).toBeLessThan(40);
    const tones = THEME_PRESETS.galaxy.dark.orrerySkyStars.map(inkOf);
    for (const group of a.stars) {
      expect(tones).toContainEqual([...group.ink]);
      for (const p of group.points) {
        expect(p.x).toBeGreaterThanOrEqual(-56);
        expect(p.x).toBeLessThan(456);
        expect(p.y).toBeGreaterThanOrEqual(-48);
        expect(p.y).toBeLessThan(848);
      }
    }
    expect(buildSkySpec(input({ width: 0 })).stars).toEqual([]);
  });

  it("the sky image handle round-trips through the ledger handle parser", () => {
    expect(parseLedgerHandle(skyHandle(4, 9))).toEqual({
      kind: "sky",
      epoch: 4,
      id: 9,
    });
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

// ── 38.7-07: body looks, photo requests and the spec publisher ─────────────

type Sun = OrreryBodyResource["scene"]["sun"];
/** Contacts with names/photos and a configurable sun occupant. */
function bodyResources(
  rows: { status: ProfileStatus | null; name: string; photo: string | null }[],
  sun: Partial<Sun> = {},
): OrreryBodyResource[] {
  const scene = {
    contacts: rows.map((row, i) => ({ id: i + 1, ...row })),
    sun: {
      sunContactId: null,
      selfSunColour: null,
      selfPhoto: "avatars/self.jpg",
      selfName: "Self Person",
      occupant: null,
      sunContactName: "",
      ...sun,
    },
  } as never as OrreryBodyResource["scene"];
  return [
    {
      key: "sun:0",
      body: { id: 0, kind: "sun", x: 0, y: 0, radius: 30, ringRadius: 0 },
      scene,
    },
    ...rows.map((_, i) => ({
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

describe("buildBodyLooks (today's contact and sun look, as numbers)", () => {
  it.each([
    ["galaxy dark", THEME_PRESETS.galaxy.dark],
    ["standard light", THEME_PRESETS.standard.light],
  ] as const)(
    "%s: status outline, name swatch, photo key and initials size per contact",
    (_n, colors) => {
      const statuses = ["stable", "wobble", "decay", "rogue", null] as const;
      const looks = buildBodyLooks(
        bodyResources(
          statuses.map((status, i) => ({
            status,
            name: `Name ${i}`,
            photo: i % 2 === 0 ? `avatars/c${i}.jpg` : null,
          })),
        ),
        colors,
      );
      const contacts = looks.filter((look) => look.kind === "contact");
      expect(contacts).toHaveLength(5);
      contacts.forEach((look, i) => {
        expect(look.outlineInk).toEqual(
          inkOf(orreryRingStyle(statuses[i], colors).bodyFill),
        );
        expect(look.swatchInk).toEqual(
          inkOf(
            colors.avatarSwatches[
              swatchIndex(`Name ${i}`, colors.avatarSwatches.length)
            ],
          ),
        );
        expect(look.photoKey).toBe(i % 2 === 0 ? `avatars/c${i}.jpg` : null);
        expect(look.initialsFontSize).toBe(16);
        expect(look.worldRadius).toBe(16);
        expect(look.focusInk).toBeNull();
      });
    },
  );
  it("sun occupant variants: self (picked star colour or the gold default) and a live contact sun", () => {
    const colors = THEME_PRESETS.galaxy.dark;
    const selfDefault = buildBodyLooks(bodyResources([]), colors)[0];
    expect(selfDefault).toMatchObject({
      kind: "sun",
      worldRadius: 30,
      photoKey: "avatars/self.jpg",
      initialsFontSize: 30,
    });
    expect(selfDefault.outlineInk).toEqual(inkOf(colors.starPalette[0]));
    expect(selfDefault.swatchInk).toEqual(
      inkOf(
        colors.avatarSwatches[
          swatchIndex("Self Person", colors.avatarSwatches.length)
        ],
      ),
    );
    const picked = buildBodyLooks(
      bodyResources([], { selfSunColour: colors.starPalette[2] }),
      colors,
    )[0];
    expect(picked.outlineInk).toEqual(inkOf(colors.starPalette[2]));
    const contactSun = buildBodyLooks(
      bodyResources([], {
        sunContactId: 7,
        sunContactName: "Sun Contact",
        occupant: {
          photo: "avatars/sun.jpg",
          status: "decay",
          archived: false,
        },
      }),
      colors,
    )[0];
    expect(contactSun.photoKey).toBe("avatars/sun.jpg");
    expect(contactSun.outlineInk).toEqual(
      inkOf(orreryRingStyle("decay", colors).color),
    );
    expect(contactSun.swatchInk).toEqual(
      inkOf(
        colors.avatarSwatches[
          swatchIndex("Sun Contact", colors.avatarSwatches.length)
        ],
      ),
    );
  });
  it("initials layout: contact glyph in the inner disc, sun glyph across the disc, 0.5 px quantised", () => {
    expect(bodyInitialsLayout("contact", 16)).toEqual({
      fontSize: 16,
      maxWidth: 29,
    });
    expect(bodyInitialsLayout("sun", 30.3)).toEqual({
      fontSize: 30.5,
      maxWidth: 60.6,
    });
    expect(bodyInitialsLayout("contact", 1).maxWidth).toBe(2);
  });
});

describe("buildPhotoRequests (D-53: visible first)", () => {
  const look = (key: string, photoKey: string | null): OrreryBodyLook => ({
    key,
    kind: "contact",
    worldRadius: 16,
    outlineInk: [1, 1, 1, 1],
    swatchInk: [1, 1, 1, 1],
    photoKey,
    initialsFontSize: 16,
    focusInk: null,
  });
  const looks = [
    look("contact:1", "p1"),
    look("contact:2", "p2"),
    look("contact:3", null),
    look("contact:4", "p4"),
    look("contact:5", "p1"),
  ];
  it("focused first, then visible largest first, then off-screen in source order; one entry per photo", () => {
    const requests = buildPhotoRequests(looks, new Set(["contact:4"]), {
      visible: ["contact:2", "contact:5"],
      eligible: [
        { key: "contact:2", radius: 9 },
        { key: "contact:5", radius: 20 },
      ],
    });
    expect(requests).toEqual([
      {
        key: "p4",
        relativePath: "p4",
        priority: 0,
        focused: true,
        visible: false,
      },
      {
        key: "p1",
        relativePath: "p1",
        priority: 1,
        focused: false,
        visible: true,
      },
      {
        key: "p2",
        relativePath: "p2",
        priority: 2,
        focused: false,
        visible: true,
      },
    ]);
  });
  it("before the first visibility report every body counts as visible", () => {
    const requests = buildPhotoRequests(looks, new Set(), null);
    expect(requests.map((r) => [r.key, r.visible])).toEqual([
      ["p1", true],
      ["p2", true],
      ["p4", true],
    ]);
  });
});

describe("createOrrerySpecPublisher (D-43/H3)", () => {
  const colors = THEME_PRESETS.galaxy.dark;
  function setup() {
    const ledger = createOrreryGenerationLedger<string>();
    const writes: OrreryBodySpecs[] = [];
    const publisher = createOrrerySpecPublisher({
      ledger,
      writeBodies: (specs) => writes.push(specs),
    });
    const looks = buildBodyLooks(
      bodyResources([
        { status: "stable", name: "Ada", photo: "avatars/ada.jpg" },
        { status: "wobble", name: "Bo", photo: null },
      ]),
      colors,
    );
    return { ledger, writes, publisher, looks };
  }
  const image = (label: string) => ({ label }) as never;
  it("composes looks, initials and photos into one generation and tracks the photos for the body layers", () => {
    const { ledger, writes, publisher, looks } = setup();
    publisher.setLooks(looks);
    expect(writes).toHaveLength(1);
    expect(writes[0].generation).toBe(1);
    expect(writes[0].mountEpoch).toBe(ledger.epoch());
    expect(writes[0].bodies.map((b) => [b.key, b.photo, b.initials])).toEqual([
      ["sun:0", null, null],
      ["contact:1", null, null],
      ["contact:2", null, null],
    ]);
    const ada = image("ada");
    publisher.setPhotos(
      new Map([["avatars/ada.jpg", { id: 5, image: ada }]]),
      3,
    );
    const initials = {
      text: "BO",
      paragraph: {},
      width: 29,
      height: 20,
    } as never;
    publisher.setInitials({
      generation: 1,
      mountEpoch: 8,
      keys: ["key-bo"],
      initials: { "contact:2": initials },
    });
    expect(writes.map((w) => w.generation)).toEqual([1, 2, 3]);
    const latest = writes[2];
    expect(latest.bodies[1].photo).toBe(ada);
    expect(latest.bodies[2].initials).toBe(initials);
    // The ledger tracks the drawn photo and initials for every body layer.
    expect(ledger.holds(photoHandle(3, 5))).toBe(true);
    expect(ledger.holds(textHandle(8, "key-bo"))).toBe(true);
    for (const layer of ORRERY_BODY_LAYERS)
      expect(ledger.stats().acked[layer]).toBeUndefined();
  });
  it("an unchanged input writes nothing (no generation, no ledger churn)", () => {
    const { writes, publisher, looks } = setup();
    publisher.setLooks(looks);
    publisher.setLooks(looks);
    publisher.setPhotos(new Map(), 1);
    expect(writes).toHaveLength(1);
  });
  it("a photo replaced or dropped retires the old one only after every body layer acked", () => {
    const { ledger, writes, publisher, looks } = setup();
    publisher.setLooks(looks);
    publisher.setPhotos(
      new Map([["avatars/ada.jpg", { id: 1, image: image("a") }]]),
      2,
    );
    publisher.setPhotos(
      new Map([["avatars/ada.jpg", { id: 2, image: image("b") }]]),
      2,
    );
    const epoch = writes[0].mountEpoch;
    ledger.ack("bodiesBehind", 3, epoch);
    ledger.ack("bodiesFront", 3, epoch);
    expect(ledger.retirable()).toEqual([]);
    ledger.ack("sun", 3, epoch);
    expect(ledger.retirable()).toEqual([photoHandle(2, 1)]);
  });
  it("detach ends the epoch; the next publish starts a new one", () => {
    const { ledger, writes, publisher, looks } = setup();
    publisher.setLooks(looks);
    const first = publisher.detach();
    expect(first).toBe(writes[0].mountEpoch);
    expect(publisher.epoch()).toBeNull();
    publisher.setLooks([...looks]);
    expect(writes[1].mountEpoch).not.toBe(first);
    expect(ledger.stats().epochs).toBe(2);
  });
  it("ledger handles round-trip", () => {
    expect(parseLedgerHandle(photoHandle(4, 17))).toEqual({
      kind: "photo",
      epoch: 4,
      id: 17,
    });
    expect(parseLedgerHandle(textHandle(9, "a\u0001b"))).toEqual({
      kind: "text",
      epoch: 9,
      key: "a\u0001b",
    });
    expect(parseLedgerHandle("junk")).toBeNull();
  });
});

describe("38.7-07 Task 2: moons and labels", () => {
  const colors = THEME_PRESETS.standard.dark;
  const moon = (uid: string, parentId: number) =>
    ({ uid, parentId, parentUid: `p${parentId}` }) as never;
  it("moon looks: a unit textSecondary disc keyed like the frame's moons; the focused moon carries the accent ring", () => {
    const looks = buildSatelliteLooks([moon("m1", 1), moon("m2", 1)], colors, {
      kind: "satellite",
      uid: "m2",
      parentId: 1,
      parentUid: "p1",
    });
    expect(looks.map((l) => l.key)).toEqual([
      `satellite:${JSON.stringify([1, "p1", "m1"])}`,
      `satellite:${JSON.stringify([1, "p1", "m2"])}`,
    ]);
    expect(looks[0]).toMatchObject({
      kind: "satellite",
      worldRadius: 1,
      photoKey: null,
      focusInk: null,
    });
    expect(looks[0].outlineInk).toEqual(inkOf(colors.textSecondary));
    expect(looks[1].focusInk).toEqual(inkOf(colors.accent));
  });
  it("labels publish to the labels layer only, with the shared generation, and track their keys there", () => {
    const ledger = createOrreryGenerationLedger<string>();
    const labelWrites: OrreryLabelLayerSpecs[] = [];
    const bodyWrites: OrreryBodySpecs[] = [];
    const publisher = createOrrerySpecPublisher({
      ledger,
      writeBodies: (specs) => bodyWrites.push(specs),
      writeLabels: (specs) => labelWrites.push(specs),
    });
    publisher.setLooks([]);
    const text = { text: "Ada", paragraph: {}, width: 50, height: 28 } as never;
    publisher.setLabelPlate(inkOf(colors.surface) as never);
    publisher.setLabels({
      generation: 4,
      mountEpoch: 2,
      keys: ["label-ada"],
      labels: { "contact:1": { text, context: null } },
      measured: [
        {
          id: "contact:1",
          name: "Ada",
          width: 50,
          height: 28,
          focused: true,
          cluster: false,
          favorite: false,
        },
      ],
    });
    expect(bodyWrites).toHaveLength(1);
    const latest = labelWrites.at(-1) as OrreryLabelLayerSpecs;
    expect(latest.generation).toBe(2);
    expect(latest.labels["contact:1"].text).toBe(text);
    expect(latest.plateInk).toEqual(inkOf(colors.surface));
    expect(ledger.holds(textHandle(2, "label-ada"))).toBe(true);
    // The plate ink republishes the labels; an identical ink does not.
    publisher.setLabelPlate(inkOf(colors.surface) as never);
    expect(labelWrites).toHaveLength(1);
    // Only the labels layer recorded the label: its ack alone retires it.
    publisher.setLabels({
      generation: 5,
      mountEpoch: 2,
      keys: [],
      labels: {},
      measured: [],
    });
    ledger.ack(ORRERY_LAYER.labels, 3, latest.mountEpoch);
    expect(ledger.retirable()).toEqual([textHandle(2, "label-ada")]);
  });
});
