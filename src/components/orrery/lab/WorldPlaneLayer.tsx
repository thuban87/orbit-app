/**
 * ORRERY LAB A — hypothesis items 2 + 3 (+ the shadows of 4 and the streaks /
 * ring draw-on of 7): the world plane as ONE per-frame SkPicture.
 *
 * The picture re-records only when `frame` or `switchFx` changes (camera
 * motion / switch), never on ambient clock ticks — idle frames just replay it.
 * One recorded draw list replaces N `ProjectedOrbitRing` nodes, N per-ring
 * mappers and N per-frame SkPath rebuilds from `ringPath`.
 */
import { createPicture, Picture } from "@shopify/react-native-skia";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import type { AnimatedFrame } from "@/logic/orrery-frame";
import type { DeepFieldInk } from "./deep-field-ink";
import type { SwitchFx } from "./deep-field-math";
import { drawWorldPlane, type PlaneRing } from "./world-plane";

export function WorldPlaneLayer({
  frame,
  switchFx,
  rings,
  ink,
  extent,
}: {
  frame: SharedValue<AnimatedFrame>;
  switchFx: SharedValue<SwitchFx>;
  rings: readonly PlaneRing[];
  ink: DeepFieldInk;
  extent: number;
}) {
  const picture = useDerivedValue(() => {
    const current = frame.value;
    const fx = switchFx.value;
    return createPicture(
      (canvas) => {
        drawWorldPlane(canvas, { frame: current, rings, fx, ink, extent });
      },
      {
        width: current.viewport.width,
        height: current.viewport.height,
      },
    );
  });
  return <Picture picture={picture} />;
}
