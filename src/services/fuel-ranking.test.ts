/**
 * fuel-ranking — pure comparator proof (FUEL-03).
 *
 * Proves the ONE ranking rule (docs/dossier/03-fuel.md :240-251): kind priority
 * FIRST (recent > gift > topic > fact), THEN recency (created_at DESC), THEN the
 * id DESC deterministic tiebreak. The explicitly-REJECTED "newest item regardless
 * of kind" must NOT happen: a week-old `recent` outranks a day-old `fact`.
 *
 * The SQL RANK_CASE in fuel-read.getRankedFuel is DERIVED FROM the same
 * FUEL_KIND_PRIORITY constant; fuel-read.test.ts adds the parity proof that the
 * two agree over an eligible-only fixture.
 */
import { describe, expect, it } from "vitest";
import { compareFuel, FUEL_KIND_PRIORITY } from "@/services/fuel-ranking";

/** A minimal rankable row (the structural shape compareFuel is generic over). */
type Row = { id: number; kind: string; created_at: string };

/** Sort a copy by compareFuel and return the resulting id order. */
function rankedIds(rows: Row[]): number[] {
  return [...rows].sort(compareFuel).map((r) => r.id);
}

describe("FUEL_KIND_PRIORITY", () => {
  it("is the 4 rankable kinds in precedence order (off_limits is NOT listed)", () => {
    expect(FUEL_KIND_PRIORITY).toEqual(["recent", "gift", "topic", "fact"]);
    expect(FUEL_KIND_PRIORITY).not.toContain("off_limits");
  });
});

describe("compareFuel — kind priority FIRST, then recency, then id", () => {
  it("ranks a week-old `recent` ABOVE a day-old `fact` (kind beats recency)", () => {
    const rows: Row[] = [
      { id: 1, kind: "fact", created_at: "2026-08-14 09:00:00" },
      { id: 2, kind: "recent", created_at: "2026-08-08 09:00:00" },
    ];
    // recent (older) wins on kind priority — the rejected "newest regardless of
    // kind" would have put the fact first.
    expect(rankedIds(rows)).toEqual([2, 1]);
  });

  it("orders the full kind precedence recent > gift > topic > fact", () => {
    const rows: Row[] = [
      { id: 1, kind: "fact", created_at: "2026-08-10 09:00:00" },
      { id: 2, kind: "topic", created_at: "2026-08-10 09:00:00" },
      { id: 3, kind: "gift", created_at: "2026-08-10 09:00:00" },
      { id: 4, kind: "recent", created_at: "2026-08-10 09:00:00" },
    ];
    expect(rankedIds(rows)).toEqual([4, 3, 2, 1]);
  });

  it("ranks a same-day gift ABOVE a same-day topic (gift < topic priority)", () => {
    const rows: Row[] = [
      { id: 1, kind: "topic", created_at: "2026-08-12 09:00:00" },
      { id: 2, kind: "gift", created_at: "2026-08-12 09:00:00" },
    ];
    expect(rankedIds(rows)).toEqual([2, 1]);
  });

  it("within one kind, newest created_at first", () => {
    const rows: Row[] = [
      { id: 1, kind: "topic", created_at: "2026-08-01 09:00:00" },
      { id: 2, kind: "topic", created_at: "2026-08-14 09:00:00" },
      { id: 3, kind: "topic", created_at: "2026-08-07 09:00:00" },
    ];
    expect(rankedIds(rows)).toEqual([2, 3, 1]);
  });

  it("breaks a same-kind same-created_at tie by id DESC (deterministic)", () => {
    const rows: Row[] = [
      { id: 5, kind: "fact", created_at: "2026-08-12 09:00:00" },
      { id: 9, kind: "fact", created_at: "2026-08-12 09:00:00" },
      { id: 7, kind: "fact", created_at: "2026-08-12 09:00:00" },
    ];
    expect(rankedIds(rows)).toEqual([9, 7, 5]);
  });

  it("sinks an unknown / non-listed kind to the last bucket (default priority)", () => {
    const rows: Row[] = [
      { id: 1, kind: "off_limits", created_at: "2026-08-15 09:00:00" },
      { id: 2, kind: "fact", created_at: "2026-08-01 09:00:00" },
    ];
    // Even though the off_limits row is far newer, `fact` (a listed kind) ranks
    // above it. (off_limits never reaches the ranked line in practice — it is
    // SQL-excluded — but the comparator must still bucket it last.)
    expect(rankedIds(rows)).toEqual([2, 1]);
  });
});
