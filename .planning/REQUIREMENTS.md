# Requirements: Orbit — Milestone v2.0 Release Readiness

**Defined:** 2026-09-02
**Core Value:** Collapse the taps between "you're overdue with X" and the message actually being sent.

**Source of truth:** the fifteen phase dossiers in `docs/dossier/milestone-2/` (amended per the
2026-09-01 audit resolutions; ADR-075–080 record the ratified reversals). These requirements are
*derived from* the dossiers' `[DECIDED]` statements and Success Criteria — they never override them.
Where a requirement and a dossier disagree, the dossier wins. `[DERIVED]` implementation notes are
deliberately NOT restated here; `[DEFERRED]` items are boundaries, not gaps.

**Category ↔ phase mapping is one-to-one:** every requirement in a category belongs to exactly that
category's phase (see Traceability).

## v2.0 Requirements

### SHELL — App Shell & Navigation (Phase 22)

- [x] **SHELL-01**: User can reach Dashboard, Orrery, Backup/Restore, and Settings from a persistent four-tab bottom navigation bar with correct safe-area insets; each tab preserves its own navigation stack (ADR-080)
- [x] **SHELL-02**: Tapping the already-active tab first dismisses open transient UI; a second tap returns that tab to its root
- [x] **SHELL-03**: Android system Back and the visible app Back control produce identical results on every screen; Back dismisses the topmost transient layer before navigating; Back after a completed edit never replays the finished edit screen
- [x] **SHELL-04**: Back from a Contact Profile returns to the surface the user actually came from (origin-aware), not always Dashboard
- [x] **SHELL-05**: Externally launched/deep-linked flows with no in-app origin fall back to Dashboard on cancel or Back; a deep link to a missing contact shows a friendly message and routes to Dashboard rather than crashing
- [x] **SHELL-06**: Bottom nav and FAB are visible on browse/read surfaces and hidden during focused workflows and while the keyboard is open
- [x] **SHELL-07**: Leaving a focused workflow with meaningful unsaved changes prompts Discard changes / Keep editing
- [x] **SHELL-08**: User can expand a consistently positioned FAB into a labeled speed dial with translucent scrim offering exactly six actions in fixed order: Add Contact, Quick Log, Log Contact, Group Log, Update Contact, Memory
- [x] **SHELL-09**: From a contact's Profile, contact-specific FAB actions preselect that contact; from global contexts they open the shared picker; Group Log opens its canonical workflow directly with no shell-level pre-picker
- [x] **SHELL-10**: User can pick a contact through one reusable modal picker with live search ordered Favorites → recently relevant → alphabetical; archived contacts surface only via explicit search with an Archived badge; snoozed contacts stay selectable with a Snoozed marker
- [x] **SHELL-11**: Quick Log writes immediately at the current time once the target is known, with a success snackbar + Undo + success haptic, or an error snackbar with Retry — never success unless the write committed
- [x] **SHELL-12**: Dashboard exposes Group Events as a prominent header icon+label destination with a redundant overflow entry; Archived Contacts is reachable from Dashboard overflow (the Settings row may remain)
- [x] **SHELL-13**: Root tabs show a branded title with no Back; child and focused screens show Back plus a clear title; the status bar integrates with the active theme and scrollable content clears the nav bar and FAB
- [x] **SHELL-14**: Interactive shell controls carry semantic accessibility labels, adequate touch targets, logical focus order, and correct modal/speed-dial focus management; haptics are semantic only
- [x] **SHELL-15**: Tab switching uses a very short crossfade with no horizontal slide and no swipe-between-tabs gesture

### THEME — Theme & Visual System (Phase 23)

- [ ] **THEME-01**: User can choose a theme package (Galaxy or Standard) independently of appearance mode (Light / Dark / Follow System), yielding all four combinations; Follow System tracks the OS live; first launch defaults to Galaxy + Follow System
- [ ] **THEME-02**: User can pick a UI accent color from a curated palette (~8–10 choices), separate from the owner/star color setting
- [ ] **THEME-03**: Each theme package remembers its own accent, background, and appearance choices; all appearance changes preview live; theme-critical preferences restore before first render (no wrong-theme flash)
- [x] **THEME-04**: User can choose from curated bundled backgrounds per theme (~4–5) plus None/Solid, all shipped locally; backgrounds stay fixed while content scrolls, and surface opacity increases with content density so dense screens stay readable
- [x] **THEME-05**: Galaxy renders glass-forward (translucency, glow) with optionally very subtle ambient motion; Standard renders cleaner, flatter, quieter
- [ ] **THEME-06**: The app respects the OS reduced-motion preference, stopping or simplifying nonessential motion app-wide (a reusable hook consumable from the Skia render loop)
- [x] **THEME-07**: Text respects system text scaling by reflowing rather than truncating or shrinking
- [ ] **THEME-08**: Relationship statuses keep stable semantic hue families across themes, each with its own distinct silhouette glyph — state is never conveyed by color alone
- [ ] **THEME-09**: All screens draw icons through a centralized semantic icon registry supporting state variants, so custom icon art can be swapped later without broad rewrites
- [x] **THEME-10**: Modals/sheets come from shared variants and buttons follow a formal hierarchy (Primary/Secondary/Tertiary/Destructive/Icon-only), with destructive actions visually distinct beyond color
- [ ] **THEME-11**: Functional content meets strong AA-equivalent contrast in every supported theme/mode combination
- [x] **THEME-12**: The Orrery follows the active theme package with a more immersive treatment while still resolving through shared tokens and honoring accessibility
- [ ] **THEME-13**: Theme preferences persist durably on-device and survive backup and restore (portable settings, replacing the old device-local storage)

### KNOW — Contact Knowledge Foundation (Phase 24)

