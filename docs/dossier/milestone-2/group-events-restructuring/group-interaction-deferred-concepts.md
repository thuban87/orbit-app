# Orbit — Deferred Group Interaction & Social-Event Concepts

**Status:** brainstorming capture · explicitly outside current Phase 12 / Milestone 2 scope unless later promoted.

## Purpose
This document captures future ideas surfaced while interrogating Phase 12 — Group Interaction Logging.

These ideas are intentionally separated from the Phase 12 dossier so current milestone execution remains focused.

Nothing here should silently become a Milestone 2 requirement.

## 1. Mission Control / True Dashboard
The current Dashboard is functionally closer to an advanced contact browser/address book than a true multi-feature dashboard.

A later **Mission Control** surface could include birthdays this week, contacts approaching status changes, recent Group Events, upcoming social commitments, Your Week content, and other relationship intelligence.

The current contact browser could later be renamed to something more accurate / astronomical, such as Catalogue, Address Book, or another name. No name is decided.

## 2. Future Bottom-Navigation Restructure
A later shell redesign might reconsider permanent destinations around concepts such as Mission Control, Contacts/Catalogue, Orrery, Group Events, Data/Backup, and Settings.

Exact structure is unresolved.

## 3. Dashboard Tab as Launcher / Radial Menu
Brainstormed concept: the Dashboard nav item might someday open a radial/menu launcher containing Dashboard/Mission Control, Contacts/Catalogue, Group Events, and possibly other related areas.

This was explicitly **not** selected for Milestone 2 because it would special-case bottom-navigation behavior and prematurely redesign the shell.

## 4. Dedicated Group Events Bottom-Nav Destination
Group Events may eventually become important enough to justify a permanent bottom-nav slot.

For Milestone 2 it instead uses a prominent Dashboard header entry plus Dashboard overflow.

## 5. Google Calendar Integration
Possible future capabilities:
- connect Google Calendar,
- browse past calendar events,
- import a past calendar event as an Orbit Group Event,
- prefill title/date/time/location,
- associate Orbit contacts with attendees,
- selectively import rather than auto-convert.

## 6. Future Planned Events / Social Calendar
Phase 12 Group Events represent completed/logged encounters only.

A future system might add future Group Events, an in-app social calendar, upcoming event reminders, contact association before the event, and post-event conversion into completed Group Events.

## 7. Calendar ↔ Group Event Lifecycle
Possible mature model:
```text
Calendar Event
    ↓
Planned Orbit Social Event
    ↓ event occurs
Completed Group Event
    ↓
Canonical child Interactions
```

Do not assume this in the current schema unless a later milestone explicitly adopts it.

## 8. Group Event Analytics
Possible future views:
- social events per week/month,
- individual vs group social time,
- event frequency by category,
- recurring social circles,
- social breadth vs depth,
- frequently co-present contacts,
- event duration trends,
- event-level Tone trends,
- social activity heatmaps.

## 9. Strategic Second Audience
Potential product direction: Orbit may serve both users who need help organizing/maintaining their social lives and highly social users who want structured tracking/analytics.

Group Events may become a major hook for the second audience because a small number of real-world events can generate many meaningful contact interactions with dramatically lower logging friction.

## 10. Event Host / Participant Roles
Phase 12 deliberately does not model a host/owner.

Possible future roles: Host, Co-host, Attendee, Organizer, Remote participant, or other event-specific roles.

## 11. Richer Group Event Management
Future enhancements could include date/Channel/Tone/Category/participant filters, saved views, calendar visualization, richer search, and possibly event pin/favorite/archive states if real need emerges.

## 12. Event Media / Attachments
Possible future additions: photos, screenshots, venue links, files, event cover image, or shared media/memories.

## 13. Event Location / Venue
A future Group Event model might gain freeform location, structured venue, map/place integration, repeated venue suggestions, or calendar-derived location.

## 14. Event Recurrence / Series
Possible later concept for recurring board-game night, weekly climbing meetup, monthly family dinner, recurring work event, etc.

A future `Event Series` concept could group completed Group Events without changing child Interaction history.

## 15. Event Templates / Fast Reuse
Possible later workflow: repeat last event, reuse participant set, reusable named social circle, prefill common Channel/duration/location.

## 16. Group Event AI Features
Possible future AI capabilities: summarize a Group Event, suggest participant-specific memories, extract follow-ups, generate reminders, summarize recurring social patterns.

Any future AI feature must preserve Orbit's explicit privacy/permission posture.

## 17. Group Event Cross-Contact Context
Future Contact Profile presentation might expose richer group-event relationships such as `Seen together at 5 events`, recurring gatherings, or frequently co-present Orbit contacts.

This approaches social-graph analytics and should remain separate from current child Interaction presentation.

## 18. Group Event Sharing / Multi-User Features
Far-future possibilities include shared event records between Orbit users, collaboratively edited attendee lists, shared notes, or invitations.

These require identity/sync/collaboration architecture well beyond Milestone 2.

## 19. Navigation/Product Naming Exploration
Future naming questions:
- Is `Dashboard` still correct for the current contact browser?
- Should `Mission Control` become the actual Dashboard?
- Should the contact browser become `Catalogue`, `Contacts`, or another celestial term?
- Is `Group Events` the final feature name?
- Does Group Log need more Orbit-specific terminology later?

No naming change is required now.

## 20. Promotion Rule
Promote a deferred concept only when a later milestone explicitly targets it, user testing demonstrates a concrete need, or preserving a cheap seam now is necessary to avoid disproportionate future cost.

Until then, keep Phase 12 focused on completed real-world Group Event logging and canonical child Interactions.
