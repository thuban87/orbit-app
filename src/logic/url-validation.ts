/**
 * Link field validation (Phase 38.10 G-13 via D-89; D-24). Pure.
 *
 * A memory's Link field accepts only a web address. A typed address with a
 * scheme must be http(s) with a host; one with no scheme (`example.com`)
 * gains `https://` only through the existing `normaliseLinkUrl` (LinksEditor,
 * T-04-09), which the caller passes in so this module stays
 * react-native-free. Opening stays user-initiated and goes through the same
 * normaliser (MemoryCard), so validation never widens what can be opened.
 */

/** Proposed wording (this plan only; plan-19 wording review). */
export const LINK_FIELD_ERROR = "Enter a web link, like example.com";

/** A dot-free leading scheme, matching `normaliseLinkUrl`'s strip rule. */
const SCHEME = /^[a-z][a-z0-9+-]*:/i;
/** http(s):// followed straight by a host character (the URL parser would
 * otherwise read `https:///path` as host "path"). */
const HTTP_PREFIX = /^https?:\/\/[^/?#\\]/i;

export function hasUrlScheme(raw: string): boolean {
  return SCHEME.test(raw.trim());
}

/** An http(s) URL with a host that the URL parser accepts. */
export function isValidHttpUrl(value: string): boolean {
  const url = value.trim();
  if (url.length === 0 || /\s/.test(url) || !HTTP_PREFIX.test(url)) {
    return false;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return (
    (parsed.protocol === "http:" || parsed.protocol === "https:") &&
    parsed.hostname.length > 0
  );
}

/**
 * The Link field's rule: blank is fine (the field is optional); a typed
 * scheme must be http(s); no scheme is checked after `normalise` adds one.
 */
export function isValidLinkInput(
  raw: string,
  normalise: (raw: string) => string,
): boolean {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return true;
  return isValidHttpUrl(hasUrlScheme(trimmed) ? trimmed : normalise(trimmed));
}
