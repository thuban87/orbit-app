# Phase 1: Project Scaffold & Portable Code - Context

**Gathered:** 2026-08-14
**Status:** Ready for planning
**Mode:** Auto-generated (smart discuss — infrastructure phase, grey-area questions skipped)

<domain>
## Phase Boundary

A themed Expo/RN app that builds and launches on the Pixel via the desktop pipeline, with the
portable plugin code extracted, decoupled from Obsidian, and typechecking.

**In scope (FND-01…FND-06, all tagged `(infra)`):**
- FND-01 — Expo/RN app builds + launches to a home shell on the Pixel 6 Pro through the
  desktop-build → install pipeline (pipeline proven **once**).
- FND-02 — Extract the portable plugin files into `src/` as tracked, linted, typed source:
  `calculateStatus()` + `FREQUENCY_DAYS`/`Frequency`/`OrbitStatus`/`SocialBattery`/`LastInteractionType`,
  `schemas/types.ts`, both built-in schemas, `formatLocalDate()`, `logger.ts`.
- FND-03 — `types.ts` free of Obsidian coupling (`TFile` stripped/generalised); extracted files typecheck.
- FND-04 — `AiService.ts` ported with `requestUrl`→`fetch` + explicit `response.ok` handling,
  decoupled from Obsidian types (**not** wired to UI in this phase).
- FND-05 — Theme-token module + Zustand store scaffold (quest-board pattern); no hardcoded colours.
- FND-06 — Biome lint/format, portrait-lock, and the CLAUDE.md folder layout configured.

**Explicitly NOT in scope this phase:** the SQLite schema / migrations (Phase 2), custom fields
(Phase 3), any contact CRUD or UI feature. This phase stands up the shell and lands the portable
pure-logic/types only. `AiService.ts` compiles standalone but is not connected to any screen.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Pure infrastructure phase — grey-area discussion skipped per smart-discuss infrastructure
detection (goal is "scaffold"; all four success criteria are technical: files-in-`src/`,
typecheck, compiles-standalone, config-valid; no user-facing behaviour). Implementation choices
are at Claude's discretion, **bounded by the authoritative decisions already recorded** in
HANDOFF.md, CLAUDE.md, PROJECT.md, and the dossier — those are `[DECIDED]`, not open for reversal.
Use them, ROADMAP success criteria, and codebase conventions to drive decisions.

**Load-bearing constraints this phase must honour (not choices):**
- Reuse quest-board's RN scaffolding + theme-token pattern where it transfers (HANDOFF §2, PROJECT Constraints).
- Every colour resolves through a theme token — **no hardcoded colours anywhere** (CLAUDE.md).
- Portrait-locked at the config layer; Biome for lint/format.
- Keep `formatLocalDate()`'s comment/intent intact — it deliberately avoids the `toISOString()`
  UTC off-by-one already fixed once in the plugin (HANDOFF §4, CLAUDE.md dates rule). Never
  reintroduce `toISOString().split('T')[0]`.
- `AiService.ts`: swap the sole Obsidian coupling `import { requestUrl } from 'obsidian'` for
  `fetch`, with explicit `response.ok` handling. It is the highest-value single port (540 lines,
  all 5 providers behind one interface) — port faithfully, do not redesign here.
- `types.ts` line 1 imports `TFile` from `obsidian` and `OrbitContact` carries `file: TFile` —
  strip/generalise to an opaque ref so `types.ts` becomes 100% portable (HANDOFF §4).

</decisions>

<code_context>
## Existing Code Insights

### Current repo state (scouted)
- `/home/bwales/projects/orbit-app` — **no `package.json`, empty `src/`.** True from-scratch Expo
  scaffold. Present: `CLAUDE.md`, `HANDOFF.md`, `docs/dossier/` (15 domains + INDEX), `.planning/`,
  `.claude/`. Graphify is **disabled** in `.planning/config.json` (ADR-bridge scripts + build-block
  hooks not yet ported from quest-board — do NOT `graphify build` this phase; STATE.md blocker).

### Portable source — verified present in `~/projects/Orbit/src` (read-only reference, HANDOFF §4)
| File | Lines | Action |
|------|-------|--------|
| `services/AiService.ts` | 540 | Port; `requestUrl`→`fetch` + `response.ok`; decouple Obsidian types. |
| `types.ts` | 191 | Port `calculateStatus()`, `FREQUENCY_DAYS`, `Frequency`, `OrbitStatus`, `SocialBattery`, `LastInteractionType`; **strip `TFile`/`file` coupling**. |
| `schemas/types.ts` | 99 | Port verbatim (zero Obsidian) — `FieldType`, `FieldDef`, `SchemaDef`. |
| `schemas/new-person.schema.ts` | 72 | Port verbatim. |
| `schemas/edit-person.schema.ts` | 72 | Port verbatim. |
| `utils/dates.ts` | 22 | Port verbatim — keep the `formatLocalDate()` comment. |
| `utils/logger.ts` | 43 | Port verbatim. |

`schemas/loader.ts` (479) is NOT this phase — only `keyToLabel()` (~9 lines) is salvaged later, in
Phase 3 (HANDOFF §14.9). Do not port loader.ts.

### Stack (PROJECT.md Constraints — pin, don't re-choose)
Expo SDK 57 (RN 0.86, New Architecture), TypeScript, expo-sqlite, Zustand stores, Biome. Skia
2.6.2 + Reanimated 4.5.1 (orrery, later), react-native-android-widget 0.22.0 + custom dev client
(widget, later), expo-share-intent (capture, later). Quest-board (`~/projects/quest-board-app`) is
the scaffolding/theme-token reference — read it in place.

### Build/test pipeline (PROJECT.md Context; STATE.md blocker — execution-time)
This box **cannot build Android APKs**. Loop: commit → **rsync/scp** the repo over SSH to the
Windows desktop (SSH host `droid`, `C:\Users\bwles\projects\orbit-app`) → build the debug APK there
→ pull it back → `adb install` on the wired Pixel 6 Pro → drive via `adb`/`uiautomator`. Transport
is rsync/scp, **NOT git push** (global no-push rule stays intact; rsync/scp/ssh allowed in this
repo's `settings.local.json`). **Bring-up still pending:** the `droid` `~/.ssh/config` Host block
and a one-time `ssh droid` + debug-build verification must happen before FND-01 can be proven.

### Integration points
- `src/theme/` — every colour resolves here (CLAUDE.md repo layout).
- `src/stores/` — Zustand store scaffold (quest-board pattern).
- `src/services/`, `src/db/`, `src/components/`, `src/screens/`, `src/utils/` — CLAUDE.md folder layout.

</code_context>

<specifics>
## Specific Ideas

Follow HANDOFF §15 "First moves" 1–2 for this phase: (1) scaffold the Expo project, reusing
quest-board's setup where it transfers; (2) extract the §4 portable files into `src/`, strip
`TFile` from `types.ts`, swap `requestUrl`→`fetch` in `AiService.ts`. The SQLite layer (First move
#3) is Phase 2, not here.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase; discussion stayed within scope. (SQLite/migrations → Phase 2; custom
fields → Phase 3; the Obsidian *data* importer was cut entirely by the owner, only *code* porting
survives — PROJECT.md Out of Scope.)

</deferred>
