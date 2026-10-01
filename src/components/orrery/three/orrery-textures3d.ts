/**
 * ORRERY LAB C — CPU-side texture rasterisation for the 3D Orrery.
 *
 * Skia stays the text/photo engine (fonts, theme tokens, Unicode shaping,
 * `loadOrreryImage` decode); the GPU only receives RGBA bytes:
 *   - body atlas: one Skia raster surface, TILE px per body (photo cover-fit or
 *     swatch + initials), read back with `readPixels` into one DataTexture;
 *   - labels: one small raster per allocated label (backplate + Paragraph);
 *   - masks: procedural radial glow / annulus alpha (plain JS bytes).
 * Nothing here runs per frame.
 */
import {
  AlphaType,
  ColorType,
  type SkImage,
  Skia,
  type SkSurface,
  type SkTypefaceFontProvider,
  TextAlign,
  TileMode,
} from "@shopify/react-native-skia";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import type { PreparedOrreryText } from "../OrreryLabel";

/** Body atlas tile edge in px (tunable: sharpness vs memory). */
export const ATLAS_TILE = 160;
/** Tiles per atlas row / column → capacity ATLAS_COLS² bodies. */
export const ATLAS_COLS = 16;
export const ATLAS_SIZE = ATLAS_TILE * ATLAS_COLS;
export const ATLAS_CAPACITY = ATLAS_COLS * ATLAS_COLS;

export interface RgbaImage {
  data: Uint8Array;
  width: number;
  height: number;
}

