import { create } from "zustand";
import { getExecutor, localDateTime } from "@/db/database";
import {
  type EligiblePendingAssist,
  listEligiblePendingAssists,
} from "@/db/interaction-assist-read";
import {
  applyAssistSkips,
  selectBannerState,
} from "@/logic/assist-eligibility";
import { createLatestRequestAuthority } from "@/utils/latest-request";
import { Logger } from "@/utils/logger";
import { applyUatFault } from "@/utils/uat-faults";

export interface AssistAppStateLike {
  addEventListener(
    type: "change",
    listener: (state: string) => void,
  ): { remove(): void };
}

type AssistBannerStore = {
  /** The last eligible-pending read, before any skip (38.14 D-23 / D-77). */
  rawQueue: EligiblePendingAssist[];
  /**
   * The record Compose's "Did you send it?" panel is showing, or null. While
   * set, the banner and the pending list do not offer it (38.14 D-23).
   */
  panelOwnedUid: string | null;
  /**
   * Records answered "Later" on Compose's panel; quiet until the next return to
   * Orbit (38.14 D-77). In memory only, never a timer, never persisted.
   */
  laterUids: ReadonlySet<string>;
  /** The VISIBLE queue: `rawQueue` minus the skipped records. */
  queue: EligiblePendingAssist[];
  newest: EligiblePendingAssist | null;
  morePendingCount: number;
  refresh: () => Promise<void>;
  /** Compose claims its panel record (no database read; re-derives at once). */
  setPanelOwned: (uid: string) => void;
  /** Compare-and-clear: releases only when `uid` is the current claim. */
  releasePanelOwned: (uid: string) => void;
};

/** The skip inputs the derive step reads, always from CURRENT state. */
type SkipState = Pick<
  AssistBannerStore,
  "rawQueue" | "panelOwnedUid" | "laterUids"
>;

/**
 * The one derive step every publication goes through (38.14 D-23): drop the
 * skipped records, then pick the banner's newest and more-count from what is
 * left. Banner and pending-list selectors read the result unchanged.
 */
function deriveVisible(
  state: SkipState,
): Pick<AssistBannerStore, "queue" | "newest" | "morePendingCount"> {
  const queue = applyAssistSkips(state.rawQueue, {
    panelOwnedUid: state.panelOwnedUid,
    laterUids: state.laterUids,
  });
  const { newest, morePendingCount } = selectBannerState(
    queue,
    localDateTime(),
  );
  return { queue, newest, morePendingCount };
}

/**
 * Latest-request authority for queue refreshes (38.3 RG-023, D-23). Several
 * callers refresh concurrently (launch, AppState return, every assist
 * publication); only the most recently STARTED refresh may publish, so an older
 * read resolving late can never overwrite a newer queue.
 */
const queueRefreshAuthority = createLatestRequestAuthority();

export const useAssistBanner = create<AssistBannerStore>()((set) => ({
  rawQueue: [],
  panelOwnedUid: null,
  laterUids: new Set<string>(),
  queue: [],
  newest: null,
  morePendingCount: 0,
  async refresh() {
    const token = queueRefreshAuthority.begin();
    // Dev-armed one-shot UAT fault site (Plan 16 RG-023); inert outside __DEV__.
    await applyUatFault("assist-queue-refresh");
    const now = localDateTime();
    // A read failure still rejects to this caller only; it never changes state.
    const rawQueue = await listEligiblePendingAssists(getExecutor(), now);
    if (!queueRefreshAuthority.isCurrent(token)) return;
    // The skips are read from the state AT PUBLISH TIME (inside set), never from
    // values captured when this read began: a claim made while the read was in
    // flight must survive the read landing (38.14 D-23).
    set((state) => ({ rawQueue, ...deriveVisible({ ...state, rawQueue }) }));
  },
  setPanelOwned(uid) {
    set((state) => ({
      panelOwnedUid: uid,
      ...deriveVisible({ ...state, panelOwnedUid: uid }),
    }));
  },
  releasePanelOwned(uid) {
    set((state) =>
      state.panelOwnedUid === uid
        ? {
            panelOwnedUid: null,
            ...deriveVisible({ ...state, panelOwnedUid: null }),
          }
        : state,
    );
  },
}));

/** Re-query after a real app return; inactive-to-active is deliberately ignored. */
export function subscribeAppState(appState: AssistAppStateLike): {
  remove(): void;
} {
  let previous = "active";
  return appState.addEventListener("change", (next) => {
    if (previous === "background" && next === "active") {
      useAssistBanner
        .getState()
        .refresh()
        .catch((error) =>
          Logger.error("assist-store", "queue refresh failed", error),
        );
    }
    previous = next;
  });
}
