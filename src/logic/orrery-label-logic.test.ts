import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CameraRect, CameraViewport } from "./orrery-camera-logic";
import {
  allocateLabels,
  DETAIL_ENTER,
  DETAIL_EXIT,
  firstGrapheme,
  IDENTITY_ENTER,
  IDENTITY_EXIT,
  LABEL_GRID_CELL,
  type LabelAllocation,
  type LabelCandidate,
  labelContext,
  orreryInitials,
  rectanglesTouch,
  type SemanticLevel,
  semanticLevel,
} from "./orrery-label-logic";

const viewport = { width: 800, height: 600 };
const candidate = (
  id: string,
  patch: Partial<LabelCandidate> = {},
): LabelCandidate => ({
  id,
  name: id,
  x: 100,
  y: 100,
  width: 100,
  height: 20,
  opacity: 1,
  ...patch,
});
describe("semantic labels", () => {
  it("uses the fixed above-body anchor when the sun blocks the normal label", () => {
    const result = allocateLabels(
      [candidate("focus", { focused: true, alternateY: 40 })],
      "identity",
      viewport,
      [{ x: 90, y: 95, width: 200, height: 100 }],
    );
    expect(result[0].rect.y).toBe(40);
  });
  it("keeps emoji ZWJ and combining clusters intact in avatar initials", () => {
    expect(orreryInitials("👨‍👩‍👧‍👦 e\u0301mile")).toBe("👨‍👩‍👧‍👦E\u0301");
    expect(orreryInitials("Ada Lovelace")).toBe("AL");
    expect(orreryInitials("  ")).toBe("");
  });
  it("uses both sides and exact inclusive thresholds with hysteresis", () => {
    expect(semanticLevel(IDENTITY_ENTER - 1e-6, "overview")).toBe("overview");
    expect(semanticLevel(IDENTITY_ENTER, "overview")).toBe("identity");
    expect(semanticLevel(IDENTITY_ENTER + 1e-6, "overview")).toBe("identity");
    expect(semanticLevel(IDENTITY_EXIT, "identity")).toBe("identity");
    expect(semanticLevel(IDENTITY_EXIT - 1e-6, "identity")).toBe("overview");
    expect(semanticLevel(DETAIL_ENTER - 1e-6, "identity")).toBe("identity");
    expect(semanticLevel(DETAIL_ENTER, "identity")).toBe("detail");
    expect(semanticLevel(DETAIL_ENTER + 1e-6, "identity")).toBe("detail");
    expect(semanticLevel(DETAIL_EXIT, "detail")).toBe("detail");
    expect(semanticLevel(DETAIL_EXIT - 1e-6, "detail")).toBe("identity");
    expect(semanticLevel(1, "detail")).toBe("overview");
    expect(semanticLevel(4, "overview")).toBe("detail");
  });
  it("keeps an oscillating zoom boundary stable and permits zero overview labels", () => {
    let level = semanticLevel(2, "overview");
    for (const zoom of [1.99, 2.01, 1.95, 2])
      level = semanticLevel(zoom, level);
    expect(level).toBe("identity");
    expect(allocateLabels([candidate("one")], "overview", viewport)).toEqual(
      [],
    );
    expect(allocateLabels([], "detail", viewport)).toEqual([]);
  });
  it("prioritizes focused then cluster then favorites, with stable identity ties", () => {
    const all = [
      candidate("other"),
      candidate("favorite", { favorite: true }),
      candidate("cluster", { cluster: true }),
      candidate("focus", { focused: true }),
    ];
    expect(allocateLabels(all, "identity", viewport).map((b) => b.id)).toEqual([
      "focus",
    ]);
    expect(
      allocateLabels(
        all.filter((b) => !b.focused),
        "identity",
        viewport,
      )[0].id,
    ).toBe("cluster");
    expect(
      allocateLabels(
        all.filter((b) => !b.focused && !b.cluster),
        "identity",
        viewport,
      )[0].id,
    ).toBe("favorite");
    expect(
      allocateLabels([candidate("z"), candidate("a")], "identity", viewport)[0]
        .id,
    ).toBe("a");
  });
  it("ranks isolated clean fitting names ahead of opportunistic crowded names", () => {
    const result = allocateLabels(
      [candidate("a"), candidate("b"), candidate("z", { x: 400 })],
      "identity",
      viewport,
    );
    expect(result.map((b) => b.id)).toEqual(["z", "a"]);
  });
  it("counts touching edges as collisions and respects measured controls/panel exclusions", () => {
    expect(
      rectanglesTouch(
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 10, y: 10, width: 10, height: 10 },
      ),
    ).toBe(true);
    expect(
      rectanglesTouch(
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 10.001, y: 0, width: 10, height: 10 },
      ),
    ).toBe(false);
    expect(
      allocateLabels([candidate("covered", { focused: true })], "detail", {
        ...viewport,
        obstacles: [{ x: 80, y: 80, width: 200, height: 100 }],
      }),
    ).toEqual([]);
    expect(
      allocateLabels([candidate("outside", { x: 799 })], "detail", viewport),
    ).toEqual([]);
  });
  it("preserves full Unicode identity and accommodates native OS-scaled measurements", () => {
    const name = "👨‍👩‍👧‍👦 Zoë e\u0301 東京 مرحبا";
    const normal = allocateLabels(
      [candidate("id", { name })],
      "identity",
      viewport,
    )[0];
    expect(normal.name).toBe(name);
    const scaled = allocateLabels(
      [candidate("id", { name, width: 200, height: 40 })],
      "identity",
      viewport,
    )[0];
    expect(scaled.name).toBe(name);
    expect(scaled.rect.height).toBe(40);
  });
  it("omits missing context and suppresses detail before sacrificing another name", () => {
    expect(labelContext(null, undefined)).toBe("Not contacted yet");
    expect(labelContext(undefined, undefined)).toBeUndefined();
    const item = candidate("name", {
      context: "Deep gravity",
      contextWidth: 100,
      contextHeight: 20,
    });
    expect(
      allocateLabels([item], "identity", viewport)[0].contextRect,
    ).toBeUndefined();
    expect(
      allocateLabels([item], "detail", viewport)[0].contextRect,
    ).toBeDefined();
    const crowded = allocateLabels(
      [item, candidate("other", { y: 125 })],
      "detail",
      viewport,
    );
    expect(crowded).toHaveLength(2);
    expect(crowded.find((b) => b.id === "name")?.contextRect).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// D-52: the indexed allocator equals a FROZEN copy of the pre-38.7 scan
// (do not edit the copy).
// ---------------------------------------------------------------------------
function legacyAllocateLabels(
  candidates: readonly LabelCandidate[],
  level: SemanticLevel,
  viewport: CameraViewport,
  bodyExclusions: readonly CameraRect[] = [],
): LabelAllocation[] {
  const LABEL_NUDGE = 8;
  const CONTEXT_GAP = 4;
  const usable = viewport.usable ?? {
    x: 0,
    y: 0,
    width: viewport.width,
    height: viewport.height,
  };
  const obstacles = [...(viewport.obstacles ?? []), ...bodyExclusions];
  const rect = (c: LabelCandidate): CameraRect => ({
    x: c.x,
    y: c.y,
    width: c.width,
    height: c.height,
  });
  const inside = (r: CameraRect) =>
    r.x >= Math.max(0, usable.x) &&
    r.y >= Math.max(0, usable.y) &&
    r.x + r.width <= Math.min(viewport.width, usable.x + usable.width) &&
    r.y + r.height <= Math.min(viewport.height, usable.y + usable.height);
  const valid = candidates.filter(
    (c) =>
      c.opacity > 0 &&
      [c.x, c.y, c.width, c.height].every(Number.isFinite) &&
      c.width > 0 &&
      c.height > 0 &&
      (level !== "overview" || c.focused || c.cluster),
  );
  const priority = (c: LabelCandidate) => {
    if (c.focused) return 0;
    if (c.cluster) return 1;
    if (c.favorite) return 2;
    const r = rect(c);
    return inside(r) &&
      !obstacles.some((o) => rectanglesTouch(r, o)) &&
      !valid.some(
        (other) => other.id !== c.id && rectanglesTouch(r, rect(other)),
      )
      ? 3
      : 4;
  };
  const ranked = valid
    .map((c) => ({ c, priority: priority(c) }))
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        (a.c.id < b.c.id ? -1 : a.c.id > b.c.id ? 1 : 0),
    );
  const result: LabelAllocation[] = [];
  for (const { c } of ranked) {
    const placements = [
      c.y,
      ...(c.alternateY === undefined ? [] : [c.alternateY]),
    ].flatMap((y) =>
      [0, -LABEL_NUDGE, LABEL_NUDGE].map((dx) => ({
        ...rect(c),
        x: c.x + dx,
        y,
      })),
    );
    for (const r of placements) {
      if (
        !inside(r) ||
        obstacles.some((o) => rectanglesTouch(r, o)) ||
        result.some((a) => rectanglesTouch(r, a.rect))
      )
        continue;
      result.push({ id: c.id, name: c.name, rect: r, opacity: c.opacity });
      break;
    }
  }
  if (level === "detail")
    for (const allocation of result) {
      const c = valid.find((item) => item.id === allocation.id);
      if (!c?.context || !c.contextWidth || !c.contextHeight) continue;
      const r = {
        x: allocation.rect.x + (allocation.rect.width - c.contextWidth) / 2,
        y: allocation.rect.y + allocation.rect.height + CONTEXT_GAP,
        width: c.contextWidth,
        height: c.contextHeight,
      };
      if (
        inside(r) &&
        !obstacles.some((o) => rectanglesTouch(r, o)) &&
        !result.some(
          (a) =>
            rectanglesTouch(r, a.rect) ||
            (a.contextRect && rectanglesTouch(r, a.contextRect)),
        )
      )
        allocation.contextRect = r;
    }
  return result;
}

function prng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

describe("D-52 indexed label allocator", () => {
  const levels: SemanticLevel[] = ["overview", "identity", "detail"];

  /** Coordinates snap to 8 px half the time, so edges often meet exactly on cell boundaries. */
  const coordinate = (random: () => number, span: number) =>
    random() < 0.5
      ? Math.round((random() * span) / 8) * 8
      : random() * span - 20;

  const randomCandidates = (random: () => number, count: number) =>
    Array.from({ length: count }, (_, index): LabelCandidate => {
      const flag = random();
      const width = random() < 0.1 ? LABEL_GRID_CELL : 30 + random() * 140;
      const height = random() < 0.1 ? LABEL_GRID_CELL / 2 : 14 + random() * 20;
      const withContext = random() < 0.5;
      return {
        // Some repeated ids, as a stale frame could produce.
        id: `contact:${random() < 0.05 ? index - 1 : index}`,
        name: `Person ${index}`,
        x: coordinate(random, 820),
        y: coordinate(random, 620),
        alternateY: random() < 0.6 ? coordinate(random, 620) : undefined,
        width: random() < 0.02 ? -width : width,
        height,
        opacity: random() < 0.08 ? 0 : random(),
        focused: flag < 0.03,
        cluster: flag >= 0.03 && flag < 0.12,
        favorite: random() < 0.15,
        context: withContext ? "Stable · Close gravity" : undefined,
        contextWidth: withContext
          ? random() < 0.05
            ? -40
            : 40 + random() * 120
          : undefined,
        contextHeight: withContext ? 12 + random() * 8 : undefined,
      };
    });

  const randomObstacles = (random: () => number) =>
    Array.from({ length: Math.floor(random() * 30) }, (): CameraRect => {
      const kind = random();
      if (kind < 0.04) return { x: Number.NaN, y: 10, width: 20, height: 20 };
      if (kind < 0.08) return { x: 100, y: 100, width: -60, height: 30 };
      if (kind < 0.12) return { x: -1e9, y: 300, width: 2e9, height: 4 };
      if (kind < 0.14)
        return { x: 0, y: 0, width: Number.POSITIVE_INFINITY, height: 2 };
      return {
        x: coordinate(random, 800),
        y: coordinate(random, 600),
        width: 4 + random() * 60,
        height: 4 + random() * 60,
      };
    });

  it("matches the frozen old allocator on randomised candidate sets", () => {
    for (let seed = 1; seed <= 90; seed++) {
      const random = prng(seed);
      const count = Math.floor(random() * 401);
      const candidates = randomCandidates(random, count);
      const exclusions = randomObstacles(random);
      const vp: CameraViewport =
        random() < 0.5
          ? viewport
          : {
              ...viewport,
              usable: { x: 0, y: 56, width: 800, height: 480 },
              obstacles: randomObstacles(random),
            };
      for (const level of levels) {
        expect(
          allocateLabels(candidates, level, vp, exclusions),
          `seed ${seed} ${level}`,
        ).toEqual(legacyAllocateLabels(candidates, level, vp, exclusions));
      }
    }
  });

  it("D-47: at tilt 0 every depth is equal, so nearest-first allocations deep-equal the pre-change order", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const random = prng(seed * 7);
      const candidates = randomCandidates(random, Math.floor(random() * 300));
      // A flat camera gives every body the same camera-plane depth (0 or -0).
      const flat = candidates.map((c, i) => ({
        ...c,
        depth: i % 2 ? 0 : -0,
      }));
      const exclusions = randomObstacles(random);
      for (const level of levels)
        expect(allocateLabels(flat, level, viewport, exclusions)).toEqual(
          legacyAllocateLabels(candidates, level, viewport, exclusions),
        );
    }
  });
  it("matches on tightly packed edge-touching grids (inclusive edges across cells)", () => {
    const packed = Array.from({ length: 120 }, (_, index) =>
      candidate(`contact:${index}`, {
        x: (index % 12) * 64,
        y: Math.floor(index / 12) * 32,
        width: 64,
        height: 32,
        alternateY: Math.floor(index / 12) * 32 + 16,
        context: index % 3 ? "ctx" : undefined,
        contextWidth: 64,
        contextHeight: 8,
      }),
    );
    for (const level of levels)
      expect(allocateLabels(packed, level, viewport)).toEqual(
        legacyAllocateLabels(packed, level, viewport),
      );
  });

  it("1,000 candidates allocate inside a generous smoke budget", () => {
    const random = prng(1000);
    const candidates = randomCandidates(random, 1000);
    const exclusions = randomObstacles(random);
    allocateLabels(candidates, "identity", viewport, exclusions); // warm-up
    const started = performance.now();
    allocateLabels(candidates, "identity", viewport, exclusions);
    expect(performance.now() - started).toBeLessThan(50);
  });
});

