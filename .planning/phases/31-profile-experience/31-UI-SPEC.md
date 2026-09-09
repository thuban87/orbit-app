---
phase: 31
slug: profile-experience
status: approved
shadcn_initialized: false
preset: none
created: 2026-09-09
reviewed_at: 2026-09-09
---

# Phase 31 — UI Design Contract

> Visual and interaction contract for the release-quality Contact Profile. Generated from the Phase 31 context, the complete Profile dossier, its binding planning notes, accepted ADRs, and the live React Native implementation.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | Orbit's manual React Native semantic design system |
| Preset | Not applicable; this is Expo/React Native, so the web-only shadcn initialization gate does not apply |
| Component library | Orbit primitives used by this phase: `AppText`, `Button`, `GlassSurface`, `Sheet`, `ConfirmDialog`, `BackgroundHost`, `Avatar`, and semantic `Icon` |
| Icon library | `@expo/vector-icons` only through Orbit's semantic icon registry; never raw glyph names in feature code |
| Font | Space Grotesk SemiBold for display/heading; Inter Regular/SemiBold for body/label/caption |
| Theme packages | Galaxy and Standard, each in light/dark/system mode with curated accent and background selections |

Phase 23's live primitives and tokens are the source of truth. Phase 31 extends their use; it does not add a parallel Profile-only visual system. All colors, surface treatments, spacing, radii, typography, icon sizes, motion, backgrounds, status hues, and Gravity ramps resolve through theme tokens. No hardcoded color or arbitrary opacity is permitted.

Profile is presentation-first: it should feel more personal and visually layered than Dashboard List/Card, while remaining a fast one-column reading surface outside Relationship Overview. The fixed Hero is the identity anchor. Customization begins below it.

### Component inventory

| Component / surface | Contract |
|---------------------|----------|
| Profile screen | One vertical scroll surface beneath shell chrome. The Hero is always first and structurally fixed; “fixed” means invariant across templates, not sticky to the viewport. |
| Hero | Large circular avatar, name, Category, Favorite, Message, Call, and overflow over the resolved Profile background/readability treatment. |
| Profile section | Collapsible `GlassSurface`; heading row exposes title, concise summary, and expanded/collapsed state. Presentation density for ordinary reading, comfortable density for longer content. |
| Relationship Overview | Auto-packed tile grid inside its own top-level section. This is the only tile-dashboard treatment on Profile. |
| Overview tile | Semantic module with declared compact `1x1` and/or wide `2x1` variants. Tile height grows for text scaling; text is never shrunk to preserve a grid. |
| Remembered-information card | Compact one-column summary using `MemoryCard` semantics: no blank metadata rows, two-line useful preview, semantic markers, detail on tap. |
| Contact method row | One method per row with type/label, display value, Primary marker where relevant, and explicit actionable or unavailable state. |
| Layout editor | Focused, expandable Profile overlay sheet with live preview, ordered module list, visibility, default expansion, allowed size variants, drag handles, Move Up/Down alternatives, `Save layout` and `Cancel layout changes`. |
| Template/background managers | Canonical Profile-owned overlay sheets entered from the existing Profile header overflow. Later Settings may reuse the same feature-owned sheet content rather than recreate it. |
| Lightweight explanations and pickers | Profile-hosted overlay `Sheet`: compact for frequency/snooze/template choices; detail or expanded height for Status/Gravity/Intensity explanations, knowledge detail, and longer management work. |
| Background crop | Focused, expandable Profile overlay sheet using drag to reposition and pinch to crop. Reuse the existing Reanimated/Skia crop interaction pattern; the preview uses the actual Hero aspect. |

---

## Spacing Scale

Phase 31 uses the standard subset below. The shared Phase 23 `SPACING.md = 12px` token remains valid system truth for existing components, but Phase 31 does not apply it; dense Profile rows use 8px internal spacing or 16px padding instead. This phase neither removes nor redefines the inherited token.

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Icon-to-label gaps and compact metadata |
| `sm` | 8px | Related controls, chips, card internals |
| `base` | 16px | Default card/row padding and screen edge inset |
| `lg` | 24px | Section separation and focused workflow padding |
| `xl` | 32px | Major visual breaks |
| `2xl` | 48px | Hero/body separation where the background composition needs it |

