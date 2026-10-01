import { describe, expect, it, vi } from "vitest";

vi.mock("@shopify/react-native-skia", () => ({ Skia: {} }));

import type { WorldBody } from "@/logic/orrery-camera-logic";
import {
  beginSwitchChoreography,
  CAPTURE_END,
  SHED_START,
  sampleSwitchSignal,
} from "@/logic/orrery-switch-choreography";
import {
  LAB_EFFECT_SOURCES,
  WARMUP_FILTERS,
  zeroUniforms,
} from "./labb-effects";
import {
  bodySwitchFx,
  classRingSwitchFade,
  displayedSkyHue,
  flareEnvelope,
  PARTICLE_CAPACITY,
  PARTICLE_END,
  particleAt,
  particlesPerBody,
  ROLE_ENTERING,
  ROLE_LEAVING,
  ROLE_RETAINED,
  SHOCK_MIN_INTENSITY,
  STREAK_BAND_H,
  STREAK_BANDS,
  shockwaveState,
  skyHueWeight,
  streakBand,
  streakBandLength,
  streakXform,
  switchFxLive,
  switchRoles,
  systemSkyIndex,
  trimRingState,
  warpAmount,
} from "./labb-switch-logic";

const contact = (id: number, ringRadius: number, angle = 0): WorldBody => ({
  id,
  kind: "contact",
  x: ringRadius * Math.sin(angle),
  y: -ringRadius * Math.cos(angle),
  radius: 18,
  ringRadius,
});
const sun: WorldBody = {
  id: 0,
  kind: "sun",
  x: 0,
  y: 0,
  radius: 30,
  ringRadius: 0,
};

const make = (intensity: number, reducedMotion = false) =>
  beginSwitchChoreography(
    [sun, contact(1, 80), contact(2, 120, 1)],
    [sun, contact(2, 140, 1.4), contact(3, 200, 2)],
    5,
    { intensity, reducedMotion },
  );

