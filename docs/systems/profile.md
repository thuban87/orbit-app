# Profile presentation

**Last updated:** 2026-10-15
**Updated by phase:** 38.10-fuel-retirement-things-to-remember
**Owners:** `src/screens/ContactProfileScreen.tsx`, `src/db/profile-read.ts`, `src/db/profile-presentation-read.ts`, `src/db/profile-presentation-dao.ts`, and `src/profile/`

## Purpose

Profile is Orbit's local, presentation-first read surface for one contact. It keeps identity and practical actions fixed while letting the body resolve a safe, semantic layout, background, and collapse state without altering contact, knowledge, cadence, Favorite, Snooze, or AI-permission data.

## Architecture

### Data model

The Profile's durable presentation state is local SQLite application state. It is independent from relationship facts and resolves each layout/background axis at read time:

`contact override → Category assignment → global assignment → factory/theme fallback`

**Tables:**

- `profile_layout_templates` — reusable named, versioned layout documents.
- `profile_background_templates` — named app-owned relative image paths.
- `profile_category_presentation` — independent nullable layout/background template UIDs per Category.
- `profile_contact_presentation` — contact-specific template/freeform layout/background overrides and the per-module collapse map.
- `app_settings` — global nullable layout/background template UIDs.

The stable migration object is `profilePresentationMigration`; `src/db/database.ts` imports its exported `PROFILE_PRESENTATION_SCHEMA_VERSION` as `TARGET_VERSION` and registers it in the normal ordered migration list. Consumers must use those exports, not a literal migration number.

### Read and render flow

1. `ContactProfileScreen` runs `readProfileSnapshot()` through `createProfileSnapshotLoader()` (`src/screens/contact-profile-logic.ts`). The load is latest-request gated, so an older read can never overwrite a newer snapshot or error. It runs on focus, on the shell tick (`useShellRefresh`), and on the post-sweep foreground tick (`useForegroundRefresh`, 38.3 D-14 ordering). The shell subscription returns early while the app is backgrounded (`shouldRunProfileShellRefresh(AppState.currentState)`, over the shared `isAppBackgrounded` predicate in `src/utils/screen-visibility.ts`; 38.3 VERIFICATION W2, 38.4 D-10), so a warm notification Mark/Snooze delivered in the background costs no Profile read; the foreground tick stays ungated because it only fires after resume. Each current successful publication bumps `historyRevision`, which `ProfileModuleHost` passes to `HistorySection` as `revision`. The Profile snapshot is the single invalidation owner for both projections: Status, Gravity, Intensity and Last Interaction refresh from the same trigger as History (RG-024).
2. The reader opens one local read snapshot, aggregates identity, methods, metrics inputs, knowledge, history, and presentation inputs, then classifies only explicitly optional knowledge/history failures.
3. `resolveProfilePresentation()` resolves independent axes and records dangling template diagnostics without rewriting durable UIDs.
4. The screen keeps `ProfileHero` structurally fixed and passes the snapshot plus resolved presentation to `ProfileModuleHost`.
5. The module host renders semantic IDs (`relationship-overview`, `things-to-remember`, `contact-methods`, `interaction-history`), writes collapse only through the public presentation DAO, then publishes DAO readback.
6. Layout/template/background managers and relationship sheets are topmost overlays. Their dismissal leaves the underlying Profile inert; ordinary Back otherwise remains the originating native-stack Back path. A manager with unsaved changes asks through the shared themed "Discard changes?" prompt (`confirmDiscard`, "Your unsaved changes will be lost."), not a per-editor native Alert (ADR-200); Reset presentation, Unbind and Delete background template are themed destructive confirms (ADR-198). The Profile keeps its own top bar; it is the one pushed screen outside the shared child header (ADR-201, ADR-109).

### Key files

| File | Role |
|------|------|
| `src/screens/ContactProfileScreen.tsx` | Thin controller, one local snapshot, fixed Hero, overlay state, and source-owner handoffs. |
| `src/db/profile-read.ts` | Coherent renderer-neutral aggregate read. |
| `src/db/profile-presentation-read.ts` | Durable presentation inputs and template read helpers. |
| `src/db/profile-presentation-dao.ts` | Transactional template, assignment, collapse, reset, and fallback writes. |
| `src/profile/resolve-presentation.ts` | Pure independent-axis precedence and missing-reference diagnostics. |
| `src/profile/module-registry.ts` | Closed renderer identities that protect the Phase 32 History replacement seam. |
| `src/components/profile/ProfileHero.tsx` | Fixed identity and the top actions: a full-width Edit Contact over the Compose Message and Call pair (38.11 D-63, D-47). Favorite and the overflow sit in the app bar. |
| `src/components/profile/ProfileModuleHost.tsx` | Resolved semantic body and collapse readback host; owns the in-Profile History reveal. |
| `src/profile/module-host-model.ts` | Pure section-header state, `resolveHistoryReveal`, and the `createHistoryRevealScroll` scroll bookkeeping. |
| `src/profile/relationship-sheet-runner.ts` | Owner-scoped submit/Retry settlement. `ProfileRelationshipSheets` uses it for the Contact Frequency selector, and `SnoozeSheet` uses it for its snooze writes (the `"snooze"` owner). |
| `src/components/SnoozeSheet.tsx` | The shared snooze sheet (38.11 D-45): presets, Choose date, Unsnooze and Close for the Overview Snooze tile, the Profile ⋯ "Snooze…" entry, the Contacts card snooze and bulk snooze. It owns no DAO; the host's callbacks write. |
| `src/components/profile/ProfileLayoutEditor.tsx` | Draft-only complete-layout editor with drag and Move alternatives. |
| `src/components/profile/ProfileTemplateManager.tsx` | Reusable layout templates, assignments, usage, and deletion fallback. |
| `src/components/profile/ProfileBackgroundManager.tsx` | Profile background sheet, choose-only (38.11 D-58.2-4): compact saved-background cards whose Assign sets this person's background, Choose photo (the shared create flow, D-79), "Reset to default" with Undo (D-65) and "Manage global backgrounds" to the Settings page. |
| `src/components/profile/ProfileBackgroundCreateFlow.tsx` | Shared pick, crop and name flow (state hook plus view; pending-crop discard deletes the file, ADR-112) used by the Profile sheet and the Profile Backgrounds page (38.11 D-79). |
| `src/components/profile/use-profile-background-library.ts` | Shared background library operations (load, delete with derivative cleanup, global and Category assignment) used by the Profile Backgrounds page; the Profile sheet uses only the load (38.11 D-58.1). |
| `src/screens/ProfileBackgroundsScreen.tsx` | Settings Profile Backgrounds page: the global background, Category backgrounds and the saved backgrounds, with Delete (38.11 D-58.1); Profile-reachable from every tab (RG-021). |
| `src/screens/SettingsAppearanceScreen.tsx` | Sets the global layout default; its "Default profile background" row opens the Profile Backgrounds page, the one control for the global background (38.11 D-84). |

