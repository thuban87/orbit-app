/**
 * ai-suggestion-navigation — the pure, node-tested consume-once decision for the
 * profile→Compose AI intent (Plan 14-05, T-14-16).
 *
 * The profile "AI draft" entry navigates to Compose with a SERIALIZABLE
 * `requestAiSuggestion: true` param (never a callback). Compose must start the
 * (potentially billable) suggestion EXACTLY ONCE per navigation — a focus reload,
 * an app foreground, or a re-render must not re-fire it. The screen enforces that
 * by clearing the param (`navigation.setParams({ requestAiSuggestion: undefined })`)
 * and flipping a ref after a true result; this pure helper owns the decision so it
 * is proven off-device rather than tangled in focus-effect timing.
 *
 * Node-pure: no expo / react-native import.
 */

/**
 * Decide whether THIS focus should auto-start an AI suggestion.
 *
 * Returns `true` only when the route asked for it (`requestAiSuggestion === true`)
 * AND it has not already been consumed for the current navigation. The caller
 * treats a `true` result as single-use: clear the route param and mark it
 * consumed so a repeat focus/render yields `false`.
 *
 * A missing/`false`/non-`true` param is the ordinary "opened to compose" case and
 * never auto-starts a request.
 */
export function consumeAiSuggestionIntent(
  requestAiSuggestion: boolean | undefined,
  alreadyConsumed: boolean,
): boolean {
  return requestAiSuggestion === true && !alreadyConsumed;
}
