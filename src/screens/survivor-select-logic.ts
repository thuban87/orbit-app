/**
 * Survivor select step logic (38.9 D-14; review C6-M2, C7-L4). Pure, so the
 * wrong-pair protection and the step-two reset are unit-tested without a
 * renderer.
 *
 * Survivor select runs two steps on one route: the picker (no
 * `secondContactId`), then "Which contact survives?" for the chosen pair. The
 * pair and the survivor pick are component state that only a resolved read
 * overwrites, so after Back to the picker and a new pick the screen could still
 * hold the previous pair. Merging is irreversible, so Continue acts only on the
 * pair the user has chosen now.
 */

/** The fields of a merge candidate this logic reads. */
export interface SurvivorPairMember {
  id: number;
}

/**
 * True only when Continue may open the merge for the CURRENT pair: a second
 * contact is chosen, its pair has loaded, the loaded pair is exactly
 * `{first, second}` (never a read for an earlier pick), and the survivor pick
 * is one of the two.
 */
export function canContinueToImpact({
  first,
  second,
  pair,
  selected,
}: {
  first: number;
  second: number | null | undefined;
  pair: readonly SurvivorPairMember[] | null;
  selected: number | null;
}): boolean {
  if (second == null) return false;
  if (pair?.length !== 2) return false;
  const ids = new Set(pair.map((member) => member.id));
  if (ids.size !== 2 || !ids.has(first) || !ids.has(second)) return false;
  return selected === first || selected === second;
}

/**
 * The step-two sub-editor close (D-14, C5-M7): Back from "Which contact
 * survives?" returns to the picker and drops the previous pair and survivor
 * pick, so a later pick starts clean (C6-M2).
 */
export function makeCloseStepTwo<Pair>({
  setPair,
  setSelected,
  setParams,
}: {
  setPair: (pair: Pair | null) => void;
  setSelected: (selected: number | null) => void;
  setParams: (params: { secondContactId: undefined }) => void;
}): () => void {
  return () => {
    setPair(null);
    setSelected(null);
    setParams({ secondContactId: undefined });
  };
}
