# ADR-166: Typed Cross-Tab Entry, Settings-Hosted Profile Contract, and Latest-Wins Notification Ingress

**Status:** Accepted
**Date:** 2026-09-23
**Phase:** 38.3-audit-remediation-runtime-state
**Source decisions:** dossier Workstreams B and F; 38.3-CONTEXT D-03, D-09, D-24, D-25, D-26, D-27, D-29; RG-021, RG-042; review A-WR-07
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Cross-tab entries (FAB, share linking, AI repair, resume prompts) navigated with bare nested screen payloads that could skip a tab's semantic root. A Profile hosted in the Settings stack lacked legitimate child routes such as RecentlyDeleted, and its Message action targeted Compose, which is not registered there. Archived contacts could reach Compose or crash on an unregistered route, and a delayed cold-start notification lookup could overwrite a newer warm tap's destination.

## Decision

All cross-tab navigation goes through `navigateIntoTab(navigator, tab, screen, params)`, typed per tab stack, never a bare nested payload and never a broad reset (ADR-146); the import/reconcile resume prompts use it too (D-26). Any stack that hosts Profile registers `PROFILE_REACHABLE_ROUTES` minus documented exclusions; Settings excludes exactly the messaging routes and registers `RecentlyDeleted`. Hero Message is always rendered, disabled with a reason, for archived contacts in every host (D-09) and for any Settings-hosted Profile (D-25); Compose stays unregistered under Settings. The Contact Methods row's native SMS handoff stays enabled (D-27). The FAB accepts Settings-hosted Profile context but never treats an archived, missing, or unreadable contact as context (D-29). For notification ingress, the latest accepted body tap wins: a warm body tap marks a per-mount chronology, a later cold result is dropped with a content-free debug log, and the cold response is cleared in a `finally`.

## Alternatives Considered

- **Register Compose under Settings** — rejected (D-09, RG-021); archived messaging stays prohibited.
- **Hide Message for archived contacts** — rejected (D-09); ADR-109 keeps unavailable actions visible with an explanation.
- **Cross-tab jump from a Settings-hosted Profile to Compose** — rejected (D-25).
- **Preselect an archived Profile as FAB context** — rejected by the owner at review close (D-29).
- **Broad stack resets on cross-tab entry** — rejected by D-03 / ADR-146.

## Consequences

### Positive

- Wrong screen names or params at cross-tab call sites are type errors, and no Profile host exposes a dead route.

### Negative

- New Profile child routes must be added to the reachable-routes contract and to every host stack.

### Risks

- The cold/warm notification ordering is covered by unit tests only; the owner accepted the device timing row as risk.

## Implementation

**Key files:**
- `src/navigation/tab-entry.ts` — typed `navigateIntoTab` helper.
- `src/navigation/shell-contract.ts` — `PROFILE_REACHABLE_ROUTES` and host exclusions.
- `src/navigation/tabs/SettingsStack.tsx` — registers RecentlyDeleted; omits Compose/ComposeResearch.
- `src/navigation/linking.ts` — share entry through the helper.
- `src/components/UniversalFab.tsx` — FAB cross-tab entry.
- `src/components/universal-fab-logic.ts` — SettingsTab context and `resolveFabContactContext`.
- `src/profile/relationship-sheet-model.ts` — `profileHeroActionState` archive and host checks.
- `src/components/profile/ProfileHero.tsx` — disabled Message with its reason line.
- `src/screens/ContactProfileScreen.tsx` — passes the Settings host into Message eligibility.
- `src/components/ResumeImportPrompt.tsx` — resume entry through the helper.
- `src/components/ResumeReconcilePrompt.tsx` — resume entry through the helper.
- `src/navigation/notification-gate.tsx` — cold/warm ingress chronology and `finally` clear.

**Depends on:** ADR-040 (Exactly-Once Notification Actions and Dashboard-Rooted Tap Routing); ADR-082 (Universal Capture FAB, Canonical Picker, and Truthful Quick Log); ADR-109 (Fixed-Hero Semantic Profile Composition and Focused Accessible Editors); ADR-141 (Explicit-Host Dual-Home Backup Navigation); ADR-146 (Digest-Centered Five-Tab Shell and Semantic Root Routing)
**Required by:** None
