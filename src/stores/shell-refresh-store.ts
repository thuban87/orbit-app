import { useEffect, useRef } from "react";
import { create } from "zustand";

interface ShellRefreshStore {
  revision: number;
  bumpShellRefresh: () => void;
}

const useShellRefreshStore = create<ShellRefreshStore>()((set) => ({
  revision: 0,
  bumpShellRefresh: () => set((state) => ({ revision: state.revision + 1 })),
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
