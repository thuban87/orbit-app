---
phase: 35-messaging-ai-compose
plan: 03
subsystem: logic
tags: [compose, text-email-mode, mailto, sms-handoff, contact-methods, dao, pure-logic]

# Dependency graph
requires:
  - phase: 35-messaging-ai-compose
    provides: "35-01 performReachOut return contract { handoffStarted, assistUid }; 35-02 migration 028 default_message_mode/remembered_message_mode + DefaultMessageMode/RememberedMessageMode types + assertMessageMode"
  - phase: 21-interaction-assist-reach-out
    provides: "performReachOut handoff, createPendingAssist/markAssistFailed lifecycle"
  - phase: 18.1-contact-data-normalization
    provides: "contact_methods normalization, selectActionablePrimaryMethods, the statement-immediate partial-unique primary index (migration 009)"
provides:
  - "resolveComposeControls(hasPhone, smsAvailable, mode='text', hasEmail=false): mode-aware Send/Copy gate; probe-pending scoped to Text, Email transmittable while SMS unknown; 2-arg call byte-preserved (H1)"
  - "resolveUsableMode(mode, hasPhone, hasEmail): preferred-then-fallback destination resolution (null = no usable mode)"
  - "effectiveMode(default, remembered) resolves the 'remember' sentinel; nextRememberedMode(current, adHoc, committed) advances only on a commit"
  - "resolveCopyTargets(mode, body, subject): body-only main Copy + subject-only affordance (Email mode only)"
  - "performReachOut email arm carries encoded mailto Subject + Body; return contract { handoffStarted, assistUid } preserved"
  - "setContactMethodPrimary(exec, {contactId, methodId, methodType, now}): transaction-safe single-method primary writer (pre-read/validate -> clear -> promote)"
affects: [35-07 ComposeScreen integration, 35-09]

# Actuals (#2632)
actuals:
  tokens: 6400    # chars/4 over the realized diff (25510 chars across the 6 source+test files)
  tasks: 4
  commits: 7      # 6 task commits (RED/GREEN split on tasks 1 + 4) + this docs commit

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mode-aware pure gate: resolveComposeControls keeps its 4-field ComposeControls shape and adds OPTIONAL trailing params so the wave-1 2-arg call is byte-identical (H1); the no-phone row is subsumed by the usable===null branch"
    - "Preferred-then-fallback destination resolution is a separate pure helper (resolveUsableMode) the screen also consumes to pick phone-vs-email + gate the Subject affordance"
    - "No-dependency email handoff: encodeURIComponent'd Subject+Body in a mailto query string via Linking.openURL (no native mail-composer package)"
    - "Single-method primary swap reuses the diff core's clear-before-promote discipline (statement-immediate partial-unique index) in one inWriteTransaction, with an exactly-one-row assert on the promote"

key-files:
  created: []
  modified:
    - src/logic/compose-logic.ts
    - src/logic/compose-logic.test.ts
    - src/services/reach-out/handoff.ts
    - src/services/reach-out/handoff.test.ts
    - src/db/contact-methods-dao.ts
    - src/db/contact-methods-dao.test.ts

key-decisions:
  - "ComposeControls keeps its EXISTING 4 fields; mode-awareness is expressed through those fields + the separate resolveUsableMode helper, so every wave-1 2-arg test stays green byte-for-byte (H1) without editing them and no new required field breaks the stale ComposeScreen call."
  - "Email body reuses the existing messageBody input (the composed message IS the email body); only subject was added to ReachOutInput — avoids a redundant second body field. Empty subject/body params are omitted from the mailto query."
  - "setContactMethodPrimary owns its own inWriteTransaction (standalone picker action, never nested) and reuses assertOneChange + bumpDataRevisionCore rather than a bespoke revision UPDATE; the diff writers are left byte-unchanged."

patterns-established:
  - "A pure compose-mode logic layer (resolve/effective/next/copy-targets) is fully node-tested off-device before the ComposeScreen integration (35-07) consumes it — WR-02, capability never re-derived in the screen."

