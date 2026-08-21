/**
 * ai-suggestion-logic — the pure, node-tested ONE-REQUEST lifecycle for the
 * Compose AI Suggest flow (Plan 14-05, AI-02/AI-03).
 *
 * =============================================================================
 * WHAT THIS OWNS (read before editing — these are security/privacy controls):
 *
 *   - ONE in-flight request at a time, tracked by a monotonically-increasing
 *     GENERATION token. Every lifecycle event that ends a request (cancel,
 *     timeout, unmount/navigation, provider/model/contact change, a superseding
 *     `begin`) bumps that token, so a slow completion whose token is stale can
 *     never mutate the draft (T-14-14 / T-14-15).
 *
 *   - The SINGLE AbortController + timeout (H4). This lifecycle is the SOLE
 *     owner; the adapter never creates its own. The controller's `signal` is the
 *     exact one handed to `generate`, and cancel/timeout/unmount/config-change
 *     abort THAT controller. A request only ever holds one controller and one
 *     timeout handle, created together in `egress` and cleared together on settle.
 *
 *   - The immutable `ResolvedPrompt`, resolved ONCE per request and retained only
 *     while that request is active. The SAME reference is exposed in the
 *     `needs-acknowledgement` state (which the inspector + acknowledgement view
 *     read) and handed to `generate` — never rebuilt (M1 / C3-M1).
 *
 *   - The first-send-per-provider ACK GATE (H5): the very first request to a
 *     provider is blocked in `needs-acknowledgement` until the user acknowledges
 *     the EXACT contact-specific prompt. A declined/unacknowledged provider makes
 *     NO network call.
 *
 *   - EGRESS ORDERED STRICTLY AFTER A DURABLE ACK (C2-H3): on acknowledge we
 *     `await acknowledgeProvider()` and ONLY after that promise RESOLVES may the
 *     controller/timeout be created and `generate` be called. A REJECTED ack write
 *     yields ZERO `generate` calls.
 *
 *   - The STALE-REQUEST GUARD after the ack await (C3-H4): no controller exists
 *     while the ack write holds the shared SQLite mutex, so cancel / unmount /
 *     navigation / provider-model / contact change can occur DURING that await.
 *     After the ack resolves we re-validate the token is still current, the screen
 *     is still active (focused + mounted), and provider/model/contact are
 *     unchanged — if ANY differs we abort WITHOUT creating a controller or calling
 *     `generate`.
 *
 *   - No auto-retry (T-14-07): a network/timeout outcome ends in `error`; only a
 *     deliberate `retry()` (a fresh `begin`) starts another request.
 *
 * This module is NODE-PURE: no expo / react-native import. Every side effect —
 * prompt resolution, the ack write, the provider call, the AbortController
 * factory, the timer, the draft mutation, freshness facts — is INJECTED, so the
 * whole lifecycle is proven off-device with Vitest. The lifecycle has NO
 * DAO/contact/interaction/fuel/cache/export write capability except the explicit
 * `acknowledgeProvider` callback the screen wires to the narrow DAO writer.
 * =============================================================================
 */
import type { ResolvedPrompt } from "@/ai/prompt-types";
import type { AiProviderId } from "@/services/ai-types";

/**
 * The AI-suggestion request timeout (H4). A single-number tuning surface — the
 * ONE place the 20s bound lives; the lifecycle owns it, never the adapter.
 */
export const AI_REQUEST_TIMEOUT_MS = 20_000;

/** Opaque timer handle — the injected `setTimer` decides its real type. */
export type TimerHandle = unknown;

/**
 * The immutable identity a request is bound to. The stale guard (C3-H4)
 * re-compares this AFTER the ack await; any change drops the request.
 */
export interface RequestConfig {
  readonly provider: AiProviderId;
  readonly model: string;
  readonly contactId: number;
}

/** The view-state the Compose AI flow renders. `idle` shows only the trigger. */
export type AiSuggestionState =
  | { readonly status: "idle" }
  /** Resolving the one prompt (pre-gate) — a bounded, cancellable async step. */
  | { readonly status: "resolving" }
  /**
   * The first-send gate (H5): the EXACT contact-specific prompt awaiting
   * acknowledgement. `prompt` is the SAME immutable reference handed to
   * `generate` — the inspector + acknowledgement views read it unchanged.
   */
  | {
      readonly status: "needs-acknowledgement";
      readonly provider: AiProviderId;
      readonly prompt: ResolvedPrompt;
    }
  /** The network request is in flight; Cancel aborts the sole controller. */
  | { readonly status: "loading" }
  /**
   * A validated draft is ready but the editor already holds text — replacing it
   * requires explicit confirmation (T-14-14). The draft is untouched until then.
   */
  | { readonly status: "confirm-replace"; readonly suggestion: string }
  /** A sanitized failure (its `code` only — never raw provider detail). */
  | { readonly status: "error"; readonly code: string };

