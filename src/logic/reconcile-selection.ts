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
 * The links a review is remembered on: every link that was read for the card
 * (38.12 review B-CR-02), plus every link behind the field's options (a
 * stored diff from before `sourceLinkIds` existed carries only those).
 *
 * Memory is merged across the read links when the next check classifies, so
 * a review written only to the option links left another read link's stale
 * memory in the merge and the same difference came back forever (D-45).
 */
function reviewedLinkIds(
  diff: ReconcileDiffResult,
  field: ReconcileFieldDiff,
): number[] {
  return [
    ...new Set([
      ...(diff.sourceLinkIds ?? []),
      ...field.sourceOptions.flatMap((option) => option.sourceLinkIds),
    ]),
  ];
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
 * | Detail picks, one ticked by the person | phones/emails | exactly the picks, labelled; the person's own tick primary | full source serialization |
 * | Detail picks, only pre-ticked defaults (or only unticks) | phones/emails | exactly the picks, labelled; Orbit primary unchanged (D-144, D-148) | full source serialization |
 * | Detail pick | name/birthday/photo | the one chosen option | as before |
 * | Bulk use-contact-values | phones/emails (additive) | every option, labelled; Orbit primary unchanged | full source serialization |
 * | Bulk use-contact-values | name/birthday (one option), photo skipped | as before | as before |
 * | Keep Orbit | any | nothing | as before |
 *
 * Untapped options are remembered as reviewed (`reviewedValue` is the whole
 * source serialization), so they are not offered again until the phone side
 * changes (convergence c3 D-1; D-45).
 *
 * `primaryPicks` (38.12 D-144 refined by D-148, owner): per field, the value
 * the person ticked themselves (the latest such tick still ticked; see
 * `userPrimaryPick`). Only that value can become Orbit's primary; pre-ticked
 * defaults and unticks never elect, so with no own tick Orbit's primary
 * stays. Bulk ignores it and never elects.
 */
export function buildReconcileSelections(
  diff: ReconcileDiffResult,
  choices: ReconcileChoices | ReconcileBulkMode,
  primaryPicks: Partial<Record<string, ReconcileSourceChoice>> = {},
): ReconcileSelection[] {
  const bulk = typeof choices === "string" ? choices : null;
  return diff.fields.flatMap((field): ReconcileSelection[] => {
    // A missing-source card's placeholder field is not a reviewed value:
    // Keep Orbit there is the 'source' memory (rememberMissingSourceKeptCore),
    // never a NULL name review over the links that still read (38.12 review
    // B-WR-01; the detail's Keep as is writes no selection either, D-45).
    if (field.outcome === "missing-source") return [];
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

    // D-148: only a value the person ticked themselves may become primary.
    // It is moved first, because Apply elects the first picked method.
    const primaryPick = bulk ? undefined : primaryPicks[field.fieldFamily];
    const primaryOption =
      isMethodFamily(field) && primaryPick
        ? picked.find((option) => choiceFor(option) === primaryPick)
        : undefined;
    if (primaryOption)
      picked = [
        primaryOption,
        ...picked.filter((option) => option !== primaryOption),
      ];
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
        // The person's own tick names the new primary (D-102, D-148);
        // pre-ticked defaults, unticks (D-144) and bulk never do.
        ...(primaryOption ? { electPrimary: true } : {}),
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

/**
 * The values the person ticked themselves in one phones/emails field, oldest
 * first (38.12 D-148). A tap that ticks a value moves it to the end; a tap
 * that unticks it removes it; Orbit clears the list. Pre-ticked defaults
 * never enter it, so unticking one never counts as choosing a primary.
 */
export function nextUserTicks(
  ticks: readonly ReconcileSourceChoice[],
  next: ReconcileFamilyChoice,
  tapped: ReconcileChoice,
): ReconcileSourceChoice[] {
  if (tapped === "orbit") return [];
  const without = ticks.filter((tick) => tick !== tapped);
  return selectedReconcileChoiceIds(next).includes(tapped)
    ? [...without, tapped]
    : without;
}

/** The value that becomes primary: the latest own tick still ticked (D-148). */
export function userPrimaryPick(
  ticks: readonly ReconcileSourceChoice[],
  choice: ReconcileFamilyChoice | undefined,
): ReconcileSourceChoice | undefined {
  const selected = selectedReconcileChoiceIds(choice);
  return [...ticks].reverse().find((tick) => selected.includes(tick));
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
