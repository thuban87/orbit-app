---
phase: 01-project-scaffold-portable-code
reviewed: 2026-08-14T20:24:18Z
depth: deep
files_reviewed: 25
files_reviewed_list:
  - app.config.ts
  - App.tsx
  - index.ts
  - babel.config.js
  - biome.json
  - tsconfig.json
  - vitest.config.ts
  - scripts/check-colors.sh
  - src/constants/app.ts
  - src/constants/app-name.json
  - src/schemas/types.ts
  - src/schemas/new-person.schema.ts
  - src/schemas/edit-person.schema.ts
  - src/screens/HomeScreen.tsx
  - src/services/AiService.ts
  - src/services/ai-types.ts
  - src/services/AiService.test.ts
  - src/stores/theme-store.ts
  - src/theme/theme-types.ts
  - src/theme/theme-presets.ts
  - src/theme/theme-presets.test.ts
  - src/theme/theme-provider.tsx
  - src/theme/index.ts
  - src/types.ts
  - src/types.test.ts
  - src/utils/dates.ts
  - src/utils/dates.test.ts
  - src/utils/logger.ts
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-08-14T20:24:18Z
**Depth:** deep (cross-file: import graph + call chains, original plugin source read for port fidelity)
**Files Reviewed:** 25 (+ `~/projects/Orbit/src/services/AiService.ts` as the port baseline)
**Status:** issues_found

## Summary

This is the irreversible foundation of a local-first RN/Expo social CRM: theme token system, the ported `AiService` provider layer, pure domain types/date utils, built-in schemas, and the app shell. I read the full files on disk (not the diff) and cross-checked the `AiService` port against the original plugin source, and every reviewed module against `CLAUDE.md` / `HANDOFF.md`.

**Decision-fidelity checks all pass.** The owner-mandated omissions and conventions are honoured:

- **No cleartext / LAN provider reappears.** `grep` over `src/` for `ollama|http://|localhost|127.0.0.1` returns nothing. `ai-types.ts` `AiProviderId` excludes the local provider id, so it cannot enter the type system. The Ollama class from the plugin is dropped entirely. (HANDOFF / CONTEXT 2026-08-14 [DECIDED])
- **`fetch` port is correct.** All four providers use `const data = await response.json();` (awaited) and each is guarded by an `if (!response.ok) throw` *before* the parse. `AiService.test.ts` proves guard placement with an un-called `json` spy on non-ok responses. No silent-typecheck `response.json` (non-awaited) trap survived.
- **`AiProviderId` vs `interface AiProvider`** naming split is deliberate and correct — no TS2440 collision.
- **No hardcoded colours outside `src/theme/`.** Hex literals appear only in `theme-presets.ts`; `HomeScreen.tsx` and every other module read via `useTheme().colors.*`.
- **No `toISOString().split('T')[0]` / `date('now')` reintroduced.** The only `toISOString` occurrences are the cautionary comments in `dates.ts` naming the anti-pattern; the code uses local getters.
- **`logger.ts` uses `unknown[]`, not `any[]`.** Confirmed.
- **Theme store is live, not dead code.** `ThemeProvider` subscribes to `useThemeStore` selectors (`mode`, `presetId`), and `resolveMode` handles RN's `'unspecified'` (typed via the `SystemScheme` superset; asserted in `theme-presets.test.ts`).
- **Known Phase-14 carry-forwards are already labelled `legacy_compat`** in `01-04-PLAN.md` / `01-04-SUMMARY.md` — the empty-`aiModel` throw that short-circuits `CustomProvider`'s `model || this.modelName` fallback, the contact-content prompt debug log at `AiService.ts:149`, and the markdown-vault-shaped prompt assembly. Per review scope these are documented deferrals, **not** raised as new blockers.

The findings below are one real robustness gap in the colour gate and two low-severity port-fidelity notes for future traceability. No blockers.

## Warnings

### WR-01: `check-colors.sh` `/theme/` exclusion is not path-anchored — a hardcoded colour can evade the gate

**File:** `scripts/check-colors.sh:40-44`
**Issue:** The gate greps `file:line:content` output and then strips sanctioned matches with `grep -vE '/theme/'`. That filter matches the substring `/theme/` **anywhere in the whole output line, including the matched source content**, not just the file-path field. So a forbidden colour literal on a line that also contains the substring `/theme/` (e.g. a trailing comment or a string referencing a theme path) is silently dropped from the report and the gate passes. Example that would NOT be flagged:

```tsx
const c = "#ff0000"; // TODO move to src/theme/tokens
```

Because the whole design promise ("all colours resolve through theme tokens") rests on this gate catching violations, a content-based bypass weakens it. It is unlikely to trigger by accident today, but it is a genuine false-negative path in an infrastructure gate that later phases will point at changed files and trust.

**Fix:** Anchor the exclusion to the path field (everything before the first `:`), so only files actually under a `theme/` directory are exempted:

```bash
  | grep -vE '^[^:]*/theme/' || true)
```

(or split the field with `awk -F: '$1 !~ /\/theme\//'`). This keeps the sanctioned `src/**/theme/**` exemption while removing the content-substring escape hatch.

## Info

### IN-01: `parseDate` silently accepts out-of-range ISO components via `Date` rollover

**File:** `src/types.ts:163-187`
**Issue:** The ISO branch constructs `new Date(year, month-1, day)` from the regex capture without range-validating the components. JS `Date` rolls over out-of-range values, so `parseDate("2025-13-45")` matches the `^\d{4}-\d{2}-\d{2}` regex, builds a valid (rolled-over) `Date` (≈ Feb 14 2026), passes the `!Number.isNaN` check, and returns a wrong-but-valid date instead of `null`. This is a faithful port of the plugin behaviour and is locked by the existing test suite (which only exercises well-formed input), so it is not a regression — flagged for future hardening when this feeds the SQLite import path in a later phase, where a malformed frontmatter date would import as a plausible-looking wrong date.
**Fix:** After constructing the date, verify the components round-trip (`date.getFullYear() === year && date.getMonth() === month-1 && date.getDate() === day`) before returning; otherwise fall through to `null`. Defer until the importer phase; do not touch the locked test behaviour without owner sign-off.

### IN-02: Built-in schema `photo` field copy still describes the plugin's URL input, contradicting the [DECIDED] native picker

**File:** `src/schemas/types.ts:18`; `src/schemas/new-person.schema.ts:58-64`; `src/schemas/edit-person.schema.ts:57-64`
**Issue:** The `FieldType` doc comment (`photo: URL input (preview added in Phase 2)`) and both built-in schemas' photo field (`placeholder: "Enter a URL, local path, or wikilink"`, matching `description`) carry forward the Obsidian plugin's URL-text-input model. `HANDOFF.md` §14.3 [DECIDED] and §14.10(7) record that the mobile `photo` field becomes a **native image picker with local file storage** — explicitly "differs from the plugin." These schemas are listed in §14.8 as "already ported," and the photo rework is scheduled later, so this is expected legacy copy rather than a defect — but the stale placeholder/description would mislead if the field editor is built against it verbatim.
**Fix:** No code change required this phase. When the photo-field rework lands, update the `FieldType` comment and both schemas' photo placeholder/description to reflect the native picker so the built-in schemas stop advertising URL entry.

---

_Reviewed: 2026-08-14T20:24:18Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
