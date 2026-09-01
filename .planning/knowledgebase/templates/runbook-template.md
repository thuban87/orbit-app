# {Process Name} Pipeline

## Overview

{What this process accomplishes in 2-3 sentences. When would someone need to do this? How often does it happen? What's the end result?}

## Architecture ({Phase where this was established})

{How the system that this process touches is structured. What registries, resolvers, DAOs, components, or data flows are involved. Keep this focused on what's relevant to the process — link to the full system doc for deeper context.

Include diagrams of the resolution chain or data flow if it helps:}

### {Component/Registry Name}

**File:** `{path/to/file}`

{What it does, how it's structured, what it's keyed by. Include a code snippet if the structure isn't obvious from description alone:}

```typescript
{Brief code showing the relevant data structure or function signature}
```

### Fallback Chain / Resolution Order

{If the process involves lookups with fallbacks, document the chain:}

1. **{Primary source}** — {what it returns, when it succeeds}
2. **{Fallback}** — {what it returns when primary misses}
3. **{Final fallback}** — {what happens when everything misses}

## File Locations

### Assets

**Directory:** `{path/to/assets/}`

{What goes here, naming conventions, format requirements.}

### Code

| File | Purpose |
|------|---------|
| `{path}` | {role in this process} |

## How to {Do the Thing}

{Step-by-step instructions. Number each step. Be specific about file paths, function names, and exact code to add. An agent should be able to follow these steps without reading any other documentation.}

1. **{Action verb} the {thing}** {where/how}. {Format requirements, naming rules, etc.}

2. **{Next action}** in `{file path}`:
   ```typescript
   {exact code to add, with placeholder values marked}
   ```

3. **{Next action}** — {description}

4. **{Build/verify step}** — {command to run or check to perform}

### What You Don't Need to Change

{Explicitly call out files/registries that auto-derive or don't need manual updates. This prevents agents from making unnecessary edits.}

## Pitfalls

{Numbered list of things that go wrong. Be specific — include the error message or symptom if possible. Pull from UAT gaps, SUMMARY deviations, and debugging sessions.}

1. **{What goes wrong}.** {Why it happens and how to avoid it.}

2. **{What goes wrong}.** {Why it happens and how to avoid it.}

## Smoke Test

{Verification commands that confirm the process was done correctly. Should be copy-pasteable.}

```bash
{grep/find/test command that verifies the expected state}
```

Expected: {what the output should look like}

```bash
{second verification if needed}
```

Expected: {what the output should look like}

---

<!--
AGENT INSTRUCTIONS:
- One runbook per repeatable process (not per feature, not per phase)
- Model these after the existing runbooks in docs/runbooks/
- The "How to" section is the core — it should be step-by-step, copy-paste ready
- Include "What You Don't Need to Change" — agents waste tokens on unnecessary edits without this
- Pitfalls should come from real bugs/issues found during development (UAT gaps, SUMMARY deviations)
- Smoke tests should be runnable bash commands, not prose descriptions
- When a phase changes the process, UPDATE the existing runbook (don't create a new one)
- Mark the phase that last modified the runbook in the Architecture section header
- Keep total length under 200 lines — if longer, the process might need to be split
- Good orbit runbook candidates: adding a SQLite migration (TS, `PRAGMA user_version`),
  adding a theme profile/token, adding a custom-field type + parser, adding an orrery
  visual layer. Use the same structure across all runbooks for consistency.
-->
