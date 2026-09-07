---
phase: 29
slug: orrery-camera-scale-exploration
status: approved
reviewed_at: 2026-09-06
approved_at: 2026-09-06
shadcn_initialized: false
preset: none
created: 2026-09-06
---

# Phase 29 — UI Design Contract

Scope: ORRC-01–16. One canonical Orrery, bounded inspection camera, built-in Systems, density, lightweight relationship satellites, and accessible contact access. This is a design contract, not evidence of implemented behavior or device verification.

## Sources and authority

- `29-CONTEXT.md` and its canonical Phase 08 dossier and planning-notes appendix are binding. The September 1 amendment overrides older dossier text.
- ADR-077 supersedes ADR-048's dual view/morph only. ADR-046 ring ordering, ADR-047 sun identity, ADR-011 never-contacted segregation, and ADR-085 reduced motion remain applicable.
- The graph's OrreryScreen → ADR-048/077 associations are **INFERRED** from Key files. ADR-077 itself was opened to confirm the supersession.
- Existing Phase 23 tokens and primitives supply spacing, typography, surfaces, icons, and reduced motion. No RESEARCH.md exists yet; API and migration planning remain plan-phase work.
- **Owner confirmed 2026-09-06:** System dropdown at top left; View options at top right for density/satellites; separate Contacts list and Recenter controls at bottom right; companion list opens as a bottom sheet.
- **Owner confirmed 2026-09-06:** the UI-state coverage, element classifications and proposed treatments below. All state acceptance truths are resolved explicitly.

## Design System

| Property | Contract |
|---|---|
| Tool | Existing manual React Native semantic design system; shadcn/web initialization not applicable |
| Component library | Existing AppText, Button, GlassSurface, Sheet, shell chrome and overlay lifecycle; Skia + Reanimated + Gesture Handler for the world |
| Icon library | Existing semantic Icon registry backed by Ionicons; add any needed semantic keys centrally |
| Font | Bundled Inter Regular/SemiBold and Space Grotesk SemiBold; no remote font dependency |
| Theme | Galaxy/Standard and Light/Dark/Follow System retain their independent meanings |
| Images | Local contact photos with deterministic tokenized initials fallback; no new bitmap asset required |
| New presentations | Orrery-specific System dropdown, View options panel, nonmodal Cluster Focus panel, and camera controls |

Do not reuse Dashboard's `AnchoredPanel` blindly: despite its name it currently centers its content and registers `dashboard-panel`. Reuse shared visual primitives while supplying the Orrery's own anchoring, transient identity, and dismissal contract. The companion list can use the shared `Sheet` detail presentation with scrollable content. Cluster Focus must leave the framed world interactive and is therefore a floating panel, not that modal sheet.

## Spacing Scale

Use existing `SPACING` values in logical React Native layout units.

| Token | Value | Usage |
|---|---:|---|
| xs | 4 | Icon/text and compact metadata gaps |
| sm | 8 | Between adjacent controls and row elements |
| md | 12 | Existing compact row and sheet inner padding |
| base | 16 | Viewport edge inset and panel padding |
| lg | 24 | Sheet body and separation between conceptual groups |
| xl | 32 | Empty-state group separation |
| 2xl | 48 | Existing large separation token; not mandatory empty padding |

Exception to the generic GSD scale: 12 is the project's explicitly established, grid-aligned token; retain it. Touch targets have a 44×44 minimum independent of rendered icon/body size. Projected world coordinates, ring spacing, radii, strokes, and animation values are geometry rather than UI padding tokens. Existing RADII and ICON_SIZE supply corners and glyph sizes.

## Typography

| Role | Size | Weight | Line height | Font / use |
|---|---:|---:|---:|---|
| Body | 16 | 400 | 24 | Inter; contact rows and readable descriptions |
| Label | 14 | 600 | 20 | Inter; System selector and screen-facing names |
| Caption | 14 | 400 | 20 | Inter; subordinate relation/status context |
| Heading | 20 | 600 | 25 | Space Grotesk; panel/sheet and empty-state headings |
| Display | 28 | 600 | 34 | Existing Space Grotesk role; no new display heading in the Orrery HUD |