- [x] **KNOW-01**: User sees first-class fields, custom fields, structured relationships, and typed Memory items together in one visually grouped "Things to Remember" surface, featured/current information first
- [x] **KNOW-02**: Memory items are typed, with built-in types governed by one central registry (display, cardinality, history behavior, searchability, AI defaults, presentation); user can create a generic Custom-type Memory with their own label (the type *set* stays application-owned per ADR-028)
- [x] **KNOW-03**: Last Talked About and Current Location are history-aware: the Profile shows the most recent value with the full backlist on drill-in; history behavior is defined centrally per field/type
- [x] **KNOW-04**: User can edit historical entries and promote a historical value back to current where appropriate
- [x] **KNOW-05**: User can record structured relationships with person/name, relation type, and an optional link to another Orbit contact
- [x] **KNOW-06**: Memory items support optional notes, links, and an optional meaningful date; user can pin items and mark items outdated/inactive without deleting
- [x] **KNOW-07**: Deleting a Memory is a soft delete restorable from a Recently Deleted / Trash surface (owned by this phase; expiry runs via launch sweep, never a timer)
- [x] **KNOW-08**: Types/groups have Profile-visibility defaults that individual items can override; hidden-from-Profile is presentation-only, never privacy
- [x] **KNOW-09**: Memory items carry lightweight optional provenance shown mainly in detail/edit views
- [x] **KNOW-10**: Dashboard search can find contact names, Memory labels/values/notes, relationship names, and appropriate custom-field content regardless of storage table, with typo tolerance — implemented as TypeScript scoring over the eligible set, no FTS5 (ADR-031 preserved); internal metadata is never searched
- [x] **KNOW-11**: AI use is opt-in per information item/field behind two gates (global AI enabled, then per-item permission defaulting OFF); AI-enabled items show the sparkle icon; type-level defaults affect newly created items only
- [x] **KNOW-12**: Off Limits marks topics to avoid — visible where relevant, separate from AI permission, and carrying "avoid this topic" semantics when transmitted
- [x] **KNOW-13**: Custom fields support Text, Long Text, Number, Date, Yes/No, URL, Email, Phone, and Choice types; definitions may be global or one-off per contact (promotable to reusable), optionally grouped; values may be current-only or history-retained via a new additive value-history table (ADR-001 uniqueness constraints untouched)
- [x] **KNOW-14**: Freeform notes from the phone Contacts app import as a dedicated "Imported from Contacts App" Memory type, AI-off by default
- [x] **KNOW-15**: Backup/restore preserves the full knowledge model: current values, history, Memories, custom fields, relationships, visibility, pinning, AI permissions, provenance, and soft-deleted records
- [x] **KNOW-16**: Existing share-sheet captures migrate onto the new model as default-type Memories with no data loss

### DASHQ — Dashboard Data & State Foundation (Phase 25)

- [x] **DASHQ-01**: With no explicit population selected, the Dashboard shows Active Contacts — status-bearing contacts only, excluding never-contacted, archived, and unbound (ADR-011 preserved)
- [x] **DASHQ-02**: User can multi-select special populations — Favorites, Birthdays, Not Contacted, Snoozed, All Contacts — combined as an OR-union with each contact appearing once; deselecting the last returns to Active Contacts
- [x] **DASHQ-03**: All Contacts resolves to Active ∪ Not Contacted; archived and unbound stay outside it; the standalone Never Contacted screen and the include-Unbound toggle retire
- [x] **DASHQ-04**: Favorites is binary membership with no user-visible ranking; the Dashboard never sorts by favourite rank (ADR-075); the Birthdays population covers the next 30 days
- [x] **DASHQ-05**: Snoozed contacts remain in Active Contacts but are suppressed from Needs Attention while staying reachable via population selection, search, and deliberate action
- [x] **DASHQ-06**: User can filter across five families — Category, Social Battery, Relationship Status/Needs Attention, Gravity, Contact Frequency — OR within a family, AND across families; filters survive population changes
- [x] **DASHQ-07**: User can sort by Default, Name A–Z/Z–A, Least/Most Recently Contacted, or Relationship Status; Default is population-aware, and an explicit sort survives until reset to Default
- [x] **DASHQ-08**: Dashboard search is scoped to the current Population + Filters universe and never surfaces archived or unbound contacts; unbound contacts get a replacement retrieval path so ADR-062's "retrieval stays available" holds
- [x] **DASHQ-09**: Search matches forgivingly (prefix/substring plus typo tolerance) across the semantic knowledge corpus, ranks by term coverage with identity matches strongly prioritized, and treats the Dashboard sort as tie-breaker only
- [x] **DASHQ-10**: A search result shows up to three prioritized highlighted snippets plus "+N more"; a direct name match does not suppress secondary knowledge matches
- [x] **DASHQ-11**: List/Card preference, population, filters, and sort persist across relaunch (durable, backup-portable); search text and scroll position do not
- [x] **DASHQ-12**: Dashboard → Profile → Back restores the full working Dashboard state including search, filters, population, sort, and scroll position
- [x] **DASHQ-13**: List and Card views share one query state; each query axis is independently clearable and a global Reset Dashboard View restores all four while preserving the List/Card preference
- [x] **DASHQ-14**: The birthday banner is removed from the Dashboard (ADR-076); the Dashboard keeps only the Birthdays population — richer presentation belongs to the deferred Your Week phase

### DASHC — Dashboard Control Surface (Phase 26)

