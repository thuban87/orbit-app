# Phase 39: Onboarding - Context

**Gathered:** 2026-10-09 · **Status:** Accepted by the owner 2026-10-09. UX audit checked 2026-10-10; amendments D-94..D-100 recorded (ledger Batches 13–14). Planned after Phases 38.9–38.12, which build the audit items listed in D-100.

> **Dossier.** This CONTEXT is the authoritative phase dossier. The provenance (every question, the
> verbatim answer, the rationale and every revision) is in `39-LEDGER.md`. The research inputs are
> evidence, not approval: `docs/dossier/workpapers/phase-39-onboarding-journey-discovery.md`
> (145-candidate inventory), `docs/dossier/workpapers/phase-39-fresh-install-foundation-audit.md`
> (findings F01–F28, screenshots alongside), the legacy owner + ChatGPT ledger
> `docs/dossier/workpapers/phase-39-onboarding-design-decisions.md`, and the 2026-10-09 device refresh
> (`untracked/artifacts/39/discovery-refresh/`, local only).
> - **Baseline:** current-state claims are verified against `main @ 19caf50c` unless labelled LIKELY.
> - **Before planning:** the owner runs the UX audit (`.planning/ux-audit/UX-AUDIT-PROMPT.md`) first. Its findings are checked against this dossier, and D-93's sharing lesson is set, by dated amendments (D-94+).
> - **Design reference:** the accepted mockup `39-WORKPAPER-mockup/onboarding-mockup.html` (D-74).
> - **Authoritative contract:** this file. Record any new rulings here as dated `[DECIDED]` entries
>   with new D-IDs (D-94+), and in the ledger.
> - **Decision dates:** D-01..D-33 are owner + ChatGPT decisions recorded in the legacy ledger before
>   2026-10-08, without dates; they are tagged `[DECIDED · ≤2026-10-07]`.

<domain>
## Phase Boundary

**Objective:** Give a new user a short guided start (Welcome → add a first person → a four-step
tour of Digest, Contacts, Orrery and the + button) and then teach the core relationship loop
(Orient → Prepare → Reach Out → Record) and a few unusual features at the moment the user first
meets them, through one small, accessible, skippable lesson system. Today a fresh install lands on
an empty Digest with no welcome, no acquisition choice and no teaching (audit F01/F02). Before the
lessons that depend on them, fix the product behaviours the lessons would otherwise have to
explain away.

**In scope**
- The lesson system: lesson registry, trigger points, one-at-a-time coordinator, device-local state,
  global switch, Restart, accessible presenter (D-11, D-18, D-32, D-54..D-62, D-64, D-83..D-85).
- First run: Welcome, Acquire (manual / import / "Restoring from a backup?"), the Add Contact tip,
  Orient with its adapted variant, release to Digest (D-08..D-10, D-52, D-61, D-63, D-65, D-68,
  D-70, D-71, D-81, D-86, D-88).
- Progressive lessons: Prepare, Reach Out (incl. first Transmit), Record (incl. the Quick Log
  intercept on every in-app entry), Memory (with Share/Capture mention), Categories, Group Log,
  Notifications enablement, Systems, History hint, AI guided setup, first AI-enabled Compose
  (D-14..D-16, D-20, D-21, D-23, D-24, D-26, D-28, D-34, D-53, D-66, D-67, D-69).
- Settings → Tutorials screen (D-92).
- Prerequisite product fixes: manual-create defaults and visible Relationship Basics (D-04, D-50,
  D-51, D-87), possible-match tap (D-06, D-75), one "Did you send it?" model (D-07, D-76),
  not-contacted-yet Orbit Status (D-77).

**Out of scope**
- A tutorial for any feature the triage ruled out (D-25, D-27, D-29..D-31): current-state fields,
  Key People, Off Limits, Custom Fields, Capture workflow, advanced interaction management, Widget,
  event reminders, Backup/Restore, Archive/delete/recovery, Favourite/Snooze/Mute, reconciliation,
  Appearance, Profile presentation, Settings navigation, accessibility support.
- Any AI mention in core onboarding (D-19); speculative AI features (D-21).
- A detailed History-navigation walkthrough (D-42).
- Analytics or telemetry of any kind (D-49).
- Appearance choice and backup prompt in first run (D-72, D-73); newsletter signup (D-39).
- Milestone 3 launch-pipeline work: feedback routes, announcements, data-loss messaging (D-40, D-41).
- Inline Memory/Off Limits inputs and Fuel-editor retirement (backlog 999.3); app-name literals
  outside onboarding (backlog 999.4, D-90, D-91).
- Orrery/Systems builder issues seen on device (N-10 in the ledger): Systems builder "0 members" with
  all filters Any; Archive without confirmation.

**Preserved behavior**
- Galaxy + Follow System first-launch appearance (D-43).
- Message / Call / In Person vocabulary; the Channel default never governs Group Log (D-44).
- Notification permission only on enabling reminders (D-45).
- Custom Endpoint stays Advanced; the existing AI first-use disclosure stays the data-path
  disclosure (D-46, D-47).
- No permanent in-list gesture tutorial (D-48).
- Import keeps its explicit participation choice and Unbound default (D-05).
- Quick Log stays the default right-swipe action; the Settings preference stays (D-34).
- All product functionality works with tutorials off or skipped (D-01, D-18).
</domain>

<decisions>
## Implementation Decisions

### Preserved behavior (carried)
- **D-43 [informational]:** [CARRIED · phase-02 dossier :38-40; 23-CONTEXT D-10] First-launch appearance stays Galaxy + Follow System (`src/db/migrations/015-theme-settings.ts:32-40`). Onboarding does not change it.
- **D-44 [informational]:** [CARRIED · phase-13 dossier :692-694, D-13-177] Any lesson that names logging channels uses Message / Call / In Person, never Text / Email / Other, and never implies the Channel default governs Group Log.
- **D-45 [informational]:** [CARRIED · ADR-041 :18, :24] Notification permission is requested only when the user enables reminders (`SettingsNotificationsScreen.tsx:177-185`), never at first launch.
- **D-46 [informational]:** [CARRIED · phase-16 dossier :263, D-16-039] Custom Endpoint is an Advanced AI path, not part of guided setup.
- **D-47 [informational]:** [CARRIED · ADR-079; phase-16 §AG] The existing AI first-use disclosure (`src/components/AIFirstUseDisclosure.tsx:22`, shown at `SettingsAIScreen.tsx:293`) remains the data-path disclosure. AI setup builds on it and does not duplicate it.
- **D-48 [informational]:** [CARRIED · phase-06 dossier :350] No permanent in-list gesture tutorial.
- **D-49 [informational]:** [CARRIED · CLAUDE.md "Local-first is a product commitment"] Tutorial state, completions and skips stay on the device. No analytics, telemetry or remote lesson delivery.

