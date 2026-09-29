import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BACKGROUND_ORDER,
  BACKGROUND_SLOTS,
  NONE_SLOT_ID,
  PACKAGE_DEFAULT_SLOT,
  resolveBackground,
  resolveRenderableBackground,
} from "./backgrounds";
import { relativeLuminance } from "./contrast";
import { BACKGROUND_SLOT_IDS } from "./theme-option-ids";
import type { ResolvedMode, ThemePackage } from "./theme-types";

const PACKAGES: ThemePackage[] = ["galaxy", "standard"];
const MODES: ResolvedMode[] = ["light", "dark"];

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

  it("every slot has BOTH a light and a dark variant (D-23 slot x mode invariant)", () => {
    // Assumption-delta invariant: a slot is a pair of variants, one per resolved
    // mode. A slot missing either variant would leave that mode unrenderable.
    for (const [id, slot] of Object.entries(BACKGROUND_SLOTS)) {
      expect(Object.keys(slot.variants).sort(), id).toEqual(["dark", "light"]);
      for (const mode of MODES) {
        expect(slot.variants[mode], `${id}/${mode}`).toBeDefined();
      }
    }
  });

  it("every non-None asset variant has a require thunk and a #RRGGBB brightest pixel", () => {
    for (const [id, slot] of Object.entries(BACKGROUND_SLOTS)) {
      expect(id).not.toBe(NONE_SLOT_ID);
      expect(PACKAGES).toContain(slot.package);
      for (const mode of MODES) {
        const variant = slot.variants[mode];
        // The thunk is only type-checked, never invoked (no .webp require in node).
        expect(typeof variant.source, `${id}/${mode}`).toBe("function");
        expect(variant.brightestPixel, `${id}/${mode}`).toMatch(
          /^#[0-9A-Fa-f]{6}$/,
        );
      }
    }
  });

  it("every asset variant declares a #RRGGBB darkest pixel no brighter than its brightest (RG-029)", () => {
    // Both-extrema proof input (ui-accessibility/AUD-UIA-001 / D-12): the
    // declared darkest bound must be a real hex and must not sit above the
    // brightest bound, or the composite-luminance interval would be inverted.
    for (const [id, slot] of Object.entries(BACKGROUND_SLOTS)) {
      for (const mode of MODES) {
        const variant = slot.variants[mode];
        expect(variant.darkestPixel, `${id}/${mode}`).toMatch(
          /^#[0-9A-Fa-f]{6}$/,
        );
        expect(
          relativeLuminance(variant.darkestPixel),
          `${id}/${mode}: darkestPixel luminance <= brightestPixel luminance`,
        ).toBeLessThanOrEqual(relativeLuminance(variant.brightestPixel));
      }
    }
  });

  it("a resolved asset carries the mode variant's declared darkest pixel", () => {
    for (const mode of MODES) {
      const r = resolveBackground("standard", "standard-dusk", mode);
      expect(r.kind).toBe("asset");
      if (r.kind === "asset") {
        expect(r.darkestPixel).toBe(
          BACKGROUND_SLOTS["standard-dusk"].variants[mode].darkestPixel,
        );
      }
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

describe("resolveBackground — NULL -> default, none -> solid, slot -> the mode's variant", () => {
  it("a known slot resolves to the variant for the given mode (D-23)", () => {
    const r = resolveBackground("galaxy", "galaxy-aurora", "light");
    expect(r.kind).toBe("asset");
    if (r.kind === "asset") {
      const variant = BACKGROUND_SLOTS["galaxy-aurora"].variants.light;
      expect(r.slotId).toBe("galaxy-aurora");
      expect(r.mode).toBe("light");
      // Identity-equal: the resolver hands back the variant's own thunk.
      expect(r.source).toBe(variant.source);
      expect(r.brightestPixel).toBe(variant.brightestPixel);
      expect(r.darkestPixel).toBe(variant.darkestPixel);
    }
    const d = resolveBackground("galaxy", "galaxy-aurora", "dark");
    expect(d.kind).toBe("asset");
    if (d.kind === "asset") {
      expect(d.mode).toBe("dark");
      expect(d.source).toBe(
        BACKGROUND_SLOTS["galaxy-aurora"].variants.dark.source,
      );
    }
  });

  it("NULL resolves to the package default slot's variant for the mode", () => {
    for (const pkg of PACKAGES) {
      for (const mode of MODES) {
        const r = resolveBackground(pkg, null, mode);
        expect(r.kind).toBe("asset");
        if (r.kind === "asset") {
          const def = PACKAGE_DEFAULT_SLOT[pkg];
          expect(r.slotId).toBe(def);
          expect(r.mode).toBe(mode);
          expect(typeof r.source).toBe("function");
          expect(r.source).toBe(slotOf(def)?.variants[mode].source);
        }
      }
    }
  });

  it("'none' resolves to the solid theme background in both modes", () => {
    for (const pkg of PACKAGES) {
      for (const mode of MODES) {
        expect(resolveBackground(pkg, "none", mode)).toEqual({ kind: "solid" });
      }
    }
  });

  it("a known slot id resolves to its asset + the variant's declared brightest pixel", () => {
    for (const mode of MODES) {
      const r = resolveBackground("galaxy", "galaxy-nebula", mode);
      expect(r.kind).toBe("asset");
      if (r.kind === "asset") {
        expect(r.slotId).toBe("galaxy-nebula");
        expect(r.brightestPixel).toBe(
          BACKGROUND_SLOTS["galaxy-nebula"].variants[mode].brightestPixel,
        );
      }
    }
  });

  it("an unknown/tampered slot id falls back to the package default's variant in both modes (T-23-05b / T-38.5-02-01)", () => {
    const tampered = "totally-not-a-slot" as never;
    for (const pkg of PACKAGES) {
      for (const mode of MODES) {
        const r = resolveBackground(pkg, tampered, mode);
        expect(r.kind).toBe("asset");
        if (r.kind === "asset") {
          const def = PACKAGE_DEFAULT_SLOT[pkg];
          expect(r.slotId).toBe(def);
          expect(r.mode).toBe(mode);
          expect(r.source).toBe(slotOf(def)?.variants[mode].source);
        }
      }
    }
  });

  it("adjacency: resolving the SAME (package, slot, mode) twice is deterministic (no-op swap)", () => {
    // A same-selection re-resolve returns an equivalent descriptor — the pure-
    // function stand-in for BackgroundHost's no-flicker no-op (THEME-04 edge).
    const a = resolveBackground("galaxy", "galaxy-aurora", "dark");
    const b = resolveBackground("galaxy", "galaxy-aurora", "dark");
    expect(a.kind).toBe(b.kind);
    if (a.kind === "asset" && b.kind === "asset") {
      expect(a.slotId).toBe(b.slotId);
      expect(a.brightestPixel).toBe(b.brightestPixel);
    }
    // Solid is deep-equal across resolves.
    expect(resolveBackground("standard", "none", "light")).toEqual(
      resolveBackground("standard", "none", "light"),
    );
  });

  it("ordering edge: the resolved background is a function of (package, slot, mode) only, not selection order", () => {
    const direct = resolveBackground("standard", "standard-mesh", "light");
    const afterOthers = (() => {
      resolveBackground("standard", "standard-dawn", "dark");
      resolveBackground("standard", "none", "light");
      return resolveBackground("standard", "standard-mesh", "light");
    })();
    expect(direct).toEqual(afterOthers);
  });
});

describe("resolveRenderableBackground — onError -> None/Solid pure reducer (23-06 LOW)", () => {
  it("renderFailed=true returns None/Solid regardless of the stored slot and mode", () => {
    for (const pkg of PACKAGES) {
      for (const mode of MODES) {
        for (const slot of [
          null,
          "none",
          "galaxy-nebula",
          "standard-dawn",
        ] as const) {
          expect(
            resolveRenderableBackground(pkg, slot as never, mode, true),
          ).toEqual({
            kind: "solid",
          });
        }
      }
    }
  });

  it("renderFailed=false returns resolveBackground's result for the mode", () => {
    for (const pkg of PACKAGES) {
      for (const mode of MODES) {
        for (const slot of [null, "none", PACKAGE_DEFAULT_SLOT[pkg]] as const) {
          expect(
            resolveRenderableBackground(pkg, slot as never, mode, false),
          ).toEqual(resolveBackground(pkg, slot as never, mode));
        }
      }
    }
  });
});

/**
 * The owner-signed machine-readable block in 38.5-ART-SIGNOFF.md is the SINGLE
 * source of truth for `featureAllowance` (D-20, D-31, M-4). Parse it the way
 * `scripts/background_manifest.py` `parse_accepted_exclusions()` does: the one
 * fenced ```json block under "## Accepted exclusions (machine-readable)".
 */
const ART_SIGNOFF =
  ".planning/phases/38.5-background-art-text-contrast/38.5-ART-SIGNOFF.md";

interface SignedAllowance {
  slotId: string;
  mode: ResolvedMode;
  maxComponentPx: number;
  maxFailingPct: number;
  acceptedAt: string;
}

function readSignoffBlock(text: string): {
  allowances: SignedAllowance[];
  exclusions: unknown[];
} {
  const section = text.split("## Accepted exclusions (machine-readable)")[1];
  if (section === undefined) {
    throw new Error("ART-SIGNOFF has no machine-readable section");
  }
  const match = /```json\n([\s\S]*?)\n```/.exec(section);
  if (match === null) {
    throw new Error("ART-SIGNOFF machine-readable section has no json block");
  }
  return JSON.parse(match[1]);
}

/** The allowance map the manifest declares, keyed `slot/mode`. */
function manifestAllowances(): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const [id, slot] of Object.entries(BACKGROUND_SLOTS)) {
    for (const mode of MODES) {
      const a = slot.variants[mode].featureAllowance;
      if (a !== undefined) {
        out.set(`${id}/${mode}`, a);
      }
    }
  }
  return out;
}

/** The allowance map the signed block records, keyed `slot/mode`. */
function signedAllowances(text: string): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const a of readSignoffBlock(text).allowances) {
    out.set(`${a.slotId}/${a.mode}`, {
      maxComponentPx: a.maxComponentPx,
      maxFailingPct: a.maxFailingPct,
      acceptedAt: a.acceptedAt,
    });
  }
  return out;
}

