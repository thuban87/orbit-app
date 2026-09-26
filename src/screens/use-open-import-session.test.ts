import { describe, expect, it } from "vitest";
import { isImportSessionOpen } from "@/services/import/import-flow-guard";
import { openImportSessionEffect } from "./use-open-import-session";

describe("openImportSessionEffect (RG-035, D-20)", () => {
  it("marks the session open while active and its cleanup releases it", () => {
    const cleanup = openImportSessionEffect(7, true);
    expect(isImportSessionOpen(7)).toBe(true);
    expect(cleanup).toBeTypeOf("function");
    cleanup?.();
    expect(isImportSessionOpen(7)).toBe(false);
  });

  it("marks nothing and returns no cleanup when inactive (fatal stop)", () => {
    const cleanup = openImportSessionEffect(7, false);
    expect(isImportSessionOpen(7)).toBe(false);
    expect(cleanup).toBeUndefined();
  });

  it("releasing on the transition to inactive lets the resume sweep see the session", () => {
    const cleanup = openImportSessionEffect(9, true);
    expect(isImportSessionOpen(9)).toBe(true);
    // The effect re-runs with active=false: React runs the prior cleanup first.
    cleanup?.();
    const next = openImportSessionEffect(9, false);
    expect(next).toBeUndefined();
    expect(isImportSessionOpen(9)).toBe(false);
  });
});
