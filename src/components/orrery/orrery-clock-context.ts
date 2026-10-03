/**
 * OrreryClockContext (ORR-03) — the ambient render-loop clock, provided by
 * `OrreryV2Canvas` (38.7-06) and consumed by its legacy Skia descendants
 * (`SunBody`, until Plan 07 moves the sun into a picture layer).
 *
 * M5 (the whole reason this exists): `useClock()` MUST be called in exactly ONE
 * place — inside `OrreryV2Canvas`, the conditionally-mounted `<Canvas>` subtree — so
 * that UNMOUNTING that subtree on blur/background truly stops the Skia frame
 * callback (Pitfall 4 — the clock has no pause arg; gating derived values does not
 * stop the loop). `SunBody` still owns its own pulse `useDerivedValue`, but it must
 * NOT call `useClock` itself; instead it reads the single shared clock through this
 * context. Provider and consumer both live INSIDE the same `<Canvas>`, so the value
 * propagates through Skia's reconciler (no Canvas boundary is crossed).
 *
 * The value is `null` when a consumer renders outside an `OrreryV2Canvas` (e.g. a
 * unit harness) — consumers fall back to a static, unpulsed render.
 */
import { createContext, useContext } from "react";
import type { SharedValue } from "react-native-reanimated";

/** The ambient clock shared value (ms), or null outside an `OrreryV2Canvas`. */
export const OrreryClockContext = createContext<SharedValue<number> | null>(
  null,
);

/** Read the ambient clock provided by the enclosing `OrreryV2Canvas` (or null). */
export function useOrreryClock(): SharedValue<number> | null {
  return useContext(OrreryClockContext);
}
