# Phase 36: AI Configuration & Prompting - Research

**Researched:** 2026-09-13
**Domain:** On-device AI connection/config subsystem (multi-lane provider connect, OpenRouter browser-OAuth, model catalog + pricing, prompt assembly, permission model, sanitized diagnostics, backup wire-format close-out) for a local-first React Native / Expo app.
**Confidence:** HIGH on in-repo state (read on disk this session); MEDIUM on OpenRouter/Expo external APIs (official docs, versions verified on npm).

> Ground truth is the milestone-2 dossier + planning notes + ADR-049/051/078/079/**107**. 36-CONTEXT.md is a shim. Where a newer ADR conflicts with CONTEXT, the ADR wins — see the **flagged conflict** in User Constraints below.

---

<user_constraints>
## User Constraints (from CONTEXT.md + dossier + ADRs)

### Locked Decisions (verbatim from 36-CONTEXT.md `## Decisions`)

**Ground truth and process**
- **D-01:** Read the phase dossier IN FULL before planning. Its dated "Amendment — audit resolutions 2026-09-01" section overrides older text. [DECIDED]/[REJECTED] items are settled; reversing any Accepted ADR or HANDOFF.md entry is an owner decision — stop and ask.
- **D-02:** Read the planning-notes file as a binding appendix: every REPLAN finding must be reflected in the plan; every trip-wire is a stop-and-ask.
- **D-03:** This phase ships SQLite schema (≥ two migrations: the AI configuration model, and remaining `app_settings` preference columns it owns). Never assume a migration number — verify head+1 on disk. Milestone order is schema → consumers → backup; the backup bump is this phase's final plan. All new durable preferences are `app_settings` columns added to `PORTABLE_SETTINGS_KEYS`, never AsyncStorage.
- **D-03b:** Phase 36 owns the backup wire-format bump as its **FINAL** plan, sequenced after every other schema-bearing phase; it must serialize every entity and portable preference the milestone added, carry Phase 33's restore validation/orphan-repair rules, keep all credentials out (ADR-049), and give every retired portable key a decided restore-compat behavior.

**Phase-specific**
- **D-04:** ADR-049 honored without exception: **API keys live only in SecureStore**, never in `app_settings` or the backup (R-07 trip-wire). `SECRET_SHAPED_KEY` screening stays; a restored install must never falsely appear Ready without valid local credentials.
- **D-05:** ADR-051 egress guards present with **no host allowlist**: adding one is additive and permitted; **removing a guard is not** (trip-wire). OpenRouter adds a new egress host + browser-OAuth path — already decided; do not widen further without asking. LAN/private-network/local-model endpoints stay deferred; private-address/SSRF safeguards not casually removed.
- **D-06 (⚠ PARTIALLY SUPERSEDED BY ADR-107 — see flag below):** ADR-078 governs what may be transmitted; AI-enabled Off Limits sent as **negative avoidance constraints**; three most recent Interactions included as a compact projection with a **note** only when that interaction's Allow AI toggle is ON; Group Notes never transmitted. ADR-050/ADR-036 superseded by ADR-078.
- **D-07:** **Group Notes never transmitted to AI**, never appear in the permission manager. This phase owns the per-interaction Allow AI type default: **default OFF, new-items-only**, with interaction notes a covered/reviewable/withdrawable type.
- **D-08:** ADR-079 governs transparency: **lightweight first-use disclosure** naming the active connection's real data path, full prompt/context review on demand — replacing ADR-052's exact-prompt first-send acknowledgement.
- **D-09:** Master toggle, three-lane multi-connection model, OpenRouter, Personalization Context, Writing Style, permission defaults are **all unbuilt** — verify on disk (done: see On-Disk Verification below).
- **D-10:** Enumerate in the plan **every** edit point adding OpenRouter as a fixed provider touches (done: see below).
- **D-11:** No silent substitution, no silent truncation: exactly one connection active; unavailable model → **Needs Attention** with explicit reselection; over-capacity reported explicitly. Failure diagnostics sanitized — safe metadata only.
- **D-12:** As owner of the wire-format bump, verify the **whole milestone preference inventory** landed portably (done: see Backup section).

### Claude's Discretion (verbatim)
- Everything the dossier marks [DERIVED], plus open implementation details that do not touch a [DECIDED] item, an ADR, or a HANDOFF.md entry.

### Deferred Ideas — OUT OF SCOPE (verbatim from CONTEXT `## Deferred`)
Do NOT build: Orbit-hosted AI proxy, Orbit-funded shared keys, or any auth-backed AI service (AI stays BYO-connection); automatic model/provider fallback, multiple simultaneously active connections, or per-generation provider switching; an arbitrary HTTP API builder or LAN/local-model endpoints; per-contact persistent AI personalization documents; and a full app-wide Sentry installation — this phase establishes only the sanitized diagnostic seam. (Plus the dossier's full [DEFERRED] list: DOCX/PDF import, rich-text/nesting/version-history personalization, live-linked files, writing-sample training, immutable AI audit history, detailed non-OpenRouter pricing DB.)

### ⚠ FLAGGED CONFLICT — DO NOT RESOLVE (owner already decided; surfaced per task)

**CONTEXT D-06 (ADR-078 Off Limits egress) is REVERSED by ADR-107, which is Accepted and newer.**

- `[VERIFIED: docs/decisions/ADR-107-off-limits-excluded-from-all-ai-egress.md:1-51]` ADR-107 (Status: **Accepted**, Date: 2026-09-13, Phase 35, owner-ratified 2026-09-13) **partially supersedes ADR-078**: "Off Limits items are **never transmitted to the AI provider in any form** — not as positive context ... and not as negative avoidance constraints (this reverses ADR-078's widening)."
- **Reason on disk (ADR-107 Context, verbatim):** "Off Limits items live in the `fuel` table, which carries no per-item AI-permission column and none is added, so an 'AI-enabled vs AI-disabled off-limits' distinction has no data source." Confirmed on disk: no `fuel.allow_ai` column exists (see On-Disk Verification #6).
- **What still stands from ADR-078 (ADR-107:9,18):** the recent-interaction-note projection gated on each interaction's `allow_ai` flag, and the absolute Group Notes ban. Only the Off Limits egress half is reversed.
- **Already reconciled downstream:** the signed-off 36-UI-SPEC.md (Surface #10 guardrails) already cites ADR-107 and states "Off Limits never appears here as an AI-egress toggle (Off Limits is never transmitted to AI in any form — ADR-107)." The prompt-types/ai-context-read code on disk already carries Off Limits in **no shape** (see below).
- **Consequence for the planner:** Build to **ADR-107**, not to the literal text of CONTEXT D-06. Do NOT populate any `PromptContext` avoidance-constraint shape from off-limits; do NOT render an off-limits section in the prompt template; do NOT surface off-limits in the permission manager. This is a settled owner decision (an ADR reversal already made) — the planner enforces it, does not re-open it. If any plan proposes sending off-limits in any form, that is a decision reversal → stop and ask.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description (from dossier success criteria / UI-SPEC) | Research Support |
|----|-------------|------------------|
| AICFG-01 | Real global AI Enabled master toggle; off preserves all config; off ≠ Needs Attention | New `ai_enabled` column needed — none exists today (`provider='none'` is the sole disable). Migration + `app_settings` + `getPortableSettingsSnapshot` emission + `PORTABLE_SETTINGS_KEYS`. |
| AICFG-02 | Three lanes: OpenRouter / direct BYOK / OpenAI-compatible Custom HTTPS; exactly one active | Current single-provider schema (`ai_provider`/`ai_model`/`ai_custom_*`) must become multi-connection storage (definitions + active pointer + per-connection remembered model). |
| AICFG-03 | Safe switching; inactive configs retained; removal separate & deliberate | Per-connection SecureStore key model already namespaced (`ai-key-store.ts`); OpenRouter adds a new credential slot. |
| AICFG-04 | OpenRouter browser-auth + curated-first model picker + live pricing + daily/manual catalog refresh | OpenRouter OAuth PKCE + `GET /api/v1/models` (pricing strings). Separate from the existing LiteLLM catalog (which serves direct BYOK). |
| AICFG-05 | Needs Attention / repair; no silent substitution | `ai-availability.ts` (logic) exists; extend for multi-connection + model-unavailable state. |
| AICFG-06 | Writing Style (structured + freeform) + ordered Personalization Context sections (paste + .txt/.md import) | New entities/tables; `expo-document-picker` already installed for import. |
| AICFG-07 | Token/context estimate + OpenRouter input-cost estimate; explicit overflow, no silent truncation | `token-budget.ts` sizes output only; a context-size estimator + cost calc from OpenRouter pricing is new. |
| AICFG-08 | Orbit-owned immutable system/output prompt; user cannot replace it | `prompt-template.ts` `STATIC_INSTRUCTION` already immutable; extend for new context sections. |
| AICFG-09 | (Personalization enablement semantics) enabled=sent, disabled=stored | No second per-section permission flag (dossier §T). |
| AICFG-10 | Central AI permission manager: defaults + review existing; bulk disable/confirmed enable | Contact Knowledge items + AI-enabled interaction notes only; NOT off-limits (ADR-107), NOT Group Notes. |
| AICFG-11 | First-use disclosure (lightweight, names data path) | ADR-079; do NOT gate generation on `ai_ack_*` (retired). |
| AICFG-12 | Preview What Orbit Sends (whole-system) + Preview with contact; Compose contact-specific review | Both must resolve from the SAME `resolvePrompt` path (byte-identity contract in `prompt-types.ts`). |
| AICFG-13 | Human-readable generation failure categories; Details = sanitized only; Compose state preserved | 8 categories in UI-SPEC Copywriting; `sanitizeError` seam in `ai-suggestion-logic.ts`. |
| AICFG-14 | Sanitized structured diagnostic seam (no private content) | Dossier §AI allowlist; build a narrow diagnostic helper/schema; no full Sentry (deferred). |
| AICFG-15 | Prompt assembly renders gated recent-interaction notes + shared memories (carry-only today) | `PromptContext.gatedRecentInteractionNotes?` and `sharedMemories?` are **carried but NOT rendered** — Phase 36 owns their prompt-template serialization/transmission. |
| AICFG-16 | Backup wire-format bump (v5) as FINAL plan | `BACKUP_FORMAT_VERSION` is already **4** — closing target is **5** (see flag). |
| AICFG-17 | Legacy AI reconciliation (retire raw-template UX, old Conversation Fuel confirm UI, `provider='none'`-as-only-disable) | Inert AI-fuel confirm UI still present (see cleanup inventory). |

> Requirement IDs above map dossier success criteria (1–22) to the AICFG-01..17 set given in the phase brief. Verify exact ID→criterion binding against `.planning/REQUIREMENTS.md` at plan time; the descriptions here are the behaviors, which are what the plan must deliver.
</phase_requirements>

---

## Summary

Phase 36 turns Orbit's currently-dormant single-provider AI stub into a full, user-owned AI subsystem. On disk today: a single `app_settings` provider config (`ai_provider`/`ai_model`/`ai_custom_endpoint`/`ai_custom_model`/`ai_prompt_template`, migration 004), one namespaced SecureStore key per fixed provider (`ai-key-store.ts`), a LiteLLM-sourced model catalog for the three direct providers (no pricing read), a byte-identity prompt resolver (`prompt-template.ts`) that already handles Draft/Rewrite, a closed egress allowlist (`prompt-types.ts` / `ai-context-read.ts`), and a one-request Compose lifecycle (`ai-suggestion-logic.ts`) whose first-send ack gate has already been removed (ADR-079). There is **zero** OpenRouter / WebBrowser / AuthSession code. The master toggle, multi-connection model, personalization, and permission manager are entirely unbuilt.

Two documented drifts must be surfaced to the planner up front: (1) **the backup format is already v4** (landed early in Phase 24.1), so the milestone-closing bump is **v5**, not "the v4 bump" that CONTEXT D-03 still names; and (2) **ADR-107 reversed ADR-078's Off Limits egress** — Off Limits is now never sent in any form, which the signed-off UI-SPEC and the code already reflect but CONTEXT D-06 does not.

The genuinely new external integrations are OpenRouter (a custom OAuth-PKCE browser flow returning a user API key, plus a public models+pricing catalog) and the Expo browser-auth primitives (`expo-web-browser` + `expo-auth-session` + `expo-crypto`, all official, SDK-57-aligned, not yet installed). Everything else is Orbit-owned schema, UI, and prompt-assembly work reusing the existing adapters and egress boundary.

**Primary recommendation:** Structure the phase as `[migration: multi-connection AI config + ai_enabled + permission defaults] → [migration: remaining portable pref columns] → [OpenRouter OAuth+catalog] → [personalization + prompt assembly rendering carry-only fields] → [permission manager] → [transparency + diagnostics] → [FINAL: backup format v5 bump with full milestone entity/pref serialization]`. Number migrations head+1 from **029** (TARGET_VERSION is 28). Reuse the existing SecureStore key model, LiteLLM catalog (direct providers), and byte-identity `resolvePrompt` — never build a second prompt path. Add OpenRouter as its own catalog+pricing source, not by cramming it into the LiteLLM `CatalogProvider` union.

---

## On-Disk Verification (REQUIRED by orbit_project_rules — read this session)

### 1. Backup format version — DRIFT CONFIRMED (v4 already landed; closing target = v5)

- `[VERIFIED: src/backup/types.ts:14]` `export const BACKUP_FORMAT_VERSION = 4;` — **already 4**, not 3. CONTEXT D-03/D-03b/D-12 saying "the v4 bump" is stale; v4 landed early (Phase 24.1, per MEMORY note and the FORWARD_MIGRATIONS `3:` entry below).
- `[VERIFIED: src/backup/backup-schema.ts:101-108]` FORWARD_MIGRATIONS already has a `3:` upgrader emitting `backupFormatVersion: 4` and adding `memories`, `relationships`, `currentStateEntries`.
- `[VERIFIED: src/backup/backup-schema.ts:171-213]` Multiple `PORTABLE_SETTINGS_KEYS` comments state emission + "`BACKUP_FORMAT_VERSION` bump" + a "`FORWARD_MIGRATIONS` entry" are **"Phase 36 scope"** and reference a **"format-5 backup"** / **"format bump"**.
- **Correct closing target: `BACKUP_FORMAT_VERSION = 5`** (head+1 from the on-disk 4). The bump plan must also add a `4:` FORWARD_MIGRATIONS upgrader. Do NOT re-bump to 4 (a no-op) — that would ship an incomplete format and a second irreversible bump can't be given retroactively (planning-notes R-09 trip-wire).

### 2. AI config current state (D-09) — all confirmed unbuilt

- `[VERIFIED: src/services/ai-types.ts:23-28]` `AiProviderId = "none" | "openai" | "anthropic" | "google" | "custom"` — **no `openrouter`**. `[VERIFIED: :35-41]` `AI_PROVIDER_IDS` array mirrors it. `[VERIFIED: :48]` `AiCloudProviderId = Exclude<AiProviderId,"none">`.
- **No `ai_enabled` column.** `[VERIFIED: src/db/migrations/004-ai-settings.ts:41-83]` migration 004 adds exactly `ai_provider` (DEFAULT `'none'`), `ai_model`, `ai_custom_endpoint`, `ai_custom_model`, `ai_prompt_template` (all TEXT NOT NULL DEFAULT `''`) and `ai_ack_openai`/`ai_ack_anthropic`/`ai_ack_google`/`ai_ack_custom` (INTEGER NOT NULL DEFAULT 0). `provider='none'` is the sole disable.
- **Credentials:** `[VERIFIED: src/services/ai-key-store.ts:26-53]` one SecureStore item per provider (`orbit.ai.key.<provider>`), get/set/delete only, **"There is deliberately NO 'get all keys' surface"** — no bulk accessor. No key ever in SQLite.
- **OpenRouter/WebBrowser/AuthSession:** `[VERIFIED: grep of src/ + package.json]` **zero hits** for `openrouter`, `WebBrowser`, `AuthSession`, `expo-web-browser`, `expo-auth-session`.
- **Model catalog pricing:** `[VERIFIED: src/ai/model-catalog-filter.ts:18-20,69-78]` the LiteLLM filter reads `litellm_provider`, `mode`, `deprecation_date`, `max_output_tokens`/`max_tokens` and explicitly notes "cost/context fields we do NOT read." No pricing.
- **Prompt template:** `[VERIFIED: src/ai/prompt-template.ts:64-88,289-292]` a fixed `STATIC_INSTRUCTION` + a user "style note" (`ai_prompt_template`, default `DEFAULT_STYLE_NOTE`) rendered inside a `USER STYLE NOTE` DATA block. Confirmed a fixed prompt with a user style note.

### 3. Every edit point adding OpenRouter as a fixed provider touches (D-10)

| # | Edit point | Location | Note |
|---|-----------|----------|------|
| 1 | Closed `AiProviderId` union + `AI_PROVIDER_IDS` runtime array | `[VERIFIED: src/services/ai-types.ts:23-28, 35-41]` | Add `"openrouter"` to both in lockstep (comment demands lockstep). |
| 2 | New `ai_ack_<id>` column | New migration 029 (pattern: `[VERIFIED: src/db/migrations/004-ai-settings.ts:66-83]`) | **See caveat below** — the ack gate is retired (ADR-079); adding `ai_ack_openrouter` may be vestigial. |
| 3 | Exhaustive `never` switch in `acknowledgeProvider` | `[VERIFIED: src/db/app-settings-dao.ts:1450-1477]` — `switch(provider)` with `const _exhaustive: never = provider` default | Adding `openrouter` to `AiCloudProviderId` forces a new `case` here or the build breaks (this is the compile-time lock working). |
| 4 | `PROVIDER_NAMES` | `[VERIFIED: src/screens/settings-ai-logic.ts:35-41]` `Record<AiProviderId,string>` | Add `openrouter: "OpenRouter"`; `Record<AiProviderId,…>` forces it. |
| 5 | `token-budget` | `[VERIFIED: src/ai/token-budget.ts:60-75]` `resolveMaxOutputTokens` switch | OpenRouter falls to `default` (no cap) unless a case is added; decide per OpenRouter's OpenAI-compatible contract. |
| 6 | `CatalogProvider` | `[VERIFIED: src/ai/model-catalog-filter.ts:44-51]` `= "openai"|"anthropic"|"google"` | **Do NOT force OpenRouter into the LiteLLM union.** OpenRouter has its own catalog+pricing API — model it as a separate catalog source. See Architecture. |

**Caveat on #2 (surface for planner):** `[VERIFIED: src/logic/ai-suggestion-logic.ts:58-63,219]` the ack gate and the entire acknowledgement path have been **removed** — "generation is never gated on a per-provider acknowledgement flag that nothing sets. The DAO-level acknowledgement writer stays in place (forward-only columns); this module simply no longer calls it." So the `ai_ack_*` columns are now vestigial. CONTEXT D-10 (authored before ADR-079 fully landed) lists "a new `ai_ack_<id>` column" as a required edit point, but ADR-079/D-08 retired the gate. **Recommendation:** either add `ai_ack_openrouter` purely for the `AiCloudProviderId` exhaustiveness contract (cheapest, keeps the `never` switch honest), OR narrow the ack path to exclude OpenRouter. This is an implementation detail to settle in the plan; flag it so it's a deliberate choice, not an accident. `[ASSUMED]` that the cheapest path (add the column) is preferred — confirm.

### 4. Legacy AI-proposed-fuel cleanup this phase consumes (ROADMAP "Consumes from Phase 24.2")

- `[VERIFIED: src/db/fuel-dao.ts:214]` `confirmFuelCore(exec, input)` and `[VERIFIED: :297]` `confirmFuel(...)` still exist (flip `source='ai'` → `'manual'`). (Task said ~282; actual is 297.)
- `[VERIFIED: src/components/FuelEditor.tsx:39-51,122,249-251,317]` the AI-unconfirmed render (`isAiUnconfirmed = item.source === "ai"` at :251), the distinct styling (:270), and the Confirm control (:317) + `onConfirm` prop (:122) still exist.
- **CORRECTION to the task's location claim:** `[VERIFIED: grep confirmFuel across src/*.tsx/*.ts]` `confirmFuel` is **NOT** referenced in `ContactProfileScreen.tsx`. The only non-DAO reference is the FuelEditor comment. `FuelEditor` is consumed by **`CreateContactScreen.tsx` and `EditContactScreen.tsx`** (`[VERIFIED: grep FuelEditor]`), not the profile screen. Lines 70/705 of `ContactProfileScreen.tsx` are unrelated state (`bindIntervalDays`, `reachOutOpen`). The planner should grep `onConfirm=`/`confirmFuel` in `CreateContactScreen.tsx`/`EditContactScreen.tsx` to find the exact wiring to delete.
- **Inert because no producer exists:** `[VERIFIED: src/db/ai-context-read.ts:326-327]` "the existing fuel projection is intentionally unaffected: its SQL still excludes source='ai', while migration 017 leaves no such fuel rows to read." `[VERIFIED: src/db/migrations/017-knowledge-egress-datamove.ts:1-8]` migration 017 is the "no-loss fuel retirement." So the confirm/dismiss UI is dead code Phase 36 removes (retire raw AI-fuel confirmation per dossier §AK).

### 5. Portable settings inventory (D-12) — what must serialize into the v5 backup

`[VERIFIED: src/backup/backup-schema.ts:137-215]` `PORTABLE_SETTINGS_KEYS` currently **accepts-for-restore** (but does NOT emit) a large declare-only set. `[VERIFIED: src/db/app-settings-dao.ts:435-485]` these keys are deliberately absent from the `getPortableSettingsSnapshot` SELECT ("Do NOT add these to getPortableSettingsSnapshot this phase … Phase 36").

| Preference | In `PORTABLE_SETTINGS_KEYS`? | Emitted by snapshot today? | Phase 36 action |
|-----------|------------------------------|----------------------------|-----------------|
| AI provider/model/custom (`aiProvider`,`aiModel`,`aiCustomEndpoint`,`aiCustomModel`,`aiPromptTemplate`) | ✅ (:148-152) | ✅ | Extend for multi-connection + `ai_enabled`. |
| Theme (`themePackage`,`galaxyMode`,`standardMode`,`galaxyAccent`,`standardAccent`,`galaxyBackground`,`standardBackground`) | ✅ declare-only (:164-170) | ❌ | **Add emission.** |
| Dashboard (`dashboardViewMode`,`dashboardPopulations`,`dashboardFilters`,`dashboardSort`,`dashboardRightSwipeAction`) | ✅ declare-only (:174-178) | ❌ | **Add emission.** |
| Orrery (`orreryDensity`,`orrerySatellitesEnabled`,`orreryLastSystem`) | ✅ declare-only (:181-186) | ❌ | **Add emission.** |
| Profile templates (`profileLayoutTemplateUid`,`profileBackgroundTemplateUid`) | ✅ declare-only (:189-190) | ❌ | **Add emission** (+ template *entities*, see below). |
| History (`historyLens`,`historyCycleCount`) | ✅ declare-only (:195-196) | ❌ | **Add emission.** |
| Interaction channel (`defaultInteractionChannel`,`rememberedInteractionChannel`) | ✅ declare-only (:204-205) | ❌ | **Add emission** (camelCase manifest keys, not snake_case). |
| Compose message mode (`defaultMessageMode`,`rememberedMessageMode`) | ✅ declare-only (:213-214) | ❌ | **Add emission.** |
| **AI Enabled + permission type-defaults + per-interaction Allow-AI default** | ❌ not present | ❌ | **New columns + add to keys + emit.** |
| Personalization Context sections + Writing Style | ❌ (entity/settings) | ❌ | **New entities/settings + serialize.** |

Entity-level serialization already present `[VERIFIED: src/backup/export-manifest.ts:110-138]`: interactions (incl. `note`, `channel`, `quality`), events, fuel, memories (incl. `allow_ai`), relationships, current_state_entries, custom field defs/values/history. **Still missing wire entities Phase 36 must add:** orrery **Systems** tables (declared "Phase 36 wire entities" at backup-schema.ts:182-186), profile **template** entities (backup-schema.ts:188-189), and this phase's **AI connections + personalization** entities. Verify group-events (`events`) and interaction `duration` coverage against migrations 025/026 at plan time — export-manifest reads `events` but confirm the group-event shared record and any duration column are covered.

- **Retired keys needing decided restore-compat (planning-notes R-09):** `includeUnboundNeverContacted` (:158) and any Manage-favourites key — give each a decided behavior, not a silent drop.

### 6. Egress + secret-screening guards (D-04/D-05) — present, preserve all

- `[VERIFIED: src/backup/backup-schema.ts:217-218]` `SECRET_SHAPED_KEY = /(?:api.?key|secret|passphrase|token|credential|password)/i` and `[VERIFIED: :243]` `assertPortableSettings` rejects any key matching it OR not in `PORTABLE_SETTINGS_KEYS`. **Removing this is a trip-wire.** When adding OpenRouter/personalization keys, ensure no key name matches the secret regex (e.g. avoid `*Token`, `*Key`, `*Credential` in portable key names — the OAuth key itself must never be a portable key anyway).
- `[VERIFIED: src/ai/custom-endpoint.ts:11-14,55-56,224,236-257]` `validateCustomEndpoint(raw)` rejects non-HTTPS, credentialed URLs, `.local` mDNS, and IP literals (loopback `127.0.0.0/8`, link-local `169.254.0.0/16`, etc.). `[VERIFIED: src/ai/secure-fetch.ts:6-7,113]` `validateCustomEndpoint` runs FIRST in `secure-fetch`, and DNS-rebinding/SSRF at connection time is handled there. **No host allowlist exists** — adding one is additive (permitted), removing any guard is a trip-wire.
- `[VERIFIED: src/screens/settings-ai-logic.ts:74-92]` `buildAiSettingsPatch` has no path that copies `apiKey` into the patch; `validateEndpointForSave` reuses the shared validator before persistence.

### 7. Existing AI provider/prompt/permission code paths (map)

| Concern | File(s) | State |
|---------|---------|-------|
| Provider config type / disable | `src/services/ai-types.ts` `[VERIFIED:1-87]` | Single provider; `AiSettings` holds NO key. |
| Credentials | `src/services/ai-key-store.ts` `[VERIFIED:1-106]` | Per-provider SecureStore, no bulk accessor. |
| Provider adapters + output parse | `src/services/AiService.ts` (`parseSuggestionOutput` :132; per-provider `walk`/parse at :286/:375/:451/:553) | OpenAI/Anthropic/Gemini/custom adapters; 1,200-code-point post-parse trim. |
| Model catalog (direct) | `src/ai/model-catalog-filter.ts` `[VERIFIED:1-236]`, `model-catalog-cache.ts`, `model-registry.ts` | LiteLLM public JSON; no pricing; `CatalogProvider` = 3 direct providers. |
| Output sizing | `src/ai/token-budget.ts` `[VERIFIED:1-75]` | Per-provider max-output; node-pure. |
| Closed egress allowlist | `src/ai/prompt-types.ts` `[VERIFIED:1-185]` | `PromptContext` closed type; `gatedRecentInteractionNotes?` + `sharedMemories?` **carry-only**. |
| Egress projection | `src/db/ai-context-read.ts` `[VERIFIED:1-351]` | Sole projection; reads `allow_ai` gate (migration 025); Off Limits carried in no shape (ADR-107). |
| Prompt resolver (byte-identity) | `src/ai/prompt-template.ts` `[VERIFIED:1-346]` | Sole builder; Draft/Rewrite; deeply frozen `ResolvedPrompt`. |
| Compose lifecycle | `src/logic/ai-suggestion-logic.ts` `[VERIFIED:1-319]` | One-request; ack gate removed; `sanitizeError` seam. |
| Availability | `src/logic/ai-availability.ts` | Extend for multi-connection + Needs-Attention. |
| Settings AI logic | `src/screens/settings-ai-logic.ts` `[VERIFIED:1-206]` | `PROVIDER_NAMES`, `CUSTOM_RETENTION_CAVEAT` (:49-51), inspector/ack view-state. |
| Fuel read (excludes off-limits/AI) | `src/db/fuel-read.ts`, `fuel-dao.ts` | `getRankedFuel` excludes off_limits/source='ai'/blank in SQL. |
| Per-interaction Allow AI gate | `interactions.allow_ai` (migration 025) | Read in `ai-context-read.ts:172-192`; default OFF; Phase 36 owns the type default. |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| AI Enabled master state | DB (`app_settings`) + Zustand store | UI | Durable, portable; gates all AI UI. |
| Multi-connection config + active pointer | DB (SQLite) + DAO | Zustand | Definitions durable; one active pointer; per-connection remembered model. |
| Provider credentials | Device SecureStore (`ai-key-store`) | — | ADR-049: never SQLite/backup. |
| OpenRouter browser-auth | Client (`expo-web-browser` + PKCE) → OpenRouter host | SecureStore (resulting key) | Egress is the sole outbound AI path; key at rest in SecureStore. |
| Model catalog + pricing | Client fetch (LiteLLM for direct; OpenRouter `/models` for OpenRouter) + cache table | UI | Cache-friendly, offline-safe read path (local-first). |
| Prompt assembly | Node-pure logic (`prompt-template.ts`) | DB (egress projection) | Byte-identity contract; DATA-delimited; immutable system prompt. |
| Permission model (what leaves device) | DB (`share_with_ai` defs, memories `allow_ai`, interactions `allow_ai`) + type-default columns | UI manager | Closed allowlist enforced in SQL projection. |
| Sanitized diagnostics | Node-pure helper/schema | (future Sentry — deferred) | Safe metadata only; no private content. |
| Backup serialize/restore | Node-pure schema + DAO snapshot | File I/O | Forward-only wire format; no credentials. |

---

## Standard Stack

### Core (already installed — reuse)
| Library | Version (on disk) | Purpose | Why Standard |
|---------|-------------------|---------|--------------|
| `expo` | ~57.0.13 | Runtime/SDK | Project baseline `[VERIFIED: package.json]`. |
| `react-native` | 0.86.2 | UI runtime | `[VERIFIED: package.json]`. |
| `expo-secure-store` | ~57.0.1 | Credential storage (ADR-049) | Already the sole key boundary. |
| `expo-document-picker` | ~57.0.1 | `.txt`/`.md` personalization import | Already installed; use for AICFG-06 import. |
| `expo-file-system` | ~57.0.4 | Read imported file contents | Already installed. |

### Supporting (NEW — must install; SDK-57-aligned)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `expo-web-browser` | 57.0.3 | `openAuthSessionAsync(authUrl, redirectUri)` for the OpenRouter browser-auth session | OpenRouter connect lane only. |
| `expo-auth-session` | 57.0.12 | `makeRedirectUri`, PKCE helpers (code_verifier/challenge), redirect handling | OpenRouter PKCE. |
| `expo-crypto` | 57.0.3 | SHA-256 for the S256 `code_challenge` (Hermes `crypto.subtle` is undefined — see Pitfalls) | PKCE challenge generation. |

**Installation:**
```bash
npx expo install expo-web-browser expo-auth-session expo-crypto
```
(Use `npx expo install`, not bare `npm install`, so versions resolve against SDK 57.)

**Version verification (this session):** `[VERIFIED: npm view]` `expo-web-browser@57.0.3`, `expo-auth-session@57.0.12`, `expo-crypto@57.0.3` are the current SDK-57 line. `[CITED: docs.expo.dev]` all three are first-party Expo packages.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `expo-auth-session` full `useAuthRequest` OAuth2 machinery | `expo-web-browser` `openAuthSessionAsync` + manual PKCE via `expo-crypto` | OpenRouter's flow is **non-standard** (returns a `code` exchanged at `/api/v1/auth/keys` for an API *key*, no `client_id`, no token endpoint). The full OAuth2 request object doesn't map cleanly; the manual open-session + hand-rolled PKCE (verifier + S256) is the more predictable fit. Use `expo-auth-session` only for `makeRedirectUri` + its PKCE utility if convenient. `[ASSUMED]` — validate against a spike. |
| A dev-client custom scheme redirect (`orbit://`) | `callback_url` is optional (headless mode shows code on-screen) | Orbit already has scheme `orbit` `[VERIFIED: app.config.ts]`, and runs a custom dev client (not Expo Go) per CLAUDE.md widget note, so the redirect-URI path is viable and better UX than headless. |

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| expo-web-browser | npm | mature (Expo core) | very high | github.com/expo/expo | OK | Approved (official Expo) |
| expo-auth-session | npm | mature (Expo core) | very high | github.com/expo/expo | OK | Approved (official Expo) |
| expo-crypto | npm | mature (Expo core) | very high | github.com/expo/expo | OK | Approved (official Expo) |

**Packages removed due to [SLOP]:** none.
**Packages flagged [SUS]:** none. All three are first-party `@expo`-published core modules, version-locked to the installed SDK, and were confirmed present on the registry this session `[VERIFIED: npm view]`. No new third-party runtime dependency is introduced. OpenRouter integration uses plain `fetch` against `https://openrouter.ai` (no SDK dependency).

---

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────── AI Settings UI (6 sections) ───────────────────┐
                         │ Connection · Model · Writing Style · Personalization · Permissions │
                         │                  · Preview What Orbit Sends                        │
                         └───────────────┬───────────────────────────────┬───────────────────┘
                                         │ reads/writes                   │ reads
                                         ▼                                ▼
   ┌──────────────┐   ai_enabled +   ┌──────────────────┐        ┌──────────────────────┐
   │ Zustand AI   │◀── active conn ──│  app_settings +  │        │  Personalization +   │
   │ store        │                  │  ai_connections  │        │  WritingStyle tables │
   └──────┬───────┘                  │  (defs+pointer)  │        └──────────┬───────────┘
          │ availability             └────────┬─────────┘                   │
          ▼                                   │ per-conn remembered model   │
   ┌──────────────┐                           ▼                            │
   │ Compose:     │        ┌────────── SecureStore (ai-key-store) ─────────┐│
   │ Ready /      │        │  orbit.ai.key.<provider>  +  openrouter key   ││
   │ NeedsAttn /  │        └───────────────────────────────────────────────┘│
   │ Off          │                                                          │
   └──────┬───────┘                                                          │
          │ begin()                                                          │
          ▼                                                                  ▼
   ┌───────────────────┐  readPromptContext   ┌──────────────────┐   resolvePrompt (SOLE builder,
   │ ai-suggestion-    │─────(closed egress)──▶│ PromptContext    │──▶ byte-identical, deeply frozen)
   │ logic (1 request) │  allowlist projection │ (no off-limits)  │        │
   └─────────┬─────────┘                       └──────────────────┘        │  ResolvedPrompt
             │ generate(prompt, signal)                                     │  (prompt==inspector==payload)
             ▼                                                              ▼
   ┌─────────────────────── AiService adapter (connection-agnostic) ───────────────────────┐
   │  OpenAI · Anthropic · Gemini · Custom (OpenAI-compat HTTPS) · OpenRouter (OpenAI-compat)│
   └──────────────┬─────────────────────────────────────────────────────────┬─────────────┘
                  │ secure-fetch (validateCustomEndpoint + SSRF guard)        │ egress = ONLY outbound path
                  ▼                                                           ▼
         Custom endpoint host                                     api provider / openrouter.ai
                                                                        ▲
   OpenRouter connect lane:  openAuthSessionAsync ─▶ openrouter.ai/auth (PKCE S256) ─▶ code
                             ─▶ POST /api/v1/auth/keys {code,code_verifier} ─▶ {key} ─▶ SecureStore
   OpenRouter catalog:       GET /api/v1/models (public) ─▶ {data:[{id,name,context_length,pricing}]}
                             ─▶ cache table (offline-safe read) ─▶ curated-first picker + input-cost calc

   FINAL plan: backup export ─▶ manifest (format v5) serializes ALL milestone entities + portable prefs
               (NEVER credentials; SECRET_SHAPED_KEY screen); restore validates + orphan-repairs (Phase 33 rules)
```

### Pattern 1: OpenRouter OAuth PKCE (browser-authorized, returns a user API key)
**What:** A custom (non-standard) OAuth-PKCE flow. `[CITED: openrouter.ai/docs/use-cases/oauth-pkce]`
**When to use:** The OpenRouter connect lane (AICFG-04), no manual key paste.
**Flow (verbatim field names from OpenRouter docs):**
1. Generate `code_verifier` (random), derive `code_challenge` = base64(SHA-256(verifier)), method `S256`.
2. Open `https://openrouter.ai/auth?callback_url=<redirect>&code_challenge=<challenge>&code_challenge_method=S256` in a browser auth session.
3. On redirect back to `<redirect>`, read `?code=<CODE>`.
4. `POST https://openrouter.ai/api/v1/auth/keys` with body `{ "code": <CODE>, "code_verifier": <VERIFIER>, "code_challenge_method": "S256" }`.
5. Response `{ "key": "<API_KEY>" }` → store in SecureStore (new `orbit.ai.key.openrouter` slot), never in `app_settings`/backup.
**Example (skeleton — verify against a spike):**
```ts
// Source: openrouter.ai/docs/use-cases/oauth-pkce  [CITED]
import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";
const verifier = /* base64url random */;
const challenge = base64url(await Crypto.digestStringAsync(
  Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 }));
