---
phase: 23-theme-visual-system
plan: 07
subsystem: ui
tags: [buttons, modals, sheets, confirm-dialog, destructive, a11y, theme-tokens, overlay-lifecycle, THEME-10]

# Dependency graph
requires:
  - phase: 23-02
    provides: RADII/SPACING tokens + AppText role primitive
  - phase: 23-03
    provides: per-mode accent tones + the NAMED onDanger destructive foreground on ThemePalette
  - phase: 23-05
    provides: semantic icon registry + Icon primitive; the reserved `warning` glyph name
provides:
  - Button — one API with role variants (Primary/Secondary/Tertiary/Destructive/IconOnly); token colour, 44px min target, destructive-beyond-colour (danger fill + reserved `warning` glyph + onDanger foreground)
  - button-roles.ts — pure RN-free role->token-key map (buttonVisual) + assertButtonAccessibility a11y contract (node-tested)
  - Modal — full-screen overlay variant (radius.xl top corners, drag handle, safe-area, scrim)
  - Sheet — compact + detail/half-height bottom-sheet variants sharing radius/scrim/drag-handle
  - ConfirmDialog — confirmation dialog; destructive path uses the Destructive Button + names the action + no scrim/Back dismissal
  - overlay-base.tsx — shared scrim (colors.background at opacity) + Android lifecycle contract (visible/onRequestClose wired to Back, focus-on-open, dismissable policy)
  - src/components/ui barrel (index.ts)
affects: [renderer phases 24-36, Phase-15 destructive-flow adoption, Phase-37 Settings]

actuals:
  tokens: 7400
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Pure RN-free role/treatment sibling (button-roles.ts) beside the RN component (Button.tsx) so role->token wiring is node-unit-testable without loading react-native (mirrors contact-card-ring.ts / avatar-initials.ts)"
    - "Role helper returns theme-token KEYS (IconTone) not resolved colours, so it carries zero colour literal and one foreground token drives BOTH the AppText label colour AND the Icon glyph tone (destructive warning glyph guaranteed same onDanger as its label)"
    - "TS discriminated union (LabelButtonProps | IconOnlyButtonProps) makes IconOnly require icon + accessibilityLabel at compile time; runtime assertButtonAccessibility is belt-and-suspenders"
    - "Shared overlay-base (BaseOverlay) owns the RN Modal + scrim + Android Back/scrim dismissal policy; Modal/Sheet/ConfirmDialog compose it so radius/scrim/lifecycle are defined once"
    - "Destructive ConfirmDialog sets dismissable=false -> inert scrim + Back no-op (explicit-choice-only); non-destructive overlays dismiss on scrim-tap and Back"

key-files:
  created:
    - src/components/ui/button-roles.ts
    - src/components/ui/Button.tsx
    - src/components/ui/Button.test.ts
    - src/components/ui/overlay-base.tsx
    - src/components/ui/Modal.tsx
    - src/components/ui/Sheet.tsx
    - src/components/ui/ConfirmDialog.tsx
    - src/components/ui/index.ts
  modified: []

key-decisions:
  - "button-roles.ts added beside Button.tsx (not in the plan's files list) to satisfy the repo's render-free node-test constraint — the established ringVisual/avatar-initials pure-sibling pattern; Button.tsx re-exports it so it stays 'exported from Button'"
  - "The role helper returns token KEYS (IconTone), never resolved colours — one foreground token drives label colour AND glyph tone, so the destructive warning glyph is provably tinted the same onDanger as the label; the test asserts wiring with zero colour literal"
  - "Destructive = danger fill/border + reserved `warning` registry glyph + the NAMED onDanger foreground (never onAccent, never a literal) — distinct beyond colour; ConfirmDialog composes this Button so the primitive supplies the colour+glyph half and the dialog supplies the explicit-confirmation half"
  - "One shared overlay-base owns the Android lifecycle contract: onRequestClose wired to RN Modal (system Back) on EVERY variant so Back is never trapped; destructive ConfirmDialog disables scrim-tap/Back dismissal (dismissable=false) requiring an explicit button choice (REVIEWS 23-07 MEDIUM)"
  - "biome-ignore-all lint/a11y/useValidAriaRole on Button.tsx + ConfirmDialog.tsx — the semantic `role` prop on AppText/Button false-fires the ARIA-role lint (same precedent as ThemePreviewScreen.tsx); the plan mandates the `role` prop name so renaming was not an option"

requirements-completed: [THEME-10]

