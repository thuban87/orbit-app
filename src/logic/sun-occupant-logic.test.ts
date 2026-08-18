/**
 * sun-occupant-logic — proof (ORR-05/ORR-06, A7, C2-2).
 *
 * Locks the pure sun resolver: NULL→self (selfSunColour ?? starPalette[0]), a
 * live contact→its STATUS glow, a never-contacted contact (status null)→the
 * NEUTRAL border glow reused from orrery-ring-logic (no invented colour), and an
 * archived OR missing occupant→self (A7 — the sun never glows a hidden contact).
 *
 * C2-3 gate-safety: the palette input is sourced from THEME_PRESETS (this test is
 * under /logic/, NOT check:colors-exempt) — never an inline hex fake palette.
 */
import { THEME_PRESETS } from "@/theme/theme-presets";
import { describe, expect, it } from "vitest";
import { orreryRingStyle } from "./orrery-ring-logic";
import { resolveSunOccupant } from "./sun-occupant-logic";

const colors = THEME_PRESETS["space-dark"].dark;
const starPalette = colors.starPalette;
// A "picked" self-sun colour, sourced from the palette (not index 0, so it is
// distinct from the gold default) — keeps the test hex-literal-free (C2-3).
const PICKED = starPalette[3];

const base = {
  starPalette,
  selfPhoto: "file:///self.jpg" as string | null,
  colors,
};

describe("resolveSunOccupant", () => {
  it("NULL sun → self, glow = the picked selfSunColour", () => {
    const out = resolveSunOccupant({
      ...base,
      sunContactId: null,
      selfSunColour: PICKED,
      occupant: null,
    });
    expect(out.kind).toBe("self");
    expect(out.glowColor).toBe(PICKED);
    expect(out.photo).toBe("file:///self.jpg");
  });

  it("NULL sun + NULL selfSunColour → self, glow = starPalette[0] (gold default, resolved at read)", () => {
    const out = resolveSunOccupant({
      ...base,
      sunContactId: null,
      selfSunColour: null,
      occupant: null,
    });
    expect(out.kind).toBe("self");
    expect(out.glowColor).toBe(starPalette[0]);
  });

  it("live, contacted contact → contact, glow = its STATUS colour (user's star pick is self-only)", () => {
    const out = resolveSunOccupant({
      ...base,
      sunContactId: 5,
      selfSunColour: PICKED,
      occupant: { photo: "file:///c5.jpg", status: "wobble", archived: false },
    });
    expect(out.kind).toBe("contact");
    expect(out).toMatchObject({ contactId: 5, photo: "file:///c5.jpg" });
    expect(out.glowColor).toBe(colors.statusWobble);
    // The self star pick does NOT apply to a contact-sun.
    expect(out.glowColor).not.toBe(PICKED);
  });

  it("never-contacted contact (status null, C2-2) → contact, glow = the NEUTRAL border colour reused from orrery-ring-logic", () => {
    const out = resolveSunOccupant({
      ...base,
      sunContactId: 7,
      selfSunColour: null,
      occupant: { photo: "file:///c7.jpg", status: null, archived: false },
    });
    expect(out.kind).toBe("contact");
    expect(out.glowColor).toBe(orreryRingStyle(null, colors).color);
    expect(out.glowColor).toBe(colors.border);
    // Not a new colour, not starPalette[0].
    expect(out.glowColor).not.toBe(starPalette[0]);
  });

  it("archived contact → self (A7 — never glow a hidden contact)", () => {
    const out = resolveSunOccupant({
      ...base,
      sunContactId: 9,
      selfSunColour: PICKED,
      occupant: { photo: "file:///c9.jpg", status: "stable", archived: true },
    });
    expect(out.kind).toBe("self");
    expect(out.glowColor).toBe(PICKED);
    expect(out.photo).toBe("file:///self.jpg");
  });

  it("missing/unknown contact id (occupant null) → self", () => {
    const out = resolveSunOccupant({
      ...base,
      sunContactId: 11,
      selfSunColour: null,
      occupant: null,
    });
    expect(out.kind).toBe("self");
    expect(out.glowColor).toBe(starPalette[0]);
  });
});
