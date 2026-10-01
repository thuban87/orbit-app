import { describe, expect, it, vi } from "vitest";

vi.mock("@shopify/react-native-skia", () => ({ Skia: {} }));

import { defaultLabFlags, type LabFlags } from "@/stores/orrery-labb-fx-store";
import { resolveLabFxProfile } from "@/theme/orrery-lab-fx";
import { labAmbientNeeded } from "./labb-clock-logic";
import { LAB_EFFECT_SOURCES } from "./labb-effects";
import { uniformOrder } from "./labb-layer-plan";
import { wakeUniforms } from "./labb-rings-logic";

const profile = resolveLabFxProfile("galaxy", "dark", true);
const flags = (patch: Partial<LabFlags> = {}): LabFlags => ({
  ...defaultLabFlags(),
  ...patch,
});
const AMBIENT_OFF: Partial<LabFlags> = {
  nebulaDrift: false,
  twinkle: false,
  ringFlow: false,
  sunCorona: false,
  sunPlasma: false,
  sunPulse: false,
};

describe("labAmbientNeeded (R1 idle clock)", () => {
  it("defaults animate; reduced motion and freeze stop the clock", () => {
    expect(labAmbientNeeded(flags(), false, profile)).toBe(true);
    expect(labAmbientNeeded(flags(), true, profile)).toBe(false);
    expect(labAmbientNeeded(flags({ freezeClock: true }), false, profile)).toBe(
      false,
    );
  });
  it("every ambient effect off → idle", () => {
    expect(labAmbientNeeded(flags(AMBIENT_OFF), false, profile)).toBe(false);
  });
  it("each ambient consumer alone keeps the clock", () => {
    for (const id of [
      "nebulaDrift",
      "twinkle",
      "sunCorona",
      "sunPulse",
    ] as const)
      expect(
        labAmbientNeeded(flags({ ...AMBIENT_OFF, [id]: true }), false, profile),
        id,
      ).toBe(true);
  });
  it("ring flow respects the density LOD", () => {
    const f = flags({ ...AMBIENT_OFF, ringFlow: true });
    expect(labAmbientNeeded(f, false, profile, 120, 160)).toBe(true);
    expect(labAmbientNeeded(f, false, profile, 400, 160)).toBe(false);
  });
  it("hidden layers do not count", () => {
    expect(
      labAmbientNeeded(
        flags({ environment: false, rings: false, bodies: false }),
        false,
        profile,
      ),
    ).toBe(false);
  });
});

describe("wake uniform layout (R1 pre-flattened wakes)", () => {
  it("is uColor, uWake, uCam in declaration order with half width at [6]", () => {
    expect(uniformOrder(LAB_EFFECT_SOURCES.ringWake)).toEqual([
      "uColor",
      "uWake",
      "uCam",
    ]);
    const u = wakeUniforms(
      [0.1, 0.2, 0.3, 1],
      0.5,
      1.2,
      80,
      6,
      0.4,
      [0.6, 0.8, 0.3, 2],
    );
    const flat = [...u.uColor, ...u.uWake, ...u.uCam];
    expect(flat).toEqual([
      0.1, 0.2, 0.3, 0.5, 1.2, 80, 1.5, 0.4, 0.6, 0.8, 0.3, 0,
    ]);
  });
});
