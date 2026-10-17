/**
 * The import duplicate choices (38.6 D-25 F-1): Duplicate review's "Choose an
 * existing contact" sheet and Import review's "might already be in Orbit"
 * choices both name an existing Orbit contact. Each choice carries that
 * contact's name and stored RELATIVE photo path from its header read, so the
 * row renders the photo through Avatar and follows the display revision (D-01).
 *
 * Pure: the caller supplies the header reader (`getContactHeader`), so this
 * module imports no DB code.
 *
 * Review matches (38.12 D-52) passes `REVIEW_MATCH_CHOICES`: phone/email
 * matches first (each group keeps the stored score order) and no candidate
 * scored below "possible". Import review passes no option, so its choices are
 * unchanged: every live candidate, in input order. Advisory only — evidence
 * never auto-links (ADR-067).
 */
import { candidateEvidenceStrength } from "@/services/import/duplicate-evidence";

/** The header fields a choice needs: the name and the stored relative photo. */
export interface ExistingContactHeader {
  name: string;
  photo: string | null;
}

export interface ExistingContactChoiceOptions {
  /** List candidates with phone or email evidence before the rest. */
  strongEvidenceFirst?: boolean;
  /** Drop candidates whose evidence scores below this strength. */
  minimumStrength?: "possible";
}

/** Review matches' choices (D-52): phone/email first, nothing below "possible". */
export const REVIEW_MATCH_CHOICES: ExistingContactChoiceOptions = {
  strongEvidenceFirst: true,
  minimumStrength: "possible",
};

type WithSignals = { contactId: number; signals?: readonly unknown[] };

function hasStrongEvidence(candidate: WithSignals): boolean {
  const signals = candidate.signals ?? [];
  return signals.includes("phoneMatch") || signals.includes("emailMatch");
}

/** Filter and order by the options; input order is kept within each group. */
function reviewCandidates<T extends WithSignals>(
  candidates: readonly T[],
  options: ExistingContactChoiceOptions,
): readonly T[] {
  const kept = options.minimumStrength
    ? candidates.filter(
        (candidate) => candidateEvidenceStrength(candidate.signals) !== "new",
      )
    : candidates;
  if (!options.strongEvidenceFirst) return kept;
  return [
    ...kept.filter(hasStrongEvidence),
    ...kept.filter((candidate) => !hasStrongEvidence(candidate)),
  ];
}

/**
 * Read every offered candidate's header concurrently and return, in offered
 * order, each candidate that still exists with its `name` and `photo` added.
 * A candidate whose contact is gone (null header) is dropped. Without options
 * every candidate is offered in input order.
 */
export async function resolveExistingContactChoices<T extends WithSignals>(
  candidates: readonly T[],
  readHeader: (contactId: number) => Promise<ExistingContactHeader | null>,
  options: ExistingContactChoiceOptions = {},
): Promise<Array<T & ExistingContactHeader>> {
  const offered = reviewCandidates(candidates, options);
  const headers = await Promise.all(
    offered.map((candidate) => readHeader(candidate.contactId)),
  );
  const choices: Array<T & ExistingContactHeader> = [];
  offered.forEach((candidate, index) => {
    const header = headers[index];
    if (header) {
      choices.push({ ...candidate, name: header.name, photo: header.photo });
    }
  });
  return choices;
}