/** True when two request configs are byte-identical (stale-guard comparison). */
function sameConfig(a: RequestConfig, b: RequestConfig): boolean {
  return (
    a.provider === b.provider &&
    a.model === b.model &&
    a.contactId === b.contactId
  );
}

/** The injected effects + freshness facts the lifecycle drives. */
export interface AiSuggestionDeps {
  /** Resolve the ONE immutable prompt for this request (called once per begin). */
  readonly resolvePrompt: () => Promise<ResolvedPrompt>;
  /** Whether the active provider has already been acknowledged (H5 gate input). */
  readonly isProviderAcknowledged: () => boolean;
  /**
   * Persist the per-provider acknowledgement. Its promise MUST resolve (commit)
   * before any controller/generate (C2-H3); a rejection blocks egress entirely.
   */
  readonly acknowledgeProvider: () => Promise<void>;
  /** The provider call — receives the caller-owned signal (H4), reads `.payload`. */
  readonly generate: (
    prompt: ResolvedPrompt,
    signal: AbortSignal,
  ) => Promise<string>;
  /** Apply a validated draft to the editor (the only "write" the flow performs). */
  readonly applyDraft: (text: string) => void;
  /** Whether the editor draft is empty (decides direct-apply vs confirm-replace). */
  readonly isDraftEmpty: () => boolean;
  /** Create the SOLE AbortController (injected so tests observe the exact signal). */
  readonly createController: () => AbortController;
  /** Arm the request timeout. */
  readonly setTimer: (fn: () => void, ms: number) => TimerHandle;
  /** Clear the request timeout. */
  readonly clearTimer: (handle: TimerHandle) => void;
  /** Whether the screen is still active (focused AND mounted) — stale-guard fact. */
  readonly isActive: () => boolean;
  /** The live request config — re-read AFTER the ack await for the stale guard. */
  readonly currentConfig: () => RequestConfig;
  /** Map an unknown failure to a stable, sanitized code (never raw detail). */
  readonly sanitizeError: (err: unknown) => string;
  /** Surface each state transition to the screen. */
  readonly onChange: (state: AiSuggestionState) => void;
}

/**
 * The one-request Compose AI lifecycle. A small stateful owner (it genuinely
 * holds a controller + timeout), but node-pure and fully injected. All external
 * events funnel through methods that keep exactly one request live.
 */
export class AiSuggestionLifecycle {
  /** Monotonically-increasing request generation; the freshness token. */
  private gen = 0;
  /** The SOLE AbortController for the active request (H4), or null when none. */
  private controller: AbortController | null = null;
  /** The SOLE timeout handle for the active request, or null when none. */
  private timer: TimerHandle | null = null;
  /** The gate context captured before the ack await (prompt + snapshot). */
  private pending: {
    readonly token: number;
    readonly config: RequestConfig;
    readonly prompt: ResolvedPrompt;
  } | null = null;
  private state: AiSuggestionState = { status: "idle" };

  constructor(private readonly deps: AiSuggestionDeps) {}

  /** The current view-state (the screen mirrors this via `onChange`). */
  getState(): AiSuggestionState {
    return this.state;
  }

  private set(next: AiSuggestionState): void {
    this.state = next;
    this.deps.onChange(next);
  }

  /** Stop + null the timeout handle if one is armed. */
  private stopTimer(): void {
    if (this.timer !== null) {
      this.deps.clearTimer(this.timer);
      this.timer = null;
    }
  }

  /**
   * Invalidate any in-flight/pending request: bump the token (so a slow
   * completion is stale), abort the sole controller, and clear the timeout.
   * Does NOT itself set a view-state — callers decide the resulting state.
   */
  private invalidate(): void {
    this.gen += 1;
    this.pending = null;
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
    this.stopTimer();
  }

  /**
   * Begin a new request — the deliberate action behind the AI Suggest trigger
   * AND `retry()` (never an automatic retry). Supersedes any prior request.
   */
  async begin(): Promise<void> {
    this.invalidate();
    const token = this.gen;
    const config = this.deps.currentConfig();
    this.set({ status: "resolving" });

    let prompt: ResolvedPrompt;
    try {
      // Resolve the ONE immutable prompt for this request, exactly once.
      prompt = await this.deps.resolvePrompt();
    } catch (err) {
      if (token !== this.gen) return; // superseded while resolving
      this.set({ status: "error", code: this.deps.sanitizeError(err) });
      return;
    }
    // A cancel/unmount/config-change during resolution supersedes this request.
    if (token !== this.gen || !this.deps.isActive()) return;

    if (this.deps.isProviderAcknowledged()) {
      // Already acknowledged: no gate — go straight to egress with this prompt.
      await this.egress(prompt, token, config);
      return;
    }

    // H5: block egress until the EXACT contact-specific prompt is acknowledged.
    this.pending = { token, config, prompt };
    this.set({
      status: "needs-acknowledgement",
      provider: config.provider,
      prompt,
    });
  }

