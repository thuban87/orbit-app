---
phase: 21-interaction-assist-reach-out
verified: 2026-08-31T20:30:00Z
status: passed
score: 6/6 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
requirements_verdict:
  IAS-01: ACHIEVED
  IAS-02: ACHIEVED
  IAS-03: ACHIEVED
  IAS-04: ACHIEVED
gaps: []
deferred: []
human_verification: []
---

# Phase 21: Interaction Assist & Reach Out — Verification Report

**Phase Goal:** Provide a shared low-friction Call/Text/Email Reach Out path and optional durable Interaction Assist that asks users to confirm/log the outcome after native handoff.
**Verified:** 2026-08-31T20:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

Goal-backward verification read the actual code on disk (full files + every writer of the shared tables `interaction_assists`, `interactions`, `contacts`, `app_settings`, `contact_methods`), not the diffs or SUMMARY claims. The owner-signed device UAT (21-UAT.md) is corroborating evidence, not the basis for these verdicts.

## Requirement Verdicts

### IAS-01 — Shared Reach Out router, primary emphasized, ≤3 taps — ACHIEVED

- `src/components/ReachOutRouter.tsx:52-64` — `chooseChannel` launches directly when exactly one actionable endpoint exists (2 taps: "Reach out" → channel), and opens `EndpointSelector` only when ≥2 actionable endpoints exist (3rd tap). Actionability filtered on `is_actionable === 1`.
- `src/components/ReachOutRouter.tsx:66-93` — `primaryChannel` (Call, else Email) rendered with `colors.accent` background vs plain background = primary emphasis at the route level.
- `src/components/EndpointSelector.tsx:31-66` — within an endpoint list the `is_primary === 1` row is accent-filled and tagged "Primary".
- Coarse (not endpoint/provider) history: `src/db/interaction-assist-dao.ts:98-111` writes the interaction with `channel` only; the endpoint is never carried onto the interaction row. Endpoint lives on the assist (`endpoint_value`) and is not projected into `interactions`.

### IAS-02 — Assist written before handoff, failed launch → failed, app-global non-modal banner (15s–24h), Back passes through — ACHIEVED

- Write-before-handoff: `src/services/reach-out/handoff.ts:50-66` — `createPendingAssist` (when `assistEnabled`) runs BEFORE `SMS.sendSMSAsync` / `Linking.openURL`.
- Failed launch: `handoff.ts:67-72` — `catch` calls `markAssistFailed` and shows the per-channel Alert; `markAssistFailed` (`interaction-assist-dao.ts:144-156`) is terminal (`pending`→`failed`) so it can never re-surface.
- Non-modal banner + Back passthrough: `src/components/AssistBanner.tsx:61-99` renders an absolute `View` with `pointerEvents="box-none"` — NOT a `Modal`, so Android Back is untouched (device R06 confirmed Back navigated the underlying stack while the banner persisted).
- Eligibility window: `src/logic/assist-eligibility.ts:1-28` — `ELIGIBLE_AFTER_SECONDS = 15`, `EXPIRE_AFTER_HOURS = 24` (confirmed reverted to 24 on disk; the R14 time-travel edit was temporary and git-reverted, working tree clean).
- Queue cap of 5: `interaction-assist-dao.ts:51-63` — every create expires all but the 5 newest pending rows (device R14 verified the 6th prunes the oldest).
- Toggle default-on + off-clears-queue + no resurrection: migration `014` `interaction_assist_enabled INTEGER NOT NULL DEFAULT 1`; `src/db/app-settings-dao.ts:626-643` `setInteractionAssistEnabled` expires every pending row on disable inside one transaction and never resurrects on re-enable.
- App-global wiring: `App.tsx:323` mounts `<AssistBanner />` app-wide; `App.tsx:166-168` refreshes on foreground and installs `subscribeAppState`; `src/stores/assist-store.ts:36-46` re-queries only on a real background→active return (`inactive`→`active` ignored).
- Launch-sweep expiry: `src/services/interaction-assist-sweep.ts` registered at `App.tsx:184-186` expires pending past 24h and prunes terminal rows after 30 days.

### IAS-03 — Confirmation logs ONE outbound interaction at original handoff time via the sole recency writer — ACHIEVED

