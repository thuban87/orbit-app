/**
 * url-image — node-side proof of the PURE, security-load-bearing surface
 * (PHOTO-02) AND the memory-safe download orchestration (H1/M2/M3).
 *
 * `url-image.ts` imports the native `expo-file-system` class API at module load,
 * so the whole native module is replaced by a controllable in-memory mock via
 * `vi.hoisted` — enough to drive `downloadImageToCache` through its three
 * transfer branches (readable stream / native download / fail-closed) and its
 * validation gates, WITHOUT loading the native module or hitting the network.
 * The pure helpers (`isImageUrl`, `extFromContentType`, `isAcceptedRasterContentType`)
 * are exercised directly — that is where the SSRF/cleartext/raster decisions live.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted, controllable native-module state: a File download hook + op logs.
const fs = vi.hoisted(() => ({
  downloadFileAsync: undefined as
    | undefined
    | ((
        url: string,
        dest: { uri: string },
        opts?: unknown,
      ) => Promise<{ uri: string; size: number; delete: () => void }>),
  deleted: [] as string[],
  written: [] as { uri: string; byteLength: number }[],
}));

vi.mock("expo-file-system", () => {
  const joinUri = (parts: unknown[]): string =>
    parts
      .map((p) => (typeof p === "string" ? p : (p as { uri: string }).uri))
      .join("/");

  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = joinUri(parts);
    }
    create(): void {}
  }
  class File {
    uri: string;
    static get downloadFileAsync() {
      return fs.downloadFileAsync;
    }
    constructor(...parts: unknown[]) {
      this.uri = joinUri(parts);
    }
    create(): void {}
    write(bytes: Uint8Array): void {
      fs.written.push({ uri: this.uri, byteLength: bytes.byteLength });
    }
    delete(): void {
      fs.deleted.push(this.uri);
    }
  }
  return { File, Directory, Paths: { cache: { uri: "file:///cache" } } };
});

import {
  downloadImageToCache,
  extFromContentType,
  isAcceptedRasterContentType,
  isImageUrl,
  type UrlImageError,
} from "./url-image";

const MAX = 8 * 1024 * 1024;

/** Build a fetch `Response`-like with controllable url/status/content-type/body. */
function makeResponse(opts: {
  url?: string;
  ok?: boolean;
  status?: number;
  contentType?: string | null;
  reader?: { read: () => Promise<unknown>; cancel: () => Promise<void> } | null;
  noBody?: boolean;
}): Response {
  const ct = opts.contentType === undefined ? "image/jpeg" : opts.contentType;
  const body = opts.noBody
    ? undefined
    : opts.reader
      ? { getReader: () => opts.reader }
      : {}; // present but no getReader → no-stream path
  return {
    url: opts.url === undefined ? "https://cdn.example.com/pic" : opts.url,
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    headers: {
      get: (k: string) =>
        k.toLowerCase() === "content-type" ? (ct ?? null) : null,
    },
    body,
  } as unknown as Response;
}

/** A reader that yields `chunkCount` chunks of `chunkBytes` each; spies on both. */
function makeChunkReader(chunkCount: number, chunkBytes: number) {
  let i = 0;
  const read = vi.fn(async () =>
    i++ < chunkCount
      ? { done: false, value: new Uint8Array(chunkBytes) }
      : { done: true, value: undefined },
  );
  const cancel = vi.fn(async () => {});
  return { read, cancel };
}

function stubFetch(response: Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response),
  );
}

beforeEach(() => {
  fs.downloadFileAsync = undefined;
  fs.deleted = [];
  fs.written = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

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
    expect(isImageUrl("javascript://%0aalert(1)")).toBe(false);
    expect(isImageUrl("ftp://x.com/a.jpg")).toBe(false);
    expect(isImageUrl("data:image/png;base64,AAAA")).toBe(false);
  });

  it("rejects non-URL / garbage input without throwing", () => {
    expect(isImageUrl("")).toBe(false);
    expect(isImageUrl("not a url")).toBe(false);
    expect(isImageUrl("x.com/a.jpg")).toBe(false);
    expect(isImageUrl("://x.com")).toBe(false);
    expect(isImageUrl(undefined as unknown as string)).toBe(false);
    expect(isImageUrl(null as unknown as string)).toBe(false);
  });
});

