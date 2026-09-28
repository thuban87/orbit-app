# ADR-175: Header-Only Back and a Shared Root Header on Every Tab Root and Settings Child

**Status:** Accepted
**Date:** 2026-09-23
**Phase:** 38.4-audit-remediation-ui-performance-release
**Source decisions:** dossier Workstream F; 38.4-CONTEXT D-15, D-22, D-23, D-43; RG-037 (`ui-accessibility/AUD-UIA-016`, `AUD-UIA-017`)
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Seven Settings children rendered a `ShellAppBar variant="child"` header Back and a second in-body Back. The Settings hub rows showed only a title and subtitle, without the Phase 37 `[DECIDED]` icon + title + subtitle + chevron spec. The Events tab root still rendered a child header with a Back from before Phase 38 promoted it to a tab. Digest drew a bespoke `ChromeScrim` display title instead of the shared header row.

## Decision

A screen with a non-root `ShellAppBar` has exactly one Back: the header's. The in-body Back and its `onBack` prop are removed from the About, AI, Appearance, Contacts, Interactions, Notifications and Orrery Settings children. A standing source contract forbids an in-body Back under a child header, and pins the header-less screens that must keep their own Back.

Settings hub rows show a semantic icon, title, subtitle and chevron. Glyphs come from the existing `ICON_REGISTRY` (ADR-086), with `appearance`, `contacts`, `notifications`, `about` and `widget` added. The row's accessible name is "title, subtitle", and the chevron appears only on route rows.

Every tab root (Contacts, Events, Digest, Orrery, Settings hub) uses `ShellAppBar variant="root"` and never shows a Back (D-22). Digest renders the shared root header titled "Digest" in every state (D-23), and a contract covers all five roots.

## Alternatives Considered

- **Keep the in-body Back and drop the header Back** — rejected by the owner (D-15); the header Back stays for accessibility and SHELL-03.
- **Owner-named glyphs or chevron-only rows** — not chosen (D-15); the planner picked the glyphs and the owner reviewed them on the device.

## Consequences

### Positive

- There is one predictable Back affordance per screen, and all tab roots share one header treatment.

### Negative

- Events' error copy can no longer say "go back"; it reads "Try opening it again in a moment." (accepted, D-43 B1).

### Risks

- None recorded.

## Implementation

**Key files:**
- `src/screens/SettingsAboutScreen.tsx` — in-body Back removed.
- `src/screens/SettingsAIScreen.tsx` — in-body Back removed.
- `src/screens/SettingsAppearanceScreen.tsx` — in-body Back removed.
- `src/screens/SettingsContactsScreen.tsx` — in-body Back removed.
- `src/screens/SettingsInteractionsScreen.tsx` — in-body Back removed.
- `src/screens/SettingsNotificationsScreen.tsx` — in-body Back removed.
- `src/screens/SettingsOrreryScreen.tsx` — in-body Back removed.
- `src/navigation/tabs/SettingsStack.tsx` — prop-free Settings child wrappers.
- `src/screens/SettingsHubScreen.tsx` — icon + title + subtitle + chevron rows.
- `src/screens/settings-hub-model.ts` — row icons, chevron rule and accessible names.
- `src/components/icons/icon-registry.ts` — added Settings glyphs.
- `src/screens/GroupEventsScreen.tsx` — root header on the Events tab.
- `src/screens/DigestScreen.tsx` — shared root header on Digest.
- `src/screens/settings-chrome-contract.test.ts` — single-Back contract.
- `src/navigation/tab-root-chrome-contract.test.ts` — tab-root header contract.

**Depends on:** ADR-140 (Navigation-First Settings Directory and Canonical Sub-Routes); ADR-146 (Digest-Centered Five-Tab Shell and Semantic Root Routing); ADR-086 (Semantic Icons and Accessible Interaction Primitives)
**Required by:** None
