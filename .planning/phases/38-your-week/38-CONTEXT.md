# Phase 38: Digest & Navigation Restructure - Context

**Gathered:** 2026-09-02 (placeholder) · **Rewritten:** 2026-09-18 against the interrogated dossier
**Status:** READY TO PLAN — dossier interrogated through 2026-09-18; dependency phases (32, 33, 36, 37, 37.1) landed

> **Scope note:** This phase was originally slotted as a single "Your Week" page. It was
> re-specced into a full home/navigation restructure. "Your Week" is now one of three
> modules *inside* Digest, not the phase. The directory name (`38-your-week`) is retained
> for tooling stability; the phase's real name and contract are in the dossier below.

<domain>
## Phase Boundary

Replaces Orbit's contact-browser-as-dashboard shell with a Digest-centered home. Permanent
navigation becomes **Contacts · Events · Digest · Orrery · Settings**, Digest centered and the
default launch destination. Dashboard is relabelled Contacts; Group Events is relabelled Events;
the redundant Backup bottom tab is removed (Backup & Restore already lives in Settings from
Phase 37). Digest itself is a fixed three-part surface — **Up Next**, **Horizon**, **Your Week** —
composed from existing reads/aggregation, not new domain logic.

The phase absorbs the previously deferred birthday, Group Event rollup, and history/aggregation
obligations without expanding into a Contacts redesign, Events redesign, calendar system,
configurable dashboard, or new relationship-domain model.

**Trigger to plan:** Fired. Dependency phases have landed and the dossier is interrogated
(2026-09-18). Plan against the dossier as the authoritative contract.
</domain>

<decisions>
## Implementation Decisions

These D-NN are the cross-cutting **enforced guards** that must reach plan-phase. They do not
replace the dossier — read it in full first.

- **D-01:** The authoritative product contract is
  `docs/dossier/milestone-2/phase-38-digest-navigation-restructure-dossier.md`. Plan against it,
  not against this shim or the retired "Your Week page" framing.
- **D-02:** Digest is a read/derive-only surface with **NO schema of its own** and **no persisted
  Digest snapshot/cache** (dossier §O). Any durable state it wants would force another
  backup-format bump on top of the recent one — a strong signal an upstream phase missed
  something. Discovering a migration need here is a stop-and-confirm, not a licence to add one.
- **D-03:** Do **not** decompose into one-plan-per-tab or one-plan-per-Digest-module (dossier §R).
  The coherent unit is the shell/home-model transition plus the minimum Digest composition needed
  to make it useful. Keep the phase narrow; do not opportunistically redesign Contacts, Events, or
  Settings while restructuring navigation (§K, §R).
- **D-04:** Up Next ordering uses **canonical relationship/orbit status/progress semantics** — do
  not invent Digest-specific urgency classifications (§D). Up Next takes first claim on its (max
  three) contacts; Horizon must dedup against them and not re-surface the same condition (§E).
- **D-05:** Reuse Phase 32 / Profile heatmap + history aggregation and canonical interaction /
  Group-Event reads; do **not** reimplement them or create parallel metric definitions (§H, §J,
  §O). Unbound-contact cadence aggregation follows whatever Phases 31/32 settled (ADR-062 guard) —
  do not invent a third answer.
- **D-06:** The inherited birthday obligation now lives at **Horizon → Birthdays** (forward
  7-day window), **not** in Your Week — this corrects the earlier placeholder mapping (§F;
  ADR-076 superseding ADR-034).
- **D-07:** The dossier specifies no inline write actions in Up Next / Horizon (§D). If any
  interaction create/edit does appear, it must route through the single recency-writer core in one
  transaction (ADR-010/024/071); a write surfacing here otherwise signals scope drift.
- **D-08 [owner ruling, cycle-1 review]:** The `yourWeekPeriod` preference **is portable** and
  **`BACKUP_FORMAT_VERSION` bumps 6→7**. Emit it in `getPortableSettingsSnapshot`
  (`src/db/app-settings-dao.ts`) and its return mapping, following the **landed Phase 36 backup
  policy** — NOT the stale "declare-optional, emission-deferred" comment pattern at
  `app-settings-dao.ts:460-473`, which is now spent (Phase 36 already emits the formerly-deferred
  keys). This is a persisted **app-settings preference**, distinct from the D-02 prohibition on a
  durable *Digest snapshot/cache*; D-02 is not in tension. `BACKUP_FORMAT_VERSION` lives at
  `src/backup/types.ts` (currently 6). Owner decided this on 2026-09-18.
- **D-09 [owner ruling, cycle-1 review]:** The Your Week period preference is surfaced in **BOTH**
  places: a **Settings row** in Phase 37 Settings (its canonical home per dossier §I) **AND** the
  in-context Digest toggle. The two stay in sync (single source of truth in app-settings; the
  in-context toggle reads/writes the same preference). This **honors §I** and **supersedes** Plan
  05's earlier read of D-03 as licence to place it in-context only. D-03 governs plan
  *decomposition*, not preference *placement*. Owner decided this on 2026-09-18.
- **D-10 [owner ruling, cycle-3 review]:** The Digest **Never Contacted** surface (Horizon
  preview + its Contacts drill-through) **INCLUDES opted-in unbound never-contacted contacts**
  when `include_unbound_never_contacted = 1`, matching `countNeverContacted`
  (`dashboard-read.ts`) and the existing Dashboard behavior — so count, preview, and drill are
  consistent (fixes the cycle-3 HIGH). This requires a not-contacted read path beyond the hard
  `tracking_enabled = 1` scope of `DASHBOARD_POPULATION_SCOPE_WHERE` /
  `listDashboardPopulation` (`src/logic/dashboard-query-logic.ts:219-220`). This is an
  **owner-approved extension of §G/ADR-062 population semantics scoped to the not-contacted
  population only** — it does NOT broaden any other population, and it aligns the Digest with an
  already-shipped user setting rather than inventing new cadence semantics. Owner decided this on
  2026-09-18 with the ADR-062/§G trade-off explicitly surfaced.
</decisions>

<canonical_refs>
## Canonical References

**Read the dossier before planning; the rest are supporting.**

- `docs/dossier/milestone-2/phase-38-digest-navigation-restructure-dossier.md` — **authoritative
  contract** (Scope, §A–§S, planning-time verification checklist).
- `docs/decisions/ADR-076-population-reached-birthdays-without-a-dashboard-banner.md` — ratified
  birthday-presentation decision now homed in Horizon → Birthdays.
- Phase 32 history/heatmap aggregation and Profile activity-heatmap components — the reuse target
  for Your Week's heatmap and inline day detail (§J).
- Phase 37 Settings (Backup & Restore page; preferences persistence path) — enables Backup-tab
  removal (§K) and hosts the Your Week period preference (§I).
- `docs/dossier/milestone-2/planning-notes/phase-19-your-week-placeholder.md` — historical; the
  original inherited-inputs note now superseded by the dossier.
</canonical_refs>

<deferred>
## Deferred Ideas

Carried in the dossier §Q (Explicit Deferrals): Digest customization beyond the Your Week period
preference; configurable Up Next count / birthday horizon; Digest-specific FAB or inline outreach
controls; calendar rotary / long-range history in Digest; Contacts or Events redesign;
planned-event/calendar integration; broad Settings restructuring; repository-wide historical
terminology cleanup.
</deferred>

---
*Phase: 38-your-week (dir) — Digest & Navigation Restructure (name)*
*Context rewritten: 2026-09-18 against the interrogated dossier*
