# Dossier — Theme & Visual System

**Status:** complete · Interrogated through 2026-08-28 · Product decisions settled; remaining implementation details are derived unless later device testing reveals a visual problem.

## Scope

This dossier defines Orbit's cross-app visual system for the release-quality UI/UX milestone.

It covers theme package architecture, light/dark/system appearance behavior, Galaxy and Standard visual identities, accent-color customization, background-image system, surface opacity/glassmorphism, typography roles and future extensibility, component geometry, spacing/density principles, status-color semantics, icon-system strategy and later custom-icon replacement, card/section hierarchy, modal/sheet styling, button hierarchy, destructive-action treatment, visual accessibility, ambient motion, theme persistence, Orrery-specific exceptions, and local bundling of assets.

It does not fully redesign individual screens. Later phases inherit this visual constitution.

## Decision Legend

- **[DECIDED]** explicitly chosen during owner interrogation.
- **[DERIVED]** implementation/architecture consequence of the chosen product direction.
- **[DEFERRED]** intentionally postponed.

---

## A. Theme Architecture

**[DECIDED] Theme package and appearance mode are separate axes.**

Theme package:
- Galaxy
- Standard

Appearance mode:
- Light
- Dark
- Follow System

This yields Galaxy Light/Dark and Standard Light/Dark while allowing theme switching without implicitly changing appearance mode.

**[DECIDED] Follow System ships from the start.**

**[DECIDED] First-launch default is Galaxy + Follow System.**

Onboarding may offer an early appearance choice.

---

## B. Theme Identities

**[DECIDED] Standard is soft-modern and neutral rather than sterile.**

It should feel clean, restrained, friendly, modern, and calmer than Galaxy.

**[DECIDED] Galaxy is dramatic deep-space Orbit branding.**

It should use deep-space ambience, luminous accents, tasteful glow, and a strong celestial identity without defaulting to neon cyberpunk.

**[DECIDED] Themes share layout and information architecture.**

Theme switching must not materially change density, placement, hierarchy, navigation, or interaction patterns.

**[DECIDED] Small decorative differences are allowed.**

Galaxy may use stronger glow/transparency/luminous edges; Standard may use flatter borders, softer shadows, and cleaner opaque surfaces.

**[DERIVED] Use one semantic component API across both themes.**

Avoid parallel Galaxy/Standard component families except where a truly specialized case requires it.

---

## C. Accent Color System

**[DECIDED] Users choose from a curated accent palette.**

Initial size: roughly 8–10 choices.

**[DECIDED] Accent affects controls plus restrained decorative highlights.**

Likely uses include active nav state, FAB, toggles/sliders, selected controls, links, focus states, and small highlights.

**[DECIDED] Owner/star color is separate from UI accent color.**

**[DERIVED] Curated accents should be validated across all supported theme/mode combinations.**

---

## D. Theme Memory / Defaults

**[DECIDED] Each theme package has its own default accent and background.**

**[DECIDED] Galaxy and Standard remember their own appearance choices separately.**

Switching back to a theme restores its last-used accent/background.

**[DECIDED] Appearance settings preview live.**

Theme, mode, accent, and background changes update immediately.

**[DERIVED] Theme-critical preferences restore before main UI render to avoid a wrong-theme flash.**

---

## E. Background System

**[DECIDED] Preset backgrounds are supported.**

User-uploaded backgrounds are deferred.

**[DECIDED] Theme packages provide defaults/recommendations, but users can choose from the shared bundled preset library.**

**[DECIDED] Ship approximately 4–5 curated backgrounds per theme.**

Galaxy may include starfields, nebulae, and deep-space gradients.

Standard may include soft abstract textures, gradients, and restrained geometric/organic treatments.

**[DECIDED] “None / Solid” is a valid background option.**

**[DECIDED] Backgrounds remain fixed while content scrolls.**

**[DECIDED] Surface opacity varies by content density.**

Presentation screens may show more background; dense forms/settings use more opaque surfaces. Readability wins.

**[DECIDED] Standard backgrounds remain visually quieter than Galaxy.**

**[DECIDED] All shipped visual assets are bundled locally.**

Appearance has no network dependency in this milestone.

**[DEFERRED] Downloadable/remote background packs.**

---

## F. Glassmorphism / Surface Treatment

**[DECIDED] Galaxy may use a strong glassmorphism identity.**

