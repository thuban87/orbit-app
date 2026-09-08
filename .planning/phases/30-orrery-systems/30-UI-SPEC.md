---
phase: 30
slug: orrery-systems
status: approved
shadcn_initialized: false
preset: none
created: 2026-09-08
reviewed_at: 2026-09-08
---

# Phase 30 — UI Design Contract

> Visual and interaction contract for Orrery Systems (ORRS-01–14). This transcribes and structures the settled decisions in the phase dossier (§K–AA) and planning-notes; it does not invent alternative layouts, palettes, or interaction models. It is a design contract, not evidence of implemented or device-verified behavior.

## Sources and authority

- `docs/dossier/milestone-2/phase-09-orrery-systems-dossier.md` is **ground truth**. Sections K–Y define the UI/UX surface; Z is the large-System scale/performance contract; AA is Backup/Restore. `[DECIDED]` / `[REJECTED]` items are locked — reversing one is an owner decision, not a design change made here.
- `docs/dossier/milestone-2/planning-notes/phase-09-planning-notes.md` and `30-CONTEXT.md` (shim over the dossier) are binding appendices. D-01…D-10 constraints are honored below.
- This phase **consumes Phase 29** (`29-UI-SPEC.md`, `status: approved`) rather than redefining it: camera, Home framing, projection, density, focus/cluster focus, high-count rendering, the compact System switcher (E2), and the built-in Systems. The Systems HUD extends Phase 29's Orrery visual language, tokens, and overlay lifecycle.
- **Correction to D-09:** the reduced-motion hook now exists — `useReducedMotionShared()` (Reanimated `SharedValue<boolean>` for the Skia render loop) and `useReducedMotion()` (state-backed boolean for the React tree) in `src/theme/use-reduced-motion.ts`, landed in Phase 23. The Reduced-Motion System-switch path (§X) consumes these; do not plan against an assumed absent hook. ADR-085 governs reduced motion.
- Existing Phase 23 theme tokens and primitives supply spacing, typography, surfaces, icons, and reduced motion. All colors — including Skia draws — resolve through `useTheme().colors[...]`; no literal hex anywhere.

## Design System

| Property | Value |
|----------|-------|
| Tool | Existing manual React Native semantic design system; shadcn/web initialization not applicable |
| Preset | not applicable |
| Component library | Existing `AppText`, `Button` (`src/components/ui/Button.tsx`), `GlassSurface`, `Sheet`, `Snackbar`, `ContactPicker` + `contact-picker-selection`/`contact-picker-source` logic, `useDiscardKeepGuard` (`src/navigation/discard-keep-guard.ts`), `snackbar-store`, `orrery-system-store`; Skia + Reanimated + Gesture Handler for the world and Preview |
| Icon library | Existing semantic Icon registry (`src/components/icons/icon-registry.ts`) backed by Ionicons; add the new semantic keys named in Color below centrally, never inline glyphs |
| Font | Bundled Inter Regular/SemiBold and Space Grotesk SemiBold; no remote font dependency |
| Theme | Galaxy/Standard × Light/Dark/Follow System retain independent meanings; the HUD is allowed to be visually distinctive (§K) but must remain fully tokenized and accessibility-compliant |

The builder HUD is an **intentional Orrery-specific control surface** (§K) — it may differ from Orbit's ordinary modal/sheet language, but it reuses shared visual primitives and the shell's unsaved-change and dismissal contracts. Do not redesign Orbit's global modal system on its behalf. Reuse the canonical `ContactPicker` foundation for Manage Members (§M) rather than inventing a second selection system.

## Spacing Scale

Use the existing `SPACING` tokens (`src/theme/tokens/spacing.ts`), in logical React Native units.

