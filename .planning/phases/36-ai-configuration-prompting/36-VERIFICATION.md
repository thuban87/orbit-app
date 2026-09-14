---
phase: 36-ai-configuration-prompting
verified: 2026-09-14T15:17:00Z
status: human_needed
score: 101/108 must-haves verified
behavior_unverified: 7
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 100/108
  gaps_closed:
    - "Message Focus now adds permission-preserving emphasis to the exact immutable provider payload (AICFG-08 / Roadmap SC4)."
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "OpenRouter redirect capture succeeds in the custom dev/release client on a physical Pixel."
    test: "Complete browser authorization and return through orbit://openrouter-auth on the physical device."
    expected: "The callback is accepted once and produces a usable connection without exposing the code or state."
    why_human: "Android intent/deep-link delivery is native runtime behavior."
  - truth: "Long endpoint/model/provider text does not break AI connection and hub layouts."
    test: "Exercise AI Connection, model picker, and Settings AI hub with unusually long values."
    expected: "Cards and rows wrap or truncate without overlap or lost actions."
    why_human: "Layout quality is visual and device-font dependent."
  - truth: "Connect/auth presents an in-progress affordance and activates only after successful authorization on device."
    test: "Start and cancel/fail, then successfully complete, an OpenRouter connection."
    expected: "A loading state is visible; failure keeps the prior lane active; success activates OpenRouter."
    why_human: "Activation ordering is tested, but the browser/UI transition itself requires the device."
  - truth: "Long personalization section bodies and custom guidance remain usable."
    test: "Open Personalization with long titles, bodies, and custom guidance."
    expected: "Text remains readable/editable and controls do not overlap."
    why_human: "This is a visual layout backstop."
  - truth: "A .txt/.md import is copied into an editable local section and survives source deletion."
    test: "Import a document, edit the created section, then move/delete the source and relaunch Orbit."
    expected: "The copied section remains intact and editable."
    why_human: "The Android document picker and external-file lifecycle are device integrations."
  - truth: "Compose's Needs Attention repair action lands on the valid AI connection area."
    test: "Open Compose with AI enabled but misconfigured and follow the repair action."
    expected: "Settings opens at the reachable AI connection-management surface."
    why_human: "Cross-stack navigation behavior is most directly observable on the running app."
  - truth: "Long AI-area entry-row values remain visually sound."
    test: "View Settings AI entries using long provider, endpoint, and model names."
    expected: "Rows wrap or truncate without clipping, overlap, or inaccessible navigation."
    why_human: "This is the separate Plan 36-09 visual backstop."
unverified_prohibitions:
  - "36-01 judgment: AI is opt-in and permission defaults ship off — code audit supports it; human review recommended."
  - "36-02 judgment: OpenRouter models/pricing/recommendations are runtime data — code audit supports it; human review recommended."
  - "36-02 judgment: catalog refresh is not on a general read/app-launch path — code audit supports it; human review recommended."
  - "36-03 judgment: personalization cannot replace the immutable system contract — code audit supports it; human review recommended."
  - "36-04 judgment: permission UI exposes semantic labels, not raw storage ids — code audit supports it; human review recommended."
  - "36-05 judgment: Custom is described as advanced OpenAI-compatible HTTPS, not arbitrary HTTP — code audit supports it; human review recommended."
  - "36-06 judgment: personalization is subordinate to Orbit's system/privacy/output contract — code audit supports it; human review recommended."
  - "36-06 judgment: pricing is not fetched per keystroke — code audit supports local debounce/cache reuse; human review recommended."
  - "36-07 judgment: no app-wide Sentry/observability pipeline was introduced — code audit supports it; human review recommended."
  - "36-09 judgment: AI-off UI is collapsed to toggle, preservation note, and management escape hatch — code audit supports it; human review recommended."
  - "36-09 judgment: no second live legacy provider configuration surface remains — code audit supports it; human review recommended."
