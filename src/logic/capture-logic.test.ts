/**
 * Pure share-payload resolver — proof (CAP-02 / CAP-03).
 *
 * resolveCapturePayload(input) maps an incoming share payload to a fuel row's
 * `{ displayText, url }` and recomposes the display text when the user adds an
 * optional note (the `note — base` composition). EXPLICIT precedence, proven
 * off-device (RESEARCH §Q6):
 *   - base label = first non-blank of `title` (EXTRA_SUBJECT) then `text` (prose /
 *     bare-URL fallback);
 *   - `url` = `webUrl ?? null` — ALWAYS the canonical first-http match, NEVER
 *     derived from or overwritten by prose/title/note;
 *   - a non-blank note leads: `note — base`; the base is NEVER discarded;
 *   - blank / whitespace-only display text normalizes to null at the boundary
 *     (fuel-read's RANKED_FUEL_EXCLUSIONS drops blank text in-query).
 */
import { describe, expect, it } from "vitest";
import { resolveCapturePayload } from "@/logic/capture-logic";

describe("resolveCapturePayload — CAP-03 payload → { displayText, url } (Task 1)", () => {
  it("bare URL + EXTRA_SUBJECT title (Chrome) → title is the display text, url is the URL", () => {
    expect(
      resolveCapturePayload({
        text: "https://x.com/a",
        webUrl: "https://x.com/a",
        title: "Page Title",
      }),
    ).toEqual({ displayText: "Page Title", url: "https://x.com/a" });
  });

  it("bare URL, no title → the bare URL is the display text (fallback), url is the URL", () => {
    expect(
      resolveCapturePayload({
        text: "https://x.com/a",
        webUrl: "https://x.com/a",
      }),
    ).toEqual({ displayText: "https://x.com/a", url: "https://x.com/a" });
  });

  it("plain text selection → the text is the display text, url is null", () => {
    expect(
      resolveCapturePayload({ text: "call the plumber", webUrl: null }),
    ).toEqual({ displayText: "call the plumber", url: null });
  });

  it("prose containing a URL → the whole prose is the display text, url is the first http match", () => {
    expect(
      resolveCapturePayload({
        text: "great read https://x.com/a about foo",
        webUrl: "https://x.com/a",
      }),
    ).toEqual({
      displayText: "great read https://x.com/a about foo",
      url: "https://x.com/a",
    });
  });

  it("multi-URL prose → only the FIRST http match lands in url; the whole prose stays the display text", () => {
    expect(
      resolveCapturePayload({
        text: "compare https://a.com/1 and https://b.com/2",
        webUrl: "https://a.com/1",
      }),
    ).toEqual({
      displayText: "compare https://a.com/1 and https://b.com/2",
      url: "https://a.com/1",
    });
  });

  it("whitespace-only text, no title → displayText null, url null (empty-payload defensive case)", () => {
    expect(resolveCapturePayload({ text: "   ", webUrl: null })).toEqual({
      displayText: null,
      url: null,
    });
  });

  it("extended-whitespace text (tab/VT/FF/NBSP) → displayText null (mirrors the fuel-read TRIM set)", () => {
    expect(resolveCapturePayload({ text: "\t ", webUrl: null })).toEqual({
      displayText: null,
      url: null,
    });
  });

  it("title present but blank → falls back to the text as the base", () => {
    expect(
      resolveCapturePayload({ text: "the prose", webUrl: null, title: "   " }),
    ).toEqual({ displayText: "the prose", url: null });
  });

  it("url is always webUrl ?? null — never derived from the title", () => {
    expect(
      resolveCapturePayload({
        text: "https://x.com/a",
        webUrl: null,
        title: "Page Title",
      }),
    ).toEqual({ displayText: "Page Title", url: null });
  });

  it("is pure — same inputs yield a deep-equal output, never throws", () => {
    const input = { text: "call the plumber", webUrl: null };
    expect(resolveCapturePayload(input)).toEqual(resolveCapturePayload(input));
  });
});

describe("resolveCapturePayload — CAP-03 note composition `note — base` (Task 2, A5)", () => {
  it("note + title (base = title) → `note — title`, note leads, url unchanged", () => {
    expect(
      resolveCapturePayload({
        text: "https://x/a",
        webUrl: "https://x/a",
        title: "Page Title",
        note: "for Dad, he asked about this",
      }),
    ).toEqual({
      displayText: "for Dad, he asked about this — Page Title",
      url: "https://x/a",
    });
  });

  it("note + plain text (base = the prose) → base survives, note leads, url null [A5]", () => {
    expect(
      resolveCapturePayload({
        text: "the prose",
        webUrl: null,
        note: "my words",
      }),
    ).toEqual({ displayText: "my words — the prose", url: null });
  });

  it("note + bare URL, no title (base = the bare URL) → base survives as the URL, url stays canonical [A5]", () => {
    expect(
      resolveCapturePayload({
        text: "https://x/a",
        webUrl: "https://x/a",
        note: "read this",
      }),
    ).toEqual({ displayText: "read this — https://x/a", url: "https://x/a" });
  });

  it("note-only = NO base present (empty text, no title) → note alone, no trailing separator", () => {
    expect(
      resolveCapturePayload({ text: "", webUrl: null, note: "just my note" }),
    ).toEqual({ displayText: "just my note", url: null });
  });

  it("label-only (no note) → base unchanged from Task 1", () => {
    expect(
      resolveCapturePayload({
        text: "https://x/a",
        webUrl: "https://x/a",
        title: "T",
      }),
    ).toEqual({ displayText: "T", url: "https://x/a" });
  });

  it("note containing an embedded ` — ` → preserved verbatim, no special handling", () => {
    expect(
      resolveCapturePayload({ text: "", webUrl: null, note: "a — b — c" }),
    ).toEqual({
      displayText: "a — b — c",
      url: null,
    });
  });

  it("whitespace-only note → treated as absent, falls back to the base (base NOT dropped)", () => {
    expect(
      resolveCapturePayload({
        text: "the prose",
        webUrl: null,
        note: "   ",
      }),
    ).toEqual({ displayText: "the prose", url: null });
  });

  it("extended-whitespace note (tab/NBSP) → treated as absent, base survives", () => {
    expect(
      resolveCapturePayload({
        text: "https://x/a",
        webUrl: "https://x/a",
        title: "Page Title",
        note: "\t ",
      }),
    ).toEqual({ displayText: "Page Title", url: "https://x/a" });
  });

  it("note over a whitespace-only text with a title → note leads the title (empty text is not the base)", () => {
    expect(
      resolveCapturePayload({
        text: "   ",
        webUrl: null,
        title: "Page Title",
        note: "my note",
      }),
    ).toEqual({ displayText: "my note — Page Title", url: null });
  });

  it("note never derives or overwrites url — a note over prose-with-URL keeps the first http match", () => {
    expect(
      resolveCapturePayload({
        text: "great read https://x.com/a about foo",
        webUrl: "https://x.com/a",
        note: "worth a look",
      }),
    ).toEqual({
      displayText: "worth a look — great read https://x.com/a about foo",
      url: "https://x.com/a",
    });
  });
});
