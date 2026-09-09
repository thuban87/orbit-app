# Phase 31 Coverage Declaration

## External API detector

`COVERAGE: no-external-api`

Phase 31 adds no external API, SDK, network endpoint, credential, or remote data path. References to AI permission and the removed AI-draft entry describe local presentation state and the existing Message → Compose seam; they do not authorize transmission. Profile reads, templates, assignments, backgrounds, and image derivatives remain device-local.

## Assumption-delta decision

`add-alongside` — introduce a generalized `ProfilePresentation` resolution contract whose independently resolved layout and background share the locked contact → Category → global → theme/factory precedence. The fixed Hero content is not part of this contract and remains structurally invariant. An invariant test covers the same precedence and fallout matrix for both presentation axes.

## Specless edge-probe coverage

The required deterministic probe reported 50 applicable, 0 resolved, and 50 unresolved rows. The plan set resolves the behavior-specific rows below to explicit assertions or device backstops and deliberately carries the unclassified rows as flagged assumptions. Count check: 50 input rows = 43 resolved rows + 7 flagged assumptions; no row is dropped.

| Requirement | Category | Resolution |
|---|---|---|
| PROF-01 | empty | Explicit: missing Category/photo/methods preserve Hero geometry; unavailable methods remain disabled with reasons. |
| PROF-01 | encoding | Backstop: long Unicode/grapheme names and Categories reflow and remain fully accessible. |
| PROF-02 | adjacency | Explicit: section boundaries never merge and children cannot cross their owning parent. |
| PROF-02 | empty | Explicit: all eligible modules remain present as editor placeholders; empty enabled view sections collapse with summaries. |
| PROF-02 | ordering | Explicit: semantic module IDs and stable registry order break ties deterministically. |
| PROF-03 | idempotency | Explicit: repeated assignment writes converge on one UNIQUE assignment and one revision publication. |
| PROF-03 | concurrency | Explicit: one outer write transaction makes template edits and assignment fallout atomic. |
| PROF-04 | idempotency | Explicit: repeated save of the same background identity replaces safely without duplicate durable rows. |
| PROF-04 | concurrency | Explicit: draft/processing cancellation and failure leave the committed background and bytes unchanged. |
| PROF-05 | unclassified | FLAGGED ASSUMPTION: “Category change” includes change to no Category; inheritance then falls through to global/default while explicit contact choices survive. |
| PROF-06 | adjacency | Explicit: editor preview is contained in the topmost sheet and does not make underlying controls interactive. |
| PROF-06 | empty | Explicit: editor displays every eligible module with placeholders when the preview contact lacks data. |
| PROF-06 | ordering | Explicit: Save commits the complete canonical draft order; Cancel commits none of it. |
| PROF-06 | idempotency | Explicit: saving an unchanged canonical draft is a no-op apart from a successful close. |
| PROF-06 | concurrency | Explicit: save is one transaction; failure retains the whole in-memory draft. |
| PROF-07 | unclassified | FLAGGED ASSUMPTION: switching to the already-effective layout still counts as an explicit choice only if it changes the durable contact assignment; otherwise collapse overrides remain. |
| PROF-08 | unclassified | FLAGGED ASSUMPTION: “useful summary” is the approved UI-SPEC copy contract and never fabricates data. |
| PROF-09 | unclassified | FLAGGED ASSUMPTION: auto-packing uses measured content width and stable module order; equal-fit alternatives choose the earliest row-major placement. |
| PROF-10 | empty | Explicit: Unbound/never-contacted Status shows `Not tracked`/truthful unavailable explanation, not a fabricated status. |
| PROF-10 | encoding | Backstop: literal labels and explanation copy remain understandable at large text and with a screen reader. |
| PROF-11 | adjacency | Explicit: exact tile fit uses the declared span; no overlap or avoidable hole is introduced. |
| PROF-11 | empty | Explicit: unavailable Gravity/interaction inputs are textual; Unbound Intensity uses `This month`. |
| PROF-11 | ordering | Explicit: histogram bins and tiles retain chronological/registry order on ties. |
| PROF-12 | idempotency | Explicit: selecting the committed frequency/snooze state does not duplicate lifecycle events. |
| PROF-12 | concurrency | Explicit: canonical cores, event write, revision bump, and side effects compose beneath one transaction. |
| PROF-13 | adjacency | Explicit: methods remain separate rows ordered by type/display order/id. |
| PROF-13 | empty | Explicit: zero methods shows `None`; Message/Call remain disabled with reasons. |
| PROF-13 | ordering | Explicit: primary actionable first for Hero action selection while the section preserves complete deterministic groups. |
| PROF-14 | unclassified | FLAGGED ASSUMPTION: null `field_group` values render without an invented persistent group; named groups retain configured grouping. |
| PROF-15 | adjacency | Explicit: each card remains a distinct item; Pinned references dedupe against ordinary child lists. |
| PROF-15 | empty | Explicit: blank optional metadata consumes no row and zero items use the approved summary. |
| PROF-15 | ordering | Explicit: current-first/source semantic order is stable; approximately three items precede count-aware View all. |
| PROF-15 | idempotency | Explicit: repeated Pin/Hide commands converge without duplicate items or state inversion. |
| PROF-15 | concurrency | Explicit: card actions publish only after the owning local DAO succeeds. |
| PROF-16 | adjacency | Explicit: hidden and visible sets stay distinct; `Show hidden` appears only when hidden rows exist. |
| PROF-16 | empty | Explicit: no hidden rows means no Show-hidden control; normal empty summaries remain. |
| PROF-16 | ordering | Explicit: showing an item restores semantic ordering, never manual item order. |
| PROF-16 | idempotency | Explicit: repeated hide/show requests converge on the requested visibility. |
| PROF-16 | concurrency | Explicit: failed visibility writes retain committed UI state. |
| PROF-17 | adjacency | Explicit: Off Limits is its own caution section, not merged with Memories or AI state. |
| PROF-17 | empty | Explicit: empty enabled Off Limits remains collapsed with a useful summary. |
| PROF-17 | ordering | Explicit: factory child order places Off Limits seventh, before Imported Notes. |

