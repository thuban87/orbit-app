/**
 * ai-suggestion-logic — the pure, node-tested ONE-REQUEST lifecycle for the
 * Compose AI Suggest flow (ADR-079 three-suggestion contract; Phase 35-04,
 * reshaped from the Plan 14-05 single-suggestion-with-ack lifecycle).
 *
 * =============================================================================
 * WHAT THIS OWNS (read before editing — these are security/privacy controls):
 *
 *   - ONE in-flight request at a time, tracked by a monotonically-increasing
 *     GENERATION token. Every lifecycle event that ends a request (cancel,
 *     timeout, unmount/navigation, provider/model/contact change, a superseding
 *     `begin`) bumps that token, so a slow completion whose token is stale can
 *     never mutate the draft or the suggestion set (T-14-14 / T-14-15).
 *
 *   - The SINGLE AbortController + timeout (H4). This lifecycle is the SOLE
 *     owner; the adapter never creates its own. The controller's `signal` is the
 *     exact one handed to `generate`, and cancel/timeout/unmount/config-change
 *     abort THAT controller. A request only ever holds one controller and one
 *     timeout handle, created together in `egress` and cleared together on settle.
 *
 *   - FAN-OUT CANCELLATION ON A NON-STALE FAILURE (HIGH-2). `generate` is a
 *     three-call fan-out (wired in plan 35-08 via `generateVariants`) sharing
 *     THIS controller's read-only signal. The fan-out helper cannot abort (its
 *     signal is read-only); on the first rejection it fast-fails and propagates
 *     the sanitized error. So the lifecycle — the sole controller owner — aborts
 *     its controller on a non-stale generation failure BEFORE nulling it, which
 *     the still-in-flight sibling provider calls observe via the shared signal.
 *     No orphaned in-flight egress on a partial fan-out failure.
 *
 *   - The immutable `ResolvedPrompt`, resolved ONCE per request and retained only
 *     while that request is active. The SAME reference is handed to `generate`,
 *     never rebuilt (M1 / C3-M1).
 *
 *   - The DRAFT vs REWRITE boundary (COMP-12). `begin()` reads the injected
 *     `isEditorEmpty` predicate: an empty editor is a DRAFT request (resolvePrompt
 *     called with no sourceDraft), a non-empty editor a REWRITE request
 *     (resolvePrompt called WITH the current editor body as `sourceDraft`). The
 *     lifecycle only PASSES the source-draft through; the delimited RENDERING of
 *     it into the prompt is delivered by plan 35-08 (prompt-template.ts). The
 *     source-draft is the user's OWN composition — not contact-data egress; the
 *     PromptContext allowlist is unchanged by it.
 *
 *   - A NON-DESTRUCTIVE REVIEW SURFACE (ADR-079). A successful generation resolves
 *     to `review` carrying EXACTLY three unlabeled suggestion strings. The editor
 *     is NOT mutated by generation; only an explicit `chooseSuggestion(index)`
 *     applies one. `retry()` (Try Again) starts a fresh `begin()` that replaces
 *     the whole set — there is no generation-history stack.
 *
 *   - No auto-retry (T-14-07): a network/timeout outcome ends in `error`; only a
 *     deliberate `retry()` (a fresh `begin`) starts another request.
 *
 * This module is NODE-PURE: no expo / react-native import. Every side effect —
 * prompt resolution, the provider call, the AbortController factory, the timer,
 * the draft mutation, freshness facts — is INJECTED, so the whole lifecycle is
 * proven off-device with Vitest. The lifecycle has NO DAO/contact/interaction/
 * fuel/cache/export write capability.
 *
 * ACK GATE REMOVED (D-09 / ADR-079, Trip-Wire 4): the ADR-052 first-send
 * acknowledgement gate and the entire acknowledgement path are gone — generation
 * is never gated on a per-provider acknowledgement flag that nothing sets. The
 * DAO-level acknowledgement writer stays in place (forward-only columns); this
 * module simply no longer calls it.
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
 * The immutable identity a request is bound to. Provider/model/contact changes
 * are signalled to the lifecycle via `onConfigChange()` (which bumps the token
 * and aborts), so a stale intent can never egress against a new config.
 */
