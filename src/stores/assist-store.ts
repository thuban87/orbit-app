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
  /**
   * "Later" on Compose's panel: keep this record off the banner and the pending
   * list until the next return to Orbit (38.14 D-77). Re-derives at once.
   */
  deferUntilReturn: (uid: string) => void;
  /**
   * Empty the Later set WITHOUT publishing and without a database read. Called
   * only on a background-to-active return and at launch, each time immediately
   * before the `refresh()` that publishes (D-77). Never called from `refresh()`.
   */
  releaseDeferred: () => void;
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
  deferUntilReturn(uid) {
    set((state) => {
      const laterUids = new Set(state.laterUids);
      laterUids.add(uid);
      return { laterUids, ...deriveVisible({ ...state, laterUids }) };
    });
  },
  releaseDeferred() {
    // Deliberately NOT re-derived: re-publishing here would run over the old
    // rawQueue, and only `newest` is eligibility-filtered, so after a long
    // background the pending list could briefly show expired rows. The refresh
    // that always follows reads fresh rows and publishes.
    set({ laterUids: new Set<string>() });
  },
}));

/**
 * Re-query after a real app return; inactive-to-active is deliberately ignored.
 * A real return is also when "Later" records become askable again (38.14 D-77):
 * the set is released synchronously BEFORE the refresh, never inside it —
 * refresh also runs on every assist publication and the Settings toggle, and
 * releasing there would re-ask within seconds (owner-rejected Q17-A / Q17-B).
 */
export function subscribeAppState(appState: AssistAppStateLike): {
  remove(): void;
} {
  let previous = "active";
  return appState.addEventListener("change", (next) => {
    if (previous === "background" && next === "active") {
      const store = useAssistBanner.getState();
      store.releaseDeferred();
      store
        .refresh()
        .catch((error) =>
          Logger.error("assist-store", "queue refresh failed", error),
        );
    }
    previous = next;
  });
}
