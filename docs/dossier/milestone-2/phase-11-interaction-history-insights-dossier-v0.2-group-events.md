# Dossier — Interaction History & Insights

**Status:** complete · Interrogated through 2026-08-31 · Amended 2026-09-01 for Phase 12 Group Interaction Logging integration · History visualization, browsing, drill-down, interaction detail/editing, duration, and reusable temporal aggregation decisions settled.

## Decision Legend
- **[DECIDED]** explicitly chosen by the owner.
- **[DERIVED]** implementation/architecture consequence.
- **[DEFERRED]** intentionally postponed.

## Scope

This dossier defines Orbit's release-quality **Interaction History & Insights** experience as the dedicated History section linked from Contact Profile.

It covers:
- History section structure,
- reusable interaction-activity heatmap,
- frequency-cycle, rolling 7-day, calendar-month, and calendar-year lenses,
- cycle-count presets,
- shared History timeframe/window state,
- Intensity visualization aligned to the selected History window,
- heatmap tap/context behavior,
- reusable period/date detail sheet,
- Galaxy/Standard-themed Rolodex-style History Browser,
- synchronized Month / Day / Year wheels,
- date event markers and drawer summary,
- interaction/lifecycle/history-bearing record taxonomy,
- canonical Interaction Detail surface,
- new Edit Interaction route,
- interaction deletion confirmation,
- optional interaction duration,
- custom historical backfill/logging entry points,
- reusable temporal aggregation seams for future account/category analytics.

It intentionally does **not** redefine Contact Profile composition, Status/Gravity algorithms, Contact Frequency semantics, general analytics dashboards, Your Week, Contact Knowledge storage beyond history-bearing records already established, Rapid Capture form redesign, Category CRUD, AI behavior, or broad audit logging.

---

# Amendment / Supersession — Phase 12 Group Interaction Logging

**Status:** targeted Phase 11 amendment based on the later, fully settled **Phase 12 — Group Interaction Logging** subsystem.

This amendment preserves Phase 11's existing History, Heatmap, Intensity, History Browser, detail-sheet, Interaction Detail, Edit Interaction, duration, and deletion contracts except where group-linked Interactions require explicit contextual or routing behavior.

Phase 12 remains authoritative for Group Event persistence, parent/child relationships, event-owned fields, participant overrides/inheritance, Group Event Detail/Edit, participant lifecycle, conversion, atomicity, and backup/restore.

## Group Event / child Interaction history contract

**[DECIDED]** A Group Event is a parent authoring/history-context record around ordinary canonical one-contact child Interactions.

**[DECIDED]** The Group Event parent is **not** an additional contact Interaction.

**[DECIDED]** For any one contact, a Group Event appears in that contact's History exactly once through that contact's child Interaction.

**[DECIDED]** The Group Event parent:
- does not become a second History row,
- does not increment Heatmap counts,
- does not increment Intensity counts,
- does not independently affect Last Interaction,
- does not independently affect Status,
- does not independently affect Gravity.

**[DECIDED]** Group Event affiliation is contextual metadata on the child Interaction for Phase 11 consumers.

**[DECIDED]** A valid zero-participant Group Event creates no child Interaction and therefore does not appear in any contact's History or derived interaction consumers until a participant is added.

**[DERIVED]** Phase 11 aggregation/read paths must continue resolving contact activity from canonical child Interaction rows only; do not union Group Event parents into interaction-counting queries.

## Interaction Detail — Group Event context

**[DECIDED]** If an Interaction belongs to a Group Event, Interaction Detail exposes meaningful Group Event context without turning the child Interaction into a duplicate Group Event Detail screen.

**[DECIDED]** Use a restrained **Group event** badge/label where appropriate.

**[DECIDED]** Group-linked Interaction Detail may show:
- Group Event title,
- shared **Group Note**,
- the participant's ordinary Interaction note separately,
- `View Group Event`.

**[DECIDED]** Group Note and participant note remain distinct semantic/storage fields.

**[DECIDED]** Do not concatenate Group Note into the participant note for display/edit persistence.

**[DERIVED]** `View Group Event` routes to canonical Phase 12 Group Event Detail.

## Edit routing for group-linked Interactions

**[SUPERSEDED / EXTENDED]** Phase 11's generic `Edit → Edit Interaction` behavior is conditional when the Interaction belongs to a Group Event.