export interface RequestConfig {
  readonly provider: AiProviderId;
  readonly model: string;
  readonly contactId: number;
}

/** The view-state the Compose AI flow renders. `idle` shows only the trigger. */
export type AiSuggestionState =
  | { readonly status: "idle" }
  /** Resolving the one prompt — a bounded, cancellable async step. */
  | { readonly status: "resolving" }
  /** The network request is in flight; Cancel aborts the sole controller. */
  | { readonly status: "loading" }
  /**
   * Exactly three unlabeled suggestions are ready on a non-destructive review
   * surface (ADR-079). The editor is UNTOUCHED until an explicit
   * `chooseSuggestion(index)`; `retry()` replaces the whole set.
   */
  | { readonly status: "review"; readonly suggestions: readonly string[] }
  /** A sanitized failure (its `code` only — never raw provider detail). */
  | { readonly status: "error"; readonly code: string };

/** The injected effects + freshness facts the lifecycle drives. */
export interface AiSuggestionDeps {
  /**
   * Resolve the ONE immutable prompt for this request (called once per begin).
   * For a Rewrite, `sourceDraft` is the current editor body; for a Draft it is
   * `undefined`. The lifecycle only PASSES it through — the delimited rendering
   * of the source-draft into the prompt is plan 35-08's prompt-template work.
   */
  readonly resolvePrompt: (
    sourceDraft?: string,
    adjustGuidance?: string,
  ) => Promise<ResolvedPrompt>;
  /**
   * The provider fan-out — receives the caller-owned signal (H4) and resolves
   * EXACTLY three variant drafts. Wired in plan 35-08 to `generateVariants`
   * (three independently-cancellable provider calls under this one signal); the
   * lifecycle here just awaits the array. On the first rejection the fan-out
   * fast-fails; the lifecycle then aborts its controller so the siblings cancel.
   */
  readonly generate: (
    prompt: ResolvedPrompt,
    signal: AbortSignal,
  ) => Promise<readonly string[]>;
  /** Apply a chosen suggestion to the editor (the only "write" the flow performs). */
  readonly applyDraft: (text: string) => void;
  /** Whether the editor is empty — decides Draft (empty) vs Rewrite (non-empty). */
  readonly isEditorEmpty: () => boolean;
  /** The current editor body — passed as `sourceDraft` on a Rewrite request. */
  readonly getEditorBody: () => string;
  /** Create the SOLE AbortController (injected so tests observe the exact signal). */
  readonly createController: () => AbortController;
  /** Arm the request timeout. */
  readonly setTimer: (fn: () => void, ms: number) => TimerHandle;
  /** Clear the request timeout. */
  readonly clearTimer: (handle: TimerHandle) => void;
  /** Whether the screen is still active (focused AND mounted) — stale-guard fact. */
  readonly isActive: () => boolean;
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
  /** Session-only guidance retained solely so an explicit retry preserves it. */
  private lastAdjustGuidance: string | undefined;
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
   * Invalidate any in-flight request: bump the token (so a slow completion is
   * stale), abort the sole controller, and clear the timeout. Does NOT itself
   * set a view-state — callers decide the resulting state.
   */
  private invalidate(): void {
    this.gen += 1;
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
    this.stopTimer();
  }

