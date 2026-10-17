import type { ReconcileSelection } from "@/db/reconcile-apply";
import type {
  ReconcileDiffResult,
  ReconcileFieldDiff,
} from "@/logic/reconcile-diff";

export type ReconcileChoice = "orbit" | `source:${string}`;
export type ReconcileBulkMode =
  | "keep-orbit"
  | "use-contact-values"
  | "apply-recommendation";

function sourceMethods(field: ReconcileFieldDiff) {
  if (field.fieldFamily !== "phones" && field.fieldFamily !== "emails")
    return undefined;
  return field.sourceOptions.map((option) => ({
    type:
      field.fieldFamily === "phones" ? ("phone" as const) : ("email" as const),
    value: option.value ?? "",
  }));
}

/**
 * The links a review is remembered on: every link behind the field's options,
 * or — for a field with no source option (removed-from-source) — every read
 * link of the card, so that review is remembered too (convergence c4 E-4).
 */
function reviewedLinkIds(
  diff: ReconcileDiffResult,
  field: ReconcileFieldDiff,
): number[] {
  const fromOptions = [
    ...new Set(field.sourceOptions.flatMap((option) => option.sourceLinkIds)),
  ];
  return fromOptions.length > 0 ? fromOptions : [...(diff.sourceLinkIds ?? [])];
}

/** Carries the exact reviewed option through both detail and bulk apply. */
export function buildReconcileSelections(
  diff: ReconcileDiffResult,
  choices: Partial<Record<string, ReconcileChoice>> | ReconcileBulkMode,
): ReconcileSelection[] {
  const bulk = typeof choices === "string" ? choices : null;
  return diff.fields.flatMap((field) => {
    if (bulk && bulk !== "keep-orbit") {
      if (field.outcome !== "additive" || field.fieldFamily === "photo")
        return [];
      if (
        (field.fieldFamily === "name" || field.fieldFamily === "birthday") &&
        field.sourceOptions.length !== 1
      )
        return [];
    }

    const choice =
      bulk === "keep-orbit"
        ? "orbit"
        : bulk
          ? `source:${field.sourceOptions[0]?.optionId ?? ""}`
          : (choices as Partial<Record<string, ReconcileChoice>>)[
              field.fieldFamily
            ];
    if (!choice) return [];
    const useSource = choice !== "orbit";
    const chosenOption = useSource
      ? field.sourceOptions.find(
          (option) => `source:${option.optionId}` === choice,
        )
      : undefined;
    if (useSource && !chosenOption) return [];
    return [
      {
        fieldFamily: field.fieldFamily,
        baseline: field.orbitBaseline,
        useSource,
        sourceOptionId: chosenOption?.optionId,
        sourceValue:
          (field.fieldFamily === "name" || field.fieldFamily === "birthday") &&
          useSource
            ? (chosenOption?.value ?? null)
            : field.sourceValue,
        sourceMethods: sourceMethods(field),
        sourceLinkIds: reviewedLinkIds(diff, field),
        reviewedValue: field.reviewedComparable ?? field.sourceValue,
        stagedPhotoRelative:
          chosenOption?.stagedPhotoRelative ??
          field.sourceOptions[0]?.stagedPhotoRelative ??
          null,
        // The chosen option's own photo hash (convergence c4 E-4).
        photoContentHash: chosenOption?.value ?? field.sourceValue,
      },
    ];
  });
}

export function remainingReconcileFields(
  mode: ReconcileBulkMode,
  diff: ReconcileDiffResult,
  staleFields: readonly string[],
): number {
  if (mode === "keep-orbit") return staleFields.length;
  const selected = new Set(
    buildReconcileSelections(diff, mode).map(
      (selection) => selection.fieldFamily,
    ),
  );
  return diff.fields.filter(
    (field) =>
      !selected.has(field.fieldFamily) ||
      staleFields.includes(field.fieldFamily),
  ).length;
}
