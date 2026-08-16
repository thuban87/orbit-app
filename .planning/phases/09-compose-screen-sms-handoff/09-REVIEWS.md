---
phase: 9
slug: compose-screen-sms-handoff
reviewers: [codex, claude]
created: 2026-08-16
---

# Phase 9 — Cross-AI Plan Reviews

> Two independent reviewers (codex CLI + a read-only Claude subagent — the `claude -p` headless path
> is broken in this repo, so the Claude perspective comes from a read-only subagent whose findings are
> aggregated here). Both verified cited symbols against the actual source. Feedback consumed by
> `/gsd-plan-phase 9 --reviews`.

## Cycle 1

**Combined verdict:** 0 HIGH · 5 deduped actionable (3 MEDIUM + 2 LOW).
- codex `CYCLE_SUMMARY: high=0 actionable_nonhigh=4`
- claude `CLAUDE_SUMMARY: high=0 actionable_nonhigh=2`

Both confirmed the load-bearing invariants are correctly specified: fuel via `getRankedFuel`
(off_limits + unconfirmed-AI excluded in-query, `listFuelForEditor` forbidden), DATA-04 no-write,
additive `getContactHeader.phone` widening, additive `Compose` route, `formatFuelAge`, theme tokens,
Back overrides (software + hardware), `npx expo install` with no `app.config.ts` plugin entry. No
hallucinated symbols survived except A2 below (a private symbol the plan tried to reuse).

### Consolidated actionable findings (to incorporate in the replan)

- **A1 (MEDIUM) — Loading / missing-contact / SMS-probe state machine.** *(codex + claude)*
  09-02 Task 1 conflates "data still loading / contact missing" with "no phone," and "SMS probe pending"
  with "SMS unavailable." Require an explicit screen state (`loading | ready | missing | error`); hold
  `smsAvailable: boolean | null` initialized to `null` and render **neither** Send nor the
  SMS-unavailable helper while it is `null` (Copy stays primary); a `getContactHeader` returning `null`
  (stale/deleted contact) exits to Home rather than rendering "no phone"; a **rejected**
  `isAvailableAsync()` probe is treated as `false` without failing the contact/fuel load; normalize
  `header.phone?.trim() || null` before both gating and `sendSMSAsync`.

- **A2 (MEDIUM) — `KIND_OPTIONS` is module-private; Avatar props underspecified.** *(codex)*
  `KIND_OPTIONS` is not exported (`src/components/FuelEditor.tsx:72`), so 09-02 Task 1 cannot reuse it as
  written. Either export a shared pure fuel-kind→label helper or define an exhaustive compose-local
  mapping. Also `Avatar` requires `photo` and `name` in addition to the props the plan lists
  (`src/components/Avatar.tsx:32`) — require `photo={header.photo}` and `name={header.name}`.

- **A3 (MEDIUM) — Send needs an in-flight guard.** *(codex)*
  09-02 has no latch on Send; rapid taps can launch multiple SMS-composer handoffs. Mirror the existing
  profile-action latch (`src/screens/ContactProfileScreen.tsx:145,211`): a `sending` guard + disabled
  state (token-based disabled styling) + accessibility state + `finally` reset; Copy stays available
  throughout.

- **A4 (LOW) — Machine-check the `listFuelForEditor` prohibition.** *(claude)*
  The off_limits never-transmitted guarantee relies on "don't use the editor read," but unlike the
  `Linking`/`recency-dao` prohibitions it has no automated absence check. Add an `<acceptance_criteria>`
  asserting `ComposeScreen.tsx` contains zero `listFuelForEditor` references, matching the existing
  negative-grep style.

- **A5 (LOW) — Zero-match verify commands are not automation-safe.** *(codex)*
  `grep -c 'pattern' file` prints `0` but **exits 1** when there are no matches, so the mandated absence
  checks in 09-01 and 09-02 can fail a command runner despite passing semantically. Replace each with
  `test "$(grep -Ec 'pattern' file || true)" -eq 0`.

### Informational (no plan change; doc hygiene — being fixed this cycle)

- `09-UI-SPEC.md` line ~125 ("a new full-fuel-minus-off_limits projection is acceptable") and line ~205
  ("registered in `app.config.ts`") contradict the approved plans, which correctly **reuse
  `getRankedFuel`** and add **no plugin entry**. The plans override the spec on the safer side. The
  stale UI-SPEC text is corrected in this cycle so a downstream reviewer/executor isn't tripped.

---

### Raw reviewer output — codex

```
## HIGH
None. All cited existing symbols/files were found; no source-hallucination HIGHs.

## MEDIUM
- 09-02-PLAN.md:120-140 conflates loading/missing data with "no phone," and pending SMS capability with
  "SMS unavailable." getContactHeader legitimately returns null (contact-read.ts:65-102); phone != null
  therefore renders Copy/Add-number for a stale/nonexistent contact. Initial smsAvailable=false also
  briefly shows the "can't send texts" state before probing. Require loading|ready|missing|error,
  smsAvailable: boolean|null, missing-contact exit to Home, treat a rejected probe as false without
  failing load, normalize header.phone?.trim() || null before gating and sendSMSAsync.
- 09-02-PLAN.md:130 cannot reuse KIND_OPTIONS (module-private, FuelEditor.tsx:72-85); Avatar also
  requires photo and name (Avatar.tsx:32-43). Introduce/export a shared fuel-kind label helper or an
  exhaustive compose-local mapping; require photo/name.
- 09-02-PLAN.md:146-150 has no in-flight guard for Send. Rapid taps can launch multiple SMS handoffs;
  the profile action uses a latch (ContactProfileScreen.tsx:145,211). Require a sending guard,
  disabled/accessibility state, token disabled styling, finally reset; preserve Copy.

## LOW
- Zero-match verify commands not automation-safe: grep -c prints 0 but exits 1 on no matches; replace
  with test "$(grep -Ec 'pattern' file || true)" -eq 0.

CODEX_SUMMARY: high=0 actionable_nonhigh=4
```