**[DECIDED]** Invoking Edit on a group-linked Interaction first asks which scope the user intends:

1. **Edit individual interaction**
2. **Edit Group Event**

**[DECIDED]** `Edit individual interaction` routes to the participant override editor and exposes only participant-overridable fields defined by Phase 12.

Initial participant-editable scope includes:
- Channel,
- Tone,
- Duration,
- Direction where relevant,
- Connected state where relevant,
- participant-specific note.

**[DECIDED]** Group Event title and shared event date/time do not appear as individual participant-editable fields.

**[DECIDED]** `Edit Group Event` routes to canonical Phase 12 Edit Group Event.

**[DECIDED]** Do not create a hybrid editor where field ownership/scope is implicit.

**[DERIVED]** Standalone Interactions continue using Phase 11's canonical focused Edit Interaction route unchanged.

## Shared Group Event date/time

**[DECIDED]** Group Event date/time is shared and non-overridable for linked participants.

**[DECIDED]** Editing Group Event date/time updates all linked child Interaction timestamps.

**[DERIVED]** After that atomic Phase 12 mutation commits, Phase 11 consumers refresh from canonical child Interaction data exactly as they do for ordinary timestamp edits:
- History placement,
- Heatmap buckets/counts,
- Intensity window data,
- Last Interaction,
- other downstream derived consumers.

**[DERIVED]** Phase 11 must not provide a participant-level timestamp editor for a group-linked child Interaction.

## Deleting a group-linked child Interaction

**[DECIDED]** Deleting a group-linked child Interaction retains Phase 11's existing irreversible hard-delete behavior and confirmation semantics.

**[DECIDED]** Deleting that child:
- permanently deletes only that participant's Interaction,
- removes that participant from the Group Event,
- does not delete or modify other participants' child Interactions,
- does not delete the Group Event parent,
- may leave the Group Event with zero participants.

**[DECIDED]** No Group-specific Interaction Trash/quarantine is introduced.

**[DERIVED]** Normal Phase 11 derived consumers refresh for the deleted contact because the canonical child Interaction no longer exists.

## Shared period/date detail sheet and History Browser

**[DECIDED]** Group-linked child Interactions remain ordinary Interaction rows in Phase 11's shared period/date detail sheet and History Browser.

**[DECIDED]** The Group Event parent does not appear beside them as an additional lifecycle/history row.

**[DERIVED]** Where space allows, a compact **Group event** marker/badge may identify the child's affiliation; deeper Group Event context belongs to Interaction Detail and `View Group Event`.

**[DECIDED]** Heatmap's small context card remains interaction-count-only and receives no separate Group Event count or parent-event metadata.

## Ordinary Interaction → Group Event conversion seam

**[DECIDED]** Ordinary standalone Interaction Detail overflow may expose:

`Add participants / Make this a group interaction`

**[DECIDED]** This routes into Phase 12's canonical conversion workflow.

**[DECIDED]** Conversion preserves the original Interaction identity/UID rather than deleting and recreating it.

**[DERIVED]** Phase 11 owns only the discoverable Interaction Detail entry seam; Phase 12 owns creation of the Group Event parent, participant addition, inherited/shared values, and resulting parent/child persistence.

## Supersession map

This amendment specifically extends or supersedes older generic Phase 11 wording as follows:

- **Interaction Detail:** group-linked children additionally expose restrained Group Event context, Group Note, and `View Group Event`.
- **Edit Interaction Route:** standalone interactions use the Phase 11 route unchanged; group-linked children require explicit individual-vs-group scope selection.
- **Interaction Delete:** hard-delete remains authoritative, but deleting a group-linked child removes only that participant and never cascades to other child Interactions or the Group Event.
- **Heatmap / Intensity / Last Interaction:** continue counting canonical child Interactions only; Group Event parents are never an additional activity record.
- **History Browser / shared detail sheet:** display the child Interaction once with optional Group Event affiliation metadata; do not add a second parent row.
- **Timestamp edits:** group-linked child timestamps are event-owned and change only through Edit Group Event.
- **Interaction Detail overflow:** standalone interactions may route into Phase 12 conversion through `Add participants / Make this a group interaction`.

All unrelated Phase 11 decisions remain authoritative.


---

