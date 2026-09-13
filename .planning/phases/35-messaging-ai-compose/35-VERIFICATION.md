---
phase: 35-messaging-ai-compose
verified: 2026-09-13T18:23:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "In Text and Email mode, tap Transmit on the Pixel; confirm the OS SMS composer / email composer opens pre-filled with recipient (and Subject+Body for email), and Orbit never claims it sent the message."
    expected: "External composer opens with the right destination and body; returning shows the compact 'Did you send it?' panel; 'Yes, log interaction' logs a Message interaction, 'Not yet' preserves the draft."
    why_human: "OS intent handoff crosses the app boundary (expo-sms / mailto Linking) — cannot be exercised in the JSDOM/node test env. COMP-04/05, VALIDATION.md manual-only item."
  - test: "Launch Compose from a Profile, complete a Transmit-confirmed log, then press Back. Repeat launching from Dashboard/deep-link."
    expected: "Return lands toward the launch origin; Back does not resurrect the finished draft (the completed Compose route is gone from history); non-finished exits (Back, Not yet, Copy) preserve the in-memory session."
    why_human: "Real-navigator Back-stack behaviour is device-observable; the pure disposition mapping is unit-tested but the actual React Navigation stack pop/reset is not. COMP-14, VALIDATION.md manual-only item."
  - test: "Type a draft, add a Message Focus item, background the app (Home button) and foreground it; then fully kill and relaunch the app."
    expected: "Draft body, subject, mode, destination, and Message Focus survive backgrounding/foregrounding; after a full relaunch the draft is gone (session-only, no durable draft)."
    why_human: "JS-context teardown on real backgrounding vs relaunch is device-observable; the store logic is unit-tested but OS process lifecycle is not reproducible in node. COMP-07, VALIDATION.md."
---

# Phase 35: Messaging & AI Compose Verification Report

**Phase Goal:** Reaching out is a drafting workspace the user owns — a blank composition editor in Text or Email mode, a read-only knowledge Research side, honest external handoff, and an optional three-suggestion AI review that never writes without consent.
**Verified:** 2026-09-13T18:23:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

