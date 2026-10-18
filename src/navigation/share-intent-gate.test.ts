import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 38.12 DEF-04: a backup shared into a running Orbit is captured natively but
 * changes no React state. The gate re-checks on every return to the
 * foreground and routes with a fresh shareSeq, so an already-open Backup page
 * consumes it too. Hooks are mocked: effects run at once, setters are spies.
 */
const h = vi.hoisted(() => ({
  setters: [] as ReturnType<typeof vi.fn>[],
  appStateListener: null as null | ((state: string) => void),
  hasSharedBackup: vi.fn(() => false),
  navigateIntoTab: vi.fn(),
  resetShareIntent: vi.fn(),
  hasShareIntent: false,
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: (effect: () => unknown) => {
    effect();
  },
  useState: (value: unknown) => {
    const setter = vi.fn();
    h.setters.push(setter);
    return [value, setter];
  },
}));
vi.mock("react-native", () => ({
  AppState: {
    addEventListener: (_event: string, listener: (state: string) => void) => {
      h.appStateListener = listener;
      return { remove: vi.fn() };
    },
  },
}));
vi.mock("expo-share-intent", () => ({
  useShareIntentContext: () => ({
    hasShareIntent: h.hasShareIntent,
    resetShareIntent: h.resetShareIntent,
  }),
}));
vi.mock("../../modules/orbit-backup-document-picker", () => ({
  hasSharedBackup: h.hasSharedBackup,
}));
vi.mock("./tab-entry", () => ({ navigateIntoTab: h.navigateIntoTab }));

const { ShareIntentGate } = await import("./linking");

beforeEach(() => {
  h.setters = [];
  h.appStateListener = null;
  h.hasShareIntent = false;
  vi.clearAllMocks();
});

describe("ShareIntentGate (38.12 DEF-04)", () => {
  it("re-checks for a shared backup each time Orbit returns to the foreground", () => {
    ShareIntentGate({ isReady: true });
    const tick = h.setters[0];
    h.appStateListener?.("background");
    expect(tick).not.toHaveBeenCalled();
    h.appStateListener?.("active");
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it("routes a shared backup to Data & Backup with a fresh shareSeq each time", () => {
    h.hasSharedBackup.mockReturnValue(true);
    ShareIntentGate({ isReady: true });
    ShareIntentGate({ isReady: true });
    const seqs = h.navigateIntoTab.mock.calls.map(
      (call) => (call[3] as { shareSeq: number }).shareSeq,
    );
    expect(h.navigateIntoTab.mock.calls[0]?.slice(1, 3)).toEqual([
      "SettingsTab",
      "Backup",
    ]);
    expect(seqs).toHaveLength(2);
    expect(seqs[1]).toBeGreaterThan(seqs[0] ?? 0);
  });

  it("does nothing before the navigator is ready", () => {
    h.hasSharedBackup.mockReturnValue(true);
    ShareIntentGate({ isReady: false });
    expect(h.navigateIntoTab).not.toHaveBeenCalled();
  });
});