### Principles
- **D-01:** [DECIDED · ≤2026-10-07] Onboarding is contextual and progressive: decisive at a feature's meaningful first encounter, never required to use the product, no giant up-front tour. (legacy ledger §3)
- **D-02:** [DECIDED · ≤2026-10-07] Lessons teach stable product behaviour; they never substitute for fixing confusing UX. (legacy §3)
- **D-36:** [DECIDED · 2026-10-09] Prefer clear contextual teaching over transient toasts; avoid constant interruption and unnecessary "Not now" choices. (legacy §3, locked by owner Batch 9)
- **D-13:** [DECIDED · ≤2026-10-07] The mental model taught is Orient → Prepare → Reach Out → Record → updated state → Orient. It is conceptual; no stage is forced. (legacy §6)
- **D-79:** [DECIDED · 2026-10-09] Every onboarding string that names the app interpolates `APP_NAME` (`src/constants/app.ts:23`, sourced from `app-name.json`). No literal app name in lesson, Welcome or Acquire copy. (owner instruction)
- **D-90 [informational]:** [DECIDED · 2026-10-09] App-name literals outside onboarding (e.g. `ABOUT_APP_NAME` at `src/screens/settings-about-model.ts:29`, the Contacts header at `HomeScreen.tsx:1797`) are not this phase's work; they go to backlog 999.4. (owner, Q-41; informational because no Phase 39 plan implements it)
- **D-91:** [DECIDED · 2026-10-09] "Orbit Status", "Orbit participation", "Orbit Center" and "your active orbit" name the orbit concept, not the app; lesson copy quoting them keeps them literal. (owner, Q-42)

### Prerequisite product fixes
- **D-03:** [DECIDED · ≤2026-10-07] Each prerequisite fix lands before the lesson that depends on it. This is a dependency rule, not a plan order. (legacy §4)
- **D-04:** [DECIDED · ≤2026-10-07] Manual Add Contact defaults change from Unbound + Today to Bound + Not Yet; made precise by D-50 and D-51. (legacy §4)
- **D-50:** [DECIDED · 2026-10-09] Manual Add Contact defaults Last spoke to **Not yet**. The Today / Pick date / Not yet control stays; choosing Today or a date still writes the first interaction atomically. (owner, Q-02) ⚠ SUPERSEDES ADR-016 (partial — "A normal create defaults last-spoke to today", `ADR-016 :18`)
  - Today (`CreateContactScreen.tsx:203`) the hidden Today default silently writes an "unspecified" interaction (audit F08/F09; device screenshot 24).
- **D-51:** [DECIDED · 2026-10-09] Manual Add Contact defaults to **Bound with Monthly selected**, visible and editable; Name stays the only required field; the user can still choose Unbound or another frequency. (owner, Q-03) ⚠ SUPERSEDES ADR-131 (partial — "No cadence creates an Unbound contact" as the default outcome, `ADR-131 :18`) and phase-13 dossier §F :150-152 (partial — Unbound as the default).
  - Today `trackingEnabled` starts false and `intervalDays` null (`CreateContactScreen.tsx:200-202`). Bound creation requires a valid cadence (audit F10).
  - Fix the stale header claim at `CreateContactScreen.tsx:15-17` with this change.
- **D-94:** [DECIDED · 2026-10-10] On Add Contact, Last spoke "Not yet" looks selected when it is chosen, like Today and Pick date, as the mockup draws it. Needed because D-50 makes it the default. (owner, Batch 13 Q1; UX audit E-13) ⚠ AMENDS 34-UI-SPEC :115 and `TriStateLastSpoke.tsx:101-110` ("Not yet" muted even when selected).
- **D-87:** [DECIDED · 2026-10-09] Add Contact shows the Relationship Basics section open, with Last spoke, Orbit participation and Frequency all visible, as in the mockup. (owner, Q-38; confirmed Q-49) ⚠ AMENDS phase-13 dossier §D :97-100 (only Identity open by default). Today the section starts collapsed (`relationship: false`, `CreateContactScreen.tsx:223`).
- **D-05:** [DECIDED · ≤2026-10-07] Import keeps its explicit participation choice and its Unbound default; it does not inherit D-51. (legacy §4)
- **D-06:** [DECIDED · ≤2026-10-07] Possible-match review gets an obvious normal resolution path; an undisclosed long-press is not required. Made precise by D-75. (legacy §4)
- **D-75:** [DECIDED · 2026-10-09] On "Review matches", tapping a candidate opens Link to Existing / Import as New / Skip for that one person. Long-press keeps starting multi-select. (owner, Q-26)
  - Today the tap handler is a no-op (`DuplicateReviewScreen.tsx:322,358` pass `onInspect={() => undefined}`; `CandidateCardGrid.tsx:204-207`). Action labels at `CandidateCardGrid.tsx:87-89`.
