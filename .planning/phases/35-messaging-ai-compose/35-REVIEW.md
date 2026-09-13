---
phase: 35-messaging-ai-compose
reviewed: 2026-09-13T18:04:42Z
depth: deep
files_reviewed: 46
files_reviewed_list:
  - src/ai/prompt-template.test.ts
  - src/ai/prompt-template.ts
  - src/ai/prompt-types.ts
  - src/backup/backup-schema.ts
  - src/backup/restore-apply.test.ts
  - src/db/ai-context-read.test.ts
  - src/db/ai-context-read.ts
  - src/db/app-settings-dao.test.ts
  - src/db/app-settings-dao.ts
  - src/db/compose-research-read.test.ts
  - src/db/compose-research-read.ts
  - src/db/contact-methods-dao.test.ts
  - src/db/contact-methods-dao.ts
  - src/db/database.ts
  - src/db/fuel-read.test.ts
  - src/db/interaction-assist-dao.test.ts
  - src/db/lifecycle-consumer-ledger.test.ts
  - src/db/migrations/006-normalize-custom-field-values.test.ts
  - src/db/migrations/027-default-interaction-channel.test.ts
  - src/db/migrations/028-compose-message-mode.test.ts
  - src/db/migrations/028-compose-message-mode.ts
  - src/db/migrations/full-chain.test.ts
  - src/db/profile-knowledge-read.test.ts
  - src/db/profile-knowledge-read.ts
  - src/logic/ai-availability.test.ts
  - src/logic/ai-availability.ts
  - src/logic/ai-generate-variants.test.ts
  - src/logic/ai-generate-variants.ts
  - src/logic/ai-suggestion-compose-integration.test.ts
  - src/logic/ai-suggestion-logic.test.ts
  - src/logic/ai-suggestion-logic.ts
  - src/logic/compose-logic.test.ts
  - src/logic/compose-logic.ts
  - src/navigation/tabs/DashboardStack.tsx
  - src/navigation/tabs/OrreryStack.tsx
  - src/navigation/types.ts
  - src/screens/ComposeResearchScreen.tsx
  - src/screens/ComposeScreen.tsx
  - src/screens/ContactProfileScreen.tsx
  - src/services/notifications/digest-schedule.test.ts
  - src/services/notifications/notification-schedule.test.ts
  - src/services/reach-out/handoff.test.ts
  - src/services/reach-out/handoff.ts
  - src/stores/compose-session-store.test.ts
  - src/stores/compose-session-store.ts
findings:
  critical: 1
  warning: 3
  info: 0
  total: 4
status: issues_found
---

# Phase 35: Code Review Report

**Reviewed:** 2026-09-13T18:04:42Z
**Depth:** deep
**Files Reviewed:** 46
**Status:** issues_found

## Summary

Phase 35 adds the Compose/Rewrite AI slice, the session-only draft + Message-Focus stores, the normalized Compose Research read boundary, migration 028 (Compose default message mode), the email `mailto` handoff arm, and origin-aware Compose navigation.

The privacy-critical surfaces are sound. The closed `PromptContext` egress allowlist (`prompt-types.ts` / `ai-context-read.ts`) is **not** widened this phase — Message Focus is session-only in-memory state and never enters `PromptContext`, `readPromptContext`, or `resolvePrompt`. Off Limits is excluded structurally at the read boundary (`compose-research-read.ts`: `aiEligible=false`/`isOffLimits=true`) AND re-guarded in the store's `addToFocus`, never as a UI-side filter. `resolvePrompt` keeps contact data delimited-as-data with fence neutralization. Migration 028 is forward-only, `app_settings`-only, correctly head+1 (TARGET_VERSION=28), and never touches `interactions`. The one-request AI lifecycle's stale-token / single-controller / fan-out-abort discipline holds up under trace.

The material problem is a **data-integrity validation gap on the restore path**: the migration-028 `remembered_message_mode` column is intentionally CHECK-free and relies on `assertMessageMode` as its sole write-time guard, but `assertMessageMode` accepts the `'remember'` sentinel — and the backup boundary (`backup-schema.ts`) does not validate the message-mode keys at all. That lets an invalid sentinel reach a no-CHECK column and corrupt the Compose mode state machine. Three lower-severity issues follow.

## Critical Issues

### CR-01: `'remember'` sentinel can be persisted into the CHECK-free `remembered_message_mode` column via restore, corrupting the Compose mode

