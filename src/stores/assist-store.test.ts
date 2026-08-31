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
const MIGRATIONS = [migration001, migration002, migration003, migration004, migration005, migration006, migration007, migration008, migration009, migration010, migration011, migration012, migration013, migration014];
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
