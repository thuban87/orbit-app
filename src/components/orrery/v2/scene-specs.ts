/**
 * 38.7-06 (D-43): JS-thread spec builders for the V2 picture tree.
 *
 * Builders run only when their inputs change (scene resources, theme), never
 * per frame; their output crosses to the UI thread through SharedValues and
 * the picture worklets read nothing else. Every colour is a `ThemePalette`
 * token resolved here to RGBA floats (0..1), so the draw modules and SkSL
 * uniforms never see a colour literal (check:colors).
 */
import { type SkImage, Skia } from "@shopify/react-native-skia";
import { swatchIndex } from "@/components/avatar-initials";
import type { OrrerySatellite } from "@/db/orrery-satellites-read";
import type { OrrerySatelliteTarget } from "@/logic/orrery-camera-logic";
import { bodyKey } from "@/logic/orrery-frame";
import { orreryRingStyle } from "@/logic/orrery-ring-logic";
import { resolveSunOccupant } from "@/logic/sun-occupant-logic";
import type { ThemePalette } from "@/theme/theme-types";
import type { OrreryGenerationLedger } from "../resources/orrery-generation-ledger";
import type {
  OrreryDrawnPhoto,
  OrreryPhotoRequest,
} from "../resources/orrery-photo-cache";
import type {
  OrreryInitialsSpec,
  OrreryLabelSpec,
  OrreryMeasuredLabel,
  OrreryTextVisibility,
  PreparedOrreryText,
} from "../resources/orrery-text-service";
import type { OrreryBodyResource } from "../use-orrery-switch-runtime";

/** Premultiplication-free RGBA floats, 0..1. */
export type OrreryInk = readonly [number, number, number, number];

const NO_INK: OrreryInk = [0, 0, 0, 0];

/** A theme token → RGBA floats (transparent if the runtime cannot parse it). */
export function tokenInk(token: string): OrreryInk {
  let value: ArrayLike<number> | undefined;
  try {
    value = Skia?.Color?.(token) as ArrayLike<number> | undefined;
  } catch {
    value = undefined;
  }
  if (!value || typeof value !== "object" || value.length !== 4) return NO_INK;
  return [value[0], value[1], value[2], value[3]];
}

/** Today's dashed orbit (a 6-on-6-off dash): one 12 dp period. */
export const RING_DASH_PERIOD_DP = 12;
/** Today's ring opacities by line treatment (faded / faint trace). */
const FADED_ALPHA = 0.7;
const FAINT_TRACE_ALPHA = 0.3;

/** One orbit ring's look, per body key: today's status style, as numbers. */
export interface RingSpec {
  ink: OrreryInk;
  /** Line width in screen dp (today's stroke width). */
  widthDp: number;
  /** Status alpha (multiplied by the body's transition opacity when drawn). */
  alpha: number;
  /** Dash period in screen dp; 0 = solid. */
  dashPeriodDp: number;
}
export type RingSpecs = Readonly<Record<string, RingSpec>>;
export const EMPTY_RING_SPECS: RingSpecs = Object.freeze({});

/**
 * Ring specs for every contact resource: `orreryRingStyle` (colour, width,
 * line treatment) with today's alphas — faded 0.7, faint trace 0.3, otherwise
 * the style's own opacity — and today's 6-on-6-off dash for dashed and
 * faint-trace rings.
 */
export function buildRingSpecs(
  resources: readonly OrreryBodyResource[],
  colors: ThemePalette,
): RingSpecs {
  const statusById = new Map<
    OrreryBodyResource["scene"],
    Map<number, OrreryBodyResource["scene"]["contacts"][number]["status"]>
  >();
  const statusOf = (resource: OrreryBodyResource) => {
    let index = statusById.get(resource.scene);
    if (!index) {
      index = new Map();
      // First row per id, as the legacy `find` returned.
      for (const row of resource.scene.contacts)
        if (!index.has(row.id)) index.set(row.id, row.status);
      statusById.set(resource.scene, index);
    }
    return index.get(resource.body.id) ?? null;
  };
  const specs: Record<string, RingSpec> = {};
  for (const resource of resources) {
    if (resource.body.kind !== "contact") continue;
    const style = orreryRingStyle(statusOf(resource), colors);
    specs[resource.key] = {
      ink: tokenInk(style.color),
      widthDp: style.width,
      alpha:
        style.strokeStyle === "faded"
          ? FADED_ALPHA
          : style.strokeStyle === "faintTrace"
            ? FAINT_TRACE_ALPHA
            : style.opacity,
      dashPeriodDp:
        style.strokeStyle === "dashed" || style.strokeStyle === "faintTrace"
          ? RING_DASH_PERIOD_DP
          : 0,
    };
  }
  return specs;
}