function readSurfacePixels(surface: SkSurface, width: number, height: number) {
  surface.flush();
  const image = surface.makeImageSnapshot();
  const data = image.readPixels(0, 0, {
    width,
    height,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  image.dispose();
  if (!(data instanceof Uint8Array)) return null;
  return data;
}

/** A Skia raster surface that holds the whole body atlas. */
export class BodyAtlas {
  private surface: SkSurface | null;
  /** The persistent RGBA buffer the GPU texture wraps (never reallocated). */
  readonly pixels = new Uint8Array(ATLAS_SIZE * ATLAS_SIZE * 4);
  private dirty = new Set<number>();
  constructor() {
    this.surface = Skia.Surface.Make(ATLAS_SIZE, ATLAS_SIZE);
    this.surface?.getCanvas().clear(Float32Array.of(0, 0, 0, 0));
  }

  /**
   * Copy only the dirty tiles from the Skia surface into `pixels`. Reading the
   * whole 2560² atlas per photo batch allocated ~26 MB per upload and the
   * native heap ballooned until Hermes crashed on the 3rd remount (M1 notes).
   */
  flush(): boolean {
    if (!this.surface || this.dirty.size === 0) return false;
    this.surface.flush();
    const image = this.surface.makeImageSnapshot();
    const rowBytes = ATLAS_SIZE * 4;
    const tileRow = ATLAS_TILE * 4;
    for (const slot of this.dirty) {
      const { x, y } = tileOrigin(slot);
      const tile = image.readPixels(x, y, {
        width: ATLAS_TILE,
        height: ATLAS_TILE,
        colorType: ColorType.RGBA_8888,
        alphaType: AlphaType.Unpremul,
      });
      if (!(tile instanceof Uint8Array)) continue;
      for (let r = 0; r < ATLAS_TILE; r++)
        this.pixels.set(
          tile.subarray(r * tileRow, (r + 1) * tileRow),
          (y + r) * rowBytes + x * 4,
        );
    }
    image.dispose();
    this.dirty.clear();
    return true;
  }

  get ok() {
    return this.surface !== null;
  }

  /** Swatch disc + initials (same look as the Skia OrbitBody fallback). */
  drawInitials(
    slot: number,
    swatch: string,
    swatchText: string,
    initials: string,
    fontProvider: SkTypefaceFontProvider | null,
    /** Sun occupant medallion: shaded plate + ink token; person glyph if no initials. */
    plate?: { ink: string } | null,
  ) {
    const canvas = this.surface?.getCanvas();
    if (!canvas) return;
    const { x, y } = tileOrigin(slot);
    this.dirty.add(slot);
    canvas.save();
    canvas.clipRect(Skia.XYWHRect(x, y, ATLAS_TILE, ATLAS_TILE), 1, true);
    canvas.clear(Float32Array.of(0, 0, 0, 0));
    const paint = Skia.Paint();
    paint.setColor(Skia.Color(swatch));
    paint.setAntiAlias(true);
    canvas.drawCircle(
      x + ATLAS_TILE / 2,
      y + ATLAS_TILE / 2,
      ATLAS_TILE / 2,
      paint,
    );
    const cx = x + ATLAS_TILE / 2;
    const cy = y + ATLAS_TILE / 2;
    const R = ATLAS_TILE / 2;
    if (plate) {
      // Shaded plate: darkened rim (neutral alpha ramp over the swatch token)
      // + a soft top-left highlight, so the medallion reads as a convex disc.
      const shade = Skia.Paint();
      shade.setAntiAlias(true);
      shade.setShader(
        Skia.Shader.MakeRadialGradient(
          { x: cx, y: cy },
          R,
          [Float32Array.of(0, 0, 0, 0), Float32Array.of(0, 0, 0, 0.55)],
          [0.45, 1],
          TileMode.Clamp,
        ),
      );
      canvas.drawCircle(cx, cy, R, shade);
      const hi = Skia.Paint();
      hi.setAntiAlias(true);
      hi.setShader(
        Skia.Shader.MakeRadialGradient(
          { x: cx - R * 0.35, y: cy - R * 0.4 },
          R * 0.75,
          [Float32Array.of(1, 1, 1, 0.22), Float32Array.of(1, 1, 1, 0)],
          [0, 1],
          TileMode.Clamp,
        ),
      );
      canvas.drawCircle(cx, cy, R, hi);
    }
    const ink = plate?.ink ?? swatchText;
    if (plate && !initials) {
      // Person glyph: head + shoulders in the ink token.
      const glyph = Skia.Paint();
      glyph.setAntiAlias(true);
      glyph.setColor(Skia.Color(ink));
      canvas.drawCircle(cx, cy - R * 0.2, R * 0.24, glyph);
      const body = Skia.Path.Make();
      body.addArc(
        Skia.XYWHRect(cx - R * 0.46, cy + R * 0.12, R * 0.92, R * 0.8),
        180,
        180,
      );
      body.close();
      canvas.save();
      canvas.clipPath(
        (() => {
          const clip = Skia.Path.Make();
          clip.addCircle(cx, cy, R * 0.86);
          return clip;
        })(),
        1,
        true,
      );
      canvas.drawPath(body, glyph);
      canvas.restore();
    }
    if (fontProvider && initials) {
      const paragraph = Skia.ParagraphBuilder.Make(
        { textAlign: TextAlign.Center, maxLines: 1, ellipsis: "…" },
        fontProvider,
      )
        .pushStyle({
          color: Skia.Color(ink),
          fontFamilies: ["Inter"],
          fontStyle: { weight: 600 },
          fontSize: ATLAS_TILE * 0.4,
        })
        .addText(initials)
        .pop()
        .build();
      paragraph.layout(ATLAS_TILE);
      paragraph.paint(canvas, x, y + (ATLAS_TILE - paragraph.getHeight()) / 2);
      paragraph.dispose?.();
    }
    canvas.restore();
  }

  /** Cover-fit photo into the tile (circle mask happens in the shader). */
  drawPhoto(slot: number, image: SkImage) {
    const canvas = this.surface?.getCanvas();
    if (!canvas) return;
    const { x, y } = tileOrigin(slot);
    this.dirty.add(slot);
    const w = image.width();
    const h = image.height();
    const side = Math.min(w, h);
    const src = Skia.XYWHRect((w - side) / 2, (h - side) / 2, side, side);
    const dst = Skia.XYWHRect(x, y, ATLAS_TILE, ATLAS_TILE);
    canvas.save();
    canvas.clipRect(dst, 1, true);
    canvas.clear(Float32Array.of(0, 0, 0, 0));
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    canvas.drawImageRect(image, src, dst, paint, true);
    canvas.restore();
  }

  dispose() {
    this.surface?.dispose?.();
    this.surface = null;
  }
}

export function tileOrigin(slot: number) {
  return {
    x: (slot % ATLAS_COLS) * ATLAS_TILE,
    y: Math.floor(slot / ATLAS_COLS) * ATLAS_TILE,
  };
}

/** One label (backplate + native Paragraph) at device pixel density. */
export function rasterizeLabel(
  text: PreparedOrreryText,
  backplate: string,
  dpr: number,
): RgbaImage | null {
  const width = Math.max(1, Math.ceil(text.width * dpr));
  const height = Math.max(1, Math.ceil(text.height * dpr));
  const surface = Skia.Surface.Make(width, height);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  canvas.clear(Float32Array.of(0, 0, 0, 0));
  canvas.scale(dpr, dpr);
  const paint = Skia.Paint();
  paint.setColor(Skia.Color(backplate));
  paint.setAntiAlias(true);
  canvas.drawRRect(
    Skia.RRectXY(
      Skia.XYWHRect(0, 0, text.width, text.height),
      RADII.sm,
      RADII.sm,
    ),
    paint,
  );
  text.paragraph.paint(canvas, SPACING.sm, SPACING.xs);
  const data = readSurfacePixels(surface, width, height);
  surface.dispose?.();
  return data ? { data, width, height } : null;
}

/** White radial falloff mask (alpha only matters; tinted by the material). */
export function radialGlow(size: number, hardness = 0): RgbaImage {
  const data = new Uint8Array(size * size * 4);
  const half = size / 2;
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const d = Math.hypot(i + 0.5 - half, j + 0.5 - half) / half;
      const t = Math.max(0, 1 - d);
      const a = hardness > 0 ? Math.min(1, t * (1 + hardness * 4)) : t * t;
      const o = (j * size + i) * 4;
      data[o] = 255;
      data[o + 1] = 255;
      data[o + 2] = 255;
      data[o + 3] = Math.round(a * 255);
    }
  return { data, width: size, height: size };
}

/** White annulus mask; `inner` / `outer` as fractions of the half-size. */
export function annulus(size: number, inner: number, outer: number): RgbaImage {
  const data = new Uint8Array(size * size * 4);
  const half = size / 2;
  const aa = 1.5 / half;
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const d = Math.hypot(i + 0.5 - half, j + 0.5 - half) / half;
      const a = Math.max(
        0,
        Math.min(1, (d - inner) / aa + 0.5, (outer - d) / aa + 0.5),
      );
      const o = (j * size + i) * 4;
      data[o] = 255;
      data[o + 1] = 255;
      data[o + 2] = 255;
      data[o + 3] = Math.round(a * 255);
    }
  return { data, width: size, height: size };
}

/** Theme token (#rrggbb / #rrggbbaa) → [r,g,b] 0..1 in sRGB. */
export function tokenChannels(token: string): [number, number, number] {
  const c = Skia.Color(token);
  return [c[0], c[1], c[2]];
}
