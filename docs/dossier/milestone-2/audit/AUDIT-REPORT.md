# Milestone-2 Dossier Cross-Audit Report (run 3)

`oa-audit-dossiers milestone-2` · **dry run** (no `--fix`) · generated 2026-09-01 · model: Fable 5.1

Both artifacts in this directory (`LEDGER.md`, `AUDIT-REPORT.md`) are **uncommitted** working-tree files under the gitignored `audit/` path. Nothing in the repo or the dossiers was changed. Lane A ran five read-only verification subagents against the live codebase; every code fact cited in a finding below was re-opened and re-confirmed on disk by the orchestrator before use. Every conflict/risk verdict was made in this single context holding the whole corpus.

---

## Ingested manifest

| Key | File | Resolved version |
|---|---|---|
| RM | `orbit-ui-ux-working-roadmap-v1.0.md` | roadmap (phase map, deferred list, corrections, dependency order) |
| MH | `orbit-ui-ux-master-handoff-v1.0.md` | master handoff (source-of-truth order, watch items) |
| 01 | `phase-01-app-shell-navigation-dossier-amended-group-events.md` | amended (supersedes archived original) |
| 02 | `phase-02-theme-visual-system-dossier.md` | only |
| 03 | `phase-03-contact-knowledge-foundation-dossier.md` | only |
| 04 | `phase-04-dashboard-data-state-foundation-dossier.md` | only |
| 05 | `phase-05-dashboard-control-surface-dossier-amended-group-events.md` | amended |
| 06 | `phase-06-dashboard-list-view-dossier.md` | only |
| 07 | `phase-07-dashboard-card-view-dossier-v0.2.md` | v0.2 |
| 08 | `phase-08-orrery-camera-scale-exploration-dossier.md` | only |
| 09 | `phase-09-orrery-systems-dossier.md` | only |
| 10 | `phase-10-profile-experience-dossier.md` | only |
| 11 | `phase-11-interaction-history-insights-dossier-v0.2-group-events.md` | v0.2 |
| 12 | `phase-12-group-interaction-logging-dossier.md` | only |
| 13 | `phase-13-rapid-capture-update-flows-dossier.md` | only |
| 14 | `phase-14-messaging-ai-compose-dossier.md` | only |
| 16 | `phase-16-ai-configuration-prompting-dossier.md` | only |
| GE | `group-events-restructuring/{additional-cross-phase-amendments-and-watch-items, group-interaction-deferred-concepts, orbit-group-interaction-planning-brief}.md` + the four `*prompt*.md` briefs | read in full; prompts contain no decisions not already in the amended dossiers |
| — | `HANDOFF.md` (repo root) §3, §6, §7, §9–§15 | authority source |
| — | `docs/decisions/ADR-001…074` (INDEX + status skim; ADR-011/016/018/019/025/028/029/030/033/034/035/036/048/049/050/052/062/070/071 read in full) | authority source; all 74 are `Accepted` |

**Deliberately skipped:** `group-events-restructuring/archived-dossiers/*` (pre-amendment originals). **UNAUDITED GAP:** none (no `.docx` in the directory). **Partial corpus:** Phases 15/17/18 are roadmap-deferred with no dossier; this is a valid partial run, re-runnable when they land.

**Prior runs reconciled (Lane C):** `audit/prior-runs/opus-4.8-run2-AUDIT-REPORT.md` (F-01…F-14 + migration meta-note), `audit/prior-runs/run-1-opus-4.8-findings-reconstructed.md` (R1-ESC-1…3, RPL-1, FIX-1/2, orphans, RSK-1). Run-2 LEDGER read as a cross-check only; this run re-extracted from source.

## Counts

| | |
|---|---|
| Ledger entries | **2,148** atomic entries (RM 69 · MH 18 · GE 6 · P01 76 · P02 90 · P03 85 · P04 96 · P05 85 · P06 112 · P07 132 · P08 166 · P09 160 · P10 218 · P11 169 · P12 149 · P13 191 · P14 148 · P16 178) |
| Findings | **36** rated findings + 1 sequencing meta-note |
| — ESCALATE (owner) | **9** |
| — REPLAN | **19** (+ meta-note) |
| — AUTO-FIX (after approval) | **8** |
| — STUB-CONTRACT (informational) | 3 consolidated deferred-phase specs (15 / 17 / 18) |
| Lane A subsystems verified | 5 subagents: custom fields + contact knowledge; interactions/recency/assists; contact lifecycle + dashboard; orrery/theme/settings/profile/navigation; AI config/compose/backup/egress |
| Lane B XREF claims resolved | all 179 `XREF` ledger entries resolved (table in Lane B section) |
| Lane C prior findings | 14 run-2 + 1 meta + 8 run-1 items: 22 re-raised (with fresh cites), 1 resolved, 0 stale, 0 dropped |

## Codebase baseline (Lane A, verified on disk)

- Migration head `TARGET_VERSION = 14` (`src/db/database.ts:49`); files `001`…`014`. Backup `BACKUP_FORMAT_VERSION = 3` (`src/backup/types.ts:14`).
- `contacts` columns (migration 011:16-38): id, uid, name, category_id, interval_days, tracking_enabled, social_battery, birthday, photo, last_contact, favourite_rank, ring_seq, archived_at, snooze_until, rarely_responds, reminders_off, created_at, modified_at. No location, notes, relationship, last-talked-about, gravity.
- `interactions` (011:98-105): occurred_at, recorded_at, channel (no CHECK, default `unspecified`), direction, connected, quality, note, source. **No** duration, tone, group_event_id.
- Knowledge storage = `fuel` (kind ∈ recent/topic/fact/gift/off_limits, `fuel-dao.ts:43`), `custom_field_defs`/`custom_field_values` (UNIQUE(contact_id, field_def_id), 006:41-51), `field_history` (bounded, pruned at 30 days, `field-sweep.ts:126-131`), `contact_links` (URLs), `events` (archive/restore/snooze/unsnooze, `events-dao.ts:39`), `interaction_assists` (014).
- Persisted UI prefs outside SQLite: `orbit-theme` (mode, presetId) and `orbit-dashboard-prefs` (sort, filter) in AsyncStorage; neither in backup.

---

# ESCALATE — owner's call (reverses, weakens, or rests on a false premise about an Accepted ADR / HANDOFF `[DECIDED]` item)

Per CLAUDE.md the authority gate overrides effort. Every item here deletes, weakens, or inverts behavior an Accepted ADR or HANDOFF entry decided. The roadmap's latitude to "revise prior visual/presentation decisions this pass" (D-RM-005) and the handoff's narrower "only when this design milestone intentionally replaces them" (D-MH-002) are exactly what the owner must consciously exercise here; a ChatGPT-authored dossier is not itself ADR ratification. Ratify → superseding ADR + `npm run gen:adr-registry`; decline → amend the dossier.

### E-01 — Favourites: dossiers say binary, ADR-033 (Accepted) decided a drag-reordered rank that the widget consumes
- **kind:** CONFLICT · **effort:** MEDIUM · **blast:** Phases 4, 5, 6, 7 + existing `ManageFavouritesScreen`, favourites widget (ADR-043), capture/sun/merge pickers · **reverses_locked:** YES (ADR-033, reversible; ADR-043 consequence)
- **sides:**
  - D-04-022 "Favorites are binary membership, not a user-visible ranking system" (`phase-04…md:68`); D-04-023/092 legacy `favourite_rank` is not evidence (:70, :306); D-04-040 "no favorite-rank sort" (:137); D-04-088 ranked Favorites deferred (:279); D-06-038/106 (`phase-06…md:134,363`); D-07-033 (`phase-07…md:111`).
  - Phase 5 still lists **Manage Favorites** in Dashboard overflow (D-05-005 :44-50, D-05-055 :270-275) without saying what it does under a binary model.
  - ADR-033 Decision: "marks favourites with a reversible profile star and **orders them by drag on one shared Manage favourites screen**… one reusable order for dashboard and widget configuration"; rejected alternative "Unstar actions in the reorder screen" (`docs/decisions/ADR-033…md:18,25,31`). ADR-043 depends on it.
  - Code (verified): `favourite_rank` is the only favourite column (`001-initial.ts:74`); `ManageFavouritesScreen.tsx:1-12` is reorder-only; favourites branch orders `favourite_rank ASC` (`dashboard-read.ts:244-245`); widget data = `listDashboard({filter:"favourites"})` truncated to 6 by rank (`widget-data.ts:83-86`); capture/sun/merge pickers order by rank (`capture-read.ts:65-66`, `sun-picker-read.ts:45`, `merge-candidate-read.ts:29`).
- **what dies if the dossiers stand:** ADR-033's core decision and ADR-043's ordering source. The widget then needs a new ordering rule no phase defines; Phase 5's "Manage Favorites" needs a new purpose (the only sensible one — a list with unstar — is ADR-033's rejected alternative).
- **owner decision:** (a) keep ADR-033 rank → amend Phase 4 §E/§H, Phase 6 §H, Phase 7 §H to "ranked order is a Manage-favourites/widget concern; Dashboard never sorts by rank"; or (b) ratify binary → superseding ADR-033, decide the widget ordering rule (ADR-043), and define/remove the "Manage Favorites" overflow entry.
- **Lane C:** re-raises R1-ESC-1 (run 2 dropped it).

