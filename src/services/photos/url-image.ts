/**
 * url-image (PHOTO-02) — the pasted-URL capture path's one-time WRITE. Downloads
 * a user-pasted image URL ONCE into the evictable cache, from where it feeds the
 * IDENTICAL crop → manipulate → persist pipeline every other capture path uses.
 * Reads are NEVER network (local-first §3 preserved) — this module is only ever
 * called from a paste-time submit, never from a render/read path.
 *
 * Re-ported from the legacy Obsidian `~/projects/Orbit/src/utils/ImageScraper.ts`
 * — but ONLY its pure `CONTENT_TYPE_MAP` / content-type→extension logic. The
 * wikilink return, vault-path naming, folder-conflict resolution, and Obsidian
 * `requestUrl` are all DELETED (no vault on mobile; HANDOFF §4). The POLICY gate
 * is `fetch`, NOT `File.downloadFileAsync`: verified against the SDK-57 `File`
 * API, `downloadFileAsync` returns only the written `File` and exposes NEITHER
 * the response headers NOR the redirect-resolved final URL — so it cannot enforce
 * a content-type policy or re-validate the final scheme. `fetch` exposes both, so
 * ALL validation (scheme, redirect scheme, content-type) runs on the `fetch`
 * response FIRST; `downloadFileAsync` is used ONLY as the memory-safe transfer for
 * the already-validated final url when the fetch body has no readable stream (H1).
 *
 * SECURITY — the load-bearing part (T-05-02 / T-05-03):
 *   - `isImageUrl` is an https-ONLY POSITIVE allowlist (the stricter sibling of
 *     the Phase-4 04-07 link-open `https?://` allowlist — this path is https ONLY,
 *     no cleartext). It rejects http/file/intent/javascript/ftp/data and any
 *     unparseable input. It is applied to BOTH the submitted URL AND the
 *     redirect-resolved final `response.url` — a redirect that lands on
 *     http/file/another scheme is rejected, closing the SSRF/downgrade gap the
 *     submitted-scheme check alone leaves open. The re-check is UNCONDITIONAL
 *     (M2): an empty/blank final url fails closed, never skips the check.
 *   - The response `content-type` MUST be in a finite RASTER allowlist
 *     (JPEG/PNG/WebP) — NOT a broad `image/*` prefix, which would admit
 *     SVG (script/XXE), TIFF, AVIF and unknown subtypes (M3).
 *   - The byte size is enforced at a cap WITHOUT ever buffering an unbounded body
 *     into the JS heap (H1) and WITHOUT trusting the optional/spoofable
 *     `content-length`: when `response.body.getReader` exists the body is streamed
 *     and ABORTED the instant the running total exceeds the cap (never fully
 *     buffered); when streaming is unavailable in the RN fetch runtime (frequent
 *     on device), the already-validated final url is downloaded NATIVELY to disk
 *     via `File.downloadFileAsync` (streams straight to disk, no JS-heap
 *     buffering) and the file is STAT'd and DELETED if it exceeds the cap; if
 *     NEITHER path is available it FAILS CLOSED. It never calls
 *     `response.arrayBuffer()` behind a spoofable length (the OOM this replaces).
 *   - Bytes are written to a CACHE subdir (evictable), never the document dir.
 *
 * Failures throw a {@link UrlImageError} carrying a `kind` the UI maps to the
 * 05-UI-SPEC copy: `invalid` → "That doesn't look like an image URL.",
 * `network` → "Couldn't fetch that image.", `content` → "That image couldn't be
 * used." The returned raw cache uri is then IDENTICAL to a picked image's uri.
 */
import { Directory, File, Paths } from "expo-file-system";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "url-image";

/** Cache subdir the one-time download lands in (evictable; never document dir). */
const CACHE_SUBDIR = "photo-dl";

/**
 * Byte cap for a pasted-URL download (a sane few-MB ceiling; the crop pipeline
 * re-encodes to a ~30–60 KB 512px master, so a legitimate source is far under
 * this). Tunable — this is the single number to change. Enforced by streaming
 * (abort at the cap) or, if the RN fetch runtime lacks a readable body stream,
 * by a native stream-to-disk download that is STAT'd and deleted if it exceeds
 * the cap (H1) — never by buffering the whole body into memory.
 */
const MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

/**
 * Content-Type MIME → file extension. RASTER-ONLY: this map is the accepted set
 * (it is also the extension source), deliberately narrowed from the legacy
 * ImageScraper's broader table (M3). Non-raster/script-bearing subtypes
 * (`image/svg+xml`, `image/tiff`, `image/avif`, `image/bmp`) are DELETED — they
 * are rejected at the content-type gate and never reach here. Extension is
 * WITHOUT a leading dot — it only names the evictable cache file; the crop
 * pipeline re-encodes to JPEG regardless, so this is a decode hint only.
 */
const CONTENT_TYPE_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * The finite RASTER allowlist the content-type gate accepts (M3). Only formats
 * `expo-image-manipulator` can decode-then-re-encode to a JPEG master:
 * JPEG/PNG/WebP. A family prefix (`image/*`) would also admit SVG (script/XXE),
 * TIFF, AVIF and unknown subtypes — this set closes that. `image/heic`/`heif`
 * are intentionally OMITTED: the installed manipulator's decode support for them
 * is not guaranteed, so they fall to the "couldn't be used" copy rather than
 * being silently accepted. Kept as the exact key set of {@link CONTENT_TYPE_MAP}.
 */
const RASTER_CONTENT_TYPES: ReadonlySet<string> = new Set(
  Object.keys(CONTENT_TYPE_MAP),
);

/**
 * Default extension when the content-type is unknown/absent. JPEG is the most
 * universally decodable; a genuinely undecodable body still surfaces the SPEC
 * "That image couldn't be used." copy downstream, never a crash.
 */
const DEFAULT_EXTENSION = "jpg";

/** The three UI-mappable failure classes for a pasted-URL download. */
export type UrlImageErrorKind = "invalid" | "network" | "content";

/**
 * A pasted-URL download failure carrying the `kind` the caller maps to the
 * 05-UI-SPEC error copy. The underlying failure is attached as `cause`.
 */
export class UrlImageError extends Error {
  readonly kind: UrlImageErrorKind;
  constructor(
    kind: UrlImageErrorKind,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "UrlImageError";
    this.kind = kind;
  }
}

/**
 * https-ONLY positive allowlist. Returns true only for a parseable URL whose
 * protocol is exactly `https:`. Extension is intentionally NOT required — many
 * legitimate image URLs are extensionless (CDN paths), so the `content-type`
 * check at download time is the authoritative image gate; this function's job is
 * purely the scheme allowlist (reject http/file/intent/javascript/ftp/data and
 * unparseable input). Never throws.
 */
export function isImageUrl(url: string): boolean {
  if (typeof url !== "string" || url.length === 0) {
    return false;
  }
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Map a `Content-Type` header to a bare file extension (no leading dot). Strips
 * parameters (`; charset=…`), is case-insensitive, and falls back to
 * {@link DEFAULT_EXTENSION} for an unknown or absent type.
 */
export function extFromContentType(contentType: string): string {
  return (
    CONTENT_TYPE_MAP[normalizeContentType(contentType)] ?? DEFAULT_EXTENSION
  );
}

/**
 * Normalize a raw `Content-Type` header to its bare, lowercased MIME: strip
 * parameters (`; charset=…`) and surrounding whitespace. Returns `""` for a
 * missing/blank header.
 */
function normalizeContentType(contentType: string): string {
  if (typeof contentType !== "string" || contentType.length === 0) {
    return "";
  }
  return contentType.split(";")[0].trim().toLowerCase();
}

/**
 * True only when the (normalized) content-type is in the finite {@link
 * RASTER_CONTENT_TYPES} allowlist — the raster-only image gate (M3). Rejects
 * `image/svg+xml`, `image/tiff`, `image/avif`, `image/bmp`, `image/heic`, any
 * unknown subtype, and any non-image type. Never throws.
 */
export function isAcceptedRasterContentType(contentType: string): boolean {
  return RASTER_CONTENT_TYPES.has(normalizeContentType(contentType));
}

/** Concatenate accumulated stream chunks into one `Uint8Array` of `total` bytes. */
function concatChunks(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * STREAM-ENFORCE the byte cap from a readable body reader: accumulate chunks and
 * ABORT (`reader.cancel()`) the instant the running total exceeds {@link
 * MAX_DOWNLOAD_BYTES}, so an oversized/chunked body is NEVER fully buffered. Used
 * only when `response.body.getReader` exists.
 *
 * @throws {UrlImageError} kind `content` when the streamed body exceeds the cap.
 */
async function readCappedStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      total += value.byteLength;
      if (total > MAX_DOWNLOAD_BYTES) {
        await reader.cancel();
        throw new UrlImageError(
          "content",
          `download exceeds ${MAX_DOWNLOAD_BYTES}-byte cap (streamed)`,
        );
      }
      chunks.push(value);
    }
  }
  return concatChunks(chunks, total);
}

