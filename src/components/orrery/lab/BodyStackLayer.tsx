/**
 * ORRERY LAB A (pass 2) — stack pips over co-angular bodies (HUD layer,
 * drawn above bodies). One pip per body hidden behind the front body, in the
 * hidden body's status hue on a background keyline; capped at
 * STACK_PIP_MAX (the last pip turns into a neutral "more" ring). Hidden while
 * a System switch runs (stacks form and dissolve every frame then).
 * Presentation only: no position, hit or label change.
 */
import { createPicture, Picture, Skia } from "@shopify/react-native-skia";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import { type AnimatedFrame, bodyKey } from "@/logic/orrery-frame";
import { findStacks } from "./body-stack";
import {
  STACK_PIP_ANGLE,
  STACK_PIP_MAX,
  STACK_PIP_R,
  STACK_PIP_STEP,
} from "./deep-field-config";
import { type DeepFieldInk, type Rgba, withAlpha } from "./deep-field-ink";
import type { BodyLightMap, SwitchFx } from "./deep-field-math";

export function BodyStackLayer({
  frame,
  light,
  switchFx,
  colors,
  ink,
}: {
  frame: SharedValue<AnimatedFrame>;
  light: SharedValue<BodyLightMap>;
  switchFx: SharedValue<SwitchFx>;
  /** key → status ink (the ring colour). */
  colors: Readonly<Record<string, Rgba>>;
  ink: DeepFieldInk;
}) {
  const picture = useDerivedValue(() => {
    const current = frame.value;
    const fx = switchFx.value;
    const lights = light.value;
    return createPicture(
      (canvas) => {
        if (fx.active) return;
        const stacks = findStacks(current, lights);
        if (!stacks.length) return;
        const fill = Skia.Paint();
        fill.setAntiAlias(true);
        const key = Skia.Paint();
        key.setAntiAlias(true);
        key.setColor(withAlpha(ink.background, 0.95));
        const more = Skia.Paint();
        more.setAntiAlias(true);
        more.setStyle(1);
        more.setStrokeWidth(1.2);
        more.setColor(withAlpha(ink.textSecondary, 1));
        for (let s = 0; s < stacks.length; s++) {
          const st = stacks[s];
          const front = current.bodies[st.front];
          // Pass 3: only stacks whose front body is mounted (ring inks are
          // built from the same resource commit as the body components).
          if (!colors[bodyKey(front)]) continue;
          const shown = Math.min(st.hidden.length, STACK_PIP_MAX);
          for (let k = 0; k < shown; k++) {
            const a = STACK_PIP_ANGLE - k * STACK_PIP_STEP;
            const px = front.x + Math.cos(a) * (st.radius + STACK_PIP_R * 0.35);
            const py = front.y + Math.sin(a) * (st.radius + STACK_PIP_R * 0.35);
            canvas.drawCircle(px, py, STACK_PIP_R + 1.3, key);
            const overflow =
              k === STACK_PIP_MAX - 1 && st.hidden.length > STACK_PIP_MAX;
            if (overflow) {
              canvas.drawCircle(px, py, STACK_PIP_R - 0.6, more);
              continue;
            }
            const hidden = current.bodies[st.hidden[k]];
            const c = colors[bodyKey(hidden)] ?? ink.textSecondary;
            fill.setColor(withAlpha(c, 1));
            canvas.drawCircle(px, py, STACK_PIP_R, fill);
          }
        }
      },
      {
        width: current.viewport.width,
        height: current.viewport.height,
      },
    );
  });
  return <Picture picture={picture} />;
}
