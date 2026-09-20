import { describe, expect, it } from "vitest";
import type { FuelItem } from "@/db/fuel-read";
import {
  filterOffLimitsWrite,
  forceOffLimitsKind,
  seedOffLimitsDraft,
} from "./off-limits-draft-adapter";

const row = (id: number, kind: FuelItem["kind"]): FuelItem => ({
  id,
  contact_id: 7,
  kind,
  label: null,
  text: kind,
  url: null,
  created_at: "2026-09-20 12:00:00",
  source: "user",
});

describe("off-limits draft adapter", () => {
  it("filters the seed, forces foreign drafts, and defensively re-filters writes", () => {
    expect(seedOffLimitsDraft([row(1, "topic"), row(2, "off_limits")])).toEqual(
      [expect.objectContaining({ id: 2, kind: "off_limits" })],
    );
    expect(
      forceOffLimitsKind({
        kind: "gift",
        label: null,
        text: "Avoid",
        url: null,
      }),
    ).toMatchObject({ kind: "off_limits", text: "Avoid" });
    expect(
      filterOffLimitsWrite([
        { id: 2, kind: "off_limits", label: null, text: "Keep", url: null },
        { id: 3, kind: "topic", label: null, text: "Drop", url: null },
      ] as never),
    ).toEqual([expect.objectContaining({ id: 2, kind: "off_limits" })]);
  });
});
