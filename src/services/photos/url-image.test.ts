/**
 * url-image — node-side proof of the PURE, security-load-bearing surface
 * (PHOTO-02): the https-ONLY `isImageUrl` positive allowlist and the
 * content-type→extension map re-ported from the legacy `ImageScraper`.
 *
 * `url-image.ts` imports the native `expo-file-system` class API at module load
 * (for the write-path `downloadImageToCache`), so the whole native module is
 * stubbed with `vi.mock` — enough to let the module import in node. The native
 * download itself is NOT unit-tested here (device UAT covers the fetch/redirect/
 * stream-cap path); these tests exercise only the pure accept/reject + mapping
 * logic, which is where the SSRF/cleartext allowlist decision actually lives.
 */
import { describe, expect, it, vi } from "vitest";

// Minimal stub so importing the module (which pulls in expo-file-system for the
// download write path) does not load the native module under node.
vi.mock("expo-file-system", () => ({
  File: class {},
  Directory: class {},
  Paths: { cache: {} },
}));

import { extFromContentType, isImageUrl } from "./url-image";

describe("isImageUrl — https-only positive allowlist (T-05-02)", () => {
  it("accepts https image URLs (with and without an extension)", () => {
    expect(isImageUrl("https://x.com/a.jpg")).toBe(true);
    expect(isImageUrl("https://x.com/a.jpeg")).toBe(true);
    expect(isImageUrl("https://x.com/a.png")).toBe(true);
    expect(isImageUrl("https://x.com/a.webp")).toBe(true);
    // Extensionless CDN URLs are legitimate — content-type validation decides at
    // download time, so isImageUrl must not reject them on shape alone.
    expect(isImageUrl("https://cdn.example.com/image/12345")).toBe(true);
    expect(isImageUrl("https://x.com/a.jpg?token=abc&w=512")).toBe(true);
  });

  it("rejects cleartext http (no downgrade surface)", () => {
    expect(isImageUrl("http://x.com/a.jpg")).toBe(false);
    expect(isImageUrl("HTTP://x.com/a.jpg")).toBe(false);
  });

  it("rejects non-https schemes (file/intent/javascript/ftp/data)", () => {
    expect(isImageUrl("file:///etc/passwd")).toBe(false);
    expect(isImageUrl("intent://scan/#Intent;scheme=zxing;end")).toBe(false);
    expect(isImageUrl("javascript:alert(1)")).toBe(false);
    // biome-ignore lint/suspicious/noExplicitAny: exercising a hostile scheme string
    expect(isImageUrl("javascript://%0aalert(1)")).toBe(false);
    expect(isImageUrl("ftp://x.com/a.jpg")).toBe(false);
    expect(isImageUrl("data:image/png;base64,AAAA")).toBe(false);
  });

  it("rejects non-URL / garbage input without throwing", () => {
    expect(isImageUrl("")).toBe(false);
    expect(isImageUrl("not a url")).toBe(false);
    expect(isImageUrl("x.com/a.jpg")).toBe(false);
    expect(isImageUrl("://x.com")).toBe(false);
    // biome-ignore lint/suspicious/noExplicitAny: proving runtime robustness
    expect(isImageUrl(undefined as unknown as string)).toBe(false);
    // biome-ignore lint/suspicious/noExplicitAny: proving runtime robustness
    expect(isImageUrl(null as unknown as string)).toBe(false);
  });
});

describe("extFromContentType — content-type → extension map", () => {
  it("maps the common image types", () => {
    expect(extFromContentType("image/jpeg")).toBe("jpg");
    expect(extFromContentType("image/jpg")).toBe("jpg");
    expect(extFromContentType("image/png")).toBe("png");
    expect(extFromContentType("image/webp")).toBe("webp");
    expect(extFromContentType("image/gif")).toBe("gif");
  });

  it("strips content-type parameters and is case-insensitive", () => {
    expect(extFromContentType("image/jpeg; charset=binary")).toBe("jpg");
    expect(extFromContentType("IMAGE/PNG")).toBe("png");
    expect(extFromContentType("  image/webp  ")).toBe("webp");
  });

  it("falls back to the default extension for unknown/absent types", () => {
    expect(extFromContentType("application/octet-stream")).toBe("jpg");
    expect(extFromContentType("image/heic")).toBe("jpg");
    expect(extFromContentType("")).toBe("jpg");
  });
});