const redirect = "orbit://openrouter-auth"; // app scheme is "orbit" [VERIFIED: app.config.ts]
const authUrl = `https://openrouter.ai/auth?callback_url=${encodeURIComponent(redirect)}`
  + `&code_challenge=${challenge}&code_challenge_method=S256`;
const res = await WebBrowser.openAuthSessionAsync(authUrl, redirect);
// res.type === "success" → parse code from res.url, then POST /api/v1/auth/keys
```
> `[ASSUMED]` exact `expo-web-browser`/`expo-crypto` base64url handling and the `orbit://openrouter-auth` redirect path — confirm in a spike on the physical Pixel (browser-auth cannot be validated on the desktop emulator; and Hermes crypto quirks apply — see Pitfalls).

### Pattern 2: OpenRouter model catalog + pricing (separate from LiteLLM)
**What:** `GET https://openrouter.ai/api/v1/models` (public, no auth to list). `[CITED: openrouter.ai/docs]`
**Model object fields used:** `id`, `name`, `context_length`, `pricing.{ prompt, completion, image, request }`. **Pricing values are decimal STRINGS in USD per token** (multiply by 1e6 for per-million). `[VERIFIED: web + openrouter.ai/openrouter/free]`
**When to use:** OpenRouter model picker (AICFG-04) + input-cost estimate (AICFG-07).
**Pattern:** Fetch → cache into a catalog table (offline-safe render) → refresh on first AI/model-settings open of a new local day (`formatLocalDate()`, never `toISOString().split`) + explicit Refresh Models → keep cache on failure. Input-cost estimate = `estimatedInputTokens * Number(pricing.prompt)` for the selected model. Do NOT hardcode model ids or prices (dossier §L). Direct/Custom lanes have no trustworthy price → show "Cost estimate unavailable for this connection."

