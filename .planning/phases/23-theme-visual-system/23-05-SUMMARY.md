---
phase: 23-theme-visual-system
plan: 05
subsystem: ui
tags: [icons, ionicons, expo-vector-icons, status-glyphs, theme-tokens, accessibility]

# Dependency graph
requires:
  - phase: 23-01
    provides: persisted theme resolution (package × mode) + useTheme() palette
  - phase: 23-02
    provides: token-file idiom (radii/spacing/motion) + @expo/vector-icons install
provides:
  - Semantic icon registry (ICON_REGISTRY) mapping semantic names -> Ionicons outline/filled pairs; IconName union
  - Icon primitive resolving colour via useTheme().colors[tone] and size via ICON_SIZE tokens
  - IconTone (string-valued ThemePalette keys only) + narrower StatusTone subset
  - ICON_SIZE token set (16/20/24/28)
  - TAB_ICON mapping (real *Tab route keys -> semantic names); tab bar routed through the registry (TAB_GLYPHS retired)
  - StatusDisplayState union + pure statusGlyph(state) beside ringVisual (one glyph+hue source)
  - StatusGlyph primitive (silhouette via registry, colour via status tokens, accessibilityLabel)
affects: [renderer phases, Phase-15 status adoption, Plan 23-07 (warning glyph), ContactCard/Profile/Orrery]

actuals:
  tokens: 5000
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Semantic icon registry seam: screens import semantic names only; base family swaps at one map"
    - "React-native-free registry module (string glyphs); Ionicons-name type validation deferred to Icon.tsx where the real component is imported (tsc gate)"
    - "Derived string-valued tone union excludes array-valued palette tokens automatically"
    - "statusGlyph extends ringVisual in-module (single status source), not a fork"

key-files:
  created:
    - src/components/icons/icon-registry.ts
    - src/components/icons/icon-registry.test.ts
    - src/components/icons/Icon.tsx
    - src/components/icons/StatusGlyph.tsx
    - src/theme/tokens/icon-size.ts
    - src/components/contact-card-ring.test.ts
  modified:
    - src/components/contact-card-ring.ts
    - src/navigation/RootNavigator.tsx

key-decisions:
  - "icon-registry.ts stores plain glyph STRINGS so the module stays react-native-free (node-testable); Ionicons-name validation happens in Icon.tsx via `glyph` flowing straight into `<Ionicons name={glyph}>` — an invalid registry glyph fails tsc there, no cast, no separate assertion module"
  - "IconTone derived as a mapped type over ThemePalette keeping only string-valued keys — avatarSwatches/gravityTiers/starPalette (readonly string[]) excluded automatically; any future string token included with no edit"
  - "StatusTone narrowed to statusStable/statusWobble/statusDecay/rogue/border (StatusGlyph's neutral/status roles); asserted StatusTone ⊆ IconTone"
  - "StatusDisplayState = ProfileStatus | 'snoozed' | null — snooze is an independent condition the consumer composes, NOT a ProfileStatus member; ringVisual's ProfileStatus|null contract left untouched"
  - "Six distinct status silhouettes (checkmark-circle / time / warning / remove-circle / ellipse / moon) so status is readable without colour; null -> status-neutral"
  - "Tab bar Icon resolves its own tone (accent focused / textSecondary otherwise), preserving the former active/inactive tint while going through the registry"

patterns-established:
  - "Icon registry: one semantic map, swappable base family, token colour + token size"
  - "Status glyph source extends ringVisual (no second status source, D-05)"

requirements-completed: [THEME-08, THEME-09]

coverage:
  - id: D1
    description: "Semantic icon registry + Icon primitive + ICON_SIZE tokens; tab bar routed through the registry (TAB_GLYPHS retired)"
    requirement: THEME-09
    verification:
      - kind: unit
        ref: "src/components/icons/icon-registry.test.ts (9 tests: outline+filled completeness, tab-key resolution, IconTone/StatusTone type gates)"
        status: pass
      - kind: automated_ui
        ref: "grep -n TAB_GLYPHS src/navigation/RootNavigator.tsx (empty — fork retired)"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit (clean — @ts-expect-error array-key rejection + Ionicons glyph validation enforced); npm run check:colors (clean)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Distinct per-status silhouette glyphs extending ringVisual; StatusGlyph primitive with token colour + accessibility label"
    requirement: THEME-08
    verification:
      - kind: unit
        ref: "src/components/contact-card-ring.test.ts (5 tests: totality, six distinct ids, null->neutral, snoozed distinct, determinism)"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit + npm run check:colors clean on StatusGlyph.tsx + contact-card-ring.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Six status states remain distinguishable under greyscale by silhouette + border weight + label alone"
    requirement: THEME-08
    verification: []
    human_judgment: true
    rationale: "Greyscale/CVD distinguishability is a visual judgment on the physical Pixel; deferred to the end-of-phase device UAT per the plan's <human-check> (screen adoption of StatusGlyph is itself deferred to renderer/Phase-15)."