- [x] **DASHC-01**: The Dashboard is lean, ordered header → Population/Filters/Sort control row → Search + List/Card row → contact collection
- [x] **DASHC-02**: User can reach Your Week and Group Events from the Dashboard header as first-class destinations (icon + short label, icon-only fallback)
- [x] **DASHC-03**: Population, Filters, and Sort are three separate equal controls whose summaries show current state (overflow collapses to "+N") with a restrained active treatment on non-default state
- [x] **DASHC-04**: Tapping a control opens an anchored floating panel (not a modal/bottom sheet); changes apply live with no Apply step and results visibly update behind the panel
- [x] **DASHC-05**: While a panel is open the content behind it is interaction-inert and out of accessibility focus; panels dismiss via re-tap, outside tap, or Back, and tapping another control switches panels directly; only one panel opens at a time
- [x] **DASHC-06**: The Population panel offers All Contacts as an ordinary row; Active Contacts remains the implicit unlisted default; Filters can be cleared in-panel and Sort offers an explicit Default
- [x] **DASHC-07**: Search sits below the control row, collapsible, sharing its row with an accessible right-aligned List/Card toggle
- [x] **DASHC-08**: Dashboard overflow offers Group Events, Unbound Contacts, Archived Contacts, Select Contacts, and Reset Dashboard View; Select Contacts enters the Card/Grid multi-select mode (switching view if needed) — no standalone bulk screen; no Manage Favorites entry (retired, ADR-075)
- [x] **DASHC-09**: Unbound and Archived open as Dashboard child routes with origin-aware return, and both Archived entry points (overflow + Settings row) route to one screen
- [x] **DASHC-10**: Reset Dashboard View returns to Active Contacts, no filters, Default sort, cleared search, preserving the List/Card preference

### LISTV — Dashboard List View (Phase 27)

- [x] **LISTV-01**: Each contact renders as a full-width medium-compact row — large circular avatar plus a stable three-line stack: name; recency + category; one deterministic adaptive context line (roughly 5–6 rows visible at default text size)
- [x] **LISTV-02**: Line 2 shows recency plus the contact's category ("18d ago · Friend"), or "No interactions yet" for never-contacted rows
- [x] **LISTV-03**: Line 3 shows a deterministic adaptive context item from existing contact knowledge (imminent → pinned/high-value → other), or a stable per-contact completeness prompt when no useful context exists
- [x] **LISTV-04**: An always-visible Favorite star toggles binary membership with immediate fill/unfill + light haptic, no success snackbar, and revert + notification on persistence failure
- [x] **LISTV-05**: Unsnoozed relationship state shows through two redundant channels — a same-weight status-colored border and a distinct status glyph; unevaluated contacts get a neutral border and no glyph; snoozed contacts get a neutral border and a snooze glyph
- [ ] **LISTV-06**: During search, rows keep the name on line 1 and replace lines 2–3 with a compact match explanation plus the strongest highlighted snippet
- [x] **LISTV-07**: Tap opens Profile (a partially swiped row closes first); right swipe executes the configured logging action, left swipe routes to Edit Contact; one row swipe-revealed at a time; no destructive swipe actions
- [x] **LISTV-08**: User can choose globally between Quick Log and Log Contact for right-swipe (default Quick Log), stored durably and backup-portable; the action executes on gesture commitment
- [x] **LISTV-09**: Assistive-technology users get row actions equivalent to the gestures and an accessible description covering name, category, recency, favorite, and relationship/snooze state without color
- [ ] **LISTV-10**: Fast query changes update rows in place with restrained transitions (reduced-motion respected); skeletons only on initial or meaningfully delayed loads; cause-aware empty/error states shared semantically with Card View

### CARDV — Dashboard Card View (Phase 28)

- [ ] **CARDV-01**: User browses a compact avatar-first grid — 3 columns on a normal portrait phone (~9 cards visible), 2 on narrow devices/large text, more on wide devices — with floating avatar bubbles rather than boxed cards
- [ ] **CARDV-02**: Each card shows name, recency, and one compact adaptive context item (category and literal status text omitted); status renders as a thin status-colored avatar ring plus a small status glyph, never color-only; snoozed shows a neutral ring and snooze glyph
- [ ] **CARDV-03**: An always-visible Favorite star toggles binary membership; during search the card keeps its geometry showing name, matched-field label, and the strongest highlighted snippet
- [ ] **CARDV-04**: Tap opens Profile; long-press opens a per-contact menu (View Profile, Quick Log, Log Interaction, Message, Edit Contact, Favorite/Unfavorite, Snooze/Unsnooze, Select) — Delete and Archive excluded from it; Card View does not duplicate List swipes
- [ ] **CARDV-05**: User can enter multi-select from the long-press menu or Dashboard overflow Select Contacts; selection circles appear only in selection mode, card taps toggle selection, and the selected count is displayed
- [ ] **CARDV-06**: Multi-select locks and replaces the Dashboard control area with selection actions; Select All operates over the result universe frozen when selection began
- [ ] **CARDV-07**: Bulk actions cover Quick Log, Log Interaction, Add to/Remove from Favorites, Snooze/Unsnooze, Set Category, Archive, and Sensitive Operations; Bulk Edit and multi-recipient Message are not offered
- [ ] **CARDV-08**: Bulk Quick Log writes one generic current-time interaction per selected contact (immediate + Undo for small selections, confirmation for large), composed through the canonical recency writers
- [ ] **CARDV-09**: Detailed Log Interaction routes by count: 1 selected → individual flow; 2+ → Group Log with participants preloaded
- [ ] **CARDV-10**: Bulk Archive is the recoverable removal with confirmation; permanent deletion stays a manual per-contact action on the Archived list (ADR-018; no bulk delete, no contact quarantine/auto-purge)
- [ ] **CARDV-11**: Sensitive Operations contains Change Contact Frequency only, with a confirmation summarizing count and value; Gravity is never a bulk action
- [ ] **CARDV-12**: After a successful ordinary bulk operation, selection mode persists (archived cards disappear); the user exits explicitly, and Back exits multi-select before navigating

### ORRC — Orrery Camera, Scale & Exploration (Phase 29)

