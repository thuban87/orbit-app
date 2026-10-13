/**
 * LIKE-pattern escaping for `?`-bound SQL.
 *
 * A `?` bind stops SQL injection, but it does not make `%` or `_` literal
 * inside a LIKE pattern. Escaping them here, paired with `ESCAPE '\'` in the
 * query, makes a term such as "50%" match only text that contains "50%"
 * (T-07-04, T-38.10-23).
 */

/**
 * Escape a raw search term's LIKE metacharacters.
 *
 * Order matters: the backslash is escaped first (it is the escape character),
 * then `%` and `_`. Otherwise the backslashes added for `%` / `_` would be
 * escaped a second time.
 */
export function escapeLike(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
