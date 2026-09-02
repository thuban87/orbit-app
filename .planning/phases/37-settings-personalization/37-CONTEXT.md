# Phase 37: Settings & Personalization - Context

**Gathered:** 2026-09-02
**Status:** DEFERRED PLANNING — do not plan, discuss, or interrogate this phase yet

<domain>
## Phase Boundary

Final Settings information architecture and admin consolidation over the preference/admin seams
exported by Phases 22–36. Planning is intentionally deferred until after execution of Phases 22–35
so the Settings IA reflects the implemented product, not a speculative toggle inventory. This
placeholder exists so the seams delegated to Settings are not lost.

**Trigger to plan:** Phases 22–35 executed. Interrogate with the owner first (oa-interrogate or
gsd-discuss-phase); this shim then gets replaced by a real CONTEXT.md.
</domain>

<decisions>
## Implementation Decisions

- **D-01:** No dossier exists. The stub-contract checklist in canonical_refs is the complete
  inventory of what this phase must expose (appearance, right-swipe preference, ordinary Channel
  default with the Group Log exemption copy, Compose default mode, Contacts Administration /
  Category CRUD with its Orrery/Profile fallout and no reconciliation wizard, local owner profile,
  routes into canonical Systems / Profile-presentation / AI surfaces — never reimplementations).
- **D-02:** Settings controls write to `app_settings` columns created by the owning feature phases
  (owner resolution R-16); this phase builds UI over existing columns and owns no schema by
  default. A migration need discovered here signals an upstream phase missed something — check
  before adding one. The backup wire format is frozen at v4 after Phase 36's final plan: any new
  durable entity or portable preference this phase introduces owes a format-5 bump — an owner
  decision, not a side effect.
- **D-03:** Already-settled row fates (do not reopen): Manage favourites — retired (ADR-075);
  Include-unbound toggle — retired (E-02); Archived contacts — dual entry allowed (ADR-080/E-07);
  Custom Fields — stays; Memory Recently Deleted/Trash — owned by Phase 24, not here.
</decisions>

<canonical_refs>
## Canonical References

**Read these before planning this phase (when its trigger fires).**

- `docs/dossier/milestone-2/planning-notes/phase-15-17-18-stub-contracts.md` — the Phase 15
  (Settings) stub contract: the full must-expose checklist with decision IDs
- `docs/dossier/milestone-2/orbit-ui-ux-working-roadmap-v1.0.md` §9 — deferred late-phase strategy
- `docs/dossier/milestone-2/orbit-ui-ux-master-handoff-v1.0.md` §8 — Settings deferral rationale
</canonical_refs>

<deferred>
## Deferred Ideas

This entire phase is deferred planning. Nothing here is plannable until Phases 22–35 execute.
</deferred>

---
*Phase: 37-settings-personalization*
*Context gathered: 2026-09-02 (deferred-planning placeholder)*
