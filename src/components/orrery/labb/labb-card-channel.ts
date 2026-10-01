/**
 * ORRERY LAB B — R1 focus-card occlusion channel (flag `focusCardOcclusion`).
 *
 * The focus card is an RN overlay (ADR-149 glass, 0.91 tint, no blur on
 * Android, D-61). Bright, high-frequency canvas content under it — initials
 * glyphs, photo faces, label plates — bled through at ~9 % and read as a ghost
 * word next to the card's own text (evidence/08-wp2.2-focus/07, "Eli Novak
 * CO"). The fix keeps the glass exactly as ADR-149 decided (tint and opacity
 * untouched; the sky and the rings still show through) and instead makes the
 * card OCCLUDE the world detail under it: the bodies / labels pictures dim or
 * drop what lies under the card's rect, like objects behind a pane.
 *
 * The card's rect is computed on the UI thread by `OrreryFocusContext`'s
 * animated style (the same `focusCardPlacement`), which writes it here; the
 * lab pictures read it. One module-level mutable, created lazily at runtime
 * (never at import: unit tests mock Reanimated without `makeMutable`).
 *
 * Value: [x, y, width, height, on] in screen dp; on = 0 → no card.
 */

import type { SharedValue } from "react-native-reanimated";
import * as Reanimated from "react-native-reanimated";

export const NO_CARD: number[] = [0, 0, 0, 0, 0];

let channel: SharedValue<number[]> | null | undefined;

/** The shared card rect, or null where Reanimated has no `makeMutable`. */
export function labCardChannel(): SharedValue<number[]> | null {
  if (channel !== undefined) return channel;
  try {
    const make = (
      Reanimated as unknown as {
        makeMutable?: <T>(v: T) => SharedValue<T>;
      }
    ).makeMutable;
    channel = typeof make === "function" ? make<number[]>(NO_CARD) : null;
  } catch {
    channel = null;
  }
  return channel;
}

/** Write a card rect only when it changed (no churn for the readers). */
export function writeCardRect(
  target: SharedValue<number[]> | null,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  "worklet";
  if (!target) return;
  const c = target.value;
  if (c[4] === 1 && c[0] === x && c[1] === y && c[2] === w && c[3] === h)
    return;
  target.value = [x, y, w, h, 1];
}

/** True when a screen-space disc / rect touches the card (padded). */
export function underCard(
  card: readonly number[] | null,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  pad: number,
): boolean {
  "worklet";
  if (!card || card[4] !== 1) return false;
  return (
    x1 >= card[0] - pad &&
    x0 <= card[0] + card[2] + pad &&
    y1 >= card[1] - pad &&
    y0 <= card[1] + card[3] + pad
  );
}
