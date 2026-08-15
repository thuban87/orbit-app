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
 * `requestUrl` are all DELETED (no vault on mobile; HANDOFF §4). The transfer is
 * `fetch`, NOT `File.downloadFileAsync`: verified against the SDK-57 `File` API,
 * `downloadFileAsync` returns only the written `File` and exposes NEITHER the
 * response headers NOR the redirect-resolved final URL — so it cannot enforce a
 * content-type policy or re-validate the final scheme. `fetch` exposes both.
 *
 * SECURITY — the load-bearing part (T-05-02 / T-05-03):
 *   - `isImageUrl` is an https-ONLY POSITIVE allowlist (the stricter sibling of
 *     the Phase-4 04-07 link-open `https?://` allowlist — this path is https ONLY,
 *     no cleartext). It rejects http/file/intent/javascript/ftp/data and any
 *     unparseable input. It is applied to BOTH the submitted URL AND the
 *     redirect-resolved final `response.url` — a redirect that lands on
 *     http/file/another scheme is rejected, closing the SSRF/downgrade gap the
 *     submitted-scheme check alone leaves open.
 *   - The response `content-type` MUST be `image/*`.
 *   - The byte size is enforced at a cap WITHOUT trusting the optional/spoofable
 *     `content-length`: when `response.body.getReader` exists the body is streamed
 *     and ABORTED the instant the running total exceeds the cap (an oversized body
 *     is never fully buffered); when streaming is unavailable in the RN fetch
 *     runtime, an absent/non-numeric/over-cap `content-length` is rejected up
 *     front AND the actual `byteLength` is re-verified after read.
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
 * by an up-front `content-length` check plus a post-read re-verify.
 */
const MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

/**
 * Content-Type MIME → file extension (re-ported from the legacy ImageScraper).
 * Extension is WITHOUT a leading dot — it only names the evictable cache file;
 * the crop pipeline re-encodes to JPEG regardless, so this is a decode hint only.
 */
const CONTENT_TYPE_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
  "image/avif": "avif",
};

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
  if (typeof contentType !== "string" || contentType.length === 0) {
    return DEFAULT_EXTENSION;
  }
  const mime = contentType.split(";")[0].trim().toLowerCase();
  return CONTENT_TYPE_MAP[mime] ?? DEFAULT_EXTENSION;
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
 * Read a fetch response body into a size-capped `Uint8Array`. STREAM-ENFORCES the
 * cap when a readable body stream is available — accumulating chunks and aborting
 * (`reader.cancel()`) the instant the running total exceeds {@link
 * MAX_DOWNLOAD_BYTES}, so an oversized/chunked body is never fully buffered. When
 * the RN fetch runtime lacks `response.body.getReader` (the whatwg-fetch polyfill
 * historically does), FALLS BACK to rejecting an absent/non-numeric/over-cap
 * `content-length` up front AND re-verifying the actual `byteLength` after read
 * (a header that under-reports is caught).
 *
 * @throws {UrlImageError} kind `content` when the body exceeds the cap or the
 * fallback `content-length` is missing/invalid.
 */
async function readCappedBytes(response: Response): Promise<Uint8Array> {
  const reader = response.body?.getReader?.();

  if (reader) {
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

  // Fallback: no readable stream. content-length is optional and spoofable, so
  // reject the honest-large / absent / non-numeric cases up front, then re-verify
  // the real size after buffering (catches a header that under-reported).
  const header = response.headers.get("content-length");
  const declared = header != null ? Number(header) : Number.NaN;
  if (
    !Number.isFinite(declared) ||
    declared <= 0 ||
    declared > MAX_DOWNLOAD_BYTES
  ) {
    throw new UrlImageError(
      "content",
      `content-length missing/invalid/over-cap: ${JSON.stringify(header)}`,
    );
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_DOWNLOAD_BYTES) {
    throw new UrlImageError(
      "content",
      `download exceeds ${MAX_DOWNLOAD_BYTES}-byte cap (post-read)`,
    );
  }
  return new Uint8Array(buffer);
}

/**
 * Download a pasted https image URL ONCE into the evictable cache and return the
 * raw `file://` cache uri (from there the flow is identical to a picked image).
 *
 * Order of enforcement:
 *   1. `isImageUrl` on the SUBMITTED url (reject non-https up front);
 *   2. `fetch(url)` (follows redirects; network failure → `network`);
 *   3. `isImageUrl(response.url)` — re-validate the REDIRECT-RESOLVED final url is
 *      still https (a redirect to http/file/other scheme is rejected → `invalid`);
 *   4. `response.ok`;
 *   5. `content-type` is `image/*` (→ extension via {@link extFromContentType});
 *   6. read the body under the streamed byte cap (over-cap → `content`);
 *   7. write the validated bytes into `Paths.cache/photo-dl` and return its uri.
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
  if (response.url && !isImageUrl(response.url)) {
    throw new UrlImageError(
      "invalid",
      `redirect resolved to a non-https url: ${JSON.stringify(response.url)}`,
    );
  }

  // (4) HTTP status.
  if (!response.ok) {
    throw new UrlImageError("network", `http ${response.status}`);
  }

  // (5) content-type must be image/*.
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.trim().toLowerCase().startsWith("image/")) {
    throw new UrlImageError(
      "content",
      `non-image content-type: ${JSON.stringify(contentType)}`,
    );
  }
  const ext = extFromContentType(contentType);

  // (6) Read the body under the streamed/post-read byte cap.
  const bytes = await readCappedBytes(response);

  // (7) Write into the evictable cache subdir (never the document dir).
  try {
    new Directory(Paths.cache, CACHE_SUBDIR).create({
      intermediates: true,
      idempotent: true,
    });
    const file = new File(
      Paths.cache,
      CACHE_SUBDIR,
      `download-${Date.now()}.${ext}`,
    );
    file.create({ overwrite: true });
    file.write(bytes);
    return file.uri;
  } catch (error) {
    Logger.error(LOG_SCOPE, `cache write failed for ${url}`, error);
    throw new UrlImageError("content", "could not write downloaded image", {
      cause: error,
    });
  }
}