Exceptions: 44x44px is the minimum interactive target and is a target-size floor, not a spacing token. The Hero avatar is 112x112px at ordinary width and may reduce to 96x96px only when width or large text requires a reflow. Gravity sphere diameters are data encodings rather than spacing; constrain them to declared tile variants.

Use `RADII`: `md` (12px) for tiles/cards, `lg` (16px) for section surfaces, `xl` (24px) for focused overlays, `pill` for chips, and `full` for avatar/circular icon controls.

---

## Typography

Use exactly the existing four distinct sizes and two weights. Feature components consume roles through `AppText`, not raw font values.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Caption / Label | 14px | 400 / 600 | 20px (1.4) |
| Body | 16px | 400 | 24px (1.5) |
| Heading | 20px | 600 | 25px (1.25) |
| Display | 28px | 600 | 34px (about 1.2) |

- Contact name uses Display and wraps to two lines before reflowing the Hero; never ellipsize a normal Profile name.
- Section headings use Heading for top-level sections and Label for child sections.
- Tile value/status uses Heading; its label and time-window context use Label/Caption.
- Long body content uses Body, with no fixed-height container. Summary cards may clamp their body preview to two lines because the complete value is available on tap.
- Status, Gravity tier, Intensity tier/context, disabled reasons, and assignment state are textual. Color, iconography, sphere size, and histogram bars are reinforcing channels only.

---

## Color

Values are semantic runtime tokens, not fixed hex values, because accent, package, and mode are user-selectable.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `colors.background` plus the resolved Profile/background asset | Page field, Hero backdrop, gaps between surfaces |
| Secondary (30%) | `GlassSurface` resolving `surface`, `surfaceElevated`, `border`, and `borderStrong` at presentation/comfortable density | Section shells, Overview tiles, remembered-information cards, sheets and menus |
| Accent (10%) | `accent`, `onAccent`, and `accentText` roles from the active curated accent | Filled Message CTA, selected/active editor controls, focus/selection rings, tertiary links, AI sparkle only |
| Destructive | `danger` + `onDanger` | Irreversible template/background deletion and permanent data actions only; never Orbit status or Off Limits |

Accent reserved for: the filled Message action; current selection in template/background/frequency/snooze pickers; object-specific save actions in focused editors; focus/selection affordances; `View all`, `View history`, and equivalent tertiary links; AI sparkle on opted-in items. Call always uses Secondary treatment so the Hero hierarchy and geometry do not change with method availability. Favorite uses the semantic filled/outline star pair and does not become a second primary CTA.

Status color mapping remains app-wide: `statusStable`, `statusWobble`, `statusDecay`, and `rogue`. Gravity uses `gravityTiers`. Intensity remains neutral and uses text/surface/border tokens rather than relationship-status colors. Off Limits uses a semantic caution/avoid icon with restrained status-adjacent emphasis; it is not an error and never uses `danger` as its sole distinction.

For Galaxy, use glass-forward Profile surfaces. For Standard, use flatter opaque surfaces. Both packages preserve identical hierarchy and interactions. Surface opacity follows Phase 23's density rule: presentation surfaces show more background; longer text and management forms use comfortable/dense opacity. Automatic scrim/gradient treatment must keep Hero text and controls legible over every bundled or user image without exposing blur/brightness/overlay sliders.

---

## Copywriting Contract

Use sentence case and relationship-centered language. Avoid database terminology, “custom column,” scores, and invented relationship judgment.

| Element | Copy |
|---------|------|
| Primary CTA | `Message` |
| Secondary Hero action | `Call` |
| No usable message method | `Add a phone number or email to message this contact.` |
| No usable call method | `Add a phone number to call this contact.` |
| Profile load error | Heading: `Couldn't load this profile` · Body: `Your contact is still on this device. Try again, or go back.` · Action: `Try again` |
| Empty Relationship Overview fact | `Not available yet` with the module-specific next fact, never a fabricated zero |
| Empty knowledge section | `{Section name} · Nothing added yet` |
| Empty Contact Methods | `Contact Methods · None` |
| Empty Interaction History | `Interaction History · No interactions yet` |
| Empty Memories | `Memories · Nothing saved yet` |
| Hidden recovery toggle | `Show hidden` / `Hide hidden` |
| Repeatable overflow | `View all {N} memories` (and equivalent correct noun/count) |
| Off Limits helper | `Avoid bringing these up` |
| Unbound Status | `Not tracked` · `Set a contact frequency to see Orbit Status.` |
| Unbound Intensity | `This month` · `No contact frequency — showing this month's activity instead.` |
| No-history Last Interaction | `No interactions yet` |
| Inactive Snooze | `Not snoozed` |
| Active Snooze | `Snoozed until {local date}` |
| Save failure | `Couldn't save your changes. Nothing was applied. Try again.` |
| Background processing failure | `Couldn't prepare that image. Choose another image or try again.` |
| Reset confirmation | Title: `Reset profile presentation?` · Body: `This removes this contact's layout, collapsed-section, and background overrides. Contact information, Favorite, Snooze, AI permissions, and Things to Remember will not change.` · Confirm: `Reset presentation` |
| Delete layout template | `Delete layout template? Profiles using it will fall back to their Category or default layout. Contact-specific freeform layouts will not change.` |
| Delete background template | `Delete background template? Profiles using it will fall back to their Category or default background. Contact information will not change.` |
| Unsaved editor exit | Title: `Discard changes?` · Actions: `Discard changes`, `Keep editing` |

