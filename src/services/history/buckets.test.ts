/**
 * Count-only bucketing tests (HIST-02, D-10) — RED first.
 *
 * buckets maps a window + interaction rows to per-cell interaction COUNTS only.
 * Lifecycle / non-interaction records never reach this function, so a date with
 * no interaction row is always 0. heatmapLevel proves the two threshold tables
 * (day lenses 0..3, cycle lens 0..4) and their caps. An evening-local occurred_at
 * buckets to its LOCAL date (no UTC off-by-one).
 */
import { describe, expect, it } from "vitest";
import { buckets, heatmapLevel } from "@/services/history/buckets";
import { buildWindow } from "@/services/history/window";

const rows = (...dates: string[]) => dates.map((occurredAt) => ({ occurredAt }));

describe("buckets — count-only per-cell", () => {
  it("counts interactions per date and yields 0 for empty dates", () => {
    const w = buildWindow("7days", "2026-03-15", "2026-12-31");
    const counts = buckets(
      w,
      rows(
        "2026-03-15 09:00:00",
        "2026-03-15 18:00:00",
        "2026-03-15 21:00:00",
        "2026-03-13 10:00:00",
      ),
    );
    expect(counts.get("2026-03-15")).toBe(3);
    expect(counts.get("2026-03-13")).toBe(1);
    expect(counts.get("2026-03-14")).toBe(0);
    // Every real date in the window is represented, defaulting to 0.
    expect(counts.get("2026-03-09")).toBe(0);
  });

  it("ignores interactions outside the window bounds", () => {
    const w = buildWindow("7days", "2026-03-15", "2026-12-31");
    const counts = buckets(w, rows("2026-01-01 12:00:00", "2026-03-14 12:00:00"));
    expect(counts.get("2026-03-14")).toBe(1);
    expect(counts.has("2026-01-01")).toBe(false);
  });

  it("is order-independent for same-date rows", () => {
    const w = buildWindow("7days", "2026-03-15", "2026-12-31");
    const a = buckets(w, rows("2026-03-15 09:00:00", "2026-03-15 21:00:00"));
    const b = buckets(w, rows("2026-03-15 21:00:00", "2026-03-15 09:00:00"));
    expect(a.get("2026-03-15")).toBe(2);
    expect(b.get("2026-03-15")).toBe(2);
  });

  it("buckets an evening occurred_at to its LOCAL date (no UTC off-by-one)", () => {
    const w = buildWindow("month", "2026-03-15", "2026-12-31");
    const counts = buckets(w, rows("2026-03-15 23:30:00"));
    expect(counts.get("2026-03-15")).toBe(1);
    expect(counts.get("2026-03-16") ?? 0).toBe(0);
  });

  it("a date with only lifecycle activity (no interaction rows) counts 0", () => {
    const w = buildWindow("7days", "2026-03-15", "2026-12-31");
    // No interaction rows are supplied for 2026-03-12 — buckets never sees
    // lifecycle records, so the cell is structurally 0.
    const counts = buckets(w, rows("2026-03-15 09:00:00"));
    expect(counts.get("2026-03-12")).toBe(0);
  });
});

describe("heatmapLevel — two threshold tables", () => {
  it("caps day lenses at level 3", () => {
    for (const lens of ["7days", "month", "year"] as const) {
      expect(heatmapLevel(0, lens)).toBe(0);
      expect(heatmapLevel(1, lens)).toBe(1);
      expect(heatmapLevel(2, lens)).toBe(2);
      expect(heatmapLevel(3, lens)).toBe(3);
      expect(heatmapLevel(4, lens)).toBe(3);
      expect(heatmapLevel(99, lens)).toBe(3);
    }
  });

  it("uses the full ramp (level 4 cap) for the cycle lens", () => {
    expect(heatmapLevel(0, "cycles")).toBe(0);
    expect(heatmapLevel(1, "cycles")).toBe(1);
    expect(heatmapLevel(2, "cycles")).toBe(2);
    expect(heatmapLevel(3, "cycles")).toBe(3);
    expect(heatmapLevel(4, "cycles")).toBe(4);
    expect(heatmapLevel(10, "cycles")).toBe(4);
  });
});