/** The canvas background (today's `<Fill color={colors.background}>`). */
export interface SkySpec {
  background: OrreryInk;
}
export function buildSkySpec(colors: ThemePalette): SkySpec {
  return { background: tokenInk(colors.background) };
}

/** The overlay's inks (accent for reorder/focus, Polaris star and halo). */
export interface OverlayInk {
  accent: OrreryInk;
  textPrimary: OrreryInk;
  /** Polaris halo: the first star-palette colour (textPrimary when empty). */
  polarisHalo: OrreryInk;
}
/**
 * One focused body's accent outline: today's contact / sun focus ring,
 * `gap` world units outside the body's world radius (both scale with it).
 */
export interface OverlayFocus {
  key: string;
  worldRadius: number;
  gap: number;
}
export interface OverlaySpec {
  ink: OverlayInk;
  /** The world extent Polaris sits beyond (`scene.extent`). */
  extent: number;
  focus: readonly OverlayFocus[];
}
/** Today's focus-ring gaps outside the disc (contact / sun). */
export const FOCUS_RING_GAP = { contact: 4, sun: 6 } as const;

export function buildOverlayInk(colors: ThemePalette): OverlayInk {
  return {
    accent: tokenInk(colors.accent),
    textPrimary: tokenInk(colors.textPrimary),
    polarisHalo: tokenInk(colors.starPalette[0] ?? colors.textPrimary),
  };
}

/** The focus outlines for the focused ids (contacts and the sun; not moons). */
export function buildFocusOutlines(
  resources: readonly OrreryBodyResource[],
  focusedIds: readonly number[],
): OverlayFocus[] {
  if (focusedIds.length === 0) return [];
  const focused = new Set(focusedIds);
  const out: OverlayFocus[] = [];
  for (const resource of resources) {
    const { body } = resource;
    if (body.kind === "satellite" || !focused.has(body.id)) continue;
    out.push({
      key: resource.key,
      worldRadius: body.radius,
      gap: body.kind === "sun" ? FOCUS_RING_GAP.sun : FOCUS_RING_GAP.contact,
    });
  }
  return out;
}

export const EMPTY_OVERLAY_SPEC: OverlaySpec = Object.freeze({
  ink: { accent: NO_INK, textPrimary: NO_INK, polarisHalo: NO_INK },
  extent: 1,
  focus: [],
});

// ── Ambient starfield (today's OrreryCanvas twinkle field, as a spec) ───────
/** How many ambient star dots to scatter (subtle — device-UAT tunable, 13-08). */
export const STAR_COUNT = 44;
/** Star dot radius range (dp). */
export const STAR_R_MIN = 0.6;
export const STAR_R_MAX = 1.8;

/** One placed star: screen position, radius, ink and its static opacity. */
export interface StarSpec {
  x: number;
  y: number;
  r: number;
  ink: OrreryInk;
  /** Static per-star opacity for a non-uniform field (× the twinkle). */
  base: number;
}
export interface StarFieldSpec {
  stars: readonly StarSpec[];
}
export const EMPTY_STAR_FIELD: StarFieldSpec = Object.freeze({ stars: [] });

/**
 * Deterministic 0..1 hash from an integer seed — a tiny LCG-ish mix so the
 * star field is stable across renders without a PRNG dependency (and without
 * `crypto`, which Hermes lacks).
 */
export function seeded(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Today's 44 seeded stars for the measured canvas: the same placement, radii,
 * per-star base opacity and colour cycle (`textSecondary`, `textPrimary`,
 * then the star palette) as the pre-38.7-06 OrreryCanvas.
 */
export function buildStarField(
  width: number,
  height: number,
  colors: ThemePalette,
): StarFieldSpec {
  const tones = [
    colors.textSecondary,
    colors.textPrimary,
    ...colors.starPalette,
  ];
  if (width <= 0 || height <= 0) return EMPTY_STAR_FIELD;
  const inks = tones.map(tokenInk);
  const stars: StarSpec[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: seeded(i + 1) * width,
      y: seeded(i + 101) * height,
      r: STAR_R_MIN + seeded(i + 201) * (STAR_R_MAX - STAR_R_MIN),
      ink: inks[i % inks.length],
      base: 0.4 + seeded(i + 301) * 0.6,
    });
  }
  return { stars };
}