Archive remains a recoverable contact action and follows the existing Archive behavior/copy; do not style it as permanent deletion. `Reset Profile Presentation` affects presentation only. Permanent contact deletion remains outside this Profile surface.

---

## Information Architecture and Layout

### Ordinary Profile

The vertical order is:

1. Shell app bar: Back and Profile overflow.
2. Fixed-structure Hero.
3. Relationship Overview.
4. Things to Remember.
5. Contact Methods.
6. Interaction History.

The Hero is excluded from layout templates. It scrolls normally with the Profile; it is not a sticky overlay that reduces reading space. The resolved Profile background may span the Profile canvas, but automatic scrim/gradient and semantic surfaces preserve contrast.

At ordinary phone width, use 16px page insets. The Hero centers the 112px avatar, name, and Category. Favorite and overflow occupy stable 44px targets near the identity header. Message and Call occupy a stable two-control row beneath identity; both remain rendered when disabled, so missing methods never shift geometry. If large text makes two equal controls unreadable, stack them full-width in the same Message-then-Call order.

The body uses one column of top-level surfaces. Relationship Overview alone contains a sub-grid. The grid derives columns from available width: normally two equal columns, one column under large text/narrow width, and more only where a wider device can preserve minimum readable tile width. Auto-pack in module order and never leave a permanent hole that another module can fill.

### Section shell

Each enabled top-level/child section has:

- a 44px-minimum heading control;
- visible title and summary/count;
- a semantic expand/collapse icon;
- `accessibilityState.expanded`;
- body content only when expanded.

Enabled empty sections remain visible in ordinary mode but initialize collapsed with the documented summary. User-expanded/collapsed state persists per contact across navigation and relaunch and overrides the active template default. Child state is scoped to its parent semantic module ID.

### Relationship Overview tiles

Factory module order and variants:

| Module | Factory variant | Required content and interaction |
|--------|-----------------|----------------------------------|
| Orbit Status | Wide `2x1` | Literal Stable/Wobbly/Decaying/Rogue label, reinforced by status token; tap opens actual-factor explanation. Unbound/no-cadence shows `Not tracked`, not a false Stable state. |
| Gravity | Compact `1x1` | Named `thin`/`building`/`solid`/`deep` tier plus bounded sphere. The visual range must read tiny-to-huge while staying within the tile. Tap opens concise derivation explanation; never editable. |
| Intensity | Wide `2x1` | Neutral compact histogram, named/contextual activity tier, and explicit period. For Bound contacts the window is one contact interval. For Unbound or null cadence, use the current calendar `Month` window, label it `This month`, and do not present the result as cadence-relative. |
| Last Interaction | Wide `2x1` | Relative recency plus, when available, local absolute date, interaction type/channel, and two-line note preview. No history shows the documented empty fact. |
| Contact Frequency | Compact `1x1` | Current canonical cadence. Tap opens compact selector; selection applies immediately and refreshes Status/Intensity without a separate confirmation action. Unbound with dormant cadence names it as inactive; never infer one from null. |
| Snooze | Compact `1x1` | Quiet `Not snoozed` state or prominent `Snoozed until {local date}`. Tap opens presets, `Choose date`, and `Unsnooze` when active. |

The Status explanation names only actual inputs: last interaction/last contacted, configured cadence, elapsed progress, and Rarely Responds behavior where applicable. It does not mention depth, sentiment, Gravity, Intensity, or any new “Health” score. Dates use local-date utilities.

