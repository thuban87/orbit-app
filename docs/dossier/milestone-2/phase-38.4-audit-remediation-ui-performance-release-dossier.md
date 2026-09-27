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

> 2026-09-26: contrast of text sitting bare on the background art (RG-029
> finding F-1) moved to Phase 38.5 (D-38). 38.4 keeps RG-029's glass proof
> (`AUD-UIA-001`) and the Backup/Restore role foregrounds (`AUD-UIA-002`).

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

-   **[DECIDED · 2026-09-26] D-24 --- RG-029 non-text/link colours:
    inventory, then darken.** The corrected darkest-pixel proof fails status
    hues, rogue, accent text and danger text over Standard Dusk/Mesh in
    Standard Light. Inventory which of them actually render on Standard
    glass, then add darker Standard-Light-only variants for those so they
    pass on every Standard asset. Galaxy, Standard Dark and the 0.5 glass
    are unchanged. The owner reviews on the device pass. Secondary text on
    Standard-Light glass resolves to primary text. Any narrowing of the
    proof must be explicit and justified in the test.
-   **[OPEN · owner] D-25 --- W3/O-1 native remedy.** A patch-package
    backport of the upstream expo-sqlite fix versus waiting for a
    published bump is the owner's call. It is asked only if the
    investigation shows the JS mitigations are not enough.

### Owner rulings during Plan 03 execution (2026-09-26)

-   **[DECIDED · 2026-09-26] D-26 --- Standard-Light glass link colours:
    accept all eight lightness-only variants.** Plan 03 stopped because
    two curated accents pass only below the HSL L 12% near-black floor.
    The owner accepted lightness-only glass `accentText` variants for
    all eight accents, including aurora-teal `#05312E` (L 10.6%) and
    emerald `#083319` (L 11.6%). The other six are nebula-blue
    `#162568`, slate-indigo `#202856`, solar-amber `#392807`,
    rose-quartz `#541227`, violet-haze `#331E61` and coral `#501A11`.
    The alternatives were each rejected: flattening links to primary
    text loses hue identity, a documented exception leaves links
    failing, a hue move reverses part of D-24, and a glass-opacity raise
    reverses D-12. All eight go on the Plan 17 device review, which
    checks that teal and emerald still read as their hue.
-   **[SUPERSEDED by D-29 (owner, 2026-09-26)] D-27 --- F-1 bare text on
    art goes to the device review.** Helper, caption and error text
    sitting directly on veiled Standard art, with no glass or opaque
    backing, was not fixed in Plan 03. The owner was to review it on the
    device in Plan 17 and then decide whether to defer or fix it. The
    site list is `38.4-RG029-INVENTORY.md` §5.
-   **[DECIDED · 2026-09-26] D-28 --- Coral's shared light link tone
    darkens about 1% lightness.** `ACCENTS.coral.light.text` `#B03A26` →
    `#AC3925` (hue and saturation move only by 8-bit rounding). This
    lifts the Galaxy Light presentation card from 4.48 to 4.63 and
    retires the held exclusion E-7. Accepted side effect: Standard Light
    coral links on opaque surfaces darken imperceptibly. Coral's fill,
    `onAccent` and the D-26 glass variant are unchanged.

### Owner rulings after Wave 1 (2026-09-26)

-   **[SUPERSEDED by D-38 (owner, 2026-09-26)] D-29 --- F-1 fixed in
    Plan 16 with a scrim.** Superseded D-27 without waiting for the
    device review. Bare functional text on Standard art was to get a
    `ChromeScrim` (or an equivalent existing backing), only in Standard
    Light on Dusk or Mesh. The owner rejected the light-text/dark-veil
    and halo alternatives, because no single text colour passes over
    both extremes of Dusk and Mesh. Extended by D-35 and D-36, then
    withdrawn from 38.4 by D-38.
-   **[DECIDED · 2026-09-26] D-30 --- The selected Touchpoint duration
    chip is filled.** The selected preset or None chip uses the accent
    fill with an `onAccent` label (ADR-084), so selection no longer
    depends on border colour. Unselected chips are unchanged. Moved from
    Plan 16 to Plan 20 by D-34; the ruling itself is unchanged.
-   **[DECIDED · 2026-09-26] D-31 --- The open FAB dial keeps
    accessibility focus.** While the speed dial is open, the tab
    navigator and screen content are hidden from accessibility (the 38.3
    RG-020 pattern), so TalkBack, Switch Access and keyboard focus stay
    in the dial. Plan 12. The RG-039 closed-dial fix is unchanged.
-   **[DECIDED · 2026-09-26] D-32 --- Gap plan 18 (G1): Sheet bodies
    scroll at large text.** The `Sheet` compact/detail variants scroll
    their body so the actions stay reachable. Found on the Pixel 3a at
    font scale 2.0 in InteractionDetail. This is a device-found
    follow-on to RG-034, not an audit finding.
