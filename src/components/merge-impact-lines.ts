/**
 * The merge review's count lines (38.12 D-44): one `plural()` line per
 * non-zero count, the four lines the review always had first, then every
 * other table the merge moves. Pure, so the wording is unit-tested without a
 * renderer.
 */
import type {
  MergeDroppedItems,
  MergeImpactCounts,
} from "@/db/merge-impact-read";
import { plural } from "@/utils/plural";

const LINES: ReadonlyArray<
  [keyof MergeImpactCounts, string, string | undefined]
> = [
  ["interactions", "interaction", undefined],
  ["events", "event", undefined],
  ["methods", "contact method", undefined],
  ["externalLinks", "external link", undefined],
  ["memories", "memory", "memories"],
  ["keyPeople", "Key Person", "Key People"],
  [
    "currentState",
    "Last Talked About or Current Location entry",
    "Last Talked About or Current Location entries",
  ],
  ["offLimits", "Off Limits item", undefined],
  ["customValues", "custom field value", undefined],
  ["links", "link", undefined],
  ["pendingAssists", "pending confirmation", undefined],
];

export function mergeImpactLines(counts: MergeImpactCounts): string[] {
  return LINES.filter(([key]) => counts[key] > 0).map(([key, one, many]) =>
    plural(counts[key], one, many),
  );
}

/**
 * The merge review's "not kept" lines (38.12 D-146): the absorbed person's
 * own Profile layout/background and Orrery system choices, which the
 * survivor's replace. Empty when there is nothing to drop.
 */
export function mergeDroppedLines(dropped: MergeDroppedItems): string[] {
  return [
    ...(dropped.profilePresentation ? ["Profile layout and background"] : []),
    ...(dropped.orrerySystemChoices > 0
      ? [plural(dropped.orrerySystemChoices, "Orrery system choice")]
      : []),
  ];
}
