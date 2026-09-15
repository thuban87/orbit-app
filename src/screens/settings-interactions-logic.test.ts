import { describe, expect, it, vi } from "vitest";
import type { AppSettings } from "@/db/app-settings-dao";
import { MESSAGE_MODES } from "@/db/app-settings-dao";
import type { SqlExecutor } from "@/db/types";
import {
  DEFAULT_INTERACTION_CHANNELS,
  RIGHT_SWIPE_ACTIONS,
} from "@/db/app-settings-dao";
import {
  DEFAULT_CHANNEL_OPTIONS,
  MESSAGE_MODE_OPTIONS,
  persistInteractionAssistEnabled,
  RIGHT_SWIPE_OPTIONS,
} from "./settings-interactions-logic";

describe("settings interactions logic — message mode (D-04a)", () => {
  it("exposes exactly the DAO's MESSAGE_MODES, in order", () => {
    expect(MESSAGE_MODE_OPTIONS.map((option) => option.value)).toEqual([
      ...MESSAGE_MODES,
    ]);
  });

  it("pairs each mode with the exact patch it writes", () => {
    for (const option of MESSAGE_MODE_OPTIONS) {
      expect(option.patch).toEqual({ defaultMessageMode: option.value });
    }
  });

  it("carries a non-empty display label for every mode", () => {
    for (const option of MESSAGE_MODE_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0);
    }
  });
});

describe("settings interactions logic — right-swipe action (D-04c)", () => {
  it("exposes exactly the DAO's RIGHT_SWIPE_ACTIONS, in order", () => {
    expect(RIGHT_SWIPE_OPTIONS.map((option) => option.value)).toEqual([
      ...RIGHT_SWIPE_ACTIONS,
    ]);
  });

  it("pairs each action with the exact patch it writes", () => {
    for (const option of RIGHT_SWIPE_OPTIONS) {
      expect(option.patch).toEqual({ dashboardRightSwipeAction: option.value });
    }
  });

  it("carries a non-empty display label for every action", () => {
    for (const option of RIGHT_SWIPE_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0);
    }
  });
});

describe("settings interactions logic — default channel (§F)", () => {
  it("matches the DAO's default-interaction-channel contract, in order", () => {
    expect(DEFAULT_CHANNEL_OPTIONS.map((option) => option.value)).toEqual([
      ...DEFAULT_INTERACTION_CHANNELS,
    ]);
  });

  it("pairs each channel with the exact patch it writes", () => {
    for (const option of DEFAULT_CHANNEL_OPTIONS) {
      expect(option.patch).toEqual({ defaultInteractionChannel: option.value });
    }
  });

  it("carries a non-empty display label for every channel", () => {
    for (const option of DEFAULT_CHANNEL_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0);
    }
  });
});

describe("persistInteractionAssistEnabled — D-10 / ADR-070", () => {
  const makeDeps = () => ({
    setInteractionAssistEnabled: vi.fn(
      async (_exec: SqlExecutor, _enabled: 0 | 1, _now: string) => {},
    ),
    getAppSettings: vi.fn(
      async (_exec: SqlExecutor) =>
        ({ interactionAssistEnabled: 0 }) as AppSettings,
    ),
    refreshBanner: vi.fn(async () => {}),
    now: () => "2026-09-14 12:00:00",
  });

  it("opt-OFF routes through the specialized writer, then refreshes the banner", async () => {
    const deps = makeDeps();
    const exec = {} as SqlExecutor;

    await persistInteractionAssistEnabled(exec, 0, deps);

    expect(deps.setInteractionAssistEnabled).toHaveBeenCalledWith(
      exec,
      0,
      "2026-09-14 12:00:00",
    );
    expect(deps.getAppSettings).toHaveBeenCalledWith(exec);
    expect(deps.refreshBanner).toHaveBeenCalledTimes(1);
    // The queue-clearing writer must run BEFORE the banner refresh.
    expect(
      deps.setInteractionAssistEnabled.mock.invocationCallOrder[0],
    ).toBeLessThan(deps.refreshBanner.mock.invocationCallOrder[0]);
  });

  it("opt-ON routes through the specialized writer + banner refresh", async () => {
    const deps = makeDeps();
    const exec = {} as SqlExecutor;

    await persistInteractionAssistEnabled(exec, 1, deps);

    expect(deps.setInteractionAssistEnabled).toHaveBeenCalledWith(
      exec,
      1,
      "2026-09-14 12:00:00",
    );
    expect(deps.refreshBanner).toHaveBeenCalledTimes(1);
  });
});
