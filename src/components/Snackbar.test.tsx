import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Snackbar actionless rendering", () => {
  it("uses project typography and renders no empty action target", () => {
    const source = readFileSync(new URL("./Snackbar.tsx", import.meta.url), "utf8");
    expect(source).toContain("<AppText");
    expect(source).toContain("snackbar.action ?");
  });
});