describe("switch roles and signal-driven envelopes", () => {
  const t = make(0.8);
  const roles = switchRoles(t);

  it("maps every key to its choreography role once per transition", () => {
    expect(roles.generation).toBe(5);
    expect(roles.byKey["contact:1"][0]).toBe(ROLE_LEAVING);
    expect(roles.byKey["contact:2"][0]).toBe(ROLE_RETAINED);
    expect(roles.byKey["contact:3"][0]).toBe(ROLE_ENTERING);
    expect(roles.leaving).toHaveLength(1);
    expect(roles.entering).toHaveLength(1);
    expect(roles.retained).toHaveLength(1);
    expect(switchRoles(t)).toEqual(roles);
  });

  it("is completely inert at rest and under reduced motion", () => {
    const rest = sampleSwitchSignal(t, 1);
    expect(switchFxLive(rest, false)).toBe(false);
    expect(warpAmount(rest)).toBe(0);
    expect(shockwaveState(rest)[1]).toBe(0);
    const mid = sampleSwitchSignal(t, 0.5);
    expect(switchFxLive(mid, true)).toBe(false);
    const reduced = sampleSwitchSignal(make(1, true), 0.5);
    expect(switchFxLive(reduced, false)).toBe(false);
    expect(warpAmount(reduced)).toBe(0);
    expect(shockwaveState(reduced)[1]).toBe(0);
    expect(trimRingState(roles, "contact:1", mid, false)).toEqual([0, 0]);
    expect(bodySwitchFx(roles, "contact:1", mid, false)).toEqual([0, 0]);
    expect(classRingSwitchFade(roles, "contact:1", mid, false)).toBe(1);
  });

  it("scales warp with the spin and membership change", () => {
    const low = warpAmount(sampleSwitchSignal(make(0.1), 0.4));
    const high = warpAmount(sampleSwitchSignal(make(1), 0.4));
    expect(high).toBeCloseTo(1, 6);
    expect(low).toBeGreaterThan(0);
    expect(low).toBeLessThan(high);
    expect(warpAmount(sampleSwitchSignal(make(1), 0.02))).toBeLessThan(0.05);
  });

  it("gates the system-lock shockwave by intensity and keeps it inside the settle", () => {
    const quiet = make(SHOCK_MIN_INTENSITY - 0.01);
    expect(shockwaveState(sampleSwitchSignal(quiet, 0.85))[1]).toBe(0);
    expect(shockwaveState(sampleSwitchSignal(t, 0.5))[1]).toBe(0);
    expect(shockwaveState(sampleSwitchSignal(t, 0.85))[1]).toBeGreaterThan(0);
    expect(shockwaveState(sampleSwitchSignal(t, 0.9999))[1]).toBeLessThan(0.01);
  });

  it("unwinds leaving rings 1→0 and draws entering rings 0→1, crossfading back to class style", () => {
    const at = (p: number) => sampleSwitchSignal(t, p);
    expect(trimRingState(roles, "contact:1", at(0.1), true)[0]).toBe(1);
    expect(trimRingState(roles, "contact:1", at(0.7), true)[0]).toBe(0);
    expect(trimRingState(roles, "contact:3", at(0.4), true)[0]).toBe(0);
    expect(trimRingState(roles, "contact:3", at(0.9), true)[0]).toBe(1);
    expect(trimRingState(roles, "contact:2", at(0.5), true)).toEqual([0, 0]);
    expect(classRingSwitchFade(roles, "contact:1", at(0.3), true)).toBe(0);
    expect(classRingSwitchFade(roles, "contact:3", at(0.5), true)).toBe(0);
    expect(
      classRingSwitchFade(roles, "contact:3", at(0.99), true),
    ).toBeGreaterThan(0.9);
    expect(classRingSwitchFade(roles, "contact:2", at(0.5), true)).toBe(1);
    // A role map from another generation never applies.
    const stale = { ...roles, generation: 4 };
    expect(classRingSwitchFade(stale, "contact:1", at(0.3), true)).toBe(1);
  });

  it("dissolves leaving bodies and flares entering ones once, around capture end", () => {
    const at = (p: number) => sampleSwitchSignal(t, p);
    expect(
      bodySwitchFx(roles, "contact:1", at(SHED_START - 0.01), true),
    ).toEqual([0, 0]);
    const d = bodySwitchFx(roles, "contact:1", at(0.4), true)[0];
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThanOrEqual(1);
    const stagger = roles.byKey["contact:3"][1];
    expect(flareEnvelope(CAPTURE_END + stagger, stagger)).toBeGreaterThan(0.5);
    expect(flareEnvelope(0.3, stagger)).toBe(0);
    expect(
      bodySwitchFx(roles, "contact:3", at(CAPTURE_END + stagger), true)[1],
    ).toBeGreaterThan(0.5);
  });
});

