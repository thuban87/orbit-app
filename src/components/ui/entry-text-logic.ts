/**
 * Text rules for the shared entry field (38.10 D-66).
 *
 * The field is multi-line for wrapping only: Enter saves, so a newline never
 * belongs in the value. `sanitizeEntryInput` runs on every keystroke and
 * never trims — trimming there would drop the space a controlled TextInput
 * just received and run words together (convergence c1 F-U2, Codex C-05).
 * Trimming happens only at save, through `normalizeEntryText`.
 */

const NEWLINE = /\r\n|\r|\n/g;

/** While typing: each `\r\n`, `\r` or `\n` becomes one space; nothing is trimmed. */
export function sanitizeEntryInput(value: string): string {
  return value.replace(NEWLINE, " ");
}

/** At save: `sanitizeEntryInput` plus trim. */
export function normalizeEntryText(value: string): string {
  return sanitizeEntryInput(value).trim();
}

/** A blank or whitespace-only value cannot be saved. */
export function isSavableEntry(value: string): boolean {
  return normalizeEntryText(value).length > 0;
}
