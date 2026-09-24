import { describe, expect, it, vi } from "vitest";
import { runBootstrapSequence } from "./bootstrap-sequence";

function deps() {
  const order: string[] = [];
  return {
    order,
    openAndMigrate: vi.fn(async () => {
      order.push("migrate");
    }),
    hydrateThemeAtBoot: vi.fn(async () => {
      order.push("theme");
      return { theme: "saved" };
    }),
    loadAppFonts: vi.fn(async () => {
      order.push("fonts");
    }),
    reconcileBackgrounds: vi.fn(async () => {
      order.push("reconcile");
      return { failed: 0 };
    }),
  };
}

describe("runBootstrapSequence", () => {
  it.each(["reject", "partial"])(
    "reaches ready after %s image recovery",
    async (failure) => {
      const input = deps();
      input.reconcileBackgrounds = vi.fn(async () => {
        if (failure === "reject") throw new Error("image failure");
        return { failed: 1 };
      });
      await expect(runBootstrapSequence(input)).resolves.toEqual({
        theme: "saved",
      });
      expect(input.order[0]).toBe("migrate");
    },
  );

  it("fails closed on migration rejection without starting other work", async () => {
    const input = deps();
    const failure = new Error("migration 006 integrity");
    input.openAndMigrate = vi.fn(async () => {
      throw failure;
    });
    await expect(runBootstrapSequence(input)).rejects.toBe(failure);
    expect(input.hydrateThemeAtBoot).not.toHaveBeenCalled();
    expect(input.reconcileBackgrounds).not.toHaveBeenCalled();
  });

  it("fails closed on theme hydration rejection", async () => {
    const input = deps();
    const failure = new Error("theme settings failed");
    input.hydrateThemeAtBoot = vi.fn(async () => {
      throw failure;
    });
    await expect(runBootstrapSequence(input)).rejects.toBe(failure);
  });
});
