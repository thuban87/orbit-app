/**
 * Shared link-draft shaping (38.11 D-48): Add and Edit shape the LinksEditor
 * draft identically — trimmed url/label, empty label → null, blank-url rows
 * dropped, order kept, ids carried through for Edit's diff.
 */
import { describe, expect, it } from "vitest";
import { buildLinksForDiff } from "./contact-link-drafts";

describe("buildLinksForDiff", () => {
  it("trims url and label and keeps order", () => {
    expect(
      buildLinksForDiff([
        { uid: "a", url: "  https://a.example  ", label: "  Site  " },
        { uid: "b", url: "b.example", label: "Blog" },
      ]),
    ).toEqual([
      { id: undefined, uid: "a", url: "https://a.example", label: "Site" },
      { id: undefined, uid: "b", url: "b.example", label: "Blog" },
    ]);
  });

  it("turns an empty or whitespace label into null", () => {
    const shaped = buildLinksForDiff([
      { uid: "a", url: "https://a.example", label: "" },
      { uid: "b", url: "https://b.example", label: "   " },
      { uid: "c", url: "https://c.example", label: null },
    ]);
    expect(shaped.map((l) => l.label)).toEqual([null, null, null]);
  });

  it("drops blank-url rows, including a cleared existing (id-bearing) row", () => {
    const shaped = buildLinksForDiff([
      { uid: "new-blank", url: "", label: "orphan label" },
      { id: 7, uid: "seeded", url: "   ", label: "cleared" },
      { id: 8, uid: "kept", url: "https://kept.example", label: null },
    ]);
    expect(shaped).toEqual([
      { id: 8, uid: "kept", url: "https://kept.example", label: null },
    ]);
  });

  it("an empty draft shapes to an empty list", () => {
    expect(buildLinksForDiff([])).toEqual([]);
  });
});
