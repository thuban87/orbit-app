# Knowledge Base Index

## When You Need to Understand a System

Read the relevant system doc before making changes to any subsystem:

| Subsystem | System Doc | Key Stores / DAOs |
|-----------|-----------|-------------------|
| Contacts | `docs/systems/contacts.md` | contact-store, contacts-dao |
| Custom Fields | `docs/systems/custom-fields.md` | field-defs-dao, field-values-dao, field-parsers, field-type-change, field-sort, field-sweep |
| Interaction Log | `docs/systems/interaction-log.md` | interaction-store, interactions-dao |
| Status & Decay | `docs/systems/status-decay.md` | status-calculation service |
| Orrery | `docs/systems/orrery.md` | (no dedicated store — Skia render loop, see `src/components/orrery/`) |
| Digest | `docs/systems/digest.md` | digest service |
| AI Suggestions | `docs/systems/ai-suggestions.md` | AI provider service (the single user-invoked network path) |
| App Config | `docs/systems/app-config.md` | theme-store, settings-store |

## When You Need to Add or Modify Something Repeatable

Read the relevant runbook and follow it step by step. Do not improvise:

| Task | Runbook |
|------|---------|
| Add a SQLite migration (TS, `PRAGMA user_version`) | `docs/runbooks/sqlite-migrations.md` |
| Add a theme profile or token | `docs/runbooks/theme-tokens.md` |
| Add a custom-field type + parser | `docs/runbooks/custom-field-types.md` |
| Add an orrery visual layer | `docs/runbooks/orrery-layers.md` |
| {more as created} | |

## When You Need to Know Why Something Works That Way

Search ADRs in `docs/decisions/` by keyword. ADRs are numbered globally (ADR-001, ADR-002, ...) and are immutable — if a decision changed, a newer ADR supersedes the old one.

## Templates

Templates for KB documents live in `.planning/knowledgebase/templates/`:
- `adr-template.md` — Architecture Decision Record
- `system-doc-template.md` — Living system documentation
- `runbook-template.md` — Step-by-step process guide
- `phase-kb-manifest-template.md` — Phase processing audit trail
