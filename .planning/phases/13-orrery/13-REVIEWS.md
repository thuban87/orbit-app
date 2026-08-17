---
phase: 13
reviewers: [codex, claude]
reviewed_at: 2026-08-17T19:57:48Z
cycle: 1
plans_reviewed: [13-01, 13-02, 13-03, 13-04, 13-05, 13-06, 13-07, 13-08]
note: >
  Cross-AI convergence cycle 1. Reviewers driven manually (codex `exec --sandbox read-only`
  without the classifier-blocked bypass flag; an independent read-only Claude subagent) because
  gsd-review's built-in codex/claude CLI paths are broken in this environment. Self-review guard
  overridden per owner.
---

# Cross-AI Plan Review — Phase 13 (Orrery) — Cycle 1

## Codex Review

## Summary

The plans are strong on data-layer discipline, migration safety, status reuse, and device UAT. The prior `excludeContactId` guard-alignment blocker is genuinely addressed. However, execution should not proceed unchanged: two implementation-critical gaps can cause runtime failures or broken multi-contact layouts. Overall risk: **HIGH** until those are resolved.

## Strengths
- Migration 003 is correctly additive and forward-only (matches runner.ts:47 per-step tx + version bump; registration in database.ts:24). Nullable FK/defaults preserve `NULL = self`.
- `last_contact` remains protected: one transaction, complete-set count guard, scoped per-row `changes===1`, no nested writer calls (favourites-dao.ts:75; transaction.ts:12 non-reentrancy).
- The revised contact-sun reorder contract is internally aligned (13-03:102 scopes rendered set + writer guards to live contacts minus `excludeContactId`; 13-07:112 passes the same sun id on commit) — fixes the prior N vs N−1 seam.
- Status/rogue derivation centralized: imports canonical SQL + `ROGUE_K=3` (status.ts:40,59) rather than recreating thresholds.
- Colour-token approach sound; check-colors.sh:31 scans all TS/TSX outside theme paths.
- Settings relocation of sun assignment respected — correctly NOT treated as an ORR-06 miss.

## Concerns
- **HIGH — Dynamic planet hooks may violate React's Rules of Hooks.** 13-05:102 calls `useImage` per planet; 13-07:65 `useDerivedValue` per body. If implemented in a `.map()` in `OrreryScreen`, contact-count changes change hook count and can crash. The only Skia example has ONE unconditional `useImage` (CropPhotoScreen.tsx:119). Specify keyed child components now (`OrbitBody` owns one `useImage` + its derived values; `OrreryCanvas` owns ambient hooks) — do not leave to executor interpretation.
- **HIGH — Responsive ring geometry and drag math are incomplete.** UI-SPEC requires `DRIFT_MAX` from actual canvas dimensions + proportional `RING_GAP` compression on overflow (UI-SPEC:160,164). Plan 02 defines only fixed constants (13-02:78); Plan 05 never specifies canvas measurement/effective gap; Plan 07 maps drag release using fixed `RING_GAP` (13-07:112). Without one shared `layoutMetrics`, outer contacts collapse at the drift bound and drag snaps to wrong ranks. Define measured canvas dims, `effectiveGap`, derived `DRIFT_MAX`; pass the same metrics to render, hit-testing, preview, and release-rank mapping. Add a pure test for a large contact count.
- **MEDIUM — Hiding a sun contact can corrupt stable ring ordering when the sun changes back.** Writer assigns dense `0..N−2` to visible contacts excluding the contact-sun (13-03:106); Settings changes `sunContactId` directly (13-06:87). Since `ring_seq` has no uniqueness constraint (001-initial.ts:73), restoring self-sun can reveal a stale duplicate rank and reorder via tie-breaks. Define a sun-transition invariant (preserve full ordering incl. hidden contact, or normalize the full live contacted set transactionally on sun-ownership change). Add: contact-sun → reorder N−1 → self-sun → assert intended order.
- **MEDIUM — The sun-occupant read is not concretely designed; archive behaviour can disagree between Settings and canvas.** `resolveSunOccupant` needs photo, status, archived (13-04:129), but Plan 05 only says "look the sun occupant up" (13-05:102). Existing reads split fields: contact-read.ts:65 has photo/archive not status; contact-status-read.ts:53 has status not photo/archive. Archive is only an update (contacts-dao.ts:420) so the FK will not clear the setting. Specify a dedicated read or explicit `Promise.all`; make Settings show "Me" (or clear the setting) when the selected contact is archived/missing — the same fallback the canvas uses.
- **MEDIUM — Pause-on-blur and pan hit-testing need explicit worklet ownership/data flow.** Conditionally rendering `<Canvas>` only stops `useClock` if `useClock` lives in the conditionally-mounted child; the plan does not require that boundary (13-07:88). The pan callback must identify a body on the UI thread, yet the plan describes a JS resting-body array + `runOnJS` (13-07:112). Require a worklet-safe snapshot/shared value for body positions + active dragged id, or intentionally move drag-start selection onto JS with a defined failure/latency policy. Add an acceptance check that `useClock` is inside the unmounted canvas subtree.
- **LOW — Migration test omits its most important FK action.** Proves columns/default NULL but not that deleting an assigned contact sets `sun_contact_id` back to NULL (13-01:69). The harness enforces FKs (node-sqlite.ts:16) — add assign → delete → null.
- **LOW — Plan 08 metadata conflicts with deliverables.** Frontmatter `files_modified: []` but Tasks 2–3 modify `13-VERIFICATION.md` + require a summary. Correct the allowlist.

