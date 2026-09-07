# Roadmap: Orbit

Orbit is a local-first personal relationship manager (social CRM) for Android — React Native / Expo,
on-device SQLite, no backend. v1.0 built the working product foundation-first (Phases 1–21). v2.0
**Release Readiness** turns that functional foundation into a release-quality, low-friction mobile
experience: an intentional app shell, a real theme/visual system, a unified contact-knowledge model,
rebuilt Dashboard and Orrery surfaces, a modular Profile with history and insights, group logging,
rapid capture, a Compose-first messaging workspace, and a coherent AI configuration lane — ending in
a state suitable for outside beta testers.

## Decision authority (read before planning any v2.0 phase)

- **The fifteen dossiers in `docs/dossier/milestone-2/` are ground truth.** Every `[DECIDED]` and
  `[REJECTED]` item in them is implemented as written and is **never reopened** — reversing one is an
  owner decision, not a planning or implementation call.

- **Per-phase `CONTEXT.md` files are shims**, not the record. They point at the mapped dossier; edit
  the dossier, not the shim, when a decision needs to be stated or refined.

- **ADR-075–080 record the audit-ratified reversals** produced by the 2026-09-01 cross-dossier audit
  (binary Favorites / retired Manage Favourites, dashboard birthday banner relocation, single canonical
  Orrery view, Off Limits transmitted as avoidance constraints, retired exact-prompt first-send
  acknowledgement, and the four-tab shell). The audit bridge is
  `docs/dossier/milestone-2/AUDIT-HANDOFF.md`.

- Requirements in `.planning/REQUIREMENTS.md` are *derived from* the dossiers. Where a requirement and
  a dossier disagree, **the dossier wins**.

## Milestone-wide migration ordering (binding on every v2.0 phase)

This milestone implies **at least nine forward-only SQLite migrations plus one closing backup wire-format
bump**. They are sequenced milestone-wide, not per phase:

> **Amendment (2026-09-04, owner-approved): the v4 bump already landed early, out of order.** Phase 24.1
> bumped `BACKUP_FORMAT_VERSION` from 3 to **4** during a review-fix commit (`d677e2c`, "CR-01 preserve
> contact knowledge backups") to close a backup-coverage finding — ahead of the intended "Phase 36 owns
> v4" sequencing below. This is a recorded-decision deviation surfaced during Phase 24.2 planning; it is
> **not** re-litigated here (see the Phase 24.1 close-out for whether the bump itself should have been an
> escalation). Consequences now binding: **v4 is spent.** Phases that add entities between 24.1 and 36
> (24.2 included) **emit within the live format 4 without bumping.** Phase 36's *closing* bump therefore
> targets **v5** (or a decided extend-v4-in-place), decided at Phase 36 plan time — it is no longer "introduce v4".

1. **Strict order is schema → consumers → backup bump.** A phase lands its own schema before the code
   that reads it, and the **milestone's closing backup-format bump is Phase 36's FINAL plan** (now to
   **v5** — v4 landed early in 24.1, see the amendment above), executed after every other milestone
   schema change has landed.

2. **Never write a literal migration number in this roadmap or in any plan.** This repo's migration
   numbers drift every time a schema phase lands (see the v1.0 renumbering history). Each schema-bearing
   phase's plan **verifies head+1 against `src/db/migrations/` and `TARGET_VERSION` in
   `src/db/database.ts` on disk at plan time**, and writes the number it observed — never one inherited
   from a plan, a dossier, or this file.

3. **Schema-bearing phases:**
   - Phase 23 — theme preferences
   - Phase 24.1 — the knowledge model, additive schema (largest cluster in the milestone; split from Phase 24)
   - Phase 24.2 — the destructive data-move (share-capture carry-over + ADR-030 retirement) + value-history/scope columns
   - Phase 25 — dashboard preferences + the retirement path for superseded keys
   - Phase 27 — swipe-action preference (may fold into Phase 25's migration)
   - Phase 29 — orrery preferences (may fold with Phase 30's)
   - Phase 30 — Systems tables
   - Phase 31 — profile layout/background templates
   - Phases 32 / 34 — one **shared** interactions migration (Tone, channel, duration, Allow AI); its
     owning phase is decided **once**, at plan time, by whichever plans first

   - Phase 33 — group events
   - Phase 35 — compose preferences
   - Phase 36 — AI configuration, **plus the final backup wire-format bump (now v5 — v4 landed early in 24.1; see amendment)**
   - Phases 22, 26, and 28 ship **no** schema.
4. **All new durable preferences live in `app_settings` columns** — portable via the backup manifest —
   **never in AsyncStorage.** A preference that must survive backup/restore is a column, not device-local
   storage.

## Milestones

- ✅ **v1.0 MVP** — Phases 1–21 (shipped 2026-09-01) — full detail archived in
  [`milestones/v1.0-ROADMAP.md`](milestones/v1.0-ROADMAP.md); requirements in
  [`milestones/v1.0-REQUIREMENTS.md`](milestones/v1.0-REQUIREMENTS.md); phase artifacts in
  `milestones/v1.0-phases/`.

- 🚧 **v2.0 Release Readiness** — Phases 22–40 (in planning, started 2026-09-02). 217 requirements
  across Phases 22–36; Phases 37–40 are deferred-planning slots.

  - **Foundations** — 22 App Shell & Navigation · 23 Theme & Visual System · 24.1 Contact Knowledge Foundation (Model, Storage & UI) · 24.2 Contact Knowledge (Egress, Search, Types & Data-moves)
  - **Dashboard** — 25 Dashboard Data & State Foundation · 26 Dashboard Control Surface · 27 Dashboard List View · 28 Dashboard Card View
  - **Orrery** — 29 Orrery Camera, Scale & Exploration · 30 Orrery Systems
  - **Profile & history** — 31 Profile Experience · 32 Interaction History & Insights
  - **Capture & messaging** — 33 Group Interaction Logging · 34 Rapid Capture & Update Flows · 35 Messaging & AI Compose · 36 AI Configuration & Prompting
  - **Deferred planning** — 37 Settings & Personalization · 38 Your Week · 39 Onboarding · 40 Responsive & Release Hardening
- ⏭️ **v3.0 Sync** — scope already drafted in `.planning/sync-milestone/` (relabeled from the earlier
  v2.0 placeholder). Not started; sits over a working local DB, never replaces it.

## Phases

**Phase Numbering:**

- Integer phases (22, 23, 24 …): planned milestone work, continuing the project-wide sequence from v1.0.
- Decimal phases (22.1, 22.2): urgent insertions (marked INSERTED), executing between their integers.

<details>
<summary>✅ v1.0 MVP (Phases 1–21) — SHIPPED 2026-09-01</summary>

Complete phase-by-phase detail, plan lists, and success criteria live in
[`milestones/v1.0-ROADMAP.md`](milestones/v1.0-ROADMAP.md). Summary:

- [x] Phase 1: Project Scaffold & Portable Code — completed 2026-08-14
- [x] Phase 2: Data Foundation & Status Engine — completed 2026-08-14
- [x] Phase 3: Custom Fields — completed 2026-08-15
- [x] Phase 4: Contact CRUD & Lifecycle — completed 2026-08-15
- [x] Phase 5: Photos — completed 2026-08-15
- [x] Phase 6: Interaction Log, Status & Impact — completed 2026-08-15
- [x] Phase 7: Conversational Fuel — completed 2026-08-16
- [x] Phase 8: Dashboard & Never-Contacted Screen — completed 2026-08-16
- [x] Phase 9: Compose Screen & SMS Handoff — completed 2026-08-16
- [x] Phase 10: Share-Sheet Capture — completed 2026-08-16
- [x] Phase 11: Actionable Notifications — completed 2026-08-16
- [x] Phase 12: Home Screen Widget — completed 2026-08-17
- [x] Phase 13: Orrery — completed 2026-08-18
- [x] Phase 14: AI Message Suggestions — owner-accepted 2026-08-22
- [x] Phase 15: Weekly Digest — completed 2026-08
- [x] Phase 16: Custom Field Value Normalization (migration 006 / ADR-001) — completed 2026-08
- [x] Phase 17: Backup, Export & Restore — completed 2026-08
- [x] Phase 18.1: Contact Method Normalization — completed 2026-08-28
- [x] Phase 18.2: Bound/Unbound Lifecycle — completed 2026-08
- [x] Phase 19: System Contact Import — completed 2026-08-30
- [x] Phase 19.1: Older-Android Contact Picker (Hybrid two-picker, ADR-002) (INSERTED) — completed 2026-08
- [x] Phase 20: Contact Reconciliation & Merge (ADR-003) — completed + owner-signed-off 2026-08-31
- [x] Phase 21: Interaction Assist & Reach Out — completed + owner-signed-off 2026-08-31

_Phase 18 ("Contact Data Normalization") was split into 18.1 + 18.2; its planning record is archived at
`milestones/v1.0-phases/18-contact-data-normalization/`._

All v1.0 commits are local on `main` and have NOT been pushed.

</details>

### v2.0 Release Readiness (Phases 22–40)

- [x] **Phase 22: App Shell & Navigation** - Four-tab shell with per-tab stacks, universal six-action speed-dial FAB, and origin-aware Back (completed 2026-09-03)
- [x] **Phase 23: Theme & Visual System** - Galaxy + Standard packages × Light/Dark/Follow System, semantic icon registry, reduced-motion and contrast guarantees (completed 2026-09-03)
- [x] **Phase 24.1: Contact Knowledge Foundation — Model, Storage & UI** - The "Things to Remember" model + UI over fields, custom fields, relationships, typed Memories, current-state history, and soft-delete (additive migration; KNOW-01..09) (completed 2026-09-04; goal ACHIEVED — device UAT 7/7, UI 18/24 no blockers, Nyquist signed off. Carried forward: D-11 default Memory-type display name — owner naming decision due before Phase 34)
- [x] **Phase 24.2: Contact Knowledge — Egress, Search, Types & Data-moves** - Bounded local search, per-item AI opt-in + Off Limits, expanded custom-field types + value history, imported notes, share-capture migration, backup coverage (destructive migration + ADR-030 retirement; KNOW-10..16) (completed 2026-09-04; goal ACHIEVED — verifier 7/7 must-haves, code review 0 blockers, on-device UAT 3/3 passed: memory AI toggle/sparkle, url/email/phone field types + tap-to-fix, imported Contacts notes; migrations 017+018 verified on-device user_version=18)
- [x] **Phase 25: Dashboard Data & State Foundation** - Shared population/filter/sort/search query state, durable and restored on return (completed 2026-09-05; goal ACHIEVED — verifier 14/14 must-haves, code review 0 blockers/2 warnings/3 info with WR-01 fixed inline; migration 019 verified irreversibility-safe. Owner-accepted deferrals: D-13 Unbound name-lookup search + D-14 Not-Contacted chip → Phase 26, D-06 birthday at-a-glance → deferred Your Week — all with a live path preserved)
- [x] **Phase 26: Dashboard Control Surface** - Lean header plus three equal live-applying anchored control panels (completed 2026-09-05; goal ACHIEVED — Pixel UAT 7/7 after a launch-blocking render loop was found + fixed inline (fc62a7b); owner reviewed the release APK and post-UAT fixes landed: archived rows open the profile / origin-aware return (53bb4af), control panels centered-on-screen + scrollable (c414e51). Owner decisions: panels centered both-axes (D-11 floating-not-modal preserved); count header stays total-live. D-13/D-14 carried from Phase 25 delivered — Unbound name-lookup search + Not-Contacted population)
- [x] **Phase 27: Dashboard List View** - Full-width three-line rows with status border + glyph, swipe logging, and search explanations (closed 2026-09-06 by owner approval; implementation, review, validation, and release build complete. Partial device-UAT coverage is retained in 27-UAT.md.)
- [ ] **Phase 28: Dashboard Card View** - Avatar-first 3-column grid with long-press menu and multi-select bulk management
- [ ] **Phase 29: Orrery Camera, Scale & Exploration** - One canonical 2.5D world with bounded camera, semantic zoom, density presets, and built-in Systems
- [ ] **Phase 30: Orrery Systems** - Named dynamic + manual Systems authored in a floating HUD, with management, switching, and portability
- [ ] **Phase 31: Profile Experience** - Fixed Hero, modular reorderable sections, layout/background templates, Relationship Overview tile grid
- [ ] **Phase 32: Interaction History & Insights** - Activity heatmap (Cycles lens), intensity, Rolodex History Browser, canonical Interaction Detail/Edit
- [ ] **Phase 33: Group Interaction Logging** - Group Event parent with canonical child interactions, inheritance/overrides, and atomic fan-out
- [ ] **Phase 34: Rapid Capture & Update Flows** - Streamlined Add Contact, Quick Log with post-log capture, Tone vocabulary, Update Contact chooser loop
- [ ] **Phase 35: Messaging & AI Compose** - Compose-first drafting workspace, Text/Email transmit handoff, Research side, three-suggestion AI review
- [ ] **Phase 36: AI Configuration & Prompting** - Three connection lanes, prompt personalization, permission manager, and the final backup format bump (v5 — v4 landed early in 24.1)
- [ ] **Phase 37: Settings & Personalization** - DEFERRED PLANNING — consolidates the preference/admin seams exported by Phases 22–36
- [ ] **Phase 38: Your Week** - DEFERRED PLANNING — relocated birthday presentation, Group Event rollups, heatmap-aggregation reuse
- [ ] **Phase 39: Onboarding** - DEFERRED PLANNING — first-run setup and teaching against the implemented product
- [ ] **Phase 40: Responsive & Release Hardening** - DEFERRED PLANNING — device, accessibility, and performance audit pass

## Phase Details

### Phase 22: App Shell & Navigation

**Goal**: Every surface in the app is reachable through one intentional shell — a persistent four-tab bottom navigation with per-tab stacks, a universal six-action speed-dial FAB, and Back that always returns the user where they actually came from.
**Depends on**: Nothing (foundation phase of this milestone)
**Requirements**: SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-05, SHELL-06, SHELL-07, SHELL-08, SHELL-09, SHELL-10, SHELL-11, SHELL-12, SHELL-13, SHELL-14, SHELL-15
**Success Criteria** (what must be TRUE):

  1. User can move among Dashboard, Orrery, Backup/Restore, and Settings from a persistent bottom tab bar where each tab keeps its own stack; re-tapping the active tab first dismisses transient UI, then returns that tab to its root, with a short crossfade and no swipe-between-tabs gesture (SHELL-01/02/15)
  2. Android system Back and the visible Back control behave identically on every screen — dismissing the topmost transient layer first, returning a Profile to its true origin, never replaying a completed edit, and falling back to Dashboard for externally launched flows including a deep link to a missing contact (SHELL-03/04/05)
  3. User can expand the FAB into a labeled six-action speed dial (Add Contact, Quick Log, Log Contact, Group Log, Update Contact, Memory) in fixed order, which preselects the contact when opened from a Profile and otherwise opens the one shared search-ordered contact picker (SHELL-08/09/10)
  4. Quick Log from the shell writes immediately at the current time and reports truthfully — success snackbar with Undo on a committed write, error snackbar with Retry otherwise — and never claims success without a commit (SHELL-11)
  5. Shell chrome behaves contextually: nav and FAB hide during focused workflows and while the keyboard is open, leaving a workflow with meaningful unsaved changes prompts Discard/Keep, Group Events and Archived Contacts are reachable from the Dashboard header/overflow, and every shell control carries semantic labels, adequate touch targets, and correct modal/speed-dial focus management (SHELL-06/07/12/13/14)

**Canonical refs**: docs/dossier/milestone-2/phase-01-app-shell-navigation-dossier-amended-group-events.md; docs/dossier/milestone-2/planning-notes/phase-01-planning-notes.md
**Schema**: none
**Plans:** 6/6 plans executed
**Wave 1**

- [x] 22-01-PLAN.md — TRACER: four-tab bottom-nav shell + nested external-reset reconciliation (SHELL-01/04/05/15)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 22-02-PLAN.md — Navigator behavior: transient store, back-intent, active-tab retap, nav visibility (SHELL-02/03/04/06)
- [x] 22-03-PLAN.md — In-app/container navigate reconciliation (incl. ImportReview crash), completion resets, no-replay, Discard/Keep (SHELL-03/04/05/07)

**Wave 3** *(blocked on Wave 2 completion — 04 depends on 02's back-intent)*

- [x] 22-04-PLAN.md — Shell chrome: app bars, insets, content-clearance, Group Events header/overflow + Archived (SHELL-12/13/14)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 22-05-PLAN.md — Universal six-action FAB + placeholder routes + haptics (SHELL-06/08/09/14)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 22-06-PLAN.md — Shared contact picker + commit-truthful Quick Log snackbar + shell-refresh freshness (SHELL-09/10/11/14)

**UI hint**: yes

### Phase 23: Theme & Visual System

**Goal**: Every surface draws through one theme system — Galaxy or Standard × Light / Dark / Follow System — with accent, backgrounds, icons, motion, and contrast resolved centrally instead of per screen.
**Depends on**: Phase 22
**Requirements**: THEME-01, THEME-02, THEME-03, THEME-04, THEME-05, THEME-06, THEME-07, THEME-08, THEME-09, THEME-10, THEME-11, THEME-12, THEME-13
**Success Criteria** (what must be TRUE):

  1. User can choose a theme package and an appearance mode independently (all four combinations, Follow System tracking the OS live, first launch Galaxy + Follow System), plus a curated accent and a bundled background per package — with every change previewing live, remembered per package, and theme-critical preferences restored before first render so there is no wrong-theme flash (THEME-01/02/03/04)
  2. Galaxy renders glass-forward with optional very subtle ambient motion while Standard renders flatter and quieter, and the Orrery follows the active package with a more immersive treatment that still resolves through shared tokens (THEME-05/12)
  3. The app honors the OS reduced-motion preference app-wide through a reusable hook the Skia render loop can consume, and text respects system scaling by reflowing rather than truncating or shrinking (THEME-06/07)
  4. Relationship state is never conveyed by color alone — stable semantic hue families plus distinct silhouette glyphs — and functional content meets strong AA-equivalent contrast in every supported theme/mode combination (THEME-08/11)
  5. Icons draw through a centralized semantic registry with state variants, modals/sheets and buttons come from shared variants with a formal hierarchy including visually distinct destructive actions, and theme preferences persist durably and survive backup and restore (THEME-09/10/13)

**Canonical refs**: docs/dossier/milestone-2/phase-02-theme-visual-system-dossier.md; docs/dossier/milestone-2/planning-notes/phase-02-planning-notes.md
**Schema**: theme preferences (portable `app_settings` columns; migration 015 verified head+1 at plan time)
**Plans**: 7 plans
**Wave 1**

- [x] 23-01-PLAN.md — TRACER: persisted theme resolves package × mode with restore-before-paint (migration 015, DAO/backup plumbing, orbit-theme import) [THEME-01/03/12]

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 23-02-PLAN.md — Runtime deps, bundled fonts, typography/spacing/radii tokens, text-scaling reflow [THEME-07]
- [x] 23-03-PLAN.md — Four palettes, curated accent system, AA contrast gate [THEME-01/02/11]
- [x] 23-04-PLAN.md — Reduced-motion hook (SharedValue bridge + boolean twin) + motion tokens [THEME-06]

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 23-05-PLAN.md — Semantic icon registry + status glyphs [THEME-08/09]
- [x] 23-06-PLAN.md — Backgrounds, surface/glass treatment, Orrery immersive + reduced-motion consumption [THEME-04/05/12]

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 23-07-PLAN.md — Modal/sheet variants + button hierarchy (destructive beyond colour) [THEME-10]

**UI hint**: yes

### Phase 24.1: Contact Knowledge Foundation — Model, Storage & UI

**Goal**: The durable contact-knowledge model exists and is usable — typed Memories from one central application-owned registry (plus a user-labelled Custom type), structured relationships, current-state history (Last Talked About, Current Location), and per-item notes/links/dates/pinning/outdated/visibility/provenance — with soft-delete + Recently Deleted (launch-sweep expiry), all surfaced in the unified "Things to Remember" UI. Additive schema only (migration 016).
**Depends on**: Phases 22, 23
**Requirements**: KNOW-01, KNOW-02, KNOW-03, KNOW-04, KNOW-05, KNOW-06, KNOW-07, KNOW-08, KNOW-09
**Success Criteria** (what must be TRUE):

  1. User sees first-class fields, custom fields, structured relationships, and typed Memory items together in one visually grouped "Things to Remember" surface with featured/current information first, where Memory types come from one central application-owned registry and a generic Custom-type Memory can carry the user's own label (KNOW-01/02/05)
  2. History-aware information (Last Talked About, Current Location) shows the most recent value on the Profile with the full backlist on drill-in, and the user can edit a historical entry or promote it back to current (KNOW-03/04)
  3. User can attach optional notes, links, and a meaningful date, pin items, mark items outdated without deleting, override type-level Profile visibility per item, see lightweight provenance in detail views, and restore a deleted Memory from Recently Deleted (expiry running via the launch sweep, never a timer) (KNOW-06/07/08/09)

**Canonical refs**: docs/dossier/milestone-2/phase-03-contact-knowledge-foundation-dossier.md; docs/dossier/milestone-2/planning-notes/phase-03-planning-notes.md
**Schema**: additive model migration (016 — verified head+1 on disk at plan time: TARGET_VERSION=15, migrations 001–015 → first new is 016); no backup-format bump
**Plans**: 7/8 plans executed (4 waves)

- [ ] 24.1-PLAN-CHECK-cycle1.md

**Wave 1**

- [x] 24.1-01-PLAN.md — Tracer: migration 016 (full additive schema) + in-code Memory-type registry + memories DAO/read + reachable Things-to-Remember render (KNOW-01/02/09)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 24.1-02-PLAN.md — Memories DAO full CRUD + metadata (notes/links/dates/pin/outdated) + soft-delete/restore + registry-driven visibility (KNOW-02/06/07/08/09)
- [x] 24.1-03-PLAN.md — Structured relationships DAO + read (optional Orbit-contact link) + merge/purge coverage for the three knowledge tables (KNOW-05; review H2/M5)
- [x] 24.1-04-PLAN.md — Current-state history (Last Talked About + Current Location): set/edit/promote-to-current + backlist (KNOW-03/04)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 24.1-05-PLAN.md — Recently Deleted / Trash: guarded permanent delete + TOCTOU-safe idempotent launch sweep (KNOW-07)
- [x] 24.1-06-PLAN.md — Unified "Things to Remember" grouped surface + Memory editor + routes (KNOW-01/03/05/06/08/09)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 24.1-07-PLAN.md — Recently Deleted screen + history backlist drill-in + relationship editor (KNOW-03/04/05/07)

**UI hint**: yes
**Note**: split from the original single Phase 24 (owner-approved 2026-09-03) at the migration seam — 24.1 is additive schema + model + "Things to Remember" UI; 24.2 is the destructive data-move + egress/search/types.

### Phase 24.2: Contact Knowledge — Egress, Search, Types & Data-moves

**Goal**: The knowledge model becomes searchable, AI-permissioned, richly typed, and portable — bounded local typo search (no FTS5), opt-in-per-item AI permission with Off Limits kept separate, the expanded custom-field type set with optional value history, imported phone-Contacts notes, migration of existing share-sheet captures, and full backup/restore coverage. Includes the milestone's destructive data-move (migration 017 + the new ADR retiring ADR-030).
**Depends on**: Phase 24.1
**Requirements**: KNOW-10, KNOW-11, KNOW-12, KNOW-13, KNOW-14, KNOW-15, KNOW-16
**Success Criteria** (what must be TRUE):

  1. Dashboard search finds contact names, Memory labels/values/notes, relationship names, and eligible custom-field content regardless of storage table with typo tolerance — as TypeScript scoring with no FTS5 — and never searches internal metadata (KNOW-10)
  2. AI use is opt-in per item behind two gates (global AI, then per-item permission defaulting OFF) with a sparkle on enabled items and Off Limits kept separate carrying avoid-this-topic semantics (KNOW-11/12)
  3. The nine custom-field types support global or per-contact definitions with optional value history (ADR-001 uniqueness untouched); imported Contacts-app notes land as their own AI-off Memory type; existing share-sheet captures migrate with no data loss; and backup/restore preserves the entire knowledge model including soft-deleted records (KNOW-13/14/15/16)

**Canonical refs**: docs/dossier/milestone-2/phase-03-contact-knowledge-foundation-dossier.md; docs/dossier/milestone-2/planning-notes/phase-03-planning-notes.md
**Schema**: destructive data-move migration **017** (memories.allow_ai + share-capture carry-over + ADR-030 retirement via **ADR-081**; verified head+1 on disk 2026-09-04: migrations 001–016, TARGET_VERSION=16) + additive migration **018** (custom-field scope/history_retained/field_group + custom_field_value_history table). Backup: `BACKUP_FORMAT_VERSION` is ALREADY 4 on disk (24.1 pre-bumped it, commit d677e2c) — 24.2 emits its additions within format 4, no further bump. The milestone migration-ordering rule was amended 2026-09-04 (owner-approved) to record this: v4 is spent, Phase 36's closing bump is now v5. **Deferred to a later Profile/custom-fields UI phase (see Phase 31):** the custom-field value-history backlist UI and grouped-field rendering — 24.2 lands only the `custom_field_value_history` table + DAO read and the `field_group` column (data-layer), with no in-phase viewer.
**Plans**: 7/7 plans executed (3 waves)

**Wave 1**

- [x] 24.2-01-PLAN.md — Tracer: migration 017 (allow_ai + destructive share/ai data-move) + AI-egress gate (default OFF) + one memory proven searchable + ADR-081 (KNOW-10/11/16)

**Wave 2** *(blocked on Wave 1)*

- [x] 24.2-02-PLAN.md — Knowledge search corpus + TS typo scorer, no FTS5 (KNOW-10)
- [x] 24.2-03-PLAN.md — Per-item AI permission UI/toggle/sparkle + Off Limits avoid-topic control (KNOW-11/12)
- [x] 24.2-04-PLAN.md — Custom-field types url/email/phone + parsers + widgets (KNOW-13)
- [x] 24.2-05-PLAN.md — Migration 018: custom-field scope/history/group + seeding writers + value-history DAO (KNOW-13)
- [x] 24.2-06-PLAN.md — Imported Contacts-app notes as an AI-off Memory type (native Note MIME read) (KNOW-14)

**Wave 3** *(blocked on Wave 2)*

- [x] 24.2-07-PLAN.md — Backup/restore coverage of allow_ai + scope/history/group + value-history + soft-deleted (KNOW-15)

**UI hint**: yes
**Note**: split from the original single Phase 24 (owner-approved 2026-09-03). Migration/ADR numbers verified on disk at plan time (2026-09-04): destructive migration 017 + additive 018; new superseding ADR-081 (head was ADR-080).

### Phase 25: Dashboard Data & State Foundation

**Goal**: One shared Dashboard query and state engine — populations, filters, sort, and search — that both views read, that persists across relaunch, and that comes back intact when the user returns from a Profile.
**Depends on**: Phase 24.2
**Requirements**: DASHQ-01, DASHQ-02, DASHQ-03, DASHQ-04, DASHQ-05, DASHQ-06, DASHQ-07, DASHQ-08, DASHQ-09, DASHQ-10, DASHQ-11, DASHQ-12, DASHQ-13, DASHQ-14
**Success Criteria** (what must be TRUE):

  1. With nothing selected the Dashboard shows Active Contacts, and the user can multi-select Favorites, Birthdays, Not Contacted, Snoozed, and All Contacts as an OR-union where each contact appears once — All Contacts resolving to Active ∪ Not Contacted, archived and unbound staying outside, snoozed contacts staying reachable but out of Needs Attention, and the standalone Never Contacted screen and include-Unbound toggle retired (DASHQ-01/02/03/04/05)
  2. User can filter across the five families (OR within a family, AND across families) with filters surviving population changes, and sort by Default (population-aware), name, recency, or relationship status with an explicit sort surviving until reset (DASHQ-06/07)
  3. Search is scoped to the current Population + Filters universe, never surfaces archived or unbound contacts, matches forgivingly across the semantic knowledge corpus with identity matches prioritized, and shows up to three prioritized highlighted snippets plus "+N more" without a name match suppressing secondary matches (DASHQ-08/09/10)
  4. Population, filters, sort, and the List/Card preference persist across relaunch as durable backup-portable settings while search text and scroll position do not — and Dashboard → Profile → Back restores the full working state including search, filters, population, sort, and scroll (DASHQ-11/12)
  5. List and Card views share one query state where each axis is independently clearable, a global Reset Dashboard View restores all four while preserving the List/Card preference, and the Dashboard birthday banner is gone in favor of the Birthdays population (DASHQ-13/14)

**Canonical refs**: docs/dossier/milestone-2/phase-04-dashboard-data-state-foundation-dossier.md; docs/dossier/milestone-2/planning-notes/phase-04-planning-notes.md
**Schema**: migration 019 — durable dashboard-preference columns on `app_settings` (view/populations/filters/sort); portable-key removal for superseded keys deferred to Phase 36 (verified head+1 = 019 on disk)
**Plans**: 7/7 plans executed (4 waves)
**Wave 1**

- [x] 25-01-PLAN.md — Schema (migration 019) + durable-pref DAO + shared query-state tracer (Active universe end-to-end) [W1]

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 25-02-PLAN.md — Populations OR-union engine (Favourites/Birthdays/Not-Contacted/Snoozed/All-Contacts, dedupe) [W2]
- [x] 25-04-PLAN.md — Scoped semantic search: eligible-id corpus scope + match descriptors (≤3 + "+N more") [W2]
- [x] 25-05-PLAN.md — Ephemeral session store (search/scroll) + empty-state population model [W2]

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 25-03-PLAN.md — Five filter families + reversible Gravity post-query TS filter + sort model [W3]
- [x] 25-06-PLAN.md — Favourites retirement (ADR-075): widget Default order, retire Manage-favourites, keep column [W3]

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 25-07-PLAN.md — Retire birthday banner + Never-Contacted screen + include-Unbound toggle; legacy Home search made bound-only (D-13, Unbound name-lookup replacement deferred to Phase 26) [W4]

**UI hint**: yes

### Phase 26: Dashboard Control Surface

**Goal**: The Dashboard exposes its query foundation through a lean header and three equal anchored panels that apply changes live, with no modal step and no Apply button.
**Depends on**: Phase 25 (routes into Phases 28 and 33 land later — those entries may ship disabled)
**Requirements**: DASHC-01, DASHC-02, DASHC-03, DASHC-04, DASHC-05, DASHC-06, DASHC-07, DASHC-08, DASHC-09, DASHC-10
**Success Criteria** (what must be TRUE):

  1. The Dashboard reads header → Population/Filters/Sort control row → Search + List/Card row → contact collection, with Your Week and Group Events reachable from the header as first-class icon+label destinations and a collapsible search sharing its row with an accessible List/Card toggle (DASHC-01/02/07)
  2. Population, Filters, and Sort are three separate equal controls whose summaries show current state with overflow collapsing to "+N" and a restrained active treatment on non-default state (DASHC-03)
  3. Tapping a control opens an anchored floating panel — not a modal or bottom sheet — whose changes apply live with results visibly updating behind it, while the content behind is interaction-inert and out of accessibility focus; panels dismiss by re-tap, outside tap, or Back, tapping another control switches directly, and only one panel is open at a time (DASHC-04/05)
  4. The Population panel lists All Contacts as an ordinary row with Active Contacts as the implicit default, Filters clear in-panel, and Sort offers an explicit Default (DASHC-06)
  5. Dashboard overflow reaches Group Events, Unbound Contacts, Archived Contacts, Select Contacts, and Reset Dashboard View — with no Manage Favourites entry and no standalone bulk screen — Unbound and Archived open as child routes with origin-aware return, and Reset returns to Active Contacts, no filters, Default sort, and cleared search while preserving the List/Card preference (DASHC-08/09/10)

**Canonical refs**: docs/dossier/milestone-2/phase-05-dashboard-control-surface-dossier-amended-group-events.md; docs/dossier/milestone-2/planning-notes/phase-05-planning-notes.md
**Schema**: none (D-03 — verified TARGET_VERSION=19 / migration head 019 on disk 2026-09-05; retirement of `include_unbound_never_contacted` / prefs keys deferred to the Phase 36 backup bump)
**Plans**: 7/7 plans executed (3 waves)
**Wave 1**

- [x] 26-01-PLAN.md — TRACER: Population control end-to-end (AnchoredPanel + presentation seam + HomeScreen old→new store migration) [DASHC-01/03/04/05/06]

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 26-02-PLAN.md — Filters + Sort anchored panels (control-row completion, layer-2 seam) [DASHC-03/06]
- [x] 26-03-PLAN.md — D-12 population-aware search read (listDashboardSearch, A3 semantics preserved, no fork) [DASHC-07]
- [x] 26-04-PLAN.md — Header destinations (Your Week + Group Events, icon-only fallback) + amended 5-row overflow + confirmation-free Reset + OverflowMenu disabled [DASHC-02/08/10]
- [x] 26-05-PLAN.md — Archived child-route chrome refactor (ShellAppBar child, ADR-018 preserved) [DASHC-09]
- [x] 26-06-PLAN.md — Unbound child-route refactor + own-route name search (ADR-062/D-08 retrieval replacement) [DASHC-09]

**Wave 3** *(blocked on Wave 2 completion — edits HomeScreen after 04 + wires the 03 read)*

- [x] 26-07-PLAN.md — Collapsible search + List/Card toggle row; wire listDashboardSearch + retire legacy listDashboard/listNeverContacted (no dual-read); preserve D-03 count/policy machinery [DASHC-01/07]

**UI hint**: yes

### Phase 27: Dashboard List View

**Goal**: The List view renders the shared query as scannable full-width rows that carry identity, recency, one useful piece of context, and relationship state without relying on color — with swipe gestures that log or edit.
**Depends on**: Phases 23, 25, 26
**Requirements**: LISTV-01, LISTV-02, LISTV-03, LISTV-04, LISTV-05, LISTV-06, LISTV-07, LISTV-08, LISTV-09, LISTV-10
**Success Criteria** (what must be TRUE):

  1. Each contact renders as a full-width medium-compact row — large circular avatar plus a stable three-line stack of name, recency + category (or "No interactions yet"), and one deterministic adaptive context line or a stable completeness prompt — with roughly 5–6 rows visible at default text size (LISTV-01/02/03)
  2. An always-visible star toggles binary Favorite membership with immediate fill/unfill and a light haptic, no success snackbar, and revert-plus-notification on persistence failure (LISTV-04)
  3. Unsnoozed relationship state reads through two redundant channels — a status-colored border and a distinct status glyph — with unevaluated contacts neutral and glyph-less and snoozed contacts showing a neutral border and snooze glyph (LISTV-05)
  4. Tap opens the Profile (a partially swiped row closes first), right swipe runs the user's globally configured logging action (Quick Log or Log Contact, default Quick Log, durable and backup-portable) on gesture commitment, and left swipe routes to Edit Contact — one row revealed at a time, with no destructive swipe action (LISTV-07/08)
  5. During search, rows keep the name and replace lines 2–3 with a compact match explanation plus the strongest highlighted snippet; assistive-technology users get equivalent row actions and a color-free description of name, category, recency, favorite, and relationship/snooze state; and query changes update rows in place with restrained reduced-motion-aware transitions and cause-aware empty/error states shared semantically with Card View (LISTV-06/09/10)

**Canonical refs**: docs/dossier/milestone-2/phase-06-dashboard-list-view-dossier.md; docs/dossier/milestone-2/planning-notes/phase-06-planning-notes.md
**Schema**: standalone migration **020** — additive `app_settings.dashboard_right_swipe_action` column (verified head+1 on disk 2026-09-05: migrations 001–019, `TARGET_VERSION=19` → first new is 020; the fold-into-Phase-25 option is foreclosed since 019 already shipped). Portable key `dashboardRightSwipeAction` allowlisted now in `PORTABLE_SETTINGS_KEYS`; no backup-format bump (Phase 36 owns that). Re-verify head+1 at execution time.
**Plans**: 8/8 plans executed (6 waves; both gap-closure plans delivered; closed 2026-09-06 by owner approval with partial device-UAT coverage retained in `27-UAT.md`)
**Wave 1**

- [x] 27-01-PLAN.md — TRACER: additively widen shared read (last_contact + snooze_until) + one real ListRow end-to-end (identity + recency·category + status border/glyph, null-safe) wired into HomeScreen [LISTV-01/02/05]

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 27-02-PLAN.md — Migration 020 + right-swipe preference DAO/validator + PORTABLE allowlist (one-way migration checkpoint) [LISTV-08]
- [x] 27-03-PLAN.md — Batch line-3 knowledge read + deterministic line-3 selection + favorite→star registry [LISTV-03/04]

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 27-04-PLAN.md — ListRow content: binary star (optimistic + revert) + line 3 render + colour-free a11y description [LISTV-03/04/09]

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 27-05-PLAN.md — Swipe gestures (ReanimatedSwipeable, single-open, tap-close) + configured logging on commit + a11y row actions [LISTV-07/08/09]

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 27-06-PLAN.md — Search-mode rendering + reduced-motion in-place transitions + shared empty/error/loading [LISTV-06/10]

**Wave 6** *(gap closure; blocked on completed Wave 5)*

- [x] 27-07-PLAN.md — Reconcile rapid favourite writes so an older durable success survives a latest failure [LISTV-04]
- [x] 27-08-PLAN.md — Strictly validate timestamps and make malformed List recency fail safe [LISTV-05]

**UI hint**: yes

### Phase 28: Dashboard Card View

**Goal**: The Card view gives an avatar-first grid for fast visual scanning and becomes the single home for multi-select bulk management of contacts.
**Depends on**: Phases 23, 25, 26
**Requirements**: CARDV-01, CARDV-02, CARDV-03, CARDV-04, CARDV-05, CARDV-06, CARDV-07, CARDV-08, CARDV-09, CARDV-10, CARDV-11, CARDV-12
**Success Criteria** (what must be TRUE):

  1. User browses a compact avatar-first grid of floating bubbles — 3 columns on a normal portrait phone, 2 on narrow devices or large text, more when wide — each card showing name, recency, one compact adaptive context item, a thin status-colored ring plus status glyph (neutral ring and snooze glyph when snoozed), and an always-visible Favorite star, keeping its geometry during search while showing the matched-field label and strongest snippet (CARDV-01/02/03)
  2. Tap opens the Profile and long-press opens a per-contact menu (View Profile, Quick Log, Log Interaction, Message, Edit Contact, Favorite, Snooze, Select) that excludes Delete and Archive, with no duplication of List swipes (CARDV-04)
  3. User can enter multi-select from the long-press menu or Dashboard overflow Select Contacts, where selection circles appear only in selection mode, taps toggle selection with a visible count, the control area is locked and replaced by selection actions, and Select All operates over the result universe frozen when selection began (CARDV-05/06)
  4. Bulk actions cover Quick Log, Log Interaction, Favorites, Snooze/Unsnooze, Set Category, Archive, and a Sensitive Operations group containing Change Contact Frequency only — bulk Quick Log writing one generic current-time interaction per contact through the canonical recency writers, and Log Interaction routing 1 selected to the individual flow and 2+ into Group Log with participants preloaded (CARDV-07/08/09/11)
  5. Bulk Archive is the recoverable removal behind confirmation with permanent deletion staying a manual per-contact action on the Archived list, and after a successful ordinary bulk operation selection mode persists until the user exits explicitly, with Back exiting multi-select before navigating (CARDV-10/12)

**Canonical refs**: docs/dossier/milestone-2/phase-07-dashboard-card-view-dossier-v0.2.md; docs/dossier/milestone-2/planning-notes/phase-07-planning-notes.md
**Schema**: none (D-03 — no migration; every bulk op composes existing writers; TARGET_VERSION=20 / migration head 020 verified on disk at plan time)
**Plans**: 8/8 plans executed (5 waves)

- [x] 28-08-PLAN.md

**Wave 1** *(01/02/03 parallel — disjoint files)*

- [x] 28-01-PLAN.md — TRACER: avatar-first grid renders real contacts end-to-end (status ring+glyph, favourite star) + 7 new icon-registry entries [CARDV-01/02/03]
- [x] 28-02-PLAN.md — bulk-actions-dao: extract non-mutexed *Cores + 8 atomic bulk composers (recency spine, immutable event trail, single-column category/frequency) [CARDV-07/08/10/11]
- [x] 28-03-PLAN.md — dashboard-selection-store: mode / selectedIds / frozen universe (pure in-memory) [CARDV-05/06/12]

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 28-04-PLAN.md — Card content: compactness-biased adaptive line 3 + search-mode rendering (reuse shared reads) [CARDV-02/03]

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 28-05-PLAN.md — Long-press context menu (locked 8-item order, routed; no swipe, no Delete/Archive) [CARDV-04]

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 28-06-PLAN.md — Multi-select mode: entry (long-press Select + overflow Select Contacts), top-left circles, control-area lock/replace, Select All over frozen universe, Back-exits-first [CARDV-05/06/12]

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 28-07-PLAN.md — Bulk-action surface + count-aware Log routing (1 individual / 2+ Group Log) + confirm/Undo + Archive-vanish + reduced-motion/a11y [CARDV-07/08/09/10/11/12]

**UI hint**: yes

### Phase 29: Orrery Camera, Scale & Exploration

**Goal**: The Orrery becomes one canonical, explorable 2.5D relationship-health world — a bounded camera, semantic zoom, density presets, built-in Systems, and an accessible companion list — instead of two competing modes.
**Depends on**: Phases 23, 24.2
**Requirements**: ORRC-01, ORRC-02, ORRC-03, ORRC-04, ORRC-05, ORRC-06, ORRC-07, ORRC-08, ORRC-09, ORRC-10, ORRC-11, ORRC-12, ORRC-13, ORRC-14, ORRC-15, ORRC-16
**Success Criteria** (what must be TRUE):

  1. The Orrery presents a single canonical relationship-health visualization — the Status/Relationship split and its toggle removed — that the user can pan, pinch-zoom, bounded-tilt, and yaw around a stable sun-centered world, with billboarded readable avatars/labels, bounded perspective depth, size subtly driven by derived Gravity, and yaw never changing a contact's placement (ORRC-01/02/03)
  2. Home framing fits the whole system while staying comfortably readable and then stops shrinking — large counts grow the world with meaningful minimum ring spacing and the complete All Contacts view is never disabled — and Spacious/Balanced/Compact density presets (Balanced default, persisted) change spacing only, never membership (ORRC-04/05)
  3. Semantic zoom progressively reveals identity and context across three levels with prioritized labels and only small stable deterministic collision nudges; tapping an unambiguous contact focuses and zooms to the name-visible level with a second tap opening the Profile, while ambiguous touches enter Cluster Focus with a framed group and a floating list panel (ORRC-06/07)
  4. Camera state restores on Orrery → Profile → Back within a session but returns to canonical Home on fresh launch and is never persisted; a Polaris landmark yaws with the world and resets yaw only when tapped, Recenter restores the full canonical camera through a bounded distance-adaptive recovery with very restrained inertia, and ring/rank reordering requires a deliberate prolonged stationary hold while ordinary drag pans (ORRC-08/09/10)
  5. User can switch among built-in Systems from a compact dropdown with continuity animation (All Contacts default; All Contacts and Not Contacted including never-contacted contacts at a fixed neutral resting angle with no fabricated progress), toggle Relationship Satellites (default Off) rendering unlinked person-like relationships as status-free moons that disappear once linked, and open an accessible "Contacts in this System" list with focus and open-Profile actions — with Reduced Motion stopping drift, twinkle, and inertia while manual camera control remains (ORRC-11/12/13/14/15/16)

**Canonical refs**: docs/dossier/milestone-2/phase-08-orrery-camera-scale-exploration-dossier.md; docs/dossier/milestone-2/planning-notes/phase-08-planning-notes.md
**Schema**: separate Phase 29 app_settings preference migration (current head20, planned21; recheck head+1 at execution); optional portable keys, current export/version changes remain Phase36
**Plans**: 4/12 plans executed

Plans:


**Wave 1**

- [x] 29-01-PLAN.md — Canonical world and real data-to-interaction tracer

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 29-02-PLAN.md — Durable density, satellite and last-System preferences

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 29-03-PLAN.md — Coherent built-in and Category System selection

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 29-04-PLAN.md — Growing world, density and bounded readable Home

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 29-05-PLAN.md — Shared projected frame, billboard depth and semantic labels

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 29-06-PLAN.md — Measured shell obstacles and reachable controls

**Wave 7** *(blocked on Wave 6 completion)*

- [ ] 29-07-PLAN.md — Camera gestures, Polaris and bounded Recenter

**Wave 8** *(blocked on Wave 7 completion)*

- [ ] 29-08-PLAN.md — Single/group focus and accessible companion

**Wave 9** *(blocked on Wave 8 completion)*

- [ ] 29-09-PLAN.md — Deliberate contacted-only guarded reorder

**Wave 10** *(blocked on Wave 9 completion)*

- [ ] 29-10-PLAN.md — Subordinate relationship satellites

**Wave 11** *(blocked on Wave 10 completion)*

- [ ] 29-11-PLAN.md — Session return, Reduced Motion and race-safe recovery

**Wave 12** *(blocked on Wave 11 completion)*

- [ ] 29-12-PLAN.md — Integrated verification and native evidence handoff

**UI hint**: yes

### Phase 30: Orrery Systems

**Goal**: Users can define, manage, and switch among named Systems — dynamic rules, manual members, or both — authored entirely inside a floating Orrery HUD and preserved by backup.
**Depends on**: Phase 29
**Requirements**: ORRS-01, ORRS-02, ORRS-03, ORRS-04, ORRS-05, ORRS-06, ORRS-07, ORRS-08, ORRS-09, ORRS-10, ORRS-11, ORRS-12, ORRS-13, ORRS-14
**Success Criteria** (what must be TRUE):

  1. User can create a named custom System from dynamic rules (OR within a family, AND across families over the eight supported axes), explicit manual members, or both — manual-only being valid — with manual inclusions durable, exclusions discarded when they stop matching, and Reset Membership Overrides clearing both while keeping the rules (ORRS-01/02)
  2. Built-in and per-Category Systems keep immutable base definitions — not renamable, hideable except All Contacts, override-able with visible indication, and duplicable into editable custom Systems — and renaming a Category renames its generated System while deleting one removes that System and leaves referencing rules visibly needing attention rather than silently rewritten (ORRS-03/04)
  3. System authoring happens in a multi-page floating HUD (name, accordion rule families with summarizing headers, live match count, Manage Members, Save) that is fully operable without touching the canvas, with a searchable virtualized avatar-grid member manager showing rule matches preselected and deselection marking Excluded in place, plus a full-canvas Preview over real layout and the shell's Discard/Keep contract for unsaved changes (ORRS-05/06/07)
  4. Saving a new System switches to it, editing the active one keeps it active, editing a non-active one returns to management without switching, and a flat Systems Management screen reachable from the switcher and Settings supports create/edit/rename/delete/duplicate/reorder/hide-show/override-reset with All Contacts pinned first and nondeletable, unique case-insensitive names, and deletion confirmed with short-lived Undo that never touches contact data (ORRS-08/09/10)
  5. The switcher lists Systems in management order with live counts, hidden Systems omitted, and distinct empty-valid vs broken indicators; the last active System persists across relaunch and switching lands at canonical Home framing preserving a focus present in both; membership deltas animate proportionally with a simple crossfade under Reduced Motion; and backup/restore preserves definitions, rules, overrides, ordering, visibility, and the last-active preference (ORRS-11/12/13/14)

**Canonical refs**: docs/dossier/milestone-2/phase-09-orrery-systems-dossier.md; docs/dossier/milestone-2/planning-notes/phase-09-planning-notes.md
**Schema**: Systems tables (verify head+1 at plan time)
**Plans**: TBD
**UI hint**: yes

### Phase 31: Profile Experience

**Goal**: The Profile becomes a fixed Hero over modular, user-arrangeable sections — with reusable layout and background templates and a Relationship Overview tile grid that explains and adjusts the relationship at a glance.
**Depends on**: Phases 23, 24.2
**Requirements**: PROF-01, PROF-02, PROF-03, PROF-04, PROF-05, PROF-06, PROF-07, PROF-08, PROF-09, PROF-10, PROF-11, PROF-12, PROF-13, PROF-14, PROF-15, PROF-16, PROF-17, PROF-18, PROF-19, PROF-20
**Success Criteria** (what must be TRUE):

  1. Every Profile opens on a fixed Hero — large avatar, name, Category, Favorite, Message, Call, overflow, optional background — that no template restructures, with Message and Call present but disabled and accessibly explained when no usable method exists (PROF-01)
  2. User can reorder, hide/show, and set default expanded state for top-level sections and reorder eligible children within a parent, save reusable named layout and background templates assigned globally / per Category / per contact, and rely on explicit contact assignment outranking Category with inherited presentation following a Category change while explicit overrides survive (PROF-02/03/04/05)
  3. Layout editing is a deliberate mode from Profile overflow that reveals all eligible sections regardless of data, live-previews against a real contact, and requires explicit Save/Cancel — with expanded/collapsed state persisting per contact, template switches clearing prior presentation overrides, and Reset Profile Presentation clearing presentation only, never data, Favorite, Snooze, AI permissions, or knowledge (PROF-06/07)
  4. Below the Hero the factory order is Relationship Overview → Things to Remember → Contact Methods → Interaction History, with enabled empty sections collapsed with a useful summary rather than vanishing; the Relationship Overview auto-packs tiles for Orbit Status, Gravity, Intensity, Last Interaction, Contact Frequency, and Snooze where Status is explanatory-but-not-editable, Gravity and Intensity are never editable, and Contact Frequency and Snooze change directly from their tiles; Contact Methods renders full sets actionable when valid and readable-disabled when malformed; and Interaction History sits behind a replaceable renderer seam Phase 32 upgrades without touching layout persistence (PROF-08/09/10/11/12/13/18)
  5. Things to Remember renders as a one-column configurable section in factory child order with compact cards — blank metadata consuming no space, long content truncating, ~3 items then View All, tap to detail and long-press to Edit/Pin/Hide with no permanent inline edit/delete controls — where hidden items stay recoverable via administration and a Show hidden toggle, Off Limits reads as distinct caution without changing sparkle meaning, Profile overflow lists contact actions before presentation actions with no AI-draft entry, and every state is operable without precise drag and exposed textually (PROF-14/15/16/17/19/20)

**Canonical refs**: docs/dossier/milestone-2/phase-10-profile-experience-dossier.md; docs/dossier/milestone-2/planning-notes/phase-10-planning-notes.md
**Consumes from Phase 24.2** (deferred UI, owner-approved 2026-09-04): the custom-field **value-history backlist** viewer (reads `value-history-dao.ts` / `custom_field_value_history`) and **grouped custom-field rendering** (`custom_field_defs.field_group`). 24.2 shipped these as data-layer only. Confirm at Phase 31 planning whether the Profile is the right surface or a dedicated custom-fields UI phase is needed; if the latter, re-home this note.
**Schema**: profile layout/background templates (verify head+1 at plan time)
**Plans**: TBD
**UI hint**: yes

### Phase 32: Interaction History & Insights

**Goal**: A contact's history becomes explorable and explanatory — an activity heatmap with a Cycles lens, an intensity read over the same window, a Rolodex date browser, and one canonical Interaction Detail/Edit route — replacing the vertical timeline.
**Depends on**: Phases 23, 31
**Requirements**: HIST-01, HIST-02, HIST-03, HIST-04, HIST-05, HIST-06, HIST-07, HIST-08, HIST-09, HIST-10, HIST-11, HIST-12, HIST-13, HIST-14, HIST-15, HIST-16, HIST-17, HIST-18
**Success Criteria** (what must be TRUE):

  1. The Profile History section presents Activity Heatmap, Intensity, and History Browser in place of the vertical timeline, with the heatmap encoding interaction count only — lifecycle and non-interaction records never affecting saturation — and deleting or re-dating an interaction updating the affected bucket (HIST-01/02)
  2. User can switch heatmap lenses among Cycles (default; one block per configured cadence cycle, presets 5/10/15/20 with 10 default, newest bottom-right, current cycle distinguished structurally), 7 Days, Month, and Year with prev/next navigation and future dates blocked, the last-used lens persisting globally as a durable backup-portable preference, and Intensity re-rendering over the same selected window with no prediction (HIST-03/04/05/06)
  3. Tapping a heatmap cell opens a small anchored context card first (count + See details, or 0 + Log interaction) that alone opens the shared detail sheet, and the History Browser's synchronized Month/Day/Year wheels mark eventful dates before selection with counts exposed to accessibility and a drawer offering See details / Log interaction without scrolling ever auto-opening the sheet (HIST-07/08/09)
  4. One shared period/date detail sheet interleaves all records chronologically with semantic icons — editable Interactions, read-only lifecycle events, and history-aware knowledge changes editable per their owning model — where Interaction Detail shows channel, date/time, direction, connected, Tone, optional duration, and note without blank fields plus a sparkle only when that interaction's Allow AI is ON, and one canonical Edit route changes every editable field, rejects future dates, and refreshes derived consumers on save (HIST-10/11/12/14)
  5. Deleting an interaction is a hard delete behind an explicit irreversible confirmation naming derived-metric consequences with no trash subsystem; empty historical dates route into canonical detailed logging with the contact preselected and the date prefilled (never Quick Log); group-linked rows never double-count, show restrained Group Event context, and ask edit scope before an individual override or Edit Group Event; and History is fully usable without color, wheel gestures, or marker iconography with Reduced Motion simplifying wheel depth without removing navigation (HIST-13/15/16/17/18)

**Canonical refs**: docs/dossier/milestone-2/phase-11-interaction-history-insights-dossier-v0.2-group-events.md; docs/dossier/milestone-2/planning-notes/phase-11-planning-notes.md
**Schema**: shared interactions migration with Phase 34 — Tone, channel, duration, Allow AI (owning phase decided once at plan time; verify head+1 at plan time)
**Plans**: TBD
**UI hint**: yes

### Phase 33: Group Interaction Logging

**Goal**: One shared occasion can be logged once and fan out atomically into canonical per-participant interactions — with event-level shared values, per-participant overrides, and a browsable Group Events surface.
**Depends on**: Phases 28, 32
**Requirements**: GRP-01, GRP-02, GRP-03, GRP-04, GRP-05, GRP-06, GRP-07, GRP-08, GRP-09, GRP-10, GRP-11, GRP-12, GRP-13
**Success Criteria** (what must be TRUE):

  1. User can create a Group Event with a required title and date/time where participants are optional and a zero-participant event is valid, and each participant receives exactly one canonical child Interaction while the parent never counts as an additional interaction anywhere (GRP-01/02)
  2. Shared Channel, Tone, and Duration live at event level with live inheritance (Group Log defaulting In Person, Tone and Duration unset, exempt from the ordinary Channel-default preference) and are overridable per participant with an explicit "Follow event…" clear, while date/time and title are never participant-overridable; one shared Group Note is owned by the event, distinct from participant notes, and is never transmitted to AI under any circumstance (GRP-03/04/05)
  3. User can add or remove participants through the shared multi-select picker with no cap — additions after save inheriting current shared values stamped at the event date/time, removals prompting Delete interaction / Keep as individual / Cancel — and can convert an existing ordinary Interaction into a Group Event without it losing its identity, its values seeding the shared defaults (GRP-06/07)
  4. Group Event Detail is presentation-first with participant cards opening child Interaction Detail and a separate focused Edit form, and user can browse Group Events on a lean reverse-chronological page searchable by title and participant, reachable from the Dashboard header and overflow (GRP-08/09)
  5. Dissolve leaves children surviving standalone with materialized values while Delete Group Event & Interactions is permanent — each behind explicit confirmation, with deleting one child affecting only that participant — every fan-out mutation is atomic (complete or fully rolled back with form state preserved) and routes through the canonical recency writers, backdating is supported through now while future dates are rejected, and the whole structure survives backup and restore without flattening (GRP-10/11/12/13)

**Canonical refs**: docs/dossier/milestone-2/phase-12-group-interaction-logging-dossier.md; docs/dossier/milestone-2/planning-notes/phase-12-planning-notes.md
**Schema**: group events (verify head+1 at plan time)
**Plans**: TBD
**UI hint**: yes

### Phase 34: Rapid Capture & Update Flows

**Goal**: Creating a contact, logging an interaction, and updating what Orbit remembers all collapse to the fewest honest taps — with a streamlined Add Contact, a truthful Quick Log that can grow a note or Memory, and an Update Contact chooser loop.
**Depends on**: Phases 24.2, 32, 33
**Requirements**: CAPT-01, CAPT-02, CAPT-03, CAPT-04, CAPT-05, CAPT-06, CAPT-07, CAPT-08, CAPT-09, CAPT-10, CAPT-11, CAPT-12, CAPT-13, CAPT-14, CAPT-15
**Success Criteria** (what must be TRUE):

  1. User can create a contact with Name as the only required field through a streamlined three-section Add Contact with Show More for advanced sections, keeping the tri-state last-spoke control defaulting to today (where "Not yet" creates no interaction) and leaving a contact with no cadence Unbound until one is selected, with Save routing to the new Profile (CAPT-01/02/03)
  2. Edit Contact exposes the complete record as direct-access top-level accordion sections without nesting Things-to-Remember subdomains, and the full Memory creation/editing experience lives in Update Contact's Memory editor with type selected inside and less-common metadata behind More Options (CAPT-04/06)
  3. Quick Log stays immediate and current-time with truthful feedback and Undo, and its success feedback offers Add Note leading to a small post-log editor that saves either an Interaction Note or a Memory — never both — optionally followed by Edit Memory (CAPT-05)
  4. Detailed Log Interaction exposes date/time defaulting to now and freely backdateable without age warnings, Channel limited to Message/Call/In Person with Direction and Connected defaulting per channel, optional Tone (Positive/Neutral/Negative, null by default and never treated as Neutral when omitted), Note, an Allow AI toggle defaulting OFF beside the note, and Duration under More Options — with a Default Interaction Channel preference governing ordinary logging only and Group Log exempt (CAPT-07/08/09/10/11)
  5. Update Contact opens a compact chooser that returns to itself after each save until Done, invoking contexts preselect the contact and History-originated logging prefills that day, failed saves preserve form state and never show completion while validation errors reveal and focus the relevant accordion, and the legacy interaction vocabulary migrates to Tone and the three-channel set with every literal consumer updated in the same change (CAPT-12/13/14/15)

**Canonical refs**: docs/dossier/milestone-2/phase-13-rapid-capture-update-flows-dossier.md; docs/dossier/milestone-2/planning-notes/phase-13-planning-notes.md
**Schema**: shared interactions migration with Phase 32 — Tone, channel, duration, Allow AI (owning phase decided once at plan time; verify head+1 at plan time)
**Plans**: TBD
**UI hint**: yes

### Phase 35: Messaging & AI Compose

**Goal**: Reaching out is a drafting workspace the user owns — a blank composition editor in Text or Email mode, a read-only knowledge Research side, honest external handoff, and an optional three-suggestion AI review that never writes without consent.
**Depends on**: Phases 24.2, 31, 34
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06, COMP-07, COMP-08, COMP-09, COMP-10, COMP-11, COMP-12, COMP-13, COMP-14
**Success Criteria** (what must be TRUE):

  1. Compose opens directly on a blank composition editor with no auto-inserted greeting, AI prose, or prompts, in Text or Email mode initialized from the Settings default with an ad-hoc per-session switch that only updates the remembered mode on Transmit or Copy — Text resolving the primary phone and Email the primary email (with Subject + Body and its own Subject copy affordance), falling back to the usable mode and staying usable for drafting and Copy when no destination exists (COMP-01/02/03/04)
  2. Transmit hands the composition to the external composer and never claims delivery; returning can show a compact "Did you send it?" where only "Yes, log interaction" writes the canonical Message interaction, "Not yet" preserves the session, Copy never triggers it, and the app-global durable assist banner and pending sheet continue to work alongside it with the interaction stamped at handoff time (COMP-05/06)
  3. Compose session state — body, subject, mode, destination, and Message Focus — survives in-app navigation and ordinary backgrounding but is explicitly not a durable draft (no drafts table, no backup contract) (COMP-07)
  4. User can open Things to Remember Research as a sibling full-screen side showing a compact read-only projection of only populated conversation-relevant knowledge with no add/edit actions, mark up to three AI-authorized items Add to AI as session-only Message Focus shown compactly on the Compose side (never granting permission), and see Off Limits in a distinct Avoid presentation that can never be Message Focus and passes to AI only as an avoidance constraint (COMP-08/10/11)
  5. One adaptive AI action offers Draft with AI or Rewrite with AI, returning three unlabeled varied suggestions on a non-destructive review surface that changes the editor only on explicit "Choose this" with Try Again replacing the set; generation is cancellable and failure-safe with the manual draft preserved, the three AI states (Off / On+Ready / On+Needs Attention) are honored without silently hiding AI, manual composition and Research work in every state, and Compose is deep-link-ready and origin-aware, leaving no finished draft in Back history (COMP-09/12/13/14)

**Canonical refs**: docs/dossier/milestone-2/phase-14-messaging-ai-compose-dossier.md; docs/dossier/milestone-2/planning-notes/phase-14-planning-notes.md
**Schema**: compose preferences (verify head+1 at plan time)
**Plans**: TBD
**UI hint**: yes

### Phase 36: AI Configuration & Prompting

**Goal**: AI becomes an explicit, user-owned capability — three connection lanes, a real global switch, personalization the user controls, a permission model that decides exactly what leaves the device, and the milestone's closing backup wire-format bump (**now v5** — v4 landed early in 24.1, see the migration-ordering amendment; the exact target/mechanics are a Phase 36 plan-time decision).
**Depends on**: Phases 24.2, 32, 33, 34, 35 — and every schema-bearing phase of the milestone, because this phase ends the milestone's schema chain with the backup format bump
**Requirements**: AICFG-01, AICFG-02, AICFG-03, AICFG-04, AICFG-05, AICFG-06, AICFG-07, AICFG-08, AICFG-09, AICFG-10, AICFG-11, AICFG-12, AICFG-13, AICFG-14, AICFG-15, AICFG-16, AICFG-17
**Success Criteria** (what must be TRUE):

  1. A real global AI Enabled master toggle disables AI generation everywhere while preserving connections, credentials, models, personalization, and permissions — turning it back on restores immediately when still valid, and a credential-management escape hatch remains available while AI is off (AICFG-01)
  2. User can configure three connection lanes — OpenRouter (recommended, browser-authorized, with an Orbit-owned curated-first model picker showing real current/cached pricing and daily/manual catalog refresh), direct BYOK, and an OpenAI-compatible HTTPS custom endpoint — with exactly one active connection, stored inactive configurations, a new lane activating only on success, and Orbit never silently substituting a model or connection (an unavailable selection becomes an explicit Needs Attention state with repair actions) (AICFG-02/03/04/05)
  3. Orbit owns an immutable system/output prompt contract that user personalization layers onto through structured Writing Style controls and ordered enableable Personalization Context sections, with no artificial context ceiling or silent truncation, exposed token/context and OpenRouter cost estimates, explicit surfacing of true model-capacity overflow, and an Adjust flow that is ephemeral per session and never changes persistent Writing Style (AICFG-06/07/09)
  4. What is transmitted is exactly what the permission model authorizes — AI-permitted knowledge included automatically per contact, Message Focus adding emphasis without changing permission, AI-enabled Off Limits transmitted only as avoidance constraints, the three most recent Interactions included only where that interaction's Allow AI is ON, and Group Notes never — governed by a central permission manager (new-item type defaults OFF and new-items-only, searchable review, contact drill-in, bulk disable, bulk enable only behind explicit impact confirmation, Group Notes never surfaced), inspectable and previewable in Settings without ever showing credentials, and disclosed once on first successful setup with the exact-prompt first-send acknowledgement retired (AICFG-08/10/11/12)
  5. Failures translate to human-readable categories that preserve Compose state and never fail over silently, emitting sanitized structured diagnostics carrying only safe metadata; credentials stay in secure storage and out of app settings and backups while nonsecret personalization, configuration, and permissions are preserved so a restored install never falsely appears Ready; and the backup wire format bumps to its closing version (v5 — v4 landed early in 24.1; see migration-ordering amendment) as this phase's FINAL plan — after all other milestone schema — serializing every entity and portable preference the milestone added, with restore validation, orphan repair including Phase 33's Group Event rules, and a decided restore-compat behavior for every retired key (AICFG-13/14/15/16/17)

**Canonical refs**: docs/dossier/milestone-2/phase-16-ai-configuration-prompting-dossier.md; docs/dossier/milestone-2/planning-notes/phase-16-planning-notes.md
**Schema**: AI configuration tables/columns, then the **final backup wire-format bump as the phase's last plan** (now v5 — v4 landed early in 24.1; see migration-ordering amendment; verify head+1 and the current `BACKUP_FORMAT_VERSION` on disk at plan time)
**Consumes from Phase 24.2** (deferred code cleanup, planner-noted 2026-09-04): remove the now-inert legacy AI-proposed-fuel confirm path retired by ADR-081 — `confirmFuel`/`confirmFuelCore` (fuel-dao.ts:214/282), its Profile handler + import (ContactProfileScreen.tsx:70/705), and the FuelEditor AI-unconfirmed render + Confirm/Dismiss control. 24.2 landed the data + ADR half (migration 017 removed all `source='ai'` rows; ADR-081 supersedes ADR-030) but deliberately left the shipped UI code in place; it is inert (no producer writes `source='ai'`) but a latent revival surface this permission-manager phase should delete.
**Plans**: TBD
**UI hint**: yes

### Phase 37: Settings & Personalization

**Goal**: Consolidate the preference and administration seams exported by Phases 22–36 into one coherent, discoverable Settings experience.
**Depends on**: Executed Phases 22–35 (it consolidates what they actually shipped)
**Requirements**: None yet — deferred planning
**Success Criteria**: Defined at planning time
**Canonical refs**: docs/dossier/milestone-2/planning-notes/phase-15-17-18-stub-contracts.md
**Plans**: TBD

> **Deferred planning — interrogated later against the implemented product; do not plan or discuss yet.**

### Phase 38: Your Week

**Goal**: A weekly surface that owns the relocated birthday presentation (ADR-076), Group Event rollups, and reuse of the heatmap aggregation built in Phase 32.
**Depends on**: Phases 32, 33, 36
**Requirements**: None yet — deferred planning
**Success Criteria**: Defined at planning time
**Canonical refs**: docs/dossier/milestone-2/planning-notes/phase-19-your-week-placeholder.md
**Plans**: TBD

> **Deferred planning — interrogated later against the implemented product; do not plan or discuss yet.**

### Phase 39: Onboarding

**Goal**: First-run setup and teaching designed against the real, implemented product rather than an imagined one.
**Depends on**: Substantive implementation of the milestone, including Phases 37 and 38
**Requirements**: None yet — deferred planning
**Success Criteria**: Defined at planning time
**Canonical refs**: docs/dossier/milestone-2/planning-notes/phase-15-17-18-stub-contracts.md
**Plans**: TBD

> **Deferred planning — interrogated later against the implemented product; do not plan or discuss yet.**

### Phase 40: Responsive & Release Hardening

**Goal**: A device, accessibility, and performance audit pass that brings the whole app to a quality suitable for outside beta testers.
**Depends on**: All prior phases
**Requirements**: None yet — deferred planning
**Success Criteria**: Defined at planning time
**Canonical refs**: docs/dossier/milestone-2/planning-notes/phase-15-17-18-stub-contracts.md
**Plans**: TBD

> **Deferred planning — interrogated later against the implemented product; do not plan or discuss yet.**

## Progress

**Execution Order:** Phases execute sequentially in numeric order: 22 → 23 → … → 40. Parallelization is off.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 22. App Shell & Navigation | 6/6 | In Progress|  |
| 23. Theme & Visual System | 7/7 | In Progress | - |
| 24.1 Contact Knowledge Foundation (Model, Storage & UI) | 7/8 | In Progress|  |
| 24.2 Contact Knowledge (Egress, Search, Types & Data-moves) | 7/7 | In Progress|  |
| 25. Dashboard Data & State Foundation | 6/7 | In Progress|  |
| 26. Dashboard Control Surface | 7/7 | In Progress|  |
| 27. Dashboard List View | 8/8 | Complete | 2026-09-06 (owner-approved; UAT partial) |
| 28. Dashboard Card View | 8/8 | In Progress|  |
| 29. Orrery Camera, Scale & Exploration | 4/12 | In Progress|  |
| 30. Orrery Systems | 0/TBD | Not started | - |
| 31. Profile Experience | 0/TBD | Not started | - |
| 32. Interaction History & Insights | 0/TBD | Not started | - |
| 33. Group Interaction Logging | 0/TBD | Not started | - |
| 34. Rapid Capture & Update Flows | 0/TBD | Not started | - |
| 35. Messaging & AI Compose | 0/TBD | Not started | - |
| 36. AI Configuration & Prompting | 0/TBD | Not started | - |
| 37. Settings & Personalization | 0/TBD | Deferred planning | - |
| 38. Your Week | 0/TBD | Deferred planning | - |
| 39. Onboarding | 0/TBD | Deferred planning | - |
| 40. Responsive & Release Hardening | 0/TBD | Deferred planning | - |

**Requirement coverage:** 217/217 v2.0 requirements mapped across Phases 22–36 — no orphans, no duplicates.
Phases 37–40 carry no requirements by design; theirs are defined when they are interrogated.

---
*Roadmap created 2026-09-02 for milestone v2.0 Release Readiness.*