Exactly four distinct sizes and two weights. Use semantic roles, not local near-duplicate sizes. RN text respects OS font scaling and reflows. Skia label fonts use the matching bundled assets through Skia's separate font pipeline; zoom controls visibility rather than making name text arbitrarily tiny or enormous. Initials inside scaled celestial avatars are image-like identity marks, not another UI type scale. Full names remain accessible in conventional rows when canvas labels cannot fit.

## Color

| Role | Token / proportion | Usage |
|---|---|---|
| Dominant | background, approximately 60% | World/backdrop and negative space |
| Secondary | surface / surfaceElevated, approximately 30% when controls are open | Readable dropdowns, sheets, cluster panel, label backplates |
| Accent | accent, at most approximately 10% | Selected System/density indicator, focus outline separate from status, reorder preview, existing shell primary action |
| Text | textPrimary / textSecondary | Names and supporting context |
| Relationship health | Existing statusStable/statusWobble/statusDecay/rogue and orrery ring resolver | Semantic status only, with line treatment and readable status names |
| Neutral | Existing neutral ring resolver and border | Never-contacted bodies; never substitute Stable/Decaying |
| Rogue body | rogueExtinguished | Existing cold body treatment, distinct from its status ring |
| Celestial landmark | starPalette / textPrimary | Restrained Polaris treatment; not a second decorative accent palette |
| Error | textPrimary / textSecondary on surface, with explicit failure text and recovery action | No new error color; danger remains reserved for destructive actions |

The percentages describe hierarchy, not a requirement to cover 30% of a closed HUD with panels. World and sun/contact bodies are the focal point; identity/focus comes next; chrome stays subordinate. Accent is reserved for the named elements, not every clickable control. Recenter, View options, and Contacts controls use neutral surfaces/text at rest. All colors, including Skia draws, resolve through the active theme. GlassSurface uses its density-aware opacity and fallback; readable text never depends on blur. Status remains understandable without color through line treatment and companion-list text. No destructive action is introduced.

## Layout and surface inventory

| ID | Surface | Placement and behavior |
|---|---|---|
| E1 | Orrery world: interactive collection of avatar media, rings and name/context labels | Fills the available region below ShellAppBar and above bottom navigation. Stable sun-centered world, with measured overlay exclusion bounds used by Home and focus framing. |
| E2 | System selector button and dropdown list | Top left, 16 inset. Current name + chevron. One selected item; live built-ins and Category-derived entries. Scroll when necessary; no persistent System tabs or authoring actions. |
| E3 | View options form/control panel | Top right trigger, 16 inset. Density choices Spacious/Balanced/Compact and Relationship Satellites switch, with explicit selected/on/off state. No numeric density slider or local Reduced Motion toggle. |
| E4 | Contacts list and Recenter buttons | Separate 44-minimum controls in a bottom-right vertical stack with 8 gap, clear of shell FAB, tab bar and safe area. Contacts above Recenter. |
| E5 | Contacts in this System bottom-sheet collection and navigation actions | Sheet detail variant; heading, scrollable rows, explicit Focus in Orrery and Open Profile actions. Same active System data as the world. |
| E6 | Cluster Focus floating contact collection and navigation actions | Bottom floating panel above shell exclusion region, with scrollable group rows. The camera frames bodies in the remaining visible region; canvas remains interactive. |
| E7 | Single-contact / satellite focus labels and contextual controls | Screen-facing, near their focused body and inside usable bounds. Minimal identity/context rather than a miniature Profile. Explicit dismissal accessible without a precision canvas tap. |
| E8 | Polaris landmark and orientation action | In-world canonical north marker that moves with yaw. Restrained starburst. Accessible Reset north action reports orientation and changes yaw only. |
| E9 | Empty/loading/error messages and recovery controls | Readable themed overlay/inline region for the affected surface; never a generic empty message over a failed read. |