// ── Bodies (38.7-07, D-43/D-53) ─────────────────────────────────────────────

/** Today's status-outline width around a contact disc (inner disc = r − this / 2). */
export const BODY_OUTLINE_WIDTH = 3;

/**
 * The picture layers that draw native objects: the body layers, the labels
 * layer and (38.7-08) the base layer when it draws a baked snapshot. Each acks
 * `(layerId, generation, mountEpoch)` separately (H3 ledger contract).
 */
export const ORRERY_LAYER = {
  base: "base",
  bodiesBehind: "bodiesBehind",
  sun: "sun",
  bodiesFront: "bodiesFront",
  labels: "labels",
} as const;
export type OrreryLayerId = (typeof ORRERY_LAYER)[keyof typeof ORRERY_LAYER];
export const ORRERY_BODY_LAYERS: readonly OrreryLayerId[] = [
  ORRERY_LAYER.bodiesBehind,
  ORRERY_LAYER.sun,
  ORRERY_LAYER.bodiesFront,
];

/**
 * The initials glyph metrics the text publisher keys on (the legacy contact
 * and sun body layout): font size ≈ the radius (cap height fits the disc; device-UAT
 * tunable, 13-08), quantised to 0.5 px so near-equal radii share one cached
 * Paragraph; the glyph is centred in the inner disc (contact) or the disc (sun).
 */
export function bodyInitialsLayout(
  kind: "contact" | "sun",
  radius: number,
): { fontSize: number; maxWidth: number } {
  return {
    fontSize: Math.round(radius * 2) / 2,
    maxWidth:
      kind === "sun"
        ? radius * 2
        : Math.max(1, radius - BODY_OUTLINE_WIDTH / 2) * 2,
  };
}

/**
 * One body's static look (no native objects): rebuilt on resource, theme or
 * focus change only, never per frame.
 */
export interface OrreryBodyLook {
  /** Body key (`bodyKey`): the frame body it draws at. */
  key: string;
  kind: "contact" | "sun" | "satellite";
  /** World radius: the frame's projected radius / this = the billboard scale. */
  worldRadius: number;
  /** Contact: status body fill (outline). Sun: occupant glow. Moon: its disc. */
  outlineInk: OrreryInk;
  /** The fallback swatch behind the initials (contact, sun). */
  swatchInk: OrreryInk;
  /** The photo key (relative path) the body shows, or null (initials only). */
  photoKey: string | null;
  /** Initials glyph font size (body-local px; `bodyInitialsLayout`). */
  initialsFontSize: number;
  /** Moon: the focused moon's accent ring ink; null otherwise. */
  focusInk: OrreryInk | null;
}

/** A body's spec: its look plus the native objects its picture draws. */
export interface OrreryBodySpec extends OrreryBodyLook {
  /** From OrreryTextService only (D-52); null → the plain swatch disc. */
  initials: PreparedOrreryText | null;
  /** From the shared photo cache only (D-53); null → swatch + initials. */
  photo: SkImage | null;
}

/** What the body layers (`bodiesBehind`, `sun`, `bodiesFront`) read. */
export interface OrreryBodySpecs {
  /** The shared spec generation (0 = nothing published yet). */
  generation: number;
  /** The ledger epoch this generation belongs to. */
  mountEpoch: number;
  /** Source order: resources (contacts and the sun), then moons. */
  bodies: readonly OrreryBodySpec[];
}
export const EMPTY_BODY_SPECS: OrreryBodySpecs = Object.freeze({
  generation: 0,
  mountEpoch: 0,
  bodies: Object.freeze([]) as readonly OrreryBodySpec[],
});

type SceneContact = OrreryBodyResource["scene"]["contacts"][number];
const contactsById = new WeakMap<
  OrreryBodyResource["scene"],
  ReadonlyMap<number, SceneContact>
>();
/** First row per id (what the legacy `find` returned), indexed once per scene. */
function contactOf(resource: OrreryBodyResource): SceneContact | undefined {
  let index = contactsById.get(resource.scene);
  if (!index) {
    const built = new Map<number, SceneContact>();
    for (const row of resource.scene.contacts)
      if (!built.has(row.id)) built.set(row.id, row);
    contactsById.set(resource.scene, built);
    index = built;
  }
  return index.get(resource.body.id);
}