Translucency, blur, luminous borders, glow, and layered depth are allowed.

**[DECIDED] Standard remains cleaner/flatter.**

**[DECIDED] Dense content can become more opaque even within Galaxy.**

**[DECIDED] Focused forms retain themed backgrounds but place content on mostly opaque readable surfaces.**

**[DERIVED] Blur must degrade gracefully if device/platform performance is poor.**

The semantic requirement is a glass-like surface, not mandatory expensive rendering.

---

## G. Ambient Motion

**[DECIDED] Galaxy backgrounds may use very subtle ambient motion.**

Examples: slow star drift, restrained twinkle, minimal parallax.

**[DECIDED] Orbit respects OS reduced-motion preferences.**

Nonessential motion stops or simplifies.

**[DERIVED] Orrery remains the visually expressive motion-heavy surface.**

---

## H. Typography

**[DECIDED] Use a distinctive display role plus a highly readable body/UI role.**

**[DECIDED] Typography architecture must support future theme-specific diversity.**

Use semantic roles such as display, heading, body, label, and caption so later themes can remap fonts without rewriting screens.

**[DECIDED] Hierarchy is screen-dependent.**

Presentation screens may be more expressive; utility/forms stay tighter and functional.

**[DECIDED] Respect system text scaling broadly.**

**[DECIDED] Reflow before truncation or font shrinking.**

---

## I. Rounded Geometry

**[DECIDED] Orbit intentionally embraces a very rounded visual language.**

The orbit/planet/ring metaphor justifies circular and pill-like geometry.

**[DERIVED] Rounding should still preserve hierarchy; not every component should look identical.**

---

## J. Spacing & Density

**[DECIDED] Default density is moderate.**

Principle: compact within components, generous separation between conceptual groups.

**[DECIDED] Major conceptual groups use visible hierarchy.**

**[DERIVED] Use a formal spacing scale rather than arbitrary per-screen values.**

---

## K. Cards, Sections, and Containers

**[DECIDED] Cards are currently overused and should no longer be the default wrapper for everything.**

Direction is “cards where they represent meaningful conceptual units,” otherwise prefer flatter sections/dividers.

**[DECIDED] Major conceptual sections get clear headers.**

---

## L. Status / Semantic Color

**[DECIDED] Relationship/status colors use stable semantic hue families across themes.**

Stable/Wobbly/Decaying/Rogue should stay recognizable while luminance/saturation may vary for contrast.

**[DECIDED] Color is never the only status cue.**

Use text, icon, shape, pattern, or legend as appropriate.

**[DECIDED] Status icons should mix celestial metaphor with familiar severity cues.**

**[DECIDED] Statuses should have distinct silhouettes/shapes, not only recolored versions of one icon.**

---

## M. Icon System

**[DECIDED] Orbit will not build a full custom icon family during this milestone.**

Custom icon overhaul is deferred to protect time-to-market.

**[DECIDED] Use one cohesive base icon family now.**

**[DECIDED] Architecture must make later custom-icon replacement easy.**

All icons should flow through a centralized semantic icon registry/component rather than screens importing arbitrary assets directly.

**[DECIDED] Icon registry supports visual state/variant.**

Examples: outline/filled, active/inactive, selected/unselected.

**[DECIDED] Normal state may be outline and active state filled.**

**[DEFERRED] Fully custom Orbit icon family.**

**[DERIVED] Business logic/screens should not couple directly to third-party icon names.**

---

## N. Illustration System

**[DECIDED] Architect for semantic illustration assets but do not build a full illustration library now.**

**[DECIDED] Empty-state richness depends on importance.**

Routine empty states use icon + concise copy + CTA. Major first-use moments may use richer illustration.

---

## O. Modal / Sheet Language

**[DECIDED] Modal and sheet styling is standardized through shared variants.**

Expected variants:
- compact sheet
- detail/half-height sheet
- full-screen modal
- confirmation dialog

They share radius language, scrim behavior, safe-area behavior, spacing, typography hierarchy, and drag-handle conventions where relevant.

---

## P. Button Hierarchy

**[DECIDED] Orbit uses a formal action hierarchy.**

Roles:
- Primary
- Secondary
- Tertiary/text
- Destructive
- Icon-only

**[DECIDED] Destructive actions use a distinct semantic visual language.**

Color alone is not the only cue.

---

## Q. Accessibility / Contrast

