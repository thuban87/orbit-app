import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("BaseOverlay Android Modal gesture-root contract", () => {
  it("places a full-screen GestureHandlerRootView immediately inside RNModal", () => {
    const source = readFileSync(resolve(__dirname, "overlay-base.tsx"), "utf8");
    expect(source).toContain('import { GestureHandlerRootView }');
    expect(source).toMatch(
      /<RNModal[\s\S]*?<GestureHandlerRootView style={styles\.root}>/,
    );
  });
});