describe("extFromContentType — content-type → extension map (raster-only, M3)", () => {
  it("maps the accepted raster types", () => {
    expect(extFromContentType("image/jpeg")).toBe("jpg");
    expect(extFromContentType("image/jpg")).toBe("jpg");
    expect(extFromContentType("image/png")).toBe("png");
    expect(extFromContentType("image/webp")).toBe("webp");
  });

  it("strips content-type parameters and is case-insensitive", () => {
    expect(extFromContentType("image/jpeg; charset=binary")).toBe("jpg");
    expect(extFromContentType("IMAGE/PNG")).toBe("png");
    expect(extFromContentType("  image/webp  ")).toBe("webp");
  });

  it("falls back to the default extension for non-raster/unknown/absent types", () => {
    // gif/svg/tiff/avif were dropped from the map (M3) — they now default.
    expect(extFromContentType("image/gif")).toBe("jpg");
    expect(extFromContentType("image/svg+xml")).toBe("jpg");
    expect(extFromContentType("application/octet-stream")).toBe("jpg");
    expect(extFromContentType("image/heic")).toBe("jpg");
    expect(extFromContentType("")).toBe("jpg");
  });
});

describe("isAcceptedRasterContentType — finite raster allowlist (M3)", () => {
  it("accepts jpeg/png/webp (params stripped, case-insensitive)", () => {
    expect(isAcceptedRasterContentType("image/jpeg")).toBe(true);
    expect(isAcceptedRasterContentType("image/jpg")).toBe(true);
    expect(isAcceptedRasterContentType("image/png")).toBe(true);
    expect(isAcceptedRasterContentType("IMAGE/WEBP; charset=binary")).toBe(
      true,
    );
  });

  it("rejects svg/tiff/avif/bmp/gif/heic and non-image types", () => {
    expect(isAcceptedRasterContentType("image/svg+xml")).toBe(false);
    expect(isAcceptedRasterContentType("image/tiff")).toBe(false);
    expect(isAcceptedRasterContentType("image/avif")).toBe(false);
    expect(isAcceptedRasterContentType("image/bmp")).toBe(false);
    expect(isAcceptedRasterContentType("image/gif")).toBe(false);
    expect(isAcceptedRasterContentType("image/heic")).toBe(false);
    expect(isAcceptedRasterContentType("text/html")).toBe(false);
    expect(isAcceptedRasterContentType("")).toBe(false);
  });
});

describe("downloadImageToCache — redirect re-validation (M2)", () => {
  it("rejects a redirect to a non-https final url", async () => {
    stubFetch(makeResponse({ url: "http://evil.example/a.jpg" }));
    await expect(
      downloadImageToCache("https://ok.example/a.jpg"),
    ).rejects.toMatchObject({
      kind: "invalid",
    } satisfies Partial<UrlImageError>);
  });

  it("FAILS CLOSED when the runtime reports an empty final url", async () => {
    // Some RN fetch runtimes report `response.url === ""`; the re-check must not
    // be skipped — an unverifiable final url rejects, it does not pass.
    stubFetch(makeResponse({ url: "" }));
    await expect(
      downloadImageToCache("https://ok.example/a.jpg"),
    ).rejects.toMatchObject({ kind: "invalid" });
  });
});

describe("downloadImageToCache — raster content-type gate (M3)", () => {
  it("rejects an image/* subtype outside the raster allowlist (svg)", async () => {
    stubFetch(makeResponse({ contentType: "image/svg+xml" }));
    await expect(
      downloadImageToCache("https://ok.example/a.svg"),
    ).rejects.toMatchObject({ kind: "content" });
  });

  it("accepts image/png and writes to the evictable cache", async () => {
    const reader = makeChunkReader(1, 1024);
    stubFetch(makeResponse({ contentType: "image/png", reader }));
    const uri = await downloadImageToCache("https://ok.example/a.png");
    expect(uri).toMatch(/^file:\/\/\/cache\/photo-dl\/download-\d+\.png$/);
    expect(fs.written).toHaveLength(1);
  });
});