- [ ] **ORRC-01**: The Orrery presents one canonical relationship-health visualization; the Status/Relationship mode split and its toggle are removed (ADR-077)
- [ ] **ORRC-02**: User can pan, pinch-zoom, tilt (bounded — never inverted or unusably edge-on), and yaw a stable sun-centered world; yaw changes the view, never a contact's underlying placement
- [ ] **ORRC-03**: Perspective depth is noticeable but bounded; avatars and labels stay billboarded and readable; contact size is subtly influenced by derived Gravity and never editable
- [ ] **ORRC-04**: Home framing fits the whole system while comfortably readable, then stops shrinking — large counts grow the world physically with meaningful minimum ring spacing; the complete All Contacts view is never disabled
- [ ] **ORRC-05**: User can choose Spacious / Balanced / Compact density presets (Balanced default) that change spacing only, never membership; the choice persists durably
- [ ] **ORRC-06**: Semantic zoom progressively reveals identity/context across three levels with prioritized labels; contacts get only small stable deterministic collision nudges, no repacking between renders
- [ ] **ORRC-07**: Tapping an unambiguous contact focuses it and zooms to the name-visible level; tapping again opens Profile; ambiguous touches enter Cluster Focus — framed group plus a floating bottom panel listing its contacts to identify, focus, or open
- [ ] **ORRC-08**: Camera state restores on Orrery → Profile → Back within a session but returns to canonical Home on fresh launch — never persisted
- [ ] **ORRC-09**: A visible Polaris landmark yaws with the world; tapping it resets yaw only; a Recenter control restores the full canonical camera state via a bounded distance-adaptive recovery; inertia is very restrained
- [ ] **ORRC-10**: Ring/rank reordering requires an intentionally prolonged stationary hold with activation feedback; ordinary drag pans
- [ ] **ORRC-11**: User can switch among built-in Systems — All Contacts (default), Favorites, Needs Attention, Not Contacted, Snoozed, Chargers, one per Category — via a compact dropdown; membership changes animate as continuity (fade/shrink/settle), not spectacle
- [ ] **ORRC-12**: The All Contacts and Not Contacted Systems include never-contacted contacts at a fixed neutral resting angle with neutral styling and no fabricated progress (ADR-011 honored; widened explicitly per-population, never by weakening the default read)
- [ ] **ORRC-13**: The Orrery exposes a small control surface with System, Density, and Relationship Satellites On/Off (default Off) — no Dashboard-style sort controls
- [ ] **ORRC-14**: With satellites on, unlinked person-like Relationships render as small subordinate moons with semantic visibility; tapping shows name + relation; they carry no status, cadence, membership, logging, or Profile, and disappear when the relationship links to a real contact
- [ ] **ORRC-15**: User can open an accessible "Contacts in this System" companion list showing identity, health state, and Gravity context, with focus-in-Orrery and open-Profile actions
- [ ] **ORRC-16**: Reduced Motion stops ambient drift/twinkle, disables inertia, and turns Focus/Recenter into short direct transitions while manual camera control remains available

### ORRS — Orrery Systems (Phase 30)

- [ ] **ORRS-01**: User can create a named custom System from dynamic rules, explicit manual members, or both — manual-only Systems are valid; rules combine OR within a family, AND across families, over Category, Favorite, Status/Needs Attention, Gravity, Social Battery, Contact Frequency, Not Contacted, and Snoozed
- [ ] **ORRS-02**: User can manually include a non-matching contact (durable) and exclude a matching one (discarded when it stops matching); Reset Membership Overrides clears both while keeping rules
- [ ] **ORRS-03**: Built-in and per-Category Systems keep immutable base definitions — not renamable, hideable (except All Contacts), override-able with visible indication, and duplicable into editable custom Systems
- [ ] **ORRS-04**: Renaming a Category renames its generated System; deleting a Category removes that System and leaves referencing rules visible as needing attention rather than silently rewritten
- [ ] **ORRS-05**: System authoring happens in a multi-page floating Orrery HUD — name, accordion rule families with summarizing headers, live match count, Manage Members, Save — fully operable without touching the canvas
- [ ] **ORRS-06**: Manage Members is a searchable virtualized avatar grid with rule matches preselected; deselecting marks Excluded in place; counts show total plus overrides
- [ ] **ORRS-07**: Preview is full-canvas over real layout/scale with simplified rendering; Save works from Preview or the HUD; Edit restores the builder state; unsaved changes use the shell's Discard/Keep contract
- [ ] **ORRS-08**: Saving a new System switches to it; editing the active System keeps it active; editing a non-active System returns to management without switching
- [ ] **ORRS-09**: A flat Systems Management screen (from the switcher and Settings) supports create/edit/rename/delete/duplicate/reorder/hide-show/override-reset; All Contacts pinned first and nondeletable; names unique case-insensitively
- [ ] **ORRS-10**: Deleting a custom System confirms simply, offers short-lived Undo, never touches contact data, and falls back to All Contacts if it was active
- [ ] **ORRS-11**: The switcher lists Systems in management order with live member counts, hidden Systems omitted, and distinct empty-valid vs broken indicators; both remain selectable with appropriate canvas states
- [ ] **ORRS-12**: The last active System persists across relaunch; switching lands the destination at canonical Home framing, preserving a focus that exists in both Systems
- [ ] **ORRS-13**: Normal switches animate spin + shedding/capture scaled to the membership delta; Reduced Motion uses a simple crossfade/reposition
- [ ] **ORRS-14**: Backup/restore preserves System definitions, rules, inclusions/exclusions, ordering, visibility, and the last-active System preference

### PROF — Profile Experience (Phase 31)

