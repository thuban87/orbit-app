/**
 * PhotoLightbox pure math (38.6 D-16): zoom clamps, pan bounds, focal-point
 * zoom, double-tap toggle and swipe-down dismissal.
 */
import { describe, expect, it } from "vitest";
import {
  clampScale,
  clampTranslate,
  dismissProgress,
  doubleTapTarget,
  focalTranslate,
  LIGHTBOX_DISMISS_DISTANCE,
  LIGHTBOX_DISMISS_VELOCITY,
  LIGHTBOX_DOUBLE_TAP_SCALE,
  LIGHTBOX_MAX_ZOOM,
  LIGHTBOX_SCRIM_OPACITY,
  lightboxScrimOpacity,
  maxTranslate,
  shouldDismiss,
} from "./photo-lightbox-logic";

describe("lightbox tunables", () => {
  it("keeps the scrim near-opaque (D-16)", () => {
    expect(LIGHTBOX_SCRIM_OPACITY).toBeGreaterThan(0.9);
    expect(LIGHTBOX_SCRIM_OPACITY).toBeLessThan(1);
  });

  it("zooms at most 4× and double-taps to a scale inside that range", () => {
    expect(LIGHTBOX_MAX_ZOOM).toBe(4);
    expect(LIGHTBOX_DOUBLE_TAP_SCALE).toBeGreaterThan(1);
    expect(LIGHTBOX_DOUBLE_TAP_SCALE).toBeLessThanOrEqual(LIGHTBOX_MAX_ZOOM);
  });
});

describe("clampScale", () => {
  it("clamps to [1, LIGHTBOX_MAX_ZOOM]", () => {
    expect(clampScale(0.5)).toBe(1);
    expect(clampScale(10)).toBe(LIGHTBOX_MAX_ZOOM);
    expect(clampScale(2)).toBe(2);
  });

  it("treats a non-finite scale as 1×", () => {
    expect(clampScale(Number.NaN)).toBe(1);
  });
});

describe("pan bounds", () => {
  it("allows no pan at 1× and half the overflow when zoomed", () => {
    expect(maxTranslate(400, 1, 400)).toBe(0);
    expect(maxTranslate(400, 2, 400)).toBe(200);
  });

  it("clamps a translation to the image edges", () => {
    expect(clampTranslate(500, 400, 2, 400)).toBe(200);
    expect(clampTranslate(-500, 400, 2, 400)).toBe(-200);
    expect(clampTranslate(50, 400, 2, 400)).toBe(50);
    expect(clampTranslate(50, 400, 1, 400)).toBe(0);
  });
});

describe("focalTranslate", () => {
  it("keeps the focal point fixed while zooming", () => {
    // Zooming 1→2 about a point 100 px right of centre from t=0 shifts left 100.
    expect(focalTranslate(0, 100, 1, 2)).toBe(-100);
    // The image point under the focus stays under it: (f - t) / s is invariant.
    const t = focalTranslate(-100, 100, 2, 3);
    expect((100 - t) / 3).toBeCloseTo((100 - -100) / 2);
  });
});

describe("doubleTapTarget", () => {
  it("zooms in from 1× and returns to 1× when zoomed", () => {
    expect(doubleTapTarget(1)).toBe(LIGHTBOX_DOUBLE_TAP_SCALE);
    expect(doubleTapTarget(2.5)).toBe(1);
  });
});

describe("swipe-down dismissal", () => {
  it("dismisses at 1× by distance or downward velocity, never while zoomed", () => {
    expect(shouldDismiss(1, LIGHTBOX_DISMISS_DISTANCE + 1, 0)).toBe(true);
    expect(shouldDismiss(1, 10, LIGHTBOX_DISMISS_VELOCITY + 1)).toBe(true);
    expect(shouldDismiss(1, 10, 10)).toBe(false);
    expect(shouldDismiss(2, 500, 5000)).toBe(false);
  });

  it("maps the drag to a [0, 1] progress", () => {
    expect(dismissProgress(0)).toBe(0);
    expect(dismissProgress(LIGHTBOX_DISMISS_DISTANCE * 2)).toBe(1);
    expect(dismissProgress(-40)).toBe(0);
    expect(dismissProgress(LIGHTBOX_DISMISS_DISTANCE / 2)).toBeCloseTo(0.5);
  });

  it("fades the scrim from its resting opacity and never below 0", () => {
    expect(lightboxScrimOpacity(0)).toBe(LIGHTBOX_SCRIM_OPACITY);
    expect(lightboxScrimOpacity(0.5)).toBeLessThan(LIGHTBOX_SCRIM_OPACITY);
    expect(lightboxScrimOpacity(1)).toBeGreaterThanOrEqual(0);
    expect(lightboxScrimOpacity(1)).toBeLessThan(lightboxScrimOpacity(0.5));
  });
});
