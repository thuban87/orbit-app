import { describe, expect, it } from "vitest";
import {
  BACKGROUND_ORDER,
  BACKGROUND_SLOTS,
  NONE_SLOT_ID,
  PACKAGE_DEFAULT_SLOT,
  resolveBackground,
  resolveRenderableBackground,
} from "./backgrounds";
import { BACKGROUND_SLOT_IDS } from "./theme-option-ids";
import type { ThemePackage } from "./theme-types";

const PACKAGES: ThemePackage[] = ["galaxy", "standard"];

/** Look up a slot by id, narrowing away `none` (which has no asset slot). */
function slotOf(id: string) {
  return BACKGROUND_SLOTS[id as keyof typeof BACKGROUND_SLOTS] as
    | (typeof BACKGROUND_SLOTS)[keyof typeof BACKGROUND_SLOTS]
    | undefined;
}

describe("slot-id drift guard — manifest slot-id set === BACKGROUND_SLOT_IDS", () => {
  it("the manifest declares EXACTLY the imported single-source slot ids (no re-declared list)", () => {
    // Union of every declared slot id (both packages' ordered lists) === the
    // Plan 01 single source. No accepted id without a manifest slot; no manifest
    // slot outside the accepted set (REVIEWS 23-01 cycle-4 MEDIUM).
    const declared = new Set<string>([NONE_SLOT_ID]);
    for (const pkg of PACKAGES) {
      for (const id of BACKGROUND_ORDER[pkg]) {
        declared.add(id);
      }
    }
    expect([...declared].sort()).toEqual([...BACKGROUND_SLOT_IDS].sort());
  });

  it("every non-None asset slot has a require thunk and a #RRGGBB brightest pixel", () => {
    for (const [id, slot] of Object.entries(BACKGROUND_SLOTS)) {
      expect(id).not.toBe(NONE_SLOT_ID);
      expect(typeof slot.source).toBe("function");
      expect(slot.brightestPixel).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(PACKAGES).toContain(slot.package);
    }
  });

  it("the package default slot is a real asset slot in that package's order", () => {
    for (const pkg of PACKAGES) {
      const def = PACKAGE_DEFAULT_SLOT[pkg];
      expect(BACKGROUND_ORDER[pkg]).toContain(def);
      expect(slotOf(def)?.package).toBe(pkg);
    }
  });
});

describe("BACKGROUND_ORDER — stable, deterministic, None last per package", () => {
  it("each package lists its own asset slots then None/Solid, order stable", () => {
    for (const pkg of PACKAGES) {
      const order = BACKGROUND_ORDER[pkg];
      // None/Solid is the final slot of every package.
      expect(order[order.length - 1]).toBe(NONE_SLOT_ID);
      // Every non-None slot belongs to THIS package.
      for (const id of order.slice(0, -1)) {
        expect(slotOf(id)?.package).toBe(pkg);
      }
      // The order is a fixed array (deterministic — same identity each read).
      expect(BACKGROUND_ORDER[pkg]).toBe(order);
    }
  });
});

describe("resolveBackground — NULL -> default, none -> solid, slot -> asset", () => {
  it("NULL resolves to the package default asset slot", () => {
    for (const pkg of PACKAGES) {
      const r = resolveBackground(pkg, null);
      expect(r.kind).toBe("asset");
      if (r.kind === "asset") {
        expect(r.slotId).toBe(PACKAGE_DEFAULT_SLOT[pkg]);
        expect(typeof r.source).toBe("function");
      }
    }
  });

  it("'none' resolves to the solid theme background", () => {
    for (const pkg of PACKAGES) {
      expect(resolveBackground(pkg, "none")).toEqual({ kind: "solid" });
    }
  });

  it("a known slot id resolves to its asset + declared brightest pixel", () => {
    const r = resolveBackground("galaxy", "galaxy-nebula");
    expect(r.kind).toBe("asset");
    if (r.kind === "asset") {
      expect(r.slotId).toBe("galaxy-nebula");
      expect(r.brightestPixel).toBe(
        BACKGROUND_SLOTS["galaxy-nebula"].brightestPixel,
      );
    }
  });

  it("an unknown/tampered slot id falls back to the package default (T-23-05b)", () => {
    const tampered = "totally-not-a-slot" as never;
    for (const pkg of PACKAGES) {
      const r = resolveBackground(pkg, tampered);
      expect(r.kind).toBe("asset");
      if (r.kind === "asset") {
        expect(r.slotId).toBe(PACKAGE_DEFAULT_SLOT[pkg]);
      }
    }
  });

  it("adjacency: resolving the SAME (package, slot) twice is deterministic (no-op swap)", () => {
    // A same-selection re-resolve returns an equivalent descriptor — the pure-
    // function stand-in for BackgroundHost's no-flicker no-op (THEME-04 edge).
    const a = resolveBackground("galaxy", "galaxy-aurora");
    const b = resolveBackground("galaxy", "galaxy-aurora");
    expect(a.kind).toBe(b.kind);
    if (a.kind === "asset" && b.kind === "asset") {
      expect(a.slotId).toBe(b.slotId);
      expect(a.brightestPixel).toBe(b.brightestPixel);
    }
    // Solid is deep-equal across resolves.
    expect(resolveBackground("standard", "none")).toEqual(
      resolveBackground("standard", "none"),
    );
  });

  it("ordering edge: the resolved background is a function of (package, slot) only, not selection order", () => {
    const direct = resolveBackground("standard", "standard-mesh");
    const afterOthers = (() => {
      resolveBackground("standard", "standard-dawn");
      resolveBackground("standard", "none");
      return resolveBackground("standard", "standard-mesh");
    })();
    expect(direct).toEqual(afterOthers);
  });
});

describe("resolveRenderableBackground — onError -> None/Solid pure reducer (23-06 LOW)", () => {
  it("renderFailed=true returns None/Solid regardless of the stored slot", () => {
    for (const pkg of PACKAGES) {
      for (const slot of [
        null,
        "none",
        "galaxy-nebula",
        "standard-dawn",
      ] as const) {
        expect(resolveRenderableBackground(pkg, slot as never, true)).toEqual({
          kind: "solid",
        });
      }
    }
  });

  it("renderFailed=false returns resolveBackground's result", () => {
    for (const pkg of PACKAGES) {
      for (const slot of [null, "none", PACKAGE_DEFAULT_SLOT[pkg]] as const) {
        expect(resolveRenderableBackground(pkg, slot as never, false)).toEqual(
          resolveBackground(pkg, slot as never),
        );
      }
    }
  });
});
