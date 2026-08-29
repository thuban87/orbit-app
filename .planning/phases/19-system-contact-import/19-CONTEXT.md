# Phase 19: System Contact Import - Context

**Gathered:** 2026-08-26
**Status:** Product discussion completed externally/pre-roadmap; ready for research and planning.

<domain>
## Phase Boundary

Phase 19 acquires selected system contacts through native picker paths, then performs single/bulk review, initial linking or creation, conservative duplicate assessment, durable import sessions, and completion reporting. It builds on Phase 18's normalized methods and linkage foundation. Ongoing refresh/reconciliation and generic Orbit-to-Orbit merge belong to Phase 20.

</domain>

<decisions>
## Locked Invariants

- Read the canonical dossier in full. Its `[DECIDED]`, `[REJECTED]`, `[SUPERSEDES]`, phase-boundary, invariant, and explicit-deferral statements are locked product decisions, not prompts to reopen.
- Import is deliberate rather than address-book dumping: single import is reviewed before a write; bulk import uses shared defaults of Unbound + Uncategorized and does not add a per-person checkbox list after picker selection.
- System Contacts is source-only. Exact external linkage is deterministic; every other duplicate signal is advisory evidence, and ambiguity never silently links, merges, or blocks safe imports.
- Imported review/session state is durable once Orbit accepts the picker result. Safe partial commits stand, photo failures do not invalidate otherwise valid records, and cancellation/back behavior must preserve the locked no-write/confirmation boundaries.
- Preserve all explicit Phase 20 and post-Phase-20 deferrals: ongoing refresh, remembered reconciliation state, refresh-all, generic Orbit merge, source monitoring, provider-specific interaction tracking, and notification-listener work.

The exact native API wrappers, Android unsupported-state detection, session schema, batch concurrency, score tuning, transaction boundaries, and review design remain research/planning choices. Before planning, keep the recorded Dossier 19 iOS-picker decision versus the existing v1 iOS deferral visible; this context does not resolve that conflict.

</decisions>

<canonical_refs>
## Canonical References

**Researcher and planner MUST read this authoritative product-decision source in full before research or planning:**

- `docs/dossier/19-system-contact-import.md`

</canonical_refs>

<execution_directives>
## Execution Directives (owner, 2026-08-29)

These govern how `/gsd-execute-phase 19` (and its verify/UAT) run. They are owner instructions, recorded here so the executor/verifier honor them.

- **Migration 012 is PRE-APPROVED.** The owner reviewed and approved the v12 durable-session schema exactly as specified in `19-01-PLAN.md`'s objective — both tables (`import_sessions` + `import_session_rows`), the `phone_region` and `candidates_json` columns, nullable `batch_category_id` (NULL = Uncategorized, no categories seed), the `row_status`/`match_outcome` enumerations and transition table, `source_payload` as a JSON snapshot, plus the CHECKs/indexes; no contacts rebuild; no edit to shipped migrations 001–011. Plan 01's migration checkpoint is therefore satisfied in advance — **do not stop execution for it.** (If the schema in the plan is changed before execution, this pre-approval lapses and the checkpoint must be re-surfaced.)
- **The agent drives the device UAT.** Post-execution verification on the Pixel 6 Pro — the `<human-check>` gates across plans 02/04/06/07/08/09/10/11 (picker + SDK gate, staged-photo preview, FAB bulk routing, duplicate-review grid, resume/discard, photos, completion/retry) — is **driven by the agent**: build (debug, on `droid`), install, and drive the app per `docs/runbooks/desktop-build-pipeline.md` + the device-UAT run-as pattern. Do not default these UI flows to "human_needed." The owner reviews the *result*, not the mechanics.
- **Run autonomously once execution commences.** Do NOT stop for internal checkpoints — plan-checker gates, inner revision loops, wave sequencing, doc/nit fixes, or convergence-style mechanics are the agent's to resolve. Surface something to the owner ONLY when it is a **serious, obvious owner-bucket decision**: a new one-way/irreversible door (a further migration or destructive op not already approved), a security/privacy-posture change, a product/taste/scope call, or anything that would reverse a recorded ADR/HANDOFF/`[DECIDED]` decision. When in doubt, it must be genuinely serious and obvious to warrant a stop.

</execution_directives>

---

*Phase: 19-system-contact-import*
*Context gathered: 2026-08-26*
