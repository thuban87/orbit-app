/**
 * 38.7-11 (D-55/H5): every Orrery text surface and where its occlusion rect
 * comes from. The canvas dims what it draws under each of these (card glass
 * untouched, D-20/D-35); Plan 14 proves the 4.5:1 gate over them (D-28).
 *
 * - "derived-rect": the docked focus card — its rect is the UI-thread
 *   `focusCardRect` that also positions it, so the dim follows it through pan,
 *   pinch and focus animation (never a measured, possibly stale rect).
 * - "obstacle-rect": a static panel or notice — its measured window rect from
 *   the shell obstacle store (it does not move over the map while open).
 * - "no-text": registered for layout only (icon-only controls); no dim.
 * - "header-scrim": the Orrery title (38.7-12, D-39) — its legibility comes
 *   from ShellAppBar's own chrome scrim plus the Orrery-local fading header
 *   scrim (`OrreryImmersiveHeader`), not the occlusion dim; Plan 14 proves it.
 *
 * The keys are the obstacle ids the Orrery UI registers (OrreryScreen's
 * feedback notices, OrrerySystemSelector, OrreryViewOptions,
 * OrreryClusterPanel `CLUSTER_OBSTACLE`, OrreryControls
 * `ORRERY_CONTROLS_OBSTACLE`, OrreryImmersiveHeader
 * `ORRERY_HEADER_OBSTACLE`); the focus card registers none (C-M2).
 */
import type { CameraRect } from "@/logic/orrery-camera-logic";

export type OrreryOcclusionSource =
  | "derived-rect"
  | "obstacle-rect"
  | "header-scrim"
  | "no-text";

export const ORRERY_OCCLUSION_SOURCES: Readonly<
  Record<string, { component: string; source: OrreryOcclusionSource }>
> = {
  "orrery-focus-context": {
    component: "OrreryFocusContext",
    source: "derived-rect",
  },
  "orrery-cluster-panel": {
    component: "OrreryClusterPanel",
    source: "obstacle-rect",
  },
  "orrery-system-trigger": {
    component: "OrrerySystemSelector",
    source: "obstacle-rect",
  },
  "orrery-system-panel": {
    component: "OrrerySystemSelector",
    source: "obstacle-rect",
  },
  "orrery-view-trigger": {
    component: "OrreryViewOptions",
    source: "obstacle-rect",
  },
  "orrery-view-panel": {
    component: "OrreryViewOptions",
    source: "obstacle-rect",
  },
  "orrery-focus-feedback": {
    component: "OrreryFeedback",
    source: "obstacle-rect",
  },
  "orrery-reorder-feedback": {
    component: "OrreryFeedback",
    source: "obstacle-rect",
  },
  "orrery-read-feedback": {
    component: "OrreryFeedback",
    source: "obstacle-rect",
  },
  "orrery-missing-feedback": {
    component: "OrreryFeedback",
    source: "obstacle-rect",
  },
  "orrery-save-feedback": {
    component: "OrreryFeedback",
    source: "obstacle-rect",
  },
  "orrery-broken-system-feedback": {
    component: "OrreryFeedback",
    source: "obstacle-rect",
  },
  "orrery-settings-feedback": {
    component: "OrreryFeedback",
    source: "obstacle-rect",
  },
  "orrery-empty-feedback": {
    component: "OrreryFeedback",
    source: "obstacle-rect",
  },
  "orrery-camera-controls": { component: "OrreryControls", source: "no-text" },
  "orrery-immersive-header": {
    component: "OrreryImmersiveHeader",
    source: "header-scrim",
  },
};

/** The measured window rects of the static text surfaces (obstacle-rect). */
export function staticOcclusionRects(
  obstacles: Readonly<Record<string, CameraRect>>,
): CameraRect[] {
  const out: CameraRect[] = [];
  for (const [id, rect] of Object.entries(obstacles))
    if (ORRERY_OCCLUSION_SOURCES[id]?.source === "obstacle-rect")
      out.push(rect);
  return out;
}
