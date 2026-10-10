# Phase 39 — Onboarding — Decision Ledger

**Stage:** G (handoff complete) · **Baseline:** `main @ 19caf50c` · **Started:** 2026-10-09 (migrated) · **Updated:** 2026-10-09
**Counts:** 76 LOCKED · 2 DERIVED · 7 CARRIED · 0 PROVISIONAL · 0 OPEN · 4 DEFERRED · 1 REJECTED · 16 NOTE
**Sources:** `docs/dossier/workpapers/phase-39-onboarding-design-decisions.md` (legacy ledger) · `…/phase-39-onboarding-journey-discovery.md` · `…/phase-39-fresh-install-foundation-audit.md` (+ screenshot folder) · `docs/dossier/milestone-2/planning-notes/phase-15-17-18-stub-contracts.md:53-64` · `phase-06 dossier §O` · `39-CONTEXT.md` (2026-09-02 deferred-planning shim)
**Output:** `39-CONTEXT.md` (accepted 2026-10-09; replaced the 2026-09-02 placeholder shim)

> Provenance record for this phase's planning. Every owner question, the answer as given, and what
> it became. Append-only: changes go under Revisions; batch entries are never edited.
> Written by the `phase-dossier` skill after every interrogation batch.

## Migration note (2026-10-09)

Phase 39 discovery and triage ran in codex + ChatGPT sessions (2026-10-02..07). Their three
workpapers were never committed; the owner approved committing them unchanged (`19caf50c`) and
moving the live ledger into this phase folder per `.planning/DOSSIER-CONVENTIONS.md` §1 (owner,
2026-10-09: "Approve P1 and P2"). The legacy ledger stays as read-only history.

Every legacy `LOCKED` item below is recorded as LOCKED with source "legacy ledger §N". The legacy
ledger recorded them as owner + ChatGPT agreements without dates, so no decision dates are invented:
they are dated `≤2026-10-07`. Legacy PROVISIONAL / DEFERRED / OPEN statuses are carried unchanged.
Legacy wording "Owner + ChatGPT" is historical; triage continues owner + Claude.

## Resume here

- **Next:** Owner runs the UX audit (`.planning/ux-audit/UX-AUDIT-PROMPT.md`). Then check its findings against `39-CONTEXT.md` and set D-93's sharing lesson by dated amendment (D-94+). Then `/gsd-plan-phase 39`.
- **Queue (0):** none.
  - **Later stage:** Settings placement/wording; presentation/visuals; copy
- **Blockers:** none. (Device refresh done 2026-10-09 on the Pixel 3a, `untracked/artifacts/39/discovery-refresh/`.)

## Decision index