- **D-07:** [DECIDED · ≤2026-10-07] Compose's local "Did you send it?" and the global Assist confirmation become one coherent outcome model before Reach Out teaching. Made precise by D-76. (legacy §4)
- **D-76:** [DECIDED · 2026-10-09] One "Did you send it?" at a time. While Compose's panel is on screen after a handoff, it is the only surface asking about that pending record, with **Yes, log it / No, don't log / Later** (Later keeps it pending, like today's "Not yet"). The app-wide AssistBanner and PendingConfirmationsSheet stay mounted, skip only that record while its panel shows, and keep their own ADR-071 answer sets (Call keeps "No answer"). If the user leaves Compose unanswered, they ask as today. (owner, Q-27, revised Q-45) ⚠ SUPERSEDES 35-CONTEXT D-04 (partial — "coexist" for that one record while its panel shows); AMENDS 35-CONTEXT D-05, phase-14 dossier :179-187, 21-interaction-assist dossier :202-215.
  - Phase 40 (40-CONTEXT D-01 owns "Did you send it?" lifecycle heuristics) must treat D-76 as a constraint.
  - Today the panel is ADDITIVE to the global surfaces (`ComposeScreen.tsx:21-25`), offers "Yes, log interaction" / "Not yet" only (`:1757-1786`), and "Not yet" just closes it (`:1152-1156`); "Don't log" exists only on the global surfaces (`AssistBanner.tsx:140-150`, `markAssistDismissed`). Yes on either surface calls `markAssistLogged` on the same record (`ComposeScreen.tsx:1094`, `AssistBanner.tsx:108`, `interaction-assist-dao.ts:91`).
- **D-77:** [DECIDED · 2026-10-09] A Bound contact with no interaction yet shows a distinct not-contacted-yet Orbit Status, not "Not tracked — Set a contact frequency to see Orbit Status." Exact copy at planning. It is display-only: no status bucket, no progress, the clock does not start, so ADR-011 :18/:26 and `docs/systems/status-engine.md:62` stay intact. (owner, Q-28; confirmed Q-48) ⚠ AMENDS phase-10 dossier :323-327 (a fifth Orbit Status label).
  - Cause: `resolveProfileStatus` returns "Not tracked" when `lastContact === null` even with a cadence (`src/services/profile-metrics.ts:154-167`). Under D-50/D-51 this is every new manual contact's state (device screenshot 29).

### Audit prerequisites homed in Phases 38.9–38.12 (do not redo here)
- **D-100:** [DECIDED · 2026-10-10] The UX audit's fix-before-the-lesson items (class A, 39-LEDGER Batch 13) are built in the inserted fix phases that own their area, not in Phase 39. Phase 39 consumes them: its planner checks each one has landed (D-03) and adds no plan for it. If one has not landed when 39 is planned, raise it with the owner rather than rebuilding it here. (owner, Batch 14 R2)

  | Audit item | What is fixed | Lesson it unblocks | Built in |
  |---|---|---|---|
  | E-01 | Add Contact Back warns before discarding typed work | first-run Add (frame 03), D-86 | 38.9 |
  | F-01 | Log Interaction Back warns before discarding | Record (D-16) | 38.9 |
  | E-02 | Save with an empty name says why and moves to the field | first-run Add | 38.9 (inline validation standard) |
  | A-02 | An old search no longer survives app close with the box hidden | Orient Contacts (D-71, D-81) | 38.11 |
  | A-23 | After a right swipe the row no longer stays open on a dead "Log" panel | D-71, D-53 | 38.11 |
  | F-05 | Bulk "Log Interaction" with 2+ selected is labelled Group Log | Group Log (D-26) | 38.11 |
  | J-01 | Compose shows the channel Transmit will actually use | Reach Out (D-15) | 38.11 |
  | (triage) | List-row TalkBack action named for what it runs (Quick Log vs Log Interaction) | D-71, D-16 | 38.11 |
  | G-11 | Saving from + → Memory no longer lands on another person's Profile | Memory (D-23) | 38.10 |
  | I-01, I-04 | Cold-start share not covered by resume prompts; share confirms with Undo | sharing (D-99) | 38.10 |
  | K-36 | AI connection screen reflects a completed OpenRouter connection | AI setup (D-20, D-69) | 38.12 |

  - **Stay in Phase 39** (its own prerequisite plans): D-50/D-51/D-87 + D-94 (with audit E-05, E-13), D-75 (with H-02, H-03), D-76 (with J-02, J-05, J-08), D-77 (with D-09), and D-95..D-98.
  - Full finding → phase map: `.planning/ux-audit/FINDINGS-ASSIGNMENT.md`.

### First run
- **D-08:** [DECIDED · ≤2026-10-07] First run is Welcome → Acquire → Orient → normal app. At least one person is acquired before Orient. (legacy §5)
- **D-70:** [DERIVED] Welcome and Acquire are full-screen focused routes with the tab bar hidden, following `FOCUSED_WORKFLOW_ROUTES` (`src/navigation/focused-route-classification.ts:7`) and phase-01 dossier :136-141. Orient runs over the normal shell because it points at the tabs. (derived; owner may veto)
- **D-09:** [DECIDED · ≤2026-10-07] Welcome is short, with **Get Started** and **Skip Tutorials**; no carousel or feature tour. Framing (draft copy): "Relationships are an n-body problem. {APP_NAME} helps you keep the people in your life organized, remember what matters, and know when it's time to reconnect." (legacy §5)
- **D-88:** [DECIDED · 2026-10-09] Welcome includes the line "No account needed. What you add is stored on this phone." Resolves the earlier provisional D-35. (owner, Q-39)
- **D-10:** [DECIDED · ≤2026-10-07] Acquire offers **Add someone manually** and **Import from Contacts**, teaches only the chosen path, and leaves the other path not introduced for a later intentional encounter. Import's later encounter is in Settings → Contacts, its only entry (`SettingsContactsScreen.tsx:315`). (legacy §5)
- **D-63:** [DECIDED · 2026-10-09] Acquire carries a secondary "Restoring from a backup?" entry into the existing restore flow. Restore is not taught (D-30 stands). (owner, Q-30)
- **D-96:** [DECIDED · 2026-10-10] A restore started from Acquire runs full-screen, with no tab bar and no + button. When it finishes, a restore that brought people in lands on Digest and starts Orient (D-86, D-62); one that brought nobody returns to the Acquire choice (D-61). Outside first run the restore flow is unchanged. (owner, Batch 13 Q4; UX audit K-19, K-20) ⚠ AMENDS D-63 (partial — how the entry runs and where it ends).
- **D-11:** [DECIDED · ≤2026-10-07] Lesson state is distinct from workflow state. Cancelling Import does not mean "never teach Import"; denying permission is not a skip; a partial import is not completion. (legacy §5)
- **D-61:** [DECIDED · 2026-10-09] Until a person is acquired, a restore brings in people, or the user taps Skip Tutorials, first run resumes at the Acquire choice on every launch (Welcome is not repeated). Cancelled import or denied permission returns to the choice, with manual add available. (owner, Q-14)
- **D-52:** [DECIDED · 2026-10-09] First-run Import teaching covers Import's participation (Bound/Unbound) step and its consequence: tracked people appear in Digest and the Orrery. If acquisition yields nobody Bound, Orient runs an adapted version that explains Unbound and shows how to start tracking someone instead of touring empty screens. (owner, Q-04)
  - Digest, Contacts populations and the Orrery's All Contacts all scope to `archived_at IS NULL AND tracking_enabled = 1` (`src/logic/dashboard-query-logic.ts:219-220`; `src/logic/orrery-system-logic.ts:91-92`).
- **D-86:** [DECIDED · 2026-10-09] In first run, saving the first person (or finishing a first-run import) lands on Digest and Orient starts there. Outside first run, Create's existing landing on the new Profile (`CreateContactScreen.tsx:394`) is unchanged. (owner, Q-37; confirmed Q-49) ⚠ AMENDS phase-13 dossier :607 (first run only).
- **D-12:** [DECIDED · ≤2026-10-07] Orient teaches three lenses conceptually: Digest (Up Next / Horizon / Your Week), Contacts, Orrery. No metric, filter, History or Contacts feature tour. A Bound + Not Yet person appears in Horizon's "Never Contacted" list (`src/components/digest/HorizonSection.tsx:143-144`), not in the default Active population. (legacy §5)
- **D-71:** [DECIDED · 2026-10-09] Orient's Contacts step includes "Swipe someone right to log, left to edit." stated with its non-gesture equivalent (the row's TalkBack actions, `ListRow.tsx:234`). Fulfils phase-06 dossier :260 (D-06-072). (owner, Q-21)
- **D-81:** [DECIDED · 2026-10-09] When the Contacts list shows no rows (only Bound + Not Yet people: "Everyone's tucked away"), the swipe line reads "When people appear here, swipe right to log, left to edit." No sample or fake row. (owner, Q-32)
- **D-95:** [DECIDED · 2026-10-10] The Contacts list's default population stays "Active Contacts", but it becomes a real, labelled choice in the Population menu, shown selected by default. "Nothing selected" no longer means a hidden population. Keeps ADR-093 and the premise of D-12 / D-81. (owner, Batch 13 Q2; UX audit A-04) ⚠ AMENDS phase-05 dossier :235 (partial — Active Contacts not listed as a menu option).
  - Today the empty selection silently shows "Active Contacts" (`src/components/control-surface/control-labels.ts:17`; migration 019 default `'[]'`).