requirements-completed: []  # COMP-02/03/04 substrate delivered; user-facing capability lands in 35-07 (see below)

coverage:
  - id: D1
    description: "resolveComposeControls: Text/Email mode, preferred-then-fallback, no-destination usable state; probe-pending gates Text only; Email transmittable while SMS unknown; 2-arg call equals ('text', false)"
    requirement: "COMP-03"
    verification:
      - kind: unit
        ref: "src/logic/compose-logic.test.ts#resolveComposeControls — Text/Email mode (COMP-03, HIGH-2); resolveUsableMode — preferred-then-fallback"
        status: pass
    human_judgment: false
  - id: D2
    description: "effectiveMode resolves the 'remember' sentinel; nextRememberedMode advances the remembered mode only on a Transmit/Copy commit"
    requirement: "COMP-02"
    verification:
      - kind: unit
        ref: "src/logic/compose-logic.test.ts#effectiveMode; #nextRememberedMode"
        status: pass
    human_judgment: false
  - id: D3
    description: "Email handoff carries encodeURIComponent'd Subject + Body via a mailto query string; assist created before handoff; markAssistFailed on catch; { handoffStarted, assistUid } preserved; no dependency added"
    requirement: "COMP-04"
    verification:
      - kind: unit
        ref: "src/services/reach-out/handoff.test.ts#performReachOut (email arm carries the encoded subject + body ...)"
        status: pass
    human_judgment: false
  - id: D4
    description: "resolveCopyTargets: main Copy targets the Body in any mode; the Subject copy target is offered in Email mode only (null in Text)"
    requirement: "COMP-04"
    verification:
      - kind: unit
        ref: "src/logic/compose-logic.test.ts#resolveCopyTargets — body-only vs subject-only Copy targets (COMP-04)"
        status: pass
    human_judgment: false
  - id: D5
    description: "setContactMethodPrimary: clear-before-promote swap with no UNIQUE violation; foreign id and type-mismatch rejected in the pre-read (no write, both primaries intact); exactly-one-row promote; data_revision bumps on a real swap, no-op when already primary"
    requirement: "COMP-03"
    verification:
      - kind: unit
        ref: "src/db/contact-methods-dao.test.ts#setContactMethodPrimary (HIGH-7 / A3 single-method primary writer)"
        status: pass
    human_judgment: false

# Metrics
duration: ~11min
completed: 2026-09-13
status: complete
---

# Phase 35 Plan 03: Text/Email Delivery Logic Summary

**Pure, off-device Text/Email delivery layer: `resolveComposeControls` becomes mode-aware (probe-pending scoped to Text, Email transmittable while SMS availability is unknown, preferred-then-fallback destination resolution, no-destination degraded-but-usable), the `handoff.ts` email arm carries an encoded `mailto` Subject+Body with the plan-35-01 `{ handoffStarted, assistUid }` contract intact, and a transaction-safe single-method `setContactMethodPrimary` writer lands for the Compose establish-missing-primary picker — all node-tested, no new dependency, no screen touched.**

## Performance
- **Duration:** ~11 min
- **Started:** 2026-09-13T16:06:05Z
- **Completed:** 2026-09-13T16:16:38Z
- **Tasks:** 4 (Tasks 1 + 4 split RED→GREEN)
- **Files modified:** 6 (3 source, 3 test)

## Accomplishments
- **`resolveComposeControls` is now mode-aware** with two OPTIONAL trailing params (`mode='text'`, `hasEmail=false`) appended after `(hasPhone, smsAvailable)`. The wave-1 two-argument call is byte-preserved (H1): `resolveComposeControls(a, b)` returns the same object as `resolveComposeControls(a, b, 'text', false)` for every `(hasPhone, smsAvailable)` row, and the 4-field `ComposeControls` shape is unchanged so every existing 2-arg test stays green without edits. The no-phone row is subsumed by a `usable===null` (no destination in either mode) branch.
  - **HIGH-2 honored:** the `smsAvailable` probe — including the `=== null` probe-pending no-flash branch — gates **Text only**. In Email mode with an actionable primary email, Transmit stays available whether `smsAvailable` is `true`, `false`, or `null`; Email has no probe-pending state and never shows the SMS-unavailable helper.
