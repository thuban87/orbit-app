import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/photos/photo-storage", () => ({
  resolvePhotoDisplayUri: (relative: string, revision: number | undefined) =>
    revision === undefined
      ? `file:///doc/${relative}`
      : `file:///doc/${relative}?v=${revision}`,
  resolvePhotoUri: (relative: string) => `file:///doc/${relative}`,
}));

import { bumpPhotoCacheBust } from "@/stores/photo-cache-bust-store";
import {
  getPhotoDisplay,
  PHOTO_DISPLAY_STRATEGY,
  photoDisplayFor,
} from "./photo-display";

const rel = "avatars/contact-1.jpg";
const resolvers = {
  display: (relative: string, revision: number | undefined) =>
    revision === undefined
      ? `file:///doc/${relative}`
      : `file:///doc/${relative}?v=${revision}`,
  plain: (relative: string) => `file:///doc/${relative}`,
};

describe("photoDisplayFor", () => {
  it("revision-query carries the revision in the URI with a memory-only cache", () => {
    const display = photoDisplayFor(rel, 2, "revision-query", resolvers);
    expect(display.source.uri.endsWith("?v=2")).toBe(true);
    expect(display.source.cacheKey).toBeUndefined();
    expect(display.cachePolicy).toBe("memory");
    expect(display.revision).toBe(2);
  });

  it("revision-query with no revision is the bare path, revision 0", () => {
    const display = photoDisplayFor(
      rel,
      undefined,
      "revision-query",
      resolvers,
    );
    expect(display.source).toEqual({
      uri: "file:///doc/avatars/contact-1.jpg",
    });
    expect(display.revision).toBe(0);
  });

  it("no-cache uses the plain URI, a revision cacheKey and caching off", () => {
    const display = photoDisplayFor(rel, undefined, "no-cache", resolvers);
    expect(display.source).toEqual({
      uri: "file:///doc/avatars/contact-1.jpg",
      cacheKey: `${rel}#0`,
    });
    expect(display.cachePolicy).toBe("none");
    expect(display.revision).toBe(0);
  });
});

describe("getPhotoDisplay", () => {
  it("is null for a photo-less path", () => {
    expect(getPhotoDisplay(null)).toBeNull();
    expect(getPhotoDisplay("")).toBeNull();
  });

  it("increases the revision by exactly one after a bump", () => {
    const before = getPhotoDisplay(rel)!.revision;
    bumpPhotoCacheBust(rel);
    const after = getPhotoDisplay(rel)!;
    expect(after.revision).toBe(before + 1);
    if (PHOTO_DISPLAY_STRATEGY === "revision-query") {
      expect(after.source.uri).toBe(
        `file:///doc/avatars/contact-1.jpg?v=${after.revision}`,
      );
    }
  });
});
