# Phase KB Manifest: 31

**Phase:** 31-profile-experience
**Processed:** 2026-09-14
**Decision-source tier:** dossier — `phase-10-profile-experience-dossier.md`, overlaid by the Phase 31 corpus
**Source docs consumed:** 48 files (712 KB): mapped dossier; `31-01`–`31-15` PLAN/SUMMARY pairs; CONTEXT, RESEARCH, PATTERNS, COVERAGE (both), VALIDATION, VERIFICATION, REVIEW, REVIEWS, REVIEW-FIX, SECURITY, UAT, UI-SPEC, NATIVE-CHECKLIST, OWNER-SMOKE, BACKGROUND-ART-REVIEW, and `deferred-items.md`

## ADRs Produced

| ADR | Title | Source Decisions |
|-----|-------|-----------------|
| ADR-108 | Durable Independent-Axis Profile Presentation and Inheritance | Dossier §§D–I/AL/AO; D-03/07/09/10 |
| ADR-109 | Fixed-Hero Semantic Profile Composition and Focused Accessible Editors | Dossier §§A–C/E/G/J–N/U–AN; D-04/08/11/12 |
| ADR-110 | Coherent Local Profile Snapshot and Source-Owned Knowledge Projection | Dossier §§A/V–AI/AO; D-08/11/12 |
| ADR-111 | Cadence-Guarded Profile Metrics and Composed Relationship Actions | Dossier §§O–T; D-05/06 |
| ADR-112 | App-Owned Profile Background Derivatives and Launch Reconciliation | Dossier §§D/AL/AM; D-09/10 |

## System Docs Updated

| System Docs | What Changed |
|-------------|--------------|
| `profile.md`, `persistence-core.md`, `backup-restore.md` | Added the durable presentation graph, migration 024, resolution/reset rules, ADR links, and format-4 boundary. |
| `app-shell.md`, `contacts.md`, `widget.md`, `ai-suggestions.md` | Added focused overlays, origin/consume-once routing, inheritance fallout, and Compose-only AI entry. |
| `contact-knowledge.md`, `contact-methods.md`, `custom-fields.md`, `conversational-fuel.md` | Added coherent source-owned Profile projections and explicit Off Limits/method/type boundaries. |
| `status-engine.md`, `interaction-log.md`, `notifications.md`, `photos.md` | Added cadence guards, bounded history, composed actions, and local background lifecycle. |

## System Docs Created

_None._

## Runbooks Updated

| Runbook | What Changed |
|---------|--------------|
| `sqlite-migration-pipeline.md` | Added exported head-version and migration-024 verification pattern. |
| `theme-visual-system-maintenance.md` | Added approved-slot remaster, brightness, and local-Profile-image boundaries. |
| `desktop-build-pipeline.md` | Added native generated-code patch and standalone release verification. |

## Runbooks Created

_None._

## ADRs Superseded

_None._

## Deferred / Not Captured

- Final History UX (32), backup transport (36), Category CRUD (37), and image-memory hardening (40) remain with their named owners; Phase 31.1 app-wide backgrounds are out of scope. Template-preview polish is deferred. AI-entry removal uses ADR-079; review/UAT fixes remain consequences and gotchas rather than separate ADRs.

## Phase Stats

- **Plans in phase:** 15
- **Decisions captured:** 5 clusters as 5 ADRs
- **Systems touched:** 15 existing system docs
- **New gotchas added:** 14
