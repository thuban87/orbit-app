---
phase: 36
cycle: 3
reviewers: [codex, claude]
reviewed_at: 2026-09-14T00:53:34Z
plans_reviewed: [36-01-PLAN.md, 36-02-PLAN.md, 36-03-PLAN.md, 36-04-PLAN.md, 36-05-PLAN.md, 36-06-PLAN.md, 36-07-PLAN.md, 36-08-PLAN.md, 36-09-PLAN.md]
models:
  codex: "gpt-5.6-terra (codex-cli 0.154.0, reasoning=low)"
  claude: "claude-opus-4-8 (read-only subagent lane)"
model_sources:
  codex: "banner"
  claude: "subagent-lane"
review_notes:
  - "CYCLE 3 (FINAL convergence cycle). This file accumulates history: the Cycle 3 review is at the top; Cycle 2 and Cycle 1 are preserved verbatim below, unchanged. `cycle_summary` reflects the CURRENT (cycle 3) unresolved counts; `cycle2_summary`/`cycle1_summary` record the prior cycles."
  - "The Claude lane ran as a read-only Claude subagent (not the built-in `claude -p` CLI lane), per the project's known Write-permission gap in that lane (MEMORY: claude-reviewer-via-subagent). It received the same source-grounding prompt and had full repo read access."
  - "The orchestrator independently verified EVERY finding from both lanes against the code on disk before counting: the two cycle-2 HIGHs (OpenRouter adapter now owned by 36-05 Task 4 with providers.set('openrouter',…) registered in refreshProviders; strict OAuth `state` in 36-02 per owner D-13), all six cycle-2 actionables (36-08 FK↔UID aliases + different-rowid restore test; 36-09 six sections; 36-01 migration-029 Writing Style DEFAULT/CHECK + ai_active_connection=lane; 36-06/36-03 stale prompt-template.test.ts :145/:151/:304 named; 36-03 /15 dropped; 36-06 :20-24 header comment), AND the newly-raised HIGH-C (v5 backup omits the Profile-presentation entity tables profile_category_presentation/profile_contact_presentation + background image bytes)."
  - "A source-grounding + cross-artifact fact-drift pass was run (advisory; excluded from HIGH/actionable counts). All cycle-2 fixes verified landed in current PLAN.md content; owner decision D-13 (strict OAuth state) implemented faithfully and NOT reversed."
  - "HIGH-C is NOT a recorded-decision reversal: the recorded decisions (docs/systems/profile.md:82 'Phase 36 owns the eventual Profile presentation backup-wire decision'; docs/systems/backup-restore.md:150 + 31-02-SUMMARY.md:140 'Profile entities and background bytes remain device-local pending the coordinated backup format decision'; 31-RESEARCH.md:19 D-07 'decide explicitly … whether it belongs in the backup') ASSIGN this decision to Phase 36. 36-08 leaves it undischarged. Raising HIGH-C ENFORCES the deferral; it does not reverse a decision. The in-vs-out call has an owner/product dimension and the fix lands in the IRREVERSIBLE v5 format — routed to planner (make 36-08 explicit) + owner (whether these belong in backup at all)."
cycle1_summary: "current_high=6 current_actionable=9"
cycle2_summary: "current_high=2 current_actionable=6"
cycle_summary: "current_high=1 current_actionable=0"
---

# Cross-AI Plan Review — Phase 36 "AI Configuration & Prompting" — CYCLE 3 (FINAL)

Cycle 3 reviews the current 9 plan files on disk after the cycle-2→3 revision that (a) applied owner
decision D-13 (OAuth `state` REQUIRED, not conditional), (b) assigned the OpenRouter generation adapter
to 36-05 Task 4, and (c) incorporated all six cycle-2 actionables. Assessment is of the CURRENT state of
the 9 plans; only concerns that REMAIN UNRESOLVED now are counted. Cycles 2 and 1 are preserved verbatim
below the dividers.

## Cycle 3 Consensus Summary

**Both cycle-2 HIGHs and all six cycle-2 actionables are FULLY RESOLVED, verified against the code on
disk by both grounded lanes and the orchestrator.** The revision is faithful and executor-visible (every
fix lands in task / acceptance-criteria / verify text, not just prose):

- **HIGH-A (OpenRouter generation adapter) — FULLY RESOLVED.** 36-05 `files_modified` now includes
  `src/services/AiService.ts` (`36-05-PLAN.md:15`) and Task 4 (`:171-193`) registers
  `providers.set("openrouter", …)` in `refreshProviders` (base `https://openrouter.ai/api/v1`, key
  `orbit.ai.key.openrouter`), test-asserting an active openrouter connection resolves to the adapter (not
  null). Orchestrator-verified against disk: `AiService.ts:573-593` currently registers only
  openai/anthropic/google/custom and `getActiveProvider` (`:599-602`) reads legacy `settings.aiProvider`
  — the gap was real; 36-05 (map entry) + 36-01 (connection-aware resolver) together close it.
- **HIGH-B / owner D-13 (strict OAuth `state`) — FULLY RESOLVED, faithful, NOT reversed.** 36-02 (`:29`,
  Task 1 `:117-118`, `:122`, `:130-131`, threat rows `:180`/`:182`) REQUIRES a matching echoed `state`;
  a MISSING or MISMATCHED `state` is rejected **before** code exchange, with no PKCE-only fallback, and a
  non-echoing provider fails the connect + escalates to the owner rather than silently loosening. This is
  exactly `36-CONTEXT.md:33` D-13. The orchestrator did NOT reopen the posture.
- **Six actionables (a–f) — ALL FULLY RESOLVED:** (a) 36-08 projects `systemUid`/`contactUid`/
  `groupEventUid` and mandates a DIFFERENT-rowid destination roundtrip test (`36-08-PLAN.md:45-46`,
  `:166`, `:172`, `:180`); (b) 36-09 enumerates six distinct entries with `sections.length === 6`
  (`36-09-PLAN.md:35`, `:135`, `:144`); (c) 36-01 pins the migration-029 Writing Style DEFAULT/CHECK
  literals and fixes `ai_active_connection` = lane (`36-01-PLAN.md:154-161`, `:198-200`); (d) 36-06 Task 2
  owns the `prompt-template.test.ts:145/:151/:304` rewrite and 36-03 references it (`36-06:129/:137/:148`,
  `36-03:123`); (e) 36-03 frontmatter is `[AICFG-08, AICFG-09]` with `/15` dropped (`36-03:18`, `:44`);
  (f) 36-06 updates the stale `prompt-template.ts:20-24` header comment (`36-06:137`, `:149`).

**Privacy/local-first core preserved (verified):** no `toISOString().split('T')[0]` reintroduced;
custom-field normalized storage (migration 006/ADR-001) untouched (029 is additive; 36-01 forbids touching
custom value columns); ADR-107 off-limits excluded from egress, Group Notes never transmitted, `allow_ai`
gate honored; egress not widened beyond the owner-decided OpenRouter host; migration 029 = head+1 (disk
head 028); all 9 plans cite canonical AICFG IDs; AICFG-01…17 coverage complete.

**Where cycle 3 is NOT yet clean — one NEW HIGH (codex; orchestrator-verified):**

### Cycle 3 Agreed / Verified Concerns

