# Dossier — App Shell & Navigation

**Status:** complete · Interrogated 2026-08-28 · 40 questions over 4 rounds · No known open product decisions remain at the shell level.

## Scope

This dossier defines the permanent application shell inherited by later UI/UX phases.

It covers top-level navigation, tab stacks, Back behavior, persistent bottom navigation, focused-workflow exceptions, the universal capture FAB, shared contact selection, transient overlays, deep-link/future-widget routing principles, safe areas, system UI, keyboard behavior, app bars, navigation motion, haptics, and shell-level accessibility.

It intentionally does **not** define the detailed forms or business rules behind Add Contact, Quick Log, Log Contact, Update Contact, or Memory. Those are owned by later phases. This phase only establishes how the shell exposes and routes to them.

---

## Amendment / Supersession — Phase 12 Group Interaction Logging

**Status:** targeted shell amendment based on the later, fully settled Phase 12 — Group Interaction Logging subsystem.

This amendment preserves all existing Phase 1 shell decisions except where the older five-action FAB/routing wording is explicitly superseded below. Phase 12 remains the owner of Group Event form and domain behavior.

### [SUPERSEDED] Universal FAB action set expands from five actions to six

The canonical universal FAB action set is now:

1. Add Contact
2. Quick Log
3. Log Contact / canonical individual detailed logging action
4. **Group Log**
5. Update Contact
6. Memory / remembered-information action

Any later reference in this dossier to a **five-action** FAB or to the universal action set omitting Group Log is superseded by this six-action contract.

### [DECIDED] Group Log is a distinct first-class FAB action

Group Log is a visible user intent in its own right. It must not be hidden behind the ordinary individual Log Contact action.

The existing fixed-order, labeled speed-dial philosophy remains intact; implementation should accommodate the sixth action without changing the fundamental universal-FAB contract.

### [DECIDED] Group Log is independently routable and deep-link-ready

Group Log receives its own dedicated semantic internal route and participates in the same external-dispatcher/future-widget principles already established for other capture workflows.

Any later Routing Contract list in this dossier should be read as also including **Group Log**.

### [DECIDED] Group Log opens directly into its canonical focused workflow

Unlike contact-specific individual actions that may require the shared shell contact picker when no target is known, **Group Log does not use a shell-level pre-picker**.

Selecting Group Log opens the canonical focused Group Log workflow directly. Participant selection and participant-management behavior belong inside that workflow.

### [DECIDED] Dashboard owns a first-class Group Events destination for this milestone

The Dashboard header exposes **Group Events** as a prominent **icon + label** destination.

Dashboard overflow also exposes Group Events as a redundant discovery/management path.

Group Events remains Dashboard-owned in this milestone and does **not** become a fifth permanent bottom-navigation destination. The Phase 1 four-tab bottom-nav contract remains:

1. Dashboard
2. Orrery
3. Backup / Restore
4. Settings

### [REJECTED FOR THIS MILESTONE] Dashboard bottom-nav radial/menu launcher

The existing Dashboard bottom-nav destination remains an ordinary tab.

Do **not** convert it into a radial/menu launcher as part of this milestone.

### [BOUNDARY] Phase 1 does not own Group Event form/domain behavior

Phase 1 owns only the shell exposure and routing amendments above.

**Phase 12 owns** Group Event persistence, event/child Interaction relationships, shared/default inheritance, participant overrides, Group Event Detail/Edit, participant management, lifecycle, browsing/management, atomic multi-row behavior, and backup/restore semantics.

Do not pull those behaviors into Phase 1.

### Deferred Shell Ideas — note only, do not implement

The following remain explicitly deferred:

- future **Mission Control** / true multi-feature Dashboard concept;
- possible rename of the current Dashboard contact browser;
- future bottom-navigation restructuring;
- possible Dashboard-tab radial/menu launcher;
- possible future dedicated Group Events bottom-navigation destination.

### Supersession Map

This amendment specifically supersedes or extends the following older Phase 1 text without otherwise reopening the dossier:

- **Section F — Universal FAB Action Set:** five actions → six, adding Group Log.
- **Routing Contract:** add dedicated semantic Group Log routing and dispatcher/deep-link readiness.
- **Cross-Phase Constraints — action workflows:** universal actions now include Group Log.
- **Phase Success Criterion 4:** read “six-action labeled speed dial,” not “five-action.”
- **Top-Level Navigation / Dashboard shell:** add Dashboard-header Group Events icon+label plus Dashboard-overflow entry while preserving the four permanent bottom-nav destinations.

