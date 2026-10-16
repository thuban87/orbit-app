/**
 * LinksEditor's warn-only rule (38.11 D-88, review WR-04). PURE — no
 * react-native, so it is node-tested.
 *
 * A row with label text but an empty URL is dropped on Save by
 * `buildLinksForDiff` (`src/screens/contact-link-drafts.ts`). Add and Edit
 * Contact both mount LinksEditor, so both show this caption under such a row.
 * Warn only: Save is never blocked, and the row is still dropped (D-88).
 */
import type { LinkDraft } from "@/components/LinksEditor";

/** The caption under a label-only row (D-88, the owner's exact words). */
export const LINK_MISSING_URL_CAPTION =
  "Add a link or this row won't be saved.";

/** True when the row has label text but no URL, so Save will drop it. */
export function linkRowMissingUrl(
  link: Pick<LinkDraft, "url" | "label">,
): boolean {
  return (
    link.url.trim().length === 0 &&
    link.label !== null &&
    link.label.trim().length > 0
  );
}
