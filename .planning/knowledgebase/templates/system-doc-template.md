# {System Name}

**Last updated:** {YYYY-MM-DD}
**Updated by phase:** {phase-id}
**Owners:** {store(s), service(s), and DAO(s) that own this system}

## Purpose

{What this system does in 2-3 sentences. What problem it solves for the user. Written in present tense — this describes the system as it exists right now.}

## Architecture

### Data Model

{Current schema — tables, columns, types, relationships. Orbit is local-first on-device SQLite (expo-sqlite); there is no backend. This means the SQLite table(s) owned by the relevant DAO plus the TypeScript interface(s).}

**Tables:**
- `{table_name}` — {purpose}
  - `{column}` ({type}) — {what it stores}

**Types** (`src/db/{file}.ts` or `src/types/{file}.ts`):
- `{InterfaceName}` — {what it represents}

### Store, Service & DAO Layer

| Layer | File | Responsibility |
|-------|------|----------------|
| Store | `src/stores/{name}-store.ts` | {what state it manages} |
| Service | `src/services/{name}.ts` | {what operations it handles} |
| DAO | `src/db/{name}-dao.ts` | {what SQLite reads/writes it owns} |

### Key Files

| File | Role |
|------|------|
| `{path}` | {what it does in this system} |

## How It Works

{Narrative description of the runtime flow. Walk through what happens when the user interacts with this system. Use the format: "When the user does X, Y component calls Z store, which calls the DAO, which does W." Keep it concrete — reference actual function names, store actions, DAO methods, and component names.

For complex systems, break into subsections by flow:}

### {Flow Name} (e.g., "Logging an interaction")

1. {Step 1 — what component/action triggers this}
2. {Step 2 — what store/service/DAO method is called}
3. {Step 3 — what data changes in SQLite}
4. {Step 4 — how the UI updates}

## Configuration

{Any constants, config values, or tunable settings that control behavior. Include file paths and current values. Per project convention, tunable constants sit at the top of their service file.}

| Constant | Value | File | Purpose |
|----------|-------|------|---------|
| `{NAME}` | `{value}` | `{path}` | {what it controls} |

## Decisions

{Links to relevant ADRs — don't duplicate the decision content, just reference it.}

- **ADR-{NNN}:** {title} — {one-line summary of how it affects this system}

## Gotchas

{Things that are easy to get wrong. Bug patterns that have come up. Non-obvious behaviors. Pull from UAT gaps, SUMMARY deviations, and known issues. These are the things an agent or new developer would waste time on without warning.}

1. **{Gotcha title}** — {What goes wrong and why. Reference the specific file/function if applicable.}

## Related Systems

- **{System name}** — {How it connects: "consumes interactions from," "feeds contacts to the digest," etc.}

## Changelog

| Date | Phase | What Changed |
|------|-------|--------------|
| {date} | {phase-id} | {Brief description of changes} |

---

<!--
AGENT INSTRUCTIONS:
- One system doc per logical subsystem (not per phase, not per store)
- Subsystem boundaries follow the groupings from the store/service/DAO inventory. For orbit:
    Contacts: contact-store, contacts-dao
    Custom fields: field-defs-dao, field-values-dao, field-parsers, field-type-change,
      field-sort, field-sweep, custom-field widgets/forms
    Interaction log: interaction-store, interactions-dao
    Status & decay: status-calculation service, decay thresholds
    Orrery (Skia render loop): orrery components, orbit geometry
    Digest: digest service
    AI suggestions: AI provider service (the one network path, user-invoked only)
    App config: theme-store, settings-store
- These docs are LIVING — update them when a new phase modifies the system
- Write in present tense ("The DAO fetches..." not "The DAO was designed to fetch...")
- The "How It Works" section is the most important — make it concrete enough that an agent
  could trace a user action through the full stack (component → store → DAO → SQLite)
  without reading source code
- Remember: no backend, no RPC. Logic that would live in a DB function lives in TypeScript.
- "Gotchas" should be specific and actionable, not generic warnings
- Keep the Changelog as an append-only log so you can see how the system evolved
- Total length target: 150-300 lines. If it's longer, consider splitting into sub-systems
-->