- [ ] **PROF-01**: Profile presents a fixed Hero — large avatar, name, Category, Favorite, Message, Call, overflow, optional background — that templates never restructure; Message/Call stay present but disabled (with accessible explanation) when no usable method exists
- [ ] **PROF-02**: User can reorder, hide/show, and set default expanded/collapsed state for top-level sections, and reorder eligible child sections within their parent — no third nesting level, no hand-ordering of individual items
- [ ] **PROF-03**: User can create reusable named layout templates assigned globally, per Category, or per contact; template edits update assigned Profiles; explicit contact assignment outranks Category; freeform contact overrides are never silently rewritten
- [ ] **PROF-04**: User can create background templates from custom images (drag/reposition + pinch crop) with the same assignment hierarchy; theme-aware readability treatment applies automatically
- [ ] **PROF-05**: When a contact changes Category, inherited layout/background follow the new Category while explicit contact overrides survive
- [ ] **PROF-06**: Layout editing is a deliberate mode from Profile overflow — reveals all eligible sections regardless of data, live-previews against a real contact, and requires explicit Save/Cancel; a freeform layout can be saved as a template at any time
- [ ] **PROF-07**: Expanded/collapsed state persists per contact overriding template defaults; switching templates clears prior presentation overrides; Reset Profile Presentation clears only presentation state — never data, Favorite, Snooze, AI permissions, or knowledge
- [ ] **PROF-08**: Factory order below the Hero is Relationship Overview → Things to Remember → Contact Methods → Interaction History; enabled sections with no data appear collapsed with a useful summary rather than vanishing
- [ ] **PROF-09**: Relationship Overview renders an auto-packed tile grid (declared size variants, no arbitrary placement) with Orbit Status, Gravity, Intensity, Last Interaction, Contact Frequency, and Snooze tiles
- [ ] **PROF-10**: Orbit Status shows its literal label, is not editable, adds no new factors or weighting, and tapping it explains the actual inputs with a route toward Insights
- [ ] **PROF-11**: Gravity presents as a named tier plus a wide-range size-coded sphere, never editable; Intensity presents as a compact histogram resolving its interval from the contact's cadence, with a defined fallback for Unbound contacts (ADR-062 guard — decided once, jointly with Phase 32)
- [ ] **PROF-12**: User can change Contact Frequency directly from its tile with immediate apply; user can snooze/unsnooze from the Snooze tile using presets or a narrow custom duration/date route
- [ ] **PROF-13**: Contact Methods shows ordinary-sized sets in full, actionable when valid, readable-disabled when malformed/imported
- [ ] **PROF-14**: Things to Remember is a one-column configurable section with factory child order Pinned → Last Talked About → Key People → Current Location → Memories → Custom Fields → Off Limits → Imported Notes (enabled, collapsed)
- [ ] **PROF-15**: Remembered-information cards are compact — blank metadata consumes no space, long content truncates, ~3 items then View All; cards tap to detail and long-press to Edit / Pin / Hide; no permanent inline edit/delete controls
- [ ] **PROF-16**: Hidden-from-Profile items stay out of normal rendering but remain recoverable via administration and a Show hidden toggle; hiding never implies privacy, deletion, or AI change
- [ ] **PROF-17**: Off Limits is visible by default with distinct caution presentation ("Avoid bringing these up"); an AI-enabled Off Limits item shows the ordinary sparkle without changing its meaning
- [ ] **PROF-18**: Interaction History exists as a configurable bottom section with minimal interim content behind a replaceable renderer seam Phase 32 upgrades without touching layout persistence
- [ ] **PROF-19**: Profile overflow lists contact actions before presentation actions and has no AI-draft entry — drafting is reached via Message → Draft with AI (ADR-079)
- [ ] **PROF-20**: Profile customization is operable without precise drag, and all state (status, tiers, hidden/expanded/assignment) is exposed textually

### HIST — Interaction History & Insights (Phase 32)

- [ ] **HIST-01**: The Profile History section presents three children — Activity Heatmap, Intensity, and History Browser — replacing the vertical timeline
- [ ] **HIST-02**: The Heatmap encodes interaction count only; lifecycle and non-interaction records never affect saturation or its context card; deleting/re-dating an interaction updates the affected bucket
- [ ] **HIST-03**: User can switch Heatmap lenses — Cycles, 7 Days, Month, Year — with the last-used lens persisting globally (durable, backup-portable)
- [ ] **HIST-04**: Cycles is the default lens: each block is one currently-configured Contact Frequency cycle, presets 5/10/15/20 (default 10, persisting globally), newest bottom-right, with one-cycle shifting and window paging; the current cycle is distinguished structurally, not by a second hue; a defined fallback exists for Unbound contacts (decided once with Phase 31)
- [ ] **HIST-05**: 7 Days is rolling; Month preserves real weekday geometry; Year is a dense daily grid; all support prev/next navigation and block future dates
- [ ] **HIST-06**: Intensity renders over the same selected History window as the Heatmap — lens or period changes re-render both — with no prediction
- [ ] **HIST-07**: Tapping a Heatmap cell opens a small anchored context card first (count + See details, or 0 + Log interaction); the shared detail sheet opens only from it
- [ ] **HIST-08**: The History Browser is a Rolodex with synchronized Month/Day/Year wheels, Day primary, conventional invalid-date clamping, today as the maximum; eventful dates are marked before selection (filled = interaction-bearing, outline = lifecycle-only) with counts exposed to accessibility
- [ ] **HIST-09**: A drawer beneath the wheels summarizes the selected date and exposes See details / Log interaction; scrolling never auto-opens the sheet
- [ ] **HIST-10**: Heatmap and Browser share one period/date detail sheet interleaving all records chronologically with semantic icons — editable Interactions, read-only lifecycle events (Archive/Restore/Snooze/Unsnooze/Bind/Unbind), and history-aware knowledge changes editable per their owning model; Contact Frequency and Category changes are excluded in v1
- [ ] **HIST-11**: Interaction Detail shows channel, date/time, direction, connected, Tone, optional duration, and note without blank fields, plus Edit and Delete; a restrained sparkle appears only when that interaction's Allow AI toggle is ON
- [ ] **HIST-12**: A canonical Edit Interaction route can change every current editable field including date/time, Tone, duration, and the Allow AI toggle; future dates are rejected and derived consumers refresh on save
- [ ] **HIST-13**: Interaction deletion stays hard-delete behind an explicit irreversible confirmation naming derived-metric consequences; no trash subsystem
- [ ] **HIST-14**: Interactions gain optional duration — presets (5m/15m/30m/1h/2h/Custom) or none, never asked by Quick Log, shown only when present, and excluded from Status/Gravity/Intensity this milestone
- [ ] **HIST-15**: Empty historical dates route into canonical detailed logging with contact preselected and the date prefilled for single-day contexts; Quick Log is never used for backfill
- [ ] **HIST-16**: A Group Event parent never appears as a second History row and never increments any count or derived metric; a group-linked Interaction Detail shows restrained Group Event context (badge, title, separate Group Note, View Group Event)
- [ ] **HIST-17**: Editing a group-linked Interaction first asks the scope — individual override editor vs Edit Group Event; deleting a group-linked child removes only that participant
- [ ] **HIST-18**: History is fully usable without color, wheel gestures, or marker iconography; Reduced Motion simplifies wheel depth/inertia without removing navigation

