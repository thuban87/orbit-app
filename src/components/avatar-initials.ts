/**
 * Pure initials + deterministic swatch-index logic for `Avatar.tsx` (PHOTO-04).
 *
 * Extracted from the RN component (the `-logic`/pure-`.ts` + node `.test.ts`
 * convention — `Avatar.tsx` imports react-native/expo-image and cannot load in
 * node Vitest). This module is PURE: it imports NO theme and NO react-native,
 * and returns only strings/numbers. The component resolves the returned index to
 * a themed swatch token.
 *
 * The initials split and the rolling hash port VERBATIM from the legacy plugin
 * (`~/projects/Orbit/src/components/ContactCard.tsx`), but the legacy free-hue
 * output (a raw HSL string keyed on `hash % 360`) is BARRED (CLAUDE.md /
 * check:colors): a raw hue never restyles with the theme. Instead the same name
 * hash is quantized onto the FINITE themed `avatarSwatches` array via
 * `swatchIndex`, so a person's colour is stable AND restyles with the active
 * theme like every other token.
 */

/**
 * First character of the first two words, uppercased, sliced to 2.
 *   "Ada Lovelace" → "AL"; "Grace" → "G"; "mary jane watson" → "MJ".
 * An empty or whitespace-only name yields "" — the signal for the component to
 * render a blank neutral swatch with NO glyph. Ported verbatim from the plugin's
 * `getInitials` (ContactCard.tsx): `undefined` first-chars (from empty split
 * segments) collapse to "" in `join("")`, so "" and "   " both return "".
 */
export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * The ported rolling hash: `hash = charCodeAt(i) + ((hash << 5) - hash)` over the
 * string, returned as `Math.abs(...)` so it is always a non-negative integer
 * suitable for a modulo index. Deterministic — the same input always hashes the
 * same value, across calls and sessions.
 */
export function hashName(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

/**
 * Quantize a name onto `[0, swatchCount)`: `hashName(name.trim()) % swatchCount`.
 * Trimming keeps edge whitespace from shifting the swatch. Because `hashName` is
 * non-negative, the result is always a valid array index. An empty/whitespace
 * name hashes to 0 → index 0 (the neutral swatch the component pairs with no
 * glyph). The same name + count always yields the same index.
 */
export function swatchIndex(name: string, swatchCount: number): number {
  return hashName(name.trim()) % swatchCount;
}
