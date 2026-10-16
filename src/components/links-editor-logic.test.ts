import { describe, expect, it } from "vitest";
import { buildLinksForDiff } from "@/screens/contact-link-drafts";
import {
  LINK_MISSING_URL_CAPTION,
  linkRowMissingUrl,
} from "./links-editor-logic";

/**
 * 38.11 D-88 (review WR-04): a link row with a label but no URL warns, on Add
 * and Edit alike (both mount LinksEditor). Warn only: Save is never blocked,
 * and the row is still dropped by `buildLinksForDiff`.
 */
describe("link row missing its URL (D-88)", () => {
  it("uses the owner's exact caption", () => {
    expect(LINK_MISSING_URL_CAPTION).toBe(
      "Add a link or this row won't be saved.",
    );
  });

  it("warns on a label with no URL, including a whitespace-only URL", () => {
    expect(linkRowMissingUrl({ url: "", label: "Instagram" })).toBe(true);
    expect(linkRowMissingUrl({ url: "   ", label: "Instagram" })).toBe(true);
  });

  it("stays quiet on an untouched row, a blank label, or a row with a URL", () => {
    expect(linkRowMissingUrl({ url: "", label: null })).toBe(false);
    expect(linkRowMissingUrl({ url: "", label: "   " })).toBe(false);
    expect(linkRowMissingUrl({ url: "example.com", label: "Site" })).toBe(
      false,
    );
    expect(linkRowMissingUrl({ url: "example.com", label: null })).toBe(false);
  });

  it("matches exactly the rows the save drops that the user typed into", () => {
    const rows = [
      { uid: "a", url: "", label: "Instagram" },
      { uid: "b", url: "example.com", label: "Site" },
      { uid: "c", url: "", label: null },
    ];
    const saved = new Set(buildLinksForDiff(rows).map((l) => l.uid));
    for (const row of rows) {
      if (linkRowMissingUrl(row)) expect(saved.has(row.uid)).toBe(false);
    }
    expect([...saved]).toEqual(["b"]);
  });
});
