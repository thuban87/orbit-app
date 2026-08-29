import type { ContactMethodDraft } from "@/db/contact-methods-dao";
import type { SqlExecutor } from "@/db/types";
import { normalizeContactMethod } from "@/logic/contact-method-normalization";

export type DuplicateEvidenceSignal =
  | "phoneMatch"
  | "emailMatch"
  | "nameOverlap"
  | "birthdayMatch";

export type DuplicateOutcome =
  | "already_linked"
  | "probable"
  | "possible"
  | "new"
  | "needs_review";

export type DuplicateRecommendation =
  | "Recommend Link to Existing"
  | "Review"
  | "Import as New"
  | "Manual Review Required";

// Tunable evidence ladder. One imported source record can contain several
// methods, so correlated phone/email evidence contributes only its strongest
// method weight rather than adding two independent identity signals.
export const PHONE_MATCH_WEIGHT = 80;
export const EMAIL_MATCH_WEIGHT = 75;
export const NAME_OVERLAP_WEIGHT = 20;
export const BIRTHDAY_SUPPORTING_CAP = 5;
export const NAME_ONLY_CEILING = NAME_OVERLAP_WEIGHT;
export const PROBABLE_THRESHOLD = 70;
export const POSSIBLE_THRESHOLD = 15;

export interface DuplicateEvidenceCandidate {
  contactId: number;
  signals: DuplicateEvidenceSignal[];
  recommendation: DuplicateRecommendation;
  /** Source draft IDs that produced canonical evidence; used to damp correlation. */
  sourceMethodIds: {
    phoneMatch: string[];
    emailMatch: string[];
  };
}

export interface ScoreImportCandidateInput {
  /** Opaque provider-owned ID; only ever used as a bound SQL parameter. */
  externalContactId: string;
  methodDrafts: ContactMethodDraft[];
  name: string | null | undefined;
  birthday: string | null | undefined;
  effectivePhoneRegion: string | null | undefined;
}

export type DuplicateEvidenceResult =
  | {
      outcome: "already_linked";
      deterministicContactId: number;
      candidates: [];
    }
  | {
      outcome: Exclude<DuplicateOutcome, "already_linked">;
      deterministicContactId: null;
      candidates: DuplicateEvidenceCandidate[];
    };

interface ContactNameRow {
  id: number;
  name: string;
  birthday: string | null;
}

interface ScoredCandidate {
  candidate: DuplicateEvidenceCandidate;
  score: number;
  outcome: "probable" | "possible" | "new";
}

function nameTokens(value: string | null | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .normalize("NFKD")
      .toLocaleLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length > 0),
  );
}

function hasTokenOverlap(left: Set<string>, right: Set<string>): boolean {
  for (const token of left) if (right.has(token)) return true;
  return false;
}

function candidateFor(
  candidates: Map<number, DuplicateEvidenceCandidate>,
  contactId: number,
): DuplicateEvidenceCandidate {
  let candidate = candidates.get(contactId);
  if (!candidate) {
    candidate = {
      contactId,
      signals: [],
      recommendation: "Import as New",
      sourceMethodIds: { phoneMatch: [], emailMatch: [] },
    };
    candidates.set(contactId, candidate);
  }
  return candidate;
}

function candidateScore(candidate: DuplicateEvidenceCandidate): number {
  const phoneWeight = candidate.signals.includes("phoneMatch")
    ? PHONE_MATCH_WEIGHT
    : 0;
  const emailWeight = candidate.signals.includes("emailMatch")
    ? EMAIL_MATCH_WEIGHT
    : 0;
  const strongWeight = Math.max(phoneWeight, emailWeight);
  const nameWeight = candidate.signals.includes("nameOverlap")
    ? NAME_OVERLAP_WEIGHT
    : 0;
  const birthdayWeight = candidate.signals.includes("birthdayMatch")
    ? BIRTHDAY_SUPPORTING_CAP
    : 0;

  if (strongWeight > 0) return strongWeight + nameWeight + birthdayWeight;
  // A birthday has no independent identity power. Name-only remains advisory
  // and below the link threshold even when supported by a matching birthday.
  return Math.min(
    nameWeight + birthdayWeight,
    NAME_ONLY_CEILING + BIRTHDAY_SUPPORTING_CAP,
  );
}

function classifyCandidate(score: number): ScoredCandidate["outcome"] {
  if (score >= PROBABLE_THRESHOLD) return "probable";
  if (score >= POSSIBLE_THRESHOLD) return "possible";
  return "new";
}

