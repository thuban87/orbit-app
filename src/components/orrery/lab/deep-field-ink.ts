/**
 * ORRERY LAB A — theme tokens resolved once (JS thread) into plain RGBA arrays
 * the UI-thread worklets and SkSL uniforms consume. Every hue comes from a
 * `ThemePalette` token; nothing here is a colour literal (check:colors).
 *
 * `chart` = the light "chart paper" variant: decided from the background's
 * luminance so it follows whatever palette (galaxy/standard × light/dark) is
 * active, with no extra prop threaded through the screen.
 */
import { Skia } from "@shopify/react-native-skia";
import type { ThemePalette } from "@/theme/theme-types";

export type Rgba = readonly number[];

export interface DeepFieldInk {
  /** Light palette → ink-on-paper rendering (no additive glow anywhere). */
  chart: boolean;
  background: Rgba;
  voidTone: Rgba;
  nebulaA: Rgba;
  nebulaB: Rgba;
  grid: Rgba;
  starlight: Rgba;
  shadow: Rgba;
  textPrimary: Rgba;
  textSecondary: Rgba;
}

const FALLBACK: Rgba = [0, 0, 0, 1];

/** Token string → [r,g,b,a] 0..1. Tolerates test mocks that return strings. */
export function tokenInk(token: string): Rgba {
  const make = (Skia as { Color?: (value: string) => unknown } | undefined)
    ?.Color;
  if (typeof make !== "function") return FALLBACK;
  const value = make(token) as ArrayLike<number> | string | undefined;
  if (!value || typeof value === "string" || value.length !== 4)
    return FALLBACK;
  return [value[0], value[1], value[2], value[3]];
}

/** Relative luminance (sRGB-ish, sufficient for a light/dark decision). */
export function luminance(color: Rgba): number {
  return 0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2];
}

export function resolveDeepFieldInk(colors: ThemePalette): DeepFieldInk {
  const background = tokenInk(colors.background);
  return {
    chart: luminance(background) > 0.5,
    background,
    voidTone: tokenInk(colors.orreryVoid),
    nebulaA: tokenInk(colors.orreryNebulaA),
    nebulaB: tokenInk(colors.orreryNebulaB),
    grid: tokenInk(colors.orreryGrid),
    starlight: tokenInk(colors.orreryStarlight),
    shadow: tokenInk(colors.orreryShadow),
    textPrimary: tokenInk(colors.textPrimary),
    textSecondary: tokenInk(colors.textSecondary),
  };
}

/** A token colour with a replaced alpha, as the Float32Array Skia expects. */
export function withAlpha(color: Rgba, alpha: number): Float32Array {
  "worklet";
  return Float32Array.of(
    color[0],
    color[1],
    color[2],
    Math.max(0, Math.min(1, alpha)),
  );
}