- Single interaction at handoff time via authoritative writer: `interaction-assist-dao.ts:73-124` — `markAssistLogged` re-reads the row inside the transaction, calls `insertInteractionCore` with `occurredAt: transactionAssist.handoff_at`, `direction: "outbound"`, `source: "assist"`, then `recomputeLastContactCore`, then flips the assist to `logged`. All atomic.
- Sole `last_contact` writer confirmed by exhaustive grep: the ONLY `UPDATE contacts SET last_contact` in the codebase is `src/db/recency-dao.ts:165-166` (recomputeLastContactCore). No bespoke last_contact write exists in the assist path or anywhere else.
- Connected semantics: `src/components/AssistConfirmation.tsx:22-60` — Yes → `confirm(1)`; the "No answer" button (Call channel only) → `confirm(0)`; Text/Email render no "No answer" (Yes → connected=1 attestation).
- Don't-log writes nothing: `AssistBanner.tsx:53-59` → `markAssistDismissed` (`interaction-assist-dao.ts:129-141`) sets `dismissed` with NO interaction insert (device R10 verified zero interactions, last_contact stayed null).
- Device DB evidence (21-UAT R07–R10, R19): all 7 assist-sourced interactions have `occurred_at === handoff_at`, outbound, source=assist, correct connected; last_contact advanced only via recompute.

### IAS-04 — Merge reparents, purge cascade-deletes, widget Contact deep-link with strict lifecycle guards, openReachOut consumed once — ACHIEVED

- Merge reparent: `src/db/merge-dao.ts:153` includes `interaction_assists` in the reparent loop (contact_id absorbed→survivor).
- Purge cascade: migration `014` `contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE` — deleting the contact cascade-deletes its assists (device R16 verified 0 rows post-purge).
- Widget emits deep-link: `src/services/widget/widget-render.tsx:454-458` — the LARGE tile "Contact" action `clickActionData={{ uri: orbit://reach/${tile.id} }}`; the former Message action is superseded by Contact (label="Contact").
- Strict router allow-list: `src/navigation/widget-linking.ts:105,170-183` — `orbit://reach/<positive-int>` resolves ONLY to Profile with `openReachOut: true`; every other form returns null.
- Lifecycle guards: `widget-linking.ts:244-291` + `src/services/widget/widget-quick-action-guard.ts:37-49` — purged (`missing`) reach intent → Alert "This contact is no longer available." + reset to `[Home]` (Dashboard); archived → guard returns `archived`, the reach branch does NOT fire the alert, `setPending(null)` = silently dropped. (device R17 verified both.)
- openReachOut consumed exactly once: `src/screens/ContactProfileScreen.tsx:319-322` — on focus, if `route.params.openReachOut && hasReachRoute`, opens the router then `navigation.setParams({ openReachOut: undefined })`, so a background→foreground refocus cannot reopen it (device R18 verified no reopen loop).
- Wholly local / no widget-side assist writer: no INSERT into `interaction_assists` exists in any `src/services/widget/*` file (grep of all writers shows only the DAO, sweep, and settings toggle write; the widget path only reads/deep-links).

## Observable Truths (plan must_haves)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Single canonical read path to the Assist toggle (finding #4) | ✓ VERIFIED | No `interaction_assist_enabled` raw column read survives in any screen/component; ContactProfileScreen:269 and ComposeScreen:455 read `settings.interactionAssistEnabled` from `getAppSettings()`. Raw column only in the DAO. |
| 2 | Full node suite + tsc + check:colors green | ✓ VERIFIED | 136 targeted assist/merge/purge/sweep/widget/settings tests pass; `npx tsc --noEmit` exit 0; `npm run check:colors` exit 0. Phase ran full 1,812-test suite green. |
| 3 | IAS-01 router routes Call/Text/Email, primary emphasized, ≤3 taps | ✓ VERIFIED | ReachOutRouter + EndpointSelector code above; device R01/R02. |
| 4 | IAS-02 write-before-handoff, failed→failed, non-modal banner, Back passthrough | ✓ VERIFIED | handoff.ts + AssistBanner code above; device R03/R05/R06. |
| 5 | IAS-03 one outbound interaction at handoff_at via sole recency writer, correct connected | ✓ VERIFIED | markAssistLogged + sole recomputeLastContactCore writer; device R07–R10/R19 DB evidence. |
| 6 | IAS-04 merge reparent / purge cascade / widget deep-link with lifecycle guards / consume-once | ✓ VERIFIED | merge-dao + FK cascade + widget-render + widget-linking guards + ContactProfileScreen setParams; device R15/R16/R17/R18. |

