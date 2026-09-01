# Dossier — Orrery Camera, Scale & Exploration

**Status:** complete · Interrogated through 2026-08-31 · Orrery viewport/camera/scale product decisions settled. Custom System authoring is split into a later sibling phase.

## Decision Legend
- **[DECIDED]** explicitly chosen by the owner.
- **[DERIVED]** implementation/architecture consequence.
- **[DEFERRED]** intentionally postponed.

## Scope
This dossier defines Orbit's release-quality Orrery exploration model over the existing Orrery visualization and relationship-health semantics.

It covers the canonical Orrery mode, 2.5D camera model, pan/zoom/tilt/yaw, perspective/depth behavior, semantic zoom, focus behavior, ambiguous-hit cluster focus, recentering, north orientation, high-contact-count geometry, contact sizing, collision avoidance, ring reordering gesture coexistence, built-in Systems and their switcher, Orrery density presets, relationship satellites derived from existing unlinked structured Relationships, accessibility alternatives, reduced-motion behavior, and the phase seam into custom Orrery Systems.

It intentionally does **not** define custom System authoring/management, polished System-switch animation, new contact-to-contact social-graph semantics, first-/second-level contacts, graph-aware satellite ownership, relationship editing, new relationship-domain schemas, or a full relational graph visualization.

---

## A. Orrery Product Role

**[DECIDED]** Orrery remains Orbit's primary relationship-health / attention-centric visualization rather than another Dashboard renderer.

**[DECIDED]** Orrery is an immersive but purposeful visualization: it may use stronger motion, perspective, glow, and specialized controls than ordinary screens while remaining tokenized and accessible.

**[DECIDED]** Orrery has one canonical spatial visualization centered on relationship-health/status semantics.

**[DECIDED]** The existing Status / Relationship mode split is removed. The current Relationship mode is not sufficiently intuitive to justify preserving as a first-class product mode.

**[DERIVED]** Phase 8 should simplify/remove mode-toggle and relationship-mode-specific morph/resting-layout behavior rather than preserving it merely because current code exists.

---

## B. World Model vs Camera Model

**[DECIDED]** Orrery is a finite, sun-centered world with a **transient inspection camera**, not a free-flight 3D scene.

**[DECIDED]** The world retains a stable canonical center and north orientation even when the camera is panned, zoomed, tilted, or yawed.

**[DECIDED]** Contact world positions remain defined in Orrery/world coordinates. Camera yaw changes how that world is viewed; it does not mutate a contact's underlying angular placement.

**[DERIVED]** Separate world/layout state from camera state.

Conceptual camera state may include:
- center/pan X
- center/pan Y
- zoom/scale
- bounded tilt
- yaw
- focus state/mode

Exact implementation shape is derived.

---

## C. 2.5D Camera Direction

**[DECIDED]** Orrery uses a constrained **2.5D** camera rather than unrestricted true-3D/free-flight navigation.

**[DECIDED]** Default/Home view is top-down, centered on the sun, with canonical north at the top.

**[DECIDED]** Users may:
- one-finger pan across the Orrery plane,
- pinch to zoom,
- deliberately manipulate tilt with a harder-to-trigger multi-touch gesture,
- yaw/rotate the world orientation with a deliberate multi-touch rotation gesture.

**[DECIDED]** Tilt is bounded. Users cannot invert the Orrery, fly underneath it, or pitch it to unusable near-edge-on extremes.

**[DECIDED]** Yaw may rotate around the sun/world axis while preserving a canonical north reference.

**[DERIVED]** Phase 8 should use the existing Skia/Reanimated/Gesture Handler stack rather than introduce a game/3D-engine dependency solely for this behavior unless implementation proves the existing stack inadequate.

---

## D. Perspective & Billboard Rendering

**[DECIDED]** Perspective depth scaling is intentionally noticeable and somewhat exaggerated, but bounded.

Near-side contacts should visibly appear larger than far-side contacts when tilted; the effect should clearly communicate depth without becoming cartoonishly extreme.

**[DECIDED]** Contact avatars and text labels remain billboarded toward the viewer.

