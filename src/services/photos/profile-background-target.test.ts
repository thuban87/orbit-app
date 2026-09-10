import { describe, expect, it } from "vitest";
import {
  fitProfileBackgroundPreview,
  MAX_PROFILE_BACKGROUND_OUTPUT_LONG_EDGE,
  profileBackgroundTarget,
} from "./profile-background-target";

describe("Profile background target", () => {
  it("shares the measured portrait Profile aspect between preview and bounded output", () => {
    const target = profileBackgroundTarget({ width: 411, height: 891 });

    expect(target.preview.width / target.preview.height).toBeCloseTo(
      411 / 891,
      8,
    );
    expect(target.output.width / target.output.height).toBeCloseTo(
      411 / 891,
      3,
    );
    expect(target.preview.width).toBeLessThanOrEqual(360);
    expect(target.preview.height).toBeLessThanOrEqual(891);
    expect(Math.max(target.output.width, target.output.height)).toBe(
      MAX_PROFILE_BACKGROUND_OUTPUT_LONG_EDGE,
    );
  });

  it.each([
    { name: "normal controls", available: { width: 363, height: 650 } },
    { name: "enlarged-text controls", available: { width: 363, height: 430 } },
  ])("fits the entire preview around $name", ({ available }) => {
    const preview = fitProfileBackgroundPreview(
      { width: 411, height: 891 },
      available,
    );

    expect(preview.width).toBeLessThanOrEqual(available.width);
    expect(preview.height).toBeLessThanOrEqual(available.height);
    expect(preview.width / preview.height).toBeCloseTo(411 / 891, 8);
  });
});
