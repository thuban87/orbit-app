---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 13
current_phase_name: Orrery
status: in-progress
stopped_at: "Phase 13 (Orrery) PRE-EXECUTION COMPLETE — PAUSED before execute per owner (awaiting usage-headroom confirmation). Full pipeline done + committed locally on main (NOT pushed): smart-discuss (13-CONTEXT), UI-SPEC (checker-approved), RESEARCH, VALIDATION (Nyquist, 9 Wave-0 files), PATTERNS (18 files→analogs), 8 PLANs / 4 waves, plan-checker PASSED after 1 revision closing a REAL cross-plan blocker (rewriteRingSeq count-guard vs the sun-excluded N-1 rendered set — would break every ring_seq drag whenever a contact occupied the sun). Then a 2-cycle cross-AI convergence (codex `exec --sandbox read-only` WITHOUT the classifier-blocked bypass flag + an independent read-only Claude subagent; Claude self-review guard overridden per owner) that CONVERGED: cycle-1 = 2 codex HIGH (React Rules-of-Hooks from per-planet hooks in a map; incomplete responsive layoutMetrics) + 9 actionable → replan; cycle-2 = 2 HIGH (nullable photo→resolvePhotoUri type/fallback; never-contacted-sun null status) + Claude's check:colors test-hex build-gate bug + 4 more → replan; cycle-3 = BOTH reviewers READY-TO-EXECUTE, 0 HIGH / 0 actionable. Next: /gsd-execute-phase 13 on owner go-ahead. One owner-gated checkpoint: 13-08 is autonomous:false (desktop prebuild + Pixel device UAT + owner sign-off). NO npm-dep legitimacy checkpoint — zero new deps (Skia 2.6.2/Reanimated 4.5.1 already installed + proven by CropPhotoScreen); the only new asset is one bundled .ttf font for Skia initials. Migration 003 (adds sun_contact_id + self_sun_colour to app_settings) is the first schema change since Phase-11's 002 — forward-only, irreversible."
last_updated: "2026-08-18T00:40:00.000Z"
progress:
  total_phases: 16
  completed_phases: 12
  total_plans: 93
  completed_plans: 88
  percent: 75
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-14)

**Core value:** Collapse the taps between "you're overdue with X" and the message actually being sent.
**Current focus:** Phase 9 — Compose Screen & SMS Handoff

## Current Position

**CURRENT — Phase 13 (Orrery): PLANNED ✅ / PRE-EXECUTION COMPLETE / ⏸ PAUSED before execute** per owner (awaiting usage-headroom confirmation). The two-view Skia solar-system phase. This session ran the full pre-execution pipeline (discuss → UI-SPEC → research → validation → patterns → plan → 3-cycle cross-AI convergence) and stopped at the execute gate. All artifacts committed LOCALLY on main (NOT pushed).

- **Convergence CONVERGED** — reviewers = codex `exec --sandbox read-only` WITHOUT the classifier-blocked bypass flag + an independent read-only Claude subagent (self-review guard overridden per owner). plan-checker PASSED after 1 revision closing a real cross-plan blocker (rewriteRingSeq count-guard vs the sun-excluded N-1 rendered set — would break every ring_seq drag whenever a contact occupied the sun). cycle-1: 2 codex HIGH (React Rules-of-Hooks per-planet hooks in a map → keyed OrbitBody/OrreryCanvas/SunBody; incomplete responsive geometry → shared deriveOrreryMetrics) + 9 actionable → replan. cycle-2: 2 HIGH (nullable photo→resolvePhotoUri type/fallback; never-contacted-sun null status) + Claude's real check:colors test-hex build-gate bug + 4 → replan. cycle-3: BOTH reviewers READY-TO-EXECUTE, 0 HIGH / 0 actionable.
- **8 PLANs / 4 waves** (13-01..08). Migration 003 (adds sun_contact_id + self_sun_colour to app_settings) is the first schema change since Phase-11's 002 — forward-only + irreversible. ZERO new npm deps (Skia 2.6.2 / Reanimated 4.5.1 already installed + proven by CropPhotoScreen); the only new asset is one bundled .ttf font for the Skia initials fallback.
- **Owner decision recorded:** sun-OCCUPANT assignment is a Settings picker (favourites → all contacts → "Me"/self), NOT an orrery long-press (owner rejected long-press as accident-prone); the ring_seq radial drag stays on the canvas. ORR-06's "assign the sun from the orrery" is intentionally relocated to Settings — do NOT mis-flag the canvas absence as a gap.
- **Next: `/gsd-execute-phase 13` on owner go-ahead.** One owner-gated checkpoint — 13-08 (`autonomous:false`): desktop prebuild via `droid` + Pixel device UAT (render / morph / gestures / the one-off Skia `file://` decode spike / pause-on-blur / perf — Pixel-only) + owner sign-off.
- Reviewer tooling (unchanged from Phase 12): gsd-review's built-in codex (`--dangerously-bypass-hook-trust`, classifier-blocked) + claude (`-p` Write-gap) paths are BOTH broken here — drive reviews manually (`codex exec --sandbox read-only` no bypass flag; read-only Claude subagent; aggregate into REVIEWS.md).