Reserve space for the existing universal capture FAB rather than moving or removing it. Use measured shell/tab/FAB geometry translated into the canvas coordinate space, not a second hardcoded screen offset. When panels open, avoid hidden or overlapping actionable controls. Modal companion-list coverage blocks underlying interaction; Cluster Focus retains canvas access and a reachable Recenter/dismiss path. Closing a dropdown/sheet returns accessibility focus to its trigger. Back and active-tab retap dismiss the top transient before route navigation through the shared shell lifecycle.

## World, camera and interaction contract

| Requirement | Observable contract |
|---|---|
| ORRC-01 | Single unnamed relationship-health view. Remove Status/Relationship toggle and relationship morph; preserve timestamp-based placement and ring_seq meaning. |
| ORRC-02 | One-finger drag pans. Pinch zooms. Deliberate multi-touch gestures tilt and rotate yaw. Bounds prohibit inversion, below-plane movement, and unusable near-edge-on viewing. Yaw never changes contact data or progress angle. |
| ORRC-03 | Near bodies visibly enlarge relative to far bodies under tilt, within usability bounds. Photos stay circular/screen-facing, labels horizontal. Derived Gravity changes nominal body mass modestly; no stored/editable size. |
| ORRC-04/05 | Home is sun-centered, top-down and north-up. Fit the complete world until readability would fail, then let outer rings extend offscreen. Balanced is default, calibrated around six generous bodies and toward ten comfortably, not count-based caps. Density changes geometry, never members. |
| ORRC-06 | Overview largely hides labels; identity level reveals names; deeper inspection adds existing health/Gravity and focused relationship context only. Priority: focused contact, cluster members, Favorites, isolated/fitting labels, remaining labels. Only small deterministic collision nudges; no global repacking. |
| ORRC-07 | A distant isolated contact tap focuses and stops at name-visible zoom; an identity-level contact tap opens Profile. Overlapping interactive hit targets yield Cluster Focus rather than nearest/topmost guessing. Cluster row or focused contact can open Profile. |
| ORRC-08 | Profile return restores camera and valid single-focus context in the navigation session. Cluster panel exits before Profile navigation; restored framing need not reopen that dismissed panel. Fresh launch/fresh visit returns Home. Backgrounding alone is not a fresh visit. Camera has no durable storage. |
| ORRC-09 | Polaris resets yaw only. Recenter clears focus/cluster and restores all camera axes via bounded distance-adaptive continuous recovery. Tiny pan/yaw inertia, little-to-none zoom inertia, no tilt inertia. |
| ORRC-10 | Prolonged stationary hold arms ring reorder with visible highlight/ghost ring and haptic acknowledgement. Movement before activation pans. Hold duration/slop are implementation/device calibration. Reorder failure restores the committed layout and exposes actionable feedback. |
| ORRC-11/12 | All Contacts default; Favorites, Needs Attention, Not Contacted, Snoozed, Chargers, and actual user-visible Categories. Live population semantics, independent of Dashboard selection/sort/search. All Contacts and Not Contacted explicitly admit never-contacted bodies with a fixed neutral resting angle and absent progress. |
| ORRC-13/14 | Balanced and satellites Off are factory defaults; preferences persist. Eligible unlinked person-like Relationships become subordinate moons only when enabled and scale permits. Overview hides moons; readable parent inspection reveals them. Linked rows cease moon representation. Satellite tap reveals name/relation with restrained focus and no Profile/logging/status/Gravity/cadence. |
| ORRC-15 | Companion rows expose identity, health and derived Gravity context with distinct focus and Profile actions. Accessible satellite name/relation context is reachable through the parent without precise moon taps. No independent search universe or sort controls. |
| ORRC-16 | Live OS Reduced Motion stops ambient twinkle/sun pulse and disables inertia; focus/recenter become short direct transitions. Manual camera gestures remain. Blur/background unmounts the clock-owning canvas subtree. No per-frame React state. |

