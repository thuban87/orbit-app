/**
 * fonts — the non-fatal font-load contract (THEME-07 / REVIEWS 23-02 MEDIUM).
 *
 * `loadAppFonts()` MUST resolve even when the underlying font load rejects, so a
 * font error degrades to the system font and never reaches AppShell's boot catch
 * or blocks the ready gate. Proven here with an injected loader — no react-native
 * and no `.ttf` require is evaluated (device-only paths stay out of the node run).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { Logger } from "@/utils/logger";
import { loadAppFonts } from "./fonts";

describe("loadAppFonts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves when the underlying font load succeeds", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    await expect(loadAppFonts(load)).resolves.toBeUndefined();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("resolves (non-fatal) when the underlying font load REJECTS", async () => {
    // Silence the expected error log so the test output stays clean.
    const errorSpy = vi.spyOn(Logger, "error").mockImplementation(() => {});
    const load = vi.fn().mockRejectedValue(new Error("font asset missing"));

    // The contract: it degrades, never throws.
    await expect(loadAppFonts(load)).resolves.toBeUndefined();
    expect(load).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("resolves when the loader throws synchronously", async () => {
    vi.spyOn(Logger, "error").mockImplementation(() => {});
    const load = vi.fn(() => {
      throw new Error("sync boom");
    });
    await expect(loadAppFonts(load)).resolves.toBeUndefined();
  });
});
