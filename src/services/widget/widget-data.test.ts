/**
 * widget-data — proof that the favourites tile shaper is a pure, node-testable
 * projection of the EXISTING `listDashboard({filter:'favourites'})` rows into
 * widget tiles: it carries the derived status VERBATIM (never re-deriving it, so
 * the never-contacted='stable' HIGH-1 trap can never resurface), computes only
 * the presentational initials + swatch index, and truncates by the incoming
 * favourite_rank order. No DB, no react-native, no expo — a fake DashboardRow[]
 * fixture and a stub SqlExecutor exercise every branch.
 */
import { describe, expect, it, vi } from "vitest";
import type { DashboardRow } from "@/db/dashboard-read";
import type { SqlExecutor } from "@/db/types";
import { getInitials, swatchIndex } from "@/components/avatar-initials";
import {
  loadWidgetTiles,
  shapeWidgetTiles,
  WIDGET_GRID_CAPACITY,
} from "./widget-data";

const SWATCH_COUNT = 8;

/** A DashboardRow fixture builder — favourites arrive favourite_rank ASC. */
function row(over: Partial<DashboardRow> & { id: number; name: string }): DashboardRow {
  return {
    photo: null,
    modified_at: "2026-08-17",
    categoryLabel: null,
    favourite_rank: over.id,
    status: "stable",
    progress: 0.1,
    fuelText: null,
    snippet: null,
    ...over,
  };
}

describe("shapeWidgetTiles", () => {
  it("carries status VERBATIM, including a null never-contacted favourite", () => {
    const rows: DashboardRow[] = [
      row({ id: 1, name: "Ada Lovelace", status: "rogue" }),
      row({ id: 2, name: "Never Contacted", status: null, progress: null }),
      row({ id: 3, name: "Grace", status: "wobble" }),
    ];
    const tiles = shapeWidgetTiles(rows, {
      capacity: WIDGET_GRID_CAPACITY,
      swatchCount: SWATCH_COUNT,
    });
    expect(tiles.map((t) => t.status)).toEqual(["rogue", null, "wobble"]);
  });

  it("computes initials + swatchIndex via the shared avatar helpers", () => {
    const tiles = shapeWidgetTiles(
      [row({ id: 1, name: "Ada Lovelace", photo: "avatars/1.jpg", fuelText: "Ask about Analytical Engine" })],
      { capacity: WIDGET_GRID_CAPACITY, swatchCount: SWATCH_COUNT },
    );
    expect(tiles[0]).toEqual({
      id: 1,
      name: "Ada Lovelace",
      status: "stable",
      initials: getInitials("Ada Lovelace"),
      swatchIndex: swatchIndex("Ada Lovelace", SWATCH_COUNT),
      relativePhoto: "avatars/1.jpg",
      fuelText: "Ask about Analytical Engine",
    });
  });

  it("truncates to capacity, preserving the incoming favourite_rank order", () => {
    const rows: DashboardRow[] = [
      row({ id: 1, name: "One" }),
      row({ id: 2, name: "Two" }),
      row({ id: 3, name: "Three" }),
      row({ id: 4, name: "Four" }),
    ];
    const tiles = shapeWidgetTiles(rows, { capacity: 2, swatchCount: SWATCH_COUNT });
    expect(tiles.map((t) => t.name)).toEqual(["One", "Two"]);
  });

  it("maps an empty list to []", () => {
    expect(
      shapeWidgetTiles([], { capacity: WIDGET_GRID_CAPACITY, swatchCount: SWATCH_COUNT }),
    ).toEqual([]);
  });
});

describe("loadWidgetTiles", () => {
  it("reads the listDashboard favourites projection and shapes it", async () => {
    const rows: DashboardRow[] = [
      row({ id: 10, name: "Fav One", favourite_rank: 0 }),
      row({ id: 11, name: "Fav Two", favourite_rank: 1 }),
    ];
    const getAllAsync = vi.fn().mockResolvedValue(rows);
    const exec = { getAllAsync } as unknown as SqlExecutor;

    const tiles = await loadWidgetTiles(exec, { swatchCount: SWATCH_COUNT });

    // The SQL that ran must be the favourites branch (archived-only + rank).
    const sql = getAllAsync.mock.calls[0][0] as string;
    expect(sql).toContain("c.favourite_rank IS NOT NULL");
    expect(sql).toContain("c.favourite_rank ASC");
    expect(tiles.map((t) => t.id)).toEqual([10, 11]);
    expect(tiles[0].initials).toBe(getInitials("Fav One"));
  });

  it("truncates the loaded favourites to the default grid capacity", async () => {
    const rows: DashboardRow[] = Array.from({ length: WIDGET_GRID_CAPACITY + 3 }, (_, i) =>
      row({ id: i + 1, name: `Fav ${i + 1}`, favourite_rank: i }),
    );
    const exec = {
      getAllAsync: vi.fn().mockResolvedValue(rows),
    } as unknown as SqlExecutor;

    const tiles = await loadWidgetTiles(exec, { swatchCount: SWATCH_COUNT });
    expect(tiles).toHaveLength(WIDGET_GRID_CAPACITY);
  });
});