human_verification:
  - test: "Complete browser authorization and return through orbit://openrouter-auth on a physical Pixel."
    expected: "The callback is accepted once and produces a usable connection without exposing the code or state."
    why_human: "Android intent/deep-link delivery is native runtime behavior."
  - test: "Exercise AI Connection, model picker, and Settings AI hub with unusually long values."
    expected: "Cards and rows wrap or truncate without overlap or lost actions."
    why_human: "Layout quality is visual and device-font dependent."
  - test: "Start and cancel/fail, then successfully complete, an OpenRouter connection."
    expected: "A loading state is visible; failure keeps the prior lane active; success activates OpenRouter."
    why_human: "Activation ordering is tested, but the browser/UI transition itself requires the device."
  - test: "Open Personalization with long titles, bodies, and custom guidance."
    expected: "Text remains readable/editable and controls do not overlap."
    why_human: "This is a visual layout backstop."
  - test: "Import a .txt/.md document, edit the created section, then move/delete the source and relaunch Orbit."
    expected: "The copied section remains intact and editable."
    why_human: "The Android document picker and external-file lifecycle are device integrations."
  - test: "Open Compose with AI enabled but misconfigured and follow the repair action."
    expected: "Settings opens at the reachable AI connection-management surface."
    why_human: "Cross-stack navigation behavior is most directly observable on the running app."
  - test: "View Settings AI entries using long provider, endpoint, and model names."
    expected: "Rows wrap or truncate without clipping, overlap, or inaccessible navigation."
    why_human: "This is the separate Plan 36-09 visual backstop."
---

# Phase 36: AI Configuration & Prompting Verification Report

**Phase Goal:** AI becomes an explicit, user-owned capability — three connection lanes, a real global switch, user-controlled personalization, exact egress permissions, and backup format v5.
**Verified:** 2026-09-14T15:17:00Z
**Status:** human_needed
**Re-verification:** Yes — after Plan 36-10 gap closure

## Goal Achievement

The prior automated gap is closed. All five roadmap criteria and all 17 AICFG requirements are implemented. Seven previously identified device/visual backstops remain, so the canonical status is `human_needed`, not `passed`.

### Roadmap Success Criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Global master switch preserves all AI configuration and leaves credential management reachable | ✓ VERIFIED | `ai-config-store` writes only `ai_enabled`; `SettingsScreen` renders the off-state escape hatch; availability distinguishes `off`. |
| 2 | Three lanes, one active, activate-on-success, exact model/no substitution | ✓ VERIFIED | `ai_connections` has a unique lane, the active pointer stores a lane, setup activates only after persistence, exact OpenRouter model lookup is required, and Custom credentials are endpoint-bound and optional. |
| 3 | Immutable prompt, personalization, estimates/overflow, ephemeral Adjust | ✓ VERIFIED | `resolvePrompt` is the frozen sole builder; Writing Style/sections are subordinate; full-payload overflow is checked locally before egress; Adjust is an ephemeral lifecycle argument. |
| 4 | Exact permission egress, including Message Focus emphasis | ✓ VERIFIED | Generation re-reads current Research eligibility, projects only fresh permitted selections, emits a bounded focus-emphasis DATA block in the exact immutable payload, retains ordinary context, and exposes that exact block in Compose disclosure. |
| 5 | Failures/diagnostics, secure credentials, complete v5 roundtrip and repair | ✓ VERIFIED | Categorized failures preserve session state; diagnostic fields are allowlisted; secrets stay in SecureStore/out of backup; v5 entity/preference/background roundtrip and repair are implemented. |

### Consolidated Must-Haves

The original PLAN frontmatter contributes 107 detailed truths. Roadmap criteria add the non-duplicate Message Focus emphasis contract, and closure Plan 36-10 supplies its implementation detail without increasing the deduplicated total. Of 108 total, 101 are now verified and seven device/visual backstops remain behavior-unverified. No truth is failed and no accepted override exists.

| Plan | Truths | Result | Notes |
|---|---:|---|---|
| 36-01 | 13 | ✓ | Migration 029, master switch, lane pointer, readiness, and active generation wiring verified. |
| 36-02 | 10 | ✓ / 1 human backstop | OAuth/state/catalog/pricing logic verified, including catalog deduplication and missing-metadata behavior; only the physical redirect remains device-observable. |
| 36-03 | 13 | ✓ | Permitted memories and structured recent interactions flow through the sole prompt builder; Off Limits and Group Notes cannot enter; Adjust is ephemeral. |
| 36-04 | 8 | ✓ | Defaults, search/drill-in, bulk rules, and creation-writer wiring verified; dedup behavior is tested. |
| 36-05 | 12 | ✓ / 2 human backstops | Three setup lanes, secure key handling, Custom guards, model binding, and activation ordering verified; device auth/loading and long-text layout remain. |
| 36-06 | 11 | ✓ / 2 human backstops | Writing Style, sections/import-copy design, local estimates, cost policy, and pre-egress overflow verified; document picker and long layout remain. |
| 36-07 | 9 | ✓ | Exact-byte inspectors, first-use disclosure, failure taxonomy, state preservation, and sanitized diagnostics verified; zero/one grammar has a passing test. |
| 36-08 | 22 | ✓ | Full v5 portable inventory, lane reconciliation, Group Event orphan repair, presentation UID remap, and serialized background finalization verified. |
| 36-09 | 9 | ✓ / 2 human backstops | Five routes and six entries are wired; AI-off state and first-use disclosure are mounted; device navigation and long-row layout remain. |
| 36-10 / Roadmap AICFG-08 addition | 1 | ✓ | Fresh permission-preserving focus projection, payload emphasis, and exact Compose disclosure verified. |