-   **[DECIDED · 2026-09-26] D-33 --- Gap plan 19 (G2): the Contacts
    screen freeze.** Choosing a population, filter or sort-order action
    at the top of Contacts makes the app unresponsive until a
    force-restart, although the setting is persisted. The Profile
    ScrollView ignoring swipes after a warm deep link or a Quick Log
    snackbar is in scope too. Investigation first; tracked as `GAP-G2`.
    A root cause whose fix reverses a recorded decision or needs a
    schema change comes back to the owner.
-   **[DECIDED · 2026-09-26] D-34 --- Gap plan 20 (G3): glass-scope read
    sites, plus the items moved from Plan 16.** The glass palette
    reaches only colours read by a hook called inside the scope. Many
    screens call `useTheme()` above their `GlassSurface`/`ChromeScrim`
    and use the colours inside it, so the D-24 variants and the
    secondary-to-primary override never reach them (for example the
    `danger` warning in `AIPersonalizationScreen` and the `danger`
    caption in `DigestScreen`). Every foreground rendered inside a
    glass/chrome scope resolves through the scope, through an in-card
    child that calls `useTheme()` or a scoped-read helper. An AST source
    contract proves rendered usage, not just palette values. Planning
    found 48 out-of-scope reads in 17 files. The D-30 chip, the Plan 08
    font-family swaps and the unused `Pressable` import also move to
    Plan 20, which runs after Plan 16 and before Plan 17.
-   **[SUPERSEDED by D-38 (owner, 2026-09-26)] D-35 --- The bare-text
    scrim also covers Standard Dark.** Extended D-29 to Standard Dark on
    all four Standard backgrounds; Standard Light stayed Dusk and Mesh
    only. The Standard Dark measurements (every bare cell fails, even
    AA_LARGE 3.0) remain valid and are an input to Phase 38.5.
-   **[SUPERSEDED by D-38 (owner, 2026-09-26)] D-36 --- The F-1 site
    list must be complete.** Required an AST enumeration of every bare
    foreground over the shell art, not the six-token grep of §5. The art
    brief's AST inventory (294 bare sites on 50 routes,
    `38.4-art-brief/bare-text-sites.csv`) is the current site list and
    an input to Phase 38.5.
-   **[DECIDED · 2026-09-26] D-37 --- Phase-close order.** All code
    plans through 38.4-20, then the gsd code review of the phase and its
    fixes, then the Plan 17 device pass on the reviewed code, then
    verification. The review runs between waves 6 and 7. Plan 17 re-runs
    the automated gate on HEAD but does not redo the review.

### Owner rulings after the background-art brief (2026-09-26)

-   **[DECIDED · 2026-09-26] D-38 --- Bare text on art leaves 38.4 for
    Phase 38.5.** Contrast of text sitting directly on the background
    art (finding F-1) moves to the new Phase 38.5, Background Art &
    Text-on-Art Contrast. D-38 supersedes D-29, D-35 and D-36. Plan 16's
    scrim task is cancelled, and Plan 17 records any bare-text
    observation as a Phase 38.5 input, never as a FAIL. The art brief
    (`38.4-BACKGROUND-ART-BRIEF.md`) showed that one image cannot serve
    both light and dark mode. D-12 still holds: no artwork, glass or
    veil change ships in 38.4. The Plan 16 accent-fill → `accentText`
    role swap still lands, including rows on bare art (ADR-084; brief
    OD-6). 38.4 still closes RG-029's glass proof
    (`ui-accessibility/AUD-UIA-001`) and the Backup/Restore role
    foregrounds (`ui-accessibility/AUD-UIA-002`); Phase 38.5 carries the
    bare-text part of RG-029's outcome.
-   **[DECIDED · 2026-09-26] D-39 --- Both packages keep both modes;
    separate light and dark art.** The earlier "theme merge" meant
    restricting backgrounds to their own package (Galaxy theme → Galaxy
    backgrounds, Standard → Standard), which is already implemented. It
    never meant collapsing the two packages into one Dark/Light switch.
    The fix direction for text on art is separate light and dark art per
    background: about 12 images if the owner cuts one background per
    theme, and Galaxy light mode may use different pictures rather than
    recoloured dark ones. Details are decided in Phase 38.5.
-   **[DECIDED · 2026-09-26] D-40 --- Scrims are not abolished; the
    owner picks each combination.** Buttons that open overlay menus (for
    example the Contacts top action buttons and the Orrery dropdown
    buttons) and the overlay menus themselves keep their scrims. The
    owner chooses a full, transparent or no scrim per component and per
    theme × mode × background from a screenshot sign-off sheet. A
    separate agent produces that sheet during 38.4 execution; no 38.4
    plan produces it. The signed sheet is a prerequisite for starting
    Phase 38.5.
-   **[DECIDED · 2026-09-26] D-41 --- User-uploaded backgrounds carry no
    contrast guarantee.** If a user's own picture (for example a contact
    profile background photo) makes text hard to read, the user picks a
    different picture, which is the industry-standard behaviour. There
    is no engineering to adapt text to arbitrary uploads.