### E-02 — Never-contacted contacts in Active Contacts reverses ADR-011's segregation (missed by both prior runs)
- **kind:** CONFLICT · **effort:** MEDIUM · **blast:** Phases 4, 5, 6, 7, 8 + `NeverContactedScreen`, `include_unbound_never_contacted` setting, `countLiveContacts`, orrery read · **reverses_locked:** YES (ADR-011, **costly**)
- **sides:**
  - D-04-027 "Never-contacted contacts remain eligible for Active Contacts with a neutral/no-status state" (`phase-04…md:80`); D-04-028 dedicated Not Contacted population (:82); D-06-019/045 `No interactions yet`, neutral border (`phase-06…md:70,161`); D-07-025 (`phase-07…md:81`); D-08-087 built-in Orrery System "Not Contacted" (`phase-08…md:357-364`).
  - ADR-011 Decision: "Never-contacted contacts (`last_contact IS NULL`) are **excluded from normal status/dashboard reads** and belong to a dedicated surface once that UI is introduced" (`ADR-011…md:18`). ADR-018 separately rejected combining archived and never-contacted (unaffected).
  - Code (verified): `BASE_WHERE` requires `last_contact IS NOT NULL` (`dashboard-read.ts:155-158`); never-contacted is a sibling list `listNeverContactedWithPolicy` (`:296-322`) + `NeverContactedScreen.tsx`; header count excludes them (`:383-388`); orrery excludes them (`orrery-read.ts:95-101`).
- **what dies:** ADR-011's dashboard segregation (the never-contacted screen, its Unbound-inclusion setting, and the "live contacts" count semantics). Note the Orrery half: D-08-087's "Not Contacted" System would render never-contacted bodies the orrery read currently excludes — the same reversal in a second surface.
- **owner decision:** ratify the merge (superseding ADR-011; decide the fate of `NeverContactedScreen` and the `include_unbound_never_contacted` toggle) or keep segregation and amend Phase 4 §E (Not Contacted becomes population-only, not part of Active Contacts) and Phase 8 §S.

### E-03 — Removing the Orrery Status/Relationship mode split reverses ADR-048
- **kind:** CONFLICT · **effort:** LARGE · **blast:** Phase 8 (+ `OrreryScreen`, `OrbitBody`, `SegmentedControl`) · **reverses_locked:** YES (ADR-048, reversible)
- **sides:** D-08-005/006 "The existing Status / Relationship mode split is removed… simplify/remove mode-toggle and relationship-mode morph" (`phase-08…md:27-29`), D-08-153 (:699), SC1 (:673). ADR-048 Decision: "opens a status-default orrery and **morphs it on one Skia canvas into a calm relationship view**"; rejected "Relationship view as the default or only view… would otherwise remove the owner's relationship map" (`ADR-048…md:18,22`). Code (verified): `OrreryScreen.tsx:121,178,683-692`; `OrbitBody.tsx:112-120` (angle-only morph; relationship mode = even angular spread + muted colour, not category/gravity rings).
- **owner decision:** confirm removal (superseding ADR-048) or keep the dual view and amend Phase 8 §A.
- **Lane C:** re-raises run-2 F-03 (fresh cites).

### E-04 — Removing the Dashboard birthday banner reverses ADR-034, and the delegated target ("Your Week") has no owning phase
- **kind:** CONFLICT · **effort:** MEDIUM · **blast:** Phases 4, 5 (+ `BirthdayBanner`, `HomeScreen`; Digest/"Your Week" is un-owned this milestone) · **reverses_locked:** YES (ADR-034, reversible)
- **sides:** D-05-013 "Dashboard does not contain a permanent birthday/upcoming module… richer upcoming birthday content belongs to Your Week" (`phase-05…md:122-124`), D-05-082 (:397), D-04-025/082 (`phase-04…md:75,270`). ADR-034 Decision: "The dashboard displays a seven-day, soonest-first birthday banner…"; rejected "No banner or reserve space for a digest" (`ADR-034…md:18,22`). Code (verified): `BirthdayBanner.tsx:40` (`WINDOW_DAYS = 7`), mounted `HomeScreen.tsx:270`; `listBirthdayCandidates` (`dashboard-read.ts:391-399`). **Digest has no birthday read** (grep of `digest-read.ts`/`DigestScreen.tsx` for "birthday" is empty).
- **genuine orphan (Lane B):** "Your Week" appears as an owner in D-04-025, D-04-082, D-05-013, D-05-072 but has **no phase slot** in the roadmap map (D-RM-014) — deferred or otherwise. If the banner goes, the 7-day "reason to reconnect" surface disappears with nothing planned to replace it.
- **owner decision:** ratify removal (superseding ADR-034 **and** assign a phase to add birthdays to Digest/Your Week), or keep the banner and amend Phases 4/5.
- **Lane C:** re-raises run-2 F-04; upgrades the orphan half from "caveat" to a routed finding.

### E-05 — Phase 3/14/16 widen AI egress beyond ADR-050's closed allowlist and ADR-036's surface guardrail; the interaction-note permission gate is un-owned
- **kind:** CONFLICT · **effort:** LARGE · **blast:** Phases 3, 11, 13, 14, 16 + `ai-context-read`, `prompt-template`, `fuel-read` exclusions · **reverses_locked:** YES (ADR-050 **costly**; ADR-036 **costly**)
- **sides:**
  - D-16-100/101 AI-enabled Off Limits are transmitted as avoidance constraints (`phase-16…md:618-626`); D-03-051 (`phase-03…md:125`); D-14-076 (`phase-14…md:351`). D-16-103/105 the three most recent Interactions incl. "permitted Interaction note" and Group context (`phase-16…md:634-646`). D-14-075 Off Limits shown to the human on the Compose Research side (`phase-14…md:349`).
  - ADR-050 Decision: "constructs every AI request from one closed `PromptContext` allowlist… it **never selects interaction or event prose, off-limits fuel**, unconfirmed AI fuel, or unapproved fields" (`ADR-050…md:18`). ADR-036: Compose "renders all rows from the existing eligible ranked-fuel read"; rejected "an editor read or UI-side privacy filter… could expose `off_limits`… on a transmittable surface" (`ADR-036…md:18,23`).
  - Code (verified): off_limits excluded in SQL everywhere (`fuel-read.ts:133-141`); AI context reads only `channel, quality, connected` from interactions — no note (`ai-context-read.ts:114-120`); no per-item AI permission column exists on `fuel` (Lane A C11).
  - **un-owned gate:** D-16-105 says notes are sent "only where its AI/privacy permission semantics permit it", but no phase defines an AI permission on interaction notes — Phase 3's permission model covers knowledge items (D-03-039…046), Phase 11/13 add none. Today all notes are equally un-sent.
- **what dies:** ADR-050's two explicit "never" clauses (off-limits, interaction prose) and ADR-036's off-limits-on-Compose exclusion. Per CLAUDE.md "Any change that widens what that feature transmits is an owner decision."
- **owner decision:** ratify the widened model (superseding ADR-050/036 with the new per-item + per-note gates) **and** name who owns the interaction-note permission (Phase 11 Detail/Edit? Phase 13 Log form? Phase 16 defaults?); or narrow Phase 16 §Y/§Z to keep notes and Off Limits out.

### E-06 — Phase 16 replaces ADR-052's exact-prompt first-send acknowledgement with a lightweight disclosure; Phase 10 removes the Profile AI-draft entry ADR-052 required
- **kind:** CONFLICT · **effort:** SMALL–MEDIUM · **blast:** Phases 10, 14, 16 + `ai-suggestion-logic`, `ContactProfileScreen` · **reverses_locked:** YES (ADR-052, reversible)
- **sides:** D-16-135/137 "First successful AI setup uses a lightweight disclosure, not a mandatory audit of the entire exact prompt… review remains available on demand rather than forced" (`phase-16…md:805-816`). D-10-016 "AI Draft is not restored as a separate Profile action" (`phase-10…md:71`). ADR-052 Decision: "…durable first-send acknowledgement of the exact prompt…"; Context/rejected: "Compose-only invocation — rejected because profile browsing also needs a drafting entry point" (`ADR-052…md:18,22`). Code (verified): exact-prompt gate `ai-suggestion-logic.ts:223-235`; per-provider `ai_ack_*` columns (004); Profile "AI draft" entry `ContactProfileScreen.tsx:1075`.
- **owner decision:** ratify both (superseding ADR-052: generic disclosure + Compose-only entry) or keep the exact-prompt ack and/or the Profile entry.