- **`resolveUsableMode(mode, hasPhone, hasEmail)`** resolves the preferred mode, falls back to the alternate when the preferred has no destination, and returns `null` when neither exists — the screen consumes this to pick the phone-vs-email destination and to gate the Subject affordance.
- **`effectiveMode` / `nextRememberedMode`:** the `'remember'` sentinel resolves to the concrete remembered mode; the remembered mode advances **only** on a Transmit/Copy commit (`committed === true`), never on an ad-hoc in-session switch. Equality is over the fixed lowercase `{text, email}` token set (types imported from the 35-02 DAO, never redefined).
- **Email handoff carries Subject + Body:** `performReachOut`'s email arm builds `mailto:<endpoint>?subject=..&body=..` with `encodeURIComponent` on both (T-35-04 — `&`, `#`, newlines cannot break out or inject params); empty params are omitted; the Text (`SMS.sendSMSAsync`) and call (`tel:`) arms are byte-unchanged; the assist row is still created before the handoff and `markAssistFailed` runs on catch; the plan-35-01 `{ handoffStarted, assistUid }` return contract is preserved on the email arm. **No dependency added** — no-dependency Linking path only.
- **`resolveCopyTargets`:** the main Copy target is always the Body (any mode); the separate Subject copy affordance targets the Subject in Email mode only (`null` in Text).
- **`setContactMethodPrimary(exec, {contactId, methodId, methodType, now})`:** a purpose-built, transaction-safe single-method primary writer for the Compose establish-missing-primary picker. ONE `inWriteTransaction`, deterministic order **PRE-READ/VALIDATE → CLEAR → PROMOTE** (A3): the pre-read by `id AND contact_id AND method_type` rejects a foreign id, unknown id, or a `methodType` that disagrees with the row's stored type **before any write** (no orphaned primary); clear-before-promote respects the statement-immediate partial-unique index (009:235); the promote asserts exactly one row changed; `data_revision` bumps once on a real swap and not at all on an already-primary no-op. The diff writers (`applyContactMethodDiff`/`Core`) are byte-unchanged (72 insertions, 0 deletions).

## Task Commits
1. **Task 1 (RED): mode-aware compose-logic tests** — `e4fb51b` (test)
1. **Task 1 (GREEN): mode-aware resolveComposeControls + mode helpers** — `c1fe655` (feat)
2. **Task 2: email handoff encoded Subject + Body** — `252083f` (feat)
3. **Task 3: body-only vs subject-only Copy targets** — `0ed60a5` (feat)
4. **Task 4 (RED): setContactMethodPrimary tests** — `c26f152` (test)
4. **Task 4 (GREEN): setContactMethodPrimary writer** — `c7e469a` (feat)

**Plan metadata:** committed with STATE/ROADMAP update (docs: complete plan).

## Files Created/Modified
- `src/logic/compose-logic.ts` — mode-aware `resolveComposeControls`; `resolveUsableMode`; `effectiveMode`; `nextRememberedMode`; `resolveCopyTargets` (types-only import from app-settings-dao).
- `src/logic/compose-logic.test.ts` — mode matrix, fallback, no-destination, probe-pending-Text-only, Email-transmittable-while-SMS-unknown, H1 backward-compat loop, mode/copy-target selectors.
- `src/services/reach-out/handoff.ts` — `subject` input + `buildMailtoUrl`; email arm split from the tel arm; contract preserved.
- `src/services/reach-out/handoff.test.ts` — encoded subject+body assertion, empty-param omission, subject-only, order (create before launch).
- `src/db/contact-methods-dao.ts` — new `setContactMethodPrimary` writer (additive only).
- `src/db/contact-methods-dao.test.ts` — swap/other-type/foreign-id/type-mismatch/data_revision/no-op coverage.

