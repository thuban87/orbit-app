/**
 * validateCustomEndpoint — the URL-literal egress guard (C4-H1 / C5-H1).
 *
 * The rejection set is proven TABLE-DRIVEN over the shared machine-readable
 * manifest `__fixtures__/non-public-vectors.json` — the SAME file Plan 07's
 * Kotlin/JVM suite consumes, so the JS and native enumerations are proven
 * against identical vectors. Every `reject` address must be refused and every
 * `accept` address must pass; each rejection reason must omit the raw input URL.
 *
 * Non-IP policy cases (empty = unconfigured, http:, credentials, .local) are
 * asserted separately since the manifest is IP-literal-only.
 */
import { describe, expect, it } from "vitest";
import vectorsManifest from "@/ai/__fixtures__/non-public-vectors.json";
import { validateCustomEndpoint } from "@/ai/custom-endpoint";

interface Vector {
  address: string;
  expect: "reject" | "accept";
  note?: string;
}

const vectors = vectorsManifest.vectors as Vector[];

/** Build the https:// URL for an address (IPv6 addresses arrive bracketed). */
function urlFor(address: string): string {
  return `https://${address}/v1/chat`;
}

describe("validateCustomEndpoint — shared non-public IP manifest (C4-H1)", () => {
  it("covers a representative + boundary reject case and public accept cases", () => {
    // Guard against an empty/omitted manifest silently passing the loop below.
    const rejects = vectors.filter((v) => v.expect === "reject");
    const accepts = vectors.filter((v) => v.expect === "accept");
    expect(rejects.length).toBeGreaterThanOrEqual(30);
    expect(accepts.length).toBeGreaterThanOrEqual(6);
  });

  it("includes every C5-H1 addition as a reject vector", () => {
    const rejectSet = new Set(
      vectors.filter((v) => v.expect === "reject").map((v) => v.address),
    );
    for (const addr of [
      "192.88.99.1",
      "[64:ff9b:1::1]",
      "[100:0:0:1::1]",
      "[2001:2::1]",
      "[3fff::1]",
      "[5f00::1]",
    ]) {
      expect(rejectSet.has(addr)).toBe(true);
    }
  });

  for (const vector of vectors) {
    it(`${vector.expect}s ${vector.address}${vector.note ? ` (${vector.note})` : ""}`, () => {
      const raw = urlFor(vector.address);
      const result = validateCustomEndpoint(raw);
      if (vector.expect === "reject") {
        expect(result.ok).toBe(false);
        if (!result.ok) {
          // The sanitized reason must never leak the raw URL or the address.
          expect(result.reason).not.toContain(vector.address);
          expect(result.reason).not.toContain("https://");
        }
      } else {
        expect(result.ok).toBe(true);
      }
    });
  }
});

describe("validateCustomEndpoint — non-IP policy", () => {
  it("accepts an empty string as the valid unconfigured state (C3-M5)", () => {
    const result = validateCustomEndpoint("");
    expect(result).toEqual({ ok: true, url: "" });
  });

  it("accepts a whitespace-only string as unconfigured", () => {
    const result = validateCustomEndpoint("   ");
    expect(result).toEqual({ ok: true, url: "" });
  });

  it("accepts a normal public https endpoint and echoes the trimmed URL", () => {
    const result = validateCustomEndpoint(
      "  https://api.example.com/v1/chat  ",
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe("https://api.example.com/v1/chat");
  });

  it("rejects an http:// endpoint", () => {
    const result = validateCustomEndpoint("http://api.example.com/v1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).not.toContain("api.example.com");
  });

  it("rejects a credentialed https URL without echoing the secret values", () => {
    const raw = "https://leaked-id:leaked-token@api.example.com/v1";
    const result = validateCustomEndpoint(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // The sanitized reason must not reflect the raw credential values.
      expect(result.reason).not.toContain("leaked-id");
      expect(result.reason).not.toContain("leaked-token");
      expect(result.reason).not.toContain(raw);
    }
  });

  it("rejects a username-only credentialed URL", () => {
    const result = validateCustomEndpoint(
      "https://leaked-token@api.example.com/v1",
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a .local mDNS host", () => {
    const result = validateCustomEndpoint("https://printer.local/v1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).not.toContain("printer.local");
  });

  it("rejects a bare 'local' single-label host", () => {
    const result = validateCustomEndpoint("https://local/v1");
    expect(result.ok).toBe(false);
  });

  it("rejects a malformed non-URL string", () => {
    const result = validateCustomEndpoint("not a url");
    expect(result.ok).toBe(false);
  });
});
