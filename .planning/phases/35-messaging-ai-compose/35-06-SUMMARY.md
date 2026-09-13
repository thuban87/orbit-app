---
phase: 35-messaging-ai-compose
plan: 06
subsystem: compose
tags: [compose, research, message-focus, contact-knowledge, read-path, zustand, react-native]

# Dependency graph
requires:
  - phase: 35-messaging-ai-compose
    plan: 01
    provides: "compose-session-store (useComposeSession) session-only draft state; extended here with Message Focus"
provides:
  - "compose-research-read: normalized ResearchItem view model + readComposeResearch(exec, contactId) over the knowledge read modules (per-source aiEligible + isOffLimits)"
  - "profile-knowledge-read.readPopulatedCustomFields: narrow, exported, populated-only custom-field projection carrying share_with_ai (A2)"
  - "compose-session-store: session-only messageFocus[] (<=3) + addToFocus/removeFromFocus/isInFocus (guard on validated ResearchItem)"
  - "ComposeResearchScreen: read-only Things-to-Remember Research projection with an Avoid group + Add-to-AI toggling"
affects: [35-09]

# Actuals (#2632)
actuals:
  tokens: 10100
  tasks: 4
  commits: 5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Normalized read boundary (compose-research-read) derives per-source Add-to-AI eligibility ONCE from each source's own permission (memory allow_ai / custom-field share_with_ai; every other source false) — the screen and store consume ResearchItem.aiEligible/.isOffLimits and never re-derive from raw rows (HIGH-6, T-35-15)"
    - "Off Limits is structural at the read boundary: isOffLimits=true, aiEligible=false ALWAYS — never a UI-side .filter() (D-14/ADR-107, T-35-16)"
    - "Message Focus is part of the active contact's compose session: capped/deduped/append-ordered, resets on contact switch, clears on confirmed send, lost on relaunch (D-10)"
    - "Shared groupCustomFieldRows helper backs both the private readCustomFields and the new readPopulatedCustomFields so their per-item mapping cannot drift"

key-files:
  created:
    - src/db/compose-research-read.ts
    - src/db/compose-research-read.test.ts
    - src/screens/ComposeResearchScreen.tsx
  modified:
    - src/stores/compose-session-store.ts
    - src/stores/compose-session-store.test.ts
    - src/db/profile-knowledge-read.ts
    - src/db/profile-knowledge-read.test.ts

key-decisions:
  - "First-class DERIVED status (gravity/intensity) is EXCLUDED from the Research projection as operational metadata (COMP-08), even though getFirstClassDerived is available. Only the four durable base first-class fields (birthday/social battery/contact frequency/category) render, each aiEligible=false. Documented as a deviation — COMP-08 'exclude operational metadata' takes precedence over the read_first hint to consume getFirstClassDerived."
  - "The Add to AI / 'Added ✓' toggle is a purpose-built token-driven Pressable, not the Button primitive: the dossier §O 'restrained selected highlight' (accent-tinted surface + border, NOT the full accent fill) is a two-state treatment the five formal Button roles do not express. It still speaks AppText role=label, resolves every colour through theme tokens, and pads to the 44px floor."
  - "The Research screen title is a static 'Things to Remember' label (no count) so it contains NO UI-side .filter() over isOffLimits — the off-limits marking stays structural at the read boundary and the 'Things to Remember - N' entry count remains a Compose-side (35-09) concern."
  - "ComposeResearchScreen takes a plain contactId prop (not a RootStackScreenProps route) — no ComposeResearch route exists yet; navigation wiring is 35-09, and navigation/types.ts is out of this plan's scope."

patterns-established:
  - "readComposeResearch composes getCurrentStateValues (is_current=1 only, never the retained history read), getFirstClassFields, listRelationshipsForContact (hidden EXCLUDED via resolveRelationshipVisibility), listMemoriesForContact (resolveVisibility show-only), readPopulatedCustomFields, and readProfileOffLimits into one ordered ResearchItem[]"

requirements-completed: [COMP-08, COMP-11]

