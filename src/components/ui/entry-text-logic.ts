/**
 * Text rules for the shared entry field (38.10 D-66, D-114; D-129).
 *
 * The field is multi-line for wrapping only: Enter saves, so a newly typed or
 * pasted line break never belongs in the value and becomes a space. A line
 * break that is already in the stored value (an imported note, a linked
 * interaction note) is kept, on edit and at save (D-129).
 *
 * `sanitizeEntryChange` runs on every keystroke and never trims — trimming
 * there would drop the space a controlled TextInput just received and run
 * words together (convergence c1 F-U2, Codex C-05). Trimming happens only at
 * save, through `normalizeEntryText`.
 */

import { SPACING } from "@/theme/tokens/spacing";
import { TYPOGRAPHY } from "@/theme/tokens/typography";

const NEWLINE = /\r\n|\r|\n/g;

/** Lines shown before the field scrolls (D-66: "about 3 lines"). */
export const ENTRY_VISIBLE_LINES = 3;

/** The field's top and bottom padding. */
export const ENTRY_VERTICAL_PADDING = SPACING.sm;

/**
 * The field's height cap: `ENTRY_VISIBLE_LINES` whole body lines plus the
 * vertical padding (D-66). Android scales a TextInput's `lineHeight` by the
 * system font scale but not its `maxHeight`, so a fixed cap clipped the
 * third line at font scale 1.15 and the field scrolled its first line in
 * half, mid-glyph (D-147, the share card's note). The cap scales with the
 * font so whole lines fit at every scale. A non-finite or non-positive scale
 * counts as 1. PURE.
 */
export function entryFieldMaxHeight(fontScale: number): number {
  const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  return Math.ceil(
    ENTRY_VISIBLE_LINES * TYPOGRAPHY.body.lineHeight * scale +
      2 * ENTRY_VERTICAL_PADDING,
  );
}

/** Each `\r\n`, `\r` or `\n` becomes one space; nothing is trimmed. */
export function sanitizeEntryInput(value: string): string {
  return value.replace(NEWLINE, " ");
}

/**
 * While typing (D-129): flatten only the line breaks this change inserted.
 *
 * A TextInput change is one contiguous replacement, so the inserted segment
 * is what lies between the longest common prefix and the longest common
 * suffix of `previous` and `next`. Only that segment goes through
 * `sanitizeEntryInput`; text the change did not touch — including any line
 * break already in `previous` — is returned as-is. The result never holds
 * more line breaks than `previous`. PURE.
 */
export function sanitizeEntryChange(previous: string, next: string): string {
  if (previous === next) return next;
  const maxShared = Math.min(previous.length, next.length);
  let prefix = 0;
  while (prefix < maxShared && previous[prefix] === next[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < maxShared - prefix &&
    previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const inserted = next.slice(prefix, next.length - suffix);
  return (
    next.slice(0, prefix) +
    sanitizeEntryInput(inserted) +
    next.slice(next.length - suffix)
  );
}

/**
 * At save: trim only. Newly typed or pasted line breaks were already turned
 * into spaces as they were entered; any line break still in the value was
 * already stored and is kept (D-129).
 */
export function normalizeEntryText(value: string): string {
  return value.trim();
}

/** A blank or whitespace-only value cannot be saved. */
export function isSavableEntry(value: string): boolean {
  return normalizeEntryText(value).length > 0;
}
