/**
 * Pure helpers for the one empty-state component (38.9 D-20). No React or
 * react-native import, so vitest runs them in node.
 */

/**
 * The longest search term an empty state echoes before cutting it off. D-20
 * says only "truncated"; 40 characters is this plan's pick (38.9-13), and the
 * heading also renders on one line with an ellipsis.
 */
export const SEARCH_ECHO_MAX_CHARS = 40;

/** A search term as an empty state echoes it: trimmed, cut at the limit with "…". */
export function truncateSearchEcho(term: string): string {
  const trimmed = term.trim();
  if (trimmed.length <= SEARCH_ECHO_MAX_CHARS) return trimmed;
  return `${trimmed.slice(0, SEARCH_ECHO_MAX_CHARS)}…`;
}

/**
 * The empty-state heading. With a non-blank search term it echoes the term in
 * quotes after the heading: `No matches for "alex"` (D-20).
 */
export function emptyStateHeading(heading: string, term?: string): string {
  if (term == null || term.trim() === "") return heading;
  return `${heading} "${truncateSearchEcho(term)}"`;
}