**File:** `src/db/app-settings-dao.ts:204-213`, `src/db/migrations/028-compose-message-mode.ts:37-38`, `src/backup/backup-schema.ts:204-213,234-301`

**Issue:** Migration 028 deliberately gives `remembered_message_mode` **no CHECK constraint**, delegating enforcement to the DAO (see the code comment at `028-compose-message-mode.ts:22` and `app-settings-dao.ts:199-203`: "assertMessageMode is its only guard"). But `assertMessageMode` (`app-settings-dao.ts:204`) accepts the whole `MESSAGE_MODES` tuple — `'remember' | 'text' | 'email'` — so it does **not** enforce the documented non-negotiable invariant that the remembered value is "always a concrete mode ('text' | 'email'), never the 'remember' sentinel."

This is only caught at compile time by the `RememberedMessageMode` type, which the restore path bypasses. `restore-apply.ts:327` casts `manifest.appSettings` to `AppSettingsPatch` and calls `updateAppSettingsCore` → `validateAppSettingsPatch` → `assertMessageMode`. `assertPortableSettings` in `backup-schema.ts` allowlists `defaultMessageMode`/`rememberedMessageMode` (lines 211-212) but — unlike the parallel interaction-channel keys, which get explicit `assertDefaultInteractionChannel`/`assertRememberedInteractionChannel` boundary checks at lines 260-273 (the T-34-03 mitigation) — performs **no** value validation on the message-mode keys.

Net effect: a hand-edited/adversarial backup carrying `rememberedMessageMode: "remember"` passes the backup boundary (no check), passes the DAO (`assertMessageMode` allows `'remember'`), and lands in the no-CHECK column. With `default_message_mode` at its factory default `'remember'`, `effectiveMode('remember','remember')` (`compose-logic.ts:193-198`) returns `'remember'`, which `ComposeScreen` then passes to `setMode(...)` (`ComposeScreen.tsx:512-519`) — a value outside the `ComposeMode = 'text' | 'email'` union. Downstream `resolveUsableMode`/`resolveComposeControls` silently fall the sentinel into the `email` branch, mis-resolving the transmit channel. This is a data-integrity break of a documented invariant reached with untrusted local input; the codebase's own posture (T-34-03) treats the identical interaction-channel case as a security mitigation.

**Fix:** Add a concrete-only validator mirroring `assertRememberedInteractionChannel`, and apply it at BOTH boundaries.

```ts
// app-settings-dao.ts
export function assertRememberedMessageMode(field: string, v: unknown): void {
  if (v !== "text" && v !== "email") {
    throw new Error(
      `updateAppSettings: ${field} must be 'text' or 'email', got ${String(v)}`,
    );
  }
}
// validateAppSettingsPatch: swap the remembered check
if (patch.rememberedMessageMode !== undefined)
  assertRememberedMessageMode("rememberedMessageMode", patch.rememberedMessageMode);
```

```ts
// backup-schema.ts assertPortableSettings — mirror the interaction-channel block
try {
  if (settings.defaultMessageMode !== undefined)
    assertMessageMode("defaultMessageMode", settings.defaultMessageMode);
  if (settings.rememberedMessageMode !== undefined)
    assertRememberedMessageMode("rememberedMessageMode", settings.rememberedMessageMode);
} catch {
  fail("appSettings has an invalid message mode");
}
```

## Warnings

### WR-01: `mailto:` recipient is not URL-encoded — new injection surface contradicting the code's own safety claim

**File:** `src/services/reach-out/handoff.ts:34-40`

**Issue:** `buildMailtoUrl` encodes `subject` and `body` with `encodeURIComponent` and its comment asserts reserved characters "can never break out of the query string or inject extra params," but it interpolates `endpoint` **raw** into `mailto:${endpoint}${query}`. `EMAIL_RE` (`contact-method-normalization.ts:24`) is `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, whose `[^\s@]+` local part permits `?`, `&`, and `#`. A stored/imported address like `bob?subject=x@example.com` produces `mailto:bob?subject=x@example.com?subject=<real>&body=<real>` — the mail client parses `bob` as the recipient and `subject=x@example.com` as a query param, overriding the composed Subject (first-`subject`-wins in most parsers) and mangling the recipient. Exploitability is low on local-first, self-owned contact data, but this is a newly introduced arm that fails the safety guarantee its own comment states, and contact rows can arrive via VCF/CardDAV import.