They do not become unreadable tilted ellipses/pancakes when the Orrery plane tilts.

**[DECIDED]** Natural projected depth ordering is allowed: nearer bodies may visually pass in front of farther bodies or the sun.

**[DERIVED]** Functional interaction cannot depend on every body remaining fully visually exposed; ambiguous/occluded contact access is handled through hit ambiguity and Focus Zoom rather than by banning overlap.

---

## E. Gravity as Visual Mass

**[DECIDED]** Contact visual size is influenced modestly by derived Gravity/Closeness.

The intended effect is subtle but differentiable, approximately in the conceptual range of low-gravity contacts being modestly smaller and high-gravity contacts modestly larger than nominal size.

**[DECIDED]** Gravity size modulation remains secondary to camera zoom/perspective and must not overwhelm overall consistency.

**[DERIVED]** Conceptually, projected contact size combines:
- nominal/base contact size,
- modest Gravity modifier,
- camera zoom,
- perspective/depth modifier,
- minimum/maximum usability clamps.

Exact percentages/functions are implementation tuning.

**[DERIVED]** Gravity remains derived-never-stored and must not become editable Orrery-specific size state.

---

## F. Zoom Philosophy & Future Extensibility

**[DECIDED]** Phase 8 ships a broad but bounded semantic zoom range sufficient for whole-system overview and meaningful close inspection.

**[DECIDED]** Extreme map-like zoom ranges are not required now.

**[DERIVED]** Camera/render architecture must not permanently bake in the initial zoom bounds. A later expansion toward much wider/deeper zoom should be possible primarily by relaxing camera constraints and adding scale-dependent presentation, not rewriting every renderer.

**[DEFERRED]** Extreme map-like zoom/free-navigation behavior.

---

## G. Canonical Home Framing

**[DECIDED]** Home framing uses a hybrid fit/readability model.

Orbit should try to show the full system while doing so remains comfortably readable, then stop shrinking once minimum useful geometry would be compromised and allow outer orbital extent to continue beyond the viewport.

**[DECIDED]** Balanced density is the default calibration.

Its visual target is roughly **six contacts with generous presence**, with the Home framing able to accommodate roughly up to **ten** before larger systems increasingly extend offscreen.

These are visual calibration goals, not literal hard caps.

**[DERIVED]** Framing should be computed from available viewport geometry, contact/body sizes, safe-area/control overlays, accessibility constraints, and current density preset rather than `if contactCount > 10` branching.

---

## H. Orrery Density Presets

**[DECIDED]** Phase 8 includes three Orrery density presets:
- Spacious
- Balanced
- Compact

**[DECIDED]** Balanced is the default.

**[DECIDED]** Density changes layout spacing/body framing behavior rather than changing contact membership or relationship semantics.

**[DECIDED]** Density preference persists.

**[DECIDED]** Do not initially expose a numeric `maximum contacts onscreen` control.

**[DERIVED]** Density primarily influences canonical ring spacing, comfortable body scale, collision tolerance, and Home framing.

**[DEFERRED]** User-facing continuous/numeric density tuning unless beta testing demonstrates a real need.

---

## I. High-Contact-Count Ring Geometry

**[DECIDED]** Orrery no longer tries to indefinitely compress every ring into the initial phone viewport.

**[DECIDED]** Maintain meaningful minimum world-space orbital spacing and allow the overall solar system to physically grow with contact count.

**[DECIDED]** All Contacts remains available even when the complete Orrery becomes visually large or overwhelming.

Systems and camera navigation help users inspect large contact sets; Orbit does not disable the canonical complete view.

**[DERIVED]** High-count usability is solved through scalable world geometry + camera navigation + Systems, not through ever-smaller ring spacing alone.

---

## J. Stable Collision Avoidance

**[DECIDED]** Contact angular placement may receive **very small collision-aware nudges** to prevent pathological visual/touch overlap.

**[DECIDED]** Collision avoidance must not substantially rearrange semantic placement or prettify/repack the whole system.

