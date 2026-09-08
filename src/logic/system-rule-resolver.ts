/** Resolve persisted custom-System rules and manual overrides into contact ids. */
import { listSystemOverrides } from "@/db/systems-dao";
import type { ReadOnlyExecutor } from "@/db/transaction";
import { ACTIVE_SEGREGATION_WHERE } from "@/logic/dashboard-query-logic";
import { systemRefId, type OrrerySystemRef } from "@/logic/orrery-system-logic";

export interface BrokenRule {
  ruleId: number;
  family: string;
  value: string;
  reason: string;
}

export interface ResolvedCustomSystemMembers {
  memberIds: number[];
  /** Rule-derived ids before overrides; intentionally empty for manual-only Systems. */
  candidateIds: number[];
  brokenRules: BrokenRule[];
  /** Dynamic-bucket exclusion cleanup begins in plan 02. */
  prunableExclusionContactIds: number[];
}

/**
 * The initial manual-only resolver. Rule evaluation, gravity and exclusion
 * pruning deliberately extend this stable return shape in the next plan.
 */
export async function resolveCustomSystemMembers(
  exec: ReadOnlyExecutor,
  system: Extract<OrrerySystemRef, { kind: "custom" }>,
): Promise<ResolvedCustomSystemMembers> {
  const overrides = await listSystemOverrides(exec, systemRefId(system));
  const inclusions = overrides
    .filter((row) => row.mode === "include")
    .map((row) => row.contactId);
  const exclusions = new Set(
    overrides
      .filter((row) => row.mode === "exclude")
      .map((row) => row.contactId),
  );
  if (inclusions.length === 0) {
    return {
      memberIds: [],
      candidateIds: [],
      brokenRules: [],
      prunableExclusionContactIds: [],
    };
  }
  const ids = [...new Set(inclusions)];
  const eligible = await exec.getAllAsync<{ id: number }>(
    `SELECT c.id FROM contacts c
      WHERE ${ACTIVE_SEGREGATION_WHERE} AND c.id IN (${ids.map(() => "?").join(", ")})`,
    ids,
  );
  return {
    memberIds: eligible
      .map((row) => row.id)
      .filter((id) => !exclusions.has(id)),
    candidateIds: [],
    brokenRules: [],
    prunableExclusionContactIds: [],
  };
}
