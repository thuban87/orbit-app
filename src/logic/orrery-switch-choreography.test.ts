import { afterEach, describe, expect, it } from "vitest";
import type { OrrerySatellite } from "@/db/orrery-satellites-read";
import { HOME_CAMERA, type WorldBody } from "./orrery-camera-logic";
import {
  projectAnimatedFrame,
  projectSwitchChoreographyFrame,
} from "./orrery-frame";
import { previewReorder, type ReorderDrag } from "./orrery-reorder-logic";
import {
  deriveSatelliteBodies,
  indexSatellites,
} from "./orrery-satellite-logic";
import {
  ACCELERATE_END,
  BASE_RADIAL_DISPLACEMENT,
  beginSettledSwitchChoreography,
  beginSwitchChoreography,
  CAPTURE_END,
  CAPTURE_START,
  type ChoreographyWorldBody,
  RADIAL_DISPLACEMENT_RANGE,
  retargetSwitchChoreography,
  SETTLE_START,
  SHED_END,
  SHED_START,
  STAGGER_WINDOW,
  type SwitchChoreography,
  type SwitchChoreographyEntry,
  type SwitchChoreographyOptions,
  sampleSwitchChoreography,
  settleSwitchChoreography,
} from "./orrery-switch-choreography";

const contact = (id: number, ringRadius: number, angle = 0): WorldBody => ({
  id,
  kind: "contact",
  x: ringRadius * Math.sin(angle),
  y: -ringRadius * Math.cos(angle),
  radius: 18,
  ringRadius,
});

const radialDistance = (body: WorldBody) => Math.hypot(body.x, body.y);

