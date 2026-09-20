import { describe, expect, it } from "vitest";
import { packOverviewModules } from "./pack-overview";

const modules = [
  { id: "orbit-status" as const, size: "2x1" as const },
  { id: "gravity" as const, size: "1x1" as const },
  { id: "intensity" as const, size: "2x1" as const },
  { id: "last-interaction" as const, size: "2x1" as const },
  { id: "contact-frequency" as const, size: "1x1" as const },
  { id: "snooze" as const, size: "1x1" as const },
];

describe("packOverviewModules", () => {
  it("packs empty and single-module layouts deterministically", () => {
    expect(packOverviewModules([], { width: 328, fontScale: 1 })).toEqual({
      columns: 2,
      placements: [],
    });
    expect(
      packOverviewModules([modules[1]], { width: 328, fontScale: 1 }),
    ).toEqual({
      columns: 2,
      placements: [
        { id: "gravity", size: "1x1", row: 0, column: 0, columnSpan: 2 },
      ],
    });
  });

  it("uses stable row-major order with exact-fit adjacency and no overlap", () => {
    const packed = packOverviewModules(modules, {
      width: 496,
      fontScale: 1,
    });
    expect(packed.columns).toBe(3);
    expect(packed.placements).toEqual([
      { id: "orbit-status", size: "2x1", row: 0, column: 0, columnSpan: 2 },
      { id: "gravity", size: "1x1", row: 0, column: 2, columnSpan: 1 },
      { id: "intensity", size: "2x1", row: 1, column: 0, columnSpan: 2 },
      {
        id: "last-interaction",
        size: "2x1",
        row: 2,
        column: 0,
        columnSpan: 2,
      },
      {
        id: "contact-frequency",
        size: "1x1",
        row: 2,
        column: 2,
        columnSpan: 1,
      },
      { id: "snooze", size: "1x1", row: 3, column: 0, columnSpan: 3 },
    ]);
  });

  it("reduces columns for narrow width and large text before clipping", () => {
    for (const input of [
      { width: 150, fontScale: 1 },
      { width: 328, fontScale: 1.4 },
    ]) {
      const packed = packOverviewModules(modules.slice(0, 3), input);
      expect(packed.columns).toBe(1);
      expect(packed.placements.map((item) => item.columnSpan)).toEqual([
        1, 1, 1,
      ]);
      expect(packed.placements.map((item) => item.row)).toEqual([0, 1, 2]);
      expect(packed.placements.map((item) => item.size)).toEqual([
        "2x1",
        "1x1",
        "2x1",
      ]);
    }
  });

  it("rejects sizes that a semantic module does not declare", () => {
    expect(() =>
      packOverviewModules([{ id: "gravity", size: "2x1" }], {
        width: 328,
        fontScale: 1,
      }),
    ).toThrow("illegal size for Profile module gravity");
  });

  it("stretches every row-local compact orphan without changing order or semantic size", () => {
    const trailing = packOverviewModules([modules[1]], {
      width: 328,
      fontScale: 1,
    });
    expect(trailing.placements).toEqual([
      { id: "gravity", size: "1x1", row: 0, column: 0, columnSpan: 2 },
    ]);

    const midSequence = packOverviewModules(
      [modules[1], modules[0], modules[5]],
      { width: 328, fontScale: 1 },
    );
    expect(midSequence.placements).toEqual([
      { id: "gravity", size: "1x1", row: 0, column: 0, columnSpan: 2 },
      {
        id: "orbit-status",
        size: "2x1",
        row: 1,
        column: 0,
        columnSpan: 2,
      },
      { id: "snooze", size: "1x1", row: 2, column: 0, columnSpan: 2 },
    ]);
    expect(midSequence.placements.map((placement) => placement.id)).toEqual([
      "gravity",
      "orbit-status",
      "snooze",
    ]);
    expect(midSequence.placements.map((placement) => placement.size)).toEqual([
      "1x1",
      "2x1",
      "1x1",
    ]);

    const paired = packOverviewModules([modules[1], modules[5]], {
      width: 328,
      fontScale: 1,
    });
    expect(paired.placements.map((placement) => placement.columnSpan)).toEqual([
      1, 1,
    ]);

    const threeColumns = packOverviewModules([modules[1], modules[0]], {
      width: 496,
      fontScale: 1,
    });
    expect(
      threeColumns.placements.map((placement) => placement.columnSpan),
    ).toEqual([1, 2]);

    const singleColumn = packOverviewModules([modules[1]], {
      width: 150,
      fontScale: 1,
    });
    expect(singleColumn.columns).toBe(1);
    expect(singleColumn.placements[0]).toMatchObject({
      size: "1x1",
      columnSpan: 1,
    });
  });
});
