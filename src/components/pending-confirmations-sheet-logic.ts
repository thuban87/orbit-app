/**
 * The overlay variant of the unsaved-work guard (38.9 D-13, D-14; J-07) for
 * the pending-confirmations sheet.
 *
 * The sheet keeps the set of queued assist uids whose confirmation note holds
 * typed text. Membership follows the real queue (review M6): an item leaves the
 * set only when its note is cleared or the item leaves the queue (confirmed,
 * dismissed, expired or removed elsewhere), never because a confirm or dismiss
 * handler returned. Handlers always resolve, and a failed write keeps the item
 * and its typed note in the queue, so it must stay dirty.
 */

/** Adds (`dirty`) or removes `uid`; returns the same set when nothing changes. */
export function markNoteDirty(
  dirtyUids: ReadonlySet<string>,
  uid: string,
  dirty: boolean,
): ReadonlySet<string> {
  if (dirtyUids.has(uid) === dirty) return dirtyUids;
  const next = new Set(dirtyUids);
  if (dirty) next.add(uid);
  else next.delete(uid);
  return next;
}

/** Keeps only uids still in the queue; returns the same set when none left. */
export function pruneDirtyNotes(
  dirtyUids: ReadonlySet<string>,
  queueUids: readonly string[],
): ReadonlySet<string> {
  const queued = new Set(queueUids);
  let removed = false;
  for (const uid of dirtyUids) {
    if (!queued.has(uid)) {
      removed = true;
      break;
    }
  }
  if (!removed) return dirtyUids;
  return new Set([...dirtyUids].filter((uid) => queued.has(uid)));
}

/** True when closing the sheet would lose a typed note (pass the pruned set). */
export function shouldPromptOnSheetClose(
  dirtyUids: ReadonlySet<string>,
): boolean {
  return dirtyUids.size > 0;
}
