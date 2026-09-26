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

> **2026-09-25 — pulled forward into 38.2 (`1e0139c`):** the visible half of
> `ui-accessibility/AUD-UIA-019` — reconciliation grid cards now show the live
> contact's name and photo instead of `Contact <id>`, and the detail screen names
> the contact. The accessible-representation findings (AUD-UIA-007/008) and the
> font mapping (AUD-UIA-015) remain here.

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

> 2026-09-26: RG-032 moved to the widget-overhaul phase (D-16). The 38.3
> loose ends were added as Workstream I (D-10).

## GSD Planning Guidance

Bundle small consistency fixes into coherent plans instead of generating
one plan per RG. Keep investigation-first items conditional. Preserve
original RG/finding IDs and verification expectations so repo-audit
verification can trace the work later.

## Owner Decisions (discuss session, 2026-09-26)

Grounding check (2026-09-26, `a8979c0`): 14 of 15 covered groups are
STILL PRESENT. `ui-accessibility/AUD-UIA-019` is FIXED (38.2,
`1e0139c`); its remaining accessible-selection work belongs to
`AUD-UIA-008`. Line numbers have drifted since the audit.

-   **[DECIDED · 2026-09-26] D-08 --- RG-041 launcher artwork is an
    owner input before planning.** The owner supplies Orbit artwork
    before plan-phase runs. The plan wires it into every active variant
    (adaptive foreground/background, monochrome/themed, legacy
    `icon.png`) and the About screen's icon. Package identity is
    unchanged. `splash-icon.png` is unreferenced and not in scope unless
    the owner supplies splash art too.
-   **[DECIDED · 2026-09-26] D-09 --- RG-040: remove the overlay
    permission from release only.** `SYSTEM_ALERT_WINDOW` is removed from
    the production manifest through authored config. Debug/dev-client
    builds keep it if they need it. No other permission changes;
    READ_CONTACTS (ADR-003) stays.
-   **[DECIDED · 2026-09-26] D-10 --- 38.3 loose ends fold into 38.4
    (new Workstream I).** O-3 (Import Complete Need-review count stale
    after DuplicateReview), A-WR-05 (Home favourite toggle bypasses the
    publication seam), W2 (Digest/Profile read on a warm notification
    action while backgrounded) and W3/O-1 (expo-sqlite
    `ERR_USING_RELEASED_SHARED_OBJECT` during shell-tick fan-out; seen
    once, so investigation comes first).
-   **[DECIDED · 2026-09-26] D-11 --- Phase 40 keeps its stub list.**
    38.4 covers its RGs, Workstream I and a targeted device pass. Phase
    40 keeps H6 backup/scene contention, broad large-text reflow, large-
    System Orrery performance, reduced-motion QA, AI loading/resume
    heuristics and final release/signing checks.
-   **[DECIDED · 2026-09-26] D-12 --- RG-029 contrast: foreground-only
    fix.** Standard Light glass (0.5) and all artwork stay as they are.
    Functional text on glass over Standard assets uses a foreground
    token that passes the real worst-case composite, and the proof tests
    the relevant extremum for each foreground. Backup/Restore actions
    use role foregrounds (`onAccent`, and a verified danger foreground).
-   **[DECIDED · 2026-09-26] D-13 --- RG-033 heatmaps: auto-size and
    center.** The owner reports that Your Week does not overflow on the
    narrow Moto Razr but leaves visible empty space on the right. The
    Your Week grid sizes its cells from the measured width (bounded) and
    is centered horizontally. Every day stays visible, with no
    horizontal scroll. Other heatmaps get the same fit guarantee.
-   **[DECIDED · 2026-09-26] D-14 --- RG-036: a persistent visible label
    above each passphrase field.**
-   **[DECIDED · 2026-09-26] D-15 --- RG-037 Settings chrome.** Remove
    the in-body Back from every Settings child and keep only the header
    (`ShellAppBar`) Back. Root rows get the Phase 37 `[DECIDED]` icon +
    title + subtitle + chevron. The planner picks glyphs from the
    existing semantic icon set, and the owner reviews them on the device
    pass.
-   **[DECIDED · 2026-09-26] D-16 --- RG-032 deferred to the
    widget-overhaul phase** as a hard requirement there: the new widget
    ships with named actions.

### Pre-planning owner inputs (2026-09-26)

-   **[DECIDED · 2026-09-26] D-21 --- RG-041 artwork supplied; launcher
    wiring.** Owner artwork: `assets/orbit-icon-foreground.png`,
    `orbit-icon-monochrome.png` and `orbit-icon-legacy.png` (1254²,
    RGBA). The adaptive background is the solid colour **Deep royal
    `#1A2F8A`**, set through `adaptiveIcon.backgroundColor` with no
    background image. The foreground and monochrome art currently fill
    about 90% of the canvas, so they are scaled down and centered inside
    Android's adaptive-icon safe zone (the inner 66/108) before wiring,
    as previewed and approved. The legacy full-square art becomes
    `app.json` `icon` and the About screen image.
-   **[DECIDED · 2026-09-26] D-22 --- Top-level tab roots never show a
    Back.** The Events tab root (`GroupEventsScreen`) still renders
    `ShellAppBar variant="child"`, left over from before Phase 38
    promoted it to a tab. It becomes `variant="root"`. Rides with RG-037.
-   **[DECIDED · 2026-09-26] D-23 --- Digest uses the shared header
    row.** Replace Digest's bespoke `ChromeScrim` display-text title with
    the same `ShellAppBar variant="root"` header row that the other tab
    roots use, titled "Digest". Rides with RG-037.

## Revision Log

-   2026-09-26 --- discuss session: grounding check (14/15 still
    present; UIA-019 fixed in 38.2); owner decisions D-08..D-16;
    TRIAGE.md selection recorded (RG-032 deferred to the widget
    overhaul).
-   2026-09-26 --- plan-phase intake: owner supplied launcher art and
    picked the Deep royal `#1A2F8A` background (D-21), and added the
    root-chrome consistency rulings D-22 (no Back on Events) and D-23
    (Digest shared header row).
