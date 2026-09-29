import { beforeEach, describe, expect, it } from "vitest";
import { useThemeStore } from "./theme-store";

beforeEach(() => {
  useThemeStore.setState({
    package: "galaxy",
    galaxyMode: "dark",
    standardMode: "light",
    galaxyAccent: "solar-amber",
    standardAccent: "slate-indigo",
    galaxyBackground: "galaxy-starfield",
    standardBackground: "standard-dawn",
  });
});

describe("setBackgroundForActivePackage", () => {
  it("writes only Galaxy's remembered background", () => {
    useThemeStore.getState().setBackgroundForActivePackage("galaxy-aurora");

    expect(useThemeStore.getState()).toMatchObject({
      galaxyBackground: "galaxy-aurora",
      standardBackground: "standard-dawn",
      galaxyMode: "dark",
      standardMode: "light",
      galaxyAccent: "solar-amber",
      standardAccent: "slate-indigo",
    });
  });

  it("writes only Standard's remembered background", () => {
    useThemeStore.setState({ package: "standard" });
    useThemeStore.getState().setBackgroundForActivePackage("standard-dusk");

    expect(useThemeStore.getState()).toMatchObject({
      galaxyBackground: "galaxy-starfield",
      standardBackground: "standard-dusk",
      galaxyMode: "dark",
      standardMode: "light",
      galaxyAccent: "solar-amber",
      standardAccent: "slate-indigo",
    });
  });

  it.each(["galaxy", "standard"] as const)(
    "accepts null for %s to restore the package default",
    (themePackage) => {
      useThemeStore.setState({ package: themePackage });
      useThemeStore.getState().setBackgroundForActivePackage(null);

      expect(useThemeStore.getState()).toMatchObject(
        themePackage === "galaxy"
          ? {
              galaxyBackground: null,
              standardBackground: "standard-dawn",
            }
          : {
              galaxyBackground: "galaxy-starfield",
              standardBackground: null,
            },
      );
    },
  );
});

describe("retired stored background ids (38.5 D-19 / P-4)", () => {
  it("hydrate keeps a retired stored id unchanged (the resolver, not the store, maps it)", () => {
    useThemeStore.getState().hydrate({
      package: "galaxy",
      galaxyMode: "dark",
      standardMode: "light",
      galaxyAccent: null,
      standardAccent: null,
      galaxyBackground: "galaxy-nebula",
      standardBackground: "standard-mesh",
    });
    expect(useThemeStore.getState()).toMatchObject({
      galaxyBackground: "galaxy-nebula",
      standardBackground: "standard-mesh",
    });
  });
});
