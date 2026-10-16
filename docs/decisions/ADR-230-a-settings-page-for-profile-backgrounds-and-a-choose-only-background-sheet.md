# ADR-230: A Settings Page for Profile Backgrounds and a Choose-Only Background Sheet

**Status:** Accepted
**Date:** 2026-10-16
**Phase:** 38.11-everyday-screens-ux
**Source decisions:** D-58, D-79, D-84, D-43; D-51 (informational) (38.11-CONTEXT.md; ledger Q-05, Q-10, Q-36, plan-time ruling D-79, convergence cycle 1 O-3); device-pass decision E4
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

The Profile ⋯ → Background sheet mixed three jobs: setting this person's photo, managing the global and Category backgrounds, and choosing a saved background. The owner called it "a hot mess": long, confusing, and with tall four-row cards that each carried a Delete. Settings → Appearance handled only the app's own art, plus a separate global-background picker, and phase 37 D-05 had said Settings does not link to the Profile managers.

## Decision

We will add a Settings **Profile Backgrounds** page (`ProfileBackgroundsScreen`, route `ProfileBackgrounds`) registered in all five Profile-hosting stacks (D-58). It manages the global background, Category backgrounds and the library of saved backgrounds. Delete lives there, behind each card's ⋯ with the themed confirm. It also offers Choose photo (D-79).

Appearance's "Default profile background" row opens this page instead of its own picker, and reads "None" when unset (D-84, E4). This amends 37 D-05: there is one control for the global background, and the Profile sheet now links a Settings page. The "Default profile layout" row is unchanged.

The Profile Background sheet is for choosing only. It keeps Choose photo (then Use for {name} or Not now) and gains a "Manage global backgrounds" button that closes the sheet and opens the page. Its saved-background cards have no Delete. Each card is two columns: the picture spans both rows on the left, with the name above "Assign" on the right, centred, at about half the old height. Assign writes this person's background at once. Reset to default (ADR-231) sits in the sheet. The sheet headers use the icon-only Back (D-43). Pick, crop and naming are one shared flow (`ProfileBackgroundCreateFlow`), and the library operations are one shared hook (`useProfileBackgroundLibrary`). Custom background photos get no extra contrast treatment (D-51, 38.4 D-41).

## Alternatives Considered

- **Reorder the sheet: person first, wide actions below** — the audit's D-13, superseded by the rework (Q-10).
- **Choose photo only on the Settings page** — rejected; it lives in both places (D-79).
- **Keep Appearance's own picker beside the new page** — rejected for one control (D-84).
- **Contrast backing behind text over custom photos** — rejected (Q-05).

## Consequences

### Positive

- Choosing a background is a short list; managing them has one home.

### Negative

- Setting a Category background now means leaving the Profile for Settings.

### Risks

- Large source photos can fail the crop on both entry points (F-06, pre-existing, backlog todo).

## Implementation

**Key files:**
- `src/screens/ProfileBackgroundsScreen.tsx` — the Settings page.
- `src/components/profile/use-profile-background-library.ts` — shared load, delete, global and Category operations.
- `src/components/profile/ProfileBackgroundCreateFlow.tsx` — shared pick, crop and name flow.
- `src/components/profile/ProfileBackgroundManager.tsx` — choose-only sheet, compact cards, Manage link.
- `src/profile/background-manager-model.ts` — `assignContactBackground`, `resetContactBackground`.
- `src/screens/SettingsAppearanceScreen.tsx` — the Default profile background row opens the page.
- `src/navigation/settings-routes.ts` — the Settings route family.
- `src/navigation/types.ts` — the `ProfileBackgrounds` route.
- `src/navigation/shell-contract.ts` — Profile-reachable route registration.

**Depends on:** ADR-112 (App-Owned Profile Background Derivatives and Launch Reconciliation); ADR-108 (Durable Independent-Axis Profile Presentation and Inheritance); ADR-140 (Navigation-First Settings Directory and Canonical Sub-Routes); ADR-166 (Typed Cross-Tab Entry, Settings-Hosted Profile Contract, and Latest-Wins Notification Ingress)
**Required by:** None