- **D-98:** [DECIDED · 2026-10-10] On the "Everyone's tucked away" empty state, "N not yet contacted →" becomes a real button that shows those people, and the state gains a line for Unbound people that opens Unbound Contacts. This fixes D-81's target and gives the adapted Orient (D-52) something to point at. Exact copy and the button's destination screen are set at planning. (owner, Batch 13 Q6; found in triage, not in the audit)
  - Today the line is plain text with no press handler and Unbound people are not counted (`HomeScreen.tsx:1734-1755`).
- **D-65:** [DECIDED · 2026-10-09] Orient's Orrery step teaches: each person orbits you; position clockwise from the top shows how far into their check-in cycle they are, and the ring style shows status (solid Stable, dashed Wobble, faded Decay); tap someone to focus them and open their profile. Plus "New people start at the top until you log a conversation." and "Pinch and drag to explore", with the "Contacts in this System" list as the non-gesture route. The adapted Orient (D-52) says the Orrery shows tracked people and how to start tracking. Resolves the earlier provisional D-38. (owner, Q-17)
  - Encodings: `progressToAngle` 0 at 12 o'clock, clockwise (`src/logic/orrery-geometry-logic.ts:29-36`); ring styles `src/logic/orrery-ring-logic.ts:55-100`; never-contacted bodies at angle 0 (`src/logic/orrery-world-logic.ts:148-151`).
- **D-22:** [DECIDED · ≤2026-10-07] The Orrery has a visual-orientation role beside Digest and Contacts; the old renderer supplies no teaching requirements. (legacy §11)
- **D-17:** [DECIDED · ≤2026-10-07] The + button is taught as the place to add, update and record (Add Contact, Quick Log, Log Interaction, Group Log, Update Contact, Memory), without implying one commit behaviour. Import is not a + action. (legacy §8)
- **D-68:** [DECIDED · 2026-10-09] The + button lesson is Orient's final step, including in adapted Orient, and replays with Orient after Restart. (owner, Q-20)

### Progressive lessons
- **D-14:** [DECIDED · ≤2026-10-07] **Prepare** triggers on the first meaningful normal Profile visit after first run (not one reached by creating, importing or merging someone). It covers Relationship Overview, Things to Remember (emphasised: knowledge about the person versus interactions with them), Contact Methods and History, and notes that sections start closed. It does not teach Memory types, Key People, Off Limits, custom fields, pin/hide/outdated, Gravity/Intensity, History lenses, AI permissions or layout. (legacy §7)
  - All four sections start collapsed in the factory layout (`src/profile/presentation-schema.ts:124-128`).
- **D-33:** [DECIDED · ≤2026-10-07] Basic History concepts stay in Prepare and Record. (legacy §13)
- **D-15:** [DECIDED · ≤2026-10-07] **Reach Out** triggers on the first normal Compose entry: the editor is where a message is prepared; Things to Remember can be consulted without losing the draft; Copy versus Transmit; on first Transmit, a one-time explanation that the app hands the prepared message to another Android app and the user does the sending. The outcome question belongs to the D-76 model. Direct Call/Text/Email need no walkthrough. No AI in any form. (legacy §7)
- **D-16:** [DECIDED · ≤2026-10-07] **Record** triggers on the first intentional logging action, never automatically after Reach Out. Quick Log first: intercept before the write, explain that it saves immediately and that Log Interaction adds details first; both **Log it** and **Skip** continue the original Quick Log. Log Interaction first: explain nothing saves until Save and that Quick Log is the fast alternative. Assist answers are another entry into the same model, with no separate lesson. Close the loop: recording updates history, relationship state and what the app surfaces next. Excludes fields, backdating, Add Note, Memory conversion, History navigation, edit/delete, group semantics and AI. (legacy §7; owner confirmed the one-time pre-write card, Q-44) ⚠ AMENDS ADR-082 :18, ADR-132 :18/:23, phase-06 dossier :238/:361, phase-13 dossier :184, phase-01 dossier :268-272, phase-12 dossier :324, 34-CONTEXT D-08 (partial — only the first in-app Quick Log pauses for a one-time card; every later Quick Log writes immediately).
- **D-34:** [DECIDED · 2026-10-09] No right-swipe preference choice in first run. Record mentions that swiping right uses the configured default (Quick Log unless changed) and that Settings → Interactions changes it. (owner, Q-01) ⚠ SUPERSEDES phase-06 dossier §O :230 and 27-CONTEXT D-09 (partial — "First-run onboarding exposes an early choice/override").
- **D-53:** [DECIDED · 2026-10-09] The Quick Log intercept fires on whichever in-app Quick Log entry the user uses first: + button, Contacts row swipe (when the preference is Quick Log), grid card, card context menu, row and grid TalkBack actions, bulk Quick Log. Widget mark, notification Mark and Assist confirmations never trigger it. (owner, Q-05)
  - Entries: `UniversalFab.tsx:268-273`, `HomeScreen.tsx:593-598,627-642,1998,2034`, `ListRow.tsx:234`, `GridCard.tsx:191` reach `runQuickLog` (`src/services/quick-log-command.ts:131`); bulk Quick Log is a separate path (`HomeScreen.tsx:1054-1058,1156` → `bulkQuickLog`, own snackbar).
- **D-23:** [DECIDED · ≤2026-10-07] **Memory**: a small lesson at the first deliberate Memory creation: a Memory is reusable knowledge about the person shown in Things to Remember, briefly distinct from an interaction note; it also points to sharing from other apps once D-93's content is set. No full walkthrough. (legacy §13; sharing scope per D-93)
- **D-93:** [DECIDED · 2026-10-09] Sharing into the app from other Android apps (Android Share → the app) **is taught** in Phase 39, as part of the Memory lesson's discovery line or a lesson of its own. Its exact content is pinned until the pre-planning UX audit and backlog 999.5 (a Things to Remember section for shared items, with optional reminders) settle how sharing works; it is then set by a dated amendment to this dossier before planning. Lessons teach stable behaviour (D-02), so today's flow is not taught as is. (owner, Q-51 as corrected 2026-10-09)
  - Today shared items are written as `fuel` `kind: "topic"` (`CaptureScreen.tsx:273-276`) and the Profile reads only `off_limits` fuel (`src/db/profile-knowledge-read.ts:259-266`), so they are not visible in Things to Remember.
