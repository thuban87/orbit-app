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
  buildRingSpecs,
  buildSkySpec,
  buildStarField,
  createOrrerySpecPublisher,
  ORRERY_BODY_LAYERS,
  type OrreryBodyLook,
  type OrreryBodySpecs,
  parseLedgerHandle,
  photoHandle,
  RING_DASH_PERIOD_DP,
  STAR_COUNT,
  seeded,
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
    publisher.setInitials({ "contact:2": initials });
    expect(writes.map((w) => w.generation)).toEqual([1, 2, 3]);
    const latest = writes[2];
    expect(latest.bodies[1].photo).toBe(ada);
    expect(latest.bodies[2].initials).toBe(initials);
    // The ledger tracks the drawn photo for every body layer.
    expect(ledger.holds(photoHandle(3, 5))).toBe(true);
    for (const layer of ORRERY_BODY_LAYERS)
      expect(ledger.stats().acked[layer]).toBeUndefined();
  });
  it("an unchanged input writes nothing (no generation, no ledger churn)", () => {
    const { writes, publisher, looks } = setup();
    publisher.setLooks(looks);
    publisher.setLooks(looks);
    publisher.setPhotos(new Map(), 1);
    publisher.setInitials({});
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