**[DECIDED]** Collision adjustments are stable/deterministic enough that the same underlying Orrery state produces essentially the same layout rather than contacts jumping around between renders.

**[DERIVED]** Focus Zoom remains the primary solution for genuinely crowded regions; collision nudging has a deliberately small correction budget.

---

## K. Semantic Zoom & Label Hierarchy

**[DECIDED]** Information density changes progressively with zoom.

Three broad presentation levels are intended:

1. **Far overview** — celestial visualization; names largely hidden.
2. **Identity inspection** — contact names become available.
3. **Deeper inspection** — additional lightweight context may appear where useful.

**[DECIDED]** Labels do not all appear at one single global threshold if that would create a text wall.

**[DECIDED] Label priority when space is limited:**
1. focused contact
2. contacts in active Cluster Focus
3. Favorites
4. contacts whose labels fit cleanly / are visually isolated
5. remaining contacts opportunistically

**[DECIDED]** Labels always face the screen and remain horizontally readable through yaw/tilt.

**[DERIVED]** Semantic zoom remains restrained; Orrery must not become a mini-Profile renderer.

---

## L. Ordinary Contact Tap & Single-Contact Focus

**[DECIDED]** Tap behavior depends on current inspection depth.

At overview/distant scale, tapping an unambiguous contact:
- centers/focuses that contact,
- animates the camera to the **identity inspection level** where the contact's name is visible,
- highlights the contact.

**[DECIDED]** This first focus zoom stops at the name-visible level rather than automatically diving into the deeper contextual level.

**[DECIDED]** Once already at an appropriate identity-inspection scale where names are visible, tapping the contact opens Profile directly.

**[DECIDED]** A lightweight single-contact Focus state exists and may expose progressively richer context as the user zooms deeper.

**[DECIDED]** Focus remains while the camera moves until deliberately dismissed or the focused body is effectively lost/offscreen enough that continued hidden focus would be confusing.

**[DERIVED]** Focus is not a mini-profile surface and should remain visually subordinate to actual Profile navigation.

---

## M. Ambiguous Hit Detection & Cluster Focus

**[DECIDED]** Contact-hit ambiguity is determined primarily from overlapping/effectively overlapping **interactive touch targets**, not only visible body overlap.

**[DECIDED]** A clear isolated hit continues normal single-contact behavior.

**[DECIDED]** When multiple bodies are plausible for the same touch, Orbit does not guess one arbitrarily.

Instead it enters **Cluster Focus**:
- determine the ambiguous body group,
- compute a safe framing region for that group,
- animate the camera so the group occupies the largest comfortable useful portion of the viewport,
- keep those contacts highlighted/visually legible,
- expose the group through a conventional floating bottom contact panel.

**[DECIDED]** The cluster panel lists the contacts represented by that focused group and allows a user to identify/select them conventionally.

**[DECIDED]** Tapping a focused planet or its panel entry can open Profile.

**[DECIDED]** Cluster Focus exits before route navigation and may be dismissed by Back, empty/outside tap, Recenter, or selecting a contact as appropriate.

**[DERIVED]** Build a reusable `frame bodies` / equivalent camera primitive that can frame arbitrary sets of projected bodies rather than hardcoding overlap-specific camera math.

---

## N. Camera State Restoration

**[DECIDED]** Camera state is ephemeral across app launches but preserved during meaningful in-app navigation return.

Expected behavior:
- fresh app launch / fresh Orrery visit → canonical Home framing,
- `Orrery → Profile → Back` → restore the prior Orrery camera/focus context,
- app relaunch → do not reopen at an arbitrary old pan/tilt/zoom position.

**[DERIVED]** Treat camera position as navigation-session state rather than durable personalization.

---

## O. Polaris / Canonical North

**[DECIDED]** Orrery has a visible celestial north reference, working concept **Polaris / North Star**.

**[DECIDED]** Polaris is a world-orientation landmark rather than fixed HUD chrome.

As the user yaws the Orrery, Polaris moves around the viewport consistently with canonical north so the user can understand how far the world has rotated from Home orientation.

