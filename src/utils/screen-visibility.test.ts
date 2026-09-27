/**
 * Shared screen-visibility predicates (38.3 review A-WR-01 precedent;
 * 38.3 VERIFICATION W2; 38.4 D-10).
 *
 * Proves: a screen is foreground-visible only when it is the focused route AND
 * the app is not backgrounded; `inactive` (a transient overlay, no resume sweep
 * after it) still counts as visible; and `isAppBackgrounded` is true for the
 * `background` state only.
 */
import { describe, expect, it } from "vitest";
import {
  isAppBackgrounded,
  isForegroundVisible,
} from "@/utils/screen-visibility";

describe("isForegroundVisible", () => {
  it("is visible when focused and active", () => {
    expect(isForegroundVisible(true, "active")).toBe(true);
  });

  it("treats inactive as visible (transient overlay, not the background)", () => {
    expect(isForegroundVisible(true, "inactive")).toBe(true);
  });

  it("is hidden while backgrounded even with the route still focused", () => {
    expect(isForegroundVisible(true, "background")).toBe(false);
  });

  it("is hidden when the route is not focused, whatever the app state", () => {
    expect(isForegroundVisible(false, "active")).toBe(false);
    expect(isForegroundVisible(false, "inactive")).toBe(false);
    expect(isForegroundVisible(false, "background")).toBe(false);
  });

  it("treats an unknown (null/undefined) app state as not backgrounded", () => {
    expect(isForegroundVisible(true, null)).toBe(true);
    expect(isForegroundVisible(true, undefined)).toBe(true);
  });
});

describe("isAppBackgrounded", () => {
  it("is true only for the background state", () => {
    expect(isAppBackgrounded("background")).toBe(true);
    expect(isAppBackgrounded("active")).toBe(false);
    expect(isAppBackgrounded("inactive")).toBe(false);
    expect(isAppBackgrounded(null)).toBe(false);
    expect(isAppBackgrounded(undefined)).toBe(false);
  });
});