**Score:** 101/108 truths verified (7 present/backstop behavior-unverified)

## Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/db/migrations/029-ai-configuration.ts` + `src/db/database.ts` | Complete Phase-36 schema at version 29 | ✓ VERIFIED | Registered last; `TARGET_VERSION` resolves to 29. No migration 030 exists. |
| `src/db/ai-connections-dao.ts` + `src/stores/ai-config-store.ts` | Durable lane configurations and one active lane | ✓ VERIFIED | Unique lane, lane-valued active pointer, transaction-guarded mutations. |
| `src/logic/ai-availability.ts` | Off/Ready/Needs Attention without substitution | ✓ VERIFIED | Custom credential is optional; hosted lanes require it; exact model availability gates Ready. |
| `src/services/ai-key-store.ts` | Secure, endpoint-bound credentials | ✓ VERIFIED | Provider namespace only; Custom value stores `{version, endpoint, credential}` and rejects a different endpoint. |
| `src/ai/openrouter-oauth.ts` + `src/ai/openrouter-catalog.ts` | PKCE/state OAuth and live cached catalog | ✓ VERIFIED | Strict callback parsing/state; public keyless catalog; daily/manual refresh and dynamic recommendation inputs. |
| `src/db/ai-context-read.ts` | Closed permission projection | ✓ VERIFIED | Latest three interactions; notes only for `allow_ai=1`; no Group Event query; permissioned memories/fields only. |
| `src/ai/message-focus.ts` | Permission-preserving focus projection | ✓ VERIFIED | Uses current rows by stable identity, fresh label/value, deduplication and cap; rejects missing, revoked, ineligible and Off Limits selections. |
| `src/ai/prompt-template.ts` | Immutable sole prompt builder | ✓ VERIFIED | Renders bounded/fence-neutralized Message Focus under Orbit-owned emphasis instructions without removing ordinary permitted context. |
| `src/screens/ComposeScreen.tsx` | Exact request assembly and pre-egress check | ✓ VERIFIED | Re-reads Research at request resolution, projects session focus, attaches it to PromptContext, then sends the same capacity-checked resolved payload. |
| `src/db/ai-permissions-dao.ts` + `src/screens/AIPermissionsScreen.tsx` | Central permission manager | ✓ VERIFIED | Type defaults, search/drill-in, explicit bulk actions, confirmation UI; no Off Limits/Group Notes category. |
| `src/db/personalization-dao.ts` + `src/screens/AIPersonalizationScreen.tsx` | Structured style/sections and copied imports | ✓ VERIFIED | Ordered enableable local records; `.txt/.md` picker copies content and stores no source URI. |
| `src/screens/AIPreviewScreen.tsx` + `src/components/AIComposeContextReview.tsx` | Exact-byte Settings and contact-specific transparency | ✓ VERIFIED | Both derive from the same `ResolvedPrompt`; credentials are absent. |
| `src/backup/types.ts`, `backup-schema.ts`, `export-manifest.ts`, `restore-apply.ts` | Closing v5 wire format | ✓ VERIFIED | All new arrays/preferences, UID remaps, interaction gaps, Group Events, presentation and background bytes flow export-to-restore. |
| `src/services/photos/background-finalization.ts` + reconciliation sweep | Crash-consistent background restore | ✓ VERIFIED | Per-UID serialization owns check/copy/CAS/cleanup; pending marker is transaction-owned and sweep-redriven. |
| Settings routes/hub | Reachable AI management | ✓ VERIFIED | Five screens registered; six ordered entries; legacy inline provider editor removed. |

## Key Link and Data-Flow Verification