All three PROF-17 edge rows inherit D-12: ordinary Off Limits renders caution semantics with no sparkle; the future permission input remains absent unless durable storage is introduced by an owning phase, and no existing field may be used as a proxy.
| PROF-18 | unclassified | FLAGGED ASSUMPTION: `latest few` is a hard limit of three rows plus last-contact summary and View all history. |
| PROF-19 | adjacency | Explicit: one separator divides contact actions from presentation actions. |
| PROF-19 | empty | Explicit: conditional Save/Reset entries disappear when inapplicable without adding an AI-draft entry. |
| PROF-19 | encoding | Backstop: long contact/template names do not obscure action meaning or accessibility labels. |
| PROF-19 | ordering | Explicit: Edit, Snooze/Unsnooze, Archive precede Profile Layout and Background. |
| PROF-20 | adjacency | Explicit: 44px targets remain distinct and grid columns reduce before controls collide. |
| PROF-20 | empty | Explicit: textual state and named controls exist even with no data or imagery. |
| PROF-20 | ordering | Explicit: Move Up/Down and drag dispatch the same reducer action and announce the new position. |

## Two-stage prohibition recall

Routine correctness findings (injection, path traversal, transaction rollback, malformed input) are referred to the Phase 31 threat models and `$gsd-secure-phase`; they are not duplicated as bespoke product prohibitions. Precision filtering retained these descriptor-less values/safety constraints for every plan to inherit:

- Profile presentation MUST NOT change, delete, or reinterpret contact data, Favorite, Snooze, AI permission, knowledge, or interaction history.
- Hidden-from-Profile MUST NOT imply privacy, deletion, Off Limits, or AI exclusion/permission.
- Off Limits MUST NOT be sent to AI or admitted to ranked/search/dashboard prompt projections merely because it is owner-visible on Profile.
- Profile loading and rendering MUST NOT require network access or transmit contact/background content.
- Customization MUST NOT make fixed Hero identity/actions reorderable or require precise drag/color/imagery to operate.
- Status, Gravity, and Intensity presentation MUST NOT invent factors, cadence, stored Gravity, or a separate Health metric.

## Multi-source audit

| Source | Items | Coverage |
|---|---:|---|
| GOAL | 1 | Plans 01–10 cover fixed Hero, modular presentation, templates/backgrounds, and Overview. |
| REQ | PROF-01…PROF-20 | Every ID appears in plan frontmatter and task assertions. |
| CONTEXT | D-01…D-12 | Plan 01 locks source/migration/AI/cadence/presentation/history/Off-Limits constraints; downstream tasks cite the applicable D-ID. |
| RESEARCH | 10 architecture/pitfall groups | Closed contracts, migration/DAO, aggregate reads/actions, semantic renderers, focused editors, safe backgrounds, host cleanup, tests, and handoffs are all planned. |
| UI-SPEC | E1…E10, 65 explicit + 8 backstop | Explicit states are assigned to implementation plans; all eight backstops are retained in Plan 10 physical-device UAT. |

Excluded without gap: CONTEXT/dossier deferred page-builder behavior, advanced background effects/packs, final Phase 32 history UX, new Status/Health/Gravity behavior, Category CRUD, full Compose/AI configuration, and Phase 40 polish. The Phase 24.2 grouped custom-field renderer and value-history backlist are covered by Plan 06.