### GRP — Group Interaction Logging (Phase 33)

- [ ] **GRP-01**: User can create a Group Event with required title and date/time; participants are optional and a zero-participant event is valid (event-first capture)
- [ ] **GRP-02**: Each participant receives exactly one canonical child Interaction; the parent never counts as an additional interaction anywhere
- [ ] **GRP-03**: Shared Channel, Tone, and Duration live at event level with live inheritance; Group Log defaults Channel In Person, Tone unset, Duration unset, and is exempt from the ordinary Channel-default preference
- [ ] **GRP-04**: User can override Channel, Tone, Duration, Direction, and Connected per participant and clear an override via explicit "Follow event…" wording; date/time and title are never participant-overridable
- [ ] **GRP-05**: One shared Group Note is owned by the event, distinct from participant notes; a Group Note is never transmitted to AI under any circumstance (ADR-078 context; no toggle exists for it)
- [ ] **GRP-06**: User can add/remove participants via the shared multi-select picker (no cap); adding after save inherits current shared values stamped at the event date/time; removing prompts Delete interaction / Keep as individual / Cancel
- [ ] **GRP-07**: User can convert an existing ordinary Interaction into a Group Event without it losing its identity/UID; its values seed the shared defaults
- [ ] **GRP-08**: Group Event Detail is presentation-first (participant cards open child Interaction Detail); Edit Group Event is a separate focused form
- [ ] **GRP-09**: User can browse Group Events on a lean reverse-chronological page searchable by title and participant, reachable from the Dashboard header and overflow
- [ ] **GRP-10**: User can Dissolve a Group Event (children survive standalone with materialized values) or Delete Group Event & Interactions (permanent), each behind explicit confirmation; deleting one child affects only that participant
- [ ] **GRP-11**: All Group Event fan-out mutations are atomic — complete or fully rolled back with form state preserved on failure — and every child write routes through the canonical recency writers (single-writer invariant)
- [ ] **GRP-12**: Historical/backdated Group Events are supported through now; future-dated events are rejected
- [ ] **GRP-13**: Group Events, child links, shared values, Group Note, and override/inheritance state survive backup and restore without flattening

### CAPT — Rapid Capture & Update Flows (Phase 34)

