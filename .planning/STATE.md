---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 8
current_phase_name: Dashboard & Never-Contacted Screen
status: ready
stopped_at: Phase 8 PLANNED + cross-AI converged (3 cycles, codex+claude, 12 findings resolved) — awaiting owner usage-headroom OK before execute
last_updated: "2026-08-16T04:40:17.643Z"
last_activity: 2026-08-16
last_activity_desc: Phase 8 execution started
progress:
  total_phases: 16
  completed_phases: 7
  total_plans: 56
  completed_plans: 50
  percent: 44
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-14)

**Core value:** Collapse the taps between "you're overdue with X" and the message actually being sent.
**Current focus:** Phase 8 — Dashboard & Never-Contacted Screen

## Current Position

Phase: 8 (Dashboard & Never-Contacted Screen) — EXECUTING
Next: on-device UAT on the Pixel (fuel search: a name and a fuel word both return the contact; off_limits-only term returns no match; archived contact never appears — plus the 07-03 Suggested-by-AI/Confirm/Dismiss flow) + `/gsd-verify-work 7`
Last activity: 2026-08-16 — Phase 8 execution started

Progress: [████░░░░░░] 38% (6/16 phases complete)

## Performance Metrics

**Velocity:**

- Total plans completed: 20
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 5 | - | - |
| 2 | 6 | - | - |
| 3 | 8 | - | - |

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

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table, and authoritatively in docs/dossier/ + HANDOFF.md.
Foundational decisions affecting current work:

- The dossier (docs/dossier/, 15 domains + INDEX cross-domain constraint log) and HANDOFF.md are the
  authoritative decision record; `[DECIDED]`/`[REJECTED]` items are implemented, not reopened.

- Config: fine granularity (16 phases, one per domain), Vertical MVP, sequential execution (YOLO,
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

### Pending Todos

None yet.

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

- **Graphify is disabled** in config until its ADR-bridge scripts (`adr-registry.ts`,
  `normalize-graph-docrefs.ts`) and build-blocking hooks are ported from quest-board (a Phase 1/2
  foundation task). Do not run `graphify build` before then — the stock build silently corrupts.

## Deferred Items

See REQUIREMENTS.md "v2 / Deferred Requirements" and the per-domain "Deferred to phase discussion /
planning" sections in docs/dossier/*.md — those are the authoritative hand-off lists for each phase's
`/gsd-discuss-phase` and `/gsd-plan-phase` steps.

## Session

**Last session:** 2026-08-16T04:55:00.000Z
**Stopped at:** Completed 08-04-PLAN.md (dashboard UI primitives: ContactCard + FilterChipRow + dashboard-prefs-store — DASH-02/03/07)
**Resume file:** None

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