**[DECIDED]** Polaris should be visually noticeable but restrained: a modestly larger/brighter star with theme-appropriate starburst/diffraction treatment rather than an overpowering photographic lens flare.

**[DECIDED]** Tapping Polaris resets **yaw/north orientation only** without resetting pan/zoom/tilt.

**[DERIVED]** Accessibility should expose orientation textually rather than relying on visual interpretation of Polaris alone.

---

## P. Recenter / Home Control

**[DECIDED]** Orrery exposes a familiar target/crosshair-style Recenter control analogous to map recenter controls.

**[DECIDED]** Recenter restores the complete canonical camera state:
- sun centered,
- canonical Home zoom/framing,
- top-down tilt,
- canonical yaw/north,
- no single-contact Focus,
- no Cluster Focus.

**[DECIDED]** Recenter uses **distance-adaptive animated recovery** rather than one fixed-duration easing.

For small displacement, the motion is a short gentle return.

For large displacement, recovery behaves conceptually like:
1. aggressive coarse acquisition,
2. slower approach,
3. soft precise docking.

**[DECIDED]** The phases should feel continuous/smoothed rather than visibly segmented into separate animations.

**[DERIVED]** Total recenter duration should remain bounded so extreme camera displacement does not create an excessively long cinematic return.

**[DERIVED]** Reduced Motion replaces the elaborate docking behavior with a short direct transition.

---

## Q. Camera Inertia

**[DECIDED]** Camera interaction may use **very restrained inertia**.

Intended behavior:
- pan → tiny amount of inertia,
- yaw → tiny amount of inertia,
- zoom → little to none,
- tilt → effectively none.

**[DECIDED]** Orrery must never coast/spin in a way that makes precise inspection difficult.

**[DERIVED]** Reduced Motion disables nonessential inertial continuation.

---

## R. Ring Reordering vs Panning

**[DECIDED]** Ordinary one-finger drag is reserved for viewport panning.

**[DECIDED]** Contact ring/rank reordering requires an intentionally prolonged stationary hold before drag activation.

The hold must be meaningfully longer/more deliberate than a casual short long-press so normal panning does not constantly trigger rearrangement.

**[DECIDED]** Once reorder activation occurs, clear visual/haptic acknowledgement should indicate that dragging now changes orbit/ring order.

**[DERIVED]** Movement before reorder activation should resolve as viewport pan rather than mutating contact ordering.

**[DERIVED]** Exact hold duration, motion slop, and haptic timing are device-testing/implementation details.

---

## S. Built-in Orrery Systems

**[DECIDED]** Orrery supports switching among dynamic **Systems**, where a System defines which contacts are currently visualized.

**[DECIDED]** Phase 8 owns the built-in System switcher and built-in/automatically derived Systems, but not custom System authoring.

**[DECIDED] Initial built-in Systems:**
- All Contacts
- Favorites
- Needs Attention
- Not Contacted
- Snoozed
- Chargers
- one automatically derived System per user-visible Category

**[DECIDED]** All Contacts is the default/canonical Orrery System.

**[DECIDED]** Systems resolve against current/live contact data rather than storing a frozen snapshot of member IDs.

**[DECIDED]** Orrery does not expose conventional sort controls.

**[DERIVED]** Reuse existing Dashboard/contact predicate semantics at the domain/query level where they mean the same thing, but do not bind Orrery directly to Dashboard's current Population/Filter state or control surface.

**[DERIVED]** Built-in Category Systems should naturally reflect user-managed Category definitions once category administration exists.

---

## T. Built-in System Switcher Presentation

**[DECIDED]** Current System is shown through a compact Orrery-specific control such as:

`All Contacts ▾`

**[DECIDED]** Tapping opens a lightweight dropdown/floating list of available built-in/automatic Systems.

**[DECIDED]** Do not use permanent tabs/chips for every System because category-derived and custom Systems can make the set too large.

**[DECIDED]** Phase 8 does not own the polished theatrical System-switch animation.

**[DERIVED]** A simple functional transition is sufficient in Phase 8; polished spin/shedding/capture belongs to the custom Systems sibling phase.

---

## U. Same-System Membership Changes