All other Phase 1 decisions remain intact.

---

## Decisions

### A. Top-Level Navigation

**[DECIDED] Four permanent bottom-nav destinations:**
1. Dashboard
2. Orrery
3. Backup / Restore
4. Settings

Your Week remains Dashboard-owned. Search remains Dashboard-specific. Favorites remain a Dashboard/widget concern. Add/capture actions belong to the universal FAB.

**[DECIDED] Each top-level tab preserves its own navigation stack.**

Example: `Settings → Notifications → Dashboard → Settings` returns to Notifications.

**[DECIDED] Tapping the already-active tab returns that tab to root, but transient UI is dismissed first.**

If a speed dial, search modal, filter modal, or similar lightweight overlay is open, the first active-tab tap dismisses it. A subsequent active-tab tap returns that tab to root.

**[DECIDED] Backup / Restore is a full top-level section, not a special-case shortcut.**

It owns a root route, its own remembered stack, and room for future child routes.

---

### B. Bottom Navigation Visibility & Focused Workflows

**[DECIDED] Bottom navigation remains visible on browse/read surfaces and hides during focused workflows.**

Likely visible: Dashboard, Orrery, Backup root, Settings root, Contact Profile, Your Week, Archived Contacts, ordinary Settings child pages.

Likely hidden: Add Contact, Edit Contact, Log Contact, Update Contact, Compose Message, onboarding, destructive/confirmation workflows, and similar focused forms.

**[DECIDED] Meaningful unsaved changes require explicit abandonment confirmation.**

Prompt:
- **Discard changes**
- **Keep editing**

The shell does not assume arbitrary forms can safely autosave or partially save.

---

### C. Back Navigation

**[DECIDED] Android system Back and visible app Back have identical logical results.**

**[DECIDED] Normal in-app Back is origin-aware.**

Examples:
- Dashboard → Profile → Back = Dashboard
- Orrery → Profile → Back = Orrery
- Your Week → Profile → Back = Your Week
- Profile → Edit Contact → Back/Save = Profile

**[DECIDED] Externally launched/deep-linked flows use a canonical Orbit fallback when no meaningful internal origin exists.**

The previous rule that Profile always backs to Dashboard is superseded.

**[DECIDED] Completed workflows must be removed/replaced in the navigation stack so Back never replays a finished edit screen.**

The current bad behavior `Profile → Edit → Save → Profile → Back → Edit` must not occur.

**[DECIDED] Back dismisses the topmost transient layer before navigating.**

Expanded FAB → collapse; modal → dismiss; otherwise navigate.

---

### D. External / Deep-Link Completion

**[DECIDED] Completion destination depends on action type.**

- Contact-specific action completed → target contact Profile
- Add Contact completed → newly created contact Profile
- Direct external Profile link → Profile
- Cancel/back from externally launched action with no in-app origin → Dashboard
- Back from directly deep-linked Profile with no in-app origin → Dashboard

**[DECIDED] Missing/deleted deep-link contacts fail safely.**

Show a friendly “contact no longer available” error, then route to Dashboard. Do not crash or silently retarget.

---

### E. Universal Capture FAB

**[DECIDED] Orbit uses one universal capture/action FAB system.**

It represents Orbit’s low-friction capture/update philosophy.

**[DECIDED] FAB visibility mirrors bottom-nav visibility: present on browse/read surfaces, hidden during focused workflows.**

**[DECIDED] FAB occupies the same screen-space position wherever visible.**

Bottom-right, consistently offset above bottom navigation and safe areas.

**[DECIDED] Main FAB uses `+`.**

**[DECIDED] FAB expands as a labeled Android-style speed dial.**

Each child action uses **icon + text**.

**[DECIDED] Expanded FAB uses a subtle translucent scrim.**

**[DECIDED] Speed dial can be dismissed by main FAB, scrim/outside tap, Back, or selecting an action.**

---

### F. Universal FAB Action Set

**[DECIDED] Canonical action set contains five actions:**
1. Add Contact
2. Quick Log
3. Log Contact
4. Update Contact
5. **Memory** — working title only

`Memory` is the current working label for “add something to remember.” Final product terminology is deferred to the Contact Knowledge phase.

