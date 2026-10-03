/**
 * Orrery perf fixture spec (38.7 Plan 01, D-56): determinism, the labs' shared
 * cast reproduced member for member, the stress set's shape, and the pinned
 * SEED_SPEC_VERSION.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildOrrerySeedPlan,
  ORRERY_FIXTURE_PREFERENCES,
  SEED_SPEC_VERSION,
  SIZE_CAST,
  SIZE_SYSTEM_SIZES,
  STRESS_COUNT,
  STRESS_MOON_PARENTS,
  STRESS_PHOTO_EVERY,
  STRESS_SYSTEM_NAME,
} from "./orrery-seed-spec";

const plan = buildOrrerySeedPlan();

describe("orrery seed spec", () => {
  it("is deterministic", () => {
    expect(buildOrrerySeedPlan()).toEqual(plan);
  });

  it("pins SEED_SPEC_VERSION to the hash of the plan (bump it on any spec change)", () => {
    const hash = createHash("sha256")
      .update(JSON.stringify(buildOrrerySeedPlan()))
      .digest("hex")
      .slice(0, 12);
    expect(SEED_SPEC_VERSION).toBe(hash);
  });

  it("has 120 unique cast names", () => {
    expect(plan.cast).toHaveLength(SIZE_CAST);
    expect(new Set(plan.cast.map((m) => m.name)).size).toBe(SIZE_CAST);
  });

  // Values computed by running the labs' own `sizeSpec(i)`
  // (orbit-orrery-lab-c src/__dev__/lab-c-seed.ts, identical in lab-b-seed.ts).
  it("reproduces lab cast member 0", () => {
    expect(plan.cast[0]).toMatchObject({
      name: "Aiden Ashworth",
      kind: "S",
      interval: 7,
      days: 3,
      rarely: 0,
      history: 0,
      photo: false,
      moons: [],
    });
  });

  it("reproduces lab cast member 11", () => {
    expect(plan.cast[11]).toMatchObject({
      name: "Luca Lombardi",
      kind: "W",
      interval: 90,
      days: 84,
      rarely: 0,
      history: 1,
      photo: false,
      moons: [
        { personName: "Mara", relationType: "Partner" },
        { personName: "Theo", relationType: "Child" },
      ],
    });
  });

  it("reproduces lab cast member 70", () => {
    expect(plan.cast[70]).toMatchObject({
      name: "Ximena Bellamy",
      kind: "S",
      interval: 7,
      days: 5,
      rarely: 0,
      history: 2,
      photo: true,
      moons: [
        { personName: "Owen", relationType: "Friend" },
        { personName: "Lia", relationType: "Partner" },
      ],
    });
  });

  it("reproduces further lab members (decay, rogue-unresponsive, never)", () => {
    expect(plan.cast[2]).toMatchObject({
      name: "Callum Carver",
      interval: 90,
      days: 173,
      history: 5,
    });
    expect(plan.cast[3]).toMatchObject({
      name: "Daria Delacroix",
      interval: 21,
      days: 35,
      rarely: 1,
      history: 5,
    });
    expect(plan.cast[4]).toMatchObject({
      name: "Emeka Esposito",
      kind: "N",
      days: null,
      touchpoints: [],
      photo: true,
    });
    expect(plan.cast[119]).toMatchObject({
      name: "Yusuf Lombardi",
      interval: 45,
      days: 149,
      history: 2,
    });
  });

  it("gives every contacted member its latest touchpoint at `days`, then one per interval", () => {
    for (const member of [...plan.cast, ...plan.stress]) {
      if (member.days === null) {
        expect(member.touchpoints).toEqual([]);
        continue;
      }
      expect(member.touchpoints).toHaveLength(member.history + 1);
      expect(member.touchpoints.map((tp) => tp.daysAgo)).toEqual(
        member.touchpoints.map(
          (_, k) => (member.days ?? 0) + k * member.interval,
        ),
      );
    }
  });

  it("defines Size N as cast indexes 0..N-1 and the stress System as every stress member", () => {
    for (const size of SIZE_SYSTEM_SIZES) {
      const system = plan.systems.find((s) => s.name === `Size ${size}`);
      expect(system).toMatchObject({ part: "cast" });
      expect(system?.members).toEqual(
        Array.from({ length: size }, (_, i) => i),
      );
    }
    const stress = plan.systems.find((s) => s.name === STRESS_SYSTEM_NAME);
    expect(stress?.part).toBe("stress");
    expect(stress?.members).toHaveLength(STRESS_COUNT);
  });

  it("has 880 unique stress names disjoint from the cast", () => {
    const names = new Set(plan.stress.map((m) => m.name));
    expect(plan.stress).toHaveLength(STRESS_COUNT);
    expect(names.size).toBe(STRESS_COUNT);
    for (const member of plan.cast) expect(names.has(member.name)).toBe(false);
  });

  it("puts a photo on every 4th stress member and moons on the first 60", () => {
    expect(plan.stress.filter((m) => m.photo)).toHaveLength(
      STRESS_COUNT / STRESS_PHOTO_EVERY,
    );
    const parents = plan.stress.filter((m) => m.moons.length > 0);
    expect(parents).toHaveLength(STRESS_MOON_PARENTS);
    expect(parents.every((m) => m.index < STRESS_MOON_PARENTS)).toBe(true);
    expect(parents.every((m) => m.moons.length <= 3)).toBe(true);
  });

  it("mixes every status kind in the stress set with light histories", () => {
    const kinds = new Set(plan.stress.map((m) => m.kind));
    for (const kind of ["S", "W", "D", "R", "N", "O"])
      expect(kinds.has(kind as never)).toBe(true);
    expect(Math.max(...plan.stress.map((m) => m.history))).toBeLessThanOrEqual(
      3,
    );
  });

  it("never reuses a photo seed", () => {
    const seeds = [...plan.cast, ...plan.stress].map((m) => m.photoSeed);
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it("pins the Orrery preferences (C-M5) inside the hashed plan", () => {
    expect(plan.preferences).toEqual(ORRERY_FIXTURE_PREFERENCES);
    expect(ORRERY_FIXTURE_PREFERENCES).toEqual({
      density: "balanced",
      satellitesEnabled: 1,
      lastSystemName: "Size 120",
    });
  });
});
