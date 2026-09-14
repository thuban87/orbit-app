---
phase: 36-ai-configuration-prompting
reviewed: 2026-09-14T09:55:55Z
depth: deep
files_reviewed: 107
files_reviewed_list:
  - app.config.ts
  - docs/systems/backup-restore.md
  - docs/systems/profile.md
  - package.json
  - src/ai/context-estimate.test.ts
  - src/ai/context-estimate.ts
  - src/ai/model-catalog-filter.test.ts
  - src/ai/model-catalog-filter.ts
  - src/ai/model-registry.ts
  - src/ai/openrouter-catalog.test.ts
  - src/ai/openrouter-catalog.ts
  - src/ai/openrouter-oauth.test.ts
  - src/ai/openrouter-oauth.ts
  - src/ai/prompt-template.test.ts
  - src/ai/prompt-template.ts
  - src/ai/prompt-types.ts
  - src/ai/token-budget.ts
  - src/backup/backup-schema.test.ts
  - src/backup/backup-schema.ts
  - src/backup/export-manifest.test.ts
  - src/backup/export-manifest.ts
  - src/backup/orrery-preferences-portability.test.ts
  - src/backup/phase-17-integration.test.ts
  - src/backup/reconciliation.test.ts
  - src/backup/reconciliation.ts
  - src/backup/restore-apply.test.ts
  - src/backup/restore-apply.ts
  - src/backup/types.ts
  - src/components/AIComposeContextReview.tsx
  - src/components/AIFirstUseDisclosure.tsx
  - src/components/AINeedsAttention.tsx
  - src/components/FieldDefForm.tsx
  - src/components/FilterChipRow.tsx
  - src/components/FuelEditor.tsx
  - src/db/ai-connections-dao.test.ts
  - src/db/ai-connections-dao.ts
  - src/db/ai-context-read.test.ts
  - src/db/ai-context-read.ts
  - src/db/ai-permissions-dao.test.ts
  - src/db/ai-permissions-dao.ts
  - src/db/app-settings-dao.test.ts
  - src/db/app-settings-dao.ts
  - src/db/database.ts
  - src/db/field-ddl.test.ts
  - src/db/fuel-dao.test.ts
  - src/db/fuel-dao.ts
  - src/db/group-events-dao.ts
  - src/db/interaction-assist-dao.ts
  - src/db/memories-dao.test.ts
  - src/db/memories-dao.ts
  - src/db/migrations/028-compose-message-mode.test.ts
  - src/db/migrations/029-ai-configuration.test.ts
  - src/db/migrations/029-ai-configuration.ts
  - src/db/migrations/full-chain.test.ts
  - src/db/personalization-dao.test.ts
  - src/db/personalization-dao.ts
  - src/db/recency-dao.test.ts
  - src/logic/ai-availability.test.ts
  - src/logic/ai-availability.ts
  - src/logic/ai-diagnostics.test.ts
  - src/logic/ai-diagnostics.ts
  - src/logic/ai-suggestion-compose-integration.test.ts
  - src/logic/ai-suggestion-logic.test.ts
  - src/logic/ai-suggestion-logic.ts
  - src/navigation/tabs/SettingsStack.tsx
  - src/navigation/types.ts
  - src/screens/AIConnectionScreen.tsx
  - src/screens/AIModelPickerScreen.tsx
  - src/screens/AIPermissionsScreen.tsx
  - src/screens/AIPersonalizationScreen.tsx
  - src/screens/AIPreviewScreen.tsx
  - src/screens/ComposeScreen.tsx
  - src/screens/CreateContactScreen.tsx
  - src/screens/CustomFieldsScreen.tsx
  - src/screens/EditContactScreen.tsx
  - src/screens/LogInteractionScreen.tsx
  - src/screens/SettingsScreen.tsx
  - src/screens/ai-connection-logic.test.ts
  - src/screens/ai-connection-logic.ts
  - src/screens/ai-model-picker-logic.test.ts
  - src/screens/ai-model-picker-logic.ts
  - src/screens/ai-permissions-logic.test.ts
  - src/screens/ai-permissions-logic.ts
  - src/screens/ai-personalization-logic.test.ts
  - src/screens/ai-personalization-logic.ts
  - src/screens/log-interaction-logic.test.ts
  - src/screens/log-interaction-logic.ts
  - src/screens/settings-ai-hub-logic.test.ts
  - src/screens/settings-ai-hub-logic.ts
  - src/screens/settings-ai-logic.test.ts
  - src/screens/settings-ai-logic.ts
  - src/services/AiService.test.ts
  - src/services/AiService.ts
  - src/services/ai-key-store.ts
  - src/services/ai-types.ts
  - src/services/backup/backup-service.test.ts
  - src/services/backup/backup-service.ts
  - src/services/backup/share-export.ts
  - src/services/notifications/digest-schedule.test.ts
  - src/services/notifications/notification-schedule.test.ts
  - src/services/orrery-exploration.integration.test.ts
  - src/services/photos/background-reconcile-sweep.test.ts
  - src/services/photos/background-reconcile-sweep.ts
  - src/services/photos/background-storage.test.ts
  - src/services/photos/background-storage.ts
  - src/services/secure-custom-fetch.ts
  - src/stores/ai-config-store.ts