# A. Product Role

**[DECIDED]** History & Insights is a dedicated temporal relationship-history experience rather than a conventional vertical activity feed.

**[DECIDED]** The phase replaces the current weak timeline presentation rather than polishing it incrementally.

**[DECIDED]** The History section's product goal is to let the user:
- see interaction patterns over time,
- browse specific dates,
- inspect all relevant historical records for a date/period,
- correct or backfill interaction history,
- understand Intensity over the same selected time window.

**[DECIDED]** A conventional always-visible chronological timeline is not required in the target design.

---

# B. History Section Structure

**[DECIDED]** History & Insights contains three primary child sections:

1. **Activity Heatmap**
2. **Intensity**
3. **History Browser**

**[DECIDED]** Heatmap and History Browser are complementary:
- Heatmap = interaction-pattern recognition and period exploration.
- History Browser = precise chronological/date navigation.

**[DECIDED]** Intensity is a separate analytical child section, but it uses the same selected History timeframe/window as the Heatmap.

**[DERIVED]** These child sections may inherit the Profile layout system's show/hide/collapse/reorder behavior where applicable, but Phase 11 owns their internal behavior.

---

# C. Shared History Time Window

**[DECIDED]** Heatmap and Intensity share one selected History lens/window.

**[DECIDED]** Changing the Heatmap lens or selected period updates Intensity to the same time window.

Examples:
- `Cycles · 10 periods` → Intensity renders those same 10 frequency periods.
- `7 Days` → Intensity renders those seven days.
- `August 2026` → Intensity renders August 2026.
- `Year 2026` → Intensity renders calendar year 2026.

**[DERIVED]** Represent selected History timeframe/window as shared state rather than independently baking time-range logic into Heatmap and Intensity.

**[DERIVED]** Keep the Intensity renderer decoupled enough that a future fixed-window presentation can replace shared-window behavior if device testing shows the linked model is visually poor.

---

# D. Heatmap Product Semantics

**[DECIDED]** The Profile heatmap is strictly an **interaction-activity visualization**.

**[DECIDED]** Heatmap color/intensity encodes interaction count only.

**[DECIDED]** Lifecycle events and other non-interaction historical records:
- do not affect heatmap saturation,
- do not appear in the heatmap's small context popup,
- may appear later in the shared period/date detail sheet.

**[DECIDED]** Multiple interactions inside the same bucket are counted separately.

**[DECIDED]** Interaction channel/type does not change heatmap color semantics.

**[DECIDED]** Deleted or re-dated interactions naturally change affected bucket counts because the heatmap resolves from canonical interaction data.

**[DERIVED]** Heatmap should aggregate from the same authoritative interaction read model used elsewhere rather than maintaining separate mutable visualization counts.

---

# E. Heatmap Lenses

**[DECIDED]** Initial Heatmap lenses:

- **Cycles**
- **7 Days**
- **Month**
- **Year**

**[DECIDED]** A compact segmented control or equivalent narrow-screen selector switches lenses.

**[DECIDED]** Last-used History lens persists globally rather than per contact.

---

# F. Frequency-Cycle Heatmap

**[DECIDED]** `Cycles` is the default and most Orbit-specific heatmap lens.

**[DECIDED]** Each block represents **one current Contact Frequency cycle**.

Example:
- Contact Frequency = 2 weeks
- 10 blocks = ten consecutive two-week periods.

**[DECIDED]** Historical cycle bucketing always uses the contact's **currently configured Contact Frequency**.

**[DECIDED]** Phase 11 does not reconstruct heatmaps using historical frequency settings.

**[DECIDED]** Default Cycle history count is **10**.

**[DECIDED]** Initial Cycle-count presets:
- 5
- 10
- 15
- 20

**[DECIDED]** These map naturally to visually coherent 5-column arrangements:
- 5 → 5×1
- 10 → 5×2
- 15 → 5×3
- 20 → 5×4

**[DECIDED]** Chosen Cycle-count preset persists globally.

**[DECIDED]** Newest/current period appears in the bottom-right; chronological reading proceeds left-to-right, top-to-bottom.

**[DECIDED]** Cycle navigation may:
- swipe/shift by one frequency period for smooth exploration,
- provide previous/next window controls that move a whole displayed page/window.