coverage:
  - id: D1
    description: "Message Focus: session-only, capped at three (a 4th is a no-op), deduped by identity (tap-again removes), stable append order, clears on session/relaunch"
    requirement: "COMP-11"
    verification:
      - kind: unit
        ref: "src/stores/compose-session-store.test.ts#compose-session-store — Message Focus"
        status: pass
    human_judgment: false
  - id: D2
    description: "Add-to-AI eligibility guard: only aiEligible=true ResearchItems enter Message Focus; isOffLimits items can never be added (over the validated ResearchItem shape, not raw rows)"
    requirement: "COMP-11"
    verification:
      - kind: unit
        ref: "src/stores/compose-session-store.test.ts#compose-session-store — Add-to-AI eligibility guard"
        status: pass
    human_judgment: false
  - id: D3
    description: "Normalized ResearchItem projection derives per-source aiEligible (memory allow_ai, custom-field share_with_ai, first-class/relationship/off-limits false) and marks isOffLimits; only populated groups; hidden/soft-deleted/historical knowledge excluded"
    requirement: "COMP-08"
    verification:
      - kind: unit
        ref: "src/db/compose-research-read.test.ts#compose-research-read — normalized ResearchItem projection"
        status: pass
    human_judgment: false
  - id: D4
    description: "readPopulatedCustomFields returns only populated (rawValue!=null), non-quarantined custom fields carrying share_with_ai; an always_show-but-empty field is excluded (A2)"
    requirement: "COMP-08"
    verification:
      - kind: unit
        ref: "src/db/profile-knowledge-read.test.ts#readPopulatedCustomFields returns only populated, non-quarantined fields carrying share_with_ai (A2)"
        status: pass
    human_judgment: false
  - id: D5
    description: "ComposeResearchScreen is a read-only projection: no editor UI / mutation DAO, no re-derived eligibility (consumes ResearchItem.aiEligible/.isOffLimits), Off Limits as a read-only Avoid group with no Add to AI, AppText roles + theme tokens only"
    requirement: "COMP-08"
    verification:
      - kind: automated_ui
        ref: "npx tsc --noEmit && npm run check:colors (both exit 0); grep gates: no MemoryEditor/RelationshipEditor/setCurrentStateValue/deleteMemory/upsert, no allow_ai/share_with_ai, no raw fontSize"
        status: pass
    human_judgment: true
    rationale: "Only populated groups + an Avoid group render, three-item cap, toggle-off, and background/return selection survival are device-observable (Pixel phase-gate UAT); tsc/check:colors/grep prove structure, not the running behavior."

# Metrics
duration: 13min
completed: 2026-09-13
status: complete
---

# Phase 35 Plan 06: Things to Remember Research + Message Focus Summary

**A read-only Compose Research side that projects a contact's populated conversation-relevant knowledge as one normalized `ResearchItem[]` (per-source Add-to-AI eligibility + an Off Limits "Avoid" group), plus a capped/deduped/session-only Message Focus selection in the compose-session-store — granting no AI permission and inferring no eligibility in the UI or store.**

## Performance
- **Duration:** ~13 min
- **Tasks:** 4
- **Files:** 3 created, 4 modified

## Accomplishments
- **compose-research-read (new):** `readComposeResearch(exec, contactId)` composes the existing knowledge READ modules into an ordered, populated-only `ResearchItem[]` (`{ id, group, label, value, aiEligible, isOffLimits }`). Add-to-AI eligibility is derived ONCE at this boundary from each source's own permission — memory `allow_ai`, custom-field `share_with_ai`; first-class fields, structured relationships, current-state, and off-limits are all `aiEligible=false`. A per-source DISPLAY-visibility fence excludes hidden memories, soft-deleted memories, hidden relationships, and historical (`is_current=0`) current-state (uses `getCurrentStateValues`, never the retained history read). Off Limits renders as the read-only Avoid group (`isOffLimits=true`, never Add-to-AI). Pure offline read — no transaction, no network, no native-module import (node-testable).
- **profile-knowledge-read.readPopulatedCustomFields (new export, A2):** a narrow populated-only (`v.value IS NOT NULL`), non-quarantined custom-field projection carrying `share_with_ai`, with no repeatable cap. The private `readCustomFields` stays private and the heavyweight `readProfileKnowledge` collection is NOT consumed by the Research read. Both paths share a new `groupCustomFieldRows` helper so their per-item mapping cannot drift.
- **compose-session-store (extended):** session-only `messageFocus[]` (<=3) with `addToFocus`/`removeFromFocus`/`isInFocus`. `addToFocus` guards on the validated `ResearchItem` (rejects non-`aiEligible` / `isOffLimits`), enforces the hard cap of three, dedupes/toggles by identity, and appends in stable order. Message Focus belongs to the active contact's session — reset on contact switch, cleared on a confirmed send, lost on relaunch. Grants no permission; no DAO/network op. The `ResearchItem` import is type-only (A5).
- **ComposeResearchScreen (new):** a compact read-only projection of the normalized items — populated groups + an Avoid group — with an Add to AI / "Added ✓" toggle only where `ResearchItem.aiEligible` is true, wired to the Message Focus store. No editor component, no mutation DAO, no re-derived eligibility, no UI-side off-limits filter; AppText roles + theme tokens throughout; controls padded to the 44px floor.

## Task Commits
1. **Task 1: Message Focus session state** — `c8cf122` (feat)
2. **Task 2: compose-research-read + readPopulatedCustomFields** — `293f86c` (feat)
3. **Task 3: ComposeResearchScreen** — `7682065` (feat)
4. **Task 4: Add-to-AI eligibility guard tests** — `a886895` (test)

