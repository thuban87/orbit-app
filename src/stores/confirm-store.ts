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
 * Identical requests share one dialog (38.9-06): a `confirm()` / `notice()`
 * identical to one already showing or queued (same kind, title, message,
 * labels and destructive/dismissable/glyph behaviour) adds no second entry and
 * returns the pending request's promise, so a fast double-tap on e.g. Merge
 * shows one dialog and both callers get the same answer. Once that dialog
 * settles, the same request opens a new one. The shared "Discard changes?"
 * prompt (`discard` marker) is never matched; it is single-flight on its own.
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

export type ConfirmEntry = ConfirmQueueEntry | NoticeQueueEntry;

/** A queue entry before the store assigns its id. */
export type NewConfirmEntry =
  | Omit<ConfirmQueueEntry, "id">
  | Omit<NoticeQueueEntry, "id">;

interface ConfirmStoreState {
  queue: ConfirmEntry[];
  /** Appends a request; returns its id. */
  enqueue: (entry: NewConfirmEntry) => number;
  /**
   * Resolves the head of the queue with `value` and removes it. When `id` is
   * given and is not the head (a stale double-tap), nothing happens.
   */
  resolveCurrent: (value: boolean, id?: number) => void;
  /**
   * Back / scrim path: resolves a dismissable confirm `false` and a notice as
   * acknowledged; a no-op for a non-dismissable confirm. `id` as above.
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
    head.resolve(value);
  },
  dismissCurrent: (id) => {
    const head = get().queue[0];
    if (!head) return;
    if (id !== undefined && head.id !== id) return;
    if (head.kind === "notice") {
      get().resolveCurrent(true, head.id);
      return;
    }
    if (!effectiveDismissable(head.request)) return;
    get().resolveCurrent(false, head.id);
  },
}));

/** The promise handed out for each queued `confirm()` / `notice()`, by id. */
const pendingPromises = new Map<number, Promise<boolean> | Promise<void>>();

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

const sameIdentity = (a: unknown[], b: unknown[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/** The pending promise of a queued request identical to `entry`, if any. */
function findPending(
  entry:
    | { kind: "confirm"; request: ConfirmRequest }
    | { kind: "notice"; request: NoticeRequest },
): Promise<boolean> | Promise<void> | undefined {
  for (const queued of confirmStore.getState().queue) {
    if (queued.kind !== entry.kind) continue;
    const same =
      queued.kind === "confirm" && entry.kind === "confirm"
        ? queued.discard !== true &&
          sameIdentity(
            confirmIdentity(queued.request),
            confirmIdentity(entry.request),
          )
        : queued.kind === "notice" && entry.kind === "notice"
          ? sameIdentity(
              noticeIdentity(queued.request),
              noticeIdentity(entry.request),
            )
          : false;
    const promise = same ? pendingPromises.get(queued.id) : undefined;
    if (promise) return promise;
  }
  return undefined;
}

/** Themed two-button confirm; resolves true on confirm, false on cancel/dismiss. */
export function confirm(request: ConfirmRequest): Promise<boolean> {
  const existing = findPending({ kind: "confirm", request });
  if (existing) return existing as Promise<boolean>;
  let id = 0;
  const promise = new Promise<boolean>((resolve) => {
    id = confirmStore.getState().enqueue({
      kind: "confirm",
      request,
      resolve: (value) => {
        pendingPromises.delete(id);
        resolve(value);
      },
    });
  });
  pendingPromises.set(id, promise);
  return promise;
}

/** Themed one-button notice; resolves when acknowledged (button or Back). */
export function notice(request: NoticeRequest): Promise<void> {
  const existing = findPending({ kind: "notice", request });
  if (existing) return existing as Promise<void>;
  let id = 0;
  const promise = new Promise<void>((resolve) => {
    id = confirmStore.getState().enqueue({
      kind: "notice",
      request,
      resolve: () => {
        pendingPromises.delete(id);
        resolve();
      },
    });
  });
  pendingPromises.set(id, promise);
  return promise;
}