describe("D-33 Hermes-safe initials", () => {
  // Emoji are written as escapes so no invisible characters sit in source.
  const FAMILY = "\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}\u{200D}\u{1F466}";
  const CANADA = "\u{1F1E8}\u{1F1E6}";
  const TECHNOLOGIST = "\u{1F469}\u{1F3FD}\u{200D}\u{1F4BB}";
  const SCOTLAND =
    "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}";
  const KEYCAP_ONE = "\u{0031}\u{FE0F}\u{20E3}";
  const CASES: [string, string][] = [
    ["Ellie Brown", "EB"],
    ["\u00E9mile Zola", "\u00C9Z"],
    [`${FAMILY} \u00E9mile`, `${FAMILY}\u00C9`],
    [`${FAMILY} e\u0301mile`, `${FAMILY}E\u0301`],
    [`${CANADA} Canada`, `${CANADA}C`],
    [`${TECHNOLOGIST} Dev`, `${TECHNOLOGIST}D`],
    [`${SCOTLAND} Scot`, `${SCOTLAND}S`],
    [`${KEYCAP_ONE} One`, `${KEYCAP_ONE}O`],
    ["e\u0301mile", "E\u0301"],
    ["Cher", "C"],
    ["Ada Lovelace", "AL"],
    ["  Ada   King  Lovelace ", "AK"],
    ["   ", ""],
    ["", ""],
  ];
  const original = Object.getOwnPropertyDescriptor(Intl, "Segmenter");
  const LONE_SURROGATE =
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

  describe("without Intl.Segmenter (Hermes)", () => {
    beforeEach(() => {
      Object.defineProperty(Intl, "Segmenter", {
        value: undefined,
        configurable: true,
        writable: true,
      });
    });
    afterEach(() => {
      if (original) Object.defineProperty(Intl, "Segmenter", original);
    });

    it("the stub really removes Segmenter", () => {
      expect(typeof Intl.Segmenter).not.toBe("function");
    });
    it.each(CASES)("%j → %j", (name, expected) => {
      expect(orreryInitials(name)).toBe(expected);
    });
    it("never returns the full name (the Phase 29 fallback is gone)", () => {
      expect(orreryInitials("Ellie Brown")).not.toBe("Ellie Brown");
      expect(orreryInitials("Ellie Brown")).not.toContain("l");
    });
    it("firstGrapheme keeps whole clusters and splits nothing", () => {
      expect(firstGrapheme(`${CANADA}${CANADA}`)).toBe(CANADA);
      expect(firstGrapheme(`${TECHNOLOGIST}x`)).toBe(TECHNOLOGIST);
      expect(firstGrapheme(`${SCOTLAND}x`)).toBe(SCOTLAND);
      expect(firstGrapheme(`${KEYCAP_ONE}2`)).toBe(KEYCAP_ONE);
      expect(firstGrapheme("e\u0301\u0302x")).toBe("e\u0301\u0302");
      expect(firstGrapheme("\u{1F44D}\u{1F3FF}!")).toBe("\u{1F44D}\u{1F3FF}");
      expect(firstGrapheme("")).toBe("");
    });
    it("fuzz: 500 random mixed strings never yield a lone surrogate", () => {
      const pieces = [
        "a",
        "Z",
        " ",
        "  ",
        "\u00E9",
        "e\u0301",
        "\u0301",
        "\u200D",
        "\uFE0F",
        "\u20E3",
        "\u{1F3FD}",
        "\u{E0067}",
        "\u{E007F}",
        "\u{1F1E8}",
        "\u{1F1E6}",
        "\u{1F600}",
        FAMILY,
        CANADA,
        TECHNOLOGIST,
        SCOTLAND,
        KEYCAP_ONE,
        "\u6771",
        "\u0645",
      ];
      let seed = 0x5eed;
      const next = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed;
      };
      for (let i = 0; i < 500; i++) {
        let name = "";
        const length = 1 + (next() % 8);
        for (let j = 0; j < length; j++) name += pieces[next() % pieces.length];
        const initials = orreryInitials(name);
        expect(LONE_SURROGATE.test(initials), JSON.stringify(name)).toBe(false);
        expect(initials.length).toBeLessThanOrEqual(name.length * 3);
      }
    });
  });

  describe("with Node's real Segmenter (both paths agree)", () => {
    it("the real Segmenter is present", () => {
      expect(typeof Intl.Segmenter).toBe("function");
    });
    it.each(CASES)("%j → %j", (name, expected) => {
      expect(orreryInitials(name)).toBe(expected);
    });
  });
});

