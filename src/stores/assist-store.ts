import { create } from "zustand";
import { getExecutor, localDateTime } from "@/db/database";
import {
  type EligiblePendingAssist,
  listEligiblePendingAssists,
} from "@/db/interaction-assist-read";
import { selectBannerState } from "@/logic/assist-eligibility";
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
  queue: EligiblePendingAssist[];
  newest: EligiblePendingAssist | null;
  morePendingCount: number;
  refresh: () => Promise<void>;
};

/**
 * Latest-request authority for queue refreshes (38.3 RG-023, D-23). Several
 * callers refresh concurrently (launch, AppState return, every assist
 * publication); only the most recently STARTED refresh may publish, so an older
 * read resolving late can never overwrite a newer queue.
 */
const queueRefreshAuthority = createLatestRequestAuthority();

export const useAssistBanner = create<AssistBannerStore>()((set) => ({
  queue: [],
  newest: null,
  morePendingCount: 0,
  async refresh() {
    const token = queueRefreshAuthority.begin();
    // Dev-armed one-shot UAT fault site (Plan 16 RG-023); inert outside __DEV__.
    await applyUatFault("assist-queue-refresh");
    const now = localDateTime();
    // A read failure still rejects to this caller only; it never changes state.
    const queue = await listEligiblePendingAssists(getExecutor(), now);
    if (!queueRefreshAuthority.isCurrent(token)) return;
    const { newest, morePendingCount } = selectBannerState(queue, now);
    set({ queue, newest, morePendingCount });
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
