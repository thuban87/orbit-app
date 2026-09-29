# Phase 38.5 --- Background Art & Text-on-Art Contrast Dossier

**Status:** DISCUSSED 2026-09-28 (D-17..D-29); ART SIGNED OFF 2026-09-28 (D-30..D-34). The O-9 spike PASSED on 2026-09-28; the phase is ready to plan. **Prerequisite:** the owner-signed scrim combination
sheet (38.4 D-40), **met 2026-09-27** (sign-off v2, D-08). Before planning, the O-9 `codex-edu` image spike still has
to run. Authored 2026-09-26 at phase insertion, from the owner rulings 38.4 D-38..D-41 and the 38.4 background-art
brief. Updated 2026-09-27 with the owner's scrim sign-off v2 results and rulings D-08..D-14. The phase is now sequenced
art-first (D-13), and the images are made by a Codex agent in a Claude-verified loop (D-14). A second round the same day
added D-15 (the owner confirms the ADR-115 supersession) and D-16 (a pearl planet limb as an exploration only). No
discuss session has run yet.

## Decision Legend

-   **[DECIDED]** explicitly chosen by the owner.
-   **[OPEN]** an owner decision still to be made (discuss-phase).
-   **[DERIVED]** a consequence of a decision or of a measured fact.
-   **[PLANNING NOTE]** a repository finding or engineering follow-up to verify at planning time.

**Numbering.** D-08..D-16 (2026-09-27), D-17..D-29 (discuss, 2026-09-28), D-30..D-35 (art sign-off, 2026-09-28/29) and D-36, D-37, D-42..D-45 (re-sign-off v3, 2026-09-29; D-38..D-41 skipped) are this phase's own rulings; they match the CONTEXT shim. The carried 38.4
rulings are D-38..D-41. Any other 38.4 decision is written "38.4 D-NN".

## Objective

Every piece of text over shipped background art is readable, meeting the WCAG floors (4.5:1 for text and links, 3:1 for
status glyphs and large text), in every theme × mode × background combination. The primary lever is the art itself:
separate light and dark versions of each background. Scrims apply only where the owner's signed-off combination sheet
puts them (D-08). Where the sheet thins or removes a backing over the art, the text on the art takes the colour that
suits the art (D-10). User-uploaded custom backgrounds are excluded.

## Why This Phase Exists

-   38.4 Plan 03's RG-029 inventory found functional text sitting directly on the veiled background art, with no glass
    and no opaque backing (finding **F-1**). It fails contrast.
-   38.4 first planned a scrim for it: D-29 (Standard Light, Dusk/Mesh), D-35 (Standard Dark, all four backgrounds) and
    D-36 (a complete AST site list). The scrim task was never executed.
-   The 38.4 background-art brief then showed that **one image cannot serve both light and dark mode** (numbers below).
    The owner moved the whole problem here (D-38).
-   This work belongs to RG-029's desired outcome, "functional content meets the approved contrast contract under real
    compositions." 38.4 closes RG-029's glass proof (`ui-accessibility/AUD-UIA-001`) and the Backup/Restore role
    foregrounds (`ui-accessibility/AUD-UIA-002`). This phase carries the bare-text remainder.

## Carried Decisions (owner, from Phase 38.4, 2026-09-26)