/**
 * MEMORY-SAFE native download for the no-readable-stream path (H1). On many RN
 * fetch runtimes `response.body.getReader` is ABSENT, so this — not the streamed
 * path — is what actually runs on device. The old fallback called
 * `response.arrayBuffer()` behind a spoofable `content-length`, buffering the
 * WHOLE body into the JS heap before the cap check (OOM/DoS on a forged small
 * length + oversized body). Instead, `File.downloadFileAsync` streams the body
 * straight to disk (no JS-heap buffering), then we stat the file and DELETE +
 * reject if it exceeds the cap.
 *
 * `finalUrl` is `response.url` — the redirect-resolved final url that already
 * passed the https (step 3) + raster content-type (step 5) checks on the initial
 * fetch. `downloadFileAsync` cannot re-expose headers/final-url, but we are
 * re-fetching the ALREADY-VALIDATED final url, so the policy still held.
 *
 * TRANSIENT-DISK TRADEOFF: `downloadFileAsync` has no in-flight byte cap, so an
 * oversized body writes fully to disk FIRST and is then deleted — bounded by disk
 * (never memory), so no OOM is possible, and the oversized file is removed
 * immediately. This is the deliberate cost of a native streamed download.
 *
 * @throws {UrlImageError} kind `content` when the downloaded file exceeds the cap.
 */
async function downloadCappedToFile(
  finalUrl: string,
  dest: File,
): Promise<void> {
  const downloaded = await File.downloadFileAsync(finalUrl, dest, {
    idempotent: true,
  });
  if (downloaded.size > MAX_DOWNLOAD_BYTES) {
    try {
      downloaded.delete();
    } catch {
      // Best-effort: the cache subdir is evictable, so a stray oversized file is
      // reclaimed by the OS even if this delete fails.
    }
    throw new UrlImageError(
      "content",
      `download exceeds ${MAX_DOWNLOAD_BYTES}-byte cap (native)`,
    );
  }
}

/**
 * Download a pasted https image URL ONCE into the evictable cache and return the
 * raw `file://` cache uri (from there the flow is identical to a picked image).
 *
 * Order of enforcement:
 *   1. `isImageUrl` on the SUBMITTED url (reject non-https up front);
 *   2. `fetch(url)` (follows redirects; network failure → `network`);
 *   3. `isImageUrl(response.url)` — re-validate the REDIRECT-RESOLVED final url is
 *      still https, UNCONDITIONALLY (empty final url fails closed → `invalid`);
 *   4. `response.ok`;
 *   5. `content-type` in the RASTER allowlist (→ ext via {@link extFromContentType});
 *   6. prepare the evictable `Paths.cache/photo-dl` destination;
 *   7. transfer the body MEMORY-SAFELY under the byte cap (H1): stream+abort when a
 *      readable stream exists, else native stream-to-disk + stat/delete-if-over-cap,
 *      else FAIL CLOSED; return the cache uri (over-cap/failure → `content`).
 *
 * @throws {UrlImageError} with the `kind` the UI maps to the 05-UI-SPEC copy.
 */
