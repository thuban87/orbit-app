# ADR-122: Canonical Interaction Detail, Edit Route, and Shared Date Detail Sheet Through the Sole Recency Writer

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 32-interaction-history-insights
**Source decisions:** D-05 (32-CONTEXT.md) from dossier §T, §U, §V, §W, §X
**Reversibility:** one-way
**Migration:** None
**Supersedes:** None
**Superseded by:** ADR-127 (partial — dormant group-context and edit-scope routing only)

## Context

History & Insights needs one canonical way to inspect, correct, and delete an interaction, reachable from both the Heatmap drill-in and the Rolodex drawer. The plugin-era refinement lived inline on the profile timeline; the target design wants a fast Interaction Detail, a focused Edit route reusable by later logging flows (Phase 13/34), and one shared period/date sheet that interleaves the three record families with their different editability rules — all while every write still routes through the single recency spine.

## Decision

Heatmap and Rolodex reuse one `DateDetailSheet` that interleaves interactions, read-only lifecycle events (including the new Bound/Unbound labels), and history-aware knowledge changes chronologically by semantic icon; tapping an interaction opens `InteractionDetail`, and a knowledge row emits `onOpenKnowledgeChange(fieldKey)`. `InteractionDetail` renders **present-only** fields (no blank rows), a restrained AI sparkle strictly when `allow_ai === 1`, and Edit/Delete. Edit routes to the one canonical `EditInteractionScreen`, seeded by a contact-scoped single-row read (`readInteractionForEdit`, scoped `id = ? AND contact_id = ?`), which saves every editable field through `editTouchpointFull` — the **sole** recency writer — never a set-based `UPDATE interactions` (D-05, ADR-010/024). Future dates are rejected by reusing the DAO's `rejectFutureOccurredAt` (the inline UX flag agrees with the write authority by construction), and a failed save preserves the full form. Delete is a true hard-delete via `deleteTouchpoint` (tombstone + recompute in one transaction) behind a destructive `ConfirmDialog` naming Status/Gravity/Intensity; there is no trash/quarantine. The route is registered in all three Profile-hosting stacks (Dashboard, Orrery, Settings). Group-linked routing is a **dormant seam** (D-12): the group context, `GroupScopePrompt` (individual vs Group Event), and scope-gated Edit are structurally present but gated on the hard-false `isGroupLinked` predicate and never fire in Phase 32; the Group Note is kept a distinct field, never concatenated into the participant note and never given an Allow-AI toggle.

## Alternatives Considered

- **A form before every inspection / a slow detail surface** — Rejected; detail browsing stays fast and editing moves to a focused route.
- **A set-based `UPDATE interactions` from the edit screen** — Rejected; it bypasses the recency spine and is a correctness bug (D-05).
- **Re-implementing the future-date rejection in the UI** — Rejected; the UX guard reuses `rejectFutureOccurredAt` so it can never disagree with the writer.
- **A soft-delete / trash tier** — Rejected; deletion stays hard-delete with an explicit irreversible confirmation (dossier §X).
- **Rendering blank fields for absent values** — Rejected; the detail shows only present fields.
- **A hybrid editor with implicit individual-vs-group field ownership** — Rejected; group-linked Edit uses an explicit scope prompt (dormant until Phase 33).

## Consequences

### Positive

- One inspection/correction surface and one detail sheet serve every History entry point, with all writes on the single recency spine.
- The Edit route is reusable by Phase 13/34 rather than each flow inventing its own correction workflow.

### Negative

- Hard-delete is irreversible; the confirmation must state there is no undo.
- The group-scope routing is dead code in Phase 32 (documented, test-pinned inert) until Phase 33.

### Risks

- The delete-failure path must leave the row and derived metrics intact with the control re-enabled (no optimistic vanish); the DAO tombstone/recompute is node-tested and the UX was confirmed on-device.

## Implementation

**Key files:**
- `src/components/history/DateDetailSheet.tsx` — the shared period/date sheet interleaving the three record families.
- `src/components/history/InteractionDetail.tsx` — present-only inspection, the Allow-AI sparkle, and hard-delete behind the confirm.
- `src/components/history/interaction-detail-logic.ts` — pure `buildDetailRows` (no blanks), `showSparkle`, and dormant `buildGroupContext`.
- `src/components/history/GroupScopePrompt.tsx` — the dormant individual-vs-group scope prompt.
- `src/screens/EditInteractionScreen.tsx` — the one canonical Edit route saving via `editTouchpointFull`.
- `src/screens/edit-interaction-logic.ts` — `buildEditInput`, `canSave`, `isOccurredAtRejected`, `resolveSave`.
- `src/db/interaction-edit-read.ts` — the contact-scoped single-row read seeding the edit form.
- `src/db/recency-dao.ts` — `editTouchpointFull` and `deleteTouchpoint`, the sole recency writer paths.
- `src/components/TimelineRow.tsx` — exports `EVENT_LABELS` (extended with `bind→Bound`/`unbind→Unbound`) consumed by the sheet.

**Depends on:** ADR-024 (Editable Touchpoint History and Recomputed Recency); ADR-010 (Single-Writer Interaction Recency Spine); ADR-119 (Reusable Count-Only History Aggregation and Canonical History Read); ADR-025 (Immutable Lifecycle Events in a Unified Timeline)
**Required by:** ADR-123 (Profile History Section Replacing the Vertical Timeline)