## Behavior contracts

### Fixed identity and origins

The Hero is fixed structure, not a draggable/sticky layout module. It always supplies identity and the top actions: a full-width **Edit Contact** button (opens Edit; 38.11 D-63) above the **Compose Message** and **Call** pair, which keeps two columns and wraps at large font sizes. Favorite and the one overflow entry point sit in the app bar. Missing/unusable methods remain readable with explicit disabled reasons. Compose Message's accessibility label names the person ("Compose a message to {name}"; 38.11 D-47). The Contact Methods row's Message is unchanged and still hands off to SMS directly (D-46). Compose Message opens Compose with `origin: 'profile'`, so Back or a confirmed logged handoff returns by stack pop to the Profile that launched it; widget and notification resets remain built at their external routing boundaries.

### Hero photo, app bar and lightbox

The hero photo is 224 dp (`PROFILE_HERO_AVATAR_SIZE` in `src/screens/contact-profile-logic.ts`) and grows upward. `profileContentTopPadding` keeps the name at or above `PROFILE_LEGACY_NAME_TOP` (260). `ProfileAppBar` (exported from `ContactProfileScreen.tsx`) holds Back, the Favorite star and ⋮. It overlays the scroll view in the same parent with `pointerEvents="box-none"`, and a scrim appears only after the content scrolls past `PROFILE_APP_BAR_SCRIM_THRESHOLD`. Once the hero name's bottom edge passes under the bar, the bar shows the person's name in one ellipsized header line between Back and the star (38.11 D-57; `profileAppBarShowsName`). The name's bottom is measured in scroll-content coordinates by summing the Hero, identity and name `onLayout` offsets (`createHeroNameTracker`), and the scroll handler is wired whether or not the scrim flag is on; the scrim's colour, 0.92 opacity and threshold are unchanged (38.6 D-36). An open section's chevron points up and a closed one points down (38.11 D-28, `ProfileModuleHost`). The star keeps a hit area of at least 44, the Add/Remove Favorites labels, and pending/bound disabling. Tapping a stored photo opens `PhotoLightbox` as the `"photo"` `ProfileOverlay`, so Back closes it through the single-overlay contract. A contact with no photo, or a lost one, has no lightbox entry and shows "Photo unavailable" on the hero (ADR-183, ADR-182).

### Message eligibility (38.3, RG-021)

Hero Message is decided by `profileHeroActionState(methods, { archived, settingsHosted })` in `src/profile/relationship-sheet-model.ts`, checked in this order:

1. **Archived contact (in the Bin), in any host → disabled** with "Contacts in the Bin can't be messaged." (owner ruling D-09; wording 38.11 D-69). Messaging an archived contact stays prohibited.
2. **Profile hosted in the Settings stack → disabled** with "Open this contact from Contacts to send a message." (owner ruling D-25). This covers the archived Profile (Settings → Contacts → Bin → Profile) and a live participant Profile reached inside Settings through a group event.
3. **No actionable phone or email → disabled** with the existing add-a-method reason.

Message is always rendered — disabled with its reason caption, never hidden. Lifecycle is not an input: a live Unbound contact outside Settings can still open Compose. Call keeps its phone-only rule in every host, and the Contact Methods row's native SMS handoff stays enabled for archived contacts (D-27).

The host is explicit, not inferred from navigation state: `SettingsStack` registers `Profile` through `SettingsProfileHostRoute`, which renders `ContactProfileScreen` with `host="settings"` (the same pattern as the Backup host wrappers). Compose and ComposeResearch are **never registered under Settings** and there is no cross-tab jump to message; `SETTINGS_HOST_EXCLUDED_PROFILE_ROUTES` in `src/navigation/shell-contract.ts` names them, and `settings-routes.test.ts` fails if either is registered. Every other route in `PROFILE_REACHABLE_ROUTES` (including the per-section editors `SectionEditor`, `OffLimitsEditor`, `KeyPeopleEditor` and `MemoryHistory`) must be registered wherever Profile is hosted.

The controller never creates a second Profile data writer. Favorite, archive, lifecycle, frequency, and Snooze route through their existing public DAOs/services; after a successful write it reloads the coherent local snapshot. User-triggered call/message/email handoffs use the established interaction-assist service. No read depends on network access.

### Semantic body and relationship facts

The module registry owns persisted semantic IDs, not component names. Relationship Overview auto-packs its seven supported facts while preserving source order and text reflow. The seventh, the Birthday tile (38.11 D-53), shows the stored birthday through `formatStoredBirthdayForDisplay` (year shown when known) and appears only when a birthday is set: `RelationshipOverview` drops it before the packer, so the grid repacks with no gap (D-55). Its factory position is right after Contact Frequency (… Last Interaction, Contact Frequency, Birthday, Snooze; D-80). Saved layouts that predate a module are completed at read time by `completeProfileLayoutChildren` (`src/profile/resolve-presentation.ts`): each missing Overview tile or Things to Remember section goes in after the nearest earlier factory module the layout has. The Profile and the layout editor's draft both use it, so they place Birthday identically, and nothing is written back. Tapping the Birthday tile opens the Birthday sheet (`BirthdaySheet`, hosted by `ProfileModuleHost` like the other Overview sheets, not Edit Contact; D-56): it reuses the shared `BirthdayField` (date row capped at today, Year unknown, Clear) plus Close, and every change saves at once through the screen's `onSaveBirthday` with a "Birthday saved" snackbar (D-59). Switching Year unknown off asks for the year and a cancel leaves it on (D-61). Clear saves null, closes the sheet and says "Birthday cleared"; Clear and a Year unknown ON that drops a stored year offer Undo, which restores the previous value through the same save (38.9 D-30, D-39). A failed save keeps the sheet open with "Couldn't save the birthday. Try again." Every nullable cadence consumer is guarded: the Profile's unavailable Status carries a reason (archived, Unbound, no frequency, not contacted): Unbound and no-frequency contacts are `Not tracked` with an honest context line, a Bound contact with no interaction yet is `Never Contacted` with no progress, and an archived contact keeps its previous result; Intensity uses the shared current-calendar-month fallback rather than inventing a cadence. Status, Gravity, and Intensity are derived read models, never stored Profile scores.

