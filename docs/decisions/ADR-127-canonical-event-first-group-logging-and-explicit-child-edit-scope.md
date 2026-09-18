# ADR-127: Canonical Event-First Group Logging and Explicit Child Edit Scope

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 33-group-interaction-logging
**Source decisions:** dossier §§I–M, Q–V, AD–AE; 33-06/07/08-SUMMARY
**Reversibility:** reversible
**Migration:** None
**Supersedes:** ADR-122 (partial — dormant group-context and edit-scope routing only)
**Superseded by:** None

## Context

Global capture, Dashboard multi-selection, and contact History need one reusable Group Log workflow. Previously planted group-context and scope-routing seams are dormant until Group Event storage exists.

## Decision

The system uses one focused event-first Group Log form, presentation-first Group Event Detail, a separate Edit Group Event form, and a lean reverse-chronological title/participant-search browse page. Group Log always starts In Person with Tone and Duration unset, independently of ordinary channel preferences. It consumes serializable participant IDs and extends the canonical contact picker in multi-select mode with search, Clear, count, exclusion, and awaited Done. Saved additions commit as one batch before reload/dismiss; rejection retains selection and visible error. Group-linked child Edit explicitly asks individual versus Group Event scope. Dashboard, Orrery, and Settings profile-hosting stacks register the detail and edit routes. Participant cards open canonical child Detail, which renders actual Allow-AI state and shared seconds-aware duration labels.

## Alternatives Considered

- **Participant selection before opening the form** — rejected because event-first capture permits fuzzy details and zero participants.
- **A forked picker or Dashboard-owned group form** — rejected because both reuse canonical foundations.
- **A hybrid implicit-scope child editor** — rejected because field ownership must be explicit.
- **A permanent Group Events bottom tab or Dashboard launcher redesign** — excluded from this milestone.
- **Dismiss picker before persistence succeeds** — rejected because atomic failures must preserve visible input and retry state.

## Consequences

### Positive

- Capture and contact-history discovery reuse one domain workflow across navigation stacks.

### Negative

- Native sheets, discard guards, and runtime route registration require device verification beyond TypeScript types.

### Risks

- Node tests cannot prove native navigation or large-list usability. Final UAT records three passes, but its long-content participant case uses three people, not a large-set stress test.

## Implementation

**Key files:**
- `src/screens/GroupLogScreen.tsx` — event-first capture and fixed defaults.
- `src/screens/EditGroupEventScreen.tsx` — focused event edits and awaited batch additions.
- `src/screens/EditParticipantScreen.tsx` — explicit participant-scope route.
- `src/screens/GroupEventDetailScreen.tsx` — presentation, participant detail, and lifecycle actions.
- `src/screens/GroupEventsScreen.tsx` — local browse and search.
- `src/db/group-events-read.ts` — bound browse/detail/participant reads.
- `src/screens/group-event-detail-logic.ts` — seconds label and actual child consent projection.
- `src/components/ContactPicker.tsx` — shared multi-select confirmation.
- `src/components/contact-picker-multiselect.ts` — ordered selection and awaited outcome helpers.
- `src/components/history/InteractionDetail.tsx` — active group context and explicit callbacks.
- `src/components/history/GroupScopePrompt.tsx` — individual versus event choice.
- `src/components/history/HistorySection.tsx` — scope routing and conversion entry.
- `src/navigation/types.ts` — serializable route contracts.
- `src/navigation/focused-route-classification.ts` — focused editor classification.
- `src/navigation/tabs/DashboardStack.tsx` — Dashboard runtime registrations.
- `src/navigation/tabs/OrreryStack.tsx` — Orrery runtime registrations.
- `src/navigation/tabs/SettingsStack.tsx` — Settings runtime registrations.

**Depends on:** ADR-122 (Canonical Interaction Detail and Edit Route); ADR-096 (Dashboard Header and Overflow Discovery Paths); ADR-102 (Frozen-Universe Dashboard Multi-Select); ADR-124 (Group Event Parents with Canonical Per-Contact Children)
**Required by:** None
