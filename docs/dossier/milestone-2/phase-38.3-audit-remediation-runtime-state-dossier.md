# Phase 38.3 --- Runtime Correctness, Navigation & State Coherence Dossier

## Objective

Make Orbit's live UI, navigation, asynchronous workflows, and
post-commit publication agree about current state. Committed actions
should reach relevant screens and native ingress paths without stale
publication, replay, lost drafts, misleading empty states, or broken
navigation semantics.

## Scope Principles

-   Preserve independent tab histories, Digest as the initial landing
    surface, and transient-first Back behavior.
-   Prefer explicit ownership/publication contracts over global-state
    rewrites.
-   Do not introduce a universal event bus, new state library,
    persistent Digest cache, or broad navigation reset.
-   A committed write must not replay because a later read/presentation
    step failed.
-   Pending, failed, empty, and successful outcomes must remain
    distinguishable where audited.

## Workstream A --- Group Event and Participant Editing

**RG-019.** Persist participant override edits; preserve unsaved parent
Group Event drafts during participant actions; never repeat a committed
participant insertion because readback failed.

## Workstream B --- Dashboard Shell and Navigation

**RG-020, RG-021.** Restore Home interactivity after panel dismissal;
investigate Contacts/TalkBack grouping on-device and fix only if
confirmed; preserve semantic tab roots and Back/reselect behavior; make
Settings-hosted Profile support legitimate child routes/context; route
Profile History actions to interaction history.

## Workstream C --- Dashboard Refresh Ownership

**RG-022.** Remove redundant/background refresh bundles and prevent
older async results from overwriting newer rows/counts/errors while
retaining required freshness triggers.

## Workstream D --- Assist, Profile and Digest Coherence

**RG-023--026.** Publish successful Assist confirmations to
queue/widget/foreground consumers; refresh Profile history and metrics
together; advance History's local-day definition; settle
frequency/snooze retries; refresh Digest after same-route Quick
Log/Undo, Assist publication and foreground/date changes; never present
failed day-detail reads as "No activity."

RG-023 covers successful publication only. RN-013 remains deferred.

## Workstream E --- Truthful Async Presentation

**RG-035.** Fix the five uncontested branches that conflate
loading/failure/empty/success. Do not change the ContactPicker
read-error empty-state fallback without a new owner decision or
superseding authority.

## Workstream F --- Notification Navigation Chronology

**RG-042.** Across cold/warm notification ingress, the latest accepted
tap wins; delayed cold lookup must not overwrite a newer warm
destination.

## Investigation Gate

**RG-020 accessibility subset:** observe actual Contacts/TalkBack
traversal before treating UIA-022 as confirmed. The confirmed
panel-dismissal bug proceeds independently.

## Explicitly Out of Scope

RN-013; notification scheduling/readback/deletion (38.2); broad
navigation redesign; new top-level tabs; universal stack resets;
persistent Digest snapshots; outreach-scoring changes; general UI polish
assigned to 38.4.

## Verification

Use mounted/runtime flows: rapid navigation, fresh/already-mounted
routes, foreground/resume, delayed/rejected reads, commit → failed read
→ retry, panel dismissal, Quick Log/Undo without blur, and cold/warm
notification ordering.

## Coverage

RG-019, RG-020, RG-021, RG-022, RG-023, RG-024, RG-025, RG-026, RG-035,
RG-042.

## GSD Planning Guidance

Organize plans around state ownership and end-to-end workflows, not
audit domains. Producer and consumer fixes may be separate plans, but
integration verification must prove convergence from user action to
visible state. Preserve RG/finding IDs.
