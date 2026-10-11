import type { ResearchItem } from "@/db/compose-research-read";
import { customValueDisplayText } from "@/profile/knowledge-presentation";
import { formatStoredBirthdayForDisplay } from "@/utils/dates";

/**
 * The caption a Research item shows (render only; 38.9 D-23, D-66, D-70).
 *
 * - The first-class birthday uses the birthday formatter (D-70).
 * - A custom field shows its value through `customValueDisplayText`, so a Date
 *   field reads "Oct 20" / "Jun 2, 2025" and a value the date parser rejects
 *   stays raw; every other type is unchanged (38.9-13 out-of-scope finding #2).
 * - Every other item shows its value as read.
 *
 * Never written back: `item.value` and what Add to AI carries stay the raw
 * stored text.
 */
export function researchItemDisplayValue(
  item: Pick<ResearchItem, "id" | "value" | "fieldType">,
): string {
  if (item.id === "firstclass:birthday") {
    return formatStoredBirthdayForDisplay(item.value);
  }
  if (item.fieldType !== undefined) {
    return customValueDisplayText(item.fieldType, item.value);
  }
  return item.value;
}