**[DERIVED]** Exact gesture mechanics may be tuned as long as one-cycle and whole-window navigation remain available.

---

# G. Current In-Progress Cycle

**[DECIDED]** The current incomplete frequency cycle uses the same interaction-count saturation semantics as completed cycles.

**[DECIDED]** Do not introduce a second hue such as blue solely to mean `current`.

**[DERIVED]** Distinguish the in-progress cycle with a non-measure visual cue such as:
- outline,
- corner marker,
- restrained theme-aware border treatment,
- accessible `Current cycle` label.

**[DERIVED]** Exact visual treatment is implementation/theme tuning.

---

# H. Rolling 7-Day View

**[DECIDED]** `7 Days` shows the rolling **last seven days**, not the current calendar week.

**[DECIDED]** Today is the final/rightmost/current cell.

**[DECIDED]** Navigation moves through earlier rolling seven-day windows.

**[DERIVED]** One-week paging is the initial preferred behavior.

---

# I. Calendar Month View

**[DECIDED]** `Month` shows one complete selected calendar month.

**[DECIDED]** Month grid preserves actual weekday alignment.

**[DECIDED]** Leading/trailing non-month weekday positions render as blank placeholders rather than collapsing the first/last row.

**[DECIDED]** Users may navigate previous/next month.

**[DERIVED]** Calendar geometry naturally varies by month length and starting weekday.

---

# J. Calendar Year View

**[DECIDED]** `Year` shows one complete selected calendar year in a GitHub-like dense daily grid.

**[DECIDED]** Cells represent individual days.

**[DECIDED]** Month labels/orientation should make yearly navigation understandable.

**[DECIDED]** Users may navigate previous/next year.

**[DERIVED]** Year-view geometry may use weeks as columns and weekdays as rows.

---

# K. Heatmap Saturation

**[DECIDED]** Saturation uses simple interaction-count thresholds.

**[DECIDED]** No additional severity/deterioration encoding is layered onto empty runs.

**[DECIDED]** Status remains the relationship-health interpretation; Heatmap remains factual activity.

**[DERIVED]** Fixed count thresholds may differ by bucket/lens where required for useful visual contrast.

Example direction:
- day-oriented bucket → 0 / 1 / 2 / 3+
- frequency-cycle bucket → 0 / 1 / 2 / 3 / 4+

Exact thresholds are implementation tuning.

---

# L. Heatmap Tap Interaction

**[DECIDED]** Tapping a Heatmap cell does **not** immediately open a large sheet.

**[DECIDED]** First tap opens a small anchored context card/popover.

For a period/date with interactions:
- date/date range,
- interaction count,
- `See details`.

Example:
- `Aug 4 – Aug 17`
- `3 interactions`
- `See details`

For an empty period/date:
- date/date range,
- `0 interactions`,
- `Log interaction`.

**[DECIDED]** Lifecycle events are not mentioned in this small Heatmap context card.

**[DECIDED]** `See details` opens the shared period/date detail sheet.

**[DECIDED]** `Log interaction` routes into detailed logging with the contact preselected and appropriate date context where unambiguous.

**[DERIVED]** For a single-day heatmap cell, detailed logging may be pre-dated to that day.

**[DERIVED]** For a multi-day frequency period, do not invent an arbitrary date; the detailed logging flow remains responsible for choosing the actual date.

---

# M. Reusable Heatmap Architecture

**[DECIDED]** Heatmap should be built as a reusable temporal interaction-activity primitive rather than a contact-ID-hardcoded Profile widget.

**[DERIVED]** Separate:
1. interaction source/query,
2. bucket/window generation,
3. aggregation,
4. presentation model,
5. heatmap renderer.

**[DERIVED]** Profile supplies a single-contact interaction query.

**[DERIVED]** Future analytics or Your Week may later supply broader query shapes such as:
- all interactions,
- interactions for a Category,
- other account-level filtered sets.

**[DERIVED]** Future group-level consumers need not support the contact-specific `Cycles` lens if no single Contact Frequency is meaningful.

**[DEFERRED]** Account-level analytics screens, Category analytics UI, Your Week heatmap integration, and group-frequency semantics.

---

# N. Intensity

**[DECIDED]** Intensity is a first-class History & Insights child section.

**[DECIDED]** It uses a larger bar/time-series presentation than the compact Profile Relationship Overview tile.