describe("D-47 nearest-first labels (38.7-05)", () => {
  // Two equal-priority labels that overlap: only one can be placed (no
  // alternate slot), so the ranking decides which name shows.
  const overlapping = (
    patchA: Partial<LabelCandidate>,
    patchB: Partial<LabelCandidate>,
  ) => [
    candidate("contact:1", { x: 100, y: 100, ...patchA }),
    candidate("contact:2", { x: 140, y: 104, ...patchB }),
  ];
  const placed = (candidates: LabelCandidate[]) =>
    allocateLabels(candidates, "identity", viewport).map((a) => a.id);
  it("allocates the nearer of two overlapping equal-priority candidates (62° fixture depths)", () => {
    // Camera-plane depth at 62°: positive = near side.
    const sin62 = Math.sin((62 * Math.PI) / 180);
    expect(
      placed(overlapping({ depth: -300 * sin62 }, { depth: 120 * sin62 })),
    ).toEqual(["contact:2"]);
    expect(
      placed(overlapping({ depth: 120 * sin62 }, { depth: -300 * sin62 })),
    ).toEqual(["contact:1"]);
  });
  it("breaks equal depths by id, and an absent depth ranks as equal", () => {
    expect(placed(overlapping({ depth: 50 }, { depth: 50 }))).toEqual([
      "contact:1",
    ]);
    expect(placed(overlapping({}, {}))).toEqual(["contact:1"]);
  });
  it("keeps the priority class first: a focused far label beats a nearer unfocused one", () => {
    expect(
      placed(overlapping({ depth: 200 }, { depth: -400, focused: true })),
    ).toEqual(["contact:2"]);
    expect(
      placed(overlapping({ depth: 200 }, { depth: -400, favorite: true })),
    ).toEqual(["contact:2"]);
  });
});

describe("D-47 tiers follow projected size (38.7-05)", () => {
  it("semanticLevel's thresholds are unchanged when fed a magnification", () => {
    let level: SemanticLevel = "overview";
    const trace: SemanticLevel[] = [];
    for (const magnification of [1, 1.99, 2, 1.9, 1.84, 2.9, 3, 2.85, 2.79]) {
      level = semanticLevel(magnification, level);
      trace.push(level);
    }
    expect(trace).toEqual([
      "overview",
      "overview",
      "identity",
      "identity",
      "overview",
      "identity",
      "detail",
      "detail",
      "identity",
    ]);
    expect(IDENTITY_ENTER).toBe(2);
    expect(DETAIL_ENTER).toBe(3);
  });
});