- **D-99:** [DECIDED · 2026-10-10] Sets D-93's content. A share goes to a person **and a chosen Things to Remember section** (owner's examples: an Amazon link → Gift Ideas; an article about something you discussed → Last Talked About; a joke to tell them → a new "Thought of Them" section). The sharing lesson teaches that flow. It depends on the separate fuel-retirement phase, which gives each former fuel kind its own place on the Profile and moves shares off `fuel` (owner, Batch 13; owner direction Batch 10: "rip fuel out of the app root and stem"). Under D-03 that phase lands before the sharing lesson is built; the section list and exact copy are set there. ⚠ AMENDS D-27 (partial — sharing into a section is taught; the rest of the Capture workflow is not) and D-23 (the discovery line points at the new flow).
  - Before the lesson, the share flow must also confirm what it saved with Undo (audit I-04) and must not open under a resume prompt that Back cannot close (audit I-01).
- **D-24:** [DECIDED · ≤2026-10-07] **Categories**: a small lesson on their organising purpose and reuse across contacts; no CRUD, reorder or delete teaching. (legacy §13)
- **D-26:** [DECIDED · ≤2026-10-07] **Group Log**: a small lesson at the first deliberate Group Log: one shared event records an interaction with several people; choose participants; shared details apply to all; participant interactions are recorded. No advanced management. (legacy §13)
- **D-28:** [DECIDED · ≤2026-10-07] **Notifications**: a small lesson when the user deliberately enables them: reminders can appear outside the app, they are optional, Settings controls them, and Android asks permission because the user chose this. No tour of types or timing. (legacy §13)
- **D-66:** [DECIDED · 2026-10-09] **Systems**: a one-step tip the first time the System switcher ("Choose System") opens: a System is a saved view of who appears in the Orrery; built-in and per-category Systems exist already; make your own in Manage Systems. No builder walkthrough. Resolves the earlier provisional D-37. (owner, Q-18)
- **D-67:** [DECIDED · 2026-10-09] **History hint**: a one-step tip the first time History is open with its activity chart showing: "Tap any day in the chart to jump to it." (owner, Q-19) Resolves `38.8-CONTEXT.md:48,313`.
- **D-19:** [DECIDED · ≤2026-10-07] AI is absent from core onboarding and from Reach Out. The core workflow is fully usable without AI. (legacy §10)
- **D-20:** [DECIDED · ≤2026-10-07] **AI guided setup** runs when the user deliberately enables AI or enters AI setup. It covers only what the provider architecture needs (provider, credentials, model, validation as applicable) and states accurately that AI is optional, that using it may send permitted context to the configured provider, and that the user controls eligibility where supported. No invented guarantees. (legacy §10)
- **D-69:** [DERIVED] AI guided setup leads with the connection the product already labels "Recommended": OpenRouter via "Connect with OpenRouter" sign-in (`src/screens/AIConnectionScreen.tsx:357-372`, expanded by default `:64-66`), with OpenAI / Anthropic / Google key connections as alternatives. Discharges phase-16 dossier :959 ("may promote OpenRouter") without redefining the architecture. (derived; owner may veto)
- **D-21:** [DECIDED · ≤2026-10-07] The first AI-enabled Compose use gets a small drafting/revision introduction. No re-teaching of Compose or setup, and no lessons for speculative AI features. (legacy §10)

### Not taught
- **D-25:** [DECIDED · ≤2026-10-07] No lesson for current-state fields, Key People, Off Limits or Custom Fields. (legacy §13)
- **D-27:** [DECIDED · ≤2026-10-07] No lesson for the Capture workflow or for backdating, editing/deleting interactions, conversion to group events or participant corrections. (legacy §13)
- **D-29:** [DECIDED · ≤2026-10-07] No Widget or event-reminder lesson. (legacy §13)
- **D-30:** [DECIDED · ≤2026-10-07] No lesson for Backup/Restore, Archive, Recently Deleted, Restore, permanent delete, Favourite, Snooze, Mute or reconciliation/merge. ⚠ SUPERSEDES phase-06 dossier :262 (partial — `[DERIVED]` "Onboarding should teach … the tappable Favorite star"). (legacy §13)
- **D-31:** [DECIDED · ≤2026-10-07] No lesson for Appearance, Profile presentation, Settings navigation or accessibility support. (legacy §13)
- **D-72:** [DECIDED · 2026-10-09] No appearance choice in first run (phase-02 dossier :38-40 "may" declined). (owner, Q-22)
- **D-73:** [DECIDED · 2026-10-09] No backup prompt in first run (15-backup dossier :52-53 "and/or" declined). (owner, Q-24)

### Lesson state and controls
- **D-18:** [DECIDED · ≤2026-10-07] First run offers **Skip Tutorials**; every multi-step lesson and the Quick Log intercept offer **Skip**; Skip never blocks the underlying action. Settings can turn tutorials off, back on, and restart them; per-lesson state, the global switch and Restart are distinct. (legacy §9; amended by D-83)
- **D-54:** [DECIDED · 2026-10-09] Skipping a lesson marks it done; it is not offered again unless the user restarts tutorials. (owner, Q-06)
- **D-55:** [DECIDED · 2026-10-09] Welcome's **Skip Tutorials** ends first run and turns tutorials off globally. (owner, Q-07)
- **D-56:** [DECIDED · 2026-10-09] Turning tutorials off pauses all lessons without changing per-lesson state; turning them back on resumes only lessons never completed or skipped. (owner, Q-08)
- **D-57:** [DECIDED · 2026-10-09] **Restart tutorials** resets every lesson to unseen and turns tutorials on if they were off; Orient replays on the next app open; Welcome and Acquire do not replay. No per-lesson replay list. (owner, Q-09; "turns tutorials on" is a derived reading the owner may veto)
- **D-58:** [DECIDED · 2026-10-09] At most one lesson is active. A lesson never starts while a form, sheet, dialog or Assist question is open (exception D-84); it stays eligible for its next matching moment. Lessons are not chained back-to-back. (owner, Q-11)
- **D-84:** [DECIDED · 2026-10-09] A lesson may attach to the sheet whose opening is its own trigger (the Systems tip on "Choose System"). ⚠ AMENDS D-58 (partial). (owner, Q-35)
- **D-97:** [DECIDED · 2026-10-10] Widens D-84: a lesson may show on the form or sheet whose opening is its own trigger, including the Add Contact tip (frame 03), the Log Interaction lesson (D-16) and the Memory lesson in the Memory and post-log note editors (D-23). A lesson still never starts over a different form, sheet, dialog or Assist question. (owner, Batch 13 Q5) ⚠ AMENDS D-58, D-84 (partial).
- **D-59:** [DECIDED · 2026-10-09] Backgrounding pauses and resumes the active lesson. Process death or leaving the lesson's screen returns it to unseen, not skipped. (owner, Q-12)
- **D-60:** [DECIDED · 2026-10-09] A lesson is done when the user reaches its end or skips it, whether or not the underlying workflow is saved. First-run Acquire keeps D-11 / D-61. (owner, Q-13)
- **D-62:** [DECIDED · 2026-10-09] Lesson state is device-local, like `backupNudgeDismissed`, and is excluded from backup and export (`getPortableSettingsSnapshot` allowlist, `src/db/app-settings-dao.ts:886-971`). No backup-format change (`BACKUP_FORMAT_VERSION = 7`, `src/backup/types.ts:14`). A restore that brings in at least one person completes first run. (owner, Q-15; confirmed Q-47) ⚠ AMENDS ADR-057 :18, ADR-138 :18 (narrow exception — tutorial state, including the on/off switch, is not backed up).
- **D-64:** [DECIDED · 2026-10-09] Editing a lesson's wording keeps its identity (users who finished it don't see it again). A materially new lesson gets a new identity and is offered under the normal rules. Nothing re-shows automatically. (owner, Q-16)
- **D-92:** [DECIDED · 2026-10-09] A **Tutorials** row on the Settings home, near the bottom (just above About), opens a screen with the tutorials on/off switch and **Restart tutorials**. Exact wording at planning. (owner, Q-43; confirmed Q-46) ⚠ AMENDS ADR-140 :18 and phase-37 dossier :40-45 (a ninth top-level row). Hub rows today: `src/screens/settings-hub-model.ts:88-162`.