Every Success Criterion's code substrate was read on disk (not from SUMMARY claims), traced to real data sources, and exercised by passing unit tests. The only items routed to human verification are three device-observable behaviours (OS handoff across the app boundary, real-navigator Back-stack, OS backgrounding/relaunch) that JSDOM cannot exercise — the phase's planned Pixel UAT backstops (35-VALIDATION.md). These are NOT gaps: the code substrate is present, wired, data-flowing, and behaviourally unit-tested.

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Compose opens on a blank editor (no greeting/AI/prompt), Text or Email from Settings default with ad-hoc per-session switch that updates remembered mode only on Transmit/Copy; Text→primary phone, Email→primary email (+Subject +Subject-copy); falls back to usable mode, stays usable for Copy with no destination (COMP-01/02/03/04) | ✓ VERIFIED | `BLANK_DRAFT.body=''`; `begin()` never called from mount effect (ComposeScreen.tsx:704-711); `effectiveMode`/`nextRememberedMode`/`resolveUsableMode`/`resolveCopyTargets` (compose-logic.ts:173-236); no-destination `usable===null` keeps Copy primary (compose-logic.ts:101-108). 21 compose-logic tests + 20 app-settings-dao tests pass. UI render is a UAT backstop. |
| 2 | Transmit hands off and never claims delivery; return shows compact "Did you send it?" where only "Yes, log interaction" writes the Message interaction, "Not yet" preserves session, Copy never triggers it; app-global banner+sheet coexist; interaction stamped at handoff_at (COMP-05/06) | ✓ VERIFIED | `performReachOut` returns `{handoffStarted, assistUid}`, catch→`markAssistFailed`+`handoffStarted:false` (handoff.ts:101-141), never asserts delivery (doc + no send-claim); panel gated on `handoffStarted && assistUid` (ComposeScreen.tsx:768+); `markAssistLogged(..., now: localDateTime)` at handoff_at. handoff.test + integration tests pass. OS handoff = UAT backstop. |
| 3 | Session state (body/subject/mode/destination/Message Focus) survives in-app nav + ordinary backgrounding but is not a durable draft (no drafts table, no backup contract) (COMP-07) | ✓ VERIFIED | `compose-session-store.ts` is a plain in-memory Zustand singleton; imports no expo-sqlite/AsyncStorage/DAO; `startSession` no-op on same contact preserves draft; `clearSession` only on confirm. compose-session-store tests pass. Backgrounding vs relaunch = UAT backstop. |
| 4 | Things to Remember Research opens as a sibling full-screen read-only projection of populated conversation-relevant knowledge (incl Key People), no add/edit; ≤3 AI-authorized items markable as session-only Message Focus (never granting permission); Off Limits in a distinct Avoid presentation, never Message Focus and NEVER sent to AI in any form (D-14/ADR-107) (COMP-08/10/11) | ✓ VERIFIED | `compose-research-read.ts` normalized read: Off Limits always `aiEligible:false, isOffLimits:true`, operational metadata excluded; ResearchScreen read-only (only goBack + addToFocus); store `addToFocus` rejects `!aiEligible`/`isOffLimits`, cap 3; egress boundary `ai-context-read.ts` closed PromptContext + `RANKED_FUEL` excludes `off_limits` IN-QUERY (fuel-read.ts:133). ai-context-read + research tests pass. |
| 5 | One adaptive AI action (Draft/Rewrite) returns three unlabeled varied suggestions on a non-destructive surface; editor changes only on "Choose this", Try Again replaces the set; cancellable + failure-safe with manual draft preserved; three AI states honored without silently hiding AI; manual+Research work in every state; deep-link-ready + origin-aware, no finished draft in Back (COMP-09/12/13/14) | ✓ VERIFIED | `ai-suggestion-logic.ts` review state carries exactly three suggestions, ack gate removed (D-09/ADR-079:59-61), editor untouched until `chooseSuggestion`; `ai-generate-variants.ts count=3`; `ai-availability.ts` off/ready/needs-attention (repair notice, never hidden); `onAiChoose` is the ONLY editor mutation (ComposeScreen.tsx:726-730); `composeExitDisposition` origin-aware + finished-route removal; ComposeOrigin incl 'deep-link'. ai-suggestion + availability + variants + integration tests pass. Back-stack = UAT backstop. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/screens/ComposeScreen.tsx` | Editor-first Compose w/ Text/Email, Subject, AI review, three states, origin-aware return | ✓ VERIFIED | 1490 lines; registered in DashboardStack + OrreryStack |
| `src/screens/ComposeResearchScreen.tsx` | Read-only Research projection + Avoid + Add-to-AI toggle | ✓ VERIFIED | 275 lines; no add/edit/delete; registered in both stacks |
| `src/logic/compose-logic.ts` | Pure Text/Email + no-destination + remembered-on-commit + exit disposition | ✓ VERIFIED | 311 lines; 21 tests pass |
| `src/logic/ai-suggestion-logic.ts` | Three-suggestion lifecycle, ack gate dropped | ✓ VERIFIED | review carries 3 strings; non-destructive |
| `src/logic/ai-availability.ts` | off/ready/needs-attention adapter (D-12) | ✓ VERIFIED | never silently hides AI |
| `src/logic/ai-generate-variants.ts` | Three-call varied fan-out | ✓ VERIFIED | count=3 default |
| `src/db/app-settings-dao.ts` | compose-mode accessors + sentinel guards | ✓ VERIFIED | `assertRememberedMessageMode` rejects 'remember' at write (1231) |
| `src/db/ai-context-read.ts` | Closed PromptContext egress, Off Limits excluded | ✓ VERIFIED | off_limits excluded in SQL; comment L331 confirms D-14 |
| `src/db/compose-research-read.ts` | Normalized read boundary w/ aiEligible/isOffLimits | ✓ VERIFIED | 242 lines; Off Limits structural, not UI filter |
| `src/services/reach-out/handoff.ts` | performReachOut outcome + mailto encoding | ✓ VERIFIED | WR-01 recipient injection neutralized (5f03cb4) |
| `src/stores/compose-session-store.ts` | Session-only draft + Message Focus | ✓ VERIFIED | no persistence import; off-limits rejected |
| `src/db/migrations/028-compose-message-mode.ts` | Forward-only additive app_settings columns | ✓ VERIFIED | head+1 (27→28), app_settings-only, CHECK on default only |
| `src/backup/backup-schema.ts` | Declare-only allowlist + sentinel guard | ✓ VERIFIED | `assertRememberedMessageMode` at backup boundary (285) |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| ComposeScreen Transmit | performReachOut → createPendingAssist → OS composer | outcome `{handoffStarted,assistUid}` | ✓ WIRED |
| "Did you send it?" Yes | markAssistLogged | `{assistUid, connected:1, now:localDateTime}` @ handoff_at | ✓ WIRED |
| ResearchScreen Add-to-AI | compose-session-store addToFocus | validated ResearchItem, off-limits rejected | ✓ WIRED |
| ComposeScreen AI action | ai-suggestion-logic lifecycle → generateVariants | begin/chooseSuggestion/retry/cancel | ✓ WIRED |
| ComposeScreen | ai-availability computeAiAvailability | provider + credential → off/ready/needs-attention | ✓ WIRED |
| ComposeScreen exit | composeExitDisposition → clearSession/returnToOrigin | per-path disposition | ✓ WIRED |
| DashboardStack/OrreryStack | ComposeScreen + ComposeResearchRoute | Stack.Screen registration | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| ComposeResearchScreen | research items | `readComposeResearch` composing 6 real read modules | Yes | ✓ FLOWING |
| ai-context-read | PromptContext | real contacts/fuel/memories/fields SQL reads | Yes (off_limits excluded) | ✓ FLOWING |
| ComposeScreen | resolved controls | `resolveComposeControls` over live method-DAO destinations | Yes | ✓ FLOWING |
| app-settings-dao | default/remembered mode | migration-028 app_settings columns | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase pure-logic + store + migration suites | `vitest run` (8 files) | 114 passed | ✓ PASS |
| Egress + integration + DAO + backup suites | `vitest run` (4 files) | 167 passed | ✓ PASS |
| Type gate (memory: vitest ≠ tsc) | `tsc --noEmit` | exit 0 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| COMP-01 | 35-01 | ✓ SATISFIED | Blank editor, no auto-insert |
| COMP-02 | 35-02/03/07 | ✓ SATISFIED | migration 028 + effectiveMode/nextRememberedMode |
| COMP-03 | 35-03/07 | ✓ SATISFIED | resolveUsableMode primary+fallback |
| COMP-04 | 35-03/07 | ✓ SATISFIED | Subject + resolveCopyTargets; mailto Subject+Body |
| COMP-05 | 35-01 | ✓ SATISFIED | performReachOut outcome, panel, never-claims-delivery |
| COMP-06 | 35-01 | ✓ SATISFIED | additive panel, banner/sheet coexist, handoff_at stamp |
| COMP-07 | 35-01 | ✓ SATISFIED | session store, no durable draft |
| COMP-08 | 35-06/09 | ✓ SATISFIED | read-only Research projection |
| COMP-09 | 35-04/08 | ✓ SATISFIED | three-state availability, never hidden |
| COMP-10 | 35-05/09 | ✓ SATISFIED | Off Limits never egressed (SQL + closed context + store guard) |
| COMP-11 | 35-06/09 | ✓ SATISFIED | ≤3 session-only Message Focus, no permission grant |
| COMP-12 | 35-04/08 | ✓ SATISFIED | adaptive Draft/Rewrite, 3 suggestions, Choose this gate |
| COMP-13 | 35-04/08 | ✓ SATISFIED | cancellable, failure-safe, draft preserved |
| COMP-14 | 35-09 | ✓ SATISFIED | deep-link + origin-aware exit disposition |

All 14 declared requirement IDs are claimed by a plan and satisfied. No orphaned requirements (REQUIREMENTS.md maps only COMP-01…14 to Phase 35).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| ComposeScreen.tsx | 999/1035 | `placeholder=` | ℹ️ Info | Legit RN TextInput placeholder props (blank-editor "Write your message…"), not stubs — COMP-01 correct |

No `TBD`/`FIXME`/`XXX` debt markers, no unwired stubs, no hardcoded-empty render props in any phase-modified source file.

### Project-Invariant Checks (CLAUDE.md)

- **Local-first / egress:** ✓ Off Limits excluded structurally at the read boundary (`RANKED_FUEL` `kind != 'off_limits'` IN-QUERY, not a UI filter); closed `PromptContext` carries no off-limits/Message-Focus field; Message Focus is session-only in-memory and never reaches ai-context-read. No network dependency on any read path.
- **Migration 028:** ✓ Forward-only, additive, app_settings-only, head+1 (27→28), does not edit a shipped migration; declare-only backup portability (no format bump — Phase 36 owns emission).
- **Sentinel invariant:** ✓ `remembered_message_mode` 'remember'-sentinel rejected by `assertRememberedMessageMode` at BOTH the DAO write (app-settings-dao.ts:1231) and backup (backup-schema.ts:285) boundaries — CR-01 fix (d0ce965) present on disk.
- **AI consent:** ✓ `chooseSuggestion` is the sole editor mutation from the AI flow; generation never auto-starts on mount; three states honored (needs-attention shows a repair notice, never silent hiding).
- **Date helper:** ✓ ai-context-read + research reads use local-wall-clock parsing; no `toISOString().split` UTC off-by-one.

### Human Verification Required

Three device-observable behaviours (the phase's planned Pixel UAT backstops, 35-VALIDATION.md §Manual-Only) — the code substrate is verified present, wired, and unit-tested; only the on-device confirmation remains:

1. **External handoff (COMP-04/05)** — Transmit in Text and Email; confirm the OS composer opens pre-filled and Orbit never claims delivery; the "Did you send it?" panel logs correctly.
2. **Origin-aware Back-stack (COMP-14)** — complete a confirmed log from Profile/Dashboard/deep-link; confirm return toward origin and that Back cannot resurrect the finished draft.
3. **Session survival (COMP-07)** — confirm the draft + Message Focus survive backgrounding but are gone after a full relaunch.

### Gaps Summary

No gaps. All 5 Success Criteria and all 14 requirements are satisfied in code, traced to real data sources, and covered by 281 passing phase unit tests with a clean `tsc --noEmit`. The Wave-1 regression (51c8eb9) and the code-review blocker + 3 warnings (CR-01 d0ce965, WR-01 5f03cb4, WR-02 3f266f3) are all fixed and verified on disk. The three remaining items are device-UAT confirmations, not implementation gaps.

---

_Verified: 2026-09-13T18:23:00Z_
_Verifier: Claude (gsd-verifier)_