function recommendationFor(
  outcome: ScoredCandidate["outcome"] | "needs_review",
): DuplicateRecommendation {
  switch (outcome) {
    case "probable":
      return "Recommend Link to Existing";
    case "possible":
      return "Review";
    case "needs_review":
      return "Manual Review Required";
    case "new":
      return "Import as New";
  }
}

function addSignal(
  candidate: DuplicateEvidenceCandidate,
  signal: DuplicateEvidenceSignal,
): void {
  if (!candidate.signals.includes(signal)) candidate.signals.push(signal);
}

/**
 * Returns the one active provider link for an external record, if present.
 * The migration's active partial-unique index makes this an identity lookup.
 */
export async function findActiveExternalLink(
  exec: SqlExecutor,
  provider: string,
  externalContactId: string,
): Promise<number | null> {
  const row = await exec.getFirstAsync<{ contact_id: number }>(
    `SELECT contact_id
       FROM external_contact_links
      WHERE provider = ? AND external_contact_id = ? AND is_active = 1`,
    [provider, externalContactId],
  );
  return row?.contact_id ?? null;
}

/**
 * Collect duplicate evidence without writing or exposing a numeric score.
 * Task 2 applies the conservative advisory ladder to this evidence set.
 */
export async function scoreImportCandidate(
  exec: SqlExecutor,
  input: ScoreImportCandidateInput,
): Promise<DuplicateEvidenceResult> {
  const deterministicContactId = await findActiveExternalLink(
    exec,
    "android",
    input.externalContactId,
  );
  if (deterministicContactId != null) {
    return {
      outcome: "already_linked",
      deterministicContactId,
      candidates: [],
    };
  }

  const candidates = new Map<number, DuplicateEvidenceCandidate>();
  for (const draft of input.methodDrafts) {
    const normalized = normalizeContactMethod({
      type: draft.type,
      value: draft.value,
      defaultPhoneRegion: input.effectivePhoneRegion,
    });
    if (!normalized.canonicalValue) continue;

    const matchingMethods = await exec.getAllAsync<{ contact_id: number }>(
      `SELECT DISTINCT contact_id
         FROM contact_methods
        WHERE method_type = ? AND canonical_value = ?`,
      [draft.type, normalized.canonicalValue],
    );
    const signal: DuplicateEvidenceSignal =
      draft.type === "phone" ? "phoneMatch" : "emailMatch";
    for (const row of matchingMethods) {
      const candidate = candidateFor(candidates, row.contact_id);
      addSignal(candidate, signal);
      const sourceIds = candidate.sourceMethodIds[signal];
      if (!sourceIds.includes(draft.uid)) sourceIds.push(draft.uid);
    }
  }

  const contactRows = await exec.getAllAsync<ContactNameRow>(
    "SELECT id, name, birthday FROM contacts",
  );
  const incomingNameTokens = nameTokens(input.name);
  for (const contact of contactRows) {
    const candidate = candidates.get(contact.id);
    if (
      incomingNameTokens.size > 0 &&
      hasTokenOverlap(incomingNameTokens, nameTokens(contact.name))
    ) {
      addSignal(candidateFor(candidates, contact.id), "nameOverlap");
    }
    if (input.birthday && contact.birthday === input.birthday) {
      addSignal(candidateFor(candidates, contact.id), "birthdayMatch");
    }
    // Preserve the explicit branch above as a reminder that birthday supports
    // any existing candidate but is never treated as deterministic identity.
    void candidate;
  }

  const scored = [...candidates.values()]
    .map((candidate) => {
      const score = candidateScore(candidate);
      const outcome = classifyCandidate(score);
      candidate.recommendation = recommendationFor(outcome);
      return { candidate, score, outcome };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.candidate.contactId - right.candidate.contactId,
    );
  if (scored.length === 0) {
    return { outcome: "new", deterministicContactId: null, candidates: [] };
  }

  const credible = scored.filter((item) => item.outcome !== "new");
  if (credible.length >= 2) {
    for (const item of scored)
      item.candidate.recommendation = recommendationFor("needs_review");
    return {
      outcome: "needs_review",
      deterministicContactId: null,
      candidates: scored.map((item) => item.candidate),
    };
  }

  const outcome = credible[0]?.outcome ?? "new";
  return {
    outcome,
    deterministicContactId: null,
    candidates: scored.map((item) => item.candidate),
  };
}