-   **[DECIDED · 2026-09-26] 38.4 D-38 --- Bare text on art leaves 38.4 for this phase.** The Plan 16 scrim task
    (D-29/D-35/D-36) is cancelled, and D-38 supersedes those three decisions. Bare text on art is not a 38.4 failure. 38.4
    ships no artwork, glass or veil change (38.4 D-12 still holds there). 38.4 Plan 16 still swaps accent-fill text
    misroles to `accentText`, including on bare art (ADR-084 role; the brief's bands assume it, OD-6).
-   **[DECIDED · 2026-09-26] 38.4 D-39 --- Both packages keep both modes; separate light and dark art.** Galaxy and
    Standard each keep a light and a dark mode. The earlier "theme merge" meant restricting backgrounds to their own
    package, which is already implemented. It never meant collapsing the packages into one Dark/Light switch; do not
    propose that. The fix direction is separate light and dark art per background. The owner may cut one background per
    theme, giving about 12 images (3 per package × 2 modes). Galaxy light mode may use **different pictures** rather than
    recoloured dark ones.
-   **[DECIDED · 2026-09-26] 38.4 D-40 --- Scrims are not abolished; the owner picks each combination from a sheet.**
    Buttons that open overlay menus (for example the Contacts top action buttons and the Orrery dropdown buttons), and
    the overlay menus themselves, keep their scrims. The treatment per combination (full scrim, transparent scrim or no
    scrim; per component, per theme × mode × background) comes from a **screenshot sign-off sheet**. A separate agent
    produces it during 38.4 execution. The owner-signed sheet is a **prerequisite for starting this phase**. The planner
    does not choose scrim placement. *(Signed 2026-09-27 as sign-off v2: see D-08.)*
-   **[DECIDED · 2026-09-26] 38.4 D-41 --- User-uploaded backgrounds are excluded.** Custom uploads (for example contact
    profile background photos) carry no contrast guarantee. If a user's picture makes text hard to read, the user picks a
    different picture, which is the industry-standard behaviour. There is no engineering to adapt text to arbitrary uploads.
-   **[DERIVED] Who decides, as in 38.4.** Any fix that retunes a protected hue (ADR-084), changes glass or veil opacity
    (ADR-115), or reverses a recorded ADR/HANDOFF decision is the owner's call. Art direction and look are the owner's.

## Owner Rulings (2026-09-27): Scrim Sign-off v2, Text Colour, Sequencing, Art Loop

These rulings come from the owner's answers on the scrim sign-off v2 page
(`https://claude.ai/artifact/Wexngm7U9WPPWNtkbnd1Vy`, "Orbit Scrim Sign-off v2") and his follow-up rulings the same day.
The raw answers are saved unmodified at `.planning/phases/38.5-background-art-text-contrast/38.5-scrim-signoff-v2.json`.
Where the two differ (corrections (a) and (b) below), this dossier is authoritative. The IDs D-08..D-14 match the
CONTEXT shim.

### D-08: the signed scrim table

-   **[DECIDED · 2026-09-27] D-08 --- Scrim sign-off v2: each component's treatment per theme × mode × background is the
    table below, with owner corrections (a) and (b).** This resolves O-5 and meets the D-40 prerequisite. The planner
    does not choose scrim placement (D-40). D-13 sequences a re-sign-off on the new art before any of it is built.

**What the sheet showed** (MEASURED from the sign-off page source):

-   Three shots per combination: Contacts (List), Contacts (Card) and Digest, at rest. They were captured on the Pixel 3a
    at font scale 1.15, **over the art that ships today** (before 38.5).
-   **full** means a solid backing; the art does not show through. **transparent** means a see-through glass backing; the
    art shows faintly through it. **none** means no backing; the element sits directly on the background art.
-   The sheet printed today's rule (ADR-115) on the page: backings go see-through only where the art tone matches the
    mode (Galaxy + Dark, Standard + Light), and turn solid in the other two pairings. On the None (solid colour)
    background, a see-through backing looks the same as a solid one.
-   Every choice started at the shipped value ("current"). In the matched pairings: List rows full, cards transparent,
    top buttons full, search + toggle full, count label transparent, both headers transparent, Digest content none. In
    the mismatched pairings: everything full except Digest content, which is none.
-   The components and their code today (component hints from the page; code references read on disk 2026-09-27):
    -   **List entries** are the List-view rows. Today they have a solid `colors.surface` fill in every combination
        (`src/components/ListRow.tsx:175`).
    -   **Card entries** are the Card-view cards, a `GlassSurface` with the ADR-115 mode-aware tint
        (`src/components/GridCard.tsx:216`).
    -   **Top buttons** are Population, Filters and Sort. Filters and Sort are solid; Population drops its fill while a
        population is selected.
    -   **Search + toggle** is the search field and the List/Card toggle. The toggle segments and the open search field are
        solid; the collapsed search icon has no backing.
    -   **Count label** is the "N contacts" pill, a `ChromeScrim` (`src/screens/HomeScreen.tsx:1608`).
    -   **Contacts header** ("Orbit" and ⋯) and **Digest header** ("Digest") are both `ShellAppBar`
        (`src/screens/HomeScreen.tsx:1729`, `src/screens/DigestScreen.tsx:239`).
    -   **Section headings** are Up Next, Horizon and Your Week, as plain text on the art.
    -   **Up Next items** are the rows and the "all caught up" text. **Horizon items** are the rows, sub-headings and the
        "more" link.
    -   **Your Week** is the heatmap module, with no panel behind it. Its period toggle and three totals tiles are solid,
        and its empty heatmap days are see-through.

**The signed table.** **Bold** marks a cell the owner changed from the shipped value. The rows follow the sheet's
order.

| Combination | List entries | Card entries | Top buttons | Search + toggle | Count label | Contacts header | Digest header | Section headings | Up Next items | Horizon items | Your Week |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Galaxy Light · Deep Space | **transparent** | **transparent** | full | full | **none** | **none** | **none** | none | none | none | none |
| Galaxy Light · Starfield | **transparent** | **transparent** | full | full | **none** | **none** | **none** | none | none | none | none |
| Galaxy Light · Nebula | **transparent** | **transparent** | full | full | **none** | **none** | **none** | none | none | none | none |
| Galaxy Light · Aurora | **transparent** | **transparent** | full | full | **none** | **none** | **none** | none | none | none | none |
| Galaxy Light · None (solid) | full | full | full | full | **none** | **none** | **none** | none | none | none | none |
| Galaxy Dark · Deep Space | ~~full~~ **transparent** (a) | transparent | full | full | transparent | transparent | transparent | none | none | none | none |
| Galaxy Dark · Starfield | **transparent** | transparent | full | full | transparent | transparent | transparent | none | none | none | none |
| Galaxy Dark · Nebula | **transparent** | transparent | full | full | transparent | transparent | transparent | none | none | none | none |
| Galaxy Dark · Aurora | **transparent** | transparent | full | full | transparent | transparent | transparent | none | none | none | none |
| Galaxy Dark · None (solid) | **transparent** | transparent | full | full | transparent | transparent | transparent | none | none | none | none |
| Standard Light · Dawn | **transparent** | transparent | full | full | **none** | **none** | **none** | none | none | none | none |
| Standard Light · Paper | full (b) | **full** (b) | full | full | **none** | **none** | **none** | none | none | none | none |
| Standard Light · Dusk | **transparent** | transparent | full | full | **none** | **none** | **none** | none | none | none | none |
| Standard Light · Mesh | **transparent** | transparent | full | full | **none** | **none** | **none** | none | none | none | none |
| Standard Light · None (solid) | **transparent** | transparent | full | full | transparent | transparent | transparent | none | none | none | none |
| Standard Dark · Dawn | **transparent** | **transparent** | full | full | **transparent** | **transparent** | **transparent** | none | none | none | none |
| Standard Dark · Paper | **transparent** | **transparent** | full | full | **transparent** | **transparent** | **transparent** | none | none | none | none |
| Standard Dark · Dusk | **transparent** | **transparent** | full | full | **transparent** | **transparent** | **transparent** | none | none | none | none |
| Standard Dark · Mesh | **transparent** | **transparent** | full | full | **transparent** | **transparent** | **transparent** | none | none | none | none |
| Standard Dark · None (solid) | full | full | full | full | full | full | full | none | none | none | none |

**Owner corrections (2026-09-27):**

-   **(a)** The raw answer for Galaxy Dark · Deep Space List entries was "full" (the shipped value). The owner says it was
    a fluke: it is **transparent**, the same as the other Galaxy Dark backgrounds.
-   **(b)** Standard Light · Paper's full List rows and full cards are **intentional**. The owner wants one combination
    with the full-scrim look. Most combinations are largely transparent or have no scrim. Do not make Paper match Dawn,
    Dusk and Mesh.

**The owner's notes on the sheet (verbatim):**

-   Galaxy Light · Deep Space, Starfield, Nebula and Aurora (the same note on all four): "The font needs to be switched
    from light to dark on all of these items we're switching from full scrim to none/transparent when the background is
    one of the dark ones. You can't currently see any of the headers on the digest and all of the font on the contact
    cards is currently black so when those turn transparent that will have to change to light font. Basically if the
    mode is light, even though font defaults to black in that mode it should remain white on areas where the background
    is if one of the dark backgrounds are chosen. Anywhere not on the background should retain the light mode default
    text colors I would think."
-   Standard Dark · Dawn, Paper, Dusk and Mesh (the same note on all four): "Similar to the entries at the top of this
    list, we'll need to change the font color on the components I'm changing here to favor the other side of the
    spectrum."
-   No other combination has a note. D-10 states the rule these notes describe.

**Reading the table** ([DERIVED], from the corrected table):

-   Top buttons and search + toggle are **full in all 20 combinations**.
-   Digest content (section headings, Up Next, Horizon, Your Week) is **none in all 20** (D-11).
-   The count label, the Contacts header and the Digest header have the **same value in every row**. The Digest header
    is not "Digest content"; it follows the table.
-   Across the art backgrounds, contact entries are see-through everywhere except Standard Light · Paper (b). On the
    None (solid) background, Galaxy Light and Standard Dark keep full entries.

### D-09 to D-12: what the answers mean

-   **[DECIDED · 2026-09-27] D-09 --- In Galaxy Light and Standard Dark, "transparent" contact entries are truly
    see-through.** This applies to the List rows and the Card-view cards on the four art backgrounds of each pairing.
    -   **Galaxy Light:** contact entries are truly transparent, like Galaxy Dark's card transparency, not frosted white.
        Text on them flips to light (D-10). Every other scrimmed component in Galaxy Light keeps the frosted-light look
        (on the art backgrounds that means the full top buttons and search + toggle; on None (solid) it also covers
        the full entries).
    -   **Standard Dark:** contact entries are likewise truly transparent (see-through), and their font flips to suit the
        art beneath (D-10). Every other scrimmed component keeps the slightly-black scrim where the table says
        transparent (the count label, both headers) and is fully black where it says full (top buttons, search +
        toggle, and everything on None (solid)).
    -   **[DERIVED] This reverses part of ADR-115, by the owner's choice.** ADR-115 keeps opaque cards in the mismatched
        package/mode pairings and rejects "Always-translucent cards" as an alternative. D-09 makes contact entries
        see-through in exactly those pairings. D-08 also makes the List rows see-through; today they are solid in every
        combination. Separately, D-08's **none** for the count label and both headers (every Galaxy Light background, and
        Standard Light's four art backgrounds) removes the local `ChromeScrim`/app-bar backing that ADR-115 gives bare
        chrome. The sheet showed
        today's rule on the page, and these are owner-bucket calls (D-06), so they are recorded as decided. Planning
        needs a new ADR that supersedes these parts of ADR-115 (and of ADR-087 where it still applies). Other content
        cards keep ADR-115 unless the owner rules otherwise (O-8). *(Confirmed by the owner as D-15.)*
-   **[DECIDED · 2026-09-27] D-10 --- Text on the art takes the colour that suits the art.**
    -   Wherever a component goes from full to transparent or none over the art, the text sitting on the art takes the
        colour that suits the art beneath it, not the mode's default. Examples (owner): white text over dark Galaxy art
        in Galaxy Light, and dark text over light art in Standard Dark.
    -   Text on a truly transparent contact entry (D-09) counts as text on the art.
    -   Text that is not on the art keeps the mode's default colours.
    -   Every colour still resolves through theme tokens (CLAUDE.md). See P-9 for how this interacts with the new art.
-   **[DECIDED · 2026-09-27] D-11 --- Digest content has no scrim anywhere.** Section headings, Up Next items, Horizon items
    and Your Week are "none" in every combination, including Galaxy Light and Standard Dark. The Digest content relies on
    D-10 and on the new art.
    -   **WATCH (owner): these Digest outliers must be checked during 38.5.** They are Galaxy Light, Standard Dark, and
        mixed art such as Dusk and Mesh. Today Dusk spans L\* 16.1–74.3 and Mesh 33.3–78.5 (brief §A.1, MEASURED). The
        plans must carry an explicit check for each outlier. A general look is not enough.
-   **[DECIDED · 2026-09-27] D-12 --- Contacts pop-up menus and all Orrery controls and menus: full scrim everywhere.**
    The Contacts pop-up menus (Population, Filters, Sort) and every Orrery control and menu keep a full scrim in every
    combination. This reaffirms D-40; the sheet stated it as already decided and did not ask it. The Orrery route's art
    stays out of scope (it forces `none`).

### D-13 and D-14: sequencing and who makes the art

-   **[DECIDED · 2026-09-27] D-13 --- Art first, then an owner pause, then a re-sign-off on the new art, then the scrim
    and text-colour work.** The phase runs in this order:
    1.  **New background art is produced first**, in the early plans (the D-14 loop).
    2.  **An owner review pause.** At minimum this is the blocking art sign-off checkpoint that ends the D-14 loop.
    3.  **A plan that redoes the scrim sign-off sheet on the new backgrounds.** Every v2 choice (D-08..D-12) is actually
        rendered or mocked, at least for the screens and components the owner changed (the bold cells in the D-08
        table).
    4.  **Only then the scrim and text-colour implementation plans.**
    -   Rationale (owner): scrims changed before the art would have to be redone.
    -   [DERIVED] The v2 table is the signed starting point. The implementation plans build from the re-signed sheet; if
        the owner changes a cell there, the newer answer governs.
-   **[DECIDED · 2026-09-27] D-14 --- Claude plans and builds; a Codex agent (Astra) makes the images.**
    -   The owner runs 38.5 discuss, plan and plan-review-convergence with Claude, as usual.
    -   **In execution, background image creation is done by a Codex agent.** The Claude orchestrator invokes it through
        the owner's `codex-edu` setup, model `gpt-6-astra` ("Astra"). Non-interactive form:
        `CODEX_HOME="$HOME/.codex-edu" codex exec -m gpt-6-astra ... < /dev/null`. The `codex-edu` shell alias does not
        exist in non-interactive shells, so use the environment-variable form.
    -   **The art task is an iterative loop:**
        1.  Claude hands Codex the art brief, the target bands, `check_art.py` and the owner's direction.
        2.  Codex produces the images.
        3.  Claude verifies them with `check_art.py`, `scripts/measure-background-extrema.py --check` and a visual review
            against the brief, and iterates with Codex until they pass.
        4.  **A blocking human checkpoint:** the owner reviews the images and either signs off or asks for changes. A
            change request loops back to step 2.
    -   **Claude does everything else:** code, asset wiring, extrema, tests, and the scrim and text-colour
        implementation.
    -   [PLANNING NOTE] `codex exec` practice (project memory):
        -   Always close stdin with `< /dev/null`; otherwise it hangs on "Reading additional input from stdin".
        -   Run with `--sandbox workspace-write`.
        -   Have Codex write its outputs to files. Constrain it in the prompt to the named output paths, then check
            `git status` for stray changes.
        -   `~/.codex-edu/config.toml` defaults to `gpt-6-sol` (MEASURED 2026-09-27), so pass `-m gpt-6-astra` explicitly.
    -   Whether this path can generate image files at all is open: see O-9.

### D-15 and D-16: ADR-115 supersession and the planet-limb exploration (2026-09-27, second round)

-   **[DECIDED · 2026-09-27] D-15 --- The owner supersedes the parts of ADR-115 that D-08/D-09 reverse, and 38.5 writes
    the superseding ADR.** This turns D-09's **[DERIVED]** note into an explicit owner ruling. The superseded parts are:
    -   contact entries (List rows and Card-view cards) truly transparent in Galaxy Light and Standard Dark, where ADR-115
        keeps opaque cards in the mismatched package/mode pairings and rejects "Always-translucent cards";
    -   List rows see-through where the sign-off says T (they are solid in every combination today);
    -   no backing on the count label, the Contacts header and the Digest header where the sign-off says N, where ADR-115
        gives bare chrome a local `ChromeScrim`/app-bar backing.
    -   The new ADR also covers ADR-087 where it still applies. Other content cards keep ADR-115 unless the owner rules
        otherwise (O-8).
-   **[DECIDED · 2026-09-27] D-16 --- A pearl planet limb may be made as an exploration, not a commitment.** The owner is
    open to having it created and looking at it (O-2's concept idea).
    -   The Phase 31 art rule that excludes planets (restated in brief §I: no horizons, planets or recognisable imagery) is
        **relaxed for this exploration only**. It is not relaxed for shipped art.
    -   Shipping a planet-limb image, or relaxing the rule for shipped art, needs a later owner decision: the D-14 blocking
        art sign-off at the earliest.
    -   O-2 (the Galaxy light-mode imagery concept) stays OPEN.

## Discuss-Session Rulings (2026-09-28)

From the owner's gsd-discuss-phase session. They resolve O-1, O-3, O-4 (conditionally), O-6 and O-8, and set the
approach for O-2. The IDs D-17..D-29 match the CONTEXT shim. The full question-and-answer record is in
`.planning/phases/38.5-background-art-text-contrast/38.5-DISCUSSION-LOG.md`.

### The lineup (O-1, O-6)

-   **[DECIDED · 2026-09-28] D-17 --- Galaxy keeps three slots, graded by how busy the image is.** This resolves O-1 for
    Galaxy and O-6.
    -   **Quiet:** a **new** image. Not busy, but still obviously galaxy.
    -   **Medium:** **Aurora**, kept. Owner: "a nice little ribbon that's noticeable but not overpowering."
    -   **Busy:** **Starfield reborn**, with stars you can actually see this time.
    -   **Cut:** Deep Space, Nebula and today's Starfield image. Owner: Deep Space and Starfield "are both basically blank
        anyways, just black pictures in the app."
    -   Each slot gets a light and a dark version (38.4 D-39), so Galaxy ships 6 images.
-   **[DECIDED · 2026-09-28] D-18 --- Standard cuts Mesh.** Standard keeps Dawn, Paper and Dusk, and ships 6 images (a
    light and a dark version of each). This resolves O-1 for Standard.
    -   [DERIVED] The Mesh rows of the D-08 table become moot. The D-11 WATCH outliers are now Galaxy Light, Standard Dark
        and Dusk.
    -   [DERIVED] Standard Light · Paper keeps its intentional full-scrim look (D-08 b).
-   **[DECIDED · 2026-09-28] D-19 --- The new quiet image becomes the Galaxy default,** replacing Deep Space. Standard
    keeps Dawn as its default.
    -   [PLANNING NOTE] A persisted or restored id for a cut slot (Deep Space, Nebula, Mesh) must resolve safely to the
        package default (P-4, ADR-113).
    -   Whether the reborn Starfield reuses the `galaxy-starfield` slot id is a planning detail.

### Art direction (O-2, O-3) and the picker

-   **[DECIDED · 2026-09-28] D-20 --- Visible features versus the band: Codex tries both, and the owner decides at the
    art sign-off.**
    -   The strict bands leave the Galaxy Dark art nearly invisible (L\* ≤ 8.2, or ≤ 18.5 under D-24). The busy Starfield's
        visible stars and a noticeable Aurora ribbon break a strict 0.00%-failing-pixels rule wherever text crosses them.
    -   So, for the affected slots, Codex paints a **strict** version and a **visible-features** version. The owner picks
        at the blocking D-14 art sign-off, **with the failing-pixel percentage shown for each**.
    -   The same applies to dark specks on pale art (for example "negative" stars in Galaxy Light).
    -   [DERIVED] If a visible-features version ships, the owner has accepted an allowance for small features at that
        sign-off. The H1 acceptance (`check_art.py`) and the P-1 proof must then encode that allowance, not 0.00%.
-   **[DECIDED · 2026-09-28] D-21 --- Galaxy Light and Standard Dark: Codex explores two routes per slot, and the owner
    picks at sign-off.** This sets the approach for O-2; the concepts themselves are chosen at the art sign-off.
    -   **Route 1:** a pale (Galaxy Light) or deep (Standard Dark) version of the same idea as the slot's other image. For
        example, Starfield as a pastel field with star glints.
    -   **Route 2:** a different picture in the same busyness tier. For example, a pastel nebula with white star glints.
    -   The pearl planet limb (D-16) is one exploration candidate. Shipping it is still a later owner decision.
    -   The owner's Galaxy Light seed idea was a pale or "negative" version of each dark image (for example white with dark
        stars). He was unsure it is the best idea; Route 1 covers it.
-   **[DECIDED · 2026-09-28] D-22 --- The pale Standard Light band is accepted as the target (O-3).** The whole image sits
    at about L\* 89–97 (brief §E.2). The look is confirmed at the art sign-off.
-   **[DECIDED · 2026-09-28] D-23 --- The picker: one pick per theme, and it follows the mode.**
    -   The user picks a slot once per theme (Galaxy, Standard). The app shows that slot's light or dark version
        automatically, following the mode.
    -   There is **no new persisted setting and no migration**. `app_settings.galaxy_background` /
        `standard_background` keep storing the slot id.
    -   The picker preview shows the version for the current mode.
    -   [DERIVED] Assets resolve by slot × mode (P-3). This supersedes the one-asset-per-slot part of ADR-087/ADR-113 in
        the new ADR (D-15).

### Contrast rules (O-4, P-9)

-   **[DECIDED · 2026-09-28] D-24 --- E-1 extends to bare text only if the red text is a minority (O-4).**
    -   **Metric:** red `danger` bare text sites divided by all bare text sites, on the re-verified site list (P-6).
    -   **Under 10%:** E-1 extends to bare text. The Galaxy Dark art ceiling is L\* 18.5, and `check_art.py` runs with
        `--exclude-galaxy-dark-danger`.
    -   **10% or more:** strict. The ceiling stays at L\* 8.2.
    -   Today's figure is 27 / 294 ≈ 9.2%. The list is partly ESTIMATED, so the figure is not decisive yet.
    -   [PLANNING NOTE] Measure it in the first plan, before the art brief goes to Codex, because it sets the Galaxy Dark
        band.
    -   [DERIVED] Under E-1, red error text over the brightest Galaxy Dark art falls to about 3.5:1 (COMPUTED roughly from
        L\* 18.5, veil ignored): below 4.5:1, but still at or above 3:1.
-   **[DECIDED · 2026-09-28] D-25 --- Scrims on red strings are not decided now; they go to the end-of-phase gap list.**
    -   The owner would consider scrims on red strings only if text still fails **after he has seen the new art with text
        on it**.
    -   At the end of the phase, the executor reports the percentage and the failing strings, with a recommendation. The
        owner then decides whether a gap plan adds them.
    -   Nothing in the initial plans adds these scrims.
-   **[DECIDED · 2026-09-28] D-26 --- The text colour is one choice per combination (P-9).**
    -   Each component gets one foreground per theme × mode × background, set by that combination's new art (D-10).
    -   There is no per-region colour change; that is the parked O-7 idea.

### Scope edges and sequencing (O-8, P-10, O-9)

-   **[DECIDED · 2026-09-28] D-27 --- The re-sign-off sheet covers every Contacts and Digest cell.** This refines D-13.
    -   **Scrim choices:** every Contacts and Digest component, for every new combination. That is 16 combinations: (3 art
        backgrounds + None) × 2 modes × 2 themes.
    -   **Look-only gallery:** a few routes heavy in bare text, with **no scrim choices** there (D-40).
    -   **Card-blend (O-8):** a "more see-through than today" variant of the see-through entries, to compare over the new
        art. The owner decides card-blend on the sheet.
-   **[DECIDED · 2026-09-28] D-28 --- Nothing changes outside the components the owner marked in v2.**
    -   Owner: "We're not changing anything outside of what I indicated unless there's good reason to, and I'm not blanket
        signing off on that now without any new art."
    -   Cards and chrome on the other screens keep today's treatment. That includes ADR-115's opaque cards in Galaxy Light
        and Standard Dark, even once the art there matches the mode.
    -   If a planner or executor finds a good reason to change one, it goes to the **end-of-phase gap list** for the owner,
        over the new art. It does not go into a plan.
    -   The Orrery controls and menus, and the Contacts Population/Filters/Sort overlays, stay **full**. Owner: "seeing
        through those looks terrible" (reaffirms D-12).
    -   [DERIVED] The superseding ADR (D-15) supersedes only the D-15 parts plus the D-23 asset model. The rest of ADR-115
        stands.
-   **[DECIDED · 2026-09-28] D-29 --- The O-9 spike runs right after this discuss session, before planning.** The Claude
    orchestrator runs it with one throwaway image written to a named scratch path. If it fails, the owner decides the
    fallback (O-9).

### End-of-phase gap list (owner review, after the new art)

Items routed here are **not** planned up front. At phase end, the executor reports each one with its measurements and a
recommendation. The owner then decides whether a gap plan picks it up.

-   Scrims on red `danger` strings in Galaxy Dark, if E-1 is extended and strings still fail (D-25).
-   Any proposed change to a component outside the v2-marked set (D-28).
-   The active Population/Filters/Sort buttons draw no fill today (H-3, I1). The v3 sheet showed this for information;
    it was not ruled there (D-45).
-   Report deferred items to the owner as soon as they are found (project practice); do not hold them silently until
    phase end.

## Art Sign-off (2026-09-28)

The owner's blocking art sign-off (D-14 step 4; plan 38.5-04 Task 3), given across three messages on 2026-09-28 after
four Codex rounds. The IDs D-30..D-34 match the CONTEXT shim. The full record, with the owner's words verbatim, the
per-cell checker results on the shipped files, the P-7 sizes and the machine-readable allowance block, is
`.planning/phases/38.5-background-art-text-contrast/38.5-ART-SIGNOFF.md`.

-   **[DECIDED · 2026-09-28] D-30 --- The 12 images (resolves O-2's concepts; confirms D-22's look).** One pick per slot ×
    mode; each ships as `assets/backgrounds/<slot>-<mode>.webp`.
    -   **galaxy-quiet:** dark DeepSpace-D1 (`galaxy-quiet-dark-base-strict-r1`); light DeepSpace-L1
        (`galaxy-quiet-light-route1-strict-r2`, route 1).
    -   **galaxy-aurora:** dark Aurora-D7 (`galaxy-aurora-dark-base-strict-r4e`); light Aurora-L1
        (`galaxy-aurora-light-route1-strict-r2`, route 1).
    -   **galaxy-starfield:** dark Starfield-D3 (`galaxy-starfield-dark-base-visible-r3`, visible features); light
        Starfield-L5 (`galaxy-starfield-light-route2-visible-r4d`, route 2, visible features).
    -   **standard-dawn:** dark Dawn-D1 (`standard-dawn-dark-route1-strict-r2`, route 1); light Dawn-L1
        (`standard-dawn-light-base-strict-r0`).
    -   **standard-paper:** dark Paper-D5 (`standard-paper-dark-route1-strict-r4f`); light Paper-L2
        (`standard-paper-light-base-strict-r4a`). D5 was made as the dark partner of a different paper than L2; the
        pairing is the owner's explicit choice.
    -   **standard-dusk:** dark Dusk-D1 (`standard-dusk-dark-route1-strict-r2`, route 1); light Dusk-L2
        (`standard-dusk-light-base-strict-r4a`).
    -   **Galaxy Dark Aurora is a new image (Aurora-D7), not the remaster of today's image.** The owner first picked the
        round-3 visible Aurora-D3; told its ribbon drops `textSecondary` to about 2.2:1, he asked for it dimmed and picked
        the strict round-4 D7. So no broad-feature exclusion exists.
    -   Rejected on the way: every round-1/2 Paper ("None of the papers have a paper texture, arguably the defining piece
        of that type of art") and the round-1 Dusk light ("has virtually no anything in it. It's basically just a white
        background").
    -   [DERIVED] Every shipped file is pixel-identical to its approved master and passes H1 and H2 (`--margin 0.1`) as
        shipped. The ten strict images have no failing pixel.
-   **[DECIDED · 2026-09-28] D-31 --- The Starfield feature allowance: 18 px / 0.5%, Starfield only; no exclusions.**
    -   Owner: "Failing on 0.17% of the screen is infinitesimal, I'm fine with that, but an upper band of 0.5% is fine
        too. The star sizes are fine, going 5x bigger would be a massive mistake anyways so don't do that, 2x bigger at
        the absolute max but that should be rare".
    -   `featureAllowance { maxComponentPx: 18, maxFailingPct: 0.5 }` for galaxy-starfield dark and light. 18 px is twice
        Starfield-D3's largest failing star (9 px); Starfield-L5's largest is 13 px. D3 fails on 0.170% of the canvas,
        L5 on 0.028%.
    -   No other allowance. **No exclusion** (the accepted-exclusions block's `exclusions` is empty).
    -   **Addendum (2026-09-29): the declared Starfield bounds.** The code declares light `darkestPixel` `#D3DDE0` and
        dark `brightestPixel` `#262452`, not the checker's channel-wise `#CED9DC` / `#2C2868`. Each sits in an empty
        luminance band of its own file, so the same pixels are text-bearing: `--check` reproduces the signed unions
        (2,680 px / 0.170% dark; 446 px / 0.028% light). The dark bound is luminance-valid, not channel-wise. The
        allowance is unchanged. Owner, on the code review's WR-02 (2026-09-29): "Accepted and noted". Record:
        `38.5-ART-SIGNOFF.md` §5.
-   **[DECIDED · 2026-09-28] D-32 --- The pearl planet limb is shelved (D-16).** Owner: "I do not care for whatever the
    hell you made here no. Let's shelve this and I can revisit another time". It is not transcoded, committed or wired;
    the no-planets rule stands for every shipped image.
-   **[DECIDED · 2026-09-28] D-33 --- Labels.** The new quiet Galaxy slot is labelled **"Deep Space"**. Its id stays
    `galaxy-quiet`; the existing `galaxy-deep-space` id is still retired by 38.5-05 (only the label is reused). Aurora and
    Starfield keep their names in both modes.
-   **[DECIDED · 2026-09-28] D-34 --- No backup-format bump.** The owner agreed with the recommendation: the slot id stays
    in the same keys and nothing on the wire changes.
-   **[DECIDED · 2026-09-29] D-35 --- The Aurora art is mirrored left↔right, both modes (amends D-30).** Owner, verbatim:
    "I need the image mirrored. I was feeling weird about the ribbon in the image being only on one side but couldn't
    put my finger on why and now it's obvious: most of the app's visual content is on the left of the screen, same side
    as the ribbon, while the right side is relatively content-free. Meaning the ribbon sits behind the contact names and
    pictures on the list view of contacts and the digest pages. If we mirror the image so the ribbon is exactly the same
    but on the right side and inverted, I think that would look "stellar" so to speak :P ... I'm not saying to
    regenerate the image, literally just mechanically flip the image. Both light and dark would need this treatment."
    -   `galaxy-aurora-dark.webp` (Aurora-D7) and `galaxy-aurora-light.webp` (Aurora-L1) are flipped horizontally on the
        decoded pixels, not regenerated, and re-saved as lossless WebPs the same way as D-30. Each is pixel-identical to
        `np.fliplr` of the previous file.
    -   [DERIVED] A mirror leaves the pixel set unchanged: H1 and H2 still PASS with no failing pixel, and the declared
        extrema still enclose every regime (`measure-background-extrema.py --check`). Record: `38.5-ART-SIGNOFF.md` §4.

## Re-sign-off v3 (D-13 step 3)

These rulings are the owner's re-sign-off over the new art (D-13 step 3, D-27; plan 38.5-07 Task 3). He gave them on
the page <https://claude.ai/artifact/1de2g31puEfn7w3wCNKMZU> ("Orbit Scrim Sign-off v3") and amended and confirmed them
in chat the same day, 2026-09-29. Where the chat differs from the page, the chat governs.

-   **Record:** `.planning/phases/38.5-background-art-text-contrast/38.5-SIGNOFF-V3.md` has the shots shown, every
    changed cell, the rung values and the owner's words verbatim.
-   **Assembled answer:** `38.5-scrim-signoff-v3.json`, the file 38.5-08's sync test reads.
-   **Raw page data:** `38.5-scrim-signoff-v3.raw-db.json`.
-   **Numbering:** the IDs match the CONTEXT shim. D-38..D-41 are skipped because this dossier already uses them for
    the carried 38.4 rulings. Under D-13, the newer answer governs: where these rulings differ from D-08..D-10, they
    win.

-   **[DECIDED · 2026-09-29] D-36 --- The re-signed scrim table for the 16 new combinations (supersedes the D-08 table for
    the new lineup).** The owner reviewed every combination (`reviewed: true` on all 16). Ten cells change from the
    mapped v2 values (D-08 with corrections (a)/(b), Mesh dropped, the Galaxy art rows carried to the new slots):
    -   **Standard Dark · Dawn, Paper, Dusk:** the Contacts header and the Digest header go from transparent to
        **none** (page). Their count label stays transparent, at the D-37 level of 0.
    -   **Standard Light · None:** List entries and Card entries go from transparent to **full** (page).
    -   **Galaxy Dark · None:** List entries and Card entries go from transparent to **full** (chat).
        -   Owner, before seeing it: "Galaxy dark - no background might need full scrims on the contact rows and cards
            ... If it's the same dark grey as what I see on the SD-None option, then let's do full ... for the GD-None
            as well."
        -   On the render: "The GD-None looks good with the full scrim. I meant full scrim, not full transparency, so
            you got it right here".
    -   The other 11 combinations keep the mapped v2 values. Owner: "11 combinations I didn't mention are in fact good,
        confirmed".
    -   [DERIVED] Every changed cell is on one of the five table-driven components (List entries, Card entries, count
        label, Contacts header, Digest header). 38.5-08 needs no new table-driven component. Top buttons and
        search + toggle stay full, and Digest content stays none, in all 16 combinations (D-11, D-12).

    **The v3 table.** **Bold** marks a cell changed from the mapped v2 value. The see-through levels are in D-37.

| Combination | List entries | Card entries | Top buttons | Search + toggle | Count label | Contacts header | Digest header | Section headings | Up Next items | Horizon items | Your Week |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Galaxy Light · Deep Space | transparent | transparent | full | full | none | none | none | none | none | none | none |
| Galaxy Light · Aurora | transparent | transparent | full | full | none | none | none | none | none | none | none |
| Galaxy Light · Starfield | transparent | transparent | full | full | none | none | none | none | none | none | none |
| Galaxy Light · None (solid) | full | full | full | full | none | none | none | none | none | none | none |
| Galaxy Dark · Deep Space | transparent | transparent | full | full | transparent | transparent | transparent | none | none | none | none |
| Galaxy Dark · Aurora | transparent | transparent | full | full | transparent | transparent | transparent | none | none | none | none |
| Galaxy Dark · Starfield | transparent | transparent | full | full | transparent | transparent | transparent | none | none | none | none |
| Galaxy Dark · None (solid) | **full** | **full** | full | full | transparent | transparent | transparent | none | none | none | none |
| Standard Light · Dawn | transparent | transparent | full | full | none | none | none | none | none | none | none |
| Standard Light · Paper | full | full | full | full | none | none | none | none | none | none | none |
| Standard Light · Dusk | transparent | transparent | full | full | none | none | none | none | none | none | none |
| Standard Light · None (solid) | **full** | **full** | full | full | transparent | transparent | transparent | none | none | none | none |
| Standard Dark · Dawn | transparent | transparent | full | full | transparent | **none** | **none** | none | none | none | none |
| Standard Dark · Paper | transparent | transparent | full | full | transparent | **none** | **none** | none | none | none | none |
| Standard Dark · Dusk | transparent | transparent | full | full | transparent | **none** | **none** | none | none | none | none |
| Standard Dark · None (solid) | full | full | full | full | full | full | full | none | none | none | none |

-   **[DECIDED · 2026-09-29] D-37 --- The see-through levels (resolves the D-06/D-09 opacities).** "transparent" means
    a `surface` tint at these opacities.
    -   **Galaxy Light:**
        -   List rows **0.05**, Cards **0.05** (rung R2, "like Galaxy Dark's card transparency").
    -   **Galaxy Dark:**
        -   List rows **0.05** (R2).
        -   Cards **0.05** (today's level, kept; see D-42).
        -   Count label and headers **0.05** (today's level; not asked).
    -   **Standard Light:**
        -   List rows **0.05** (typed on the page; not a rung).
        -   Cards **0.05** (see D-42).
        -   Count label and headers **0.50** (today's level; not asked; used only on None).
        -   Owner on the List rows: "Let's keep these the same as the galaxy light options so you can actually see the
            nice new backgrounds."
    -   **Standard Dark:**
        -   List rows **0.05** and Cards **0.05** (R2).
        -   The "slightly-black" count label **0** (rung R1). A 0% see-through backing draws no visible tint; this is
            the owner's pick.
    -   **Off-ladder values.** Standard Light List rows 0.05 and Cards 0.05 were rendered on Dawn and Dusk and
        contrast-checked (`art-signoff-candidates.ts --check-value`: `contrastSafe: true`, no failures, COMPUTED).
        The owner confirmed them on the render: "The SL-Dawn and Dusk look great on the 5% scrims, keep new value".
-   **[DECIDED · 2026-09-29] D-42 --- Card-blend (resolves O-8, per D-27/D-28).** This covers the Contacts card entries
    only; other content cards keep ADR-115.
    -   **Galaxy Dark cards: keep today's level** (0.05).
    -   **Standard Light cards: 0.05**, more see-through than today's 0.50.
        -   On the page the owner chose the 0% variant.
        -   In chat: "For Q3b, I'd prefer to keep these the same as the galaxy list rows actually, let's do 5% even
            though I marked 0%".
    -   [DERIVED] 38.5-08 sets the Standard Light `cardEntry` see-through group to 0.05 and leaves
        `CARD_GLASS_OPACITY.standard` (other cards) unchanged.
-   **[DECIDED · 2026-09-29] D-43 --- The ⋯ in the Contacts header follows the header (resolves the D-04 vs D-08
    tension).**
    -   Wherever the Contacts header has no backing, the ⋯ has none either; there is no local backing. With D-36 that
        covers every Galaxy Light background, Standard Light Dawn/Paper/Dusk and Standard Dark Dawn/Paper/Dusk.
    -   D-04 keeps scrims on buttons that open overlay menus. For this one button on a bare header, the owner chose
        "follow" over a local backing. This is his ruling on the collision, which the sheet asked explicitly
        (research Open Question 2).
    -   The Population/Filters/Sort buttons and every overlay menu keep their full scrims (D-12, unchanged).
-   **[DECIDED · 2026-09-29] D-44 --- Text on the see-through contact entries uses the mode's default colours (amends
    the D-09/D-10 text flip for the new art).**
    -   Galaxy Light and Standard Dark both answered "mode". The new art already matches each mode, so no entry text
        flips.
    -   No cell carries an inverse foreground. 38.5-08 builds no inverse palette and records that D-10 resolved to the
        mode default on mode-matched art.
-   **[DECIDED · 2026-09-29] D-45 --- The WATCH Digest outliers are accepted (D-11).** The owner checked Galaxy Light,
    Standard Dark and Dusk and answered "ok".
    -   His note, verbatim: "I indicated to remove the header scrims from pretty much everything with I think 1-2
        exceptions. So that's off in these shots but otherwise they look good."
    -   [DERIVED] The WATCH shots were taken at the v2 values, before his D-36 header changes. The Digest content was
        accepted as shown.
    -   **Not ruled here:** the active Population/Filters/Sort buttons have no fill today (H-3, I1). The sheet showed
        this for information only. It stays on the end-of-phase gap list (D-28).

## Primary Input: the 38.4 Background-Art Brief

**Path:** `.planning/phases/38.4-audit-remediation-ui-performance-release/38.4-BACKGROUND-ART-BRIEF.md`. The supporting
files are in `38.4-art-brief/` next to it: per-image heat maps, band example sheets (`band-examples-galaxy.png`,
`band-examples-standard.png`), CSV grids, the bare-site list `bare-text-sites.csv` and the self-check script `check_art.py`.
It was written against `738ae12`. Its numbers carry MEASURED / COMPUTED / ESTIMATED labels; keep them.

### Target art bands per package × mode (brief §E.2; presentation veil, pre-veil art; COMPUTED)

| Package × mode | Allowed art lightness | Grey edge | Binding colour | Design target | If red `danger` were exempt (E-1 extended) |
|---|---|---|---|---|---|
| Galaxy Dark | L\* ≤ 8.2 | `#181818` | `danger` `#E5484D` | L\* 0–6 | L\* ≤ 18.5 (`#2D2D2D`); target ≤ 16 |
| Galaxy Light | L\* ≥ 87.1 | `#DADADA` | coral link `#AC3925` | L\* 89–97 | same |
| Standard Dark | L\* ≤ 21.7 | `#343434` | `danger` `#FF6B6B` | L\* 3–19 | `textSecondary` ≤ 24.4 |
| Standard Light | L\* ≥ 86.7 | `#D9D9D9` | coral link `#AC3925` | L\* 89–97 | same |

-   **No single band works across modes** (brief §E.4). For Galaxy the ranges are ≥ 87.1 vs ≤ 8.2 (or 18.5); for Standard,
    ≥ 86.7 vs ≤ 21.7. Even with `textPrimary` as the only bare colour they do not overlap: Galaxy ≥ 55.5 vs ≤ 45.2,
    Standard ≥ 53.2 vs ≤ 46.8. That is why D-39 chose separate light and dark art.
-   A denser veil barely helps (§E.3). Bare text also appears on presentation-density routes, so the presentation band
    governs.
-   Art that meets its bare band keeps every existing card and app-bar proof passing, because those ranges are looser (§D).

### How far the current art is from its band (brief §F; COMPUTED from MEASURED pixels)

-   **Galaxy art** passes Galaxy Dark except red `danger` text on the brightest wisps (under 0.1% to 1.3% of pixels). It fails
    Galaxy Light on 100% of pixels.
-   **Standard art** fails Standard Light on 94–100% of pixels, **including Dawn and Paper** (brief OD-3). Bare
    `textSecondary` is 2.95:1 on Dawn and 2.60:1 on Paper. It fails Standard Dark on 87–100% of pixels.
-   Standard Dark bare ratios per density are tabulated in 38.4 CONTEXT D-35. Every cell fails, including 3:1.

### Bare-text inventory (brief §C)

-   **294 bare sites across 50 routes.** 100 are VERIFIED (the render chain was read by hand) and 194 are ESTIMATED
    (AST-traced, not hand-read). There are also 24 components that are bare only under some parents (all verified).
-   Colours that sit bare: `textSecondary` 142, `textPrimary` 105, `danger` 27, accent **fill** used as text 23 (a misrole;
    14 at 4.5:1 and 9 at 3:1, 8 of them spinners), `accentText` 21 (19 are tertiary buttons, including header Back buttons).
-   **Placement does not help** (§G). Bare text spans nearly the full width (x = 16 … W−16 dp), and 62% of it sits in
    scrolling content over fixed art. Equalizing each image's luminance range has to carry the fix.
-   The Profile route has its own heavy `profileBackgroundScrim` (about 0.72–0.77 opaque), so its 9 bare rows are not in
    the shell bands. The Orrery route forces the `none` background and is out of scope.

### Art format and acceptance (brief §H, §I)

-   941 × 1672 px portrait, sRGB, no alpha, lossless WebP (or a lossless PNG master). Only the central 717 px (x 112–829)
    is guaranteed to show on every phone, and foldables crop top and bottom, so the band must hold over the whole canvas.
    File names are the slot ids; the naming for the light/dark sets is settled together with the code change.
-   Acceptance: H1 `check_art.py` passes on the final shipped WebP in each target mode; H2 it also passes with
    `--margin 0.1`; H3 the measure script plus the `darkestPixel`/`brightestPixel` update, then `--check`; H4
    `surface.test.ts` and `backgrounds.test.ts` green; H5 a bare-text proof (does not exist yet, see P-1); H6 owner look
    sign-off on the Pixel 6 Pro and Pixel 3a.
-   The brief's original request to Codex ("pending OD-1") was one band per package. **[DERIVED]** D-39 chose the brief's
    option OD-1(a), so the deliverable is a light **and** a dark set per kept background.

## Open Items (owner, for the discuss-phase)

**Status 2026-09-27:** the owner restated O-1, O-2, O-4 and O-7 as still open; O-7 is parked as a later experiment.
O-5 is resolved by D-08, and O-9 is new. O-3, O-6 and O-8 are unchanged (O-8 has a scope note).

-   **[DECIDED · 2026-09-28 → D-17/D-18] O-1 --- Which background to cut per theme.** *Resolved: Galaxy cuts Deep Space and Nebula, and replaces Starfield; Standard cuts Mesh.* The owner may cut one per package (4 → 3), giving about 12 images.
    Which one in each package?
-   **[DECIDED · 2026-09-28 → D-21/D-30/D-32] O-2 --- Galaxy light-mode imagery.** *Codex explored both routes per slot; at the art sign-off the owner picked route 1 for quiet and Aurora and route 2 for Starfield (D-30), and shelved the planet limb (D-32).* D-39 allows different pictures rather than recoloured dark art. Capture
    the owner's own ideas for what Galaxy light pictures should be. The brief's pale-Galaxy remaps
    (`band-examples-galaxy.png`) are mechanical feasibility previews, not a proposal.
    -   **Owner concept ideas (2026-09-27; still OPEN, not choices):** a pastel nebula with white star glints, and a pearl
        planet limb.
    -   [PLANNING NOTE] The Phase 31 prompt rules, restated in brief §I, exclude horizons, planets and recognisable
        imagery. A planet limb would need the owner to relax that rule for Galaxy Light. *(2026-09-27, D-16: relaxed for
        an exploration only; the planet limb may be made and shown to the owner, and shipping it is a later owner
        decision.)*
-   **[DECIDED · 2026-09-28 → D-22] O-3 --- Standard light pale band.** *Accepted as the target; the look is confirmed at sign-off.* Owner leaning (2026-09-26), **not a decision**: the pale remaps in
    `band-examples-standard.png` look acceptable in principle. Discuss before it becomes a decision. The band puts the whole
    image at about L\* 89–97.
-   **[DECIDED (conditional) · 2026-09-28 → D-24/D-25] O-4 --- Galaxy Dark red error text (exclusion E-1).** *Extend if red sites are under 10%; red-string scrims go to the end-of-phase gap list.* Should ADR-084's owner-accepted Galaxy Dark `danger`
    `#E5484D` limitation (E-1, today cards and chrome only; `38.4-RG029-INVENTORY.md` §4) extend to bare text? If yes, the
    Galaxy Dark art ceiling is L\* 18.5 and today's Galaxy art already passes everything else. If no, it is L\* 8.2. The
    owner asked for this question to be clarified (brief OD-4).
-   **[DECIDED · 2026-09-27 → D-08] O-5 --- Scrim sign-off sheet outcome (D-40).** Which components get a full scrim, a
    transparent scrim or no scrim in each theme × mode × background. This is a prerequisite: planning does not start
    without the signed sheet. **Resolved by D-08** (sign-off v2, with D-09..D-12). A re-sign-off on the new art is
    sequenced inside the phase (D-13).
-   **[DECIDED · 2026-09-28 → D-17] O-6 --- Deep Space / Starfield replacement.** *Both current images go; Starfield returns as the busy slot.* The owner said these two Galaxy images are too dark anyway and
    plans to change two Galaxy images (brief OD-5). Which images are replaced, and does this overlap the O-1 cut?
-   **[OPEN] O-7 --- Owner idea: dynamic text colour ("stained-glass layers").** The owner's idea, recorded as described:
    -   Regions of each background image are mapped as **layers**.
    -   Each layer has a **"tinted window"** that sets the colour of any text passing between the art and that window.
    -   Constraints keep it workable, for example a minimum region size and no sharp turns in a region's outline.
    -   Text changes colour as it scrolls from one region into another.
    -   The owner asked whether this is a phase-sized feature or a milestone-sized one. **Feasibility assessment pending**
        (the orchestrator is preparing it). Not decided and not scoped into this phase yet.
    -   *Context from the brief (facts, not an assessment):* the art is fixed while content scrolls over it; the `cover`
        crop differs per device (for example Pixel 3a x 63–878 vs Pixel 6 Pro x 84–857 of the 941 px width, and
        foldables crop top and bottom); bare text spans nearly the full width.
    -   **Status 2026-09-27:** parked as a later experiment. It is still OPEN and not in 38.5 scope. D-10's text-colour
        rule is a separate, decided rule and does not implement this idea.
-   **[DECIDED · 2026-09-28 → D-27/D-28] O-8 --- Card-blend (more translucent content cards).** *Decided on the re-sign-off sheet, for the v2-marked entries only.* Carried from the 31.1 parked list, which the owner's
    2026-09-26 correction (D-39) says rides with this phase. It has not been re-confirmed for 38.5 scope. It interacts with
    this work: ADR-115 makes cards glassy only when the art tone matches the mode, and with separate light and dark art every
    package × mode would have matching art. 38.4 D-12 kept Standard Light glass at 0.5 for 38.4 only. Any opacity change is
    the owner's.
    -   **Scope note 2026-09-27:** D-08 and D-09 decide the Contacts List rows and Card-view cards per combination. Card-blend
        for every other content card is still open, and it is still the owner's call.
    -   **Outcome 2026-09-29 → D-42:** Galaxy Dark Contacts cards keep 0.05. Standard Light Contacts cards go to 0.05
        (from 0.50). Other content cards keep ADR-115 (D-28).
-   **[RESOLVED · 2026-09-28 → PASS] O-9 --- Spike: can `codex-edu` exec make and edit image files non-interactively?**
    **Result (MEASURED 2026-09-28): PASS.**
    -   The command was `CODEX_HOME="$HOME/.codex-edu" codex exec -m gpt-6-astra --sandbox workspace-write
        --skip-git-repo-check -C <dir> "<prompt>" < /dev/null`. It exited 0, needed no interaction, used about 32k
        tokens, and took about 2 minutes.
    -   Codex used its built-in `image_gen.imagegen` tool for both **generating** and **editing**, then PIL to resize and
        convert.
    -   **Where the output lands:** the generator always saves its originals to
        `~/.codex-edu/generated_images/<session>/exec-<id>.png`, outside the workspace. Codex then wrote the requested
        copies to the named paths inside `-C <dir>`. The orchestrator must name the output paths in the prompt; the
        stray originals in `~/.codex-edu` are harmless.
    -   Both outputs were exactly **941 × 1672, RGB, no alpha, PNG, sRGB** (verified with PIL). A lossless WebP transcode
        is still a repo-side step (brief §I).
    -   It followed a band instruction: the test prompt asked for L\* 89–97, and the output measured L\* 90.6–100
        (generate) and 88.9–100 (edit), with 0.00% of pixels below 87. The white star glints reach L\* 100, which is
        fine on light art.
    -   The spike images are throwaway scratch files, not art candidates.
    -   `~/.codex-edu/config.toml` now defaults to `gpt-6-astra` (MEASURED 2026-09-28; it was `gpt-6-sol` on
        2026-09-27). Keep passing `-m gpt-6-astra` explicitly. This is a quick spike to run
    before planning (D-14). It confirms that `CODEX_HOME="$HOME/.codex-edu" codex exec -m gpt-6-astra ... < /dev/null`
    can generate and edit image files with no interaction, and where the output lands (a named path in the workspace,
    or only Codex's own store).
    -   Fact (MEASURED 2026-09-27): `~/.codex-edu/generated_images/` holds 10 PNGs named `exec-<id>.png` in two session
        folders, so Codex has generated images in this home before.
    -   That does not confirm the non-interactive path, the Astra model, the output path or the deliverable format
        (941 × 1672 sRGB, no alpha, lossless; brief §I). H1 runs on the final shipped WebP whatever Codex hands over.
    -   If the spike fails, the owner decides the fallback.
    -   Practice: the D-14 planning note (`< /dev/null`, `--sandbox workspace-write`, outputs written to files).

## Engineering Follow-ups

-   **[PLANNING NOTE] P-1 --- Bare-text contrast proof.** The brief's H5: the §E maths as a vitest test over the declared
    extrema, for every bare colour, in every package × mode. It does not exist. Its intended home, 38.4 Plan 16's
    bare-foreground contract, was cancelled by D-38, so this phase owns it.
-   **[PLANNING NOTE] P-2 --- New-asset contract.** For every new asset: run `scripts/measure-background-extrema.py`; update
    `darkestPixel`/`brightestPixel` in `src/theme/backgrounds.ts` and the rows in `assets/backgrounds/README.md`; pass
    `--check`; keep `src/theme/tokens/surface.test.ts` and `src/theme/backgrounds.test.ts` green. Today the measure script
    (`scripts/background-extrema-regimes.json`) and `surface.test.ts` check each asset against **both** modes' card regimes
    of its package, so mode-specific assets need that model changed (brief §H caveat).
-   **[PLANNING NOTE] P-3 --- One asset per slot today.** A slot resolves to one image used in both modes
    (`src/theme/backgrounds.ts`, `src/components/ui/BackgroundHost.tsx`). The selection is per package: `galaxyBackground`
    / `standardBackground` in the theme store, persisted as `app_settings.galaxy_background` / `standard_background`
    (migration 015) and carried in backups (`src/backup/backup-schema.ts`). Separate light and dark art means resolving the
    asset by slot × mode, and possibly changing the Settings → Appearance picker. Governing decisions to check with
    `npm run graph:ask -- governs src/theme/backgrounds.ts`:
    -   ADR-087 (bundled background slots), partly superseded by ADR-115
    -   ADR-113 (one shared library of the eight bundled WebPs)
    -   ADR-114 (route-aware app-wide composition)
    -   ADR-115 (cards are glassy only when the art tone matches the mode; mismatched package/mode keeps opaque cards)

    A mode-specific art model likely needs a new ADR superseding parts of these.
-   **[PLANNING NOTE] P-4 --- Cut slots must keep resolving safely.** If O-1 removes a slot, a persisted or restored slot id
    for it must still resolve safely. ADR-113 already requires invalid ids to fall back to the package default or solid;
    verify that at planning. Any schema or backup-format change is forward-only, verified against head+1 on disk, and a
    backup-format bump is an owner decision.
-   **[PLANNING NOTE] P-5 --- Confirm the misrole swap landed.** The brief's bands assume 38.4 Plan 16 swapped the
    accent-fill text misroles to `accentText` (OD-6). Check every `accent` row of `bare-text-sites.csv` against the tree. If
    any remain on the fill token, the bands tighten to L\* ≥ 94 (light) and ≤ 15 (dark).
-   **[PLANNING NOTE] P-6 --- Re-verify the site list.** 194 of the 294 bare sites are ESTIMATED, and line numbers drift as
    38.4 lands. Re-run or hand-verify the list before relying on it for scrim placement or the proof.
-   **[PLANNING NOTE] P-7 --- Asset size.** The current WebPs are 0.4–1.5 MB each. About 12 images instead of 8 changes
    the APK size; record the before and after.
-   **[PLANNING NOTE] P-8 --- Profile and Orrery.** The Profile route's `profileBackgroundScrim` sits over the same shell art;
    re-measure it with the new art. The Orrery route forces `none` and stays out of scope. App-owned profile photo
    backgrounds (ADR-112) fall under D-41.
-   **[PLANNING NOTE] P-9 --- How the text-colour rule (D-10) meets the new art.**
    -   D-10 is defined by the art actually beneath the text. The v2 sheet was answered over today's art: dark Galaxy art
        in both Galaxy modes, and mid-to-light Standard art in both Standard modes.
    -   Once separate light and dark art ships (D-39), the colour that suits the art in a pairing depends on that pairing's
        new art:
        -   Where the new art matches its mode (the brief's band direction), the art-suited colour is the mode default, and
            the brief's §E bands apply as written.
        -   Where a pairing keeps art of the opposite tone (for example, if O-2 settles on darker Galaxy Light pictures),
            the flipped colours apply. That pairing's band, `check_art.py` (which models the mode-default colours today)
            and the P-1 proof must then be computed for the flipped colours.
    -   With O-7 parked, the natural reading is one foreground choice per combination (theme × mode × background, per
        component), not per region of an image. Confirm this in discuss.
    -   The re-sign-off (D-13) confirms each pairing on the new art. The D-11 WATCH outliers need this check most.
-   **[PLANNING NOTE] P-10 --- What the sheet covers.**
    -   The v2 sheet covered the Contacts and Digest screens, plus the fixed rule for pop-up menus and the Orrery (D-12).
    -   Bare text on every other route (brief §C: 294 sites on 50 routes) is carried by the art fix.
    -   The planner adds no scrims elsewhere (D-40).
    -   The D-13 re-sign-off covers at least the cells the owner changed. Whether it should cover more screens is the
        owner's call.
-   **[PLANNING NOTE] P-11 --- New treatments the table implies (MEASURED against code, 2026-09-27).** Several D-08/D-09
    cells need treatments that do not exist today:
    -   see-through List rows, which have a solid `colors.surface` fill today (`src/components/ListRow.tsx:175`);
    -   truly see-through contact cards in the mismatched pairings, where the ADR-115 `GlassSurface` tint is opaque
        (`src/components/GridCard.tsx:216`);
    -   a slightly-black see-through backing for the count label and headers in Standard Dark, which are solid there
        today;
    -   no backing at all for the count label and headers in Galaxy Light and on the Standard Light art backgrounds;
    -   the D-10 flipped foregrounds.

    What each new treatment needs:
    -   Every one resolves through theme tokens, with no hardcoded colours (CLAUDE.md).
    -   Each is covered by the P-1 proof and kept consistent with the `surface.test.ts` regimes.
    -   `GlassSurface`, `ChromeScrim` and `ShellAppBar` are shared across routes. D-09 decides the contact entries only,
        so a global change to the mismatched-mode card tint would go beyond it. Read every consumer before changing a
        shared token (`npm run graph:ask -- governs <file>` for the governing ADRs).

## Explicitly Out of Scope

-   Contrast guarantees for user-uploaded backgrounds (D-41).
-   Collapsing Galaxy and Standard into a single Dark/Light switch (D-39: not the owner's intent).
-   The Orrery route's art (it forces `none`). Its controls and menus keep a full scrim (D-12).
-   The glass-card, chrome and role-foreground work already done in 38.4 (38.4 D-12, D-24, D-26, D-28, D-34).
-   The dynamic per-region text-colour idea (O-7), parked on 2026-09-27 as a later experiment, until the owner scopes it.

## Prerequisites

-   Phase 38.4 complete, including Plan 16's misrole swap and Plan 20's glass-scope read-site sweep.
-   The owner-signed scrim combination sheet (D-40). **Met 2026-09-27** (sign-off v2, D-08).
-   The O-9 `codex-edu` image spike, run before planning (D-14).

## Revision Log

-   2026-09-26 --- Created at phase insertion from 38.4 owner rulings D-38..D-41 and the 38.4 background-art brief.
    Discuss-phase not yet run. O-7 feasibility assessment pending.
-   2026-09-27 --- Owner rulings recorded:
    -   D-08: the scrim sign-off v2 results, as the full 20-combination table, with correction (a) (Galaxy Dark · Deep
        Space List rows are transparent; "full" was a fluke) and correction (b) (Standard Light · Paper's full rows and
        cards are intentional). The raw answers are saved unmodified as `38.5-scrim-signoff-v2.json`.
    -   D-09: contact entries in Galaxy Light and Standard Dark are truly see-through. The entry names the parts of
        ADR-115 these choices reverse.
    -   D-10: the text-colour rule.
    -   D-11: Digest content has no scrim, plus a WATCH item for the outliers.
    -   D-12: the Contacts pop-up menus and the Orrery keep a full scrim (reaffirms D-40).
    -   D-13: art-first sequencing, with a re-sign-off on the new art.
    -   D-14: the Claude/Codex split and the `codex-edu` Astra art loop.

    Open items: O-5 resolved; O-9 added (the `codex-edu` image spike); O-2 gains the owner's concept ideas; O-7 parked; O-8
    has a scope note. P-9..P-11 added. The status header, Objective, Out of Scope and Prerequisites are updated.
-   2026-09-27 (second round) --- D-15: the owner confirms the ADR-115 supersession D-09 derived, and 38.5 writes the
    superseding ADR. D-16: a pearl planet limb may be made as an exploration only, with the Phase 31 no-planets rule relaxed
    for that exploration; O-2 stays open.
-   2026-09-28 --- Discuss session: D-17..D-29 recorded.
    -   Lineup: D-17 (Galaxy quiet/Aurora/busy Starfield; Deep Space and Nebula cut), D-18 (Standard cuts Mesh), D-19
        (the new quiet image is the Galaxy default).
    -   Art: D-20 (strict and visible-features versions; the owner picks with the failure % shown), D-21 (two routes per
        slot), D-22 (pale Standard Light band accepted), D-23 (one pick per theme follows the mode; no migration).
    -   Contrast: D-24 (conditional E-1 extension, 10% metric), D-25 (red-string scrims go to the end-of-phase gap list),
        D-26 (one foreground per combination).
    -   Scope: D-27 (re-sign-off covers all Contacts + Digest cells, a look-only gallery and a card-blend variant), D-28
        (nothing outside the v2-marked components changes; the rest of ADR-115 stands), D-29 (the O-9 spike runs next).
    -   An end-of-phase gap list section is added. O-1, O-3, O-6 and O-8 are resolved, O-2's approach is set, O-4 is
        resolved conditionally, and O-7 stays parked.
-   2026-09-28 --- O-9 spike run (D-29): PASS. `codex-edu`/Astra generates and edits images non-interactively; the
    output goes to named workspace paths, and the originals also land in `~/.codex-edu/generated_images/`.
-   2026-09-28 --- Art sign-off (plan 38.5-04): D-30..D-34 recorded in a new "Art Sign-off" section. D-30 the 12 picks
    (Galaxy Dark Aurora is a new image), D-31 the Starfield allowance (18 px / 0.5%) and no exclusions, D-32 the planet
    limb shelved, D-33 the "Deep Space" label for `galaxy-quiet`, D-34 no backup-format bump. O-2 is resolved. The record
    is `38.5-ART-SIGNOFF.md`.
-   2026-09-29 --- D-35 recorded in the "Art Sign-off" section: the owner had both Aurora images mirrored left↔right
    (mechanical flip, no regeneration) so the ribbon sits away from the left-aligned content. Record:
    `38.5-ART-SIGNOFF.md` §4.
-   2026-09-29 --- Re-sign-off v3 (D-13 step 3, plan 38.5-07): D-36, D-37 and D-42..D-45 recorded in a new "Re-sign-off
    v3 (D-13 step 3)" section.
    -   D-36: the v3 table for the 16 combinations. Standard Dark Dawn/Paper/Dusk headers are none; Standard Light · None
        and Galaxy Dark · None have full rows and cards.
    -   D-37: the see-through levels.
    -   D-42: card-blend (Galaxy Dark keeps 0.05; Standard Light Contacts cards 0.05).
    -   D-43: the ⋯ follows the header.
    -   D-44: mode-default text on the see-through entries.
    -   D-45: the WATCH outliers are accepted.
    -   O-8 is resolved. Record: `38.5-SIGNOFF-V3.md`; answers: `38.5-scrim-signoff-v3.json`.
-   2026-09-29 --- Code review WR-02: an addendum under D-31 records the declared Starfield text-bearing bounds
    (`#D3DDE0` light darkest, `#262452` dark brightest), why they differ from the checker's channel-wise bounds, and the
    owner's acknowledgement ("Accepted and noted"). Record: `38.5-ART-SIGNOFF.md` §5.
