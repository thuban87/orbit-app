# ADR-019: Native Stack Contact Lifecycle Navigation

**Status:** Accepted
**Date:** 2026-08-14
**Phase:** 04-contact-crud-lifecycle
**Source decisions:** 04-CONTEXT “Navigation shell”; 04-RESEARCH Navigation alternatives; 04-UI-SPEC Settings surface
**Reversibility:** costly
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

The temporary Home-screen route toggle could not express the create, profile, edit, settings, and archived-contact paths needed for contact lifecycle work. The application needed real platform back navigation while preserving each screen’s existing custom chrome.

## Decision

The app uses React Navigation’s native stack as its root navigation shell. The navigator mounts only after migration readiness, hides native headers so screens retain their themed chrome, and routes low-traffic settings destinations through a dedicated Settings screen.

## Alternatives Considered

- **Retain hand-rolled route state** — Rejected because the multi-screen lifecycle would become unmanageable and lacks native back behavior.
- **Use native-stack headers** — Rejected because existing screens supply their own headers and would render duplicate chrome.

## Consequences

### Positive

- Contact lifecycle screens have typed route parameters and Android system Back traverses the actual stack.
- Settings becomes the distinct home for Custom Fields and Archived contacts.

### Negative

- Navigation adds native dependencies and requires a rebuilt application rather than a JavaScript-only reload.

### Risks

- Rendering before migration completion would expose an unready database; the root shell retains its readiness gate.

## Implementation

**Key files:**
- `App.tsx` — mounts the ready-gated navigation container inside the theme and safe-area providers.
- `src/navigation/RootNavigator.tsx` — registers the native-stack routes with custom screen headers.
- `src/navigation/types.ts` — defines the root stack route and parameter contract.
- `src/screens/SettingsScreen.tsx` — routes Settings users to low-traffic lifecycle destinations.
- `src/screens/HomeScreen.tsx` — enters contact creation and Settings through navigator actions.

**Depends on:** ADR-006 (Theme-Token Architecture).
**Required by:** ADR-020 (Library-Only Photo Capture with Themed In-App Cropping and One-Time URL Download); ADR-036 (Entry-Agnostic Compose Navigation and Transmittable-Fuel Guardrails); ADR-037 (Text-Only Android Share Intent Integration); ADR-044 (Headless Widget Actions and Dashboard-Rooted Deep Links)