### Pattern 3: Multi-connection storage (connection identity ≠ model identity)
**What:** Replace the single `ai_provider`/`ai_model` with a connection-set + active pointer + per-connection remembered model (dossier §D/§J).
**Pattern (options — Claude's discretion within the dossier):** a small `ai_connections` table (one row per lane: `openrouter`|`openai`|`anthropic`|`google`|`custom`, with `remembered_model`, `custom_endpoint`, `custom_model`, `configured_at`) + an active-connection pointer in `app_settings` + `ai_enabled` flag. Credentials stay in SecureStore keyed by lane. Keep it minimal and forward-only.

### Pattern 4: Render carry-only egress fields (AICFG-15)
**What:** `PromptContext.gatedRecentInteractionNotes?` and `sharedMemories?` are populated by `ai-context-read.ts` but **not rendered** by `prompt-template.ts`. `[VERIFIED: src/ai/prompt-types.ts:133-155]` "CARRY-ONLY UNTIL PHASE 36 (D-13): adding this field does NOT transmit it. Phase 36 owns the prompt-template rendering/transmission."
**Pattern:** Add DATA-delimited, `sanitizeValue`-fenced, `PER_VALUE_LIMIT`-bounded blocks for shared memories and gated recent-interaction notes inside `resolvePrompt`, measured into the `TOTAL_LIMIT` budget (same discipline as the existing rewrite block). Preserve byte-identity (prompt==inspector==payload). Off Limits gets **no** block (ADR-107).

### Anti-Patterns to Avoid
- **A second prompt builder.** `resolvePrompt` is the sole construction path; the inspector, preview, and adapter must receive the SAME frozen object. `[VERIFIED: prompt-template.ts:6-13]`
- **Forcing OpenRouter into the LiteLLM `CatalogProvider` union.** OpenRouter has its own catalog+pricing API; model it separately.
- **Widening `PromptContext` casually.** It is a closed compile-time allowlist; any new field is an owner-reviewed change (and off-limits is now excluded entirely).
- **Hardcoding model ids/prices** in product logic or UI (dossier §K/§L).
- **A background timer for catalog/pricing refresh.** SQLite has no scheduler; refresh on settings-open + explicit action, like the launch-sweep pattern.
- **Removing any egress/secret guard** to "simplify" (D-04/D-05 trip-wire).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Browser auth session | A raw `Linking` + WebView + redirect listener | `expo-web-browser` `openAuthSessionAsync` | Handles the browser tab lifecycle + redirect capture + cancellation. |
| PKCE SHA-256 challenge | A JS SHA-256 impl or `crypto.subtle` | `expo-crypto` `digestStringAsync(SHA256)` | Hermes has no `crypto.subtle`/`randomUUID` (see Pitfalls); expo-crypto is the native primitive. |
| Model catalog for direct providers | A hand-typed model list | Existing LiteLLM `filterLiteLLMCatalog` | Already built, deprecation-aware, node-tested `[VERIFIED: model-catalog-filter.ts]`. |
| Custom endpoint URL safety | Ad-hoc URL parsing | Existing `validateCustomEndpoint` + `secure-fetch` | SSRF/private-address/`.local`/credential guards already proven. |
| Credential storage | Any SQLite/AsyncStorage path | Existing `ai-key-store` (SecureStore) | ADR-049; no bulk accessor by design. |
| Prompt byte-identity | Re-serializing for the inspector | Existing `resolvePrompt` frozen object | Prevents inspector/payload drift (worse than no inspector). |
| `.md`/`.txt` import | A file watcher / live link | `expo-document-picker` + copy into a local record | Dossier §R: no live link; imported copy is editable/backupable. |

**Key insight:** Almost every "hard" primitive already exists in-repo (egress projection, byte-identity resolver, SecureStore boundary, LiteLLM catalog, SSRF guard). The net-new engineering is OpenRouter's custom OAuth+catalog and the UI/schema for multi-connection + personalization + permission management.

---

## Runtime State Inventory

> This is a schema/feature phase (not a rename), but it retires runtime state and mutates durable stores — inventory required.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `app_settings` single-provider AI columns (migration 004); `interactions.allow_ai` (migration 025, default OFF); `memories.allow_ai` (migration 017); `custom_field_defs.share_with_ai`. Vestigial `ai_ack_*` columns (no caller). | Migration 029 adds `ai_enabled`, multi-connection storage, permission type-defaults; extend `getPortableSettingsSnapshot` emission. Do NOT rewrite existing `allow_ai`/`share_with_ai` semantics. |
| Live service config | None external (local-first). OpenRouter/OpenAI/etc. are user-configured egress hosts, not Orbit-owned services. | None. |
| OS-registered state | App deep-link scheme `orbit` `[VERIFIED: app.config.ts]` — reused for the OAuth redirect URI. Android may need an intent-filter/`singleTask` for the redirect (`[CITED: docs.expo.dev]`). | Verify AndroidManifest/app.config redirect handling in the OpenRouter plan; validate on the Pixel. |
| Secrets/env vars | SecureStore items `orbit.ai.key.<provider>` `[VERIFIED: ai-key-store.ts:27]`. New: `orbit.ai.key.openrouter`. | Add OpenRouter key slot; never portable, never `app_settings`, never backup. |
| Build artifacts / installed packages | New Expo native modules (`expo-web-browser`/`expo-auth-session`/`expo-crypto`) require a **new dev-client build** (native modules don't hot-reload). | Rebuild the debug dev client on the desktop (ssh droid pipeline) after install; validate OAuth on the physical Pixel (not emulator). |
| Dead code retired | Inert AI-fuel confirm/dismiss UI (`FuelEditor.tsx` :249-317, `confirmFuel`/`confirmFuelCore` in `fuel-dao.ts` :214/:297, wiring in Create/EditContactScreen) — no producer since migration 017. | Delete confirm/dismiss path (dossier §AK). Grep all consumers first (orphaned-test-consumer hazard — see MEMORY). |

---

## Common Pitfalls

### Pitfall 1: Assuming the backup bump target is v4
**What goes wrong:** CONTEXT D-03/D-12 say "v4 bump"; a plan that sets `BACKUP_FORMAT_VERSION = 4` is a no-op and ships an incomplete format.
**Why:** v4 already landed early (Phase 24.1). `[VERIFIED: types.ts:14]`
**Avoid:** Target **5**; add a `4:` FORWARD_MIGRATIONS upgrader; emit all declare-only keys + new entities. This is the FINAL plan, after all other schema (planning-notes R-09).
**Warning sign:** `git diff` on `types.ts` shows `4` unchanged.

### Pitfall 2: Sending Off Limits to AI (reversed by ADR-107)
**What goes wrong:** Building D-06's negative-avoidance-constraint egress ships a decision the owner reversed.
**Why:** ADR-107 (newer, Accepted) excludes off-limits from all AI egress; no `fuel.allow_ai` substrate exists.
**Avoid:** No off-limits shape in `PromptContext`, no off-limits prompt block, no off-limits permission toggle. Enforce, don't re-open. `[VERIFIED: ADR-107; prompt-types.ts:148-150]`

### Pitfall 3: Hermes `crypto` is undefined (PKCE)
**What goes wrong:** `crypto.subtle.digest`/`crypto.randomUUID` throw on-device; vitest (Node WebCrypto) never catches it.
**Why:** `globalThis.crypto` absent in Hermes (MEMORY: hermes-crypto-guard). 
**Avoid:** Use `expo-crypto` for the SHA-256 challenge and a guarded random for the verifier. Validate on the Pixel, not just tests.
**Warning sign:** PKCE works in vitest, crashes on device.

### Pitfall 4: Validating browser-auth on the emulator
**What goes wrong:** OAuth redirect + Skia/render claims can't be assessed on the desktop emulator (MEMORY: verify-ui-on-pixel-yourself).
**Avoid:** Build a debug dev client and drive the OpenRouter flow on the physical Pixel. Never trigger a real AI generation API call during UAT without owner clearing (MEMORY: no-ai-api-calls-without-clearing) — the OAuth connect + `/models` catalog fetch are safe (no generation), but a Draft/Rewrite is not.

### Pitfall 5: `formatLocalDate()` for the daily catalog-refresh boundary
**What goes wrong:** `toISOString().split('T')[0]` gives a UTC off-by-one in evening hours → wrong "new local day."
**Avoid:** Use `formatLocalDate()` (CLAUDE.md; already used in `ai-context-read.ts:47`).

### Pitfall 6: Orphaned-test / consumer build-breakers when reshaping AiProviderId
**What goes wrong:** Widening `AiProviderId`/`AiSettings`/multi-connection shape breaks `Record<AiProviderId,…>` maps, the `never` switch, and `*.test.ts` asserting the old shape → project-wide tsc failure.
**Why:** MEMORY: orphaned-test-consumer-build-breaker; tsc-in-post-merge-gate (vitest green ≠ tsc clean).
**Avoid:** Grep ALL consumers (incl. tests) of `AiProviderId`/`PROVIDER_NAMES`/`acknowledgeProvider`/`CatalogProvider` up front; put each in the wave that changes the symbol. Run `npx tsc --noEmit` in the post-merge gate.

### Pitfall 7: Secret-shaped portable key names
**What goes wrong:** A new portable key named like `*Token`/`*Key`/`*Credential` is rejected by `SECRET_SHAPED_KEY` at restore → silent drop / fail.
**Avoid:** Name new portable keys plainly (e.g. `aiEnabled`, `openrouterModel`), never with secret-shaped substrings. `[VERIFIED: backup-schema.ts:217-243]`

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `provider='none'` as only AI disable | Real `ai_enabled` master toggle | Phase 36 | New column; off ≠ Needs Attention. |
| Single active provider | Multi-connection, one active, per-connection remembered model | Phase 36 | Schema reshape. |
| Exact-prompt first-send ack (`ai_ack_*`, ADR-052) | Lightweight first-use disclosure, review on demand (ADR-079) | Phase 35 | Ack gate already removed from `ai-suggestion-logic`; `ai_ack_*` vestigial. |
| Off Limits sent as avoidance constraints (ADR-078) | Off Limits never transmitted (ADR-107) | 2026-09-13 (Phase 35) | No off-limits egress shape. |
| Raw prompt-template-as-personalization | Structured Writing Style + ordered Personalization Context sections | Phase 36 | New UX; system prompt stays immutable. |
| Backup format 3 | Format 4 shipped (24.1); **format 5** this phase | 24.1 → Phase 36 | Target v5, not v4. |

**Deprecated/outdated on disk:** inert AI-fuel confirm/dismiss UI; `ai_ack_*` columns (retained forward-only, no caller); `ai_prompt_template` as the primary personalization mechanism (reconcile to Writing Style + sections per dossier §AK).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Preferred resolution for `ai_ack_openrouter`: add the column for exhaustiveness | On-Disk #3 caveat | Low — either choice compiles; a wrong guess is a cheap edit. |
| A2 | `expo-web-browser openAuthSessionAsync` + manual PKCE (vs full `useAuthRequest`) best fits OpenRouter's non-standard flow | Standard Stack / Pattern 1 | Medium — a spike may show `expo-auth-session` helpers suffice; affects the OpenRouter plan's shape. |
| A3 | `orbit://openrouter-auth` redirect path + Android intent-filter config works in the dev/release client | Pattern 1 / Runtime State | Medium — redirect capture is the highest-risk unknown; must spike on Pixel. |
| A4 | OpenRouter `/api/v1/models` needs no auth to list, and pricing is USD-per-token decimal strings | Pattern 2 | Medium — if auth-gated or unit differs, cost estimate math changes. |
| A5 | Multi-connection modeled as an `ai_connections` table + active pointer | Pattern 3 | Low — dossier leaves shape to discretion; any forward-only model that separates connection/model identity is acceptable. |
| A6 | `events`/interaction `duration`/group-event coverage in export-manifest is complete except Systems + template + AI/personalization entities | On-Disk #5 | Medium — verify against migrations 025/026 at plan time; a missed entity ships an incomplete v5. |

---

## Open Questions (RESOLVED)

1. **OpenRouter redirect capture on Android dev/release client.**
   - Known: app scheme is `orbit`; `openAuthSessionAsync` returns the redirect URL.
   - Unclear: exact intent-filter/`singleTask` config and whether `callback_url` (deep-link) vs headless (on-screen code) is more robust in the custom dev client.
   - Recommendation: spike on the Pixel before committing the OpenRouter plan's approach.
   - RESOLVED: deferred to a Pixel device-UAT spike (cannot be validated off-device); 36-02 carries the OAuth approach + anti-CSRF `state`/strict-callback controls, and the device spike validates the redirect capture.

2. **`ai_ack_openrouter` — add or narrow?** (See On-Disk #3 caveat.) Recommendation: add the column to keep the `never` switch honest; it's cheap and forward-only.
   - RESOLVED: surfaced as an explicit add-column-vs-narrow sub-decision at the 36-01 migration checkpoint (ADR-079 not reversed either way).

3. **Exact multi-connection schema shape.** Recommendation: minimal `ai_connections` table + active pointer; settle in plan (Claude's discretion within dossier §D/§J).
   - RESOLVED: 36-01 defines the `ai_connections` table + `ai_active_connection` pointer (with a zero/one active-pointer invariant test).

4. **Full v5 entity inventory completeness.** Recommendation: at plan time, diff every "Backup/Restore preserves X" dossier claim (planning-notes lists 8) against `export-manifest.ts` reads; enumerate Systems + template + AI/personalization entities explicitly in the FINAL plan.
   - RESOLVED: 36-08 enumerates the v5 entity inventory (all 9 newly-serialized entity tables + interaction gap columns) with a real export→restore roundtrip.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Expo SDK | whole phase | ✓ | ~57.0.13 | — |
| expo-secure-store | credentials | ✓ | ~57.0.1 | — |
| expo-document-picker / expo-file-system | personalization import | ✓ | ~57.0.1 / ~57.0.4 | paste-only (import is additive) |
| expo-web-browser | OpenRouter auth | ✗ (install) | 57.0.3 | none — required for browser-auth |
| expo-auth-session | OpenRouter PKCE | ✗ (install) | 57.0.12 | manual redirect handling |
| expo-crypto | PKCE S256 | ✗ (install) | 57.0.3 | none (Hermes has no crypto.subtle) |
| Physical Pixel (custom dev client) | OAuth + UI UAT | ✓ (per CLAUDE.md pipeline) | — | emulator cannot validate OAuth/Skia |
| OpenRouter (openrouter.ai) | OpenRouter lane egress | user-configured | — | direct BYOK / custom lanes |

**Missing with no fallback:** `expo-web-browser`, `expo-crypto` (install via `npx expo install`; requires a new dev-client build).

---

## Validation Architecture

> Nyquist validation enabled. Test framework in-repo is **Vitest** (node-pure `*-logic.ts` + migration `*.test.ts`), plus TypeScript gate + on-device UAT (release/debug run-as). MEMORY: tsc-in-post-merge-gate, device-uat-runas-pattern.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (node-pure; every side effect injected) |
| Config | repo Vitest config (co-located `*.test.ts`) |
| Quick run | `npx vitest run <path/to/file.test.ts>` |
| Full suite | `npm test` (+ `npx tsc --noEmit` + `npm run check:colors` in the post-merge/phase gate) |

### Phase Requirements → Test Map (representative)
| Req | Behavior | Test Type | Automated command | File exists? |
|-----|----------|-----------|-------------------|-------------|
| AICFG-01 | `ai_enabled` off preserves config; off ≠ Needs Attention | migration + logic unit | `npx vitest run src/db/migrations/029-*.test.ts` | ❌ Wave 0 |
| AICFG-02/03 | multi-connection: switch never deletes; one active | dao/logic unit | `npx vitest run src/db/ai-connections-dao.test.ts` | ❌ Wave 0 |
| AICFG-04 | OpenRouter catalog filter + pricing parse; daily-refresh boundary via formatLocalDate | node-pure unit | `npx vitest run src/ai/openrouter-catalog.test.ts` | ❌ Wave 0 |
| AICFG-04 | OAuth PKCE challenge derivation | node-pure unit (+ Pixel spike for the flow) | `npx vitest run src/ai/openrouter-oauth.test.ts` | ❌ Wave 0; **device UAT for redirect** |
| AICFG-05 | model-unavailable → Needs Attention, no silent substitution | logic unit | `npx vitest run src/logic/ai-availability.test.ts` | ✅ extend |
| AICFG-07 | context/token estimate; overflow explicit, no truncation | logic unit | `npx vitest run src/ai/context-estimate.test.ts` | ❌ Wave 0 |
| AICFG-08/15 | prompt renders shared memories + gated notes; byte-identity; off-limits absent | resolver unit | `npx vitest run src/ai/prompt-template.test.ts` | ✅ extend |
| AICFG-10 | permission defaults new-items-only; review/bulk; off-limits & Group Notes excluded | dao/logic unit | `npx vitest run src/db/ai-permissions-*.test.ts` | ❌ Wave 0 |
| AICFG-12 | Settings preview == Compose review == payload (same resolvePrompt) | logic unit | `npx vitest run src/screens/settings-ai-logic.test.ts` | ✅ extend |
| AICFG-13/14 | 8 failure categories; sanitized diagnostic carries no private content | logic unit | `npx vitest run src/logic/ai-diagnostics.test.ts` | ❌ Wave 0 |
| AICFG-16 | backup format v5: emits all portable keys + new entities; SECRET_SHAPED_KEY rejects secrets; FORWARD_MIGRATIONS 4→5; restore never falsely Ready | schema + roundtrip unit | `npx vitest run src/backup/*.test.ts` | ✅ extend (assert `BACKUP_FORMAT_VERSION === 5`) |
| AICFG-17 | inert AI-fuel confirm path removed; no orphaned consumers/tests | tsc + grep | `npx tsc --noEmit` | gate |

### Sampling Rate
- **Per task commit:** `npx vitest run` on touched files + `npx tsc --noEmit` on reshaped contracts.
- **Per wave merge:** `npm test` + `npx tsc --noEmit` + `npm run check:colors`.
- **Phase gate:** full suite green + tsc clean; then on-device UAT (Pixel): OpenRouter connect (OAuth, no generation), catalog render offline, permission manager, backup export/import roundtrip, restore-never-falsely-Ready. Draft/Rewrite generation UAT only with owner clearing (MEMORY).

### Wave 0 Gaps
- [ ] `src/db/migrations/029-*.test.ts` — AI config + `ai_enabled` + permission defaults migration
- [ ] `src/db/ai-connections-dao.test.ts` — multi-connection + active pointer + per-connection model
- [ ] `src/ai/openrouter-catalog.test.ts` + `openrouter-oauth.test.ts` (PKCE)
- [ ] `src/ai/context-estimate.test.ts` — token/cost estimate + overflow
- [ ] `src/db/ai-permissions-*.test.ts` — type defaults + review + bulk
- [ ] `src/logic/ai-diagnostics.test.ts` — sanitized-only assertion (no private content)
- [ ] Backup roundtrip test asserting `BACKUP_FORMAT_VERSION === 5` and full portable-key/entity emission
- [ ] Device UAT script for OAuth redirect (Pixel; cannot be validated in vitest or on emulator)

---

## Security Domain

`security_enforcement` treated as enabled (not `false` in config). This phase is squarely security-relevant (egress, credentials, PII in prompts/telemetry).

### Applicable ASVS Categories
| ASVS | Applies | Standard control (in-repo) |
|------|---------|----------------------------|
| V2 Authentication (3rd-party OAuth) | yes | OpenRouter OAuth **PKCE S256** (`code_challenge_method=S256`); never store the intermediate `code`; key → SecureStore. |
| V3 Session Mgmt | partial | The OAuth key is a long-lived credential in SecureStore; reconnect refreshes it (dossier §G). |
| V5 Input Validation | yes | `validateCustomEndpoint` (HTTPS-only, no creds, no `.local`, no IP literals); `sanitizeValue` DATA-fence neutralization in `resolvePrompt`; contact data is DATA never instructions. |
| V6 Cryptography | yes | `expo-crypto` SHA-256 for PKCE (never hand-rolled; Hermes has no `crypto.subtle`). |
| V7 Error/Logging | yes | Sanitized diagnostic seam: safe metadata only; **never** contact names/notes/memories/Group Notes/off-limits/personalization/Writing Style/Message Focus/prompt bodies/credentials/raw request/response/output (dossier §AI). |
| V8/V9 Data Protection & egress | yes | Closed `PromptContext` allowlist; SecureStore-only credentials (ADR-049); no credentials in backup (`SECRET_SHAPED_KEY`); SSRF/private-address guards (ADR-051); no host allowlist removed. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard mitigation |
|---------|--------|---------------------|
| Prompt injection via contact/field text | Tampering | DATA delimiters + `sanitizeValue` fence-collapse + "treat as data" static instruction `[VERIFIED: prompt-template.ts:98-104]`. |
| SSRF / DNS-rebind via custom endpoint | Info disclosure / SSRF | `validateCustomEndpoint` + `secure-fetch` connection-time guard (ADR-051). |
| Credential leak into backup/settings | Info disclosure | `SECRET_SHAPED_KEY` screen + `buildAiSettingsPatch` has no key path + SecureStore-only. |
| Over-sharing via prompt context | Info disclosure | Closed allowlist; off-limits excluded (ADR-107); Group Notes never read; interaction notes gated on `allow_ai`. |
| PII in telemetry | Info disclosure | Sanitized diagnostic schema (metadata only); no full Sentry (deferred). |
| OAuth code interception | Spoofing | PKCE S256 binds the code to the verifier. |
| Restored install falsely "Ready" | Elevation/misconfig | Never mark Ready without valid local credential (ADR-049 / dossier §AJ; must have a test). |

---

## Sources

### Primary (HIGH confidence — read on disk this session)
- `src/services/ai-types.ts`, `ai-key-store.ts`, `AiService.ts` — provider model, credentials, adapters
- `src/db/migrations/004-ai-settings.ts`, `017-knowledge-egress-datamove.ts`, `database.ts` (TARGET_VERSION=28)
- `src/db/app-settings-dao.ts` (acknowledgeProvider `never` switch, snapshot omissions), `ai-context-read.ts`, `fuel-dao.ts`
- `src/ai/prompt-types.ts`, `prompt-template.ts`, `token-budget.ts`, `model-catalog-filter.ts`, `custom-endpoint.ts`, `secure-fetch.ts`
- `src/logic/ai-suggestion-logic.ts`, `src/screens/settings-ai-logic.ts`, `src/components/FuelEditor.tsx`
- `src/backup/types.ts` (BACKUP_FORMAT_VERSION=4), `backup-schema.ts` (PORTABLE_SETTINGS_KEYS, SECRET_SHAPED_KEY, FORWARD_MIGRATIONS), `export-manifest.ts`
- `docs/decisions/ADR-107-…md` (Accepted; supersedes ADR-078 off-limits egress), ADR-049/051/078/079 (referenced)
- `.planning/phases/36-ai-configuration-prompting/36-CONTEXT.md`, `36-UI-SPEC.md`; dossier + planning-notes
- `package.json`, `app.config.ts` (Expo 57, RN 0.86.2, scheme `orbit`); `npm view` for new package versions

### Secondary (MEDIUM confidence — official docs, web-verified)
- openrouter.ai/docs/use-cases/oauth-pkce (auth URL, `/api/v1/auth/keys`, S256)
- openrouter.ai model catalog + pricing shape (GET `/api/v1/models`; `pricing.{prompt,completion}` USD-per-token strings) — openrouter.ai/openrouter + web results
- docs.expo.dev — `expo-web-browser` `openAuthSessionAsync`, `expo-auth-session` `makeRedirectUri`/PKCE, Android intent-filter/singleTask

### Tertiary (LOW / ASSUMED — validate via spike)
- Exact expo-crypto base64url handling + `orbit://openrouter-auth` redirect capture on the Pixel dev client
- Whether `expo-auth-session` helpers or manual `openAuthSessionAsync`+PKCE is the cleaner OpenRouter fit

## Metadata

**Confidence breakdown:**
- In-repo state (schema, versions, egress, backup): HIGH — every claim read on disk this session with file:line.
- OpenRouter API shapes: MEDIUM — official docs + web; the OAuth redirect capture on-device is the main unknown (spike).
- Expo auth packages: MEDIUM — official, versions verified on npm; on-device behavior needs a Pixel spike.

**Research date:** 2026-09-13
**Valid until:** ~2026-10-13 for in-repo (stable until next schema phase); ~7 days for OpenRouter/Expo external API details (fast-moving) — re-verify model/pricing shape and Expo SDK 57 API at plan time.

Sources:
- [OpenRouter OAuth PKCE](https://openrouter.ai/docs/use-cases/oauth-pkce)
- [OpenRouter models/pricing](https://openrouter.ai/openrouter)
- [Expo authentication guide](https://docs.expo.dev/guides/authentication/)
- [Expo WebBrowser](https://docs.expo.dev/versions/latest/sdk/webbrowser/)