/** The name a body's swatch and initials derive from, and its photo path. */
export function bodyIdentity(
  resource: OrreryBodyResource,
  colors: ThemePalette,
): { name: string; photo: string | null; glowColor: string | null } {
  const { body, scene } = resource;
  if (body.kind === "sun") {
    const resolved = resolveSunOccupant({
      ...scene.sun,
      starPalette: colors.starPalette,
      colors,
    });
    return {
      name:
        (resolved.kind === "self"
          ? scene.sun.selfName
          : scene.sun.sunContactName) ?? "",
      photo: resolved.photo,
      glowColor: resolved.glowColor,
    };
  }
  const contact = contactOf(resource);
  return {
    name: contact?.name ?? "",
    photo: contact?.photo ?? null,
    glowColor: null,
  };
}

/**
 * Today's body look per resource (the legacy contact and sun bodies): the status body fill
 * as the outline, `avatarSwatches[swatchIndex(name)]` behind the initials, the
 * sun's resolved glow. Every colour is a theme token resolved to RGBA here.
 */
export function buildBodyLooks(
  resources: readonly OrreryBodyResource[],
  colors: ThemePalette,
): OrreryBodyLook[] {
  const out: OrreryBodyLook[] = [];
  const swatchOf = (name: string) =>
    tokenInk(
      colors.avatarSwatches[swatchIndex(name, colors.avatarSwatches.length)],
    );
  for (const resource of resources) {
    const { body } = resource;
    if (body.kind === "satellite") continue;
    const identity = bodyIdentity(resource, colors);
    const kind = body.kind === "sun" ? "sun" : "contact";
    out.push({
      key: resource.key,
      kind,
      worldRadius: body.radius,
      outlineInk:
        kind === "sun"
          ? tokenInk(identity.glowColor ?? colors.border)
          : tokenInk(
              orreryRingStyle(contactOf(resource)?.status ?? null, colors)
                .bodyFill,
            ),
      swatchInk: swatchOf(identity.name),
      photoKey: identity.photo,
      initialsFontSize: bodyInitialsLayout(kind, body.radius).fontSize,
      focusInk: null,
    });
  }
  return out;
}

/**
 * D-53: the photo cache request for a set of body looks — one entry per photo
 * key, ranked focused first, then visible bodies largest first, then the rest
 * in source order. `visibility` null (not reported yet) treats every body as
 * visible. Bodies that share a photo share one entry (their best rank).
 */
export function buildPhotoRequests(
  looks: readonly OrreryBodyLook[],
  focusedKeys: ReadonlySet<string>,
  visibility: OrreryTextVisibility | null,
): OrreryPhotoRequest[] {
  const visible = visibility?.visible ? new Set(visibility.visible) : null;
  const radius = new Map<string, number>();
  for (const item of visibility?.eligible ?? [])
    radius.set(item.key, item.radius);
  const ranked = looks
    .map((look, order) => ({
      look,
      order,
      focused: focusedKeys.has(look.key),
      visible: !visible || visible.has(look.key),
      radius: radius.get(look.key) ?? 0,
    }))
    .filter((item) => item.look.photoKey !== null)
    .sort(
      (a, b) =>
        Number(b.focused) - Number(a.focused) ||
        Number(b.visible) - Number(a.visible) ||
        (a.visible && b.visible ? b.radius - a.radius : 0) ||
        a.order - b.order,
    );
  const out = new Map<string, OrreryPhotoRequest>();
  ranked.forEach((item, priority) => {
    const key = item.look.photoKey as string;
    if (out.has(key)) return;
    out.set(key, {
      key,
      relativePath: key,
      priority,
      focused: item.focused,
      visible: item.visible,
    });
  });
  return [...out.values()];
}

/**
 * Today's moons (the legacy satellite body): a unit disc in `textSecondary`,
 * and the focused moon's accent ring. One look per drawn satellite row, keyed
 * like the frame's moon bodies.
 */
