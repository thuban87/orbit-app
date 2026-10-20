import { beforeEach, describe, expect, it, vi } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { setInteractionAssistEnabled } from "@/db/app-settings-dao";
import { createPendingAssist } from "@/db/interaction-assist-dao";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { migration006 } from "@/db/migrations/006-normalize-custom-field-values";
import { migration007 } from "@/db/migrations/007-tombstones";
import { migration008 } from "@/db/migrations/008-restore-photo-journal";
import { migration009 } from "@/db/migrations/009-contact-method-normalization";
import { migration010 } from "@/db/migrations/010-contact-method-label";
import { migration011 } from "@/db/migrations/011-contact-lifecycle-schema";
import { migration012 } from "@/db/migrations/012-import-sessions";
import { migration013 } from "@/db/migrations/013-reconciliation-and-merge";
import { migration014 } from "@/db/migrations/014-interaction-assists";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

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
const MIGRATIONS = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
  migration008,
  migration009,
  migration010,
  migration011,
  migration012,
  migration013,
  migration014,
];
const queue = [
  {
    id: 2,
    uid: "newer",
    contact_id: 2,
    channel: "text" as const,
    endpoint_value: "+15555555555",
    endpoint_display: "+15555555555",
    handoff_at: "2026-08-31 12:00:00",
    created_at: "2026-08-31 12:00:01",
    contact_name: "Taylor",
    contact_photo: null,
  },
  {
    id: 1,
    uid: "older",
    contact_id: 1,
    channel: "call" as const,
    endpoint_value: "+14444444444",
    endpoint_display: "+14444444444",
    handoff_at: "2026-08-31 12:00:00",
    created_at: "2026-08-31 12:00:00",
    contact_name: "Morgan",
    contact_photo: null,
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
  useAssistBanner.setState({
    rawQueue: [],
    panelOwnedUid: null,
    laterUids: new Set<string>(),
    queue: [],
    newest: null,
    morePendingCount: 0,
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

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

  it("clears a visible banner after opt-out and a handler refresh without an AppState transition", async () => {
    const exec: SqlExecutor = nodeSqliteExecutor(openTestDb());
    let uid = 0;
    await runMigrations(exec, MIGRATIONS, 14, {
      now,
      newUid: () => `assist-store-${++uid}`,
    });
    const contact = await exec.runAsync(
      `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
       VALUES (?, ?, 30, ?, ?)`,
      ["assist-store-contact", "Taylor", now, now],
    );
    await createPendingAssist(exec, {
      contactId: contact.lastInsertRowId,
      channel: "text",
      endpointValue: "+15555555555",
      now: "2026-08-31 11:00:00",
    });
    mocks.getExecutor.mockReturnValue(exec);
    mocks.listEligiblePendingAssists
      .mockResolvedValueOnce(queue.slice(0, 1))
      .mockResolvedValueOnce([]);

    await useAssistBanner.getState().refresh();
    expect(useAssistBanner.getState().newest).not.toBeNull();

    // This is the SettingsScreen handler sequence. No AppState event is fired.
    await setInteractionAssistEnabled(exec, 0, now);
    await useAssistBanner.getState().refresh();

    expect(useAssistBanner.getState()).toMatchObject({
      queue: [],
      newest: null,
      morePendingCount: 0,
    });
  });
});

describe("panel claim (38.14 D-23)", () => {
  it("skips the claimed record on the banner and the list, and brings it back on release", async () => {
    await useAssistBanner.getState().refresh();
    expect(useAssistBanner.getState().newest?.uid).toBe("newer");

    useAssistBanner.getState().setPanelOwned("newer");
    expect(useAssistBanner.getState()).toMatchObject({
      panelOwnedUid: "newer",
      queue: [queue[1]],
      newest: queue[1],
      morePendingCount: 0,
    });
    // The claim re-derives synchronously; it never reads the database.
    expect(mocks.listEligiblePendingAssists).toHaveBeenCalledTimes(1);

    // A later refresh (any publication) keeps the claimed record out.
    await useAssistBanner.getState().refresh();
    expect(useAssistBanner.getState().queue.map((row) => row.uid)).toEqual([
      "older",
    ]);
    expect(useAssistBanner.getState().newest?.uid).toBe("older");

    // Compare-and-clear: releasing a different uid changes nothing.
    useAssistBanner.getState().releasePanelOwned("someone-else");
    expect(useAssistBanner.getState().panelOwnedUid).toBe("newer");
    expect(useAssistBanner.getState().queue.map((row) => row.uid)).toEqual([
      "older",
    ]);

    useAssistBanner.getState().releasePanelOwned("newer");
    expect(useAssistBanner.getState()).toMatchObject({
      panelOwnedUid: null,
      queue,
      newest: queue[0],
      morePendingCount: 1,
    });
  });

  it("honours a claim made while a refresh read is still in flight", async () => {
    const read = deferred<typeof queue>();
    mocks.listEligiblePendingAssists.mockReturnValueOnce(read.promise);

    const pending = useAssistBanner.getState().refresh();
    await vi.waitFor(() =>
      expect(mocks.listEligiblePendingAssists).toHaveBeenCalledTimes(1),
    );
    useAssistBanner.getState().setPanelOwned("newer");

    read.resolve(queue);
    await pending;
    expect(useAssistBanner.getState()).toMatchObject({
      rawQueue: queue,
      queue: [queue[1]],
      newest: queue[1],
      morePendingCount: 0,
    });
  });
});

describe("Later (38.14 D-77)", () => {
  it("keeps a deferred record off the banner and list across every refresh", async () => {
    await useAssistBanner.getState().refresh();
    useAssistBanner.getState().deferUntilReturn("newer");
    expect(useAssistBanner.getState().newest?.uid).toBe("older");

    // Publications and the Settings toggle only refresh; they never release.
    await useAssistBanner.getState().refresh();
    await useAssistBanner.getState().refresh();
    expect(useAssistBanner.getState().laterUids.has("newer")).toBe(true);
    expect(useAssistBanner.getState().queue.map((row) => row.uid)).toEqual([
      "older",
    ]);
    expect(useAssistBanner.getState().newest?.uid).toBe("older");
    expect(useAssistBanner.getState().morePendingCount).toBe(0);
  });

  it("releaseDeferred empties the set WITHOUT publishing; the next refresh publishes", async () => {
    await useAssistBanner.getState().refresh();
    useAssistBanner.getState().deferUntilReturn("newer");
    const before = useAssistBanner.getState();
    const readsBefore = mocks.listEligiblePendingAssists.mock.calls.length;

    useAssistBanner.getState().releaseDeferred();
    const after = useAssistBanner.getState();
    expect(after.laterUids.size).toBe(0);
    expect(after.queue).toBe(before.queue);
    expect(after.newest).toBe(before.newest);
    expect(after.morePendingCount).toBe(before.morePendingCount);
    expect(mocks.listEligiblePendingAssists.mock.calls.length).toBe(
      readsBefore,
    );

    await useAssistBanner.getState().refresh();
    expect(useAssistBanner.getState().newest?.uid).toBe("newer");
    expect(useAssistBanner.getState().morePendingCount).toBe(1);
  });

  it("a background-to-active return releases Later'd records; inactive-to-active does not", async () => {
    const fake = makeFakeAppState();
    subscribeAppState(fake.appState);
    await useAssistBanner.getState().refresh();
    useAssistBanner.getState().deferUntilReturn("newer");

    fake.fire("inactive");
    fake.fire("active");
    await flush();
    expect(useAssistBanner.getState().laterUids.has("newer")).toBe(true);
    expect(useAssistBanner.getState().newest?.uid).toBe("older");

    fake.fire("background");
    fake.fire("active");
    // Released synchronously, before the refresh it triggers.
    expect(useAssistBanner.getState().laterUids.size).toBe(0);
    await flush();
    expect(useAssistBanner.getState().newest?.uid).toBe("newer");
  });

  it("a Later tapped while a refresh read is in flight stays hidden when the read publishes", async () => {
    const read = deferred<typeof queue>();
    mocks.listEligiblePendingAssists.mockReturnValueOnce(read.promise);

    const pending = useAssistBanner.getState().refresh();
    await vi.waitFor(() =>
      expect(mocks.listEligiblePendingAssists).toHaveBeenCalledTimes(1),
    );
    useAssistBanner.getState().deferUntilReturn("newer");

    read.resolve(queue);
    await pending;
    expect(useAssistBanner.getState().queue.map((row) => row.uid)).toEqual([
      "older",
    ]);
    expect(useAssistBanner.getState().newest?.uid).toBe("older");
  });

  it("Later then a panel release keeps the record quiet (claim gone, Later remains)", async () => {
    await useAssistBanner.getState().refresh();
    useAssistBanner.getState().setPanelOwned("newer");
    useAssistBanner.getState().deferUntilReturn("newer");
    useAssistBanner.getState().releasePanelOwned("newer");
    expect(useAssistBanner.getState().panelOwnedUid).toBeNull();
    expect(useAssistBanner.getState().newest?.uid).toBe("older");
  });
});