**[DECIDED] Functional content targets strong AA-equivalent contrast.**

Decorative effects have more freedom if they carry no required meaning.

**[DECIDED] Accessibility must survive both Galaxy and Standard themes.**

**[DERIVED] Accents, glass surfaces, text colors, and status colors should be QA’d across supported theme/mode combinations.**

---

## R. Orrery Visual-System Exceptions

**[DECIDED] Orrery follows the current theme package but gets a specialized visualization background.**

It does not have to use the same ordinary selected background.

**[DECIDED] Orrery is an intentional visual exception.**

It may use stronger glow, edge-to-edge rendering, more motion, fewer opaque surfaces, and custom control overlays while still respecting shared tokens and accessibility.

---

## Derived Design-System Architecture

**[DERIVED] Full semantic token system.**

At minimum centralize:
- color
- typography
- spacing
- radii
- elevation/shadow/glow
- opacity
- motion duration/easing
- icon sizing
- surface treatment

**[DERIVED] Meaningful colors resolve through semantic roles rather than direct hardcoding.**

**[DERIVED] Theme packages resolve semantic tokens rather than forking screen implementations.**

**[DERIVED] Theme changes do not alter information density.**

**[DERIVED] Maintain enough in-project asset provenance/license information to ship purchased/third-party/generated assets safely.**

---

## Cross-Phase Constraints Exported

- **[theme → all screens]** Use the shared semantic design system rather than per-screen styling systems.
- **[theme → Dashboard/Profile/Settings]** Do not restore pervasive card-boxing.
- **[theme → forms]** Dense forms favor more opaque readable content surfaces.
- **[theme → accessibility]** Color cannot be the sole meaning carrier; text scaling, contrast, and reduced motion remain supported.
- **[theme → icon usage]** Screens use semantic icon identifiers.
- **[theme → future icon milestone]** Custom icons should be swappable primarily through registry mappings/assets.
- **[theme → Orrery]** Orrery may be more immersive but remains tokenized and accessible.
- **[theme → Settings]** Appearance configuration exposes Theme, Mode, Accent, and Background with live preview.
- **[theme → onboarding]** Initial default is Galaxy + Follow System.
- **[theme → performance]** Glass/blur may gracefully fall back when required.

---

## Explicitly Deferred

- user-uploaded custom backgrounds
- downloadable remote theme packs
- CDN/backend appearance delivery
- fully custom Orbit icon family
- full illustration library
- user-controlled density
- unrestricted accent picker
- radically different theme-specific layouts
- theme-specific font families, though architecture supports them later
- exact final font families
- exact token values
- exact animation timings
- exact background assets
- exact accent palette
- exact custom status artwork

---

## Phase Success Criteria

Phase 2 is successful when:

1. Orbit independently supports Galaxy/Standard and Light/Dark/Follow System.
2. Galaxy and Standard share one functional component system while looking clearly distinct.
3. Theme, accent, and background changes preview immediately and restore without a visible wrong-theme flash.
4. Each theme remembers its own prior appearance choices.
5. The app ships with a curated bundled background library plus a solid/no-background option and requires no network for appearance.
6. Galaxy supports a strong but readable glass/deep-space identity while Standard offers a calmer modern alternative.
7. Typography, spacing, radii, colors, motion, icon sizing, and surfaces resolve through reusable semantic primitives.
8. User-selectable accents remain accessible across supported modes/themes.
9. Status meaning remains understandable without color alone.
10. Screens use a semantic icon system that can later swap in custom Orbit icons without broad rewrites.
11. Forms, modals, cards, buttons, and sections inherit consistent visual hierarchy.
12. Reduced-motion, dynamic text, and functional contrast remain supported.
13. Orrery can use a specialized immersive theme-compatible treatment without breaking shared accessibility/token rules.

---

## Notes for GSD / Roadmapper

- This phase is a prerequisite for later surface redesigns because it establishes reusable visual primitives.
- Requirements should focus on observable theming/personalization plus enabling system contracts needed for consistency.
- Do not turn the deferred custom-icon overhaul into release-critical work.
- Do not create a remote appearance/backend subsystem solely to support bundled backgrounds.
- Galaxy may be visually ambitious; Standard must remain a genuinely calmer alternative.
- Highly rounded geometry is intentional branding.
- Cards are explicitly considered overused in the current app; later phases should not interpret “design system” as “wrap everything in cards.”