**[DECIDED] Action ordering stays fixed across screens.**

**[DECIDED] Current contact context preselects the target where appropriate.**

From Sarah’s Profile, Quick Log / Log Contact / Update Contact / Memory target Sarah automatically. Add Contact remains untargeted.

From global contexts, contact-specific actions invoke the shared picker.

---

### G. Shared Contact Picker

**[DECIDED] Orbit has one reusable canonical contact-picker component.**

It is reused by Quick Log, Log Contact, Update Contact, Memory, and future workflows/widgets needing a contact target.

**[DECIDED] Picker is a compact modal/bottom-sheet style surface, not a route into Dashboard search.**

It includes search, a short prioritized initial list, live filtering, and clear single-contact selection.

**[DECIDED] Initial ordering prioritizes:**
1. Favorites
2. Recently relevant/interacted-with contacts
3. Remaining contacts alphabetically

**[DECIDED] Archived contacts are hidden normally but can surface through explicit search with an Archived badge.**

What happens to archive state after a new action is deferred.

**[DECIDED] Snoozed contacts remain selectable and carry a visible Snoozed marker.**

Explicit user intent overrides passive snooze suppression.

---

### H. Quick Log Shell Behavior

**[DECIDED] Quick Log writes immediately once the target is known.**

Profile: `FAB → Quick Log` writes immediately.

Global: `FAB → Quick Log → choose contact` then writes immediately.

**[DECIDED] Quick Log means “now.”** Backdating/details belong to Log Contact.

**[DECIDED] Successful Quick Log shows a snackbar with Undo plus subtle success haptic.**

**[DECIDED] Failed Quick Log shows an error snackbar with Retry where recoverable.**

Never show success unless the database write actually committed.

---

### I. Top App Bars

**[DECIDED] Orbit uses a standardized app-bar/header architecture.**

Root tabs:
- title or branded identity
- optional trailing utilities/overflow
- no Back control

Child/read screens:
- Back
- title
- optional trailing utility/overflow

Focused workflows:
- Back/Cancel as appropriate
- clear workflow title
- primary completion action determined by the owning phase

**[DECIDED] Dashboard is the branded root.**

Dashboard may use Orbit branding/logo identity. Orrery, Backup / Restore, and Settings use explicit destination titles.

Exact visual styling is owned by the Theme phase.

---

### J. Safe Areas & System UI

**[DECIDED] Android status bar visually integrates with the active theme.**

Background may extend behind it; icons adapt for contrast; interactive content remains safely inset.

**[DECIDED] Shared shell primitives own device/system insets.**

Individual screens must not manually guess padding for status bars, camera cutouts, gesture zones, or system navigation.

**[DECIDED] Immersive surfaces may render edge-to-edge, but interactive controls still obey safe areas.**

**[DECIDED] Bottom navigation uses a consistent visual bar plus the actual device bottom inset.**

**[DECIDED] Scrollable content must include enough bottom clearance that final items can scroll fully above nav/FAB regions.**

---

### K. Keyboard Behavior

**[DECIDED] Bottom nav and FAB temporarily hide while the software keyboard is open.**

**[DECIDED] Orbit uses shared keyboard-aware behavior.**

The focused control and the primary action needed to complete the current entry must remain reachable while the keyboard is visible.

Implementation may use resize, keyboard-aware scrolling, inset changes, or modal resizing as appropriate.

---

### L. Navigation Motion

**[DECIDED] Navigation uses conventional mechanics with restrained branded motion.**

Subtle fades, mild microinteractions, and FAB motion are appropriate; heavy cinematic/orbital navigation is not.

**[DECIDED] Bottom-tab switching uses a very short crossfade.**

No horizontal slide and no swipe-between-tabs gesture.

---

### M. Haptic Language

**[DECIDED] Haptics are restrained and semantic.**

- Light feedback: expandable action control such as FAB opening
- Success feedback: Quick Log / successful fast action
- Warning feedback: destructive confirmation
- Ordinary navigation/taps: none

Exact API mappings may be tuned during implementation.

---

### N. Shell Accessibility

**[DECIDED] Accessibility architecture begins in Phase 1.**

Shell-level contracts:
- semantic accessibility labels for interactive controls
- accessibility names consistent with visible labels
- appropriate minimum touch targets
- logical focus order
- correct focus management for modal/speed-dial UI
- restore focus to invoking control where practical
- announce meaningful navigation/status changes where appropriate
- do not rely exclusively on color or animation for meaning