**[DECIDED]** When the currently active System's live membership changes without switching Systems:
- departing bodies may fade/shrink away,
- retained bodies remain and smoothly settle into adjusted positions,
- newly eligible bodies may fade/grow into their resolved positions.

**[DECIDED]** These transitions should communicate continuity rather than replay the full System-switch spectacle.

**[DERIVED]** Reduced Motion simplifies these changes to restrained fades/direct repositioning.

---

## V. Orrery-Specific View Controls

**[DECIDED]** Orrery gets a small dedicated view/control surface rather than reproducing Dashboard's Population/Filters/Sort controls.

Initial conceptual controls:
- System
- Density: Spacious / Balanced / Compact
- Relationship Satellites: On / Off

**[DECIDED]** Relationship Satellites default **Off**.

**[DECIDED]** Reduced Motion is not an Orrery-local default or setting; it follows the user's/system accessibility preference and is not enabled by default.

**[DERIVED]** Keep Orrery chrome sparse enough that the visualization remains dominant.

---

## W. Relationship Satellites / Lightweight Moons

**[DECIDED]** Phase 8 may visualize existing **unlinked person-like structured Relationships** as small relationship satellites/moons around their parent Orbit contact when the Relationship Satellites view setting is enabled.

Examples include spouses/partners, children, friends, coworkers, or other person-like relationship types represented in the existing structured relationship model.

**[DECIDED]** All person-like relationship types are eligible in principle; Orbit should not hardcode the feature only to spouses/kids.

**[DECIDED]** Only relationships whose related person is **not linked to an Orbit contact** use this lightweight satellite presentation.

**[DECIDED]** Relationship Satellites are not full contacts.

They do not receive:
- their own relationship-health status,
- Gravity,
- contact frequency,
- first-class solar rails,
- Dashboard/System membership,
- logging behavior,
- full Profile behavior,
- satellites of their own.

**[DECIDED]** Their purpose is lightweight contextual orientation: showing important people around a contact without introducing a real social-graph node.

**[DERIVED]** If an unlinked relationship later becomes linked to an actual Orbit contact, the lightweight satellite representation ceases and the full contact follows ordinary Orrery placement semantics.

**[DERIVED]** Do not add speculative `contact_level`, graph-parent, moon-owner, or other new social-graph schema solely for this feature.

---

## X. Relationship Satellite Visibility

**[DECIDED]** Relationship Satellites use semantic visibility rather than cluttering every overview.

Intended behavior:
- far overview → hidden,
- normal/default view → may appear only where the parent/body geometry is sufficiently readable,
- inspection zoom → clearly visible,
- focused parent → reveal its satellites.

**[DECIDED]** Satellites are much smaller/visually subordinate to actual Orbit contacts.

**[DERIVED]** Satellite rendering may be suppressed when current scale/density would make them meaningless or confusing.

---

## Y. Relationship Satellite Interaction & Labels

**[DECIDED]** Tapping a relationship satellite focuses it and reveals lightweight identity/context such as:
- person's name
- relation to the parent contact

Example conceptual presentation:
- `Laura`
- `Phil's wife`

**[DECIDED]** Satellite focus does not zoom as aggressively as full-contact Focus and does not pretend a Profile route exists when the person is not an Orbit contact.

**[DECIDED]** Satellite names are not permanently labeled across the Orrery.

Names appear when focused and may appear during sufficiently deep/focused parent inspection where layout permits.

**[DERIVED]** Accessibility semantics must expose satellite name/relation without requiring precise moon tapping.

---

## Z. Accessible Companion List

**[DECIDED]** Orrery provides a conventional accessible **Contacts in this System** companion list reachable from Orrery controls.

**[DECIDED]** This list represents the same currently active System rather than becoming another independent Dashboard/search universe.

It should support at least:
- contact identity,
- relationship-health state,
- Gravity/closeness context as appropriate,
- focusing that contact in Orrery,
- opening Profile.

**[DECIDED]** The companion list exists for screen-reader, switch-control, motor/precision, and general findability needs; it may also be useful to any user who simply cannot locate someone spatially.