**[DECIDED]** Intensity uses the **same selected History timeframe/window** as the Heatmap.

**[DECIDED]** Intensity may show:
- trailing bars/time-series,
- current Intensity tier,
- cadence/reference context where useful.

**[DECIDED]** Intensity does not add prediction or trend forecasting in this milestone.

**[DERIVED]** Exact chart geometry, bin count, and tier display are implementation/design tuning.

---

# O. History Browser Product Model

**[DECIDED]** The conventional timeline is replaced by a specialized **Rolodex / wheel-style History Browser**.

**[DECIDED]** The History Browser uses **three synchronized columns**:
- Month
- Day
- Year

**[DECIDED]** Day is the primary scrolling axis.

**[DECIDED]** Scrolling Day naturally rolls Month/Year as date boundaries are crossed.

**[DECIDED]** Month and Year remain independently adjustable.

**[DECIDED]** Column synchronization is continuous.

**[DECIDED]** Invalid dates clamp conventionally.

Example:
- Aug 31 → switch month to February → Feb 28/29.

**[DECIDED]** Future dates are not browsable.

**[DECIDED]** Today is the maximum date.

---

# P. History Browser Theming

**[DECIDED]** The wheel interaction may receive meaningful Galaxy-specific theming.

**[DECIDED]** Galaxy may use restrained celestial/glow/depth treatment.

**[DECIDED]** Standard uses a cleaner, flatter, more conventional light/neutral roller treatment.

**[DECIDED]** Mechanical behavior remains the same across themes.

**[DECIDED]** The wheel should not become excessively dramatic or skeuomorphic.

**[DERIVED]** Use theme tokens and visual-system primitives rather than hardcoded separate implementations.

---

# Q. Visible Neighboring Dates

**[DECIDED]** Initial History Browser design may show approximately 2–3 neighboring date rows above and below the selected date.

**[DERIVED]** Exact visible-row count is easy device/design tuning and not a fixed product invariant.

**[DERIVED]** Adjacent rows may fade/scale subtly with distance from center, while the selected row remains strongest.

---

# R. Event Markers in History Browser

**[DECIDED]** Dates containing historical records are visibly marked even before they become the centered/selected date.

**[DECIDED]** Nearby eventful dates may show:
- dot for one record,
- dot + count for multiple records.

**[DECIDED]** History Browser markers represent **any History record**, not just interactions.

**[DECIDED]** Do not encode detailed channel/quality information in the marker.

**[DECIDED]** Lifecycle-only dates use a distinct marker treatment from interaction-bearing dates.

Working direction:
- interaction present → filled dot,
- lifecycle-only → outline/ring dot,
- both/multiple → filled marker + count as appropriate.

**[DERIVED]** Exact iconography may be simplified if device testing shows the distinction is too busy, but interaction-vs-lifecycle distinction is desirable.

**[DECIDED]** Accessibility labels expose actual record counts/types rather than requiring visual marker interpretation.

---

# S. History Browser Drawer

**[DECIDED]** The History Browser does not use a fourth Events column.

**[DECIDED]** A compact drawer/panel sits beneath the three wheels and summarizes the currently selected date.

For a date with history:
- date,
- basic interaction/event counts,
- `See details`.

For an empty date:
- date,
- `0 events logged` or equivalent,
- `Log interaction`.

**[DECIDED]** Lifecycle events are included in this drawer's total history summary.

**[DECIDED]** Selecting/scrolling to a date does not automatically open the full detail sheet.

**[DECIDED]** `See details` opens the same shared period/date detail sheet used by Heatmap drill-in.

**[DECIDED]** `Log interaction` routes to detailed logging pre-targeted and pre-dated to the selected day.

---

# T. Shared Period / Date Detail Sheet

**[DECIDED]** Heatmap and History Browser reuse one canonical detail sheet.

**[DECIDED]** The sheet lists all relevant historical records in the selected date/period.

**[DECIDED]** Interactions and lifecycle/history records are interleaved chronologically.

**[DECIDED]** Row type remains visually obvious through semantic icons/treatments rather than separate Interaction/Lifecycle sections.

**[DECIDED]** A compact interaction row may show:
- interaction type/channel,
- time,
- direction where relevant,
- quality/impact where present,
- duration where present,
- one-line note/context preview.