### Presentation
- **D-74:** [DECIDED · 2026-10-09] The HTML mockup `39-WORKPAPER-mockup/onboarding-mockup.html` is the visual reference: one complete first run plus four lesson entrances in four patterns (full-screen page, spotlight steps, intercept card, one-step tip). Its copy is draft. (owner request)
- **D-80:** [DECIDED · 2026-10-09] Lesson cards are opaque cards on the elevated surface token with a strong border and a pointer toward the target, not the glassy treatment. (owner, Q-31)
- **D-82:** [DECIDED · 2026-10-09] Spotlight tours dim the screen strongly (mockup: ~80%) with a cutout around the target; tips over an open panel or chart dim lightly (mockup: ~50–55%). Final values come from theme tokens at planning. (owner, Q-33)
- **D-83:** [DECIDED · 2026-10-09] One-step tips show a single **Got it**, which records the tip done. ⚠ AMENDS D-18 (partial — Skip is not shown on single-step tips). (owner, Q-34)
- **D-85:** [DECIDED · 2026-10-09] Multi-step lessons show "Step n of N" with small progress bars, plus Back / Next / Skip (Done on the last step). (owner, Q-36)
- **D-89:** [DECIDED · 2026-10-09] Card labels: "Getting around" (Orient), "Getting ready" (Prepare), "Logging" (Record), "Tip" (one-step tips). (owner, Q-40)
- **D-32:** [DECIDED · ≤2026-10-07] The lesson system is accessible: each card is a labelled dialog that takes screen-reader focus and returns it sensibly; the card text names what the spotlight points at; Skip / Next / Back / Got it are reachable; no step needs a gesture; reduced motion removes spotlight animation (`src/theme/use-reduced-motion.ts`); text scales with system font size; tokens meet contrast. (legacy §13)

### Claude's Discretion
- Final lesson copy, within each decision's intent and the mockup's draft wording; owner sees it at the device sign-off.
- Lesson system shape (recommended, shown to the owner 2026-10-09; ledger N-14): one typed lesson registry (each lesson is data: identity, trigger, steps with copy and anchor); one shared accessible presenter; Welcome and Acquire as real routes; screens wrap targets in an anchor component; entry points call one trigger function that runs the original action whether or not a lesson shows (D-16, D-53); a coordinator applies D-54..D-60 and D-84; eligibility logic is pure and unit-tested. Planning may refine this.
- How a "normal" Profile visit is detected for D-14 (Profile params are only `{contactId, openReachOut?}`, `src/navigation/types.ts:14-17`; Create, import review and merge all land on a plain Profile): a new route param or a previous-route check.
- Storage for lesson state (D-62): new device-local columns or a small table via the next migration (head is 032 at baseline, `src/db/database.ts:70`; re-verify the head at planning). The shim's "this phase owns no schema" assumption does not apply: lesson state is new to this phase.
- The exact not-contacted-yet copy for D-77.
- Detailed Log save does not bump the shell refresh tick (`LogInteractionScreen.tsx:238-242`); consumers refresh on next focus. Record's "close the loop" copy must stay true to that.
</decisions>

<canonical_refs>
## Canonical References

**Phase planning record**
- `.planning/phases/39-onboarding/39-LEDGER.md` — every question, verbatim answer, revision
- `.planning/phases/39-onboarding/39-WORKPAPER-mockup/onboarding-mockup.html` — accepted visual reference (D-74)
- `.planning/DOSSIER-CONVENTIONS.md` — status tokens, ID rules, supersession format

**Discovery evidence (legacy, read-only)**
- `docs/dossier/workpapers/phase-39-onboarding-journey-discovery.md` — 145-candidate inventory (evidence, not scope)
- `docs/dossier/workpapers/phase-39-fresh-install-foundation-audit.md` + folder — F01–F28, fresh-install screenshots
- `docs/dossier/workpapers/phase-39-onboarding-design-decisions.md` — legacy owner + ChatGPT ledger (source of D-01..D-42)

**Decisions this phase supersedes or amends**
- `docs/decisions/ADR-016-fixed-first-contact-forms-and-atomic-contact-creation.md` (D-50)
- `docs/decisions/ADR-131-progressive-contact-creation-and-complete-record-editing.md` (D-51)
- `docs/dossier/milestone-2/phase-13-rapid-capture-update-flows-dossier.md` §F :150-152 (D-51)
- `docs/dossier/milestone-2/phase-06-dashboard-list-view-dossier.md` §O :230, :260, :262, :330, :350 (D-30, D-34, D-48, D-71)
- `.planning/phases/27-dashboard-list-view/27-CONTEXT.md` D-09 (D-34)

**Carried constraints**
- `docs/dossier/milestone-2/planning-notes/phase-15-17-18-stub-contracts.md` :53-64 — old onboarding obligations (each resolved by a D-ID above)
- `docs/decisions/ADR-041-*` (D-45), `ADR-079-*` (D-47)
- `docs/dossier/milestone-2/phase-16-ai-configuration-prompting-dossier.md` :263, :807-818, :959 (D-46, D-47, D-69)
- `docs/dossier/milestone-2/phase-02-theme-visual-system-dossier.md` :38-40 (D-43, D-72)
- `.planning/phases/38.8-history-navigation-ux/38.8-CONTEXT.md` :48, :313 (D-67)
- `.planning/phases/38.7-orrery-v2/38.7-CONTEXT.md` (Orrery V2 encodings behind D-65)
- `CLAUDE.md` — local-first, theme tokens, reduced motion, migrations (D-32, D-49, D-62)

**Subsystem docs**
- `docs/systems/orrery.md`, `docs/systems/interaction-history.md`, `docs/systems/README.md` (routing)
- `docs/runbooks/desktop-build-pipeline.md` — device builds and test phones
</canonical_refs>