| ID | Topic | Status | From | Affects |
|----|-------|--------|------|---------|
| D-01 | Contextual, progressive, never gates product | LOCKED | legacy §3 | all journeys |
| D-02 | Teach stable behavior; never mask confusing UX | LOCKED | legacy §3 | scope |
| D-03 | Prerequisite remediation precedes dependent onboarding | LOCKED | legacy §4 | ordering |
| D-04 | Manual Add defaults → Bound + Not Yet | LOCKED | legacy §4 | CreateContactScreen |
| D-05 | Import keeps explicit choice + Unbound default | LOCKED | legacy §4 | import |
| D-06 | Possible-match: obvious normal resolution path | LOCKED | legacy §4 | DuplicateReviewScreen |
| D-07 | Compose/Assist: one coherent outcome model | LOCKED | legacy §4 | Compose, AssistBanner |
| D-08 | Welcome → Acquire → Orient → release | LOCKED | legacy §5 | first run |
| D-09 | Welcome: short, Get Started + Skip Tutorials | LOCKED | legacy §5 | first run |
| D-10 | Acquire: choose manual/import; other path not introduced | LOCKED | legacy §5 | first run, state |
| D-11 | Tutorial state ≠ workflow state; 4 distinctions | LOCKED | legacy §5 | state model |
| D-12 | Orient: Digest, Contacts, Orrery; conceptual only | LOCKED | legacy §5 | Orient |
| D-13 | Core loop Orient→Prepare→Reach Out→Record→Orient | LOCKED | legacy §6 | journey map |
| D-14 | Prepare journey | LOCKED | legacy §7 | Profile |
| D-15 | Reach Out journey; AI excluded | LOCKED | legacy §7 | Compose |
| D-16 | Record journey; Quick Log intercept; Skip proceeds | LOCKED | legacy §7 | logging |
| D-17 | FAB container concept | LOCKED | legacy §8 | FAB |
| D-18 | Skip Tutorials, per-journey Skip, Settings disable/re-enable/restart | LOCKED | legacy §9 | controls |
| D-19 | AI absent from core onboarding | LOCKED | legacy §10 | all core |
| D-20 | AI guided setup on deliberate enablement; accurate privacy boundary | LOCKED | legacy §10 | AI setup |
| D-21 | First AI-Compose small moment; no speculative AI | LOCKED | legacy §10 | Compose (AI) |
| D-22 | Orrery has a visual-orientation role | LOCKED | legacy §11 | Orient |
| D-23 | Memory moment, incl. Capture/Share discovery | LOCKED | legacy §13 | Memory |
| D-24 | Categories moment | LOCKED | legacy §13 | Categories |
| D-25 | No tutorial: current state, Key People, Off Limits, Custom Fields | LOCKED | legacy §13 | — |
| D-26 | Group Events moment on first deliberate Group Log | LOCKED | legacy §13 | Group Log |
| D-27 | No Capture workflow or advanced-interaction tutorials | LOCKED | legacy §13 | — |
| D-28 | Notifications moment on deliberate enablement; no first-run permission | LOCKED | legacy §13 | notifications |
| D-29 | No Widget or event-reminder tutorials | LOCKED | legacy §13 | — |
| D-30 | No Backup/Restore, lifecycle (incl. Favourite/Snooze/Mute), reconciliation tutorials | LOCKED | legacy §13 | — |
| D-31 | No Appearance/Profile-presentation/Settings/a11y-support tutorials | LOCKED | legacy §13 | — |
| D-32 | Tutorial framework must be accessible | LOCKED | legacy §13 | framework |
| D-33 | Basic History concept stays in Prepare/Record | LOCKED | legacy §13 | Prepare, Record |
| D-34 | No first-run right-swipe choice; Record covers it | LOCKED | Q-01 | ⚠ phase-06 §O |
| D-35 | Welcome local-first/privacy reassurance may belong | ~~PROVISIONAL~~ RESOLVED → D-88 | legacy §5 | Welcome |
| D-36 | Clear contextual teaching; avoid unnecessary Not Now | LOCKED | legacy §3 → owner 2026-10-09 | presentation |
| D-37 | Systems likely gets progressive teaching | ~~PROVISIONAL~~ RESOLVED → D-66 | legacy §13 | Systems |
| D-38 | Exact Orrery V2 Orient steps | ~~PROVISIONAL~~ RESOLVED → D-65 | legacy §11 | Orient |
| D-39 | No email/newsletter signup in first run | DEFERRED | legacy §5 | — |
| D-40 | Feedback routes + developer announcements → likely M3 | DEFERRED | legacy §12 | — |
| D-41 | Local-data-loss/backup messaging review → likely M3 | DEFERRED | legacy §12 | — |
| D-42 | Detailed History-navigation walkthrough | DEFERRED | legacy §13 | History |
| D-43 | Galaxy + Follow System first-launch default | CARRIED | phase-02, 23 D-10 | first run |
| D-44 | Message / Call / In Person vocabulary; Group Log exemption | CARRIED | D-13-177 | Record, Group |
| D-45 | Notification permission only on enablement | CARRIED | ADR-041 | notifications |
| D-46 | Custom Endpoint is Advanced, not guided setup | CARRIED | D-16-039 | AI setup |
| D-47 | Existing AI first-use disclosure is the data-path disclosure | CARRIED | ADR-079 | AI setup |
| D-48 | No permanent in-list gesture tutorial | CARRIED | phase-06 :350 | Contacts |
| D-49 | Tutorial state local-only; no analytics | CARRIED | CLAUDE.md | framework |
| D-50 | Last Spoke default Not Yet (confirms D-04 half) | LOCKED | Q-02 | ⚠ ADR-016 |
| D-51 | Bound default with visible preselected Monthly frequency | LOCKED | Q-03 | ⚠ ADR-131, phase-13 §F |
| D-52 | Import-only first run: teach at participation step; Orient adapts if nobody Bound | LOCKED | Q-04 | Acquire, Orient |
| D-53 | Record intercept covers every in-app Quick Log entry | LOCKED | Q-05 | D-16 |
| D-54 | Per-lesson Skip = done; returns only via Restart | LOCKED | Q-06 | D-18, D-11 |
| D-55 | Welcome "Skip Tutorials" = skip first run + turn all tutorials off | LOCKED | Q-07 | D-09, D-18 |
| D-56 | Global off is a pause; re-enable offers only unseen lessons | LOCKED | Q-08 (+Q-10) | D-18 |
| D-57 | Restart resets all lessons; Orient replays next open; no Welcome/Acquire replay | LOCKED | Q-09 | D-18 |
| D-58 | One lesson at a time; never over a form/sheet/Assist; waits | LOCKED | Q-11 | orchestration |
| D-59 | Background resumes; kill/navigate-away → back to unseen (not skip) | LOCKED | Q-12 | state |
| D-60 | Reaching a lesson's end = done, even if the action is cancelled | LOCKED | Q-13 | state |
| D-61 | Interrupted Acquire returns to the Acquire choice | LOCKED | Q-14 | first run |
| D-62 | Tutorial state device-local, not in backups; restore with people ends first run | LOCKED | Q-15 | persistence |
| D-63 | "Restoring from a backup?" link on Acquire | LOCKED | Q-30 | first run, restore |
| D-64 | No automatic re-show; a materially changed lesson ships as a new lesson | LOCKED | Q-16 | versioning |
| D-65 | Orient's Orrery step: orbit, position + ring meaning, tap-to-focus; new people start at top; pinch/drag line | LOCKED | Q-17 | resolves D-38 |
| D-66 | Systems lesson on first System-switcher open; no builder walkthrough | LOCKED | Q-18 | resolves D-37 |
| D-67 | One-step History hint the first time History shows a chart | LOCKED | Q-19 | resolves legacy OPEN hint |
| D-68 | + button lesson is the last step of Orient | LOCKED | Q-20 | resolves D-17 timing |
| D-69 | AI guided setup follows the existing "Recommended" OpenRouter lane | DERIVED | code + D-16-162 | D-20 |
| D-70 | Welcome/Acquire are full-screen focused routes (tab bar hidden); Orient runs over the normal shell | DERIVED | phase-01 :136-141 | first run |
| D-71 | Orient's Contacts step: "swipe right to log, left to edit" line | LOCKED | Q-21 | phase-06 D-06-072 |
| D-72 | No appearance choice in first run | LOCKED | Q-22 | phase-02 "may" declined |
| D-73 | No backup prompt in first run | LOCKED | Q-24 | 15-backup "and/or" declined |
| D-74 | Presentation mockup before planning (one full run + 2–3 entrances) | LOCKED | owner request | presentation stage |
| D-75 | Possible match: tap opens Link / Import as New / Skip for that person; long-press keeps multi-select | LOCKED | Q-26 | D-06 |
| D-76 | One "Did you send it?" at a time: Compose panel owns it (Yes, log it / No, don't log / Later), banner silent for that record; banner + pending list take over after leaving | LOCKED | Q-27 | D-07 |
| D-77 | Prerequisite fix: Bound + Not Yet shows a proper not-contacted-yet status, not "Not tracked" | LOCKED | Q-28 | profile-metrics |
| D-78 | ~~Prerequisite fix: longer Quick Log Undo window~~ | REJECTED (Q-50) | Q-29 | Snackbar, D-16 |
| D-79 | Every lesson string takes the app name from `APP_NAME` | LOCKED | owner instruction | all lesson copy |
| D-80 | Lesson card is a solid (opaque) card, as drawn | LOCKED | Q-31 | presentation |
| D-81 | Orient Contacts step with no rows: "When people appear here, swipe right to log, left to edit." | LOCKED | Q-32 | D-71 |
| D-82 | Scrim 80% for spotlight tours; lighter for tips over a panel/chart | LOCKED | Q-33 | presentation |
| D-83 | One-step tips show only "Got it" (counts as done) | LOCKED | Q-34 | ⚠ amends D-18 |
| D-84 | A lesson may appear on the sheet whose opening triggered it (Systems) | LOCKED | Q-35 | ⚠ amends D-58 |
| D-85 | Step counter "Step n of N" + progress bars | LOCKED | Q-36 | presentation |
| D-86 | First run: saving the first person (or finishing first-run import) goes to Digest and starts Orient | LOCKED | Q-37 | D-08 |
| D-87 | Add Contact shows Relationship Basics opened, all options visible, as drawn | LOCKED | Q-38 | D-51 |
| D-88 | Welcome keeps "No account needed. What you add is stored on this phone." | LOCKED | Q-39 | resolves D-35 |
| D-89 | Lesson labels "Getting around / Getting ready / Logging / Tip" | LOCKED | Q-40 | presentation |
| D-90 | Hardcoded app name elsewhere → backlog, not Phase 39 | LOCKED | Q-41 | backlog 999.4 |
| D-91 | "Orbit Status / Orbit participation / Orbit Center" are the concept, not the app name | LOCKED | Q-42 | backlog 999.4 |
| D-92 | Settings home row "Tutorials" (on/off + Restart), placed just above About | LOCKED | Q-43 | Settings hub |
| D-93 | Sharing into the app is taught; lesson content pinned until UX audit + 999.5 | LOCKED | Q-51 (corrected) | D-23, 999.5 |

## Locked decisions migrated from the legacy ledger

Full wording lives in the legacy ledger at the cited section; restated compactly here.

- **D-01** LOCKED (legacy §3) — Onboarding is contextual and progressive, decisive at a feature's meaningful first encounter, and never required to access functionality. No giant up-front tour.
- **D-02** LOCKED (legacy §3) — Tutorials teach stable product behavior; they never substitute for fixing confusing UX.
- **D-03** LOCKED (legacy §4) — Each prerequisite remediation (D-04..D-07) lands before the onboarding that depends on it. A dependency rule, not a plan order.
- **D-04** LOCKED (legacy §4) — Manual Add Contact: tracking default Unbound → **Bound**; Last Spoke default Today → **Not Yet**. Evidence F08–F12. Intentionally changes current behavior (`src/screens/CreateContactScreen.tsx:202-203`).
- **D-05** LOCKED (legacy §4) — Import keeps its explicit participation choice and **Unbound** default; it does not inherit D-04. Evidence F13/F14.
- **D-06** LOCKED (legacy §4) — Possible-match review gets an obvious normal resolution path; an undisclosed long-press must not be required. Long-press may remain for multi-select. Evidence F16. Exact interaction OPEN.
- **D-07** LOCKED (legacy §4) — Compose-local "Did you send it?" and the global Assist confirmation become one coherent outcome model (confirm / don't log / postpone where supported) before Reach Out teaching. Evidence F22. Exact remediation OPEN.
- **D-08** LOCKED (legacy §5) — First run: Welcome → Acquire → Orient → normal app. At least one person acquired before Orient. Continuation after cancelled/unsuccessful acquisition OPEN.
- **D-09** LOCKED (legacy §5) — Welcome is short, with Get Started and Skip Tutorials; no carousel. Framing (not final copy): "Relationships are an n-body problem. Orbit helps you keep the people in your life organized, remember what matters, and know when it's time to reconnect."
- **D-10** LOCKED (legacy §5) — Acquire offers Add someone manually / Import from Contacts and teaches only the chosen path; the other stays *not introduced* and is taught at a later intentional encounter.
- **D-11** LOCKED (legacy §5) — Tutorial state distinguishes never introduced, active, completed and dismissed/skipped. Workflow outcomes are separate: cancelled import ≠ never teach; permission denial ≠ skip; partial import ≠ completion. Architecture OPEN.
- **D-12** LOCKED (legacy §5) — Orient teaches three lenses conceptually: Digest (Up Next / Horizon / Your Week), Contacts, Orrery. No metric/filter/History/Contacts feature tour. Bound + Not Yet appears in Horizon, not the default Active population.
- **D-13** LOCKED (legacy §6) — Mental model Orient → Prepare → Reach Out → Record → updated state → Orient. Conceptual, not forced.
- **D-14** LOCKED (legacy §7) — Prepare: first meaningful normal Profile encounter (not import/reconciliation/maintenance-hosted). Relationship Overview, Things to Remember (emphasised; knowledge vs interactions), Contact Methods, Interaction History. Excludes deep Memory types, Key People, Off Limits, custom fields, pin/hide/outdated, Gravity/Intensity, History lenses, AI permissions, layout.
- **D-15** LOCKED (legacy §7) — Reach Out: first normal Compose entry. Editor; Things to Remember consultable without losing the draft; Copy vs Transmit; on first Transmit, Orbit hands off and the user does the sending. Assist owns the outcome question. No AI in any form. Direct Call/Text/Email need no walkthrough.
- **D-16** LOCKED (legacy §7) — Record: first intentional logging action, never auto-launched after Reach Out. Quick Log first → intercept before the write, explain immediate commit + detailed alternative, then proceed; Skip also proceeds. Detailed Log first → nothing commits until Save; Quick Log is the fast alternative. Assist is another entry to the same model, no separate journey. Close the loop (history, state, future orientation). Excludes fields, backdating, Add Note, Memory conversion, History navigation, edit/delete, group semantics, AI.
- **D-17** LOCKED (legacy §8) — The + FAB is the add/update/record container (Add Contact, Quick Log, Log Interaction, Group Log, Update Contact, Memory); never imply common commit behavior. Import is not a FAB action. Timing OPEN.
- **D-18** LOCKED (legacy §9) — First run shows Skip Tutorials; every progressive journey shows Skip; Skip never blocks the action. Settings can disable, re-enable and restart/reset tutorials; per-journey state ≠ global disable; reset ≠ enabled/disabled. Placement/wording/persistence OPEN.
- **D-19** LOCKED (legacy §10) — AI is absent from core onboarding; core workflow works without it.
- **D-20** LOCKED (legacy §10) — Dedicated optional AI guided setup on deliberate enablement or setup entry; covers only what the provider architecture needs (provider, credentials, model, validation as applicable); states AI is optional, may send permitted context to the configured provider, user controls eligibility where supported. No invented guarantees.
- **D-21** LOCKED (legacy §10) — First AI-enabled Compose use gets a small drafting/revision intro; no re-teaching; no speculative future AI features.
- **D-22** LOCKED (legacy §11) — Orrery has a visual-orientation role beside Digest and Contacts; the old renderer supplies no teaching requirements.
- **D-23** LOCKED (legacy §13) — First deliberate Memory creation: a Memory is reusable person knowledge in Things to Remember, briefly distinct from an interaction note; mention Android Share → Orbit capture. No full walkthrough.
- **D-24** LOCKED (legacy §13) — Categories: small moment on organisational purpose and reuse; no CRUD/reorder/delete teaching. Trigger later.
- **D-25** LOCKED (legacy §13) — No dedicated tutorial for current-state fields, Key People, Off Limits, Custom Fields.
- **D-26** LOCKED (legacy §13) — Group Events: small moment on first deliberate Group Log (one shared event, chosen participants, derived participant interactions). No advanced management.
- **D-27** LOCKED (legacy §13) — No Capture workflow tutorial; no backdating/edit/delete/conversion/participant-correction tutorials.
- **D-28** LOCKED (legacy §13) — Notifications: small moment on deliberate enablement/permission; no first-run permission request; no tour of types/timing.
- **D-29** LOCKED (legacy §13) — No Widget tutorial; no event-reminder tutorial.
- **D-30** LOCKED (legacy §13) — No Backup/Restore, Archive, Recently Deleted, Restore, permanent delete, Favourite, Snooze, Mute or reconciliation/merge tutorials; contextual UI owns them.
- **D-31** LOCKED (legacy §13) — No Appearance, Profile-presentation, Settings-navigation or accessibility-support tutorials.
- **D-32** LOCKED (legacy §13) — The tutorial framework itself is accessible: screen-reader semantics, predictable focus, scalable text, contrast, reduced motion, non-visual alternatives to spotlights, accessible Next/Back/Skip, no gesture-only requirements.
- **D-33** LOCKED (legacy §13) — Basic History concepts remain in Prepare/Record.
- **D-35** PROVISIONAL (legacy §5) — A brief local-first/privacy reassurance may belong in Welcome. Copy/placement OPEN.
- **D-36** PROVISIONAL (legacy §3) — Prefer clear contextual teaching over toasts; avoid constant interruption and unnecessary Not Now.
- **D-37** PROVISIONAL (legacy §13) — Systems likely warrants progressive teaching; scope pending Orrery V2 evaluation. *Blocker cleared: 38.7 complete 2026-10-05.*
- **D-38** PROVISIONAL (legacy §11) — Exact Orrery V2 Orient steps pending 38.7. *Blocker cleared: 38.7 complete 2026-10-05.*
- **D-39** DEFERRED (legacy §5) — No email/newsletter signup in first run.
- **D-40** DEFERRED (legacy §12) — Feedback/support routes and developer announcements → likely Milestone 3.
- **D-41** DEFERRED (legacy §12) — Pre-launch local-data-loss/backup messaging review → likely Milestone 3.
- **D-42** DEFERRED (legacy §13) — No detailed walkthrough of History navigation pending the redesign. *Redesign now built (38.8, gap plan 07 pending); the legacy OPEN "tiny post-redesign hint" returns to the queue (cluster H).*

## Evidence

Verified against `main @ 19caf50c` unless labelled. Classes: FACT · HISTORY · RESEARCH · OWNER (recorded) · INFERENCE · DISCREPANCY.

- **HISTORY** — Phase 39 workpapers authored 2026-10-02..07, never committed until `19caf50c`. No git provenance before that.
- **HISTORY** — Fresh-install audit built from source `305ed1ea` (audit header). 115 `src/` commits since (86 × 38.7, 29 × 38.8); its Orrery and History observations describe the pre-V2 / pre-stream app.
- **HISTORY** — 38.7 Orrery V2 complete 2026-10-05 (ROADMAP :165). 38.8 History stream 6/7 plans, owner sign-off recorded (`a02fbd9d`), gap plan 07 pending. History workpaper moved to the 38.8 folder in `a7dcd76e`.
- **FACT** — D-04 not yet implemented: `CreateContactScreen.tsx:202` `trackingEnabled` false; `:203` `lastSpoke` `{kind:"today"}`. Stale header claim at `:15-17` ("Frequency defaults to Monthly (30)").
- **FACT** — D-06 not yet implemented: `DuplicateReviewScreen.tsx:322,358` pass `onInspect={() => undefined}`; `CandidateCardGrid.tsx:204-207` tap = no-op until long-press starts selection.
- **FACT** — D-07 not yet implemented: `ComposeScreen.tsx:24` documents the local panel as ADDITIVE to the app-global AssistBanner + PendingConfirmationsSheet.
- **FACT** — No onboarding/tutorial infrastructure in `src/` (subagent sweep; only `dashboard-empty-logic.ts` "firstrun" derived empty state).
- **FACT** — Preferences live in single-row `app_settings` (`src/db/app-settings-dao.ts`); backup exports only the `getPortableSettingsSnapshot` allowlist (`:886`); device-local fields (e.g. `backupNudgeDismissed`) are excluded. AsyncStorage holds only contacts-permission flags.
- **DISCREPANCY** — Recorded onboarding obligations the legacy ledger never addressed: stub contract `phase-15-17-18-stub-contracts.md:53-64` and `39-CONTEXT.md` D-01/D-02 (shim). See cluster I.
- **DISCREPANCY** — D-04 reverses recorded decisions without citing them: `ADR-131 :18` ("No cadence creates an Unbound contact"; "today/on-date/not-yet rule remains intact"), `phase-13 dossier :150-152` (explicitly `[SUPERSEDES]` earlier "manual creation defaults to Bound"), `ADR-016 :18` ("A normal create defaults last-spoke to today"). Neither ADR is superseded today. Audit F10: a valid cadence is required for Bound creation, so "Bound by default" needs a frequency answer the legacy ledger never gave. → Q-02, Q-03.
- **FACT** — Digest, Contacts-tab populations and the Orrery's All Contacts all scope to `archived_at IS NULL AND tracking_enabled = 1` (`src/logic/dashboard-query-logic.ts:219-220`; `src/logic/orrery-system-logic.ts:91`). Unbound people appear in none of them. Import defaults Unbound (D-05), so an import-only first run reaches Orient with empty lenses (audit screenshots 35–36). → Q-04.
- **FACT** — Quick Log entries (all via `runQuickLog`, `src/services/quick-log-command.ts:131`, snackbar Undo + Add Note): FAB (`universal-fab-logic.ts:191`, focused Profile logs directly), Contacts-row swipe by default (`HomeScreen.tsx:627-637`; pref `dashboard_right_swipe_action`, migration 020), ListRow TalkBack action (`ListRow.tsx:234`), grid card + context menu + grid a11y action (`HomeScreen.tsx:1998,2034`; `GridCard.tsx:191`), bulk Quick Log (`HomeScreen.tsx:1156`). Outside the app, headless, no Undo: widget mark (`widget-mark.ts:51-56`), notification Mark (`notification-actions.ts:154`). Assist Yes writes via `markAssistLogged` (`interaction-assist-dao.ts:91`), no Undo. Profile has no Quick Log control of its own; Digest cards only open Profile. → Q-05.
- **FACT** — Import from Contacts is reachable only from Settings → Contacts (`SettingsContactsScreen.tsx:315`) plus the resume prompt; not from the FAB or Contacts tab. The progressive Import encounter (D-10) therefore happens in Settings.
- **FACT** — Profile route params are only `{contactId, openReachOut?}` (`src/navigation/types.ts:14-17`); Create, import review and merge all land on a plain Profile. A "normal encounter" trigger (D-14) cannot be detected from params today.
- **FACT** — All four Profile sections start collapsed in the factory layout (`src/profile/presentation-schema.ts:124-128`). History empty state: "No history yet / Log an interaction to start seeing activity here." + "Log interaction" (`HistorySection.tsx:1093-1110`). A new log appears in place under Today with no highlight or announcement.
- **FACT** — History stream (38.8) has no hint copy; heatmap-cell tap-to-jump is not signposted (cells are buttons labelled e.g. "Oct 2, 1 interaction", `ActivityHeatmap.tsx:354-378`). 38.8-07 code landed (`d3f94f94`, `83203b0b`, `443434ff`, `2dca5763`); its device re-check is pending. `38.8-CONTEXT.md:48,313` keep the History hint as a Phase 39 open item.
- **FACT** — Orrery V2: own tab; All Contacts shows Bound, non-archived people; never-contacted bodies sit at angle 0 (north) on neutral rings (`orrery-world-logic.ts:23,148-151`). 6 built-in + 4 seeded category Systems always exist; zero custom. Meaning of angle/ring style/rim colour is explained nowhere in the UI except the label context at close zoom and the "Contacts in this System" sheet. Pan/zoom/rotate/tilt/reorder are gesture-only; the canvas has no a11y props; the sheet is the non-gesture path. No onboarding decisions in 38.7 D-01..D-81.
- **FACT** — App-wide reduced-motion hook exists (`src/theme/use-reduced-motion.ts`). No screen-reader detection (`isScreenReaderEnabled`) anywhere. `BaseOverlay` moves a11y focus on open (`components/ui/overlay-base.tsx:84-89`).
- **FACT** — First launch: no first-run flag or route; initial tab is Digest (`shell-contract.ts:9`). Contacts tab shows a "firstrun" empty state with "Add your first contact" (`HomeScreen.tsx:1717-1731`); Digest has none. Theme default galaxy + system (migration 015).
- **FACT** — Persistence: migration head 032 (`database.ts:70`); `BACKUP_FORMAT_VERSION = 7` (`src/backup/types.ts:14`); portable settings = explicit allowlist (`app-settings-dao.ts:886-971`); restore modes merge / replace-all, settings last-writer-wins. No erase-all-data flow.
- **FACT** — An AI first-use privacy disclosure already exists (`src/components/AIFirstUseDisclosure.tsx:22`, shown at `SettingsAIScreen.tsx:293`; phase-16 dossier §AG, ADR-079). D-20's setup must build on it, not duplicate it.
- **FACT** — Android Share → Capture writes the `fuel` table (`CaptureScreen.tsx:273`; `fuel-dao.ts:127`), not memories; fuel renders inside Things to Remember (`src/profile/knowledge-presentation.ts:337`). D-23's Capture mention should say "saved to Things to Remember", not "saved as a Memory".

- **FACT (device, 2026-10-09)** — Pixel 3a, release build `1.0.0` installed 2026-10-09 16:58 (38.8 complete, `b02e7f63`), fixture DB (1085 contacts); screenshots `untracked/artifacts/39/discovery-refresh/01–62`. Confirmed on device: Profile sections all start collapsed (08); History empty state copy + "Log interaction" (31); no legend/hint in Orrery or History; Unbound contacts absent from the Orrery (count unchanged); defaults Unbound + Today, Today silently writes an "unspecified" interaction (19, 24).
- **DISCREPANCY (verified)** — A Bound contact with Last Spoke "Not yet" shows Orbit Status **"Not tracked — Set a contact frequency to see Orbit Status."** even with a frequency set (29). Cause: `resolveProfileStatus` treats `lastContact === null` like no cadence (`src/services/profile-metrics.ts:154-167`). Under D-50/D-51 this becomes the default state of every new manual contact, and Prepare (D-14) teaches Relationship Overview. → Q-28.
- **FACT (device + code)** — Bound + Not Yet appears in Digest Horizon's "Never Contacted" list ("N people have never been contacted", `src/components/digest/HorizonSection.tsx:143-144`); the device agent misread it as outside Horizon. D-12's Horizon claim holds. In the Orrery, never-contacted bodies stack into one overlapping column at north, individually hard to tap (34); in All Contacts its top is hidden behind the header chips.
- **FACT (device)** — Quick Log snackbar ("Logged · Undo · Add a note") lasted ~3–5 s; the agent could not reach Undo in time (48–49). Quick Log records Message · Outbound by default (51).
- **FACT (device)** — Archive runs with no confirmation; permanent delete only via Settings → Archived contacts. Systems builder shows "0 members" with every filter at "Any" (39–40). Orrery first frame blank for ~5–10 s and an ANR opening "Contacts in this System" at 1085 contacts (02, 11) — scale/perf findings, not Phase 39 scope.

## Carried decisions

- **D-43** CARRIED — First-launch appearance default stays Galaxy + Follow System; onboarding does not change it — source: phase-02 dossier `:38-40`, 23-CONTEXT D-10; code `migrations/015-theme-settings.ts:32-40`.
- **D-44** CARRIED — Any taught logging vocabulary uses Message / Call / In Person, never Text / Email / Other, and never implies the Channel default governs Group Log — source: phase-13 dossier `:692-694` (D-13-177), stub contract `:59-60`.
- **D-45** CARRIED — Notification permission is requested only when the user enables reminders; never at first launch — source: ADR-041 `:18,:24`; `SettingsNotificationsScreen.tsx:177-185`. Consistent with D-28.
- **D-46** CARRIED — Custom Endpoint is an Advanced AI path, not a normal guided-setup path — source: phase-16 dossier `:263` (D-16-039).
- **D-47** CARRIED — The existing AI first-use disclosure (ADR-079, phase-16 §AG) remains the AI data-path disclosure; D-20 builds on it — source: `AIFirstUseDisclosure.tsx:22`.
- **D-48** CARRIED — No permanent in-list gesture tutorial — source: phase-06 dossier `:350`.
- **D-49** CARRIED — Local-first: tutorial state, completion and skips stay on device; no analytics or telemetry — source: CLAUDE.md "Local-first is a product commitment". (Legacy topic list item "telemetry" resolves here; not an owner question.)

## Derived decisions

- **D-69** DERIVED — AI guided setup (D-20) leads with the connection the product already labels "Recommended": OpenRouter, via "Connect with OpenRouter" sign-in (`src/screens/AIConnectionScreen.tsx:357-372`; expanded by default `:64-66`), with OpenAI / Anthropic / Google key lanes as alternatives and Custom Endpoint as Advanced (D-46). Discharges the stub-contract "may promote OpenRouter" item (`phase-16 dossier :959`) without redefining the connection architecture. — owner may veto at draft review
- **D-70** DERIVED — Welcome and Acquire are full-screen focused routes with the tab bar hidden, following the existing `FOCUSED_WORKFLOW_ROUTES` pattern (`focused-route-classification.ts:7`) and phase-01 dossier `:136-141` ("likely hidden: … onboarding"). Orient runs over the normal shell because it points at the tabs. — owner may veto at draft review

## Notes for planning

- **N-01** — Right-swipe on list rows runs Quick Log immediately by default (phase-06 dossier §O). D-16's intercept must therefore cover every Quick Log entry, not just the FAB. Entry inventory pending (subagent).
- **N-02** — `39-CONTEXT.md` today is the 2026-09-02 deferred-planning shim. GSD treats a phase as discussed when a CONTEXT exists; the dossier will replace it at handoff (stage G).
- **N-03** — Any tutorial preference that enters the portable backup allowlist owes a backup-format bump, an owner decision (`39-CONTEXT.md` shim D-02).
- **N-04** — Possible stale-comment fix at `CreateContactScreen.tsx:15-17` travels with D-04.
- **N-05** — Post-38.8 device refresh of the Orrery and History journeys is wanted by the owner once 38.8 wraps (owner, 2026-10-09); until then evidence is code-level.
- **N-06** — A Profile "normal encounter" trigger needs an origin signal (new route param or previous-route check); engineering, to be DERIVED after Q on trigger semantics.
- **N-07** — Detailed Log save does not bump the shell refresh tick (`LogInteractionScreen.tsx:238-242`); consumers refresh on their next focus. Relevant to Record's "close the loop" claim.
- **N-08** — Orrery 30-UI-SPEC empty-state copy/comet never shipped (`30-UI-SPEC.md:117,150`); shipped copy is in `orrery-controls-logic.ts:211-229`. Teaching must quote shipped copy.
- **N-09** — Recorded obligations still to triage (cluster I): row-gesture education (phase-06 `:260`, D-06-072; `[DECIDED]`); optional early appearance choice (phase-02 `:38-40`, "may"); richer illustration for first-use moments (phase-02 `:258-260`); bottom nav hidden during onboarding (phase-01 dossier `:136-141`, "likely"); OpenRouter as recommended connection (phase-16 `:959`, "may"); optional first-run backup prompt (15-backup `:52-53`).

- **N-10** — Device-observed issues outside Phase 39 scope: Systems builder "0 members" with all filters Any; Archive without confirmation (D-30 assumes consequence copy/confirmations exist). Owner rulings 2026-10-09: the Orrery blank frame / ANR are the 3a running a 1085-contact fixture ("It needs to run at the lower contact count systems") — not a finding; Add Contact chip styling (solid top-level, outlined sub-options) is intentional and preferred — not a finding.
- **N-13** — Initial tab is Digest (`shell-contract.ts:9`), which has no first-run empty state; after D-55 Skip Tutorials the user may land on an empty Digest. Planning to decide where Skip lands.
- **N-11** — The never-contacted north column (screenshot 34) is what a new manual user's Orrery will look like under D-50/D-51 (every new contact Bound + Not Yet). Feeds Q-17.
- **N-12** — The ~3–5 s Quick Log snackbar is the only Undo path; D-16/D-53 teaching should not promise Undo it cannot reliably deliver. Feeds Q-29.

- **N-14** — Recommended framework shape (answered to owner 2026-10-09, not yet a decision): one lesson registry file (each lesson = data: id, trigger, steps with copy + anchor); one shared accessible presenter; first-run Welcome/Acquire as real screens; screens mark targets with an anchor wrapper; entry points call a single `trigger(lessonId, {continue})` that the orchestrator gates (enabled, unseen, nothing else active/open, D-58) and that always runs `continue` (D-16, D-53); per-lesson status + global switch in a device-local table (D-62); pure eligibility logic unit-tested. Updating copy = edit the registry; new lesson = registry entry + one trigger call + anchors.

- **N-15** — Mockup v1 surfaced: D-58 (no lesson over an open sheet) conflicts with D-66 (Systems lesson triggers on the switcher opening) → mockup Q5; Contacts tab with only Bound + Not Yet people shows no rows ("Everyone's tucked away"), so the D-71 swipe line has no row to point at → mockup Q2; Create saves to the new Profile today, so where Orient starts after first-run Add needs deciding → mockup Q7; Relationship Basics starts collapsed, so D-51's "visible" Monthly needs a placement → mockup Q8.

- **N-16** — Owner direction for the separate pre-planning UX audit (2026-10-09), recorded in Batch 11. Its findings may amend this dossier before planning.

## Batches

### Batch 1 — 2026-10-09 — Cluster: recorded-obligation collisions (first-run)

#### Q-01 — First-run right-swipe logging choice
- **Asked:** The phase-06 dossier §O `[DECIDED]` "First-run onboarding exposes an early choice/override" for right-swipe Quick Log vs detailed Log (also stub contract :57). The agreed first run (D-08) has no such step. A: keep it as a short first-run choice after Orient. B: drop the first-run choice, keep the Settings option; Record teaches Quick Log vs detailed and mentions right-swipe uses the Quick Log default, changeable in Settings. C: other. Recommendation (not a decision): B.
- **Answer (verbatim):**
  > For !, I agree with option B.
- **Recorded:** D-34 LOCKED — No right-swipe preference choice in first run. The global Settings preference and Quick Log default stay. Record (D-16) teaches the Quick Log vs detailed distinction and mentions that right-swipe uses the configured default (Quick Log unless changed), changeable in Settings. ⚠ SUPERSEDES phase-06 dossier §O (partial — the first-run choice only).
- **Rationale:** Keeps first run lean (D-08) and teaches the choice when it is meaningful.
- **Affects:** phase-06 dossier §O; stub contract :57 (first half); D-16; N-01.
- **Spawned:** dashboard gesture/star education half of stub :57 → cluster I.

### Batch 2 — 2026-10-09 — Cluster: recorded-decision reversals + first-run foundations

Owner answer to the whole batch (verbatim):
> Approve all including q1

(Q-01 was already LOCKED in Batch 1; read as approving every recommendation, including Q-03's suggested Monthly frequency.)

#### Q-02 — Last Spoke default
- **Asked:** ADR-016 `:18` defaults Last Spoke to Today; D-04 changes it to Not Yet. A: confirm Not Yet, ADR-016's Today default superseded; the Today / Pick date / Not yet control stays. B: keep Today but make the control visible. Recommendation (not a decision): A.
- **Recorded:** D-50 LOCKED — Manual Add Contact defaults Last Spoke to **Not Yet**. ⚠ SUPERSEDES ADR-016 (partial — the Today default). Confirms D-04's Last Spoke half with the governing record now named.
- **Affects:** D-04; ADR-016; `CreateContactScreen.tsx:203`.
- **Spawned:** none.

#### Q-03 — How Bound gets a frequency
- **Asked:** ADR-131 `:18`: no frequency → Unbound; Bound requires a frequency (audit F10). A: default Bound with a frequency preselected and visible on the form, editable; creation stays name-only; suggested Monthly. B: Bound default but frequency required before save. C: keep Unbound default. Recommendation (not a decision): A, Monthly.
- **Recorded:** D-51 LOCKED — Manual Add Contact defaults to **Bound with Monthly preselected**, shown visibly on the form and editable; Name stays the only required field. ⚠ SUPERSEDES ADR-131 (partial — "No cadence creates an Unbound contact" as the *default* outcome; choosing no frequency / Unbound remains possible) and phase-13 dossier §F `:150-152` (partial — Unbound as default). Confirms D-04's tracking half.
- **Affects:** D-04; ADR-131; phase-13 §F; `CreateContactScreen.tsx:200-202`; Relationship Basics collapsed-by-default placement (visibility of the frequency must be ensured).
- **Spawned:** none (exact control placement is presentation-stage).

#### Q-04 — Import-only first run
- **Asked:** Digest, Contacts list and Orrery All Contacts show only Bound people; Import defaults Unbound (D-05). A: in first-run Import, teach at Import's existing participation step that tracked people appear in Digest and the Orrery; if nobody ends up Bound, Orient adapts — explains Unbound and where to start tracking someone instead of touring empty lenses. B: delay Orient until a Bound person exists. C: run Orient on empty lenses. Recommendation (not a decision): A.
- **Recorded:** D-52 LOCKED — First-run Import teaching covers the participation (Bound/Unbound) choice and its consequence for Digest/Orrery visibility. If acquisition yields no Bound person, Orient runs an adapted version: explain Unbound and show how to start tracking someone, not a tour of empty lenses. D-05's Unbound default is unchanged.
- **Affects:** D-05, D-10, D-12; audit F11/F12/F15.
- **Spawned:** Q-17 must cover the adapted Orient.

#### Q-05 — Quick Log intercept coverage
- **Asked:** A: every in-app Quick Log entry (FAB, row swipe, grid card + context menu, TalkBack actions, bulk); exclude widget and notification Mark (outside the app, no UI) and Assist Yes (a confirmation, D-16). B: FAB + swipe only. Recommendation (not a decision): A.
- **Recorded:** D-53 LOCKED — D-16's first-Quick-Log intercept fires on whichever in-app Quick Log entry the user uses first: FAB, Contacts row swipe (when the swipe pref is Quick Log), grid card, card context menu, row/grid TalkBack actions, bulk Quick Log. Widget mark, notification Mark and Assist confirmations never trigger it. Skip proceeds with the original write (D-16).
- **Affects:** D-16, D-34, N-01; `quick-log-command.ts:131` callers.
- **Spawned:** none.

### Batch 3 — 2026-10-09 — Cluster: tutorial state & controls

Owner answer to the whole batch (verbatim):
> approve all on batch 3.

#### Q-06 — Meaning of per-lesson Skip
- **Asked:** A: Skip = done; the lesson never returns unless the user Restarts in Settings. B: Skip = not now; returns at the next matching moment. Recommendation (not a decision): A.
- **Recorded:** D-54 LOCKED — Skipping a progressive lesson marks it dismissed; it is not offered again unless the user Restarts tutorials (D-57). Skip still continues the underlying action (D-16/D-18).
- **Affects:** D-11, D-18, D-36. **Spawned:** none.

#### Q-07 — Scope of Welcome "Skip Tutorials"
- **Asked:** A: skip first run and turn off every later lesson (same as switching tutorials off in Settings); user lands in the app (Contacts tab shows "Add your first contact"). B: skip first run only. Recommendation (not a decision): A.
- **Recorded:** D-55 LOCKED — Welcome "Skip Tutorials" ends first run and sets tutorials globally off. Re-enabling in Settings (D-56) brings back unseen lessons.
- **Affects:** D-09, D-18; first-run empty states (`HomeScreen.tsx:1717-1731`; initial tab is Digest, which has no first-run state — see N-13). **Spawned:** none.

#### Q-08 — Global off / re-enable (absorbs Q-10)
- **Asked:** A: off is a pause; remembers seen/skipped; re-enable offers only unseen lessons. B: re-enable resets everything. Recommendation (not a decision): A.
- **Recorded:** D-56 LOCKED — Global disable suspends all lessons without changing per-lesson state; re-enabling resumes eligibility for lessons never completed or skipped.
- **Affects:** D-18. **Spawned:** none.

#### Q-09 — What Restart replays
- **Asked:** A: reset every lesson to unseen; Orient runs on next app open; Welcome/Acquire don't replay. B: A plus a per-lesson replay list. C: full first run again. Recommendation (not a decision): A.
- **Recorded:** D-57 LOCKED — "Restart tutorials" resets all lessons to unseen (and turns tutorials on if off — DERIVED reading, owner may veto); Orient replays on the next app open; Welcome and Acquire do not replay. No per-lesson replay list.
- **Affects:** D-18, D-54. **Spawned:** none.

### Batch 4 — 2026-10-09 — Cluster: triggers, collisions, interruption, persistence

Owner answer to the whole batch (verbatim):
> approve all.

#### Q-11 — Simultaneous eligibility
- **Asked:** A: one lesson at a time; never starts over an open form, sheet or Assist question; waits for its next matching moment; no back-to-back. B: queue and chain. Recommendation (not a decision): A.
- **Recorded:** D-58 LOCKED — At most one lesson is active. A lesson never starts while a form, sheet, dialog or Assist question is open; it stays eligible for its next matching moment. Lessons are not chained back-to-back. (First-run Welcome → Acquire → Orient is one sequence, D-08, not a chain.)

#### Q-12 — Interrupted lesson
- **Asked:** A: background → resume in place; app killed or navigated away → back to unseen, offered at next matching moment, not a skip. B: any interruption = skip. Recommendation (not a decision): A.
- **Recorded:** D-59 LOCKED — Backgrounding pauses and resumes the active lesson. Process death or leaving the lesson's screen returns it to unseen (not skipped).

#### Q-13 — Underlying action cancelled after a lesson
- **Asked:** A: reaching the lesson's end counts as done regardless of the action's outcome; Acquire keeps D-11. B: only when the action completes. Recommendation (not a decision): A.
- **Recorded:** D-60 LOCKED — A lesson is completed when the user reaches its end (or Skips, D-54), independent of whether the underlying workflow is saved or cancelled. First-run Acquire keeps D-11's workflow-state rules.

#### Q-14 — First run interrupted during Acquire
- **Asked:** A: next launch returns to the Acquire choice (no Welcome repeat); permission denial/cancel returns to the choice; Skip Tutorials always available. B: abandon first run. Recommendation (not a decision): A.
- **Recorded:** D-61 LOCKED — Until a person is acquired (or Skip Tutorials), first run resumes at the Acquire choice on every launch. Cancelled import or denied permission returns to the choice, with manual add available.

#### Q-15 — Tutorial state in backups
- **Asked:** A: device-local, not backed up, no format bump; a restore that brings in people ends first run. B: portable, format bump (owner call). Recommendation (not a decision): A.
- **Recorded:** D-62 LOCKED — Tutorial state is device-local and excluded from backup/export (like `backupNudgeDismissed`); no backup-format change. A restore that yields at least one person completes first run. Discharges the shim D-02 format-bump obligation (N-03).

#### Q-30 — Restore during first run
- **Asked:** First run offers only Add manually / Import; a new-phone user must skip tutorials and find Restore in Settings. A: small "Restoring from a backup?" link on Acquire opening the existing restore flow; first run ends if the restore brings people. B: no change. Recommendation (not a decision): A.
- **Recorded:** D-63 LOCKED — Acquire carries a secondary "Restoring from a backup?" entry into the existing restore flow. Restore is not taught as a lesson (D-30 stands). Scope addition to the Acquire screen only.

#### Q-16 — Lesson changes in later releases
- **Asked:** A: never re-show automatically; a lesson changed enough to warrant it ships as a new lesson (new identity), seen at its next matching moment subject to Skip/off. B: per-lesson versions auto re-show. Recommendation (not a decision): A.
- **Recorded:** D-64 LOCKED — Editing a lesson's wording keeps its identity (users who finished it don't see it again). A materially new lesson gets a new identity and is offered under the normal rules (D-54, D-56, D-58).

#### Owner question (not a decision) — 2026-10-09
> Question, how do these lesson like exist in code? Are they each going to be a component? Each is a TS file? What does that look like. … I have no idea currently how I'm going to be able to update or create new lessons.

Answered with the recommended architecture (registry of lessons as data + one shared presenter + trigger calls + anchors + local state). Recorded as N-14; becomes DERIVED in the draft for owner veto.

### Batch 5 — 2026-10-09 — Cluster: unblocked dependencies (Orrery, Systems, History, FAB)

Owner answer to the whole batch (verbatim):
> approve all

#### Q-17 — Orrery in Orient
- **Asked:** A: three points (each person orbits you; position = time since contact relative to frequency, ring style = status; tap to focus and open profile) + "new people start at the top until you log a conversation" + "pinch and drag to explore"; adapted Orient (D-52) says the Orrery shows tracked people and how to start tracking. B: one minimal step. C: A + backlog a permanent legend. Recommendation (not a decision): A.
- **Recorded:** D-65 LOCKED — as option A. Resolves D-38 (PROVISIONAL). Copy must match V2 encodings (`orrery-geometry-logic.ts:34-37`, `orrery-ring-logic.ts:55-100`) and the never-contacted north placement (`orrery-world-logic.ts:148-151`).

#### Q-18 — Systems
- **Asked:** A: small lesson on first System-switcher open (a System is a saved view of who's in your Orrery; built-ins/categories exist; make your own in Manage Systems); no builder walkthrough. B: one line inside Orient's Orrery step. C: none. Recommendation (not a decision): A.
- **Recorded:** D-66 LOCKED — as option A; trigger = first open of the System switcher (`OrrerySystemSelector.tsx`). Resolves D-37 (PROVISIONAL).

#### Q-19 — History hint
- **Asked:** A: one-step lesson the first time History is opened with a chart showing: "Tap any day in the chart to jump to it." B: line in Prepare's History step. C: no hint. Recommendation (not a decision): A.
- **Recorded:** D-67 LOCKED — as option A. Resolves the legacy OPEN "tiny post-redesign hint" and `38.8-CONTEXT.md:48,313`. D-42 (no detailed History-navigation walkthrough) stands.

#### Q-20 — + button lesson timing
- **Asked:** A: last step of Orient in first run; per-action lessons explain commit behaviour. B: first tap of +, which collides with the Quick Log lesson under D-58. Recommendation (not a decision): A.
- **Recorded:** D-68 LOCKED — The FAB container lesson (D-17) is Orient's final step, including adapted Orient. After Restart (D-57) it replays with Orient.

### Batch 6 — 2026-10-09 — Cluster: recorded obligations

Owner answer to the whole batch (verbatim):
> Approve all.

Q-23 (OpenRouter) and Q-25 (tab bar in first run) were resolved by investigation as D-69 / D-70 DERIVED and shown to the owner before this batch.

#### Q-21 — Contacts row gestures
- **Asked:** phase-06 dossier `:260` (D-06-072) assigns row-gesture education to onboarding. A: one line in Orient's Contacts step, "Swipe someone right to log, left to edit."; Record already covers what right-swipe logging does (D-34). B: separate small lesson. C: none (reversal). Recommendation (not a decision): A.
- **Recorded:** D-71 LOCKED — as option A. Fulfils D-06-072 and the gesture half of stub contract `:57`. Must also be stated accessibly (the row's TalkBack actions, `ListRow.tsx:234`), per D-32.

#### Q-22 — Early appearance choice
- **Asked:** phase-02 dossier `:38-40` "may offer an early appearance choice". A: none; Appearance stays in Settings. B: one-tap theme choice on Welcome. Recommendation (not a decision): A.
- **Recorded:** D-72 LOCKED — No appearance choice in first run. The optional "may" is declined; no reversal. D-43 default unchanged.

#### Q-24 — First-run backup prompt
- **Asked:** 15-backup dossier `:52-53` allows a first-run prompt "and/or" the overdue nudge (which exists, `backup-health-logic.ts:130`). A: none; M3 messaging review (D-41) may revisit. B: short prompt at end of first run. Recommendation (not a decision): A.
- **Recorded:** D-73 LOCKED — No backup prompt in first run.

#### Owner request — 2026-10-09
> I'm going to want to see a detailed mockup of some of these tutorial screens so I can make sure we're on the same page design-wise before I have the next session plan everything out (plus it gives me something I can give that agent to aim for). Maybe pick one tutorial run to show the entire run of, then just mock up 2-3 more tutorial entrance screens or something. I'm looking to get a feel for the step-through process as well as general overall design of things

- **Recorded:** D-74 LOCKED — Before the dossier is accepted, produce an HTML mockup (precedent: `38.8-WORKPAPER-mockup/`): one complete lesson run step by step, plus 2–3 other lesson entrance screens, showing the step-through mechanics and overall look. Owner sign-off on it gates the presentation decisions; the accepted mockup becomes the planning reference.

### Batch 7 — 2026-10-09 — Cluster: prerequisite remediation designs

Owner answer to the whole batch (verbatim):
> approve all for batch 7. Mock ups look fantastic.

#### Q-26 — Possible-match resolution
- **Asked:** Today tapping a candidate on "Review matches" does nothing (`DuplicateReviewScreen.tsx:322,358`); long-press starts selection → Link to Existing / Import as New / Skip (`CandidateCardGrid.tsx:87-89`). A: tap opens those three actions for that person; long-press keeps multi-select. B: tap starts selection with a "Tap to select" hint. C: inline buttons per card. Recommendation (not a decision): A.
- **Recorded:** D-75 LOCKED — as option A. Implements D-06.

#### Q-27 — Duplicate "Did you send it?"
- **Asked:** Compose's local panel (Yes / Not yet) and the app-wide Assist banner ask about the same pending record; only the banner offers "Don't log"; Not yet just closes the panel (`ComposeScreen.tsx:24,1152-1156`). A: one question at a time — in Compose its panel is the only asker with Yes, log it / No, don't log / Later, banner silent for that record; after leaving unanswered, banner and pending list take over; same three answers everywhere. B: remove the panel. C: remove the banner question for Compose-originated records. Recommendation (not a decision): A.
- **Recorded:** D-76 LOCKED — as option A. Implements D-07. Answer vocabulary is consistent across panel, banner and pending sheet.

#### Q-28 — "Not tracked" on Bound + Not Yet
- **Asked:** `resolveProfileStatus` returns "Not tracked — Set a contact frequency…" when `lastContact` is null even with a frequency (`src/services/profile-metrics.ts:154-167`); D-50/51 make this every new contact's state. A: add to prerequisite fixes with a proper not-contacted-yet state (wording at planning). B: leave it; Prepare avoids Orbit Status. Recommendation (not a decision): A.
- **Recorded:** D-77 LOCKED — Prerequisite fix: a Bound contact with no interaction shows a distinct not-contacted-yet Orbit Status, not "Not tracked". Exact copy at planning. Precedes Prepare (D-03).

#### Q-29 — Quick Log Undo window
- **Asked:** The "Logged · Undo · Add a note" snackbar lasted ~3–5 s on device; Undo unreachable in practice. A: add to prerequisite fixes — longer for Quick Log, accessible, time set at planning; Record lesson may then mention Undo. B: leave it; lesson doesn't mention Undo. Recommendation (not a decision): A.
- **Recorded:** D-78 LOCKED — Prerequisite fix: lengthen the Quick Log snackbar's Undo window; the duration is a planning decision (no threshold invented here). Precedes Record (D-03).

#### Owner instruction — 2026-10-09
> One thing, please make sure any places here using the app name are using the constant so when we change the app name it changes across all of this.

- **Recorded:** D-79 LOCKED — Every Phase 39 lesson, Welcome and Acquire string that names the app interpolates `APP_NAME` (`src/constants/app.ts:23`, sourced from `app-name.json`); no literal "Orbit" in onboarding copy. The mockup now renders its app-name text from one constant.
- **Spawned:** Q-41 (existing hardcoded app name elsewhere — `ABOUT_APP_NAME` literal at `settings-about-model.ts:29`, `HomeScreen.tsx:1797` title, ~50 UI strings), Q-42 (are "Orbit Status / Orbit participation / Orbit Center" the brand or the concept?).

#### Owner request — 2026-10-09
> we should probably lean on the new phase-dossier skill to help us transition from this interrogation … Please make sure things are set up properly so I can run gsd-plan-phase next in a new session.

- Noted; process per the skill: Batch 8 (mockup Q1–Q10 → Q-31..Q-40, plus Q-41/Q-42) → stage E draft → F audit → owner acceptance → G handoff (CONTEXT.md, DISCUSSION-LOG stub, ROADMAP Phase 39 entry, STATE).

### Batch 8 — 2026-10-09 — Cluster: presentation (mockup Q1–Q10) + app name

Owner answer (verbatim):
> Approve all except Q-38 and Q-42.
>
> Q-38: I don't understand this one. It looks fine as drawn in the mockup with all the options shown, why would we condense it?
> Q-42: I don't know what those examples you gave are, they don't sound familiar at all except the last one, which you are correct that it's the idea, not the name there. The other ones aren't real examples are they?

Recommendations offered are in the conversation table (mockup Q1–Q10 = Q-31..Q-40); each approved item records the recommendation.

- **Q-31 → D-80 LOCKED** — Lesson cards are opaque `surfaceElevated` cards with a strong border and pointer, as drawn (not the glassy treatment).
- **Q-32 → D-81 LOCKED** — When Orient's Contacts step has no rows to show, the swipe line reads "When people appear here, swipe right to log, left to edit." No sample/fake row. Refines D-71.
- **Q-33 → D-82 LOCKED** — Scrim: background colour at ~80% for spotlight tours; ~50–55% for tips over an open panel or chart (mockup values; final token values at planning).
- **Q-34 → D-83 LOCKED** — One-step tips show a single "Got it", which records the tip done. ⚠ AMENDS D-18 (partial — "every progressive journey offers Skip" no longer applies to single-step tips; multi-step lessons and the Quick Log intercept keep Skip).
- **Q-35 → D-84 LOCKED** — Exception to D-58: a lesson may attach to the sheet whose opening is its own trigger (the Systems lesson on "Choose System"). ⚠ AMENDS D-58 (partial). Every other open form/sheet/dialog still blocks lessons.
- **Q-36 → D-85 LOCKED** — Step counter "Step n of N" plus small progress bars on multi-step lessons.
- **Q-37 → D-86 LOCKED** — During first run, saving the first person goes to Digest and Orient starts there (today Create replaces to the new Profile, `CreateContactScreen.tsx:394`); finishing a first-run import also lands on Digest. Outside first run, Create's existing landing is unchanged.
- **Q-38 → D-87 LOCKED** — Owner rejected the condensed one-line summary; Add Contact shows Relationship Basics opened with all options visible (Last spoke, Orbit participation, Frequency), as drawn. Satisfies D-51's visibility. Today the section starts collapsed (`CreateContactScreen.tsx:222`). Recommendation's reason (keep the form short per ADR-131's name-first intent) was explained in reply; owner's "looks fine as drawn" stands.
- **Q-39 → D-88 LOCKED** — Welcome keeps the line "No account needed. What you add is stored on this phone." Resolves D-35.
- **Q-40 → D-89 LOCKED** — Card labels "Getting around" (Orient), "Getting ready" (Prepare), "Logging" (Record), "Tip" (one-step tips), as drawn.
- **Q-41 → D-90 LOCKED** — Visible app-name literals outside onboarding go to a backlog entry (999.4), not Phase 39.
- **Q-42 — OPEN, re-asked.** The owner did not recognise "Orbit Status", "Orbit participation", "Orbit Center". Verified real UI labels: Orbit Status = Relationship Overview card (`src/components/profile/RelationshipOverview.tsx:64`; device screenshot `discovery-refresh/29`); Orbit participation = the Bound/Unbound control on Add/Edit Contact and import (`CreateContactScreen.tsx:531`, `EditContactScreen.tsx:1398`, `ImportReviewScreen.tsx:432`, `BulkImportSetupScreen.tsx:493`); Orbit Center = Settings → Appearance sun-occupant picker (`SettingsAppearanceScreen.tsx:957`). Owner confirmed "your active orbit" is the concept.

### Batch 9 — 2026-10-09 — Cluster: closing items

Owner answer (verbatim):
> for Q-42, yeah good to leave those as is, they're the idea, not the name. Lock D-36

- **Q-42 → D-91 LOCKED** — "Orbit Status", "Orbit participation", "Orbit Center" and "your active orbit" name the orbit concept, not the app; they stay literal and do not use `APP_NAME`. Scopes backlog 999.4.
- **D-36 PROVISIONAL → LOCKED** — Clear contextual teaching; avoid constant interruption and unnecessary "Not now".

#### Q-43 — Tutorial controls placement
- **Asked:** D-18 requires a global switch and Restart but no placement. Settings home rows today: Appearance, Contacts & Relationships, Interactions, Notifications, Orrery, Data & Backup, AI, About Orbit (+ Add widget) (`src/screens/settings-hub-model.ts:88-162`). A: new row "Tutorials", subtitle "Turn lessons on or off, or start them over", opening a small screen with the switch and Restart. B: inside About. C: inside Interactions. Recommendation (not a decision): A.
- **Answer (verbatim):**
  > Let's do option A here, but put it near the bottom of the options in settings please
- **Recorded:** D-92 LOCKED — A "Tutorials" row on the Settings home, near the bottom (just above About), opening a screen with the tutorials on/off switch (D-56) and "Restart tutorials" (D-57). Exact wording at planning.

### Batch 10 — 2026-10-09 — Cluster: audit confirmations

Owner answer (verbatim):
> Approve all. For Q-51 though, can we make sure we're not setting it to save as a fuel entry, I really need to rip fuel out of the app root and stem at this point. If memories still use fuel and I'm mistaken though, let's maybe add this item as a backlog entry. Doesn't make sense to rewire it to save as a real memory if that means it's a fuel entry which is going to get removed later. Can you confirm what memories uses here?

- **Q-44 → confirms D-16/D-53 (A)** — The intercept is a one-time exception: only the first in-app Quick Log pauses for the lesson card; every later Quick Log writes immediately. ⚠ AMENDS ADR-082 :18, ADR-132 :18/:23, phase-06 dossier :238/:361, phase-13 dossier :184, phase-01 dossier :268-272, phase-12 dossier :324, 34-CONTEXT D-08 (partial — one first-use pre-write card).
- **Q-45 → D-76 revised (A)** — While Compose's panel is on screen it is the only asker for that record: Yes, log it / No, don't log / Later (Later keeps it pending, like today's "Not yet"). The banner and pending list stay mounted, skip only that record while its panel shows, and keep their ADR-071 answer sets (Call keeps "No answer"). ⚠ SUPERSEDES 35-CONTEXT D-04 (partial — "coexist" for the one record while its panel shows); AMENDS 35-CONTEXT D-05, phase-14 dossier :179-187, 21-interaction-assist dossier :202-215. Phase 40 D-01 to be told D-76 constrains its lifecycle work.
- **Q-46 → confirms D-92 (A)** — ⚠ AMENDS ADR-140 :18 and phase-37 dossier :40-45 (a ninth top-level row, Tutorials, near the bottom).
- **Q-47 → confirms D-62 (A)** — Lesson progress and the on/off switch stay device-local; no backup-format change. ⚠ AMENDS ADR-057 :18, ADR-138 :18 (narrow exception for tutorial state).
- **Q-48 → confirms D-77 (A)** — Display-only fifth label; no status bucket, no progress, clock not started; ADR-011 and `status-engine.md:62` intact. ⚠ AMENDS phase-10 dossier :323-327.
- **Q-49 → confirms D-86, D-87 (A)** — ⚠ AMENDS phase-13 dossier :607 (first run only) and :97-100 §D.
- **Q-50 → D-78 REJECTED (A)** — Corrected evidence: the snackbar is 6000 ms for all snackbars (`snackbar-store.ts:38-41`). No Undo-window change; the Record lesson may mention Undo.
- **Q-51 — OPEN, re-asked with the fact the owner requested.** Verified: Memories are their own `memories` table (`src/db/memories-dao.ts:111` `INSERT INTO memories`; no fuel reference in the DAO); fuel is separate. Owner's conditional ("if memories still use fuel … backlog") resolves to "memories do not use fuel", so the choice between A (rewire Capture to save Memories) and B (drop the Share line + backlog) is re-asked.

### Batch 11 — 2026-10-09 — Cluster: Q-51 resolution

- **Asked:** Owner pivoted Q-51 to a new Things to Remember section for shared items (backlog 999.5, `9aae9f7e`; plus 999.6 move-between-sections). Re-asked: C — Phase 39 leaves Share → Capture unchanged and the Memory lesson drops its Share line; if 999.5 lands before 39 is planned, add a dated amendment. Recommendation (not a decision): C.
- **Answer (verbatim):**
  > I think we're aligned on all of this. Go ahead and write the dossier and the prompt for me please
- **Recorded:** D-93 LOCKED — as option C. ⚠ AMENDS D-23 (partial — the Capture/Share line). Flagged in the acceptance summary because the approval was given for the whole message.
- **Also from this exchange (not Phase 39 decisions; owner direction for the separate UX audit, recorded as N-16):** use the Pixel 6 Pro ("the target device really for this project"); creating test contacts is fine; export a backup before any wipe so the test harness can be restored; judge from the user's side only, not against old decisions ("We're not changing anything, we could always run the decision audit later"); propose fixes for easy-to-diagnose issues, pin bigger ones; run on Opus 5.5, medium reasoning, orchestrator and subagents; skip the widget and the Orrery and AI calls.

### Batch 12 — 2026-10-09 — Q-51 correction + draft acceptance

- **Answer (verbatim):**
  > Q-51: No, you misread me here. I want the memories sharing, or sharing in general really, included in the tutorials, that's why I want to do the audit before we dive into this, that's one obvious thing among I think many that we'll need to smooth over before making a tutorial for it. So put a pin in it basically, but it will be added to the tutorials eventually
  >
  > Context draft is approved otherwise.
- **Recorded:** D-93 revised (LOCKED) — Sharing into the app is taught in Phase 39 (Memory discovery line or its own lesson); content pinned until the UX audit and backlog 999.5 settle the flow, then set by a dated amendment before planning. No longer amends D-23. The Batch 11 reading ("drop the Share line") was wrong; recorded under Revisions.
- **Acceptance:** owner accepted `39-CONTEXT.draft.md` with this correction.

## Stage F audit — 2026-10-09

Two read-only subagents (code fact-check; recorded-decision collisions); load-bearing claims re-verified by the orchestrator.

**Code fact-check (fixed in the draft, mechanical):** Relationship Basics collapsed at `CreateContactScreen.tsx:223` (not :222); Compose panel `:1757-1786`, labels "Yes, log interaction" / "Not yet"; "Don't log" is `AssistBanner.tsx:140-150` → `markAssistDismissed`; bulk Quick Log is a separate `bulkQuickLog` path (`HomeScreen.tsx:1054-1058`); AsyncStorage holds more than permission flags; Orrery scope `orrery-system-logic.ts:91-92`; import entry `SettingsContactsScreen.tsx:126,315` + `ResumeImportPrompt.tsx:50`; History empty state `:1092-1110`; onboarding-style empty copy exists (`HomeScreen.tsx:1759`, `widget-render.tsx:527`).

**Evidence corrections that touch owner decisions (→ Batch 10):**
- **DISCREPANCY (verified)** — Snackbar dismiss is one fixed **6000 ms** timer for all snackbars (`src/stores/snackbar-store.ts:38-41`; test `snackbar-store.test.ts:78`). The device agent's "~3–5 s" was an estimate distorted by adb latency. D-78 was decided on the wrong number. → Q-50.
- **DISCREPANCY (verified)** — Share → Capture writes `fuel` with `kind: "topic"`, `source: "share"` (`CaptureScreen.tsx:273-276`). The Profile's knowledge read loads only `kind = 'off_limits'` fuel (`src/db/profile-knowledge-read.ts:259-266`); `knowledge-presentation.ts:337` is the Off Limits child. Topic fuel feeds only the ranked-fuel line (no live consumer), dashboard search and AI compose context. So shared captures do **not** appear in Things to Remember; the evidence row claiming they do was wrong. Migration 017 moved historical topic/share fuel into Memories. D-23's Capture mention would teach something untrue. → Q-51.

**Recorded decisions the draft changes without naming (→ Batch 10):**
- D-16/D-53 intercept: ADR-082 :18, ADR-132 :18 (+ :23 rejected a pre-write Quick Log step), phase-06 dossier :238, :361, phase-13 dossier :184, phase-01 dossier :268-272, phase-12 dossier :324, 34-CONTEXT D-08 — "Quick Log writes immediately", no second tap. → Q-44.
- D-76: 35-CONTEXT D-04 (:23, the Compose panel coexists with the global banner; "ESCALATE trip-wire") and D-05 (:24); phase-14 dossier :179-187 ([ Yes, log interaction ] [ Not yet ]); ADR-071 :18 answer sets (Call: Yes / No answer / Don't log; Text/Email: Yes / Don't log), 21-interaction-assist dossier :202-215, :245-262. Draft's "same three answers everywhere" would drop Call's "No answer". Phase 40 D-01 owns "Did you send it?" lifecycle heuristics (overlap, inform). → Q-45.
- D-92: ADR-140 :18 (eight fixed category routes) and phase-37 dossier :40-45 (top-level order). → Q-46.
- D-62: ADR-057 :18 and ADR-138 :18 (backups carry all non-secret preferences). → Q-47.
- D-77: phase-10 dossier :323-327 (four status labels); ADR-011 :18, :26 and `docs/systems/status-engine.md:62` (never-contacted has null status/progress; rejected running the clock from creation). → Q-48.
- D-86 / D-87: phase-13 dossier :607 (Add Contact success → new Profile) and :97-100 §D (only Identity open by default). → Q-49.
- Consistent: D-75 fulfils `docs/dossier/19-system-contact-import.md:281-292` ("tap to inspect", "long-press to multi-select"). 40-CONTEXT D-03's "frozen at v4" is stale (head v7); its rule matches D-62.

## Revisions

- 2026-10-09 — D-93 revised — owner correction (Batch 12): sharing IS taught; Batch 11's "drop the Share line" was a misreading of "I think we're aligned".
- 2026-10-09 — D-78 LOCKED → REJECTED — via Q-50 — decided on a wrong timing estimate; actual 6 s.
- 2026-10-09 — D-76 revised — via Q-45 — banner/pending list keep their own ADR-071 answers; panel is sole asker only while on screen.
- 2026-10-09 — D-36 PROVISIONAL → LOCKED — owner, Batch 9.
- 2026-10-09 — D-35 PROVISIONAL → resolved by D-88 — via Q-39.
- 2026-10-09 — D-18 amended by D-83 — via Q-34 — single-step tips have only "Got it".
- 2026-10-09 — D-58 amended by D-84 — via Q-35 — trigger-sheet exception.
- 2026-10-09 — D-37 PROVISIONAL → resolved by D-66 — via Q-18 — Orrery V2 shipped; owner chose a switcher-triggered Systems lesson.
- 2026-10-09 — D-38 PROVISIONAL → resolved by D-65 — via Q-17 — Orrery V2 shipped; owner chose the three-point Orrery step.

## Supersessions

| D-ID | Supersedes | Partial / full — what exactly | What survives |
|------|-----------|-------------------------------|---------------|
| D-34 | phase-06 dossier §O; stub contract `:57` | Partial — "first-run onboarding exposes an early choice/override" | Quick Log default; global Settings preference; both variants commit on threshold |
| D-50 | ADR-016 `:18` | Partial — Last Spoke defaults to Today | Today / Pick date / Not yet control; atomic create |
| D-51 | ADR-131 `:18`; phase-13 dossier §F `:150-152` | Partial — no-cadence → Unbound as the default outcome | Name-first creation; Unbound still choosable; cadence selection coordinates Bound |
| D-30 | phase-06 dossier `:262` `[DERIVED]` "Onboarding should teach … the tappable Favorite star" | Partial — Favourite-star teaching | Row-gesture teaching question stays open (cluster I) |

## Acceptance

- 2026-10-09 — draft accepted by owner ("Context draft is approved otherwise.") with the D-93 correction.