describe("the owner-approved lineup (38.5 D-17 / D-18 / D-19 / D-30 / D-33)", () => {
  it("Galaxy defaults to the new quiet slot, Standard to Dawn", () => {
    expect(PACKAGE_DEFAULT_SLOT.galaxy).toBe("galaxy-quiet");
    expect(PACKAGE_DEFAULT_SLOT.standard).toBe("standard-dawn");
  });

  it("stored NULL on Galaxy renders galaxy-quiet's variant for the mode", () => {
    for (const mode of MODES) {
      const r = resolveBackground("galaxy", null, mode);
      expect(r.kind).toBe("asset");
      if (r.kind === "asset") {
        expect(r.slotId).toBe("galaxy-quiet");
        expect(r.source).toBe(
          BACKGROUND_SLOTS["galaxy-quiet"].variants[mode].source,
        );
      }
    }
  });

  it("every approved slot wires <slot>-light.webp and <slot>-dark.webp, a different file per mode", () => {
    const approved = [
      "galaxy-quiet",
      "galaxy-aurora",
      "galaxy-starfield",
      "standard-dawn",
      "standard-paper",
      "standard-dusk",
    ] as const;
    for (const id of approved) {
      const light = resolveBackground(slotOf(id)!.package, id, "light");
      const dark = resolveBackground(slotOf(id)!.package, id, "dark");
      expect(light.kind).toBe("asset");
      expect(dark.kind).toBe("asset");
      if (light.kind === "asset" && dark.kind === "asset") {
        expect(light.source).not.toBe(dark.source);
        // The thunk is never invoked in node; its text names the bundled file.
        expect(String(light.source), id).toContain(`${id}-light.webp`);
        expect(String(dark.source), id).toContain(`${id}-dark.webp`);
      }
    }
  });

  it("Galaxy's picker order is quiet (default), Aurora, Starfield, then the None tile", () => {
    const galaxy = BACKGROUND_ORDER.galaxy.filter((id) =>
      ["galaxy-quiet", "galaxy-aurora", "galaxy-starfield", "none"].includes(id),
    );
    expect(galaxy).toEqual([
      "galaxy-quiet",
      "galaxy-aurora",
      "galaxy-starfield",
      NONE_SLOT_ID,
    ]);
    expect(BACKGROUND_ORDER.galaxy[0]).toBe("galaxy-quiet");
    const standard = BACKGROUND_ORDER.standard.filter((id) =>
      ["standard-dawn", "standard-paper", "standard-dusk", "none"].includes(id),
    );
    expect(standard).toEqual([
      "standard-dawn",
      "standard-paper",
      "standard-dusk",
      NONE_SLOT_ID,
    ]);
  });
});

describe("featureAllowance ⇄ 38.5-ART-SIGNOFF.md machine-readable block (M-4)", () => {
  it("every variant's featureAllowance equals its signed allowance exactly; no unsigned variant has one", () => {
    const signed = signedAllowances(readFileSync(ART_SIGNOFF, "utf8"));
    expect(signed.size).toBeGreaterThan(0);
    expect(manifestAllowances()).toEqual(signed);
  });

  it("the sync guard detects an edited signed number (mutation fixture)", () => {
    const text = readFileSync(ART_SIGNOFF, "utf8").replace(
      '"maxComponentPx": 18',
      '"maxComponentPx": 19',
    );
    expect(manifestAllowances()).not.toEqual(signedAllowances(text));
  });
});
