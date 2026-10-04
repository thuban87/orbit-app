import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ORRERY_OCCLUSION_SOURCES,
  staticOcclusionRects,
} from "./occlusion-sources";

/** Every obstacle id the Orrery UI registers, read from the source itself. */
function registeredIds(): string[] {
  const files = [
    "src/screens/OrreryScreen.tsx",
    "src/components/orrery/OrrerySystemSelector.tsx",
    "src/components/orrery/OrreryViewOptions.tsx",
    "src/components/orrery/OrreryClusterPanel.tsx",
    "src/components/orrery/OrreryControls.tsx",
    "src/components/orrery/OrreryFocusContext.tsx",
    "src/components/orrery/OrreryImmersiveHeader.tsx",
  ];
  const ids = new Set<string>();
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/obstacleId="([^"]+)"/g))
      ids.add(match[1]);
    for (const match of text.matchAll(
      /export const (?:CLUSTER_OBSTACLE|ORRERY_CONTROLS_OBSTACLE|ORRERY_HEADER_OBSTACLE) = "([^"]+)"/g,
    ))
      ids.add(match[1]);
    for (const match of text.matchAll(/useWindowObstacle\(\s*"([^"]+)"/g))
      ids.add(match[1]);
  }
  return [...ids].sort();
}

describe("38.7-11 (D-55): the Orrery occlusion registry", () => {
  it("lists every Orrery text surface the UI registers, with its source", () => {
    const ids = registeredIds();
    expect(ids.length).toBeGreaterThan(10);
    for (const id of ids) expect(ORRERY_OCCLUSION_SOURCES[id]).toBeDefined();
    // No stale entries: every obstacle-rect / no-text / header id is still
    // registered (38.7-12 D-30 removed the loading notice's).
    for (const [id, entry] of Object.entries(ORRERY_OCCLUSION_SOURCES))
      if (entry.source !== "derived-rect") expect(ids).toContain(id);
    expect(ORRERY_OCCLUSION_SOURCES["orrery-loading-feedback"]).toBeUndefined();
  });

  it("38.7-12 (D-39): the Orrery title is a header-scrim source, never dimmed by the occlusion fill", () => {
    expect(ORRERY_OCCLUSION_SOURCES["orrery-immersive-header"]).toEqual({
      component: "OrreryImmersiveHeader",
      source: "header-scrim",
    });
    const rect = { x: 0, y: 0, width: 400, height: 52 };
    expect(staticOcclusionRects({ "orrery-immersive-header": rect })).toEqual(
      [],
    );
  });

  it("the focus card is a derived rect and registers no obstacle (C-M2)", () => {
    expect(ORRERY_OCCLUSION_SOURCES["orrery-focus-context"].source).toBe(
      "derived-rect",
    );
    expect(registeredIds()).not.toContain("orrery-focus-context");
    expect(
      readFileSync("src/components/orrery/OrreryFocusContext.tsx", "utf8"),
    ).not.toContain('"orrery-focus-context"');
  });

  it("only static text panels feed the measured occlusion (icon-only controls and shell rects do not)", () => {
    const rect = (x: number) => ({ x, y: 0, width: 10, height: 10 });
    expect(
      staticOcclusionRects({
        "orrery-system-trigger": rect(1),
        "orrery-camera-controls": rect(2),
        "shell-tabs": rect(3),
        "orrery-cluster-panel": rect(4),
      }),
    ).toEqual([rect(1), rect(4)]);
  });
});
