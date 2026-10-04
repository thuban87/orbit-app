/**
 * 38.7-14 (D-57): the System Preview's pure logic. The Preview draws the
 * provisional (unsaved) System with the Orrery's V2 pieces — sky, plane rings
 * and grid, lit bodies, the star sun — FLAT: its camera is always tilt 0 and
 * yaw 0 (the flat Home profile's lens), whatever the pan and pinch do
 * (phase-09 dossier: the Preview does not expose tilt or yaw). No warp, no
 * pulses, no reticle. It stays a membership and scale preview.
 *
 * Worklet helpers are defined above their callers (Hermes forward-ref rule).
 */
import {
  type CameraPose,
  dollyFocalDistance,
  HOME_PROFILES,
  type WorldBody,
} from "@/logic/orrery-camera-logic";
import type { AnimatedFrame, WorldTransition } from "@/logic/orrery-frame";
import type { ProvisionalOrreryScene } from "@/services/orrery-scene";

/** The Preview's pinch range (its own; the Orrery's camera has its own). */
export const PREVIEW_MIN_ZOOM = 0.45;
export const PREVIEW_MAX_ZOOM = 3;
/** Extra tap reach around a body (dp). */
export const PREVIEW_HIT_PADDING = 12;
/** Home framing margin (dp) inside the shorter screen side. */
export const PREVIEW_HOME_MARGIN = 48;

/**
 * C-H2: the Preview's picture layers. Its own ledger epoch, its own ids — it
 * never shares a layer, a ledger or a pin with the Orrery canvas. Only the
 * sky (the baked nebula image) and the bodies (photos, initials Paragraphs)
 * draw ledger-tracked native objects, so only they ack; the plane and focus
 * layers draw shaders and vertices that live as long as the canvas.
 */
export const PREVIEW_LAYER = {
  sky: "preview-sky",
  plane: "preview-plane",
  bodies: "preview-bodies",
  focus: "preview-focus",
} as const;
export type PreviewLayerId = (typeof PREVIEW_LAYER)[keyof typeof PREVIEW_LAYER];

/** Preview bodies only identify a marker; navigation stays outside this workflow. */
export function focusPreviewBody(
  contactId: number,
  focus: (contactId: number) => void,
): void {
  focus(contactId);
}

/**
 * The Preview canvas mounts only while its route is focused and the app is
 * in the foreground (the Orrery canvas's lifecycle guarantee).
 */
export function previewCanvasMounted(
  focused: boolean,
  appActive: boolean,
): boolean {
  return focused && appActive;
}

/** The zoom that frames the whole System (never above 1, never below the pinch floor). */
export function previewHomeZoom(
  extent: number,
  width: number,
  height: number,
): number {
  const usableDiameter = Math.max(
    1,
    Math.min(width, height) - PREVIEW_HOME_MARGIN,
  );
  const e = Number.isFinite(extent) && extent > 0 ? extent : 1;
  return Math.max(PREVIEW_MIN_ZOOM, Math.min(1, usableDiameter / (e * 2)));
}

/**
 * The Preview's camera for a pan (screen dp, the sun's offset from the
 * canvas centre) and a pinch zoom: ALWAYS flat (tilt 0, yaw 0, the flat
 * profile's centred lens). At tilt 0 the plane faces the camera, so a world
 * point lands at centre + (point − pose) × zoom — the old 2D transform.
 */
export function previewPose(
  panX: number,
  panY: number,
  zoom: number,
): CameraPose {
  "worklet";
  const z = Math.max(
    PREVIEW_MIN_ZOOM,
    Math.min(PREVIEW_MAX_ZOOM, Number.isFinite(zoom) ? zoom : 1),
  );
  return {
    x: Number.isFinite(panX) ? -panX / z : 0,
    y: Number.isFinite(panY) ? -panY / z : 0,
    zoom: z,
    tilt: HOME_PROFILES.flat.tilt,
    yaw: 0,
    focalDistance: dollyFocalDistance(z),
    lensShift: HOME_PROFILES.flat.lensShift,
  };
}

/**
 * The Preview's world as a settled transition (every body fully present and
 * interactive): the frame projector's input, with no switch choreography.
 */
export function previewTransition(
  world: readonly WorldBody[],
  generation: number,
): WorldTransition {
  const settled = world
    .filter((body) => body.kind !== "satellite")
    .map((body) => ({ ...body, opacity: 1, interactive: true }));
  return { generation, from: settled, to: settled };
}

/**
 * Tap → the nearest contact whose drawn disc (plus PREVIEW_HIT_PADDING, and
 * never less than its hit radius) contains the point, from the SAME frame the
 * pictures draw (drawn == tappable). The sun and culled bodies never resolve.
 */
export function previewBodyAt(
  frame: AnimatedFrame,
  x: number,
  y: number,
): number | null {
  "worklet";
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  let nearest: number | null = null;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < frame.bodies.length; i++) {
    const body = frame.bodies[i];
    if (body.kind !== "contact" || body.culled || !body.interactive) continue;
    const reach = Math.max(body.hitRadius, body.radius + PREVIEW_HIT_PADDING);
    const d = Math.hypot(body.x - x, body.y - y);
    if (d <= reach && d < best) {
      best = d;
      nearest = body.id;
    }
  }
  return nearest;
}

export type PreviewMemberOption = {
  id: number;
  name: string;
};

/** The non-canvas Preview equivalent keeps every member focusable by name. */
export function previewMemberOptions(
  contacts: readonly Pick<
    ProvisionalOrreryScene["contacts"][number],
    "id" | "name"
  >[],
): PreviewMemberOption[] {
  return contacts.map(({ id, name }) => ({ id, name }));
}

export function previewMembershipSummary(
  memberRecords: readonly { id: number }[],
): string {
  const count = memberRecords.length;
  return `${count} ${count === 1 ? "member" : "members"}`;
}
