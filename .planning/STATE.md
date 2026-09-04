---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Release Readiness
current_phase: 24.2
current_phase_name: Contact Knowledge — Egress, Search, Types & Data-moves
status: executing
stopped_at: Completed 24.2-06-PLAN.md
last_updated: "2026-09-04T19:42:06.052Z"
last_activity: 2026-09-04
last_activity_desc: Phase 24.2 execution started
state_head: 29b9bd783ff344ff6568fc2dc3d72d27aef71350
progress:
  total_phases: 20
  completed_phases: 1
  total_plans: 29
  completed_plans: 27
carried_forward:

  - "D-11: default Memory-type display name is provisional (memory-registry.ts:10-12) — owner naming decision, must be reconciled before Phase 34"
  - "UI-REVIEW warnings (non-blocking): accent→accentText token misrole (8 sites); Add-memory CTA uses hand-rolled link vs Button primitive; ContactPicker/Snackbar off type/spacing scale — triage fix-now vs fold into 24.2"

---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-01 after v1.0 milestone)

**Core value:** Collapse the taps between "you're overdue with X" and the message actually being sent.
**Current focus:** Phase 24.2 — Contact Knowledge — Egress, Search, Types & Data-moves

## Current Position

Phase: 24.2 (Contact Knowledge — Egress, Search, Types & Data-moves) — EXECUTING
Plan: 7 of 7
Status: Ready to execute
Carried forward (owner's bucket, NOT resolved here): D-11 default Memory-type display name — reconcile before Phase 34.
Deferred to Phase 31 (recorded in Plan 05): durable contact-scoped-def ownership + owner-purge semantics. Deferred to Phase 36 (ROADMAP breadcrumb): legacy AI-fuel confirm-path code removal.
Last activity: 2026-09-04 — Phase 24.2 execution started
Progress: 3/19 phases complete (v2.0) — 22, 23, 24.1
Next: `/gsd-execute-phase 24.2` when ready.

**Milestone v2.0 structure (pre-decided by the owner from the fifteen milestone-2 dossiers + the
2026-09-01 cross-dossier audit; not re-derived):** 22 App Shell · 23 Theme · 24 Contact Knowledge ·
25 Dashboard Data/State · 26 Dashboard Controls · 27 List View · 28 Card View · 29 Orrery Camera ·
30 Orrery Systems · 31 Profile · 32 History & Insights · 33 Group Logging · 34 Rapid Capture ·
35 Compose · 36 AI Config (ends the milestone schema chain with the backup v4 bump) ·
37–40 deferred planning (Settings, Your Week, Onboarding, Release Hardening).
Migration order is milestone-wide (schema → consumers → backup v4 last); **never** write a literal
migration number — each phase verifies head+1 against `src/db/migrations/` + `TARGET_VERSION` on disk
at plan time. All new durable preferences are `app_settings` columns, never AsyncStorage.

## Performance Metrics

**Velocity:**

- Total plans completed: 32
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 5 | - | - |
| 2 | 6 | - | - |
| 3 | 8 | - | - |
| 22 | 6 | - | - |
| 23 | 7 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 1 P01 | 8min | 3 tasks | 26 files |
| Phase 01 P02 | 3min | 3 tasks | 8 files |
| Phase 01 P03 | 3min | 3 tasks | 8 files |
| Phase 01 P04 | 5min | 3 tasks | 3 files |
| Phase 01 P05 | 26min | 2 tasks | 7 files |
| Phase 02 P01 | 3min | 2 tasks | 5 files |
| Phase 02 P02 | 4min | 3 tasks | 4 files |
| Phase 02 P03 | 5min | 2 tasks | 4 files |
| Phase 02 P04 | 8min | 2 tasks | 4 files |
| Phase 02 P05 | 3min | 2 tasks | 3 files |
| Phase 02 P06 | 45min | 3 tasks | 3 files |
| Phase 03 P01 | 4min | 3 tasks | 7 files |
| Phase 03 P02 | 2min | 2 tasks | 4 files |
| Phase 03-custom-fields P03 | 4 min | 2 tasks | 4 files |
| Phase 03-custom-fields P04 | 8min | 2 tasks | 2 files |
| Phase 03 P05 | 12min | 2 tasks | 2 files |
| Phase 03-custom-fields P06 | 3min | 2 tasks | 10 files |
| Phase 03-custom-fields P07 | 12min | 2 tasks | 4 files |
| Phase 3 P8 | 5min | 3 tasks | 3 files |
| Phase 04 P01 | 5min | 4 tasks | 8 files |
| Phase 04 P02 | 3 | 3 tasks | 6 files |
| Phase 04 P03 | 9min | 3 tasks | 9 files |
| Phase 04 P05 | 20min | 3 tasks | 4 files |
| Phase 04 P04 | 12min | 2 tasks | 5 files |
| Phase 04 P06 | 20min | 1 tasks | 4 files |
| Phase 04 P07 | 8min | 3 tasks | 7 files |
| Phase 04 P08 | 5min | 3 tasks | 6 files |
| Phase 04 P09 | 20min | 2 tasks | 3 files |
| Phase 05 P02 | 15min | 3 tasks | 7 files |
| Phase 05 P03 | 10 min | 2 tasks | 7 files |
| Phase 05-photos P04 | 4min | 2 tasks | 3 files |
| Phase 05-photos P07 | 6min | 2 tasks | 3 files |
| Phase 05-photos P05 | 15min | 2 tasks | 5 files |
| Phase 05-photos P06 | 4min | 2 tasks | 4 files |
| Phase 05-photos P08 | 14min | 2 tasks | 8 files |
| Phase 6 P01 | 10min | 2 tasks | 5 files |
| Phase 06 P02 | 12min | 3 tasks | 10 files |
| Phase 06 P03 | 7min | 3 tasks | 7 files |
| Phase 06 P04 | 5min | 3 tasks | 8 files |
| Phase 06 P05 | 18min | 3 tasks | 7 files |
| Phase 06 P06 | 6min | 2 tasks | 5 files |
| Phase 06 P06 | 6min | 2 tasks | 5 files |
| Phase 07 P03 | 5min | 2 tasks | 4 files |
| Phase 07 P04 | 3min | 2 tasks | 7 files |
| Phase 08 P01 | 25min | 2 tasks | 4 files |
| Phase 08 P02 | 4min | 1 tasks | 2 files |
| Phase 08 P03 | 4min | 2 tasks | 4 files |
| Phase 08 P04 | 6min | 3 tasks | 3 files |
| Phase 08 P05 | 2min | 2 tasks | 3 files |
| Phase 08 P06 | 2min | 2 tasks | 4 files |
| Phase 08 P08 | 4min | 2 tasks | 4 files |
| Phase 08 P07 | 6min | 2 tasks | 3 files |
| Phase 08 P09 | 18min | 3 tasks | 1 files |
| Phase 08 P10 | 2min | 2 tasks | 3 files |
| Phase 09 P01 | 3min | 3 tasks | 6 files |
| Phase 09 P02 | 10min | 3 tasks | 5 files |
| Phase 13 P01 | 7min | 2 tasks | 6 files |
| Phase 13 P02 | 5min | 2 tasks | 4 files |
| Phase 13 P03 | 5min | 3 tasks | 6 files |
| Phase 13 P04 | 6min | 3 tasks | 7 files |
| Phase 13 P05 | 25min | 3 tasks | 9 files |
| Phase 13 P07 | 14min | 3 tasks | 6 files |
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 17 P01 | 20min | 3 tasks | 3 files |
| Phase 17 P02 | 6m 20s | 3 tasks | 11 files |
| Phase 17 P03 | 4 | 2 tasks | 7 files |
| Phase 17 P04 | 6min | 2 tasks | 5 files |
| Phase 17 P12 | 6min | 2 tasks | 4 files |
| Phase 17-backup-export-restore P08 | 2h 4m | 3 tasks | 20 files |
| Phase 17-backup-export-restore P09 | 1h 20m | 2 tasks | 14 files |
| Phase 17-backup-export-restore P10 | 10min | 2 tasks | 8 files |
| Phase 18.1 P01 | 11 min | 3 tasks | 17 files |
| Phase 18.1 P02 | 15min | 2 tasks | 9 files |
| Phase 18.1 P03 | 21min | 4 tasks | 24 files |
| Phase 18.1 P04 | 17m | 3 tasks | 13 files |
| Phase 18.1 P05 | 6min | 1 tasks | 6 files |
| Phase 18.2 P01 | 9min | 1 tasks | 6 files |
| Phase 18.2 P02 | 7min | 2 tasks | 4 files |
| Phase 18.2 P03 | 17min | 2 tasks | 14 files |
| Phase 18.2 P04 | 4min | 2 tasks | 6 files |
| Phase 18.2-bound-unbound-lifecycle P05 | 4min | 2 tasks | 9 files |
| Phase 18.2 P06 | 7min | 4 tasks | 14 files |
| Phase 18.2-bound-unbound-lifecycle P07 | 10min | 3 tasks | 24 files |
| Phase 18.2 P08 | 9min | 3 tasks | 12 files |
| Phase 18.2 P09 | 4min | 2 tasks | 7 files |
| Phase 19.1 P01 | 6min | 2 tasks | 14 files |
| Phase 19.1 P02 | 5m 34s | 3 tasks | 12 files |
| Phase 19.1 P03 | 9min | 3 tasks | 11 files |
| Phase 19.1-older-android-contact-picker-hybrid-two-picker-adr-002 P04 | 6min | 3 tasks | 6 files |
| Phase 22-app-shell-navigation P01 | 16m | 2 tasks | 17 files |
| Phase 22 P02 | 8m | 3 tasks | 7 files |
| Phase 22-app-shell-navigation P03 | 31m | 3 tasks | 11 files |
| Phase 22-app-shell-navigation P04 | 13m | 3 tasks | 12 files |
| Phase 22 P05 | 10m | 3 tasks | 11 files |
| Phase 22 P06 | 13m | 3 tasks | 12 files |
| Phase 23 P01 | 45m | 1 task | 25 files |
| Phase 23 P02 | 20m | 3 tasks | 13 files |
| Phase 23 P03 | 16m | 3 tasks | 9 files |
| Phase 23 P04 | 8m | 2 tasks | 4 files |
| Phase 23 P05 | 8m | 2 tasks | 8 files |
| Phase 23 P06 | 14m | 3 tasks | 15 files |
| Phase 23 P07 | 12m | 2 tasks | 8 files |
| Phase 24.1 P01 | 14min | 3 tasks | 14 files |
| Phase 24.1 P02 | 4min | 3 tasks | 4 files |
| Phase 24.1-contact-knowledge-foundation P03 | 6min | 3 tasks | 8 files |
| Phase 24.1 P04 | 7min | 3 tasks | 6 files |
| Phase 24.1 P05 | 9min | 3 tasks | 7 files |
| Phase 24.1 P06 | 8min | 3 tasks | 7 files |
| Phase 24.1 P07 | 8m 30s | 3 tasks | 8 files |
| Phase 24.2 P01 | 9min | 3 tasks | 17 files |
| Phase 24.2 P02 | 6m | 2 tasks | 4 files |
| Phase 24.2 P03 | 7min | 3 tasks | 9 files |
| Phase 24.2 P04 | 5min | 2 tasks | 7 files |
| Phase 24.2 P05 | 12min | 3 tasks | 28 files |
| Phase 24.2 P06 | 15min | 2 tasks | 14 files |

## Accumulated Context

### Roadmap Evolution

- **v2.0 Release Readiness (2026-09-02):** Phases 22–40 added, continuing the project-wide numbering
  from v1.0's Phase 21. Structure is owner-decided from `docs/dossier/milestone-2/` (fifteen dossiers)
  and the audit bridge `AUDIT-HANDOFF.md`; ADR-075–080 record the ratified reversals. Phases 37–40 are
  deferred-planning slots — do not plan or discuss them until the product they consolidate exists.

- Phases 18–21 added after Phase 17: Contact Data Normalization → System Contact Import → Contact Reconciliation & Merge → Interaction Assist & Reach Out. Their externally completed product discussion is captured in the corresponding phase CONTEXT.md files and canonical dossiers.
- Phase 19.1 inserted after Phase 19: Older-Android hybrid two-picker (ADR-002) (URGENT)

### Decisions

Decisions are logged in PROJECT.md Key Decisions table, and authoritatively in docs/dossier/ + HANDOFF.md.
Foundational decisions affecting current work:

- The dossier (docs/dossier/, 21 domains + INDEX cross-domain constraint log) and HANDOFF.md are the
  authoritative decision record; `[DECIDED]`/`[REJECTED]` items are implemented, not reopened.

- Config: fine granularity (21 phases, one per domain), Vertical MVP, sequential execution (YOLO,
  quality models, research/plan-check/verifier/nyquist/source-grounding on, worktrees off).

- [Phase 1]: 01-01: app.config.ts dedupes the expo-sqlite plugin (expo install pre-populated app.json's plugins array) to avoid a duplicate-plugin prebuild error
- [Phase 1]: 01-01: shared check-colors.sh gate lands now (npm check:colors); first enforced in 01-03 when App.tsx's template #fff becomes the themed shell
- [Phase 01]: 01-04: AiService ported onto fetch with explicit response.ok guards before every await response.json(); Obsidian-decoupled via local AiSettings interface; dormant (no screen wired)
- [Phase 01]: 01-04: Ollama/local-LAN provider OMITTED entirely (owner decision) — no http:// cleartext path in src/; id union named AiProviderId to avoid TS2440 vs ported interface AiProvider
- [Phase 02]: runMigrations canonical 4-arg signature (exec, migrations, targetVersion, deps); deps required and threaded into every migration.apply
- [Phase 02]: Migration runner sets no bootstrap PRAGMA — WAL/foreign_keys/busy_timeout are the caller's job (Plan 02 openAndMigrate)
- [Phase 02]: user_version bump interpolated as integer literal (never bound), guarded by Number.isInteger
- [Phase 02]: Migration 1 freezes all ten tables + every un-backfillable column from day one (irreversible on unreachable devices)
- [Phase 02]: fuel table ships empty in migration 1 (owner decision); custom-fields tables ship, logic is Phase 3; index/UNIQUE ban is value-column-scoped so uid UNIQUE autoindex stays
- [Phase ?]: 02-05: AppState is dependency-injected into launch-sweep (not statically imported) so the module is node-testable and App.tsx owns the sole react-native binding
- [Phase ?]: 02-05: launch sweep fires only on a tracked background->active transition (not any raw active) and installs only after openAndMigrate() resolves — correcting two review MEDIUMs
- [Phase ?]: col_name is whitelist-CONSTRUCTED at a single chokepoint (col-name.ts); slugify guarantees [a-z][a-z0-9_]* and never escapes user text
- [Phase ?]: RESERVED_COLUMN_NAMES is drift-guarded by a node:sqlite test asserting whitelist superset-of live schema
- [Phase ?]: Single shared inWriteTransaction (src/db/transaction.ts) imported not copied; non-reentrancy documented in-file (review HIGH-1)
- [Phase ?]: Drop logic split into a non-mutexed core (dropFieldColumns) composed by dropField, deleteOrQuarantineField, and expireFieldIfStale — never nesting the non-reentrant mutex (HIGH-1)
- [Phase ?]: expireFieldIfStale re-verifies quarantined_at under the lock (strict < window) so a field restored after the sweep's scan survives (review cycle-2 TOCTOU)
- [Phase ?]: Every custom-field def writer runs in its own inWriteTransaction — completes the every-writer-through-the-shared-mutex contract
- [Phase ?]: 03-04: upsertValue runs inside the shared inWriteTransaction (serialized with DDL/sweep), keyed on contact_id; uid is the per-contact ROW uid, written on INSERT only
- [Phase ?]: 03-04: custom-field visibility — profile=value-present OR always_show, create=show_on_new, edit=all non-quarantined; quarantined hidden everywhere (§14.7)
- [Phase 03]: Type change is ONE UPDATE custom_field_defs SET type + same-txn field_history snapshot; contact_custom_values value bytes never rewritten (FLD-04, T-03-02) — §14.2 blast-radius-zero invariant; unconvertible values flagged at read time, never coerced or cleared
- [Phase ?]: Custom-field value widgets stay controlled over TEXT storage; canonicalisation/flagging lives in the parser layer, not the UI (T-03-04)
- [Phase ?]: Dropdown built from Pressable+Modal+FlatList (zero picker deps); modal scrim is colors.background at opacity to avoid a colour literal
- [Phase ?]: Tap-to-fix error emphasis composed from accent+borderStrong; no dedicated error token yet (owner may add at --to 3 gate)
- [Phase ?]: Plan 07: launch field sweep calls expireFieldIfStale directly (no re-wrap) — HIGH-1 deadlock guard; bare candidate scan narrows, under-lock re-check decides the drop (sweep-TOCTOU); history prune inside inWriteTransaction on the 30-day schedule
- [Phase 3]: Plan 03-08: the pre-flight summary Alert is the single confirmation (§14.4) — no separate second prompt
- [Phase 3]: Plan 03-08: FieldDefForm emits an edit-draft delta; CustomFieldsScreen diffs it and routes each change to the matching DAO op
- [Phase 3]: Plan 03-08: reachability is a dependency-free HomeScreen route useState (no navigation library); Phase 4 relocates it into Settings
- [Phase 4]: 04-01: react-navigation native-stack is the app shell (headerShown:false — each screen owns its Back chrome); Android system Back walks the stack (predictive-back off)
- [Phase 4]: 04-01: RootStackParamList is a type alias (not interface) to satisfy createNativeStackNavigator's ParamListBase; not-yet-built routes register themed placeholders swapped by later plans
- [Phase 4]: 04-01: Settings hosts two rows (Custom Fields, Archived) not three — UI-SPEC 'Custom Fields' and 'Reachability' name the same CustomFieldsScreen; CustomFieldsScreen wired via a goBack() wrapper, DAO logic untouched
- [Phase 4]: 04-01: danger token #E5484D landed in wave 1 (ThemePalette + space-dark preset), relocated from Plan 09; Plans 03/04/06/09 consume colors.danger, none re-adds it
- [Phase ?]: 04-02: createContactFull composes non-mutexed cores in ONE transaction (never nests the non-reentrant mutex); phone in the create INSERT (CRUD-01); future occurredAt rejected pre-transaction (CRUD-02)
- [Phase 04]: 04-03: FrequencyPicker + TriStateLastSpoke built as controlled RN components; correctness-critical validation (interval>0 integer; future-date rejection) extracted into react-native-free logic modules so it is unit-tested in the node/.test.ts Vitest harness the .tsx files cannot load under (17 new cases)
- [Phase 04]: 04-03: TriStateLastSpoke is purely controlled (no internal default overriding value); consumers seed create=Today / edit-never-contacted=Not yet. Native picker has no maximumDate so a future pick still fires onChange and shows the locked rejection copy. datetimepicker config plugin registered in app.config.ts for the deferred desktop prebuild
- [Phase ?]: 04-05: updateContactFull edits every contacts column except last_contact; recency moves only via recomputeLastContactCore in the same txn on a rarely_responds flip (Pitfall 2)
- [Phase ?]: 04-05: first-interaction-on-edit honoured only when stored last_contact IS NULL; already-contacted rejects (Phase 6 owns timeline edits); getContactForEdit by-id seek stays archived-reachable by design
- [Phase ?]: 04-04: create-form input shaping extracted to node-tested create-contact-logic.ts (canSave gate + buildCreateInput); .tsx screens are device-UAT — the repo's -logic.ts convention
- [Phase ?]: 04-04: native category Picker uses a 'No category' sentinel (-1) mapped back to null on change, keeping category nullable without a custom modal
- [Phase ?]: 04-07: contact_links persistence = editor draft state + one applyLinkDiff(seeded, current) on Save (all-or-nothing-on-cancel, a38c763); never immediate-per-row writes
- [Phase ?]: 04-07: link-open uses a POSITIVE https?:// allowlist (dot-free scheme strip + https:// re-prefix) — file://, intent://, javascript:// never handed to Linking.openURL as typed (T-04-09); no canOpenURL/queries manifest
- [Phase ?]: 04-07: two-transaction save (updateContactFull then applyLinkDiff); partial-save re-seeds metadata, keeps linksDraft, stays on form, explicit partial-save copy
- [Phase 04]: 04-08: archive/restore are metadata-only archived_at UPDATEs (assertOneChange, last_contact untouched); listArchived is the sole inverse read (archived_at IS NOT NULL); by-id getContactHeader/getContactForEdit seeks stay archived-reachable by design — no NEW unfiltered live/list surface
- [Phase 04]: 04-08: restore is a pure flag flip in v1 (RESEARCH-A3 events-row DEFERRED — no events writer/type vocabulary in src); no auto-purge sweep registered (retention INDEFINITE per UI-SPEC); Archive on profile ⋯ (reversible, low-emphasis), Restore only on the Archived list — purge (Plan 09) never one tap from the reversible action
- [Phase 04]: purgeContact asserts archived_at IS NOT NULL and exactly-one-row-deleted inside its transaction — the archive→purge two-stage safety is enforced at the write boundary, not just UI routing
- [Phase 04]: Purge non-DB cleanup (photo unlink, notification cancel) runs POST-COMMIT via an idempotent onPurgeExtensions adapter (Phases 5/11 register it) — never awaited inside the SQLite transaction/mutex
- [Phase 05]: 05-04: crop-geometry.ts is PURE + node-tested (cropRectFromTransform → clamped source-pixel rect); its in-file header is the binding CONTRACT (input units + centre-origin convention, positive tx reveals source LEFT) the 05-05 crop screen's geometry init must match; only the visual convention stays for on-device UAT (Assumption A1)
- [Phase 05]: 05-04: photo-pipeline.persistCroppedMaster crops the ORIGINAL rawUri via expo-image-manipulator (crop→resize 512→JPEG q0.75), never a Skia makeImageSnapshot; copies out of evictable cache via Plan 02's crash-safe persistMaster (no pre-delete added); returns the RELATIVE path only and imports NO DAO (caller owns the write); decode failures throw PhotoPipelineError mapped to the SPEC copy
- [Phase 05]: 05-05: CropPhotoScreen is the repo's first Skia render-loop surface — pan/pinch 1:1 crop with the transform driven ONLY by Reanimated shared values via useDerivedValue (no per-frame setState, no makeImageSnapshot); one-time geometry init from the decoded image dims + a screen-width-derived viewport (baseScale=viewport/min(srcW,srcH)); Use photo → cropRectFromTransform → persistCroppedMaster → per-kind DAO write + bumpPhotoCacheBust; A4 decode-failure downscale feeds ONE uri to both preview geometry and pipeline crop
- [Phase 05]: 05-05: PhotoSourcePicker is the single target-kind-aware Add/Change/Remove for contact/profile/customField (system Photo Picker, no runtime permission); a pick threads requestId (= derivable cv- relPath) ONLY for customField; Remove switches on target.kind and deletes the correct derivable file inline (no contactId deref on profile). CropPhoto route params are serializable-only (target descriptor + string requestId, no callbacks)
- [Phase 05]: 05-05: EditContactScreen holds photo as SEPARATE screen state (NOT EditFormState; edit-contact-logic.ts intentionally untouched — metadata Save omits photo per RESEARCH Pitfall 6); a photo-only useFocusEffect getContactHeader re-read refreshes the avatar after crop WITHOUT reseeding/discarding unsaved form edits
- [Phase 05]: 05-07: purge photo cleanup (buildPhotoPurgeCleanup) is the onPurgeExtensions adapter — POST-COMMIT it rebuilds filenames from contactId alone (rows already deleted): main contact-<id>.jpg + one cv-<id>-<col>.jpg per surviving photo def. listDefs(exec, { includeQuarantined: true }) is REQUIRED so a purge during a photo field's quarantine window still deletes its cv- file (PHOTO-05, no leak); idempotent + internally error-resilient; registered at the Archived-list purge without touching the two-stage guard
- [Phase 05]: 05-06: url-image.downloadImageToCache uses fetch (NOT File.downloadFileAsync — it exposes neither headers nor the final redirect URL); isImageUrl is an https-ONLY scheme allowlist (extension NOT required — image/* content-type is the authoritative gate) applied to BOTH the submitted URL and the redirect-resolved response.url; byte cap is stream-enforced (reader.cancel at cap) with an absent/invalid/over-cap content-length up-front + post-read re-verify fallback; bytes land in the evictable cache subdir, never the document dir; the raw cache uri then feeds the identical crop pipeline (one-time WRITE, no read-path network). Settings "Your photo" seeds from getProfile with a stable 'You' fallback (never a blank swatch), reloads on focus, and reuses Plan 05's profile-target Remove (no Settings-side Remove, no contactId)
- [Phase 06]: 06-05: gravity is DERIVED-NEVER-STORED (no column, no write) — computeGravity is a pure age-decay-toward-a-floor weighted sum (weight = FLOOR_W + (1-FLOOR_W)·2^(-ageDays/HALF_LIFE_DAYS)) → highest tier whose threshold ≤ raw; monotone in recency, superset-never-lowers, floor-never-zero. Tunables (HALF_LIFE_DAYS=365, FLOOR_W=0.15, 4 GRAVITY_TIERS thin=0/building=3/solid=8/deep=18) top-of-file in impact.ts (owner-approved-tunable). getImpactInputs is the SINGLE read feeding gravity + intensity (same rows). computeContactGravity mirrors recency's connected filter (rarely_responds → connected rows only); direction is NOT a gravity input. GravityBar shows tier NAME + tier-discrete bar (never raw), fill via colors.gravityTiers[tierIndex] (clamped), track colors.border; profile-only, hidden until interaction history exists
- [Phase 06]: 06-06: intensity is DERIVED-NEVER-STORED, PROFILE-ONLY, and NEUTRAL — computeIntensity (pure, react-native-free, node-tested) counts direction outbound|mutual within one interval-length (INTENSITY_PERIOD_DAYS = interval_days via intensityPeriodDays(), A3 owner-approved), rarely_responds=1 additionally requires connected=1 (mirrors recency/gravity); inbound-only volume never raises currentCount. trailingAvgGapDays = mean consecutive gap over ALL qualifying history, SORTED ASCENDING before differencing (getImpactInputs delivers DESC), null when <2 rows (no divide-by-zero). computeContactIntensity orchestrates in impact.ts from the SAME getImpactInputs read gravity uses. IntensityLine renders a neutral rate + intended-frequency + trailing-average via colors.textPrimary/textSecondary ONLY (no danger/warning, no gravityTiers/rogue tokens), trailing clause omitted when null, neutral empty state; rendered BESIDE GravityBar in contact-profile-impact, never blended. Completes LOG-03 (both halves) and Phase 6 code
- [Phase 06]: 06-02: events-dao is immutable insert-only (recordEvent/recordEventCore, no update path); archive/restore emit events composed inside their existing transaction, archived-state-guarded so a no-op/wrong-state transition throws and writes no spurious event; purge surfaces+deletes events; timeline UNION-ALL interleave keyed ${kind}-${id} with kind_order final tiebreak — LOG-02 events writer + read half; single-writer DATA-04 intact (no last_contact write added)
- [Phase 7]: 07-01: fuel-read is the single projection read choke point (listFuelForEditor the ONLY read surfacing off_limits); FuelEditor controlled (draft=only local state, existing rows uncontrolled defaultValue+commit-on-blur); BLANK->NULL at onAdd/onEdit boundary; age/ranked-line/AI/search deferred to Plans 02-04
- [Phase 7]: 07-03: confirming an AI-suggested fuel item (FUEL-06) is a SINGLE unconditional `UPDATE fuel SET source='manual', modified_at=? WHERE id=? AND contact_id=?` (both-keys assertOneChange), mirroring editFuel's mutexed-wrapper/non-mutexed-core split — NO migration, NO ai_confirmed_at column; provenance is INTENTIONALLY erased on confirm (locked owner decision 2026-08-15, RESEARCH Open Q1) — do NOT "restore provenance" as a later bug fix. "Unconfirmed AI" IS exactly source='ai'; getRankedFuel's existing source!='ai' exclusion is what confirmation lifts (row starts ranking only after the flip). FuelEditor renders source='ai' rows distinct (borderStrong + "Suggested by AI" pill + helper + Confirm(accent)/Dismiss(textSecondary), existing tokens only); Confirm→confirmFuel→load(), Dismiss reuses onDelete→deleteFuel→load(). No producer of source='ai' rows exists until Phase 14
- [Phase 8]: 08-01: dashboard-read.ts is the single node-tested read chokepoint for the dashboard list / never-contacted / counts / birthday candidates; it COMPOSES status.ts (PROGRESS_SQL/STATUS_SQL) + the fuel fragments (RANKED_FUEL_EXCLUSIONS/RANK_CASE/escapeLike, newly EXPORTED from fuel-read.ts and guarded by a SQL parity test) rather than re-deriving thresholds/exclusions. listDashboard chooses among FOUR mutually-exclusive population branches (term > favourites > snoozed > default precedence) — NOT a fixed restrictive base + appended predicate (that construction is self-contradictory: snoozed always-empty, never-contacted favourites hidden); term/favourites/snoozed RELAX the base to archived-only, needs-attention/category/battery NARROW within it. Status/progress are CASE-wrapped (`CASE WHEN last_contact IS NULL THEN NULL ELSE (…) END`) and listNeverContacted selects LITERAL null status/progress so a never-contacted row NEVER reads STATUS_SQL's ELSE-'stable' (HIGH-1); DashboardRow.status is `ProfileStatus|null` matching ContactCard's prop (MEDIUM-5). Snippet renders whenever fuel matches regardless of a concurrent name match (MEDIUM-6); status sort = `progress DESC` (NULLs-last, A-1) not a status-string CASE; tiebreak qualifies `c.name` (LOW-1). countLiveContacts PINNED to `archived_at IS NULL AND last_contact IS NOT NULL` (the "{N} contacts" header + Plan-07 gate, HIGH-2). countSnoozed/snoozed-segment legitimately empty until Phase 11 writes snooze_until. Pure read (no writer/txn/network, async-only, no localtime on stored columns)
- [Phase 7]: 07-04: searchFuel (FUEL-05) is the third projection on the fuel-read choke point — a ?-bound, `LIKE ? ESCAPE '\'`-escaped scan matching contact name OR non-off_limits/non-'ai' fuel text; off_limits AND unconfirmed source='ai' AND archived (archived_at IS NOT NULL) excluded IN-QUERY (both the snippet subquery and the EXISTS predicate), one row per contact ordered by name, empty/whitespace term → []. escapeLike escapes `\`→`%`→`_` (backslash FIRST) so a literal %/_ matches only rows literally containing it (binding alone does NOT make %/_ literal). AI exclusion is a safe SUPERSET of FUEL-05's off_limits-only mandate, aligning with getRankedFuel (unconfirmed-AI stays profile-only until 07-03's confirm flips to 'manual'). No FTS5, no migration (LIKE scan free at this scale — dossier Cluster F; FTS5 deferred to v2). FuelSearchResultRow is purely presentational (no DB/nav) and FuelSearch is a minimal Settings-reached screen — both are the reusable units Phase 8 absorbs into the dashboard search box (INDEX [dashboard → fuel]); Phase 8 relocating the box is expected, NOT a reversal

- [Phase 8]: 08-02: `daysUntilBirthday(stored, today)` in src/logic/birthday-logic.ts is the SINGLE pure, node-tested birthday parser (react-native-free) reused by the Plan 06 banner (DASH-05) and Phase 11 notification (NOTIF-04). Both ported Obsidian bugs fixed: Bug 1 (day-of drop) via LOCAL-MIDNIGHT vs LOCAL-MIDNIGHT difference so today-is-birthday === 0 at any time of day; Bug 2 (Feb-29 → Mar-1 silent overflow) via an EXPLICIT observation branch — non-leap years observe Feb-28 (exported `FEB_29_OBSERVED_DAY=28`, a flagged LOW-severity owner taste call recorded in a top-of-file comment; the bug is the SILENT overflow, so switching to Mar-1 is a one-constant+one-branch change, NOT a bug fix). Strict regex (`^\d{2}-\d{2}$` / `^\d{4}-\d{2}-\d{2}$`) + EXPLICIT month/day range validation run BEFORE any `new Date(...)` (MEDIUM-1: `02-30`/`13-01`/non-leap `2021-02-29` → null, never silently normalized); MM-DD is February-leap-PERMISSIVE (year unknown, `02-29` valid) while YYYY-MM-DD validates against its real year (leap `2020-02-29` valid). Early `null`/empty/whitespace guard → null (nullable `contacts.birthday`, edit-contact-logic.ts:98); the stored year never affects the next-occurrence math. 28 Vitest node tests green; tsc/biome clean.

- [Phase 8]: 08-04: three decoupled dashboard UI primitives, all purely presentational (explicit props, NO DB read / NO getExecutor / NO useNavigation — the caller wires onPress; threat T-08-10 no `.filter()` resurfacing private data). `ContactCard` (src/components/ContactCard.tsx) composes the LOCKED DASH-03 content contract from the existing `Avatar` + `RankedFuelLine` UNCHANGED: Avatar `contactId` + `cacheBust=modifiedAt` (anti-face-flash recyclingKey, a CORRECTNESS req not an optimization), a TOKEN-CLEAN status-ring placeholder (rogue=`colors.rogue`; stable/wobble/decay + the neutral never-contacted state differ ONLY by opacity over textSecondary/border — NO band hex invented, OD-1 left to owner) carrying a status-naming `accessibilityLabel` (Stable/Wobbling/Decaying/Rogue/"Not yet contacted") so uiautomator asserts the band without colour, a 1-line name, the ranked fuel line OR a fuel-match snippet (rule stays "snippet present → show snippet" because 08-01 sets snippet non-null on ANY fuel match incl. name+fuel, MEDIUM-6), a category chip hidden when null (surfaceElevated+textSecondary, OD-4), a provisional accent star (OD-2); `status: ProfileStatus|null` — null renders neutral, never "Stable". LOCKED testIDs present. NOTHING log-derived (no recency/days-ago/channel/gravity/intensity/quality). `FilterChipRow` (src/components/FilterChipRow.tsx) is a single-active horizontal ScrollView+Pressable chip control — active accent/borderStrong + `colors.background` label (filled-accent idiom), inactive surface/border + textSecondary; LOCKED `dashboard-filter-chip-{key}` testIDs mirroring DashboardFilter; count rendered in label (snoozed/favourites); parent owns active state. `useDashboardPrefs` (src/stores/dashboard-prefs-store.ts) persists last-used sort(default "status")+filter(default "all") via Zustand persist over AsyncStorage — copied theme-store VERBATIM (name orbit-dashboard-prefs, version 1, partialize {sort,filter}, warn-on-rehydrate); a device-local UI pref, NOT a SQLite row/migration (T-08-11 only enum values persist). No deviations; tsc + check:colors green across full src. On-device UAT of the rendered contract + persistence DEFERRED to the Plans 07/09 Pixel pass.
- [Phase 8]: 08-03: favourites-dao is the ONLY new Phase-8 writer — `setFavouriteRank` appends at `favourite_rank = COALESCE(MAX,-1)+1` (first → 0) / `clearFavouriteRank` NULLs it, both single-column `?`-bound UPDATEs mirroring setContactPhoto/clearContactPhoto (changes===1 guard, modified_at bumped, the recency column NEVER written → DATA-04 single-writer invariant intact, grep-verified 0 refs). `rewriteFavouriteRanks` enforces the MEDIUM-2 mismatched-id-count guarantee in ONE inWriteTransaction: (1) unique-id check, (2) `orderedIds.length` == current live-favourite count (`favourite_rank IS NOT NULL AND archived_at IS NULL`), (3) per-row `UPDATE … WHERE id=? AND favourite_rank IS NOT NULL AND archived_at IS NULL` with changes===1 — so a partial / over-long / duplicate / stale (archived or never-favourite) list rolls back the whole batch and can never rank a non-favourite/archived row; N raw UPDATEs, NEVER a wrapped single-write DAO in the loop (non-reentrant mutex → deadlock). Empty `orderedIds` is an ACCEPTED no-op (0===0), documented in-file so it's not read as a missing guard (A-2). `computeReorder` (src/logic/favourites-reorder-logic.ts) is the pure node-tested drag→order move — returns a NEW array, permutation-invariant, input never mutated, out-of-range indices CLAMPED into [0,length-1] not thrown; it feeds rewriteFavouriteRanks from the Plan-08 Manage-favourites drag-end. 26 tests green (15 DAO + 11 reorder); tsc/biome/check:colors clean.
- [Phase ?]: [Phase 8]: 08-05: NeverContactedScreen (DASH-04) is the 'Not yet contacted' inverse-population screen — reuses the shared ContactCard verbatim (a never-contacted row's status:null from listNeverContacted's literal-null projection drives the card's neutral state; status NEVER re-derived) and offers its OWN three-way sort (Oldest added default / Newest added / Name A-Z) wiring the NeverContactedSort union the DAO exposes; the three options live in a fixed-order SORT_OPTIONS constant whose keys ARE the union so the control cannot drift. Load runs in useFocusEffect with a cancelled-flag async guard (FuelSearch pattern), re-queried on focus AND on sort change, async-only, offline; calm never-contacted-empty state. Chrome mirrors ArchivedContactsScreen; sort control inline using the FilterChipRow filled-accent idiom, container testID never-contacted-sort-control. NeverContacted route registered ADDITIVELY (types.ts + RootNavigator) — FuelSearch route + initialRouteName Home untouched (Plan 10 retires FuelSearch). tsc + check:colors green; dashboard-read.test.ts 31 tests pass; .tsx render/nav/sort is Pixel-UAT at end of phase.
- [Phase 8]: 08-06: BirthdayBanner (DASH-05) reads listBirthdayCandidates (archived-excluded ONLY — the DECIDED scoped exception overriding snooze/never-contacted suppression, dossier Cluster E; candidates NOT re-filtered to the dashboard population), computes the 7-day/soonest-first order in JS off the single daysUntilBirthday parser ('today' on day-of, 'in N days' otherwise), reads via an async cancelled-flag guard (offline), renders null when empty, and stays presentational (onPressContact(contactId) callback; Plan 07 mounts it + wires navigation). The profile favourite star (DASH-06) toggles favourite_rank via setFavouriteRank/clearFavouriteRank then the unified load() reconciles the header — reversible, non-destructive, NO confirmation; marked star uses colors.accent (OD-2 provisional token). getContactHeader widened PURELY ADDITIVELY to return favourite_rank (number|null) — the two other callers (EditContactScreen refreshPhoto, contact-read.test.ts field-wise asserts) stay green, MEDIUM-3 verified by tsc + 16-test run.

- [Phase 8]: 08-08: ManageFavouritesScreen (DASH-06) is the shared drag-reorder favourites home — reorder-ONLY (marking stays the profile star). Owner APPROVED adding react-native-reorderable-list@0.18.1 at the blocking-human legitimacy checkpoint (T-08-SC; created 2021, ~92k dl/wk, MIT, Reanimated-4-maintained), installed via `npx expo install`; the no-dep up/down-arrow fallback was NOT built. Loads listFavourites via an async cancelled-flag focus effect (offline); each row (FavouriteReorderRow, split so useReorderableDrag() runs inside a ReorderableList cell) = Avatar + name + a drag handle whose onPressIn starts the drag. onReorder computes computeReorder(currentIds, from, to) inside the setRows updater, mirrors local rows via an id→row Map, and fires rewriteFavouriteRanks(getExecutor(), newIds, localDateTime()) in ONE transaction (fire-and-forget; a persist failure alerts + re-reads via load()) — the tested reorder math + guarded DAO are reused verbatim, inWriteTransaction never nested (Pitfall 6). Drag/animation is entirely Reanimated-worklet-driven (no per-frame setState, CLAUDE.md); ReorderableList is a FlatList so Avatar's recyclingKey (contactId + cacheBust=modified_at) correctness holds. Route registered ADDITIVELY (types.ts ManageFavourites: undefined after NeverContacted + RootNavigator Stack.Screen); FuelSearch + NeverContacted untouched. Locked testIDs manage-favourites-root / -row-{id} / -handle-{id}. tsc + check:colors green; npm test 665/665. Navigation entry points (favourites-chip Manage, Plan 09; Settings row, Plan 10) land later by design; .tsx render + native drag is Pixel-UAT (drag perf only assessable on the physical Pixel).

- [Phase 8]: 08-07: HomeScreen IS the dashboard core now. `selectDashboardEmptyState` (src/logic/dashboard-empty-logic.ts, pure/node-tested, 11 cases) is the SINGLE empty-state gate — explicit precedence rowCount>0→'none' → hasTerm→'search-empty' → activeFilter!=='all'→'filter-empty' → (unfiltered) all-four-populations-zero→'firstrun' else 'hidden'. First-run REQUIRES live===0 && neverContacted===0 && snoozed===0 && archived===0 (HIGH-2 — never-contacted-only / snoozed-only / archived-only users get the hidden-population pointer, NOT "Add your first contact"); the filter/search empties win BEFORE the population fallback so a zero-result filter/search over a non-empty population never shows the hidden copy (MEDIUM-4). No inline count arithmetic in the .tsx. HomeScreen renders the status-sorted listDashboard population as ContactCards (→Profile), mounts BirthdayBanner at top (→Profile), shows the "{N} contacts" header from countLiveContacts (only when live>0), and Not-yet-contacted(N)→NeverContacted + count-less Archived→Archived footer entries. FRESHNESS = useFocusEffect + AppState→"active" + pull-to-refresh (RefreshControl accent tint), a single reload() returning its own cancelled-flag canceller, async reads ONLY — the connection-scoped change listener is deliberately NOT used (T-08-18, blind to headless writes); grep-verified 0 addDatabaseChangeListener / 0 getAllSync|getFirstSync. filter-empty renders a calm generic region (dashboard-empty-filter) for now; the filter-specific + search-empty copy + the live chips/search box land in Plan 09 (threading activeFilter/hasTerm into the SAME gate). All colours via useTheme().colors.*; dashboard-root testID. tsc + check:colors clean; npm test 676/676. **OPEN owner decision:** the rewrite removed home-settings-entry — the app's ONLY navigate("Settings") path — and no phase-8 plan (07–10) adds a dashboard→Settings affordance (the UI-SPEC dashboard surface defines none). Settings/CustomFields/Archived-via-Settings/Manage-favourites-row are UI-unreachable until resolved; flagged in 08-07-SUMMARY (not auto-fixed — placement is a product/navigation call). Resolve before end-of-phase Pixel UAT.

- [Phase 8]: 08-09: HomeScreen gains the full controls layer (DASH-02/04/06 complete). Filter/sort selection PERSISTS via useDashboardPrefs (setFilter/setSort); the search term is LOCAL useState; all three are `reload` deps so a change re-queries through the Plan-07 focus-effect callback-change mechanism (no manual re-run). Chips assembled from real tables: all · needs-attention · one per category (listCategories) · one per social-battery value (Charger/Neutral/Drain) · favourites · snoozed (live countSnoozed, 0 until Phase 11). Sort control = a 4-Pressable row (Status/Name (A–Z)/Least recent/Most recent), no segmented-control dep, container testID `dashboard-sort-control` + options `dashboard-sort-option-{key}`. Live search box (`dashboard-search-input`, placeholder "Search people and notes") + `dashboard-search-clear` threads `term` into listDashboard — the DAO owns name/fuel matching + off_limits/ai/archived exclusions + the LOW-2 favourites+term precedence (NO component-side .filter of private data, NO special-casing; T-08-20/21 mitigated). Empty states fully via selectDashboardEmptyState with live activeFilter + hasTerm: search-empty (`dashboard-search-empty`, "No matches for {term}") wins before filter-empty; favourites filter-empty renders "No favourites yet" + pointer to the profile star (MEDIUM-4). Favourites-chip "Manage" affordance = a separate header link shown only when favourites is active (FilterChipRow stays purely presentational) → navigate("ManageFavourites"). OWNER-APPROVED addition beyond the plan text: a top-right Settings gear (`dashboard-settings-entry`, ⚙ token glyph, accessibilityLabel "Settings") → navigate("Settings"), fixing the 08-07 reachability gap (commit e9b6efb). Colours via tokens only; tsc + check:colors green; npm test 676/676. .tsx render/nav/persistence is end-of-phase Pixel UAT.
- [Phase ?]: [Phase 8]: 08-10: standalone FuelSearch route + screen retired (search relocated to the dashboard, Plan 09 — expected relocation, NOT a reversal); FuelSearchResultRow + searchFuel DAO kept. Settings loses the Search row, gains a Manage-favourites row -> ManageFavourites (2nd entry into the shared reorder screen).

- [Phase 9]: 09-01: the three compose prerequisites landed ahead of the screen. (1) `resolveComposeControls(hasPhone, smsAvailable)` + `ComposeControls` (src/logic/compose-logic.ts) is the pure, react-native/expo/db-free, node-tested CMP-03 Send/Copy capability gate — no-phone branch FIRST so a missing number always wins over SMS capability ((false,true) ≡ (false,false)); phone+no-SMS → Send hidden, Copy primary, helper line; phone+SMS → Send shown, Copy secondary. Mirrors the dashboard-empty-logic resolver idiom (explicit-precedence header comment, one exported interface + one pure resolve fn). (2) `expo-sms` + `expo-clipboard` installed via `npx expo install` at SDK-57-pinned `~57.0.1` (both first-party Expo modules, no postinstall — T-09-SC mitigated, no blocking-human legitimacy checkpoint needed); NO app.config.ts plugins entry added (neither ships a config plugin — a bogus entry is a prebuild error, 01-01 deduped-plugins lesson). Native-dep change ⇒ Plan-02 on-device UAT needs `expo prebuild --clean` + release APK. (3) `getContactHeader` widened PURELY ADDITIVELY to return `phone: string | null` (append to SELECT + both type literals; light by-id seek kept — NO join, NOT switched to getContactForEdit) — the 08-06 favourite_rank idiom; the two field-wise callers (ContactProfileScreen local Header type, EditContactScreen refreshPhoto) + contact-read.test.ts stay green. npm test 673/673, tsc + check:colors clean. No deviations.
- [Phase ?]: 09-02: interim controls literal while smsAvailable===null (Send hidden, Copy sole primary) keeps resolveComposeControls called only with a concrete boolean — no wrong-state flash on first mount or re-focus
- [Phase ?]: 09-02: SMS capability probe runs separately from the header/fuel load so a rejected isAvailableAsync() degrades to false without failing the load; a null getContactHeader (deleted contact) exits to the dashboard
- [Phase 13]: 13-06: the two Settings sun controls (ORR-05 + relocated ORR-06) in `SettingsScreen.tsx` — a new "Your orbit" section below the Phase-5 "Your photo" self row. "Your star" (testID `settings-your-star-row`) maps `useTheme().colors.starPalette` to circular 44px `Pressable` swatches (`settings-star-swatch-{index}`); the selected swatch = `selfSunColour ?? colors.starPalette[0]` (NULL→gold at RENDER, the DAO never resolves a palette colour) and carries a 3px `accent` border ring (unselected `border`, no layout shift). A tap calls `updateAppSettings(getExecutor(), { selfSunColour: token }, localDateTime())` then `reloadOrbit`. "Sun / centre" (`settings-sun-centre-row`) shows the resolved occupant name and opens a `Modal`+`FlatList` picker (`settings-sun-picker`) — the zero-dependency DropdownFieldWidget idiom (scrim = `colors.background` @0.85, sheet = `surfaceElevated`, 60% max-height); data = `[{id:null,name:"Me"}, ...listSunCandidates()]` (synthetic Me prepended UI-side; candidates already archived-excluded by the read); options `settings-sun-option-{id|me}` write `sun_contact_id` (NULL=Me) then close + reload. **M4:** `reloadOrbit` resolves a non-null `sun_contact_id` via `getContactHeader` and displays "Me" when the header is missing OR `archived_at !== null` — the SAME self fallback the canvas applies (`resolveSunOccupant`, 13-05); the stored id is NOT auto-cleared (display minimum; the migration-003 FK reverts a hard-purged occupant). **M6:** both writes mirror the `persist` helper's `try/catch` + `Logger.error(LOG_SCOPE, …)` — a future non-`#RRGGBB` starPalette token (rejected by the DAO validator) surfaces a handled, logged error, not an unhandled rejection. **M3:** a sun change writes only `app_settings`; orrery-read derives the display rank densely at read (13-03), so nothing needs ring_seq normalization here. **L10:** an in-code note on `sunOptions` records ORR-06's "assign the sun" is SATISFIED in Settings by owner decision (REQUIREMENTS.md NOT edited). All colours via tokens — swatch fills ARE starPalette tokens (legit token use, not hex), scrim is the background token; check:colors clean. 2 commits (f1d675a Your star; 397277c Sun / centre); tsc + check:colors + npm test (1000) + biome (SettingsScreen) green; no deviations. .tsx render/pick is device-UAT (13-08), not node-tested.
- [Phase 13]: 13-07: the orrery's motion + direct-manipulation, all off the JS thread (Reanimated worklets), across `OrreryScreen.tsx` + the keyed children + a new `orrery-clock-context.ts`. **ORR-02 morph:** ONE `morph = useSharedValue(0)` (0=Status default, 1=Relationship) driven by the SegmentedControl `onChange` via `withTiming(MORPH_MS=500, Easing.inOut(Easing.ease))`. Per body the screen precomputes BOTH endpoint angles from the SAME measured `C` — `progressToAngle` (status) + `evenSpreadAngle(rank, count)` (relationship) — the fixed `drawnRadius` (shared axis), and the `shortestAngleDelta` between them, and passes them into the keyed `<OrbitBody>`. Inside OrbitBody (H1 — one hook set per body, never in a `.map()`) two `useDerivedValue` worklets: a Group `transform` translating the whole body from its status position by the polar delta of `statusAngle + morph·angleDelta` (radius NEVER interpolated; Pitfall 2 handled by the precomputed delta), and `interpolateColor(morph,[0,1],[fullFill,mutedFill])` on the status outline circle (rogue→rogueExtinguished both views). The tap hit-test targets whichever view `morph` settled on (view-state status/rest arrays). **ORR-03 ambient + pause:** OrreryCanvas gained the SOLE `useClock()` (grep-confirmed — the OrreryScreen/SunBody hits are comments) driving a single Group-opacity twinkle over a deterministic ~44-dot starfield (tones = textSecondary/textPrimary/starPalette tokens) + a new `OrreryClockContext` (Provider INSIDE the `<Canvas>`) feeding SunBody's glow pulse (radius ±10% / opacity ±40%, ~3s). SunBody reads the clock via context (never calls useClock; static fallback when null). Pause-on-blur = OrreryScreen renders `{dimsValid && placement && useIsFocused() && appActive ? <OrreryCanvas/> : null}` (AppState 'change' listener mirroring HomeScreen) — UNMOUNTING the clock-owner is what stops the loop (Pitfall 4); the RN chrome stays mounted. **ORR-06 canvas half:** `Gesture.Race(tapGesture, panGesture)` feeds OrreryCanvas. Resting positions are mirrored into a worklet-safe `bodiesShared` shared value + a `dragMetrics` scalar snapshot (M5, updated in an effect); `Gesture.Pan().minDistance(10)` onBegin inlines a hit-test against `bodiesShared.value` on the UI thread → `activeDragId`, onUpdate tracks the radius for an `accent` ghost-ring (`useDerivedValue`, angular component ignored), onEnd maps `clamp(round((releaseRadius − C.ringInner)/C.effectiveGap), 0, N−1)` (H2 — SAME deriveOrreryMetrics object as render/hit-test; effectiveGap floored >0; no RING_GAP alias, C2-6) then `runOnJS(commitFromWorklet)`. `commitRingSeq` (a stable latest-ref bridge keeps the gesture identity-stable) runs `computeRingReorder` over the rendered sun-excluded orbiting list and `await rewriteRingSeq(getExecutor(), newIds, localDateTime(), sun.sunContactId)` in ONE txn — threading `sunContactId` as `excludeContactId` so the N−1 dragged list clears Guard 2 (else a contact-sun reorder rolls back); success re-reads `listOrbitingContacts({excludeContactId})` to reflow, failure alerts + re-reads. C2-4: the GestureDetector + clock mount are gated on `dimsValid`, so the release-rank division is unreachable on a degenerate canvas. Never nests `inWriteTransaction` (Pitfall 5, runOnJS off the worklet). All colours via tokens incl. `interpolateColor` endpoints. `useClock` imported from `@shopify/react-native-skia` (not reanimated). 3 commits (d204f33, ea4370c, de20aca); tsc + check:colors + npm test (1000) + biome (5 files) green; no deviations. .tsx/Skia render + gestures are device-UAT (13-08); perf claims Pixel-only.
- [Phase 13]: 13-05: the FIRST user-touchable orrery slice — reachable Skia status-view render. `OrreryScreen` (src/screens/OrreryScreen.tsx) mounts a `<Canvas>` from the dashboard ◎ Orbit button and draws the orbiting set (one status-coloured ring + planet per live/contacted/non-archived contact) around a central sun, with the rogue extinguished body + bounded drift, an RN empty-state overlay, a two-segment view toggle (SegmentedControl, inert until 13-07), and tap→Profile. Built as the MANDATED H1 Rules-of-Hooks decomposition: per-body `useImage` isolated in a keyed `<OrbitBody key={id}/>` (src/components/orrery/OrbitBody.tsx), the sun photo hook in `<SunBody/>`, and the conditionally-mounted `<Canvas>`+GestureDetector subtree in `<OrreryCanvas/>` (where 13-07's `useClock` lands so unmounting halts the loop). OrreryScreen owns the `.map()` (returns OrbitBody ELEMENTS, no hook) and passes them as children into OrreryCanvas — a fixed hook count independent of contact count. H2/C2-4: canvas MEASURED via onLayout, a `dimsValid` gate defers layout/mount/gesture until valid, `deriveOrreryMetrics(w,h,n)` computed ONCE and the SAME `C` threaded to render + `hitTest` (via refs for the tap worklet). M4/C2-2: sun occupant resolved from `Promise.all([getContactHeader, getContactStatus])` threading `statusRow?.status ?? null`; archived/missing → self via resolveSunOccupant. C2-1: both OrbitBody + SunBody use `useImage(photo ? resolvePhotoUri(photo) : null)`. New-to-repo Skia idioms (NOT in CropPhotoScreen): `useFonts` + the Paragraph API for the planet-initials fallback, fed by a vendored `assets/Inter-SemiBold.ttf` (static SemiBold, SIL OFL-1.1, from the rsms/inter v4.0 release — OFL permits bundling) — first proven on device in 13-08 UAT. Orrery route registered ADDITIVELY (types.ts + RootNavigator; Home stays initial). All colours via tokens (check:colors clean). 3 commits (dbe3cfb SegmentedControl; 9d4d4ed render+components+font; 8365bcc route+button); tsc + check:colors + npm test (1000) green; the five new files pass biome. NOTE: biome check was already failing on RootNavigator.tsx + HomeScreen.tsx at HEAD (pre-existing formatting) — left unreformatted per scope boundary; the added lines are clean. .tsx/Skia render is device-UAT (13-08), not node-tested — no RN render test written.
- [Phase 13]: 13-03: the orrery data layer — three node:sqlite-tested SQL surfaces (27 cases green). `listOrbitingContacts(exec, {excludeContactId?})` (src/db/orrery-read.ts) is the orbiting-set read chokepoint: COMPOSES status.ts PROGRESS_SQL/STATUS_SQL (never re-derives thresholds — a parity test asserts the exported `ORBITING_SELECT` `.toContain()`s both fragments, mirroring dashboard-read's fuel-parity guard), WHERE `archived_at IS NULL AND last_contact IS NOT NULL` (+ `AND id <> ?` when a sun occupant is passed), `ORDER BY COALESCE(ring_seq, 1e9), created_at, id`. The DISPLAY rank is the 0-based ROW INDEX of that dense order, NEVER the stored ring_seq value (M3, option (a)) — so a stale/duplicate stored ring_seq left on a formerly-hidden sun is harmless when the sun returns to self (regression-tested: contact-sun → reorder N-1 → self-sun re-read is dense/deterministic). DELIBERATE L11 divergence from dashboard BASE_WHERE: snooze is NOT filtered — a snoozed-but-contacted contact IS in the sky (lock-test guards against a later "consistency" refactor re-adding the snooze clause). `photo` returned RAW (nullable), never resolved — C2-1: the 13-05 consumer MUST `photo ? resolvePhotoUri(photo) : null`. `rewriteRingSeq(exec, orderedIds, now, excludeContactId)` (src/db/ring-seq-dao.ts) is the FIRST `contacts.ring_seq` writer — a near-verbatim clone of rewriteFavouriteRanks: 3 guards (unique / count-match / scoped changes===1) as N raw `?`-bound UPDATEs in ONE inWriteTransaction (never nests the non-reentrant mutex). Two swaps: column `favourite_rank → ring_seq`, scope `favourite_rank IS NOT NULL → last_contact IS NOT NULL AND archived_at IS NULL`, PLUS the FIXED cross-plan blocker: an optional `AND id <> ?` occupant exclusion appended to BOTH Guard 2's COUNT and every Guard 3 UPDATE (bound only when excludeContactId non-null) so the guard's effective set == orrery-read's RENDERED sun-excluded (N-1) set — a contact-sun drag passing the N-1 list succeeds; passing the wrong full-N list still fails Guard 2 by design. Writes ONLY ring_seq + modified_at; `last_contact` NEVER assigned (single-writer invariant intact; grep-pin `last_contact[[:space:]]*=` → 0). Empty list = accepted no-op. `now` is localDateTime(). `listSunCandidates(exec)` (src/db/sun-picker-read.ts) = non-archived contacts favourites-first (`(favourite_rank IS NULL)`, `favourite_rank ASC`, `name COLLATE NOCASE, id`), never-contacted INCLUDED (anyone can be the sun; C2-2: a never-contacted sun has status null → 13-04/05 resolveSunOccupant accepts `ProfileStatus | null`), no synthetic "Me" row (Settings UI prepends self). ring_seq column already existed from migration 001 (no migration shipped). tsc + check:colors clean; no deviations.
- [Phase 17]: Owner approved the remaining Phase 17 native dependency provenance decisions as one batch.
- [Phase 17]: RNQC is registered as a bare Expo config plugin without optional sodium configuration.
- [Phase 17]: D-01 migration 007 tombstones and indefinitely retained deletion evidence executed as owner-approved.
- [Phase 17]: Migration 007 fixes profile and seeded category UIDs to reserved constants for ordinary cross-install UID reconciliation.
- [Phase 17]: Child delete tombstones capture the matching UID before deletion and roll back on a missing target.
- [Phase 17]: applyLinkDiff reuses its caller-supplied now timestamp for compositional link tombstones.
- [Phase 17]: Permanent custom-field deletes tombstone definitions and normalized values atomically; stale deletes roll back.
- [Phase 17]: Reconciliation rejects custom value pair and field col_name collisions as whole-restore incompatibilities.
- [Phase 17]: Automatic backup freshness stores data_revision snapshots, never timestamps.
- [Phase 17]: Portable settings exclude local SAF, encryption, nudge, and backup-health metadata.
- [Phase 17]: Backup bookkeeping does not change data_revision or modified_at.
- [Phase 17]: Restore journal rows authorize only committed typed photo recovery; filename parsing is never trusted.
- [Phase 17]: Configured Replace-all requires an injected verified pre-restore snapshot; post-commit recovery failures remain non-blocking.
- [Phase 17]: Normal passphrase change re-encrypts accessible automatic backups by default; future-only remains explicit.
- [Phase 17]: SecureStore retains a pending old/new passphrase and replacement URI journal until verified automatic-backup re-encryption completes.
- [Phase 17]: Restore navigation carries only opaque validated-cache tokens and aggregate preview data.
- [Phase 23]: 23-05: ONE semantic icon registry (ICON_REGISTRY, src/components/icons/icon-registry.ts) maps semantic names → {outline,filled} Ionicons pairs (IconName union); screens import semantic names only, never a third-party glyph (D-05, no second icon source). The registry stores plain glyph STRINGS so the module stays react-native-free/node-testable; Ionicons-name TYPE validation lives in Icon.tsx where the real Ionicons is imported (glyph flows straight into `<Ionicons name={glyph}>` → invalid glyph fails tsc, no cast). Icon resolves colour via useTheme().colors[tone] + size via ICON_SIZE (16/20/24/28); IconTone is a mapped type over ThemePalette keeping only string-valued keys (array tokens avatarSwatches/gravityTiers/starPalette excluded; a @ts-expect-error asserts the rejection), StatusTone narrows to statusStable/statusWobble/statusDecay/rogue/border. TAB_ICON maps real *Tab route keys → semantic names (typed Record<keyof TabParamList,IconName> for completeness); tab bar renders through <Icon>, ad-hoc TAB_GLYPHS map retired. statusGlyph(state) + StatusDisplayState (ProfileStatus | 'snoozed' | null) added BESIDE ringVisual in contact-card-ring.ts (one glyph+hue source, ringVisual's ProfileStatus|null contract unchanged; snooze is an independent condition composed by the consumer) → six DISTINCT silhouettes (checkmark-circle/time/warning/remove-circle/ellipse/moon), null→status-neutral. StatusGlyph.tsx renders via the registry with a StatusTone token (never hex) + accessibilityLabel. THEME-08/09 delivered as seams; screen adoption deferred to renderer/Phase-15. Full suite 2049 pass; tsc + check:colors clean; no deviations.
- [Phase 17]: Restore applying state is React-local and never resumes after a cold launch.
- [Phase 18.1]: V9 contact methods use isValid actionability, retain non-actionable raw input, and preserve the device canonicalization region.
- [Phase 18.1]: Aggregate contact saves compose contact-method cores inside one outer transaction; method drafts are optional and return typed same-contact canonical collisions.
- [Phase 18.1]: Labels are nullable durable contact-method data in forward migration 010; migration 009 remains immutable.
- [Phase 18.1]: Aggregate create/edit owns label persistence and same-contact canonical collision collapse.
- [Phase 18.1]: Backup format v2 keeps method label and canonicalRegion nullable on the durable wire.
- [Phase 18.1]: Natural-key collisions normalize the reconciliation plan rather than rejecting a whole restore.
- [Phase 18.1]: Method/link demotions write before promotions because SQLite partial unique indexes are statement-immediate.
- [Phase 18.1]: Profile renders DAO-owned display values and actionability only; it never reparses raw method input or a phone region.
- [Phase 18.1]: Compose supplies the OS SMS handoff only with the canonical destination of the DAO-selected actionable primary phone.
- [Phase 18.2]: Migration 011 preserves v10 values and IDs while enforcing Bound cadence constraints.
- [Phase 18.2]: Bind reuses dormant cadence and requires a positive cadence only for a never-assigned Unbound contact.
- [Phase 18.2]: Capture passes an explicit empty normalized method list while v11 defaults new inline contacts to Bound.
- [Phase 18.2]: Lifecycle-sensitive population eligibility lives at SQL query owners; direct retrieval remains neutral for Unbound contacts.
- [Phase 23]: 23-02: typography/spacing/radii tokens are pure node-tested RN-free data — TYPOGRAPHY = 5 roles (display/heading/body/label/caption) over 4 sizes (28/20/16/14) + 2 weights (400/600), label vs caption share 14 diverging by weight + colour TOKEN (never a hex); SPACING xs4..2xl48 (all %4); RADII sm8..pill999/full9999. Consumers import concrete @/theme/tokens/* (no barrel edit). AppText resolves role→family/size/weight from TYPOGRAPHY + colour from useTheme(), sets NO allowFontScaling={false} and NO fixed height/numberOfLines so OS scaling reflows (THEME-07). Fonts (Inter Regular/SemiBold + Space Grotesk SemiBold) bundle locally from assets/ via expo-font; loadAppFonts() catches/logs and RESOLVES on failure (degrade to system font) and is awaited in the App.tsx ready gate (Promise.all with theme hydrate) so a font error never blocks boot. expo-font's OPTIONAL config plugin deliberately NOT added (runtime load, matching 13-05 Skia useFonts precedent); @expo/vector-icons + expo-blur ship none. Font-map keys are weight-specific (Android won't synth a weight). Screen adoption of AppText = Phase 15; device-UAT reflow = end-of-phase backstop. deps @expo/vector-icons/expo-font/expo-blur SDK-57-pinned, no install scripts (only root patch-package).
- [Phase 18.2]: Digest retrospective and gentle-line reads remain all-relationship-history; overlooked is Bound-only.
- [Phase 18.2]: STATUS_SCAN callers require Bound positive cadence before evaluating shared status fragments.
- [Phase 18.2]: Unbound intensity is a tagged unavailable result, never nullable-cadence arithmetic or a fabricated interval.
- [Phase 18.2]: Explicit AI maps unavailable intensity to the exact neutral aggregate while retaining closed prompt projection.
- [Phase 18.2]: A saved Unbound sun keeps app_settings.sun_contact_id intact and resolves visually to self through the shared predicate.
- [Phase 18.2]: Orrery reads and ring-sequence guards use the same Bound predicate, while never-contacted Bound contacts remain picker candidates.
- [Phase 18.2]: Decay candidates require Bound state; birthday facts stay both-state but scheduling honors persisted birthday_unbound_enabled policy.
- [Phase 23]: 23-01: migration 015 (TARGET_VERSION 15, head+1 verified on disk) adds seven durable app_settings theme columns — theme_package + per-package galaxy_*/standard_* mode/accent/background. Package + mode are NOT NULL DEFAULT + CHECK (v0->v15 lands Galaxy + Follow-System, no code branch); accent/background are nullable option-id TEXT (NULL = package default resolved at RENDER, the self_sun_colour idiom) so NO colour hex enters the schema. Owner-resolved Task-1 checkpoint = the recommended shape (one-time orbit-theme import then clear).
- [Phase 23]: 23-01: theme-option-ids.ts is the single canonical ACCENT_IDS/BACKGROUND_SLOT_IDS source (pure, RN/db-free); DAO validators assertAccentId/assertBackgroundId consume it via .includes() (AI_PROVIDER_IDS idiom); Plans 03 (accents.ts) / 06 (backgrounds.ts) IMPORT these arrays, never re-declare. Theme layer re-keyed onto ThemePackage (galaxy = former space-dark verbatim, standard placeholder); resolvePalette(package, mode); DEFAULT_PRESET_ID kept exported (value 'galaxy') so widget-colors.ts compiles unchanged.
- [Phase 23]: 23-06: backgrounds.ts BACKGROUND slot manifest keyed by the IMPORTED BACKGROUND_SLOT_IDS single source (drift test asserts equality, no re-declared list); asset require() lives in a lazy `source: () => require(*.webp)` thunk (fonts.ts idiom) so the module is node-testable and resolvers return the thunk uncalled. resolveBackground (NULL->package default, none->solid, unknown/tampered->default) + resolveRenderableBackground(pkg,slot,renderFailed) pure onError->None/Solid reducer (unit-tested; no react-test-renderer to mount BackgroundHost). tokens/surface.ts per-package SURFACE tokens: galaxy glass (translucent surface tint 0.88->0.97 by density + luminous borderStrong + accent glow), standard flat (near-opaque 0.97->1.0, plain border, no glow); resolveSurfaceStyle returns ONLY palette-token KEYS + declared opacities (token-only escape-hatch guard, unit-tested) and GlassSurface resolves colour via useTheme()[key] carrying NO component-local colour/opacity literal. liveGlassTintOpacity pinned == least-dense density opacity == fallbackTintOpacity per package (opacity-ordering invariant by construction); COMPOSITED per-asset AA = alphaComposite(live tint, each asset's DECLARED brightest pixel) checked vs every text(AA-normal)/status(AA-large) foreground in all 4 palettes. 8 placeholder uniform-fill webp assets (colour == declared brightest pixel, honest bound) + provenance README; final art deferred, must stay <= declared pixel (device-UAT enforces shipped bytes — 23-VALIDATION Manual-Only + WINDOWS.md). BackgroundHost density scrim reuses surfaceOpacityForDensity (readability-dominant band for D-04 text-heavy backgrounds; vivid full-bleed is the Orrery exception); static assets ship NO animation worklet. OrreryCanvas twinkle AND SunBody glow pulse BOTH gated on useReducedMotionShared() read DIRECTLY inside useDerivedValue (REVIEWS 23-06 HIGH — every clock consumer audited; sun stops pulsing under reduced motion; no prop/context threading, no setState). ThemePreviewScreen dev-only harness NOT wired into RootNavigator (files_modified scope + no-new-nav). THEME-04/05/12 delivered as primitives+behaviors; app-wide mount deferred renderer/Phase-15, Appearance UI Phase 37. 2088 tests pass; tsc + check:colors + biome clean; no deviations.
- [Phase 23]: 23-01: the 7 theme keys are allowlisted in PORTABLE_SETTINGS_KEYS + DAO-writable NOW, but EMISSION in getPortableSettingsSnapshot is DEFERRED to Phase 36's format-4 plan (OPTIONAL PortableSettingsSnapshot fields, no SELECT/return, phoneRegionOverride 69bb048 precedent). BACKUP_FORMAT_VERSION stays 3, no FORWARD_MIGRATIONS entry — format-3 wire byte-identical (REVIEWS 23-01 HIGH). Legacy orbit-theme imported once at boot via hydrate-theme-at-boot (DI coordinator, compare-before-write idempotency, per-step error isolation) folded into the App.tsx ready gate = restore-before-paint; theme-store reworked to boot-hydrated app_settings selection (no AsyncStorage). Device UAT (no-flash + carry-across) deferred to end-of-phase Pixel pass.
- [Phase 18.2]: Lifecycle transition effects run only after DAO commit and isolate scheduler/widget failures from durable relationship state.
- [Phase 18.2]: Stale proactive actions fail closed while Profile opens remain available for live Unbound relationship records.
- [Phase 18.2]: Never Contacted eligibility is a persisted policy evaluated at its SQL read owners, never a screen-side filter.
- [Phase 18.2]: Saved Unbound sun references remain durable while Settings renders the shared self fallback.
- [Phase 18.2]: Unbound retrieval rows use neutral avatar/name/label chrome and never ContactCard status or favourite treatment.
- [Phase 18.2]: Aggregate Unbind preserves a previously assigned cadence instead of clearing it.
- [Phase 18.2]: Aggregate edit transitions call DAO-free post-commit effects; direct Profile actions use DAO-wrapping lifecycle owners.
- [Phase 18.2]: Profile lifecycle state is pure and hides cadence-only treatment for Unbound contacts while retaining gravity and history.
- [Phase 18.2]: Lifecycle changes bump the portable backup format to v3, with v2 contacts defaulting to Bound.
- [Phase 18.2]: A newer Unbound merge cannot null an already assigned local cadence; the cadence remains dormant before SQL begins.
- [Phase 19.1]: Use a single contactImportMode/startContactImport seam for API 37+ system and API <= 36 legacy acquisition.
- [Phase 19.1]: Scope READ_CONTACTS to maxSdkVersion 36 and reject legacy provider read failures rather than treating them as cancels.
- [Phase 19.1]: Nameless bulk rows use skipped while unresolved-state definitions remain unchanged.
- [Phase 19.1]: Unreadable birthday reporting reuses the storage canonicalizer over durable source_payload.
- [Phase 19.1]: View contact appears only for one already-linked row in a single import session.
- [Phase 19.1]: Contacts is the query spine for browse and selected full reads, preserving name-only contacts through Data enrichment.
- [Phase 19.1]: JS owns defensive selected-key chunking, merge/order restoration, omission reporting, and staged-photo cleanup.
- [Phase 19.1]: External summary thumbnails render directly with expo-image; Avatar remains an initials-only fallback.
- [Phase 19.1]: Plain READ_CONTACTS denial remains recoverable; permanent status is derived only from NEVER_ASK_AGAIN.
- [Phase 19.1]: Permission presentation flags are durable but a fresh OS grant clears them.
- [Phase 19.1]: Settings and dashboard contact import share contactImportMode/startContactImport routing.
- [Phase 22]: Root navigation is a fixed four-tab shell with a native stack per tab.
- [Phase 22]: External entry routes retain flat pure resolver intents and nest only at the live reset dispatch.
- [Phase 22]: The container navigation ref is typed against TabParamList; dashboard reset state is owned solely by reset-intents.ts.
- [Phase 22]: Transient entries retain real close callbacks and preserve stack order when re-registered.
- [Phase 22]: Shell Back intercepts only transient dismissal; ordinary Back returns false to React Navigation's focused stack.
- [Phase 22]: Unknown routes default to browse/read tab visibility until intentionally allow-listed as focused workflows.
- [Phase 22]: Cross-tab component and completion paths dispatch through the TabParamList-typed container ref.
- [Phase 22]: Discard protects only uncommitted metadata, links, and custom-field values; immediately persisted photo changes are excluded.
- [Phase 22]: Measured BottomTabBar height is the shared lower-clearance source for tab descendants and shell siblings.
- [Phase 22]: Dashboard preserves Group Events in the app bar and moves crowded secondary destinations into accessible overflow.
- [Phase 22]: UniversalFab dispatches shell-level actions through nested DashboardTab targets and derives Profile context from a pure root-state walker.
- [Phase 22]: Shell FAB placement shares the measured tab-bar source and FAB clearance constants with scroll content; it never calls useBottomTabBarHeight outside a tab screen.
- [Phase 22]: Picker favourites are a boolean membership band; recency and name, never favourite rank, determine visible order.
- [Phase 22]: Quick Log feedback is keyed solely to the resolved canonical recordTouchpoint transaction; Undo reuses deleteTouchpoint.
- [Phase 22]: Shell-originated interaction changes use a non-persisted app-level revision rather than Dashboard's connection-scoped SQLite notification.
- [Phase 23]: 23-04: the live OS reduced-motion signal (THEME-06/D-05/D-07). The subscribe/seed/cleanup logic is EXTRACTED into `createReducedMotionController(accessibilityInfo, emit): { dispose() }` — a plain, non-React controller with `emit` as the SECOND ARGUMENT (called once with the seeded value, again on every `reduceMotionChanged`) and `dispose()` as the only returned member, so it is node-testable with a mock accessibilityInfo + spy emit (repo has Vitest, no react-test-renderer). Signal source = `AccessibilityInfo.isReduceMotionEnabled()` (seed) + `addEventListener('reduceMotionChanged')` (live), NOT reanimated's boot-time `useReducedMotion()` (RESEARCH Pitfall 1). `useReducedMotionShared()` writes a `useSharedValue<boolean>` `.value` (never setState) so the Skia loop reads it via `useDerivedValue` with no per-frame re-render; `useReducedMotion()` is a separate state-backed boolean twin for React-tree crossfade-vs-instant decisions — Skia never driven from the boolean. Each hook owns ONE controller instance (own listener, no shared subscription); a post-dispose seed resolve is disposed-flag-guarded (T-23-07). Motion tokens (motion.ts) = MOTION fast(120)/base(200)/slow(320) ms durations + `ambient` per-second SPEED constant (a rate, NOT a duration — the exact shape Plan 06's Orrery worklet multiplies into useDerivedValue; tunable via top-of-file AMBIENT_SPEED) + EASING standard/decelerate pure-data descriptors (no reanimated Easing import — node-importable/RN-free). Consumers import `@/theme/use-reduced-motion` + `@/theme/tokens/motion` directly (no barrel edit). 11 node tests; tsc + check:colors + full suite (2035) green; no deviations. Device UAT (toggle OS reduced motion mid-session → Plan 06 ambient halts live) deferred to end-of-phase Pixel pass (no Plan 06 consumer exists yet). 2 commits (ea314b3 hook; 552cb36 tokens).
- [Phase 24.1]: Migration 016 is additive-only; Memory types remain application-owned with a provisional general label.
- [Phase 24.1]: Memory writes validate the registry and use the shared non-reentrant transaction; Things-to-Remember is registered in both profile stacks.
- [Phase 24.1]: Memory edits validate effective persisted Custom state inside the write transaction.
- [Phase 24.1]: Memory visibility fails visible for unknown types and is presentation-only.
- [Phase 24.1]: Memory delete and restore remain UPDATE-only soft lifecycle operations.
- [Phase 24.1]: Relationship writes reject self-links and merge clears both intra-merge link directions before reparenting.
- [Phase 24.1]: Relationship stale expiry rechecks the full window predicate under the shared write lock before permanent deletion.
- [Phase 24.1]: Knowledge purge explicitly fans out without tombstones until Phase 24.2 owns backup manifest coverage.
- [Phase 24.1]: Current-state mutations demote then insert/promote inside one shared write transaction, preserving every prior value.
- [Phase 24.1]: Malformed legacy current-state keys are omitted from the batched UI map but deliberately retained in SQLite.
- [Phase 24.1]: Gravity and intensity are derived locally at read time from one impact-input load and are never persisted.
- [Phase 24.1]: 24.1-05: Automated expiry uses the strict under-lock stale predicate; the user purge remains guarded by soft-delete state.
- [Phase 24.1]: 24.1-05: Memories and Undo-only relationships share a 30-day foreground-launch trash retention window.
- [Phase 24.1]: Things-to-Remember partitions live visibility in the UI so hidden rows remain locally recoverable.
- [Phase 24.1]: Derived gravity and intensity stay read-only, local, and never stored.
- [Phase 24.1]: History and Recently Deleted route types are shared by both contact stacks.
- [Phase 24.1]: Permanent memory deletion remains constrained to Recently Deleted behind the shared destructive confirmation dialog.
- [Phase 24.1]: Current-state history separates the current record and filters prior entries to is_current = 0.
- [Phase 24.1]: Relationship persistence remains parent-owned with an Undo-only recovery flow.
- [Phase 24.2]: Migration 017 preserves every retired share or AI fuel row as an AI-off Memory before deletion.
- [Phase 24.2]: Memory AI eligibility is explicit allow_ai state in SQL and defaults to off.
- [Phase 24.2]: Search SQL selects eligibility only; bounded matching, including one-edit typos, stays in TypeScript.
- [Phase 24.2]: Knowledge search folds diacritics and tokenizes punctuation through one shared TypeScript boundary.
- [Phase 24.2]: KNOW-10 corpus SQL selects eligibility only and returns source-tagged raw entries; typo matching stays in TypeScript.
- [Phase 24.2]: Memory type aiDefault applies only during insertion; existing allow_ai rows stay explicit.
- [Phase 24.2]: The interim global AI availability gate is app_settings.ai_provider != none and fails closed; Phase 36 owns its replacement/composition.
- [Phase 24.2]: Off Limits remains separate from AI permission; RANKED_FUEL_EXCLUSIONS remains unchanged under ADR-036/050/078.
- [Phase 24.2]: 24.2-04: URL/email/phone validators are permissive read-time checks that preserve valid raw TEXT byte-for-byte and flag failures.
- [Phase 24.2]: 24.2-04: Photo remains a supported field type; URL, Email, and Phone extend the picker and FieldType union to ten.
- [Phase 24.2]: 24.2-04: URL/email-address/phone-pad hints are forwarded via optional FieldWidgetProps.keyboardType.
- [Phase 24.2]: createField rejects contact scope until Phase 31 delivers scoped creation with durable ownership, purge semantics, and edit filtering.
- [Phase 24.2]: Retained custom-field history is additive and appended before updateContactFull overwrites the current raw TEXT value.
- [Phase 24.2]: Android contacts preserve the first non-blank Note row where providers expose more than one.
- [Phase 24.2]: Imported provider notes remain raw and become imported, import-provenance Memories with allow_ai seeded to 0.
- [Phase 24.2]: The already_linked outcome deliberately writes no note because it creates no new contact.

### Pending Todos

- **[Phase 17, minor] Validate restore progress with imported photo library.** Deferred device-UAT observation: use an import-sized disposable photo library to capture the transient applying/progress treatment and Back-interruption behavior. See `.planning/todos/pending/2026-08-26-validate-restore-progress-with-imported-photo-library.md`.
- **[08-07, owner decision] Dashboard Settings entry point — RESOLVED (2026-08-16, Plan 09).** The owner approved a top-right Settings gear (`dashboard-settings-entry`, accessibilityLabel "Settings") → `navigate("Settings")`, added in 08-09 (commit `e9b6efb`). Settings / CustomFields / Archived-via-Settings / Manage-favourites-row are reachable again. Exact gear styling is the owner's later design pass (a token-coloured ⚙ glyph ships for now).

### Blockers/Concerns

- **Build/test pipeline — RESOLVED / PROVEN (Phase 1, 2026-08-14).** FND-01 proved the full loop on
  the physical Pixel 6 Pro. Findings: `ssh droid` resolves via **Tailscale MagicDNS** (no
  `~/.ssh/config` Host block needed); Windows user is **`bwales`** (repo path
  `C:\Users\bwales\projects\orbit-app`, not `bwles`); `droid` has **JDK 17 + Android SDK** but **no
  `rsync`** → transport is **`scp`/tar-over-ssh** (rsync/scp/ssh allowed in `settings.local.json`;
  global `git push` deny intact). Loop: commit → tar-over-ssh to `droid` → `npm ci` + `expo prebuild
  --clean` (`CI=1`) + `gradlew.bat assembleRelease` → scp APK back → `adb -s 1A071FDEE002BU install`
  on the Pixel. Full runbook: `docs/runbooks/desktop-build-pipeline.md`. This box still cannot build
  APKs; on-device verification remains Pixel-only. Package id locked: `com.bwales.orbit` (display
  name is a `src/constants/app-name.json` constant — owner may rename later).

- **Autonomous foundation gate — SATISFIED (2026-08-15).** The `--to 3` human look happened, and
  Phase 4 has since run with `--converge` (convergence is enabled; reviewers = codex + claude, owner
  overrode the Claude-self-review guard). Resume the remaining phases with:
  `/gsd-autonomous --from 5 --to 8 --converge --claude --codex --claude --max-cycles 3`.

- **Graphify — RESOLVED (v1.0 close).** `.planning/config.json` now sets `graphify.enabled: true`; the
  ADR-bridge scripts (`docs/decisions/adr-registry.ts`, `scripts/normalize-graph-docrefs.ts`) and the
  build-blocking hooks are in place. Build **only** via `npm run graph:build` — the stock
  `graphify build` silently corrupts the graph and is blocked at the harness layer.

## Deferred Items

For v2.0, the hand-off lists are REQUIREMENTS.md "Out of Scope" + "Deferred-planning phases" and each
milestone-2 dossier's own `[DEFERRED]`/`[REJECTED]` items (binding there). The v1.0 equivalents live in
`milestones/v1.0-REQUIREMENTS.md` and the per-domain "Deferred to phase discussion / planning" sections
of `docs/dossier/*.md`.

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| debug_sessions | knowledge-base | unknown | 2026-09-01 | v1.0 |
| debug_sessions | manual-export-failure | investigating | 2026-09-01 | v1.0 |
| debug_sessions | replace-apply-failure | awaiting_human_verify | 2026-09-01 | v1.0 |
| debug_sessions | replace-preview-expiry | awaiting_human_verify | 2026-09-01 | v1.0 |
| debug_sessions | wave1-integration-regressions | awaiting_human_verify | 2026-09-01 | v1.0 |
| todos | 2026-08-26-validate-restore-progress-with-imported-photo-library.md | (presence-only) | 2026-09-01 | v1.0 |
| uat_gaps | 11/11-UAT-NOTES.md | 0 pending scenarios | 2026-09-01 | v1.0 |
| uat_gaps | 16/16-UPGRADE-UAT.md | 0 pending scenarios | 2026-09-01 | v1.0 |
| uat_gaps | 19/19-DEVICE-UAT-FINDINGS.md | 0 pending scenarios | 2026-09-01 | v1.0 |
| uat_gaps | 19.1/19.1-DEVICE-UAT.md | 0 pending scenarios | 2026-09-01 | v1.0 |
| uat_gaps | 20/20-UAT-BLOCKER-read-contacts.md | resolved by ADR-003 (stale header) | 2026-09-01 | v1.0 |
| uat_gaps | 20/20-UAT-FINDINGS-reconcile-bugs.md | 0 pending scenarios | 2026-09-01 | v1.0 |
| uat_gaps | 20/20-UAT-HANDOFF.md | 0 pending scenarios | 2026-09-01 | v1.0 |
| uat_gaps | 20/20-UAT-RUNBOOK-RESEARCH.md | 0 pending scenarios | 2026-09-01 | v1.0 |
| uat_gaps | 20/20-UAT.md | all-8-pass, owner-signed-off | 2026-09-01 | v1.0 |
| uat_gaps | 21/21-UAT.md | signed-off (owner) | 2026-09-01 | v1.0 |
| deferred_items | 10/deferred-items.md: pre-existing biome drift on main | acknowledged | 2026-09-01 | v1.0 |
| deferred_items | 14/deferred-items.md: pre-existing noArrayIndexKey in ComposeScreen | acknowledged | 2026-09-01 | v1.0 |
| deferred_items | 18.1/deferred-items.md: pre-existing ComposeScreen biome findings | acknowledged | 2026-09-01 | v1.0 |
| deferred_items | 18.2/deferred-items.md: pre-existing check:colors test-fixture colour | acknowledged | 2026-09-01 | v1.0 |
| deferred_items | 21/deferred-items.md: pre-existing ComposeScreen unused import + key | acknowledged | 2026-09-01 | v1.0 |

_Also disposed at this close: 05/deferred-items.md (check:colors doc-comment) marked **resolved** — genuinely fixed during Phase 5 Wave 3, not deferred._

## Session

**Last session:** 2026-09-04T19:42:05.350Z
**Stopped at:** Completed 24.2-06-PLAN.md
_Prior stop (v1.0):_ Phase 21 UI-SPEC approved; milestone v1.0 closed 2026-09-01.
_Prior stop (13-04):_ the orrery VISUAL VOCABULARY (theme tokens + two pure resolver modules, node-tested, 29 cases green): (1) five owner-tunable `ThemePalette` tokens seeded in `space-dark.dark` ONLY — `starPalette` (6 colours, gold `#F2C14E` at index 0, then amber/rose-red/violet/cyan/ice-white), `mutedStable/Wobble/Decay` (desaturated same-hue morph endpoints), `rogueExtinguished` (cold blue-grey `#3E4A6B` rogue BODY fill) — with an M6/C2-5 conformance test that IMPORTS the real `SELF_SUN_COLOUR_RE`/`assertSelfSunColour` from app-settings-dao and locks every starPalette entry to the ACTUAL DAO write-path rule (no re-inlined regex). (2) `orrery-ring-logic.ts` `orreryRingStyle(status, colors)` — REUSES `ringVisual` for `{color,opacity,width}` (status→colour mapped once), adds the `strokeStyle` axis (solid→dashed→faded→faintTrace) + `bodyFill` (rogue ring=`colors.rogue`, body=`rogueExtinguished`); `null`→canonical NEUTRAL (`colors.border`), never throws — the single fallback sun-occupant reuses (C2-2). (3) `sun-occupant-logic.ts` `resolveSunOccupant(input)` — NULL/archived/missing→self (A7, glow `selfSunColour ?? starPalette[0]`), live contact→its status glow via `orreryRingStyle(status, colors).color`, never-contacted (status `null`)→the reused neutral border (C2-2); accepts `status: ProfileStatus | null`. 5 commits (1801915 feat tokens+M6; d35d528 RED→4cbfad5 GREEN ring-logic; c923b16 RED→10780dd GREEN sun-occupant); tsc + check:colors clean; no deviations (one in-flight fix: a placeholder hex in the logic test was re-sourced from the palette after check:colors flagged it — C2-3). Committed locally on main (NOT pushed). Next: Wave 2 (13-05 render / 13-06 Settings sun-picker), Wave 3 (13-07 drag-release), Wave 4 (13-08 device UAT, autonomous:false).
**Resume file:** None
are archived under `.planning/milestones/v1.0-phases/`.)

## Phase 4 — Closeout (2026-08-15) ✅ COMPLETE

Phase 4 (Contact CRUD & Lifecycle) is **DONE**: all 9 plans executed; cross-AI plan convergence
(2 cycles, codex + claude) + code review (0 blockers, WR-01/WR-02 fixed) applied; 343 unit tests green
(tsc / check:colors / biome clean); and **on-device UAT PASSED on the physical Pixel** — a release APK
was built via the desktop pipeline and driven through create→edit→archive→purge, the last-spoke ruling
(both branches), the WR-01 on-focus refresh, and the danger purge-confirm (see 04-VERIFICATION.md
"On-device UAT"). Verification status: **passed**.

**Optional (non-blocking) items — these do NOT hold Phase 5:**

- code-review **WR-03**: the edit form always upserts an all-null `contact_custom_values` row, bumping
  `modified_at` (harmless now; adds Phase-16 restore-merge churn) — a product/merge-semantics call.

- **ROADMAP.md** launch-sweep line lists "archived-contact purge (Phase 4)", contradicting the UI-SPEC
  indefinite-retention copy the code follows — fix the line, or confirm auto-expiry was intended.

- 3 minor UI affordances not tapped on-device (they render correctly): a link's tap-to-open, the native
  date picker via "Pick date", and the Restore action.

## Operator Next Steps

- Phase 22 plans converged (6 plans, 5 waves; 5-cycle cross-AI review, 0 HIGH). Review the plans if desired:
  `cat .planning/phases/22-app-shell-navigation/22-0{1..6}-PLAN.md`.

- Execute the phase: `/gsd-execute-phase 22` (Wave 1 is the four-tab-shell tracer, verified before chrome).
- Optional before executing: `/gsd-validate-phase 22` to finalize the Nyquist VALIDATION.md sign-off
  (non-blocking), and `/gsd-review --phase 22 --all` for cross-AI plan review.

- Commits stay local — agents never push; push when you're ready.
