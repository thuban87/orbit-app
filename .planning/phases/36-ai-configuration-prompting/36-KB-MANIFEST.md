# Phase KB Manifest: 36

**Phase:** 36-ai-configuration-prompting
**Processed:** 2026-09-21
**Decision-source tier:** dossier — `docs/dossier/milestone-2/phase-16-ai-configuration-prompting-dossier.md`, with the binding Phase-16 planning notes
**Source docs consumed:** 36 files (34 phase artifacts plus the dossier and planning notes)

## ADRs Produced

| ADR | Title | Source Decisions |
|-----|-------|------------------|
| ADR-135 | Multi-Connection AI Configuration and Fail-Closed Readiness | dossier §§B–J; CONTEXT D-03–05, D-09–11 |
| ADR-136 | Permission-Bounded Prompt Assembly and AI Transparency | dossier §§O, W–AB; CONTEXT D-06–08; ADR-107 |
| ADR-137 | Structured Personalization and Explicit Context Capacity | dossier §§P–V; CONTEXT D-11 |
| ADR-138 | Complete Portable Backup Format v5 | dossier backup boundary; CONTEXT D-03b, D-12, D-14 |
| ADR-139 | Loopback-Only OpenRouter Authorization Callback | CONTEXT D-04, D-05, D-13; owner-approved Plan 11 correction |

## System Docs Updated

| System Doc | What Changed |
|------------|--------------|
| `docs/systems/ai-suggestions.md` | Multi-lane configuration, bounded egress, personalization, and loopback authorization. |
| `docs/systems/persistence-core.md` | Migration 029 and the non-secret AI schema. |
| `docs/systems/contact-knowledge.md` | Creation-time Memory permission defaults and prompt context. |
| `docs/systems/interaction-log.md` | New-item note permission default and gated recent-note projection. |
| `docs/systems/interaction-history.md` | Format-v5 History preference emission. |
| `docs/systems/custom-fields.md` | Field-sharing defaults and permission review fan-out. |
| `docs/systems/conversational-fuel.md` | Retired inert AI-proposal confirmation UI. |
| `docs/systems/app-shell.md` | Routed AI hub and credential-free OpenRouter wake. |
| `docs/systems/backup-restore.md` | Complete v5 portable graph and credential exclusion. |
| `docs/systems/profile.md` | UID-keyed presentation and background-byte restore. |
| `docs/systems/photos.md` | Staged Profile-background restore and reconciliation. |

## System Docs Created

_None._

## Runbooks Updated

| Runbook | What Changed |
|---------|--------------|
| `docs/runbooks/ai-model-catalog-maintenance.md` | Distinguished LiteLLM seed maintenance from runtime OpenRouter catalog and curation policy. |

## Runbooks Created

_None._

## ADRs Superseded

_None._

## Deferred / Not Captured

- Hosted/shared-key AI service, LAN endpoints, automatic fallback, and full telemetry — explicitly deferred by the dossier.
- Fine-grained visual copy and repair-state mechanics — consequences of the recorded ADR clusters, not independent architectural decisions.

## Phase Stats

- **Plans in phase:** 11
- **Decisions captured:** 5 as 5 ADRs
- **Systems touched:** AI suggestions, persistence, contact knowledge, interaction log/history, custom fields, fuel, app shell, backup/restore, profile, photos
- **New gotchas added:** 10
