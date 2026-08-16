/**
 * Manual Vitest mock for `expo-notifications` (activated per-test via
 * `vi.mock("expo-notifications")`).
 *
 * The real module loads the native notifications binding at import, which cannot
 * resolve under the node vitest env. This double is DEPENDENCY-FREE (no
 * react-native import) so the Wave-0 unit suites (11-07 / 11-08 / 11-10 / 11-12
 * / 11-13) can seed the "currently scheduled" set and assert call shapes without
 * the native module.
 *
 * It stubs only the surface those suites drive. `getAllScheduledNotificationsAsync`
 * has a test-seedable backing array whose entries mirror the real request shape
 * (`{ identifier, content: { data, body, categoryIdentifier }, trigger: {
 * channelId, date } }`) so 11-10's full-request reconcile diff — including the
 * item-F stale-body facet — can be exercised. `__reset()` clears every stub's
 * call history AND the backing array between tests.
 */
import { vi } from "vitest";

/**
 * The identifier Expo assigns to a body/default tap (no custom action button).
 * 11-12 treats ONLY this value as a "body tap" (→ open compose/profile), so the
 * double exports the real constant string rather than a placeholder.
 */
export const DEFAULT_ACTION_IDENTIFIER =
  "expo.modules.notifications.actions.DEFAULT";

/** Enum-like objects the code reads (real Expo shapes, minimal members). */
export const SchedulableTriggerInputTypes = {
  DATE: "date",
} as const;

export const AndroidImportance = {
  // 11-06 uses LOW (silent-but-visible) per the owner's "silent, no heads-up"
  // choice — DEFAULT actually plays a sound. Both are exported so a test can
  // assert the channel is created at LOW, not DEFAULT.
  DEFAULT: 3,
  LOW: 2,
} as const;

export const AndroidNotificationVisibility = {
  PRIVATE: 0,
  PUBLIC: 1,
} as const;

/** A single seeded "currently scheduled" request, shaped like the real API. */
export interface ScheduledRequestDouble {
  identifier: string;
  content: {
    data?: Record<string, unknown>;
    body?: string;
    categoryIdentifier?: string;
  };
  trigger: {
    channelId?: string;
    date?: number | Date;
  };
}

/** Test-seedable backing store for `getAllScheduledNotificationsAsync`. */
let scheduled: ScheduledRequestDouble[] = [];

/** Latest handler passed to `setNotificationHandler` (item D — 11-13 asserts). */
let lastNotificationHandler: unknown = null;

export const scheduleNotificationAsync = vi.fn(async () => "mock-id");
export const cancelScheduledNotificationAsync = vi.fn(async () => undefined);
export const getAllScheduledNotificationsAsync = vi.fn(
  async (): Promise<ScheduledRequestDouble[]> => scheduled,
);
export const setNotificationChannelAsync = vi.fn(async () => null);
export const setNotificationCategoryAsync = vi.fn(async () => undefined);
export const registerTaskAsync = vi.fn(async () => undefined);
export const getPermissionsAsync = vi.fn(async () => ({
  status: "granted",
  granted: true,
  canAskAgain: true,
}));
export const requestPermissionsAsync = vi.fn(async () => ({
  status: "granted",
  granted: true,
  canAskAgain: true,
}));
export const addNotificationResponseReceivedListener = vi.fn(() => ({
  remove: vi.fn(),
}));
export const getLastNotificationResponseAsync = vi.fn(async () => null);
// 11-12 calls this after handling a cold-start response so it cannot replay.
export const clearLastNotificationResponseAsync = vi.fn(async () => undefined);
// 11-13 sets a module-scope foreground-presentation handler; record the passed
// object so the test can assert it preserves silence (shouldPlaySound:false).
export const setNotificationHandler = vi.fn((handler: unknown) => {
  lastNotificationHandler = handler;
});

/** Seed the "currently scheduled" set a test reconciles against. */
export function __setScheduled(entries: ScheduledRequestDouble[]): void {
  scheduled = entries;
}

/** Read back the last handler passed to `setNotificationHandler`. */
export function __getNotificationHandler(): unknown {
  return lastNotificationHandler;
}

/** Clear every stub's call history AND the seeded state between tests. */
export function __reset(): void {
  scheduled = [];
  lastNotificationHandler = null;
  for (const stub of [
    scheduleNotificationAsync,
    cancelScheduledNotificationAsync,
    getAllScheduledNotificationsAsync,
    setNotificationChannelAsync,
    setNotificationCategoryAsync,
    registerTaskAsync,
    getPermissionsAsync,
    requestPermissionsAsync,
    addNotificationResponseReceivedListener,
    getLastNotificationResponseAsync,
    clearLastNotificationResponseAsync,
    setNotificationHandler,
  ]) {
    stub.mockClear();
  }
}
