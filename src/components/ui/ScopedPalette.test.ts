/**
 * ScopedPalette (D-34): the render prop receives the palette `useTheme()`
 * returns where the helper mounts, and its output passes through unchanged.
 * Render-free: `@/theme` is mocked and the component function is called
 * directly (no React renderer is installed).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";

const palette = THEME_PRESETS.standard.light;
const useTheme = vi.fn(() => ({ colors: palette }));

vi.mock("@/theme", () => ({
  useTheme: () => useTheme(),
}));

const { ScopedPalette } = await import("./ScopedPalette");

describe("ScopedPalette", () => {
  beforeEach(() => {
    useTheme.mockClear();
  });

  it("calls useTheme() once and hands that exact palette to the render prop", () => {
    const render = vi.fn((colors: typeof palette) => colors.danger);
    const out = ScopedPalette({ children: render });
    expect(useTheme).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledTimes(1);
    expect(render.mock.calls[0][0]).toBe(palette);
    expect(out).toBe(palette.danger);
  });

  it("returns the render prop's output directly (no wrapper node)", () => {
    const element = { type: "Text", props: {} };
    expect(ScopedPalette({ children: () => element as never })).toBe(element);
    expect(ScopedPalette({ children: () => null })).toBeNull();
  });

  it("reads the palette through useTheme() in its own body, never an unscoped or glass-only hook", () => {
    const source = readFileSync(join(__dirname, "ScopedPalette.tsx"), "utf8");
    expect(source).toMatch(
      /import \{[^}]*\buseTheme\b[^}]*\} from "@\/theme";/,
    );
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code).toMatch(
      /export function ScopedPalette\([^)]*\)[^{]*\{\s*const \{ colors \} = useTheme\(\);\s*return children\(colors\);\s*\}/,
    );
    expect(code).not.toMatch(/useUnscopedTheme|useGlassForegroundColors/);
    expect(code).not.toMatch(/<View|<>|style=|react-native/);
  });
});