export async function downloadImageToCache(url: string): Promise<string> {
  // (1) Submitted-scheme allowlist.
  if (!isImageUrl(url)) {
    throw new UrlImageError(
      "invalid",
      `not an https url: ${JSON.stringify(url)}`,
    );
  }

  // (2) Fetch (follows redirects). Only a genuine transport failure is `network`.
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    Logger.error(LOG_SCOPE, `fetch failed for ${url}`, error);
    throw new UrlImageError("network", "image fetch failed", { cause: error });
  }

  // (3) Re-validate the REDIRECT-RESOLVED final url is STILL https. `response.url`
  //     is the final url after any redirects — a redirect to http/file/another
  //     scheme is rejected here (the submitted-scheme check alone cannot see it).
  //     UNCONDITIONAL (M2): an empty/blank `response.url` (some RN fetch runtimes
  //     report `""`) FAILS CLOSED rather than skipping the re-check — never accept
  //     a final url the runtime cannot expose and re-validate.
  if (!isImageUrl(response.url)) {
    throw new UrlImageError(
      "invalid",
      `redirect resolved to a non-https / unverifiable url: ${JSON.stringify(response.url)}`,
    );
  }

  // (4) HTTP status.
  if (!response.ok) {
    throw new UrlImageError("network", `http ${response.status}`);
  }

  // (5) content-type must be in the finite RASTER allowlist (M3) — not just an
  //     `image/*` family prefix (which would admit SVG/TIFF/AVIF and unknown
  //     subtypes). Only JPEG/PNG/WebP, which the downstream manipulator decodes.
  const contentType = response.headers.get("content-type") ?? "";
  if (!isAcceptedRasterContentType(contentType)) {
    throw new UrlImageError(
      "content",
      `content-type not in the raster allowlist: ${JSON.stringify(contentType)}`,
    );
  }
  const ext = extFromContentType(contentType);

  // (6) Prepare the evictable cache destination (never the document dir).
  let destFile: File;
  try {
    new Directory(Paths.cache, CACHE_SUBDIR).create({
      intermediates: true,
      idempotent: true,
    });
    destFile = new File(
      Paths.cache,
      CACHE_SUBDIR,
      `download-${Date.now()}.${ext}`,
    );
  } catch (error) {
    Logger.error(LOG_SCOPE, `cache dir prep failed for ${url}`, error);
    throw new UrlImageError("content", "could not prepare download cache", {
      cause: error,
    });
  }

  // (7) Transfer the body under the byte cap, MEMORY-SAFELY (H1). Three cases:
  //   - readable stream available -> stream + abort at the cap (never fully buffered);
  //   - no stream but a native downloader -> stream to disk, then stat + delete-if-over-cap;
  //   - NEITHER -> FAIL CLOSED. We NEVER `arrayBuffer()` an unbounded body behind a
  //     spoofable content-length (the OOM this replaces).
  const reader = response.body?.getReader?.();
  if (reader) {
    let bytes: Uint8Array;
    try {
      bytes = await readCappedStream(reader);
    } catch (error) {
      if (error instanceof UrlImageError) {
        throw error; // over-cap → surface the `content` kind unchanged.
      }
      Logger.error(LOG_SCOPE, `stream read failed for ${url}`, error);
      throw new UrlImageError("content", "could not read downloaded image", {
        cause: error,
      });
    }
    try {
      destFile.create({ overwrite: true });
      destFile.write(bytes);
    } catch (error) {
      Logger.error(LOG_SCOPE, `cache write failed for ${url}`, error);
      throw new UrlImageError("content", "could not write downloaded image", {
        cause: error,
      });
    }
    return destFile.uri;
  }

  if (typeof File.downloadFileAsync === "function") {
    // No readable stream: download the already-validated final url natively to
    // disk (memory-safe), then stat + delete-if-over-cap inside the helper.
    try {
      await downloadCappedToFile(response.url, destFile);
    } catch (error) {
      if (error instanceof UrlImageError) {
        throw error; // over-cap → surface the `content` kind unchanged.
      }
      Logger.error(LOG_SCOPE, `native download failed for ${url}`, error);
      throw new UrlImageError("content", "could not download image", {
        cause: error,
      });
    }
    return destFile.uri;
  }

  // Neither a readable stream NOR a native downloader is available: FAIL CLOSED.
  // Buffering an unbounded body into the JS heap is never an option.
  throw new UrlImageError(
    "content",
    "no memory-safe download path available (no readable stream, no native downloader)",
  );
}
