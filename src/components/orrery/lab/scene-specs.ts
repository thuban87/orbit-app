/**
 * ORRERY LAB A — ARCH PERF PASS: JS-thread builders of the scene renderer's
 * immutable draw resources (lab/scene-draw.ts). Runs only when the inputs
 * change (a publication, a photo resolving, a theme/font change) — never per
 * frame. Every colour is a ThemePalette token resolved to RGBA here.
 *
 * Paragraphs are shaped here once and only painted on the UI thread (as the
 * declarative `<Paragraph>` did); SkImages are owned by `useOrreryPhoto`
 * under the custody rules of `use-lab-photos.tsx`.
 */
import {
  type SkImage,
  Skia,
  type SkParagraph,
  type SkTypefaceFontProvider,
  TextAlign,
} from "@shopify/react-native-skia";
import { swatchIndex } from "@/components/avatar-initials";
import type { OrrerySatellite } from "@/db/orrery-satellites-read";
import { bodyKey } from "@/logic/orrery-frame";
import { orreryInitials } from "@/logic/orrery-label-logic";
import { orreryRingStyle } from "@/logic/orrery-ring-logic";
import { resolveSunOccupant } from "@/logic/sun-occupant-logic";
import type { ThemePalette } from "@/theme/theme-types";
import type { OrreryBodyResource } from "../use-orrery-switch-runtime";
import { type DeepFieldInk, tokenInk } from "./deep-field-ink";
import type { LabBodySpec } from "./scene-draw";

/** OrbitBody's status-outline width (inner disc = r − this / 2). */
const OUTLINE_WIDTH = 3;

export interface LabPhoto {
  image: SkImage | null;
  /** JS wall-clock ms when this image was published. */
  at: number;
}

/** Reused paragraph shapes keyed by their full style (per font provider). */
export type ParagraphCache = Map<string, SkParagraph | null>;

function initialsParagraph(
  cache: ParagraphCache,
  fontProvider: SkTypefaceFontProvider | null,
  text: string,
  color: string,
  fontSize: number,
  width: number,
): SkParagraph | null {
  if (!fontProvider || text.length === 0) return null;
  const key = `${text}\u0000${color}\u0000${fontSize}\u0000${width}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const paragraph = Skia.ParagraphBuilder.Make(
    { textAlign: TextAlign.Center, maxLines: 1, ellipsis: "…" },
    fontProvider,
  )
    .pushStyle({
      color: Skia.Color(color),
      fontFamilies: ["Inter"],
      fontSize,
      // Lab A: semibold initials (contact and sun).
      fontStyle: { weight: 600 },
    })
    .addText(text)
    .pop()
    .build();
  paragraph.layout(width);
  cache.set(key, paragraph);
  return paragraph;
}

function imageSize(image: SkImage | null): [number, number] {
  if (!image) return [0, 0];
  try {
    return [image.width(), image.height()];
  } catch {
    return [0, 0];
  }
}

/** The photo path each resource body draws (null → initials only). */
export function resourcePhotoPath(
  resource: OrreryBodyResource,
  colors: ThemePalette,
): string | null {
  const { body, scene } = resource;
  if (body.kind === "sun")
    return resolveSunOccupant({
      ...scene.sun,
      starPalette: colors.starPalette,
      colors,
    }).photo;
  return scene.contacts.find((c) => c.id === body.id)?.photo ?? null;
}

/**
 * One spec per resource body (contacts + sun, resource order) then one per
 * drawn satellite row — the same set, order and per-body values the
 * declarative ProjectedBody/OrbitBody/SunBody/SatelliteBody resolved.
 */
export function buildBodySpecs(input: {
  resources: readonly OrreryBodyResource[];
  satellites: readonly OrrerySatellite[];
  colors: ThemePalette;
  ink: DeepFieldInk;
  fontProvider: SkTypefaceFontProvider | null;
  photos: Readonly<Record<string, LabPhoto>>;
  /** key → first-seen JS ms (mutated: new keys are stamped `now`). */
  enterAt: Map<string, number>;
  paragraphs: ParagraphCache;
  now: number;
}): LabBodySpec[] {
  const { colors, ink, fontProvider, photos, enterAt, paragraphs, now } = input;
  const out: LabBodySpec[] = [];
  for (const resource of input.resources) {
    const { body, scene, key } = resource;
    let entered = enterAt.get(key);
    if (entered === undefined) {
      entered = now;
      enterAt.set(key, now);
    }
    const photo = photos[key] ?? { image: null, at: 0 };
    const [imageWidth, imageHeight] = imageSize(photo.image);
    if (body.kind === "sun") {
      const resolved = resolveSunOccupant({
        ...scene.sun,
        starPalette: colors.starPalette,
        colors,
      });
      const name =
        resolved.kind === "self"
          ? scene.sun.selfName
          : scene.sun.sunContactName;
      const fontSize = body.radius;
      out.push({
        key,
        kind: "sun",
        order: out.length,
        radius: body.radius,
        fill: tokenInk(resolved.glowColor),
        swatch: tokenInk(
          colors.avatarSwatches[
            swatchIndex(name ?? "", colors.avatarSwatches.length)
          ],
        ),
        initials: initialsParagraph(
          paragraphs,
          fontProvider,
          orreryInitials(name ?? ""),
          ink.chart ? colors.textPrimary : colors.background,
          fontSize,
          body.radius * 2,
        ),
        fontSize,
        image: photo.image,
        imageWidth,
        imageHeight,
        photoAt: photo.at,
        // SunBody had no mount fade.
        enterAt: 0,
      });
      continue;
    }
    const contact = scene.contacts.find((c) => c.id === body.id);
    const name = contact?.name ?? "";
    const innerR = Math.max(1, body.radius - OUTLINE_WIDTH / 2);
    out.push({
      key,
      kind: "contact",
      order: out.length,
      radius: body.radius,
      fill: tokenInk(orreryRingStyle(contact?.status ?? null, colors).bodyFill),
      swatch: tokenInk(
        colors.avatarSwatches[swatchIndex(name, colors.avatarSwatches.length)],
      ),
      initials: initialsParagraph(
        paragraphs,
        fontProvider,
        orreryInitials(name),
        colors.avatarSwatchText,
        body.radius,
        innerR * 2,
      ),
      fontSize: body.radius,
      image: photo.image,
      imageWidth,
      imageHeight,
      photoAt: photo.at,
      enterAt: entered,
    });
  }
  const moonInk = tokenInk(colors.textSecondary);
  for (const row of input.satellites) {
    out.push({
      key: bodyKey({
        kind: "satellite",
        id: -1,
        satelliteTarget: {
          kind: "satellite",
          uid: row.uid,
          parentId: row.parentId,
          parentUid: row.parentUid,
        },
      }),
      kind: "satellite",
      order: out.length,
      radius: 1,
      fill: moonInk,
      swatch: moonInk,
      initials: null,
      fontSize: 0,
      image: null,
      imageWidth: 0,
      imageHeight: 0,
      photoAt: 0,
      // SatelliteBody had no mount fade.
      enterAt: 0,
    });
  }
  return out;
}
