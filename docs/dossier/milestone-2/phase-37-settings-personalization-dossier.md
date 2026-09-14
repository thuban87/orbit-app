# Dossier --- Settings & Personalization

**Status:** complete · Interrogated through 2026-09-14 · Phase 37
product contract settled against the current Milestone 2 roadmap and
repository snapshot.

## Decision Legend

-   **\[DECIDED\]** explicitly chosen by the owner.
-   **\[DERIVED\]** implementation/architecture consequence.
-   **\[DEFERRED\]** intentionally postponed.

## Scope

Phase 37 is primarily an **organization and consolidation phase**, not a
new-feature phase. It restructures Orbit's existing Settings experience
around user concepts, consolidates seams exported by Phases 22--36,
exposes appropriate user-configurable preferences centrally, and
establishes Settings as the long-term canonical home for Data & Backup.

It intentionally does **not** invent substantial new feature-domain
functionality, duplicate canonical managers, expose every persisted
last-used UI state, add Settings search/global reset, create
General/Advanced dumping-ground categories, ship dead release/legal
placeholders, or absorb onboarding/release-hardening work.

# A. Product Role & Root IA

**\[DECIDED\]** Settings becomes a **navigation-first directory**, not a
long scrolling control surface or hybrid dashboard.

**\[DECIDED\]** Every setting belongs in its proper conceptual home.
Information architecture is organized around **user concepts first**,
not database/services/phase boundaries.

**\[DECIDED\]** Ordinary hierarchy:
`Settings → Category → canonical manager/subsurface` where needed.
Existing managers are reused, not reimplemented.

**\[DECIDED\]** Top-level order: 1. Appearance 2. Contacts &
Relationships 3. Interactions 4. Notifications 5. Orrery 6. Data &
Backup 7. AI 8. About Orbit

Utility/action rows such as Home Screen Widget sit near the bottom after
the main hierarchy.

**\[DECIDED\]** Root rows use icon + concise title + short descriptive
subtitle + navigation affordance. The root does **not** show
live/current setting values.

**\[DECIDED\]** No Settings search, global reset, generic General
category, global Administration category, or Advanced category in Phase
37.

# B. Category Organization & Interaction Model

**\[DECIDED\]** Category pages use meaningful internal sections where
warranted; they are not flat dumping grounds. Do not manufacture
sections solely for symmetry.

**\[DECIDED\]** Low-frequency controls stay in their conceptual category
and may be ordered lower without an `Advanced` label.

**\[DECIDED\]** Settings uses Orbit's existing list/card visual language
in Standard/Galaxy: section headings, icons, chevrons, switches, and
normal controls. It should feel straightforward/native-like rather than
like a showcase screen.

**\[DECIDED\]** Atomic preferences apply immediately wherever practical.
Multi-field or temporarily-invalid flows may use explicit Save/Connect
semantics when their owning feature requires them.

**\[DECIDED\]** Small 2--4 option sets generally use inline
segmented/chip/radio-style selection; larger/explanatory choices use a
picker, sheet, or dedicated screen.

# C. Preference vs Persisted UI State

**\[DECIDED\]** Settings exposes **user-configurable preferences**, not
every value persisted in `app_settings`.

**\[DERIVED\]** Planning should distinguish: - **user-configurable
preference** --- a deliberate behavioral/presentation choice reasonably
expected to be centrally configurable; - **persisted UI state** ---
remembered state restoring where/how a feature was last used.

Both may persist technically. Persistence alone does not make something
a Setting.

Examples that belong: Dashboard right-swipe behavior, default
interaction channel, Orrery density/satellites, appearance preferences.

Examples that do not: Dashboard last view/filter/sort/population,
History last lens/cycle count, Orrery last active System.

# D. Appearance

**\[DECIDED\]** Appearance owns global visual behavior. Likely sections:
**Theme**, **Orbit Appearance**, and Display only if the real inventory
warrants it.

**\[DECIDED\]** Consume the theme package/mode/accent/background model
actually shipped by execution time.

**\[DECIDED\]** Galaxy-specific controls should preferably appear/be
selectable only while Galaxy is active.

**\[PLANNING NOTE\]** Prior implementation reportedly found this more
involved than expected. Inspect the current theme architecture before
choosing the mechanism; satisfy conditional relevance without turning
Phase 37 into a theme rewrite.

**\[DECIDED\]** Center/focal-person configuration belongs under
Appearance and should be framed as **Orbit Center**, not `Your Orbit`.

**\[DECIDED\]** Orbit Center opens a searchable contact picker with
**You** as a special option, reusing an appropriate existing picker
where possible.

**\[DECIDED\]** Sun color is independent of who is center and remains
configurable for every center choice.

