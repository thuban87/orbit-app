import { expect, it, vi } from "vitest";
import { publishCommittedRestore } from "@/services/backup/restore-completion";
import type { ThemeSelection } from "@/theme/theme-types";

const local: ThemeSelection = {
  package: "standard",
  galaxyMode: "system",
  standardMode: "light",
  galaxyAccent: null,
  standardAccent: null,
  galaxyBackground: null,
  standardBackground: null,
};
const incoming: ThemeSelection = {
  ...local,
  package: "galaxy",
  galaxyMode: "dark",
};

it.each([local, incoming])(
  "publishes the committed theme selection %#",
  async (settings) => {
    const hydrate = vi.fn();
    await publishCommittedRestore({
      readSettings: async () => ({
        themePackage: settings.package,
        galaxyMode: settings.galaxyMode,
        standardMode: settings.standardMode,
        galaxyAccent: settings.galaxyAccent,
        standardAccent: settings.standardAccent,
        galaxyBackground: settings.galaxyBackground,
        standardBackground: settings.standardBackground,
      }),
      hydrate,
    });
    expect(hydrate).toHaveBeenCalledExactlyOnceWith(settings);
  },
);

it("does not publish when the committed settings read fails", async () => {
  const hydrate = vi.fn();
  await expect(
    publishCommittedRestore({
      readSettings: async () => {
        throw new Error("read failed");
      },
      hydrate,
    }),
  ).resolves.toBeUndefined();
  expect(hydrate).not.toHaveBeenCalled();
});

it("a hydration failure does not reject a committed restore", async () => {
  await expect(
    publishCommittedRestore({
      readSettings: async () => ({
        themePackage: incoming.package,
        galaxyMode: incoming.galaxyMode,
        standardMode: incoming.standardMode,
        galaxyAccent: incoming.galaxyAccent,
        standardAccent: incoming.standardAccent,
        galaxyBackground: incoming.galaxyBackground,
        standardBackground: incoming.standardBackground,
      }),
      hydrate: () => {
        throw new Error("store failed");
      },
    }),
  ).resolves.toBeUndefined();
});
