/**
 * Pure drag→order computation for the orrery `ring_seq` radial drag (ORR).
 *
 * Extracted as a `*-logic.ts` pure module (no RN/native imports, node-tested) —
 * the same split as `favourites-reorder-logic` / `edit-contact-logic`. This owns
 * the array math of a radial drag move; the transactional persistence is
 * `rewriteRingSeq` (ring-seq-dao). The drag-end handler computes the new ordered
 * id list here, then hands it to the DAO to write `ring_seq` 0..n-1.
 *
 * Determinism: the input array is NEVER mutated (a NEW array is returned), and
 * the result is always a PERMUTATION of the input (same members, no loss/dup).
 * Out-of-range indices are CLAMPED into `[0, length-1]` (chosen over throwing so a
 * stray gesture index can't crash the reorder path); a `from === to` move after
 * clamping returns an unchanged copy.
 */

/**
 * Move the element at `from` to `to`, returning a NEW ordered id array.
 *
 * @param orderedIds the current ring order (id per rank, closest first)
 * @param from the index the dragged item started at (clamped to a valid slot)
 * @param to the index it was dropped at (clamped to a valid slot)
 * @returns a new array with the element repositioned; input untouched
 */
export function computeRingReorder(
  orderedIds: number[],
  from: number,
  to: number,
): number[] {
  const next = orderedIds.slice(); // copy — never mutate the input
  if (next.length === 0) {
    return next;
  }
  const clampedFrom = clampIndex(from, next.length);
  const clampedTo = clampIndex(to, next.length);
  if (clampedFrom === clampedTo) {
    return next; // no-op move → unchanged copy
  }
  const [moved] = next.splice(clampedFrom, 1);
  next.splice(clampedTo, 0, moved);
  return next;
}

/** Clamp `index` into the valid slot range `[0, length-1]`. */
function clampIndex(index: number, length: number): number {
  if (index < 0) {
    return 0;
  }
  if (index > length - 1) {
    return length - 1;
  }
  return index;
}