### Owner rulings on the accounting list (2026-09-27)

-   **[DECIDED · 2026-09-27] D-43 --- Approvals and acceptances.** D-42
    (the orchestrator's 2026-09-26 Plan 18 additions: FAB-dial shell
    overlays hidden from accessibility, heatmap tap zones capped at the
    gap midpoint, `app.json` name/slug) and the Plan 03 OverflowMenu
    `UnscopedTheme` reset are owner-approved and stay. The Events copy
    "Try opening it again in a moment." and Your Week's sub-44dp cells
    below 366dp (the D-13 trade-off) are accepted. The D-31 keyboard
    cycle not being effective on the device is accepted, with no rework.
    The Settings hub glyphs and the launcher icon margin are still
    reviewed on the device.
-   **[DECIDED · 2026-09-27] D-44 --- AI Data Permissions counts agree
    with the list.** The access total stays the count of AI-enabled
    items. A list line states exactly what the list shows and how much
    of it AI can access, and each contact header states its own count.
    Plan 21.
-   **[DECIDED · 2026-09-27] D-45 --- The FAB gets a border on Backup
    settings only,** in a theme-token colour, so it stays distinct over
    that screen's accent buttons. Plan 25.
-   **[DECIDED · 2026-09-27] D-46 --- The Profile's Off Limits edit opens
    the Update Contact entry editor,** not the Fuel editor with its Kind
    picker. This changes ADR-150's editor-UI choice for the Profile
    path; its scoped-write safety (filtered reads, forced kind,
    validated edits and deletes) is kept. Fuel is not retired, and the
    Fuel editor stays in Create/Edit Contact. Its remaining uses go to
    the owner, and a superseding ADR is due at KB extraction. Plan 22.
-   **[DECIDED · 2026-09-27] D-47 --- The layout editor's live preview
    is hidden,** behind a flag rather than deleted. Plan 23.
-   **[DECIDED · 2026-09-27] D-48 --- The storage permission pair
    (`READ/WRITE_EXTERNAL_STORAGE`, `maxSdkVersion 32`) is removed only
    if proven 100% unused;** otherwise it is kept, with the evidence
    surfaced. Authored config only. Plan 24.
-   **[DECIDED · 2026-09-27] D-49 --- The resume-import and
    resume-check prompts scroll their body at large text,** and the
    pending-confirmations sheet is checked. Plan 23.
-   **[DECIDED · 2026-09-27] D-50 --- Native dialogs and pickers follow
    Orbit's light/dark mode.** Orbit's own System mode must keep
    following the device. No new native package without a checkpoint.
    Plan 24.
-   **[DECIDED · 2026-09-27] D-51 --- Contacts count vs List vs Card is
    investigated** within the G2 plan. The header count is by design the
    contacted-live count (Phase 26); a List/Card divergence is fixed.
    Plan 19.
-   **[DECIDED · 2026-09-27] D-52 --- Every FAB-bearing scrolling screen
    gets bottom clearance** so the last item scrolls clear of the FAB,
    enforced by a route-derived contract. Plan 25.
-   **[DECIDED · 2026-09-27] D-53 --- Not planned:** `npm audit` is
    triaged separately by the orchestrator; an import-time Bound/Unbound
    choice (E2) is excluded pending an owner question.

## Revision Log

-   2026-09-26 --- discuss session: grounding check (14/15 still
    present; UIA-019 fixed in 38.2); owner decisions D-08..D-16;
    TRIAGE.md selection recorded (RG-032 deferred to the widget
    overhaul).
-   2026-09-26 --- plan-phase intake: owner supplied launcher art and
    picked the Deep royal `#1A2F8A` background (D-21), and added the
    root-chrome consistency rulings D-22 (no Back on Events) and D-23
    (Digest shared header row).
-   2026-09-26 --- post-research: D-24 (RG-029 inventory-then-darken,
    answering research ESC-1); D-25 held open (W3 native remedy).
-   2026-09-26 --- Plan 03 execution: D-26 (all eight Standard-Light
    glass link variants), D-27 (F-1 to the device review; superseded by
    D-29) and D-28 (coral's shared light tone).
-   2026-09-26 --- after Wave 1: D-29..D-37 (F-1 scrim and its
    extensions, the filled duration chip, the FAB focus trap, gap plans
    18/19/20, the phase-close order).
-   2026-09-26 --- after the background-art brief: D-38 moves bare text
    on art to Phase 38.5 and supersedes D-29/D-35/D-36; D-39..D-41
    record the art, scrim-policy and custom-upload direction for 38.5.
-   2026-09-27 --- accounting-list rulings: D-43 approves D-42 and the
    Plan 03 OverflowMenu reset; D-44..D-52 add gap plans 21-25 and fold
    E1 into Plan 19; D-53 records what is not planned.
