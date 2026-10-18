import { create } from "zustand";

/**
 * Imperative themed confirms and notices (38.9 D-24, D-27, D-43).
 *
 * Any module (component, hook, module-level helper or service) can
 * `await confirm({...})` (→ boolean) or `await notice({...})` (→ void). Requests
 * queue FIFO; `DialogHost`, mounted once in App.tsx, renders the head of the
 * queue through the shared `ConfirmDialog`. React-free, so it is unit-testable
 * and callable outside a render.
 *
 * Dismissal (D-06, ADR-086): Back or a scrim tap calls `dismissCurrent()`,
 * which resolves a dismissable confirm `false` and a notice as acknowledged. A
 * destructive confirm, or one created with `dismissable: false`, is never
 * dismissable — `effectiveDismissable` makes `destructive` win over an explicit
 * `dismissable: true` — so only its buttons can resolve it.
 *
 * Identical requests show one dialog (38.9-06; 38.9 review WR-01): a
 * `confirm()` / `notice()` identical to one already showing or queued (same
 * kind, title, message, labels and destructive/dismissable/glyph behaviour)
 * adds no second entry. Only the FIRST caller gets the user's answer; the
 * duplicate resolves at once — `false` for a confirm (stay, do nothing), as
 * `confirmDiscard()` does, and acknowledged for a notice. So a fast double-tap
 * on e.g. Merge shows one dialog and runs the confirmed action once, never
 * twice. Once that dialog settles, the same request opens a new one. The
 * shared "Discard changes?" prompt (`discard` marker) is never matched; it is
 * single-flight on its own.
 *
 * Three-way choice (38.11 D-73, ADR-198 one imperative family): `choose({...})`
 * shows the same dialog with a third, secondary button and resolves
 * `"confirm"`, `"secondary"` or `"cancel"`. Back/scrim resolves `"cancel"`
 * when dismissable (default true), and an identical pending choice resolves
 * `"cancel"` at once, matching `confirm()`'s stay-and-do-nothing duplicate.
 */

export interface ConfirmRequest {
  /** Names the action being confirmed. */
  title: string;
  message?: string;
  confirmLabel: string;
  /** Defaults to "Cancel". */
  cancelLabel?: string;
  /** Destructive confirm button + non-dismissable (ADR-086). */
  destructive?: boolean;
  /**
   * Back/scrim dismissal (default true). Set false where Cancel has a side
   * effect (RESEARCH Pitfall 1). Ignored (always false) when destructive.
   */
  dismissable?: boolean;
  /** Warning glyph above the title; defaults to `destructive` (D-52). */
  headingGlyph?: boolean;
}

export interface NoticeRequest {
  title: string;
  message?: string;
  /** Defaults to "OK". */
  acknowledgeLabel?: string;
}

/** What a three-way `choose()` resolves to. */
export type ChoiceResult = "confirm" | "secondary" | "cancel";

export interface ChooseRequest {
  title: string;
  message?: string;
  /** The Primary choice; resolves "confirm". */
  confirmLabel: string;
  /** The third, secondary-role choice; resolves "secondary". */
  secondaryLabel: string;
  /**
   * Draw the secondary choice as a Destructive button (danger fill + warning
   * glyph) for an irreversible choice inside a single ask (38.12 D-150).
   * Styling only: dismissal still resolves "cancel", which does nothing.
   */
  secondaryDestructive?: boolean;
  /** Defaults to "Cancel"; resolves "cancel". */
  cancelLabel?: string;
  /** Back/scrim dismissal resolving "cancel" (default true). */
  dismissable?: boolean;
}

interface ConfirmEntryBase {
  id: number;
  resolve: (value: boolean) => void;
}

export interface ConfirmQueueEntry extends ConfirmEntryBase {
  kind: "confirm";
  request: ConfirmRequest;
  /**
   * Internal marker for the shared "Discard changes?" prompt
   * (`discard-keep-guard.ts` `confirmDiscard()`), which is single-flight by
   * reading this queue. `confirm()` never sets it.
   */
  discard?: true;
}

export interface NoticeQueueEntry extends ConfirmEntryBase {
  kind: "notice";
  request: NoticeRequest;
}

export interface ChoiceQueueEntry {
  id: number;
  kind: "choice";
  request: ChooseRequest;
  resolve: (value: ChoiceResult) => void;
}

export type ConfirmEntry =
  | ConfirmQueueEntry
  | NoticeQueueEntry
  | ChoiceQueueEntry;

/** A queue entry before the store assigns its id. */
export type NewConfirmEntry =
  | Omit<ConfirmQueueEntry, "id">
  | Omit<NoticeQueueEntry, "id">
  | Omit<ChoiceQueueEntry, "id">;

interface ConfirmStoreState {
  queue: ConfirmEntry[];
  /** Appends a request; returns its id. */
  enqueue: (entry: NewConfirmEntry) => number;
  /**
   * Resolves the head of the queue with `value` and removes it. When `id` is
   * given and is not the head (a stale double-tap), nothing happens. A choice
   * head maps `true` to "confirm" and `false` to "cancel".
   */
  resolveCurrent: (value: boolean, id?: number) => void;
  /**
   * Resolves a choice head with `choice` and removes it. A no-op when the head
   * is not a choice, or when `id` is given and is not the head.
   */
  chooseCurrent: (choice: ChoiceResult, id?: number) => void;
  /**
   * Back / scrim path: resolves a dismissable confirm `false`, a dismissable
   * choice "cancel" and a notice as acknowledged; a no-op for a non-dismissable
   * confirm or choice. `id` as above.
   */
  dismissCurrent: (id?: number) => void;
}