describe("stateless particles", () => {
  it("are deterministic, finite and pure in progress", () => {
    for (const p of [0.2, 0.3, 0.45, 0.6]) {
      for (let s = 0; s < 30; s++) {
        const a = particleAt(3.3, s, p, 0.01, 100, 200, 14, 50, 60);
        const b = particleAt(3.3, s, p, 0.01, 100, 200, 14, 50, 60);
        expect(a).toEqual(b);
        if (a)
          for (const v of Object.values(a))
            expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it("never live before the shed or at / after PARTICLE_END", () => {
    for (let s = 0; s < 60; s++) {
      expect(
        particleAt(1.1, s, SHED_START - 0.001, 0, 0, 0, 10, 5, 5),
      ).toBeNull();
      expect(
        particleAt(1.1, s, PARTICLE_END, 0.035, 0, 0, 10, 5, 5),
      ).toBeNull();
      expect(particleAt(1.1, s, 0.99, 0.035, 0, 0, 10, 5, 5)).toBeNull();
    }
    const alive = Array.from({ length: 60 }, (_, s) =>
      particleAt(1.1, s, 0.4, 0, 0, 0, 10, 5, 5),
    ).filter(Boolean);
    expect(alive.length).toBeGreaterThan(5);
  });

  it("fit the fixed Atlas capacity and scale with intensity", () => {
    expect(particlesPerBody(0, 1)).toBe(0);
    expect(particlesPerBody(1, 1)).toBeGreaterThan(particlesPerBody(1, 0));
    for (const n of [1, 10, 40, 120, 600])
      expect(n * particlesPerBody(n, 1)).toBeLessThanOrEqual(
        Math.max(PARTICLE_CAPACITY, n),
      );
  });
});

describe("streak sprites", () => {
  it("picks bands monotonically by length", () => {
    expect(streakBand(1)).toBe(0);
    expect(streakBand(1e6)).toBe(STREAK_BANDS - 1);
    let last = -1;
    for (let len = 4; len < 400; len *= 1.3) {
      const b = streakBand(len);
      expect(b).toBeGreaterThanOrEqual(last);
      last = b;
    }
    expect(streakBandLength(streakBand(64))).toBeCloseTo(64, -1);
  });

  it("puts the streak HEAD on the requested point, pointing along the direction", () => {
    const [sc, ss, tx, ty, , w] = streakXform(120, 300, 0.6, 0.8, 3, 90);
    const half = STREAK_BAND_H / 2;
    // RSXform maps sprite-local (w, half) — the head — to the requested point.
    expect(sc * w - ss * half + tx).toBeCloseTo(120, 6);
    expect(ss * w + sc * half + ty).toBeCloseTo(300, 6);
    expect(Math.atan2(ss, sc)).toBeCloseTo(Math.atan2(0.8, 0.6), 6);
  });
});

describe("per-System sky hue (C-05)", () => {
  it("keeps All Contacts on the default hue and hashes other Systems stably", () => {
    expect(systemSkyIndex({ kind: "builtin", id: "all-contacts" }, 6, 3)).toBe(
      3,
    );
    const a = systemSkyIndex({ kind: "custom", uid: "abc" }, 6, 3);
    expect(systemSkyIndex({ kind: "custom", uid: "abc" }, 6, 3)).toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(6);
    expect(systemSkyIndex(null, 6, 3)).toBe(3);
  });

  it("crossfades over the settle (whole switch under reduced motion), order-robust", () => {
    const t = make(1);
    expect(skyHueWeight(sampleSwitchSignal(t, 0.3))).toBe(0);
    expect(skyHueWeight(sampleSwitchSignal(t, 1))).toBe(1);
    const r = make(1, true);
    expect(skyHueWeight(sampleSwitchSignal(r, 0.5))).toBeCloseTo(0.5, 6);
    const state = { from: [0, 0, 0], to: [1, 1, 1], gen: 5 };
    expect(displayedSkyHue(state, sampleSwitchSignal(t, 0.3))).toEqual([
      0, 0, 0,
    ]);
    expect(displayedSkyHue(state, sampleSwitchSignal(t, 1))).toEqual([1, 1, 1]);
    // The new hue target arrived before its transition: keep showing `from`.
    expect(
      displayedSkyHue({ ...state, gen: 6 }, sampleSwitchSignal(t, 1)),
    ).toEqual([0, 0, 0]);
    // The transition is newer than the hue target: show the settled `to`.
    expect(
      displayedSkyHue({ ...state, gen: 4 }, sampleSwitchSignal(t, 0.2)),
    ).toEqual([1, 1, 1]);
  });
});

describe("switch-only effects are warmed at mount", () => {
  it("lists the image-filter experiment and zero-fills every declared uniform", () => {
    expect(WARMUP_FILTERS).toContain("shockFilter");
    const u = zeroUniforms(LAB_EFFECT_SOURCES.shockFilter);
    expect(Object.keys(u).sort()).toEqual(["uShock", "uShock2"]);
    expect(u.uShock).toEqual([0, 0, 0, 0]);
    const shock = zeroUniforms(LAB_EFFECT_SOURCES.switchShock);
    expect(Object.keys(shock).sort()).toEqual(["uShk", "uShkC", "uShkH"]);
    // The body shaders declare the switch uniform (dissolve / flare).
    expect(Object.keys(zeroUniforms(LAB_EFFECT_SOURCES.bodyPhoto))).toContain(
      "uK",
    );
  });
});

describe("render-path roles constants", () => {
  it("keeps entering distinct from leaving", () => {
    expect(ROLE_ENTERING).not.toBe(ROLE_LEAVING);
  });
});
