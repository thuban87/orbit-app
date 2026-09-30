import { describe, expect, it, vi } from "vitest";

// The resolvers keep the real guard: an unsafe path throws, as on device.
vi.mock("@/services/photos/photo-storage", async () => {
  const { assertSafeRelative } = await import("@/db/photo-relative-path");
  return {
    resolvePhotoDisplayUri: (
      relative: string,
      revision: number | undefined,
    ) => {
      assertSafeRelative(relative);
      return revision === undefined
        ? `file:///doc/${relative}`
        : `file:///doc/${relative}?v=${revision}`;
    },
    resolvePhotoUri: (relative: string) => {
      assertSafeRelative(relative);
      return `file:///doc/${relative}`;
    },
  };
});
// Run the hook inline (no renderer): useMemo computes, the store read is plain.
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useMemo: (factory: () => unknown) => factory(),
}));
vi.mock("@/stores/photo-cache-bust-store", async (original) => {
  const actual =
    await original<typeof import("@/stores/photo-cache-bust-store")>();
  return {
    ...actual,
    usePhotoCacheBust: (relPath: string | null) =>
      actual.getPhotoCacheBust(relPath),
  };
});

import {
  isStoredPhotoPath,
  isUnusablePhotoReference,
} from "@/db/photo-relative-path";
import { bumpPhotoCacheBust } from "@/stores/photo-cache-bust-store";
import {
  getPhotoDisplay,
  PHOTO_DISPLAY_STRATEGY,
  photoDisplayFor,
  usePhotoDisplay,
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

// 38.6 D-34: a value that is not a stored photo path (text left in a custom
// photo field) is "no image", never a render-time throw.
const NOT_PATHS = [
  "Rex",
  " ",
  "/photos/pet.jpg",
  "file:///doc/avatars/contact-1.jpg",
  "avatars/../secret.jpg",
  "avatars/contact-1.gif",
  "avatars/contact-1.jpg\0",
];

describe("non-path photo values (D-34)", () => {
  it("getPhotoDisplay returns null instead of throwing", () => {
    for (const value of NOT_PATHS) {
      expect(() => getPhotoDisplay(value)).not.toThrow();
      expect(getPhotoDisplay(value)).toBeNull();
    }
  });

  // The hook runs inline here (useMemo and the store read are mocked above).
  const displayHook = usePhotoDisplay;

  it("usePhotoDisplay returns null instead of throwing", () => {
    for (const value of NOT_PATHS) {
      expect(() => displayHook(value)).not.toThrow();
      expect(displayHook(value)).toBeNull();
    }
    expect(displayHook(null)).toBeNull();
    expect(displayHook(rel)?.source.uri.startsWith(`file:///doc/${rel}`)).toBe(
      true,
    );
  });

  it("the predicates share the SAFE_RELATIVE rule", () => {
    expect(isStoredPhotoPath(rel)).toBe(true);
    expect(isStoredPhotoPath("avatars/cv-7-pet.webp")).toBe(true);
    for (const value of NOT_PATHS) {
      expect(isStoredPhotoPath(value)).toBe(false);
      expect(isUnusablePhotoReference(value)).toBe(true);
    }
    expect(isStoredPhotoPath(null)).toBe(false);
    expect(isUnusablePhotoReference(null)).toBe(false);
    expect(isUnusablePhotoReference("")).toBe(false);
    expect(isUnusablePhotoReference(rel)).toBe(false);
  });
});
