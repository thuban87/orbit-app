/**
 * The merge review's count lines (38.12 D-44): one `plural()` line per
 * non-zero count, the four lines the review always had first, then every
 * other table the merge moves. Pure, so the wording is unit-tested without a
 * renderer.
 */
import type { MergeImpactCounts } from "@/db/merge-impact-read";
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
