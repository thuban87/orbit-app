import { describe, expect, it } from "vitest";
import { shouldRouteBackupShare } from "./backup-share-intent";

describe("shouldRouteBackupShare", () => {
  it("routes a pending JSON share when the text receiver has no share", () => {
    expect(shouldRouteBackupShare(true, false)).toBe(true);
  });

  it("leaves text capture and ordinary launches with their existing owners", () => {
    expect(shouldRouteBackupShare(true, true)).toBe(false);
    expect(shouldRouteBackupShare(false, true)).toBe(false);
    expect(shouldRouteBackupShare(false, false)).toBe(false);
  });
});