System membership changes use restrained fade/shrink/settle continuity. Do not introduce the later spin/shedding/capture spectacle. Bodies remain timestamp-placed; new ambient contact revolution is not authorized by camera navigation. Profile, category CRUD, custom Systems, relationship editing and graph semantics remain with their owning phases.

**Owner clarification — 2026-09-07, CONTEXT D-11:** A globally visible contact sun excluded from the selected System keeps its contact focus/Profile actions, but its satellite moons and their Orrery relationship context are hidden. Parent membership must qualify before the existing enabled/semantic visibility rules can reveal them. No nonmember sun row is added to the companion. This dated clarification supplements the original approved UI contract; it does not claim a new checker sign-off.

## Copywriting Contract

Exact confirmed copy; braces denote live names/counts, never shipped placeholders. Existing project spelling in domain labels is preserved.

| Element | Copy |
|---|---|
| Main contact action | Open Profile |
| Companion trigger/title | Contacts in this System |
| Companion secondary action | Focus in Orrery |
| System selector accessible label | Choose System. Current System: {systemName} |
| Built-ins | All Contacts; Favorites; Needs Attention; Not Contacted; Snoozed; Chargers; actual Category name |
| View trigger/title | View options |
| Density | Density — Spacious / Balanced / Compact |
| Satellite toggle/help | Relationship Satellites — Show unlinked people around their contact. |
| Recenter visual label / accessibility | Recenter / Recenter Orrery |
| Polaris accessibility | Reset north; orientation value: {degrees} degrees from north |
| Cluster heading | Contacts here |
| Cluster count | 1 contact / {count} contacts |
| Cluster dismiss | Close contact group |
| Companion dismiss | Close contact list |
| Options dismiss | Close view options |
| Focus dismiss | Clear focus |
| Satellite context | {personName}; {relationType} of {parentName}. If relation type is absent: A key person for {parentName}. |
| Never-contacted state | Not contacted yet |
| Empty All Contacts heading/body | No contacts in your Orrery yet / Add a contact and choose a contact frequency to include them here. |
| Empty All Contacts action | Add Contact — reuse shell's existing route |
| Empty selected System heading/body | No contacts in {systemName} / Choose another System to explore your contacts. |
| Empty selected System action | Show All Contacts |
| Sun-only world | Your contacts are centered here / Open the contact at the center or choose another System. Use only when a qualifying contact occupies the sun and no orbiting bodies remain. |
| Initial local loading | Loading your Orrery… / Loading contacts… |
| World/list read failure | Couldn't load this System. Try loading it again. — Reload System |
| Refresh failure with retained data | Couldn't refresh this System. Showing the last loaded contacts. — Reload System |
| Preference save failure | Couldn't save your view options. Try that change again. — Retry view change |
| Reorder failure | Couldn't change the orbit order. The saved order has been restored. — Reload System |
| Satellite read failure | Couldn't load relationship satellites. Your contacts are still available. — Reload satellites |
| Focus target removed | This contact is no longer in this System. — Show All Contacts |
| Destructive confirmation | Not applicable; phase adds navigation, reversible view preferences and deliberate reorder, no delete/archive action |

## Implementation seams verified on disk