## Risk Assessment
**HIGH** until the hook/component architecture and responsive geometry are fixed. With those addressed, the phase should meet ORR-01..06 without restoring the rejected canvas sun-assignment gesture.

---

## Claude Review

## Summary
Eight plans are unusually rigorous and, on the points that matter most, source-grounded and correct. Verified against real code: the `rewriteRingSeq` guard-alignment fix (`excludeContactId` threaded through Guard 2 `COUNT` and Guard 3 scoped `UPDATE`s) is correct AND symmetric with `listOrbitingContacts`'s exclusion, so the N−1 dragged list and the guard's effective set always agree (traced 4 cases incl. archived-sun and never-contacted-sun). Single-writer `last_contact` preserved by construction. Migration 003 genuinely additive/forward-only; FK `ADD COLUMN … REFERENCES` legal because default is NULL; no hex default stored. Requirement coverage complete once the owner-recorded Settings relocation is honored. One real cross-plan coupling: `self_sun_colour`'s DAO validator `/^#[0-9A-Fa-f]{6}$/` silently constrains the deferred `starPalette` design pass to 6-digit hex, untested. Overall risk: **LOW–MEDIUM**.

## Strengths
- Guard/exclusion symmetry provably correct: `rewriteFavouriteRanks` (favourites-dao.ts:105-143) is the clone target; the plan extends both Guard 2 `COUNT` (:118-120) and each Guard 3 `UPDATE` (:130-135) with `AND id <> ?` only when `excludeContactId` non-null. Traced 4 cases — read length and guard count move together in every case. Guard-3 `AND id <> ?` is load-bearing even against a caller that smuggles the sun id into an N−1 list.
- Single-writer `last_contact` preserved; 13-03 pins it with an acceptance grep (`last_contact[[:space:]]*=` → zero matches). Matches ROADMAP.md:40-44.
- Status composed, never recomputed (imports PROGRESS_SQL/STATUS_SQL status.ts:59,67; STABLE_MAX/WOBBLE_MAX/ROGUE_K status.ts:40-42).
- New-to-repo Skia idioms honestly flagged: CropPhotoScreen uses only useImage/useSharedValue/useDerivedValue — NOT useFonts/useClock/Paragraph/interpolateColor; 13-05/07/08 label these first-proven-on-device.
- Colour discipline enforceable (check-colors.sh); new hex lands only in theme-presets.ts.
- Widening `AppSettings` does not break consumers (SettingsScreen.tsx:124/151, notification-schedule.ts:375 read fields off the object; none construct a literal → tsc-safe).
- FK integrity backs `sun_contact_id` (foreign_keys=ON database.ts:103, node-sqlite.ts:21).
- Dependency waves sound (13-03 needs only migration-001 ring_seq/contacts; no intra-wave file overlaps).

