# ADR-144: Complete Category Selection and Grouped Orrery System Discovery

**Status:** Accepted
**Date:** 2026-09-15
**Phase:** 37.1-category-management
**Source decisions:** dossier `phase-37.1-category-management-dossier.md` §§K–M; `37.1-UI-SPEC.md` §§7–9
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

The seeded catalog could be short enough for flat controls, but user-managed categories have no arbitrary cap. Every consumer needs complete canonical ordering and stale-safe selection without exposing inline category CRUD, while the Orrery System selector needs a limited discoverability improvement rather than a redesign.

## Decision

The system uses one complete local category catalog: normal controls through 12 real categories and a searchable Sheet at 13 or more, with search filtering visible rows only and policy-controlled NULL Uncategorized placement. The Orrery selector presents Built-in, Categories, and Custom Systems as independently collapsible groups, opening the selected group on each visit without persisting disclosure state.

## Alternatives Considered

- **Arbitrary category maximum or hard truncation** — rejected because no category may become inaccessible.
- **Screen-local picker/search implementations** — rejected because ordering, search, and stale-selection behavior must remain consistent.
- **Inline Add/Rename/Delete in consumers** — rejected because management belongs only in Settings.
- **Persisted selector expansion, recents, or broader Orrery redesign** — deferred because this phase admits only the constrained grouping cleanup.

## Consequences

### Positive

- Large catalogs remain locally searchable and selected entries remain selected when hidden by a query.
- Deleted Category Systems fall back through the established All Contacts path rather than retaining a stale selection.

### Negative

- Consumers must refresh and validate mutable catalog identity before a category-bearing write.

### Risks

- Duplicating the threshold or filtering selection rather than visible rows can hide valid choices or clear user intent.

## Implementation

**Key files:**
- `src/logic/category-logic.ts` — defines canonical choice construction, threshold, ordering, and NULL policy.
- `src/components/category/CategoryChoiceSheet.tsx` — renders the complete searchable category selection Sheet.
- `src/screens/CreateContactScreen.tsx` — validates current catalog identity before contact creation.
- `src/screens/EditContactScreen.tsx` — refreshes and validates mutable category selection for edits.
- `src/screens/BulkImportSetupScreen.tsx` — supplies a complete catalog for import batch selection.
- `src/components/orrery/SystemRuleAccordion.tsx` — exposes complete UID-backed category-rule authoring.
- `src/components/orrery/OrrerySystemSelector.tsx` — renders the three constrained System groups.
- `src/stores/orrery-system-store.ts` — persists the safe All Contacts fallback for a removed selected Category System.

**Depends on:** ADR-104 (Durable Orrery Preferences and Live System Scope); ADR-142 (User-Owned Categories with Stable Identity and Canonical Ordering)
**Required by:** None.