## Deviations from Plan
### 1. [Rule 2 — correctness/scope] Excluded derived first-class status (gravity/intensity) from the Research projection
- **Found during:** Task 2
- **Issue:** Task 2's `read_first` notes `getFirstClassDerived` is available and "consumed read-only", but COMP-08's core truth requires the Research side to show only conversation-relevant knowledge, "excluding operational metadata". Gravity (tier) and Intensity (multiple× this period) are derived operational status, not things-to-remember.
- **Resolution:** The projection renders only the four durable base first-class fields (birthday / social battery / contact frequency / category), each `aiEligible=false`. `getFirstClassDerived` is intentionally not called. COMP-08's exclusion rule takes precedence over the softer read-first hint.
- **Files:** src/db/compose-research-read.ts

### 2. [design] Add to AI toggle is a token-driven Pressable, not the Button primitive
- **Found during:** Task 3
- **Issue:** The dossier §O "restrained selected highlight" (accent-tinted surface + border, NOT the full accent fill) for "Added ✓" is a two-state treatment the five formal Button roles do not express, while the UI-SPEC asks new Compose UI to speak in Button roles.
- **Resolution:** Built a purpose-built `AddToAiToggle` Pressable that still uses AppText `role="label"`, resolves every colour through theme tokens (unselected = accentText link tone; selected = restrained `surfaceElevated` + `accentText` border), and pads to `MIN_TOUCH_TARGET`. `check:colors` and the no-raw-fontSize gate pass.
- **Files:** src/screens/ComposeResearchScreen.tsx

### 3. [scope-guard] Static "Things to Remember" title (no count)
- **Found during:** Task 3
- **Issue:** A "Things to Remember · N" title would require a UI-side `.filter()` over `isOffLimits` to compute the non-off-limits count, which reads against the "no UI-side off_limits filter" prohibition.
- **Resolution:** The screen title is a static "Things to Remember" label; the counted `Things to Remember · {count}` entry stays a Compose-side (35-09) concern. Keeps off-limits marking structural at the read boundary.
- **Files:** src/screens/ComposeResearchScreen.tsx

## Issues Encountered
- **Pre-existing, out-of-scope test failure (NOT this plan):** `src/components/orrery/orrery-controls-render.test.tsx` fails to load with a transform-level `SyntaxError: Unexpected token 'typeof'` (0 tests). It references none of this plan's files and lives in the Orrery subsystem (the working tree had dirty `30-orrery-systems` review files at plan start). Logged in `deferred-items.md`; left untouched per the executor scope boundary.

## Verification
- `npx vitest run src/db/compose-research-read.test.ts src/db/profile-knowledge-read.test.ts src/stores/compose-session-store.test.ts` — **22 tests green**.
- `npx tsc --noEmit` — **clean**. `npm run check:colors` — **passes**.
- Full suite: **3371 tests passing, 355/356 suites green** (the one failing suite is the pre-existing orrery-controls transform error above).
- Grep gates all clean: `readPopulatedCustomFields` exported + consumed; the private `readCustomFields` untouched; no `getCurrentStateHistory`, no native-module import in compose-research-read; no editor/mutation symbols, no `allow_ai`/`share_with_ai`, no raw `fontSize`, no UI-side `.filter()` in ComposeResearchScreen; type-only `ResearchItem` import in the store.
- **Device backstop (phase gate, not this plan):** on the Pixel, open Research → only populated groups + an Avoid group render, add three items (fourth rejected), toggle one off, background+return (selection survives).

## Known Stubs
None. AI availability/eligibility state and the Compose-side "Message focus · N" summary are deliberately owned by later plans (E4/E6 wiring in 35-09) — a documented cross-plan sequence, not a stub. The `messageFocus` selection is fully functional session state here.

## Next Phase Readiness
- **35-09 (wave):** wires `ComposeResearchScreen` into navigation (route + `Things to Remember · {count}` entry), renders the `Message focus · N` (E4) summary on the Compose side from `useComposeSession().messageFocus`, and consumes the selection when composing. The store contract (`messageFocus`/`addToFocus`/`removeFromFocus`/`isInFocus`) and `ResearchItem` shape are stable.

## Self-Check: PASSED
- Files verified present on disk: `src/db/compose-research-read.ts`, `src/db/compose-research-read.test.ts`, `src/screens/ComposeResearchScreen.tsx`, `src/stores/compose-session-store.ts`, `src/db/profile-knowledge-read.ts`.
- Commits verified in `git log`: `c8cf122`, `293f86c`, `7682065`, `a886895`.

---
*Phase: 35-messaging-ai-compose*
*Completed: 2026-09-13*
