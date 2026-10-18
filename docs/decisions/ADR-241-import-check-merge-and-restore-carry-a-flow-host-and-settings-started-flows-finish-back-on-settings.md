# ADR-241: Import, Check, Merge and Restore Carry a Flow Host, and Settings-Started Flows Finish Back on Settings

**Status:** Accepted
**Date:** 2026-10-18
**Phase:** 38.12-lifecycle-import-settings-ux
**Source decisions:** D-110, D-68, D-67, D-57 (way-out half) (38.12-CONTEXT.md; ledger Q-16); carried D-08, D-18 (39 D-61, D-86, D-96)
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Import, Check linked contacts and Settings-started merges reset to the Contacts tab when they finished, which lost the user's place in Settings and wiped tab history. "Choose file again" and an expired restore preview reset to Backup as the root, dropping Settings from beneath it. The Backup host was a React prop injected per stack, so Phase 39 could not start a restore from its first run and end it elsewhere. `ProfileOrigin` had a "settings" member that nothing read.

## Decision

Every import, check, merge and restore route takes an optional `host` route param, a `FlowHost` (D-110, D-68). Its kinds are `settings` (the default), `profile` (with the launching Profile's route key) and `digest` (Phase 39's first run, 39 D-86). Flow screens read `route.params.host ?? DEFAULT_FLOW_HOST` and end only through `flow-host`. They never reset to a root. Each screen forwards the host to the next.

- **Settings host.** Done, header Back and system Back alike finish on Settings → Contacts & Relationships (D-110; Back acts like Done, D-08).
- **Opening a person from a flow.** "View contact" or a tapped name opens the person's full Profile on the Contacts tab carrying `returnTab`. Back from it switches tab without history and pops that Profile off the Contacts stack out of sight. The Contacts tab is used because Settings-hosted Profiles disable Compose (ADR-166).
- **Profile host.** A merge started from a Profile's ⋯ ends on the survivor's Profile. It replaces the launching Profile, matched by route key, never by name.
- **Digest host.** The ending switches to Digest and pops every flow route (`FLOW_ROUTE_NAMES`) off the Settings stack.
- **Legacy picker way out.** `exitFlow` gives the picker a host-aware way out Phase 39 can retarget (D-57, 39 D-61).

Restore uses `RestoreHost`, the flow host without `profile` (D-68). "Choose file again" and the expired-preview Back pop to Backup with the host kept, so Settings stays beneath it (D-67). Dead `BackupStackParamList` / `BackupScreenProps` types are removed. A Settings host whose stack lacks Contacts & Relationships pops to the stack root with a warning, never an unhandled `POP_TO`.

## Alternatives Considered

- **Finish in Settings but open the person in a Settings-hosted Profile** — rejected; Compose is disabled there (Q-16 B).
- **Finish on the Contacts tab with a fixed Back** — rejected for back in Settings (Q-16 C).
- **Reuse the inert `ProfileOrigin`** — not taken; `ProfileRouteParams` carried no origin, so the behaviour became a `returnTab` param.

## Consequences

### Positive

- Flows end where they started, and every tab keeps its history.
- Phase 39 can run import and restore from its first run and end them on Digest with no new navigation code.

### Negative

- Every flow screen must forward the host; a dropped host silently falls back to Settings.

### Risks

- `popTo` replaces a route's params, so a bare `popTo('Backup')` would drop a digest host; the restore path passes the host explicitly.

## Implementation

**Key files:**
- `src/navigation/flow-host.ts` — `FlowHost`, `finishFlow`, `finishFlowOnProfile`, `exitFlow`, `openContactFromFlow`, `returnFromProfileToTab`, `FLOW_ROUTE_NAMES`.
- `src/navigation/tab-entry.ts` — `openProfileInContactsTab` with `returnTab`.
- `src/navigation/types.ts` — `host` on the flow routes, `ProfileRouteParams.returnTab`; dead Backup stack types removed.
- `src/navigation/back-acts-as-done.ts` — `useBackActsAsDone(done, enabled)`.
- `src/screens/ContactProfileScreen.tsx` — Back from a `returnTab` Profile.
- `src/screens/ImportCompleteScreen.tsx` — ends through the flow host.
- `src/screens/ImportReviewScreen.tsx` — ends through the flow host.
- `src/screens/ReconcileCompleteScreen.tsx` — ends through the flow host.
- `src/components/MergeImpactSummary.tsx` — merge endings by host.
- `src/screens/backup-dualhome-logic.ts` — `RestoreHost`, `returnFromRestore`.
- `src/screens/RestorePreviewScreen.tsx` — "Choose file again" keeps the host.
- `src/navigation/tabs/SettingsStack.tsx` — restore routes take the host as a param.
- `src/navigation/flow-host.test.ts` — endings pinned against the stack router.
- `src/navigation/profile-origin-integration.test.ts` — deleted with the inert origin path.

**Depends on:** ADR-146 (Digest-Centered Five-Tab Shell and Semantic Root Routing); ADR-166 (Typed Cross-Tab Entry, Settings-Hosted Profile Contract, and Latest-Wins Notification Ingress); ADR-202 (History Back Across Tabs and + Forms Over the Current Tab); ADR-141 (Explicit-Host Dual-Home Backup Navigation)
**Required by:** ADR-243 (Restore Runs on Focused Pages, Shows Its Steps, Counts People, and Names Replace All One Way)
