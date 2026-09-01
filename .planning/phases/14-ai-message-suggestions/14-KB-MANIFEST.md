# Phase KB Manifest: 14-ai-message-suggestions

**Phase:** AI Message Suggestions
**Processed:** 2026-09-01
**Decision-source tier:** dossier — `docs/dossier/13-ai.md`, overlaid by phase-context and execution artifacts
**Source docs consumed:** 28 files (mapped dossier plus phase 14 corpus)

## ADRs Produced

| ADR | Title | Source Decisions |
|-----|-------|------------------|
| ADR-049 | BYO-Key AI Configuration and Credential Boundary | dossier 13 C/D; phase context |
| ADR-050 | Closed AI Prompt Egress Allowlist and Opt-In Field Sharing | dossier 13 B; phase context |
| ADR-051 | Public-HTTPS Custom AI Egress Guard | dossier 13 C; reviews and Plans 06/07 |
| ADR-052 | Compose-Owned AI Draft Lifecycle and Acknowledged Egress | dossier 13 A; phase context and Plan 05 |
| ADR-053 | Local-First LiteLLM AI Model Catalog | Plans 08–11 and owner close-out |

## ADRs Superseded

_None._

## System Docs Updated

| System Doc | What Changed |
|------------|--------------|
| `docs/systems/persistence-core.md` | Added migration-004 non-secret AI settings boundary. |
| `docs/systems/custom-fields.md` | Documented default-off AI field-sharing consent. |
| `docs/systems/contact-methods.md` | Added Compose-owned acknowledged AI draft flow. |
| `docs/systems/contacts.md` | Added profile-to-Compose AI draft entry with no contact write. |
| `docs/systems/app-shell.md` | Added serializable AI intent and non-secret settings host. |

## System Docs Created

| System Doc | Covers |
|------------|--------|
| `docs/systems/ai-suggestions.md` | AI credentials, prompt boundary, guarded egress, draft lifecycle, and model catalog. |

## Runbooks Updated

_None._

## Runbooks Created

| Runbook | Process |
|---------|---------|
| `docs/runbooks/ai-model-catalog-maintenance.md` | Regenerate and verify the LiteLLM model seed. |

## Deferred / Not Captured

- Multi-variant generation, local/LAN AI, automatic AI data writes, and monetisation — intentionally deferred by phase scope.
- Pre-existing Compose array-index lint finding — unrelated to this phase.

## Phase Stats

- **Plans in phase:** 11
- **Decisions captured:** 5 as 5 ADRs
- **Systems touched:** AI suggestions, persistence core, custom fields, contact methods, contacts, app shell
- **New gotchas added:** 12
