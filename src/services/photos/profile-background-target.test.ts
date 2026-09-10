import { describe, expect, it } from "vitest";
import {
  MAX_PROFILE_BACKGROUND_OUTPUT_LONG_EDGE,
  profileBackgroundTarget,
} from "./profile-background-target";

describe("Profile background target", () => {
  it("shares the measured portrait Profile aspect between preview and bounded output", () => {
    const target = profileBackgroundTarget({ width: 1080, height: 2400 });

    expect(target.preview.width / target.preview.height).toBeCloseTo(
      1080 / 2400,
      8,
    );
    expect(target.output.width / target.output.height).toBeCloseTo(
      1080 / 2400,
      3,
    );
    expect(
      Math.max(target.output.width, target.output.height),
    ).toBeLessThanOrEqual(MAX_PROFILE_BACKGROUND_OUTPUT_LONG_EDGE);
  });
});
