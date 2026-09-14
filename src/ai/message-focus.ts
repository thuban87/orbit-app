/** Permission-preserving projection for session-only Message Focus. */
import type { PromptMessageFocusItem } from "@/ai/prompt-types";
import type { ResearchItem } from "@/db/compose-research-read";

/** The product-level ceiling for one Compose session (COMP-11 / AICFG-08). */
export const MESSAGE_FOCUS_CAP = 3;

/**
 * Intersect a possibly stale session selection with a fresh Research snapshot.
 *
 * Only the fresh row is trusted for permission and content. This means removing
 * permission after selecting an item takes effect on the next generation; the
 * stale stored label/value can never cross the device boundary. Selection order
 * is preserved, duplicate identities are ignored, and the product cap is
 * enforced again at this final projection boundary.
 */
export function projectMessageFocus(
  selected: ReadonlyArray<ResearchItem>,
  current: ReadonlyArray<ResearchItem>,
): ReadonlyArray<PromptMessageFocusItem> {
  const currentById = new Map(current.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const projected: PromptMessageFocusItem[] = [];

  for (const staleSelection of selected) {
    if (projected.length >= MESSAGE_FOCUS_CAP) break;
    if (seen.has(staleSelection.id)) continue;
    seen.add(staleSelection.id);

    const fresh = currentById.get(staleSelection.id);
    if (fresh?.aiEligible !== true || fresh.isOffLimits === true) {
      continue;
    }
    projected.push({ label: fresh.label, value: fresh.value });
  }

  return projected;
}