**[DERIVED]** The graphical Orrery should remain semantically accessible, but accessibility must not depend on making every 2.5D gesture/collision interaction perfectly manipulable through the canvas alone.

---

## AA. Reduced Motion

**[DECIDED]** Reduced Motion is supported but is not enabled by default unless inherited from the user's/system accessibility preference.

With Reduced Motion:
- ambient drift/twinkle and nonessential motion stop or simplify,
- inertia is disabled,
- Focus Zoom becomes a short direct interpolation/fade,
- Recenter docking becomes a short direct transition,
- membership changes use fades/direct repositioning,
- future polished System switch animation falls back to fade/reposition.

**[DECIDED]** User-controlled tilt/yaw/pan/zoom remain available because they are direct spatial controls, not ambient animation.

---

## AB. Phase 9 Boundary — Orrery Systems

**[DECIDED]** Custom System authoring is substantial enough to be split into a separate sibling phase rather than bloating Phase 8.

Phase 8 owns:
- System consumption/resolution contract,
- built-in Systems,
- category-derived Systems,
- built-in switcher,
- active-System visualization.

The later **Orrery Systems** phase owns custom user-authored Systems.

**[DECIDED]** Custom Systems must eventually support more than preformed rules; users need the ability to create arbitrary useful groupings through explicit single/bulk contact selection as well.

**[DERIVED]** The Orrery System model should be capable of representing live rule-based membership and explicit membership without forcing Phase 8 to implement the custom builder.

**[DEFERRED TO ORRERY SYSTEMS PHASE]**
- create System
- rename/edit/delete System
- custom Population/filter predicates
- manual single/bulk contact membership
- hybrid rule/manual membership semantics
- include/exclude override semantics
- System preview/member counts
- custom System management
- default custom System behavior
- polished System-switch animation

---

## AC. Future System-Switch Animation

**[DECIDED FOR LATER SYSTEMS PHASE]** Polished switching between Systems should use a **spin + shedding/capture** visual model rather than a wholesale light-speed scene replacement.

Intended semantics:
- narrowing → rotational impulse; departing bodies peel/shed outward while retained bodies preserve continuity,
- expanding → incoming bodies are captured/streamed into the system while retained bodies remain intelligible,
- animation intensity/speed responds to how different the source/destination Systems are.

Small membership differences should cause subtle transitions; very large differences may be more dramatic.

**[DERIVED]** Reduced Motion replaces the polished transition with restrained fade/reposition behavior.

**[DEFERRED]** Final animation curves, spin counts, streak treatment, capture physics/illusion, and timing.

---

## AD. Category Administration Gap

**[DECIDED / CROSS-PHASE WATCH ITEM]** Categories are semantically important to Dashboard filtering and Orrery category-derived Systems, but current user-facing category administration is incomplete.

Users need a later product surface to create/rename/reorder/delete/manage category values rather than being permanently constrained to seeded categories.

**[DERIVED]** This is not Phase 8 scope. It most naturally belongs to Settings/Contacts administration or another owning data-management surface, with Rapid Capture/Edit Contact consuming those managed category definitions.

**[DERIVED]** Phase 8 must not hardcode built-in category names into Orrery System logic; category-derived Systems should consume the actual category domain model.

---

## AE. Future Social Graph / Satellite Orrery

**[DEFERRED]** A richer **Social Graph / Satellite Orrery** is explicitly preserved as future milestone/product work.

The future concept includes real relational connections between Orbit contacts and potentially first-/second-level social-world semantics.

Potential scope includes:
- first-level versus second-level contact semantics,
- contact-to-contact relationship edges,
- real Orbit contacts orbiting other contacts,
- primary/satellite hierarchy,
- a contact connected to multiple people,
- promotion of a satellite/second-level contact to a primary sun-orbit contact as the user's relationship changes,
- whether satellites may have satellites,
- graph traversal and graph-aware Focus Zoom,
- social-cluster navigation,
- graph-aware Systems,
- relationship-edge editing,
- Profile graph presentation,
- graph-aware search/findability,
- graph layout/overlap rules,
- relationship directionality/symmetry,
- behavior when a parent node is excluded by a System/filter,
- interaction between relationship health, Gravity, and graph hierarchy.