**[DECIDED]** Lifecycle/history rows show:
- event/change type,
- time/date,
- concise state/value change summary.

**[DECIDED]** Tapping an interaction row opens Interaction Detail.

**[DECIDED]** Tapping an editable history-bearing knowledge change may open its appropriate detail/edit flow.

**[DECIDED]** Lifecycle system events are inspectable but read-only.

**[DECIDED]** The sheet may expose `Log Interaction` as a convenient correction/backfill action without becoming a bulk-management surface.

**[DECIDED]** No multi-select/batch editing/deleting in Phase 11.

---

# U. Historical Record Families

**[DECIDED]** History Browser / detail surfaces may contain three semantic record families.

## 1. Interactions
User-authored interaction records.

Examples:
- call,
- text/message,
- in-person interaction,
- other current interaction channels/types.

Properties:
- editable,
- deletable,
- may include optional duration.

## 2. System lifecycle events
Immutable historical state transitions.

Initial examples:
- Archive,
- Restore,
- Snooze,
- Unsnooze,
- Bind,
- Unbind where present in the lifecycle model.

Properties:
- read-only,
- not user-editable,
- not deletable from History.

## 3. History-aware contact/knowledge changes
Historical values explicitly owned by the Contact Knowledge/history model.

Examples where available:
- Location changes,
- Job/employment changes,
- other first-class/history-retained knowledge fields.

Properties:
- may be editable according to their owning knowledge model,
- are not forced into the immutable lifecycle-event model.

**[DECIDED]** Do not turn History into a complete audit log.

**[DECIDED]** Only semantically meaningful history-bearing fields explicitly configured for history may appear.

**[DECIDED]** Contact Frequency changes are **not** shown in History in v1.

**[DECIDED]** Category changes are **not** shown in History in v1.

**[DEFERRED]** Broader configuration/audit history, History filtering/search, and optional display of low-frequency administrative changes.

---

# V. Interaction Detail

**[DECIDED]** Tapping an interaction opens a compact **Interaction Detail** sheet/surface.

**[DECIDED]** Interaction Detail shows complete meaningful interaction information without rendering blank fields.

Initial fields may include:
- interaction type/channel,
- date/time,
- direction,
- connected state where relevant,
- quality/impact,
- optional duration,
- note/context,
- other structured metadata already present in the canonical interaction model.

**[DECIDED]** Interaction Detail exposes:
- Edit,
- Delete.

**[DECIDED]** Detail browsing remains fast; editing moves to a focused route.

---

# W. Edit Interaction Route

**[DECIDED]** Phase 11 introduces a canonical **Edit Interaction** route.

**[DECIDED]** This route becomes the general correction surface for existing interaction records.

**[DECIDED]** It should support editing all currently editable interaction fields, including:
- date/time,
- channel/type,
- direction,
- connected state where relevant,
- quality/impact,
- note/context,
- optional duration.

**[DECIDED]** Future dates remain invalid.

**[DECIDED]** Saving an edit refreshes all derived/consuming surfaces automatically.

**[DERIVED]** Reuse the existing authoritative interaction-update domain function/writer rather than duplicating mutation logic in History.

**[DERIVED]** Phase 13 Rapid Capture & Update Flows may reuse this canonical route/component rather than inventing another interaction-correction workflow.

---

# X. Interaction Delete

**[DECIDED]** Interaction deletion remains the app's existing direct/hard-delete behavior.

**[DECIDED]** Phase 11 does not add a new interaction Trash/quarantine lifecycle.

**[DECIDED]** Delete requires explicit confirmation because it is irreversible.

Conceptual confirmation:
- `Delete this interaction?`
- `This can't be undone and may change this contact's Status, Gravity, and Intensity.`

Actions:
- Cancel
- Delete interaction

**[DECIDED]** No extra dedicated confirmation route is required.

**[DERIVED]** After deletion, canonical reads naturally recompute heatmap buckets, Intensity, Status, Gravity, and last-contact state as applicable.

---

# Y. Optional Interaction Duration

**[DECIDED]** Phase 11 adds optional **interaction duration**.

**[DECIDED]** Duration is optional for all interaction types.

**[DECIDED]** Duration is not required for calls, in-person interactions, texts, or any other channel.

