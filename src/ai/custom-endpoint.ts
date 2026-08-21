/**
 * Custom-endpoint URL validator — the URL-LITERAL layer of the Custom-provider
 * egress guard (Phase 14, AI-01 / C4-H1).
 *
 * This is a SECURITY control, not a convenience check. It is the ONLY place a
 * user-supplied Custom endpoint URL is vetted before it is persisted (Plan 01
 * settings DAO, save-time) and before it is dialled (Plan 02 Custom adapter,
 * request-time) — ONE module, no duplicate validators (H2).
 *
 * SCOPE — what this layer catches vs. what it cannot:
 *   - It rejects non-HTTPS, credentialed, `.local` mDNS, and every IP LITERAL in
 *     the CANONICAL non-public set below (C4-H1). Because it inspects the URL
 *     literal only, a PUBLIC hostname that RESOLVES to a private address at
 *     connection time is NOT caught here — that DNS-rebinding / SSRF vector is
 *     caught by Plan 07's native module, which re-checks the RESOLVED address
 *     against the IDENTICAL set. Do NOT claim DNS resolution happens here.
 *   - OkHttp does NOT consult the native `Dns` resolver for a numeric-IP-literal
 *     URL (there is nothing to resolve), so an IP-literal Custom URL is guarded
 *     by BOTH this JS validator AND Plan 07's native pre-`Call` literal check —
 *     defense in depth, neither being the sole guard (C4-M2).
 *
 * The rejection set is driven by the exported CIDR tables below and proven by a
 * table-driven test over `src/ai/__fixtures__/non-public-vectors.json` — the
 * SAME machine-readable manifest Plan 07's Kotlin/JVM suite consumes, so the JS
 * and native enumerations are provably identical. Authority: the IANA IPv4/IPv6
 * special-purpose registries (reject unless globally reachable). Deliberate
 * over-block with NO globally-reachable carve-outs (owner decision, Cycle 5);
 * do not "fix" this by adding more-specific exceptions.
 */

/** Success: an empty `url` means the valid "unconfigured" state (C3-M5). */
export interface ValidateEndpointOk {
  ok: true;
  url: string;
}

/** Failure with a SANITIZED reason — the raw input URL is never echoed back. */
export interface ValidateEndpointError {
  ok: false;
  reason: string;
}

export type ValidateEndpointResult = ValidateEndpointOk | ValidateEndpointError;

// --- Canonical non-public CIDR tables (C4-H1) --------------------------------
// [base-address, prefix-length]. Kept as plain data so the Kotlin (Plan 07)
// layer can mirror the SAME enumeration and the shared vector manifest proves
// both against identical addresses.

/** IPv4 special-purpose blocks that are NOT globally reachable — reject. */
export const NON_PUBLIC_IPV4_CIDRS: ReadonlyArray<readonly [string, number]> = [
  ["0.0.0.0", 8], // this-network / unspecified
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation (TEST-NET-1)
  ["198.51.100.0", 24], // documentation (TEST-NET-2)
  ["203.0.113.0", 24], // documentation (TEST-NET-3)
  ["192.88.99.0", 24], // deprecated 6to4 relay anycast
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved
  ["255.255.255.255", 32], // limited broadcast
];

/**
 * IPv6 special-purpose blocks that are NOT globally reachable — reject. The two
 * "unwrap" prefixes (IPv4-mapped and NAT64) are handled specially below rather
 * than as blanket rows: their embedded IPv4 is extracted and re-checked against
 * the IPv4 table, so a NAT64/mapped address is rejected iff its embedded IPv4 is
 * non-public.
 */
export const NON_PUBLIC_IPV6_CIDRS: ReadonlyArray<readonly [string, number]> = [
  ["::", 128], // unspecified
  ["::1", 128], // loopback
  ["64:ff9b:1::", 48], // local-use translation
  ["100::", 64], // discard-only
  ["100:0:0:1::", 64], // dummy
  ["2001:2::", 48], // benchmarking
  ["2001:db8::", 32], // documentation
  ["3fff::", 20], // documentation
  ["5f00::", 16], // SRv6
  ["fc00::", 7], // ULA
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
];

/** IPv4-mapped IPv6 prefix `::ffff:0:0/96` — unwrap the low 32 bits, re-check. */
export const IPV4_MAPPED_PREFIX: readonly [string, number] = ["::ffff:0:0", 96];

/** NAT64 well-known prefix `64:ff9b::/96` — unwrap the low 32 bits, re-check. */
export const NAT64_PREFIX: readonly [string, number] = ["64:ff9b::", 96];

// --- IP-literal parsing ------------------------------------------------------

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** Parse a dotted-decimal IPv4 to a 32-bit unsigned number, or null. */
function parseIpv4(host: string): number | null {
  const m = IPV4_RE.exec(host);
  if (!m) return null;
  const octets = [m[1], m[2], m[3], m[4]].map((o) => Number(o));
  for (const o of octets) {
    if (o > 255) return null;
  }
  // Arithmetic (not <<) so the top octet never turns the result negative.
  return (
    octets[0] * 2 ** 24 + octets[1] * 2 ** 16 + octets[2] * 2 ** 8 + octets[3]
  );
}

const IPV6_GROUP_RE = /^[0-9a-fA-F]{1,4}$/;
const FULL_MASK_128 = (1n << 128n) - 1n;

/**
 * Parse an IPv6 literal (already bracket-stripped) to a 128-bit BigInt, or null.
 * Handles `::` compression and a trailing embedded IPv4 (`::ffff:1.2.3.4`,
 * `64:ff9b::1.2.3.4`). Rejects a zone id.
 */