findings:
  critical: 7
  warning: 0
  info: 0
  total: 7
status: issues_found
---

# Phase 36: Code Review Report

**Reviewed:** 2026-09-14T09:55:55Z  
**Depth:** deep  
**Files Reviewed:** 107  
**Status:** issues_found

## Summary

The Phase 36 implementation has seven ship-blocking correctness or security defects. The most serious paths can disclose a newly entered custom-provider credential to the previously configured endpoint, corrupt a profile background after a failed restore transaction, and make a valid OpenRouter configuration unusable. The prompt path also omits the required structured recent-interaction projection and sends requests that the app already knows exceed the selected model's context capacity. Backup merge does not reconcile the schema's lane-level identity constraint, and Settings can falsely report an unusable connection as ready.

The deep review traced provider setup through SecureStore and generation, prompt inputs through their SQLite readers and serializers, and v5 export/reconciliation/restore through the owning schema and filesystem finalization. OAuth callback destination/state validation, the native custom-endpoint egress guard, exclusion of credentials from backup, Android backup disablement, exclusion of Group Notes and Off Limits from prompt reads, screen-route registration, and theme-token color checks were also examined; no defect was established in those controls. TypeScript checking and 15 focused test suites (191 tests) passed, but those tests do not exercise the failures below.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: OpenRouter is hard-coded as unavailable in Compose

**Classification:** BLOCKER  
**File:** `/home/bwales/projects/orbit-app/src/screens/ComposeScreen.tsx:218-225`  
**Issue:** `isConnectionModelAvailable` returns `false` for every OpenRouter connection. Focus loading writes that value into state at lines 598 and 607, and `computeAiAvailability` requires it at lines 1085-1094. Consequently, a fully authorized OpenRouter connection with an explicitly selected model is always rendered as `needs-attention`; Draft and Rewrite cannot be used. The stale comment says the adapter is deferred even though the provider adapter is now implemented.

**Fix:** Resolve the exact selected OpenRouter model against the cache-overrides-seed catalog already loaded by this screen, and pass that result to `computeAiAvailability`. Keep the current exact-model rule: if the selected ID is absent, show needs-attention and require an explicit model choice; do not substitute another model silently.

### CR-02: Settings reports “Ready” without checking the connection, credential, or model

**Classification:** BLOCKER  
**File:** `/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:296-311`  
**Issue:** The Settings hub maps every enabled, non-null active-lane pointer directly to `ready`. It does not resolve the referenced `ai_connections` row, check SecureStore credential presence, or validate the exact selected model. A dangling/restored pointer, removed key, or unavailable model therefore produces a false green Ready state while Compose correctly requires all four conditions in `computeAiAvailability` (`src/logic/ai-availability.ts:50-62`). This breaks the shared off/ready/needs-attention contract and conceals recovery actions from the user.

**Fix:** Hydrate a full availability snapshot on focus: resolve the active row, read only credential presence for that lane, validate its exact selected model against the applicable catalog/manual rule, and call the shared `computeAiAvailability`. Preserve failures as `needs-attention`; never choose a provider or model as a fallback.

### CR-03: The required three-interaction structured projection is never transmitted

**Classification:** BLOCKER  
**File:** `/home/bwales/projects/orbit-app/src/db/ai-context-read.ts:154-194`  
**Issue:** The recent-interaction reader selects only `note` and `allow_ai`, then drops every row whose note is not opted in. The prompt type carries only `gatedRecentInteractionNotes` (`src/ai/prompt-types.ts:155-166`), and the serializer renders only those strings (`src/ai/prompt-template.ts:427-450`). The required projection is the three most recent interactions with compact date/time, channel, and Tone always present, while only each note is permission-gated. The separate all-history aggregate/newest-channel query at lines 108-151 is not an equivalent row-level projection. With notes disabled—the default—the model receives no recent interaction rows at all.

**Fix:** Replace the string-only field with a closed recent-interaction value type such as `{ occurredAt, channel, tone, note? }`. Select exactly those static columns for the newest three rows; include `note` only when that row has `allow_ai = 1`; serialize each row in its own bounded DATA block. Continue to exclude `group_events.group_note` and Off Limits entirely.

