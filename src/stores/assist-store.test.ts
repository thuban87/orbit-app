import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getExecutor: vi.fn(),
  localDateTime: vi.fn(),
  listEligiblePendingAssists: vi.fn(),
}));

vi.mock("@/db/database", () => ({
  getExecutor: mocks.getExecutor,
  localDateTime: mocks.localDateTime,
}));
vi.mock("@/db/interaction-assist-read", () => ({
  listEligiblePendingAssists: mocks.listEligiblePendingAssists,
}));

import { subscribeAppState, useAssistBanner } from "@/stores/assist-store";

const now = "2026-08-31 12:00:30";
const queue = [
  {
    id: 2,
    uid: "newer",
    contact_id: 2,
    channel: "text" as const,
    endpoint_value: "+15555555555",
    handoff_at: "2026-08-31 12:00:00",
    created_at: "2026-08-31 12:00:01",
    contact_name: "Taylor",
  },
  {
    id: 1,
    uid: "older",
    contact_id: 1,
    channel: "call" as const,
    endpoint_value: "+14444444444",
    handoff_at: "2026-08-31 12:00:00",
    created_at: "2026-08-31 12:00:00",
    contact_name: "Morgan",
  },
];

function makeFakeAppState() {
  let listener: ((state: string) => void) | null = null;
  return {
    appState: {
      addEventListener(_type: "change", callback: (state: string) => void) {
        listener = callback;
        return { remove: vi.fn() };
      },
    },
    fire(state: string) {
      listener?.(state);
    },
  };
}

const flush = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getExecutor.mockReturnValue({});
  mocks.localDateTime.mockReturnValue(now);
  mocks.listEligiblePendingAssists.mockResolvedValue(queue);
  useAssistBanner.setState({ queue: [], newest: null, morePendingCount: 0 });
});

describe("useAssistBanner", () => {
  it("maps the SQLite queue to the newest banner item and remaining count", async () => {
    await useAssistBanner.getState().refresh();

    expect(useAssistBanner.getState()).toMatchObject({
      queue,
      newest: queue[0],
      morePendingCount: 1,
    });
    expect(mocks.listEligiblePendingAssists).toHaveBeenCalledWith({}, now);
  });

  it("refreshes on background-to-active but not inactive-to-active", async () => {
    const fake = makeFakeAppState();
    subscribeAppState(fake.appState);

    fake.fire("inactive");
    fake.fire("active");
    await flush();
    expect(mocks.listEligiblePendingAssists).not.toHaveBeenCalled();

    fake.fire("background");
    fake.fire("active");
    await flush();
    expect(mocks.listEligiblePendingAssists).toHaveBeenCalledTimes(1);
  });
});