describe("Orrery System-switch choreography", () => {
  it("classifies a disjoint switch and expresses every staged trajectory", () => {
    const source = [contact(1, 80)];
    const destination = [contact(2, 140, 0.4)];
    const transition = beginSwitchChoreography(source, destination, 7, {
      intensity: 1,
      reducedMotion: false,
    });

    expect(transition.entries.map(({ key, role }) => ({ key, role }))).toEqual([
      { key: "contact:1", role: "leaving" },
      { key: "contact:2", role: "entering" },
    ]);

    const accelerated = sampleSwitchChoreography(
      transition,
      ACCELERATE_END * 0.8,
    );
    expect(accelerated.phase).toBe("accelerate");
    expect(accelerated.accumulatedRotation).toBeGreaterThan(0);

    const shedProgress = [0.2, 0.45, 0.7, 0.9].map(
      (t) => SHED_START + (SHED_END - SHED_START) * t,
    );
    const shedRadii = shedProgress.map((progress) =>
      radialDistance(
        sampleSwitchChoreography(transition, progress).world.find(
          (body) => body.id === 1,
        )!,
      ),
    );
    for (let index = 1; index < shedRadii.length; index++)
      expect(shedRadii[index]).toBeGreaterThan(shedRadii[index - 1]);

    const destinationRadius = radialDistance(destination[0]);
    const captureProgress = [0.1, 0.35, 0.65, 0.9].map(
      (t) => CAPTURE_START + (CAPTURE_END - CAPTURE_START) * t,
    );
    const captureDistances = captureProgress.map((progress) =>
      radialDistance(
        sampleSwitchChoreography(transition, progress).world.find(
          (body) => body.id === 2,
        )!,
      ),
    );
    expect(captureDistances[0]).toBeGreaterThan(destinationRadius);
    for (let index = 1; index < captureDistances.length; index++)
      expect(captureDistances[index]).toBeLessThan(captureDistances[index - 1]);

    const settled = sampleSwitchChoreography(transition, 1);
    expect(settled.phase).toBe("complete");
    expect(settled.world.find((body) => body.id === 2)).toMatchObject({
      ...destination[0],
      opacity: 1,
      interactive: true,
    });
    expect(settled.world.find((body) => body.id === 1)?.opacity).toBe(0);
  });

  it("accelerates and then decelerates without reversing", () => {
    const transition = beginSwitchChoreography(
      [contact(1, 80)],
      [contact(2, 120)],
      8,
      { intensity: 1, reducedMotion: false },
    );
    const rotations = (progresses: number[]) =>
      progresses.map(
        (progress) =>
          sampleSwitchChoreography(transition, progress).accumulatedRotation,
      );
    const increments = (values: number[]) =>
      values.slice(1).map((value, index) => value - values[index]);

    const accelerate = increments(
      rotations(
        [0.02, 0.06, 0.1, 0.14, 0.18].map((p) => (p * ACCELERATE_END) / 0.2),
      ),
    );
    expect(accelerate.every((value) => value > 0)).toBe(true);
    for (let index = 1; index < accelerate.length; index++)
      expect(accelerate[index]).toBeGreaterThan(accelerate[index - 1]);

    const settle = increments(
      rotations(
        [0, 0.25, 0.5, 0.75, 1].map(
          (t) => SETTLE_START + (1 - SETTLE_START) * t,
        ),
      ),
    );
    expect(settle.every((value) => value > 0)).toBe(true);
    for (let index = 1; index < settle.length; index++)
      expect(settle[index]).toBeLessThan(settle[index - 1]);
    expect(
      sampleSwitchChoreography(transition, 1).angularVelocity,
    ).toBeLessThan(1e-9);
  });

  it("keeps retained contacts continuous and opaque across every boundary", () => {
    const source = [contact(1, 80, 0.2), contact(2, 120, 0.8)];
    const destination = [contact(1, 150, 1.1), contact(3, 210, 1.8)];
    const transition = beginSwitchChoreography(source, destination, 9, {
      intensity: 0.5,
      reducedMotion: false,
    });
    expect(transition.entries.map(({ role }) => role)).toEqual([
      "retained",
      "leaving",
      "entering",
    ]);
    const epsilon = 1e-6;
    for (const boundary of [
      ACCELERATE_END,
      SHED_START,
      CAPTURE_START,
      SHED_END,
      SETTLE_START,
      CAPTURE_END,
    ]) {
      const samples = [boundary - epsilon, boundary, boundary + epsilon].map(
        (progress) =>
          sampleSwitchChoreography(transition, progress).world.find(
            (body) => body.id === 1,
          )!,
      );
      expect(samples.map(({ opacity }) => opacity)).toEqual([1, 1, 1]);
      expect(
        Math.hypot(samples[1].x - samples[0].x, samples[1].y - samples[0].y),
      ).toBeLessThan(0.01);
      expect(
        Math.hypot(samples[2].x - samples[1].x, samples[2].y - samples[1].y),
      ).toBeLessThan(0.01);
    }
  });

  it("scales visible spin and displacement by turnover, not population size", () => {
    const shared = [1, 2, 3, 4].map((id, index) =>
      contact(id, 80 + index * 30, index * 0.2),
    );
    const overlapDestination = [...shared.slice(0, 3), contact(5, 200, 1.2)];
    const turnoverDestination = [5, 6, 7, 8].map((id, index) =>
      contact(id, 80 + index * 30, 1.2 + index * 0.2),
    );
    const overlap = beginSwitchChoreography(shared, overlapDestination, 10, {
      intensity: 0.25,
      reducedMotion: false,
    });
    const turnover = beginSwitchChoreography(shared, turnoverDestination, 11, {
      intensity: 1,
      reducedMotion: false,
    });
    expect(turnover.maximumRotation).toBeGreaterThan(overlap.maximumRotation);
    expect(turnover.radialDisplacement).toBeGreaterThan(
      overlap.radialDisplacement,
    );

    const overlapLeaving = sampleSwitchChoreography(
      overlap,
      SHED_END,
    ).world.find((body) => body.id === 4)!;
    const turnoverLeaving = sampleSwitchChoreography(
      turnover,
      SHED_END,
    ).world.find((body) => body.id === 1)!;
    expect(
      radialDistance(turnoverLeaving) - radialDistance(shared[0]),
    ).toBeGreaterThan(
      radialDistance(overlapLeaving) - radialDistance(shared[3]),
    );
  });

  it("assigns deterministic per-key stagger without frame-count state", () => {
    const source = [1, 2, 3, 4].map((id) => contact(id, 60 + id * 20));
    const destination = [5, 6, 7, 8].map((id) => contact(id, 60 + id * 20));
    const first = beginSwitchChoreography(source, destination, 12, {
      intensity: 1,
      reducedMotion: false,
    });
    const second = beginSwitchChoreography(source, destination, 13, {
      intensity: 1,
      reducedMotion: false,
    });
    expect(first.entries.map(({ key, stagger }) => ({ key, stagger }))).toEqual(
      second.entries.map(({ key, stagger }) => ({ key, stagger })),
    );
    expect(
      new Set(first.entries.map(({ stagger }) => stagger)).size,
    ).toBeGreaterThan(1);
  });

  it("re-targets from the exact displayed sample as roles change", () => {
    const a = [contact(1, 70, 0.1)];
    const b = [contact(1, 130, 1), contact(2, 190, 1.8)];
    const c = [contact(1, 210, 2.4), contact(3, 260, 2.9)];
    const first = beginSwitchChoreography(a, b, 20, {
      intensity: 0.7,
      reducedMotion: false,
    });
    const displayed = sampleSwitchChoreography(first, 0.61);
    const retargeted = retargetSwitchChoreography(first, 0.61, c, 21, {
      intensity: 0.8,
      reducedMotion: false,
    });
    const initial = sampleSwitchChoreography(retargeted, 0);
    for (const prior of displayed.world) {
      const next = initial.world.find((body) => body.id === prior.id)!;
      expect(next).toMatchObject({
        x: prior.x,
        y: prior.y,
        radius: prior.radius,
        ringRadius: prior.ringRadius,
        opacity: prior.opacity,
      });
    }
    expect(
      retargeted.entries.find((entry) => entry.key === "contact:2")?.role,
    ).toBe("leaving");
    expect(
      retargeted.entries.find((entry) => entry.key === "contact:1")?.role,
    ).toBe("retained");
  });

  it("is byte-stable while progress is held", () => {
    const transition = beginSwitchChoreography(
      [contact(1, 80)],
      [contact(2, 180)],
      22,
      { intensity: 1, reducedMotion: false },
    );
    const held = 0.537;
    expect(JSON.stringify(sampleSwitchChoreography(transition, held))).toBe(
      JSON.stringify(sampleSwitchChoreography(transition, held)),
    );
  });

  it("uses only crossfade and direct reposition for Reduced Motion", () => {
    const source = [contact(1, 80, 0.2), contact(2, 130, 0.8)];
    const destination = [contact(1, 180, 1.4), contact(3, 240, 2.1)];
    const transition = beginSwitchChoreography(source, destination, 23, {
      intensity: 1,
      reducedMotion: true,
    });
    const middle = sampleSwitchChoreography(transition, 0.5);
    expect(middle.accumulatedRotation).toBe(0);
    expect(middle.angularVelocity).toBe(0);
    expect(radialDistance(middle.world.find((body) => body.id === 2)!)).toBe(
      radialDistance(source[1]),
    );
    expect(radialDistance(middle.world.find((body) => body.id === 3)!)).toBe(
      radialDistance(destination[1]),
    );
    expect(middle.world.find((body) => body.id === 1)?.interactive).toBe(true);
    expect(
      sampleSwitchChoreography(transition, 1).world.find(
        (body) => body.id === 1,
      ),
    ).toMatchObject(destination[0]);
  });
});

