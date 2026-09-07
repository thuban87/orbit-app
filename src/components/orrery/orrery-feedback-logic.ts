/** Approved E9 copy, shared by canvas feedback and conventional surfaces. */
const COPY = {
  "world-loading": { message: "Loading your Orrery…" },
  "list-loading": { message: "Loading contacts…" },
  read: {
    message: "Couldn't load this System. Try loading it again.",
    action: "Reload System",
  },
  stale: {
    message: "Couldn't refresh this System. Showing the last loaded contacts.",
    action: "Reload System",
  },
  preferences: {
    message: "Couldn't save your view options. Try that change again.",
    action: "Retry view change",
  },
  settings: {
    message: "Couldn't load your view options. Try loading them again.",
    action: "Reload view options",
  },
  reorder: {
    message:
      "Couldn't change the orbit order. The saved order has been restored.",
    action: "Reload System",
  },
  satellites: {
    message:
      "Couldn't load relationship satellites. Your contacts are still available.",
    action: "Reload satellites",
  },
  removed: {
    message: "This contact is no longer in this System.",
    action: "Show All Contacts",
  },
  missing: {
    message: "This System is no longer available.",
    action: "Show All Contacts",
  },
} as const;
export type OrreryFeedbackKind = keyof typeof COPY;
export function feedbackCopy(kind: OrreryFeedbackKind): {
  message: string;
  action?: string;
} {
  return COPY[kind];
}
export function createFeedbackRetry(publish: (busy: boolean) => void) {
  let pending = false;
  let disposed = false;
  return {
    activate() {
      disposed = false;
    },
    async run(operation: () => void | Promise<void>) {
      if (pending || disposed) return;
      pending = true;
      publish(true);
      try {
        await operation();
      } catch {
        /* Operation owner retains truthful failure state. */
      } finally {
        pending = false;
        if (!disposed) publish(false);
      }
    },
    dispose() {
      disposed = true;
    },
  };
}
