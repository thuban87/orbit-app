import { describe, expect, it } from "vitest";
import { reconcileSourceLabels } from "./reconcile-source-label";

describe("reconcileSourceLabels", () => {
  it("names each linked source by its phone contact", () => {
    expect(
      reconcileSourceLabels([
        { displayName: "Ada Lovelace" },
        { displayName: "Ada L." },
      ]),
    ).toEqual(["Phone contact “Ada Lovelace”", "Phone contact “Ada L.”"]);
  });

  it("numbers duplicate names and falls back when a source has no name", () => {
    expect(
      reconcileSourceLabels([
        { displayName: "Ada" },
        { displayName: null },
        { displayName: " Ada " },
      ]),
    ).toEqual([
      "Phone contact “Ada” (1)",
      "Phone contact",
      "Phone contact “Ada” (2)",
    ]);
  });
});