| From | To | Status | Evidence |
|---|---|---|---|
| Migration 029 | database registry | ✓ WIRED | `migration029` is final registry entry; `TARGET_VERSION` remains 29. |
| Settings switch | SQLite app settings | ✓ FLOWING | Store hydrates/writes the durable singleton; toggle patch contains only `aiEnabled`. |
| Active connection | Compose provider/model | ✓ FLOWING | Compose resolves the active lane, refreshes `AiService`, and passes its exact model/endpoint. |
| Custom endpoint | SecureStore credential | ✓ FLOWING | Read/write normalize and bind the credential to the persisted endpoint; empty credential is valid. |
| SQLite contact data | resolved prompt | ✓ FLOWING | Permissioned fields/memories and latest-three interactions reach deterministic DATA blocks. |
| Message Focus store | fresh Research eligibility | ✓ FLOWING | `projectMessageFocus` intersects selected identities with a new `readComposeResearch` result and uses only current row content. |
| Fresh focused projection | resolved prompt/provider/disclosure | ✓ FLOWING | `PromptContext.messageFocus` becomes a dedicated DATA block in `ResolvedPrompt.payload`; provider uses that object and contact review extracts the exact block. |
| Resolved prompt | provider adapter | ✓ FLOWING | The exact frozen payload is capacity-checked at the final local boundary and transmitted unchanged. |
| Backup exporter | schema/reconciliation/restore | ✓ FLOWING | v5 arrays and portable prefs are emitted, validated, reconciled, and written using portable UIDs. |
| Restored background bytes | pending marker/canonical file | ✓ FLOWING | Stage-before-transaction, row marker in transaction, serialized post-commit finalizer, launch re-drive to `profile-backgrounds/<uid>.jpg`. |

## Non-Negotiable Decision Checks

- `TARGET_VERSION` is 29 and migration 029 is last; no migration 030 exists.
- `BACKUP_FORMAT_VERSION` is 5 with a `4 -> 5` upgrader.
- No background kind was added to `restore_photo_journal`.
- Canonical background paths remain `profile-backgrounds/<uid>.jpg`.
- Off Limits never enters the prompt context, permission surface, or egress; ADR-107 remains enforced.
- No network dependency was introduced into the local read/dashboard path.
- Decision-coverage verifier reported 15/15 trackable CONTEXT decisions honored. Graph-first queries found the pre-existing governing edges but no nodes for most new Phase-36 files (stale graph); those decisions were therefore checked directly against ADR-049, ADR-051, ADR-078/ADR-107, ADR-079, code, migrations, and every writer of shared tables.

## Post-Review Fix Verification

| Fix | Status | Semantic evidence |
|---|---|---|
| Exact OpenRouter model | ✓ | Readiness requires exact cached model id, not merely a nonempty selection. |
| Complete Settings availability | ✓ | Settings derives lane/model/credential/catalog state using the same availability contract. |
| Structured recent interactions | ✓ | Date/channel/tone always project for the latest three; note appears only for `allow_ai=1`. |
| Pre-egress overflow | ✓ | `assertPromptFitsContext` checks the exact resolved payload and selected model immediately before provider fan-out. |
| Custom optional credential + compensation | ✓ | Empty key is accepted; failed configuration deletes a newly stored credential before leaving the prior lane active. |
| Custom endpoint binding | ✓ | Stored credential is bound to the normalized endpoint and fails closed on endpoint mismatch. |
| Lane reconciliation | ✓ | Backup reconciliation normalizes `ai_connections` by lane rather than treating distinct UIDs as distinct lanes. |
| Background transaction ownership/finalization | ✓ | Restore commits the exact pending marker; per-UID lock serializes ownership read, canonical swap, row CAS, and pending cleanup. |
| Message Focus gap closure | ✓ | Fresh current eligibility replaces stale session values; revoked/missing/Off Limits entries are excluded; the bounded focus block changes the exact payload while ordinary permitted context remains. |

## Behavioral Spot-Checks

| Check | Result | Status |
|---|---|---|
| `npx tsc --noEmit --pretty false` | exit 0 | ✓ PASS |
| Migration/connections/availability/key/OAuth/catalog (6 files) | 62 tests | ✓ PASS |
| Prompt/context/permissions/personalization/estimate/lifecycle integration (6 files) | 65 tests | ✓ PASS |
| Hub/background/schema/restore group (5 discovered files) | 96 tests | ✓ PASS |
| Export/reconciliation/portable preferences (3 files) | 45 tests | ✓ PASS |
| Connection/permission/settings/lifecycle logic (4 files) | 57 tests | ✓ PASS |
| AiService/model/personalization/diagnostics/background/key-backup group (6 files) | 75 tests | ✓ PASS |
| Message Focus re-verification (6 files) | 73 tests | ✓ PASS |
| Repository regression supplied for this re-verification | 369 files / 3,534 tests passed, excluding only `src/components/orrery/orrery-controls-render.test.tsx` | ✓ PASS; excluded Phase-30 collection failure is pre-existing and not attributed to Phase 36 |