// RG-027 / performance/AUD-PERF-001 (D-19): a settled switch retires departed geometry.
describe("settleSwitchChoreography", () => {
  const sun: WorldBody = {
    id: 0,
    kind: "sun",
    x: 0,
    y: 0,
    radius: 24,
    ringRadius: 0,
  };
  const a = [sun, contact(1, 80, 0.2), contact(2, 130, 0.8)];
  const b = [sun, contact(2, 180, 1.4), contact(3, 240, 2.1)];
  const keysOf = (transition: ReturnType<typeof beginSwitchChoreography>) =>
    transition.entries.map(({ key }) => key);

  it.each([false, true])(
    "keeps only destination entries and preserves generation/reduced motion (reduced=%s)",
    (reducedMotion) => {
      const transition = beginSwitchChoreography(a, b, 31, {
        intensity: 0.9,
        reducedMotion,
      });
      expect(keysOf(transition)).toEqual([
        "sun:0",
        "contact:1",
        "contact:2",
        "contact:3",
      ]);
      const settled = settleSwitchChoreography(transition);
      expect(keysOf(settled)).toEqual(["sun:0", "contact:2", "contact:3"]);
      expect(settled.generation).toBe(31);
      expect(settled.reducedMotion).toBe(reducedMotion);
      expect(settled.spinTurns).toBe(0);
      expect(settled.radialDisplacement).toBe(0);
      expect(settled.entries.every((entry) => entry.destination)).toBe(true);
      expect(settleSwitchChoreography(settled)).toEqual(settled);
    },
  );

  it("renders the same visible world at progress 1 (no visual change at settle)", () => {
    for (const reducedMotion of [false, true]) {
      const transition = beginSwitchChoreography(a, b, 32, {
        intensity: 1,
        reducedMotion,
      });
      const before = sampleSwitchChoreography(transition, 1);
      const after = sampleSwitchChoreography(
        settleSwitchChoreography(transition),
        1,
      );
      expect(after.world).toEqual(
        before.world.filter((body) => body.opacity > 0),
      );
      expect(after.world).toHaveLength(b.length);
      expect(after.generation).toBe(before.generation);
      expect(after.phase).toBe("complete");
    }
  });

  it("settles an empty destination to zero entries", () => {
    const settled = settleSwitchChoreography(
      beginSwitchChoreography(a, [], 33, {
        intensity: 1,
        reducedMotion: false,
      }),
    );
    expect(settled.entries).toEqual([]);
    expect(sampleSwitchChoreography(settled, 1).world).toEqual([]);
    expect(
      settleSwitchChoreography(
        beginSwitchChoreography([], [], 34, {
          intensity: 0,
          reducedMotion: false,
        }),
      ).entries,
    ).toEqual([]);
  });

  it("keeps a body present in source and destination under the same key", () => {
    const transition = beginSwitchChoreography(a, b, 35, {
      intensity: 0.4,
      reducedMotion: false,
    });
    const shared = settleSwitchChoreography(transition).entries.find(
      (entry) => entry.key === "contact:2",
    );
    expect(shared?.role).toBe("retained");
    expect(shared?.destination).toMatchObject(b[1]);
    expect(shared?.source).toMatchObject(b[1]);
  });

  it("does not compact a transition that has not been settled by its caller", () => {
    const transition = beginSwitchChoreography(a, b, 36, {
      intensity: 1,
      reducedMotion: false,
    });
    settleSwitchChoreography(transition);
    expect(keysOf(transition)).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// D-53 / D-52: O(N) keyed setup and the settled fast path, proved equivalent
// to a FROZEN copy of the pre-38.7 implementation (do not edit the copy).
// ---------------------------------------------------------------------------

type LegacySource = WorldBody &
  Partial<Pick<ChoreographyWorldBody, "opacity" | "interactive">>;

const legacy = (() => {
  const clamp01 = (value: number) =>
    Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
  const keyOf = (body: Pick<WorldBody, "id" | "kind" | "satelliteTarget">) => {
    if (body.kind === "satellite" && body.satelliteTarget) {
      const target = body.satelliteTarget;
      return `satellite:${JSON.stringify([target.parentId, target.parentUid, target.uid])}`;
    }
    return `${body.kind}:${body.id}`;
  };
  const stableUnit = (key: string) => {
    let hash = 2166136261;
    for (let index = 0; index < key.length; index++)
      hash = Math.imul(hash ^ key.charCodeAt(index), 16777619);
    return (hash >>> 0) / 4294967295;
  };
  const animated = (body: LegacySource): ChoreographyWorldBody => ({
    ...body,
    opacity: body.opacity ?? 1,
    interactive: body.interactive ?? true,
  });
  const spinTurnsForIntensity = (intensity: number) =>
    intensity <= 0 ? 0 : 1 + Math.round(clamp01(intensity) * 2);
  function begin(
    sourceWorld: readonly LegacySource[],
    destinationWorld: readonly WorldBody[],
    generation: number,
    options: SwitchChoreographyOptions,
  ): SwitchChoreography {
    const source = sourceWorld.map(animated);
    const destination = destinationWorld.map(animated);
    const keys = [
      ...source.map(keyOf),
      ...destination
        .map(keyOf)
        .filter((key) => !source.some((body) => keyOf(body) === key)),
    ];
    const entries = keys.flatMap((key): SwitchChoreographyEntry[] => {
      const from = source.find((body) => keyOf(body) === key);
      const to = destination.find((body) => keyOf(body) === key);
      const contact = (from ?? to)?.kind === "contact";
      if (!from && !to) return [];
      return [
        {
          key,
          source: from,
          destination: to,
          role: !contact
            ? "anchor"
            : from && to
              ? "retained"
              : from
                ? "leaving"
                : "entering",
          stagger: contact ? stableUnit(key) * STAGGER_WINDOW : 0,
        },
      ];
    });
    const intensity = clamp01(options.intensity);
    const spinTurns = options.reducedMotion
      ? 0
      : spinTurnsForIntensity(intensity);
    return {
      generation,
      entries,
      intensity,
      reducedMotion: options.reducedMotion,
      spinTurns,
      maximumRotation: spinTurns * Math.PI * 2,
      radialDisplacement:
        options.reducedMotion || intensity <= 0
          ? 0
          : BASE_RADIAL_DISPLACEMENT + RADIAL_DISPLACEMENT_RANGE * intensity,
    };
  }
  function settle(transition: SwitchChoreography): SwitchChoreography {
    const destination: ChoreographyWorldBody[] = [];
    for (const entry of transition.entries)
      if (entry.destination) destination.push(entry.destination);
    return begin(destination, destination, transition.generation, {
      intensity: 0,
      reducedMotion: transition.reducedMotion,
    });
  }
  /** The old per-entry progress >= 1 branch. */
  const settledSample = (transition: SwitchChoreography) =>
    transition.entries.map((entry) =>
      entry.destination
        ? { ...entry.destination, opacity: 1, interactive: true }
        : { ...entry.source!, opacity: 0, interactive: false },
    );
  return { begin, settle, settledSample };
})();

/** Deterministic PRNG (mulberry32), so a failure is reproducible by seed. */
function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBody(random: () => number, slot: number): LegacySource {
  const angle = random() * Math.PI * 2;
  const ring = 40 + random() * 600;
  const base = {
    x: ring * Math.sin(angle),
    y: -ring * Math.cos(angle),
    radius: 4 + random() * 20,
    ringRadius: ring,
  };
  if (slot === 0) return { ...base, id: 0, kind: "sun", x: 0, y: 0 };
  if (slot % 7 === 0) {
    const parentId = 1 + (slot % 31);
    return {
      ...base,
      id: -1,
      kind: "satellite",
      satelliteTarget: {
        kind: "satellite",
        uid: `moon-"${slot}"`,
        parentId,
        parentUid: `p-${parentId}`,
      },
    };
  }
  return { ...base, id: slot, kind: "contact" };
}

/** A random world over a shared slot pool: overlaps, departures, arrivals; no duplicate keys. */
function randomWorld(random: () => number, pool: number, decorate: boolean) {
  const world: LegacySource[] = [];
  for (let slot = 0; slot < pool; slot++) {
    if (random() < 0.45) continue;
    const body = randomBody(random, slot);
    if (decorate && random() < 0.5) {
      body.opacity = random();
      body.interactive = random() < 0.5;
    }
    world.push(body);
  }
  for (let i = world.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [world[i], world[j]] = [world[j], world[i]];
  }
  return world;
}

describe("D-53 O(N) keyed switch setup", () => {
  it("produces entries deep-equal to the frozen old implementation on randomised worlds", () => {
    for (let seed = 1; seed <= 120; seed++) {
      const random = rng(seed);
      const pool = 1 + Math.floor(random() * 80);
      const source = randomWorld(random, pool, true);
      const destination = randomWorld(random, pool, false);
      const options = {
        intensity: random() * 1.4 - 0.2,
        reducedMotion: random() < 0.3,
      };
      const generation = Math.floor(random() * 1000);
      expect(
        beginSwitchChoreography(source, destination, generation, options),
        `seed ${seed}`,
      ).toEqual(legacy.begin(source, destination, generation, options));
    }
  });

  it("keeps the first-match semantics of the old scan even when keys repeat", () => {
    const repeated: WorldBody[] = [
      contact(1, 80),
      contact(1, 120, 1),
      contact(2, 90),
    ];
    const destination: WorldBody[] = [
      contact(3, 60),
      contact(3, 70, 2),
      contact(1, 50),
    ];
    const options = { intensity: 0.6, reducedMotion: false };
    expect(beginSwitchChoreography(repeated, destination, 4, options)).toEqual(
      legacy.begin(repeated, destination, 4, options),
    );
  });

  it("a settled choreography samples exactly as the old per-entry progress-1 branch", () => {
    for (let seed = 200; seed <= 260; seed++) {
      const random = rng(seed);
      const pool = 1 + Math.floor(random() * 60);
      const source = randomWorld(random, pool, true);
      const destination = randomWorld(random, pool, false);
      const reducedMotion = random() < 0.4;
      const running = beginSwitchChoreography(source, destination, seed, {
        intensity: random(),
        reducedMotion,
      });
      const settled = settleSwitchChoreography(running);
      const { settledWorld, ...withoutFastPath } = settled;
      // Same entries as the frozen old settle; the fast path adds only the field.
      expect(withoutFastPath, `seed ${seed}`).toEqual(legacy.settle(running));
      for (const progress of [1, 1.2, Number.NaN]) {
        const sample = sampleSwitchChoreography(settled, progress);
        expect(sample.world).toBe(settledWorld);
        expect(sample.world).toEqual(legacy.settledSample(settled));
        expect(sample).toEqual(
          sampleSwitchChoreography(withoutFastPath, progress),
        );
      }
      // Below 1 the fast path never applies.
      expect(sampleSwitchChoreography(settled, 0.5)).toEqual(
        sampleSwitchChoreography(withoutFastPath, 0.5),
      );
    }
  });

  it("beginSettledSwitchChoreography is the intensity-0 self-choreography plus the fast path", () => {
    const random = rng(99);
    const world = randomWorld(random, 50, true);
    for (const reducedMotion of [false, true]) {
      const { settledWorld, ...rest } = beginSettledSwitchChoreography(
        world,
        8,
        reducedMotion,
      );
      const plain = legacy.begin(world, world, 8, {
        intensity: 0,
        reducedMotion,
      });
      expect(rest).toEqual(plain);
      expect(settledWorld).toEqual(legacy.settledSample(plain));
    }
  });

  it("a 2,000-body setup completes inside a generous smoke budget", () => {
    const random = rng(7);
    const source = randomWorld(random, 3600, true);
    const destination = randomWorld(random, 3600, false);
    expect(source.length + destination.length).toBeGreaterThan(3000);
    const started = performance.now();
    const transition = beginSwitchChoreography(source, destination, 1, {
      intensity: 1,
      reducedMotion: false,
    });
    settleSwitchChoreography(transition);
    expect(performance.now() - started).toBeLessThan(250);
  });
});

describe("D-53 settled world is shared by reference and never mutated (cycle-1 M6)", () => {
  const devGlobal = globalThis as { __DEV__?: boolean };
  const hadDev = "__DEV__" in devGlobal;
  const savedDev = devGlobal.__DEV__;
  afterEach(() => {
    if (hadDev) devGlobal.__DEV__ = savedDev;
    else delete devGlobal.__DEV__;
  });

  const satelliteParent = (world: readonly WorldBody[]) =>
    world.find((body) => body.kind === "contact")!;

  it("no downstream consumer mutates the sampled settled world", () => {
    const random = rng(4242);
    const world = randomWorld(random, 90, false).filter(
      (body) => body.kind !== "satellite",
    );
    const settled = beginSettledSwitchChoreography(world, 3, false);
    const sampled = sampleSwitchChoreography(settled, 1).world;
    const before = structuredClone(sampled);
    const viewport = { width: 400, height: 800 };
    const parent = satelliteParent(sampled);
    const rows: OrrerySatellite[] = [
      {
        uid: "m1",
        parentId: parent.id,
        parentUid: `uid-${parent.id}`,
        personName: "Moon",
        relationType: null,
      },
    ];
    const members = sampled
      .filter((body) => body.kind === "contact")
      .map((body) => ({ id: body.id, uid: `uid-${body.id}` }));
    const contacts = sampled.filter((body) => body.kind === "contact");
    const drag = (active: boolean): ReorderDrag => ({
      generation: 3,
      id: contacts[0].id,
      request: {} as ReorderDrag["request"],
      radii: contacts.map((_, index) => 60 + index * 10),
      offset: { x: 0, y: 0 },
      reorderedVisibleIds: [...contacts.map((body) => body.id)].reverse(),
      active,
      origin: { x: 0, y: 0 },
    });

    // Every consumer of a sampled world (grep sampleSwitchChoreography src).
    for (const held of [drag(true), drag(false), null]) {
      const reordered = previewReorder(sampled, held);
      const moons = deriveSatelliteBodies(
        reordered,
        indexSatellites(rows, members),
        true,
        1,
      ).moons;
      const complete = [...reordered, ...moons];
      projectAnimatedFrame(
        { generation: 3, from: complete, to: complete },
        1,
        HOME_CAMERA,
        viewport,
      );
    }
    projectSwitchChoreographyFrame(settled, 1, HOME_CAMERA, viewport);
    beginSwitchChoreography(sampled, world.slice(3), 4, {
      intensity: 1,
      reducedMotion: false,
    });
    retargetSwitchChoreography(settled, 1, world.slice(5), 5, {
      intensity: 0.5,
      reducedMotion: false,
    });

    expect(sampled).toEqual(before);
    expect(sampleSwitchChoreography(settled, 1).world).toBe(sampled);
  });

  it("is deep-frozen under __DEV__ only", () => {
    const world: WorldBody[] = [
      { id: 0, kind: "sun", x: 0, y: 0, radius: 16, ringRadius: 0 },
      contact(1, 80),
      {
        id: -1,
        kind: "satellite",
        x: 3,
        y: 4,
        radius: 2,
        ringRadius: 0,
        satelliteTarget: {
          kind: "satellite",
          uid: "m",
          parentId: 1,
          parentUid: "u1",
        },
      },
    ];
    devGlobal.__DEV__ = true;
    const frozen = beginSettledSwitchChoreography(world, 1, false)
      .settledWorld!;
    expect(Object.isFrozen(frozen)).toBe(true);
    for (const body of frozen) expect(Object.isFrozen(body)).toBe(true);
    expect(Object.isFrozen(frozen[2].satelliteTarget)).toBe(true);
    expect(() => {
      (frozen[1] as { x: number }).x = 5;
    }).toThrow(TypeError);
    const viaSettle = settleSwitchChoreography(
      beginSwitchChoreography(world, world, 2, {
        intensity: 1,
        reducedMotion: false,
      }),
    ).settledWorld!;
    expect(Object.isFrozen(viaSettle)).toBe(true);

    devGlobal.__DEV__ = false;
    const open = beginSettledSwitchChoreography(world, 1, false).settledWorld!;
    expect(Object.isFrozen(open)).toBe(false);
    expect(Object.isFrozen(open[1])).toBe(false);
  });
});