- [ ] **CAPT-01**: User can create a contact with Name as the only required field via a streamlined three-section Add Contact (Identity, Relationship Basics, Contact Methods) with Show More revealing advanced sections; Save routes to the new Profile
- [ ] **CAPT-02**: Add Contact retains the tri-state last-spoke control (today / on date / not yet) defaulting "today"; "Not yet" creates no interaction (ADR-016 preserved)
- [ ] **CAPT-03**: A contact created with no Contact Frequency is Unbound; selecting a cadence turns Bound on; the user can keep a dormant cadence while Unbound
- [ ] **CAPT-04**: Edit Contact exposes the complete record as direct-access top-level accordion sections without nesting Things-to-Remember subdomains
- [ ] **CAPT-05**: Quick Log stays immediate/current-time with truthful feedback and Undo; its success feedback offers Add Note → a small post-log editor saving an Interaction Note or Create Memory Instead (never both), optionally followed by Edit Memory
- [ ] **CAPT-06**: The full Memory creation/editing experience lives in Update Contact's Memory editor, with type selected inside and less-common metadata behind More Options
- [ ] **CAPT-07**: Detailed Log Interaction exposes date/time (default now, freely backdateable with no age warnings), Channel, Direction, Connected where meaningful, optional Tone, Note, and Allow AI, with Duration under More Options
- [ ] **CAPT-08**: The Channel chooser offers exactly Message / Call / In Person; Direction defaults Outbound for Message/Call and Mutual for In Person; Connected defaults Yes and is hidden for In Person
- [ ] **CAPT-09**: Tone offers Positive / Neutral / Negative, optional, defaulting null — an omitted Tone is never treated as Neutral
- [ ] **CAPT-10**: The per-interaction Allow AI toggle sits with the Note field, defaults OFF (initialized from Phase 36's new-items-only type default), survives save, and stays editable
- [ ] **CAPT-11**: A Default Interaction Channel preference (Remember Last Choice factory / Message / Call / In Person) governs ordinary logging only; Remember Last Choice updates only after a successful ordinary save; Group Log is exempt
- [ ] **CAPT-12**: Update Contact opens a compact chooser (Last Talked About, Key People, Current Location, Memory, Off Limits, Contact Method, Contact Frequency, custom fields by name) that returns to the chooser after each save until Done; Category stays Edit-Contact scope
- [ ] **CAPT-13**: Quick Log, Log Interaction, and Update Contact preselect the contact when the invoking context identifies one; History-originated logging prefills that day
- [ ] **CAPT-14**: Failed saves preserve form state and never show completion; validation errors reveal and focus the relevant accordion; unchanged forms exit without confirmation
- [ ] **CAPT-15**: The legacy interaction vocabulary migrates: quality → Tone values and six-value channel → Message/Call/In Person, with legacy values kept representable and every literal consumer updated in the same change

### COMP — Messaging & AI Compose (Phase 35)

- [ ] **COMP-01**: Compose opens directly on a blank composition editor — no auto-inserted greeting, AI prose, or prompts
- [ ] **COMP-02**: User can compose in Text or Email mode, initialized from the Settings default (Text / Email / Remember Last Choice, factory Remember Last Choice) with an ad-hoc per-session switch; the remembered mode updates only on Transmit or Copy
- [ ] **COMP-03**: Text resolves the primary phone and Email the primary email; a deliberate selection establishes a missing primary; Compose falls back to the usable mode when the preferred one has no destination, and stays usable for drafting/Copy when neither does
- [ ] **COMP-04**: Email mode exposes Subject + Body; Transmit preserves recipient/subject/body; main Copy copies the body and Subject has its own copy affordance
- [ ] **COMP-05**: Transmit hands the composition to the external composer and never claims delivery; returning can show a compact "Did you send it?" — only "Yes, log interaction" writes the canonical Message interaction, "Not yet" preserves the session, and Copy never triggers it
- [ ] **COMP-06**: The Compose-attached confirmation coexists with the durable assist lifecycle (ADR-070/071): the app-global banner and pending sheet remain, a dismissal path exists, and the interaction stamps at handoff time
- [ ] **COMP-07**: Compose session state (body, subject, mode, destination, Message Focus) survives in-app navigation and ordinary backgrounding but is not a durable draft — no drafts table, no backup contract
- [ ] **COMP-08**: User can open Things to Remember Research as a sibling full-screen side — a compact read-only projection of only populated conversation-relevant knowledge, excluding operational metadata, with no add/edit actions
- [ ] **COMP-09**: Compose honors three AI states: AI Off removes every AI affordance; AI On + Ready exposes them; AI On + Needs Attention shows a restrained repair notice instead of silently hiding AI; manual composition and Research work fully in every state
- [ ] **COMP-10**: AI consumes only preauthorized Contact Knowledge with no per-generation authorization review; Off Limits items render in a distinct Avoid presentation, pass to AI only as avoidance constraints when authorized, and can never be Message Focus
- [ ] **COMP-11**: User can mark up to three AI-authorized research items Add to AI ("Added ✓") as session-only Message Focus shown compactly on the Compose side; Add to AI never grants permission
- [ ] **COMP-12**: One adaptive AI action shows Draft with AI (empty editor) or Rewrite with AI (existing text); each request returns three unlabeled varied suggestions on a non-destructive review surface; the editor changes only on explicit "Choose this"; Try Again replaces the set
- [ ] **COMP-13**: AI generation is cancellable and failure-safe — the manual draft is preserved with concise recovery, and Compose never becomes a provider-troubleshooting surface
- [ ] **COMP-14**: Compose is deep-link-ready and origin-aware; completing a send/log returns toward the origin without leaving a finished draft in Back history

### AICFG — AI Configuration & Prompting (Phase 36)

- [ ] **AICFG-01**: A real global AI Enabled master toggle disables AI generation everywhere while preserving connections, credentials, models, personalization, and permissions; turning it back on restores immediately when still valid; a credential-management escape hatch remains while AI is off
- [ ] **AICFG-02**: User can configure three connection lanes — OpenRouter (recommended), direct BYOK for OpenAI/Anthropic/Gemini (Advanced), OpenAI-compatible HTTPS Custom Endpoint (Advanced) — with exactly one active connection and stored inactive configurations
- [ ] **AICFG-03**: Starting setup on a new lane never breaks the working connection — the new lane activates only on success; switching back to a valid saved connection restores its remembered model; removal is a separate deliberate action
- [ ] **AICFG-04**: OpenRouter connects via a browser-based authorization flow with an Orbit-owned curated-first model picker (Browse All available), real current/cached pricing on model cards, and cache-friendly daily/manual catalog refresh; recommendations are runtime data, not frozen constants
- [ ] **AICFG-05**: Orbit never silently substitutes a model or connection: an unavailable selection becomes an explicit Needs Attention state requiring deliberate reselection, with repair actions offered; AI readiness = valid connection + valid model
- [ ] **AICFG-06**: Orbit owns an immutable system/output prompt contract; user personalization layers through structured Writing Style controls plus ordered, enableable Personalization Context sections (paste or .txt/.md import copied into local records)
- [ ] **AICFG-07**: No artificial context ceiling and no silent truncation; token/context estimates are exposed (plus OpenRouter input-cost estimates), and true model-capacity overflow is surfaced explicitly
- [ ] **AICFG-08**: AI-permitted Contact Knowledge is included automatically per contact; Message Focus adds emphasis without changing permission; AI-enabled Off Limits transmit as avoidance constraints (ADR-078); the three most recent Interactions may be included with a note only where that interaction's Allow AI toggle is ON; Group Notes are never transmitted
- [ ] **AICFG-09**: Adjust is ephemeral per session — quick actions plus freeform guidance returning three revised alternatives without changing persistent Writing Style
- [ ] **AICFG-10**: A central AI permission manager provides new-item type defaults (default OFF, new-items-only, covering interaction notes), searchable review, contact drill-in, bulk disable, and bulk enable only behind explicit impact confirmation — and never surfaces Group Notes
- [ ] **AICFG-11**: Settings can inspect the whole resolved system/prompt and preview it with a chosen contact (credentials never shown); Compose shows only the contact-specific disclosure for the current generation
- [ ] **AICFG-12**: First successful AI setup shows a lightweight disclosure naming the real data path; the exact-prompt first-send acknowledgement is retired (ADR-079)
- [ ] **AICFG-13**: Generation failures translate to human-readable categories with optional details, preserving Compose state, never failing over silently
- [ ] **AICFG-14**: AI failures emit sanitized structured diagnostics carrying only safe metadata — never contact data, notes, prompts, personalization, credentials, or generated output (a seam for later Sentry wiring, not an installation)
- [ ] **AICFG-15**: API keys and credential material stay in secure storage only (ADR-049) — never in app settings or the backup
- [ ] **AICFG-16**: Backup/restore preserves nonsecret AI personalization, configuration, and permissions while excluding all credentials; a restored install never falsely appears Ready
- [ ] **AICFG-17**: The backup wire format bumps to v4 as this phase's FINAL plan — after all other milestone schema — serializing every entity and portable preference the milestone added, with restore validation and orphan repair (including Phase 33's Group Event rules) and a decided restore-compat behavior for every retired key

