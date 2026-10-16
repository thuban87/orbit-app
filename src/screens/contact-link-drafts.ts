/**
 * Shared link-draft shaping for Add Contact and Edit Contact (38.11 D-48).
 *
 * Moved out of `EditContactScreen.tsx` so both forms turn the `LinksEditor`
 * draft into DAO input by the same rules: trim the url and the label, an empty
 * label becomes null, and a blank-url row is dropped (an added-then-untyped
 * row, or a cleared existing link). On Edit, dropping a cleared existing
 * (id-bearing) row makes `applyLinkDiff` DELETE it — the "empty the URL to
 * remove the link" behaviour. On Add, rows carry no `id` and become
 * `addLinksCore` inserts inside the create transaction.
 *
 * PURE — no react-native, no DB.
 */

import type { LinkDraft } from "@/components/LinksEditor";
import type { DraftLink } from "@/db/contact-links-dao";

/** Shape the editor draft for the link writers (see the module header). */
export function buildLinksForDiff(draft: readonly LinkDraft[]): DraftLink[] {
  return draft
    .map((l) => ({
      id: l.id,
      uid: l.uid,
      url: l.url.trim(),
      label: l.label && l.label.trim().length > 0 ? l.label.trim() : null,
    }))
    .filter((l) => l.url.length > 0);
}