duration: 8min
completed: 2026-09-03
status: complete
---

# Phase 23 Plan 05: Icon Registry & Status Glyphs Summary

**A single semantic icon registry (state variants, token colour/size, swappable base family) now powers the tab bar, and six distinct status silhouettes extend ringVisual so relationship state reads without colour — THEME-09 and THEME-08 delivered as first-class seams.**

## Performance

- **Duration:** ~8 min
- **Tasks:** 2/2 (both TDD: RED → GREEN)
- **Commits:** 4 (test/feat per task)

## Accomplishments

- **Task 1 — Icon registry + Icon + ICON_SIZE; TAB_GLYPHS retired.** `ICON_REGISTRY` maps semantic names to `{outline, filled}` Ionicons pairs (`IconName` union); reserves the four tab identities, six status-glyph names, and Plan 07's `warning`. `TAB_ICON` maps the real `*Tab` route keys onto semantic names, typed `Record<keyof TabParamList, IconName>` for completeness. `Icon` resolves colour via `useTheme().colors[tone]` and size via `ICON_SIZE` (16/20/24/28). `IconTone` is a mapped type keeping only string-valued `ThemePalette` keys (array tokens excluded); `StatusTone` narrows further. The tab bar renders through `<Icon>`; the ad-hoc glyph map is gone.
- **Task 2 — Status glyphs extending ringVisual.** `StatusDisplayState = ProfileStatus | 'snoozed' | null` and a pure total `statusGlyph(state)` added *beside* the unchanged `ringVisual` (one glyph+hue source). Six distinct silhouettes; `null → status-neutral`; `snoozed` distinct from every `ProfileStatus` glyph. `StatusGlyph.tsx` renders the silhouette through the registry with a `StatusTone` status token (never a hex) and an `accessibilityLabel` naming the state.

## Verification

- `npx vitest run src/components/icons src/components/contact-card-ring.test.ts` — 14 tests pass.
- Full suite: `npx vitest run` — **2049 passed (208 files)**, no regression from the new cross-module import.
- `npm run check:colors src/components/icons src/navigation/RootNavigator.tsx` and on `StatusGlyph.tsx`/`contact-card-ring.ts` — clean.
- `npx tsc --noEmit` — clean (proves the `@ts-expect-error` array-key rejection fires and every registry glyph is a valid Ionicons name).
- `grep -n "TAB_GLYPHS" src/navigation/RootNavigator.tsx` — no match.

## Key Decisions

See frontmatter `key-decisions`. The load-bearing one: the registry module stays react-native-free by storing plain glyph strings; Ionicons-name type validation lives in `Icon.tsx` (where the real component is imported), so `tsc` validates glyphs without pulling `react-native` into the node vitest harness.

## Deferred / Scope

- **Screen adoption of `StatusGlyph`** (ContactCard/Profile/Orrery) and equivalent widget glyph semantics are deferred by design to renderer/Phase-15 (planning-notes scope). THEME-08 is delivered here as the single source + primitive.
- **Greyscale device check** of the six silhouettes is the end-of-phase Pixel UAT (`<human-check>` D3).
- In-form raw `✕` conversions are left to consuming phases (planner scope call).
- The custom Orbit icon FAMILY is intentionally NOT built — only the registry seam that enables a later swap.

## Deviations from Plan

None — plan executed as written. No architectural changes, no auth gates, no package installs (`@expo/vector-icons` already present from Plan 02).

## Known Stubs

None. All deliverables are wired: the registry is real, `Icon`/`StatusGlyph` render through it, and the tab bar consumes it. StatusGlyph screen adoption is a documented, plan-scoped deferral (renderer/Phase-15), not a stub.

## Self-Check: PASSED
