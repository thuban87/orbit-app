# ADR-080: Four-Tab Bottom Navigation Shell with Per-Tab Stacks

**Status:** Accepted
**Date:** 2026-09-01
**Phase:** milestone-2 pre-build audit (oa-audit-dossiers)
**Source decisions:** dossier `phase-01-app-shell-navigation` §A, §B, §C, §D; `phase-05-dashboard-control-surface` §N (amended 2026-09-01); owner ratification 2026-09-01
**Reversibility:** costly
**Migration:** None
**Supersedes:** ADR-019 (partial — root shell); ADR-018 (note — Archived list entry points only; gate unchanged)
**Superseded by:** None

## Context

ADR-019 made a single native stack the root navigation shell and sent low-traffic destinations, including Archived contacts, through Settings. The milestone-2 dossiers specify four permanent bottom-nav destinations each with its own remembered stack, and Phase 5 §N adds a second Archived Contacts entry from Dashboard overflow (audit finding E-07). The owner ratified the tab shell on 2026-09-01.

## Decision

The root navigation shell is a four-tab bottom navigator — Dashboard, Orrery, Backup/Restore, Settings — and each tab owns its own native stack, so leaving and returning to a tab restores where that tab was. The migration-readiness gate that defers mounting until the database is ready and the hidden native headers that let screens keep their themed chrome both remain. Retapping the active tab dismisses any open transient UI first and returns that tab to root on a subsequent tap. In-app Back is origin-aware rather than always returning to Dashboard, and completed edit routes are replaced in the stack so Back never replays a finished edit. Externally launched flows — notification taps, widget actions, and deep links — keep the existing Dashboard-rooted fallback when no meaningful in-app origin exists, leaving ADR-040 and ADR-044 unchanged. Archived Contacts is reachable from the Dashboard overflow entry and the Settings row may remain; both route to the same screen. ADR-018's archive-before-purge gate and its rule that restore and permanent deletion live only on the Archived contacts list are unchanged — only that list's entry points widen.

## Alternatives Considered

- **Keep ADR-019's single native stack as the root shell** — Rejected because one stack cannot express four independently remembered top-level sections.
- **Treat Backup/Restore as a Settings shortcut rather than a tab** — Rejected because it owns a root route, its own remembered stack, and room for future child routes.
- **Keep "Profile always backs to Dashboard"** — Rejected because Back must return to the surface the user actually came from.
- **Remove the Settings row for Archived Contacts once Dashboard overflow has one** — Rejected because the redundant entry point is intentional and both route to the same screen.
- **Make Archived a Dashboard population instead of a child route** — Rejected because archived and active contacts are different lifecycle states, not a filter of one list.

## Consequences

### Positive

- Each top-level section keeps its own history, so cross-section excursions no longer destroy where the user was.
- Origin-aware Back and replaced edit routes remove the finished-edit replay bug the stack root produced.

### Negative

- Route parameter types, deep-link targets, and Back handling now resolve against a tab-plus-stack tree rather than a single stack.

### Risks

- Nesting a tab navigator inside the readiness gate incorrectly would mount screens against an unmigrated database; the gate stays ahead of the navigator.
- A deep link routed into the wrong tab's stack strands the user with a Back path that leaves the flow; external entries keep the Dashboard-rooted fallback.
- Two entry points to one Archived screen must not become two screens, or restore and purge would gain a second home and weaken ADR-018's single destructive surface.

## Implementation

**Key files:**
- `App.tsx` — keeps the migration-readiness gate ahead of the navigation container.
- `src/navigation/RootNavigator.tsx` — becomes the four-tab bottom navigator with a native stack per tab, headers still hidden.
- `src/navigation/types.ts` — declares the tab route contract and each tab stack's parameter list.
- `src/screens/SettingsScreen.tsx` — becomes a tab root; its Archived contacts row may remain alongside the Dashboard overflow entry.
- `src/screens/HomeScreen.tsx` — becomes the Dashboard tab root and hosts the overflow entry to Archived Contacts.

**Depends on:** ADR-006 (Theme-Token Architecture); ADR-009 (Crash-Safe Forward-Only SQLite Migrations)
**Required by:** _None._
