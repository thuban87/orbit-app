/**
 * ORRERY LAB A — deep-field sky resources, recorded ONCE per size/palette
 * (moved from the former DeepFieldBackdrop component in the arch perf pass;
 * drawn per frame by `drawSky` in scene-draw.ts).
 */
import {
  createPicture,
  Skia,
  type SkPicture,
} from "@shopify/react-native-skia";
import { STARS_HERO_GLOW, STARS_HERO_SPIKE } from "./deep-field-config";
import { type DeepFieldInk, type Rgba, withAlpha } from "./deep-field-ink";

/** Margin (dp) beyond the half-diagonal so pans/tilt never expose an edge. */
export const SKY_MARGIN = 140;
/** Deterministic 0..1 hash (no PRNG dependency, stable across renders). */
function seeded(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export interface StarSpec {
  x: number;
  y: number;
  r: number;
  color: Rgba;
  alpha: number;
}

export function scatter(
  count: number,
  radius: number,
  band: readonly [number, number],
  palette: readonly Rgba[],
  seed: number,
): StarSpec[] {
  const out: StarSpec[] = [];
  for (let i = 0; i < count; i++) {
    // Uniform over the disc (sqrt) so rotation never reveals an empty corner.
    const a = seeded(seed + i * 3 + 1) * Math.PI * 2;
    const d = Math.sqrt(seeded(seed + i * 3 + 2)) * radius;
    const size = seeded(seed + i * 3 + 3);
    out.push({
      x: Math.cos(a) * d,
      y: Math.sin(a) * d,
      // Power curve: many faint pinpricks, few bright stars.
      r: band[0] + (band[1] - band[0]) * size * size,
      color: palette[i % palette.length],
      alpha: 0.35 + 0.65 * seeded(seed + i * 7 + 5),
    });
  }
  return out;
}

export function recordStars(
  stars: readonly StarSpec[],
  heroes: number,
  ink: DeepFieldInk,
  radius: number,
): SkPicture {
  return createPicture(
    (canvas) => {
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      const glow = Skia.Paint();
      glow.setAntiAlias(true);
      const spike = Skia.Paint();
      spike.setAntiAlias(true);
      spike.setStyle(1);
      spike.setStrokeWidth(0.6);
      stars.forEach((s, i) => {
        const alpha = ink.chart ? 0.3 + 0.35 * s.alpha : s.alpha;
        if (i < heroes && !ink.chart) {
          glow.setShader(
            Skia.Shader.MakeRadialGradient(
              { x: s.x, y: s.y },
              s.r * STARS_HERO_GLOW,
              [withAlpha(s.color, 0.55), withAlpha(s.color, 0)],
              null,
              0,
            ),
          );
          canvas.drawCircle(s.x, s.y, s.r * STARS_HERO_GLOW, glow);
          spike.setShader(
            Skia.Shader.MakeRadialGradient(
              { x: s.x, y: s.y },
              STARS_HERO_SPIKE,
              [withAlpha(s.color, 0.8), withAlpha(s.color, 0)],
              null,
              0,
            ),
          );
          canvas.drawLine(
            s.x - STARS_HERO_SPIKE,
            s.y,
            s.x + STARS_HERO_SPIKE,
            s.y,
            spike,
          );
          canvas.drawLine(
            s.x,
            s.y - STARS_HERO_SPIKE,
            s.x,
            s.y + STARS_HERO_SPIKE,
            spike,
          );
        }
        paint.setColor(withAlpha(s.color, alpha));
        canvas.drawCircle(s.x, s.y, s.r, paint);
      });
    },
    Skia.XYWHRect(-radius, -radius, radius * 2, radius * 2),
  );
}
