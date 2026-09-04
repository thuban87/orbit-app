/**
 * Pure bounded matching over the SQL-eligible local knowledge corpus.
 *
 * This is the sole tokenization boundary for knowledge search. It folds
 * diacritics (`café` becomes `cafe`), lowercases, and splits every non-letter
 * or non-number character. Both query and corpus text use `tokenize()`.
 *
 * `MAX_TOKENIZE_LEN` caps the amount of any raw query or corpus string scanned,
 * keeping a pathological stored value from making UI-side ranking unbounded.
 * This module intentionally has no React Native, Expo, or database imports.
 */

/** Maximum raw input characters considered by one tokenization operation. */
export const MAX_TOKENIZE_LEN = 4096;

export interface KnowledgeSearchItem {
  readonly custom_label: string | null;
  readonly value: string | null;
  readonly note: string | null;
}

/** The minimal structured corpus shape consumed by the reusable ranker. */
export interface SearchableKnowledgeCandidate {
  readonly entries: ReadonlyArray<{ readonly text: string }>;
}

/**
 * Normalize and split search text under the one shared tokenizer contract.
 * Diacritics are folded deliberately so an unaccented query can find a stored
 * accented name or note. The slice happens before normalization to bound work.
 */
export function tokenize(text: string): string[] {
  return text
    .slice(0, MAX_TOKENIZE_LEN)
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * Return the Levenshtein distance when it is at most `limit`; otherwise return
 * `limit + 1`. The calculation visits only the edit-distance band, so it exits
 * quickly once a candidate cannot meet the caller's threshold.
 */
export function boundedEditDistance(
  left: string,
  right: string,
  limit: number = 1,
): number {
  if (Math.abs(left.length - right.length) > limit) return limit + 1;

  const exceeded = limit + 1;
  let previous = Array.from({ length: right.length + 1 }, (_, index) =>
    index <= limit ? index : exceeded,
  );

  for (let i = 1; i <= left.length; i += 1) {
    const current = new Array<number>(right.length + 1).fill(exceeded);
    current[0] = i <= limit ? i : exceeded;
    const start = Math.max(1, i - limit);
    const end = Math.min(right.length, i + limit);
    let rowMinimum = current[0];

    for (let j = start; j <= end; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      rowMinimum = Math.min(rowMinimum, current[j]);
    }
    if (rowMinimum > limit) return exceeded;
    previous = current;
  }

  return previous[right.length];
}

function tokenScore(term: string, token: string): number | null {
  if (term === token) return 4;
  if (token.startsWith(term)) return 3;
  if (token.includes(term)) return 2;
  const limit = term.length >= 6 ? 2 : 1;
  return boundedEditDistance(term, token, limit) <= limit ? 1 : null;
}

/**
 * Score one already-tokenizable term against raw corpus text. Exact and prefix
 * matches outrank substrings, which outrank permitted typo matches. `null`
 * means the term matches no corpus token.
 */
export function scoreCandidate(
  term: string,
  corpusText: string,
): number | null {
  const terms = tokenize(term);
  if (terms.length !== 1) return null;

  let best: number | null = null;
  for (const token of tokenize(corpusText)) {
    const score = tokenScore(terms[0], token);
    if (score !== null && (best === null || score > best)) {
      best = score;
    }
  }
  return best;
}

function scoreQuery(query: string, corpusText: string): number | null {
  const terms = tokenize(query);
  if (terms.length === 0) return null;

  let total = 0;
  for (const term of terms) {
    const score = scoreCandidate(term, corpusText);
    if (score === null) return null;
    total += score;
  }
  return total;
}

function rankByCorpus<T>(
  query: string,
  candidates: readonly T[],
  corpusText: (candidate: T) => string,
): T[] {
  return candidates
    .map((candidate, index) => ({
      candidate,
      index,
      score: scoreQuery(query, corpusText(candidate)),
    }))
    .filter(
      (result): result is { candidate: T; index: number; score: number } =>
        result.score !== null,
    )
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((result) => result.candidate);
}

/**
 * Rank structured knowledge candidates best-first. Every query token must match
 * at least one corpus token; entries retain their raw source provenance for the
 * caller and are never reparsed outside this shared tokenizer boundary.
 */
export function rankCandidates<T extends SearchableKnowledgeCandidate>(
  query: string,
  candidates: readonly T[],
): T[] {
  return rankByCorpus(query, candidates, (candidate) =>
    candidate.entries.map((entry) => entry.text).join(" "),
  );
}

function itemText(item: KnowledgeSearchItem): string {
  return [item.custom_label, item.value, item.note]
    .filter((value): value is string => value !== null)
    .join(" ");
}

/**
 * Compatibility adapter for the Plan 01 memory-only tracer. The full structured
 * corpus uses `rankCandidates`; this wrapper keeps its original callers on the
 * same shared tokenizer and scorer while Task 2 widens the corpus.
 */
export function searchKnowledge<T extends KnowledgeSearchItem>(
  corpus: readonly T[],
  query: string,
): T[] {
  return rankByCorpus(query, corpus, itemText);
}
