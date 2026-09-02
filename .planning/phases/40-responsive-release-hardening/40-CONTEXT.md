# Phase 40: Responsive & Release Hardening - Context

**Gathered:** 2026-09-02
**Status:** DEFERRED PLANNING — do not plan, discuss, or interrogate this phase yet

<domain>
## Phase Boundary

The late device/accessibility/performance/readiness audit pass before outside beta: it audits and
closes gaps, it does not introduce accessibility or responsive concerns for the first time (those
remain cross-cutting requirements in every earlier phase). Planning is intentionally deferred until
implementation exposes real device findings.

**Trigger to plan:** Phases 22–38 substantively implemented, with device-testing evidence
available. Interrogate with the owner first; this shim then gets replaced by a real CONTEXT.md.
</domain>

<decisions>
## Implementation Decisions

- **D-01:** No dossier exists. The stub-contract checklist in canonical_refs is the audit
  inventory: landscape/tablet + large-text reflow on every surface; List/Grid density fallbacks;
  Relationship Overview packing; yearly heatmap rendering; wheel density; large-System performance
  (culling/LOD, HUD responsiveness); gesture and device-GPU QA; Profile-background image memory;
  "Did you send it?" resume/lifecycle heuristics; AI loading presentation; wiring the sanitized AI
  diagnostic seam into Sentry preserving the no-private-content boundary; reduced-motion QA across
  Orrery/History/Theme.
- **D-02:** Orrery/Skia performance claims are physical-Pixel-only — the desktop emulator cannot
  assess them — and every perf claim must say which thread the evidence covers.
- **D-03:** This phase owns no schema by default; a migration need discovered here signals an
  upstream phase missed something — check before adding one. The backup wire format is frozen at
  v4 after Phase 36's final plan: any new durable entity or portable preference this phase
  introduces owes a format-5 bump — an owner decision, not a side effect.
</decisions>

<canonical_refs>
## Canonical References

**Read these before planning this phase (when its trigger fires).**

- `docs/dossier/milestone-2/planning-notes/phase-15-17-18-stub-contracts.md` — the Phase 18
  (Responsive & Release Hardening) stub contract with decision IDs, including the Pixel-only
  performance note
- `docs/dossier/milestone-2/orbit-ui-ux-master-handoff-v1.0.md` §8 — hardening deferral rationale
</canonical_refs>

<deferred>
## Deferred Ideas

This entire phase is deferred planning until device-testing evidence exists.
</deferred>

---
*Phase: 40-responsive-release-hardening*
*Context gathered: 2026-09-02 (deferred-planning placeholder)*