| Token | Value | Usage in this phase |
|-------|------:|---------------------|
| xs | 4 | Icon↔text gaps, chip inner padding, count-badge padding |
| sm | 8 | Between adjacent controls; Manage Members grid gutter; bottom-right control stack gap |
| md | 12 | Compact row inner padding; accordion header vertical padding; management-row padding |
| base | 16 | HUD viewport edge inset; HUD panel padding; page-level content padding |
| lg | 24 | Separation between accordion groups and between conceptual HUD groups; empty-state stack |
| xl | 32 | Empty-state group separation; Preview empty-canvas message block |
| 2xl | 48 | Large section breaks; not a mandatory empty-state padding |

Exceptions: `12` (md) is the project's established grid-aligned token — retain it (matches Phase 29). Touch targets have a **44×44 minimum** independent of rendered icon/body size (Manage Members cards, switcher rows, management rows, reorder handles, HUD controls). Projected world/Preview coordinates, ring spacing, radii, strokes, body sizing, and animation values are **geometry**, not UI padding tokens; existing `RADII` and `ICON_SIZE` supply corners and glyph sizes.

## Typography

Use the five existing semantic roles (`src/theme/tokens/typography.ts`) — four sizes, two weights. Consume roles, not raw sizes.

| Role | Size | Weight | Line height | Font / use in this phase |
|------|-----:|-------:|------------:|--------------------------|
| Display | 28 | 600 | 34 | Space Grotesk; reserved existing role — no new display heading in the HUD |
| Heading | 20 | 600 | 25 | Space Grotesk; builder page titles, Manage Members title, Systems Management screen title, empty/broken canvas headings |
| Body | 16 | 400 | 24 | Inter; rule descriptions, member names, readable copy, confirmation body text |
| Label | 14 | 600 | 20 | Inter; System names, accordion headers, switcher rows, button labels, count emphasis |
| Caption | 14 | 400 | 20 | Inter; accordion summary values, member/override counts, subordinate status context, "Excluded"/"Added" tags |

RN text respects OS font scaling and reflows; accordion headers, summaries, member names, and counts wrap or ellipsize with a full accessible name (never a fixed clamp that hides text). Skia Preview body markers carry no type scale — Preview is simplified rendering (§N), identity comes from the accessible textual membership summary (§Y), not tiny canvas labels. Initials inside avatars are identity marks, not a type role.

## Color

All roles resolve through `useTheme().colors[...]`. No new color token is minted by this phase.

