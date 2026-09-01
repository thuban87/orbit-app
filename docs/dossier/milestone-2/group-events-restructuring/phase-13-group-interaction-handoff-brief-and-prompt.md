# Phase 13 — Rapid Capture & Update Flows
## Group Interaction Logging Update Brief + Paste-Ready Session Prompt

## Why this brief exists
The working roadmap changed after Phase 11. A new **Phase 12 — Group Interaction Logging** has been inserted, and the old Phase 12 Rapid Capture & Update Flows is now provisionally **Phase 13**.

The Group Interaction subsystem is now decision-complete. Phase 13 must consume its settled contract rather than inventing overlapping multi-contact logging behavior.

## Incoming authoritative contracts from Phase 12

### Group Log is a separate canonical workflow
Phase 12 owns Group Event persistence/domain model, zero-participant event-first capture, participant management, shared/default inheritance, participant overrides, Group Note + participant note semantics, Group Event Detail/Edit, Group Event browse/management, add/remove/detach/delete semantics, Interaction → Group Event conversion, atomic multi-child persistence, and backup/restore.

Phase 13 may **route into** Group Log where appropriate but must not redefine those semantics.

### Canonical terminology is Tone
Use **Tone**, not Quality/Impact.

New ordinary interactions and new Group Events begin with `Tone = null`.

### Ordinary logging Channel default setting
Concurrent Phase 13 planning has established an ordinary logging Channel preference with four choices:
- Message
- Call
- In Person
- Remember last choice

Factory default: **Remember last choice**.

This applies to **ordinary single-contact logging**.

### Group Log is exempt from the Channel preference
Phase 12 explicitly decided:
- Group Log defaults to **In Person**,
- user may change it,
- Group Log does **not** inherit the ordinary single-contact Channel-default preference.

This exception should later be exported to Settings/Personalization.

### Event-first Group Log
A Group Event requires title + date/time. Participants are optional. Zero-participant saved Group Events are valid. Do not redesign Group Log to require participant selection first.

### Dashboard/FAB routing
- universal FAB has distinct **Group Log** action,
- Dashboard Grid 1 selected → ordinary detailed Log Interaction,
- Dashboard Grid 2+ selected → Group Log,
- Quick Log remains a separate immediate action.

## What Phase 13 should still interrogate
Continue focusing on ordinary Rapid Capture & Update Flows:
- Add Contact form structure/progressive disclosure,
- ordinary single-contact Quick Log integration,
- ordinary single-contact detailed Log Interaction form,
- Channel preference behavior,
- Tone field UX,
- duration UX inherited from Phase 11,
- historical/backdated individual logging,
- Update Contact taxonomy,
- full Edit Contact vs Update Contact boundary,
- remembered-information additions,
- validation/error/save/cancel/keyboard behavior,
- shared picker/preselection,
- deep-link/widget-ready ordinary routes,
- accessibility and focused-workflow ergonomics.

Do **not** reopen Group Event field ownership, participant override semantics, Group Event lifecycle, Group Event Detail/Edit, Group Event browse/management, or Group Event backup model.

## Paste-ready prompt for the Phase 13 session

We need to update this Phase 13 Rapid Capture & Update Flows planning session with a newer authoritative dependency.

A new Phase 12 — Group Interaction Logging has now been fully interrogated and is decision-complete. Rapid Capture is therefore provisionally Phase 13.

Please incorporate these contracts before continuing:

1. Group Log is a separate canonical workflow owned by Phase 12. Phase 13 may route into it but must not redefine Group Event domain, shared/default inheritance, participant overrides, participant add/remove/detach/delete behavior, Group Event Detail/Edit, Group Event browsing, atomicity, or backup semantics.

2. Canonical interaction field terminology is now **Tone**, not Quality/Impact.

3. New ordinary interactions and new Group Events start with **Tone = null**.

4. The ordinary single-contact logging Channel setting has four choices: Message, Call, In Person, Remember last choice. Factory default is **Remember last choice**.

5. **Group Log is explicitly exempt from that global Channel setting** and defaults to **In Person**. This exception needs to be exported later to Settings/Personalization.

6. Group Log is event-first: title + date/time required; participants optional; zero-participant saved Group Events are valid; participant selection is not required before opening the form.

7. Universal FAB now has a distinct Group Log action.

8. Dashboard Grid detailed logging routes 1 selected → ordinary detailed Log Interaction; 2+ selected → canonical Group Log. Quick Log remains separate.

Please continue interrogating only the ordinary Phase 13 scope: Add Contact, ordinary Quick Log integration, ordinary detailed Log Interaction, Update Contact, form ergonomics, Channel/Tone/duration UX, backdating, validation/save/cancel, shared picker/preselection, deep-link/widget routing, and accessibility.

When we finish Phase 13, make sure its dossier explicitly exports the Group Log Channel-setting exemption to the later Settings phase and does not duplicate Phase 12's subsystem.
