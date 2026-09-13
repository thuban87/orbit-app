---
phase: 36
reviewers: [codex, claude]
reviewed_at: 2026-09-13T23:08:53Z
plans_reviewed: [36-01-PLAN.md, 36-02-PLAN.md, 36-03-PLAN.md, 36-04-PLAN.md, 36-05-PLAN.md, 36-06-PLAN.md, 36-07-PLAN.md, 36-08-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=low)"
  claude: "claude-opus (read-only subagent lane)"
model_sources:
  codex: "banner"
  claude: "subagent-lane"
review_notes:
  - "The Claude lane ran as a read-only Claude subagent (not the built-in `claude -p` CLI lane), per the project's known Write-permission gap in that lane (MEMORY: claude-reviewer-via-subagent). It received the same source-grounding prompt and had full repo read access."
  - "A source-grounding + cross-artifact fact-drift pass was also run (advisory; see Verification coverage). Its findings do NOT count toward the HIGH or actionable counts."
  - "The orchestrator independently verified the load-bearing egress/privacy claims (ADR-107 off-limits exclusion, allow_ai gate, backup v5/credential exclusion) and the highest-impact structural findings (restore-apply / navigation / permission-writer / generation-path file ownership) against the code on disk."
cycle_summary: "current_high=6 current_actionable=9"
---

# Cross-AI Plan Review — Phase 36 "AI Configuration & Prompting"

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