## Deferred-planning phases (no requirements yet)

These phases have reserved slots and stub contracts, not dossiers. Their requirements are defined
when they are interrogated/planned against the implemented product — do not derive requirements for
them now.

- **Phase 37 — Settings & Personalization** — consolidates the preference/admin seams exported by
  Phases 22–36 (see `docs/dossier/milestone-2/planning-notes/phase-15-17-18-stub-contracts.md`)

- **Phase 38 — Your Week** — owns relocated birthday presentation (ADR-076), Group Event rollups,
  heatmap-aggregation reuse (see `planning-notes/phase-19-your-week-placeholder.md`)

- **Phase 39 — Onboarding** — first-run setup/teaching against the real product (stub contracts file)
- **Phase 40 — Responsive & Release Hardening** — device/accessibility/performance audit pass
  (stub contracts file)

## Out of Scope

Milestone-level exclusions with reasons. Per-phase `[DEFERRED]`/`[REJECTED]` detail lives in each
dossier and is binding there.

| Feature | Reason |
|---------|--------|
| Any backend / cloud sync | Local-first is a product commitment; the Sync milestone is now labeled v3.0 (`.planning/sync-milestone/`) |
| Social graph / satellite Orrery expansion | Relationship Satellites stay lightweight presentation of unlinked relationships (Phase 29 dossier) |
| In-app messaging client, third-party chat integrations, durable message drafts | Compose is a drafting workspace with external handoff (Phase 14 dossier) |
| Orbit-hosted AI proxy, subsidized inference, LAN/local-model endpoints, silent failover | AI stays optional BYO-connection with explicit states (Phase 16 dossier) |
| Bulk Delete of contacts; contact quarantine / auto-purge | Bulk Archive is the recoverable removal; permanent delete stays manual per-contact (ADR-018) |
| Ranked favourites / Manage-favourites screen | Favorites are binary (ADR-075) |
| Dashboard birthday banner | Relocated to the deferred Your Week phase (ADR-076) |
| Second Orrery view/mode | Single canonical status view (ADR-077) |
| User-created Memory *system* types, tags, rich attachments | Custom-type label only; type set stays application-owned (ADR-028) |
| FTS5 / search indexes | TypeScript scoring over the eligible set (ADR-031 preserved) |
| Planned/future Group Events, calendar sync, event analytics | Phase 12 dossier deferrals |
| Custom uploaded/downloadable theme backgrounds, custom icon family, illustration library | Phase 2 dossier deferrals — registry/architecture only |
| Full app-wide Sentry installation | Phase 16 defines only the sanitized diagnostic seam; wiring is Release Hardening |

## Traceability

Requirement categories map one-to-one to phases; `.planning/ROADMAP.md` lists the same mapping per phase
(with each phase's derived success criteria and its canonical dossier + planning-notes refs).
Status values: **Pending** = roadmapped, not yet planned.

| Category | Phase | Status |
|----------|-------|--------|
| SHELL-01…15 | Phase 22 — App Shell & Navigation | Complete (2026-09-03) |
| THEME-01…13 | Phase 23 — Theme & Visual System | Pending |
| KNOW-01…09 | Phase 24.1 — Contact Knowledge Foundation (Model, Storage & UI) | Pending |
| KNOW-10…16 | Phase 24.2 — Contact Knowledge (Egress, Search, Types & Data-moves) | Complete |
| DASHQ-01…14 | Phase 25 — Dashboard Data & State Foundation | Pending |
| DASHC-01…10 | Phase 26 — Dashboard Control Surface | Pending |
| LISTV-01…10 | Phase 27 — Dashboard List View | Pending |
| CARDV-01…12 | Phase 28 — Dashboard Card View | Pending |
| ORRC-01…16 | Phase 29 — Orrery Camera, Scale & Exploration | Pending |
| ORRS-01…14 | Phase 30 — Orrery Systems | Pending |
| PROF-01…20 | Phase 31 — Profile Experience | Pending |
| HIST-01…18 | Phase 32 — Interaction History & Insights | Pending |
| GRP-01…13 | Phase 33 — Group Interaction Logging | Pending |
| CAPT-01…15 | Phase 34 — Rapid Capture & Update Flows | Pending |
| COMP-01…14 | Phase 35 — Messaging & AI Compose | Pending |
| AICFG-01…17 | Phase 36 — AI Configuration & Prompting | Pending |
| (deferred) | Phases 37–40 — Settings / Your Week / Onboarding / Release Hardening | Deferred planning |

**Coverage:**

- v2.0 requirements: 217 total
- Mapped to phases: 217
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-02*
*Last updated: 2026-09-02 after roadmapping — all 217 requirements mapped to Phases 22–36 in ROADMAP.md*
