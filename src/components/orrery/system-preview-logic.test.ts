import { describe, expect, it } from "vitest";
import type { ProvisionalOrreryScene } from "@/services/orrery-scene";
import {
  buildPreviewMarkers,
  previewMemberOptions,
  previewMembershipSummary,
} from "./system-preview-logic";

function scene(world: ProvisionalOrreryScene["world"]): ProvisionalOrreryScene {
  return { world } as ProvisionalOrreryScene;
}

describe("System preview projection", () => {
  it("returns an explicit empty descriptor for a System with no orbiting members", () => {
    expect(
      buildPreviewMarkers(
        scene([
          {
            id: 0,
            kind: "sun",
            x: 0,
            y: 0,
            radius: 30,
            ringRadius: 0,
          },
        ]),
      ),
    ).toEqual({ kind: "empty", markers: [] });
  });

  it("projects shared scene positions and approximate sizes without photo or label payloads", () => {
    const markers = buildPreviewMarkers(
      scene([
        {
          id: 7,
          kind: "contact",
          x: -58,
          y: 0,
          radius: 16,
          ringRadius: 58,
        },
        {
          id: 9,
          kind: "contact",
          x: 0,
          y: 92,
          radius: 18,
          ringRadius: 92,
        },
      ]),
    );

    expect(markers).toEqual({
      kind: "ready",
      markers: [
        { id: 7, x: -58, y: 0, size: 12, ringRadius: 58 },
        { id: 9, x: 0, y: 92, size: 13.5, ringRadius: 92 },
      ],
    });
    expect(JSON.stringify(markers)).not.toMatch(/photo|label/);
  });

  it("uses the copy-contract membership summary", () => {
    expect(previewMembershipSummary([])).toBe("0 members");
    expect(previewMembershipSummary([{ id: 1 }])).toBe("1 member");
    expect(previewMembershipSummary([{ id: 1 }, { id: 2 }])).toBe("2 members");
  });

  it("provides named, non-canvas focus targets for every preview member", () => {
    expect(
      previewMemberOptions([
        { id: 7, name: "Alex" },
        { id: 9, name: "Bea" },
      ]),
    ).toEqual([
      { id: 7, name: "Alex" },
      { id: 9, name: "Bea" },
    ]);
  });
});
