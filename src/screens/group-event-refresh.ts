/**
 * Saved Group Event participant commits vs event readback (38.3 RG-019;
 * reliability-testing/AUD-REL-007, reliability-testing/AUD-REL-008).
 *
 * Owner rulings this module enforces:
 * - D-17: participant add/remove/edit commit on their own and NEVER reseed the
 *   parent draft or its dirty baseline. Only `initialLoaded` seeds them.
 * - D-18: participant rows resolve against the refreshed SAVED `event`, never a
 *   preview of unsaved draft values.
 * - D-19 / D-04: a committed add whose readback fails is a success. The picker
 *   closes; the screen shows its own refresh error whose Retry only re-reads.
 *   A committed write is never replayed, and until a successful refresh the
 *   committed ids stay excluded from the picker so a re-pick cannot trip the
 *   (unchanged) DAO duplicate-participant guard.
 *
 * Pure: type-only imports plus the latest-request authority. No React, no
 * react-native, no database runtime.
 */
import type { TouchpointRefineValue } from "@/components/TouchpointRefineForm";
import type { GroupEventDetail } from "@/db/group-events-read";
import { createLatestRequestAuthority } from "@/utils/latest-request";

export interface EventDraft {
  value: TouchpointRefineValue;
  groupNote: string;
}

/** The editable parent fields as last saved. Also the base of Save's patch. */
export function eventDraft(event: GroupEventDetail): EventDraft {
  return {
    value: {
      occurredAt: event.occurredAt,
      channel: event.channel ?? "In Person",
      quality: event.quality,
      duration: event.duration,
      direction: null,
      connected: 1,
      note: null,
      allowAi: 0,
    },
    groupNote: event.groupNote ?? "",
  };
}

export interface GroupEventEditState {
  /** The latest SAVED event read. Participant rows and editors resolve here (D-18). */
  readonly event: GroupEventDetail | null;
  /** The unsaved parent draft. Seeded once by `initialLoaded` (D-17). */
  readonly draft: EventDraft | null;
  /** Serialized seed of `draft`; the dirty comparison. Seeded once. */
  readonly baseline: string | null;
  /** The initial read failed and there is no event to show. */
  readonly loadError: boolean;
  /** A post-commit readback failed; the shown event is stale. */
  readonly refreshError: boolean;
  /** Committed participant ids not yet reflected by a successful refresh. */
  readonly committedPendingIds: readonly number[];
}

export type GroupEventEditAction =
  | { type: "initialLoaded"; event: GroupEventDetail }
  | { type: "initialLoadFailed" }
  | { type: "draftChanged"; draft: EventDraft }
  | { type: "participantsCommitted"; contactIds: readonly number[] }
  | { type: "eventRefreshed"; event: GroupEventDetail }
  | { type: "refreshFailed" };

export const initialGroupEventEditState: GroupEventEditState = {
  event: null,
  draft: null,
  baseline: null,
  loadError: false,
  refreshError: false,
  committedPendingIds: [],
};

export function groupEventEditReducer(
  state: GroupEventEditState,
  action: GroupEventEditAction,
): GroupEventEditState {
  switch (action.type) {
    case "initialLoaded": {
      // The ONLY seeding path. A duplicate or late initial load after the
      // draft exists must not reseed it (D-17); it cannot win over a newer
      // refresh either, so it is ignored outright.
      if (state.draft !== null) return state;
      const draft = eventDraft(action.event);
      return {
        ...state,
        event: action.event,
        draft,
        baseline: JSON.stringify(draft),
        loadError: false,
        refreshError: false,
        committedPendingIds: [],
      };
    }
    case "initialLoadFailed":
      return state.event === null ? { ...state, loadError: true } : state;
    case "draftChanged":
      return state.draft === null ? state : { ...state, draft: action.draft };
    case "participantsCommitted": {
      const pending = new Set(state.committedPendingIds);
      for (const contactId of action.contactIds) pending.add(contactId);
      return { ...state, committedPendingIds: [...pending] };
    }
    case "eventRefreshed":
      // Event only. `draft` and `baseline` are deliberately untouched, even
      // when the refreshed values happen to equal the draft (D-17).
      return {
        ...state,
        event: action.event,
        refreshError: false,
        committedPendingIds: [],
      };
    case "refreshFailed":
      return { ...state, refreshError: true };
  }
}

export function isGroupEventDraftDirty(state: GroupEventEditState): boolean {
  return state.draft !== null && JSON.stringify(state.draft) !== state.baseline;
}

export interface GroupEventRefreshController {
  /** Re-read the event. Never rejects; outcomes go to the callbacks. */
  refresh(): Promise<void>;
  /** Drop every outstanding read (unmount). Later refreshes still work. */
  invalidate(): void;
}

export interface GroupEventRefreshControllerOptions {
  read: () => Promise<GroupEventDetail | null>;
  onRefreshed: (event: GroupEventDetail) => void;
  onRefreshFailed: (error: unknown) => void;
}

/**
 * Latest-request read owner (38.3 D-23 authority): only the most recent read
 * publishes, success and failure alike, so an older result never overwrites a
 * newer one. A vanished event (null) is a failure, not an empty success.
 */
export function createGroupEventRefreshController({
  read,
  onRefreshed,
  onRefreshFailed,
}: GroupEventRefreshControllerOptions): GroupEventRefreshController {
  const authority = createLatestRequestAuthority();
  const refresh = async (): Promise<void> => {
    const token = authority.begin();
    let event: GroupEventDetail | null;
    try {
      event = await read();
    } catch (error) {
      if (authority.isCurrent(token)) onRefreshFailed(error);
      return;
    }
    if (!authority.isCurrent(token)) return;
    if (event === null) {
      onRefreshFailed(new Error("This group event is no longer available."));
      return;
    }
    onRefreshed(event);
  };
  return { refresh, invalidate: () => authority.invalidate() };
}

export interface RunParticipantAddOptions {
  /** The one atomic `addParticipants` batch. Its rejection is the only failure. */
  add: () => Promise<void>;
  /** Record the committed ids (picker exclusion) before any readback. */
  onCommitted: () => void;
  /** The screen's controller refresh; its failure is reported there, not here. */
  refresh: () => Promise<void>;
}

/**
 * The picker's `onConfirm` owner. Awaits the write ONLY: a rejected write
 * propagates so the picker keeps its selection and retry error (ADR-127). Once
 * the write commits this resolves, and the readback runs detached, so a failed
 * read can never be reported as a failed (and retryable) add (D-19, D-04).
 */
export async function runParticipantAdd({
  add,
  onCommitted,
  refresh,
}: RunParticipantAddOptions): Promise<void> {
  await add();
  onCommitted();
  void refresh();
}

/** Present participants plus committed-but-not-yet-refreshed ids. */
export function excludedParticipantIds(
  event: GroupEventDetail | null,
  committedPendingIds: readonly number[],
): number[] {
  const ids = new Set(event?.participants.map(({ contactId }) => contactId));
  for (const contactId of committedPendingIds) ids.add(contactId);
  return [...ids];
}
