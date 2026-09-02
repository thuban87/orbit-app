# Milestone-2 Decision Ledger (Pass 1 — lossless extraction)

`oa-audit-dossiers milestone-2` · generated 2026-09-01 · **uncommitted working-tree artifact** (`audit/` is gitignored)

This ledger transcribes every tagged decision, cross-phase constraint, boundary, deferred item, success criterion and "do not" note in the authoritative milestone-2 corpus into one atomic, cited entry. Nothing is summarized away or judged here; Pass 2 verdicts live in `AUDIT-REPORT.md`.

## Entry format

```
ID | status | section | topic | statement | assumes | cite
```

- **ID** `D-<phase>-<seq>` (`RM` = working roadmap v1.0, `MH` = master handoff v1.0, `GE` = group-events restructuring briefs).
- **status** — normalized from each dossier's own legend:
  - `LOCKED` ← `[DECIDED]`, `[DECIDED / INHERITED …]`, `[INHERITED / CONFIRMED]`, `[SUPERSEDES]`/`[SUPERSEDED]` (the replacing statement), `[REJECTED FOR THIS MILESTONE]`, `[BOUNDARY]`, scope "does not" lists, Success Criteria, and GSD "do not" notes.
  - `DERIVED` ← `[DERIVED]`, `[DERIVED / CROSS-PHASE WATCH]`, `[INHERITED]` restatements, and untagged roadmap/handoff restatements.
  - `DEFERRED-DECISION` ← a postponed item that a LOCKED entry somewhere depends on.
  - `DEFERRED-FEATURE` ← a postponed build-later item with no current coupling.
  - `XREF` ← a Cross-Phase Constraints line ("Phase X owns/defines Y"); `assumes` names the phase it points at.
- **cite** — line number in the phase's file (file path given in each phase header). Every line number was taken from a full read of the file on 2026-09-01.

## Ingested manifest (resolved versions)

| Key | File (docs/dossier/milestone-2/) | Version rule applied |
|---|---|---|
| RM | orbit-ui-ux-working-roadmap-v1.0.md | roadmap (phase map, deferred list, corrections) |
| MH | orbit-ui-ux-master-handoff-v1.0.md | master handoff (source-of-truth order, watch items) |
| 01 | phase-01-app-shell-navigation-dossier-**amended-group-events**.md | amended supersedes archived original |
| 02 | phase-02-theme-visual-system-dossier.md | only version |
| 03 | phase-03-contact-knowledge-foundation-dossier.md | only version |
| 04 | phase-04-dashboard-data-state-foundation-dossier.md | only version |
| 05 | phase-05-dashboard-control-surface-dossier-**amended-group-events**.md | amended supersedes archived original |
| 06 | phase-06-dashboard-list-view-dossier.md | only version |
| 07 | phase-07-dashboard-card-view-dossier-**v0.2**.md | v0.2 supersedes archived original |
| 08 | phase-08-orrery-camera-scale-exploration-dossier.md | only version |
| 09 | phase-09-orrery-systems-dossier.md | only version |
| 10 | phase-10-profile-experience-dossier.md | only version |
| 11 | phase-11-interaction-history-insights-dossier-**v0.2-group-events**.md | v0.2 supersedes archived original |
| 12 | phase-12-group-interaction-logging-dossier.md | only version |
| 13 | phase-13-rapid-capture-update-flows-dossier.md | only version |
| 14 | phase-14-messaging-ai-compose-dossier.md | only version |
| 16 | phase-16-ai-configuration-prompting-dossier.md | only version |
| GE | group-events-restructuring/{additional-cross-phase-amendments-and-watch-items, group-interaction-deferred-concepts, orbit-group-interaction-planning-brief}.md | briefs (read in full); the four `*-prompt*.md` files were read and found fully reflected in the amended dossiers — no unique decisions |

**Not ingested (superseded):** `group-events-restructuring/archived-dossiers/phase-0{1,5,7}-*.md`, `phase-11-*.md` (pre-amendment originals). No `.docx` present → no UNAUDITED GAP. Phases 15/17/18 have no dossier (roadmap-deferred).

---
## RM — Working Roadmap v1.0 · `orbit-ui-ux-working-roadmap-v1.0.md`

D-RM-001 | LOCKED | §1 Status | roadmap/status | Phases 1–14 and 16 interrogated; Phase 15 intentionally deferred until after execution of Phases 1–14; Onboarding (17) and Release Hardening (18) planning deferred; roadmap "fungible until GSD finalization". | — | :3,:23-26
D-RM-002 | LOCKED | §1 GSD numbering | roadmap/numbering | Sequential integer phase numbers describe sequence and seams only; GSD roadmapper assigns canonical numbers; no requirement the milestone literally begins at Phase 1. | — | :31
D-RM-003 | LOCKED | §2 Goal | roadmap/goal | Milestone goal: release-quality, low-friction mobile experience (navigation, presentation, capture, personalization, accessibility, responsive layouts, onboarding); ends in a state suitable for outside beta testers. | — | :35-37
D-RM-004 | LOCKED | §3 Principles | roadmap/principle | UI/UX work may include supporting data/domain changes when required by the desired experience. | — | :41
D-RM-005 | LOCKED | §3 Principles | roadmap/authority | Existing architectural/domain invariants remain binding unless explicitly superseded; prior visual/presentation decisions may be revised during this design pass. | — | :42
D-RM-006 | LOCKED | §3 Principles | roadmap/sync | Sync/authentication not in this milestone except foundations explicitly needed now; a local owner profile is acceptable. | — | :43
D-RM-007 | LOCKED | §3 Principles | roadmap/cross-cutting | Universal capture, low friction, privacy-first AI, accessibility, future widget/deep-link readiness remain cross-cutting. | — | :44
D-RM-008 | LOCKED | §3 Principles | roadmap/legend | Dossiers distinguish [DECIDED] / [DERIVED] / [DEFERRED]. | — | :45
D-RM-009 | LOCKED | §3 Principles | roadmap/interrogation | Only meaningful product/higher-level architecture forks require owner interrogation; routine best practices derived. | — | :46
D-RM-010 | LOCKED | §3 Principles | roadmap/phase-boundary | Decision density is a phase-boundary signal; split coherent subsystems before GSD planning. | — | :47
D-RM-011 | LOCKED | §3 Principles | roadmap/renderer-scope | Renderer phases must not silently absorb business workflows belonging to shared routing, domain, Settings, Onboarding, or data-management phases. | — | :48
D-RM-012 | LOCKED | §3 Principles | roadmap/no-speculative-schema | Do not turn future-looking compatibility into speculative schema/services; preserve seams only where cheap. | — | :49
D-RM-013 | LOCKED | §3 Principles | roadmap/late-surfaces | Settings, Onboarding, Release Hardening are late integration/planning surfaces; earlier phases export configuration/teaching/hardening seams; final IA planned against the implemented product. | — | :50
D-RM-014 | LOCKED | §4 Phase Map | roadmap/phase-map | Phase map 1–18 with status: 1–14 COMPLETE, 15 DEFERRED PLANNING, 16 COMPLETE, 17 DEFERRED PLANNING, 18 DEFERRED PLANNING (core purposes per row). | — | :54-73
D-RM-015 | LOCKED | §4 Phase Map | roadmap/phase-7-name | Phase 7 "Card View" settled product is a compact 3-column avatar-first grid despite the historical name. | — | :15,:62
D-RM-016 | LOCKED | §5 Dashboard sequence | roadmap/dashboard-decomp | Dashboard decomposed: Data & State Foundation → Control Surface → sibling List / Card-Grid renderers. | 04,05,06,07 | :77-89
D-RM-017 | LOCKED | §5 Orrery sequence | roadmap/orrery-decomp | Orrery split: Camera/Scale/Exploration (built-in System consumer) → Orrery Systems (author/manage/switch). | 08,09 | :91-102
D-RM-018 | LOCKED | §5 Profile/History sequence | roadmap/profile-decomp | Profile Experience (History section slot + minimal seam) → Interaction History & Insights; Phase 10 owns composition/templates/sections/History slot; Phase 11 owns History internals + canonical interaction detail/editing. | 10,11 | :104-117
D-RM-019 | LOCKED | §5 Group/Rapid sequence | roadmap/group-decomp | Group Interaction Logging inserted before Rapid Capture; Rapid Capture consumes it. Phase 12 owns Group Event persistence…backup seams; Phase 13 owns ordinary single-contact capture/update and consumes the Phase 12 route for multi-contact logging. | 11,12,13 | :119-133
D-RM-020 | DERIVED | §6 Exported constraints (P1) | roadmap/restatement | Restates Phase 1: four-tab nav; per-tab stacks with retap dismiss-then-root; browse screens keep nav+FAB, focused hide both; Back parity + origin-aware; five-action FAB (Add Contact, Quick Log, Log Contact, Update Contact, Memory) — NOTE: roadmap §6 still lists five actions; §7 :333 and MH :73 say six. | 01 | :137-143
D-RM-021 | DERIVED | §6 (P2) | roadmap/restatement | Restates Phase 2: theme package vs appearance mode axes; Galaxy deep-space/glass, Standard calmer; one semantic component/token system + icon registry; colour never sole state carrier; Orrery immersive but tokenized. | 02 | :145-150
D-RM-022 | DERIVED | §6 (P3) | roadmap/restatement | Restates Phase 3: Things to Remember over first-class fields/custom fields/relationships/Memories; relationships structured with optional link; semantic knowledge abstraction; AI opt-in per item default OFF; history-aware current-state fields; Backup preserves model. | 03 | :152-158
D-RM-023 | DERIVED | §6 (P4) | roadmap/restatement | Restates Phase 4: Dashboard = browser/command center; Active Contacts default universe; populations Favorites/Birthdays/Not Contacted/Snoozed; five filters OR-within/AND-across; search scoped, never leaks Archived/Unbound; Gravity derived. | 04 | :160-165
D-RM-024 | DERIVED | §6 (P5) | roadmap/restatement | Restates Phase 5: independent anchored live-apply controls; search + List/Card toggle row; overflow bulk management → Select Contacts / Phase 7 multi-select; import belongs to Backup/Restore. | 05 | :167-171
D-RM-025 | DERIVED | §6 (P6) | roadmap/restatement | Restates Phase 6: scan-first rows, three-line hierarchy, favorite always visible, same-weight border + glyph, snooze neutralizes, search replaces secondary rows, tap→Profile, right-swipe configured logging, left-swipe Edit. | 06 | :173-178
D-RM-026 | DERIVED | §6 (P7) | roadmap/restatement | Restates Phase 7: 3-column grid, ring + badge status, snooze override, tap→Profile, long-press power menu, no swipe, multi-select = bulk management freezing result universe, bulk delete uses existing 30-day quarantine, Gravity noneditable. | 07 | :180-185
D-RM-027 | DERIVED | §6 (P8) | roadmap/restatement | Restates Phase 8: constrained 2.5D world; pan/zoom/tilt/yaw/focus/recenter; geometry grows; semantic zoom + cluster focus; built-in Systems list; Relationship Satellites optional moons; culling/LOD. | 08 | :187-194
D-RM-028 | DERIVED | §6 (P9) | roadmap/restatement | Restates Phase 9: System = named dynamic subset w/ rules + manual inclusions + exclusions; built-in immutable base + overrides; HUD wizard; Management owns CRUD; last active persists; spin/shedding transition; empty/broken selectable; no cap. | 09 | :196-203
D-RM-029 | DERIVED | §6 (P10) | roadmap/restatement | Restates Phase 10 (fixed Hero; factory order; modular not page-builder; templates independent; assignment global→Category→contact; template edits propagate; expanded state per contact; Relationship Overview tiles; Status unchanged; Gravity sphere / Intensity histogram / Frequency immediate / Snooze custom route; Things to Remember one-column compact; child order; ~3 before View All; hidden recoverable presentation-only; Off Limits visible; History slot; overflow ordering). | 10 | :205-223
D-RM-030 | DERIVED | §6 (P11) | roadmap/restatement | Restates Phase 11 (heatmap/intensity/browser; heatmap interaction-only; lenses + Cycles default 10 w/ 5/10/15/20 global; in-progress cycle structural cue; 7 Days rolling; Month geometry; Year dense; tap→context card→detail sheet; reusable aggregation; Intensity shares window; wheels Month/Day/Year, no future; theme; markers; drawer; one detail sheet; three record families; Frequency/Category changes omitted; canonical Detail/Edit; hard delete; optional duration in seconds, Quick Log never sets, no derived-metric effect; backfill routes to detailed logging). | 11 | :225-245
D-RM-031 | DERIVED | §6 (P12) | roadmap/restatement | Restates Phase 12 (Group Event parent, one child per participant, title+date required, zero participants valid, event-owned Channel/Tone/Duration/Group Note, overridable fields, live inheritance, Group Note distinct, Detail vs Edit, management page + header icon + overflow, FAB Group Log, Grid 1→individual 2+→Group, conversion, dissolve vs delete, atomic, backup, deferred list). | 12 | :247-262
D-RM-032 | DERIVED | §6 (P13) | roadmap/restatement | Restates Phase 13 (Add Contact name-only with Identity/Relationship Basics/Contact Methods + Show More; Edit Contact complete accordion; no-cadence → Unbound, cadence → Bound, dormant cadence; Quick Log immediate + Add Note / Create Memory Instead; basic Memory + Edit Memory; Log Interaction fields; Channel Message/Call/In Person; preference Remember Last Choice factory; Direction/Connected defaults; Tone Positive/Neutral/Negative null default; backdating free; Update Contact chooser loop incl. custom fields by name; one Save; canonical picker/routes). | 13 | :264-279
D-RM-033 | DERIVED | §6 (P14) | roadmap/restatement | Restates Phase 14 (Compose drafting workspace + external handoff; Compose-first + Research side; Text/Email modes w/ Settings preference; destination resolution + fallback; Subject; Transmit; Did you send it?; drafts session-only; AI affordances absent when not configured/usable (NOTE: pre-Phase-16 wording); Draft/Rewrite adaptive; three suggestions; Try Again; Research populated-only; Message Focus ≤3; Random Thought deferred). | 14 | :282-296
D-RM-034 | DERIVED | §6 (P16) | roadmap/restatement | Restates Phase 16 (AI Enabled toggle; one active connection over three lanes; safe switching; OpenRouter browser auth + curated picker + pricing; per-connection model memory; immutable system prompt + Writing Style + Personalization Context; no artificial ceiling; permissions authoritative; Adjust ephemeral; central permission manager; split transparency; AI Off vs Needs Attention; human-readable errors + sanitized telemetry seam; backup excludes secrets; deferred list). | 16 | :298-313
D-RM-035 | LOCKED | §7 Watch items | roadmap/bulk-mgmt | Phase 5 "Bulk / Contact Management" remains superseded by Select Contacts → Phase 7 Grid multi-select; do not create a standalone bulk-management screen. | 05,07 | :317
D-RM-036 | LOCKED | §7 | roadmap/import | Contact import remains a Backup/Restore/contact-data-management concern, not Dashboard multi-select. | 05,07 | :318
D-RM-037 | LOCKED | §7 | roadmap/phase-7-name | Phase 7 requirements should describe the 3-column avatar-first Grid despite the Card View name. | 07 | :319
D-RM-038 | LOCKED | §7 | roadmap/gravity | Gravity is derived-never-stored; must not become editable via Dashboard, Orrery, Profile, History, or bulk actions. | 04,07,08,10,11 | :320
D-RM-039 | LOCKED | §7 | roadmap/category-gap | Category administration gap: users need create/rename/reorder/delete Category management; eventual Settings consolidation is the natural owner (planning deferred); Profile assignment and Orrery Systems consume Categories, do not own CRUD. | 15(deferred),08,09,10 | :321
D-RM-040 | LOCKED | §7 | roadmap/category-delete | Category deletion must account for generated Orrery Systems, dependent custom-System rules, and Profile layout/background Category assignments; no separate reconciliation subsystems unless needed. | 09,10,15 | :322
D-RM-041 | LOCKED | §7 | roadmap/profile-assignment-scope | Profile layout/background assignment limited to global/default, Category, contact; do not pull Systems/Favorites/Status/Gravity/dynamic groups into Profile assignment this milestone. | 10 | :323
D-RM-042 | LOCKED | §7 | roadmap/hero-fixed | Profile Hero remains structurally fixed; templates customize body only. | 10 | :324
D-RM-043 | LOCKED | §7 | roadmap/compact-cards | Phase 10 compact cards must not regress into form-like cards with blank rows. | 10 | :325
D-RM-044 | LOCKED | §7 | roadmap/heatmap-interaction-only | Phase 11 Heatmap interaction-only; lifecycle/history events belong to Browser/detail sheet. | 11 | :326
D-RM-045 | LOCKED | §7 | roadmap/lifecycle-immutable | Preserve immutable lifecycle-event semantics; editable location/job history belongs to history-aware Contact Knowledge model, not lifecycle events. | 03,11 | :327
D-RM-046 | LOCKED | §7 | roadmap/edit-interaction-reuse | Canonical Edit Interaction route introduced in Phase 11 and reused by later Rapid Capture/Update work. | 11,13 | :328
D-RM-047 | LOCKED | §7 | roadmap/duration | Optional interaction duration carried through persistence and Backup/Restore; must not silently alter derived metrics. | 11,13 | :329
D-RM-048 | LOCKED | §7 | roadmap/aggregation-reuse | Heatmap temporal aggregation preserves cheap future reuse for account/category analytics and Your Week without adding those products now. | 11 | :330
D-RM-049 | LOCKED | §7 | roadmap/satellites | Phase 8 Relationship Satellites remain lightweight presentation of unlinked structured relationships; no social graph in this milestone. | 08 | :331
D-RM-050 | LOCKED | §7 | roadmap/hardening-deferred | Final large-data performance budgets, responsive behavior, yearly heatmap rendering, wheel density, accessibility QA are late Release Hardening concerns with deferred detailed planning. | 18 | :332
D-RM-051 | LOCKED | §7 | roadmap/group-amendments | Phases 1, 5, 7, 11 have targeted Group Log amendments; amended wording is authoritative where older text conflicts. | 01,05,07,11,12 | :333
D-RM-052 | LOCKED | §7 | roadmap/tone | Phase 13 complete: ordinary rapid capture uses canonical Tone, optional/null by default; does not recreate Group Event behavior. | 12,13 | :334
D-RM-053 | LOCKED | §7 | roadmap/channel-pref-seam | Settings consolidation must expose Message / Call / In Person / Remember Last Choice (factory Remember Last Choice; remembered state updates only after successful ordinary saves); underlying preference/state seam may be implemented earlier. | 13,15 | :335
D-RM-054 | LOCKED | §7 | roadmap/group-channel-exception | Settings consolidation must make clear the ordinary Channel preference does not govern Group Log; Group Log defaults In Person. | 12,13,15 | :336
D-RM-055 | LOCKED | §7 | roadmap/add-contact-lifecycle | Add Contact: Name only required; no cadence → Unbound; selecting cadence → Bound; explicit Unbound may retain dormant cadence. | 13 | :337
D-RM-056 | DEFERRED-DECISION | §7 | roadmap/memory-type-name | Exact canonical default/general built-in Memory type/name remains a reconciliation item (Phase 3 never enumerated a complete built-in catalog). Phase 13 §J depends on it. | 03,13 | :338
D-RM-057 | LOCKED | §7 | roadmap/backup-group | Backup/Restore watch: Group Event records, links, Group Note, override state are durable backup data. | 12 | :339
D-RM-058 | LOCKED | §7 | roadmap/compose | Phase 14 complete: Compose is drafting/research/handoff, not a messaging client; Transmit hands off externally; post-return confirmation logs a Message interaction only after explicit user confirmation. | 14 | :342
D-RM-059 | LOCKED | §7 | roadmap/compose-mode-seam | Settings must expose Text / Email / Remember Last Choice (factory Remember Last Choice; remembered state updates on meaningful Copy/Transmit use); runtime support may land earlier with the owning feature. | 14,15 | :343
D-RM-060 | LOCKED | §7 | roadmap/ai-availability | Phase 16 supersedes the earlier provider=None/unusable wording with three states: AI Off removes AI UI; AI On + Ready exposes AI actions; AI On + Needs Attention shows a repair notice rather than silently disappearing. Phase 16 owns connection/model setup, personalization, Adjust, permissions, transparency, readiness. | 14,16 | :344
D-RM-061 | LOCKED | §7 | roadmap/message-focus | `Add to AI` only emphasizes already-authorized knowledge for the session; never grants AI permission; Off Limits can constrain AI if authorized but never become Message Focus. | 03,14,16 | :345
D-RM-062 | LOCKED | §8 Dependency order | roadmap/order | Dependency order 1→14, 15 (planning deferred), 16 (complete), 17, 18 (deferred); later phases may be reordered by GSD. | — | :349-368
D-RM-063 | LOCKED | §9 | roadmap/no-next-dossier | No immediate next dossier-interrogation target before GSD milestone generation; package = Phases 1–14 and 16. | — | :372-374
D-RM-064 | LOCKED | §9 Settings deferred | roadmap/settings-seams | Earlier phases implement/preserve preference state or admin seams needed for their own behavior; Settings owns polished IA. Expected Settings-owned seams: Appearance entry points; notifications/device preferences; Contacts Administration / Category CRUD + Orrery/Profile fallout; local owner-profile settings; Dashboard List right-swipe Quick Log vs detailed preference; ordinary Log Interaction Channel default; Compose Text/Email/Remember default; canonical entry points to Systems, Profile presentation management, AI management. | 02,06,09,10,13,14,16,15 | :376-390
D-RM-065 | LOCKED | §9 | roadmap/phase-16-standalone | Phase 16 is decision-complete and remains a substantive subsystem; not folded into Settings; Settings routes to its canonical AI surfaces. | 16,15 | :392
D-RM-066 | LOCKED | §9 Onboarding deferred | roadmap/onboarding-seams | Earlier phases preserve first-run/default/permission/gesture seams; the onboarding sequence itself is designed against the real product. | 17 | :394-396
D-RM-067 | LOCKED | §9 Hardening deferred | roadmap/hardening-seams | Accessibility foundations and responsive seams remain requirements throughout earlier phases; the late hardening phase audits and closes gaps rather than introducing those concerns for the first time. | 18 | :398-400
D-RM-068 | DERIVED | §10 Checklist | roadmap/manifest | Artifact checklist names files with `(1)`/`(2)` download suffixes and a `new-milestone(1).md` — neither present in the repo dir (naming drift only; the resolved files are ingested above). | — | :404-422
D-RM-069 | LOCKED | §11 | roadmap/state | Preparatory numbering is a traceability aid; GSD assigns canonical numbering/order. | — | :426-432

## MH — Master Planning Handoff v1.0 · `orbit-ui-ux-master-handoff-v1.0.md`

D-MH-001 | LOCKED | §2 Source-of-truth | mh/source-order | Source-of-truth order: (1) current repo + existing planning/domain dossiers, (2) completed phase dossiers, (3) working roadmap v1.0, (4) current conversation. Completed dossiers authoritative for decisions made; existing architectural/domain invariants binding unless explicitly superseded. | — | :12-20
D-MH-002 | LOCKED | §2 | mh/visual-revision-scope | Earlier visual/presentation decisions may be revised **only when this design milestone intentionally replaces them or device testing reveals a genuine conflict** (narrower phrasing than RM :42). | — | :20
D-MH-003 | LOCKED | §3 Guardrails | mh/guardrails | Interrogate in batches ≤10; mark recommendation but don't decide product for owner; no approval requests for routine best practice; dossiers separate DECIDED/DERIVED/DEFERRED; split subsystems before GSD; no business workflows in renderer phases; no speculative schema; GSD creates atomic requirements mapped to one phase. | — | :24-38
D-MH-004 | LOCKED | §4 Goal | mh/goal | Same milestone goal as RM (beta-ready). | — | :42
D-MH-005 | DERIVED | §5 Status | mh/artifact-table | Artifact table names un-amended file names for Phases 5, 7, 11 (e.g. `phase-05-dashboard-control-surface-dossier.md`) while §9 checklist names the amended ones — internal inconsistency in file naming only. | — | :46-65,:336-350
D-MH-006 | LOCKED | §6 Shell | mh/six-action-fab | Universal FAB exposes Add Contact, Quick Log, Log Contact, **Group Log**, Update Contact, Memory. | 01,12 | :73
D-MH-007 | DERIVED | §6 | mh/restatements | §6 restates Phases 1–16 settled decisions (mirrors RM §6; no unique decisions found beyond MH-006 and the Profile assignment precedence wording "contact override → Category assignment → global/default" :129). | all | :69-253
D-MH-008 | LOCKED | §7 Watch | mh/no-dynamic-assignment | Do not add dynamic rule-based template assignment in this milestone. | 10 | :265
D-MH-009 | LOCKED | §7 Watch | mh/amendments-required | Phase 1/5/7/11 amendments required (six-action FAB + Group Log route; header Group Events icon+label + overflow; Phase 7 prohibition superseded; Phase 11 Detail/Edit recognizes membership, scope choice, no double-count). | 01,05,07,11,12 | :283-289
D-MH-010 | LOCKED | §7 Watch | mh/tone | Phase 13 complete; canonical term Tone; new logging Tone begins null; Rapid Capture consumes Group Log. | 12,13 | :291
D-MH-011 | LOCKED | §7 Watch | mh/settings-channel | Settings consolidation must expose Message/Call/In Person/Remember Last Choice for ordinary logging, factory Remember Last Choice, explicitly stating Group Log is exempt and defaults In Person; runtime support may land earlier. | 13,15 | :293
D-MH-012 | LOCKED | §8 Handoff | mh/no-settings-now | Do not start a full Settings interrogation now; resume after Phases 1–14 executed. | 15 | :305
D-MH-013 | LOCKED | §8 | mh/settings-areas | Later Settings owns consolidation/IA: Appearance, notifications, Contacts Administration / Category CRUD, local owner profile, Dashboard swipe-log preference, ordinary logging Channel default, Compose default mode, routing to Systems/Profile-presentation/AI surfaces. | 15 | :307-315
D-MH-014 | LOCKED | §8 | mh/phase-16-not-reopened | Phase 16 is complete planning; not reopened or absorbed into Settings. | 16 | :317
D-MH-015 | LOCKED | §8 | mh/onboarding | Plan onboarding after substantive implementation; preserve first-run/default/permission/gesture seams. | 17 | :321
D-MH-016 | LOCKED | §8 | mh/hardening | Plan hardening after implementation/device testing; accessibility/responsive foundations remain cross-cutting before then. | 18 | :325
D-MH-017 | LOCKED | §8 | mh/numbering | Preparatory numbers do not require GSD to execute Phase 15 before 16. | — | :329
D-MH-018 | LOCKED | §9/§10 | mh/markdown | Handoff stays Markdown; do not convert to DOCX unless required. | — | :361

## GE — Group-events restructuring briefs · `group-events-restructuring/`

D-GE-001 | LOCKED | additional-cross-phase-amendments §Phase 5 | ge/phase5-amend | Phase 5 must be amended: Group Events first-class header destination alongside Your Week (icon+label, icon-only fallback), overflow redundancy, no permanent content module, no bottom-nav tab, no radial launcher, Phase 12 owns workflows, preserve lean layout. (Fully reflected in amended Phase 5.) | 05,12 | additional-cross-phase-amendments-and-watch-items.md:5-38
D-GE-002 | LOCKED | additional… §Settings watch | ge/settings-channel | Carry to Settings: ordinary Channel default Message/Call/In Person/Remember last choice; factory Remember last choice; Group Log exempt, defaults In Person; Settings copy makes scope clear; do not reopen Group Event Channel semantics in Settings. | 12,13,15 | :43-67
D-GE-003 | LOCKED | additional… §Backup watch | ge/backup | Backup/Restore must preserve Group Event identity, title/date-time, shared Channel/Tone/Duration, Group Note, child links, override/inheritance state, child Interaction data; must not flatten Group Events into standalone Interactions. | 12 | :70-84
D-GE-004 | DEFERRED-FEATURE | deferred-concepts §1–§19 | ge/deferred | Mission Control; nav restructure; Dashboard radial launcher; Group Events bottom-nav; Google Calendar; planned events/social calendar; calendar↔event lifecycle; Group Event analytics; second audience; host/participant roles; richer management; media; venue; recurrence/series; templates; AI features; cross-contact context; sharing/multi-user; naming exploration. Nothing here becomes a Milestone 2 requirement. | — | group-interaction-deferred-concepts.md:10,:12-124
D-GE-005 | LOCKED | deferred-concepts §20 | ge/promotion-rule | Promote a deferred concept only when a later milestone targets it, user testing shows need, or a cheap seam now avoids disproportionate future cost. | — | :126-129
D-GE-006 | DERIVED | planning-brief | ge/brief-provisional | Planning brief is provisional (pre-Phase-12); still uses "quality/impact" wording (:44); its direction (hybrid parent + child rows, no many-to-many) is superseded/confirmed by the completed Phase 12 dossier. Roadmap warning (:125-131): post-11 numbering shifted +1; do not rely on old numbering. | 12 | orbit-group-interaction-planning-brief.md:3,:10-37,:44,:125-133

## Phase 01 — App Shell & Navigation · `phase-01-app-shell-navigation-dossier-amended-group-events.md`

Legend in file: [DECIDED], [SUPERSEDED], [REJECTED FOR THIS MILESTONE], [BOUNDARY] (amendment); body uses [DECIDED] only. Status line :3.

D-01-001 | LOCKED | Scope | scope/boundary | Phase 1 defines the permanent shell; does NOT define the detailed forms/business rules behind Add Contact, Quick Log, Log Contact, Update Contact, Memory — later phases own those; Phase 1 only exposes/routes. | 13 | :7-11
D-01-002 | LOCKED | Amendment | fab/six-actions | [SUPERSEDED] FAB action set is now six: Add Contact, Quick Log, Log Contact / canonical individual detailed logging, **Group Log**, Update Contact, Memory. Any later "five-action" reference is superseded. | 12 | :21-32
D-01-003 | LOCKED | Amendment | fab/group-log-first-class | Group Log is a distinct first-class FAB action, not hidden behind Log Contact; fixed-order labeled speed-dial philosophy intact. | 12 | :34-38
D-01-004 | LOCKED | Amendment | routing/group-log | Group Log has its own semantic internal route and participates in dispatcher/deep-link/widget principles; Routing Contract list read as including Group Log. | 12 | :40-44
D-01-005 | LOCKED | Amendment | fab/group-log-no-prepicker | Group Log does not use a shell-level pre-picker; opens directly into its canonical focused workflow; participant selection belongs inside it. | 12 | :46-50
D-01-006 | LOCKED | Amendment | dashboard/group-events-header | Dashboard header exposes Group Events as prominent icon + label; overflow exposes it redundantly; Group Events remains Dashboard-owned, not a fifth bottom-nav tab; four-tab contract remains. | 05,12 | :52-63
D-01-007 | LOCKED | Amendment | nav/no-radial | [REJECTED FOR THIS MILESTONE] Dashboard bottom-nav radial/menu launcher — Dashboard tab remains an ordinary tab. | — | :65-69
D-01-008 | LOCKED | Amendment | boundary/phase-12 | [BOUNDARY] Phase 1 owns only shell exposure/routing; Phase 12 owns Group Event persistence, parent/child, inheritance, overrides, Detail/Edit, participant mgmt, lifecycle, browsing, atomicity, backup. | 12 | :71-77
D-01-009 | DEFERRED-FEATURE | Amendment | deferred/shell | Mission Control; Dashboard rename; bottom-nav restructuring; radial launcher; dedicated Group Events tab. | — | :79-87
D-01-010 | LOCKED | Supersession Map | amend/map | Amendment supersedes: §F five→six; Routing Contract adds Group Log; Cross-Phase "action workflows" includes Group Log; Success Criterion 4 reads "six-action"; Top-level nav adds Dashboard-header Group Events icon+label + overflow entry. All other Phase 1 decisions intact. | — | :89-99
D-01-011 | LOCKED | §A | nav/four-tabs | Four permanent bottom-nav destinations: Dashboard, Orrery, Backup / Restore, Settings. Your Week remains Dashboard-owned; Search Dashboard-specific; Favorites Dashboard/widget concern; capture belongs to FAB. | — | :107-113
D-01-012 | LOCKED | §A | nav/per-tab-stack | Each top-level tab preserves its own navigation stack (Settings → Notifications → Dashboard → Settings returns to Notifications). | — | :115-117
D-01-013 | LOCKED | §A | nav/active-tab-retap | Tapping the active tab returns it to root, but transient UI (speed dial, search modal, filter modal) is dismissed first; a subsequent tap returns to root. | — | :119-121
D-01-014 | LOCKED | §A | nav/backup-section | Backup / Restore is a full top-level section with root route, remembered stack, room for child routes. | — | :123-125
D-01-015 | LOCKED | §B | nav/visibility | Bottom nav visible on browse/read surfaces (Dashboard, Orrery, Backup root, Settings root, Contact Profile, Your Week, Archived Contacts, ordinary Settings children); hidden during focused workflows (Add/Edit Contact, Log Contact, Update Contact, Compose, onboarding, destructive confirmations). | — | :131-135
D-01-016 | LOCKED | §B | forms/discard-keep | Meaningful unsaved changes require explicit abandonment confirmation: **Discard changes / Keep editing**; shell does not assume autosave/partial save. | — | :137-143
D-01-017 | LOCKED | §C | back/parity | Android system Back and visible app Back have identical logical results. | — | :149
D-01-018 | LOCKED | §C | back/origin-aware | Normal in-app Back is origin-aware (Dashboard→Profile→Back=Dashboard; Orrery→Profile→Back=Orrery; Your Week→Profile→Back=Your Week; Profile→Edit→Back/Save=Profile). | — | :151-157
D-01-019 | LOCKED | §C | back/deep-link-fallback | Externally launched/deep-linked flows use a canonical Orbit fallback when no internal origin exists. **The previous rule that Profile always backs to Dashboard is superseded.** | — | :159-161
D-01-020 | LOCKED | §C | back/no-replay | Completed workflows are removed/replaced in the stack so Back never replays a finished edit screen (Profile→Edit→Save→Profile→Back→Edit must not occur). | — | :163-165
D-01-021 | LOCKED | §C | back/transient-first | Back dismisses the topmost transient layer before navigating (expanded FAB → collapse; modal → dismiss; else navigate). | — | :167-169
D-01-022 | LOCKED | §D | deeplink/completion | Completion destination by action type: contact-specific action → target Profile; Add Contact → new Profile; direct Profile link → Profile; cancel/back from externally launched action with no origin → Dashboard; Back from deep-linked Profile with no origin → Dashboard. | — | :175-181
D-01-023 | LOCKED | §D | deeplink/missing-contact | Missing/deleted deep-link contacts fail safely: friendly "contact no longer available", route to Dashboard; never crash or silently retarget. | — | :183-185
D-01-024 | LOCKED | §E | fab/universal | One universal capture/action FAB system representing the low-friction capture philosophy. | — | :191-193
D-01-025 | LOCKED | §E | fab/visibility | FAB visibility mirrors bottom-nav visibility. | — | :195
D-01-026 | LOCKED | §E | fab/position | FAB occupies the same position wherever visible: bottom-right, offset above bottom nav and safe areas. | — | :197-199
D-01-027 | LOCKED | §E | fab/glyph | Main FAB uses `+`. | — | :201
D-01-028 | LOCKED | §E | fab/speed-dial | FAB expands as a labeled Android-style speed dial; each child action icon + text. | — | :203-205
D-01-029 | LOCKED | §E | fab/scrim | Expanded FAB uses a subtle translucent scrim. | — | :207
D-01-030 | LOCKED | §E | fab/dismiss | Speed dial dismissed by main FAB, scrim/outside tap, Back, or selecting an action. | — | :209
D-01-031 | LOCKED | §F (superseded by D-01-002) | fab/five-actions-stale | Body text still says "Canonical action set contains five actions: Add Contact, Quick Log, Log Contact, Update Contact, Memory (working title)". Superseded by the amendment per D-01-010. | 12 | :215-222
D-01-032 | LOCKED | §F | fab/fixed-order | Action ordering stays fixed across screens. | — | :224
D-01-033 | LOCKED | §F | fab/context-preselect | Current contact context preselects the target where appropriate (from a Profile, Quick Log / Log Contact / Update Contact / Memory target that contact; Add Contact untargeted); from global contexts contact-specific actions invoke the shared picker. | — | :226-230
D-01-034 | LOCKED | §G | picker/canonical | One reusable canonical contact-picker component, reused by Quick Log, Log Contact, Update Contact, Memory, future workflows/widgets. | — | :236-238
D-01-035 | LOCKED | §G | picker/surface | Picker is a compact modal/bottom-sheet, not a route into Dashboard search; includes search, short prioritized initial list, live filtering, clear single-contact selection. | — | :240-242
D-01-036 | LOCKED | §G | picker/ordering | Initial ordering: Favorites, then recently relevant/interacted-with, then remaining alphabetically. | 04 | :244-247
D-01-037 | LOCKED | §G | picker/archived | Archived contacts hidden normally but surface through explicit search with an Archived badge. | — | :249
D-01-038 | DEFERRED-DECISION | §G | picker/archive-after-action | What happens to archive state after a new action on an archived contact is deferred (Phase 12 §K later decides archived participants stay archived). | 12 | :251,:405
D-01-039 | LOCKED | §G | picker/snoozed | Snoozed contacts remain selectable with a visible Snoozed marker; explicit intent overrides passive snooze suppression. | — | :253-255
D-01-040 | LOCKED | §H | quicklog/immediate | Quick Log writes immediately once the target is known (Profile: FAB→Quick Log writes; Global: FAB→Quick Log→choose contact→write). | 13 | :261-265
D-01-041 | LOCKED | §H | quicklog/now | Quick Log means "now"; backdating/details belong to Log Contact. | 13 | :267
D-01-042 | LOCKED | §H | quicklog/feedback | Successful Quick Log shows a snackbar with Undo plus subtle success haptic. | — | :269
D-01-043 | LOCKED | §H | quicklog/failure | Failed Quick Log shows an error snackbar with Retry where recoverable; never show success unless the DB write committed. | — | :271-273
D-01-044 | LOCKED | §I | appbar/architecture | Standardized app-bar architecture: root tabs (title/brand, optional trailing utilities/overflow, no Back); child/read screens (Back, title, optional trailing); focused workflows (Back/Cancel, workflow title, primary completion action by owning phase). | — | :279-294
D-01-045 | LOCKED | §I | appbar/dashboard-branded | Dashboard is the branded root; Orrery, Backup/Restore, Settings use explicit titles; styling owned by Theme. | 02 | :296-300
D-01-046 | LOCKED | §J | safe-area/status-bar | Android status bar integrates with the theme; background may extend behind it; icons adapt for contrast; interactive content inset. | 02 | :306-308
D-01-047 | LOCKED | §J | safe-area/primitives | Shared shell primitives own device/system insets; screens must not guess padding. | — | :310-312
D-01-048 | LOCKED | §J | safe-area/edge-to-edge | Immersive surfaces may render edge-to-edge; interactive controls obey safe areas. | 08 | :314
D-01-049 | LOCKED | §J | safe-area/bottom-nav | Bottom nav uses a consistent bar plus the device bottom inset. | — | :316
D-01-050 | LOCKED | §J | safe-area/clearance | Scrollable content includes bottom clearance so final items scroll above nav/FAB. | — | :318
D-01-051 | LOCKED | §K | keyboard/hide-nav-fab | Bottom nav and FAB temporarily hide while the software keyboard is open. | — | :324
D-01-052 | LOCKED | §K | keyboard/aware | Shared keyboard-aware behavior: focused control and the primary completion action remain reachable; implementation may use resize, scrolling, insets, or modal resizing. | 13 | :326-330
D-01-053 | LOCKED | §L | motion/conventional | Navigation uses conventional mechanics with restrained branded motion; no heavy cinematic/orbital navigation. | 02 | :336-338
D-01-054 | LOCKED | §L | motion/tab-crossfade | Bottom-tab switching uses a very short crossfade; no horizontal slide, no swipe-between-tabs. | — | :340-342
D-01-055 | LOCKED | §M | haptics | Haptics restrained and semantic: light (FAB open), success (Quick Log), warning (destructive confirmation), none for ordinary taps; API mappings tunable. | — | :348-355
D-01-056 | LOCKED | §N | a11y/shell | Accessibility architecture begins in Phase 1: labels, names consistent with visible labels, touch targets, focus order, modal/speed-dial focus management, restore focus, announcements, no colour/animation-only meaning. Release hardening audits accessibility; it does not introduce it. | 18 | :361-373
D-01-057 | LOCKED | Routing Contract | routing/semantic-routes | Dedicated semantic internal routes (contact profile, new contact, quick log, log contact, update contact, Memory/add remembered item [+ Group Log per D-01-004]) plus a generic external dispatcher translating widget/notification/deep-link intents; exact URL syntax is implementation detail. | 12,13 | :379-391
D-01-058 | XREF | Cross-Phase | xref/shell→all | All UI phases use shared safe-area/page-shell primitives. | all | :397
D-01-059 | XREF | Cross-Phase | xref/shell→browse | Browse/read surfaces preserve bottom nav and FAB unless intentionally focused. | all | :398
D-01-060 | XREF | Cross-Phase | xref/shell→focused | Focused workflows hide nav/FAB and protect unsaved changes with Discard/Keep editing. | 09,10,12,13,14 | :399
D-01-061 | XREF | Cross-Phase | xref/shell→profile-origin | Profiles return to actual in-app origin; do not restore "Profile always backs to Dashboard". | 04,05,08,10 | :400
D-01-062 | XREF | Cross-Phase | xref/shell→actions (stale) | "Universal actions are Add Contact, Quick Log, Log Contact, Update Contact, and Memory" — superseded by D-01-002/D-01-010 (should include Group Log). | 12,13 | :401
D-01-063 | XREF | Cross-Phase | xref/shell→knowledge | `Memory` is only a working label; final terminology and semantics belong to Contact Knowledge (Phase 3). | 03 | :402
D-01-064 | XREF | Cross-Phase | xref/shell→rapid | Quick Log is current-time, immediate, reversible via Undo, explicitly reports failures. | 13 | :403
D-01-065 | XREF | Cross-Phase | xref/shell→widgets | Fast-entry workflows remain independently routable/deep-linkable; widget design deferred. | — | :404
D-01-066 | XREF | Cross-Phase | xref/shell→lifecycle | Archived contacts can surface through explicit picker search; whether acting on one restores it is unresolved here. | 12 | :405
D-01-067 | XREF | Cross-Phase | xref/shell→snooze | Snoozed contacts remain selectable in explicit pickers and are marked. | 04 | :406
D-01-068 | XREF | Cross-Phase | xref/shell→theme | Status-bar, scrims, FAB/app-bar styling, motion resolve through theme tokens. | 02 | :407
D-01-069 | XREF | Cross-Phase | xref/shell→a11y | Later phases inherit shell accessibility primitives. | all | :408
D-01-070 | XREF | Cross-Phase | xref/shell→responsive | Shell avoids new portrait-only structural assumptions though landscape comes later. | 18 | :409
D-01-071 | DEFERRED-FEATURE | Explicitly Deferred | deferred/shell | Detailed Add Contact/Log Contact forms; Update Contact taxonomy; final Memory terminology; archive-state after action; widget design; deep-link URL syntax; exact tokens; landscape/tablet nav; global search; auth/identity; screen-specific a11y. (Items also owned by 03/13 are DEFERRED-DECISION from Phase 1's perspective.) | 03,13 | :415-426
D-01-072 | LOCKED | Success Criteria | sc/1-9 | SC1 four tabs w/ safe areas; SC2 stacks + retap; SC3 Back parity/origin-aware/no replay; SC4 FAB consistent, "five-action" (read six per D-01-010), preselects context; SC5 shared picker ordering + archived/snoozed; SC6 Quick Log minimal friction + truthful Undo/Retry; SC7 top bars/insets/keyboard/clearance via primitives; SC8 widget/deep-link ready; SC9 a11y + haptic primitives. | — | :434-442
D-01-073 | LOCKED | Notes for GSD | note/atomic-reqs | Convert decisions to atomic user-observable requirements; Phase 1 early prerequisite. | — | :448-450
D-01-074 | LOCKED | Notes for GSD | note/no-rapid-capture | Do not pull Rapid Capture business flows into Phase 1. | 13 | :451
D-01-075 | LOCKED | Notes for GSD | note/memory-title | `Memory` is a working title, not final terminology. | 03 | :452
D-01-076 | LOCKED | Notes for GSD | note/portrait | Portrait lock may remain until the responsive phase; no new structural assumptions preventing landscape. | 18 | :453

## Phase 02 — Theme & Visual System · `phase-02-theme-visual-system-dossier.md`

Legend :13-17: [DECIDED]/[DERIVED]/[DEFERRED].

D-02-001 | LOCKED | Scope | scope | Defines the cross-app visual system; does not fully redesign individual screens; later phases inherit. | all | :7-11
D-02-002 | LOCKED | §A | theme/axes | Theme package (Galaxy, Standard) and appearance mode (Light, Dark, Follow System) are separate axes. | — | :23-34
D-02-003 | LOCKED | §A | theme/follow-system | Follow System ships from the start. | — | :36
D-02-004 | LOCKED | §A | theme/default | First-launch default is Galaxy + Follow System; onboarding may offer an early appearance choice. | 17 | :38-40
D-02-005 | LOCKED | §B | theme/standard-identity | Standard is soft-modern, neutral, calmer than Galaxy. | — | :46-48
D-02-006 | LOCKED | §B | theme/galaxy-identity | Galaxy is dramatic deep-space branding: ambience, luminous accents, tasteful glow, celestial identity, not neon cyberpunk. | — | :50-52
D-02-007 | LOCKED | §B | theme/shared-layout | Themes share layout and IA; switching must not change density, placement, hierarchy, navigation, interaction. | — | :54-56
D-02-008 | LOCKED | §B | theme/decorative-diff | Small decorative differences allowed (Galaxy glow/transparency; Standard flatter borders, softer shadows). | — | :58-60
D-02-009 | DERIVED | §B | theme/one-component-api | One semantic component API across both themes; no parallel component families except truly specialized cases. | — | :62-64
D-02-010 | LOCKED | §C | accent/curated | Users choose from a curated accent palette, ~8–10 choices. | 15 | :70-72
D-02-011 | LOCKED | §C | accent/scope | Accent affects controls plus restrained decorative highlights (nav active, FAB, toggles, selected controls, links, focus, small highlights). | — | :74-76
D-02-012 | LOCKED | §C | accent/owner-star-separate | Owner/star colour is separate from UI accent. | 08 | :78
D-02-013 | DERIVED | §C | accent/validated | Curated accents validated across all theme/mode combinations. | — | :80
D-02-014 | LOCKED | §D | theme/per-package-defaults | Each theme package has its own default accent and background. | — | :86
D-02-015 | LOCKED | §D | theme/per-package-memory | Galaxy and Standard remember their own appearance choices separately; switching back restores last-used accent/background. | — | :88-90
D-02-016 | LOCKED | §D | theme/live-preview | Appearance settings preview live (theme, mode, accent, background). | 15 | :92-94
D-02-017 | DERIVED | §D | theme/restore-before-render | Theme-critical preferences restore before main UI render to avoid wrong-theme flash. | — | :96
D-02-018 | LOCKED | §E | background/presets | Preset backgrounds supported; user-uploaded backgrounds deferred. | — | :102-104
D-02-019 | LOCKED | §E | background/shared-library | Packages provide defaults/recommendations; users choose from the shared bundled preset library. | — | :106
D-02-020 | LOCKED | §E | background/count | ~4–5 curated backgrounds per theme (Galaxy starfields/nebulae/gradients; Standard soft textures/gradients/geometric). | — | :108-112
D-02-021 | LOCKED | §E | background/none | "None / Solid" is a valid background option. | — | :114
D-02-022 | LOCKED | §E | background/fixed | Backgrounds remain fixed while content scrolls. | — | :116
D-02-023 | LOCKED | §E | surface/opacity-by-density | Surface opacity varies by content density; readability wins. | — | :118-120
D-02-024 | LOCKED | §E | background/standard-quieter | Standard backgrounds visually quieter than Galaxy. | — | :122
D-02-025 | LOCKED | §E | assets/local | All shipped visual assets bundled locally; appearance has no network dependency. | — | :124-126
D-02-026 | DEFERRED-FEATURE | §E | deferred/remote-packs | Downloadable/remote background packs. | — | :128
D-02-027 | LOCKED | §F | glass/galaxy | Galaxy may use strong glassmorphism (translucency, blur, luminous borders, glow, depth). | — | :134-136
D-02-028 | LOCKED | §F | glass/standard | Standard remains cleaner/flatter. | — | :138
D-02-029 | LOCKED | §F | glass/dense-opaque | Dense content can become more opaque even in Galaxy. | — | :140
D-02-030 | LOCKED | §F | glass/forms | Focused forms keep themed backgrounds but place content on mostly opaque readable surfaces. | 13 | :142
D-02-031 | DERIVED | §F | glass/fallback | Blur degrades gracefully on poor performance; requirement is glass-like surface, not expensive rendering. | 18 | :144-146
D-02-032 | LOCKED | §G | motion/ambient | Galaxy backgrounds may use very subtle ambient motion (star drift, twinkle, minimal parallax). | — | :152-154
D-02-033 | LOCKED | §G | motion/reduced | Orbit respects OS reduced-motion; nonessential motion stops or simplifies. | 08,09,11 | :156-158
D-02-034 | DERIVED | §G | motion/orrery-expressive | Orrery remains the visually expressive motion-heavy surface. | 08 | :160
D-02-035 | LOCKED | §H | type/roles | Distinctive display role plus highly readable body/UI role. | — | :166
D-02-036 | LOCKED | §H | type/semantic-roles | Semantic roles (display, heading, body, label, caption) so themes can remap fonts later. | — | :168-170
D-02-037 | LOCKED | §H | type/hierarchy | Hierarchy screen-dependent: presentation more expressive; utility/forms tighter. | — | :172-174
D-02-038 | LOCKED | §H | type/scaling | Respect system text scaling broadly. | 18 | :176
D-02-039 | LOCKED | §H | type/reflow | Reflow before truncation or font shrinking. | — | :178
D-02-040 | LOCKED | §I | geometry/rounded | Orbit embraces a very rounded visual language (circles, pills). | — | :184-186
D-02-041 | DERIVED | §I | geometry/hierarchy | Rounding preserves hierarchy; not every component identical. | — | :188
D-02-042 | LOCKED | §J | density/moderate | Default density moderate: compact within components, generous between groups. | — | :194-196
D-02-043 | LOCKED | §J | density/group-hierarchy | Major conceptual groups use visible hierarchy. | — | :198
D-02-044 | DERIVED | §J | density/spacing-scale | Formal spacing scale, not per-screen values. | — | :200
D-02-045 | LOCKED | §K | cards/not-default | Cards are overused; no longer the default wrapper; cards only for meaningful units, else flatter sections/dividers. | 05,06,10 | :206-208
D-02-046 | LOCKED | §K | sections/headers | Major conceptual sections get clear headers. | — | :210
D-02-047 | LOCKED | §L | status/semantic-hues | Relationship/status colours use stable semantic hue families across themes (Stable/Wobbly/Decaying/Rogue recognizable). | 06,07,08,10 | :216-218
D-02-048 | LOCKED | §L | status/not-colour-only | Colour is never the only status cue (text, icon, shape, pattern, legend). | 06,07,08,10 | :220-222
D-02-049 | LOCKED | §L | status/icons-celestial | Status icons mix celestial metaphor with familiar severity cues. | 06,07 | :224
D-02-050 | LOCKED | §L | status/distinct-shapes | Statuses have distinct silhouettes/shapes, not recolored versions of one icon. | 06,07 | :226
D-02-051 | LOCKED | §M | icons/no-custom-family | No full custom icon family this milestone; overhaul deferred for time-to-market. | — | :232-234
D-02-052 | LOCKED | §M | icons/one-base-family | Use one cohesive base icon family now. | — | :236
D-02-053 | LOCKED | §M | icons/registry | Architecture makes later custom-icon replacement easy: centralized semantic icon registry/component; no arbitrary asset imports. | all | :238-240
D-02-054 | LOCKED | §M | icons/variants | Registry supports visual state/variant (outline/filled, active/inactive, selected/unselected). | — | :242-244
D-02-055 | LOCKED | §M | icons/outline-active-filled | Normal state may be outline, active filled. | — | :246
D-02-056 | DEFERRED-FEATURE | §M | deferred/custom-icons | Fully custom Orbit icon family. | — | :248
D-02-057 | DERIVED | §M | icons/no-coupling | Screens/business logic must not couple to third-party icon names. | — | :250
D-02-058 | LOCKED | §N | illustration/architect-only | Architect for semantic illustration assets; no full library now. | — | :256
D-02-059 | LOCKED | §N | empty-states/richness | Empty-state richness by importance: routine = icon + copy + CTA; major first-use may use illustration. | 06,07 | :258-260
D-02-060 | LOCKED | §O | modals/variants | Standardized modal/sheet variants: compact sheet, detail/half-height sheet, full-screen modal, confirmation dialog; shared radius, scrim, safe-area, spacing, type, drag-handle conventions. | 05,11 | :266-274
D-02-061 | LOCKED | §P | buttons/hierarchy | Formal action hierarchy: Primary, Secondary, Tertiary/text, Destructive, Icon-only. | — | :280-287
D-02-062 | LOCKED | §P | buttons/destructive | Destructive actions use a distinct semantic visual language; colour not the only cue. | — | :289-291
D-02-063 | LOCKED | §Q | a11y/contrast | Functional content targets strong AA-equivalent contrast; decorative effects freer if meaningless. | — | :297-299
D-02-064 | LOCKED | §Q | a11y/both-themes | Accessibility must survive both themes. | — | :301
D-02-065 | DERIVED | §Q | a11y/qa | Accents, glass, text, status colours QA'd across combinations. | 18 | :303
D-02-066 | LOCKED | §R | orrery/background-exception | Orrery follows the theme package but gets a specialized visualization background; need not use the selected app background. | 08 | :309-311
D-02-067 | LOCKED | §R | orrery/visual-exception | Orrery is an intentional visual exception (stronger glow, edge-to-edge, more motion, fewer opaque surfaces, custom overlays) while respecting tokens and a11y. | 08,09 | :313-315
D-02-068 | DERIVED | Derived Arch | tokens/full-system | Full semantic token system centralizing colour, typography, spacing, radii, elevation/glow, opacity, motion, icon sizing, surface treatment. | all | :321-332
D-02-069 | DERIVED | Derived Arch | tokens/semantic-roles | Meaningful colours resolve through semantic roles, not hardcoding. | all | :334
D-02-070 | DERIVED | Derived Arch | tokens/packages-resolve | Theme packages resolve tokens rather than forking screens. | — | :336
D-02-071 | DERIVED | Derived Arch | tokens/no-density-change | Theme changes do not alter information density. | — | :338
D-02-072 | DERIVED | Derived Arch | assets/provenance | Maintain asset provenance/license info to ship purchased/third-party/generated assets safely. | — | :340
D-02-073 | XREF | Cross-Phase | xref/theme→all | All screens use the shared semantic design system. | all | :346
D-02-074 | XREF | Cross-Phase | xref/theme→dashboard-profile-settings | Do not restore pervasive card-boxing. | 05,06,07,10,15 | :347
D-02-075 | XREF | Cross-Phase | xref/theme→forms | Dense forms favor opaque readable surfaces. | 13 | :348
D-02-076 | XREF | Cross-Phase | xref/theme→a11y | Colour not sole carrier; text scaling, contrast, reduced motion supported. | all | :349
D-02-077 | XREF | Cross-Phase | xref/theme→icons | Screens use semantic icon identifiers. | all | :350
D-02-078 | XREF | Cross-Phase | xref/theme→future-icons | Custom icons swappable through registry mappings/assets. | — | :351
D-02-079 | XREF | Cross-Phase | xref/theme→orrery | Orrery immersive but tokenized/accessible. | 08 | :352
D-02-080 | XREF | Cross-Phase | xref/theme→settings | Appearance configuration exposes Theme, Mode, Accent, Background with live preview. | 15 | :353
D-02-081 | XREF | Cross-Phase | xref/theme→onboarding | Initial default Galaxy + Follow System. | 17 | :354
D-02-082 | XREF | Cross-Phase | xref/theme→performance | Glass/blur may fall back. | 18 | :355
D-02-083 | DEFERRED-FEATURE | Explicitly Deferred | deferred/theme | User-uploaded backgrounds; remote packs; CDN delivery; custom icon family; illustration library; user density; unrestricted accent picker; radically different layouts; theme-specific fonts; exact font families/tokens/timings/assets/palette/status artwork. | — | :361-375
D-02-084 | LOCKED | Success Criteria | sc/1-13 | SC1 independent Galaxy/Standard × Light/Dark/System; SC2 one component system, distinct looks; SC3 live preview, no wrong-theme flash; SC4 per-theme memory; SC5 bundled backgrounds + solid, no network; SC6 Galaxy glass readable, Standard calmer; SC7 primitives; SC8 accessible accents; SC9 status without colour alone; SC10 semantic icon swap; SC11 consistent hierarchy; SC12 reduced motion/dynamic text/contrast; SC13 Orrery immersive within rules. | — | :383-395
D-02-085 | LOCKED | Notes for GSD | note/prereq | Phase 2 is a prerequisite for later redesigns; requirements = observable theming + enabling contracts. | — | :401-402
D-02-086 | LOCKED | Notes for GSD | note/no-icon-critical | Do not make the custom-icon overhaul release-critical. | — | :403
D-02-087 | LOCKED | Notes for GSD | note/no-remote-backend | Do not create a remote appearance/backend subsystem for bundled backgrounds. | — | :404
D-02-088 | LOCKED | Notes for GSD | note/standard-calm | Galaxy ambitious; Standard genuinely calmer. | — | :405
D-02-089 | LOCKED | Notes for GSD | note/rounded | Highly rounded geometry is intentional. | — | :406
D-02-090 | LOCKED | Notes for GSD | note/no-card-everything | Later phases must not interpret "design system" as "wrap everything in cards". | 05,06,07,10 | :407

## Phase 03 — Contact Knowledge Foundation · `phase-03-contact-knowledge-foundation-dossier.md`

Legend :5-8.

D-03-001 | LOCKED | Scope | scope | Defines the durable contact-knowledge model for Profile, Search, Update Contact, AI Compose, Import, Backup/Restore, future Sync. | 04,10,13,14,16 | :11
D-03-002 | LOCKED | §A | model/unified-surface | Things to Remember is one unified product surface over multiple underlying data structures. | 10 | :14
D-03-003 | LOCKED | §A | model/first-class-schema | Preserve a stable first-class contact schema for true profile/state properties (Birthday, Current Location, Social Battery, Contact Frequency, Gravity/Closeness, category/group, similar). | — | :16
D-03-004 | DERIVED | §A | model/semantic-abstraction | Search, Profile, AI, Update Contact consume a semantic knowledge abstraction, not table ownership. | 04,10,13,16 | :18
D-03-005 | LOCKED | §B | memory/typed-label | Memory items are typed and support an optional custom label. | — | :21
D-03-006 | LOCKED | §B | memory/registry | Built-in Memory types centrally defined in a registry with display name, icon semantic, cardinality, history behavior, searchability, AI defaults, presentation hints, value shape. | 04,10,13,16 | :23
D-03-007 | LOCKED | §B | memory/custom-type | Users get flexibility through a generic Custom type with a user-defined label. | — | :25
D-03-008 | LOCKED | §B | memory/cardinality | Cardinality is type-defined. | — | :27
D-03-009 | LOCKED | §C | lta/history | Last Talked About: full history retained. | 10,13 | :30
D-03-010 | LOCKED | §C | lta/profile | Profile shows only the most recent entry as the primary card/value; tap-in shows the complete backlist. | 10 | :32
D-03-011 | LOCKED | §C | lta/editable | Historical entries remain editable. | 11 | :34
D-03-012 | DEFERRED-FEATURE | §C | deferred/lta-auto | Automatic derivation from interaction notes. | — | :36
D-03-013 | LOCKED | §D | relationships/structured | Relationships are structured repeatable records: person/name, relation type, optional linked Orbit contact. | 08,10 | :39
D-03-014 | LOCKED | §D | relationships/optional-link | Linking to an Orbit contact is optional. | 08 | :41
D-03-015 | LOCKED | §E | history/preserve | History-aware current-state fields preserve previous values when superseded. | 10,11 | :44
D-03-016 | LOCKED | §E | history/metadata | History behavior is centrally defined by field/type metadata. | — | :46
D-03-017 | LOCKED | §E | history/promote | Some historical values may be promoted back to current when appropriate. | — | :48
D-03-018 | LOCKED | §E | history/editable | Historical entries are editable. | 11 | :50
D-03-019 | LOCKED | §F | location/first-class-history | Current Location is a first-class field with retained historical locations underneath. | 10,11 | :53
D-03-020 | LOCKED | §G | ttr/surface | First-class fields, custom fields, structured relationships, and Memory items appear inside one broader Things to Remember surface. | 10 | :56
D-03-021 | LOCKED | §G | ttr/grouped | The surface is visually grouped, not a single feed. | 10 | :58
D-03-022 | LOCKED | §G | ttr/featured-first | Featured/current information first, then grouped detail. | 10 | :60
D-03-023 | LOCKED | §G | ttr/visibility-defaults | Types/groups can have Profile visibility defaults; individual items can override. | 10 | :62
D-03-024 | LOCKED | §G | ttr/hidden-presentation-only | Hidden-from-Profile is presentation-only, not a privacy rule. | 10 | :64
D-03-025 | LOCKED | §H | search/scope | Dashboard search may search contact name, Memory labels/values, relationship names, appropriate custom-field content. | 04 | :67
D-03-026 | LOCKED | §H | search/no-internal | Internal metadata is not searched. | 04 | :69
D-03-027 | LOCKED | §I | memory/outdated | Memories can be marked outdated/inactive without deletion. | — | :72
D-03-028 | LOCKED | §I | memory/soft-delete | Memory deletion is soft-delete. | — | :74
D-03-029 | LOCKED | §I | memory/trash-restore | Users can restore deleted Memories from Recently Deleted/Trash. | 15? | :76
D-03-030 | LOCKED | §J | memory/pin | Individual repeatable Memory items can be pinned. | 10 | :79
D-03-031 | LOCKED | §J | memory/type-priority | Types/groups may have priority/order. | 10 | :81
D-03-032 | DEFERRED-FEATURE | §J | deferred/freeform-order | Full freeform ordering of every Memory. | — | :83
D-03-033 | LOCKED | §K | memory/notes | Memory items support optional notes. | 13 | :86
D-03-034 | LOCKED | §K | memory/links | Links/URLs supported. | — | :88
D-03-035 | LOCKED | §K | memory/date | Memory items may have an optional meaningful date. | 06 | :90
D-03-036 | DEFERRED-FEATURE | §K | deferred/attachments | Rich attachments (images/files/screenshots/documents). | — | :92
D-03-037 | LOCKED | §L | provenance/lightweight | Source metadata is lightweight, structured, optional, shown primarily in detail/edit views. | — | :95
D-03-038 | DEFERRED-FEATURE | §L | deferred/audit | Full immutable provenance/audit history. | — | :97
D-03-039 | LOCKED | §M | ai/privacy-first | AI use is privacy-first and opt-in at the information level. | 14,16 | :100
D-03-040 | LOCKED | §M | ai/two-gates | AI use has at least two gates: AI globally enabled, then specific field/item permission. | 16 | :102
D-03-041 | LOCKED | §M | ai/default-off | Per-field/per-item AI permission defaults OFF. | 16 | :104
D-03-042 | LOCKED | §M | ai/manage-local-central | AI inclusion is manageable locally and in a central AI review/manage surface. | 16 | :106
D-03-043 | LOCKED | §M | ai/type-defaults | Type-level defaults plus per-item overrides supported. | 16 | :108
D-03-044 | LOCKED | §M | ai/type-default-new-only | Changing a type-level default affects newly created items only. | 16 | :110
D-03-045 | LOCKED | §M | ai/sparkle-icon | AI-enabled items/fields show the generic sparkle/AI icon. | 02,10 | :112
D-03-046 | DERIVED | §M | ai/semantic-context | AI context assembly must preserve semantic type meaning. | 16 | :114
D-03-047 | LOCKED | §N | offlimits/meaning | Off Limits = conversation topics not to bring up with that contact. | 10,14,16 | :117
D-03-048 | LOCKED | §N | offlimits/not-privacy | Not a hidden-data, privacy, or system-suppression flag. | 10,14 | :119
D-03-049 | LOCKED | §N | offlimits/visible | Off Limits information remains visible where relevant. | 10,14 | :121
D-03-050 | LOCKED | §N | offlimits/separate-from-ai | Off Limits and AI permission are separate controls. | 16 | :123
D-03-051 | LOCKED | §N | offlimits/ai-avoid | If an Off Limits item is sent to AI, the model must receive "avoid mentioning this topic", not treat it as fuel. | 14,16 | :125
D-03-052 | LOCKED | §O | customfields/structured | Custom Fields remain structured rather than collapsed into generic Memory. | 10 | :128
D-03-053 | LOCKED | §O | customfields/in-ttr | They surface inside Things to Remember. | 10 | :130
D-03-054 | LOCKED | §O | customfields/history-retained | Custom fields may be current-only or history-retained. | 11 | :132
D-03-055 | LOCKED | §O | customfields/groups | Optional categories/groups supported. | 10 | :134
D-03-056 | LOCKED | §O | customfields/types | Broad typed custom fields: Text, Long Text, Number, Date, Yes/No, URL, Email, Phone, Choice/Select. | 13 | :136
D-03-057 | LOCKED | §O | customfields/global-or-oneoff | Definitions may be global or one-off per contact. | 13 | :138
D-03-058 | LOCKED | §O | customfields/promote | One-off fields can optionally be promoted to reusable definitions. | 13 | :140
D-03-059 | DEFERRED-FEATURE | §O | deferred/tags | Tags. | — | :142
D-03-060 | LOCKED | §P | import/normal | Imported contact data populates the local model normally. | — | :145
D-03-061 | LOCKED | §P | import/ai-off | Imported data remains AI-off by default. | 16 | :147
D-03-062 | LOCKED | §P | import/notes-memory | Freeform phone-contact notes import as a dedicated Memory type, working name "Imported from Contacts App". | 10 | :149
D-03-063 | DEFERRED-FEATURE | §P | deferred/ai-classify | Automatic AI classification of imported notes. | — | :151
D-03-064 | LOCKED | §Q | backup/full-model | Backup/restore preserves the full knowledge model: current values, history, Memories, custom fields, relationships, Profile visibility, pinning, AI permissions, provenance, soft-deleted records, type references. | — | :154
D-03-065 | DERIVED | Derived Arch | arch/knowledge-service | Unified semantic knowledge service/query layer for Profile, Search, AI, Update Contact, widgets, Sync. | 04,10,13,16 | :157
D-03-066 | DERIVED | Derived Arch | arch/central-registry | Central built-in field/type registry. | — | :159
D-03-067 | DERIVED | Derived Arch | arch/memory-storage | Generic Memory storage may be supplemented by structured metadata/linked records. | — | :161
D-03-068 | DERIVED | Derived Arch | arch/explicit-permissions | Privacy permissions are explicit state, never inferred from type or storage location. | 16 | :163
D-03-069 | XREF | Cross-Phase | xref/→profile | Profile: one Things to Remember surface; current values lead; history opens on drill-in. | 10 | :166
D-03-070 | XREF | Cross-Phase | xref/→search | Dashboard Search searches remembered content through the unified model. | 04 | :167
D-03-071 | XREF | Cross-Phase | xref/→update-contact | Update Contact edits first-class fields and typed remembered information without the full Edit Contact form. | 13 | :168
D-03-072 | XREF | Cross-Phase | xref/→ai-compose | AI Compose: explicit opt-in, default off, semantic preservation incl. Off Limits = avoid topic. | 14,16 | :169
D-03-073 | XREF | Cross-Phase | xref/→ai-settings | AI Settings: central permission review/manage surface. | 16 | :170
D-03-074 | XREF | Cross-Phase | xref/→import | Import: data stays local and AI-off; freeform notes become Imported-from-Contacts-App Memories. | — | :171
D-03-075 | XREF | Cross-Phase | xref/→backup | Backup/Restore: full knowledge/history/privacy fidelity. | — | :172
D-03-076 | XREF | Cross-Phase | xref/→sync | Future Sync: current values, history, soft deletion, permissions, provenance, custom fields, relationships are real sync state. | — | :173
D-03-077 | XREF | Cross-Phase | xref/→icons | AI-enabled state uses the semantic sparkle/AI icon. | 02 | :174
D-03-078 | DEFERRED-FEATURE | Explicitly Deferred | deferred/p3 | Auto extraction from notes; AI classification of imported notes; attachments; arbitrary user-created system types; tags; immutable audit; final layout/section names; exact Update Contact UX; exact card appearance; exact AI payload; widget UX; sync conflict semantics. (Final TTR layout/names, Update Contact UX, card appearance, AI payload are DEFERRED-DECISION for 10/13/16.) | 10,13,16 | :177-188
D-03-079 | LOCKED | Success Criteria | sc/1-12 | SC1 distinct families under one concept; SC2 central registry; SC3 history where configured; SC4 LTA history + latest; SC5 relationships w/ optional link; SC6 Memory features (labels, values, notes, dates, links, source, pinning, visibility, soft delete, restore); SC7 search without storage dependence; SC8 AI permissions default off, manageable, survive backup; SC9 Off Limits modeled as avoid-topic; SC10 custom fields typed, structured, optionally historical, categorizable, in TTR; SC11 imported notes preserved + AI-off; SC12 backup preserves model. | — | :191-202
D-03-080 | LOCKED | Notes for GSD | note/prereq | Prerequisite for Profile, Update Contact, AI Compose, widgets. | 10,13,14 | :205
D-03-081 | LOCKED | Notes for GSD | note/no-flatten | Do not flatten all knowledge into one generic text table. | — | :206
D-03-082 | LOCKED | Notes for GSD | note/no-infer-ai | Do not infer AI eligibility from storage location or Memory type. | 16 | :207
D-03-083 | LOCKED | Notes for GSD | note/opt-in | Privacy posture is explicit opt-in, default off. | 16 | :208
D-03-084 | LOCKED | Notes for GSD | note/offlimits | Do not misinterpret Off Limits as a hidden/private-content control. | 10,14 | :209
D-03-085 | LOCKED | Notes for GSD | note/migrations | Import and Backup/Restore may need migrations/compatibility updates because this phase expands durable local state. | — | :210

## Phase 04 — Dashboard Data & State Foundation · `phase-04-dashboard-data-state-foundation-dossier.md`

Legend :5-8.

D-04-001 | LOCKED | Scope | scope | Defines nonvisual Dashboard foundation (identity, universe, populations, filters, sort, semantic search, dedup, match contracts, persistence, restoration, shared query architecture); does NOT define List/Card composition, density, status-label placement, row actions, renderer styling. | 05,06,07 | :11-15
D-04-002 | LOCKED | §A | dashboard/role | Dashboard is primarily the contact browser and detail/update entry surface, secondarily relationship command center. | — | :18
D-04-003 | LOCKED | §A | dashboard/orrery-role | Orrery remains the more relationship-health / attention-centric visualization. | 08 | :20
D-04-004 | LOCKED | §A | dashboard/lean | Dashboard remains lean, not a portal of permanent summary modules. | 05 | :22
D-04-005 | DERIVED | §A | dashboard/one-collection | Data architecture optimizes for one contact collection, not multiple simultaneous collections on one scroll surface. | — | :24
D-04-006 | LOCKED | §B | modes/list-card | Initial presentation modes: List and Card. | 06,07 | :27
D-04-007 | LOCKED | §B | modes/shared-state | Both modes consume the same Population / Filters / Sort / Search state. | 06,07 | :29
D-04-008 | DEFERRED-FEATURE | §B | deferred/compact-grid | Compact Card/Grid presentation mode. (NB: Phase 7 v0.2 settles Card View AS a compact 3-column grid — see D-07-004/D-RM-015.) | 07 | :31
D-04-009 | LOCKED | §C | universe/active-default | With no explicit population, Dashboard shows Active Contacts. | — | :34
D-04-010 | LOCKED | §C | universe/implicit | Active Contacts is the implicit/default universe, not an explicit multi-select population. | 05 | :36
D-04-011 | LOCKED | §C | universe/replace | Selecting one or more special populations replaces the implicit universe. | — | :38
D-04-012 | LOCKED | §C | universe/no-archived | Archived contacts are outside the Dashboard result universe. | — | :40
D-04-013 | LOCKED | §C | universe/no-unbound | Unbound contacts are outside the Dashboard result universe. | — | :42
D-04-014 | DERIVED | §C | universe/explicit-model | Query model represents the eligible universe explicitly, not "all contacts" with later exclusions. | — | :44
D-04-015 | LOCKED | §D | populations/initial | Initial special populations: Favorites, Birthdays, Not Contacted, Snoozed. | — | :47-51
D-04-016 | LOCKED | §D | populations/multiselect | Special populations are multi-select. | 05 | :53
D-04-017 | LOCKED | §D | populations/or-union | Multiple selected populations combine as OR-union. | — | :55
D-04-018 | LOCKED | §D | populations/dedupe | Duplicate membership collapses to one contact result. | — | :57
D-04-019 | DERIVED | §D | populations/match-reasons | Result data may retain all population-match reasons though deduplicated. | 06,07 | :59
D-04-020 | LOCKED | §D | populations/unrestricted | Combinations start unrestricted; only real contradictions introduce compatibility rules. | — | :61
D-04-021 | LOCKED | §D | populations/deselect-final | Deselecting the final explicit population returns immediately to Active Contacts. | 05 | :63
D-04-022 | LOCKED | §E Favorites | favorites/binary | Favorites are binary membership, not a user-visible ranking system. | 06,07 | :68
D-04-023 | DERIVED | §E Favorites | favorites/rank-not-evidence | Any legacy/internal `favourite_rank` must not be treated as evidence for ranked-Favorites UX. | — | :70
D-04-024 | LOCKED | §E Birthdays | birthdays/30-days | Dashboard Birthday population covers the next 30 days. | — | :73
D-04-025 | LOCKED | §E Birthdays | birthdays/your-week | Richer imminent/upcoming birthday presentation belongs to Your Week, not a permanent Dashboard banner/module. | 05,YourWeek | :75
D-04-026 | DERIVED | §E Birthdays | birthdays/default-sort | Under Sort=Default, Birthday population orders soonest first. | — | :77
D-04-027 | LOCKED | §E Not Contacted | never-contacted/in-active | Never-contacted contacts remain eligible for Active Contacts with a neutral/no-status state. | 06,07 | :80
D-04-028 | LOCKED | §E Not Contacted | never-contacted/population | They also have a dedicated Not Contacted population. | — | :82
D-04-029 | LOCKED | §E Snoozed | snoozed/in-active | Snoozed contacts remain in Active Contacts. | 06,07 | :85
D-04-030 | LOCKED | §E Snoozed | snoozed/not-needs-attention | Snoozed contacts are suppressed from Needs Attention; explicit population, eligible search, deliberate actions can still surface them. | — | :87-89
D-04-031 | LOCKED | §F | axes/four | Population, Filters, Sort, Search are separate query axes (eligibility / narrowing / ordering / querying the eligible set). | 05 | :92-97
D-04-032 | DERIVED | §F | axes/independent-state | Represent axes independently in state, not one opaque filter object. | 05 | :99
D-04-033 | LOCKED | §G | filters/initial | Initial filters: Category, Social Battery, Relationship Status / Needs Attention, Gravity / Closeness, Contact Frequency. | — | :102-107
D-04-034 | DEFERRED-FEATURE | §G | deferred/filters | Filters for contact-method presence, remembered-info presence, AI-enabled data, recently updated, arbitrary custom fields, operational predicates. | — | :109
D-04-035 | LOCKED | §G | filters/or-within | Multiple values within one filter category combine with OR. | 09 | :111
D-04-036 | LOCKED | §G | filters/and-across | Different filter categories combine with AND. | 09 | :113-115
D-04-037 | LOCKED | §G | filters/needs-attention | Needs Attention is a filter, not a population. | — | :117
D-04-038 | LOCKED | §G | filters/persist-on-population | Existing Filters remain applied when Population changes; revisit only if usability testing shows confusion. | — | :119-121
D-04-039 | LOCKED | §H | sort/options | Sort exposes: Default, Name A–Z, Name Z–A, Least Recently Contacted, Most Recently Contacted, Relationship Status. | 05 | :124-130
D-04-040 | LOCKED | §H | sort/default-population-aware | Default is population-aware (Active → relationship-health ordering; Birthdays → soonest; Favorites → normal ordering, no favorite-rank sort; Not Contacted → natural; Snoozed → natural). | — | :132-139
D-04-041 | LOCKED | §H | sort/explicit-overrides | Explicit sort overrides population-natural ordering until returned to Default. | — | :141
D-04-042 | LOCKED | §H | sort/survives-population | Changing Population does not erase an explicit sort. | — | :143
D-04-043 | LOCKED | §H | sort/resettable | Sort is independently resettable to Default. | 05 | :145
D-04-044 | DERIVED | §H | sort/persist-semantic | Persist Default vs explicit choice; do not persist a resolved population-specific default as explicit. | — | :147
D-04-045 | LOCKED | §I | search/scope | Search restricted to the currently eligible Population + Filters universe. | 05 | :150
D-04-046 | LOCKED | §I | search/no-archived | Dashboard search never surfaces Archived contacts. | — | :152
D-04-047 | LOCKED | §I | search/no-unbound | Dashboard search never surfaces Unbound contacts. | — | :154
D-04-048 | DERIVED | §I | search/same-pipeline | Search consumes the same eligibility pipeline, not a separate global query repaired afterward. | — | :156
D-04-049 | LOCKED | §J | search/semantic-model | Dashboard search uses the semantic contact-knowledge abstraction of Phase 3. | 03 | :159
D-04-050 | LOCKED | §J | search/metadata-driven | Searchability follows semantic field/type metadata, not a Dashboard-only hardcoded list; searchable: identity/name, Memory labels/values, Memory notes, relationship content, appropriate custom-field content, first-class info (phone/email/location/category). | 03 | :161-169
D-04-051 | LOCKED | §J | search/no-internal | Internal metadata is not searched. | 03 | :171
D-04-052 | LOCKED | §K | search/matching | Forgiving prefix/substring matching plus reasonable typo tolerance. | — | :174
D-04-053 | LOCKED | §K | search/multi-term | Multi-term queries evaluated as combined phrase/intent and as individual terms (e.g. `Andrew kids`). | — | :176-178
D-04-054 | LOCKED | §K | search/coverage-ranking | Ranking favors query-term coverage. | — | :180
D-04-055 | LOCKED | §K | search/identity-priority | Exact identity/name matches receive strong priority. | — | :182
D-04-056 | LOCKED | §K | search/field-priority | Field/type importance contributes: identity/direct > structured relationship > Memory/custom-field > note/body. | — | :184-190
D-04-057 | LOCKED | §K | search/relevance-primary | Relevance primary while searching; Dashboard sort is tie-breaker. | — | :192
D-04-058 | DERIVED | §K | search/score | Contact-level score combining phrase strength, term coverage, match strength, field/type priority. | — | :194
D-04-059 | DERIVED | §K | search/weights-tunable | Exact weights are implementation details tuned with fixtures/tests. | — | :196
D-04-060 | LOCKED | §L | match/multiple-snippets | Results may expose multiple matching snippets per contact. | 06,07 | :199
D-04-061 | LOCKED | §L | match/three-plus-n | Up to three useful matches visible, then `+N more`. | 06,07 | :201
D-04-062 | LOCKED | §L | match/highlight | Matched text is highlighted. | 06,07 | :203
D-04-063 | LOCKED | §L | match/name-not-suppress | A direct name match does not suppress secondary knowledge matches. | — | :205
D-04-064 | DERIVED | §L | match/descriptors | Shared result data carries prioritized match descriptors/snippets plus total match count. | 06,07 | :207
D-04-065 | LOCKED | §M | persist/across-relaunch | Persist across relaunch: List/Card preference, Population, Filters, Sort. | 05 | :210-214
D-04-066 | LOCKED | §M | persist/no-search | Search text does not persist across relaunch. | — | :216
D-04-067 | LOCKED | §M | persist/no-scroll | Scroll position does not persist across fresh launch. | — | :218
D-04-068 | LOCKED | §M | persist/back-restores | Dashboard → Profile → Back restores working state incl. search/filter/population/sort and scroll. | 01 | :220
D-04-069 | LOCKED | §M | persist/fresh-launch | Fresh launch restores persisted view/population/filter/sort at top with search cleared. | — | :222
D-04-070 | LOCKED | §M | persist/shared-state | List and Card share query state; no separate selections per mode. | 06,07 | :224
D-04-071 | DERIVED | §M | persist/durable-vs-ephemeral | Distinguish durable preferences from ephemeral navigation-session state. | — | :226
D-04-072 | LOCKED | §N | reset/per-axis | Each axis independently clearable: Population→Active; Filters→none; Sort→Default; Search→empty. | 05 | :229-233
D-04-073 | LOCKED | §N | reset/global | Global Reset Dashboard View restores Active Contacts, no Filters, Sort=Default, search cleared; preserves List/Card preference. | 05 | :235-243
D-04-074 | DERIVED | §N | reset/one-transition | Reset is one deterministic state transition. | — | :245
D-04-075 | DERIVED | §O | arch/shared-controller | One shared Dashboard controller/query layer owning universe, union/dedupe, filters, sort resolution, semantic search, scoring, match descriptors, persisted vs ephemeral state. | 05,06,07 | :248-258
D-04-076 | DERIVED | §O | arch/stable-result-model | List and Card consume a stable result/presentation model; no duplicate query logic. | 06,07 | :260
D-04-077 | DERIVED | §O | arch/preserve-existing | Preserve useful existing Dashboard read-domain logic where it matches; old filter/search precedence and old layout are not authoritative. | — | :262
D-04-078 | DERIVED | §O | arch/birthday-helper | Continue using the shared birthday parser/domain helper. | — | :264
D-04-079 | XREF | §P | xref/→control-surface | Control Surface operates against the independent query axes. | 05 | :267
D-04-080 | XREF | §P | xref/→list | List View consumes the shared result model; no own query semantics. | 06 | :268
D-04-081 | XREF | §P | xref/→card | Card View same shared model. | 07 | :269
D-04-082 | XREF | §P | xref/→your-week | Your Week owns richer birthday/upcoming presentation; Dashboard owns Birthday population + entry point. | YourWeek (no phase) | :270
D-04-083 | XREF | §P | xref/→orrery | Orrery remains the primary relationship-health visualization. | 08 | :271
D-04-084 | XREF | §P | xref/→knowledge | Search uses semantic knowledge/searchability metadata. | 03 | :272
D-04-085 | XREF | §P | xref/→archived-unbound | Archived/Unbound outside the universe; dedicated management routes. | 05 | :273
D-04-086 | XREF | §P | xref/→a11y | Renderers cannot rely on status colour alone. | 06,07 | :274
D-04-087 | XREF | §P | xref/→future-renderer | Query architecture not coupled to exactly two renderers. | — | :275
D-04-088 | DEFERRED-FEATURE | Explicitly Deferred | deferred/p4 | Compact renderer; ranked Favorites concept; advanced filters; custom-field filtering; global search; exact weights; remote/indexed search; final List/Card composition; snippet treatment; final status presentation. (Ranked Favorites is DEFERRED-DECISION vs ADR-033 — see report.) | 06,07 | :278-288
D-04-089 | LOCKED | Success Criteria | sc/1-11 | SC1 one shared contract; SC2 Active default, OR-union dedupe; SC3 population rules; SC4 OR/AND filters; SC5 Needs Attention filter excludes snoozed; SC6 population-aware Default sort; SC7 search scoped, no Archived/Unbound; SC8 semantic search w/ multi-token coverage and typo tolerance; SC9 up to three highlighted matches + count; SC10 persistence contract; SC11 Reset baseline. | — | :291-301
D-04-090 | LOCKED | Notes for GSD | note/distinct-phase | Distinct integer phase before Control Surface and renderers. | 05 | :304
D-04-091 | LOCKED | Notes for GSD | note/no-duplicate-query | Do not recreate query/search logic in List and Card. | 06,07 | :305
D-04-092 | LOCKED | Notes for GSD | note/no-rank-ux | Do not interpret legacy `favourite_rank` as a requirement for ranked Favorites UX. | — | :306
D-04-093 | LOCKED | Notes for GSD | note/no-global-search | Do not make Dashboard search global. | — | :307
D-04-094 | LOCKED | Notes for GSD | note/sort-list-stable | Do not dynamically rewrite the Sort option list per population. | 05 | :308
D-04-095 | LOCKED | Notes for GSD | note/preserve-helpers | Preserve proven DB/domain helpers where compatible; old UI/query precedence not authoritative. | — | :309
D-04-096 | LOCKED | Notes for GSD | note/weights | Exact search weights are implementation details; behavior/priorities authoritative. | — | :310

## Phase 05 — Dashboard Control Surface · `phase-05-dashboard-control-surface-dossier-amended-group-events.md`

Legend :5-8; amended 2026-09-01 (:3).

D-05-001 | LOCKED | Amendment | header/group-events | Group Events becomes a first-class Dashboard-header destination at the same tier as Your Week: icon + short label when space permits, icon-only fallback, icon-registry lookup, accessible names; routes to the Phase 12 Group Events browse/management page. | 12 | :16-26
D-05-002 | LOCKED | Amendment | header/two-destinations | Prior contract (Your Week sole first-class header destination) superseded; header accommodates Your Week + Group Events. | 12 | :28-34
D-05-003 | DERIVED | Amendment | header/adapt | Header may adapt spacing/label visibility/compactness to keep both usable without displacing controls. | — | :36
D-05-004 | DERIVED | Amendment | header/icon-only-fallback | If both labels cannot stay readable/accessible, fall back to icon-only rather than wrapping, shrinking below supported size, or pushing controls down. | 18 | :38
D-05-005 | LOCKED | Amendment | overflow/group-events | Overflow includes Group Events; amended overflow set: Group Events, Unbound Contacts, Archived Contacts, Manage Favorites, Bulk / Contact Management, Reset Dashboard View. Redundant path intentional. | 12 | :40-52
D-05-006 | LOCKED | Amendment | dashboard/no-group-module | No Group Events feed/cards/analytics/summaries between controls and collection this milestone; lean contact-first principle authoritative. | 12 | :54-58
D-05-007 | LOCKED | Amendment | nav/boundary | No permanent Group Events bottom-nav tab; Dashboard tab not a radial launcher; Dashboard not renamed/rebuilt into Mission Control. | 01 | :60-67
D-05-008 | LOCKED | Amendment | boundary/phase-12 | [BOUNDARY] Phase 5 owns header discovery/entry, responsive coexistence, overflow access, routing into the canonical page; Phase 12 owns persistence, workflow, overrides, Detail/Edit, page contents, lifecycle, atomicity, backup. Do not duplicate. | 12 | :69-87
D-05-009 | DEFERRED-FEATURE | Amendment | deferred/shell | Mission Control; Dashboard rename; radial launcher; Group Events tab; bottom-nav restructuring. | — | :89-96
D-05-010 | LOCKED | Supersession Map | amend/map | Amendment extends §B (Your Week no longer only header destination), §M (add Group Events), §R (Phase 12 boundary + routing), SC7 (Your Week **and Group Events** discoverable from header), SC8 (overflow additionally exposes Group Events). All other decisions intact. | — | :98-108
D-05-011 | LOCKED | Scope | scope | Defines the control shell over the Data & State Foundation; does NOT define query semantics (Phase 4) nor List/Card composition. | 04,06,07 | :113-117
D-05-012 | LOCKED | §A | dashboard/lean | Dashboard remains visually lean so contact content appears early. | — | :120
D-05-013 | LOCKED | §A | dashboard/no-birthday-module | Dashboard does not contain a permanent birthday/upcoming module between controls and contacts; Birthdays via the Birthday population; richer upcoming content belongs to Your Week. | 04,YourWeek | :122-124
D-05-014 | LOCKED | §A | dashboard/top-hierarchy | Working top hierarchy: header/branded root → Population/Filters/Sort row → Search + List/Card row → contact collection; spacing per Theme. | 02 | :126-132
D-05-015 | LOCKED | §B | header/your-week | Your Week remains a first-class Dashboard-owned destination. | — | :135
D-05-016 | LOCKED | §B | header/your-week-icon-label | Your Week appears in the header as icon + short label when space permits; icon-only fallback. | — | :137-139
D-05-017 | DERIVED | §B | header/icon-registry | Icon registry owns the Your Week icon; Your Week navigation inherits origin-aware shell behavior. | 01,02 | :141-143
D-05-018 | LOCKED | §C | controls/three-equal | Population, Filters, Sort appear as three equal conceptual controls in one row; visually/functionally separate. | 04 | :146-148
D-05-019 | LOCKED | §C | controls/no-manage-view | Do not combine them into one Manage View modal/screen. | — | :150
D-05-020 | LOCKED | §C | controls/state-summary | Each control shows its current state inside/under the label (e.g. `Favorites, Birthdays`, `Family, Friends +2`, `Least recent`); names while they fit then `+N`. | — | :152-159
D-05-021 | LOCKED | §C | controls/active-treatment | Non-default state gets restrained additional active treatment; theme-resolved. | 02 | :161-163
D-05-022 | LOCKED | §D | panels/anchored | Population, Filters, Sort use anchored floating panels, not full-screen modals or bottom sheets. | — | :166
D-05-023 | LOCKED | §D | panels/sizes | One interaction family, different sizes: Population medium/large; Filters largest; Sort compact. | — | :168-172
D-05-024 | LOCKED | §D | panels/anchor-to-control | Panels visually anchor to the invoking control. | — | :174
D-05-025 | DERIVED | §D | panels/one-primitive | One reusable floating-control-surface primitive with size/placement variants. | — | :176
D-05-026 | LOCKED | §E | live-apply | Population/Filter/Sort changes apply immediately while open; no Apply/Done step. | — | :178-180
D-05-027 | LOCKED | §E | live-apply/visible-results | Results remain visible and visibly update behind the panel. | 06,07 | :182
D-05-028 | LOCKED | §E | live-apply/inert | Underlying content is interaction-inert while a panel is open. | — | :184
D-05-029 | DERIVED | §E | live-apply/no-accidental-nav | Live feedback must not permit accidental navigation into a contact. | — | :186
D-05-030 | LOCKED | §F | panels/toggle-close | Tapping the active control again closes its panel. | — | :189
D-05-031 | LOCKED | §F | panels/outside-tap | Tapping outside dismisses. | — | :191
D-05-032 | LOCKED | §F | panels/back | Android/system Back dismisses the panel before route navigation. | 01 | :193
D-05-033 | LOCKED | §F | panels/switch | Tapping another control switches directly to the new panel in one interaction. | — | :195
D-05-034 | LOCKED | §F | panels/one-open | Only one floating control panel open at a time. | — | :197
D-05-035 | LOCKED | §F | panels/reopen-top | Reopened panels begin at their top. | — | :199
D-05-036 | LOCKED | §F | panels/zero-results | A live selection producing zero results does not auto-close the panel. | — | :201
D-05-037 | LOCKED | §G | panels/theme-scrim | Background separation is theme-dependent (Galaxy subtle dimming + glass/blur; Standard quieter light scrim, flatter). | 02 | :204-208
D-05-038 | LOCKED | §G | panels/readable-behind | Dashboard content remains readable enough to perceive live changes. | — | :210
D-05-039 | DERIVED | §G | panels/theme-rules | Panels inherit Theme rules for contrast, translucency, blur fallback, reduced motion, tokens; one semantic panel API across themes. | 02 | :212-214
D-05-040 | LOCKED | §H | population/tap-row | Population options toggle by tapping the row/control itself. | — | :217
D-05-041 | LOCKED | §H | population/no-checkbox | Conventional checkbox visuals not required initially. | — | :219
D-05-042 | DERIVED | §H | population/a11y-state | Selection state still needs clear accessible visual/semantic treatment. | — | :221
D-05-043 | LOCKED | §H | population/no-active-row | Active Contacts is not shown as an explicit selectable population inside the panel. | 04 | :223
D-05-044 | LOCKED | §H | population/deselect-final | Deselecting the final explicit population immediately returns to Active Contacts. | 04 | :225
D-05-045 | LOCKED | §I | filters/own-panel | Filters receive their own floating panel; apply live; summarized in top control; clearable within the surface; semantics owned by Phase 4. | 04 | :228-236
D-05-046 | LOCKED | §J | sort/compact-panel | Sort gets a compact panel with explicit Default choice/reset; summarized after close; semantics owned by Phase 4. | 04 | :239-245
D-05-047 | LOCKED | §K | search/below-controls | Search sits below the Population/Filters/Sort row, reading as scoped, not global. | 04 | :248-250
D-05-048 | LOCKED | §K | search/collapsible | Search is collapsible/expandable, not permanently maximal. | — | :252
D-05-049 | DERIVED | §K | search/motion | Expansion/collapse uses restrained branded motion, respects reduced motion. | 02 | :254
D-05-050 | DERIVED | §K | search/no-results-heading | No additional permanent results-heading row solely to host utilities. | — | :256
D-05-051 | LOCKED | §L | toggle/same-row | List/Card selection lives on the same row as Search, right-aligned. | 04 | :259
D-05-052 | LOCKED | §L | toggle/no-fourth-control | Do not add a fourth top-row control for presentation mode. | — | :261
D-05-053 | LOCKED | §L | toggle/width | Search receives most width; List/Card keeps a real accessible touch target; split responsive, not a literal percentage. | — | :263-265
D-05-054 | DERIVED | §L | toggle/icons | Toggle icons via the icon registry with accessible selected state. | 02 | :267
D-05-055 | LOCKED | §M | overflow/initial (pre-amend) | Overflow initially contains Unbound Contacts, Archived Contacts, Manage Favorites, Bulk / Contact Management, Reset Dashboard View (extended by D-05-005). | — | :270-275
D-05-056 | LOCKED | §M | overflow/no-your-week | Your Week is not buried in overflow. | — | :277
D-05-057 | LOCKED | §M | overflow/bulk-home | Bulk/contact-management receives an overflow home now rather than being deferred; "This supports the existing/current import and bulk-management capabilities." | 07 | :279-281
D-05-058 | LOCKED | §N | management/refactor | Archived and Unbound destinations are refactored/re-presented existing screens, not greenfield. | — | :284-286
D-05-059 | LOCKED | §N | management/child-routes | They open as Dashboard child/browse routes, not populations. | 04 | :288
D-05-060 | DERIVED | §N | management/origin-aware | Preserve origin-aware behavior (Dashboard → Archived → Profile → Back → Archived); reuse underlying logic. | 01 | :290-294
D-05-061 | LOCKED | §O | reset/overflow | Overflow exposes Reset Dashboard View; state contract owned by Phase 4 (Active, no Filters, Default, search cleared, List/Card preserved). | 04 | :297-304
D-05-062 | DERIVED | §O | reset/discoverable | Reset discoverable without permanent main-Dashboard space. | — | :306
D-05-063 | LOCKED | §P | hud/anchored-initial | Anchored floating panels are the initial release-quality surface (lower cost than a custom HUD). | — | :309
D-05-064 | DEFERRED-FEATURE | §P | deferred/hud | Branded Orbit HUD overlay/control surface. | — | :311
D-05-065 | DERIVED | §P | hud/three-layers | Separate query/state logic, option-content components, transient container/presentation, so a future HUD is a presentation swap. | — | :313-342
D-05-066 | DERIVED | §Q | a11y/panels | Floating controls need roles, names, state announcements, focus behavior; inert background removed from a11y focus; touch targets; reflow per Theme; Back/active-tab inherit shell rule. | 01,02 | :345-353
D-05-067 | XREF | §R | xref/→data-state | Data & State Foundation authoritative for Population/Filter/Sort/Search semantics and persistence. | 04 | :356
D-05-068 | XREF | §R | xref/→list | List View consumes this shell; does not relocate/reinvent controls. | 06 | :357
D-05-069 | XREF | §R | xref/→card | Card View same shell/state. | 07 | :358
D-05-070 | XREF | §R | xref/→theme | Theme owns token resolution, glass/opacity/scrim/contrast. | 02 | :359
D-05-071 | XREF | §R | xref/→shell | App Shell owns Back, active-tab dismissal, header architecture, safe areas, nav/FAB. | 01 | :360
D-05-072 | XREF | §R | xref/→your-week | Richer birthday/upcoming content lives in Your Week. | YourWeek (no phase) | :361
D-05-073 | XREF | §R | xref/→import-bulk | Existing/current bulk workflows receive a discoverable overflow entry point. | 07 | :362
D-05-074 | XREF | §R | xref/→archived-unbound | Dedicated child routes, not populations. | 04 | :363
D-05-075 | DEFERRED-FEATURE | Explicitly Deferred | deferred/p5 | Custom HUD; combined Manage View; bottom-sheet variants; checkbox chrome; fourth control; permanent birthday module; compact renderer; final List/Card presentation; exact panel dimensions; timings; unnecessary reimplementation of Archived/Unbound. | 06,07 | :366-377
D-05-076 | LOCKED | Success Criteria | sc/1-10 | SC1 lean root; SC2 three-control row w/ summaries; SC3 anchored panels from one family; SC4 live apply + inert; SC5 dismissal/switching; SC6 search below controls + toggle; SC7 Your Week (and Group Events) discoverable from header; SC8 overflow exposes Unbound, Archived, Manage Favorites, Bulk/Contact Management, Reset (+Group Events); SC9 existing Archived/Unbound integrated; SC10 HUD-swappable architecture. | — | :380-389
D-05-077 | LOCKED | Notes for GSD | note/distinct-phase | Distinct integer phase after Phase 4. | 04 | :392
D-05-078 | LOCKED | Notes for GSD | note/no-manage-view | Do not collapse controls into one Manage View. | — | :393
D-05-079 | LOCKED | Notes for GSD | note/one-primitive | Prefer one anchored floating-surface primitive with variants. | — | :394
D-05-080 | LOCKED | Notes for GSD | note/live-apply | Live apply intentional; no Apply/Done unless a genuine blocker. | — | :395
D-05-081 | LOCKED | Notes for GSD | note/inert | Content visible but inert while panel open. | — | :396
D-05-082 | LOCKED | Notes for GSD | note/no-birthday-banner | Do not add a permanent birthday banner/module back to Dashboard. | 04 | :397
D-05-083 | LOCKED | Notes for GSD | note/no-results-row | Do not create a new results-heading row for List/Card controls. | — | :398
D-05-084 | LOCKED | Notes for GSD | note/reuse-mgmt | Reuse/refactor existing Archived/Unbound/bulk-management routes and logic. | 07 | :399
D-05-085 | LOCKED | Notes for GSD | note/option-content | Architect option content independently from the container. | — | :400

## Phase 06 — Dashboard List View · `phase-06-dashboard-list-view-dossier.md`

Legend :5-8.

D-06-001 | LOCKED | Scope | scope | Defines the List renderer; does NOT redefine Population/Filters/Sort/Search, persisted state, control layout, contact-domain behavior, Quick Log rules, Log Contact form, final icon artwork, exact tokens, gesture thresholds, virtualization tuning. | 04,05,13 | :11-15
D-06-002 | LOCKED | §A | list/scan-first | List View is the scan-first renderer. | — | :19-21
D-06-003 | LOCKED | §A | list/denser-than-card | List remains meaningfully denser than Card; not a mini-profile layout. | 07 | :23
D-06-004 | DERIVED | §A | list/resist-modules | Richer presentation belongs to Card/Profile; List resists secondary modules. | 07,10 | :25
D-06-005 | LOCKED | §B | row/anatomy | Each result is a full-width compact card/row with a relatively large circular avatar on the left. | — | :29
D-06-006 | LOCKED | §B | row/three-lines | Three-line stack: name; recency + category; adaptive context. | — | :31-35
D-06-007 | LOCKED | §B | row/favorite-star | Upper-right always-visible Favorite star. | 04 | :37
D-06-008 | LOCKED | §B | row/status-icon | Lower-right non-interactive relationship-status icon when applicable. | 02 | :39
D-06-009 | LOCKED | §B | row/border | Thin border around the row carries status colour in ordinary unsnoozed states. | 02 | :41
D-06-010 | DERIVED | §B | row/stable-geometry | Avatar, text block, corner indicators keep stable geometry. | — | :43
D-06-011 | LOCKED | §C | density/medium-compact | Normal phone density medium-compact. | — | :47
D-06-012 | LOCKED | §C | density/5-6-rows | ~5–6 complete rows visible; five acceptable. | — | :49
D-06-013 | LOCKED | §C | avatar/64-72 | Avatar roughly 64–72 logical px class; exact via design system + device testing. | 02 | :51
D-06-014 | LOCKED | §C | density/a11y-scaling | Accessibility text scaling may increase row height and reduce visible rows. | 18 | :53
D-06-015 | DERIVED | §C | density/not-invariant | Row-count target is not an accessibility invariant. | — | :55
D-06-016 | LOCKED | §D | identity/name-primary | Contact name is the primary identity line. | — | :59
D-06-017 | LOCKED | §D | line2/recency-category | Line 2 shows recency plus category/group (`18d ago · Friend`, `Today · Family`). | — | :61-66
D-06-018 | LOCKED | §D | category/single | Single displayed category per contact; no multi-category or primary-category semantics this phase. | 07 | :68
D-06-019 | LOCKED | §D | recency/no-interactions | No recorded interactions → `No interactions yet`. | 04 | :70
D-06-020 | LOCKED | §E | recency/time-since | List displays time since most recent interaction. | — | :74
D-06-021 | LOCKED | §E | recency/no-frequency | Contact-frequency goals are NOT displayed beside recency. | — | :76-78
D-06-022 | DERIVED | §E | status/separate-interpretation | Health/status remains a separate interpretation, not an actual-vs-target score. | — | :80
D-06-023 | LOCKED | §F | adaptive/deterministic | Line 3 is adaptive but deterministic context. | 03 | :84
D-06-024 | LOCKED | §F | adaptive/priority | Priority: imminent/time-sensitive remembered info; pinned/high-value; other useful knowledge; empty-contact prompt. | 03 | :86-90
D-06-025 | LOCKED | §F | adaptive/no-birthdays | Birthdays are NOT used for the adaptive line. | — | :92
D-06-026 | LOCKED | §F | adaptive/no-ai | Adaptive line consumes existing structured knowledge; no AI prose. | — | :94
D-06-027 | LOCKED | §F | adaptive/icon | Small leading semantic icon may be shown where meaningful; test visually. | 02 | :96
D-06-028 | LOCKED | §F | adaptive/not-tappable | Adaptive line not independently tappable; row Profile-first. | — | :98
D-06-029 | LOCKED | §G | prompts/ten | Contacts lacking context show one of ~ten lightweight completeness prompts (examples listed). | — | :102-114
D-06-030 | LOCKED | §G | prompts/gentle | Gentle cue, not a score/warning/gamification/data-quality subsystem. | — | :116
D-06-031 | DERIVED | §G | prompts/stable | Prompt selection stable/deterministic per contact. | — | :118
D-06-032 | LOCKED | §H | favorite/always-visible | Favorite star always visible top-right. | — | :122
D-06-033 | LOCKED | §H | favorite/tappable | Star directly tappable from List. | — | :124
D-06-034 | LOCKED | §H | favorite/feedback | Toggling gives immediate fill/unfill + restrained light haptic. | 01 | :126
D-06-035 | LOCKED | §H | favorite/no-snackbar | No success snackbar. | — | :128
D-06-036 | DERIVED | §H | favorite/rollback | On persistence failure revert optimistic state and show error. | — | :130
D-06-037 | DERIVED | §H | favorite/reuse-plumbing | Reuse/extract existing favorite mutation plumbing. | — | :132
D-06-038 | DERIVED | §H | favorite/binary | Legacy ranking must not surface as ranked-Favorites UX; semantics remain binary. | 04 | :134
D-06-039 | LOCKED | §I | status/two-channels | Unsnoozed states use thin status-coloured border + distinct lower-right icon. | 02 | :138-141
D-06-040 | LOCKED | §I | status/same-weight | All status borders use the same weight; severity does not thicken. | — | :143
D-06-041 | LOCKED | §I | status/icon-informational | Status icons informational, not tappable. | — | :145
D-06-042 | LOCKED | §I | status/no-text | Literal status text not permanently displayed. | — | :147
D-06-043 | LOCKED | §I | status/celestial-icons | Icon direction astronomical with distinct silhouettes (Stable clean orbit; Wobbly eccentric; Decaying spiral; Rogue breaking away). | 02 | :149-155
D-06-044 | DEFERRED-DECISION | §I | deferred/icon-artwork | Final production status-icon artwork (Phase 7/10 depend on the shared icon system). | 02,07 | :157
D-06-045 | LOCKED | §J | neutral/no-status | Contacts with no status evaluation / no interactions use a neutral border and no status icon. | 04 | :161
D-06-046 | LOCKED | §J | neutral/no-unknown | No fifth `Unknown` status invented. | — | :163
D-06-047 | LOCKED | §K | snooze/override | Snooze is a visible presentation override of relationship health. | 04 | :167
D-06-048 | LOCKED | §K | snooze/treatment | While snoozed: neutral border; snooze icon replaces status icon. | — | :169-173
D-06-049 | DERIVED | §K | snooze/renderer-only | Underlying status remains domain state; renderer-level override only. | — | :175
D-06-050 | LOCKED | §L | search/name-fixed | Search keeps name as line 1. | 04 | :179
D-06-051 | LOCKED | §L | search/replace-lines | Lines 2 and 3 replaced by match explanation (`3 matches · Memory, Relationship`) and strongest highlighted snippet. | 04 | :181-187
D-06-052 | LOCKED | §L | search/highlight | Matched text highlighted. | 04 | :189
D-06-053 | LOCKED | §L | search/strongest-plus-count | Strongest inline match plus count, not all snippets. | 04 | :191
D-06-054 | LOCKED | §L | search/no-plus-n-action | `+N more` has no separate inline action in List. | — | :193
D-06-055 | DERIVED | §L | search/shared-descriptors | Shared model may retain up to three descriptors + count; List renders compactly. | 04 | :195
D-06-056 | LOCKED | §M | tap/profile | Tapping the closed row opens Profile. | 01,10 | :199
D-06-057 | LOCKED | §M | tap/no-competing | Adaptive/status indicators introduce no competing tap destinations. | — | :201
D-06-058 | LOCKED | §M | tap/close-swipe-first | Tapping a partially swiped row closes the swipe rather than navigating. | — | :203
D-06-059 | LOCKED | §N | swipe/one-per-direction | One swipe action per direction: right → Log Interaction; left → Edit Contact. | 13 | :207-211
D-06-060 | LOCKED | §N | swipe/one-open | Only one row swipe-revealed at a time; opening another closes previous. | — | :213-215
D-06-061 | LOCKED | §N | swipe/no-destructive | No destructive actions via primary swipes. | — | :217
D-06-062 | LOCKED | §O | swipe-log/configurable | Right-swipe logging globally configurable: Quick Log or Log Contact. | 15 | :221-225
D-06-063 | LOCKED | §O | swipe-log/default | Default is Quick Log. | — | :227
D-06-064 | LOCKED | §O | swipe-log/onboarding | First-run onboarding exposes an early choice/override. | 17 | :229
D-06-065 | LOCKED | §O | swipe-log/settings | A persistent global setting in Settings allows later changes. | 15 | :231
D-06-066 | LOCKED | §O | swipe-log/not-overflow | Dashboard overflow does not host this preference. | 05 | :233
D-06-067 | LOCKED | §O | swipe-log/global | Global, not per-contact. | — | :235
D-06-068 | LOCKED | §O | swipe-log/commit-threshold | Both variants execute when the swipe crosses the committed threshold; no second tap (Quick Log executes immediately; Log Contact routes into the detailed form pre-targeted). | 13 | :237-243
D-06-069 | DERIVED | §O | swipe-log/quicklog-contract | Quick Log retains shell truthful success/error/Undo. | 01 | :245
D-06-070 | DERIVED | §O | swipe-log/reuse-routes | Log Contact reuses routable fast-entry/form architecture. | 13 | :247
D-06-071 | LOCKED | §P | swipe/feedback | Swipe actions hidden before gesture; progressive reveal (translate, background, icon, label, threshold resistance, sub-threshold return). | — | :251-259
D-06-072 | LOCKED | §P | swipe/education-onboarding | Gesture education belongs to onboarding, not a permanent List tutorial. | 17 | :261
D-06-073 | DERIVED | §P | swipe/onboarding-teaches | Onboarding teaches row gestures and the tappable star. | 17 | :263
D-06-074 | LOCKED | §Q | a11y/status-textual | Status cannot rely on border colour alone; icon second channel; accessible semantics textual. | 02 | :267
D-06-075 | LOCKED | §Q | a11y/snoozed-label | Snoozed state gets semantic labeling. | — | :269
D-06-076 | LOCKED | §Q | a11y/row-actions | AT row actions expose Log Interaction and Edit Contact. | — | :271
D-06-077 | LOCKED | §Q | a11y/reflow | Large text may reflow/increase row height. | 18 | :273
D-06-078 | DERIVED | §Q | a11y/description | Row description includes name, category, recency, favorite, status/snooze, action semantics. | — | :275
D-06-079 | LOCKED | §R | loading/no-flash | Fast local query updates keep content visible, no skeleton flashes. | 05 | :279
D-06-080 | LOCKED | §R | loading/skeleton-initial | Skeletons reserved for initial or meaningfully delayed loading. | — | :281
D-06-081 | DERIVED | §R | loading/live-apply | Preserves the live-apply model. | 05 | :283
D-06-082 | LOCKED | §S | motion/transitions | Short restrained transitions on result changes; functional not orbital; reduced motion simplifies. | 02 | :287-293
D-06-083 | LOCKED | §T | empty/shared-semantics | List and Card mostly share semantic empty/error content (no contacts; no matches; zero results; load error). | 07 | :297-304
D-06-084 | LOCKED | §T | empty/renderer-layout | Renderer-specific layout allowed; semantics shared. | 07 | :306
D-06-085 | LOCKED | §T | empty/restrained | Routine List empty states restrained: icon + copy + CTA. | 02 | :308
D-06-086 | DERIVED | §U | impl/no-own-query | List consumes the shared model; no own Population/Filter/Sort/Search logic. | 04 | :312
D-06-087 | DERIVED | §U | impl/avatar-cache | Preserve avatar recycling/cache correctness for virtualized reuse. | — | :314
D-06-088 | DERIVED | §U | impl/virtualization | Use existing virtualized primitives unless testing proves need. | — | :316
D-06-089 | DERIVED | §U | impl/shared-plumbing | Favorite mutation, Quick Log, Log Contact routing, Edit routing, icons, tokens, a11y shared not reimplemented. | 01,02,13 | :318
D-06-090 | DERIVED | §U | impl/tuning | Exact dimensions, thresholds, durations, truncation, performance are implementation details. | — | :320
D-06-091 | XREF | Cross-Phase | xref/→data-state | Data & State authoritative for universe, populations, filters, sort, search, persistence, descriptors, result state. | 04 | :324
D-06-092 | XREF | Cross-Phase | xref/→control-surface | Control Surface above renderer; List doesn't relocate controls. | 05 | :325
D-06-093 | XREF | Cross-Phase | xref/→card | Card sibling; richer context allowed, no shared-semantic redefinition. | 07 | :326
D-06-094 | XREF | Cross-Phase | xref/→theme | Theme owns colours, geometry, type, motion, icons, variants, contrast, reduced motion. | 02 | :327
D-06-095 | XREF | Cross-Phase | xref/→shell | Shell owns Profile/Edit/Quick Log/Log Contact navigation + immediate Quick Log contract. | 01 | :328
D-06-096 | XREF | Cross-Phase | xref/→knowledge | Adaptive context + snippets consume semantic knowledge. | 03 | :329
D-06-097 | XREF | Cross-Phase | xref/→rapid | Rapid Capture owns form/business behavior behind Log Contact and Edit/Update. | 13 | :330
D-06-098 | XREF | Cross-Phase | xref/→settings | Settings owns the persistent Quick Log vs Log Contact swipe preference. | 15 | :331
D-06-099 | XREF | Cross-Phase | xref/→onboarding | Onboarding teaches gestures and provides early swipe preference choice. | 17 | :332
D-06-100 | XREF | Cross-Phase | xref/→orrery | Orrery remains the explicit relationship-health visualization; List restrained. | 08 | :333
D-06-101 | XREF | Cross-Phase | xref/→hardening | Hardening audits landscape/tablet, a11y, gestures, performance, density. | 18 | :334
D-06-102 | DEFERRED-FEATURE | Explicitly Deferred | deferred/p6 | Final icon artwork; custom icon family; exact tokens; thresholds; timings; per-contact swipe config; more swipe actions; destructive swipe; completeness scoring; AI row copy; birthdays in context; multi-category; List-specific search; user density; in-List tutorial. | — | :328-342
D-06-103 | LOCKED | Success Criteria | sc/1-12 | SC1 scan-first w/ avatar + three lines; SC2 name/recency+category/adaptive + prompts; SC3 star toggle w/ feedback + rollback; SC4 same-weight border + icon, neutral no fabricated status; SC5 snooze neutralizes; SC6 search replaces secondary lines; SC7 tap→Profile, right swipe configured logging, left swipe Edit, one open; SC8 Quick Log default, onboarding/Settings override, executes on commit; SC9 a11y equivalents + reflow; SC10 no loading flashes; SC11 shared empty/error semantics; SC12 reuse shared contracts. | — | :346-357
D-06-104 | LOCKED | Notes for GSD | note/renderer-phase | Renderer phase after 4 and 5. | 04,05 | :361
D-06-105 | LOCKED | Notes for GSD | note/no-business-rules | Do not pull Quick Log/Log Contact/Edit rules in; List owns gesture exposure/routing only. | 13 | :362
D-06-106 | LOCKED | Notes for GSD | note/no-rank | Do not introduce a favorite ranking concept; star is binary membership. | 04 | :363
D-06-107 | LOCKED | Notes for GSD | note/no-multi-category | Do not invent multi-category semantics. | — | :364
D-06-108 | LOCKED | Notes for GSD | note/a11y-over-density | Accessibility reflow takes precedence over density. | 18 | :365
D-06-109 | LOCKED | Notes for GSD | note/snooze-override | Snooze is intentionally a presentation override. | — | :366
D-06-110 | LOCKED | Notes for GSD | note/no-birthdays-adaptive | Do not add birthdays back into adaptive context. | — | :367
D-06-111 | LOCKED | Notes for GSD | note/no-scoring | Do not turn sparse prompts into scoring. | — | :368
D-06-112 | LOCKED | Notes for GSD | note/tuning | Icon artwork, dimensions, gestures, animation, performance are implementation details unless testing exposes conflict. | — | :369

## Phase 07 — Dashboard Card View (v0.2) · `phase-07-dashboard-card-view-dossier-v0.2.md`

Legend :5-8; amended 2026-09-01 (:3, :17).

D-07-001 | LOCKED | Scope | scope | Defines the compact avatar-first grid renderer; does NOT redefine populations, filters, sort, search scope, persistence, shared query logic, logging-form rules, contact import, theme/icon system. | 04,05,13 | :11-15
D-07-002 | LOCKED | Amendment | bulk-log/superseded | [SUPERSEDED] "detailed bulk Log Interaction is not offered" is no longer authoritative; Phase 12 owns canonical multi-contact detailed logging. | 12 | :19
D-07-003 | LOCKED | Amendment | multiselect/quick-log | Grid multi-select retains Quick Log as a distinct immediate bulk action. | 13 | :21
D-07-004 | LOCKED | Amendment | multiselect/count-routing | Multi-select exposes detailed Log Interaction: 1 selected → individual detailed Log Interaction; 2+ → Phase 12 Group Log preloaded. | 12,13 | :23-25
D-07-005 | LOCKED | Amendment | boundary/phase-7-owns | Phase 7 owns only the selection-mode action, count routing, and preserving Grid multi-select UX while launching the canonical workflow. | 12 | :27
D-07-006 | DERIVED | Amendment | boundary/no-group-domain | Phase 7 must not implement/duplicate Group Event persistence, fields, inheritance, overrides, lifecycle, Detail/Edit, browsing, atomicity, backup. | 12 | :29
D-07-007 | LOCKED | Amendment | header/compatible | Phase 12 adds a Group Events header icon+label and overflow entry; placement belongs to Control Surface/App Shell; Phase 7 remains layout-compatible. | 05,12 | :31
D-07-008 | DERIVED | Amendment | amend/supersede-refs | Existing references to "Bulk Log Interaction with a detailed form is not offered" are superseded wherever they conflict; all unrelated decisions remain. | — | :33
D-07-009 | LOCKED | §A | card/browse-recognize | Card View is primarily browse-and-recognize presentation of the same contacts as List. | 06 | :36
D-07-010 | LOCKED | §A | card/visual-difference-only | List vs Card difference is visual/presentational, not a different IA. | 06 | :38
D-07-011 | LOCKED | §A | card/compact-grid | Card View is a compact grid, not a one-card-per-row feed. | 04 | :40
D-07-012 | DERIVED | §A | card/not-richer | Do not make Card functionally richer merely because visual. | — | :42
D-07-013 | LOCKED | §B | grid/3-columns | Normal portrait target is 3 columns. | — | :45
D-07-014 | LOCKED | §B | grid/9-visible | Roughly 9 contacts visible in a typical portrait viewport. | — | :47
D-07-015 | LOCKED | §B | grid/not-invariant | Three columns is a target, not an invariant. | — | :49
D-07-016 | DERIVED | §B | grid/2-col-fallback | Narrow devices / large text may fall back to 2 columns. | 18 | :51
D-07-017 | DERIVED | §B | grid/wider-more-cols | Wider devices increase column count. | 18 | :53
D-07-018 | LOCKED | §C | card/floating-bubbles | Feels like floating avatar bubbles with an opaque/translucent scrim preserving readable text layout. | 02 | :56
D-07-019 | LOCKED | §C | card/avatar-dominant | Avatar/photo is the dominant element; circular. | — | :58-60
D-07-020 | DERIVED | §C | card/theme-resolution | Galaxy luminous/glass, Standard calmer/flatter, identical hierarchy. | 02 | :62
D-07-021 | LOCKED | §D | card/three-rows | Text hierarchy: name; recency; one adaptive context item. | — | :65-68
D-07-022 | LOCKED | §D | card/no-category | Category omitted from Card View for compactness. | 06 | :70
D-07-023 | LOCKED | §D | card/no-status-text | Visible status text omitted. | — | :72
D-07-024 | DERIVED | §D | card/a11y-status | Status available to accessibility semantics. | — | :74
D-07-025 | LOCKED | §E | recency/visible | Recency visible in normal browsing; same conventions as List; `No interactions yet` equivalent. | 06 | :77-81
D-07-026 | LOCKED | §F | status/ring | Status communicated primarily by thin status-coloured ring around the avatar. | 02 | :84
D-07-027 | LOCKED | §F | status/badge | Plus a small distinct glyph/badge attached to the avatar edge, not occupying a text row. | 02 | :86-88
D-07-028 | LOCKED | §F | status/silhouettes | Distinct Stable/Wobbly/Decaying/Rogue silhouettes from the shared icon system. | 02,06 | :90
D-07-029 | LOCKED | §G | snooze/override | Snooze overrides visible health: neutral ring, snooze glyph, status suppressed. | 04,06 | :93-98
D-07-030 | DERIVED | §G | snooze/meaning | Means "don't evaluate this relationship now". | — | :100
D-07-031 | LOCKED | §H | favorite/star | Star always visible top-right; tappable; immediate visual + restrained haptic. | 06 | :103-107
D-07-032 | DERIVED | §H | favorite/reuse | Reuse existing favorite-domain plumbing. | — | :109
D-07-033 | DERIVED | §H | favorite/binary | Binary membership; legacy rank storage must not leak into Card UX. | 04 | :111
D-07-034 | LOCKED | §I | adaptive/one-item | Card shows one adaptive context item. | — | :114
D-07-035 | LOCKED | §I | adaptive/compactness-bias | Same knowledge pool as other renderers with a compactness bias. | 03 | :116
D-07-036 | LOCKED | §I | adaptive/prefer-short | Prefer naturally short recognizable context (concise values, names, counts, short pinned Memories). | 03 | :118
D-07-037 | LOCKED | §I | adaptive/fallback-truncate | Longer items eligible as fallback; truncate to one line. | — | :120
D-07-038 | LOCKED | §I | adaptive/bonus-not-sole | Compactness is a ranking bonus, not sole criterion. | — | :122
D-07-039 | LOCKED | §I | adaptive/no-birthdays | Birthdays excluded from adaptive ranking. | — | :124
D-07-040 | LOCKED | §I | adaptive/icon | Small leading semantic icon may accompany. | 02 | :126
D-07-041 | LOCKED | §I | adaptive/not-tappable | Adaptive row not separately tappable. | — | :128
D-07-042 | LOCKED | §J | prompts/shared-shorter | Blank-contact prompts share List's system with shorter Grid variants (examples). | 06 | :131-136
D-07-043 | LOCKED | §J | prompts/unobtrusive | Unobtrusive cues, not warnings/scores. | — | :138
D-07-044 | DERIVED | §J | prompts/stable | Choice stable across re-renders. | — | :140
D-07-045 | LOCKED | §K | search/geometry | Search preserves three-row geometry: name; matched field/type label; strongest highlighted snippet (examples). | 04 | :143-158
D-07-046 | LOCKED | §K | search/no-extra-action | No separate interaction for additional matches. | — | :160
D-07-047 | DERIVED | §K | search/count-if-fits | Additional match count only if it fits cleanly. | — | :162
D-07-048 | DERIVED | §K | search/shared-contract | Consumes the shared match-descriptor contract. | 04 | :164
D-07-049 | LOCKED | §L | tap/profile | Tapping a card opens Profile. | 10 | :167
D-07-050 | LOCKED | §L | no-swipe | Card View does NOT mirror List swipe gestures. | 06 | :169
D-07-051 | LOCKED | §L | power/long-press-multiselect | Power interactions are long-press context menu and multi-select. | — | :171
D-07-052 | LOCKED | §M | menu/long-press | Long-press opens a per-contact context menu. | — | :174
D-07-053 | LOCKED | §M | menu/order | Order: View Profile; Quick Log; Log Interaction; Message; Edit Contact; Favorite/Unfavorite; Snooze/Unsnooze; Select. | 13,14 | :176-184
D-07-054 | LOCKED | §M | menu/powerful | Menu intentionally substantial. | — | :186
D-07-055 | LOCKED | §M | menu/no-destructive | Delete, Archive, high-impact bulk ops not in the long-press menu. | — | :188
D-07-056 | DERIVED | §M | menu/canonical-flows | Quick Log immediate-write; Log Interaction pre-targeted detailed form; Message/Edit canonical routes. | 01,13,14 | :190
D-07-057 | LOCKED | §N | multiselect/is-bulk-mgmt | Grid multi-select is Orbit's actual Dashboard bulk/contact-management surface. | 05 | :193
D-07-058 | LOCKED | §N | multiselect/no-separate-screen | No separate bulk-management screen created because earlier language implied one. | 05 | :195
D-07-059 | LOCKED | §N | multiselect/overflow-entry | Overflow exposes a discoverable Select Contacts / bulk-management entry that switches to Card/Grid if needed and enters multi-select. | 05 | :197
D-07-060 | LOCKED | §N | multiselect/menu-select | Long-press menu exposes `Select`. | — | :199
D-07-061 | DERIVED | §N | multiselect/resolve-phase5 | Earlier Control Surface "Bulk / Contact Management" resolves to entering this mode rather than a nonexistent screen. | 05 | :201
D-07-062 | LOCKED | §O | import/not-bulk | Contact import is not part of Card/Grid bulk management. | 05 | :204
D-07-063 | LOCKED | §O | import/backup-restore | Import belongs conceptually with Backup/Restore / data-management flows. | — | :206
D-07-064 | DERIVED | §O | import/no-pull | Do not pull import UI/semantics into Phase 7. | — | :208
D-07-065 | LOCKED | §P | multiselect/entry | Entered via long-press → Select or overflow → Select Contacts. | 05 | :211-213
D-07-066 | LOCKED | §P | multiselect/no-permanent-controls | Normal Grid shows no selection controls before selection starts. | — | :215
D-07-067 | LOCKED | §Q | multiselect/top-left-control | Every card shows a top-left selection control (empty circle / check). | — | :218-220
D-07-068 | LOCKED | §Q | multiselect/tap-toggles | Tapping anywhere on a card toggles selection. | — | :222
D-07-069 | LOCKED | §Q | multiselect/stars-inert | Favorite stars readable but non-interactive during multi-select. | — | :224
D-07-070 | LOCKED | §Q | multiselect/count | Selection mode displays selected count. | — | :226
D-07-071 | LOCKED | §R | multiselect/controls-locked | Query controls locked while multi-select active; Population/Filters/Sort/Search cease to function. | 05 | :229-231
D-07-072 | LOCKED | §R | multiselect/replace-control-area | Multi-select reuses/replaces the Dashboard control area with selection actions/state rather than a bottom bar; Search included in the replaced area. | 05 | :233-235
D-07-073 | DERIVED | §R | multiselect/why | Avoids selection surviving a changing result set; reuses defunct real estate. | — | :237
D-07-074 | LOCKED | §S | select-all | Select All = all contacts in the current eligible result universe as of selection start. | 04 | :240-242
D-07-075 | DERIVED | §S | controls-frozen | Query controls frozen until exit. | — | :244
D-07-076 | LOCKED | §T | bulk/actions | Initial ordinary actions: Quick Log; Log Interaction; Add/Remove Favorites; Snooze/Unsnooze; Set Category; Archive; More / Sensitive Operations entry. | — | :247-254
D-07-077 | LOCKED | §T | bulk/no-edit | Bulk Edit not offered. | — | :256
D-07-078 | LOCKED | §T | bulk/prohibition-superseded | Prior prohibition on detailed bulk Log Interaction superseded by the Phase 12 amendment. | 12 | :258
D-07-079 | LOCKED | §T | bulk/quick-log-each | Multi-contact Quick Log writes one generic/current interaction per selected contact. | 13 | :260
D-07-080 | LOCKED | §T | bulk/count-routing | Detailed Log Interaction count-aware routing (1 individual; 2+ Group Log preloaded). | 12,13 | :262
D-07-081 | LOCKED | §T | bulk/no-multi-message | Multi-recipient Message not in the initial set. | 14 | :264
D-07-082 | LOCKED | §U | bulk/explicit-mixed | Bulk favorite/snooze are explicit (Add/Remove, Snooze/Unsnooze); no toggle-all. | — | :267-275
D-07-083 | LOCKED | §V | bulk/quicklog-safeguards | Quick Log immediate for small selections with Undo/error; large selections require confirmation; threshold is tuning. | 01 | :278-282
D-07-084 | LOCKED | §W | bulk/category | Bulk category applies one category to all selected; single-category model. | — | :285-287
D-07-085 | DEFERRED-FEATURE | §W | deferred/multi-category | Multi-category membership semantics. | — | :289
D-07-086 | LOCKED | §X | bulk/archive | Archive directly available; confirmation because archived leave the universe; outside Sensitive Operations (reversible lifecycle). | — | :292-296
D-07-087 | LOCKED | §Y | sensitive/menu | Distinct Sensitive Operations subsurface: Change Contact Frequency; Delete Contacts. | — | :299-303
D-07-088 | LOCKED | §Y | sensitive/no-gravity | Gravity is not an action (derived-never-stored). | — | :305
D-07-089 | DERIVED | §Y | sensitive/future | Other future high-impact ops join only if genuine mutable state. | — | :307
D-07-090 | LOCKED | §Z | bulk/frequency | Bulk frequency applies one value to all; confirmation summarizing count/value because it changes relationship-state calculations. | — | :310-312
D-07-091 | LOCKED | §AA | delete/no-hard-delete | Delete does not immediately hard-delete. | — | :315
D-07-092 | LOCKED | §AA | delete/30-day-quarantine | "Current delete behavior sends contacts into a 30-day quarantine where users can restore them, purge them manually, or allow automatic pruning after the quarantine expires." | — | :317
D-07-093 | LOCKED | §AA | delete/confirmation-copy | Bulk-delete confirmation must accurately explain the recoverable quarantine, not immediate permanent deletion. | — | :319
D-07-094 | DERIVED | §AA | delete/ui-elsewhere | Quarantine-management UI belongs to existing lifecycle/data-management surfaces. | — | :321
D-07-095 | LOCKED | §AB | bulk/preserve-selection | Successful ordinary bulk ops preserve selection mode (Quick Log stay + Undo; Favorite/Snooze/Category/Frequency stay; Archive → archived cards disappear, rest stay; Delete → removed disappear, rest stay). | — | :324-330
D-07-096 | LOCKED | §AB | bulk/explicit-exit | User explicitly exits selection mode. | — | :332
D-07-097 | LOCKED | §AC | exit/back | Back exits multi-select before route navigation. | 01 | :335
D-07-098 | LOCKED | §AC | exit/no-profile-nav | Selection mode owns card taps; no Profile navigation while active. | — | :337
D-07-099 | DERIVED | §AC | exit/preserve-state | Entering/leaving preserves pre-selection query state. | 04 | :339
D-07-100 | LOCKED | §AD | loading/no-flash | No skeleton flashes on fast re-query; cards remain visible; placeholders for initial/delayed; short transitions; reduced motion simplifies. | 02,06 | :342-350
D-07-101 | LOCKED | §AE | empty/shared | Same semantic/cause-aware empty/error states as List; copy shared, layout renderer-specific; restrained icon + copy + CTA. | 06 | :353-363
D-07-102 | LOCKED | §AF | a11y/no-colour | Understandable without status colour; semantics include identity, recency, status/snooze, favorite, context, selection. | 02 | :366-368
D-07-103 | LOCKED | §AF | a11y/large-text | Large text may increase height / reduce columns; density not invariant. | 18 | :370
D-07-104 | LOCKED | §AF | a11y/no-long-press-only | Context-menu and selection reachable without long-press dexterity. | — | :372
D-07-105 | DERIVED | §AF | a11y/selection-roles | Selection mode exposes roles/states/actions + announcements. | — | :374
D-07-106 | XREF | §AG | xref/→data-state | Consumes shared query/result/search model. | 04 | :377
D-07-107 | XREF | §AG | xref/→control-surface | Normal controls unchanged outside multi-select; multi-select replaces/locks. | 05 | :378
D-07-108 | XREF | §AG | xref/→list | Same semantic info; List owns swipe, Card owns long-press + multi-select. | 06 | :379
D-07-109 | XREF | §AG | xref/→group | Phase 12 owns Group Event domain; Card only launches by count. | 12 | :380
D-07-110 | XREF | §AG | xref/→knowledge | Adaptive/search from semantic abstraction. | 03 | :381
D-07-111 | XREF | §AG | xref/→shell-rapid | Quick Log, Log Interaction, Message, Edit, Profile via canonical routes. | 01,13,14 | :382
D-07-112 | XREF | §AG | xref/→theme | Rings, glyphs, scrims, states via tokens. | 02 | :383
D-07-113 | XREF | §AG | xref/→backup | Import belongs to Backup/Restore/data management. | — | :384
D-07-114 | XREF | §AG | xref/→lifecycle | Bulk delete respects the existing 30-day quarantine/restore/purge lifecycle. | — | :385
D-07-115 | XREF | §AG | xref/→gravity | Gravity derived-never-stored; no bulk mutation. | — | :386
D-07-116 | DEFERRED-FEATURE | Explicitly Deferred | deferred/p7 | Final icon artwork; exact dimensions/breakpoints; timings; bulk Quick Log threshold; multi-category; bulk Edit; multi-recipient messaging; standalone bulk screen; import in Card; hard-delete lifecycle redesign; custom per-contact layout. | — | :389-399
D-07-117 | LOCKED | Success Criteria | sc/1-13 | SC1 3-col grid; SC2 name/recency/context/favorite/a11y status; SC3 ring + glyph, snooze neutralizes; SC4 search geometry; SC5 tap Profile, long-press menu, no swipe; SC6 multi-select entry; SC7 replaces/locks controls, Select All frozen universe, taps selection-only; SC8 Quick Log distinct + count-aware routing; favorite/snooze/category/archive; no bulk Edit; SC9 Sensitive Operations separates frequency + recoverable delete/quarantine; SC10 Gravity never mutable; SC11 selection preserved, archived/quarantined removed; SC12 shared empty/error/loading; SC13 responsive fallback. | — | :402-414
D-07-118 | LOCKED | Notes for GSD | note/sibling | Sibling renderer after List. | 06 | :417
D-07-119 | LOCKED | Notes for GSD | note/not-mini-profile | Not a richer mini-profile feed. | — | :418
D-07-120 | LOCKED | Notes for GSD | note/3-col | Normal target 3-column. | — | :419
D-07-121 | LOCKED | Notes for GSD | note/no-swipe | Do not duplicate List swipes. | 06 | :420
D-07-122 | LOCKED | Notes for GSD | note/menu-powerful | Long-press menu intentionally powerful. | — | :421
D-07-123 | LOCKED | Notes for GSD | note/no-greenfield-bulk | Multi-select is the bulk capability; no greenfield bulk screen. | 05 | :422
D-07-124 | LOCKED | Notes for GSD | note/prohibition-superseded | Former prohibition superseded; Quick Log distinct; count routing. | 12 | :423
D-07-125 | LOCKED | Notes for GSD | note/no-group-domain | Do not pull Group Event persistence/overrides/Detail/Edit/lifecycle/atomicity/backup in. | 12 | :424
D-07-126 | LOCKED | Notes for GSD | note/rename-phase5-entry | Update/interpret Phase 5 `Bulk / Contact Management` as `Select Contacts` / entry into this mode. | 05 | :425
D-07-127 | LOCKED | Notes for GSD | note/import-elsewhere | Import routed to Backup/Restore/data-management planning. | — | :426
D-07-128 | LOCKED | Notes for GSD | note/lock-controls | Multi-select locks controls. | 05 | :427
D-07-129 | LOCKED | Notes for GSD | note/separate-sensitive | Keep normal and Sensitive separate. | — | :428
D-07-130 | LOCKED | Notes for GSD | note/delete-copy | Delete copy must reflect the 30-day quarantine/restore/purge lifecycle. | — | :429
D-07-131 | LOCKED | Notes for GSD | note/gravity | Gravity never editable via bulk. | — | :430
D-07-132 | LOCKED | Notes for GSD | note/tuning | Mechanics/pixels/breakpoints/timings/thresholds are tuning. | — | :431

## Phase 08 — Orrery Camera, Scale & Exploration · `phase-08-orrery-camera-scale-exploration-dossier.md`

Legend :5-8.

D-08-001 | LOCKED | Scope | scope | Defines the Orrery exploration model over the existing visualization; does NOT define custom System authoring/management, polished switch animation, social-graph semantics, first/second-level contacts, satellite ownership, relationship editing, relationship-domain schemas, full graph visualization. | 09 | :11-15
D-08-002 | LOCKED | §A | orrery/role | Orrery remains the primary relationship-health / attention-centric visualization, not another Dashboard renderer. | 04 | :21
D-08-003 | LOCKED | §A | orrery/immersive | Immersive but purposeful; stronger motion/perspective/glow/controls while tokenized and accessible. | 02 | :23
D-08-004 | LOCKED | §A | orrery/one-visualization | One canonical spatial visualization centered on relationship-health/status semantics. | — | :25
D-08-005 | LOCKED | §A | orrery/remove-mode-split | The existing Status / Relationship mode split is removed; Relationship mode not intuitive enough to preserve. | — | :27
D-08-006 | DERIVED | §A | orrery/remove-morph | Simplify/remove mode-toggle and relationship-mode morph/resting-layout behavior rather than preserving it because code exists. | — | :29
D-08-007 | LOCKED | §B | world/finite-sun-centered | Finite sun-centered world with a transient inspection camera, not free-flight 3D. | — | :35
D-08-008 | LOCKED | §B | world/stable-north | World retains canonical center and north orientation under camera changes. | — | :37
D-08-009 | LOCKED | §B | world/positions-in-world-coords | Contact positions in world coordinates; yaw views, doesn't mutate placement. | — | :39
D-08-010 | DERIVED | §B | camera/state | Separate world/layout from camera state (pan X/Y, zoom, bounded tilt, yaw, focus). | — | :41-51
D-08-011 | LOCKED | §C | camera/2.5d | Constrained 2.5D camera, not true 3D. | — | :57
D-08-012 | LOCKED | §C | camera/home | Default/Home is top-down, sun-centered, north up. | — | :59
D-08-013 | LOCKED | §C | camera/gestures | One-finger pan; pinch zoom; deliberate multi-touch tilt; deliberate multi-touch yaw. | — | :61-65
D-08-014 | LOCKED | §C | camera/tilt-bounded | Tilt bounded; no inversion, under-flight, or edge-on extremes. | — | :67
D-08-015 | LOCKED | §C | camera/yaw | Yaw rotates around sun/world axis preserving canonical north. | — | :69
D-08-016 | DERIVED | §C | stack/no-engine | Use existing Skia/Reanimated/Gesture Handler; no game/3D engine unless proven inadequate. | — | :71
D-08-017 | LOCKED | §D | perspective/exaggerated-bounded | Perspective depth scaling noticeable, somewhat exaggerated, bounded. | — | :77-79
D-08-018 | LOCKED | §D | perspective/billboard | Avatars and labels billboarded toward viewer. | — | :81-83
D-08-019 | LOCKED | §D | perspective/depth-ordering | Natural projected depth ordering allowed (nearer in front). | — | :85
D-08-020 | DERIVED | §D | perspective/occlusion | Interaction can't depend on every body exposed; ambiguity handled via hit ambiguity + Focus Zoom. | — | :87
D-08-021 | LOCKED | §E | gravity/visual-mass | Contact size modestly influenced by derived Gravity (low smaller, high larger). | — | :93-95
D-08-022 | LOCKED | §E | gravity/secondary | Gravity modulation secondary to zoom/perspective. | — | :97
D-08-023 | DERIVED | §E | size/formula | Projected size = base × Gravity modifier × zoom × perspective, clamped; tuning. | — | :99-106
D-08-024 | DERIVED | §E | gravity/not-editable | Gravity derived-never-stored; no editable Orrery size state. | — | :108
D-08-025 | LOCKED | §F | zoom/bounded | Broad but bounded semantic zoom range; extreme map-like zoom not required. | — | :114-116
D-08-026 | DERIVED | §F | zoom/extensible | Architecture must not bake in initial bounds; later expansion by relaxing constraints. | — | :118
D-08-027 | DEFERRED-FEATURE | §F | deferred/extreme-zoom | Extreme map-like zoom / free navigation. | — | :120
D-08-028 | LOCKED | §G | home/hybrid-fit | Home framing = hybrid fit/readability: show full system while readable, then stop shrinking and let outer extent leave viewport. | — | :126-128
D-08-029 | LOCKED | §G | home/balanced-target | Balanced density targets ~six contacts with generous presence, accommodating ~ten; UX targets not caps. | — | :130-134
D-08-030 | DERIVED | §G | home/computed | Framing computed from viewport, sizes, overlays, a11y, density preset — not `if count > 10`. | — | :136
D-08-031 | LOCKED | §H | density/presets | Three density presets: Spacious, Balanced, Compact. | 15 | :142-146
D-08-032 | LOCKED | §H | density/default | Balanced default. | — | :148
D-08-033 | LOCKED | §H | density/layout-only | Density changes spacing/framing, not membership or semantics. | — | :150
D-08-034 | LOCKED | §H | density/persists | Density preference persists. | — | :152
D-08-035 | LOCKED | §H | density/no-numeric | No numeric "maximum contacts onscreen" control initially. | — | :154
D-08-036 | DERIVED | §H | density/influences | Density influences ring spacing, body scale, collision tolerance, Home framing. | — | :156
D-08-037 | DEFERRED-FEATURE | §H | deferred/numeric-density | Continuous/numeric density tuning. | — | :158
D-08-038 | LOCKED | §I | geometry/no-infinite-compress | Orrery no longer compresses every ring into the initial viewport. | — | :164
D-08-039 | LOCKED | §I | geometry/min-spacing-grow | Maintain minimum world-space orbital spacing; system grows with count. | — | :166
D-08-040 | LOCKED | §I | geometry/all-contacts-available | All Contacts remains available even when large; canonical complete view never disabled. | 09 | :168-170
D-08-041 | DERIVED | §I | geometry/high-count-solution | High-count usability via scalable geometry + camera + Systems. | 09 | :172
D-08-042 | LOCKED | §J | collision/small-nudges | Angular placement may receive very small collision-aware nudges. | — | :178
D-08-043 | LOCKED | §J | collision/no-repack | Must not substantially rearrange or repack. | — | :180
D-08-044 | LOCKED | §J | collision/deterministic | Deterministic/stable for the same state. | — | :182
D-08-045 | DERIVED | §J | collision/focus-primary | Focus Zoom primary for crowding; small correction budget. | — | :184
D-08-046 | LOCKED | §K | semantic-zoom/levels | Three levels: far overview (names hidden); identity inspection (names); deeper inspection (light context). | — | :190-196
D-08-047 | LOCKED | §K | labels/no-single-threshold | Labels don't all appear at one threshold if that creates a text wall. | — | :198
D-08-048 | LOCKED | §K | labels/priority | Label priority: focused; cluster-focus members; Favorites; clean-fit/isolated; remaining opportunistically. | 04 | :200-206
D-08-049 | LOCKED | §K | labels/face-screen | Labels face screen, horizontal through yaw/tilt. | — | :208
D-08-050 | DERIVED | §K | semantic-zoom/restrained | Orrery must not become a mini-Profile renderer. | 10 | :210
D-08-051 | LOCKED | §L | tap/depth-dependent | Tap depends on inspection depth: at overview, unambiguous tap centers/focuses, animates to identity level, highlights. | — | :216-221
D-08-052 | LOCKED | §L | tap/stop-at-name | First focus zoom stops at name-visible level. | — | :223
D-08-053 | LOCKED | §L | tap/open-profile | At identity scale, tapping opens Profile. | 10 | :225
D-08-054 | LOCKED | §L | focus/state | Lightweight single-contact Focus state may expose richer context with zoom. | — | :227
D-08-055 | LOCKED | §L | focus/persists | Focus persists while camera moves until dismissed or body effectively lost. | — | :229
D-08-056 | DERIVED | §L | focus/subordinate | Focus is not a mini-profile. | 10 | :231
D-08-057 | LOCKED | §M | hit/ambiguity-by-targets | Ambiguity determined by overlapping interactive touch targets, not only visible overlap. | — | :237
D-08-058 | LOCKED | §M | hit/isolated-normal | Clear isolated hit → normal single behavior. | — | :239
D-08-059 | LOCKED | §M | cluster-focus | Multiple plausible bodies → Cluster Focus: determine group, frame safely, animate camera, highlight, expose via floating bottom contact panel. | — | :241-249
D-08-060 | LOCKED | §M | cluster/panel | Panel lists the group's contacts for conventional selection. | — | :251
D-08-061 | LOCKED | §M | cluster/open-profile | Tapping a focused planet or panel entry can open Profile. | 10 | :253
D-08-062 | LOCKED | §M | cluster/exit | Cluster Focus exits before route navigation; dismissed by Back, outside tap, Recenter, or selection. | 01 | :255
D-08-063 | DERIVED | §M | camera/frame-bodies | Reusable `frame bodies` camera primitive. | 09 | :257
D-08-064 | LOCKED | §N | camera/ephemeral | Camera state ephemeral across launches, preserved during in-app return (fresh launch → Home; Orrery → Profile → Back restores; relaunch doesn't reopen old position). | 01 | :263-268
D-08-065 | DERIVED | §N | camera/session-state | Camera position = navigation-session state, not durable personalization. | — | :270
D-08-066 | LOCKED | §O | polaris/exists | Visible celestial north reference, working concept Polaris / North Star. | — | :276
D-08-067 | LOCKED | §O | polaris/landmark | World-orientation landmark, not fixed HUD chrome; moves with yaw. | — | :278-280
D-08-068 | LOCKED | §O | polaris/restrained | Modestly larger/brighter star with theme-appropriate starburst, not photographic flare. | 02 | :282
D-08-069 | LOCKED | §O | polaris/tap-resets-yaw | Tapping Polaris resets yaw/north only. | — | :284
D-08-070 | DERIVED | §O | polaris/a11y | Orientation exposed textually. | — | :286
D-08-071 | LOCKED | §P | recenter/control | Familiar target/crosshair Recenter control. | — | :292
D-08-072 | LOCKED | §P | recenter/full-restore | Recenter restores complete canonical state: sun centered, Home zoom, top-down, canonical yaw, no Focus, no Cluster Focus. | — | :294-300
D-08-073 | LOCKED | §P | recenter/distance-adaptive | Distance-adaptive animated recovery (short gentle return; large: aggressive acquisition → slower approach → soft docking). | — | :302-309
D-08-074 | LOCKED | §P | recenter/continuous | Phases feel continuous, not segmented. | — | :311
D-08-075 | DERIVED | §P | recenter/bounded | Total duration bounded. | — | :313
D-08-076 | DERIVED | §P | recenter/reduced-motion | Reduced Motion → short direct transition. | 02 | :315
D-08-077 | LOCKED | §Q | inertia/restrained | Very restrained inertia (pan tiny; yaw tiny; zoom little/none; tilt none). | — | :321-327
D-08-078 | LOCKED | §Q | inertia/no-coast | Never coast/spin to hinder inspection. | — | :329
D-08-079 | DERIVED | §Q | inertia/reduced-motion | Reduced Motion disables inertial continuation. | 02 | :331
D-08-080 | LOCKED | §R | reorder/one-finger-pans | Ordinary one-finger drag is reserved for panning. | — | :337
D-08-081 | LOCKED | §R | reorder/prolonged-hold | Ring/rank reordering requires an intentionally prolonged stationary hold before drag activation, longer than a casual long-press. | — | :339-341
D-08-082 | LOCKED | §R | reorder/activation-feedback | Clear visual/haptic acknowledgement on activation. | 01 | :343
D-08-083 | DERIVED | §R | reorder/pre-activation-pan | Movement before activation resolves as pan. | — | :345
D-08-084 | DERIVED | §R | reorder/tuning | Hold duration, slop, haptic timing are device-testing details. | — | :347
D-08-085 | LOCKED | §S | systems/switching | Orrery supports switching among dynamic Systems defining which contacts are visualized. | 09 | :353
D-08-086 | LOCKED | §S | systems/phase-8-owns-builtin | Phase 8 owns the built-in switcher and built-in/derived Systems, not custom authoring. | 09 | :355
D-08-087 | LOCKED | §S | systems/builtin-list | Initial built-ins: All Contacts; Favorites; Needs Attention; Not Contacted; Snoozed; Chargers; one per user-visible Category. | 04 | :357-364
D-08-088 | LOCKED | §S | systems/all-default | All Contacts is the default/canonical System. | 09 | :366
D-08-089 | LOCKED | §S | systems/live | Systems resolve against live data, not frozen member IDs. | 09 | :368
D-08-090 | LOCKED | §S | systems/no-sort | Orrery exposes no conventional sort controls. | — | :370
D-08-091 | DERIVED | §S | systems/reuse-predicates | Reuse Dashboard/contact predicate semantics at domain level; don't bind to Dashboard's live state. | 04 | :372
D-08-092 | DERIVED | §S | systems/category-reflect | Category Systems reflect user-managed Category definitions once administration exists. | 15 | :374
D-08-093 | LOCKED | §T | switcher/compact | Current System shown via compact control `All Contacts ▾`. | 09 | :380-382
D-08-094 | LOCKED | §T | switcher/dropdown | Tapping opens a lightweight dropdown/floating list. | 09 | :384
D-08-095 | LOCKED | §T | switcher/no-tabs | No permanent tabs/chips per System. | — | :386
D-08-096 | LOCKED | §T | switcher/no-polished-anim | Phase 8 does not own the theatrical switch animation. | 09 | :388
D-08-097 | DERIVED | §T | switcher/simple-transition | Simple functional transition sufficient in Phase 8. | 09 | :390
D-08-098 | LOCKED | §U | membership-change/transitions | Same-System live membership changes: departing fade/shrink; retained settle; new fade/grow; continuity not spectacle. | — | :396-401
D-08-099 | DERIVED | §U | membership-change/reduced | Reduced Motion → fades/direct repositioning. | 02 | :403
D-08-100 | LOCKED | §V | controls/orrery-specific | Small dedicated view/control surface: System; Density (Spacious/Balanced/Compact); Relationship Satellites On/Off. | — | :409-414
D-08-101 | LOCKED | §V | satellites/default-off | Relationship Satellites default Off. | — | :416
D-08-102 | LOCKED | §V | reduced-motion/not-orrery-setting | Reduced Motion is not an Orrery-local setting; follows OS preference; not enabled by default. | 02 | :418
D-08-103 | DERIVED | §V | controls/sparse | Chrome sparse. | — | :420
D-08-104 | LOCKED | §W | satellites/unlinked-relationships | Phase 8 may visualize existing unlinked person-like structured Relationships as satellites/moons around their parent when enabled. | 03 | :426-428
D-08-105 | LOCKED | §W | satellites/all-person-types | All person-like relationship types eligible; not hardcoded to spouses/kids. | 03 | :430
D-08-106 | LOCKED | §W | satellites/unlinked-only | Only relationships whose person is NOT linked to an Orbit contact use satellite presentation. | 03 | :432
D-08-107 | LOCKED | §W | satellites/not-contacts | Satellites are not full contacts (no status, Gravity, frequency, rails, membership, logging, Profile, sub-satellites). | — | :434-444
D-08-108 | LOCKED | §W | satellites/purpose | Lightweight contextual orientation, not a social-graph node. | — | :446
D-08-109 | DERIVED | §W | satellites/link-ends | If later linked to a real contact, satellite presentation ceases. | 03 | :448
D-08-110 | DERIVED | §W | satellites/no-graph-schema | No speculative `contact_level`/graph-parent/moon-owner schema. | — | :450
D-08-111 | LOCKED | §X | satellites/semantic-visibility | Semantic visibility: hidden at far overview; may appear when parent readable; visible at inspection; focused parent reveals. | — | :456-462
D-08-112 | LOCKED | §X | satellites/subordinate | Much smaller/subordinate. | — | :464
D-08-113 | DERIVED | §X | satellites/suppress | Suppressed when meaningless at scale/density. | — | :466
D-08-114 | LOCKED | §Y | satellites/tap-focus | Tapping a satellite focuses it and reveals name + relation (`Laura` / `Phil's wife`). | 03 | :472-479
D-08-115 | LOCKED | §Y | satellites/no-profile | Satellite focus zooms less; no fake Profile route. | — | :481
D-08-116 | LOCKED | §Y | satellites/labels | Names not permanently labeled; appear on focus / deep parent inspection. | — | :483-485
D-08-117 | DERIVED | §Y | satellites/a11y | Semantics expose name/relation without precise tapping. | — | :487
D-08-118 | LOCKED | §Z | companion-list | Conventional accessible "Contacts in this System" companion list from Orrery controls. | — | :493
D-08-119 | LOCKED | §Z | companion/same-system | Represents the active System; not another universe; supports identity, health, Gravity context, focus in Orrery, open Profile. | 09,10 | :495-503
D-08-120 | LOCKED | §Z | companion/purpose | For screen-reader, switch-control, motor/precision, findability. | — | :505
D-08-121 | DERIVED | §Z | a11y/not-canvas-only | Accessibility must not depend on canvas-only manipulation. | — | :507
D-08-122 | LOCKED | §AA | reduced-motion/support | Reduced Motion supported, not default unless OS: ambient stops; inertia off; Focus Zoom direct; Recenter direct; membership fades; switch fallback. | 02,09 | :513-521
D-08-123 | LOCKED | §AA | reduced-motion/direct-controls | User-controlled tilt/yaw/pan/zoom remain available. | — | :523
D-08-124 | LOCKED | §AB | boundary/phase-9-split | Custom System authoring split into a sibling phase. Phase 8 owns consumption/resolution contract, built-ins, category-derived, switcher, active-System visualization; Phase 9 owns custom Systems. | 09 | :529-538
D-08-125 | LOCKED | §AB | systems/manual-membership-required | Custom Systems must eventually support explicit single/bulk selection beyond rules. | 09 | :540
D-08-126 | DERIVED | §AB | systems/model-capable | System model capable of rule-based + explicit membership without Phase 8 implementing the builder. | 09 | :542
D-08-127 | DEFERRED-DECISION | §AB | deferred→phase-9 | Create/rename/edit/delete System; custom predicates; manual membership; hybrid semantics; include/exclude; preview/counts; management; default custom behavior; polished animation. | 09 | :544-554
D-08-128 | LOCKED | §AC | switch-anim/spin-shed (for Phase 9) | Polished switching uses spin + shedding/capture; intensity responds to difference. | 09 | :560-569
D-08-129 | DERIVED | §AC | switch-anim/reduced | Reduced Motion → fade/reposition. | 02 | :571
D-08-130 | DEFERRED-FEATURE | §AC | deferred/anim-tuning | Curves, spin counts, streaks, physics, timing. | 09 | :573
D-08-131 | LOCKED | §AD | category-gap/watch | [DECIDED / CROSS-PHASE WATCH] Category administration incomplete; users need a later surface to create/rename/reorder/delete/manage categories. | 15 | :579-581
D-08-132 | DERIVED | §AD | category-gap/not-phase-8 | Not Phase 8 scope; belongs to Settings/Contacts administration; Rapid Capture/Edit consume managed definitions. | 15,13 | :583
D-08-133 | DERIVED | §AD | category/no-hardcode | Phase 8 must not hardcode category names; consume the category domain model. | — | :585
D-08-134 | DEFERRED-FEATURE | §AE | deferred/social-graph | Social Graph / Satellite Orrery future milestone (first/second-level, edges, real moons, hierarchy, promotion, traversal, graph-aware Systems, editing, Profile graph, search, layout, directionality, exclusion behavior, health interplay). | — | :591-612
D-08-135 | LOCKED | §AE | satellites/not-graph | Phase 8 Relationship Satellites are intentionally NOT this graph system. | — | :614
D-08-136 | DERIVED | §AE | arch/not-all-orbit-sun | Architecture avoids assuming every body orbits the sun. | — | :616
D-08-137 | DERIVED | §AE | arch/frame-arbitrary | Camera/framing operates on arbitrary body sets. | — | :618
D-08-138 | DERIVED | §AE | arch/separate-layout | Separate domain/layout from projection/camera/rendering. | — | :620
D-08-139 | DERIVED | §AE | arch/relationships-foundation | Existing structured linked Relationships (Phase 3) are the future foundation; no speculative graph schema now. | 03 | :622
D-08-140 | XREF | §AF | xref/→theme | Orrery may use stronger perspective/glow/edge-to-edge/Polaris/motion within tokens, contrast, a11y, reduced motion, fallbacks. | 02 | :628
D-08-141 | XREF | §AF | xref/→shell | Orrery is a top-level tab; Profile from Orrery returns to camera/session state; transient Focus/Cluster dismiss before navigation. | 01 | :629
D-08-142 | XREF | §AF | xref/→knowledge | Satellites consume existing structured person relationships; linked ones are semantic records. | 03 | :630
D-08-143 | XREF | §AF | xref/→data-state | Reuse predicates at domain level; not Dashboard's query state or sort UI. | 04 | :631
D-08-144 | XREF | §AF | xref/→dashboard-card | Gravity derived-never-stored; no editable visual mass. | 07 | :632
D-08-145 | XREF | §AF | xref/→profile | Full details Profile-owned; Orrery focus lightweight. | 10 | :633
D-08-146 | XREF | §AF | xref/→settings | Category CRUD outside Phase 8 but a required follow-up gap. | 15 | :634
D-08-147 | XREF | §AF | xref/→systems | Phase 9 owns custom Systems, explicit membership, hybrid rules, management UX, polished transitions. | 09 | :635
D-08-148 | XREF | §AF | xref/→social-graph | Preserve extensibility; no graph semantics now. | — | :636
D-08-149 | XREF | §AF | xref/→hardening | Hardening audits landscape/tablet, a11y scale, performance, gesture conflicts, GPU, density/camera tuning. | 18 | :637
D-08-150 | DEFERRED-FEATURE | Explicitly Deferred | deferred/p8 | Relationship-mode redesign as second mode; true 3D; below-plane; extreme zoom; exact limits/constants/timings/thresholds/mappings; numeric density; System builder/management; hybrid semantics; polished switch; animation options; real graph layout; first/second-level; real moons; edge editing; graph Systems; moons-of-moons; graph inference; graph DB fields; category admin implementation; Polaris artwork; satellite artwork. | 09,15 | :641-668
D-08-151 | LOCKED | Success Criteria | sc/1-20 | SC1 one canonical visualization, no Status/Relationship split; SC2 pan/zoom/tilt/yaw bounded; SC3 perspective readable; SC4 Gravity modest, non-editable; SC5 Home readable, density presets, extends beyond viewport; SC6 spacing + nudging + exploration; SC7 semantic zoom; SC8 tap focus / open Profile; SC9 Cluster Focus + panel; SC10 camera restore/Home; SC11 Polaris + Recenter; SC12 adaptive recenter; SC13 pan vs prolonged-hold reorder; SC14 built-in Systems dropdown; SC15 density + satellites toggle, no sort; SC16 satellites; SC17 companion list; SC18 Reduced Motion; SC19 hierarchical-ready architecture; SC20 Systems separable. | — | :673-692
D-08-152 | LOCKED | Notes for GSD | note/not-greenfield | Camera/scale/exploration phase, not greenfield; reuse existing health rendering/domain. | — | :698
D-08-153 | LOCKED | Notes for GSD | note/remove-dual-mode | Remove/simplify the Status/Relationship dual-mode product. | — | :699
D-08-154 | LOCKED | Notes for GSD | note/architecture-center | World/layout → camera/projection → renderer architecture. | — | :700
D-08-155 | LOCKED | Notes for GSD | note/no-three-js | No Three.js/game engine unless proven necessary. | — | :701
D-08-156 | LOCKED | Notes for GSD | note/no-shrink-forever | Preserve world-space legibility; let Orrery exceed viewport. | — | :702
D-08-157 | LOCKED | Notes for GSD | note/density-targets | Balanced ≈ six, comfortable toward ten; UX targets. | — | :703
D-08-158 | LOCKED | Notes for GSD | note/gravity-restrained | Gravity influence restrained and derived. | — | :704
D-08-159 | LOCKED | Notes for GSD | note/hit-target-ambiguity | Ambiguity at hit-target level. | — | :705
D-08-160 | LOCKED | Notes for GSD | note/frame-primitive | Reusable frame-arbitrary-bodies primitive. | 09 | :706
D-08-161 | LOCKED | Notes for GSD | note/builtin-only | Phase 8 owns built-in Systems + switcher only. | 09 | :707
D-08-162 | LOCKED | Notes for GSD | note/satellites-lightweight | Satellites lightweight; not graph semantics. | 03 | :708
D-08-163 | LOCKED | Notes for GSD | note/preserve-graph-deferred | Preserve the Social Graph section downstream. | — | :709
D-08-164 | LOCKED | Notes for GSD | note/category-gap | Flag category administration gap; do not solve in Orrery. | 15 | :710
D-08-165 | LOCKED | Notes for GSD | note/companion-path | Accessibility includes a conventional companion path. | — | :711
D-08-166 | LOCKED | Notes for GSD | note/tuning | Constants, curves, radii, geometry, thresholds, performance are implementation/device-testing work. | 18 | :712

## Phase 09 — Orrery Systems · `phase-09-orrery-systems-dossier.md`

Legend :5-8.

D-09-001 | LOCKED | Scope | scope | Defines Orrery Systems (membership, rules, overrides, HUD builder, Manage Members, preview, management, category fallout, switching, persistence, empty/broken, deletion/duplication, backup, a11y); does NOT redefine Phase 8 camera/projection/renderer/layout/focus/satellites. | 08 | :12-31
D-09-002 | LOCKED | §A | system/definition | A System is a named Orrery view whose membership resolves from live data. | 08 | :37
D-09-003 | LOCKED | §A | system/not-snapshot | Systems are not static snapshots unless intentionally manual-only. | — | :39
D-09-004 | LOCKED | §A | system/orrery-only | Systems are Orrery concepts, not app-wide saved searches. | 04 | :41
D-09-005 | LOCKED | §A | system/all-default | Built-in All Contacts remains the default/factory System. | 08 | :43
D-09-006 | LOCKED | §A | system/last-active-persists | Last active System persists across relaunch. | — | :45
D-09-007 | DEFERRED-FEATURE | §A | deferred/startup-system | Separate configurable startup/default System. | — | :47
D-09-008 | LOCKED | §B | membership/hybrid | Unified hybrid model: rules; explicit manual inclusions; explicit exclusions of rule-produced contacts. | — | :53-56
D-09-009 | LOCKED | §B | membership/manual-only-valid | Manual-only Systems valid, no rule required. | — | :58
D-09-010 | LOCKED | §B | membership/no-type-choice | Users not forced to choose a System "type". | — | :60
D-09-011 | DERIVED | §B | membership/persist-separately | Persisted definition separately represents rules, manual inclusions, currently relevant exclusions. | — | :62
D-09-012 | LOCKED | §C | rules/or-and | Rules reuse Dashboard model: OR within family, AND across families. | 04 | :68-74
D-09-013 | LOCKED | §C | rules/no-boolean-programming | No arbitrary boolean-query programming initially. | — | :76
D-09-014 | LOCKED | §C | rules/no-nesting | Systems do not reference/nest other Systems initially. | — | :78
D-09-015 | DERIVED | §C | rules/reuse-domain | Reuse shared predicate logic, not Dashboard UI/query state. | 04 | :80
D-09-016 | DEFERRED-FEATURE | §C | deferred/nesting | System-to-System composition. | — | :82
D-09-017 | LOCKED | §D | rules/families | Initial rule vocabulary: Category; Favorite; Relationship Status / Needs Attention; Gravity / Closeness; Social Battery; Contact Frequency; Not Contacted; Snoozed. | 04 | :88-96
D-09-018 | LOCKED | §D | rules/no-birthday | Birthday omitted from the initial rule builder. | — | :98
D-09-019 | DERIVED | §D | rules/canonical-semantics | Rule evaluation consumes canonical domain semantics. | 04 | :100
D-09-020 | LOCKED | §E | inclusion/overrides-rules | Manual inclusion overrides the rule result. | — | :106-108
D-09-021 | LOCKED | §E | exclusion/applies-to-rule-members | Exclusions apply to contacts currently produced by rules. | — | :110
D-09-022 | LOCKED | §E | exclusion/dynamic-bucket | Rule-derived Systems are dynamic buckets, not ledgers: an exclusion is discarded when the contact stops matching; re-matching includes normally. | — | :112-116
D-09-023 | LOCKED | §E | inclusion/durable | Manual inclusions durable until removed, subject to lifecycle eligibility. | — | :118
D-09-024 | DERIVED | §E | exclusion/no-stale | Do not accumulate stale exclusions. | — | :120
D-09-025 | LOCKED | §E | reset-overrides | `Reset Membership Overrides` removes includes/excludes, preserves rules. | — | :122
D-09-026 | LOCKED | §F | eligibility/add-people-active | `Add People` searches eligible active contacts, not Archived/Unbound. | 04 | :128
D-09-027 | LOCKED | §F | eligibility/archived-inclusion-kept | Manually included contact later Archived: inclusion kept in definition; contact temporarily ineligible, not rendered. | — | :130
D-09-028 | LOCKED | §F | eligibility/editor-shows-unavailable | Editor may show such a contact as unavailable/Archived. | — | :132
D-09-029 | DERIVED | §F | eligibility/restore-reactivates | Restoring eligibility reactivates the inclusion. | — | :134
D-09-030 | LOCKED | §G | builtin/phase-8-provides | Phase 8 provides built-ins; Phase 9 manages them (All Contacts, Favorites, Needs Attention, Not Contacted, Snoozed, Chargers, per-Category). | 08 | :140-149
D-09-031 | LOCKED | §G | builtin/immutable-base | Built-in base definitions immutable. | — | :151
D-09-032 | LOCKED | §G | builtin/overrides | Users may layer manual include/exclude overrides on built-ins. | — | :153
D-09-033 | LOCKED | §G | builtin/no-rename | Built-ins cannot be renamed. | — | :155
D-09-034 | LOCKED | §G | builtin/hideable-except-all | Built-ins may be hidden except All Contacts (visible, pinned). | — | :157
D-09-035 | LOCKED | §G | builtin/customized-indicator | Customized built-ins indicate overrides exist. | — | :159
D-09-036 | LOCKED | §G | builtin/duplicate-editable | Built-ins can be duplicated into custom Systems with editable predicate. | — | :161
D-09-037 | LOCKED | §H | category-systems/one-per-category | One automatic System per user Category. | 15 | :167
D-09-038 | LOCKED | §H | category-systems/behave-like-builtins | Generated automatically; not independently deletable; hideable; overridable; duplicable. | — | :169-174
D-09-039 | LOCKED | §H | category-systems/rename-follows | Renaming a Category renames its System. | 15 | :176
D-09-040 | LOCKED | §H | category-systems/delete-removes | Deleting a Category removes the generated System. | 15 | :178
D-09-041 | DERIVED | §H | category-admin/warn | Category administration must warn when deleting a Category whose System has overrides or whose predicate is used by custom Systems. | 15 | :180
D-09-042 | LOCKED | §I | broken/no-silent-rewrite | Rules referencing something that ceases to exist are not silently deleted/rewritten. | — | :186-188
D-09-043 | LOCKED | §I | broken/visible-needs-attention | Unavailable rule remains visible as needing attention. | — | :190
D-09-044 | LOCKED | §I | broken/rest-resolves | Remaining valid rules/inclusions resolve normally. | — | :192
D-09-045 | LOCKED | §I | broken/no-wizard | Category deletion needs no multi-System reconciliation wizard; confirmation may explain affected Systems. | 15 | :194-196
D-09-046 | LOCKED | §I | broken/repair-in-editor | Users repair via ordinary editors. | — | :198
D-09-047 | LOCKED | §J | empty/valid-selectable | Zero-member System remains valid/selectable. | — | :204
D-09-048 | LOCKED | §J | broken/selectable | Broken System remains selectable, resolving remaining definition. | — | :206
D-09-049 | LOCKED | §J | empty-vs-broken/severity | Different severity: empty mild caution (yellow-triangle family); broken stronger error (red-stop family); via icon/theme system. | 02 | :208-214
D-09-050 | LOCKED | §J | dropdown/indicators | Dropdown exposes these indicators. | — | :216
D-09-051 | LOCKED | §J | broken/orrery-affordance | Broken Systems may show a small nonblocking `needs attention` in Orrery. | — | :218
D-09-052 | LOCKED | §J | empty/lively | Empty presentation more lively than blank: empty canvas, concise copy, a restrained comet crossing once, no constant loop. | 02 | :220-226
D-09-053 | DERIVED | §J | empty/reduced-motion | Reduced Motion replaces/removes the comet. | 02 | :228
D-09-054 | LOCKED | §K | builder/hud-wizard | Creation/editing uses a floating Orrery HUD wizard, not a conventional modal form. | 02 | :234
D-09-055 | LOCKED | §K | builder/over-canvas | Builder appears over a fresh/canonical Orrery canvas. | 08 | :236
D-09-056 | LOCKED | §K | builder/visual-exception | HUD may differ visually from ordinary modal/sheet language. | 02 | :238
D-09-057 | LOCKED | §K | builder/multi-page | Multiple internal pages/states. | — | :240
D-09-058 | LOCKED | §L | builder/definition-page | First page: Back/Cancel; name; rule configuration; current match count; Manage Members; Save where appropriate. | — | :246-252
D-09-059 | LOCKED | §L | builder/accordions | Rule families as stacked accordions. | — | :254
D-09-060 | LOCKED | §L | builder/header-summaries | Collapsed headers summarize values with meaningful labels (`Category · Friends, Community`). | — | :256-261
D-09-061 | LOCKED | §L | builder/manage-members-always | Manage Members available with no rules (manual-only). | — | :263
D-09-062 | LOCKED | §M | manage/reuse-picker | Manage Members reuses the canonical picker/selection foundation. | 01,07 | :269
D-09-063 | LOCKED | §M | manage/grid | Multi-select grid: avatar, name, selection state. | 07 | :271-275
D-09-064 | LOCKED | §M | manage/rule-members-preselected | Rule-derived members enter already selected. | — | :277
D-09-065 | LOCKED | §M | manage/deselect-excludes | Deselecting a rule-derived member expresses an exclusion without removing the card. | — | :279
D-09-066 | LOCKED | §M | manage/excluded-visible | Excluded rule-derived members remain visible, greyed, Excluded state. | — | :281
D-09-067 | LOCKED | §M | manage/add-people | `Add People` manually includes nonmatching eligible active contacts. | — | :283
D-09-068 | LOCKED | §M | manage/override-presentation | Manually altered members presented understandably on reopen. | — | :285
D-09-069 | LOCKED | §M | manage/counts | Exposes counts (total; added/excluded). | — | :287
D-09-070 | DERIVED | §M | manage/virtualized | Resolved set inspectable via virtualized/searchable grid; no truncation. | — | :289
D-09-071 | LOCKED | §N | preview/full-canvas | Preview is full-canvas, not a tiny box. | 08 | :295
D-09-072 | LOCKED | §N | preview/collapse-bar | Entering Preview collapses HUD into a small Preview/Edit bar; canvas shows provisional System. | — | :297
D-09-073 | LOCKED | §N | preview/real-layout-simplified | Uses the real Phase 8 layout/scale model with simplified rendering (sun, rails, markers, approximate sizing; no photos/labels/decor). | 08 | :299-306
D-09-074 | LOCKED | §N | preview/answers-membership-scale | Answers membership and scale before Save. | — | :308
D-09-075 | LOCKED | §N | preview/pan-zoom | Supports pan and zoom; not tilt/yaw initially. | 08 | :310-312
D-09-076 | LOCKED | §N | preview/no-profile | Planet interaction may identify/focus but not open Profile. | 01 | :314
D-09-077 | LOCKED | §N | preview/save-available | Save available without Preview and from Preview. | — | :316
D-09-078 | LOCKED | §N | preview/edit-restores | `Edit` restores the full HUD at prior state. | — | :318
D-09-079 | LOCKED | §O | feedback/detailed | Builder gives detailed membership feedback, not only a count; names/photos via Manage Members; Preview communicates scale. | — | :324-328
D-09-080 | DERIVED | §O | feedback/no-rebuild | Production Orrery behind the builder doesn't rebuild on every toggle. | — | :330
D-09-081 | LOCKED | §P | save/new-switches | Saving a new System switches the Orrery to it. | — | :336
D-09-082 | LOCKED | §P | save/active-stays | Editing the active System keeps it active. | — | :338
D-09-083 | LOCKED | §P | save/non-active-returns | Editing a non-active System returns to management without changing active. | — | :340
D-09-084 | LOCKED | §P | save/discard-keep | Unsaved changes inherit Discard/Keep editing. | 01 | :342
D-09-085 | LOCKED | §Q | management/screen | Conventional flat Systems Management screen separate from the dropdown. | — | :348
D-09-086 | LOCKED | §Q | management/entry-points | Entry: dropdown → Manage Systems; Settings may route to the same screen. | 15 | :350-353
D-09-087 | LOCKED | §Q | management/owns-admin | Management owns administration; dropdown is not a CRUD surface. | — | :355
D-09-088 | LOCKED | §Q | management/operations | Create/edit/rename/delete custom; duplicate; reorder visible; hide/show built-in/category; edit/reset overrides. | — | :357-365
D-09-089 | LOCKED | §Q | management/create | `Create New System` available from management. | — | :367
D-09-090 | LOCKED | §Q | management/all-pinned | All Contacts pinned first, visible, nondeletable. | — | :369
D-09-091 | LOCKED | §R | hide-delete | Built-in/category hideable; custom deletable (no hide/archive state). | — | :375-377
D-09-092 | LOCKED | §R | delete/simple-confirm | Deleting a custom System uses a simple confirmation. | — | :379
D-09-093 | LOCKED | §R | delete/no-contact-data | Deleting a System never deletes/modifies contact data. | — | :381
D-09-094 | LOCKED | §R | delete/active-fallback | Deleting the active System falls back to All Contacts. | — | :383
D-09-095 | LOCKED | §R | delete/undo | Successful deletion offers a short-lived Undo snackbar. | 01 | :385
D-09-096 | LOCKED | §R | delete/no-quarantine | System deletion does not use the 30-day contact quarantine. | — | :387
D-09-097 | LOCKED | §S | duplicate/all-kinds | Custom, built-in, category Systems may be duplicated. | — | :393
D-09-098 | LOCKED | §S | duplicate/predicate-editable | Duplicating built-in/category converts base predicate into editable rule. | — | :395
D-09-099 | LOCKED | §S | duplicate/naming | Deterministic uniqueness-aware naming (`Inner Circle Copy`, `Copy 2`, …); immediately editable. | — | :397-404
D-09-100 | LOCKED | §T | naming/unique-ci | Names unique case-insensitively. | — | :410
D-09-101 | LOCKED | §T | naming/builtin-protected | Built-in names protected from indistinguishable collisions. | — | :412
D-09-102 | LOCKED | §T | naming/no-cap | No cap on number of custom Systems. | — | :414
D-09-103 | DEFERRED-FEATURE | §T | deferred/folders | Folders/tags. | — | :416
D-09-104 | LOCKED | §U | switcher/dropdown | Compact dropdown/current-System control (`All Contacts ▾`); switching only. | 08 | :422-427
D-09-105 | LOCKED | §U | switcher/order | Dropdown order = Management order; All Contacts first; hidden omitted. | — | :429-433
D-09-106 | LOCKED | §U | switcher/member-counts | Displays dynamic member counts (`Family — 12`). | — | :435-440
D-09-107 | LOCKED | §U | switcher/zero-visible | Zero-member Systems visible/selectable; empty/broken indicators shown. | — | :442-444
D-09-108 | DEFERRED-FEATURE | §U | deferred/recent | Recent Systems section. | — | :446
D-09-109 | LOCKED | §V | switch/home-framing | Switching sends the destination to Phase 8 Home framing, not prior pan/zoom/tilt. | 08 | :452
D-09-110 | LOCKED | §V | switch/preserve-focus | If focused contact exists in both, try to preserve focus; else clear. | 08 | :454-456
D-09-111 | DERIVED | §V | switch/device-test | Device-test; simplify only if disorienting. | 18 | :458
D-09-112 | LOCKED | §W | anim/spin-shed | Polished switching = spin + shedding/capture (narrowing: impulse, shed, retain, settle; expanding: stream in, retain, settle). | 08 | :464-475
D-09-113 | LOCKED | §W | anim/delta-adaptive | Intensity adaptive to membership delta, not raw counts. | — | :477-479
D-09-114 | LOCKED | §W | anim/no-lockout | Must not unnecessarily lock out interaction. | — | :481
D-09-115 | LOCKED | §W | anim/phase-8-simple | Phase 8 may use simpler transition; Phase 9 owns polished. | 08 | :483
D-09-116 | DERIVED | §W | anim/tuning | Spin count, curves, effects, timings are tuning. | — | :485
D-09-117 | LOCKED | §X | reduced-motion | Reduced Motion supported, not default; crossfade/reposition replaces spin; OS-derived. | 02 | :491-495
D-09-118 | LOCKED | §Y | a11y/hud-operable | HUD fully operable without the canvas. | — | :501
D-09-119 | LOCKED | §Y | a11y/accordions | Accordions expose expanded/collapsed/selected state. | — | :503
D-09-120 | LOCKED | §Y | a11y/grid | Manage Members grid exposes multi-selection semantics. | — | :505
D-09-121 | LOCKED | §Y | a11y/preview-text | Preview provides textual membership summary. | — | :507
D-09-122 | LOCKED | §Y | a11y/focus | Background Orrery removed from a11y focus while HUD open; Preview/Edit focus handling. | — | :509-511
D-09-123 | DERIVED | §Y | a11y/state-icons | Empty/broken icons have distinct textual semantics. | 02 | :513
D-09-124 | LOCKED | §Z | scale/no-cap | No arbitrary product-level max membership (e.g. 100/300). | 08 | :519
D-09-125 | LOCKED | §Z | scale/large-valid | Large Systems valid and inspectable. | — | :521
D-09-126 | DERIVED | §Z | scale/no-full-render | Not a requirement to render every contact at full cost. | 08 | :523
D-09-127 | DERIVED | §Z | scale/culling-lod | Phase 8 architecture supports culling and/or LOD. | 08 | :525
D-09-128 | DERIVED | §Z | scale/lazy-photos | Photos/labels loaded by visibility/inspection need. | — | :527
D-09-129 | DERIVED | §Z | scale/preview-simplified | Preview uses simplified rendering for scale. | — | :529
D-09-130 | DERIVED | §Z | scale/virtualized-members | Manage Members virtualized/searchable. | — | :531
D-09-131 | DERIVED | §Z | scale/budgets-later | Tested counts/budgets belong to UAT/hardening; failure at realistic counts is a release-quality issue, not a reason for a cap. | 18 | :533
D-09-132 | LOCKED | §AA | backup/system-state | Backup/Restore preserves user-authored System state: custom definitions, rules, inclusions, overrides, ordering, visibility, built-in/category overrides, last active, other config. | — | :539-550
D-09-133 | DERIVED | §AA | backup/not-builtin-defs | Built-in definitions not serialized; user customization is. | — | :552
D-09-134 | DERIVED | §AB | category-gap/watch | [DERIVED / CROSS-PHASE WATCH] Category values need user-facing administration; later owner (Settings / Contacts Administration) provides CRUD. | 15 | :558-560
D-09-135 | DERIVED | §AB | category-gap/not-phase-9 | Systems consume Categories; Phase 9 doesn't own CRUD. | 15 | :562
D-09-136 | DERIVED | §AB | category-delete/accounts | Category deletion UX accounts for generated System disappearance, overrides on it, custom rules referencing it; no dedicated wizard. | 15 | :564-569
D-09-137 | XREF | §AC | xref/→phase-8 | Phase 8 authoritative for camera, Home, projection, density, focus, high-count architecture, basic switcher, built-in availability, satellites. | 08 | :575
D-09-138 | XREF | §AC | xref/→data-state | Predicate semantics reused; no shared live UI state. | 04 | :576
D-09-139 | XREF | §AC | xref/→card | Selection concepts reusable; member selection is a builder flow. | 07 | :577
D-09-140 | XREF | §AC | xref/→knowledge | Structured knowledge canonical; Systems select, don't redefine state. | 03 | :578
D-09-141 | XREF | §AC | xref/→shell | Builder is focused; unsaved-change/back follow shell. | 01 | :579
D-09-142 | XREF | §AC | xref/→theme | HUD distinctive but tokenized/accessible. | 02 | :580
D-09-143 | XREF | §AC | xref/→settings | Settings owns Category administration; may link to Systems Management. | 15 | :581
D-09-144 | XREF | §AC | xref/→backup | Preserves definitions/configuration. | — | :582
D-09-145 | XREF | §AC | xref/→hardening | Validates large-System performance, a11y, responsive HUD, transitions. | 18 | :583
D-09-146 | DEFERRED-FEATURE | Explicitly Deferred | deferred/p9 | Nesting; boolean builder; folders/tags; startup System; Recent; Birthday predicate; System sorting; static snapshots as type; AI Systems; shared Systems; per-System camera; per-System density; app-wide saved search; deletion wizard; graph-aware Systems. | — | :589-603
D-09-147 | DEFERRED-FEATURE | Future Milestone | deferred/social-graph | Social Graph / Satellite Orrery preserved (list). Satellites are not this model. | — | :609-628
D-09-148 | LOCKED | Success Criteria | sc/1-15 | SC1 create w/ rules/manual/both; SC2 OR/AND shared predicates; SC3 durable inclusions, temporary exclusions; SC4 built-in/Category immutable base + overrides; SC5 multi-page HUD; SC6 Manage Members grid; SC7 Preview real geometry, no Profile nav; SC8 Management ops; SC9 Category rename/delete predictable, no wizard; SC10 empty/broken distinct + comet; SC11 last active persists, Home on switch; SC12 delta-adaptive spin, Reduced Motion alternative; SC13 no cap, culling/LOD; SC14 backup; SC15 accessible HUD/management. | — | :634-648
D-09-149 | LOCKED | Notes for GSD | note/sibling-after-8 | Dedicated sibling phase after Phase 8. | 08 | :654
D-09-150 | LOCKED | Notes for GSD | note/no-builder-in-8 | Do not pull the builder into Phase 8. | 08 | :655
D-09-151 | LOCKED | Notes for GSD | note/reuse | Reuse predicates, selection foundations, layout calculations. | 04,07,08 | :656
D-09-152 | LOCKED | Notes for GSD | note/no-snapshots | Don't model custom Systems as snapshots by default. | — | :657
D-09-153 | LOCKED | Notes for GSD | note/no-stale-exclusions | Don't persist stale exclusions. | — | :658
D-09-154 | LOCKED | Notes for GSD | note/no-boolean | No boolean programming/nesting initially. | — | :659
D-09-155 | LOCKED | Notes for GSD | note/hud-experiment | HUD is an Orrery UX experiment, not a redesign of all modals. | 02 | :660
D-09-156 | LOCKED | Notes for GSD | note/preview-shares-layout | Preview shares layout calculations, simplifies rendering. | 08 | :661
D-09-157 | LOCKED | Notes for GSD | note/no-cap | No made-up count ceiling; culling/LOD/virtualization required. | 08 | :662
D-09-158 | LOCKED | Notes for GSD | note/empty-broken-distinct | Keep empty and broken distinct. | — | :663
D-09-159 | LOCKED | Notes for GSD | note/category-owner | Category CRUD belongs to a later owner; preserve the gap. | 15 | :664
D-09-160 | LOCKED | Notes for GSD | note/no-graph | Do not expand into graph modeling. | — | :665

## Phase 10 — Profile Experience · `phase-10-profile-experience-dossier.md`

Legend :5-8.

D-10-001 | LOCKED | Scope | scope | Defines the Profile Experience; does NOT redefine Contact Knowledge storage, Status algorithm, Gravity algorithm, History/Insights, Add/Log/Update forms, Messaging/AI Compose, Category CRUD, AI provider config, onboarding, hardening. | 03,11,13,14,15,16 | :12-16
D-10-002 | LOCKED | §A | profile/read-surface | Profile is the presentation-first read surface for one relationship. | — | :22
D-10-003 | LOCKED | §A | profile/richer-than-dashboard | Richer/more personal than List/Card, faster to scan than a form. | 06,07 | :24
D-10-004 | LOCKED | §A | profile/not-workflow-owner | Profile should not own every workflow launched from it. | 13,14 | :26
D-10-005 | LOCKED | §A | profile/semantic-abstraction | Profile consumes the semantic Contact Knowledge abstraction. | 03 | :28
D-10-006 | DERIVED | §A | profile/modular | Composition modular so later phases replace section internals. | 11 | :30
D-10-007 | LOCKED | §B | hero/contents | Fixed Hero: large circular avatar, name, Category near name, Favorite state/control, Message, Call, overflow/administration entry, optional background. | — | :36-46
D-10-008 | LOCKED | §B | hero/consistent | Hero structure consistent across layouts/templates. | — | :48
D-10-009 | LOCKED | §B | hero/not-reorderable | Users cannot reorder the Hero beneath other sections. | — | :50
D-10-010 | LOCKED | §B | hero/templates-no-control | Layout templates do not control Hero structure. | — | :52
D-10-011 | DERIVED | §B | hero/anchor | Hero is the identity anchor; modular environment begins below. | — | :54
D-10-012 | LOCKED | §C | hero/actions | Profile-native direct actions initially Message and Call. | 14 | :60-63
D-10-013 | LOCKED | §C | hero/fab-not-duplicated | Quick Log, Log Contact, Update Contact, Memory remain primarily on the universal FAB. | 01 | :65
D-10-014 | LOCKED | §C | hero/stable-geometry | Message and Call keep stable geometry. | — | :67
D-10-015 | LOCKED | §C | hero/disabled-not-hidden | Unavailable action stays present but disabled with accessible explanation. | — | :69
D-10-016 | DERIVED | §C | hero/no-ai-draft | AI Draft is not restored as a separate Profile action; Messaging/AI Compose owns AI composition behind Message. | 14 | :71
D-10-017 | LOCKED | §D | background/dedicated | Profiles may use a dedicated Hero/Profile background independent of the app background. | 02 | :77
D-10-018 | LOCKED | §D | background/theme-defaults | Galaxy default starfield/space; Standard calmer default. | 02 | :79
D-10-019 | LOCKED | §D | background/templates-custom-images | Users may create reusable background templates/presets with custom images. | — | :81
D-10-020 | LOCKED | §D | background/drag-pinch | Editing supports drag/reposition + pinch crop. | — | :83
D-10-021 | LOCKED | §D | background/auto-readability | Orbit handles theme-aware readability (gradient/scrim) automatically. | 02 | :85
D-10-022 | LOCKED | §D | templates/independent | Layout templates and background templates are separate systems, combinable. | — | :87
D-10-023 | LOCKED | §D | background/assignment | Background assignment: global/default; Category; contact override. | 15 | :89-93
D-10-024 | LOCKED | §D | background/category-only-group | Category is the only initial group-level assignment. | — | :95
D-10-025 | LOCKED | §D | background/category-no-overwrite | Applying to a Category does not overwrite contact overrides. | — | :97
D-10-026 | LOCKED | §D | background/category-change | Contact Category change: inherited background follows new Category; explicit override remains. | 13 | :99-102
D-10-027 | DERIVED | §D | background/resolution | Nearest explicit: contact → Category → global/theme default. | — | :104
D-10-028 | DERIVED | §D | background/copy-downscale | Images copied into app storage and downscaled. | — | :106
D-10-029 | DEFERRED-FEATURE | §D | deferred/image-effects | Blur/brightness/overlay/filters/compositing. | — | :108
D-10-030 | LOCKED | §E | body/modular | Body below Hero is a modular customizable surface. | — | :114
D-10-031 | LOCKED | §E | body/capabilities | Users can reorder top-level sections, hide/show, configure default expanded/collapsed, customize eligible child sections within parent, configure Relationship Overview tile sizes. | — | :116-122
D-10-032 | LOCKED | §E | body/not-page-builder | Not an unrestricted page builder. | — | :124
D-10-033 | LOCKED | §E | body/one-nesting-level | One customizable nesting level: top-level; child within parent. | — | :126-130
D-10-034 | LOCKED | §E | body/children-stay | Child sections cannot move outside their parent. | — | :132-134
D-10-035 | LOCKED | §E | body/no-third-level | No third-level nesting. | — | :136
D-10-036 | LOCKED | §E | body/no-item-ordering | Individual items not manually ordered via the layout editor. | 03 | :138
D-10-037 | DERIVED | §E | body/item-order-by-domain | Pinning, type priority, current/history, metadata order items. | 03 | :140
D-10-038 | LOCKED | §F | templates/reusable | Reusable Profile layout templates supported. | — | :146
D-10-039 | LOCKED | §F | templates/global-default | One editable global/default layout. | — | :148
D-10-040 | LOCKED | §F | templates/named | Users may create reusable named templates. | — | :150
D-10-041 | LOCKED | §F | templates/assignment | Assignable to global/default; a Category; an individual contact. | 15 | :152-156
D-10-042 | LOCKED | §F | templates/category-only-group | Category is the only initial group-level layout assignment. | — | :158
D-10-043 | LOCKED | §F | templates/category-no-overwrite | Applying to a Category does not overwrite contact overrides. | — | :160
D-10-044 | LOCKED | §F | templates/contact-states | A contact may inherit global; inherit Category; use a saved template; use a freeform override. | — | :162-167
D-10-045 | LOCKED | §F | templates/propagate | Template changes update actively assigned Profiles. | — | :169
D-10-046 | LOCKED | §F | templates/freeform-independent | Freeform override not rewritten when a template changes. | — | :171
D-10-047 | LOCKED | §F | templates/category-change | Category change: inherited Profile switches; explicit override remains. | 13 | :173-176
D-10-048 | LOCKED | §F | templates/contact-outranks | Explicit contact customization outranks Category. | — | :178
D-10-049 | LOCKED | §F | templates/save-as-path | Editing freeform offers a path to save as template. | — | :180
D-10-050 | LOCKED | §F | templates/save-later | `Save as Template` available later, not one-time. | — | :182
D-10-051 | DERIVED | §F | templates/separate-defs-assignments | Layout definitions and assignments represented separately. | — | :184
D-10-052 | LOCKED | §G | editing/entry | Layout editing entered from overflow: `Profile overflow → Profile Layout → choose/switch OR Edit Layout`. | — | :190-192
D-10-053 | LOCKED | §G | editing/mode | Edit Layout: ordinary interactions disabled; drag/reorder; hide/show; size controls; nested sections; all eligible sections shown regardless of data; nav/FAB may hide; explicit Save/Cancel. | 01 | :194-203
D-10-054 | LOCKED | §G | editing/save-required | Layout changes require Save, not autosave. | — | :205
D-10-055 | LOCKED | §G | editing/discard-keep | Unsaved changes inherit Discard/Keep editing. | 01 | :207
D-10-056 | LOCKED | §G | editing/live-preview | Template editor provides live Profile preview. | — | :209
D-10-057 | LOCKED | §G | editing/preview-context | From a contact, use that contact; from management, sample or chosen contact. | — | :211-213
D-10-058 | LOCKED | §H | assignment/switch-clears-overrides | Switching a contact's layout/template clears its expanded/collapsed overrides. | — | :219
D-10-059 | LOCKED | §H | assignment/new-overrides | New overrides accumulate against the new template. | — | :221
D-10-060 | LOCKED | §H | reset/presentation | `Reset Profile Presentation` clears only contact-specific presentation overrides (layout/template override, expanded/collapsed, background override). | — | :223-229
D-10-061 | LOCKED | §H | reset/fallback | Reset falls back to Category then global. | — | :231
D-10-062 | LOCKED | §H | reset/no-data | Reset does not modify contact data, Favorite, Snooze, AI permissions, knowledge. | — | :233
D-10-063 | DERIVED | §H | reset/separate-actions | Separate Layout/Background resets may be provided if combined proves too broad. | — | :235
D-10-064 | LOCKED | §I | collapsed/per-contact | Expanded/collapsed persists per contact. | — | :241
D-10-065 | LOCKED | §I | collapsed/template-defaults | Templates define default state; contact overrides. | — | :243-245
D-10-066 | LOCKED | §I | collapsed/both-levels | State at top-level and eligible child level. | — | :247-250
D-10-067 | LOCKED | §I | collapsed/tiles-no-collapse | Relationship Overview tiles don't individually collapse; shown/hidden and sized. | — | :252
D-10-068 | DERIVED | §I | collapsed/separate-state | Persisted presentation state separate from template definition. | — | :254
D-10-069 | LOCKED | §J | factory-order | Factory order below Hero: Relationship Overview; Things to Remember; Contact Methods; Interaction History. | — | :260-265
D-10-070 | LOCKED | §J | factory/only-default | Factory composition only; users may change ordering. | — | :267
D-10-071 | LOCKED | §J | history/top-level | Interaction History is standalone top-level, not a child of Relationship Overview; defaults bottom. | 11 | :269-271
D-10-072 | LOCKED | §K | empty/edit-shows-all | In edit mode all eligible sections appear regardless of data. | — | :277
D-10-073 | LOCKED | §K | empty/collapsed-not-hidden | In viewing, an enabled empty section remains represented but collapsed. | — | :279
D-10-074 | LOCKED | §K | empty/summaries | Collapsed empty sections use concise summaries (`Relationships · Nothing added yet`). | — | :281
D-10-075 | DERIVED | §K | empty/add-affordance | Opening an empty section may expose a route/add affordance owned by an existing/future workflow. | 13 | :283
D-10-076 | LOCKED | §L | overview/stats-section | Relationship Overview is the stats-oriented modular section; visually distinct; tile/grid; modules support reorder/hide/size variants; not an unrestricted dashboard builder. | — | :289-297
D-10-077 | DERIVED | §L | overview/declared-variants | Each module declares supported sizes. | — | :299
D-10-078 | LOCKED | §M | overview/sizes | Limited size variants (1×1, 2×1); individually chosen; auto-repack from order/size/width; no manual x/y. | — | :305-311
D-10-079 | DERIVED | §M | overview/no-holes | Avoid permanent holes; column count from width/a11y. | 18 | :313-315
D-10-080 | LOCKED | §N | overview/modules | Initial modules: Orbit Status; Gravity; Intensity; Last Interaction; Contact Frequency; Snooze. | — | :321-327
D-10-081 | LOCKED | §N | overview/category-in-hero | Category lives in the Hero, not the factory overview. | — | :329
D-10-082 | LOCKED | §O | status/model | Existing Orbit Status model: Stable, Wobbly, Decaying, Rogue. | — | :335-339
D-10-083 | LOCKED | §O | status/no-health | No separate Health metric. | — | :341
D-10-084 | LOCKED | §O | status/label-prominent | Literal Status label shown prominently. | — | :343
D-10-085 | LOCKED | §O | status/derivation | Status derives from existing logic: last contacted / recency and configured Contact Frequency. | — | :345
D-10-086 | LOCKED | §O | status/no-new-factors | Phase 10 adds no factors. | — | :347
D-10-087 | LOCKED | §O | status/not-editable | Status not user-editable. | — | :349
D-10-088 | LOCKED | §O | status/tile-sizes | Factory Status uses a larger/wide tile; compact variant available. | — | :351-353
D-10-089 | LOCKED | §O | status/explanation | Tapping Status may show a lightweight explanation using the actual factors (last interaction, target frequency) + route toward Insights. | 11 | :355
D-10-090 | LOCKED | §O | status/no-tunable-weighting | No user-tunable Status weighting. | — | :357
D-10-091 | DERIVED | §O | status/no-invented-factors | Explanation must not invent factors the algorithm doesn't use. | — | :359
D-10-092 | LOCKED | §P | gravity/derived | Gravity remains derived-never-stored. | — | :365
D-10-093 | LOCKED | §P | gravity/tier-sphere | Named tier plus a size-coded sphere. | — | :367
D-10-094 | LOCKED | §P | gravity/wide-range | Size bounded but wide (tiny-to-huge). | — | :369
D-10-095 | LOCKED | §P | gravity/theme | Galaxy luminous body; Standard clean sphere; meaning/tiers unchanged by theme. | 02 | :371-373
D-10-096 | LOCKED | §P | gravity/detail | May open minimal explanation; never editable from Profile. | — | :375-377
D-10-097 | DERIVED | §P | gravity/tuning | Sphere mapping and thresholds are tuning. | — | :379
D-10-098 | LOCKED | §Q | intensity/subordinate | Intensity is separate but subordinate; recent activity relative to cadence, not quality. | — | :385-387
D-10-099 | LOCKED | §Q | intensity/histogram | Compact bar/histogram. | — | :389
D-10-100 | LOCKED | §Q | intensity/interval-dynamic | Histogram interval resolves dynamically from Contact Frequency. | — | :391
D-10-101 | LOCKED | §Q | intensity/tier | May include named tier (Low/Moderate/High). | — | :393
D-10-102 | LOCKED | §Q | intensity/tap | Tap shows larger histogram + interval explanation. | 11 | :395
D-10-103 | DERIVED | §Q | intensity/tuning | Bins, interval functions, tier thresholds are tuning. | — | :397
D-10-104 | LOCKED | §R | last-interaction/module | Last Interaction is its own module; concrete fact vs Status interpretation; compact = relative recency; expanded = relative/absolute date, type, note preview. | — | :403-409
D-10-105 | DERIVED | §R | last-interaction/phase-11 | Detailed history/editing remains Phase 11. | 11 | :411
D-10-106 | LOCKED | §S | frequency/adjustable | Contact Frequency directly adjustable from its module via compact menu; applies immediately; Status updates automatically. | — | :417-423
D-10-107 | DERIVED | §S | frequency/reuse | Reuse canonical Contact Frequency values/domain behavior. | 13 | :425
D-10-108 | LOCKED | §T | snooze/module | Snooze is an optional overview module; quiet when inactive, prominent when active; shows `Snoozed until …`. | — | :431-435
D-10-109 | LOCKED | §T | snooze/menu | Tap opens a lightweight menu: existing presets, change, Unsnooze, custom duration/date path. | — | :437
D-10-110 | LOCKED | §T | snooze/custom-route | New narrowly scoped route/surface for custom snooze duration/date (current app supports presets only). | — | :439
D-10-111 | DERIVED | §T | snooze/scope | Custom route owns selecting the end point only. | — | :441
D-10-112 | LOCKED | §U | methods/top-level | Contact Methods is top-level after Things to Remember. | — | :447
D-10-113 | LOCKED | §U | methods/show-all | Ordinary-sized sets show all methods directly. | — | :449
D-10-114 | LOCKED | §U | methods/collapse-long-only | Collapse only genuinely long sets. | — | :451
D-10-115 | LOCKED | §U | methods/actionable | Valid methods actionable. | — | :453
D-10-116 | LOCKED | §U | methods/malformed-visible | Malformed/unusable imported methods remain readable with disabled state. | — | :455
D-10-117 | DERIVED | §U | methods/reuse | Reuse normalized phone/email models, labels, primary state, validation. | — | :457
D-10-118 | LOCKED | §V | ttr/concept | Things to Remember remains one broad concept over first-class fields, Custom Fields, Relationships, Memories. | 03 | :463
D-10-119 | LOCKED | §V | ttr/one-column | One-column list/section presentation, not tiles. | — | :465
D-10-120 | LOCKED | §V | ttr/children | Child sections reorder within, hide/show, persist expanded/collapsed; cannot leave. | — | :467-469
D-10-121 | LOCKED | §V | ttr/factory-child-order | Factory child order: Pinned/Featured; Last Talked About; Key People/Relationships; Current Location; Memories; Custom Fields; Off Limits; Imported Contact Notes. | 03 | :471-479
D-10-122 | LOCKED | §W | cards/fast-retrieval | Summary cards prioritize fast retrieval over every field. | — | :485
D-10-123 | LOCKED | §W | cards/no-blank | Blank metadata consumes no space. | — | :487
D-10-124 | LOCKED | §W | cards/secondary-small | Secondary metadata via small text/badges/icons. | — | :489
D-10-125 | LOCKED | §W | cards/truncate | Long content truncates before oversizing. | — | :491
D-10-126 | LOCKED | §W | cards/no-fuel-regression | Profile must not reproduce the oversized Conversation Fuel cards with empty fields. | — | :493
D-10-127 | LOCKED | §W | cards/type-varies | Summary layout may vary by semantic type. | 03 | :495
D-10-128 | DERIVED | §W | cards/shell-plus-hints | Shared card shell + type-specific hints from the registry. | 03 | :497
D-10-129 | LOCKED | §X | cards/fuel-pattern | Conversation Fuel-style items: Topic badge upper-right; primary content body; optional Label lower-right; Link icon not URL; blanks omitted; extra metadata in detail. | — | :503-509
D-10-130 | DERIVED | §X | cards/same-principle | Other types follow the same principle. | — | :511
D-10-131 | LOCKED | §Y | pinned/near-top | Pinned/Featured near the top; references same items, no duplicates; restrained highlighted presentation; ~three visible then View all. | 03 | :517-523
D-10-132 | DERIVED | §Y | pinned/not-visibility | Pinning affects priority not visibility. | — | :525
D-10-133 | LOCKED | §Z | lta/latest | Latest Last Talked About shown as current; expanded may show topic, date, note; `View history` when history exists; history on a child surface. | 03 | :531-537
D-10-134 | LOCKED | §AA | relationships/distinct-label | Key People/Relationships gets a distinct label/treatment. | — | :543
D-10-135 | LOCKED | §AA | relationships/linked | Linked contacts show avatar, name, relation, navigation to Profile. | 03 | :545
D-10-136 | LOCKED | §AA | relationships/unlinked | Unlinked show placeholder, name, relation, no fake route. | 03 | :547
D-10-137 | LOCKED | §AA | relationships/no-inline-link | Linking/unlinking not inline from Profile. | 13 | :549
D-10-138 | LOCKED | §AA | relationships/edit-elsewhere | Substantive edits via Update/Edit Contact. | 13 | :551
D-10-139 | DERIVED | §AA | relationships/preserve-distinction | Preserve linked vs unlinked distinction used by Orrery Satellites. | 08 | :553
D-10-140 | LOCKED | §AB | location/current-first | Current Location shows current first; drill-in to Location History (child surface); editing outside Profile. | 03 | :559-565
D-10-141 | LOCKED | §AC | memories/cap-three | Expanded Memories show soft cap ~3; `View all N memories`. | — | :571-573
D-10-142 | LOCKED | §AC | memories/card-content | Cards show title/value, ~two lines preview, minimal metadata; full content in detail. | — | :575-577
D-10-143 | DERIVED | §AC | memories/section-caps | Section-specific caps, ~three common default. | — | :579
D-10-144 | LOCKED | §AD | view-all | `View all` when cap exceeded; same style, denser; read/management list, not a form. | — | :585-589
D-10-145 | DERIVED | §AD | view-all/search-if-needed | Search/filter only where volume justifies. | — | :591
D-10-146 | LOCKED | §AE | item/detail | Tapping a card opens a detail surface. | — | :597
D-10-147 | LOCKED | §AE | item/no-inline-controls | Cards don't permanently show edit/delete. | — | :599
D-10-148 | LOCKED | §AE | item/long-press | Long-press opens context menu: Edit; Pin/Unpin; Hide from Profile. | — | :601-605
D-10-149 | DERIVED | §AE | item/delete-where-supported | Delete where the type supports it; not visually dominant. | 03 | :607
D-10-150 | LOCKED | §AF | hidden/presentation-only | Hidden-from-Profile is presentation state only. | 03 | :613
D-10-151 | LOCKED | §AF | hidden/absent-when-expanded | Hidden items absent even when parent expanded. | — | :615
D-10-152 | LOCKED | §AF | hidden/outranks-pin | Visibility outranks pinning. | — | :617
D-10-153 | LOCKED | §AF | hidden/recoverable | Recoverable via Edit Profile Layout/content administration (dimmed + Show) and `View all` Show hidden. | — | :619-624
D-10-154 | LOCKED | §AF | hidden/never-inaccessible | Hiding never makes information inaccessible. | — | :626
D-10-155 | DERIVED | §AF | hidden/not-privacy | Not privacy, deletion, soft-delete, AI permission, or Off Limits. | 03 | :628
D-10-156 | LOCKED | §AG | customfields/model | Profile follows the Contact Knowledge model for Custom Fields; structured typed; honors configured groups inside the child section; groups are data grouping, not a third layout level; users reorder the Custom Fields child only. | 03 | :634-642
D-10-157 | DERIVED | §AG | customfields/variants-later | Card/row variants per value type finalized in implementation. | — | :644
D-10-158 | LOCKED | §AH | offlimits/visible-default | Off Limits enabled and fully visible in factory Profile; not hidden/collapsed by default. | 03 | :650-652
D-10-159 | LOCKED | §AH | offlimits/presentation | Distinct non-error presentation: caution/avoid icon, heading `Off Limits`, `Avoid bringing these up`. | 02 | :654
D-10-160 | LOCKED | §AH | offlimits/separate-ai | Separate from AI permission; AI-enabled shows sparkle without changing meaning. | 03,16 | :656-658
D-10-161 | DERIVED | §AH | offlimits/ai-mgmt-elsewhere | Detailed AI permission management on item detail/edit and the central surface. | 16 | :660
D-10-162 | LOCKED | §AI | imported-notes | Imported Contact Notes in Things to Remember; enabled but collapsed by default; compact cards; AI-off by default. | 03 | :666-672
D-10-163 | LOCKED | §AJ | history/seam | Interaction History standalone top-level, defaults bottom; Phase 10 keeps it minimal (latest few, last-contact summary, `View all history`). | 11 | :678-686
D-10-164 | LOCKED | §AJ | history/no-final-ux | Profile does not implement heatmap-first, drill-down, rich timeline, full detail/editing. | 11 | :688
D-10-165 | LOCKED | §AJ | history/layout-owns-slot | Layout/template owns History position, show/hide, default expanded state. | 11 | :690
D-10-166 | LOCKED | §AJ | history/phase-11-internals | Phase 11 owns internals and deeper routes. | 11 | :692
D-10-167 | DERIVED | §AJ | history/replaceable-slot | Build History as a replaceable section renderer/slot. | 11 | :694
D-10-168 | LOCKED | §AK | overflow/primary-admin | Profile overflow is the primary administration menu; contact actions before presentation actions: Edit Contact; Snooze/Unsnooze; Archive; Edit Profile Layout; Switch Contact Layout; Background; Save Current Layout as Template; Reset Profile Presentation. | 13 | :700-712
D-10-169 | LOCKED | §AK | overflow/no-favorite | Favorite in Hero, not duplicated. | — | :714
D-10-170 | LOCKED | §AK | overflow/no-fab-dup | Quick Log, Log Contact, Update Contact, Memory stay on FAB. | 01 | :716
D-10-171 | DERIVED | §AK | overflow/wording | Wording/separators tunable. | — | :718
D-10-172 | LOCKED | §AL | managers/canonical | Layout and background templates require canonical management routes/screens owned by Profile. | 15 | :724-726
D-10-173 | LOCKED | §AL | managers/settings-links | Settings may link into the same routes. | 15 | :728
D-10-174 | LOCKED | §AL | managers/ops | Create, rename, edit, preview, global/Category/contact assignment, remove/reset, usage. | — | :730
D-10-175 | DERIVED | §AL | managers/no-category-crud | Category CRUD remains Settings/Contacts Administration; Profile consumes Categories as targets. | 15 | :732
D-10-176 | LOCKED | §AM | a11y/no-drag-only | Customization operable without precise drag. | — | :738
D-10-177 | DERIVED | §AM | a11y/move-up-down | Move Up/Down alternatives. | — | :740
D-10-178 | LOCKED | §AM | a11y/status-text | Status exposed textually. | — | :742
D-10-179 | LOCKED | §AM | a11y/disabled-why | Disabled Message/Call explain why. | — | :744
D-10-180 | LOCKED | §AM | a11y/gravity-tier | Gravity accompanied by named tier. | — | :746
D-10-181 | LOCKED | §AM | a11y/intensity-text | Intensity accompanied by text. | — | :748
D-10-182 | LOCKED | §AM | a11y/relationships-text | Relationships expose names/relations. | — | :750
D-10-183 | LOCKED | §AM | a11y/state-exposed | Hidden/visible, expanded, template, assignment, edit-mode state exposed. | — | :752
D-10-184 | DERIVED | §AM | a11y/large-text | Large text increases height / narrows grids. | 18 | :754
D-10-185 | DERIVED | §AN | responsive | Hero and sections reflow; tile columns from width; large text reduces columns; no portrait-only absolute positions. | 18 | :760-766
D-10-186 | DEFERRED-DECISION | §AN | deferred/tablet-polish | Final tablet/landscape polish and performance budgets → Hardening. | 18 | :768
D-10-187 | DERIVED | §AO | arch/registry | Central Profile section/module registry (ID, name, parent, defaults, variants, hide/show, fixed, renderer, a11y, preview). | — | :774-788
D-10-188 | DERIVED | §AO | arch/separation | Separate data, layout definitions, assignments, contact overrides, renderers. | — | :790-795
D-10-189 | DERIVED | §AO | arch/replace-renderers | Later phases replace renderers without rewriting the engine. | 11 | :797
D-10-190 | DERIVED | §AO | arch/semantic-ids | Templates reference semantic module IDs. | — | :799
D-10-191 | XREF | §AP | xref/→shell | Profile is a browse/read destination with origin-aware Back, nav/FAB, focused exceptions. | 01 | :805
D-10-192 | XREF | §AP | xref/→theme | Tokens; restrained cards. | 02 | :806
D-10-193 | XREF | §AP | xref/→knowledge | Phase 3 authoritative for fields, Memories, history, Relationships, Custom Fields, visibility, pinning, AI permission, Off Limits, imported notes, type metadata. | 03 | :807
D-10-194 | XREF | §AP | xref/→dashboard | Profile doesn't redefine Dashboard status/search/favorite semantics. | 04 | :808
D-10-195 | XREF | §AP | xref/→orrery | Status and Gravity consistent with Orrery. | 08 | :809
D-10-196 | XREF | §AP | xref/→systems-categories | Profile consumes Categories for assignment; not Systems. | 09 | :810
D-10-197 | XREF | §AP | xref/→history | Phase 11 owns final History; Profile owns the seam. | 11 | :811
D-10-198 | XREF | §AP | xref/→rapid | Phase 13 owns Add/Log/Update/edit workflows. | 13 | :812
D-10-199 | XREF | §AP | xref/→compose | Phase 14 owns Message composition/AI/Copy/Send. | 14 | :813
D-10-200 | XREF | §AP | xref/→settings | Settings links to managers; owns Category administration. | 15 | :814
D-10-201 | XREF | §AP | xref/→ai-config | Phase 16 owns central AI review; Profile reflects item state. | 16 | :815
D-10-202 | XREF | §AP | xref/→onboarding | Onboarding may introduce customization. | 17 | :816
D-10-203 | XREF | §AP | xref/→hardening | Audits a11y, landscape, large text, packing, image memory, performance. | 18 | :817
D-10-204 | DEFERRED-FEATURE | Explicitly Deferred | deferred/p10 | Page builder; x/y placement; resizable tiles; third-level nesting; item drag ordering; Systems/Favorites/Status/Gravity assignment groups; overlapping dynamic inheritance; Hero templates; background effects; remote packs; exhaustive card artwork; final History UX; new Status factors/weighting; Health metric; Gravity editing; Gravity mapping; Intensity formulas; Category CRUD; full AI permission mgmt; full Compose UX; tablet polish; timings. | — | :821-844
D-10-205 | LOCKED | Success Criteria | sc/1-20 | SC1–SC20 as listed (Hero; modular body; layout templates; background templates; Save/Cancel editing; factory order; auto-packed tiles; Status explained w/o new metric; Gravity/Intensity; Last Interaction/Frequency/Snooze + custom snooze; Contact Methods; TTR compact; child rules; tap/long-press; hidden recoverable; Off Limits visible; History seam; overflow ordering; canonical managers; accessible). | — | :848-869
D-10-206 | LOCKED | Notes for GSD | note/after-9 | Profile composition phase after Orrery Systems. | 09 | :875
D-10-207 | LOCKED | Notes for GSD | note/dont-delay | Do not delay Profile until 11/13/14; build seams. | 11,13,14 | :876
D-10-208 | LOCKED | Notes for GSD | note/no-p11 | Do not pull Phase 11 heatmap/timeline/detail into Profile. | 11 | :877
D-10-209 | LOCKED | Notes for GSD | note/no-p12-forms (stale numbering) | "Do not pull Phase 12's forms/business workflows into Profile merely because Profile links to Edit/Log/Update." (Rapid Capture is Phase 13 after the insert.) | 13 | :878
D-10-210 | LOCKED | Notes for GSD | note/no-p13-compose (stale numbering) | "Do not pull Phase 13's Message/AI Compose implementation into the Profile Hero action itself." (Messaging is Phase 14.) | 14 | :879
D-10-211 | LOCKED | Notes for GSD | note/no-category-crud | Do not pull Category CRUD into Profile. | 15 | :880
D-10-212 | LOCKED | Notes for GSD | note/templates-independent | Keep layout and background templates independent. | — | :881
D-10-213 | LOCKED | Notes for GSD | note/assignment-scopes | Initial scopes global/Category/contact only. | — | :882
D-10-214 | LOCKED | Notes for GSD | note/no-dynamic-groups | No Systems/Favorites/Status/Gravity/dynamic rules as assignment groups. | 09 | :883
D-10-215 | LOCKED | Notes for GSD | note/hero-fixed | Hero fixed. | — | :884
D-10-216 | LOCKED | Notes for GSD | note/overview-exception | Relationship Overview is the tile exception; rest one-column. | — | :885
D-10-217 | LOCKED | Notes for GSD | note/no-form-cards | Memory cards must not regress into form-like cards. | — | :886
D-10-218 | LOCKED | Notes for GSD | note/registry-ids | Semantic IDs + registry so upgrades need no layout-state migrations. | — | :887

## Phase 11 — Interaction History & Insights (v0.2) · `phase-11-interaction-history-insights-dossier-v0.2-group-events.md`

Legend :5-8; amended 2026-09-01 (:3, :38).

D-11-001 | LOCKED | Scope | scope | Defines History & Insights; does NOT redefine Profile composition, Status/Gravity algorithms, Contact Frequency, general analytics, Your Week, Contact Knowledge storage beyond established history-bearing records, Rapid Capture forms, Category CRUD, AI, broad audit logging. | 03,10,13 | :12-34
D-11-002 | LOCKED | Amendment | group/parent-context | Group Event is a parent authoring/history-context record around canonical one-contact child Interactions. | 12 | :48
D-11-003 | LOCKED | Amendment | group/not-interaction | Parent is not an additional contact Interaction. | 12 | :50
D-11-004 | LOCKED | Amendment | group/once-per-contact | For one contact, a Group Event appears in History exactly once via the child. | 12 | :52
D-11-005 | LOCKED | Amendment | group/no-double-count | Parent does not become a second History row; does not increment Heatmap/Intensity; does not independently affect Last Interaction/Status/Gravity. | 12 | :54-60
D-11-006 | LOCKED | Amendment | group/contextual-metadata | Affiliation is contextual metadata on the child. | 12 | :62
D-11-007 | LOCKED | Amendment | group/zero-participants | Zero-participant Group Event creates no child and doesn't appear in any contact's History. | 12 | :64
D-11-008 | DERIVED | Amendment | group/read-paths | Aggregation/read paths resolve from child rows only; never union parents. | 12 | :66
D-11-009 | LOCKED | Amendment | detail/group-context | Group-linked Interaction Detail exposes Group Event context without becoming a duplicate Group Event Detail. | 12 | :70
D-11-010 | LOCKED | Amendment | detail/badge | Restrained **Group event** badge/label. | 12 | :72
D-11-011 | LOCKED | Amendment | detail/fields | May show Group Event title, shared Group Note, participant note separately, `View Group Event`. | 12 | :74-79
D-11-012 | LOCKED | Amendment | detail/notes-distinct | Group Note and participant note distinct semantic/storage fields; never concatenated for display/edit persistence. | 12 | :81-83
D-11-013 | DERIVED | Amendment | detail/route | `View Group Event` routes to Phase 12 Group Event Detail. | 12 | :85
D-11-014 | LOCKED | Amendment | edit/scope-choice | [SUPERSEDED / EXTENDED] Edit on a group-linked Interaction first asks scope: Edit individual interaction / Edit Group Event. | 12 | :88-93
D-11-015 | LOCKED | Amendment | edit/individual-scope | Individual routes to the participant override editor exposing only overridable fields: Channel, Tone, Duration, Direction, Connected, participant note. | 12 | :95-103
D-11-016 | LOCKED | Amendment | edit/no-title-date | Title and shared date/time not individually editable. | 12 | :105
D-11-017 | LOCKED | Amendment | edit/group-scope | Edit Group Event routes to Phase 12 Edit Group Event. | 12 | :107
D-11-018 | LOCKED | Amendment | edit/no-hybrid | No hybrid editor with implicit scope. | 12 | :109
D-11-019 | DERIVED | Amendment | edit/standalone-unchanged | Standalone Interactions use the canonical Edit route unchanged. | — | :111
D-11-020 | LOCKED | Amendment | datetime/shared | Group date/time shared, non-overridable; editing it updates all child timestamps. | 12 | :115-117
D-11-021 | DERIVED | Amendment | datetime/refresh | After that atomic mutation, Phase 11 consumers refresh (placement, heatmap, intensity, last interaction, derived). | 12 | :119-124
D-11-022 | DERIVED | Amendment | datetime/no-participant-editor | No participant-level timestamp editor for group-linked children. | 12 | :126
D-11-023 | LOCKED | Amendment | delete/child | Deleting a group-linked child: hard-delete + confirmation; deletes only that participant's Interaction; removes participant; others unaffected; parent not deleted; may leave zero participants. | 12 | :130-137
D-11-024 | LOCKED | Amendment | delete/no-group-trash | No Group-specific trash/quarantine. | 12 | :139
D-11-025 | DERIVED | Amendment | delete/refresh | Consumers refresh for the deleted contact. | — | :141
D-11-026 | LOCKED | Amendment | sheet/child-rows | Group-linked children remain ordinary rows in the detail sheet and Browser; parent not shown as an extra row. | 12 | :145-147
D-11-027 | DERIVED | Amendment | sheet/badge | Compact Group event marker where space allows. | 12 | :149
D-11-028 | LOCKED | Amendment | heatmap/context-card-no-group | Heatmap context card stays interaction-count-only; no separate Group Event count. | 12 | :151
D-11-029 | LOCKED | Amendment | conversion/seam | Standalone Interaction Detail overflow may expose `Add participants / Make this a group interaction`, routing to Phase 12 conversion; preserves identity/UID. | 12 | :155-161
D-11-030 | DERIVED | Amendment | conversion/ownership | Phase 11 owns only the entry seam; Phase 12 owns creation/persistence. | 12 | :163
D-11-031 | LOCKED | Supersession map | amend/map | Amendment map (Detail context; Edit route scope; delete child-only; heatmap/intensity/last-interaction child-only; Browser/sheet once; timestamps event-owned; overflow conversion). All unrelated decisions remain. | — | :165-177
D-11-032 | LOCKED | §A | history/temporal-not-feed | Dedicated temporal history experience, not a vertical feed. | — | :184
D-11-033 | LOCKED | §A | history/replace-timeline | Replaces the current weak timeline rather than polishing. | — | :186
D-11-034 | LOCKED | §A | history/goals | Goals: patterns over time; browse dates; inspect records; correct/backfill; understand Intensity over the window. | — | :188-194
D-11-035 | LOCKED | §A | history/no-timeline-required | A conventional always-visible chronological timeline is not required. | — | :196
D-11-036 | LOCKED | §B | structure/three-children | Three children: Activity Heatmap; Intensity; History Browser. | 10 | :202-206
D-11-037 | LOCKED | §B | structure/complementary | Heatmap = pattern/period exploration; Browser = precise date navigation. | — | :208-210
D-11-038 | LOCKED | §B | structure/intensity-shares-window | Intensity is separate but uses the same History window. | — | :212
D-11-039 | DERIVED | §B | structure/inherit-layout | Children may inherit Profile layout show/hide/collapse/reorder; Phase 11 owns internals. | 10 | :214
D-11-040 | LOCKED | §C | window/shared | Heatmap and Intensity share one lens/window; changing one updates the other (examples). | — | :219-227
D-11-041 | DERIVED | §C | window/shared-state | Shared selected-window state, not baked separately. | — | :229
D-11-042 | DERIVED | §C | window/decoupled-renderer | Intensity decoupled enough to swap to fixed-window later. | — | :231
D-11-043 | LOCKED | §D | heatmap/interaction-only | Heatmap strictly interaction-activity; colour encodes count only. | — | :237-239
D-11-044 | LOCKED | §D | heatmap/no-lifecycle | Lifecycle/non-interaction records do not affect saturation, don't appear in the context popup, may appear in the detail sheet. | — | :241-244
D-11-045 | LOCKED | §D | heatmap/count-separately | Multiple interactions in one bucket counted separately. | — | :246
D-11-046 | LOCKED | §D | heatmap/channel-neutral | Channel/type doesn't change colour semantics. | — | :248
D-11-047 | LOCKED | §D | heatmap/canonical-data | Deleted/re-dated interactions naturally change counts. | — | :250
D-11-048 | DERIVED | §D | heatmap/same-read-model | Aggregate from the authoritative interaction read model. | — | :252
D-11-049 | LOCKED | §E | lenses | Initial lenses: Cycles; 7 Days; Month; Year. | — | :258-263
D-11-050 | LOCKED | §E | lenses/selector | Compact segmented control or narrow-screen selector. | 02 | :265
D-11-051 | LOCKED | §E | lenses/persist-global | Last-used lens persists globally, not per contact. | — | :267
D-11-052 | LOCKED | §F | cycles/default | Cycles is the default and most Orbit-specific lens. | — | :273
D-11-053 | LOCKED | §F | cycles/block-per-cycle | Each block = one current Contact Frequency cycle. | — | :275-279
D-11-054 | LOCKED | §F | cycles/current-frequency | Bucketing always uses the currently configured Contact Frequency. | — | :281
D-11-055 | LOCKED | §F | cycles/no-historical-reconstruction | No reconstruction using historical settings. | — | :283
D-11-056 | LOCKED | §F | cycles/default-10 | Default count 10. | — | :285
D-11-057 | LOCKED | §F | cycles/presets | Presets 5/10/15/20 → 5-column arrangements. | — | :287-297
D-11-058 | LOCKED | §F | cycles/preset-persist-global | Preset persists globally. | — | :299
D-11-059 | LOCKED | §F | cycles/newest-bottom-right | Newest bottom-right; reading left-to-right, top-to-bottom. | — | :301
D-11-060 | LOCKED | §F | cycles/navigation | Swipe by one period; prev/next window controls. | — | :303-305
D-11-061 | DERIVED | §F | cycles/gesture-tuning | Gesture mechanics tunable if one-cycle and whole-window remain. | — | :307
D-11-062 | LOCKED | §G | current-cycle/same-saturation | In-progress cycle uses the same saturation semantics. | — | :313
D-11-063 | LOCKED | §G | current-cycle/no-second-hue | No second hue for current. | 02 | :315
D-11-064 | DERIVED | §G | current-cycle/structural-cue | Outline, corner marker, border, accessible `Current cycle` label; tuning. | — | :317-323
D-11-065 | LOCKED | §H | 7days/rolling | Rolling last seven days, not calendar week; today rightmost; navigate earlier windows. | — | :329-333
D-11-066 | DERIVED | §H | 7days/paging | One-week paging initial. | — | :335
D-11-067 | LOCKED | §I | month/calendar | Complete calendar month; weekday alignment; blank placeholders; prev/next. | — | :341-347
D-11-068 | DERIVED | §I | month/geometry | Geometry varies. | — | :349
D-11-069 | LOCKED | §J | year/dense | Complete calendar year, GitHub-like daily grid; day cells; month labels; prev/next. | 18 | :355-361
D-11-070 | DERIVED | §J | year/geometry | Weeks as columns, weekdays as rows. | — | :363
D-11-071 | LOCKED | §K | saturation/thresholds | Simple count thresholds; no severity encoding on empty runs; Status stays the interpretation. | — | :369-373
D-11-072 | DERIVED | §K | saturation/per-lens | Thresholds may differ by lens (0/1/2/3+ day; 0/1/2/3/4+ cycle); tuning. | — | :375-381
D-11-073 | LOCKED | §L | tap/no-large-sheet | Tapping a cell doesn't immediately open a large sheet. | — | :387
D-11-074 | LOCKED | §L | tap/context-card | First tap opens a small anchored context card (range, count, `See details`; empty: range, `0 interactions`, `Log interaction`). | — | :389-404
D-11-075 | LOCKED | §L | tap/no-lifecycle | Lifecycle events not mentioned in the context card. | — | :406
D-11-076 | LOCKED | §L | tap/see-details | `See details` opens the shared detail sheet. | — | :408
D-11-077 | LOCKED | §L | tap/log-interaction | `Log interaction` routes into detailed logging with contact preselected and date context where unambiguous. | 13 | :410
D-11-078 | DERIVED | §L | tap/single-day-predate | Single-day cell may pre-date; multi-day period must not invent a date. | 13 | :412-414
D-11-079 | LOCKED | §M | heatmap/reusable-primitive | Heatmap built as a reusable temporal primitive, not contact-hardcoded. | — | :420
D-11-080 | DERIVED | §M | heatmap/layers | Separate source/query, bucket/window generation, aggregation, presentation model, renderer. | — | :422-428
D-11-081 | DERIVED | §M | heatmap/profile-query | Profile supplies a single-contact query. | 10 | :430
D-11-082 | DERIVED | §M | heatmap/future-queries | Future analytics/Your Week may supply broader query shapes; group-level consumers need not support Cycles. | — | :432-436
D-11-083 | DEFERRED-FEATURE | §M | deferred/analytics | Account-level analytics, Category analytics UI, Your Week heatmap integration, group-frequency semantics. | — | :438
D-11-084 | LOCKED | §N | intensity/child | Intensity is a first-class child; larger bar/time-series than the Profile tile; same window; may show bars, tier, cadence context; no forecasting. | 10 | :444-455
D-11-085 | DERIVED | §N | intensity/tuning | Geometry, bins, tier display are tuning. | — | :457
D-11-086 | LOCKED | §O | browser/rolodex | Conventional timeline replaced by a Rolodex/wheel-style History Browser with three synchronized columns Month/Day/Year. | — | :463-469
D-11-087 | LOCKED | §O | browser/day-primary | Day is the primary axis; scrolling Day rolls Month/Year; Month/Year independently adjustable; continuous sync; invalid dates clamp. | — | :471-482
D-11-088 | LOCKED | §O | browser/no-future | Future dates not browsable; today is max. | — | :484-486
D-11-089 | LOCKED | §P | browser/theming | Galaxy restrained celestial/glow/depth; Standard cleaner/flatter; same mechanics; not skeuomorphic. | 02 | :492-499
D-11-090 | DERIVED | §P | browser/tokens | Theme tokens, not separate implementations. | 02 | :501
D-11-091 | LOCKED | §Q | browser/neighbors | ~2–3 neighboring rows above/below. | — | :507
D-11-092 | DERIVED | §Q | browser/neighbors-tuning | Row count is tuning; adjacent rows fade/scale. | 18 | :509-511
D-11-093 | LOCKED | §R | markers/before-selection | Dates with records marked before selection. | — | :517
D-11-094 | LOCKED | §R | markers/dot-count | Dot for one record; dot + count for multiple. | — | :519
D-11-095 | LOCKED | §R | markers/any-record | Markers represent any History record, not just interactions. | — | :521
D-11-096 | LOCKED | §R | markers/no-channel-quality | No channel/quality encoding in markers. | — | :523
D-11-097 | LOCKED | §R | markers/lifecycle-distinct | Lifecycle-only dates use a distinct treatment (filled vs outline; both → filled + count). | — | :525-531
D-11-098 | DERIVED | §R | markers/simplify | May simplify if too busy; distinction desirable. | 18 | :533
D-11-099 | LOCKED | §R | markers/a11y | Labels expose counts/types. | — | :535
D-11-100 | LOCKED | §S | drawer/no-fourth-column | No fourth Events column. | — | :541
D-11-101 | LOCKED | §S | drawer/summary | Compact drawer beneath wheels summarizes selected date (date, counts, `See details`; empty: `0 events logged`, `Log interaction`). | — | :543-553
D-11-102 | LOCKED | §S | drawer/lifecycle-included | Lifecycle events included in the drawer total. | — | :555
D-11-103 | LOCKED | §S | drawer/no-auto-open | Selecting a date doesn't auto-open the sheet. | — | :557
D-11-104 | LOCKED | §S | drawer/see-details | `See details` opens the same shared sheet. | — | :559
D-11-105 | LOCKED | §S | drawer/log-interaction | `Log interaction` routes to detailed logging pre-targeted and pre-dated. | 13 | :561
D-11-106 | LOCKED | §T | sheet/canonical | Heatmap and Browser reuse one canonical detail sheet listing all records for the date/period. | — | :567-569
D-11-107 | LOCKED | §T | sheet/interleaved | Interactions and lifecycle/history records interleaved chronologically; row type obvious via icons/treatments, not separate sections. | 02 | :571-573
D-11-108 | LOCKED | §T | sheet/interaction-row | Compact interaction row may show type/channel, time, direction, **quality/impact** where present, duration where present, one-line note preview. | — | :575-581
D-11-109 | LOCKED | §T | sheet/lifecycle-row | Lifecycle/history rows show change type, time/date, summary. | — | :583-586
D-11-110 | LOCKED | §T | sheet/tap-interaction | Tapping an interaction row opens Interaction Detail. | — | :588
D-11-111 | LOCKED | §T | sheet/tap-knowledge | Tapping an editable history-bearing knowledge change may open its detail/edit flow. | 03,13 | :590
D-11-112 | LOCKED | §T | sheet/lifecycle-readonly | Lifecycle events inspectable, read-only. | — | :592
D-11-113 | LOCKED | §T | sheet/log-interaction | Sheet may expose `Log Interaction` for backfill without becoming bulk management. | 13 | :594
D-11-114 | LOCKED | §T | sheet/no-batch | No multi-select/batch editing/deleting in Phase 11. | — | :596
D-11-115 | LOCKED | §U | families/three | Three record families: (1) Interactions — editable, deletable, optional duration; (2) System lifecycle events — Archive, Restore, Snooze, Unsnooze, Bind, Unbind "where present" — read-only, not deletable; (3) History-aware knowledge changes (Location, Job, other history-retained fields) — editable per owning model, not forced into lifecycle. | 03 | :602-645
D-11-116 | LOCKED | §U | families/no-audit-log | Do not turn History into a complete audit log; only semantically meaningful configured fields appear. | — | :647-649
D-11-117 | LOCKED | §U | families/no-frequency-changes | Contact Frequency changes not shown in v1. | — | :651
D-11-118 | LOCKED | §U | families/no-category-changes | Category changes not shown in v1. | — | :653
D-11-119 | DEFERRED-FEATURE | §U | deferred/audit-history | Broader config/audit history, filtering/search, admin-change display. | — | :655
D-11-120 | LOCKED | §V | detail/sheet | Tapping an interaction opens a compact Interaction Detail sheet/surface. | — | :661
D-11-121 | LOCKED | §V | detail/no-blanks | Shows complete meaningful info without blank fields; fields may include type/channel, date/time, direction, connected, **quality/impact**, duration, note, other metadata. | — | :663-673
D-11-122 | LOCKED | §V | detail/actions | Exposes Edit and Delete; editing moves to a focused route. | — | :675-680
D-11-123 | LOCKED | §W | edit/canonical-route | Phase 11 introduces a canonical Edit Interaction route — the general correction surface. | 13 | :686-688
D-11-124 | LOCKED | §W | edit/fields | Supports all editable fields incl. date/time, channel/type, direction, connected, **quality/impact**, note, duration. | — | :690-697
D-11-125 | LOCKED | §W | edit/no-future | Future dates remain invalid. | — | :699
D-11-126 | LOCKED | §W | edit/refresh | Saving refreshes derived surfaces automatically. | — | :701
D-11-127 | DERIVED | §W | edit/reuse-writer | Reuse the existing authoritative interaction-update writer. | — | :703
D-11-128 | DERIVED | §W | edit/phase-12-reuse (stale numbering) | "Phase 12 Rapid Capture may reuse this canonical route/component" — Rapid Capture is Phase 13 post-insert. | 13 | :705
D-11-129 | LOCKED | §X | delete/hard | Interaction deletion remains direct/hard-delete; no new trash lifecycle. | — | :711-713
D-11-130 | LOCKED | §X | delete/confirm | Explicit irreversible confirmation (copy given: may change Status, Gravity, Intensity); Cancel / Delete interaction; no dedicated route. | — | :715-725
D-11-131 | DERIVED | §X | delete/recompute | Reads recompute heatmap, Intensity, Status, Gravity, last-contact. | — | :727
D-11-132 | LOCKED | §Y | duration/optional | Phase 11 adds optional interaction duration; optional for all types; not required for any channel. | 12,13 | :733-737
D-11-133 | LOCKED | §Y | duration/human-units | Entry in minutes/hours, not raw seconds; supports none, presets (5m/15m/30m/1h/2h/Custom), custom hours/minutes. | 13 | :739-752
D-11-134 | LOCKED | §Y | duration/quick-log-never | Quick Log never asks for or sets duration. | 13 | :754
D-11-135 | LOCKED | §Y | duration/detailed-edit | Detailed Log/Edit may set duration. | 13 | :756
D-11-136 | LOCKED | §Y | duration/display | History/detail rows show compact text only when present (`24m`, `2h 15m`). | — | :758-762
D-11-137 | LOCKED | §Y | duration/descriptive-only | Descriptive/analytical only; does not alter Status/Gravity/Intensity in Phase 11. | — | :764-766
D-11-138 | DERIVED | §Y | duration/seconds | Persist in canonical unit (nullable seconds). | — | :768
D-11-139 | DERIVED | §Y | duration/migration | Migration/update must extend persistence, reads, backup/restore, detail/edit; preserve old rows with null. | — | :770
D-11-140 | LOCKED | §Z | backfill/low-friction | Empty dates/periods provide `Log interaction`. | 13 | :776
D-11-141 | LOCKED | §Z | backfill/no-separate-impl | History doesn't create a separate logging implementation; routes into canonical detailed logging with contact preselected and date prefilled when one exact day. | 13 | :778-783
D-11-142 | LOCKED | §Z | backfill/no-quick-log | Quick Log not used for backfill. | 13 | :785
D-11-143 | DERIVED | §Z | backfill/phase-12-owns (stale numbering) | "Phase 12 owns the final detailed logging form/business UX; Phase 11 only establishes History's route/context contract." (Ordinary detailed logging is Phase 13 post-insert.) | 13 | :787
D-11-144 | LOCKED | §AA | a11y/heatmap | Heatmap not colour-only; cells expose date/range + count; `Current cycle` textual; wheels expose Month/Day/Year with non-gesture adjustment; markers expose counts/types; drawer non-wheel path; detail rows semantic; Reduced Motion simplifies. | 02 | :793-807
D-11-145 | DERIVED | §AB | arch/read-layer | Reusable History read/aggregation layer; conceptual layers 1–9. | — | :813-824
D-11-146 | DERIVED | §AB | arch/consume-window | Heatmap/Intensity consume selected-window state. | — | :826
D-11-147 | DERIVED | §AB | arch/summaries | Browser consumes date-indexed summaries; full records lazily. | — | :828-830
D-11-148 | DERIVED | §AB | arch/wheel-impl | Wheel via Reanimated/Gesture Handler or compatible picker; no heavy dependency. | — | :832
D-11-149 | XREF | §AC | xref/→profile | Profile owns History placement/show-hide/collapse/template state; Phase 11 owns internals. | 10 | :838
D-11-150 | XREF | §AC | xref/→knowledge | Phase 3 authoritative for history-aware fields; don't force into lifecycle events. | 03 | :839
D-11-151 | XREF | §AC | xref/→shell | Edit Interaction is focused; canonical Back/unsaved. | 01 | :840
D-11-152 | XREF | §AC | xref/→theme | Tokens. | 02 | :841
D-11-153 | XREF | §AC | xref/→dashboard-orrery | Status/Gravity consistent; not redefined. | 04,08 | :842
D-11-154 | XREF | §AC | xref/→rapid | Rapid Capture owns the final detailed Log Contact form; Phase 11 routes to it and may expose reusable duration/edit components. | 13 | :843
D-11-155 | XREF | §AC | xref/→backup | Must preserve optional duration and history-bearing data. | — | :844
D-11-156 | XREF | §AC | xref/→hardening | Owns wheel density, neighbor tuning, yearly performance, large text, gesture QA. | 18 | :845
D-11-157 | XREF | §AC | xref/→analytics | Future Analytics/Your Week may reuse aggregation; not Phase 11 scope. | — | :846
D-11-158 | DEFERRED-FEATURE | Explicitly Deferred | deferred/p11 | Vertical timeline; account analytics; Category analytics; Your Week heatmap; group cycles; historical frequency reconstruction; Gravity chart; duration weighting; forecasting; channel encoding; missed-cycle severity; search/filtering; audit events; Frequency/Category changes; batch edit; trash; future browsing; exact thresholds/counts/artwork/values. | — | :850-874
D-11-159 | LOCKED | Success Criteria | sc/1-20 | SC1–SC20 as listed (three children; interaction-only lenses; Cycles current frequency/10/presets; shared window; current cycle cue; tap context card + detail + backfill; reusable aggregation; wheels; theming; markers; drawer; one sheet; interleaved families; Detail + canonical Edit; edits refresh; hard delete; optional duration stored canonically, omitted from Quick Log, metric-neutral; backfill route; accessible; no expansion into analytics/audit/forms). | — | :879-898
D-11-160 | LOCKED | Notes for GSD | note/one-phase | One coherent phase attached to Profile; don't split Heatmap and Browser. | 10 | :904-905
D-11-161 | LOCKED | Notes for GSD | note/no-vertical-timeline | Do not restore a vertical timeline. | — | :906
D-11-162 | LOCKED | Notes for GSD | note/heatmap-interaction-only | Keep Heatmap interaction-only. | — | :907
D-11-163 | LOCKED | Notes for GSD | note/three-families | Preserve the three record families. | 03 | :908
D-11-164 | LOCKED | Notes for GSD | note/lifecycle-immutable | Do not mutate the immutable lifecycle-event model for location/job history. | 03 | :909
D-11-165 | LOCKED | Notes for GSD | note/edit-route-reuse (stale numbering) | "Add a canonical Edit Interaction route here; Phase 12 can reuse it." | 13 | :910
D-11-166 | LOCKED | Notes for GSD | note/duration-here | Optional duration is a small domain expansion owned here. | — | :911
D-11-167 | LOCKED | Notes for GSD | note/shared-window | Keep timeframe shared unless testing shows a problem. | — | :912
D-11-168 | LOCKED | Notes for GSD | note/reuse-not-products | Build aggregation for reuse; don't roadmap analytics products. | — | :913
D-11-169 | LOCKED | Notes for GSD | note/tuning | Thresholds, row count, styling, inertia, micro-layout are tuning. | — | :914

## Phase 12 — Group Interaction Logging · `phase-12-group-interaction-logging-dossier.md`

Legend :5-8.

D-12-001 | LOCKED | Scope | scope | Defines the Group Interaction Logging subsystem; does NOT redesign ordinary single-contact logging, Add Contact, Update Contact, Messaging/AI Compose, Dashboard renderers, Profile layout, Settings IA, category administration, social analytics, event planning, calendar sync. | 13,14,15 | :11-15
D-12-002 | LOCKED | §A | group/first-class | First-class subsystem for one real-world encounter with multiple contacts without re-authoring per contact. | — | :18
D-12-003 | LOCKED | §A | group/durable-records | Group Events are durable social-event records with their own presentation/editing/browsing/management, not merely a bulk-action convenience. | 05,07 | :20
D-12-004 | LOCKED | §A | group/event-first-and-multi | Supports event-first capture and multi-contact authoring. | — | :22
D-12-005 | DERIVED | §A | group/hallmark | Treat as a hallmark feature while preserving contact-centric Interaction semantics. | — | :24
D-12-006 | LOCKED | §B | model/one-contact-per-interaction | Retain the one-contact-per-Interaction model. | 11 | :27
D-12-007 | LOCKED | §B | model/parent | New Group Event parent represents the encounter. | — | :29
D-12-008 | LOCKED | §B | model/child-per-participant | Each participant receives one ordinary canonical child Interaction row. | 11 | :31
D-12-009 | LOCKED | §B | model/nullable-ref | Child rows may carry a nullable Group Event reference. | — | :33
D-12-010 | LOCKED | §B | model/standalone-unchanged | Existing standalone Interactions unchanged, no reference. | — | :35
D-12-011 | LOCKED | §B | model/parent-not-interaction | Parent is not itself a contact interaction; never counted as one. | 11 | :51
D-12-012 | DERIVED | §B | model/consumers-children | Last Interaction, Status, Gravity, Intensity, Heatmap, History operate over child rows only. | 11 | :53
D-12-013 | LOCKED | §C | identity/title-required | Title required. | — | :56
D-12-014 | LOCKED | §C | identity/datetime-required | Date/time required. | — | :58
D-12-015 | LOCKED | §C | identity/participants-optional | Participants optional. | — | :60
D-12-016 | LOCKED | §C | identity/fields-optional | Channel, Tone, duration, Group Note optional. | — | :62
D-12-017 | LOCKED | §C | identity/zero-valid | Zero-participant Group Event valid; creates no children; no effect on history/metrics until participants added. | 11 | :64-66
D-12-018 | LOCKED | §D | event-owned | Group Event owns: required title; required date/time; shared/default Channel; shared/default Tone; shared/default Duration; Group Note; created/modified metadata. | — | :69-76
D-12-019 | LOCKED | §D | datetime/authoritative | Date/time authoritative for all participants; not overridable. | 11 | :78
D-12-020 | LOCKED | §D | title/event-only | Title event-only; not overridable. | — | :80
D-12-021 | LOCKED | §D | group-note/one-shared | Group Note is one true shared note owned by the event. | 11 | :82
D-12-022 | DERIVED | §D | child/resolved-values | Child rows retain resolved canonical values for existing consumers, while override/inheritance state preserves the authoring relationship. | 11 | :84
D-12-023 | LOCKED | §E | child/owns | Child owns contact identity, participant note, per-participant override state, resolved values. | — | :87
D-12-024 | LOCKED | §E | overridable/fields | Participant-overridable: Channel; Tone; Duration; Direction where relevant; Connected where relevant. | 11,13 | :89-94
D-12-025 | LOCKED | §E | not-overridable | Date/time and Title not overridable. | — | :96-98
D-12-026 | LOCKED | §E | membership/unique | A contact may appear at most once in one Group Event. | — | :100
D-12-027 | DERIVED | §E | membership/enforce-unique | Persistence enforces membership uniqueness per Group Event. | — | :102
D-12-028 | LOCKED | §F | tone/term | Canonical term is Tone. | 13 | :105
D-12-029 | LOCKED | §F | tone/null-default | New Group Events begin with Tone unset/null. | 13 | :107
D-12-030 | LOCKED | §F | tone/event-level-inherit | Tone may be set once at event level and inherited. | — | :109
D-12-031 | LOCKED | §F | tone/participant-override | Any participant may override Tone. | — | :111
D-12-032 | LOCKED | §F | tone/override-may-equal | An explicit override may equal the event Tone while remaining detached. | — | :113
D-12-033 | LOCKED | §G | inheritance/live | Shared/default values use true inheritance, not one-time copy (worked example). | — | :116-131
D-12-034 | LOCKED | §G | inheritance/reconnect | A participant field may later reconnect to live inheritance. | — | :133
D-12-035 | LOCKED | §G | inheritance/wording | Wording `Follow event tone` / `Follow event …`. | — | :135
D-12-036 | DERIVED | §G | inheritance/clear-override | Clearing an override removes override state, not a copy. | — | :137
D-12-037 | DEFERRED-FEATURE | §G | deferred/applies-to-counts | Live `applies to N of M participants` helper counts. | — | :139
D-12-038 | LOCKED | §H | notes/distinct-tied | Group Note and participant note distinct but tied via the child's relationship. | 11 | :142
D-12-039 | LOCKED | §H | notes/participant-ordinary | Participant note = the ordinary note on the child Interaction. | — | :144
D-12-040 | LOCKED | §H | notes/group-not-duplicated | Group Note is one shared record, not duplicated into children. | — | :146
D-12-041 | LOCKED | §H | notes/group-edit-visible | Editing Group Note updates the shared context visible from every child. | — | :148
D-12-042 | LOCKED | §H | notes/participant-untouched | Participant notes untouched by Group Note edits. | — | :150
D-12-043 | LOCKED | §H | notes/label | Shared text labeled **Group Note** when shown with a participant Interaction. | 11 | :152
D-12-044 | DERIVED | §H | notes/no-concat | Consumers show both without concatenating into one field. | 11 | :154
D-12-045 | LOCKED | §I | workflow/canonical | Group Log is one canonical reusable focused workflow. | 01,07,13 | :157
D-12-046 | LOCKED | §I | workflow/global-entry | `FAB → Group Log → Group Log form` (direct). | 01 | :159-163
D-12-047 | LOCKED | §I | workflow/no-preselection | Participant selection not required before entering. | 01 | :165
D-12-048 | LOCKED | §I | workflow/event-first | Event-first capture supported. | — | :167
D-12-049 | LOCKED | §I | workflow/participants-in-form | Participants added/managed within the form. | — | :169
D-12-050 | DERIVED | §I | workflow/embedded-picker | Embedded participant-management affordance invoking the shared multi-select picker. | 01 | :171
D-12-051 | LOCKED | §J | defaults/channel-in-person | Group Log defaults Channel to In Person. | 13,15 | :174
D-12-052 | LOCKED | §J | defaults/exempt-from-preference | Exempt from the ordinary global Channel-default preference (Message/Call/In Person/Remember last choice; factory Remember last choice). | 13,15 | :176-178
D-12-053 | LOCKED | §J | defaults/in-person-until-changed | Continues to default In Person unless a later product decision changes it. | — | :180
D-12-054 | LOCKED | §J | defaults/tone-null | Tone defaults null. | — | :182
D-12-055 | LOCKED | §J | defaults/duration-unset | Duration defaults unset. | 11 | :184
D-12-056 | LOCKED | §J | defaults/backdated | Historical/backdated Group Events supported. | — | :186
D-12-057 | LOCKED | §J | defaults/no-future | Future completed Group Events not allowed. | — | :188
D-12-058 | LOCKED | §K | picker/reuse-multiselect | Reuses the canonical picker in multi-select mode. | 01 | :191
D-12-059 | LOCKED | §K | picker/features | Search, selected count, clear, Done/Continue, archived via explicit search w/ marker, snoozed selectable w/ marker. | 01 | :193
D-12-060 | LOCKED | §K | picker/archived-added-without-restore | Archived contacts may be added to a Group Event without restoring them. | 01 | :195
D-12-061 | LOCKED | §K | picker/no-cap | No product-level participant cap. | — | :197
D-12-062 | DERIVED | §K | picker/virtualized | Large sets virtualized/searchable. | 18 | :199
D-12-063 | LOCKED | §L | participant-edit/access | Main surfaces list participants and expose participant-edit access. | — | :202
D-12-064 | LOCKED | §L | participant-edit/fields | Participant editing exposes only overridable fields + participant note. | 11 | :204
D-12-065 | LOCKED | §L | participant-edit/no-title-date | Title and date/time not participant-editable. | — | :206
D-12-066 | LOCKED | §L | participant-edit/follow-event | Explicit `Follow event …` removes overrides. | — | :208
D-12-067 | DERIVED | §L | participant-edit/reuse-controls | Reuse canonical Interaction field controls; not a duplicate Edit Interaction. | 11,13 | :210
D-12-068 | LOCKED | §M | add/before-after-save | Participants may be added before or after initial save. | — | :213
D-12-069 | LOCKED | §M | add/current-defaults | Later-added participant receives the event's current shared values, inherited state. | — | :215
D-12-070 | LOCKED | §M | add/timestamp-event | Child timestamp = event date/time, not add time. | 11 | :217
D-12-071 | DERIVED | §M | add/historical-refresh | Adding to a historical event creates a historically dated child and refreshes consumers. | 11 | :219
D-12-072 | LOCKED | §N | remove/intent-choice | Removing a saved participant asks: Delete interaction / Keep as individual interaction / Cancel. | — | :222-226
D-12-073 | LOCKED | §N | remove/delete | `Delete interaction` permanently deletes the child. | 11 | :228
D-12-074 | LOCKED | §N | remove/keep | `Keep as individual` detaches, preserving a standalone Interaction. | — | :230
D-12-075 | LOCKED | §N | remove/draft | Removing an unsaved participant just removes from draft. | — | :232
D-12-076 | LOCKED | §N | remove/zero-valid | Group Event may remain valid with zero participants. | — | :234
D-12-077 | LOCKED | §O | detach/materialize | Detaching materializes resolved structured values into the standalone Interaction. | — | :237
D-12-078 | LOCKED | §O | detach/note-kept | Participant note remains. | — | :239
D-12-079 | LOCKED | §O | detach/ref-cleared | Group Event reference cleared. | — | :241
D-12-080 | LOCKED | §O | detach/no-group-note | Group Note NOT copied; no `include Group Note` option. | — | :243-245
D-12-081 | LOCKED | §P | convert/existing | An existing ordinary Interaction may be expanded into a Group Event (flow via Interaction Detail overflow). | 11 | :248-256
D-12-082 | LOCKED | §P | convert/keep-uid | Original keeps identity/UID. | 11 | :258
D-12-083 | LOCKED | §P | convert/seed-defaults | Original's values seed shared/default state where appropriate. | — | :260
D-12-084 | LOCKED | §Q | edit-from-child/scope | Editing a group-linked Interaction asks scope: individual / Group Event. | 11 | :263-266
D-12-085 | LOCKED | §Q | edit-from-child/routes | Individual → override editor; Group → Edit Group Event. | 11 | :268-270
D-12-086 | DERIVED | §Q | edit-from-child/no-hybrid | No hybrid editor. | 11 | :272
D-12-087 | LOCKED | §R | surfaces/two | Two canonical surfaces: Group Event Detail (read) and Edit Group Event (focused form). | — | :275-278
D-12-088 | LOCKED | §R | detail/presentation-first | Detail follows presentation-first philosophy like Profile. | 10 | :280
D-12-089 | LOCKED | §R | detail/contents | Detail includes title, date/time, Channel, Tone, Duration, Group Note, participants, Edit Group Event, Add Participant, lifecycle via overflow. | — | :282
D-12-090 | LOCKED | §S | participant-cards | Compact cards/rows: avatar, name, override summary/indicator, overflow. | — | :285
D-12-091 | LOCKED | §S | participant-cards/tap | Tap opens child Interaction Detail. | 11 | :287
D-12-092 | LOCKED | §S | participant-cards/overflow | Overflow: Edit participant record; Remove from group. | — | :289-292
D-12-093 | LOCKED | §S | participant-cards/compact | Rows compact, not stacked mini Detail cards. | — | :294
D-12-094 | LOCKED | §T | browse/page | Dedicated canonical browse/management page. | 05 | :297
D-12-095 | LOCKED | §T | browse/lean | Lean: reverse-chronological list + search by title and participant name. | — | :299
D-12-096 | LOCKED | §T | browse/header-entry | Prominent Dashboard header icon + label entry. | 05 | :301
D-12-097 | LOCKED | §T | browse/overflow-entry | Also in Dashboard overflow. | 05 | :303
D-12-098 | LOCKED | §T | browse/no-tab | No new bottom-nav tab. | 01 | :305
D-12-099 | LOCKED | §T | browse/no-radial | Dashboard tab not a radial launcher. | 01 | :307
D-12-100 | LOCKED | §U | fab/six | FAB expands from five to six actions adding Group Log. | 01 | :310
D-12-101 | LOCKED | §U | fab/distinct | Group Log is a distinct visible intent. | 01 | :312
D-12-102 | DERIVED | §U | fab/phase-1-amend | Phase 1's five-action contract requires targeted amendment. | 01 | :314
D-12-103 | LOCKED | §V | grid/prohibition-superseded | Phase 7's prohibition on detailed multi-contact logging superseded. | 07 | :317
D-12-104 | LOCKED | §V | grid/quick-log-distinct | Grid multi-select retains Quick Log as distinct immediate bulk action. | 07 | :319
D-12-105 | LOCKED | §V | grid/count-routing | 1 selected → individual detailed; 2+ → Group Log preloaded. | 07,13 | :321-323
D-12-106 | LOCKED | §V | grid/no-form-logic | Dashboard does not own Group Log form/business logic. | 07 | :325
D-12-107 | LOCKED | §W | shared-edit/datetime | Editing date/time updates all child timestamps. | 11 | :328
D-12-108 | LOCKED | §W | shared-edit/group-note | Editing Group Note updates one shared note. | — | :330
D-12-109 | LOCKED | §W | shared-edit/inheritable | Editing shared inheritable fields affects only participants still following. | — | :332
D-12-110 | LOCKED | §X | lifecycle/dissolve | Dissolve: remove grouping; keep child Interactions standalone; materialize values; preserve participant notes; don't copy Group Note. | — | :335-340
D-12-111 | LOCKED | §X | lifecycle/delete-all | Delete Group Event & Interactions: permanently delete parent and all children; explicit destructive confirmation. | 11 | :342-345
D-12-112 | LOCKED | §X | lifecycle/no-states | No Favorite/Pin/Archive/Trash states initially. | — | :347
D-12-113 | LOCKED | §X | lifecycle/valid-when-empty | Valid even if all participant Interactions later removed. | — | :349
D-12-114 | LOCKED | §Y | child-delete/only-that | Deleting one child removes only that participant's record; others unaffected; may remain zero-participant; hard-delete semantics; no group trash. | 11 | :352-358
D-12-115 | LOCKED | §Z | undo/no-creation-undo | Complex creation needs no snackbar Undo. | 01 | :361
D-12-116 | LOCKED | §Z | undo/no-field-undo | Ordinary field edits need no Undo. | — | :363
D-12-117 | LOCKED | §Z | undo/participant-local | Participant add/remove may use local Undo where simple. | — | :365
D-12-118 | LOCKED | §Z | undo/confirm-destructive | Dissolve and Delete require explicit confirmation. | — | :367
D-12-119 | LOCKED | §AA | atomic/user-perspective | Multi-child saves/updates atomic from the user's perspective. | — | :370
D-12-120 | DERIVED | §AA | atomic/one-transaction | Create/update/delete fan-out inside one transactional boundary. | — | :372
D-12-121 | DERIVED | §AA | atomic/all-or-nothing | Commit completely or roll back; no partial states exposed. | — | :374
D-12-122 | LOCKED | §AA | atomic/save-fail-keeps-form | If Save fails, form stays open with input intact. | 13 | :376
D-12-123 | LOCKED | §AB | backdated/through-now | Historical entry through now; future not supported. | — | :379-381
D-12-124 | LOCKED | §AC | backup/first-class | Group Events are first-class backed-up entities: identity, title, date/time, shared Channel/Tone/Duration, Group Note, metadata, child→parent references, override/inheritance state, child data. | — | :384-397
D-12-125 | LOCKED | §AC | backup/preserve-relationships | Restore preserves relationships; never flattens. | — | :399
D-12-126 | DERIVED | §AC | backup/validate-graph | Validation rejects structurally invalid graphs before commit where practical. | — | :401
D-12-127 | DERIVED | §AC | backup/orphan-repair | Recovery prefers preserving a valid child as standalone over losing history. | — | :403
D-12-128 | LOCKED | §AD | history/once | Group Event appears once per contact via the child. | 11 | :406
D-12-129 | LOCKED | §AD | history/no-second-record | Parent not a second history record. | 11 | :408
D-12-130 | LOCKED | §AD | history/context | Group-linked Interactions expose context where space exists; restrained badge; Detail may show title/context, Group Note, participant note, View Group Event. | 11 | :410-414
D-12-131 | DERIVED | §AE | a11y/participant-cards | Cards expose identity/override/actions via text; large text increases height; picker accessible; large sets virtualized; inherits shell contracts; no bespoke landscape. | 01,18 | :417-427
D-12-132 | XREF | §AF | xref/→phase-1 | Phase 1: FAB six actions; Group Log route; header Group Events. | 01 | :430-434
D-12-133 | XREF | §AF | xref/→phase-7 | Phase 7: supersede prohibition; Quick Log separate; count routing; no form logic. | 07 | :436-440
D-12-134 | XREF | §AF | xref/→phase-11 | Phase 11: Detail recognizes membership; badge; title/Group Note; scope choice; child delete only; no double-count. | 11 | :442-448
D-12-135 | XREF | §AF | xref/→phase-13 | Shifted Phase 13: Group Log is Phase 12's; ordinary logging doesn't redefine; Channel preference doesn't govern Group Log; In Person default; Tone canonical, null default. | 13 | :450-455
D-12-136 | XREF | §AF | xref/→settings | Settings: Channel-default applies to ordinary single-contact logging; Group Log exempt, In Person. | 15 | :457-459
D-12-137 | XREF | §AF | xref/→backup | Backup: records, links, override state, Group Notes are durable. | — | :461-462
D-12-138 | LOCKED | §AG | boundary/phase-12-owns | Phase 12 owns domain/persistence, zero-participant state, parent/child, inheritance/override, notes relationship, canonical Group Log, participant mgmt, override editing, Detail/Edit, browse/management, conversion, dissolve/delete/detach, atomicity, backup, routing. | — | :465
D-12-139 | LOCKED | §AG | boundary/phase-12-not | Phase 12 does not own Add Contact, ordinary logging redesign, Update Contact, Messaging/AI, Dashboard renderers, Profile layout, Settings IA, analytics, calendar, planned events, Mission Control. | 13,14 | :467
D-12-140 | DEFERRED-FEATURE | Explicitly Deferred | deferred/p12 | Mission Control; Dashboard rename; nav restructure; radial launcher; Group Events tab; advanced filters; pin/favorite/archive; planned events; social calendar; Google Calendar; calendar import; analytics; roles; affected counts; user restore/orphan tools; trash; participant cap; attachments. | — | :470-486
D-12-141 | LOCKED | Success Criteria | sc/1-16 | SC1 persist titled dated event w/ 0+ participants; SC2 one child per participant, no double-count; SC3 live inheritance; SC4 Follow event; SC5 notes distinct; SC6 event-first, historical, add/remove, participant edit; SC7 Detail vs Edit; SC8 cards; SC9 conversion preserves identity; SC10 browse page + header + overflow; SC11 FAB sixth action; SC12 Grid routing; SC13 no partial state; SC14 backup; SC15 Phase 11 integration; SC16 accessibility/large sets. | — | :489-504
D-12-142 | LOCKED | Notes for GSD | note/before-13 | Coherent subsystem before Rapid Capture. | 13 | :507
D-12-143 | LOCKED | Notes for GSD | note/no-many-to-many | Do not replace one-contact-per-Interaction with many-to-many. | — | :508
D-12-144 | LOCKED | Notes for GSD | note/parent-context-object | Parent is an authoring/history context object. | — | :509
D-12-145 | LOCKED | Notes for GSD | note/preserve-consumers | Preserve child compatibility with existing consumers. | 11 | :510
D-12-146 | LOCKED | Notes for GSD | note/persist-override-state | Persist explicit per-field override/inheritance state; equality is not inheritance. | — | :511
D-12-147 | LOCKED | Notes for GSD | note/zero-participants | Do not require participants before capture. | — | :512
D-12-148 | LOCKED | Notes for GSD | note/no-future-concepts | No calendar/planning/Mission Control. | — | :513
D-12-149 | LOCKED | Notes for GSD | note/one-route-picker | One reusable Group Log route + shared picker across FAB, Dashboard, History, future entries. | 01,07,11 | :514

## Phase 13 — Rapid Capture & Update Flows · `phase-13-rapid-capture-update-flows-dossier.md`

Legend :5-9 adds [SUPERSEDES] (replaces an earlier planning decision for the unimplemented milestone); body also uses [INHERITED], [INHERITED / CONFIRMED], [DECIDED / INHERITED FROM PHASE 12].

D-13-001 | LOCKED | Scope | scope | Defines ordinary rapid capture/update workflows; does NOT redefine Group Event persistence, field ownership, inheritance/overrides, lifecycle, Detail/Edit, browsing, atomic persistence, backup (Phase 12). | 12 | :13-36
D-13-002 | LOCKED | §A | capture/least-work | Optimize for the smallest reasonable work while keeping full editing surfaces separate. | — | :42
D-13-003 | LOCKED | §A | capture/four-intents | Four intents: Add Contact; Quick Log; Log Interaction; Update Contact. | 01 | :44-48
D-13-004 | LOCKED | §A | edit-contact/separate | Full Edit Contact remains a separate administrative workflow. | 10 | :50
D-13-005 | DERIVED | §A | capture/no-overloaded-form | Do not collapse the flows into one form. | — | :52
D-13-006 | LOCKED | §B | group/consumes | Phase 13 consumes the Phase 12 Group Log workflow; no second multi-contact form. | 12 | :58
D-13-007 | LOCKED | §B | group/routing-authoritative | 1 selected → ordinary detailed; 2+ → Group Log; Quick Log separate. | 07,12 | :60-63
D-13-008 | LOCKED | §B | group/fab-route | FAB includes distinct Group Log via the Phase 1 amendment. | 01 | :65
D-13-009 | DERIVED | §B | group/shared-controls | Shared controls reused by Group Log remain reusable; Phase 13 doesn't acquire Group semantics ownership. | 12 | :67
D-13-010 | LOCKED | §C | add/name-only | Name is the only field required to create a contact. | — | :73
D-13-011 | LOCKED | §C | add/frequency-optional | Contact Frequency optional during Add Contact. | — | :75
D-13-012 | LOCKED | §C | add/category-optional | Category optional. | — | :77
D-13-013 | LOCKED | §C | add/methods-optional | Phone/email optional. | — | :79
D-13-014 | LOCKED | §C | add/no-photo | Photo/avatar not on the initial basic surface. | — | :81
D-13-015 | DERIVED | §C | add/validation | Validation must not block creation for absent Category/Frequency/methods/remembered info/photo. | — | :83
D-13-016 | LOCKED | §D | add/streamlined | Add Contact more streamlined than Edit; not the whole schema as collapsed drawers. | — | :89
D-13-017 | LOCKED | §D | add/three-sections | Initial surface ~three accordions: Identity (open); Relationship Basics; Contact Methods. | — | :91-95
D-13-018 | LOCKED | §D | add/show-more | Show More reveals enrichment sections. | — | :97
D-13-019 | LOCKED | §D | add/advanced-vocabulary | Revealed sections use Edit Contact vocabulary: Last Talked About; Key People/Relationships; Current Location; Memories; Custom Fields; Off Limits; other compatible sections. | 03 | :99-106
D-13-020 | LOCKED | §D | add/multiple-open | Multiple drawers may remain open. | — | :108
D-13-021 | LOCKED | §D | add/no-auto-spawn | Filling a field doesn't spawn rows/drawers. | — | :110
D-13-022 | DERIVED | §D | add/add-another | Repeated values via explicit `Add another`. | — | :112
D-13-023 | DERIVED | §D | add/shared-editors | Add and Edit reuse canonical field editors/validation composed differently. | — | :114
D-13-024 | LOCKED | §E | edit/complete-form | Edit Contact exposes the complete editable record. | — | :120
D-13-025 | LOCKED | §E | edit/accordions | Top-level accordions with the same vocabulary as expanded Add. | — | :122
D-13-026 | LOCKED | §E | edit/direct-subdomains | Things-to-Remember subdomains are top-level editing sections, not nested (vocabulary: Identity; Relationship Basics; Contact Methods; Last Talked About; Key People/Relationships; Current Location; Memories; Custom Fields; Off Limits). | 03,10 | :124-135
D-13-027 | LOCKED | §E | edit/multiple-open | Multiple sections may remain open. | — | :137
D-13-028 | DERIVED | §E | edit/profile-nesting-independent | Profile may group under Things to Remember; editing IA optimized for discovery. | 10 | :139
D-13-029 | LOCKED | §F | lifecycle/supersedes-bound-default | [SUPERSEDES] Earlier planning that manual creation necessarily defaults to Bound with a required cadence. | — | :145
D-13-030 | LOCKED | §F | lifecycle/no-cadence-unbound | New contact with no Contact Frequency is created Unbound. | — | :147
D-13-031 | LOCKED | §F | lifecycle/cadence-binds | Selecting a Contact Frequency during creation turns Bound ON. | — | :149
D-13-032 | LOCKED | §F | lifecycle/distinct-concepts | Bound/Unbound distinct from Contact Frequency. | — | :151
D-13-033 | LOCKED | §F | lifecycle/dormant-cadence | User may turn Bound OFF while retaining Contact Frequency as dormant cadence. | — | :153
D-13-034 | LOCKED | §F | lifecycle/bind-requires-cadence | Turning Bound ON with no cadence requires selecting a valid Contact Frequency. | — | :155
D-13-035 | DERIVED | §F | lifecycle/not-null-synonym | Do not model Unbound as `interval_days = null`. | — | :157
D-13-036 | DERIVED | §F | lifecycle/reconcile-older-rules | Reconciliation should verify older cadence-null lifecycle rules against this supersession before GSD canonicalization. | — | :159
D-13-037 | LOCKED | §G | add/one-save | One form-level Save. | — | :165
D-13-038 | LOCKED | §G | add/no-save-and-add | No `Save & Add Another` initially. | — | :167
D-13-039 | LOCKED | §G | add/route-to-profile | Success routes to the new Profile. | 01 | :169
D-13-040 | LOCKED | §G | add/save-in-appbar | Save may live in the app bar; no duplicated sticky bottom Save required. | 01 | :171
D-13-041 | DERIVED | §G | add/keyboard-save-reachable | Keyboard-aware layout keeps Save reachable. | 01 | :173
D-13-042 | LOCKED | §H | quicklog/immediate | Quick Log preserves the Phase 1 contract: writes immediately once target known (examples). | 01 | :179-183
D-13-043 | LOCKED | §H | quicklog/now | Quick Log means now; no backdating. | 11 | :185
D-13-044 | LOCKED | §H | quicklog/no-duration | Never asks for duration before writing. | 11 | :187
D-13-045 | LOCKED | §H | quicklog/feedback | Truthful success feedback + Undo per shell. | 01 | :189
D-13-046 | LOCKED | §H | quicklog/failure | Failure never shows success; Retry where recoverable. | 01 | :191
D-13-047 | LOCKED | §I | quicklog/no-presubmit-form | Quick Log doesn't become a pre-submit form for a note. | — | :197
D-13-048 | LOCKED | §I | quicklog/add-note | After the write, snackbar exposes Add Note alongside Undo. | — | :199
D-13-049 | LOCKED | §I | quicklog/post-log-editor | Add Note opens a very small editor tied to the just-created interaction. | — | :201
D-13-050 | LOCKED | §I | quicklog/save-as-note | Text may be saved as an Interaction Note. | — | :203
D-13-051 | LOCKED | §I | quicklog/create-memory-instead | Editor exposes explicit Create Memory Instead. | 03 | :205
D-13-052 | LOCKED | §I | quicklog/no-duplicate | Create Memory Instead makes a Memory and does not duplicate into the note. | — | :207
D-13-053 | LOCKED | §I | note-vs-memory | Interaction Note = context on that interaction; Memory = durable knowledge on the contact. | 03 | :209-211
D-13-054 | LOCKED | §I | quicklog/basic-memory | Quick Memory path stays basic; no redirect to the full editor before save. | — | :213
D-13-055 | LOCKED | §I | quicklog/edit-memory-after | Feedback may offer Edit Memory → full editor. | — | :215
D-13-056 | DERIVED | §I | quicklog/no-drift | No sync problem: one record created from the text, not two. | — | :217
D-13-057 | LOCKED | §J | memory/no-new-taxonomy | Phase 13 invents no new Memory-type taxonomy. | 03 | :223
D-13-058 | DERIVED | §J | memory/inherited-registry | [INHERITED] Phase 3 establishes typed Memories via registry incl. generic/custom, but doesn't enumerate the built-in catalog. | 03 | :225
D-13-059 | LOCKED | §J | memory/default-type | Basic rapid Memory creation uses the registry's designated default/general Memory type. | 03 | :227
D-13-060 | DEFERRED-DECISION | §J | memory/default-type-name | Exact name/identity of the default/general built-in type finalized in reconciliation, not fabricated in Phase 13. | 03 | :229
D-13-061 | DERIVED | §J | memory/registry-metadata | Registry exposes metadata so rapid capture requests the default type without hardcoding a storage type ID. | 03 | :231
D-13-062 | LOCKED | §K | memory/full-editor-in-update | Full Memory creation/editor owned by Update Contact (`Update Contact → Memory → Memory editor`). | — | :237-241
D-13-063 | LOCKED | §K | memory/type-inside-editor | Type selection inside the editor; no pre-chooser page. | — | :243
D-13-064 | LOCKED | §K | memory/richer-metadata | Full editor may expose richer metadata; basic state prioritizes content; less-common metadata behind More Options. | 03 | :245-247
D-13-065 | LOCKED | §K | memory/label-more-options | Label under More Options, not mandatory. | — | :249
D-13-066 | DERIVED | §K | memory/metadata-exposed | Note, meaningful date, URL, pinning, visibility, AI permission via full editor / More Options per registry and privacy rules. | 03,16 | :251
D-13-067 | LOCKED | §L | lta/not-generic | Last Talked About is a distinct history-aware concept, not another Memory type. | 03 | :257
D-13-068 | LOCKED | §L | lta/first-class-action | Update Contact exposes Last Talked About as its own action. | — | :259
D-13-069 | DERIVED | §L | lta/history-model | Consumes the Phase 3 retained-history model. | 03 | :261
D-13-070 | LOCKED | §M | log/canonical-form | Detailed Log Interaction is the canonical ordinary single-contact authoring form. | — | :267
D-13-071 | LOCKED | §M | log/separately-routable | Separately routable from Quick Log. | 01 | :269
D-13-072 | LOCKED | §M | log/launch-sources | May be launched pre-targeted from Profile, List/Card, History backfill, deep links, widgets. | 06,07,11 | :271
D-13-073 | DERIVED | §M | log/one-form | One canonical form with contextual initial values. | — | :273
D-13-074 | LOCKED | §N | log/primary-fields | Primary: Date/time; Channel; Direction; Connected where meaningful; Tone; Note. | 12 | :279-285
D-13-075 | LOCKED | §N | log/datetime-default-now | Date/time defaults now, editable. | — | :287
D-13-076 | LOCKED | §N | log/duration-more-options | Duration under More Options. | 11 | :289
D-13-077 | LOCKED | §N | log/no-invented-fields | More Options grows only with genuine metadata. | — | :291
D-13-078 | LOCKED | §O | channel/supersedes-legacy | [SUPERSEDES] The chooser no longer exposes legacy `Other`, `Unspecified`, or a separate `Email`. | — | :297
D-13-079 | LOCKED | §O | channel/vocabulary | Channel vocabulary exactly: Message; Call; In Person. | 12,14,15,17 | :299-302
D-13-080 | LOCKED | §O | channel/message-absorbs | Message covers text/SMS, chat/DM, email, similar written communication. | 14 | :304
D-13-081 | LOCKED | §O | channel/granularity-later | Additional granularity may come later. | — | :306
D-13-082 | DERIVED | §O | channel/legacy-representable | Existing/imported `unspecified`, `email`, `other` may remain representable internally; no destructive migration for UI cleanliness. | — | :308
D-13-083 | LOCKED | §P | channel-pref/choices | Settings later exposes: Remember Last Choice; Message; Call; In Person. | 15 | :314-318
D-13-084 | LOCKED | §P | channel-pref/factory | Factory default Remember Last Choice. | 15 | :320
D-13-085 | LOCKED | §P | channel-pref/fixed | Fixed Channel initializes new forms to it. | — | :322
D-13-086 | LOCKED | §P | channel-pref/remember | Remember Last Choice initializes from the last successfully saved ordinary interaction Channel. | — | :324
D-13-087 | LOCKED | §P | channel-pref/update-on-save | Remembered value updates only after a successful save. | — | :326
D-13-088 | LOCKED | §P | channel-pref/cancel-no-mutate | Cancel doesn't mutate the remembered value. | — | :328
D-13-089 | DERIVED | §P | channel-pref/first-use-fallback | First-use fallback before any remembered choice: Message preferred unless Settings/Onboarding sets another seed. | 15,17 | :330
D-13-090 | LOCKED | §Q | channel-pref/ordinary-only | [DECIDED / INHERITED FROM PHASE 12] Preference applies only to ordinary single-contact logging. | 12 | :336
D-13-091 | LOCKED | §Q | channel-pref/group-exempt | Group Log ignores the preference and defaults In Person. | 12 | :338
D-13-092 | LOCKED | §Q | channel-pref/export-to-settings | Phase 13 exports this exception to Settings so Settings doesn't imply the default governs Group Log. | 15 | :340
D-13-093 | DERIVED | §Q | channel-pref/settings-copy | Settings copy makes the scope clear. | 15 | :342
D-13-094 | LOCKED | §R | direction/outbound-default | Message and Call default Direction Outbound. | — | :348
D-13-095 | LOCKED | §R | direction/in-person-mutual | In Person defaults Direction Mutual. | — | :350
D-13-096 | LOCKED | §R | direction/manual-change | Users may change Direction where the domain allows. | — | :352
D-13-097 | LOCKED | §R | direction/no-fight | After explicit override the form doesn't fight the choice. | — | :354
D-13-098 | DERIVED | §R | direction/init-not-validation | Channel-sensitive defaulting is initialization, not validation. | — | :356
D-13-099 | LOCKED | §S | connected/toggle | Connected is a simple toggle for Message/Call, default Yes/On. | — | :362
D-13-100 | LOCKED | §S | connected/hidden-in-person | Hidden/not requested for In Person. | — | :364
D-13-101 | DERIVED | §S | connected/data-canonical | Historical/internal connected data remains canonical; UI just avoids the question. | — | :366
D-13-102 | LOCKED | §T | tone/supersedes-quality | [SUPERSEDES] Old `Quality` terminology and `Hard / Fine / Good` replaced. | 11,12,16 | :372
D-13-103 | LOCKED | §T | tone/term | Canonical term Tone. | — | :374
D-13-104 | LOCKED | §T | tone/values | Values: Positive; Neutral; Negative. | — | :376-379
D-13-105 | LOCKED | §T | tone/null-default | Optional, defaults null/unset. | — | :381
D-13-106 | LOCKED | §T | tone/no-neutral-inference | Omitted Tone must not be interpreted as Neutral. | 16 | :383
D-13-107 | LOCKED | §T | tone/exactly-three | Exactly three choices; no user-defined taxonomies. | — | :385
D-13-108 | DERIVED | §T | tone/analytics | Future analytics can distinguish explicit Neutral from missing. | — | :387
D-13-109 | DERIVED | §U | duration/inherited | [INHERITED FROM PHASE 11] Duration optional; human units via presets + Custom; canonical seconds; Quick Log never sets; no effect on metrics. | 11 | :393-401
D-13-110 | LOCKED | §U | duration/more-options | Duration belongs under More Options. | — | :395
D-13-111 | DERIVED | §U | duration/editable-later | Editable via Detail/Edit; survives backup per Phase 11. | 11 | :403
D-13-112 | LOCKED | §V | log/create-memory-instead | Detailed Log Note field may expose Create Memory Instead. | 03 | :409
D-13-113 | LOCKED | §V | log/no-duplicate | Saving as Memory doesn't duplicate into the note. | — | :411
D-13-114 | LOCKED | §V | log/memory-secondary | Memory creation secondary inside detailed logging. | — | :413
D-13-115 | DERIVED | §V | log/route-to-full-editor | Richer editing routes to the full editor in Update Contact. | — | :415
D-13-116 | LOCKED | §W | backdate/free | Date/time defaults now; freely changeable. | — | :421
D-13-117 | LOCKED | §W | backdate/no-warnings | Historical logging without arbitrary old-date warnings. | — | :423
D-13-118 | LOCKED | §W | backdate/trust | Orbit trusts deliberate historical dates. | — | :425
D-13-119 | LOCKED | §W | backdate/history-prefill | History-originated backfill pre-targets and prefills date where unambiguous. | 11 | :427
D-13-120 | LOCKED | §W | backdate/single-day-only | Single-day prefill; multi-day period must not invent a day. | 11 | :429
D-13-121 | LOCKED | §W | backdate/editable-later | Date/time editable later via Edit Interaction for standalone, subject to Phase 11/12 group-linked rules. | 11,12 | :431
D-13-122 | LOCKED | §X | update/fast-workflow | Update Contact is a fast capture workflow for one to a few changes. | — | :437
D-13-123 | LOCKED | §X | update/not-full-form | Doesn't present the full Edit form. | — | :439
D-13-124 | LOCKED | §X | update/edit-remains-admin | Edit Contact remains the complete editor. | — | :441
D-13-125 | LOCKED | §X | update/no-category | Identity/admin changes such as Category remain in Edit Contact. | — | :443
D-13-126 | DERIVED | §X | update/semantic-boundary | Boundary semantic, not table-based. | 03 | :445
D-13-127 | LOCKED | §Y | update/chooser | Opens a compact chooser after the contact is known. | — | :451
D-13-128 | LOCKED | §Y | update/choices | Choices: Last Talked About; Key People/Relationships; Current Location; Memory; Off Limits; Contact Method; Contact Frequency; custom-field access. | 03 | :453-461
D-13-129 | LOCKED | §Y | update/no-category | Category not included. | — | :463
D-13-130 | LOCKED | §Y | update/focused-editor | Selecting an item opens a focused small editor. | — | :465
D-13-131 | DERIVED | §Y | update/registry-driven | Chooser driven by the semantic registry where possible. | 03 | :467
D-13-132 | LOCKED | §Z | update/custom-fields-by-name | Applicable custom fields discoverable by user-facing names directly in the chooser. | 03 | :473-480
D-13-133 | LOCKED | §Z | update/generic-custom-entry | Generic Custom Fields entry remains for new one-off fields, less-prominent fields, promoting/choosing definitions. | 03 | :482-486
D-13-134 | DERIVED | §Z | update/many-fields | Rank/search/group/collapse when many; tuning. | — | :488
D-13-135 | DERIVED | §Z | update/no-duplicate-schema | Name surfacing is presentation over canonical definitions. | — | :490
D-13-136 | LOCKED | §AA | update/stay-in-route | Saving one item doesn't exit; returns to chooser with same contact. | — | :496-498
D-13-137 | LOCKED | §AA | update/repeat | User may update another item, including the same family again. | — | :500
D-13-138 | LOCKED | §AA | update/done | Explicit Done finishes the session. | — | :502
D-13-139 | LOCKED | §AA | update/not-checklist | Subtle success indication OK; not a rigid checklist. | — | :504
D-13-140 | DERIVED | §AA | update/per-item-persist | Individual updates persist as saved; session not one transaction. | — | :506
D-13-141 | LOCKED | §AB | update/frequency | Contact Frequency available as a fast Update action. | 10 | :512
D-13-142 | DERIVED | §AB | update/frequency-reuse | Reuse canonical control/domain; Bound/Unbound follows canonical rules + creation-time behavior. | — | :514-516
D-13-143 | DERIVED | §AC | picker/inherited | [INHERITED FROM PHASE 1] One canonical picker when no target known. | 01 | :522
D-13-144 | LOCKED | §AC | picker/skip-when-known | Known context skips the picker for Quick Log, Log Interaction, Update Contact. | 01 | :524
D-13-145 | LOCKED | §AC | picker/add-untargeted | Add Contact untargeted. | — | :526
D-13-146 | LOCKED | §AC | picker/group-no-prepicker | Group Log not routed through the single-contact pre-picker. | 12 | :528
D-13-147 | DERIVED | §AC | picker/deep-links | Deep links/widgets supply target context directly. | 01 | :530
D-13-148 | LOCKED | §AD | save/one-form-level | Add/Edit use one form-level Save. | — | :536
D-13-149 | LOCKED | §AD | save/name-only-required | Only Name required. | — | :538
D-13-150 | LOCKED | §AD | save/populated-must-validate | Populated optional fields must be valid; malformed not silently dropped (example email/phone). | — | :540-542
D-13-151 | LOCKED | §AD | save/errors-reveal-section | Errors identify and reveal the relevant accordion. | — | :544
D-13-152 | DERIVED | §AD | save/field-errors | Field-level actionable errors; focus/scroll to first. | — | :546
D-13-153 | LOCKED | §AE | save/failure-preserve | Failed saves preserve form state. | 12 | :552
D-13-154 | LOCKED | §AE | save/no-fake-completion | Never dismiss or pretend completion on failure. | — | :554
D-13-155 | DERIVED | §AE | save/retry | Recoverable failures allow Retry; avoid destructive reset. | — | :556-558
D-13-156 | LOCKED | §AF | cancel/inherit | [INHERITED / CONFIRMED] Shell dirty-state protection; unchanged form leaves without confirmation; meaningful edits prompt Discard/Keep editing; no Phase 13 deviation. | 01 | :564-572
D-13-157 | LOCKED | §AG | keyboard/inherit | [INHERITED / CONFIRMED] Nav/FAB hidden during focused workflows/keyboard. | 01 | :578
D-13-158 | LOCKED | §AG | keyboard/reachable | Long forms and small editors keyboard-aware. | 01 | :580
D-13-159 | DERIVED | §AG | keyboard/primitives | Shared primitives; Enter/Next advance sensibly. | 01 | :582-584
D-13-160 | LOCKED | §AH | completion/add | Add Contact success → new Profile. | 01 | :590
D-13-161 | LOCKED | §AH | completion/contact-specific | Contact-specific completion resolves to Profile unless a stronger origin. | 01 | :592
D-13-162 | LOCKED | §AH | completion/origin-aware | Origin-aware completion (History backfill returns to History). | 01,11 | :594
D-13-163 | LOCKED | §AH | completion/update-done | Update Contact Save returns to chooser; Done completes. | — | :596
D-13-164 | DERIVED | §AH | completion/no-replay | Completed workflows removed/replaced in the stack. | 01 | :598
D-13-165 | DERIVED | §AI | routes/inherited | [INHERITED FROM PHASE 1] Fast-entry workflows routable/deep-link-ready; canonical concepts: Add Contact; Quick Log; Log Interaction; Update Contact; Memory authoring; Group Log (Phase 12). | 01,12 | :604-612
D-13-166 | LOCKED | §AI | routes/params | Routes may accept preselected contact/date/context without alternate logic. | — | :614
D-13-167 | DERIVED | §AI | routes/widgets | Widgets dispatch into the same workflows. | — | :616
D-13-168 | LOCKED | §AJ | a11y/inherit | Workflows inherit shell/theme accessibility rather than deferring. | 01,02 | :622
D-13-169 | DERIVED | §AJ | a11y/requirements | Names match labels; accordion state; focus order; error announcement; targets; dynamic text; non-colour selection/error/Tone; keyboard/SR access to More Options, Show More, Create Memory Instead, Done. | — | :624-632
D-13-170 | DERIVED | §AJ | a11y/phase-18 | Final audit Phase 18; Phase 13 ships accessible primitives. | 18 | :634
D-13-171 | XREF | §AK | xref/→phase-1 | Consume six-action FAB + Group Log route; Quick Log immediate; Phase 13 provides form behavior behind Add/Log/Update. | 01 | :640-643
D-13-172 | XREF | §AK | xref/→phase-3 | Preserve semantic distinctions; consume the registry; default Memory type name is reconciliation follow-up. | 03 | :645-648
D-13-173 | XREF | §AK | xref/→phase-10 | Edit Contact remains the complete form; Update Contact separate; Profile grouping doesn't force nested accordions. | 10 | :650-653
D-13-174 | XREF | §AK | xref/→phase-11 | Reuse Detail/Edit Interaction; backdated logging is the backfill path; duration optional/metric-neutral; group-linked edit ownership per Phase 11/12. | 11 | :655-659
D-13-175 | XREF | §AK | xref/→phase-12 | Do not redefine Group Event semantics; Group Log defaults In Person, ignores preference; shared controls reusable. | 12 | :661-664
D-13-176 | XREF | §AK | xref/→phase-15 | Add Default Interaction Channel preference (Remember Last Choice factory; Message; Call; In Person); Settings must state Group Log exempt/In Person. | 15 | :666-673
D-13-177 | XREF | §AK | xref/→phase-17 | Onboarding teaches Message/Call/In Person, not legacy; doesn't imply Channel default changes Group Log. | 17 | :675-678
D-13-178 | XREF | §AK | xref/→phase-18 | Validate accordion density, Show More, large text, keyboard, chooser scaling, error focus, deep-link completion. | 18 | :680-682
D-13-179 | DEFERRED-FEATURE | §AL | deferred/p13 | Memory taxonomy redesign; default type name (DEFERRED-DECISION, see D-13-060); auto extraction; user Tone scales; granular Channel taxonomy; arbitrary metadata; Group semantics (owned); widget design; spacing/timing/thresholds. | 03 | :686-696
D-13-180 | LOCKED | §AM | sc/1-16 | SC1 name-only three-section Add + Show More; SC2 Edit complete direct-access; SC3 Bound/Unbound coordination; SC4 Quick Log immediate/truthful; SC5 Add Note / Create Memory Instead no duplication; SC6 full editor via Update, rapid basic; SC7 Log fields incl. Message/Call/In Person, Direction/Connected, Tone, Note, Duration under More Options; SC8 Tone P/N/N null not Neutral; SC9 Channel preference contract + Group exempt; SC10 backdate freely, edit later; SC11 Update chooser loop, Done; SC12 custom fields by name + generic path; SC13 Category stays in Edit; SC14 focused-workflow contract; SC15 picker/preselection/routes; SC16 consumes Phase 12, recreates nothing. | — | :702-717
D-13-181 | LOCKED | §AN | note/after-12 | Ordinary rapid-capture phase after Group Interaction Logging. | 12 | :723
D-13-182 | LOCKED | §AN | note/atomic-reqs | Convert to atomic user-observable requirements. | — | :724
D-13-183 | LOCKED | §AN | note/no-reopen-12 | Do not reopen Phase 12 ownership. | 12 | :725
D-13-184 | LOCKED | §AN | note/log-contact-naming | Normalize `Log Contact` legacy wording toward Log Interaction where reconciliation determines newer terminology canonical. | 01,06 | :726
D-13-185 | LOCKED | §AN | note/tone-naming | Normalize legacy `Quality/Impact` UI terminology to Tone; preserve null semantics. | 11,16 | :727
D-13-186 | LOCKED | §AN | note/channel-migration | New-entry Channel UX is Message/Call/In Person; compatibility with historical `email`/`other`/`unspecified` is an implementation/migration concern. | — | :728
D-13-187 | LOCKED | §AN | note/add-not-full | Do not turn Add into the full Edit form; Show More boundary is a product requirement. | — | :729
D-13-188 | LOCKED | §AN | note/no-flatten | Do not flatten Contact Knowledge for routing. | 03 | :730
D-13-189 | LOCKED | §AN | note/name-surfacing | Dynamic custom-field surfacing is presentation. | — | :731
D-13-190 | LOCKED | §AN | note/reconcile-bound-memory | Reconciliation should review the older manual-create Bound/cadence rule and the unfinalized default Memory type name before `new-milestone`. | 03 | :732
D-13-191 | LOCKED | §AN | note/export-settings | Export the Channel preference and Group Log exception to Phase 15. | 15 | :733

## Phase 14 — Messaging & AI Compose · `phase-14-messaging-ai-compose-dossier.md`

Legend :5-8.

D-14-001 | LOCKED | Scope | scope | Defines Compose; does NOT define provider/model/key admin, prompt personalization, adjustable generation instructions, provider-specific prompting, central permission admin, Contact Knowledge editing, interaction-form redesign, durable drafts, third-party chat integrations, hardening. | 16,03,13,18 | :12-33
D-14-002 | LOCKED | §A | compose/role | Compose is an AI-assisted drafting workspace with lightweight external delivery handoff, not an in-app messaging client. | — | :39
D-14-003 | LOCKED | §A | compose/no-inbox | No inbox, thread, transport, receipts, or messaging history. | — | :41
D-14-004 | LOCKED | §A | compose/jobs | Jobs: manual writing; recall context; optional AI draft/rewrite; hand off; optional follow-through confirmation. | — | :43-48
D-14-005 | LOCKED | §A | compose/composition-primary | Composition visually/functionally primary; context must not dominate the initial viewport. | — | :50
D-14-006 | DERIVED | §A | compose/refactor | Existing Compose plumbing refactored around this identity; current hierarchy not authoritative. | — | :52
D-14-007 | LOCKED | §B | compose/opens-in-compose | Compose opens in the composition side; hierarchy: header; editor; subject when applicable; mode affordance; AI action when available; Message Focus summary when present; Research entry; Copy; Transmit. | — | :58-69
D-14-008 | LOCKED | §B | compose/editor-reachable | Editor immediately reachable without scrolling past fuel/remembered cards. | — | :71
D-14-009 | LOCKED | §B | compose/opens-blank | Opens blank; no auto greeting/AI prose/context/prompts. | — | :73-79
D-14-010 | DERIVED | §B | compose/manual-independent | Manual composition fully functional regardless of AI. | — | :81
D-14-011 | LOCKED | §C | modes/text-email | Initial modes: Text; Email. | — | :87-90
D-14-012 | LOCKED | §C | modes/no-third-party | Messenger/WhatsApp/Signal/Instagram outside the initial contract. | — | :92
D-14-013 | LOCKED | §C | modes/settings-preference | Settings later owns default mode: Text; Email; Remember Last Choice. | 15 | :94-98
D-14-014 | LOCKED | §C | modes/factory | Factory default Remember Last Choice. | 15 | :100
D-14-015 | LOCKED | §C | modes/silent-init | Compose initializes silently from the preference. | — | :102
D-14-016 | LOCKED | §C | modes/ad-hoc-switch | Ad hoc switch (`Make this an email` / `Make this a text`). | — | :104-107
D-14-017 | LOCKED | §C | modes/remember-on-commit | Remembered mode updates on Transmit or Copy, not on toggle. | — | :109
D-14-018 | DERIVED | §C | modes/runtime-vs-settings | Phase 14 defines runtime behavior; Phase 15 owns the preference UI. | 15 | :111
D-14-019 | LOCKED | §D | destination/text-primary-phone | Text uses the primary phone. | — | :117
D-14-020 | LOCKED | §D | destination/email-primary | Email uses the primary email. | — | :119
D-14-021 | LOCKED | §D | destination/ask-when-no-primary | Multiple viable destinations, no primary → ask the user. | — | :121
D-14-022 | LOCKED | §D | destination/selection-becomes-primary | The deliberate selection becomes the primary of that type. | — | :123
D-14-023 | LOCKED | §D | destination/fallback | Preferred mode unusable but alternate viable → auto fallback. | — | :125
D-14-024 | LOCKED | §D | destination/none | Neither usable → Compose usable for drafting/Copy; Transmit unavailable with explanation. | — | :127
D-14-025 | DERIVED | §D | destination/canonical-model | Consume the canonical contact-method/primary model; no messaging-only store. | — | :129
D-14-026 | LOCKED | §E | email/subject | Email mode exposes Subject + body. | — | :135
D-14-027 | LOCKED | §E | email/handoff-preserves | Handoff preserves recipient, subject, body where supported. | — | :137
D-14-028 | LOCKED | §E | email/copy-body | Main Copy copies the body. | — | :139
D-14-029 | LOCKED | §E | email/subject-copy | Subject gets its own lightweight copy affordance. | — | :141
D-14-030 | LOCKED | §E | email/no-subject-in-body | No forced `Subject: …` in copied body. | — | :143
D-14-031 | LOCKED | §F | transmit/label | Primary handoff action labeled Transmit. | — | :149
D-14-032 | LOCKED | §F | transmit/meaning | Transmit = hand to the external app; not delivery (Text → SMS composer; Email → email composer). | — | :151-157
D-14-033 | LOCKED | §F | transmit/no-sent-claim | Orbit doesn't claim sent because the composer opened. | — | :159
D-14-034 | DERIVED | §F | transmit/supported-apis | Use supported OS/app APIs, not brittle automation. | — | :161
D-14-035 | DEFERRED-FEATURE | §F | deferred/third-party-dm | Direct private-message integrations. | — | :163
D-14-036 | LOCKED | §G | followthrough/compose-attached | Preserve the follow-through concept but change presentation from a janky notification to a compact Compose-attached confirmation after returning from Transmit (`Did you send it?` / Yes, log interaction / Not yet). | — | :169-178
D-14-037 | LOCKED | §G | followthrough/yes-logs | `Yes, log interaction` records the outreach via canonical ordinary Message interaction semantics and completes the workflow. | 13 | :180
D-14-038 | LOCKED | §G | followthrough/not-yet | `Not yet` dismisses and preserves the session. | — | :182
D-14-039 | LOCKED | §G | followthrough/copy-no-prompt | Copy does not trigger the confirmation. | — | :184
D-14-040 | LOCKED | §G | followthrough/open-not-log | Opening the external app alone never creates the interaction. | — | :186
D-14-041 | DERIVED | §G | followthrough/lifecycle-detection | Resume/lifecycle detection is implementation; avoid fragile heuristics. | 18 | :188
D-14-042 | DERIVED | §G | followthrough/canonical-write | Reuse the canonical Interaction write path; no separate messaging-history type. | 11,13 | :190
D-14-043 | LOCKED | §H | copy/first-class | Copy remains first-class beside Transmit; doesn't end the workflow; restrained feedback (`Message copied`, `Subject copied`); no dialog or clipboard history. | — | :196-204
D-14-044 | DERIVED | §H | copy/haptic | Restrained haptic may accompany. | 01 | :206
D-14-045 | LOCKED | §I | session/state-not-records | Drafts are session state, not durable records; may retain body, subject, mode, destination, Message Focus, workflow state. | — | :212-221
D-14-046 | LOCKED | §I | session/survives-in-app | Survives in-app navigation return and temporary backgrounding where practical. | — | :223
D-14-047 | LOCKED | §I | session/no-relaunch | Does not survive fresh relaunch as a saved draft. | — | :225
D-14-048 | LOCKED | §I | session/no-drafts-table | No drafts table or backup contract. | — | :227
D-14-049 | LOCKED | §I | session/completion | Transmit → confirmed → log, clear session, complete to origin/Profile; Not yet → preserve; Copy → preserve. | 01 | :229-233
D-14-050 | LOCKED | §I | session/back | Back/Cancel with no draft leaves; with draft inherits Discard/Keep editing. | 01 | :235-243
D-14-051 | LOCKED | §J | research/replaces-fuel | Old `Conversation Fuel` replaced by a broader Things to Remember research experience. | 03 | :249
D-14-052 | LOCKED | §J | research/not-inline | Does not expand inline; two sibling sides of one workflow (Compose side; Research side). | — | :251-256
D-14-053 | LOCKED | §J | research/compose-default | Compose is the initial side. | — | :258
D-14-054 | LOCKED | §J | research/entry-count | Entry via a Things to Remember affordance with count (`Things to Remember · 14`). | — | :260
D-14-055 | LOCKED | §J | research/same-header | Research retains the contact header. | — | :262
D-14-056 | DERIVED | §J | research/rationale | Prevents context consuming the viewport while one interaction away. | — | :264
D-14-057 | LOCKED | §K | research/projection | Research is a specialized read-only projection of Contact Knowledge, not Profile transplanted. | 03,10 | :270
D-14-058 | LOCKED | §K | research/populated-only | Only populated/useful groups appear. | — | :272
D-14-059 | LOCKED | §K | research/no-prompts-admin | No empty-section prompts, completeness admin, or add/edit/admin actions. | — | :274-276
D-14-060 | LOCKED | §K | research/compact | Compact and scannable; useful content list (pinned, Last Talked About, Key People, Location, Memories, Custom Fields, Off Limits, other relevant). | 03 | :278-288
D-14-061 | LOCKED | §K | research/exclude-metadata | Mundane metadata excluded (phone, email, Contact Frequency, Gravity, Status, Social Battery, operational metadata). | — | :290-299
D-14-062 | DERIVED | §K | research/metadata-driven | Suitability resolves from semantic metadata eventually. | 03 | :301
D-14-063 | LOCKED | §L | ai/optional | AI not mandatory or constantly advertised. | — | :307
D-14-064 | LOCKED | §L | ai/none-no-affordances | If AI provider is set to None, Compose shows no AI affordances. | 16 | :309
D-14-065 | LOCKED | §L | ai/unusable-no-affordances | If the selected provider lacks credentials/configuration and is not usable, likewise no AI affordances. | 16 | :311
D-14-066 | LOCKED | §L | ai/absent-list | When unavailable: no Draft/Rewrite, sparkle nags, disabled cards, Configure CTAs, Add to AI, Message Focus, AI empty-state language. | 16 | :313-321
D-14-067 | LOCKED | §L | research/useful-without-ai | Research remains useful as a human memory aid without AI. | — | :323
D-14-068 | DERIVED | §L | ai/phase-16-owns-state | Phase 16 owns setup/discovery/configuration; Phase 14 consumes a reliable `AI available` capability/state. | 16 | :325
D-14-069 | LOCKED | §M | privacy/phase-3-authoritative | Phase 3 privacy authoritative; only permitted information transmitted. | 03,16 | :331-333
D-14-070 | LOCKED | §M | privacy/no-per-request-review | No per-request review/authorization of the payload. | 16 | :335
D-14-071 | LOCKED | §M | privacy/preauthorized-pool | Context drawn from the preauthorized pool. | 16 | :337
D-14-072 | LOCKED | §M | privacy/manage-elsewhere | Dissatisfaction handled via contact/edit and Phase 16 surfaces, not Compose dialogs. | 16 | :339
D-14-073 | LOCKED | §M | privacy/local-visible | Local Research visibility not restricted by AI permission OFF. | 03 | :341
D-14-074 | LOCKED | §N | offlimits/avoid | Off Limits = topics to avoid. | 03 | :347
D-14-075 | LOCKED | §N | offlimits/visible-avoid-group | Visible to the human in Research (e.g. `Avoid` group). | — | :349
D-14-076 | LOCKED | §N | offlimits/ai-constraint | If AI-authorized, received automatically as an avoidance constraint. | 16 | :351
D-14-077 | LOCKED | §N | offlimits/never-focus | Never selectable as Message Focus. | 16 | :353
D-14-078 | LOCKED | §O | focus/session-steering | Session-only steering toward specific remembered context. | 16 | :359
D-14-079 | LOCKED | §O | focus/add-to-ai | Eligible items expose `Add to AI`; selected reads `Added ✓`; tap again removes. | — | :361-365
D-14-080 | LOCKED | §O | focus/summary | Compose-side summary called Message Focus (`Message focus · 2` + chips); empty not shown. | — | :367-373
D-14-081 | LOCKED | §O | focus/max-three | Up to three items per session. | 16 | :375
D-14-082 | LOCKED | §O | focus/no-weights | No weights/ordering/percentages/prompt controls. | 16 | :377
D-14-083 | LOCKED | §O | focus/not-permission | `Add to AI` is not a permission grant; only AI-authorized items expose it. | 03,16 | :379-381
D-14-084 | LOCKED | §O | focus/ineligible-visible | AI-ineligible items visible without `Add to AI`. | — | :383
D-14-085 | LOCKED | §O | focus/persists-session | Selections persist for the session until removed or session ends. | — | :385
D-14-086 | DERIVED | §O | focus/phase-16-mechanics | Phase 16 owns the prompt mechanics. | 16 | :387
D-14-087 | LOCKED | §P | ai/never-auto | AI never writes automatically on open. | — | :393
D-14-088 | LOCKED | §P | ai/adaptive-action | One adaptive action: empty → Draft with AI; text → Rewrite with AI. | — | :395-399
D-14-089 | LOCKED | §P | ai/draft-no-focus-required | Draft doesn't require Message Focus; uses the preauthorized pool. | 16 | :401-403
D-14-090 | LOCKED | §P | ai/rewrite-preserves | Rewrite preserves the user's core intent. | 16 | :405
D-14-091 | LOCKED | §P | ai/focus-steers | Focus may steer Draft or Rewrite. | — | :407
D-14-092 | LOCKED | §Q | ai/three-suggestions | A normal request returns three suggestions. | 16 | :413
D-14-093 | LOCKED | §Q | ai/three-standard | Three is standard, not a second request. | — | :415
D-14-094 | LOCKED | §Q | ai/varied | Alternatives vary approach/topic/tone where context supports. | 16 | :417
D-14-095 | LOCKED | §Q | ai/no-labels | No generated labels. | — | :419
D-14-096 | DERIVED | §Q | ai/prompt-in-16 | Prompt instructions for variation belong to Phase 16. | 16 | :421
D-14-097 | LOCKED | §R | review/surface | Generation opens one reusable comparison/review surface; empty editor: three + `Choose this`; Rewrite: also shows original. | — | :427-431
D-14-098 | LOCKED | §R | review/comparison-only | Comparison-only, not multi-editor. | — | :433
D-14-099 | LOCKED | §R | review/edit-after-choose | User edits only after choosing and returning. | — | :435
D-14-100 | LOCKED | §R | review/editor-untouched | Editor contents untouched until explicit choice. | — | :437
D-14-101 | LOCKED | §R | review/choose-returns | Choosing returns to Compose with the option loaded. | — | :439
D-14-102 | LOCKED | §R | review/keep-original | Rewrite preserves a path to keep the original. | — | :441
D-14-103 | LOCKED | §S | try-again | Review exposes Try Again: three new suggestions, same context; replaces prior three; no history stack. | — | :447-451
D-14-104 | DEFERRED-DECISION | §S | deferred/adjust→16 | `Adjust` / one-off instructions explicitly owned by Phase 16. | 16 | :453-460
D-14-105 | DEFERRED-DECISION | §S | deferred/personalization→16 | Broader prompt personalization/generation controls. | 16 | :462
D-14-106 | LOCKED | §T | ai/no-destructive-pending | Generation never alters the editor while pending. | — | :468
D-14-107 | LOCKED | §T | ai/cancellable | Cancellable; returns to unchanged state. | — | :470-472
D-14-108 | LOCKED | §T | ai/failure-confined | Failure confined to the AI workflow; never blocks manual composition. | — | :474
D-14-109 | LOCKED | §T | ai/failure-recovery | On failure preserve draft; Try Again / Cancel. | — | :476-479
D-14-110 | LOCKED | §T | ai/no-troubleshooting | Compose is not a provider-troubleshooting surface. | 16 | :481
D-14-111 | DERIVED | §T | ai/details-in-16 | Provider/key/config in Phase 16. | 16 | :483
D-14-112 | DERIVED | §T | ai/skeleton | Skeleton for three pending suggestions is reasonable; tuning. | 18 | :485
D-14-113 | LOCKED | §U | prompting/no-new-system | Phase 14 doesn't construct a new context/prompt system for channel awareness. | 16 | :491
D-14-114 | LOCKED | §U | prompting/mode-real-state | Text/Email remains real Compose state. | — | :493
D-14-115 | DEFERRED-DECISION | §U | deferred/context-construction→16 | Mode incorporation, weighting, provider prompting, context construction → Phase 16. | 16 | :495
D-14-116 | DERIVED | §U | prompting/clean-seam | Preserve a clean seam for Phase 16. | 16 | :497
D-14-117 | DEFERRED-FEATURE | §V | deferred/random-thought | Random Thought inspiration feature; eligibility/weighting/presentation; architecture shouldn't hinder but no speculative persistence. | — | :503-512
D-14-118 | LOCKED | §W | routing/profile-message | Profile's Message action remains a primary entry. | 10 | :518
D-14-119 | LOCKED | §W | routing/deep-link | Compose independently routable/deep-link-ready. | 01 | :520
D-14-120 | LOCKED | §W | routing/consume-context | Consumes known contact context; not another editing workflow. | — | :522
D-14-121 | LOCKED | §W | routing/completion | Confirmed send/log returns origin-aware, normally to Profile. | 01 | :524
D-14-122 | DERIVED | §W | routing/no-stale-history | Completed Compose not resurrected via Back. | 01 | :526
D-14-123 | DERIVED | §X | a11y/keyboard | Inherits focused-workflow behavior; accessible names/focus for editor, Subject, mode, Research, AI, Focus removal, Copy, Transmit; non-colour `Add to AI`/`Added ✓`/Off Limits; review boundaries; reflow; Phase 18 audit. | 01,02,18 | :532-542
D-14-124 | DERIVED | §Y | reuse/not-greenfield | Not greenfield: reuse routing/targeting, SMS/external handoff, clipboard, AI provider abstraction, cancellation/stale safeguards, secure credentials, privacy-bounded context. | — | :548-557
D-14-125 | DERIVED | §Y | reuse/hierarchy-not-authoritative | Existing hierarchy and Conversation Fuel presentation not authoritative. | — | :559
D-14-126 | DERIVED | §Y | arch/separation | Separate editor/session state; Research projection; Focus state; AI-availability capability; generation intent + review; later prompt/provider config; Transmit adapters. | 16 | :561-568
D-14-127 | XREF | §Z | xref/→shell | Focused workflow; canonical Back/Cancel, keyboard, safe-area, deep-link, unsaved; no stale routes. | 01 | :574
D-14-128 | XREF | §Z | xref/→theme | Tokens; editor primary; no oversized card stacks. | 02 | :575
D-14-129 | XREF | §Z | xref/→knowledge | Phase 3 authoritative for TTR semantics, AI permission, structure, Off Limits; local visibility ≠ transmission permission. | 03 | :576
D-14-130 | XREF | §Z | xref/→profile | Profile owns Message entry; Compose not a Profile/admin surface. | 10 | :577
D-14-131 | XREF | §Z | xref/→history-rapid | Confirmed outreach logs through canonical Interaction semantics; no parallel messaging-history model. | 11,13 | :578
D-14-132 | XREF | §Z | xref/→rapid-channel | Canonical Channel remains `Message`; Text/Email doesn't redefine the taxonomy. | 13 | :579
D-14-133 | XREF | §Z | xref/→settings | Settings owns Text/Email/Remember preference UI; factory Remember. | 15 | :580
D-14-134 | XREF | §Z | xref/→ai-config | Phase 16 owns provider/model/key, setup/discovery, permission management, personalization, Adjust, context construction, channel-aware prompting, weighting. | 16 | :581
D-14-135 | XREF | §Z | xref/→onboarding | May explain messaging/AI respecting optional posture. | 17 | :582
D-14-136 | XREF | §Z | xref/→hardening | Device QA, loading tuning, lifecycle reliability, landscape/large text, a11y/perf. | 18 | :583
D-14-137 | DEFERRED-FEATURE | Explicitly Deferred | deferred/p14 | Inbox/thread; delivery receipts; third-party DM integrations; arbitrary adapters; durable drafts; draft backup/sync; AI setup in Compose; per-generation authorization; labels; history stack; Adjust controls (→16); personalization (→16); provider mgmt (→16); exact payloads (→16); Text-vs-Email AI treatment (→16); Focus weighting (→16); Random Thought; loading styling; lifecycle heuristics. | 16 | :587-607
D-14-138 | LOCKED | Success Criteria | sc/1-17 | SC1 clean workspace; SC2 Text/Email w/ Settings default + session override; SC3 destination resolution; SC4 Subject + body; SC5 Transmit truthful; SC6 Did you send it? — only explicit confirmation logs; SC7 session state not durable; SC8 Research side; SC9 AI completely absent when no provider/config/credentials (NB pre-Phase-16 wording); SC10 preauthorized context; SC11 Off Limits avoidance, never Focus; SC12 ≤3 Focus items; SC13 adaptive action; SC14 three alternatives non-destructive; SC15 Try Again; Adjust → 16; SC16 failure never blocks; SC17 compatible with navigation/deep-link/a11y/Phase 16 seam. | — | :613-631
D-14-139 | LOCKED | Notes for GSD | note/refactor-phase | Compose UX/refactor + integration, not a new backend/provider subsystem. | — | :637
D-14-140 | LOCKED | Notes for GSD | note/preserve-plumbing | Preserve proven handoff/AI/privacy plumbing; replace Fuel-first layout. | — | :638
D-14-141 | LOCKED | Notes for GSD | note/no-16-pull | Do not pull provider/model/key or personalization forward. | 16 | :639
D-14-142 | LOCKED | Notes for GSD | note/no-drafts-domain | No durable drafts domain. | — | :640
D-14-143 | LOCKED | Notes for GSD | note/add-to-ai-not-permission | `Add to AI` is temporary emphasis. | 03 | :641
D-14-144 | LOCKED | Notes for GSD | note/no-per-request-auth | No per-request context authorization in the happy path. | 16 | :642
D-14-145 | LOCKED | Notes for GSD | note/research-without-ai | Research useful when AI absent. | — | :643
D-14-146 | LOCKED | Notes for GSD | note/taxonomy-canonical | Text/Email are Compose modes; confirmed outreach logs as `Message`. | 13 | :644
D-14-147 | LOCKED | Notes for GSD | note/tuning | Loading visuals and resume detection are tuning. | 18 | :645
D-14-148 | LOCKED | Notes for GSD | note/seam-16 | Preserve a clean seam into Phase 16. | 16 | :646

## Phase 16 — AI Configuration & Prompting · `phase-16-ai-configuration-prompting-dossier.md`

Legend :5-8.

D-16-001 | LOCKED | Scope | scope | Defines the AI configuration/prompting subsystem; does NOT redefine Compose layout, Text/Email delivery, Contact Knowledge storage, ordinary logging, onboarding, Settings IA, hosted backend, monetization, arbitrary HTTP builder, LAN hosting, Sentry implementation. | 14,03,15,17,18 | :12-41
D-16-002 | LOCKED | §A | ai/optional-layer | AI is an optional capability layer. | — | :47
D-16-003 | LOCKED | §A | ai/one-subsystem | One coherent subsystem supplying `AI available / unavailable / needs attention` to consumers. | 14 | :49
D-16-004 | LOCKED | §A | ai/connection-agnostic | Connection-agnostic above the connection layer (Compose, prompt assembly, privacy, Focus, Adjust, parsing, errors don't care about lane). | 14 | :51-53
D-16-005 | LOCKED | §A | ai/set-and-forget | Provider switching is an occasional Settings action. | 15 | :55
D-16-006 | LOCKED | §B | ai/master-toggle | Real global AI Enabled master toggle. | 14 | :61
D-16-007 | LOCKED | §B | ai/off-preserves | AI OFF: disables generation; Compose removes affordances; preserves connection, credentials/config, models, Writing Style, Personalization Context, permissions. | 14 | :63-70
D-16-008 | LOCKED | §B | ai/on-restores | ON restores immediately when valid. | — | :72
D-16-009 | LOCKED | §B | ai/off-simplified-ui | OFF state visually simplified (Off; explanation; saved config indicator). | 15 | :74-79
D-16-010 | LOCKED | §B | ai/off-escape-hatch | Escape hatch to manage/remove saved connections/credentials remains accessible while OFF. | 15 | :81-83
D-16-011 | DERIVED | §B | ai/off-vs-misconfigured | `AI off` and `AI misconfigured` are distinct states. | 14 | :85
D-16-012 | LOCKED | §C | lanes/three | Three connection lanes. | — | :91
D-16-013 | LOCKED | §C | lane1/byok | Lane 1 Direct Provider / BYOK (Advanced): OpenAI, Anthropic, Gemini; keys in the existing secure credential store, not SQLite/backups. | — | :93-100
D-16-014 | LOCKED | §C | lane2/openrouter-recommended | Lane 2 OpenRouter is the recommended/promoted path (browser-based connection, one connection across providers, unified catalog, price metadata, switching); recommended not mandatory. | — | :102-113
D-16-015 | LOCKED | §C | lane3/custom-advanced | Lane 3 Custom Endpoint remains Advanced: OpenAI-compatible HTTPS endpoint/reverse-proxy contract for endpoints the user controls/trusts. | — | :115-121
D-16-016 | DEFERRED-FEATURE | §C | deferred/arbitrary-http | Arbitrary HTTP API construction. | — | :123
D-16-017 | DEFERRED-FEATURE | §C | deferred/lan | Local/LAN/private endpoints; SSRF safeguards not casually removed. | — | :125
D-16-018 | LOCKED | §D | connection/one-active | Exactly one active connection at a time; no per-call dynamic selection. | — | :131-133
D-16-019 | LOCKED | §D | connection/multiple-stored | Multiple credentials/configurations may remain stored inactive (examples). | — | :135-144
D-16-020 | LOCKED | §D | connection/card-presentation | Selectable card/row presentation with expandable setup/status; hierarchy Recommended (OpenRouter) / Advanced (direct OpenAI/Anthropic/Gemini; Custom). | 15 | :146-158
D-16-021 | DERIVED | §D | connection/radio-like | Mutual exclusivity is radio-like state. | — | :160
D-16-022 | LOCKED | §E | switching/safe | Selecting an unconfigured lane begins setup without replacing the working connection; active only after success; cancel/fail keeps existing. | — | :166-170
D-16-023 | LOCKED | §E | switching/lightweight-valid | Switching to a configured valid connection is lightweight; restores its model. | — | :172-174
D-16-024 | LOCKED | §E | switching/never-deletes | Switching never deletes inactive credentials/config. | — | :176
D-16-025 | LOCKED | §E | removal/separate | Deliberate removal separate (`Disconnect OpenRouter`, `Remove Anthropic key`). | — | :178-183
D-16-026 | LOCKED | §F | readiness/not-just-on | Readiness requires valid active connection + valid model/config. | 14 | :189-191
D-16-027 | LOCKED | §F | readiness/needs-attention | Credential expires/invalid: AI stays ON; config preserved; state Needs attention; no silent activation of another connection. | 14 | :193-197
D-16-028 | LOCKED | §F | readiness/compose-notice | AI ON + Needs Attention → Compose replaces AI actions with a restrained `AI needs attention` notice routing to repair (not disappearing). | 14 | :199-205
D-16-029 | LOCKED | §F | readiness/repair-actions | Repair actions: Reconnect; Replace key; Choose another model; Change AI connection. | — | :207-212
D-16-030 | LOCKED | §G | openrouter/recommended-setup | OpenRouter setup is the recommended consumer path. | 17 | :218
D-16-031 | LOCKED | §G | openrouter/browser-auth | Uses OpenRouter's supported browser authorization/connection flow, not manual key paste. | — | :220
D-16-032 | LOCKED | §G | openrouter/reauth-preserves | Reauthorization replaces credential state while preserving model, prefs, Writing Style, Context, permissions, config. | — | :222-228
D-16-033 | DERIVED | §G | openrouter/credentials-excluded | OpenRouter credentials excluded from backup. | — | :230
D-16-034 | LOCKED | §H | byok/providers | Direct support remains Advanced for OpenAI, Anthropic, Gemini. | — | :236-240
D-16-035 | LOCKED | §H | byok/multiple-stored | Multiple provider credentials stored independently. | — | :242
D-16-036 | LOCKED | §H | byok/one-active | Only one direct provider active; one lane globally. | — | :244
D-16-037 | LOCKED | §H | byok/model-selection | Retains curated/recommended, catalog discovery, manual model-ID escape hatch. | — | :246-249
D-16-038 | DERIVED | §H | byok/preserve-infra | Preserve provider adapters and secure-key infrastructure. | — | :251
D-16-039 | LOCKED | §I | custom/advanced | Custom Endpoint is Advanced, not onboarding. | 17 | :257
D-16-040 | LOCKED | §I | custom/openai-compatible-https | Contract explicitly OpenAI-compatible HTTPS, cleaning up the effective code contract; don't imply arbitrary HTTP works. | — | :259-261
D-16-041 | LOCKED | §I | custom/config | May support base URL, optional credential, model id, discovery where supported. | — | :263-268
D-16-042 | LOCKED | §I | custom/responsibility-language | Language makes clear the user chooses an endpoint they control/trust. | — | :270
D-16-043 | DEFERRED-FEATURE | §I | deferred/custom | Generic HTTP construction; removing private-network protections. | — | :272-274
D-16-044 | LOCKED | §J | model/per-connection-memory | Each saved connection remembers its last selected model (examples). | — | :280-289
D-16-045 | DERIVED | §J | model/identity-separate | Connection identity and model identity modeled separately (OpenRouter: connection provider vs inference provider). | — | :291-296
D-16-046 | LOCKED | §K | picker/orbit-owned | Orbit owns the model-selection UI; OpenRouter is infrastructure. | — | :302
D-16-047 | LOCKED | §K | picker/curated-first | Curated-first, catalog-second; `Browse all models` secondary. | — | :304-308
D-16-048 | LOCKED | §K | picker/bias-economical | Bias toward strong-enough models, not expensive frontier. | — | :310
D-16-049 | LOCKED | §K | picker/initial-recs | Initial recommendation direction: GPT-5.6 Terra (balanced); Gemini Flash (cost); Claude Haiku (lightweight); not permanent. | — | :312-318
D-16-050 | DERIVED | §K | picker/labels-explain | Labels explain reason (Balanced, Cost efficient, Lightweight); mapping updateable. | — | :320-327
D-16-051 | LOCKED | §L | pricing/model-cards | Cards may show name, provider, recommendation, current input/output pricing, More Info. | — | :333-339
D-16-052 | LOCKED | §L | pricing/no-vague | Don't replace real pricing with `$ / $$ / $$$` when metadata available. | — | :341
D-16-053 | LOCKED | §L | pricing/sourced-runtime | Pricing sourced from current/cached OpenRouter metadata, not hardcoded. | — | :343
D-16-054 | DERIVED | §L | pricing/not-requirements | Exact prices are runtime data, never fixed requirements. | — | :345
D-16-055 | LOCKED | §M | catalog/no-minute-freshness | Availability needn't be minute-fresh. | — | :351
D-16-056 | LOCKED | §M | catalog/cache-friendly | Conservative refresh: bundled/cached data; auto refresh ~first AI/model-settings open of a new local day; explicit Refresh Models; retain on failure; `Updated …` indicator. | — | :353-360
D-16-057 | LOCKED | §M | pricing/separate-freshness | Pricing refreshed for selected model when materially stale before an estimate, without full catalog refresh. | — | :362-364
D-16-058 | DERIVED | §M | pricing/ttl-tuning | Price-cache TTL is tuning; no literal hourly requirement. | — | :366
D-16-059 | LOCKED | §M | pricing/no-keystroke-fetch | No OpenRouter hit per personalization keystroke; local estimates recalc, price reused. | — | :368-370
D-16-060 | LOCKED | §N | model/no-silent-substitute | Never silently substitute a model when the selected one disappears. | — | :376
D-16-061 | LOCKED | §N | model/unavailable-guidance | Marked unavailable with explicit guidance (`This model is no longer available…`). | — | :378-381
D-16-062 | LOCKED | §N | model/needs-attention-until | Needs Attention until a usable model is selected. | — | :383
D-16-063 | LOCKED | §N | model/no-fallback | No automatic provider/model fallback during generation (not another model, key, or lane). | — | :385-391
D-16-064 | LOCKED | §O | prompt/orbit-owns | Orbit owns the immutable functional/system prompt; users don't replace it. | — | :397-399
D-16-065 | LOCKED | §O | prompt/layers | Assembly separates: system/output; Writing Style; Personalization Context; permitted contact context; recent Interaction context; Off Limits constraints; Message Focus; temporary Adjust; draft/reference text; output contract. | 14 | :401-412
D-16-066 | LOCKED | §O | prompt/personalization-subordinate | User personalization is subordinate; cannot replace privacy/output/system contract via section text. | — | :414
D-16-067 | DERIVED | §O | prompt/reconcile-legacy | Legacy prompt language (`Conversation Fuel`, pre-Tone) reconciled with newer contracts. | 03,13 | :416
D-16-068 | LOCKED | §P | style/controls | Human-oriented Writing Style controls (Tone Casual/Balanced/Polished; Length; Directness; freeform guidance); labels tunable. | — | :422-430
D-16-069 | LOCKED | §P | style/use-prompt-instead | Structured preferences support a `Use prompt / custom guidance instead` option. | — | :432-434
D-16-070 | LOCKED | §P | style/freeform-intent | Freeform for tone habits, punctuation dislikes, formality, phrasing. | — | :436-441
D-16-071 | LOCKED | §Q | context/arbitrary-sections | Arbitrary user-created global Personalization Context sections: title, body, enabled, order (examples). | — | :447-460
D-16-072 | LOCKED | §Q | context/titles-as-headings | Titles usable as semantic headings. | — | :462
D-16-073 | LOCKED | §Q | context/order-not-weight | Ordering is organizational, not secret weighting. | — | :464
D-16-074 | LOCKED | §Q | context/global | Sections are global; no second per-contact knowledge system in AI Settings; contact knowledge stays in Contact Knowledge. | 03 | :466-470
D-16-075 | LOCKED | §Q | context/may-mention-people | A global doc may mention specific people; sent globally while enabled. | — | :472
D-16-076 | LOCKED | §R | import/paste-preferred | Pasting is the preferred path. | — | :478
D-16-077 | LOCKED | §R | import/txt-md | Supports `.txt` and `.md` import. | — | :480-483
D-16-078 | LOCKED | §R | import/copied | Imported content copied into Orbit's local record; no live link; editable; backed up. | — | :485-492
D-16-079 | LOCKED | §R | import/management | Rename, edit, enable/disable, reorder, delete, replace. | — | :494-500
D-16-080 | DEFERRED-FEATURE | §R | deferred/import | DOCX/PDF; rich text; folders; attachments; version history; live sync. | — | :502-504
D-16-081 | LOCKED | §S | no-training | No writing-sample ingestion/training/style-analysis subsystem. | — | :510-514
D-16-082 | LOCKED | §T | context/enabled-means-sent | Sections need no second AI-permission flag: Enabled = included; Disabled = stored not sent. Distinct from Contact Knowledge's explicit gates. | 03 | :520-528
D-16-083 | LOCKED | §U | context/no-artificial-ceiling | No arbitrary product-level context ceiling; no silent truncation of enabled context. | — | :534-536
D-16-084 | LOCKED | §U | context/model-window-hard | The selected model's context window is the real constraint. | — | :538
D-16-085 | LOCKED | §U | context/overflow-explicit | Overflow disclosed explicitly; requires deliberate resolution (reduce context, change personalization, larger model). | — | :540-544
D-16-086 | LOCKED | §U | context/no-silent-discard | Orbit doesn't silently discard context to fit. | — | :546
D-16-087 | DERIVED | §U | context/deterministic-order | Deterministic section ordering/priority retained. | — | :548
D-16-088 | LOCKED | §V | estimate/tokens | Personalization Context surfaces estimated context size/tokens. | — | :554
D-16-089 | LOCKED | §V | estimate/openrouter-cost | For OpenRouter, estimated input cost per generation using current/cached price (example). | — | :556-565
D-16-090 | LOCKED | §V | estimate/input-only | Only input-cost estimation required. | — | :567-569
D-16-091 | LOCKED | §V | estimate/debounced | Estimates recalc after meaningful changes with debouncing. | — | :571
D-16-092 | LOCKED | §V | estimate/no-price-other-lanes | Direct/Custom needn't show money; `Cost estimate unavailable for this connection.` | — | :573-577
D-16-093 | DERIVED | §V | estimate/no-pricing-db | No separate Orbit provider-pricing database. | — | :579
D-16-094 | LOCKED | §W | permission/means-included | Contact Knowledge AI permission means the information is eligible and included as contact context; no manual re-adding. | 03,14 | :585-587
D-16-095 | LOCKED | §W | permission/privacy-gate | Permission remains the privacy gate; only global + item-permitted info leaves the device. | 03 | :589-591
D-16-096 | LOCKED | §W | permission/semantic-types | Preserve semantic type meaning in prompt construction. | 03 | :593
D-16-097 | LOCKED | §X | focus/meaning | Message Focus = make this permitted info especially important; does not create/alter permission, pin, restrict to Focus only, or copy into draft. | 14 | :599-608
D-16-098 | LOCKED | §X | focus/emphasis | Focused context receives stronger emphasis; other permitted context remains. | 14 | :610
D-16-099 | DERIVED | §X | focus/consumes | Phase 14 UI consumes this weighting contract. | 14 | :612
D-16-100 | LOCKED | §Y | offlimits/negative-constraint | AI-enabled Off Limits receive negative-constraint semantics ("avoid mentioning or steering toward"). | 03,14 | :618-624
D-16-101 | LOCKED | §Y | offlimits/reliable-inclusion | Included reliably, not dropped by relevance ranking. | — | :626
D-16-102 | LOCKED | §Y | offlimits/disabled-not-sent | AI-disabled Off Limits are not transmitted even to enforce avoidance. | 03 | :628
D-16-103 | LOCKED | §Z | recent/three-interactions | Context includes a compact projection of the three most recent Interaction records (date/time, channel, Tone where present, permitted note, group affiliation where available). | 11,12,13 | :634-642
D-16-104 | LOCKED | §Z | recent/bounded-three | Bounded to the latest three. | — | :644
D-16-105 | LOCKED | §Z | recent/note-permission | Interaction-note content is sent only where its AI/privacy permission semantics permit. | 03,11,13 | :646
D-16-106 | DERIVED | §Z | recent/purpose | Prevents tone-deaf/repetitive drafting; not analytics. | — | :648
D-16-107 | LOCKED | §AA | adjust/exists | Compose AI review includes Adjust as a temporary control. | 14 | :654
D-16-108 | LOCKED | §AA | adjust/actions | Quick actions (Shorter, Longer, Warmer, More casual, More direct, similar) + freeform `Tell Orbit what to change...`. | 14 | :656-663
D-16-109 | LOCKED | §AA | adjust/no-persistent-change | Doesn't alter Writing Style or Personalization Context. | — | :665
D-16-110 | LOCKED | §AA | adjust/ephemeral | Ephemeral to the session/generation flow. | 14 | :667
D-16-111 | LOCKED | §AA | adjust/three | Generates three alternatives. | 14 | :669
D-16-112 | LOCKED | §AA | adjust/reference-selected | Selected prior draft may be included as reference. | — | :671
D-16-113 | DEFERRED-FEATURE | §AA | deferred/transformation-history | Persistent branches/trees/iterative prompt programming. | — | :673
D-16-114 | LOCKED | §AB | permission-manager/provided | Phase 16 provides the centralized permission review/manage surface required by Phase 3. | 03 | :679
D-16-115 | LOCKED | §AB | permission-manager/no-matrix | Avoid a giant contact × field matrix. | — | :681
D-16-116 | LOCKED | §AB | permission-manager/defaults | Defaults for new information: type/field defaults per owning Contact Knowledge metadata. | 03 | :685-687
D-16-117 | LOCKED | §AB | permission-manager/default-off | Existing posture remains default OFF. | 03 | :689
D-16-118 | LOCKED | §AB | permission-manager/new-only | Type-level default changes affect new items only; UI says so; may offer `Review existing …`. | 03 | :691-693
D-16-119 | LOCKED | §AB | permission-manager/review | Review existing: contact search, type filter, Enabled-only, drill-in, semantic labels, summary counts (example). | — | :697-707
D-16-120 | LOCKED | §AC | bulk/disable | Bulk disable supported. | — | :713
D-16-121 | LOCKED | §AC | bulk/enable-confirmed | Bulk enable requires explicit impact confirmation. | — | :715
D-16-122 | LOCKED | §AC | bulk/no-enable-everything | No easy `Enable everything` shortcut. | — | :717
D-16-123 | LOCKED | §AC | bulk/no-emergency-disable | No destructive `Disable all AI permissions` beyond the master toggle + bulk disable. | — | :719-723
D-16-124 | LOCKED | §AD | ia/dedicated-destinations | AI area uses dedicated destinations: Connection; Model; Writing Style; Personalization Context; AI Data Permissions; Preview What Orbit Sends. | 15 | :729-737
D-16-125 | DERIVED | §AD | ia/settings-grouping-later | Final grouping lives in Settings consolidation; Phase 16 owns surfaces/behavior. | 15 | :739
D-16-126 | DERIVED | §AD | ia/off-hidden | When OFF, hierarchy mostly hidden; escape hatch remains. | 15 | :741
D-16-127 | LOCKED | §AE | transparency/settings-inspector | Settings exposes Preview What Orbit Sends reviewing the entire prompt system (system instructions, Writing Style, enabled sections, placement rules, output contract, model/connection assumptions). | 15 | :747-756
D-16-128 | LOCKED | §AE | transparency/preview-with-contact | `Preview with contact…` via the canonical picker resolves an actual example prompt incl. permitted context, latest-three, Off Limits. | 01 | :758-760
D-16-129 | LOCKED | §AE | transparency/sectioned | Readable sectioned view; raw view optional. | — | :762-764
D-16-130 | LOCKED | §AE | transparency/no-secrets | Credentials never displayed in the inspector. | — | :766
D-16-131 | LOCKED | §AF | transparency/compose-review | Compose has a separate contact-specific review: `Sharing 17 items with AI about Mom` + items. | 14 | :772-782
D-16-132 | LOCKED | §AF | transparency/compose-contents | Includes permitted TTR items, Message Focus, latest-three, AI-enabled Off Limits, other contact-specific data. | 14 | :784-790
D-16-133 | LOCKED | §AF | transparency/compose-strips-global | Compose review omits global boilerplate (system instructions, Writing Style, Personalization Context, output contract). | 14 | :792-797
D-16-134 | DERIVED | §AF | transparency/two-surfaces | Two surfaces serve different questions; not collapsed. | 14 | :799
D-16-135 | LOCKED | §AG | disclosure/lightweight | First successful AI setup uses a lightweight disclosure, not a mandatory audit of the entire exact prompt (copy given). | — | :805-809
D-16-136 | LOCKED | §AG | disclosure/data-path | Connection-specific disclosure identifies the data path (OpenRouter + underlying; provider; endpoint). | — | :811-814
D-16-137 | LOCKED | §AG | disclosure/on-demand | Full prompt/context review available on demand rather than forced on every first send/setup. | — | :816
D-16-138 | LOCKED | §AH | errors/human-categories | Failures translated to human-readable categories (Connection needs attention; Model unavailable; Rate limited; Insufficient credits; Context too large; Provider unavailable; Custom endpoint error; general). | 14 | :822-830
D-16-139 | LOCKED | §AH | errors/details | Technical info behind `Details`. | — | :832
D-16-140 | LOCKED | §AH | errors/preserve-compose | Failure preserves Compose state (text, Focus, Adjust, mode/destination, session). | 14 | :834-840
D-16-141 | LOCKED | §AH | errors/no-fallback | No silent fallback after failure. | — | :842
D-16-142 | LOCKED | §AI | telemetry/sanitized-event | Failures expose a sanitized structured diagnostic event for a future observability system (Sentry). | 18 | :848
D-16-143 | LOCKED | §AI | telemetry/separate-outputs | User-facing messaging and developer diagnostics are separate outputs. | — | :850
D-16-144 | LOCKED | §AI | telemetry/safe-metadata | Safe metadata list (operation, lane, model id, HTTP status/category, error code, correlation id, build, OS, approx tokens, item count, elapsed, stack trace for app exceptions). | — | :852-864
D-16-145 | LOCKED | §AI | telemetry/never-private | Never transmit: names, phone/email, Memory contents, notes, Group Notes, Off Limits text, Personalization docs, Writing Style text, Focus text, prompt bodies, credentials, raw requests, generated text, raw responses. | — | :866-882
D-16-146 | LOCKED | §AI | telemetry/malformed-structural | Malformed-output diagnostics prefer structural metadata. | — | :884-890
D-16-147 | DERIVED | §AI | telemetry/narrow-helper | Narrow purpose-built diagnostic helper/schema. | — | :892
D-16-148 | DEFERRED-DECISION | §AI | deferred/sentry-install | Full app-wide Sentry installation → release hardening consumes this seam. | 18 | :894
D-16-149 | LOCKED | §AJ | backup/nonsecret-preserved | Backup preserves Writing Style, Personalization sections, order, enabled state, compatible config, Contact Knowledge AI permissions (per Phase 3). | 03 | :900-907
D-16-150 | LOCKED | §AJ | backup/secrets-excluded | Excludes direct keys, OpenRouter credential state, Custom secrets; reconnect after restore. | — | :909-915
D-16-151 | DERIVED | §AJ | backup/no-false-ready | Safe metadata may restore, but AI must not appear Ready without local credentials. | — | :917
D-16-152 | DERIVED | §AK | reconcile/preserve | Preserve compatible infrastructure (secure per-provider storage, adapters, abstraction, discovery/catalog, SSRF safeguards, deterministic prompt resolution, output handling). | — | :923-931
D-16-153 | DERIVED | §AK | reconcile/replace-list | Reconcile/replace: raw prompt-template-as-primary UX; `Conversation Fuel`; old quality vocabulary (→Tone); narrow pre-Contact-Knowledge allowlists; `Provider=None` as the only global disable; connection/provider conflation; Custom wording implying arbitrary HTTP. | 03,13,14 | :933-943
D-16-154 | DERIVED | §AK | reconcile/size-constants | Legacy prompt-size constants are not permanent ceilings. | — | :945
D-16-155 | XREF | §AL | xref/→knowledge | AI globally gated + item-permissioned; default OFF; type defaults new-only; Off Limits avoid-topic. | 03 | :951
D-16-156 | XREF | §AL | xref/→compose | Phase 14 owns Compose/review/Focus UI/three-suggestion consumption; Phase 16 owns setup, prompt construction, Adjust, permissions, availability state. | 14 | :952
D-16-157 | XREF | §AL | xref/→compose-availability | AI Off removes UI; On + Ready exposes; On + Needs Attention shows repair notice. | 14 | :953
D-16-158 | XREF | §AL | xref/→compose-transparency | Compose review contact-specific only; Settings whole-system. | 14 | :954
D-16-159 | XREF | §AL | xref/→settings | Settings routes to canonical AI surfaces. | 15 | :955
D-16-160 | XREF | §AL | xref/→backup | Preserve personalization/privacy config; never credentials. | — | :956
D-16-161 | XREF | §AL | xref/→hardening | Sentry integration consumes the sanitized seam; strict boundary. | 18 | :957
D-16-162 | XREF | §AL | xref/→onboarding | Onboarding may promote OpenRouter and explain data flow; doesn't redefine architecture. | 17 | :958
D-16-163 | DEFERRED-FEATURE | Explicitly Deferred | deferred/p16 | Hosted proxy; shared keys; monetization; Supabase/auth AI; auto fallback; multiple active; per-generation switching; HTTP builder; LAN/local models; Ollama; per-contact AI docs; training; DOCX/PDF; rich text; live files; folders/history; silent truncation; prompt trees; auto classification; non-OpenRouter pricing DB; Sentry; immutable AI audit. | — | :961-984
D-16-164 | LOCKED | Success Criteria | sc/1-22 | SC1 master toggle preserving state + off-state credential mgmt; SC2 one active connection over three lanes; SC3 safe switching, retained inactive; SC4 OpenRouter browser path; SC5 per-connection model memory + Needs Attention; SC6 curated-first + pricing + economical recs; SC7 cache-friendly catalog, fresher pricing; SC8 immutable prompt + Writing Style + sections; SC9 paste/import copied; SC10 no silent truncation; SC11 token/cost estimates; SC12 permission = included; Focus emphasis; Off Limits constraints; SC13 latest three Interactions w/ permitted notes; SC14 Adjust ephemeral three; SC15 permission manager; SC16 split transparency; SC17 lightweight disclosure; SC18 Needs Attention vs Off; SC19 human errors, no fallover, sanitized diagnostics; SC20 no private telemetry; SC21 backup excludes secrets; SC22 reconciled infrastructure. | — | :989-1010
D-16-165 | LOCKED | Notes for GSD | note/subsystem | Substantive subsystem, not a Settings page. | 15 | :1016
D-16-166 | LOCKED | Notes for GSD | note/one-active | Do not collapse lanes into simultaneous providers. | — | :1017
D-16-167 | LOCKED | Notes for GSD | note/inactive-stored | Preserve inactive credentials; switching ≠ deletion. | — | :1018
D-16-168 | LOCKED | Notes for GSD | note/openrouter-not-mandatory | OpenRouter recommended, not mandatory. | — | :1019
D-16-169 | LOCKED | Notes for GSD | note/no-frozen-prices | Do not freeze prices/model IDs. | — | :1020
D-16-170 | LOCKED | Notes for GSD | note/no-silent-substitute | No silent model/provider substitution. | — | :1021
D-16-171 | LOCKED | Notes for GSD | note/no-raw-prompt-ux | Do not reintroduce a raw user-editable system prompt. | — | :1022
D-16-172 | LOCKED | Notes for GSD | note/no-ceiling | No artificial ceiling / silent truncation. | — | :1023
D-16-173 | LOCKED | Notes for GSD | note/global-vs-contact | Global Personalization distinct from Contact Knowledge. | 03 | :1024
D-16-174 | LOCKED | Notes for GSD | note/preserve-phase-3 | Preserve Phase 3 permission model and Off Limits. | 03 | :1025
D-16-175 | LOCKED | Notes for GSD | note/two-surfaces | Keep the two transparency surfaces distinct. | 14 | :1026
D-16-176 | LOCKED | Notes for GSD | note/telemetry-boundary | Telemetry privacy is a hard boundary. | 18 | :1027
D-16-177 | LOCKED | Notes for GSD | note/sentry-later | Sentry wiring belongs to hardening unless convenient earlier. | 18 | :1028
D-16-178 | LOCKED | Notes for GSD | note/settings-routes | Settings consolidates entry points around these surfaces. | 15 | :1029

---

## Ledger totals

| Key | Entries |
|---|---|
| RM | 69 |
| MH | 18 |
| GE | 6 |
| 01 | 76 |
| 02 | 90 |
| 03 | 85 |
| 04 | 96 |
| 05 | 85 |
| 06 | 112 |
| 07 | 132 |
| 08 | 166 |
| 09 | 160 |
| 10 | 218 |
| 11 | 169 |
| 12 | 149 |
| 13 | 191 |
| 14 | 148 |
| 16 | 178 |
| **Total** | **2,148** |