<code_context>
## Current State (main @ 19caf50c)

**No onboarding exists.** Only onboarding-style empty copy (`HomeScreen.tsx:1759`, `widget-render.tsx:527`). No first-run flag, onboarding route, coach-mark component or lesson state anywhere in `src/`. The only "first run" is a derived Contacts empty state ("Add your first contact", `src/logic/dashboard-empty-logic.ts:24-25,50`; `HomeScreen.tsx:1717-1731`). Initial tab is Digest (`src/navigation/shell-contract.ts:9`), which has no first-run state.

**Shell and navigation.** Bottom tabs with a native stack per tab (`src/navigation/RootNavigator.tsx`); order Contacts, Events, Digest, Orrery, Settings. App-wide mounts: `AssistBanner` above the tab navigator (`RootNavigator.tsx:239`); `UniversalFab`, `Snackbar` and resume prompts beside `RootNavigator` (`App.tsx:439-455`). Focused route mirrored to `focused-route-store` (`App.tsx:172-174`); `FOCUSED_WORKFLOW_ROUTES` hide the tab bar. Back handling via `shellTransientStore` / `resolveBackIntent` (`RootNavigator.tsx:164-188`). Bootstrap `runBootstrapSequence` gates `ready` (`App.tsx:179-219`); launch sweep runs on cold start and background→active (`launch-sweep.ts:13-29`). Overlays are custom RN `Modal` wrappers; `BaseOverlay` moves accessibility focus on open (`src/components/ui/overlay-base.tsx:84-92`).

**Preferences and backup.** Single-row `app_settings` behind `src/db/app-settings-dao.ts` (typed patch writes, validators, data-revision bump). Adding a column follows the migration-020 pattern (`ALTER TABLE app_settings ADD COLUMN … NOT NULL DEFAULT … CHECK`). Portable backup settings are an explicit allowlist (`getPortableSettingsSnapshot`, `:886-971`); device-local fields such as `backupNudgeDismissed` are excluded. AsyncStorage holds the contacts-permission flags (`src/services/contacts/use-read-contacts-permission.ts:8-10`) and several per-device caches/stores (theme, dashboard prefs, compose session, AI model prefs, photo-backup skips). Migration head 032; `BACKUP_FORMAT_VERSION = 7`. No erase-all-data flow.

**Accessibility primitives.** `useReducedMotion` / `useReducedMotionShared` (`src/theme/use-reduced-motion.ts`). No screen-reader detection (`isScreenReaderEnabled`) anywhere. `announceForAccessibility` used for bulk results (`HomeScreen.tsx:1063`).

**Trigger points (verified).**
| Lesson | Entry point(s) |
|---|---|
| Acquire: manual | `Create` route (DashboardStack); save `replace("Profile")` at `CreateContactScreen.tsx:394` |
| Acquire: import | `startContactImport` (`start-contact-import.ts`) called from Settings → Contacts (`SettingsContactsScreen.tsx:126,315`); resume via `ResumeImportPrompt.tsx:50`; permission primer `LegacyContactPickerScreen.tsx:200-204` |
| Prepare | Profile opened from Contacts, Digest, Orrery, Events, widget, notification; params `{contactId, openReachOut?}` |
| Reach Out | Compose from Profile Message (`ContactProfileScreen.tsx:599`), card Message (`HomeScreen.tsx:1448`), widget, notification; Transmit `ComposeScreen.tsx:971`, Copy `:1041` |
| Record | Quick Log entries (D-53); `LogContact` from + button, swipe pref "log-contact", card menu, bulk with one selected, History empty state (`HistorySection.tsx:645`); save `LogInteractionScreen.tsx:194` |
| Group Log | + button (`universal-fab-logic.ts:193-195`); bulk Log with >1 selected (`HomeScreen.tsx:1185`) |
| Memory | `MemoryScreen.tsx:149`, `ThingsToRememberScreen.tsx:297`, `PostLogNoteEditor.tsx:187`, Edit Contact; Share → `Capture` (`linking.ts:66-68`) |
| Categories | `CategoryManagement` (`settings-contacts-model.ts:172`); `CategoryChoiceSheet` in Create/Edit/import |
| Notifications | master toggle requests permission (`SettingsNotificationsScreen.tsx:177-185`) |
| Systems | `OrrerySystemSelector.tsx` ("Choose System") |
| History hint | `HistorySection.tsx` when records exist (empty state `:1092-1110` has no chart) |
| AI setup | `SettingsAIScreen.tsx:167-177`, `AIConnectionScreen.tsx`; Compose "open AI settings" `ComposeScreen.tsx:962` |

**Defects and gaps this phase fixes.**
| # | Defect | Where | Root cause |
|---|---|---|---|
| 1 | Hidden Today default silently writes an interaction; new people Unbound and invisible | `CreateContactScreen.tsx:200-203,223` | ADR-016/ADR-131 defaults; section collapsed |
| 2 | Tapping a possible match does nothing | `DuplicateReviewScreen.tsx:322,358` | `onInspect` no-op; long-press only |
| 3 | Two surfaces ask "Did you send it?" with different answers | `ComposeScreen.tsx:21-25,1757-1786`; `AssistBanner.tsx:140-150` | Compose panel designed additive |
| 4 | Bound + Not Yet shows "Not tracked — set a frequency" | `src/services/profile-metrics.ts:154-167` | `lastContact === null` treated like no cadence |

**Orrery and History facts the lessons rely on.** Orrery: own tab; All Contacts = Bound, non-archived; never-contacted bodies stack at north on neutral rings (device screenshot 34); no legend; canvas has no accessibility props, the "Contacts in this System" sheet is the non-gesture path (`OrreryContactsSheet.tsx:89-129`). History (38.8): empty state "No history yet / Log an interaction to start seeing activity here." + "Log interaction"; a new log appears in place under Today with no highlight; heatmap cells are buttons labelled e.g. "Oct 2, 1 interaction" (`ActivityHeatmap.tsx:354-378`) and nothing says they jump the stream.
</code_context>

<specifics>
## Specific Ideas

- Owner on teaching versus fixing: lessons must not compensate for confusing UX (D-02); the prerequisite fixes exist for this reason.
- Owner on the mockup: "Mock ups look fantastic." Planning should aim at it.
- Owner on how lessons are maintained (2026-10-09): wanted to know how lessons are updated or added; the registry shape in Claude's Discretion is the answer given (copy edit = registry edit; new lesson = registry entry + one trigger call + anchors).
- Rejected (ledger): a longer Quick Log Undo window (Q-29 → rejected at Q-50: the snackbar already stays 6000 ms, `src/stores/snackbar-store.ts:38-41`; the ~3–5 s figure was a device-agent estimate); a first-run right-swipe choice (Q-01, B chosen); a condensed one-line Relationship Basics summary (Q-38: "It looks fine as drawn in the mockup with all the options shown"); per-lesson replay list (Q-09); auto re-show of changed lessons (Q-16); tutorial state in backups (Q-15); a separate Contacts gesture lesson (Q-21); queueing lessons back-to-back (Q-11).
</specifics>

