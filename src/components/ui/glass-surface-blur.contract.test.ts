/**
 * Android blur is OFF "for now" (owner ruling D-61, 2026-09-27).
 *
 * expo-blur 57 needs a `blurTarget` for its Dimezis Android blur methods. Without
 * one, `blurMethod="dimezisBlurViewSdk31Plus"` silently falls back to no blur on
 * the native side AND logs a `console.warn` for every mounted BlurView (a source
 * of the debug LogBox toast). `blurMethod="none"` requests that same fallback
 * explicitly: the native view paints the identical translucent tint layer, so
 * the look is unchanged and the warning stops. `blurMethod` is Android-only, so
 * iOS keeps its real blur. Real Android blur is not in 38.4.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "..");

function walk(dir: string, out: string[]): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "node_modules") continue;
      walk(path, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

describe("GlassSurface Android blur (D-61)", () => {
  const source = readFileSync(join(__dirname, "GlassSurface.tsx"), "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("requests no Android blur explicitly on its BlurView", () => {
    const blurView = code.match(/<BlurView[\s\S]*?\/>/)?.[0] ?? "";
    expect(blurView).not.toBe("");
    expect(blurView).toMatch(/blurMethod=\{ANDROID_BLUR_METHOD\}/);
    expect(code).toMatch(/const ANDROID_BLUR_METHOD = "none"( as const)?;/);
  });

  it("never selects a Dimezis blur method anywhere in the app (it needs a blurTarget)", () => {
    const offenders = walk(SRC, [])
      .filter((path) =>
        readFileSync(path, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\/\/.*$/gm, "")
          .includes("dimezisBlurView"),
      )
      .map((path) => relative(SRC, path));
    expect(offenders).toEqual([]);
  });
});
