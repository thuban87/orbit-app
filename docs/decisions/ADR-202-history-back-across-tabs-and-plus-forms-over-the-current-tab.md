# ADR-202: History Back Across Tabs and + Forms Over the Current Tab

**Status:** Accepted
**Date:** 2026-10-11
**Phase:** 38.9-ux-standards
**Source decisions:** D-18, D-35, D-36, D-37, D-38, D-50, D-54, D-55 (38.9-CONTEXT.md; ledger Q-09, Q-10 + confirmation, Q-11 re-asked, Q-12 + confirmation, Batch 7 OQ-1/OQ-2); carried D-08, D-11
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

The tab navigator had no `backBehavior`, so Back on Digest jumped to Contacts, the first-declared tab (C-01). The + forms (Add Contact, Group Log, Update Contact, Memory) were registered only in the Contacts stack: `navigateIntoTab` switched to Contacts and pushed onto whatever was on top there, so Back after + from Digest landed on a stale Contacts screen (C-02). ComposeResearch kept the tab bar and + although it is part of the Compose workflow.

## Decision

The tab navigator uses `backBehavior="history"`: Back on a tab root returns to the previously visited tab (D-35). Because React Navigation 7 de-duplicates tab history, when history is exhausted on a non-launch tab Back first goes to the launch tab, Digest, so the app always exits from Digest (D-54). That hop, and any programmatic switch that must not become a Back target (Phase 39's Orient), uses `switchTabWithoutHistory`, which rewrites only the tab history in place and keeps every tab's stack state by reference; it never uses `navigate`, which would append Digest and loop. The + forms are registered in every tab stack (`FAB_ROUTES`) and open over the tab the user is on, picker flows included; Back before saving returns there; completion destinations are unchanged (D-38, D-08). An Add Contact started from Settings pops Settings back to its origin and opens the new Profile in the Contacts tab, because Settings-hosted Profiles disable hero Message (D-50, ADR-166). `ComposeResearch` joins the focused routes, hiding the tab bar and + (D-18). The + stays on browse surfaces including Settings children (D-11); its only standard against covering content is the existing end-of-scroll bottom clearance, which the custom-field editor gains (D-36, D-55); it does not change while a Contacts panel is open (D-37).

## Alternatives Considered

- **Keep today's first-route tab Back** — Rejected (Q-09).
- **Exit from the tab where history ran out** — Not chosen; D-35 says the app exits on the launch tab (D-54).
- **Keep + forms opening in the Contacts tab** — Rejected (Q-12 option c).
- **Return to the origin tab on save** — Rejected; it reverses D-01-022 (Q-12 option b).
- **Keep the + column clear at rest, or hide the + on Settings or while scrolling** — Rejected; the owner called clearing the column "a ridiculous overcorrection" (Q-10).
- **Hide or dim the + while a Contacts panel is open** — Rejected (Q-11).

## Consequences

### Positive

- Back retraces the user's own tab path, and a + form never strands Back on another tab's stale screen.

### Negative

- Every + route must be registered and typed in all five stacks; a per-stack registration test and a type-level exhaustiveness check enforce it.

### Risks

- A tab switch done with plain `navigate` where history must not grow reintroduces the Back loop; use `switchTabWithoutHistory`.

## Implementation

**Key files:**
- `src/navigation/tab-history.ts` — `inPlaceTabState`, `shouldFallbackToLaunchTab`, `switchTabWithoutHistory`.
- `src/navigation/RootNavigator.tsx` — `backBehavior="history"` and the launch-tab Back fallback.
- `src/navigation/shell-contract.ts` — `FAB_ROUTES` and `INITIAL_TAB`.
- `src/navigation/types.ts` — the + routes typed in every tab stack.
- `src/navigation/tabs/DashboardStack.tsx` — Contacts stack + routes.
- `src/navigation/tabs/DigestStack.tsx` — + routes registered.
- `src/navigation/tabs/EventsStack.tsx` — + routes registered.
- `src/navigation/tabs/OrreryStack.tsx` — + routes registered.
- `src/navigation/tabs/SettingsStack.tsx` — + routes registered.
- `src/navigation/tab-entry.ts` — `planContactsProfileOpen` and `openProfileInContactsTab`.
- `src/components/universal-fab-logic.ts` — `resolveFabTarget` keeps the focused tab.
- `src/components/UniversalFab.tsx` — passes the focused tab into the target and picker flow.
- `src/screens/CreateContactScreen.tsx` — the Settings-started completion branch.
- `src/navigation/focused-route-classification.ts` — `ComposeResearch` in `FOCUSED_WORKFLOW_ROUTES`.
- `src/screens/CustomFieldsScreen.tsx` — `useBottomClearance` on the field editor.

**Depends on:** ADR-146 (Digest-Centered Five-Tab Shell and Semantic Root Routing); ADR-166 (Typed Cross-Tab Entry, Settings-Hosted Profile Contract, and Latest-Wins Notification Ingress); ADR-173 (Universal FAB Semantic Visibility, Open-Dial Containment, Non-Collapsable Shell Overlays, Border, and Bottom Clearance); ADR-082 (Universal Capture FAB, Canonical Picker, and Truthful Quick Log)
**Required by:** ADR-241 (Import, Check, Merge and Restore Carry a Flow Host, and Settings-Started Flows Finish Back on Settings)