export function buildSatelliteLooks(
  satellites: readonly OrrerySatellite[],
  colors: ThemePalette,
  focused: OrrerySatelliteTarget | null | undefined,
): OrreryBodyLook[] {
  const ink = tokenInk(colors.textSecondary);
  const focusInk = tokenInk(colors.accent);
  return satellites.map((row) => {
    const target = {
      kind: "satellite" as const,
      uid: row.uid,
      parentId: row.parentId,
      parentUid: row.parentUid,
    };
    const isFocused =
      focused?.uid === row.uid &&
      focused.parentId === row.parentId &&
      focused.parentUid === row.parentUid;
    return {
      key: bodyKey({ kind: "satellite", id: -1, satelliteTarget: target }),
      kind: "satellite" as const,
      worldRadius: 1,
      outlineInk: ink,
      swatchInk: ink,
      photoKey: null,
      initialsFontSize: 0,
      focusInk: isFocused ? focusInk : null,
    };
  });
}

// ── Labels (38.7-07 Task 2) ──────────────────────────────────────────────────

/** What the `labels` picture reads: Paragraphs from OrreryTextService only. */
export interface OrreryLabelLayerSpecs {
  /** The shared spec generation (0 = nothing published yet). */
  generation: number;
  mountEpoch: number;
  /** Body key → the prepared label and its context caption (detail tier). */
  labels: OrreryLabelSpec["labels"];
  /** The allocation input, in draw order (only admitted labels). */
  measured: readonly OrreryMeasuredLabel[];
  /** The backplate (today's `colors.surface`). */
  plateInk: OrreryInk;
}
export const EMPTY_LABEL_LAYER_SPECS: OrreryLabelLayerSpecs = Object.freeze({
  generation: 0,
  mountEpoch: 0,
  labels: Object.freeze({}),
  measured: Object.freeze([]) as readonly OrreryMeasuredLabel[],
  plateInk: NO_INK,
});

/** Ledger handles: a separator that never occurs in a key or number. */
const HANDLE_SEPARATOR = "\u0001";
/** The ledger handle of a photo image (its cache epoch travels with it). */
export function photoHandle(photoEpoch: number, id: number): string {
  return `p${HANDLE_SEPARATOR}${photoEpoch}${HANDLE_SEPARATOR}${id}`;
}
/** The ledger handle of a text-service entry (its owner epoch travels with it). */
export function textHandle(textEpoch: number, key: string): string {
  return `t${HANDLE_SEPARATOR}${textEpoch}${HANDLE_SEPARATOR}${key}`;
}
/** 38.7-08: the ledger handle of a baked base snapshot (its mount epoch travels with it). */
export function baseHandle(mountEpoch: number, id: number): string {
  return `b${HANDLE_SEPARATOR}${mountEpoch}${HANDLE_SEPARATOR}${id}`;
}
export type OrreryLedgerHandle =
  | { kind: "photo"; epoch: number; id: number }
  | { kind: "text"; epoch: number; key: string }
  | { kind: "base"; epoch: number; id: number };
export function parseLedgerHandle(handle: string): OrreryLedgerHandle | null {
  const first = handle.indexOf(HANDLE_SEPARATOR);
  const second = handle.indexOf(HANDLE_SEPARATOR, first + 1);
  if (first !== 1 || second < 0) return null;
  const epoch = Number(handle.slice(first + 1, second));
  const rest = handle.slice(second + 1);
  if (handle[0] === "p") return { kind: "photo", epoch, id: Number(rest) };
  if (handle[0] === "t") return { kind: "text", epoch, key: rest };
  if (handle[0] === "b") return { kind: "base", epoch, id: Number(rest) };
  return null;
}

export interface OrrerySpecPublisherOptions {
  /** The H3 ledger every native object the specs reference is tracked by. */
  ledger: OrreryGenerationLedger<string>;
  /** Writes the body specs SharedValue (never React state). */
  writeBodies: (specs: OrreryBodySpecs) => void;
  /** Writes the label specs SharedValue (never React state). */
  writeLabels?: (specs: OrreryLabelLayerSpecs) => void;
}

export interface OrrerySpecPublisher {
  /** Resource / theme / focus change: the static looks. */
  setLooks(looks: readonly OrreryBodyLook[]): void;
  /** The text publisher's initials spec (body key → Paragraph, its cache keys). */
  setInitials(spec: OrreryInitialsSpec): void;
  /** The text publisher's label spec (labels, captions and their measurements). */
  setLabels(spec: OrreryLabelSpec): void;
  /** Theme change: the label backplate ink. */
  setLabelPlate(ink: OrreryInk): void;
  /** The photo cache's drawn photos for this owner, tagged with its epoch. */
  setPhotos(
    photos: ReadonlyMap<string, OrreryDrawnPhoto>,
    photoEpoch: number,
  ): void;
  /** Ends the publishing epoch now (unmount); returns it for the later teardown. */
  detach(): number | null;
  generation(): number;
  epoch(): number | null;
}