**Fix:** Encode the address's local/domain parts (preserving the single `@`) before interpolation, or reject addresses containing `mailto:` query metacharacters before building the URL. e.g. split on the last `@` and `encodeURIComponent` each side.

### WR-02: `onTransmit` has no `catch` — a `createPendingAssist` failure is an unhandled rejection with no user feedback

**File:** `src/screens/ComposeScreen.tsx:744-801`, `src/services/reach-out/handoff.ts:92-99`

**Issue:** `performReachOut` runs `createPendingAssist` **outside** its own try/catch (`handoff.ts:92-99`), so a DB failure there throws out of `performReachOut`. `onTransmit` wraps the call only in `try { … } finally { setSending(false) }` with no `catch`, so a create-assist failure rejects the `void onTransmit()` promise unhandled and shows the user nothing (no `Alert`, no error state) — unlike the sibling `ContactProfileScreen.launchMethod`, which wraps `performReachOut` in try/catch. The `sending` latch is released by `finally`, so the screen isn't stuck, but the transmit silently no-ops.

**Fix:** Add a `catch` around the transmit body that logs via `Logger.error` and surfaces an `Alert` (mirroring `onCopy`/`onChoosePrimary`), so a failed handoff is visible rather than a swallowed rejection.

### WR-03: Migration 028's `remembered_message_mode` has no DB CHECK while its DAO "guard" doesn't enforce the concrete-only invariant

**File:** `src/db/migrations/028-compose-message-mode.ts:37-38`; `src/db/migrations/028-compose-message-mode.test.ts:98-102`

**Issue:** This is the schema-side facet of CR-01, called out separately because the migration and its test both encode the false assumption. The migration ships `remembered_message_mode` CHECK-free "because the DAO's assertMessageMode guards writes," and the test at line 98 asserts exactly that ("DAO assertMessageMode guards writes") — but as shown in CR-01, `assertMessageMode` admits `'remember'`, so nothing (neither CHECK nor DAO) actually prevents the sentinel from being stored. The interaction-channel precedent (migration 027) pairs its CHECK-free remembered column with a concrete-only `assertRememberedInteractionChannel`; migration 028 omitted the equivalent. Migrations are irreversible in production, so the missing constraint cannot be retrofitted onto already-migrated devices — the concrete-only DAO/backup validators from CR-01 are the only available remedy and should ship together.

**Fix:** Adopt CR-01's `assertRememberedMessageMode` and add a migration-028 test asserting a `'remember'` write to `remembered_message_mode` is rejected by the DAO validator (not merely that the column accepts any TEXT).

---

## Narrative Findings (AI reviewer)

No `<structural_findings>` substrate was supplied for this phase; all findings above are from direct subsystem-level reading of the source on disk (not the diff), including the non-diff writers of `app_settings` (`updateAppSettingsCore`, `acknowledgeProvider`, `setInteractionAssistEnabled`, `recordAutomaticBackupHealthCore`) and `contact_methods` (`applyContactMethodDiffCore`, `setContactMethodPrimary`) to confirm the migration-028 and mode invariants.

Verified clean (no finding warranted):
- **Egress allowlist not widened.** `readPromptContext` selects only the allowlisted columns; Message Focus never reaches `PromptContext`/`resolvePrompt`. `sourceDraft` (Rewrite) is a `resolvePrompt` param, not a context field.
- **Off Limits structurally excluded.** `compose-research-read.ts` marks Off Limits `aiEligible:false`/`isOffLimits:true`; `compose-session-store.addToFocus` re-rejects non-eligible/off-limits items; the Research screen only reads the normalized flags.
- **Migration 028 ordering/scope.** Registered after 027 with `TARGET_VERSION = 28`; `app_settings`-only; no `interactions` write; no shipped migration edited; no `BACKUP_FORMAT_VERSION` bump.
- **Custom-field invariants intact.** `readPopulatedCustomFields` reads normalized `custom_field_values` (`v.value`), preserves raw TEXT, no dynamic-column DDL, `share_with_ai` drives eligibility.
- **AI lifecycle.** Stale-generation token, single AbortController+timeout, fan-out abort-on-non-stale-failure, and non-destructive review surface all trace correctly.
- **Theme/token discipline.** `ComposeScreen`/`ComposeResearchScreen` resolve every colour via `useTheme().colors.*` and token modules; copy feedback uses a single `setState`+`setTimeout`, not per-frame animation; birthday rendered as raw stored text (no `toISOString` off-by-one).

---

_Reviewed: 2026-09-13T18:04:42Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
