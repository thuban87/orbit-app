import type { ProvisionalOrreryScene } from "@/services/orrery-scene";

export type PreviewMarker = {
  id: number;
  x: number;
  y: number;
  size: number;
  ringRadius: number;
};

export type PreviewMarkerResult =
  | { kind: "empty"; markers: [] }
  | { kind: "ready"; markers: PreviewMarker[] };

/**
 * Maps the shared provisional scene into deliberately simple marker geometry.
 * `readProvisionalOrreryScene` owns all membership, scale, and placement work;
 * this module only strips the production scene down for the preview renderer.
 */
export function buildPreviewMarkers(
  scene: Pick<ProvisionalOrreryScene, "world">,
): PreviewMarkerResult {
  const markers = scene.world
    .filter((body) => body.kind === "contact")
    .map((body) => ({
      id: body.id,
      x: body.x,
      y: body.y,
      size: body.radius * 0.75,
      ringRadius: body.ringRadius,
    }));
  return markers.length
    ? { kind: "ready", markers }
    : { kind: "empty", markers: [] };
}

export function previewMembershipSummary(
  memberRecords: readonly { id: number }[],
): string {
  const count = memberRecords.length;
  return `${count} ${count === 1 ? "member" : "members"}`;
}