### CR-04: Generation skips the known context-window overflow check

**Classification:** BLOCKER  
**File:** `/home/bwales/projects/orbit-app/src/screens/ComposeScreen.tsx:455-496`  
**Issue:** The generation callback resolves a provider and immediately sends all variants. It never invokes `estimatePromptContext`, even though that helper computes a deterministic overflow result and recovery message (`src/ai/context-estimate.ts:45-97`). The only runtime consumers of the estimator are personalization preview screens. A prompt known to exceed the selected model's context window is therefore sent anyway, leaving failure to the remote provider and bypassing the required deliberate “reduce context or choose a larger model” resolution. No explicit truncation decision is made at this boundary.

**Fix:** Immediately before any provider egress, estimate the exact resolved payload against the exact selected catalog model. If capacity is known and `overflow` is true, block generation and present the estimator's recovery choices. Unknown capacity may remain non-blocking, but must not be represented as fitting.

### CR-05: A failed custom-connection save can send the new credential to the old endpoint

**Classification:** BLOCKER  
**File:** `/home/bwales/projects/orbit-app/src/screens/ai-connection-logic.ts:97-112`  
**Issue:** `saveCustomConnection` writes the lane-wide SecureStore key first, then persists endpoint/model metadata. If SecureStore succeeds and SQLite fails, the old custom endpoint remains active but now resolves the newly entered credential. `CustomProvider` combines its persisted endpoint with the current lane key and sends it as `Authorization: Bearer ...` (`src/services/AiService.ts:533-580`). The catch path then misleadingly says the previous connection is still active (`src/screens/AIConnectionScreen.tsx:196-200`), despite having mutated its credential. This can disclose a secret intended for a new endpoint to the old network origin.

**Fix:** Make activation atomic across the two storage domains. One safe design is a staged/versioned credential slot tied to a connection attempt, followed by durable metadata update and then an atomic active-slot switch. At minimum, snapshot the old key, write the new key, and compensatingly restore/delete it if metadata persistence fails, with an explicit hard-error state if compensation itself fails. Never log either credential. This preserves ADR-049/ADR-051 credential isolation; it does not weaken an existing control.

### CR-06: Failed restore transactions can later overwrite a valid background with uncommitted bytes

**Classification:** BLOCKER  
**File:** `/home/bwales/projects/orbit-app/src/backup/restore-apply.ts:369-374`  
**Issue:** Background bytes are staged before the SQLite transaction, and the pending filename is keyed only by template UID (`src/services/photos/background-storage.ts:79-105`). If a merge/replace updates an existing template UID and the transaction throws or rolls back, its old row remains while the incoming pending bytes remain on disk. At next launch, the reconciliation sweep treats mere row existence as proof those bytes committed and persists them over the canonical image (`src/services/photos/background-reconcile-sweep.ts:39-52`). Thus a failed restore can mutate durable user-visible data after rollback.

**Fix:** Couple background finalization to durable commit evidence, as the photo pipeline does. Record a transaction-owned journal entry containing a unique restore/session token and target UID/version; only re-drive pending bytes whose journal entry committed. Delete orphan staging entries that have no committed evidence. Row existence alone is insufficient because updates reuse UIDs.

### CR-07: Backup merge cannot reconcile two UIDs for the same AI connection lane

**Classification:** BLOCKER  
**File:** `/home/bwales/projects/orbit-app/src/backup/restore-apply.ts:203-212`  
**Issue:** `ai_connections` has both `uid UNIQUE` and `UNIQUE(lane)` (`src/db/migrations/029-ai-configuration.ts:52-64`), while normal first-time configuration generates a new UID (`src/db/ai-connections-dao.ts:91-103`). Reconciliation treats this entity as generic UID-keyed LWW (`src/backup/reconciliation.ts:127-130`) and detects semantic collisions only for custom-field pairs/column names (`src/backup/reconciliation.ts:299-342`). Merging a backup whose `openai` (or other lane) row has a different UID from the local `openai` row plans an insert; the restore upsert conflicts only on UID, so SQLite raises `UNIQUE constraint failed: ai_connections.lane` and aborts the entire restore.

**Fix:** Reconcile `ai_connections` on its schema identity, `lane`, before producing write actions. Define a deterministic lane-level LWW policy that updates the surviving local row/UID (credentials still remain device-local and must not be inferred or restored), and add merge tests with distinct UIDs for the same lane in both timestamp directions.

---

_Reviewed: 2026-09-14T09:55:55Z_  
_Reviewer: the agent (gsd-code-reviewer)_  
_Depth: deep_
