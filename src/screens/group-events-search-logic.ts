/**
 * Events list search runner (38.14 D-25, D-48; enforces ADR-162).
 *
 * One read of the Events list, gated by a latest-request authority so an older
 * search that resolves after a newer one can never publish over it. The list
 * is replaced by a spinner only on the first load: later term changes keep the
 * current rows visible until the new result arrives.
 *
 * Contract:
 * - `loading: true` is published only when `isFirstLoad`.
 * - Every CURRENT settle (rows or failure) publishes `loading: false`, so the
 *   spinner can never stick; a stale settle publishes nothing.
 * - Resolves `true` only when the settle was current. The caller owns "first
 *   load" and clears it only then, so a first read invalidated before it
 *   settles (blur) leaves the next read a first load.
 *
 * Pure apart from the DB read the caller passes in. No React, no react-native.
 */

import {
  type GroupEventListItem,
  listGroupEvents,
  searchGroupEvents,
} from "@/db/group-events-read";
import type { ReadOnlyExecutor } from "@/db/transaction";
import type { ReadGate } from "@/logic/read-phase";

export type EventsSearchPatch<T> =
  | { readonly loading: true }
  | {
      readonly loading: false;
      readonly failed: boolean;
      readonly items: readonly T[];
    };

export interface RunEventsSearchDeps<T> {
  readonly gate: ReadGate;
  readonly term: string;
  readonly isFirstLoad: boolean;
  readonly read: (term: string) => Promise<readonly T[]>;
  readonly publish: (patch: EventsSearchPatch<T>) => void;
}

/** Runs one gated Events read. Never rejects; resolves whether it settled current. */
export async function runEventsSearch<T>(
  deps: RunEventsSearchDeps<T>,
): Promise<boolean> {
  const token = deps.gate.begin();
  if (deps.isFirstLoad) deps.publish({ loading: true });
  let patch: EventsSearchPatch<T>;
  try {
    patch = {
      loading: false,
      failed: false,
      items: await deps.read(deps.term),
    };
  } catch {
    patch = { loading: false, failed: true, items: [] };
  }
  if (!deps.gate.isCurrent(token)) return false;
  deps.publish(patch);
  return true;
}

/** Search for a non-blank trimmed term; the whole list otherwise. */
export function readEventsForTerm(
  exec: ReadOnlyExecutor,
  term: string,
): Promise<GroupEventListItem[]> {
  return term.trim()
    ? searchGroupEvents(exec, { term })
    : listGroupEvents(exec, {});
}