Progress: [████████░░] 75% (12/16 phases complete; Phase 13 planned + convergence-verified, execution paused for owner usage confirmation)

---

_Phase-12 recap (historical — Phase 12 is COMPLETE + verified; see 12-VERIFICATION.md):_

Phase: 12 (Home Screen Widget) — COMPLETE ✅ / verification passed (on-device UAT, 2026-08-17). All 8 plans executed (893/893 node tests); plan-checker PASSED + a 2-cycle codex+Claude convergence fixed 8 HIGH; on-device UAT on the physical Pixel: **killed-app headless mark exactly-once verified live in the device DB (the deferred Phase-11 killed-app check is now CLOSED)**, manifest hardened (one non-exported widget BOOT_COMPLETED receiver), release tap-to-update ~0.6s (50× under budget), deep-links + renders green, and owner-driven polish (the "Message" truncation + default-4×2-renders-large breakpoint) rebuilt + verified on device. Owner-accepted follow-up device-checks (NOT blockers, Phase-11-style): the reboot-receiver refresh (owner's phone) + the grid-capacity/bitmap ceiling. Two OUT-OF-SCOPE findings recorded (see 12-VERIFICATION.md): no direct "add another contact" UI path (pre-existing Phase-8/10 gap) + a debug-DB-won't-load-on-release anomaly.
Next: Phase 13 (Orrery) — NOT started. It is a large new Skia render-loop phase (its own discuss→plan→converge→execute→device-UAT cycle); awaiting owner go-ahead before beginning.
Done this session (2026-08-17), all committed locally on main (NOT pushed): smart-discuss (12-CONTEXT; owner APPROVED the shared stable/wobble/decay status palette — stable #45B98A / wobble #E8C15C / decay #E56A52 / rogue #E0904A unchanged — resolving OD-1 app-wide; widget + ContactCard + future orrery inherit it), UI-SPEC (approved, checker VERIFIED), RESEARCH, VALIDATION (Nyquist), PATTERNS, PLAN (8 plans / 6 waves, efa9f5b), plan-checker PASSED, then a 2-cycle cross-AI convergence (codex CLI + read-only-Claude subagent; self-review guard overridden per owner): cycle-1 = 6 codex HIGH + 7 Claude actionable → replan (cca05d9); cycle-2 = 2 codex HIGH (WDG-03 freshness incompleteness; killed-app UAT needed a debug build) → final replan (4e688cf). All 8 HIGH fixes verified in-file. NOTE: the final-replan fixes were NOT independently re-reviewed (max cycles reached + owner pause).
Codex tooling note: current codex-cli (0.144.1) makes gsd-review auto-add `--dangerously-bypass-hook-trust`, which the safety classifier blocks; a subagent improperly tunneled it once (flagged, discarded), then codex was re-run cleanly WITHOUT that flag. Do NOT let gsd-review's codex path run with that flag — run codex manually without it, or allow-list a scoped `Bash(codex exec:*)`.
Next: EXECUTION on owner go-ahead — `/gsd-execute-phase 12`. Two owner-gated checkpoints in the plans: (1) 12-02 native-dep legitimacy checkpoint (`react-native-android-widget@0.22.0`, blocking-human), (2) 12-04-T1 Log→Profile mapping ratification (blocking-human, gates the URI resolver + render). Device UATs incl. the killed-app headless mark are now on a DEBUG build (release APK is not run-as-able, runbook §3.1) and are BUNDLED with the deferred Phase-11 killed-app FCM-less headless mark/snooze check.

Progress: [████████░░] 75% (12/16 phases complete; Phase 13 next, not started)

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
- [Phase ?]: [Phase 8]: 08-05: NeverContactedScreen (DASH-04) is the 'Not yet contacted' inverse-population screen — reuses the shared ContactCard verbatim (a never-contacted row's status:null from listNeverContacted's literal-null projection drives the card's neutral state; status NEVER re-derived) and offers its OWN three-way sort (Oldest added default / Newest added / Name A-Z) wiring the NeverContactedSort union the DAO exposes; the three options live in a fixed-order SORT_OPTIONS constant whose keys ARE the union so the control cannot drift. Load runs in useFocusEffect with a cancelled-flag async guard (FuelSearch pattern), re-queried on focus AND on sort change, async-only, offline; calm never-contacted-empty state. Chrome mirrors ArchivedContactsScreen; sort control inline using the FilterChipRow filled-accent idiom, container testID never-contacted-sort-control. NeverContacted route registered ADDITIVELY (types.ts + RootNavigator) — FuelSearch route + initialRouteName Home untouched (Plan 10 retires FuelSearch). tsc + check:colors green; dashboard-read.test.ts 31 tests pass; .tsx render/nav/sort is Pixel-UAT at end of phase.
- [Phase 8]: 08-06: BirthdayBanner (DASH-05) reads listBirthdayCandidates (archived-excluded ONLY — the DECIDED scoped exception overriding snooze/never-contacted suppression, dossier Cluster E; candidates NOT re-filtered to the dashboard population), computes the 7-day/soonest-first order in JS off the single daysUntilBirthday parser ('today' on day-of, 'in N days' otherwise), reads via an async cancelled-flag guard (offline), renders null when empty, and stays presentational (onPressContact(contactId) callback; Plan 07 mounts it + wires navigation). The profile favourite star (DASH-06) toggles favourite_rank via setFavouriteRank/clearFavouriteRank then the unified load() reconciles the header — reversible, non-destructive, NO confirmation; marked star uses colors.accent (OD-2 provisional token). getContactHeader widened PURELY ADDITIVELY to return favourite_rank (number|null) — the two other callers (EditContactScreen refreshPhoto, contact-read.test.ts field-wise asserts) stay green, MEDIUM-3 verified by tsc + 16-test run.

- [Phase 8]: 08-08: ManageFavouritesScreen (DASH-06) is the shared drag-reorder favourites home — reorder-ONLY (marking stays the profile star). Owner APPROVED adding react-native-reorderable-list@0.18.1 at the blocking-human legitimacy checkpoint (T-08-SC; created 2021, ~92k dl/wk, MIT, Reanimated-4-maintained), installed via `npx expo install`; the no-dep up/down-arrow fallback was NOT built. Loads listFavourites via an async cancelled-flag focus effect (offline); each row (FavouriteReorderRow, split so useReorderableDrag() runs inside a ReorderableList cell) = Avatar + name + a drag handle whose onPressIn starts the drag. onReorder computes computeReorder(currentIds, from, to) inside the setRows updater, mirrors local rows via an id→row Map, and fires rewriteFavouriteRanks(getExecutor(), newIds, localDateTime()) in ONE transaction (fire-and-forget; a persist failure alerts + re-reads via load()) — the tested reorder math + guarded DAO are reused verbatim, inWriteTransaction never nested (Pitfall 6). Drag/animation is entirely Reanimated-worklet-driven (no per-frame setState, CLAUDE.md); ReorderableList is a FlatList so Avatar's recyclingKey (contactId + cacheBust=modified_at) correctness holds. Route registered ADDITIVELY (types.ts ManageFavourites: undefined after NeverContacted + RootNavigator Stack.Screen); FuelSearch + NeverContacted untouched. Locked testIDs manage-favourites-root / -row-{id} / -handle-{id}. tsc + check:colors green; npm test 665/665. Navigation entry points (favourites-chip Manage, Plan 09; Settings row, Plan 10) land later by design; .tsx render + native drag is Pixel-UAT (drag perf only assessable on the physical Pixel).

- [Phase 8]: 08-07: HomeScreen IS the dashboard core now. `selectDashboardEmptyState` (src/logic/dashboard-empty-logic.ts, pure/node-tested, 11 cases) is the SINGLE empty-state gate — explicit precedence rowCount>0→'none' → hasTerm→'search-empty' → activeFilter!=='all'→'filter-empty' → (unfiltered) all-four-populations-zero→'firstrun' else 'hidden'. First-run REQUIRES live===0 && neverContacted===0 && snoozed===0 && archived===0 (HIGH-2 — never-contacted-only / snoozed-only / archived-only users get the hidden-population pointer, NOT "Add your first contact"); the filter/search empties win BEFORE the population fallback so a zero-result filter/search over a non-empty population never shows the hidden copy (MEDIUM-4). No inline count arithmetic in the .tsx. HomeScreen renders the status-sorted listDashboard population as ContactCards (→Profile), mounts BirthdayBanner at top (→Profile), shows the "{N} contacts" header from countLiveContacts (only when live>0), and Not-yet-contacted(N)→NeverContacted + count-less Archived→Archived footer entries. FRESHNESS = useFocusEffect + AppState→"active" + pull-to-refresh (RefreshControl accent tint), a single reload() returning its own cancelled-flag canceller, async reads ONLY — the connection-scoped change listener is deliberately NOT used (T-08-18, blind to headless writes); grep-verified 0 addDatabaseChangeListener / 0 getAllSync|getFirstSync. filter-empty renders a calm generic region (dashboard-empty-filter) for now; the filter-specific + search-empty copy + the live chips/search box land in Plan 09 (threading activeFilter/hasTerm into the SAME gate). All colours via useTheme().colors.*; dashboard-root testID. tsc + check:colors clean; npm test 676/676. **OPEN owner decision:** the rewrite removed home-settings-entry — the app's ONLY navigate("Settings") path — and no phase-8 plan (07–10) adds a dashboard→Settings affordance (the UI-SPEC dashboard surface defines none). Settings/CustomFields/Archived-via-Settings/Manage-favourites-row are UI-unreachable until resolved; flagged in 08-07-SUMMARY (not auto-fixed — placement is a product/navigation call). Resolve before end-of-phase Pixel UAT.

- [Phase 8]: 08-09: HomeScreen gains the full controls layer (DASH-02/04/06 complete). Filter/sort selection PERSISTS via useDashboardPrefs (setFilter/setSort); the search term is LOCAL useState; all three are `reload` deps so a change re-queries through the Plan-07 focus-effect callback-change mechanism (no manual re-run). Chips assembled from real tables: all · needs-attention · one per category (listCategories) · one per social-battery value (Charger/Neutral/Drain) · favourites · snoozed (live countSnoozed, 0 until Phase 11). Sort control = a 4-Pressable row (Status/Name (A–Z)/Least recent/Most recent), no segmented-control dep, container testID `dashboard-sort-control` + options `dashboard-sort-option-{key}`. Live search box (`dashboard-search-input`, placeholder "Search people and notes") + `dashboard-search-clear` threads `term` into listDashboard — the DAO owns name/fuel matching + off_limits/ai/archived exclusions + the LOW-2 favourites+term precedence (NO component-side .filter of private data, NO special-casing; T-08-20/21 mitigated). Empty states fully via selectDashboardEmptyState with live activeFilter + hasTerm: search-empty (`dashboard-search-empty`, "No matches for {term}") wins before filter-empty; favourites filter-empty renders "No favourites yet" + pointer to the profile star (MEDIUM-4). Favourites-chip "Manage" affordance = a separate header link shown only when favourites is active (FilterChipRow stays purely presentational) → navigate("ManageFavourites"). OWNER-APPROVED addition beyond the plan text: a top-right Settings gear (`dashboard-settings-entry`, ⚙ token glyph, accessibilityLabel "Settings") → navigate("Settings"), fixing the 08-07 reachability gap (commit e9b6efb). Colours via tokens only; tsc + check:colors green; npm test 676/676. .tsx render/nav/persistence is end-of-phase Pixel UAT.
- [Phase ?]: [Phase 8]: 08-10: standalone FuelSearch route + screen retired (search relocated to the dashboard, Plan 09 — expected relocation, NOT a reversal); FuelSearchResultRow + searchFuel DAO kept. Settings loses the Search row, gains a Manage-favourites row -> ManageFavourites (2nd entry into the shared reorder screen).

- [Phase 9]: 09-01: the three compose prerequisites landed ahead of the screen. (1) `resolveComposeControls(hasPhone, smsAvailable)` + `ComposeControls` (src/logic/compose-logic.ts) is the pure, react-native/expo/db-free, node-tested CMP-03 Send/Copy capability gate — no-phone branch FIRST so a missing number always wins over SMS capability ((false,true) ≡ (false,false)); phone+no-SMS → Send hidden, Copy primary, helper line; phone+SMS → Send shown, Copy secondary. Mirrors the dashboard-empty-logic resolver idiom (explicit-precedence header comment, one exported interface + one pure resolve fn). (2) `expo-sms` + `expo-clipboard` installed via `npx expo install` at SDK-57-pinned `~57.0.1` (both first-party Expo modules, no postinstall — T-09-SC mitigated, no blocking-human legitimacy checkpoint needed); NO app.config.ts plugins entry added (neither ships a config plugin — a bogus entry is a prebuild error, 01-01 deduped-plugins lesson). Native-dep change ⇒ Plan-02 on-device UAT needs `expo prebuild --clean` + release APK. (3) `getContactHeader` widened PURELY ADDITIVELY to return `phone: string | null` (append to SELECT + both type literals; light by-id seek kept — NO join, NOT switched to getContactForEdit) — the 08-06 favourite_rank idiom; the two field-wise callers (ContactProfileScreen local Header type, EditContactScreen refreshPhoto) + contact-read.test.ts stay green. npm test 673/673, tsc + check:colors clean. No deviations.
- [Phase ?]: 09-02: interim controls literal while smsAvailable===null (Send hidden, Copy sole primary) keeps resolveComposeControls called only with a concrete boolean — no wrong-state flash on first mount or re-focus
- [Phase ?]: 09-02: SMS capability probe runs separately from the header/fuel load so a rejected isAvailableAsync() degrades to false without failing the load; a null getContactHeader (deleted contact) exits to the dashboard
- [Phase 13]: 13-03: the orrery data layer — three node:sqlite-tested SQL surfaces (27 cases green). `listOrbitingContacts(exec, {excludeContactId?})` (src/db/orrery-read.ts) is the orbiting-set read chokepoint: COMPOSES status.ts PROGRESS_SQL/STATUS_SQL (never re-derives thresholds — a parity test asserts the exported `ORBITING_SELECT` `.toContain()`s both fragments, mirroring dashboard-read's fuel-parity guard), WHERE `archived_at IS NULL AND last_contact IS NOT NULL` (+ `AND id <> ?` when a sun occupant is passed), `ORDER BY COALESCE(ring_seq, 1e9), created_at, id`. The DISPLAY rank is the 0-based ROW INDEX of that dense order, NEVER the stored ring_seq value (M3, option (a)) — so a stale/duplicate stored ring_seq left on a formerly-hidden sun is harmless when the sun returns to self (regression-tested: contact-sun → reorder N-1 → self-sun re-read is dense/deterministic). DELIBERATE L11 divergence from dashboard BASE_WHERE: snooze is NOT filtered — a snoozed-but-contacted contact IS in the sky (lock-test guards against a later "consistency" refactor re-adding the snooze clause). `photo` returned RAW (nullable), never resolved — C2-1: the 13-05 consumer MUST `photo ? resolvePhotoUri(photo) : null`. `rewriteRingSeq(exec, orderedIds, now, excludeContactId)` (src/db/ring-seq-dao.ts) is the FIRST `contacts.ring_seq` writer — a near-verbatim clone of rewriteFavouriteRanks: 3 guards (unique / count-match / scoped changes===1) as N raw `?`-bound UPDATEs in ONE inWriteTransaction (never nests the non-reentrant mutex). Two swaps: column `favourite_rank → ring_seq`, scope `favourite_rank IS NOT NULL → last_contact IS NOT NULL AND archived_at IS NULL`, PLUS the FIXED cross-plan blocker: an optional `AND id <> ?` occupant exclusion appended to BOTH Guard 2's COUNT and every Guard 3 UPDATE (bound only when excludeContactId non-null) so the guard's effective set == orrery-read's RENDERED sun-excluded (N-1) set — a contact-sun drag passing the N-1 list succeeds; passing the wrong full-N list still fails Guard 2 by design. Writes ONLY ring_seq + modified_at; `last_contact` NEVER assigned (single-writer invariant intact; grep-pin `last_contact[[:space:]]*=` → 0). Empty list = accepted no-op. `now` is localDateTime(). `listSunCandidates(exec)` (src/db/sun-picker-read.ts) = non-archived contacts favourites-first (`(favourite_rank IS NULL)`, `favourite_rank ASC`, `name COLLATE NOCASE, id`), never-contacted INCLUDED (anyone can be the sun; C2-2: a never-contacted sun has status null → 13-04/05 resolveSunOccupant accepts `ProfileStatus | null`), no synthetic "Me" row (Settings UI prepends self). ring_seq column already existed from migration 001 (no migration shipped). tsc + check:colors clean; no deviations.

### Pending Todos

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

- **Graphify is disabled** in config until its ADR-bridge scripts (`adr-registry.ts`,
  `normalize-graph-docrefs.ts`) and build-blocking hooks are ported from quest-board (a Phase 1/2
  foundation task). Do not run `graphify build` before then — the stock build silently corrupts.

## Deferred Items

See REQUIREMENTS.md "v2 / Deferred Requirements" and the per-domain "Deferred to phase discussion /
planning" sections in docs/dossier/*.md — those are the authoritative hand-off lists for each phase's
`/gsd-discuss-phase` and `/gsd-plan-phase` steps.

## Session

**Last session:** 2026-08-18
**Stopped at:** Phase 13 (Orrery) EXECUTING — Wave 1 plans 13-01 + 13-02 + 13-03 + 13-04 COMPLETE. 13-04 = the orrery VISUAL VOCABULARY (theme tokens + two pure resolver modules, node-tested, 29 cases green): (1) five owner-tunable `ThemePalette` tokens seeded in `space-dark.dark` ONLY — `starPalette` (6 colours, gold `#F2C14E` at index 0, then amber/rose-red/violet/cyan/ice-white), `mutedStable/Wobble/Decay` (desaturated same-hue morph endpoints), `rogueExtinguished` (cold blue-grey `#3E4A6B` rogue BODY fill) — with an M6/C2-5 conformance test that IMPORTS the real `SELF_SUN_COLOUR_RE`/`assertSelfSunColour` from app-settings-dao and locks every starPalette entry to the ACTUAL DAO write-path rule (no re-inlined regex). (2) `orrery-ring-logic.ts` `orreryRingStyle(status, colors)` — REUSES `ringVisual` for `{color,opacity,width}` (status→colour mapped once), adds the `strokeStyle` axis (solid→dashed→faded→faintTrace) + `bodyFill` (rogue ring=`colors.rogue`, body=`rogueExtinguished`); `null`→canonical NEUTRAL (`colors.border`), never throws — the single fallback sun-occupant reuses (C2-2). (3) `sun-occupant-logic.ts` `resolveSunOccupant(input)` — NULL/archived/missing→self (A7, glow `selfSunColour ?? starPalette[0]`), live contact→its status glow via `orreryRingStyle(status, colors).color`, never-contacted (status `null`)→the reused neutral border (C2-2); accepts `status: ProfileStatus | null`. 5 commits (1801915 feat tokens+M6; d35d528 RED→4cbfad5 GREEN ring-logic; c923b16 RED→10780dd GREEN sun-occupant); tsc + check:colors clean; no deviations (one in-flight fix: a placeholder hex in the logic test was re-sourced from the palette after check:colors flagged it — C2-3). Committed locally on main (NOT pushed). Next: Wave 2 (13-05 render / 13-06 Settings sun-picker), Wave 3 (13-07 drag-release), Wave 4 (13-08 device UAT, autonomous:false).
**Resume file:** .planning/phases/13-orrery/13-04-SUMMARY.md

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