  /**
   * Begin a new request — the deliberate action behind the AI Suggest trigger
   * AND `retry()` (never an automatic retry). Supersedes any prior request.
   * Empty editor → Draft (no sourceDraft); non-empty editor → Rewrite (the
   * current editor body carried as sourceDraft).
   */
  async begin(adjustGuidance?: string): Promise<void> {
    this.invalidate();
    const token = this.gen;
    const normalizedGuidance = adjustGuidance?.trim();
    this.lastAdjustGuidance =
      normalizedGuidance && normalizedGuidance.length > 0
        ? normalizedGuidance
        : undefined;
    // Snapshot the Draft-vs-Rewrite decision at begin time.
    const sourceDraft = this.deps.isEditorEmpty()
      ? undefined
      : this.deps.getEditorBody();
    this.set({ status: "resolving" });

    let prompt: ResolvedPrompt;
    try {
      // Resolve the ONE immutable prompt for this request, exactly once.
      prompt =
        this.lastAdjustGuidance === undefined
          ? await this.deps.resolvePrompt(sourceDraft)
          : await this.deps.resolvePrompt(sourceDraft, this.lastAdjustGuidance);
    } catch (err) {
      if (token !== this.gen) return; // superseded while resolving
      this.set({ status: "error", code: this.deps.sanitizeError(err) });
      return;
    }
    // A cancel/unmount/config-change during resolution supersedes this request.
    if (token !== this.gen || !this.deps.isActive()) return;

    // No ack gate (D-09/ADR-079): go straight to egress with this prompt.
    await this.egress(prompt, token);
  }

  /**
   * Create the SOLE controller + timeout (H4) and dispatch the provider fan-out.
   */
  private async egress(prompt: ResolvedPrompt, token: number): Promise<void> {
    const controller = this.deps.createController();
    this.controller = controller;
    this.timer = this.deps.setTimer(
      () => this.onTimeout(token),
      AI_REQUEST_TIMEOUT_MS,
    );
    this.set({ status: "loading" });

    let suggestions: readonly string[];
    try {
      // The fan-out receives THIS controller's signal (H4) and the SAME prompt.
      suggestions = await this.deps.generate(prompt, controller.signal);
    } catch (err) {
      if (token !== this.gen) return; // stale failure — ignore (already handled)
      // HIGH-2: abort THIS controller BEFORE nulling it so any in-flight sibling
      // provider calls (the fan-out cannot abort its own read-only signal)
      // observe the abort and are cancelled — no orphaned in-flight egress.
      controller.abort();
      this.stopTimer();
      this.controller = null;
      this.set({ status: "error", code: this.deps.sanitizeError(err) });
      return;
    }

    if (token !== this.gen) return; // stale completion cannot mutate anything
    this.stopTimer();
    this.controller = null;
    // Non-destructive: the three suggestions are exposed for review; the editor
    // is untouched until an explicit chooseSuggestion(index).
    this.set({ status: "review", suggestions });
  }

  /**
   * Apply exactly one reviewed suggestion to the editor — the ONLY mutation of
   * the draft. Out-of-range indices are ignored.
   */
  chooseSuggestion(index: number): void {
    if (this.state.status !== "review") return;
    const text = this.state.suggestions[index];
    if (text === undefined) return;
    this.deps.applyDraft(text);
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
    // Reset the visible state so a dispose (blur / contactId change / unmount)
    // can NEVER strand the UI in 'resolving' or 'loading'. Mirrors onConfigChange.
    if (this.state.status !== "idle") {
      this.set({ status: "idle" });
    }
  }

  /**
   * Provider / model / contact changed — invalidate any in-flight request so a
   * stale intent can never egress against the new config, and reset the visible
   * state to idle.
   */
  onConfigChange(): void {
    this.invalidate();
    if (this.state.status !== "idle") {
      this.set({ status: "idle" });
    }
  }

  /** A deliberate Retry — a brand-new request, NEVER an automatic one. */
  retry(): Promise<void> {
    return this.begin(this.lastAdjustGuidance);
  }

  /** Deliberately generate a fresh three-alternative set with ephemeral guidance. */
  adjust(guidance: string): Promise<void> {
    return this.begin(guidance);
  }
}