describe("downloadImageToCache — memory-safe transfer (H1)", () => {
  it("streams + ABORTS at the cap without buffering the whole body (forged content-length)", async () => {
    // A forged-small content-length is irrelevant now: two 5 MB chunks exceed the
    // 8 MB cap on the 2nd read, so the stream is cancelled mid-flight and never
    // fully buffered. A 3rd chunk exists but must never be read.
    const reader = makeChunkReader(3, 5 * 1024 * 1024);
    stubFetch(makeResponse({ contentType: "image/jpeg", reader }));

    await expect(
      downloadImageToCache("https://ok.example/big.jpg"),
    ).rejects.toMatchObject({ kind: "content" });
    expect(reader.cancel).toHaveBeenCalledTimes(1);
    // Read only twice (stopped the instant the cap was exceeded) — the 3rd chunk
    // was never pulled, proving the whole body was not buffered.
    expect(reader.read).toHaveBeenCalledTimes(2);
    expect(fs.written).toHaveLength(0);
  });

  it("streams a small body to the cache on success", async () => {
    const reader = makeChunkReader(2, 1024);
    stubFetch(makeResponse({ contentType: "image/jpeg", reader }));
    const uri = await downloadImageToCache("https://ok.example/a.jpg");
    expect(uri).toMatch(/^file:\/\/\/cache\/photo-dl\/download-\d+\.jpg$/);
    expect(fs.written).toHaveLength(1);
    expect(fs.written[0].byteLength).toBe(2048);
  });

  it("no stream → downloads NATIVELY to disk, then DELETES + rejects when over the cap", async () => {
    fs.downloadFileAsync = vi.fn(async (_url, dest) => ({
      uri: dest.uri,
      size: MAX + 1, // oversized body written to disk, must be deleted
      delete: () => fs.deleted.push(dest.uri),
    }));
    stubFetch(makeResponse({ contentType: "image/jpeg", reader: null }));

    await expect(
      downloadImageToCache("https://ok.example/a.jpg"),
    ).rejects.toMatchObject({ kind: "content" });
    expect(fs.downloadFileAsync).toHaveBeenCalledTimes(1);
    // The already-validated final url is what gets downloaded natively.
    expect(fs.downloadFileAsync).toHaveBeenCalledWith(
      "https://cdn.example.com/pic",
      expect.objectContaining({
        uri: expect.stringMatching(
          /^file:\/\/\/cache\/photo-dl\/download-\d+\.jpg$/,
        ),
      }),
      expect.objectContaining({ idempotent: true }),
    );
    expect(fs.deleted).toHaveLength(1);
  });

  it("no stream → native download under the cap resolves to the cache uri", async () => {
    fs.downloadFileAsync = vi.fn(async (_url, dest) => ({
      uri: dest.uri,
      size: 4096,
      delete: () => fs.deleted.push(dest.uri),
    }));
    stubFetch(makeResponse({ contentType: "image/jpeg", reader: null }));

    const uri = await downloadImageToCache("https://ok.example/a.jpg");
    expect(uri).toMatch(/^file:\/\/\/cache\/photo-dl\/download-\d+\.jpg$/);
    expect(fs.deleted).toHaveLength(0);
  });

  it("FAILS CLOSED when neither a readable stream nor a native downloader exists", async () => {
    fs.downloadFileAsync = undefined; // no native path
    stubFetch(makeResponse({ contentType: "image/jpeg", reader: null }));

    await expect(
      downloadImageToCache("https://ok.example/a.jpg"),
    ).rejects.toMatchObject({ kind: "content" });
    // Never buffered anything: no write, no native download.
    expect(fs.written).toHaveLength(0);
  });
});
