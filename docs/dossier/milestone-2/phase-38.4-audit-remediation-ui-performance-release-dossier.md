# Phase 38.4 --- UI Consistency, Accessibility, Performance & Release Polish Dossier

## Objective

Resolve remaining code-detectable UI/design-system inconsistencies,
accessibility defects, bounded performance/resource issues, and small
production-hygiene problems without redesigning Orbit or reopening
accepted visual/product decisions.

## Scope Principles

-   Preserve Standard/Galaxy visual authority, approved
    glass/translucency, protected hues, and documented exceptions unless
    the owner changes them.
-   Prefer existing shared primitives/tokens/contracts over parallel
    replacements.
-   Suspected native accessibility behavior requires device/TalkBack
    confirmation.
-   Performance changes must preserve correctness and avoid unmeasured
    frame-rate/battery claims.
-   This is a hardening/polish sweep, not a broad redesign.

## Workstream A --- AI Settings and Permission Presentation

**RG-008.** Use canonical current AI configuration in Memory editors;
distinguish filtered results from actual permission totals; identify
saved model selections; never change consent as a UI side effect.

## Workstream B --- Bounded Performance and Resource Retirement

**RG-027, RG-028.** Retire obsolete Orrery geometry/scene resources
after settlement while preserving transition behavior; bound Your
Week/day reads to relevant history while preserving canonical results.
Any schema/index change is forward-only.

## Workstream C --- Theme, Contrast and Shared Controls

**RG-029, RG-030.** Correct contrast proof/composition and
Backup/Restore action foregrounds; make switches/selectors/actions
expose theme colors, names, values, selected state and established touch
targets without overlapping hit regions.

## Workstream D --- Contact, Review and Widget Accessibility

**RG-031, RG-032.** Expose real contact identity and relevant
search/selection/decision context; stop substituting DB IDs for people;
use registered semantic fonts where required; author accessible names
for native widget action overlays.

## Workstream E --- Responsive Layout and Large Text

**RG-033, RG-034.** Keep heatmaps within supported narrow widths; make
Profile layout-preview geometry match actual rows; investigate
confirmation reachability at maximum supported text/display scaling and
remediate only if confirmed.

## Workstream F --- Forms, Settings and Timestamps

**RG-036--038.** Keep backup passphrase fields visibly identifiable;
provide one canonical Back action per Settings child and restore
specified directory affordances; route equivalent explicit timestamps
through the approved shared presentation contract.

## Workstream G --- FAB Accessibility Investigation

**RG-039.** Inspect native accessibility nodes for closed/open/closing
FAB states. If collapsed actions remain traversable/invokable, make
semantic visibility match visual visibility; if disproven, document and
close.

## Workstream H --- Production Hygiene and Launcher Identity

**RG-040, RG-041.** Remove the unused Expo-template overlay permission
from authored production configuration; replace active Expo scaffold
launcher artwork with owner-approved Orbit artwork across applicable
variants while preserving package identity.

## Manual Visual / Device Pass

Review touched surfaces on Android for narrow widths, large text/display
scaling, Standard/Galaxy themes, TalkBack traversal, touch targets,
heatmaps/layout preview, Settings chrome, backup fields/actions, widget
semantics, FAB states, and final launcher appearance. This is targeted
verification, not a new whole-app redesign audit.

## Investigation Gates

-   **RG-034:** confirm large-text confirmation reachability before
    choosing an adaptive treatment.
-   **RG-039:** confirm collapsed FAB native accessibility exposure
    before structural remediation.

## Explicitly Out of Scope

Accepted dense Year-cell limitation, broad typography redesign, new
12/24-hour preference, broad native performance calibration, package
renaming, mandatory encryption, visual-policy reversals, and unrelated
final release/signing work.

## Verification

Carry forward MANUAL-VISUAL/DEVICE/RUNTIME/STATIC requirements from
source groups. Use real native accessibility nodes and TalkBack where
specified; validate actual compositing for contrast; use physical-device
measurements for performance claims.

## Coverage

RG-008, RG-027, RG-028, RG-029, RG-030, RG-031, RG-032, RG-033, RG-034,
RG-036, RG-037, RG-038, RG-039, RG-040, RG-041.

## GSD Planning Guidance

Bundle small consistency fixes into coherent plans instead of generating
one plan per RG. Keep investigation-first items conditional. Preserve
original RG/finding IDs and verification expectations so repo-audit
verification can trace the work later.
