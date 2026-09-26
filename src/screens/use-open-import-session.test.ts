import { describe, expect, it } from "vitest";
import { isImportSessionOpen } from "@/services/import/import-flow-guard";
import {
  bulkSetupHoldActive,
  importProgressHoldActive,
  openImportSessionEffect,
} from "./use-open-import-session";

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

describe("import stack hold policy (38.3 review B-CR-02, D-20)", () => {
  // Model of the pushed native stack: BulkImportSetup stays mounted under
  // ImportProgress. Each screen's hook effect runs with its policy's `active`;
  // a policy change runs the prior cleanup first, exactly as React does.
  function mountHold(sessionId: number, active: boolean) {
    let cleanup = openImportSessionEffect(sessionId, active);
    return (nextActive: boolean) => {
      cleanup?.();
      cleanup = openImportSessionEffect(sessionId, nextActive);
    };
  }

  it("Setup → Progress → fatal stop releases the session so the resume sweep can offer it", () => {
    const id = 41;
    const setup = mountHold(id, bulkSetupHoldActive(true));
    // Push ImportProgress: Setup blurs, Progress mounts running.
    setup(bulkSetupHoldActive(false));
    const progress = mountHold(id, importProgressHoldActive("running"));
    expect(isImportSessionOpen(id)).toBe(true);
    // Fatal stop: Progress releases; nothing else may still hold it.
    progress(importProgressHoldActive("stopped"));
    expect(isImportSessionOpen(id)).toBe(false);
    // Back to Setup: it is on screen again, so it re-holds the session.
    setup(bulkSetupHoldActive(true));
    expect(isImportSessionOpen(id)).toBe(true);
    setup(false);
  });
});
