/**
 * Pure WCAG contrast module (THEME-11).
 *
 * A dependency-free, react-native-FREE implementation of the WCAG 2.x
 * relative-luminance + contrast-ratio definitions, so the per-combo AA gate
 * (accents.test.ts) runs entirely in the node Vitest env. It mirrors the
 * pure-sibling idiom of `contact-card-ring.ts` / `avatar-initials.ts`: the only
 * inputs are `#RRGGBB` hex strings and the only outputs are numbers, so nothing
 * here loads a React Native surface.
 *
 * This file lives under `src/theme/**`, so its reference hex literals (used only
 * in the tests that import it) are exempt from `check:colors`.
 *
 * The AA thresholds (`AA_NORMAL` 4.5, `AA_LARGE` 3.0) are the WCAG-AA-equivalent
 * minimums. They are NEVER weakened to make a token pass — lowering either to
 * green a failing pair is a prohibited reversal (CLAUDE.md / plan prohibitions).
 */

/** WCAG-AA normal-text minimum contrast ratio. Immutable — never lower this. */
export const AA_NORMAL = 4.5;
/** WCAG-AA large-text (>=18pt / 14pt-bold) minimum. Immutable — never lower. */
export const AA_LARGE = 3.0;

/** A strict 6-digit `#RRGGBB` hex — the only shape the gate accepts. */
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Linearize one 0–255 sRGB channel per the WCAG relative-luminance definition.
 * Below the 0.03928 knee the transfer is linear; above it, the gamma curve.
 */
function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/**
 * WCAG relative luminance of a `#RRGGBB` hex, in [0, 1].
 *
 * Throws on a malformed/empty input rather than silently returning a passing
 * ratio — an unparseable colour is a bug in the palette data, not a 0 that could
 * make a pair look like it passes.
 */
export function relativeLuminance(hex: string): number {
  if (typeof hex !== "string" || !HEX_RE.test(hex)) {
    throw new Error(
      `relativeLuminance: expected a #RRGGBB hex string, got ${String(hex)}`,
    );
  }
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

/**
 * WCAG contrast ratio between two `#RRGGBB` hexes, in [1, 21].
 *
 * Symmetric: the LARGER luminance is always the numerator, so `(a, b)` and
 * `(b, a)` return the identical ratio and pass/fail identically regardless of
 * which argument is nominally foreground. Identical colours (and colours that
 * merge into their background, ratio approaching 1.0) return ~1.0 — which is
 * BELOW every AA threshold, so a token that vanishes into its background is
 * rejected, never rounded up to passing.
 */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** True when `fg`/`bg` meet or exceed the given AA threshold (default normal). */
export function meetsAA(fg: string, bg: string, threshold = AA_NORMAL): boolean {
  return contrastRatio(fg, bg) >= threshold;
}