- **[HIGH-C — Codex; orchestrator-verified] The irreversible v5 backup (36-08) omits the Profile-
  presentation ENTITY tables and background image bytes — an undischarged, explicitly-Phase-36-owned
  backup-wire decision.** 36-08 serializes the profile *template* tables `profile_layout_templates` and
  `profile_background_templates` (`36-08-PLAN.md:40`, `:145`) but includes **no** export/validation/
  restore/roundtrip for `profile_category_presentation` (category→template/background assignments,
  `src/db/migrations/profile-presentation.ts:40`) or `profile_contact_presentation` (per-contact template
  assignment, `freeform_layout_json`, `background_template_uid`, `collapse_json`, `:51`). Both are LIVE
  writers (`src/db/profile-presentation-dao.ts:49`,`:312`,`:368`) holding durable per-contact/per-category
  user configuration; both are milestone-2 entities (added in Phase 31, commit `bb766f4 feat(31-01)`).
  A grep of 36-08 for these table names, `collapse_json`, `freeform_layout`, or the two
  `app_settings.profile_*_template_uid` pointer columns returns nothing. Separately, a
  `profile_background_templates` row stores only an app-private `image_path`
  (`profile-presentation.ts:27-35`), not the bytes; contact photos are staged as `photoBase64`
  (`export-manifest.ts:47-58`,`:159-167`; validated `backup-schema.ts:791-804`), but 36-08 has zero
  photo/asset/staged/image handling — so a restored install gets a `profile_background_templates` row
  pointing at a nonexistent file (a broken background). Consequence in the IRREVERSIBLE v5 format: a
  restored install keeps the template *library* but loses every contact/category template & background
  ASSIGNMENT, all freeform layouts, all collapse state, and every custom background image — permanently
  (a second retroactive format bump is impossible per `36-08-PLAN.md:192`). This is exactly the
  "serialized-but-not-restored / incomplete v5" defect 36-08's own bar forbids, and AICFG-17 requires
  "serializing every entity … the milestone added." **This is NOT a recorded-decision reversal — it
  ENFORCES one:** `docs/systems/profile.md:82` records "Phase 36 owns the eventual Profile presentation
  backup-wire decision," and `docs/systems/backup-restore.md:150` + `31-02-SUMMARY.md:140` +
  `31-RESEARCH.md:19` (D-07) record that these entities and background bytes were deliberately held
  outside format 4 "pending the coordinated backup format decision" (= Phase 36). 36-08 leaves that
  decision undischarged. **Orchestrator disposition (not closed):** planner must make 36-08 explicit —
  either (i) add export + validation + restore + parent-before-child UID remap (category→categories,
  contact→contacts) for both presentation tables, stage the background image bytes via the established
  photo pattern, and add a different-rowid destination roundtrip test; or (ii) explicitly and coherently
  decide these stay device-local (which then also reopens whether the template tables should ship). Because
  the fix is irreversible and the in-vs-out call is partly product/owner (D-07 open question: "whether
  collapsed state is durable and belongs in the backup"), the in-vs-out axis is an OWNER decision; the
  planner owns making the plan explicit either way. Carried as an unresolved HIGH for cycle 3.

### Cycle 3 Divergent Views
- **Overall readiness:** Codex rates the set HIGH risk / not-ready (the v5 Profile-presentation omission);
  Claude rates it LOW residual risk (all cycle-2 items closed; only two non-blocking LOWs). The lanes did
  not disagree on any single fact about the cycle-2 fixes — each simply went deep where the other did not:
  codex ran a full milestone-2 table-completeness sweep of the irreversible v5 surface and found the
  omission; Claude verified the entities 36-08 named (all correct) and the test-contract/traceability but
  did not enumerate the full milestone-2 table set. The orchestrator ran the completeness sweep itself:
  among all milestone-2 new tables (systems/system_rules/system_overrides/system_prefs, group_events,
  ai_connections, personalization_sections, and the four profile-presentation tables), 36-08 serializes
  nine and omits exactly `profile_category_presentation` + `profile_contact_presentation` — codex's finding
  is precise and bounded (no other omissions), so the orchestrator carries HIGH-C.
- **Claude LOWs (NOT counted as actionable — already incorporated/informational):** the parent-before-
  child restore ordering is already stated + test-guarded in 36-08 (`:166`,`:172`,`:180`); the CONTEXT
  "v4" text is a doc-sync the plan already flags as stale (`36-08:98`) — owner-awareness, not a plan
  change.

## Cycle 3 — Verification coverage (source-grounding, advisory — excluded from HIGH/actionable counts)

Orchestrator verified against the code on disk (not the plan text or a diff):
- `src/services/AiService.ts:569-602` — provider map registers only 4 adapters; `getActiveProvider` reads
  legacy `settings.aiProvider`. Confirms HIGH-A's gap is real and 36-05 Task 4 + 36-01 own the fix.
- `36-02-PLAN.md` strict-`state` language matches owner D-13 (`36-CONTEXT.md:33`) verbatim in intent;
  D-13 NOT reversed.
- `src/db/migrations/022-orrery-systems.ts:23,38` — integer FKs (`system_id`,`contact_id`) need remap;
  `system_ref`/`system_prefs.system_ref` are TEXT (36-08 correctly excludes). `restore-apply.ts` interactions
  INSERT currently omits duration/allow_ai/group_event_id and forces allow_ai=0 (36-08's premise confirmed).
- Migration head on disk = 028 → migration 029 = head+1 (correct). `BACKUP_FORMAT_VERSION` 4→5 correct.
- All 9 plan frontmatters cite canonical `AICFG-*` IDs; no non-canonical IDs.
- HIGH-C: `profile-presentation.ts` creates 4 tables; DAO is a live writer of both presentation tables;
  git shows Phase-31 (milestone-2) origin; 36-08 has zero coverage of the two presentation tables or the
  background image bytes; recorded decisions (`profile.md:82`, `backup-restore.md:150`, `31-02-SUMMARY.md:140`,
  `31-RESEARCH.md:19`) assign the decision to Phase 36 — so HIGH-C enforces, not reverses.

---

## Cycle 3 — Codex Review (verbatim)

## Summary

Cycle 3 is substantially converged: all eight Cycle-2 findings are resolved in the current plans, including strict OAuth state validation and a real OpenRouter generation adapter. One new HIGH backup-format completeness gap remains in 36-08, so the phase is not yet ready for final approval.

## Cycle-2 fixes — verdicts

| Finding | Verdict | Evidence |
|---|---|---|
| HIGH-A: OpenRouter adapter owner | FULLY RESOLVED | 36-05 Task 4 explicitly owns `AiService.refreshProviders`, registers `openrouter`, uses `https://openrouter.ai/api/v1`, and tests active-lane generation: [36-05-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/36-ai-configuration-prompting/36-05-PLAN.md:172). This closes the current code’s real gap: [AiService.ts](/home/bwales/projects/orbit-app/src/services/AiService.ts:599) currently resolves only the legacy provider. |
| HIGH-B: required OAuth `state` | FULLY RESOLVED | 36-02 requires matching echoed state and explicitly rejects missing or mismatched state before exchange: [36-02-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/36-ai-configuration-prompting/36-02-PLAN.md:29), [36-02-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/36-ai-configuration-prompting/36-02-PLAN.md:122). This faithfully implements D-13. |
| (a) FK↔UID aliases and different-rowid test | FULLY RESOLVED | 36-08 specifies `systemUid`, `contactUid`, and `groupEventUid` export aliases plus destination-ID reconstruction and different-rowid tests: [36-08-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/36-ai-configuration-prompting/36-08-PLAN.md:45), [36-08-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/36-ai-configuration-prompting/36-08-PLAN.md:175). These address real INTEGER FKs in [022-orrery-systems.ts](/home/bwales/projects/orbit-app/src/db/migrations/022-orrery-systems.ts:23) and [026-group-events-schema.ts](/home/bwales/projects/orbit-app/src/db/migrations/026-group-events-schema.ts:32). |
| (b) Five vs. six Settings sections | FULLY RESOLVED | 36-09 enumerates six entries, keeping Writing Style and Personalization Context separate routes into the same screen: [36-09-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/36-ai-configuration-prompting/36-09-PLAN.md:35), [36-09-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/36-ai-configuration-prompting/36-09-PLAN.md:135). |
| (c) Migration-029 literals and active-pointer identity | FULLY RESOLVED | Exact irreversible DEFAULT/CHECK tokens are pinned: [36-01-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/36-ai-configuration-prompting/36-01-PLAN.md:154). The pointer is explicitly a lane, not row UID, with a dangling-pointer Needs Attention rule: [36-01-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/36-ai-configuration-prompting/36-01-PLAN.md:161). |
| (d) Stale prompt-template ceiling tests | FULLY RESOLVED | 36-03 identifies the old assertions and assigns their rewrite to 36-06: [36-03-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/36-ai-configuration-prompting/36-03-PLAN.md:123). 36-06 owns the rewrite and acceptance test: [36-06-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/36-ai-configuration-prompting/36-06-PLAN.md:137). |
| (e) Stale `/15` requirement label | FULLY RESOLVED | 36-03 now correctly identifies the fuel cleanup as dossier §AK and reserves AICFG-17 for 36-08’s backup bump: [36-03-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/36-ai-configuration-prompting/36-03-PLAN.md:44). |
| (f) Stale determinism header | FULLY RESOLVED | 36-06 explicitly requires replacing the obsolete fixed-ceiling header: [36-06-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/36-ai-configuration-prompting/36-06-PLAN.md:129), [36-06-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/36-ai-configuration-prompting/36-06-PLAN.md:149). |

All nine plans use canonical `AICFG-*` IDs in frontmatter.

## Concerns

- **HIGH — newly raised: v5 omits the actual Profile presentation state and background assets.** 36-08 promises a complete milestone backup but serializes only `profile_layout_templates` and `profile_background_templates`: [36-08-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/36-ai-configuration-prompting/36-08-PLAN.md:40), [36-08-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/36-ai-configuration-prompting/36-08-PLAN.md:145).

  The actual assignment and per-contact presentation state live in two further tables absent from every 36-08 entity list/task/acceptance criterion:

  - `profile_category_presentation` carries category layout/background assignments: [profile-presentation.ts](/home/bwales/projects/orbit-app/src/db/migrations/profile-presentation.ts:40).
  - `profile_contact_presentation` carries contact template assignment, freeform layout, background assignment, and `collapse_json`: [profile-presentation.ts](/home/bwales/projects/orbit-app/src/db/migrations/profile-presentation.ts:51).
  - Those are live writers, not dead schema; collapse state is persisted through the contact-presentation table: [profile-presentation-dao.ts](/home/bwales/projects/orbit-app/src/db/profile-presentation-dao.ts:49), and category assignments are written there too: [profile-presentation-dao.ts](/home/bwales/projects/orbit-app/src/db/profile-presentation-dao.ts:306).

  Additionally, a background-template row stores only an app-private `image_path`, not the image data: [profile-presentation.ts](/home/bwales/projects/orbit-app/src/db/migrations/profile-presentation.ts:27). Exporting that path alone produces a broken background on a restored install.

  36-08 must add export, validation, restore, and roundtrip coverage for both presentation tables, mapping their category/contact FKs through portable UIDs. It must also serialize/restore the background image bytes using the established staged-photo pattern, then test restoration into a different-rowid destination. Otherwise v5 permanently loses milestone Profile assignments, freeform layouts, collapse state, and custom backgrounds.

## Risk assessment

**HIGH** until that 36-08 omission is fixed. The rest of the phase is well-specified, but the closing v5 wire format is irreversible and presently cannot preserve all milestone entities it claims to cover.

---

## Cycle 3 — Claude Review (verbatim, read-only subagent lane)

## Summary

Cycle 3 is **ready** (Claude lane's verdict). All nine PLAN.md files on disk are unusually well-grounded — every file:line reference spot-checked against the actual source is accurate (the stale test assertions at `prompt-template.test.ts:145/:151/:304`, the governor at `prompt-template.ts:298-318`, the hard-trim at `:324-333`, the header comment at `:20-24`, the orrery FK shapes in migration 022, the `export-manifest.ts:207-208` tombstone filter, the `restore-apply.ts:50-52/:201` structures, and the `reconciliation.ts` `parentFields` pattern all match disk exactly). Both cycle-2 HIGHs are fully closed with concrete owner-file ownership, and all six actionables are written into task/acceptance/verify text (visible to the executor, not just prose). D-13 (strict OAuth `state`) is faithfully implemented, not reversed. The one irreversible plan (36-08, v5 backup) correctly identifies which FKs are integer rowids needing UID remap vs. already-portable TEXT, and mandates a different-rowid destination roundtrip test. This lane found no HIGH or MEDIUM remaining concern. *(Orchestrator note: this lane verified the entities 36-08 names, but did not independently enumerate the full milestone-2 table set; the codex lane's newly-raised HIGH-C — two omitted Profile-presentation tables — is outside what this lane checked and is carried by the orchestrator. See Cycle 3 Consensus.)*

## Cycle-2 fixes — verdicts

**HIGH-A (OpenRouter generation adapter owner) — FULLY RESOLVED.**
36-05 owns `src/services/AiService.ts` (`36-05-PLAN.md:15` files_modified) and Task 4 (`:171-193`) registers `providers.set("openrouter", …)` in `refreshProviders`, base `https://openrouter.ai/api/v1`, key `orbit.ai.key.openrouter`, with acceptance criteria that grep the registration and test that an active openrouter connection resolves to the adapter (not null) (`:187-190`). Verified against disk: current `refreshProviders` (`AiService.ts:573-593`) registers only openai/anthropic/google/custom — the gap is real, and the map is `Map<AiCloudProviderId,…>` so `openrouter` (added to the union by 36-01) typechecks as a key. No user-reachable window resolves to `undefined`: the openrouter lane can't be activated until 36-02 (wave 2) + 36-05 (wave 3) both land.

**HIGH-B / D-13 (strict OAuth state) — FULLY RESOLVED, faithful (no reversal).**
36-02 Task 1 (`36-02-PLAN.md:117`, `:122`, `:130-131`) requires an always-sent in-memory `state`, rejects a MISSING or MISMATCHED `state` **before** code exchange with no PKCE-only fallback, tests missing and mismatched as **distinct** cases, and escalates to the owner (not silently loosens) if the Pixel spike finds OpenRouter doesn't echo `state`. Faithful implementation of the recorded owner decision (CONTEXT `D-13`, `36-CONTEXT.md:33`) — not reopened or counted as a concern.

**(a) 36-08 FK↔UID aliases + different-rowid roundtrip — FULLY RESOLVED.**
`36-08-PLAN.md:45` projects `system_rules.system_id`→`systemUid`, `system_overrides.contact_id`→`contactUid`, `interactions.group_event_id`→`groupEventUid`, rebuilt against the destination DB; `:46` and Task 3 (`:172`, acceptance `:180`) mandate seeding the destination with DIFFERENT integer ids and asserting resolution by UID. Verified on disk: migration 022 shows integer FKs needing remap, while `system_ref`/`system_prefs.system_ref` are TEXT (correctly excluded). The `reconciliation.ts` `parentFields` remap pattern and the existing `contactUid` JOIN in `export-manifest.ts` confirm the plan extends a proven mechanism.

**(b) 36-09 six sections — FULLY RESOLVED.**
`36-09-PLAN.md:35` and Task 2 (`:135`, acceptance `:144`) enumerate SIX ordered entries and assert `sections.length === 6` with Writing Style + Personalization Context as two distinct entries both routing to `AIPersonalization` (focus param).

**(c) 36-01 migration-029 Writing Style DEFAULT/CHECK pinned + active-pointer identity — FULLY RESOLVED.**
`36-01-PLAN.md:154-159` pins exact DEFAULT+CHECK vocab for all three Writing Style enum columns + freeform; `:161` fixes `ai_active_connection` as storing the **lane** (not row uid), keyed off `UNIQUE(lane)`, empty/dangling → Needs Attention. Task-1 acceptance (`:198-200`) tests one assertion per default + CHECK rejection. Verified 029 = head+1 (disk head is `COMPOSE_MESSAGE_MODE_SCHEMA_VERSION = 28`); none of these columns pre-exist (additive).

**(d) 36-06/36-03 stale test ceiling assertions named — FULLY RESOLVED.**
Both plans name `prompt-template.test.ts:145` (the `"never exceeds the 6000 code-point total…"` title), `:151`, and `:304` for rewrite (`36-06:129/:137/:148`, `36-03:123`). Confirmed on disk these are exactly the stale lines. 36-06 owns the rewrite; 36-03 references it and avoids adding a new ceiling-dependent assertion.

**(e) 36-03 stale `/15` requirement mislabel — FULLY RESOLVED.**
36-03 frontmatter is now `[AICFG-08, AICFG-09]` (`36-03-PLAN.md:18`); the old `AICFG-08/09/15/17` label is gone, and `:44` explicitly clarifies AICFG-17 is 36-08's. AICFG-15 is correctly carried by 36-05/36-08.

**(f) 36-06 stale determinism header comment — FULLY RESOLVED.**
`36-06-PLAN.md:137` and acceptance `:149` require updating `prompt-template.ts:20-24`. Verified on disk that `:20-24` is exactly the stale AI-SPEC §4 note.

## Concerns

No HIGH or MEDIUM concerns from this lane. Two low-priority observations, neither blocking:

- **LOW (execution watch-item, not a plan defect):** 36-08 restore correctness depends on parent-before-child ordering in `restore-apply.ts` `entities[]` — `group_events` must restore before the pre-existing `interactions` entry, and `systems` before `system_rules`. The plan states this requirement explicitly (`36-08-PLAN.md:166`, `:172`) and its different-rowid roundtrip acceptance test (`:180`) fails if the order is wrong, so it is specified and test-guarded.
- **LOW (informational, already acknowledged):** CONTEXT `D-03`/`D-03b`/`D-12` still say "v4", but 36-08 explicitly calls this text stale and pins the on-disk target to v5 (`36-08-PLAN.md:98`), matching disk. Correct, not a reversal.

Independent checks all pass: migration 029 = head+1; backup v4→v5 bump correct; no `toISOString().split('T')[0]` reintroduced; custom-field normalized storage (migration 006/ADR-001) untouched; local-first egress not widened beyond the owner-decided OpenRouter host; all 17 AICFG requirements are canonical and every plan cites its AICFG IDs.

## Risk Assessment

**LOW** (this lane). The two cycle-2 HIGHs are closed with real file ownership and test-backed acceptance criteria; all six actionables are baked into executable task/acceptance/verify text; D-13 is implemented, not reversed. No recorded-decision collisions from this lane's checks.

---

# Cross-AI Plan Review — Phase 36 "AI Configuration & Prompting" — CYCLE 2

Cycle 2 reviews the REVISED 8 plans plus the new 9th plan (36-09, Settings AI hub + nav) added in
response to cycle 1's 6 HIGH / 9 actionable. Assessment is of the CURRENT state of the 9 plan files on
disk; only concerns that REMAIN UNRESOLVED after the cycle-1 revisions are counted. The Cycle 1 review is
preserved verbatim below the divider.

## Cycle 2 Consensus Summary

**The revision is strong and materially closes cycle 1.** Both grounded lanes independently agree — and
the orchestrator verified against disk — that **all 6 cycle-1 HIGHs are addressed** and **all cycle-1
actionables (a–j) are incorporated into the current PLAN.md files**:

- **HIGH-1 (generation path):** 36-01 now owns `ComposeScreen.tsx` + `AiService.ts` and PROMOTES generation off legacy `AiSettings.aiProvider`/`aiModel`/`aiCustomModel` to the active-connection resolver, with a grep acceptance gate and the 5-input `computeAiAvailability` reshape owned in lockstep. FULLY RESOLVED **for the direct-BYOK lane** (see new HIGH-A for the OpenRouter lane).
- **HIGH-2 (routing):** new plan 36-09 owns `navigation/types.ts` + `SettingsStack.tsx` + `SettingsScreen.tsx`, registers all five AI screens with entry points, and retires the legacy inline provider UI. FULLY RESOLVED.
- **HIGH-3 (restore):** 36-08 now owns `restore-apply.ts` + `reconciliation.ts`; extends the interactions restore INSERT with `duration`/`allow_ai`/`group_event_id`, removes the group_event tombstone filter, and carries Phase 33 orphan-repair. FULLY RESOLVED (one MEDIUM refinement below).
- **HIGH-4 (permission writers):** 36-04 now owns `memories-dao.ts`/`recency-dao.ts`/`field-ddl.ts` + the creation forms and routes every writer through a single `resolveNewItemAiDefault`; the registry→column reconciliation is behavior-preserving (all `MEMORY_TYPE_REGISTRY` entries are `aiDefault:false`). FULLY RESOLVED.
- **HIGH-5 (context ceiling):** 36-03 and 36-06 are reconciled to the identical contract — retire `TOTAL_LIMIT` as the context ceiling, keep `PER_VALUE_LIMIT` as a per-value abuse bound, block only on the selected model's real `context_length` via `context-estimate`, surface overflow explicitly. FULLY RESOLVED in design (one MEDIUM test-contract refinement below).
- **HIGH-6 (OAuth):** 36-02 now generates an in-memory anti-CSRF `state`, validates the exact `orbit://openrouter-auth` callback, rejects foreign scheme/host/params, consumes the code once. Cycle-1 ask satisfied (see new HIGH-B for the residual posture question).

**Privacy core preserved (both lanes + orchestrator, verified against code):** ADR-107 off-limits has no shape in the egress path; `ai-context-read.ts:183` gates notes on `allow_ai===1`; Group Notes deliberately never read; credentials SecureStore-only and screened from backup; `group_events.group_note` is backed up as user data but never enters AI egress (correctly not conflated). **No recorded-decision collisions.** Migration 029 = head+1 (disk head 028); `BACKUP_FORMAT_VERSION` 4→5 correct.

**Where cycle 2 is NOT yet clean:** the two lanes surfaced *complementary* residual gaps (each caught what the other missed; the orchestrator verified all of them):

### Cycle 2 Agreed / Verified Concerns

- **[HIGH-A — Codex; orchestrator-verified] The OpenRouter generation adapter has no owner.** 36-01 adds `openrouter` to `AiProviderId`/`AiCloudProviderId` but scopes its generation promotion to the direct-BYOK lane and defers the OpenRouter adapter to Plan 05 (`36-01-PLAN.md:225`). But `36-05` `files_modified` (`:7-14`) is screens/logic/components only — it does **not** own `src/services/AiService.ts`, whose `refreshProviders` registers only `openai`/`anthropic`/`google`/`custom` (`AiService.ts:573-591`) and whose `getActiveProvider` only reads that map (`:599-602`). No plan registers an OpenRouter provider adapter. Result: an activated OpenRouter connection (the *recommended* lane) resolves to no provider at generation time — a tsc-green, `Map.get`-returns-`undefined`, "green config / broken generation" defect, the exact class HIGH-1's promotion was meant to eliminate. This is a residual of HIGH-1 for the OpenRouter lane, sitting in an ownership gap between 36-01 and 36-05.
- **[HIGH-B — Codex; owner security-posture decision] The OAuth anti-CSRF `state` is validated only "when echoed."** 36-02 (`:28-29`, Task 1 `:117-118`) generates and appends `state` but treats a provider that does not echo it as acceptable, relying on PKCE + exact-callback + one-time consumption as the effective controls in that fallback. PKCE binds code↔verifier and is the primary CSRF defense for native public clients, so the disposition is defensible — but codex flags it by name as a security downgrade at the only new browser-to-app ingress, and **risk/security posture is the owner's bucket**. Per this project's rules (a reviewer flagging a control weakened *by name* is an escalation trigger, not a finding to close), the orchestrator does **not** close it: it is carried as a PARTIALLY-RESOLVED HIGH for an explicit owner decision — require a matching echoed `state` before exchange (stop at the device spike for an owner call if OpenRouter cannot echo it), or ratify PKCE-primary-with-conditional-state as the accepted posture.
- **[MEDIUM — Codex; orchestrator-verified] v5 restore lacks an explicit UID↔local-ID mapping contract for the new FK-bearing entities.** `system_rules.system_id` (`022-orrery-systems.ts:22`) and `system_overrides.contact_id` (`:36`) are INTEGER FKs to `systems.id`/`contacts.id`; `interactions.group_event_id` is an INTEGER FK. The existing restore only works because each dependency is projected as a UID and remapped via a local-id map (`restore-apply.ts:187-205`). 36-08 gives the generic `parentFields` mechanism and directs reading the FK shapes (`:168`) but does not pin the `systemUid`/`contactUid` wire aliases for the systems tables, and its roundtrip tests do not mandate a **different-rowid destination** — a same-fixture roundtrip hides a wrong integer-FK remap in an irreversible format.
- **[MEDIUM — Codex; orchestrator-verified] 36-09 promises "six sections" but enumerates five.** UI-SPEC Surface #1 (owner-ratified) lists six DISTINCT entries — Connection · Model · **Writing Style · Personalization Context** · AI Data Permissions · Preview (`36-UI-SPEC.md:106`). 36-09 repeatedly says "six-section" but its entry list combines Writing Style + Personalization Context into one (`36-09-PLAN.md:38,135,153`), totaling five — and an acceptance test asserting "six entries" would be impossible. Reconcile: either split into six entry rows (both Writing Style and Personalization targeting `AIPersonalizationScreen` anchors) or correct the count/tests to five with the owner's assent.
- **[MEDIUM — Codex; orchestrator-verified] Migration 029 (irreversible) leaves the Writing Style SQL defaults and the active-pointer identity unspecified.** 36-01 (`:152`, `:179`) says the three Writing Style columns are "TEXT NOT NULL DEFAULT with CHECK vocabularies" without pinning the literal DEFAULT values (UI-SPEC implies Balanced/Normal/Balanced) or the exact CHECK enums, and never states whether `ai_active_connection` stores the connection UID or the lane — which determines restore correctness. A forward-only migration should not leave an executor to infer irreversible literals; pin all three defaults + CHECK vocabularies and the pointer identity before the checkpoint, with a migration test per default and a pointer roundtrip.
- **[MEDIUM — Claude; orchestrator-verified] Existing `prompt-template.test.ts` ceiling assertions will break the gate when `TOTAL_LIMIT` is retired, and neither 36-03 nor 36-06 names them.** `prompt-template.test.ts:145` ("never exceeds the 6000 code-point total and drops overflow fields in order"), `:151` and `:304` (`expect(cp(resolved.prompt)).toBeLessThanOrEqual(TOTAL_LIMIT)`) become false once the omission governor is retired to preserve permitted context. Both plans own `prompt-template.test.ts` and say "write RED tests first," but neither enumerates these specific stale assertions — this is precisely the documented "orphaned-test-consumer build-breaker" (recurred 4× in P35; vitest-passing ≠ tsc-clean). Name `:145/:151/:304` for rewrite in 36-06 Task 2 (referenced from 36-03 Task 1) so the two "must-agree" plans also agree on the test contract.
- **[LOW — Claude; orchestrator-verified] Residual RESEARCH-numbering mislabel in 36-03 truths.** `36-03-PLAN.md:29` and `:32` cite `(AICFG-08/15)`; the frontmatter `requirements: [AICFG-08, AICFG-09]` (the enforced channel) is correct, but AICFG-15 is "credentials stay in SecureStore (ADR-049)" — unrelated to prompt serialization. The `/15` is a stale RESEARCH-vs-REQUIREMENTS remnant from the cycle-1 divergence set (11/12/15/16/17). Drop `/15` (leave AICFG-08; likely meant 08/09). No other plan carries a residual mislabel — 36-05's AICFG-15 refs are legitimately about SecureStore.
- **[LOW — Claude; orchestrator-verified] Stale determinism doc in `prompt-template.ts:20-24`** ("whole prompt ≤ 6,000 code points … Truncation disclosed by CATEGORY", AI-SPEC §4) becomes misleading once the ceiling is retired. Add a header-comment update to 36-06 Task 2. (The related hard-trim `:324-333` disposition is already explicitly named in 36-06 Task 2 — no gap there.)

### Cycle 2 Divergent Views
- **Overall readiness:** Codex rates the current set HIGH risk / not-ready (OpenRouter adapter gap + OAuth posture); Claude rates it LOW residual risk (design gaps closed; only the orphaned-test MEDIUM + two LOW nits remain). The lanes did not disagree on any single fact — each simply went deep where the other did not: codex on the cross-module integration/security surfaces, Claude on the test-contract + traceability. The orchestrator verified every finding from both lanes against disk and carries the union.
- **Informational (NOT counted):** REQUIREMENTS.md AICFG-17 (`:277`) still says the format "bumps to v4"; on-disk `BACKUP_FORMAT_VERSION` is already 4, so 36-08 correctly targets v5 and documents the stale text. The plan is right; REQUIREMENTS.md is the stale artifact — a doc-sync for the owner's awareness, not a plan change.

## Cycle 2 — Codex Review (verbatim)

# Phase 36 plan review — cycle 2

## Summary

**Not ready to execute.** The revision substantively resolves the prior generation-promotion, route-ownership, restore-ownership, new-item-default, context-ceiling, disclosure-persistence, curation, accessibility, and fuel-cleanup findings. Two high-severity gaps remain: OpenRouter can be configured but has no planned executable provider adapter, and the proposed OAuth flow accepts a callback with no CSRF state. Two medium implementation-contract gaps should also be fixed before the one-way migration/backup checkpoints.

I reviewed the code on disk, including the active Compose/AiService path, prompt egress read/build path, every current `group_events` writer, migrations for the newly backed-up tables, and backup export/reconciliation/restore. The graph query command could not run in this sandbox because `tsx` could not create its IPC pipe; this review therefore relies on the code and ADRs directly.

## Strengths

- **Cycle-1 HIGH-1 is addressed in the plan.** Plan 01 explicitly promotes Compose generation away from legacy `AiSettings` and requires the active-connection resolver in both Compose and `AiService` (36-01-PLAN.md:222-225), targeting the live legacy reads at ComposeScreen.tsx:385-400 and AiService.ts:573-602.
- **Cycle-1 HIGH-2 is addressed in scope.** Plan 09 now owns typed registration plus Settings entry points for all five new screens (36-09-PLAN.md:110-123), rather than leaving the currently closed `SettingsStack` (SettingsStack.tsx:45-102) unchanged.
- **Cycle-1 HIGH-3 is addressed in scope.** Plan 08 now owns the actual `restore-apply` and reconciliation extensions (36-08-PLAN.md:161-178), covering the real omission in the current interaction restore writer, which drops `duration`/`group_event_id` and forces `allow_ai=0` (restore-apply.ts:190-201).
- **Cycle-1 HIGH-4 is addressed in scope.** Plan 04 names every current creation seam: memories-dao.ts:106-127, recency-dao.ts:235-252, field-ddl.ts:64-100, and the Phase-36 seam log-interaction-logic.ts:142-149.
- **Cycle-1 HIGH-5 is addressed.** Plans 03 and 06 consistently retire the fixed `TOTAL_LIMIT` as a total-context governor and require explicit model-window overflow, correcting the live logic at prompt-template.ts:295-333.
- **Cycle-1 disclosure, curation, reorder-accessibility, tombstone, ACK-column, and narrowly scoped `onConfirm` points are all materially addressed.** Off Limits remains excluded from the egress shape as ADR-107 requires; the existing reader already keeps Group Notes out (ai-context-read.ts:154-191).

## Concerns

### HIGH — OpenRouter is still not wired to a generation adapter

Plan 05 promises that activating OpenRouter sends generation through an OpenAI-compatible adapter (36-05-PLAN.md:62-67), but its complete `files_modified` list contains UI/logic/component files only (36-05-PLAN.md:7-14). Plan 02 implements OAuth and catalog only; it also does not own `AiService`. The only live adapter registry is `AiService`, and it currently creates only `openai`, `anthropic`, `google`, and `custom` providers (AiService.ts:573-593), while `getActiveProvider` only retrieves that map (AiService.ts:599-602). Adding `openrouter` to `AiProviderId` in 36-01 without an adapter leaves a successfully configured active lane with no provider at generation time — the same "green configuration, broken generation" class the generation-promotion revision was meant to eliminate.

**Suggestion:** Add `src/services/AiService.ts` and an adapter test to 36-05 (or a dedicated dependent plan): OpenRouter base URL, headers, credential lookup by `openrouter`, provider-map registration, model forwarding, cancellation/error mapping, and a test that an active OpenRouter connection invokes that adapter.

### HIGH — callback validation still accepts a state-less callback

The plan validates `state` only "when present," and explicitly treats a provider that does not echo state as acceptable (36-02-PLAN.md:28-29). That does not resolve login-CSRF: a malicious `orbit://openrouter-auth?code=...` callback has the exact scheme/host but no binding to the initiating browser session. PKCE binds a code to the verifier; it does not prove the callback belongs to this authorization attempt when the callback omits `state`. This is a security posture issue at the only new browser-auth ingress; it is not safe to silently downgrade the stated anti-CSRF control based on an unverified device observation.

**Suggestion:** Make a matching echoed `state` mandatory before code exchange. If OpenRouter truly cannot echo state, stop at the device spike and obtain an owner decision for a different documented provider-supported binding/flow; do not ship the claimed anti-CSRF control as optional.

### MEDIUM — v5 restore lacks an explicit UID-to-local-ID mapping contract for its FK-bearing entities

Plan 08 says to add generic projections/upserts "in the correct parent/child order" (36-08-PLAN.md:168), but never specifies the necessary wire aliases and ID maps. Several proposed tables do not store portable foreign keys: `system_rules.system_id` → `systems.id` (022-orrery-systems.ts:19-28); `system_overrides.contact_id` → `contacts.id` (022-orrery-systems.ts:33-42); `interactions.group_event_id` (026-group-events-schema.ts:31-39). The current restore works only because each dependency is projected as a UID and remapped through a local ID map (restore-apply.ts:187-205). Raw source integer IDs will be wrong on a destination database, and a roundtrip into the same fixture can hide this.

**Suggestion:** Spell out `systemUid`, `contactUid`, `groupEventUid` in export types/SELECTs; rebuild local integer IDs from destination UIDs on restore; test merge and replace-all into a destination deliberately seeded with different rowids; include order/repair behavior when a referenced UID is absent.

### MEDIUM — Plan 09 promises six management sections but implements five

The owner-ratified UI contract requires six distinct entries: Connection, Model, Writing Style, Personalization Context, AI Data Permissions, Preview (36-UI-SPEC.md:102-106). Plan 09 repeatedly calls its hierarchy six sections, but its listed entries combine Writing Style and Personalization and total five (36-09-PLAN.md:33-38, 135, 153).

**Suggestion:** Either add separate Writing Style and Personalization Context entries targeting anchors in `AIPersonalizationScreen`, or correct the product/UI contract through the owner. Do not leave impossible "six entry" assertions/tests that actually validate five.

### MEDIUM — migration 029 does not state the irreversible Writing Style defaults or the active-pointer identity

The one-way checkpoint calls for a "complete" schema but leaves the three Writing Style SQL defaults unspecified (36-01-PLAN.md:152); Task 1 repeats the omission (36-01-PLAN.md:179). The UI contract supplies the intended defaults — Balanced / Normal / Balanced (36-06-PLAN.md:29) — but a forward-only migration should not make an executor infer literal enum/default values. It likewise never says whether `ai_active_connection` stores the connection UID or lane; restore correctness requires an unambiguous identity.

**Suggestion:** Before the checkpoint, pin all three SQL `DEFAULT` values + exact `CHECK` vocabularies, specify `ai_active_connection = ai_connections.uid` (or another exact immutable identity), and add a migration test for each default and a pointer roundtrip.

## Risk assessment

The remaining risk is **high**. The OpenRouter gap affects the recommended connection lane's core generation path, and the optional-state OAuth callback admits a security downgrade at the browser-to-app boundary. The restore mapping gap matters because v5 is an irreversible portable format: source SQLite integer identifiers must never enter a manifest as portable relationships. The egress boundary itself is otherwise well protected: ADR-107's Off Limits exclusion is retained, Group Notes remain structurally absent, SecureStore remains the sole credential boundary, and the no-silent-truncation contract is now consistent.

## Suggested disposition

Revise plans 02, 05, 08, 09, and the migration-029 checkpoint details; then rerun convergence. The prior cycle's actionable items that are explicitly covered above should remain marked resolved rather than re-raised.

---

## Cycle 2 — Claude Review (verbatim, read-only subagent lane)

# Phase 36 Plan Review — Cycle 2 (Adversarial Cross-AI)

## Summary

The revision is strong. All six cycle-1 HIGH findings are addressed in the current plan set, and all ten actionable items are closed. I verified every HIGH against the actual code on disk (not the plan text): the plans' `path:line` references are accurate, the newly-claimed file ownerships are real, and the privacy core is preserved. Migration numbering (029 = head+1, TARGET_VERSION 28) and backup format (v4 on disk → v5 target) are correct. **No recorded-decision collisions.** Remaining issues are one MEDIUM (an orphaned-test hazard spanning two plans, matching a documented recurring failure mode here) and two LOW doc/label nits.

## Cycle-1 HIGH findings — verdicts

**HIGH-1 — FULLY RESOLVED.** 36-01 lists `ComposeScreen.tsx` + `AiService.ts`; Task 3 rewires `generate` off legacy `AiSettings.aiProvider`/`aiModel`/`aiCustomModel` to an active-connection resolver + grep gate. Code confirms legacy state: ComposeScreen.tsx:390/:392/:398/:494; AiService.ts:599-601, :589. Call site ComposeScreen.tsx:937; ai-availability.ts:49 still 2-input, so the 5-input reshape is real and owned.

**HIGH-2 — FULLY RESOLVED.** 36-09 owns `navigation/types.ts`/`SettingsStack.tsx`/`SettingsScreen.tsx`; registers all five routes + entry points, retires the inline provider UI (SettingsScreen.tsx:321+). wave 5, depends correct.

**HIGH-3 — FULLY RESOLVED.** 36-08 lists `restore-apply.ts`+`reconciliation.ts`; Task 3 owns restore, Task 2 removes tombstone filter. Code confirms restore-apply.ts:50/:201, export-manifest.ts:208/:110. Fail-closed `allow_ai=0` for legacy manifests retained.

**HIGH-4 — FULLY RESOLVED.** 36-04 lists writers + forms; Task 3 routes each through `resolveNewItemAiDefault`. Code confirms memories-dao.ts:126, log-interaction-logic.ts:147, field-ddl.ts:79, recency-dao.ts:251. Verified moot worry: all three `MEMORY_TYPE_REGISTRY` entries are `aiDefault:false` — reconciliation behavior-preserving.

**HIGH-5 — RESOLVED in design; one MEDIUM test-gap (below).** 36-03 and 36-06 state the identical contract and cross-reference. Code confirms prompt-template.ts:38/:40/:298-318/:324-333. Not a recorded-decision collision: AICFG-07 is a `[DECIDED]` dossier requirement superseding the AI-SPEC §4 bound; retiring the ceiling executes it.

**HIGH-6 — RESOLVED at plan level (no code yet).** `openrouter-oauth.ts` absent on disk. 36-02 Task 1 requires generated in-memory `state`, `type==='success'`, exact `orbit://openrouter-auth`, foreign/param rejection, `state` equality when echoed, one-time consumption, verifier+state cleared; node-pure unit-tested validator, device-UAT for state-echo. Comprehensive; no residual gap at plan level. [Orchestrator note: codex escalates the "when echoed" conditional as HIGH-B — carried for owner.]

## Actionable items (a–j) — all resolved

(a) `ai_first_use_disclosed` in migration 029, excluded from `PORTABLE_SETTINGS_KEYS`. (b) zero-connection + one-active pointer integrity in DAO tests (dangling → needs-attention). (c) curation named source `src/ai/model-registry.ts`. (d) accessible reorder Move up/down. (e) `package-lock.json` in 36-02. (f) `ComposeScreen.tsx` in 36-01. (g) group_event tombstone + roundtrip test. (h) AINeedsAttention/Compose ownership clarified. (i) dead `ai_ack_openrouter` keep-vs-retire at checkpoint (neither reverses ADR-079). (j) `onConfirm` strictly scoped to FuelEditor. ✓ all.

## Strengths (verified)

- **Privacy core intact.** ai-context-read.ts:183 gates notes on `allow_ai===1`; :163-164 never reads `group_events`; off_limits excluded from fuel. prompt-types.ts carries only `sharedMemories`(:138) + `gatedRecentInteractionNotes`(:154), no off-limits field. ADR-107 Accepted, supersedes ADR-078 partially — 36-03 framing matches verbatim.
- **Irreversibility discipline.** Both one-way changes behind blocking-human checkpoints.
- **TS→SQL blind-spot handled correctly.** 36-04 and 36-08 enumerate table writers by grep rather than trusting the graph.

## Concerns

**MEDIUM — [NEW] Existing `prompt-template.test.ts` ceiling assertions will break the tsc/vitest gate when TOTAL_LIMIT is retired; neither 36-03 nor 36-06 names them.** :151 and :304 both `expect(cp(resolved.prompt)).toBeLessThanOrEqual(TOTAL_LIMIT)` after driving 60/80 over-budget shared fields; :145 is titled "…drops overflow fields in order." Once 36-06 retires the :298-318 governor, these become false and the file-level gate fails — precisely the "orphaned test-consumer build-breaker" (recurred 4× in P35). **PLAN change needed:** name prompt-template.test.ts:145/151/304 to rewrite in 36-06 Task 2 (referenced from 36-03 Task 1) so the two "must agree" plans agree on the test contract.

**LOW — [NEW] Residual RESEARCH-numbering mislabel in 36-03 truths.** 36-03-PLAN.md:29 and :32 cite `(AICFG-08/15)`. Frontmatter `[AICFG-08, AICFG-09]` is correct, but AICFG-15 is SecureStore credentials — unrelated to prompt serialization. Drop `/15`. No other plan carries a residual mislabel (36-05 AICFG-15 refs are legitimate SecureStore; 36-07 [11-14], 36-08 [16,17] correct).

**LOW — [NEW] Stale determinism doc in `prompt-template.ts:20-24`** ("whole prompt ≤ 6,000 code points … Truncation disclosed by CATEGORY", AI-SPEC §4) becomes misleading once the governor is retired. Update the header in 36-06 Task 2. (Hard-trim :324-333 disposition already named in 36-06 Task 2 — no gap.)

**INFORMATIONAL (not a collision).** REQUIREMENTS.md AICFG-17 (:277) still says "bumps to v4"; on-disk `BACKUP_FORMAT_VERSION` is already 4, so 36-08 correctly targets v5 and documents the divergence. Doc-sync for the owner, not a plan change.

## Risk Assessment

**Low residual risk** [from this lane]. The design-level gaps that made cycle 1 dangerous are all closed and confirmed against code; privacy invariants preserved and test-gated. Remaining execution-time risk is the MEDIUM orphaned-test hazard (catchable but historically recurs when not named). No recorded-decision collision. [Orchestrator note: codex's deeper integration/security pass surfaced HIGH-A/HIGH-B, which this lane did not reach; the orchestrator verified both against disk and carries the union.]

---

## Cycle 2 — Verification coverage (source-grounding, advisory — excluded from HIGH/actionable counts)

`git status` confirms **no `src/` file changed since cycle 1** (only `.planning/` + `tsconfig.json`), so the cycle-1 source-grounding table below (VERIFIED 41 / MISSING 1 / AMBIGUOUS 2 / UNCHECKABLE ~24) still holds. Cycle-2 deltas:

| Claim (cycle-2) | Plan | Classification | Evidence |
|---|---|---|---|
| `src/ai/model-registry.ts` curated set (was cycle-1 MISSING at `src/services/model-registry.ts`) | 05 | **FIXED / VERIFIED** | 36-05 read_first now cites `src/ai/model-registry.ts` and notes `src/services/model-registry.ts` does not exist. |
| `AiService.refreshProviders` registers only openai/anthropic/google/custom; no openrouter | 01, 05 | VERIFIED | AiService.ts:573-591 `providers.set(...)` ×4; :599-602 `getActiveProvider` reads the map. Basis of cycle-2 HIGH-A. |
| `system_rules.system_id` / `system_overrides.contact_id` INTEGER FKs | 08 | VERIFIED | 022-orrery-systems.ts `system_id INTEGER NOT NULL REFERENCES systems(id)`, `contact_id INTEGER NOT NULL REFERENCES contacts(id)`. Basis of cycle-2 MEDIUM (FK remap). |
| UI-SPEC Surface #1 lists SIX distinct sections | 09 | VERIFIED | 36-UI-SPEC.md:106 enumerates six; 36-09 enumerates five. Basis of cycle-2 MEDIUM (six-vs-five). |
| `prompt-template.test.ts` asserts `<= TOTAL_LIMIT` at :151/:304; "drops overflow fields" at :145 | 03, 06 | VERIFIED | grep confirms all three assertions. Basis of cycle-2 MEDIUM (orphaned-test). |
| 36-03 truths cite `(AICFG-08/15)` while frontmatter is `[08,09]` | 03 | VERIFIED (mislabel) | 36-03-PLAN.md:29,:32. Basis of cycle-2 LOW (mislabel). |
| All plans cite canonical AICFG-01..17 (frontmatter `requirements:`) | 01-09 | VERIFIED | frontmatter IDs ⊆ REQUIREMENTS.md AICFG-01..17; 36-03 retagged to [08,09]; no non-existent IDs. Residual prose `/15` in 36-03 is the only mislabel. |
| migration head+1 = 029 (`TARGET_VERSION`=28); `BACKUP_FORMAT_VERSION` 4 → v5 | 01, 08 | VERIFIED (unchanged) | database.ts head 028; src/backup/types.ts:14 = 4. |
| REQUIREMENTS.md AICFG-17 text says "bumps to v4" | 08 | INFORMATIONAL drift | REQUIREMENTS.md:277; 36-08 correctly targets v5 and flags the stale text. Doc-sync (owner), not a plan finding. |

**Cycle-2 source-grounding summary: all cycle-2 findings independently VERIFIED against disk; the cycle-1 MISSING (model-registry path) is now FIXED. Advisory — excluded from HIGH/actionable counts.**

---
---

# Cross-AI Plan Review — Phase 36 "AI Configuration & Prompting" (CYCLE 1 — preserved below, historical)

Phase 36 is the milestone's AI-configuration phase and touches the app's **only** off-device egress path (the optional AI-suggestion feature). Reviews below are source-grounded against the code on disk per "review the code, not the diff."

## Consensus Summary

Both grounded lanes agree this is a **strong, source-accurate plan set with no recorded-decision collisions**. Every high-risk numeric/structural claim verified against disk: migration **029 = head+1** (disk head 028, `database.ts:69` `TARGET_VERSION=28`), **`BACKUP_FORMAT_VERSION` is 4** (`src/backup/types.ts:14`) so 36-08's 4→5 bump + `4:` upgrader is correct (not a 3→4 re-bump), and the central **privacy invariants are enforced in code**: Off Limits has no shape anywhere in the egress path (ADR-107 enforced, not reversed), Group Notes are never read, interaction notes gate on `allow_ai=1` with `LIMIT 3`, credentials stay in SecureStore and are screened out of backup by `SECRET_SHAPED_KEY`.

Where the lanes **diverge is on severity, not substance**: Codex rates the phase **HIGH risk** because several plans define new modules/schema/tests but omit the *real integration owners on disk* — the generation path, navigation routes, permission-defaulting writers, and the restore machinery — so requirements could test green in isolated modules while the running app is broken or unreachable. Claude rates the phase **LOW–MEDIUM**, reading the same omissions as tsc-catchable plan-completeness gaps rather than defects. The orchestrator verified the file-ownership half of Codex's structural claims (restore-apply.ts, SettingsStack.tsx/navigation types, memories-dao/recency-dao/field-ddl, and the ComposeScreen generation path are each owned by **no** Phase-36 plan) and sides with treating them as HIGH: an unreachable screen, a restore that silently omits new entities, a permission default that never reaches the creation writer, and generation that still flows through legacy `AiSettings.aiProvider` all **compile clean** and would not be caught by the tsc gate.

### Agreed Strengths
- **Migration numbering correct** — 029 is genuinely head+1 (disk head `028-compose-message-mode.ts`; `TARGET_VERSION = COMPOSE_MESSAGE_MODE_SCHEMA_VERSION = 28`). Both lanes + source-grounding.
- **Backup bump correct** — `BACKUP_FORMAT_VERSION = 4` on disk; 36-08's 4→5 with a `4:` `FORWARD_MIGRATIONS` upgrader mirroring the existing `3:` (`backup-schema.ts:101`) is right; 36-08 explicitly flags the stale "v4" text in CONTEXT/dossier.
- **ADR-107 / privacy core enforced, not reversed** — no off-limits shape in `prompt-types.ts` / `prompt-template.ts`; `ai-context-read.ts:183` gates on `allow_ai !== 1`; Group Notes deliberately never read; credentials SecureStore-only + `SECRET_SHAPED_KEY` screen. (Both lanes; orchestrator-verified.)
- **Security boundaries preserved** — `AiKeyStore` has no bulk-export accessor; custom-endpoint SSRF guards (non-HTTPS/credentialed-URL/`.local`/IP-literal rejection) are real and 36-05 forbids removing them.
- **Irreversible surfaces owner-gated** — both migration 029 and backup v5 sit behind blocking-human checkpoints.
- **Fuel-retirement (ADR-081) targets exist exactly where claimed** (`fuel-dao.ts:214/297`, `FuelEditor.tsx:123/251`, `CreateContactScreen.tsx:739`, `EditContactScreen.tsx:1590`).

### Agreed Concerns
- **ComposeScreen is unowned but structurally coupled.** Codex: generation still resolves through legacy `AiSettings.aiProvider`/`aiModel` (`ComposeScreen.tsx:390/392` → `AiService.getActiveProvider`, `AiService.ts:599-601`) and no plan rewires it to the new active connection. Claude: 36-01's breaking `computeAiAvailability` 5-arg reshape omits `ComposeScreen.tsx` from `files_modified` despite it being a real caller (`:87-92,489-499`). Same unowned file, two mechanisms — both resolved by giving a plan explicit ComposeScreen ownership + a generation-config bridge task.
- **36-08 restore side is under-owned in an irreversible plan.** Codex: `restore-apply.ts` (owned by no plan) recognizes only legacy entities (`:43`) and its interaction restore SQL omits `duration`/`allow_ai`/`group_event_id` (`:190`), so the claimed full roundtrip cannot hold. Claude: even for `group_events`, the tombstone exclusion at `export-manifest.ts:208` is not reconciled. Both land inside a wire format "a second retroactive bump cannot correct."

### Divergent Views
- **Overall risk rating:** Codex HIGH (cross-module integration omissions), Claude LOW–MEDIUM (tsc-catchable completeness). Resolution: the orchestrator verified that the most consequential omissions (routing, restore-apply entity import, permission-defaulting writers, generation-config resolution) are **not** tsc-catchable and would ship green-but-broken, so they are carried as HIGH for the planner.
- **AICFG-07 "no artificial context ceiling":** Codex rates the `TOTAL_LIMIT` truncation a HIGH requirement-conformance defect; Claude did not raise it. The orchestrator confirmed a real **cross-plan inconsistency**: 36-03 auto-omits over-budget context against a fixed `TOTAL_LIMIT` (explicit truncation entry, but an automatic drop), while 36-06 states context is "never trimmed" to an arbitrary ceiling and overflow "requires deliberate user resolution." Carried as HIGH (conformance + internal contradiction).


## Codex Review

# Plan Review — Phase 36

## Summary

The plans correctly recognize the core risks: credentials remain in SecureStore, ADR-107 excludes Off Limits from AI egress, OpenRouter is separate from LiteLLM, and the closing backup target is v5. However, several execution plans do not include the real integration owners on disk—especially Compose’s generation adapter, navigation/settings routes, creation writers, and the restore writer. As written, key requirements could test green in isolated modules while remaining unreachable or incomplete in the running app.

## Strengths

- The migration number is correctly grounded in the current schema: migration 028 is registered and `TARGET_VERSION` is 28 in [database.ts](/home/bwales/projects/orbit-app/src/db/database.ts:55), so 029 is the valid head+1.

- Plan 03 correctly enforces ADR-107. The existing egress reader already excludes Group Notes and only projects interaction notes when `allow_ai = 1` in [ai-context-read.ts](/home/bwales/projects/orbit-app/src/db/ai-context-read.ts:158), while ADR-107 explicitly prohibits Off Limits from every AI payload path.

- Plan 02’s offline-safe cache design matches the existing direct-catalog pattern: `loadCachedCatalog()` degrades to `null`, while failed refreshes do not overwrite cache in [model-catalog-cache.ts](/home/bwales/projects/orbit-app/src/ai/model-catalog-cache.ts:106).

- Plans 05 and 07 preserve the right security boundary. `AiKeyStore` has only provider-scoped get/set/delete operations and no bulk export accessor in [ai-key-store.ts](/home/bwales/projects/orbit-app/src/services/ai-key-store.ts:54).

- Plan 08 correctly spots real backup omissions: the current interaction export excludes `duration`, `allow_ai`, and `group_event_id` in [export-manifest.ts](/home/bwales/projects/orbit-app/src/backup/export-manifest.ts:110), and `BACKUP_FORMAT_VERSION` is already 4 in [types.ts](/home/bwales/projects/orbit-app/src/backup/types.ts:14).

## Concerns

- **HIGH — Plan 01 does not modify the actual generation configuration path.** Compose reads legacy `getAppSettings()` values and passes `settings.aiProvider`, `settings.aiModel`, and legacy custom fields directly to the provider in [ComposeScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ComposeScreen.tsx:377) and [ComposeScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ComposeScreen.tsx:392). `AiService.getActiveProvider()` likewise consumes `AiSettings.aiProvider` in [AiService.ts](/home/bwales/projects/orbit-app/src/services/AiService.ts:599). None of these files are in Plan 01. A new `ai_connections` table and Zustand store alone will not make the “direct-BYOK tracer” generate through the active connection.

- **HIGH — Plans 04–07 create screens without routing or entry points.** The Settings navigator currently only registers the existing screens in [SettingsStack.tsx](/home/bwales/projects/orbit-app/src/navigation/tabs/SettingsStack.tsx:51), and the typed route list must be expanded in [types.ts](/home/bwales/projects/orbit-app/src/navigation/types.ts:228). None of Plans 04–07 lists `SettingsStack.tsx`, navigation types, or the relevant `SettingsScreen.tsx` entry. `AIConnectionScreen`, permission management, personalization, and preview would be unreachable.

- **HIGH — Plan 08 only changes export/schema types, not the real restore/reconciliation machinery.** Restore currently recognizes only the legacy entity set in [restore-apply.ts](/home/bwales/projects/orbit-app/src/backup/restore-apply.ts:43), and the interaction restore SQL intentionally omits duration, `allow_ai`, and group linkage in [restore-apply.ts](/home/bwales/projects/orbit-app/src/backup/restore-apply.ts:190). It has no handling for systems, templates, AI connections, personalization sections, or Group Events. Plan 08 must own `restore-apply.ts`, its tests, reconciliation types, and replace-all deletion logic—not just `backup-schema.ts` and `export-manifest.ts`.

- **HIGH — Plan 04’s “new items only” implementation cannot succeed within its listed files.** Memory creation hardcodes registry defaults in [memories-dao.ts](/home/bwales/projects/orbit-app/src/db/memories-dao.ts:107); interaction creation defaults through `DEFAULT_ALLOW_AI` in [recency-dao.ts](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:236); custom-field definitions receive caller-supplied `share_with_ai` in [field-ddl.ts](/home/bwales/projects/orbit-app/src/db/field-ddl.ts:66). The plan must modify these writers and their upstream forms/callers, not merely add `ai-permissions-dao.ts`.

- **HIGH — Plans 03 and 06 conflict with AICFG-07’s “no artificial context ceiling.”** The current prompt resolver deliberately uses `TOTAL_LIMIT` and truncates context in [prompt-template.ts](/home/bwales/projects/orbit-app/src/ai/prompt-template.ts:263). Plan 03 extends that mechanism, and Plan 06 still says sections are “measured into `TOTAL_LIMIT`.” Explicit truncation is better than silent truncation, but it is still an artificial product ceiling. The plans need one settled approach: preserve all selected context, estimate against the selected model’s actual capacity, and block generation with explicit resolution when over capacity.

- **HIGH — Plan 02’s OAuth flow lacks an explicit anti-CSRF/state requirement and strict callback validation.** It specifies PKCE but only says to parse a `code` from a successful redirect. PKCE protects code exchange, not login-CSRF/session mix-up. Require a generated, in-memory `state`, exact `orbit://openrouter-auth` callback validation, one-time callback handling, and rejection of unexpected parameters/hosts before exchange. This is especially important because the plan introduces a browser-to-app trust boundary.

- **MEDIUM — Plan 01’s supposedly complete schema cannot support Plan 07’s disclosure persistence.** Migration 029 lists all proposed `app_settings` columns, but no “AI first-use disclosure completed” flag. Plan 07 later requires a durable nonsecret flag. Add it to migration 029 now, or explicitly use a pre-existing suitable durable setting; neither is currently identified.

- **MEDIUM — “Exactly one active connection” needs an explicit zero-connection invariant.** First-run necessarily has zero configured connections. The schema should represent “no active connection” with an empty/null pointer, and DAO tests should assert: zero configured → Needs Attention; one saved connection may be active; multiple saved connections have exactly one active pointer. A `UNIQUE(lane)` table alone does not enforce pointer referential integrity.

- **MEDIUM — Plan 02 contradicts itself on curation.** It requires curated-first ordering but prohibits a frozen recommendation list or hardcoded model IDs. The current model registry may contain curated data, but the plan needs to identify the runtime source and refresh semantics for recommendation reasons. Otherwise “curated-first” cannot be implemented without violating its own prohibition.

- **MEDIUM — Plan 06’s drag-only reorder is not sufficiently accessible.** An `accessibilityLabel` on a drag handle does not make ordering operable without precise dragging. Add Move up/Move down actions or an accessible reorder mode, consistent with the project’s accessibility commitments.

- **MEDIUM — Package installation will modify lockfiles too.** Plan 02 lists `package.json` but not the repository lockfile. The package manager’s lockfile must be part of the modified-file and verification contract.

## Suggestions

- Add a dedicated integration task immediately after Plan 01 that changes Compose and `AiService` to resolve one active connection into the nonsecret generation settings. Include [ComposeScreen.tsx](/home/bwales/projects/orbit-app/src/screens/ComposeScreen.tsx:377), [AiService.ts](/home/bwales/projects/orbit-app/src/services/AiService.ts:573), and tests.

- Add a shared navigation task, or explicitly assign route registration to each relevant plan: Settings row → connection hub; connection → model picker; settings → permissions/personalization/preview; Compose → context review and repairs.

- Expand Plan 04’s file ownership to all production writers: `memories-dao.ts`, `recency-dao.ts`, `field-ddl.ts`, Group Event interaction writes, and their creation forms. Audit each writer before changing the initial permission invariant.

- Rework Plan 08 around full roundtrip ownership: manifest types/validation, export, reconciliation, `restore-apply.ts`, incoming/local row projections, merge and replace-all behavior, tombstones, and group-event orphan repair tests.

- Make actual model capacity, rather than `TOTAL_LIMIT`, the sole generation blocker for personalization/contact context. Preserve data, calculate estimate, surface overflow, and require the user to reduce context or choose another model.

- Add OAuth `state`, exact redirect validation, cancellation cleanup, and tests for malicious/malformed callback URLs. Preserve the current SecureStore-only key path.

## Risk Assessment

**HIGH.** The privacy posture is thoughtfully specified, but the current plans have multiple cross-module omissions that can produce deceptively green unit tests while failing user-visible requirements: generation still follows legacy settings, new AI screens have no registered routes, new permission defaults do not reach all writers, and v5 export changes have no corresponding restore implementation. These should be corrected before execution, particularly before migration 029 and the irreversible v5 wire-format checkpoint.

---

## Claude Review

# Cross-AI Plan Review — Phase 36 "AI Configuration & Prompting" (Claude lane)

Reviewer: Claude (Opus 4.8), adversarial cross-AI lane. Read-only. Reviewed the 8 plan files plus
CONTEXT/RESEARCH/UI-SPEC and verified every load-bearing claim against the actual source on disk
(`src/db/`, `src/ai/`, `src/backup/`, `src/screens/`, `src/logic/`, `docs/decisions/`), per
"review the code, not the diff."

## 1. Summary

This is a strong, source-grounded plan set. Every high-risk numeric/structural claim I could check is
correct against disk: migration head is 028 so **029 = head+1 is right** (`database.ts:69`
`TARGET_VERSION = COMPOSE_MESSAGE_MODE_SCHEMA_VERSION`; MIGRATIONS ends at `migration028`);
**`BACKUP_FORMAT_VERSION` is 4 on disk** (`src/backup/types.ts:14`) so 36-08's 4→5 bump and `4:`
`FORWARD_MIGRATIONS` upgrader (mirroring the existing `3:` at `backup-schema.ts:101`) is correct, not a
3→4 re-bump. The central privacy invariants are honored **in code, not just on paper**: Off Limits has no
shape anywhere in the egress path (ADR-107 is Accepted/owner-ratified and 36-03 *enforces* it — this is
not a reversal), Group Notes are deliberately never read, interaction notes are gated on `allow_ai=1`
with a hard `LIMIT 3`, and memories/custom-fields flow only through the AI-eligible readers. Credentials
stay in SecureStore and are screened out of the backup by `SECRET_SHAPED_KEY`. The fuel-retirement
targets (ADR-081) exist exactly where 36-03 claims. My concerns are plan **completeness/accuracy** issues
(two `files_modified` omissions around a breaking function-signature change, and one unresolved
tombstone-reconciliation detail in the irreversible backup plan) rather than privacy or data-corruption
defects. **No recorded-decision collisions found.**

## 2. Strengths (verified)

- **Migration numbering is correct.** `src/db/database.ts:69` sets `TARGET_VERSION` to the migration-028
  constant; the MIGRATIONS array ends at `migration028` (024 is intentionally skipped: 023→025 on disk).
  029 is genuinely head+1. 36-01's checkpoint even re-asserts "verify head+1 on disk."
- **Backup version is correctly v4→v5.** `src/backup/types.ts:14` = `4`. `FORWARD_MIGRATIONS` has keys
  1/2/3 (`backup-schema.ts:30,81,101`); 36-08 adds `4:` and bumps to 5. Matches project memory
  ("v4 landed early in 24.1"). 36-08 explicitly flags the stale "v4" text in CONTEXT/dossier.
- **ADR-107 is enforced, not reversed.** `docs/decisions/ADR-107-*.md` is **Status: Accepted**, owner
  ratified 2026-09-13, "Supersedes ADR-078 (partial — Off Limits AI egress only)." 36-03 builds no
  off-limits shape — grep of `src/ai/prompt-template.ts` and `src/ai/prompt-types.ts` returns **zero**
  off-limits/avoid references today, so 36-03 is preserving the current state, not deleting a live control.
- **Egress gate is correct in code.** `src/db/ai-context-read.ts:168-192` `readGatedRecentInteractionNotes`
  gates on `allow_ai !== 1 → continue`, `LIMIT 3`, newest-first; the header (`:162-166`) documents Group
  Notes as "DELIBERATELY never read." `readSharedMemories` (`:232-250`) routes through
  `listAiEligibleMemories`; shared fields through the `share_with_ai=1` reader (`:200-209`). 36-03 renders
  only these already-gated carry-only fields and explicitly forbids widening the reader. The comment at
  `:330` ("carry-only until Phase 36") confirms this is the intended, requirement-backed activation.
- **`AiProviderId` reshape is scoped correctly.** Current union is
  `none|openai|anthropic|google|custom` (`ai-types.ts:23-41`); `acknowledgeProvider` is an exhaustive
  `never`-switch over `AiCloudProviderId` (`app-settings-dao.ts:1455-1484`). 36-01/36-02 correctly know
  `openrouter` must enter both `AiProviderId` and `AiCloudProviderId` and that the switch is the
  compile-time lock.
- **CatalogProvider correctly left alone.** `src/ai/model-catalog-filter.ts:44` `CatalogProvider =
  "openai"|"anthropic"|"google"`; 36-02/36-05 correctly keep OpenRouter out of it as a separate source.
- **SSRF/custom-endpoint guards are real and preserved.** `src/ai/custom-endpoint.ts` rejects non-HTTPS,
  credentialed URLs, `.local`, and IP literals (IPv4/IPv6 CIDR tables, mapped/NAT64 unwrap); `secure-fetch.ts`
  is the native egress boundary. 36-05's prohibition "removing a guard is forbidden" is correct.
- **Deferred portable keys are genuinely deferred and correctly reclaimed.** `app-settings-dao.ts:406-490`
  carries explicit "EMISSION DEFERRED to Phase 36" comments for theme/dashboard/history/channel/compose
  keys (declare-only optional shape). 36-08 Task 1 correctly moves them to emitted. `SECRET_SHAPED_KEY`
  screen exists (`backup-schema.ts:217,243`).
- **Fuel-retirement targets exist where claimed.** `fuel-dao.ts:214 confirmFuelCore`, `:297 confirmFuel`;
  `FuelEditor.tsx:123 onConfirm` prop, `:251 isAiUnconfirmed`; `CreateContactScreen.tsx:739` and
  `EditContactScreen.tsx:1590` pass `onConfirm={() => {}}`. All match 36-03 Task 3 exactly.
- **Wave ordering is sound.** 36-08 (backup) is wave 5 / last with `depends_on: [01..07]`; no two
  same-wave plans share a `files_modified` entry (36-03 and 36-06 both edit `prompt-template.ts` but sit
  in waves 2 and 3 with a dependency edge, so they serialize).
- **Sole-builder / byte-identity discipline** is preserved throughout (`prompt-types.ts:169-183`
  prompt===inspectorDisplay===payload); 36-07's inspectors resolve from the same `resolvePrompt`.

## 3. Concerns

- **[MEDIUM] 36-01 omits `src/screens/ComposeScreen.tsx` from `files_modified` while making a breaking
  signature change to a function ComposeScreen calls.** 36-01 Task 3 rewrites `computeAiAvailability` from
  the current `AiAvailabilityInput = { provider: AiProviderId; hasCredential }` (`ai-availability.ts:37-45,
  51-55`) to a 5-field input `{ aiEnabled, activeConnection, hasCredential, selectedModel, modelAvailable }`.
  ComposeScreen is a **real second caller** (`ComposeScreen.tsx:87-92` imports it; `:230-238` sources
  `activeProvider`/`credentialPresent`/`credentialFailed`; `:489-499` feeds it). `grep -rln
  computeAiAvailability src/` → ComposeScreen, ai-availability, ai-availability.test. Changing the input
  shape necessarily rewrites the ComposeScreen call site (provider→activeConnection, plus new
  selectedModel/modelAvailable sourcing), yet the plan's objective claims ComposeScreen's "existing
  availability consumption reflects" the new states with no file edit. The `ai-availability.ts` header
  (`:15-18`) even promises "Phase 36 later replaces this derivation ... WITHOUT touching Compose" — the
  5-arg reshape contradicts that. Mechanism: the project-wide `tsc` gate will fail until ComposeScreen is
  updated, and the 118k-token estimate does not budget that rework. *Fix: add `ComposeScreen.tsx` to 36-01
  `files_modified` and a task step to re-source its availability inputs, OR keep a back-compat adapter
  signature.*

- **[MEDIUM] 36-08 serializes `group_events` but does not reconcile the existing group_event tombstone
  exclusion — in the one irreversible-in-production plan.** `export-manifest.ts:208` filters tombstones
  with `.filter((row) => row.entity_type !== "group_event")`, i.e. group-event deletions are currently
  **not** carried in backups. 36-08 Task 2 adds a `group_events` entity SELECT (correct — the table is
  absent today) and lists `:208` in `read_first`, but the Task 2/Task 4 actions never say whether the
  tombstone filter should now admit `group_event`. If group_events become a backed-up entity while their
  tombstones stay excluded, a restore cannot propagate group-event deletions — an incomplete restore
  semantic baked into a wire format that "a second retroactive bump cannot correct" (the plan's own
  R-09 rationale). *Fix: 36-08 Task 2 should explicitly decide the group_event tombstone treatment
  (and add a roundtrip test for a deleted group_event) before the v5 checkpoint.*

- **[LOW] Compose consumption of the new `AINeedsAttention` component has no owning `files_modified`
  entry.** 36-05 Task 3 states "Compose consumes the same component so AI-on-but-invalid replaces the AI
  action with the notice," but 36-05 `files_modified` lists only the new AI screens + `AINeedsAttention.tsx`,
  not `ComposeScreen.tsx`. Compose already renders an *interim* needs-attention affordance (per the
  `ai-availability.ts:17-19` header note), so swapping in the polished component would touch ComposeScreen.
  Ownership is ambiguous across 36-01/36-05. Low because the interim path already exists (no regression if
  untouched), but the "Compose consumes the same component" claim is unbacked by a file edit. *Fix: name
  the ComposeScreen wiring in either 36-01 or 36-05.*

- **[LOW] 36-01 adds a permanent, functionally-dead `ai_ack_openrouter` column** to `app_settings` purely
  to satisfy the `acknowledgeProvider` exhaustiveness switch, even though ADR-079 retired the ack gate
  ("`ai_ack_*` columns become unused; removal is a plan-phase choice" — ADR-079 Key files). This is not a
  reversal of ADR-079 (generation is not gated on it), and the migration-029 checkpoint puts the shape in
  front of the owner, but a cleaner path exists (retire `acknowledgeProvider`, per ADR-079's own
  invitation) rather than freezing another dead column into an irreversible migration. *Fix: raise the
  keep-vs-retire choice at the 36-01 checkpoint rather than defaulting to add-the-column.*

- **[LOW] 36-03 Task 3's `onConfirm` removal is grep-noisy and risks over-deletion.** `grep -rln onConfirm
  src/` returns ~18 files, almost all `ConfirmDialog`/dialog `onConfirm` props unrelated to FuelEditor.
  The FuelEditor `onConfirm` prop is consumed only by CreateContactScreen (`:739`) and EditContactScreen
  (`:1590`). The plan's precise gate (`confirmFuel|confirmFuelCore|isAiUnconfirmed`) is fine, but the
  executor must scope the `onConfirm`-prop deletion to FuelEditor's two call sites and must not touch the
  generic `ConfirmDialog.onConfirm`. `fuel-dao.test.ts` is the orphaned-test consumer (grep-confirmed) and
  the plan already flags it. *Fix: tighten Task 3 wording to "FuelEditor's `onConfirm` prop only."*

## 4. Suggestions

- **36-01, Task 3 + frontmatter:** add `src/screens/ComposeScreen.tsx` to `files_modified` and a task step
  re-sourcing its availability inputs to the multi-connection shape; otherwise either the plan or the
  `ai-availability.ts` "without touching Compose" contract is false. (Resolves the MEDIUM.)
- **36-08, Task 2:** add an explicit decision + test for the `group_event` tombstone filter at
  `export-manifest.ts:208` now that group_events are serialized — do not leave it implicit in an
  irreversible wire-format plan. (Resolves the MEDIUM.)
- **36-05, Task 3 (or 36-01):** name the concrete `ComposeScreen.tsx` edit that swaps the interim
  needs-attention affordance for `AINeedsAttention`, or state explicitly that Compose keeps the interim
  and only Settings uses the new component.
- **36-01 migration checkpoint:** surface the `ai_ack_openrouter` add-vs-retire-acknowledgeProvider choice
  to the owner as part of the (already blocking) migration-029 shape approval.
- **36-03, Task 3:** reword the `onConfirm` step to scope strictly to the FuelEditor prop + its two
  screen call sites so the generic `ConfirmDialog.onConfirm` is untouched.

## 5. Risk Assessment

**Overall: LOW–MEDIUM.** The privacy/egress core — the actual reason this phase is sensitive — is correct
and verified against the live gate code (off-limits excluded per the ratified ADR-107, Group Notes never
read, notes gated on `allow_ai=1` with LIMIT 3, memories/fields through AI-eligible readers, credentials
confined to SecureStore and screened out of backup). The two irreversible surfaces (migration 029,
backup v5) are numbered correctly against disk and are both gated behind blocking-human checkpoints. No
recorded decision is reversed or weakened; ADR-107, ADR-081, ADR-079, ADR-049 are all *enforced* by the
plans. The residual risk is confined to two plan-completeness gaps (a breaking signature change whose
consumer file is unlisted; an unreconciled tombstone rule inside the no-second-chance backup plan) that a
disciplined `tsc` gate and execution-time verification should catch, plus minor nits. Nothing here rises
to an owner escalation.

---

## Verification coverage

Source-grounding + cross-artifact fact-drift pass (advisory — does **not** count toward HIGH or actionable counts). Every concrete symbol/path/line/table the plans cite about *existing* source was classified against the code on disk.

| Claim | Plan | Classification | Evidence (actual file:line / grep) |
|---|---|---|---|
| Migration head+1 = 029 | 01, 08 | VERIFIED | Highest on disk `028-compose-message-mode.ts`; `TARGET_VERSION = 28` (database.ts:69, 028:27) → 029 head+1. Disk has a 023→025 gap (no 024). |
| `BACKUP_FORMAT_VERSION` currently 4, bump to 5 | 08 | VERIFIED | `src/backup/types.ts:14` = `4`; direction correct. |
| `formatLocalDate` in src/utils/dates.ts | 02 | VERIFIED | `src/utils/dates.ts:17`. |
| `confirmFuelCore` fuel-dao.ts:214 | 03 | VERIFIED | `src/db/fuel-dao.ts:214`. |
| `confirmFuel` fuel-dao.ts:297 (":297 not :282") | 03 | VERIFIED | `src/db/fuel-dao.ts:297`; the ":297 verified, not :282" note is correct. |
| `AiProviderId`/`AI_PROVIDER_IDS`/`AiCloudProviderId` | 01, 02 | VERIFIED | ai-types.ts:23/:35/:48; `openrouter` absent (to be added — correct). |
| `acknowledgeProvider` exhaustive never-switch | 01, 04 | VERIFIED | `app-settings-dao.ts:1450` def; ai_ack_* handled :737-738. |
| `resolveMaxOutputTokens` token-budget switch | 01 | VERIFIED | token-budget.ts:60 def, :65 switch. |
| `CatalogProvider` = openai/anthropic/google (no openrouter) | 01,02,05 | VERIFIED | model-catalog-filter.ts:44. |
| `memories.allow_ai` column | 03, 04 | VERIFIED | migration 017:37. |
| `interactions.allow_ai` + `duration` | 03,04,08 | VERIFIED | migration 025:45 (duration), :48 (allow_ai). |
| `interactions.group_event_id` | 08 | VERIFIED | migration 026:32 (correctly attributed to 026, not 025). |
| `custom_field_defs.share_with_ai` | 04 | VERIFIED | migration 001:139. |
| `group_events` table incl `group_note` | 08 | VERIFIED | migration 026:18-26. |
| `readGatedRecentInteractionNotes` allow_ai===1 gate | 03 | VERIFIED | ai-context-read.ts:168 def, :183 `if (r.allow_ai !== 1)`. |
| `computeAiAvailability`/`AiAvailability` | 01 | VERIFIED | ai-availability.ts:31/:49 (currently singular-provider — plan rewrites). |
| FuelEditor `onConfirm`/`isAiUnconfirmed`/Confirm control | 03 | VERIFIED | FuelEditor.tsx:123/:238/:251/:408. |
| CreateContactScreen/EditContactScreen onConfirm no-op | 03 | VERIFIED | CreateContactScreen.tsx:739; EditContactScreen.tsx:1590. |
| `keyItemName` SecureStore | 02, 05 | VERIFIED | ai-key-store.ts:30. |
| `validateCustomEndpoint` | 05 | VERIFIED | custom-endpoint.ts:236. |
| prompt-types carry-only `sharedMemories`/`gatedRecentInteractionNotes` + `TruncationNotice`; no off-limits field | 03, 06 | VERIFIED | prompt-types.ts:138/:154/:163. |
| `resolvePrompt`/`PER_VALUE_LIMIT`/`TOTAL_LIMIT`/`sanitizeValue`/byte-identity | 03,06,07 | VERIFIED | prompt-template.ts:149/:40/:38/:102; prompt===inspectorDisplay===payload :339-344. |
| carry-only fields NOT yet rendered in prompt-template | 03 | VERIFIED | Full read confirms plan adds them (correct). |
| `model-catalog-cache` loadCachedCatalog/refresh contract | 02 | VERIFIED | model-catalog-cache.ts:21/:23/:106. |
| ai-suggestion-logic resolvePrompt/generateVariants/sanitizeError | 03, 07 | VERIFIED | ai-suggestion-logic.ts:112/:139; ack gate already removed. |
| export-manifest interactions SELECT :110 lacks duration/allow_ai/group_event_id | 08 | VERIFIED | export-manifest.ts:110. |
| export-manifest group_event tombstone filter :208 | 08 | VERIFIED | export-manifest.ts:208. |
| `FORWARD_MIGRATIONS` `3:` upgrader to mirror; no `4:` yet | 08 | VERIFIED | backup-schema.ts:101. |
| `getPortableSettingsSnapshot` + DEFERRED-to-P36 declare-only cols | 08 | VERIFIED | app-settings-dao.ts:840; deferral comments :435-485. |
| `PORTABLE_SETTINGS_KEYS`/`SECRET_SHAPED_KEY`/`assertPortableSettings` | 08 | VERIFIED | backup-schema.ts:137/:217/:236. |
| Phase 35 shipped no Adjust control in ComposeScreen ("verified") | 03 | VERIFIED | `grep -in adjust ComposeScreen.tsx` → 0 hits. |
| **`src/services/model-registry.ts` (curated set)** | 05 | **MISSING** | No such file. Actual is `src/ai/model-registry.ts`. Wrong directory in read_first (pointer only, not files_modified). |
| prompt-template.ts ":98-104 treat-as-data static instruction" | 03 | AMBIGUOUS | :98-104 is `sanitizeValue`; the treat-as-data `STATIC_INSTRUCTION` is :64-75. Related-but-different construct. |
| ai-context-read.ts ":47 formatLocalDate day-boundary usage" | 02 | AMBIGUOUS | :47 is the import; actual usage :89. Symbol present, line imprecise. |
| Net-new: migration 029; `ai_connections`, `personalization_sections`, `ai_ack_openrouter`; ai-connections-dao, ai-config-store, openrouter-oauth/-catalog, ai-permissions-dao, personalization-dao, context-estimate, ai-diagnostics; AIConnection/AIModelPicker/AINeedsAttention/AIPersonalization/AIPermissions/AIPreview/AIFirstUseDisclosure/AIComposeContextReview; `FORWARD_MIGRATIONS 4:`; `BACKUP_FORMAT_VERSION=5`; expo-web-browser/auth-session/crypto; `orbit://openrouter-auth`; sharedMemories/gatedRecentInteractionNotes rendering | 01-08 | UNCHECKABLE | Created by this phase — nothing to verify yet. `ai_ack_openrouter` confirmed absent today (as expected). |

### Fact-drift notes
- **model-registry path drift (36-05, MISSING):** read_first cites `src/services/model-registry.ts`; the file is `src/ai/model-registry.ts`. read_first pointer only (not a files_modified entry) — low blast radius, but the executor will not find it at the cited path.
- **CONTEXT.md "v4" vs on-disk (no live contradiction):** 36-08 explicitly flags that CONTEXT D-03/D-03b/D-12 say "v4" and calls that STALE (v4 landed early in 24.1); on-disk is 4, closing target 5. Consistent with disk + MEMORY. No cross-plan collision.
- **Migration-number consistency (no contradiction):** all eight plans consistently cite 029; disk `TARGET_VERSION`=28 and 029 is genuinely head+1 (a 024 gap exists, but the plans correctly use 029).
- **Line-range citations systematically slightly loose** (e.g. 01 ":23-41", 03 ":98-104", 02 ":47") — symbols resolve correctly, enclosing windows approximate. Advisory only.
- No cross-plan contradiction found on any shared symbol (`resolvePrompt`, `getPortableSettingsSnapshot`, the `allow_ai` gate, `acknowledgeProvider`, `CatalogProvider` all cited mutually consistently).

**Source-grounding summary: VERIFIED 41 / MISSING 1 / AMBIGUOUS 2 / UNCHECKABLE ~24 (net-new phase artifacts). Advisory — excluded from HIGH/actionable counts.**
