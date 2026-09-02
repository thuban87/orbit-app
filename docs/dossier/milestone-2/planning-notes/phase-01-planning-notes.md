# Phase 01 — App Shell & Navigation — Planning Notes

- **Phase:** 01 App Shell & Navigation
- **Dossier (ground truth):** `docs/dossier/milestone-2/phase-01-app-shell-navigation-dossier-amended-group-events.md`
- **Date:** 2026-09-01
- **Source:** planning notes from `oa-audit-dossiers` run 3, owner resolutions 2026-09-01

> Planning notes, not decisions. The dossier is ground truth; ADRs and `HANDOFF.md` are
> authoritative for recorded decisions. Verify every code cite on disk — cites were confirmed
> 2026-09-01.

---

## Escalations resolved (how the dossier was amended)

**E-07 — tab-root shell and the relocation of Archived / Unbound / Manage Favourites out of
Settings touch ADR-019 and ADR-018.**

- The dossier's four permanent bottom tabs, each with its own stack (D-01-011/012,
  `phase-01…md:107-117`), edit ADR-019's Decision text: "uses React Navigation's **native stack as
  its root navigation shell** … routes low-traffic settings destinations through a dedicated
  Settings screen" (`docs/decisions/ADR-019…md:18,31`).
- ADR-018's substance — the archive-before-purge gate — is **untouched**; only the *home* of the
  Archived list moves (Phase 5's half).
- **The outcome is recorded in the dossier and in `docs/decisions/`, not here.** Before planning,
  read the phase-01 dossier and check for a superseding ADR against ADR-019. If none exists and the
  dossier still specifies a tab root, that is an unresolved reversal — stop and ask, do not plan
  around it.

**AUTO-FIX applied to this dossier:** AF-03 — §F, the §Cross-Phase "action workflows" line, and SC4
were stale at "five actions"; the universal FAB exposes **six** (Add Contact, Quick Log, Log
Contact, Group Log, Update Contact, Memory) per the dossier's own Supersession Map (D-01-002/010).
Plan against six.

## REPLAN items for plan-phase

### R-18 — Bottom-tab shell and origin-aware Back are unbuilt; existing reset-to-Home flows must be reconciled, not just replaced

- **Unbuilt / needed:** the tab navigator itself, and origin-aware Back semantics (D-01-011…021).
- **Code facts (verified 2026-09-01):**
  - Single `createNativeStackNavigator`; **no** tab navigator and no bottom-tabs dependency
    (`src/navigation/RootNavigator.tsx:57,74`).
  - Profile Back is a plain `goBack()` (`src/screens/ContactProfileScreen.tsx:762`) — it already
    pops to whatever pushed it, so "origin-aware" is partly free.
  - Forced Dashboard-rooting **does** exist in three places and matches D-01-019/022 (external entry
    → Dashboard fallback): Compose Back (`src/screens/ComposeScreen.tsx:266-268`), notification taps
    (`src/navigation/notification-nav.ts`), widget deep links
    (`src/widget/widget-linking.ts:55-57`, ADR-044).
  - Predictive back is disabled (`app.config.ts:76`).
- **Resolved / recommended path:** treat the three reset-to-Home flows as **requirements that must
  survive** the tab refactor, not as legacy to delete. Enumerate every `navigation.reset` call site
  and state its post-refactor behavior in the plan before writing the navigator.
- **Constraints / trip-wires:**
  - Do not remove the external-entry → Dashboard fallback; it is D-01-019/022 and ADR-044.
  - Re-verify the `navigation.reset` inventory on disk at plan time; the list above is from
    2026-09-01.

## Migration / sequencing

**None.** This phase implies no schema change. It is a pure navigation refactor and can be planned
independently of the milestone's migration chain.

## Stub-contract seams exported to Phases 15/17/18/Your Week

- **Phase 18 (Responsive & Release Hardening):** landscape/tablet and large-text reflow of the tab
  shell and every screen it roots (D-01-070/076).
- **Phase 15:** none originating here, but note E-07's outcome determines whether Settings keeps the
  Archived / Unbound / Manage-favourites rows that Phase 15 must reconcile.