This is the one shared Phase 31/32 no-cadence ruling: Phase 32 omits the cadence-dependent `Cycles` lens for an Unbound/null-cadence contact, opens the current calendar `Month` instead, and computes Intensity over that same Month window. It never substitutes a dormant or fabricated cadence. Phase 31's compact tile uses the same calendar-Month calculation and `This month` wording.

The custom Snooze date sheet is narrowly scoped: date picker, `Cancel snooze`, and `Set snooze`. It does not become a reminder-management screen or navigation route. `Set snooze` commits the selected end date, closes the sheet, and refreshes the tile; a failed write keeps the choice visible and shows the save error.

### Things to Remember

Use a one-column child-section list, never a second tile dashboard. Factory child order:

1. Pinned / Featured
2. Last Talked About
3. Key People
4. Current Location
5. Memories
6. Custom Fields
7. Off Limits
8. Imported from Contacts App

Imported from Contacts App is enabled and collapsed by default. Off Limits is enabled and visible by default. All children can be reordered within Things to Remember, shown/hidden, and assigned a default expanded state; they cannot leave the parent.

Pinned / Featured references the original items and shows at most three highlighted summaries followed by `View all` when needed. Hidden items never appear here, even if pinned.

Last Talked About and Current Location show the current value first. Where history exists, `View history` opens the existing conventional history surface. Do not expand a growing history inline.

Key People rows show avatar/initials, person name, relation, and optional concise note. Linked Orbit contacts have a Profile affordance; unlinked people remain readable without a fake route. Linking and substantive editing stay in their owning workflow.

Memory cards show type/custom label, useful value/title, at most two lines of note/body preview, optional meaningful date, link icon, pinned/outdated markers, and ordinary AI sparkle when opted in. Blank fields occupy no space. Tap opens complete detail. Long-press opens `Edit`, `Pin`/`Unpin`, and `Hide from Profile`; destructive controls do not live permanently on cards.

Custom Fields preserve type-aware formatting and configured `field_group` grouping. Groups are data organization, not a third layout-customization level. Invalid raw values remain visible with their existing error/fix affordance. The Profile also exposes the value-history backlist through detail/history without making history rows part of the summary card.

Off Limits uses the avoid/caution treatment and the helper `Avoid bringing these up`. It is not collapsed merely because content is sensitive. AI-enabled items keep the ordinary sparkle; the visual never implies that hidden, Off Limits, or AI permission are the same state.

Repeatable child sections initially show up to three items, then the count-aware `View all`. View All preserves semantic summaries with denser spacing, exposes `Show hidden` only when hidden items exist, and remains a read/management list rather than a form.

### Contact Methods

Show all ordinary phone/email sets directly; do not hide a second method by default. Each row exposes method type/label, value, Primary when relevant, and the semantic Call/Message/Email action if actionable. Malformed or unusable imported values remain readable, with the action disabled and an explicit explanation. Long values ellipsize only after their human-readable prefix remains identifiable; detail/accessibility text exposes the full value.

### Interaction History seam

Phase 31 renders only the latest few interactions, last-contact summary, and `View all history`. It is a replaceable section renderer keyed by a semantic module ID. Phase 32 may replace the renderer without changing section order, visibility, template, or collapse persistence. No heatmap, date drill-down, rich timeline, or interaction editing is designed here.

---

## Profile Customization Contract

### Resolution and persistence

Layout and background resolve independently using:

`contact-specific assignment/override -> Category assignment -> editable global/default -> theme fallback`

An explicit contact choice always survives Category changes. A purely inherited Profile follows its new Category. Editing a reusable template updates every Profile assigned to that template; a freeform contact layout is a durable snapshot and is never silently rewritten.

Expanded/collapsed state is durable per contact and portable user-authored presentation data, not session state. It overrides template defaults. Switching a contact to another layout/template clears that contact's old collapse overrides before new ones accumulate. `Reset Profile Presentation` clears only contact-specific layout/template, collapse, and background overrides.

If a Category is deleted later, its layout/background assignment is removed and formerly inheriting Profiles fall back to the global/default presentation. Explicit contact overrides survive. The Profile managers can explain affected assignment counts but do not own Category deletion.

### Profile overflow