| Role | Token / proportion | Usage |
|------|--------------------|-------|
| Dominant (≈60%) | `background` | Orrery world/backdrop behind the HUD; Systems Management screen background; Preview canvas |
| Secondary (≈30%) | `surface` / `surfaceElevated` (via `GlassSurface` where the HUD floats over the world) | HUD panels, accordion bodies, Manage Members grid backplate, switcher dropdown, management rows, Preview/Edit bar |
| Accent (≤10%) | `accent` (+ `accentText`/`onAccent` foreground) | See reserved list below — selection and primary intent only |
| Destructive | `danger` (+ `onDanger` foreground) | Delete System confirmation button; AND the broken-System "needs attention" **emphasis tint** on icon + text (this is `danger`'s documented validation/warning-emphasis role, never a destructive *fill* for the broken state) |
| Empty-valid caution | `statusWobble` | Empty-but-valid System caution indicator tint on icon + text (an existing caution/amber state hue; no new token) |
| Text | `textPrimary` / `textSecondary` | Names, summaries, subordinate context |
| Neutral chrome | `surface` / `border` / `borderStrong` / `textPrimary` | Back/Cancel, Manage Members, Preview/Edit, reorder handles, hide/show toggles at rest |
| Excluded member | `textSecondary` on `surface` at reduced opacity | Greyed/de-emphasized Excluded card state in Manage Members (§M) |
| Relationship health / neutral / rogue | existing `statusStable`/`statusWobble`/`statusDecay`/`rogue`/`rogueExtinguished` + Phase 29 ring/neutral resolvers | Preserved from Phase 29 for any body rendering; Systems never redefine status color |

**Accent is reserved for:** the selected System indicator in the switcher and Management list; selected rule values and the active/selected accordion state; selected-member checkmarks in the Manage Members grid; the reorder drag/drop preview; and the primary **Save / Create System** action. Accent is *not* applied to every clickable control — Back/Cancel, Manage Members, Add People, Preview/Edit, Duplicate, Rename, hide/show, and Reset Overrides use neutral surfaces/text at rest.

**Empty vs broken severity (§J, §Y):** the two states are always distinguished by **icon shape + text**, never hue alone. Add two central semantic icon keys: `system-empty` (caution/triangle family, tinted `statusWobble`) and `system-broken` (error/stop family, tinted `danger`). A customized built-in/Category System shows a third, non-severity **overrides** affordance (`system-overrides`, neutral tint) indicating manual includes/excludes exist (§G/§H). Exact Ionicons glyphs are implementation detail; the shape/severity/text pairing is the contract.

## Copywriting Contract

Exact confirmed copy. Braces denote live names/counts, never shipped placeholders. Existing domain-label spelling is preserved. Empty/broken/error state COPY lives here; state *coverage* is in UI Considerations.

| Element | Copy |
|---------|------|
| Primary CTA (create) | **Create System** |
| Primary CTA (save) | **Save System** |
| Builder page title (new) | New System |
| Builder page title (edit) | Edit {systemName} |
| System name field placeholder | Name this System |
| Manage Members entry | Manage Members |
| Manage Members title | Manage Members |
| Add manual members | Add People |
| Match/member count (live) | {count} members (singular: 1 member) |
| Manage Members override counts | {count} members · {added} added · {excluded} excluded |
| Excluded rule-derived tag | Excluded |
| Manually added tag | Added |
| Accordion summary (examples, §L) | Category · Friends, Community / Gravity · Close +1 / Social Battery · Chargers |
| Preview enter | Preview |
| Preview/Edit bar action | Edit |
| Save-from-Preview | Save System |
| Reset overrides | Reset Membership Overrides |
| Reset overrides confirm | Reset overrides? · Manual includes and excludes will be removed. The System's rules stay. — Reset / Cancel |
| Duplicate action | Duplicate |
| Duplicate default name (§S) | {name} Copy / {name} Copy 2 / {name} Copy 3 (deterministic, uniqueness-aware) |
| Rename action | Rename |
| Duplicate-name error (§T) | A System named "{name}" already exists. Choose a different name. |
| Empty-name error | Give this System a name. |
| Switcher trigger | {systemName} ▾ |
| Switcher row with count | {systemName} — {count} |
| Empty-but-valid canvas heading/body | No contacts in {systemName} right now / They'll appear here as soon as contacts match this System. |
| Empty-System switcher indicator (a11y) | {systemName}, empty |
| Broken-System canvas affordance | This System needs attention |
| Broken-System detail (in editor) | This rule refers to something that no longer exists. Remove it or pick a new value. |
| Broken-System switcher indicator (a11y) | {systemName}, needs attention |
| Manage Systems entry (from switcher) | Manage Systems |
| Systems Management title | Systems |
| Create from management | Create New System |
| Delete action | Delete System |
| Delete confirmation (§R) | Delete {systemName}? · This only removes the System. Your contacts are not affected. — Delete / Cancel |
| Delete Undo snackbar (§R) | System deleted — Undo |
| Active-System-deleted fallback (silent) | (Orrery falls back to All Contacts; no error copy) |
| Manually-included but Archived (§F) | {name} — Archived (unavailable) |
| Add People scope note (§F) | Searches your active contacts. |
| Unsaved-changes guard (reuse shell, §P) | Discard changes? · Your unsaved changes will be lost. — Keep editing / Discard |
| Category-deletion note (§I, owned by Phase 37, provided here) | Systems that use this Category will keep it as a rule that needs attention. |

## UI Considerations

> Shape-rooted UI *state* coverage. Empty/error COPY lives in the Copywriting Contract above; this section covers state coverage and references those rows.

Probe executed after dimension review with the installed `ui-consideration-probe.cjs` (35 applicable considerations across eight surfaces). Every resolution below is drawn from the phase dossier (§B–AA), the settled decision record — no state was left to fresh judgment. The engine returned E1 (floating HUD wizard) and E4 (Preview) as `unclassified` (heuristic cue-miss); their real element kinds are supplied as overrides below (E1 is a nav wizard + form + interactive controls; E4 is a media canvas + interactive controls + nav bar), which raises their loading/empty/error/overflow states rather than dropping them.

Applicable state considerations resolved: **all covered** across the phase's authoring, management, switcher, and canvas surfaces. These are UI acceptance truths, not proof of implementation. The states marked *(device-verify)* — Reduced Motion crossfade, largest supported text, long names, zero/one/many members, broken-rule rendering, switch-animation intensity, canonical Home framing, and large-System scale (§Z, §X, §V/§W) — are acceptance obligations the planner must carry to on-device verification, not settled by reading the spec.

| Element | Confirmed kinds | Category | Status | Resolution / Reason |
|---|---|---|---|---|
| E1 Floating HUD wizard (§K) | nav, form, interactive-control | loading, error, long-text | ✅ covered | The multi-page HUD is fully operable without touching the canvas; background Orrery is removed from a11y focus while open. A save-in-progress marks the affected control busy, not the whole canvas. Meaningful unsaved changes route through the shell's `useDiscardKeepGuard` ("Discard changes?" / Keep editing / Discard, §P). Page titles and the name field wrap/scale under largest text *(device-verify)*. |
| E2 Definition page (§L) | form, interactive-control | empty, loading, error, partial, overflow, long-text | ✅ covered | A rule set matching zero contacts is valid; live match count reads "0 members". Accordions summarize active values by label not count. Empty-name → "Give this System a name."; duplicate-name → the §T collision error. The production Orrery does not rebuild on every rule toggle (§O). Accordion summaries wrap; many rule families scroll. Largest-text layout *(device-verify)*. |
| E3 Manage Members (§M) | list-collection, form, media, interactive-control | empty, loading, error, populated, partial, overflow, zero-one-many | ✅ covered | Rule matches enter preselected; deselection marks **Excluded** in place (kept visible, de-emphasized); Add People manually includes eligible active contacts, tagged **Added**, legible on reopen. Zero matches shows an empty grid with Add People still available. Counts show total · added · excluded. Grid virtualizes + searches; hundreds of cards inspectable without eager mount (§Z). Missing photo → initials. Failed override write restores prior saved state with retry. Large-membership rendering *(device-verify)*. |
| E4 Preview (§N) | media, interactive-control, nav | empty, loading, overflow, long-text | ✅ covered | Full-canvas simplified render (sun, rails, simple markers, approximate real sizing) over real Phase 29 layout; pan/zoom supported, tilt/yaw not exposed; a body tap may focus but never opens Profile. Previewing a zero-member System shows the empty treatment. A textual membership summary is always available (visual interpretation never mandatory). Simplified rendering scales to large membership; Save available from both Preview and the HUD. Scale/perf *(device-verify)*. |
| E5 Systems Management (§Q/§R/§S/§T) | list-collection, nav, interactive-control | empty, loading, error, populated, partial, overflow, zero-one-many | ✅ covered | Flat management screen, reachable from switcher ("Manage Systems") and Settings. All Contacts pinned first, non-deletable, non-renamable. Delete (custom) never touches contact data; short-lived Undo snackbar (`snackbar-store`), no 30-day quarantine; active-System delete falls back to All Contacts silently. Built-in/Category base immutable; overrides show a neutral indicator; duplicable into editable custom Systems. Reorder is long-press drag with accent preview + 44-min handle; failure restores committed order with feedback. Unique case-insensitive names. Lists scroll; largest-text rows *(device-verify)*. |
| E6 Switcher (§U) | list-collection, nav, interactive-control | empty, loading, error, populated, partial, overflow, zero-one-many, long-text | ✅ covered | `{systemName} ▾` trigger + dropdown in Management order; All Contacts first; hidden Systems omitted. Live counts (`{systemName} — {count}`). Zero-member Systems stay visible/selectable. Empty (`system-empty`, statusWobble) and broken (`system-broken`, danger) states expose distinct indicators, each with an a11y name ("{systemName}, empty" / "{systemName}, needs attention") — never hue alone (§Y). Trigger/rows truncate to one line with a full accessible name; long lists scroll *(device-verify for text scaling)*. |
| E7 Canvas empty/broken states (§J) | media, static-content | empty, error, overflow, long-text | ✅ covered | Empty-but-valid: empty-state copy + a **restrained comet** (decorative, not a constant loop), removed/replaced under Reduced Motion *(device-verify)*. Broken: continues resolving valid definition; shows a small **non-blocking** needs-attention affordance + `system-broken` severity; repaired via the ordinary editor, no reconciliation wizard (§I). Broken rules are never silently deleted or rewritten. Large membership uses Phase 29 culling/LOD — never mount every full-detail body (§Z, device-verify). |
| E8 Switch transition (§V/§W/§X) | media, interactive-control | loading, error, long-text | ✅ covered | Switching sends the destination to canonical Phase 29 **Home framing** (prior pan/zoom/tilt not preserved); a focus present in both source and destination is preserved through the transition, else cleared *(device-verify)*. Animation is spin + shedding/capture, intensity **adaptive to membership delta**, driven by the Skia render loop / Reanimated shared values (never per-frame React state), pausing on `useIsFocused === false` / AppState background; interaction resumes once destination geometry is stable. OS Reduced Motion replaces it with a simple crossfade/reposition via `useReducedMotionShared()` / `useReducedMotion()` (§X) *(device-verify)*. |

## Interaction Contracts

Faithful transcription of §K–Y. Each row is an observable contract for the planner/executor.

### New/Edit System surface — the floating HUD wizard (§K, ORRS-05)

| Requirement | Observable contract |
|-------------|---------------------|
| Surface | A specialized **multi-page floating Orrery HUD** over a fresh/canonical Orrery canvas — not a conventional modal form. Fully operable without touching the canvas behind it. |
| A11y (§Y) | When the full HUD is open, background Orrery interaction is removed from accessibility focus. Entering Preview moves focus to Preview controls; returning to Edit restores meaningful focus. Closing any transient returns focus to its trigger. |
| Pages | Definition page → Manage Members → Preview, as internal HUD states, not one flat form. |

### Builder — Definition page (§L)

| Element | Contract |
|---------|----------|
| Header | Back/Cancel (neutral); System name field; Save where appropriate (accent). |
| Rules | Rule families as vertically stacked collapsible **accordion** sections over the eight axes (Category, Favorite, Status/Needs Attention, Gravity, Social Battery, Contact Frequency, Not Contacted, Snoozed). Birthday is omitted (§D). Semantics: OR within a family, AND across families (§C). No arbitrary boolean builder; no System nesting (§C, deferred). |
| Accordion headers | Collapsed headers summarize active values with meaningful labels, not only counts (e.g. `Category · Friends, Community`). Expose conventional accessible expanded/collapsed + selected state. |
| Match count | Live current match count on the page (§L/§O). |
| Manage Members | Always available, even with no rules selected (enables manual-only Systems, §B/§L). |
| Predicates | Reuse canonical shared domain predicate logic; do not share Dashboard live UI/query state (§C). |

### Builder — Manage Members (§M, ORRS-06)

| Element | Contract |
|---------|----------|
| Foundation | Reuse the canonical `ContactPicker` selection foundation; do not invent a second contact-selection system. |
| Grid | Simple multi-select **virtualized, searchable** avatar grid: contact photo/avatar (initials fallback), name, selection state. Do not truncate membership; hundreds of cards remain inspectable without eager mount (§Z). |
| Preselection | Rule-derived matches enter already selected. |
| Exclusion | Deselecting a rule-derived member expresses an **explicit exclusion** without removing the card from the current result; it stays visible, greyed/de-emphasized, tagged **Excluded** (`textSecondary`, reduced opacity). |
| Inclusion | Add People manually includes otherwise non-matching eligible **active** contacts (not Archived/Unbound, §F); manual adds are tagged **Added** and legible on reopen. |
| Counts | Total members plus added/excluded override counts. |
| Lifecycle (§F) | A manually included contact that later becomes Archived stays in the definition but is temporarily ineligible/not rendered; the editor may show it as unavailable/Archived. Restoring it re-activates the inclusion without re-authoring. |
| Reset | Reset Membership Overrides removes manual includes/excludes, preserves rules (§E), with the confirm copy above. |
| Exclusion model | Rule-derived Systems are dynamic buckets, not ledgers: an exclusion for a contact that stops matching is discarded; no invisible stale exclusions accumulate (§E). |

### Builder — Preview (§N, ORRS-07)

| Element | Contract |
|---------|----------|
| Scope | Full-canvas Preview (not a tiny in-HUD box). Entering Preview collapses the HUD into a small floating **Preview/Edit bar**; the canvas shows the provisional System. |
| Rendering | Real Phase 29 layout/scale model with **simplified** rendering: sun, orbital rails, simple body markers, approximate real body sizing/layout; no final photos/labels/decorative effects. Communicates membership *and* scale before Save (§O). |
| Interaction | Pan and zoom supported; tilt/yaw not initially exposed. Tapping a body may identify/focus it but never opens Profile (user is inside an unsaved focused workflow). |
| Save/Edit | Save available from Preview and from the HUD (a satisfied user need not reopen the full HUD to save). Edit restores the full HUD at the prior builder state. |
| A11y | Preview provides a textual membership alternative/summary; visual Orrery interpretation is never mandatory. |

### Save behavior & unsaved changes (§P, ORRS-08)

| Case | Contract |
|------|----------|
| Save new System | Orrery switches to the new System. |
| Edit active System | Stays active; resolved membership updates. |
| Edit non-active System | Returns to management without changing the active System. |
| Unsaved changes | Reuse the shell's `useDiscardKeepGuard` contract verbatim ("Discard changes?" / "Keep editing" / "Discard") for meaningful unsaved changes. |

### Systems Management screen (§Q/§R/§S/§T, ORRS-09/10)

| Element | Contract |
|---------|----------|
| Nature | Conventional **flat** management screen, separate from the switcher dropdown; the switcher is for switching, not CRUD. Entry from the switcher ("Manage Systems") and from Settings route to the same canonical screen. |
| Operations | Create, edit, rename, delete (custom); duplicate (all kinds); reorder visible Systems; hide/show built-in & Category Systems; edit/reset built-in & Category membership overrides. |
| All Contacts | Pinned first, visible, non-deletable, non-renamable. |
| Delete (custom) | Simple confirmation; never touches contact data; short-lived Undo snackbar (reuse `snackbar-store`, action label "Undo"); no 30-day quarantine; if the deleted System was active, Orrery falls back to All Contacts. |
| Built-in / Category (§G/§H) | Immutable base definitions; cannot be renamed; hideable except All Contacts; may carry overrides (with visible overrides indicator); duplicable into an editable custom System (base predicate becomes editable rules). Renaming a Category renames its generated System; deleting a Category removes that System and leaves referencing custom rules as needing attention (fallout owned here per D-07; Category CRUD itself is Phase 37). |
| Naming (§T) | Unique case-insensitively; no product cap on count; built-in names protected from indistinguishable collisions. |
| Reorder | Long-press/drag with accent drag preview and a 44-min handle; failure restores committed order with actionable feedback. |

### Switcher (§U, ORRS-11) — extends Phase 29 E2

| Element | Contract |
|---------|----------|
| Control | Compact `{systemName} ▾` trigger + dropdown; order follows Management order; All Contacts pinned first; hidden Systems omitted. |
| Counts | Live member counts (`{systemName} — {count}`). |
| States | Zero-member Systems stay visible/selectable; empty (`system-empty`, statusWobble) and broken (`system-broken`, danger) states expose their distinct indicators here, each with text (never hue alone). |

### System switch — camera & animation (§V/§W/§X, ORRS-12/13)

| Requirement | Observable contract |
|-------------|---------------------|
| Camera (§V) | Switching sends the destination to canonical Phase 29 **Home framing** (not preserving prior pan/zoom/tilt). If the focused contact exists in both source and destination, attempt to preserve focus through the transition; if it does not exist in the destination, focus clears as it leaves. Device-test; simplify only if disorienting. |
| Animation (§W) | Polished **spin + shedding/capture**: narrowing sheds non-members and settles; expanding streams new members inward with retained-member continuity. Intensity is adaptive to the **membership delta** (large overlap → subtle; large delta → dramatic), not raw counts. Must not unnecessarily lock out interaction — interaction resumes once destination geometry is stable. Driven by the Skia render loop / Reanimated shared values, **never per-frame React state**; pauses on `useIsFocused === false` and AppState background. |
| Reduced Motion (§X) | With OS Reduced Motion on, replace rotational sweep/shedding/capture with a **simple crossfade/reposition**. Source: `useReducedMotionShared()` for the Skia path and `useReducedMotion()` for any React-tree crossfade branch (`src/theme/use-reduced-motion.ts`); OS/shared-app derived, not a System-specific setting. Also removes/replaces the empty-state comet (§J). |

### Empty vs broken canvas states (§J)

| State | Treatment |
|-------|-----------|
| Empty but valid | Empty Orrery canvas with concise empty-state copy and a **restrained comet** crossing the scene (decorative, not a constant loop); `system-empty` / statusWobble severity in the switcher. Remains a valid selectable System. |
| Broken / needs attention | Continues resolving whatever valid definition remains; shows a small **non-blocking** "needs attention" affordance in the Orrery and the `system-broken` / danger severity in the switcher. Repaired through the ordinary System editor — no reconciliation wizard (§I). |
| Reduced Motion | Comet replaced with a static or simpler treatment (§J/§X). |

## Data / persistence & portability notes (for the planner — not UI, but constrains state surfaces)

- Systems persistence is **entirely unbuilt** (D-04/R-05): this phase creates the Systems table set (definitions + rule rows + explicit inclusion/exclusion rows; ordering and visibility as definition columns). Last-active System is an `app_settings` **preference**, not a Systems row (D-05), added to `PORTABLE_SETTINGS_KEYS`. Per-System camera and per-System density are out of scope.
- Never assume a migration number — verify head+1 against `src/db/migrations/` and `TARGET_VERSION` on disk at plan time (D-03).
- Backup: this phase only **declares its entity shape + validation/orphan-repair expectations** for §AA (custom definitions, rules, manual inclusions, overrides, ordering, built-in/Category visibility + overrides, last-active preference). The format bump is Phase 36's final plan — do not bump the format here (D-06/R-09).
- The knowledge graph cannot enumerate SQL writers (D-08): read every writer of these tables by hand before asserting an invariant. `ring-seq-dao.ts` requires the complete population and cannot take an arbitrary filtered System list (per Phase 29 seam) — reconcile reorder/render scope without removing a guard.

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| None | Existing repository-native components only (`ContactPicker`, `Button`, `GlassSurface`, `Sheet`, `Snackbar`, `useDiscardKeepGuard`, `orrery-system-store`, Skia/Reanimated) | Not applicable; no third-party registry or new external component dependency |

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
