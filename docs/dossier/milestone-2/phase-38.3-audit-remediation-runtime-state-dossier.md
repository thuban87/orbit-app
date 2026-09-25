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

RG-023 covers successful publication. ~~RN-013 remains deferred.~~
RN-013 is folded in; see D-08 under Owner Decisions.

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

## Owner Decisions (discuss session, 2026-09-25)

Grounding check (2026-09-25): every finding in every covered group is
still present in current code. Phase 38.2 changed none of it. No item
exists only to repair legacy data (38.2 D-23), so nothing was cut on that
basis. The full rulings, with code anchors, are in `38.3-CONTEXT.md`
(D-07..D-24).

-   **[DECIDED · 2026-09-25] D-07 --- CF-02 kept.** The Phase 22
    ContactPicker read-error empty-state fallback stands, and RG-035
    fixes only the five other branches.
-   **[DECIDED · 2026-09-25] D-08 --- RN-013 reopened and folded into
    RG-023.** Banner and sheet assist confirm/dismiss surface failures
    with an Alert. The clock-rollback case gets its own copy. Double
    taps are latched, and the assist stays pending on failure. The
    ADR-071 guard is unchanged.
-   **[DECIDED · 2026-09-25] D-09 --- Archived contacts: Message
    disabled** in every Profile host. Compose is not registered under
    Settings, and archived messaging stays prohibited.
-   **[DECIDED · 2026-09-25] D-10 / D-11 --- History actions.** Last
    Interaction and View history scroll to and expand the in-Profile
    History section (ADR-123). There is no new screen and no reset of
    the History selection. If the layout omits History, the actions
    are not offered.
-   **[DECIDED · 2026-09-25] D-12 --- History rollover.** On a date
    change, History follows today only if it was showing the current
    period. A picked past date stays put. The today-bound limits always
    update.
-   **[DECIDED · 2026-09-25] D-13 / D-14 --- Live Digest.** Digest
    re-reads immediately after committed writes (Quick Log, Undo,
    headless, assist), with the standard list transition. It also
    refreshes on every foreground resume, ordered after the
    launch/foreground sweep.
-   **[DECIDED · 2026-09-25] D-15 --- New day.** The chosen period is
    kept and the window moves. A selected day survives only if it is
    still in the window.
-   **[DECIDED · 2026-09-25] D-16 --- Day detail.** Loading shows an
    inline indicator. An error shows "Couldn't load this day" with
    Retry. "No activity" appears only after a successful empty read.
    This closes Phase 38 WR-01.
-   **[DECIDED · 2026-09-25] D-17 / D-18 --- Group Event drafts.**
    Participant actions keep the unsaved parent draft silently.
    Following participants show the saved event's values.
-   **[DECIDED · 2026-09-25] D-19 --- Committed add, failed refresh.**
    The picker closes as a success. The event screen then shows
    "Couldn't refresh" with a Retry that only re-reads and never
    re-adds.
-   **[DECIDED · 2026-09-25] D-20 --- Import fatal state.** The screen
    shows "Import stopped" with a route to Import Complete (38.2
    Retry/Skip). Nothing re-runs automatically.
-   Recorded planner calls (D-21..D-24):
    -   one shared assist publisher, which also covers Post-Log Note
        save;
    -   no timers for date freshness;
    -   hidden-Home refresh deferred to focus, with a latest-request
        authority;
    -   honest error/loading states for the remaining RG-035 surfaces;
    -   RecentlyDeleted registered under the Settings Profile host;
    -   stale cold notification results dropped.

## Revision Log

-   2026-09-25 --- discuss session: grounding check (all findings
    present); owner decisions D-07..D-20; recorded calls D-21..D-24;
    RN-013 reopened into RG-023; triage selection recorded in
    `TRIAGE.md`.

