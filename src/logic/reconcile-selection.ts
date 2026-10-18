import type { ReconcileSelection } from "@/db/reconcile-apply";
import type {
  ReconcileDiffResult,
  ReconcileFieldDiff,
  ReconcileFieldOption,
} from "@/logic/reconcile-diff";

export type ReconcileSourceChoice = `source:${string}`;
export type ReconcileChoice = "orbit" | ReconcileSourceChoice;
/**
 * One field's choice. Phones and emails take several picks (convergence c3
 * D-1, D-47 "option(s) tapped"); name, birthday and photo stay a single
 * `ReconcileChoice`.
 */
export type ReconcileFamilyChoice =
  | ReconcileChoice
  | readonly ReconcileSourceChoice[];
export type ReconcileChoices = Partial<Record<string, ReconcileFamilyChoice>>;
export type ReconcileBulkMode = "keep-orbit" | "use-contact-values";

function isMethodFamily(field: ReconcileFieldDiff): boolean {
  return field.fieldFamily === "phones" || field.fieldFamily === "emails";
}

function choiceFor(option: ReconcileFieldOption): ReconcileSourceChoice {
  return `source:${option.optionId}`;
}

/** The phone's methods to add, each with its own value and label (D-47). */
function sourceMethods(
  field: ReconcileFieldDiff,
  options: readonly ReconcileFieldOption[],
) {
  if (!isMethodFamily(field)) return undefined;
  const type =
    field.fieldFamily === "phones" ? ("phone" as const) : ("email" as const);
  return options.map((option) => ({
    type,
    value: option.rawValue ?? option.value ?? "",
    label: option.label ?? null,
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

/** The picked options, in display order (`field.sourceOptions` order). */
function pickedOptions(
  field: ReconcileFieldDiff,
  choice: ReconcileFamilyChoice,
): ReconcileFieldOption[] {
  const ids = new Set<string>(typeof choice === "string" ? [choice] : choice);
  return field.sourceOptions.filter((option) => ids.has(choiceFor(option)));
}

/**
 * Carries the exact reviewed option(s) through both detail and bulk apply.
 *
 * | Mode | Family | Applied | Remembered |
 * |---|---|---|---|
 * | Detail picks | phones/emails | exactly the picks, labelled; first pick (display order) primary | full source serialization |
 * | Detail pick | name/birthday/photo | the one chosen option | as before |
 * | Bulk use-contact-values | phones/emails (additive) | every option, labelled; Orbit primary unchanged | full source serialization |
 * | Bulk use-contact-values | name/birthday (one option), photo skipped | as before | as before |
 * | Keep Orbit | any | nothing | as before |
 *
 * Untapped options are remembered as reviewed (`reviewedValue` is the whole
 * source serialization), so they are not offered again until the phone side
 * changes (convergence c3 D-1; D-45).
 */
export function buildReconcileSelections(
  diff: ReconcileDiffResult,
  choices: ReconcileChoices | ReconcileBulkMode,
): ReconcileSelection[] {
  const bulk = typeof choices === "string" ? choices : null;
  return diff.fields.flatMap((field): ReconcileSelection[] => {
    if (bulk && bulk !== "keep-orbit") {
      if (field.outcome !== "additive" || field.fieldFamily === "photo")
        return [];
      if (
        (field.fieldFamily === "name" || field.fieldFamily === "birthday") &&
        field.sourceOptions.length !== 1
      )
        return [];
    }

    let picked: ReconcileFieldOption[];
    if (bulk === "keep-orbit") picked = [];
    else if (bulk)
      picked = isMethodFamily(field)
        ? field.sourceOptions
        : field.sourceOptions.slice(0, 1);
    else {
      const choice = (choices as ReconcileChoices)[field.fieldFamily];
      // No choice, or an emptied pick list, never reaches Apply.
      if (choice === undefined || (Array.isArray(choice) && !choice.length))
        return [];
      if (choice === "orbit") picked = [];
      else {
        picked = pickedOptions(field, choice);
        if (picked.length === 0) return [];
        if (!isMethodFamily(field)) picked = picked.slice(0, 1);
      }
    }

    const useSource = picked.length > 0;
    const chosenOption = picked[0];
    return [
      {
        fieldFamily: field.fieldFamily,
        baseline: field.orbitBaseline,
        useSource,
        sourceOptionId: chosenOption?.optionId,
        ...(isMethodFamily(field) && useSource
          ? { sourceOptionIds: picked.map((option) => option.optionId) }
          : {}),
        // A detail pick names the new primary (D-102); bulk never does.
        ...(isMethodFamily(field) && useSource && !bulk
          ? { electPrimary: true }
          : {}),
        sourceValue:
          (field.fieldFamily === "name" || field.fieldFamily === "birthday") &&
          useSource
            ? (chosenOption?.value ?? null)
            : field.sourceValue,
        sourceMethods: useSource ? sourceMethods(field, picked) : undefined,
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

/**
 * The detail screen's opening choices (convergence c4 E-5):
 * - additive phones/emails → every source option preselected (display order),
 *   matching the remembered full list; the person can untick;
 * - additive name/birthday/photo → the first source option;
 * - conflict → nothing (the person must choose);
 * - removed-from-source → Keep Orbit.
 */
export function defaultReconcileChoices(
  diff: Pick<ReconcileDiffResult, "fields">,
): ReconcileChoices {
  const choices: ReconcileChoices = {};
  for (const field of diff.fields) {
    if (field.outcome === "conflict") continue;
    if (field.outcome === "additive" && field.sourceOptions.length > 0)
      choices[field.fieldFamily] = isMethodFamily(field)
        ? field.sourceOptions.map(choiceFor)
        : choiceFor(field.sourceOptions[0]);
    else choices[field.fieldFamily] = "orbit";
  }
  return choices;
}

/**
 * A tap on one row of a phones/emails field. Orbit clears the source picks; a
 * source option toggles; removing the last source pick falls back to Orbit,
 * so an empty pick list never reaches Apply (convergence c3 D-1).
 */
export function toggleReconcileMethodChoice(
  current: ReconcileFamilyChoice | undefined,
  tapped: ReconcileChoice,
): ReconcileFamilyChoice {
  if (tapped === "orbit") return "orbit";
  const picks =
    current === undefined || current === "orbit"
      ? []
      : typeof current === "string"
        ? [current]
        : [...current];
  const next = picks.includes(tapped)
    ? picks.filter((pick) => pick !== tapped)
    : [...picks, tapped];
  return next.length > 0 ? next : "orbit";
}

/** The picks a phones/emails row shows as selected. */
export function selectedReconcileChoiceIds(
  choice: ReconcileFamilyChoice | undefined,
): ReconcileChoice[] {
  if (choice === undefined) return [];
  return typeof choice === "string" ? [choice] : [...choice];
}

/** A field still needs a choice: none made, or an emptied pick list. */
export function isReconcileChoiceUnresolved(
  choice: ReconcileFamilyChoice | undefined,
): boolean {
  return choice === undefined || (Array.isArray(choice) && choice.length === 0);
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