## Concerns
- **MEDIUM — `self_sun_colour` validator silently constrains the deferred `starPalette` pass to 6-digit hex, untested.** 13-01 Task 2 validator `/^#[0-9A-Fa-f]{6}$/`; 13-06 Task 1 writes `updateAppSettings({ selfSunColour: <starPalette token> })`. CONTEXT (13-CONTEXT.md:105-106) says tokens may be HSL/token strings and exact hexes are deferred. If the deferred pass sets any entry to 8-digit/hsl()/3-digit, tapping that swatch throws inside `updateAppSettings` and writes nothing — silent, device-only. No test guards it. **Fix:** unit test iterating `starPalette` asserting each matches the DAO regex; document the constraint on `starPalette`.
- **LOW — A1 (hard-purge sun contact → NULL) asserted as key_link but never tested,** though cheaply testable (testkit enables foreign_keys, node-sqlite.ts:21). **Fix:** insert contact → set sun_contact_id → DELETE contact → assert NULL.
- **LOW — "fresh v1 install" terminology in 13-01 imprecise (fresh DB is v0).** Runner applies 001+002+003 (runner.ts:41-45). Logic correct; only the label is loose. **Fix:** state fresh path as v0→v3; keep seeded v2→v3 as second case.
- **LOW — ROADMAP crit-4 / ORR-06 literally say "assign the sun from the orrery" without recording the Settings relocation** (REQUIREMENTS.md:99). Not a gap (owner decision, recorded in 13-06/13-07) — a doc-sync hazard a diff-scoped auditor could mis-flag. **Fix:** append a one-line pointer to the CONTEXT relocation decision.

## Suggestions
- Add the `starPalette`-format guard test (closes the MEDIUM); assert it in the palette-seeding file.
- Add the A1 FK-cascade test.
- Restate migration paths as v0→v3 and v2→v3.
- Wrap the 13-06 swatch `updateAppSettings` write in the screen's existing error posture.
- Optional: add a test asserting a snoozed-but-contacted contact IS present in orrery-read (deliberate divergence from dashboard BASE_WHERE dashboard-read.ts:142-144), so a later "consistency" refactor can't silently re-add the snooze clause.

## Risk Assessment
**LOW–MEDIUM.** The data-layer correctness CLAUDE.md most fears is handled correctly and verifiably. No HIGH survived tracing. Residual: one MEDIUM cross-plan coupling (palette-format ⟷ validator) latent until the deferred design pass, plus low-severity test/doc gaps. All closable with small additive test/doc edits; none reopen a recorded decision. Heavy device-UAT surface correctly quarantined into 13-08.

---

## Consensus Summary

Two independent source-grounded reviews. The **data layer is solid** (Claude traced the guard fix, single-writer, migration legality, tsc-safety in depth; codex concurs). The reviewers **diverge on overall severity** because codex went deeper on the **React/Skia render architecture** — where the plans genuinely under-specify structure — while Claude focused on (and cleared) the data layer. Adjudication: both are right in their lanes. codex's two HIGHs are real, actionable plan gaps; Claude's MEDIUM (palette↔validator) is real and codex-missed. Incorporate the union.

### Agreed Strengths
- Migration 003 additive/forward-only/no-hex; FK legal with NULL default (both).
- `rewriteRingSeq` guard/exclusion fix correct — prior blocker genuinely closed (both; Claude traced 4 cases).
- Single-writer `last_contact` preserved; grep-pinned (both).
- Status/`ROGUE_K` single-sourced, never recomputed (both).
- Colour discipline enforceable via check-colors.sh; hex only in theme-presets.ts (both).
- Settings relocation of sun assignment respected — NOT an ORR-06 gap (both).

### Agreed / Actionable Concerns (for `--reviews` incorporation — each must become visible in PLAN.md or be explicitly deferred/rejected)

**HIGH**
- **H1 [codex] Render component decomposition (Rules of Hooks).** Mandate keyed child components so no hook runs inside a `.map()` over a dynamic body list: `OrbitBody` (one `useImage` + per-body `useDerivedValue`, keyed by contact id), `OrreryCanvas` (conditionally mounted; owns `useClock` + ambient hooks), `SunBody` (sun photo/fallback hooks). Add a "render architecture" section to 13-05; thread into 13-07. (13-05, 13-07)
- **H2 [codex] Shared responsive layout metrics.** Add an exported pure `deriveOrreryMetrics(canvasWidth, canvasHeight, bodyCount) → { effectiveGap, DRIFT_MAX, ringInner, … }` computed from MEASURED canvas dimensions; feed the SAME metrics to render, hit-test, drag-preview highlight, and drag-release rank mapping. Add a pure node test for a large body count (overflow → proportional gap compression; drift bound stays on-screen). (13-02, 13-05, 13-07)