**[DECIDED]** User-facing entry uses human units such as minutes/hours rather than raw seconds.

**[DECIDED]** Duration input supports:
- no duration,
- useful quick presets,
- custom hours/minutes.

Working preset direction:
- 5m
- 15m
- 30m
- 1h
- 2h
- Custom

**[DECIDED]** Quick Log never asks for or sets duration.

**[DECIDED]** Detailed Log/Edit may set duration.

**[DECIDED]** History/detail rows show compact duration text only when present.

Examples:
- `24m`
- `2h 15m`

**[DECIDED]** Duration is descriptive/analytical data only in this milestone.

**[DECIDED]** Duration does not alter Status, Gravity, or Intensity calculations in Phase 11.

**[DERIVED]** Persist duration in a canonical machine-friendly unit such as nullable seconds while presenting minutes/hours to users.

**[DERIVED]** Migration/update work must extend interaction persistence, reads, backup/restore, and detail/edit flows while preserving old rows with null duration.

---

# Z. Logging / Backfill from History

**[DECIDED]** Empty historical dates/periods provide a low-friction `Log interaction` path.

**[DECIDED]** History does not create a separate logging implementation.

**[DECIDED]** It routes into the canonical detailed logging workflow with:
- contact preselected,
- selected date prefilled when the History context is one exact day.

**[DECIDED]** Quick Log is not used for historical backfill because Quick Log semantically means `now`.

**[DERIVED]** Phase 13 owns the final ordinary detailed logging form/business UX; Phase 11 only establishes History's route/context contract.

---

# AA. Accessibility

**[DECIDED]** Heatmap activity cannot rely solely on color.

**[DERIVED]** Cells expose accessible date/range and interaction count.

**[DECIDED]** The current cycle exposes textual `Current cycle` semantics.

**[DECIDED]** Wheel columns expose selected Month/Day/Year and support non-gesture adjustment.

**[DECIDED]** Event markers expose history counts/types accessibly.

**[DECIDED]** History Browser drawer provides a conventional non-wheel action path to details/logging.

**[DECIDED]** Detail rows expose semantic type, date/time, and relevant metadata without requiring icon interpretation.

**[DERIVED]** Reduced Motion should simplify wheel depth/inertia and decorative transitions without removing date navigation.

---

# AB. Derived Architecture

**[DERIVED]** Build a reusable History read/aggregation layer rather than embedding queries directly in Heatmap, Intensity, and History Browser components.

**[DERIVED]** Useful conceptual layers:
1. canonical interaction/history read model,
2. date/window utilities,
3. interaction bucket generator,
4. aggregation layer,
5. shared History view/window state,
6. Heatmap presentation model,
7. Intensity presentation model,
8. date/period record resolver,
9. reusable detail-sheet model.

**[DERIVED]** Heatmap and Intensity should consume canonical selected-window state.

**[DERIVED]** History Browser should consume date-indexed history summaries/markers without loading full record details for every visible date.

**[DERIVED]** Full records may resolve lazily when the user opens a selected date/period detail sheet.

**[DERIVED]** Exact wheel implementation may use existing Reanimated/Gesture Handler primitives or a suitable compatible picker abstraction; do not add a heavy dependency unless implementation evidence justifies it.

---

# AC. Cross-Phase Constraints

- **Profile Experience:** owns History section placement/show-hide/collapse/template state; Phase 11 owns History internals.
- **Contact Knowledge Foundation:** authoritative for history-aware fields and editable historical values; do not force editable knowledge history into immutable lifecycle events.
- **App Shell & Navigation:** Edit Interaction is a focused route and follows canonical Back/unsaved-change behavior.
- **Theme & Visual System:** Heatmap, wheels, drawer, sheets, markers, and charts resolve through Galaxy/Standard semantic tokens.
- **Dashboard/Orrery:** Status and Gravity remain semantically consistent; Phase 11 does not redefine their algorithms.
- **Rapid Capture & Update Flows:** owns final detailed Log Contact form; Phase 11 routes to it for backfill and may expose reusable duration/edit components.
- **Backup/Restore:** must preserve optional interaction duration and any existing canonical history-bearing data.
- **Responsive & Release Hardening:** owns final wheel density, visible-neighbor tuning, yearly heatmap performance, large-text behavior, and device-specific gesture QA.
- **Future Analytics / Your Week:** may reuse Heatmap aggregation/rendering with different query sources; those products are not Phase 11 scope.