coverage:
  - id: T1
    description: "Button five-role hierarchy: Primary=accent/onAccent, Secondary=surface/border/textPrimary, Tertiary=accentText, Destructive=danger fill + `warning` glyph + onDanger foreground, IconOnly requires accessibilityLabel + 44px floor"
    requirement: THEME-10
    verification:
      - kind: unit
        ref: "src/components/ui/Button.test.ts (10 tests: all five role->token mappings, destructive onDanger!=onAccent + warning glyph, icon-only a11y contract throws/passes, 44x44 floor)"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit + npm run check:colors src/components/ui (clean — no hex, colour only via useTheme tokens); biome clean"
        status: pass
    human_judgment: false
  - id: T2
    description: "Shared Modal/Sheet/ConfirmDialog overlay variants: radius.xl top corners, scrim=colors.background at opacity, visible+onRequestClose wired to Android Back, destructive ConfirmDialog explicit-choice-only"
    requirement: THEME-10
    verification:
      - kind: static
        ref: "grep onRequestClose in overlay-base.tsx (RN Modal.onRequestClose), dismissable={!destructive} in ConfirmDialog.tsx; check:colors clean (no hex scrim); tsc clean"
        status: pass
      - kind: unit
        ref: "npx vitest run — 2098 passed (211 files), no regression from the new ui primitives"
        status: pass
    human_judgment: false
  - id: T3
    description: "On a Pixel (device-UAT, end-of-phase): each sheet/modal renders with shared radius/scrim/safe-area; Android Back dismisses a non-destructive Modal/Sheet and scrim-tap dismisses; a destructive ConfirmDialog does NOT dismiss on Back or scrim-tap, requires an explicit choice, names the action, shows the warning glyph; scrim dims without a colour literal"
    requirement: THEME-10
    verification: []
    human_judgment: true
    rationale: "Rendered overlay geometry, safe-area, Android Back/scrim behaviour, and the visual destructive-beyond-colour cue are UI-observable on the physical Pixel only; the primitives are node/props/lint-verified but the frame + gesture are deferred to the end-of-phase device UAT per the plan's <human-check>. Adoption into existing destructive flows/screens is a recorded Phase-15 scope boundary."

duration: 12min
completed: 2026-09-03
status: complete
---

# Phase 23 Plan 07: Button Hierarchy & Modal/Sheet Variants Summary

**A formal five-role Button hierarchy (Primary/Secondary/Tertiary/Destructive/IconOnly) with token colour, a 44px touch floor, and destructive-beyond-colour (danger fill + the reserved `warning` glyph + the NAMED onDanger foreground), plus shared compact/detail/full/confirm overlay variants with an explicit Android Back / scrim dismissal contract — THEME-10 delivered as accessible, token-driven primitives.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2/2 (Task 1 test-driven — pure role helper + 10 unit assertions)
- **Commits:** 3 (2 feat task commits + this docs commit)

## Accomplishments

- **Task 1 — Button hierarchy (059804d).** `button-roles.ts` is the pure, react-native-free role→treatment map: `buttonVisual(role)` returns theme-token KEYS (an `IconTone` foreground) + geometry, and `assertButtonAccessibility` enforces the icon-only a11y contract. `Button.tsx` resolves those keys via `useTheme()` and renders a `Pressable` — Primary filled `accent`/`onAccent`; Secondary tonal `surface`+`border` outline; Tertiary text-only `accentText`; **Destructive `danger` fill + the reserved `warning` registry glyph tinted `onDanger` + `onDanger` label** (never `onAccent`, never a literal); IconOnly a registry glyph in a 44×44 circular target with a REQUIRED `accessibilityLabel` (TS discriminated union + runtime assert). `Button.test.ts` covers all five role→token mappings, the destructive `onDanger`≠`onAccent` + `warning` pairing, the icon-only contract, and the 44px floor (10 tests).
- **Task 2 — Modal / Sheet / ConfirmDialog (dcb9f0e).** `overlay-base.tsx` owns the shared scrim (`colors.background` at `SCRIM_OPACITY`, never a literal — the DropdownFieldWidget idiom) and the Android lifecycle contract: `visible` + `onRequestClose` wired to RN `Modal.onRequestClose` (system Back) on every variant, a11y focus moved onto the content on open, and a `dismissable` policy (inert scrim + Back no-op when false). `Modal` is the full-screen variant (`radius.xl` top corners, drag handle, safe-area); `Sheet` is compact + detail/half-height bottom sheets sharing that radius/scrim/handle; `ConfirmDialog` is the centered confirmation whose **destructive path composes the Destructive `Button`** (warning glyph + `onDanger`), adds a header warning glyph, names the action via its title, and sets `dismissable=false` so scrim-tap and a stray Back do NOT dismiss (explicit choice only) — non-destructive dialogs use a Primary confirm and may dismiss. All variants barrel-exported from `src/components/ui/index.ts`.