- `OrreryScreen.tsx` currently opens Profile directly on hit, hides failed reads behind an empty array, exposes the two-mode toggle, and uses viewport-constrained geometry. These are baseline behaviors this contract changes.
- `OrreryCanvas.tsx` and `SunBody.tsx` already consume `useReducedMotionShared()`. The older R-17 absence claim is stale; extend the existing integration to camera transitions/inertia.
- `orrery-geometry-logic.ts` currently clamps drawn radii to the viewport and `hitTest()` selects the nearest/topmost candidate. Projection/render/hit-target geometry must agree through the new camera; do not retain resting-position hit tests during transitions.
- `relationships-read.ts` exposes person_name, relation_type, linked_contact_id, hidden and deleted_at. `relationships-dao.ts` stores structured relationships already; do not invent a graph table. Respect existing presentation semantics; a missing relation type is not permission to infer one.
- `ring-seq-dao.ts` currently requires the complete contacted, Bound, nonarchived, sun-excluded population. It cannot accept an arbitrary filtered System id list. Planner must reconcile new System population rendering and reorder transaction scope while preserving completeness, uniqueness, lifecycle, and occupant guards; never remove a guard to make a partial list pass.
- Existing sun resolution in `sun-occupant-logic.ts` remains authoritative. A contact sun is not duplicated as an orbiting body; companion membership and empty-state handling must account for it without losing access to a qualifying contact.
- Durable density/satellite/active-System preferences belong in app_settings and the portable allowlist; camera/focus remains session-only. Verify migration head and backup format at plan time; older notes' numeric versions are not instructions to reuse them. Plan 29's preference migration separately unless 29/30 are deliberately planned together.
- This UI contract is not a complete audit of every contacts/settings/relationship writer. Implementation planning must read every affected writer, migration and restore path before changing data-layer invariants, per AGENTS.md.

## UI Considerations

Probe executed after dimension review with the installed `ui-consideration-probe.cjs`. The owner confirmed the classifications and state treatments on 2026-09-06. The final engine run used explicit element-kind overrides: E4 is navigation + interactive controls (the heuristic had mistaken its list-opening action for a list surface), and E6 includes interactive-control for its selectable rows.

Applicable state considerations resolved: **55 covered, 0 backstop, 0 unresolved** across nine surfaces. The compiled engine validated every explicit resolution and the category mapping below. The initial heuristic count was 59; correcting E4's classification removes four inapplicable collection states, not four unresolved obligations.