The existing overflow control in the Profile header/shell is the single entry for contact and presentation administration; do not add a second Hero/body overflow. Its menu orders actual contact actions before presentation actions:

1. `Edit Contact`
2. `Snooze` or `Unsnooze`
3. `Archive`
4. separator
5. `Profile Layout`
6. `Background`
7. `Save Current Layout as Template` when a freeform layout exists
8. `Reset Profile Presentation` when contact overrides exist

Favorite stays in the Hero. Quick Log, Log Contact, Update Contact, and add remembered information stay in the universal FAB. There is no `AI draft` action; Message is the only Profile route toward Compose and later `Draft with AI`.

### Layout chooser and editor

`Profile Layout` opens an overlay sheet over the still-visible Profile. The sheet first presents the effective source (`Default`, Category name, template name, or `Custom for {name}`), layout choices, and `Edit Layout`. Choosing a different layout is explicit and immediately clears prior contact collapse overrides after a successful write.

`Edit Layout` advances within that same sheet model; it does not navigate to a separate screen. The sheet may expand to near-full available height so preview and controls remain usable, while enough Profile context remains to read it as an overlay. Editing is focused:

- make underlying Profile content, bottom navigation, and universal FAB interaction-inert and remove them from accessibility focus while the sheet is open;
- disable normal Profile actions in the preview;
- show every eligible top-level section and child regardless of current data;
- show drag handles plus screen-reader actions `Move up` and `Move down`;
- show visibility switches and valid default expanded/collapsed controls;
- show only supported `Compact`/`Wide` size choices per Overview module;
- prevent a child leaving its owning parent and prevent a third nesting level;
- auto-pack Overview preview using actual available width;
- expose `Save layout`, `Cancel layout changes`, and `Save as template` for contact freeform layouts;
- require Discard/Keep Editing only when changes are meaningful.

`Save layout` is atomic from the user's perspective. No drag or switch persists before that action. A failed save keeps the complete draft and preview in the expanded sheet. `Cancel layout changes`, scrim dismissal, and Android Back close immediately when nothing changed; meaningful changes retain the settled `Discard changes` / `Keep editing` guard before the sheet can close.

### Template management

Layout and background managers are Profile-hosted overlay sheets opened from the existing header overflow. They support create, rename, edit/preview, global assignment, Category assignment, contact assignment, remove assignment, usage count, and deletion through internal sheet pages or stepped content, never a separate navigation screen. They may expand to sufficient height and scroll internally with object-specific action rows kept reachable. Assignment controls clearly distinguish `Inherited` from `Override`. Deleting an in-use template requires the documented confirmation and resolves affected inherited assignments to their next fallback; it never deletes contact data.

### Background editing

Layout templates and background templates are separate and freely combinable. `Background` in the existing Profile overflow opens the background overlay sheet. Its custom-image flow advances within the same expandable sheet model:

1. `Choose image` using the existing local image picker boundary.
2. App-owned copy/derivative preparation.
3. Drag/reposition and pinch crop against the Hero/Profile preview aspect.
4. Automatic package-aware readability treatment preview.
5. `Save background` or `Cancel background changes`.

The sheet exposes no blur, brightness, overlay-strength, filter, arbitrary compositing, upload, or downloadable-pack controls. Loading/processing has a progress treatment; cancellation or failure leaves the existing background unchanged. Crop gestures, preview, and action controls receive sufficient height through sheet expansion rather than a modal or separate route.

---

## Interaction and Feedback

- All icon-only controls require a semantic icon and accessibility label. Never use `⋯`, `★`, or other raw text glyphs for final Profile controls.
- Press feedback uses the shared Button/Pressable treatment. No per-frame React state animation.
- Expand/collapse may use the shared short motion token. Reduced-motion removes decorative movement while preserving immediate state change.
- Favorite, frequency, snooze, unsnooze, and template assignment publish only after successful local writes. A failure restores/retains the previous visible state and offers Retry where appropriate.
- Message/Call disabled state uses `accessibilityState.disabled` and a reason in the accessible name/hint; a visible helper or adjacent accessible description ensures the reason remains discoverable even where the platform skips disabled controls in focus order.
- Card long-press actions must also be available through accessibility actions or the detail surface; long press cannot be the only management path.
- Reorder never depends on drag precision. Every draggable row offers equivalent Move Up/Move Down actions and announces its new position.
- Every Phase 31 explanation, selector, layout/template manager, and background editor is an overlay sheet where applicable. Sheets form the topmost transient layer: scrim/Back dismisses a clean sheet, while a dirty focused editor runs the unsaved-change guard. Ordinary Profile Back remains origin-aware after sheets are closed.
- The screen reads entirely from local SQLite. Background assets are local. No network call blocks Profile loading or rendering.