## Verification

- `npx vitest run src/components/ui/Button.test.ts` — 10 tests pass (five roles, destructive onDanger/warning, icon-only a11y throw+pass, 44px floor).
- Full suite `npx vitest run` — **2098 passed (211 files)**, no regression from the new primitives.
- `npm run check:colors src/components/ui` — clean (no hex; scrim + all colour via `useTheme()` tokens).
- `npx tsc --noEmit` — clean (the discriminated union proves IconOnly requires icon+accessibilityLabel; the registry glyph type-validates).
- `npx @biomejs/biome check src/components/ui/*` — clean (with the documented semantic-`role` a11y ignore).
- Acceptance greps: `onRequestClose` wired to RN Modal in overlay-base; `dismissable={!destructive}` in ConfirmDialog; destructive `warning`/`onDanger` wiring in button-roles.

## Key Decisions

See frontmatter `key-decisions`. Load-bearing: the pure `button-roles.ts` sibling (repo render-free test constraint) returns token KEYS so one foreground token drives both the label colour and the glyph tone — making "destructive warning glyph tinted the same `onDanger` as its label" a structural guarantee, not a convention; and the single `overlay-base` owning the Android Back/scrim dismissal policy so a reusable overlay can never trap Back and a destructive confirmation can never be scrim/Back-dismissed.

## Deviations from Plan

### Added file (pattern-following)

**1. [Rule 3 - Blocking] Added `src/components/ui/button-roles.ts` (not in the plan's Task 1 files list)**
- **Found during:** Task 1 (writing Button.test.ts)
- **Issue:** The vitest env is node/render-free; importing from `Button.tsx` transitively loads `react-native` (Flow-typed, unparseable in node), so the role→treatment mapping could not be unit-tested from `Button.test.ts` as the plan requires.
- **Fix:** Extracted the pure mapping + a11y contract into an RN-free sibling `button-roles.ts` (the established `contact-card-ring.ts`/`avatar-initials.ts` pattern); `Button.tsx` imports and re-exports it so it stays "exported from Button" for app consumers.
- **Files modified:** src/components/ui/button-roles.ts (new), src/components/ui/Button.tsx (re-export)
- **Commit:** 059804d

### Lint accommodation

**2. [Rule 3 - Blocking] biome `lint/a11y/useValidAriaRole` false-fires on the semantic `role` prop**
- **Found during:** Task 2 (biome sweep)
- **Issue:** biome treats any JSX `role="…"` as an ARIA role and errored on `<AppText role="label">` / `<Button role="secondary">`; the plan mandates the `role` prop name, so renaming was not permitted.
- **Fix:** Added the same file-level `// biome-ignore-all lint/a11y/useValidAriaRole` used by the existing `ThemePreviewScreen.tsx` (documented precedent) to `Button.tsx` and `ConfirmDialog.tsx`.
- **Files modified:** src/components/ui/Button.tsx, src/components/ui/ConfirmDialog.tsx
- **Commit:** dcb9f0e

No architectural changes, no auth gates, no package installs (all deps present from Plan 02).

## Deferred / Scope

- **Adoption is Phase 15 by design** (REVIEWS scope note): this plan ships the Button/Modal/Sheet/ConfirmDialog PRIMITIVES + the destructive-beyond-colour contract. Migrating existing destructive flows and modals to them is a renderer-phase/Phase-15 task — a recorded scope boundary, not a gap. THEME-10 is delivered at the primitive level.
- **Device UAT (end-of-phase Pixel):** rendered overlay geometry/safe-area, Android Back + scrim dismissal behaviour, and the visual destructive-beyond-colour cue are UI-observable only (coverage T3, human_judgment).

## Known Stubs

None. Every primitive is fully wired: Button resolves real tokens and renders the registry warning glyph for destructive; the overlays render real RN Modals with the scrim + lifecycle contract; ConfirmDialog composes the real Destructive Button. Screen adoption is a documented, plan-scoped Phase-15 deferral, not a stub.

## Self-Check: PASSED