| Element | Confirmed kinds | Category | Status | Resolution / Reason |
|---|---|---|---|---|
| E1 World | list-collection, media, interactive-control, static-content | empty, loading, error, populated, partial, overflow, zero-one-many, long-text | ✅ covered | Use Copywriting Contract for true empty, sun-only, initial loading and local failure. Keep last successful same-System data on refresh failure with its stale notice. Missing photo uses initials; missing progress stays neutral, missing optional context is omitted. Typical population uses bounded readable Home; one contact keeps useful scale, many grow the world. Clip world to viewport, preserve camera access and complete companion membership. Canvas names use one-line ellipsis when needed, with full accessible name and full wrapping name in the companion sheet. |
| E2 System selector | list-collection, nav, interactive-control | empty, loading, error, populated, partial, overflow, zero-one-many, long-text | ✅ covered | Built-in choices remain listed even when empty; no Categories is valid and omits only Category entries. During System loading mark the selected destination busy and do not relabel old System bodies as new members. Failures use Reload System without an automatic switch. Current selection remains explicit; persist success truthfully. Scroll long dropdown lists; selected trigger truncates to one line with full accessible name, rows wrap. No zero-member System is disabled. |
| E3 View options | form, interactive-control | empty, loading, error, partial, long-text | ✅ covered | Fresh settings resolve Balanced/Off. Hydrating or saving indicates busy on the affected controls and prevents duplicate/conflicting writes. Optional missing preference values use documented factory defaults; read failure exposes retry rather than overwriting durable state with defaults. Failed writes restore the prior saved selection and retain a retryable change. Labels/help wrap and rows grow under text scaling. |
| E4 Contacts/Recenter | nav, interactive-control | loading, error, overflow, long-text | ✅ covered | Contacts opens the sheet even for an empty/loading System so that state is readable there. Recenter requires valid measured camera bounds; before those exist it is disabled with accessible state. Direct camera action has no network/save spinner. A failed member load does not disable navigation recovery; show the affected System's error. Keep target bounds above shell controls; accessible names stay complete and any visible labels wrap. |
| E5 Companion sheet | list-collection, nav, media, interactive-control, static-content | empty, loading, error, populated, partial, overflow, zero-one-many, long-text | ✅ covered | Share the active System's loading/error/empty truth and copy with E1. Each qualifying contact appears once, including a qualifying contact sun. Rows expose full wrapping name, health, available Gravity, Focus in Orrery and Open Profile. Photo failure uses initials and absent optional context omits only that field. Zero uses empty treatment, one stays a normal row, many scroll within the detail sheet. Actions reflow vertically when necessary. Focus closes the sheet and frames the selected contact; Profile closes the sheet before navigating. |
| E6 Cluster panel | list-collection, nav, interactive-control, static-content | empty, loading, error, populated, partial, overflow, zero-one-many, long-text | ✅ covered | Derive the group from loaded projected interactive targets, with no independent artificial loading delay. Profile/focus actions revalidate the target. Zero surviving members dismisses the group; one keeps an actionable single row until dismissed/selected; many scroll in the floating panel. Use singular/plural count copy. Missing optional metadata is omitted. Names wrap; panel height is bounded by measured available space and reserves visible framed bodies and dismiss/recenter controls. Read failure preserves last valid same-System content with the shared failure notice. |
| E7 Focus labels | interactive-control, static-content | loading, error, overflow, long-text | ✅ covered | Identity comes from the loaded body; optional context may load without blocking that identity. Satellite failure uses its targeted reload copy while the parent stays available. A removed target clears focus and uses the documented notice. Single focus persists through camera moves until dismissed or effectively lost offscreen; camera clipping must not strand hidden focus. Focus names/context wrap within usable bounds; suppress subordinate context before covering controls. Full identity remains in the companion's accessible parent context. |
| E8 Polaris | media, interactive-control, static-content | empty, loading, error, populated, overflow, long-text | ✅ covered | Generate the landmark from theme-resolved drawing primitives, with no remote image loading/error path. It remains meaningful with zero contacts. Until camera measurement is ready, disable its action and expose orientation only when valid. At valid bounds use the restrained starburst and canonical yaw value. At viewport edges preserve orientation access through an accessible Reset north action; do not pin the star into fixed HUD chrome. Orientation text/accessibility label remains complete. |
| E9 Feedback | interactive-control, static-content | loading, error, overflow, long-text | ✅ covered | Use the named copy rows for each affected surface. Loading is distinct from empty and failure. Retry is busy while its operation is pending and can be attempted again after failure. Errors preserve valid local content and view intent where possible. Messages wrap in a bounded scrollable surface if needed; recovery remains reachable at large font sizes. No technical stack trace or network setup prompt appears. |

These are UI acceptance truths, not proof of implementation. Reduced Motion, theme changes, largest supported text, long names, zero/one/many contacts, overlapping hits and Profile-return behavior require later implementation verification. Phone-only performance calibration remains separate.

## Registry Safety

| Registry | Blocks used | Safety gate |
|---|---|---|
| None | Existing repository-native components only | Not applicable; no third-party registry or new component dependency |

## Checker Sign-Off

Inline review using the gsd-ui-checker criteria, 2026-09-06 (no independent subagent review).

| Dimension | Verdict | Evidence |
|---|---|---|
| Copywriting | PASS | Specific contact/recovery actions and separate empty/failure copy; Recenter is the dossier's explicitly named control |
| Visuals | PASS | Sun/world focal point, owner-confirmed controls, accessible labels and conventional contact access |
| Color | PASS | Named existing tokens, explicit accent reservation and semantic status distinction; corrected nonexistent statusRogue/error tokens during review |
| Typography | PASS | Four distinct sizes, two weights and explicit line heights from existing theme |
| Spacing | PASS | Existing project scale; 12-unit exception is documented and required by the established theme |
| Registry safety | PASS | Manual design system declared; no external registry blocks |

**Dimension review:** 6/6 passed. **Workflow approval:** approved 2026-09-06 after owner UI-state confirmation and compiled coverage validation. Camera constants, final Polaris/satellite artwork and phone performance remain the dossier's deferred calibration work; no device validation is claimed.