Things to Remember is a one-column, source-owned presentation. Its cards emit owner targets for memories, relationships, current state, Off Limits and normalized custom fields; Profile does not reinterpret them, and its only direct write is Pin/Unpin through the owning writers. Off Limits stays local caution content: fully shown, starting open (it can still be folded, D-127), no sparkle and no inferred permission. There is no Profile AI-draft entry: Compose remains the sole AI-suggestion invocation surface under ADR-079.

Section headings identify their section only. Module bodies own values, empty states, and distinct subsections, so nested renderers never repeat a parent heading or place inferred state beside it. Temporal current-state knowledge renders the newest-dated entry as Most Recent and at most five Previous items, then "See all (N)" to the history page (ADR-210).

### Things to Remember sections (38.10)

- **Order (D-44):** Pinned, Last Talked About, Key People, Current Location, Memories, Thought of Them, Gift Ideas, Custom Fields, Off Limits, Imported from Contacts App. `thought-of-them` and `gift-ideas` are module ids in `module-registry.ts`; `completeThingsToRememberChildren` inserts any missing child at its factory position at read time (resolve-presentation and the layout editor draft), never writing the saved layout back.
- **Heading action (D-72):** one per section with entries, from the static `headingActionFor(id)` table: Add for Last Talked About, Thought of Them, Gift Ideas and Memories; a pencil for Current Location, Key People, Off Limits, Custom Fields and Imported; none for Pinned. `childHasEntries` decides emptiness from visible entries.
- **Empty section (D-68):** "Nothing added yet" and an "Add …" action to that section's add form.
- **Destinations** (`contact-profile-logic.ts`): separate tables per affordance (heading, empty Add, See all, item Edit) through one `knowledgeNavigateParams` step. Pencils open the section's own editor (`SectionEditor`, `KeyPeopleEditor`, `OffLimitsEditor`, `MemoryHistory`) or Edit Contact for Custom Fields; nothing routes to the retired Things to Remember screen (ADR-219).
- **Entries:** a memory card's title is its label, else the type's registry name. Tapping an unlinked entry opens its sheet (Edit, Pin, Unpin, Close; a link shows its URL with Open, D-24, D-87); tapping an entry linked to an interaction opens that interaction, with Edit/Pin/Unpin on long-press and the screen-reader actions (D-107). An empty always-show custom field reads "Not set".
- **Pinned (D-112, D-133):** every pinned memory and key person, no cap, no View all; pinned items also stay in their own section and carry a pushpin icon. Sections show their newest entries ignoring pins: a meaningful date first by that date, then newest added (D-148, D-152).
- **Counts** use `plural(n, "item")`.
- **Hide from Profile** is switched off (`HIDE_FROM_PROFILE_ENABLED = false`, D-134): no Hide controls, and every item shows whatever its stored flag (ADR-218).

Unbind remains a confirmed lifecycle action for Bound contacts but lives in the Profile overflow; the meaningful Bind experience remains visible for Unbound contacts. Relationship Overview retains the existing compact/wide preference, then derives only a visual full-row span for compact row orphans. It preserves configured order and semantic size while centering every tile's content.

### Layout preview geometry (38.4, RG-033)

The layout editor's live preview uses the same geometry as the real Relationship Overview (`ui-accessibility/AUD-UIA-021`). Both go through `src/components/profile/overview-geometry.ts`. `overviewColumnWidth` is `(width − SPACING.sm·(columns − 1)) / columns`, and `overviewTileWidth` is `span·column + (span − 1)·SPACING.sm`.

The preview packs its modules against the **Profile overview's** width basis, not its own. `profileOverviewWidthBasis(window)` is the window width minus 66dp, which is the overview's full inset chain: `ContactProfileScreen` content padding, the `ProfileSection` body padding and the section card's `GlassSurface` border. So at any window width and font scale, the preview shows the same column count, row membership and spans as the Profile, including the 360dp point where the real overview drops to one column.

Tiles are then **sized** from the preview card's own measured width with the same formulas and `SPACING.sm` gaps. The card sits inside the sheet padding, so it is narrower than the Profile overview, and using Profile pixel widths would overflow it. The preview renders no tiles until that width is measured. A test reads the three inset style sites and fails if any of them drifts from the 66dp constant. Saved layouts, layout controls and orphan stretching are unchanged.

**Hidden by D-47 (owner, 2026-09-27; OA-B2).** The editor no longer shows the live preview: its only mount in `ProfileLayoutEditor.tsx` is gated by the top-of-file flag `PROFILE_LAYOUT_PREVIEW_VISIBLE = false`. `ProfileLayoutPreview` stays exported and the geometry above stays covered by its unit tests; flipping the flag to `true` restores the preview. Dragging and Move up/down are unchanged.

The editor's per-module visibility switch is the shared `OrbitSwitch` (ADR-203) and keeps its "Show {module}" accessible name (RG-030 `ui-accessibility/AUD-UIA-003`).

Interaction History renders the full History & Insights section (Heatmap, Intensity, Jump to date and the History stream; since 38.8 the stream replaces the Rolodex and the date Detail Sheet) behind the stable `interaction-history` semantic key via `ProfileModuleHost.renderHistory()`; its visible title is "History" on the Profile and in the layout editor (38.8 D-60), and the key, saved layouts and collapse state are unchanged. `HistorySection` is keyed by the contact so its stream state starts fresh per contact (D-62), and `ProfileModuleHost` measures heatmap/Jump targets against the History anchor to scroll the Profile to them (`requestHistoryScroll`). Knowledge-change rows in the stream route back through the screen's existing knowledge navigation via a threaded `onOpenKnowledgeChange`. See `interaction-history.md`.