The final release-hardening phase audits accessibility; it does not introduce it for the first time.

---

## Routing Contract

**[DECIDED] Orbit uses dedicated semantic internal routes plus a generic external dispatcher.**

Internally, actions/screens should have clear semantic routes for concepts such as:
- contact profile
- new contact
- quick log
- log contact
- update contact
- Memory / add remembered item

Exact URL syntax is implementation detail.

Externally, a dispatcher should be able to translate widget/notification/deep-link intents into those internal routes. This keeps future native widgets and shortcuts from coupling tightly to internal navigation details.

---

## Cross-Phase Constraints Exported

- **[shell → all UI phases]** Use shared safe-area/page-shell primitives. No return to ad hoc status/cutout/navigation padding.
- **[shell → browse/read surfaces]** Preserve bottom nav and universal FAB unless a screen is intentionally classified as focused.
- **[shell → focused workflows]** Hide bottom nav/FAB and protect meaningful unsaved changes with Discard / Keep editing.
- **[shell → profile/dashboard/orrery/your-week]** Profiles return to actual in-app origin; do not restore “Profile always backs to Dashboard.”
- **[shell → action workflows]** Universal actions are Add Contact, Quick Log, Log Contact, Update Contact, and Memory.
- **[shell → contact knowledge]** `Memory` is only a working label. Final terminology and data semantics belong to the Contact Knowledge phase.
- **[shell → rapid capture]** Quick Log is current-time, immediate, reversible via Undo, and explicitly reports failures.
- **[shell → future widgets]** Fast-entry workflows must remain independently routable/deep-linkable. Actual widget design remains deferred.
- **[shell → lifecycle]** Archived contacts can surface through explicit picker search. Whether acting on one restores it remains unresolved here.
- **[shell → snooze]** Snoozed contacts remain selectable in explicit action pickers and are visibly marked.
- **[shell → theme]** Status-bar integration, scrims, FAB/app-bar styling, and motion styling resolve through theme tokens.
- **[shell → accessibility]** Later phases inherit shell accessibility primitives.
- **[shell → responsive]** Shell architecture must avoid new portrait-only structural assumptions even though full landscape support comes later.

---

## Explicitly Deferred

- detailed Add Contact form
- detailed Log Contact form
- Update Contact taxonomy
- final Memory / Things to Remember terminology
- archive-state behavior after interacting with an archived contact
- widget visual/product design
- exact deep-link URL syntax
- exact colors, spacing, typography, shadows, and animation durations
- bespoke landscape/tablet navigation
- global search
- authentication/account identity
- screen-specific accessibility beyond shell primitives

---

## Phase Success Criteria

Phase 1 is successful when:

1. Dashboard, Orrery, Backup / Restore, and Settings are reachable through persistent bottom navigation with correct safe-area handling.
2. Each tab preserves its stack; active-tab retap dismisses transient UI first and then returns that section to root.
3. Android Back and visible Back agree, origin-aware navigation works, and completed edit routes no longer replay.
4. The universal FAB is consistently positioned, expands into the five-action labeled speed dial, and preselects contact context where available.
5. Global contact-specific actions use the shared picker with the decided favorite/recent/alphabetical ordering and archived/snoozed behavior.
6. Quick Log executes with minimal friction and truthful Undo/error/Retry feedback.
7. Top bars, system insets, keyboard behavior, content clearance, and bottom-nav spacing are handled by reusable shell primitives.
8. Navigation is ready for future widget/deep-link entry without duplicating workflow logic.
9. Shell accessibility and haptic conventions exist as reusable primitives.

---

## Notes for GSD / Roadmapper

- This dossier is intentionally more specific than GSD’s normal milestone interrogation output.
- Convert these decisions into atomic, user-observable requirements rather than copying implementation language directly.
- App Shell & Navigation is a prerequisite for later UI phases and should remain early.
- Do **not** pull the full Rapid Capture business flows into this phase merely because the FAB exposes them. Phase 1 owns navigation/exposure/plumbing; Rapid Capture owns the actual forms and domain behavior.
- `Memory` is explicitly a working title, not final product terminology.
- Portrait lock may remain until the later responsive phase, but Phase 1 must not create new structural assumptions that prevent landscape later.
