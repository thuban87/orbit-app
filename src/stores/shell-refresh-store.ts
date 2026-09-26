import { useEffect, useRef } from "react";
import { create } from "zustand";

/**
 * Two app-level refresh counters in ONE existing Zustand store (38.3 D-03: no
 * new state library, no event bus):
 *
 * - `revision` — the SHELL tick. Bumped by in-process committed writes (Quick
 *   Log/Undo, bulk, assist, warm notification actions, …) via
 *   `bumpShellRefresh()`; consumed with `useShellRefresh`.
 * - `foregroundRevision` — the FOREGROUND tick (D-14). Published once per owning
 *   launch-sweep run, after its purge/expiry writes settle, by `App.tsx`
 *   forwarding `onSweepSettled` to `publishForegroundRefresh()`; consumed with
 *   `useForegroundRefresh`.
 *
 * The two counters are independent: a shell bump never moves the foreground
 * tick and vice versa. Neither is driven by a timer (D-22).
 */
interface ShellRefreshStore {
  revision: number;
  foregroundRevision: number;
  bumpShellRefresh: () => void;
  publishForegroundRefresh: () => void;
}

const useShellRefreshStore = create<ShellRefreshStore>()((set) => ({
  revision: 0,
  foregroundRevision: 0,
  bumpShellRefresh: () => set((state) => ({ revision: state.revision + 1 })),
  publishForegroundRefresh: () =>
    set((state) => ({ foregroundRevision: state.foregroundRevision + 1 })),
}));

/**
 * App-level refresh tick for shell-originated writes. This is deliberately not
 * the connection-scoped SQLite change notification that dashboard reads avoid.
 */
export function useShellRefresh(onRefresh: () => void): void {
  const revision = useShellRefreshStore((state) => state.revision);
  const initialRevision = useRef(revision);

  useEffect(() => {
    if (revision === initialRevision.current) return;
    initialRevision.current = revision;
    onRefresh();
  }, [onRefresh, revision]);
}

export function bumpShellRefresh(): void {
  useShellRefreshStore.getState().bumpShellRefresh();
}

/**
 * Foreground-resume tick (38.3 D-14). Same skip-initial-revision idiom as
 * `useShellRefresh`: a component mounted after a tick never fires for it, only
 * for ticks published while it is mounted.
 */
export function useForegroundRefresh(onRefresh: () => void): void {
  const revision = useShellRefreshStore((state) => state.foregroundRevision);
  const initialRevision = useRef(revision);

  useEffect(() => {
    if (revision === initialRevision.current) return;
    initialRevision.current = revision;
    onRefresh();
  }, [onRefresh, revision]);
}

/** Publish one foreground tick. Wired to `onSweepSettled` in `App.tsx` only. */
export function publishForegroundRefresh(): void {
  useShellRefreshStore.getState().publishForegroundRefresh();
}

/** Plain snapshot of both counters (node tests and debug; not a subscription). */
export function readRefreshRevisions(): { shell: number; foreground: number } {
  const state = useShellRefreshStore.getState();
  return { shell: state.revision, foreground: state.foregroundRevision };
}