**Score:** 6/6 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| migration 014 | interaction_assists + interaction_assist_enabled | ✓ VERIFIED | Table + FK cascade + 5-pending index + settings column; TARGET_VERSION 14, live on-device (user_version=14). |
| interaction-assist-dao.ts | create/log/dismiss/failed | ✓ VERIFIED | All four transitions substantive + wired through recency cores. |
| assist-eligibility.ts | 15s/24h pure eligibility | ✓ VERIFIED | Constants 15 / 24; local-wall-clock parse (no UTC off-by-one). |
| handoff.ts | write-then-launch, catch→failed | ✓ VERIFIED | Order correct; per-channel Alert copy. |
| assist-store.ts + AssistBanner/Confirmation | app-global non-modal banner | ✓ VERIFIED | Mounted in App.tsx; box-none overlay; notifyWidgetDataChanged in confirm. |
| interaction-assist-sweep.ts | 24h expire + 30d prune | ✓ VERIFIED | Registered as launch-sweep hook. |
| merge-dao / purge (FK) | reparent / cascade | ✓ VERIFIED | Reparent loop includes interaction_assists; FK ON DELETE CASCADE. |
| widget-linking.ts + guard | strict allow-list + lifecycle | ✓ VERIFIED | orbit://reach/<id> only; purged→alert→Dashboard, archived→silent drop. |
| widget-render.tsx | Contact tile emits orbit://reach | ✓ VERIFIED | line 458; Message superseded by Contact. |
| 21-UAT.md | device scoreboard + owner sign-off | ✓ VERIFIED | R01–R10, R14–R20 PASS w/ DB evidence; R11–R13 device-gated owner-accepted; R21 APPROVED. |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| ReachOutRouter | performReachOut | launch() → performReachOut(getExecutor(), …) | ✓ WIRED |
| performReachOut | createPendingAssist (before native) | assistEnabled ? createPendingAssist | ✓ WIRED |
| AssistBanner confirm | markAssistLogged → recomputeLastContactCore | confirm() → markAssistLogged | ✓ WIRED |
| markAssistLogged | interactions @ handoff_at | insertInteractionCore(occurredAt: handoff_at) | ✓ WIRED |
| widget-render Contact | ReachOutRouter | orbit://reach/{id} → resolveWidgetUri → Profile openReachOut | ✓ WIRED |
| ContactProfileScreen focus | consume-once | setReachOutOpen(true) + setParams(openReachOut: undefined) | ✓ WIRED |
| App.tsx | banner + sweep + gate | AssistBanner, subscribeAppState, interactionAssistSweep, WidgetLinkingGate | ✓ WIRED |

### Data-Flow Trace

`contacts.last_contact` — sole source `recomputeLastContactCore` (recency-dao.ts:165). ✓ FLOWING. No static/hollow paths; assist confirmations flow real interaction rows into the recency recompute.

### Anti-Patterns

None blocking. No TBD/FIXME/XXX debt markers in the phase's modified source files. No stubs — every artifact substantive and wired.

### Requirements Coverage

| Requirement | Status | Evidence |
| --- | --- | --- |
| IAS-01 | ✓ SATISFIED | ReachOutRouter/EndpointSelector; coarse channel-only history. |
| IAS-02 | ✓ SATISFIED | handoff write-then-launch + failed; non-modal banner; toggle default-on/off-clears; 5/24h cap. |
| IAS-03 | ✓ SATISFIED | markAssistLogged at handoff_at via sole recency writer; connected semantics; dismiss no-op. |
| IAS-04 | ✓ SATISFIED | merge reparent; purge cascade; widget deep-link + lifecycle guards; consume-once; no widget-side writer. |

### Human Verification Required

None outstanding. This user-facing phase completed its owner-gated device UAT: 21-UAT.md R21 APPROVED (owner, 2026-08-31). Device-only behaviors (native intents, Hermes runtime, RemoteViews deep-link, AppState banner timing, reboot durability) were driven on the physical Pixel with WAL-aware run-as DB evidence. R11–R13 (native-handoff-failure) are device-gated and owner-accepted as covered by the unit-tested `markAssistFailed` + Alert path.

### Gaps Summary

No gaps. All four requirements (IAS-01..04) are backed by substantive, wired code verified on disk; every writer of the shared tables was read and the single-writer `last_contact` invariant holds; the DAO transition suite (136 tests), tsc, and check:colors are green; the device matrix passed with owner sign-off. Minor UAT observation caveats (widget not launcher-placed so R07/R17 verified deep-link-equivalent; one saved-long-name banner screenshot uncaptured with numberOfLines={1} code-guaranteed) were reviewed and accepted by the owner at sign-off and do not affect any code invariant.

---

_Verified: 2026-08-31T20:30:00Z_
_Verifier: Claude (gsd-verifier)_