### E-07 — Phase 1's tab-root shell and Phase 5's relocation of Archived/Unbound/Manage Favourites out of Settings touch ADR-019's and ADR-018's decision text
- **kind:** CONFLICT · **effort:** SMALL · **blast:** Phases 1, 5 (+ `RootNavigator`, `SettingsScreen` rows) · **reverses_locked:** YES (ADR-019 costly; ADR-018 one-way — the *placement* clause only)
- **sides:** D-01-011/012 four permanent bottom tabs each with its own stack (`phase-01…md:107-117`); D-05-058/059 Archived and Unbound become Dashboard child routes in overflow (`phase-05…md:284-288`); D-05-005 Manage Favorites in Dashboard overflow (:44-50). ADR-019 Decision: "uses React Navigation's **native stack as its root navigation shell**… routes low-traffic settings destinations through a dedicated Settings screen"; consequence "Settings becomes the distinct home for Custom Fields and Archived contacts" (`ADR-019…md:18,31`). ADR-018 Decision: "restore and permanent deletion live **only in Settings' Archived contacts list**" (`ADR-018…md`). Code (verified): single `createNativeStackNavigator`, no tab navigator, no bottom-tabs dependency (`RootNavigator.tsx:57,74`; Lane A O11); Settings rows "Manage favourites / Custom Fields / Archived contacts" (`SettingsScreen.tsx:2005-2048`).
- **note:** the archive-before-purge gate itself (ADR-018's one-way substance) is untouched by any dossier; only the *home* of the list moves. Almost certainly a rubber-stamp, but it is a recorded-decision edit.
- **owner decision:** ratify (superseding ADR-019 for the tab root; note in the ADR-018 record that the list's home moved) or keep Archived under Settings.

### E-08 — Phase 7 §AA's bulk-delete decision rests on a false premise: contacts have no 30-day quarantine, and adding auto-purge changes ADR-018's indefinite-archive model
- **kind:** CONFLICT (decision built on contradicted "current behavior") · **effort:** MEDIUM · **blast:** Phase 7 (+ `ArchivedContactsScreen`, `purge-dao`, launch sweeps) · **reverses_locked:** YES (ADR-018 one-way — retention/lifecycle semantics)
- **sides:** D-07-092 "**Current delete behavior sends contacts into a 30-day quarantine** where users can restore them, purge them manually, or allow automatic pruning after the quarantine expires" (`phase-07…md:317`); D-07-093/114/130 confirmation copy must describe it (:319, :385, :429); D-RM-026 restates "bulk delete uses the existing 30-day quarantine" (`roadmap:185`). Code (verified): **no contact quarantine or auto-purge exists** — "Retention is INDEFINITE… there is NO auto-purge sweep" (`ArchivedContactsScreen.tsx:9-11`); purge is archive-gated and manual (`purge-dao.ts:211-219`); the only 30-day quarantine is for custom-field *definitions* (`field-sweep.ts`, HANDOFF §14.5). The Profile has no Delete at all (Lane A L6).
- **why owner:** honoring D-07-092 literally means a new contact lifecycle (quarantine state + launch-time auto-purge) that silently destroys archived contacts after 30 days — a data-loss policy ADR-018 never decided and the current UI copy promises the opposite of. Alternatively "Delete" collapses into "Archive" (already in Phase 7 §T) and the Sensitive Operations entry is really "Archive + purge from Archived list".
- **owner decision:** choose: (a) build the quarantine/auto-purge lifecycle (superseding ADR-018 retention, with the window as an owner-set constant), or (b) amend Phase 7 §AA/§Y so bulk Delete = archive, with purge remaining a deliberate action on the Archived list.

### E-09 — Phase 2/Phase 10 backgrounds behind text-heavy screens supersede HANDOFF §7's `[DECIDED]` starfield placement rule
- **kind:** CONFLICT · **effort:** SMALL · **blast:** Phases 2, 10 · **reverses_locked:** YES (HANDOFF §7 `[DECIDED]`)
- **sides:** D-02-018…024 app-wide preset backgrounds fixed behind scrolling content, opacity by density (`phase-02…md:102-122`); D-10-017 Profile/Hero backgrounds (`phase-10…md:77`). HANDOFF §7: "Starfield background, but **dashboard/orbit screens only, not behind text-heavy screens** where contrast suffers" (`HANDOFF.md:172-174`). (HANDOFF's "tap-to-freeze" and live creeping motion were already superseded by ADR-048 — no new finding.)
- **owner decision:** acknowledge the supersession (a dated supersession note in HANDOFF §7, as §14 already has for custom fields) or constrain Phase 2 §E to presentation screens only. Low stakes; listed because the gate does not distinguish small from large.

---

# REPLAN — needs a targeted planning session (unbuilt schema, sequencing, feasibility, or un-owned seam)

Milestone-2 is a UI/UX layer over a data layer at **migration 14 / backup format 3**. Lane A confirmed that most of the milestone's durable state does not exist yet and that **no dossier sequences or numbers the migrations it implies**. Per the repo's migration-numbering hazard, unsequenced migrations are where silent corruption hides. None of these reverse a recorded decision; all need `plan-phase` to own schema, order, and the single-writer constraints.

### R-01 — The Phase 3 Contact Knowledge model is almost entirely unbuilt (foundation for 4, 10, 13, 14, 16) — new; not in either prior run
- **kind:** CONFLICT (required-but-unbuilt) · **effort:** LARGE · **blast:** Phases 3, 4, 6, 7, 10, 13, 14, 16 + import + backup + share-intent + AI-proposed fuel · **reverses_locked:** no
- **claims vs disk (Lane A C6–C15, verified):** Memory-type registry w/ metadata (D-03-006) → none; generic Custom type + label (D-03-005/007) → fixed 5 kinds (`fuel-dao.ts:43`, ADR-028); optional note / meaningful date (D-03-033/035) → none (only immutable `created_at`); pinning (D-03-030) → none; Profile visibility/hidden (D-03-023/024) → none; outdated/inactive (D-03-027) → none; soft-delete + Recently Deleted (D-03-028/029) → hard `DELETE` + tombstone (`fuel-dao.ts:228-250`); provenance (D-03-037) → `source` string only; Relationships table w/ optional linked contact (D-03-013/014) → **none** (Phase 8's "existing structured relationship model", D-08-104/142, does not exist); Last Talked About history (D-03-009…011) → none; Current Location + history (D-03-019) → none; per-item AI permission default OFF + type defaults (D-03-041/043) → none per item (egress is by `kind`/`source` in SQL; `share_with_ai` exists only per custom-field definition); imported phone notes as a Memory (D-03-062) → the native picker never reads the Note MIME type and the importer writes no note (`OrbitContactPickerModule.kt:92-95,234-246`; `imported-contact-dao.ts:108-187`); search over Memory labels/notes/relationships/custom fields (D-03-025, D-04-050) → name + eligible `fuel.text` only (`dashboard-read.ts:230-240`).
- **also un-owned:** the **Recently Deleted / Trash** surface (D-03-029) has no owning phase (Phase 10 lists "View all", not trash; Phase 15 stub does not mention it) — genuine orphan, assign in planning. Existing features that must migrate onto the new model with no dossier naming them: share-intent capture writes `fuel kind='topic', source='share'` (`capture-dao.ts:43-55`, `CaptureScreen.tsx:276`; ADR-037/038); AI-proposed fuel `source='ai'` confirm flow (ADR-030). Neither Phase 3 nor 14 says what these become.
- **sequencing note:** this is the largest migration cluster in the milestone (new tables for memories/relationships/location history/LTA history + soft-delete/pin/visibility/permission columns + type registry) and it gates Phases 4/10/13/14/16. ADR-028's "fixed kinds" and its rejected "user-named buckets" are **not** reversed by a Custom type with a user label only if the kind set stays application-owned — write that boundary into the Phase 3 plan (trip-wire: user-created system types would reverse ADR-028 → escalate; Phase 3 already defers them, D-03-078).

### R-02 — Group Interaction Logging is entirely unbuilt schema (Phase 12), with three hard write-path constraints
- **kind:** CONFLICT (required-but-unbuilt) · **effort:** LARGE · **blast:** Phases 1, 5, 7, 11, 12, 13, 16 + backup · **reverses_locked:** no
- **sides:** Phase 12 requires a Group Event parent, nullable `group_event_id` on children, per-field override/inheritance state, membership uniqueness (D-12-007/009/022/027). Lane A (verified): no group table, no linkage column in 001–014; `events` is per-contact lifecycle only (`events-dao.ts:39`).
- **constraints for the plan:** (1) every child row must be created/updated/deleted through `insertInteractionCore` / `editTouchpointFull` / `deleteTouchpoint` + `recomputeLastContactCore` (`recency-dao.ts:159-214,258-346`; ADR-010/024/071) inside one transaction — the non-reentrant write mutex means composing cores, not calling top-level writers (ADR-033 risk note); a bulk `INSERT INTO interactions` (as `benchmark.ts:119` does) leaves `last_contact` wrong for every participant. (2) Phase 12 lets archived contacts be participants without restoring them (D-12-060): `insertInteractionCore` has no archived guard (grep of `recency-dao.ts` for `archived_at`/`tracking_enabled` is empty), so the write succeeds — but the archived contact's `last_contact` then advances; decide whether that is intended, since archived contacts are outside every live surface. (3) event-level date edits fan out to N `occurred_at` updates → N recency recomputes (D-12-107); `rejectFutureOccurredAt` applies.
- **Lane C:** re-raises run-2 F-07 (+ its R-01 recency note) with fresh cites.

### R-03 — Tone (Positive/Neutral/Negative) replacing Quality (good/fine/hard), and Message/Call/In Person replacing the six-value channel enum, are data migrations touching a CHECK constraint
- **kind:** CONFLICT · **effort:** MEDIUM–LARGE · **blast:** Phases 11, 12, 13, 14, 16 + `ai-context-read`, `digest-read`, `TimelineRow`, `interaction_assists`, backup · **reverses_locked:** no
- **sides:** D-13-102…107 Tone canonical, null default, omitted ≠ Neutral (`phase-13…md:372-383`); D-12-028/029; D-13-078/079 channel vocabulary exactly Message/Call/In Person (`:297-302`); D-13-082 legacy values may remain representable (:308). Lane A (verified): `quality` nullable TEXT with UI values `good|fine|hard` (`TouchpointRefineForm.tsx:73`), consumed as literals in `ai-context-read.ts:130-134` and `digest-read.ts:158-161`, serialized by backup (`export-manifest.ts:52`); `channel` UI values `call|text|in-person|email|other|unspecified` (`:60-67`) with no CHECK on `interactions`, **but `interaction_assists.channel` has `CHECK(channel IN ('call','text','email'))`** (`014-interaction-assists.ts:12`) and `markAssistLogged` copies that value into `interactions.channel` (`interaction-assist-dao.ts:98-111`). Phase 14's confirmed Transmit must therefore write `Message` (D-14-037) through a table whose CHECK only admits `text`/`email`.
- **why REPLAN:** backfill decision (map good/fine/hard → Tone, or keep both representable per D-13-082), consumer updates, the assist CHECK rebuild (forward-only table rebuild), and the wire-shape bump. The Phase 11 **wording** sync is split out as AF-06.
- **Lane C:** re-raises run-2 F-05 (data half) with the new assist-CHECK fact.

### R-04 — Optional interaction `duration` column is unbuilt (Phases 11, 12, 13)
- **kind:** CONFLICT (required-but-unbuilt) · **effort:** MEDIUM · **blast:** Phases 11, 12, 13 + backup · **reverses_locked:** no
- **sides:** D-11-132…139 (`phase-11…md:733-770`), D-12-018/024, D-13-076/109. Lane A (verified): no duration column (011:98-105); not in backup (`export-manifest.ts:52`). Nullable seconds + reads + Detail/Edit + Group override state + backup.
- **Lane C:** re-raises run-2 F-08.

### R-05 — Orrery Systems persistence, density preset, satellites toggle and last-active System are unbuilt (Phases 8, 9)
- **kind:** CONFLICT (required-but-unbuilt) · **effort:** LARGE · **blast:** Phases 8, 9 + backup · **reverses_locked:** no
- **sides:** D-09-006/011/132 persisted definitions/rules/inclusions/exclusions/order/visibility/last-active (`phase-09…md:45,62,539-550`); D-08-034 density persists (`phase-08…md:152`); D-08-100/101 satellites toggle (:409-416). Lane A (verified): orrery persistence is only `sun_contact_id`, `self_sun_colour` (`003-orrery-settings.ts:38-48`) + `contacts.ring_seq`; no systems/density/satellite/camera state anywhere (O2, O5). Camera state is intentionally ephemeral (D-08-064) — no schema. Reduced-motion infrastructure does not exist at all (O14) — Phases 2/8/9/11 all assume it; put it in the Phase 2 plan.
- **Lane C:** re-raises run-2 F-09.

### R-06 — Profile layout/background templates, assignments, per-contact overrides, and expanded/collapsed persistence are unbuilt (Phase 10)
- **kind:** CONFLICT (required-but-unbuilt) · **effort:** LARGE · **blast:** Phase 10 + backup + Category deletion fallout (Phase 15 stub) · **reverses_locked:** no
- **sides:** D-10-019/023/038/041/051/064/068 (`phase-10…md:81-89,146-184,241-254`). Lane A (verified): no template/layout/assignment/collapsed schema; the single-row `profile` table is the self record (O9). Custom snooze end date (D-10-110) needs no schema (`snooze_until` is a date) — UI + DAO only.
- **Lane C:** re-raises run-2 F-10.

### R-07 — AI master toggle, three-lane multi-connection model, OpenRouter (provider + browser auth + pricing), Personalization Context, Writing Style, and permission defaults are unbuilt (Phase 16)
- **kind:** CONFLICT (required-but-unbuilt) · **effort:** LARGE · **blast:** Phase 16 (+ Phase 14 availability state) + SecureStore + backup + `ai-types` closed union · **reverses_locked:** no (E-05/E-06 cover the reversals)
- **sides:** D-16-006 (master toggle), D-16-018/019/044 (one active, many stored, per-connection model), D-16-014/031 (OpenRouter browser auth), D-16-051/053/089 (pricing), D-16-068/071 (Writing Style, sections), D-16-116 (defaults). Lane A (verified): no `ai_enabled` column — `provider='none'` is the sole disable (`ai-types.ts:23-28`; `AiService.ts:599-602`); one SecureStore item per fixed provider, no bulk accessor (`ai-key-store.ts:27-32`); single `ai_provider/ai_model/ai_custom_*` columns (004); zero hits for openrouter/WebBrowser/AuthSession in `src/`, `package.json`; catalog reads no pricing fields (`model-catalog-filter.ts:19,70-78`). Adding OpenRouter as a fixed provider touches the closed `AiProviderId` union, a new `ai_ack_<id>` column + the exhaustive `never` switch in `acknowledgeProvider`, `PROVIDER_NAMES`, `token-budget`, `CatalogProvider` (Lane A A3). OpenRouter also adds a new egress host and a browser-OAuth path — a security-posture item already decided in the dossier (D-16-014); ADR-049's "keys only in SecureStore" is honored by D-16-013/033.
- **Lane C:** re-raises run-2 F-11.

### R-08 — Custom fields: URL/Email/Phone types, history-retained values, groups, per-contact one-off definitions, and promotion are unbuilt (Phase 3, consumed by 10, 13)
- **kind:** CONFLICT (required-but-unbuilt) · **effort:** MEDIUM–LARGE · **blast:** Phases 3, 10, 13 + backup · **reverses_locked:** no — **with an ESCALATE trip-wire**
- **sides:** D-03-054…058 (`phase-03…md:132-140`). Lane A (verified): `FieldType` has 7 members, no URL/Email/Phone (`src/schemas/types.ts:20-27`; `field-parsers.ts:44-91`, ADR-014 "exactly seven parsers" — additive → ten, still one-per-type); `custom_field_values UNIQUE(contact_id, field_def_id)` (006:41-51) — one current row per pair; `field_history` is `contact_id, field_col_name, old_value, operation, created_at`, written only on destructive ops, pruned at 30 days, no reader, excluded from backup (`001:155-163`; `field-sweep.ts:126-131`; `export-manifest.ts:13`) — it cannot host a value timeline; no group column, no per-contact scope column, no promotion logic (`001:127-142`).
- **trip-wire:** history-retained custom fields need a **new additive** value-history table. Any plan that relaxes `UNIQUE(contact_id, field_def_id)` reverses ADR-001 → ESCALATE. Per-contact one-off definitions change ADR-013/HANDOFF §14's "one global definition row per field, seeded for every contact" (`field-ddl.ts:79-91`, `contacts-dao.ts:196-207`) — a scope column is additive, but the seeding writers must change.
- **Lane C:** re-raises run-2 F-12 and run-1 R1-ESC-2 (re-rated REPLAN + trip-wire, as run 1's reconstruction itself suggested).

### R-09 — Backup/Restore must serialize every new milestone-2 entity, and no phase owns the wire-shape bump (genuine orphan)
- **kind:** CONFLICT (required-but-unbuilt + un-owned) · **effort:** LARGE · **blast:** Phases 2, 3, 4, 9, 10, 11, 12, 16 · **reverses_locked:** no
- **sides:** eight dossiers assert "Backup/Restore preserves X" (D-03-064, D-09-132, D-10 via managers, D-11-155, D-12-124, D-16-149, D-GE-003; D-07-063 sends import there too). Lane A (verified): format 3 serializes the entity set at `export-manifest.ts:45-81`; none of duration, group events, systems, templates, personalization, memories/relationships/location are present; theme and dashboard prefs live in AsyncStorage and are not portable (A10). **Lane B:** "Backup/Restore" is a bottom-nav tab (D-01-014) but no milestone-2 phase owns changing its format — every dossier delegates to it and none is it. Assign the bump to a phase (last consuming phase, or a small dedicated phase) and sequence it after all schema lands. Phase 12's validation/orphan-repair rules (D-12-126/127) and Phase 16's "never falsely Ready after restore" (D-16-151) belong in that plan.
- **Lane C:** re-raises run-2 F-13, upgraded with the un-owned-phase fact.

### R-10 — "Reasonable typo tolerance" and knowledge-wide semantic search vs ADR-031/032's deliberate LIKE-only, no-FTS5 model
- **kind:** RISK (feasibility + latent authority) · **effort:** MEDIUM · **blast:** Phases 3, 4 · **reverses_locked:** no *unless implemented via FTS5*
- **sides:** D-04-052…059 (`phase-04…md:174-196`). Lane A (verified): exact substring `LIKE ? ESCAPE '\'` over `contacts.name` + eligible `fuel.text`, ordered by the active sort, never relevance (`dashboard-read.ts:230-240`); ADR-031 rejected FTS5. Define "typo tolerance" concretely and choose a non-FTS5 approach, or escalate an FTS5 reversal. Depends on R-01 for the searchable corpus.
- **Lane C:** re-raises run-2 F-14.

### R-11 — Phase 4 removes Unbound contacts from Dashboard search, but search is the only name-lookup path for Unbound today
- **kind:** RISK · **effort:** SMALL · **blast:** Phases 1, 4, 5 · **reverses_locked:** no (ADR-062 retrieval stays possible via the Unbound screen)
- **sides:** D-04-047 "Dashboard search never surfaces Unbound contacts" (`phase-04…md:154`). Lane A (verified): the search branch is archived-only and **does** return Unbound as neutral rows today (`dashboard-read.ts:230-240`; `dashboard-search-row-logic.ts:20-24`) — the ADR-062 "retrieval row" consequence. `UnboundContactsScreen.tsx` has no search (grep empty); Phase 1's picker mentions Archived and Snoozed markers but not Unbound (D-01-037/039). Plan: give the Unbound child route its own search or add Unbound to the picker's explicit-search path, so ADR-062's "retrieval… stay[s] available" holds.

### R-12 — Phase 11's lifecycle-event families include Bind/Unbind events that do not exist
- **kind:** CONFLICT (required-but-unbuilt) · **effort:** SMALL · **blast:** Phase 11 (+ `events-dao`, `contact-lifecycle-dao`) · **reverses_locked:** no
- **sides:** D-11-115 lists Archive, Restore, Snooze, Unsnooze, Bind, Unbind "where present" (`phase-11…md:619-628`). Lane A (verified): `EventType = "archive" | "restore" | "snooze" | "unsnooze"` (`events-dao.ts:39`); snooze/unsnooze have producers in `snooze-dao.ts:103-110,136-143`; bind/unbind have neither type nor producer (`contact-lifecycle-dao.ts:62-98` writes no event). Additive: new event types + insert-only producers inside the existing bind/unbind transactions (ADR-025).

### R-13 — Phase 13's streamlined Add Contact is silent on ADR-016's "normal create defaults last-spoke to today" — ESCALATE trip-wire
- **kind:** RISK · **effort:** SMALL · **blast:** Phase 13 (+ `CreateContactScreen`, `create-contact-logic`) · **reverses_locked:** not yet — depends on the plan
- **sides:** D-13-010…019 name-only Add Contact with Identity / Relationship Basics / Contact Methods (`phase-13…md:73-106`) never mentions the last-spoke/first-interaction choice. ADR-016 Decision (**costly**): "A normal create defaults last-spoke to today; 'Not yet' creates no interaction and leaves the contact genuinely never-contacted" (`ADR-016…md:18`). Code (verified): form default `{ kind: "today" }` (`CreateContactScreen.tsx:102`); `firstInteractionOccurredAt` today/date/not-yet (`create-contact-logic.ts:76-88`); DAO writes the first interaction via the recency cores (`contacts-dao.ts:188-196`). Phase 13's Bound/Unbound supersession (D-13-029…035) is **compatible** with ADR-062 (verified: `tracking_enabled` column, dormant cadence preserved, `contacts_prevent_cadence_clear` trigger — Lane A L2).
- **plan rule:** keep the tri-state last-spoke control in Relationship Basics (default today, "Not yet" available) unless the owner explicitly reverses ADR-016. Dropping it silently would be the reversal.
- **Lane C:** re-raises run-1 R1-ESC-3, re-rated from ESCALATE to REPLAN-with-trip-wire (the dossier does not flip the default; it omits it).

### R-14 — Phase 14's Compose-attached "Did you send it?" must coexist with ADR-070/071's durable assist lifecycle and app-global banner
- **kind:** RISK · **effort:** MEDIUM · **blast:** Phase 14 (+ `AssistBanner`, `PendingConfirmationsSheet`, `handoff.ts`, `interaction-assist-dao`) · **reverses_locked:** not if additive — **ESCALATE trip-wire**
- **sides:** D-14-036 changes the presentation "from a janky notification into a compact Compose-attached confirmation" with Yes, log interaction / Not yet (`phase-14…md:169-182`); D-14-047 session state does not survive relaunch (:225). ADR-070 Decision: durable `interaction_assists` row written **before** launch; `pending → logged | dismissed | expired | failed`; cap 5; 15 s eligibility; 24 h expiry; launch sweep; "off means off" (`ADR-070…md:18`). ADR-071: confirmation writes one outbound interaction stamped `handoff_at` via the recency cores; Text/Email offer **Yes / Don't log** (`ADR-071…md:18`). Code (verified): it is already an in-app banner, not a notification (`AssistBanner.tsx:14-22`, mounted app-wide `App.tsx:323`); Don't log → `markAssistDismissed`; email handoff via `mailto:` exists (`handoff.ts:50-66`); the Compose Send path already creates the assist (`ComposeScreen.tsx:451-458`).
- **plan rules:** (1) the Compose-attached prompt is an *additional* surface; the app-global banner/sheet must stay for assists whose Compose session is gone (process death, 24 h window). (2) "Not yet" ≠ "Don't log": keep a dismissal path or rows linger until expiry. (3) The write stays `markAssistLogged` at `handoff_at` (Phase 14 D-14-042 agrees). Removing the banner or the dismissal, or stamping at confirmation time, reverses ADR-070/071 → ESCALATE. Also note ADR-035/036 still say Send/Copy "never write to SQLite" — already superseded in practice by ADR-072's assist row (Lane A A7); a superseding note is overdue but is not this milestone's doing.

### R-15 — Cycles heatmap and cadence-relative Intensity are undefined for contacts with no cadence
- **kind:** RISK · **effort:** SMALL · **blast:** Phases 10, 11 · **reverses_locked:** no
- **sides:** D-11-053/054 each block = one *current* Contact Frequency cycle (`phase-11…md:275-281`); D-10-100 Intensity interval from Contact Frequency (`phase-10…md:391`). Profiles of Unbound / never-assigned-cadence contacts are reachable (D-04-085, D-05-059). Lane A (verified): `computeContactIntensity` returns `{available:false}` for Unbound (`impact.ts:139`); `interval_days` is nullable (011:22-23); ADR-062 "every cadence consumer must guard nullable cadence". Define the Cycles/Intensity fallback (hide lens, or fall back to 7 Days/Month) in the Phase 11 plan.
- **Lane C:** re-raises run-1 R1-RSK-1 (run 2 dropped it).

### R-16 — Persisted preferences: nine new durable settings across seven phases, no storage decision, no migration numbers
- **kind:** CONFLICT (sequencing) · **effort:** MEDIUM · **blast:** Phases 2, 4, 6, 8, 9, 11, 13, 14, 16 · **reverses_locked:** no
- **inventory (dossier → today):** theme package + per-package accent/background memory (D-02-014/015 → AsyncStorage `orbit-theme` holds `mode`,`presetId` only; one preset `space-dark`, no light palette — `theme-presets.ts:18`, `theme-types.ts:161`); Dashboard population multi-select + List/Card + Default-vs-explicit sort (D-04-065 → AsyncStorage `orbit-dashboard-prefs` holds single `sort`,`filter`); right-swipe logging preference (D-06-062); orrery density + satellites + last-active System (D-08-034/101, D-09-006); History lens + cycle preset (D-11-051/058); ordinary Channel preference + remembered last channel (D-13-083…089); Compose mode preference + remembered (D-14-013/017); AI Enabled + permission type-defaults (D-16-006/116). Decide per item: AsyncStorage (device-local, not portable) vs `app_settings` column (portable via `PORTABLE_SETTINGS_KEYS`, `backup-schema.ts:106-113`), and number the migrations.

### R-17 — Status glyphs, semantic icon registry, and reduced-motion support have no existing foundation (Phase 2 must build them before 6/7/8/9/11 consume them)
- **kind:** CONFLICT (required-but-unbuilt) · **effort:** MEDIUM · **blast:** Phases 2, 6, 7, 8, 9, 10, 11 · **reverses_locked:** no
- **sides:** D-02-049/050/053 distinct status silhouettes + icon registry; D-06-043, D-07-027/028 consume them; D-02-033, D-08-122, D-09-117, D-11-144 reduced motion. Lane A (verified): status is colour + border weight only, no glyphs (`contact-card-ring.ts:44-61`; O7); no icon registry; zero `isReduceMotionEnabled`/`useReducedMotion` usage (O14). Sequence: Phase 2 delivers registry + glyph set + a reduced-motion hook before the renderer phases.

### R-18 — Bottom-tab shell and origin-aware Back are unbuilt; existing reset-to-Home flows must be reconciled, not just replaced
- **kind:** CONFLICT (required-but-unbuilt) · **effort:** MEDIUM · **blast:** Phase 1 (+ every screen using `navigation.reset`) · **reverses_locked:** see E-07
- **sides:** D-01-011…021. Lane A (verified): single native stack, no tab navigator (`RootNavigator.tsx:57,74`); Profile Back is plain `goBack()` (`ContactProfileScreen.tsx:762`) so it already pops to whatever pushed it; forced Dashboard-rooting exists in Compose Back (`ComposeScreen.tsx:266-268`), notification taps (`notification-nav.ts`), widget deep links (`widget-linking.ts:55-57`, ADR-044) — these match D-01-019/022 (external entry → Dashboard fallback) and must survive the tab refactor. Predictive back is disabled (`app.config.ts:76`).

### R-19 — Phase 5's amended overflow and Phase 7's multi-select assume bulk mutations that do not exist
- **kind:** CONFLICT (required-but-unbuilt) · **effort:** MEDIUM · **blast:** Phases 5, 7 (+ lifecycle DAOs, ADR-025 event fan-out) · **reverses_locked:** no
- **sides:** D-07-076…090 bulk Quick Log / favourites / snooze / category / archive / frequency. Lane A (verified): no bulk mutation exists for any of these (L12); archive writes an immutable lifecycle event per contact inside its transaction (`contacts-dao.ts:527-545`) — bulk archive must compose N of those; bulk Quick Log must compose the recency cores (see R-02).

### Meta — migration sequencing/numbering is un-owned
Milestone-2 implies **at least nine** forward-only migrations starting at **015**: Contact Knowledge model (R-01); Group Events (R-02); Tone/Channel data migration incl. the `interaction_assists` CHECK rebuild (R-03); duration (R-04); Orrery Systems + orrery prefs (R-05); Profile templates/assignments/overrides (R-06); AI toggle/connections/personalization/permission defaults (R-07); custom-field types/history/groups/scope (R-08); lifecycle bind/unbind events (R-12); plus preference columns (R-16) and **one** backup wire-shape bump to format 4 after all of them (R-09). **No dossier orders or numbers any of these.** The roadmapper must assign a strict schema → consumers → backup order and real numbers; every plan must verify head+1 against `src/db/migrations/` on disk (this repo's numbers drift every schema phase).

---

# AUTO-FIX — align a dossier to a decision already recorded elsewhere (proposed; applied only after approval + `--fix`)

None originates a decision; each propagates an already-settled supersession into stale text. No ADR/HANDOFF/`[DECIDED]` reversal is involved. Each is one atomic commit.

### AF-01 — Phase 14 AI-availability wording contradicts Phase 16's three-state model
- **effort:** MEDIUM · **blast:** Phase 14 · **sides:** D-14-064/065/066 + SC9 "If AI provider is set to None… not actually usable… no AI affordances" (`phase-14…md:309-321,622`) vs D-16-028 (`phase-16…md:199-205`), D-RM-060 (`roadmap:344`), D-16-157.
- **proposed edit:** in Phase 14 §L and SC9 replace the binary wording with: **AI Off → no AI affordances; AI On + Ready → AI actions; AI On + Needs Attention → restrained `AI needs attention` repair notice** (cross-reference Phase 16 §F). Keep "manual Compose/Research fully usable regardless".
- **Lane C:** re-raises run-2 F-01.

### AF-02 — Phase 5 §M says the overflow bulk entry "supports the existing/current import"
- **effort:** SMALL · **blast:** Phase 5 · **sides:** D-05-057 (`phase-05…md:279-281`), D-05-073 (:362) vs D-07-062/063/126 (`phase-07…md:204-206,425`), D-RM-035/036 (`roadmap:317-318`).
- **proposed edit:** Phase 5 §M: the entry enters Phase 7 Grid multi-select ("Select Contacts"); delete the "supports the existing/current import" clause (import belongs to Backup/Restore per Phase 7 §O); §R "Import/Bulk Management" line likewise.
- **Lane C:** re-raises run-2 F-02 / run-1 FIX-1.

### AF-03 — Phase 1 body still says "five actions" despite its own six-action amendment
- **effort:** SMALL · **blast:** Phase 1 · **sides:** D-01-031 (§F :215-222), D-01-062 (:401), D-01-072 SC4 (:437) vs D-01-002/010 (:21-32, :89-99).
- **proposed edit:** update §F, the §Cross-Phase "action workflows" line, and SC4 to the six-action set (Add Contact, Quick Log, Log Contact, Group Log, Update Contact, Memory), per the amendment's own Supersession Map.
- **Lane C:** re-raises run-2 F-06.

### AF-04 — Phase 11 v0.2 still calls Rapid Capture "Phase 12" in three places
- **effort:** SMALL · **blast:** Phase 11 · **sides:** D-11-128 "Phase 12 Rapid Capture may reuse this canonical route" (`phase-11…md:705`); D-11-143 "Phase 12 owns the final detailed logging form/business UX" (:787); D-11-165 "Phase 12 can reuse it" (:910) vs the post-insert numbering (D-RM-019, D-GE-006 roadmap warning, D-13-181). In v0.2 "Phase 12" otherwise means Group Interaction Logging, which does **not** own the ordinary detailed logging form — the stale references are now factually wrong, not just misnumbered.
- **proposed edit:** replace "Phase 12" with "Phase 13 (Rapid Capture & Update Flows)" at :705, :787, :910.

### AF-05 — Phase 10 GSD notes use pre-insert numbering for Rapid Capture and Messaging
- **effort:** SMALL · **blast:** Phase 10 · **sides:** D-10-209 "Phase 12's forms/business workflows" (`phase-10…md:878`), D-10-210 "Phase 13's Message/AI Compose" (:879) vs D-RM-014.
- **proposed edit:** :878 → "Phase 13's", :879 → "Phase 14's".

### AF-06 — Phase 11 still says "quality/impact" where the canonical field is Tone
- **effort:** SMALL · **blast:** Phase 11 · **sides:** D-11-108 (:579), D-11-121 (:670), D-11-124 (:695) vs D-13-102/103/185 (`phase-13…md:372-374,727`), D-RM-052, D-MH-010.
- **proposed edit:** replace "quality/impact" with "Tone" at those three lines (text sync only; the data migration is R-03).
- **Lane C:** the wording half of run-2 F-05.

### AF-07 — Roadmap §6 Phase 1 restatement still lists five FAB actions
- **effort:** SMALL · **blast:** roadmap · **sides:** D-RM-020 (`roadmap:142`) vs D-RM-051 (:333), D-MH-006 (`master-handoff:73`), D-01-002.
- **proposed edit:** add Group Log to the §6 Phase 1 bullet at :142.

### AF-08 — Phase 4/5 "Explicitly Deferred" still lists a compact Card/Grid renderer that Phase 7 v0.2 now *is*
- **effort:** SMALL · **blast:** Phases 4, 5 · **sides:** D-04-008 (`phase-04…md:31`), D-04-088 (:278), D-05-075 (`phase-05…md:372`) vs D-07-011/013 and D-RM-015 ("settled product is a compact 3-column avatar-first grid despite the historical working name", `roadmap:15`).
- **proposed edit:** annotate those three lines: "superseded — Card View is the compact 3-column grid per Phase 7 v0.2 / roadmap v1.0; no separate compact renderer is deferred".

---

# STUB-CONTRACT — spec for the intentionally-deferred phases (informational; feeds GSD stub creation, not owner decisions or fixes)

These dependencies point at phases with reserved-but-deferred roadmap slots (15/17/18, D-RM-014). They are not orphans. Collected so each stub has a checklist.

### Deferred Phase 15 — Settings & Personalization must expose
- **Appearance:** Theme package (Galaxy/Standard), Mode (Light/Dark/Follow System), Accent (curated), Background (bundled presets + None/Solid), live preview, per-package memory. [D-02-010/014/015/016/080, D-RM-064]
- **Dashboard List right-swipe** Quick Log vs Log Contact (global; default Quick Log). [D-06-062/065/098]
- **Ordinary logging Default Interaction Channel** (Remember Last Choice factory / Message / Call / In Person; remembered updates only after successful ordinary save) **with copy stating Group Log is exempt and defaults In Person.** [D-13-083…093, D-12-136, D-GE-002, D-RM-053/054, D-MH-011]
- **Compose default message mode** (Text / Email / Remember Last Choice factory; remembered on Copy/Transmit). [D-14-013/014/017/133, D-RM-059]
- **Contacts Administration / Category CRUD** incl. deletion fallout to generated Orrery Systems, custom-System rules (with the warning D-09-041 requires), and Profile layout/background Category assignments; no reconciliation wizard. [D-RM-039/040, D-08-131/146, D-09-037…041/045/134…136/143, D-10-175/200]
- **Local owner-profile settings.** [D-RM-006/064]
- **Routes into canonical surfaces, not reimplementations:** Systems Management (D-09-086/143), Profile layout/background managers (D-10-172/173), AI management hierarchy incl. the AI-Off escape hatch (D-16-009/010/124…126/159, D-RM-065, D-MH-014).
- **Existing rows to reconcile:** today's Settings hosts "Manage favourites / Custom Fields / Archived contacts" (`SettingsScreen.tsx:2005-2048`) and "Include unbound in Not yet contacted" (:911-947) — their fate depends on E-01, E-02, E-07.
- **Possible owner:** the Memory "Recently Deleted/Trash" surface (D-03-029) — currently un-owned (R-01).

### Deferred Phase 17 — Onboarding must honor
- First-launch appearance default Galaxy + Follow System; may offer an early appearance choice. [D-02-004/081]
- Early right-swipe logging preference choice + Dashboard gesture/star education. [D-06-064/072/073/099]
- Teach the final Message / Call / In Person vocabulary, never legacy Text/Email/Other; do not imply the Channel default governs Group Log. [D-13-177]
- May promote OpenRouter as the recommended connection and explain data flow; does not redefine the architecture; respects AI's optional posture. [D-16-030/162, D-14-135]
- May introduce Profile customization/backgrounds without redefining them. [D-10-202]
- Preserve first-run/default/permission/gesture seams generally. [D-RM-066, D-MH-015]

### Deferred Phase 18 — Responsive & Release Hardening must audit
- Landscape/tablet + large-text reflow on every surface; List/Grid density fallbacks; Relationship Overview packing; yearly heatmap rendering; wheel density/neighbor count; large-System performance (culling/LOD, HUD responsiveness); gesture QA and device-GPU behavior; image-memory behavior for Profile backgrounds. [D-01-070/076, D-02-031/065/082, D-06-101, D-07-016/017/103, D-08-149, D-09-111/131/145, D-10-186/203, D-11-092/098/156, D-12-131, D-13-178]
- External-app resume/lifecycle heuristics for "Did you send it?"; AI loading presentation. [D-14-041/112/136]
- Wire the sanitized AI diagnostic seam into Sentry preserving the no-private-content boundary. [D-16-142…148/161/177]
- Reduced-motion QA across Orrery/History/Theme once R-17's hook exists.

---

# Lane B — exhaustive cross-phase resolution

Every `XREF` ledger entry (179) and every `assumes` target was resolved against the target phase's own ledger. Result classes: **✓ resolved** (target phase owns and builds it), **STUB** (target is a deferred phase → STUB-CONTRACT above), **ORPHAN** (no phase slot anywhere), **MISMATCH** (target defines it differently → finding).

| Source → target | Claim | Result |
|---|---|---|
| 01 → 02, 13, 12, 03, 18 | theme tokens; forms/business rules; Group Log domain; Memory terminology; landscape later | ✓ (D-02-068…072; D-13-003/171; D-12-138; D-03-005…008; D-RM-050) |
| 01 → picker archived-after-action | unresolved in Phase 1 | ✓ decided by Phase 12 (D-12-060: archived participants stay archived) |
| 02 → 15, 17, 18, 08 | Appearance settings; default; QA; Orrery exception | STUB 15/17/18; ✓ 08 (D-08-003/140) |
| 03 → 04, 10, 13, 14, 16 | search via model; TTR surface; Update Contact; AI opt-in/Off Limits; central manager | ✓ (D-04-049…051; D-10-118…162; D-13-128…133; D-14-069…077; D-16-114…123) — **all UNBUILT, see R-01** |
| 03 → Import, Backup, Sync | imported notes as Memory; full-fidelity backup; sync state | ORPHAN-ish: import picker lacks Note MIME (R-01); backup bump un-owned (R-09); Sync out of milestone (D-RM-006) ✓ |
| 03 → Recently Deleted/Trash | restore surface | **ORPHAN** (R-01) |
| 04 → 05, 06, 07, 03, 08 | axes; shared model; predicates | ✓ |
| 04 → Your Week | richer birthday presentation | **ORPHAN** (E-04) |
| 04 → 15 (via 06) | swipe preference | STUB |
| 05 → 04, 06, 07, 02, 01, 12 | semantics; renderers; tokens; shell; Group Events page | ✓ (D-12-094…097) |
| 05 → Your Week | richer birthday content | **ORPHAN** (E-04) |
| 05 → Import/Bulk | "existing import and bulk capabilities" | **MISMATCH** → AF-02 (Phase 7 §O disowns import; no bulk exists, R-19) |
| 06 → 04, 05, 07, 02, 01, 03, 13, 08, 18 | as listed | ✓ |
| 06 → 15, 17 | swipe preference; gesture education | STUB |
| 07 → 04, 05, 06, 12, 03, 01, 13, 14, 02 | as listed | ✓ |
| 07 → Backup/Restore (import), lifecycle (30-day quarantine), Gravity | import home; quarantine; derived | import ✓ conceptually but bump un-owned (R-09); **MISMATCH** quarantine (E-08); Gravity ✓ (`impact.ts`, no writer) |
| 08 → 02, 01, 03, 04, 07, 10, 09, 18 | as listed | ✓ except **03 relationships do not exist yet** (R-01; satellites depend on Phase 3 building them first — Phase 3 precedes 8 in D-RM-062 ✓ sequencing) |
| 08 → 15 | Category CRUD | STUB |
| 09 → 08, 04, 07, 03, 01, 02, 18 | as listed | ✓ |
| 09 → 15, Backup | Category admin; System state | STUB; R-09 |
| 10 → 01, 02, 03, 04, 08, 09, 11, 13, 14, 16, 17, 18 | as listed | ✓ (11 owns History internals: D-11-149; 13 owns forms: D-13-004/173; 14 owns Message: D-14-118/130; 16 owns AI review: D-16-114) |
| 10 → 15 | managers linked; Category CRUD | STUB |
| 11 → 10, 03, 01, 02, 04, 08, 13, 18 | as listed | ✓ — but 11's three text refs to "Phase 12" meaning Rapid Capture are **MISMATCH** → AF-04 |
| 11 → Backup, Analytics/Your Week | duration; future reuse | R-09; deferred ✓ (D-11-083) |
| 12 → 01, 07, 11, 13, 15, Backup | amendments; Settings exception; durable backup | ✓ 01 (D-01-002…008), 07 (D-07-002…008), 11 (D-11-002…031), 13 (D-13-006…009/090…093); STUB 15; R-09 |
| 13 → 01, 03, 10, 11, 12 | as listed | ✓ (Memory default-type name → owner reconciliation item; ADR-016 last-spoke → R-13) |
| 13 → 15, 17, 18 | Channel preference; vocabulary teaching; validation | STUB |
| 14 → 01, 02, 03, 10, 11/13, 16 | as listed | ✓ — but 14's AI-availability wording is **MISMATCH** with 16 → AF-01 |
| 14 → 15, 17, 18 | mode preference; explanation; QA | STUB |
| 16 → 03, 14, Backup, 15, 17, 18 | permission model; Compose contracts; backup; Settings routing; onboarding; Sentry | ✓ 03 (with E-05 widening); ✓ 14; R-09; STUB 15/17/18 |
| RM/MH → all | restatements | ✓ except RM §6 Phase 1 five actions (AF-07) and Phase 4/5 "compact grid deferred" (AF-08) |

**Orphan sweep result:** three genuine orphans — **Your Week** enhancement (E-04), **Recently Deleted/Trash** for Memories (R-01), and the **Backup/Restore format bump** (R-09). One un-owned gate: **interaction-note AI permission** (E-05). Everything else resolves to an owning phase or a deferred-phase stub.

---

# Lane A — verdict summary per claim family (facts re-confirmed on disk by the orchestrator)

| Family | Verdict | Where used |
|---|---|---|
| Custom field types (9 claimed) | CONTRADICTED — 7, no URL/Email/Phone | R-08 |
| History-retained custom fields | UNBUILT; UNIQUE forbids in-place | R-08 |
| Custom field groups / per-contact defs / promotion | UNBUILT | R-08 |
| Memory registry, custom type, pin, visibility, soft-delete, provenance, date | UNBUILT (fuel: 5 fixed kinds) | R-01 |
| Relationships table / linked contact | UNBUILT | R-01 (and Phase 8 satellites) |
| Last Talked About / Current Location history | UNBUILT | R-01 |
| Per-item AI permission, type defaults | CONTRADICTED — none per item; by kind/source in SQL | R-01, E-05 |
| Imported notes as Memory | UNBUILT — picker never reads notes | R-01 |
| Dashboard search corpus | name + eligible fuel.text only | R-01, R-10 |
| Interactions: duration / group_event_id / tone | UNBUILT | R-02, R-03, R-04 |
| quality / channel vocabularies + consumers | CONFIRMED legacy values; assist CHECK | R-03 |
| Single recency writer + direct inserts | CONFIRMED; benchmark + restore are the only direct inserts | R-02 |
| Edit / delete writers | CONFIRMED (`editTouchpointFull`, hard delete) | Phase 11 ✓ |
| Lifecycle events | archive/restore/snooze/unsnooze; no bind/unbind | R-12 |
| Assist lifecycle + banner | CONFIRMED in-app banner; Yes / No answer / Don't log | R-14 |
| Contact create defaults | CONFIRMED last-spoke today; Bound default; cadence required only when Bound | R-13 |
| Bound/Unbound + dormant cadence + one-way trigger | CONFIRMED (ADR-062) | Phase 13 §F ✓ |
| Never-contacted segregation | CONFIRMED (ADR-011) — dossiers reverse | E-02 |
| Unbound in search | CONFIRMED present as neutral rows — dossiers remove | R-11 |
| Favourites ranked + reorder screen + widget rank | CONFIRMED — dossiers say binary | E-01 |
| Snooze presets only | CONFIRMED (3d/1w/1m) | Phase 10 §T ✓ (UI only) |
| Contact delete quarantine | CONTRADICTED — indefinite archive, manual purge | E-08 |
| Birthday banner 7-day; Digest has no birthdays | CONFIRMED | E-04 |
| Dashboard prefs persistence | AsyncStorage sort+filter only | R-16 |
| Categories table, no CRUD | CONFIRMED | STUB 15 |
| Bulk mutations | UNBUILT | R-19 |
| Orrery mode split + morph | CONFIRMED (ADR-048) | E-03 |
| Orrery persistence / systems / density / camera / reduced motion | only sun columns; rest UNBUILT | R-05, R-17 |
| Ring reorder gesture | plain pan ≥10 px (Phase 8 changes to prolonged hold — tuning ✓) | — |
| Theme package / accent / backgrounds | UNBUILT; one dark preset | R-16, R-17 |
| Status glyphs / icon registry | UNBUILT (colour + border weight) | R-17 |
| Profile templates / overrides / collapsed state | UNBUILT | R-06 |
| Navigation root / tabs / origin-aware back | stack-only; `goBack()` already origin-relative | E-07, R-18 |
| AI toggle / lanes / OpenRouter / pricing / personalization | UNBUILT; provider=none only disable | R-07 |
| Prompt template + truncation | user "style note" inside a fixed prompt; truncation disclosed only on first ack | R-07 (D-16-083 vs `prompt-template.ts:36-42`) |
| AI context contents | name, category, ranked fuel, aggregates; no notes, no off_limits | E-05 |
| Egress guards | ADR-051 confirmed; no host allowlist structure; closed provider union | R-07 |
| Compose layout / modes / handoff | fuel-first; SMS only; email via profile router | Phase 14 ✓ (refactor scope) |
| Suggestions per request / review / exact ack | 1; replace-confirm only; exact-prompt ack | E-06, Phase 14 ✓ |
| Backup entities / portable settings / secrets / versioning / encryption | CONFIRMED format 3; theme/dashboard prefs not portable | R-09, R-16 |
| Android backup opt-out; share intent text-only; no telemetry dep; no read-path network | CONFIRMED | — |

---

# Lane C — reconciled from prior runs

Every prior finding is re-raised with fresh cites, resolved with evidence, or marked stale. None dropped.

| Prior | Outcome | This run |
|---|---|---|
| run-2 F-01 (Phase 14 AI wording) | **re-raised** (fresh cites) | AF-01 |
| run-2 F-02 (Phase 5 import clause) | **re-raised** | AF-02 |
| run-2 F-03 (ADR-048 mode split) | **re-raised** — code still live (`OrreryScreen.tsx:121,178,683-692`) | E-03 |
| run-2 F-04 (ADR-034 banner) | **re-raised**, orphan half upgraded to a routed finding | E-04 |
| run-2 F-05 (Tone data migration + Phase 11 wording) | **re-raised**, split: data → R-03 (+ new `interaction_assists` CHECK fact); wording → AF-06 | R-03, AF-06 |
| run-2 F-06 (Phase 1 five-action) | **re-raised** | AF-03 |
| run-2 F-07 (Group events unbuilt + recency note) | **re-raised** (+ archived-participant and fan-out constraints) | R-02 |
| run-2 F-08 (duration) | **re-raised** | R-04 |
| run-2 F-09 (Systems persistence) | **re-raised** (+ reduced-motion absence) | R-05, R-17 |
| run-2 F-10 (Profile templates) | **re-raised** | R-06 |
| run-2 F-11 (AI personalization/connections) | **re-raised** (+ closed union edit points) | R-07 |
| run-2 F-12 (custom field types) | **re-raised**, merged with R1-ESC-2 | R-08 |
| run-2 F-13 (backup) | **re-raised**, un-owned-phase fact added | R-09 |
| run-2 F-14 (typo tolerance) | **re-raised** | R-10 |
| run-2 Meta (≥7 migrations) | **re-raised**, count raised to ≥9 + prefs + bump | Meta |
| run-1 R1-ESC-1 (ADR-033 favourites) | **re-raised** — `ManageFavouritesScreen` and rank consumers verified live; run 2's silent drop corrected | E-01 |
| run-1 R1-ESC-2 (history-retained custom fields vs UNIQUE) | **re-raised** as REPLAN + ESCALATE trip-wire (per run 1's own re-rating) | R-08 |
| run-1 R1-ESC-3 (ADR-016 last-spoke default) | **re-raised**, re-rated: the dossier is silent, not contradictory → REPLAN with trip-wire; the Bound/cadence half is **RESOLVED** (compatible with ADR-062, verified `contact-lifecycle-dao.ts`, trigger 011:181-186) | R-13 |
| run-1 RPL-1 (group build-order) | **re-raised** via run-2 F-07 | R-02 |
| run-1 FIX-1 (Phase 5 label/import) | **re-raised** | AF-02 |
| run-1 FIX-2 (Quality→Tone) | **re-raised** | R-03, AF-06 |
| run-1 orphans (Your Week, Phase 14 Message dep, Category CRUD) | Your Week **re-raised** as genuine orphan (E-04); Phase 14 **RESOLVED** (dossier now complete, D-14-037/131); Category CRUD **RESOLVED** as STUB 15 | E-04 / — |
| run-1 RSK-1 (Cycles for cadence-less contacts) | **re-raised** (run 2 dropped it) | R-15 |

New in this run, present in neither prior run: E-02 (ADR-011), E-05 (ADR-050/036 egress widening + un-owned note gate), E-06 (ADR-052), E-07 (ADR-018/019 placement), E-08 (Phase 7 quarantine premise), E-09 (HANDOFF §7 starfield), R-01 (Contact Knowledge unbuilt — the milestone's largest schema cluster), R-11, R-12, R-14, R-16, R-17, R-18, R-19, AF-04, AF-05, AF-07, AF-08.

---

# Owner reconciliation items the dossiers themselves name (not conflicts; listed so they are not lost)

- **Naming: `Log Contact` vs `Log Interaction`** — Phases 1/6/10 say Log Contact; Phase 13 §AN asks reconciliation to normalize (D-13-184). Taste → owner.
- **Default/general built-in Memory type name** (D-13-060, D-RM-056, D-13-190). Product → owner, needed before Phase 13 planning.
- **`Memory` working title** (D-01-063/075) → Phase 3 keeps "Memory" as the type name; confirm as final.
- **Migration/quarantine window for contacts** if E-08 option (a) is chosen (HANDOFF §12 open question 5 concerns custom-field definitions only).

---

# Handoff to GSD planning (findings indexed by phase)

**Intent:** REPLAN and STUB-CONTRACT items are implementation/sequencing work that `plan-phase` must absorb when it plans each phase. GSD does **not** read this report; during `new-milestone` setup attach each phase's items to its planning inputs (`CONTEXT.md` shim and/or a "Planning notes / audit findings" appendix) per `AUDIT-HANDOFF.md`. Do not mutate dossiers to do this beyond approved AUTO-FIX text syncs. ESCALATE items must be decided **before** roadmapping so the roadmapper plans against corrected inputs; AUTO-FIX items apply via `--fix` first.

| Phase | ESCALATE (decide first) | REPLAN / notes for plan-phase | AUTO-FIX | STUB |
|---|---|---|---|---|
| Roadmapper | E-04 (assign Your Week), E-08 | **Meta** migration order + numbers (015+); R-09 assign backup-bump owner; R-16 storage decisions | AF-07 | — |
| 01 App Shell | E-07 | R-18 | AF-03 | — |
| 02 Theme | E-09 | R-16 (theme prefs), R-17 (icon registry, status glyphs, reduced-motion hook — **before** 6/7/8/9/11) | — | 15 Appearance, 17 default |
| 03 Contact Knowledge | E-05 (note-permission owner; Off Limits/notes egress) | **R-01** (largest cluster; assign Trash owner; share-capture + AI-proposed fuel fates), R-08 (types/history/groups/scope + UNIQUE trip-wire), R-10 (searchable corpus) | — | — |
| 04 Dashboard Data | E-01, E-02, E-04 | R-10, R-11, R-16 (dashboard prefs) | AF-08 | 15 swipe pref |
| 05 Control Surface | E-01 (Manage Favorites entry), E-04, E-07 (Archived/Unbound home) | R-11 (Unbound search), R-19 | AF-02, AF-08 | — |
| 06 List View | E-01, E-02 | R-17 (glyphs) | — | 15/17 swipe pref + education |
| 07 Card View | E-01, E-02, E-08 | R-19 (bulk composes lifecycle events + recency cores), R-17 | — | — |
| 08 Orrery Camera | E-02 (Not Contacted System), E-03 | R-05 (density/satellites persistence; **relationships from R-01 must land first**), R-17 (reduced motion) | — | 15 Category CRUD |
| 09 Orrery Systems | — | R-05 (systems schema), R-09 | — | 15 Category CRUD + Systems Mgmt route |
| 10 Profile | E-06 (AI-draft entry) | R-06, R-15 (Intensity w/o cadence), R-01 (TTR sections depend on it) | AF-05 | 15 managers route |
| 11 History | — | R-03 (Tone/channel), R-04 (duration), R-12 (bind/unbind events), R-15 (Cycles w/o cadence), R-02 (group-linked edit/delete paths) | AF-04, AF-06 | 18 heatmap/wheel QA |
| 12 Group Logging | — | **R-02** (schema + recency-core fan-out + archived participants), R-03, R-04, R-09 | — | 15 channel exception copy |
| 13 Rapid Capture | (E-01 n/a) | **R-13** (ADR-016 last-spoke trip-wire), R-03 (channel vocabulary + assist CHECK), R-16 (channel pref), R-01 (Update Contact registry/Memory editor) | — | 15 channel pref, 17 vocabulary |
| 14 Compose | E-05, E-06 | **R-14** (assist lifecycle coexistence + Not yet/Don't log), R-03 (`Message` through assist CHECK), R-16 (mode pref) | AF-01 | 15 mode pref, 18 lifecycle heuristics |
| 16 AI Config | E-05, E-06 | **R-07** (toggle, lanes, OpenRouter edit points, pricing, personalization, defaults), R-09, R-16 | — | 15 AI routes + escape hatch, 17 OpenRouter promo, 18 Sentry seam |

---

## Gate

This is the dry-run stop. `LEDGER.md` and `AUDIT-REPORT.md` are in the working tree under the gitignored `audit/` directory — **nothing is committed and nothing in the repo or the dossiers was changed**. Re-run with `--fix` to be offered one batch approval over the eight AUTO-FIX findings (AF-01…AF-08). The nine **ESCALATE** items are the owner's to ratify or decline (superseding ADR + `npm run gen:adr-registry`, or dossier amendment); the nineteen **REPLAN** items and the migration meta-note go to the roadmapper and each phase's `plan-phase` via the handoff table above. The skill never touches ESCALATE or REPLAN items.
