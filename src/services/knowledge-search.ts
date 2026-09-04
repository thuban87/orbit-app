/** Pure bounded matching over the SQL-eligible local knowledge corpus. */

export interface KnowledgeSearchItem {
  readonly custom_label: string | null;
  readonly value: string | null;
  readonly note: string | null;
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

/**
 * Return the Levenshtein distance when it is at most `limit`; otherwise return
 * `limit + 1` without completing an unnecessarily large matrix.
 */
export function boundedEditDistance(
  left: string,
  right: string,
  limit: number = 1,
): number {
  if (Math.abs(left.length - right.length) > limit) return limit + 1;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    let rowMinimum = current[0];
    for (let j = 1; j <= right.length; j += 1) {
      const value = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      current.push(value);
      rowMinimum = Math.min(rowMinimum, value);
    }
    if (rowMinimum > limit) return limit + 1;
    previous = current;
  }
  return previous[right.length];
}

function itemText(item: KnowledgeSearchItem): string {
  return [item.custom_label, item.value, item.note]
    .filter((value): value is string => value !== null)
    .join(" ");
}

function matchesTerm(text: string, rawTerm: string): boolean {
  const term = normalized(rawTerm);
  const corpus = normalized(text);
  if (term === "" || corpus === "") return false;
  if (corpus.includes(term)) return true;
  const words = corpus.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return words.some(
    (word) => word.startsWith(term) || boundedEditDistance(word, term) <= 1,
  );
}

/**
 * Match every whitespace-delimited query term against user-facing corpus text.
 * SQL decides eligibility; this module alone decides term matching, including a
 * single-edit typo, so it stays React Native- and database-free.
 */
export function searchKnowledge<T extends KnowledgeSearchItem>(
  corpus: readonly T[],
  query: string,
): T[] {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return corpus.filter((item) => {
    const text = itemText(item);
    return terms.every((term) => matchesTerm(text, term));
  });
}