/**
 * A destructive confirm can never be made dismissable (D-06, ADR-086).
 * `{}` → true; `{destructive:true}` → false; `{dismissable:false}` → false;
 * `{destructive:true, dismissable:true}` → false.
 */
export function effectiveDismissable({
  destructive,
  dismissable,
}: {
  destructive?: boolean;
  dismissable?: boolean;
}): boolean {
  return !destructive && (dismissable ?? true);
}

let nextId = 1;

export const confirmStore = create<ConfirmStoreState>()((set, get) => ({
  queue: [],
  enqueue: (entry) => {
    const id = nextId;
    nextId += 1;
    set((state) => ({
      queue: [...state.queue, { ...entry, id } as ConfirmEntry],
    }));
    return id;
  },
  resolveCurrent: (value, id) => {
    const head = get().queue[0];
    if (!head) return;
    if (id !== undefined && head.id !== id) return;
    // Remove first so a resolution that enqueues a follow-up lands behind.
    set((state) => ({ queue: state.queue.slice(1) }));
    if (head.kind === "choice") {
      head.resolve(value ? "confirm" : "cancel");
      return;
    }
    head.resolve(value);
  },
  chooseCurrent: (choice, id) => {
    const head = get().queue[0];
    if (head?.kind !== "choice") return;
    if (id !== undefined && head.id !== id) return;
    set((state) => ({ queue: state.queue.slice(1) }));
    head.resolve(choice);
  },
  dismissCurrent: (id) => {
    const head = get().queue[0];
    if (!head) return;
    if (id !== undefined && head.id !== id) return;
    if (head.kind === "notice") {
      get().resolveCurrent(true, head.id);
      return;
    }
    if (head.kind === "choice") {
      if (!effectiveDismissable({ dismissable: head.request.dismissable })) {
        return;
      }
      get().chooseCurrent("cancel", head.id);
      return;
    }
    if (!effectiveDismissable(head.request)) return;
    get().resolveCurrent(false, head.id);
  },
}));

/** A confirm request with its defaults applied, for identity comparison. */
function confirmIdentity(request: ConfirmRequest) {
  const destructive = request.destructive ?? false;
  return [
    request.title,
    request.message ?? "",
    request.confirmLabel,
    request.cancelLabel ?? "Cancel",
    destructive,
    effectiveDismissable(request),
    request.headingGlyph ?? destructive,
  ];
}

function noticeIdentity(request: NoticeRequest) {
  return [
    request.title,
    request.message ?? "",
    request.acknowledgeLabel ?? "OK",
  ];
}

function choiceIdentity(request: ChooseRequest) {
  return [
    request.title,
    request.message ?? "",
    request.confirmLabel,
    request.secondaryLabel,
    request.secondaryDestructive ?? false,
    request.cancelLabel ?? "Cancel",
    effectiveDismissable({ dismissable: request.dismissable }),
  ];
}

const sameIdentity = (a: unknown[], b: unknown[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/** Whether a request identical to `entry` is already showing or queued. */
function hasPending(
  entry:
    | { kind: "confirm"; request: ConfirmRequest }
    | { kind: "notice"; request: NoticeRequest }
    | { kind: "choice"; request: ChooseRequest },
): boolean {
  return confirmStore.getState().queue.some((queued) => {
    if (queued.kind === "confirm" && entry.kind === "confirm") {
      return (
        queued.discard !== true &&
        sameIdentity(
          confirmIdentity(queued.request),
          confirmIdentity(entry.request),
        )
      );
    }
    if (queued.kind === "notice" && entry.kind === "notice") {
      return sameIdentity(
        noticeIdentity(queued.request),
        noticeIdentity(entry.request),
      );
    }
    if (queued.kind === "choice" && entry.kind === "choice") {
      return sameIdentity(
        choiceIdentity(queued.request),
        choiceIdentity(entry.request),
      );
    }
    return false;
  });
}

/**
 * Themed two-button confirm; resolves true on confirm, false on cancel/dismiss.
 * A duplicate of a pending identical confirm resolves false at once (WR-01).
 */
export function confirm(request: ConfirmRequest): Promise<boolean> {
  if (hasPending({ kind: "confirm", request })) return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    confirmStore.getState().enqueue({ kind: "confirm", request, resolve });
  });
}

/**
 * Themed one-button notice; resolves when acknowledged (button or Back). A
 * duplicate of a pending identical notice adds no dialog and resolves at once.
 */
export function notice(request: NoticeRequest): Promise<void> {
  if (hasPending({ kind: "notice", request })) return Promise.resolve();
  return new Promise<void>((resolve) => {
    confirmStore.getState().enqueue({
      kind: "notice",
      request,
      resolve: () => resolve(),
    });
  });
}

/**
 * Themed three-way choice (38.11 D-73): Cancel, a secondary choice and a
 * Primary confirm in the one shared dialog. Resolves "confirm", "secondary" or
 * "cancel"; Back/scrim resolves "cancel" when dismissable. A duplicate of a
 * pending identical choice resolves "cancel" at once (WR-01).
 */
export function choose(request: ChooseRequest): Promise<ChoiceResult> {
  if (hasPending({ kind: "choice", request })) {
    return Promise.resolve("cancel");
  }
  return new Promise<ChoiceResult>((resolve) => {
    confirmStore.getState().enqueue({ kind: "choice", request, resolve });
  });
}
