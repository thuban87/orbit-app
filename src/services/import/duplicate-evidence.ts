import type { ContactMethodDraft } from "@/db/contact-methods-dao";
import type { SqlExecutor } from "@/db/types";
import {
  normalizeContactMethod,
  type ContactMethodType,
} from "@/logic/contact-method-normalization";

export type DuplicateEvidenceSignal =
  | "phoneMatch"
  | "emailMatch"
  | "nameOverlap"
  | "birthdayMatch";

export interface DuplicateEvidenceCandidate {
  contactId: number;
  signals: DuplicateEvidenceSignal[];
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
      outcome: "new" | "needs_review";
      deterministicContactId: null;
      candidates: DuplicateEvidenceCandidate[];
    };

interface ContactNameRow {
  id: number;
  name: string;
  birthday: string | null;
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
      sourceMethodIds: { phoneMatch: [], emailMatch: [] },
    };
    candidates.set(contactId, candidate);
  }
  return candidate;
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
    if (incomingNameTokens.size > 0 && hasTokenOverlap(incomingNameTokens, nameTokens(contact.name))) {
      addSignal(candidateFor(candidates, contact.id), "nameOverlap");
    }
    if (input.birthday && contact.birthday === input.birthday) {
      addSignal(candidateFor(candidates, contact.id), "birthdayMatch");
    }
    // Preserve the explicit branch above as a reminder that birthday supports
    // any existing candidate but is never treated as deterministic identity.
    void candidate;
  }

  const evidence = [...candidates.values()].sort(
    (left, right) => left.contactId - right.contactId,
  );
  if (evidence.length === 0) {
    return { outcome: "new", deterministicContactId: null, candidates: [] };
  }
  return {
    outcome: "needs_review",
    deterministicContactId: null,
    candidates: evidence,
  };
}

export type { ContactMethodType };