### History actions reveal the in-Profile History section (38.3, RG-021)

The Last Interaction overview tile and the Orbit Status sheet's **View history** both reveal the Profile's own History section (owner rulings D-10, D-11, D-28). There is no History route and no timeline screen — ADR-123 replaced the timeline with this section.

- `resolveHistoryReveal({ topLevel, collapse })` decides availability from the resolved layout: History is available only when a visible `interaction-history` placement exists. Expanded state uses the section header's own rule, so the reveal and a header tap agree.
- `revealHistory()` in `ProfileModuleHost` closes the relationship sheet first. If History is collapsed it expands through the **same persisted `toggle`** a header tap uses (D-28) — there is no temporary expansion state, and the user can collapse it again. It then asks the screen to scroll to host y + History y via `onRequestScrollTo`.
- The header's y does not move on expand, but a ScrollView clamps `scrollTo` to its current content height. So an expanding reveal scrolls on the first expanded History layout (`createHistoryRevealScroll`), or immediately if the expand write failed; an already-expanded History scrolls at once.
- That first expanded layout can still be the short "Loading history…" placeholder, so the first scroll can stop at the page end. An expanding reveal therefore stays pending and scrolls once more when History's loaded content lays out (`historyContentLayout`: the heatmap's `onLaidOut`, History's empty state or read error, or the host's error text). A collapse drops the pending settle; an already-expanded History still scrolls once (38.8 D-72, G1; fixed in 38.8-07, `83203b0b` + `9bcb48b7`).
- `ContactProfileScreen` scrolls its single `ScrollView` by ref, instant when reduced motion is on (`useReducedMotion`). Every Profile host (Contacts, Events, Digest, Orrery, Settings) renders this same screen.
- The reveal never resets History's period or selection. An expanded History is not written to or remounted; a collapsed one had no mounted state to keep.
- **When the layout hides History, neither action is offered (D-11).** The host passes no History handler. The Last Interaction tile then renders as an informational `View` with the same content and label, no button role and no `onPress`. The Status explanation (`relationshipExplanation`, `historyAvailable: false`) omits its `history` route. Nothing mutates the layout or temporarily shows History.

### Relationship selector settlement (38.3, RG-025)

Contact Frequency and Snooze settle every write through `createRelationshipSheetRunner` (D-24). Frequency settles in `ProfileRelationshipSheets`, which submits only the `"frequency"` owner. Snooze settles inside the shared `SnoozeSheet` (38.11-10, D-45), which submits the `"snooze"` owner with its own runner. A submit records its selector and operation as the retry target. Submit and **Retry** share one `settle` path: start, await, then `success` and close, or `failure`. So a Retry touches only the selector that failed and always leaves it non-pending. Close/Back and a reopened sheet keep both selectors usable, and a repeated Retry failure stays recoverable. A submit or Retry for a selector that is already pending is ignored. Values are never deduped, so a repeated Snooze is a real event. The component keeps a synchronous mirror of both selector states so the runner's pending checks never read a stale render. Snooze semantics and choices are unchanged.

### Customization and reset

Layout and background resolution is independent. A Category change/deletion removes only the Category assignment; inherited contacts fall through and explicit contact/freeform choices survive. A contact's freeform layout is a snapshot, whereas editing a reusable template affects its assigned Profiles.

The ⋯ order for a bound contact is Snooze…, Unbind contact, Move to Bin, separator, Profile Layout, Background; an unbound contact has no Unbind (38.11 D-64, D-65, D-69). Edit Contact is on the Hero (D-63). Snooze… opens the shared snooze sheet, where Unsnooze lives. Unbind contact is a plain entry and keeps its destructive confirm (D-68, ADR-150). Move to Bin is the red entry with the warning glyph: it asks first with the themed destructive confirm ("Move {name} to the Bin?"), then archives, leaves the Profile and shows "Moved {name} to the Bin" with no Undo; the success snackbar follows only a write that succeeded, and a failed write shows only "Couldn't move to the Bin. Try again." (`runMoveToBin`, D-71, review U-04). After the write resolves, and only then, the widget refreshes and the reminder schedule reconciles, so the binned person's scheduled reminders stop (`afterArchive`, review WR-01). The person stays restorable from Settings → Bin. Save as template and the two resets live in the sheets, not ⋯ (D-65): Profile Layout's "Reset to default" clears the layout/template and the open/closed sections, and the Background sheet's "Reset to default" clears the background. Both are presentation-only (ADR-108): they never touch contact data, Favorite, Snooze, AI permission, knowledge, or interaction history.