# E. Contacts & Relationships

**\[DECIDED\]** Expected organization:

## Contact Sources

-   device Contacts permission/status,
-   import,
-   linked-contact reconciliation,
-   phone-region behavior/override, ordered lower if appropriate.

## Unbound Contacts

Contact-model behavior genuinely concerning Unbound contacts as a class.
Feature-specific Unbound behaviors remain with the affected feature (for
example birthday reminder behavior under Notifications).

## Relationship Structure

-   Categories,
-   Custom Fields.

Categories and Custom Fields remain Settings destinations even if easier
secondary entry points are added later.

## Contact Management

-   Archived Contacts,
-   other real canonical contact-management destinations.

**\[DECIDED\]** Import/reconciliation are actions/tools, but natural
section placement is enough; no generic Tools taxonomy is needed.

# F. Interactions

**\[DECIDED\]** Interactions owns global configuration for interaction
assistance/defaults. Current residents include Interaction Assist and
Default Interaction Channel.

**\[DECIDED\]** Preserve the existing ordinary-channel contract
(Remember Last Choice / Message / Call / In Person; Group Log exempt per
its owning contract).

**\[DECIDED\]** Do not invent additional interaction defaults without a
concrete workflow need. The page may remain consolidated under one
heading for now.

# G. Notifications & Permissions

**\[DECIDED\]** Notifications remains its own top-level category and
should organize controls by user-facing notification type/behavior
rather than implementation services. Likely groupings include
relationship reminders, birthdays, and system notification
behavior/access as warranted by the implemented inventory.

**\[DECIDED\]** Unbound birthday-reminder behavior belongs here.

**\[DECIDED\]** OS permission state appears where the user conceptually
encounters it: Contacts permission under Contacts & Relationships;
notification permission under Notifications. No global Permissions
category.

**\[DECIDED\]** When Orbit cannot change a denied permission itself,
provide an actionable **Open system settings** handoff where supported.

**\[DECIDED\]** Permission-dependent capabilities should not
misleadingly look operational when blocked. Generally keep unavailable
capabilities visible with contextual explanation rather than hiding
them.

**\[DERIVED\]** This does not require irrelevant subordinate controls to
stay visible; Galaxy-only controls may be conditional on Galaxy
selection.

# H. Orrery

**\[DECIDED\]** Settings → Orrery centrally exposes all appropriate
stateless/user-configurable Orrery preferences even when duplicated on
the Orrery itself.

**\[DECIDED\]** Remembered/session state such as last active System does
not become a Setting.

Expected sections:

## Display

Density, satellites, and other implemented stateless visualization
preferences.

## Systems

Route to canonical Systems Management and any genuinely global System
configuration that exists.

**\[DECIDED\]** Systems Management remains directly accessible from
Orrery as well.

**\[DECIDED\]** Duplicate access binds to the **same underlying
preference source**. Changes from either surface immediately agree; no
duplicate preference models.

# I. Data & Backup

**\[DECIDED\]** Category name: **Data & Backup**.

**\[DECIDED\]** Settings becomes the **long-term canonical home** of
Backup/Restore beginning in Phase 37. The existing Backup bottom tab may
remain temporarily as an alternate entry point.

**\[DECIDED\]** Prefer one canonical Data & Backup screen/component tree
with multiple navigation entry points rather than separately maintained
copies. This intentionally prepares for later removal of the Backup tab.

**\[DECIDED\]** Do not invent new backup functionality merely because
ownership is moving.

**\[PLANNING NOTE\]** Phase 36 is in flight and owns the milestone's
final backup wire-format bump. Phase 37 must consume what Phase 36
actually ships and must not duplicate/reopen that schema/format work.

# J. AI

**\[DECIDED\]** AI remains a top-level category after Data & Backup and
routes into/reuses the canonical Phase 36 AI management hierarchy,
including the AI-Off credential-management escape hatch.

**\[PLANNING NOTE\]** Phase 36 is in flight as of interrogation. Revisit
exact AI integration against the implemented Phase 36 result at planning
time; Phase 37 adapts to Phase 36 rather than freezing pre-completion
assumptions.

# K. About Orbit

**\[DECIDED\]** Ship a basic About surface containing what genuinely
exists: app name/icon, semantic version/build number, dependency
licenses/acknowledgements, support/feedback if a real destination
exists, and Privacy Policy/Terms only when real destinations exist.

**\[DECIDED\]** Omit unavailable release/legal rows rather than shipping
dead placeholders. Phase 40 may add final release destinations later.

# L. Home Screen Widget

**\[DECIDED\]** Keep Home Screen Widget access in Settings as a
utility/action row near the bottom, after the primary category/About
hierarchy. It does not need a dedicated category.