function parseIpv6(input: string): bigint | null {
  if (input.includes("%")) return null;

  let text = input;
  // Fold a trailing embedded IPv4 into two hex groups.
  if (text.includes(".")) {
    const lastColon = text.lastIndexOf(":");
    if (lastColon === -1) return null;
    const v4 = parseIpv4(text.slice(lastColon + 1));
    if (v4 === null) return null;
    const hi = Math.floor(v4 / 2 ** 16) & 0xffff;
    const lo = v4 & 0xffff;
    text = `${text.slice(0, lastColon + 1)}${hi.toString(16)}:${lo.toString(16)}`;
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;

  const head = halves[0] === "" ? [] : halves[0].split(":");
  let groups: string[];
  if (halves.length === 2) {
    const tail = halves[1] === "" ? [] : halves[1].split(":");
    const missing = 8 - head.length - tail.length;
    if (missing < 1) return null; // "::" must stand for at least one zero group
    groups = [...head, ...new Array<string>(missing).fill("0"), ...tail];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;

  let value = 0n;
  for (const g of groups) {
    if (!IPV6_GROUP_RE.test(g)) return null;
    value = (value << 16n) + BigInt(Number.parseInt(g, 16));
  }
  return value;
}

function ipv4InCidr(ip: number, base: string, prefix: number): boolean {
  const baseInt = parseIpv4(base);
  if (baseInt === null) return false;
  if (prefix === 0) return true;
  const mask = prefix >= 32 ? 0xffffffff : (0xffffffff << (32 - prefix)) >>> 0;
  return (ip & mask) >>> 0 === (baseInt & mask) >>> 0;
}

function ipv6InCidr(ip: bigint, base: string, prefix: number): boolean {
  const baseInt = parseIpv6(base);
  if (baseInt === null) return false;
  const mask =
    prefix === 0 ? 0n : (FULL_MASK_128 << BigInt(128 - prefix)) & FULL_MASK_128;
  return (ip & mask) === (baseInt & mask);
}

/** True if a 32-bit IPv4 falls in any non-public IPv4 block. */
function ipv4IsNonPublic(ip: number): boolean {
  return NON_PUBLIC_IPV4_CIDRS.some(([base, prefix]) =>
    ipv4InCidr(ip, base, prefix),
  );
}

/** True if a 128-bit IPv6 is non-public (embedded-IPv4 prefixes unwrapped). */
function ipv6IsNonPublic(ip: bigint): boolean {
  // IPv4-mapped and NAT64: extract the embedded IPv4 and re-check the IPv4 set,
  // so the two layers treat a wrapped address exactly like its IPv4 form.
  if (ipv6InCidr(ip, IPV4_MAPPED_PREFIX[0], IPV4_MAPPED_PREFIX[1])) {
    return ipv4IsNonPublic(Number(ip & 0xffffffffn));
  }
  if (ipv6InCidr(ip, NAT64_PREFIX[0], NAT64_PREFIX[1])) {
    return ipv4IsNonPublic(Number(ip & 0xffffffffn));
  }
  return NON_PUBLIC_IPV6_CIDRS.some(([base, prefix]) =>
    ipv6InCidr(ip, base, prefix),
  );
}

/**
 * Classify a URL `hostname` (as WHATWG URL returns it — IPv6 in brackets) and
 * decide whether it is a non-public IP literal. A non-literal hostname (a DNS
 * name) returns false here; its resolved address is the native layer's job.
 */
export function isNonPublicIpLiteral(hostname: string): boolean {
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    const ip = parseIpv6(hostname.slice(1, -1));
    // A bracketed host that will not parse is malformed IPv6 — reject (fail safe).
    if (ip === null) return true;
    return ipv6IsNonPublic(ip);
  }
  const v4 = parseIpv4(hostname);
  if (v4 !== null) return ipv4IsNonPublic(v4);
  return false; // a DNS name — not an IP literal, deferred to the native layer
}

// --- The public validator ----------------------------------------------------

const REASON_INVALID = "Enter a valid https:// endpoint URL.";
const REASON_NOT_HTTPS = "The endpoint must use https://.";
const REASON_CREDENTIALS =
  "The endpoint URL must not embed a username or password.";
const REASON_NO_HOST = "The endpoint URL must include a host.";
const REASON_LOCAL = "Local network (.local) endpoints are not allowed.";
const REASON_NON_PUBLIC =
  "The endpoint points at a private or reserved address, which is not allowed.";

/**
 * Validate a Custom-endpoint URL literal. An EMPTY (or whitespace-only) input is
 * the valid "unconfigured" state and returns `{ ok: true, url: "" }` (C3-M5).
 * A non-empty input must be an `https:` URL with a non-empty host, no embedded
 * credentials, not a `.local` mDNS name, and not any IP literal in the canonical
 * non-public set. Every failure reason is a fixed, sanitized string — the raw
 * input is never reflected into a UI error.
 */
export function validateCustomEndpoint(raw: string): ValidateEndpointResult {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, url: "" };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: REASON_INVALID };
  }

  if (url.protocol !== "https:") return { ok: false, reason: REASON_NOT_HTTPS };
  if (url.username !== "" || url.password !== "") {
    return { ok: false, reason: REASON_CREDENTIALS };
  }

  const host = url.hostname;
  if (host === "") return { ok: false, reason: REASON_NO_HOST };

  if (!host.startsWith("[")) {
    const lower = host.toLowerCase();
    if (lower === "local" || lower.endsWith(".local")) {
      return { ok: false, reason: REASON_LOCAL };
    }
  }

  if (isNonPublicIpLiteral(host)) {
    return { ok: false, reason: REASON_NON_PUBLIC };
  }

  return { ok: true, url: trimmed };
}