<deferred>
## Deferred Ideas

- **D-39** — Email/newsletter signup in first run.
- **D-40** — Feedback/support routes and developer announcements → likely Milestone 3 Launch Pipeline.
- **D-41** — Pre-launch review of local-data-loss/backup messaging → likely Milestone 3.
- **D-42** — A detailed History-navigation walkthrough (the D-67 hint is the only History teaching).
- Backlog 999.3 — inline Memory/Off Limits inputs on the contact forms; retire the old Fuel editor.
- Backlog 999.4 — every visible app-name use through `APP_NAME` (D-90, D-91).
- Backlog 999.5 — a Things to Remember section for shared items, with an optional reminder and a save-where choice. Its outcome sets the sharing lesson's content (D-93).
- Backlog 999.6 — move an entry between Things to Remember sections.
- Device-observed, unrouted: Systems builder "0 members" with all filters Any; Archive runs without confirmation (ledger N-10).
</deferred>

<supersessions>
## Supersessions to record at KB extraction

| D-ID | Supersedes / amends | Partial — what exactly | What survives |
|---|---|---|---|
| D-50 | ADR-016 :18 | Last spoke defaults to Today | Today / Pick date / Not yet control; atomic create with optional first interaction |
| D-51 | ADR-131 :18; phase-13 dossier §F :150-152 | No cadence → Unbound as the default outcome | Name-first creation; Unbound still choosable; cadence selection coordinates Bound |
| D-34 | phase-06 dossier §O :230; 27-CONTEXT D-09 | First-run right-swipe choice | Quick Log default; global Settings preference; both variants commit on threshold |
| D-30 | phase-06 dossier :262 `[DERIVED]` | Onboarding teaches the Favourite star | Row-gesture teaching (fulfilled by D-71) |
| D-83 | this phase D-18 | Skip on single-step tips | Skip on multi-step lessons and the Quick Log intercept |
| D-84 | this phase D-58 | No lesson over any open sheet | Every other form/sheet/dialog still blocks lessons |
| D-16 / D-53 | ADR-082 :18; ADR-132 :18, :23; phase-06 :238, :361; phase-13 :184; phase-01 :268-272; phase-12 :324; 34-CONTEXT D-08 | Quick Log never pauses before writing | Every Quick Log after the first writes immediately; Undo after commit |
| D-76 | 35-CONTEXT D-04 (+ D-05); phase-14 :179-187; 21-interaction-assist :202-215 | Compose panel coexists with the global asker for the same record | Banner + pending list stay mounted with ADR-071 answer sets; durable assist lifecycle |
| D-92 | ADR-140 :18; phase-37 :40-45 | Eight fixed top-level Settings rows | Category order; utility rows near the bottom |
| D-62 | ADR-057 :18; ADR-138 :18 | Backups carry every non-secret preference | Every other preference stays portable |
| D-77 | phase-10 dossier :323-327 | Four Orbit Status labels | ADR-011 never-contacted rule; status engine nulls |
| D-86 | phase-13 dossier :607 | Add Contact success → new Profile (first run only) | Outside first run, unchanged |
| D-87 | phase-13 dossier §D :97-100 | Only Identity open by default | Progressive sections; name-first creation |
| D-94 | 34-UI-SPEC :115 | "Not yet" muted even when selected | Tri-state Today / Pick date / Not yet control |
| D-95 | phase-05 dossier :235 | Active Contacts not listed in the Population menu | ADR-093 Active Contacts as the default population |
| D-96 | this phase D-63 | How the first-run restore entry runs and where it ends | Restore untaught (D-30); restore flow unchanged outside first run |
| D-97 | this phase D-58, D-84 | Lessons blocked on their own trigger form | Every other form/sheet/dialog/Assist question still blocks lessons |
| D-99 | this phase D-27, D-23 | No Capture teaching; Memory line about today's share flow | Rest of the Capture workflow untaught |
</supersessions>

<verification>
## Verification Expectations

**Unit and logic (vitest, pure helpers):**
- Coordinator: one active lesson; blocked while a form/sheet/dialog/Assist question is open, except the D-84 trigger sheet; no chaining (D-58, D-84).
- State transitions: unseen → active → done (end or skip); kill / leave → unseen; background → resume (D-54, D-59, D-60).
- Global switch and Restart: off pauses without losing state; on resumes unseen only; Restart resets all and enables; Welcome/Acquire never replay (D-55..D-57).
- First-run resume rules: Acquire on relaunch; cancel/deny returns to choice; restore with people completes; Skip Tutorials ends and disables (D-61, D-62, D-63, D-55).
- Adapted Orient when nobody is Bound (D-52).
- Quick Log intercept: every in-app entry fires it once; Log it and Skip both perform the write exactly once; widget, notification and Assist never fire it (D-16, D-53).
- Lesson identity: wording edit keeps done-state; new identity is offered (D-64).
- Lesson state excluded from the portable settings snapshot and export (D-62).
- No literal app name in onboarding strings (D-79).
- Prerequisite fixes: create defaults Bound + Monthly + Not yet with no interaction written (D-50, D-51); possible-match tap opens the three actions (D-75); one asker per pending record and the same three answers everywhere (D-76); not-contacted-yet status (D-77) with no progress or bucket.
- Keep existing suites green; grep every consumer of a changed contract, including tests. The post-merge gate runs `tsc --noEmit` and `check:colors`.

**Device:**
- All device checks run once, in the phase's final device pass, on the physical test phone the runbook prefers (`docs/runbooks/desktop-build-pipeline.md`): a debug build for functional checks, then one release build at the end.
- States: a fresh install (no data); a manual-first run; an import-first run that tracks nobody (adapted Orient); an import with a possible match; a run interrupted at Acquire (kill and relaunch); Skip Tutorials on Welcome; tutorials off → on; Restart.
- Checks: every lesson's trigger fires once and never over a form or another lesson; Quick Log via + and via swipe both intercept then log; Compose handoff → one "Did you send it?"; TalkBack walk of first run and one spotlight lesson (focus, labels, Skip reachable); reduced motion; maximum font size; light and dark mode on both theme packages.
- No real AI provider call without the owner's clearance (AI setup lesson checked up to the connection step).

**Owner device checkpoints:** one look-and-feel sign-off of the first run and the four lesson patterns against the mockup (D-74, D-80..D-85, D-89), and the final lesson copy (Claude's Discretion item 1).

**Obsolete / rewritten tests:** tests pinning the current create defaults (Unbound, Today), the Compose panel's Yes / Not yet pair and additive behaviour, the `resolveProfileStatus` "Not tracked" result for Bound + no contact, and the Create → Profile landing are rewritten for D-50/D-51, D-76, D-77, D-86. Identify them at planning by grep.
</verification>

---
*Phase: 39-onboarding*
*Context gathered: 2026-10-09*