Initial focused verifier execution totaled **30 test files / 400 tests passed**. Re-verification independently ran the six Message Focus-linked files (**73 tests passed**) plus a clean TypeScript compile. No `.skip`/`.todo` or debt marker was found in the closure files. The focused projection tests exercise fresh-vs-stale values, revoked/missing/Off Limits rejection, dedupe/cap, bounded fence neutralization, exact payload change, ordinary context retention, and exact disclosure extraction.

## Requirements Coverage

| Requirement | Status | Evidence |
|---|---|---|
| AICFG-01 | ✓ SATISFIED | Durable master toggle, preservation, off-state hub and management escape hatch. |
| AICFG-02 | ✓ SATISFIED | OpenRouter, direct BYOK, and validated Custom lanes; one active lane. |
| AICFG-03 | ✓ SATISFIED | Inactive configurations/models retained; activation occurs only after setup success. |
| AICFG-04 | ✓ SATISFIED | PKCE browser auth, cached live catalog/pricing, curated-first dynamic picker. |
| AICFG-05 | ✓ SATISFIED | Exact selection validation and explicit Needs Attention; no substitution. |
| AICFG-06 | ✓ SATISFIED | Immutable system contract plus structured style and ordered copied local sections. |
| AICFG-07 | ✓ SATISFIED | No arbitrary total ceiling; local estimates/cost and explicit selected-model overflow. |
| AICFG-08 | ✓ SATISFIED | Permissioned context and latest-three interactions are gated as before; Message Focus now adds emphasis only after fresh eligibility revalidation, while Off Limits and Group Notes remain excluded. |
| AICFG-09 | ✓ SATISFIED | Quick/freeform Adjust is ephemeral and returns through the three-variant path. |
| AICFG-10 | ✓ SATISFIED | Defaults/search/drill-in/bulk controls and creation writers are wired; Group Notes absent. |
| AICFG-11 | ✓ SATISFIED | Whole prompt in Settings and contact-specific Compose disclosure use the exact resolved payload. |
| AICFG-12 | ✓ SATISFIED | One-time first-use disclosure is mounted; retired exact-prompt acknowledgement does not gate generation. |
| AICFG-13 | ✓ SATISFIED | Categorized failures, deliberate repair, preserved Compose state, no failover. |
| AICFG-14 | ✓ SATISFIED | Structured diagnostic event copies only safe allowlisted metadata. |
| AICFG-15 | ✓ SATISFIED | Credentials remain in SecureStore and outside settings/backups/logs. |
| AICFG-16 | ✓ SATISFIED | Nonsecret configuration/permissions roundtrip; missing local credentials yield Needs Attention; orphan repair works. |
| AICFG-17 | ✓ SATISFIED | v5 closes milestone inventory, including Group Events, presentation/background bytes, portable preferences, and explicit legacy defaults. |

## Anti-Patterns and Test Quality

- Scanned all 104 source/test files changed from the first Phase-36 implementation commit through `fe1c563`; no unreferenced `TBD`, `FIXME`, or `XXX` blocker marker was found.
- No placeholder/static-return path was found in the required artifacts. Dynamic values trace to SQLite, SecureStore, local files, or provider responses as appropriate.
- The prior hollow Message Focus link is closed through a focused, current-permission projection and the sole immutable builder.
- No circular test was accepted as sole proof for the critical restore, egress, or transaction invariants; focused tests invoke real exported behavior and SQLite operations.

## Human Verification Required

Seven plan-declared backstops remain device/visual observations: physical OpenRouter redirect/auth/loading; long-text layout across connection/personalization/hub surfaces; `.txt/.md` picker copy durability; and Compose repair navigation. Automated facts, including Message Focus permission preservation and payload identity, are not routed for rubber-stamp approval. Judgment-tier prohibitions remain listed in frontmatter as non-authoritative code-audit verdicts with human review recommended.

## Deferred Items

None.

## Gaps Summary

No automated gaps remain. Commit `fcd060d` closes the prior AICFG-08 failure: selected identities are revalidated against a fresh normalized Research read, only fresh permitted content survives, and the same immutable payload gains an explicit stronger-relevance block without dropping ordinary context. The phase awaits only the seven retained device/visual observations.

---

_Verified: 2026-09-14T15:17:00Z_
_Verifier: the agent (gsd-verifier)_