# M. Navigation & Addressability

**\[DECIDED\]** Categories and important managers receive stable
**internal navigation routes** so other Orbit surfaces can address
Settings → Notifications, AI, Data & Backup, Orrery, etc. This does not
require external URL deep-link contracts.

**\[DERIVED\]** Preserve Phase 22 shell/back-stack behavior.

# N. Administrative & Destructive Actions

**\[DECIDED\]** Administrative managers remain with their conceptual
feature rather than being collected into Administration.

**\[DECIDED\]** Phase 37 does not establish a special global
destructive-settings model. Navigation to a manager is harmless;
destructive actions use canonical confirmation at the point of action.

# O. Accessibility Baseline

**\[DECIDED\]** The rebuilt Settings surfaces explicitly require: -
proper accessibility labels, - semantic roles/states, - sensible touch
targets, - screen-reader-readable section/navigation structure, -
legibility in Standard and Galaxy, - no Galaxy treatment that
compromises basic readability.

This is Phase 37 implementation quality, not a replacement for Phase
40's broader accessibility/responsive audit.

# P. Scope Lock

**\[DECIDED\]** Phase 37 is primarily organization with comparatively
minimal new functionality.

It may: - restructure Settings, - relocate/reuse existing controls and
managers, - establish categorized canonical navigation, - expose
already-established user-configurable preferences centrally, -
centralize Data & Backup ownership, - add About basics, - improve
permission visibility/handoffs, - add only the small shared
UI/navigation infrastructure required for this organization.

It may **not** expand itself into substantive new Dashboard,
Interaction, Notification, Orrery, AI, Contacts, or Backup feature work
merely because those domains now have a Settings category.

# Q. Planning / GSD Guardrails

**\[DERIVED\]** Phase 37 should own no schema by default. The
deferred-phase audit explicitly established that owning feature phases
create their `app_settings` storage; Phase 37 builds controls over
shipped state. A newly required migration is a signal to check whether
an owning feature phase missed something before adding schema here.

**\[DERIVED\]** Plans should be sliced by coherent Settings
architecture/feature integration rather than by creating one plan per
individual toggle. Avoid phase bloat.

**\[DERIVED\]** Reuse canonical managers and shared preference sources;
do not fork behavior for Settings-only copies.

**\[DERIVED\]** Before planning, audit the repository as it exists after
Phase 36 (and Phase 35 if still incomplete) rather than trusting old
stub inventories. Retired settings must stay retired.

# R. Explicit Deferrals

**\[DEFERRED\]** Settings search.

**\[DEFERRED\]** Global Reset Settings.

**\[DEFERRED\]** A generic General category unless future real inventory
justifies one.

**\[DEFERRED\]** A generic Advanced category/labeling system.

**\[DEFERRED\]** Final removal of the Backup bottom tab; Phase 37
prepares for it but need not perform it.

**\[DEFERRED\]** Final release/legal destinations that do not exist yet.

**\[DEFERRED\]** External URL deep-link design.

**\[DEFERRED\]** Additional interaction/default settings without
demonstrated product need.

# S. Planning-Time Verification Checklist

Before GSD decomposes Phase 37, verify against the post-Phase-36
repository:

1.  Inventory every currently rendered Settings row and destination.
2.  Inventory every `app_settings` field but classify each as preference
    vs persisted UI state before exposing it.
3.  Confirm the implemented Phase 36 AI hierarchy and route Phase 37
    into it.
4.  Confirm the final Phase 36 backup format/state and avoid schema
    ownership here.
5.  Confirm theme architecture and estimate the smallest safe
    implementation for conditional Galaxy controls.
6.  Confirm canonical managers for Categories, Custom Fields, Archived
    Contacts, Systems, and profile customization destinations.
7.  Confirm shared preference sources for Orrery controls duplicated
    between Settings and Orrery.
8.  Confirm Contacts/Notifications permission APIs and system-settings
    handoff behavior on the pinned Expo/React Native stack.
9.  Confirm Data & Backup can be represented by one canonical
    screen/component tree reached from both Settings and the temporary
    tab.
10. Remove/reconcile any stale Settings rows whose owning features
    retired them before planning.

------------------------------------------------------------------------

## Dossier Summary

Phase 37 turns Settings from an accumulated feature surface into Orbit's
coherent configuration directory. The root stays clean; categories are
user-concept-first and internally sectioned; real preferences are
distinguished from remembered UI state; canonical managers and shared
preference sources are reused; Data & Backup begins its migration into
Settings ownership; AI is integrated only after consuming Phase 36's
actual result; and the phase is explicitly prevented from becoming a
catch-all feature-development milestone.