---

# Explicitly Deferred

- conventional vertical timeline as a first-class target view
- account-level analytics dashboard
- Category/group analytics UI
- Your Week heatmap integration
- group-level frequency-cycle semantics
- historical Contact Frequency-aware cycle reconstruction
- historical Gravity chart
- duration-based Gravity/Status/Intensity weighting
- Intensity prediction/forecasting
- Heatmap channel encoding
- missed-cycle severity encoding
- History search/filtering
- broad audit-log events
- Contact Frequency changes in History
- Category changes in History
- batch interaction editing/deleting
- interaction trash/quarantine
- future-date history browsing
- exact Heatmap saturation thresholds
- exact wheel visible-neighbor count
- exact Galaxy wheel artwork
- exact animation/inertia values
- final Intensity chart geometry
- final event-marker artwork

---

# Phase Success Criteria

1. History & Insights replaces the current weak chronological timeline with Activity Heatmap, Intensity, and a specialized History Browser.
2. Heatmap clearly visualizes interaction activity only and supports Cycles, rolling 7 Days, Month, and Year lenses.
3. Frequency Cycles use the contact's current Contact Frequency, default to 10 periods, and support 5/10/15/20 presets.
4. Heatmap and Intensity share one selected History window so both visualize the same period through different representations.
5. Current incomplete cycle is distinguishable without introducing a second activity hue.
6. Heatmap taps first open a small low-friction context card; `See details` opens the shared detail sheet and empty periods offer appropriate historical Log Interaction routing.
7. Heatmap aggregation/rendering is reusable with alternative future interaction query sources without implementing future analytics now.
8. History Browser provides synchronized Month/Day/Year wheels, date markers, no future dates, and smooth date-boundary behavior.
9. Galaxy and Standard may theme the History Browser differently while preserving identical mechanics and accessibility.
10. Eventful neighboring dates are visible before selection; interaction-bearing and lifecycle-only dates may use distinct history markers.
11. The History Browser's drawer summarizes the selected date and exposes See Details or Log Interaction without auto-opening large sheets during scrolling.
12. Heatmap and History Browser reuse one canonical period/date detail sheet.
13. The detail sheet chronologically interleaves interactions, immutable lifecycle events, and appropriate history-bearing contact changes while preserving their different editability rules.
14. Interaction Detail provides compact complete inspection, and Phase 11 introduces a canonical Edit Interaction route.
15. Interaction edits support date/time and existing structured fields, reject future dates, and refresh derived consumers automatically.
16. Interaction deletion remains hard-delete with explicit irreversible confirmation and no new trash subsystem.
17. Optional interaction duration is added, entered in minutes/hours, stored canonically, displayed only when present, omitted from Quick Log, and excluded from derived-metric calculations for now.
18. Empty historical dates provide a pre-targeted/backdated route into detailed logging rather than misusing Quick Log.
19. History remains accessible without relying solely on color, wheel gestures, or marker iconography.
20. Phase 11 does not expand into general account analytics, broad audit history, or final Rapid Capture form ownership.

---

# Notes for GSD / Roadmapper

- Treat this as one coherent History/Insights phase attached to the Profile Experience.
- Do not split Heatmap and History Browser into separate phases; they share date/window utilities, history reads, detail-sheet infrastructure, and interaction-detail routes.
- Do not restore a conventional vertical timeline merely because one exists in the current app.
- Keep Profile Heatmap interaction-only. Lifecycle/history events belong to History Browser/detail sheets, not Heatmap saturation or Heatmap context counts.
- Preserve the three record families: editable Interactions, immutable lifecycle events, and independently history-aware knowledge changes.
- Do not mutate the immutable lifecycle-event model merely to make location/job history editable.
- Add a canonical Edit Interaction route here; Phase 13 can reuse it.
- Optional duration is a small domain expansion owned here because History/Interaction Detail is already being upgraded.
- Keep Heatmap/Intensity timeframe shared unless device testing demonstrates a genuine usability problem.
- Build temporal aggregation/rendering for reuse, but do not roadmap the future analytics products themselves.
- Exact chart thresholds, wheel row count, styling, inertia, and micro-layout are implementation/device-tuning details.
