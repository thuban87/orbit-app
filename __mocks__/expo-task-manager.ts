/**
 * Manual Vitest mock for `expo-task-manager` (activated per-test via
 * `vi.mock("expo-task-manager")`).
 *
 * `expo-task-manager` is the peer module `Notifications.registerTaskAsync`
 * requires for the killed-app headless task (11-07). The real module loads a
 * native binding at import; this DEPENDENCY-FREE double lets the 11-07 test
 * register the headless task and then invoke the stored callback DIRECTLY —
 * `defineTask` records the task name + callback so the test can drive the
 * headless code path without the native task runtime. `__reset()` clears the
 * recorded state and stub call history between tests.
 */
import { vi } from "vitest";

type TaskExecutor = (body: unknown) => unknown;

/** Last (name, callback) pair passed to `defineTask` — 11-07 invokes it. */
let definedTaskName: string | null = null;
let definedTaskCallback: TaskExecutor | null = null;

export const defineTask = vi.fn(
  (taskName: string, callback: TaskExecutor): void => {
    definedTaskName = taskName;
    definedTaskCallback = callback;
  },
);

export const isTaskDefined = vi.fn(
  (taskName: string): boolean => definedTaskName === taskName,
);

/** Read back the name registered via `defineTask`. */
export function __getDefinedTaskName(): string | null {
  return definedTaskName;
}

/** Read back the callback registered via `defineTask` (invoke it directly). */
export function __getDefinedTaskCallback(): TaskExecutor | null {
  return definedTaskCallback;
}

/** Clear recorded task registration AND stub call history between tests. */
export function __reset(): void {
  definedTaskName = null;
  definedTaskCallback = null;
  defineTask.mockClear();
  isTaskDefined.mockClear();
}
