/**
 * The one count-word helper (38.9 D-21; audit A-16, J-17). Every user-visible
 * count goes through it so a single item reads singular ("1 contact"), never
 * "1 contacts". English only: exactly one is singular; zero and every other
 * count is plural.
 *
 * `many` defaults to `one + "s"`; pass it for irregular plurals
 * ("person" / "people", "memory" / "memories").
 */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${pluralWord(n, one, many)}`;
}

/**
 * The count word alone, for a sentence that places the number elsewhere
 * ("Log 3 interactions?" built as `Log ${n} ${pluralWord(n, "interaction")}?`
 * reads the same as `plural`, but "Set all 3 contacts" needs the number after
 * "all").
 */
export function pluralWord(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}
