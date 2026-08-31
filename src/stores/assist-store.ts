import { create } from "zustand";
import { getExecutor, localDateTime } from "@/db/database";
import {
  type EligiblePendingAssist,
  listEligiblePendingAssists,
} from "@/db/interaction-assist-read";
import { selectBannerState } from "@/logic/assist-eligibility";

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

export const useAssistBanner = create<AssistBannerStore>()((set) => ({
  queue: [],
  newest: null,
  morePendingCount: 0,
  async refresh() {
    const now = localDateTime();
    const queue = await listEligiblePendingAssists(getExecutor(), now);
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
      void useAssistBanner.getState().refresh();
    }
    previous = next;
  });
}