**MEDIUM**
- **M3 [codex] Sun-transition `ring_seq` ordering invariant.** Define + test the transition where a user reorders while a contact is the sun (visible set dense `0..N−2`, hidden contact keeps its old rank) then returns to self-sun. Either (a) confirm `orrery-read` derives the DISPLAY rank densely with a stable secondary tiebreak (created_at) so a stale/duplicate stored `ring_seq` is harmless, or (b) normalize the full live-contacted set transactionally on sun-ownership change. Add the regression test: contact-sun → reorder N−1 → self-sun → assert order. (13-03, 13-06)
- **M4 [codex] Concrete sun-occupant read + archived handling.** Specify how `resolveSunOccupant` gets photo+status+archived (dedicated read or explicit `Promise.all` over contact-read + contact-status-read). Because archive is an UPDATE (FK `ON DELETE` won't fire), make BOTH the canvas (already → self) AND Settings show "Me"/clear when the selected sun contact is archived or missing. (13-04, 13-05, 13-06)
- **M5 [codex] Worklet ownership of `useClock` + pan hit-testing.** Require `useClock` to live INSIDE the conditionally-mounted `<Canvas>` subtree (so unmount actually stops the loop) with an acceptance check asserting that boundary. Require a worklet-safe shared-value snapshot of body positions + active dragged id for pan hit-testing, OR an explicit JS-thread drag-start-selection policy with a stated latency/failure note. (13-07)
- **M6 [claude] `starPalette` format ⟷ `self_sun_colour` validator guard.** Add a unit test asserting every `starPalette` entry matches the DAO validator `/^#[0-9A-Fa-f]{6}$/`; document the 6-hex constraint on `starPalette` so the deferred design pass can't silently break the DAO write. Wrap the 13-06 swatch write in the screen's existing error posture. (13-01, 13-04, 13-06)

**LOW**
- **L7 [both] Migration FK `ON DELETE SET NULL` test.** Insert contact → set `sun_contact_id` → DELETE contact → assert `sun_contact_id` reads back NULL. (13-01)
- **L8 [codex] Fix 13-08 frontmatter `files_modified`** to include `13-VERIFICATION.md` (+ the summary it produces) so execution tracking doesn't treat expected evidence as out-of-scope. (13-08)
- **L9 [claude] Restate 13-01 migration paths as v0→v3 (fresh, runs 001+002+003) and v2→v3** — remove the "v1" mislabel. (13-01)
- **L10 [claude] Doc-sync pointer** on ORR-06 / ROADMAP crit-4 to the CONTEXT Settings-relocation decision (already recorded in 13-06/13-07; a one-line pointer prevents a diff-scoped mis-flag). Optional. (docs)
- **L11 [claude, optional] orrery-read snooze-divergence lock test** — assert a snoozed-but-contacted contact IS present (deliberate divergence from dashboard BASE_WHERE), so a later refactor can't silently re-add the snooze clause. (13-03)

### Divergent Views
- **Overall risk:** codex **HIGH** (render architecture must be fixed first); Claude **LOW–MEDIUM** (data layer solid). Resolution: the data layer is verifiably solid; the render-architecture HIGHs (H1/H2) are real plan-specification gaps, not code bugs — they are cheaply fixed by tightening the plans (component decomposition + shared metrics) before execution. No recorded decision is reopened by any finding.

CYCLE_SUMMARY: current_high=2 current_actionable=9

---

# Cross-AI Plan Review — Phase 13 (Orrery) — Cycle 2 (post-incorporation)

Both reviewers independently confirm **ALL 11 cycle-1 findings are RESOLVED** in the revised plans (H1 keyed component decomposition, H2 shared `deriveOrreryMetrics`, M3 dense read-time rank + regression test, M4 `Promise.all` sun-occupant read + archived→self fallback in both surfaces, M5 `useClock`-in-`OrreryCanvas` + worklet snapshot, M6 palette conformance test + error posture, L7–L11). Data layer re-verified solid; no CLAUDE.md violation; owner Settings-relocation respected. The edits surfaced a small set of NEW, localized issues.

## Codex Review (cycle 2) — overall HIGH
- Cycle-1: H1/M3/M5/L7–L11 RESOLVED; H2/M4/M6 PARTIAL (the partials == the new issues below).
- **NEW HIGH — nullable photo → `resolvePhotoUri`.** orrery read returns `photo: string|null` but render calls `useImage(resolvePhotoUri(photo))`; `resolvePhotoUri` requires `string` (photo-storage.ts:130) → won't type-check + defeats the no-photo fallback. Fix: `photo ? resolvePhotoUri(photo) : null`, hook stays unconditional. (13-03:74, 13-05:125)
- **NEW HIGH — never-contacted sun candidate → null status.** The picker includes never-contacted (13-03:151); `getContactStatus` returns `status:null` for them (contact-status-read.ts:25,70); `resolveSunOccupant` requires `status: ProfileStatus` (13-04:135); screen passes `statusRow?.status` (13-05:123). Define the no-status sun visual + accept `ProfileStatus|null` (or exclude never-contacted candidates).
- **NEW MEDIUM — metrics safe-domain.** `effectiveGap` can be zero/negative on a short/transient-zero canvas; drag rank divides by it (13-02:78, 13-07:127). Add a minimum-viable-canvas guard + defer canvas/gestures until dims valid.
- **NEW LOW — M6 coupling not actually shared.** Test hard-codes the regex; DAO validator is private (app-settings-dao.ts:114). Export a validator/regex or add a DAO test writing every palette token.

## Claude Review (cycle 2) — overall LOW
- All 11 cycle-1 findings RESOLVED (traced to plan + real code; `deriveOrreryMetrics` math checks out, guard clone faithful+symmetric, single-writer grep-pinned).
- **NEW MEDIUM — `check:colors` gate FAILS on the validator test's hex literals.** The `self_sun_colour` accept-path test must contain a valid 6-hex literal (`#F2C14E`) to exercise the validator, but `npm run check:colors` (no-arg) scans all of `src` incl. `*.test.ts` (not under `/theme/`) and its regex `#[0-9a-fA-F]{3,8}\b` matches 6-hex. 13-01's own "check:colors clean" claim is self-contradictory, and 4 downstream plans gate on the no-arg check:colors verify. Fix: import `starPalette[0]` instead of a bare literal, OR target check:colors at non-test files, OR add a test-glob carve-out. (13-01:103,105; scripts/check-colors.sh; package.json)
- **NEW LOW — never-contacted sun → null status** (same defect codex rated HIGH; Claude: loud self-catching tsc error, and `orrery-ring-logic` already has a null→neutral fallback the resolver can reuse — one-line spec note). (13-05:123, 13-04:135,103)
- **NEW LOW — `deriveOrreryMetrics` key-aliasing** (`ringInner`/`effectiveGap` vs `RING_INNER`/`RING_GAP`): dual naming invites wiring raw `RING_GAP` into one consumer + compressed `effectiveGap` into another — the exact divergence H2 prevents. Use a single canonical key. (13-02:78,81)

## Consensus Summary (cycle 2)
Both agree the cycle-1 fixes landed and the plan is architecturally sound; divergence is only on the severity of the nullable-input type issues (codex HIGH, Claude LOW — both real, both self-catching at `tsc`). Claude uniquely caught a real BUILD-GATE bug (check:colors failing on test hex) that would block the verify step of 4 plans. Incorporate the union:

### Actionable (for cycle-2 `--reviews` incorporation)
- **C2-1 [HIGH] nullable-photo guard** — `photo ? resolvePhotoUri(photo) : null` in the orrery render (OrbitBody); keep `useImage` unconditional with a nullable source. (13-05, 13-03)
- **C2-2 [HIGH] never-contacted sun status** — accept `ProfileStatus | null` in `resolveSunOccupant` + define the null-status sun glow (reuse `orrery-ring-logic`'s null→neutral fallback); thread `statusRow?.status ?? null`. (13-04, 13-05)
- **C2-3 [MEDIUM] check:colors test-hex gate** — make the `self_sun_colour` validator accept-test use `starPalette[0]` (imported token), not a bare hex literal, so `npm run check:colors` stays green; add an acceptance note that no non-theme file introduces a hex literal. (13-01)
- **C2-4 [MEDIUM] metrics safe-domain guard** — `deriveOrreryMetrics` clamps `effectiveGap` to a positive minimum; the screen defers `<Canvas>`/gestures until measured dims are valid (guard transient zero `onLayout` / div-by-zero). (13-02, 13-05, 13-07)
- **C2-5 [LOW] M6 real DAO coupling** — export the `self_sun_colour` validator (or its regex) from `app-settings-dao` and have the conformance test assert every `starPalette` entry passes the ACTUAL DAO validator (not a duplicated regex). (13-01, 13-04)
- **C2-6 [LOW] metrics canonical key** — `deriveOrreryMetrics` returns a single canonical key set consumed everywhere; drop the `RING_INNER`/`RING_GAP` aliasing. (13-02)

### Divergent Views
- Overall risk: codex HIGH, Claude LOW. Resolution: C2-1/C2-2 are real but self-catching at `tsc`; C2-3 (check:colors) is the one that would actually block a clean verify. All are small, localized edits; none reopen a decision.

CYCLE_SUMMARY: current_high=2 current_actionable=4