Open/closed sections and the layout editor (38.11 D-60, D-83): saving the person's own layout, whether they already had one or were on a template, keeps their open/closed choices except for the sections whose "Open by default" changed in that save; those choices clear so the new default shows (`changedDefaultExpandedIds` → `setContactFreeformLayout({ clearCollapseFor })`). Switching to a different template still clears every choice (`assignContactLayoutTemplate`, ADR-108). The editor's per-section control is a labelled "Open by default" switch. Profile Layout offers Save as template (the editor footer's one button) and, when the person has a layout template, their own layout or any open/closed override, "Reset to default": a destructive confirm (38.9 D-30), then `resetContactLayoutPresentation` clears the layout and the open/closed choices and keeps the background (presentation-only, D-65). The editor's nested reorderable lists pass `scrollEnabled={false}` so only the outer container scrolls (D-29).

The Background sheet (38.11 D-58.2-4, D-65, D-79) is for choosing a background for this person only. Global and Category backgrounds and Delete live on the Settings Profile Backgrounds page, which the sheet's "Manage global backgrounds" button opens. Each saved background is a compact card (the picture on the left, the name and "Assign" on the right); Assign writes this person's background through `assignContactBackgroundTemplate` at once and confirms "Background set for {name}", and the card in use is marked selected. After Choose photo names a new background the sheet offers only "Use for {name}" and "Not now". When the person has their own background, "Reset to default" clears it (`assignContactBackgroundTemplate` with null) and keeps their layout and open/closed sections (presentation-only, ADR-108). The background stays in the library, so the reset acts at once with Undo (38.9 D-30), which re-assigns the previous background and confirms "Background restored" (`resetContactBackground` in `src/profile/background-manager-model.ts`). The sheet header's Back is the icon-only chevron (D-43).

Background bytes stay in app-owned `profile-backgrounds/<uid>.jpg` paths. Picker/cache paths never enter SQLite. A launch-time reconciliation sweep, registered after migration readiness, cleans interrupted local derivative writes; no timer or network work is used.
Each crop or ImageManipulator output remains owned by the operation that produced it and is discarded after the app-owned background derivative is staged, including failure paths. The cold-start photo-cache sweep is only a guarded crash backstop and never scans durable background masters.

Background rendering follows the already-resolved presentation axis rather than checking only a contact override. A resolved contact, Category, or global app-owned background URI wins. When resolution falls through to `source: "theme"`, Profile passes no app-owned URI to its own `BackgroundHost`, which then renders the active package's selected System background. Bundled System slots never enter `profile_background_templates`, and the Profile manager does not navigate to the System-background selector.

Both template managers obtain categories in canonical order and use a bounded complete searchable Sheet with no Uncategorized row. Category rename preserves the local-ID assignment. Category deletion removes only the deleted row's presentation inside the same fallout transaction, so affected contacts fall through to global/factory inheritance while contact-specific choices remain unchanged.

## Backup and cross-phase boundaries

Backup format v5 emits and restores both nullable global Profile preference keys, reusable layout/background templates, and the `profile_contact_presentation` / `profile_category_presentation` assignment rows. Presentation rows travel under their parent contact or Category UID; freeform layout JSON and collapse JSON remain intact. Each background template also carries its image bytes, which restore stages before the database transaction and rehydrates after commit to the UID-derived `profile-backgrounds/<uid>.jpg` path.

The full History UX is owned by the History & Insights subsystem and mounts behind the preserved `interaction-history` key. Settings exposes the nullable global layout default on Appearance and, since 38.11, a Profile Backgrounds page for the global background, Category backgrounds and the saved backgrounds (D-58.1, D-84); choosing a background or layout for one person stays on the Profile; Category management remains a separate lifecycle concern. Phase 40 owns background-image memory/performance hardening.

## Decisions

- **ADR-143:** Lock-Time-Revalidated Atomic Category Deletion and System Fallout — removes the deleted Category presentation assignment so inherited axes fall through.
- **ADR-144:** Complete Category Selection and Grouped Orrery System Discovery — keeps Profile category assignment real-only and complete at arbitrary catalog size.
- **ADR-108:** Durable Independent-Axis Profile Presentation and Inheritance — owns the normalized template/assignment/override model, precedence, collapse persistence, and presentation-only reset.
- **ADR-109:** Fixed-Hero Semantic Profile Composition and Focused Accessible Editors — fixes Hero geometry and constrains the semantic body and editor workflows.
- **ADR-110:** Coherent Local Profile Snapshot and Source-Owned Knowledge Projection — keeps one local snapshot while preserving each knowledge source's ownership and permission semantics.
- **ADR-111:** Cadence-Guarded Profile Metrics and Composed Relationship Actions — defines truthful Bound/Unbound facts and source-owned Frequency/Snooze writes.
- **ADR-112:** App-Owned Profile Background Derivatives and Launch Reconciliation — owns local crop, safe derivative storage, reference-aware cleanup, and fallback rendering.
- **ADR-114:** Route-Aware App-Wide System Background Composition — preserves resolved Profile-photo precedence and uses the selected System background only as the theme fallback.
- **ADR-062:** Bound/Unbound lifecycle — cadence is nullable and all Profile consumers guard it.
- **ADR-078:** Off Limits remains a local caution surface and is not an AI/search/dashboard permission proxy.
- **ADR-079:** Compose is the only suggestion invocation; the Profile AI draft entry is retired.
- **ADR-081:** Per-item explicit AI permission replaces proposed fuel permission; no implicit permission is inferred here.
- **ADR-123:** Profile History Section Replacing the Vertical Timeline — mounts the full History & Insights section behind the `interaction-history` renderer seam without migrating layout/collapse state; the knowledge-change edit reuses the screen's existing navigation. Partially superseded by ADR-193 and ADR-194 (the Rolodex and card/sheet flows); the renderer seam and layout handling stand.
- **ADR-193:** Activity-First History Stream in Profile, Replacing the Rolodex — the History module renders the stream under the visible title 'History'; the `interaction-history` key and saved layouts are unchanged.
- **ADR-194:** Heatmap Jump-and-Highlight with No Count Card, and Honest Empty Targets — the host measures heatmap and note targets against the History anchor (`requestHistoryScroll`) to scroll the Profile.
- **ADR-197:** History Stream Keeps Its Place, Starts Fresh per Visit, and the Reveal Settles After Load — `HistorySection` is keyed by contact, and the collapsed-History reveal settles after History's loaded content lays out.
- **ADR-133:** Session-Scoped Compose Modes and Truthful External Handoff — Profile supplies the origin-aware Message entry into session-only Compose.
- **ADR-138:** Complete Portable Backup Format v5 — carries the complete Profile presentation graph and staged background bytes by durable parent UID.
- **ADR-150:** Semantic Profile Hierarchy and Source-Owned Knowledge Editing — assigns heading/body ownership, bounded temporal preview and overflow Unbind placement; its heading-action routes and scoped FuelEditor are superseded by ADR-218 and ADR-219.
- **ADR-151:** Visual-Only Relationship Overview Orphan Packing — fills row-local compact gaps without changing persisted layout semantics.
- **ADR-165:** In-Profile History Reveal, Today-Following Rollover, and Snapshot-Coherent History — turns History actions into an in-Profile reveal, adds today-following rollover, and settles only the retried relationship selector.
- **ADR-166:** Typed Cross-Tab Entry, Settings-Hosted Profile Contract, and Latest-Wins Notification Ingress — disables hero Message for archived contacts and Settings-hosted Profiles, and aligns Settings-hosted child routes.
- **ADR-183:** 224 Profile Photo Growing Upward, App-Bar Favourite Star and a Reusable Profile Photo Lightbox — sets the hero photo size, the app-bar star and the `"photo"` overlay.
- **ADR-180:** Display-Revision Photo URIs and Current Photos on Every Existing-Contact Surface — the hero photo follows every photo write without a restart.
- **ADR-182:** Missing Photos Keep Their Reference; Backups Skip and Mark Only Missing Photos — the hero shows "Photo unavailable" for a lost photo or a text value.
- **ADR-174:** Fit-to-Width Heatmaps and Large-Text Reachability for Dialogs and Sheets — measured, centred heatmaps with capped tap zones; dialog, sheet and prompt actions stay reachable at maximum text.

- **ADR-198:** Themed Dialogs Through One Imperative Host, an Overlay Registry, and Snackbars Above Overlays — Profile prompts are themed confirms; manager sheets register as open overlays.
- **ADR-200:** Unsaved-Work Guard in Route, In-Screen Sub-Editor and Overlay Variants — the layout, template and background managers share the "Discard changes?" prompt.
- **ADR-201:** Shared Child Header with a Chevron Back and a Person Line on Every Pushed Screen — the Profile is the exception that keeps its own top bar.
- **ADR-207:** Knowledge Homes After Fuel — the Profile reads Off Limits from its own table and shows Gift Ideas and Thought of Them as sections.
- **ADR-210:** Dated Last Talked About and Current Location — newest date is Most Recent; See all (N).
- **ADR-211:** Linked Interaction Notes — a linked entry opens its interaction.
- **ADR-218:** Things to Remember on the Profile — order, heading actions, empty Add, Pin, Pinned in both places, Hide switched off (partly supersedes ADR-150).
- **ADR-219:** Per-Section Editors — every pencil opens its section's own editor.
- **ADR-221:** Two Snackbar Looks — Pin and Undo snackbars.
- **ADR-203:** One Orbit Switch, the Disabled Look, Chip Tiers and Visible Swatch Selection — the layout editor's module switches.

## Gotchas

1. **Use one aggregate read.** Do not add component-owned SQL or a second ranking/metric read; refresh the controller snapshot after committed writes.
2. **Hero is fixed.** Layout documents may reorder only the semantic body, never avatar, identity, Edit Contact, Compose Message, Call, Favorite, or overflow.
3. **Keep axes independent.** A layout write at Category/global scope must preserve the existing background UID and vice versa.
4. **Never materialize inheritance.** Missing references diagnose and fall through; Category changes must not copy effective presentation into contact rows.
5. **No AI inference.** Hidden-from-Profile and Off Limits do not imply privacy, deletion or permission; Off Limits is kept from AI by having no permission column, not by its Profile placement.
6. **No literal migration number.** Refer to `profilePresentationMigration` and `PROFILE_PRESENTATION_SCHEMA_VERSION`; the ordered registry is authoritative.
7. **Keep presentation backup atomic.** A v5 change must preserve the settings, templates, parent-keyed assignments, and background bytes together; never add an emitter without its restore writer.
8. **Resolve before choosing the background host input.** Contact-only checks skip Category and global assignments; pass the fully resolved app-owned URI or `null` for the System fallback.
9. **Keep bundled slots out of Profile templates.** System backgrounds are settings-owned packaged assets, while Profile templates are app-owned photo derivatives with independent assignment and cleanup.
10. **Compose completion must pop to the originating Profile.** Do not reset a Profile-originated, confirmed Compose flow to Dashboard or leave the finished draft in Back history.
11. **Presentation backup is not a path backup.** Restore must use embedded background bytes and UID-keyed staging; source-device image paths never cross the portable boundary.
12. **Keep Settings global-only.** A Settings default must not become a shortcut to a contact-specific layout or background manager.
13. **Do not turn heading metadata into content state.** Normal headings have no duplicated values or inferred empty caption; render meaningful state in the semantic body.
14. **Scoped Off Limits writes stay scoped.** The Off Limits editor controller re-reads the contact's rows before every edit, delete and Undo and refuses another contact's id or snapshot (D-11); filtering UI items is not enough.
15. **Orphan span is not layout persistence.** The computed stretch must not rewrite the compact/wide preference or reorder modules.
16. **Do not make Message work in Settings by registering Compose there.** Settings-hosted Profiles disable Message by ruling (D-09, D-25, RG-021); registering Compose/ComposeResearch under Settings or adding a cross-tab jump reverses those rulings and is an owner decision.
17. **History actions never navigate.** Last Interaction and Status → View history reveal the in-Profile History section (D-10). Routing them to Things to Remember, a new History route, or a timeline screen contradicts D-10 and ADR-123. When the layout hides History, omit the actions; never reveal History temporarily or edit the layout (D-11).
18. **Selector Retry settles only its owner.** Route every Frequency/Snooze write and Retry through the relationship-sheet runner: Frequency through `ProfileRelationshipSheets`, Snooze through the shared `SnoozeSheet` (38.11-10). A Retry that dispatches to both reducers, or that never dispatches `success`, leaves a selector `pending`, and `close()` then refuses to reset it (RG-025).
19. **In-Profile scroll targets must clear the overlay app bar.** The bar sits over the scroll view, so any computed scroll target (the History reveal, for example) adds the 56 px bar height (`profileScrollTargetY`), or it lands under the bar.
19. **The preview packs at the Profile width, not its own.** Packing against the narrower preview card would show fewer columns than the real Profile. If the Profile overview's padding or card border changes, update `PROFILE_OVERVIEW_HORIZONTAL_INSET` in `overview-geometry.ts`. The inset-chain test fails until you do.
20. **Retire source derivatives at the producer boundary.** A completed or failed background crop must discard its ImageManipulator output; launch cleanup may remove only recognized cache residue and must never infer ownership of a durable `profile-backgrounds/` file.

## Related systems

- **Contact knowledge** — supplies source-owned remembered-information facts and writers.
- **Contact methods / Interaction assist** — supplies actionable methods and user-triggered native handoff.
- **Status engine / Interaction log** — supplies truthful derived metrics and bounded interim history.
- **Photos** — owns app-local background derivative lifecycle.
- **Backup & restore** — owns the v5 presentation graph and background-byte recovery boundary.

## Changelog

| Date | Phase | What changed |
|------|-------|--------------|
| 2026-09-02 | 31 | Established the durable independent-axis presentation model, fixed-Hero semantic composition, coherent local snapshot, guarded relationship facts, focused editors, and app-owned background lifecycle. |
| 2026-09-02 | 36 | Added parent-UID-keyed Profile presentation, templates, global preferences, and crash-consistent background bytes to backup format v5. |
| 2026-09-10 | 31 | Final acceptance reconciliation: all seven bounded owner-smoke journeys are complete after targeted direct-drag, template-discovery/arbitrary-contact assignment, and clear-to-theme repairs. The owner approved the final template lifecycle check; Preview functionality passed while its visual polish remains intentionally deferred. |
| 2026-09-10 | 31 | Reconciled the six owner-reported Profile UAT gaps against Plans 31-11 through 31-13. Retained physical-Pixel evidence closes the background, sheet, manager, factory-collapse, and compact-bar reports; the owner directly approved the final crop editor's genuine touch/pinch behavior. This does **not** convert the independent unexercised native-checklist rows into passes. |
| 2026-09-09 | 31 | A droid-built standalone release was installed and inspected on the physical Pixel: Galaxy and Standard local backgrounds rendered full bleed with a compact factory Profile, the release layout chooser/editor remained reachable at 1.15x text after the shared Sheet geometry repair, and the actual empty local Background manager was nonblank. Populated/crop/assistive-technology and owner visual acceptance remain explicitly gated in `31-NATIVE-CHECKLIST.md`. |
| 2026-09-09 | 31 | Physical Pixel objective pass confirmed the fixed Hero, origin Back, inert Profile actions sheet, and reachable overflow/layout chooser controls; broader theme, assistive-technology, varied-data, crop, and local-only acceptance remains owner-gated in `31-NATIVE-CHECKLIST.md`. |
| 2026-09-09 | 31 | Added the Profile presentation controller, local snapshot/resolution architecture, customization boundaries, and Phase 32/36/37/40 handoffs. |
| 2026-09-10 | 31.1 | Established resolved Profile-photo precedence over the app-wide System background while keeping bundled slots and Profile templates independent. |
| 2026-09-02 | 32 | `ProfileModuleHost.renderHistory()` now mounts the full History & Insights section behind the preserved `interaction-history` key (replacing the bounded stub, no layout/collapse migration); threaded `onOpenKnowledgeChange` for Detail Sheet knowledge rows. |
| 2026-09-17 | 37.1 | Added complete bounded real-category assignment, rename-stable inheritance, and atomic deletion cleanup with fallback to the next presentation axis. |
| 2026-09-02 | 35 | Profile Message now passes a Compose origin so Back and confirmed handoff completion return to the launching Profile. |
| 2026-09-02 | 37 | Exposed global layout/background defaults in Settings while retaining per-contact template managers on Profile. |
| 2026-09-19 | 38.1 | Made headings identifier-only, added bounded temporal knowledge/edit routes, moved Unbind to overflow, and added visual-only orphan packing with centered Overview cards. |
| 2026-09-23 | 38.2 | Made Profile-background source and ImageManipulator copies operation-owned, with terminal cleanup and a guarded cold-start orphan backstop. |
| 2026-09-25 | 38.3 | Coherent snapshot + History revision (RG-024): the snapshot load is latest-request gated and also refreshes on the post-sweep foreground tick; each successful publication bumps the History revision so the metrics and History share one trigger. |
| 2026-09-25 | 38.3 | Message eligibility by archive state and host (D-09, D-25, RG-021): hero Message is disabled with a reason for archived contacts in every host and for any Settings-hosted Profile; Compose stays unregistered under Settings, and Settings now registers `RecentlyDeleted`. |
| 2026-09-25 | 38.3 | History actions reveal the in-Profile History section (RG-021, D-10, D-11, D-28): Last Interaction and Status → View history close the sheet, expand a collapsed History through the persisted collapse toggle, and scroll to it (instant under reduced motion). When the layout hides History, neither action is offered and the Last Interaction tile is informational. The Things to Remember history route is gone. |
| 2026-09-25 | 38.3 | Selector Retry settlement (RG-025, D-24): Contact Frequency and Snooze submit/Retry settle through `createRelationshipSheetRunner`, so a Retry settles only the failed selector and both stay usable after reopening. |
| 2026-09-26 | 38.4 | Layout preview geometry (RG-033 AUD-UIA-021): the preview packs against the Profile overview width basis (window − 66dp) and sizes tiles with the shared `overviewColumnWidth`/`overviewTileWidth` helpers and `SPACING.sm` gaps, so compact/auto/wide rows match the real Profile; the layout switch uses themed track/thumb tokens (RG-030 AUD-UIA-003). |
| 2026-09-26 | 38.4 | Profile shell refresh skips while the app is backgrounded (38.3 VERIFICATION W2, D-10): the shell subscription is gated by `shouldRunProfileShellRefresh(AppState.currentState)`; focus and the post-sweep foreground (resume) reads are unchanged, and hidden-but-foregrounded behavior is untouched (Plan 15 owns that evidence-gated decision). No legacy-data repair (38.2 D-23). |
| 2026-09-27 | 38.4 | Layout editor live preview hidden behind `PROFILE_LAYOUT_PREVIEW_VISIBLE = false`; the component and its geometry tests stay (D-47, OA-B2). |
| 2026-09-30 | 38.6 | Hero photo 224 (`PROFILE_HERO_AVATAR_SIZE`), growing upward; `profileContentTopPadding` keeps the name at the pre-38.6 260 line. The favourite star moves from the hero's utility row into `ProfileAppBar` beside ⋮ (≥44 hit area, Add/Remove Favorites labels). The bar overlays the scroll view (`box-none`) with a threshold-gated scroll scrim, and in-Profile scroll targets are offset by its 56 px height. Tapping a stored photo opens the reusable `PhotoLightbox` as the `"photo"` `ProfileOverlay`: pinch to 4×, double-tap to 2.5×, pan, swipe-down/Back/labelled ✕ close, TalkBack focus on Close. A lost photo shows "Photo unavailable" and has no lightbox (ADR-183, ADR-182). |
| 2026-10-08 | 38.8 | The History module renders the new History stream (Heatmap, Intensity, Jump to date, stream) instead of the Rolodex and Detail Sheet, under the visible title "History" with the `interaction-history` key and saved layouts unchanged; the host scrolls the Profile to heatmap/Jump targets measured against the History anchor. Device pass: the collapsed-History reveal from Last Interaction / View history can stop short while History is still loading (open, see the 38.8 phase-end report). |
| 2026-10-09 | 38.8 | Collapsed-History reveal fixed (D-72, G1, gap plan 07): an expanding reveal settles with a second scroll once History's loaded content lays out (`83203b0b`); the Year heatmap and the no-cadence Cycles explanation now report their first layout so the settle also fires there (`9bcb48b7`). Device re-check 11/11 on DEBUG (`ea983264`). This closes the open device-pass item in the row above. The host's History scroll requests take a lead-in so the empty-day note scrolls only just into view (D-73). |
| 2026-10-09 | 38.8 | KB extraction: Decisions cite ADR-193, ADR-194 and ADR-197, and note ADR-123's partial supersession. |
| 2026-10-11 | 38.9 | The Profile managers' discard prompts use the shared themed "Discard changes?"; Profile Alerts became themed confirms; the layout editor's switches are `OrbitSwitch`; the Profile stays outside the shared child header (ADR-198, ADR-200, ADR-201, ADR-203). |
| 2026-10-15 | 38.10 | Things to Remember: Gift Ideas and Thought of Them sections in the D-44 order (saved layouts completed at read time), one heading action per section, empty-section Add, Pin/Unpin from the Profile, Pinned uncapped and also in its section with a pushpin, newest-first sections, linked entries open their interaction, entry sheet Edit/Pin/Unpin/Close, Off Limits from its own table and starting open, "Not set", Hide from Profile switched off; every pencil opens a per-section editor (ADR-207, ADR-210, ADR-211, ADR-218, ADR-219). |
| 2026-10-16 | 38.11 | Relationship Overview tells the truth: Never Contacted status and honest Unbound reasons (D-05, D-23, D-24); Gravity with no interactions reads "No interactions yet" (D-74); the Orbit Status, Gravity and Intensity sheets open with a plain definition and the Last Interaction tile shows the date alone (D-75); the Hero's Message/Call reasons tell a missing phone/email from one that can't be used, naming only the kinds the contact has (D-27); the Frequency sheet has a Custom… row with a days box and Apply while presets still apply on tap (D-54); the unused overview tracer is deleted (D-38). |
| 2026-10-16 | 38.11 | Layout editor: an own-layout save keeps open/closed choices except sections whose "Open by default" changed (D-83, amending D-60); a template switch still clears all; the control is a labelled "Open by default" switch; Profile Layout gains "Reset to default" (layout and open/closed only, background kept, destructive confirm; D-65); nested lists no longer scroll (D-29); the templates sheet header uses the icon-only Back (D-43). The ⋯ entries are removed later in 38.11-13. |
| 2026-10-16 | 38.11 | Profile Backgrounds page in Settings for the global background, Category backgrounds and saved backgrounds, with Delete behind each card's ⋯ (D-58.1); Appearance's "Default profile background" row opens it instead of its own picker, the layout picker is unchanged (D-84, amending 37 D-05 in part); the route is registered in all five Profile-hosting stacks (RG-021); the list/delete/assign operations are shared with the Profile sheet (`useProfileBackgroundLibrary`). The page also has Choose photo (D-79): the crop and name flow moved out of the background sheet into the shared `ProfileBackgroundCreateFlow`, shown on the page in an expanded sheet, then Set as global default, Use for a category or Not now; the crop header's text Back became the icon-only chevron (D-43). |
| 2026-10-16 | 38.11 | Birthday tile in Relationship Overview (D-53): closed-registry id `birthday` (1x1) placed after Contact Frequency in the factory layout (D-80), shown only when a birthday is set with the grid repacking (D-55); `getContactHeader` and `ProfileIdentity` carry `birthday`; read-time completion now covers the Overview bucket as well as Things to Remember, shared by the Profile and the layout editor (`completeProfileLayoutChildren`). |
| 2026-10-16 | 38.11 | Birthday sheet (D-56, D-59, D-61): the Birthday tile opens `BirthdaySheet` in the host; picks and Year unknown changes save at once through `onSaveBirthday` (`setContactBirthday`, then notification reschedule and widget refresh); Clear and a year-dropping Year unknown ON offer Undo (38.9 D-30). |
| 2026-10-16 | 38.11 | Background sheet is choose-only (D-58.2-4): global/Category controls and card Delete moved to the Settings page, compact two-column cards with Assign for this person (selected when in use), "Manage global backgrounds" opens the page; Choose photo stays and then offers Use for {name} / Not now (D-79); "Reset to default" clears only the person's background at once with Undo, replacing "Use inherited background" (D-65; 38.9 D-30, D-39); header Back is the chevron (D-43). |
| 2026-10-16 | 38.11 | Profile top and ⋯ (D-63, D-47, D-64, D-65, D-68, D-69, D-71): Hero shows a full-width Edit Contact over Compose Message and Call; ⋯ is Snooze…, Unbind contact (plain, confirm kept), Move to Bin (red, confirmed, no Undo, success snackbar only after the write), Profile Layout, Background; Save as template and Reset moved into the sheets. Key files: the runner's two users, new `SnoozeSheet` row. |
| 2026-10-16 | 38.11 | The Profile top bar shows the person's name once the hero name scrolls under it (D-57; scroll-content geometry, handler not gated by the scrim flag, scrim unchanged); open section chevrons point up (D-28, `chevron-up` in the icon registry). |
| 2026-10-16 | 38.11 | Code review WR-01: Profile Move to Bin refreshes the widget and reconciles the reminder schedule after the archive write resolves (`runMoveToBin` `afterArchive`); a failed write still never reports success. |