  /**
   * The user acknowledged the first-send gate. Orders a DURABLE ack strictly
   * before egress (C2-H3) and re-validates freshness after the await (C3-H4).
   */
  async acknowledge(): Promise<void> {
    const pending = this.pending;
    if (!pending || this.state.status !== "needs-acknowledgement") return;
    if (pending.token !== this.gen) {
      this.pending = null;
      return;
    }

    // C2-H3: the ack write MUST commit before any controller/generate exists.
    try {
      await this.deps.acknowledgeProvider();
    } catch (err) {
      // A rejected ack write blocks egress entirely — ZERO generate calls.
      if (pending.token !== this.gen) return;
      this.pending = null;
      this.set({ status: "error", code: this.deps.sanitizeError(err) });
      return;
    }

    // C3-H4: no controller existed during the await, so cancel/unmount/config
    // change could have happened. Re-validate BEFORE creating a controller.
    if (
      pending.token !== this.gen ||
      !this.deps.isActive() ||
      !sameConfig(pending.config, this.deps.currentConfig())
    ) {
      this.pending = null;
      return; // stale intent dropped — no controller, no generate
    }

    this.pending = null;
    await this.egress(pending.prompt, pending.token, pending.config);
  }

  /** The user declined the first-send gate — no network call, back to idle. */
  decline(): void {
    if (this.state.status !== "needs-acknowledgement") return;
    this.pending = null;
    this.set({ status: "idle" });
  }

  /**
   * Create the SOLE controller + timeout (H4) and dispatch the provider call.
   * Reached ONLY after the ack gate has passed (or was not required).
   */
  private async egress(
    prompt: ResolvedPrompt,
    token: number,
    _config: RequestConfig,
  ): Promise<void> {
    const controller = this.deps.createController();
    this.controller = controller;
    this.timer = this.deps.setTimer(
      () => this.onTimeout(token),
      AI_REQUEST_TIMEOUT_MS,
    );
    this.set({ status: "loading" });

    let draft: string;
    try {
      // The adapter receives THIS controller's signal (H4) and the SAME prompt.
      draft = await this.deps.generate(prompt, controller.signal);
    } catch (err) {
      if (token !== this.gen) return; // stale failure — ignore (already handled)
      this.stopTimer();
      this.controller = null;
      this.set({ status: "error", code: this.deps.sanitizeError(err) });
      return;
    }

    if (token !== this.gen) return; // stale completion cannot mutate the draft
    this.stopTimer();
    this.controller = null;

    if (this.deps.isDraftEmpty()) {
      // Empty editor: apply directly, no confirmation needed.
      this.deps.applyDraft(draft);
      this.set({ status: "idle" });
    } else {
      // Non-empty editor: require explicit replacement confirmation (T-14-14).
      this.set({ status: "confirm-replace", suggestion: draft });
    }
  }

  /** Confirm replacing the non-empty draft with the pending suggestion. */
  confirmReplace(): void {
    if (this.state.status !== "confirm-replace") return;
    const { suggestion } = this.state;
    this.deps.applyDraft(suggestion);
    this.set({ status: "idle" });
  }

  /** Keep the existing draft; discard the suggestion (no mutation). */
  cancelReplace(): void {
    if (this.state.status !== "confirm-replace") return;
    this.set({ status: "idle" });
  }

  /** User cancelled the in-flight request — abort the sole controller, go idle. */
  cancel(): void {
    this.invalidate();
    this.set({ status: "idle" });
  }

  /** The request timeout fired — abort the sole controller and surface `timeout`. */
  private onTimeout(token: number): void {
    if (token !== this.gen) return; // a settled/superseded request's stale timer
    // Bump the token so the in-flight generate's completion is treated as stale.
    this.gen += 1;
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
    this.timer = null;
    this.set({ status: "error", code: "timeout" });
  }

  /**
   * Navigation away / unmount — abort + invalidate SILENTLY (no error surface).
   * Idempotent; safe to call from a focus-effect cleanup.
   */
  dispose(): void {
    this.invalidate();
  }

  /**
   * Provider / model / contact changed — invalidate any pending/in-flight
   * request so a stale intent can never egress against the new config, and reset
   * the visible state to idle.
   */
  onConfigChange(): void {
    this.invalidate();
    if (this.state.status !== "idle") {
      this.set({ status: "idle" });
    }
  }

  /** A deliberate Retry — a brand-new request, NEVER an automatic one. */
  retry(): Promise<void> {
    return this.begin();
  }
}
