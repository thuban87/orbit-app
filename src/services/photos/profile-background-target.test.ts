import { describe, expect, it } from "vitest";
import {
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
});
