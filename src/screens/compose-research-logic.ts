import type { ResearchItem } from "@/db/compose-research-read";
import { parsers } from "@/db/field-parsers";
import {
  customValueDisplayText,
  formatCustomFieldValue,
} from "@/profile/knowledge-presentation";
import {
  formatDisplayDateOrFallback,
  formatStoredBirthdayForDisplay,
} from "@/utils/dates";

/** One display group of Research items, keyed by its stable group id. */
export interface ResearchGroup {
  id: string;
  name: string;
  items: ResearchItem[];
}

/**
 * Group Research items by `groupId` in first-seen order (D-29, J-09, J-X01).
 * Memories are read pinned-first, so items of one section need not be
 * adjacent; a first-seen map keeps each section in one group, and keying by id
 * (not name) keeps two same-named groups distinct with unique React keys.
 */
export function groupResearchItems(
  items: ReadonlyArray<ResearchItem>,
): ResearchGroup[] {
  const byId = new Map<string, ResearchGroup>();
  for (const item of items) {
    const existing = byId.get(item.groupId);
    if (existing) {
      existing.items.push(item);
    } else {
      byId.set(item.groupId, {
        id: item.groupId,
        name: item.group,
        items: [item],
      });
    }
  }
  return [...byId.values()];
}

/**
 * Whether a Research row draws its label line. An empty label (an unlabeled
 * Off Limits item, D-111) or a label that only repeats its group heading
 * (J-09) is not drawn, so the item's text shows once. Render only: the item's
 * `label` is unchanged, and Message Focus still carries it.
 */
export function researchItemShowsLabel(
  item: Pick<ResearchItem, "label">,
  groupName: string,
): boolean {
  const label = item.label.trim();
  return label !== "" && label !== groupName;
}

/** A custom-field value through the Profile's shared value formatter. */
function customFieldDisplay(
  item: Pick<ResearchItem, "value"> & {
    fieldType: NonNullable<ResearchItem["fieldType"]>;
  },
): string {
  if (item.fieldType === "date") {
    return customValueDisplayText(item.fieldType, item.value);
  }
  const parsed = parsers[item.fieldType](item.value);
  // A value the parser rejects stays raw, as on the Profile.
  if (!parsed.ok || parsed.value == null) {
    return customValueDisplayText(item.fieldType, item.value);
  }
  return formatCustomFieldValue(item.fieldType, parsed.value);
}

/** Join a text value and a formatted date, dropping whichever is blank. */
function withDate(value: string, date: string | undefined): string {
  if (date === undefined || date.trim() === "") return value;
  const shown = formatDisplayDateOrFallback(date, date);
  return value.trim() === "" ? shown : `${value} · ${shown}`;
}

/**
 * The caption a Research item shows (render only; 38.9 D-23, D-66, D-70;
 * D-29).
 *
 * - The first-class birthday uses the birthday formatter (D-70).
 * - A custom field shows its value through the Profile's shared value
 *   formatter: a Date field through `customValueDisplayText` ("Oct 20" /
 *   "Jun 2, 2025", raw when the date parser rejects it), a toggle as Yes/No,
 *   and a value its parser rejects stays raw.
 * - A memory (every memory-type section) shows its text and its meaningful
 *   date through the D-48 date formatter, raw when not a date (38.9 D-65).
 * - A current-state entry shows its text and its entry date the same way.
 * - Key people and every other item show their text as read: free text has
 *   no value formatter.
 *
 * Never written back: `item.value` and what Add to AI carries stay the raw
 * stored text.
 */
export function researchItemDisplayValue(
  item: Pick<
    ResearchItem,
    "id" | "value" | "fieldType" | "meaningfulDate" | "entryDate"
  >,
): string {
  if (item.id === "firstclass:birthday") {
    return formatStoredBirthdayForDisplay(item.value);
  }
  if (item.fieldType !== undefined) {
    return customFieldDisplay({ ...item, fieldType: item.fieldType });
  }
  if (item.id.startsWith("memory:")) {
    return withDate(item.value, item.meaningfulDate);
  }
  if (item.id.startsWith("current:")) {
    return withDate(item.value, item.entryDate);
  }
  return item.value;
}
