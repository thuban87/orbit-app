# Phase KB Manifest: {phase-id}

**Phase:** {full phase name}
**Processed:** {YYYY-MM-DD}
**Source docs consumed:** {count} files ({total size})

## ADRs Produced

| ADR | Title | Source Decisions |
|-----|-------|-----------------|
| ADR-{NNN} | {title} | D-{XX}, D-{YY} |

## System Docs Updated

| System Doc | What Changed |
|------------|--------------|
| `docs/systems/{name}.md` | {Brief description: "Added normalized custom-field value model," "Updated schema section with custom_field_values"} |

## System Docs Created

| System Doc | Covers |
|------------|--------|
| `docs/systems/{name}.md` | {What subsystem this documents} |

## Runbooks Updated

| Runbook | What Changed |
|---------|--------------|
| `docs/runbooks/{name}.md` | {Brief description of update} |

## Runbooks Created

| Runbook | Process |
|---------|---------|
| `docs/runbooks/{name}.md` | {What process this documents} |

## Deferred / Not Captured

{Anything from the phase that didn't produce KB artifacts and why:}

- {Item} — {Reason: "Too small for its own ADR," "Merged into existing system doc," "Deferred to future phase"}

## Phase Stats

- **Plans in phase:** {N}
- **Decisions captured:** {N} as {N} ADRs
- **Systems touched:** {list}
- **New gotchas added:** {N}

---

<!--
AGENT INSTRUCTIONS:
- One manifest per phase, created after all KB artifacts for that phase are generated
- Lives alongside the phase's other docs in .planning/phases/{phase-id}/
- File name: {phase-id}-KB-MANIFEST.md (e.g., 16-KB-MANIFEST.md)
- This is the audit trail that connects phase work to KB artifacts
- If a system doc was UPDATED (not created), the changelog row in that system doc should match
  what's listed here
- "Deferred / Not Captured" is important — it prevents the next agent from re-processing
  items that were intentionally skipped
- Keep this doc short — it's a manifest, not a summary. Under 50 lines of content.
-->