**[DECIDED]** Phase 8 Relationship Satellites are intentionally **not** this graph system. They are a lightweight visualization of existing unlinked person relationships only.

**[DERIVED]** Phase 8 architecture should avoid assuming every rendered body must directly orbit the sun.

**[DERIVED]** Camera/framing should operate on arbitrary projected body bounds/sets so a future graph-aware layout can reuse the same inspection camera.

**[DERIVED]** Separate domain/layout computation from projection/camera/rendering so a future layout engine can introduce hierarchical/sub-orbital positions without rewriting the camera system.

**[DERIVED]** Existing structured linked Relationships from the Contact Knowledge Foundation provide a legitimate future foundation; do not introduce speculative graph schema now.

---

## AF. Cross-Phase Constraints

- **Theme & Visual System:** Orrery may use stronger perspective, glow, edge-to-edge rendering, starburst/Polaris treatment, and motion while respecting tokens, contrast, accessibility, reduced motion, and performance fallbacks.
- **App Shell & Navigation:** Orrery remains a top-level tab; Profile opened from Orrery returns to the originating camera/session state; transient Focus/Cluster state dismisses before route navigation where appropriate.
- **Contact Knowledge:** Relationship Satellites consume existing structured person relationships; linked-contact relationships remain real semantic records rather than renderer-specific text parsing.
- **Dashboard Data & State:** Orrery may reuse matching population/filter predicates at the domain level, but does not inherit Dashboard's current query state or conventional sorting UI.
- **Dashboard/Card:** Gravity remains derived-never-stored and cannot become user-editable Orrery visual mass.
- **Profile:** full contact details remain Profile-owned; Orrery focus/context stays lightweight.
- **Settings / Contacts administration:** category CRUD/management remains outside Phase 8 but is a required follow-up gap because category Systems depend on user-managed categories.
- **Orrery Systems:** owns custom saved Systems, explicit membership, hybrid rules, management UX, and polished spin/shedding/capture transitions.
- **Future Social Graph:** Phase 8 should preserve extensibility but must not implement first-/second-level contact graph semantics now.
- **Responsive & Release Hardening:** later phase audits landscape/tablet geometry, accessibility scale, performance, gesture conflicts, device-specific GPU behavior, and final density/camera tuning.

---

## Explicitly Deferred

- current Relationship-mode redesign/replacement as a second Orrery mode
- unrestricted true-3D/free-flight camera
- upside-down/below-plane camera movement
- extreme map-like zoom ranges
- exact camera limits and numeric zoom/tilt values
- exact inertia constants
- exact recenter/docking timing/easing
- exact collision-nudge algorithm/thresholds
- exact contact-size Gravity mapping
- exact semantic-label thresholds
- numeric user density slider
- custom System builder/management
- manual/hybrid custom System semantics
- polished System-switch spin/shedding/capture implementation
- user-defined System animation options
- real contact-to-contact graph layout
- first-/second-level contacts
- real Orbit contacts as moons of other Orbit contacts
- graph edge editing
- graph-aware Systems
- moons-of-moons
- automatic graph inference
- speculative graph-specific database fields
- category administration implementation
- final Polaris artwork
- final relationship-satellite artwork/orbit styling

---

## Phase Success Criteria