### Raw reviewer output — claude (read-only subagent)

```
CLAUDE_SUMMARY: high=0 actionable_nonhigh=2

## HIGH concerns
None.

## Actionable non-HIGH concerns
- smsAvailable initial state unspecified — wrong-state flash on the happy path (MEDIUM). Hold
  smsAvailable as boolean|null, init null, render neither Send nor the SMS-unavailable helper while
  null (Copy still primary); only call resolveComposeControls once a concrete boolean is known.
- No automated negative grep guarding the listFuelForEditor prohibition (LOW). Add
  grep-based acceptance asserting ComposeScreen.tsx has zero listFuelForEditor refs.

(Informational: UI-SPEC line 125 "new projection acceptable" and line 205 "registered in
app.config.ts" contradict the plans, which correctly reuse getRankedFuel and add no plugin entry. Plans
override the spec on the safer side.)
```

---

## Cycle 2 (re-review of the revised plans)

**Combined verdict:** 0 HIGH · 3 actionable (all from codex; the Claude re-review returned 0/0).
- codex `CYCLE_SUMMARY: high=0 actionable_nonhigh=3`
- claude `CLAUDE_SUMMARY: high=0 actionable_nonhigh=0`

Both confirmed A2–A5 fully resolved and every newly-cited symbol verified against source. Codex found
A1 only PARTIALLY resolved plus two new issues (Claude missed these; codex is correct):

- **B1 (MEDIUM) — A1 focus-refresh does not reset the state machine.** `smsAvailable` inits `null` but is
  never reset (nor `screenState` to `"loading"`) on each `useFocusEffect` run — returning from Edit after
  adding a phone can render the prior SMS result/helper while the new probe is pending (the flash A1
  forbids). Require `setScreenState("loading")` + `setSmsAvailable(null)` at each focus-load start, plus an
  active/request (cancelled-flag) guard in cleanup so a stale load/probe cannot overwrite the latest
  focused state.
- **B2 (MEDIUM) — `goHome` written as a void value, not a callback.** 09-02 `<action>` says
  `goHome = navigation.reset(...)`; `reset` returns `void`, so as written it resets during render and
  cannot bind to `onPress`/BackHandler. Require the callback form (PATTERNS.md:90):
  `const goHome = useCallback(() => navigation.reset({ index:0, routes:[{ name:'Home' }] }), [navigation])`.
- **B3 (LOW) — label single-source claim vs FuelEditor drift.** `fuel-kind-label.ts` is described as the
  single label source, but `FuelEditor.tsx:72` keeps its own five literal labels + local `kindLabel`.
  Narrow the helper's claim to **compose-local** (preferred — avoid scope creep into a shipped component),
  or add FuelEditor to the plan to derive from `fuelKindLabel`.

---

## Cycle 3 (final re-review — `--max-cycles 3` reached)

**Combined verdict:** 0 HIGH · 3 residual actionable (2 MEDIUM + 1 LOW/taste). Both reviewers confirmed
B1–B3 genuinely resolved and every newly-cited symbol verified against source. Trajectory across the
loop: **5 → 3 → 3 actionable, 0 HIGH in every cycle** — converged in severity; the tail is
diminishing-returns refinement. The automated loop ends here at the configured `--max-cycles 3`; the
residuals below are escalated to the owner at the pre-execution pause.
- codex `CYCLE_SUMMARY: high=0 actionable_nonhigh=2`
- claude `CLAUDE_SUMMARY: high=0 actionable_nonhigh=1`

**Residual items** (owner decides at the pause: apply before executing, or let the executor handle):

- **C1 (MEDIUM, codex) — `phone` nullable at the `sendSMSAsync` call site.** 09-02 normalizes
  `phone: string | null` then calls `sendSMSAsync(phone, draft)`; rendering Send off a separate
  `controls` value does not narrow `phone` for TypeScript. Add `if (phone === null) return;` at the top of
  the Send handler (before `setSending(true)`), or pass a proven string in. **`npx tsc --noEmit` is
  already a task `<verify>`, so this cannot silently ship wrong — the executor is forced to resolve it;
  it's a spec-completeness gap, not a latent runtime bug.**
- **C2 (MEDIUM, codex) — B1's re-focus UAT scenario is fictional.** The plan's human-check cites
  "Add phone → Edit → save → back on Compose," but `EditContactScreen.tsx:367` saves via
  `navigate("Profile", …)`, so Compose is not re-focused by that path. The focus-reset itself is CORRECT
  defensive code (Compose is entry-agnostic and re-entered by Android hardware-back and, later,
  notification/widget/AI in Phases 11/12/14) — only the cited UAT path is wrong. Re-word the human-check
  to a real re-focus path, or frame the reset as defensive-for-reuse.
- **C3 (LOW / taste, claude) — B1 resets the whole surface to `loading` on every focus.** Resetting
  `screenState → "loading"` (not just `smsAvailable → null`) briefly blanks fuel + draft chrome on every
  re-focus — a fuller blink than the profile's keep-stale-content approach. No data loss (draft is local
  `useState`; component stays mounted). A deliberate, defensible tradeoff; a cheaper variant exists (reset
  `smsAvailable` only, keep loaded content, drop to `loading` only when there is no prior data). Purely
  taste — owner's call.
