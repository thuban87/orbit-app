import { describe, expect, it } from "vitest";
import {
  SHEET_BODY_FLEX,
  SHEET_HEIGHT_PERCENT,
  SHEET_VARIANTS,
} from "./sheet-contract";

describe("Sheet variant contract", () => {
  it("retains the compact/detail dimensions while adding only an explicit expanded variant", () => {
    expect(SHEET_VARIANTS).toEqual(["compact", "detail", "expanded"]);
    expect(SHEET_HEIGHT_PERCENT.compact).toBe("40%");
    expect(SHEET_HEIGHT_PERCENT.detail).toBe("60%");
    expect(SHEET_HEIGHT_PERCENT.expanded).toBe("92%");
  });

  it("allocates remaining body height only to expanded workflows", () => {
    expect(SHEET_BODY_FLEX.compact).toBe(0);
    expect(SHEET_BODY_FLEX.detail).toBe(0);
    expect(SHEET_BODY_FLEX.expanded).toBe(1);
  });
});