1. Orrery presents one clear canonical relationship-health/status visualization rather than retaining the current confusing Status/Relationship mode split.
2. Users can navigate a stable sun-centered Orrery through pan, pinch zoom, bounded tilt, and yaw without converting the product into unrestricted 3D free flight.
3. Perspective is visually meaningful: near/far contacts have noticeable bounded depth scaling while avatars and labels remain screen-facing/readable.
4. Derived Gravity modestly influences contact visual mass without overwhelming zoom/perspective or becoming editable state.
5. Home framing remains readable at modest contact counts, uses the selected Spacious/Balanced/Compact density, and allows larger systems to extend beyond the viewport instead of compressing indefinitely.
6. Large Orreries use meaningful world-space ring spacing, stable minimal collision nudging, and camera exploration rather than collapsing contacts into unusable geometry.
7. Semantic zoom progresses from overview to identity to deeper lightweight context without turning Orrery into a Profile substitute.
8. A distant unambiguous contact tap focuses/centers and zooms to name-visible inspection; a tap when already sufficiently inspected opens Profile.
9. Ambiguous touch regions enter Cluster Focus, frame the plausible contact group, and provide a conventional bottom contact panel rather than arbitrarily choosing one body.
10. Camera state restores when returning from Profile during the same navigation session but returns to canonical Home on fresh launch/visit.
11. Polaris provides a stable visual north reference; Polaris tap resets yaw only; the target/recenter control restores the complete canonical camera/focus state.
12. Recenter uses distance-adaptive continuous Acquire/Approach/Dock-style recovery, with simpler direct behavior under Reduced Motion.
13. Ordinary drag pans; ring reorder requires an intentionally prolonged hold plus clear activation feedback, preventing accidental reorder while navigating.
14. Orrery exposes built-in dynamic Systems through a compact dropdown, with All Contacts default plus Favorites, Needs Attention, Not Contacted, Snoozed, Chargers, and category-derived Systems.
15. Orrery provides Spacious/Balanced/Compact density presets and an optional Relationship Satellites view setting without cloning Dashboard's control surface or adding conventional sort.
16. When enabled, existing unlinked person-like structured Relationships can appear as lightweight subordinate satellites with focusable name/relation context while remaining explicitly non-contact entities.
17. The currently active System has an accessible conventional companion list that can identify contacts, expose relationship-health/Gravity context, focus them in the Orrery, and open Profile.
18. Reduced Motion removes ambient/inertial/theatrical motion while preserving directly controlled pan/zoom/tilt/yaw and necessary spatial feedback.
19. Camera/layout architecture can later accept hierarchical/sub-orbital body positions without Phase 8 implementing the deferred Social Graph / Satellite Orrery itself.
20. Custom System authoring and polished System switching remain cleanly separable into the new Orrery Systems sibling phase.

---

## Notes for GSD / Roadmapper

- Treat this as the Orrery **camera/scale/exploration** phase, not as a greenfield Orrery build. Existing relationship-health rendering/domain behavior should be reused where compatible.
- Remove/simplify the current Status/Relationship dual-mode product instead of carrying the unintuitive Relationship mode forward.
- The coherent implementation center is a separated world/layout → camera/projection → renderer architecture.
- Do not introduce Three.js/a game engine merely because tilt/yaw/perspective are requested; prefer the existing Skia/Reanimated/Gesture Handler stack unless implementation evidence proves it inadequate.
- High-count usability is not solved by shrinking rings forever. Preserve world-space legibility and let the Orrery become larger than the viewport.
- Balanced density should visually calibrate around roughly six generously presented contacts and remain comfortable toward roughly ten before outer extent increasingly leaves the viewport; treat these as UX targets, not literal hard limits.
- Keep Gravity visual-size influence restrained and derived.
- Implement ambiguity handling at the interactive hit-target level, not only visible overlap.
- A reusable frame-arbitrary-bodies camera primitive is important both for Cluster Focus now and future graph-aware focus later.
- Phase 8 owns built-in Systems + switcher only. Do not pull custom System authoring/management or polished spin/shedding/capture transitions into this phase.
- Relationship Satellites are a deliberately lightweight use of existing unlinked structured Relationships. Do not mutate them into first-/second-level contact graph semantics.
- Preserve the deferred Social Graph / Satellite Orrery section in downstream milestone context; it is an intentional future product direction, not discarded ideation.
- Flag category administration as a cross-phase gap, but do not solve it inside Orrery.
- Accessibility must include a conventional companion path through the currently displayed System rather than relying solely on precise manipulation of a 2.5D canvas.
- Exact camera constants, animation curves, hit radii, density geometry, label thresholds, and performance tuning remain implementation/device-testing work unless testing reveals a product contradiction.
