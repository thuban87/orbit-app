# Phase 38: Your Week - Context

**Gathered:** 2026-09-02
**Status:** DEFERRED PLANNING (provisional slot) — do not plan, discuss, or interrogate yet

<domain>
## Phase Boundary

Designs the Your Week page: the relocated upcoming-birthday presentation (ADR-076 superseded
ADR-034), Group Event rollups, and reuse of Phase 32's heatmap/history aggregation. This slot
exists because four dossier decisions delegate content to Your Week; without it the 7-day
"reason to reconnect" surface would vanish when the Dashboard banner is removed.

**Trigger to plan:** Phases 32 (History aggregation), 33 (Group Events), and 36 (backup v4 bump)
have landed. Interrogate with the owner first; this shim then gets replaced by a real CONTEXT.md.
</domain>

<decisions>
## Implementation Decisions

- **D-01:** No dossier exists. The placeholder file in canonical_refs records the inputs that must
  reach this phase (birthday inheritance per the ADR-034→076 supersession; Group Event rollups
  read from Phase 33's schema; Phase 32's aggregation layer reused, never reimplemented).
- **D-02:** As scoped this is a read/aggregation surface implying NO schema of its own. It is
  planned after Phase 36's backup v4 bump, so any durable state it wants would force another
  format bump — a strong reason to keep it read-only. A migration need discovered here signals an
  upstream phase missed something.
- **D-03:** Cadence-relative aggregation is undefined for Unbound contacts (ADR-062 guard);
  whatever fallback Phases 31/32 settled applies here too — do not invent a third answer.
- **D-04:** Any interaction this phase creates or edits routes through the single recency writer
  cores composed in one transaction (ADR-010/024/071).
</decisions>

<canonical_refs>
## Canonical References

**Read these before planning this phase (when its trigger fires).**

- `docs/dossier/milestone-2/planning-notes/phase-19-your-week-placeholder.md` — the slot's
  inherited inputs and constraints
- `docs/decisions/ADR-076-population-reached-birthdays-without-a-dashboard-banner.md` — what was
  ratified about birthday presentation
- `docs/dossier/milestone-2/orbit-ui-ux-working-roadmap-v1.0.md` §4/§11 — the provisional slot
</canonical_refs>

<deferred>
## Deferred Ideas

This entire phase is deferred planning until its dependency phases land.
</deferred>

---
*Phase: 38-your-week*
*Context gathered: 2026-09-02 (deferred-planning placeholder)*