## Decisions Made
- **Kept `ComposeControls` at its existing 4 fields.** The mode-aware behavior is carried through those fields plus the separate `resolveUsableMode` helper, so the wave-1 2-arg tests stay green byte-for-byte and the stale `ComposeScreen.tsx` 2-arg call keeps compiling — the concrete proof H1 is closed (project-wide `tsc --noEmit` exit 0 with the screen untouched).
- **Email body reuses `messageBody`.** The composed message IS the email body; only `subject` was added to `ReachOutInput`, avoiding a redundant second body field.
- **`setContactMethodPrimary` reuses `assertOneChange` + `bumpDataRevisionCore`** and owns a single `inWriteTransaction` — no bespoke revision UPDATE, no nesting, diff writers untouched.

## Deviations from Plan
None — plan executed exactly as written. Rules 1–4 not triggered; no CLAUDE.md conflicts (no worktree/branch/push, no network on a read path, no migration, `formatLocalDate` not needed — no date formatting in scope).

## Requirements (COMP-02 / COMP-03 / COMP-04)
Left **unchecked** in REQUIREMENTS.md. This plan delivers the pure delivery-logic **substrate** (mode gate, destination resolution, remembered-mode advancement, encoded email handoff, single-method primary writer), but each requirement's wording is **user-facing** ("User can compose in Text or Email mode … with an ad-hoc per-session switch"; "Compose falls back … stays usable for drafting/Copy"; "Email mode exposes Subject + Body"). The user-facing capability is wired in **35-07 (ComposeScreen integration, wave 3)** — the 4-arg `resolveComposeControls` call, the mode switch, Subject field, and picker consumption. This mirrors 35-02's deliberate treatment of COMP-02 (durable half shipped, requirement left unchecked). The verification coverage above maps each delivered artifact to its requirement so 35-07 can close them.

## Known Stubs
None. All new symbols are fully implemented and node-tested. The screen-side consumption is a deliberate, sequenced gap (35-07), not a stub.

## Threat Surface
No new surface beyond the plan's `<threat_model>`. T-35-04 (mailto injection) is mitigated by `encodeURIComponent` on subject+body; T-35-17 (setContactMethodPrimary tampering) is mitigated by the single transaction, method-id-to-contact+type guard, clear-before-promote, exactly-one-row assert, and the `data_revision` bump; T-35-SC (package installs) held — no dependency added.

## Issues Encountered
None new. (Two pre-existing failures unrelated to this plan were already logged by 35-02 to `deferred-items.md` + the WINDOWS ledger; not re-touched here — out of scope.)

## User Setup Required
None.

## Next Phase Readiness
- **35-07 (wave 3)** rewires `ComposeScreen` to the full 4-arg `resolveComposeControls`, consumes `resolveUsableMode` for destination + Subject gating, calls `effectiveMode`/`nextRememberedMode` against the migration-028 preference, renders the two Copy affordances via `resolveCopyTargets`, and drives the establish-missing-primary picker through `setContactMethodPrimary`. It should close COMP-02/03/04.
- **Device backstop (phase-gate UAT, not this plan):** on the Pixel — Email-mode Transmit opens the mail composer with Subject+Body prefilled; the establish-primary picker swaps the primary; no-destination Compose still drafts + copies.

## Self-Check: PASSED
- Files verified present on disk: `src/logic/compose-logic.ts`, `src/services/reach-out/handoff.ts`, `src/db/contact-methods-dao.ts` (+ the three test files).
- Commits verified in `git log`: `e4fb51b`, `c1fe655`, `252083f`, `0ed60a5`, `c26f152`, `c7e469a`.
- Gates: three plan suites green (51 tests), consumer suites green (contact-profile-logic / interaction-assist-read / contact-methods-read, 20 tests), `npx tsc --noEmit` exit 0 project-wide with ComposeScreen untouched (H1), `npm run check:colors` exit 0.

---
*Phase: 35-messaging-ai-compose*
*Completed: 2026-09-13*
