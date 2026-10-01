/**
 * ORRERY LAB A — hypothesis items 2 + 3 (+ the shadows of 4 and the streaks /
 * ring draw-on of 7): the world plane as ONE per-frame SkPicture.
 *
 * The picture re-records only when `frame` or `switchFx` changes (camera
 * motion / switch), never on ambient clock ticks — idle frames just replay it
 * (pass 2: replay is cheap — screen-space convex polygons + one analytic ring
 * shader; see world-plane.ts header for the device findings).
 * One recorded draw list replaces N `ProjectedOrbitRing` nodes, N per-ring
 * mappers and N per-frame SkPath rebuilds from `ringPath`.
 */
import { createPicture, Picture } from "@shopify/react-native-skia";
import { useMemo } from "react";
import {
  type SharedValue,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import type { AnimatedFrame } from "@/logic/orrery-frame";
import type { DeepFieldInk } from "./deep-field-ink";
import type { FocusState, SwitchFx } from "./deep-field-math";
import { labEffect } from "./deep-field-shaders";
import { drawWorldPlane, type PlaneRing, type TrailState } from "./world-plane";

export function WorldPlaneLayer({
  frame,
  switchFx,
  rings,
  ink,
  extent,
  focus,
  focusMix,
}: {
  frame: SharedValue<AnimatedFrame>;
  switchFx: SharedValue<SwitchFx>;
  rings: readonly PlaneRing[];
  ink: DeepFieldInk;
  extent: number;
  /** Pass 3: UI-thread focus state + 0..1 emphasis mix. */
  focus?: SharedValue<FocusState>;
  focusMix?: SharedValue<number>;
}) {
  // Pass 2: this layer's own motion-blur history (UI-thread scratch, mutated
  // in place — never reassigned, so it never re-triggers this mapper).
  const trails = useSharedValue<TrailState>({ pts: {} });
  const ringEffect = useMemo(() => labEffect("ring"), []);
  const picture = useDerivedValue(() => {
    const current = frame.value;
    const fx = switchFx.value;
    const history = trails.value;
    const now = Date.now();
    const mix = focusMix?.value ?? 0;
    const focusKeys = focus?.value.keys;
    return createPicture(
      (canvas) => {
        drawWorldPlane(canvas, {
          frame: current,
          rings,
          fx,
          ink,
          extent,
          trails: history,
          now,
          ringEffect,
          focus: focusKeys && mix > 0 ? { keys: focusKeys, mix } : undefined,
        });
      },
      {
        width: current.viewport.width,
        height: current.viewport.height,
      },
    );
  });
  return <Picture picture={picture} />;
}