---

## UI Considerations

> Populated after six-dimension approval by the installed `ui-consideration-probe.cjs`. The owner confirmed the ten surface classifications, including Profile-header overflow sheets for layout, template, background, and applicable explanation/selection work. Empty/error copy remains in the Copywriting Contract; these rows define state behavior and reference that copy.

Applicable state considerations resolved: **73 total — 65 covered, 8 backstop, 0 unresolved.** Categories grouped in one row share the stated verification tier and resolution.

| Element / confirmed kinds | Categories | Status | Resolution / Reason |
|---|---|---|---|
| E1 Whole Profile — list-collection, nav | empty, error, populated, partial, overflow, zero-one-many, long-text | ✅ covered | Missing contacts use the documented load error and Back path; valid Profiles render the invariant Hero plus resolved sections. Available facts render without fabricated values. The vertical surface scrolls/reflows, and repeatable sections retain zero/one/many summaries with count-aware View all. |
| E1 Whole Profile — list-collection, nav | loading | 🧪 backstop | Cold-start device verification must confirm local-only loading, stable shell chrome, and skeleton-to-content transition without stale-data or empty-state flashes. |
| E2 Hero — nav, media, interactive-control, static-content | empty, loading, error, populated, overflow | ✅ covered | Missing photo uses themed initials; missing Category consumes no space; unavailable actions stay visible with reasons. Skeleton geometry stays stable, identity failure uses the Profile error, populated identity retains one header overflow, and narrow layouts stack actions before clipping. |
| E2 Hero — nav, media, interactive-control, static-content | long-text | 🧪 backstop | Large-font visual verification must confirm long names and Categories reflow without overlap, clipping, or shrinking below semantic type roles. |
| E3 Relationship Overview — list-collection, interactive-control | empty, loading, error, populated, partial, zero-one-many, long-text | ✅ covered | Missing facts use declared unavailable states; Unbound Status is Not tracked and Intensity is This month. Only a mutating tile becomes pending; failures retain committed values. The six-module grid auto-packs in order, independently guards partial facts/null cadence, collapses to one column, and grows tile height for text. |
| E3 Relationship Overview — list-collection, interactive-control | overflow | 🧪 backstop | Width and font-scale tests must confirm column reduction and tile-height growth preserve module order, readable values, and 44px targets. |
| E4 Things to Remember — list-collection, nav, static-content | empty, loading, error, populated, partial, overflow, zero-one-many, long-text | ✅ covered | Empty children retain useful collapsed summaries and edit-mode placeholders; local loading/error stays child-scoped. Populated cards remain one-column, omit blank metadata, preserve semantic markers, clamp previews to two lines, and show roughly three items before count-aware View all. |
| E5 Contact Methods — form, list-collection, interactive-control | empty, loading, error, populated, partial, overflow, zero-one-many | ✅ covered | Zero shows the documented None summary; normalized reads keep the shell stable. Usable sets render directly, malformed values remain readable with disabled reasons, long sets use View all, and action failure never removes the row. |
| E5 Contact Methods — form, list-collection, interactive-control | long-text | 🧪 backstop | Visual and accessibility tests must confirm long values ellipsize safely while the full value remains available to assistive technology or detail. |
| E6 Interaction History — list-collection, nav | empty, loading, error, populated, partial, overflow, zero-one-many, long-text | ✅ covered | Zero retains the documented summary; loading/error stays section-scoped. Available interaction facts render behind the replaceable seam, latest entries are capped before View all history, and note previews clamp while complete text remains in detail/history. |
| E7 Layout editor sheet — form, list-collection, nav, interactive-control | empty, loading, error, populated, partial, overflow, zero-one-many | ✅ covered | The expanded overlay sheet reveals every eligible module with placeholders, keeps stable framing while local data loads, preserves the draft on failed Save layout, confines children to their parent, and scrolls internally with object-specific actions reachable. |
| E7 Layout editor sheet — form, list-collection, nav, interactive-control | long-text | 🧪 backstop | Large-font and long-name tests must confirm labels wrap or ellipsize with full accessible names and never displace Save/Cancel or reorder actions. |
| E8 Template manager sheets — form, list-collection, nav, interactive-control | empty, loading, error, populated, partial, overflow, zero-one-many | ✅ covered | Zero custom templates retains the built-in/default and Create action. Stable sheet loading and failed-write recovery preserve assignments/drafts. Populated rows distinguish assignment source and usage; missing assignments follow the fallback chain; lists scroll for one or many templates. |
| E8 Template manager sheets — form, list-collection, nav, interactive-control | long-text | 🧪 backstop | Long-name and large-font tests must confirm full accessible names and reachable assignment/overflow actions without clipping. |
| E9 Background editor sheet — form, nav, media, interactive-control | empty, loading, error, populated, partial, long-text | ✅ covered | The current background/theme fallback remains until a local derivative is ready. Failures retain it and use documented recovery. The crop sheet shows the actual preview/readability treatment; uncommitted selection remains a draft; copy wraps without covering crop controls. |
| E9 Background editor sheet — form, nav, media, interactive-control | overflow | 🧪 backstop | Expanded-sheet gesture tests must confirm crop bounds stay covered at min/max scale, output matches preview aspect, and controls remain reachable. |
| E10 Explanation/selection sheets — nav, interactive-control, static-content | loading, error, overflow | ✅ covered | Sheet framing and Profile context stay stable during local reads; failed selection retains the committed value and recovery; sheets expand/scroll within safe areas and preserve clean-dismissal or dirty-editor guards. |
| E10 Explanation/selection sheets — nav, interactive-control, static-content | long-text | 🧪 backstop | Screen-reader and large-font passes must verify explanations, state, assignment source, disabled reasons, and selection controls remain understandable without color or imagery. |