/**
 * 38.7-07 (D-43/H3): the JS-thread spec publisher. It composes the body looks
 * with the native objects (initials Paragraphs, photo SkImages) into one
 * immutable spec array, writes it with a monotonically increasing shared
 * generation, and tells the ledger which native objects that generation
 * references for which layers. A photo arriving republishes the specs without
 * any React state change; an unchanged input writes nothing.
 */
export function createOrrerySpecPublisher(
  options: OrrerySpecPublisherOptions,
): OrrerySpecPublisher {
  const { ledger, writeBodies, writeLabels } = options;
  let looks: readonly OrreryBodyLook[] = [];
  let initials: Readonly<Record<string, PreparedOrreryText | null>> = {};
  let initialsHandles: readonly string[] = [];
  let labelSpec: OrreryLabelSpec | null = null;
  let plateInk: OrreryInk = NO_INK;
  let photos: ReadonlyMap<string, OrreryDrawnPhoto> = new Map();
  let photoEpoch = 0;
  let generation = 0;
  let epoch: number | null = null;
  let published: readonly OrreryBodySpec[] | null = null;
  let publishedLooks: readonly OrreryBodyLook[] | null = null;

  function publishBodies(): void {
    const bodies: OrreryBodySpec[] = [];
    const handles = new Set<string>();
    let same =
      published !== null &&
      publishedLooks === looks &&
      published.length === looks.length;
    for (const handle of initialsHandles) handles.add(handle);
    for (let i = 0; i < looks.length; i++) {
      const look = looks[i];
      const drawn =
        look.photoKey === null ? undefined : photos.get(look.photoKey);
      const spec: OrreryBodySpec = {
        ...look,
        initials: initials[look.key] ?? null,
        photo: drawn?.image ?? null,
      };
      if (drawn) handles.add(photoHandle(photoEpoch, drawn.id));
      if (
        same &&
        (published?.[i]?.photo !== spec.photo ||
          published?.[i]?.initials !== spec.initials)
      )
        same = false;
      bodies.push(spec);
    }
    if (same) return;
    if (epoch === null) epoch = ledger.beginEpoch();
    generation++;
    published = bodies;
    publishedLooks = looks;
    ledger.publish(generation, ORRERY_BODY_LAYERS, handles);
    writeBodies({ generation, mountEpoch: epoch, bodies });
  }

  function publishLabels(): void {
    if (!writeLabels || !labelSpec) return;
    if (epoch === null) epoch = ledger.beginEpoch();
    generation++;
    const textEpoch = labelSpec.mountEpoch;
    ledger.publish(
      generation,
      [ORRERY_LAYER.labels],
      labelSpec.keys.map((key) => textHandle(textEpoch, key)),
    );
    writeLabels({
      generation,
      mountEpoch: epoch,
      labels: labelSpec.labels,
      measured: labelSpec.measured,
      plateInk,
    });
  }

  return {
    setLooks(next) {
      looks = next;
      publishBodies();
    },
    setInitials(next) {
      initials = next.initials;
      initialsHandles = next.keys.map((key) =>
        textHandle(next.mountEpoch, key),
      );
      // Always a new generation: the text epoch in the handles may change
      // even when every Paragraph is reused from the cache (a remount).
      publishedLooks = null;
      publishBodies();
    },
    setLabels(next) {
      labelSpec = next;
      publishLabels();
    },
    setLabelPlate(ink) {
      if (
        ink[0] === plateInk[0] &&
        ink[1] === plateInk[1] &&
        ink[2] === plateInk[2] &&
        ink[3] === plateInk[3]
      )
        return;
      plateInk = ink;
      publishLabels();
    },
    setPhotos(next, nextEpoch) {
      photos = next;
      photoEpoch = nextEpoch;
      publishBodies();
    },
    detach() {
      const ended = epoch;
      epoch = null;
      published = null;
      publishedLooks = null;
      labelSpec = null;
      initials = {};
      initialsHandles = [];
      return ended;
    },
    generation: () => generation,
    epoch: () => epoch,
  };
}
