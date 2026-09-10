import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ProfileBackgroundManager crop workspace contract", () => {
  it("uses the measured crop workspace for the contained source and full gesture surface", () => {
    const source = readFileSync(
      resolve(__dirname, "ProfileBackgroundManager.tsx"),
      "utf8",
    );

    expect(source).toContain('cropTouchSurface: { flex: 1, width: "100%" }');
    expect(source).toContain("cropSpace.width / source.width");
    expect(source).toContain(
      "(cropSpace.width - source.width * scale) / 2",
    );
    expect(source).not.toContain("viewportWidth / source.width");
  });
});
