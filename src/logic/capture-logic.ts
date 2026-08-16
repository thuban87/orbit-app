/**
 * The share-capture payload resolver (CAP-02 / CAP-03). A pure module with no
 * UI-framework / native / I/O imports (mirrors the `compose-logic` /
 * `dashboard-empty-logic` convention) so every branch is node-tested off-device
 * and the `.tsx` capture screen just renders the result.
 *
 * It answers ONE question: given an incoming Android share payload (raw text, the
 * library's first-http `webUrl`, the patched EXTRA_SUBJECT `title`) and an optional
 * user note, WHICH `{ displayText, url }` does the fuel row get?
 *
 * EXPLICIT PRECEDENCE, top to bottom — the RESEARCH Q6 payload table + note rule:
 *
 *   base label = first NON-BLANK of `title` then `text`:
 *     (a) title present (EXTRA_SUBJECT, Chrome page title)  -> base = title
 *     (b) else text present (plain prose, or a bare URL)    -> base = text
 *         so a bare URL with no title falls back to the URL as its own label,
 *         plain text uses the text, and prose-with-URL uses the whole prose.
 *     (c) else                                              -> base = null (no base)
 *
 *   url = webUrl ?? null -- ALWAYS the canonical first-http match the library
 *     extracts, and NEVER derived from or overwritten by the title, the prose, or
 *     the note (F-CAP-6 / F-CAP-15). Multi-URL prose loses every match past the
 *     first in the `url` column (documented loss); the whole prose still survives
 *     verbatim as the display text, so nothing is destroyed.
 *
 *   note (when present and non-blank) recomposes the display text as
 *     `${note} <em-dash> ${base}` -- the note ALWAYS leads, the em-dash separates,
 *     and the base is ALWAYS appended and NEVER discarded (the owner's locked "note
 *     leads, both survive" intent, CONTEXT #2 / D-CAP). A note over a plain-text or
 *     bare-URL share keeps the prose / URL as the base. "note-only -> note alone" is
 *     STRICTLY the no-base case (empty text AND no title) -- NOT "note + no
 *     EXTRA_SUBJECT title". A whitespace-only note is treated as absent (the base
 *     survives untouched).
 *
 *   display text is normalized with a TRIM over the SAME whitespace set fuel-read's
 *     `RANKED_FUEL_EXCLUSIONS` uses -- space (32), tab (9), LF (10), VT (11),
 *     FF (12), CR (13), NBSP (160) -- and an empty result becomes `null` (the
 *     blank-boundary rule: fuel-read drops NULL/blank/whitespace-only text in-query,
 *     so a blank row must never be written here). This is the only place the
 *     boundary is enforced for a share-written row.
 *
 * Pure: same inputs -> same output; no I/O; never throws.
 */

/** The em-dash separator between a leading note and its appended base label. */
const NOTE_SEPARATOR = " — ";

/**
 * The whitespace set fuel-read's `RANKED_FUEL_EXCLUSIONS` TRIM strips, matched here
 * so a blank / whitespace-only row can't slip past this boundary and get dropped
 * in-query downstream: tab (9), LF (10), VT (11), FF (12), CR (13), space (32),
 * NBSP (160). Built from char codes so no invisible literal lives in source.
 */
const BOUNDARY_WS = String.fromCharCode(9, 10, 11, 12, 13, 32, 160);
const BOUNDARY_TRIM = new RegExp(`^[${BOUNDARY_WS}]+|[${BOUNDARY_WS}]+$`, "g");

/** An incoming Android share payload, pre-parsed by the library / screen. */
export interface CaptureInput {
  /** Raw EXTRA_TEXT -- the shared prose, or a bare URL. */
  text: string;
  /** The FIRST http match the library extracted from `text`, or null. Canonical. */
  webUrl: string | null;
  /** The patched EXTRA_SUBJECT page title (Chrome), or null/undefined when absent. */
  title?: string | null;
  /** The user's optional note; leads the display text when present and non-blank. */
  note?: string | null;
}

/** The resolved fuel-row shape this module produces. */
export interface CapturePayload {
  /** The editable display text destined for `fuel.text`; null when blank. */
  displayText: string | null;
  /** The canonical URL destined for `fuel.url`; null when the share carried none. */
  url: string | null;
}

/** Trim the boundary whitespace set; return null when the result is empty. */
function nonBlank(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.replace(BOUNDARY_TRIM, "");
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolve an incoming share payload (+ optional note) to a fuel row's
 * `{ displayText, url }`. Pure: same inputs -> same output; no I/O; never throws.
 * See the module header for the full precedence.
 */
export function resolveCapturePayload(input: CaptureInput): CapturePayload {
  // base = first non-blank of title (EXTRA_SUBJECT) then text (prose / bare-URL).
  const base = nonBlank(input.title) ?? nonBlank(input.text);

  // url is ALWAYS the canonical first-http match -- never title/prose/note-derived.
  const url = input.webUrl ?? null;

  const note = nonBlank(input.note);

  // note leads; base is appended after the em-dash and never discarded. note-only
  // (no base present) -> note alone, no trailing separator.
  const composed = note
    ? base
      ? `${note}${NOTE_SEPARATOR}${base}`
      : note
    : base;

  return { displayText: nonBlank(composed), url };
}