---

## Accessibility and Responsive Acceptance

- Minimum target size is 44x44px for every Hero action, section header, context-menu trigger, tile action, reorder control, and crop control.
- Status never relies on hue; Gravity never relies on sphere diameter; Intensity never relies on bar height; linked Relationships never rely on avatar recognition.
- Every section announces title, concise summary/count, and expanded/collapsed state.
- Every template/background choice announces selected state and whether it is inherited or a contact override.
- Hidden items exposed in administration announce hidden state and provide a named `Show on Profile` action.
- At large text, allow Hero, tiles, controls, and cards to grow/reflow. Grid columns reduce before content clips. Do not disable font scaling.
- Layout is derived from measured width, not portrait-specific absolute x/y positions. Final tablet/landscape polish remains Phase 40, but Phase 31 must not encode an architecture that prevents reflow.
- Background crop supports touch gestures plus named controls/reset where needed for switch/accessibility users.
- Decorative Profile background and glass/blur carry no meaning and have a readable tokenized fallback.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | None | Not applicable — React Native project |
| Third-party registries | None | No registry code enters this contract |

No new component registry, web design system, or network-hosted visual asset is authorized. Reuse installed Orbit primitives and local bundled/user-owned images.

---

## Source and Decision Traceability

| Source | Contract decisions used |
|--------|-------------------------|
| `31-CONTEXT.md` | All D-01 through D-11, including AI-entry removal, nullable-cadence guard, durability, reset boundary, Profile background permission, and replaceable History seam |
| Profile dossier | Fixed Hero; two direct actions; background/layout template systems; inheritance; focused editor; factory orders; tile/card details; hidden recovery; accessibility; responsive foundations |
| Planning notes | Category deletion fallout, image-memory handoff, unbuilt schema warning, and one shared Unbound Intensity fallback |
| REQUIREMENTS / ROADMAP | PROF-01 through PROF-20 and Phase 24.2's grouped custom-field/value-history handoff |
| ADR-079 | No Profile AI draft; AI is reached through Message/Compose only |
| ADR-062 | Unbound Profiles remain reachable; every cadence consumer guards nullable cadence |
| Live theme code | Exact spacing, typography, radii, surface, accent, status, Gravity, background, icon, and reduced-motion systems |
| Live Profile/Knowledge/data code | Current Profile read/mutation seams, normalized methods, derived impact availability, Memory visibility/AI separation, Relationships, custom fields, and local-only loading behavior |

The graph's governing-ADR results used here were `INFERRED` edges from ADR Key-files lists and were treated only as discovery pointers. Supersessions were verified in the actual ADRs and live files.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-09-09; no recommendations
